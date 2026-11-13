import { randomUUID } from "node:crypto";
import type {
  GuardianBindingApplicationInput,
  GuardianBindingApplicationProjection,
  GuardianBindingApplicationReviewInput,
  GuardianRelationshipProjection,
  GuardianRelationshipReleaseInput,
  GuardianBindingStudentOption,
} from "@student-care/contracts";
import type { PrismaClient } from "../../generated/prisma/client.js";
import type {
  GuardianBindingContext,
  GuardianBindingOperations,
  GuardianBindingResult,
  GuardianBindingReviewQueueProjection,
} from "./guardian-binding.service.js";

type ScopePair = { readonly tenantId: string; readonly campusId: string };

function failure<T>(
  code: "NOT_FOUND_SCOPED" | "CONFLICT_STATE" | "VERSION_MISMATCH",
  message: string,
): GuardianBindingResult<T> {
  return { ok: false, error: { code, message } };
}

function scopePairs(context: GuardianBindingContext): ScopePair[] {
  return context.scopes.flatMap((scope) =>
    scope.campusId === undefined ? [] : [{ tenantId: scope.tenantId, campusId: scope.campusId }],
  );
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { readonly code?: unknown }).code === "P2002"
  );
}

function applicationProjection(row: {
  readonly id: string;
  readonly studentCandidateRef: string;
  readonly status: GuardianBindingApplicationProjection["status"];
  readonly version: number;
  readonly createdAt: Date;
  readonly reviewedAt: Date | null;
}): GuardianBindingApplicationProjection {
  return {
    id: row.id,
    student_candidate_ref: row.studentCandidateRef,
    relationship: "GUARDIAN",
    status: row.status,
    version: row.version,
    submitted_at: row.createdAt.toISOString(),
    reviewed_at: row.reviewedAt?.toISOString() ?? null,
  };
}

function relationshipProjection(row: {
  readonly id: string;
  readonly studentId: string;
  readonly bindingApplicationId: string;
  readonly status: GuardianRelationshipProjection["status"];
  readonly version: number;
  readonly approvedAt: Date;
}): GuardianRelationshipProjection {
  return {
    id: row.id,
    student_id: row.studentId,
    relationship: "GUARDIAN",
    status: row.status,
    source_application_id: row.bindingApplicationId,
    version: row.version,
    approved_at: row.approvedAt.toISOString(),
  };
}

export class PrismaGuardianBindingService implements GuardianBindingOperations {
  public constructor(
    private readonly prisma: PrismaClient,
    private readonly invitedStudentIds: ReadonlyMap<string, readonly string[]> = new Map(),
    private readonly applicantLabels: ReadonlyMap<string, string> = new Map(),
  ) {}

  private candidates(context: GuardianBindingContext): readonly string[] {
    const actorId = context.scopes[0]?.actorId;
    if (actorId === undefined || context.scopes.some((scope) => scope.actorId !== actorId))
      return [];
    return this.invitedStudentIds.get(actorId) ?? [];
  }

  public async listStudentOptions(
    context: GuardianBindingContext,
  ): Promise<readonly GuardianBindingStudentOption[]> {
    const ids = this.candidates(context);
    const pairs = scopePairs(context);
    if (ids.length === 0 || pairs.length === 0) return [];
    const students = await this.prisma.student.findMany({
      where: { id: { in: [...ids] }, status: "ACTIVE", OR: pairs },
      select: { id: true, displayRef: true },
      orderBy: { id: "asc" },
      take: 100,
    });
    return students.map((student) => ({
      id: student.id,
      alias: student.id,
      label: student.displayRef.trim().slice(0, 80) || "受邀关联学生",
    }));
  }

  public async onModuleDestroy(): Promise<void> {
    await this.prisma.$disconnect();
  }

