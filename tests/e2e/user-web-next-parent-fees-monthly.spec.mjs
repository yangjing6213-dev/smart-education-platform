/* global fetch */
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL, URL } from "node:url";
import test from "node:test";
import {
  repositoryRoot,
  artifactRoot as artifactsRoot,
  apiRuntimeRoot,
  startLegacyBrowser as startNextBrowser,
} from "./helpers/child-monthly-web-browser.mjs";
import { assertTaskOwnedDirectory } from "./helpers/release-browser-paths.mjs";
const { createApiApp } = await import(pathToFileURL(resolve(apiRuntimeRoot, "nest/api-app.js")));
const { InviteAuthService, createInvitePasswordHash } = await import(
  pathToFileURL(resolve(apiRuntimeRoot, "nest/invite-auth.service.js"))
);
import {
  capture,
  clickParentControl,
  createLocalProfile,
  evaluate,
  localApiRequest,
  navigate,
  waitForExpression,
} from "./helpers/user-web-next-browser.mjs";

const fixedNow = "2026-10-12T01:00:00.000Z";
const supplements = {
  learningParticipation: "PROGRESSING",
  dailyHabits: "KEEP_WATCHING",
  activityParticipation: "PROGRESSING",
  familySchoolCollaboration: "FOLLOW_UP",
};
const valueLabels = { PROGRESSING: "已有进步", KEEP_WATCHING: "保持关注", FOLLOW_UP: "需要跟进" };
const itemLabels = ["学习参与", "日常习惯", "活动参与", "家校协作"];

// This legacy regression keeps its shared synthetic fee fixtures. Only the monthly
// transport is projected into the current child/relationship contract; the real
// Prisma workflow lives in child-monthly-web-invite.spec.mjs.
function childMonthlyFixture(local) {
  const publications = new Map();
  const scopes = (scope) => ({ scopes: [scope] });
  const relationships = (scope) => local.guardianBindingOperations.listRelationships(scopes(scope));
  const parent = (scope) =>
    local.parentGovernanceOperations.resolveMember({
      ...scope,
      capabilities: ["binding:read", "binding:apply"],
    });
  const rows = (scope, relationshipId) => {
    const relationship = relationships(scope).find(
      (row) => row.id === relationshipId && row.status === "ACTIVE",
    );
    if (!relationship) return [];
    return local.parentGovernanceOperations
      .parentMonthlyFeedback(parent(scope))
      .filter((row) => row.status === "PUBLISHED")
      .map((row) => {
        const previous = publications.get(row.id);
        if (!previous || previous.rawVersion !== row.version)
          publications.set(row.id, {
            rawVersion: row.version,
            publicationVersion: (previous?.publicationVersion ?? 0) + 1,
          });
        return {
          id: row.id,
          studentId: relationship.student_id,
          studentLabel: "模拟数据孩子甲",
          month: row.month,
          publicationVersion: publications.get(row.id).publicationVersion,
          relationshipVersion: relationship.version,
          supplements: Object.fromEntries(
            Object.keys(supplements).map((field, index) => [field, row.items[index].value]),
          ),
          sourceCounts: { GROWTH_RECORD: 1, ATTENDANCE_OVERVIEW: 0 },
          acknowledged: row.acknowledged,
        };
      });
  };
  return {
    resolveParentScope: async (context, id) => {
      const scope = context.scopes.find((scope) =>
        relationships(scope).some((row) => row.id === id && row.status === "ACTIVE"),
      );
      return scope
        ? { ok: true, data: scope }
        : {
            ok: false,
            error: { code: "NOT_FOUND_SCOPED", message: "Synthetic relationship unavailable" },
          };
    },
    listParent: async (scope, id) => ({ ok: true, data: { records: rows(scope, id) } }),
    acknowledgeParent: async (scope, relationshipId, id, input) => {
      const row = rows(scope, relationshipId).find((row) => row.id === id);
      if (
        !row ||
        row.publicationVersion !== input.publicationVersion ||
        row.relationshipVersion !== input.relationshipVersion
      )
        return {
          ok: false,
          error: { code: "CONFLICT_STATE", message: "Synthetic stale publication or relationship" },
        };
      const updated = local.parentGovernanceOperations.acknowledgeParentMonthlyFeedback(
        parent(scope),
        id,
        { version: publications.get(id).rawVersion },
      );
      publications.get(id).rawVersion = updated.version;
      return { ok: true, data: { acknowledged: true } };
    },
  };
}

async function publishCare(baseUrl, teacher, owner, date) {
  let row = await localApiRequest(baseUrl, "/local/care-records", teacher, "POST", {
    student: "student-alpha",
    date,
    values: {
      arrival: "ARRIVED_AS_PLANNED",
      homework: "COMPLETED",
      meal: "FINISHED",
      rest: "RESTED",
      activity: "PARTICIPATED",
      wellbeing: "ROUTINE",
    },
  });
  for (const [actor, action, extra] of [
    [teacher, "submit", {}],
    [owner, "review", { action: "confirm" }],
    [owner, "publish", {}],
  ]) {
    row = await localApiRequest(baseUrl, `/local/care-records/${row.id}/${action}`, actor, "POST", {
      version: row.version,
      ...extra,
    });
  }
  return row;
}

async function waitForPanel(page, panel, status = "READY") {
  await waitForExpression(
    page,
    `document.querySelector('[data-parent-${panel}-state]')?.getAttribute('data-parent-${panel}-state') === '${status}'`,
    `${panel} 面板未进入 ${status}`,
  );
}

