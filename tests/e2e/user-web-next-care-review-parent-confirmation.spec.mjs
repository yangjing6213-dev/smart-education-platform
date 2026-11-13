import assert from "node:assert/strict";
import test from "node:test";
import { mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { browserApiModuleUrl } from "./helpers/release-browser-paths.mjs";
import {
  capture,
  clickParentControl,
  evaluate,
  navigate,
  startNextBrowser,
  waitForExpression,
} from "./helpers/user-web-next-browser.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const artifactRoot = resolve(
  repositoryRoot,
  process.env.USER_WEB_E2E_ARTIFACT_ROOT ??
    "artifacts/task20-a1-142-care-review-publish-parent-confirmation-20261019",
);
const [{ createApiApp }, { InviteAuthService, createInvitePasswordHash }, { buildLocalSyntheticServer }] =
  await Promise.all([
    import(browserApiModuleUrl(repositoryRoot, "nest/api-app.js")),
    import(browserApiModuleUrl(repositoryRoot, "nest/invite-auth.service.js")),
    import(browserApiModuleUrl(repositoryRoot, "local-synthetic/server.js")),
  ]);

const tenantId = "00000000-0000-4000-8000-000000000064";
const campusId = "00000000-0000-4000-8000-000000000065";
const password = "Synthetic-Only-Invite-2026!";
const accounts = [
  {
    username: "teacher.care.flow",
    actorId: "00000000-0000-4000-8000-000000000003",
    displayName: "模拟记录员工",
    capabilities: ["identity:read", "memberships:read", "care:write"],
  },
  {
    username: "owner.care.flow",
    actorId: "00000000-0000-4000-8000-000000000004",
    displayName: "模拟校区负责人",
    capabilities: ["identity:read", "memberships:read", "task:read", "care:review", "care:publish"],
  },
  {
    username: "parent.care.flow",
    actorId: "00000000-0000-4000-8000-000000000001",
    displayName: "模拟监护人",
    capabilities: ["identity:read", "memberships:read", "care:read"],
  },
];

async function localSession(local, profile) {
  const response = await local.inject({
    method: "POST",
    url: "/local/sessions",
    headers: { host: "127.0.0.1:4317" },
    payload: { profile },
  });
  assert.equal(response.statusCode, 201, response.body);
  return response.json().handle;
}

async function signIn(page, browser, account, path, expectedPath) {
  await navigate(
    page,
    `${browser.baseUrl}${path}`,
    "document.querySelector('input[type=\"password\"]')",
  );
  await waitForExpression(
    page,
    "document.querySelector('input[name=\"username\"]') && !document.querySelector('input[name=\"username\"]').disabled && document.querySelector('input[name=\"password\"]') && !document.querySelector('input[name=\"password\"]').disabled",
    "邀请登录表单应可以输入账号和密码。",
  );
  await clickParentControl(page, 'input[name="username"]');
  await page.send("Input.insertText", { text: account.username });
  await clickParentControl(page, 'input[name="password"]');
  await page.send("Input.insertText", { text: password });
  await clickParentControl(page, 'button[type="submit"]');
  await waitForExpression(
    page,
    `location.pathname === '${expectedPath}'`,
    `邀请账号应进入 ${expectedPath}。`,
  );
}

async function signOut(page) {
  const status = await evaluate(
    page,
    "fetch('/api-local/identity/logout',{method:'POST',credentials:'same-origin'}).then((response)=>response.status)",
  );
  assert.ok(status === 200 || status === 204, `退出登录应成功，实际状态 ${status}`);
}

