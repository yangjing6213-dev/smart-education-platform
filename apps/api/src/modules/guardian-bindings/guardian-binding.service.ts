import { randomUUID } from "node:crypto";
import type { ScopeContext } from "@student-care/tenant";
import type {
  GuardianBindingApplicationInput,
  GuardianBindingApplicationProjection,
  GuardianBindingApplicationReviewInput,
  GuardianRelationshipProjection,
  GuardianRelationshipReleaseInput,
  GuardianBindingStudentOption,
} from "@student-care/contracts";

export const GUARDIAN_BINDING_SERVICE = Symbol("GUARDIAN_BINDING_SERVICE");

export interface GuardianBindingContext {
  readonly scopes: readonly ScopeContext[];
  readonly applicantDisplayName?: string;
}

export type GuardianBindingReviewQueueProjection = Pick<
  GuardianBindingApplicationProjection,
  "id" | "relationship" | "status" | "version" | "submitted_at" | "reviewed_at"
> & {
  readonly applicant_label: string;
  readonly student_label: string;
};

export type GuardianBindingErrorCode = "NOT_FOUND_SCOPED" | "CONFLICT_STATE" | "VERSION_MISMATCH";

export type GuardianBindingResult<T> =
  | { readonly ok: true; readonly data: T }
  | {
      readonly ok: false;
      readonly error: { readonly code: GuardianBindingErrorCode; readonly message: string };
    };

type MaybePromise<T> = T | Promise<T>;

export interface GuardianBindingOperations {
  listStudentOptions?(
    context: GuardianBindingContext,
  ): MaybePromise<readonly GuardianBindingStudentOption[]>;
  submit(
    context: GuardianBindingContext,
    input: GuardianBindingApplicationInput,
  ): MaybePromise<GuardianBindingResult<GuardianBindingApplicationProjection>>;
  listApplications(
    context: GuardianBindingContext,
  ): MaybePromise<readonly GuardianBindingApplicationProjection[]>;
  listRelationships(
    context: GuardianBindingContext,
  ): MaybePromise<readonly GuardianRelationshipProjection[]>;
  listPending(
    context: GuardianBindingContext,
  ): MaybePromise<readonly GuardianBindingApplicationProjection[]>;
  listPendingForReview?(
    context: GuardianBindingContext,
  ): MaybePromise<readonly GuardianBindingReviewQueueProjection[]>;
  review(
    context: GuardianBindingContext,
    applicationId: string,
    input: GuardianBindingApplicationReviewInput,
  ): MaybePromise<GuardianBindingResult<GuardianBindingApplicationProjection>>;
  release(
    context: GuardianBindingContext,
    relationshipId: string,
    input: GuardianRelationshipReleaseInput,
  ): MaybePromise<GuardianBindingResult<GuardianRelationshipProjection>>;
}

interface ScopedApplication {
  readonly applicantActorId: string;
  readonly applicantLabel: string;
  readonly studentLabel: string;
  readonly scope: { readonly tenantId: string; readonly campusId: string };
  readonly projection: GuardianBindingApplicationProjection;
}

interface ScopedRelationship {
  readonly guardianActorId: string;
  readonly scope: { readonly tenantId: string; readonly campusId: string };
  readonly projection: GuardianRelationshipProjection;
}

const SYNTHETIC_CANDIDATES = [
  {
    studentCandidateRef: "00000000-0000-4000-8000-0000000000c8",
    label: "示例学生甲",
    tenantId: "00000000-0000-4000-8000-000000000064",
    campusId: "00000000-0000-4000-8000-000000000065",
  },
  {
    studentCandidateRef: "00000000-0000-4000-8000-0000000000c9",
    label: "示例学生乙",
    tenantId: "00000000-0000-4000-8000-000000000064",
    campusId: "00000000-0000-4000-8000-000000000065",
  },
  {
    studentCandidateRef: "00000000-0000-4000-8000-000000000030",
    label: "示例学生丙",
    tenantId: "00000000-0000-4000-8000-00000000006e",
    campusId: "00000000-0000-4000-8000-00000000006f",
  },
] as const;

