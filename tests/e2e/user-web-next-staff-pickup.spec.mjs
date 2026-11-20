import assert from "node:assert/strict";
import test from "node:test";
import { mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  capture,
  clickParentControl,
  evaluate,
  navigate,
  startNextBrowser,
  waitForExpression,
} from "./helpers/user-web-next-browser.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const evidenceRoot = resolve(repositoryRoot, "artifacts/rc-a1609/run/browser");
const apiOutput = resolve(repositoryRoot, "apps/api/dist/src");
const [{ createApiApp }, { InviteAuthService, createInvitePasswordHash }] = await Promise.all([
  import(pathToFileURL(join(apiOutput, "nest/api-app.js")).href),
  import(pathToFileURL(join(apiOutput, "nest/invite-auth.service.js")).href),
]);

const tenantId = "00000000-0000-4000-8000-000000000064";
const campusId = "00000000-0000-4000-8000-000000000065";
const authorizedActorId = "00000000-0000-4000-8000-000000000003";
const unprivilegedActorId = "00000000-0000-4000-8000-000000000007";
const validCredential = "A".repeat(43);
const invalidCredential = "X".repeat(43);
const authorizedAccount = {
  username: "teacher.pickup.synthetic",
  password: "synthetic-only-password",
  actorId: authorizedActorId,
  capabilities: ["identity:read", "memberships:read", "task:read", "attendance:write"],
};
const unprivilegedAccount = {
  username: "teacher.no-pickup.synthetic",
  password: "synthetic-only-password-2",
  actorId: unprivilegedActorId,
  capabilities: ["identity:read", "memberships:read", "task:read"],
};

