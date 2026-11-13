export type AdminBindingReviewerProfile = "owner-east" | "owner-west";
export type AdminBindingReviewAction = "approve" | "reject";
export type AdminBindingStatus = "PENDING" | "APPROVED" | "REJECTED" | "RELEASED" | "WITHDRAWN";

export interface AdminBindingReviewRow {
  readonly id: string;
  readonly version: number;
  readonly status: AdminBindingStatus;
  readonly relationship: "GUARDIAN";
  readonly studentLabel: string;
  readonly campusLabel: string;
  readonly classLabel: string;
  readonly guardianLabel: string;
}

export interface AdminBindingReviewAudit {
  readonly objectId: string;
  readonly version: number;
  readonly action: "approve" | "reject";
  readonly at: string;
}

export interface AdminBindingReviewSnapshot {
  readonly status: "IDLE" | "CONNECTING" | "BUSY" | "READY" | "DENIED" | "ERROR";
  readonly profile: AdminBindingReviewerProfile | null;
  readonly canReview: boolean;
  readonly records: readonly AdminBindingReviewRow[];
  readonly auditAvailable: boolean;
  readonly audit: readonly AdminBindingReviewAudit[];
  readonly message: string;
}

export interface AdminBindingReviewClientOptions {
  readonly baseUrl?: string | null;
  readonly fetcher?: typeof fetch;
}

class LocalBindingError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const STATUSES: readonly AdminBindingStatus[] = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "RELEASED",
  "WITHDRAWN",
];
const EMPTY_SNAPSHOT: AdminBindingReviewSnapshot = {
  status: "IDLE",
  profile: null,
  canReview: false,
  records: [],
  auditAvailable: false,
  audit: [],
  message: "请选择模拟负责校区并连接本机审核服务。",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isProfile(value: unknown): value is AdminBindingReviewerProfile {
  return value === "owner-east" || value === "owner-west";
}

function errorCode(value: unknown): string {
  return isRecord(value) && isRecord(value.error) && typeof value.error.code === "string"
    ? value.error.code
    : "REQUEST_FAILED";
}

function isSyntheticLabel(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 80 &&
    /^(示例|模拟|虚构)/u.test(value)
  );
}

function parseRow(value: unknown): AdminBindingReviewRow | null {
  if (!isRecord(value)) return null;
  const keys = Object.keys(value).sort().join(",");
  if (
    keys !==
      "campusLabel,classLabel,guardianLabel,id,relationship,status,studentAlias,studentId,studentLabel,version" ||
    typeof value.id !== "string" ||
    !UUID.test(value.id) ||
    !Number.isSafeInteger(value.version) ||
    Number(value.version) < 1 ||
    !STATUSES.includes(value.status as AdminBindingStatus) ||
    value.relationship !== "GUARDIAN" ||
    !UUID.test(String(value.studentId)) ||
    typeof value.studentAlias !== "string" ||
    !/^student-(alpha|beta)$/u.test(value.studentAlias) ||
    !isSyntheticLabel(value.studentLabel) ||
    !isSyntheticLabel(value.campusLabel) ||
    !isSyntheticLabel(value.classLabel) ||
    !isSyntheticLabel(value.guardianLabel)
  )
    return null;
  return {
    id: value.id,
    version: Number(value.version),
    status: value.status as AdminBindingStatus,
    relationship: "GUARDIAN",
    studentLabel: value.studentLabel,
    campusLabel: value.campusLabel,
    classLabel: value.classLabel,
    guardianLabel: value.guardianLabel,
  };
}

function parseRows(value: unknown): AdminBindingReviewRow[] {
  if (!Array.isArray(value)) throw new LocalBindingError("INVALID_RECORDS");
  const records = value.map(parseRow);
  if (records.some((record) => record === null)) throw new LocalBindingError("INVALID_RECORDS");
  return records as AdminBindingReviewRow[];
}

