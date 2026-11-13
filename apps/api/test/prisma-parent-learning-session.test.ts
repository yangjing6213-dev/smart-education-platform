import assert from "node:assert/strict";
import test from "node:test";
import type { PrismaClient } from "../src/generated/prisma/client.js";

type MockSession = {
  [key: string]: unknown;
  id: string;
  tenantId: string;
  campusId: string;
  guardianUserId: string;
  studentId: string;
  version: number;
  status: string;
};

type MockRelationship = {
  id: string;
  student: { id: string; displayRef: string; status: string };
};

type MockArgs = { where?: Record<string, unknown>; data?: Record<string, unknown> };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const ids = {
  actor: "10000000-0000-4000-8000-000000000001",
  tenant: "20000000-0000-4000-8000-000000000001",
  campus: "30000000-0000-4000-8000-000000000001",
  student: "40000000-0000-4000-8000-000000000001",
  relationship: "50000000-0000-4000-8000-000000000001",
  consent: "60000000-0000-4000-8000-000000000001",
};
const context = {
  actorId: ids.actor,
  tenantId: ids.tenant,
  campusId: ids.campus,
  capabilities: ["binding:read"],
};
const fixedTime = new Date("2026-10-24T09:00:00.000Z");

function consentFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: ids.consent,
    tenantId: ids.tenant,
    campusId: ids.campus,
    guardianRelationshipId: ids.relationship,
    guardianUserId: ids.actor,
    studentId: ids.student,
    scope: "LEARNING_SUPPORT",
    consentVersion: "LEARNING_DEMO_V2",
    noticeVersion: "LEARNING_SUPPORT_NOTICE_V1",
    policyVersion: "AI_LEARNING_POLICY_SYNTHETIC_V1",
    status: "ACTIVE",
    confirmedAt: fixedTime,
    withdrawnAt: null,
    ...overrides,
  };
}

