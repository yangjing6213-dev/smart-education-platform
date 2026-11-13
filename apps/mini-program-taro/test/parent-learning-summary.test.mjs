import assert from "node:assert/strict";
import test from "node:test";

const summaryModule = await import("../src/learning/parent-learning-summary.ts").catch((error) => {
  if (error?.code === "ERR_MODULE_NOT_FOUND") return null;
  throw error;
});

const studentId = "00000000-0000-4000-8000-000000000301";
const summary = {
  approvedStudents: [{ studentId, studentLabel: "合成学生甲", classLabel: "示例三年级班" }],
  parentSummary: [
    {
      studentId,
      studentLabel: "合成学生甲",
      usedMinutes: 12,
      sessionCount: 2,
      completedSessions: 1,
      knowledgePoints: [{ label: "分数初步", sessionCount: 2, completedSessions: 1 }],
      attentionCount: 0,
    },
  ],
  parentSummaryUpdatedAt: "2026-10-20T02:00:00.000Z",
};

test("parent learning read uses only the authenticated summary endpoint and returns the limited projection", async () => {
  assert.ok(summaryModule?.loadParentLearningSummary, "the Taro parent summary reader must exist");
  const calls = [];

  const result = await summaryModule.loadParentLearningSummary(async (path) => {
    calls.push(path);
    return summary;
  });

  assert.deepEqual(calls, ["/parent/learning"]);
  assert.deepEqual(result, summary);
  assert.doesNotMatch(JSON.stringify(result), /question|answer|hintText|modelLog|sessionId/u);
});

test("parent learning rejects unapproved students and unexpected sensitive response fields", async () => {
  assert.ok(summaryModule?.loadParentLearningSummary, "the Taro parent summary reader must exist");

  await assert.rejects(
    summaryModule.loadParentLearningSummary(async () => ({
      ...summary,
      parentSummary: [
        { ...summary.parentSummary[0], studentId: "00000000-0000-4000-8000-000000000302" },
      ],
    })),
    /格式/u,
  );
  await assert.rejects(
    summaryModule.loadParentLearningSummary(async () => ({
      ...summary,
      internalModelLog: "synthetic",
    })),
    /格式/u,
  );
  await assert.rejects(
    summaryModule.loadParentLearningSummary(async () => ({
      ...summary,
      parentSummary: [{ ...summary.parentSummary[0], attentionCount: -1 }],
    })),
    /格式/u,
  );
});

const control = {
  studentId,
  studentLabel: "合成学生甲",
  enabled: true,
  maxDurationMinutes: 15,
  maxHintLevel: 3,
  contactStatus: "NOT_REQUESTED",
};

test("parent learning preserves only approved supervision controls and keeps absent controls absent", async () => {
  assert.deepEqual(
    await summaryModule.loadParentLearningSummary(async () => ({
      ...summary,
      parentControls: [control],
    })),
    { ...summary, parentControls: [control] },
  );
  const empty = {
    approvedStudents: [],
    parentSummary: [],
    parentSummaryUpdatedAt: summary.parentSummaryUpdatedAt,
  };
  assert.deepEqual(
    await summaryModule.loadParentLearningSummary(async () => ({ ...empty, parentControls: [] })),
    { ...empty, parentControls: [] },
  );
  assert.equal(
    Object.hasOwn(summaryModule.parseParentLearningProjection(summary), "parentControls"),
    false,
  );
});

test("parent controls cannot introduce another child, duplicate rows, invalid limits or hidden fields", () => {
  for (const controls of [
    [],
    [control, control],
    [{ ...control, studentId: "00000000-0000-4000-8000-000000000302" }],
    [{ ...control, studentLabel: "另一个孩子" }],
    [{ ...control, enabled: "true" }],
    [{ ...control, maxDurationMinutes: 60 }],
    [{ ...control, maxHintLevel: 4 }],
    [{ ...control, contactStatus: "SENT" }],
    [{ ...control, modelLog: "hidden" }],
  ]) {
    assert.equal(
      summaryModule.parseParentLearningProjection({ ...summary, parentControls: controls }),
      null,
    );
  }
});

test("parent can switch between approved children from one loaded projection without another request", async () => {
  assert.ok(summaryModule?.selectParentLearningStudent, "the approved-child selector must exist");
  const secondStudentId = "00000000-0000-4000-8000-000000000302";
  let reads = 0;
  const projection = await summaryModule.loadParentLearningSummary(async (path) => {
    reads += 1;
    assert.equal(path, "/parent/learning");
    return {
      ...summary,
      approvedStudents: [
        ...summary.approvedStudents,
        { studentId: secondStudentId, studentLabel: "合成学生乙", classLabel: "示例三年级班" },
      ],
      parentSummary: [
        ...summary.parentSummary,
        {
          ...summary.parentSummary[0],
          studentId: secondStudentId,
          studentLabel: "合成学生乙",
          usedMinutes: 25,
        },
      ],
    };
  });

  assert.equal(
    summaryModule.selectParentLearningStudent(projection, studentId)?.studentLabel,
    "合成学生甲",
  );
  assert.equal(
    summaryModule.selectParentLearningStudent(projection, secondStudentId)?.studentLabel,
    "合成学生乙",
  );
  assert.equal(
    summaryModule.selectParentLearningStudent(projection, "00000000-0000-4000-8000-000000000399")
      ?.studentId,
    studentId,
  );
  assert.equal(
    summaryModule.selectParentLearningStudent({ ...projection, approvedStudents: [] }, studentId),
    null,
  );
  assert.equal(reads, 1);
});
