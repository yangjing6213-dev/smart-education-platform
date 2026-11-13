export type LeaveRole = "parent" | "staff";
export type LeaveReason = "FAMILY_ARRANGEMENT" | "TEMPORARY_MATTER";
export type LeaveFields = {
  readonly startDate: string;
  readonly endDate: string;
  readonly reason: LeaveReason;
};
export type LeaveInput = LeaveFields & { readonly bindingId: string };
export type LeaveBinding = {
  readonly id: string;
  readonly studentLabel: string;
  readonly classLabel: string;
};
export type LeaveRecord = LeaveFields & {
  readonly id: string;
  readonly version: number;
  readonly bindingId: string;
  readonly studentLabel: string;
  readonly classLabel: string;
  readonly guardianLabel: string;
  readonly status: "SUBMITTED" | "CONFIRMED" | "RETURNED" | "WITHDRAWN";
  readonly acknowledged: boolean;
};
export type LeaveSnapshot = {
  readonly status: "IDLE" | "CONNECTING" | "BUSY" | "READY" | "ERROR" | "DENIED";
  readonly role: LeaveRole | null;
  readonly displayName: string;
  readonly bindings: readonly LeaveBinding[];
  readonly requests: readonly LeaveRecord[];
  readonly message: string;
};
type LeaveOptions = {
  readonly role: LeaveRole;
  readonly baseUrl: string;
  readonly fetcher?: typeof fetch;
};
type Identity = {
  readonly actor_id: string;
  readonly display_name: string;
  readonly memberships: readonly {
    readonly status: string;
    readonly capabilities: readonly string[];
  }[];
};
type ApiLeave = {
  readonly id: string;
  readonly student_id: string;
  readonly student_display_ref: string;
  readonly class_ref?: string;
  readonly start_date: string;
  readonly end_date: string;
  readonly reason_category: string;
  readonly status: string;
  readonly version: number;
  readonly acknowledged: boolean;
  readonly updated_at: string;
};
type LocalBinding = LeaveBinding & { readonly studentId: string };
type ApiFailure = Error & { readonly status?: number };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const EMPTY: LeaveSnapshot = {
  status: "IDLE",
  role: null,
  displayName: "",
  bindings: [],
  requests: [],
  message: "请使用项目提供的受邀账号登录。",
};
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= 120;
const uuid = (value: unknown): value is string => typeof value === "string" && UUID.test(value);
const version = (value: unknown): value is number =>
  Number.isSafeInteger(value) && Number(value) > 0;

function date(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^202[6-9]-\d{2}-\d{2}$/u.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}

function fields(value: LeaveFields): boolean {
  return (
    date(value.startDate) &&
    date(value.endDate) &&
    value.endDate >= value.startDate &&
    Date.parse(value.endDate) - Date.parse(value.startDate) <= 30 * 86400000 &&
    ["FAMILY_ARRANGEMENT", "TEMPORARY_MATTER"].includes(value.reason)
  );
}

function origin(baseUrl: string): string {
  const url = new URL(baseUrl);
  if (
    !(
      url.protocol === "https:" ||
      (url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname) && !!url.port)
    ) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error("请假页面需要安全的同源网页地址。");
  }
  return url.origin;
}

function allowed(role: LeaveRole, path: string, method: string): boolean {
  if (path === "/api-local/identity/login" || path === "/api-local/identity/logout")
    return method === "POST";
  if (path === "/api-local/me") return method === "GET";
  if (role === "parent" && path === "/api-local/guardian-relationships") return method === "GET";
  if (role === "parent" && path === "/api-local/parent/leave-requests")
    return method === "GET" || method === "POST";
  if (role === "staff" && path === "/api-local/staff/leave-requests") return method === "GET";

  const parentAction =
    /^\/api-local\/parent\/leave-requests\/([^/]+)\/(resubmit|withdraw|acknowledge)$/u.exec(path);
  if (role === "parent" && parentAction && UUID.test(parentAction[1] ?? "") && method === "POST")
    return true;

  const staffAction = /^\/api-local\/staff\/leave-requests\/([^/]+)\/review$/u.exec(path);
  return role === "staff" && !!staffAction && UUID.test(staffAction[1] ?? "") && method === "POST";
}

