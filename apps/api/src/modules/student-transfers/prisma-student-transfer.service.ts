import type { StudentTransferDto, StudentTransferListing } from "@student-care/contracts";
import { Prisma, type PrismaClient } from "../../generated/prisma/client.js";
import {
  parseTransferCreate,
  parseTransferReview,
  StudentTransferFailure,
  TRANSFER_UUID,
  type StudentTransferContext,
  type StudentTransferOperations,
} from "./student-transfer.service.js";

type Database = Prisma.TransactionClient;
type Transfer = Prisma.StudentTransferRequestGetPayload<{
  include: { student: true; events: true };
}>;
const REQUEST = "students:transfer:request";
const REVIEW = "students:transfer:review";
const forbidden = () => new StudentTransferFailure("FORBIDDEN_SCOPE", 403);
const conflict = () => new StudentTransferFailure("CONFLICT_STATE", 409);
const notFound = () => new StudentTransferFailure("NOT_FOUND_SCOPED", 404);
const included = {
  student: true,
  events: { orderBy: { requestVersion: "asc" as const } },
} as const;

async function member(db: Database, context: StudentTransferContext, capability?: string) {
  if (
    ![context.actorId, context.tenantId, context.campusId].every((id) => TRANSFER_UUID.test(id)) ||
    !(capability
      ? context.capabilities.includes(capability)
      : context.capabilities.some((cap) => cap === REQUEST || cap === REVIEW))
  )
    throw forbidden();
  const memberships = await db.membershipCampus.findMany({
    where: {
      tenantId: context.tenantId,
      campusId: context.campusId,
      campus: { status: "ACTIVE" },
      membership: {
        userId: context.actorId,
        status: "ACTIVE",
        user: { status: "ACTIVE" },
        tenant: { status: "ACTIVE" },
      },
    },
    include: { classAssignments: true },
  });
  if (memberships.length !== 1) throw forbidden();
  return memberships[0]!;
}

function projection(
  row: Transfer,
  context: StudentTransferContext,
  activeClasses: ReadonlySet<string>,
): StudentTransferDto {
  const isOwnRequest = row.requestedByUserId === context.actorId;
  const canReview =
    row.status === "PENDING" && !isOwnRequest && context.capabilities.includes(REVIEW);
  return {
    id: row.id,
    studentId: row.studentId,
    studentLabel: row.student.displayRef,
    sourceClassRef: row.sourceClassRef,
    destinationClassRef: row.destinationClassRef,
    status: row.status,
    version: row.version,
    requestedAt: row.requestedAt.toISOString(),
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    isOwnRequest,
    canReview,
    canApprove:
      canReview &&
      row.student.status === "ACTIVE" &&
      row.student.classRef === row.sourceClassRef &&
      activeClasses.has(row.destinationClassRef),
    events: row.events.map((event) => ({
      action: event.action,
      version: event.requestVersion,
      actorId: event.actorUserId,
      occurredAt: event.occurredAt.toISOString(),
    })),
  };
}

async function classes(db: Database, context: StudentTransferContext): Promise<Set<string>> {
  const rows = await db.student.findMany({
    where: { tenantId: context.tenantId, campusId: context.campusId, status: "ACTIVE" },
    select: { classRef: true },
    distinct: ["classRef"],
    orderBy: { classRef: "asc" },
  });
  return new Set(rows.map((row) => row.classRef));
}

export class PrismaStudentTransferService implements StudentTransferOperations {
  public constructor(
    private readonly prisma: PrismaClient,
    private readonly now = () => new Date(),
  ) {}

