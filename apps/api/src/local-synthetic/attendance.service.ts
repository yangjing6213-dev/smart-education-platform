import { randomUUID } from "node:crypto";
import { exactBody, LocalError } from "./binding-leave.service.js";
import {
  LocalRepository,
  type Attendance,
  type AttendanceCorrection,
  type AttendanceValues,
  type Binding,
} from "./repository.js";
import { studentForId, studentsForMember, type LocalAction, type LocalMember } from "./sessions.js";

const unavailable = () => new LocalError(403, "UNAVAILABLE");
const invalid = () => new LocalError(400, "INVALID_REQUEST");
const conflict = () => new LocalError(409, "STATE_CONFLICT");
function permission(member: LocalMember, action: LocalAction) {
  if (!member.actions.includes(action)) throw unavailable();
}
function scoped(member: LocalMember, row: Attendance) {
  return (
    member.tenantId === row.tenantId &&
    member.campusId === row.campusId &&
    member.classIds.includes(row.classId)
  );
}
function expected(row: Attendance, version: unknown) {
  if (!Number.isSafeInteger(version) || (version as number) < 1) throw invalid();
  if (version !== row.version) throw conflict();
}
function validTime(value: unknown): value is string {
  return typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}
function values(value: unknown): AttendanceValues {
  const data = exactBody(value, ["status", "arrivalTime", "departureTime"]);
  if (data.status === "NOT_ARRIVED" && data.arrivalTime === null && data.departureTime === null)
    return { status: data.status, arrivalTime: null, departureTime: null };
  if (data.status === "ARRIVED" && validTime(data.arrivalTime) && data.departureTime === null)
    return { status: data.status, arrivalTime: data.arrivalTime, departureTime: null };
  if (
    data.status === "DEPARTED" &&
    validTime(data.arrivalTime) &&
    validTime(data.departureTime) &&
    data.departureTime >= data.arrivalTime
  )
    return {
      status: data.status,
      arrivalTime: data.arrivalTime,
      departureTime: data.departureTime,
    };
  throw invalid();
}
function effective(row: Attendance): AttendanceValues {
  return { status: row.status, arrivalTime: row.arrivalTime, departureTime: row.departureTime };
}

export class AttendanceService {
  constructor(
    private readonly repository: LocalRepository,
    private readonly now: () => number = Date.now,
  ) {}

