import { Prisma, type PrismaClient } from "../../generated/prisma/client.js";
import { createHash, randomBytes } from "node:crypto";
import type {
  ParentPickupAuthorizationView,
  ParentPickupContext,
  ParentPickupOperations,
  ParentPickupProjection,
} from "../../nest/api-tokens.js";

type Database = PrismaClient | Prisma.TransactionClient;
type PickupInput = {
  readonly bindingId: string;
  readonly recipient: keyof typeof RECIPIENTS;
  readonly type: "REGULAR" | "TEMPORARY";
  readonly startDate: string;
  readonly endDate: string;
  readonly startTime: string;
  readonly endTime: string;
};
const relationshipInclude = {
  student: { select: { id: true, displayRef: true, classRef: true } },
} as const;
const authorizationInclude = {
  student: { select: { displayRef: true, classRef: true } },
} as const;
const credentialInclude = { authorization: { include: authorizationInclude } } as const;
type RelationshipRow = Prisma.GuardianRelationshipGetPayload<{
  include: typeof relationshipInclude;
}>;
type AuthorizationRow = Prisma.PickupAuthorizationGetPayload<{
  include: typeof authorizationInclude;
}>;
type PickupCredentialRow = Prisma.PickupCredentialGetPayload<{
  include: typeof credentialInclude;
}>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const DATE = /^\d{4}-\d{2}-\d{2}$/u;
const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/u;
const RECIPIENTS = {
  "pickup-alpha": { value: "PICKUP_ALPHA", label: "示例接送人甲" },
  "pickup-beta": { value: "PICKUP_BETA", label: "示例接送人乙" },
} as const;
const CREDENTIAL_TTL_MS = 5 * 60 * 1000;
const CREDENTIAL_TOKEN = /^[A-Za-z0-9_-]{43}$/u;

class ParentPickupFailure extends Error {
  public constructor(
    public readonly code:
      "VALIDATION_FAILED" | "FORBIDDEN_SCOPE" | "NOT_FOUND_SCOPED" | "CONFLICT_STATE",
    public readonly statusCode: 400 | 403 | 404 | 409,
  ) {
    super(code);
  }
}

const invalid = () => new ParentPickupFailure("VALIDATION_FAILED", 400);
const forbidden = () => new ParentPickupFailure("FORBIDDEN_SCOPE", 403);
const notFound = () => new ParentPickupFailure("NOT_FOUND_SCOPED", 404);
const conflict = () => new ParentPickupFailure("CONFLICT_STATE", 409);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function dateOrdinal(value: string): number {
  return Date.parse(`${value}T00:00:00.000Z`);
}

