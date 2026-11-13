/* global AbortSignal, fetch, WebSocket */
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { spawn } from "node:child_process";
import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import process from "node:process";
import { clearTimeout, setTimeout } from "node:timers";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL, URL } from "node:url";
import { browserApiModuleUrl } from "./release-browser-paths.mjs";

async function findBrowser() {
  const candidates = [
    process.env.USER_WEB_BROWSER,
    process.env["PROGRAMFILES(X86)"] &&
      join(process.env["PROGRAMFILES(X86)"], "Microsoft/Edge/Application/msedge.exe"),
    process.env.PROGRAMFILES &&
      join(process.env.PROGRAMFILES, "Google/Chrome/Application/chrome.exe"),
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      continue;
    }
  }
  throw new Error("需要本机安装 Edge 或 Chrome；也可用 USER_WEB_BROWSER 指定浏览器路径。");
}

async function reservePort() {
  const server = createServer();
  await new Promise((resolvePromise, rejectPromise) => {
    server.once("error", rejectPromise);
    server.listen(0, "127.0.0.1", resolvePromise);
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const port = address.port;
  await new Promise((resolvePromise, rejectPromise) => {
    server.close((error) => (error ? rejectPromise(error) : resolvePromise()));
  });
  return port;
}

export async function waitForHttp(
  url,
  child,
  readOutput,
  { serviceName = "用户网页", timeoutMs = 30000 } = {},
) {
  const started = Date.now();
  let launchError;
  let lastRequest = "尚未收到 HTTP 响应";
  const onError = (error) => {
    launchError = error;
  };
  child.on("error", onError);
  // Startup output may contain credentials. Report codes/timing, never raw output.
  const diagnostic = () =>
    `耗时=${Date.now() - started}ms; exit=${child.exitCode}; signal=${child.signalCode}; 最后请求=${lastRequest}; 输出字节=${Buffer.byteLength(readOutput())}`;
  try {
    while (Date.now() - started < timeoutMs) {
      if (launchError)
        throw new Error(
          `${serviceName}启动失败: ${launchError.code ?? "PROCESS_ERROR"}; ${diagnostic()}`,
        );
      if (child.exitCode !== null || child.signalCode !== null)
        throw new Error(`${serviceName}提前退出; ${diagnostic()}`);
      try {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(
            Math.max(1, Math.min(2500, timeoutMs - (Date.now() - started))),
          ),
        });
        if (response.ok) return response;
        lastRequest = `HTTP ${response.status}`;
        await response.body?.cancel();
      } catch (error) {
        lastRequest = error.cause?.code ?? error.name;
      }
      await delay(Math.max(0, Math.min(200, timeoutMs - (Date.now() - started))));
    }
    if (launchError)
      throw new Error(
        `${serviceName}启动失败: ${launchError.code ?? "PROCESS_ERROR"}; ${diagnostic()}`,
      );
    throw new Error(`${serviceName}启动超时; ${diagnostic()}`);
  } finally {
    child.off("error", onError);
  }
}

async function waitForJson(url) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return await response.json();
    } catch {
      await delay(100);
    }
  }
  throw new Error("浏览器调试接口没有启动。");
}

