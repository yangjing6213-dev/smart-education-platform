/* global fetch, AbortSignal */
import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { access, mkdir, mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { basename, dirname, join, resolve } from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath, pathToFileURL, URL } from "node:url";
import { promisify } from "node:util";
import { assertTaskOwnedDirectory, resolveReleaseBrowserPaths } from "./release-browser-paths.mjs";
import { startNextBrowser } from "./user-web-next-browser.mjs";

export const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const paths = resolveReleaseBrowserPaths(repositoryRoot);
export const { artifactRoot, apiRuntimeRoot } = paths;
const matrixCandidate = process.env.TASK20_BROWSER_API_MODE === "preflight-candidate";
const adminRequire = createRequire(resolve(repositoryRoot, "apps/admin-web/package.json"));
const { chromium } = adminRequire("playwright");
const profileRoot = resolve(artifactRoot, "browser-profiles");
const executeFile = promisify(execFile);

function within(parent, child) {
  assertTaskOwnedDirectory(parent, child);
}
within(resolve(repositoryRoot, "artifacts"), artifactRoot);
within(artifactRoot, profileRoot);
if (matrixCandidate) {
  assert.equal(process.env.TASK20_NEXT_DIST_DIR, paths.userDistDirectory, "CANDIDATE_USER_DIST_MISMATCH");
  const userRoot = join(repositoryRoot, "apps/user-web");
  within(userRoot, join(userRoot, paths.userDistDirectory));
} else {
  within(artifactRoot, apiRuntimeRoot);
}

async function port() {
  const server = createServer();
  await new Promise((resolveReady, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveReady);
  });
  const value = server.address().port;
  await new Promise((resolveClosed, reject) =>
    server.close((error) => (error ? reject(error) : resolveClosed())),
  );
  return value;
}

async function browserPath() {
  for (const candidate of [
    process.env.USER_WEB_BROWSER,
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
  ].filter(Boolean)) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      /* Try only installed browsers. */
    }
  }
  throw new Error("缺少已安装的Edge/Chrome；本任务不安装浏览器。");
}

async function stop(child) {
  if (!child || child.exitCode !== null) return;
  if (process.platform === "win32" && Number.isInteger(child.pid)) {
    try {
      await executeFile("taskkill", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true });
    } catch (error) {
      if (child.exitCode === null)
        throw new Error(`本任务网页进程树停止失败：${error.code ?? "PROCESS_ERROR"}`);
    }
  } else child.kill();
  if (child.exitCode !== null) return;
  await Promise.race([new Promise((done) => child.once("exit", done)), delay(4000)]);
  if (child.exitCode === null) {
    child.kill("SIGKILL");
    await Promise.race([new Promise((done) => child.once("exit", done)), delay(2000)]);
  }
}

