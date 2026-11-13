export type AdminLeaveStatus = "SUBMITTED" | "CONFIRMED" | "RETURNED" | "WITHDRAWN";
export type AdminLeaveDecision = "CONFIRM" | "RETURN";

export interface AdminLeaveReviewRow {
  readonly id: string;
  readonly version: number;
  readonly status: AdminLeaveStatus;
  readonly startDate: string;
  readonly endDate: string;
  readonly reason: "FAMILY_ARRANGEMENT" | "TEMPORARY_MATTER";
  readonly acknowledged: boolean;
  readonly studentLabel: string;
  readonly guardianLabel: string;
}

export interface AdminLeaveReviewSnapshot {
  readonly status: "IDLE" | "CONNECTING" | "BUSY" | "READY" | "ERROR" | "DENIED";
  readonly profile: "owner-east" | null;
  readonly records: readonly AdminLeaveReviewRow[];
  readonly message: string;
}

export interface AdminLeaveReviewClientOptions {
  readonly baseUrl?: string;
  readonly fetcher?: typeof fetch;
}

const API_BASE = "http://127.0.0.1:4317";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const EAST_TENANT = "00000000-0000-4000-8000-000000000064";
const EAST_CAMPUS = "00000000-0000-4000-8000-000000000065";
const STATUSES: readonly AdminLeaveStatus[] = ["SUBMITTED", "CONFIRMED", "RETURNED", "WITHDRAWN"];
const EMPTY: AdminLeaveReviewSnapshot = {
  status: "IDLE",
  profile: null,
  records: [],
  message: "请假审核连接尚未建立。",
};

type Fetcher = typeof fetch;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSyntheticLabel(value: unknown): value is string {
  return typeof value === "string" && value.length <= 80 && /^(示例|虚构|模拟)/u.test(value);
}

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day!));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month! - 1 && date.getUTCDate() === day
  );
}

function parseRow(value: unknown): AdminLeaveReviewRow | null {
  if (!isRecord(value)) return null;
  const keys = Object.keys(value).sort().join(",");
  if (
    keys !==
      "acknowledged,bindingId,endDate,guardianLabel,history,id,reason,startDate,status,studentId,studentLabel,updatedAt,updatedBy,version" ||
    typeof value.id !== "string" ||
    !UUID.test(value.id) ||
    !Number.isSafeInteger(value.version) ||
    Number(value.version) < 1 ||
    !STATUSES.includes(value.status as AdminLeaveStatus) ||
    !validDate(value.startDate) ||
    !validDate(value.endDate) ||
    value.startDate > value.endDate ||
    (value.reason !== "FAMILY_ARRANGEMENT" && value.reason !== "TEMPORARY_MATTER") ||
    typeof value.acknowledged !== "boolean" ||
    !UUID.test(String(value.bindingId)) ||
    !UUID.test(String(value.studentId)) ||
    !UUID.test(String(value.updatedBy)) ||
    typeof value.updatedAt !== "string" ||
    !Number.isFinite(Date.parse(value.updatedAt)) ||
    !Array.isArray(value.history) ||
    value.history.length > 50 ||
    !isSyntheticLabel(value.studentLabel) ||
    !isSyntheticLabel(value.guardianLabel)
  )
    return null;
  return {
    id: value.id,
    version: Number(value.version),
    status: value.status as AdminLeaveStatus,
    startDate: value.startDate,
    endDate: value.endDate,
    reason: value.reason,
    acknowledged: value.acknowledged,
    studentLabel: value.studentLabel,
    guardianLabel: value.guardianLabel,
  };
}

function parseRows(value: unknown): AdminLeaveReviewRow[] {
  if (!Array.isArray(value) || value.length > 200) throw new Error("INVALID_RECORDS");
  const rows = value.map(parseRow);
  if (rows.some((row) => row === null)) throw new Error("INVALID_RECORDS");
  return rows as AdminLeaveReviewRow[];
}

function allowedRequest(path: string, method: string): boolean {
  if (path === "/local/sessions") return method === "POST";
  if (path === "/local/session" || path === "/local/leave-requests") return method === "GET";
  return (
    /^\/local\/leave-requests\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/review$/iu.test(
      path,
    ) && method === "POST"
  );
}

export function createAdminLeaveReviewTransport(
  baseUrl = API_BASE,
  fetcher: Fetcher = globalThis.fetch.bind(globalThis),
): Fetcher {
  const base = new URL(baseUrl);
  if (
    base.protocol !== "http:" ||
    !["127.0.0.1", "localhost"].includes(base.hostname) ||
    !base.port ||
    base.username ||
    base.password ||
    base.pathname !== "/" ||
    base.search ||
    base.hash
  )
    throw new Error("请假审核只允许连接本机服务。");
  return async (input, init = {}) => {
    if (typeof input !== "string") return new Response(null, { status: 403 });
    let url: URL;
    try {
      url = new URL(input, base.origin);
    } catch {
      return new Response(null, { status: 403 });
    }
    const method = init.method ?? "GET";
    if (
      url.origin !== base.origin ||
      url.search ||
      url.hash ||
      !allowedRequest(url.pathname, method)
    )
      return new Response(null, { status: 403 });
    return fetcher(url, {
      ...init,
      credentials: "omit",
      cache: "no-store",
      redirect: "error",
    });
  };
}

