import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { mkdir } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";
import test from "node:test";
import {
  capture,
  clickParentControl,
  evaluate,
  navigate,
  startNextBrowser,
  waitForExpression,
} from "./helpers/user-web-next-browser.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const evidenceRoot = resolve(
  repositoryRoot,
  process.env.USER_WEB_E2E_ARTIFACT_ROOT ??
    "artifacts/task20-a1-130-user-web-pickup-invite-return-path-20261019/browser",
);
const evidenceRelative = relative(resolve(repositoryRoot, "artifacts"), evidenceRoot);
assert.ok(
  evidenceRelative && !evidenceRelative.startsWith("..") && !isAbsolute(evidenceRelative),
  "回归工件只能写入当前工作树的 artifacts 子目录。",
);
const bindingId = "10000000-0000-4000-8000-000000000001";
const studentId = "30000000-0000-4000-8000-000000000001";
const authorizationId = "20000000-0000-4000-8000-000000000001";

function reply(response, status, body) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(body));
}

function shanghaiToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const fields = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${fields.year}-${fields.month}-${fields.day}`;
}

async function createSyntheticApi() {
  const requests = [];
  const binding = {
    id: bindingId,
    version: 2,
    status: "APPROVED",
    studentId,
    studentLabel: "示例学生甲",
    classLabel: "示例三年级甲班",
  };
  const authorization = {
    id: authorizationId,
    version: 2,
    status: "ACTIVE",
    currentlyValid: true,
    bindingId,
    studentId,
    studentLabel: binding.studentLabel,
    classLabel: binding.classLabel,
    recipient: "pickup-alpha",
    recipientLabel: "示例接送人甲",
    type: "TEMPORARY",
    startDate: shanghaiToday(),
    endDate: shanghaiToday(),
    startTime: "15:00",
    endTime: "18:00",
  };
  const rows = [authorization];
  const records = [
    {
      id: "50000000-0000-4000-8000-000000000001",
      date: shanghaiToday(),
      time: "17:30",
      studentId,
      studentLabel: binding.studentLabel,
      recipient: "示例接送人甲",
      status: "COMPLETED",
    },
  ];
  const server = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    let body;
    try {
      body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : undefined;
    } catch {
      return reply(response, 400, { error: { code: "INVALID_JSON" } });
    }
    const path = request.url ?? "/";
    const method = request.method ?? "GET";
    const authenticated = Boolean(request.headers.authorization);
    requests.push({ path, method, authenticated });

    if (path === "/identity/login" && method === "POST") {
      if (body?.username !== "parent-demo" || body?.password !== "local-only-password")
        return reply(response, 401, { error: { code: "INVALID_CREDENTIALS" } });
      return reply(response, 200, {
        data: {
          token_type: "Bearer",
          access_token: "p".repeat(43),
          expires_at: "2099-01-01T00:00:00.000Z",
        },
      });
    }
    if (request.headers.authorization !== `Bearer ${"p".repeat(43)}`)
      return reply(response, 401, { error: { code: "UNAUTHENTICATED" } });
    if (path === "/me" && method === "GET")
      return reply(response, 200, {
        data: {
          actor_id: "00000000-0000-4000-8000-000000000001",
          display_name: "示例监护人甲",
          memberships: [
            {
              tenant_id: "00000000-0000-4000-8000-000000000064",
              campus_ids: ["00000000-0000-4000-8000-000000000065"],
              status: "ACTIVE",
              capabilities: ["binding:apply", "binding:read"],
            },
          ],
        },
      });
    if (
      method === "GET" &&
      [
        "/guardian-binding/applications",
        "/parent/student-options",
        "/consent-policies",
        "/consents",
      ].includes(path)
    )
      return reply(response, 200, { data: [] });
    if (path === "/parent/pickup" && method === "GET")
      return reply(response, 200, { data: { bindings: [binding], authorizations: rows, records } });
    if (path === "/parent/pickup/authorizations" && method === "POST") {
      const created = {
        ...authorization,
        ...body,
        id: "20000000-0000-4000-8000-000000000002",
        version: 1,
        status: "DRAFT",
        currentlyValid: false,
        recipientLabel: "示例接送人甲",
        studentId,
        studentLabel: binding.studentLabel,
        classLabel: binding.classLabel,
      };
      rows.push(created);
      return reply(response, 201, { data: created });
    }
    const action =
      /^\/parent\/pickup\/authorizations\/([0-9a-f-]{36})\/(activate|revoke|credential)$/iu.exec(
        path,
      );
    if (action && method === "POST") {
      const row = rows.find((item) => item.id === action[1]);
      if (!row) return reply(response, 404, { error: { code: "NOT_FOUND" } });
      if (action[2] === "credential")
        return reply(response, 200, {
          data: {
            authorizationId: row.id,
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
            credential: "c".repeat(43),
          },
        });
      row.status = action[2] === "activate" ? "ACTIVE" : "REVOKED";
      row.currentlyValid = action[2] === "activate";
      row.version += 1;
      return reply(response, 200, { data: row });
    }
    return reply(response, 404, { error: { code: "NOT_FOUND" } });
  });
  await new Promise((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolvePromise);
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return {
    url: `http://127.0.0.1:${address.port}`,
    requests,
    close: () =>
      new Promise((resolvePromise, reject) =>
        server.close((error) => (error ? reject(error) : resolvePromise())),
      ),
  };
}

