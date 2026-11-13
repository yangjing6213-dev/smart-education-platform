import { Prisma, type Notice, type PrismaClient } from "../../generated/prisma/client.js";
import type {
  ParentNoticeContext,
  ParentNoticeOperations,
  StaffNoticeContext,
  StaffNoticeOperations,
} from "../../nest/api-tokens.js";

type Database = PrismaClient | Prisma.TransactionClient;
type NoticeTemplateCode = "INSTITUTION_ANNOUNCEMENT" | "CLASS_ACTIVITY";
type NoticeScope = {
  readonly tenantId: string;
  readonly campusId: string;
  readonly membershipId: string;
  readonly classRefs: readonly string[];
};
type ParentScope = {
  readonly tenantId: string;
  readonly campusId: string;
  readonly guardianUserId: string;
  readonly classRefs: readonly string[];
  readonly hasApprovedRelationship: boolean;
};
type NoticeRow = Notice;

const TEMPLATES = {
  INSTITUTION_ANNOUNCEMENT: {
    title: "机构公告",
    body: "校区发布了新的服务安排，请家长查看页面内更新。",
    target: "INSTITUTION",
  },
  CLASS_ACTIVITY: {
    title: "班级活动",
    body: "班级近期有活动安排，请家长查看并留意相关时间。",
    target: "CLASS",
  },
} as const;
const STAFF_CAPABILITIES = [
  "notice:create",
  "notice:submit",
  "notice:review",
  "notice:publish",
  "notice:revoke",
] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

