export type CareRecordReviewProfile = "owner-east" | "owner-west";
export type AdminCareRecord = {
  readonly id: string;
  readonly version: number;
  readonly date: string;
  readonly status:
    "DRAFT" | "SUBMITTED" | "CONFIRMED" | "RETURNED" | "CANCELLED" | "EXCEPTION_PENDING";
  readonly values: Readonly<Record<string, string>>;
  readonly tenantId: string;
  readonly campusId: string;
  readonly classId: string;
  readonly studentId: string;
  readonly studentLabel: string;
  readonly createdBy: string;
  readonly reviewedBy: string | null;
  readonly published: boolean;
  readonly summaryLabel: string;
};
export type CareRecordReviewSnapshot = {
  readonly status: "IDLE" | "CONNECTING" | "BUSY" | "READY" | "ERROR" | "DENIED";
  readonly profile: CareRecordReviewProfile | null;
  readonly actor: {
    readonly actorId: string;
    readonly tenantId: string;
    readonly campusId: string;
    readonly classIds: readonly string[];
    readonly actions: readonly string[];
  } | null;
  readonly records: readonly AdminCareRecord[];
  readonly message: string;
};
export type CareRecordReviewClientOptions = {
  readonly baseUrl?: string;
  readonly fetcher?: typeof fetch;
};

const API_BASE = "http://127.0.0.1:4317";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const fields = ["arrival", "homework", "meal", "rest", "activity", "wellbeing"] as const;
const validStatus = (value: unknown): value is AdminCareRecord["status"] =>
  typeof value === "string" &&
  ["DRAFT", "SUBMITTED", "CONFIRMED", "RETURNED", "CANCELLED", "EXCEPTION_PENDING"].includes(value);
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isProfile = (value: unknown): value is CareRecordReviewProfile =>
  value === "owner-east" || value === "owner-west";
type CareRecordActor = {
  readonly actorId: string;
  readonly tenantId: string;
  readonly campusId: string;
  readonly classIds: readonly string[];
  readonly actions: readonly string[];
};

class CareRecordReviewApiError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

function allowedRequest(path: string, method: string): boolean {
  if (path === "/local/sessions") return method === "POST";
  if (path === "/local/session" || path === "/local/care-records") return method === "GET";
  const match =
    /^\/local\/care-records\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/(review|publish|revoke-publication)$/iu.exec(
      path,
    );
  return Boolean(match && method === "POST");
}

