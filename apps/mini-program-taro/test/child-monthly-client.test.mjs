import assert from "node:assert/strict";
import test from "node:test";

const monthly = await import("../src/monthly-feedback/child-monthly.ts").catch((error) => {
  if (error?.code === "ERR_MODULE_NOT_FOUND") return null;
  throw error;
});

const relationshipId = "00000000-0000-4000-8000-000000000352";
const studentId = "00000000-0000-4000-8000-000000000353";
const reportId = "00000000-0000-4000-8000-000000000354";
const supplements = {
  learningParticipation: "PROGRESSING",
  dailyHabits: "KEEP_WATCHING",
  activityParticipation: "FOLLOW_UP",
  familySchoolCollaboration: "PROGRESSING",
};
const counts = { GROWTH_RECORD: 3, ATTENDANCE_OVERVIEW: 18 };
const staffRecord = {
  id: reportId,
  studentId,
  studentLabel: "合成学生-0353",
  classRef: "合成三年级甲班",
  month: "2026-10",
  status: "DRAFT",
  version: 1,
  sourceVersion: 1,
  publicationVersion: 0,
  supplements,
  sourceCounts: counts,
  actions: ["edit", "submit"],
};

function requireClient() {
  assert.ok(monthly, "孩子个人月报客户端应已实现");
  return monthly;
}

test("员工月报客户端读取授权学生与个人记录，拒绝重复或畸形数据", async () => {
  const client = requireClient();
  const result = await client.loadStaffChildMonthlyReports(async (path) => {
    assert.equal(path, "/staff/child-monthly-reports");
    return {
      students: [{ id: studentId, displayRef: "合成学生-0353", classRef: "合成三年级甲班" }],
      records: [staffRecord],
    };
  });
  assert.equal(result.students[0].id, studentId);
  assert.equal(result.records[0].studentLabel, "合成学生-0353");
  await assert.rejects(
    () => client.loadStaffChildMonthlyReports(async () => ({ students: [], records: [staffRecord, staffRecord] })),
    /格式不正确/u,
  );
  await assert.rejects(
    () => client.loadStaffChildMonthlyReports(async () => ({ students: [], records: [{ ...staffRecord, classRef: "" }] })),
    /格式不正确/u,
  );
});

test("员工可创建、修改并提交个人月报，版本号和孩子范围随请求提交", async () => {
  const client = requireClient();
  const calls = [];
  const post = async (path, body) => {
    calls.push(["POST", path, body]);
    return { ...staffRecord, status: "DRAFT", version: 1 };
  };
  const patch = async (path, body) => {
    calls.push(["PATCH", path, body]);
    return { ...staffRecord, status: "DRAFT", version: 2 };
  };
  await client.createStaffChildMonthlyReport(post, { studentId, month: "2026-10", supplements });
  await client.editStaffChildMonthlyReport(patch, reportId, 1, supplements);
  await client.submitStaffChildMonthlyReport(post, reportId, 2);
  assert.deepEqual(calls.map((call) => call.slice(0, 2)), [
    ["POST", "/staff/child-monthly-reports"],
    ["PATCH", `/staff/child-monthly-reports/${reportId}`],
    ["POST", `/staff/child-monthly-reports/${reportId}/submit`],
  ]);
  assert.deepEqual(calls[0][2], { studentId, month: "2026-10", supplements });
  assert.deepEqual(calls[1][2], { version: 1, supplements });
  assert.deepEqual(calls[2][2], { version: 2 });
  await assert.rejects(
    () => client.createStaffChildMonthlyReport(post, { studentId: "bad", month: "2026-13", supplements }),
    /月份|资料格式/u,
  );
});

test("家长只从本人有效关系读取已发布摘要，确认时提交关系版本和发布版本", async () => {
  const client = requireClient();
  const releasedId = "00000000-0000-4000-8000-000000000355";
  const otherStudentId = "00000000-0000-4000-8000-000000000356";
  const calls = [];
  const summaries = await client.loadParentChildMonthlyReports(async (path) => {
    calls.push(path);
    if (path === "/guardian-relationships") {
      return [
        {
          id: relationshipId,
          student_id: studentId,
          relationship: "GUARDIAN",
          status: "ACTIVE",
          source_application_id: "00000000-0000-4000-8000-000000000357",
          version: 2,
          approved_at: "2026-10-01T00:00:00.000Z",
        },
        {
          id: releasedId,
          student_id: otherStudentId,
          relationship: "GUARDIAN",
          status: "RELEASED",
          source_application_id: "00000000-0000-4000-8000-000000000358",
          version: 1,
          approved_at: "2026-09-01T00:00:00.000Z",
        },
      ];
    }
    assert.equal(path, `/parent/relationships/${relationshipId}/monthly-reports`);
    return {
      records: [
        {
          id: reportId,
          studentId,
          studentLabel: "合成学生-0353",
          month: "2026-10",
          publicationVersion: 4,
          relationshipVersion: 2,
          supplements,
          sourceCounts: counts,
          acknowledged: false,
        },
      ],
    };
  });
  assert.deepEqual(calls, [
    "/guardian-relationships",
    `/parent/relationships/${relationshipId}/monthly-reports`,
  ]);
  assert.equal(summaries.length, 1);
  assert.equal(summaries[0].relationshipId, relationshipId);
  assert.equal(summaries[0].studentLabel, "合成学生-0353");
  const writes = [];
  await client.acknowledgeParentChildMonthlyReport(
    async (path, body) => writes.push([path, body]),
    summaries[0],
  );
  assert.deepEqual(writes, [[
    `/parent/relationships/${relationshipId}/monthly-reports/${reportId}/ack`,
    { publicationVersion: 4, relationshipVersion: 2 },
  ]]);
});

test("家长月报客户端拒绝跨孩子回包和无效确认版本", async () => {
  const client = requireClient();
  await assert.rejects(
    () => client.loadParentChildMonthlyReports(async (path) =>
      path === "/guardian-relationships"
        ? [{
            id: relationshipId,
            student_id: studentId,
            relationship: "GUARDIAN",
            status: "ACTIVE",
            source_application_id: "00000000-0000-4000-8000-000000000357",
            version: 2,
            approved_at: "2026-10-01T00:00:00.000Z",
          }]
        : { records: [{ ...staffRecord, relationshipVersion: 2 }] }),
    /格式不正确/u,
  );
  await assert.rejects(
    () => client.acknowledgeParentChildMonthlyReport(async () => ({}), {
      relationshipId,
      id: reportId,
      studentId,
      month: "2026-10",
      publicationVersion: 0,
      relationshipVersion: 2,
      studentLabel: "合成学生-0353",
      supplements,
      sourceCounts: counts,
      acknowledged: false,
    }),
    /格式不正确/u,
  );
});