class NoticeFailure extends Error {
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

const invalid = () => new NoticeFailure("VALIDATION_FAILED");
const forbidden = () => new NoticeFailure("FORBIDDEN_SCOPE");
const notFound = () => new NoticeFailure("NOT_FOUND_SCOPED");
const conflict = () => new NoticeFailure("CONFLICT_STATE");

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

function versionBody(value: unknown): { readonly version: number } {
  if (
    !exactBody(value, ["version"]) ||
    !Number.isSafeInteger(value.version) ||
    Number(value.version) < 1
  )
    throw invalid();
  return { version: Number(value.version) };
}

function createBody(value: unknown) {
  if (!isRecord(value) || typeof value.templateCode !== "string") throw invalid();
  if (value.templateCode === "INSTITUTION_ANNOUNCEMENT") {
    if (!exactBody(value, ["templateCode"])) throw invalid();
    return { templateCode: value.templateCode as NoticeTemplateCode, classRef: null };
  }
  if (value.templateCode === "CLASS_ACTIVITY") {
    if (
      !exactBody(value, ["templateCode", "classRef"]) ||
      typeof value.classRef !== "string" ||
      value.classRef.trim() !== value.classRef ||
      value.classRef.length < 1 ||
      value.classRef.length > 80
    )
      throw invalid();
    return { templateCode: value.templateCode as NoticeTemplateCode, classRef: value.classRef };
  }
  throw invalid();
}

function actionBody(value: unknown): {
  readonly version: number;
  readonly action: "APPROVE" | "RETURN";
} {
  if (
    !exactBody(value, ["version", "action"]) ||
    !Number.isSafeInteger(value.version) ||
    Number(value.version) < 1 ||
    (value.action !== "APPROVE" && value.action !== "RETURN")
  )
    throw invalid();
  return { version: Number(value.version), action: value.action };
}

async function resolveStaff(
  database: Database,
  context: StaffNoticeContext,
  capability: (typeof STAFF_CAPABILITIES)[number],
): Promise<NoticeScope> {
  const reviewAction =
    capability === "notice:review" ||
    capability === "notice:publish" ||
    capability === "notice:revoke";
  if (
    !STAFF_CAPABILITIES.includes(capability) ||
    !context.capabilities.includes(capability) ||
    (reviewAction && !context.capabilities.includes("notice:review"))
  )
    throw forbidden();

  const memberships = await database.membership.findMany({
    where: { tenantId: context.tenantId, userId: context.actorId, status: "ACTIVE" },
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
  if (memberships.length !== 1 || memberships[0]?.campuses.length !== 1) throw forbidden();
  const membership = memberships[0]!;
  const campus = membership.campuses[0]!;
  if (campus.campusId !== context.campusId) throw forbidden();
  return {
    tenantId: context.tenantId,
    campusId: context.campusId,
    membershipId: membership.id,
    classRefs: campus.classAssignments.map(({ classRef }) => classRef),
  };
}

async function resolveParent(
  database: Database,
  context: ParentNoticeContext,
): Promise<ParentScope> {
  if (!context.capabilities.includes("binding:read")) throw forbidden();
  const memberships = await database.membership.findMany({
    where: { tenantId: context.tenantId, userId: context.actorId, status: "ACTIVE" },
    select: { campuses: { select: { campusId: true } } },
  });
  if (memberships.length !== 1 || memberships[0]?.campuses.length !== 1) throw forbidden();
  if (memberships[0]?.campuses[0]?.campusId !== context.campusId) throw forbidden();

  const relationships = await database.guardianRelationship.findMany({
    where: {
      tenantId: context.tenantId,
      campusId: context.campusId,
      guardianUserId: context.actorId,
      status: "ACTIVE",
      sourceApplication: { is: { status: "APPROVED" } },
    },
    select: { student: { select: { classRef: true } } },
  });
  return {
    tenantId: context.tenantId,
    campusId: context.campusId,
    guardianUserId: context.actorId,
    classRefs: [...new Set(relationships.map(({ student }) => student.classRef))],
    hasApprovedRelationship: relationships.length > 0,
  };
}

function staffScopeWhere(scope: NoticeScope): Prisma.NoticeWhereInput {
  return {
    OR: [{ target: "INSTITUTION" }, { target: "CLASS", classRef: { in: [...scope.classRefs] } }],
  };
}

function staffView(notice: NoticeRow) {
  const template = TEMPLATES[notice.templateCode];
  return {
    id: notice.id,
    templateCode: notice.templateCode,
    target: notice.target,
    status: notice.status,
    version: notice.version,
    published: notice.published,
    createdAt: notice.createdAt.toISOString(),
    updatedAt: notice.updatedAt.toISOString(),
    title: template.title,
    body: template.body,
    synthetic: true as const,
  };
}

function parentView(notice: NoticeRow, receiptStatus: "UNREAD" | "READ" | "ACKNOWLEDGED") {
  const template = TEMPLATES[notice.templateCode];
  return {
    id: notice.id,
    version: notice.version,
    status: "PUBLISHED" as const,
    published: true as const,
    title: template.title,
    body: template.body,
    target: notice.target,
    requiresAcknowledgment: true as const,
    receiptStatus,
    synthetic: true as const,
  };
}

async function findStaffNotice(
  database: Database,
  scope: NoticeScope,
  noticeId: string,
): Promise<NoticeRow> {
  const notice = await database.notice.findFirst({
    where: {
      id: noticeId,
      tenantId: scope.tenantId,
      campusId: scope.campusId,
      ...staffScopeWhere(scope),
    },
  });
  if (!notice) throw notFound();
  return notice;
}

async function findParentNotice(
  database: Database,
  scope: ParentScope,
  noticeId: string,
): Promise<NoticeRow> {
  if (!scope.hasApprovedRelationship) throw notFound();
  const notice = await database.notice.findFirst({
    where: {
      id: noticeId,
      tenantId: scope.tenantId,
      campusId: scope.campusId,
      status: "PUBLISHED",
      published: true,
      OR: [
        { target: "INSTITUTION" },
        ...(scope.classRefs.length === 0
          ? []
          : [{ target: "CLASS" as const, classRef: { in: [...scope.classRefs] } }]),
      ],
    },
  });
  if (!notice) throw notFound();
  return notice;
}

function assertVersion(notice: NoticeRow, version: number): void {
  if (notice.version !== version) throw conflict();
}

export class PrismaNoticeService implements StaffNoticeOperations, ParentNoticeOperations {
  public constructor(private readonly prisma: PrismaClient) {}

  public async listAuthored(context: StaffNoticeContext): Promise<readonly unknown[]> {
    return this.prisma.$transaction(async (transaction) => {
      const scope = await resolveStaff(transaction, context, "notice:create");
      const notices = await transaction.notice.findMany({
        where: {
          tenantId: scope.tenantId,
          campusId: scope.campusId,
          createdByMembershipId: scope.membershipId,
          ...staffScopeWhere(scope),
        },
        orderBy: { updatedAt: "desc" },
      });
      return notices.map(staffView);
    });
  }

  public async listForReview(context: StaffNoticeContext): Promise<readonly unknown[]> {
    return this.prisma.$transaction(async (transaction) => {
      const scope = await resolveStaff(transaction, context, "notice:review");
      const visibleStates: Prisma.NoticeWhereInput[] = [
        {
          status: "SUBMITTED",
          published: false,
          createdByMembershipId: { not: scope.membershipId },
        },
      ];
      if (context.capabilities.includes("notice:publish"))
        visibleStates.push({
          status: "APPROVED",
          published: false,
          createdByMembershipId: { not: scope.membershipId },
        });
      if (context.capabilities.includes("notice:revoke"))
        visibleStates.push({ status: "PUBLISHED", published: true });
      const notices = await transaction.notice.findMany({
        where: {
          tenantId: scope.tenantId,
          campusId: scope.campusId,
          AND: [{ OR: visibleStates }, staffScopeWhere(scope)],
        },
        orderBy: { updatedAt: "asc" },
      });
      return notices.map(staffView);
    });
  }

  public create(context: StaffNoticeContext, value: unknown): Promise<unknown> {
    const input = createBody(value);
    return this.prisma.$transaction(async (transaction) => {
      const scope = await resolveStaff(transaction, context, "notice:create");
      if (input.classRef !== null && !scope.classRefs.includes(input.classRef)) throw notFound();
      const target = TEMPLATES[input.templateCode].target;
      const notice = await transaction.notice.create({
        data: {
          tenantId: scope.tenantId,
          campusId: scope.campusId,
          templateCode: input.templateCode,
          target,
          classRef: input.classRef,
          status: "DRAFT",
          published: false,
          version: 1,
          createdByMembershipId: scope.membershipId,
        },
      });
      return staffView(notice);
    });
  }

  public submit(context: StaffNoticeContext, noticeId: string, value: unknown): Promise<unknown> {
    const input = versionBody(value);
    return this.prisma.$transaction(async (transaction) => {
      const scope = await resolveStaff(transaction, context, "notice:submit");
      const notice = await findStaffNotice(transaction, scope, noticeId);
      if (notice.createdByMembershipId !== scope.membershipId) throw forbidden();
      assertVersion(notice, input.version);
      if (notice.status !== "DRAFT" && notice.status !== "RETURNED") throw conflict();
      const changed = await transaction.notice.updateMany({
        where: {
          tenantId: scope.tenantId,
          campusId: scope.campusId,
          id: noticeId,
          createdByMembershipId: scope.membershipId,
          status: notice.status,
          version: input.version,
        },
        data: {
          status: "SUBMITTED",
          published: false,
          reviewedByMembershipId: null,
          publishedAt: null,
          revokedAt: null,
          version: { increment: 1 },
        },
      });
      if (changed.count !== 1) throw conflict();
      return staffView(await findStaffNotice(transaction, scope, noticeId));
    });
  }

  public review(context: StaffNoticeContext, noticeId: string, value: unknown): Promise<unknown> {
    const input = actionBody(value);
    return this.prisma.$transaction(async (transaction) => {
      const scope = await resolveStaff(transaction, context, "notice:review");
      const notice = await findStaffNotice(transaction, scope, noticeId);
      if (notice.createdByMembershipId === scope.membershipId) throw forbidden();
      assertVersion(notice, input.version);
      if (notice.status !== "SUBMITTED") throw conflict();
      const changed = await transaction.notice.updateMany({
        where: {
          tenantId: scope.tenantId,
          campusId: scope.campusId,
          id: noticeId,
          status: "SUBMITTED",
          version: input.version,
        },
        data: {
          status: input.action === "APPROVE" ? "APPROVED" : "RETURNED",
          published: false,
          reviewedByMembershipId: scope.membershipId,
          version: { increment: 1 },
        },
      });
      if (changed.count !== 1) throw conflict();
      return staffView(await findStaffNotice(transaction, scope, noticeId));
    });
  }

  public publish(context: StaffNoticeContext, noticeId: string, value: unknown): Promise<unknown> {
    const input = versionBody(value);
    return this.prisma.$transaction(async (transaction) => {
      const scope = await resolveStaff(transaction, context, "notice:publish");
      const notice = await findStaffNotice(transaction, scope, noticeId);
      assertVersion(notice, input.version);
      if (notice.status !== "APPROVED" || notice.reviewedByMembershipId === null) throw conflict();
      const changed = await transaction.notice.updateMany({
        where: {
          tenantId: scope.tenantId,
          campusId: scope.campusId,
          id: noticeId,
          status: "APPROVED",
          version: input.version,
        },
        data: {
          status: "PUBLISHED",
          published: true,
          publishedAt: new Date(),
          version: { increment: 1 },
        },
      });
      if (changed.count !== 1) throw conflict();
      return staffView(await findStaffNotice(transaction, scope, noticeId));
    });
  }

  public revoke(context: StaffNoticeContext, noticeId: string, value: unknown): Promise<unknown> {
    const input = versionBody(value);
    return this.prisma.$transaction(async (transaction) => {
      const scope = await resolveStaff(transaction, context, "notice:revoke");
      const notice = await findStaffNotice(transaction, scope, noticeId);
      assertVersion(notice, input.version);
      if (notice.status !== "PUBLISHED") throw conflict();
      const changed = await transaction.notice.updateMany({
        where: {
          tenantId: scope.tenantId,
          campusId: scope.campusId,
          id: noticeId,
          status: "PUBLISHED",
          version: input.version,
        },
        data: {
          status: "REVOKED",
          published: false,
          revokedAt: new Date(),
          version: { increment: 1 },
        },
      });
      if (changed.count !== 1) throw conflict();
      return staffView(await findStaffNotice(transaction, scope, noticeId));
    });
  }

  public async listParent(context: ParentNoticeContext): Promise<readonly unknown[]> {
    return this.prisma.$transaction(async (transaction) => {
      const scope = await resolveParent(transaction, context);
      if (!scope.hasApprovedRelationship) return [];
      const notices = await transaction.notice.findMany({
        where: {
          tenantId: scope.tenantId,
          campusId: scope.campusId,
          status: "PUBLISHED",
          published: true,
          OR: [
            { target: "INSTITUTION" },
            ...(scope.classRefs.length === 0
              ? []
              : [{ target: "CLASS" as const, classRef: { in: [...scope.classRefs] } }]),
          ],
        },
        orderBy: { publishedAt: "desc" },
      });
      if (notices.length === 0) return [];
      const receipts = await transaction.noticeReceipt.findMany({
        where: {
          tenantId: scope.tenantId,
          campusId: scope.campusId,
          guardianUserId: scope.guardianUserId,
          noticeId: { in: notices.map(({ id }) => id) },
        },
        select: { noticeId: true, version: true, status: true },
      });
      const receiptByVersion = new Map(
        receipts.map((receipt) => [`${receipt.noticeId}:${receipt.version}`, receipt.status]),
      );
      return notices.map((notice) =>
        parentView(notice, receiptByVersion.get(`${notice.id}:${notice.version}`) ?? "UNREAD"),
      );
    });
  }

  public list(context: ParentNoticeContext): Promise<readonly unknown[]> {
    return this.listParent(context);
  }

  public read(context: ParentNoticeContext, noticeId: string, value: unknown): Promise<unknown> {
    return this.recordParentReceipt(context, noticeId, value, "read");
  }

  public acknowledge(
    context: ParentNoticeContext,
    noticeId: string,
    value: unknown,
  ): Promise<unknown> {
    return this.recordParentReceipt(context, noticeId, value, "ack");
  }

  private async recordParentReceipt(
    context: ParentNoticeContext,
    noticeId: string,
    value: unknown,
    action: "read" | "ack",
  ): Promise<unknown> {
    const input = versionBody(value);
    if (!UUID.test(noticeId)) throw invalid();
    return this.prisma.$transaction(async (transaction) => {
      const scope = await resolveParent(transaction, context);
      const notice = await findParentNotice(transaction, scope, noticeId);
      assertVersion(notice, input.version);
      const key = {
        tenantId: scope.tenantId,
        campusId: scope.campusId,
        noticeId,
        guardianUserId: scope.guardianUserId,
        version: input.version,
      };
      if (action === "read") {
        const receipt = await transaction.noticeReceipt.upsert({
          where: { tenantId_campusId_noticeId_guardianUserId_version: key },
          create: { ...key, status: "READ" },
          update: {},
        });
        return parentView(notice, receipt.status);
      }
      const existing = await transaction.noticeReceipt.findUnique({
        where: { tenantId_campusId_noticeId_guardianUserId_version: key },
      });
      if (!existing) throw conflict();
      if (existing.status === "ACKNOWLEDGED") return parentView(notice, existing.status);
      const receipt = await transaction.noticeReceipt.update({
        where: { tenantId_campusId_noticeId_guardianUserId_version: key },
        data: { status: "ACKNOWLEDGED" },
      });
      return parentView(notice, receipt.status);
    });
  }
}
