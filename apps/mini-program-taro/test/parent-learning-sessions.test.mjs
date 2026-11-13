import assert from "node:assert/strict";
import test from "node:test";

const helperModule = await import("../src/learning/parent-learning-sessions.ts").catch((error) => {
  if (error?.code === "ERR_MODULE_NOT_FOUND") return null;
  throw error;
});

const studentId = "00000000-0000-4000-8000-000000000301";
const bindingId = "00000000-0000-4000-8000-000000000401";
const relationshipId = "00000000-0000-4000-8000-000000000402";
const sessionId = "00000000-0000-4000-8000-000000000501";
const consentId = "00000000-0000-4000-8000-000000000601";
const timestamp = "2026-10-25T02:00:00.000Z";

const policy = {
  key: "LEARNING_SUPPORT",
  title: "学习支持",
  noticeVersion: "LEARNING_SUPPORT_NOTICE_V1",
  consentVersion: "LEARNING_DEMO_V2",
  policyVersion: "AI_LEARNING_POLICY_SYNTHETIC_V1",
  necessity: "用于演示监护人知情后开启固定题目的学习支持。",
  dataClasses: ["学习参与摘要"],
  retentionDays: 7,
  retentionNotice: "演示期限 7 天，仅演示；实际期限须由机构与专业人员确认。",
  impactReviewStatus: "DEMO_ONLY_PENDING_HUMAN_REVIEW",
};

const control = {
  studentId,
  studentLabel: "合成学生甲",
  enabled: true,
  maxDurationMinutes: 10,
  maxHintLevel: 2,
  contactStatus: "NOT_REQUESTED",
};

const summary = {
  approvedStudents: [{ studentId, studentLabel: "合成学生甲", classLabel: "示例三年级班" }],
  parentSummary: [],
  parentSummaryUpdatedAt: timestamp,
  parentControls: [control],
};

const bindingApplication = {
  id: bindingId,
  studentId,
  status: "APPROVED",
  version: 2,
  submittedAt: timestamp,
  reviewedAt: timestamp,
};

const activeRelationship = {
  id: relationshipId,
  studentId,
  sourceApplicationId: bindingId,
  status: "ACTIVE",
  version: 2,
  approvedAt: timestamp,
};

const consent = {
  id: consentId,
  version: 1,
  bindingId,
  purposeKey: "LEARNING_SUPPORT",
  noticeVersion: policy.noticeVersion,
  consentVersion: policy.consentVersion,
  policyVersion: policy.policyVersion,
  status: "ACTIVE",
  dataChanged: false,
};

const learningSession = {
  id: sessionId,
  version: 1,
  status: "ACTIVE",
  consentVersion: "LEARNING_DEMO_V2",
  consentedAt: timestamp,
  guidanceMode: "FIXED_LOCAL",
  studentId,
  studentLabel: "合成学生甲",
  question: {
    id: "math-grade-3-addition-01",
    grade: "三年级",
    subject: "数学",
    prompt: "小明有 12 张卡片，又得到 8 张，现在一共有多少张？",
    knowledgePoint: "两位数加法",
    choices: [
      { id: "A", label: "18 张" },
      { id: "B", label: "20 张" },
      { id: "C", label: "22 张" },
    ],
  },
  durationMinutes: 5,
  startedAt: timestamp,
  endsAt: "2026-10-25T02:05:00.000Z",
  mainAttempts: 0,
  mainAttemptLimit: 3,
  mainAttemptLimitReached: false,
  lastHintAtAttempt: 0,
  mainCorrect: false,
  highestHintLevel: -1,
  visibleHint: null,
  consolidation: [],
  needsTeacherFollowUp: false,
};

function assertHelper() {
  assert.ok(helperModule, "the parent fixed-learning API client must exist");
}

function loadContext(overrides = {}) {
  return helperModule.resolveParentFixedLearningContext({
    studentId,
    projection: summary,
    applications: [bindingApplication],
    relationships: [activeRelationship],
    policies: [policy],
    consents: [consent],
    ...overrides,
  });
}

test("resolves fixed-learning access only for an approved child, active relationship and matching consent", () => {
  assertHelper();
  const result = loadContext();
  assert.equal(result.student.studentId, studentId);
  assert.equal(result.binding.id, bindingId);
  assert.equal(result.relationship.status, "ACTIVE");
  assert.equal(result.control.maxDurationMinutes, 10);
  assert.equal(result.policy.policyVersion, policy.policyVersion);
  assert.equal(result.consent.id, consentId);
  assert.deepEqual(helperModule.parseParentLearningSessions([learningSession], studentId), [
    learningSession,
  ]);
});

test("rejects a student ID that is not in the authenticated parent's approved list", () => {
  assertHelper();
  assert.throws(
    () =>
      helperModule.resolveParentFixedLearningContext({
        studentId: "00000000-0000-4000-8000-000000000399",
        projection: summary,
        applications: [bindingApplication],
        relationships: [activeRelationship],
        policies: [policy],
        consents: [consent],
      }),
    /已审核|权限/u,
  );
});