async function setField(page, selector, value) {
  await evaluate(
    page,
    `(() => { const element=document.querySelector(${JSON.stringify(selector)}); if(!element) throw new Error('缺少输入项'); const prototype=element.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype; const setter=Object.getOwnPropertyDescriptor(prototype,'value').set; setter.call(element,${JSON.stringify(value)}); element.dispatchEvent(new Event('input',{bubbles:true})); element.dispatchEvent(new Event('change',{bubbles:true})); })()`,
  );
}

test("invited parent reads approved pickup data, creates an authorization and hides its temporary credential", async (t) => {
  await mkdir(evidenceRoot, { recursive: true });
  const api = await createSyntheticApi();
  const previousApi = process.env.USER_WEB_LOCAL_NEST_API;
  const previousDist = process.env.TASK20_NEXT_DIST_DIR;
  const previousArtifacts = process.env.USER_WEB_E2E_ARTIFACT_ROOT;
  process.env.USER_WEB_LOCAL_NEST_API = api.url;
  process.env.TASK20_NEXT_DIST_DIR ??= ".next-task20-a1-130";
  process.env.USER_WEB_E2E_ARTIFACT_ROOT = evidenceRoot;
  t.after(async () => {
    if (previousApi === undefined) delete process.env.USER_WEB_LOCAL_NEST_API;
    else process.env.USER_WEB_LOCAL_NEST_API = previousApi;
    if (previousDist === undefined) delete process.env.TASK20_NEXT_DIST_DIR;
    else process.env.TASK20_NEXT_DIST_DIR = previousDist;
    if (previousArtifacts === undefined) delete process.env.USER_WEB_E2E_ARTIFACT_ROOT;
    else process.env.USER_WEB_E2E_ARTIFACT_ROOT = previousArtifacts;
    await api.close();
  });

  const runtime = await startNextBrowser(t, { repositoryRoot, skipLegacyApi: true });
  const browserRequests = [];
  const pageErrors = [];
  const failedResponses = [];
  const page = await runtime.connectPage((method, params) => {
    if (method === "Network.requestWillBeSent")
      browserRequests.push({ url: params.request.url, headers: params.request.headers });
    if (method === "Network.responseReceived" && params.response.status >= 400)
      failedResponses.push({ url: params.response.url, status: params.response.status });
    if (method === "Runtime.exceptionThrown")
      pageErrors.push(params.exceptionDetails?.text ?? "网页脚本异常");
  });

  await navigate(
    page,
    `${runtime.baseUrl}/web/login?next=${encodeURIComponent("/web/parent/pickup")}`,
    "document.querySelector('[data-invite-state]')?.dataset.inviteState==='IDLE'",
  );
  failedResponses.length = 0;
  await setField(page, '[name="username"]', "parent-demo");
  await setField(page, '[name="password"]', "local-only-password");
  await clickParentControl(page, "[data-invite-submit]");
  try {
    await waitForExpression(
      page,
      "location.pathname === '/web/parent/pickup' && document.querySelector('[data-parent-pickup-state=READY]')",
      "邀请登录后应直接进入当前账号允许访问的接送服务。",
    );
  } catch (error) {
    const state = await evaluate(
      page,
      "JSON.stringify({href:location.href,invite:document.querySelector('[data-invite-state]')?.dataset.inviteState,pickup:document.querySelector('[data-parent-pickup-state]')?.dataset.parentPickupState,text:document.body.innerText.slice(0,500)})",
    );
    throw new Error(
      `${error instanceof Error ? error.message : "登录流程未到达接送页。"} 页面状态=${state} 上游路径=${JSON.stringify(api.requests.map(({ path, method, authenticated }) => ({ path, method, authenticated })))} 请求失败=${JSON.stringify(failedResponses)}`,
    );
  }
  assert.ok(await evaluate(page, "document.body.innerText.includes('示例学生甲')"));
  assert.ok(await evaluate(page, "document.body.innerText.includes('17:30')"));

  for (const width of [320, 390, 1365]) {
    await page.send("Emulation.setDeviceMetricsOverride", {
      width,
      height: width === 1365 ? 1000 : 900,
      deviceScaleFactor: 1,
      mobile: width !== 1365,
    });
    assert.ok(
      await evaluate(
        page,
        "document.documentElement.scrollWidth<=innerWidth && document.body.scrollWidth<=innerWidth",
      ),
      `接送安排页在 ${width}px 不得横向溢出。`,
    );
    if (width === 1365)
      await capture(page, join(evidenceRoot, "pickup-direct-invite-return.png"), true);
  }

  const today = shanghaiToday();
  for (const [name, value] of [
    ["startDate", today],
    ["endDate", today],
    ["startTime", "15:00"],
    ["endTime", "18:00"],
  ])
    await setField(page, `[name="${name}"]`, value);
  await clickParentControl(page, "[data-parent-pickup-form] button[type=submit]");
  await waitForExpression(
    page,
    "document.querySelector('[data-pickup-status=DRAFT]')",
    "保存后应出现待确认接送授权。",
  );
  await clickParentControl(page, "[data-parent-pickup-action=activate]");
  await waitForExpression(
    page,
    "document.querySelector('[data-pickup-status=ACTIVE]')",
    "确认后应显示已生效授权。",
  );
  await clickParentControl(page, "[data-parent-pickup-action=credential]");
  await waitForExpression(
    page,
    "document.querySelector('[data-parent-pickup-credential]')",
    "授权有效时应临时显示现场凭证。",
  );
  assert.equal(
    await evaluate(
      page,
      "document.querySelector('[data-parent-pickup-credential] code').textContent.trim().length",
    ),
    43,
  );

  const cookies = await page.send("Network.getAllCookies");
  const session = cookies.cookies.find((cookie) => cookie.name === "student_care_local_session");
  assert.ok(session?.httpOnly);
  assert.equal(await evaluate(page, "document.cookie"), "");
  assert.equal(await evaluate(page, "localStorage.length + sessionStorage.length"), 0);
  assert.ok(
    api.requests.some((request) => request.path === "/parent/pickup" && request.method === "GET"),
  );
  assert.ok(
    api.requests.some(
      (request) => request.path === "/parent/pickup/authorizations" && request.method === "POST",
    ),
  );
  assert.ok(
    api.requests.some((request) => request.path.endsWith("/activate") && request.method === "POST"),
  );
  assert.ok(
    api.requests.some(
      (request) => request.path.endsWith("/credential") && request.method === "POST",
    ),
  );
  assert.ok(
    api.requests.every((request) => request.authenticated || request.path === "/identity/login"),
  );

  await evaluate(
    page,
    "(() => { Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'}); document.dispatchEvent(new Event('visibilitychange')); })()",
  );
  await waitForExpression(
    page,
    "document.querySelector('[data-parent-pickup-state=IDLE]') && !document.querySelector('[data-parent-pickup-credential]')",
    "页面隐藏后必须清除凭证和接送明细。",
  );

  assert.deepEqual(pageErrors, []);
  assert.deepEqual(failedResponses, []);
  const externalRequests = browserRequests.filter((request) => {
    const url = new URL(request.url);
    return url.protocol !== "data:" && url.origin !== runtime.baseUrl;
  });
  assert.ok(
    externalRequests.length === 0,
    `浏览器不得发出外部请求：${JSON.stringify(externalRequests.map((request) => request.url))}`,
  );
  assert.ok(
    browserRequests
      .filter((request) => new URL(request.url).pathname.startsWith("/api-local/"))
      .every(
        (request) =>
          !Object.keys(request.headers).some((header) => header.toLowerCase() === "authorization"),
      ),
    "浏览器不得发送 bearer 凭证，代理只从 HttpOnly 邀请会话 Cookie 读取身份。",
  );
});
