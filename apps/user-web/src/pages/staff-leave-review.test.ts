import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  batchReviewStaffLeaveRequests,
  createSyntheticStaffLeaveState,
  projectStaffLeaveReview,
  reviewStaffLeaveRequest,
  type WebLeaveState,
  // @ts-expect-error TS6142: this package intentionally keeps JSX-free .tsx page boundaries.
} from "./staff-leave-review.js";

const access = {
  session: "synthetic-staff-session",
  membership: "active",
  role: "teacher",
  capabilities: ["employee:workbench", "teacher:leave-review"],
  tenantId: "tenant-synthetic-a",
  campusId: "campus-synthetic-east",
  classIds: ["class-synthetic-grade3-a"],
};

test("leave review route requires an active employee with review capability and class scope", async () => {
  const routes = (await import(new URL("../routes/staff.routes.js", import.meta.url).href)) as {
    selectStaffRoute(access: unknown, route: "leave-review"): { kind: string; path: string };
  };
  assert.deepEqual(routes.selectStaffRoute(access, "leave-review"), {
    kind: "authorized",
    path: "/staff/report?view=leave-review",
  });
  assert.equal(
    routes.selectStaffRoute({ ...access, role: "visitor" }, "leave-review").kind,
    "denied",
  );
  assert.equal(
    routes.selectStaffRoute({ ...access, capabilities: ["employee:workbench"] }, "leave-review")
      .kind,
    "denied",
  );
  assert.equal(routes.selectStaffRoute({ ...access, classIds: [] }, "leave-review").kind, "denied");
});

test("web page shows synthetic same-class history and hides other-class records", () => {
  const view = projectStaffLeaveReview({ access, state: createSyntheticStaffLeaveState() });
  assert.equal(view.kind, "ready");
  assert.equal(view.requests.length, 2);
  assert.match(view.html, /模拟请假申请/u);
  assert.match(view.html, /家庭安排/u);
  assert.doesNotMatch(view.html, /模拟其他班级|student-synthetic|真实姓名/u);
  assert.deepEqual(view.externalRequests, []);
  assert.ok(view.focusOrder.includes("leave-review-list"));
});

test("individual review checks scope, status and version and records a local result", () => {
  const state = createSyntheticStaffLeaveState();
  const id = state.requests[0]!.id;
  const result = reviewStaffLeaveRequest(state, access, {
    requestId: id,
    version: 1,
    decision: "CONFIRM",
  });
  assert.equal(result.ok, true);
  assert.equal(result.state.requests[0]?.status, "CONFIRMED");
  assert.equal(result.state.requests[0]?.version, 2);
  assert.equal(result.state.audit.length, 1);
  assert.equal(
    reviewStaffLeaveRequest(result.state, access, {
      requestId: id,
      version: 1,
      decision: "RETURN",
    }).ok,
    false,
  );
  assert.equal(
    reviewStaffLeaveRequest(
      state,
      { ...access, classIds: ["class-synthetic-grade3-b"] },
      {
        requestId: id,
        version: 1,
        decision: "RETURN",
      },
    ).ok,
    false,
  );
});

test("batch review is atomic on a foreign-class row and applies valid same-scope selections", () => {
  const state = createSyntheticStaffLeaveState();
  const commands = [
    { requestId: state.requests[0]!.id, version: 1, decision: "CONFIRM" as const },
    { requestId: state.requests[2]!.id, version: 1, decision: "CONFIRM" as const },
  ];
  const rejected = batchReviewStaffLeaveRequests(state, access, commands);
  assert.equal(rejected.ok, false);
  assert.deepEqual(rejected.state, state);

  const accepted = batchReviewStaffLeaveRequests(state, access, [
    { requestId: state.requests[0]!.id, version: 1, decision: "CONFIRM" },
    { requestId: state.requests[1]!.id, version: 1, decision: "RETURN" },
  ]);
  assert.equal(accepted.ok, true);
  assert.deepEqual(
    accepted.state.requests.slice(0, 2).map((item) => item.status),
    ["CONFIRMED", "RETURNED"],
  );
  assert.equal(accepted.state.audit.length, 2);
});

test("page has keyboard-operable fixed actions, safe status messages and no external requests", () => {
  const view = projectStaffLeaveReview({
    access,
    state: createSyntheticStaffLeaveState(),
    notice: "已完成模拟审核",
  });
  assert.match(view.html, /type="checkbox"/u);
  assert.match(view.html, /data-leave-batch="CONFIRM"/u);
  assert.match(view.html, /aria-live="polite"/u);
  assert.match(view.html, /已完成模拟审核/u);
  assert.deepEqual(view.externalRequests, []);
  const source = readFileSync(new URL("./staff-leave-review.js", import.meta.url), "utf8");
  assert.doesNotMatch(
    source,
    /\bfetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|https?:\/\//u,
  );
});

test("malformed queue fails closed without reflecting arbitrary fields", () => {
  const state = createSyntheticStaffLeaveState();
  const malformed = {
    ...state,
    requests: [...state.requests, { id: "forged", status: "UNKNOWN", studentName: "private" }],
  } as unknown as WebLeaveState;
  const view = projectStaffLeaveReview({ access, state: malformed });
  assert.equal(view.kind, "error");
  assert.doesNotMatch(view.html, /private|forged/u);
});

test("empty and unauthorized states announce why no leave rows are shown", () => {
  const empty = projectStaffLeaveReview({ access, state: { requests: [], audit: [] } });
  assert.equal(empty.kind, "empty");
  assert.match(empty.html, /当前范围暂无请假申请/u);
  const denied = projectStaffLeaveReview({
    access: { ...access, role: "visitor", capabilities: [] },
    state: createSyntheticStaffLeaveState(),
  });
  assert.equal(denied.kind, "denied");
  assert.doesNotMatch(denied.html, /模拟请假申请/u);
});