async function launchNext(app, origin, apiOrigin, legacyOrigin, children) {
  const appRoot = resolve(
    process.env[app === "user-web" ? "TASK20_USER_WEB_APP_ROOT" : "TASK20_ADMIN_WEB_APP_ROOT"] ??
      resolve(artifactRoot, "web-workspace/apps", app),
  );
  within(resolve(artifactRoot, "web-workspace"), appRoot);
  const next = resolve(appRoot, "node_modules/next/dist/bin/next");
  await access(next);
  const dist = process.env.TASK20_NEXT_DIST_DIR ?? ".next";
  assert.ok(dist === basename(dist) && !/a1-313|a313/iu.test(dist), "只能启动本任务隔离构建。");
  within(appRoot, resolve(appRoot, dist));
  await access(resolve(appRoot, dist, "BUILD_ID"));
  // Production admin proxy intentionally rejects loopback origins. Preserve that
  // protection: validate its production build above, then use the already allowed
  // development proxy in a separate cache inside this task's isolated source copy.
  const adminDevelopment = app === "admin-web";
  const runtimeDist = adminDevelopment ? ".next-a351-browser-dev" : dist;
  within(appRoot, resolve(appRoot, runtimeDist));
  let outputBytes = 0,
    failure;
  const child = spawn(
    process.execPath,
    [
      next,
      adminDevelopment ? "dev" : "start",
      ...(adminDevelopment ? ["--webpack"] : []),
      "--hostname",
      "127.0.0.1",
      "--port",
      new URL(origin).port,
    ],
    {
      cwd: appRoot,
      env: {
        ...process.env,
        NEXT_TELEMETRY_DISABLED: "1",
        CI: "1",
        TASK20_NEXT_DIST_DIR: runtimeDist,
        NODE_ENV: adminDevelopment ? "development" : "production",
        USER_WEB_LOCAL_PREVIEW: "true",
        USER_WEB_LOCAL_NEST_API: apiOrigin ?? "",
        USER_WEB_LOCAL_SYNTHETIC_API: legacyOrigin ?? "",
        USER_WEB_NEST_API_BASE_URL: "",
        ADMIN_WEB_LOCAL_NEST_API: apiOrigin ?? "",
        ADMIN_WEB_NEST_API_BASE_URL: "",
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );
  children.push(child);
  child.taskOrigin = origin;
  child.on("error", (error) => {
    failure = error.code ?? error.name;
  });
  for (const stream of [child.stdout, child.stderr])
    stream.on("data", (chunk) => {
      outputBytes += chunk.length;
    });
  for (let attempt = 0; attempt < 120; attempt++) {
    if (failure || child.exitCode !== null)
      throw new Error(`${app}启动失败: ${failure ?? child.exitCode}, 输出字节=${outputBytes}`);
    try {
      const response = await fetch(
        origin + (app === "user-web" ? "/web/visitor/home" : "/admin/login"),
        { signal: AbortSignal.timeout(2500) },
      );
      if (response.ok) {
        await response.body?.cancel();
        return;
      }
      await response.body?.cancel();
    } catch {
      /* Retry startup only. */
    }
    await delay(200);
  }
  throw new Error(`${app}启动超时，输出字节=${outputBytes}`);
}

export async function startIsolatedBrowser(
  t,
  { apiOrigin, legacyOrigin, withAdmin = false, userOrigin } = {},
) {
  const children = [];
  let context, profile;
  t.after(async () => {
    const cleanupErrors = [];
    try {
      await context?.close();
    } catch (error) {
      cleanupErrors.push(error);
    }
    for (const child of children.reverse()) {
      try {
        await stop(child);
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
    for (const child of children) {
      let reachable = true;
      for (let attempt = 0; attempt < 10 && reachable; attempt++) {
        try {
          const response = await fetch(child.taskOrigin, { signal: AbortSignal.timeout(500) });
          await response.body?.cancel();
        } catch {
          reachable = false;
        }
        if (reachable) await delay(100);
      }
      if (reachable) cleanupErrors.push(new Error(`本任务网页端口应已关闭：${child.taskOrigin}`));
    }
    if (profile) {
      const checked = resolve(profile);
      assert.equal(dirname(checked), profileRoot);
      assert.ok(basename(checked).startsWith(`${basename(artifactRoot)}-browser-`));
      try {
        await rm(checked, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
    if (cleanupErrors.length) throw new AggregateError(cleanupErrors, "本任务浏览器清理未完成。");
    t.diagnostic(`清理完成：${children.length}个本任务网页端口已关闭，独立浏览器目录已删除。`);
  });
  const baseUrl =
    userOrigin ?? process.env.TASK20_USER_WEB_ORIGIN ?? `http://127.0.0.1:${await port()}`;
  const adminBaseUrl = withAdmin
    ? (process.env.TASK20_ADMIN_WEB_ORIGIN ?? `http://127.0.0.1:${await port()}`)
    : undefined;
  for (const origin of [baseUrl, adminBaseUrl, apiOrigin, legacyOrigin].filter(Boolean)) {
    const url = new URL(origin);
    assert.equal(url.protocol, "http:");
    assert.equal(url.hostname, "127.0.0.1");
    assert.ok(url.port);
    assert.equal(url.origin, origin);
  }
  if (!process.env.TASK20_USER_WEB_ORIGIN)
    await launchNext("user-web", baseUrl, apiOrigin, legacyOrigin, children);
  if (withAdmin && !process.env.TASK20_ADMIN_WEB_ORIGIN)
    await launchNext("admin-web", adminBaseUrl, apiOrigin, legacyOrigin, children);
  for (const child of children)
    t.diagnostic(`本任务网页服务 PID=${child.pid}, origin=${child.taskOrigin}`);
  within(artifactRoot, resolve(artifactRoot, "screenshots"));
  within(artifactRoot, profileRoot);
  await mkdir(resolve(artifactRoot, "screenshots"), { recursive: true });
  await mkdir(profileRoot, { recursive: true });
  profile = await mkdtemp(join(profileRoot, `${basename(artifactRoot)}-browser-`));
  context = await chromium.launchPersistentContext(profile, {
    executablePath: await browserPath(),
    headless: true,
    viewport: { width: 1365, height: 1000 },
    args: ["--disable-gpu", "--no-first-run", "--no-default-browser-check"],
  });
  return { baseUrl, adminBaseUrl, context, browser: context.browser() };
}

// Use the matrix's verified Next build when present. Standalone runs keep their task workspace.
export async function startLegacyBrowser(
  t,
  { fixedNow, skipLegacyApi = false, startInviteApi } = {},
) {
  if (matrixCandidate) {
    return startNextBrowser(t, { repositoryRoot, fixedNow, skipLegacyApi, startInviteApi });
  }
  let local;
  const baseUrl = `http://127.0.0.1:${await port()}`;
  t.after(() => local?.close());
  let apiBaseUrl;
  if (!skipLegacyApi) {
    const { buildLocalSyntheticServer } = await import(
      pathToFileURL(resolve(apiRuntimeRoot, "local-synthetic/server.js"))
    );
    local = await buildLocalSyntheticServer({
      mode: "local-synthetic",
      allowedOrigins: [baseUrl],
      ...(fixedNow ? { now: () => Date.parse(fixedNow) } : {}),
    });
    apiBaseUrl = await local.start(0);
  }
  const apiOrigin = startInviteApi
    ? await startInviteApi(local)
    : process.env.USER_WEB_LOCAL_NEST_API;
  const runtime = await startIsolatedBrowser(t, {
    apiOrigin,
    legacyOrigin: apiBaseUrl,
    userOrigin: baseUrl,
  });
  const connect = async (page, onEvent = () => {}) => {
    const session = await runtime.context.newCDPSession(page);
    for (const method of [
      "Network.requestWillBeSent",
      "Network.responseReceived",
      "Network.loadingFinished",
      "Network.loadingFailed",
      "Runtime.exceptionThrown",
      "Fetch.requestPaused",
    ])
      session.on(method, (params) => onEvent(method, params));
    await session.send("Page.enable");
    await session.send("Runtime.enable");
    await session.send("Network.enable");
    return session;
  };
  return {
    ...runtime,
    apiBaseUrl,
    nextOutput: "隔离Next运行",
    apiOutput: "合成回归数据",
    connectPage: async (onEvent) => connect(await runtime.context.newPage(), onEvent),
    createPage: async (onEvent) => connect(await runtime.context.newPage(), onEvent),
  };
}
