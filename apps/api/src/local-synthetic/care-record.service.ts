import { randomUUID } from "node:crypto";
import { exactBody, LocalError } from "./binding-leave.service.js";
import { LocalRepository, type Binding, type Care, type CareValues } from "./repository.js";
import { studentForId, studentsForMember, type LocalAction, type LocalMember } from "./sessions.js";

const LABELS = {
  arrival: { ARRIVED_AS_PLANNED: "按计划到校", LATE: "迟到", ABSENT: "未到" },
  homework: { COMPLETED: "已完成整理", IN_PROGRESS: "正在完成", NEEDS_SUPPORT: "需要协助" },
  meal: { FINISHED: "按示例完成用餐", PARTIAL: "部分用餐", NOT_RECORDED: "未记录" },
  rest: { RESTED: "完成休息", QUIET_ACTIVITY: "安静活动", NOT_RECORDED: "未记录" },
  activity: { PARTICIPATED: "参与活动", OBSERVED: "观察活动", NOT_RECORDED: "未记录" },
  wellbeing: { ROUTINE: "日常状态", CHECK_IN: "需要老师留意", FOLLOW_UP: "需要后续跟进" },
};
const unavailable = () => new LocalError(403, "UNAVAILABLE");
const invalid = () => new LocalError(400, "INVALID_REQUEST");
const conflict = () => new LocalError(409, "STATE_CONFLICT");
function permission(member: LocalMember, action: LocalAction) {
  if (!member.actions.includes(action)) throw unavailable();
}
function scoped(member: LocalMember, row: Pick<Care, "tenantId" | "campusId" | "classId">) {
  return (
    member.tenantId === row.tenantId &&
    member.campusId === row.campusId &&
    member.classIds.includes(row.classId)
  );
}
function expected(row: Care, version: unknown) {
  if (!Number.isSafeInteger(version) || (version as number) < 1) throw invalid();
  if (version !== row.version) throw conflict();
}
function careValues(value: unknown): CareValues {
  const fields = Object.keys(LABELS) as (keyof CareValues)[];
  const data = exactBody(value, fields);
  if (
    fields.some(
      (key) => typeof data[key] !== "string" || !Object.hasOwn(LABELS[key], data[key] as string),
    )
  )
    throw invalid();
  return structuredClone(data) as unknown as CareValues;
}

function staffView(row: Care) {
  const student = studentForId(row.studentId);
  if (!student) throw unavailable();
  return { ...structuredClone(row), studentLabel: student.label };
}

export class CareRecordService {
  constructor(
    private readonly repository: LocalRepository,
    private readonly now: () => number = Date.now,
  ) {}

