import assert from "node:assert/strict";
import { test } from "node:test";
import type { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaParentLearningSummaryService } from "../src/modules/learning/prisma-parent-learning-summary.service.js";

const ids = {
  actor: "11111111-1111-4111-8111-111111111111",
  tenant: "22222222-2222-4222-8222-222222222222",
  campus: "33333333-3333-4333-8333-333333333333",
  relationship: "44444444-4444-4444-8444-444444444444",
  student: "55555555-5555-4555-8555-555555555555",
  membership: "66666666-6666-4666-8666-666666666666",
};

function statusCode(error: unknown): number | undefined {
  return typeof error === "object" && error !== null && "statusCode" in error
    ? Number(error.statusCode)
    : undefined;
}

function parentContext() {
  return {
    actorId: ids.actor,
    tenantId: ids.tenant,
    campusId: ids.campus,
    capabilities: ["binding:read"],
  };
}

function serviceWith(overrides: Record<string, unknown> = {}) {
  const calls: Record<string, unknown[]> = {};
  const recordCall = (name: string, value: unknown) => {
    calls[name] = [...(calls[name] ?? []), value];
  };
  const base = {
    guardianRelationship: {
      findMany: async (args: unknown) => {
        recordCall("guardianRelationship.findMany", args);
        return [
          {
            id: ids.relationship,
            tenantId: ids.tenant,
            campusId: ids.campus,
            guardianUserId: ids.actor,
            studentId: ids.student,
            status: "ACTIVE",
            student: { id: ids.student, displayRef: "模拟学生甲", classRef: "三年级甲班" },
            parentLearningControl: null,
            parentLearningContactIntent: null,
          },
        ];
      },
      findFirst: async (args: unknown) => {
        recordCall("guardianRelationship.findFirst", args);
        return {
          id: ids.relationship,
          tenantId: ids.tenant,
          campusId: ids.campus,
          guardianUserId: ids.actor,
          studentId: ids.student,
          status: "ACTIVE",
          student: { id: ids.student, displayRef: "模拟学生甲", classRef: "三年级甲班" },
        };
      },
    },
    parentLearningSummarySnapshot: {
      findMany: async (args: unknown) => {
        recordCall("summary.findMany", args);
        return [
          {
            tenantId: ids.tenant,
            campusId: ids.campus,
            studentId: ids.student,
            usedMinutes: 12,
            sessionCount: 2,
            completedSessions: 1,
            attentionCount: 1,
            knowledgePoints: [
              { label: "两位数加法", sessionCount: 2, completedSessions: 1 },
            ],
            reviewedAt: new Date("2026-10-18T10:00:00.000Z"),
            sessionId: "must-not-leak",
            rawAnswer: "must-not-leak",
          },
          {
            tenantId: ids.tenant,
            campusId: ids.campus,
            studentId: ids.student,
            usedMinutes: 8,
            sessionCount: 1,
            completedSessions: 1,
            attentionCount: 0,
            knowledgePoints: [
              { label: "两位数加法", sessionCount: 1, completedSessions: 1 },
            ],
            reviewedAt: new Date("2026-10-19T10:00:00.000Z"),
          },
          {
            tenantId: ids.tenant,
            campusId: ids.campus,
            studentId: "77777777-7777-4777-8777-777777777777",
            usedMinutes: 99,
            sessionCount: 9,
            completedSessions: 9,
            attentionCount: 0,
            knowledgePoints: [],
            reviewedAt: new Date("2026-10-20T10:00:00.000Z"),
          },
        ];
      },
      create: async (args: unknown) => {
        recordCall("summary.create", args);
        const data = (args as { readonly data: Record<string, unknown> }).data;
        return { id: "88888888-8888-4888-8888-888888888888", ...data };
      },
    },
    parentLearningControl: {
      upsert: async (args: unknown) => {
        recordCall("control.upsert", args);
        return {
          enabled: false,
          maxDurationMinutes: 10,
          maxHintLevel: 2,
          version: 2,
          ...(args as object),
        };
      },
    },
    parentLearningContactIntent: {
      upsert: async (args: unknown) => {
        recordCall("contact.upsert", args);
        return {
          id: "99999999-9999-4999-8999-999999999999",
          createdAt: new Date("2026-10-20T11:00:00.000Z"),
        };
      },
    },
    membershipCampus: {
      findMany: async (args: unknown) => {
        recordCall("membershipCampus.findMany", args);
        return [
          {
            membershipId: ids.membership,
            membership: { status: "ACTIVE" },
            classAssignments: [{ classRef: "三年级甲班" }],
          },
        ];
      },
    },
    student: {
      findFirst: async (args: unknown) => {
        recordCall("student.findFirst", args);
        return {
          id: ids.student,
          tenantId: ids.tenant,
          campusId: ids.campus,
          classRef: "三年级甲班",
          displayRef: "模拟学生甲",
          status: "ACTIVE",
        };
      },
    },
    guardianConsent: {
      findFirst: async (args: unknown) => {
        recordCall("guardianConsent.findFirst", args);
        return { status: "ACTIVE", scope: "LEARNING_SUPPORT" };
      },
    },
  };
  const prisma = { ...base, ...overrides } as unknown as PrismaClient;
  return { service: new PrismaParentLearningSummaryService(prisma, () => new Date("2026-10-20T12:00:00.000Z")), calls };
}