export async function localApiRequest(baseUrl, path, profileHandle, method = "GET", body) {
  const response = await fetch(baseUrl + path, {
    method,
    headers: {
      ...(profileHandle ? { authorization: "Bearer " + profileHandle } : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const value = await response.json();
  assert.ok(
    response.ok,
    method + " " + path + " failed: " + response.status + " " + JSON.stringify(value),
  );
  return value;
}

export async function createLocalProfile(baseUrl, profile) {
  const value = await localApiRequest(baseUrl, "/local/sessions", undefined, "POST", { profile });
  assert.equal(typeof value.handle, "string");
  return value.handle;
}

function connectCdp(url, onEvent = () => {}) {
  const socket = new WebSocket(url);
  const pending = new Map();
  let nextId = 0;
  const ready = new Promise((resolvePromise, rejectPromise) => {
    socket.addEventListener("open", resolvePromise, { once: true });
    socket.addEventListener("error", rejectPromise, { once: true });
  });
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if (message.method) onEvent(message.method, message.params ?? {});
    if (message.id !== undefined && pending.has(message.id)) {
      const wait = pending.get(message.id);
      pending.delete(message.id);
      clearTimeout(wait.timer);
      if (message.error) wait.reject(new Error(message.error.message));
      else wait.resolve(message.result ?? {});
    }
  });
  socket.addEventListener("close", () => {
    for (const wait of pending.values()) wait.reject(new Error("浏览器调试连接已关闭。"));
    pending.clear();
  });
  return {
    ready,
    send(method, params = {}) {
      const id = ++nextId;
      return new Promise((resolvePromise, rejectPromise) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          rejectPromise(new Error("浏览器操作超时：" + method));
        }, 12000);
        pending.set(id, { resolve: resolvePromise, reject: rejectPromise, timer });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
    close() {
      socket.close();
    },
  };
}

export async function evaluate(page, expression) {
  const response = await page.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (response.exceptionDetails) {
    const details = response.exceptionDetails;
    throw new Error(
      [details.text, details.exception?.description].filter(Boolean).join("\n") ||
        "网页脚本执行失败。",
    );
  }
  return response.result?.value;
}

export async function waitForExpression(page, expression, message) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (await evaluate(page, "Boolean(" + expression + ")")) return;
    await delay(100);
  }
  throw new Error(message);
}

export async function navigate(page, url, readyExpression) {
  await page.send("Page.navigate", { url });
  await waitForExpression(
    page,
    "document.readyState === 'complete' && (" + readyExpression + ")",
    "页面未能正常显示：" + url,
  );
}

export async function clickParentControl(page, selector) {
  const scrolled = await evaluate(
    page,
    `(() => { const target=document.querySelector(${JSON.stringify(selector)}); if(!target||target.disabled)return false; target.scrollIntoView({block:'center',behavior:'instant'}); return true; })()`,
  );
  assert.ok(scrolled, "家长页面操作入口必须可点击：" + selector);
  let hit;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    hit = await evaluate(
      page,
      `(() => { const target=document.querySelector(${JSON.stringify(selector)}); if(!target)return {ready:false}; const rect=target.getBoundingClientRect(); const x=rect.left+rect.width/2; const y=rect.top+rect.height/2; const top=document.elementFromPoint(x,y); return {ready:!target.disabled&&rect.width>0&&rect.height>0&&rect.left>=0&&rect.top>=0&&rect.right<=innerWidth&&rect.bottom<=innerHeight&&(top===target||target.contains(top)),x,y,rect:{left:rect.left,top:rect.top,width:rect.width,height:rect.height},targetTag:target.tagName,hitTag:top?.tagName,hitText:top?.innerText?.trim().replace(/\\s+/gu,' ').slice(0,60)}; })()`,
    );
    if (hit.ready) break;
    await delay(50);
  }
  assert.ok(hit?.ready, "家长入口未能定位到可点击位置：" + JSON.stringify({ selector, ...hit }));
  const point = { x: hit.x, y: hit.y };
  await page.send("Input.dispatchMouseEvent", { type: "mouseMoved", ...point });
  await page.send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    button: "left",
    clickCount: 1,
    ...point,
  });
  await page.send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    button: "left",
    clickCount: 1,
    ...point,
  });
  return point;
}

export async function capture(page, path, fullPage = false) {
  const bounds = fullPage ? (await page.send("Page.getLayoutMetrics")).cssContentSize : null;
  const result = await page.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: fullPage,
    ...(bounds ? { clip: { ...bounds, scale: 1 } } : {}),
  });
  await writeFile(path, Buffer.from(result.data, "base64"));
}

