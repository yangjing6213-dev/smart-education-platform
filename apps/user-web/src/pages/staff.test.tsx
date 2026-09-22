import assert from "node:assert/strict";
import test from "node:test";

// @ts-expect-error TS6142: this package intentionally keeps JSX-free .tsx page boundaries.
import { selectStaffRoute } from "../routes/staff.routes.js";
import {
  projectStaffWorkbench,
  type StaffTask,
  type StaffResource,
  type StaffWorkbenchInput,
  // @ts-expect-error TS6142: this package intentionally keeps JSX-free .tsx page boundaries.
} from "./staff-workbench.js";
import {
  projectStaffReport,
  type StaffReportInput,
  // @ts-expect-error TS6142: this package intentionally keeps JSX-free .tsx page boundaries.
} from "./staff-report.js";

const allowedTeacher = {
  session: "staff-session",
  membership: "active",
  role: "teacher",
  capabilities: ["employee:workbench", "teacher:summary"],
  tenantId: "tenant-synthetic-a",
  campusId: "campus-synthetic-east",
} as const;

const baseWorkbenchInput: StaffWorkbenchInput = {
  access: allowedTeacher,
  state: "published",
  resources: [
    {
      id: "guide-synthetic-1",
      tenantId: "tenant-synthetic-a",
      campusId: "campus-synthetic-east",
      status: "published",
      title: "模拟数据：今日带班指南",
      summary: "仅展示当前校区的工作提示。",
      kind: "guide",
    },
    {
      id: "guide-foreign-campus",
      tenantId: "tenant-synthetic-a",
      campusId: "campus-synthetic-west",
      status: "published",
      title: "不应出现的跨校区内容",
      summary: "foreign",
      kind: "guide",
    },
    {
      id: "private-synthetic",
      tenantId: "tenant-synthetic-a",
      campusId: "campus-synthetic-east",
      status: "private",
      title: "不应出现的私有内容",
      summary: "private",
      kind: "guide",
    },
  ],
  tasks: [
    {
      id: "task-synthetic-1",
      tenantId: "tenant-synthetic-a",
      campusId: "campus-synthetic-east",
      status: "published",
      title: "模拟数据：完成交接清单",
      dueLabel: "今天",
    },
    {
      id: "task-foreign-tenant",
      tenantId: "tenant-synthetic-b",
      campusId: "campus-synthetic-east",
      status: "published",
      title: "不应出现的跨租户任务",
      dueLabel: "明天",
    },
  ],
};

test("denies visitor, suspended, missing, revoked, and incapable staff routes", () => {
  const deniedContexts = [
    { ...allowedTeacher, role: "visitor" as const },
    { ...allowedTeacher, membership: "suspended" as const },
    { ...allowedTeacher, session: null },
    { ...allowedTeacher, membership: "revoked" as const },
    { ...allowedTeacher, capabilities: [] as const },
  ];

  for (const access of deniedContexts) {
    const route = selectStaffRoute(access, "workbench");
    assert.equal(route.kind, "denied");
    assert.equal(route.path, "/staff/denied");
  }

  assert.deepEqual(selectStaffRoute(allowedTeacher, "workbench"), {
    kind: "authorized",
    path: "/staff/workbench",
  });
  assert.deepEqual(selectStaffRoute(allowedTeacher, "report"), {
    kind: "authorized",
    path: "/staff/report",
  });
  assert.deepEqual(selectStaffRoute(allowedTeacher, "guides"), {
    kind: "authorized",
    path: "/staff/guides",
  });
  assert.deepEqual(selectStaffRoute(allowedTeacher, "resources"), {
    kind: "authorized",
    path: "/web/staff/resources",
  });
});

test("projects only published synthetic workbench data in tenant and campus scope", () => {
  const view = projectStaffWorkbench(baseWorkbenchInput);

  assert.equal(view.kind, "authorized");
  if (view.kind !== "authorized") {
    throw new Error("expected authorized workbench");
  }
  assert.deepEqual(view.focusOrder, ["workbench", "tasks", "resources"]);
  assert.deepEqual(
    view.tasks.map((task: StaffTask) => task.id),
    ["task-synthetic-1"],
  );
  assert.deepEqual(
    view.resources.map((resource: StaffResource) => resource.id),
    ["guide-synthetic-1"],
  );
  assert.equal(view.html.includes("foreign"), false);
  assert.equal(view.html.includes("private"), false);
  assert.match(view.html, /class="internal-main"/);
  assert.match(view.html, /class="staff-content-card"/);
  assert.deepEqual(view.externalRequests, []);
  assert.deepEqual(view.externalResources, []);
});

test("fails closed for visitor and malformed workbench input", () => {
  const denied = projectStaffWorkbench({
    ...baseWorkbenchInput,
    access: { ...allowedTeacher, role: "visitor" },
  });
  assert.equal(denied.kind, "denied");
  assert.equal(denied.html.includes("tenant-synthetic-a"), false);

  const malformed = projectStaffWorkbench({
    ...baseWorkbenchInput,
    resources: [null, { id: 42 }, { status: "published", title: ["bad"] }],
    tasks: [undefined, { tenantId: "tenant-synthetic-a" }],
  } as unknown as StaffWorkbenchInput);
  assert.equal(malformed.kind, "error");
  assert.equal(malformed.html.includes("bad"), false);
  assert.deepEqual(malformed.externalRequests, []);
});

test("denies teacher-only summary without capability and allows a scoped synthetic report", () => {
  const deniedInput: StaffReportInput = {
    access: { ...allowedTeacher, capabilities: ["employee:workbench"] },
    state: "published",
    report: {
      tenantId: "tenant-synthetic-a",
      campusId: "campus-synthetic-east",
      status: "published",
      summary: "不应被无教师能力员工看到",
      privateStudentName: "synthetic-private-name",
    },
  };
  const denied = projectStaffReport(deniedInput);
  assert.equal(denied.kind, "denied");
  assert.equal(denied.html.includes("synthetic-private-name"), false);

  const allowed: StaffReportInput = {
    ...deniedInput,
    access: allowedTeacher,
    report: {
      tenantId: "tenant-synthetic-a",
      campusId: "campus-synthetic-east",
      status: "published",
      summary: "模拟数据：今日教学摘要",
    },
  };
  const report = projectStaffReport(allowed);
  assert.equal(report.kind, "authorized");
  assert.equal(report.summary, "模拟数据：今日教学摘要");
  assert.equal("privateStudentName" in report, false);
  assert.deepEqual(report.externalRequests, []);
  assert.deepEqual(report.externalResources, []);
});
