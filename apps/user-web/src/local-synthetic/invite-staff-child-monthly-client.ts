import type {
  ChildMonthlyStaffList,
  ChildMonthlyStaffReport,
  ChildMonthlyAction,
  MonthlyFeedbackSupplements,
  ChildMonthlySourceCounts,
} from "@student-care/contracts";
import { projectIdentity } from "./invite-session.js";

export type ChildMonthlyMutationOutcome = "saved" | "conflict" | "failed" | "ignored";
export interface InviteStaffChildMonthlySnapshot extends ChildMonthlyStaffList {
  readonly status: "IDLE" | "CONNECTING" | "BUSY" | "READY" | "ERROR";
  readonly canCreate: boolean;
  readonly message: string;
  readonly error: string | null;
  readonly requiresLogin: boolean;
}
const empty: InviteStaffChildMonthlySnapshot = {
  status: "IDLE",
  records: [],
  students: [],
  canCreate: false,
  message: "请使用受邀教师账号登录。",
  error: null,
  requiresLogin: false,
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const integer = (value: unknown, min = 1): value is number =>
  Number.isSafeInteger(value) && (value as number) >= min;
const label = (value: unknown, max = 120): value is string =>
  typeof value === "string" && !!value.trim() && value.length <= max && !uuid.test(value);
const month = (value: unknown): value is string =>
  typeof value === "string" && /^(?:19|20|21)\d{2}-(?:0[1-9]|1[0-2])$/u.test(value);
const invalid = () => new Error("孩子月报数据格式不正确，请刷新后重试。");
const fields = [
  "learningParticipation",
  "dailyHabits",
  "activityParticipation",
  "familySchoolCollaboration",
] as const;

function supplements(value: unknown): MonthlyFeedbackSupplements {
  if (
    !object(value) ||
    fields.some(
      (key) =>
        typeof value[key] !== "string" ||
        !["KEEP_WATCHING", "PROGRESSING", "FOLLOW_UP"].includes(value[key]),
    )
  )
    throw invalid();
  return {
    learningParticipation: value.learningParticipation,
    dailyHabits: value.dailyHabits,
    activityParticipation: value.activityParticipation,
    familySchoolCollaboration: value.familySchoolCollaboration,
  } as MonthlyFeedbackSupplements;
}
function counts(value: unknown): ChildMonthlySourceCounts {
  if (!object(value) || !integer(value.GROWTH_RECORD, 0) || !integer(value.ATTENDANCE_OVERVIEW, 0))
    throw invalid();
  return { GROWTH_RECORD: value.GROWTH_RECORD, ATTENDANCE_OVERVIEW: value.ATTENDANCE_OVERVIEW };
}
export function parseChildMonthlyStaffRecord(value: unknown): ChildMonthlyStaffReport {
  if (
    !object(value) ||
    typeof value.id !== "string" ||
    !uuid.test(value.id) ||
    typeof value.studentId !== "string" ||
    !uuid.test(value.studentId) ||
    !label(value.studentLabel) ||
    !label(value.classRef, 80) ||
    !month(value.month) ||
    !integer(value.version) ||
    !integer(value.sourceVersion) ||
    !integer(value.publicationVersion, 0) ||
    typeof value.status !== "string" ||
    !["DRAFT", "SUBMITTED", "RETURNED", "CONFIRMED", "PUBLISHED", "REVIEW_REQUIRED"].includes(
      value.status,
    ) ||
    !Array.isArray(value.actions) ||
    value.actions.some(
      (action) =>
        typeof action !== "string" ||
        !["edit", "submit", "confirm", "return", "publish"].includes(action),
    ) ||
    new Set(value.actions).size !== value.actions.length
  )
    throw invalid();
  return {
    id: value.id,
    studentId: value.studentId,
    studentLabel: value.studentLabel,
    classRef: value.classRef,
    month: value.month,
    status: value.status as ChildMonthlyStaffReport["status"],
    version: value.version,
    sourceVersion: value.sourceVersion,
    publicationVersion: value.publicationVersion,
    supplements: supplements(value.supplements),
    sourceCounts: counts(value.sourceCounts),
    actions: [...value.actions] as ChildMonthlyAction[],
  };
}
export function parseChildMonthlyStaffListing(value: unknown): ChildMonthlyStaffList {
  if (!object(value) || !Array.isArray(value.records) || !Array.isArray(value.students))
    throw invalid();
  const records = value.records.map(parseChildMonthlyStaffRecord);
  const students = value.students.map((student: unknown) => {
    if (
      !object(student) ||
      typeof student.id !== "string" ||
      !uuid.test(student.id) ||
      !label(student.displayRef) ||
      !label(student.classRef, 80)
    )
      throw invalid();
    return { id: student.id, displayRef: student.displayRef, classRef: student.classRef };
  });
  if (
    new Set(records.map((row) => row.id)).size !== records.length ||
    new Set(students.map((row) => row.id)).size !== students.length
  )
    throw invalid();
  return { records, students };
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
      (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname) && url.port)
    )
  )
    throw new Error("孩子月报需要安全的同源网页地址。");
  return url.origin;
}
const statusOf = (value: unknown): number =>
  object(value) && typeof value.status === "number" ? value.status : 0;
const failure = (status: number) => Object.assign(new Error("孩子月报请求未完成。"), { status });