test("parent learning reads only active relationship snapshots and exposes the safe aggregate", async () => {
  const { service, calls } = serviceWith();

  const result = await service.parentLearning(parentContext());

  assert.deepEqual(result.approvedStudents, [
    { studentId: ids.student, studentLabel: "模拟学生甲", classLabel: "三年级甲班" },
  ]);
  assert.deepEqual(result.parentSummary, [
    {
      studentId: ids.student,
      studentLabel: "模拟学生甲",
      usedMinutes: 20,
      sessionCount: 3,
      completedSessions: 2,
      knowledgePoints: [
        { label: "两位数加法", sessionCount: 3, completedSessions: 2 },
      ],
      attentionCount: 1,
    },
  ]);
  assert.deepEqual(Object.keys(result.parentSummary[0]!).sort(), [
    "attentionCount",
    "completedSessions",
    "knowledgePoints",
    "sessionCount",
    "studentId",
    "studentLabel",
    "usedMinutes",
  ]);
  assert.deepEqual(result.parentControls, [
    {
      studentId: ids.student,
      studentLabel: "模拟学生甲",
      enabled: true,
      maxDurationMinutes: 15,
      maxHintLevel: 3,
      contactStatus: "NOT_REQUESTED",
    },
  ]);
  assert.equal(result.parentSummaryUpdatedAt, "2026-10-20T12:00:00.000Z");
  assert.deepEqual(calls["guardianRelationship.findMany"]?.[0], {
    where: {
      tenantId: ids.tenant,
      campusId: ids.campus,
      guardianUserId: ids.actor,
      status: "ACTIVE",
    },
    include: {
      student: true,
      parentLearningControl: true,
      parentLearningContactIntent: true,
    },
  });
});

test("parent learning does not double-count repeated knowledge labels in stored daily snapshots", async () => {
  const { service } = serviceWith({
    parentLearningSummarySnapshot: {
      findMany: async () => [
        {
          tenantId: ids.tenant,
          campusId: ids.campus,
          studentId: ids.student,
          usedMinutes: 12,
          sessionCount: 2,
          completedSessions: 1,
          attentionCount: 0,
          knowledgePoints: [
            { label: "两位数加法", sessionCount: 1, completedSessions: 1 },
            { label: "两位数加法", sessionCount: 1, completedSessions: 0 },
          ],
          reviewedAt: new Date("2026-10-20T10:00:00.000Z"),
        },
      ],
    },
  });

  const result = await service.parentLearning(parentContext());

  assert.deepEqual(result.parentSummary[0]?.knowledgePoints, [
    { label: "两位数加法", sessionCount: 1, completedSessions: 1 },
  ]);
});

test("parent learning aggregates cumulative knowledge counts above the daily input limit", async () => {
  const { service } = serviceWith({
    parentLearningSummarySnapshot: {
      findMany: async () => [
        {
          tenantId: ids.tenant,
          campusId: ids.campus,
          studentId: ids.student,
          usedMinutes: 12,
          sessionCount: 101,
          completedSessions: 101,
          attentionCount: 0,
          knowledgePoints: [
            { label: "两位数加法", sessionCount: 101, completedSessions: 101 },
          ],
          reviewedAt: new Date("2026-10-20T10:00:00.000Z"),
        },
      ],
    },
  });

  const result = await service.parentLearning(parentContext());

  assert.deepEqual(result.parentSummary[0]?.knowledgePoints, [
    { label: "两位数加法", sessionCount: 101, completedSessions: 101 },
  ]);
});