export function createCareRecordReviewTransport(
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
    throw new Error("成长记录审核只允许连接本机服务。");
  return async (input, init = {}) => {
    if (typeof input !== "string") return new Response(null, { status: 403 });
    let url: URL;
    try {
      url = new URL(input, base.origin);
    } catch {
      return new Response(null, { status: 403 });
    }
    if (
      url.origin !== base.origin ||
      url.search ||
      !allowedRequest(url.pathname, init.method ?? "GET")
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

function parseActor(value: unknown, expected: CareRecordReviewProfile) {
  if (
    !object(value) ||
    value.mode !== "local-synthetic" ||
    value.profile !== expected ||
    !UUID.test(String(value.actorId)) ||
    !UUID.test(String(value.tenantId)) ||
    !UUID.test(String(value.campusId)) ||
    !Array.isArray(value.classIds) ||
    !value.classIds.every((id) => typeof id === "string" && UUID.test(id)) ||
    !Array.isArray(value.actions) ||
    !value.actions.every((action) => typeof action === "string") ||
    !value.actions.includes("care:review") ||
    !value.actions.includes("care:publish")
  )
    throw new CareRecordReviewApiError("UNAVAILABLE");
  return {
    actorId: value.actorId as string,
    tenantId: value.tenantId as string,
    campusId: value.campusId as string,
    classIds: value.classIds as string[],
    actions: value.actions as string[],
  };
}

function parseValues(value: unknown): Record<string, string> {
  if (
    !object(value) ||
    Object.keys(value).length !== fields.length ||
    !fields.every((field) => typeof value[field] === "string")
  )
    throw new CareRecordReviewApiError("INVALID_RECORD");
  return Object.fromEntries(fields.map((field) => [field, value[field] as string]));
}

function parseRecords(value: unknown, actor: CareRecordActor): AdminCareRecord[] {
  if (!Array.isArray(value)) throw new CareRecordReviewApiError("INVALID_RECORDS");
  const rows = value.map((row): AdminCareRecord | null => {
    if (
      !object(row) ||
      typeof row.id !== "string" ||
      !UUID.test(row.id) ||
      !Number.isSafeInteger(row.version) ||
      Number(row.version) < 1 ||
      typeof row.date !== "string" ||
      !/^202[6-9]-\d{2}-\d{2}$/u.test(row.date) ||
      !validStatus(row.status) ||
      row.tenantId !== actor.tenantId ||
      row.campusId !== actor.campusId ||
      typeof row.classId !== "string" ||
      !actor.classIds.includes(row.classId) ||
      typeof row.studentId !== "string" ||
      typeof row.createdBy !== "string" ||
      (row.reviewedBy !== null && typeof row.reviewedBy !== "string") ||
      typeof row.published !== "boolean" ||
      typeof row.studentLabel !== "string" ||
      !row.studentLabel.trim() ||
      row.studentLabel.length > 80
    )
      return null;
    const values = parseValues(row.values);
    const summaryLabel = Object.values(values).join(" · ");
    return {
      id: row.id,
      version: Number(row.version),
      date: row.date,
      status: row.status,
      values,
      tenantId: row.tenantId as string,
      campusId: row.campusId as string,
      classId: row.classId,
      studentId: row.studentId,
      studentLabel: row.studentLabel,
      createdBy: row.createdBy,
      reviewedBy: row.reviewedBy as string | null,
      published: row.published,
      summaryLabel,
    };
  });
  if (rows.some((row) => row === null)) throw new CareRecordReviewApiError("INVALID_RECORDS");
  return rows as AdminCareRecord[];
}

export class CareRecordReviewClient {
  private readonly transport: typeof fetch;
  private generation = 0;
  private handle: string | null = null;
  private value: CareRecordReviewSnapshot = {
    status: "IDLE",
    profile: null,
    actor: null,
    records: [],
    message: "连接本机共享服务后查看待审核成长记录。",
  };

  constructor(options: CareRecordReviewClientOptions = {}) {
    this.transport = createCareRecordReviewTransport(options.baseUrl, options.fetcher);
  }

  get snapshot(): CareRecordReviewSnapshot {
    return structuredClone(this.value);
  }

  disconnect(): void {
    this.generation += 1;
    this.handle = null;
    this.value = {
      status: "IDLE",
      profile: null,
      actor: null,
      records: [],
      message: "本机共享服务连接已关闭。",
    };
  }

  async connect(profile: unknown): Promise<void> {
    this.disconnect();
    if (!isProfile(profile)) {
      this.value = {
        status: "DENIED",
        profile: null,
        actor: null,
        records: [],
        message: "当前负责人身份没有成长记录审核权限。",
      };
      return;
    }
    const generation = this.generation;
    this.value = {
      status: "CONNECTING",
      profile,
      actor: null,
      records: [],
      message: "正在连接本机共享服务…",
    };
    try {
      const created = await this.request("/local/sessions", "POST", { profile });
      if (generation !== this.generation) return;
      if (
        !object(created) ||
        typeof created.handle !== "string" ||
        !/^[\w-]{43}$/u.test(created.handle)
      )
        throw new CareRecordReviewApiError("INVALID_SESSION");
      const handle = created.handle;
      const actor = parseActor(
        await this.request("/local/session", "GET", undefined, handle),
        profile,
      );
      if (generation !== this.generation) return;
      this.handle = handle;
      this.value = { ...this.value, actor };
      await this.load(generation);
    } catch (error) {
      if (generation !== this.generation) return;
      const denied = error instanceof CareRecordReviewApiError && error.code === "UNAVAILABLE";
      this.handle = null;
      this.value = {
        status: denied ? "DENIED" : "ERROR",
        profile,
        actor: null,
        records: [],
        message: denied ? "当前负责人身份没有成长记录审核权限。" : "无法连接本机成长记录服务。",
      };
    }
  }

  async refresh(): Promise<void> {
    if (this.value.status === "CONNECTING" || this.value.status === "BUSY") return;
    if (!this.value.profile) return;
    if (!this.handle || !this.value.actor) {
      await this.connect(this.value.profile);
      return;
    }
    const generation = this.generation;
    this.value = { ...this.value, status: "BUSY", records: [], message: "正在刷新审核队列…" };
    try {
      await this.load(generation);
    } catch (error) {
      if (generation !== this.generation) return;
      this.fail(error);
    }
  }

  async review(id: string, version: number, decision: "CONFIRM" | "RETURN"): Promise<void> {
    const action = decision === "CONFIRM" ? "confirm" : "return";
    await this.mutate(
      `/local/care-records/${id}/review`,
      { version, action },
      decision === "CONFIRM" ? "审核已通过。发布给家长仍需单独操作。" : "记录已退回员工修改。",
    );
  }

  async publish(id: string, version: number): Promise<void> {
    await this.mutate(
      `/local/care-records/${id}/publish`,
      { version },
      "成长记录已单独发布给家长。",
    );
  }

  async revoke(id: string, version: number): Promise<void> {
    await this.mutate(
      `/local/care-records/${id}/revoke-publication`,
      { version },
      "家长端已停止显示该记录。",
    );
  }

  private async mutate(path: string, body: object, message: string): Promise<void> {
    if (!this.handle || this.value.status !== "READY") return;
    const generation = this.generation;
    this.value = { ...this.value, status: "BUSY", records: [], message: "正在保存审核结果…" };
    try {
      await this.request(path, "POST", body);
      if (generation !== this.generation) return;
      await this.load(generation, message);
    } catch (error) {
      if (generation !== this.generation) return;
      this.fail(error);
    }
  }

  private async load(
    generation: number,
    message = "已显示本校区授权范围内的成长记录。",
  ): Promise<void> {
    if (!this.handle || !this.value.actor) throw new CareRecordReviewApiError("UNAVAILABLE");
    const actor = this.value.actor;
    const response = await this.request("/local/care-records");
    if (generation !== this.generation) return;
    const records = parseRecords(response, actor);
    this.value = { ...this.value, status: "READY", records, message };
  }

  private async request(path: string, method = "GET", body?: object, handle = this.handle) {
    if (!allowedRequest(path, method)) throw new CareRecordReviewApiError("REQUEST_NOT_ALLOWED");
    const response = await this.transport(path, {
      method,
      headers: {
        Accept: "application/json",
        ...(handle ? { Authorization: `Bearer ${handle}` } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    let value: unknown;
    try {
      value = await response.json();
    } catch {
      throw new CareRecordReviewApiError("INVALID_RESPONSE");
    }
    if (!response.ok) {
      const code =
        object(value) && object(value.error) && typeof value.error.code === "string"
          ? value.error.code
          : "REQUEST_FAILED";
      throw new CareRecordReviewApiError(code);
    }
    return value;
  }

  private fail(error: unknown): void {
    const code = error instanceof CareRecordReviewApiError ? error.code : "REQUEST_FAILED";
    this.handle = null;
    this.value = {
      ...this.value,
      status: code === "UNAVAILABLE" ? "DENIED" : "ERROR",
      actor: null,
      records: [],
      message:
        code === "STATE_CONFLICT"
          ? "记录已被其他操作更新，请刷新后重新审核。"
          : code === "UNAVAILABLE"
            ? "记录不在当前负责人授权范围内，未作修改。"
            : "本机共享服务暂不可用，审核队列已清空。",
    };
  }
}
