const STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "RETURNED",
  "CONFIRMED",
  "PUBLISHED",
  "REVIEW_REQUIRED",
] as const;
const OPTIONS = ["KEEP_WATCHING", "PROGRESSING", "FOLLOW_UP"] as const;
const FIELDS = [
  "learningParticipation",
  "dailyHabits",
  "activityParticipation",
  "familySchoolCollaboration",
] as const;
const SOURCES = ["GROWTH_RECORD", "ATTENDANCE_OVERVIEW", "STAFF_DAILY"] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
type Status = (typeof STATUSES)[number];
type Action = "edit" | "submit" | "confirm" | "return" | "publish";
const PERMITTED: Readonly<Record<Status, readonly Action[]>> = {
  DRAFT: ["edit", "submit"],
  SUBMITTED: ["confirm", "return"],
  RETURNED: ["edit"],
  CONFIRMED: ["return", "publish"],
  PUBLISHED: [],
  REVIEW_REQUIRED: ["edit"],
};
export type MonthlyFeedbackReviewRow = Readonly<{
  id: string;
  version: number;
  sourceVersion: number;
  month: string;
  classRef: string;
  audience: "STAFF_INTERNAL";
  status: Status;
  supplements: Readonly<Record<(typeof FIELDS)[number], (typeof OPTIONS)[number]>>;
  sourceCounts: Readonly<Record<(typeof SOURCES)[number], number>>;
  actions: readonly Action[];
}>;
export type MonthlyFeedbackListing = Readonly<{
  records: readonly MonthlyFeedbackReviewRow[];
  canCreate: boolean;
}>;
export type MonthlyFeedbackReviewAction = "CONFIRM" | "RETURN" | "PUBLISH";
export type MonthlyFeedbackReviewSnapshot = Readonly<{
  status: "IDLE" | "CONNECTING" | "BUSY" | "READY" | "UNAUTHENTICATED" | "FORBIDDEN" | "ERROR";
  session: null | Readonly<{ label: string }>;
  rows: readonly MonthlyFeedbackReviewRow[];
  message: string;
  error: string | null;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
export function parseMonthlyRecord(value: unknown): MonthlyFeedbackReviewRow | undefined {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    !UUID.test(value.id) ||
    !Number.isSafeInteger(value.version) ||
    Number(value.version) < 1 ||
    !Number.isSafeInteger(value.sourceVersion) ||
    Number(value.sourceVersion) < 1 ||
    typeof value.month !== "string" ||
    !/^(?:19|20|21)\d{2}-(?:0[1-9]|1[0-2])$/u.test(value.month) ||
    typeof value.classRef !== "string" ||
    value.classRef.length > 80 ||
    value.audience !== "STAFF_INTERNAL" ||
    typeof value.status !== "string" ||
    !(STATUSES as readonly string[]).includes(value.status) ||
    !isRecord(value.supplements) ||
    !isRecord(value.sourceCounts) ||
    !Array.isArray(value.actions)
  )
    return undefined;
  const supplements = value.supplements,
    counts = value.sourceCounts;
  const status = value.status as Status;
  if (
    !FIELDS.every((key) => (OPTIONS as readonly unknown[]).includes(supplements[key])) ||
    !SOURCES.every((key) => Number.isSafeInteger(counts[key]) && Number(counts[key]) >= 0) ||
    new Set(value.actions).size !== value.actions.length ||
    !value.actions.every(
      (action) =>
        typeof action === "string" && (PERMITTED[status] as readonly string[]).includes(action),
    )
  )
    return undefined;
  return {
    id: value.id,
    version: Number(value.version),
    sourceVersion: Number(value.sourceVersion),
    month: value.month,
    classRef: value.classRef,
    audience: "STAFF_INTERNAL",
    status,
    supplements: Object.fromEntries(
      FIELDS.map((key) => [key, supplements[key]]),
    ) as MonthlyFeedbackReviewRow["supplements"],
    sourceCounts: Object.fromEntries(
      SOURCES.map((key) => [key, Number(counts[key])]),
    ) as MonthlyFeedbackReviewRow["sourceCounts"],
    actions: [...value.actions] as Action[],
  };
}
export function parseMonthlyListing(value: unknown): MonthlyFeedbackListing | undefined {
  if (!isRecord(value) || !Array.isArray(value.records) || typeof value.canCreate !== "boolean")
    return undefined;
  const records = value.records.map(parseMonthlyRecord);
  if (
    records.some((record) => !record) ||
    new Set(records.map((record) => record?.id)).size !== records.length
  )
    return undefined;
  return { records: records as MonthlyFeedbackReviewRow[], canCreate: value.canCreate };
}