  list(member: LocalMember) {
    const rows = this.repository
      .list()
      .filter((row): row is Attendance => row.kind === "attendance");
    if (member.actions.includes("attendance:read"))
      return rows.flatMap((row) => {
        const binding = this.parentBinding(member, row);
        return binding ? [this.parentView(row, binding)] : [];
      });
    return rows.filter((row) => this.canStaffRead(member, row)).map((row) => this.staffView(row));
  }
  get(member: LocalMember, id: string) {
    const row = this.repository.get(id);
    if (!row || row.kind !== "attendance") throw unavailable();
    if (member.actions.includes("attendance:read")) {
      const binding = this.parentBinding(member, row);
      if (!binding) throw unavailable();
      return this.parentView(row, binding);
    }
    if (!this.canStaffRead(member, row)) throw unavailable();
    return this.staffView(row);
  }
  create(member: LocalMember, body: unknown) {
    permission(member, "attendance:write");
    const data = exactBody(body, ["student", "date", "status", "time"]);
    if (
      typeof data.date !== "string" ||
      !/^202[6-9]-\d{2}-\d{2}$/.test(data.date) ||
      !Number.isFinite(Date.parse(data.date)) ||
      new Date(data.date).toISOString().slice(0, 10) !== data.date ||
      (data.status !== "ARRIVED" && data.status !== "NOT_ARRIVED")
    )
      throw invalid();
    const current = values({ status: data.status, arrivalTime: data.time, departureTime: null });
    const student = studentsForMember(member).find((option) => option.alias === data.student);
    if (!student) throw unavailable();
    if (
      this.repository
        .list()
        .some(
          (row) =>
            row.kind === "attendance" &&
            row.tenantId === member.tenantId &&
            row.campusId === member.campusId &&
            row.studentId === student.id &&
            row.date === data.date,
        )
    )
      throw conflict();
    const row: Attendance = {
      id: randomUUID(),
      version: 1,
      kind: "attendance",
      tenantId: member.tenantId,
      campusId: member.campusId,
      classId: student.classId,
      studentId: student.id,
      date: data.date,
      ...current,
      corrected: false,
      updatedBy: member.actorId,
      updatedAt: new Date(this.now()).toISOString(),
      correction: null,
      history: [],
    };
    this.repository.insert(row);
    this.audit(member, row, "attendance.create");
    return this.staffView(row);
  }
  transition(member: LocalMember, id: string, body: unknown, action: "arrive" | "depart") {
    permission(member, "attendance:write");
    const data = exactBody(body, ["version", "time"]),
      row = this.staffRow(member, id);
    expected(row, data.version);
    if (!validTime(data.time)) throw invalid();
    if (
      row.correction?.status === "PENDING" ||
      (action === "arrive" ? row.status !== "NOT_ARRIVED" : row.status !== "ARRIVED")
    )
      throw conflict();
    const next = values(
      action === "arrive"
        ? { status: "ARRIVED", arrivalTime: data.time, departureTime: null }
        : { status: "DEPARTED", arrivalTime: row.arrivalTime, departureTime: data.time },
    );
    return this.change(member, row, `attendance.${action}`, next);
  }
  correction(member: LocalMember, id: string, body: unknown) {
    permission(member, "attendance:write");
    const data = exactBody(body, ["version", "reason", "proposed"]),
      row = this.staffRow(member, id);
    expected(row, data.version);
    if (row.correction?.status === "PENDING") throw conflict();
    if (
      data.reason !== "TIME_ENTRY_ERROR" &&
      data.reason !== "EVENT_ENTRY_ERROR" &&
      data.reason !== "LATE_ENTRY"
    )
      throw invalid();
    const proposed = values(data.proposed),
      original = effective(row);
    if (JSON.stringify(proposed) === JSON.stringify(original)) throw conflict();
    const correction: AttendanceCorrection = {
      id: randomUUID(),
      status: "PENDING",
      reason: data.reason,
      proposed,
      original,
      requestedBy: member.actorId,
      requestedAt: new Date(this.now()).toISOString(),
      reviewedBy: null,
      reviewedAt: null,
    };
    return this.change(member, row, "attendance.correction", { correction });
  }
  review(member: LocalMember, id: string, body: unknown) {
    permission(member, "attendance:review");
    const data = exactBody(body, ["version", "action"]),
      row = this.staffRow(member, id);
    if (data.action !== "approve" && data.action !== "return") throw invalid();
    expected(row, data.version);
    if (!row.correction || row.correction.status !== "PENDING") throw conflict();
    if (row.correction.requestedBy === member.actorId) throw unavailable();
    return this.change(member, row, `attendance.${data.action}`, {
      ...(data.action === "approve" ? { ...row.correction.proposed, corrected: true } : {}),
      correction: {
        ...row.correction,
        status: data.action === "approve" ? "APPROVED" : "RETURNED",
        reviewedBy: member.actorId,
        reviewedAt: new Date(this.now()).toISOString(),
      },
    });
  }
  private canStaffRead(member: LocalMember, row: Attendance) {
    return (
      scoped(member, row) &&
      (member.actions.includes("attendance:write") || member.actions.includes("attendance:review"))
    );
  }
  private staffRow(member: LocalMember, id: string) {
    const row = this.repository.get(id);
    if (!row || row.kind !== "attendance" || !this.canStaffRead(member, row)) throw unavailable();
    return row;
  }
  private parentBinding(member: LocalMember, row: Attendance) {
    if (!member.actions.includes("attendance:read") || !scoped(member, row)) return undefined;
    return this.repository
      .list()
      .find(
        (binding): binding is Binding =>
          binding.kind === "binding" &&
          binding.status === "APPROVED" &&
          binding.guardianId === member.actorId &&
          binding.studentId === row.studentId &&
          binding.tenantId === row.tenantId &&
          binding.campusId === row.campusId &&
          binding.classId === row.classId,
      );
  }
  private confirmedLeave(row: Attendance) {
    return this.repository.list().some((leave) => {
      if (
        leave.kind !== "leave" ||
        leave.status !== "CONFIRMED" ||
        leave.studentId !== row.studentId ||
        leave.tenantId !== row.tenantId ||
        leave.campusId !== row.campusId ||
        leave.classId !== row.classId ||
        leave.startDate > row.date ||
        leave.endDate < row.date
      )
        return false;
      const relation = this.repository.get(leave.bindingId);
      return (
        relation?.kind === "binding" &&
        relation.status === "APPROVED" &&
        relation.guardianId === leave.guardianId &&
        relation.studentId === leave.studentId &&
        relation.tenantId === leave.tenantId &&
        relation.campusId === leave.campusId &&
        relation.classId === leave.classId
      );
    });
  }
  private staffView(row: Attendance) {
    const student = studentForId(row.studentId);
    if (!student) throw unavailable();
    return {
      ...structuredClone(row),
      studentLabel: student.label,
      confirmedLeave: this.confirmedLeave(row),
    };
  }
  private parentView(row: Attendance, binding: Binding) {
    const student = studentForId(row.studentId);
    if (!student) throw unavailable();
    return {
      id: row.id,
      version: row.version,
      bindingId: binding.id,
      studentId: row.studentId,
      studentLabel: student.label,
      date: row.date,
      ...effective(row),
      corrected: row.corrected,
      confirmedLeave: this.confirmedLeave(row),
    };
  }
  private change(member: LocalMember, row: Attendance, action: string, patch: Partial<Attendance>) {
    const next = {
      ...row,
      ...patch,
      version: row.version + 1,
      updatedBy: member.actorId,
      updatedAt: new Date(this.now()).toISOString(),
    };
    if (!this.repository.replaceBatch([next])) throw conflict();
    this.audit(member, next, action);
    return this.staffView(next);
  }
  private audit(member: LocalMember, row: Attendance, action: string) {
    this.repository.audit({
      actorId: member.actorId,
      objectId: row.id,
      version: row.version,
      action,
      outcome: "ACCEPTED",
      at: new Date(this.now()).toISOString(),
      tenantId: row.tenantId,
      campusId: row.campusId,
    });
  }
}