export function createLeaveTransport(
  role: LeaveRole,
  baseUrl: string,
  fetcher: typeof fetch = globalThis.fetch.bind(globalThis),
): typeof fetch {
  if (role !== "parent" && role !== "staff") throw new Error("无效的请假页面角色。");
  const base = origin(baseUrl);
  return async (input, init = {}) => {
    if (typeof input !== "string") return new Response(null, { status: 403 });
    let url: URL;
    try {
      url = new URL(input, base);
    } catch {
      return new Response(null, { status: 403 });
    }
    const method = (init.method ?? "GET").toUpperCase();
    if (url.origin !== base || url.search || url.hash || !allowed(role, url.pathname, method))
      return new Response(null, { status: 403 });

    const headers = new Headers(init.headers);
    headers.delete("authorization");
    return fetcher(url.href, {
      ...init,
      headers,
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(5000),
    });
  };
}

function error(status: number, message: string): ApiFailure {
  return Object.assign(new Error(message), { status });
}

function roleCapabilities(role: LeaveRole): readonly string[] {
  return role === "parent" ? ["binding:read", "leave:apply", "leave:read"] : ["leave:review"];
}

function parseIdentity(value: unknown, role: LeaveRole): Identity {
  if (
    !object(value) ||
    !uuid(value.actor_id) ||
    !safeDisplay(value.display_name) ||
    !Array.isArray(value.memberships)
  )
    throw new Error("账号权限信息格式不正确。");

  const authorized = value.memberships.some((membership: unknown) => {
    if (
      !object(membership) ||
      membership.status !== "ACTIVE" ||
      !Array.isArray(membership.capabilities)
    )
      return false;
    const capabilities = membership.capabilities;
    return roleCapabilities(role).every((capability) => capabilities.includes(capability));
  });
  if (!authorized) throw error(403, "当前受邀账号没有此页面所需的请假权限。");
  return value as unknown as Identity;
}

function parseRelationships(value: unknown): LocalBinding[] {
  if (!Array.isArray(value) || value.length > 200) throw new Error("孩子关系列表暂不可用。");
  const rows: LocalBinding[] = [];
  const seenIds = new Set<string>();
  const seenStudents = new Set<string>();
  for (const raw of value) {
    if (!object(raw) || typeof raw.status !== "string") throw new Error("孩子关系列表格式不正确。");
    if (raw.status !== "ACTIVE") continue;
    if (!uuid(raw.id) || !uuid(raw.student_id) || seenIds.has(raw.id))
      throw new Error("孩子关系列表格式不正确。");
    if (seenStudents.has(raw.student_id)) continue;
    seenIds.add(raw.id);
    seenStudents.add(raw.student_id);
    const id = `binding-${rows.length + 1}`;
    rows.push({
      id,
      studentId: raw.student_id,
      studentLabel: `孩子 ${rows.length + 1}`,
      classLabel: "已审核关系",
    });
  }
  return rows;
}

