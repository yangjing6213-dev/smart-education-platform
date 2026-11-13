import { isDeepStrictEqual } from "node:util";
import type { ScopeContext } from "@student-care/tenant";
import type {
  ChildMonthlyAction,
  ChildMonthlyParentSummary,
  ChildMonthlyStaffReport,
} from "@student-care/contracts";
import { Prisma, type PrismaClient } from "../../generated/prisma/client.js";
import { loadFreshMonthlySources } from "./monthly-source-freshness.js";
import type {
  MonthlyFeedbackCapability,
  MonthlyFeedbackContext,
  MonthlyFeedbackResult,
} from "./prisma-monthly-feedback.service.js";

type Database = Prisma.TransactionClient;
type Code = "FORBIDDEN_SCOPE" | "VALIDATION_FAILED" | "NOT_FOUND_SCOPED" | "CONFLICT_STATE";
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
const include = {
  createdBy: { select: { membership: { select: { userId: true } } } },
  student: { select: { status: true, classRef: true, displayRef: true } },
} as const;
type Report = Prisma.ChildMonthlyReportGetPayload<{ include: typeof include }>;
type Source = {
  kind: "GROWTH_RECORD" | "ATTENDANCE_OVERVIEW";
  id: string;
  date: string;
  version: number;
  publicationVersion?: number;
};
type Action = "edit" | "submit" | "review" | "publish";
class ChildMonthlyFailure extends Error {
  public constructor(public readonly code: Code) {
    super(code);
  }
}
const fail = (code: Code): never => {
  throw new ChildMonthlyFailure(code);
};
const failed = (code: Code): Extract<MonthlyFeedbackResult<never>, { ok: false }> => ({
  ok: false,
  error: { code, message: "The child monthly report could not perform this action." },
});
const uuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
function exact(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.keys(value).length !== keys.length ||
    Object.keys(value).some((k) => !keys.includes(k))
  )
    return fail("VALIDATION_FAILED");
  return value as Record<string, unknown>;
}
function versionOf(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1)
    return fail("VALIDATION_FAILED");
  return value;
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
const key = (r: Report) => ({ tenantId: r.tenantId, campusId: r.campusId, id: r.id });
const scoped = (s: Staff) => ({
  tenantId: s.tenantId,
  campusId: s.campusId,
  classRef: { in: s.classRefs },
});

