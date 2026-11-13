import { isDeepStrictEqual } from "node:util";
import type { ScopeContext } from "@student-care/tenant";
import { Prisma, type PrismaClient } from "../../generated/prisma/client.js";
import { loadFreshMonthlySources } from "./monthly-source-freshness.js";

export type MonthlyFeedbackCapability =
  "feedback:read" | "feedback:create" | "feedback:submit" | "feedback:review" | "feedback:publish";
export interface MonthlyFeedbackContext {
  readonly scopes: readonly {
    readonly scope: ScopeContext;
    readonly capabilities: readonly MonthlyFeedbackCapability[];
  }[];
}
type FailureCode = "FORBIDDEN_SCOPE" | "VALIDATION_FAILED" | "NOT_FOUND_SCOPED" | "CONFLICT_STATE";
export type MonthlyFeedbackResult<T> =
  | { readonly ok: true; readonly data: T }
  | {
      readonly ok: false;
      readonly error: { readonly code: FailureCode; readonly message: string };
    };
type Database = Prisma.TransactionClient;
type Supplement = "KEEP_WATCHING" | "PROGRESSING" | "FOLLOW_UP";
type Supplements = {
  learningParticipation: Supplement;
  dailyHabits: Supplement;
  activityParticipation: Supplement;
  familySchoolCollaboration: Supplement;
};
type Staff = {
  tenantId: string;
  campusId: string;
  actorId: string;
  membershipId: string;
  classRefs: string[];
  capabilities: readonly MonthlyFeedbackCapability[];
};
const include = { createdBy: { select: { membership: { select: { userId: true } } } } } as const;
type Report = Prisma.MonthlyFeedbackReportGetPayload<{ include: typeof include }>;
type SourceKind = "GROWTH_RECORD" | "ATTENDANCE_OVERVIEW" | "STAFF_DAILY";
type Source = {
  kind: SourceKind;
  id: string;
  version: number;
  date: string;
  publicationVersion?: number;
};
type Action = "edit" | "submit" | "review" | "publish";
class MonthlyFailure extends Error {
  public constructor(public readonly code: FailureCode) {
    super(code);
  }
}
const fail = (code: FailureCode): never => {
  throw new MonthlyFailure(code);
};
const conflict = () => new MonthlyFailure("CONFLICT_STATE");
const failed = (code: FailureCode): Extract<MonthlyFeedbackResult<never>, { ok: false }> => ({
  ok: false,
  error: { code, message: "The monthly class report could not perform this action." },
});
function mapFailure(error: unknown): MonthlyFeedbackResult<never> {
  if (error instanceof MonthlyFailure) return failed(error.code);
  if (typeof error === "object" && error !== null && "code" in error) {
    if (["P2002", "P2025", "P2034"].includes(String(error.code))) return failed("CONFLICT_STATE");
    if (error.code === "P2003") return failed("NOT_FOUND_SCOPED");
  }
  throw error;
}
function exact(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.keys(value).length !== keys.length ||
    Object.keys(value).some((key) => !keys.includes(key))
  )
    return fail("VALIDATION_FAILED");
  return value as Record<string, unknown>;
}
function supplements(value: unknown): Supplements {
  const input = exact(value, [
    "learningParticipation",
    "dailyHabits",
    "activityParticipation",
    "familySchoolCollaboration",
  ]);
  if (
    Object.values(input).some(
      (v) => typeof v !== "string" || !["KEEP_WATCHING", "PROGRESSING", "FOLLOW_UP"].includes(v),
    )
  )
    return fail("VALIDATION_FAILED");
  return input as Supplements;
}
function versionOf(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1)
    return fail("VALIDATION_FAILED");
  return value;
}
function uuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
}
async function staffAccess(
  db: Database,
  context: MonthlyFeedbackContext,
  capability: MonthlyFeedbackCapability,
): Promise<Staff[]> {
  if (new Set(context.scopes.map((s) => s.scope.actorId)).size !== 1)
    return fail("FORBIDDEN_SCOPE");
  const staff: Staff[] = [];
  for (const { scope, capabilities } of context.scopes) {
    const { tenantId, campusId, actorId } = scope;
    if (!campusId || !capabilities.includes(capability)) continue;
    const memberships = await db.membershipCampus.findMany({
      where: {
        tenantId,
        campusId,
        campus: { status: "ACTIVE" },
        membership: {
          userId: actorId,
          status: "ACTIVE",
          user: { status: "ACTIVE" },
          tenant: { status: "ACTIVE" },
        },
      },
      select: { membershipId: true, classAssignments: { select: { classRef: true } } },
    });
    if (memberships.length !== 1) continue;
    const member = memberships[0]!;
    if (!member.classAssignments.length) continue;
    if (staff.some((s) => s.tenantId === tenantId && s.campusId === campusId))
      return fail("FORBIDDEN_SCOPE");
    staff.push({
      tenantId,
      campusId,
      actorId,
      membershipId: member.membershipId,
      classRefs: member.classAssignments.map((c) => c.classRef),
      capabilities,
    });
  }
  if (!staff.length) return fail("FORBIDDEN_SCOPE");
  return staff;
}
const scoped = (s: Staff) => ({
  tenantId: s.tenantId,
  campusId: s.campusId,
  classRef: { in: s.classRefs },
});
const key = (r: Report) => ({ tenantId: r.tenantId, campusId: r.campusId, id: r.id });

