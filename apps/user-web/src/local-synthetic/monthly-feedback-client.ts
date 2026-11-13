import {
  parseMonthlyFeedbackParentRows,
  parseMonthlyFeedbackRows,
  type MonthlyFeedbackParentRow,
  type MonthlyFeedbackStaffRow,
  type MonthlyFeedbackSupplementCode,
} from "./monthly-feedback.js";

const API_BASE = "http://127.0.0.1:4317";
export type MonthlyFeedbackProfile = "teacher-east" | "parent-alpha";
export type MonthlyFeedbackFormAction = "create" | "resubmit" | "rebuild";
export type MonthlyFeedbackAction = "submit" | "resubmit" | "rebuild" | "ack";
type Supplements = Record<string, MonthlyFeedbackSupplementCode>;

export interface MonthlyFeedbackSession {
  readonly profile: MonthlyFeedbackProfile;
  readonly label: string;
  readonly actorId: string;
  readonly tenantId: string;
  readonly campusId: string;
  readonly classIds: readonly string[];
  readonly actions: readonly string[];
}

export interface MonthlyFeedbackSnapshot {
  readonly status: "IDLE" | "CONNECTING" | "BUSY" | "READY" | "ERROR";
  readonly profile: MonthlyFeedbackProfile;
  readonly session: MonthlyFeedbackSession | null;
  readonly monthlyFeedbackOwned: readonly MonthlyFeedbackStaffRow[];
  readonly monthlyFeedbackReview: readonly MonthlyFeedbackStaffRow[];
  readonly monthlyFeedbackParent: readonly MonthlyFeedbackParentRow[];
  readonly message: string;
  readonly error: string | null;
}

export interface MonthlyFeedbackClientOptions {
  readonly baseUrl?: string;
  readonly fetcher?: typeof fetch;
}

const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const uuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
const text = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= 120;
const validSupplements = (value: unknown): value is Supplements => {
  if (!object(value)) return false;
  const fields = [
    "learningParticipation",
    "dailyHabits",
    "activityParticipation",
    "familySchoolCollaboration",
  ];
  return (
    Object.keys(value).length === fields.length &&
    fields.every(
      (field) =>
        value[field] === "KEEP_WATCHING" ||
        value[field] === "PROGRESSING" ||
        value[field] === "FOLLOW_UP",
    )
  );
};
const validMonth = (value: unknown): value is string =>
  typeof value === "string" && /^202[6-9]-(?:0[1-9]|1[0-2])$/u.test(value);

function allowedRequest(path: string, method: string): boolean {
  if (path === "/local/sessions") return method === "POST";
  if (
    ["/local/session", "/local/monthly-feedback-owned", "/local/monthly-feedback-parent"].includes(
      path,
    )
  )
    return method === "GET";
  if (path === "/local/monthly-feedback") return method === "POST";
  const feedback =
    /^\/local\/monthly-feedback\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
      path,
    );
  if (feedback) return method === "PATCH";
  return (
    /^\/local\/monthly-feedback\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/(?:submit|resubmit|ack)$/iu.test(
      path,
    ) && method === "POST"
  );
}

export function createLocalMonthlyFeedbackTransport(
  baseUrl = API_BASE,
  fetcher: typeof fetch = globalThis.fetch.bind(globalThis),
): typeof fetch {
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
    throw new Error("月度反馈仅允许连接本机服务。");
  const origin = base.origin;
  return async (input, init = {}) => {
    if (typeof input !== "string") return new Response(null, { status: 403 });
    let url: URL;
    try {
      url = new URL(input, origin);
    } catch {
      return new Response(null, { status: 403 });
    }
    const method = init.method ?? "GET";
    if (url.origin !== origin || !allowedRequest(url.pathname, method))
      return new Response(null, { status: 403 });
    return fetcher(url, { ...init, credentials: "omit", cache: "no-store", redirect: "error" });
  };
}

function parseSession(value: unknown, expected: MonthlyFeedbackProfile): MonthlyFeedbackSession {
  const requiredAction = expected === "teacher-east" ? "feedback:create" : "feedback:ack";
  if (
    !object(value) ||
    value.mode !== "local-synthetic" ||
    value.profile !== expected ||
    !text(value.label) ||
    !uuid(value.actorId) ||
    !uuid(value.tenantId) ||
    !uuid(value.campusId) ||
    !Array.isArray(value.classIds) ||
    !value.classIds.every(uuid) ||
    !Array.isArray(value.actions) ||
    !value.actions.every(text) ||
    !value.actions.includes("feedback:read") ||
    !value.actions.includes(requiredAction)
  )
    throw new Error("当前示例身份不能查看月度反馈。");
  return {
    profile: expected,
    label: value.label,
    actorId: value.actorId,
    tenantId: value.tenantId,
    campusId: value.campusId,
    classIds: value.classIds,
    actions: value.actions,
  };
}

