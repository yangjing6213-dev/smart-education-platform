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
    "artifacts/task20-a1-138-parent-fees-invite-destination-20261019/browser",
);
const feeId = "fee-item-a138";
const studentId = "00000000-0000-4000-8000-000000000138";
const token = "f".repeat(43);

function reply(response, status, body) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(body));
}

async function createSyntheticApi() {
  const requests = [];
  let feeStatus = 200;
  let bindingStatus = "APPROVED";
  const fees = {
    bindingApplications: [
      {
        id: "00000000-0000-4000-8000-000000000138",
        relationship: "GUARDIAN",
        studentAlias: "student-alpha",
        studentLabel: "示例学生甲",
        status: "APPROVED",
      },
    ],
    documents: [
      {
        id: feeId,
        version: 1,
        studentId,
        studentAlias: "student-alpha",
        studentLabel: "示例学生甲",
        documentType: "BILL",
        title: "A1.138 本机合成费用单",
        period: "2026年10月",
        amount: 680,
        currency: "CNY",
        status: "AVAILABLE",
        sourceVersion: 1,
        validFrom: "2026-10-01",
        validTo: "2026-10-31",
        available: true,
        summary: "仅用于本机流程验证的虚构费用资料。",
        synthetic: true,
      },
    ],
    ledger: {
      scope: "parent",
      synthetic: true,
      entries: [
        {
          id: "ledger-a138-charge",
          type: "CHARGE",
          amountMinor: 68000,
          currency: "CNY",
          period: "2026-10",
          occurredOn: "2026-10-01",
          documentId: feeId,
          documentVersion: 1,
          studentAlias: "student-alpha",
          studentLabel: "示例学生甲",
          synthetic: true,
        },
      ],
      reconciliation: {
        chargeMinor: 68000,
        paymentMinor: 0,
        refundMinor: 0,
        balanceDueMinor: 68000,
        currency: "CNY",
      },
    },
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
      if (body?.username !== "parent-fees-demo" || body?.password !== "synthetic-only")
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
          actor_id: "00000000-0000-4000-8000-000000000138",
          display_name: "示例监护人甲",
          memberships: [{ status: "ACTIVE", capabilities: ["binding:read"] }],
        },
      });
    if (path === "/parent/fees" && method === "GET") {
      if (feeStatus !== 200) return reply(response, feeStatus, { error: { code: "PRIVATE" } });
      if (bindingStatus === "PENDING") {
        return reply(response, 200, {
          data: {
            bindingApplications: [{ ...fees.bindingApplications[0], status: bindingStatus }],
            documents: [],
            ledger: {
              ...fees.ledger,
              entries: [],
              reconciliation: {
                chargeMinor: 0, paymentMinor: 0, refundMinor: 0, balanceDueMinor: 0, currency: "CNY",
              },
            },
          },
        });
      }
      return reply(response, 200, { data: fees });
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
    setFees(status, binding = "APPROVED") {
      feeStatus = status;
      bindingStatus = binding;
    },
    close: () =>
      new Promise((resolvePromise, reject) =>
        server.close((error) => (error ? reject(error) : resolvePromise())),
      ),
  };
}