test("parent learning controls and contact are persisted only for the active child relation", async () => {
  const { service, calls } = serviceWith();

  const controls = await service.updateParentLearningControls(
    { ...parentContext(), capabilities: ["binding:read", "binding:apply"] },
    ids.student,
    { enabled: false, maxDurationMinutes: 10, maxHintLevel: 2 },
  );
  const contact = await service.recordParentLearningContact(parentContext(), ids.student, {});
  const repeatedContact = await service.recordParentLearningContact(parentContext(), ids.student, {});

  assert.equal(controls.studentId, ids.student);
  assert.equal(controls.enabled, false);
  assert.equal(contact.status, "RECORDED_LOCAL");
  assert.equal(repeatedContact.status, "RECORDED_LOCAL");
  assert.equal(contact.studentLabel, "模拟学生甲");
  assert.equal(calls["control.upsert"]?.length, 1);
  assert.equal(calls["contact.upsert"]?.length, 2);
});

test("parent controls reject string values instead of coercing them", async () => {
  const { service, calls } = serviceWith();

  await assert.rejects(
    service.updateParentLearningControls(
      { ...parentContext(), capabilities: ["binding:apply"] },
      ids.student,
      { enabled: true, maxDurationMinutes: "10", maxHintLevel: 2 },
    ),
    (error: unknown) => statusCode(error) === 400,
  );
  assert.equal(calls["control.upsert"], undefined);
});

test("released relationships immediately hide the child and do not query snapshots", async () => {
  const { service, calls } = serviceWith({
    guardianRelationship: {
      findMany: async () => [],
    },
  });

  const result = await service.parentLearning(parentContext());

  assert.deepEqual(result.approvedStudents, []);
  assert.deepEqual(result.parentControls, []);
  assert.deepEqual(result.parentSummary, []);
  assert.equal(calls["summary.findMany"], undefined);
});

test("staff summary submission requires its class and consent scope and stores only reviewed fields", async () => {
  const { service, calls } = serviceWith();

  const result = await service.submitStaffSummary(
    { ...parentContext(), capabilities: ["learning:summary"] },
    {
      studentId: ids.student,
      summaryDate: "2026-10-20",
      usedMinutes: 12,
      sessionCount: 2,
      completedSessions: 1,
      knowledgePoints: [
        { label: "两位数加法", sessionCount: 2, completedSessions: 1 },
      ],
      attentionCount: 1,
    },
  );

  assert.equal(result.studentId, ids.student);
  assert.equal(result.reviewedByMembershipId, ids.membership);
  const create = calls["summary.create"]?.[0] as { data?: Record<string, unknown> } | undefined;
  assert.deepEqual(Object.keys(create?.data ?? {}).sort(), [
    "campusId",
    "classRef",
    "completedSessions",
    "knowledgePoints",
    "reviewedAt",
    "reviewedByMembershipId",
    "sessionCount",
    "studentId",
    "summaryDate",
    "tenantId",
    "usedMinutes",
    "attentionCount",
  ].sort());
  assert.equal("rawAnswer" in (create?.data ?? {}), false);
});

test("staff summary submission rejects inconsistent counts and does not write", async () => {
  const { service, calls } = serviceWith();

  await assert.rejects(
    service.submitStaffSummary(
      { ...parentContext(), capabilities: ["learning:summary"] },
      {
        studentId: ids.student,
        summaryDate: "2026-10-20",
        usedMinutes: 12,
        sessionCount: 1,
        completedSessions: 2,
        knowledgePoints: [],
        attentionCount: 0,
      },
    ),
    (error: unknown) => statusCode(error) === 400,
  );

  assert.equal(calls["summary.create"], undefined);
});