  public async submit(
    context: GuardianBindingContext,
    input: GuardianBindingApplicationInput,
  ): Promise<GuardianBindingResult<GuardianBindingApplicationProjection>> {
    const pairs = scopePairs(context);
    const applicantUserId = context.scopes[0]?.actorId;
    if (
      pairs.length === 0 ||
      applicantUserId === undefined ||
      context.scopes.some((scope) => scope.actorId !== applicantUserId) ||
      !this.candidates(context).includes(input.student_candidate_ref)
    ) {
      return failure("NOT_FOUND_SCOPED", "Student candidate was not found in the allowed scope.");
    }

    const [student, applicant] = await Promise.all([
      this.prisma.student.findFirst({
        where: { id: input.student_candidate_ref, status: "ACTIVE", OR: pairs },
        orderBy: [{ tenantId: "asc" }, { campusId: "asc" }],
      }),
      this.prisma.user.findUnique({ where: { id: applicantUserId }, select: { id: true } }),
    ]);
    if (student === null || applicant === null) {
      return failure("NOT_FOUND_SCOPED", "Student candidate was not found in the allowed scope.");
    }

    const [pendingApplication, activeRelationship] = await Promise.all([
      this.prisma.bindingApplication.findFirst({
        where: {
          tenantId: student.tenantId,
          campusId: student.campusId,
          applicantUserId,
          studentCandidateRef: student.id,
          status: "PENDING",
        },
        select: { id: true },
      }),
      this.prisma.guardianRelationship.findFirst({
        where: {
          tenantId: student.tenantId,
          campusId: student.campusId,
          guardianUserId: applicantUserId,
          studentId: student.id,
          status: "ACTIVE",
        },
        select: { id: true },
      }),
    ]);
    if (pendingApplication !== null || activeRelationship !== null) {
      return failure(
        "CONFLICT_STATE",
        "A pending application or active relationship already exists.",
      );
    }

    try {
      const application = await this.prisma.bindingApplication.create({
        data: {
          tenantId: student.tenantId,
          campusId: student.campusId,
          applicantUserId,
          onboardingScopeRef: randomUUID(),
          studentCandidateRef: student.id,
        },
      });
      return { ok: true, data: applicationProjection(application) };
    } catch (error) {
      if (isUniqueViolation(error)) {
        return failure("CONFLICT_STATE", "An application for this student already exists.");
      }
      throw error;
    }
  }

