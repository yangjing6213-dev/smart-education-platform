import type {
  GuardianBindingApplicationInput,
  GuardianBindingApplicationProjection,
  GuardianBindingApplicationReviewInput,
  GuardianRelationshipProjection,
  GuardianRelationshipReleaseInput,
} from "@student-care/contracts";
import type {
  GuardianBindingContext,
  GuardianBindingOperations,
  GuardianBindingReviewQueueProjection,
  GuardianBindingResult,
} from "../modules/guardian-bindings/guardian-binding.service.js";
import { BindingLeaveService, LocalError } from "./binding-leave.service.js";
import { LocalRepository, type Binding } from "./repository.js";
import { memberForActor, studentForId, studentsForMember } from "./sessions.js";

function failure<T>(
  code: "NOT_FOUND_SCOPED" | "CONFLICT_STATE" | "VERSION_MISMATCH",
  message: string,
) {
  return { ok: false, error: { code, message } } as const satisfies GuardianBindingResult<T>;
}

function applicationProjection(row: Binding): GuardianBindingApplicationProjection | undefined {
  if (!row.submittedAt) return undefined;
  return {
    id: row.id,
    student_candidate_ref: row.studentId,
    relationship: row.relationship,
    status: row.status === "RELEASED" ? "APPROVED" : row.status,
    version: row.version,
    submitted_at: row.submittedAt,
    reviewed_at: row.reviewedAt ?? null,
  };
}

function relationshipProjection(row: Binding): GuardianRelationshipProjection | undefined {
  if (
    !row.relationshipId ||
    !row.reviewedAt ||
    (row.status !== "APPROVED" && row.status !== "RELEASED")
  )
    return undefined;
  return {
    id: row.relationshipId,
    student_id: row.studentId,
    relationship: row.relationship,
    status: row.status === "RELEASED" ? "RELEASED" : "ACTIVE",
    source_application_id: row.id,
    version: row.version - 1,
    approved_at: row.reviewedAt,
  };
}

export class LocalSyntheticGuardianBindingAdapter implements GuardianBindingOperations {
  public constructor(
    private readonly bindings: BindingLeaveService,
    private readonly repository: LocalRepository,
  ) {}

  private member(context: GuardianBindingContext) {
    const actorId = context.scopes[0]?.actorId;
    if (!actorId || context.scopes.some((scope) => scope.actorId !== actorId)) return undefined;
    const member = memberForActor(actorId);
    if (
      !member ||
      !context.scopes.some(
        (scope) => scope.tenantId === member.tenantId && scope.campusId === member.campusId,
      )
    )
      return undefined;
    return member;
  }

  private inScope(context: GuardianBindingContext, row: Binding) {
    const member = this.member(context);
    return Boolean(
      member &&
      row.tenantId === member.tenantId &&
      row.campusId === member.campusId &&
      member.classIds.includes(row.classId) &&
      context.scopes.some(
        (scope) =>
          scope.actorId === member.actorId &&
          scope.tenantId === row.tenantId &&
          scope.campusId === row.campusId,
      ),
    );
  }

  private rows(context: GuardianBindingContext, actorOnly: boolean): Binding[] {
    const member = this.member(context);
    if (!member) return [];
    return this.repository
      .list()
      .filter(
        (row): row is Binding =>
          row.kind === "binding" &&
          this.inScope(context, row) &&
          (!actorOnly || row.guardianId === member.actorId),
      );
  }

  public submit(
    context: GuardianBindingContext,
    input: GuardianBindingApplicationInput,
  ): GuardianBindingResult<GuardianBindingApplicationProjection> {
    const member = this.member(context);
    const student = member
      ? studentsForMember(member).find((candidate) => candidate.id === input.student_candidate_ref)
      : undefined;
    if (!member || !member.actions.includes("binding:apply") || !student) {
      return failure("NOT_FOUND_SCOPED", "Student candidate was not found in the allowed scope.");
    }

    try {
      const created = this.bindings.applyBinding(member, {
        student: student.alias,
        relationship: input.relationship,
      });
      const row = this.repository.get(created.id);
      const projection = row?.kind === "binding" ? applicationProjection(row) : undefined;
      return projection
        ? { ok: true, data: projection }
        : failure("NOT_FOUND_SCOPED", "Application was not found in the allowed scope.");
    } catch (error) {
      return this.failureFromLocalError(error);
    }
  }

  public listApplications(
    context: GuardianBindingContext,
  ): readonly GuardianBindingApplicationProjection[] {
    const member = this.member(context);
    if (!member?.actions.includes("binding:apply")) return [];
    return this.rows(context, true)
      .map(applicationProjection)
      .filter((row): row is GuardianBindingApplicationProjection => row !== undefined);
  }

