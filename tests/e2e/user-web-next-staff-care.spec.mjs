import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  capture,
  clickParentControl,
  createLocalProfile,
  evaluate,
  navigate,
  startNextBrowser,
  waitForExpression,
} from "./helpers/user-web-next-browser.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const artifactsRoot = resolve(
  repositoryRoot,
  process.env.USER_WEB_E2E_ARTIFACT_ROOT ??
    "artifacts/task20-a1-51-next-staff-care-three-ui-20261015",
);
const artifactPath = relative(resolve(repositoryRoot, "artifacts"), artifactsRoot);
assert.ok(
  artifactPath && !artifactPath.startsWith("..") && !isAbsolute(artifactPath),
  "联合回归工件只能写入当前工作树的 artifacts 子目录。",
);
const date = "2026-10-15";
const alphaValues = {
  arrival: "ARRIVED_AS_PLANNED",
  homework: "COMPLETED",
  meal: "FINISHED",
  rest: "RESTED",
  activity: "PARTICIPATED",
  wellbeing: "ROUTINE",
};
const betaValues = {
  arrival: "LATE",
  homework: "IN_PROGRESS",
  meal: "PARTIAL",
  rest: "QUIET_ACTIVITY",
  activity: "OBSERVED",
  wellbeing: "CHECK_IN",
};
const changedValues = { ...alphaValues, homework: "NEEDS_SUPPORT", wellbeing: "FOLLOW_UP" };
const teacherLabels = {
  arrival: { ARRIVED_AS_PLANNED: "按计划到校", LATE: "模拟迟到", ABSENT: "模拟未到" },
  homework: { COMPLETED: "已完成整理", IN_PROGRESS: "正在完成", NEEDS_SUPPORT: "需要协助" },
  meal: { FINISHED: "按示例完成用餐", PARTIAL: "模拟部分用餐", NOT_RECORDED: "未记录" },
  rest: { RESTED: "完成模拟休息", QUIET_ACTIVITY: "安静活动", NOT_RECORDED: "未记录" },
  activity: { PARTICIPATED: "参与活动", OBSERVED: "观察活动", NOT_RECORDED: "未记录" },
  wellbeing: { ROUTINE: "日常状态", CHECK_IN: "需要老师留意", FOLLOW_UP: "需要后续跟进" },
};
const adminLabels = {
  ...teacherLabels,
  arrival: { ARRIVED_AS_PLANNED: "按计划到校", LATE: "迟到", ABSENT: "未到校" },
  meal: { FINISHED: "按示例完成用餐", PARTIAL: "部分用餐", NOT_RECORDED: "未记录" },
  rest: { RESTED: "完成休息", QUIET_ACTIVITY: "安静活动", NOT_RECORDED: "未记录" },
};
const parentFields = ["到离状态", "作业整理", "餐食情况", "午休情况", "活动参与", "一般状态"];

