import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import {
  startNextBrowser,
  localApiRequest,
  createLocalProfile,
  evaluate,
  waitForExpression,
  navigate,
  clickParentControl,
  capture,
} from "./helpers/user-web-next-browser.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const artifactsRoot = resolve(
  repositoryRoot,
  process.env.USER_WEB_E2E_ARTIFACT_ROOT ?? "artifacts/task20-a1-50-next-staff-workbench-20261015",
);
const artifactsRelative = relative(resolve(repositoryRoot, "artifacts"), artifactsRoot);
assert.ok(
  artifactsRelative && !artifactsRelative.startsWith("..") && !isAbsolute(artifactsRelative),
  "回归工件只能写入当前隔离树的 artifacts 子目录。",
);
const routeTitles = [
  ["/visitor/content/teacher-team", "教师团队"],
  ["/visitor/content/seasonal-activities", "活动"],
  ["/visitor/content/meal-plan", "餐食 / 食谱"],
  ["/visitor/content/environment-and-contact", "环境与联系"],
];

async function seedPublicMeals(baseUrl, date) {
  const owner = await createLocalProfile(baseUrl, "owner-east");
  const otherOwner = await createLocalProfile(baseUrl, "owner-west");
  const payload = {
    meal_date: date,
    meal_type: "LUNCH",
    items: ["模拟当日米饭", "模拟当日青菜"],
    notes: "模拟数据：本日公开食谱。",
  };
  let meal = await localApiRequest(baseUrl, "/local/meals", owner, "POST", payload);
  meal = await localApiRequest(baseUrl, `/local/meals/${meal.id}/draft`, owner, "PUT", {
    payload: { ...payload, private_notes: "模拟食谱内部备注不可公开" },
    expected_version: meal.version,
  });
  const previousDate = new Date(Date.parse(`${date}T00:00:00.000Z`) - 86400000)
    .toISOString()
    .slice(0, 10);
  for (const [handle, mealDate, item] of [
    [owner, previousDate, "模拟其他日期菜品"],
    [otherOwner, date, "模拟其他校区菜品"],
  ]) {
    const hiddenMeal = await localApiRequest(baseUrl, "/local/meals", handle, "POST", {
      ...payload,
      meal_date: mealDate,
      items: [item],
    });
    await localApiRequest(baseUrl, `/local/meals/${hiddenMeal.id}/publish`, handle, "POST", {
      expected_version: hiddenMeal.version,
    });
  }
  return { owner, meal };
}

async function seedParentLearning(baseUrl) {
  const parent = await createLocalProfile(baseUrl, "parent-alpha");
  const owner = await createLocalProfile(baseUrl, "owner-east");
  const currentBindings = await localApiRequest(baseUrl, "/local/binding-applications", parent);
  let approved = currentBindings.find(
    (row) => row.studentLabel === "示例学生甲" && row.status === "APPROVED",
  );
  if (!approved) {
    approved = await localApiRequest(baseUrl, "/local/binding-applications", parent, "POST", {
      student: "student-alpha",
      relationship: "GUARDIAN",
    });
    await localApiRequest(
      baseUrl,
      "/local/binding-applications/" + encodeURIComponent(approved.id) + "/review",
      owner,
      "POST",
      { version: approved.version, action: "approve" },
    );
  }
  await localApiRequest(baseUrl, "/local/binding-applications", parent, "POST", {
    student: "student-beta",
    relationship: "GUARDIAN",
  });
  const session = await localApiRequest(baseUrl, "/local/learning-sessions", parent, "POST", {
    studentId: approved.studentId,
    questionId: "math-grade-3-addition-01",
    consentVersion: "LEARNING_DEMO_V2",
    durationMinutes: 10,
  });
  for (const [itemId, choice] of [
    ["main", "B"],
    ["practice-1", "A"],
    ["practice-2", "B"],
  ]) {
    await localApiRequest(
      baseUrl,
      "/local/learning-sessions/" + encodeURIComponent(session.id) + "/answer",
      parent,
      "POST",
      { itemId, choice },
    );
  }
}

async function seedParentCare(baseUrl) {
  const teacher = await createLocalProfile(baseUrl, "teacher-east");
  const owner = await createLocalProfile(baseUrl, "owner-east");
  const values = {
    arrival: "ARRIVED_AS_PLANNED",
    homework: "COMPLETED",
    meal: "FINISHED",
    rest: "RESTED",
    activity: "PARTICIPATED",
    wellbeing: "ROUTINE",
  };
  let record = await localApiRequest(baseUrl, "/local/care-records", teacher, "POST", {
    student: "student-alpha",
    date: "2026-10-15",
    values,
  });
  for (const [handle, action, extra] of [
    [teacher, "submit", {}],
    [owner, "review", { action: "confirm" }],
    [owner, "publish", {}],
  ]) {
    record = await localApiRequest(
      baseUrl,
      `/local/care-records/${record.id}/${action}`,
      handle,
      "POST",
      {
        version: record.version,
        ...extra,
      },
    );
  }
  await localApiRequest(baseUrl, "/local/care-records", teacher, "POST", {
    student: "student-alpha",
    date: "2026-10-14",
    values,
  });
  return { owner, record };
}

async function seedParentMessage(
  baseUrl,
  resource,
  teacher,
  owner,
  { bindingId, stage = "CONFIRMED" } = {},
) {
  let record = await localApiRequest(
    baseUrl,
    "/local/" + resource,
    teacher,
    "POST",
    resource === "notices"
      ? { template: "CLASS_ACTIVITY" }
      : {
          bindingId,
          student: "student-alpha",
          observationCode: "URGENT_REVIEW",
          dispositionCode: "OBSERVATION_RECHECKED",
        },
  );
  if (stage === "DRAFT") return record;
  for (const [handle, action, extra] of [
    [teacher, "submit", {}],
    [owner, "review", { action: "CONFIRM" }],
    ...(stage === "PUBLISHED"
      ? [
          [
            owner,
            "publish",
            resource === "health-incidents" ? { summaryCode: "FOLLOW_UP_IN_PROGRESS" } : {},
          ],
        ]
      : []),
  ]) {
    record = await localApiRequest(
      baseUrl,
      `/local/${resource}/${record.id}/${action}`,
      handle,
      "POST",
      {
        version: record.version,
        ...extra,
      },
    );
  }
  return record;
}

async function waitForParentMessage(page, state, row, receipt, id) {
  await waitForExpression(
    page,
    `document.querySelector('[data-parent-${state}-state]')?.dataset.${state === "notices" ? "parentNoticesState" : "parentHealthState"} === 'READY' && ${
      receipt === null
        ? `document.querySelectorAll('[data-parent-${row}-row]').length === 0`
        : `document.querySelector('[data-parent-${row}-row][data-record-id="${id}"]')?.dataset.receipt === '${receipt}'`
    }`,
    "家长" + state + "面板没有完成更新：" + (receipt ?? "空列表"),
  );
}

async function clickMealRefresh(page) {
  const point = await evaluate(
    page,
    "(() => { const button=Array.from(document.querySelectorAll('[data-public-meals-state] button')).find((item)=>item.textContent.trim()==='刷新食谱'); if(!button||button.disabled)return null; button.scrollIntoView({block:'center'}); const rect=button.getBoundingClientRect(); return {x:rect.left+rect.width/2,y:rect.top+rect.height/2}; })()",
  );
  assert.ok(point, "食谱页面必须提供可点击的刷新食谱按钮。");
  await page.send("Input.dispatchMouseEvent", { type: "mouseMoved", ...point });
  await page.send("Input.dispatchMouseEvent", {
    type: "mousePressed",
    button: "left",
    clickCount: 1,
    ...point,
  });
  await page.send("Input.dispatchMouseEvent", {
    type: "mouseReleased",
    button: "left",
    clickCount: 1,
    ...point,
  });
}

