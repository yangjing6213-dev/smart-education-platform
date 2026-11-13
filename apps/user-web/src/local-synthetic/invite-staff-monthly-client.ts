export type InviteStaffMonthlyStatus =
  "DRAFT" | "SUBMITTED" | "RETURNED" | "CONFIRMED" | "PUBLISHED" | "REVIEW_REQUIRED";
export type InviteStaffMonthlyAction = "edit" | "submit" | "confirm" | "return" | "publish";
export type MonthlySupplement = "KEEP_WATCHING" | "PROGRESSING" | "FOLLOW_UP";
export interface MonthlySupplements {
  readonly learningParticipation: MonthlySupplement;
  readonly dailyHabits: MonthlySupplement;
  readonly activityParticipation: MonthlySupplement;
  readonly familySchoolCollaboration: MonthlySupplement;
}
export interface InviteStaffMonthlyRecord {
  readonly id: string;
  readonly version: number;
  readonly sourceVersion: number;
  readonly status: InviteStaffMonthlyStatus;
  readonly month: string;
  readonly classRef: string;
  readonly audience: "STAFF_INTERNAL";
  readonly supplements: MonthlySupplements;
  readonly sourceCounts: {
    readonly GROWTH_RECORD: number;
    readonly ATTENDANCE_OVERVIEW: number;
    readonly STAFF_DAILY: number;
  };
  readonly actions: readonly InviteStaffMonthlyAction[];
}
export interface MonthlyListing {
  readonly records: readonly InviteStaffMonthlyRecord[];
  readonly canCreate: boolean;
}
export interface InviteStaffMonthlySnapshot extends MonthlyListing {
  readonly status: "IDLE" | "CONNECTING" | "BUSY" | "READY" | "ERROR";
  readonly message: string;
  readonly error: string | null;
  readonly requiresLogin: boolean;
}
export type MonthlyMutationOutcome = "saved" | "conflict" | "failed" | "ignored";
const fields = [
  "learningParticipation",
  "dailyHabits",
  "activityParticipation",
  "familySchoolCollaboration",
] as const;
const statuses: readonly string[] = [
  "DRAFT",
  "SUBMITTED",
  "RETURNED",
  "CONFIRMED",
  "PUBLISHED",
  "REVIEW_REQUIRED",
];
const actions: readonly string[] = ["edit", "submit", "confirm", "return", "publish"];
const options: readonly string[] = ["KEEP_WATCHING", "PROGRESSING", "FOLLOW_UP"];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const positive = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) > 0;
const month = (value: unknown): value is string =>
  typeof value === "string" && /^(?:19|20|21)\d{2}-(?:0[1-9]|1[0-2])$/u.test(value);
const invalid = () => new Error("班级月度总结数据格式不正确，请刷新重试。");

function parseSupplements(value: unknown): MonthlySupplements {
  if (
    !object(value) ||
    fields.some((field) => typeof value[field] !== "string" || !options.includes(value[field]))
  )
    throw invalid();
  return {
    learningParticipation: value.learningParticipation as MonthlySupplement,
    dailyHabits: value.dailyHabits as MonthlySupplement,
    activityParticipation: value.activityParticipation as MonthlySupplement,
    familySchoolCollaboration: value.familySchoolCollaboration as MonthlySupplement,
  };
}

/** Whitelist the internal staff projection; never retain source IDs or upstream private fields. */
export function parseMonthlyRecord(value: unknown): InviteStaffMonthlyRecord {
  if (
    !object(value) ||
    typeof value.id !== "string" ||
    !uuid.test(value.id) ||
    !positive(value.version) ||
    !positive(value.sourceVersion) ||
    typeof value.status !== "string" ||
    !statuses.includes(value.status) ||
    !month(value.month) ||
    typeof value.classRef !== "string" ||
    !value.classRef.trim() ||
    value.classRef.length > 80 ||
    value.audience !== "STAFF_INTERNAL" ||
    !Array.isArray(value.actions) ||
    value.actions.some((action) => typeof action !== "string" || !actions.includes(action)) ||
    new Set(value.actions).size !== value.actions.length ||
    !object(value.sourceCounts)
  )
    throw invalid();
  const counts = value.sourceCounts;
  for (const key of ["GROWTH_RECORD", "ATTENDANCE_OVERVIEW", "STAFF_DAILY"] as const)
    if (!Number.isSafeInteger(counts[key]) || (counts[key] as number) < 0) throw invalid();
  return {
    id: value.id.toLowerCase(),
    version: value.version,
    sourceVersion: value.sourceVersion,
    status: value.status as InviteStaffMonthlyStatus,
    month: value.month,
    classRef: value.classRef,
    audience: "STAFF_INTERNAL",
    supplements: parseSupplements(value.supplements),
    sourceCounts: {
      GROWTH_RECORD: counts.GROWTH_RECORD as number,
      ATTENDANCE_OVERVIEW: counts.ATTENDANCE_OVERVIEW as number,
      STAFF_DAILY: counts.STAFF_DAILY as number,
    },
    actions: [...value.actions] as InviteStaffMonthlyAction[],
  };
}

export function parseMonthlyListing(value: unknown): MonthlyListing {
  if (!object(value) || !Array.isArray(value.records) || typeof value.canCreate !== "boolean")
    throw invalid();
  const records = value.records.map(parseMonthlyRecord);
  if (new Set(records.map((row) => row.id)).size !== records.length) throw invalid();
  return { records, canCreate: value.canCreate };
}

