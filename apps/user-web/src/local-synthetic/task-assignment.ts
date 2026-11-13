const API_BASE = "http://127.0.0.1:4317";

export interface StaffTaskSession {
  profile: string;
  actorId: string;
  tenantId: string;
  campusId: string;
  classIds: string[];
  actions: string[];
}

export const STAFF_TASK_CODES = [
  ["DAILY_CHECK", "完成班级日常检查"],
  ["TEMPORARY_SUPPORT", "处理临时工作事项"],
  ["STUDENT_FOLLOW_UP", "完成学生事项跟进"],
  ["ACTIVITY_SETUP", "完成活动准备"],
  ["SAFETY_RESPONSE", "跟进安全与设施事项"],
] as const;

export const STAFF_TASK_RESULTS = [
  ["COMPLETED_AS_PLANNED", "按计划完成"],
  ["FOLLOW_UP_REQUIRED", "需要继续跟进"],
  ["BLOCKED", "暂时受阻"],
] as const;

const TASK_STATUSES = [
  "ASSIGNED",
  "CLAIMED",
  "IN_PROGRESS",
  "COMPLETED",
  "CHECKED",
  "RETURNED",
  "CANCELLED",
] as const;
const STATUS_LABELS: Record<(typeof TASK_STATUSES)[number], string> = {
  ASSIGNED: "待领取",
  CLAIMED: "已领取",
  IN_PROGRESS: "处理中",
  COMPLETED: "待负责人检查",
  CHECKED: "已验收",
  RETURNED: "已退回",
  CANCELLED: "已取消",
};

export interface StaffTaskView {
  id: string;
  version: number;
  kind: "staffTask";
  tenantId: string;
  campusId: string;
  classId: string;
  code: (typeof STAFF_TASK_CODES)[number][0];
  targetType: "CLASS" | "STUDENT" | "ACTIVITY" | "CAMPUS";
  targetId: string;
  dueDate: string;
  priority: "NORMAL" | "IMPORTANT" | "URGENT";
  status: (typeof TASK_STATUSES)[number];
  createdBy: string;
  assigneeId: string;
  claimedBy: string | null;
  completedBy: string | null;
  result: (typeof STAFF_TASK_RESULTS)[number][0] | null;
  checkerId: string | null;
  updatedBy: string;
  updatedAt: string;
  title: string;
  assigneeLabel: string;
  creatorLabel: string;
  checkerLabel: string | null;
  targetLabel: string;
  overdue: boolean;
  synthetic: true;
}

export type StaffTaskCommand = "claim" | "start" | "complete";

export interface StaffTaskSnapshot {
  status: "IDLE" | "CONNECTING" | "BUSY" | "READY" | "ERROR";
  session: StaffTaskSession | null;
  tasks: StaffTaskView[];
  message: string;
  error: string | null;
}

export interface StaffTaskClientOptions {
  baseUrl?: string;
  fetcher?: typeof fetch;
}

const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const uuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const date = (value: unknown): value is string =>
  typeof value === "string" &&
  /^202[6-9]-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(`${value}T00:00:00.000Z`)) &&
  new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
const text = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= 200;
const escape = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

