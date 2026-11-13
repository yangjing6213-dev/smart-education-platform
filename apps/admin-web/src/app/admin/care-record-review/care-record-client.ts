export type AdminCareRecord = Readonly<{
  id: string;
  version: number;
  date: string;
  status: "DRAFT" | "SUBMITTED" | "CONFIRMED" | "RETURNED" | "CANCELLED" | "EXCEPTION_PENDING";
  values: Readonly<Record<string, string>>;
  studentLabel: string;
  classLabel: string;
  published: boolean;
  publicationVersion: number;
  actions: readonly (
    "edit" | "submit" | "resubmit" | "review" | "publish" | "withdraw" | "revoke-publication"
  )[];
}>;

export type CareRecordReviewSnapshot = Readonly<{
  status: "IDLE" | "CHECKING" | "BUSY" | "READY" | "UNAUTHENTICATED" | "FORBIDDEN" | "ERROR";
  displayName: string;
  records: readonly AdminCareRecord[];
  message: string;
}>;

type ClientOptions = Readonly<{ fetcher?: typeof fetch }>;
type JsonRecord = Record<string, unknown>;
type ApiFailure = Error & Readonly<{ status: number }>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const STATUS = [
  "DRAFT",
  "SUBMITTED",
  "CONFIRMED",
  "RETURNED",
  "CANCELLED",
  "EXCEPTION_PENDING",
] as const;
const ACTIONS = [
  "edit",
  "submit",
  "resubmit",
  "review",
  "publish",
  "withdraw",
  "revoke-publication",
] as const;
const VALUE_OPTIONS = {
  arrival: ["ARRIVED_AS_PLANNED", "LATE", "ABSENT"],
  homework: ["COMPLETED", "IN_PROGRESS", "NEEDS_SUPPORT"],
  meal: ["FINISHED", "PARTIAL", "NOT_RECORDED"],
  rest: ["RESTED", "QUIET_ACTIVITY", "NOT_RECORDED"],
  activity: ["PARTICIPATED", "OBSERVED", "NOT_RECORDED"],
  wellbeing: ["ROUTINE", "CHECK_IN", "FOLLOW_UP"],
} as const;

const EMPTY: CareRecordReviewSnapshot = {
  status: "IDLE",
  displayName: "",
  records: [],
  message: "请使用机构邀请账号登录。",
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function failure(status: number, message: string): ApiFailure {
  return Object.assign(new Error(message), { status });
}

function isoDay(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/u.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value + "T00:00:00.000Z").toISOString().slice(0, 10) === value
  );
}

function parseIdentity(value: unknown): { displayName: string; capabilities: Set<string> } {
  if (
    !isRecord(value) ||
    typeof value.display_name !== "string" ||
    !value.display_name.trim() ||
    value.display_name.length > 120 ||
    !Array.isArray(value.memberships)
  )
    throw failure(502, "账号权限信息暂不可用，请稍后重试。");

  const capabilities = new Set<string>();
  for (const membership of value.memberships) {
    if (
      !isRecord(membership) ||
      membership.status !== "ACTIVE" ||
      !Array.isArray(membership.capabilities)
    )
      continue;
    for (const capability of membership.capabilities) {
      if (typeof capability === "string") capabilities.add(capability);
    }
  }
  if (!capabilities.has("care:review") && !capabilities.has("care:publish"))
    throw failure(403, "当前账号没有成长记录审核或发布权限。");
  return { displayName: value.display_name, capabilities };
}

function parseCareRecord(value: unknown): AdminCareRecord {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    !UUID.test(value.id) ||
    typeof value.student_display_ref !== "string" ||
    !value.student_display_ref.trim() ||
    value.student_display_ref.length > 80 ||
    typeof value.class_ref !== "string" ||
    !value.class_ref.trim() ||
    value.class_ref.length > 80 ||
    !isoDay(value.service_date) ||
    !STATUS.includes(value.status as (typeof STATUS)[number]) ||
    !Number.isSafeInteger(value.version) ||
    Number(value.version) < 1 ||
    typeof value.published !== "boolean" ||
    !Number.isSafeInteger(value.publication_version) ||
    Number(value.publication_version) < 0 ||
    typeof value.updated_at !== "string" ||
    !Number.isFinite(Date.parse(value.updated_at)) ||
    new Date(value.updated_at).toISOString() !== value.updated_at ||
    !isRecord(value.values) ||
    !Array.isArray(value.actions) ||
    value.actions.length > ACTIONS.length
  )
    throw failure(502, "成长记录格式不正确，请刷新后重试。");

  const fields = Object.keys(VALUE_OPTIONS);
  const values = value.values;
  if (
    Object.keys(values).length !== fields.length ||
    !fields.every((field) =>
      VALUE_OPTIONS[field as keyof typeof VALUE_OPTIONS].includes(values[field] as never),
    ) ||
    new Set(value.actions).size !== value.actions.length ||
    !value.actions.every((action) => ACTIONS.includes(action as (typeof ACTIONS)[number]))
  )
    throw failure(502, "成长记录格式不正确，请刷新后重试。");

  return {
    id: value.id,
    version: Number(value.version),
    date: value.service_date,
    status: value.status as AdminCareRecord["status"],
    values: Object.fromEntries(fields.map((field) => [field, values[field] as string])),
    studentLabel: value.student_display_ref,
    classLabel: value.class_ref,
    published: value.published,
    publicationVersion: Number(value.publication_version),
    actions: value.actions as AdminCareRecord["actions"],
  };
}

