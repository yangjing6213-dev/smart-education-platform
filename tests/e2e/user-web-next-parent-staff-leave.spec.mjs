import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
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
const artifactsRoot = resolve(
  repositoryRoot,
  process.env.USER_WEB_E2E_ARTIFACT_ROOT ??
    "artifacts/task20-a1-90-web-invite-leave-api-20261018/browser",
);
const artifactsRelative = relative(resolve(repositoryRoot, "artifacts"), artifactsRoot);
assert.ok(
  artifactsRelative && !artifactsRelative.startsWith("..") && !isAbsolute(artifactsRelative),
  "回归工件只能写入当前隔离树的 artifacts 子目录。",
);

const studentId = "00000000-0000-4000-8000-000000000201";
const relationshipId = "00000000-0000-4000-8000-000000000101";
const requestIds = ["00000000-0000-4000-8000-000000000301", "00000000-0000-4000-8000-000000000302"];
const accounts = new Map([
  [
    "synthetic-parent",
    {
      token: "h".repeat(43),
      actorId: "00000000-0000-4000-8000-000000000401",
      name: "合成家长",
      capabilities: ["binding:read", "leave:apply", "leave:read"],
    },
  ],
  [
    "synthetic-staff",
    {
      token: "s".repeat(43),
      actorId: "00000000-0000-4000-8000-000000000402",
      name: "合成员工",
      capabilities: ["leave:review"],
    },
  ],
]);
const parentSelector = "[data-leave-role='parent']";
const staffSelector = "[data-leave-role='staff']";
const rowSelector = "[data-leave-record]";
const reasonLabels = { FAMILY_ARRANGEMENT: "家庭安排", TEMPORARY_MATTER: "临时事务" };
const query = (selector) => `document.querySelector(${JSON.stringify(selector)})`;

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  if (chunks.length === 0) return undefined;
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function reply(response, status, body) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(body));
}

function projection(row, role) {
  return {
    id: row.id,
    student_id: row.student_id,
    student_display_ref: "模拟学生A",
    ...(role === "staff" ? { class_ref: "模拟班级一" } : {}),
    start_date: row.start_date,
    end_date: row.end_date,
    reason_category: row.reason_category,
    status: row.status,
    version: row.version,
    acknowledged: row.acknowledged,
    actions: row.status === "SUBMITTED" ? ["confirm", "return"] : [],
    updated_at: row.updated_at,
  };
}

