import type {
  IdentityCapability,
  LeaveRequestAction,
  LeaveRequestCreateInput,
  LeaveRequestParentProjection,
  LeaveRequestResubmitInput,
  LeaveRequestReviewInput,
  LeaveRequestStaffProjection,
  LeaveRequestVersionInput,
} from "@student-care/contracts";
import { LEAVE_REASON_CATEGORIES } from "@student-care/contracts";
import type { ScopeContext } from "@student-care/tenant";
import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";

export const LEAVE_SERVICE = Symbol("LEAVE_SERVICE");

export type LeaveCapability = Extract<
  IdentityCapability,
  "leave:apply" | "leave:review" | "leave:read"
>;

export interface LeaveScopeAccess {
  readonly scope: ScopeContext;
  readonly capabilities: readonly LeaveCapability[];
}

export interface LeaveContext {
  readonly scopes: readonly LeaveScopeAccess[];
}

export type LeaveErrorCode =
  "NOT_FOUND_SCOPED" | "CONFLICT_STATE" | "VERSION_MISMATCH" | "VALIDATION_FAILED";

export type LeaveResult<T> =
  | { readonly ok: true; readonly data: T }
  | {
      readonly ok: false;
      readonly error: { readonly code: LeaveErrorCode; readonly message: string };
    };

export interface LeaveOperations {
  listParent(context: LeaveContext): Promise<readonly LeaveRequestParentProjection[]>;
  listStaff(context: LeaveContext): Promise<readonly LeaveRequestStaffProjection[]>;
  create(
    context: LeaveContext,
    input: LeaveRequestCreateInput,
  ): Promise<LeaveResult<LeaveRequestParentProjection>>;
  resubmit(
    context: LeaveContext,
    requestId: string,
    input: LeaveRequestResubmitInput,
  ): Promise<LeaveResult<LeaveRequestParentProjection>>;
  withdraw(
    context: LeaveContext,
    requestId: string,
    input: LeaveRequestVersionInput,
  ): Promise<LeaveResult<LeaveRequestParentProjection>>;
  acknowledge(
    context: LeaveContext,
    requestId: string,
    input: LeaveRequestVersionInput,
  ): Promise<LeaveResult<LeaveRequestParentProjection>>;
  review(
    context: LeaveContext,
    requestId: string,
    input: LeaveRequestReviewInput,
  ): Promise<LeaveResult<LeaveRequestStaffProjection>>;
}

type Database = PrismaClient | Prisma.TransactionClient;
type LeaveInclude = {
  readonly student: { readonly select: { readonly displayRef: true; readonly classRef: true } };
};
type LeaveRow = Prisma.LeaveRequestGetPayload<{ include: LeaveInclude }>;
type StaffScope = {
  readonly access: LeaveScopeAccess;
  readonly membershipId: string;
  readonly classRefs: readonly string[];
};

class LeaveFailure extends Error {
  public constructor(public readonly code: LeaveErrorCode) {
    super(code);
  }
}

const leaveInclude = { student: { select: { displayRef: true, classRef: true } } } as const;
const notFound = () => new LeaveFailure("NOT_FOUND_SCOPED");
const conflict = () => new LeaveFailure("CONFLICT_STATE");
const invalid = () => new LeaveFailure("VALIDATION_FAILED");
const stale = () => new LeaveFailure("VERSION_MISMATCH");

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasCode(value: unknown, code: string): boolean {
  return isRecord(value) && value.code === code;
}

function validUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

