import { Prisma, type PrismaClient } from "../../generated/prisma/client.js";
import type {
  ParentHealthIncidentContext,
  ParentHealthIncidentOperations,
  StaffHealthIncidentReviewContext,
  StaffHealthIncidentReviewOperations,
} from "../../nest/api-tokens.js";

type Database = PrismaClient | Prisma.TransactionClient;
type HealthCapability =
  | "health:create"
  | "health:submit"
  | "health:review"
  | "health:supplement"
  | "health:publish"
  | "health:revoke";
type ReviewAction = "CONFIRM" | "RETURN" | "ESCALATE";
type HealthIncidentRow = Prisma.HealthIncidentGetPayload<{ include: typeof healthIncidentInclude }>;
type StaffScope = {
  readonly tenantId: string;
  readonly campusId: string;
  readonly membershipId: string;
  readonly classRefs: readonly string[];
};
type ParentScope = {
  readonly tenantId: string;
  readonly campusId: string;
  readonly guardianUserId: string;
};

const healthIncidentInclude = {
  student: { select: { id: true, classRef: true, displayRef: true } },
  guardianRelationship: { select: { status: true, version: true } },
  receipts: { select: { version: true, status: true } },
} as const;
const capabilities: readonly HealthCapability[] = [
  "health:create",
  "health:submit",
  "health:review",
  "health:supplement",
  "health:publish",
  "health:revoke",
];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const observations = ["ROUTINE_OBSERVATION", "NEEDS_FOLLOW_UP", "URGENT_REVIEW"] as const;
const reviewActions: readonly ReviewAction[] = ["CONFIRM", "RETURN", "ESCALATE"];
const dispositions = [
  "OBSERVATION_RECHECKED",
  "FOLLOW_UP_SCHEDULED",
  "GUARDIAN_SUMMARY_PREPARED",
] as const;
const summaries = [
  "FOLLOW_UP_IN_PROGRESS",
  "FOLLOW_UP_COMPLETED",
  "PLEASE_CHECK_PAGE_LATER",
] as const;
const parentSummaryLabels = {
  FOLLOW_UP_IN_PROGRESS: "已安排后续关注，请留意后续沟通。",
  FOLLOW_UP_COMPLETED: "本次关注事项已完成。",
  PLEASE_CHECK_PAGE_LATER: "请稍后查看后续更新。",
} as const;
const statusLabels = {
  DRAFT: "草稿",
  SUBMITTED: "待审核",
  RETURNED: "已退回",
  CONFIRMED: "已审核",
  EXCEPTION_PENDING: "需负责人继续跟进",
  PUBLISHED: "已发布",
  REVOKED: "已撤回",
  WITHDRAWN: "作者已撤回",
} as const;
const observationLabels = {
  ROUTINE_OBSERVATION: "日常状态观察",
  NEEDS_FOLLOW_UP: "需要跟进",
  URGENT_REVIEW: "需要尽快复核",
} as const;
const dispositionLabels = {
  OBSERVATION_RECHECKED: "已重新核对观察",
  FOLLOW_UP_SCHEDULED: "已安排跟进",
  GUARDIAN_SUMMARY_PREPARED: "已准备家长摘要",
} as const;
class HealthIncidentReviewFailure extends Error {
  public readonly statusCode: 400 | 403 | 404 | 409;

  public constructor(
    public readonly code:
      "VALIDATION_FAILED" | "FORBIDDEN_SCOPE" | "NOT_FOUND_SCOPED" | "CONFLICT_STATE",
  ) {
    super(code);
    this.statusCode =
      code === "VALIDATION_FAILED"
        ? 400
        : code === "FORBIDDEN_SCOPE"
          ? 403
          : code === "NOT_FOUND_SCOPED"
            ? 404
            : 409;
  }
}

const invalid = () => new HealthIncidentReviewFailure("VALIDATION_FAILED");
const forbidden = () => new HealthIncidentReviewFailure("FORBIDDEN_SCOPE");
const notFound = () => new HealthIncidentReviewFailure("NOT_FOUND_SCOPED");
const conflict = () => new HealthIncidentReviewFailure("CONFLICT_STATE");

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactBody(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return (
    isRecord(value) &&
    Object.keys(value).length === keys.length &&
    Object.keys(value).every((key) => keys.includes(key))
  );
}