  public listRelationships(
    context: GuardianBindingContext,
  ): readonly GuardianRelationshipProjection[] {
    const member = this.member(context);
    if (!member?.actions.includes("binding:apply")) return [];
    return this.rows(context, true)
      .map(relationshipProjection)
      .filter((row): row is GuardianRelationshipProjection => row !== undefined);
  }

  public listPending(
    context: GuardianBindingContext,
  ): readonly GuardianBindingApplicationProjection[] {
    const member = this.member(context);
    if (!member?.actions.includes("binding:review")) return [];
    const visibleIds = new Set(this.bindings.bindings(member).map((row) => row.id));
    return this.rows(context, false)
      .filter((row) => row.status === "PENDING" && visibleIds.has(row.id))
      .map(applicationProjection)
      .filter((row): row is GuardianBindingApplicationProjection => row !== undefined);
  }

  public listPendingForReview(
    context: GuardianBindingContext,
  ): readonly GuardianBindingReviewQueueProjection[] {
    const reviewer = this.member(context);
    if (!reviewer?.actions.includes("binding:review")) return [];
    const visibleIds = new Set(this.bindings.bindings(reviewer).map((row) => row.id));
    return this.rows(context, false)
      .filter((row) => row.status === "PENDING" && visibleIds.has(row.id))
      .flatMap((row) => {
        const applicant = memberForActor(row.guardianId);
        const student = studentForId(row.studentId);
        const application = applicationProjection(row);
        if (!applicant || !student || !application) return [];
        return [
          {
            id: application.id,
            relationship: application.relationship,
            status: application.status,
            version: application.version,
            submitted_at: application.submitted_at,
            reviewed_at: application.reviewed_at,
            applicant_label: applicant.label.slice(0, 80),
            student_label: student.label.slice(0, 80),
          },
        ];
      });
  }

  public review(
    context: GuardianBindingContext,
    applicationId: string,
    input: GuardianBindingApplicationReviewInput,
  ): GuardianBindingResult<GuardianBindingApplicationProjection> {
    const member = this.member(context);
    if (!member?.actions.includes("binding:review")) {
      return failure("NOT_FOUND_SCOPED", "Application was not found in the allowed scope.");
    }
    const visibleIds = new Set(this.bindings.bindings(member).map((row) => row.id));
    const row = this.repository.get(applicationId);
    if (row?.kind !== "binding" || !visibleIds.has(row.id) || !this.inScope(context, row)) {
      return failure("NOT_FOUND_SCOPED", "Application was not found in the allowed scope.");
    }
    if (row.version !== input.version) {
      return failure("VERSION_MISMATCH", "Application version is stale.");
    }
    if (row.status !== "PENDING") {
      return failure("CONFLICT_STATE", "Application is no longer pending review.");
    }

    try {
      const reviewed = this.bindings.reviewBinding(member, applicationId, input);
      const updated = this.repository.get(reviewed.id);
      const projection = updated?.kind === "binding" ? applicationProjection(updated) : undefined;
      return projection
        ? { ok: true, data: projection }
        : failure("NOT_FOUND_SCOPED", "Application was not found in the allowed scope.");
    } catch (error) {
      return this.failureFromLocalError(error);
    }
  }

  public release(
    context: GuardianBindingContext,
    relationshipId: string,
    input: GuardianRelationshipReleaseInput,
  ): GuardianBindingResult<GuardianRelationshipProjection> {
    const member = this.member(context);
    if (!member?.actions.includes("binding:apply")) {
      return failure("NOT_FOUND_SCOPED", "Relationship was not found in the allowed scope.");
    }
    const row = this.rows(context, true).find(
      (candidate) => relationshipProjection(candidate)?.id === relationshipId,
    );
    const projection = row ? relationshipProjection(row) : undefined;
    if (!row || !projection) {
      return failure("NOT_FOUND_SCOPED", "Relationship was not found in the allowed scope.");
    }
    if (projection.version !== input.version) {
      return failure("VERSION_MISMATCH", "Relationship version is stale.");
    }
    if (projection.status !== "ACTIVE") {
      return failure("CONFLICT_STATE", "Relationship is no longer active.");
    }

    try {
      this.bindings.endBinding(member, row.id, { version: row.version }, "release");
      const updated = this.repository.get(row.id);
      const released = updated?.kind === "binding" ? relationshipProjection(updated) : undefined;
      return released
        ? { ok: true, data: released }
        : failure("NOT_FOUND_SCOPED", "Relationship was not found in the allowed scope.");
    } catch (error) {
      return this.failureFromLocalError(error);
    }
  }

  private failureFromLocalError<T>(error: unknown): GuardianBindingResult<T> {
    if (error instanceof LocalError) {
      if (error.statusCode === 409) {
        return failure("CONFLICT_STATE", "The binding request conflicts with its current state.");
      }
      if (error.statusCode === 403) {
        return failure("NOT_FOUND_SCOPED", "The requested binding record was not found in scope.");
      }
    }
    throw error;
  }
}
