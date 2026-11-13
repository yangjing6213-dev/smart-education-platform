import { Prisma, type PrismaClient } from "../../generated/prisma/client.js";
import type { StaffDailyAuditEvent } from "@student-care/contracts";
import { careSourcesFresh } from "../care-records/care-record-sources.js";
import { matchesFrozenSources } from "../monthly-feedback/monthly-source-freshness.js";
import type {
  StaffDailyCapability,
  StaffDailyContext,
  StaffDailyOperations,
  StaffDailyResult,
  StaffDailyScopeAccess,
} from "../../nest/api-tokens.js";

type Database = PrismaClient | Prisma.TransactionClient;
type DailyValues = {
  readonly arrival: "ARRIVED_AS_PLANNED" | "LATE" | "ABSENT";
  readonly homework: "COMPLETED" | "IN_PROGRESS" | "NEEDS_SUPPORT";
  readonly activity: "PARTICIPATED" | "OBSERVED" | "NOT_RECORDED";
  readonly classroom: "ROUTINE" | "NEEDS_ATTENTION" | "NEEDS_FOLLOW_UP";
  readonly followUp: "NONE" | "OBSERVE_TOMORROW" | "OWNER_ATTENTION";
};
type StaffScope = {
  readonly access: StaffDailyScopeAccess;
  readonly membershipId: string;
  readonly classRefs: readonly string[];
};
type Source = { readonly id: string; readonly version: number; readonly valid: boolean };
type Sources = {
  readonly tasks: readonly Source[];
  readonly attendance: readonly Source[];
  readonly careRecords: readonly Source[];
  readonly pickups: readonly Source[];
  readonly pickupExceptions: readonly Source[];
};

const dailyInclude = {
  createdBy: { select: { membership: { select: { userId: true } } } },
  workTaskSources: { select: { sourceId: true, sourceVersion: true } },
  attendanceSources: { select: { sourceId: true, sourceVersion: true } },
  careRecordSources: { select: { sourceId: true, sourceVersion: true } },
  pickupRecordSources: { select: { sourceId: true, sourceVersion: true } },
  pickupExceptionSources: { select: { sourceId: true, sourceVersion: true } },
} as const;
type DailyRecord = Prisma.StaffDailyReportGetPayload<{ include: typeof dailyInclude }>;
type StaffDailyAuditAction =
  | "CREATED"
  | "EDITED"
  | "SUBMITTED"
  | "RESUBMITTED"
  | "REVIEW_CONFIRMED"
  | "REVIEW_RETURNED"
  | "CONFIRMATION_WITHDRAWN"
  | "SOURCES_INVALIDATED";

class DailyFailure extends Error {
  public constructor(
    public readonly code:
      "FORBIDDEN_SCOPE" | "VALIDATION_FAILED" | "NOT_FOUND_SCOPED" | "CONFLICT_STATE",
  ) {
    super(code);
  }
}

const forbidden = () => new DailyFailure("FORBIDDEN_SCOPE");
const invalid = () => new DailyFailure("VALIDATION_FAILED");
const notFound = () => new DailyFailure("NOT_FOUND_SCOPED");
const conflict = () => new DailyFailure("CONFLICT_STATE");

function isPrismaCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

function isDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const options: { readonly [K in keyof DailyValues]: readonly DailyValues[K][] } = {
  arrival: ["ARRIVED_AS_PLANNED", "LATE", "ABSENT"],
  homework: ["COMPLETED", "IN_PROGRESS", "NEEDS_SUPPORT"],
  activity: ["PARTICIPATED", "OBSERVED", "NOT_RECORDED"],
  classroom: ["ROUTINE", "NEEDS_ATTENTION", "NEEDS_FOLLOW_UP"],
  followUp: ["NONE", "OBSERVE_TOMORROW", "OWNER_ATTENTION"],
};

function parseValues(value: unknown): DailyValues {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw invalid();
  const data = value as Record<string, unknown>;
  const keys = ["arrival", "homework", "activity", "classroom", "followUp"];
  if (
    Object.keys(data).length !== keys.length ||
    Object.keys(data).some((key) => !keys.includes(key))
  )
    throw invalid();
  for (const key of keys as (keyof DailyValues)[]) {
    if (
      typeof data[key] !== "string" ||
      !(options[key] as readonly string[]).includes(data[key] as string)
    )
      throw invalid();
  }
  return data as DailyValues;
}

