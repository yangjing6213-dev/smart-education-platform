import assert from "node:assert/strict";
import test from "node:test";
import { renderAdminStatistics } from "../dist/local-review/statistics.js";

const reference = {
  kind: "TASK",
  id: "00000000-0000-4000-8000-000000000781",
  version: 2,
  date: "2026-10-07",
};

test("authorized campus statistics show filters and opaque source references only", () => {
  const html = renderAdminStatistics({
    status: "READY",
    mode: "SCOPED",
    profile: "owner-east",
    message: "统计已更新。",
    campusLabel: "当前授权校区",
    filters: {
      from: "2026-10-01",
      to: "2026-10-07",
      classId: "00000000-0000-4000-8000-000000000782",
    },
    classOptions: [{ id: "00000000-0000-4000-8000-000000000782", label: "授权班级 1" }],
    totals: { tasks: 1, attendance: 0, pickupExceptions: 0, healthIncidents: 0, total: 1 },
    groups: [
      {
        date: "2026-10-07",
        classId: "00000000-0000-4000-8000-000000000782",
        classLabel: "授权班级 1",
        kind: "TASK",
        status: "CHECKED",
        count: 1,
        sources: [reference],
      },
    ],
  });

  assert.match(html, /data-statistics-page/u);
  assert.match(html, /data-operational-statistics/u);
  assert.match(html, /name="from"/u);
  assert.match(html, /name="to"/u);
  assert.match(html, /name="classId"/u);
  assert.match(html, /当前授权校区/u);
  assert.match(html, /授权班级 1/u);
  assert.match(html, /00000000-0000-4000-8000-000000000781/u);
  assert.match(html, /版本 2/u);
  assert.doesNotMatch(html, /studentId|PRIVATE_STUDENT|学生姓名/u);
});

test("platform statistics contain anonymous totals without filters or source identifiers", () => {
  const html = renderAdminStatistics({
    status: "READY",
    mode: "ANONYMOUS",
    profile: "platform-admin",
    message: "仅显示匿名汇总。",
    totals: { tasks: 4, attendance: 3, pickupExceptions: 1, healthIncidents: 2, total: 10 },
  });

  assert.match(html, /匿名汇总/u);
  assert.match(html, /统计总数/u);
  assert.doesNotMatch(
    html,
    /name="from"|name="to"|name="classId"|data-statistics-source|00000000-|campusId|classId|studentId/u,
  );
});

test("denied statistics fail closed without rendering stale source rows", () => {
  const html = renderAdminStatistics({
    status: "DENIED",
    mode: "SCOPED",
    profile: "teacher-east",
    message: "当前角色无权查看运营统计。",
    campusLabel: "当前授权校区",
    filters: { from: "2026-10-01", to: "2026-10-07" },
    classOptions: [],
    totals: { tasks: 0, attendance: 0, pickupExceptions: 0, healthIncidents: 0, total: 0 },
    groups: [],
  });

  assert.match(html, /当前角色无权查看运营统计/u);
  assert.doesNotMatch(html, /00000000-0000-4000-8000-000000000781|PRIVATE_STUDENT/u);
});