export function parseStaffTasks(value: unknown, session: StaffTaskSession): StaffTaskView[] {
  if (!Array.isArray(value) || value.length > 200) throw new Error("Invalid task list");
  const rows = value.map((item): StaffTaskView => {
    if (!object(item)) throw new Error("Invalid task record");
    const code = STAFF_TASK_CODES.find(([candidate]) => candidate === item.code);
    const result = STAFF_TASK_RESULTS.find(([candidate]) => candidate === item.result);
    const validTargetId =
      item.targetType === "ACTIVITY"
        ? typeof item.targetId === "string" &&
          ["ART_WORKSHOP", "OUTDOOR_ACTIVITY", "FAMILY_OPEN_DAY"].includes(item.targetId)
        : uuid(item.targetId);
    if (
      !uuid(item.id) ||
      !Number.isSafeInteger(item.version) ||
      Number(item.version) < 1 ||
      item.kind !== "staffTask" ||
      item.tenantId !== session.tenantId ||
      item.campusId !== session.campusId ||
      !uuid(item.classId) ||
      !session.classIds.includes(String(item.classId)) ||
      !code ||
      typeof item.targetType !== "string" ||
      !["CLASS", "STUDENT", "ACTIVITY", "CAMPUS"].includes(item.targetType) ||
      !validTargetId ||
      !date(item.dueDate) ||
      typeof item.priority !== "string" ||
      !["NORMAL", "IMPORTANT", "URGENT"].includes(item.priority) ||
      !TASK_STATUSES.includes(item.status as (typeof TASK_STATUSES)[number]) ||
      !uuid(item.createdBy) ||
      !uuid(item.assigneeId) ||
      (item.claimedBy !== null && !uuid(item.claimedBy)) ||
      (item.completedBy !== null && !uuid(item.completedBy)) ||
      (item.result !== null && !result) ||
      (item.checkerId !== null && !uuid(item.checkerId)) ||
      !uuid(item.updatedBy) ||
      !text(item.updatedAt) ||
      item.title !== code[1] ||
      !text(item.assigneeLabel) ||
      !text(item.creatorLabel) ||
      (item.checkerLabel !== null && !text(item.checkerLabel)) ||
      !text(item.targetLabel) ||
      typeof item.overdue !== "boolean" ||
      item.synthetic !== true ||
      (!session.actions.includes("task:check") && item.assigneeId !== session.actorId)
    )
      throw new Error("Invalid task scope or fields");
    return item as unknown as StaffTaskView;
  });
  if (new Set(rows.map((row) => row.id)).size !== rows.length) throw new Error("Duplicate task id");
  return rows;
}

export function renderStaffTaskPanel(snapshot: StaffTaskSnapshot): string;
export function renderStaffTaskPanel(
  rows: readonly StaffTaskView[],
  session: Pick<StaffTaskSession, "actorId" | "actions">,
  busy?: boolean,
): string;
export function renderStaffTaskPanel(
  value: StaffTaskSnapshot | readonly StaffTaskView[],
  session?: Pick<StaffTaskSession, "actorId" | "actions">,
  busy = false,
): string {
  const snapshot = Array.isArray(value) ? null : (value as StaffTaskSnapshot);
  const rows = snapshot?.tasks ?? (value as readonly StaffTaskView[]);
  const actor = session ?? snapshot?.session ?? null;
  const isBusy = snapshot ? snapshot.status === "BUSY" || snapshot.status === "CONNECTING" : busy;
  const message = snapshot?.error ?? snapshot?.message ?? "";
  const heading = `<div class="staff-task-panel-heading"><h2 id="staff-task-title">我的工作任务</h2><span>本机共享资料 · 固定选项</span></div>`;
  if (!actor)
    return `<section class="staff-task-panel" aria-labelledby="staff-task-title">${heading}<p role="status">${escape(message)}</p><button type="button" data-staff-task-refresh ${isBusy ? "disabled" : ""}>重新连接</button></section>`;
  const cards = rows
    .map((row) => {
      const assignedToCurrent = row.assigneeId === actor.actorId;
      const actions: string[] = [];
      if (
        assignedToCurrent &&
        ["ASSIGNED", "RETURNED"].includes(row.status) &&
        actor.actions.includes("task:claim")
      )
        actions.push(
          `<button type="button" data-staff-task-action="claim" data-staff-task-id="${escape(row.id)}" data-staff-task-version="${row.version}" ${isBusy ? "disabled" : ""}>领取任务</button>`,
        );
      if (
        assignedToCurrent &&
        row.status === "CLAIMED" &&
        row.claimedBy === actor.actorId &&
        actor.actions.includes("task:start")
      )
        actions.push(
          `<button type="button" data-staff-task-action="start" data-staff-task-id="${escape(row.id)}" data-staff-task-version="${row.version}" ${isBusy ? "disabled" : ""}>开始任务</button>`,
        );
      if (
        assignedToCurrent &&
        row.status === "IN_PROGRESS" &&
        actor.actions.includes("task:complete")
      )
        actions.push(
          `<label class="staff-task-result">完成结果<select name="staff-task-result" data-staff-task-result="${escape(row.id)}" ${isBusy ? "disabled" : ""}>${STAFF_TASK_RESULTS.map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select></label><button type="button" data-staff-task-action="complete" data-staff-task-id="${escape(row.id)}" data-staff-task-version="${row.version}" ${isBusy ? "disabled" : ""}>提交完成</button>`,
        );
      const resultLabel = row.result
        ? (STAFF_TASK_RESULTS.find(([value]) => value === row.result)?.[1] ?? "")
        : "";
      return `<article class="staff-task-card" data-staff-task-item="${escape(row.id)}"><div class="staff-task-heading"><h3>${escape(row.title)}</h3><span class="staff-task-status">${STATUS_LABELS[row.status]}</span></div><p>${escape(row.targetLabel)} · 截止 ${escape(row.dueDate)} · ${row.priority === "URGENT" ? "紧急" : row.priority === "IMPORTANT" ? "重要" : "普通"}${row.overdue ? " · 已逾期" : ""}</p><p>负责人：${escape(row.creatorLabel)} · 经办：${escape(row.assigneeLabel)} · 版本 ${row.version}</p>${resultLabel ? `<p>完成结果：${resultLabel}</p>` : ""}<div class="staff-task-actions">${actions.join("")}</div></article>`;
    })
    .join("");
  const empty = rows.length === 0 ? '<p class="staff-task-empty">当前没有分配给你的任务。</p>' : "";
  const refresh = `<button type="button" data-staff-task-refresh ${isBusy ? "disabled" : ""}>刷新任务</button>`;
  return `<section class="staff-task-panel" aria-labelledby="staff-task-title">${heading}<p role="status">${escape(message)}</p>${refresh}${empty}${cards}</section>`;
}