  private async transaction<T>(operation: (db: Database) => Promise<T>): Promise<T> {
    try {
      return await this.prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (["P2002", "P2025", "P2034"].includes(error.code)) throw conflict();
        if (error.code === "P2003") throw notFound();
      }
      throw error;
    }
  }

  public list(context: StudentTransferContext): Promise<StudentTransferListing> {
    return this.transaction(async (db) => {
      const staff = await member(db, context);
      const canRequest = context.capabilities.includes(REQUEST);
      const canReview = context.capabilities.includes(REVIEW);
      const activeClasses = await classes(db, context);
      const students = canRequest
        ? await db.student.findMany({
            where: {
              tenantId: context.tenantId,
              campusId: context.campusId,
              status: "ACTIVE",
              classRef: { in: staff.classAssignments.map((entry) => entry.classRef) },
            },
            select: { id: true, displayRef: true, classRef: true },
            orderBy: [{ classRef: "asc" }, { id: "asc" }],
          })
        : [];
      const rows = await db.studentTransferRequest.findMany({
        where: {
          tenantId: context.tenantId,
          campusId: context.campusId,
          ...(canReview ? {} : { requestedByUserId: context.actorId }),
        },
        include: included,
        orderBy: [{ requestedAt: "desc" }, { id: "desc" }],
      });
      return {
        canRequest,
        canReview,
        students: students.map((student) => ({
          id: student.id,
          label: student.displayRef,
          classRef: student.classRef,
        })),
        destinationClasses: canRequest ? [...activeClasses] : [],
        requests: rows.map((row) => projection(row, context, activeClasses)),
      };
    });
  }

  public create(context: StudentTransferContext, value: unknown): Promise<StudentTransferDto> {
    const input = parseTransferCreate(value);
    return this.transaction(async (db) => {
      const staff = await member(db, context, REQUEST);
      const scope = { tenantId: context.tenantId, campusId: context.campusId };
      const student = await db.student.findFirst({
        where: { ...scope, id: input.student_id, status: "ACTIVE" },
      });
      if (!student) throw notFound();
      if (!staff.classAssignments.some((entry) => entry.classRef === student.classRef))
        throw forbidden();
      const activeClasses = await classes(db, context);
      if (
        student.classRef === input.destination_class_ref ||
        !activeClasses.has(input.destination_class_ref) ||
        !student.classRef.trim() ||
        student.classRef.length > 80
      )
        throw conflict();
      const at = this.now();
      const row = await db.studentTransferRequest.create({
        data: {
          ...scope,
          studentId: student.id,
          sourceClassRef: student.classRef,
          destinationClassRef: input.destination_class_ref,
          requestedByMembershipId: staff.membershipId,
          requestedByUserId: context.actorId,
          requestedAt: at,
        },
      });
      await db.studentTransferAuditEvent.create({
        data: {
          ...scope,
          requestId: row.id,
          actorMembershipId: staff.membershipId,
          actorUserId: context.actorId,
          action: "CREATED",
          requestVersion: 1,
          occurredAt: at,
        },
      });
      const complete = await db.studentTransferRequest.findUniqueOrThrow({
        where: { tenantId_campusId_id: { ...scope, id: row.id } },
        include: included,
      });
      return projection(complete, context, activeClasses);
    });
  }

  public review(
    context: StudentTransferContext,
    id: string,
    value: unknown,
  ): Promise<StudentTransferDto> {
    if (!TRANSFER_UUID.test(id)) throw new StudentTransferFailure("VALIDATION_FAILED", 400);
    const input = parseTransferReview(value);
    return this.transaction(async (db) => {
      const staff = await member(db, context, REVIEW);
      const scope = { tenantId: context.tenantId, campusId: context.campusId };
      const key = { ...scope, id: id.toLowerCase() };
      const row = await db.studentTransferRequest.findUnique({
        where: { tenantId_campusId_id: key },
        include: included,
      });
      if (!row) throw notFound();
      if (row.requestedByUserId === context.actorId) throw forbidden();
      if (row.status !== "PENDING" || row.version !== input.expected_version) throw conflict();
      const activeClasses = await classes(db, context);
      if (input.decision === "APPROVE") {
        if (!projection(row, context, activeClasses).canApprove) throw conflict();
        const moved = await db.student.updateMany({
          where: { ...scope, id: row.studentId, status: "ACTIVE", classRef: row.sourceClassRef },
          data: { classRef: row.destinationClassRef },
        });
        if (moved.count !== 1) throw conflict();
      }
      const at = this.now();
      const status = input.decision === "APPROVE" ? "APPROVED" : "REJECTED";
      const updated = await db.studentTransferRequest.updateMany({
        where: { ...key, status: "PENDING", version: input.expected_version },
        data: {
          status,
          version: { increment: 1 },
          reviewedByMembershipId: staff.membershipId,
          reviewedByUserId: context.actorId,
          reviewedAt: at,
        },
      });
      if (updated.count !== 1) throw conflict();
      await db.studentTransferAuditEvent.create({
        data: {
          ...scope,
          requestId: row.id,
          actorMembershipId: staff.membershipId,
          actorUserId: context.actorId,
          action: status,
          requestVersion: row.version + 1,
          occurredAt: at,
        },
      });
      const complete = await db.studentTransferRequest.findUniqueOrThrow({
        where: { tenantId_campusId_id: key },
        include: included,
      });
      return projection(complete, context, activeClasses);
    });
  }
}