test("staff summary submission rejects overbroad fields and knowledge counts beyond session totals", async () => {
  const { service, calls } = serviceWith();
  const context = { ...parentContext(), capabilities: ["learning:summary"] };
  const summary = {
    studentId: ids.student,
    summaryDate: "2026-10-20",
    usedMinutes: 12,
    sessionCount: 1,
    completedSessions: 1,
    knowledgePoints: [
      { label: "两位数加法", sessionCount: 2, completedSessions: 1 },
    ],
    attentionCount: 0,
  };

  await assert.rejects(
    service.submitStaffSummary(context, summary),
    (error: unknown) => statusCode(error) === 400,
  );
  await assert.rejects(
    service.submitStaffSummary(context, { ...summary, rawAnswer: "不得接收" }),
    (error: unknown) => statusCode(error) === 400,
  );
  assert.equal(calls["summary.create"], undefined);
});

test("staff summary submission rejects duplicate knowledge point labels", async () => {
  const { service, calls } = serviceWith();

  await assert.rejects(
    service.submitStaffSummary(
      { ...parentContext(), capabilities: ["learning:summary"] },
      {
        studentId: ids.student,
        summaryDate: "2026-10-20",
        usedMinutes: 12,
        sessionCount: 2,
        completedSessions: 1,
        knowledgePoints: [
          { label: "两位数加法", sessionCount: 1, completedSessions: 1 },
          { label: "两位数加法", sessionCount: 1, completedSessions: 0 },
        ],
        attentionCount: 0,
      },
    ),
    (error: unknown) => statusCode(error) === 400,
  );

  assert.equal(calls["summary.create"], undefined);
});

test("staff summary submission fails closed when the actor has multiple active campus memberships", async () => {
  const { service, calls } = serviceWith({
    membershipCampus: {
      findMany: async () => [
        {
          membershipId: ids.membership,
          membership: { status: "ACTIVE" },
          classAssignments: [{ classRef: "三年级甲班" }],
        },
        {
          membershipId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          membership: { status: "ACTIVE" },
          classAssignments: [],
        },
      ],
    },
  });

  await assert.rejects(
    service.submitStaffSummary(
      { ...parentContext(), capabilities: ["learning:summary"] },
      {
        studentId: ids.student,
        summaryDate: "2026-10-20",
        usedMinutes: 12,
        sessionCount: 2,
        completedSessions: 1,
        knowledgePoints: [],
        attentionCount: 1,
      },
    ),
    (error: unknown) => statusCode(error) === 403,
  );

  assert.equal(calls["student.findFirst"], undefined);
  assert.equal(calls["summary.create"], undefined);
});

test("staff summary submission rejects an unassigned class and missing active consent", async () => {
  const unassigned = serviceWith({
    membershipCampus: {
      findMany: async () => [
        {
          membershipId: ids.membership,
          membership: { status: "ACTIVE" },
          classAssignments: [{ classRef: "三年级乙班" }],
        },
      ],
    },
  });
  await assert.rejects(
    unassigned.service.submitStaffSummary(
      { ...parentContext(), capabilities: ["learning:summary"] },
      {
        studentId: ids.student,
        summaryDate: "2026-10-20",
        usedMinutes: 12,
        sessionCount: 2,
        completedSessions: 1,
        knowledgePoints: [],
        attentionCount: 1,
      },
    ),
    (error: unknown) => statusCode(error) === 403,
  );
  assert.equal(unassigned.calls["summary.create"], undefined);

  const noConsent = serviceWith({
    guardianConsent: { findFirst: async () => null },
  });
  await assert.rejects(
    noConsent.service.submitStaffSummary(
      { ...parentContext(), capabilities: ["learning:summary"] },
      {
        studentId: ids.student,
        summaryDate: "2026-10-20",
        usedMinutes: 12,
        sessionCount: 2,
        completedSessions: 1,
        knowledgePoints: [],
        attentionCount: 1,
      },
    ),
    (error: unknown) => statusCode(error) === 404,
  );
  assert.equal(noConsent.calls["summary.create"], undefined);
});

test("duplicate daily summary returns a conflict", async () => {
  const { service } = serviceWith({
    parentLearningSummarySnapshot: {
      create: async () => {
        throw { code: "P2002" };
      },
    },
  });

  await assert.rejects(
    service.submitStaffSummary(
      { ...parentContext(), capabilities: ["learning:summary"] },
      {
        studentId: ids.student,
        summaryDate: "2026-10-20",
        usedMinutes: 12,
        sessionCount: 2,
        completedSessions: 1,
        knowledgePoints: [],
        attentionCount: 1,
      },
    ),
    (error: unknown) => statusCode(error) === 409,
  );
});
