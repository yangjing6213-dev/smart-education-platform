import { CARE_RECORD_OPTIONS, type CareRecordValues } from "../pages/care-record-workflow.js";

export type InviteStaffCareStatus = "IDLE" | "CONNECTING" | "BUSY" | "READY" | "DENIED" | "ERROR";
export type InviteStaffCareAction =
  "edit" | "submit" | "resubmit" | "review" | "publish" | "withdraw" | "revoke-publication";
export type InviteStaffCareStudent = {
  readonly id: string;
  readonly label: string;
  readonly classLabel: string;
};
export type InviteStaffCareRecord = {
  readonly id: string;
  readonly studentId: string;
  readonly studentLabel: string;
  readonly classLabel: string;
  readonly date: string;
  readonly values: CareRecordValues;
  readonly status:
    "DRAFT" | "SUBMITTED" | "CONFIRMED" | "RETURNED" | "CANCELLED" | "EXCEPTION_PENDING";
  readonly version: number;
  readonly published: boolean;
  readonly actions: readonly InviteStaffCareAction[];
};
export type InviteStaffCareSnapshot = {
  readonly status: InviteStaffCareStatus;
  readonly students: readonly InviteStaffCareStudent[];
  readonly records: readonly InviteStaffCareRecord[];
  readonly message: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const DATE = /^\d{4}-\d{2}-\d{2}$/u;
const ACTIONS: readonly InviteStaffCareAction[] = [
  "edit",
  "submit",
  "resubmit",
  "review",
  "publish",
  "withdraw",
  "revoke-publication",
];
const STATUSES: readonly InviteStaffCareRecord["status"][] = [
  "DRAFT",
  "SUBMITTED",
  "CONFIRMED",
  "RETURNED",
  "CANCELLED",
  "EXCEPTION_PENDING",
];
const STUDENT_KEYS = ["id", "student_display_ref", "class_ref"];
const RECORD_KEYS = [
  "id",
  "student_id",
  "student_display_ref",
  "class_ref",
  "service_date",
  "values",
  "status",
  "version",
  "published",
  "publication_version",
  "updated_at",
  "actions",
];
const VALUE_KEYS = ["arrival", "homework", "meal", "rest", "activity", "wellbeing"];
const EMPTY: InviteStaffCareSnapshot = {
  status: "IDLE",
  students: [],
  records: [],
  message: "请使用受邀员工账号登录。",
};

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return (
    Object.keys(value).length === keys.length &&
    Object.keys(value).every((key) => keys.includes(key))
  );
}

function origin(value: string): string {
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error("成长记录只允许使用当前网站的同源服务。");
  }
  return url.origin;
}

function validValues(value: unknown): value is CareRecordValues {
  if (!object(value) || !exactKeys(value, VALUE_KEYS)) return false;
  return VALUE_KEYS.every((field) =>
    CARE_RECORD_OPTIONS[field as keyof CareRecordValues].some(
      (option) => option.value === value[field],
    ),
  );
}

function parseStudents(value: unknown): InviteStaffCareStudent[] {
  if (!Array.isArray(value) || value.length > 200) throw new Error("学生资料格式无效。");
  const students = value.map((row) => {
    if (
      !object(row) ||
      !exactKeys(row, STUDENT_KEYS) ||
      typeof row.id !== "string" ||
      !UUID.test(row.id) ||
      typeof row.student_display_ref !== "string" ||
      row.student_display_ref.length < 1 ||
      row.student_display_ref.length > 80 ||
      typeof row.class_ref !== "string" ||
      row.class_ref.length < 1 ||
      row.class_ref.length > 80
    ) {
      throw new Error("学生资料格式无效。");
    }
    return { id: row.id, label: row.student_display_ref, classLabel: row.class_ref };
  });
  if (new Set(students.map((student) => student.id)).size !== students.length)
    throw new Error("学生资料重复。");
  return students;
}

