import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import { clearTimeout, setTimeout } from "node:timers";
import process from "node:process";
import test from "node:test";
import {
  MiniCareRecordApi,
  resolveMiniApiConfig,
} from "../../apps/mini-program/src/local-synthetic/care-record-api.ts";

const root = fileURLToPath(new URL("../../", import.meta.url));
const launcher = fileURLToPath(new URL("../../scripts/start-local-synthetic.mjs", import.meta.url));

async function startLocalSynthetic() {
  const child = spawn(process.execPath, [launcher, "--local-synthetic", "--port", "0"], {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  let output = "";
  let errors = "";
  const ready = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error("本机合成服务启动超时。"));
    }, 60000);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      errors += chunk;
    });
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`本机合成服务在就绪前退出（${code}）：${errors}`));
    });
    child.stdout.on("data", (chunk) => {
      output += chunk;
      let newline = output.indexOf("\n");
      while (newline >= 0) {
        const line = output.slice(0, newline).trim();
        output = output.slice(newline + 1);
        if (line.startsWith('{"status":"ready"')) {
          clearTimeout(timeout);
          resolve(JSON.parse(line));
          return;
        }
        newline = output.indexOf("\n");
      }
    });
  });
  return {
    child,
    ready,
    stop: async () => {
      if (child.exitCode !== null) return;
      const exit = once(child, "exit");
      child.kill();
      await exit;
    },
  };
}

function createMemorySessionStore() {
  let stored = null;
  return {
    load: () => stored,
    save: (session) => {
      stored = session;
    },
    clear: () => {
      stored = null;
    },
    get value() {
      return stored;
    },
  };
}

function replaceGlobal(name, value) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  return () => {
    if (previous) Object.defineProperty(globalThis, name, previous);
    else delete globalThis[name];
  };
}

async function loadMiniPageDefinitions() {
  const definitions = [];
  let globalData = {
    careApi: null,
    sessionReady: Promise.resolve(),
    sessionIssue: "",
  };
  const restore = [
    replaceGlobal("Page", (definition) => definitions.push(definition)),
    replaceGlobal("getApp", () => ({ globalData })),
    replaceGlobal("wx", {
      navigateTo() {},
      redirectTo() {},
      reLaunch() {},
    }),
  ];
  try {
    await import(new URL("../../apps/mini-program/pages/parent/care-records/index.ts", import.meta.url));
    await import(new URL("../../apps/mini-program/pages/staff/workbench/index.ts", import.meta.url));
    await import(new URL("../../apps/mini-program/pages/staff/care-records/index.ts", import.meta.url));
    assert.equal(definitions.length, 3, "应载入真实家长成长记录页、员工工作台和员工成长记录页");
    return {
      createParentPage: () => ({ ...definitions[0], data: structuredClone(definitions[0].data) }),
      createStaffPage: () => ({ ...definitions[1], data: structuredClone(definitions[1].data) }),
      createStaffCarePage: () => ({ ...definitions[2], data: structuredClone(definitions[2].data) }),
      setCareApi: (careApi) => {
        globalData = { ...globalData, careApi };
      },
      restore: () => restore.reverse().forEach((restoreGlobal) => restoreGlobal()),
    };
  } catch (error) {
    restore.reverse().forEach((restoreGlobal) => restoreGlobal());
    throw error;
  }
}

async function waitFor(predicate, label) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`等待 Mini 页面完成${label}超时。`);
}

function futureDate(days) {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
}

