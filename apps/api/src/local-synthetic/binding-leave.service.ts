import { randomUUID } from "node:crypto";
import { LocalRepository, type Binding, type Leave, type ScopedRow } from "./repository.js";
import {
  studentForId,
  studentsForMember,
  memberForActor,
  type LocalAction,
  type LocalMember,
} from "./sessions.js";

export class LocalError extends Error {
  constructor(
    readonly statusCode: 400 | 403 | 409,
    readonly code: string,
  ) {
    super(code);
  }
}
const invalid = () => new LocalError(400, "INVALID_REQUEST");
const unavailable = () => new LocalError(403, "UNAVAILABLE");
const conflict = () => new LocalError(409, "STATE_CONFLICT");

export function exactBody(
  value: unknown,
  keys: readonly string[],
  optionalKeys: readonly string[] = [],
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw invalid();
  const body = value as Record<string, unknown>;
  const allowedKeys = new Set([...keys, ...optionalKeys]);
  if (
    Object.keys(body).length < keys.length ||
    keys.some((key) => !Object.hasOwn(body, key)) ||
    Object.keys(body).some((key) => !allowedKeys.has(key))
  )
    throw invalid();
  return body;
}
function expectVersion(row: ScopedRow, version: unknown) {
  if (!Number.isSafeInteger(version) || (version as number) < 1) throw invalid();
  if (row.version !== version) throw conflict();
}
function permitted(member: LocalMember, action: LocalAction) {
  if (!member.actions.includes(action)) throw unavailable();
}
function inScope(member: LocalMember, row: Pick<ScopedRow, "tenantId" | "campusId" | "classId">) {
  return (
    member.tenantId === row.tenantId &&
    member.campusId === row.campusId &&
    member.classIds.includes(row.classId)
  );
}
function validDates(body: Record<string, unknown>) {
  const { startDate, endDate, reason } = body;
  const valid = (value: unknown): value is string =>
    typeof value === "string" &&
    /^202[6-9]-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value;
  if (
    !valid(startDate) ||
    !valid(endDate) ||
    endDate < startDate ||
    Date.parse(endDate) - Date.parse(startDate) > 30 * 86400000 ||
    typeof reason !== "string" ||
    !["FAMILY_ARRANGEMENT", "TEMPORARY_MATTER"].includes(reason)
  )
    throw invalid();
  return { startDate, endDate, reason: reason as Leave["reason"] };
}
function bindingView(row: Binding) {
  const student = studentForId(row.studentId);
  if (!student) throw unavailable();
  return {
    id: row.id,
    version: row.version,
    status: row.status,
    relationship: row.relationship,
    studentId: student.id,
    studentAlias: student.alias,
    studentLabel: student.label,
    classLabel: student.classLabel,
    campusLabel: student.campusLabel,
    guardianLabel: memberForActor(row.guardianId)?.label ?? "示例监护人",
  };
}
function leaveView(row: Leave) {
  const student = studentForId(row.studentId);
  if (!student) throw unavailable();
  return {
    id: row.id,
    version: row.version,
    bindingId: row.bindingId,
    status: row.status,
    startDate: row.startDate,
    endDate: row.endDate,
    reason: row.reason,
    acknowledged: row.acknowledged,
    studentId: student.id,
    studentLabel: student.label,
    guardianLabel: memberForActor(row.guardianId)?.label ?? "示例监护人",
    updatedBy: row.updatedBy,
    updatedAt: row.updatedAt,
    history: structuredClone(row.history),
  };
}

export class BindingLeaveService {
  constructor(
    private readonly repository = new LocalRepository(),
    private readonly now: () => number = Date.now,
  ) {}

  bindings(member: LocalMember) {
    return this.repository
      .list()
      .filter((row): row is Binding => row.kind === "binding" && this.canSeeBinding(member, row))
      .map(bindingView);
  }
  binding(member: LocalMember, id: string) {
    return bindingView(this.visibleBinding(member, id));
  }

  applyBinding(member: LocalMember, body: unknown) {
    permitted(member, "binding:apply");
    const data = exactBody(body, ["student", "relationship"]);
    const student = studentsForMember(member).find((option) => option.alias === data.student);
    if (!student || data.relationship !== "GUARDIAN") throw unavailable();
    if (
      this.repository
        .list()
        .some(
          (row) =>
            row.kind === "binding" &&
            row.guardianId === member.actorId &&
            row.studentId === student.id &&
            ["PENDING", "APPROVED"].includes(row.status),
        )
    )
      throw conflict();
    const row: Binding = {
      id: randomUUID(),
      version: 1,
      kind: "binding",
      guardianId: member.actorId,
      studentId: student.id,
      tenantId: student.tenantId,
      campusId: student.campusId,
      classId: student.classId,
      relationship: "GUARDIAN",
      status: "PENDING",
      submittedAt: new Date(this.now()).toISOString(),
      reviewedAt: null,
    };
    this.repository.insert(row);
    this.audit(member, row, "binding.apply");
    return bindingView(row);
  }

