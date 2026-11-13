/* global console, fetch, process, URL */

import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
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
const { createApiApp } = await import(browserApiModuleUrl(repositoryRoot, "nest/api-app.js"));
const { InviteAuthService, createInvitePasswordHash } = await import(
  browserApiModuleUrl(repositoryRoot, "nest/invite-auth.service.js")
);
const { buildLocalSyntheticServer } = await import(
  browserApiModuleUrl(repositoryRoot, "local-synthetic/server.js")
);
const artifactsRoot = resolve(
  repositoryRoot,
  process.env.USER_WEB_E2E_ARTIFACT_ROOT ??
    "artifacts/task20-a1-53-staff-daily-author-review-20261016",
);
const artifactPath = relative(resolve(repositoryRoot, "artifacts"), artifactsRoot);
assert.ok(
  artifactPath && !artifactPath.startsWith("..") && !isAbsolute(artifactPath),
  "工件只能写入当前工作树 artifacts 子目录。",
);

async function click(page, selector) {
  console.log("Daily browser click:", selector);
  await page.send("Page.bringToFront");
  try {
    return await clickParentControl(page, selector);
  } catch (error) {
    const diagnostic = await evaluate(
      page,
      `(() => { const target = document.querySelector(${JSON.stringify(selector)}); return { state: document.querySelector('[data-staff-daily-panel]')?.getAttribute('data-staff-daily-state'), rows: Array.from(document.querySelectorAll('[data-staff-daily-row]')).map((row) => ({ text: row.innerText, buttons: Array.from(row.querySelectorAll('button')).map((button) => ({ text: button.innerText, disabled: button.disabled, selector: button.outerHTML.slice(0, 240) })) })), target: target ? { disabled: target.disabled, html: target.outerHTML.slice(0, 240) } : null }; })()`,
    );
    throw new Error(
      `${error instanceof Error ? error.message : String(error)}; 页面状态：${JSON.stringify(diagnostic)}`,
    );
  }
}

async function waitState(page, selector, attribute, state, label) {
  console.log("Daily browser state:", label, state);
  await waitForExpression(
    page,
    `document.querySelector(${JSON.stringify(selector)})?.getAttribute(${JSON.stringify(attribute)})===${JSON.stringify(state)}`,
    `${label}必须进入${state}状态。`,
  );
}

async function choose(page, selector, label) {
  console.log("Daily browser select:", label);
  const options = await evaluate(
    page,
    `Array.from(document.querySelector(${JSON.stringify(selector)}).options).map(option=>({value:option.value,label:option.textContent.trim()}))`,
  );
  const index = options.findIndex((item) => item.label === label);
  assert.ok(index >= 0, `页面必须提供固定选项：${label}`);
  await click(page, selector);
  const keyEvents = [
    ["Home", 36],
    ...Array.from({ length: index }, () => ["ArrowDown", 40]),
    ["Enter", 13],
  ];
  for (const [key, keyCode] of keyEvents)
    for (const type of ["keyDown", "keyUp"])
      await page.send("Input.dispatchKeyEvent", {
        type,
        key,
        code: key,
        windowsVirtualKeyCode: keyCode,
        nativeVirtualKeyCode: keyCode,
      });
  assert.equal(
    await evaluate(page, `document.querySelector(${JSON.stringify(selector)}).value`),
    options[index].value,
    `必须通过原生选择框选中${label}。`,
  );
}

async function setViewport(page, width, height = 950) {
  console.log("Daily browser viewport:", width);
  await page.send("Page.bringToFront");
  await page.send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width < 600,
  });
  await evaluate(page, "window.scrollTo(0,0)");
  const dimensions = await evaluate(
    page,
    "({width:innerWidth,documentWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth})",
  );
  assert.equal(dimensions.width, width, `浏览器实际视口宽度必须是 ${width}px。`);
  assert.ok(
    dimensions.documentWidth <= dimensions.width && dimensions.bodyWidth <= dimensions.width,
    `日报页面不能横向溢出：${JSON.stringify(dimensions)}`,
  );
}