function parseRecordList(value: unknown): AdminCareRecord[] {
  if (!Array.isArray(value) || value.length > 500)
    throw failure(502, "成长记录列表暂不可用，请稍后重试。");
  const records = value.map(parseCareRecord);
  if (new Set(records.map((record) => record.id)).size !== records.length)
    throw failure(502, "成长记录列表暂不可用，请稍后重试。");
  return records;
}

export class CareRecordReviewClient {
  private value: CareRecordReviewSnapshot = EMPTY;
  private readonly fetcher: typeof fetch;
  private generation = 0;
  private busy = false;

  public constructor(options: ClientOptions = {}) {
    this.fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
  }

  public get snapshot(): CareRecordReviewSnapshot {
    return this.value;
  }

  public async connect(): Promise<void> {
    if (this.busy) return;
    const generation = ++this.generation;
    this.busy = true;
    this.value = { ...EMPTY, status: "CHECKING", message: "正在确认当前账号权限…" };
    try {
      const identity = await this.request("/me");
      const current = parseIdentity(identity);
      if (generation !== this.generation) return;
      this.value = {
        ...this.value,
        displayName: current.displayName,
        message: "账号已确认，正在读取当前校区的审核记录…",
      };
      await this.load(generation, "审核范围由当前账号的校区权限决定。");
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
    this.value = { ...this.value, status: "BUSY", records: [], message: "正在刷新审核记录…" };
    try {
      await this.load(generation, "审核记录已更新。");
    } catch (cause) {
      if (generation === this.generation) this.fail(cause);
    } finally {
      if (generation === this.generation) this.busy = false;
    }
  }

  public async review(id: string, version: number, action: "confirm" | "return"): Promise<void> {
    await this.mutate(id, version, "review", { version, action }, "审核结果已保存。");
  }

  public async publish(id: string, version: number): Promise<void> {
    await this.mutate(id, version, "publish", { version }, "成长记录已发布给家长。");
  }

  public async revokePublication(id: string, version: number): Promise<void> {
    await this.mutate(
      id,
      version,
      "revoke-publication",
      { version },
      "发布已撤销，家长暂时无法查看。",
    );
  }

  public async logout(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.value = { ...this.value, status: "BUSY", records: [], message: "正在退出登录…" };
    try {
      await this.request("/identity/logout", { method: "POST", body: {} });
      this.disconnect();
    } catch (cause) {
      this.fail(cause);
    } finally {
      this.busy = false;
    }
  }

  public disconnect(): void {
    this.generation += 1;
    this.busy = false;
    this.value = EMPTY;
  }

  private async mutate(
    id: string,
    version: number,
    action: "review" | "publish" | "revoke-publication",
    body: JsonRecord,
    success: string,
  ): Promise<void> {
    if (
      this.busy ||
      this.value.status !== "READY" ||
      !UUID.test(id) ||
      !Number.isSafeInteger(version) ||
      version < 1
    )
      return;
    const record = this.value.records.find((item) => item.id === id);
    if (!record || record.version !== version || !record.actions.includes(action)) {
      this.value = { ...this.value, message: "记录权限或版本已变化，请刷新后重试。" };
      return;
    }
    const generation = this.generation;
    this.busy = true;
    this.value = { ...this.value, status: "BUSY", records: [], message: "正在保存审核结果…" };
    try {
      await this.request(`/staff/care-records/${id}/${action}`, { method: "POST", body });
      if (generation !== this.generation) return;
      await this.load(generation, success);
    } catch (cause) {
      if (generation === this.generation) this.fail(cause);
    } finally {
      if (generation === this.generation) this.busy = false;
    }
  }

  private async load(generation: number, message: string): Promise<void> {
    const payload = await this.request("/staff/care-records");
    if (generation !== this.generation) return;
    const records = parseRecordList(payload);
    this.value = { ...this.value, status: "READY", records, message };
  }

  private async request(
    path: string,
    init: { method?: string; body?: JsonRecord } = {},
  ): Promise<unknown> {
    const url = "/api/admin" + path;
    const response = await this.fetcher(url, {
      method: init.method ?? "GET",
      cache: "no-store",
      credentials: "same-origin",
      redirect: "error",
      signal: AbortSignal.timeout(5000),
      headers: {
        accept: "application/json",
        ...(init.body ? { "content-type": "application/json" } : {}),
      },
      ...(init.body ? { body: JSON.stringify(init.body) } : {}),
    });
    const payload: unknown = await response.json().catch(() => undefined);
    if (!response.ok) {
      const message =
        isRecord(payload) && isRecord(payload.error) && typeof payload.error.message === "string"
          ? payload.error.message
          : "请求未完成，请稍后重试。";
      throw failure(response.status, message);
    }
    if (!isRecord(payload) || !("data" in payload))
      throw failure(502, "管理服务返回内容不完整，请稍后重试。");
    return payload.data;
  }

  private fail(cause: unknown): void {
    const status = isRecord(cause) && typeof cause.status === "number" ? cause.status : 0;
    const message = cause instanceof Error ? cause.message : "暂时无法读取审核记录，请稍后重试。";
    this.value = {
      ...EMPTY,
      status: status === 401 ? "UNAUTHENTICATED" : status === 403 ? "FORBIDDEN" : "ERROR",
      message:
        status === 401
          ? "登录状态已失效，请重新登录。"
          : status === 403
            ? "当前账号没有成长记录审核或发布权限，记录内容已隐藏。"
            : message,
    };
  }
}
