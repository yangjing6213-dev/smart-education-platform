export const MONTHLY_FEEDBACK_REVIEW_ENDPOINT = "/local/monthly-feedback-review";

const API_BASE = "http://127.0.0.1:4317";
export type MonthlyFeedbackReviewRole = "CAMPUS_REVIEWER";
export type MonthlyFeedbackReviewAction = "CONFIRM" | "RETURN" | "PUBLISH" | "SOURCE_REFRESH";
export type MonthlyFeedbackStatus =
  "DRAFT" | "SUBMITTED" | "RETURNED" | "CONFIRMED" | "PUBLISHED" | "REVIEW_REQUIRED";
type Code = "KEEP_WATCHING" | "PROGRESSING" | "FOLLOW_UP";
type SourceKind = "GROWTH_RECORD" | "ATTENDANCE_OVERVIEW" | "STAFF_DAILY";
interface SourceSummary {
  readonly kind: SourceKind;
  readonly label: string;
  readonly count: number;
  readonly dates: readonly string[];
}

export interface MonthlyFeedbackReviewRow {
  readonly id: string;
  readonly version: number;
  readonly status: MonthlyFeedbackStatus;
  readonly month: string;
  readonly tenantId: string;
  readonly campusId: string;
  readonly classId: string;
  readonly teacherId: string;
  readonly teacherLabel: string;
  readonly sourceSummary: readonly SourceSummary[];
  readonly supplements: Readonly<Record<string, Code>>;
  readonly published: boolean;
  readonly synthetic: true;
}
export interface MonthlyFeedbackReviewSession {
  readonly profile: string;
  readonly label: string;
  readonly actorId: string;
  readonly tenantId: string;
  readonly campusId: string;
  readonly classIds: readonly string[];
  readonly actions: readonly string[];
}
export interface MonthlyFeedbackReviewSnapshot {
  readonly role: MonthlyFeedbackReviewRole;
  readonly status: "IDLE" | "CONNECTING" | "READY" | "ERROR";
  readonly session: MonthlyFeedbackReviewSession | null;
  readonly rows: readonly MonthlyFeedbackReviewRow[];
  readonly counts: Readonly<Record<MonthlyFeedbackStatus, number>>;
  readonly message: string;
  readonly error: string | null;
}

const REVIEWER_PROFILE = "owner-east";
const STATUS_LABEL: Readonly<Record<MonthlyFeedbackStatus, string>> = {
  DRAFT: "草稿",
  SUBMITTED: "待审核",
  RETURNED: "已退回",
  CONFIRMED: "已确认",
  PUBLISHED: "已发布",
  REVIEW_REQUIRED: "来源变化，需重新审核",
};
const FIELD_LABELS = {
  learningParticipation: "学习参与",
  dailyHabits: "日常习惯",
  activityParticipation: "活动参与",
  familySchoolCollaboration: "家校协作",
} as const;
const SOURCE_LABELS: Readonly<Record<SourceKind, string>> = {
  GROWTH_RECORD: "已发布成长记录",
  ATTENDANCE_OVERVIEW: "已确认考勤概览",
  STAFF_DAILY: "已确认工作日报",
};
const SOURCE_KINDS = Object.keys(SOURCE_LABELS) as SourceKind[];
const VALUE_LABEL: Record<Code, string> = {
  KEEP_WATCHING: "保持关注",
  PROGRESSING: "已有进步",
  FOLLOW_UP: "需要跟进",
};
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= 200;
const uuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
const code = (value: unknown): value is Code =>
  value === "KEEP_WATCHING" || value === "PROGRESSING" || value === "FOLLOW_UP";
const month = (value: unknown): value is string =>
  typeof value === "string" && /^202[6-9]-(?:0[1-9]|1[0-2])$/u.test(value);

