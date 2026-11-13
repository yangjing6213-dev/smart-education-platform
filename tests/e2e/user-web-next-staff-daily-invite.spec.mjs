import assert from "node:assert/strict";
import test from "node:test";
import { mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL, URL } from "node:url";
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
  "artifacts/task20-a1-141-staff-daily-invite-identity-20261019",
);
const apiOutput = resolve(artifactRoot, "api-dist/src");
const [{ createApiApp }, { InviteAuthService, createInvitePasswordHash }, { buildLocalSyntheticServer }] =
  await Promise.all([
    import(pathToFileURL(join(apiOutput, "nest/api-app.js")).href),
    import(pathToFileURL(join(apiOutput, "nest/invite-auth.service.js")).href),
    import(pathToFileURL(join(apiOutput, "local-synthetic/server.js")).href),
  ]);

const account = {
  username: "teacher.daily",
  password: "Synthetic-Only-Invite-2026!",
  actorId: "00000000-0000-4000-8000-000000000003",
  tenantId: "00000000-0000-4000-8000-000000000064",
  campusId: "00000000-0000-4000-8000-000000000065",
};

test("invited employee opens daily report, changes a fixed option, saves a draft, and submits it", async (t) => {
  const local = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  const inviteAuthService = new InviteAuthService([
    {
      username: account.username,
      password_hash: await createInvitePasswordHash(account.password),
      identity: { actor_id: account.actorId, display_name: "模拟员工甲" },
      memberships: [
        {
          tenant_id: account.tenantId,
          campus_ids: [account.campusId],
          status: "ACTIVE",
          capabilities: [
            "identity:read",
            "memberships:read",
            "daily:read",
            "daily:create",
            "daily:submit",
            "task:read",
          ],
        },
      ],
    },
  ]);
  const api = await createApiApp({
    inviteAuthService,
    staffDailyOperations: local.staffDailyOperations,
    staffTaskWorkbenchOperations: local.staffTaskWorkbenchOperations,
  });
  await api.listen(0, "127.0.0.1");
  const address = api.getHttpServer().address();
  assert.ok(address && typeof address !== "string");

  const previousLocalNestApi = process.env.USER_WEB_LOCAL_NEST_API;
  const previousPreview = process.env.USER_WEB_LOCAL_PREVIEW;
  const previousDistDir = process.env.TASK20_NEXT_DIST_DIR;
  process.env.USER_WEB_LOCAL_NEST_API = `http://127.0.0.1:${address.port}`;
  process.env.USER_WEB_LOCAL_PREVIEW = "true";
  process.env.TASK20_NEXT_DIST_DIR = ".next-task20-a1-141";
  t.after(async () => {
    if (previousLocalNestApi === undefined) delete process.env.USER_WEB_LOCAL_NEST_API;
    else process.env.USER_WEB_LOCAL_NEST_API = previousLocalNestApi;
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
    if (method === "Network.responseReceived" && loggedIn && params.response?.status >= 400) {
      postLoginFailures.push({ url: params.response.url, status: params.response.status });
    }
    if (method === "Runtime.exceptionThrown") {
      pageErrors.push(params.exceptionDetails?.exception?.description ?? params.exceptionDetails?.text);
    }
  });

  await page.send("Emulation.setDeviceMetricsOverride", {
    width: 1365,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await navigate(
    page,
    `${browser.baseUrl}/web/login?next=%2Fweb%2Fstaff%2Fworkbench`,
    "document.querySelector('input[type=\"password\"]')",
  );
  await waitForExpression(
    page,
    "document.querySelector('input[name=\"username\"]') && !document.querySelector('input[name=\"username\"]').disabled && document.querySelector('input[name=\"password\"]') && !document.querySelector('input[name=\"password\"]').disabled",
    "登录页完成身份检查后应允许输入账号和密码。",
  );
  const loginInputs = await evaluate(
    page,
    "Array.from(document.querySelectorAll('input')).map((input) => ({name:input.name,type:input.type,disabled:input.disabled}))",
  );
  assert.ok(
    loginInputs.some((input) => input.name === "username" && !input.disabled),
    `登录页应显示账号输入框：${JSON.stringify(loginInputs)}`,
  );
  assert.ok(
    loginInputs.some((input) => input.name === "password" && !input.disabled),
    `登录页应显示密码输入框：${JSON.stringify(loginInputs)}`,
  );
  await clickParentControl(page, 'input[name="username"]');
  await page.send("Input.insertText", { text: account.username });
  await clickParentControl(page, 'input[name="password"]');
  await page.send("Input.insertText", { text: account.password });
  await clickParentControl(page, 'button[type="submit"]');
  await waitForExpression(
    page,
    "location.pathname === '/web/staff/workbench'",
    "受邀员工登录后应打开工作台。",
  );
  loggedIn = true;
  await waitForExpression(
    page,
    "document.querySelector('[data-staff-daily-entry]')",
    "具备日报权限的员工应在工作台看到日报入口。",
  );
  await clickParentControl(page, "[data-staff-daily-entry]");
  try {
    await waitForExpression(
      page,
      "location.pathname === '/web/staff/daily' && document.querySelector('[data-staff-daily-state=READY]')",
      "日报页面应读取当前受邀员工自己的记录。",
    );
  } catch (error) {
    const state = await evaluate(
      page,
      "({path:location.pathname,status:document.querySelector('[data-staff-daily-state]')?.getAttribute('data-staff-daily-state'),message:document.querySelector('[role=alert],[role=status]')?.textContent?.trim()})",
    );
    const apiProbe = await evaluate(
      page,
      "Promise.all(['/api-local/me','/api-local/staff/daily-reports'].map(async (path) => { const response=await fetch(path,{credentials:'same-origin'}); const body=await response.json(); return {path,status:response.status,code:body.error?.code,capabilities:body.data?.memberships?.flatMap((membership)=>membership.capabilities)}; }))",
    );
    throw new Error(`${error instanceof Error ? error.message : "日报页面未就绪"} ${JSON.stringify({ state, failures: postLoginFailures, apiProbe })}`);
  }

  await clickParentControl(page, 'select[name="arrival"]');
  for (const key of ["ArrowDown", "Enter"]) {
    await page.send("Input.dispatchKeyEvent", { type: "keyDown", key });
    await page.send("Input.dispatchKeyEvent", { type: "keyUp", key });
  }
  assert.equal(await evaluate(page, "document.querySelector('select[name=arrival]').value"), "LATE");
  await clickParentControl(page, "[data-staff-daily-save]");
  await waitForExpression(
    page,
    "document.querySelector('[data-staff-daily-row=\"0\"]')",
    "保存后应显示本人工作日报草稿。",
  );
  await clickParentControl(page, '[data-staff-daily-submit="0"]');
  await waitForExpression(
    page,
    "document.querySelector('[data-staff-daily-status=SUBMITTED]')",
    "提交后日报状态应变为待审核。",
  );

  const state = await evaluate(
    page,
    "({path:location.pathname,cookie:document.cookie,local:JSON.stringify(localStorage),session:JSON.stringify(sessionStorage),width:innerWidth,scrollWidth:document.documentElement.scrollWidth})",
  );
  assert.equal(state.path, "/web/staff/daily");
  assert.doesNotMatch(state.cookie, /student_care_local_session=/u);
  assert.doesNotMatch(`${state.local} ${state.session}`, /access_token|Bearer\s+[A-Za-z0-9_-]{40,}/iu);

  const externalRequests = requests.filter((request) => {
    if (!/^https?:/iu.test(request.url)) return false;
    return new URL(request.url).origin !== browser.baseUrl;
  });
  assert.deepEqual(externalRequests, []);
  assert.equal(requests.some((request) => request.hasAuthorization), false);
  assert.deepEqual(postLoginFailures, []);
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
  await page.send("Emulation.setDeviceMetricsOverride", {
    width: 1365,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  const browserEvidence = join(artifactRoot, "browser");
  await mkdir(browserEvidence, { recursive: true });
  await capture(page, join(browserEvidence, "staff-daily-invite-desktop.png"), true);
});
