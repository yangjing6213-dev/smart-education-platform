import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { mountChildMonthlyPage } from "./helpers/child-monthly-page-harness.mjs";

const appConfig = await readFile(new URL("../src/app.config.ts", import.meta.url), "utf8");
const staffWorkbench = await readFile(
  new URL("../src/pages/staff/workbench/index.tsx", import.meta.url),
  "utf8",
);
const parentHome = await readFile(new URL("../src/pages/parent/home/index.tsx", import.meta.url), "utf8");
const reportId = "00000000-0000-4000-8000-000000000354";
const studentId = "00000000-0000-4000-8000-000000000353";
const relationshipId = "00000000-0000-4000-8000-000000000352";
const secondStudentId = "00000000-0000-4000-8000-000000000356";
const secondRelationshipId = "00000000-0000-4000-8000-000000000355";
const secondReportId = "00000000-0000-4000-8000-000000000358";
const supplements = {
  learningParticipation: "PROGRESSING",
  dailyHabits: "KEEP_WATCHING",
  activityParticipation: "FOLLOW_UP",
  familySchoolCollaboration: "PROGRESSING",
};
const counts = { GROWTH_RECORD: 3, ATTENDANCE_OVERVIEW: 18 };
const staffDraft = {
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

test("两个月报页面已注册，员工工作台与家长首页提供入口", () => {
  assert.match(appConfig, /pages\/staff\/child-monthly\/index/u);
  assert.match(appConfig, /pages\/parent\/child-monthly\/index/u);
  assert.match(staffWorkbench, /pages\/staff\/child-monthly\/index/u);
  assert.match(staffWorkbench, /孩子月度报告/u);
  assert.match(parentHome, /pages\/parent\/child-monthly\/index/u);
  assert.match(parentHome, /孩子月报/u);
});

test("员工页可保存草稿、修改记录并按服务端动作提交审核", async () => {
  let record = null;
  const page = await mountChildMonthlyPage("staff", {
    get: async (path) => {
      assert.equal(path, "/staff/child-monthly-reports");
      return {
        students: [{ id: studentId, displayRef: "合成学生-0353", classRef: "合成三年级甲班" }],
        records: record ? [record] : [],
      };
    },
    post: async (path, body) => {
      if (path.endsWith("/submit")) {
        assert.deepEqual(body, { version: 2 });
        record = { ...staffDraft, status: "SUBMITTED", version: 3, actions: [] };
      } else {
        record = { ...staffDraft, studentId: body.studentId, month: body.month, supplements: body.supplements, status: "DRAFT", version: 1 };
      }
      return record;
    },
    patch: async (path, body) => {
      assert.equal(path, `/staff/child-monthly-reports/${reportId}`);
      assert.equal(body.version, 1);
      assert.equal(body.supplements.dailyHabits, "FOLLOW_UP");
      record = { ...record, supplements: body.supplements, version: 2 };
      return record;
    },
  });
  assert.match(page.text(), /孩子月度报告/u);
  await page.choose("student", 0);
  await page.choose("month", "2026-09");
  await page.choose("learningParticipation", 1);
  await page.click("保存月报草稿");
  assert.match(page.text(), /草稿已保存/u);
  const createCall = page.calls.find((call) => call[0] === "POST" && call[1] === "/staff/child-monthly-reports");
  assert.equal(createCall[2].month, "2026-09");
  assert.equal(createCall[2].supplements.learningParticipation, "PROGRESSING");
  await page.click("修改草稿");
  await page.choose("dailyHabits", 2);
  await page.click("保存修改");
  const editCall = page.calls.find((call) => call[0] === "PATCH");
  assert.equal(editCall[2].version, 1);
  assert.equal(editCall[2].supplements.dailyHabits, "FOLLOW_UP");
  await page.click("提交负责人审核");
  assert.match(page.text(), /已提交负责人审核/u);
  assert.equal(page.calls.filter((call) => call[0] === "POST" && call[1].endsWith("/submit")).length, 1);
  assert.doesNotMatch(page.text(), /审核通过|发布月报/u);
});

test("员工页遇到版本冲突只刷新记录，不自动重复提交", async () => {
  let submitCalls = 0;
  let record = staffDraft;
  const page = await mountChildMonthlyPage("staff", {
    get: async () => ({
      students: [{ id: studentId, displayRef: "合成学生-0353", classRef: "合成三年级甲班" }],
      records: [record],
    }),
    post: async (path) => {
      if (path.endsWith("/submit")) {
        submitCalls += 1;
        throw Object.assign(new Error("conflict"), { statusCode: 409 });
      }
      return record;
    },
  });
  await page.click("提交负责人审核");
  assert.equal(submitCalls, 1);
  assert.match(page.text(), /已刷新最新版本，请重新核对/u);
  assert.equal(page.calls.filter((call) => call[0] === "GET" && call[1] === "/staff/child-monthly-reports").length, 2);
});

test("家长页只显示本人有效关系返回的已发布摘要，确认后重新读取并隐藏确认按钮", async () => {
  const acknowledged = new Set();
  const page = await mountChildMonthlyPage("parent", {
    get: async (path) => {
      if (path === "/guardian-relationships")
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
            id: secondRelationshipId,
            student_id: secondStudentId,
            relationship: "GUARDIAN",
            status: "ACTIVE",
            source_application_id: "00000000-0000-4000-8000-000000000359",
            version: 3,
            approved_at: "2026-09-01T00:00:00.000Z",
          },
        ];
      if (path === `/parent/relationships/${relationshipId}/monthly-reports`)
        return { records: [{
          id: reportId,
          studentId,
          studentLabel: "合成学生-0353",
          month: "2026-10",
          publicationVersion: 4,
          relationshipVersion: 2,
          supplements,
          sourceCounts: counts,
          acknowledged: acknowledged.has(reportId),
        }] };
      return { records: [{
        id: secondReportId,
        studentId: secondStudentId,
        studentLabel: "合成学生-0356",
        month: "2026-09",
        publicationVersion: 5,
        relationshipVersion: 3,
        supplements,
        sourceCounts: counts,
        acknowledged: acknowledged.has(secondReportId),
      }] };
    },
    post: async (path, body) => {
      assert.equal(path, `/parent/relationships/${secondRelationshipId}/monthly-reports/${secondReportId}/ack`);
      assert.deepEqual(body, { publicationVersion: 5, relationshipVersion: 3 });
      acknowledged.add(secondReportId);
      return { acknowledged: true };
    },
  });
  assert.match(page.text(), /2026-10/u);
  assert.match(page.text(), /合成学生-0353/u);
  assert.doesNotMatch(page.text(), /合成三年级甲班/u);
  await page.choose("student", 1);
  assert.match(page.text(), /合成学生-0356/u);
  assert.doesNotMatch(page.text(), /合成学生-0353/u);
  await page.click("确认已阅读");
  assert.match(page.text(), /已确认/u);
  assert.equal(page.button("确认已阅读"), undefined);
});

test("错误角色不会看到月报数据并返回登录页", async () => {
  const page = await mountChildMonthlyPage("staff", {
    snapshot: { status: "READY", roles: ["PARENT"], canReadMonthlyFeedback: false },
  });
  assert.deepEqual(page.routes, ["/pages/auth/login/index"]);
  assert.doesNotMatch(page.text(), /合成学生/u);
});