async function stopChild(child) {
  if (!child || child.exitCode !== null) return;
  child.kill();
  await Promise.race([
    new Promise((resolvePromise) => child.once("exit", resolvePromise)),
    delay(4000),
  ]);
  if (child.exitCode === null) {
    child.kill("SIGKILL");
    await Promise.race([
      new Promise((resolvePromise) => child.once("exit", resolvePromise)),
      delay(2000),
    ]);
  }
}

export async function startNextBrowser(
  t,
  { repositoryRoot, fixedNow, withAdmin = false, skipLegacyApi = false, startInviteApi } = {},
) {
  assert.ok(!withAdmin || fixedNow === undefined, "联合管理端测试不能使用固定时钟。");
  assert.ok(
    !skipLegacyApi || (!withAdmin && fixedNow === undefined),
    "独立邀请服务测试不能同时启动旧管理服务或固定时钟服务。",
  );
  let apiRuntime;
  let adminRuntime;
  let nextProcess;
  let browserProcess;
  let browserCdp;
  let pageCdp;
  let profilePath;
  const extraPages = [];
  const isolatedContexts = [];
  const profileTempRoot = resolve(tmpdir());
  const profilePrefix = "user-web-next-cdp-";
  let nextOutput = "";
  let apiOutput = "";
  t.after(async () => {
    for (const page of extraPages) page.connection?.close();
    for (const context of isolatedContexts) context.connection?.close();
    pageCdp?.close();
    if (browserCdp) {
      try {
        for (const page of extraPages)
          await browserCdp.send("Target.closeTarget", { targetId: page.targetId });
        for (const context of isolatedContexts) {
          if (context.disposed) continue;
          if (context.targetId) {
            await browserCdp
              .send("Target.closeTarget", { targetId: context.targetId })
              .catch(() => undefined);
          }
          try {
            await browserCdp.send("Target.disposeBrowserContext", {
              browserContextId: context.browserContextId,
            });
            context.disposed = true;
          } catch {
            // Browser.close below still owns the final cleanup fallback.
          }
        }
        await browserCdp.send("Browser.close");
      } catch {
        browserCdp.close();
      }
    }
    await stopChild(browserProcess);
    await stopChild(nextProcess);
    await apiRuntime?.close();
    await adminRuntime?.close();
    if (profilePath) {
      assert.ok(isAbsolute(profilePath), "仅可清理本次创建的绝对路径浏览器临时目录。");
      const resolvedProfilePath = resolve(profilePath);
      assert.equal(dirname(resolvedProfilePath), profileTempRoot);
      assert.ok(basename(resolvedProfilePath).startsWith(profilePrefix));
      assert.ok(basename(resolvedProfilePath).length > profilePrefix.length);
      await rm(resolvedProfilePath, { recursive: true, force: true });
    }
  });

  const packageRoot = resolve(repositoryRoot, "apps/user-web");
  const browserPath = await findBrowser();
  const nextCli = resolve(packageRoot, "node_modules/next/dist/bin/next");
  await access(nextCli);
  const port = await reservePort();
  const baseUrl = "http://127.0.0.1:" + port;
  let apiBaseUrl;
  if (withAdmin) {
    const { startNextAdminLocal } = await import(
      pathToFileURL(resolve(repositoryRoot, "scripts/start-next-admin-local.mjs")).href
    );
    const userDistDir = process.env.TASK20_NEXT_DIST_DIR;
    const adminDistDir = process.env.TASK20_NEXT_ADMIN_DIST_DIR;
    if (adminDistDir !== undefined) {
      assert.ok(adminDistDir && adminDistDir === basename(adminDistDir), "管理员 Next 输出目录必须是项目内的单层目录名。");
      process.env.TASK20_NEXT_DIST_DIR = adminDistDir;
    }
    try {
      const { buildLocalSyntheticServer } = await import(
        browserApiModuleUrl(repositoryRoot, "local-synthetic/server.js")
      );
      adminRuntime = await startNextAdminLocal({ parentOrigin: baseUrl, buildLocalSyntheticServer });
    } finally {
      if (userDistDir === undefined) delete process.env.TASK20_NEXT_DIST_DIR;
      else process.env.TASK20_NEXT_DIST_DIR = userDistDir;
    }
    apiBaseUrl = adminRuntime.ready.service;
    assert.equal(apiBaseUrl, "http://127.0.0.1:4319");
  } else if (!skipLegacyApi) {
    const instant = fixedNow === undefined ? undefined : Date.parse(fixedNow);
    assert.ok(instant === undefined || Number.isFinite(instant), "Invalid test clock.");
    const serverModule = browserApiModuleUrl(repositoryRoot, "local-synthetic/server.js");
    await access(serverModule).catch(() => {
      throw new Error("缺少本机合成 API 构建，请先执行 API 及工作区包构建，再运行网页检查。");
    });
    // Release preflight builds the API once before E2E, just as it builds Next.
    // Each test still receives its own repository, sessions, clock and random port.
    const { buildLocalSyntheticServer } = await import(serverModule);
    apiRuntime = await buildLocalSyntheticServer({
      mode: "local-synthetic",
      allowedOrigins: [baseUrl],
      ...(instant === undefined ? {} : { now: () => instant }),
    });
    apiBaseUrl = await apiRuntime.start(0);
    const apiResponse = await fetch(apiBaseUrl + "/local/profiles", {
      signal: AbortSignal.timeout(2500),
    });
    assert.equal(apiResponse.status, 200, "本机合成 API 必须可用。");
    await apiResponse.body?.cancel();
    apiOutput = "本机合成 API 已就绪（复用预构建，独立内存和时钟）。";
  }
  // Optional invited interface shares this exact synthetic repository and clock.
  let invitedApiUrl;
  if (startInviteApi) {
    assert.ok(apiRuntime && !withAdmin && !skipLegacyApi);
    invitedApiUrl = await startInviteApi(apiRuntime);
    const invitedUrl = new URL(invitedApiUrl);
    assert.equal(invitedUrl.protocol, "http:");
    assert.equal(invitedUrl.hostname, "127.0.0.1");
    assert.ok(invitedUrl.port);
  }
  nextProcess = spawn(
    process.execPath,
    [nextCli, "start", "--hostname", "127.0.0.1", "--port", String(port)],
    {
      cwd: packageRoot,
      windowsHide: true,
      env: {
        ...process.env,
        NEXT_TELEMETRY_DISABLED: "1",
        CI: "1",
        USER_WEB_LOCAL_SYNTHETIC_API: apiBaseUrl ?? "",
        ...(invitedApiUrl
          ? { USER_WEB_LOCAL_NEST_API: invitedApiUrl }
          : withAdmin && apiBaseUrl && process.env.USER_WEB_LOCAL_NEST_API === undefined
            ? { USER_WEB_LOCAL_NEST_API: apiBaseUrl }
            : {}),
        USER_WEB_NEST_API_BASE_URL: skipLegacyApi ? "" : process.env.USER_WEB_NEST_API_BASE_URL,
        USER_WEB_LOCAL_PREVIEW: "true",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  nextProcess.stdout.on("data", (chunk) => {
    nextOutput += chunk.toString("utf8");
  });
  nextProcess.stderr.on("data", (chunk) => {
    nextOutput += chunk.toString("utf8");
  });

  const firstResponse = await waitForHttp(
    baseUrl + "/web/visitor/home",
    nextProcess,
    () => nextOutput,
  );
  assert.equal(firstResponse.status, 200, "Next 首页必须返回 200。");
  await firstResponse.body?.cancel();
  const browserPort = await reservePort();
  profilePath = await mkdtemp(join(profileTempRoot, profilePrefix));
  browserProcess = spawn(
    browserPath,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "--remote-debugging-address=127.0.0.1",
      "--remote-allow-origins=*",
      "--remote-debugging-port=" + browserPort,
      "--user-data-dir=" + profilePath,
      "about:blank",
    ],
    { stdio: "ignore", windowsHide: true },
  );

  const browserVersion = await waitForJson("http://127.0.0.1:" + browserPort + "/json/version");
  browserCdp = connectCdp(browserVersion.webSocketDebuggerUrl);
  await browserCdp.ready;
  const pageTargets = await waitForJson("http://127.0.0.1:" + browserPort + "/json/list");
  const target = pageTargets.find((item) => item.type === "page");
  assert.ok(target?.webSocketDebuggerUrl, "浏览器没有创建页面。");
  return {
    baseUrl,
    apiBaseUrl,
    adminBaseUrl: adminRuntime?.ready.admin,
    get nextOutput() {
      return nextOutput;
    },
    get apiOutput() {
      return apiOutput;
    },
    async connectPage(onEvent) {
      assert.equal(pageCdp, undefined, "每个测试只创建一个浏览器页面连接。");
      pageCdp = connectCdp(target.webSocketDebuggerUrl, onEvent);
      await pageCdp.ready;
      await pageCdp.send("Page.enable");
      await pageCdp.send("Runtime.enable");
      await pageCdp.send("Network.enable");
      return pageCdp;
    },
    async createPage(onEvent) {
      const { targetId } = await browserCdp.send("Target.createTarget", { url: "about:blank" });
      const ownedPage = { targetId, connection: undefined };
      extraPages.push(ownedPage);
      let createdTarget;
      for (let attempt = 0; attempt < 80; attempt += 1) {
        const targets = await waitForJson("http://127.0.0.1:" + browserPort + "/json/list");
        createdTarget = targets.find((item) => item.id === targetId && item.type === "page");
        if (createdTarget?.webSocketDebuggerUrl) break;
        await delay(100);
      }
      assert.ok(createdTarget?.webSocketDebuggerUrl, "新标签页必须属于本次创建的 target。");
      ownedPage.connection = connectCdp(createdTarget.webSocketDebuggerUrl, onEvent);
      await ownedPage.connection.ready;
      await ownedPage.connection.send("Page.enable");
      await ownedPage.connection.send("Runtime.enable");
      await ownedPage.connection.send("Network.enable");
      return ownedPage.connection;
    },
    async createIsolatedPage(onEvent) {
      const { browserContextId } = await browserCdp.send("Target.createBrowserContext");
      const ownedContext = {
        browserContextId,
        targetId: undefined,
        connection: undefined,
        disposed: false,
      };
      isolatedContexts.push(ownedContext);
      try {
        const created = await browserCdp.send("Target.createTarget", {
          url: "about:blank",
          browserContextId,
        });
        ownedContext.targetId = created.targetId;
        let createdTarget;
        for (let attempt = 0; attempt < 80; attempt += 1) {
          const targets = await waitForJson("http://127.0.0.1:" + browserPort + "/json/list");
          createdTarget = targets.find(
            (item) => item.id === ownedContext.targetId && item.type === "page",
          );
          if (createdTarget?.webSocketDebuggerUrl) break;
          await delay(100);
        }
        assert.ok(createdTarget?.webSocketDebuggerUrl, "隔离浏览器页面必须属于新建的会话。");
        ownedContext.connection = connectCdp(createdTarget.webSocketDebuggerUrl, onEvent);
        await ownedContext.connection.ready;
        await ownedContext.connection.send("Page.enable");
        await ownedContext.connection.send("Runtime.enable");
        await ownedContext.connection.send("Network.enable");
        return ownedContext.connection;
      } catch (error) {
        ownedContext.connection?.close();
        if (ownedContext.targetId) {
          await browserCdp
            .send("Target.closeTarget", { targetId: ownedContext.targetId })
            .catch(() => undefined);
        }
        try {
          await browserCdp.send("Target.disposeBrowserContext", { browserContextId });
          ownedContext.disposed = true;
        } catch {
          // The browser process is still owned by this test and will be stopped during teardown.
        }
        throw error;
      }
    },
  };
}
