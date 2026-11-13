import assert from "node:assert/strict";
import test from "node:test";

const leaveModule = await import("../src/leave/leave-requests.ts").catch((error) => {
  if (error?.code === "ERR_MODULE_NOT_FOUND") return null;
  throw error;
});

const requestId = "00000000-0000-4000-8000-000000000401";
const studentId = "00000000-0000-4000-8000-000000000402";
const parentRequest = {
  id: requestId,
  student_id: studentId,
  student_display_ref: "模拟学生甲",
  start_date: "2026-10-21",
  end_date: "2026-10-22",
  reason_category: "FAMILY_ARRANGEMENT",
  status: "SUBMITTED",
  version: 1,
  acknowledged: false,
  actions: ["withdraw"],
  updated_at: "2026-10-20T02:00:00.000Z",
};
const staffRequest = {
  ...parentRequest,
  class_ref: "模拟三年级甲班",
  actions: ["confirm", "return"],
};
const parsedParentRequest = {
  id: requestId,
  studentId,
  studentLabel: "模拟学生甲",
  startDate: "2026-10-21",
  endDate: "2026-10-22",
  reasonCategory: "FAMILY_ARRANGEMENT",
  status: "SUBMITTED",
  version: 1,
  acknowledged: false,
  actions: ["withdraw"],
  updatedAt: "2026-10-20T02:00:00.000Z",
};
const parsedStaffRequest = {
  ...parsedParentRequest,
  classLabel: "模拟三年级甲班",
  actions: ["confirm", "return"],
};

test("parent leave list uses the authenticated route and parses only the safe projection", async () => {
  assert.ok(leaveModule?.loadParentLeaveRequests, "parent leave reader must exist");
  const calls = [];

  const result = await leaveModule.loadParentLeaveRequests(async (path) => {
    calls.push(path);
    return [parentRequest];
  });

  assert.deepEqual(calls, ["/parent/leave-requests"]);
  assert.deepEqual(result, [parsedParentRequest]);
  assert.doesNotMatch(JSON.stringify(result), /phone|address|medical|internalNote/u);
});

test("parent create submits only the selected approved student and fixed request fields", async () => {
  assert.ok(leaveModule?.createParentLeaveRequest, "parent leave submitter must exist");
  const calls = [];

  const result = await leaveModule.createParentLeaveRequest(
    async (path, body) => {
      calls.push({ path, body });
      return parentRequest;
    },
    {
      studentId,
      startDate: "2026-10-21",
      endDate: "2026-10-22",
      reasonCategory: "FAMILY_ARRANGEMENT",
    },
  );

  assert.deepEqual(calls, [
    {
      path: "/parent/leave-requests",
      body: {
        student_id: studentId,
        start_date: "2026-10-21",
        end_date: "2026-10-22",
        reason_category: "FAMILY_ARRANGEMENT",
      },
    },
  ]);
  assert.deepEqual(result, parsedParentRequest);
});

test("parent create rejects invalid date ranges and unsupported free-form categories before sending", async () => {
  assert.ok(leaveModule?.createParentLeaveRequest, "parent leave submitter must exist");
  let calls = 0;
  const post = async () => {
    calls += 1;
    return parentRequest;
  };

  await assert.rejects(
    leaveModule.createParentLeaveRequest(post, {
      studentId,
      startDate: "2026-10-23",
      endDate: "2026-10-22",
      reasonCategory: "FAMILY_ARRANGEMENT",
    }),
    /日期/u,
  );
  await assert.rejects(
    leaveModule.createParentLeaveRequest(post, {
      studentId,
      startDate: "2026-10-21",
      endDate: "2026-10-22",
      reasonCategory: "HEALTH_DETAILS",
    }),
    /原因/u,
  );
  assert.equal(calls, 0);
});

test("parent can use only the action in the latest server projection with its version", async () => {
  assert.ok(leaveModule?.runParentLeaveAction, "parent leave action runner must exist");
  const calls = [];

  await leaveModule.runParentLeaveAction(
    async (path, body) => {
      calls.push({ path, body });
      return { ...parentRequest, status: "WITHDRAWN", actions: [], version: 2 };
    },
    parentRequest,
    "withdraw",
  );

  assert.deepEqual(calls, [
    { path: `/parent/leave-requests/${requestId}/withdraw`, body: { version: 1 } },
  ]);
  await assert.rejects(
    leaveModule.runParentLeaveAction(async () => parentRequest, parentRequest, "acknowledge"),
    /没有此操作/u,
  );
});

test("staff queue uses the scoped server route and rejects unknown projection fields", async () => {
  assert.ok(leaveModule?.loadStaffLeaveRequests, "staff leave reader must exist");
  const calls = [];

  const result = await leaveModule.loadStaffLeaveRequests(async (path) => {
    calls.push(path);
    return [staffRequest];
  });

  assert.deepEqual(calls, ["/staff/leave-requests"]);
  assert.deepEqual(result, [parsedStaffRequest]);
  await assert.rejects(
    leaveModule.loadStaffLeaveRequests(async () => [{ ...staffRequest, guardianPhone: "not-real" }]),
    /格式/u,
  );
});

test("staff review submits only a server-allowed decision and current version", async () => {
  assert.ok(leaveModule?.reviewStaffLeaveRequest, "staff leave reviewer must exist");
  const calls = [];

  await leaveModule.reviewStaffLeaveRequest(
    async (path, body) => {
      calls.push({ path, body });
      return { ...staffRequest, status: "CONFIRMED", version: 2, actions: [] };
    },
    staffRequest,
    "confirm",
  );

  assert.deepEqual(calls, [
    {
      path: `/staff/leave-requests/${requestId}/review`,
      body: { version: 1, action: "confirm" },
    },
  ]);
  await assert.rejects(
    leaveModule.reviewStaffLeaveRequest(async () => staffRequest, staffRequest, "withdraw"),
    /没有此审核操作/u,
  );
});