async function staffAccess(
  db: Database,
  context: MonthlyFeedbackContext,
  capability: MonthlyFeedbackCapability,
): Promise<Staff[]> {
  if (new Set(context.scopes.map((s) => s.scope.actorId)).size !== 1)
    return fail("FORBIDDEN_SCOPE");
  const actors: Staff[] = [];
  for (const { scope, capabilities } of context.scopes) {
    const { tenantId, campusId, actorId } = scope;
    if (!uuid(tenantId) || !uuid(campusId) || !uuid(actorId) || !capabilities.includes(capability))
      continue;
    const members = await db.membershipCampus.findMany({
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
      take: 2,
    });
    if (members.length !== 1 || !members[0]!.classAssignments.length) continue;
    if (actors.some((s) => s.tenantId === tenantId && s.campusId === campusId))
      return fail("FORBIDDEN_SCOPE");
    actors.push({
      tenantId,
      campusId,
      actorId,
      membershipId: members[0]!.membershipId,
      classRefs: members[0]!.classAssignments.map((c) => c.classRef),
      capabilities,
    });
  }
  if (!actors.length) return fail("FORBIDDEN_SCOPE");
  return actors;
}
async function parentAccess(db: Database, scope: ScopeContext, relationshipId: string) {
  const { tenantId, campusId, actorId } = scope;
  if (!uuid(tenantId) || !uuid(campusId) || !uuid(actorId)) return fail("FORBIDDEN_SCOPE");
  if (!uuid(relationshipId)) return fail("VALIDATION_FAILED");
  const members = await db.membershipCampus.findMany({
    where: {
      tenantId,
      campusId,
      campus: { status: "ACTIVE", tenant: { status: "ACTIVE" } },
      membership: { userId: actorId, status: "ACTIVE", user: { status: "ACTIVE" } },
    },
    select: { membershipId: true },
    take: 2,
  });
  if (members.length !== 1) return fail("FORBIDDEN_SCOPE");
  const relationship = await db.guardianRelationship.findFirst({
    where: {
      tenantId,
      campusId,
      id: relationshipId,
      guardianUserId: actorId,
      status: "ACTIVE",
      releasedAt: null,
      sourceApplication: { status: "APPROVED" },
      guardian: { status: "ACTIVE" },
      student: { status: "ACTIVE" },
      campus: { status: "ACTIVE", tenant: { status: "ACTIVE" } },
    },
    include: { student: { select: { classRef: true, displayRef: true } } },
  });
  if (!relationship) return fail("NOT_FOUND_SCOPED");
  return relationship;
}
async function sourcesFor(
  db: Database,
  report: {
    tenantId: string;
    campusId: string;
    studentId: string;
    classRef: string;
    month: string;
  },
): Promise<Source[]> {
  const { care, attendance } = await loadFreshMonthlySources(db, report);
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
  ];
  return sources.sort((a, b) =>
    `${a.kind}:${a.date}:${a.id}`.localeCompare(`${b.kind}:${b.date}:${b.id}`),
  );
}
function content(report: Report) {
  const sourceCounts = { GROWTH_RECORD: 0, ATTENDANCE_OVERVIEW: 0 };
  for (const source of report.sources as Source[]) sourceCounts[source.kind] += 1;
  return {
    supplements: {
      learningParticipation: report.learningParticipation,
      dailyHabits: report.dailyHabits,
      activityParticipation: report.activityParticipation,
      familySchoolCollaboration: report.familySchoolCollaboration,
    },
    sourceCounts,
  };
}
function actions(report: Report, actor: Staff) {
  const allowed: ChildMonthlyAction[] = [];
  const own = report.createdByMembershipId === actor.membershipId;
  const independent = report.createdBy.membership.userId !== actor.actorId;
  if (
    own &&
    ["DRAFT", "RETURNED", "REVIEW_REQUIRED"].includes(report.status) &&
    actor.capabilities.includes("feedback:create")
  )
    allowed.push("edit");
  if (own && report.status === "DRAFT" && actor.capabilities.includes("feedback:submit"))
    allowed.push("submit");
  if (
    independent &&
    report.status === "SUBMITTED" &&
    actor.capabilities.includes("feedback:review")
  )
    allowed.push("confirm", "return");
  if (independent && report.status === "CONFIRMED") {
    if (actor.capabilities.includes("feedback:review")) allowed.push("return");
    if (actor.capabilities.includes("feedback:publish")) allowed.push("publish");
  }
  return allowed;
}
const publishedSnapshot = (report: Report) =>
  report.status === "PUBLISHED" &&
  report.publicationVersion > 0 &&
  report.reviewedByMembershipId !== null;
const matchesHistoricalActor = (actor: Staff, report: Report) =>
  actor.tenantId === report.tenantId &&
  actor.campusId === report.campusId &&
  report.student.status === "ACTIVE" &&
  report.student.classRef !== report.classRef &&
  actor.classRefs.includes(report.student.classRef) &&
  publishedSnapshot(report);
const staffView = (
  report: Report,
  actor: Staff,
  readOnlyHistory = false,
): ChildMonthlyStaffReport => ({
  id: report.id,
  studentId: report.studentId,
  studentLabel: report.student.displayRef,
  classRef: report.classRef,
  month: report.month,
  status: report.status,
  version: report.version,
  sourceVersion: report.sourceVersion,
  publicationVersion: report.publicationVersion,
  ...content(report),
  actions: readOnlyHistory ? [] : actions(report, actor),
});
async function event(db: Database, report: Report, actorUserId: string, action: string) {
  await db.childMonthlyEvent.create({
    data: {
      tenantId: report.tenantId,
      campusId: report.campusId,
      reportId: report.id,
      version: report.version,
      sourceVersion: report.sourceVersion,
      status: report.status,
      action,
      actorUserId,
    },
  });
}
async function save(
  db: Database,
  report: Report,
  actorUserId: string,
  action: string,
  changes: Prisma.ChildMonthlyReportUncheckedUpdateManyInput,
): Promise<Report> {
  const result = await db.childMonthlyReport.updateMany({
    where: { ...key(report), version: report.version },
    data: { ...changes, version: { increment: 1 } },
  });
  if (result.count !== 1) return fail("CONFLICT_STATE");
  const updated = await db.childMonthlyReport.findFirstOrThrow({ where: key(report), include });
  await event(db, updated, actorUserId, action);
  return updated;
}
async function refresh(db: Database, report: Report, actorUserId: string) {
  const sources = await sourcesFor(db, report);
  if (isDeepStrictEqual(sources, report.sources)) return report;
  return save(db, report, actorUserId, "SOURCES_CHANGED", {
    sources,
    sourceVersion: { increment: 1 },
    reviewedByMembershipId: null,
    status: ["SUBMITTED", "CONFIRMED", "PUBLISHED"].includes(report.status)
      ? "REVIEW_REQUIRED"
      : report.status,
  });
}
const matchesActor = (actor: Staff, report: Report) =>
  actor.tenantId === report.tenantId &&
  actor.campusId === report.campusId &&
  actor.classRefs.includes(report.classRef) &&
  report.student.status === "ACTIVE" &&
  report.student.classRef === report.classRef;