export class MonthlyFeedbackClient {
  private handle: string | null = null;
  private connection: Promise<void> | null = null;
  private readonly transport: typeof fetch;
  private state: MonthlyFeedbackSnapshot;

  constructor(
    private readonly profile: MonthlyFeedbackProfile,
    options: MonthlyFeedbackClientOptions = {},
  ) {
    this.transport = createLocalMonthlyFeedbackTransport(
      options.baseUrl ?? API_BASE,
      options.fetcher,
    );
    this.state = {
      status: "IDLE",
      profile,
      session: null,
      monthlyFeedbackOwned: [],
      monthlyFeedbackReview: [],
      monthlyFeedbackParent: [],
      message: "连接本机共享服务后查看月度反馈。",
      error: null,
    };
  }

  get snapshot(): MonthlyFeedbackSnapshot {
    return structuredClone(this.state);
  }

  private async request(path: string, method = "GET", body?: object): Promise<unknown> {
    if (!allowedRequest(path, method)) throw new Error("月度反馈请求不在本机白名单内。");
    const response = await this.transport(path, {
      method,
      credentials: "omit",
      cache: "no-store",
      redirect: "error",
      headers: {
        Accept: "application/json",
        ...(this.handle ? { Authorization: `Bearer ${this.handle}` } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok)
      throw new Error(
        response.status === 409 ? "反馈版本已变化，请刷新后重试。" : "本机月度反馈服务暂不可用。",
      );
    return response.json();
  }

  private async loadRows(session: MonthlyFeedbackSession): Promise<{
    monthlyFeedbackOwned: MonthlyFeedbackStaffRow[];
    monthlyFeedbackParent: MonthlyFeedbackParentRow[];
  }> {
    if (session.profile === "parent-alpha")
      return {
        monthlyFeedbackOwned: [],
        monthlyFeedbackParent: parseMonthlyFeedbackParentRows(
          await this.request("/local/monthly-feedback-parent"),
        ),
      };
    return {
      monthlyFeedbackOwned: parseMonthlyFeedbackRows(
        await this.request("/local/monthly-feedback-owned"),
        session,
      ),
      monthlyFeedbackParent: [],
    };
  }

  connect(): Promise<void> {
    if (this.connection) return this.connection;
    if (this.state.status === "READY" && this.handle) return Promise.resolve();
    this.connection = this.connectOnce().finally(() => {
      this.connection = null;
    });
    return this.connection;
  }

  private async connectOnce(): Promise<void> {
    this.handle = null;
    this.state = {
      ...this.state,
      status: "CONNECTING",
      session: null,
      monthlyFeedbackOwned: [],
      monthlyFeedbackReview: [],
      monthlyFeedbackParent: [],
      error: null,
      message: "正在连接本机月度反馈…",
    };
    try {
      const bootstrap = await this.request("/local/sessions", "POST", { profile: this.profile });
      if (
        !object(bootstrap) ||
        typeof bootstrap.handle !== "string" ||
        !/^[-\w]{43}$/u.test(bootstrap.handle)
      )
        throw new Error("本机服务没有返回有效的示例会话。");
      this.handle = bootstrap.handle;
      const session = parseSession(await this.request("/local/session"), this.profile);
      const rows = await this.loadRows(session);
      this.state = {
        status: "READY",
        profile: this.profile,
        session,
        monthlyFeedbackOwned: rows.monthlyFeedbackOwned,
        monthlyFeedbackReview: [],
        monthlyFeedbackParent: rows.monthlyFeedbackParent,
        error: null,
        message: "月度反馈已连接本机共享资料。",
      };
    } catch (error) {
      this.handle = null;
      this.state = {
        ...this.state,
        status: "ERROR",
        session: null,
        monthlyFeedbackOwned: [],
        monthlyFeedbackReview: [],
        monthlyFeedbackParent: [],
        error: error instanceof Error ? error.message : "本机连接失败。",
        message: "月度反馈暂时无法连接。",
      };
    }
  }

  disconnect(): void {
    this.handle = null;
    this.connection = null;
    this.state = {
      ...this.state,
      status: "IDLE",
      session: null,
      monthlyFeedbackOwned: [],
      monthlyFeedbackReview: [],
      monthlyFeedbackParent: [],
      error: null,
      message: "连接本机共享服务后查看月度反馈。",
    };
  }

  async refresh(): Promise<void> {
    const session = this.state.session;
    if (!this.handle || !session || this.state.status === "BUSY") return;
    this.state = { ...this.state, status: "BUSY", error: null, message: "正在刷新月度反馈…" };
    try {
      const rows = await this.loadRows(session);
      this.state = {
        ...this.state,
        status: "READY",
        monthlyFeedbackOwned: rows.monthlyFeedbackOwned,
        monthlyFeedbackParent: rows.monthlyFeedbackParent,
        error: null,
        message: "月度反馈已刷新。",
      };
    } catch (error) {
      this.state = {
        ...this.state,
        status: "ERROR",
        error: error instanceof Error ? error.message : "刷新失败。",
        message: "月度反馈刷新失败，请重试。",
      };
    }
  }

  async create(values: Record<string, string>): Promise<void> {
    const session = this.state.session;
    const month = values.month;
    const supplements = {
      learningParticipation: values.learningParticipation,
      dailyHabits: values.dailyHabits,
      activityParticipation: values.activityParticipation,
      familySchoolCollaboration: values.familySchoolCollaboration,
    };
    if (
      !session ||
      session.profile !== "teacher-east" ||
      !session.actions.includes("feedback:create") ||
      !validMonth(month) ||
      !validSupplements(supplements)
    )
      return;
    await this.mutate(async () => {
      await this.request("/local/monthly-feedback", "POST", { month, supplements });
    }, "反馈草稿已保存。");
  }

  async command(
    action: MonthlyFeedbackAction,
    id: string,
    version: number,
    values?: Record<string, string>,
  ): Promise<void> {
    const session = this.state.session;
    if (!session || !uuid(id) || !Number.isSafeInteger(version) || version < 1) return;
    const row =
      session.profile === "parent-alpha"
        ? this.state.monthlyFeedbackParent.find((item) => item.id === id)
        : this.state.monthlyFeedbackOwned.find((item) => item.id === id);
    if (!row || row.version !== version) return;
    let path: string;
    let method = "POST";
    let body: object;
    if (
      action === "submit" &&
      session.profile === "teacher-east" &&
      row.kind === "staff" &&
      row.status === "DRAFT" &&
      row.createdBy === session.actorId &&
      session.actions.includes("feedback:submit")
    ) {
      path = `/local/monthly-feedback/${id}/submit`;
      body = { version };
    } else if (
      action === "resubmit" &&
      session.profile === "teacher-east" &&
      row.kind === "staff" &&
      row.status === "RETURNED" &&
      row.createdBy === session.actorId &&
      session.actions.includes("feedback:submit") &&
      values &&
      validSupplements(values)
    ) {
      path = `/local/monthly-feedback/${id}/resubmit`;
      body = { version, supplements: values };
    } else if (
      action === "rebuild" &&
      session.profile === "teacher-east" &&
      row.kind === "staff" &&
      row.status === "REVIEW_REQUIRED" &&
      row.createdBy === session.actorId &&
      session.actions.includes("feedback:create") &&
      values &&
      validSupplements(values)
    ) {
      path = `/local/monthly-feedback/${id}`;
      method = "PATCH";
      body = { version, supplements: values };
    } else if (
      action === "ack" &&
      session.profile === "parent-alpha" &&
      row.kind === "parent" &&
      row.status === "PUBLISHED" &&
      !row.acknowledged &&
      session.actions.includes("feedback:ack")
    ) {
      path = `/local/monthly-feedback/${id}/ack`;
      body = { version };
    } else return;
    await this.mutate(
      async () => {
        await this.request(path, method, body);
      },
      action === "ack" ? "已确认知悉。" : "反馈已更新。",
    );
  }

  private async mutate(operation: () => Promise<void>, message: string): Promise<void> {
    this.state = { ...this.state, status: "BUSY", error: null, message: "正在保存月度反馈…" };
    try {
      await operation();
      const session = this.state.session;
      if (!session || !this.handle) return;
      const rows = await this.loadRows(session);
      this.state = {
        ...this.state,
        status: "READY",
        monthlyFeedbackOwned: rows.monthlyFeedbackOwned,
        monthlyFeedbackParent: rows.monthlyFeedbackParent,
        error: null,
        message,
      };
    } catch (error) {
      this.state = {
        ...this.state,
        status: "ERROR",
        error: error instanceof Error ? error.message : "保存失败。",
        message: "月度反馈操作未完成，请刷新后重试。",
      };
    }
  }
}