export class InviteStaffChildMonthlyClient {
  private value: InviteStaffChildMonthlySnapshot = empty;
  private readonly base: string;
  private readonly fetcher: typeof fetch;
  private busy = false;
  private generation = 0;
  public constructor(options: { readonly baseUrl: string; readonly fetcher?: typeof fetch }) {
    this.base = safeOrigin(options.baseUrl);
    this.fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
  }
  public get snapshot(): InviteStaffChildMonthlySnapshot {
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
    this.value = { ...empty, status: "CONNECTING", message: "正在读取孩子个人月报…" };
    try {
      await this.load(generation);
    } catch (cause) {
      if (generation === this.generation) this.fail(cause);
    } finally {
      if (generation === this.generation) this.busy = false;
    }
  }
  private async load(generation: number): Promise<void> {
    const identity = await this.request("/me");
    if (generation !== this.generation) return;
    if (
      !projectIdentity(identity).services.some(
        (service) => service.href === "/web/staff/child-monthly",
      )
    )
      throw failure(403);
    const canCreate =
      object(identity) &&
      Array.isArray(identity.memberships) &&
      identity.memberships.some(
        (membership: unknown) =>
          object(membership) &&
          membership.status === "ACTIVE" &&
          Array.isArray(membership.capabilities) &&
          membership.capabilities.includes("feedback:read") &&
          membership.capabilities.includes("feedback:create"),
      );
    const listing = parseChildMonthlyStaffListing(
      await this.request("/staff/child-monthly-reports"),
    );
    if (generation !== this.generation) return;
    this.value = {
      ...listing,
      status: "READY",
      canCreate,
      message: "孩子个人月报已更新。",
      error: null,
      requiresLogin: false,
    };
  }
  public async create(
    studentId: string,
    selectedMonth: string,
    values: MonthlyFeedbackSupplements,
  ): Promise<ChildMonthlyMutationOutcome> {
    if (
      !this.value.canCreate ||
      !month(selectedMonth) ||
      !uuid.test(studentId) ||
      !this.value.students.some((row) => row.id === studentId) ||
      this.value.records.some((row) => row.studentId === studentId && row.month === selectedMonth)
    )
      return "ignored";
    return this.mutate(
      "/staff/child-monthly-reports",
      "POST",
      { studentId, month: selectedMonth, supplements: values },
      undefined,
      studentId,
    );
  }
  public async edit(
    id: string,
    version: number,
    values: MonthlyFeedbackSupplements,
  ): Promise<ChildMonthlyMutationOutcome> {
    if (!this.permitted(id, version, "edit")) return "ignored";
    return this.mutate(
      "/staff/child-monthly-reports/" + id,
      "PATCH",
      { version, supplements: values },
      id,
    );
  }
  public async submit(id: string, version: number): Promise<ChildMonthlyMutationOutcome> {
    if (!this.permitted(id, version, "submit")) return "ignored";
    return this.mutate("/staff/child-monthly-reports/" + id + "/submit", "POST", { version }, id);
  }
  private permitted(id: string, version: number, action: "edit" | "submit"): boolean {
    return (
      uuid.test(id) &&
      integer(version) &&
      this.value.records.some(
        (row) => row.id === id && row.version === version && row.actions.includes(action),
      )
    );
  }
  private async mutate(
    path: string,
    method: "POST" | "PATCH",
    body: object,
    id?: string,
    studentId?: string,
  ): Promise<ChildMonthlyMutationOutcome> {
    if (this.busy || this.value.status !== "READY") return "ignored";
    if ("supplements" in body) {
      try {
        supplements(body.supplements);
      } catch {
        return "ignored";
      }
    }
    const previous = this.value;
    const generation = ++this.generation;
    this.busy = true;
    this.value = { ...empty, status: "BUSY", message: "正在保存孩子月报…" };
    try {
      const row = parseChildMonthlyStaffRecord(await this.request(path, method, body));
      if (generation !== this.generation) return "ignored";
      const expected = id ? previous.records.find((record) => record.id === id) : undefined;
      if (
        (id && row.id !== id) ||
        (studentId &&
          (row.studentId !== studentId || ("month" in body && row.month !== body.month))) ||
        (expected && (row.studentId !== expected.studentId || row.month !== expected.month))
      )
        throw invalid();
      this.value = {
        ...previous,
        status: "READY",
        records: [row, ...previous.records.filter((record) => record.id !== row.id)],
        message: path.endsWith("/submit") ? "已提交负责人审核。" : "孩子月报草稿已保存。",
        error: null,
      };
      return "saved";
    } catch (cause) {
      if (generation !== this.generation) return "ignored";
      if (statusOf(cause) === 409) {
        try {
          await this.load(generation);
          if (generation === this.generation)
            this.value = { ...this.value, message: "内容已更新，请重新核对后操作。" };
        } catch (reloadError) {
          if (generation === this.generation) this.fail(reloadError);
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
        ? "邀请登录已过期，请重新登录。"
        : status === 403
          ? "当前账号没有孩子月报操作权限。"
          : status === 404
            ? "该月报已不可用，请重新核对授权范围。"
            : "孩子月报暂不可用，请重新连接。";
    this.value = {
      ...empty,
      status: "ERROR",
      message,
      error: message,
      requiresLogin: status === 401,
    };
  }
  private async request(path: string, method = "GET", body?: object): Promise<unknown> {
    let response: Response;
    try {
      response = await this.fetcher(new URL("/api-local" + path, this.base), {
        method,
        credentials: "same-origin",
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(10000),
        headers: {
          accept: "application/json",
          ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch {
      throw failure(0);
    }
    if (!response.ok) throw failure(response.status);
    const payload: unknown = await response.json().catch(() => undefined);
    if (!object(payload) || !("data" in payload)) throw invalid();
    return payload.data;
  }
}
