import { randomUUID } from "node:crypto";
import { exactBody, LocalError } from "./binding-leave.service.js";
import {
  LocalRepository,
  type StaffTask,
  type StaffTaskCode,
  type StaffTaskPriority,
  type StaffTaskResult,
  type StaffTaskTargetType,
} from "./repository.js";
import {
  memberForActor,
  studentForId,
  taskAssigneesFor,
  type LocalAction,
  type LocalMember,
} from "./sessions.js";

const unavailable = () => new LocalError(403, "UNAVAILABLE");
const invalid = () => new LocalError(400, "INVALID_REQUEST");
const conflict = () => new LocalError(409, "STATE_CONFLICT");

const CATALOG: Record<StaffTaskCode, string> = {
  DAILY_CHECK: "完成班级日常检查",
  TEMPORARY_SUPPORT: "处理临时工作事项",
  STUDENT_FOLLOW_UP: "完成学生事项跟进",
  ACTIVITY_SETUP: "完成活动准备",
  SAFETY_RESPONSE: "跟进安全与设施事项",
};
const CODES = Object.keys(CATALOG) as StaffTaskCode[];
const TARGET_TYPES: StaffTaskTargetType[] = ["CLASS", "STUDENT", "ACTIVITY", "CAMPUS"];
const PRIORITIES: StaffTaskPriority[] = ["NORMAL", "IMPORTANT", "URGENT"];
const RESULTS: StaffTaskResult[] = ["COMPLETED_AS_PLANNED", "FOLLOW_UP_REQUIRED", "BLOCKED"];
const ACTIVITIES = new Map([
  ["ART_WORKSHOP", "美术活动"],
  ["OUTDOOR_ACTIVITY", "户外活动"],
  ["FAMILY_OPEN_DAY", "家长开放日"],
]);

function permission(member: LocalMember, action: LocalAction) {
  if (!member.actions.includes(action)) throw unavailable();
}

function scoped(member: LocalMember, row: StaffTask) {
  return (
    member.tenantId === row.tenantId &&
    member.campusId === row.campusId &&
    member.classIds.includes(row.classId)
  );
}

function expected(row: StaffTask, version: unknown) {
  if (!Number.isSafeInteger(version) || (version as number) < 1) throw invalid();
  if (row.version !== version) throw conflict();
}

function validDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}

function statusBeforeTerminal(status: StaffTask["status"]) {
  return status !== "CHECKED" && status !== "CANCELLED";
}

function shanghaiCalendarDate(now: number): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(now));
  const value = (type: "year" | "month" | "day") => parts.find((part) => part.type === type)?.value;
  const year = value("year");
  const month = value("month");
  const day = value("day");
  if (!year || !month || !day) throw new Error("Could not read the Shanghai calendar date.");
  return `${year}-${month}-${day}`;
}

function targetLabel(row: StaffTask) {
  if (row.targetType === "STUDENT") return studentForId(row.targetId)?.label ?? "合成学生";
  if (row.targetType === "ACTIVITY") return ACTIVITIES.get(row.targetId) ?? "合成活动";
  return row.targetType === "CAMPUS" ? "当前授权校区" : "当前授权班级";
}

function view(row: StaffTask, now: number) {
  const today = shanghaiCalendarDate(now);
  return {
    ...structuredClone(row),
    title: CATALOG[row.code],
    assigneeLabel: memberForActor(row.assigneeId)?.label ?? "示例员工",
    creatorLabel: memberForActor(row.createdBy)?.label ?? "示例负责人",
    checkerLabel: row.checkerId ? (memberForActor(row.checkerId)?.label ?? "示例负责人") : null,
    targetLabel: targetLabel(row),
    overdue: row.dueDate < today && statusBeforeTerminal(row.status),
    synthetic: true as const,
  };
}

export class StaffTaskService {
  constructor(
    private readonly repository: LocalRepository,
    private readonly now: () => number = Date.now,
  ) {}

  assignees(member: LocalMember) {
    permission(member, "task:assign");
    return taskAssigneesFor(member);
  }

  list(member: LocalMember) {
    permission(member, "task:read");
    const reviewer = member.actions.includes("task:check");
    return this.repository
      .list()
      .filter((row): row is StaffTask => row.kind === "staffTask")
      .filter((row) => scoped(member, row) && (reviewer || row.assigneeId === member.actorId))
      .map((row) => view(row, this.now()));
  }

  reviewQueue(member: LocalMember) {
    permission(member, "task:check");
    return this.repository
      .list()
      .filter((row): row is StaffTask => row.kind === "staffTask")
      .filter((row) => scoped(member, row) && row.status === "COMPLETED")
      .map((row) => view(row, this.now()));
  }