async function assertEmpty(page, panel) {
  await waitForPanel(page, panel);
  const content = await evaluate(
    page,
    `(() => { const section=document.querySelector('[data-parent-${panel}-state]'); return {rows:section.querySelectorAll('[data-parent-fee-document], [data-parent-fee-ledger-entry], [data-parent-monthly-row]').length, text:section.innerText}; })()`,
  );
  assert.equal(content.rows, 0, `${panel} 在没有已批准关系或未发布时必须隐藏所有明细。`);
  assert.doesNotMatch(content.text, /课后托管服务费|¥680\.00|学习参与|日常习惯|家校协作/u);
}

async function assertMonthlyProjection(page, rows) {
  await waitForPanel(page, "monthly");
  const actual = await evaluate(
    page,
    `Array.from(document.querySelectorAll('[data-parent-monthly-row]')).map(row => ({month:row.dataset.month,status:row.dataset.monthlyStatus,acknowledged:row.dataset.acknowledged,text:row.innerText,html:row.outerHTML,items:Array.from(row.querySelectorAll('dl > div')).map(item => ({label:item.querySelector('dt')?.textContent.trim(),value:item.querySelector('dd')?.textContent.trim()}))}))`,
  );
  const published = rows.filter((row) => row.status === "PUBLISHED");
  assert.equal(actual.length, published.length, "家长只显示当前已发布的个人月报。");
  for (const expected of published) {
    const row = actual.find((item) => item.month === expected.month);
    assert.ok(row, "已发布月份应可见：" + expected.month);
    assert.equal(row.status, expected.status);
    assert.equal(row.acknowledged, String(expected.acknowledged));
    assert.equal(expected.items.length, 4);
    assert.deepEqual(
      row.items,
      expected.items.map((item, index) => ({
        label: itemLabels[index],
        value: valueLabels[item.value],
      })),
      "月报各字段必须对应当前发布版本的值。",
    );
    assert.doesNotMatch(
      row.html,
      /sourceSummary|sourceVersion|tenantId|campusId|classId|reviewedBy|authorId|parentAcknowledgedBy|data-record-id|data-version|GROWTH_RECORD|STAFF_DAILY|ATTENDANCE_OVERVIEW/u,
    );
    assert.ok(!row.html.includes(expected.id), "月报内部 ID 不能进入 DOM。");
  }
}

async function assertLayout(page, width) {
  await page.send("Emulation.setDeviceMetricsOverride", {
    width,
    height: width === 1365 ? 1000 : 900,
    deviceScaleFactor: 1,
    mobile: width !== 1365,
  });
  await delay(150);
  const layout = await evaluate(
    page,
    "({width:innerWidth,scroll:document.documentElement.scrollWidth,body:document.body.scrollWidth})",
  );
  assert.ok(
    layout.scroll <= layout.width && layout.body <= layout.width,
    `页面在 ${width}px 不能横向溢出：${JSON.stringify(layout)}`,
  );
}