function exactObject(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length === keys.length &&
    Object.keys(value).every((key) => keys.includes(key))
  );
}

function createInput(value: unknown): { readonly date: string; readonly values: DailyValues } {
  if (!exactObject(value, ["date", "values"]) || !isDate(value.date)) throw invalid();
  return { date: value.date, values: parseValues(value.values) };
}

function updateInput(value: unknown): { readonly version: number; readonly values: DailyValues } {
  if (
    !exactObject(value, ["version", "values"]) ||
    !Number.isSafeInteger(value.version) ||
    (value.version as number) < 1
  )
    throw invalid();
  return { version: value.version as number, values: parseValues(value.values) };
}

function versionInput(value: unknown): { readonly version: number } {
  if (
    !exactObject(value, ["version"]) ||
    !Number.isSafeInteger(value.version) ||
    (value.version as number) < 1
  )
    throw invalid();
  return { version: value.version as number };
}

function dateValue(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function dateString(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function result<T>(data: T): StaffDailyResult<T> {
  return { ok: true, data };
}

function failure<T>(error: unknown): StaffDailyResult<T> {
  if (error instanceof DailyFailure) {
    const messages = {
      FORBIDDEN_SCOPE: "Scope access is not permitted.",
      VALIDATION_FAILED: "The daily report is invalid.",
      NOT_FOUND_SCOPED: "The daily report was not found in the allowed scope.",
      CONFLICT_STATE: "The daily report changed or cannot perform this action.",
    } as const;
    return { ok: false, error: { code: error.code, message: messages[error.code] } };
  }
  if (isPrismaCode(error, "P2002")) return failure(conflict());
  if (isPrismaCode(error, "P2003")) return failure(notFound());
  if (isPrismaCode(error, "P2025")) return failure(conflict());
  if (isPrismaCode(error, "P2034")) return failure(conflict());
  throw error;
}

async function execute<T>(
  operation: () => Promise<T | DailyFailure>,
): Promise<StaffDailyResult<T>> {
  try {
    const value = await operation();
    // Return a business conflict only after the invalidation transaction has committed.
    return value instanceof DailyFailure ? failure<T>(value) : result(value);
  } catch (error) {
    return failure<T>(error);
  }
}

function requiredAccess(
  context: StaffDailyContext,
  capability: StaffDailyCapability,
): readonly StaffDailyScopeAccess[] {
  const actorIds = new Set(context.scopes.map(({ scope }) => scope.actorId));
  if (actorIds.size !== 1) return [];
  return context.scopes.filter(
    ({ scope, capabilities }) => scope.campusId !== undefined && capabilities.includes(capability),
  );
}

async function resolveStaff(
  database: Database,
  context: StaffDailyContext,
  capability: StaffDailyCapability,
): Promise<readonly StaffScope[]> {
  const scopes: StaffScope[] = [];
  for (const access of requiredAccess(context, capability)) {
    const { actorId, tenantId, campusId } = access.scope;
    if (campusId === undefined) continue;
    const memberships = await database.membershipCampus.findMany({
      where: {
        tenantId,
        campusId,
        membership: {
          userId: actorId,
          status: "ACTIVE",
          user: { status: "ACTIVE" },
          tenant: { status: "ACTIVE" },
        },
        campus: { status: "ACTIVE" },
      },
      select: { membershipId: true, classAssignments: { select: { classRef: true } } },
    });
    if (memberships.length !== 1) continue;
    const membership = memberships[0];
    if (membership === undefined) continue;
    scopes.push({
      access,
      membershipId: membership.membershipId,
      classRefs: membership.classAssignments.map(({ classRef }) => classRef),
    });
  }
  return scopes;
}

function sourceCounts(record: DailyRecord) {
  return {
    TASK: record.workTaskSources.length,
    ATTENDANCE: record.attendanceSources.length,
    CARE_RECORD: record.careRecordSources.length,
    PICKUP: record.pickupRecordSources.length,
    PICKUP_EXCEPTION: record.pickupExceptionSources.length,
  };
}

function actions(record: DailyRecord, staff: StaffScope) {
  if (record.createdByMembershipId !== staff.membershipId) return [] as string[];
  const allowed: string[] = [];
  if (record.status === "DRAFT" && staff.access.capabilities.includes("daily:create"))
    allowed.push("edit");
  if (record.status === "DRAFT" && staff.access.capabilities.includes("daily:submit"))
    allowed.push("submit");
  if (record.status === "RETURNED" && staff.access.capabilities.includes("daily:submit"))
    allowed.push("resubmit");
  return allowed;
}

function projection(record: DailyRecord, staff: StaffScope) {
  return {
    id: record.id,
    version: record.version,
    status: record.status,
    date: dateString(record.date),
    values: {
      arrival: record.arrival,
      homework: record.homework,
      activity: record.activity,
      classroom: record.classroom,
      followUp: record.followUp,
    },
    sourceCounts: sourceCounts(record),
    learningSummary: null,
    actions: actions(record, staff),
  };
}

function reviewProjection(
  record: DailyRecord,
  staff: StaffScope,
  names: ReadonlyMap<string, string>,
) {
  return {
    ...projection(record, staff),
    authorLabel: names.get(record.createdBy.membership.userId) || "提交员工",
    actions:
      record.createdByMembershipId === staff.membershipId
        ? []
        : record.status === "SUBMITTED"
          ? ["confirm", "return"]
          : record.status === "CONFIRMED"
            ? ["return", "withdraw"]
            : [],
  };
}

function reviewWhere(staff: StaffScope) {
  const where = scopeWhere(staff);
  return where
    ? {
        ...where,
        createdByMembershipId: { not: staff.membershipId },
        createdBy: { membership: { userId: { not: staff.access.scope.actorId } } },
      }
    : undefined;
}

function scopeWhere(staff: StaffScope) {
  const { tenantId, campusId } = staff.access.scope;
  if (campusId === undefined || staff.classRefs.length === 0) return undefined;
  return {
    tenantId,
    campusId,
    classRef: { in: [...staff.classRefs] },
  };
}

async function sourceSnapshot(
  transaction: Prisma.TransactionClient,
  staff: StaffScope,
  classRef: string,
  date: Date,
): Promise<Sources> {
  const { tenantId, campusId } = staff.access.scope;
  if (campusId === undefined) throw forbidden();
  const where = { tenantId, campusId, classRef };
  const student = { select: { status: true, classRef: true } } as const;
  const activeStudent = (row: { student: { status: string; classRef: string } }) =>
    row.student.status === "ACTIVE" && row.student.classRef === classRef;
  const tasks = await transaction.workTask.findMany({
    where: { ...where, dueDate: date, status: "CHECKED" },
    select: { id: true, version: true },
  });
  const attendance = await transaction.attendanceRecord.findMany({
    where: { ...where, serviceDate: date },
    select: {
      id: true,
      version: true,
      studentId: true,
      serviceDate: true,
      status: true,
      student,
      corrections: { where: { status: "PENDING" }, select: { id: true } },
    },
  });
  const careRecords = await transaction.careRecord.findMany({
    where: { ...where, serviceDate: date, published: true },
    select: {
      id: true,
      version: true,
      studentId: true,
      serviceDate: true,
      tenantId: true,
      campusId: true,
      classRef: true,
      status: true,
      publicationVersion: true,
      student,
    },
  });
  const pickups = await transaction.pickupRecord.findMany({
    where: { tenantId, campusId, serviceDate: date, student: { is: { classRef } } },
    select: {
      id: true,
      studentId: true,
      serviceDate: true,
      status: true,
      student,
      studentChecked: true,
      recipientChecked: true,
      authorizationChecked: true,
      attendanceRecordId: true,
      attendanceVersion: true,
    },
  });
  const pickupExceptions = await transaction.pickupException.findMany({
    where: { ...where, date },
    select: { id: true, version: true, student },
  });
  const attendanceById = new Map(attendance.map((row) => [row.id, row]));
  const attendanceValid = (row: (typeof attendance)[number]) =>
    activeStudent(row) && row.corrections.length === 0;
  return {
    tasks: tasks.map((row) => ({ ...row, valid: true })),
    // Keep invalid candidates: excluding them would let resubmission hide unresolved evidence.
    attendance: attendance.map((row) => ({
      id: row.id,
      version: row.version,
      valid: attendanceValid(row),
    })),
    careRecords: await Promise.all(
      careRecords.map(async (row) => ({
        id: row.id,
        version: row.version,
        valid:
          activeStudent(row) &&
          row.status === "CONFIRMED" &&
          row.publicationVersion > 0 &&
          (await careSourcesFresh(transaction, row)),
      })),
    ),
    pickups: pickups.map((row) => {
      const source = attendanceById.get(row.attendanceRecordId);
      return {
        id: row.id,
        version: 1,
        valid:
          activeStudent(row) &&
          row.status === "COMPLETED" &&
          row.studentChecked &&
          row.recipientChecked &&
          row.authorizationChecked &&
          source !== undefined &&
          attendanceValid(source) &&
          source.studentId === row.studentId &&
          dateString(source.serviceDate) === dateString(row.serviceDate) &&
          source.status === "DEPARTED" &&
          source.version === row.attendanceVersion,
      };
    }),
    pickupExceptions: pickupExceptions.map((row) => ({
      id: row.id,
      version: row.version,
      valid: activeStudent(row),
    })),
  };
}

function sourcesMatch(record: DailyRecord, sources: Sources): boolean {
  return (
    matchesFrozenSources(record.workTaskSources, sources.tasks) &&
    matchesFrozenSources(record.attendanceSources, sources.attendance) &&
    matchesFrozenSources(record.careRecordSources, sources.careRecords) &&
    matchesFrozenSources(record.pickupRecordSources, sources.pickups) &&
    matchesFrozenSources(record.pickupExceptionSources, sources.pickupExceptions)
  );
}

async function invalidate(
  transaction: Prisma.TransactionClient,
  record: DailyRecord,
  staff: StaffScope,
): Promise<DailyRecord> {
  const where = scopeWhere(staff);
  if (!where) throw notFound();
  const changed = await transaction.staffDailyReport.updateMany({
    where: { ...where, id: record.id, version: record.version, status: record.status },
    data: {
      status: "RETURNED",
      reviewedByMembershipId: null,
      updatedByMembershipId: staff.membershipId,
      version: { increment: 1 },
    },
  });
  if (changed.count !== 1) throw conflict();
  const updated = await transaction.staffDailyReport.findFirstOrThrow({
    where: { ...where, id: record.id },
    include: dailyInclude,
  });
  await recordAudit(transaction, updated, "SOURCES_INVALIDATED", null, staff.membershipId);
  return updated;
}

async function recordAudit(
  transaction: Prisma.TransactionClient,
  report: Pick<DailyRecord, "tenantId" | "campusId" | "id" | "version">,
  action: StaffDailyAuditAction,
  actorMembershipId: string | null,
  initiatedByMembershipId: string,
): Promise<void> {
  await transaction.staffDailyReportAuditEvent.create({
    data: {
      tenantId: report.tenantId,
      campusId: report.campusId,
      reportId: report.id,
      actorMembershipId,
      initiatedByMembershipId,
      action,
      reportVersion: report.version,
    },
  });
}

async function recheckListed(
  transaction: Prisma.TransactionClient,
  record: DailyRecord,
  staff: StaffScope,
  snapshots: Map<string, Sources>,
): Promise<DailyRecord> {
  if (record.status !== "SUBMITTED" && record.status !== "CONFIRMED") return record;
  const key = JSON.stringify([
    record.tenantId,
    record.campusId,
    record.classRef,
    dateString(record.date),
  ]);
  let sources = snapshots.get(key);
  if (!sources) {
    sources = await sourceSnapshot(transaction, staff, record.classRef, record.date);
    snapshots.set(key, sources);
  }
  return sourcesMatch(record, sources) ? record : invalidate(transaction, record, staff);
}

async function replaceSources(
  transaction: Prisma.TransactionClient,
  staff: StaffScope,
  reportId: string,
  sources: Sources,
): Promise<void> {
  const { tenantId, campusId } = staff.access.scope;
  if (campusId === undefined) throw forbidden();
  const where = { tenantId, campusId, reportId };
  await transaction.staffDailyReportWorkTaskSource.deleteMany({ where });
  await transaction.staffDailyReportAttendanceSource.deleteMany({ where });
  await transaction.staffDailyReportCareRecordSource.deleteMany({ where });
  await transaction.staffDailyReportPickupRecordSource.deleteMany({ where });
  await transaction.staffDailyReportPickupExceptionSource.deleteMany({ where });
  if (sources.tasks.length)
    await transaction.staffDailyReportWorkTaskSource.createMany({
      data: sources.tasks.map(({ id, version }) => ({
        ...where,
        sourceId: id,
        sourceVersion: version,
      })),
    });
  if (sources.attendance.length)
    await transaction.staffDailyReportAttendanceSource.createMany({
      data: sources.attendance.map(({ id, version }) => ({
        ...where,
        sourceId: id,
        sourceVersion: version,
      })),
    });
  if (sources.careRecords.length)
    await transaction.staffDailyReportCareRecordSource.createMany({
      data: sources.careRecords.map(({ id, version }) => ({
        ...where,
        sourceId: id,
        sourceVersion: version,
      })),
    });
  if (sources.pickups.length)
    await transaction.staffDailyReportPickupRecordSource.createMany({
      data: sources.pickups.map(({ id, version }) => ({
        ...where,
        sourceId: id,
        sourceVersion: version,
      })),
    });
  if (sources.pickupExceptions.length)
    await transaction.staffDailyReportPickupExceptionSource.createMany({
      data: sources.pickupExceptions.map(({ id, version }) => ({
        ...where,
        sourceId: id,
        sourceVersion: version,
      })),
    });
}

async function getRecord(database: Database, staff: StaffScope, id: string): Promise<DailyRecord> {
  const where = scopeWhere(staff);
  if (!where) throw notFound();
  const record = await database.staffDailyReport.findFirst({
    where: { ...where, id },
    include: dailyInclude,
  });
  if (!record) throw notFound();
  if (record.createdByMembershipId !== staff.membershipId) throw notFound();
  return record;
}

export class PrismaStaffDailyService implements StaffDailyOperations {
  public constructor(
    private readonly prisma: PrismaClient,
    private readonly names: ReadonlyMap<string, string> = new Map(),
  ) {}

  public reviewList(
    context: StaffDailyContext,
  ): Promise<StaffDailyResult<{ readonly records: readonly unknown[] }>> {
    return execute(() =>
      this.prisma.$transaction(
        async (transaction) => {
          const reviewers = await resolveStaff(transaction, context, "daily:review");
          if (!reviewers.length) throw forbidden();
          const scopes = reviewers.flatMap((member) => {
            const where = reviewWhere(member);
            return where ? [where] : [];
          });
          if (!scopes.length) return { records: [] };
          const records = await transaction.staffDailyReport.findMany({
            where: { OR: scopes, status: { in: ["SUBMITTED", "CONFIRMED", "RETURNED"] } },
            include: dailyInclude,
            orderBy: [{ date: "desc" }, { updatedAt: "desc" }],
          });
          const listed = [];
          const snapshots = new Map<string, Sources>();
          for (const record of records) {
            const reviewer = reviewers.find(
              (member) =>
                member.access.scope.tenantId === record.tenantId &&
                member.access.scope.campusId === record.campusId &&
                member.classRefs.includes(record.classRef) &&
                member.membershipId !== record.createdByMembershipId,
            );
            if (reviewer)
              listed.push(
                reviewProjection(
                  await recheckListed(transaction, record, reviewer, snapshots),
                  reviewer,
                  this.names,
                ),
              );
          }
          return { records: listed };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
  }

  public auditEvents(
    context: StaffDailyContext,
    reportId: string,
  ): Promise<StaffDailyResult<{ readonly events: readonly StaffDailyAuditEvent[] }>> {
    return execute(() =>
      this.prisma.$transaction(
        async (transaction) => {
          const reviewers = await resolveStaff(transaction, context, "daily:review");
          if (!reviewers.length) throw forbidden();
          const scopes = reviewers.flatMap((member) => {
            const where = reviewWhere(member);
            return where ? [where] : [];
          });
          if (!scopes.length) throw notFound();
          const report = await transaction.staffDailyReport.findFirst({
            where: { id: reportId, OR: scopes },
            select: {
              tenantId: true,
              campusId: true,
              classRef: true,
              createdByMembershipId: true,
            },
          });
          if (!report) throw notFound();
          const reviewer = reviewers.find(
            (member) =>
              member.access.scope.tenantId === report.tenantId &&
              member.access.scope.campusId === report.campusId &&
              member.classRefs.includes(report.classRef) &&
              member.membershipId !== report.createdByMembershipId,
          );
          if (!reviewer) throw notFound();
          const events = await transaction.staffDailyReportAuditEvent.findMany({
            where: {
              tenantId: report.tenantId,
              campusId: report.campusId,
              reportId,
            },
            include: {
              actorMembership: { include: { membership: { select: { userId: true } } } },
              initiatedByMembership: { include: { membership: { select: { userId: true } } } },
            },
            orderBy: { reportVersion: "asc" },
          });
          return {
            events: events.map((event) => ({
              action: event.action,
              reportVersion: event.reportVersion,
              actorLabel: event.actorMembership
                ? this.names.get(event.actorMembership.membership.userId) || "机构成员"
                : null,
              initiatedByLabel:
                this.names.get(event.initiatedByMembership.membership.userId) || "机构成员",
              occurredAt: event.occurredAt.toISOString(),
            })),
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
  }

  public review(
    context: StaffDailyContext,
    reportId: string,
    body: unknown,
  ): Promise<StaffDailyResult<unknown>> {
    return this.reviewAction(context, reportId, body, false);
  }

  public withdraw(
    context: StaffDailyContext,
    reportId: string,
    body: unknown,
  ): Promise<StaffDailyResult<unknown>> {
    return this.reviewAction(context, reportId, body, true);
  }

  private reviewAction(
    context: StaffDailyContext,
    reportId: string,
    body: unknown,
    withdraw: boolean,
  ): Promise<StaffDailyResult<unknown>> {
    return execute(async () => {
      if (!exactObject(body, withdraw ? ["version"] : ["version", "action"])) throw invalid();
      const { version } = versionInput({ version: body.version });
      const action = withdraw ? "RETURN" : body.action;
      if (action !== "CONFIRM" && action !== "RETURN") throw invalid();
      return this.prisma.$transaction(
        async (transaction) => {
          const reviewers = await resolveStaff(transaction, context, "daily:review");
          if (!reviewers.length) throw forbidden();
          const scopes = reviewers.flatMap((member) => {
            const where = reviewWhere(member);
            return where ? [where] : [];
          });
          if (!scopes.length) throw notFound();
          const record = await transaction.staffDailyReport.findFirst({
            where: { id: reportId, OR: scopes },
            include: dailyInclude,
          });
          if (!record) throw notFound();
          const reviewer = reviewers.find(
            (member) =>
              member.access.scope.tenantId === record.tenantId &&
              member.access.scope.campusId === record.campusId &&
              member.classRefs.includes(record.classRef) &&
              member.membershipId !== record.createdByMembershipId,
          );
          if (!reviewer) throw notFound();
          if (
            record.version !== version ||
            (withdraw
              ? record.status !== "CONFIRMED"
              : action === "CONFIRM"
                ? record.status !== "SUBMITTED"
                : !["SUBMITTED", "CONFIRMED"].includes(record.status))
          )
            throw conflict();
          if (
            action === "CONFIRM" &&
            !sourcesMatch(
              record,
              await sourceSnapshot(transaction, reviewer, record.classRef, record.date),
            )
          ) {
            await invalidate(transaction, record, reviewer);
            return conflict();
          }
          const where = reviewWhere(reviewer);
          if (!where) throw notFound();
          const changed = await transaction.staffDailyReport.updateMany({
            where: { ...where, id: reportId, version, status: record.status },
            data: {
              status: action === "CONFIRM" ? "CONFIRMED" : "RETURNED",
              reviewedByMembershipId: reviewer.membershipId,
              updatedByMembershipId: reviewer.membershipId,
              version: { increment: 1 },
            },
          });
          if (changed.count !== 1) throw conflict();
          const updated = await transaction.staffDailyReport.findFirstOrThrow({
            where: { ...where, id: reportId },
            include: dailyInclude,
          });
          await recordAudit(
            transaction,
            updated,
            withdraw
              ? "CONFIRMATION_WITHDRAWN"
              : action === "CONFIRM"
                ? "REVIEW_CONFIRMED"
                : "REVIEW_RETURNED",
            reviewer.membershipId,
            reviewer.membershipId,
          );
          return reviewProjection(updated, reviewer, this.names);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    });
  }

  public list(
    context: StaffDailyContext,
  ): Promise<
    StaffDailyResult<{ readonly records: readonly unknown[]; readonly canCreate: boolean }>
  > {
    return execute(() =>
      this.prisma.$transaction(
        async (transaction) => {
          const staff = await resolveStaff(transaction, context, "daily:read");
          if (!staff.length) throw forbidden();
          const scopes = staff.flatMap((member) => {
            const where = scopeWhere(member);
            return where ? [{ ...where, createdByMembershipId: member.membershipId }] : [];
          });
          const records = scopes.length
            ? await transaction.staffDailyReport.findMany({
                where: { OR: scopes },
                include: dailyInclude,
                orderBy: [{ date: "desc" }, { updatedAt: "desc" }],
              })
            : [];
          const listed = [];
          const snapshots = new Map<string, Sources>();
          for (const record of records) {
            const member = staff.find(
              (item) =>
                item.membershipId === record.createdByMembershipId &&
                item.access.scope.tenantId === record.tenantId &&
                item.access.scope.campusId === record.campusId,
            );
            if (member)
              listed.push(
                projection(await recheckListed(transaction, record, member, snapshots), member),
              );
          }
          return {
            records: listed,
            canCreate: staff.some(
              (member) =>
                member.classRefs.length === 1 &&
                member.access.capabilities.includes("daily:create"),
            ),
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
  }

  public create(context: StaffDailyContext, body: unknown): Promise<StaffDailyResult<unknown>> {
    return execute(async () => {
      const input = createInput(body);
      return this.prisma.$transaction(
        async (transaction) => {
          const staff = await resolveStaff(transaction, context, "daily:create");
          if (staff.length !== 1) throw forbidden();
          const member = staff[0];
          if (!member || member.classRefs.length !== 1) throw invalid();
          const classRef = member.classRefs[0];
          const campusId = member.access.scope.campusId;
          if (classRef === undefined || campusId === undefined) throw forbidden();
          const sources = await sourceSnapshot(
            transaction,
            member,
            classRef,
            dateValue(input.date),
          );
          const record = await transaction.staffDailyReport.create({
            data: {
              tenantId: member.access.scope.tenantId,
              campusId,
              classRef,
              date: dateValue(input.date),
              arrival: input.values.arrival,
              homework: input.values.homework,
              activity: input.values.activity,
              classroom: input.values.classroom,
              followUp: input.values.followUp,
              status: "DRAFT",
              version: 1,
              createdByMembershipId: member.membershipId,
              updatedByMembershipId: member.membershipId,
            },
          });
          await replaceSources(transaction, member, record.id, sources);
          const saved = await transaction.staffDailyReport.findFirstOrThrow({
            where: { tenantId: record.tenantId, campusId: record.campusId, id: record.id },
            include: dailyInclude,
          });
          await recordAudit(
            transaction,
            saved,
            "CREATED",
            member.membershipId,
            member.membershipId,
          );
          return projection(saved, member);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    });
  }

  public edit(
    context: StaffDailyContext,
    reportId: string,
    body: unknown,
  ): Promise<StaffDailyResult<unknown>> {
    return this.update(context, reportId, body, "edit");
  }

  public resubmit(
    context: StaffDailyContext,
    reportId: string,
    body: unknown,
  ): Promise<StaffDailyResult<unknown>> {
    return this.update(context, reportId, body, "resubmit");
  }

  private update(
    context: StaffDailyContext,
    reportId: string,
    body: unknown,
    action: "edit" | "resubmit",
  ): Promise<StaffDailyResult<unknown>> {
    return execute(async () => {
      const capability = action === "edit" ? "daily:create" : "daily:submit";
      const input = updateInput(body);
      return this.prisma.$transaction(
        async (transaction) => {
          const staff = await resolveStaff(transaction, context, capability);
          if (staff.length !== 1) throw forbidden();
          const member = staff[0];
          if (!member) throw forbidden();
          const record = await getRecord(transaction, member, reportId);
          if (record.version !== input.version) throw conflict();
          if (action === "edit" && record.status !== "DRAFT" && record.status !== "RETURNED")
            throw conflict();
          if (action === "resubmit" && record.status !== "RETURNED") throw conflict();
          const date = dateString(record.date);
          const sources = await sourceSnapshot(
            transaction,
            member,
            record.classRef,
            dateValue(date),
          );
          if (
            action === "resubmit" &&
            Object.values(sources).some((items) => items.some((source) => !source.valid))
          )
            throw conflict();
          const where = scopeWhere(member);
          if (!where) throw notFound();
          const changed = await transaction.staffDailyReport.updateMany({
            where: {
              ...where,
              id: reportId,
              version: input.version,
              createdByMembershipId: member.membershipId,
              status: action === "edit" ? { in: ["DRAFT", "RETURNED"] } : "RETURNED",
            },
            data: {
              arrival: input.values.arrival,
              homework: input.values.homework,
              activity: input.values.activity,
              classroom: input.values.classroom,
              followUp: input.values.followUp,
              status: action === "edit" ? "DRAFT" : "SUBMITTED",
              reviewedByMembershipId: null,
              updatedByMembershipId: member.membershipId,
              version: { increment: 1 },
            },
          });
          if (changed.count !== 1) throw conflict();
          await replaceSources(transaction, member, reportId, sources);
          const updated = await transaction.staffDailyReport.findFirstOrThrow({
            where: { ...where, id: reportId },
            include: dailyInclude,
          });
          await recordAudit(
            transaction,
            updated,
            action === "edit" ? "EDITED" : "RESUBMITTED",
            member.membershipId,
            member.membershipId,
          );
          return projection(updated, member);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    });
  }

  public submit(
    context: StaffDailyContext,
    reportId: string,
    body: unknown,
  ): Promise<StaffDailyResult<unknown>> {
    return execute(async () => {
      const input = versionInput(body);
      return this.prisma.$transaction(
        async (transaction) => {
          const staff = await resolveStaff(transaction, context, "daily:submit");
          if (staff.length !== 1) throw forbidden();
          const member = staff[0];
          if (!member) throw forbidden();
          const record = await getRecord(transaction, member, reportId);
          if (record.version !== input.version || record.status !== "DRAFT") throw conflict();
          if (
            !sourcesMatch(
              record,
              await sourceSnapshot(transaction, member, record.classRef, record.date),
            )
          ) {
            await invalidate(transaction, record, member);
            return conflict();
          }
          const where = scopeWhere(member);
          if (!where) throw notFound();
          const changed = await transaction.staffDailyReport.updateMany({
            where: {
              ...where,
              id: reportId,
              version: input.version,
              status: "DRAFT",
              createdByMembershipId: member.membershipId,
            },
            data: {
              status: "SUBMITTED",
              updatedByMembershipId: member.membershipId,
              version: { increment: 1 },
            },
          });
          if (changed.count !== 1) throw conflict();
          const updated = await transaction.staffDailyReport.findFirstOrThrow({
            where: { ...where, id: reportId },
            include: dailyInclude,
          });
          await recordAudit(
            transaction,
            updated,
            "SUBMITTED",
            member.membershipId,
            member.membershipId,
          );
          return projection(updated, member);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    });
  }
}
