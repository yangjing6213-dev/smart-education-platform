import {
  CARE_RECORD_OPTIONS,
  CARE_RECORD_STATUSES,
  type CareRecord,
  type CareRecordState,
  type CareRecordStatus,
  type CareRecordValues,
} from "../pages/care-record-workflow.js";

export type CareRecordWebProfile = "teacher-east" | "parent-alpha";
export type CareRecordReceipt = "UNREAD" | "READ" | "ACKNOWLEDGED";
export type ParentCareRecord = {
  readonly id: string;
  readonly version: number;
  readonly publicationVersion: number;
  readonly bindingId: string;
  readonly date: string;
  readonly studentLabel: string;
  readonly values: Readonly<Record<keyof CareRecordValues, string>>;
  readonly receipt: CareRecordReceipt;
};
export type CareRecordStudent = {
  readonly id: string;
  readonly alias: string;
  readonly label: string;
  readonly campusId: string;
  readonly classId: string;
  readonly campusLabel: string;
  readonly classLabel: string;
};
export type StaffCareRecord = CareRecord & { readonly studentLabel: string };
export type CareRecordWebSnapshot = {
  readonly status: "IDLE" | "CONNECTING" | "BUSY" | "READY" | "ERROR" | "DENIED";
  readonly profile: CareRecordWebProfile | null;
  readonly records: readonly StaffCareRecord[];
  readonly students: readonly CareRecordStudent[];
  readonly parentRecords: readonly ParentCareRecord[];
  readonly message: string;
};
export type CareRecordClientOptions = {
  readonly baseUrl?: string;
  readonly fetcher?: typeof fetch;
};

const API_BASE = "http://127.0.0.1:4317";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isText = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= 120;
const isStatus = (value: unknown): value is CareRecordStatus =>
  typeof value === "string" && (CARE_RECORD_STATUSES as readonly string[]).includes(value);
const isProfile = (value: unknown): value is CareRecordWebProfile =>
  value === "teacher-east" || value === "parent-alpha";

class CareRecordApiError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

function allowedRequest(path: string, method: string): boolean {
  if (path === "/local/sessions") return method === "POST";
  if (path === "/local/session" || path === "/local/student-options") return method === "GET";
  if (path === "/local/care-records") return method === "GET" || method === "POST";
  const match =
    /^\/local\/care-records\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})(?:\/(submit|withdraw|resubmit|receipt))?$/iu.exec(
      path,
    );
  if (!match) return false;
  if (!match[2]) return method === "GET" || method === "PATCH";
  return method === "POST";
}