function makeHarness(
  overrides: {
    relationship?: unknown;
    consent?: unknown;
    setting?: unknown;
    control?: unknown;
  } = {},
) {
  const sessions: MockSession[] = [];
  const calls: { delegate: string; args: unknown }[] = [];
  const record = (delegate: string, args: unknown) => calls.push({ delegate, args });
  const relationship = (overrides.relationship ?? {
    id: ids.relationship,
    tenantId: ids.tenant,
    campusId: ids.campus,
    guardianUserId: ids.actor,
    studentId: ids.student,
    status: "ACTIVE",
    student: { id: ids.student, displayRef: "合成学生甲", status: "ACTIVE" },
  }) as MockRelationship;
  const consent = (overrides.consent ?? consentFixture()) as Record<string, unknown>;
  const db: Record<string, unknown> = {
    guardianRelationship: {
      findFirst: async (args: MockArgs) => {
        record("guardianRelationship.findFirst", args);
        const where = args.where ?? {};
        if (
          where.tenantId !== ids.tenant ||
          where.campusId !== ids.campus ||
          where.guardianUserId !== ids.actor ||
          where.studentId !== ids.student ||
          where.status !== "ACTIVE"
        )
          return null;
        return relationship;
      },
    },
    guardianConsent: {
      findFirst: async (args: MockArgs) => {
        record("guardianConsent.findFirst", args);
        if (overrides.consent === null) return null;
        const where = args.where ?? {};
        return Object.entries(where).every(([key, value]) => {
          if (key === "confirmedAt")
            return (
              consent.confirmedAt instanceof Date &&
              consent.confirmedAt <= (value as { lte: Date }).lte
            );
          return consent[key] === value;
        })
          ? consent
          : null;
      },
    },
    aIInstitutionSetting: {
      findUnique: async (args: MockArgs) => {
        record("aIInstitutionSetting.findUnique", args);
        return overrides.setting === undefined ? { enabled: true } : overrides.setting;
      },
    },
    parentLearningControl: {
      findFirst: async (args: MockArgs) => {
        record("parentLearningControl.findFirst", args);
        return overrides.control === undefined
          ? { enabled: true, maxDurationMinutes: 10, maxHintLevel: 2 }
          : overrides.control;
      },
    },
    parentLearningSession: {
      create: async ({ data }: MockArgs) => {
        if (!data) throw new Error("Expected session create data.");
        record("parentLearningSession.create", { data });
        const row = {
          ...data,
          tenantId: String(data.tenantId),
          campusId: String(data.campusId),
          guardianUserId: String(data.guardianUserId),
          studentId: String(data.studentId),
          status: "ACTIVE",
          version: 1,
          endedAt: null,
          mainAttempts: 0,
          lastHintAtAttempt: 0,
          mainWrongAttempts: 0,
          answeredAfterHint: false,
          mainCorrect: false,
          highestHintLevel: -1,
          visibleHintLevel: null,
          practiceOneAnswered: false,
          practiceOneCorrect: null,
          practiceTwoAnswered: false,
          practiceTwoCorrect: null,
          needsTeacherFollowUp: false,
          id: `70000000-0000-4000-8000-${String(sessions.length + 1).padStart(12, "0")}`,
          student: relationship.student,
        } as MockSession;
        sessions.push(row);
        return row;
      },
      findFirst: async ({ where = {} }: MockArgs) => {
        record("parentLearningSession.findFirst", { where });
        const row = sessions.find(
          (item) =>
            item.id === where.id &&
            item.tenantId === where.tenantId &&
            item.campusId === where.campusId &&
            item.guardianUserId === where.guardianUserId,
        );
        return row ? { ...row, student: relationship.student } : null;
      },
      findMany: async ({ where = {} }: MockArgs) => {
        record("parentLearningSession.findMany", { where });
        return sessions
          .filter(
            (item) =>
              item.tenantId === where.tenantId &&
              item.campusId === where.campusId &&
              item.guardianUserId === where.guardianUserId &&
              item.studentId === where.studentId,
          )
          .map((row) => ({ ...row, student: relationship.student }));
      },
      updateMany: async ({ where = {}, data = {} }: MockArgs) => {
        record("parentLearningSession.updateMany", { where, data });
        const row = sessions.find(
          (item) =>
            item.id === where.id &&
            item.tenantId === where.tenantId &&
            item.campusId === where.campusId &&
            item.guardianUserId === where.guardianUserId &&
            item.version === where.version &&
            (where.status === undefined || item.status === where.status),
        );
        if (!row) return { count: 0 };
        for (const [key, value] of Object.entries(data)) {
          row[key] =
            isRecord(value) && typeof value.increment === "number"
              ? Number(row[key] ?? 0) + value.increment
              : value;
        }
        return { count: 1 };
      },
    },
    $transaction: async (callback: (transaction: Record<string, unknown>) => Promise<unknown>) =>
      callback(db),
  };
  return { db, sessions, calls };
}

async function makeService(harness = makeHarness(), now = () => fixedTime) {
  const servicePath = "../src/modules/learning/prisma-parent-learning-session.service" + ".js";
  const { PrismaParentLearningSessionService } = await import(servicePath);
  return new PrismaParentLearningSessionService(harness.db as unknown as PrismaClient, now);
}

test("creates a scoped persistent fixed-question session only after consent and campus controls pass", async () => {
  const harness = makeHarness();
  const service = await makeService(harness);
  const result = await service.createSession(context, ids.student, {
    questionId: "math-grade-3-addition-01",
    consentVersion: "LEARNING_DEMO_V2",
    durationMinutes: 5,
  });

  assert.equal(result.studentLabel, "合成学生甲");
  assert.equal(result.guidanceMode, "FIXED_LOCAL");
  assert.equal(result.question.prompt, "238 + 165 = ？");
  assert.equal(result.status, "ACTIVE");
  assert.equal(harness.sessions[0]?.guardianUserId, ids.actor);
  assert.equal(harness.sessions[0]?.tenantId, ids.tenant);
  assert.equal(harness.sessions[0]?.campusId, ids.campus);
  assert.equal(harness.sessions[0]?.consentId, ids.consent);
  assert.equal(JSON.stringify(harness.sessions[0]).includes("freeText"), false);
});

