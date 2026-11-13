import { STAFF_DAILY_OPTIONS, type StaffDailyValues } from "./staff-daily.js";

export type InviteStaffDailyStatus = "DRAFT" | "SUBMITTED" | "RETURNED" | "CONFIRMED";
export type InviteStaffDailyAction = "edit" | "submit" | "resubmit";
export type InviteStaffDailySourceKind =
  | "TASK"
  | "ATTENDANCE"
  | "CARE_RECORD"
  | "PICKUP"
  | "PICKUP_EXCEPTION";

export interface InviteStaffDailyRecord {
  readonly id: string;
  readonly version: number;
  readonly status: InviteStaffDailyStatus;
  readonly date: string;
  readonly values: StaffDailyValues;
  readonly sourceCounts: Readonly<Record<InviteStaffDailySourceKind, number>>;
  readonly learningSummary: {
    readonly completedLearnerBand: "2_PLUS";
    readonly usedGuidance: boolean;
    readonly needsTeacherFollowUp: boolean;
  } | null;
  readonly actions: readonly InviteStaffDailyAction[];
}

export interface InviteStaffDailySnapshot {
  readonly status: "IDLE" | "CONNECTING" | "BUSY" | "READY" | "ERROR";
  readonly records: readonly InviteStaffDailyRecord[];
  readonly canCreate: boolean;
  readonly message: string;
  readonly error: string | null;
}

interface Listing {
  readonly records: readonly InviteStaffDailyRecord[];
  readonly canCreate: boolean;
}

type DailyField = keyof StaffDailyValues;
type ClientError = Error & { readonly status?: number };

const sourceKinds: readonly InviteStaffDailySourceKind[] = [
  "TASK",
  "ATTENDANCE",
  "CARE_RECORD",
  "PICKUP",
  "PICKUP_EXCEPTION",
];
const emptySnapshot: InviteStaffDailySnapshot = {
  status: "IDLE",
  records: [],
  canCreate: false,
  message: "使用受邀员工账号查看工作日报。",
  error: null,
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).length === keys.length && Object.keys(value).every((key) => keys.includes(key));
}

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function parseValues(value: unknown): StaffDailyValues {
  const fields: readonly DailyField[] = ["arrival", "homework", "activity", "classroom", "followUp"];
  if (!isObject(value) || !exactKeys(value, fields)) throw new Error("工作日报内容格式不正确。");
  for (const field of fields) {
    if (
      typeof value[field] !== "string" ||
      !STAFF_DAILY_OPTIONS[field].some(([code]) => code === value[field])
    )
      throw new Error("工作日报包含无效选项。");
  }
  return value as unknown as StaffDailyValues;
}

function parseCounts(value: unknown): Readonly<Record<InviteStaffDailySourceKind, number>> {
  if (!isObject(value) || !exactKeys(value, sourceKinds)) throw new Error("日报来源统计格式不正确。");
  const counts = {} as Record<InviteStaffDailySourceKind, number>;
  for (const kind of sourceKinds) {
    const count = value[kind];
    if (!Number.isSafeInteger(count) || (count as number) < 0 || (count as number) > 10000)
      throw new Error("日报来源统计格式不正确。");
    counts[kind] = count as number;
  }
  return counts;
}

function parseLearningSummary(value: unknown): InviteStaffDailyRecord["learningSummary"] {
  if (value === null) return null;
  if (
    !isObject(value) ||
    !exactKeys(value, ["completedLearnerBand", "usedGuidance", "needsTeacherFollowUp"]) ||
    value.completedLearnerBand !== "2_PLUS" ||
    typeof value.usedGuidance !== "boolean" ||
    typeof value.needsTeacherFollowUp !== "boolean"
  )
    throw new Error("学习摘要格式不正确。");
  return {
    completedLearnerBand: "2_PLUS",
    usedGuidance: value.usedGuidance,
    needsTeacherFollowUp: value.needsTeacherFollowUp,
  };
}

function parseRecord(value: unknown): InviteStaffDailyRecord {
  const keys = [
    "id",
    "version",
    "status",
    "date",
    "values",
    "sourceCounts",
    "learningSummary",
    "actions",
  ] as const;
  if (
    !isObject(value) ||
    !exactKeys(value, keys) ||
    typeof value.id !== "string" ||
    !uuid.test(value.id) ||
    !Number.isSafeInteger(value.version) ||
    (value.version as number) < 1 ||
    !["DRAFT", "SUBMITTED", "RETURNED", "CONFIRMED"].includes(String(value.status)) ||
    !validDate(value.date) ||
    !Array.isArray(value.actions) ||
    value.actions.some((action) => !["edit", "submit", "resubmit"].includes(String(action)))
  )
    throw new Error("工作日报资料格式不正确。");
  return {
    id: value.id,
    version: value.version as number,
    status: value.status as InviteStaffDailyStatus,
    date: value.date,
    values: parseValues(value.values),
    sourceCounts: parseCounts(value.sourceCounts),
    learningSummary: parseLearningSummary(value.learningSummary),
    actions: value.actions as InviteStaffDailyAction[],
  };
}

function parseListing(value: unknown): Listing {
  if (!isObject(value) || !exactKeys(value, ["records", "canCreate"]) || !Array.isArray(value.records))
    throw new Error("工作日报列表格式不正确。");
  if (value.records.length > 200 || typeof value.canCreate !== "boolean")
    throw new Error("工作日报列表格式不正确。");
  return { records: value.records.map(parseRecord), canCreate: value.canCreate };
}

function safeOrigin(value: string): string {
  const url = new URL(value);
  if (
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    !(
      url.protocol === "https:" ||
      (url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname) && !!url.port)
    )
  )
    throw new Error("工作日报需要安全的同源网页地址。");
  return url.origin;
}

