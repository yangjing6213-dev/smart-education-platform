import { Prisma, type PrismaClient } from "../../generated/prisma/client.js";
import type {
  ParentLearningContext,
  ParentLearningOperations,
  ParentLearningSummaryInput,
} from "../../nest/api-tokens.js";

type KnowledgePoint = {
  readonly label: string;
  readonly sessionCount: number;
  readonly completedSessions: number;
};

type ParentLearningSummaryRow = {
  readonly studentId: string;
  readonly studentLabel: string;
  readonly usedMinutes: number;
  readonly sessionCount: number;
  readonly completedSessions: number;
  readonly knowledgePoints: readonly KnowledgePoint[];
  readonly attentionCount: number;
};

const KNOWLEDGE_POINT_LABELS = new Set(["两位数加法", "两位数加法与进位"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

class ParentLearningFailure extends Error {
  public readonly statusCode: 400 | 403 | 404 | 409;

  public constructor(
    public readonly code:
      | "VALIDATION_FAILED"
      | "FORBIDDEN_SCOPE"
      | "NOT_FOUND_SCOPED"
      | "CONFLICT_STATE",
  ) {
    super(code);
    this.statusCode =
      code === "VALIDATION_FAILED"
        ? 400
        : code === "FORBIDDEN_SCOPE"
          ? 403
          : code === "NOT_FOUND_SCOPED"
            ? 404
            : 409;
  }
}

const invalid = () => new ParentLearningFailure("VALIDATION_FAILED");
const forbidden = () => new ParentLearningFailure("FORBIDDEN_SCOPE");
const notFound = () => new ParentLearningFailure("NOT_FOUND_SCOPED");
const conflict = () => new ParentLearningFailure("CONFLICT_STATE");

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactBody(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return (
    isRecord(value) &&
    Object.keys(value).length === keys.length &&
    Object.keys(value).every((key) => keys.includes(key))
  );
}

function safeCount(value: unknown, maximum: number): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= maximum;
}

function parseKnowledgePoint(value: unknown): KnowledgePoint {
  if (
    !exactBody(value, ["label", "sessionCount", "completedSessions"]) ||
    typeof value.label !== "string" ||
    !KNOWLEDGE_POINT_LABELS.has(value.label) ||
    !safeCount(value.sessionCount, 100) ||
    !safeCount(value.completedSessions, value.sessionCount)
  )
    throw invalid();

  return {
    label: value.label,
    sessionCount: value.sessionCount,
    completedSessions: value.completedSessions,
  };
}

function parseStoredKnowledgePoint(value: unknown): KnowledgePoint | undefined {
  if (
    !exactBody(value, ["label", "sessionCount", "completedSessions"]) ||
    typeof value.label !== "string" ||
    !KNOWLEDGE_POINT_LABELS.has(value.label) ||
    !safeCount(value.sessionCount, Number.MAX_SAFE_INTEGER) ||
    !safeCount(value.completedSessions, value.sessionCount)
  )
    return undefined;

  return {
    label: value.label,
    sessionCount: value.sessionCount,
    completedSessions: value.completedSessions,
  };
}

function parseStoredKnowledgePoints(value: Prisma.JsonValue): readonly KnowledgePoint[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: KnowledgePoint[] = [];
  for (const item of value) {
    const point = parseStoredKnowledgePoint(item);
    if (point === undefined || seen.has(point.label)) continue;
    seen.add(point.label);
    result.push(point);
  }
  return result;
}

function parseControls(value: unknown) {
  if (
    !exactBody(value, ["enabled", "maxDurationMinutes", "maxHintLevel"]) ||
    typeof value.enabled !== "boolean" ||
    !Number.isSafeInteger(value.maxDurationMinutes) ||
    ![5, 10, 15].includes(Number(value.maxDurationMinutes)) ||
    !Number.isSafeInteger(value.maxHintLevel) ||
    Number(value.maxHintLevel) < 0 ||
    Number(value.maxHintLevel) > 3
  )
    throw invalid();

  return {
    enabled: value.enabled,
    maxDurationMinutes: Number(value.maxDurationMinutes),
    maxHintLevel: Number(value.maxHintLevel),
  };
}

function parseSummary(value: unknown): ParentLearningSummaryInput {
  const keys = [
    "studentId",
    "summaryDate",
    "usedMinutes",
    "sessionCount",
    "completedSessions",
    "knowledgePoints",
    "attentionCount",
  ] as const;
  if (
    !exactBody(value, keys) ||
    typeof value.studentId !== "string" ||
    !UUID.test(value.studentId) ||
    typeof value.summaryDate !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/u.test(value.summaryDate) ||
    !safeCount(value.usedMinutes, 1440) ||
    !safeCount(value.sessionCount, 100) ||
    !safeCount(value.completedSessions, value.sessionCount) ||
    !safeCount(value.attentionCount, value.sessionCount) ||
    !Array.isArray(value.knowledgePoints) ||
    value.knowledgePoints.length > 12
  )
    throw invalid();

  const summaryDate = new Date(`${value.summaryDate}T00:00:00.000Z`);
  if (Number.isNaN(summaryDate.getTime()) || summaryDate.toISOString().slice(0, 10) !== value.summaryDate)
    throw invalid();
  const knowledgePoints = value.knowledgePoints.map(parseKnowledgePoint);
  if (new Set(knowledgePoints.map((point) => point.label)).size !== knowledgePoints.length)
    throw invalid();
  if (knowledgePoints.some((point) => point.sessionCount > Number(value.sessionCount)))
    throw invalid();

  return {
    studentId: value.studentId,
    summaryDate: value.summaryDate,
    usedMinutes: value.usedMinutes,
    sessionCount: value.sessionCount,
    completedSessions: value.completedSessions,
    knowledgePoints,
    attentionCount: value.attentionCount,
  };
}

function aggregateRows(
  studentId: string,
  studentLabel: string,
  rows: readonly {
    readonly usedMinutes: number;
    readonly sessionCount: number;
    readonly completedSessions: number;
    readonly knowledgePoints: Prisma.JsonValue;
    readonly attentionCount: number;
  }[],
): ParentLearningSummaryRow {
  const knowledge = new Map<string, { sessionCount: number; completedSessions: number }>();
  for (const row of rows) {
    for (const point of parseStoredKnowledgePoints(row.knowledgePoints)) {
      const current = knowledge.get(point.label) ?? { sessionCount: 0, completedSessions: 0 };
      current.sessionCount += point.sessionCount;
      current.completedSessions += point.completedSessions;
      knowledge.set(point.label, current);
    }
  }
  return {
    studentId,
    studentLabel,
    usedMinutes: rows.reduce((sum, row) => sum + row.usedMinutes, 0),
    sessionCount: rows.reduce((sum, row) => sum + row.sessionCount, 0),
    completedSessions: rows.reduce((sum, row) => sum + row.completedSessions, 0),
    knowledgePoints: [...knowledge.entries()].map(([label, count]) => ({ label, ...count })),
    attentionCount: rows.reduce((sum, row) => sum + row.attentionCount, 0),
  };
}

export class PrismaParentLearningSummaryService implements ParentLearningOperations {
  public constructor(
    private readonly prisma: PrismaClient,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async parentLearning(context: ParentLearningContext) {
    if (!context.capabilities.includes("binding:read")) throw forbidden();
    const relationships = await this.prisma.guardianRelationship.findMany({
      where: {
        tenantId: context.tenantId,
        campusId: context.campusId,
        guardianUserId: context.actorId,
        status: "ACTIVE",
      },
      include: { student: true, parentLearningControl: true, parentLearningContactIntent: true },
    });
    const studentIds = relationships.map((relationship) => relationship.studentId);
    const snapshots = studentIds.length
      ? await this.prisma.parentLearningSummarySnapshot.findMany({
          where: {
            tenantId: context.tenantId,
            campusId: context.campusId,
            studentId: { in: studentIds },
          },
          orderBy: [{ reviewedAt: "asc" }, { id: "asc" }],
        })
      : [];

    return {
      approvedStudents: relationships.map((relationship) => ({
        studentId: relationship.studentId,
        studentLabel: relationship.student.displayRef,
        classLabel: relationship.student.classRef,
      })),
      parentControls: relationships.map((relationship) => ({
        studentId: relationship.studentId,
        studentLabel: relationship.student.displayRef,
        enabled: relationship.parentLearningControl?.enabled ?? true,
        maxDurationMinutes: relationship.parentLearningControl?.maxDurationMinutes ?? 15,
        maxHintLevel: relationship.parentLearningControl?.maxHintLevel ?? 3,
        contactStatus: relationship.parentLearningContactIntent ? "RECORDED_LOCAL" : "NOT_REQUESTED",
      })),
      parentSummary: relationships.map((relationship) =>
        aggregateRows(
          relationship.studentId,
          relationship.student.displayRef,
          snapshots.filter((snapshot) => snapshot.studentId === relationship.studentId),
        ),
      ),
      parentSummaryUpdatedAt: this.now().toISOString(),
    };
  }

  public async updateParentLearningControls(
    context: ParentLearningContext,
    studentId: string,
    value: unknown,
  ) {
    if (!context.capabilities.includes("binding:apply")) throw forbidden();
    if (!UUID.test(studentId)) throw invalid();
    const input = parseControls(value);
    const relationship = await this.findActiveRelationship(context, studentId);
    const row = await this.prisma.parentLearningControl.upsert({
      where: {
        tenantId_campusId_guardianRelationshipId_studentId_guardianUserId: {
          tenantId: context.tenantId,
          campusId: context.campusId,
          guardianRelationshipId: relationship.id,
          studentId: relationship.studentId,
          guardianUserId: context.actorId,
        },
      },
      create: {
        tenantId: context.tenantId,
        campusId: context.campusId,
        guardianRelationshipId: relationship.id,
        studentId: relationship.studentId,
        guardianUserId: context.actorId,
        ...input,
      },
      update: { ...input, version: { increment: 1 } },
    });
    return {
      studentId: relationship.studentId,
      studentLabel: relationship.student.displayRef,
      enabled: row.enabled,
      maxDurationMinutes: row.maxDurationMinutes,
      maxHintLevel: row.maxHintLevel,
    };
  }

  public async recordParentLearningContact(
    context: ParentLearningContext,
    studentId: string,
    value: unknown,
  ) {
    if (!context.capabilities.includes("binding:read")) throw forbidden();
    if (!UUID.test(studentId) || !isRecord(value) || Object.keys(value).length !== 0) throw invalid();
    const relationship = await this.findActiveRelationship(context, studentId);
    await this.prisma.parentLearningContactIntent.upsert({
      where: {
        tenantId_campusId_guardianRelationshipId_studentId_guardianUserId: {
          tenantId: context.tenantId,
          campusId: context.campusId,
          guardianRelationshipId: relationship.id,
          studentId: relationship.studentId,
          guardianUserId: context.actorId,
        },
      },
      create: {
        tenantId: context.tenantId,
        campusId: context.campusId,
        guardianRelationshipId: relationship.id,
        studentId: relationship.studentId,
        guardianUserId: context.actorId,
      },
      update: {},
    });
    return {
      studentId: relationship.studentId,
      studentLabel: relationship.student.displayRef,
      status: "RECORDED_LOCAL" as const,
    };
  }

  public async submitStaffSummary(context: ParentLearningContext, value: unknown) {
    if (!context.capabilities.includes("learning:summary")) throw forbidden();
    const input = parseSummary(value);
    const staffMemberships = await this.prisma.membershipCampus.findMany({
      where: {
        tenantId: context.tenantId,
        campusId: context.campusId,
        membership: { userId: context.actorId, status: "ACTIVE" },
      },
      include: { membership: true, classAssignments: true },
    });
    if (staffMemberships.length !== 1) throw forbidden();
    const membership = staffMemberships[0]!;
    if (
      membership.membership.status !== "ACTIVE" ||
      !membership.classAssignments.some((assignment) => assignment.classRef.length > 0)
    )
      throw forbidden();

    const student = await this.prisma.student.findFirst({
      where: {
        id: input.studentId,
        tenantId: context.tenantId,
        campusId: context.campusId,
        status: "ACTIVE",
      },
    });
    if (student === null) throw notFound();
    if (!membership.classAssignments.some((assignment) => assignment.classRef === student.classRef))
      throw forbidden();

    const consent = await this.prisma.guardianConsent.findFirst({
      where: {
        tenantId: context.tenantId,
        campusId: context.campusId,
        studentId: student.id,
        scope: "LEARNING_SUPPORT",
        status: "ACTIVE",
        guardianRelationship: { is: { status: "ACTIVE" } },
      },
    });
    if (consent === null) throw notFound();

    try {
      const row = await this.prisma.parentLearningSummarySnapshot.create({
        data: {
          tenantId: context.tenantId,
          campusId: context.campusId,
          studentId: student.id,
          classRef: student.classRef,
          summaryDate: new Date(`${input.summaryDate}T00:00:00.000Z`),
          usedMinutes: input.usedMinutes,
          sessionCount: input.sessionCount,
          completedSessions: input.completedSessions,
          knowledgePoints: input.knowledgePoints as Prisma.InputJsonValue,
          attentionCount: input.attentionCount,
          reviewedByMembershipId: membership.membershipId,
          reviewedAt: this.now(),
        },
      });
      return {
        studentId: row.studentId,
        summaryDate: input.summaryDate,
        reviewedByMembershipId: row.reviewedByMembershipId,
        reviewedAt: row.reviewedAt.toISOString(),
      };
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2002"
      )
        throw conflict();
      throw error;
    }
  }

  private async findActiveRelationship(context: ParentLearningContext, studentId: string) {
    const relationship = await this.prisma.guardianRelationship.findFirst({
      where: {
        tenantId: context.tenantId,
        campusId: context.campusId,
        guardianUserId: context.actorId,
        studentId,
        status: "ACTIVE",
      },
      include: { student: true },
    });
    if (relationship === null) throw notFound();
    return relationship;
  }
}
