export type ConsentReviewerProfile = "owner-east" | "owner-west";
export type ConsentReviewAction = "REQUIRED_HOLD" | "SIMULATE_EXPIRY";
export type ConsentReviewStatus =
  "WITHIN_PERIOD" | "REVIEW_DUE" | "REQUIRED_HOLD" | "SIMULATED_EXPIRED";
export type ConsentPurposeKey = "CARE_RECORD" | "HEALTH_SUPPORT" | "LEARNING_SUPPORT";

export interface ConsentReviewRow {
  readonly id: string;
  readonly version: number;
  readonly purposeKey: ConsentPurposeKey;
  readonly purposeTitle: string;
  readonly noticeVersion: string;
  readonly necessity: string;
  readonly dataClasses: readonly string[];
  readonly retentionStatus: ConsentReviewStatus;
  readonly retentionDays: number;
  readonly retainUntil: string;
  readonly retentionOutcomeNotice: string | null;
  readonly status: "ACTIVE" | "REVOKED";
  readonly dataChanged: false;
}

export interface ConsentReviewSnapshot {
  readonly status: "IDLE" | "CONNECTING" | "READY" | "BUSY" | "ERROR" | "DENIED";
  readonly profile: ConsentReviewerProfile | null;
  readonly records: readonly ConsentReviewRow[];
  readonly message: string;
}

export interface ConsentReviewClientOptions {
  readonly baseUrl?: string;
  readonly fetcher?: typeof fetch;
}

const API_BASE = "http://127.0.0.1:4317";
const PROFILES: readonly ConsentReviewerProfile[] = ["owner-east", "owner-west"];
const PURPOSES: readonly ConsentPurposeKey[] = [
  "CARE_RECORD",
  "HEALTH_SUPPORT",
  "LEARNING_SUPPORT",
];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const validProfile = (value: unknown): value is ConsentReviewerProfile =>
  typeof value === "string" && PROFILES.includes(value as ConsentReviewerProfile);
const validPurpose = (value: unknown): value is ConsentPurposeKey =>
  typeof value === "string" && PURPOSES.includes(value as ConsentPurposeKey);
const validRetentionStatus = (value: unknown): value is ConsentReviewStatus =>
  value === "WITHIN_PERIOD" ||
  value === "REVIEW_DUE" ||
  value === "REQUIRED_HOLD" ||
  value === "SIMULATED_EXPIRED";

class LocalApiError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

function apiErrorCode(value: unknown): string {
  return object(value) && object(value.error) && typeof value.error.code === "string"
    ? value.error.code
    : "REQUEST_FAILED";
}

function projectRows(value: unknown): ConsentReviewRow[] {
  if (!Array.isArray(value)) throw new LocalApiError("INVALID_RECORDS");
  const rows = value.map((row): ConsentReviewRow | null => {
    if (
      !object(row) ||
      typeof row.id !== "string" ||
      !UUID.test(row.id) ||
      !Number.isSafeInteger(row.version) ||
      Number(row.version) < 1 ||
      !UUID.test(String(row.bindingId)) ||
      !validPurpose(row.purposeKey) ||
      typeof row.purposeTitle !== "string" ||
      typeof row.noticeVersion !== "string" ||
      typeof row.necessity !== "string" ||
      !Array.isArray(row.dataClasses) ||
      !row.dataClasses.every((item) => typeof item === "string") ||
      !validRetentionStatus(row.retentionStatus) ||
      !Number.isSafeInteger(row.retentionDays) ||
      Number(row.retentionDays) < 1 ||
      typeof row.retainUntil !== "string" ||
      !Number.isFinite(Date.parse(row.retainUntil)) ||
      (row.retentionOutcomeNotice !== null && typeof row.retentionOutcomeNotice !== "string") ||
      (row.status !== "ACTIVE" && row.status !== "REVOKED") ||
      row.dataChanged !== false
    )
      return null;
    return {
      id: row.id,
      version: Number(row.version),
      purposeKey: row.purposeKey,
      purposeTitle: row.purposeTitle,
      noticeVersion: row.noticeVersion,
      necessity: row.necessity,
      dataClasses: row.dataClasses as string[],
      retentionStatus: row.retentionStatus,
      retentionDays: Number(row.retentionDays),
      retainUntil: row.retainUntil,
      retentionOutcomeNotice: row.retentionOutcomeNotice,
      status: row.status,
      dataChanged: false,
    };
  });
  if (rows.some((row) => row === null)) throw new LocalApiError("INVALID_RECORDS");
  return rows as ConsentReviewRow[];
}

export class ConsentReviewClient {
  private readonly fetcher: typeof fetch;
  private readonly baseUrl: string;
  private generation = 0;
  private handle: string | null = null;
  private value: ConsentReviewSnapshot = {
    status: "IDLE",
    profile: null,
    records: [],
    message: "请选择模拟负责校区并连接本机审核服务。",
  };