  reviewBinding(member: LocalMember, id: string, body: unknown) {
    permitted(member, "binding:review");
    const data = exactBody(body, ["version", "action"]);
    if (data.action !== "approve" && data.action !== "reject") throw invalid();
    const row = this.visibleBinding(member, id);
    expectVersion(row, data.version);
    if (row.status !== "PENDING") throw conflict();
    const reviewedAt = new Date(this.now()).toISOString();
    const next: Binding = {
      ...row,
      version: row.version + 1,
      status: data.action === "approve" ? "APPROVED" : "REJECTED",
      reviewedAt,
      ...(data.action === "approve" ? { relationshipId: randomUUID() } : {}),
    };
    this.commit([next]);
    this.audit(member, next, `binding.${data.action}`);
    return bindingView(next);
  }

  endBinding(member: LocalMember, id: string, body: unknown, action: "release" | "withdraw") {
    permitted(member, "binding:apply");
    const data = exactBody(body, ["version"]);
    const row = this.visibleBinding(member, id);
    if (row.guardianId !== member.actorId) throw unavailable();
    expectVersion(row, data.version);
    if (row.status !== (action === "release" ? "APPROVED" : "PENDING")) throw conflict();
    const next: Binding = {
      ...row,
      version: row.version + 1,
      status: action === "release" ? "RELEASED" : "WITHDRAWN",
    };
    this.commit([next]);
    this.audit(member, next, `binding.${action}`);
    return bindingView(next);
  }

  leaves(member: LocalMember) {
    return this.repository
      .list()
      .filter((row): row is Leave => row.kind === "leave" && this.canSeeLeave(member, row))
      .map(leaveView);
  }
  leave(member: LocalMember, id: string) {
    return leaveView(this.visibleLeave(member, id));
  }

  applyLeave(member: LocalMember, body: unknown) {
    permitted(member, "leave:apply");
    const data = exactBody(body, ["bindingId", "startDate", "endDate", "reason"]);
    const fields = validDates(data);
    const binding =
      typeof data.bindingId === "string" ? this.repository.get(data.bindingId) : undefined;
    if (
      !binding ||
      binding.kind !== "binding" ||
      binding.status !== "APPROVED" ||
      binding.guardianId !== member.actorId ||
      !inScope(member, binding)
    )
      throw unavailable();
    this.noOverlap(binding.id, fields.startDate, fields.endDate);
    const row: Leave = {
      id: randomUUID(),
      version: 1,
      kind: "leave",
      bindingId: binding.id,
      guardianId: member.actorId,
      studentId: binding.studentId,
      tenantId: binding.tenantId,
      campusId: binding.campusId,
      classId: binding.classId,
      ...fields,
      status: "SUBMITTED",
      acknowledged: false,
      history: [],
      updatedBy: member.actorId,
      updatedAt: new Date(this.now()).toISOString(),
    };
    this.repository.insert(row);
    this.audit(member, row, "leave.apply");
    return leaveView(row);
  }

  resubmitLeave(member: LocalMember, id: string, body: unknown) {
    permitted(member, "leave:apply");
    const data = exactBody(body, ["version", "startDate", "endDate", "reason"]);
    const fields = validDates(data);
    const row = this.ownedLeave(member, id);
    expectVersion(row, data.version);
    if (row.status !== "RETURNED") throw conflict();
    this.noOverlap(row.bindingId, fields.startDate, fields.endDate, id);
    const next: Leave = {
      ...row,
      ...fields,
      version: row.version + 1,
      status: "SUBMITTED",
      acknowledged: false,
    };
    this.commit([next], member);
    this.audit(member, next, "leave.resubmit");
    return leaveView(next);
  }

  reviewLeave(member: LocalMember, id: string, body: unknown) {
    const data = exactBody(body, ["version", "action"]);
    return this.reviewBatch(member, {
      action: data.action,
      items: [{ id, version: data.version }],
    })[0];
  }