function failure<T>(code: GuardianBindingErrorCode, message: string): GuardianBindingResult<T> {
  return { ok: false, error: { code, message } };
}

function hasScope(
  context: GuardianBindingContext,
  scope: { readonly tenantId: string; readonly campusId: string },
): boolean {
  return context.scopes.some(
    (candidate) => candidate.tenantId === scope.tenantId && candidate.campusId === scope.campusId,
  );
}

function inScope(context: GuardianBindingContext, item: ScopedApplication | ScopedRelationship) {
  return hasScope(context, item.scope);
}

function boundedLabel(value: string | undefined, fallback: string): string {
  const normalized = value?.replace(/\s+/gu, " ").trim();
  return normalized ? normalized.slice(0, 80) : fallback;
}

export class GuardianBindingService implements GuardianBindingOperations {
  private readonly applications = new Map<string, ScopedApplication>();
  private readonly relationships = new Map<string, ScopedRelationship>();

  public constructor(private readonly now: () => Date = () => new Date()) {}

  public listStudentOptions(
    context: GuardianBindingContext,
  ): readonly GuardianBindingStudentOption[] {
    const actorId = context.scopes[0]?.actorId;
    if (actorId === undefined || context.scopes.some((scope) => scope.actorId !== actorId)) {
      return [];
    }

    return SYNTHETIC_CANDIDATES.filter((candidate) => hasScope(context, candidate)).map(
      (candidate) => ({
        id: candidate.studentCandidateRef,
        alias: candidate.studentCandidateRef,
        label: candidate.label,
      }),
    );
  }

  public submit(
    context: GuardianBindingContext,
    input: GuardianBindingApplicationInput,
  ): GuardianBindingResult<GuardianBindingApplicationProjection> {
    const candidate = SYNTHETIC_CANDIDATES.find(
      (item) => item.studentCandidateRef === input.student_candidate_ref,
    );
    if (candidate === undefined || !hasScope(context, candidate)) {
      return failure("NOT_FOUND_SCOPED", "Student candidate was not found in the allowed scope.");
    }

    const applicantActorId = context.scopes[0]?.actorId;
    const duplicatePending = [...this.applications.values()].some(
      (item) =>
        item.applicantActorId === applicantActorId &&
        item.projection.student_candidate_ref === input.student_candidate_ref &&
        item.projection.status === "PENDING",
    );
    const hasActiveRelationship = [...this.relationships.values()].some(
      (item) =>
        item.guardianActorId === applicantActorId &&
        item.projection.student_id === input.student_candidate_ref &&
        inScope(context, item) &&
        item.projection.status === "ACTIVE",
    );
    if (duplicatePending || hasActiveRelationship) {
      return failure("CONFLICT_STATE", "An application for this student already exists.");
    }

    const submittedAt = this.now().toISOString();
    const projection: GuardianBindingApplicationProjection = {
      id: randomUUID(),
      student_candidate_ref: input.student_candidate_ref,
      relationship: input.relationship,
      status: "PENDING",
      version: 1,
      submitted_at: submittedAt,
      reviewed_at: null,
    };
    this.applications.set(projection.id, {
      applicantActorId: context.scopes[0]!.actorId,
      applicantLabel: boundedLabel(context.applicantDisplayName, "申请人信息待补充"),
      studentLabel: candidate.label,
      scope: { tenantId: candidate.tenantId, campusId: candidate.campusId },
      projection,
    });
    return { ok: true, data: { ...projection } };
  }

  public listApplications(
    context: GuardianBindingContext,
  ): readonly GuardianBindingApplicationProjection[] {
    const actorId = context.scopes[0]?.actorId;
    return [...this.applications.values()]
      .filter((item) => item.applicantActorId === actorId && inScope(context, item))
      .map((item) => ({ ...item.projection }));
  }