const matchesListedActor = (actor: Staff, report: Report) =>
  matchesActor(actor, report) &&
  (actor.capabilities.includes("feedback:review") ||
    actor.capabilities.includes("feedback:publish") ||
    report.createdByMembershipId === actor.membershipId);

/** Child-only monthly publications. Class reports and internal daily reports are never projected. */
export class PrismaChildMonthlyService {
  public constructor(private readonly prisma: PrismaClient) {}

  private async transaction<T>(
    operation: (db: Database) => Promise<MonthlyFeedbackResult<T>>,
  ): Promise<MonthlyFeedbackResult<T>> {
    try {
      return await this.prisma.$transaction(operation, { isolationLevel: "Serializable" });
    } catch (error) {
      if (error instanceof ChildMonthlyFailure) return failed(error.code);
      if (typeof error === "object" && error !== null && "code" in error) {
        if (["P2002", "P2025", "P2034"].includes(String(error.code)))
          return failed("CONFLICT_STATE");
        if (error.code === "P2003") return failed("NOT_FOUND_SCOPED");
      }
      throw error;
    }
  }
  public list(context: MonthlyFeedbackContext) {
    return this.transaction(async (db) => {
      const actors = await staffAccess(db, context, "feedback:read");
      const reports = await db.childMonthlyReport.findMany({
        where: {
          OR: actors.map((actor) => ({
            tenantId: actor.tenantId,
            campusId: actor.campusId,
            student: { status: "ACTIVE", classRef: { in: actor.classRefs } },
            OR: [
              {
                classRef: { in: actor.classRefs },
                ...(actor.capabilities.includes("feedback:review") ||
                actor.capabilities.includes("feedback:publish")
                  ? {}
                  : { createdByMembershipId: actor.membershipId }),
              },
              {
                status: "PUBLISHED",
                publicationVersion: { gt: 0 },
                reviewedByMembershipId: { not: null },
              },
            ],
          })),
        },
        include,
        orderBy: [{ month: "desc" }, { id: "asc" }],
      });
      const records: ReturnType<typeof staffView>[] = [];
      for (const report of reports) {
        const actor = actors.find((a) => matchesListedActor(a, report));
        if (actor) records.push(staffView(await refresh(db, report, actor.actorId), actor));
        else {
          const historicalActor = actors.find((a) => matchesHistoricalActor(a, report));
          if (historicalActor) records.push(staffView(report, historicalActor, true));
        }
      }
      const students = await db.student.findMany({
        where: {
          status: "ACTIVE",
          OR: actors.filter((a) => a.capabilities.includes("feedback:create")).map(scoped),
        },
        select: { id: true, displayRef: true, classRef: true },
        orderBy: [{ displayRef: "asc" }, { id: "asc" }],
      });
      return { ok: true as const, data: { records, students } };
    });
  }
  public create(context: MonthlyFeedbackContext, body: unknown) {
    return this.transaction(async (db) => {
      const input = exact(body, ["studentId", "month", "supplements"]);
      if (
        !uuid(input.studentId) ||
        typeof input.month !== "string" ||
        !/^(?:19|20|21)\d{2}-(?:0[1-9]|1[0-2])$/u.test(input.month)
      )
        return fail("VALIDATION_FAILED");
      const values = supplements(input.supplements);
      const actors = await staffAccess(db, context, "feedback:create");
      const students = await db.student.findMany({
        where: { id: input.studentId, status: "ACTIVE", OR: actors.map(scoped) },
        take: 2,
      });
      if (students.length !== 1) return fail("NOT_FOUND_SCOPED");
      const student = students[0]!;
      const actor = actors.find(
        (a) =>
          a.tenantId === student.tenantId &&
          a.campusId === student.campusId &&
          a.classRefs.includes(student.classRef),
      )!;
      const scope = {
        tenantId: student.tenantId,
        campusId: student.campusId,
        studentId: student.id,
        classRef: student.classRef,
        month: input.month,
      };
      const report = await db.childMonthlyReport.create({
        data: {
          ...scope,
          ...values,
          sources: await sourcesFor(db, scope),
          createdByMembershipId: actor.membershipId,
          updatedByMembershipId: actor.membershipId,
        },
        include,
      });
      await event(db, report, actor.actorId, "CREATE");
      return { ok: true as const, data: staffView(report, actor) };
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
      const capability =
        action === "edit"
          ? "feedback:create"
          : action === "submit"
            ? "feedback:submit"
            : action === "review"
              ? "feedback:review"
              : "feedback:publish";
      const actors = await staffAccess(db, context, capability);
      const reviewer = action === "review" || action === "publish";
      const report = await db.childMonthlyReport.findFirst({
        where: {
          id,
          OR: actors.map((actor) => ({
            ...scoped(actor),
            student: { status: "ACTIVE", classRef: { in: actor.classRefs } },
            ...(reviewer
              ? { createdBy: { membership: { userId: { not: actor.actorId } } } }
              : { createdByMembershipId: actor.membershipId }),
          })),
        },
        include,
      });
      if (!report) return fail("NOT_FOUND_SCOPED");
      const actor = actors.find((a) => matchesActor(a, report));
      if (!actor) return fail("NOT_FOUND_SCOPED");
      if (version !== report.version) return fail("CONFLICT_STATE");
      const fresh = await refresh(db, report, actor.actorId);
      // Returning a failure value lets source invalidation commit instead of rolling back.
      if (fresh.version !== report.version) return failed("CONFLICT_STATE");
      const allowed =
        action === "edit"
          ? ["DRAFT", "RETURNED", "REVIEW_REQUIRED"].includes(report.status)
          : action === "submit"
            ? report.status === "DRAFT" && (report.sources as Source[]).length > 0
            : action === "publish"
              ? report.status === "CONFIRMED" && report.reviewedByMembershipId !== null
              : input.action === "CONFIRM"
                ? report.status === "SUBMITTED"
                : ["SUBMITTED", "CONFIRMED"].includes(report.status);
      if (!allowed) return fail("CONFLICT_STATE");
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
        report,
        actor.actorId,
        action === "review" ? String(input.action) : action.toUpperCase(),
        {
          ...(values ?? {}),
          status,
          updatedByMembershipId: actor.membershipId,
          reviewedByMembershipId:
            status === "CONFIRMED"
              ? actor.membershipId
              : status === "PUBLISHED"
                ? report.reviewedByMembershipId
                : null,
          ...(status === "PUBLISHED" ? { publicationVersion: { increment: 1 } } : {}),
        },
      );
      return { ok: true as const, data: staffView(updated, actor) };
    });
  }

  /** Resolve only trusted member/campus pairs; never probe with a mutating parent operation. */
  public resolveParentScope(
    context: { readonly scopes: readonly ScopeContext[] },
    relationshipId: string,
  ): Promise<MonthlyFeedbackResult<ScopeContext>> {
    return this.transaction(async (db) => {
      if (!uuid(relationshipId)) return fail("VALIDATION_FAILED");
      const scopes = context.scopes;
      if (
        !scopes.length ||
        new Set(scopes.map((scope) => scope.actorId)).size !== 1 ||
        scopes.some(
          (scope) => !uuid(scope.actorId) || !uuid(scope.tenantId) || !uuid(scope.campusId),
        ) ||
        new Set(scopes.map((scope) => `${scope.tenantId}:${scope.campusId}`)).size !== scopes.length
      )
        return fail("FORBIDDEN_SCOPE");
      const actorId = scopes[0]!.actorId;
      const matches = await db.guardianRelationship.findMany({
        where: {
          id: relationshipId,
          guardianUserId: actorId,
          status: "ACTIVE",
          releasedAt: null,
          sourceApplication: { status: "APPROVED" },
          guardian: { status: "ACTIVE" },
          student: { status: "ACTIVE" },
          campus: { status: "ACTIVE", tenant: { status: "ACTIVE" } },
          OR: scopes.map(({ tenantId, campusId }) => {
            if (!campusId) return fail("FORBIDDEN_SCOPE");
            return { tenantId, campusId };
          }),
        },
        select: { tenantId: true, campusId: true },
        take: 2,
      });
      if (!matches.length) return fail("NOT_FOUND_SCOPED");
      if (matches.length !== 1) return fail("FORBIDDEN_SCOPE");
      const scope: ScopeContext = { ...matches[0]!, actorId };
      await parentAccess(db, scope, relationshipId);
      return { ok: true as const, data: scope };
    });
  }

  public listParent(scope: ScopeContext, relationshipId: string) {
    return this.transaction(async (db) => {
      const relationship = await parentAccess(db, scope, relationshipId);
      const reports = await db.childMonthlyReport.findMany({
        where: {
          tenantId: relationship.tenantId,
          campusId: relationship.campusId,
          studentId: relationship.studentId,
          status: "PUBLISHED",
          publicationVersion: { gt: 0 },
          reviewedByMembershipId: { not: null },
        },
        include,
        orderBy: [{ month: "desc" }, { id: "asc" }],
      });
      const records: ChildMonthlyParentSummary[] = [];
      for (const report of reports) {
        const historical = report.classRef !== relationship.student.classRef;
        const fresh = historical ? report : await refresh(db, report, scope.actorId);
        if (fresh.status !== "PUBLISHED") continue;
        const receipt = await db.childMonthlyReceipt.findFirst({
          where: {
            tenantId: relationship.tenantId,
            campusId: relationship.campusId,
            reportId: fresh.id,
            guardianRelationshipId: relationship.id,
            guardianRelationshipVersion: relationship.version,
            guardianUserId: scope.actorId,
            publicationVersion: fresh.publicationVersion,
          },
          select: { reportId: true },
        });
        records.push({
          id: fresh.id,
          studentId: fresh.studentId,
          studentLabel: relationship.student.displayRef,
          month: fresh.month,
          publicationVersion: fresh.publicationVersion,
          relationshipVersion: relationship.version,
          ...content(fresh),
          acknowledged: receipt !== null,
        });
      }
      return { ok: true as const, data: { records } };
    });
  }

  public acknowledgeParent(scope: ScopeContext, relationshipId: string, id: string, body: unknown) {
    return this.transaction(async (db) => {
      if (!uuid(id)) return fail("VALIDATION_FAILED");
      const input = exact(body, ["publicationVersion", "relationshipVersion"]);
      const publicationVersion = versionOf(input.publicationVersion);
      const relationshipVersion = versionOf(input.relationshipVersion);
      const relationship = await parentAccess(db, scope, relationshipId);
      if (relationship.version !== relationshipVersion) return fail("CONFLICT_STATE");
      const report = await db.childMonthlyReport.findFirst({
        where: {
          id,
          tenantId: relationship.tenantId,
          campusId: relationship.campusId,
          studentId: relationship.studentId,
        },
        include,
      });
      if (!report) return fail("NOT_FOUND_SCOPED");
      // A guessed draft ID must not let a guardian refresh internal sources or write audit events.
      if (!publishedSnapshot(report) || report.publicationVersion !== publicationVersion)
        return failed("CONFLICT_STATE");
      const historical = report.classRef !== relationship.student.classRef;
      const fresh = historical ? report : await refresh(db, report, scope.actorId);
      if (
        fresh.version !== report.version ||
        fresh.status !== "PUBLISHED" ||
        fresh.publicationVersion !== publicationVersion
      )
        return failed("CONFLICT_STATE");
      const data = {
        tenantId: relationship.tenantId,
        campusId: relationship.campusId,
        reportId: fresh.id,
        studentId: relationship.studentId,
        guardianRelationshipId: relationship.id,
        guardianUserId: scope.actorId,
        guardianRelationshipVersion: relationship.version,
        publicationVersion,
      };
      const existing = await db.childMonthlyReceipt.findFirst({ where: data });
      if (!existing) await db.childMonthlyReceipt.create({ data });
      return { ok: true as const, data: { acknowledged: true as const } };
    });
  }
}