  create(member: LocalMember, value: unknown) {
    permission(member, "task:assign");
    const data = exactBody(value, [
      "code",
      "assigneeId",
      "targetType",
      "targetId",
      "dueDate",
      "priority",
    ]);
    if (
      typeof data.code !== "string" ||
      !CODES.includes(data.code as StaffTaskCode) ||
      typeof data.assigneeId !== "string" ||
      typeof data.targetType !== "string" ||
      !TARGET_TYPES.includes(data.targetType as StaffTaskTargetType) ||
      typeof data.targetId !== "string" ||
      !validDate(data.dueDate) ||
      typeof data.priority !== "string" ||
      !PRIORITIES.includes(data.priority as StaffTaskPriority)
    )
      throw invalid();

    const assignee = memberForActor(data.assigneeId);
    if (
      !assignee ||
      !assignee.actions.includes("task:claim") ||
      assignee.tenantId !== member.tenantId ||
      assignee.campusId !== member.campusId
    )
      throw unavailable();

    let classId: string | undefined;
    const targetType = data.targetType as StaffTaskTargetType;
    if (targetType === "CLASS") {
      classId = data.targetId;
      if (!member.classIds.includes(classId) || !assignee.classIds.includes(classId))
        throw unavailable();
    } else if (targetType === "STUDENT") {
      const student = studentForId(data.targetId);
      if (
        !student ||
        student.tenantId !== member.tenantId ||
        student.campusId !== member.campusId ||
        !member.classIds.includes(student.classId) ||
        !assignee.classIds.includes(student.classId)
      )
        throw unavailable();
      classId = student.classId;
    } else if (targetType === "ACTIVITY") {
      if (!ACTIVITIES.has(data.targetId)) throw invalid();
      classId = member.classIds.find((item) => assignee.classIds.includes(item));
      if (!classId) throw unavailable();
    } else {
      if (data.targetId !== member.campusId) throw unavailable();
      classId = member.classIds.find((item) => assignee.classIds.includes(item));
      if (!classId) throw unavailable();
    }

    const row: StaffTask = {
      id: randomUUID(),
      version: 1,
      kind: "staffTask",
      tenantId: member.tenantId,
      campusId: member.campusId,
      classId,
      code: data.code as StaffTaskCode,
      targetType,
      targetId: data.targetId,
      dueDate: data.dueDate,
      priority: data.priority as StaffTaskPriority,
      status: "ASSIGNED",
      createdBy: member.actorId,
      assigneeId: assignee.actorId,
      claimedBy: null,
      completedBy: null,
      result: null,
      checkerId: null,
      updatedBy: member.actorId,
      updatedAt: new Date(this.now()).toISOString(),
    };
    this.repository.insert(row);
    this.audit(member, row, "task.assign");
    return view(row, this.now());
  }

  claim(member: LocalMember, id: string, value: unknown) {
    permission(member, "task:claim");
    const data = exactBody(value, ["version"]);
    const row = this.row(member, id);
    expected(row, data.version);
    if (row.assigneeId !== member.actorId) throw unavailable();
    if (row.status !== "ASSIGNED" && row.status !== "RETURNED") throw conflict();
    return this.change(member, row, "task.claim", {
      status: "CLAIMED",
      claimedBy: member.actorId,
      checkerId: null,
    });
  }

  start(member: LocalMember, id: string, value: unknown) {
    permission(member, "task:start");
    const data = exactBody(value, ["version"]);
    const row = this.row(member, id);
    expected(row, data.version);
    if (row.assigneeId !== member.actorId || row.claimedBy !== member.actorId) throw unavailable();
    if (row.status !== "CLAIMED") throw conflict();
    return this.change(member, row, "task.start", { status: "IN_PROGRESS" });
  }

  complete(member: LocalMember, id: string, value: unknown) {
    permission(member, "task:complete");
    const data = exactBody(value, ["version", "result"]);
    if (typeof data.result !== "string" || !RESULTS.includes(data.result as StaffTaskResult))
      throw invalid();
    const row = this.row(member, id);
    expected(row, data.version);
    if (row.assigneeId !== member.actorId) throw unavailable();
    if (row.status !== "IN_PROGRESS") throw conflict();
    return this.change(member, row, "task.complete", {
      status: "COMPLETED",
      result: data.result as StaffTaskResult,
      completedBy: member.actorId,
    });
  }

  check(member: LocalMember, id: string, value: unknown) {
    permission(member, "task:check");
    const data = exactBody(value, ["version", "action"]);
    if (data.action !== "CONFIRM" && data.action !== "RETURN") throw invalid();
    const row = this.row(member, id);
    if (row.assigneeId === member.actorId) throw unavailable();
    expected(row, data.version);
    if (row.status !== "COMPLETED") throw conflict();
    return this.change(member, row, data.action === "CONFIRM" ? "task.check" : "task.return", {
      status: data.action === "CONFIRM" ? "CHECKED" : "RETURNED",
      checkerId: member.actorId,
    });
  }

  cancel(member: LocalMember, id: string, value: unknown) {
    permission(member, "task:cancel");
    const data = exactBody(value, ["version"]);
    const row = this.row(member, id);
    expected(row, data.version);
    if (!statusBeforeTerminal(row.status)) throw conflict();
    return this.change(member, row, "task.cancel", { status: "CANCELLED" });
  }

  denied(member: LocalMember, action: string, id: string) {
    this.repository.audit({
      actorId: member.actorId,
      objectId: id || null,
      version: null,
      action,
      outcome: "DENIED",
      at: new Date(this.now()).toISOString(),
      tenantId: member.tenantId,
      campusId: member.campusId,
    });
  }

  private row(member: LocalMember, id: string) {
    const row = this.repository.get(id);
    if (!row || row.kind !== "staffTask" || !scoped(member, row)) throw unavailable();
    return row;
  }

  private change(
    member: LocalMember,
    row: StaffTask,
    action: string,
    patch: Partial<
      Pick<StaffTask, "status" | "claimedBy" | "completedBy" | "result" | "checkerId">
    >,
  ) {
    const next: StaffTask = {
      ...row,
      ...patch,
      version: row.version + 1,
      updatedBy: member.actorId,
      updatedAt: new Date(this.now()).toISOString(),
    };
    if (!this.repository.replaceBatch([next])) throw conflict();
    this.audit(member, next, action);
    return view(next, this.now());
  }

  private audit(member: LocalMember, row: StaffTask, action: string) {
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
