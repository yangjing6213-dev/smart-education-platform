import type { IdentityCapability } from "@student-care/contracts";
import {
  ATTENDANCE_ACTIONS,
  type AttendanceAction,
  type AttendanceCorrectionInput,
  type AttendanceParentProjection,
  type AttendanceReviewInput,
  type AttendanceStaffProjection,
  type AttendanceStaffStudentProjection,
  type AttendanceTransitionInput,
  type AttendanceValues,
} from "@student-care/contracts";
import type { ScopeContext } from "@student-care/tenant";
import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";

export const ATTENDANCE_SERVICE = Symbol("ATTENDANCE_SERVICE");

export type AttendanceCapability = Extract<
  IdentityCapability,
  "attendance:write" | "attendance:review" | "attendance:read"
>;

export interface AttendanceScopeAccess {
  readonly scope: ScopeContext;
  readonly capabilities: readonly AttendanceCapability[];
}

export interface AttendanceContext {
  readonly scopes: readonly AttendanceScopeAccess[];
}

export type AttendanceErrorCode =
  | "NOT_FOUND_SCOPED"
  | "CONFLICT_STATE"
  | "VERSION_MISMATCH"
  | "VALIDATION_FAILED"
  | "FORBIDDEN_ACTOR";

export type AttendanceResult<T> =
  | { readonly ok: true; readonly data: T }
  | {
      readonly ok: false;
      readonly error: { readonly code: AttendanceErrorCode; readonly message: string };
    };

export interface AttendanceOperations {
  listStaffStudents(
    context: AttendanceContext,
  ): Promise<readonly AttendanceStaffStudentProjection[]>;
  listStaff(context: AttendanceContext): Promise<readonly AttendanceStaffProjection[]>;
  create(
    context: AttendanceContext,
    input: { readonly student_id: string; readonly service_date: string },
  ): Promise<AttendanceResult<AttendanceStaffProjection>>;
  getStaff(
    context: AttendanceContext,
    recordId: string,
  ): Promise<AttendanceResult<AttendanceStaffProjection>>;
  transition(
    context: AttendanceContext,
    recordId: string,
    input: AttendanceTransitionInput,
    action: "arrive" | "depart",
  ): Promise<AttendanceResult<AttendanceStaffProjection>>;
  requestCorrection(
    context: AttendanceContext,
    recordId: string,
    input: AttendanceCorrectionInput,
  ): Promise<AttendanceResult<AttendanceStaffProjection>>;
  reviewCorrection(
    context: AttendanceContext,
    recordId: string,
    input: AttendanceReviewInput,
  ): Promise<AttendanceResult<AttendanceStaffProjection>>;
  listParent(context: AttendanceContext): Promise<readonly AttendanceParentProjection[]>;
  getParent(
    context: AttendanceContext,
    recordId: string,
  ): Promise<AttendanceResult<AttendanceParentProjection>>;
}

type Database = PrismaClient | Prisma.TransactionClient;
type StaffScope = {
  readonly access: AttendanceScopeAccess;
  readonly membershipId: string;
  readonly classRefs: readonly string[];
};

const recordInclude = {
  student: { select: { displayRef: true } },
  corrections: { orderBy: { createdAt: "desc" as const }, take: 1 },
} as const;
type IncludedRecord = Prisma.AttendanceRecordGetPayload<{ include: typeof recordInclude }>;

class AttendanceFailure extends Error {
  public constructor(public readonly code: AttendanceErrorCode) {
    super(code);
  }
}

const notFound = () => new AttendanceFailure("NOT_FOUND_SCOPED");
const conflict = () => new AttendanceFailure("CONFLICT_STATE");
const stale = () => new AttendanceFailure("VERSION_MISMATCH");
const invalid = () => new AttendanceFailure("VALIDATION_FAILED");
const forbiddenActor = () => new AttendanceFailure("FORBIDDEN_ACTOR");

function isPrismaCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

