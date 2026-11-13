import { memberForActor, type LocalMember } from "./sessions.js";
import { LocalError } from "./binding-leave.service.js";
import { StaffDailyService } from "./staff-daily.service.js";
import type {
  StaffDailyCapability,
  StaffDailyContext,
  StaffDailyOperations,
  StaffDailyResult,
} from "../nest/api-tokens.js";

type DailyRow = ReturnType<StaffDailyService["list"]>[number];
type SourceKind = "TASK" | "ATTENDANCE" | "CARE_RECORD" | "PICKUP" | "PICKUP_EXCEPTION";

const sourceKinds: readonly SourceKind[] = [
  "TASK",
  "ATTENDANCE",
  "CARE_RECORD",
  "PICKUP",
  "PICKUP_EXCEPTION",
];

function failure<T>(error: unknown): StaffDailyResult<T> {
  if (!(error instanceof LocalError)) throw error;
  const code =
    error.statusCode === 409
      ? "CONFLICT_STATE"
      : error.statusCode === 400
        ? "VALIDATION_FAILED"
        : "NOT_FOUND_SCOPED";
  return { ok: false, error: { code, message: error.message } };
}

function counts(row: DailyRow): Readonly<Record<SourceKind, number>> {
  const result: Record<SourceKind, number> = {
    TASK: 0,
    ATTENDANCE: 0,
    CARE_RECORD: 0,
    PICKUP: 0,
    PICKUP_EXCEPTION: 0,
  };
  for (const reference of row.sourceRefs) {
    if (sourceKinds.includes(reference.kind as SourceKind))
      result[reference.kind as SourceKind] += 1;
  }
  return result;
}

function actions(row: DailyRow, member: LocalMember): readonly string[] {
  if (row.createdBy !== member.actorId || !member.actions.includes("daily:create")) return [];
  if (row.status === "DRAFT")
    return member.actions.includes("daily:submit") ? ["edit", "submit"] : ["edit"];
  if (row.status === "RETURNED" && member.actions.includes("daily:submit")) return ["resubmit"];
  return [];
}

function projection(row: DailyRow, member: LocalMember) {
  const summary = row.learningSummary;
  return {
    id: row.id,
    version: row.version,
    status: row.status,
    date: row.date,
    values: row.values,
    sourceCounts: counts(row),
    learningSummary:
      summary &&
      summary.completedLearnerBand === "2_PLUS" &&
      typeof summary.usedGuidance === "boolean" &&
      typeof summary.needsTeacherFollowUp === "boolean"
        ? {
            completedLearnerBand: "2_PLUS" as const,
            usedGuidance: summary.usedGuidance,
            needsTeacherFollowUp: summary.needsTeacherFollowUp,
          }
        : null,
    actions: actions(row, member),
  };
}

function reviewProjection(row: DailyRow, member: LocalMember) {
  return {
    ...projection(row, member),
    authorLabel: row.authorLabel,
    actions:
      row.createdBy === member.actorId
        ? []
        : row.status === "SUBMITTED"
          ? ["confirm", "return"]
          : row.status === "CONFIRMED"
            ? ["return", "withdraw"]
            : [],
  };
}

export class LocalSyntheticNestStaffDailyAdapter implements StaffDailyOperations {
  public constructor(private readonly service: StaffDailyService) {}

  public reviewList(
    context: StaffDailyContext,
  ): StaffDailyResult<{ readonly records: readonly unknown[] }> {
    const member = this.member(context, "daily:review");
    if (!member)
      return {
        ok: false,
        error: { code: "FORBIDDEN_SCOPE", message: "Scope access is not permitted." },
      };
    return this.execute(member, "daily.review.read", "", () => ({
      records: this.service
        .list({ ...member, actions: [...member.actions, "daily:read"] })
        .filter((row) => row.createdBy !== member.actorId && row.status !== "DRAFT")
        .map((row) => reviewProjection(row, member)),
    }));
  }

  public auditEvents(
    context: StaffDailyContext,
    reportId: string,
  ): StaffDailyResult<{
    readonly events: readonly import("@student-care/contracts").StaffDailyAuditEvent[];
  }> {
    const member = this.member(context, "daily:review");
    if (!member)
      return {
        ok: false,
        error: { code: "FORBIDDEN_SCOPE", message: "Scope access is not permitted." },
      };
    return this.execute(member, "daily.audit.read", reportId, () => ({
      events: this.service.auditEvents(member, reportId),
    }));
  }

