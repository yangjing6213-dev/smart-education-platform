import type { InvitedStaffTaskView } from "@student-care/contracts";
import { STAFF_TASK_CODES, STAFF_TASK_RESULTS, type StaffTaskCommand } from "./task-assignment.js";

export type InviteStaffTaskSnapshot = {
  readonly status: "IDLE" | "CONNECTING" | "BUSY" | "READY" | "DENIED" | "ERROR";
  readonly tasks: readonly InvitedStaffTaskView[];
  readonly message: string;
};

type TaskAction = StaffTaskCommand;
type TaskResponse = {
  readonly tasks: readonly InvitedStaffTaskView[];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
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
const empty: InviteStaffTaskSnapshot = {
  status: "IDLE",
  tasks: [],
  message: "请使用受邀员工账号登录后查看工作任务。",
};
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= 200;
const validDate = (value: unknown): value is string =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}$/u.test(value) &&
  Number.isFinite(Date.parse(`${value}T00:00:00.000Z`)) &&
  new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;

function origin(value: string): string {
  const url = new URL(value);
  if (
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    !(
      url.protocol === "https:" ||
      (url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname) && !!url.port)
    )
  )
    throw new Error("工作任务只能通过安全的同源网页访问。");
  return url.origin;
}

function parseTask(value: unknown): InvitedStaffTaskView {
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

function parseResponse(value: unknown): TaskResponse {
  if (!object(value) || !Array.isArray(value.tasks)) throw new Error("工作任务资料格式无效。");
  const tasks = value.tasks.map(parseTask);
  if (new Set(tasks.map((task) => task.id)).size !== tasks.length)
    throw new Error("工作任务资料重复。");
  return { tasks };
}

export class InviteStaffTaskClient {
  private readonly baseUrl: string;
  private readonly fetcher: typeof fetch;
  private generation = 0;
  private busy = false;
  private value: InviteStaffTaskSnapshot = empty;

  public constructor(options: { readonly baseUrl: string; readonly fetcher?: typeof fetch }) {
    this.baseUrl = origin(options.baseUrl);
    this.fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
  }

  public get snapshot(): InviteStaffTaskSnapshot {
    return structuredClone(this.value);
  }

  public disconnect(): void {
    this.generation += 1;
    this.busy = false;
    this.value = empty;
  }

  public async restore(): Promise<void> {
    if (this.busy) return;
    const generation = ++this.generation;
    this.busy = true;
    this.value = { ...empty, status: "CONNECTING", message: "正在核对受邀员工身份…" };
    await this.load(generation);
  }

  public async refresh(): Promise<void> {
    if (this.busy) return;
    const generation = ++this.generation;
    this.busy = true;
    this.value = { ...this.value, status: "BUSY", message: "正在更新工作任务…" };
    await this.load(generation);
  }

  public async command(
    action: TaskAction,
    taskId: string,
    version: number,
    result?: (typeof STAFF_TASK_RESULTS)[number][0],
  ): Promise<void> {
    if (this.busy) return;
    if (
      !UUID.test(taskId) ||
      !Number.isSafeInteger(version) ||
      version < 1 ||
      (action === "complete" && !RESULTS.includes(result as (typeof RESULTS)[number]))
    ) {
      this.fail(0);
      return;
    }
    const current = this.value.tasks.find((task) => task.id === taskId);
    if (
      this.value.status !== "READY" ||
      !current ||
      current.version !== version ||
      !current.actions.includes(action)
    )
      return;
    const generation = ++this.generation;
    this.busy = true;
    this.value = { ...this.value, status: "BUSY", tasks: [], message: "正在提交工作任务…" };
    try {
      const changed = await this.request(`/api-local/staff/tasks/${taskId}/${action}`, {
        version,
        ...(action === "complete" ? { result } : {}),
      });
      if (generation === this.generation) {
        parseTask(changed);
        await this.load(generation);
      }
    } catch (cause) {
      if (generation === this.generation) this.fail(statusOf(cause));
    } finally {
      if (generation === this.generation) this.busy = false;
    }
  }

  private async load(generation: number): Promise<void> {
    try {
      const value = parseResponse(await this.request("/api-local/staff/tasks"));
      if (generation !== this.generation) return;
      this.value = {
        status: "READY",
        tasks: value.tasks,
        message: value.tasks.length ? "工作任务已更新。" : "当前没有分配给你的任务。",
      };
    } catch (cause) {
      if (generation === this.generation) this.fail(statusOf(cause));
    } finally {
      if (generation === this.generation) this.busy = false;
    }
  }

  private async request(path: string, body?: object): Promise<unknown> {
    const response = await this.fetcher(new URL(path, this.baseUrl).href, {
      method: body === undefined ? "GET" : "POST",
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(5000),
      ...(body === undefined
        ? {}
        : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
    });
    if (!response.ok)
      throw Object.assign(new Error("Staff task request failed"), { status: response.status });
    const payload: unknown = await response.json();
    if (!object(payload) || !("data" in payload)) throw new Error("Invalid staff task response");
    return payload.data;
  }

  private fail(status: number): void {
    this.value = {
      ...empty,
      status: status === 401 ? "IDLE" : status === 403 ? "DENIED" : "ERROR",
      message:
        status === 401
          ? "请使用受邀员工账号登录。"
          : status === 403
            ? "当前账号或校区无权查看这些工作任务。"
            : "工作任务暂时无法读取，请重试。",
    };
  }
}

function statusOf(cause: unknown): number {
  return object(cause) && typeof cause.status === "number" ? cause.status : 0;
}
