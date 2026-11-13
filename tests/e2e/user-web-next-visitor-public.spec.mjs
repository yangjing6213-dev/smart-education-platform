/* global Buffer, fetch, Intl */
import assert from "node:assert/strict";
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
  try {
    runtime = await startNextBrowser(t, { repositoryRoot });
  } finally {
    if (oldApi === undefined) delete process.env.PUBLIC_API_BASE_URL;
    else process.env.PUBLIC_API_BASE_URL = oldApi;
    if (oldRef === undefined) delete process.env.PUBLIC_CAMPUS_REF;
    else process.env.PUBLIC_CAMPUS_REF = oldRef;
  }
  const { baseUrl, apiBaseUrl } = runtime;
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

  const requests = [];
  const pageErrors = [];
  const page = await runtime.connectPage((method, params) => {
    if (method === "Network.requestWillBeSent" && /^https?:/u.test(params.request.url)) {
      requests.push({ url: params.request.url, headers: params.request.headers ?? {} });
    }
    if (method === "Runtime.exceptionThrown")
      pageErrors.push(params.exceptionDetails?.text ?? "visitor page exception");
  });
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
});
