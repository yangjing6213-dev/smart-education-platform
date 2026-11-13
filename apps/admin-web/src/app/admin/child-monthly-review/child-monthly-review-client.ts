import type {
  ChildMonthlyAction,
  ChildMonthlyStaffList,
  ChildMonthlyStaffReport,
  ChildMonthlyStudentOption,
} from "../../../../../../packages/contracts/src/child-monthly.js";

const STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "RETURNED",
  "CONFIRMED",
  "PUBLISHED",
  "REVIEW_REQUIRED",
] as const;
const OPTIONS = ["KEEP_WATCHING", "PROGRESSING", "FOLLOW_UP"] as const;
const SOURCES = ["GROWTH_RECORD", "ATTENDANCE_OVERVIEW"] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
type Status = ChildMonthlyStaffReport["status"];
const PERMITTED: Readonly<Record<Status, readonly ChildMonthlyAction[]>> = {
  DRAFT: ["edit", "submit"],
  SUBMITTED: ["confirm", "return"],
  RETURNED: ["edit"],
  CONFIRMED: ["return", "publish"],
  PUBLISHED: [],
  REVIEW_REQUIRED: ["edit"],
};
export type ChildMonthlyReviewRow = ChildMonthlyStaffReport;
export type ChildMonthlyListing = ChildMonthlyStaffList;
export type ChildMonthlyReviewAction = "CONFIRM" | "RETURN" | "PUBLISH";
export type ChildMonthlyReviewSnapshot = Readonly<{
  status: "IDLE" | "CONNECTING" | "BUSY" | "READY" | "UNAUTHENTICATED" | "FORBIDDEN" | "ERROR";
  session: null | Readonly<{ label: string }>;
  rows: readonly ChildMonthlyReviewRow[];
  message: string;
  error: string | null;
}>;
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function validLabel(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maximum;
}
function validSupplement(
  value: unknown,
): value is ChildMonthlyReviewRow["supplements"]["learningParticipation"] {
  return typeof value === "string" && (OPTIONS as readonly string[]).includes(value);
}
export function parseChildMonthlyRecord(value: unknown): ChildMonthlyReviewRow | undefined {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    !UUID.test(value.id) ||
    typeof value.studentId !== "string" ||
    !UUID.test(value.studentId) ||
    !validLabel(value.studentLabel, 120) ||
    !validLabel(value.classRef, 80) ||
    !Number.isSafeInteger(value.version) ||
    Number(value.version) < 1 ||
    !Number.isSafeInteger(value.sourceVersion) ||
    Number(value.sourceVersion) < 1 ||
    !Number.isSafeInteger(value.publicationVersion) ||
    Number(value.publicationVersion) < 0 ||
    typeof value.month !== "string" ||
    !/^(?:19|20|21)\d{2}-(?:0[1-9]|1[0-2])$/u.test(value.month) ||
    typeof value.status !== "string" ||
    !(STATUSES as readonly string[]).includes(value.status) ||
    !isRecord(value.supplements) ||
    !isRecord(value.sourceCounts) ||
    !Array.isArray(value.actions)
  )
    return undefined;
  const supplements = value.supplements,
    counts = value.sourceCounts;
  const status = value.status as Status;
  if (
    !validSupplement(supplements.learningParticipation) ||
    !validSupplement(supplements.dailyHabits) ||
    !validSupplement(supplements.activityParticipation) ||
    !validSupplement(supplements.familySchoolCollaboration) ||
    !SOURCES.every((key) => Number.isSafeInteger(counts[key]) && Number(counts[key]) >= 0) ||
    new Set(value.actions).size !== value.actions.length ||
    !value.actions.every(
      (action) =>
        typeof action === "string" && (PERMITTED[status] as readonly string[]).includes(action),
    )
  )
    return undefined;
  return {
    id: value.id,
    studentId: value.studentId,
    studentLabel: value.studentLabel,
    classRef: value.classRef,
    month: value.month,
    status,
    version: Number(value.version),
    sourceVersion: Number(value.sourceVersion),
    publicationVersion: Number(value.publicationVersion),
    supplements: {
      learningParticipation: supplements.learningParticipation,
      dailyHabits: supplements.dailyHabits,
      activityParticipation: supplements.activityParticipation,
      familySchoolCollaboration: supplements.familySchoolCollaboration,
    },
    sourceCounts: {
      GROWTH_RECORD: Number(counts.GROWTH_RECORD),
      ATTENDANCE_OVERVIEW: Number(counts.ATTENDANCE_OVERVIEW),
    },
    actions: [...value.actions] as ChildMonthlyAction[],
  };
}
export function parseChildMonthlyListing(value: unknown): ChildMonthlyListing | undefined {
  if (!isRecord(value) || !Array.isArray(value.records) || !Array.isArray(value.students))
    return undefined;
  const records = value.records.map(parseChildMonthlyRecord);
  const students = value.students.map((student): ChildMonthlyStudentOption | undefined => {
    if (
      !isRecord(student) ||
      typeof student.id !== "string" ||
      !UUID.test(student.id) ||
      !validLabel(student.displayRef, 120) ||
      !validLabel(student.classRef, 80)
    )
      return undefined;
    return { id: student.id, displayRef: student.displayRef, classRef: student.classRef };
  });
  if (
    records.some((record) => !record) ||
    students.some((student) => !student) ||
    new Set(records.map((record) => record?.id)).size !== records.length ||
    new Set(students.map((student) => student?.id)).size !== students.length
  )
    return undefined;
  return {
    records: records as ChildMonthlyReviewRow[],
    students: students as ChildMonthlyStudentOption[],
  };
}