function emptyCounts(): Record<MonthlyFeedbackStatus, number> {
  return Object.fromEntries(Object.keys(STATUS_LABEL).map((status) => [status, 0])) as Record<
    MonthlyFeedbackStatus,
    number
  >;
}
function parseRow(value: unknown): MonthlyFeedbackReviewRow | undefined {
  if (!object(value)) return undefined;
  const supplements = object(value.supplements) ? value.supplements : undefined;
  const sourceSummary = parseSourceSummary(value.sourceSummary, value.month);
  if (
    !uuid(value.id) ||
    !Number.isSafeInteger(value.version) ||
    (value.version as number) < 1 ||
    typeof value.status !== "string" ||
    !(value.status in STATUS_LABEL) ||
    !month(value.month) ||
    !text(value.tenantId) ||
    !text(value.campusId) ||
    !text(value.classId) ||
    !uuid(value.createdBy ?? value.teacherId) ||
    !text(value.authorLabel ?? value.teacherLabel) ||
    !sourceSummary ||
    "sources" in value ||
    "sourceLabels" in value ||
    !supplements ||
    !(Object.keys(FIELD_LABELS) as string[]).every((field) => code(supplements[field])) ||
    typeof value.published !== "boolean" ||
    value.synthetic !== true
  )
    return undefined;
  return {
    id: value.id,
    version: value.version as number,
    status: value.status as MonthlyFeedbackStatus,
    month: value.month,
    tenantId: value.tenantId,
    campusId: value.campusId,
    classId: value.classId,
    teacherId: (value.createdBy ?? value.teacherId) as string,
    teacherLabel: (value.authorLabel ?? value.teacherLabel) as string,
    sourceSummary,
    supplements: structuredClone(supplements) as Readonly<Record<string, Code>>,
    published: value.published,
    synthetic: true,
  };
}
function parseSourceSummary(value: unknown, monthValue: unknown): SourceSummary[] | undefined {
  if (!month(monthValue) || !Array.isArray(value) || value.length !== SOURCE_KINDS.length)
    return undefined;
  const parsed = value.map((item) => {
    if (!object(item)) return undefined;
    const kind = item.kind as SourceKind;
    if (
      Object.keys(item).length !== 4 ||
      Object.keys(item).some((key) => !["kind", "label", "count", "dates"].includes(key)) ||
      !SOURCE_KINDS.includes(kind) ||
      item.label !== SOURCE_LABELS[kind] ||
      !Number.isSafeInteger(item.count) ||
      (item.count as number) < 0 ||
      !Array.isArray(item.dates) ||
      !item.dates.every(
        (date) =>
          typeof date === "string" &&
          /^202[6-9]-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/u.test(date) &&
          date.startsWith(`${monthValue}-`),
      )
    )
      return undefined;
    return {
      kind,
      label: item.label,
      count: item.count as number,
      dates: [...item.dates] as string[],
    };
  });
  if (
    parsed.some((item) => item === undefined) ||
    parsed.some((item, index) => item?.kind !== SOURCE_KINDS[index])
  )
    return undefined;
  return parsed as SourceSummary[];
}
function escape(value: string | number): string {
  return String(value).replace(
    /[&<>"']/gu,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!,
  );
}

export function renderMonthlyFeedbackReview(
  snapshot: MonthlyFeedbackReviewSnapshot,
  editable: boolean,
): string {
  const rows = snapshot.rows
    .map((row) => {
      const actions =
        editable && row.status === "SUBMITTED"
          ? `<div class="actions"><button type="button" class="publish" data-monthly-feedback-action="CONFIRM" data-monthly-feedback-id="${escape(row.id)}" data-monthly-feedback-version="${row.version}">确认反馈</button><button type="button" class="save" data-monthly-feedback-action="RETURN" data-monthly-feedback-id="${escape(row.id)}" data-monthly-feedback-version="${row.version}">退回修改</button></div>`
          : editable && row.status === "CONFIRMED"
            ? `<div class="actions"><button type="button" class="publish" data-monthly-feedback-action="PUBLISH" data-monthly-feedback-id="${escape(row.id)}" data-monthly-feedback-version="${row.version}">发布家长摘要</button></div>`
            : editable && row.status === "PUBLISHED"
              ? `<div class="actions"><button type="button" class="save" data-monthly-feedback-action="SOURCE_REFRESH" data-monthly-feedback-id="${escape(row.id)}" data-monthly-feedback-version="${row.version}">检查来源变化</button></div>`
              : "";
      const values = (Object.keys(FIELD_LABELS) as Array<keyof typeof FIELD_LABELS>)
        .map(
          (field) =>
            `<div><dt>${FIELD_LABELS[field]}</dt><dd>${VALUE_LABEL[row.supplements[field] ?? "KEEP_WATCHING"]}</dd></div>`,
        )
        .join("");
      const sources = row.sourceSummary
        .map(
          (source) =>
            `${escape(source.label)} ${source.count} 条${source.dates.length ? `（${source.dates.map(escape).join("、")}）` : "（暂无）"}`,
        )
        .join("；");
      return `<article class="panel" data-monthly-feedback-row="${escape(row.id)}"><h2>${escape(row.month)} 月度反馈</h2><p>版本 ${row.version} · ${STATUS_LABEL[row.status]} · 教师：${escape(row.teacherLabel)}</p><p>来源：${sources}</p><dl class="meta">${values}</dl>${actions}</article>`;
    })
    .join("");
  const summary = Object.keys(STATUS_LABEL)
    .map(
      (status) =>
        `<div><dt>${STATUS_LABEL[status as MonthlyFeedbackStatus]}</dt><dd>${snapshot.counts[status as MonthlyFeedbackStatus]}</dd></div>`,
    )
    .join("");
  const status = snapshot.error ? `${snapshot.message}（${snapshot.error}）` : snapshot.message;
  return `<section class="panel staff-monthly-feedback-review" data-monthly-feedback-review><div class="heading-row"><div><p class="eyebrow">员工内部流程 · 仅本机合成资料</p><h2>月度成长反馈审核</h2><p>固定示例校区负责人查看当前授权范围；家长只会收到已发布的固定摘要。</p></div><button type="button" data-monthly-feedback-refresh${editable ? "" : " disabled"}>刷新队列</button></div><p id="monthly-feedback-feedback" role="status">${escape(status)}</p>${snapshot.session ? `<p>当前身份：${escape(snapshot.session.label)} · 当前校区：${escape(snapshot.session.campusId)}</p>` : ""}<section class="panel"><h3>授权范围状态统计</h3><dl class="meta">${summary}</dl></section><h3>负责人审核队列</h3>${rows || '<p class="notice">当前授权范围没有月度反馈记录。</p>'}<p class="notice">仅显示合成资料；审核和发布不会发送真实通知。</p></section>`;
}

export class MonthlyFeedbackReviewClient {
  private handle: string | null = null;
  private generation = 0;
  private state: MonthlyFeedbackReviewSnapshot = {
    role: "CAMPUS_REVIEWER",
    status: "IDLE",
    session: null,
    rows: [],
    counts: emptyCounts(),
    message: "尚未连接本机共享服务。",
    error: null,
  };
  private readonly transport: typeof fetch;
  constructor(options: { baseUrl?: string; transport?: typeof fetch } = {}) {
    this.transport = createLocalMonthlyFeedbackReviewTransport(
      options.baseUrl ?? API_BASE,
      options.transport,
    );
  }
  get snapshot() {
    return structuredClone(this.state);
  }
  disconnect(): void {
    this.generation += 1;
    this.handle = null;
    this.state = {
      ...this.state,
      status: "IDLE",
      session: null,
      rows: [],
      counts: emptyCounts(),
      error: null,
      message: "已断开本机共享月度反馈服务。",
    };
  }
  private fail(error: unknown, generation: number): void {
    if (generation !== this.generation) return;
    this.generation += 1;
    this.handle = null;
    this.state = {
      ...this.state,
      status: "ERROR",
      session: null,
      rows: [],
      counts: emptyCounts(),
      error: error instanceof Error ? error.message : "LOCAL_SERVICE_UNAVAILABLE",
      message: "本机共享服务暂时不可用，请重新连接。",
    };
  }
  private async request(path: string, method = "GET", body?: object): Promise<unknown> {
    if (!allowedRequest(path, method)) throw new Error("月度反馈审核请求不在本机白名单内。");
    const response = await this.transport(path, {
      method,
      credentials: "omit",
      cache: "no-store",
      redirect: "error",
      headers: {
        ...(this.handle ? { Authorization: `Bearer ${this.handle}` } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }
  async connect(): Promise<void> {
    const generation = ++this.generation;
    this.handle = null;
    this.state = {
      ...this.state,
      role: "CAMPUS_REVIEWER",
      status: "CONNECTING",
      session: null,
      rows: [],
      counts: emptyCounts(),
      error: null,
      message: "正在连接本机共享月度反馈服务…",
    };
    try {
      const bootstrap = await this.request("/local/sessions", "POST", {
        profile: REVIEWER_PROFILE,
      });
      if (generation !== this.generation) return;
      if (!object(bootstrap) || !text(bootstrap.handle) || !/^[-\w]{43}$/u.test(bootstrap.handle))
        throw new Error("INVALID_SESSION");
      this.handle = bootstrap.handle;
      const session = await this.request("/local/session");
      if (generation !== this.generation) return;
      if (
        !object(session) ||
        session.mode !== "local-synthetic" ||
        session.profile !== REVIEWER_PROFILE ||
        !text(session.label) ||
        !uuid(session.actorId) ||
        !uuid(session.tenantId) ||
        !uuid(session.campusId) ||
        !Array.isArray(session.classIds) ||
        !session.classIds.every(uuid) ||
        !Array.isArray(session.actions) ||
        !session.actions.every(text) ||
        !session.actions.includes("feedback:read") ||
        !session.actions.includes("feedback:review") ||
        !session.actions.includes("feedback:publish")
      )
        throw new Error("INVALID_SCOPE");
      this.state = {
        ...this.state,
        status: "READY",
        session: session as unknown as MonthlyFeedbackReviewSession,
        message: "已连接，同一反馈编号、版本和范围来自本机共享服务。",
      };
      await this.refresh(generation);
    } catch (error) {
      this.fail(error, generation);
    }
  }
  async refresh(generation = this.generation): Promise<void> {
    const session = this.state.session;
    if (!session || !this.handle) return;
    try {
      const value = await this.request(MONTHLY_FEEDBACK_REVIEW_ENDPOINT);
      if (generation !== this.generation) return;
      const list = Array.isArray(value)
        ? value
        : object(value) && Array.isArray(value.rows)
          ? value.rows
          : null;
      const rows = list?.map(parseRow);
      if (
        !rows ||
        rows.some(
          (row): row is undefined =>
            row === undefined ||
            row.tenantId !== session.tenantId ||
            row.campusId !== session.campusId ||
            !session.classIds.includes(row.classId),
        )
      )
        throw new Error("INVALID_MONTHLY_FEEDBACK_SCOPE");
      const validRows = rows as MonthlyFeedbackReviewRow[];
      const counts = emptyCounts();
      for (const row of validRows) counts[row.status] += 1;
      this.state = {
        ...this.state,
        status: "READY",
        rows: validRows,
        counts,
        error: null,
        message: "已刷新本机共享月度反馈队列。",
      };
    } catch (error) {
      this.fail(error, generation);
      throw error;
    }
  }
  async command(id: string, version: number, action: MonthlyFeedbackReviewAction): Promise<void> {
    const generation = this.generation;
    if (!this.state.session || !this.handle) throw new Error("REVIEWER_SESSION_REQUIRED");
    if (
      !Number.isSafeInteger(version) ||
      !["CONFIRM", "RETURN", "PUBLISH", "SOURCE_REFRESH"].includes(action)
    )
      throw new Error("INVALID_ACTION");
    const row = this.state.rows.find((candidate) => candidate.id === id);
    if (!row || row.version !== version) throw new Error("STALE");
    if (
      ((action === "CONFIRM" || action === "RETURN") && row.status !== "SUBMITTED") ||
      (action === "PUBLISH" && row.status !== "CONFIRMED") ||
      (action === "SOURCE_REFRESH" && row.status !== "PUBLISHED")
    )
      throw new Error("INVALID_STATE");
    const suffix =
      action === "SOURCE_REFRESH"
        ? "source-refresh"
        : action === "CONFIRM" || action === "RETURN"
          ? "review"
          : "publish";
    const body = { version, ...(suffix === "review" ? { action } : {}) };
    try {
      await this.request(
        `/local/monthly-feedback/${encodeURIComponent(id)}/${suffix}`,
        "POST",
        body,
      );
      if (generation !== this.generation) return;
      await this.refresh(generation);
    } catch (error) {
      this.fail(error, generation);
      throw error;
    }
  }
}

function allowedRequest(path: string, method: string): boolean {
  if (path === "/local/sessions") return method === "POST";
  if (path === "/local/session" || path === MONTHLY_FEEDBACK_REVIEW_ENDPOINT)
    return method === "GET";
  return (
    /^\/local\/monthly-feedback\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/(?:review|publish|source-refresh)$/iu.test(
      path,
    ) && method === "POST"
  );
}

export function createLocalMonthlyFeedbackReviewTransport(
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
    throw new Error("月度反馈审核仅允许连接本机服务。");
  return async (input, init = {}) => {
    if (typeof input !== "string") return new Response(null, { status: 403 });
    let url: URL;
    try {
      url = new URL(input, base.origin);
    } catch {
      return new Response(null, { status: 403 });
    }
    const method = init.method ?? "GET";
    if (url.origin !== base.origin || !allowedRequest(url.pathname, method))
      return new Response(null, { status: 403 });
    return fetcher(url, { ...init, credentials: "omit", cache: "no-store", redirect: "error" });
  };
}
