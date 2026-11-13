import type { IdentityCapability } from "@student-care/contracts";
import {
  CARE_ACTIVITIES,
  CARE_ARRIVALS,
  CARE_HOMEWORK,
  CARE_MEALS,
  CARE_RECORD_ACTIONS,
  CARE_RESTS,
  CARE_WELLBEING,
  type CareRecordAction,
  type CareRecordCreateInput,
  type CareRecordParentProjection,
  type CareRecordReceiptInput,
  type CareRecordReviewInput,
  type CareRecordStudentProjection,
  type CareRecordStaffProjection,
  type CareRecordUpdateInput,
  type CareRecordValues,
} from "@student-care/contracts";
import type { ScopeContext } from "@student-care/tenant";
import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import {
  careSourcesFresh,
  currentCareSources,
  frozenCareSources,
  saveCareSources,
} from "./care-record-sources.js";

export const CARE_RECORD_SERVICE = Symbol("CARE_RECORD_SERVICE");

export type CareRecordCapability = Extract<
  IdentityCapability,
  "care:write" | "care:review" | "care:publish" | "care:read"
>;

export interface CareRecordScopeAccess {
  readonly scope: ScopeContext;
  readonly capabilities: readonly CareRecordCapability[];
}

export interface CareRecordContext {
  readonly scopes: readonly CareRecordScopeAccess[];
}

export type CareRecordErrorCode =
  "NOT_FOUND_SCOPED" | "CONFLICT_STATE" | "VERSION_MISMATCH" | "VALIDATION_FAILED";

export type CareRecordResult<T> =
  | { readonly ok: true; readonly data: T }
  | {
      readonly ok: false;
      readonly error: { readonly code: CareRecordErrorCode; readonly message: string };
    };

export interface CareRecordOperations {
  listStaffStudents(context: CareRecordContext): Promise<readonly CareRecordStudentProjection[]>;
  listStaff(context: CareRecordContext): Promise<readonly CareRecordStaffProjection[]>;
  create(
    context: CareRecordContext,
    input: CareRecordCreateInput,
  ): Promise<CareRecordResult<CareRecordStaffProjection>>;
  getStaff(
    context: CareRecordContext,
    recordId: string,
  ): Promise<CareRecordResult<CareRecordStaffProjection>>;
  update(
    context: CareRecordContext,
    recordId: string,
    input: CareRecordUpdateInput,
  ): Promise<CareRecordResult<CareRecordStaffProjection>>;
  submit(
    context: CareRecordContext,
    recordId: string,
    input: { readonly version: number },
  ): Promise<CareRecordResult<CareRecordStaffProjection>>;
  resubmit(
    context: CareRecordContext,
    recordId: string,
    input: CareRecordUpdateInput,
  ): Promise<CareRecordResult<CareRecordStaffProjection>>;
  review(
    context: CareRecordContext,
    recordId: string,
    input: CareRecordReviewInput,
  ): Promise<CareRecordResult<CareRecordStaffProjection>>;
  publish(
    context: CareRecordContext,
    recordId: string,
    input: { readonly version: number },
  ): Promise<CareRecordResult<CareRecordStaffProjection>>;
  withdraw(
    context: CareRecordContext,
    recordId: string,
    input: { readonly version: number },
  ): Promise<CareRecordResult<CareRecordStaffProjection>>;
  revokePublication(
    context: CareRecordContext,
    recordId: string,
    input: { readonly version: number },
  ): Promise<CareRecordResult<CareRecordStaffProjection>>;
  listParent(context: CareRecordContext): Promise<readonly CareRecordParentProjection[]>;
  getParent(
    context: CareRecordContext,
    recordId: string,
  ): Promise<CareRecordResult<CareRecordParentProjection>>;
  receipt(
    context: CareRecordContext,
    recordId: string,
    input: CareRecordReceiptInput,
  ): Promise<CareRecordResult<CareRecordParentProjection>>;
}

type Database = PrismaClient | Prisma.TransactionClient;
type StaffScope = {
  readonly access: CareRecordScopeAccess;
  readonly membershipId: string;
  readonly classRefs: readonly string[];
};

class CareRecordFailure extends Error {
  public constructor(public readonly code: CareRecordErrorCode) {
    super(code);
  }
}

const notFound = () => new CareRecordFailure("NOT_FOUND_SCOPED");
const conflict = () => new CareRecordFailure("CONFLICT_STATE");
const invalid = () => new CareRecordFailure("VALIDATION_FAILED");
const stale = () => new CareRecordFailure("VERSION_MISMATCH");

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return (
    isRecord(value) &&
    Object.keys(value).length === keys.length &&
    Object.keys(value).every((key) => keys.includes(key))
  );
}