  public listRelationships(
    context: GuardianBindingContext,
  ): readonly GuardianRelationshipProjection[] {
    const actorId = context.scopes[0]?.actorId;
    return [...this.relationships.values()]
      .filter((item) => item.guardianActorId === actorId && inScope(context, item))
      .map((item) => ({ ...item.projection }));
  }

  public listPending(
    context: GuardianBindingContext,
  ): readonly GuardianBindingApplicationProjection[] {
    return [...this.applications.values()]
      .filter((item) => item.projection.status === "PENDING" && inScope(context, item))
      .map((item) => ({ ...item.projection }));
  }

  public listPendingForReview(
    context: GuardianBindingContext,
  ): readonly GuardianBindingReviewQueueProjection[] {
    return [...this.applications.values()]
      .filter((item) => item.projection.status === "PENDING" && inScope(context, item))
      .map((item) => ({
        id: item.projection.id,
        relationship: item.projection.relationship,
        status: item.projection.status,
        version: item.projection.version,
        submitted_at: item.projection.submitted_at,
        reviewed_at: item.projection.reviewed_at,
        applicant_label: item.applicantLabel,
        student_label: item.studentLabel,
      }));
  }

  public review(
    context: GuardianBindingContext,
    applicationId: string,
    input: GuardianBindingApplicationReviewInput,
  ): GuardianBindingResult<GuardianBindingApplicationProjection> {
    const item = this.applications.get(applicationId);
    if (item === undefined || !inScope(context, item)) {
      return failure("NOT_FOUND_SCOPED", "Application was not found in the allowed scope.");
    }
    if (item.projection.version !== input.version) {
      return failure("VERSION_MISMATCH", "Application version is stale.");
    }
    if (item.projection.status !== "PENDING") {
      return failure("CONFLICT_STATE", "Application is no longer pending review.");
    }

    const reviewedAt = this.now().toISOString();
    const projection: GuardianBindingApplicationProjection = {
      ...item.projection,
      status: input.action === "approve" ? "APPROVED" : "REJECTED",
      version: item.projection.version + 1,
      reviewed_at: reviewedAt,
    };
    this.applications.set(applicationId, { ...item, projection });
    if (input.action === "approve") {
      const relationship: GuardianRelationshipProjection = {
        id: randomUUID(),
        student_id: projection.student_candidate_ref,
        relationship: projection.relationship,
        status: "ACTIVE",
        source_application_id: projection.id,
        version: 1,
        approved_at: reviewedAt,
      };
      this.relationships.set(relationship.id, {
        guardianActorId: item.applicantActorId,
        scope: item.scope,
        projection: relationship,
      });
    }
    return { ok: true, data: { ...projection } };
  }

  public release(
    context: GuardianBindingContext,
    relationshipId: string,
    input: GuardianRelationshipReleaseInput,
  ): GuardianBindingResult<GuardianRelationshipProjection> {
    const actorId = context.scopes[0]?.actorId;
    const item = this.relationships.get(relationshipId);
    if (
      actorId === undefined ||
      context.scopes.some((scope) => scope.actorId !== actorId) ||
      item === undefined ||
      item.guardianActorId !== actorId ||
      !inScope(context, item)
    ) {
      return failure("NOT_FOUND_SCOPED", "Relationship was not found in the allowed scope.");
    }
    if (item.projection.version !== input.version) {
      return failure("VERSION_MISMATCH", "Relationship version is stale.");
    }
    if (item.projection.status !== "ACTIVE") {
      return failure("CONFLICT_STATE", "Relationship is no longer active.");
    }
    const projection: GuardianRelationshipProjection = {
      ...item.projection,
      status: "RELEASED",
      version: item.projection.version + 1,
    };
    this.relationships.set(relationshipId, { ...item, projection });
    return { ok: true, data: { ...projection } };
  }
}
