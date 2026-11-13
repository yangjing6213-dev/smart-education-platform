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
  waitForExpression,
} from "./helpers/user-web-next-browser.mjs";
import { startLegacyBrowser as startNextBrowser } from "./helpers/child-monthly-web-browser.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const evidenceRoot = resolve(
  repositoryRoot,
  process.env.USER_WEB_E2E_ARTIFACT_ROOT ??
    "artifacts/task20-a1-351-child-monthly-web-20261026/screenshots",
);
const monthlyId = "00000000-0000-4000-8000-000000000136";
const childId = "00000000-0000-4000-8000-000000000137";
const relationshipId = "00000000-0000-4000-8000-000000000138";
const otherRelationshipId = "00000000-0000-4000-8000-000000000139";
const monthlyPath = `/parent/relationships/${relationshipId}/monthly-reports`;
const token = "s".repeat(43);

function reply(response, status, body) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(body));
}

async function createSyntheticApi() {
  const requests = [];
  const row = {
    id: monthlyId,
    publicationVersion: 1,
    relationshipVersion: 1,
    studentId: childId,
    studentLabel: "模拟数据孩子甲",
    month: "2026-10",
    supplements: {
      learningParticipation: "PROGRESSING",
      dailyHabits: "KEEP_WATCHING",
      activityParticipation: "PROGRESSING",
      familySchoolCollaboration: "FOLLOW_UP",
    },
    sourceCounts: { GROWTH_RECORD: 1, ATTENDANCE_OVERVIEW: 2 },
    acknowledged: false,
  };
  const server = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : undefined;
    const path = request.url ?? "/";
    const method = request.method ?? "GET";
    const authorization = request.headers.authorization;
    requests.push({ path, method, authorization, body });

    if (path === "/identity/login" && method === "POST") {
      if (body?.username !== "parent-monthly-demo" || body?.password !== "synthetic-only")
        return reply(response, 401, { error: { code: "INVALID_CREDENTIALS" } });
      return reply(response, 200, {
        data: {
          token_type: "Bearer",
          access_token: token,
          expires_at: "2099-01-01T00:00:00.000Z",
        },
      });
    }

    if (authorization !== `Bearer ${token}`)
      return reply(response, 401, { error: { code: "UNAUTHENTICATED" } });
    if (path === "/me" && method === "GET")
      return reply(response, 200, {
        data: {
          actor_id: "00000000-0000-4000-8000-000000000001",
          display_name: "示例监护人甲",
          memberships: [{ status: "ACTIVE", capabilities: ["binding:read"] }],
        },
      });
    if (path === "/guardian-relationships" && method === "GET")
      return reply(response, 200, {
        data: [
          {
            id: relationshipId,
            student_id: childId,
            relationship: "GUARDIAN",
            status: "ACTIVE",
            version: 1,
            source_application_id: "00000000-0000-4000-8000-000000000140",
            approved_at: "2026-10-01T00:00:00.000Z",
          },
          {
            id: otherRelationshipId,
            student_id: "00000000-0000-4000-8000-000000000141",
            relationship: "GUARDIAN",
            status: "ACTIVE",
            version: 2,
            source_application_id: "00000000-0000-4000-8000-000000000142",
            approved_at: "2026-10-01T00:00:00.000Z",
          },
        ],
      });
    if (path === monthlyPath && method === "GET")
      return reply(response, 200, { data: { records: [row] } });
    if (path === `/parent/relationships/${otherRelationshipId}/monthly-reports` && method === "GET")
      return reply(response, 200, { data: { records: [] } });
    if (path === `${monthlyPath}/${monthlyId}/ack` && method === "POST") {
      if (
        body?.publicationVersion !== row.publicationVersion ||
        body?.relationshipVersion !== row.relationshipVersion
      )
        return reply(response, 409, { error: { code: "STALE_VERSION" } });
      row.acknowledged = true;
      return reply(response, 200, { data: { acknowledged: true } });
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
    row,
    close: () =>
      new Promise((resolvePromise, reject) =>
        server.close((error) => (error ? reject(error) : resolvePromise())),
      ),
  };
}

