/* global Buffer, process, URL */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  capture,
  clickParentControl,
  evaluate,
  navigate,
  startNextBrowser,
  waitForExpression,
} from "../../../tests/e2e/helpers/user-web-next-browser.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const packageRoot = resolve(repositoryRoot, "apps/user-web");
const artifactRoot = resolve(
  repositoryRoot,
  "artifacts/task20-a1-194-parent-health-receipt-20261021",
);
const nextCli = resolve(packageRoot, "node_modules/next/dist/bin/next");
const taskDist = ".next-task20-a1-194";
const recordId = "11111111-1111-4111-8111-111111111111";
const studentId = "22222222-2222-4222-8222-222222222222";
const relationshipId = "33333333-3333-4333-8333-333333333333";
const token = "l".repeat(43);
const accounts = new Map([
  [
    "synthetic-parent-health",
    {
      token,
      actorId: "00000000-0000-4000-8000-000000000401",
      name: "合成家长甲",
      capabilities: ["care:read", "health:read", "binding:read"],
    },
  ],
]);
const parentSummary = "模拟数据：健康跟进摘要内容，仅用于本机验证。";
let receipt = "UNREAD";

function reply(response, status, body) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(body));
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : undefined;
}

async function listen(server) {
  await new Promise((resolvePromise, rejectPromise) => {
    server.once("error", rejectPromise);
    server.listen(0, "127.0.0.1", resolvePromise);
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return `http://127.0.0.1:${address.port}`;
}

function restoreEnvironment(saved) {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

test("parent invite account views and acknowledges the published health summary", async (t) => {
  const requests = [];
  const api = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      const body = await readBody(request);
      const bearer = request.headers.authorization?.replace(/^Bearer\s+/u, "");
      const account = [...accounts.values()].find((candidate) => candidate.token === bearer);
      const action = url.pathname.match(/\/parent\/health-incidents\/[^/]+\/(read|ack)$/u)?.[1];
      const entry = {
        method: request.method,
        path: url.pathname,
        hasAuthorization: Boolean(bearer),
        username: url.pathname === "/identity/login" ? body?.username : undefined,
        capabilities: account?.capabilities,
        bodyKeys: body && typeof body === "object" ? Object.keys(body).sort() : [],
        action,
        status: 0,
      };
      requests.push(entry);
      const send = (status, payload) => {
        entry.status = status;
        return reply(response, status, payload);
      };

      if (request.method === "POST" && url.pathname === "/identity/login") {
        const found = typeof body?.username === "string" ? accounts.get(body.username) : undefined;
        if (!found || body.password !== "local-only-password")
          return send(401, { error: { code: "INVALID_CREDENTIALS" } });
        return send(200, {
          data: {
            access_token: found.token,
            token_type: "Bearer",
            expires_at: "2035-01-01T00:00:00.000Z",
          },
        });
      }
      if (request.method === "POST" && url.pathname === "/identity/logout")
        return send(200, { data: { logged_out: true } });
      if (!account) return send(401, { error: { code: "UNAUTHENTICATED" } });
      if (request.method === "GET" && url.pathname === "/me")
        return send(200, {
          data: {
            actor_id: account.actorId,
            display_name: account.name,
            memberships: [{ status: "ACTIVE", capabilities: account.capabilities }],
          },
        });
      if (request.method === "GET" && url.pathname === "/parent/care-records") {
        if (!account.capabilities.includes("care:read"))
          return send(403, { error: { code: "FORBIDDEN_SCOPE" } });
        return send(200, { data: [] });
      }
      if (request.method === "GET" && url.pathname === "/parent/notices")
        return send(200, { data: [] });
      if (request.method === "GET" && url.pathname === "/parent/health-incidents") {
        if (!account.capabilities.includes("health:read"))
          return send(403, { error: { code: "FORBIDDEN_SCOPE" } });
        return send(200, { data: [healthRecord()] });
      }
      const healthReceiptPath = new RegExp(
        `^/parent/health-incidents/${recordId}/(read|ack)$`,
        "u",
      );
      if (request.method === "POST" && healthReceiptPath.test(url.pathname)) {
        if (!account.capabilities.includes("health:read"))
          return send(403, { error: { code: "FORBIDDEN_SCOPE" } });
        const pathAction = healthReceiptPath.exec(url.pathname)?.[1];
        if (
          !body ||
          Object.keys(body).sort().join(",") !== "version" ||
          body.version !== 3 ||
          !["read", "ack"].includes(pathAction) ||
          (pathAction === "read" && receipt !== "UNREAD") ||
          (pathAction === "ack" && receipt !== "READ")
        )
          return send(409, { error: { code: "STALE_VERSION" } });
        receipt = pathAction === "read" ? "READ" : "ACKNOWLEDGED";
        return send(200, { data: healthRecord() });
      }
      return send(404, { error: { code: "NOT_FOUND" } });
    } catch {
      return reply(response, 500, { error: { code: "SYNTHETIC_STUB_FAILURE" } });
    }
  });

  function healthRecord() {
    return {
      id: recordId,
      version: 3,
      status: "PUBLISHED",
      synthetic: true,
      studentLabel: "合成学生甲",
      parentSummary,
      receiptStatus: receipt,
      updatedAt: "2026-10-20T08:00:00.000Z",
    };
  }

  const savedEnvironment = {
    TASK20_NEXT_DIST_DIR: process.env.TASK20_NEXT_DIST_DIR,
    TASK20_NEXT_TSCONFIG: process.env.TASK20_NEXT_TSCONFIG,
    USER_WEB_LOCAL_NEST_API: process.env.USER_WEB_LOCAL_NEST_API,
    USER_WEB_LOCAL_PREVIEW: process.env.USER_WEB_LOCAL_PREVIEW,
    USER_WEB_NEST_API_BASE_URL: process.env.USER_WEB_NEST_API_BASE_URL,
    NEXT_TELEMETRY_DISABLED: process.env.NEXT_TELEMETRY_DISABLED,
    CI: process.env.CI,
  };
  const apiOrigin = await listen(api);
  const tempConfig = join(artifactRoot, "next.tsconfig.json");
  const tempBuildInfo = join(artifactRoot, "next.tsbuildinfo");
  await writeFile(
    tempConfig,
    JSON.stringify({
      extends: resolve(packageRoot, "next.tsconfig.json"),
      compilerOptions: {
        incremental: true,
        tsBuildInfoFile: tempBuildInfo,
        typeRoots: [resolve(repositoryRoot, "node_modules/@types")],
      },
    }),
  );
  Object.assign(process.env, {
    TASK20_NEXT_DIST_DIR: taskDist,
    TASK20_NEXT_TSCONFIG: relative(packageRoot, tempConfig),
    USER_WEB_LOCAL_NEST_API: apiOrigin,
    USER_WEB_LOCAL_PREVIEW: "true",
    USER_WEB_NEST_API_BASE_URL: "",
    NEXT_TELEMETRY_DISABLED: "1",
    CI: "1",
  });
  t.after(async () => {
    restoreEnvironment(savedEnvironment);
    await new Promise((resolvePromise) => api.close(resolvePromise));
  });

  const build = spawnSync(process.execPath, [nextCli, "build", "--webpack"], {
    cwd: packageRoot,
    windowsHide: true,
    encoding: "utf8",
    env: { ...process.env },
    timeout: 180_000,
  });
  assert.equal(
    build.status,
    0,
    `隔离目录中的 Next 本地构建必须成功。\n${(build.stdout ?? "").slice(-5000)}\n${(build.stderr ?? "").slice(-5000)}`,
  );

  const runtime = await startNextBrowser(t, { repositoryRoot, skipLegacyApi: true });
  const runtimeErrors = [];
  const externalRequests = [];
  const page = await runtime.connectPage((method, params) => {
    if (method === "Runtime.exceptionThrown")
      runtimeErrors.push(params.exceptionDetails?.text ?? "脚本异常");
    if (method === "Log.entryAdded" && params.entry?.level === "error")
      runtimeErrors.push(params.entry.text ?? "浏览器控制台错误");
    if (method === "Network.requestWillBeSent") {
      const url = params.request?.url ?? "";
      if (/^https?:/u.test(url) && new URL(url).origin !== runtime.baseUrl)
        externalRequests.push(url);
    }
  });

  await navigate(
    page,
    `${runtime.baseUrl}/web/login?next=%2Fweb%2Fparent%2Fhome`,
    "Boolean(document.querySelector('[data-invite-login]'))",
  );
  await waitForExpression(
    page,
    "Boolean(document.querySelector('input[autocomplete=\"username\"]'))",
    "未登录时应显示邀请账号登录入口。",
  );
  await waitForExpression(
    page,
    "document.querySelector('[data-invite-submit]')?.disabled === false",
    "登录状态核对完成后，登录按钮应可用。",
  );

  const fill = async (selector, value) => {
    const filled = await evaluate(
      page,
      `(() => { const input=document.querySelector(${JSON.stringify(selector)}); if(!input)return false; const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set; setter?.call(input,${JSON.stringify(value)}); input.dispatchEvent(new Event('input',{bubbles:true})); input.dispatchEvent(new Event('change',{bubbles:true})); return true; })()`,
    );
    assert.equal(filled, true, `登录表单需要包含 ${selector}`);
  };

  await fill('input[autocomplete="username"]', "synthetic-parent-health");
  await fill('input[autocomplete="current-password"]', "local-only-password");
  await clickParentControl(page, '[data-invite-submit]');
  try {
    await waitForExpression(
      page,
      `document.querySelector('[data-parent-health-row]')?.getAttribute('data-receipt')==='UNREAD'`,
      "登录后应看到机构已发布的健康跟进摘要。",
    );
  } catch (error) {
    const pageState = await evaluate(
      page,
      "JSON.stringify({state:document.querySelector('[data-parent-health-state]')?.getAttribute('data-parent-health-state'),text:document.body.innerText})",
    );
    throw new Error(
      `${error instanceof Error ? error.message : String(error)}\nPAGE=${pageState}\nAPI=${JSON.stringify(requests)}\nBROWSER=${JSON.stringify(runtimeErrors)}`,
    );
  }

  await page.send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1100,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await clickParentControl(page, '[data-parent-health-action="read"]');
  await waitForExpression(
    page,
    `document.querySelector('[data-parent-health-row]')?.getAttribute('data-receipt')==='READ'`,
    "查看健康摘要后应显示摘要内容并提供确认按钮。",
  );
  assert.equal(await evaluate(page, `document.body.innerText.includes(${JSON.stringify(parentSummary)})`), true);
  await clickParentControl(page, '[data-parent-health-action="ack"]');
  await waitForExpression(
    page,
    `document.querySelector('[data-parent-health-row]')?.getAttribute('data-receipt')==='ACKNOWLEDGED'`,
    "确认知悉后应显示服务端回执。",
  );
  assert.equal(
    await evaluate(page, "document.body.innerText.includes('已确认知悉这条健康跟进摘要。')"),
    true,
  );
  await page.send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1100,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await capture(page, resolve(artifactRoot, "parent-home-health-desktop.png"), true);
  await clickParentControl(page, "[data-parent-health-refresh]");
  await waitForExpression(
    page,
    `document.querySelector('[data-parent-health-row]')?.getAttribute('data-receipt')==='ACKNOWLEDGED'`,
    "刷新后应仍以服务端回执为准。",
  );

  await page.send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await capture(page, resolve(artifactRoot, "parent-home-health-mobile.png"), true);
  const pageText = await evaluate(page, "document.documentElement.innerText");
  assert.equal(pageText.includes(studentId), false);
  assert.equal(pageText.includes(relationshipId), false);
  assert.equal(pageText.includes(recordId), false);
  assert.equal(pageText.includes(token), false);
  assert.deepEqual(
    await evaluate(page, "({local:localStorage.length, session:sessionStorage.length})"),
    {
      local: 0,
      session: 0,
    },
  );

  assert.deepEqual(externalRequests, []);
  assert.deepEqual(runtimeErrors, []);
  assert.ok(
    requests.some((request) => request.method === "POST" && request.action === "read"),
    "本地服务必须收到健康摘要查看回执。",
  );
  assert.ok(
    requests.some((request) => request.method === "POST" && request.action === "ack"),
    "本地服务必须收到健康摘要确认回执。",
  );
  assert.ok(
    requests.every((request) => request.status === 200),
    `本机服务请求不得失败：${JSON.stringify(requests)}`,
  );
  assert.ok(
    requests.every((request) => request.hasAuthorization || request.path === "/identity/login"),
    "除邀请登录外，转发至本机服务的请求都必须带受邀会话。",
  );
  console.log(
    `TASK20_PARENT_HEALTH_PORTS=${JSON.stringify({ api: Number(new URL(apiOrigin).port), web: Number(new URL(runtime.baseUrl).port) })}`,
  );
});
