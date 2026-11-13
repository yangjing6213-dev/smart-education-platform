export type PrivacyReviewerProfile = "owner-east" | "owner-west";
export type PrivacyRequestType = "ACCESS" | "CORRECT" | "COPY" | "DELETE";
export type PrivacyRequestStatus = "SUBMITTED" | "IN_REVIEW" | "SIMULATED_COMPLETE" | "WITHDRAWN";
export type PrivacyReviewAction = "START" | "COMPLETE";

export interface PrivacyRequestView {
  readonly id: string;
  readonly version: number;
  readonly type: PrivacyRequestType;
  readonly status: PrivacyRequestStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly dataChanged: false;
}

export interface PrivacyRequestReviewSnapshot {
  readonly status: "IDLE" | "CONNECTING" | "READY" | "BUSY" | "ERROR" | "DENIED";
  readonly profile: PrivacyReviewerProfile | null;
  readonly requests: readonly PrivacyRequestView[];
  readonly message: string;
}

export interface PrivacyRequestReviewClientOptions {
  readonly baseUrl?: string;
  readonly fetcher?: typeof fetch;
}

const API_BASE = "http://127.0.0.1:4317";
const PROFILES: readonly PrivacyReviewerProfile[] = ["owner-east", "owner-west"];
const TYPES: readonly PrivacyRequestType[] = ["ACCESS", "CORRECT", "COPY", "DELETE"];
const STATUSES: readonly PrivacyRequestStatus[] = [
  "SUBMITTED",
  "IN_REVIEW",
  "SIMULATED_COMPLETE",
  "WITHDRAWN",
];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const validProfile = (value: unknown): value is PrivacyReviewerProfile =>
  typeof value === "string" && PROFILES.includes(value as PrivacyReviewerProfile);

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

function hasStudentIdentity(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasStudentIdentity);
  if (!object(value)) return false;
  if (["studentId", "studentAlias", "studentLabel"].some((key) => key in value)) return true;
  return Object.values(value).some(hasStudentIdentity);
}

function projectRequests(value: unknown): PrivacyRequestView[] {
  if (!Array.isArray(value)) throw new LocalApiError("INVALID_PRIVACY_REQUESTS");
  const rows = value.map((row): PrivacyRequestView | null => {
    if (
      !object(row) ||
      hasStudentIdentity(row) ||
      typeof row.id !== "string" ||
      !UUID.test(row.id) ||
      !Number.isSafeInteger(row.version) ||
      Number(row.version) < 1 ||
      typeof row.type !== "string" ||
      !TYPES.includes(row.type as PrivacyRequestType) ||
      typeof row.status !== "string" ||
      !STATUSES.includes(row.status as PrivacyRequestStatus) ||
      typeof row.createdAt !== "string" ||
      !Number.isFinite(Date.parse(row.createdAt)) ||
      typeof row.updatedAt !== "string" ||
      !Number.isFinite(Date.parse(row.updatedAt)) ||
      row.dataChanged !== false
    )
      return null;
    return {
      id: row.id,
      version: Number(row.version),
      type: row.type as PrivacyRequestType,
      status: row.status as PrivacyRequestStatus,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      dataChanged: false,
    };
  });
  if (rows.some((row) => row === null)) throw new LocalApiError("INVALID_PRIVACY_REQUESTS");
  return rows as PrivacyRequestView[];
}

export class PrivacyRequestReviewClient {
  private readonly fetcher: typeof fetch;
  private readonly baseUrl: string;
  private generation = 0;
  private handle: string | null = null;
  private value: PrivacyRequestReviewSnapshot = {
    status: "IDLE",
    profile: null,
    requests: [],
    message: "请选择当前负责校区并连接本机审核服务。",
  };

  constructor(options: PrivacyRequestReviewClientOptions = {}) {
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

  get snapshot(): PrivacyRequestReviewSnapshot {
    return this.value;
  }

  disconnect(): void {
    this.generation += 1;
    this.handle = null;
    this.value = {
      status: "IDLE",
      profile: null,
      requests: [],
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
      requests: [],
      message: "正在连接本机审核服务…",
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
        !session.actions.includes("privacy:review")
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
        requests: [],
        message:
          error instanceof LocalApiError && error.code === "UNAVAILABLE"
            ? "当前负责人身份没有此项审核权限。"
            : "暂时无法连接本机服务，请确认本机演示服务已启动后重试。",
      };
    }
  }

  async refresh(): Promise<void> {
    const profile = this.value.profile;
    if (!profile) return;
    if (!this.handle || this.value.status === "ERROR" || this.value.status === "DENIED") {
      await this.connect(profile);
      return;
    }
    if (this.value.status !== "READY") return;
    const generation = this.generation;
    this.value = { ...this.value, status: "BUSY", message: "正在刷新当前范围的申请…" };
    try {
      await this.load(generation);
    } catch (error) {
      if (generation !== this.generation) return;
      this.value = { ...this.value, status: "ERROR", message: this.errorMessage(error) };
    }
  }

  async review(index: number, action: PrivacyReviewAction): Promise<void> {
    if (
      !this.handle ||
      this.value.status !== "READY" ||
      (action !== "START" && action !== "COMPLETE")
    )
      return;
    const request = this.value.requests[index];
    if (
      !request ||
      (action === "START" && request.status !== "SUBMITTED") ||
      (action === "COMPLETE" && request.status !== "IN_REVIEW")
    )
      return;
    const generation = this.generation;
    this.value = { ...this.value, status: "BUSY", message: "正在更新本机申请状态…" };
    try {
      const receipt = await this.request(`/local/privacy-requests/${request.id}/review`, {
        method: "POST",
        handle: this.handle,
        body: JSON.stringify({ version: request.version, action }),
      });
      const projected = projectRequests([receipt])[0];
      const expected = action === "START" ? "IN_REVIEW" : "SIMULATED_COMPLETE";
      if (!projected || projected.status !== expected) throw new LocalApiError("INVALID_RECEIPT");
      await this.load(
        generation,
        "本机申请状态已更新；没有访问、复制、更正或删除真实资料。dataChanged=false。",
      );
    } catch (error) {
      if (generation !== this.generation) return;
      this.value = { ...this.value, status: "READY", message: this.errorMessage(error) };
    }
  }

  private async load(
    generation: number,
    message = "仅显示本机服务授权范围内的合成申请。",
  ): Promise<void> {
    if (!this.handle) throw new LocalApiError("UNAVAILABLE");
    const rows = projectRequests(
      await this.request("/local/privacy-requests", { handle: this.handle }),
    );
    if (generation !== this.generation) return;
    this.value = { ...this.value, status: "READY", requests: rows, message };
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
      if (error.code === "STATE_CONFLICT") return "申请状态已变化，请刷新后再试。";
      if (error.code === "UNAVAILABLE") return "申请不在当前负责人范围内，页面不会继续处理。";
    }
    return "更新失败，请刷新当前负责范围后重试。";
  }
}