function errorResult<T>(error: unknown): AttendanceResult<T> {
  if (error instanceof AttendanceFailure) {
    const messages: Record<AttendanceErrorCode, string> = {
      NOT_FOUND_SCOPED: "The attendance record was not found in the allowed scope.",
      CONFLICT_STATE: "The attendance record is not in a state that allows this action.",
      VERSION_MISMATCH: "The attendance record has changed. Refresh it and try again.",
      VALIDATION_FAILED: "The attendance request is invalid.",
      FORBIDDEN_ACTOR: "The correction requester cannot review their own request.",
    };
    return { ok: false, error: { code: error.code, message: messages[error.code] } };
  }
  if (isPrismaCode(error, "P2002")) return errorResult(conflict());
  if (isPrismaCode(error, "P2003")) return errorResult(notFound());
  if (isPrismaCode(error, "P2025")) return errorResult(stale());
  throw error;
}

function result<T>(data: T): AttendanceResult<T> {
  return { ok: true, data };
}

async function execute<T>(operation: () => Promise<T>): Promise<AttendanceResult<T>> {
  try {
    return result(await operation());
  } catch (error) {
    return errorResult(error);
  }
}

function isValidDate(value: string): boolean {
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

function isValidTime(value: unknown): value is string {
  return typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function isValidValues(value: AttendanceValues): boolean {
  if (value.status === "NOT_ARRIVED") {
    return value.arrival_time === null && value.departure_time === null;
  }
  if (value.status === "ARRIVED") {
    return isValidTime(value.arrival_time) && value.departure_time === null;
  }
  return (
    value.status === "DEPARTED" &&
    isValidTime(value.arrival_time) &&
    isValidTime(value.departure_time) &&
    value.departure_time >= value.arrival_time
  );
}

function dateString(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function requiredScopes(
  context: AttendanceContext,
  capability?: AttendanceCapability,
): readonly AttendanceScopeAccess[] {
  const staffCapabilities: readonly AttendanceCapability[] = [
    "attendance:write",
    "attendance:review",
  ];
  return context.scopes.filter(
    (access) =>
      access.scope.campusId !== undefined &&
      (capability === undefined
        ? staffCapabilities.some((item) => access.capabilities.includes(item))
        : access.capabilities.includes(capability)),
  );
}

function isInScope(
  access: AttendanceScopeAccess,
  row: { tenantId: string; campusId: string },
): boolean {
  return access.scope.tenantId === row.tenantId && access.scope.campusId === row.campusId;
}

async function staffScopes(
  database: Database,
  context: AttendanceContext,
  capability?: "attendance:write" | "attendance:review",
): Promise<readonly StaffScope[]> {
  const scopes: StaffScope[] = [];
  for (const access of requiredScopes(context, capability)) {
    const { tenantId, campusId, actorId } = access.scope;
    if (campusId === undefined) continue;
    const memberships = await database.membershipCampus.findMany({
      where: { tenantId, campusId, membership: { userId: actorId, status: "ACTIVE" } },
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

function staffWhere(scopes: readonly StaffScope[]) {
  return scopes.flatMap(({ access, classRefs }) => {
    const campusId = access.scope.campusId;
    if (campusId === undefined || classRefs.length === 0) return [];
    return [{ tenantId: access.scope.tenantId, campusId, classRef: { in: [...classRefs] } }];
  });
}

function actionList(
  row: IncludedRecord,
  correctionStatus: "PENDING" | "APPROVED" | "RETURNED" | null,
  scopes: readonly StaffScope[],
): readonly AttendanceAction[] {
  const actions = new Set<AttendanceAction>();
  for (const staff of scopes) {
    if (!isInScope(staff.access, row) || !staff.classRefs.includes(row.classRef)) continue;
    const canWrite = staff.access.capabilities.includes("attendance:write");
    const canReview = staff.access.capabilities.includes("attendance:review");
    if (canWrite && correctionStatus !== "PENDING") {
      if (row.status === "NOT_ARRIVED") actions.add("arrive");
      if (row.status === "ARRIVED") actions.add("depart");
      actions.add("correct");
    }
    if (
      canReview &&
      correctionStatus === "PENDING" &&
      row.corrections[0]?.requestedByMembershipId !== staff.membershipId
    ) {
      actions.add("approve");
      actions.add("return");
    }
  }
  return ATTENDANCE_ACTIONS.filter((action) => actions.has(action));
}

function staffProjection(
  row: IncludedRecord,
  scopes: readonly StaffScope[],
): AttendanceStaffProjection {
  const correctionStatus = row.corrections[0]?.status ?? null;
  return {
    id: row.id,
    student_id: row.studentId,
    student_display_ref: row.student.displayRef,
    class_ref: row.classRef,
    service_date: dateString(row.serviceDate),
    status: row.status,
    arrival_time: row.arrivalTime,
    departure_time: row.departureTime,
    corrected: row.corrected,
    version: row.version,
    correction_status: correctionStatus,
    actions: actionList(row, correctionStatus, scopes),
  };
}

function parentProjection(
  row: {
    readonly id: string;
    readonly serviceDate: Date;
    readonly status: AttendanceParentProjection["status"];
    readonly arrivalTime: string | null;
    readonly departureTime: string | null;
    readonly corrected: boolean;
  },
  confirmedLeave: boolean,
): AttendanceParentProjection {
  return {
    id: row.id,
    service_date: dateString(row.serviceDate),
    status: row.status,
    arrival_time: row.arrivalTime,
    departure_time: row.departureTime,
    corrected: row.corrected,
    confirmed_leave: confirmedLeave,
  };
}

async function staffRecord(
  database: Database,
  context: AttendanceContext,
  recordId: string,
  capability: "attendance:write" | "attendance:review",
) {
  const scopes = await staffScopes(database, context, capability);
  const where = staffWhere(scopes);
  if (where.length === 0) return undefined;
  const row = await database.attendanceRecord.findFirst({
    where: { id: recordId, OR: where },
    include: recordInclude,
  });
  if (row === null) return undefined;
  const access = scopes.find(
    (staff) =>
      isInScope(staff.access, row) &&
      staff.classRefs.includes(row.classRef) &&
      staff.access.capabilities.includes(capability),
  );
  return access === undefined ? undefined : { row, access, scopes };
}

async function addRevision(
  database: Database,
  row: {
    readonly tenantId: string;
    readonly campusId: string;
    readonly id: string;
    readonly version: number;
    readonly status: AttendanceStaffProjection["status"];
    readonly arrivalTime: string | null;
    readonly departureTime: string | null;
    readonly corrected: boolean;
    readonly updatedByMembershipId: string;
    readonly updatedAt: Date;
  },
  action:
    | "CREATED"
    | "ARRIVED"
    | "DEPARTED"
    | "CORRECTION_REQUESTED"
    | "CORRECTION_APPROVED"
    | "CORRECTION_RETURNED",
): Promise<void> {
  await database.attendanceRecordRevision.create({
    data: {
      tenantId: row.tenantId,
      campusId: row.campusId,
      attendanceRecordId: row.id,
      version: row.version,
      status: row.status,
      arrivalTime: row.arrivalTime,
      departureTime: row.departureTime,
      corrected: row.corrected,
      action,
      updatedByMembershipId: row.updatedByMembershipId,
      updatedAt: row.updatedAt,
    },
  });
}

export class PrismaAttendanceService implements AttendanceOperations {
  public constructor(private readonly prisma: PrismaClient) {}

  public async listStaffStudents(
    context: AttendanceContext,
  ): Promise<readonly AttendanceStaffStudentProjection[]> {
    const scopes = await staffScopes(this.prisma, context, "attendance:write");
    const where = staffWhere(scopes);
    if (where.length === 0) return [];
    const rows = await this.prisma.student.findMany({
      where: { status: "ACTIVE", OR: where },
      select: { id: true, displayRef: true, classRef: true },
      orderBy: [{ classRef: "asc" }, { displayRef: "asc" }],
    });
    return rows.map(({ id, displayRef, classRef }) => ({
      id,
      student_display_ref: displayRef,
      class_ref: classRef,
    }));
  }

  public async listStaff(
    context: AttendanceContext,
  ): Promise<readonly AttendanceStaffProjection[]> {
    const scopes = await staffScopes(this.prisma, context);
    const where = staffWhere(scopes);
    if (where.length === 0) return [];
    const rows = await this.prisma.attendanceRecord.findMany({
      where: { OR: where },
      include: recordInclude,
      orderBy: [{ serviceDate: "desc" }, { updatedAt: "desc" }],
    });
    return rows.map((row) => staffProjection(row, scopes));
  }

  public create(
    context: AttendanceContext,
    input: { readonly student_id: string; readonly service_date: string },
  ): Promise<AttendanceResult<AttendanceStaffProjection>> {
    return execute(() =>
      this.prisma.$transaction(async (transaction) => {
        if (!isValidDate(input.service_date)) throw invalid();
        const scopes = await staffScopes(transaction, context, "attendance:write");
        const allowedStudents = staffWhere(scopes);
        const student = await transaction.student.findFirst({
          where: { id: input.student_id, status: "ACTIVE", OR: allowedStudents },
        });
        if (student === null) throw notFound();
        const access = scopes.find(
          (staff) =>
            isInScope(staff.access, student) &&
            staff.classRefs.includes(student.classRef) &&
            staff.access.capabilities.includes("attendance:write"),
        );
        if (access === undefined) throw notFound();
        const now = new Date();
        const row = await transaction.attendanceRecord.create({
          data: {
            tenantId: student.tenantId,
            campusId: student.campusId,
            studentId: student.id,
            classRef: student.classRef,
            serviceDate: new Date(`${input.service_date}T00:00:00.000Z`),
            status: "NOT_ARRIVED",
            arrivalTime: null,
            departureTime: null,
            corrected: false,
            version: 1,
            recordedByMembershipId: access.membershipId,
            updatedByMembershipId: access.membershipId,
            updatedAt: now,
          },
          include: recordInclude,
        });
        await addRevision(transaction, row, "CREATED");
        return staffProjection(row, scopes);
      }),
    );
  }

  public getStaff(
    context: AttendanceContext,
    recordId: string,
  ): Promise<AttendanceResult<AttendanceStaffProjection>> {
    return execute(async () => {
      const scoped = await staffRecord(this.prisma, context, recordId, "attendance:write");
      const reviewerScoped =
        scoped ?? (await staffRecord(this.prisma, context, recordId, "attendance:review"));
      if (reviewerScoped === undefined) throw notFound();
      return staffProjection(reviewerScoped.row, reviewerScoped.scopes);
    });
  }

  public transition(
    context: AttendanceContext,
    recordId: string,
    input: AttendanceTransitionInput,
    action: "arrive" | "depart",
  ): Promise<AttendanceResult<AttendanceStaffProjection>> {
    return execute(() =>
      this.prisma.$transaction(async (transaction) => {
        if (!Number.isSafeInteger(input.version) || input.version < 1 || !isValidTime(input.time))
          throw invalid();
        const scoped = await staffRecord(transaction, context, recordId, "attendance:write");
        if (scoped === undefined) throw notFound();
        const { row, access, scopes } = scoped;
        if (row.version !== input.version) throw stale();
        if (row.corrections.some(({ status }) => status === "PENDING")) throw conflict();
        if (action === "arrive" && row.status !== "NOT_ARRIVED") throw conflict();
        if (action === "depart" && row.status !== "ARRIVED") throw conflict();
        const next = {
          status: action === "arrive" ? ("ARRIVED" as const) : ("DEPARTED" as const),
          arrivalTime: action === "arrive" ? input.time : row.arrivalTime,
          departureTime: action === "depart" ? input.time : null,
        };
        if (
          next.status === "DEPARTED" &&
          next.arrivalTime !== null &&
          next.departureTime !== null &&
          next.departureTime < next.arrivalTime
        )
          throw invalid();
        const updatedAt = new Date();
        const update = await transaction.attendanceRecord.updateMany({
          where: {
            tenantId: row.tenantId,
            campusId: row.campusId,
            id: row.id,
            version: input.version,
          },
          data: {
            ...next,
            version: { increment: 1 },
            updatedByMembershipId: access.membershipId,
            updatedAt,
          },
        });
        if (update.count !== 1) throw stale();
        const updated = await transaction.attendanceRecord.findFirstOrThrow({
          where: { tenantId: row.tenantId, campusId: row.campusId, id: row.id },
          include: recordInclude,
        });
        await addRevision(transaction, updated, action === "arrive" ? "ARRIVED" : "DEPARTED");
        return staffProjection(updated, scopes);
      }),
    );
  }

  public requestCorrection(
    context: AttendanceContext,
    recordId: string,
    input: AttendanceCorrectionInput,
  ): Promise<AttendanceResult<AttendanceStaffProjection>> {
    return execute(() =>
      this.prisma.$transaction(async (transaction) => {
        if (
          !Number.isSafeInteger(input.version) ||
          input.version < 1 ||
          !isValidValues(input.proposed)
        )
          throw invalid();
        const scoped = await staffRecord(transaction, context, recordId, "attendance:write");
        if (scoped === undefined) throw notFound();
        const { row, access, scopes } = scoped;
        if (row.version !== input.version) throw stale();
        if (row.corrections.some(({ status }) => status === "PENDING")) throw conflict();
        const original: AttendanceValues = {
          status: row.status,
          arrival_time: row.arrivalTime,
          departure_time: row.departureTime,
        };
        if (
          JSON.stringify(original) === JSON.stringify(input.proposed) ||
          !["TIME_ENTRY_ERROR", "EVENT_ENTRY_ERROR", "LATE_ENTRY"].includes(input.reason)
        )
          throw invalid();
        const updatedAt = new Date();
        const nextVersion = row.version + 1;
        const update = await transaction.attendanceRecord.updateMany({
          where: {
            tenantId: row.tenantId,
            campusId: row.campusId,
            id: row.id,
            version: input.version,
          },
          data: {
            version: { increment: 1 },
            updatedByMembershipId: access.membershipId,
            updatedAt,
          },
        });
        if (update.count !== 1) throw stale();
        await transaction.attendanceCorrection.create({
          data: {
            tenantId: row.tenantId,
            campusId: row.campusId,
            attendanceRecordId: row.id,
            studentId: row.studentId,
            serviceDate: row.serviceDate,
            requestedByMembershipId: access.membershipId,
            reason: input.reason,
            status: "PENDING",
            originalStatus: row.status,
            originalArrivalTime: row.arrivalTime,
            originalDepartureTime: row.departureTime,
            proposedStatus: input.proposed.status,
            proposedArrivalTime: input.proposed.arrival_time,
            proposedDepartureTime: input.proposed.departure_time,
            requestVersion: nextVersion,
            createdAt: updatedAt,
            updatedAt,
          },
        });
        const updated = await transaction.attendanceRecord.findFirstOrThrow({
          where: { tenantId: row.tenantId, campusId: row.campusId, id: row.id },
          include: recordInclude,
        });
        await addRevision(transaction, updated, "CORRECTION_REQUESTED");
        return staffProjection(updated, scopes);
      }),
    );
  }

  public reviewCorrection(
    context: AttendanceContext,
    recordId: string,
    input: AttendanceReviewInput,
  ): Promise<AttendanceResult<AttendanceStaffProjection>> {
    return execute(() =>
      this.prisma.$transaction(async (transaction) => {
        if (
          !Number.isSafeInteger(input.version) ||
          input.version < 1 ||
          (input.action !== "approve" && input.action !== "return")
        )
          throw invalid();
        const scoped = await staffRecord(transaction, context, recordId, "attendance:review");
        if (scoped === undefined) throw notFound();
        const { row, access, scopes } = scoped;
        if (row.version !== input.version) throw stale();
        const correction = await transaction.attendanceCorrection.findFirst({
          where: {
            tenantId: row.tenantId,
            campusId: row.campusId,
            attendanceRecordId: row.id,
            status: "PENDING",
          },
        });
        if (correction === null) throw conflict();
        if (correction.requestedByMembershipId === access.membershipId) throw forbiddenActor();
        const updatedAt = new Date();
        const update = await transaction.attendanceRecord.updateMany({
          where: {
            tenantId: row.tenantId,
            campusId: row.campusId,
            id: row.id,
            version: input.version,
          },
          data: {
            ...(input.action === "approve"
              ? {
                  status: correction.proposedStatus,
                  arrivalTime: correction.proposedArrivalTime,
                  departureTime: correction.proposedDepartureTime,
                  corrected: true,
                }
              : {}),
            version: { increment: 1 },
            updatedByMembershipId: access.membershipId,
            updatedAt,
          },
        });
        if (update.count !== 1) throw stale();
        const correctionUpdate = await transaction.attendanceCorrection.updateMany({
          where: {
            tenantId: row.tenantId,
            campusId: row.campusId,
            id: correction.id,
            status: "PENDING",
          },
          data: {
            status: input.action === "approve" ? "APPROVED" : "RETURNED",
            reviewedByMembershipId: access.membershipId,
            reviewedAt: updatedAt,
            updatedAt,
          },
        });
        if (correctionUpdate.count !== 1) throw conflict();
        const updated = await transaction.attendanceRecord.findFirstOrThrow({
          where: { tenantId: row.tenantId, campusId: row.campusId, id: row.id },
          include: recordInclude,
        });
        await addRevision(
          transaction,
          updated,
          input.action === "approve" ? "CORRECTION_APPROVED" : "CORRECTION_RETURNED",
        );
        return staffProjection(updated, scopes);
      }),
    );
  }

  public async listParent(
    context: AttendanceContext,
  ): Promise<readonly AttendanceParentProjection[]> {
    const parentScopes = context.scopes.filter(
      (access) =>
        access.scope.campusId !== undefined && access.capabilities.includes("attendance:read"),
    );
    const actorId = context.scopes[0]?.scope.actorId;
    if (parentScopes.length === 0 || actorId === undefined) return [];
    const relationships = await this.prisma.guardianRelationship.findMany({
      where: {
        guardianUserId: actorId,
        status: "ACTIVE",
        OR: parentScopes.map(({ scope }) => ({
          tenantId: scope.tenantId,
          campusId: scope.campusId!,
        })),
      },
      select: { tenantId: true, campusId: true, id: true, studentId: true },
    });
    if (relationships.length === 0) return [];
    const rows = await this.prisma.attendanceRecord.findMany({
      where: {
        OR: relationships.map(({ tenantId, campusId, studentId }) => ({
          tenantId,
          campusId,
          studentId,
        })),
      },
      orderBy: [{ serviceDate: "desc" }, { updatedAt: "desc" }],
    });
    const relationshipIdsByStudent = new Map<string, string[]>();
    for (const relationship of relationships) {
      const key = `${relationship.tenantId}:${relationship.campusId}:${relationship.studentId}`;
      const ids = relationshipIdsByStudent.get(key) ?? [];
      ids.push(relationship.id);
      relationshipIdsByStudent.set(key, ids);
    }
    const leaveRequests = await this.prisma.leaveRequest.findMany({
      where: {
        status: "CONFIRMED",
        OR: relationships.map(({ tenantId, campusId, studentId }) => ({
          tenantId,
          campusId,
          studentId,
        })),
      },
      select: {
        tenantId: true,
        campusId: true,
        studentId: true,
        guardianRelationshipId: true,
        startDate: true,
        endDate: true,
      },
    });
    return rows.map((row) => {
      const key = `${row.tenantId}:${row.campusId}:${row.studentId}`;
      const validRelationshipIds = relationshipIdsByStudent.get(key) ?? [];
      const serviceDate = dateString(row.serviceDate);
      const confirmedLeave = leaveRequests.some(
        (leave) =>
          leave.tenantId === row.tenantId &&
          leave.campusId === row.campusId &&
          leave.studentId === row.studentId &&
          validRelationshipIds.includes(leave.guardianRelationshipId) &&
          dateString(leave.startDate) <= serviceDate &&
          dateString(leave.endDate) >= serviceDate,
      );
      return parentProjection(row, confirmedLeave);
    });
  }

  public async getParent(
    context: AttendanceContext,
    recordId: string,
  ): Promise<AttendanceResult<AttendanceParentProjection>> {
    const row = (await this.listParent(context)).find((item) => item.id === recordId);
    return row === undefined ? errorResult(notFound()) : result(row);
  }
}