  list(member: LocalMember) {
    const rows = this.repository.list().filter((row): row is Care => row.kind === "care");
    if (member.actions.includes("care:read"))
      return rows.flatMap((row) => {
        const binding = this.parentBinding(member, row);
        return binding ? [this.parentView(member, row, binding)] : [];
      });
    return rows.filter((row) => this.canStaffRead(member, row)).map(staffView);
  }
  get(member: LocalMember, id: string) {
    const row = this.repository.get(id);
    if (!row || row.kind !== "care") throw unavailable();
    if (member.actions.includes("care:read")) {
      const binding = this.parentBinding(member, row);
      if (!binding) throw unavailable();
      return this.parentView(member, row, binding);
    }
    if (!this.canStaffRead(member, row)) throw unavailable();
    return staffView(row);
  }
  create(member: LocalMember, body: unknown) {
    permission(member, "care:write");
    const data = exactBody(body, ["student", "date", "values"]);
    const values = careValues(data.values);
    if (
      typeof data.date !== "string" ||
      !/^202[6-9]-\d{2}-\d{2}$/.test(data.date) ||
      !Number.isFinite(Date.parse(data.date)) ||
      new Date(data.date).toISOString().slice(0, 10) !== data.date
    )
      throw invalid();
    const student = studentsForMember(member).find((option) => option.alias === data.student);
    if (!student) throw unavailable();
    if (
      this.repository
        .list()
        .some(
          (row) =>
            row.kind === "care" &&
            row.studentId === student.id &&
            row.date === data.date &&
            row.status !== "CANCELLED",
        )
    )
      throw conflict();
    const row: Care = {
      id: randomUUID(),
      version: 1,
      kind: "care",
      tenantId: student.tenantId,
      campusId: student.campusId,
      classId: student.classId,
      studentId: student.id,
      date: data.date,
      values,
      status: "DRAFT",
      createdBy: member.actorId,
      reviewedBy: null,
      updatedBy: member.actorId,
      updatedAt: new Date(this.now()).toISOString(),
      published: false,
      publicationVersion: 0,
      history: [],
    };
    this.repository.insert(row);
    this.audit(member, row, "care.create");
    return staffView(row);
  }
  edit(member: LocalMember, id: string, body: unknown) {
    permission(member, "care:write");
    const data = exactBody(body, ["version", "values"]),
      values = careValues(data.values),
      row = this.owned(member, id);
    expected(row, data.version);
    if (row.published || !["DRAFT", "RETURNED", "CONFIRMED"].includes(row.status)) throw conflict();
    return this.change(member, row, "care.edit", {
      values,
      status: "DRAFT",
      reviewedBy: null,
      published: false,
    });
  }
  transition(
    member: LocalMember,
    id: string,
    body: unknown,
    action: "submit" | "withdraw" | "resubmit" | "publish" | "revoke-publication",
  ) {
    const publication = action === "publish" || action === "revoke-publication";
    permission(member, publication ? "care:publish" : "care:write");
    const data = exactBody(body, action === "resubmit" ? ["version", "values"] : ["version"]);
    const row = publication ? this.staffRow(member, id) : this.owned(member, id);
    expected(row, data.version);
    if (action === "submit") {
      if (row.status !== "DRAFT") throw conflict();
      return this.change(member, row, "care.submit", { status: "SUBMITTED" });
    }
    if (action === "withdraw") {
      if (!["DRAFT", "SUBMITTED", "RETURNED"].includes(row.status)) throw conflict();
      return this.change(member, row, "care.withdraw", { status: "CANCELLED", published: false });
    }
    if (action === "resubmit") {
      const values = careValues(data.values);
      if (row.status !== "RETURNED") throw conflict();
      return this.change(member, row, "care.resubmit", {
        values,
        status: "SUBMITTED",
        reviewedBy: null,
        published: false,
      });
    }
    if (row.status !== "CONFIRMED" || !row.reviewedBy || row.reviewedBy === row.createdBy)
      throw conflict();
    if (action === "publish") {
      if (row.published) throw conflict();
      return this.change(member, row, "care.publish", {
        published: true,
        publicationVersion: row.publicationVersion + 1,
      });
    }
    if (!row.published) throw conflict();
    return this.change(member, row, "care.revoke-publication", { published: false });
  }
  review(member: LocalMember, id: string, body: unknown) {
    const data = exactBody(body, ["version", "action"]);
    return this.reviewBatch(member, {
      action: data.action,
      items: [{ id, version: data.version }],
    })[0];
  }
  reviewBatch(member: LocalMember, body: unknown) {
    permission(member, "care:review");
    const { action, items } = exactBody(body, ["action", "items"]);
    if (
      typeof action !== "string" ||
      !["confirm", "return", "escalate"].includes(action) ||
      !Array.isArray(items) ||
      items.length < 1 ||
      items.length > 20
    )
      throw invalid();
    const prepared = items.map((item) => {
      const data = exactBody(item, ["id", "version"]);
      if (typeof data.id !== "string") throw invalid();
      const row = this.staffRow(member, data.id);
      if (row.createdBy === member.actorId) throw unavailable();
      expected(row, data.version);
      if (
        (row.status !== "SUBMITTED" && row.status !== "EXCEPTION_PENDING") ||
        (row.status === "EXCEPTION_PENDING" && action === "escalate")
      )
        throw conflict();
      return this.next(member, row, {
        status:
          action === "confirm"
            ? "CONFIRMED"
            : action === "return"
              ? "RETURNED"
              : "EXCEPTION_PENDING",
        reviewedBy: member.actorId,
        published: false,
      });
    });
    if (new Set(prepared.map((row) => row.id)).size !== prepared.length) throw invalid();
    if (!this.repository.replaceBatch(prepared)) throw conflict();
    for (const row of prepared) this.audit(member, row, `care.${action}`);
    return prepared.map(staffView);
  }
  receipt(member: LocalMember, id: string, body: unknown) {
    permission(member, "care:read");
    const data = exactBody(body, ["bindingId", "version", "publicationVersion", "action"]);
    if (data.action !== "read" && data.action !== "acknowledge") throw invalid();
    const row = this.repository.get(id);
    if (!row || row.kind !== "care") throw unavailable();
    const binding = this.parentBinding(member, row);
    if (!binding || binding.id !== data.bindingId) throw unavailable();
    expected(row, data.version);
    if (data.publicationVersion !== row.publicationVersion) throw conflict();
    const old = this.repository.careReceipt(
      member.actorId,
      binding.id,
      row.id,
      row.publicationVersion,
    );
    if (
      (data.action === "read" && old) ||
      (data.action === "acknowledge" && old?.status !== "READ")
    )
      throw conflict();
    this.repository.setCareReceipt({
      guardianId: member.actorId,
      bindingId: binding.id,
      recordId: row.id,
      publicationVersion: row.publicationVersion,
      status: data.action === "read" ? "READ" : "ACKNOWLEDGED",
    });
    this.audit(member, row, `care.${data.action}`);
    return this.parentView(member, row, binding);
  }