test("employee submission, owner review and publication, and parent acknowledgment work end to end", async (t) => {
  const local = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  const parentHandle = await localSession(local, "parent-alpha");
  const ownerHandle = await localSession(local, "owner-east");
  const application = await local.inject({
    method: "POST",
    url: "/local/binding-applications",
    headers: { host: "127.0.0.1:4317", authorization: `Bearer ${parentHandle}` },
    payload: { student: "student-alpha", relationship: "GUARDIAN" },
  });
  assert.equal(application.statusCode, 201, application.body);
  const pending = application.json();
  const approved = await local.inject({
    method: "POST",
    url: `/local/binding-applications/${pending.id}/review`,
    headers: { host: "127.0.0.1:4317", authorization: `Bearer ${ownerHandle}` },
    payload: { version: pending.version, action: "approve" },
  });
  assert.equal(approved.statusCode, 200, approved.body);

  const inviteAuthService = new InviteAuthService(
    await Promise.all(
      accounts.map(async (account) => ({
        username: account.username,
        password_hash: await createInvitePasswordHash(password),
        identity: { actor_id: account.actorId, display_name: account.displayName },
        memberships: [
          {
            tenant_id: tenantId,
            campus_ids: [campusId],
            status: "ACTIVE",
            capabilities: account.capabilities,
          },
        ],
      })),
    ),
  );
  const api = await createApiApp({
    inviteAuthService,
    careRecordOperations: local.careRecordOperations,
    staffTaskWorkbenchOperations: local.staffTaskWorkbenchOperations,
  });
  await api.listen(0, "127.0.0.1");
  const address = api.getHttpServer().address();
  assert.ok(address && typeof address !== "string");

  const previousApi = process.env.USER_WEB_LOCAL_NEST_API;
  const previousPreview = process.env.USER_WEB_LOCAL_PREVIEW;
  const previousDistDir = process.env.TASK20_NEXT_DIST_DIR;
  process.env.USER_WEB_LOCAL_NEST_API = `http://127.0.0.1:${address.port}`;
  process.env.USER_WEB_LOCAL_PREVIEW = "true";
  process.env.TASK20_NEXT_DIST_DIR ??= ".next";
  t.after(async () => {
    if (previousApi === undefined) delete process.env.USER_WEB_LOCAL_NEST_API;
    else process.env.USER_WEB_LOCAL_NEST_API = previousApi;
    if (previousPreview === undefined) delete process.env.USER_WEB_LOCAL_PREVIEW;
    else process.env.USER_WEB_LOCAL_PREVIEW = previousPreview;
    if (previousDistDir === undefined) delete process.env.TASK20_NEXT_DIST_DIR;
    else process.env.TASK20_NEXT_DIST_DIR = previousDistDir;
    await api.close();
    await local.close();
  });

  const browser = await startNextBrowser(t, { repositoryRoot, skipLegacyApi: true });
  const requests = [];
  const postLoginFailures = [];
  const pageErrors = [];
  let loggedIn = false;
  const page = await browser.connectPage((method, params) => {
    if (method === "Network.requestWillBeSent") {
      const request = params.request ?? {};
      requests.push({
        url: request.url,
        hasAuthorization: Object.keys(request.headers ?? {}).some(
          (name) => name.toLowerCase() === "authorization",
        ),
      });
    }
    if (method === "Network.responseReceived" && loggedIn && params.response?.status >= 400)
      postLoginFailures.push({ url: params.response.url, status: params.response.status });
    if (method === "Runtime.exceptionThrown")
      pageErrors.push(params.exceptionDetails?.exception?.description ?? params.exceptionDetails?.text);
  });

  await page.send("Emulation.setDeviceMetricsOverride", {
    width: 1365,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });

  const teacher = accounts[0];
  const owner = accounts[1];
  const parent = accounts[2];
  await signIn(page, browser, teacher, "/web/login?next=%2Fweb%2Fstaff%2Fcare", "/web/staff/care");
  loggedIn = true;
  await waitForExpression(
    page,
    "document.querySelector('[data-staff-care-state=READY]')",
    "员工应读取自己负责范围内的成长记录。",
  );
  await clickParentControl(page, '[data-staff-care-action="save-draft"]');
  await waitForExpression(page, "document.querySelector('[data-care-status=DRAFT]')", "员工应保存草稿。");
  await clickParentControl(page, '[data-staff-care-action="submit"]');
  await waitForExpression(
    page,
    "document.querySelector('[data-care-status=SUBMITTED]')",
    "员工提交后应进入负责人审核队列。",
  );
  await signOut(page);
  loggedIn = false;

  await signIn(
    page,
    browser,
    owner,
    "/web/login?next=%2Fweb%2Fstaff%2Fworkbench",
    "/web/staff/workbench",
  );
  loggedIn = true;
  await waitForExpression(
    page,
    "document.querySelector('[data-staff-care-review-entry]')",
    "负责人工作台应显示成长记录审核入口。",
  );
  await clickParentControl(page, "[data-staff-care-review-entry]");
  try {
    await waitForExpression(
      page,
      "location.pathname === '/web/staff/care-review' && document.querySelector('[data-care-review-state=READY]')",
      "负责人应进入可用的成长记录审核页面。",
    );
  } catch (cause) {
    const state = await evaluate(
      page,
      "({path:location.pathname,state:document.querySelector('[data-care-review-state]')?.getAttribute('data-care-review-state'),text:document.body.innerText.slice(-1200)})",
    );
    throw new Error(
      `${cause instanceof Error ? cause.message : String(cause)}\n${JSON.stringify({ state, failures: postLoginFailures })}`,
    );
  }
  await waitForExpression(
    page,
    "document.querySelector('[data-care-review-row][data-care-status=SUBMITTED]')",
    "负责人应看到员工提交的待审核记录。",
  );
  const reviewScreenshot = join(artifactRoot, "browser", "care-review-desktop.png");
  await mkdir(dirname(reviewScreenshot), { recursive: true });
  await evaluate(page, "document.activeElement instanceof HTMLElement && document.activeElement.blur()");
  await capture(page, reviewScreenshot, true);
  await clickParentControl(page, '[data-care-review-action="return"]');
  await waitForExpression(
    page,
    "document.querySelector('[data-care-review-row][data-care-status=RETURNED]')",
    "负责人退回后记录应标为待修改。",
  );
  await signOut(page);
  loggedIn = false;

  await signIn(page, browser, teacher, "/web/login?next=%2Fweb%2Fstaff%2Fcare", "/web/staff/care");
  loggedIn = true;
  await waitForExpression(
    page,
    "document.querySelector('[data-staff-care-record][data-care-status=RETURNED] [data-staff-care-action=resubmit]')",
    "员工应看到被退回的记录及重新提交入口。",
  );
  await clickParentControl(page, '[data-staff-care-action="resubmit"]');
  await waitForExpression(
    page,
    "document.querySelector('[data-staff-care-form][data-staff-care-mode=resubmit]')",
    "员工应能打开退回记录并重新提交。",
  );
  await clickParentControl(page, '[data-staff-care-form] button[type="submit"]');
  await waitForExpression(
    page,
    "document.querySelector('[data-care-status=SUBMITTED]')",
    "修改后的记录应重新进入审核队列。",
  );
  await signOut(page);
  loggedIn = false;

  await signIn(
    page,
    browser,
    owner,
    "/web/login?next=%2Fweb%2Fstaff%2Fworkbench",
    "/web/staff/workbench",
  );
  loggedIn = true;
  await waitForExpression(page, "document.querySelector('[data-staff-care-review-entry]')", "负责人入口应恢复。");
  await clickParentControl(page, "[data-staff-care-review-entry]");
  await waitForExpression(
    page,
    "location.pathname === '/web/staff/care-review' && document.querySelector('[data-care-review-row][data-care-status=SUBMITTED]')",
    "重新提交的记录应回到审核队列。",
  );
  await clickParentControl(page, '[data-care-review-action="confirm"]');
  await waitForExpression(
    page,
    "document.querySelector('[data-care-review-row][data-care-status=CONFIRMED][data-care-published=false]')",
    "审核通过后仍应显示为未发布。",
  );
  await clickParentControl(page, '[data-care-review-action="publish"]');
  await waitForExpression(
    page,
    "document.querySelector('[data-care-review-published]')",
    "单独发布后负责人应看到已发布结果。",
  );
  const publishedScreenshot = join(artifactRoot, "browser", "care-review-published-desktop.png");
  await evaluate(page, "document.activeElement instanceof HTMLElement && document.activeElement.blur()");
  await capture(page, publishedScreenshot, true);
  await signOut(page);
  loggedIn = false;

  await signIn(page, browser, parent, "/web/login?next=%2Fweb%2Fparent%2Fhome", "/web/parent/home");
  loggedIn = true;
  await waitForExpression(
    page,
    "document.querySelector('[data-parent-care-row][data-receipt=UNREAD] [data-parent-care-alert]')",
    "家长首页应显示新发布且待查看的站内提醒。",
  );
  const parentScreenshot = join(artifactRoot, "browser", "parent-care-unread-mobile.png");
  await page.send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await evaluate(page, "document.activeElement instanceof HTMLElement && document.activeElement.blur()");
  await capture(page, parentScreenshot, true);
  await clickParentControl(page, '[data-parent-care-action="read"]');
  await waitForExpression(
    page,
    "document.querySelector('[data-parent-care-row][data-receipt=READ] [data-parent-care-action=acknowledge]')",
    "家长打开记录后应看到当日摘要和确认按钮。",
  );
  await clickParentControl(page, '[data-parent-care-action="acknowledge"]');
  await waitForExpression(
    page,
    "document.querySelector('[data-parent-care-row][data-receipt=ACKNOWLEDGED]')",
    "家长确认后状态应刷新为已确认知悉。",
  );

  const browserState = await evaluate(
    page,
    "({path:location.pathname,cookie:document.cookie,local:JSON.stringify(localStorage),session:JSON.stringify(sessionStorage)})",
  );
  assert.equal(browserState.path, "/web/parent/home");
  assert.doesNotMatch(browserState.cookie, /student_care_local_session=/u);
  assert.doesNotMatch(`${browserState.local} ${browserState.session}`, /access_token|Bearer\s+[A-Za-z0-9_-]{40,}/iu);

  const externalRequests = requests.filter((request) => {
    if (!/^https?:/iu.test(request.url)) return false;
    return new URL(request.url).origin !== browser.baseUrl;
  });
  assert.deepEqual(externalRequests, []);
  assert.equal(requests.some((request) => request.hasAuthorization), false);
  const knownUnavailableOptionalServices = new Set([
    "/api-local/parent/notices",
    "/api-local/parent/health-incidents",
  ]);
  const unexpectedFailures = postLoginFailures.filter(({ url, status }) => {
    const path = new URL(url).pathname;
    return status !== 404 || !knownUnavailableOptionalServices.has(path);
  });
  assert.deepEqual(unexpectedFailures, []);
  assert.deepEqual(
    [...new Set(postLoginFailures.map(({ url }) => new URL(url).pathname))].sort(),
    [...knownUnavailableOptionalServices].sort(),
  );
  assert.deepEqual(pageErrors, []);

  for (const width of [320, 390, 1365]) {
    await page.send("Emulation.setDeviceMetricsOverride", {
      width,
      height: 900,
      deviceScaleFactor: 1,
      mobile: width < 600,
    });
    const dimensions = await evaluate(
      page,
      "({width:innerWidth,scrollWidth:document.documentElement.scrollWidth})",
    );
    assert.equal(dimensions.scrollWidth <= dimensions.width, true, `${width}px 页面不能横向溢出。`);
  }
});
