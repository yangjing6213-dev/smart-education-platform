import type {
  InvitedStaffTaskView,
  StaffTaskAssignmentChoice,
} from "../../../../../../packages/contracts/src/staff-tasks.js";
import { STAFF_TASK_TITLES } from "../../../../../../packages/contracts/src/staff-tasks.ts";
export const STAFF_TASK_CODES = Object.entries(STAFF_TASK_TITLES) as [
  keyof typeof STAFF_TASK_TITLES,
  string,
][];
export const STAFF_TASK_RESULTS = [
  ["COMPLETED_AS_PLANNED", "按计划完成"],
  ["FOLLOW_UP_REQUIRED", "需要继续跟进"],
  ["BLOCKED", "暂时受阻"],
] as const;
export type AdminTaskSnapshot = Readonly<{
  status: "IDLE" | "CONNECTING" | "BUSY" | "READY" | "UNAUTHENTICATED" | "FORBIDDEN" | "ERROR";
  session: null | Readonly<{ label: string }>;
  tasks: readonly InvitedStaffTaskView[];
  review: readonly InvitedStaffTaskView[];
  choices: readonly StaffTaskAssignmentChoice[];
  canAssign: boolean;
  message: string;
  error: string | null;
}>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const STATUSES = [
  "ASSIGNED",
  "CLAIMED",
  "IN_PROGRESS",
  "COMPLETED",
  "CHECKED",
  "RETURNED",
  "CANCELLED",
] as const;
const PRIORITIES = ["NORMAL", "IMPORTANT", "URGENT"] as const;
const TARGET_TYPES = ["CLASS", "STUDENT", "ACTIVITY", "CAMPUS"] as const;
const RESULTS = STAFF_TASK_RESULTS.map(([value]) => value);
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= 200;
const validDate = (value: unknown): value is string =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}$/u.test(value) &&
  Number.isFinite(Date.parse(`${value}T00:00:00.000Z`)) &&
  new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
export function parseTask(value: unknown): InvitedStaffTaskView {
  if (!object(value)) throw new Error("工作任务资料格式无效。");
  const code = STAFF_TASK_CODES.find(([candidate]) => candidate === value.code);
  if (
    typeof value.id !== "string" ||
    !UUID.test(value.id) ||
    !Number.isSafeInteger(value.version) ||
    Number(value.version) < 1 ||
    !code ||
    value.title !== code[1] ||
    !TARGET_TYPES.includes(value.targetType as never) ||
    !validDate(value.dueDate) ||
    !PRIORITIES.includes(value.priority as never) ||
    !STATUSES.includes(value.status as never) ||
    (value.result !== null && !RESULTS.includes(value.result as never)) ||
    !text(value.assigneeLabel) ||
    !text(value.creatorLabel) ||
    (value.checkerLabel !== null && !text(value.checkerLabel)) ||
    !text(value.targetLabel) ||
    typeof value.overdue !== "boolean" ||
    typeof value.updatedAt !== "string" ||
    !Number.isFinite(Date.parse(value.updatedAt)) ||
    new Date(value.updatedAt).toISOString() !== value.updatedAt ||
    !Array.isArray(value.actions)
  )
    throw new Error("工作任务资料格式无效。");
  const allowed =
    value.status === "ASSIGNED" || value.status === "RETURNED"
      ? ["claim", "cancel"]
      : value.status === "CLAIMED"
        ? ["start", "cancel"]
        : value.status === "IN_PROGRESS"
          ? ["complete", "cancel"]
          : value.status === "COMPLETED"
            ? ["check", "cancel"]
            : [];
  if (
    new Set(value.actions).size !== value.actions.length ||
    !value.actions.every((action) => allowed.includes(String(action))) ||
    (["COMPLETED", "CHECKED"].includes(String(value.status)) && value.result === null) ||
    (["CHECKED", "CANCELLED"].includes(String(value.status)) && value.overdue)
  )
    throw new Error("工作任务状态无效。");
  return {
    id: value.id,
    version: Number(value.version),
    code: code[0],
    title: code[1],
    targetType: value.targetType as InvitedStaffTaskView["targetType"],
    targetLabel: value.targetLabel,
    dueDate: value.dueDate,
    priority: value.priority as InvitedStaffTaskView["priority"],
    status: value.status as InvitedStaffTaskView["status"],
    result: value.result as InvitedStaffTaskView["result"],
    assigneeLabel: value.assigneeLabel,
    creatorLabel: value.creatorLabel,
    checkerLabel: value.checkerLabel as string | null,
    updatedAt: value.updatedAt,
    overdue: value.overdue,
    actions: value.actions as InvitedStaffTaskView["actions"],
  };
}

const validRef = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= 80;
const choiceKey = (choice: StaffTaskAssignmentChoice) =>
  JSON.stringify([choice.assigneeRef, choice.classRef, choice.targetType, choice.targetRef]);