async function createSyntheticNestApi() {
  const rows = [];
  const requests = [];
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      const body = await readBody(request);
      const token = request.headers.authorization?.replace(/^Bearer\s+/u, "");
      const accountEntry = [...accounts.entries()].find(([, account]) => account.token === token);
      const role =
        accountEntry?.[0] === "synthetic-parent" ? "parent" : accountEntry ? "staff" : null;
      const account = accountEntry?.[1];
      requests.push({
        method: request.method,
        path: url.pathname,
        role,
        hasAuthorization: Boolean(token),
      });

      if (request.method === "POST" && url.pathname === "/identity/login") {
        const found = typeof body?.username === "string" ? accounts.get(body.username) : undefined;
        if (!found || body.password !== "local-only-password")
          return reply(response, 401, { error: { code: "INVALID_CREDENTIALS" } });
        return reply(response, 200, {
          data: {
            access_token: found.token,
            token_type: "Bearer",
            expires_at: "2035-01-01T00:00:00.000Z",
          },
        });
      }
      if (request.method === "POST" && url.pathname === "/identity/logout")
        return reply(response, 200, { data: { logged_out: true } });
      if (!account) return reply(response, 401, { error: { code: "UNAUTHENTICATED" } });
      if (request.method === "GET" && url.pathname === "/me")
        return reply(response, 200, {
          data: {
            actor_id: account.actorId,
            display_name: account.name,
            memberships: [{ status: "ACTIVE", capabilities: account.capabilities }],
          },
        });

      if (request.method === "GET" && url.pathname === "/guardian-relationships") {
        if (role !== "parent") return reply(response, 403, { error: { code: "FORBIDDEN_SCOPE" } });
        return reply(response, 200, {
          data: [
            {
              id: relationshipId,
              student_id: studentId,
              relationship: "GUARDIAN",
              status: "ACTIVE",
              source_application_id: "00000000-0000-4000-8000-000000000501",
              version: 2,
              approved_at: "2026-10-18T00:00:00.000Z",
            },
          ],
        });
      }

      if (request.method === "GET" && url.pathname === "/parent/leave-requests") {
        if (role !== "parent") return reply(response, 403, { error: { code: "FORBIDDEN_SCOPE" } });
        return reply(response, 200, {
          data: rows
            .filter((row) => row.student_id === studentId)
            .map((row) => projection(row, "parent")),
        });
      }
      if (request.method === "GET" && url.pathname === "/staff/leave-requests") {
        if (role !== "staff") return reply(response, 403, { error: { code: "FORBIDDEN_SCOPE" } });
        return reply(response, 200, { data: rows.map((row) => projection(row, "staff")) });
      }

      if (request.method === "POST" && url.pathname === "/parent/leave-requests") {
        if (
          role !== "parent" ||
          body?.student_id !== studentId ||
          !/^202[6-9]-\d{2}-\d{2}$/u.test(body?.start_date ?? "") ||
          !/^202[6-9]-\d{2}-\d{2}$/u.test(body?.end_date ?? "") ||
          !["FAMILY_ARRANGEMENT", "TEMPORARY_MATTER"].includes(body?.reason_category)
        )
          return reply(response, 403, { error: { code: "FORBIDDEN_SCOPE" } });
        if (rows.length >= requestIds.length)
          return reply(response, 409, { error: { code: "CONFLICT" } });
        const row = {
          id: requestIds[rows.length],
          student_id: studentId,
          start_date: body.start_date,
          end_date: body.end_date,
          reason_category: body.reason_category,
          status: "SUBMITTED",
          version: 1,
          acknowledged: false,
          updated_at: "2026-10-18T00:00:00.000Z",
        };
        rows.push(row);
        return reply(response, 201, { data: projection(row, "parent") });
      }

      const parentAction = url.pathname.match(
        /^\/parent\/leave-requests\/([^/]+)\/(resubmit|withdraw|acknowledge)$/u,
      );
      if (request.method === "POST" && parentAction && role === "parent") {
        const row = rows.find((item) => item.id === parentAction[1]);
        if (!row || body?.version !== row.version)
          return reply(response, 409, { error: { code: "STATE_CHANGED" } });
        if (parentAction[2] === "resubmit" && row.status === "RETURNED") {
          row.start_date = body.start_date;
          row.end_date = body.end_date;
          row.reason_category = body.reason_category;
          row.status = "SUBMITTED";
          row.acknowledged = false;
        } else if (
          parentAction[2] === "withdraw" &&
          ["SUBMITTED", "RETURNED"].includes(row.status)
        ) {
          row.status = "WITHDRAWN";
        } else if (
          parentAction[2] === "acknowledge" &&
          ["RETURNED", "CONFIRMED"].includes(row.status) &&
          !row.acknowledged
        ) {
          row.acknowledged = true;
        } else return reply(response, 409, { error: { code: "STATE_CHANGED" } });
        row.version += 1;
        return reply(response, 200, { data: projection(row, "parent") });
      }

      const review = url.pathname.match(/^\/staff\/leave-requests\/([^/]+)\/review$/u);
      if (request.method === "POST" && review && role === "staff") {
        const row = rows.find((item) => item.id === review[1]);
        if (
          !row ||
          row.status !== "SUBMITTED" ||
          body?.version !== row.version ||
          !["confirm", "return"].includes(body?.action)
        )
          return reply(response, 409, { error: { code: "STATE_CHANGED" } });
        row.status = body.action === "confirm" ? "CONFIRMED" : "RETURNED";
        row.version += 1;
        return reply(response, 200, { data: projection(row, "staff") });
      }
      return reply(response, 404, { error: { code: "NOT_FOUND" } });
    } catch {
      return reply(response, 400, { error: { code: "INVALID_REQUEST" } });
    }
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
    rows,
    close: () =>
      new Promise((resolvePromise, reject) =>
        server.close((error) => (error ? reject(error) : resolvePromise())),
      ),
  };
}