export function createCareRecordTransport(
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
    throw new Error("成长记录只允许连接本机服务。");
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
      url.username ||
      url.password ||
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

function parseSession(value: unknown, profile: CareRecordWebProfile) {
  const action = profile === "teacher-east" ? "care:write" : "care:read";
  if (
    !object(value) ||
    value.mode !== "local-synthetic" ||
    value.profile !== profile ||
    !isText(value.label) ||
    !UUID.test(String(value.actorId)) ||
    !UUID.test(String(value.tenantId)) ||
    !UUID.test(String(value.campusId)) ||
    !Array.isArray(value.classIds) ||
    !value.classIds.every((id) => typeof id === "string" && UUID.test(id)) ||
    !Array.isArray(value.actions) ||
    !value.actions.every(isText) ||
    !value.actions.includes(action)
  )
    throw new CareRecordApiError("UNAVAILABLE");
  return {
    profile,
    label: value.label,
    actorId: value.actorId,
    tenantId: value.tenantId,
    campusId: value.campusId,
    classIds: value.classIds as string[],
    actions: value.actions as string[],
  };
}

function parseValues(value: unknown): CareRecordValues {
  if (!object(value)) throw new CareRecordApiError("INVALID_RECORD");
  const fields = Object.keys(CARE_RECORD_OPTIONS) as (keyof CareRecordValues)[];
  if (
    Object.keys(value).length !== fields.length ||
    !fields.every((field) =>
      CARE_RECORD_OPTIONS[field].some((option) => option.value === value[field]),
    )
  )
    throw new CareRecordApiError("INVALID_RECORD");
  return Object.fromEntries(fields.map((field) => [field, value[field]])) as CareRecordValues;
}

function parseStudents(
  value: unknown,
  session: ReturnType<typeof parseSession>,
): CareRecordStudent[] {
  if (!Array.isArray(value)) throw new CareRecordApiError("INVALID_STUDENTS");
  const rows = value.map((row): CareRecordStudent => {
    if (
      !object(row) ||
      typeof row.id !== "string" ||
      !UUID.test(row.id) ||
      typeof row.alias !== "string" ||
      !/^student-[a-z][a-z0-9-]{0,39}$/u.test(row.alias) ||
      !isText(row.label) ||
      row.campusId !== session.campusId ||
      typeof row.classId !== "string" ||
      !session.classIds.includes(row.classId) ||
      !isText(row.campusLabel) ||
      !isText(row.classLabel)
    )
      throw new CareRecordApiError("INVALID_STUDENTS");
    return {
      id: row.id,
      alias: row.alias,
      label: row.label,
      campusId: row.campusId as string,
      classId: row.classId,
      campusLabel: row.campusLabel,
      classLabel: row.classLabel,
    };
  });
  if (
    new Set(rows.map((row) => row.id)).size !== rows.length ||
    new Set(rows.map((row) => row.alias)).size !== rows.length
  )
    throw new CareRecordApiError("INVALID_STUDENTS");
  return rows;
}

function parseStaffRecords(
  value: unknown,
  session: ReturnType<typeof parseSession>,
): StaffCareRecord[] {
  if (!Array.isArray(value)) throw new CareRecordApiError("INVALID_RECORDS");
  const rows = value.map((row): StaffCareRecord | null => {
    if (
      !object(row) ||
      typeof row.id !== "string" ||
      !UUID.test(row.id) ||
      !Number.isSafeInteger(row.version) ||
      Number(row.version) < 1 ||
      typeof row.date !== "string" ||
      !/^202[6-9]-\d{2}-\d{2}$/u.test(row.date) ||
      !isStatus(row.status) ||
      row.tenantId !== session.tenantId ||
      row.campusId !== session.campusId ||
      typeof row.classId !== "string" ||
      !session.classIds.includes(row.classId) ||
      typeof row.studentId !== "string" ||
      typeof row.createdBy !== "string" ||
      (row.reviewedBy !== null && typeof row.reviewedBy !== "string") ||
      typeof row.published !== "boolean" ||
      !isText(row.studentLabel)
    )
      return null;
    return {
      id: row.id,
      version: Number(row.version),
      date: row.date,
      status: row.status,
      values: parseValues(row.values),
      tenantId: row.tenantId as string,
      campusId: row.campusId as string,
      classId: row.classId,
      studentId: row.studentId,
      studentLabel: row.studentLabel as string,
      createdBy: row.createdBy === session.actorId ? "actor-synthetic-teacher" : row.createdBy,
      reviewedBy: row.reviewedBy as string | null,
      published: row.published,
    };
  });
  if (rows.some((row) => row === null)) throw new CareRecordApiError("INVALID_RECORDS");
  return rows as StaffCareRecord[];
}

function parseParentRecords(value: unknown): ParentCareRecord[] {
  if (!Array.isArray(value)) throw new CareRecordApiError("INVALID_RECORDS");
  const fields = Object.keys(CARE_RECORD_OPTIONS) as (keyof CareRecordValues)[];
  const rows = value.map((row): ParentCareRecord | null => {
    if (
      !object(row) ||
      typeof row.id !== "string" ||
      !UUID.test(row.id) ||
      !Number.isSafeInteger(row.version) ||
      Number(row.version) < 1 ||
      !Number.isSafeInteger(row.publicationVersion) ||
      Number(row.publicationVersion) < 1 ||
      typeof row.bindingId !== "string" ||
      !UUID.test(row.bindingId) ||
      typeof row.date !== "string" ||
      !/^202[6-9]-\d{2}-\d{2}$/u.test(row.date) ||
      !isText(row.studentLabel) ||
      !object(row.values) ||
      !["UNREAD", "READ", "ACKNOWLEDGED"].includes(String(row.receipt))
    )
      return null;
    const parentValues = row.values as Record<string, unknown>;
    if (
      Object.keys(parentValues).length !== fields.length ||
      !fields.every((field) => isText(parentValues[field]))
    )
      return null;
    return {
      id: row.id,
      version: Number(row.version),
      publicationVersion: Number(row.publicationVersion),
      bindingId: row.bindingId,
      date: row.date,
      studentLabel: row.studentLabel,
      values: Object.fromEntries(
        fields.map((field) => [field, parentValues[field] as string]),
      ) as Record<keyof CareRecordValues, string>,
      receipt: row.receipt as CareRecordReceipt,
    };
  });
  if (rows.some((row) => row === null)) throw new CareRecordApiError("INVALID_RECORDS");
  return rows as ParentCareRecord[];
}

export function createCareRecordState(records: readonly CareRecord[]): CareRecordState {
  return { records: [...records], receipts: [], events: [], nextSequence: records.length + 1 };
}

export class CareRecordClient {
  private readonly transport: typeof fetch;
  private generation = 0;
  private handle: string | null = null;
  private actor: ReturnType<typeof parseSession> | null = null;
  private value: CareRecordWebSnapshot = {
    status: "IDLE",
    profile: null,
    records: [],
    students: [],
    parentRecords: [],
    message: "连接本机共享服务后查看成长记录。",
  };

  constructor(options: CareRecordClientOptions = {}) {
    this.transport = createCareRecordTransport(options.baseUrl, options.fetcher);
  }

  get snapshot(): CareRecordWebSnapshot {
    return structuredClone(this.value);
  }

  disconnect(): void {
    this.generation += 1;
    this.handle = null;
    this.actor = null;
    this.value = {
      status: "IDLE",
      profile: null,
      records: [],
      students: [],
      parentRecords: [],
      message: "本机共享服务连接已关闭。",
    };
  }

  async connect(profile: unknown): Promise<void> {
    this.disconnect();
    if (!isProfile(profile)) return;
    const generation = this.generation;
    this.value = {
      status: "CONNECTING",
      profile,
      records: [],
      students: [],
      parentRecords: [],
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
        throw new CareRecordApiError("INVALID_SESSION");
      const handle = created.handle;
      const actor = parseSession(
        await this.request("/local/session", "GET", undefined, handle),
        profile,
      );
      if (generation !== this.generation) return;
      this.handle = handle;
      this.actor = actor;
      await this.load(generation);
    } catch (error) {
      if (generation !== this.generation) return;
      const denied = error instanceof CareRecordApiError && error.code === "UNAVAILABLE";
      this.handle = null;
      this.actor = null;
      this.value = {
        status: denied ? "DENIED" : "ERROR",
        profile,
        records: [],
        students: [],
        parentRecords: [],
        message: denied
          ? "当前示例身份没有查看成长记录的权限。"
          : "本机成长记录服务暂不可用；页面不会显示本地替代记录。",
      };
    }
  }

  async refresh(): Promise<void> {
    const profile = this.value.profile;
    if (!profile || this.value.status === "BUSY" || this.value.status === "CONNECTING") return;
    if (!this.handle || this.value.status === "ERROR" || this.value.status === "DENIED") {
      await this.connect(profile);
      return;
    }
    const generation = this.generation;
    this.value = {
      ...this.value,
      status: "BUSY",
      records: [],
      students: [],
      parentRecords: [],
      message: "正在刷新共享成长记录…",
    };
    try {
      await this.load(generation);
    } catch (error) {
      if (generation !== this.generation) return;
      this.handleFailure(error);
    }
  }

  async create(values: CareRecordValues, date: string, studentAlias?: string): Promise<void> {
    if (this.value.profile !== "teacher-east" || !this.handle || this.value.status !== "READY")
      return;
    const student =
      studentAlias === undefined
        ? this.value.students[0]
        : this.value.students.find((row) => row.alias === studentAlias);
    if (!student) {
      this.value = { ...this.value, message: "请选择当前班级的学生。" };
      return;
    }
    await this.mutate(async () => {
      await this.request("/local/care-records", "POST", {
        student: student.alias,
        date,
        values,
      });
    }, "成长记录草稿已保存到本机共享服务。");
  }

  async edit(id: string, version: number, values: CareRecordValues): Promise<void> {
    if (this.value.profile !== "teacher-east" || !this.handle) return;
    await this.mutate(async () => {
      await this.request("/local/care-records/" + id, "PATCH", { version, values });
    }, "草稿已更新，请提交审核。");
  }

  async command(
    id: string,
    version: number,
    action: "submit" | "withdraw" | "resubmit",
    values?: CareRecordValues,
  ): Promise<void> {
    if (this.value.profile !== "teacher-east" || !this.handle) return;
    await this.mutate(
      async () => {
        await this.request(`/local/care-records/${id}/${action}`, "POST", {
          version,
          ...(action === "resubmit" && values ? { values } : {}),
        });
      },
      action === "submit" ? "成长记录已提交审核。" : "成长记录状态已更新。",
    );
  }

  async receipt(id: string, version: number, action: "read" | "acknowledge"): Promise<void> {
    if (this.value.profile !== "parent-alpha" || !this.handle) return;
    const record = this.value.parentRecords.find((row) => row.id === id);
    if (!record || record.version !== version) {
      this.value = { ...this.value, message: "成长记录版本已变化，请刷新后重试。" };
      return;
    }
    await this.mutate(
      async () => {
        await this.request(`/local/care-records/${id}/receipt`, "POST", {
          bindingId: record.bindingId,
          version: record.version,
          publicationVersion: record.publicationVersion,
          action,
        });
      },
      action === "read" ? "成长记录已打开。" : "已确认知悉成长记录。",
    );
  }

  private async mutate(operation: () => Promise<unknown>, success: string): Promise<void> {
    if (this.value.status !== "READY" || !this.handle || !this.actor) return;
    const generation = this.generation;
    this.value = {
      ...this.value,
      status: "BUSY",
      records: [],
      students: [],
      parentRecords: [],
      message: "正在保存…",
    };
    try {
      await operation();
      if (generation !== this.generation) return;
      await this.load(generation, success);
    } catch (error) {
      if (generation !== this.generation) return;
      this.handleFailure(error);
    }
  }

  private async load(
    generation: number,
    message = "已显示本机共享服务中的成长记录。",
  ): Promise<void> {
    if (!this.handle || !this.actor || !this.value.profile)
      throw new CareRecordApiError("UNAVAILABLE");
    const actor = this.actor;
    const profile = this.value.profile;
    let students: CareRecordStudent[] = [];
    if (profile === "teacher-east") {
      const choices = await this.request("/local/student-options", "GET");
      if (generation !== this.generation) return;
      students = parseStudents(choices, actor);
    }
    const rows = await this.request("/local/care-records", "GET");
    if (generation !== this.generation) return;
    const records = this.value.profile === "teacher-east" ? parseStaffRecords(rows, actor) : [];
    const parentRecords = this.value.profile === "parent-alpha" ? parseParentRecords(rows) : [];
    this.value = {
      ...this.value,
      status: "READY",
      records,
      students,
      parentRecords,
      message,
    };
  }

  private async request(
    path: string,
    method = "GET",
    body?: object,
    handle = this.handle,
  ): Promise<unknown> {
    if (!allowedRequest(path, method)) throw new CareRecordApiError("REQUEST_NOT_ALLOWED");
    const response = await this.transport(path, {
      method,
      headers: {
        Accept: "application/json",
        ...(handle ? { Authorization: `Bearer ${handle}` } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new CareRecordApiError("INVALID_RESPONSE");
    }
    if (!response.ok) {
      const code =
        object(data) && object(data.error) && typeof data.error.code === "string"
          ? data.error.code
          : "REQUEST_FAILED";
      throw new CareRecordApiError(code);
    }
    return data;
  }

  private handleFailure(error: unknown): void {
    const code = error instanceof CareRecordApiError ? error.code : "REQUEST_FAILED";
    this.handle = null;
    this.actor = null;
    this.value = {
      ...this.value,
      status: code === "UNAVAILABLE" ? "DENIED" : "ERROR",
      records: [],
      students: [],
      parentRecords: [],
      message:
        code === "STATE_CONFLICT"
          ? "成长记录版本已变化，请刷新后重试。"
          : code === "UNAVAILABLE"
            ? "成长记录不在当前模拟身份的授权范围内，页面不会显示其他资料。"
            : "本机共享服务未能完成操作，请确认服务已启动后刷新。",
    };
  }
}