  public async listApplications(
    context: GuardianBindingContext,
  ): Promise<readonly GuardianBindingApplicationProjection[]> {
    const applicantUserId = context.scopes[0]?.actorId;
    const pairs = scopePairs(context);
    if (applicantUserId === undefined || pairs.length === 0) return [];
    const rows = await this.prisma.bindingApplication.findMany({
      where: { applicantUserId, OR: pairs },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    return rows.map(applicationProjection);
  }

  public async listRelationships(
    context: GuardianBindingContext,
  ): Promise<readonly GuardianRelationshipProjection[]> {
    const guardianUserId = context.scopes[0]?.actorId;
    const pairs = scopePairs(context);
    if (guardianUserId === undefined || pairs.length === 0) return [];
    const rows = await this.prisma.guardianRelationship.findMany({
      where: { guardianUserId, OR: pairs },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    return rows.map(relationshipProjection);
  }

  public async listPending(
    context: GuardianBindingContext,
  ): Promise<readonly GuardianBindingApplicationProjection[]> {
    const pairs = scopePairs(context);
    if (pairs.length === 0) return [];
    const rows = await this.prisma.bindingApplication.findMany({
      where: { status: "PENDING", OR: pairs },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    return rows.map(applicationProjection);
  }

  public async listPendingForReview(
    context: GuardianBindingContext,
  ): Promise<readonly GuardianBindingReviewQueueProjection[]> {
    const pairs = scopePairs(context);
    const actorId = context.scopes[0]?.actorId;
    if (
      pairs.length === 0 ||
      actorId === undefined ||
      context.scopes.some((scope) => scope.actorId !== actorId)
    )
      return [];
    const rows = await this.prisma.bindingApplication.findMany({
      where: { status: "PENDING", OR: pairs },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: 100,
    });
    if (rows.length === 0) return [];
    const students = await this.prisma.student.findMany({
      where: {
        OR: rows.map((row) => ({
          id: row.studentCandidateRef,
          tenantId: row.tenantId,
          campusId: row.campusId,
        })),
      },
      select: { id: true, tenantId: true, campusId: true, displayRef: true },
    });
    return rows.map((row) => {
      const student = students.find(
        (item) =>
          item.id === row.studentCandidateRef &&
          item.tenantId === row.tenantId &&
          item.campusId === row.campusId,
      );
      const applicantLabel = this.applicantLabels
        .get(row.applicantUserId)
        ?.replace(/\s+/gu, " ")
        .trim()
        .slice(0, 80);
      const studentLabel = student?.displayRef.replace(/\s+/gu, " ").trim().slice(0, 80);
      return {
        id: row.id,
        relationship: "GUARDIAN",
        status: row.status,
        version: row.version,
        submitted_at: row.createdAt.toISOString(),
        reviewed_at: row.reviewedAt?.toISOString() ?? null,
        applicant_label: applicantLabel || "申请人信息待补充",
        student_label: studentLabel || "学生信息待补充",
      };
    });
  }

  public async review(
    context: GuardianBindingContext,
    applicationId: string,
    input: GuardianBindingApplicationReviewInput,
  ): Promise<GuardianBindingResult<GuardianBindingApplicationProjection>> {
    const pairs = scopePairs(context);
    const reviewerActorId = context.scopes[0]?.actorId;
    if (pairs.length === 0 || reviewerActorId === undefined) {
      return failure("NOT_FOUND_SCOPED", "Application was not found in the allowed scope.");
    }

    return this.prisma.$transaction(async (transaction) => {
      const application = await transaction.bindingApplication.findFirst({
        where: { id: applicationId, OR: pairs },
      });
      if (application === null) {
        return failure("NOT_FOUND_SCOPED", "Application was not found in the allowed scope.");
      }
      if (application.version !== input.version) {
        return failure("VERSION_MISMATCH", "Application version is stale.");
      }
      if (application.status !== "PENDING") {
        return failure("CONFLICT_STATE", "Application is no longer pending review.");
      }

      const reviewer = await transaction.membershipCampus.findFirst({
        where: {
          tenantId: application.tenantId,
          campusId: application.campusId,
          membership: { is: { userId: reviewerActorId, status: "ACTIVE" } },
        },
        select: { membershipId: true },
      });
      if (reviewer === null) {
        return failure("NOT_FOUND_SCOPED", "Application was not found in the allowed scope.");
      }

      const reviewedAt = new Date();
      const update = await transaction.bindingApplication.updateMany({
        where: {
          tenantId: application.tenantId,
          campusId: application.campusId,
          id: application.id,
          status: "PENDING",
          version: input.version,
        },
        data: {
          status: input.action === "approve" ? "APPROVED" : "REJECTED",
          version: { increment: 1 },
          reviewedByMembershipId: reviewer.membershipId,
          reviewedAt,
        },
      });
      if (update.count !== 1) {
        const current = await transaction.bindingApplication.findFirst({
          where: {
            tenantId: application.tenantId,
            campusId: application.campusId,
            id: application.id,
          },
        });
        return current !== null && current.version !== input.version
          ? failure("VERSION_MISMATCH", "Application version is stale.")
          : failure("CONFLICT_STATE", "Application is no longer pending review.");
      }

      if (input.action === "approve") {
        const relationship = await transaction.guardianRelationship.create({
          data: {
            tenantId: application.tenantId,
            campusId: application.campusId,
            bindingApplicationId: application.id,
            guardianUserId: application.applicantUserId,
            studentId: application.studentCandidateRef,
            approvedByMembershipId: reviewer.membershipId,
            approvedAt: reviewedAt,
          },
        });
        await transaction.guardianRelationshipAuditEvent.create({
          data: {
            tenantId: application.tenantId,
            campusId: application.campusId,
            guardianRelationshipId: relationship.id,
            actorMembershipId: reviewer.membershipId,
            action: "ACTIVATED",
            relationshipVersion: relationship.version,
          },
        });
      }

      const updated = await transaction.bindingApplication.findFirst({
        where: {
          tenantId: application.tenantId,
          campusId: application.campusId,
          id: application.id,
        },
      });
      if (updated === null) throw new Error("Reviewed application disappeared inside transaction.");
      return { ok: true, data: applicationProjection(updated) };
    });
  }

  public async release(
    context: GuardianBindingContext,
    relationshipId: string,
    input: GuardianRelationshipReleaseInput,
  ): Promise<GuardianBindingResult<GuardianRelationshipProjection>> {
    const pairs = scopePairs(context);
    const guardianUserId = context.scopes[0]?.actorId;
    if (
      pairs.length === 0 ||
      guardianUserId === undefined ||
      context.scopes.some((scope) => scope.actorId !== guardianUserId)
    ) {
      return failure("NOT_FOUND_SCOPED", "Relationship was not found in the allowed scope.");
    }

    return this.prisma.$transaction(async (transaction) => {
      const relationship = await transaction.guardianRelationship.findFirst({
        where: { id: relationshipId, guardianUserId, OR: pairs },
      });
      if (relationship === null) {
        return failure("NOT_FOUND_SCOPED", "Relationship was not found in the allowed scope.");
      }
      if (relationship.version !== input.version) {
        return failure("VERSION_MISMATCH", "Relationship version is stale.");
      }
      if (relationship.status !== "ACTIVE") {
        return failure("CONFLICT_STATE", "Relationship is no longer active.");
      }

      const guardianMembership = await transaction.membershipCampus.findFirst({
        where: {
          tenantId: relationship.tenantId,
          campusId: relationship.campusId,
          membership: { is: { userId: guardianUserId, status: "ACTIVE" } },
        },
        select: { membershipId: true },
      });
      if (guardianMembership === null) {
        return failure("NOT_FOUND_SCOPED", "Relationship was not found in the allowed scope.");
      }

      const releasedAt = new Date();
      const update = await transaction.guardianRelationship.updateMany({
        where: {
          tenantId: relationship.tenantId,
          campusId: relationship.campusId,
          id: relationship.id,
          guardianUserId,
          status: "ACTIVE",
          version: input.version,
        },
        data: {
          status: "RELEASED",
          version: { increment: 1 },
          releasedAt,
        },
      });
      if (update.count !== 1) {
        const current = await transaction.guardianRelationship.findFirst({
          where: {
            tenantId: relationship.tenantId,
            campusId: relationship.campusId,
            id: relationship.id,
            guardianUserId,
          },
        });
        return current !== null && current.version !== input.version
          ? failure("VERSION_MISMATCH", "Relationship version is stale.")
          : failure("CONFLICT_STATE", "Relationship is no longer active.");
      }

      const released = await transaction.guardianRelationship.findFirst({
        where: {
          tenantId: relationship.tenantId,
          campusId: relationship.campusId,
          id: relationship.id,
          guardianUserId,
        },
      });
      if (released === null) {
        throw new Error("Released guardian relationship disappeared inside transaction.");
      }
      await transaction.guardianRelationshipAuditEvent.create({
        data: {
          tenantId: relationship.tenantId,
          campusId: relationship.campusId,
          guardianRelationshipId: relationship.id,
          actorMembershipId: guardianMembership.membershipId,
          action: "RELEASED",
          relationshipVersion: released.version,
        },
      });
      return { ok: true, data: relationshipProjection(released) };
    });
  }
}
