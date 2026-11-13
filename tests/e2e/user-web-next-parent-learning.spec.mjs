import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { mkdir } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, join, resolve } from "node:path";
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
    "artifacts/task20-a1-125-user-web-parent-learning-invite-session-20261019/browser",
);
const studentId = "00000000-0000-4000-8000-0000000000c8";

function reply(response, status, body) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(body));
}

async function createSyntheticApi() {
  const requests = [];
  const control = {
    studentId,
    studentLabel: "示例学生甲",
    enabled: true,
    maxDurationMinutes: 15,
    maxHintLevel: 3,
    contactStatus: "NOT_REQUESTED",
  };
  const data = () => ({
    approvedStudents: [
      { studentId, studentLabel: "示例学生甲", classLabel: "示例三年级甲班" },
    ],
    parentControls: [{ ...control }],
    parentSummary: [
      {
        studentId,
        studentLabel: "示例学生甲",
        usedMinutes: 12,
        sessionCount: 3,
        completedSessions: 2,
        knowledgePoints: [
          { label: "两位数加法与进位", sessionCount: 3, completedSessions: 2 },
        ],
        attentionCount: 0,
      },
    ],
    parentSummaryUpdatedAt: "2026-10-19T00:00:00.000Z",
  });
  const server = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : undefined;
    const path = request.url ?? "/";
    const method = request.method ?? "GET";
    const authorization = request.headers.authorization;
    requests.push({ path, method, authorization, body });
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
    if (authorization !== `Bearer ${"p".repeat(43)}`)
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
    if (path === "/parent/learning" && method === "GET")
      return reply(response, 200, { data: data() });
    if (path === `/parent/learning/${studentId}/controls` && method === "POST") {
      Object.assign(control, body);
      return reply(response, 200, { data: { ...control } });
    }
    if (path === `/parent/learning/${studentId}/contact` && method === "POST") {
      control.contactStatus = "RECORDED_LOCAL";
      return reply(response, 201, {
        data: {
          id: "00000000-0000-4000-8000-0000000000c9",
          studentId,
          studentLabel: "示例学生甲",
          status: "RECORDED_LOCAL",
          createdAt: "2026-10-19T00:01:00.000Z",
        },
      });
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
    control,
    close: () =>
      new Promise((resolvePromise, reject) =>
        server.close((error) => (error ? reject(error) : resolvePromise())),
      ),
  };
}

test("invited parent opens the scoped learning summary and saves local supervision settings", async (t) => {
  await mkdir(evidenceRoot, { recursive: true });
  const api = await createSyntheticApi();
  const previousApi = process.env.USER_WEB_LOCAL_NEST_API;
  const previousDist = process.env.TASK20_NEXT_DIST_DIR;
  const previousArtifacts = process.env.USER_WEB_E2E_ARTIFACT_ROOT;
  process.env.USER_WEB_LOCAL_NEST_API = api.url;
  process.env.TASK20_NEXT_DIST_DIR ??= ".next-task20-a1-125";
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
    `${runtime.baseUrl}/web/login?next=${encodeURIComponent("/web/parent/learning")}`,
    "document.querySelector('[data-invite-state]')?.dataset.inviteState==='IDLE'",
  );
  assert.deepEqual(
    failedResponses.map(({ url, status }) => ({ url, status })),
    [{ url: `${runtime.baseUrl}/api-local/me`, status: 401 }],
    "未登录时仅允许一次读取当前会话的 401 响应。",
  );
  failedResponses.length = 0;
  await evaluate(
    page,
    `(() => { const set=(selector,value)=>{const el=document.querySelector(selector);const setter=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el),'value').set;setter.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));};set('[name=username]','parent-demo');set('[name=password]','local-only-password');})()`,
  );
  await clickParentControl(page, "[data-invite-submit]");
  try {
    await waitForExpression(
      page,
      "location.pathname === '/web/parent/learning' && document.querySelector('[data-parent-learning-state=READY]')",
      "邀请登录后应进入家长学习摘要，并使用当前账号读取已审核关系。",
    );
  } catch (error) {
    const browserState = await evaluate(
      page,
      "({href:location.href,inviteState:document.querySelector('[data-invite-state]')?.getAttribute('data-invite-state'),learningState:document.querySelector('[data-parent-learning-state]')?.getAttribute('data-parent-learning-state'),text:document.body.innerText})",
    );
    const safeApiRequests = api.requests.map((request) => ({
      path: request.path,
      method: request.method,
      hasAuthorization: Boolean(request.authorization),
    }));
    throw new Error(
      `${error instanceof Error ? error.message : String(error)}\n${JSON.stringify({ browserState, safeApiRequests, pageErrors, failedResponses })}`,
    );
  }
  assert.ok(await evaluate(page, "document.body.innerText.includes('示例学生甲')"));
  assert.ok(await evaluate(page, "document.body.innerText.includes('两位数加法与进位')"));

  await evaluate(
    page,
    `(() => { const duration=document.querySelector('select[name="maxDurationMinutes"]'); const setter=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set; setter.call(duration,'10'); duration.dispatchEvent(new Event('change',{bubbles:true})); })()`,
  );
  await clickParentControl(page, "[data-parent-controls-form] button[type=submit]");
  await waitForExpression(
    page,
    "document.querySelector('[data-parent-status]')?.textContent.includes('已保存')",
    "家长可以保存陪伴学习时长设置。",
  );
  assert.equal(api.control.maxDurationMinutes, 10);
  await clickParentControl(page, "[data-parent-contact]");
  await waitForExpression(
    page,
    "document.querySelector('[data-parent-contact]')?.textContent.includes('已记录联系意向')",
    "联系教师操作只记录本机意向，不发送外部消息。",
  );

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
      `学习摘要页在 ${width}px 不得横向溢出。`,
    );
    if (width === 1365)
      await capture(page, join(evidenceRoot, "parent-learning-desktop.png"), true);
  }

  const cookies = await page.send("Network.getAllCookies");
  const session = cookies.cookies.find((cookie) => cookie.name === "student_care_local_session");
  assert.ok(session?.httpOnly);
  assert.equal(await evaluate(page, "document.cookie"), "");
  assert.equal(await evaluate(page, "localStorage.length + sessionStorage.length"), 0);
  assert.ok(api.requests.some((request) => request.path === "/parent/learning" && request.method === "GET"));
  assert.ok(api.requests.some((request) => request.path.endsWith("/controls") && request.method === "POST"));
  assert.ok(api.requests.some((request) => request.path.endsWith("/contact") && request.method === "POST"));
  assert.equal(
    api.requests.find((request) => request.path === "/identity/login")?.authorization,
    undefined,
    "登录请求不能携带尚未建立的 Bearer 凭证。",
  );
  assert.ok(
    api.requests
      .filter((request) => request.path !== "/identity/login")
      .every((request) => request.authorization?.startsWith("Bearer ")),
    "登录后的受保护请求必须使用当前邀请会话凭证。",
  );
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(failedResponses, []);
  assert.ok(
    browserRequests.every((request) => new URL(request.url).origin === runtime.baseUrl),
    "浏览器不得发出外部请求。",
  );
  assert.ok(
    browserRequests
      .filter((request) => new URL(request.url).pathname.startsWith("/api-local/"))
      .every((request) => !Object.keys(request.headers).some((header) => header.toLowerCase() === "authorization")),
    "Bearer 凭证不能从浏览器发送到同源代理。",
  );
});
