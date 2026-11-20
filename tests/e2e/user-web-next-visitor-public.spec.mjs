/* global Buffer, fetch, Intl */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";
import test from "node:test";
import { browserApiModuleUrl } from "./helpers/release-browser-paths.mjs";
import {
  capture,
  clickParentControl,
  createLocalProfile,
  evaluate,
  localApiRequest,
  navigate,
  startNextBrowser,
  waitForExpression,
} from "./helpers/user-web-next-browser.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const { createApiApp } = await import(browserApiModuleUrl(repositoryRoot, "nest/api-app.js"));
const { publicCampusReference } = await import(
  browserApiModuleUrl(repositoryRoot, "nest/public-campus-scope.js")
);
const { InMemoryContentRepository } = await import(
  browserApiModuleUrl(repositoryRoot, "modules/content/content.repository.js")
);
const { InstitutionService } = await import(
  browserApiModuleUrl(repositoryRoot, "modules/institution/institution.service.js")
);
const evidenceRoot = resolve(
  repositoryRoot,
  process.env.USER_WEB_E2E_ARTIFACT_ROOT ??
    "artifacts/task20-a1-299-web-canonical-visitor-binding-e2e-20261024",
);
const evidenceRelative = relative(resolve(repositoryRoot, "artifacts"), evidenceRoot);
assert.ok(evidenceRelative && !evidenceRelative.startsWith(".."));
const tenantId = "00000000-0000-4000-8000-000000000001";
const campusId = "00000000-0000-4000-8000-000000000002";
const publicRef = "synthetic-visitor-campus-a1300";

async function createRoleApi(t) {
  const server = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : undefined;
    const token = request.headers.authorization?.replace(/^Bearer /u, "");
    const reply = (status, value) => {
      response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify(value));
    };
    if (request.url === "/identity/login" && request.method === "POST") {
      const role =
        body?.username === "parent-a1582" && body.password === "synthetic-password"
          ? "parent"
          : body?.username === "staff-a1582" && body.password === "synthetic-password"
            ? "staff"
            : undefined;
      if (!role) return reply(401, { error: { code: "INVALID_CREDENTIALS" } });
      return reply(200, {
        data: {
          token_type: "Bearer",
          access_token: `${role}-a1582-access-token-0000000000000000000000000000000000`,
          expires_at: "2099-01-01T00:00:00.000Z",
        },
      });
    }
    if (request.url === "/identity/logout" && request.method === "POST")
      return reply(200, { data: { logged_out: true } });
    const role = token?.startsWith("parent-a1582-")
      ? "parent"
      : token?.startsWith("staff-a1582-")
        ? "staff"
        : undefined;
    if (request.url === "/me" && request.method === "GET" && role) {
      return reply(200, {
        data: {
          actor_id:
            role === "parent"
              ? "00000000-0000-4000-8000-000000000201"
              : "00000000-0000-4000-8000-000000000202",
          display_name: role === "parent" ? "合成家长" : "合成员工",
          memberships: [
            {
              status: "ACTIVE",
              capabilities:
                role === "parent"
                  ? ["care:read", "binding:read", "binding:apply"]
                  : ["task:read", "binding:review", "care:write", "care:review", "daily:read"],
            },
          ],
        },
      });
    }
    return reply(401, { error: { code: "UNAUTHENTICATED" } });
  });
  await new Promise((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolvePromise);
  });
  t.after(
    async () =>
      new Promise((resolvePromise, reject) => {
        server.close((error) => (error ? reject(error) : resolvePromise()));
      }),
  );
  return `http://127.0.0.1:${server.address().port}`;
}

async function seedTodayDraft(apiBaseUrl, date) {
  const owner = await createLocalProfile(apiBaseUrl, "owner-east");
  const meal = await localApiRequest(apiBaseUrl, "/local/meals", owner, "POST", {
    meal_date: date,
    meal_type: "LUNCH",
    items: ["模拟今日米饭", "模拟今日青菜"],
    notes: "模拟数据：今日公开食谱。",
  });
  const draft = await localApiRequest(apiBaseUrl, `/local/meals/${meal.id}/draft`, owner, "PUT", {
    payload: {
      meal_date: date,
      meal_type: "LUNCH",
      items: ["模拟今日米饭", "模拟今日青菜"],
      notes: "模拟数据：今日公开食谱。",
      private_notes: "模拟食谱内部备注不可公开",
    },
    expected_version: meal.version,
  });
  return { owner, meal: draft };
}