  reviewBatch(member: LocalMember, body: unknown) {
    permitted(member, "leave:review");
    const data = exactBody(body, ["action", "items"]);
    const { action, items } = data;
    if (
      (action !== "confirm" && action !== "return") ||
      !Array.isArray(items) ||
      items.length < 1 ||
      items.length > 20
    )
      throw invalid();
    const prepared = items.map((item) => {
      const input = exactBody(item, ["id", "version"]);
      if (typeof input.id !== "string") throw invalid();
      const row = this.visibleLeave(member, input.id);
      expectVersion(row, input.version);
      if (row.status !== "SUBMITTED") throw conflict();
      return {
        ...row,
        version: row.version + 1,
        status: action === "confirm" ? "CONFIRMED" : "RETURNED",
      } as Leave;
    });
    if (new Set(prepared.map((row) => row.id)).size !== prepared.length) throw invalid();
    this.commit(prepared, member);
    for (const row of prepared) this.audit(member, row, `leave.${action}`);
    return prepared.map(leaveView);
  }

  withdrawLeave(member: LocalMember, id: string, body: unknown) {
    permitted(member, "leave:apply");
    const data = exactBody(body, ["version"]),
      row = this.ownedLeave(member, id);
    expectVersion(row, data.version);
    if (row.status !== "SUBMITTED" && row.status !== "RETURNED") throw conflict();
    const next: Leave = { ...row, version: row.version + 1, status: "WITHDRAWN" };
    this.commit([next], member);
    this.audit(member, next, "leave.withdraw");
    return leaveView(next);
  }

  acknowledge(member: LocalMember, id: string, body: unknown) {
    permitted(member, "leave:apply");
    const data = exactBody(body, ["version"]),
      row = this.ownedLeave(member, id);
    expectVersion(row, data.version);
    if ((row.status !== "CONFIRMED" && row.status !== "RETURNED") || row.acknowledged)
      throw conflict();
    const next = { ...row, version: row.version + 1, acknowledged: true };
    this.commit([next], member);
    this.audit(member, next, "leave.acknowledge");
    return leaveView(next);
  }

  audits(member: LocalMember) {
    permitted(member, "audit:read");
    return this.repository
      .audits()
      .filter((row) => row.tenantId === member.tenantId && row.campusId === member.campusId)
      .map(({ actorId, objectId, version, action, outcome, at }) => ({
        actorId,
        objectId,
        version,
        action,
        outcome,
        at,
      }));
  }

  denied(member: LocalMember, action: string, objectId?: string) {
    // Caller input is never retained: use an existing scoped identifier or null.
    const row = objectId ? this.repository.get(objectId) : undefined;
    this.repository.audit({
      actorId: member.actorId,
      objectId: row && inScope(member, row) ? row.id : null,
      version: null,
      action,
      outcome: "DENIED",
      at: new Date(this.now()).toISOString(),
      tenantId: member.tenantId,
      campusId: member.campusId,
    });
  }

  private canSeeBinding(member: LocalMember, row: Binding) {
    return (
      row.status !== "RELEASED" &&
      inScope(member, row) &&
      ((member.actions.includes("binding:apply") && row.guardianId === member.actorId) ||
        member.actions.includes("binding:review"))
    );
  }
  private visibleBinding(member: LocalMember, id: string) {
    const row = this.repository.get(id);
    if (!row || row.kind !== "binding" || !this.canSeeBinding(member, row)) throw unavailable();
    return row;
  }
  private canSeeLeave(member: LocalMember, row: Leave) {
    const binding = this.repository.get(row.bindingId);
    return (
      binding?.kind === "binding" &&
      binding.status === "APPROVED" &&
      binding.guardianId === row.guardianId &&
      binding.studentId === row.studentId &&
      inScope(member, row) &&
      ((member.actions.includes("leave:apply") && row.guardianId === member.actorId) ||
        member.actions.includes("leave:review"))
    );
  }
  private visibleLeave(member: LocalMember, id: string) {
    const row = this.repository.get(id);
    if (!row || row.kind !== "leave" || !this.canSeeLeave(member, row)) throw unavailable();
    return row;
  }
  private ownedLeave(member: LocalMember, id: string) {
    const row = this.visibleLeave(member, id);
    if (row.guardianId !== member.actorId) throw unavailable();
    return row;
  }
  private noOverlap(bindingId: string, start: string, end: string, exceptId?: string) {
    if (
      this.repository
        .list()
        .some(
          (row) =>
            row.kind === "leave" &&
            row.bindingId === bindingId &&
            row.id !== exceptId &&
            row.status !== "WITHDRAWN" &&
            row.startDate <= end &&
            row.endDate >= start,
        )
    )
      throw conflict();
  }
  private commit(rows: readonly (Binding | Leave)[], member?: LocalMember) {
    for (const row of rows)
      if (row.kind === "leave" && member) {
        row.updatedBy = member.actorId;
        row.updatedAt = new Date(this.now()).toISOString();
      }
    if (!this.repository.replaceBatch(rows)) throw conflict();
  }
  private audit(member: LocalMember, row: Binding | Leave, action: string) {
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
