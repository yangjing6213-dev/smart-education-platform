import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

type StaffWebModule = {
  selectStaffRoute(
    access: unknown,
    route: "workbench" | "report",
  ): {
    kind: string;
    path: string;
  };
};

type StaffReportModule = {
  projectStaffReport(input: unknown): {
    kind: string;
    html: string;
    summary?: string;
    externalRequests: readonly string[];
  };
};

type MiniStaffModule = {
  getStaffRoute(
    input: unknown,
    target: "workbench" | "quick-action",
    scope: { tenantId: string; campusId: string },
  ): { allowed: boolean; reason?: string };
};

async function loadModule<T>(relativePath: string): Promise<T> {
  return (await import(pathToFileURL(path.join(root, relativePath)).href)) as T;
}

const teacher = {
  session: "synthetic-session",
  membership: "active",
  role: "teacher",
  capabilities: ["employee:workbench", "teacher:summary"],
  tenantId: "tenant-synthetic-a",
  campusId: "campus-synthetic-east",
};

test("staff web denies guardian-style access to teacher summary and cross-campus data", async () => {
  const routes = await loadModule<StaffWebModule>("apps/user-web/dist/routes/staff.routes.js");
  const reports = await loadModule<StaffReportModule>("apps/user-web/dist/pages/staff-report.js");

  assert.equal(
    routes.selectStaffRoute(
      { ...teacher, role: "staff", capabilities: ["employee:workbench"] },
      "report",
    ).kind,
    "denied",
  );

  const guardianStyleView = reports.projectStaffReport({
    access: { ...teacher, role: "visitor", capabilities: [] },
    state: "published",
    report: {
      tenantId: teacher.tenantId,
      campusId: teacher.campusId,
      status: "published",
      summary: "private teacher summary",
    },
  });
  assert.equal(guardianStyleView.kind, "denied");
  assert.doesNotMatch(guardianStyleView.html, /private teacher summary/u);

  const foreignCampusView = reports.projectStaffReport({
    access: teacher,
    state: "published",
    report: {
      tenantId: teacher.tenantId,
      campusId: "campus-synthetic-west",
      status: "published",
      summary: "foreign campus summary",
    },
  });
  assert.equal(foreignCampusView.kind, "error");
  assert.doesNotMatch(foreignCampusView.html, /foreign campus summary/u);
  assert.deepEqual(foreignCampusView.externalRequests, []);
});

test("mini staff route denies foreign tenant and missing capability", async () => {
  const mini = await loadModule<MiniStaffModule>("apps/mini-program/src/routes/staff.routes.ts");
  const scope = { tenantId: "tenant-synthetic-a", campusId: "campus-synthetic-east" };
  const access = {
    identityType: "EMPLOYEE",
    identityStatus: "ACTIVE",
    ...scope,
    membership: {
      status: "ACTIVE",
      ...scope,
      capabilities: ["STAFF_WORKBENCH"],
    },
  };

  assert.equal(mini.getStaffRoute(access, "workbench", scope).allowed, true);
  assert.deepEqual(
    mini.getStaffRoute({ ...access, tenantId: "tenant-foreign" }, "workbench", scope),
    {
      allowed: false,
      route: "/access-denied",
      reason: "SCOPE_MISMATCH",
    },
  );
  assert.deepEqual(mini.getStaffRoute(access, "quick-action", scope), {
    allowed: false,
    route: "/access-denied",
    reason: "CAPABILITY_REQUIRED",
  });
});