  constructor(options: ConsentReviewClientOptions = {}) {
    const baseUrl = new URL(options.baseUrl ?? API_BASE);
    if (
      baseUrl.protocol !== "http:" ||
      !["127.0.0.1", "localhost"].includes(baseUrl.hostname) ||
      baseUrl.port === "" ||
      baseUrl.username !== "" ||
      baseUrl.password !== ""
    )
      throw new Error("Only a loopback local service is allowed.");
    this.baseUrl = baseUrl.origin;
    this.fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
  }

  get snapshot(): ConsentReviewSnapshot {
    return this.value;
  }

  disconnect(): void {
    this.generation += 1;
    this.handle = null;
    this.value = {
      status: "IDLE",
      profile: null,
      records: [],
      message: "本机审核连接已关闭。",
    };
  }

  async connect(profile: unknown): Promise<void> {
    this.disconnect();
    if (!validProfile(profile)) return;
    const generation = this.generation;
    this.value = {
      status: "CONNECTING",
      profile,
      records: [],
      message: "正在连接本机同意审核队列…",
    };
    try {
      const created = await this.request("/local/sessions", {
        method: "POST",
        body: JSON.stringify({ profile }),
      });
      if (
        !object(created) ||
        typeof created.handle !== "string" ||
        !/^[\w-]{43}$/u.test(created.handle)
      )
        throw new LocalApiError("INVALID_SESSION");
      const handle = created.handle;
      const session = await this.request("/local/session", { handle });
      if (
        !object(session) ||
        session.mode !== "local-synthetic" ||
        session.profile !== profile ||
        !Array.isArray(session.actions) ||
        !session.actions.includes("consent:review")
      )
        throw new LocalApiError("UNAVAILABLE");
      if (generation !== this.generation) return;
      this.handle = handle;
      await this.load(generation);
    } catch (error) {
      if (generation !== this.generation) return;
      this.handle = null;
      this.value = {
        status: error instanceof LocalApiError && error.code === "UNAVAILABLE" ? "DENIED" : "ERROR",
        profile,
        records: [],
        message:
          error instanceof LocalApiError && error.code === "UNAVAILABLE"
            ? "当前模拟身份没有同意审核权限。"
            : "暂时无法连接本机审核服务，请确认演示服务已启动后重试。",
      };
    }
  }

  async refresh(): Promise<void> {
    if (!this.handle || this.value.status !== "READY") return;
    const generation = this.generation;
    this.value = { ...this.value, status: "BUSY", message: "正在更新当前负责范围的记录…" };
    try {
      await this.load(generation);
    } catch (error) {
      if (generation !== this.generation) return;
      this.value = { ...this.value, status: "ERROR", message: this.errorMessage(error) };
    }
  }

  async review(index: number, action: ConsentReviewAction, confirmed: boolean): Promise<void> {
    if (!confirmed || this.value.status !== "READY" || !this.handle) return;
    const record = this.value.records[index];
    if (!record || record.status !== "ACTIVE" || record.retentionStatus !== "REVIEW_DUE") return;
    const generation = this.generation;
    this.value = { ...this.value, status: "BUSY", message: "正在更新本机演练状态…" };
    try {
      const receipt = await this.request(`/local/consents/${record.id}/retention-review`, {
        method: "POST",
        handle: this.handle,
        body: JSON.stringify({ version: record.version, action }),
      });
      if (!object(receipt) || receipt.dataChanged !== false)
        throw new LocalApiError("INVALID_RECEIPT");
      await this.load(
        generation,
        "负责人演练状态已更新；没有删除或改变任何真实资料。dataChanged=false。",
      );
    } catch (error) {
      if (generation !== this.generation) return;
      this.value = {
        ...this.value,
        status: "READY",
        message: this.errorMessage(error),
      };
    }
  }

  private async load(
    generation: number,
    message = "仅显示服务端授权范围内的合成记录。",
  ): Promise<void> {
    if (!this.handle) throw new LocalApiError("UNAVAILABLE");
    const value = await this.request("/local/consents", { handle: this.handle });
    const records = projectRows(value);
    if (generation !== this.generation) return;
    this.value = { ...this.value, status: "READY", records, message };
  }

  private async request(
    path: string,
    options: RequestInit & { handle?: string },
  ): Promise<unknown> {
    const { handle, ...init } = options;
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    if (init.body !== undefined) headers.set("Content-Type", "application/json");
    if (handle) headers.set("Authorization", `Bearer ${handle}`);
    const response = await this.fetcher(new URL(path, this.baseUrl), {
      ...init,
      cache: "no-store",
      redirect: "error",
      headers,
    });
    let value: unknown;
    try {
      value = await response.json();
    } catch {
      throw new LocalApiError("INVALID_RESPONSE");
    }
    if (!response.ok) throw new LocalApiError(apiErrorCode(value));
    return value;
  }

  private errorMessage(error: unknown): string {
    if (error instanceof LocalApiError) {
      if (error.code === "STATE_CONFLICT") return "记录版本已变化，请刷新后再复核。";
      if (error.code === "UNAVAILABLE") return "记录不在当前负责人范围内，页面不会继续操作。";
    }
    return "更新失败，请刷新当前负责范围后重试。";
  }
}