function isAllowedTaskRequest(path: string, method: string): boolean {
  if (path === "/local/sessions") return method === "POST";
  if (path === "/local/session") return method === "GET";
  if (path === "/local/staff-tasks") return method === "GET";
  return (
    /^\/local\/staff-tasks\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/(claim|start|complete)$/iu.test(
      path,
    ) && method === "POST"
  );
}

function parseStaffTaskSession(value: unknown): StaffTaskSession {
  if (
    !object(value) ||
    value.mode !== "local-synthetic" ||
    value.profile !== "teacher-east" ||
    !uuid(value.actorId) ||
    !uuid(value.tenantId) ||
    !uuid(value.campusId) ||
    !Array.isArray(value.classIds) ||
    !value.classIds.every(uuid) ||
    !Array.isArray(value.actions) ||
    !value.actions.every((action) => typeof action === "string") ||
    !value.actions.includes("task:read")
  )
    throw new Error("当前本机示例身份不能读取工作任务。");
  return {
    profile: "teacher-east",
    actorId: value.actorId,
    tenantId: value.tenantId,
    campusId: value.campusId,
    classIds: value.classIds,
    actions: value.actions,
  };
}

export class StaffTaskClient {
  private readonly baseUrl: string;
  private readonly fetcher: typeof fetch;
  private generation = 0;
  private handle: string | null = null;
  private value: StaffTaskSnapshot = {
    status: "IDLE",
    session: null,
    tasks: [],
    message: "连接本机共享任务后查看。",
    error: null,
  };

  constructor(options: StaffTaskClientOptions = {}) {
    const base = new URL(options.baseUrl ?? API_BASE);
    if (
      base.protocol !== "http:" ||
      !["127.0.0.1", "localhost"].includes(base.hostname) ||
      base.port === "" ||
      base.username !== "" ||
      base.password !== ""
    )
      throw new Error("Only a loopback local service is allowed.");
    this.baseUrl = base.origin;
    this.fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
  }

  get snapshot(): StaffTaskSnapshot {
    return structuredClone(this.value);
  }

  disconnect(): void {
    this.generation += 1;
    this.handle = null;
    this.value = {
      status: "IDLE",
      session: null,
      tasks: [],
      message: "本机工作任务连接已关闭。",
      error: null,
    };
  }

