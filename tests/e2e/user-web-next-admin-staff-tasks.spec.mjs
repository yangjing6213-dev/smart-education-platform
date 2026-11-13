/* global fetch, process, URL, Buffer, AbortSignal */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";
import "./helpers/owned-rsc-observer.test.mjs";
import { hashValue, isCompletedRouteCancellation } from "./helpers/owned-rsc-observer.mjs";
import { browserApiModuleUrl } from "./helpers/release-browser-paths.mjs";
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
    "artifacts/task20-a1-52-next-admin-staff-tasks-20261015",
);
const artifactPath = relative(resolve(repositoryRoot, "artifacts"), artifactsRoot);
assert.ok(
  artifactPath && !artifactPath.startsWith("..") && !isAbsolute(artifactPath),
  "工件只能写入当前工作树 artifacts 子目录。",
);
const titles = {
  DAILY_CHECK: "完成班级日常检查",
  TEMPORARY_SUPPORT: "处理临时工作事项",
  STUDENT_FOLLOW_UP: "完成学生事项跟进",
  ACTIVITY_SETUP: "完成活动准备",
  SAFETY_RESPONSE: "跟进安全与设施事项",
};
const results = {
  COMPLETED_AS_PLANNED: "按计划完成",
  FOLLOW_UP_REQUIRED: "需要继续跟进",
  BLOCKED: "暂时受阻",
};
const priorities = { NORMAL: "普通", IMPORTANT: "重要", URGENT: "紧急" };
const statuses = {
  ASSIGNED: "待领取",
  CLAIMED: "已领取",
  IN_PROGRESS: "处理中",
  COMPLETED: "待负责人检查",
  CHECKED: "已验收",
  RETURNED: "已退回",
  CANCELLED: "已取消",
};