test(
  "员工保存与编辑日报草稿，负责人退回并确认后员工可查看结果",
  { timeout: 240_000 },
  async (t) => {
    await mkdir(join(artifactsRoot, "screenshots"), { recursive: true });
    const local = await buildLocalSyntheticServer({ mode: "local-synthetic" });
    t.after(() => local.close());
    const password = "Synthetic-Only-Daily-2026!";
    const hash = await createInvitePasswordHash(password);
    const accounts = [
      {
        username: "daily.teacher",
        id: "003",
        campus: "065",
        display: "合成教师甲",
        capabilities: [
          "identity:read",
          "memberships:read",
          "daily:read",
          "daily:create",
          "daily:submit",
          "task:read",
        ],
      },
      {
        username: "daily.owner",
        id: "004",
        campus: "065",
        display: "合成负责人甲",
        capabilities: ["identity:read", "memberships:read", "daily:review"],
      },
      {
        username: "daily.west",
        id: "005",
        campus: "066",
        display: "合成其他校区负责人",
        capabilities: ["identity:read", "memberships:read", "daily:review"],
      },
    ];
    const inviteAuthService = new InviteAuthService(
      accounts.map((account) => ({
        username: account.username,
        password_hash: hash,
        identity: {
          actor_id: "00000000-0000-4000-8000-000000000" + account.id,
          display_name: account.display,
        },
        memberships: [
          {
            tenant_id: "00000000-0000-4000-8000-000000000064",
            campus_ids: ["00000000-0000-4000-8000-000000000" + account.campus],
            status: "ACTIVE",
            capabilities: account.capabilities,
          },
        ],
      })),
    );
    const api = await createApiApp({
      inviteAuthService,
      staffDailyOperations: local.staffDailyOperations,
      staffTaskWorkbenchOperations: local.staffTaskWorkbenchOperations,
    });
    t.after(() => api.close());
    let failNextQueue = false;
    api.use((request, response, next) => {
      if (failNextQueue && request.method === "GET" && request.url === "/admin/daily-reports") {
        failNextQueue = false;
        response
          .status(503)
          .json({ error: { code: "SERVICE_UNAVAILABLE", message: "synthetic temporary fault" } });
      } else next();
    });
    await api.listen(0, "127.0.0.1");
    const invitedBase = await api.getUrl();
    const previous = Object.fromEntries(
      ["USER_WEB_LOCAL_NEST_API", "USER_WEB_NEST_API_BASE_URL", "ADMIN_WEB_LOCAL_NEST_API"].map(
        (key) => [key, process.env[key]],
      ),
    );
    process.env.USER_WEB_LOCAL_NEST_API = invitedBase;
    process.env.ADMIN_WEB_LOCAL_NEST_API = invitedBase;
    delete process.env.USER_WEB_NEST_API_BASE_URL;
    t.after(() => {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    });
    const tokens = {};
    for (const account of accounts) {
      const response = await fetch(invitedBase + "/identity/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: account.username, password }),
      });
      assert.equal(response.status, 200);
      tokens[account.username] = (await response.json()).data.access_token;
    }
    const apiRequest = async (role, path, body) =>
      fetch(invitedBase + path, {
        method: body ? "POST" : "GET",
        headers: {
          authorization: "Bearer " + tokens[role],
          ...(body ? { "content-type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    const harness = await startNextBrowser(t, { repositoryRoot, withAdmin: true });
    const { baseUrl, apiBaseUrl, adminBaseUrl } = harness;
    assert.equal(apiBaseUrl, "http://127.0.0.1:4319");
    assert.ok(adminBaseUrl, "负责人管理页面必须由同一个本机管理启动器提供。");
    const invalidDailyPath = await fetch(baseUrl + "/staff-local/staff-daily-reports/not-a-uuid", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    assert.equal(invalidDailyPath.status, 404, "无效日报编号必须在代理处按未找到处理。");

    const requests = [];
    const embeddedSchemes = [];
    const pageErrors = [];
    const httpFailures = [];
    const observe = (role) => (method, params) => {
      if (method === "Network.requestWillBeSent") {
        const url = new URL(params.request.url);
        if (url.protocol === "data:") {
          embeddedSchemes.push(url.protocol);
          return;
        }
        requests.push({
          role,
          method: params.request.method,
          path: url.pathname,
          origin: url.origin,
          hasAuthorization: Object.keys(params.request.headers ?? {}).some(
            (key) => key.toLowerCase() === "authorization",
          ),
        });
      }
      if (method === "Network.responseReceived" && params.response.status >= 400)
        httpFailures.push({
          role,
          path: new URL(params.response.url).pathname,
          status: params.response.status,
        });
      if (method === "Runtime.exceptionThrown")
        pageErrors.push({ role, text: params.exceptionDetails?.text ?? "网页脚本错误" });
    };

    const teacherPage = await harness.connectPage(observe("teacher"));
    const managerPage = await harness.createPage(observe("manager"));
    for (const [page, origin, loginPath, nextPath, username, userSelector, passwordSelector] of [
      [
        teacherPage,
        baseUrl,
        "/web/login",
        "/web/staff/daily",
        "daily.teacher",
        'input[name="username"]',
        'input[name="password"]',
      ],
      [
        managerPage,
        adminBaseUrl,
        "/admin/login",
        "/admin/staff-daily-review",
        "daily.owner",
        "#admin-login-username",
        "#admin-login-password",
      ],
    ]) {
      await navigate(
        page,
        origin + loginPath + "?next=" + encodeURIComponent(nextPath),
        "document.querySelector('input[type=password]')",
      );
      await waitForExpression(
        page,
        `document.querySelector(${JSON.stringify(userSelector)}) && !document.querySelector(${JSON.stringify(userSelector)}).disabled`,
        "登录表单必须就绪",
      );
      await click(page, userSelector);
      await page.send("Input.insertText", { text: username });
      await click(page, passwordSelector);
      await page.send("Input.insertText", { text: password });
      assert.equal(
        await evaluate(
          page,
          `document.querySelector(${JSON.stringify(userSelector)})?.value === ${JSON.stringify(username)}`,
        ),
        true,
        "登录名必须在提交前填入合成账号。",
      );
      assert.equal(
        await evaluate(
          page,
          `document.querySelector(${JSON.stringify(passwordSelector)})?.value === ${JSON.stringify(password)}`,
        ),
        true,
        "密码必须在提交前填入合成账号。",
      );
      await click(page, 'button[type="submit"]');
      try {
        await waitForExpression(
          page,
          `location.pathname===${JSON.stringify(nextPath)}`,
          "真实登录必须返回所请求的日报页面",
        );
      } catch (error) {
        const role = page === teacherPage ? "teacher" : "manager";
        const state = await evaluate(
          page,
          "({path:location.pathname,search:location.search,title:document.title,text:document.body.innerText.slice(0,240)})",
        ).catch(() => ({ unavailable: true }));
        const observedRequests = requests
          .filter((request) => request.role === role)
          .slice(-20)
          .map(({ method, path, origin }) => ({ method, path, origin }));
        throw new Error(
          `${error.message}; 登录诊断=${JSON.stringify({
            role,
            loginPath,
            nextPath,
            username,
            state,
            requests: observedRequests,
            httpFailures: httpFailures.filter((failure) => failure.role === role),
            pageErrors: pageErrors.filter((failure) => failure.role === role),
          })}`,
        );
      }
    }
    const cookies = (
      await managerPage.send("Network.getCookies", { urls: [adminBaseUrl + "/api/admin/me"] })
    ).cookies;
    const managerCookie = cookies.find((cookie) => cookie.name === "student_care_admin_session");
    assert.ok(managerCookie?.httpOnly);
    assert.equal(managerCookie.path, "/api/admin");
    assert.equal(
      await evaluate(managerPage, "document.cookie.includes('student_care_admin_session')"),
      false,
    );
    await navigate(
      teacherPage,
      baseUrl + "/web/staff/daily",
      "document.querySelector('[data-staff-daily-panel]')",
    );
    await navigate(
      managerPage,
      adminBaseUrl + "/admin/staff-daily-review",
      "document.querySelector('[data-staff-daily-review-panel]')",
    );
    await waitState(
      teacherPage,
      "[data-staff-daily-panel]",
      "data-staff-daily-state",
      "READY",
      "员工工作日报",
    );
    await waitState(
      managerPage,
      "[data-staff-daily-review-panel]",
      "data-staff-daily-review-state",
      "READY",
      "负责人审核队列",
    );
    assert.match(
      await evaluate(teacherPage, "document.body.innerText"),
      /工作日报/u,
      "员工必须从实际页面看到工作日报入口。",
    );
    assert.match(
      await evaluate(managerPage, "document.body.innerText"),
      /员工工作日报/u,
      "负责人必须从实际管理导航进入审核页面。",
    );

    await choose(teacherPage, '[data-staff-daily-form] select[name="homework"]', "需要协助");
    await click(teacherPage, "[data-staff-daily-save]");
    await waitForExpression(
      teacherPage,
      'document.querySelector(\'[data-staff-daily-row="0"] [data-staff-daily-status="DRAFT"]\')',
      "员工提交表单后必须保存日报草稿。",
    );
    await waitState(
      teacherPage,
      "[data-staff-daily-panel]",
      "data-staff-daily-state",
      "READY",
      "员工保存草稿",
    );
    await click(teacherPage, '[data-staff-daily-edit="0"]');
    await choose(teacherPage, '[data-staff-daily-form] select[name="homework"]', "已完成整理");
    await click(teacherPage, "[data-staff-daily-save]");
    await waitForExpression(
      teacherPage,
      "document.querySelector('[data-staff-daily-row=\"0\"]')?.innerText.includes('第 2 版')",
      "草稿修改后版本号必须增加。",
    );
    await waitState(
      teacherPage,
      "[data-staff-daily-panel]",
      "data-staff-daily-state",
      "READY",
      "员工编辑草稿",
    );

    const draftQueue = await apiRequest("daily.owner", "/admin/daily-reports");
    assert.deepEqual((await draftQueue.json()).data.records, [], "未提交草稿必须对审核员隐藏");
    await click(teacherPage, '[data-staff-daily-submit="0"]');
    await waitForExpression(
      teacherPage,
      'document.querySelector(\'[data-staff-daily-row="0"] [data-staff-daily-status="SUBMITTED"]\')',
      "员工提交后必须显示待负责人审核。",
    );
    await waitState(
      teacherPage,
      "[data-staff-daily-panel]",
      "data-staff-daily-state",
      "READY",
      "员工提交日报",
    );
    assert.equal(
      requests.filter(
        (request) =>
          request.role === "teacher" &&
          request.method === "POST" &&
          request.path === "/api-local/staff/daily-reports",
      ).length,
      1,
      "快速重复点击也只能保存一份草稿。",
    );
    assert.equal(
      requests.filter(
        (request) =>
          request.role === "teacher" &&
          request.method === "POST" &&
          /\/daily-reports\/[0-9a-f-]+\/submit$/iu.test(request.path),
      ).length,
      1,
      "员工实际点击一次提交，只能产生一条审核写入。",
    );

    await click(managerPage, "[data-staff-daily-review-refresh]");
    await waitForExpression(
      managerPage,
      "document.querySelector('[data-staff-daily-review-row=\"0\"]')",
      "负责人必须能看到员工刚提交的日报。",
    );
    await waitState(
      managerPage,
      "[data-staff-daily-review-panel]",
      "data-staff-daily-review-state",
      "READY",
      "负责人刷新审核队列",
    );
    const managerText = await evaluate(managerPage, "document.body.innerText");
    const submitted = (await (await apiRequest("daily.owner", "/admin/daily-reports")).json()).data
      .records[0];
    assert.equal(submitted.version, 3);
    assert.equal((await fetch(invitedBase + "/admin/daily-reports")).status, 401);
    assert.equal((await apiRequest("daily.teacher", "/admin/daily-reports")).status, 403);
    assert.deepEqual(
      (await (await apiRequest("daily.west", "/admin/daily-reports")).json()).data.records,
      [],
    );
    assert.equal(
      (
        await apiRequest("daily.west", `/admin/daily-reports/${submitted.id}/review`, {
          version: 3,
          action: "CONFIRM",
        })
      ).status,
      404,
    );
    const proxyCall = async (path, method = "GET", body) =>
      fetch(adminBaseUrl + "/api/admin" + path, {
        method,
        headers: {
          cookie: "student_care_admin_session=" + managerCookie.value,
          host: new URL(adminBaseUrl).host,
          origin: adminBaseUrl,
          ...(body ? { "content-type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    assert.equal((await proxyCall("/daily-reports?campusId=forged")).status, 400);
    assert.equal(
      (await proxyCall("/daily-reports/bad/review", "POST", { version: 1, action: "CONFIRM" }))
        .status,
      404,
    );
    assert.equal(
      (
        await proxyCall(`/daily-reports/${submitted.id}/review`, "POST", {
          version: 2,
          action: "CONFIRM",
        })
      ).status,
      409,
    );
    assert.match(managerText, /提交人：示例东校区教师/u);
    assert.match(managerText, /来源分类：/u);
    assert.doesNotMatch(managerText, /00000000-0000-4000-8000-|studentId|sourceRefs/u);

    await setViewport(managerPage, 1365);
    assert.equal(
      await evaluate(
        managerPage,
        "(() => { const shell = document.querySelector('.admin-layout'); const nav = document.querySelector('.admin-sidebar'); const main = document.querySelector('.admin-main'); return Boolean(shell && nav && main && getComputedStyle(shell).gridTemplateColumns.startsWith('264px') && nav.getBoundingClientRect().right <= main.getBoundingClientRect().left); })()",
      ),
      true,
      "管理工作台桌面布局必须将导航放在左侧、页面内容放在右侧。",
    );
    for (const width of [390, 320]) await setViewport(managerPage, width);
    await setViewport(managerPage, 1365);
    await capture(
      managerPage,
      join(artifactsRoot, "screenshots", "admin-staff-daily-review-desktop.png"),
      true,
    );
    await setViewport(managerPage, 390);
    await waitForExpression(
      managerPage,
      "document.querySelector('.nav-toggle')?.getAttribute('aria-expanded')==='false' && getComputedStyle(document.querySelector('.admin-sidebar')).visibility==='hidden' && document.querySelector('.admin-sidebar').getBoundingClientRect().right<=0",
      "手机管理页默认应收起左侧导航抽屉，显示右侧页面内容。",
    );
    await capture(
      managerPage,
      join(artifactsRoot, "screenshots", "admin-staff-daily-review-mobile.png"),
      true,
    );

    await click(managerPage, '[data-staff-daily-review-action="RETURN"]');
    await waitState(
      managerPage,
      "[data-staff-daily-review-panel]",
      "data-staff-daily-review-state",
      "READY",
      "负责人退回操作",
    );
    assert.equal(
      requests.filter(
        (request) =>
          request.role === "manager" &&
          request.method === "POST" &&
          /\/daily-reports\/[0-9a-f-]+\/review$/iu.test(request.path),
      ).length,
      1,
      "负责人一次退回只能写入一次。",
    );

    await click(teacherPage, "[data-staff-daily-refresh]");
    await waitForExpression(
      teacherPage,
      'document.querySelector(\'[data-staff-daily-row="0"] [data-staff-daily-status="RETURNED"]\')',
      "员工必须看到负责人退回的状态。",
    );
    await waitState(
      teacherPage,
      "[data-staff-daily-panel]",
      "data-staff-daily-state",
      "READY",
      "员工查看退回状态",
    );
    await click(teacherPage, '[data-staff-daily-edit="0"]');
    await choose(teacherPage, '[data-staff-daily-form] select[name="homework"]', "需要协助");
    await click(teacherPage, "[data-staff-daily-save]");
    await waitForExpression(
      teacherPage,
      "document.querySelector('[data-staff-daily-row=\"0\"] [data-staff-daily-status=\"SUBMITTED\"]')?.innerText.includes('第 5 版')",
      "退回修改后重新提交必须保留版本顺序。",
    );
    await waitState(
      teacherPage,
      "[data-staff-daily-panel]",
      "data-staff-daily-state",
      "READY",
      "员工重新提交日报",
    );

    await click(managerPage, "[data-staff-daily-review-refresh]");
    await waitForExpression(
      managerPage,
      "document.querySelector('[data-staff-daily-review-row=\"0\"]')",
      "负责人必须能看到修改后的新提交。",
    );
    await waitState(
      managerPage,
      "[data-staff-daily-review-panel]",
      "data-staff-daily-review-state",
      "READY",
      "负责人刷新修改后的日报",
    );
    await click(managerPage, '[data-staff-daily-review-action="CONFIRM"]');
    await waitState(
      managerPage,
      "[data-staff-daily-review-panel]",
      "data-staff-daily-review-state",
      "READY",
      "负责人确认操作",
    );
    await click(teacherPage, "[data-staff-daily-refresh]");
    await waitForExpression(
      teacherPage,
      'document.querySelector(\'[data-staff-daily-row="0"] [data-staff-daily-status="CONFIRMED"]\')',
      "员工必须看到负责人确认的最终状态。",
    );
    await waitState(
      teacherPage,
      "[data-staff-daily-panel]",
      "data-staff-daily-state",
      "READY",
      "员工查看最终审核结果",
    );
    assert.equal(
      requests.filter(
        (request) =>
          request.role === "manager" &&
          request.method === "POST" &&
          /\/daily-reports\/[0-9a-f-]+\/review$/iu.test(request.path),
      ).length,
      2,
      "退回和确认各产生一次真实审核写入。",
    );
    assert.equal(
      await evaluate(
        managerPage,
        `document.querySelector('[data-staff-daily-review-action="CONFIRM"]')===null`,
      ),
      true,
      "已确认日报不得再次确认",
    );
    // An actual backend conflict makes the browser hide stale actions before reconnecting.
    assert.equal(
      (
        await apiRequest("daily.owner", `/admin/daily-reports/${submitted.id}/withdraw`, {
          version: 6,
        })
      ).status,
      200,
    );
    await click(managerPage, '[data-staff-daily-review-action="WITHDRAW"]');
    await waitState(
      managerPage,
      "[data-staff-daily-review-panel]",
      "data-staff-daily-review-state",
      "ERROR",
      "版本冲突",
    );
    assert.equal(
      await evaluate(
        managerPage,
        "document.querySelectorAll('[data-staff-daily-review-row]').length",
      ),
      0,
    );
    await click(managerPage, "[data-staff-daily-review-reconnect]");
    await waitState(
      managerPage,
      "[data-staff-daily-review-panel]",
      "data-staff-daily-review-state",
      "READY",
      "冲突恢复",
    );
    assert.equal(
      await evaluate(
        managerPage,
        "document.querySelectorAll('[data-staff-daily-review-action]').length",
      ),
      0,
      "退回记录只能由员工重提",
    );
    failNextQueue = true;
    await click(managerPage, "[data-staff-daily-review-refresh]");
    await waitState(
      managerPage,
      "[data-staff-daily-review-panel]",
      "data-staff-daily-review-state",
      "ERROR",
      "服务故障",
    );
    assert.equal(
      await evaluate(
        managerPage,
        "document.querySelectorAll('[data-staff-daily-review-row]').length",
      ),
      0,
    );
    await click(managerPage, "[data-staff-daily-review-reconnect]");
    await waitState(
      managerPage,
      "[data-staff-daily-review-panel]",
      "data-staff-daily-review-state",
      "READY",
      "故障恢复",
    );
    await click(teacherPage, "[data-staff-daily-refresh]");
    await waitState(
      teacherPage,
      "[data-staff-daily-panel]",
      "data-staff-daily-state",
      "READY",
      "撤回后员工刷新",
    );
    await click(teacherPage, '[data-staff-daily-edit="0"]');
    await click(teacherPage, "[data-staff-daily-save]");
    await waitState(
      teacherPage,
      "[data-staff-daily-panel]",
      "data-staff-daily-state",
      "READY",
      "撤回后重提",
    );
    await click(managerPage, "[data-staff-daily-review-refresh]");
    await waitState(
      managerPage,
      "[data-staff-daily-review-panel]",
      "data-staff-daily-review-state",
      "READY",
      "重提审核",
    );
    await click(managerPage, '[data-staff-daily-review-action="CONFIRM"]');
    await waitState(
      managerPage,
      "[data-staff-daily-review-panel]",
      "data-staff-daily-review-state",
      "READY",
      "重新确认",
    );
    await click(managerPage, '[data-staff-daily-review-action="WITHDRAW"]');
    await waitState(
      managerPage,
      "[data-staff-daily-review-panel]",
      "data-staff-daily-review-state",
      "READY",
      "实际撤回确认",
    );
    assert.equal(
      (await (await apiRequest("daily.owner", "/admin/daily-reports")).json()).data.records[0]
        .version,
      10,
    );
    assert.deepEqual(
      httpFailures,
      [
        { role: "teacher", path: "/api-local/me", status: 401 },
        { role: "manager", path: `/api/admin/daily-reports/${submitted.id}/withdraw`, status: 409 },
        { role: "manager", path: "/api/admin/daily-reports", status: 503 },
      ],
      "只允许首次未登录探测和两个精确注入失败",
    );
    assert.equal(
      requests.some(
        (request) =>
          request.hasAuthorization ||
          request.path.startsWith("/local/") ||
          request.path.startsWith("/staff-local/"),
      ),
      false,
      "浏览器不得发送令牌或使用旧本机业务入口",
    );
    const unexpectedRequests = requests.filter(
      (request) => ![baseUrl, adminBaseUrl].includes(request.origin),
    );
    assert.deepEqual(
      unexpectedRequests,
      [],
      `页面请求只能访问本机网页与合成服务；实际请求：${JSON.stringify(unexpectedRequests)}`,
    );
    assert.ok(
      embeddedSchemes.every((scheme) => scheme === "data:"),
      `页面只允许内嵌数据图片，不允许其他非网络协议：${JSON.stringify(embeddedSchemes)}`,
    );
    assert.deepEqual(pageErrors, [], "实际操作期间不得出现网页脚本错误。");

    for (const width of [1365, 390, 320]) await setViewport(teacherPage, width);
    await setViewport(teacherPage, 1365);
    await capture(teacherPage, join(artifactsRoot, "screenshots", "staff-daily-desktop.png"), true);
    await setViewport(teacherPage, 390);
    await capture(teacherPage, join(artifactsRoot, "screenshots", "staff-daily-mobile.png"), true);
  },
);