  async connect(): Promise<void> {
    this.disconnect();
    const generation = this.generation;
    this.value = { ...this.value, status: "CONNECTING", message: "正在连接本机共享任务…" };
    try {
      const bootstrap = await this.request("/local/sessions", "POST", { profile: "teacher-east" });
      if (
        !object(bootstrap) ||
        typeof bootstrap.handle !== "string" ||
        !/^[\w-]{43}$/u.test(bootstrap.handle)
      )
        throw new Error("本机任务服务返回的登录信息无效。");
      if (generation !== this.generation) return;
      this.handle = bootstrap.handle;
      const session = parseStaffTaskSession(await this.request("/local/session"));
      if (generation !== this.generation) return;
      const tasks = await this.loadTasks(session);
      if (generation !== this.generation) return;
      this.value = {
        status: "READY",
        session,
        tasks,
        message: tasks.length === 0 ? "当前没有分配给你的任务。" : "已更新本机共享任务。",
        error: null,
      };
    } catch (error) {
      if (generation !== this.generation) return;
      this.handle = null;
      this.value = {
        ...this.value,
        status: "ERROR",
        session: null,
        tasks: [],
        message: "任务页面暂时无法连接本机共享服务。",
        error: error instanceof Error ? error.message : "本机任务服务连接失败。",
      };
    }
  }

  async refresh(): Promise<void> {
    const session = this.value.session;
    if (!this.handle || !session || !["READY", "ERROR"].includes(this.value.status)) return;
    const generation = this.generation;
    this.value = { ...this.value, status: "BUSY", error: null, message: "正在更新本机任务…" };
    try {
      const tasks = await this.loadTasks(session);
      if (generation !== this.generation) return;
      this.value = {
        ...this.value,
        status: "READY",
        tasks,
        message: tasks.length === 0 ? "当前没有分配给你的任务。" : "已更新本机共享任务。",
        error: null,
      };
    } catch (error) {
      if (generation !== this.generation) return;
      this.value = {
        ...this.value,
        status: "ERROR",
        tasks: [],
        message: "更新失败，已隐藏当前任务。",
        error: error instanceof Error ? error.message : "更新任务失败。",
      };
    }
  }

  async command(
    action: StaffTaskCommand,
    id: string,
    expectedVersion: number,
    result?: StaffTaskView["result"],
  ): Promise<void> {
    const session = this.value.session;
    const row = this.value.tasks.find((task) => task.id === id && task.version === expectedVersion);
    const permission =
      action === "claim" ? "task:claim" : action === "start" ? "task:start" : "task:complete";
    if (
      this.value.status !== "READY" ||
      !this.handle ||
      !session ||
      !row ||
      row.assigneeId !== session.actorId ||
      !session.actions.includes(permission)
    )
      return;
    const allowed =
      (action === "claim" && ["ASSIGNED", "RETURNED"].includes(row.status)) ||
      (action === "start" && row.status === "CLAIMED" && row.claimedBy === session.actorId) ||
      (action === "complete" &&
        row.status === "IN_PROGRESS" &&
        STAFF_TASK_RESULTS.some(([code]) => code === result));
    if (!allowed) return;

    const generation = this.generation;
    this.value = { ...this.value, status: "BUSY", error: null, message: "正在更新任务状态…" };
    try {
      await this.request(`/local/staff-tasks/${encodeURIComponent(id)}/${action}`, "POST", {
        version: row.version,
        ...(action === "complete" ? { result } : {}),
      });
      if (generation !== this.generation) return;
      const tasks = await this.loadTasks(session);
      if (generation !== this.generation) return;
      this.value = {
        ...this.value,
        status: "READY",
        tasks,
        message: "任务状态已更新。",
        error: null,
      };
    } catch (error) {
      if (generation !== this.generation) return;
      this.value = {
        ...this.value,
        status: "ERROR",
        tasks: [],
        message: "任务更新失败，已重新加载前请勿重复提交。",
        error: error instanceof Error ? error.message : "更新任务失败。",
      };
    }
  }

  private async loadTasks(session: StaffTaskSession): Promise<StaffTaskView[]> {
    return parseStaffTasks(await this.request("/local/staff-tasks"), session);
  }

  private async request(path: string, method = "GET", body?: object): Promise<unknown> {
    if (!isAllowedTaskRequest(path, method))
      throw new Error("Task request is outside the local allowlist.");
    const url = new URL(path, this.baseUrl);
    const headers = new Headers({ Accept: "application/json" });
    if (this.handle) headers.set("Authorization", `Bearer ${this.handle}`);
    if (body) headers.set("Content-Type", "application/json");
    const response = await this.fetcher(url, {
      method,
      credentials: "omit",
      cache: "no-store",
      redirect: "error",
      headers,
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) throw new Error("本机任务服务暂不可用。");
    return response.json();
  }
}