function parseLeaveRows(
  value: unknown,
  role: LeaveRole,
  bindings: readonly LocalBinding[],
  displayName: string,
): LeaveRecord[] {
  if (!Array.isArray(value) || value.length > 500) throw new Error("请假记录列表暂不可用。");
  const byStudent = new Map(bindings.map((binding) => [binding.studentId, binding]));
  const seen = new Set<string>();
  return value.flatMap((raw) => {
    if (!object(raw)) throw new Error("请假记录格式不正确。");
    const row = raw as unknown as ApiLeave;
    if (
      !uuid(row.id) ||
      seen.has(row.id) ||
      !uuid(row.student_id) ||
      !version(row.version) ||
      !date(row.start_date) ||
      !date(row.end_date) ||
      row.end_date < row.start_date ||
      Date.parse(row.end_date) - Date.parse(row.start_date) > 30 * 86400000 ||
      !["FAMILY_ARRANGEMENT", "TEMPORARY_MATTER"].includes(row.reason_category) ||
      !["SUBMITTED", "CONFIRMED", "RETURNED", "WITHDRAWN"].includes(row.status) ||
      typeof row.acknowledged !== "boolean" ||
      !dateOrTimestamp(row.updated_at)
    )
      throw new Error("请假记录格式不正确。");
    seen.add(row.id);

    const binding = byStudent.get(row.student_id);
    if (role === "parent" && !binding) return [];
    const studentLabel =
      role === "parent" ? binding!.studentLabel : safeDisplay(row.student_display_ref);
    const classLabel = role === "staff" ? (safeDisplay(row.class_ref) ?? "") : "";
    if (!studentLabel || (role === "staff" && !classLabel)) throw new Error("请假摘要格式不正确。");
    return [
      {
        id: row.id,
        version: row.version,
        bindingId: binding?.id ?? "",
        studentLabel,
        classLabel,
        guardianLabel: role === "parent" ? displayName : "家长",
        status: row.status as LeaveRecord["status"],
        startDate: row.start_date,
        endDate: row.end_date,
        reason: row.reason_category as LeaveReason,
        acknowledged: row.acknowledged,
      },
    ];
  });
}