test("staff pickup verification previews, checks, consumes once, and clears the one-time credential", async (t) => {
  await mkdir(evidenceRoot, { recursive: true });
  const accounts = [];
  for (const account of [authorizedAccount, unprivilegedAccount]) {
    accounts.push({
      username: account.username,
      password_hash: await createInvitePasswordHash(account.password),
      identity: { actor_id: account.actorId, display_name: "模拟员工" },
      memberships: [
        {
          tenant_id: tenantId,
          campus_ids: [campusId],
          status: "ACTIVE",
          capabilities: account.capabilities,
        },
      ],
    });
  }
  const inviteAuthService = new InviteAuthService(accounts);
  const operationCalls = [];
  let consumed = false;
  const parentPickupOperations = {
    async previewCredential(context, value) {
      const credentialMatches = value?.credential === validCredential;
      operationCalls.push({
        action: "preview",
        actorId: context.actorId,
        tenantId: context.tenantId,
        campusId: context.campusId,
        credentialMatches,
        requestKeys: Object.keys(value ?? {}),
      });
      if (!credentialMatches)
        throw Object.assign(new Error("Synthetic credential rejected"), {
          statusCode: 409,
          code: "STATE_CONFLICT",
        });
      return {
        studentLabel: "A1.609 模拟学生甲",
        classLabel: "模拟三年级甲班",
        recipientLabel: "示例接送人甲",
      };
    },
    async confirmCredential(context, value) {
      const credentialMatches = value?.credential === validCredential;
      operationCalls.push({
        action: "confirm",
        actorId: context.actorId,
        tenantId: context.tenantId,
        campusId: context.campusId,
        credentialMatches,
        requestKeys: Object.keys(value ?? {}),
      });
      if (
        !credentialMatches ||
        consumed ||
        value?.checks?.student !== true ||
        value?.checks?.recipient !== true ||
        value?.checks?.authorization !== true
      )
        throw Object.assign(new Error("Synthetic credential rejected"), {
          statusCode: 409,
          code: "STATE_CONFLICT",
        });
      consumed = true;
      return { id: "00000000-0000-4000-8000-000000000608", status: "COMPLETED" };
    },
  };
  const staffTaskWorkbenchOperations = {
    list: () => ({ tasks: [] }),
    adminList: () => [],
    create: () => undefined,
    check: () => undefined,
    cancel: () => undefined,
    claim: () => undefined,
    start: () => undefined,
    complete: () => undefined,
  };
  const api = await createApiApp({
    inviteAuthService,
    parentPickupOperations,
    staffTaskWorkbenchOperations,
  });
  await api.listen(0, "127.0.0.1");
  const address = api.getHttpServer().address();
  assert.ok(address && typeof address !== "string");
  const apiUrl = `http://127.0.0.1:${address.port}`;

  const previousApi = process.env.USER_WEB_LOCAL_NEST_API;
  const previousPreview = process.env.USER_WEB_LOCAL_PREVIEW;
  const previousDistDir = process.env.TASK20_NEXT_DIST_DIR;
  process.env.USER_WEB_LOCAL_NEST_API = apiUrl;
  process.env.USER_WEB_LOCAL_PREVIEW = "true";
  process.env.TASK20_NEXT_DIST_DIR = ".next-rc-a1609-user-web";
  t.after(async () => {
    if (previousApi === undefined) delete process.env.USER_WEB_LOCAL_NEST_API;
    else process.env.USER_WEB_LOCAL_NEST_API = previousApi;
    if (previousPreview === undefined) delete process.env.USER_WEB_LOCAL_PREVIEW;
    else process.env.USER_WEB_LOCAL_PREVIEW = previousPreview;
    if (previousDistDir === undefined) delete process.env.TASK20_NEXT_DIST_DIR;
    else process.env.TASK20_NEXT_DIST_DIR = previousDistDir;
    await api.close();
  });

  const runtime = await startNextBrowser(t, { repositoryRoot, skipLegacyApi: true });
  const browserRequests = [];
  const postLoginFailures = [];
  const preLoginFailures = [];
  const pageErrors = [];
  let loggedIn = false;
  const page = await runtime.connectPage((method, params) => {
    if (method === "Network.requestWillBeSent") {
      const request = params.request ?? {};
      browserRequests.push({ url: request.url, headers: request.headers ?? {} });
    }
    if (method === "Network.responseReceived" && params.response?.status >= 400) {
      (loggedIn ? postLoginFailures : preLoginFailures).push({
        url: params.response.url,
        status: params.response.status,
      });
    }
    if (method === "Runtime.exceptionThrown")
      pageErrors.push(params.exceptionDetails?.text ?? "网页脚本异常");
  });

  await navigate(
    page,
    `${runtime.baseUrl}/web/login?next=${encodeURIComponent("/web/staff/workbench")}`,
    "document.querySelector('[data-invite-state]')?.dataset.inviteState==='IDLE'",
  );
  assert.deepEqual(preLoginFailures, [{ url: `${runtime.baseUrl}/api-local/me`, status: 401 }]);
  await evaluate(
    page,
    `(() => { const set=(selector,value)=>{const el=document.querySelector(selector);const setter=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el),'value').set;setter.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));};set('[name=username]','${authorizedAccount.username}');set('[name=password]','${authorizedAccount.password}');})()`,
  );
  loggedIn = true;
  await clickParentControl(page, "[data-invite-submit]");
  try {
    await waitForExpression(
      page,
      "location.pathname === '/web/staff/workbench' && document.querySelector('[data-staff-workbench-state=READY]') && document.querySelector('[data-staff-pickup-entry]')",
      "只有有接送核验权限的员工才会看到工作台入口。",
    );
  } catch (error) {
    const diagnostics = await evaluate(
      page,
      "JSON.stringify({path:location.pathname,state:document.querySelector('[data-staff-workbench-state]')?.dataset.staffWorkbenchState,text:document.body.innerText.slice(0,700),pickupLink:Boolean(document.querySelector('[data-staff-pickup-entry]'))})",
    );
    throw new Error(
      `${error instanceof Error ? error.message : "工作台入口未就绪"} ${JSON.stringify({ diagnostics, failures: postLoginFailures })}`,
    );
  }
  await clickParentControl(page, "[data-staff-pickup-entry]");
  await waitForExpression(
    page,
    "location.pathname === '/web/staff/pickup' && document.querySelector('[data-staff-pickup-state=IDLE]')",
    "工作台入口应打开员工接送核验页面。",
  );

  const setCredential = async (value) =>
    (async () => {
      await evaluate(page, "document.querySelector('[data-staff-pickup-credential]').focus()");
      await page.send("Input.insertText", { text: value });
    })();
  await setCredential(invalidCredential);
  await waitForExpression(
    page,
    "document.querySelector('[data-staff-pickup-preview]').disabled === false",
    "输入凭证后，核对按钮应可用。",
  );
  await clickParentControl(page, "[data-staff-pickup-preview]");
  await waitForExpression(
    page,
    "document.querySelector('[data-staff-pickup-state=ERROR]') && document.querySelector('[data-staff-pickup-message]')?.textContent.includes('未完成')",
    "无效/过期凭证应给出安全、可恢复的提示。",
  );
  assert.equal(
    await evaluate(page, "document.querySelector('[data-staff-pickup-credential]').value"),
    "",
  );
  await setCredential(validCredential);
  await clickParentControl(page, "[data-staff-pickup-preview]");
  await waitForExpression(
    page,
    "document.querySelector('[data-staff-pickup-state=READY]') && document.querySelector('[data-pickup-check=student]')",
    "有效合成凭证应预览学生、班级和授权接送人。",
  );
  assert.ok(await evaluate(page, "document.body.innerText.includes('A1.609 模拟学生甲')"));
  assert.ok(await evaluate(page, "document.body.innerText.includes('示例接送人甲')"));
  assert.equal(
    await evaluate(page, "document.querySelector('[data-staff-pickup-confirm]').disabled"),
    true,
  );
  await evaluate(
    page,
    "document.activeElement instanceof HTMLElement && document.activeElement.blur(); window.scrollTo(0,0)",
  );
  await capture(page, join(evidenceRoot, "staff-pickup-preview-desktop.png"), true);

  await evaluate(page, "document.querySelector('[data-pickup-check=student]').focus()");
  for (const type of ["keyDown", "keyUp"])
    await page.send("Input.dispatchKeyEvent", {
      type,
      key: " ",
      code: "Space",
      windowsVirtualKeyCode: 32,
    });
  assert.equal(
    await evaluate(page, "document.querySelector('[data-pickup-check=student]').checked"),
    true,
  );
  assert.equal(
    await evaluate(page, "document.querySelector('[data-staff-pickup-confirm]').disabled"),
    true,
  );

  for (const selector of ['[data-pickup-check="recipient"]', '[data-pickup-check="authorization"]'])
    await clickParentControl(page, selector);
  const checkState = await evaluate(
    page,
    "JSON.stringify({student:document.querySelector('[data-pickup-check=student]').checked,recipient:document.querySelector('[data-pickup-check=recipient]').checked,authorization:document.querySelector('[data-pickup-check=authorization]').checked,disabled:document.querySelector('[data-staff-pickup-confirm]').disabled})",
  );
  assert.deepEqual(JSON.parse(checkState), {
    student: true,
    recipient: true,
    authorization: true,
    disabled: false,
  });
  await clickParentControl(page, "[data-staff-pickup-confirm]");
  await waitForExpression(
    page,
    "document.querySelector('[data-staff-pickup-state=DONE]') && document.querySelector('[data-staff-pickup-receipt]')",
    "完成三项现场核对后，页面应读回离校回执。",
  );
  assert.equal(
    await evaluate(page, "document.querySelector('[data-staff-pickup-credential]') === null"),
    true,
  );
  assert.equal(await evaluate(page, "document.body.innerText.includes('A'.repeat(43))"), false);
  assert.equal(await evaluate(page, "location.href.includes('A'.repeat(43))"), false);
  assert.equal(
    await evaluate(
      page,
      "![localStorage,sessionStorage].some(storage => Object.keys(storage).some(key => storage.getItem(key)?.includes('A'.repeat(43))))",
    ),
    true,
  );
  assert.equal(operationCalls.filter(({ action }) => action === "confirm").length, 1);
  assert.equal(
    operationCalls.every(({ credentialMatches }) => typeof credentialMatches === "boolean"),
    true,
  );
  assert.equal(
    operationCalls.some((call) => Object.values(call).includes(validCredential)),
    false,
  );
  assert.deepEqual(
    operationCalls.map(
      ({ action, actorId, tenantId: seenTenantId, campusId: seenCampusId, requestKeys }) => ({
        action,
        actorId,
        tenantId: seenTenantId,
        campusId: seenCampusId,
        requestKeys,
      }),
    ),
    [
      {
        action: "preview",
        actorId: authorizedActorId,
        tenantId,
        campusId,
        requestKeys: ["credential"],
      },
      {
        action: "preview",
        actorId: authorizedActorId,
        tenantId,
        campusId,
        requestKeys: ["credential"],
      },
      {
        action: "confirm",
        actorId: authorizedActorId,
        tenantId,
        campusId,
        requestKeys: ["credential", "checks"],
      },
    ],
    "服务端应只从受信身份补入租户/校区范围，前端请求体不携带身份或范围声明。",
  );

  await evaluate(
    page,
    "document.activeElement instanceof HTMLElement && document.activeElement.blur()",
  );
  for (const width of [320, 390, 1365]) {
    await page.send("Emulation.setDeviceMetricsOverride", {
      width,
      height: width === 1365 ? 1000 : 900,
      deviceScaleFactor: 1,
      mobile: width !== 1365,
    });
    assert.equal(
      await evaluate(page, "document.documentElement.scrollWidth <= window.innerWidth"),
      true,
      `页面在 ${width}px 视口不得横向溢出。`,
    );
    await evaluate(
      page,
      "document.activeElement instanceof HTMLElement && document.activeElement.blur(); window.scrollTo(0,0)",
    );
    await capture(page, join(evidenceRoot, `staff-pickup-done-${width}.png`), true);
  }

  const unprivilegedLogin = await fetch(`${apiUrl}/identity/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      username: unprivilegedAccount.username,
      password: unprivilegedAccount.password,
    }),
  });
  assert.equal(unprivilegedLogin.status, 200);
  const unprivilegedSession = (await unprivilegedLogin.json()).data.access_token;
  const denied = await fetch(`${apiUrl}/staff/pickup/credentials/preview`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${unprivilegedSession}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ credential: validCredential }),
  });
  assert.equal(denied.status, 403);
  assert.equal(operationCalls.length, 3, "无权限员工的凭证请求不得到达接送操作层。");

  assert.equal(postLoginFailures.filter(({ status }) => status === 409).length, 1);
  assert.equal(
    postLoginFailures.every(({ status }) => status === 409),
    true,
    "登录后的唯一预期失败是一次无效凭证预览。",
  );
  assert.deepEqual(pageErrors, []);
  const browserOrigins = [
    ...new Set(
      browserRequests.flatMap(({ url }) => {
        try {
          const parsed = new URL(url);
          return ["http:", "https:", "ws:", "wss:"].includes(parsed.protocol)
            ? [parsed.origin]
            : [];
        } catch {
          return [];
        }
      }),
    ),
  ];
  assert.deepEqual(
    browserOrigins.filter((origin) => origin !== runtime.baseUrl),
    [],
    "浏览器不得请求第三方来源。",
  );
  assert.equal(
    browserRequests.some(({ url }) => url.includes(validCredential)),
    false,
    "一次性凭证不得进入浏览器请求 URL。",
  );
  assert.equal(
    browserRequests.some(({ headers }) =>
      Object.keys(headers).some((name) => name.toLowerCase() === "authorization"),
    ),
    false,
    "Bearer 访问凭证不得暴露给浏览器请求层。",
  );
});