function validValues(value: unknown): value is CareRecordValues {
  if (!exactKeys(value, ["arrival", "homework", "meal", "rest", "activity", "wellbeing"])) {
    return false;
  }
  return (
    CARE_ARRIVALS.includes(value.arrival as (typeof CARE_ARRIVALS)[number]) &&
    CARE_HOMEWORK.includes(value.homework as (typeof CARE_HOMEWORK)[number]) &&
    CARE_MEALS.includes(value.meal as (typeof CARE_MEALS)[number]) &&
    CARE_RESTS.includes(value.rest as (typeof CARE_RESTS)[number]) &&
    CARE_ACTIVITIES.includes(value.activity as (typeof CARE_ACTIVITIES)[number]) &&
    CARE_WELLBEING.includes(value.wellbeing as (typeof CARE_WELLBEING)[number])
  );
}

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validVersion(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

function dateString(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function staffProjection(
  row: {
    readonly id: string;
    readonly studentId: string;
    readonly classRef: string;
    readonly serviceDate: Date;
    readonly arrival: CareRecordValues["arrival"];
    readonly homework: CareRecordValues["homework"];
    readonly meal: CareRecordValues["meal"];
    readonly rest: CareRecordValues["rest"];
    readonly activity: CareRecordValues["activity"];
    readonly wellbeing: CareRecordValues["wellbeing"];
    readonly status: CareRecordStaffProjection["status"];
    readonly version: number;
    readonly published: boolean;
    readonly publicationVersion: number;
    readonly updatedAt: Date;
    readonly student: { readonly displayRef: string };
  },
  actions: readonly CareRecordAction[] = [],
): CareRecordStaffProjection {
  return {
    id: row.id,
    student_id: row.studentId,
    student_display_ref: row.student.displayRef,
    class_ref: row.classRef,
    service_date: dateString(row.serviceDate),
    values: {
      arrival: row.arrival,
      homework: row.homework,
      meal: row.meal,
      rest: row.rest,
      activity: row.activity,
      wellbeing: row.wellbeing,
    },
    status: row.status,
    version: row.version,
    published: row.published,
    publication_version: row.publicationVersion,
    updated_at: row.updatedAt.toISOString(),
    actions,
  };
}

function parentProjection(row: {
  readonly id: string;
  readonly serviceDate: Date;
  readonly arrival: CareRecordValues["arrival"];
  readonly homework: CareRecordValues["homework"];
  readonly meal: CareRecordValues["meal"];
  readonly rest: CareRecordValues["rest"];
  readonly activity: CareRecordValues["activity"];
  readonly wellbeing: CareRecordValues["wellbeing"];
  readonly version: number;
  readonly publicationVersion: number;
  readonly student: {
    readonly displayRef: string;
    readonly guardianRelationships: readonly { readonly id: string }[];
  };
  readonly receipts: readonly {
    readonly guardianRelationshipId: string;
    readonly publicationVersion: number;
    readonly status: "UNREAD" | "READ" | "ACKNOWLEDGED";
  }[];
}): CareRecordParentProjection {
  const activeRelationship = row.student.guardianRelationships[0];
  const receipt = row.receipts.find(
    (item) =>
      item.guardianRelationshipId === activeRelationship?.id &&
      item.publicationVersion === row.publicationVersion,
  );
  return {
    id: row.id,
    student_display_ref: row.student.displayRef,
    service_date: dateString(row.serviceDate),
    values: {
      arrival: row.arrival,
      homework: row.homework,
      meal: row.meal,
      rest: row.rest,
      activity: row.activity,
      wellbeing: row.wellbeing,
    },
    version: row.version,
    publication_version: row.publicationVersion,
    receipt_status: receipt?.status ?? "UNREAD",
  };
}

function isPrismaCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

function result<T>(data: T | CareRecordFailure): CareRecordResult<T> {
  return data instanceof CareRecordFailure ? errorResult(data) : { ok: true, data };
}

function errorResult<T>(error: unknown): CareRecordResult<T> {
  if (error instanceof CareRecordFailure) {
    const messages: Record<CareRecordErrorCode, string> = {
      NOT_FOUND_SCOPED: "The care record was not found in the allowed scope.",
      CONFLICT_STATE: "The care record is not in a state that allows this action.",
      VERSION_MISMATCH: "The care record has changed. Refresh it and try again.",
      VALIDATION_FAILED: "The request is invalid.",
    };
    return { ok: false, error: { code: error.code, message: messages[error.code] } };
  }
  if (isPrismaCode(error, "P2002")) return errorResult(conflict());
  if (isPrismaCode(error, "P2003")) return errorResult(notFound());
  throw error;
}

function requiredScopes(
  context: CareRecordContext,
  capability?: CareRecordCapability,
): readonly CareRecordScopeAccess[] {
  const staffCapabilities: readonly CareRecordCapability[] = [
    "care:write",
    "care:review",
    "care:publish",
  ];
  return context.scopes.filter(
    (access) =>
      access.scope.campusId !== undefined &&
      (capability === undefined
        ? staffCapabilities.some((item) => access.capabilities.includes(item))
        : access.capabilities.includes(capability)),
  );
}

function isInScope(access: CareRecordScopeAccess, row: { tenantId: string; campusId: string }) {
  return access.scope.tenantId === row.tenantId && access.scope.campusId === row.campusId;
}

async function staffScopes(
  database: Database,
  context: CareRecordContext,
  capability?: "care:write" | "care:review" | "care:publish",
): Promise<readonly StaffScope[]> {
  const accesses = requiredScopes(context, capability);
  const scopes: StaffScope[] = [];
  for (const access of accesses) {
    const { tenantId, campusId } = access.scope;
    if (campusId === undefined) continue;
    const memberships = await database.membershipCampus.findMany({
      where: {
        tenantId,
        campusId,
        membership: { userId: access.scope.actorId, status: "ACTIVE" },
      },
      select: { membershipId: true, classAssignments: { select: { classRef: true } } },
    });
    if (memberships.length !== 1) continue;
    const membership = memberships[0];
    if (membership === undefined) continue;
    scopes.push({
      access,
      membershipId: membership.membershipId,
      classRefs: membership.classAssignments.map((assignment) => assignment.classRef),
    });
  }
  return scopes;
}

function staffWhere(
  scopes: readonly StaffScope[],
  capability?: "care:write" | "care:review" | "care:publish",
) {
  return scopes.flatMap((staff) => {
    if (staff.access.scope.campusId === undefined || staff.classRefs.length === 0) return [];
    const hasSharedRead =
      staff.access.capabilities.includes("care:review") ||
      staff.access.capabilities.includes("care:publish");
    if (capability !== undefined && !staff.access.capabilities.includes(capability)) return [];
    if (hasSharedRead) {
      return [
        {
          tenantId: staff.access.scope.tenantId,
          campusId: staff.access.scope.campusId,
          classRef: { in: [...staff.classRefs] },
        },
      ];
    }
    return [
      {
        tenantId: staff.access.scope.tenantId,
        campusId: staff.access.scope.campusId,
        classRef: { in: [...staff.classRefs] },
        createdByMembershipId: staff.membershipId,
      },
    ];
  });
}

function publishedHistoryWhere(scopes: readonly StaffScope[]) {
  return scopes.flatMap((staff) =>
    staff.access.scope.campusId === undefined ||
    staff.classRefs.length === 0 ||
    !["care:write", "care:review", "care:publish"].some((capability) =>
      staff.access.capabilities.includes(capability as CareRecordCapability),
    )
      ? []
      : [
          {
            tenantId: staff.access.scope.tenantId,
            campusId: staff.access.scope.campusId,
            status: "CONFIRMED" as const,
            published: true,
            publicationVersion: { gt: 0 },
            student: {
              status: "ACTIVE" as const,
              classRef: { in: [...staff.classRefs] },
            },
          },
        ],
  );
}

function historicalReadAccess(
  row: {
    readonly tenantId: string;
    readonly campusId: string;
    readonly classRef: string;
    readonly status: CareRecordStaffProjection["status"];
    readonly published: boolean;
    readonly publicationVersion: number;
    readonly student: { readonly status: string; readonly classRef: string };
  },
  scopes: readonly StaffScope[],
) {
  if (
    row.student.status !== "ACTIVE" ||
    row.student.classRef === row.classRef ||
    row.status !== "CONFIRMED" ||
    !row.published ||
    row.publicationVersion < 1
  )
    return undefined;
  return scopes.find(
    (staff) =>
      isInScope(staff.access, row) &&
      staff.classRefs.includes(row.student.classRef) &&
      ["care:write", "care:review", "care:publish"].some((capability) =>
        staff.access.capabilities.includes(capability as CareRecordCapability),
      ),
  );
}

async function staffRecord(
  database: Database,
  context: CareRecordContext,
  recordId: string,
  capability?: "care:write" | "care:review" | "care:publish",
) {
  const scopes = await staffScopes(database, context, capability);
  const where = staffWhere(scopes, capability);
  const history = capability === undefined ? publishedHistoryWhere(scopes) : [];
  if (where.length === 0 && history.length === 0) return undefined;
  const row = await database.careRecord.findFirst({
    where: { id: recordId, OR: [...where, ...history] },
    include: { student: { select: { displayRef: true, status: true, classRef: true } } },
  });
  if (row === null) return undefined;
  const access = scopes.find(
    (staff) =>
      isInScope(staff.access, row) &&
      staff.classRefs.includes(row.classRef) &&
      row.student.status === "ACTIVE" &&
      row.student.classRef === row.classRef &&
      (capability !== undefined ||
        staff.access.capabilities.includes("care:review") ||
        staff.access.capabilities.includes("care:publish") ||
        row.createdByMembershipId === staff.membershipId) &&
      (capability === undefined || staff.access.capabilities.includes(capability)),
  );
  if (access !== undefined) return { row, access, historical: false };
  const historicalAccess = capability === undefined ? historicalReadAccess(row, scopes) : undefined;
  return historicalAccess === undefined
    ? undefined
    : { row, access: historicalAccess, historical: true };
}

function staffActions(
  row: {
    readonly tenantId: string;
    readonly campusId: string;
    readonly classRef: string;
    readonly createdByMembershipId: string;
    readonly reviewedByMembershipId: string | null;
    readonly status: CareRecordStaffProjection["status"];
    readonly published: boolean;
  },
  scopes: readonly StaffScope[],
): readonly CareRecordAction[] {
  const actions = new Set<CareRecordAction>();
  for (const staff of scopes) {
    if (!isInScope(staff.access, row) || !staff.classRefs.includes(row.classRef)) continue;
    const ownsRecord = row.createdByMembershipId === staff.membershipId;
    const canWrite = staff.access.capabilities.includes("care:write");
    if (ownsRecord && canWrite && !row.published) {
      if (["DRAFT", "RETURNED", "CONFIRMED"].includes(row.status)) actions.add("edit");
      if (row.status === "DRAFT") actions.add("submit");
      if (row.status === "RETURNED") actions.add("resubmit");
      if (["DRAFT", "SUBMITTED", "RETURNED"].includes(row.status)) actions.add("withdraw");
    }
    if (
      !ownsRecord &&
      staff.access.capabilities.includes("care:review") &&
      row.status === "SUBMITTED"
    ) {
      actions.add("review");
    }
    if (
      staff.access.capabilities.includes("care:publish") &&
      row.status === "CONFIRMED" &&
      row.reviewedByMembershipId !== null &&
      row.reviewedByMembershipId !== row.createdByMembershipId
    ) {
      actions.add(row.published ? "revoke-publication" : "publish");
    }
  }
  return CARE_RECORD_ACTIONS.filter((action) => actions.has(action));
}

async function createRevision(
  database: Database,
  row: {
    readonly tenantId: string;
    readonly campusId: string;
    readonly id: string;
    readonly version: number;
    readonly arrival: CareRecordValues["arrival"];
    readonly homework: CareRecordValues["homework"];
    readonly meal: CareRecordValues["meal"];
    readonly rest: CareRecordValues["rest"];
    readonly activity: CareRecordValues["activity"];
    readonly wellbeing: CareRecordValues["wellbeing"];
    readonly status: CareRecordStaffProjection["status"];
    readonly reviewedByMembershipId: string | null;
    readonly updatedByMembershipId: string;
    readonly updatedAt: Date;
    readonly published: boolean;
    readonly publicationVersion: number;
  },
  sourcesCaptured: boolean,
): Promise<void> {
  await database.careRecordRevision.create({
    data: {
      tenantId: row.tenantId,
      campusId: row.campusId,
      careRecordId: row.id,
      version: row.version,
      arrival: row.arrival,
      homework: row.homework,
      meal: row.meal,
      rest: row.rest,
      activity: row.activity,
      wellbeing: row.wellbeing,
      status: row.status,
      reviewedByMembershipId: row.reviewedByMembershipId,
      updatedByMembershipId: row.updatedByMembershipId,
      updatedAt: row.updatedAt,
      published: row.published,
      publicationVersion: row.publicationVersion,
      sourcesCaptured,
    },
  });
}

async function createAudit(
  database: Database,
  row: {
    readonly tenantId: string;
    readonly campusId: string;
    readonly id: string;
    readonly version: number;
  },
  actorMembershipId: string,
  action:
    | "CREATED"
    | "EDITED"
    | "SUBMITTED"
    | "RESUBMITTED"
    | "REVIEW_CONFIRMED"
    | "REVIEW_RETURNED"
    | "PUBLISHED"
    | "WITHDRAWN"
    | "PUBLICATION_REVOKED"
    | "SOURCES_CHANGED"
    | "RECEIPT_READ"
    | "RECEIPT_ACKNOWLEDGED",
  occurredAt: Date,
): Promise<void> {
  await database.careRecordAuditEvent.create({
    data: {
      tenantId: row.tenantId,
      campusId: row.campusId,
      careRecordId: row.id,
      actorMembershipId,
      action,
      version: row.version,
      occurredAt,
    },
  });
}

async function parentMembership(
  database: Database,
  access: CareRecordScopeAccess,
): Promise<string | undefined> {
  const campusId = access.scope.campusId;
  if (campusId === undefined) return undefined;
  const rows = await database.membershipCampus.findMany({
    where: {
      tenantId: access.scope.tenantId,
      campusId,
      membership: { userId: access.scope.actorId, status: "ACTIVE" },
    },
    select: { membershipId: true },
  });
  return rows.length === 1 ? rows[0]?.membershipId : undefined;
}

export class PrismaCareRecordService implements CareRecordOperations {
  public constructor(
    private readonly prisma: PrismaClient,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async listStaffStudents(
    context: CareRecordContext,
  ): Promise<readonly CareRecordStudentProjection[]> {
    const scopes = await staffScopes(this.prisma, context, "care:write");
    const where = scopes.flatMap((staff) =>
      staff.access.scope.campusId === undefined || staff.classRefs.length === 0
        ? []
        : [
            {
              tenantId: staff.access.scope.tenantId,
              campusId: staff.access.scope.campusId,
              classRef: { in: [...staff.classRefs] },
            },
          ],
    );
    if (where.length === 0) return [];
    const students = await this.prisma.student.findMany({
      where: { status: "ACTIVE", OR: where },
      select: { id: true, displayRef: true, classRef: true },
      orderBy: [{ classRef: "asc" }, { displayRef: "asc" }, { id: "asc" }],
    });
    return students.map((student) => ({
      id: student.id,
      student_display_ref: student.displayRef,
      class_ref: student.classRef,
    }));
  }

  public async listStaff(
    context: CareRecordContext,
  ): Promise<readonly CareRecordStaffProjection[]> {
    const scopes = await staffScopes(this.prisma, context);
    const where = staffWhere(scopes);
    const history = publishedHistoryWhere(scopes);
    if (where.length === 0 && history.length === 0) return [];
    const rows = await this.prisma.careRecord.findMany({
      where: { OR: [...where, ...history] },
      include: { student: { select: { displayRef: true, status: true, classRef: true } } },
      orderBy: [{ serviceDate: "desc" }, { id: "asc" }],
    });
    const records: CareRecordStaffProjection[] = [];
    for (const row of rows) {
      const currentClassAccess = scopes.find(
        (staff) =>
          isInScope(staff.access, row) &&
          row.student.status === "ACTIVE" &&
          row.student.classRef === row.classRef &&
          staff.classRefs.includes(row.classRef) &&
          (staff.access.capabilities.includes("care:review") ||
            staff.access.capabilities.includes("care:publish") ||
            row.createdByMembershipId === staff.membershipId),
      );
      if (currentClassAccess !== undefined) {
        records.push(staffProjection(row, staffActions(row, scopes)));
        continue;
      }
      if (historicalReadAccess(row, scopes) !== undefined) records.push(staffProjection(row, []));
    }
    return records;
  }

  public async create(
    context: CareRecordContext,
    input: CareRecordCreateInput,
  ): Promise<CareRecordResult<CareRecordStaffProjection>> {
    if (
      !isRecord(input) ||
      !exactKeys(input, ["student_id", "service_date", "values"]) ||
      !validValues(input.values) ||
      !validDate(input.service_date) ||
      typeof input.student_id !== "string"
    ) {
      return errorResult(invalid());
    }
    try {
      return result(
        await this.prisma.$transaction(async (transaction) => {
          const scopes = await staffScopes(transaction, context, "care:write");
          const studentWhere = scopes.flatMap((staff) =>
            staff.access.scope.campusId === undefined || !staff.classRefs.length
              ? []
              : [
                  {
                    tenantId: staff.access.scope.tenantId,
                    campusId: staff.access.scope.campusId,
                    classRef: { in: [...staff.classRefs] },
                  },
                ],
          );
          if (studentWhere.length === 0) throw notFound();
          const student = await transaction.student.findFirst({
            where: { id: input.student_id, status: "ACTIVE", OR: studentWhere },
          });
          if (student === null) throw notFound();
          const creator = scopes.find(
            (staff) =>
              isInScope(staff.access, student) && staff.classRefs.includes(student.classRef),
          );
          if (creator === undefined) throw notFound();
          const now = this.now();
          const row = await transaction.careRecord.create({
            data: {
              tenantId: student.tenantId,
              campusId: student.campusId,
              studentId: student.id,
              classRef: student.classRef,
              serviceDate: new Date(`${input.service_date}T00:00:00.000Z`),
              ...input.values,
              status: "DRAFT",
              version: 1,
              createdByMembershipId: creator.membershipId,
              updatedByMembershipId: creator.membershipId,
              updatedAt: now,
            },
            include: { student: { select: { displayRef: true } } },
          });
          const sources = await currentCareSources(transaction, row);
          await createRevision(transaction, row, true);
          await saveCareSources(transaction, row, sources);
          await createAudit(transaction, row, creator.membershipId, "CREATED", now);
          return staffProjection(row, staffActions(row, scopes));
        }),
      );
    } catch (error) {
      return errorResult(error);
    }
  }

  public async getStaff(
    context: CareRecordContext,
    recordId: string,
  ): Promise<CareRecordResult<CareRecordStaffProjection>> {
    const found = await staffRecord(this.prisma, context, recordId);
    return found === undefined
      ? errorResult(notFound())
      : result(
          staffProjection(
            found.row,
            found.historical ? [] : staffActions(found.row, [found.access]),
          ),
        );
  }

  public async update(
    context: CareRecordContext,
    recordId: string,
    input: CareRecordUpdateInput,
  ): Promise<CareRecordResult<CareRecordStaffProjection>> {
    if (
      !isRecord(input) ||
      !exactKeys(input, ["version", "values"]) ||
      !validVersion(input.version) ||
      !validValues(input.values)
    ) {
      return errorResult(invalid());
    }
    try {
      return result(
        await this.prisma.$transaction(async (transaction) => {
          const found = await staffRecord(transaction, context, recordId, "care:write");
          if (found === undefined || found.row.createdByMembershipId !== found.access.membershipId)
            throw notFound();
          if (found.row.version !== input.version) throw stale();
          if (found.row.published || !["DRAFT", "RETURNED", "CONFIRMED"].includes(found.row.status))
            throw conflict();
          return this.change(transaction, found.row, found.access, "EDITED", {
            ...input.values,
            status: "DRAFT",
            reviewedByMembershipId: null,
            published: false,
          });
        }),
      );
    } catch (error) {
      return errorResult(error);
    }
  }

  public async submit(
    context: CareRecordContext,
    recordId: string,
    input: { readonly version: number },
  ): Promise<CareRecordResult<CareRecordStaffProjection>> {
    if (!isRecord(input) || !exactKeys(input, ["version"]) || !validVersion(input.version))
      return errorResult(invalid());
    try {
      return result(
        await this.prisma.$transaction(async (transaction) => {
          const found = await staffRecord(transaction, context, recordId, "care:write");
          if (found === undefined || found.row.createdByMembershipId !== found.access.membershipId)
            throw notFound();
          if (found.row.version !== input.version) throw stale();
          if (found.row.status !== "DRAFT") throw conflict();
          if (!(await this.checkSources(transaction, found))) return conflict();
          return this.change(transaction, found.row, found.access, "SUBMITTED", {
            status: "SUBMITTED",
          });
        }),
      );
    } catch (error) {
      return errorResult(error);
    }
  }

  public async resubmit(
    context: CareRecordContext,
    recordId: string,
    input: CareRecordUpdateInput,
  ): Promise<CareRecordResult<CareRecordStaffProjection>> {
    if (
      !isRecord(input) ||
      !exactKeys(input, ["version", "values"]) ||
      !validVersion(input.version) ||
      !validValues(input.values)
    ) {
      return errorResult(invalid());
    }
    try {
      return result(
        await this.prisma.$transaction(async (transaction) => {
          const found = await staffRecord(transaction, context, recordId, "care:write");
          if (found === undefined || found.row.createdByMembershipId !== found.access.membershipId)
            throw notFound();
          if (found.row.version !== input.version) throw stale();
          if (found.row.status !== "RETURNED" || found.row.published) throw conflict();
          const sources = await currentCareSources(transaction, found.row);
          if (
            !sources.scopeValid ||
            [...sources.attendance, ...sources.meals, ...sources.pickups].some(
              (source) => !source.valid,
            )
          )
            throw conflict();
          return this.change(transaction, found.row, found.access, "RESUBMITTED", {
            ...input.values,
            status: "SUBMITTED",
            reviewedByMembershipId: null,
          });
        }),
      );
    } catch (error) {
      return errorResult(error);
    }
  }

  public async review(
    context: CareRecordContext,
    recordId: string,
    input: CareRecordReviewInput,
  ): Promise<CareRecordResult<CareRecordStaffProjection>> {
    if (
      !isRecord(input) ||
      !exactKeys(input, ["version", "action"]) ||
      !validVersion(input.version) ||
      (input.action !== "confirm" && input.action !== "return")
    ) {
      return errorResult(invalid());
    }
    try {
      return result(
        await this.prisma.$transaction(async (transaction) => {
          const found = await staffRecord(transaction, context, recordId, "care:review");
          if (found === undefined || found.row.createdByMembershipId === found.access.membershipId)
            throw notFound();
          if (found.row.version !== input.version) throw stale();
          if (found.row.status !== "SUBMITTED") throw conflict();
          if (input.action === "confirm" && !(await this.checkSources(transaction, found)))
            return conflict();
          const action = input.action === "confirm" ? "REVIEW_CONFIRMED" : "REVIEW_RETURNED";
          return this.change(transaction, found.row, found.access, action, {
            status: input.action === "confirm" ? "CONFIRMED" : "RETURNED",
            reviewedByMembershipId: found.access.membershipId,
            published: false,
          });
        }),
      );
    } catch (error) {
      return errorResult(error);
    }
  }

  public async publish(
    context: CareRecordContext,
    recordId: string,
    input: { readonly version: number },
  ): Promise<CareRecordResult<CareRecordStaffProjection>> {
    if (!isRecord(input) || !exactKeys(input, ["version"]) || !validVersion(input.version))
      return errorResult(invalid());
    try {
      return result(
        await this.prisma.$transaction(async (transaction) => {
          const found = await staffRecord(transaction, context, recordId, "care:publish");
          if (found === undefined) throw notFound();
          if (found.row.version !== input.version) throw stale();
          if (
            found.row.status !== "CONFIRMED" ||
            found.row.reviewedByMembershipId === null ||
            found.row.reviewedByMembershipId === found.row.createdByMembershipId ||
            found.row.published
          ) {
            throw conflict();
          }
          if (!(await this.checkSources(transaction, found))) return conflict();
          const published = await this.change(transaction, found.row, found.access, "PUBLISHED", {
            published: true,
            publicationVersion: found.row.publicationVersion + 1,
          });
          const guardians = await transaction.guardianRelationship.findMany({
            where: {
              tenantId: found.row.tenantId,
              campusId: found.row.campusId,
              studentId: found.row.studentId,
              status: "ACTIVE",
            },
            select: { id: true, guardianUserId: true },
          });
          if (guardians.length > 0) {
            await transaction.careRecordReceipt.createMany({
              data: guardians.map((guardian) => ({
                tenantId: found.row.tenantId,
                campusId: found.row.campusId,
                careRecordId: found.row.id,
                studentId: found.row.studentId,
                serviceDate: found.row.serviceDate,
                guardianRelationshipId: guardian.id,
                guardianUserId: guardian.guardianUserId,
                publicationVersion: published.publication_version,
                status: "UNREAD",
                readAt: null,
              })),
              skipDuplicates: true,
            });
          }
          return published;
        }),
      );
    } catch (error) {
      return errorResult(error);
    }
  }

  public async withdraw(
    context: CareRecordContext,
    recordId: string,
    input: { readonly version: number },
  ): Promise<CareRecordResult<CareRecordStaffProjection>> {
    if (!isRecord(input) || !exactKeys(input, ["version"]) || !validVersion(input.version))
      return errorResult(invalid());
    try {
      return result(
        await this.prisma.$transaction(async (transaction) => {
          const found = await staffRecord(transaction, context, recordId, "care:write");
          if (found === undefined || found.row.createdByMembershipId !== found.access.membershipId)
            throw notFound();
          if (found.row.version !== input.version) throw stale();
          if (found.row.published || !["DRAFT", "SUBMITTED", "RETURNED"].includes(found.row.status))
            throw conflict();
          return this.change(transaction, found.row, found.access, "WITHDRAWN", {
            status: "CANCELLED",
            published: false,
          });
        }),
      );
    } catch (error) {
      return errorResult(error);
    }
  }

  public async revokePublication(
    context: CareRecordContext,
    recordId: string,
    input: { readonly version: number },
  ): Promise<CareRecordResult<CareRecordStaffProjection>> {
    if (!isRecord(input) || !exactKeys(input, ["version"]) || !validVersion(input.version))
      return errorResult(invalid());
    try {
      return result(
        await this.prisma.$transaction(async (transaction) => {
          const found = await staffRecord(transaction, context, recordId, "care:publish");
          if (found === undefined) throw notFound();
          if (found.row.version !== input.version) throw stale();
          if (
            found.row.status !== "CONFIRMED" ||
            found.row.reviewedByMembershipId === null ||
            found.row.reviewedByMembershipId === found.row.createdByMembershipId ||
            !found.row.published
          )
            throw conflict();
          return this.change(transaction, found.row, found.access, "PUBLICATION_REVOKED", {
            published: false,
          });
        }),
      );
    } catch (error) {
      return errorResult(error);
    }
  }

  public async listParent(
    context: CareRecordContext,
  ): Promise<readonly CareRecordParentProjection[]> {
    const scopes = requiredScopes(context, "care:read");
    if (scopes.length === 0) return [];
    const actorId = scopes[0]?.scope.actorId;
    if (actorId === undefined || scopes.some((access) => access.scope.actorId !== actorId))
      return [];
    const rows = await this.prisma.careRecord.findMany({
      where: {
        status: "CONFIRMED",
        published: true,
        OR: scopes.flatMap((access) =>
          access.scope.campusId === undefined
            ? []
            : [{ tenantId: access.scope.tenantId, campusId: access.scope.campusId }],
        ),
      },
      include: {
        student: {
          select: {
            displayRef: true,
            classRef: true,
            status: true,
            guardianRelationships: {
              where: { guardianUserId: actorId, status: "ACTIVE" },
              select: { id: true },
            },
          },
        },
        receipts: { where: { guardianUserId: actorId } },
      },
      orderBy: [{ serviceDate: "desc" }, { id: "asc" }],
    });
    const visible = [];
    for (const row of rows) {
      if (
        row.student.status === "ACTIVE" &&
        row.student.guardianRelationships.length === 1 &&
        (row.student.classRef !== row.classRef || (await careSourcesFresh(this.prisma, row)))
      )
        visible.push(parentProjection(row));
    }
    return visible;
  }

  public async getParent(
    context: CareRecordContext,
    recordId: string,
  ): Promise<CareRecordResult<CareRecordParentProjection>> {
    const found = await this.parentRecord(this.prisma, context, recordId);
    return found === undefined ? errorResult(notFound()) : result(parentProjection(found));
  }

  public async receipt(
    context: CareRecordContext,
    recordId: string,
    input: CareRecordReceiptInput,
  ): Promise<CareRecordResult<CareRecordParentProjection>> {
    if (
      !isRecord(input) ||
      !exactKeys(input, ["version", "publication_version", "action"]) ||
      !validVersion(input.version) ||
      !validVersion(input.publication_version) ||
      (input.action !== "read" && input.action !== "acknowledge")
    ) {
      return errorResult(invalid());
    }
    try {
      return result(
        await this.prisma.$transaction(async (transaction) => {
          const found = await this.parentRecord(transaction, context, recordId);
          if (found === undefined) throw notFound();
          if (
            found.version !== input.version ||
            found.publicationVersion !== input.publication_version
          )
            throw stale();
          const access = requiredScopes(context, "care:read").find((item) =>
            isInScope(item, found),
          );
          if (access === undefined) throw notFound();
          const relationship =
            found.student.guardianRelationships.length === 1
              ? found.student.guardianRelationships[0]
              : undefined;
          const membershipId = await parentMembership(transaction, access);
          if (relationship === undefined || membershipId === undefined) throw notFound();
          const existing = await transaction.careRecordReceipt.findFirst({
            where: {
              tenantId: found.tenantId,
              campusId: found.campusId,
              careRecordId: found.id,
              guardianRelationshipId: relationship.id,
              publicationVersion: found.publicationVersion,
            },
          });
          const now = this.now();
          if (input.action === "read") {
            if (existing === null) {
              await transaction.careRecordReceipt.create({
                data: {
                  tenantId: found.tenantId,
                  campusId: found.campusId,
                  careRecordId: found.id,
                  studentId: found.studentId,
                  serviceDate: found.serviceDate,
                  guardianRelationshipId: relationship.id,
                  guardianUserId: access.scope.actorId,
                  publicationVersion: found.publicationVersion,
                  status: "READ",
                  readAt: now,
                },
              });
            } else {
              if (existing.status !== "UNREAD") throw conflict();
              await transaction.careRecordReceipt.update({
                where: {
                  tenantId_campusId_careRecordId_guardianRelationshipId_publicationVersion: {
                    tenantId: found.tenantId,
                    campusId: found.campusId,
                    careRecordId: found.id,
                    guardianRelationshipId: relationship.id,
                    publicationVersion: found.publicationVersion,
                  },
                },
                data: { status: "READ", readAt: now },
              });
            }
            await createAudit(transaction, found, membershipId, "RECEIPT_READ", now);
          } else {
            if (existing === null || existing.status !== "READ") throw conflict();
            await transaction.careRecordReceipt.update({
              where: {
                tenantId_campusId_careRecordId_guardianRelationshipId_publicationVersion: {
                  tenantId: found.tenantId,
                  campusId: found.campusId,
                  careRecordId: found.id,
                  guardianRelationshipId: relationship.id,
                  publicationVersion: found.publicationVersion,
                },
              },
              data: { status: "ACKNOWLEDGED", acknowledgedAt: now },
            });
            await createAudit(transaction, found, membershipId, "RECEIPT_ACKNOWLEDGED", now);
          }
          const updated = await this.parentRecord(transaction, context, recordId);
          if (updated === undefined) throw notFound();
          return parentProjection(updated);
        }),
      );
    } catch (error) {
      return errorResult(error);
    }
  }

  private async parentRecord(database: Database, context: CareRecordContext, recordId: string) {
    const scopes = requiredScopes(context, "care:read");
    const actorId = scopes[0]?.scope.actorId;
    if (actorId === undefined || scopes.some((access) => access.scope.actorId !== actorId))
      return undefined;
    const row = await database.careRecord.findFirst({
      where: {
        id: recordId,
        status: "CONFIRMED",
        published: true,
        OR: scopes.flatMap((access) =>
          access.scope.campusId === undefined
            ? []
            : [{ tenantId: access.scope.tenantId, campusId: access.scope.campusId }],
        ),
      },
      include: {
        student: {
          select: {
            displayRef: true,
            classRef: true,
            status: true,
            guardianRelationships: {
              where: { guardianUserId: actorId, status: "ACTIVE" },
              select: { id: true },
            },
          },
        },
        receipts: { where: { guardianUserId: actorId } },
      },
    });
    if (
      row === null ||
      row.student.status !== "ACTIVE" ||
      row.student.guardianRelationships.length !== 1
    )
      return undefined;
    return row.student.classRef !== row.classRef || (await careSourcesFresh(database, row))
      ? row
      : undefined;
  }

  private async checkSources(
    transaction: Prisma.TransactionClient,
    found: NonNullable<Awaited<ReturnType<typeof staffRecord>>>,
  ): Promise<boolean> {
    if (await careSourcesFresh(transaction, found.row)) return true;
    // Return a conflict after the transaction commits; throwing here would undo invalidation.
    await this.change(transaction, found.row, found.access, "SOURCES_CHANGED", {
      status: "RETURNED",
      reviewedByMembershipId: null,
      published: false,
    });
    return false;
  }

  private async change(
    transaction: Prisma.TransactionClient,
    current: {
      readonly tenantId: string;
      readonly campusId: string;
      readonly id: string;
      readonly version: number;
    },
    actor: StaffScope,
    action:
      | "EDITED"
      | "SUBMITTED"
      | "RESUBMITTED"
      | "REVIEW_CONFIRMED"
      | "REVIEW_RETURNED"
      | "PUBLISHED"
      | "WITHDRAWN"
      | "PUBLICATION_REVOKED"
      | "SOURCES_CHANGED",
    data: Partial<CareRecordValues> & {
      readonly status?: "DRAFT" | "SUBMITTED" | "RETURNED" | "CONFIRMED" | "CANCELLED";
      readonly reviewedByMembershipId?: string | null;
      readonly published?: boolean;
      readonly publicationVersion?: number;
    },
  ): Promise<CareRecordStaffProjection> {
    const updatedAt = this.now();
    const changed = await transaction.careRecord.updateMany({
      where: {
        tenantId: current.tenantId,
        campusId: current.campusId,
        id: current.id,
        version: current.version,
      },
      data: {
        ...data,
        updatedByMembershipId: actor.membershipId,
        updatedAt,
        version: { increment: 1 },
      },
    });
    if (changed.count !== 1) throw stale();
    const row = await transaction.careRecord.findFirst({
      where: { tenantId: current.tenantId, campusId: current.campusId, id: current.id },
      include: { student: { select: { displayRef: true } } },
    });
    if (row === null) throw notFound();
    const sources =
      action === "EDITED" || action === "RESUBMITTED"
        ? await currentCareSources(transaction, row)
        : await frozenCareSources(transaction, current);
    await createRevision(transaction, row, "captured" in sources ? sources.captured : true);
    await saveCareSources(transaction, row, sources);
    await createAudit(transaction, row, actor.membershipId, action, updatedAt);
    return staffProjection(row, staffActions(row, [actor]));
  }
}
