import { randomUUID } from "node:crypto";
import {
  LocalRepository,
  type Attendance,
  type Binding,
  type LocalAudit,
  type PickupAuthorization,
  type PickupException,
  type PickupExceptionCategory,
  type PickupExceptionOutcome,
  type PickupRecord,
  type PickupRecipient,
} from "./repository.js";
import { studentForId, studentsForMember, type LocalAction, type LocalMember } from "./sessions.js";
import { exactBody, LocalError } from "./binding-leave.service.js";
import { PickupCredentialStore } from "./pickup-credentials.js";

const unavailable = () => new LocalError(403, "UNAVAILABLE");
const invalid = () => new LocalError(400, "INVALID_REQUEST");
const conflict = () => new LocalError(409, "STATE_CONFLICT");
const RECIPIENT_LABELS: Record<PickupRecipient, string> = {
  "pickup-alpha": "示例接送人甲",
  "pickup-beta": "示例接送人乙",
};
const CATEGORIES: readonly PickupExceptionCategory[] = [
  "NO_AUTHORIZATION",
  "INFORMATION_MISMATCH",
  "INVALID_CREDENTIAL",
  "OVERDUE",
];
const OUTCOMES: readonly PickupExceptionOutcome[] = [
  "CONTACT_GUARDIAN",
  "INFORMATION_RECHECKED",
  "ARRANGEMENT_CONFIRMED",
];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const HHMM = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function permitted(member: LocalMember, action: LocalAction) {
  if (!member.actions.includes(action)) throw unavailable();
}
function scoped(
  member: LocalMember,
  row: Pick<PickupAuthorization, "tenantId" | "campusId" | "classId">,
) {
  return (
    member.tenantId === row.tenantId &&
    member.campusId === row.campusId &&
    member.classIds.includes(row.classId)
  );
}
function validDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    ISO_DATE.test(value) &&
    Number.isFinite(Date.parse(`${value}T00:00:00.000Z`)) &&
    new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value
  );
}
function validTime(value: unknown): value is string {
  return typeof value === "string" && HHMM.test(value);
}
function expectedVersion(value: unknown) {
  if (!Number.isSafeInteger(value) || (value as number) < 1) throw invalid();
  return value as number;
}
function serverParts(now: number) {
  const values = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .formatToParts(now)
    .reduce<Record<string, string>>((result, part) => {
      if (part.type !== "literal") result[part.type] = part.value;
      return result;
    }, {});
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}`,
  };
}
function atShanghai(date: string, time: string) {
  return Date.parse(`${date}T${time}:00+08:00`);
}
function dayAtShanghai(date: string) {
  return Date.parse(`${date}T00:00:00+08:00`);
}
function dateRangeOk(startDate: unknown, endDate: unknown) {
  if (!validDate(startDate) || !validDate(endDate) || endDate < startDate) return false;
  return dayAtShanghai(endDate) - dayAtShanghai(startDate) <= 90 * 86400000;
}
function activeAt(row: PickupAuthorization, now: number) {
  if (row.status !== "ACTIVE") return false;
  if (row.type === "REGULAR") {
    const current = serverParts(now);
    return (
      row.startDate <= current.date &&
      current.date <= row.endDate &&
      row.startTime <= current.time &&
      current.time <= row.endTime
    );
  }
  return (
    atShanghai(row.startDate, row.startTime) <= now && now <= atShanghai(row.endDate, row.endTime)
  );
}
function studentLabel(studentId: string) {
  const student = studentForId(studentId);
  if (!student) throw unavailable();
  return student;
}

function authorizationView(row: PickupAuthorization, binding: Binding | undefined, now: number) {
  const student = studentLabel(row.studentId);
  if (!binding || binding.status !== "APPROVED") throw unavailable();
  return {
    id: row.id,
    version: row.version,
    status: row.status,
    currentlyValid: activeAt(row, now),
    bindingId: row.bindingId,
    studentId: student.id,
    studentAlias: student.alias,
    studentLabel: student.label,
    classLabel: student.classLabel,
    campusLabel: student.campusLabel,
    recipient: row.recipient,
    recipientLabel: RECIPIENT_LABELS[row.recipient],
    type: row.type,
    startDate: row.startDate,
    endDate: row.endDate,
    startTime: row.startTime,
    endTime: row.endTime,
  };
}

export class PickupService {
  readonly #credentials: PickupCredentialStore;
  constructor(
    private readonly repository: LocalRepository,
    private readonly now: () => number = Date.now,
    credentials?: PickupCredentialStore,
  ) {
    this.#credentials = credentials ?? new PickupCredentialStore(now);
  }

  clock() {
    const current = serverParts(this.now());
    return {
      serverNow: new Date(this.now()).toISOString(),
      serverDate: current.date,
      serverTime: current.time,
    };
  }

  authorizations(member: LocalMember) {
    if (!member.actions.includes("pickup:authorize") && !member.actions.includes("pickup:read"))
      throw unavailable();
    return this.repository
      .list()
      .filter((row): row is PickupAuthorization => row.kind === "pickupAuthorization")
      .filter((row) => this.canSeeAuthorization(member, row))
      .map((row) => authorizationView(row, this.sourceBinding(row), this.now()));
  }

  authorization(member: LocalMember, id: string) {
    const row = this.visibleAuthorization(member, id);
    return authorizationView(row, this.sourceBinding(row), this.now());
  }

  createAuthorization(member: LocalMember, body: unknown) {
    permitted(member, "pickup:authorize");
    const data = exactBody(body, [
      "bindingId",
      "recipient",
      "type",
      "startDate",
      "endDate",
      "startTime",
      "endTime",
    ]);
    if (
      (data.recipient !== "pickup-alpha" && data.recipient !== "pickup-beta") ||
      (data.type !== "REGULAR" && data.type !== "TEMPORARY") ||
      !dateRangeOk(data.startDate, data.endDate) ||
      !validTime(data.startTime) ||
      !validTime(data.endTime) ||
      data.startTime > data.endTime ||
      (data.type === "TEMPORARY" && data.startDate !== data.endDate)
    )
      throw invalid();
    const binding =
      typeof data.bindingId === "string" ? this.repository.get(data.bindingId) : undefined;
    if (
      !binding ||
      binding.kind !== "binding" ||
      binding.status !== "APPROVED" ||
      binding.guardianId !== member.actorId ||
      !scoped(member, binding)
    )
      throw unavailable();
    const now = new Date(this.now()).toISOString();
    const row: PickupAuthorization = {
      id: randomUUID(),
      version: 1,
      kind: "pickupAuthorization",
      bindingId: binding.id,
      guardianId: binding.guardianId,
      studentId: binding.studentId,
      tenantId: binding.tenantId,
      campusId: binding.campusId,
      classId: binding.classId,
      recipient: data.recipient as PickupRecipient,
      type: data.type as PickupAuthorization["type"],
      startDate: data.startDate as string,
      endDate: data.endDate as string,
      startTime: data.startTime as string,
      endTime: data.endTime as string,
      status: "DRAFT",
      createdBy: member.actorId,
      createdAt: now,
      updatedBy: member.actorId,
      updatedAt: now,
    };
    this.repository.insert(row);
    this.audit(member, row, "pickup.authorization.create");
    return authorizationView(row, binding, this.now());
  }

  activate(member: LocalMember, id: string, body: unknown) {
    permitted(member, "pickup:authorize");
    const data = exactBody(body, ["version"]),
      row = this.visibleAuthorization(member, id);
    if (row.guardianId !== member.actorId) throw unavailable();
    if (row.version !== expectedVersion(data.version)) throw conflict();
    if (row.status !== "DRAFT" || row.endDate < serverParts(this.now()).date) throw conflict();
    const next: PickupAuthorization = {
      ...row,
      version: row.version + 1,
      status: "ACTIVE",
      updatedBy: member.actorId,
      updatedAt: new Date(this.now()).toISOString(),
    };
    if (!this.repository.replaceBatch([next])) throw conflict();
    this.audit(member, next, "pickup.authorization.activate");
    return authorizationView(next, this.sourceBinding(next), this.now());
  }

  revoke(member: LocalMember, id: string, body: unknown) {
    permitted(member, "pickup:authorize");
    const data = exactBody(body, ["version"]),
      row = this.visibleAuthorization(member, id);
    if (row.guardianId !== member.actorId) throw unavailable();
    if (row.version !== expectedVersion(data.version)) throw conflict();
    if (row.status !== "ACTIVE") throw conflict();
    const next: PickupAuthorization = {
      ...row,
      version: row.version + 1,
      status: "REVOKED",
      updatedBy: member.actorId,
      updatedAt: new Date(this.now()).toISOString(),
    };
    if (!this.repository.replaceBatch([next])) throw conflict();
    this.#credentials.revokeAuthorization(next.id);
    this.audit(member, next, "pickup.authorization.revoke");
    return authorizationView(next, this.sourceBinding(next), this.now());
  }

  issueCredential(member: LocalMember, id: string, body: unknown) {
    permitted(member, "pickup:authorize");
    const data = exactBody(body, ["version"]),
      row = this.visibleAuthorization(member, id);
    if (row.guardianId !== member.actorId) throw unavailable();
    if (row.version !== expectedVersion(data.version) || !activeAt(row, this.now()))
      throw conflict();
    const binding = this.sourceBinding(row);
    if (!binding || binding.status !== "APPROVED") throw unavailable();
    const expiresAt = Math.min(this.now() + 5 * 60 * 1000, atShanghai(row.endDate, row.endTime));
    return this.#credentials.issue({
      authorizationId: row.id,
      authorizationVersion: row.version,
      guardianId: row.guardianId,
      studentId: row.studentId,
      expiresAt,
    });
  }

  queue(member: LocalMember) {
    permitted(member, "pickup:verify");
    const { date } = serverParts(this.now());
    const students = studentsForMember(member);
    return {
      ...this.clock(),
      students: students.map((student) => {
        const attendance = this.repository
          .list()
          .find(
            (row): row is Attendance =>
              row.kind === "attendance" &&
              row.studentId === student.id &&
              row.date === date &&
              scoped(member, row),
          );
        const authorization = this.repository
          .list()
          .find(
            (row): row is PickupAuthorization =>
              row.kind === "pickupAuthorization" &&
              row.studentId === student.id &&
              scoped(member, row) &&
              activeAt(row, this.now()) &&
              this.sourceBinding(row)?.status === "APPROVED",
          );
        const completed = this.repository
          .list()
          .some(
            (row): row is PickupRecord =>
              row.kind === "pickup" && row.studentId === student.id && row.date === date,
          );
        return {
          studentId: student.id,
          studentLabel: student.label,
          attendanceId: attendance?.id ?? null,
          attendanceVersion: attendance?.version ?? null,
          attendanceStatus: attendance?.status ?? "NOT_RECORDED",
          expectedBy: authorization?.endTime ?? null,
          overdue: Boolean(authorization && this.now() > atShanghai(date, authorization.endTime)),
          completed,
        };
      }),
      items: this.authorizationsForStaff(member).map((row) =>
        authorizationView(row, this.sourceBinding(row), this.now()),
      ),
    };
  }

  startVerification(member: LocalMember, body: unknown) {
    permitted(member, "pickup:verify");
    const data = exactBody(body, ["student", "credential"]);
    if (typeof data.student !== "string") throw invalid();
    const student = studentsForMember(member).find((item) => item.alias === data.student);
    if (!student) throw unavailable();
    if (typeof data.credential !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(data.credential))
      throw unavailable();
    const credential = this.#credentials.find(data.credential);
    if (!credential || credential.studentId !== student.id) throw conflict();
    const auth = this.repository.get(credential.authorizationId);
    if (
      !auth ||
      auth.kind !== "pickupAuthorization" ||
      auth.version !== credential.authorizationVersion ||
      !activeAt(auth, this.now()) ||
      !scoped(member, auth) ||
      this.sourceBinding(auth)?.status !== "APPROVED"
    )
      throw conflict();
    const { date } = serverParts(this.now());
    const attendance = this.repository
      .list()
      .find(
        (row): row is Attendance =>
          row.kind === "attendance" &&
          row.studentId === student.id &&
          row.date === date &&
          scoped(member, row),
      );
    if (!attendance || attendance.status !== "ARRIVED" || attendance.correction) throw conflict();
    if (
      this.repository
        .list()
        .some(
          (row): row is PickupRecord =>
            row.kind === "pickup" && row.studentId === student.id && row.date === date,
        )
    )
      throw conflict();
    const step = this.#credentials.createStep(
      credential,
      member.actorId,
      attendance.id,
      attendance.version,
    );
    return {
      id: step.id,
      version: step.version,
      expiresAt: new Date(step.expiresAt).toISOString(),
      authorizationId: step.authorizationId,
      authorizationVersion: step.authorizationVersion,
      attendanceId: step.attendanceId,
      attendanceVersion: step.attendanceVersion,
      studentId: student.id,
      studentLabel: student.label,
      recipient: auth.recipient,
      recipientLabel: RECIPIENT_LABELS[auth.recipient],
    };
  }

  confirmVerification(member: LocalMember, id: string, body: unknown) {
    permitted(member, "pickup:verify");
    const data = exactBody(body, ["version", "checks"]),
      step = this.#credentials.getStep(id);
    if (!step || step.actorId !== member.actorId) throw unavailable();
    if (step.version !== expectedVersion(data.version)) throw conflict();
    const checks = exactBody(data.checks, ["student", "recipient", "authorization"]);
    if (checks.student !== true || checks.recipient !== true || checks.authorization !== true)
      throw invalid();
    const credential = this.#credentials.credentialForStep(step);
    const auth = this.repository.get(step.authorizationId);
    const binding = auth?.kind === "pickupAuthorization" ? this.sourceBinding(auth) : undefined;
    if (
      !credential ||
      !auth ||
      auth.kind !== "pickupAuthorization" ||
      auth.version !== step.authorizationVersion ||
      auth.status !== "ACTIVE" ||
      !activeAt(auth, this.now()) ||
      !binding ||
      binding.status !== "APPROVED" ||
      !scoped(member, auth)
    )
      throw conflict();
    const attendance = this.repository.get(step.attendanceId);
    if (
      !attendance ||
      attendance.kind !== "attendance" ||
      attendance.version !== step.attendanceVersion ||
      attendance.status !== "ARRIVED" ||
      attendance.correction ||
      attendance.studentId !== step.studentId ||
      !scoped(member, attendance)
    )
      throw conflict();
    const { date, time } = serverParts(this.now());
    if (
      attendance.date !== date ||
      (attendance.arrivalTime !== null && time < attendance.arrivalTime)
    )
      throw conflict();
    if (
      this.repository
        .list()
        .some(
          (row): row is PickupRecord =>
            row.kind === "pickup" && row.studentId === attendance.studentId && row.date === date,
        )
    )
      throw conflict();
    const nextAttendance: Attendance = {
      ...attendance,
      version: attendance.version + 1,
      status: "DEPARTED",
      departureTime: time,
      updatedBy: member.actorId,
      updatedAt: new Date(this.now()).toISOString(),
    };
    const record: PickupRecord = {
      id: randomUUID(),
      version: 1,
      kind: "pickup",
      authorizationId: auth.id,
      authorizationVersion: auth.version,
      bindingId: binding.id,
      studentId: attendance.studentId,
      tenantId: attendance.tenantId,
      campusId: attendance.campusId,
      classId: attendance.classId,
      date,
      time,
      recipient: auth.recipient,
      teacherId: member.actorId,
      deviceLabel: "示例现场终端",
      attendanceId: attendance.id,
      attendanceVersion: nextAttendance.version,
      checks: { student: true, recipient: true, authorization: true },
      createdAt: new Date(this.now()).toISOString(),
    };
    if (!this.#credentials.reserve(step.id)) throw conflict();
    if (!this.repository.replaceAndInsertBatch([nextAttendance], [record])) {
      this.#credentials.release(step.id);
      throw conflict();
    }
    this.#credentials.finalize(step.id);
    this.audit(member, record, "pickup.confirm");
    this.audit(member, nextAttendance, "attendance.depart");
    return this.staffRecordView(record);
  }

  records(member: LocalMember) {
    if (!member.actions.includes("pickup:read") && !member.actions.includes("pickup:authorize"))
      throw unavailable();
    return this.repository
      .list()
      .filter((row): row is PickupRecord => row.kind === "pickup")
      .filter((row) => this.canSeeRecord(member, row))
      .map((row) =>
        member.actions.includes("pickup:authorize")
          ? this.parentRecordView(member, row)
          : this.staffRecordView(row),
      );
  }

  summary(member: LocalMember) {
    permitted(member, "pickup:summary");
    const rows = this.repository.list();
    return {
      synthetic: true,
      counts: {
        activeAuthorizations: rows.filter(
          (row) => row.kind === "pickupAuthorization" && row.status === "ACTIVE",
        ).length,
        completedRecords: rows.filter((row) => row.kind === "pickup").length,
        openExceptions: rows.filter(
          (row) => row.kind === "pickupException" && row.status === "OPEN",
        ).length,
        followingExceptions: rows.filter(
          (row) => row.kind === "pickupException" && row.status === "FOLLOWING",
        ).length,
        resolvedExceptions: rows.filter(
          (row) => row.kind === "pickupException" && row.status === "RESOLVED",
        ).length,
      },
    };
  }

  exceptions(member: LocalMember) {
    if (!member.actions.includes("pickup:verify") && !member.actions.includes("pickup:review"))
      throw unavailable();
    return this.repository
      .list()
      .filter((row): row is PickupException => row.kind === "pickupException")
      .filter((row) => scoped(member, row) && member.classIds.includes(row.classId))
      .map((row) => this.exceptionView(row));
  }

  createException(member: LocalMember, body: unknown) {
    permitted(member, "pickup:verify");
    const data = exactBody(body, ["student", "date", "category"]);
    if (
      !validDate(data.date) ||
      typeof data.student !== "string" ||
      !CATEGORIES.includes(data.category as PickupExceptionCategory)
    )
      throw invalid();
    const student = studentsForMember(member).find((item) => item.alias === data.student);
    if (!student) throw unavailable();
    const row: PickupException = {
      id: randomUUID(),
      version: 1,
      kind: "pickupException",
      studentId: student.id,
      date: data.date,
      category: data.category as PickupExceptionCategory,
      status: "OPEN",
      createdBy: member.actorId,
      createdAt: new Date(this.now()).toISOString(),
      reviewedBy: null,
      reviewedAt: null,
      outcome: null,
      tenantId: student.tenantId,
      campusId: student.campusId,
      classId: student.classId,
    };
    this.repository.insert(row);
    this.audit(member, row, "pickup.exception.create");
    return this.exceptionView(row);
  }

  reviewException(member: LocalMember, id: string, body: unknown) {
    permitted(member, "pickup:review");
    const data = exactBody(body, ["version", "action", "outcome"]);
    if (
      (data.action !== "follow" && data.action !== "resolve") ||
      !OUTCOMES.includes(data.outcome as PickupExceptionOutcome)
    )
      throw invalid();
    const row = this.repository.get(id);
    if (!row || row.kind !== "pickupException" || !scoped(member, row)) throw unavailable();
    if (row.version !== expectedVersion(data.version)) throw conflict();
    if (
      (data.action === "follow" && row.status !== "OPEN") ||
      (data.action === "resolve" && row.status === "RESOLVED")
    )
      throw conflict();
    const next: PickupException = {
      ...row,
      version: row.version + 1,
      status: data.action === "follow" ? "FOLLOWING" : "RESOLVED",
      reviewedBy: member.actorId,
      reviewedAt: new Date(this.now()).toISOString(),
      outcome: data.outcome as PickupExceptionOutcome,
    };
    if (!this.repository.replaceBatch([next])) throw conflict();
    this.audit(member, next, `pickup.exception.${data.action}`);
    return this.exceptionView(next);
  }

  denied(member: LocalMember, action: string, objectId?: string) {
    const row = objectId ? this.repository.get(objectId) : undefined;
    this.repository.audit({
      actorId: member.actorId,
      objectId: row && scoped(member, row) ? row.id : null,
      version: null,
      action,
      outcome: "DENIED",
      at: new Date(this.now()).toISOString(),
      tenantId: member.tenantId,
      campusId: member.campusId,
    });
  }

  private sourceBinding(row: PickupAuthorization) {
    const binding = this.repository.get(row.bindingId);
    return binding?.kind === "binding" &&
      binding.guardianId === row.guardianId &&
      binding.studentId === row.studentId &&
      binding.tenantId === row.tenantId &&
      binding.campusId === row.campusId &&
      binding.classId === row.classId
      ? binding
      : undefined;
  }
  private canSeeAuthorization(member: LocalMember, row: PickupAuthorization) {
    const binding = this.sourceBinding(row);
    if (!binding || binding.status !== "APPROVED" || !scoped(member, row)) return false;
    if (member.actions.includes("pickup:authorize")) return row.guardianId === member.actorId;
    return member.actions.includes("pickup:read");
  }
  private visibleAuthorization(member: LocalMember, id: string) {
    const row = this.repository.get(id);
    if (!row || row.kind !== "pickupAuthorization" || !this.canSeeAuthorization(member, row))
      throw unavailable();
    return row;
  }
  private authorizationsForStaff(member: LocalMember) {
    return this.repository
      .list()
      .filter((row): row is PickupAuthorization => row.kind === "pickupAuthorization")
      .filter(
        (row) =>
          this.canSeeAuthorization(member, row) && !member.actions.includes("pickup:authorize"),
      );
  }
  private canSeeRecord(member: LocalMember, row: PickupRecord) {
    if (!scoped(member, row)) return false;
    if (member.actions.includes("pickup:authorize")) {
      const binding = this.repository.get(row.bindingId);
      return (
        binding?.kind === "binding" &&
        binding.guardianId === member.actorId &&
        binding.status === "APPROVED"
      );
    }
    return member.actions.includes("pickup:read") || member.actions.includes("pickup:review");
  }
  private parentRecordView(member: LocalMember, row: PickupRecord) {
    const student = studentLabel(row.studentId);
    return {
      id: row.id,
      date: row.date,
      time: row.time,
      studentId: student.id,
      studentLabel: student.label,
      recipient: RECIPIENT_LABELS[row.recipient],
      status: "COMPLETED" as const,
    };
  }
  private staffRecordView(row: PickupRecord) {
    const student = studentLabel(row.studentId);
    return {
      id: row.id,
      version: row.version,
      date: row.date,
      time: row.time,
      studentId: student.id,
      studentLabel: student.label,
      recipient: RECIPIENT_LABELS[row.recipient],
      authorizationId: row.authorizationId,
      authorizationVersion: row.authorizationVersion,
      bindingId: row.bindingId,
      attendanceId: row.attendanceId,
      attendanceVersion: row.attendanceVersion,
      deviceLabel: row.deviceLabel,
      checks: structuredClone(row.checks),
      status: "COMPLETED" as const,
    };
  }
  private exceptionView(row: PickupException) {
    const student = studentLabel(row.studentId);
    return {
      id: row.id,
      version: row.version,
      studentId: student.id,
      studentLabel: student.label,
      date: row.date,
      category: row.category,
      status: row.status,
      outcome: row.outcome,
    };
  }
  private audit(
    member: LocalMember,
    row: { id: string; version: number; tenantId: string; campusId: string },
    action: string,
  ) {
    const event: LocalAudit = {
      actorId: member.actorId,
      objectId: row.id,
      version: row.version,
      action,
      outcome: "ACCEPTED",
      at: new Date(this.now()).toISOString(),
      tenantId: row.tenantId,
      campusId: row.campusId,
    };
    this.repository.audit(event);
  }
}