function dateOrTimestamp(value: unknown): boolean {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function safeDisplay(value: unknown): string | null {
  return text(value) && !UUID.test(value) ? value : null;
}

export class LeaveClient {
  private value: LeaveSnapshot = EMPTY;
  private readonly transport: typeof fetch;
  private readonly role: LeaveRole;
  private authenticated = false;
  private bindingData: readonly LocalBinding[] = [];
  private generation = 0;

  constructor(options: LeaveOptions) {
    this.role = options.role;
    this.transport = createLeaveTransport(options.role, options.baseUrl, options.fetcher);
  }

  get snapshot(): LeaveSnapshot {
    return this.value;
  }

  disconnect(): void {
    this.generation += 1;
    this.authenticated = false;
    this.bindingData = [];
    this.value = EMPTY;
  }

  async restore(): Promise<void> {
    const generation = ++this.generation;
    this.authenticated = false;
    this.bindingData = [];
    this.value = { ...EMPTY, status: "CONNECTING", message: "正在核对登录状态…" };
    try {
      const identity = parseIdentity(await this.request<unknown>("/api-local/me"), this.role);
      if (generation !== this.generation) return;
      this.authenticated = true;
      this.value = {
        ...EMPTY,
        status: "BUSY",
        role: this.role,
        displayName: identity.display_name,
        message: "正在读取当前授权范围…",
      };
      await this.load(generation);
    } catch (cause) {
      if (generation !== this.generation) return;
      this.authenticated = false;
      this.bindingData = [];
      const status = object(cause) && typeof cause.status === "number" ? cause.status : 0;
      this.value = {
        ...EMPTY,
        status: status === 401 ? "IDLE" : status === 403 ? "DENIED" : "ERROR",
        message:
          status === 401
            ? "请先使用受邀账号登录。"
            : status === 403
              ? "当前账号没有此页面所需的权限，请切换账号。"
              : "账号服务暂不可用，请稍后重新登录。",
      };
    }
  }

  async login(username: string, password: string): Promise<void> {
    const generation = ++this.generation;
    this.authenticated = false;
    this.bindingData = [];
    this.value = { ...EMPTY, status: "CONNECTING", message: "正在验证受邀账号…" };
    try {
      const login = await this.request<unknown>("/api-local/identity/login", "POST", {
        username,
        password,
      });
      if (generation !== this.generation) return;
      if (
        !object(login) ||
        login.token_type !== "Bearer" ||
        typeof login.expires_at !== "string" ||
        !dateOrTimestamp(login.expires_at) ||
        Date.parse(login.expires_at) <= Date.now() ||
        "access_token" in login
      )
        throw new Error("登录服务返回的信息不正确。");
      const identity = parseIdentity(await this.request<unknown>("/api-local/me"), this.role);
      if (generation !== this.generation) return;
      this.authenticated = true;
      this.value = {
        status: "BUSY",
        role: this.role,
        displayName: identity.display_name,
        bindings: [],
        requests: [],
        message: "正在读取当前授权范围…",
      };
      await this.load(generation);
    } catch (cause) {
      if (generation !== this.generation) return;
      this.authenticated = false;
      const status = object(cause) && typeof cause.status === "number" ? cause.status : 0;
      this.value = {
        ...EMPTY,
        status: status === 401 || status === 403 ? "DENIED" : "ERROR",
        message:
          status === 401
            ? "账号或密码不正确，请检查受邀账号信息。"
            : status === 403
              ? cause instanceof Error
                ? cause.message
                : "当前受邀账号没有此页面所需的权限。"
              : cause instanceof Error
                ? cause.message
                : "本机登录服务暂不可用，请稍后重试。",
      };
      throw cause;
    }
  }

  async logout(): Promise<void> {
    const generation = ++this.generation;
    const { role, displayName } = this.value;
    this.bindingData = [];
    this.value = { ...EMPTY, status: "BUSY", role, displayName, message: "正在退出登录…" };
    try {
      await this.request<unknown>("/api-local/identity/logout", "POST", {});
      if (generation === this.generation) {
        this.authenticated = false;
        this.value = { ...EMPTY, message: "已退出登录。请使用受邀账号重新登录。" };
      }
    } catch (cause) {
      if (generation === this.generation) {
        this.authenticated = false;
        this.value = {
          ...EMPTY,
          status: "ERROR",
          role,
          displayName,
          message: "退出尚未确认，请重试退出登录。",
        };
      }
      throw cause;
    }
  }

  async refresh(): Promise<void> {
    if (!this.ready()) return;
    const generation = this.generation;
    const { role, displayName } = this.value;
    this.value = { ...EMPTY, status: "BUSY", role, displayName, message: "正在刷新请假记录…" };
    try {
      await this.load(generation);
    } catch (cause) {
      this.fail(generation, cause);
    }
  }

  async apply(input: LeaveInput): Promise<void> {
    if (!this.ready() || this.role !== "parent") return;
    if (!fields(input) || !this.localBindings().some((row) => row.id === input.bindingId)) {
      this.value = { ...this.value, message: "请选择已审核的孩子，检查请假日期与原因后再提交。" };
      return;
    }
    const binding = this.localBindings().find((row) => row.id === input.bindingId);
    if (!binding) return;
    await this.change("/api-local/parent/leave-requests", "POST", {
      student_id: binding.studentId,
      start_date: input.startDate,
      end_date: input.endDate,
      reason_category: input.reason,
    });
  }

  async resubmit(id: string, expectedVersion: number, input: LeaveFields): Promise<void> {
    if (this.role !== "parent" || !this.find(id, expectedVersion, ["RETURNED"])) return;
    if (!fields(input)) {
      this.value = { ...this.value, message: "请检查日期与请假原因，起止日期最多相隔30天。" };
      return;
    }
    await this.change(`/api-local/parent/leave-requests/${id}/resubmit`, "POST", {
      version: expectedVersion,
      start_date: input.startDate,
      end_date: input.endDate,
      reason_category: input.reason,
    });
  }

  async review(id: string, expectedVersion: number, action: "confirm" | "return"): Promise<void> {
    if (this.role !== "staff" || !this.find(id, expectedVersion, ["SUBMITTED"])) return;
    await this.change(`/api-local/staff/leave-requests/${id}/review`, "POST", {
      version: expectedVersion,
      action,
    });
  }

  async withdraw(id: string, expectedVersion: number): Promise<void> {
    if (this.role !== "parent" || !this.find(id, expectedVersion, ["SUBMITTED", "RETURNED"]))
      return;
    await this.change(`/api-local/parent/leave-requests/${id}/withdraw`, "POST", {
      version: expectedVersion,
    });
  }

  async acknowledge(id: string, expectedVersion: number): Promise<void> {
    if (this.role !== "parent") return;
    const row = this.find(id, expectedVersion, ["CONFIRMED", "RETURNED"]);
    if (!row || row.acknowledged) return;
    await this.change(`/api-local/parent/leave-requests/${id}/acknowledge`, "POST", {
      version: expectedVersion,
    });
  }

  private ready(): boolean {
    return this.value.status === "READY" && this.authenticated;
  }

  private localBindings(): readonly LocalBinding[] {
    return this.bindingData;
  }

  private find(
    id: string,
    expectedVersion: number,
    statuses: readonly LeaveRecord["status"][],
  ): LeaveRecord | undefined {
    if (!this.ready() || !uuid(id) || !version(expectedVersion)) return undefined;
    return this.value.requests.find(
      (row) => row.id === id && row.version === expectedVersion && statuses.includes(row.status),
    );
  }

  private async change(path: string, method: string, body: object): Promise<void> {
    const generation = this.generation;
    const { role, displayName } = this.value;
    this.value = { ...EMPTY, status: "BUSY", role, displayName, message: "正在提交处理，请稍候…" };
    try {
      await this.request<unknown>(path, method, body);
      if (generation === this.generation) await this.load(generation);
    } catch (cause) {
      this.fail(generation, cause);
    }
  }

  private async load(generation: number): Promise<void> {
    const role = this.role;
    const displayName = this.value.displayName;
    const [rawBindings, rawRequests] = await Promise.all([
      role === "parent"
        ? this.request<unknown>("/api-local/guardian-relationships")
        : Promise.resolve([]),
      this.request<unknown>(
        role === "parent" ? "/api-local/parent/leave-requests" : "/api-local/staff/leave-requests",
      ),
    ]);
    if (generation !== this.generation) return;
    const localBindings = role === "parent" ? parseRelationships(rawBindings) : [];
    const nextRequests = parseLeaveRows(rawRequests, role, localBindings, displayName);
    this.bindingData = localBindings;
    this.value = {
      status: "READY",
      role,
      displayName,
      bindings: localBindings.map(({ id, studentLabel, classLabel }) => ({
        id,
        studentLabel,
        classLabel,
      })),
      requests: nextRequests,
      message:
        role === "parent"
          ? "请假记录已更新，请以当前状态为准。"
          : "请假审核列表已更新，仅显示受邀账号负责范围内的申请。",
    };
  }

  private async request<T>(path: string, method = "GET", body?: object): Promise<T> {
    const response = await this.transport(path, {
      method,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      ...(body === undefined ? {} : { headers: { "content-type": "application/json" } }),
    });
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw error(response.status, "本机服务返回的信息无法读取。");
    }
    if (!response.ok) throw error(response.status, "本机请假服务未能完成操作。");
    if (!object(payload) || !("data" in payload)) throw new Error("本机服务返回的信息格式不正确。");
    return payload.data as T;
  }

  private fail(generation: number, cause: unknown): void {
    if (generation !== this.generation) return;
    this.authenticated = false;
    this.bindingData = [];
    const status = object(cause) && typeof cause.status === "number" ? cause.status : 0;
    this.value = {
      ...EMPTY,
      status: status === 401 || status === 403 ? "DENIED" : "ERROR",
      message:
        status === 409
          ? "申请状态已更新或日期重叠，请刷新后核对再操作。"
          : status === 401 || status === 403
            ? "登录状态或账号权限已失效，请重新登录。"
            : "本机请假服务暂不可用，已清除当前记录，请重新登录后再试。",
    };
  }
}
