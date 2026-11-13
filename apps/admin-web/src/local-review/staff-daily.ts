const API_BASE = "http://127.0.0.1:4317";

export type StaffDailyReviewAction = "CONFIRM" | "RETURN";
export type StaffDailyStatus = "SUBMITTED" | "CONFIRMED" | "RETURNED";
export type StaffDailySourceKind =
  "TASK" | "ATTENDANCE" | "CARE_RECORD" | "PICKUP" | "PICKUP_EXCEPTION";
export interface StaffDailyLearningSummary {
  readonly completedLearnerBand: "2_PLUS";
  readonly usedGuidance: boolean;
  readonly needsTeacherFollowUp: boolean;
}
type Field = "arrival" | "homework" | "activity" | "classroom" | "followUp";
type Values = Record<Field, string>;

const OPTIONS: Readonly<Record<Field, readonly (readonly [string, string])[]>> = {
  arrival: [
    ["ARRIVED_AS_PLANNED", "按计划到校"],
    ["LATE", "迟到"],
    ["ABSENT", "未到"],
  ],
  homework: [
    ["COMPLETED", "已完成整理"],
    ["IN_PROGRESS", "正在完成"],
    ["NEEDS_SUPPORT", "需要协助"],
  ],
  activity: [
    ["PARTICIPATED", "参与活动"],
    ["OBSERVED", "观察活动"],
    ["NOT_RECORDED", "未记录"],
  ],
  classroom: [
    ["ROUTINE", "日常状态"],
    ["NEEDS_ATTENTION", "需要老师留意"],
    ["NEEDS_FOLLOW_UP", "需要后续跟进"],
  ],
  followUp: [
    ["NONE", "无需跟进"],
    ["OBSERVE_TOMORROW", "明日继续观察"],
    ["OWNER_ATTENTION", "交负责人关注"],
  ],
};
const FIELDS: readonly Field[] = ["arrival", "homework", "activity", "classroom", "followUp"];
const FIELD_LABELS: Record<Field, string> = {
  arrival: "到校状态",
  homework: "作业整理",
  activity: "活动参与",
  classroom: "班级秩序",
  followUp: "后续安排",
};
export const STAFF_DAILY_REVIEW_OPTIONS = OPTIONS;
export const STAFF_DAILY_REVIEW_FIELD_LABELS = FIELD_LABELS;
const STATUS_LABELS: Record<StaffDailyStatus, string> = {
  SUBMITTED: "待负责人审核",
  CONFIRMED: "已确认",
  RETURNED: "已退回修改",
};
const SOURCE_KINDS: readonly StaffDailySourceKind[] = [
  "TASK",
  "ATTENDANCE",

  "CARE_RECORD",
  "PICKUP",
  "PICKUP_EXCEPTION",
];
const STAFF_DAILY_ROW_KEYS = new Set([
  "id",
  "version",
  "kind",
  "tenantId",
  "campusId",
  "classId",
  "date",
  "values",
  "sourceRefs",
  "status",
  "createdBy",
  "reviewedBy",
  "updatedBy",
  "updatedAt",
  "authorLabel",
  "reviewerLabel",
  "synthetic",
  "learningSummary",
]);
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const uuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
const text = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= 120;
const validDate = (value: unknown): value is string =>
  typeof value === "string" &&
  /^202[6-9]-\d{2}-\d{2}$/u.test(value) &&
  Number.isFinite(Date.parse(`${value}T00:00:00.000Z`)) &&
  new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