async function sourceSnapshot(
  db: Database,
  record: { tenantId: string; campusId: string; classRef: string; month: string },
): Promise<Source[]> {
  const { care, attendance, daily } = await loadFreshMonthlySources(db, record);
  const sources: Source[] = [
    ...care.map((r) => ({
      kind: "GROWTH_RECORD" as const,
      id: r.id,
      version: r.version,
      date: r.serviceDate.toISOString().slice(0, 10),
      publicationVersion: r.publicationVersion,
    })),
    ...attendance.map((r) => ({
      kind: "ATTENDANCE_OVERVIEW" as const,
      id: r.id,
      version: r.version,
      date: r.serviceDate.toISOString().slice(0, 10),
    })),
    ...daily.map((r) => ({
      kind: "STAFF_DAILY" as const,
      id: r.id,
      version: r.version,
      date: r.date.toISOString().slice(0, 10),
    })),
  ];
  return sources.sort((a, b) =>
    `${a.kind}:${a.date}:${a.id}`.localeCompare(`${b.kind}:${b.date}:${b.id}`),
  );
}
function actions(record: Report, actor: Staff): string[] {
  const own = record.createdByMembershipId === actor.membershipId;
  const independent = record.createdBy.membership.userId !== actor.actorId;
  const allowed: string[] = [];
  if (
    own &&
    ["DRAFT", "RETURNED", "REVIEW_REQUIRED"].includes(record.status) &&
    actor.capabilities.includes("feedback:create")
  )
    allowed.push("edit");
  if (own && record.status === "DRAFT" && actor.capabilities.includes("feedback:submit"))
    allowed.push("submit");
  if (
    independent &&
    record.status === "SUBMITTED" &&
    actor.capabilities.includes("feedback:review")
  )
    allowed.push("confirm", "return");
  if (independent && record.status === "CONFIRMED") {
    if (actor.capabilities.includes("feedback:review")) allowed.push("return");
    if (actor.capabilities.includes("feedback:publish")) allowed.push("publish");
  }
  return allowed;
}
function projection(record: Report, actor: Staff) {
  const sourceCounts = { GROWTH_RECORD: 0, ATTENDANCE_OVERVIEW: 0, STAFF_DAILY: 0 };
  for (const source of record.sources as Source[]) sourceCounts[source.kind] += 1;
  return {
    id: record.id,
    version: record.version,
    sourceVersion: record.sourceVersion,
    status: record.status,
    month: record.month,
    classRef: record.classRef,
    audience: "STAFF_INTERNAL" as const,
    supplements: {
      learningParticipation: record.learningParticipation,
      dailyHabits: record.dailyHabits,
      activityParticipation: record.activityParticipation,
      familySchoolCollaboration: record.familySchoolCollaboration,
    },
    sourceCounts,
    actions: actions(record, actor),
  };
}
async function event(db: Database, record: Report, actor: Staff, action: string): Promise<void> {
  await db.monthlyFeedbackEvent.create({
    data: {
      tenantId: record.tenantId,
      campusId: record.campusId,
      reportId: record.id,
      version: record.version,
      sourceVersion: record.sourceVersion,
      status: record.status,
      action,
      actorMembershipId: actor.membershipId,
    },
  });
}
async function save(
  db: Database,
  record: Report,
  actor: Staff,
  action: string,
  changes: Prisma.MonthlyFeedbackReportUncheckedUpdateManyInput,
): Promise<Report> {
  const changed = await db.monthlyFeedbackReport.updateMany({
    where: { ...key(record), version: record.version },
    data: { ...changes, version: { increment: 1 }, updatedByMembershipId: actor.membershipId },
  });
  if (changed.count !== 1) throw conflict();
  const saved = await db.monthlyFeedbackReport.findFirstOrThrow({ where: key(record), include });
  await event(db, saved, actor, action);
  return saved;
}
async function refresh(db: Database, record: Report, actor: Staff): Promise<Report> {
  const sources = await sourceSnapshot(db, record);
  // PostgreSQL JSONB reorders object keys, so string equality would falsely invalidate reports.
  if (isDeepStrictEqual(record.sources, sources)) return record;
  return save(db, record, actor, "SOURCES_CHANGED", {
    sources,
    sourceVersion: { increment: 1 },
    reviewedByMembershipId: null,
    status: ["SUBMITTED", "CONFIRMED", "PUBLISHED"].includes(record.status)
      ? "REVIEW_REQUIRED"
      : record.status,
  });
}

