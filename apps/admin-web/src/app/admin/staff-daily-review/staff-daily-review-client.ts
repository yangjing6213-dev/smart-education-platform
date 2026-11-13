export type AdminDaily = Readonly<{
  id: string;
  version: number;
  date: string;
  authorLabel: string;
  status: "SUBMITTED" | "CONFIRMED" | "RETURNED";
  values: Readonly<Record<string, string>>;
  sourceCounts: Readonly<Record<string, number>>;
  learningSummary: null | Readonly<{
    completedLearnerBand: "2_PLUS";
    usedGuidance: boolean;
    needsTeacherFollowUp: boolean;
  }>;
  actions: readonly ("confirm" | "return" | "withdraw")[];
}>;
export type StaffDailyAuditAction =
  | "CREATED"
  | "EDITED"
  | "SUBMITTED"
  | "RESUBMITTED"
  | "REVIEW_CONFIRMED"
  | "REVIEW_RETURNED"
  | "CONFIRMATION_WITHDRAWN"
  | "SOURCES_INVALIDATED";
export type StaffDailyAuditEvent = Readonly<{
  action: StaffDailyAuditAction;
  reportVersion: number;
  actorLabel: string | null;
  initiatedByLabel: string;
  occurredAt: string;
}>;
type StaffDailyAuditState = Readonly<{
  status: "LOADING" | "READY" | "ERROR";
  events: readonly StaffDailyAuditEvent[];
  error: string | null;
}>;
export type StaffDailyReviewAction = "CONFIRM" | "RETURN" | "WITHDRAW";
export type StaffDailyReviewSnapshot = Readonly<{
  status: "IDLE" | "CONNECTING" | "BUSY" | "READY" | "UNAUTHENTICATED" | "FORBIDDEN" | "ERROR";
  session: null | Readonly<{ label: string }>;
  rows: readonly AdminDaily[];
  auditEvents: Readonly<Record<string, StaffDailyAuditState>>;
  message: string;
  error: string | null;
}>;
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
const DAILY_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const DAILY_VALUES = {
  arrival: ["ARRIVED_AS_PLANNED", "LATE", "ABSENT"],
  homework: ["COMPLETED", "IN_PROGRESS", "NEEDS_SUPPORT"],
  activity: ["PARTICIPATED", "OBSERVED", "NOT_RECORDED"],
  classroom: ["ROUTINE", "NEEDS_ATTENTION", "NEEDS_FOLLOW_UP"],
  followUp: ["NONE", "OBSERVE_TOMORROW", "OWNER_ATTENTION"],
} as const;
const DAILY_SOURCES = ["TASK", "ATTENDANCE", "CARE_RECORD", "PICKUP", "PICKUP_EXCEPTION"] as const;
const DAILY_AUDIT_ACTIONS: readonly StaffDailyAuditAction[] = [
  "CREATED",
  "EDITED",
  "SUBMITTED",
  "RESUBMITTED",
  "REVIEW_CONFIRMED",
  "REVIEW_RETURNED",
  "CONFIRMATION_WITHDRAWN",
  "SOURCES_INVALIDATED",
];

