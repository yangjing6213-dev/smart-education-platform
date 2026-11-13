import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { mkdir } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
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
  "artifacts/task20-a1-140-staff-care-invite-identity-20261019/browser",
);
const actorId = "00000000-0000-4000-8000-000000000142";
const studentId = "00000000-0000-4000-8000-000000000143";
const recordId = "00000000-0000-4000-8000-000000000144";
const token = "a".repeat(43);

function reply(response, status, body) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(body));
}

async function createSyntheticApi() {
  const requests = [];
  const student = {
    id: studentId,
    student_display_ref: "A1.140 模拟学生甲",
    class_ref: "模拟一班",
  };
  const values = {
    arrival: "ARRIVED_AS_PLANNED",
    homework: "COMPLETED",
    meal: "FINISHED",
    rest: "RESTED",
    activity: "PARTICIPATED",
    wellbeing: "ROUTINE",
  };
  let careRecord;
  const server = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : undefined;
    const path = request.url ?? "/";
    const method = request.method ?? "GET";
    const authorization = request.headers.authorization;
    requests.push({ path, method, authorization, body });

    if (path === "/identity/login" && method === "POST") {
      if (body?.username !== "staff-care-demo" || body?.password !== "synthetic-only")
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
          actor_id: actorId,
          display_name: "A1.140 模拟受邀员工",
          memberships: [{ status: "ACTIVE", capabilities: ["task:read", "care:write"] }],
        },
      });
    if (path === "/staff/tasks" && method === "GET")
      return reply(response, 200, {
        data: { actor_id: actorId, capabilities: ["task:read"], tasks: [] },
      });
    if (path === "/staff/care-record-students" && method === "GET")
      return reply(response, 200, { data: [student] });
    if (path === "/staff/care-records" && method === "GET")
      return reply(response, 200, { data: careRecord ? [careRecord] : [] });
    if (path === "/staff/care-records" && method === "POST") {
      if (
        Object.keys(body ?? {}).sort().join(",") !== "service_date,student_id,values" ||
        body.student_id !== studentId
      )
        return reply(response, 400, { error: { code: "VALIDATION_FAILED" } });
      careRecord = {
        id: recordId,
        student_id: studentId,
        student_display_ref: student.student_display_ref,
        class_ref: student.class_ref,
        service_date: body.service_date,
        values: body.values,
        status: "DRAFT",
        version: 1,
        published: false,
        publication_version: 1,
        updated_at: "2026-10-19T08:00:00.000Z",
        actions: ["edit", "submit"],
      };
      return reply(response, 201, { data: careRecord });
    }
    if (path === `/staff/care-records/${recordId}/submit` && method === "POST") {
      if (Object.keys(body ?? {}).sort().join(",") !== "version" || body.version !== 1)
        return reply(response, 400, { error: { code: "VALIDATION_FAILED" } });
      careRecord = {
        ...careRecord,
        status: "SUBMITTED",
        version: 2,
        actions: [],
      };
      return reply(response, 200, { data: careRecord });
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

test("invited employee opens growth records, saves a draft, and submits it for review", async (t) => {
  await mkdir(evidenceRoot, { recursive: true });
  const api = await createSyntheticApi();
  const previousApi = process.env.USER_WEB_LOCAL_NEST_API;
  const previousDist = process.env.TASK20_NEXT_DIST_DIR;
  process.env.USER_WEB_LOCAL_NEST_API = api.url;
  process.env.TASK20_NEXT_DIST_DIR = ".next-task20-a1-140";
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
    `${runtime.baseUrl}/web/login?next=${encodeURIComponent("/web/staff/workbench")}`,
    "document.querySelector('[data-invite-state]')?.dataset.inviteState==='IDLE'",
  );
  assert.deepEqual(
    failedResponses.map(({ url, status }) => ({ url, status })),
    [{ url: `${runtime.baseUrl}/api-local/me`, status: 401 }],
    "登录前只允许一次读取当前会话的预期 401。",
  );
  failedResponses.length = 0;
  await evaluate(
    page,
    `(() => { const set=(selector,value)=>{const el=document.querySelector(selector);const setter=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el),'value').set;setter.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));};set('[name=username]','staff-care-demo');set('[name=password]','synthetic-only');})()`,
  );
  await clickParentControl(page, "[data-invite-submit]");
  await waitForExpression(
    page,
    "location.pathname === '/web/staff/workbench' && document.querySelector('[data-staff-workbench-state=READY]') && document.querySelector('[data-staff-care-entry]')",
    "受邀员工登录后，只有具备 care:write 的账号才会看到成长记录入口。",
  );
  await clickParentControl(page, "[data-staff-care-entry]");
  await waitForExpression(
    page,
    "location.pathname === '/web/staff/care' && document.querySelector('[data-staff-care-state=READY]')",
    "工作台入口应打开受邀员工可访问的成长记录页。",
  );
  assert.ok(await evaluate(page, "document.querySelector('h1')?.textContent === '成长记录填写'"));
  assert.ok(await evaluate(page, "document.body.innerText.includes('A1.140 模拟学生甲')"));
  assert.equal(await evaluate(page, "document.body.innerText.includes('teacher-east')"), false);

  await clickParentControl(page, '[data-staff-care-action="save-draft"]');
  await waitForExpression(
    page,
    "document.querySelector('[data-staff-care-record][data-care-status=DRAFT]')",
    "员工应能保存一条合成成长记录草稿。",
  );
  await clickParentControl(page, '[data-staff-care-action="submit"]');
  await waitForExpression(
    page,
    "document.querySelector('[data-staff-care-record][data-care-status=SUBMITTED]')",
    "员工应能把草稿提交给负责人审核。",
  );
  assert.ok(await evaluate(page, "document.body.innerText.includes('待负责人审核')"));

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
      `成长记录页在 ${width}px 不得横向溢出。`,
    );
    if (width === 1365) await capture(page, join(evidenceRoot, "staff-care-invite-desktop.png"), true);
  }

  const cookies = await page.send("Network.getAllCookies");
  const session = cookies.cookies.find((cookie) => cookie.name === "student_care_local_session");
  assert.ok(session?.httpOnly);
  assert.equal(await evaluate(page, "document.cookie"), "");
  assert.equal(await evaluate(page, "localStorage.length + sessionStorage.length"), 0);
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(failedResponses, []);
  const externalRequests = browserRequests.filter((request) => {
    const url = new URL(request.url);
    return (url.protocol === "http:" || url.protocol === "https:") && url.origin !== runtime.baseUrl;
  });
  assert.deepEqual(
    externalRequests.map((request) => request.url),
    [],
    "浏览器不应发出跨站请求。",
  );
  assert.ok(
    browserRequests.every(
      (request) =>
        !Object.keys(request.headers).some((header) => header.toLowerCase() === "authorization"),
    ),
    "浏览器只使用同源 Cookie，不能持有或发送 Bearer 凭证。",
  );
  assert.ok(!JSON.stringify(browserRequests).includes(token));
  assert.ok(
    api.requests
      .filter((request) => request.authorization !== undefined)
      .every((request) => request.authorization === `Bearer ${token}`),
    "受保护请求只在服务端代理后使用邀请会话。",
  );
  assert.deepEqual(
    api.requests
      .filter((request) => request.path === "/staff/care-records" && request.method === "POST")
      .map((request) => Object.keys(request.body ?? {}).sort()),
    [["service_date", "student_id", "values"]],
    "写入数据不能包含前端指定的校区或租户。",
  );
  assert.ok(api.requests.some((request) => request.path === "/staff/care-records/" + recordId + "/submit"));
});