export function parseTaskPayload(
  value: unknown,
): Pick<AdminTaskSnapshot, "tasks" | "choices" | "canAssign"> | undefined {
  try {
    if (
      !object(value) ||
      !Array.isArray(value.tasks) ||
      !Array.isArray(value.choices) ||
      typeof value.canAssign !== "boolean"
    )
      return undefined;
    const tasks = value.tasks.map(parseTask);
    if (new Set(tasks.map((row) => row.id)).size !== tasks.length) return undefined;
    const choices: StaffTaskAssignmentChoice[] = [];
    for (const item of value.choices) {
      if (
        !object(item) ||
        typeof item.assigneeRef !== "string" ||
        !UUID.test(item.assigneeRef) ||
        !text(item.assigneeLabel) ||
        typeof item.classRef !== "string" ||
        !validRef(item.classRef) ||
        !TARGET_TYPES.includes(item.targetType as never) ||
        typeof item.targetRef !== "string" ||
        !validRef(item.targetRef) ||
        !text(item.targetLabel)
      )
        return undefined;
      if (
        (item.targetType === "CLASS" && item.targetRef !== item.classRef) ||
        (item.targetType === "ACTIVITY" &&
          !["ART_WORKSHOP", "OUTDOOR_ACTIVITY", "FAMILY_OPEN_DAY"].includes(item.targetRef))
      )
        return undefined;
      choices.push({
        assigneeRef: item.assigneeRef,
        assigneeLabel: item.assigneeLabel,
        classRef: item.classRef,
        targetType: item.targetType as StaffTaskAssignmentChoice["targetType"],
        targetRef: item.targetRef,
        targetLabel: item.targetLabel,
      });
    }
    if (
      new Set(choices.map(choiceKey)).size !== choices.length ||
      (!value.canAssign && choices.length)
    )
      return undefined;
    const labels = new Map<string, string>();
    for (const choice of choices) {
      if (labels.has(choice.assigneeRef) && labels.get(choice.assigneeRef) !== choice.assigneeLabel)
        return undefined;
      labels.set(choice.assigneeRef, choice.assigneeLabel);
    }
    return { tasks, choices, canAssign: value.canAssign };
  } catch {
    return undefined;
  }
}
export function validTaskInput(value: unknown): boolean {
  if (!object(value)) return false;
  const keys = [
    "code",
    "assigneeRef",
    "classRef",
    "targetType",
    "targetRef",
    "dueDate",
    "priority",
  ];
  return (
    Object.keys(value).length === keys.length &&
    keys.every((key) => key in value) &&
    STAFF_TASK_CODES.some(([code]) => code === value.code) &&
    typeof value.assigneeRef === "string" &&
    UUID.test(value.assigneeRef) &&
    typeof value.classRef === "string" &&
    validRef(value.classRef) &&
    TARGET_TYPES.includes(value.targetType as never) &&
    typeof value.targetRef === "string" &&
    validRef(value.targetRef) &&
    validDate(value.dueDate) &&
    PRIORITIES.includes(value.priority as never)
  );
}
const EMPTY: AdminTaskSnapshot = {
  status: "IDLE",
  session: null,
  tasks: [],
  review: [],
  choices: [],
  canAssign: false,
  message: "请使用机构邀请账号登录。",
  error: null,
};
const failure = (status: number) => Object.assign(new Error("任务请求未完成"), { status });
export class StaffTasksInviteClient {
  private value: AdminTaskSnapshot = EMPTY;
  private readonly fetcher: typeof fetch;
  private generation = 0;
  private busy = false;
  public constructor(options: Readonly<{ fetcher?: typeof fetch }> = {}) {
    this.fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
  }
  public get snapshot(): AdminTaskSnapshot {
    return structuredClone(this.value);
  }
  public disconnect(): void {
    this.generation++;
    this.busy = false;
    this.value = EMPTY;
  }
  public async connect(): Promise<void> {
    if (this.busy) return;
    const generation = ++this.generation;
    this.busy = true;
    this.value = { ...EMPTY, status: "CONNECTING", message: "正在确认当前账号权限…" };
    try {
      const identity = await this.request("/me");
      if (generation !== this.generation) return;
      if (!object(identity) || !text(identity.display_name) || !Array.isArray(identity.memberships))
        throw failure(502);
      if (
        !identity.memberships.some(
          (m) =>
            object(m) &&
            m.status === "ACTIVE" &&
            Array.isArray(m.capabilities) &&
            m.capabilities.includes("task:read") &&
            ["task:assign", "task:check", "task:cancel"].some((c) =>
              (m.capabilities as unknown[]).includes(c),
            ),
        )
      )
        throw failure(403);
      this.value = { ...this.value, session: { label: identity.display_name } };
      await this.load(generation, "任务与可分派对象已更新。");
    } catch (cause) {
      if (generation === this.generation) this.fail(cause);
    } finally {
      if (generation === this.generation) this.busy = false;
    }
  }
  public async refresh(): Promise<void> {
    if (this.busy || this.value.status !== "READY") return;
    await this.perform(() => this.request("/tasks"), true);
  }
  public async create(input: Record<string, unknown>): Promise<void> {
    if (this.busy || this.value.status !== "READY") return;
    if (
      !this.value.canAssign ||
      !validTaskInput(input) ||
      !this.value.choices.some(
        (c) =>
          c.assigneeRef === input.assigneeRef &&
          c.classRef === input.classRef &&
          c.targetRef === input.targetRef &&
          c.targetType === input.targetType,
      )
    ) {
      this.value = { ...this.value, message: "请完整选择当前可分派对象和有效日期。" };
      return;
    }
    await this.perform(() => this.request("/tasks", input));
  }
  public async review(
    id: string,
    version: number,
    action: "CONFIRM" | "RETURN" | "CANCEL",
  ): Promise<void> {
    if (this.busy || this.value.status !== "READY") return;
    const row = this.value.tasks.find((r) => r.id === id),
      permission = action === "CANCEL" ? "cancel" : "check";
    if (
      !["CONFIRM", "RETURN", "CANCEL"].includes(action) ||
      !row ||
      row.version !== version ||
      !row.actions.includes(permission)
    ) {
      this.value = { ...this.value, message: "任务权限或版本已变化，请刷新后重试。" };
      return;
    }
    await this.perform(() =>
      this.request("/tasks/" + id + "/" + (action === "CANCEL" ? "cancel" : "check"), {
        version,
        ...(action === "CANCEL" ? {} : { action }),
      }),
    );
  }
  private async perform(action: () => Promise<unknown>, reading = false): Promise<void> {
    const generation = ++this.generation;
    this.busy = true;
    this.value = {
      ...EMPTY,
      session: this.value.session,
      status: "BUSY",
      message: "正在更新任务资料…",
    };
    try {
      const result = await action();
      if (generation !== this.generation) return;
      if (reading) this.accept(result, "任务已更新。");
      else {
        parseTask(result);
        await this.load(generation, "任务操作已保存。");
      }
    } catch (cause) {
      if (generation === this.generation) this.fail(cause);
    } finally {
      if (generation === this.generation) this.busy = false;
    }
  }
  private accept(payload: unknown, message: string): void {
    const data = parseTaskPayload(payload);
    if (!data) throw failure(502);
    this.value = {
      ...this.value,
      ...data,
      review: data.tasks.filter((row) => row.status === "COMPLETED"),
      status: "READY",
      message,
      error: null,
    };
  }
  private async load(generation: number, message: string): Promise<void> {
    const payload = await this.request("/tasks");
    if (generation === this.generation) this.accept(payload, message);
  }
  private async request(path: string, body?: Record<string, unknown>): Promise<unknown> {
    const response = await this.fetcher("/api/admin" + path, {
      method: body ? "POST" : "GET",
      cache: "no-store",
      credentials: "same-origin",
      redirect: "error",
      signal: AbortSignal.timeout(5000),
      headers: {
        accept: "application/json",
        ...(body ? { "content-type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) throw failure(response.status);
    const payload: unknown = await response.json();
    if (!object(payload) || !("data" in payload)) throw failure(502);
    return payload.data;
  }
  private fail(cause: unknown): void {
    const status = object(cause) ? cause.status : 0;
    const message =
      status === 401
        ? "登录状态已失效，请重新登录。"
        : status === 403
          ? "当前账号没有任务管理权限，记录内容已隐藏。"
          : status === 409
            ? "任务已被更新，请重新连接后查看最新版本。"
            : "暂时无法读取或保存任务，请重新连接后重试。";
    this.value = {
      ...EMPTY,
      status: status === 401 ? "UNAUTHENTICATED" : status === 403 ? "FORBIDDEN" : "ERROR",
      message,
      error: message,
    };
  }
}

export function taskFormOptions(
  choices: readonly StaffTaskAssignmentChoice[],
  assigneeIndex: number,
) {
  const assignees = [
    ...new Map(
      choices.map((choice) => [
        choice.assigneeRef,
        { actorId: choice.assigneeRef, label: choice.assigneeLabel },
      ]),
    ).values(),
  ];
  const selectedAssignee = assignees[assigneeIndex];
  const classes = [...new Set(choices.map((choice) => choice.classRef))];
  const targetTypes = { CLASS: "班级", STUDENT: "学生", ACTIVITY: "活动", CAMPUS: "校区" };
  const targets = choices
    .filter((choice) => choice.assigneeRef === selectedAssignee?.actorId)
    .map((choice) => ({
      ...choice,
      label:
        targetTypes[choice.targetType] +
        " · " +
        choice.targetLabel +
        (classes.length > 1 ? " · 授权班级 " + (classes.indexOf(choice.classRef) + 1) : ""),
    }));

  for (const [rows, kind] of [
    [assignees, "员工"],
    [targets, "对象"],
  ] as const) {
    const counts = new Map<string, number>();
    for (const row of rows) counts.set(row.label, (counts.get(row.label) ?? 0) + 1);
    rows.forEach((row, index) => {
      if ((counts.get(row.label) ?? 0) > 1) row.label += " · " + kind + " " + (index + 1);
    });
  }
  return { assignees, targets };
}