function parseRecords(value: unknown): InviteStaffCareRecord[] {
  if (!Array.isArray(value) || value.length > 500) throw new Error("成长记录格式无效。");
  const records = value.map((row) => {
    if (
      !object(row) ||
      !exactKeys(row, RECORD_KEYS) ||
      typeof row.id !== "string" ||
      !UUID.test(row.id) ||
      typeof row.student_id !== "string" ||
      !UUID.test(row.student_id) ||
      typeof row.student_display_ref !== "string" ||
      row.student_display_ref.length < 1 ||
      row.student_display_ref.length > 80 ||
      typeof row.class_ref !== "string" ||
      row.class_ref.length < 1 ||
      row.class_ref.length > 80 ||
      typeof row.service_date !== "string" ||
      !DATE.test(row.service_date) ||
      !validValues(row.values) ||
      typeof row.status !== "string" ||
      !STATUSES.includes(row.status as InviteStaffCareRecord["status"]) ||
      !Number.isSafeInteger(row.version) ||
      (row.version as number) < 1 ||
      typeof row.published !== "boolean" ||
      !Number.isSafeInteger(row.publication_version) ||
      typeof row.updated_at !== "string" ||
      !row.updated_at ||
      !Array.isArray(row.actions) ||
      !row.actions.every(
        (action) => typeof action === "string" && ACTIONS.includes(action as InviteStaffCareAction),
      ) ||
      new Set(row.actions).size !== row.actions.length
    ) {
      throw new Error("成长记录格式无效。");
    }
    return {
      id: row.id,
      studentId: row.student_id,
      studentLabel: row.student_display_ref,
      classLabel: row.class_ref,
      date: row.service_date,
      values: row.values,
      status: row.status as InviteStaffCareRecord["status"],
      version: row.version as number,
      published: row.published,
      actions: row.actions as InviteStaffCareAction[],
    };
  });
  if (new Set(records.map((record) => record.id)).size !== records.length)
    throw new Error("成长记录重复。");
  return records;
}

function responseData(value: unknown): unknown {
  if (!object(value) || !("data" in value)) throw new Error("成长记录服务返回内容无效。");
  return value.data;
}

function errorStatus(value: unknown): number {
  return object(value) && Number.isSafeInteger(value.status) ? (value.status as number) : 0;
}

export class InviteStaffCareClient {
  private readonly baseUrl: string;
  private readonly loadStudents: boolean;
  private readonly fetcher: typeof fetch;
  private generation = 0;
  private busy = false;
  private value: InviteStaffCareSnapshot = EMPTY;

  public constructor(options: {
    readonly baseUrl: string;
    readonly loadStudents?: boolean;
    readonly fetcher?: typeof fetch;
  }) {
    this.baseUrl = origin(options.baseUrl);
    this.loadStudents = options.loadStudents ?? true;
    this.fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
  }

  public get snapshot(): InviteStaffCareSnapshot {
    return structuredClone(this.value);
  }

  public disconnect(): void {
    this.generation += 1;
    this.busy = false;
    this.value = EMPTY;
  }

  public async restore(): Promise<void> {
    if (this.busy) return;
    const generation = ++this.generation;
    this.busy = true;
    this.value = { ...EMPTY, status: "CONNECTING", message: "正在核对受邀员工身份…" };
    await this.load(generation, "成长记录已更新。");
    if (generation === this.generation) this.busy = false;
  }

  public async refresh(): Promise<void> {
    if (this.busy) return;
    const generation = ++this.generation;
    this.busy = true;
    this.value = { ...EMPTY, status: "BUSY", message: "正在刷新成长记录…" };
    await this.load(generation, "成长记录已更新。");
    if (generation === this.generation) this.busy = false;
  }

  public async create(studentId: string, date: string, values: CareRecordValues): Promise<void> {
    if (this.value.status !== "READY" || this.busy) return;
    if (!UUID.test(studentId) || !this.value.students.some((student) => student.id === studentId)) {
      this.value = { ...this.value, message: "请选择当前负责范围内的学生。" };
      return;
    }
    if (!validDate(date) || !validValues(values)) {
      this.value = { ...this.value, message: "请检查日期并为六项观察选择固定选项。" };
      return;
    }
    await this.mutate(
      "/api-local/staff/care-records",
      "POST",
      { student_id: studentId, service_date: date, values },
      "成长记录草稿已保存。",
    );
  }

  public async edit(recordId: string, version: number, values: CareRecordValues): Promise<void> {
    const record = this.recordForAction(recordId, version, "edit");
    if (!record || !validValues(values)) return;
    await this.mutate(
      `/api-local/staff/care-records/${recordId}`,
      "PATCH",
      { version, values },
      "草稿已更新，请提交审核。",
    );
  }

  public async command(
    recordId: string,
    version: number,
    action: "submit" | "resubmit",
    values?: CareRecordValues,
  ): Promise<void> {
    const record = this.recordForAction(recordId, version, action);
    if (!record || (action === "resubmit" && !validValues(values))) return;
    await this.mutate(
      `/api-local/staff/care-records/${recordId}/${action}`,
      "POST",
      action === "resubmit" ? { version, values } : { version },
      action === "submit" ? "成长记录已提交审核。" : "成长记录已重新提交审核。",
    );
  }