async function api(baseUrl, path, handle, method = "GET", body, expected = 200) {
  const response = await fetch(baseUrl + path, {
    method,
    headers: {
      ...(handle ? { authorization: "Bearer " + handle } : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  assert.equal(response.status, expected, method + " " + path + " 必须符合真实服务契约。");
  return text ? JSON.parse(text) : null;
}

async function click(view, selector) {
  await view.page.send("Page.bringToFront");
  return clickParentControl(view.page, selector);
}
async function waitState(view, state = "READY") {
  await waitForExpression(
    view.page,
    "document.querySelector(" +
      JSON.stringify(view.panel) +
      ")?.getAttribute(" +
      JSON.stringify(view.stateAttribute) +
      ")===" +
      JSON.stringify(state),
    view.role + " 成长记录必须进入 " + state + "。",
  );
}
async function cleared(view) {
  assert.equal(
    await evaluate(
      view.page,
      "document.querySelectorAll(" + JSON.stringify(view.rows) + ").length",
    ),
    0,
    view.role + " 加载或失败时必须清除旧记录。",
  );
  if (view.role === "teacher")
    assert.equal(
      await evaluate(view.page, "document.querySelectorAll('[data-staff-care-form]').length"),
      0,
      "教师忙碌和失败时不能保留旧编辑表单。",
    );
}
async function refresh(view) {
  await click(view, view.refresh);
  await waitState(view);
}
async function selectOption(view, selector, match) {
  const choices = await evaluate(
    view.page,
    "Array.from(document.querySelector(" +
      JSON.stringify(selector) +
      ").options).map(o=>({value:o.value,label:o.textContent.trim()}))",
  );
  const index = choices.findIndex(
    (option) => option.value === match || option.label.includes(match),
  );
  assert.ok(index >= 0, "原生选择框必须包含实际可见选项。");
  await click(view, selector);
  for (const [key, keyCode] of [
    ["Home", 36],
    ...Array.from({ length: index }, () => ["ArrowDown", 40]),
    ["Enter", 13],
  ])
    for (const type of ["keyDown", "keyUp"])
      await view.page.send("Input.dispatchKeyEvent", {
        type,
        key,
        code: key,
        windowsVirtualKeyCode: keyCode,
        nativeVirtualKeyCode: keyCode,
      });
  assert.equal(
    await evaluate(view.page, "document.querySelector(" + JSON.stringify(selector) + ").value"),
    choices[index].value,
    "选项必须通过真实原生键盘选择。",
  );
}
async function fillTeacher(view, studentLabel, recordDate, values, { editing = false } = {}) {
  if (!editing) {
    await selectOption(view, "[data-staff-care-form] [name=student]", studentLabel);
    await evaluate(
      view.page,
      "(() => {const input=document.querySelector('[data-staff-care-form] [name=date]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input," +
        JSON.stringify(recordDate) +
        ");input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));})()",
    );
  } else {
    assert.equal(
      await evaluate(
        view.page,
        "document.querySelector('[data-staff-care-form] [name=student]').disabled",
      ),
      true,
      "编辑不能更换孩子。",
    );
    assert.equal(
      await evaluate(
        view.page,
        "document.querySelector('[data-staff-care-form] [name=date]').readOnly",
      ),
      true,
      "编辑不能更换日期。",
    );
  }
  for (const [field, value] of Object.entries(values))
    await selectOption(view, "[data-staff-care-form] [name=" + field + "]", value);
}
async function rowSelector(view, record) {
  const index = await evaluate(
    view.page,
    "Array.from(document.querySelectorAll(" +
      JSON.stringify(view.rows) +
      ")).findIndex(row=>row.innerText.includes(" +
      JSON.stringify(record.studentLabel) +
      ")&&row.innerText.includes(" +
      JSON.stringify(record.date) +
      "))",
  );
  assert.ok(index >= 0, "必须按孩子名称和日期找到唯一记录。");
  const matches = await evaluate(
    view.page,
    "Array.from(document.querySelectorAll(" +
      JSON.stringify(view.rows) +
      ")).filter(row=>row.innerText.includes(" +
      JSON.stringify(record.studentLabel) +
      ")&&row.innerText.includes(" +
      JSON.stringify(record.date) +
      ")).length",
  );
  assert.equal(matches, 1, "同日甲乙记录必须能通过孩子名称区分。");
  return view.rows + ":nth-child(" + (index + 1) + ")";
}
async function buttonByText(view, scope, label) {
  const index = await evaluate(
    view.page,
    "Array.from(document.querySelector(" +
      JSON.stringify(scope) +
      ").querySelectorAll('button')).findIndex(button=>button.textContent.trim()===" +
      JSON.stringify(label) +
      ")",
  );
  assert.ok(index >= 0, "必须有可见操作按钮：" + label);
  // All action buttons in these existing rows are direct children of the action container.
  const selector = await evaluate(
    view.page,
    "(() => {const root=document.querySelector(" +
      JSON.stringify(scope) +
      ");const target=Array.from(root.querySelectorAll('button'))[" +
      index +
      "];const children=Array.from(target.parentElement.children);return {parentClass:target.parentElement.className,position:children.indexOf(target)+1};})()",
  );
  assert.equal(selector.parentClass, "care-record-review-actions");
  return scope + " .care-record-review-actions > button:nth-child(" + selector.position + ")";
}
async function allowAdmin(view) {
  const selector = ".care-record-review-confirm input[type=checkbox]";
  if (
    !(await evaluate(view.page, "document.querySelector(" + JSON.stringify(selector) + ").checked"))
  )
    await click(view, selector);
  assert.equal(
    await evaluate(view.page, "document.querySelector(" + JSON.stringify(selector) + ").checked"),
    true,
  );
}
async function readRows(view) {
  return evaluate(
    view.page,
    "Array.from(document.querySelectorAll(" +
      JSON.stringify(view.rows) +
      ")).map(row=>({text:row.innerText,html:row.outerHTML,status:row.getAttribute('data-care-status'),receipt:row.getAttribute('data-receipt'),index:row.getAttribute('data-staff-care-record')??row.getAttribute('data-care-review-row'),published:row.getAttribute('data-care-published'),details:Array.from(row.querySelectorAll('dl > div')).map(item=>({label:item.querySelector('dt')?.textContent.trim(),value:item.querySelector('dd')?.textContent.trim()}))}))",
  );
}
async function assertRows(view, expected) {
  await waitState(view);
  const actual = await readRows(view);
  assert.equal(actual.length, expected.length, view.role + " 只显示其真实服务当前记录。");
  for (const record of expected) {
    const matches = actual.filter(
      (row) => row.text.includes(record.studentLabel) && row.text.includes(record.date),
    );
    assert.equal(matches.length, 1, "每个孩子在同日必须对应自己的记录。");
    const row = matches[0];
    if (view.role === "parent") {
      assert.equal(row.receipt, record.receipt);
      if (record.receipt === "UNREAD") {
        assert.deepEqual(row.details, []);
        assert.ok(row.text.includes("已发布的成长记录，打开后可查看当日摘要。"));
        for (const value of new Set(Object.values(record.values)))
          assert.ok(!row.text.includes(value), "未打开前不能展示六项摘要。");
      } else
        assert.deepEqual(
          row.details,
          Object.keys(alphaValues).map((field, index) => ({
            label: parentFields[index],
            value: record.values[field],
          })),
          "家长六字段必须逐项对应实际发布值。",
        );
    } else {
      if (view.role === "teacher") {
        assert.equal(row.status, record.status);
        assert.equal(row.published, String(record.published));
        assert.deepEqual(
          row.details,
          Object.keys(alphaValues).map((field, index) => ({
            label: parentFields[index],
            value: teacherLabels[field][record.values[field]],
          })),
          "教师六项观察必须逐项对应当前记录。",
        );
        assert.match(row.index ?? "", /^(0|[1-9]\d*)$/u);
      } else {
        assert.match(row.index ?? "", /^(0|[1-9]\d*)$/u);
        const label = {
          DRAFT: "草稿",
          SUBMITTED: "待审核",
          CONFIRMED: "已通过",
          RETURNED: "已退回",
          CANCELLED: "已撤回",
          EXCEPTION_PENDING: "待升级复核",
        }[record.status];
        assert.ok(row.text.includes(label + " · 第 " + record.version + " 版"));
      }
      const labels = view.role === "teacher" ? teacherLabels : adminLabels;
      for (const [field, value] of Object.entries(record.values))
        assert.ok(row.text.includes(labels[field][value]), "记录须显示各字段对应的实际值。");
      assert.doesNotMatch(
        row.html,
        /tenantId|campusId|classId|studentId|createdBy|reviewedBy|updatedBy|updatedAt|publicationVersion|data-record-id|data-version/u,
      );
      for (const field of [
        "id",
        "tenantId",
        "campusId",
        "classId",
        "studentId",
        "createdBy",
        "reviewedBy",
        "updatedBy",
      ])
        if (typeof record[field] === "string")
          assert.ok(
            !row.html.includes(record[field]),
            "新教师/管理页面不能包含内部 " + field + " 的值。",
          );
    }
  }
}

async function screenshots(view, name) {
  await view.page.send("Page.bringToFront");
  for (const width of [1365, 390, 320]) {
    await view.page.send("Emulation.setDeviceMetricsOverride", {
      width,
      height: width === 1365 ? 1000 : 900,
      deviceScaleFactor: 1,
      mobile: width !== 1365,
    });
    await evaluate(view.page, "window.scrollTo({top:0,behavior:'instant'})");
    await waitForExpression(
      view.page,
      "!document.fonts||document.fonts.status==='loaded'",
      "截图前字体必须加载完成。",
    );
    if (view.role === "admin" && width !== 1365)
      await waitForExpression(
        view.page,
        "document.querySelector('.admin-sidebar').getBoundingClientRect().right<=0",
        "管理端窄屏抽屉必须收起。",
      );
    const layout = await evaluate(
      view.page,
      "(() => {const panel=document.querySelector(" +
        JSON.stringify(view.panel) +
        ").getBoundingClientRect();const nav=document.querySelector(" +
        JSON.stringify(view.role === "admin" ? ".admin-sidebar" : "nav[aria-label=员工服务]") +
        ")?.getBoundingClientRect();return {overflow:document.documentElement.scrollWidth>innerWidth||document.body.scrollWidth>innerWidth,panelLeft:panel.left,panelTop:panel.top,navRight:nav?.right,navBottom:nav?.bottom};})()",
    );
    assert.equal(layout.overflow, false, view.role + " 在 " + width + "px 不能横向溢出。");
    if (view.role === "teacher")
      assert.ok(
        width === 1365
          ? layout.navRight <= layout.panelLeft + 1
          : layout.navBottom <= layout.panelTop + 1,
      );
    if (view.role === "admin" && width === 1365)
      assert.ok(
        layout.navRight > 0 && layout.navRight <= layout.panelLeft + 1,
        "管理端桌面必须左导航右内容。",
      );
    const point = await evaluate(
      view.page,
      "(() => {const scopes=[document.querySelector(" +
        JSON.stringify(view.panel) +
        "),document.querySelector('main')].filter(Boolean);const interactive='a,button,input,select,textarea,label,form,nav,summary,iframe,video,audio,[role=button],[role=link],[tabindex]:not([tabindex=\"-1\"]),[contenteditable]:not([contenteditable=false])';for(const scope of scopes){const rect=scope.getBoundingClientRect();const left=Math.max(0,rect.left)+4;const right=Math.min(innerWidth,rect.right)-4;const top=Math.max(0,rect.top)+4;const bottom=Math.min(innerHeight,rect.bottom)-4;if(right<=left||bottom<=top)continue;for(let row=0;row<=12;row+=1)for(let column=0;column<=12;column+=1){const x=left+(right-left)*column/12;const y=top+(bottom-top)*row/12;const hit=document.elementFromPoint(x,y);if(hit&&scope.contains(hit)&&!hit.closest(interactive)&&getComputedStyle(hit).pointerEvents!=='none')return {x,y};}}return null;})()",
    );
    assert.ok(point, "截图前必须找到可真实点击的非交互空白。");
    for (const type of ["mousePressed", "mouseReleased"])
      await view.page.send("Input.dispatchMouseEvent", {
        type,
        button: "left",
        clickCount: 1,
        ...point,
      });
    await evaluate(view.page, "window.scrollTo({top:0,behavior:'instant'})");
    assert.equal(await evaluate(view.page, "scrollY"), 0);
    assert.equal(await evaluate(view.page, "getSelection()?.toString().length"), 0);
    assert.ok(
      await evaluate(
        view.page,
        "!document.querySelector('.skip-link')||document.querySelector('.skip-link').getBoundingClientRect().bottom<=0",
      ),
    );
    if (width !== 320)
      await capture(
        view.page,
        join(
          artifactsRoot,
          "screenshots",
          name + "-" + (width === 1365 ? "desktop" : "mobile") + ".png",
        ),
        true,
      );
  }
}

// The remaining assertions run against one service and three actual browser tabs.

test(
  "Next staff care uses the real teacher, administrator and parent interfaces",
  { timeout: 240_000 },
  async (t) => {
    const harness = await startNextBrowser(t, { repositoryRoot, withAdmin: true });
    const { baseUrl, apiBaseUrl, adminBaseUrl } = harness;
    assert.equal(apiBaseUrl, "http://127.0.0.1:4319", "三端必须共用管理启动器本次创建的唯一 API。");
    assert.ok(adminBaseUrl);
    await mkdir(join(artifactsRoot, "screenshots"), { recursive: true });
    for (const [origin, path] of [
      [baseUrl, "/web/staff/care"],
      [adminBaseUrl, "/admin/care-record-review"],
      [baseUrl, "/web/parent/home"],
    ]) {
      const response = await fetch(origin + path);
      await response.arrayBuffer();
      assert.equal(response.status, 200, "三端真实路由必须可达：" + path);
    }
    const requests = [];
    const failedResponses = [];
    const failedLoads = [];
    const pageErrors = [];
    const injectedFailures = new Map();
    const finished = new Set();
    const views = [];
    const key = (role, id) => role + ":" + id;
    async function createView(role, panel, stateAttribute, rows, refreshSelector, initial = false) {
      const view = {
        role,
        panel,
        stateAttribute,
        rows,
        refresh: refreshSelector,
        page: undefined,
        interception: undefined,
        dialogAnswer: undefined,
        dialogs: [],
      };
      const onEvent = (method, params) => {
        if (method === "Network.requestWillBeSent") {
          const path = new URL(params.request.url).pathname;
          requests.push({
            role,
            requestId: params.requestId,
            url: params.request.url,
            method: params.request.method,
            resourceType: params.type,
            ...(params.request.postData && /\/(care-records)(\/|$)/u.test(path)
              ? { body: JSON.parse(params.request.postData) }
              : {}),
          });
        }
        if (method === "Network.responseReceived" && params.response.status >= 400)
          failedResponses.push({
            role,
            requestId: params.requestId,
            url: params.response.url,
            status: params.response.status,
          });
        if (method === "Network.loadingFinished") finished.add(key(role, params.requestId));
        if (method === "Network.loadingFailed") {
          const request = requests.findLast(
            (item) => item.role === role && item.requestId === params.requestId,
          );
          failedLoads.push({
            role,
            method: request?.method ?? null,
            path: request ? new URL(request.url).pathname.slice(0, 120) : null,
            type: params.type,
            canceled: params.canceled ?? false,
            error: params.errorText,
          });
        }
        if (method === "Page.javascriptDialogOpening") {
          view.dialogs.push({ type: params.type });
          const answer = view.dialogAnswer;
          view.dialogAnswer = undefined;
          if (params.type !== "confirm" || typeof answer !== "boolean")
            pageErrors.push({ role, text: "出现未预期的原生确认框" });
          void view.page
            .send("Page.handleJavaScriptDialog", { accept: answer === true })
            .catch(() => pageErrors.push({ role, text: "未能处理原生撤回确认框" }));
        }
        if (method === "Runtime.exceptionThrown")
          pageErrors.push({ role, text: params.exceptionDetails?.text ?? "网页脚本异常" });
        if (method === "Fetch.requestPaused") {
          const current = view.interception;
          if (
            current &&
            params.request.url === current.url &&
            params.request.method === current.method &&
            !current.paused
          )
            current.paused = params;
          else
            void view.page
              .send("Fetch.continueRequest", { requestId: params.requestId })
              .catch(() => pageErrors.push({ role, text: "未能放行非目标请求" }));
        }
      };
      view.page = initial ? await harness.connectPage(onEvent) : await harness.createPage(onEvent);
      views.push(view);
      await view.page.send("Emulation.setDeviceMetricsOverride", {
        width: 1365,
        height: 1000,
        deviceScaleFactor: 1,
        mobile: false,
      });
      return view;
    }
    const teacherView = await createView(
      "teacher",
      "[data-staff-care-state]",
      "data-staff-care-state",
      "[data-staff-care-record]",
      "[data-staff-care-refresh]",
      true,
    );
    const adminView = await createView(
      "admin",
      ".care-record-review",
      "data-care-review-state",
      ".care-record-review-row",
      ".care-record-review-controls button",
    );
    const parentView = await createView(
      "parent",
      "[data-parent-care-state]",
      "data-parent-care-state",
      "article[data-parent-care-row]",
      "[data-parent-care-refresh]",
    );
    const owner = await createLocalProfile(apiBaseUrl, "owner-east");
    const teacher = await createLocalProfile(apiBaseUrl, "teacher-east");
    const parent = await createLocalProfile(apiBaseUrl, "parent-alpha");
    const teacherRecords = () => api(apiBaseUrl, "/local/care-records", teacher);
    const adminRecords = () => api(apiBaseUrl, "/local/care-records", owner);
    const parentRecords = () => api(apiBaseUrl, "/local/care-records", parent);
    const readRecord = async (id) => (await teacherRecords()).find((row) => row.id === id);
    const dataFor = (view) =>
      view.role === "teacher"
        ? teacherRecords()
        : view.role === "admin"
          ? adminRecords()
          : parentRecords();
    async function assertCurrent(view) {
      await waitState(view);
      await assertRows(view, await dataFor(view));
    }
    async function refreshCurrent(view) {
      await refresh(view);
      await assertCurrent(view);
    }
    async function parentEmpty() {
      await refreshCurrent(parentView);
      assert.deepEqual(await parentRecords(), []);
      assert.ok(
        await evaluate(
          parentView.page,
          "document.querySelector('[data-parent-care-state]').innerText.includes('当前没有已发布的成长记录。')",
        ),
      );
    }
    const writes = (view, path, method = "POST") =>
      requests.filter(
        (row) =>
          row.role === view.role &&
          row.url === (view.role === "admin" ? apiBaseUrl : baseUrl) + path &&
          row.method === method,
      );
    async function hold(view, path, method, stage = "Request") {
      assert.equal(view.interception, undefined);
      view.interception = { url: (view.role === "admin" ? apiBaseUrl : baseUrl) + path, method };
      await view.page.send("Fetch.enable", {
        patterns: [{ urlPattern: view.interception.url, requestStage: stage }],
      });
    }
    async function paused(view) {
      for (let attempt = 0; attempt < 80 && !view.interception?.paused; attempt += 1)
        await delay(50);
      assert.ok(view.interception?.paused, "必须暂停这一次精确真实请求。");
      return view.interception.paused;
    }
    async function release(view, responseStage = false) {
      const request = await paused(view);
      await view.page.send(responseStage ? "Fetch.continueResponse" : "Fetch.continueRequest", {
        requestId: request.requestId,
      });
      view.interception = undefined;
      await view.page.send("Fetch.disable");
      return request;
    }
    async function doubleWrite(view, selector, path, method, body) {
      const before = writes(view, path, method).length;
      await hold(view, path, method);
      const point = await click(view, selector);
      for (const type of ["mousePressed", "mouseReleased"])
        await view.page.send("Input.dispatchMouseEvent", {
          type,
          button: "left",
          clickCount: 2,
          ...point,
        });
      await paused(view);
      await waitState(view, "BUSY");
      await cleared(view);
      assert.equal(
        await evaluate(
          view.page,
          "document.querySelector(" + JSON.stringify(view.refresh) + ").disabled",
        ),
        true,
      );
      await delay(150);
      const current = writes(view, path, method);
      assert.equal(current.length, before + 1, "原按钮坐标连续点击只能发出一次实际写入。");
      assert.deepEqual(
        current.at(-1).body,
        body,
        "每次真实请求必须对应当前孩子/版本和六项表单值。",
      );
      await release(view);
      await assertCurrent(view);
      assert.equal(
        writes(view, path, method).length,
        before + 1,
        "完成读取后不能再补发重复写请求。",
      );
    }
    async function failOnce(view, path, method, trigger) {
      await hold(view, path, method);
      await trigger();
      const request = await paused(view);
      await waitState(view, "BUSY");
      await cleared(view);
      assert.ok(request.networkId);
      injectedFailures.set(key(view.role, request.networkId), {
        url: view.interception.url,
        method,
      });
      await view.page.send("Fetch.fulfillRequest", {
        requestId: request.requestId,
        responseCode: 503,
        responseHeaders: [
          { name: "content-type", value: "application/json" },
          ...(view.role === "admin"
            ? [
                { name: "access-control-allow-origin", value: adminBaseUrl },
                { name: "vary", value: "Origin" },
              ]
            : []),
        ],
        body: Buffer.from(
          JSON.stringify({ error: { code: "LOCAL_SYNTHETIC_UNAVAILABLE" } }),
        ).toString("base64"),
      });
      view.interception = undefined;
      await view.page.send("Fetch.disable");
      await waitState(view, "ERROR");
      await cleared(view);
      assert.ok(
        await evaluate(
          view.page,
          "document.querySelector(" +
            JSON.stringify(view.panel) +
            ").innerText.includes('重新连接')",
        ),
      );
    }
    async function teacherAction(record, action) {
      if (action === "withdraw") teacherView.dialogAnswer = true;
      await doubleWrite(
        teacherView,
        (await rowSelector(teacherView, record)) + " [data-staff-care-action=" + action + "]",
        "/staff-local/care-records/" + record.id + "/" + action,
        "POST",
        { version: record.version },
      );
      const result = await readRecord(record.id);
      assert.equal(result.version, record.version + 1);
      return result;
    }
    async function adminAction(record, action) {
      await allowAdmin(adminView);
      const labels = {
        return: "退回修改",
        confirm: "审核通过",
        publish: "发布给家长",
        "revoke-publication": "撤回家长发布",
      };
      const selector = await buttonByText(
        adminView,
        await rowSelector(adminView, record),
        labels[action],
      );
      const review = action === "return" || action === "confirm";
      await doubleWrite(
        adminView,
        selector,
        "/local/care-records/" + record.id + "/" + (review ? "review" : action),
        "POST",
        { version: record.version, ...(review ? { action } : {}) },
      );
      const result = await readRecord(record.id);
      assert.equal(result.version, record.version + 1);
      return result;
    }
    async function editTeacher(record, values, resubmit = false) {
      await click(
        teacherView,
        (await rowSelector(teacherView, record)) +
          " [data-staff-care-action=" +
          (resubmit ? "resubmit" : "edit") +
          "]",
      );
      await fillTeacher(teacherView, record.studentLabel, record.date, values, { editing: true });
      await doubleWrite(
        teacherView,
        "[data-staff-care-form] button[type=submit]",
        "/staff-local/care-records/" + record.id + (resubmit ? "/resubmit" : ""),
        resubmit ? "POST" : "PATCH",
        { version: record.version, values },
      );
      const result = await readRecord(record.id);
      assert.equal(result.version, record.version + 1);
      assert.equal(result.status, resubmit ? "SUBMITTED" : "DRAFT");
      assert.deepEqual(result.values, values);
      return result;
    }
    async function parentReceipt(record, action) {
      const current = (await parentRecords()).find((row) => row.id === record.id);
      assert.ok(current);
      await doubleWrite(
        parentView,
        (await rowSelector(parentView, current)) + " [data-parent-care-action=" + action + "]",
        "/local/care-records/" + current.id + "/receipt",
        "POST",
        {
          bindingId: current.bindingId,
          version: current.version,
          publicationVersion: current.publicationVersion,
          action,
        },
      );
      const result = (await parentRecords()).find((row) => row.id === current.id);
      assert.equal(result.receipt, action === "read" ? "READ" : "ACKNOWLEDGED");
      return result;
    }

    await navigate(
      teacherView.page,
      baseUrl + "/web/staff/workbench",
      "document.querySelector('[data-staff-workbench-state]')?.dataset.staffWorkbenchState==='READY'",
    );
    await click(teacherView, "nav[aria-label='员工服务'] a[href='/web/staff/care']");
    await waitState(teacherView);
    await navigate(
      adminView.page,
      adminBaseUrl + "/admin/care-record-review",
      "document.querySelector('h1')?.textContent==='成长记录审核与发布'",
    );
    await waitState(adminView);
    const adminIconHref = await evaluate(
      adminView.page,
      "document.querySelector('link[rel=icon]')?.href",
    );
    assert.equal(typeof adminIconHref, "string", "管理页面必须声明实际图标。");
    const adminIconUrl = new URL(adminIconHref);
    assert.equal(adminIconUrl.origin, adminBaseUrl, "管理图标必须同源。");
    assert.equal(adminIconUrl.pathname, "/icon.png");
    const adminIconResponse = await fetch(adminIconHref);
    await adminIconResponse.arrayBuffer();
    assert.equal(adminIconResponse.status, 200, "管理图标必须实际返回 200。");
    assert.match(adminIconResponse.headers.get("content-type") ?? "", /^image\/png(?:;|$)/iu);
    await navigate(
      parentView.page,
      baseUrl + "/web/parent/home",
      "document.querySelector('h1')?.textContent==='家长首页'",
    );
    await waitForExpression(
      parentView.page,
      "['care','notices','health'].every(name=>document.querySelector('[data-parent-'+name+'-state]')?.getAttribute('data-parent-'+name+'-state')==='READY')",
      "家长首页三个实际分区必须完成读取。",
    );
    for (const view of views) await assertRows(view, []);
    assert.ok(
      await evaluate(
        teacherView.page,
        "document.querySelector('h1')?.textContent==='成长记录填写'",
      ),
    );
    const options = await api(baseUrl, "/staff-local/student-options", teacher);
    assert.deepEqual(
      options.map((row) => row.label),
      ["示例学生甲", "示例学生乙"],
    );
    const selectorHtml = await evaluate(
      teacherView.page,
      "document.querySelector('[data-staff-care-form] [name=student]').outerHTML",
    );
    for (const row of options)
      for (const field of ["id", "classId", "campusId"])
        assert.ok(!selectorHtml.includes(row[field]), "孩子选项不能把内部编号放进 DOM。");
    let bindingAlpha = await api(
      apiBaseUrl,
      "/local/binding-applications",
      parent,
      "POST",
      { student: "student-alpha", relationship: "GUARDIAN" },
      201,
    );
    let bindingBeta = await api(
      apiBaseUrl,
      "/local/binding-applications",
      parent,
      "POST",
      { student: "student-beta", relationship: "GUARDIAN" },
      201,
    );
    await parentEmpty();

    const beforeInvalid = writes(teacherView, "/staff-local/care-records").length;
    await fillTeacher(teacherView, "示例学生甲", "2026-02-30", alphaValues);
    await click(teacherView, "[data-staff-care-form] button[type=submit]");
    assert.equal(
      writes(teacherView, "/staff-local/care-records").length,
      beforeInvalid,
      "非法真实日期不能发出创建请求。",
    );
    await waitState(teacherView);
    await fillTeacher(teacherView, "示例学生甲", date, alphaValues);
    await doubleWrite(
      teacherView,
      "[data-staff-care-form] button[type=submit]",
      "/staff-local/care-records",
      "POST",
      { student: "student-alpha", date, values: alphaValues },
    );
    let alpha = (await teacherRecords()).find(
      (row) => row.studentLabel === "示例学生甲" && row.date === date,
    );
    assert.equal(alpha.status, "DRAFT");
    alpha = await editTeacher(alpha, changedValues);
    await fillTeacher(teacherView, "示例学生乙", date, betaValues);
    await doubleWrite(
      teacherView,
      "[data-staff-care-form] button[type=submit]",
      "/staff-local/care-records",
      "POST",
      { student: "student-beta", date, values: betaValues },
    );
    let beta = (await teacherRecords()).find(
      (row) => row.studentLabel === "示例学生乙" && row.date === date,
    );
    assert.equal(beta.status, "DRAFT");
    beta = await editTeacher(beta, { ...betaValues, activity: "PARTICIPATED" });
    assert.equal(beta.status, "DRAFT");
    assert.equal(beta.published, false);
    assert.ok(beta.version > 1);
    await api(
      baseUrl,
      "/staff-local/care-records/" + beta.id,
      teacher,
      "PATCH",
      { version: beta.version - 1, values: changedValues },
      409,
    );
    assert.deepEqual(
      await readRecord(beta.id),
      beta,
      "可编辑草稿必须拒绝旧版本修改，且全部记录字段保持不变。",
    );
    await parentEmpty();
    for (const binding of [bindingAlpha, bindingBeta])
      await api(
        apiBaseUrl,
        "/local/binding-applications/" + binding.id + "/review",
        owner,
        "POST",
        { version: binding.version, action: "approve" },
      );
    bindingAlpha = (await api(apiBaseUrl, "/local/binding-applications", parent)).find(
      (row) => row.id === bindingAlpha.id,
    );
    bindingBeta = (await api(apiBaseUrl, "/local/binding-applications", parent)).find(
      (row) => row.id === bindingBeta.id,
    );
    await parentEmpty();
    alpha = await teacherAction(alpha, "submit");
    beta = await teacherAction(beta, "submit");
    assert.equal(alpha.status, "SUBMITTED");
    assert.equal(beta.status, "SUBMITTED");
    await parentEmpty();
    await refreshCurrent(adminView);

    await failOnce(adminView, "/local/care-records", "GET", () =>
      click(adminView, adminView.refresh),
    );
    await refreshCurrent(adminView);
    alpha = await adminAction(alpha, "return");
    assert.equal(alpha.status, "RETURNED");
    await refreshCurrent(teacherView);
    alpha = await editTeacher(alpha, alphaValues, true);
    await refreshCurrent(adminView);
    await allowAdmin(adminView);
    const confirmPath = "/local/care-records/" + alpha.id + "/review";
    const confirmSelector = await buttonByText(
      adminView,
      await rowSelector(adminView, alpha),
      "审核通过",
    );
    const beforeReview = writes(adminView, confirmPath).length;
    await failOnce(adminView, confirmPath, "POST", () => click(adminView, confirmSelector));
    assert.deepEqual(await readRecord(alpha.id), alpha, "失败的审核请求不能改变真实记录。");
    await refreshCurrent(adminView);
    assert.equal(
      writes(adminView, confirmPath).length,
      beforeReview + 1,
      "重连只能读资料，不能重放失败审核。",
    );
    alpha = await adminAction(alpha, "confirm");
    assert.equal(alpha.status, "CONFIRMED");
    assert.equal(alpha.published, false);
    await parentEmpty();
    await refreshCurrent(teacherView);
    alpha = await editTeacher(alpha, changedValues);
    assert.equal(alpha.reviewedBy, null, "确认后重新编辑必须重新进入人工审核。");
    alpha = await teacherAction(alpha, "submit");
    await refreshCurrent(adminView);
    alpha = await adminAction(alpha, "confirm");
    beta = await adminAction(beta, "confirm");
    await parentEmpty();
    alpha = await adminAction(alpha, "publish");
    beta = await adminAction(beta, "publish");
    assert.equal(alpha.published, true);
    assert.equal(beta.published, true);
    await refreshCurrent(parentView);
    assert.deepEqual(
      (await parentRecords()).map((row) => row.receipt),
      ["UNREAD", "UNREAD"],
    );
    await parentReceipt(alpha, "read");
    await parentReceipt(alpha, "acknowledge");
    await parentReceipt(beta, "read");
    await parentReceipt(beta, "acknowledge");
    await refreshCurrent(teacherView);
    await screenshots(teacherView, "staff-care");
    await screenshots(adminView, "care-three-ui-admin");
    await screenshots(parentView, "care-three-ui-parent");

    const originalPublication = (await parentRecords()).find((row) => row.id === alpha.id);
    alpha = await adminAction(alpha, "revoke-publication");
    await refreshCurrent(parentView);
    assert.deepEqual(
      (await parentRecords()).map((row) => [row.studentLabel, row.receipt]),
      [["示例学生乙", "ACKNOWLEDGED"]],
    );
    alpha = await adminAction(alpha, "publish");
    assert.equal(alpha.publicationVersion, originalPublication.publicationVersion + 1);
    await refreshCurrent(parentView);
    const republished = (await parentRecords()).find((row) => row.id === alpha.id);
    assert.equal(republished.receipt, "UNREAD", "重新发布必须重置回执。");
    await api(
      baseUrl,
      "/local/care-records/" + alpha.id + "/receipt",
      parent,
      "POST",
      {
        bindingId: originalPublication.bindingId,
        version: originalPublication.version,
        publicationVersion: originalPublication.publicationVersion,
        action: "acknowledge",
      },
      409,
    );
    assert.equal((await parentRecords()).find((row) => row.id === alpha.id).receipt, "UNREAD");
    await parentReceipt(alpha, "read");
    await parentReceipt(alpha, "acknowledge");
    await failOnce(parentView, "/local/care-records", "GET", () =>
      click(parentView, parentView.refresh),
    );
    await refreshCurrent(parentView);
    assert.equal((await parentRecords()).filter((row) => row.receipt === "ACKNOWLEDGED").length, 2);
    await api(
      apiBaseUrl,
      "/local/binding-applications/" + bindingAlpha.id + "/release",
      owner,
      "POST",
      { version: bindingAlpha.version },
      403,
    );
    assert.deepEqual(
      (await api(apiBaseUrl, "/local/binding-applications", parent)).find(
        (row) => row.id === bindingAlpha.id,
      ),
      bindingAlpha,
      "负责人不能代替监护人解除关系，被拒绝后完整绑定记录必须保持不变。",
    );
    await api(
      apiBaseUrl,
      "/local/binding-applications/" + bindingAlpha.id + "/release",
      parent,
      "POST",
      { version: bindingAlpha.version },
    );
    await refreshCurrent(parentView);
    assert.deepEqual(
      (await parentRecords()).map((row) => [row.studentLabel, row.receipt]),
      [["示例学生乙", "ACKNOWLEDGED"]],
      "解绑甲只隐藏甲，不影响乙及乙的回执。",
    );
    const oldBindingId = bindingAlpha.id;
    bindingAlpha = await api(
      apiBaseUrl,
      "/local/binding-applications",
      parent,
      "POST",
      { student: "student-alpha", relationship: "GUARDIAN" },
      201,
    );
    await refreshCurrent(parentView);
    assert.deepEqual(
      (await parentRecords()).map((row) => row.studentLabel),
      ["示例学生乙"],
    );
    bindingAlpha = await api(
      apiBaseUrl,
      "/local/binding-applications/" + bindingAlpha.id + "/review",
      owner,
      "POST",
      { version: bindingAlpha.version, action: "approve" },
    );
    assert.notEqual(bindingAlpha.id, oldBindingId);
    await refreshCurrent(parentView);
    const rebound = (await parentRecords()).find((row) => row.id === alpha.id);
    assert.equal(rebound.bindingId, bindingAlpha.id);
    assert.equal(rebound.receipt, "UNREAD", "重新批准绑定可看仍发布记录，但不能继承旧绑定回执。");
    assert.equal((await parentRecords()).find((row) => row.id === beta.id).receipt, "ACKNOWLEDGED");

    await failOnce(teacherView, "/staff-local/care-records", "GET", () =>
      click(teacherView, teacherView.refresh),
    );
    await refreshCurrent(teacherView);
    await fillTeacher(teacherView, "示例学生甲", "2026-10-16", alphaValues);
    const beforeCreate = writes(teacherView, "/staff-local/care-records").length;
    const recordsBeforeFailure = await teacherRecords();
    await failOnce(teacherView, "/staff-local/care-records", "POST", () =>
      click(teacherView, "[data-staff-care-form] button[type=submit]"),
    );
    assert.deepEqual(await teacherRecords(), recordsBeforeFailure);
    await refreshCurrent(teacherView);
    assert.equal(
      writes(teacherView, "/staff-local/care-records").length,
      beforeCreate + 1,
      "教师重连不得自动重放失败创建。",
    );
    await fillTeacher(teacherView, "示例学生甲", "2026-10-16", alphaValues);
    await doubleWrite(
      teacherView,
      "[data-staff-care-form] button[type=submit]",
      "/staff-local/care-records",
      "POST",
      { student: "student-alpha", date: "2026-10-16", values: alphaValues },
    );
    let cancelled = (await teacherRecords()).find((row) => row.date === "2026-10-16");
    const withdrawPath = "/staff-local/care-records/" + cancelled.id + "/withdraw";
    const beforeWithdraw = writes(teacherView, withdrawPath).length;
    const beforeDialog = teacherView.dialogs.length;
    teacherView.dialogAnswer = false;
    await click(
      teacherView,
      (await rowSelector(teacherView, cancelled)) + " [data-staff-care-action=withdraw]",
    );
    for (let attempt = 0; attempt < 80 && teacherView.dialogs.length === beforeDialog; attempt += 1)
      await delay(50);
    assert.equal(teacherView.dialogs.length, beforeDialog + 1);
    assert.equal(
      writes(teacherView, withdrawPath).length,
      beforeWithdraw,
      "取消原生确认框不能发出撤回请求。",
    );
    assert.deepEqual(await readRecord(cancelled.id), cancelled);
    cancelled = await teacherAction(cancelled, "withdraw");
    assert.equal(cancelled.status, "CANCELLED");
    assert.equal(
      await evaluate(
        teacherView.page,
        "document.querySelector(" +
          JSON.stringify(await rowSelector(teacherView, cancelled)) +
          ").querySelectorAll('button').length",
      ),
      0,
      "撤回是终态，不能复用该记录编辑或重交。",
    );

    // Boundary checks use real service responses and do not expand browser failure exceptions.
    const current = await readRecord(alpha.id);
    await api(
      baseUrl,
      "/staff-local/care-records/" + alpha.id,
      teacher,
      "PATCH",
      { version: current.version, values: alphaValues },
      409,
    );
    assert.deepEqual(await readRecord(alpha.id), current, "已发布记录即使版本正确也不能直接编辑。");
    for (const [profile, action] of [
      ["teacher-other-class", "care:write"],
      ["teacher-east-peer", "care:write"],
      ["owner-west", "care:review"],
      ["owner-other-tenant", "care:review"],
    ]) {
      const handle = await createLocalProfile(apiBaseUrl, profile);
      const identity = await api(apiBaseUrl, "/local/session", handle);
      assert.ok(identity.actions.includes(action), "范围拒绝必须使用确有对应动作权限的身份。");
      assert.deepEqual(await api(apiBaseUrl, "/local/care-records", handle), []);
      await api(
        apiBaseUrl,
        "/local/care-records/" + current.id + (action === "care:review" ? "/review" : ""),
        handle,
        action === "care:review" ? "POST" : "PATCH",
        action === "care:review"
          ? { version: current.version, action: "confirm" }
          : { version: current.version, values: alphaValues },
        403,
      );
      assert.deepEqual(await readRecord(current.id), current);
    }
    const staffSession = await api(
      baseUrl,
      "/staff-local/sessions",
      undefined,
      "POST",
      { profile: "teacher-east" },
      201,
    );
    const staffIdentity = await api(baseUrl, "/staff-local/session", staffSession.handle);
    assert.equal(staffIdentity.profile, "teacher-east");
    assert.equal(staffIdentity.label, "示例东校区教师");
    for (const profile of ["owner-east", "parent-alpha", "teacher-east-peer"])
      await api(baseUrl, "/staff-local/sessions", undefined, "POST", { profile }, 403);
    for (const path of [
      "care-records?student=student-beta",
      "student-options?class=other",
      "session?profile=owner-east",
    ])
      await api(baseUrl, "/staff-local/" + path, teacher, "GET", undefined, 400);
    for (const action of ["review", "review-batch", "publish", "revoke-publication", "receipt"])
      await api(
        baseUrl,
        "/staff-local/care-records/" + current.id + "/" + action,
        teacher,
        "POST",
        {},
        404,
      );
    for (const id of ["not-a-uuid", "00000000-0000-0000-0000-000000000000"]) {
      await api(
        baseUrl,
        "/staff-local/care-records/" + id + "/submit",
        teacher,
        "POST",
        { version: 1 },
        404,
      );
      await api(
        baseUrl,
        "/staff-local/care-records/" + id,
        teacher,
        "PATCH",
        { version: 1, values: alphaValues },
        404,
      );
    }
    await api(baseUrl, "/staff-local/care-records/" + current.id, teacher, "GET", undefined, 404);
    await api(
      baseUrl,
      "/staff-local/care-records/" + current.id + "?extra=1",
      teacher,
      "PATCH",
      { version: current.version, values: alphaValues },
      400,
    );
    for (const method of ["HEAD", "OPTIONS"])
      await api(baseUrl, "/staff-local/care-records", teacher, method, undefined, 404);
    for (const method of ["PUT", "DELETE"])
      await api(baseUrl, "/staff-local/care-records/" + current.id, teacher, method, {}, 405);
    for (const path of [
      "student-options",
      "leave-requests/" + current.id,
      "staff-tasks/" + current.id,
    ])
      await api(baseUrl, "/staff-local/" + path, teacher, "PATCH", {}, 405);
    await api(baseUrl, "/staff-local/student-options", teacher, "POST", {}, 404);
    await api(
      baseUrl,
      "/staff-local/care-records",
      parent,
      "POST",
      { student: "student-alpha", date: "2026-10-17", values: alphaValues },
      403,
    );
    await api(
      baseUrl,
      "/local/care-records",
      parent,
      "POST",
      { student: "student-alpha", date: "2026-10-17", values: alphaValues },
      404,
    );
    await api(
      baseUrl,
      "/local/care-records/" + current.id + "/review",
      parent,
      "POST",
      { version: current.version, action: "confirm" },
      404,
    );
    assert.deepEqual(await api(baseUrl, "/staff-local/leave-requests", teacher), []);
    assert.deepEqual(await api(baseUrl, "/staff-local/staff-tasks", teacher), []);
    assert.deepEqual(await api(baseUrl, "/staff-local/student-options", teacher), options);
    assert.deepEqual(
      await api(baseUrl, "/staff-local/session", staffSession.handle),
      staffIdentity,
      "代理边界检查后不能切换教师身份。",
    );

    const wrongType = await fetch(baseUrl + "/staff-local/care-records/" + current.id, {
      method: "PATCH",
      headers: { authorization: "Bearer " + teacher, "content-type": "text/plain" },
      body: "{}",
    });
    await wrongType.text();
    assert.equal(wrongType.status, 415);
    await api(
      baseUrl,
      "/staff-local/care-records/" + current.id,
      teacher,
      "PATCH",
      { extra: "x".repeat(4097) },
      413,
    );
    const invalidBearer = await fetch(baseUrl + "/staff-local/care-records/" + current.id, {
      method: "PATCH",
      headers: { authorization: "Bearer invalid", "content-type": "application/json" },
      body: JSON.stringify({ version: current.version, values: alphaValues }),
    });
    await invalidBearer.text();
    assert.equal(invalidBearer.status, 401);
    assert.deepEqual(await readRecord(current.id), current, "代理拒绝的写入不能影响已发布资料。");

    // Let a real pending response arrive after client-side navigation; do not cancel or fake it.
    await hold(teacherView, "/staff-local/care-records", "GET", "Response");
    await click(teacherView, teacherView.refresh);
    const late = await paused(teacherView);
    await waitState(teacherView, "BUSY");
    await cleared(teacherView);
    await click(teacherView, "nav[aria-label='员工服务'] a[href='/web/staff/workbench']");
    await waitForExpression(
      teacherView.page,
      "location.pathname==='/web/staff/workbench'&&document.querySelector('[data-staff-workbench-state]')?.dataset.staffWorkbenchState==='READY'",
      "忙碌时应可通过真实导航离开成长记录。",
    );
    await release(teacherView, true);
    assert.ok(late.networkId);
    for (
      let attempt = 0;
      attempt < 80 && !finished.has(key("teacher", late.networkId));
      attempt += 1
    )
      await delay(50);
    assert.ok(
      finished.has(key("teacher", late.networkId)),
      "离页后的真实延迟响应必须完成，不能靠取消请求制造通过。",
    );
    assert.equal(
      await evaluate(
        teacherView.page,
        "document.querySelectorAll('[data-staff-care-state],[data-staff-care-record]').length",
      ),
      0,
      "迟到结果不能重新渲染已卸载的成长记录页面。",
    );
    await click(teacherView, "nav[aria-label='员工服务'] a[href='/web/staff/care']");
    await assertCurrent(teacherView);
    await refreshCurrent(adminView);
    await selectOption(adminView, "#care-record-review-profile", "owner-west");
    await waitState(adminView);
    await assertRows(adminView, []);
    assert.ok(
      await evaluate(
        adminView.page,
        "document.querySelector('.care-record-review').innerText.includes('当前校区没有可查看的成长记录。')",
      ),
    );
    await selectOption(adminView, "#care-record-review-profile", "owner-east");
    await assertCurrent(adminView);

    const adminIconRequests = requests.filter((request) => {
      const url = new URL(request.url);
      return (
        request.role === "admin" &&
        request.method === "GET" &&
        url.origin === adminIconUrl.origin &&
        url.pathname === adminIconUrl.pathname &&
        url.search === adminIconUrl.search
      );
    });
    assert.ok(adminIconRequests.length > 0, "管理端浏览器必须真实请求已声明的同源图标。");
    for (const request of adminIconRequests)
      assert.ok(finished.has(key("admin", request.requestId)), "管理端图标请求必须实际完成。");
    assert.equal(injectedFailures.size, 5, "仅注入教师GET/POST、管理GET/POST、家长GET各一次503。");
    assert.equal(
      failedResponses.length,
      5,
      "除五个明确注入的503外不能有其他浏览器失败响应。安全路径诊断：" +
        JSON.stringify(
          failedResponses.map(({ role, url, status }) => ({
            role,
            pathname: new URL(url).pathname.slice(0, 120),
            status,
          })),
        ),
    );
    for (const failure of failedResponses) {
      const injected = injectedFailures.get(key(failure.role, failure.requestId));
      assert.ok(injected);
      assert.equal(failure.status, 503);
      assert.equal(failure.url, injected.url);
      assert.equal(
        requests.find((row) => row.role === failure.role && row.requestId === failure.requestId)
          ?.method,
        injected.method,
      );
    }
    const origins = new Set([baseUrl, adminBaseUrl, apiBaseUrl]);
    for (const request of requests) {
      const url = new URL(request.url);
      if (url.protocol === "http:" || url.protocol === "https:")
        assert.ok(
          origins.has(url.origin),
          "网络请求必须留在三个明确的本机来源：" + url.pathname.slice(0, 120),
        );
      else {
        assert.equal(request.resourceType, "Image", "非HTTP资源只能是原生内嵌图片类型。");
        assert.match(
          request.url,
          /^data:image\/svg\+xml;base64,(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u,
          "仅允许严格base64 SVG内嵌图片。",
        );
      }
    }
    for (const view of views)
      assert.deepEqual(
        await evaluate(view.page, "({local:localStorage.length,session:sessionStorage.length})"),
        { local: 0, session: 0 },
        "三端不能持久化会话或合成资料。",
      );
    assert.deepEqual(failedLoads, []);
    assert.deepEqual(pageErrors, []);
    t.diagnostic(
      "三个真实标签页共用单一本机API；甲乙同日创建/编辑/审核/发布/阅读知悉，撤回重发、绑定失效与重绑、五个精确503恢复、重复点击和迟到响应完成验证。",
    );
  },
);