function parseLearningSummary(value: unknown): StaffDailyLearningSummary | null | undefined {
  if (value === null) return null;
  if (
    !object(value) ||
    Object.keys(value).length !== 3 ||
    value.completedLearnerBand !== "2_PLUS" ||
    typeof value.usedGuidance !== "boolean" ||
    typeof value.needsTeacherFollowUp !== "boolean"
  )
    return undefined;
  return {
    completedLearnerBand: "2_PLUS",
    usedGuidance: value.usedGuidance,
    needsTeacherFollowUp: value.needsTeacherFollowUp,
  };
}
const escape = (value: string | number): string =>
  String(value).replace(
    /[&<>"']/gu,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!,
  );

export interface StaffDailyReviewerSession {
  readonly profile: "owner-east";
  readonly label: string;
  readonly actorId: string;
  readonly tenantId: string;
  readonly campusId: string;
  readonly classIds: readonly string[];
  readonly actions: readonly string[];
}

export interface StaffDailyReviewRow {
  readonly id: string;
  readonly version: number;
  readonly status: StaffDailyStatus;
  readonly date: string;
  readonly authorLabel: string;
  readonly values: Values;
  readonly sourceCounts: Readonly<Record<StaffDailySourceKind, number>>;
  readonly learningSummary: StaffDailyLearningSummary | null;
}

export interface StaffDailyReviewSnapshot {
  readonly status: "IDLE" | "CONNECTING" | "BUSY" | "READY" | "ERROR";
  readonly session: StaffDailyReviewerSession | null;
  readonly rows: readonly StaffDailyReviewRow[];
  readonly message: string;
  readonly error: string | null;
}

export interface StaffDailyReviewClientOptions {
  readonly baseUrl?: string;
  readonly transport?: typeof fetch;
}

function allowedRequest(path: string, method: string): boolean {
  if (path === "/local/sessions") return method === "POST";
  if (path === "/local/session" || path === "/local/staff-daily-review") return method === "GET";
  return (
    /^\/local\/staff-daily-reports\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/review$/iu.test(
      path,
    ) && method === "POST"
  );
}

export function createLocalStaffDailyTransport(
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
    throw new Error("日报审核仅允许连接本机服务。");
  const origin = base.origin;
  return async (input, init = {}) => {
    if (typeof input !== "string") return new Response(null, { status: 403 });
    let url: URL;
    try {
      url = new URL(input, origin);
    } catch {
      return new Response(null, { status: 403 });
    }
    if (url.origin !== origin || !allowedRequest(url.pathname, init.method ?? "GET"))
      return new Response(null, { status: 403 });
    return fetcher(url, { ...init, credentials: "omit", cache: "no-store", redirect: "error" });
  };
}

function parseSession(value: unknown): StaffDailyReviewerSession {
  if (
    !object(value) ||
    value.mode !== "local-synthetic" ||
    value.profile !== "owner-east" ||
    !text(value.label) ||
    !uuid(value.actorId) ||
    !uuid(value.tenantId) ||
    !uuid(value.campusId) ||
    !Array.isArray(value.classIds) ||
    value.classIds.length === 0 ||
    !value.classIds.every(uuid) ||
    !Array.isArray(value.actions) ||
    !value.actions.every(text) ||
    !value.actions.includes("daily:read") ||
    !value.actions.includes("daily:review")
  )
    throw new Error("当前示例身份没有日报审核权限。");
  return {
    profile: "owner-east",
    label: value.label,
    actorId: value.actorId,
    tenantId: value.tenantId,
    campusId: value.campusId,
    classIds: value.classIds,
    actions: value.actions,
  };
}

function parseRow(
  value: unknown,
  session: StaffDailyReviewerSession,
): StaffDailyReviewRow | undefined {
  if (!object(value) || Object.keys(value).some((key) => !STAFF_DAILY_ROW_KEYS.has(key)))
    return undefined;
  const values = object(value.values) ? value.values : null;
  const learningSummary = parseLearningSummary(value.learningSummary);
  if (
    !uuid(value.id) ||
    !Number.isSafeInteger(value.version) ||
    Number(value.version) < 1 ||
    value.kind !== "staffDaily" ||
    value.tenantId !== session.tenantId ||
    value.campusId !== session.campusId ||
    !uuid(value.classId) ||
    !session.classIds.includes(value.classId) ||
    !validDate(value.date) ||
    !["SUBMITTED", "CONFIRMED", "RETURNED"].includes(String(value.status)) ||
    !uuid(value.createdBy) ||
    value.createdBy === session.actorId ||
    !text(value.authorLabel) ||
    value.synthetic !== true ||
    learningSummary === undefined ||
    !values ||
    Object.keys(values).length !== FIELDS.length ||
    FIELDS.some((field) => !OPTIONS[field].some(([code]) => code === values[field])) ||
    !Array.isArray(value.sourceRefs) ||
    value.sourceRefs.length > 200
  )
    return undefined;
  const sourceCounts: Record<StaffDailySourceKind, number> = {
    TASK: 0,
    ATTENDANCE: 0,

    CARE_RECORD: 0,
    PICKUP: 0,
    PICKUP_EXCEPTION: 0,
  };
  const seen = new Set<string>();
  for (const reference of value.sourceRefs) {
    if (
      !object(reference) ||
      Object.keys(reference).length !== 3 ||
      !SOURCE_KINDS.includes(reference.kind as StaffDailySourceKind) ||
      !uuid(reference.id) ||
      !Number.isSafeInteger(reference.version) ||
      Number(reference.version) < 1
    )
      return undefined;
    const key = `${reference.kind}:${reference.id}`;
    if (seen.has(key)) return undefined;
    seen.add(key);
    sourceCounts[reference.kind as StaffDailySourceKind] += 1;
  }
  return {
    id: value.id,
    version: Number(value.version),
    status: value.status as StaffDailyStatus,
    date: value.date,
    authorLabel: value.authorLabel,
    values: values as Values,
    sourceCounts,
    learningSummary,
  };
}

function parseRows(value: unknown, session: StaffDailyReviewerSession): StaffDailyReviewRow[] {
  if (!Array.isArray(value) || value.length > 200) throw new Error("日报审核队列格式不正确。");
  const rows = value.map((row) => parseRow(row, session));
  if (
    rows.some((row) => row === undefined || row.status !== "SUBMITTED") ||
    new Set(rows.map((row) => row?.id)).size !== rows.length
  )
    throw new Error("日报超出当前负责人校区或班级范围。");
  return rows as StaffDailyReviewRow[];
}

function sourceSummary(row: StaffDailyReviewRow): string {
  const count = row.sourceCounts;
  return `<p>来源记录：任务 ${count.TASK} · 考勤 ${count.ATTENDANCE} · 托管记录 ${count.CARE_RECORD} · 接送 ${count.PICKUP} · 异常 ${count.PICKUP_EXCEPTION}</p>`;
}

function learningSummary(row: StaffDailyReviewRow): string {
  const summary = row.learningSummary;
  if (!summary) return "";
  return `<p>固定题学习摘要（本机合成）：2 人及以上已完成练习；${summary.usedGuidance ? "使用过分步提示" : "未使用分步提示"}；${summary.needsTeacherFollowUp ? "有教师跟进提示" : "暂无教师跟进提示"}。</p>`;
}

export function renderStaffDailyReview(
  snapshot: StaffDailyReviewSnapshot,
  editable = true,
): string {
  const cards = snapshot.rows
    .map((row) => {
      const values = FIELDS.map((field) => {
        const label = OPTIONS[field].find(([code]) => code === row.values[field])?.[1] ?? "";
        return `<div><dt>${FIELD_LABELS[field]}</dt><dd>${escape(label)}</dd></div>`;
      }).join("");
      const authorAction =
        row.status === "SUBMITTED"
          ? `<div class="actions"><button type="button" data-staff-daily-action="CONFIRM" data-staff-daily-id="${escape(row.id)}" data-staff-daily-version="${row.version}"${editable ? "" : " disabled"}>确认日报</button><button type="button" data-staff-daily-action="RETURN" data-staff-daily-id="${escape(row.id)}" data-staff-daily-version="${row.version}"${editable ? "" : " disabled"}>退回修改</button></div>`
          : "";
      return `<article class="field" data-staff-daily-row="${escape(row.id)}"><div class="heading-row"><h3>工作日报 · ${escape(row.date)}</h3><span class="status">${STATUS_LABELS[row.status]} · 第 ${row.version} 版</span></div><p>提交人：${escape(row.authorLabel)}</p><dl class="meta">${values}</dl>${sourceSummary(row)}${learningSummary(row)}${authorAction}</article>`;
    })
    .join("");
  const status = snapshot.error ? `${snapshot.message} ${snapshot.error}` : snapshot.message;
  return `<section class="panel staff-daily-review" data-staff-daily-review><div class="heading-row"><div><p class="eyebrow">员工内部流程 · 仅本机合成资料</p><h2>工作日报审核</h2><p>固定示例负责人仅查看当前授权校区与班级的日报。</p></div><button type="button" data-staff-daily-refresh>刷新队列</button></div><p id="staff-daily-feedback" role="status">${escape(status)}</p><h3>待审核日报</h3>${cards || '<p class="notice">当前授权范围没有待审核日报。</p>'}</section>`;
}

export class StaffDailyReviewClient {
  private handle: string | null = null;
  private generation = 0;
  private readonly transport: typeof fetch;
  private state: StaffDailyReviewSnapshot = {
    status: "IDLE",
    session: null,
    rows: [],
    message: "连接本机共享服务后查看待审核日报。",
    error: null,
  };

  constructor(options: StaffDailyReviewClientOptions = {}) {
    this.transport =
      options.transport ?? createLocalStaffDailyTransport(options.baseUrl ?? API_BASE);
  }

  get snapshot(): StaffDailyReviewSnapshot {
    return structuredClone(this.state);
  }

  disconnect(): void {
    this.generation += 1;
    this.handle = null;
    this.state = {
      status: "IDLE",
      session: null,
      rows: [],
      error: null,
      message: "已离开工作日报审核。",
    };
  }

  private async request(path: string, method = "GET", body?: object): Promise<unknown> {
    if (!allowedRequest(path, method)) throw new Error("日报审核请求不在本机白名单内。");
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
    if (!response.ok) {
      let conflict = response.status === 409;
      try {
        const payload: unknown = await response.json();
        if (object(payload) && payload.code === "VERSION_CONFLICT") conflict = true;
      } catch {
        /* Keep the bounded local-service message. */
      }
      throw new Error(
        conflict ? "日报版本已变化，请重新连接确认当前状态。" : "本机日报审核服务暂不可用。",
      );
    }
    return response.json();
  }

  async connect(): Promise<void> {
    const generation = ++this.generation;
    this.handle = null;
    this.state = {
      ...this.state,
      status: "CONNECTING",
      session: null,
      rows: [],
      error: null,
      message: "正在连接本机审核队列…",
    };
    try {
      const bootstrap: unknown = await this.request("/local/sessions", "POST", {
        profile: "owner-east",
      });
      if (generation !== this.generation) return;
      if (
        !object(bootstrap) ||
        typeof bootstrap.handle !== "string" ||
        !/^[\w-]{43}$/u.test(bootstrap.handle)
      )
        throw new Error("本机服务没有返回有效的负责人会话。");
      this.handle = bootstrap.handle;
      const session = parseSession(await this.request("/local/session"));
      if (generation !== this.generation) return;
      const rows = await this.loadRows(session);
      if (generation !== this.generation) return;
      this.state = {
        status: "READY",
        session,
        rows,
        error: null,
        message: "负责人审核队列已更新。",
      };
    } catch (error) {
      if (generation !== this.generation) return;
      this.handle = null;
      this.state = {
        ...this.state,
        status: "ERROR",
        session: null,
        rows: [],
        error: error instanceof Error ? error.message : "审核服务连接失败。",
        message: "暂时无法连接工作日报审核队列。",
      };
    }
  }

  async refresh(): Promise<void> {
    const session = this.state.session;
    if (!this.handle || !session || this.state.status !== "READY") return;
    const generation = this.generation;
    this.state = {
      ...this.state,
      status: "BUSY",
      rows: [],
      error: null,
      message: "正在刷新审核队列…",
    };
    try {
      const rows = await this.loadRows(session);
      if (generation !== this.generation) return;
      this.state = {
        ...this.state,
        status: "READY",
        rows,
        error: null,
        message: "负责人审核队列已刷新。",
      };
    } catch (error) {
      if (generation !== this.generation) return;
      this.handle = null;
      this.state = {
        ...this.state,
        status: "ERROR",
        session: null,
        rows: [],
        error: error instanceof Error ? error.message : "刷新失败。",
        message: "队列状态未能确认，请重新连接查看。",
      };
    }
  }

  async review(id: string, version: number, action: StaffDailyReviewAction): Promise<void> {
    if (action !== "CONFIRM" && action !== "RETURN") return;
    const row = this.state.rows.find((item) => item.id === id && item.status === "SUBMITTED");
    const session = this.state.session;
    if (
      this.state.status !== "READY" ||
      !row ||
      row.version !== version ||
      !Number.isSafeInteger(version) ||
      !this.handle ||
      !this.handle ||
      !session?.actions.includes("daily:review")
    )
      return;
    const generation = this.generation;
    this.state = {
      ...this.state,
      status: "BUSY",
      rows: [],
      error: null,
      message: "正在保存审核结果…",
    };
    try {
      const next = parseRow(
        await this.request(`/local/staff-daily-reports/${encodeURIComponent(id)}/review`, "POST", {
          version,
          action,
        }),
        session,
      );
      const expectedStatus = action === "CONFIRM" ? "CONFIRMED" : "RETURNED";
      if (!next || next.id !== id || next.version !== version + 1 || next.status !== expectedStatus)
        throw new Error("本机服务返回的审核结果不正确。");
      if (generation !== this.generation) return;
      const rows = await this.loadRows(session);
      if (generation !== this.generation) return;
      this.state = {
        ...this.state,
        status: "READY",
        rows,
        error: null,
        message: action === "CONFIRM" ? "日报已确认。" : "日报已退回修改。",
      };
    } catch (error) {
      if (generation !== this.generation) return;
      this.handle = null;
      this.state = {
        ...this.state,
        status: "ERROR",
        session: null,
        rows: [],
        error: error instanceof Error ? error.message : "审核操作失败。",
        message: "审核结果未能确认，请重新连接查看，勿重复操作。",
      };
    }
  }

  private async loadRows(session: StaffDailyReviewerSession): Promise<StaffDailyReviewRow[]> {
    return parseRows(await this.request("/local/staff-daily-review"), session);
  }
}