function parseDailyAuditEvent(value: unknown): StaffDailyAuditEvent | undefined {
  if (
    !isRecord(value) ||
    Object.keys(value).length !== 5 ||
    !["action", "reportVersion", "actorLabel", "initiatedByLabel", "occurredAt"].every((key) =>
      Object.hasOwn(value, key),
    ) ||
    !DAILY_AUDIT_ACTIONS.includes(value.action as StaffDailyAuditAction) ||
    !Number.isSafeInteger(value.reportVersion) ||
    Number(value.reportVersion) < 1 ||
    (value.action === "SOURCES_INVALIDATED"
      ? value.actorLabel !== null
      : typeof value.actorLabel !== "string" ||
        !value.actorLabel.trim() ||
        value.actorLabel.length > 120) ||
    typeof value.initiatedByLabel !== "string" ||
    !value.initiatedByLabel.trim() ||
    value.initiatedByLabel.length > 120 ||
    typeof value.occurredAt !== "string" ||
    !Number.isFinite(Date.parse(value.occurredAt)) ||
    new Date(value.occurredAt).toISOString() !== value.occurredAt
  )
    return undefined;
  return {
    action: value.action as StaffDailyAuditAction,
    reportVersion: Number(value.reportVersion),
    actorLabel: value.actorLabel as string | null,
    initiatedByLabel: value.initiatedByLabel,
    occurredAt: value.occurredAt,
  };
}
export function parseDailyRecord(value: unknown): AdminDaily | undefined {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    !DAILY_UUID.test(value.id) ||
    !Number.isSafeInteger(value.version) ||
    Number(value.version) < 1 ||
    typeof value.authorLabel !== "string" ||
    !value.authorLabel.trim() ||
    value.authorLabel.length > 120 ||
    typeof value.date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/u.test(value.date) ||
    !Number.isFinite(Date.parse(value.date)) ||
    new Date(value.date + "T00:00:00Z").toISOString().slice(0, 10) !== value.date ||
    !["SUBMITTED", "CONFIRMED", "RETURNED"].includes(String(value.status)) ||
    !isRecord(value.values) ||
    !isRecord(value.sourceCounts) ||
    !Array.isArray(value.actions)
  )
    return undefined;
  const values = value.values,
    counts = value.sourceCounts;
  if (
    Object.keys(values).length !== 5 ||
    !Object.entries(DAILY_VALUES).every(([key, options]) =>
      (options as readonly unknown[]).includes(values[key]),
    ) ||
    !DAILY_SOURCES.every((key) => Number.isSafeInteger(counts[key]) && Number(counts[key]) >= 0)
  )
    return undefined;
  const permitted =
    value.status === "SUBMITTED"
      ? ["confirm", "return"]
      : value.status === "CONFIRMED"
        ? ["return", "withdraw"]
        : [];
  if (
    new Set(value.actions).size !== value.actions.length ||
    !value.actions.every((action) => typeof action === "string" && permitted.includes(action))
  )
    return undefined;
  let learningSummary: AdminDaily["learningSummary"] = null;
  if (value.learningSummary !== null) {
    const summary = value.learningSummary;
    if (
      !isRecord(summary) ||
      summary.completedLearnerBand !== "2_PLUS" ||
      typeof summary.usedGuidance !== "boolean" ||
      typeof summary.needsTeacherFollowUp !== "boolean"
    )
      return undefined;
    learningSummary = {
      completedLearnerBand: "2_PLUS",
      usedGuidance: summary.usedGuidance,
      needsTeacherFollowUp: summary.needsTeacherFollowUp,
    };
  }
  return {
    id: value.id,
    version: Number(value.version),
    date: value.date,
    authorLabel: value.authorLabel,
    status: value.status as AdminDaily["status"],
    values: Object.fromEntries(
      Object.keys(DAILY_VALUES).map((key) => [key, values[key] as string]),
    ),
    sourceCounts: Object.fromEntries(DAILY_SOURCES.map((key) => [key, Number(counts[key])])),
    learningSummary,
    actions: value.actions as AdminDaily["actions"],
  };
}
const EMPTY: StaffDailyReviewSnapshot = {
  status: "IDLE",
  session: null,
  rows: [],
  auditEvents: {},
  message: "请使用机构邀请账号登录。",
  error: null,
};
function failure(status: number) {
  return Object.assign(new Error("日报请求未完成"), { status });
}
export class StaffDailyReviewClient {
  private value: StaffDailyReviewSnapshot = EMPTY;
  private readonly fetcher: typeof fetch;
  private generation = 0;
  private busy = false;
  public constructor(options: Readonly<{ fetcher?: typeof fetch }> = {}) {
    this.fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
  }
  public get snapshot(): StaffDailyReviewSnapshot {
    return this.value;
  }
  public async connect(): Promise<void> {
    if (this.busy) return;
    const generation = ++this.generation;
    this.busy = true;
    this.value = { ...EMPTY, status: "CONNECTING", message: "正在确认当前账号权限…" };
    try {
      const identity = await this.request("/me");
      if (generation !== this.generation) return;
      if (
        !isRecord(identity) ||
        typeof identity.display_name !== "string" ||
        !identity.display_name.trim() ||
        identity.display_name.length > 120 ||
        !Array.isArray(identity.memberships)
      )
        throw failure(502);
      if (
        !identity.memberships.some(
          (item) =>
            isRecord(item) &&
            item.status === "ACTIVE" &&
            Array.isArray(item.capabilities) &&
            item.capabilities.includes("daily:review"),
        )
      )
        throw failure(403);
      this.value = { ...this.value, session: { label: identity.display_name } };
      await this.load(generation, "已读取当前授权范围的日报。");
    } catch (cause) {
      if (generation === this.generation) this.fail(cause);
    } finally {
      if (generation === this.generation) this.busy = false;
    }
  }
  public async refresh(): Promise<void> {
    if (this.busy || this.value.status !== "READY") return;
    const generation = this.generation;
    this.busy = true;
    this.value = { ...this.value, status: "BUSY", rows: [], message: "正在刷新日报…" };
    try {
      await this.load(generation, "日报已更新。");
    } catch (cause) {
      if (generation === this.generation) this.fail(cause);
    } finally {
      if (generation === this.generation) this.busy = false;
    }
  }
  public async loadAuditEvents(id: string): Promise<void> {
    if (
      this.value.status !== "READY" ||
      !this.value.rows.some((row) => row.id === id) ||
      this.value.auditEvents[id]?.status === "LOADING"
    )
      return;
    const generation = this.generation;
    this.value = {
      ...this.value,
      auditEvents: {
        ...this.value.auditEvents,
        [id]: { status: "LOADING", events: [], error: null },
      },
    };
    try {
      const payload = await this.request(`/daily-reports/${id}/audit-events`);
      if (generation !== this.generation) return;
      if (!isRecord(payload) || !Array.isArray(payload.events)) throw failure(502);
      const events = payload.events.map(parseDailyAuditEvent);
      if (
        events.some((event) => !event) ||
        events.some(
          (event, index) => index > 0 && event!.reportVersion <= events[index - 1]!.reportVersion,
        )
      )
        throw failure(502);
      this.value = {
        ...this.value,
        auditEvents: {
          ...this.value.auditEvents,
          [id]: { status: "READY", events: events as StaffDailyAuditEvent[], error: null },
        },
      };
    } catch (cause) {
      if (generation !== this.generation) return;
      const status = isRecord(cause) ? cause.status : 0;
      if (status === 401 || status === 403) {
        this.fail(cause);
        return;
      }
      this.value = {
        ...this.value,
        auditEvents: {
          ...this.value.auditEvents,
          [id]: { status: "ERROR", events: [], error: "操作记录暂时无法读取，请稍后重试。" },
        },
      };
    }
  }
  public async review(id: string, version: number, action: StaffDailyReviewAction): Promise<void> {
    if (this.busy || this.value.status !== "READY") return;
    const row = this.value.rows.find((item) => item.id === id);
    const allowed =
      action === "CONFIRM"
        ? "confirm"
        : action === "RETURN"
          ? "return"
          : action === "WITHDRAW"
            ? "withdraw"
            : null;
    if (!row || row.version !== version || !allowed || !row.actions.includes(allowed)) {
      this.value = { ...this.value, message: "记录权限或版本已变化，请刷新后重试。" };
      return;
    }
    const generation = this.generation;
    this.busy = true;
    this.value = { ...this.value, status: "BUSY", rows: [], message: "正在保存审核结果…" };
    try {
      const result = await this.request(
        `/daily-reports/${id}/${action === "WITHDRAW" ? "withdraw" : "review"}`,
        action === "WITHDRAW" ? { version } : { version, action },
      );
      if (generation !== this.generation) return;
      if (!parseDailyRecord(result)) throw failure(502);
      await this.load(
        generation,
        action === "WITHDRAW" ? "已撤回确认，员工可修改后重新提交。" : "审核结果已保存。",
      );
    } catch (cause) {
      if (generation === this.generation) this.fail(cause);
    } finally {
      if (generation === this.generation) this.busy = false;
    }
  }
  public disconnect(): void {
    this.generation++;
    this.busy = false;
    this.value = EMPTY;
  }
  private async load(generation: number, message: string): Promise<void> {
    const payload = await this.request("/daily-reports");
    if (generation !== this.generation) return;
    if (!isRecord(payload) || !Array.isArray(payload.records)) throw failure(502);
    const rows = payload.records.map(parseDailyRecord);
    if (rows.some((row) => !row) || new Set(rows.map((row) => row?.id)).size !== rows.length)
      throw failure(502);
    this.value = {
      ...this.value,
      status: "READY",
      rows: rows as AdminDaily[],
      message,
      error: null,
    };
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
    if (!isRecord(payload) || !("data" in payload)) throw failure(502);
    return payload.data;
  }
  private fail(cause: unknown): void {
    const status = isRecord(cause) ? cause.status : 0;
    const message =
      status === 401
        ? "登录状态已失效，请重新登录。"
        : status === 403
          ? "当前账号没有日报审核权限，记录内容已隐藏。"
          : status === 409
            ? "日报已被更新，请重新连接后查看最新版本。"
            : "暂时无法读取或保存日报，请重新连接后重试。";
    this.value = {
      ...EMPTY,
      status: status === 401 ? "UNAUTHENTICATED" : status === 403 ? "FORBIDDEN" : "ERROR",
      message,
      error: message,
    };
  }
}