function parseAudit(value: unknown): AdminBindingReviewAudit[] {
  if (!Array.isArray(value)) throw new LocalBindingError("INVALID_AUDIT");
  const events = value.filter(
    (event): event is Record<string, unknown> =>
      isRecord(event) && (event.action === "binding.approve" || event.action === "binding.reject"),
  );
  const parsed = events.map((event) => {
    const keys = Object.keys(event).sort().join(",");
    if (
      keys !== "action,actorId,at,objectId,outcome,version" ||
      !UUID.test(String(event.actorId)) ||
      !UUID.test(String(event.objectId)) ||
      !Number.isSafeInteger(event.version) ||
      Number(event.version) < 1 ||
      event.outcome !== "ACCEPTED" ||
      typeof event.at !== "string" ||
      !Number.isFinite(Date.parse(event.at)) ||
      new Date(event.at).toISOString() !== event.at
    )
      throw new LocalBindingError("INVALID_AUDIT");
    return {
      objectId: event.objectId as string,
      version: Number(event.version),
      action: event.action === "binding.approve" ? "approve" as const : "reject" as const,
      at: event.at,
    };
  });
  return parsed;
}

export class AdminBindingReviewClient {
  private readonly baseUrl: string | null;
  private readonly fetcher: typeof fetch;
  private generation = 0;
  private handle: string | null = null;
  private canReadAudit = false;
  private value = EMPTY_SNAPSHOT;

  constructor(options: AdminBindingReviewClientOptions = {}) {
    const candidate = options.baseUrl ?? null;
    if (candidate !== null) {
      const url = new URL(candidate);
      if (
        url.origin !== candidate ||
        url.protocol !== "http:" ||
        !["127.0.0.1", "localhost"].includes(url.hostname) ||
        !url.port ||
        url.username ||
        url.password
      )
        throw new Error("Only a loopback local service is allowed.");
    }
    this.baseUrl = candidate;
    this.fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
  }

  get snapshot(): AdminBindingReviewSnapshot {
    return this.value;
  }

  disconnect(): void {
    this.generation += 1;
    this.handle = null;
    this.canReadAudit = false;
    this.value = EMPTY_SNAPSHOT;
  }

  async connect(profile: unknown): Promise<void> {
    this.disconnect();
    if (!isProfile(profile)) return;
    const generation = this.generation;
    this.value = {
      ...EMPTY_SNAPSHOT,
      status: "CONNECTING",
      profile,
      message: "正在连接本机合成审核服务…",
    };
    try {
      const created = await this.request("/local/sessions", {
        method: "POST",
        body: JSON.stringify({ profile }),
      });
      if (
        !isRecord(created) ||
        typeof created.handle !== "string" ||
        !/^[\w-]{43}$/u.test(created.handle)
      )
        throw new LocalBindingError("INVALID_SESSION");
      const handle = created.handle;
      const session = await this.request("/local/session", { handle });
      if (
        !isRecord(session) ||
        session.mode !== "local-synthetic" ||
        session.profile !== profile ||
        typeof session.actorId !== "string" ||
        !UUID.test(session.actorId) ||
        !Array.isArray(session.actions) ||
        !session.actions.every((action) => typeof action === "string")
      )
        throw new LocalBindingError("INVALID_SESSION");
      if (!session.actions.includes("binding:review")) throw new LocalBindingError("UNAVAILABLE");
      if (generation !== this.generation) return;
      this.handle = handle;
      this.canReadAudit = session.actions.includes("audit:read");
      await this.load(generation);
    } catch (error) {
      if (generation !== this.generation) return;
      const denied = error instanceof LocalBindingError && error.code === "UNAVAILABLE";
      this.handle = null;
      this.value = {
        status: denied ? "DENIED" : "ERROR",
        profile,
        canReview: false,
        records: [],
        auditAvailable: false,
        audit: [],
        message: denied
          ? "当前模拟身份没有家长关系审核权限，已隐藏关系资料。"
          : "本机关系审核暂不可用，已隐藏资料；请检查服务和当前范围后重试。",
      };
    }
  }