test("invited parent opens the monthly summary and acknowledges a published row", async (t) => {
  await mkdir(evidenceRoot, { recursive: true });
  const api = await createSyntheticApi();
  const previousApi = process.env.USER_WEB_LOCAL_NEST_API;
  process.env.USER_WEB_LOCAL_NEST_API = api.url;
  t.after(async () => {
    if (previousApi === undefined) delete process.env.USER_WEB_LOCAL_NEST_API;
    else process.env.USER_WEB_LOCAL_NEST_API = previousApi;
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
    `${runtime.baseUrl}/web/login?next=${encodeURIComponent("/web/parent/monthly")}`,
    "document.querySelector('[data-invite-state]')?.dataset.inviteState==='IDLE'",
  );
  assert.deepEqual(
    failedResponses.map(({ url, status }) => ({ url, status })),
    [{ url: `${runtime.baseUrl}/api-local/me`, status: 401 }],
    "未登录时只允许一次读取当前会话的预期 401。",
  );
  failedResponses.length = 0;
  await evaluate(
    page,
    `(() => { const set=(selector,value)=>{const el=document.querySelector(selector);const setter=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el),'value').set;setter.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));};set('[name=username]','parent-monthly-demo');set('[name=password]','synthetic-only');})()`,
  );
  await clickParentControl(page, "[data-invite-submit]");
  try {
    await waitForExpression(
      page,
      "location.pathname === '/web/parent/monthly' && document.querySelector('[data-parent-monthly-state=READY]')",
      "邀请登录后应进入月度反馈页并读取已发布摘要。",
    );
  } catch (error) {
    const browserState = await evaluate(
      page,
      "({path:location.pathname,inviteState:document.querySelector('[data-invite-state]')?.getAttribute('data-invite-state'),monthlyState:document.querySelector('[data-parent-monthly-state]')?.getAttribute('data-parent-monthly-state'),text:document.body.innerText})",
    );
    const safeRequests = api.requests.map((request) => ({
      path: request.path,
      method: request.method,
      hasAuthorization: Boolean(request.authorization),
    }));
    throw new Error(
      `${error instanceof Error ? error.message : String(error)}\n${JSON.stringify({ browserState, safeRequests, pageErrors, failedResponses })}`,
    );
  }
  assert.ok(await evaluate(page, "document.body.innerText.includes('2026-10 月度反馈')"));
  assert.ok(await evaluate(page, "document.body.innerText.includes('已有进步')"));
  await evaluate(
    page,
    `(() => { const select = document.querySelector('select[name=studentId]'); select.value=${JSON.stringify(otherRelationshipId)}; select.dispatchEvent(new Event('change',{bubbles:true})); })()`,
  );
  await waitForExpression(
    page,
    "document.querySelector('[data-parent-monthly-state=READY]') && document.querySelectorAll('[data-parent-monthly-row]').length === 0",
    "切换孩子必须清除原孩子月报。",
  );
  await evaluate(
    page,
    `(() => { const select = document.querySelector('select[name=studentId]'); select.value=${JSON.stringify(relationshipId)}; select.dispatchEvent(new Event('change',{bubbles:true})); })()`,
  );
  await waitForExpression(
    page,
    "document.querySelector('[data-parent-monthly-state=READY]') && document.querySelectorAll('[data-parent-monthly-row]').length === 1",
    "切回孩子应读取当前关系的月报。",
  );

  await clickParentControl(page, "[data-parent-monthly-action='ack']");
  await waitForExpression(
    page,
    `document.querySelector('[data-parent-monthly-row][data-acknowledged="true"]') !== null`,
    "确认知悉后，页面应显示该已发布摘要已确认。",
  );
  assert.equal(api.row.acknowledged, true);
  assert.equal(
    api.requests.find((request) => request.path === "/identity/login")?.authorization,
    undefined,
  );
  assert.ok(
    api.requests
      .filter((request) => request.path !== "/identity/login")
      .every((request) => request.authorization === `Bearer ${token}`),
    "服务端代理后的受保护请求应使用当前邀请会话。",
  );
  const acknowledgement = api.requests.find(
    (request) => request.path === `${monthlyPath}/${monthlyId}/ack`,
  );
  assert.equal(acknowledgement?.method, "POST");
  assert.deepEqual(acknowledgement?.body, { publicationVersion: 1, relationshipVersion: 1 });

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
      `月度反馈页在 ${width}px 不得横向溢出。`,
    );
    if (width === 1365) await capture(page, join(evidenceRoot, "parent-monthly-desktop.png"), true);
  }

  const cookies = await page.send("Network.getAllCookies");
  const session = cookies.cookies.find((cookie) => cookie.name === "student_care_local_session");
  assert.ok(session?.httpOnly);
  assert.equal(await evaluate(page, "document.cookie"), "");
  assert.equal(await evaluate(page, "localStorage.length + sessionStorage.length"), 0);
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(failedResponses, []);
  assert.ok(browserRequests.every((request) => new URL(request.url).origin === runtime.baseUrl));
  assert.ok(
    browserRequests
      .filter((request) => new URL(request.url).pathname.startsWith("/api-local/"))
      .every(
        (request) =>
          !Object.keys(request.headers).some((header) => header.toLowerCase() === "authorization"),
      ),
    "浏览器只使用同源 Cookie，不能持有或发送 Bearer 凭证。",
  );
  assert.ok(!JSON.stringify(browserRequests).includes(token));
});