/** Internal class summaries only. Parent/student summaries require their own scoped projection. */
export class PrismaMonthlyFeedbackService {
  public constructor(private readonly prisma: PrismaClient) {}

  private async transaction<T>(
    operation: (db: Database) => Promise<MonthlyFeedbackResult<T>>,
  ): Promise<MonthlyFeedbackResult<T>> {
    try {
      return await this.prisma.$transaction(operation, { isolationLevel: "Serializable" });
    } catch (error) {
      return mapFailure(error);
    }
  }

  public list(context: MonthlyFeedbackContext) {
    return this.transaction(async (db) => {
      const staff = await staffAccess(db, context, "feedback:read");
      const records = await db.monthlyFeedbackReport.findMany({
        where: {
          OR: staff.map((s) => ({
            ...scoped(s),
            ...(s.capabilities.includes("feedback:review") ||
            s.capabilities.includes("feedback:publish")
              ? {}
              : { createdByMembershipId: s.membershipId }),
          })),
        },
        include,
        orderBy: [{ month: "desc" }, { id: "asc" }],
      });
      const views: ReturnType<typeof projection>[] = [];
      for (const record of records) {
        const actor = staff.find(
          (s) =>
            s.tenantId === record.tenantId &&
            s.campusId === record.campusId &&
            s.classRefs.includes(record.classRef),
        )!;
        views.push(projection(await refresh(db, record, actor), actor));
      }
      return {
        ok: true as const,
        data: {
          records: views,
          canCreate:
            staff.length === 1 &&
            staff[0]!.classRefs.length === 1 &&
            staff[0]!.capabilities.includes("feedback:create"),
        },
      };
    });
  }