function validVersion(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function dateValue(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function dateString(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function parentScopes(context: LeaveContext, capability: "leave:apply" | "leave:read") {
  return context.scopes.filter(
    ({ scope, capabilities }) => scope.campusId !== undefined && capabilities.includes(capability),
  );
}

function staffScopesForCapability(context: LeaveContext) {
  return context.scopes.filter(
    ({ scope, capabilities }) =>
      scope.campusId !== undefined && capabilities.includes("leave:review"),
  );
}

async function staffScopes(
  database: Database,
  context: LeaveContext,
): Promise<readonly StaffScope[]> {
  const scopes: StaffScope[] = [];
  for (const access of staffScopesForCapability(context)) {
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
    return [
      {
        tenantId: access.scope.tenantId,
        campusId,
        student: { is: { classRef: { in: [...classRefs] } } },
      },
    ];
  });
}

async function activeRelationships(
  database: Database,
  actorId: string,
  scopes: readonly LeaveScopeAccess[],
  studentId?: string,
) {
  const visibleScopes = scopes.flatMap(({ scope }) => {
    const campusId = scope.campusId;
    return campusId === undefined ? [] : [{ tenantId: scope.tenantId, campusId }];
  });
  if (visibleScopes.length === 0) return [];
  return database.guardianRelationship.findMany({
    where: {
      guardianUserId: actorId,
      status: "ACTIVE",
      ...(studentId === undefined ? {} : { studentId }),
      OR: visibleScopes,
    },
    select: { tenantId: true, campusId: true, id: true, studentId: true },
  });
}

async function parentMembershipId(
  database: Database,
  actorId: string,
  tenantId: string,
  campusId: string,
): Promise<string | undefined> {
  const memberships = await database.membershipCampus.findMany({
    where: { tenantId, campusId, membership: { userId: actorId, status: "ACTIVE" } },
    select: { membershipId: true },
  });
  return memberships.length === 1 ? memberships[0]?.membershipId : undefined;
}

async function noOverlap(
  database: Database,
  values: {
    readonly tenantId: string;
    readonly campusId: string;
    readonly studentId: string;
    readonly startDate: Date;
    readonly endDate: Date;
    readonly excludeId?: string;
  },
): Promise<void> {
  const existing = await database.leaveRequest.findFirst({
    where: {
      tenantId: values.tenantId,
      campusId: values.campusId,
      studentId: values.studentId,
      status: { in: ["SUBMITTED", "RETURNED", "CONFIRMED"] },
      startDate: { lte: values.endDate },
      endDate: { gte: values.startDate },
      ...(values.excludeId === undefined ? {} : { id: { not: values.excludeId } }),
    },
    select: { id: true },
  });
  if (existing !== null) throw conflict();
}

function parentActions(row: LeaveRow): readonly LeaveRequestAction[] {
  const actions = new Set<LeaveRequestAction>();
  if (row.status === "SUBMITTED" || row.status === "RETURNED") actions.add("withdraw");
  if (row.status === "RETURNED") actions.add("resubmit");
  if ((row.status === "RETURNED" || row.status === "CONFIRMED") && !row.acknowledged) {
    actions.add("acknowledge");
  }
  const ordered: readonly LeaveRequestAction[] = [
    "resubmit",
    "withdraw",
    "acknowledge",
    "confirm",
    "return",
  ];
  return ordered.filter((action) => actions.has(action));
}

function parentProjection(row: LeaveRow): LeaveRequestParentProjection {
  return {
    id: row.id,
    student_id: row.studentId,
    student_display_ref: row.student.displayRef,
    start_date: dateString(row.startDate),
    end_date: dateString(row.endDate),
    reason_category: row.reasonCategory,
    status: row.status,
    version: row.version,
    acknowledged: row.acknowledged,
    actions: parentActions(row),
    updated_at: row.updatedAt.toISOString(),
  };
}

function staffProjection(row: LeaveRow): LeaveRequestStaffProjection {
  const actions: readonly LeaveRequestAction[] =
    row.status === "SUBMITTED" ? ["confirm", "return"] : [];
  return { ...parentProjection(row), class_ref: row.student.classRef, actions };
}

async function addRevision(
  database: Database,
  row: {
    readonly tenantId: string;
    readonly campusId: string;
    readonly id: string;
    readonly version: number;
    readonly startDate: Date;
    readonly endDate: Date;
    readonly reasonCategory: LeaveRow["reasonCategory"];
    readonly status: LeaveRow["status"];
    readonly acknowledged: boolean;
  },
  updatedByMembershipId: string,
  updatedAt: Date,
): Promise<void> {
  await database.leaveRequestRevision.create({
    data: {
      tenantId: row.tenantId,
      campusId: row.campusId,
      leaveRequestId: row.id,
      version: row.version,
      startDate: row.startDate,
      endDate: row.endDate,
      reasonCategory: row.reasonCategory,
      status: row.status,
      acknowledged: row.acknowledged,
      updatedByMembershipId,
      updatedAt,
    },
  });
}

function operationError(error: LeaveFailure) {
  return { ok: false as const, error: { code: error.code, message: error.message } };
}

export class PrismaLeaveService implements LeaveOperations {
  public constructor(private readonly prisma: PrismaClient) {}

  private async execute<T>(operation: () => Promise<T>): Promise<LeaveResult<T>> {
    try {
      return { ok: true, data: await operation() };
    } catch (error) {
      if (error instanceof LeaveFailure) return operationError(error);
      if (hasCode(error, "P2034") || hasCode(error, "P2002")) return operationError(conflict());
      throw error;
    }
  }

  private transact<T>(operation: (transaction: Prisma.TransactionClient) => Promise<T>) {
    return this.execute(() =>
      this.prisma.$transaction(operation, { isolationLevel: "Serializable" }),
    );
  }

  public async listParent(context: LeaveContext): Promise<readonly LeaveRequestParentProjection[]> {
    const scopes = parentScopes(context, "leave:read");
    const actorId = context.scopes[0]?.scope.actorId;
    if (scopes.length === 0 || actorId === undefined) return [];
    const relationships = await activeRelationships(this.prisma, actorId, scopes);
    if (relationships.length === 0) return [];
    const relationshipIds = new Set(
      relationships.map(({ tenantId, campusId, id }) => `${tenantId}:${campusId}:${id}`),
    );
    const rows = await this.prisma.leaveRequest.findMany({
      where: {
        OR: relationships.map(({ tenantId, campusId, id }) => ({
          tenantId,
          campusId,
          guardianRelationshipId: id,
          requesterUserId: actorId,
        })),
      },
      include: leaveInclude,
      orderBy: [{ startDate: "desc" }, { updatedAt: "desc" }],
    });
    return rows
      .filter((row) =>
        relationshipIds.has(`${row.tenantId}:${row.campusId}:${row.guardianRelationshipId}`),
      )
      .map(parentProjection);
  }

  public async listStaff(context: LeaveContext): Promise<readonly LeaveRequestStaffProjection[]> {
    const scopes = await staffScopes(this.prisma, context);
    const where = staffWhere(scopes);
    if (where.length === 0) return [];
    const rows = await this.prisma.leaveRequest.findMany({
      where: { status: "SUBMITTED", OR: where },
      include: leaveInclude,
      orderBy: [{ startDate: "asc" }, { updatedAt: "asc" }],
    });
    return rows.map(staffProjection);
  }

  public create(
    context: LeaveContext,
    input: LeaveRequestCreateInput,
  ): Promise<LeaveResult<LeaveRequestParentProjection>> {
    return this.transact(async (transaction) => {
      if (
        !validUuid(input.student_id) ||
        !validDate(input.start_date) ||
        !validDate(input.end_date) ||
        input.start_date > input.end_date ||
        !LEAVE_REASON_CATEGORIES.includes(input.reason_category)
      ) {
        throw invalid();
      }
      const scopes = parentScopes(context, "leave:apply");
      const actorId = context.scopes[0]?.scope.actorId;
      if (scopes.length === 0 || actorId === undefined) throw notFound();
      const relationships = await activeRelationships(
        transaction,
        actorId,
        scopes,
        input.student_id,
      );
      if (relationships.length !== 1) throw notFound();
      const relationship = relationships[0];
      if (relationship === undefined) throw notFound();
      const student = await transaction.student.findFirst({
        where: {
          id: input.student_id,
          tenantId: relationship.tenantId,
          campusId: relationship.campusId,
          status: "ACTIVE",
        },
        select: { id: true },
      });
      if (student === null) throw notFound();
      const membershipId = await parentMembershipId(
        transaction,
        actorId,
        relationship.tenantId,
        relationship.campusId,
      );
      if (membershipId === undefined) throw notFound();
      const startDate = dateValue(input.start_date);
      const endDate = dateValue(input.end_date);
      await noOverlap(transaction, {
        tenantId: relationship.tenantId,
        campusId: relationship.campusId,
        studentId: student.id,
        startDate,
        endDate,
      });
      const now = new Date();
      const row = await transaction.leaveRequest.create({
        data: {
          tenantId: relationship.tenantId,
          campusId: relationship.campusId,
          studentId: student.id,
          guardianRelationshipId: relationship.id,
          requesterUserId: actorId,
          startDate,
          endDate,
          reasonCategory: input.reason_category,
          status: "SUBMITTED",
          version: 1,
          acknowledged: false,
          updatedByMembershipId: membershipId,
          updatedAt: now,
        },
        include: leaveInclude,
      });
      await addRevision(transaction, row, membershipId, now);
      return parentProjection(row);
    });
  }

  private async parentRecord(
    database: Database,
    context: LeaveContext,
    requestId: string,
  ): Promise<
    { readonly row: LeaveRow; readonly actorId: string; readonly membershipId: string } | undefined
  > {
    const scopes = parentScopes(context, "leave:apply");
    const actorId = context.scopes[0]?.scope.actorId;
    if (scopes.length === 0 || actorId === undefined) return undefined;
    const relationships = await activeRelationships(database, actorId, scopes);
    if (relationships.length === 0) return undefined;
    const row = await database.leaveRequest.findFirst({
      where: {
        id: requestId,
        requesterUserId: actorId,
        OR: relationships.map(({ tenantId, campusId, id }) => ({
          tenantId,
          campusId,
          guardianRelationshipId: id,
        })),
      },
      include: leaveInclude,
    });
    if (row === null) return undefined;
    const membershipId = await parentMembershipId(database, actorId, row.tenantId, row.campusId);
    return membershipId === undefined ? undefined : { row, actorId, membershipId };
  }

  public resubmit(
    context: LeaveContext,
    requestId: string,
    input: LeaveRequestResubmitInput,
  ): Promise<LeaveResult<LeaveRequestParentProjection>> {
    return this.transact(async (transaction) => {
      if (
        !validUuid(requestId) ||
        !validVersion(input.version) ||
        !validDate(input.start_date) ||
        !validDate(input.end_date) ||
        input.start_date > input.end_date ||
        !LEAVE_REASON_CATEGORIES.includes(input.reason_category)
      ) {
        throw invalid();
      }
      const current = await this.parentRecord(transaction, context, requestId);
      if (current === undefined) throw notFound();
      const { row, membershipId } = current;
      if (row.version !== input.version) throw stale();
      if (row.status !== "RETURNED") throw conflict();
      const startDate = dateValue(input.start_date);
      const endDate = dateValue(input.end_date);
      await noOverlap(transaction, {
        tenantId: row.tenantId,
        campusId: row.campusId,
        studentId: row.studentId,
        startDate,
        endDate,
        excludeId: row.id,
      });
      const now = new Date();
      const updated = await transaction.leaveRequest.updateMany({
        where: {
          tenantId: row.tenantId,
          campusId: row.campusId,
          id: row.id,
          version: row.version,
          status: "RETURNED",
        },
        data: {
          startDate,
          endDate,
          reasonCategory: input.reason_category,
          status: "SUBMITTED",
          version: row.version + 1,
          acknowledged: false,
          updatedByMembershipId: membershipId,
          updatedAt: now,
        },
      });
      if (updated.count !== 1) throw stale();
      const next = {
        ...row,
        startDate,
        endDate,
        reasonCategory: input.reason_category,
        status: "SUBMITTED" as const,
        version: row.version + 1,
        acknowledged: false,
        updatedAt: now,
      };
      await addRevision(transaction, next, membershipId, now);
      return parentProjection(next);
    });
  }

  private async changeParentState(
    context: LeaveContext,
    requestId: string,
    input: LeaveRequestVersionInput,
    action: "withdraw" | "acknowledge",
  ): Promise<LeaveResult<LeaveRequestParentProjection>> {
    return this.transact(async (transaction) => {
      if (!validUuid(requestId) || !validVersion(input.version)) throw invalid();
      const current = await this.parentRecord(transaction, context, requestId);
      if (current === undefined) throw notFound();
      const { row, membershipId } = current;
      if (row.version !== input.version) throw stale();
      if (action === "withdraw" && row.status !== "SUBMITTED" && row.status !== "RETURNED") {
        throw conflict();
      }
      if (
        action === "acknowledge" &&
        ((row.status !== "CONFIRMED" && row.status !== "RETURNED") || row.acknowledged)
      ) {
        throw conflict();
      }
      const now = new Date();
      const status: LeaveRow["status"] = action === "withdraw" ? "WITHDRAWN" : row.status;
      const acknowledged = action === "acknowledge" ? true : row.acknowledged;
      const updated = await transaction.leaveRequest.updateMany({
        where: {
          tenantId: row.tenantId,
          campusId: row.campusId,
          id: row.id,
          version: row.version,
          status: row.status,
        },
        data: {
          status,
          acknowledged,
          version: row.version + 1,
          updatedByMembershipId: membershipId,
          updatedAt: now,
        },
      });
      if (updated.count !== 1) throw stale();
      const next = { ...row, status, acknowledged, version: row.version + 1, updatedAt: now };
      await addRevision(transaction, next, membershipId, now);
      return parentProjection(next);
    });
  }

  public withdraw(
    context: LeaveContext,
    requestId: string,
    input: LeaveRequestVersionInput,
  ): Promise<LeaveResult<LeaveRequestParentProjection>> {
    return this.changeParentState(context, requestId, input, "withdraw");
  }

  public acknowledge(
    context: LeaveContext,
    requestId: string,
    input: LeaveRequestVersionInput,
  ): Promise<LeaveResult<LeaveRequestParentProjection>> {
    return this.changeParentState(context, requestId, input, "acknowledge");
  }

  public review(
    context: LeaveContext,
    requestId: string,
    input: LeaveRequestReviewInput,
  ): Promise<LeaveResult<LeaveRequestStaffProjection>> {
    return this.transact(async (transaction) => {
      if (
        !validUuid(requestId) ||
        !validVersion(input.version) ||
        (input.action !== "confirm" && input.action !== "return")
      ) {
        throw invalid();
      }
      const scopes = await staffScopes(transaction, context);
      const where = staffWhere(scopes);
      if (where.length === 0) throw notFound();
      const row = await transaction.leaveRequest.findFirst({
        where: { id: requestId, OR: where },
        include: leaveInclude,
      });
      if (row === null) throw notFound();
      const scope = scopes.find(
        ({ access, classRefs }) =>
          access.scope.tenantId === row.tenantId &&
          access.scope.campusId === row.campusId &&
          classRefs.includes(row.student.classRef),
      );
      if (scope === undefined) throw notFound();
      if (row.version !== input.version) throw stale();
      if (row.status !== "SUBMITTED") throw conflict();
      const now = new Date();
      const status: LeaveRow["status"] = input.action === "confirm" ? "CONFIRMED" : "RETURNED";
      const updated = await transaction.leaveRequest.updateMany({
        where: {
          tenantId: row.tenantId,
          campusId: row.campusId,
          id: row.id,
          version: row.version,
          status: "SUBMITTED",
        },
        data: {
          status,
          acknowledged: false,
          version: row.version + 1,
          updatedByMembershipId: scope.membershipId,
          updatedAt: now,
        },
      });
      if (updated.count !== 1) throw stale();
      const next = {
        ...row,
        status,
        acknowledged: false,
        version: row.version + 1,
        updatedAt: now,
      };
      await addRevision(transaction, next, scope.membershipId, now);
      return staffProjection(next);
    });
  }
}