test("Next visitor routes, public meals, local contact flow, and responsive browser behavior", async (t) => {
  const harness = await startNextBrowser(t, { repositoryRoot });
  const { baseUrl, apiBaseUrl } = harness;
  let pageCdp;
  const rootRedirect = await fetch(baseUrl + "/", { redirect: "manual" });
  assert.equal(rootRedirect.status, 307, "根地址应转到访客首页。\n" + harness.nextOutput);
  assert.equal(rootRedirect.headers.get("location"), "/visitor");

  const expectedPages = [
    "/web/parent/home",
    "/visitor",
    "/web/visitor/home",
    "/web/parent/binding",
    "/web/parent/learning",
    "/web/visitor/institution",
    "/web/visitor/day-flow",
    ...routeTitles.map(([path]) => path),
  ];
  for (const path of expectedPages) {
    const response = await fetch(baseUrl + path);
    const body = await response.text();
    assert.equal(response.status, 200, path + "\n" + harness.nextOutput);
    assert.match(body, /同芯学园/u, path);
    assert.doesNotMatch(body, /模拟私密记录|模拟草稿预览/u, path);
  }
  const missingPage = await fetch(baseUrl + "/visitor/content/not-published");
  const missingPageBody = await missingPage.text();
  assert.equal(missingPage.status, 200, "未配置公开内容接口时应显示可用性提示。");
  assert.match(missingPageBody, /访客内容暂不可用/u);
  assert.doesNotMatch(missingPageBody, /模拟私密记录|模拟草稿预览/u);

  const requests = [];
  const pageErrors = [];
  const failedResponses = [];
  const failedLoads = [];
  const publicMealRequests = [];
  const injectedMealFailures = new Set();
  const careReceiptRequests = [];
  const injectedCareFailures = new Set();
  const parentMessageWrites = [];
  const injectedMessageFailures = new Map();
  let holdNextMealRequest = false;
  let pausedMealRequest;
  let holdNextCareRequest = false;
  let pausedCareRequest;
  let holdMessageUrl = null;
  let pausedMessageRequest;
  pageCdp = await harness.connectPage((method, params) => {
    if (method === "Network.requestWillBeSent") {
      requests.push(params.request.url);
      if (new URL(params.request.url).pathname === "/local/public-meals")
        publicMealRequests.push(params.request);
      if (
        /^\/local\/care-records\/[0-9a-f-]{36}\/receipt$/iu.test(
          new URL(params.request.url).pathname,
        )
      )
        careReceiptRequests.push(params.request);
      if (
        /^\/local\/(notices|health-incidents)\/[0-9a-f-]{36}\/(read|ack)$/iu.test(
          new URL(params.request.url).pathname,
        )
      )
        parentMessageWrites.push(params.request);
    }
    if (method === "Network.responseReceived" && params.response?.status >= 400)
      failedResponses.push({
        requestId: params.requestId,
        url: params.response.url,
        status: params.response.status,
      });
    if (method === "Network.loadingFailed") failedLoads.push(params.errorText ?? "请求失败");
    if (method === "Runtime.exceptionThrown")
      pageErrors.push(params.exceptionDetails?.text ?? "网页运行错误");
    if (method === "Log.entryAdded" && params.entry?.level === "error")
      pageErrors.push(params.entry.text);
    if (method === "Fetch.requestPaused") {
      if (holdNextMealRequest) {
        holdNextMealRequest = false;
        pausedMealRequest = params;
      } else if (holdNextCareRequest) {
        holdNextCareRequest = false;
        pausedCareRequest = params;
      } else if (holdMessageUrl === params.request.url) {
        holdMessageUrl = null;
        pausedMessageRequest = params;
      } else {
        void pageCdp
          .send("Fetch.continueRequest", { requestId: params.requestId })
          .catch((error) => {
            pageErrors.push(error.message);
          });
      }
    }
  });

  const careFixtures = await seedParentCare(apiBaseUrl);
  let currentCareRecord = careFixtures.record;
  const careUrl = baseUrl + "/local/care-records";
  const messageTeacher = await createLocalProfile(apiBaseUrl, "teacher-east");
  const otherMessageParent = await createLocalProfile(apiBaseUrl, "parent-beta");
  const otherMessageOwner = await createLocalProfile(apiBaseUrl, "owner-west");
  const otherPendingBinding = await localApiRequest(
    apiBaseUrl,
    "/local/binding-applications",
    otherMessageParent,
    "POST",
    {
      student: "student-alpha",
      relationship: "GUARDIAN",
    },
  );
  const otherMessageBinding = await localApiRequest(
    apiBaseUrl,
    `/local/binding-applications/${otherPendingBinding.id}/review`,
    careFixtures.owner,
    "POST",
    {
      version: otherPendingBinding.version,
      action: "approve",
    },
  );
  const initialNotice = await seedParentMessage(
    apiBaseUrl,
    "notices",
    messageTeacher,
    careFixtures.owner,
    { stage: "PUBLISHED" },
  );
  const otherNotice = await seedParentMessage(
    apiBaseUrl,
    "notices",
    otherMessageOwner,
    otherMessageOwner,
    { stage: "PUBLISHED" },
  );
  const otherHealth = await seedParentMessage(
    apiBaseUrl,
    "health-incidents",
    messageTeacher,
    careFixtures.owner,
    { bindingId: otherMessageBinding.id, stage: "PUBLISHED" },
  );
  await seedParentMessage(apiBaseUrl, "notices", messageTeacher, careFixtures.owner, {
    stage: "DRAFT",
  });
  const parentMessages = [
    {
      resource: "notices",
      state: "notices",
      row: "notice",
      record: await seedParentMessage(apiBaseUrl, "notices", messageTeacher, careFixtures.owner),
    },
    { resource: "health-incidents", state: "health", row: "health", record: null },
  ];
  await navigate(
    pageCdp,
    baseUrl + "/web/parent/home",
    "document.querySelector('section[data-parent-care-state]')",
  );
  await waitForExpression(
    pageCdp,
    "document.querySelector('[data-parent-care-state]')?.dataset.parentCareState === 'READY'",
    "家长首页尚未连接本机成长记录服务。",
  );
  assert.equal(
    await evaluate(pageCdp, "document.querySelector('h1')?.textContent.trim()"),
    "家长首页",
  );
  for (const selector of ["[data-parent-notices-state]", "[data-parent-health-state]"]) {
    assert.equal(
      await evaluate(pageCdp, `document.querySelector(${JSON.stringify(selector)}) !== null`),
      true,
      "家长首页必须提供已迁移的通知与健康面板：" + selector,
    );
  }
  for (const panel of parentMessages)
    await waitForParentMessage(pageCdp, panel.state, panel.row, null);
  assert.equal(
    await evaluate(pageCdp, "document.querySelectorAll('article[data-parent-care-row]').length"),
    0,
    "没有已批准绑定时，家长首页不能显示成长记录。",
  );

  await navigate(
    pageCdp,
    baseUrl + "/web/visitor/home",
    "document.querySelector('#visitor-home-heading')",
  );
  assert.match(await evaluate(pageCdp, "document.body.innerText"), /让成长从放学后继续发生/u);
  assert.equal(
    await evaluate(pageCdp, "document.querySelector('link[rel=icon]')?.getAttribute('href')"),
    "/assets/tongxin-logo.png",
    "网页应使用项目现有品牌图标。",
  );
  await waitForExpression(
    pageCdp,
    "document.querySelector('[data-contact-intent-ready=\"true\"]')",
    "联系表单还未完成初始化。",
  );

  const requestsBeforeContactPreparation = requests.length;
  const contactPreparationImageCount = await evaluate(pageCdp, "document.images.length");
  for (let index = 0; index < contactPreparationImageCount; index += 1) {
    await evaluate(
      pageCdp,
      `document.images[${index}].scrollIntoView({block:'center',behavior:'instant'})`,
    );
    await waitForExpression(
      pageCdp,
      `document.images[${index}]?.complete && document.images[${index}].naturalWidth > 0`,
      `联系表单准备时，第 ${index + 1} 张图片未能正常加载。`,
    );
  }
  await waitForExpression(
    pageCdp,
    "document.fonts.status === 'loaded'",
    "联系表单准备时，页面字体尚未加载完成。",
  );
  await evaluate(
    pageCdp,
    "document.querySelector('[data-contact-intent-form]').scrollIntoView({block:'center',behavior:'instant'})",
  );
  await waitForExpression(
    pageCdp,
    "(() => {const form=document.querySelector('[data-contact-intent-form]');if(!form)return false;const rect=form.getBoundingClientRect();const style=getComputedStyle(form);return rect.width>0&&rect.height>0&&rect.top>=0&&rect.bottom<=innerHeight&&rect.left>=0&&rect.right<=innerWidth&&style.display!=='none'&&style.visibility==='visible';})()",
    "联系表单准备完成后必须位于可见区域。",
  );
  const contactPreparationRequests = requests
    .slice(requestsBeforeContactPreparation)
    .map((value) => {
      const url = new URL(value);
      return {
        pathname: /^https?:$/u.test(url.protocol)
          ? url.pathname.slice(0, 120)
          : `[${url.protocol}]`,
        allowed:
          url.origin === baseUrl &&
          (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/_next/static/")),
      };
    });
  assert.ok(
    contactPreparationRequests.every((request) => request.allowed),
    "联系表单准备期间只能加载同源静态资源。新增路径：" +
      JSON.stringify(contactPreparationRequests.map((request) => request.pathname)),
  );
  const requestsBeforeContactSubmit = requests.length;
  await evaluate(pageCdp, "document.querySelector('#contact-intent-submit').click()");
  await waitForExpression(
    pageCdp,
    "document.querySelector('[role=\"alert\"]')?.textContent.includes('请填写模拟称呼')",
    "空表单未显示校验提示。",
  );
  const formFill =
    "(() => { const input=document.querySelector('#contact-intent-name'); const select=document.querySelector('#contact-intent-topic'); const inputSet=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; const selectSet=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set; inputSet.call(input,'虚构家长'); input.dispatchEvent(new Event('input',{bubbles:true})); selectSet.call(select,'care'); select.dispatchEvent(new Event('change',{bubbles:true})); document.querySelector('#contact-intent-submit').click(); return true; })()";
  await evaluate(pageCdp, formFill);
  await waitForExpression(
    pageCdp,
    "document.body.innerText.includes('已收到你的模拟意向')",
    "有效表单没有显示本机确认。",
  );
  assert.equal(
    requests.length,
    requestsBeforeContactSubmit,
    "联系表单提交不能发出本机或外部网络请求。新增请求：" +
      JSON.stringify(
        requests.slice(requestsBeforeContactSubmit).map((value) => {
          const url = new URL(value);
          return {
            pathname: /^https?:$/u.test(url.protocol)
              ? url.pathname.slice(0, 120)
              : `[${url.protocol}]`,
            sameOrigin: url.origin === baseUrl,
          };
        }),
      ),
  );
  const localState = await evaluate(
    pageCdp,
    "JSON.stringify({local:localStorage.length,session:sessionStorage.length,url:location.href})",
  );
  assert.deepEqual(JSON.parse(localState), {
    local: 0,
    session: 0,
    url: baseUrl + "/web/visitor/home",
  });
  await evaluate(pageCdp, "window.scrollTo(0, 0)");
  await waitForExpression(pageCdp, "window.scrollY === 0", "截图前未能返回页面顶部。");

  await pageCdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1365,
    height: 950,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await waitForExpression(
    pageCdp,
    "document.documentElement.scrollWidth <= window.innerWidth",
    "桌面宽度出现横向溢出。",
  );
  await mkdir(join(artifactsRoot, "screenshots"), { recursive: true });
  await capture(pageCdp, join(artifactsRoot, "screenshots/visitor-desktop.png"));

  await pageCdp.send("Emulation.setDeviceMetricsOverride", {
    width: 320,
    height: 900,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await waitForExpression(
    pageCdp,
    "document.documentElement.scrollWidth <= window.innerWidth",
    "手机宽度出现横向溢出。",
  );
  await capture(pageCdp, join(artifactsRoot, "screenshots/visitor-mobile.png"));
  const menuToggle = await evaluate(pageCdp, "document.querySelector('.menu-toggle') !== null");
  assert.equal(menuToggle, true, "手机页面必须提供导航菜单按钮。");
  await evaluate(pageCdp, "document.querySelector('.menu-toggle').click()");
  await waitForExpression(
    pageCdp,
    "document.querySelector('.site-navigation')?.dataset.open !== undefined",
    "手机导航菜单没有展开。",
  );
  const menuVisible = await evaluate(
    pageCdp,
    "(() => { const nav=document.querySelector('.site-navigation'); const style=getComputedStyle(nav); const rect=nav.getBoundingClientRect(); const intersectsViewport=rect.bottom>0&&rect.top<window.innerHeight&&rect.right>0&&rect.left<window.innerWidth; return document.querySelector('.menu-toggle')?.getAttribute('aria-expanded') === 'true' && style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0 && rect.width > 0 && rect.height > 0 && intersectsViewport; })()",
  );
  assert.equal(menuVisible, true, "手机导航展开后必须在屏幕上可见。");
  await pageCdp.send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 900,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await waitForExpression(
    pageCdp,
    "document.documentElement.scrollWidth <= window.innerWidth",
    "390 像素手机宽度出现横向溢出。",
  );
  await evaluate(
    pageCdp,
    "setTimeout(() => document.querySelector('#site-navigation a[href=\"/web/visitor/institution\"]').click(), 50); true",
  );
  await waitForExpression(
    pageCdp,
    "location.pathname === '/web/visitor/institution' && document.querySelector('#institution-heading')",
    "手机导航没有打开机构介绍页面。",
  );

  for (const [path, title] of routeTitles) {
    await navigate(pageCdp, baseUrl + path, "document.querySelector('#visitor-content-heading')");
    assert.equal(
      await evaluate(
        pageCdp,
        "document.querySelector('#visitor-content-heading').textContent.trim()",
      ),
      title,
      path,
    );
  }

  const mealDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const mealUrl = baseUrl + "/local/public-meals?date=" + mealDate;
  const mealFixtures = await seedPublicMeals(apiBaseUrl, mealDate);
  let currentMeal = mealFixtures.meal;
  await navigate(
    pageCdp,
    baseUrl + "/visitor/content/meal-plan",
    "document.querySelector('[data-public-meals-state]')",
  );
  await waitForExpression(
    pageCdp,
    "document.querySelector('[data-public-meals-state]')?.dataset.publicMealsState === 'READY'",
    "公开食谱尚未连接本机服务。",
  );
  assert.equal(
    await evaluate(
      pageCdp,
      "document.querySelector('[data-public-meals-date]')?.dataset.publicMealsDate",
    ),
    mealDate,
    "食谱必须显示 Asia/Shanghai 的今天日期。",
  );
  const emptyMealText = await evaluate(
    pageCdp,
    "document.querySelector('[data-public-meals-state]').innerText",
  );
  assert.match(emptyMealText, /本日暂无已发布餐食。/u);
  assert.doesNotMatch(
    emptyMealText,
    /模拟当日米饭|模拟当日青菜|模拟其他日期菜品|模拟其他校区菜品/u,
  );
  assert.equal(
    await evaluate(pageCdp, "document.querySelector('[data-public-meals-state] input[type=date]')"),
    null,
    "本批次食谱只显示今天，不提供日期选择器。",
  );
  const emptyPublicMeals = await fetch(mealUrl);
  assert.equal(emptyPublicMeals.status, 200);
  assert.deepEqual(
    await emptyPublicMeals.json(),
    [],
    "草稿、其他日期和其他校区不能出现在今天的公开食谱中。",
  );

  for (const query of [
    "",
    "?date=",
    "?date=invalid",
    "?date=2026-02-30",
    "?date=2026-1-01",
    `?date=${mealDate}&date=${mealDate}`,
    `?date=${mealDate}&tenant_id=untrusted`,
    `?date=${mealDate}&campus_id=untrusted`,
    `?date=${mealDate}&extra=1`,
  ]) {
    const response = await fetch(baseUrl + "/local/public-meals" + query);
    assert.equal(response.status, 400, "公开食谱只能接受一个有效的 date 参数：" + query);
  }
  for (const method of ["POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]) {
    const response = await fetch(mealUrl, {
      method,
      ...(["POST", "PUT", "PATCH"].includes(method)
        ? { headers: { "content-type": "application/json" }, body: "{}" }
        : {}),
    });
    assert.ok(
      [404, 405].includes(response.status),
      `公开食谱必须拒绝 ${method}：${response.status}`,
    );
  }
  for (const path of [
    "session",
    "binding-applications",
    "consent-policies",
    "consents",
    "privacy-requests",
    "learning-sessions",
    "learning-parent-controls",
    "learning-knowledge",
  ]) {
    const response = await fetch(`${baseUrl}/local/${path}?date=${mealDate}`);
    assert.equal(response.status, 400, "家长代理仍须拒绝额外查询参数：" + path);
  }

  currentMeal = await localApiRequest(
    apiBaseUrl,
    `/local/meals/${currentMeal.id}/publish`,
    mealFixtures.owner,
    "POST",
    { expected_version: currentMeal.version },
  );
  const requestsBeforePublishRefresh = publicMealRequests.length;
  await clickMealRefresh(pageCdp);
  await waitForExpression(
    pageCdp,
    "document.querySelector('[data-public-meals-state]')?.dataset.publicMealsState === 'READY' && document.querySelector('[data-public-meals-state]').innerText.includes('模拟当日米饭')",
    "发布后点击刷新没有显示今天的食谱。",
  );
  assert.equal(
    publicMealRequests.length,
    requestsBeforePublishRefresh + 1,
    "一次刷新应读取一次公开食谱。",
  );
  const publishedMealText = await evaluate(
    pageCdp,
    "document.querySelector('[data-public-meals-state]').innerText",
  );
  assert.match(publishedMealText, /模拟当日青菜/u);
  assert.match(publishedMealText, /模拟数据/u);
  assert.doesNotMatch(
    publishedMealText,
    /本日暂无已发布餐食|模拟其他日期菜品|模拟其他校区菜品|模拟食谱内部备注不可公开/u,
  );
  const publishedResponse = await fetch(mealUrl);
  assert.equal(publishedResponse.status, 200);
  const publishedMeals = await publishedResponse.json();
  assert.equal(publishedMeals.length, 1);
  assert.equal(publishedMeals[0].id, currentMeal.id);
  assert.deepEqual(Object.keys(publishedMeals[0]).sort(), [
    "id",
    "items",
    "meal_date",
    "meal_type",
    "notes",
    "published_at",
  ]);
  assert.doesNotMatch(
    JSON.stringify(publishedMeals),
    /private_notes|tenant_id|campus_id|version|模拟食谱内部备注不可公开/u,
  );
  for (const width of [1365, 390, 320]) {
    await pageCdp.send("Emulation.setDeviceMetricsOverride", {
      width,
      height: width === 1365 ? 950 : 900,
      deviceScaleFactor: 1,
      mobile: width !== 1365,
    });
    await evaluate(pageCdp, "window.scrollTo(0,0)");
    await waitForExpression(
      pageCdp,
      "window.scrollY === 0 && document.documentElement.scrollWidth <= window.innerWidth",
      `公开食谱 ${width} 像素宽度出现横向溢出。`,
    );
    if (width !== 320)
      await capture(
        pageCdp,
        join(artifactsRoot, `screenshots/meals-${width === 1365 ? "desktop" : "mobile"}.png`),
      );
  }

  await pageCdp.send("Fetch.enable", {
    patterns: [{ urlPattern: mealUrl, requestStage: "Request" }],
  });
  holdNextMealRequest = true;
  await clickMealRefresh(pageCdp);
  for (let attempt = 0; attempt < 80 && !pausedMealRequest; attempt += 1) await delay(100);
  assert.ok(pausedMealRequest, "必须只拦截本次食谱刷新请求。");
  assert.equal(pausedMealRequest.request.url, mealUrl);
  assert.equal(pausedMealRequest.request.method, "GET");
  assert.ok(pausedMealRequest.networkId);
  await waitForExpression(
    pageCdp,
    "document.querySelector('[data-public-meals-state]')?.dataset.publicMealsState === 'LOADING'",
    "刷新等待时必须显示加载状态。",
  );
  assert.doesNotMatch(
    await evaluate(pageCdp, "document.querySelector('[data-public-meals-state]').innerText"),
    /模拟当日米饭|模拟当日青菜/u,
    "刷新读取期间必须清掉旧菜单。",
  );
  assert.equal(
    await evaluate(
      pageCdp,
      "Array.from(document.querySelectorAll('[data-public-meals-state] button')).find((item)=>item.textContent.trim()==='刷新食谱')?.disabled",
    ),
    true,
    "食谱加载期间必须禁用刷新按钮。",
  );
  injectedMealFailures.add(pausedMealRequest.networkId);
  await pageCdp.send("Fetch.fulfillRequest", {
    requestId: pausedMealRequest.requestId,
    responseCode: 503,
    responseHeaders: [{ name: "content-type", value: "application/json" }],
    body: Buffer.from(JSON.stringify({ error: { code: "LOCAL_SYNTHETIC_UNAVAILABLE" } })).toString(
      "base64",
    ),
  });
  await pageCdp.send("Fetch.disable");
  await waitForExpression(
    pageCdp,
    "document.querySelector('[data-public-meals-state]')?.dataset.publicMealsState === 'ERROR'",
    "公开食谱读取失败时没有显示错误状态。",
  );
  const failedMealText = await evaluate(
    pageCdp,
    "document.querySelector('[data-public-meals-state]').innerText",
  );
  assert.match(failedMealText, /暂时无法读取食谱，请稍后重试。/u);
  assert.doesNotMatch(failedMealText, /模拟当日米饭|模拟当日青菜/u, "读取失败不能保留旧菜单。");
  await clickMealRefresh(pageCdp);
  await waitForExpression(
    pageCdp,
    "document.querySelector('[data-public-meals-state]')?.dataset.publicMealsState === 'READY' && document.querySelector('[data-public-meals-state]').innerText.includes('模拟当日米饭')",
    "错误后重试没有恢复本日公开食谱。",
  );
  currentMeal = await localApiRequest(
    apiBaseUrl,
    `/local/meals/${currentMeal.id}/unpublish`,
    mealFixtures.owner,
    "POST",
    { expected_version: currentMeal.version },
  );
  assert.equal(currentMeal.status, "UNPUBLISHED");
  await clickMealRefresh(pageCdp);
  await waitForExpression(
    pageCdp,
    "document.querySelector('[data-public-meals-state]')?.dataset.publicMealsState === 'READY' && document.querySelector('[data-public-meals-state]').innerText.includes('本日暂无已发布餐食。')",
    "下架后刷新仍然显示旧食谱。",
  );
  assert.doesNotMatch(
    await evaluate(pageCdp, "document.querySelector('[data-public-meals-state]').innerText"),
    /模拟当日米饭|模拟当日青菜|模拟其他日期菜品|模拟其他校区菜品/u,
  );
  assert.ok(publicMealRequests.length >= 5);
  for (const request of publicMealRequests) {
    assert.equal(request.url, mealUrl, "页面只能请求今天的本机公开食谱。");
    assert.equal(request.method, "GET");
    assert.ok(
      !Object.keys(request.headers).some((name) => /^(authorization|cookie)$/iu.test(name)),
      "公开食谱请求不能携带身份凭据。",
    );
  }

  await navigate(
    pageCdp,
    baseUrl + "/web/visitor/institution",
    "document.querySelector('#institution-heading')",
  );
  await navigate(
    pageCdp,
    baseUrl + "/web/visitor/day-flow",
    "document.querySelector('#day-flow-heading')",
  );

  await navigate(
    pageCdp,
    baseUrl + "/web/parent/binding",
    "document.querySelector('[data-parent-binding-state]')",
  );
  await waitForExpression(
    pageCdp,
    "document.querySelector('[data-parent-binding-state]')?.dataset.parentBindingState === 'READY'",
    "家长关系页面尚未连接本机服务。",
  );
  assert.equal(
    await evaluate(
      pageCdp,
      "document.querySelector('[data-parent-binding-state]')?.dataset.bindingStatus",
    ),
    "NONE",
    "新家长应先看到尚未申请状态。",
  );
  await evaluate(pageCdp, "document.querySelector('[data-parent-binding-submit]').click()");
  await waitForExpression(
    pageCdp,
    "document.querySelector('[data-parent-binding-state]')?.dataset.bindingStatus === 'PENDING'",
    "关系申请后没有显示待审核状态。",
  );
  assert.match(await evaluate(pageCdp, "document.body.innerText"), /示例学生甲|待机构审核/u);
  await pageCdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1365,
    height: 950,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await capture(pageCdp, join(artifactsRoot, "screenshots/binding-pending.png"));

  await clickParentControl(pageCdp, 'main a[href="/web/parent/home"]');
  await waitForExpression(
    pageCdp,
    "location.pathname === '/web/parent/home' && document.querySelector('[data-parent-care-state]')?.dataset.parentCareState === 'READY'",
    "关系绑定页的返回入口没有打开家长首页。",
  );
  assert.equal(
    await evaluate(pageCdp, "document.querySelectorAll('article[data-parent-care-row]').length"),
    0,
    "待审核关系不能显示已经发布的成长记录。",
  );
  for (const panel of parentMessages)
    await waitForParentMessage(pageCdp, panel.state, panel.row, null);
  await localApiRequest(
    apiBaseUrl,
    `/local/notices/${initialNotice.id}/revoke`,
    careFixtures.owner,
    "POST",
    { version: initialNotice.version },
  );
  currentCareRecord = await localApiRequest(
    apiBaseUrl,
    `/local/care-records/${currentCareRecord.id}/revoke-publication`,
    careFixtures.owner,
    "POST",
    { version: currentCareRecord.version },
  );
  await clickParentControl(pageCdp, 'main a[href="/web/parent/binding"]');
  await waitForExpression(
    pageCdp,
    "location.pathname === '/web/parent/binding' && document.querySelector('[data-parent-binding-state]')?.dataset.bindingStatus === 'PENDING'",
    "家长首页的关系绑定入口不可达。",
  );

  const reviewOwner = await createLocalProfile(apiBaseUrl, "owner-east");
  const reviewParent = await createLocalProfile(apiBaseUrl, "parent-alpha");
  const pendingRows = await localApiRequest(
    apiBaseUrl,
    "/local/binding-applications",
    reviewParent,
  );
  const pending = pendingRows.find(
    (row) => row.studentLabel === "示例学生甲" && row.status === "PENDING",
  );
  assert.ok(pending, "本机审核队列中应只有刚才提交的合成关系待审。");
  await localApiRequest(
    apiBaseUrl,
    "/local/binding-applications/" + encodeURIComponent(pending.id) + "/review",
    reviewOwner,
    "POST",
    { version: pending.version, action: "approve" },
  );
  await evaluate(pageCdp, "document.querySelector('#parent-binding-refresh').click()");
  await waitForExpression(
    pageCdp,
    "document.querySelector('[data-parent-binding-state]')?.dataset.bindingStatus === 'APPROVED'",
    "关系审核通过后家长页面没有刷新为已审核。",
  );
  assert.match(await evaluate(pageCdp, "document.body.innerText"), /dataChanged=false/u);
  await evaluate(
    pageCdp,
    "document.querySelector('[data-parent-consent-confirm=LEARNING_SUPPORT]').click()",
  );
  await evaluate(
    pageCdp,
    "document.querySelector('[data-parent-consent-grant=LEARNING_SUPPORT]').click()",
  );
  await waitForExpression(
    pageCdp,
    "document.querySelector('[data-parent-consent-key=LEARNING_SUPPORT]')?.dataset.consentState === 'ACTIVE'",
    "固定用途同意状态没有保存。",
  );
  await evaluate(pageCdp, "document.querySelector('[data-parent-privacy-request=ACCESS]').click()");
  await waitForExpression(
    pageCdp,
    "document.querySelector('[data-parent-privacy-type=ACCESS]')?.dataset.requestState === 'SUBMITTED'",
    "隐私访问申请没有记录到本机队列。",
  );
  await evaluate(
    pageCdp,
    "document.querySelector('[data-parent-privacy-withdraw=ACCESS]').click()",
  );
  await waitForExpression(
    pageCdp,
    "document.querySelector('[data-parent-privacy-type=ACCESS]')?.dataset.requestState === 'WITHDRAWN'",
    "隐私申请没有显示已撤回。",
  );
  await capture(pageCdp, join(artifactsRoot, "screenshots/binding-approved.png"));
  for (const width of [390, 320]) {
    await pageCdp.send("Emulation.setDeviceMetricsOverride", {
      width,
      height: 900,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await waitForExpression(
      pageCdp,
      "document.documentElement.scrollWidth <= window.innerWidth",
      `家长关系页面 ${width} 像素宽度出现横向溢出。`,
    );
  }
  await pageCdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1365,
    height: 950,
    deviceScaleFactor: 1,
    mobile: false,
  });

  await clickParentControl(pageCdp, 'main a[href="/web/parent/home"]');
  await waitForExpression(
    pageCdp,
    "location.pathname === '/web/parent/home' && document.querySelector('[data-parent-care-state]')?.dataset.parentCareState === 'READY'",
    "已批准关系后无法返回家长首页。",
  );
  assert.equal(
    await evaluate(pageCdp, "document.querySelectorAll('article[data-parent-care-row]').length"),
    0,
    "关系已批准仍不能显示草稿或未发布的成长记录。",
  );
  const messageBinding = (
    await localApiRequest(apiBaseUrl, "/local/binding-applications", reviewParent)
  ).find((row) => row.id === pending.id && row.status === "APPROVED");
  assert.ok(messageBinding);
  parentMessages[1].record = await seedParentMessage(
    apiBaseUrl,
    "health-incidents",
    messageTeacher,
    careFixtures.owner,
    { bindingId: messageBinding.id },
  );
  await seedParentMessage(apiBaseUrl, "health-incidents", messageTeacher, careFixtures.owner, {
    bindingId: messageBinding.id,
    stage: "DRAFT",
  });
  for (const panel of parentMessages) {
    await clickParentControl(pageCdp, `[data-parent-${panel.state}-refresh]`);
    await waitForParentMessage(pageCdp, panel.state, panel.row, null);
  }
  for (const path of [
    "/local/care-records",
    ...["submit", "withdraw", "resubmit", "review", "publish", "revoke-publication"].map(
      (action) => `/local/care-records/${currentCareRecord.id}/${action}`,
    ),
    "/local/care-records/not-a-uuid/receipt",
  ]) {
    const response = await fetch(baseUrl + path, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer " + careFixtures.owner,
      },
      body: JSON.stringify({ version: currentCareRecord.version, action: "confirm" }),
    });
    assert.equal(response.status, 404, "家长代理不能开放员工成长记录操作或无效编号：" + path);
  }
  for (const path of [
    "/local/care-records?student=student-alpha",
    "/local/care-records?tenant_id=untrusted",
    "/local/care-records?campus_id=untrusted",
  ]) {
    const response = await fetch(baseUrl + path, {
      headers: { authorization: "Bearer " + reviewParent },
    });
    assert.equal(response.status, 400, "家长成长记录不能接受客户端范围筛选：" + path);
  }
  const queriedReceipt = await fetch(`${careUrl}/${currentCareRecord.id}/receipt?extra=1`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  assert.equal(queriedReceipt.status, 400, "成长记录回执不能接受额外查询参数。");
  for (const [path, methods] of [
    [careUrl, ["PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]],
    [
      `${careUrl}/${currentCareRecord.id}/receipt`,
      ["GET", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"],
    ],
    [`${careUrl}/${currentCareRecord.id}`, ["GET"]],
  ]) {
    for (const method of methods) {
      const response = await fetch(path, { method });
      assert.ok(
        [404, 405].includes(response.status),
        `成长记录代理必须拒绝 ${method} ${path}：${response.status}`,
      );
    }
  }
  for (const profile of ["teacher-east", "owner-east", "parent-beta"]) {
    const response = await fetch(baseUrl + "/local/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ profile }),
    });
    assert.equal(response.status, 403, "家长首页代理不能创建其他身份：" + profile);
  }

  currentCareRecord = await localApiRequest(
    apiBaseUrl,
    `/local/care-records/${currentCareRecord.id}/publish`,
    careFixtures.owner,
    "POST",
    { version: currentCareRecord.version },
  );
  await clickParentControl(pageCdp, "[data-parent-care-refresh]");
  await waitForExpression(
    pageCdp,
    "document.querySelector('[data-parent-care-state]')?.dataset.parentCareState === 'READY' && document.querySelector('article[data-parent-care-row]')?.dataset.receipt === 'UNREAD'",
    "单独发布后家长首页未显示未读成长记录。",
  );
  assert.equal(
    await evaluate(pageCdp, "document.querySelectorAll('article[data-parent-care-row]').length"),
    1,
  );
  assert.equal(
    await evaluate(
      pageCdp,
      "document.querySelector('article[data-parent-care-row]')?.dataset.recordId",
    ),
    currentCareRecord.id,
  );
  const careFieldValues = [
    "按计划到校",
    "已完成整理",
    "按示例完成用餐",
    "完成休息",
    "参与活动",
    "日常状态",
  ];
  const summaryText = await evaluate(
    pageCdp,
    "document.querySelector('article[data-parent-care-row]').innerText",
  );
  assert.match(summaryText, /示例学生甲/u);
  for (const value of careFieldValues)
    assert.ok(!summaryText.includes(value), "打开前只能显示摘要：" + value);
  assert.equal(
    await evaluate(
      pageCdp,
      "document.querySelector('[data-parent-care-action=acknowledge]')?.disabled ?? true",
    ),
    true,
    "家长必须先打开成长记录，才能独立确认知悉。",
  );
  const receiptUrl = `${careUrl}/${currentCareRecord.id}/receipt`;
  for (const [action, receipt] of [
    ["read", "READ"],
    ["acknowledge", "ACKNOWLEDGED"],
  ]) {
    pausedCareRequest = undefined;
    holdNextCareRequest = true;
    await pageCdp.send("Fetch.enable", {
      patterns: [{ urlPattern: receiptUrl, requestStage: "Request" }],
    });
    const requestsBeforeReceipt = careReceiptRequests.length;
    const point = await clickParentControl(pageCdp, `[data-parent-care-action=${action}]`);
    await pageCdp.send("Input.dispatchMouseEvent", {
      type: "mousePressed",
      button: "left",
      clickCount: 2,
      ...point,
    });
    await pageCdp.send("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      button: "left",
      clickCount: 2,
      ...point,
    });
    for (let attempt = 0; attempt < 80 && !pausedCareRequest; attempt += 1) await delay(100);
    assert.ok(pausedCareRequest, "必须暂挂本次真实成长记录回执请求。");
    assert.equal(pausedCareRequest.request.url, receiptUrl);
    assert.equal(pausedCareRequest.request.method, "POST");
    assert.equal(JSON.parse(pausedCareRequest.request.postData).action, action);
    await waitForExpression(
      pageCdp,
      "document.querySelector('[data-parent-care-state]')?.dataset.parentCareState === 'BUSY'",
      "成长记录回执待处理时应显示忙碌状态。",
    );
    assert.equal(
      await evaluate(
        pageCdp,
        "Array.from(document.querySelectorAll('[data-parent-care-state] button')).every((button)=>button.disabled)",
      ),
      true,
      "写入回执期间必须禁用所有成长记录按钮。",
    );
    assert.equal(
      await evaluate(pageCdp, "document.querySelector('[data-parent-care-refresh]')?.disabled"),
      true,
      "写入回执期间，刷新入口必须保持禁用。",
    );
    await delay(100);
    assert.equal(
      careReceiptRequests.length,
      requestsBeforeReceipt + 1,
      "忙碌时重复点击不能重复发送回执。",
    );
    assert.equal(
      careReceiptRequests
        .slice(requestsBeforeReceipt)
        .filter((request) => JSON.parse(request.postData).action === action).length,
      1,
      "连续点击原操作按钮只能写入一次 " + action + " 回执。",
    );
    await pageCdp.send("Fetch.continueRequest", { requestId: pausedCareRequest.requestId });
    await pageCdp.send("Fetch.disable");
    await waitForExpression(
      pageCdp,
      `document.querySelector('[data-parent-care-state]')?.dataset.parentCareState === 'READY' && document.querySelector('article[data-parent-care-row]')?.dataset.receipt === '${receipt}'`,
      "真实成长记录回执没有更新为 " + receipt,
    );
    const detailText = await evaluate(
      pageCdp,
      "document.querySelector('article[data-parent-care-row]').innerText",
    );
    for (const value of careFieldValues)
      assert.ok(detailText.includes(value), "打开后应显示固定字段：" + value);
  }
  assert.deepEqual(
    careReceiptRequests.map((request) => JSON.parse(request.postData).action),
    ["read", "acknowledge"],
  );
  const savedCare = await localApiRequest(apiBaseUrl, "/local/care-records", reviewParent);
  assert.equal(
    savedCare.find((record) => record.id === currentCareRecord.id)?.receipt,
    "ACKNOWLEDGED",
    "知悉状态必须真实保存到共享服务。",
  );
  for (const width of [1365, 390, 320]) {
    await pageCdp.send("Emulation.setDeviceMetricsOverride", {
      width,
      height: width === 1365 ? 950 : 900,
      deviceScaleFactor: 1,
      mobile: width !== 1365,
    });
    await evaluate(pageCdp, "window.scrollTo(0,0)");
    await waitForExpression(
      pageCdp,
      "window.scrollY === 0 && document.documentElement.scrollWidth <= window.innerWidth",
      `家长首页 ${width} 像素宽度出现横向溢出。`,
    );
    if (width !== 320)
      await capture(
        pageCdp,
        join(artifactsRoot, `screenshots/parent-home-${width === 1365 ? "desktop" : "mobile"}.png`),
        true,
      );
  }

  pausedCareRequest = undefined;
  holdNextCareRequest = true;
  await pageCdp.send("Fetch.enable", {
    patterns: [{ urlPattern: careUrl, requestStage: "Request" }],
  });
  await clickParentControl(pageCdp, "[data-parent-care-refresh]");
  for (let attempt = 0; attempt < 80 && !pausedCareRequest; attempt += 1) await delay(100);
  assert.ok(pausedCareRequest, "必须只拦截本次成长记录刷新请求。");
  assert.equal(pausedCareRequest.request.url, careUrl);
  assert.equal(pausedCareRequest.request.method, "GET");
  assert.ok(pausedCareRequest.networkId);
  await waitForExpression(
    pageCdp,
    "['BUSY','CONNECTING'].includes(document.querySelector('[data-parent-care-state]')?.dataset.parentCareState)",
    "成长记录刷新期间没有显示加载状态。",
  );
  assert.equal(
    await evaluate(pageCdp, "document.querySelectorAll('article[data-parent-care-row]').length"),
    0,
    "刷新期间必须清除旧成长记录。",
  );
  injectedCareFailures.add(pausedCareRequest.networkId);
  await pageCdp.send("Fetch.fulfillRequest", {
    requestId: pausedCareRequest.requestId,
    responseCode: 503,
    responseHeaders: [{ name: "content-type", value: "application/json" }],
    body: Buffer.from(JSON.stringify({ error: { code: "LOCAL_SYNTHETIC_UNAVAILABLE" } })).toString(
      "base64",
    ),
  });
  await pageCdp.send("Fetch.disable");
  await waitForExpression(
    pageCdp,
    "document.querySelector('[data-parent-care-state]')?.dataset.parentCareState === 'ERROR'",
    "成长记录读取失败后没有显示错误状态。",
  );
  assert.equal(
    await evaluate(pageCdp, "document.querySelectorAll('article[data-parent-care-row]').length"),
    0,
    "读取失败不能保留旧成长记录。",
  );
  assert.match(
    await evaluate(pageCdp, "document.querySelector('[data-parent-care-state]').innerText"),
    /未能|不可用|失败|重试/u,
  );
  await clickParentControl(pageCdp, "[data-parent-care-refresh]");
  await waitForExpression(
    pageCdp,
    "document.querySelector('[data-parent-care-state]')?.dataset.parentCareState === 'READY' && document.querySelector('article[data-parent-care-row]')?.dataset.receipt === 'ACKNOWLEDGED'",
    "读取失败后重试没有恢复真实成长记录与回执。",
  );
  currentCareRecord = await localApiRequest(
    apiBaseUrl,
    `/local/care-records/${currentCareRecord.id}/revoke-publication`,
    careFixtures.owner,
    "POST",
    { version: currentCareRecord.version },
  );
  await clickParentControl(pageCdp, "[data-parent-care-refresh]");
  await waitForExpression(
    pageCdp,
    "document.querySelector('[data-parent-care-state]')?.dataset.parentCareState === 'READY' && document.querySelectorAll('article[data-parent-care-row]').length === 0",
    "撤回发布后刷新仍然显示旧成长记录。",
  );
  const revokedCareText = await evaluate(
    pageCdp,
    "document.querySelector('[data-parent-care-state]').innerText",
  );
  for (const value of careFieldValues)
    assert.ok(!revokedCareText.includes(value), "撤回发布后不能残留详情：" + value);

  for (const path of [
    "notice-owned",
    "notice-review",
    "health-incident-owned",
    "health-incident-review",
  ]) {
    const response = await fetch(`${baseUrl}/local/${path}`, {
      headers: { authorization: "Bearer " + careFixtures.owner },
    });
    assert.equal(response.status, 404, "家长代理不能开放员工通知或健康队列：" + path);
  }
  for (const panel of parentMessages) {
    const listUrl = `${baseUrl}/local/${panel.resource}`;
    for (const path of [
      `/local/${panel.resource}`,
      ...["submit", "edit", "withdraw", "review", "publish", "revoke", "supplement"].map(
        (action) => `/local/${panel.resource}/${panel.record.id}/${action}`,
      ),
      `/local/${panel.resource}/not-a-uuid/read`,
      `/local/${panel.resource}/00000000-0000-0000-0000-000000000000/ack`,
    ]) {
      const response = await fetch(baseUrl + path, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer " + careFixtures.owner,
        },
        body: JSON.stringify({ version: panel.record.version }),
      });
      assert.equal(response.status, 404, "家长代理不得开放通知/健康员工操作或非法编号：" + path);
    }
    for (const query of [
      "?tenant_id=untrusted",
      "?campus_id=untrusted",
      "?extra=1",
      "?version=1&version=2",
    ]) {
      const response = await fetch(listUrl + query, {
        headers: { authorization: "Bearer " + reviewParent },
      });
      assert.equal(response.status, 400, "通知/健康列表不允许客户端查询筛选：" + query);
      const writeResponse = await fetch(`${listUrl}/${panel.record.id}/read${query}`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: "Bearer " + reviewParent },
        body: JSON.stringify({ version: panel.record.version }),
      });
      assert.equal(writeResponse.status, 400, "通知/健康回执不允许额外查询：" + query);
    }
    for (const [url, methods] of [
      [listUrl, ["PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]],
      [`${listUrl}/${panel.record.id}/read`, ["GET", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]],
      [`${listUrl}/${panel.record.id}/ack`, ["GET", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]],
      [`${listUrl}/${panel.record.id}`, ["GET"]],
    ]) {
      for (const method of methods) {
        const response = await fetch(url, { method });
        assert.ok(
          [404, 405].includes(response.status),
          `通知/健康代理必须拒绝 ${method} ${url}：${response.status}`,
        );
      }
    }
    panel.record = await localApiRequest(
      apiBaseUrl,
      `/local/${panel.resource}/${panel.record.id}/publish`,
      careFixtures.owner,
      "POST",
      {
        version: panel.record.version,
        ...(panel.resource === "health-incidents" ? { summaryCode: "FOLLOW_UP_IN_PROGRESS" } : {}),
      },
    );
    if (panel.resource === "health-incidents") {
      assert.equal(panel.record.bindingId, messageBinding.id);
      assert.equal(panel.record.bindingVersion, messageBinding.version);
    }
    await clickParentControl(pageCdp, `[data-parent-${panel.state}-refresh]`);
    await waitForParentMessage(pageCdp, panel.state, panel.row, "UNREAD", panel.record.id);
    assert.equal(
      await evaluate(pageCdp, `document.querySelectorAll('[data-parent-${panel.row}-row]').length`),
      1,
      "只显示当前家长范围内一条已发布记录。",
    );
    for (const hiddenId of [initialNotice.id, otherNotice.id, otherHealth.id]) {
      assert.equal(
        await evaluate(
          pageCdp,
          `document.querySelector('[data-record-id="${hiddenId}"]') !== null`,
        ),
        false,
        "撤回或其他范围内容不得出现在DOM。",
      );
    }
    const publishedRows = await localApiRequest(
      apiBaseUrl,
      `/local/${panel.resource}`,
      reviewParent,
    );
    const publishedRow = publishedRows.find((row) => row.id === panel.record.id);
    assert.ok(publishedRow);
    panel.detailText =
      panel.resource === "notices" ? publishedRow.body : publishedRow.parentSummary;
    assert.equal(typeof panel.detailText, "string");
    if (panel.resource === "health-incidents")
      assert.ok(
        !(
          await evaluate(pageCdp, "document.querySelector('[data-parent-health-state]').innerHTML")
        ).includes(panel.detailText),
        "健康摘要必须打开后才进入DOM。",
      );
    assert.equal(
      await evaluate(
        pageCdp,
        `document.querySelector('[data-parent-${panel.row}-action=ack]')?.disabled ?? true`,
      ),
      true,
      "未读内容不能直接确认知悉。",
    );

    for (const [action, receipt] of [
      ["read", "READ"],
      ["ack", "ACKNOWLEDGED"],
    ]) {
      const writeUrl = `${listUrl}/${panel.record.id}/${action}`;
      pausedMessageRequest = undefined;
      holdMessageUrl = writeUrl;
      await pageCdp.send("Fetch.enable", {
        patterns: [{ urlPattern: writeUrl, requestStage: "Request" }],
      });
      const beforeWrites = parentMessageWrites.length;
      const point = await clickParentControl(
        pageCdp,
        `[data-parent-${panel.row}-row][data-record-id="${panel.record.id}"] [data-parent-${panel.row}-action=${action}]`,
      );
      await pageCdp.send("Input.dispatchMouseEvent", {
        type: "mousePressed",
        button: "left",
        clickCount: 2,
        ...point,
      });
      await pageCdp.send("Input.dispatchMouseEvent", {
        type: "mouseReleased",
        button: "left",
        clickCount: 2,
        ...point,
      });
      for (let attempt = 0; attempt < 80 && !pausedMessageRequest; attempt += 1) await delay(100);
      assert.ok(pausedMessageRequest, "必须暂挂本次真实通知/健康写入请求。");
      assert.equal(pausedMessageRequest.request.url, writeUrl);
      assert.equal(pausedMessageRequest.request.method, "POST");
      assert.deepEqual(JSON.parse(pausedMessageRequest.request.postData), {
        version: panel.record.version,
      });
      await waitForExpression(
        pageCdp,
        `document.querySelector('[data-parent-${panel.state}-state]')?.getAttribute('data-parent-${panel.state}-state') === 'BUSY'`,
        "回执写入时必须显示BUSY。",
      );
      assert.equal(
        await evaluate(
          pageCdp,
          `document.querySelector('[data-parent-${panel.state}-refresh]')?.disabled`,
        ),
        true,
      );
      assert.equal(
        await evaluate(
          pageCdp,
          `Array.from(document.querySelectorAll('[data-parent-${panel.state}-state] button')).every((button)=>button.disabled)`,
        ),
        true,
      );
      await delay(100);
      assert.equal(
        parentMessageWrites.length,
        beforeWrites + 1,
        "连续点击原按钮不能重复发送通知/健康回执。",
      );
      assert.equal(
        parentMessageWrites.filter((request) => request.url === writeUrl).length,
        1,
        "每项回执仅写入一次：" + action,
      );
      await pageCdp.send("Fetch.continueRequest", { requestId: pausedMessageRequest.requestId });
      await pageCdp.send("Fetch.disable");
      await waitForParentMessage(pageCdp, panel.state, panel.row, receipt, panel.record.id);
      assert.ok(
        (
          await evaluate(
            pageCdp,
            `document.querySelector('[data-parent-${panel.row}-row][data-record-id="${panel.record.id}"]').innerText`,
          )
        ).includes(panel.detailText),
        "打开成功后显示已发布内容。",
      );
    }
    const savedRows = await localApiRequest(apiBaseUrl, `/local/${panel.resource}`, reviewParent);
    assert.equal(
      savedRows.find((row) => row.id === panel.record.id)?.receiptStatus,
      "ACKNOWLEDGED",
      "真实服务必须记录知悉。",
    );
    assert.doesNotMatch(
      await evaluate(
        pageCdp,
        `document.querySelector('[data-parent-${panel.state}-state]').innerHTML`,
      ),
      /observationCode|dispositionCode|reviewedBy|authorId|tenantId|campusId|classId|bindingId|bindingVersion|URGENT_REVIEW|OBSERVATION_RECHECKED|需要尽快复核|已重新核对观察/u,
      "员工内部观察、处置、审核或范围字段不能进入家长DOM。",
    );

    const companion = parentMessages.find((item) => item !== panel);
    const companionSnapshot = `JSON.stringify({state:document.querySelector('[data-parent-${companion.state}-state]')?.getAttribute('data-parent-${companion.state}-state'),rows:Array.from(document.querySelectorAll('[data-parent-${companion.row}-row]')).map((row)=>({id:row.dataset.recordId,receipt:row.dataset.receipt}))})`;
    const unchangedCompanion = await evaluate(pageCdp, companionSnapshot);
    pausedMessageRequest = undefined;
    holdMessageUrl = listUrl;
    await pageCdp.send("Fetch.enable", {
      patterns: [{ urlPattern: listUrl, requestStage: "Request" }],
    });
    await clickParentControl(pageCdp, `[data-parent-${panel.state}-refresh]`);
    for (let attempt = 0; attempt < 80 && !pausedMessageRequest; attempt += 1) await delay(100);
    assert.ok(pausedMessageRequest?.networkId);
    assert.equal(pausedMessageRequest.request.url, listUrl);
    assert.equal(pausedMessageRequest.request.method, "GET");
    await waitForExpression(
      pageCdp,
      `['BUSY','CONNECTING'].includes(document.querySelector('[data-parent-${panel.state}-state]')?.getAttribute('data-parent-${panel.state}-state'))`,
      "刷新时应显示加载状态。",
    );
    assert.equal(
      await evaluate(pageCdp, `document.querySelectorAll('[data-parent-${panel.row}-row]').length`),
      0,
      "刷新时必须清除旧列表。",
    );
    injectedMessageFailures.set(pausedMessageRequest.networkId, listUrl);
    await pageCdp.send("Fetch.fulfillRequest", {
      requestId: pausedMessageRequest.requestId,
      responseCode: 503,
      responseHeaders: [{ name: "content-type", value: "application/json" }],
      body: Buffer.from(
        JSON.stringify({ error: { code: "LOCAL_SYNTHETIC_UNAVAILABLE" } }),
      ).toString("base64"),
    });
    await pageCdp.send("Fetch.disable");
    await waitForExpression(
      pageCdp,
      `document.querySelector('[data-parent-${panel.state}-state]')?.getAttribute('data-parent-${panel.state}-state') === 'ERROR'`,
      "读取失败应显示ERROR。",
    );
    assert.equal(
      await evaluate(pageCdp, `document.querySelectorAll('[data-parent-${panel.row}-row]').length`),
      0,
      "失败不能残留旧列表。",
    );
    assert.ok(
      !(
        await evaluate(
          pageCdp,
          `document.querySelector('[data-parent-${panel.state}-state]').innerHTML`,
        )
      ).includes(panel.detailText),
      "失败不能残留已展开的内容。",
    );
    assert.match(
      await evaluate(
        pageCdp,
        `document.querySelector('[data-parent-${panel.state}-refresh]').innerText`,
      ),
      /重新连接/u,
    );
    assert.equal(
      await evaluate(pageCdp, companionSnapshot),
      unchangedCompanion,
      "一个面板失败不应清空另一个面板。",
    );
    assert.equal(
      await evaluate(
        pageCdp,
        "document.querySelector('[data-parent-care-state]')?.dataset.parentCareState",
      ),
      "READY",
      "新面板失败不得影响成长记录。",
    );
    await clickParentControl(pageCdp, `[data-parent-${panel.state}-refresh]`);
    await waitForParentMessage(pageCdp, panel.state, panel.row, "ACKNOWLEDGED", panel.record.id);
    assert.equal(await evaluate(pageCdp, companionSnapshot), unchangedCompanion);
  }
  assert.equal(parentMessageWrites.length, 4, "通知与健康的阅读、知悉四次写入均只能发生一次。");
  for (const width of [1365, 390, 320]) {
    await pageCdp.send("Emulation.setDeviceMetricsOverride", {
      width,
      height: width === 1365 ? 950 : 900,
      deviceScaleFactor: 1,
      mobile: width !== 1365,
    });
    await evaluate(pageCdp, "window.scrollTo({top:0,behavior:'instant'})");
    await waitForExpression(
      pageCdp,
      "window.scrollY === 0 && document.documentElement.scrollWidth <= window.innerWidth",
      `通知与健康面板 ${width} 像素宽度出现横向溢出。`,
    );
    if (width !== 320)
      await capture(
        pageCdp,
        join(
          artifactsRoot,
          `screenshots/parent-notices-health-${width === 1365 ? "desktop" : "mobile"}.png`,
        ),
        true,
      );
  }
  for (const panel of parentMessages) {
    const previousVersion = panel.record.version;
    panel.record = await localApiRequest(
      apiBaseUrl,
      `/local/${panel.resource}/${panel.record.id}/publish`,
      careFixtures.owner,
      "POST",
      {
        version: panel.record.version,
        ...(panel.resource === "health-incidents" ? { summaryCode: "FOLLOW_UP_COMPLETED" } : {}),
      },
    );
    if (panel.resource === "health-incidents") {
      assert.equal(panel.record.bindingId, messageBinding.id);
      assert.equal(panel.record.bindingVersion, messageBinding.version);
    }
    await clickParentControl(pageCdp, `[data-parent-${panel.state}-refresh]`);
    await waitForParentMessage(pageCdp, panel.state, panel.row, "UNREAD", panel.record.id);
    assert.equal(
      await evaluate(
        pageCdp,
        `document.querySelector('[data-parent-${panel.row}-action=ack]')?.disabled ?? true`,
      ),
      true,
      "新版内容不能继承旧知悉。",
    );
    const staleAck = await fetch(`${baseUrl}/local/${panel.resource}/${panel.record.id}/ack`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer " + reviewParent },
      body: JSON.stringify({ version: previousVersion }),
    });
    assert.equal(staleAck.status, 409, "旧版本知悉请求不能改变新发布内容的回执。");
    const republishedRows = await localApiRequest(
      apiBaseUrl,
      `/local/${panel.resource}`,
      reviewParent,
    );
    assert.equal(
      republishedRows.find((row) => row.id === panel.record.id)?.receiptStatus,
      "UNREAD",
    );
    if (panel.resource === "health-incidents")
      assert.doesNotMatch(
        await evaluate(pageCdp, "document.querySelector('[data-parent-health-state]').innerHTML"),
        /后续跟进正在进行。|后续跟进已完成。/u,
        "新版健康摘要未读时不能展开。",
      );
    panel.record = await localApiRequest(
      apiBaseUrl,
      `/local/${panel.resource}/${panel.record.id}/revoke`,
      careFixtures.owner,
      "POST",
      { version: panel.record.version },
    );
    assert.equal(panel.record.status, "REVOKED");
    await clickParentControl(pageCdp, `[data-parent-${panel.state}-refresh]`);
    await waitForParentMessage(pageCdp, panel.state, panel.row, null);
    assert.ok(
      !(
        await evaluate(
          pageCdp,
          `document.querySelector('[data-parent-${panel.state}-state]').innerHTML`,
        )
      ).includes(panel.detailText),
      "撤回后不能保留详情。",
    );
    panel.remainingRecord = await seedParentMessage(
      apiBaseUrl,
      panel.resource,
      messageTeacher,
      careFixtures.owner,
      { bindingId: messageBinding.id, stage: "PUBLISHED" },
    );
    await clickParentControl(pageCdp, `[data-parent-${panel.state}-refresh]`);
    await waitForParentMessage(pageCdp, panel.state, panel.row, "UNREAD", panel.remainingRecord.id);
    await clickParentControl(
      pageCdp,
      `[data-parent-${panel.row}-row][data-record-id="${panel.remainingRecord.id}"] [data-parent-${panel.row}-action=read]`,
    );
    await waitForParentMessage(pageCdp, panel.state, panel.row, "READ", panel.remainingRecord.id);
  }

  await seedParentLearning(apiBaseUrl);
  await clickParentControl(pageCdp, 'main a[href="/web/parent/learning"]');
  await waitForExpression(
    pageCdp,
    "location.pathname === '/web/parent/learning' && document.querySelector('[data-parent-learning-state]')",
    "家长首页的学习摘要入口不可达。",
  );

  await navigate(
    pageCdp,
    baseUrl + "/web/parent/learning",
    "document.querySelector('[data-parent-learning-state]')",
  );
  await waitForExpression(
    pageCdp,
    "['READY','DENIED'].includes(document.querySelector('[data-parent-learning-state]')?.dataset.parentLearningState)",
    "家长摘要尚未完成连接。" + harness.apiOutput,
  );
  const parentConnection = await evaluate(
    pageCdp,
    "JSON.stringify({state:document.querySelector('[data-parent-learning-state]')?.dataset.parentLearningState,status:document.querySelector('[data-parent-status]')?.textContent,body:document.body.innerText})",
  );
  assert.equal(
    JSON.parse(parentConnection).state,
    "READY",
    "家长摘要连接失败：" + parentConnection + "\n" + harness.nextOutput,
  );
  const parentText = await evaluate(pageCdp, "document.body.innerText");
  assert.match(parentText, /示例学生甲/u, "已审核关系的家长应看到学生甲。");
  assert.doesNotMatch(parentText, /示例学生乙/u, "待审核关系的学生乙不能出现在家长摘要中。");
  assert.match(parentText, /练习次数\s+1 次/u);
  assert.match(parentText, /已完成\s+1 次/u);
  assert.match(parentText, /两位数加法与进位/u);
  assert.match(parentText, /本机合成数据/u);
  assert.equal(
    await evaluate(
      pageCdp,
      "document.querySelector('#site-navigation a[aria-current=page]')?.getAttribute('href')",
    ),
    "/web/parent/learning",
    "导航应标记当前家长摘要页面。",
  );
  const deniedLocalProfileRoute = await evaluate(
    pageCdp,
    "fetch('/local/profiles').then((response) => response.status)",
  );
  assert.equal(deniedLocalProfileRoute, 404, "用户网页代理不得开放 profile 枚举端点。");
  const deniedStaffProfileCreation = await evaluate(
    pageCdp,
    "fetch('/local/sessions',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({profile:'owner-east'})}).then((response) => response.status)",
  );
  assert.equal(deniedStaffProfileCreation, 403, "家长摘要页面不能创建员工身份会话。");
  await mkdir(join(artifactsRoot, "screenshots"), { recursive: true });
  await pageCdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1365,
    height: 950,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await waitForExpression(
    pageCdp,
    "document.documentElement.scrollWidth <= window.innerWidth",
    "家长摘要桌面宽度出现横向溢出。",
  );
  assert.ok(
    await evaluate(pageCdp, "document.querySelector('h1').getBoundingClientRect().height <= 65"),
    "桌面标题应保持单行显示。",
  );
  await capture(pageCdp, join(artifactsRoot, "screenshots/parent-desktop.png"));
  const controlResult = await evaluate(
    pageCdp,
    "(() => { const form=document.querySelector('[data-parent-controls-form]'); if(!form)return false; const duration=form.querySelector('[name=maxDurationMinutes]'); const hints=form.querySelector('[name=maxHintLevel]'); const setDuration=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set; setDuration.call(duration,'10'); duration.dispatchEvent(new Event('change',{bubbles:true})); const setHints=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set; setHints.call(hints,'2'); hints.dispatchEvent(new Event('change',{bubbles:true})); form.querySelector('button[type=submit]').click(); return true; })()",
  );
  assert.equal(controlResult, true, "家长设置表单必须可见。");
  await waitForExpression(
    pageCdp,
    "document.querySelector('[data-parent-status]')?.textContent.includes('设置已保存')",
    "学习监督设置未能保存。",
  );
  await evaluate(pageCdp, "document.querySelector('[data-parent-contact]').click()");
  await waitForExpression(
    pageCdp,
    "document.querySelector('[data-parent-status]')?.textContent.includes('本机记录')",
    "联系意向没有明确显示为本机记录。",
  );
  assert.match(await evaluate(pageCdp, "document.body.innerText"), /尚未发送消息/u);
  await pageCdp.send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 900,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await waitForExpression(
    pageCdp,
    "document.documentElement.scrollWidth <= window.innerWidth",
    "家长摘要 390 像素宽度出现横向溢出。",
  );
  await capture(pageCdp, join(artifactsRoot, "screenshots/parent-mobile.png"));
  await pageCdp.send("Emulation.setDeviceMetricsOverride", {
    width: 320,
    height: 900,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await waitForExpression(
    pageCdp,
    "document.documentElement.scrollWidth <= window.innerWidth",
    "家长摘要 320 像素宽度出现横向溢出。",
  );
  const parentStorage = await evaluate(
    pageCdp,
    "JSON.stringify({local:localStorage.length,session:sessionStorage.length})",
  );
  assert.deepEqual(
    JSON.parse(parentStorage),
    { local: 0, session: 0 },
    "家长身份句柄不能写入浏览器存储。",
  );

  currentCareRecord = await localApiRequest(
    apiBaseUrl,
    `/local/care-records/${currentCareRecord.id}/publish`,
    careFixtures.owner,
    "POST",
    { version: currentCareRecord.version },
  );
  await clickParentControl(pageCdp, 'main a[href="/web/parent/home"]');
  await waitForExpression(
    pageCdp,
    "location.pathname === '/web/parent/home' && document.querySelector('[data-parent-care-state]')?.dataset.parentCareState === 'READY' && document.querySelector('article[data-parent-care-row]')?.dataset.receipt === 'UNREAD'",
    "学习摘要返回家长首页后应显示重新发布的记录，旧知悉不能继承。",
  );
  await clickParentControl(pageCdp, "[data-parent-care-action=read]");
  await waitForExpression(
    pageCdp,
    "document.querySelector('[data-parent-care-state]')?.dataset.parentCareState === 'READY' && document.querySelector('article[data-parent-care-row]')?.dataset.receipt === 'READ'",
    "解除关系前应能打开当前有效范围内的成长记录。",
  );
  const activeCareText = await evaluate(
    pageCdp,
    "document.querySelector('article[data-parent-care-row]').innerText",
  );
  for (const value of careFieldValues) assert.ok(activeCareText.includes(value));
  for (const panel of parentMessages) {
    await waitForParentMessage(pageCdp, panel.state, panel.row, "READ", panel.remainingRecord.id);
    assert.ok(
      (
        await evaluate(
          pageCdp,
          `document.querySelector('[data-parent-${panel.row}-row][data-record-id="${panel.remainingRecord.id}"]').innerText`,
        )
      ).includes(panel.detailText),
      "解除关系前必须实际展示已经打开的通知/健康内容。",
    );
  }
  const bindingsBeforeRelease = await localApiRequest(
    apiBaseUrl,
    "/local/binding-applications",
    reviewParent,
  );
  const bindingToRelease = bindingsBeforeRelease.find(
    (row) => row.id === pending.id && row.status === "APPROVED",
  );
  assert.ok(bindingToRelease, "原家长学习检查完成后才解除合成绑定。");
  await localApiRequest(
    apiBaseUrl,
    `/local/binding-applications/${bindingToRelease.id}/release`,
    reviewParent,
    "POST",
    { version: bindingToRelease.version },
  );
  await clickParentControl(pageCdp, "[data-parent-care-refresh]");
  await waitForExpression(
    pageCdp,
    "document.querySelector('[data-parent-care-state]')?.dataset.parentCareState === 'READY' && document.querySelectorAll('article[data-parent-care-row]').length === 0",
    "解除关系后刷新不能继续显示之前打开的成长记录。",
  );
  const releasedCareText = await evaluate(
    pageCdp,
    "document.querySelector('[data-parent-care-state]').innerText",
  );
  assert.match(releasedCareText, /当前没有已发布的成长记录。/u);
  for (const value of careFieldValues)
    assert.ok(!releasedCareText.includes(value), "失去关系范围后不能残留详情：" + value);
  assert.deepEqual(
    careReceiptRequests.map((request) => JSON.parse(request.postData).action),
    ["read", "acknowledge", "read"],
  );
  for (const panel of parentMessages) {
    await clickParentControl(pageCdp, `[data-parent-${panel.state}-refresh]`);
    await waitForParentMessage(pageCdp, panel.state, panel.row, null);
    assert.ok(
      !(
        await evaluate(
          pageCdp,
          `document.querySelector('[data-parent-${panel.state}-state]').innerHTML`,
        )
      ).includes(panel.detailText),
      "解除关系后不能残留已打开的通知/健康内容。",
    );
    assert.deepEqual(
      await localApiRequest(apiBaseUrl, `/local/${panel.resource}`, reviewParent),
      [],
      "解除关系后共享服务也必须清空可见范围。",
    );
    for (const action of ["read", "ack"]) {
      const originalUrl = `${baseUrl}/local/${panel.resource}/${panel.record.id}/${action}`;
      assert.equal(
        parentMessageWrites.filter((request) => request.url === originalUrl).length,
        1,
        "原始通知/健康回执不能重复写入。",
      );
    }
    assert.equal(
      parentMessageWrites.filter(
        (request) =>
          request.url === `${baseUrl}/local/${panel.resource}/${panel.remainingRecord.id}/read`,
      ).length,
      1,
    );
  }
  assert.equal(
    parentMessageWrites.length,
    6,
    "只允许原始四个回执和关系解除用两条新记录的打开请求。",
  );

  const externalRequests = requests.filter((url) => {
    if (!url.startsWith("http://") && !url.startsWith("https://")) return false;
    return new URL(url).origin !== baseUrl;
  });
  const expectedMealFailures = failedResponses.filter(
    ({ requestId, url, status }) =>
      injectedMealFailures.has(requestId) && url === mealUrl && status === 503,
  );
  assert.equal(expectedMealFailures.length, 1, "只能出现一次精确注入的食谱 503 失败。");
  const expectedCareFailures = failedResponses.filter(
    ({ requestId, url, status }) =>
      injectedCareFailures.has(requestId) && url === careUrl && status === 503,
  );
  assert.equal(expectedCareFailures.length, 1, "只能出现一次精确注入的成长记录 503 失败。");
  assert.equal(injectedMessageFailures.size, 2);
  for (const resource of ["notices", "health-incidents"]) {
    const listUrl = `${baseUrl}/local/${resource}`;
    const expectedFailures = failedResponses.filter(
      ({ requestId, url, status }) =>
        injectedMessageFailures.get(requestId) === listUrl && url === listUrl && status === 503,
    );
    assert.equal(expectedFailures.length, 1, "每个新面板只能出现一次精确注入的503：" + resource);
  }
  const unexpectedFailedResponses = failedResponses.filter(({ requestId, url, status }) => {
    const pathname = new URL(url).pathname;
    return !(
      (pathname === "/local/profiles" && status === 404) ||
      (pathname === "/local/sessions" && status === 403) ||
      (injectedMealFailures.has(requestId) && url === mealUrl && status === 503) ||
      (injectedCareFailures.has(requestId) && url === careUrl && status === 503) ||
      (injectedMessageFailures.get(requestId) === url && status === 503)
    );
  });
  assert.deepEqual(externalRequests, [], "页面不能请求本站以外的地址。");
  assert.deepEqual(unexpectedFailedResponses, [], "页面不能出现非预期失败请求。");
  assert.deepEqual(failedLoads, [], "页面不能出现传输失败请求。");
  assert.deepEqual(pageErrors, [], "浏览器不应出现页面脚本错误。");
});