test("Mini invited parent submits leave in-page, staff reviews it, and parent confirms the same request", async () => {
  const local = await startLocalSynthetic();
  const requests = [];
  const failedRequests = [];
  const stores = {
    parent: createMemorySessionStore(),
    staff: createMemorySessionStore(),
    teacher: createMemorySessionStore(),
  };
  const request = async (url, options) => {
    const target = new URL(url);
    assert.equal(target.protocol, "http:");
    assert.equal(target.hostname, "127.0.0.1");
    assert.equal(target.port, "4321");
    requests.push(`${options.method} ${target.pathname}`);
    const response = await fetch(target, {
      method: options.method,
      headers: options.headers,
      ...(options.data === undefined ? {} : { body: JSON.stringify(options.data) }),
    });
    const body = await response.text();
    if (response.status >= 400) failedRequests.push(`${response.status} ${options.method} ${target.pathname}`);
    return { statusCode: response.status, data: body ? JSON.parse(body) : null };
  };

  try {
    const apiConfig = resolveMiniApiConfig("develop");
    assert.deepEqual(apiConfig, {
      environment: "develop",
      baseUrl: "http://127.0.0.1:4321",
    });
    assert.equal(local.ready.apiBaseUrl, apiConfig.baseUrl);

    const parent = new MiniCareRecordApi({
      baseUrl: apiConfig.baseUrl,
      environment: apiConfig.environment,
      request,
      sessionStore: stores.parent,
    });
    let parentSnapshot;
    try {
      parentSnapshot = await parent.login(
        local.ready.inviteCredentials.parent.username,
        local.ready.inviteCredentials.parent.password,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`${message}; failed local requests: ${failedRequests.join("; ")}`);
    }
    assert.equal(parentSnapshot.role, "PARENT");
    assert.equal(parentSnapshot.displayName, "示例监护人甲");
    assert.equal(parentSnapshot.capabilities.includes("binding:apply"), true);
    assert.equal(parentSnapshot.capabilities.includes("binding:review"), false);
    assert.equal(parentSnapshot.capabilities.includes("leave:apply"), true);
    assert.equal(parentSnapshot.capabilities.includes("leave:read"), true);
    assert.equal(parentSnapshot.capabilities.includes("leave:review"), false);
    assert.equal(stores.parent.value?.accessToken, parent.accessToken);

    const submitted = await parent.submitGuardianBinding();
    const application = submitted.guardianApplications[0];
    assert.ok(application);
    assert.equal(application.status, "PENDING");

    const staff = new MiniCareRecordApi({
      baseUrl: apiConfig.baseUrl,
      environment: apiConfig.environment,
      request,
      sessionStore: stores.staff,
    });
    let staffSnapshot;
    try {
      staffSnapshot = await staff.login(
        local.ready.inviteCredentials.staff.username,
        local.ready.inviteCredentials.staff.password,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`${message}; failed local requests: ${failedRequests.join("; ")}`);
    }
    assert.equal(staffSnapshot.role, "STAFF");
    assert.equal(staffSnapshot.capabilities.includes("binding:review"), true);
    assert.equal(staffSnapshot.capabilities.includes("binding:apply"), false);
    assert.equal(staffSnapshot.capabilities.includes("leave:review"), true);
    assert.equal(staffSnapshot.capabilities.includes("leave:apply"), false);
    assert.ok(staffSnapshot.guardianApplications.some((item) => item.id === application.id));

    const unavailableCareResponse = await request(`${apiConfig.baseUrl}/staff/care-records`, {
      method: "GET",
      headers: { authorization: `Bearer ${parent.accessToken}` },
    });
    assert.equal(
      unavailableCareResponse.statusCode,
      403,
      "the local Nest care-record route should exist and reject the parent account from the staff queue",
    );

    const callsBeforeDeniedActions = requests.length;
    await assert.rejects(
      parent.reviewGuardianBinding(application.id, application.version, "approve"),
      /不可审核/u,
    );
    await assert.rejects(staff.submitGuardianBinding(), /没有家长关系申请权限/u);
    assert.equal(requests.length, callsBeforeDeniedActions);

    await staff.reviewGuardianBinding(application.id, application.version, "approve");
    const refreshedParent = await parent.refresh();
    assert.equal(
      refreshedParent.guardianApplications.find((item) => item.id === application.id)?.status,
      "APPROVED",
    );
    assert.ok(requests.some((call) => call === "POST /guardian-binding/applications"));
    assert.ok(
      requests.some(
        (call) => call === `POST /staff/guardian-binding/applications/${application.id}/review`,
      ),
    );

    assert.equal(refreshedParent.leaveBindings.length, 1);
    const pageRuntime = await loadMiniPageDefinitions();
    try {
      const parentTemplate = readFileSync(
        new URL("../../apps/mini-program/pages/parent/care-records/index.wxml", import.meta.url),
        "utf8",
      );
      const staffTemplate = readFileSync(
        new URL("../../apps/mini-program/pages/staff/workbench/index.wxml", import.meta.url),
        "utf8",
      );
      const staffCareTemplate = readFileSync(
        new URL("../../apps/mini-program/pages/staff/care-records/index.wxml", import.meta.url),
        "utf8",
      );
      assert.match(parentTemplate, /<form\b[^>]*bindsubmit="handleLeaveSubmit"/u);
      assert.match(parentTemplate, /bindchange="handleLeaveBindingChange"/u);
      assert.match(parentTemplate, /data-field="startDate" bindchange="handleLeaveDateChange"/u);
      assert.match(parentTemplate, /bindchange="handleLeaveReasonChange"/u);
      assert.match(staffTemplate, /wx:if="\{\{canReviewLeave\}\}"/u);
      assert.match(staffTemplate, /bindtap="handleLeaveReview"/u);
      assert.match(staffCareTemplate, /<form\b[^>]*bindsubmit="handleSubmit"/u);
      assert.match(staffCareTemplate, /bindchange="handleFieldChange"/u);
      assert.match(staffCareTemplate, /data-action="review-confirm"/u);
      assert.match(staffCareTemplate, /data-action="publish"/u);
      assert.match(parentTemplate, /data-action="read"/u);
      assert.match(parentTemplate, /data-action="acknowledge"/u);

      pageRuntime.setCareApi(parent);
      const parentPage = pageRuntime.createParentPage();
      parentPage.onShow();
      await waitFor(() => parentPage.data.status === "READY" && !parentPage.data.busy, "家长资料加载");
      assert.equal(parentPage.data.canApplyLeave, true);
      assert.equal(parentPage.data.leaveBindings[0]?.reference, parent.snapshot.leaveBindings[0]?.reference);

      const startDate = futureDate(2);
      const endDate = futureDate(3);
      parentPage.handleLeaveBindingChange({ detail: { value: "0" } });
      parentPage.handleLeaveDateChange({ detail: { value: startDate }, currentTarget: { dataset: { field: "startDate" } } });
      parentPage.handleLeaveDateChange({ detail: { value: endDate }, currentTarget: { dataset: { field: "endDate" } } });
      parentPage.handleLeaveReasonChange({ detail: { value: "1" } });
      parentPage.handleLeaveSubmit();
      await waitFor(
        () => !parentPage.data.busy && parentPage.data.leaveRequests.some((item) => item.status === "SUBMITTED"),
        "家长提交请假",
      );
      const submittedLeave = parentPage.data.leaveRequests.find((item) => item.status === "SUBMITTED");
      assert.ok(submittedLeave);
      assert.equal(submittedLeave.startDate, startDate);
      assert.equal(submittedLeave.endDate, endDate);
      assert.equal(submittedLeave.reason, "TEMPORARY_MATTER");
      const leaveId = submittedLeave.id;

      const deniedRequestCount = requests.length;
      await assert.rejects(parent.reviewLeave(leaveId, submittedLeave.version, "confirm"), /请假|审核|员工/u);
      await assert.rejects(
        staff.applyLeave(parent.snapshot.leaveBindings[0].reference, {
          startDate,
          endDate,
          reason: "FAMILY_ARRANGEMENT",
        }),
        /请假|家长|提交/u,
      );
      assert.equal(requests.length, deniedRequestCount, "无权限动作不得发出额外请求");

      pageRuntime.setCareApi(staff);
      const staffPage = pageRuntime.createStaffPage();
      staffPage.onShow();
      await waitFor(
        () => staffPage.data.leaveRequests.some((item) => item.id === leaveId),
        "员工工作台读取待审请假",
      );
      assert.equal(staffPage.data.canReviewLeave, true);
      assert.equal(staffPage.data.pendingLeaveCount, 1);
      staffPage.handleLeaveReview({ currentTarget: { dataset: { action: "return", id: leaveId, version: submittedLeave.version } } });
      await waitFor(
        () =>
          !staffPage.data.leaveBusy &&
          !staffPage.data.leaveRequests.some((item) => item.id === leaveId) &&
          staffPage.data.leaveMessage === "申请已退回家长调整。",
        "员工退回请假",
      );
      assert.equal(staffPage.data.pendingLeaveCount, 0);

      pageRuntime.setCareApi(parent);
      parentPage.onShow();
      await waitFor(
        () => parentPage.data.leaveRequests.find((item) => item.id === leaveId)?.status === "RETURNED",
        "家长读取退回结果",
      );
      const returnedParentLeave = parentPage.data.leaveRequests.find((item) => item.id === leaveId);
      assert.ok(returnedParentLeave);
      parentPage.handleLeaveDateChange({ detail: { value: futureDate(4) }, currentTarget: { dataset: { field: "startDate" } } });
      parentPage.handleLeaveDateChange({ detail: { value: futureDate(5) }, currentTarget: { dataset: { field: "endDate" } } });
      parentPage.handleLeaveAction({ currentTarget: { dataset: { action: "resubmit", id: leaveId, version: returnedParentLeave.version } } });
      await waitFor(
        () => !parentPage.data.busy && parentPage.data.leaveRequests.find((item) => item.id === leaveId)?.status === "SUBMITTED",
        "家长修改并重提请假",
      );

      pageRuntime.setCareApi(staff);
      staffPage.handleRefreshLeaves();
      await waitFor(
        () => !staffPage.data.leaveBusy && staffPage.data.leaveRequests.find((item) => item.id === leaveId)?.status === "SUBMITTED",
        "员工刷新重提申请",
      );
      const resubmittedStaffLeave = staffPage.data.leaveRequests.find((item) => item.id === leaveId);
      assert.ok(resubmittedStaffLeave);
      staffPage.handleLeaveReview({ currentTarget: { dataset: { action: "confirm", id: leaveId, version: resubmittedStaffLeave.version } } });
      await waitFor(
        () =>
          !staffPage.data.leaveBusy &&
          !staffPage.data.leaveRequests.some((item) => item.id === leaveId) &&
          staffPage.data.leaveMessage === "申请已审核通过。",
        "员工通过请假",
      );
      assert.equal(staffPage.data.pendingLeaveCount, 0);

      pageRuntime.setCareApi(parent);
      parentPage.onShow();
      await waitFor(
        () => parentPage.data.leaveRequests.find((item) => item.id === leaveId)?.status === "CONFIRMED",
        "家长读取通过结果",
      );
      const confirmedParentLeave = parentPage.data.leaveRequests.find((item) => item.id === leaveId);
      assert.ok(confirmedParentLeave?.needsAcknowledge);
      parentPage.handleLeaveAction({ currentTarget: { dataset: { action: "acknowledge", id: leaveId, version: confirmedParentLeave.version } } });
      await waitFor(
        () => !parentPage.data.busy && parentPage.data.leaveRequests.find((item) => item.id === leaveId)?.acknowledged === true,
        "家长确认审核结果",
      );
      assert.equal(parent.snapshot.leaveRequests.find((item) => item.id === leaveId)?.acknowledged, true);
      assert.ok(requests.some((call) => call === "POST /parent/leave-requests"));
      assert.equal(
        requests.filter((call) => call === `POST /staff/leave-requests/${leaveId}/review`).length,
        2,
      );
      assert.ok(requests.some((call) => call === `POST /parent/leave-requests/${leaveId}/resubmit`));
      assert.ok(requests.some((call) => call === `POST /parent/leave-requests/${leaveId}/acknowledge`));

      const teacherCredentials = local.ready.inviteCredentials.teacher;
      assert.ok(teacherCredentials, "本机应提供独立的虚构成长记录填报教师账号");
      const teacher = new MiniCareRecordApi({
        baseUrl: apiConfig.baseUrl,
        environment: apiConfig.environment,
        request,
        sessionStore: stores.teacher,
      });
      const teacherSnapshot = await teacher.login(
        teacherCredentials.username,
        teacherCredentials.password,
      );
      assert.equal(teacherSnapshot.role, "STAFF");
      assert.equal(teacherSnapshot.capabilities.includes("care:write"), true);
      assert.equal(teacherSnapshot.capabilities.includes("care:review"), false);
      assert.equal(teacherSnapshot.capabilities.includes("care:publish"), false);
      assert.equal(staffSnapshot.capabilities.includes("care:write"), false);
      assert.equal(staffSnapshot.capabilities.includes("care:review"), true);
      assert.equal(staffSnapshot.capabilities.includes("care:publish"), true);
      assert.equal(parentSnapshot.capabilities.includes("care:read"), true);

      pageRuntime.setCareApi(teacher);
      const teacherCarePage = pageRuntime.createStaffCarePage();
      teacherCarePage.onShow();
      await waitFor(
        () => teacherCarePage.data.status === "READY" && !teacherCarePage.data.busy,
        "教师成长记录页加载",
      );
      assert.equal(teacherCarePage.data.canWrite, true);
      assert.equal(teacherCarePage.data.students.length, 2);
      teacherCarePage.handleStudentChange({ detail: { value: "0" } });
      teacherCarePage.handleDateChange({ detail: { value: "2026-10-20" } });
      teacherCarePage.handleFieldChange({
        currentTarget: { dataset: { field: "homework" } },
        detail: { value: "2" },
      });
      assert.equal(teacherCarePage.data.formValues.homework, "NEEDS_SUPPORT");
      teacherCarePage.handleSubmit();
      await waitFor(
        () =>
          !teacherCarePage.data.busy &&
          teacherCarePage.data.records.some((item) => item.status === "DRAFT"),
        "教师保存成长记录草稿",
      );
      const draft = teacherCarePage.data.records.find((item) => item.status === "DRAFT");
      assert.ok(draft);
      assert.equal(draft.student_display_ref, "示例学生甲");
      assert.equal(draft.values.homework, "NEEDS_SUPPORT");
      assert.equal(parent.snapshot.parentRecords.length, 0, "家长不得看到未发布草稿");

      const requestsBeforeCareDeniedActions = requests.length;
      await assert.rejects(parent.create(draft.student_id, draft.service_date, draft.values), /孩子|权限/u);
      await assert.rejects(teacher.command(draft, "review", "confirm"), /不能执行/u);
      await assert.rejects(staff.create(draft.student_id, draft.service_date, draft.values), /孩子|权限/u);
      assert.equal(requests.length, requestsBeforeCareDeniedActions, "无成长记录权限的操作不得发出请求");

      teacherCarePage.handleAction({
        currentTarget: { dataset: { action: "submit", recordId: draft.id } },
      });
      await waitFor(
        () => teacherCarePage.data.records.find((item) => item.id === draft.id)?.status === "SUBMITTED",
        "教师提交成长记录审核",
      );
      const submittedCare = teacherCarePage.data.records.find((item) => item.id === draft.id);
      assert.ok(submittedCare);
      assert.equal(parent.snapshot.parentRecords.length, 0, "家长不得看到待审核记录");

      pageRuntime.setCareApi(staff);
      const reviewerCarePage = pageRuntime.createStaffCarePage();
      reviewerCarePage.onShow();
      await waitFor(
        () => reviewerCarePage.data.records.some((item) => item.id === draft.id),
        "审核员工读取待审核成长记录",
      );
      const submittedForReview = reviewerCarePage.data.records.find((item) => item.id === draft.id);
      assert.ok(submittedForReview?.canReview);
      reviewerCarePage.handleAction({
        currentTarget: { dataset: { action: "review-confirm", recordId: draft.id } },
      });
      await waitFor(
        () => reviewerCarePage.data.records.find((item) => item.id === draft.id)?.status === "CONFIRMED",
        "审核员工通过成长记录",
      );
      assert.equal(parent.snapshot.parentRecords.length, 0, "审核通过但未发布时家长仍不可见");

      const confirmedCare = reviewerCarePage.data.records.find((item) => item.id === draft.id);
      assert.ok(confirmedCare?.canPublish);
      reviewerCarePage.handleAction({
        currentTarget: { dataset: { action: "publish", recordId: draft.id } },
      });
      await waitFor(
        () => reviewerCarePage.data.records.find((item) => item.id === draft.id)?.published === true,
        "审核员工发布成长记录",
      );

      const parentPublishedSnapshot = await parent.refresh();
      assert.ok(
        parentPublishedSnapshot.parentRecords.some((item) => item.id === draft.id),
        `家长 API 应返回同一条已发布记录；bindings=${parentPublishedSnapshot.leaveBindings.length}; staffPublished=${reviewerCarePage.data.records.find((item) => item.id === draft.id)?.published}; failed=${failedRequests.join(";")}`,
      );
      pageRuntime.setCareApi(parent);
      parentPage.onShow();
      await waitFor(
        () => parentPage.data.records.some((item) => item.id === draft.id),
        "家长查看已发布成长记录",
      );
      let parentCare = parentPage.data.records.find((item) => item.id === draft.id);
      assert.ok(parentCare?.needsRead);
      assert.equal(parentCare.detailRows.find((item) => item.label === "作业整理")?.value, "需要协助");
      parentPage.handleReceipt({ currentTarget: { dataset: { action: "read", recordId: draft.id } } });
      await waitFor(
        () => parentPage.data.records.find((item) => item.id === draft.id)?.receipt_status === "READ",
        "家长打开成长记录",
      );
      parentCare = parentPage.data.records.find((item) => item.id === draft.id);
      assert.ok(parentCare?.needsAcknowledge);
      parentPage.handleReceipt({
        currentTarget: { dataset: { action: "acknowledge", recordId: draft.id } },
      });
      await waitFor(
        () => parentPage.data.records.find((item) => item.id === draft.id)?.receipt_status === "ACKNOWLEDGED",
        "家长确认成长记录",
      );
      assert.ok(requests.some((call) => call === "POST /staff/care-records"));
      assert.ok(requests.some((call) => call === `POST /staff/care-records/${draft.id}/submit`));
      assert.ok(requests.some((call) => call === `POST /staff/care-records/${draft.id}/review`));
      assert.ok(requests.some((call) => call === `POST /staff/care-records/${draft.id}/publish`));
      assert.ok(requests.some((call) => call === `POST /parent/care-records/${draft.id}/receipt`));
      assert.deepEqual(failedRequests, ["403 GET /staff/care-records"]);
    } finally {
      pageRuntime.restore();
    }
  } finally {
    await local.stop();
  }

  assert.ok(local.child.exitCode !== null || local.child.signalCode !== null);
});