async function setValue(page, selector, value) {
  const result = await evaluate(
    page,
    `(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    if (!element) return false;
    const prototype = element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    if (!setter) return false;
    setter.call(element, ${JSON.stringify(value)});
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`,
  );
  assert.equal(result, true, `页面字段必须存在：${selector}`);
}

async function click(page, selector) {
  await clickParentControl(page, selector);
}

async function waitReady(page, role, status = "READY") {
  await waitForExpression(
    page,
    `document.querySelector('[data-leave-role="${role}"]')?.dataset.leaveState==='${status}'`,
    `${role === "parent" ? "家长" : "员工"}请假页应进入 ${status} 状态。`,
  );
}

async function login(page, role, name) {
  const selector = role === "parent" ? parentSelector : staffSelector;
  await waitForExpression(
    page,
    `location.pathname === ${JSON.stringify(`/web/${role}/leave`)} &&
      document.querySelector(${JSON.stringify(selector)})?.dataset.leaveState === 'IDLE' &&
      document.querySelector(${JSON.stringify(`${selector} [role=status]`)})?.textContent?.trim() === '请先使用受邀账号登录。' &&
      Boolean(document.querySelector(${JSON.stringify(`${selector} [data-leave-login-link]`)}))`,
    `${role}请假页应完成会话恢复后显示对应登录入口。`,
  );
  await click(page, `${selector} [data-leave-login-link]`);
  await waitForExpression(
    page,
    "document.querySelector('[data-invite-state]')?.dataset.inviteState==='IDLE'",
    "统一登录入口应可输入账号。",
  );
  await setValue(page, "[data-invite-login] input[name='username']", name);
  await setValue(page, "[data-invite-login] input[name='password']", "local-only-password");
  await click(page, "[data-invite-submit]");
  await waitReady(page, role);
}

async function logout(page, role) {
  const selector = role === "parent" ? parentSelector : staffSelector;
  await click(page, `${selector} [data-leave-logout]`);
  await waitForExpression(
    page,
    `Boolean(document.querySelector(${JSON.stringify(`${selector} [data-leave-login-link]`)}))`,
    "退出后应回到登录页面。",
  );
}

async function assertNoInternalIds(page, role) {
  const rows = await evaluate(
    page,
    `Array.from(document.querySelectorAll('[data-leave-role="${role}"] ${rowSelector}')).map((row) => ({html:row.outerHTML,text:row.innerText,status:row.dataset.leaveStatus}))`,
  );
  for (const row of rows) {
    assert.doesNotMatch(
      row.html,
      /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/iu,
    );
    assert.doesNotMatch(row.html, /data-(?:record-id|version|student-id|binding-id)/iu);
    assert.ok(!row.html.includes(studentId) && !row.html.includes(relationshipId));
  }
  return rows;
}

async function checkWidths(page, role) {
  for (const width of [1365, 390, 320]) {
    await page.send("Emulation.setDeviceMetricsOverride", {
      width,
      height: width === 1365 ? 1000 : 900,
      deviceScaleFactor: 1,
      mobile: width !== 1365,
    });
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 120));
    assert.ok(
      await evaluate(
        page,
        "document.documentElement.scrollWidth<=innerWidth && document.body.scrollWidth<=innerWidth",
      ),
      `请假 ${role} 页面在 ${width}px 不得横向溢出。`,
    );
    if (width === 1365) await capture(page, join(artifactsRoot, `leave-${role}-desktop.png`), true);
  }
}