const EMPTY: ChildMonthlyReviewSnapshot = {
  status: "IDLE",
  session: null,
  rows: [],
  message: "请使用机构邀请账号登录。",
  error: null,
};
function failure(status: number) {
  return Object.assign(new Error("孩子月报请求未完成"), { status });
}
const CONFLICT_MESSAGE = "本次操作未保存，记录或来源已变化，已刷新最新版本，请核对后重新操作。";

export class ChildMonthlyReviewClient {
  private value: ChildMonthlyReviewSnapshot = EMPTY;
  private readonly fetcher: typeof fetch;
  private generation = 0;
  private busy = false;
  public constructor(options: Readonly<{ fetcher?: typeof fetch }> = {}) {
    this.fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
  }
  public get snapshot(): ChildMonthlyReviewSnapshot {
    return this.value;
  }
  public async connect(): Promise<void> {
    if (this.busy) return;
    const generation = ++this.generation;
    this.busy = true;
    this.value = { ...EMPTY, status: "CONNECTING", message: "正在确认当前账号权限…" };
    try {
      const identity = await this.request("/me");
      if (generation !== this.generation) return;
      if (
        !isRecord(identity) ||
        typeof identity.display_name !== "string" ||
        !identity.display_name.trim() ||
        identity.display_name.length > 120 ||
        !Array.isArray(identity.memberships)
      )
        throw failure(502);
      if (
        !identity.memberships.some(
          (member) =>
            isRecord(member) &&
            member.status === "ACTIVE" &&
            Array.isArray(member.capabilities) &&
            member.capabilities.includes("feedback:read") &&
            member.capabilities.includes("feedback:review"),
        )
      )
        throw failure(403);
      this.value = { ...this.value, session: { label: identity.display_name } };
      await this.load(generation, "已读取当前授权范围的孩子个人月报。");
    } catch (cause) {
      if (generation === this.generation) this.fail(cause);
    } finally {
      if (generation === this.generation) this.busy = false;
    }
  }
  public async refresh(): Promise<void> {
    if (this.busy || this.value.status !== "READY") return;
    const generation = this.generation;
    this.busy = true;
    this.value = { ...this.value, status: "BUSY", rows: [], message: "正在刷新孩子个人月报…" };
    try {
      await this.load(generation, "月报队列已刷新，来源变化的记录需要重新审核。");
    } catch (cause) {
      if (generation === this.generation) this.fail(cause);
    } finally {
      if (generation === this.generation) this.busy = false;
    }
  }
  public async review(
    id: string,
    version: number,
    action: ChildMonthlyReviewAction,
  ): Promise<void> {
    if (this.busy || this.value.status !== "READY") return;
    const row = this.value.rows.find((item) => item.id === id);
    const allowed =
      action === "CONFIRM"
        ? "confirm"
        : action === "RETURN"
          ? "return"
          : action === "PUBLISH"
            ? "publish"
            : null;
    if (!row || row.version !== version || !allowed || !row.actions.includes(allowed)) {
      this.value = { ...this.value, message: "记录权限或版本已变化，请刷新后重试。" };
      return;
    }
    const generation = this.generation;
    this.busy = true;
    this.value = { ...this.value, status: "BUSY", rows: [], message: "正在保存孩子月报处理结果…" };
    try {
      const result = await this.request(
        `/child-monthly-reports/${id}/${action === "PUBLISH" ? "publish" : "review"}`,
        action === "PUBLISH" ? { version } : { version, action },
      );
      if (generation !== this.generation) return;
      const updated = parseChildMonthlyRecord(result);
      if (
        !updated ||
        updated.id !== id ||
        updated.studentId !== row.studentId ||
        updated.month !== row.month ||
        updated.classRef !== row.classRef
      )
        throw failure(502);
      await this.load(
        generation,
        action === "PUBLISH"
          ? "月报已发布，获批绑定该孩子的家长可以查看。"
          : action === "RETURN"
            ? "月报已退回，教师修改并保存后可重新提交。"
            : "月报已确认，可另行发布给获批绑定该孩子的家长。",
      );
    } catch (cause) {
      if (generation !== this.generation) return;
      if (isRecord(cause) && cause.status === 409) {
        try {
          await this.load(generation, CONFLICT_MESSAGE);
        } catch (reloadCause) {
          if (generation === this.generation) this.fail(reloadCause);
        }
      } else this.fail(cause);
    } finally {
      if (generation === this.generation) this.busy = false;
    }
  }
  public disconnect(): void {
    this.generation++;
    this.busy = false;
    this.value = EMPTY;
  }
  private async load(generation: number, message: string): Promise<void> {
    const payload = await this.request("/child-monthly-reports");
    if (generation !== this.generation) return;
    const listing = parseChildMonthlyListing(payload);
    if (!listing) throw failure(502);
    this.value = { ...this.value, status: "READY", rows: listing.records, message, error: null };
  }
  private async request(path: string, body?: Record<string, unknown>): Promise<unknown> {
    const response = await this.fetcher("/api/admin" + path, {
      method: body ? "POST" : "GET",
      cache: "no-store",
      credentials: "same-origin",
      redirect: "error",
      signal: AbortSignal.timeout(5000),
      headers: {
        accept: "application/json",
        ...(body ? { "content-type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) throw failure(response.status);
    const payload: unknown = await response.json();
    if (!isRecord(payload) || !("data" in payload)) throw failure(502);
    return payload.data;
  }
  private fail(cause: unknown): void {
    const status = isRecord(cause) ? cause.status : 0;
    const message =
      status === 401
        ? "登录状态已失效，请重新登录。"
        : status === 403 || status === 404
          ? "当前账号无法访问这些孩子月报，记录内容已隐藏。"
          : "暂时无法读取或保存孩子月报，请重新连接后重试。";
    this.value = {
      ...EMPTY,
      status:
        status === 401
          ? "UNAUTHENTICATED"
          : status === 403 || status === 404
            ? "FORBIDDEN"
            : "ERROR",
      message,
      error: message,
    };
  }
}