function inviteError(error: unknown): string {
  const status = (error as ClientError | null)?.status;
  if (status === 401) return "邀请账号已失效，请重新登录。";
  if (status === 403) return "当前账号没有工作日报权限。";
  return error instanceof Error ? error.message : "工作日报暂时无法读取，请重试。";
}

export class InviteStaffDailyClient {
  private value: InviteStaffDailySnapshot = emptySnapshot;
  private readonly base: string;
  private readonly fetcher: typeof fetch;
  private busy = false;
  private generation = 0;

  public constructor(options: { readonly baseUrl: string; readonly fetcher?: typeof fetch }) {
    this.base = safeOrigin(options.baseUrl);
    this.fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
  }

  public get snapshot(): InviteStaffDailySnapshot {
    return structuredClone(this.value);
  }

  public disconnect(): void {
    this.generation += 1;
    this.busy = false;
    this.value = emptySnapshot;
  }

  public restore(): Promise<void> {
    this.value = {
      ...emptySnapshot,
      status: "CONNECTING",
      message: "正在核对受邀员工身份…",
    };
    return this.refresh();
  }

  public async refresh(): Promise<void> {
    if (this.busy) return;
    const generation = ++this.generation;
    this.busy = true;
    this.value = {
      ...this.value,
      status: "BUSY",
      message: "正在读取工作日报…",
      error: null,
    };
    try {
      const listing = parseListing(await this.request("/staff/daily-reports"));
      if (generation !== this.generation) return;
      this.value = {
        status: "READY",
        records: listing.records,
        canCreate: listing.canCreate,
        message: "工作日报已更新。",
        error: null,
      };
    } catch (error) {
      if (generation !== this.generation) return;
      this.value = {
        status: "ERROR",
        records: [],
        canCreate: false,
        message: inviteError(error),
        error: inviteError(error),
      };
    } finally {
      if (generation === this.generation) this.busy = false;
    }
  }

  public async create(date: string, values: StaffDailyValues): Promise<void> {
    if (this.value.status !== "READY" || !this.value.canCreate || !validDate(date)) return;
    await this.mutate("/staff/daily-reports", "POST", { date, values }, (row) => [
      ...this.value.records.filter((current) => current.id !== row.id),
      row,
    ]);
  }

  public async edit(reportId: string, version: number, values: StaffDailyValues): Promise<void> {
    const current = this.value.records.find((record) => record.id === reportId);
    if (
      !current ||
      !current.actions.includes("edit") ||
      !uuid.test(reportId) ||
      !Number.isSafeInteger(version) ||
      version < 1
    )
      return;
    await this.mutate(`/staff/daily-reports/${reportId}`, "PATCH", { version, values }, (row) =>
      this.replace(row),
    );
  }

  public async submit(reportId: string, version: number): Promise<void> {
    const current = this.value.records.find((record) => record.id === reportId);
    if (
      !current ||
      !current.actions.includes("submit") ||
      !uuid.test(reportId) ||
      !Number.isSafeInteger(version) ||
      version < 1
    )
      return;
    await this.mutate(`/staff/daily-reports/${reportId}/submit`, "POST", { version }, (row) =>
      this.replace(row),
    );
  }

  public async resubmit(
    reportId: string,
    version: number,
    values: StaffDailyValues,
  ): Promise<void> {
    const current = this.value.records.find((record) => record.id === reportId);
    if (
      !current ||
      !current.actions.includes("resubmit") ||
      !uuid.test(reportId) ||
      !Number.isSafeInteger(version) ||
      version < 1
    )
      return;
    await this.mutate(
      `/staff/daily-reports/${reportId}/resubmit`,
      "POST",
      { version, values },
      (row) => this.replace(row),
    );
  }

  private replace(row: InviteStaffDailyRecord): InviteStaffDailyRecord[] {
    return this.value.records.map((current) => (current.id === row.id ? row : current));
  }

  private async mutate(
    path: string,
    method: "POST" | "PATCH",
    body: unknown,
    update: (row: InviteStaffDailyRecord) => InviteStaffDailyRecord[],
  ): Promise<void> {
    if (this.busy || this.value.status !== "READY") return;
    const generation = ++this.generation;
    this.busy = true;
    this.value = { ...this.value, status: "BUSY", message: "正在保存工作日报…", error: null };
    try {
      const row = parseRecord(await this.request(path, method, body));
      if (generation !== this.generation) return;
      this.value = {
        ...this.value,
        status: "READY",
        records: update(row),
        message: "工作日报已保存。",
        error: null,
      };
    } catch (error) {
      if (generation !== this.generation) return;
      this.value = {
        status: "ERROR",
        records: [],
        canCreate: false,
        message: inviteError(error),
        error: inviteError(error),
      };
    } finally {
      if (generation === this.generation) this.busy = false;
    }
  }

  private async request(path: string, method = "GET", body?: unknown): Promise<unknown> {
    const headers = new Headers({ accept: "application/json" });
    if (body !== undefined) headers.set("content-type", "application/json");
    let response: Response;
    try {
      response = await this.fetcher(new URL(`/api-local${path}`, this.base), {
        method,
        credentials: "same-origin",
        cache: "no-store",
        headers,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch {
      throw new Error("工作日报暂时无法连接，请重试。");
    }
    const payload: unknown = await response.json().catch(() => undefined);
    if (!response.ok) {
      const error = new Error("工作日报请求未完成。") as ClientError;
      Object.assign(error, { status: response.status });
      throw error;
    }
    if (!isObject(payload) || !("data" in payload)) throw new Error("工作日报返回内容不正确。");
    return payload.data;
  }
}