function validVersion(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

function staffView(record: HealthIncidentRow) {
  return {
    id: record.id,
    version: record.version,
    status: record.status,
    statusLabel: statusLabels[record.status],
    published: record.published,
    tenantId: record.tenantId,
    campusId: record.campusId,
    classId: record.student.classRef,
    studentId: record.student.id,
    studentLabel: record.student.displayRef,
    bindingId: record.guardianRelationshipId,
    bindingVersion: record.guardianRelationshipVersion,
    observationCode: record.observationCode,
    observationLabel: observationLabels[record.observationCode],
    dispositionCode: record.dispositionCode,
    dispositionLabel: dispositionLabels[record.dispositionCode],
    summaryCode: record.summaryCode,
    reviewedBy: record.reviewedByMembershipId,
    createdByLabel: "示例员工",
    updatedAt: record.updatedAt.toISOString(),
    synthetic: true as const,
  };
}

async function resolveStaff(
  database: Database,
  context: StaffHealthIncidentReviewContext,
  capability: HealthCapability,
): Promise<StaffScope> {
  const reviewAction = capability !== "health:create" && capability !== "health:submit";
  if (
    !capabilities.includes(capability) ||
    !context.capabilities.includes(capability) ||
    (reviewAction && !context.capabilities.includes("health:review"))
  )
    throw forbidden();

  const memberships = await database.membership.findMany({
    where: {
      tenantId: context.tenantId,
      userId: context.actorId,
      status: "ACTIVE",
    },
    select: {
      id: true,
      campuses: {
        select: {
          campusId: true,
          classAssignments: { select: { classRef: true } },
        },
      },
    },
  });
  if (memberships.length !== 1) throw forbidden();
  const membership = memberships[0];
  if (!membership || membership.campuses.length !== 1) throw forbidden();
  const campus = membership.campuses[0];
  if (!campus || campus.campusId !== context.campusId || campus.classAssignments.length === 0)
    throw forbidden();

  return {
    tenantId: context.tenantId,
    campusId: context.campusId,
    membershipId: membership.id,
    classRefs: campus.classAssignments.map(({ classRef }) => classRef),
  };
}

async function resolveParent(
  database: Database,
  context: ParentHealthIncidentContext,
): Promise<ParentScope> {
  if (!context.capabilities.includes("binding:read")) throw forbidden();
  const memberships = await database.membership.findMany({
    where: {
      tenantId: context.tenantId,
      userId: context.actorId,
      status: "ACTIVE",
    },
    select: { campuses: { select: { campusId: true } } },
  });
  if (memberships.length !== 1 || memberships[0]?.campuses.length !== 1) throw forbidden();
  if (memberships[0]?.campuses[0]?.campusId !== context.campusId) throw forbidden();
  return {
    tenantId: context.tenantId,
    campusId: context.campusId,
    guardianUserId: context.actorId,
  };
}

function createBody(value: unknown) {
  if (!exactBody(value, ["studentId", "observationCode", "dispositionCode"])) throw invalid();
  if (typeof value.studentId !== "string" || !UUID.test(value.studentId)) throw invalid();
  if (
    typeof value.observationCode !== "string" ||
    !observations.includes(value.observationCode as never)
  )
    throw invalid();
  if (
    typeof value.dispositionCode !== "string" ||
    !dispositions.includes(value.dispositionCode as never)
  )
    throw invalid();
  return {
    studentId: value.studentId,
    observationCode: value.observationCode as (typeof observations)[number],
    dispositionCode: value.dispositionCode as (typeof dispositions)[number],
  };
}

function scopedWhere(staff: StaffScope, incidentId?: string) {
  return {
    tenantId: staff.tenantId,
    campusId: staff.campusId,
    ...(incidentId === undefined ? {} : { id: incidentId }),
    student: { is: { classRef: { in: [...staff.classRefs] } } },
  };
}

function eligibleRelationshipWhere(staff: StaffScope) {
  return {
    tenantId: staff.tenantId,
    campusId: staff.campusId,
    status: "ACTIVE",
    sourceApplication: { is: { status: "APPROVED" } },
  } as const;
}

async function findScoped(
  database: Database,
  staff: StaffScope,
  incidentId: string,
): Promise<HealthIncidentRow> {
  const record = await database.healthIncident.findFirst({
    where: scopedWhere(staff, incidentId),
    include: healthIncidentInclude,
  });
  if (!record) throw notFound();
  return record;
}

function versionMatches(record: HealthIncidentRow, value: unknown) {
  if (!validVersion(value)) throw invalid();
  if (record.version !== value) throw conflict();
}

function reviewBody(value: unknown): { readonly version: number; readonly action: ReviewAction } {
  if (!exactBody(value, ["version", "action"]) || !validVersion(value.version)) throw invalid();
  if (typeof value.action !== "string" || !reviewActions.includes(value.action as ReviewAction))
    throw invalid();
  return { version: value.version, action: value.action as ReviewAction };
}

function supplementBody(value: unknown) {
  if (!exactBody(value, ["version", "dispositionCode"]) || !validVersion(value.version))
    throw invalid();
  if (
    typeof value.dispositionCode !== "string" ||
    !dispositions.includes(value.dispositionCode as never)
  )
    throw invalid();
  return {
    version: value.version,
    dispositionCode: value.dispositionCode as (typeof dispositions)[number],
  };
}

function publishBody(value: unknown) {
  if (!exactBody(value, ["version", "summaryCode"]) || !validVersion(value.version))
    throw invalid();
  if (typeof value.summaryCode !== "string" || !summaries.includes(value.summaryCode as never))
    throw invalid();
  return { version: value.version, summaryCode: value.summaryCode as (typeof summaries)[number] };
}

function versionBody(value: unknown) {
  if (!exactBody(value, ["version"]) || !validVersion(value.version)) throw invalid();
  return { version: value.version };
}

async function updateIncident(
  database: Prisma.TransactionClient,
  staff: StaffScope,
  incidentId: string,
  version: number,
  allowedStatuses: readonly HealthIncidentRow["status"][],
  data: Prisma.HealthIncidentUncheckedUpdateManyInput,
  clearReceipts: boolean,
): Promise<ReturnType<typeof staffView>> {
  const changed = await database.healthIncident.updateMany({
    where: {
      ...scopedWhere(staff, incidentId),
      version,
      status: { in: [...allowedStatuses] },
    },
    data,
  });
  if (changed.count !== 1) throw conflict();
  if (clearReceipts)
    await database.healthIncidentReceipt.deleteMany({
      where: { tenantId: staff.tenantId, campusId: staff.campusId, incidentId },
    });
  const updated = await findScoped(database, staff, incidentId);
  return staffView(updated);
}

type ParentReceiptStatus = "UNREAD" | "READ" | "ACKNOWLEDGED";

function parentView(record: HealthIncidentRow, receiptStatus: ParentReceiptStatus) {
  if (!record.summaryCode) throw notFound();
  return {
    id: record.id,
    version: record.version,
    status: "PUBLISHED" as const,
    studentLabel: record.student.displayRef,
    parentSummary: parentSummaryLabels[record.summaryCode],
    receiptStatus,
    updatedAt: record.updatedAt.toISOString(),
    synthetic: true as const,
  };
}

async function findParentPublished(
  database: Database,
  parent: ParentScope,
  incidentId: string,
): Promise<HealthIncidentRow> {
  const record = await database.healthIncident.findFirst({
    where: {
      tenantId: parent.tenantId,
      campusId: parent.campusId,
      id: incidentId,
      guardianUserId: parent.guardianUserId,
      status: "PUBLISHED",
      published: true,
      summaryCode: { not: null },
      guardianRelationship: {
        is: { guardianUserId: parent.guardianUserId, status: "ACTIVE" },
      },
    },
    include: healthIncidentInclude,
  });
  if (
    !record ||
    record.guardianRelationship.status !== "ACTIVE" ||
    record.guardianRelationship.version !== record.guardianRelationshipVersion
  )
    throw notFound();
  return record;
}

function parentReceiptStatus(record: HealthIncidentRow): ParentReceiptStatus {
  const receipt = record.receipts.find(({ version }) => version === record.version);
  return receipt?.status ?? "UNREAD";
}

export class PrismaHealthIncidentReviewService
  implements StaffHealthIncidentReviewOperations, ParentHealthIncidentOperations
{
  public constructor(private readonly prisma: PrismaClient) {}

  public listStudents(context: StaffHealthIncidentReviewContext) {
    return this.prisma.$transaction(async (transaction) => {
      const staff = await resolveStaff(transaction, context, "health:create");
      const eligibleRelationship = eligibleRelationshipWhere(staff);
      const students = await transaction.student.findMany({
        where: {
          tenantId: staff.tenantId,
          campusId: staff.campusId,
          status: "ACTIVE",
          classRef: { in: [...staff.classRefs] },
          guardianRelationships: { some: eligibleRelationship },
        },
        select: {
          id: true,
          displayRef: true,
          guardianRelationships: {
            where: eligibleRelationship,
            select: { id: true },
            take: 2,
          },
        },
        orderBy: [{ classRef: "asc" }, { displayRef: "asc" }],
      });

      return students
        .filter(({ guardianRelationships }) => guardianRelationships.length === 1)
        .map(({ id, displayRef }) => ({ id, studentLabel: displayRef }));
    });
  }

  public listDrafts(context: StaffHealthIncidentReviewContext) {
    return this.prisma.$transaction(async (transaction) => {
      const staff = await resolveStaff(transaction, context, "health:create");
      const drafts = await transaction.healthIncident.findMany({
        where: {
          tenantId: staff.tenantId,
          campusId: staff.campusId,
          createdByMembershipId: staff.membershipId,
          status: "DRAFT",
          student: { is: { status: "ACTIVE", classRef: { in: [...staff.classRefs] } } },
        },
        select: {
          id: true,
          version: true,
          studentId: true,
          observationCode: true,
          dispositionCode: true,
          guardianRelationshipId: true,
          guardianRelationshipVersion: true,
          student: {
            select: {
              guardianRelationships: {
                where: eligibleRelationshipWhere(staff),
                select: { id: true, version: true },
                take: 2,
              },
            },
          },
        },
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      });

      return drafts
        .filter(({ student, guardianRelationshipId, guardianRelationshipVersion }) => {
          const [current, other] = student.guardianRelationships;
          return !other && current?.id === guardianRelationshipId && current.version === guardianRelationshipVersion;
        })
        .map(({ id, version, studentId, observationCode, dispositionCode }) => ({
          id,
          version,
          status: "DRAFT" as const,
          statusLabel: statusLabels.DRAFT,
          studentId,
          observationCode,
          dispositionCode,
          synthetic: true as const,
        }));
    }, { isolationLevel: "RepeatableRead" });
  }

  public create(
    context: StaffHealthIncidentReviewContext,
    body: unknown,
  ): Promise<ReturnType<typeof staffView>> {
    const input = createBody(body);
    return this.prisma.$transaction(async (transaction) => {
      const staff = await resolveStaff(transaction, context, "health:create");
      const student = await transaction.student.findFirst({
        where: {
          tenantId: staff.tenantId,
          campusId: staff.campusId,
          id: input.studentId,
          status: "ACTIVE",
          classRef: { in: [...staff.classRefs] },
        },
        select: { id: true },
      });
      if (!student) throw notFound();
      const relationships = await transaction.guardianRelationship.findMany({
        where: {
          ...eligibleRelationshipWhere(staff),
          studentId: student.id,
        },
        select: { id: true, guardianUserId: true, version: true },
      });
      if (relationships.length !== 1) throw forbidden();
      const relationship = relationships[0]!;
      const created = await transaction.healthIncident.create({
        data: {
          tenantId: staff.tenantId,
          campusId: staff.campusId,
          studentId: student.id,
          guardianRelationshipId: relationship.id,
          guardianUserId: relationship.guardianUserId,
          guardianRelationshipVersion: relationship.version,
          observationCode: input.observationCode,
          dispositionCode: input.dispositionCode,
          status: "DRAFT",
          published: false,
          version: 1,
          createdByMembershipId: staff.membershipId,
          updatedByMembershipId: staff.membershipId,
        },
        include: healthIncidentInclude,
      });
      return staffView(created);
    });
  }

  public async submit(
    context: StaffHealthIncidentReviewContext,
    incidentId: string,
    body: unknown,
  ): Promise<ReturnType<typeof staffView>> {
    const input = versionBody(body);
    try {
      return await this.prisma.$transaction(
        async (transaction) => {
          const staff = await resolveStaff(transaction, context, "health:submit");
          const record = await findScoped(transaction, staff, incidentId);
          if (record.createdByMembershipId !== staff.membershipId) throw forbidden();
          versionMatches(record, input.version);
          const allowed = ["DRAFT", "RETURNED"] as const;
          if (!allowed.includes(record.status as never)) throw conflict();

          const eligible = eligibleRelationshipWhere(staff);
          const changed = await transaction.healthIncident.updateMany({
            where: {
              tenantId: staff.tenantId,
              campusId: staff.campusId,
              id: incidentId,
              createdByMembershipId: staff.membershipId,
              version: input.version,
              status: { in: [...allowed] },
              guardianRelationship: {
                is: { ...eligible, version: record.guardianRelationshipVersion },
              },
              student: {
                is: {
                  status: "ACTIVE",
                  classRef: { in: [...staff.classRefs] },
                  guardianRelationships: {
                    none: { ...eligible, id: { not: record.guardianRelationshipId } },
                  },
                },
              },
            },
            data: {
              status: "SUBMITTED",
              published: false,
              summaryCode: null,
              reviewedByMembershipId: null,
              updatedByMembershipId: staff.membershipId,
              version: { increment: 1 },
            },
          });
          if (changed.count !== 1) throw notFound();
          return staffView(await findScoped(transaction, staff, incidentId));
        },
        { isolationLevel: "Serializable" },
      );
    } catch (error) {
      if (isRecord(error) && error.code === "P2034") throw conflict();
      throw error;
    }
  }

  public review(
    context: StaffHealthIncidentReviewContext,
    incidentId: string,
    body: unknown,
  ): Promise<ReturnType<typeof staffView>> {
    const input = reviewBody(body);
    return this.prisma.$transaction(async (transaction) => {
      const staff = await resolveStaff(transaction, context, "health:review");
      const record = await findScoped(transaction, staff, incidentId);
      versionMatches(record, input.version);
      const statuses =
        input.action === "ESCALATE"
          ? (["SUBMITTED"] as const)
          : (["SUBMITTED", "EXCEPTION_PENDING"] as const);
      if (!statuses.includes(record.status as never)) throw conflict();
      const status =
        input.action === "CONFIRM"
          ? "CONFIRMED"
          : input.action === "RETURN"
            ? "RETURNED"
            : "EXCEPTION_PENDING";
      return updateIncident(
        transaction,
        staff,
        incidentId,
        input.version,
        statuses,
        {
          status,
          published: false,
          summaryCode: null,
          reviewedByMembershipId: staff.membershipId,
          updatedByMembershipId: staff.membershipId,
          version: { increment: 1 },
        },
        false,
      );
    });
  }

  public supplement(
    context: StaffHealthIncidentReviewContext,
    incidentId: string,
    body: unknown,
  ): Promise<ReturnType<typeof staffView>> {
    const input = supplementBody(body);
    return this.prisma.$transaction(async (transaction) => {
      const staff = await resolveStaff(transaction, context, "health:supplement");
      const record = await findScoped(transaction, staff, incidentId);
      versionMatches(record, input.version);
      const allowed = ["CONFIRMED", "PUBLISHED"] as const;
      if (!allowed.includes(record.status as never)) throw conflict();
      return updateIncident(
        transaction,
        staff,
        incidentId,
        input.version,
        allowed,
        {
          status: "CONFIRMED",
          dispositionCode: input.dispositionCode,
          summaryCode: null,
          published: false,
          reviewedByMembershipId: staff.membershipId,
          updatedByMembershipId: staff.membershipId,
          version: { increment: 1 },
        },
        true,
      );
    });
  }

  public publish(
    context: StaffHealthIncidentReviewContext,
    incidentId: string,
    body: unknown,
  ): Promise<ReturnType<typeof staffView>> {
    const input = publishBody(body);
    return this.prisma.$transaction(async (transaction) => {
      const staff = await resolveStaff(transaction, context, "health:publish");
      const record = await findScoped(transaction, staff, incidentId);
      versionMatches(record, input.version);
      const allowed = ["CONFIRMED", "PUBLISHED"] as const;
      if (!allowed.includes(record.status as never)) throw conflict();
      return updateIncident(
        transaction,
        staff,
        incidentId,
        input.version,
        allowed,
        {
          status: "PUBLISHED",
          summaryCode: input.summaryCode,
          published: true,
          reviewedByMembershipId: staff.membershipId,
          updatedByMembershipId: staff.membershipId,
          version: { increment: 1 },
        },
        true,
      );
    });
  }

  public revoke(
    context: StaffHealthIncidentReviewContext,
    incidentId: string,
    body: unknown,
  ): Promise<ReturnType<typeof staffView>> {
    const input = versionBody(body);
    return this.prisma.$transaction(async (transaction) => {
      const staff = await resolveStaff(transaction, context, "health:revoke");
      const record = await findScoped(transaction, staff, incidentId);
      versionMatches(record, input.version);
      const allowed = ["PUBLISHED"] as const;
      if (!allowed.includes(record.status as never)) throw conflict();
      return updateIncident(
        transaction,
        staff,
        incidentId,
        input.version,
        allowed,
        {
          status: "REVOKED",
          summaryCode: null,
          published: false,
          reviewedByMembershipId: staff.membershipId,
          updatedByMembershipId: staff.membershipId,
          version: { increment: 1 },
        },
        true,
      );
    });
  }

  public async list(context: ParentHealthIncidentContext): Promise<unknown>;
  public async list(context: StaffHealthIncidentReviewContext): Promise<unknown>;
  public async list(
    context: ParentHealthIncidentContext | StaffHealthIncidentReviewContext,
  ): Promise<unknown> {
    if (context.capabilities.includes("health:review")) {
      const staff = await resolveStaff(this.prisma, context, "health:review");
      const records = await this.prisma.healthIncident.findMany({
        where: {
          ...scopedWhere(staff),
          status: { in: ["SUBMITTED", "EXCEPTION_PENDING", "CONFIRMED", "PUBLISHED"] },
        },
        include: healthIncidentInclude,
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      });
      return records.map(staffView);
    }
    const parent = await resolveParent(this.prisma, context);
    const records = await this.prisma.healthIncident.findMany({
      where: {
        tenantId: parent.tenantId,
        campusId: parent.campusId,
        guardianUserId: parent.guardianUserId,
        status: "PUBLISHED",
        published: true,
        summaryCode: { not: null },
        guardianRelationship: {
          is: { guardianUserId: parent.guardianUserId, status: "ACTIVE" },
        },
      },
      include: healthIncidentInclude,
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    });
    return records
      .filter(
        (record) => record.guardianRelationship.version === record.guardianRelationshipVersion,
      )
      .map((record) => parentView(record, parentReceiptStatus(record)));
  }

  public read(
    context: ParentHealthIncidentContext,
    incidentId: string,
    body: unknown,
  ): Promise<unknown> {
    const input = versionBody(body);
    return this.prisma.$transaction(async (transaction) => {
      const parent = await resolveParent(transaction, context);
      const record = await findParentPublished(transaction, parent, incidentId);
      versionMatches(record, input.version);
      const where = {
        tenantId_campusId_incidentId: {
          tenantId: parent.tenantId,
          campusId: parent.campusId,
          incidentId,
        },
      };
      const existing = await transaction.healthIncidentReceipt.findUnique({ where });
      if (existing?.version === record.version && existing.status === "ACKNOWLEDGED")
        return parentView(record, "ACKNOWLEDGED");
      const receipt = await transaction.healthIncidentReceipt.upsert({
        where,
        create: {
          tenantId: parent.tenantId,
          campusId: parent.campusId,
          incidentId,
          version: record.version,
          status: "READ",
        },
        update: { version: record.version, status: "READ" },
      });
      return parentView(record, receipt.status);
    });
  }

  public acknowledge(
    context: ParentHealthIncidentContext,
    incidentId: string,
    body: unknown,
  ): Promise<unknown> {
    const input = versionBody(body);
    return this.prisma.$transaction(async (transaction) => {
      const parent = await resolveParent(transaction, context);
      const record = await findParentPublished(transaction, parent, incidentId);
      versionMatches(record, input.version);
      const where = {
        tenantId_campusId_incidentId: {
          tenantId: parent.tenantId,
          campusId: parent.campusId,
          incidentId,
        },
      };
      const existing = await transaction.healthIncidentReceipt.findUnique({ where });
      if (existing?.version !== record.version || !existing) throw conflict();
      if (existing.status === "ACKNOWLEDGED") return parentView(record, "ACKNOWLEDGED");
      if (existing.status !== "READ") throw conflict();
      const changed = await transaction.healthIncidentReceipt.updateMany({
        where: {
          tenantId: parent.tenantId,
          campusId: parent.campusId,
          incidentId,
          version: record.version,
          status: "READ",
        },
        data: { status: "ACKNOWLEDGED" },
      });
      if (changed.count !== 1) throw conflict();
      return parentView(record, "ACKNOWLEDGED");
    });
  }
}