function shanghaiParts(value: Date): { readonly date: string; readonly time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const values = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}`,
  };
}

function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function expectedVersion(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1) throw invalid();
  return Number(value);
}

function exactBody(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!isRecord(value) || Object.keys(value).some((key) => !keys.includes(key))) throw invalid();
  return value;
}

function pickupCredential(value: unknown): string {
  const input = exactBody(value, ["credential"]);
  if (typeof input.credential !== "string" || !CREDENTIAL_TOKEN.test(input.credential))
    throw invalid();
  return input.credential;
}

function confirmationInput(value: unknown): { readonly credential: string } {
  const input = exactBody(value, ["credential", "checks"]);
  const checks = exactBody(input.checks, ["student", "recipient", "authorization"]);
  if (checks.student !== true || checks.recipient !== true || checks.authorization !== true)
    throw invalid();
  return { credential: pickupCredential({ credential: input.credential }) };
}

function credentialDigest(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function relationshipWhere(context: ParentPickupContext) {
  return {
    tenantId: context.tenantId,
    campusId: context.campusId,
    guardianUserId: context.actorId,
    status: "ACTIVE" as const,
    releasedAt: null,
    campus: { is: { status: "ACTIVE", tenant: { is: { status: "ACTIVE" } } } },
    guardian: { is: { status: "ACTIVE" } },
    student: { is: { status: "ACTIVE" } },
    sourceApplication: { is: { status: "APPROVED" as const } },
  };
}

function relationIsCurrent() {
  return {
    status: "ACTIVE" as const,
    releasedAt: null,
    sourceApplication: { is: { status: "APPROVED" as const } },
  };
}

function authorizationWhere(context: ParentPickupContext) {
  return {
    tenantId: context.tenantId,
    campusId: context.campusId,
    guardianUserId: context.actorId,
    guardianRelationship: { is: relationIsCurrent() },
    student: { is: { status: "ACTIVE" } },
  };
}

function validNow(
  row: Pick<AuthorizationRow, "status" | "startDate" | "endDate" | "startTime" | "endTime">,
  now: Date,
) {
  if (row.status !== "ACTIVE") return false;
  const current = shanghaiParts(now);
  const startDate = dateOnly(row.startDate);
  const endDate = dateOnly(row.endDate);
  if (current.date < startDate || current.date > endDate) return false;
  if (current.date === startDate && current.time < row.startTime) return false;
  if (current.date === endDate && current.time > row.endTime) return false;
  return true;
}

function authorizationView(row: AuthorizationRow, now: Date): ParentPickupAuthorizationView {
  const recipientKey = row.authorizedPartyRef === "PICKUP_ALPHA" ? "pickup-alpha" : "pickup-beta";
  const recipient = RECIPIENTS[recipientKey];
  return {
    id: row.id,
    version: row.version,
    status: row.status,
    currentlyValid: validNow(row, now),
    bindingId: row.guardianRelationshipId,
    studentId: row.studentId,
    studentLabel: row.student.displayRef,
    classLabel: row.student.classRef,
    recipient: recipientKey,
    recipientLabel: recipient.label,
    type: row.type,
    startDate: dateOnly(row.startDate),
    endDate: dateOnly(row.endDate),
    startTime: row.startTime,
    endTime: row.endTime,
  };
}

function operationInput(value: unknown): PickupInput {
  const data = exactBody(value, [
    "bindingId",
    "recipient",
    "type",
    "startDate",
    "endDate",
    "startTime",
    "endTime",
  ]);
  const bindingId = data.bindingId;
  const type = data.type;
  const startDate = data.startDate;
  const endDate = data.endDate;
  const startTime = data.startTime;
  const endTime = data.endTime;
  const recipient =
    typeof data.recipient === "string"
      ? RECIPIENTS[data.recipient as keyof typeof RECIPIENTS]
      : undefined;
  if (
    !validUuid(bindingId) ||
    !recipient ||
    (type !== "REGULAR" && type !== "TEMPORARY") ||
    !validDate(startDate) ||
    !validDate(endDate) ||
    endDate < startDate ||
    dateOrdinal(endDate) - dateOrdinal(startDate) > 90 * 86_400_000 ||
    typeof startTime !== "string" ||
    !TIME.test(startTime) ||
    typeof endTime !== "string" ||
    !TIME.test(endTime) ||
    startTime > endTime ||
    (type === "TEMPORARY" && startDate !== endDate)
  )
    throw invalid();
  return {
    bindingId: bindingId as string,
    recipient: data.recipient as keyof typeof RECIPIENTS,
    type: type as "REGULAR" | "TEMPORARY",
    startDate: startDate as string,
    endDate: endDate as string,
    startTime: startTime as string,
    endTime: endTime as string,
  };
}

export class PrismaParentPickupService implements ParentPickupOperations {
  public constructor(
    private readonly prisma: PrismaClient,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async list(context: ParentPickupContext): Promise<ParentPickupProjection> {
    await this.#membershipId(this.prisma, context);
    const relationships = await this.#activeRelationships(this.prisma, context);
    if (relationships.length === 0) return { bindings: [], authorizations: [], records: [] };
    const relationshipIds = relationships.map(({ id }) => id);
    const authorizations = await this.prisma.pickupAuthorization.findMany({
      where: {
        ...authorizationWhere(context),
        guardianRelationshipId: { in: relationshipIds },
      },
      include: authorizationInclude,
      orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    });
    const records = await this.prisma.pickupRecord.findMany({
      where: {
        tenantId: context.tenantId,
        campusId: context.campusId,
        guardianUserId: context.actorId,
        guardianRelationshipId: { in: relationshipIds },
        status: "COMPLETED",
      },
      include: { student: { select: { displayRef: true } } },
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      take: 100,
    });
    const now = this.now();
    return {
      bindings: relationships.map((row) => ({
        id: row.id,
        version: row.version,
        studentId: row.student.id,
        studentLabel: row.student.displayRef,
        classLabel: row.student.classRef,
        status: "APPROVED",
      })),
      authorizations: authorizations.map((row) => authorizationView(row, now)),
      records: records.map((row) => ({
        id: row.id,
        date: dateOnly(row.serviceDate),
        time: shanghaiParts(row.occurredAt).time,
        studentId: row.studentId,
        studentLabel: row.student.displayRef,
        recipient:
          row.authorizedPartyRef === "PICKUP_ALPHA"
            ? RECIPIENTS["pickup-alpha"].label
            : RECIPIENTS["pickup-beta"].label,
        status: row.status,
      })),
    };
  }

  public async create(
    context: ParentPickupContext,
    value: unknown,
  ): Promise<ParentPickupAuthorizationView> {
    const input = operationInput(value);
    return this.#transaction(async (database) => {
      const membershipId = await this.#membershipId(database, context);
      const relationship = (await this.#activeRelationships(database, context)).find(
        (row) => row.id === input.bindingId,
      );
      if (!relationship) throw notFound();
      const row = await database.pickupAuthorization.create({
        data: {
          tenantId: context.tenantId,
          campusId: context.campusId,
          studentId: relationship.student.id,
          guardianRelationshipId: relationship.id,
          guardianUserId: context.actorId,
          authorizedPartyRef: RECIPIENTS[input.recipient].value,
          type: input.type,
          startDate: new Date(`${input.startDate}T00:00:00.000Z`),
          endDate: new Date(`${input.endDate}T00:00:00.000Z`),
          startTime: input.startTime,
          endTime: input.endTime,
          status: "DRAFT",
          createdByMembershipId: membershipId,
          updatedByMembershipId: membershipId,
        },
        include: authorizationInclude,
      });
      return authorizationView(row, this.now());
    });
  }

  public async activate(context: ParentPickupContext, authorizationId: string, value: unknown) {
    const expected = expectedVersion(exactBody(value, ["version"]).version);
    return this.#transaction(async (database) => {
      const membershipId = await this.#membershipId(database, context);
      const current = await this.#ownedAuthorization(database, context, authorizationId);
      if (current.version !== expected || current.status !== "DRAFT") throw conflict();
      if (dateOnly(current.endDate) < shanghaiParts(this.now()).date) throw conflict();
      const updated = await database.pickupAuthorization.updateMany({
        where: {
          id: authorizationId,
          ...authorizationWhere(context),
          status: "DRAFT",
          version: expected,
        },
        data: {
          status: "ACTIVE",
          version: { increment: 1 },
          updatedByMembershipId: membershipId,
          updatedAt: this.now(),
        },
      });
      if (updated.count !== 1) throw conflict();
      return authorizationView(
        await this.#ownedAuthorization(database, context, authorizationId),
        this.now(),
      );
    });
  }

  public async revoke(context: ParentPickupContext, authorizationId: string, value: unknown) {
    const expected = expectedVersion(exactBody(value, ["version"]).version);
    return this.#transaction(async (database) => {
      const membershipId = await this.#membershipId(database, context);
      const current = await this.#ownedAuthorization(database, context, authorizationId);
      if (current.version !== expected || current.status !== "ACTIVE") throw conflict();
      const updated = await database.pickupAuthorization.updateMany({
        where: {
          id: authorizationId,
          ...authorizationWhere(context),
          status: "ACTIVE",
          version: expected,
        },
        data: {
          status: "REVOKED",
          version: { increment: 1 },
          updatedByMembershipId: membershipId,
          updatedAt: this.now(),
        },
      });
      if (updated.count !== 1) throw conflict();
      await database.pickupCredential.updateMany({
        where: {
          tenantId: context.tenantId,
          campusId: context.campusId,
          authorizationId,
          consumedAt: null,
          invalidatedAt: null,
        },
        data: { invalidatedAt: this.now() },
      });
      return authorizationView(
        await this.#ownedAuthorization(database, context, authorizationId),
        this.now(),
      );
    });
  }

  public async issueCredential(
    context: ParentPickupContext,
    authorizationId: string,
    value: unknown,
  ) {
    const version = expectedVersion(exactBody(value, ["version"]).version);
    return this.#transaction(async (database) => {
      const membershipId = await this.#membershipId(database, context);
      const authorization = await this.#ownedAuthorization(database, context, authorizationId);
      const now = this.now();
      if (authorization.version !== version || !validNow(authorization, now)) throw conflict();

      await database.pickupCredential.updateMany({
        where: {
          tenantId: context.tenantId,
          campusId: context.campusId,
          authorizationId,
          consumedAt: null,
          invalidatedAt: null,
        },
        data: { invalidatedAt: now },
      });

      const credential = randomBytes(32).toString("base64url");
      const expiresAt = new Date(now.getTime() + CREDENTIAL_TTL_MS);
      await database.pickupCredential.create({
        data: {
          tenantId: context.tenantId,
          campusId: context.campusId,
          authorizationId,
          authorizationVersion: authorization.version,
          credentialHash: credentialDigest(credential),
          issuedByMembershipId: membershipId,
          expiresAt,
        },
      });
      return { credential, expiresAt: expiresAt.toISOString() };
    });
  }

  public async previewCredential(context: ParentPickupContext, value: unknown) {
    const credential = pickupCredential(value);
    await this.#staffMembershipId(this.prisma, context);
    const candidate = await this.#credentialForStaff(this.prisma, context, credential, this.now());
    return {
      studentLabel: candidate.credential.authorization.student.displayRef,
      classLabel: candidate.credential.authorization.student.classRef,
      recipientLabel:
        candidate.credential.authorization.authorizedPartyRef === "PICKUP_ALPHA"
          ? RECIPIENTS["pickup-alpha"].label
          : RECIPIENTS["pickup-beta"].label,
    };
  }

  public async confirmCredential(context: ParentPickupContext, value: unknown) {
    const { credential } = confirmationInput(value);
    return this.#transaction(async (database) => {
      const checkedByMembershipId = await this.#staffMembershipId(database, context);
      const now = this.now();
      const candidate = await this.#credentialForStaff(database, context, credential, now);
      const { credential: storedCredential, attendance } = candidate;
      const consumed = await database.pickupCredential.updateMany({
        where: {
          id: storedCredential.id,
          tenantId: context.tenantId,
          campusId: context.campusId,
          credentialHash: credentialDigest(credential),
          consumedAt: null,
          invalidatedAt: null,
          expiresAt: { gt: now },
        },
        data: { consumedAt: now },
      });
      if (consumed.count !== 1) throw conflict();

      const currentTime = shanghaiParts(now).time;
      const updatedAttendance = await database.attendanceRecord.updateMany({
        where: {
          tenantId: context.tenantId,
          campusId: context.campusId,
          id: attendance.id,
          studentId: attendance.studentId,
          serviceDate: attendance.serviceDate,
          status: "ARRIVED",
          version: attendance.version,
          corrections: { none: { status: "PENDING" } },
          pickupRecords: { none: {} },
        },
        data: {
          status: "DEPARTED",
          departureTime: currentTime,
          version: { increment: 1 },
          updatedByMembershipId: checkedByMembershipId,
          updatedAt: now,
        },
      });
      if (updatedAttendance.count !== 1) throw conflict();

      await database.attendanceRecordRevision.create({
        data: {
          tenantId: context.tenantId,
          campusId: context.campusId,
          attendanceRecordId: attendance.id,
          version: attendance.version + 1,
          status: "DEPARTED",
          arrivalTime: attendance.arrivalTime,
          departureTime: currentTime,
          corrected: attendance.corrected,
          action: "DEPARTED",
          updatedByMembershipId: checkedByMembershipId,
          updatedAt: now,
        },
      });
      const record = await database.pickupRecord.create({
        data: {
          tenantId: context.tenantId,
          campusId: context.campusId,
          authorizationId: storedCredential.authorization.id,
          authorizationVersion: storedCredential.authorizationVersion,
          guardianRelationshipId: storedCredential.authorization.guardianRelationshipId,
          guardianUserId: storedCredential.authorization.guardianUserId,
          studentId: storedCredential.authorization.studentId,
          attendanceRecordId: attendance.id,
          attendanceVersion: attendance.version + 1,
          authorizedPartyRef: storedCredential.authorization.authorizedPartyRef,
          serviceDate: attendance.serviceDate,
          status: "COMPLETED",
          studentChecked: true,
          recipientChecked: true,
          authorizationChecked: true,
          checkedByMembershipId,
          occurredAt: now,
        },
      });
      return { id: record.id, status: "COMPLETED" as const };
    });
  }

  async #membershipId(database: Database, context: ParentPickupContext): Promise<string> {
    if (
      !validUuid(context.actorId) ||
      !validUuid(context.tenantId) ||
      !validUuid(context.campusId) ||
      !context.capabilities.includes("binding:read") ||
      !context.capabilities.includes("binding:apply")
    )
      throw forbidden();
    const memberships = await database.membershipCampus.findMany({
      where: {
        tenantId: context.tenantId,
        campusId: context.campusId,
        campus: { is: { status: "ACTIVE", tenant: { is: { status: "ACTIVE" } } } },
        membership: {
          is: {
            userId: context.actorId,
            status: "ACTIVE",
            user: { is: { status: "ACTIVE" } },
          },
        },
      },
      select: { membershipId: true },
      take: 2,
    });
    if (memberships.length !== 1) throw forbidden();
    return memberships[0]!.membershipId;
  }

  async #staffMembershipId(database: Database, context: ParentPickupContext): Promise<string> {
    if (
      !validUuid(context.actorId) ||
      !validUuid(context.tenantId) ||
      !validUuid(context.campusId) ||
      !context.capabilities.includes("attendance:write")
    )
      throw forbidden();
    const memberships = await database.membershipCampus.findMany({
      where: {
        tenantId: context.tenantId,
        campusId: context.campusId,
        campus: { is: { status: "ACTIVE", tenant: { is: { status: "ACTIVE" } } } },
        membership: {
          is: {
            userId: context.actorId,
            status: "ACTIVE",
            user: { is: { status: "ACTIVE" } },
          },
        },
      },
      select: { membershipId: true },
      take: 2,
    });
    if (memberships.length !== 1) throw forbidden();
    return memberships[0]!.membershipId;
  }

  async #activeRelationships(
    database: Database,
    context: ParentPickupContext,
  ): Promise<RelationshipRow[]> {
    return database.guardianRelationship.findMany({
      where: relationshipWhere(context),
      include: relationshipInclude,
      orderBy: [{ student: { classRef: "asc" } }, { student: { displayRef: "asc" } }],
    });
  }

  async #ownedAuthorization(
    database: Database,
    context: ParentPickupContext,
    authorizationId: string,
  ): Promise<AuthorizationRow> {
    if (!validUuid(authorizationId)) throw invalid();
    const row = await database.pickupAuthorization.findFirst({
      where: { id: authorizationId, ...authorizationWhere(context) },
      include: authorizationInclude,
    });
    if (!row) throw notFound();
    return row;
  }

  async #credentialForStaff(
    database: Database,
    context: ParentPickupContext,
    credential: string,
    now: Date,
  ): Promise<{
    readonly credential: PickupCredentialRow;
    readonly attendance: Prisma.AttendanceRecordGetPayload<object>;
  }> {
    const stored = await database.pickupCredential.findFirst({
      where: {
        tenantId: context.tenantId,
        campusId: context.campusId,
        credentialHash: credentialDigest(credential),
        consumedAt: null,
        invalidatedAt: null,
        expiresAt: { gt: now },
      },
      include: credentialInclude,
    });
    if (!stored) throw conflict();
    const authorization = stored.authorization;
    if (stored.authorizationVersion !== authorization.version || !validNow(authorization, now))
      throw conflict();

    const relationship = await database.guardianRelationship.findFirst({
      where: {
        tenantId: context.tenantId,
        campusId: context.campusId,
        id: authorization.guardianRelationshipId,
        studentId: authorization.studentId,
        guardianUserId: authorization.guardianUserId,
        ...relationIsCurrent(),
        campus: { is: { status: "ACTIVE", tenant: { is: { status: "ACTIVE" } } } },
        guardian: { is: { status: "ACTIVE" } },
        student: { is: { status: "ACTIVE" } },
      },
      select: { id: true },
    });
    if (!relationship) throw conflict();

    const serviceDate = new Date(`${shanghaiParts(now).date}T00:00:00.000Z`);
    const attendance = await database.attendanceRecord.findFirst({
      where: {
        tenantId: context.tenantId,
        campusId: context.campusId,
        studentId: authorization.studentId,
        serviceDate,
        status: "ARRIVED",
        corrections: { none: { status: "PENDING" } },
      },
    });
    if (!attendance) throw conflict();
    const pickupRecord = await database.pickupRecord.findFirst({
      where: {
        tenantId: context.tenantId,
        campusId: context.campusId,
        studentId: authorization.studentId,
        serviceDate,
      },
      select: { id: true },
    });
    if (pickupRecord) throw conflict();
    return { credential: stored, attendance };
  }

  #transaction<T>(operation: (database: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma
      .$transaction(operation, { isolationLevel: "Serializable" })
      .catch((error: unknown) => {
        if (isRecord(error) && (error.code === "P2002" || error.code === "P2034")) throw conflict();
        throw error;
      });
  }
}