export class AdminLeaveReviewClient {
  private readonly fetcher: Fetcher;
  private generation = 0;
  private handle: string | null = null;
  private value = EMPTY;

  constructor(options: AdminLeaveReviewClientOptions = {}) {
    this.fetcher = createAdminLeaveReviewTransport(
      options.baseUrl ?? API_BASE,
      options.fetcher ?? globalThis.fetch.bind(globalThis),
    );
  }

  get snapshot(): AdminLeaveReviewSnapshot {
    return this.value;
  }

  disconnect(): void {
    this.generation += 1;
    this.handle = null;
    this.value = EMPTY;
  }

  async connect(): Promise<void> {
    this.disconnect();
    const generation = this.generation;
    this.value = {
      status: "CONNECTING",
      profile: "owner-east",
      records: [],
      message: "正在连接本机东校区审核服务…",
    };
    try {
      const created = await this.request("/local/sessions", {
        method: "POST",
        body: JSON.stringify({ profile: "owner-east" }),
      });
      if (
        !isRecord(created) ||
        created.mode !== "local-synthetic" ||
        typeof created.handle !== "string" ||
        !/^[A-Za-z0-9_-]{43}$/u.test(created.handle)
      )
        throw new Error("INVALID_SESSION");
      const handle = created.handle;
      const session = await this.request("/local/session", { handle });
      if (
        !isRecord(session) ||
        session.mode !== "local-synthetic" ||
        session.profile !== "owner-east" ||
        !UUID.test(String(session.actorId)) ||
        session.tenantId !== EAST_TENANT ||
        session.campusId !== EAST_CAMPUS ||
        !Array.isArray(session.classIds) ||
        !session.classIds.length ||
        !session.classIds.every((id) => UUID.test(String(id))) ||
        !Array.isArray(session.actions) ||
        !session.actions.every((action) => typeof action === "string")
      )
        throw new Error("INVALID_SESSION");
      if (!session.actions.includes("leave:review")) {
        this.value = {
          status: "DENIED",
          profile: "owner-east",
          records: [],
          message: "当前模拟身份没有请假审核权限，已隐藏申请资料。",
        };
        return;
      }
      if (generation !== this.generation) return;
      this.handle = handle;
      await this.load(generation, "已连接，仅显示当前负责校区的合成申请。");
    } catch {
      if (generation !== this.generation) return;
      this.handle = null;
      this.value = {
        status: "ERROR",
        profile: null,
        records: [],
        message: "本机审核服务暂不可用，申请资料已隐藏。",
      };
    }
  }

  async refresh(): Promise<void> {
    if (!this.handle || this.value.status !== "READY") return;
    const generation = this.generation;
    this.value = { ...this.value, status: "BUSY", message: "正在刷新当前校区申请…" };
    try {
      await this.load(generation, "申请列表已刷新。");
    } catch {
      if (generation !== this.generation) return;
      this.handle = null;
      this.value = {
        status: "ERROR",
        profile: null,
        records: [],
        message: "刷新失败，申请资料已隐藏；请重新连接核实。",
      };
    }
  }

  async review(id: string, version: number, decision: AdminLeaveDecision): Promise<void> {
    const row = this.value.records.find((item) => item.id === id && item.version === version);
    if (
      !this.handle ||
      this.value.status !== "READY" ||
      !row ||
      row.status !== "SUBMITTED" ||
      (decision !== "CONFIRM" && decision !== "RETURN")
    )
      return;
    const generation = this.generation;
    this.value = { ...this.value, status: "BUSY", message: "正在保存审核结果…" };
    try {
      const receipt = parseRow(
        await this.request(`/local/leave-requests/${id}/review`, {
          method: "POST",
          handle: this.handle,
          body: JSON.stringify({ version, action: decision === "CONFIRM" ? "confirm" : "return" }),
        }),
      );
      const status = decision === "CONFIRM" ? "CONFIRMED" : "RETURNED";
      if (
        !receipt ||
        receipt.id !== id ||
        receipt.version !== version + 1 ||
        receipt.status !== status
      )
        throw new Error("INVALID_RECEIPT");
      await this.load(
        generation,
        decision === "CONFIRM"
          ? "已通过申请，家长端可刷新查看。"
          : "已退回申请，家长端可修改后重交。",
      );
    } catch {
      if (generation !== this.generation) return;
      this.handle = null;
      this.value = {
        status: "ERROR",
        profile: null,
        records: [],
        message: "审核结果暂时无法确认，申请资料已隐藏；请重新连接核实。",
      };
    }
  }

  private async load(generation: number, message: string): Promise<void> {
    if (!this.handle) throw new Error("NO_SESSION");
    const records = parseRows(await this.request("/local/leave-requests", { handle: this.handle }));
    if (generation !== this.generation) return;
    this.value = { status: "READY", profile: "owner-east", records, message };
  }

  private async request(
    path: string,
    options: RequestInit & { handle?: string } = {},
  ): Promise<unknown> {
    const { handle, ...init } = options;
    const response = await this.fetcher(path, {
      ...init,
      headers: {
        ...(handle ? { authorization: `Bearer ${handle}` } : {}),
        ...(init.body ? { "content-type": "application/json" } : {}),
      },
    });
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) throw new Error(`HTTP_${response.status}`);
    return body;
  }
}