test("refuses to create a session without current learning consent or an enabled campus switch", async () => {
  const noConsent = await makeService(makeHarness({ consent: null }));
  await assert.rejects(
    noConsent.createSession(context, ids.student, {
      questionId: "math-grade-3-addition-01",
      consentVersion: "LEARNING_DEMO_V2",
      durationMinutes: 5,
    }),
    { statusCode: 403 },
  );
  const staleConsent = await makeService(
    makeHarness({ consent: consentFixture({ policyVersion: "OLD_POLICY" }) }),
  );
  await assert.rejects(
    staleConsent.createSession(context, ids.student, {
      questionId: "math-grade-3-addition-01",
      consentVersion: "LEARNING_DEMO_V2",
      durationMinutes: 5,
    }),
    { statusCode: 403 },
  );
  const noSetting = await makeService(makeHarness({ setting: { enabled: false } }));
  await assert.rejects(
    noSetting.createSession(context, ids.student, {
      questionId: "math-grade-3-addition-01",
      consentVersion: "LEARNING_DEMO_V2",
      durationMinutes: 5,
    }),
    { statusCode: 403 },
  );
});

test("applies current parent duration and hint limits before creating a session", async () => {
  const service = await makeService(
    makeHarness({ control: { enabled: true, maxDurationMinutes: 5, maxHintLevel: 0 } }),
  );
  await assert.rejects(
    service.createSession(context, ids.student, {
      questionId: "math-grade-3-addition-01",
      consentVersion: "LEARNING_DEMO_V2",
      durationMinutes: 10,
    }),
    { statusCode: 403 },
  );
});

test("records only fixed answer choices and rejects a repeated or stale answer", async () => {
  const harness = makeHarness();
  const service = await makeService(harness);
  const created = await service.createSession(context, ids.student, {
    questionId: "math-grade-3-addition-01",
    consentVersion: "LEARNING_DEMO_V2",
    durationMinutes: 5,
  });
  const answered = await service.answerSession(context, created.id, {
    itemId: "main",
    choice: "A",
    expectedVersion: created.version,
  });
  assert.equal(answered.mainAttempts, 1);
  assert.equal(answered.mainCorrect, false);
  await assert.rejects(
    service.answerSession(context, created.id, {
      itemId: "main",
      choice: "B",
      expectedVersion: created.version,
    }),
    { statusCode: 409 },
  );
  await assert.rejects(
    service.answerSession(context, created.id, {
      itemId: "main",
      choice: "free text",
      expectedVersion: answered.version,
    }),
    { statusCode: 400 },
  );
});

test("uses bounded hints and fixed consolidation choices before completing the session", async () => {
  const harness = makeHarness();
  const service = await makeService(harness);
  const created = await service.createSession(context, ids.student, {
    questionId: "math-grade-3-addition-01",
    consentVersion: "LEARNING_DEMO_V2",
    durationMinutes: 5,
  });
  const firstAnswer = await service.answerSession(context, created.id, {
    itemId: "main",
    choice: "A",
    expectedVersion: created.version,
  });
  const hinted = await service.hintSession(context, created.id, {
    level: 0,
    expectedVersion: firstAnswer.version,
  });
  assert.equal(hinted.visibleHint?.level, 0);
  const solved = await service.answerSession(context, created.id, {
    itemId: "main",
    choice: "B",
    expectedVersion: hinted.version,
  });
  assert.equal(solved.mainCorrect, true);
  const firstPractice = await service.answerSession(context, created.id, {
    itemId: "practice-1",
    choice: "A",
    expectedVersion: solved.version,
  });
  const completed = await service.answerSession(context, created.id, {
    itemId: "practice-2",
    choice: "B",
    expectedVersion: firstPractice.version,
  });
  assert.equal(completed.status, "COMPLETED");
  assert.deepEqual(
    completed.consolidation.map((item: { correct: boolean | null }) => item.correct),
    [true, true],
  );
  assert.equal(harness.sessions[0]?.answeredAfterHint, true);
});

test("expires a session at its stored deadline and hides it from another guardian", async () => {
  const harness = makeHarness();
  const startedAt = new Date("2026-10-24T09:00:00.000Z");
  let currentTime = new Date(startedAt);
  const service = await makeService(harness, () => new Date(currentTime));
  const created = await service.createSession(context, ids.student, {
    questionId: "math-grade-3-addition-01",
    consentVersion: "LEARNING_DEMO_V2",
    durationMinutes: 5,
  });
  currentTime = new Date(startedAt.getTime() + 5 * 60_000);
  const expired = await service.getSession(context, created.id);
  assert.equal(expired.status, "EXPIRED");
  await assert.rejects(
    service.getSession({ ...context, actorId: "10000000-0000-4000-8000-000000000002" }, created.id),
    { statusCode: 404 },
  );
});