  public create(context: MonthlyFeedbackContext, body: unknown) {
    return this.transaction(async (db) => {
      const input = exact(body, ["month", "supplements"]);
      if (
        typeof input.month !== "string" ||
        !/^(?:19|20|21)\d{2}-(?:0[1-9]|1[0-2])$/u.test(input.month)
      )
        return fail("VALIDATION_FAILED");
      const values = supplements(input.supplements);
      const staff = await staffAccess(db, context, "feedback:create");
      if (staff.length !== 1 || staff[0]!.classRefs.length !== 1) return fail("FORBIDDEN_SCOPE");
      const actor = staff[0]!;
      const scope = {
        tenantId: actor.tenantId,
        campusId: actor.campusId,
        classRef: actor.classRefs[0]!,
        month: input.month,
      };
      const sources = await sourceSnapshot(db, scope);
      const record = await db.monthlyFeedbackReport.create({
        data: {
          ...scope,
          ...values,
          sources,
          createdByMembershipId: actor.membershipId,
          updatedByMembershipId: actor.membershipId,
        },
        include,
      });
      await event(db, record, actor, "CREATE");
      return { ok: true as const, data: projection(record, actor) };
    });
  }

  public edit(context: MonthlyFeedbackContext, id: string, body: unknown) {
    return this.change(context, id, body, "edit");
  }
  public submit(context: MonthlyFeedbackContext, id: string, body: unknown) {
    return this.change(context, id, body, "submit");
  }
  public review(context: MonthlyFeedbackContext, id: string, body: unknown) {
    return this.change(context, id, body, "review");
  }
  public publish(context: MonthlyFeedbackContext, id: string, body: unknown) {
    return this.change(context, id, body, "publish");
  }

  private change(context: MonthlyFeedbackContext, id: string, body: unknown, action: Action) {
    return this.transaction(async (db) => {
      if (!uuid(id)) return fail("VALIDATION_FAILED");
      const input = exact(
        body,
        action === "edit"
          ? ["version", "supplements"]
          : action === "review"
            ? ["version", "action"]
            : ["version"],
      );
      const version = versionOf(input.version);
      const values = action === "edit" ? supplements(input.supplements) : undefined;
      if (action === "review" && input.action !== "CONFIRM" && input.action !== "RETURN")
        return fail("VALIDATION_FAILED");
      const capability: MonthlyFeedbackCapability =
        action === "edit"
          ? "feedback:create"
          : action === "submit"
            ? "feedback:submit"
            : action === "review"
              ? "feedback:review"
              : "feedback:publish";
      const staff = await staffAccess(db, context, capability);
      const reviewer = action === "review" || action === "publish";
      const record = await db.monthlyFeedbackReport.findFirst({
        where: {
          id,
          OR: staff.map((s) => ({
            ...scoped(s),
            ...(reviewer
              ? { createdBy: { membership: { userId: { not: s.actorId } } } }
              : { createdByMembershipId: s.membershipId }),
          })),
        },
        include,
      });
      if (!record) return fail("NOT_FOUND_SCOPED");
      const actor = staff.find(
        (s) =>
          s.tenantId === record.tenantId &&
          s.campusId === record.campusId &&
          s.classRefs.includes(record.classRef),
      )!;
      if (version !== record.version) throw conflict();
      const fresh = await refresh(db, record, actor);
      // Return, rather than throw: source invalidation and its audit event must commit even on 409.
      if (fresh.version !== record.version) return failed("CONFLICT_STATE");
      const permitted =
        action === "edit"
          ? ["DRAFT", "RETURNED", "REVIEW_REQUIRED"].includes(record.status)
          : action === "submit"
            ? record.status === "DRAFT"
            : action === "publish"
              ? record.status === "CONFIRMED"
              : input.action === "CONFIRM"
                ? record.status === "SUBMITTED"
                : ["SUBMITTED", "CONFIRMED"].includes(record.status);
      if (!permitted) throw conflict();
      const status =
        action === "edit"
          ? "DRAFT"
          : action === "submit"
            ? "SUBMITTED"
            : action === "publish"
              ? "PUBLISHED"
              : input.action === "CONFIRM"
                ? "CONFIRMED"
                : "RETURNED";
      const updated = await save(
        db,
        record,
        actor,
        action === "review" ? String(input.action) : action.toUpperCase(),
        {
          ...(values ?? {}),
          status,
          reviewedByMembershipId:
            status === "CONFIRMED"
              ? actor.membershipId
              : status === "PUBLISHED"
                ? record.reviewedByMembershipId
                : null,
        },
      );
      return { ok: true as const, data: projection(updated, actor) };
    });
  }
}
