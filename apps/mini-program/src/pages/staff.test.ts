import test from "node:test";
import assert from "node:assert/strict";

import {
  STAFF_ROUTES,
  getBackRoute,
  getStaffRoute,
  type StaffAccessInput,
} from "../routes/staff.routes.ts";
import { buildWorkbenchProjection, type SyntheticStaffRecord } from "./staff/workbench.ts";
import { runQuickAction } from "./staff/quick-action.ts";

const scope = { tenantId: "tenant-synthetic-a", campusId: "campus-synthetic-1" };
type StaffMembership = NonNullable<StaffAccessInput["membership"]>;
type StaffAccessChanges = Omit<Partial<StaffAccessInput>, "membership"> & {
  membership?: Partial<StaffMembership> | undefined;
};

const activeMembership: StaffMembership = {
  status: "ACTIVE",
  tenantId: scope.tenantId,
  campusId: scope.campusId,
  capabilities: ["STAFF_WORKBENCH", "STAFF_QUICK_ACTION"],
};

const activeEmployee: StaffAccessInput = {
  identityType: "EMPLOYEE",
  identityStatus: "ACTIVE",
  tenantId: scope.tenantId,
  campusId: scope.campusId,
  membership: activeMembership,
};

function withChanges(changes: StaffAccessChanges): StaffAccessInput {
  const membership = Object.prototype.hasOwnProperty.call(changes, "membership")
    ? changes.membership
    : activeEmployee.membership;
  const next = {
    ...activeEmployee,
    ...changes,
  };

  if (membership === undefined) {
    return {
      identityType: next.identityType,
      identityStatus: next.identityStatus,
      tenantId: next.tenantId,
      campusId: next.campusId,
    };
  }

  return { ...next, membership: { ...activeMembership, ...membership } };
}

test("denies visitors and inactive, suspended, revoked, missing, foreign, or under-capable memberships", () => {
  const deniedInputs: StaffAccessInput[] = [
    withChanges({ identityType: "VISITOR" }),
    withChanges({ identityStatus: "SUSPENDED" }),
    withChanges({ membership: { status: "SUSPENDED" } }),
    withChanges({ membership: { status: "REVOKED" } }),
    withChanges({ membership: undefined }),
    withChanges({ tenantId: "tenant-foreign" }),
    withChanges({ campusId: "campus-foreign" }),
    withChanges({
      membership: { capabilities: ["OTHER_CAPABILITY"] },
    }),
  ];

  for (const input of deniedInputs) {
    assert.equal(getStaffRoute(input, "workbench", scope).allowed, false);
    assert.equal(getStaffRoute(input, "quick-action", scope).allowed, false);
  }
});

test("allows active employees only on the two local staff routes and preserves phone back navigation", () => {
  assert.deepEqual(getStaffRoute(activeEmployee, "workbench", scope), {
    allowed: true,
    route: STAFF_ROUTES.workbench,
  });
  assert.deepEqual(getStaffRoute(activeEmployee, "quick-action", scope), {
    allowed: true,
    route: STAFF_ROUTES.quickAction,
  });
  assert.equal(getBackRoute(STAFF_ROUTES.quickAction), STAFF_ROUTES.workbench);
  assert.equal(getBackRoute(STAFF_ROUTES.workbench), STAFF_ROUTES.home);
});

test("returns only published, enabled, public, fresh synthetic records in the employee scope", () => {
  const validRecord: SyntheticStaffRecord = {
    id: "synthetic-task-1",
    tenantId: scope.tenantId,
    campusId: scope.campusId,
    title: "模拟任务一",
    dataKind: "SYNTHETIC",
    status: "PUBLISHED",
    enabled: true,
    visibility: "PUBLIC",
    stale: false,
  };

  const records = [
    validRecord,
    { ...validRecord, id: "foreign-tenant", tenantId: "tenant-foreign" },
    { ...validRecord, id: "foreign-campus", campusId: "campus-foreign" },
    { ...validRecord, id: "malformed", title: "" },
    { ...validRecord, id: "disabled", enabled: false },
    { ...validRecord, id: "private", visibility: "PRIVATE" as const },
    { ...validRecord, id: "draft", status: "DRAFT" as const },
    { ...validRecord, id: "stale", stale: true },
    { ...validRecord, id: "unpublished", status: "UNPUBLISHED" as const },
    { ...validRecord, id: "real-data", dataKind: "REAL" as const },
  ];

  assert.deepEqual(buildWorkbenchProjection(activeEmployee, records), {
    status: "READY",
    focusOrder: ["workbench", "quick-action"],
    items: [{ id: validRecord.id, title: validRecord.title, kind: "SYNTHETIC" }],
  });
});

test("fails closed for an unauthorized or malformed workbench projection", () => {
  assert.deepEqual(buildWorkbenchProjection(withChanges({ membership: undefined }), []), {
    status: "DENIED",
    focusOrder: [],
    items: [],
  });
  assert.deepEqual(buildWorkbenchProjection(activeEmployee, [null as never]), {
    status: "EMPTY",
    focusOrder: ["workbench", "quick-action"],
    items: [],
  });
});

test("runs only bounded local quick actions for authorized employees", () => {
  assert.deepEqual(runQuickAction(activeEmployee, "REVIEW_TASKS"), {
    status: "READY",
    action: "REVIEW_TASKS",
    result: "模拟任务已准备查看",
  });
  assert.deepEqual(runQuickAction(withChanges({ membership: undefined }), "REVIEW_TASKS"), {
    status: "DENIED",
    action: "REVIEW_TASKS",
    result: null,
  });
});

test("does not invoke fetch or persistence while evaluating local staff flows", () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (() => {
    throw new Error("fetch must not be called");
  }) as typeof fetch;

  try {
    assert.equal(getStaffRoute(activeEmployee, "workbench", scope).allowed, true);
    assert.equal(buildWorkbenchProjection(activeEmployee, []).status, "EMPTY");
    assert.equal(runQuickAction(activeEmployee, "REVIEW_TASKS").status, "READY");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