  async refresh(): Promise<void> {
    if (!this.handle || this.value.status !== "READY") return;
    const generation = this.generation;
    this.value = { ...this.value, status: "BUSY", message: "正在刷新当前校区的申请…" };
    try {
      await this.load(generation, "已刷新当前负责人有权查看的模拟申请。");
    } catch {
      if (generation !== this.generation) return;
      this.value = {
        ...this.value,
        status: "ERROR",
        canReview: false,
        records: [],
        auditAvailable: false,
        audit: [],
        message: "刷新失败，关系资料已隐藏；请重新连接后核实。",
      };
    }
  }

  async review(index: number, action: AdminBindingReviewAction, confirmed: boolean): Promise<void> {
    const row = this.value.records[index];
    if (
      !confirmed ||
      !this.handle ||
      this.value.status !== "READY" ||
      !this.value.canReview ||
      !row ||
      row.status !== "PENDING" ||
      (action !== "approve" && action !== "reject")
    )
      return;
    const generation = this.generation;
    this.value = { ...this.value, status: "BUSY", message: "正在更新本机申请状态…" };
    try {
      const receipt = parseRow(
        await this.request(`/local/binding-applications/${row.id}/review`, {
          method: "POST",
          handle: this.handle,
          body: JSON.stringify({ version: row.version, action }),
        }),
      );
      const expectedStatus = action === "approve" ? "APPROVED" : "REJECTED";
      if (
        !receipt ||
        receipt.id !== row.id ||
        receipt.version !== row.version + 1 ||
        receipt.status !== expectedStatus
      )
        throw new LocalBindingError("INVALID_RECEIPT");
      await this.load(
        generation,
        action === "approve" ? "关系已在本机合成记录中确认。" : "申请已在本机合成记录中拒绝。",
      );
    } catch (error) {
      if (generation !== this.generation) return;
      if (error instanceof LocalBindingError && error.code === "STATE_CONFLICT") {
        try {
          await this.load(generation, "申请状态已变化，列表已刷新，请重新核对后再操作。");
          return;
        } catch {
          // Fall through to a fail-closed message when the queue cannot be refreshed.
        }
      }
      this.value = {
        ...this.value,
        status: "ERROR",
        canReview: false,
        records: [],
        auditAvailable: false,
        audit: [],
        message: "本次审核结果无法确认，关系资料已隐藏；请刷新核实状态。",
      };
    }
  }

  private async load(generation: number, message = "仅显示当前负责人范围内的模拟申请。") {
    if (!this.handle || !this.value.profile) throw new LocalBindingError("UNAVAILABLE");
    const records = parseRows(
      await this.request("/local/binding-applications", { handle: this.handle }),
    );
    const expectedCampusLabel = this.value.profile === "owner-east" ? "示例东校区" : "示例西校区";
    if (records.some((record) => record.campusLabel !== expectedCampusLabel))
      throw new LocalBindingError("INVALID_SCOPE");
    let audit: AdminBindingReviewAudit[] = [];
    let auditAvailable = false;
    if (this.canReadAudit) {
      try {
        const events = parseAudit(await this.request("/local/audit", { handle: this.handle }));
        const visibleIds = new Set(records.map((record) => record.id));
        audit = events.filter((event) => visibleIds.has(event.objectId));
        auditAvailable = true;
      } catch {
        // Keep the authorized relation queue usable while clearly omitting unavailable audit data.
      }
    }
    if (generation !== this.generation) return;
    this.value = {
      ...this.value,
      status: "READY",
      canReview: true,
      records,
      auditAvailable,
      audit,
      message,
    };
  }

  private async request(
    path: string,
    options: RequestInit & { handle?: string },
  ): Promise<unknown> {
    if (!this.baseUrl) throw new LocalBindingError("SERVICE_UNAVAILABLE");
    if (!path.startsWith("/local/")) throw new LocalBindingError("UNAVAILABLE");
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
      throw new LocalBindingError("INVALID_RESPONSE");
    }
    if (!response.ok) throw new LocalBindingError(errorCode(value));
    return value;
  }
}