test("Next parent fees and monthly feedback use shared local data and current permissions", async (t) => {
  const username = "parent-fees-monthly-synthetic";
  const password = "Synthetic-Only-Monthly-2026!";
  const harness = await startNextBrowser(t, {
    repositoryRoot,
    fixedNow,
    startInviteApi: async (local) => {
      const inviteAuthService = new InviteAuthService([
        {
          username,
          password_hash: await createInvitePasswordHash(password),
          identity: {
            actor_id: "00000000-0000-4000-8000-000000000001",
            display_name: "合成家长甲",
          },
          memberships: [
            {
              tenant_id: "00000000-0000-4000-8000-000000000064",
              campus_ids: ["00000000-0000-4000-8000-000000000065"],
              status: "ACTIVE",
              capabilities: ["identity:read", "binding:read", "binding:apply", "care:read"],
            },
          ],
        },
      ]);
      const api = await createApiApp({
        inviteAuthService,
        guardianBindingOperations: local.guardianBindingOperations,
        parentGovernanceOperations: local.parentGovernanceOperations,
        careRecordOperations: local.careRecordOperations,
        childMonthlyOperations: childMonthlyFixture(local),
      });
      t.after(() => api.close());
      await api.listen(0, "127.0.0.1");
      return `http://127.0.0.1:${api.getHttpServer().address().port}`;
    },
  });
  const { baseUrl, apiBaseUrl } = harness;
  for (const path of ["/web/parent/fees", "/web/parent/monthly"]) {
    const response = await fetch(baseUrl + path);
    assert.equal(response.status, 200, "新增家长页面必须可达：" + path);
  }
  const requests = [];
  const writes = [];
  const failedResponses = [];
  const failedLoads = [];
  const requestUrls = new Map();
  let navigationPhase = "initialization";
  const diagnosticReads = [];
  const pageErrors = [];
  const injectedFailures = new Map();
  const initialUnauthenticatedChecks = new Set();
  let finishInitialIdentity;
  const initialIdentityFinished = new Promise((resolveFinished) => {
    finishInitialIdentity = resolveFinished;
  });
  let loginSubmitted = false;
  let heldUrl;
  let heldMethod;
  let paused;
  let page;
  page = await harness.connectPage((method, params) => {
    if (method === "Network.requestWillBeSent") {
      requests.push({ url: params.request.url, method: params.request.method });
      const metadata = {
        url: params.request.url,
        documentUrl: params.documentURL,
        frameId: params.frameId,
        phase: navigationPhase,
        initiator: {
          type: params.initiator?.type,
          frames: params.initiator?.stack?.callFrames?.slice(0, 3).map((frame) => ({
            functionName: frame.functionName,
            url: frame.url,
            lineNumber: frame.lineNumber,
          })),
        },
      };
      requestUrls.set(params.requestId, metadata);
      if (params.request.url === baseUrl + "/api-local/me")
        diagnosticReads.push(
          evaluate(
            page,
            "({url:location.href,ready:document.readyState,timeOrigin:performance.timeOrigin})",
          )
            .then((state) => {
              metadata.stateObservedAfterEvent = state;
            })
            .catch(() => {
              metadata.stateObservedAfterEvent = "execution context changed";
            }),
        );
      if (
        /\/api-local\/parent\/relationships\/[0-9a-f-]{36}\/monthly-reports\/[0-9a-f-]{36}\/ack$/iu.test(
          params.request.url,
        )
      )
        writes.push({
          url: params.request.url,
          method: params.request.method,
          body: JSON.parse(params.request.postData),
        });
    }
    if (method === "Network.responseReceived" && params.response.status >= 400) {
      failedResponses.push({
        requestId: params.requestId,
        url: params.response.url,
        status: params.response.status,
      });
      if (
        !loginSubmitted &&
        params.response.status === 401 &&
        params.response.url === baseUrl + "/api-local/me"
      ) {
        initialUnauthenticatedChecks.add(params.requestId);
      }
    }
    if (method === "Network.loadingFailed")
      failedLoads.push({
        error: params.errorText,
        request: requestUrls.get(params.requestId),
        failedInPhase: navigationPhase,
        type: params.type,
        canceled: params.canceled,
      });
    if (method === "Network.loadingFinished" && initialUnauthenticatedChecks.has(params.requestId))
      finishInitialIdentity();
    if (method === "Runtime.exceptionThrown")
      pageErrors.push(params.exceptionDetails?.text ?? "网页脚本错误");
    if (method === "Fetch.requestPaused") {
      if (params.request.url === heldUrl && params.request.method === heldMethod) {
        heldUrl = undefined;
        paused = params;
      } else {
        void page
          .send("Fetch.continueRequest", { requestId: params.requestId })
          .catch((error) => pageErrors.push(error.message));
      }
    }
  });
  navigationPhase = "open login";
  await navigate(
    page,
    `${baseUrl}/web/login?next=${encodeURIComponent("/web/parent/home")}`,
    "document.querySelector('[data-invite-state]')?.dataset.inviteState === 'IDLE'",
  );
  await clickParentControl(page, 'input[name="username"]');
  await page.send("Input.insertText", { text: username });
  await clickParentControl(page, 'input[name="password"]');
  await page.send("Input.insertText", { text: password });
  assert.equal(
    initialUnauthenticatedChecks.size,
    1,
    "全新浏览器应先确认尚未登录，再提交真实邀请账号。",
  );
  await Promise.race([
    initialIdentityFinished,
    delay(10000, undefined, { ref: false }).then(() => {
      throw new Error("登录页初始401身份探测必须完整结束后再提交登录。");
    }),
  ]);
  loginSubmitted = true;
  navigationPhase = "login submit then home";
  await clickParentControl(page, 'button[type="submit"]');
  await waitForExpression(
    page,
    "location.pathname === '/web/parent/home'",
    "真实邀请登录应进入家长首页。",
  );
  await waitForPanel(page, "care");
  const parent = await createLocalProfile(apiBaseUrl, "parent-alpha");
  const owner = await createLocalProfile(apiBaseUrl, "owner-east");
  const teacher = await createLocalProfile(apiBaseUrl, "teacher-east");
  const sourceCare = await publishCare(apiBaseUrl, teacher, owner, "2026-10-03");
  let monthly = await localApiRequest(apiBaseUrl, "/local/monthly-feedback", teacher, "POST", {
    month: "2026-10",
    supplements,
  });
  assert.equal(monthly.status, "DRAFT");
  for (const [actor, action, extra] of [
    [teacher, "submit", {}],
    [owner, "review", { action: "CONFIRM" }],
    [owner, "publish", {}],
  ]) {
    monthly = await localApiRequest(
      apiBaseUrl,
      `/local/monthly-feedback/${monthly.id}/${action}`,
      actor,
      "POST",
      { version: monthly.version, ...extra },
    );
  }
  assert.equal(monthly.status, "PUBLISHED", "无绑定/待审核测试必须有真实已发布内容可供隔离。");

  navigationPhase = "explicit home navigation after seed";
  await navigate(
    page,
    baseUrl + "/web/parent/home",
    "document.querySelector('h1')?.textContent === '家长首页'",
  );
  await waitForPanel(page, "care");
  for (const [panel, title] of [
    ["fees", "费用资料"],
    ["monthly", "孩子个人月报"],
  ]) {
    navigationPhase = `home entry to ${panel}`;
    await clickParentControl(page, `main a[href='/web/parent/${panel}']`);
    await waitForExpression(
      page,
      `document.querySelector('h1')?.textContent === '${title}' && !!document.querySelector('[data-testid="parent-${panel}-panel"]')`,
      "家长首页入口必须真实点击可达。",
    );
    await assertEmpty(page, panel);
    navigationPhase = `${panel} return to home`;
    await clickParentControl(page, "main a[href='/web/parent/home']");
    await waitForExpression(
      page,
      "location.pathname === '/web/parent/home'",
      "新页面必须返回家长首页。",
    );
    await waitForPanel(page, "care");
  }
  assert.deepEqual(await localApiRequest(apiBaseUrl, "/local/fees", parent), []);
  assert.deepEqual((await localApiRequest(apiBaseUrl, "/local/fee-ledger", parent)).entries, []);
  assert.deepEqual(await localApiRequest(apiBaseUrl, "/local/monthly-feedback-parent", parent), []);
  let binding = await localApiRequest(apiBaseUrl, "/local/binding-applications", parent, "POST", {
    student: "student-alpha",
    relationship: "GUARDIAN",
  });
  for (const panel of ["fees", "monthly"]) {
    navigationPhase = `pending-binding direct navigation to ${panel}`;
    await navigate(
      page,
      baseUrl + `/web/parent/${panel}`,
      `!!document.querySelector('[data-testid="parent-${panel}-panel"]')`,
    );
    await assertEmpty(page, panel);
  }
  binding = await localApiRequest(
    apiBaseUrl,
    `/local/binding-applications/${binding.id}/review`,
    owner,
    "POST",
    { version: binding.version, action: "approve" },
  );
  assert.equal(binding.status, "APPROVED");
  await clickParentControl(page, "[data-parent-monthly-refresh]");
  await assertMonthlyProjection(
    page,
    await localApiRequest(apiBaseUrl, "/local/monthly-feedback-parent", parent),
  );
  // Rebuild this same record through its real source-invalidated workflow for draft visibility checks.
  await publishCare(apiBaseUrl, teacher, owner, "2026-10-04");
  monthly = await localApiRequest(
    apiBaseUrl,
    `/local/monthly-feedback/${monthly.id}/source-refresh`,
    owner,
    "POST",
    { version: monthly.version },
  );
  assert.equal(monthly.status, "REVIEW_REQUIRED");
  monthly = await localApiRequest(
    apiBaseUrl,
    `/local/monthly-feedback/${monthly.id}`,
    teacher,
    "PATCH",
    { version: monthly.version, supplements },
  );
  assert.equal(monthly.status, "DRAFT");

  const proxy = (path, method = "GET", body) =>
    fetch(baseUrl + path, {
      method,
      headers: {
        authorization: "Bearer " + parent,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  const { cookies } = await page.send("Network.getCookies", { urls: [baseUrl + "/api-local/me"] });
  const invitedCookie = cookies.find((cookie) => cookie.name === "student_care_local_session");
  assert.ok(invitedCookie?.httpOnly, "邀请登录凭证必须保存在脚本不可读Cookie中。");
  assert.equal(invitedCookie.path, "/api-local");
  assert.equal(
    await evaluate(page, "document.cookie.includes('student_care_local_session')"),
    false,
  );
  const inviteProxy = (path, method = "GET", body) =>
    fetch(baseUrl + path, {
      method,
      headers: {
        cookie: `${invitedCookie.name}=${invitedCookie.value}`,
        origin: baseUrl,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  let relationship = (
    await (await inviteProxy("/api-local/guardian-relationships")).json()
  ).data.find((row) => row.status === "ACTIVE");
  assert.ok(relationship, "新个人月报必须先读取当前已批准关系。");
  let monthlyPath = `/api-local/parent/relationships/${relationship.id}/monthly-reports`;
  const childSummary = async (id) =>
    (await (await inviteProxy(monthlyPath)).json()).data.records.find((row) => row.id === id);
  for (const path of ["/api-local/parent/fees", monthlyPath]) {
    const allowed = await inviteProxy(path);
    assert.equal(allowed.status, 200);
    assert.equal(allowed.headers.get("cache-control"), "no-store");
    assert.equal((await fetch(baseUrl + path)).status, 401, "无邀请会话不能读取家长资料。");
    for (const query of ["?studentId=student-beta", "?version=1&version=2", "?tenantId=other"]) {
      assert.equal((await inviteProxy(path + query)).status, 400);
    }
    assert.equal((await inviteProxy(path, "POST", {})).status, 404);
    for (const method of ["HEAD", "PATCH"]) {
      assert.equal((await inviteProxy(path, method)).status, 404);
    }
    for (const method of ["PUT", "DELETE"]) {
      assert.equal((await inviteProxy(path, method)).status, 405);
    }
    // Next supplies a bodyless OPTIONS response; it must never return parent records.
    const options = await inviteProxy(path, "OPTIONS");
    assert.equal(options.status, 204);
    assert.equal(await options.text(), "");
  }
  for (const path of [
    "/api-local/parent/fees/fee-item-alpha/download",
    `${monthlyPath}/${monthly.id}/publish`,
    `${monthlyPath}/${monthly.id}/review`,
  ]) {
    assert.equal((await inviteProxy(path, "POST", { version: monthly.version })).status, 404);
  }
  for (const action of ["submit", "resubmit", "review", "source-refresh", "publish", "revoke"]) {
    assert.equal(
      (
        await inviteProxy(`${monthlyPath}/${monthly.id}/${action}`, "POST", {
          version: monthly.version,
        })
      ).status,
      404,
    );
  }
  for (const id of [
    "not-a-uuid",
    "00000000-0000-0000-0000-000000000000",
    "00000000-0000-6000-8000-000000000000",
  ]) {
    assert.equal(
      (
        await inviteProxy(`${monthlyPath}/${id}/ack`, "POST", {
          publicationVersion: 1,
          relationshipVersion: relationship.version,
        })
      ).status,
      404,
    );
  }
  const invitedAckPath = `${monthlyPath}/${monthly.id}/ack`;
  for (const method of ["GET", "HEAD", "PATCH"]) {
    assert.equal((await inviteProxy(invitedAckPath, method)).status, 404);
  }
  const ackOptions = await inviteProxy(invitedAckPath, "OPTIONS");
  assert.equal(ackOptions.status, 204);
  assert.equal(await ackOptions.text(), "");
  assert.equal(
    (
      await inviteProxy(invitedAckPath + "?version=1", "POST", {
        publicationVersion: 1,
        relationshipVersion: relationship.version,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await inviteProxy(`${monthlyPath}/${monthly.id}`, "PATCH", {
        version: 1,
        supplements,
      })
    ).status,
    404,
  );
  for (const profile of ["teacher-east", "owner-east", "parent-beta"]) {
    assert.equal(
      (await proxy("/local/sessions", "POST", { profile })).status,
      403,
      "Next 只可创建 parent-alpha 合成会话。",
    );
  }
  assert.equal((await (await proxy("/local/session")).json()).profile, "parent-alpha");
  for (const resource of ["fees", "fee-ledger", "monthly-feedback-parent"]) {
    const allowed = await proxy(`/local/${resource}`);
    assert.equal(allowed.status, 200);
    assert.equal(allowed.headers.get("cache-control"), "no-store");
    for (const query of ["?studentId=student-beta", "?version=1&version=2", "?tenantId=other"])
      assert.equal((await proxy(`/local/${resource}${query}`)).status, 400);
    for (const method of ["HEAD", "OPTIONS", "POST"])
      assert.equal(
        (await proxy(`/local/${resource}`, method, method === "POST" ? {} : undefined)).status,
        404,
      );
    for (const method of ["PUT", "PATCH", "DELETE"])
      assert.equal((await proxy(`/local/${resource}`, method)).status, 405);
  }
  for (const path of [
    "/local/monthly-feedback",
    ...["submit", "resubmit", "review", "source-refresh", "publish", "revoke"].map(
      (action) => `/local/monthly-feedback/${monthly.id}/${action}`,
    ),
    "/local/fees",
    "/local/fee-ledger",
    "/local/fees/fee-item-alpha/download",
  ])
    assert.equal(
      (await proxy(path, "POST", { version: monthly.version })).status,
      404,
      "禁止员工/费用写入口：" + path,
    );
  for (const id of [
    "not-a-uuid",
    "00000000-0000-0000-0000-000000000000",
    "00000000-0000-6000-8000-000000000000",
  ])
    assert.equal(
      (await proxy(`/local/monthly-feedback/${id}/ack`, "POST", { version: 1 })).status,
      404,
    );
  for (const method of ["GET", "HEAD", "OPTIONS"])
    assert.equal((await proxy(`/local/monthly-feedback/${monthly.id}/ack`, method)).status, 404);
  assert.equal(
    (await proxy(`/local/monthly-feedback/${monthly.id}/ack?version=1`, "POST", { version: 1 }))
      .status,
    400,
  );
  assert.equal(
    (await proxy(`/local/monthly-feedback/${monthly.id}`, "PATCH", { version: 1, supplements }))
      .status,
    405,
  );

  navigationPhase = "direct fees page before fee assertions";
  await navigate(
    page,
    baseUrl + "/web/parent/fees",
    "!!document.querySelector('[data-parent-fees-state]')",
  );
  await waitForPanel(page, "fees");
  const documents = await localApiRequest(apiBaseUrl, "/local/fees", parent);
  const ledger = await localApiRequest(apiBaseUrl, "/local/fee-ledger", parent);
  assert.equal(documents.length, 6);
  assert.equal(
    documents.filter((row) => row.available).length,
    4,
    "固定时钟必须持续覆盖有效费用，不能随真实月份变化跳过。",
  );
  const feeRows = await evaluate(
    page,
    "Array.from(document.querySelectorAll('[data-parent-fee-document]')).map(row=>({text:row.innerText,html:row.outerHTML,status:row.dataset.documentStatus}))",
  );
  assert.equal(feeRows.length, documents.length);
  for (const document of documents) {
    const row = feeRows.find((item) => item.text.includes(document.title));
    assert.ok(row, "费用资料必须展示：" + document.title);
    assert.equal(row.status, document.status);
    if (document.available) {
      assert.ok(row.text.includes(document.summary));
      assert.ok(row.text.includes(document.period));
      if (document.amount !== null)
        assert.ok(row.text.includes("¥" + document.amount.toFixed(2)), "资料金额单位为元。");
    } else {
      assert.ok(row.text.includes(document.unavailableReason));
      assert.doesNotMatch(row.text, /¥|￥|2026-|合成历史协议正文|合成撤回资料/u);
      assert.doesNotMatch(row.html, /data-amount|data-summary|data-period|data-record-id/u);
    }
  }
  const ledgerText = await evaluate(
    page,
    "document.querySelector('[data-parent-fee-ledger]').innerText",
  );
  assert.equal(
    await evaluate(page, "document.querySelectorAll('[data-parent-fee-ledger-entry]').length"),
    3,
  );
  assert.deepEqual(ledger.reconciliation, {
    chargeMinor: 68000,
    paymentMinor: 76000,
    refundMinor: 8000,
    balanceDueMinor: 0,
    currency: "CNY",
  });
  for (const amount of ["¥680.00", "¥760.00", "¥80.00", "¥0.00"])
    assert.ok(ledgerText.includes(amount), "流水金额分应转换为元：" + amount);
  assert.doesNotMatch(ledgerText, /¥68000|¥76000|¥8000/u);
  assert.doesNotMatch(
    await evaluate(page, "document.querySelector('[data-parent-fees-state]').innerHTML"),
    /另一名学生|西校区服务费|其他机构服务费|student-beta|tenantId|campusId|classId|documentVersion|sourceVersion/u,
  );
  assertTaskOwnedDirectory(artifactsRoot, join(artifactsRoot, "screenshots"));
  await mkdir(join(artifactsRoot, "screenshots"), { recursive: true });
  for (const width of [1365, 390, 320]) {
    await assertLayout(page, width);
    if (width !== 320) {
      await evaluate(page, "window.scrollTo({top:0,behavior:'instant'})");
      assert.equal(await evaluate(page, "window.scrollY"), 0);
      assert.ok(
        await evaluate(
          page,
          "document.querySelector('.skip-link').getBoundingClientRect().bottom <= 0",
        ),
        "未聚焦的跳转链接应保持在视口外。",
      );
      await capture(
        page,
        join(artifactsRoot, "screenshots", width === 1365 ? "fees-desktop.png" : "fees-mobile.png"),
        true,
      );
    }
  }

  async function holdRequest(url, method = "GET") {
    paused = undefined;
    heldUrl = url;
    heldMethod = method;
    await page.send("Fetch.enable", { patterns: [{ urlPattern: url, requestStage: "Request" }] });
  }
  async function waitForPaused() {
    for (let attempt = 0; attempt < 80 && !paused; attempt += 1) await delay(50);
    assert.ok(paused, "真实目标请求必须被准确暂停。");
    return paused;
  }
  async function failRefresh(panel, path) {
    const url = baseUrl + path;
    await holdRequest(url);
    await clickParentControl(page, `[data-parent-${panel}-refresh]`);
    const request = await waitForPaused();
    await waitForPanel(page, panel, panel === "monthly" ? "CONNECTING" : "BUSY");
    assert.equal(
      await evaluate(page, `document.querySelector('[data-parent-${panel}-refresh]').disabled`),
      true,
    );
    assert.equal(
      await evaluate(
        page,
        "document.querySelectorAll('[data-parent-fee-document], [data-parent-fee-ledger-entry], [data-parent-fee-totals], [data-parent-monthly-row]').length",
      ),
      0,
      "请求途中必须立即清空旧明细与合计。",
    );
    assert.ok(request.networkId);
    injectedFailures.set(request.networkId, url);
    await page.send("Fetch.fulfillRequest", {
      requestId: request.requestId,
      responseCode: 503,
      responseHeaders: [{ name: "content-type", value: "application/json" }],
      body: Buffer.from(
        JSON.stringify({ error: { code: "LOCAL_SYNTHETIC_UNAVAILABLE" } }),
      ).toString("base64"),
    });
    await waitForPanel(page, panel, "ERROR");
    assert.equal(
      await evaluate(
        page,
        "document.querySelectorAll('[data-parent-fee-document], [data-parent-fee-ledger-entry], [data-parent-fee-totals], [data-parent-monthly-row]').length",
      ),
      0,
      "失败不能留下旧费用或月报。",
    );
    assert.equal(
      await evaluate(
        page,
        `document.querySelector('[data-parent-${panel}-refresh]').textContent.trim()`,
      ),
      "重新连接",
    );
    await page.send("Fetch.disable");
    await clickParentControl(page, `[data-parent-${panel}-refresh]`);
    await waitForPanel(page, panel);
  }
  // Documents and ledger now share one endpoint; retain both independent failure/recovery rounds.
  for (let failureRound = 0; failureRound < 2; failureRound += 1) {
    await failRefresh("fees", "/api-local/parent/fees");
    assert.equal(
      await evaluate(page, "document.querySelectorAll('[data-parent-fee-document]').length"),
      6,
    );
    assert.equal(
      await evaluate(page, "document.querySelectorAll('[data-parent-fee-ledger-entry]').length"),
      3,
    );
  }
  const originalBindingId = binding.id;
  await localApiRequest(
    apiBaseUrl,
    `/local/binding-applications/${binding.id}/release`,
    parent,
    "POST",
    { version: binding.version },
  );
  await clickParentControl(page, "[data-parent-fees-refresh]");
  await assertEmpty(page, "fees");
  assert.equal(
    await evaluate(
      page,
      "document.querySelectorAll('[data-parent-fee-ledger], [data-parent-fee-totals]').length",
    ),
    0,
    "原费用页解除关系后刷新必须清除已显示流水和合计。",
  );
  assert.deepEqual(await localApiRequest(apiBaseUrl, "/local/fees", parent), []);
  assert.deepEqual((await localApiRequest(apiBaseUrl, "/local/fee-ledger", parent)).entries, []);
  binding = await localApiRequest(apiBaseUrl, "/local/binding-applications", parent, "POST", {
    student: "student-alpha",
    relationship: "GUARDIAN",
  });
  binding = await localApiRequest(
    apiBaseUrl,
    `/local/binding-applications/${binding.id}/review`,
    owner,
    "POST",
    { version: binding.version, action: "approve" },
  );
  assert.equal(binding.status, "APPROVED");
  assert.notEqual(binding.id, originalBindingId);
  relationship = (await (await inviteProxy("/api-local/guardian-relationships")).json()).data.find(
    (row) => row.status === "ACTIVE",
  );
  assert.ok(relationship);
  monthlyPath = `/api-local/parent/relationships/${relationship.id}/monthly-reports`;
  await clickParentControl(page, "[data-parent-fees-refresh]");
  await assertEmpty(page, "fees");
  assert.deepEqual(
    await localApiRequest(apiBaseUrl, "/local/fees", parent),
    [],
    "新批准关系不能继承旧关系的费用资料。",
  );
  assert.deepEqual(
    (await localApiRequest(apiBaseUrl, "/local/fee-ledger", parent)).entries,
    [],
    "新批准关系不能继承旧关系的费用流水。",
  );

  navigationPhase = "direct monthly page after rebind";
  await navigate(
    page,
    baseUrl + "/web/parent/monthly",
    "!!document.querySelector('[data-parent-monthly-state]')",
  );
  await assertEmpty(page, "monthly");
  for (const [actor, action, extra] of [
    [teacher, "submit", {}],
    [owner, "review", { action: "CONFIRM" }],
  ]) {
    monthly = await localApiRequest(
      apiBaseUrl,
      `/local/monthly-feedback/${monthly.id}/${action}`,
      actor,
      "POST",
      { version: monthly.version, ...extra },
    );
    await clickParentControl(page, "[data-parent-monthly-refresh]");
    await assertEmpty(page, "monthly");
  }
  monthly = await localApiRequest(
    apiBaseUrl,
    `/local/monthly-feedback/${monthly.id}/publish`,
    owner,
    "POST",
    { version: monthly.version },
  );
  await clickParentControl(page, "[data-parent-monthly-refresh]");
  let summaries = await localApiRequest(apiBaseUrl, "/local/monthly-feedback-parent", parent);
  assert.equal(summaries.length, 1);
  assert.equal(summaries[0].acknowledged, false);
  await assertMonthlyProjection(page, summaries);
  const session = await localApiRequest(apiBaseUrl, "/local/session", parent);
  const monthlyHtml = await evaluate(
    page,
    "document.querySelector('[data-parent-monthly-state]').outerHTML",
  );
  for (const internal of [sourceCare.id, session.tenantId, session.campusId, ...session.classIds])
    assert.ok(!monthlyHtml.includes(internal), "内部来源和机构范围标识不得进入家长 DOM。");
  for (const width of [1365, 390, 320]) {
    await assertLayout(page, width);
    if (width !== 320) {
      await evaluate(page, "window.scrollTo({top:0,behavior:'instant'})");
      assert.equal(await evaluate(page, "window.scrollY"), 0);
      assert.ok(
        await evaluate(
          page,
          "document.querySelector('.skip-link').getBoundingClientRect().bottom <= 0",
        ),
        "未聚焦的跳转链接应保持在视口外。",
      );
      await capture(
        page,
        join(
          artifactsRoot,
          "screenshots",
          width === 1365 ? "monthly-desktop.png" : "monthly-mobile.png",
        ),
        true,
      );
    }
  }

  async function acknowledgeOnce(row) {
    const projected = await childSummary(row.id);
    assert.ok(projected);
    const url = `${baseUrl}${monthlyPath}/${row.id}/ack`;
    const count = writes.length;
    await holdRequest(url, "POST");
    const point = await clickParentControl(
      page,
      '[data-parent-monthly-row][data-month="2026-10"] [data-parent-monthly-action="ack"]',
    );
    await page.send("Input.dispatchMouseEvent", {
      type: "mousePressed",
      button: "left",
      clickCount: 2,
      ...point,
    });
    await page.send("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      button: "left",
      clickCount: 2,
      ...point,
    });
    const request = await waitForPaused();
    await waitForPanel(page, "monthly", "BUSY");
    await delay(150);
    assert.equal(writes.length, count + 1, "确认按钮在请求未完成时真实双击只应写入一次。");
    assert.deepEqual(writes.at(-1), {
      url,
      method: "POST",
      body: {
        publicationVersion: projected.publicationVersion,
        relationshipVersion: projected.relationshipVersion,
      },
    });
    assert.equal(
      await evaluate(page, "document.querySelector('[data-parent-monthly-refresh]').disabled"),
      true,
    );
    assert.equal(
      await evaluate(page, "document.querySelectorAll('[data-parent-monthly-row]').length"),
      0,
    );
    await page.send("Fetch.continueRequest", { requestId: request.requestId });
    await waitForExpression(
      page,
      "document.querySelector('[data-parent-monthly-row]')?.dataset.acknowledged === 'true'",
      "确认应在真实服务回执后更新。",
    );
    await page.send("Fetch.disable");
    const rows = await localApiRequest(apiBaseUrl, "/local/monthly-feedback-parent", parent);
    assert.equal(rows[0].acknowledged, true);
    await assertMonthlyProjection(page, rows);
    assert.equal(
      await evaluate(page, "document.querySelectorAll('[data-parent-monthly-action=ack]').length"),
      0,
    );
    return {
      ...rows[0],
      publicationVersion: projected.publicationVersion,
      relationshipVersion: projected.relationshipVersion,
    };
  }
  const previouslyAcknowledged = await acknowledgeOnce(summaries[0]);
  await failRefresh("monthly", monthlyPath);
  await assertMonthlyProjection(
    page,
    await localApiRequest(apiBaseUrl, "/local/monthly-feedback-parent", parent),
  );

  await publishCare(apiBaseUrl, teacher, owner, "2026-10-05");
  monthly = await localApiRequest(
    apiBaseUrl,
    `/local/monthly-feedback/${monthly.id}/source-refresh`,
    owner,
    "POST",
    { version: previouslyAcknowledged.version },
  );
  assert.equal(monthly.status, "REVIEW_REQUIRED");
  await clickParentControl(page, "[data-parent-monthly-refresh]");
  summaries = await localApiRequest(apiBaseUrl, "/local/monthly-feedback-parent", parent);
  assert.equal(summaries[0].status, "REVIEW_REQUIRED");
  assert.deepEqual(summaries[0].items, []);
  assert.equal(summaries[0].acknowledged, false);
  await assertMonthlyProjection(page, summaries);
  assert.equal(
    await evaluate(page, "document.querySelectorAll('[data-parent-monthly-action=ack]').length"),
    0,
  );
  const changed = {
    learningParticipation: "FOLLOW_UP",
    dailyHabits: "PROGRESSING",
    activityParticipation: "KEEP_WATCHING",
    familySchoolCollaboration: "PROGRESSING",
  };
  monthly = await localApiRequest(
    apiBaseUrl,
    `/local/monthly-feedback/${monthly.id}`,
    teacher,
    "PATCH",
    { version: monthly.version, supplements: changed },
  );
  assert.equal(monthly.status, "DRAFT");
  await clickParentControl(page, "[data-parent-monthly-refresh]");
  await assertEmpty(page, "monthly");
  for (const [actor, action, extra] of [
    [teacher, "submit", {}],
    [owner, "review", { action: "CONFIRM" }],
  ]) {
    monthly = await localApiRequest(
      apiBaseUrl,
      `/local/monthly-feedback/${monthly.id}/${action}`,
      actor,
      "POST",
      { version: monthly.version, ...extra },
    );
    await clickParentControl(page, "[data-parent-monthly-refresh]");
    await assertEmpty(page, "monthly");
  }
  monthly = await localApiRequest(
    apiBaseUrl,
    `/local/monthly-feedback/${monthly.id}/publish`,
    owner,
    "POST",
    { version: monthly.version },
  );
  await clickParentControl(page, "[data-parent-monthly-refresh]");
  summaries = await localApiRequest(apiBaseUrl, "/local/monthly-feedback-parent", parent);
  assert.equal(summaries[0].acknowledged, false, "重审重发必须清除旧回执。");
  assert.deepEqual(
    summaries[0].items.map((item) => item.value),
    Object.values(changed),
  );
  await assertMonthlyProjection(page, summaries);
  assert.equal(
    (
      await proxy(`/local/monthly-feedback/${monthly.id}/ack`, "POST", {
        version: previouslyAcknowledged.version,
      })
    ).status,
    409,
    "旧版本回执不能确认新版反馈。",
  );
  assert.equal(
    (await localApiRequest(apiBaseUrl, "/local/monthly-feedback-parent", parent))[0].acknowledged,
    false,
  );
  assert.equal(
    (
      await inviteProxy(`${monthlyPath}/${monthly.id}/ack`, "POST", {
        publicationVersion: previouslyAcknowledged.publicationVersion,
        relationshipVersion: previouslyAcknowledged.relationshipVersion,
      })
    ).status,
    409,
    "邀请接口也必须拒绝旧版本确认。",
  );
  await acknowledgeOnce(summaries[0]);

  await localApiRequest(
    apiBaseUrl,
    `/local/binding-applications/${binding.id}/release`,
    parent,
    "POST",
    { version: binding.version },
  );
  await clickParentControl(page, "[data-parent-monthly-refresh]");
  await assertEmpty(page, "monthly");
  assert.deepEqual(await localApiRequest(apiBaseUrl, "/local/monthly-feedback-parent", parent), []);
  navigationPhase = "final monthly return to home";
  await clickParentControl(page, "main a[href='/web/parent/home']");
  await waitForExpression(page, "location.pathname === '/web/parent/home'", "月报页返回链应可达。");
  await waitForPanel(page, "care");
  navigationPhase = "final home to fees";
  await clickParentControl(page, "main a[href='/web/parent/fees']");
  await assertEmpty(page, "fees");
  assert.deepEqual(await localApiRequest(apiBaseUrl, "/local/fees", parent), []);
  assert.deepEqual((await localApiRequest(apiBaseUrl, "/local/fee-ledger", parent)).entries, []);
  assert.equal(
    await evaluate(page, "document.querySelectorAll('[data-parent-fee-totals]').length"),
    0,
  );
  assert.equal(writes.length, 2, "两次发布各允许一次真实家长确认。");
  assert.equal(injectedFailures.size, 3);
  for (const [path, count] of [
    ["/api-local/parent/fees", 2],
    [monthlyPath, 1],
  ]) {
    const url = baseUrl + path;
    assert.equal(
      failedResponses.filter(
        (row) =>
          row.url === url && row.status === 503 && injectedFailures.get(row.requestId) === url,
      ).length,
      count,
      "费用/流水各一次、月报一次精确503注入；不能隐藏其他失败。",
    );
  }
  assert.deepEqual(
    failedResponses.filter(
      (row) =>
        !(row.status === 503 && injectedFailures.get(row.requestId) === row.url) &&
        !initialUnauthenticatedChecks.has(row.requestId),
    ),
    [],
    "不能隐藏任何其他网络错误。",
  );
  assert.deepEqual(
    requests.filter((row) => /^https?:/u.test(row.url) && new URL(row.url).origin !== baseUrl),
    [],
    "浏览器只能请求本站回环服务。",
  );
  await Promise.all(diagnosticReads);
  assert.deepEqual(failedLoads, [], "不能出现传输失败。");
  assert.deepEqual(pageErrors, [], "不能出现网页脚本异常。");
});