test("visitor public pages, contact intent, public meals, and responsive layout", async (t) => {
  const institutionService = new InstitutionService(new InMemoryContentRepository());
  const owner = {
    trusted: true,
    actorId: "synthetic-visitor-owner",
    activeMembership: true,
    scope: { tenantId, campusId },
    capabilities: ["content:write", "content:publish"],
  };
  const homeDraft = institutionService.createHomeDraft(owner, "visitor-home", {
    title: "合成访客动态",
    type: "HOME_BLOCK",
    visibility: "PUBLIC",
    body: {
      summary: "仅供本机浏览器验证的公开内容。",
      blocks: [{ kind: "TEXT", text: "这是虚构的校区公开介绍。" }],
    },
    editor_note: "A1.300 synthetic public page fixture",
  });
  assert.equal(homeDraft.ok, true);
  assert.equal(institutionService.publishHome(owner, "visitor-home", 1).ok, true);
  const institutionDraft = institutionService.createInstitutionDraft(
    { ...owner, scope: { tenantId } },
    "visitor-institution",
    {
      title: "合成机构介绍",
      type: "INSTITUTION",
      visibility: "PUBLIC",
      body: {
        summary: "虚构机构的公开简介。",
        blocks: [{ kind: "TEXT", text: "不对应真实机构或儿童。" }],
      },
      editor_note: "A1.300 private institution note",
    },
  );
  assert.equal(institutionDraft.ok, true);
  assert.equal(
    institutionService.publishInstitution(
      { ...owner, scope: { tenantId } },
      "visitor-institution",
      1,
    ).ok,
    true,
  );
  const publicApi = await createApiApp({
    institutionService,
    getPublicInstitutionScope: (request, kind) =>
      publicCampusReference(request) === publicRef
        ? kind === "INSTITUTION"
          ? { tenantId }
          : { tenantId, campusId }
        : undefined,
  });
  await publicApi.listen(0, "127.0.0.1");
  let publicApiClosed = false;
  t.after(async () => {
    if (!publicApiClosed) await publicApi.close();
  });
  const publicApiUrl = "http://127.0.0.1:" + publicApi.getHttpServer().address().port;
  const oldApi = process.env.PUBLIC_API_BASE_URL;
  const oldRef = process.env.PUBLIC_CAMPUS_REF;
  process.env.PUBLIC_API_BASE_URL = publicApiUrl;
  process.env.PUBLIC_CAMPUS_REF = publicRef;
  let runtime;
  const roleApiUrl = await createRoleApi(t);
  try {
    runtime = await startNextBrowser(t, {
      repositoryRoot,
      startInviteApi: async () => roleApiUrl,
    });
  } finally {
    if (oldApi === undefined) delete process.env.PUBLIC_API_BASE_URL;
    else process.env.PUBLIC_API_BASE_URL = oldApi;
    if (oldRef === undefined) delete process.env.PUBLIC_CAMPUS_REF;
    else process.env.PUBLIC_CAMPUS_REF = oldRef;
  }
  const { baseUrl, apiBaseUrl } = runtime;
  const requests = [];
  const pageErrors = [];
  let adminSession = false;
  let page;
  page = await runtime.connectPage((method, params) => {
    if (method === "Network.requestWillBeSent" && /^https?:/u.test(params.request.url)) {
      requests.push({ url: params.request.url, headers: params.request.headers ?? {} });
    }
    if (
      method === "Fetch.requestPaused" &&
      new URL(params.request.url).pathname === "/api/admin/me"
    ) {
      const status = adminSession ? 200 : 401;
      const payload = adminSession
        ? {
            data: {
              actor_id: "00000000-0000-4000-8000-000000000203",
              display_name: "合成机构管理员",
              memberships: [{ status: "ACTIVE", capabilities: ["institution:read"] }],
            },
          }
        : { error: { code: "UNAUTHENTICATED" } };
      void page.send("Fetch.fulfillRequest", {
        requestId: params.requestId,
        responseCode: status,
        responseHeaders: [{ name: "content-type", value: "application/json; charset=utf-8" }],
        body: Buffer.from(JSON.stringify(payload)).toString("base64"),
      });
    }
    if (method === "Runtime.exceptionThrown")
      pageErrors.push(params.exceptionDetails?.text ?? "visitor page exception");
  });
  await page.send("Fetch.enable", {
    patterns: [{ urlPattern: baseUrl + "/api/admin/me", requestStage: "Request" }],
  });
  const anonymousRoot = await fetch(baseUrl + "/", { redirect: "manual" });
  assert.equal(anonymousRoot.status, 200, "根路由应先检查会话，再把匿名访客送到公开首页。");
  await navigate(page, baseUrl + "/", "location.pathname === '/visitor'");
  for (const [username, root] of [
    ["parent-a1582", "/web/parent/home"],
    ["staff-a1582", "/web/staff/workbench"],
  ]) {
    if (username === "staff-a1582")
      await evaluate(
        page,
        "fetch('/api-local/identity/logout',{method:'POST',credentials:'same-origin'})",
      );
    const loginStatus = await evaluate(
      page,
      `fetch('/api-local/identity/login',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({username:${JSON.stringify(username)},password:'synthetic-password'})}).then(response=>response.status)`,
    );
    assert.equal(
      loginStatus,
      200,
      `合成${username.startsWith("parent") ? "家长" : "员工"}会话应能登录。`,
    );
    await navigate(page, baseUrl + "/", `location.pathname === '${root}'`);
    assert.notEqual(await evaluate(page, "location.pathname"), "/visitor");
  }
  await evaluate(
    page,
    "fetch('/api-local/identity/logout',{method:'POST',credentials:'same-origin'})",
  );
  const loginHtml = await (await fetch(baseUrl + "/web/login")).text();
  const loginNavigation = loginHtml.match(/<nav id="site-navigation"[\s\S]*?<\/nav>/u)?.[0] ?? "";
  assert.ok(
    loginHtml.includes('class="brand" href="/web/login" aria-label="同芯学园账号登录"'),
    "账号登录和服务选择页的品牌入口应留在账号区。",
  );
  assert.ok(
    loginHtml.includes('class="header-action" href="/web/login"'),
    "账号登录和服务选择页的主按钮应留在账号区。",
  );
  assert.ok(
    loginHtml.includes('class="brand brand-footer" href="/web/login"'),
    "账号登录和服务选择页的页脚品牌应留在账号区。",
  );
  assert.doesNotMatch(
    loginNavigation,
    /href="(?:\/visitor|\/web\/visitor)/u,
    "账号登录和服务选择页的导航不得把用户送回访客内容区。",
  );
  const roleRoutes = [
    ...["home", "learning", "binding", "fees", "monthly", "pickup", "leave"].map((page) => ({
      path: `/web/parent/${page}`,
      root: "/web/parent/home",
      role: "家长",
    })),
    ...[
      "workbench",
      "binding",
      "daily",
      "care",
      "care-review",
      "monthly",
      "child-monthly",
      "leave",
    ].map((page) => ({
      path: `/web/staff/${page}`,
      root: "/web/staff/workbench",
      role: "员工",
    })),
  ];
  for (const route of roleRoutes) {
    const response = await fetch(baseUrl + route.path);
    const body = await response.text();
    assert.equal(response.status, 200, route.path + "\n" + runtime.nextOutput);
    assert.ok(
      body.includes(
        `class="brand" href="${route.root}" aria-label="同芯学园${route.role}${route.role === "家长" ? "首页" : "工作台"}"`,
      ),
      `${route.path}: 品牌 Logo 应返回${route.role}工作区。`,
    );
    assert.ok(
      body.includes(`class="header-action" href="${route.root}"`),
      `${route.path}: 页头主按钮应留在${route.role}工作区。`,
    );
    assert.ok(body.includes(`href="${route.root}"`), `${route.path}: 导航应提供角色首页入口。`);
    assert.ok(
      body.includes(`class="brand brand-footer" href="${route.root}"`),
      `${route.path}: 页脚 Logo 应返回${route.role}工作区。`,
    );
    assert.doesNotMatch(
      body,
      /href="(?:\/visitor(?:\/|#|")|\/web\/visitor\/home)/u,
      `${route.path}: 已登录角色页面不应把导航指向访客首页。`,
    );
    if (route.role === "员工") {
      assert.doesNotMatch(body, /href="\/web\/parent\//u, "员工导航不得跨到家长页面。");
    } else {
      assert.doesNotMatch(body, /href="\/web\/staff\//u, "家长导航不得跨到员工页面。");
    }
    if (route.path === "/web/parent/home" || route.path === "/web/staff/workbench") {
      assert.doesNotMatch(body, /返回访客首页/u, `${route.path}: 工作台根页面不应返回访客首页。`);
    }
  }
  const guestHome = await (await fetch(baseUrl + "/web/visitor/home")).text();
  assert.match(guestHome, /class="brand" href="\/visitor" aria-label="同芯学园访客首页"/u);
  for (const path of [
    "/visitor",
    "/web/visitor/home",
    "/web/visitor/institution",
    "/web/visitor/day-flow",
    "/visitor/content/visitor-home",
  ]) {
    const response = await fetch(baseUrl + path);
    const body = await response.text();
    assert.equal(response.status, 200, path + "\n" + runtime.nextOutput);
    assert.match(body, /同芯学园/u, path);
    assert.doesNotMatch(body, /A1\.300 private institution note|模拟草稿预览/u, path);
    if (path === "/visitor" || path === "/web/visitor/home") {
      assert.match(body, /合成访客动态/u, path);
      assert.match(body, /contact-intent/u, path);
      assert.match(body, /教师团队/u, path);
      assert.match(body, /校园活动现场/u, path);
      assert.match(body, /\/assets\/institution-activity-visit\.jpg/u, path);
      assert.match(body, /\/assets\/teacher-team-outdoor\.jpg/u, path);
      assert.match(body, /\/assets\/teacher-team-campus\.jpg/u, path);
      assert.doesNotMatch(body, /林老师|周老师|许老师/u, path);
    }
  }
  const missing = await fetch(baseUrl + "/visitor/content/not-published");
  assert.equal(missing.status, 404, "当前配置的公开接口应隐藏未发布内容。");
  assert.doesNotMatch(await missing.text(), /合成访客动态|A1\.300 private institution note/u);

  await navigate(
    page,
    baseUrl + "/web/parent/learning",
    "document.querySelector('.site-header .brand')",
  );
  await evaluate(page, "document.querySelector('.site-header .brand').click()");
  await waitForExpression(
    page,
    "location.pathname === '/web/parent/home'",
    "家长页头品牌点击后没有返回家长首页。",
  );
  await navigate(page, baseUrl + "/web/staff/leave", "document.querySelector('.header-action')");
  await evaluate(page, "document.querySelector('.header-action').click()");
  await waitForExpression(
    page,
    "location.pathname === '/web/staff/workbench'",
    "员工页头主按钮点击后没有返回工作台。",
  );
  await navigate(page, baseUrl + "/web/parent/leave", "document.querySelector('.brand-footer')");
  await evaluate(page, "document.querySelector('.brand-footer').click()");
  await waitForExpression(
    page,
    "location.pathname === '/web/parent/home'",
    "家长页脚品牌点击后没有返回家长首页。",
  );
  await navigate(
    page,
    baseUrl + "/web/visitor/home",
    "document.querySelector('#visitor-home-heading')",
  );
  assert.match(await evaluate(page, "document.body.innerText"), /合成访客动态/u);
  await evaluate(
    page,
    "document.querySelector('[data-institution-activity-photo]')?.scrollIntoView({ block: 'center' })",
  );
  await waitForExpression(
    page,
    "(() => { const image=document.querySelector('[data-institution-activity-photo]'); return image?.complete && image.naturalWidth > 0; })()",
    "首页活动照片没有成功加载。",
  );
  await evaluate(
    page,
    "document.querySelector('.institution-team-section')?.scrollIntoView({ block: 'center' })",
  );
  await waitForExpression(
    page,
    "[...document.querySelectorAll('.institution-team-photo')].length === 2 && [...document.querySelectorAll('.institution-team-photo')].every((image) => image.complete && image.naturalWidth > 0)",
    "教师团队照片没有全部加载。",
  );
  await waitForExpression(
    page,
    "document.querySelector('[data-contact-intent-ready=\"true\"]')",
    "联系表单未完成初始化。",
  );
  await waitForExpression(
    page,
    "document.querySelector('[data-public-meals-state=\"READY\"]')",
    "当日食谱未完成初始化。",
  );
  const requestsBeforeSubmit = requests.length;
  await evaluate(page, "document.querySelector('#contact-intent-submit').click()");
  await waitForExpression(
    page,
    "document.querySelector('[role=\"alert\"]')?.textContent.includes('请填写模拟称呼')",
    "空表单未显示校验提示。",
  );
  await evaluate(
    page,
    "(() => { const input=document.querySelector('#contact-intent-name'); const select=document.querySelector('#contact-intent-topic'); const inputSet=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; const selectSet=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set; inputSet.call(input,'虚构家长'); input.dispatchEvent(new Event('input',{bubbles:true})); selectSet.call(select,'care'); select.dispatchEvent(new Event('change',{bubbles:true})); document.querySelector('#contact-intent-submit').click(); return true; })()",
  );
  await waitForExpression(
    page,
    "document.body.innerText.includes('已收到你的模拟意向')",
    "联系表单未显示本机确认。",
  );
  assert.equal(requests.length, requestsBeforeSubmit, "联系意向不得发出网络请求。");
  assert.deepEqual(
    JSON.parse(
      await evaluate(
        page,
        "JSON.stringify({local:localStorage.length,session:sessionStorage.length})",
      ),
    ),
    { local: 0, session: 0 },
    "访客联系意向不能保存身份资料。",
  );

  await page.send("Emulation.setDeviceMetricsOverride", {
    width: 1365,
    height: 950,
    deviceScaleFactor: 1,
    mobile: false,
  });
  assert.equal(await evaluate(page, "document.documentElement.scrollWidth <= innerWidth"), true);
  await mkdir(resolve(evidenceRoot, "screenshots"), { recursive: true });
  await evaluate(
    page,
    "document.querySelector('[data-institution-activity-photo]')?.scrollIntoView({ block: 'center' })",
  );
  await capture(page, resolve(evidenceRoot, "screenshots/visitor-activity-desktop.png"));
  await evaluate(
    page,
    "document.querySelector('.institution-team-section')?.scrollIntoView({ block: 'start' })",
  );
  await capture(page, resolve(evidenceRoot, "screenshots/visitor-desktop.png"));
  await page.send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 900,
    deviceScaleFactor: 1,
    mobile: true,
  });
  assert.equal(await evaluate(page, "document.documentElement.scrollWidth <= innerWidth"), true);
  await evaluate(
    page,
    "document.querySelector('.institution-team-section')?.scrollIntoView({ block: 'start' })",
  );
  assert.equal(await evaluate(page, "Boolean(document.querySelector('.menu-toggle'))"), true);
  await evaluate(page, "document.querySelector('.menu-toggle').click()");
  await waitForExpression(
    page,
    "document.querySelector('.menu-toggle')?.getAttribute('aria-expanded') === 'true'",
    "手机导航未展开。",
  );
  await capture(page, resolve(evidenceRoot, "screenshots/visitor-mobile.png"));

  const mealDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const fixtures = await seedTodayDraft(apiBaseUrl, mealDate);
  const mealUrl = baseUrl + "/local/public-meals?date=" + mealDate;
  assert.match(
    await evaluate(page, "document.querySelector('[data-public-meals-state]').innerText"),
    /本日暂无已发布餐食。/u,
  );
  assert.deepEqual(await (await fetch(mealUrl)).json(), [], "草稿不得出现在公开食谱中。");
  let meal = await localApiRequest(
    apiBaseUrl,
    `/local/meals/${fixtures.meal.id}/publish`,
    fixtures.owner,
    "POST",
    {
      expected_version: fixtures.meal.version,
    },
  );
  await clickParentControl(page, "[data-public-meals-state] button");
  await waitForExpression(
    page,
    "document.querySelector('[data-public-meals-state]')?.dataset.publicMealsState === 'READY' && document.querySelector('[data-public-meals-state]').innerText.includes('模拟今日米饭')",
    "发布食谱没有显示。",
  );
  const published = await (await fetch(mealUrl)).json();
  assert.equal(published.length, 1);
  assert.deepEqual(Object.keys(published[0]).sort(), [
    "id",
    "items",
    "meal_date",
    "meal_type",
    "notes",
    "published_at",
  ]);
  assert.doesNotMatch(
    JSON.stringify(published),
    /private_notes|tenant_id|campus_id|模拟食谱内部备注不可公开/u,
  );
  meal = await localApiRequest(
    apiBaseUrl,
    `/local/meals/${meal.id}/unpublish`,
    fixtures.owner,
    "POST",
    {
      expected_version: meal.version,
    },
  );
  await clickParentControl(page, "[data-public-meals-state] button");
  await waitForExpression(
    page,
    "document.querySelector('[data-public-meals-state]')?.dataset.publicMealsState === 'READY' && document.querySelector('[data-public-meals-state]').innerText.includes('本日暂无已发布餐食。')",
    "下架食谱后仍显示旧内容。",
  );
  assert.ok(
    requests.every(({ url }) => new URL(url).origin === baseUrl),
    "访客页面只能访问本机地址。",
  );
  for (const request of requests.filter(
    ({ url }) => new URL(url).pathname === "/local/public-meals",
  )) {
    assert.equal(new URL(request.url).href, mealUrl);
    assert.ok(
      !Object.keys(request.headers).some((name) => /^(authorization|cookie)$/iu.test(name)),
    );
  }
  assert.deepEqual(pageErrors, []);
  await publicApi.close();
  publicApiClosed = true;

  adminSession = true;
  await navigate(page, baseUrl + "/", "location.pathname !== '/' ");
  assert.equal(
    await evaluate(page, "location.pathname"),
    "/admin/institution",
    "已登录管理员从网站根地址应进入管理端机构概览，不应落到访客空状态。",
  );
});