  public review(
    context: StaffDailyContext,
    reportId: string,
    body: unknown,
  ): StaffDailyResult<unknown> {
    return this.reviewAction(context, reportId, body, "review");
  }

  public withdraw(
    context: StaffDailyContext,
    reportId: string,
    body: unknown,
  ): StaffDailyResult<unknown> {
    return this.reviewAction(context, reportId, body, "withdraw");
  }

  private reviewAction(
    context: StaffDailyContext,
    reportId: string,
    body: unknown,
    action: "review" | "withdraw",
  ): StaffDailyResult<unknown> {
    const member = this.member(context, "daily:review");
    if (!member)
      return {
        ok: false,
        error: { code: "FORBIDDEN_SCOPE", message: "Scope access is not permitted." },
      };
    return this.execute(member, `daily.${action}`, reportId, () =>
      reviewProjection(this.service[action](member, reportId, body), member),
    );
  }

  private member(
    context: StaffDailyContext,
    required: StaffDailyCapability,
  ): LocalMember | undefined {
    const actorIds = new Set(context.scopes.map(({ scope }) => scope.actorId));
    if (actorIds.size !== 1) return undefined;
    const actorId = [...actorIds][0];
    if (actorId === undefined) return undefined;
    const local = memberForActor(actorId);
    if (!local) return undefined;
    const matchingScope = context.scopes.find(
      ({ scope, capabilities }) =>
        scope.actorId === actorId &&
        scope.tenantId === local.tenantId &&
        scope.campusId === local.campusId &&
        capabilities.includes(required),
    );
    if (!matchingScope) return undefined;
    return {
      ...local,
      actions: local.actions.filter((action) =>
        matchingScope.capabilities.includes(action as StaffDailyCapability),
      ),
    };
  }

  private execute<T>(
    member: LocalMember,
    action: string,
    reportId: string,
    operation: () => T,
  ): StaffDailyResult<T> {
    try {
      return { ok: true, data: operation() };
    } catch (error) {
      if (error instanceof LocalError) this.service.denied(member, action, reportId);
      return failure<T>(error);
    }
  }

  public list(
    context: StaffDailyContext,
  ): StaffDailyResult<{ readonly records: readonly unknown[]; readonly canCreate: boolean }> {
    const member = this.member(context, "daily:read");
    if (!member)
      return {
        ok: false,
        error: { code: "FORBIDDEN_SCOPE", message: "Scope access is not permitted." },
      };
    return this.execute(member, "daily.read", "", () => ({
      records: this.service
        .list(member)
        .filter((row) => row.createdBy === member.actorId)
        .map((row) => projection(row, member)),
      canCreate: member.actions.includes("daily:create"),
    }));
  }

  public create(context: StaffDailyContext, body: unknown): StaffDailyResult<unknown> {
    const member = this.member(context, "daily:create");
    if (!member)
      return {
        ok: false,
        error: { code: "FORBIDDEN_SCOPE", message: "Scope access is not permitted." },
      };
    return this.execute(member, "daily.create", "", () => {
      const row = this.service.create(member, body);
      return projection(row, member);
    });
  }

  public edit(
    context: StaffDailyContext,
    reportId: string,
    body: unknown,
  ): StaffDailyResult<unknown> {
    const member = this.member(context, "daily:create");
    if (!member)
      return {
        ok: false,
        error: { code: "FORBIDDEN_SCOPE", message: "Scope access is not permitted." },
      };
    return this.execute(member, "daily.edit", reportId, () =>
      projection(this.service.edit(member, reportId, body), member),
    );
  }

  public submit(
    context: StaffDailyContext,
    reportId: string,
    body: unknown,
  ): StaffDailyResult<unknown> {
    const member = this.member(context, "daily:submit");
    if (!member)
      return {
        ok: false,
        error: { code: "FORBIDDEN_SCOPE", message: "Scope access is not permitted." },
      };
    return this.execute(member, "daily.submit", reportId, () =>
      projection(this.service.submit(member, reportId, body), member),
    );
  }

  public resubmit(
    context: StaffDailyContext,
    reportId: string,
    body: unknown,
  ): StaffDailyResult<unknown> {
    const member = this.member(context, "daily:submit");
    if (!member)
      return {
        ok: false,
        error: { code: "FORBIDDEN_SCOPE", message: "Scope access is not permitted." },
      };
    return this.execute(member, "daily.resubmit", reportId, () =>
      projection(this.service.resubmit(member, reportId, body), member),
    );
  }
}