test("网页受邀家长与员工走通请假申请、审核、回执和撤回，并保护会话与页面资料", async (t) => {
  await mkdir(artifactsRoot, { recursive: true });
  const api = await createSyntheticNestApi();
  const previousTarget = process.env.USER_WEB_LOCAL_NEST_API;
  const previousPrimary = process.env.USER_WEB_NEST_API_BASE_URL;
  let inheritedUpstreamRequests = 0;
  const inheritedUpstream = createServer((_request, response) => {
    inheritedUpstreamRequests += 1;
    response.writeHead(503, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: { code: "TEST_UPSTREAM_MUST_NOT_BE_USED" } }));
  });
  await new Promise((resolvePromise, reject) => {
    inheritedUpstream.once("error", reject);
    inheritedUpstream.listen(0, "127.0.0.1", resolvePromise);
  });
  const inheritedAddress = inheritedUpstream.address();
  assert.ok(inheritedAddress && typeof inheritedAddress !== "string");
  process.env.USER_WEB_NEST_API_BASE_URL = `http://127.0.0.1:${inheritedAddress.port}`;
  process.env.USER_WEB_LOCAL_NEST_API = api.url;
  t.after(async () => {
    if (previousTarget === undefined) delete process.env.USER_WEB_LOCAL_NEST_API;
    else process.env.USER_WEB_LOCAL_NEST_API = previousTarget;
    if (previousPrimary === undefined) delete process.env.USER_WEB_NEST_API_BASE_URL;
    else process.env.USER_WEB_NEST_API_BASE_URL = previousPrimary;
    await new Promise((resolvePromise, reject) =>
      inheritedUpstream.close((error) => (error ? reject(error) : resolvePromise())),
    );
    await api.close();
  });
  const runtime = await startNextBrowser(t, { repositoryRoot, skipLegacyApi: true });
  if (previousTarget === undefined) delete process.env.USER_WEB_LOCAL_NEST_API;
  else process.env.USER_WEB_LOCAL_NEST_API = previousTarget;
  if (previousPrimary === undefined) delete process.env.USER_WEB_NEST_API_BASE_URL;
  else process.env.USER_WEB_NEST_API_BASE_URL = previousPrimary;
  const loginUrl = runtime.baseUrl + "/api-local/identity/login";
  const loginProbe = {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "synthetic-parent", password: "incorrect-test-password" }),
  };
  const missingOrigin = await fetch(loginUrl, loginProbe);
  assert.equal(missingOrigin.status, 403, "缺少来源的登录请求必须被拒绝。");
  assert.equal((await missingOrigin.json()).error.code, "ORIGIN_NOT_ALLOWED");
  const isolatedLogin = await fetch(loginUrl, {
    ...loginProbe,
    headers: { ...loginProbe.headers, origin: new URL(runtime.baseUrl).origin },
  });
  assert.equal(isolatedLogin.status, 401, "预置的其他服务地址不能覆盖测试自建邀请服务。");
  assert.equal(inheritedUpstreamRequests, 0, "不能请求继承的非测试服务。");

  const browserRequests = [];
  const pageErrors = [];
  let dialogs = 0;
  let page;
  page = await runtime.connectPage((method, params) => {
    if (method === "Network.requestWillBeSent") browserRequests.push(params.request.url);
    if (method === "Runtime.exceptionThrown")
      pageErrors.push(params.exceptionDetails?.text ?? "网页脚本错误");
    if (method === "Page.javascriptDialogOpening") {
      dialogs += 1;
      void page
        .send("Page.handleJavaScriptDialog", { accept: true })
        .catch((error) => pageErrors.push(error.message));
    }
  });
  await navigate(
    page,
    runtime.baseUrl + "/web/login?next=%2Fweb%2Fstaff%2Fleave",
    "document.querySelector('[data-invite-state]')?.dataset.inviteState==='IDLE'",
  );
  await navigate(
    page,
    runtime.baseUrl + "/web/parent/home",
    "document.querySelector('main h1')?.innerText==='家长首页'",
  );
  assert.equal(
    await evaluate(page, "document.querySelector('a[href=\"/web/staff/leave\"]')===null"),
    true,
    "家长首页不得把员工审核作为家长服务入口。",
  );
  await navigate(
    page,
    runtime.baseUrl + "/web/login?next=%2Fweb%2Fstaff%2Fleave",
    "document.querySelector('[data-invite-state]')?.dataset.inviteState==='IDLE'",
  );
  for (const width of [1365, 390, 320]) {
    await page.send("Emulation.setDeviceMetricsOverride", {
      width,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: width !== 1365,
    });
    assert.ok(
      await evaluate(
        page,
        "document.documentElement.scrollWidth<=innerWidth && document.body.scrollWidth<=innerWidth",
      ),
      `登录页在 ${width}px 不得横向溢出。`,
    );
    if (width === 1365) {
      const layout = await evaluate(
        page,
        `(() => {
        const heading = document.querySelector('#login-welcome');
        const headingFits = heading.getBoundingClientRect().height <= parseFloat(getComputedStyle(heading).lineHeight) * 2.1;
        const header = document.querySelector('.site-header-inner').getBoundingClientRect();
        const headerFits = Array.from(document.querySelectorAll('.site-header a,.site-header button')).every(element => {
          const rect = element.getBoundingClientRect();
          return !rect.width || !rect.height || (rect.left >= header.left - 0.5 && rect.right <= header.right + 0.5 && rect.right <= innerWidth);
        });
        return {headingFits, headerFits};
      })()`,
      );
      assert.deepEqual(
        layout,
        { headingFits: true, headerFits: true },
        "桌面标题应自然分为两行，导航操作应完整可见。",
      );
    }
    if (width !== 320) await capture(page, join(artifactsRoot, `login-${width}.png`), true);
  }
  await setValue(page, "[data-invite-login] input[name='username']", "synthetic-parent");
  await setValue(page, "[data-invite-login] input[name='password']", "incorrect-test-password");
  await click(page, "[data-invite-submit]");
  await waitForExpression(
    page,
    "document.querySelector('[data-invite-state]')?.dataset.inviteState==='DENIED'",
    "错误密码必须拒绝登录。",
  );
  assert.equal(
    await evaluate(page, "document.querySelector('input[name=password]').value"),
    "",
    "登录尝试后密码必须清空。",
  );
  await setValue(page, "[data-invite-login] input[name='password']", "local-only-password");
  await click(page, "[data-invite-submit]");
  await waitForExpression(
    page,
    "document.querySelector('[data-invite-state]')?.dataset.inviteState==='READY'",
    "家长账号不能跳入员工审核页。",
  );
  assert.deepEqual(
    await evaluate(
      page,
      "Array.from(document.querySelectorAll('[data-invite-service]')).map(link=>new URL(link.href).pathname)",
    ),
    [
      "/web/parent/learning",
      "/web/parent/monthly",
      "/web/parent/fees",
      "/web/parent/leave",
    ],
  );
  assert.equal(
    api.requests.filter((request) => request.path === "/staff/leave-requests").length,
    0,
    "未获员工权限前不能请求审核列表。",
  );
  await click(page, "[data-invite-service][href='/web/parent/leave']");
  await waitReady(page, "parent");
  assert.equal(
    await evaluate(
      page,
      "document.body.innerText.includes('机构邀请的家长账号') && !document.body.innerText.includes('固定示例家长')",
    ),
    true,
    "家长请假页说明必须与当前邀请账号身份一致。",
  );
  assert.equal(
    await evaluate(page, "document.querySelector('a[href=\"/web/staff/leave\"]')===null"),
    true,
    "家长请假页不得直接提供员工审核入口。",
  );
  const loginRequests = api.requests.filter((request) => request.path === "/identity/login").length;
  await navigate(
    page,
    runtime.baseUrl + "/web/parent/leave",
    "document.querySelector('[data-leave-role=parent]')?.dataset.leaveState==='READY'",
  );
  assert.equal(
    api.requests.filter((request) => request.path === "/identity/login").length,
    loginRequests,
    "刷新有效会话不得重复登录。",
  );
  await checkWidths(page, "parent");

  const cookies = await page.send("Network.getAllCookies");
  const sessionCookie = cookies.cookies.find(
    (cookie) => cookie.name === "student_care_local_session",
  );
  assert.ok(sessionCookie, "登录凭证应由网页服务保存为 Cookie。");
  assert.equal(sessionCookie.httpOnly, true);
  assert.equal(sessionCookie.sameSite, "Lax");
  assert.equal(await evaluate(page, "document.cookie"), "", "网页脚本不能读取登录凭证。");
  assert.deepEqual(
    await evaluate(page, "({local:localStorage.length,session:sessionStorage.length})"),
    { local: 0, session: 0 },
  );

  for (const [field, value] of Object.entries({
    bindingId: "0",
    startDate: "2026-10-20",
    endDate: "2026-10-21",
    reason: "FAMILY_ARRANGEMENT",
  }))
    await setValue(page, `[data-leave-form] [name='${field}']`, value);
  await click(page, "[data-leave-form] button[type='submit']");
  await waitForExpression(
    page,
    `${query(`${parentSelector} ${rowSelector}`)}?.dataset.leaveStatus==='SUBMITTED'`,
    "家长申请应进入待审核状态。",
  );
  assert.equal((await assertNoInternalIds(page, "parent")).length, 1);

  await logout(page, "parent");
  await navigate(
    page,
    runtime.baseUrl + "/web/staff/leave",
    "Boolean(document.querySelector('[data-leave-login-link]'))",
  );
  await login(page, "staff", "synthetic-staff");
  assert.equal(
    await evaluate(
      page,
      "document.body.innerText.includes('机构邀请的员工账号') && document.body.innerText.includes('授权校区') && !document.body.innerText.includes('固定示例教师')",
    ),
    true,
    "员工审核页说明必须与邀请身份和服务端校区权限一致。",
  );
  assert.equal(
    await evaluate(
      page,
      "Array.from(document.querySelectorAll('main a')).find(link=>link.innerText.trim()==='返回员工工作台')?.getAttribute('href')",
    ),
    "/web/staff/workbench",
    "员工审核页的返回入口应回到员工工作台。",
  );
  await checkWidths(page, "staff");
  await click(page, `${staffSelector} [data-leave-action='return']`);
  await waitForExpression(
    page,
    `${query(`${staffSelector} ${rowSelector}`)}?.dataset.leaveStatus==='RETURNED'`,
    "员工退回应进入待修改状态。",
  );
  assert.equal((await assertNoInternalIds(page, "staff")).length, 1);

  await logout(page, "staff");
  await navigate(
    page,
    runtime.baseUrl + "/web/parent/leave",
    "Boolean(document.querySelector('[data-leave-login-link]'))",
  );
  await login(page, "parent", "synthetic-parent");
  await click(page, `${parentSelector} [data-leave-action='acknowledge']`);
  await waitForExpression(
    page,
    `${query(`${parentSelector} ${rowSelector}`)}?.dataset.leaveAcknowledged==='true'`,
    "家长应能确认已收到退回结果。",
  );
  await click(page, `${parentSelector} [data-leave-action='edit']`);
  await setValue(page, "[data-leave-form] input[name='startDate']", "2026-10-22");
  await setValue(page, "[data-leave-form] input[name='endDate']", "2026-10-23");
  await click(page, "[data-leave-form] button[type='submit']");
  await waitForExpression(
    page,
    `${query(`${parentSelector} ${rowSelector}`)}?.dataset.leaveStatus==='SUBMITTED'&&${query(`${parentSelector} ${rowSelector}`)}?.dataset.leaveAcknowledged==='false'`,
    "修改后的申请应重新提交并清除旧回执。",
  );

  await logout(page, "parent");
  await navigate(
    page,
    runtime.baseUrl + "/web/staff/leave",
    "Boolean(document.querySelector('[data-leave-login-link]'))",
  );
  await login(page, "staff", "synthetic-staff");
  await click(page, `${staffSelector} [data-leave-action='confirm']`);
  await waitForExpression(
    page,
    `${query(`${staffSelector} ${rowSelector}`)}?.dataset.leaveStatus==='CONFIRMED'`,
    "员工确认后应显示审核通过状态。",
  );

  await logout(page, "staff");
  await navigate(
    page,
    runtime.baseUrl + "/web/parent/leave",
    "Boolean(document.querySelector('[data-leave-login-link]'))",
  );
  await login(page, "parent", "synthetic-parent");
  await click(page, `${parentSelector} [data-leave-action='acknowledge']`);
  await waitForExpression(
    page,
    `${query(`${parentSelector} ${rowSelector}`)}?.dataset.leaveAcknowledged==='true'`,
    "家长应能确认知悉审核结果。",
  );
  await setValue(page, "[data-leave-form] input[name='startDate']", "2026-10-25");
  await setValue(page, "[data-leave-form] input[name='endDate']", "2026-10-25");
  await click(page, "[data-leave-form] button[type='submit']");
  await waitForExpression(
    page,
    `document.querySelectorAll(${JSON.stringify(`${parentSelector} ${rowSelector}`)}).length===2`,
    "第二条合成申请应显示在请假列表中。",
  );
  await click(page, `${parentSelector} [data-leave-action='withdraw']`);
  await waitForExpression(
    page,
    `Array.from(document.querySelectorAll(${JSON.stringify(`${parentSelector} ${rowSelector}`)})).some((row)=>row.dataset.leaveStatus==='WITHDRAWN'&&row.innerText.includes('2026-10-25'))`,
    "家长确认后应撤回第二条待审核申请。",
  );
  assert.equal(dialogs, 1, "撤回前必须出现一次确认提示。");
  assert.equal((await assertNoInternalIds(page, "parent")).length, 2);

  const externalRequests = browserRequests.filter((value) => {
    try {
      return /^https?:/u.test(value) && new URL(value).origin !== runtime.baseUrl;
    } catch {
      return true;
    }
  });
  assert.deepEqual(externalRequests, [], "浏览器只能访问本机网页，不得请求外部网址。");
  assert.equal(inheritedUpstreamRequests, 0, "整个流程不能请求继承的非测试服务。");
  assert.ok(
    !browserRequests.some((value) => /\/(?:local|staff-local)\//u.test(value)),
    "邀请流程不得回退到旧演示身份服务。",
  );
  assert.deepEqual(pageErrors, [], "家长与员工请假页面不得出现脚本错误。");
  assert.equal(api.rows[0]?.status, "CONFIRMED");
  assert.equal(api.rows[0]?.acknowledged, true);
  assert.equal(api.rows[1]?.status, "WITHDRAWN");
  assert.ok(
    api.requests.some(
      (request) => request.path === "/parent/leave-requests" && request.method === "POST",
    ),
  );
  assert.ok(
    api.requests.some((request) => request.path.endsWith("/review") && request.role === "staff"),
  );
  const unexpectedApiRequests = api.requests.filter(
    (request) =>
      !(
        request.path.startsWith("/identity/") ||
        [
          "/me",
          "/guardian-relationships",
          "/parent/leave-requests",
          "/staff/leave-requests",
        ].includes(request.path) ||
        /^\/(?:parent|staff)\/leave-requests\/[0-9a-f-]{36}\/(?:resubmit|withdraw|acknowledge|review)$/u.test(
          request.path,
        )
      ),
  );
  assert.deepEqual(
    unexpectedApiRequests,
    [],
    "请假流程只应调用既有请假接口；实际额外请求：" + JSON.stringify(unexpectedApiRequests),
  );
  t.diagnostic(
    "受邀登录、家长申请、员工退回、家长确认与重提、员工确认、家长回执和撤回，以及桌面/窄屏布局均通过本机合成服务验证。",
  );
});