  public async review(
    recordId: string,
    version: number,
    action: "confirm" | "return",
  ): Promise<void> {
    const record = this.recordForAction(recordId, version, "review");
    if (!record || record.status !== "SUBMITTED") return;
    await this.mutate(
      `/api-local/staff/care-records/${recordId}/review`,
      "POST",
      { version, action },
      action === "confirm" ? "审核已通过；请单独发布给家长。" : "记录已退回员工修改。",
    );
  }

  public async publish(recordId: string, version: number): Promise<void> {
    const record = this.recordForAction(recordId, version, "publish");
    if (!record || record.status !== "CONFIRMED" || record.published) return;
    await this.mutate(
      `/api-local/staff/care-records/${recordId}/publish`,
      "POST",
      { version },
      "成长记录已发布给家长。",
    );
  }

  public async withdraw(recordId: string, version: number): Promise<void> {
    const record = this.recordForAction(recordId, version, "withdraw");
    if (!record || record.published || !["DRAFT", "SUBMITTED", "RETURNED"].includes(record.status))
      return;
    await this.mutate(
      `/api-local/staff/care-records/${recordId}/withdraw`,
      "POST",
      { version },
      "成长记录已撤回。",
    );
  }

  public async revokePublication(recordId: string, version: number): Promise<void> {
    const record = this.recordForAction(recordId, version, "revoke-publication");
    if (!record || record.status !== "CONFIRMED" || !record.published) return;
    await this.mutate(
      `/api-local/staff/care-records/${recordId}/revoke-publication`,
      "POST",
      { version },
      "发布已撤销，家长暂时无法查看。",
    );
  }

  private recordForAction(
    recordId: string,
    version: number,
    action: InviteStaffCareAction,
  ): InviteStaffCareRecord | undefined {
    const record = this.value.records.find((row) => row.id === recordId);
    if (
      this.value.status !== "READY" ||
      !UUID.test(recordId) ||
      !Number.isSafeInteger(version) ||
      version < 1 ||
      !record ||
      record.version !== version ||
      !record.actions.includes(action)
    ) {
      this.value = { ...this.value, message: "记录状态已变化或当前账号无权操作，请刷新后重试。" };
      return undefined;
    }
    return record;
  }

  private async mutate(
    path: string,
    method: "POST" | "PATCH",
    body: object,
    message: string,
  ): Promise<void> {
    if (this.busy || this.value.status !== "READY") return;
    const generation = ++this.generation;
    this.busy = true;
    this.value = { ...EMPTY, status: "BUSY", message: "正在保存成长记录…" };
    try {
      await this.request(path, method, body);
      if (generation === this.generation) await this.load(generation, message);
    } catch (cause) {
      if (generation === this.generation) this.fail(errorStatus(cause));
    } finally {
      if (generation === this.generation) this.busy = false;
    }
  }

  private async load(generation: number, message: string): Promise<void> {
    try {
      const [studentsValue, recordsValue] = await Promise.all([
        this.loadStudents
          ? this.request("/api-local/staff/care-record-students")
          : Promise.resolve({ data: [] }),
        this.request("/api-local/staff/care-records"),
      ]);
      if (generation !== this.generation) return;
      const students = parseStudents(responseData(studentsValue));
      const records = parseRecords(responseData(recordsValue));
      this.value = { status: "READY", students, records, message };
    } catch (cause) {
      if (generation === this.generation) this.fail(errorStatus(cause));
    }
  }

  private async request(path: string, method = "GET", body?: object): Promise<unknown> {
    const response = await this.fetcher(new URL(path, this.baseUrl).href, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(5000),
      ...(body === undefined
        ? {}
        : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
    });
    if (!response.ok)
      throw Object.assign(new Error("Staff care request failed"), { status: response.status });
    return response.json() as Promise<unknown>;
  }

  private fail(status: number): void {
    this.value = {
      ...EMPTY,
      status: status === 401 ? "IDLE" : status === 403 ? "DENIED" : "ERROR",
      message:
        status === 401
          ? "登录已失效，请使用受邀员工账号重新登录。"
          : status === 403
            ? "当前账号没有成长记录权限，请联系机构负责人。"
            : status === 409
              ? "记录状态已变化，请刷新后重试。"
              : "成长记录暂时无法读取或保存，请稍后重试。",
    };
  }
}

function validDate(value: string): boolean {
  if (!DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