const empty: InviteStaffMonthlySnapshot = {
  status: "IDLE",
  records: [],
  canCreate: false,
  message: "使用受邀员工账号查看班级月度总结。",
  error: null,
  requiresLogin: false,
};
function origin(value: string): string {
  const url = new URL(value);
  if (
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    !(
      url.protocol === "https:" ||
      (url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname) && url.port)
    )
  )
    throw new Error("班级月度总结需要安全的同源网页地址。");
  return url.origin;
}
const statusOf = (cause: unknown): number | undefined =>
  object(cause) && typeof cause.status === "number" ? cause.status : undefined;

export class InviteStaffMonthlyClient {
  private value: InviteStaffMonthlySnapshot = empty;
  private readonly base: string;
  private readonly fetcher: typeof fetch;
  private busy = false;
  private generation = 0;
  public constructor(options: { readonly baseUrl: string; readonly fetcher?: typeof fetch }) {
    this.base = origin(options.baseUrl);
    this.fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
  }
  public get snapshot(): InviteStaffMonthlySnapshot {
    return structuredClone(this.value);
  }
  public disconnect(): void {
    this.generation += 1;
    this.busy = false;
    this.value = empty;
  }
  public restore(): Promise<void> {
    return this.refresh();
  }
  public async refresh(): Promise<void> {
    if (this.busy) return;
    const generation = ++this.generation;
    this.busy = true;
    this.value = {
      ...this.value,
      status: this.value.status === "IDLE" ? "CONNECTING" : "BUSY",
      message: "正在读取班级月度总结…",
      error: null,
      requiresLogin: false,
    };
    try {
      const records = parseMonthlyListing(await this.request("/staff/monthly-feedback"));
      if (generation !== this.generation) return;
      this.value = {
        ...records,
        status: "READY",
        message: "班级月度总结已更新。",
        error: null,
        requiresLogin: false,
      };
    } catch (cause) {
      if (generation === this.generation) this.fail(cause);
    } finally {
      if (generation === this.generation) this.busy = false;
    }
  }
  public async create(
    selectedMonth: string,
    supplements: MonthlySupplements,
  ): Promise<MonthlyMutationOutcome> {
    if (!this.value.canCreate || !month(selectedMonth)) return "ignored";
    return this.mutate("/staff/monthly-feedback", "POST", { month: selectedMonth, supplements });
  }
  public async edit(
    id: string,
    version: number,
    supplements: MonthlySupplements,
  ): Promise<MonthlyMutationOutcome> {
    if (!this.permitted(id, version, "edit")) return "ignored";
    return this.mutate(`/staff/monthly-feedback/${id}`, "PATCH", { version, supplements }, id);
  }
  public async submit(id: string, version: number): Promise<MonthlyMutationOutcome> {
    if (!this.permitted(id, version, "submit")) return "ignored";
    return this.mutate(`/staff/monthly-feedback/${id}/submit`, "POST", { version }, id);
  }
  private permitted(id: string, version: number, action: "edit" | "submit"): boolean {
    return (
      uuid.test(id) &&
      positive(version) &&
      Boolean(this.value.records.find((row) => row.id === id && row.actions.includes(action)))
    );
  }
  private async mutate(
    path: string,
    method: "POST" | "PATCH",
    body: unknown,
    id?: string,
  ): Promise<MonthlyMutationOutcome> {
    if (this.busy || this.value.status !== "READY") return "ignored";
    const generation = ++this.generation;
    this.busy = true;
    this.value = {
      ...this.value,
      status: "BUSY",
      message: "正在保存班级月度总结…",
      error: null,
      requiresLogin: false,
    };
    try {
      const row = parseMonthlyRecord(await this.request(path, method, body));
      if (generation !== this.generation) return "ignored";
      if (id !== undefined && row.id !== id) throw invalid();
      this.value = {
        ...this.value,
        status: "READY",
        records: [row, ...this.value.records.filter((entry) => entry.id !== row.id)],
        message: path.endsWith("/submit") ? "已提交负责人审核。" : "班级月度总结草稿已保存。",
        error: null,
      };
      return "saved";
    } catch (cause) {
      if (generation !== this.generation) return "ignored";
      if (statusOf(cause) === 409) {
        this.value = { ...empty, status: "BUSY", message: "内容已发生变化，正在重新读取…" };
        try {
          const records = parseMonthlyListing(await this.request("/staff/monthly-feedback"));
          if (generation !== this.generation) return "ignored";
          this.value = {
            ...records,
            status: "READY",
            message: "内容已更新，请重新核对后操作。",
            error: null,
            requiresLogin: false,
          };
        } catch (reloadError) {
          if (generation !== this.generation) return "ignored";
          this.fail(reloadError);
        }
        return "conflict";
      }
      this.fail(cause);
      return "failed";
    } finally {
      if (generation === this.generation) this.busy = false;
    }
  }
  private fail(cause: unknown): void {
    const status = statusOf(cause);
    const message =
      status === 401
        ? "邀请账号已失效，请重新登录。"
        : status === 403
          ? "当前账号没有班级月度总结权限。"
          : status === 404
            ? "该总结已不可用，请重新核对授权范围。"
            : cause instanceof Error
              ? cause.message
              : "班级月度总结暂时无法读取，请重试。";
    this.value = {
      ...empty,
      status: "ERROR",
      message,
      error: message,
      requiresLogin: status === 401,
    };
  }
  private async request(path: string, method = "GET", body?: unknown): Promise<unknown> {
    let response: Response;
    try {
      response = await this.fetcher(new URL(`/api-local${path}`, this.base), {
        method,
        credentials: "same-origin",
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
        headers: {
          accept: "application/json",
          ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch {
      throw new Error("班级月度总结服务暂时无法连接，请重试。");
    }
    if (!response.ok)
      throw Object.assign(new Error("班级月度总结请求未完成，请重试。"), {
        status: response.status,
      });
    const payload: unknown = await response.json().catch(() => undefined);
    if (!object(payload) || !("data" in payload)) throw invalid();
    return payload.data;
  }
}