  private canStaffRead(member: LocalMember, row: Care) {
    return (
      scoped(member, row) &&
      (member.actions.includes("care:review") ||
        (member.actions.includes("care:write") && row.createdBy === member.actorId))
    );
  }
  private staffRow(member: LocalMember, id: string) {
    const row = this.repository.get(id);
    if (!row || row.kind !== "care" || !this.canStaffRead(member, row)) throw unavailable();
    return row;
  }
  private owned(member: LocalMember, id: string) {
    const row = this.staffRow(member, id);
    if (row.createdBy !== member.actorId) throw unavailable();
    return row;
  }
  private parentBinding(member: LocalMember, row: Care): Binding | undefined {
    if (
      !member.actions.includes("care:read") ||
      !scoped(member, row) ||
      row.status !== "CONFIRMED" ||
      !row.published
    )
      return undefined;
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
  private parentView(member: LocalMember, row: Care, binding: Binding) {
    const student = studentForId(row.studentId);
    if (!student) throw unavailable();
    const values = Object.fromEntries(
      (Object.keys(LABELS) as (keyof CareValues)[]).map((key) => [
        key,
        (LABELS[key] as Record<string, string>)[row.values[key]],
      ]),
    );
    return {
      id: row.id,
      version: row.version,
      publicationVersion: row.publicationVersion,
      bindingId: binding.id,
      date: row.date,
      studentId: student.id,
      studentLabel: student.label,
      values,
      receipt:
        this.repository.careReceipt(member.actorId, binding.id, row.id, row.publicationVersion)
          ?.status ?? "UNREAD",
    };
  }
  private next(member: LocalMember, row: Care, patch: Partial<Care>): Care {
    return {
      ...row,
      ...patch,
      version: row.version + 1,
      updatedBy: member.actorId,
      updatedAt: new Date(this.now()).toISOString(),
    };
  }
  private change(member: LocalMember, row: Care, action: string, patch: Partial<Care>) {
    const next = this.next(member, row, patch);
    if (!this.repository.replaceBatch([next])) throw conflict();
    this.audit(member, next, action);
    return staffView(next);
  }
  private audit(member: LocalMember, row: Care, action: string) {
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