test("does not treat a consent for another binding as current learning consent", () => {
  assertHelper();
  const otherConsent = { ...consent, bindingId: "00000000-0000-4000-8000-000000000402" };
  const result = loadContext({ consents: [otherConsent] });
  assert.equal(result.consent, null);
});

test("granting learning support requires an explicit choice and sends only the selected binding and current notice", async () => {
  assertHelper();
  let requests = 0;
  await assert.rejects(
    helperModule.grantLearningSupportConsent(
      async () => {
        requests += 1;
        return consent;
      },
      bindingId,
      policy,
      false,
    ),
    /确认/u,
  );
  assert.equal(requests, 0);

  const calls = [];
  const granted = await helperModule.grantLearningSupportConsent(
    async (path, body) => {
      calls.push({ path, body });
      return consent;
    },
    bindingId,
    policy,
    true,
  );
  assert.deepEqual(calls, [
    {
      path: "/consents",
      body: {
        bindingId,
        purposeKey: "LEARNING_SUPPORT",
        noticeVersion: "LEARNING_SUPPORT_NOTICE_V1",
        confirmed: true,
      },
    },
  ]);
  assert.equal(granted.status, "ACTIVE");
});

test("revoking consent uses its current version and only its own consent ID", async () => {
  assertHelper();
  const calls = [];
  await helperModule.revokeLearningSupportConsent(async (path, body) => {
    calls.push({ path, body });
    return { ...consent, version: 2, status: "REVOKED" };
  }, consent);
  assert.deepEqual(calls, [{ path: `/consents/${consentId}/revoke`, body: { version: 1 } }]);
});

test("starting is blocked until controls and current consent allow it and duration stays within the parent limit", async () => {
  assertHelper();
  const context = {
    student: summary.approvedStudents[0],
    binding: { id: bindingId, studentId, status: "APPROVED" },
    relationship: {
      id: relationshipId,
      studentId,
      sourceApplicationId: bindingId,
      status: "ACTIVE",
    },
    control,
    policy,
    consent,
    sessions: [],
  };
  await assert.rejects(
    helperModule.startFixedLearningSession(
      async () => learningSession,
      { ...context, consent: null },
      5,
    ),
    /知情同意/u,
  );
  await assert.rejects(
    helperModule.startFixedLearningSession(
      async () => learningSession,
      { ...context, control: { ...control, enabled: false } },
      5,
    ),
    /已关闭/u,
  );
  await assert.rejects(
    helperModule.startFixedLearningSession(async () => learningSession, context, 15),
    /时长/u,
  );

  const calls = [];
  const started = await helperModule.startFixedLearningSession(
    async (path, body) => {
      calls.push({ path, body });
      return learningSession;
    },
    context,
    5,
  );
  assert.deepEqual(calls, [
    {
      path: `/parent/students/${studentId}/learning-sessions`,
      body: {
        questionId: "math-grade-3-addition-01",
        consentVersion: "LEARNING_DEMO_V2",
        durationMinutes: 5,
      },
    },
  ]);
  assert.equal(started.id, sessionId);
});

test("answer, next hint and close use the latest session version and fixed-choice API", async () => {
  assertHelper();
  const calls = [];
  const afterWrongAnswer = { ...learningSession, version: 2, mainAttempts: 1 };
  const afterHint = {
    ...afterWrongAnswer,
    version: 3,
    lastHintAtAttempt: 1,
    highestHintLevel: 0,
    visibleHint: { level: 0, text: "先把两个数量分组，再计算总数。" },
  };
  const afterClose = { ...afterHint, version: 4, status: "CLOSED" };
  await helperModule.answerFixedLearningItem(
    async (path, body) => {
      calls.push({ path, body });
      return afterWrongAnswer;
    },
    learningSession,
    "main",
    "A",
  );
  await helperModule.requestNextLearningHint(
    async (path, body) => {
      calls.push({ path, body });
      return afterHint;
    },
    afterWrongAnswer,
    2,
  );
  await assert.rejects(
    helperModule.requestNextLearningHint(
      async () => {
        throw new Error("must not request beyond the parent limit");
      },
      { ...afterWrongAnswer, highestHintLevel: 2 },
      2,
    ),
    /达到家长允许的提示范围/u,
  );
  await helperModule.closeFixedLearningSession(async (path, body) => {
    calls.push({ path, body });
    return afterClose;
  }, afterHint);

  assert.deepEqual(calls, [
    {
      path: `/parent/learning-sessions/${sessionId}/answer`,
      body: { itemId: "main", choice: "A", expectedVersion: 1 },
    },
    {
      path: `/parent/learning-sessions/${sessionId}/hint`,
      body: { level: 0, expectedVersion: 2 },
    },
    {
      path: `/parent/learning-sessions/${sessionId}/close`,
      body: { expectedVersion: 3 },
    },
  ]);
});