const EMPTY: MonthlyFeedbackReviewSnapshot = {
  status: "IDLE",
  session: null,
  rows: [],
  message: "请使用机构邀请账号登录。",
  error: null,
};
function failure(status: number) {
  return Object.assign(new Error("月度总结请求未完成"), { status });
}
const CONFLICT_MESSAGE = "本次操作未保存，记录或来源已变化，已刷新最新版本，请核对后重新操作。";

export class MonthlyFeedbackReviewClient {
  private value: MonthlyFeedbackReviewSnapshot = EMPTY;
  private readonly fetcher: typeof fetch;
  private generation = 0;
  private busy = false;
  public constructor(options: Readonly<{ fetcher?: typeof fetch }> = {}) {
    this.fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
  }
  public get snapshot(): MonthlyFeedbackReviewSnapshot {
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
          (member) =>
            isRecord(member) &&
            member.status === "ACTIVE" &&
            Array.isArray(member.capabilities) &&
            member.capabilities.includes("feedback:read") &&
            member.capabilities.includes("feedback:review"),
        )
      )
        throw failure(403);
      this.value = { ...this.value, session: { label: identity.display_name } };
      await this.load(generation, "已读取当前授权范围的班级月度总结。");
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
    this.value = { ...this.value, status: "BUSY", rows: [], message: "正在刷新班级月度总结…" };
    try {
      await this.load(generation, "总结队列已刷新，来源变化的记录需要重新审核。");
    } catch (cause) {
      if (generation === this.generation) this.fail(cause);
    } finally {
      if (generation === this.generation) this.busy = false;
    }
  }
  public async review(
    id: string,
    version: number,
    action: MonthlyFeedbackReviewAction,
  ): Promise<void> {
    if (this.busy || this.value.status !== "READY") return;
    const row = this.value.rows.find((item) => item.id === id);
    const allowed =
      action === "CONFIRM"
        ? "confirm"
        : action === "RETURN"
          ? "return"
          : action === "PUBLISH"
            ? "publish"
            : null;
    if (!row || row.version !== version || !allowed || !row.actions.includes(allowed)) {
      this.value = { ...this.value, message: "记录权限或版本已变化，请刷新后重试。" };
      return;
    }
    const generation = this.generation;
    this.busy = true;
    this.value = { ...this.value, status: "BUSY", rows: [], message: "正在保存班级总结处理结果…" };
    try {
      const result = await this.request(
        `/monthly-feedback/${id}/${action === "PUBLISH" ? "publish" : "review"}`,
        action === "PUBLISH" ? { version } : { version, action },
      );
      if (generation !== this.generation) return;
      const updated = parseMonthlyRecord(result);
      if (!updated || updated.id !== id) throw failure(502);
      await this.load(
        generation,
        action === "PUBLISH"
          ? "总结已内部发布，家长不可见。"
          : action === "RETURN"
            ? "总结已退回，员工修改并保存后可重新提交。"
            : "总结已确认，可另行内部发布。",
      );
    } catch (cause) {
      if (generation !== this.generation) return;
      if (isRecord(cause) && cause.status === 409) {
        try {
          await this.load(generation, CONFLICT_MESSAGE);
        } catch (reloadCause) {
          if (generation === this.generation) this.fail(reloadCause);
        }
      } else this.fail(cause);
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
    const payload = await this.request("/monthly-feedback");
    if (generation !== this.generation) return;
    const listing = parseMonthlyListing(payload);
    if (!listing) throw failure(502);
    this.value = { ...this.value, status: "READY", rows: listing.records, message, error: null };
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
    if (!response.ok) {
      // Finish the response without exposing its body; the HTTP denial remains authoritative.
      await response.arrayBuffer().catch(() => undefined);
      throw failure(response.status);
    }
    const payload: unknown = await response.json();
    if (!isRecord(payload) || !("data" in payload)) throw failure(502);
    return payload.data;
  }
  private fail(cause: unknown): void {
    const status = isRecord(cause) ? cause.status : 0;
    const message =
      status === 401
        ? "登录状态已失效，请重新登录。"
        : status === 403 || status === 404
          ? "当前账号无法访问这些班级总结，记录内容已隐藏。"
          : "暂时无法读取或保存班级总结，请重新连接后重试。";
    this.value = {
      ...EMPTY,
      status:
        status === 401
          ? "UNAUTHENTICATED"
          : status === 403 || status === 404
            ? "FORBIDDEN"
            : "ERROR",
      message,
      error: message,
    };
  }
}