async function api(base, path, handle, method = "GET", body, expected = 200) {
  const response = await fetch(base + path, {
    method,
    headers: {
      ...(handle ? { authorization: "Bearer " + handle } : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  assert.equal(response.status, expected, method + " " + path + " 必须符合实际服务契约。");
  const value = text ? JSON.parse(text) : null;
  return path.startsWith("/local/") ? value : (value?.data ?? value);
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
    view.role + " 任务界面必须进入 " + state + "。",
  );
}
async function cleared(view) {
  assert.equal(
    await evaluate(
      view.page,
      "document.querySelectorAll(" +
        JSON.stringify(view.rows + (view.role === "admin" ? ",[data-admin-task-form]" : "")) +
        ").length",
    ),
    0,
    "忙碌和错误时必须清空旧任务与旧分派表单。",
  );
}
async function select(view, selector, label) {
  const options = await evaluate(
    view.page,
    "Array.from(document.querySelector(" +
      JSON.stringify(selector) +
      ").options).map(option=>({value:option.value,label:option.textContent.trim()}))",
  );
  const index = options.findIndex((option) => option.label.includes(label));
  assert.ok(index >= 0, "原生选择框必须提供实际授权选项：" + label);
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
    options[index].value,
    "选择必须来自真实原生键盘操作。",
  );
}
async function fillAssignment(view, input, targetLabel, assigneeLabel) {
  for (const [name, label] of [
    ["code", titles[input.code]],
    ["assigneeId", assigneeLabel],
    ["target", targetLabel],
    ["priority", priorities[input.priority]],
  ])
    await select(view, "[data-admin-task-form] [name=" + name + "]", label);
  await evaluate(
    view.page,
    "(() => {const input=document.querySelector('[data-admin-task-form] [name=dueDate]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input," +
      JSON.stringify(input.dueDate) +
      ");input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));})()",
  );
}
async function cardSelector(view, task) {
  const index = await evaluate(
    view.page,
    "Array.from(document.querySelectorAll(" +
      JSON.stringify(view.rows) +
      ")).find(row=>row.querySelector('h3')?.textContent.trim()===" +
      JSON.stringify(task.title) +
      "&&row.querySelector('time')?.dateTime===" +
      JSON.stringify(task.dueDate) +
      "&&row.innerText.includes(" +
      JSON.stringify(task.targetLabel) +
      "))?.getAttribute(" +
      JSON.stringify(view.indexAttribute) +
      ")",
  );
  assert.match(
    index ?? "",
    /^(0|[1-9]\d*)$/u,
    "任务必须能按可见标题、对象和日期定位到安全行索引。",
  );
  return view.rows + "[" + view.indexAttribute + "='" + index + "']";
}
async function assertTasks(view, expected) {
  await waitState(view);
  const actual = await evaluate(
    view.page,
    "Array.from(document.querySelectorAll(" +
      JSON.stringify(view.rows) +
      ")).map(row=>({title:row.querySelector('h3')?.textContent.trim(),date:row.querySelector('time')?.dateTime,status:row.getAttribute(" +
      JSON.stringify(view.taskStatusAttribute) +
      "),index:row.getAttribute(" +
      JSON.stringify(view.indexAttribute) +
      "),text:row.innerText,html:row.outerHTML,fields:Array.from(row.querySelectorAll('dl > div')).map(item=>({label:item.querySelector('dt')?.textContent.trim(),value:item.querySelector('dd')?.textContent.trim()})),actions:Array.from(row.querySelectorAll(" +
      JSON.stringify(view.action) +
      ")).map(button=>button.getAttribute(" +
      JSON.stringify(view.actionAttribute) +
      "))}))",
  );
  assert.equal(actual.length, expected.length, "列表必须准确对应本次真实服务授权投影。");
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  for (const task of expected) {
    const matches = actual.filter(
      (row) =>
        row.title === task.title &&
        row.date === task.dueDate &&
        row.text.includes(task.targetLabel),
    );
    assert.equal(matches.length, 1);
    const row = matches[0];
    assert.match(row.index, /^(0|[1-9]\d*)$/u);
    assert.equal(row.status, task.status);
    const overdue = task.dueDate < today && !["CHECKED", "CANCELLED"].includes(task.status);
    assert.equal(task.overdue, overdue);
    const fields = [
      { label: view.role === "admin" ? "任务对象" : "任务目标", value: task.targetLabel },
      ...(view.role === "admin" ? [{ label: "经办员工", value: task.assigneeLabel }] : []),
      { label: "截止日期", value: task.dueDate },
      { label: "优先级", value: priorities[task.priority] },
      { label: "时效", value: overdue ? "已逾期" : "未逾期" },
    ];
    if (task.result !== null)
      fields.push({
        label:
          task.status === "CANCELLED"
            ? "取消前提交结果"
            : ["COMPLETED", "CHECKED"].includes(task.status)
              ? "完成结果"
              : "上次提交结果（本轮待重新提交）",
        value: results[task.result],
      });
    else if (view.role === "admin") fields.push({ label: "完成结果", value: "尚未提交" });
    assert.deepEqual(row.fields, fields, "任务各字段与历史结果标签必须逐项符合当前状态。");
    if (view.role === "staff") {
      assert.ok(row.text.includes(statuses[task.status]));
      assert.deepEqual(
        row.actions,
        { ASSIGNED: ["claim"], RETURNED: ["claim"], CLAIMED: ["start"], IN_PROGRESS: ["complete"] }[
          task.status
        ] ?? [],
      );
    } else {
      const adminStatus = {
        ...statuses,
        ASSIGNED: "待员工领取",
        CLAIMED: "员工已领取",
        RETURNED: "已退回处理",
      };
      assert.ok(row.text.includes(adminStatus[task.status]));
      assert.deepEqual(
        row.actions,
        task.status === "COMPLETED"
          ? ["confirm", "return", "cancel"]
          : ["CHECKED", "CANCELLED"].includes(task.status)
            ? []
            : ["cancel"],
      );
    }
    assert.doesNotMatch(
      row.html,
      /tenantId|campusId|classId|targetId|createdBy|assigneeId|claimedBy|completedBy|checkerId|updatedBy|updatedAt|data-task-id|data-version/u,
    );
    for (const field of [
      "id",
      "tenantId",
      "campusId",
      "classId",
      "createdBy",
      "assigneeId",
      "claimedBy",
      "completedBy",
      "checkerId",
      "updatedBy",
    ])
      if (typeof task[field] === "string")
        assert.ok(!row.html.includes(task[field]), "内部 " + field + " 不能出现在任务 DOM。");
    if (task.targetType !== "ACTIVITY") assert.ok(!row.html.includes(task.targetId));
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
      "document.fonts.status==='loaded'",
      "截图字体必须加载完成。",
    );
    if (view.role === "admin" && width !== 1365)
      await waitForExpression(
        view.page,
        "document.querySelector('.admin-sidebar').getBoundingClientRect().right<=0",
        "管理端手机抽屉必须收起。",
      );
    const layout = await evaluate(
      view.page,
      "(() => {const panel=document.querySelector(" +
        JSON.stringify(view.panel) +
        ").getBoundingClientRect();const nav=document.querySelector(" +
        JSON.stringify(view.role === "admin" ? ".admin-sidebar" : "nav[aria-label=员工服务]") +
        ").getBoundingClientRect();return {overflow:document.documentElement.scrollWidth>innerWidth||document.body.scrollWidth>innerWidth,navRight:nav.right,navBottom:nav.bottom,panelLeft:panel.left,panelTop:panel.top};})()",
    );
    assert.equal(layout.overflow, false, view.role + "在" + width + "px不能横向溢出。");
    if (width === 1365)
      assert.ok(
        layout.navRight > 0 && layout.navRight <= layout.panelLeft + 1,
        "桌面必须左导航右内容。",
      );
    else if (view.role === "staff")
      assert.ok(layout.navBottom <= layout.panelTop + 1, "员工手机导航与内容应顺排。");
    const point = await evaluate(
      view.page,
      "(() => {const scopes=[document.querySelector(" +
        JSON.stringify(view.panel) +
        "),document.querySelector('main')].filter(Boolean);for(const scope of scopes){const r=scope.getBoundingClientRect(),left=Math.max(0,r.left)+4,right=Math.min(innerWidth,r.right)-4,top=Math.max(0,r.top)+4,bottom=Math.min(innerHeight,r.bottom)-4;if(right<=left||bottom<=top)continue;for(let i=0;i<=12;i++)for(let j=0;j<=12;j++){const x=left+(right-left)*j/12,y=top+(bottom-top)*i/12,hit=document.elementFromPoint(x,y);if(hit&&scope.contains(hit)&&!hit.closest('a,button,input,select,textarea,label,form,nav,summary,[role=button],[role=link],[tabindex],[contenteditable]'))return {x,y};}}return null;})()",
    );
    assert.ok(point, "截图前须找到真实非交互位置清选区。");
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

test(
  "Next administrator assigns and checks tasks completed by the real staff interface",
  { timeout: 240_000 },
  async (t) => {
    await mkdir(join(artifactsRoot, "screenshots"), { recursive: true });
    const local = await buildLocalSyntheticServer({ mode: "local-synthetic" });
    t.after(() => local.close());
    const localBase = await local.start(0);
    const profiles = [
      "owner-east",
      "teacher-east",
      "teacher-east-peer",
      "owner-west",
      "owner-other-tenant",
      "teacher-other-class",
      "parent-alpha",
    ];
    const fixtureSessions = new Map(),
      fixtureHandles = new Map();
    for (const profile of profiles) {
      const handle = await createLocalProfile(localBase, profile);
      fixtureHandles.set(profile, handle);
      fixtureSessions.set(profile, await api(localBase, "/local/session", handle));
    }
    const password = "Synthetic-Only-Task-Flow-2026!",
      hash = await createInvitePasswordHash(password);
    const invited = await createApiApp({
      inviteAuthService: new InviteAuthService(
        profiles.map((profile) => {
          const m = fixtureSessions.get(profile);
          return {
            username: "tasks." + profile,
            password_hash: hash,
            identity: { actor_id: m.actorId, display_name: m.label },
            memberships: [
              {
                tenant_id: m.tenantId,
                campus_ids: [m.campusId],
                status: "ACTIVE",
                capabilities: [
                  "identity:read",
                  "memberships:read",
                  ...m.actions.filter((cap) => cap.startsWith("task:")),
                ],
              },
            ],
          };
        }),
      ),
      staffTaskWorkbenchOperations: local.staffTaskWorkbenchOperations,
    });
    t.after(() => invited.close());
    await invited.listen(0, "127.0.0.1");
    const invitedBase = await invited.getUrl();
    const handles = new Map();
    for (const profile of profiles) {
      const response = await api(invitedBase, "/identity/login", null, "POST", {
        username: "tasks." + profile,
        password,
      });
      handles.set(profile, response.access_token);
    }
    const keys = [
        "USER_WEB_LOCAL_NEST_API",
        "USER_WEB_NEST_API_BASE_URL",
        "ADMIN_WEB_LOCAL_NEST_API",
        "NODE_OPTIONS",
        "TASK20_OWNED_RSC_DIRECTORY",
      ],
      before = keys.map((key) => process.env[key]);
    process.env.USER_WEB_LOCAL_NEST_API = invitedBase;
    process.env.ADMIN_WEB_LOCAL_NEST_API = invitedBase;
    delete process.env.USER_WEB_NEST_API_BASE_URL;
    const wireDirectory = await mkdtemp(join(artifactsRoot, "owned-rsc-"));
    process.env.TASK20_OWNED_RSC_DIRECTORY = wireDirectory;
    process.env.NODE_OPTIONS =
      (process.env.NODE_OPTIONS ? process.env.NODE_OPTIONS + " " : "") +
      "--import=" +
      pathToFileURL(join(repositoryRoot, "tests/e2e/helpers/owned-rsc-observer.mjs")).href;
    t.after(() =>
      keys.forEach((key, index) => {
        if (before[index] === undefined) delete process.env[key];
        else process.env[key] = before[index];
      }),
    );
    const harness = await startNextBrowser(t, { repositoryRoot, withAdmin: true });
    const { baseUrl, apiBaseUrl, adminBaseUrl } = harness;
    assert.equal(new URL(apiBaseUrl).port, "4319", "两个实际网页必须共用唯一管理端本机API。");
    for (const [origin, path] of [
      [adminBaseUrl, "/admin/staff-tasks"],
      [baseUrl, "/web/staff/workbench"],
    ]) {
      const response = await fetch(origin + path);
      await response.text();
      assert.equal(response.status, 200, "实际任务页面必须存在：" + path);
    }
    const requests = [],
      failedResponses = [],
      authFailures = [],
      failedLoads = [],
      pageErrors = [];
    const finished = new Set(),
      injectedFailures = new Map();
    const transferMetadata = new Map();
    const verifiedRouteCancellations = new Map();
    t.after(async () => {
      await writeFile(
        join(artifactsRoot, "verified-route-transfers.json"),
        JSON.stringify([...verifiedRouteCancellations.values()], null, 2) + "\n",
      );
    });
    const key = (role, id) => role + ":" + id;
    const institutionSettingUrl = adminBaseUrl + "/api/admin/learning-institution-setting";
    const institutionSettingPattern = {
      urlPattern: institutionSettingUrl + "*",
      requestStage: "Request",
    };
    let phase = "initial-navigation";
    const views = [];
    async function verifyCompletedCancellation(row, expectedTimeOrigin) {
      const failure = failedLoads.find(
        (value) => key(value.role, value.requestId) === key(row.role, row.requestId),
      );
      if (!failure) return false;
      const witnesses = [];
      for (const name of await readdir(wireDirectory))
        if (/^server-\d+\.jsonl$/u.test(name))
          witnesses.push(
            ...(await readFile(join(wireDirectory, name), "utf8"))
              .trim()
              .split("\n")
              .filter(Boolean)
              .map((line) => JSON.parse(line)),
          );
      const actual = await evaluate(
        admin.page,
        `({
        pathname:location.pathname,timeOrigin:performance.timeOrigin,
        committed:location.pathname==="/admin/staff-tasks"?document.querySelector('[data-admin-task-state]')?.getAttribute('data-admin-task-state')==="READY":document.querySelector('h1')?.textContent==="机构概览"&&!document.querySelector('[data-admin-task-state]'),
        resources:performance.getEntriesByType('resource').filter(value=>new URL(value.name).searchParams.has('_rsc')).map(value=>({url:value.name,startAt:performance.timeOrigin+value.startTime,endAt:performance.timeOrigin+value.responseEnd,encodedBodySize:value.encodedBodySize,decodedBodySize:value.decodedBodySize}))
      })`,
      );
      const value = {
        request: row,
        failure,
        transfer: transferMetadata.get(key(row.role, row.requestId)),
        witnesses,
        timings: actual.resources.map(({ url, ...value }) => ({
          ...value,
          urlHash: hashValue(url),
        })),
        page: {
          pathname: actual.pathname,
          timeOrigin: actual.timeOrigin,
          expectedTimeOrigin,
          committed: actual.committed,
          errorCount: pageErrors.length,
        },
      };
      if (!isCompletedRouteCancellation(value)) return false;
      verifiedRouteCancellations.set(key(row.role, row.requestId), {
        classification: "COMPLETE_RSC_BYTES_WITH_POST_COMPLETION_CDP_CANCELLATION",
        requestId: row.requestId,
        path: new URL(row.url).pathname,
        phase: row.phase,
        transfer: value.transfer,
        witnesses: value.witnesses,
        timings: value.timings,
        page: value.page,
      });
      return true;
    }
    async function waitRouteTransfer(start, pathname, required = false, expectedTimeOrigin) {
      const matching = () =>
        requests
          .slice(start)
          .filter(
            (row) =>
              row.role === "admin" &&
              row.method === "GET" &&
              row.resourceType === "Fetch" &&
              new URL(row.url).origin === adminBaseUrl &&
              new URL(row.url).pathname === pathname,
          );
      for (let attempt = 0; attempt < 80; attempt++) {
        const rows = matching();
        for (const row of rows)
          if (
            !finished.has(key(row.role, row.requestId)) &&
            !verifiedRouteCancellations.has(key(row.role, row.requestId))
          )
            await verifyCompletedCancellation(row, expectedTimeOrigin);
        if (
          (!required || rows.length > 0) &&
          rows.every(
            (row) =>
              finished.has(key(row.role, row.requestId)) ||
              verifiedRouteCancellations.has(key(row.role, row.requestId)),
          )
        )
          return;
        await delay(100);
      }
      const details = [];
      for (const row of matching()) {
        let body, independent;
        try {
          const value = await admin.page.send("Network.getResponseBody", {
            requestId: row.requestId,
          });
          body = { bytes: value.body.length, base64: value.base64Encoded };
        } catch (cause) {
          body = { error: cause.message };
        }
        try {
          const response = await fetch(row.url, {
            headers: row.routeHeaders,
            signal: AbortSignal.timeout(2500),
          });
          const value = await response.text();
          independent = {
            status: response.status,
            bytes: Buffer.byteLength(value),
            sha256: createHash("sha256").update(value).digest("hex"),
            endsWithNewline: value.endsWith("\n"),
          };
        } catch (cause) {
          independent = { error: cause.name };
        }
        details.push({
          path: pathname,
          phase: row.phase,
          documentPath: row.documentPath,
          finished: finished.has(key(row.role, row.requestId)),
          transfer: transferMetadata.get(key(row.role, row.requestId)),
          body,
          independent,
        });
      }
      await writeFile(
        join(artifactsRoot, "route-transfer-diagnostic.json"),
        JSON.stringify(
          {
            classification: "INFRASTRUCTURE_ISSUE_UNDER_INVESTIGATION",
            details,
            performance: await evaluate(
              admin.page,
              "performance.getEntriesByType('resource').filter(row=>new URL(row.name).searchParams.has('_rsc')).map(row=>({path:new URL(row.name).pathname,startTime:row.startTime,duration:row.duration,responseStart:row.responseStart,responseEnd:row.responseEnd,transferSize:row.transferSize,encodedBodySize:row.encodedBodySize,decodedBodySize:row.decodedBodySize}))",
            ),
            failedLoads,
            pageErrors,
          },
          null,
          2,
        ),
      );
      assert.fail(
        "The actual route transfer must finish before the next operation: " +
          JSON.stringify(
            matching().map((row) => ({
              requestId: row.requestId,
              phase: row.phase,
              isRsc: row.isRsc,
              finished: finished.has(key(row.role, row.requestId)),
            })),
          ),
      );
    }
    async function createView(role, initial = false) {
      const isAdmin = role === "admin";
      const view = {
        role,
        panel: isAdmin ? "[data-admin-task-state]" : "[data-staff-workbench-state]",
        stateAttribute: isAdmin ? "data-admin-task-state" : "data-staff-workbench-state",
        rows: isAdmin ? "[data-admin-task-card]" : "[data-staff-workbench-task]",
        indexAttribute: isAdmin ? "data-admin-task-card" : "data-staff-workbench-task",
        taskStatusAttribute: isAdmin ? "data-admin-task-status" : "data-staff-task-status",
        action: isAdmin ? "[data-admin-task-action]" : "[data-staff-workbench-action]",
        actionAttribute: isAdmin ? "data-admin-task-action" : "data-staff-workbench-action",
        refresh: isAdmin ? "[data-admin-task-refresh]" : "[data-staff-workbench-refresh]",
        interception: undefined,
        page: undefined,
      };
      const onEvent = (method, params) => {
        if (method === "Network.responseReceived")
          transferMetadata.set(key(role, params.requestId), {
            status: params.response.status,
            mimeType: params.response.mimeType,
            protocol: params.response.protocol,
            timestamp: params.timestamp,
            encodedLength: params.response.encodedDataLength,
            contentLength:
              Object.entries(params.response.headers ?? {}).find(
                ([name]) => name.toLowerCase() === "content-length",
              )?.[1] ?? null,
            contentEncoding:
              Object.entries(params.response.headers ?? {}).find(
                ([name]) => name.toLowerCase() === "content-encoding",
              )?.[1] ?? null,
            transferEncoding:
              Object.entries(params.response.headers ?? {}).find(
                ([name]) => name.toLowerCase() === "transfer-encoding",
              )?.[1] ?? null,
            bytes: 0,
          });
        if (method === "Network.dataReceived") {
          const current = transferMetadata.get(key(role, params.requestId));
          if (current) current.bytes += params.dataLength;
        }
        if (method === "Network.requestWillBeSent") {
          const path = new URL(params.request.url).pathname;
          requests.push({
            role,
            requestId: params.requestId,
            url: params.request.url,
            method: params.request.method,
            resourceType: params.type,
            phase,
            documentPath: new URL(params.documentURL).pathname,
            isRsc: new URL(params.request.url).searchParams.has("_rsc"),
            initiatorType: params.initiator?.type ?? null,
            preflightFor: params.initiator?.requestId ?? null,
            timestamp: params.timestamp,
            wallTime: params.wallTime,
            routeHeaders: Object.fromEntries(
              Object.entries(params.request.headers ?? {}).filter(([name]) =>
                [
                  "rsc",
                  "x-nextjs-request-id",
                  "next-router-state-tree",
                  "next-router-prefetch",
                  "next-router-segment-prefetch",
                  "next-url",
                  "accept",
                  "accept-encoding",
                ].includes(name.toLowerCase()),
              ),
            ),
            hasAuthorization: Object.keys(params.request.headers ?? {}).some(
              (key) => key.toLowerCase() === "authorization",
            ),
            ...(params.request.postData && /\/(?:staff\/)?tasks(\/|$)/u.test(path)
              ? { body: JSON.parse(params.request.postData) }
              : {}),
          });
        }
        if (method === "Network.responseReceived" && params.response.status >= 400)
          (phase === "invite-login" &&
          params.response.status === 401 &&
          new URL(params.response.url).pathname === "/api-local/me"
            ? authFailures
            : failedResponses
          ).push({
            role,
            requestId: params.requestId,
            url: params.response.url,
            status: params.response.status,
          });
        if (method === "Network.loadingFinished") finished.add(key(role, params.requestId));
        if (method === "Network.loadingFailed") {
          const request = requests.findLast(
            (row) => row.role === role && row.requestId === params.requestId,
          );
          failedLoads.push({
            role,
            requestId: params.requestId,
            method: request?.method ?? null,
            path: request ? new URL(request.url).pathname.slice(0, 120) : null,
            type: params.type,
            canceled: params.canceled ?? false,
            error: params.errorText,
            requestPhase: request?.phase ?? null,
            failurePhase: phase,
            isRsc: request?.isRsc ?? null,
            initiatorType: request?.initiatorType ?? null,
            timestamp: params.timestamp,
          });
        }
        if (method === "Runtime.exceptionThrown")
          pageErrors.push({ role, text: params.exceptionDetails?.text ?? "网页脚本异常" });
        if (method === "Page.javascriptDialogOpening")
          pageErrors.push({ role, text: "任务操作不应出现未约定的弹窗。" });
        if (method === "Fetch.requestPaused") {
          if (
            role === "admin" &&
            params.request.url === institutionSettingUrl &&
            params.request.method === "GET"
          ) {
            void view.page
              .send("Fetch.fulfillRequest", {
                requestId: params.requestId,
                responseCode: 200,
                responseHeaders: [{ name: "content-type", value: "application/json" }],
                body: Buffer.from(
                  JSON.stringify({ data: { enabled: false, version: 1 } }),
                ).toString("base64"),
              })
              .catch(() => pageErrors.push({ role, text: "未能完成本地机构设置模拟读取。" }));
            return;
          }
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
      if (isAdmin) await view.page.send("Fetch.enable", { patterns: [institutionSettingPattern] });
      await view.page.send("Emulation.setDeviceMetricsOverride", {
        width: 1365,
        height: 1000,
        deviceScaleFactor: 1,
        mobile: false,
      });
      return view;
    }
    const admin = await createView("admin", true),
      staff = await createView("staff");
    const owner = handles.get("owner-east"),
      teacher = handles.get("teacher-east"),
      peer = handles.get("teacher-east-peer");
    const ownerSession = fixtureSessions.get("owner-east"),
      teacherSession = fixtureSessions.get("teacher-east"),
      peerSession = fixtureSessions.get("teacher-east-peer");
    const assignees = await api(
      localBase,
      "/local/staff-task-assignees",
      fixtureHandles.get("owner-east"),
    );
    const teacherAssignee = assignees.find((row) => row.actorId === teacherSession.actorId),
      peerAssignee = assignees.find((row) => row.actorId === peerSession.actorId);
    assert.ok(teacherAssignee && peerAssignee);
    assert.ok(teacherAssignee.classIds.includes(ownerSession.classIds[0]));
    const students = await api(
      localBase,
      "/local/student-options",
      fixtureHandles.get("owner-east"),
    );
    const beta = students.find((row) => row.label === "示例学生乙");
    assert.ok(beta && teacherAssignee.classIds.includes(beta.classId));
    async function tasksFor(profile, admin = false) {
      const current = await api(
        invitedBase,
        admin ? "/admin/tasks" : "/staff/tasks",
        handles.get(profile),
      );
      const raw = await api(localBase, "/local/staff-tasks", fixtureHandles.get(profile));
      const fields = [
        "id",
        "version",
        "code",
        "title",
        "targetType",
        "targetLabel",
        "dueDate",
        "priority",
        "status",
        "result",
        "assigneeLabel",
        "creatorLabel",
        "checkerLabel",
        "updatedAt",
        "overdue",
      ];
      const pick = (row) => Object.fromEntries(fields.map((key) => [key, row[key]]));
      assert.deepEqual(
        current.tasks.map(pick),
        raw.map(pick),
        "真实Nest投影必须和同一业务仓库的完整原记录一致。",
      );
      for (const row of current.tasks)
        for (const key of [
          "tenantId",
          "campusId",
          "classId",
          "assigneeId",
          "createdBy",
          "synthetic",
        ])
          assert.equal(key in row, false);
      return raw;
    }
    const adminTasks = () => tasksFor("owner-east", true),
      staffTasks = () => tasksFor("teacher-east");
    const queue = async () => (await adminTasks()).filter((row) => row.status === "COMPLETED");
    const readTask = async (id) => (await adminTasks()).find((row) => row.id === id);
    const canonicalInput = (input) => ({
      code: input.code,
      assigneeRef: input.assigneeId,
      classRef: ownerSession.classIds[0],
      targetType: input.targetType,
      targetRef: input.targetId,
      dueDate: input.dueDate,
      priority: input.priority,
    });
    phase = "invite-login";
    for (const [view, origin, path, next, username, userField, passwordField] of [
      [
        admin,
        adminBaseUrl,
        "/admin/login",
        "/admin/staff-tasks",
        "tasks.owner-east",
        "#admin-login-username",
        "#admin-login-password",
      ],
      [
        staff,
        baseUrl,
        "/web/login",
        "/web/staff/workbench",
        "tasks.teacher-east",
        "input[name=username]",
        "input[name=password]",
      ],
    ]) {
      await navigate(
        view.page,
        origin + path + "?next=" + encodeURIComponent(next),
        "document.querySelector('input[type=password]')",
      );
      await waitForExpression(
        view.page,
        `document.querySelector(${JSON.stringify(userField)})&&!document.querySelector(${JSON.stringify(userField)}).disabled`,
        "登录输入必须就绪",
      );
      await click(view, userField);
      await view.page.send("Input.insertText", { text: username });
      await click(view, passwordField);
      await view.page.send("Input.insertText", { text: password });
      const loginRouteStart = requests.length;
      const loginTimeOrigin = await evaluate(view.page, "performance.timeOrigin");
      await click(view, 'button[type="submit"]');
      await waitForExpression(
        view.page,
        `location.pathname===${JSON.stringify(next)}`,
        "实际邀请登录必须返回指定任务页",
      );
      await waitState(view);
      if (view.role === "admin")
        await waitRouteTransfer(loginRouteStart, next, false, loginTimeOrigin);
    }
    for (const [view, origin, name, path] of [
      [admin, adminBaseUrl, "student_care_admin_session", "/api/admin"],
      [staff, baseUrl, "student_care_local_session", "/api-local"],
    ]) {
      const cookies = (
        await view.page.send("Network.getCookies", { urls: [origin + path + "/me"] })
      ).cookies;
      const cookie = cookies.find((row) => row.name === name);
      assert.ok(cookie?.httpOnly);
      assert.equal(cookie.path, path);
      assert.equal(
        await evaluate(view.page, `document.cookie.includes(${JSON.stringify(name)})`),
        false,
      );
    }
    phase = "initial-navigation";
    async function assertCurrent(view) {
      await waitState(view);
      const review =
        view.role === "admin" &&
        (await evaluate(
          view.page,
          "document.querySelector('[data-admin-task-view=review]')?.getAttribute('aria-pressed')==='true'",
        ));
      await assertTasks(
        view,
        view.role === "staff" ? await staffTasks() : review ? await queue() : await adminTasks(),
      );
      if (view.role === "admin") {
        for (const [mode, rows] of [
          ["all", await adminTasks()],
          ["review", await queue()],
        ]) {
          const text = await evaluate(
            view.page,
            "document.querySelector('[data-admin-task-view=" + mode + "]').textContent.trim()",
          );
          assert.equal(text, (mode === "all" ? "全部任务" : "待检查") + "（" + rows.length + "）");
        }
      }
    }
    async function refresh(view) {
      await click(view, view.refresh);
      await assertCurrent(view);
    }
    async function showView(mode) {
      await click(admin, "[data-admin-task-view=" + mode + "]");
      assert.equal(
        await evaluate(
          admin.page,
          "document.querySelector('[data-admin-task-view=" +
            mode +
            "]').getAttribute('aria-pressed')",
        ),
        "true",
      );
      await assertCurrent(admin);
    }
    const writes = (view, path, method = "POST") =>
      requests.filter(
        (row) =>
          row.role === view.role &&
          row.url === (view.role === "admin" ? adminBaseUrl : baseUrl) + path &&
          row.method === method,
      );
    async function hold(view, path, method, stage = "Request") {
      assert.equal(view.interception, undefined);
      view.interception = { url: (view.role === "admin" ? adminBaseUrl : baseUrl) + path, method };
      await view.page.send("Fetch.enable", {
        patterns: [
          ...(view.role === "admin" ? [institutionSettingPattern] : []),
          { urlPattern: view.interception.url, requestStage: stage },
        ],
      });
    }
    async function paused(view) {
      for (let attempt = 0; attempt < 80 && !view.interception?.paused; attempt++) await delay(50);
      assert.ok(view.interception?.paused, "必须暂停一次精确目标真实请求。");
      return view.interception.paused;
    }
    async function release(view, responseStage = false) {
      const request = await paused(view);
      await view.page.send(responseStage ? "Fetch.continueResponse" : "Fetch.continueRequest", {
        requestId: request.requestId,
      });
      view.interception = undefined;
      await view.page.send("Fetch.disable");
      if (view.role === "admin")
        await view.page.send("Fetch.enable", { patterns: [institutionSettingPattern] });
      return request;
    }
    async function doubleWrite(view, selector, path, body) {
      const before = writes(view, path).length;
      await hold(view, path, "POST");
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
      assert.equal(
        writes(view, path).length,
        before + 1,
        "原按钮同位置重复点击只能发出一次真实写请求。",
      );
      assert.deepEqual(writes(view, path).at(-1).body, body, "请求必须使用实际表单和当前版本。");
      await release(view);
      await assertCurrent(view);
      assert.equal(writes(view, path).length, before + 1, "读取完成后不能再补发重复请求。");
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
      if (view.role === "admin")
        await view.page.send("Fetch.enable", { patterns: [institutionSettingPattern] });
      await waitState(view, "ERROR");
      await cleared(view);
      assert.equal(
        await evaluate(
          view.page,
          "document.querySelector(" + JSON.stringify(view.refresh) + ").textContent.trim()",
        ),
        "重新连接",
      );
    }
    async function createTask(input, targetLabel, person = teacherAssignee) {
      const before = await adminTasks();
      await fillAssignment(admin, input, targetLabel, person.label);
      await doubleWrite(
        admin,
        "[data-admin-task-form] button[type=submit]",
        "/api/admin/tasks",
        canonicalInput(input),
      );
      const after = await adminTasks();
      assert.equal(after.length, before.length + 1);
      const added = after.filter((row) => !before.some((old) => old.id === row.id));
      assert.equal(added.length, 1);
      for (const [field, value] of Object.entries(input)) assert.equal(added[0][field], value);
      assert.equal(added[0].status, "ASSIGNED");
      assert.equal(added[0].version, 1);
      return added[0];
    }
    async function staffAction(task, action, result) {
      const selector = await cardSelector(staff, task);
      if (action === "complete")
        await select(staff, selector + " [data-staff-workbench-result]", results[result]);
      await doubleWrite(
        staff,
        selector + " [data-staff-workbench-action=" + action + "]",
        "/api-local/staff/tasks/" + task.id + "/" + action,
        { version: task.version, ...(result ? { result } : {}) },
      );
      const updated = await readTask(task.id);
      assert.equal(updated.version, task.version + 1);
      assert.equal(
        updated.status,
        { claim: "CLAIMED", start: "IN_PROGRESS", complete: "COMPLETED" }[action],
      );
      if (result) assert.equal(updated.result, result);
      return updated;
    }
    async function adminAction(task, action) {
      await doubleWrite(
        admin,
        (await cardSelector(admin, task)) + " [data-admin-task-action=" + action + "]",
        "/api/admin/tasks/" + task.id + "/" + (action === "cancel" ? "cancel" : "check"),
        { version: task.version, ...(action === "cancel" ? {} : { action: action.toUpperCase() }) },
      );
      const updated = await readTask(task.id);
      assert.equal(updated.version, task.version + 1);
      assert.equal(
        updated.status,
        { confirm: "CHECKED", return: "RETURNED", cancel: "CANCELLED" }[action],
      );
      assert.equal(updated.result, task.result);
      return updated;
    }

    await admin.page.send("Page.bringToFront");
    await navigate(
      admin.page,
      adminBaseUrl + "/admin/institution",
      "document.querySelector('h1')?.textContent==='机构概览'",
    );
    phase = "initial-interaction-readiness";
    await admin.page.send("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 900,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await click(admin, ".nav-toggle");
    await waitForExpression(
      admin.page,
      "document.querySelector('.nav-toggle').getAttribute('aria-expanded')==='true'",
      "菜单必须实际响应，不能只凭服务端标题判断可交互。",
    );
    await click(admin, ".nav-toggle");
    await waitForExpression(
      admin.page,
      "document.querySelector('.nav-toggle').getAttribute('aria-expanded')==='false'&&document.querySelector('.admin-sidebar').getBoundingClientRect().right<=0",
      "菜单必须实际关闭。",
    );
    await admin.page.send("Emulation.setDeviceMetricsOverride", {
      width: 1365,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await waitForExpression(
      admin.page,
      "document.querySelector('.admin-sidebar').getBoundingClientRect().left>=0",
      "桌面导航必须实际显示。",
    );
    const firstTimeOrigin = await evaluate(admin.page, "performance.timeOrigin");
    phase = "first-task-route";
    const firstRouteStart = requests.length;
    await click(admin, "#admin-navigation a[href='/admin/staff-tasks']");
    await waitState(admin);
    await waitRouteTransfer(firstRouteStart, "/admin/staff-tasks", true, firstTimeOrigin);
    assert.equal(
      await evaluate(admin.page, "performance.timeOrigin"),
      firstTimeOrigin,
      "首次入口必须是真实站内导航，不得重载文档。",
    );
    phase = "task-operations";
    assert.equal(
      await evaluate(admin.page, "document.querySelector('h1').textContent"),
      "任务分派与检查",
    );
    await assertCurrent(admin);
    assert.equal((await adminTasks()).length, 0);
    assert.ok(
      await evaluate(
        admin.page,
        "document.querySelector('[data-admin-task-state]').innerText.includes('当前校区还没有任务。')",
      ),
    );
    await showView("review");
    assert.ok(
      await evaluate(
        admin.page,
        "document.querySelector('[data-admin-task-state]').innerText.includes('当前没有待检查的任务。')",
      ),
    );
    await showView("all");
    const adminIconHref = await evaluate(
      admin.page,
      "document.querySelector('link[rel=icon]')?.href",
    );
    const adminIconUrl = new URL(adminIconHref);
    assert.equal(adminIconUrl.origin, adminBaseUrl);
    assert.equal(adminIconUrl.pathname, "/icon.png");
    const iconResponse = await fetch(adminIconHref);
    assert.equal(iconResponse.status, 200);
    assert.match(iconResponse.headers.get("content-type") ?? "", /^image\/png(?:;|$)/u);
    await iconResponse.arrayBuffer();
    await staff.page.send("Page.bringToFront");
    await navigate(
      staff.page,
      baseUrl + "/web/staff/workbench",
      "document.querySelector('h1')?.textContent==='员工工作台'",
    );
    await assertCurrent(staff);
    assert.deepEqual(await staffTasks(), []);
    assert.ok(
      await evaluate(
        staff.page,
        "document.querySelector('[data-staff-workbench-state]').innerText.includes('当前没有分配给你的任务')",
      ),
    );

    const options = await evaluate(
      admin.page,
      "Array.from(document.querySelectorAll('[data-admin-task-form] select')).map(select=>({name:select.name,options:Array.from(select.options).map(option=>({value:option.value,label:option.textContent.trim()}))}))",
    );
    for (const control of options)
      for (const option of control.options)
        assert.match(option.value, /^(0|[1-9]\d*)$/u, "管理表单只使用安全数组索引。");
    assert.deepEqual(
      options.find((row) => row.name === "code").options.map((row) => row.label),
      Object.values(titles),
    );
    assert.deepEqual(
      options.find((row) => row.name === "priority").options.map((row) => row.label),
      Object.values(priorities),
    );
    assert.deepEqual(
      options.find((row) => row.name === "assigneeId").options.map((row) => row.label),
      assignees.map((row) => row.label),
    );
    const initialTargets = options
      .find((row) => row.name === "target")
      .options.map((row) => row.label);
    for (const label of [
      "班级 · 当前授权班级",
      ...students.map((row) => "学生 · " + row.label),
      "活动 · 美术活动",
      "活动 · 户外活动",
      "活动 · 家长开放日",
      "校区 · 当前授权校区",
    ])
      assert.ok(initialTargets.includes(label));
    assert.equal(initialTargets.length, 7);
    const formHtml = await evaluate(
      admin.page,
      "document.querySelector('[data-admin-task-form]').outerHTML",
    );
    for (const value of [
      ownerSession.actorId,
      ownerSession.tenantId,
      ownerSession.campusId,
      ...ownerSession.classIds,
      ...assignees.map((row) => row.actorId),
      ...students.map((row) => row.id),
    ])
      assert.ok(!formHtml.includes(value), "分派表单不能将内部标识放入DOM。");
    const mainInput = {
      code: "DAILY_CHECK",
      assigneeId: teacherSession.actorId,
      targetType: "CLASS",
      targetId: ownerSession.classIds[0],
      dueDate: "2026-01-10",
      priority: "IMPORTANT",
    };
    await fillAssignment(
      admin,
      { ...mainInput, dueDate: "2026-02-30" },
      "班级 · 当前授权班级",
      teacherAssignee.label,
    );
    const beforeInvalid = writes(admin, "/api/admin/tasks").length;
    await click(admin, "[data-admin-task-form] button[type=submit]");
    assert.equal(
      await evaluate(
        admin.page,
        "document.querySelector('[data-admin-task-form] [name=dueDate]').validity.valid",
      ),
      false,
    );
    await waitState(admin);
    assert.equal(
      writes(admin, "/api/admin/tasks").length,
      beforeInvalid,
      "无效日期不能发出分派请求。",
    );
    assert.deepEqual(await adminTasks(), []);
    let main = await createTask(mainInput, "班级 · 当前授权班级");
    await refresh(staff);
    await failOnce(admin, "/api/admin/tasks", "GET", () => click(admin, admin.refresh));
    await refresh(admin);
    assert.equal((await adminTasks()).length, 1);

    const studentInput = {
      code: "STUDENT_FOLLOW_UP",
      assigneeId: teacherSession.actorId,
      targetType: "STUDENT",
      targetId: beta.id,
      dueDate: "2026-01-11",
      priority: "URGENT",
    };
    await fillAssignment(admin, studentInput, "学生 · " + beta.label, teacherAssignee.label);
    const beforeCreateFailure = await adminTasks();
    await failOnce(admin, "/api/admin/tasks", "POST", () =>
      click(admin, "[data-admin-task-form] button[type=submit]"),
    );
    const failedCreateCount = writes(admin, "/api/admin/tasks").length;
    assert.deepEqual(await adminTasks(), beforeCreateFailure, "503不能写入或返回假成功。");
    await refresh(admin);
    assert.equal(
      writes(admin, "/api/admin/tasks").length,
      failedCreateCount,
      "重新连接不能重放失败的分派写入。",
    );
    assert.deepEqual(await adminTasks(), beforeCreateFailure);
    let studentTask = await createTask(studentInput, "学生 · " + beta.label);
    const activityTask = await createTask(
      {
        code: "ACTIVITY_SETUP",
        assigneeId: teacherSession.actorId,
        targetType: "ACTIVITY",
        targetId: "ART_WORKSHOP",
        dueDate: "2026-01-12",
        priority: "NORMAL",
      },
      "活动 · 美术活动",
    );
    await createTask(
      {
        code: "SAFETY_RESPONSE",
        assigneeId: teacherSession.actorId,
        targetType: "CAMPUS",
        targetId: ownerSession.campusId,
        dueDate: "2026-01-13",
        priority: "IMPORTANT",
      },
      "校区 · 当前授权校区",
    );
    const peerTask = await createTask(
      {
        code: "TEMPORARY_SUPPORT",
        assigneeId: peerSession.actorId,
        targetType: "CLASS",
        targetId: peerAssignee.classIds[0],
        dueDate: "2026-01-14",
        priority: "NORMAL",
      },
      "班级 · 当前授权班级",
      peerAssignee,
    );
    assert.equal((await adminTasks()).length, 5);
    await refresh(staff);
    assert.equal((await staffTasks()).length, 4);
    assert.equal(
      await evaluate(
        staff.page,
        "document.querySelector('[data-staff-workbench-state]').innerText.includes('处理临时工作事项')",
      ),
      false,
      "同班同事任务不能进入员工本人工作台。",
    );
    const peerBefore = await readTask(peerTask.id);
    await api(
      invitedBase,
      "/staff/tasks/" + peerTask.id + "/claim",
      teacher,
      "POST",
      { version: peerBefore.version },
      403,
    );
    assert.deepEqual(await readTask(peerTask.id), peerBefore);
    assert.equal((await api(invitedBase, "/staff/tasks", peer)).tasks.length, 1);
    await failOnce(staff, "/api-local/staff/tasks", "GET", () => click(staff, staff.refresh));
    await refresh(staff);

    for (const [index, result] of Object.keys(results).entries()) {
      main = await staffAction(main, "claim");
      main = await staffAction(main, "start");
      main = await staffAction(main, "complete", result);
      assert.equal(main.status, "COMPLETED", "包括受阻结果在内均须等待负责人检查。");
      await refresh(admin);
      await showView("review");
      assert.deepEqual(
        (await queue()).map((row) => row.id),
        [main.id],
      );
      if (index === 0) {
        const completedBefore = await readTask(main.id);
        await api(
          invitedBase,
          "/admin/tasks/" + main.id + "/check",
          owner,
          "POST",
          { version: main.version - 1, action: "RETURN" },
          409,
        );
        assert.deepEqual(
          await readTask(main.id),
          completedBefore,
          "可检查状态下旧版本拒绝不能改变任何字段。",
        );
        for (const profile of ["owner-west", "owner-other-tenant"]) {
          const handle = handles.get(profile);
          assert.ok(
            (await api(invitedBase, "/me", handle)).memberships[0].capabilities.includes(
              "task:check",
            ),
          );
          assert.deepEqual((await api(invitedBase, "/admin/tasks", handle)).tasks, []);
          assert.deepEqual(
            (await api(invitedBase, "/admin/tasks", handle)).tasks.filter(
              (row) => row.status === "COMPLETED",
            ),
            [],
          );
          await api(
            invitedBase,
            "/admin/tasks/" + main.id + "/check",
            handle,
            "POST",
            { version: main.version, action: "CONFIRM" },
            403,
          );
          assert.deepEqual(
            await readTask(main.id),
            completedBefore,
            "具有检查权限的范围外负责人也不能改变本任务。",
          );
        }
      }
      main = await adminAction(main, index < 2 ? "return" : "confirm");
      assert.deepEqual(await queue(), []);
      await showView("all");
      await refresh(staff);
      if (index < 2) {
        assert.equal(main.status, "RETURNED");
        const selector = await cardSelector(staff, main);
        assert.ok(
          await evaluate(
            staff.page,
            "document.querySelector(" +
              JSON.stringify(selector) +
              ").innerText.includes('上次提交结果（本轮待重新提交）')",
          ),
        );
      }
    }
    assert.equal(main.status, "CHECKED");
    assert.equal(main.result, "BLOCKED");
    assert.equal(main.overdue, false);
    const otherTeacher = handles.get("teacher-other-class");
    assert.ok(
      (await api(invitedBase, "/me", otherTeacher)).memberships[0].capabilities.includes(
        "task:claim",
      ),
    );
    assert.deepEqual((await api(invitedBase, "/staff/tasks", otherTeacher)).tasks, []);
    const activityBefore = await readTask(activityTask.id);
    await api(
      invitedBase,
      "/staff/tasks/" + activityTask.id + "/claim",
      otherTeacher,
      "POST",
      { version: activityBefore.version },
      403,
    );
    assert.deepEqual(await readTask(activityTask.id), activityBefore);
    for (const handle of [teacher, handles.get("parent-alpha")]) {
      const before = await adminTasks();
      await api(invitedBase, "/admin/tasks", handle, "POST", canonicalInput(mainInput), 403);
      assert.deepEqual(await adminTasks(), before);
    }

    studentTask = await staffAction(studentTask, "claim");
    studentTask = await staffAction(studentTask, "start");
    const studentSelector = await cardSelector(staff, studentTask);
    await select(staff, studentSelector + " [data-staff-workbench-result]", results.BLOCKED);
    const completePath = "/api-local/staff/tasks/" + studentTask.id + "/complete";
    await failOnce(staff, completePath, "POST", () =>
      click(staff, studentSelector + " [data-staff-workbench-action=complete]"),
    );
    const failedCompleteCount = writes(staff, completePath).length;
    assert.deepEqual(await readTask(studentTask.id), studentTask);
    await refresh(staff);
    assert.equal(
      writes(staff, completePath).length,
      failedCompleteCount,
      "重新连接不能补交失败的完成请求。",
    );
    assert.deepEqual(await readTask(studentTask.id), studentTask);
    studentTask = await staffAction(studentTask, "complete", "BLOCKED");
    await refresh(admin);
    await showView("review");
    assert.deepEqual(
      (await queue()).map((row) => row.id),
      [studentTask.id],
    );
    studentTask = await adminAction(studentTask, "cancel");
    assert.equal(studentTask.status, "CANCELLED");
    assert.equal(studentTask.result, "BLOCKED");
    assert.equal(studentTask.overdue, false);
    await showView("all");
    await refresh(staff);
    for (const view of views) {
      const selector = await cardSelector(view, studentTask);
      const text = await evaluate(
        view.page,
        "document.querySelector(" + JSON.stringify(selector) + ").innerText",
      );
      assert.ok(text.includes("取消前提交结果"));
      assert.ok(!text.includes("本轮待重新提交"));
      assert.equal(
        await evaluate(
          view.page,
          "document.querySelector(" +
            JSON.stringify(selector) +
            ").querySelectorAll(" +
            JSON.stringify(view.action) +
            ").length",
        ),
        0,
      );
    }
    phase = "screenshots";
    await screenshots(admin, "admin-staff-tasks");
    await screenshots(staff, "staff-tasks-assignee");

    await admin.page.send("Page.bringToFront");
    await admin.page.send("Emulation.setDeviceMetricsOverride", {
      width: 1365,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await waitForExpression(
      admin.page,
      "document.querySelector('.admin-sidebar').getBoundingClientRect().left>=0",
      "桌面侧栏必须实际出现。",
    );
    const timeOrigin = await evaluate(admin.page, "performance.timeOrigin");
    await hold(admin, "/api/admin/tasks", "GET", "Response");
    await click(admin, admin.refresh);
    const delayed = await paused(admin);
    assert.ok(delayed.networkId);
    await waitState(admin, "BUSY");
    await cleared(admin);
    phase = "leave-with-held-task-response";
    const leaveRouteStart = requests.length;
    await click(admin, "#admin-navigation a[href='/admin/institution']");
    await waitForExpression(
      admin.page,
      "document.querySelector('h1')?.textContent==='机构概览'&&!document.querySelector('[data-admin-task-state]')",
      "真实站内导航必须卸载任务页面。",
    );
    assert.equal(
      await evaluate(admin.page, "performance.timeOrigin"),
      timeOrigin,
      "离页必须是实际React站内导航而非重载文档。",
    );
    await release(admin, true);
    for (let attempt = 0; attempt < 80 && !finished.has(key("admin", delayed.networkId)); attempt++)
      await delay(50);
    assert.ok(
      finished.has(key("admin", delayed.networkId)),
      "迟到的真实响应必须完成，不得用取消或忽略网络错误代替。",
    );
    await waitRouteTransfer(leaveRouteStart, "/admin/institution", false, timeOrigin);
    assert.equal(
      await evaluate(
        admin.page,
        "document.querySelectorAll('[data-admin-task-state],[data-admin-task-card]').length",
      ),
      0,
      "离页后旧任务不能重新回流。",
    );
    assert.equal(
      await evaluate(admin.page, "document.querySelector('h1').textContent"),
      "机构概览",
    );
    phase = "return-task-route";
    const returnRouteStart = requests.length;
    await click(admin, "#admin-navigation a[href='/admin/staff-tasks']");
    await assertCurrent(admin);
    await assertCurrent(staff);
    await waitRouteTransfer(returnRouteStart, "/admin/staff-tasks", false, timeOrigin);
    assert.equal(await evaluate(admin.page, "performance.timeOrigin"), timeOrigin);
    phase = "final-network-audit";

    const iconRequests = requests.filter(
      (row) => row.role === "admin" && row.method === "GET" && row.url === adminIconHref,
    );
    assert.ok(iconRequests.length > 0, "管理端必须真实加载所声明的图标。");
    for (const row of iconRequests) assert.ok(finished.has(key(row.role, row.requestId)));
    assert.equal(authFailures.length, 1, "首次登录前只允许一次明确的/me401。");
    assert.equal(injectedFailures.size, 4, "只精确注入管理GET/POST和员工GET/POST各一次503。");
    assert.equal(
      failedResponses.length,
      4,
      "除四个明确503之外不能有其他HTTP失败。安全路径诊断：" +
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
    const legacyInstitutionReads = [];
    t.diagnostic(
      "旧接口请求定位：" +
        JSON.stringify(
          requests
            .filter((row) => /\/(?:local|staff-local)\//u.test(new URL(row.url).pathname))
            .map((row) => ({
              role: row.role,
              phase: row.phase,
              documentPath: row.documentPath,
              path: new URL(row.url).pathname,
              method: row.method,
            })),
        ),
    );
    for (const request of requests) {
      const requestUrl = new URL(request.url);
      const institutionCall = (row) => {
        const url = new URL(row.url);
        return (
          row.role === "admin" &&
          row.documentPath === "/admin/institution" &&
          url.origin === apiBaseUrl &&
          ((row.method === "POST" && url.pathname === "/local/sessions") ||
            (row.method === "GET" &&
              ["/local/session", "/local/learning-institution-setting"].includes(url.pathname)))
        );
      };
      const legacyInstitutionRead =
        institutionCall(request) ||
        (request.role === "admin" &&
          request.method === "OPTIONS" &&
          requestUrl.origin === apiBaseUrl &&
          requests.some(
            (row) =>
              institutionCall(row) &&
              row.url === request.url &&
              row.requestId === request.preflightFor,
          ));
      if (legacyInstitutionRead)
        legacyInstitutionReads.push({
          phase: request.phase,
          path: requestUrl.pathname,
          method: request.method,
        });
      else {
        assert.equal(request.hasAuthorization, false);
        assert.ok(!/\/(?:local|staff-local)\//u.test(new URL(request.url).pathname));
        if (requestUrl.protocol === "http:" || requestUrl.protocol === "https:")
          assert.ok([baseUrl, adminBaseUrl].includes(requestUrl.origin));
      }
      const url = new URL(request.url);
      if (url.protocol === "http:" || url.protocol === "https:")
        assert.ok(
          origins.has(url.origin),
          "网络请求必须是明确本机来源：" + url.pathname.slice(0, 120),
        );
      else {
        assert.equal(request.resourceType, "Image", "非HTTP资源只能是内嵌图片。");
        assert.match(
          request.url,
          /^data:image\/svg\+xml;base64,(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u,
          "只允许严格base64 SVG图片，不推断其来源。",
        );
      }
    }
    for (const view of views)
      assert.deepEqual(
        await evaluate(view.page, "({local:localStorage.length,session:sessionStorage.length})"),
        { local: 0, session: 0 },
      );
    assert.deepEqual(
      failedLoads.filter((row) => !verifiedRouteCancellations.has(key(row.role, row.requestId))),
      [],
    );
    assert.deepEqual(pageErrors, []);
    t.diagnostic("未迁移的机构概览学习设置只读现场：" + JSON.stringify(legacyInstitutionReads));
    t.diagnostic(
      "管理与员工两个真实标签页共用单一本机API；四类目标分派、领取开始与三种完成结果、退回重做/验收/取消、精确四个503、重复点击及React离页迟到响应完成验证。",
    );
  },
);