test("invited parent opens the fees page and reads only synthetic same-origin data", async (t) => {
  await mkdir(evidenceRoot, { recursive: true });
  const api = await createSyntheticApi();
  const previousApi = process.env.USER_WEB_LOCAL_NEST_API;
  const previousDist = process.env.TASK20_NEXT_DIST_DIR;
  process.env.USER_WEB_LOCAL_NEST_API = api.url;
  process.env.TASK20_NEXT_DIST_DIR ??= ".next-task20-a1-138";
  t.after(async () => {
    if (previousApi === undefined) delete process.env.USER_WEB_LOCAL_NEST_API;
    else process.env.USER_WEB_LOCAL_NEST_API = previousApi;
    if (previousDist === undefined) delete process.env.TASK20_NEXT_DIST_DIR;
    else process.env.TASK20_NEXT_DIST_DIR = previousDist;
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
    `${runtime.baseUrl}/web/login?next=${encodeURIComponent("/web/parent/fees")}`,
    "document.querySelector('[data-invite-state]')?.dataset.inviteState==='IDLE'",
  );
  assert.deepEqual(
    failedResponses.map(({ url, status }) => ({ url, status })),
    [{ url: `${runtime.baseUrl}/api-local/me`, status: 401 }],
    "登录前只允许一次读取当前会话的预期 401。",
  );
  failedResponses.length = 0;
  async function loginAndReturn() {
    await evaluate(
      page,
      `(() => { const set=(selector,value)=>{const el=document.querySelector(selector);const setter=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el),'value').set;setter.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));};set('[name=username]','parent-fees-demo');set('[name=password]','synthetic-only');})()`,
    );
    await clickParentControl(page, "[data-invite-submit]");
    await waitForExpression(
      page,
      "location.pathname === '/web/parent/fees' && document.querySelector('[data-parent-fees-state=READY]')",
      "邀请登录后应进入费用资料页并读取合成资料。",
    );
  }
  await loginAndReturn();
  assert.ok(await evaluate(page, "document.querySelector('h1')?.textContent === '费用资料'"));
  assert.ok(await evaluate(page, `document.body.innerText.includes('A1.138 本机合成费用单')`));
  assert.ok(await evaluate(page, `document.body.innerText.includes('¥680.00')`));

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
      `费用资料页在 ${width}px 不得横向溢出。`,
    );
    if (width === 1365) await capture(page, join(evidenceRoot, "parent-fees-desktop.png"), true);
  }

  const cookies = await page.send("Network.getAllCookies");
  const session = cookies.cookies.find((cookie) => cookie.name === "student_care_local_session");
  assert.ok(session?.httpOnly);
  assert.equal(await evaluate(page, "document.cookie"), "");
  assert.equal(await evaluate(page, "localStorage.length + sessionStorage.length"), 0);
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(failedResponses, []);
  async function refresh(status, state, binding) {
    api.setFees(status, binding);
    await clickParentControl(page, "[data-parent-fees-refresh]");
    await waitForExpression(page, `document.querySelector('[data-parent-fees-state=${state}]')`, state);
  }
  async function assertHidden() {
    assert.equal(await evaluate(page, "document.querySelectorAll('[data-parent-fee-document],[data-parent-fee-ledger]').length"), 0);
    assert.doesNotMatch(await evaluate(page, "document.body.innerText"), /A1\.138 本机合成费用单|¥680\.00|PRIVATE/u);
  }
  const scopedLink = (path) => `[data-testid="parent-fees-panel"] a[href^="${path}"]`;
  await refresh(403, "DENIED");
  await assertHidden();
  assert.equal(await evaluate(page, `document.querySelector(${JSON.stringify(scopedLink("/web/login"))})`), null);
  assert.doesNotMatch(await evaluate(page, "document.querySelector('[data-testid=parent-fees-panel]').innerText"), /登录/u);
  await refresh(200, "READY", "PENDING");
  await assertHidden();
  assert.ok(await evaluate(page, `!!document.querySelector(${JSON.stringify(scopedLink("/web/parent/binding"))})`));
  await refresh(503, "ERROR");
  await assertHidden();
  assert.equal(await evaluate(page, "document.querySelector('[data-parent-fees-refresh]').textContent.trim()"), "重新连接");
  await refresh(200, "READY");
  assert.ok(await evaluate(page, "document.body.innerText.includes('¥680.00')"));
  await refresh(401, "SIGNED_OUT");
  await assertHidden();
  const expiredLogin = scopedLink("/web/login");
  api.setFees(200);
  await clickParentControl(page, expiredLogin);
  await waitForExpression(page, "location.pathname === '/web/login' && new URLSearchParams(location.search).get('next') === '/web/parent/fees' && document.querySelector('[data-invite-state=IDLE]')", "费用页重新登录入口须保留返回目的地");
  await loginAndReturn();
  assert.ok(await evaluate(page, "document.body.innerText.includes('¥680.00')"));
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(failedResponses, [
    { url: `${runtime.baseUrl}/api-local/parent/fees`, status: 403 },
    { url: `${runtime.baseUrl}/api-local/parent/fees`, status: 503 },
    { url: `${runtime.baseUrl}/api-local/parent/fees`, status: 401 },
    { url: `${runtime.baseUrl}/api-local/me`, status: 401 },
  ]);
  assert.ok(browserRequests.every((request) => new URL(request.url).origin === runtime.baseUrl));
  assert.ok(
    browserRequests.every(
      (request) =>
        !Object.keys(request.headers).some((header) => header.toLowerCase() === "authorization"),
    ),
    "浏览器只使用同源 Cookie，不能持有或发送 Bearer 凭证。",
  );
  assert.ok(!JSON.stringify(browserRequests).includes(token));
  assert.equal(api.requests.find((request) => request.path === "/identity/login")?.authorization, undefined);
  assert.ok(
    api.requests
      .filter((request) => request.path !== "/identity/login")
      .every((request) => request.authorization === `Bearer ${token}`),
    "受保护请求只在服务端代理后使用邀请会话。",
  );
  assert.ok(api.requests.some((request) => request.path === "/parent/fees" && request.method === "GET"));
});
