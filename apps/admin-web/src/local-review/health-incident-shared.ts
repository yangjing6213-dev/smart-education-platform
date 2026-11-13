export type HealthIncidentReviewRole = "CAMPUS_REVIEWER" | "PLATFORM_ADMIN";
export type HealthIncidentReviewAction =
  "CONFIRM" | "RETURN" | "ESCALATE" | "SUPPLEMENT" | "PUBLISH" | "REVOKE";
export type HealthIncidentStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "EXCEPTION_PENDING"
  | "RETURNED"
  | "CONFIRMED"
  | "PUBLISHED"
  | "REVOKED"
  | "WITHDRAWN";
export type HealthIncidentObservationCode =
  "ROUTINE_OBSERVATION" | "NEEDS_FOLLOW_UP" | "URGENT_REVIEW";
export type HealthIncidentDispositionCode =
  "OBSERVATION_RECHECKED" | "FOLLOW_UP_SCHEDULED" | "GUARDIAN_SUMMARY_PREPARED";
export type HealthIncidentSummaryCode =
  "FOLLOW_UP_IN_PROGRESS" | "FOLLOW_UP_COMPLETED" | "PLEASE_CHECK_PAGE_LATER";

export const HEALTH_INCIDENT_REVIEW_ENDPOINT = "/local/health-incident-review";

export interface HealthIncidentReviewRow {
  readonly id: string;
  readonly version: number;
  readonly status: HealthIncidentStatus;
  readonly statusLabel: string;
  readonly published: boolean;
  readonly tenantId: string;
  readonly campusId: string;
  readonly classId: string;
  readonly studentLabel: string;
  readonly observationCode: HealthIncidentObservationCode;
  readonly observationLabel: string;
  readonly dispositionCode: HealthIncidentDispositionCode | null;
  readonly dispositionLabel: string | null;
  readonly summaryCode: HealthIncidentSummaryCode | null;
  readonly synthetic: true;
}

export interface HealthIncidentReviewSession {
  readonly profile: string;
  readonly label: string;
  readonly actorId: string;
  readonly tenantId: string;
  readonly campusId: string;
  readonly classIds: readonly string[];
  readonly actions: readonly string[];
}

export type HealthIncidentCounts = Readonly<Record<HealthIncidentStatus, number>>;

export interface HealthIncidentReviewSnapshot {
  readonly role: HealthIncidentReviewRole;
  readonly status: "IDLE" | "CONNECTING" | "READY" | "ERROR";
  readonly session: HealthIncidentReviewSession | null;
  readonly rows: readonly HealthIncidentReviewRow[];
  readonly counts: HealthIncidentCounts;
  readonly message: string;
  readonly error: string | null;
}

const ROLE_PROFILE: Readonly<Record<HealthIncidentReviewRole, string | null>> = {
  CAMPUS_REVIEWER: "owner-east",
  PLATFORM_ADMIN: null,
};

const ROLE_LABEL: Readonly<Record<HealthIncidentReviewRole, string>> = {
  CAMPUS_REVIEWER: "校区负责人（共享审核范围）",
  PLATFORM_ADMIN: "平台管理员（仅匿名统计）",
};

const STATUS_LABEL: Readonly<Record<HealthIncidentStatus, string>> = {
  DRAFT: "草稿",
  SUBMITTED: "待审核",
  EXCEPTION_PENDING: "需负责人继续跟进",
  RETURNED: "已退回",
  CONFIRMED: "已审核",
  PUBLISHED: "已发布",
  REVOKED: "已撤回",
  WITHDRAWN: "作者已撤回",
};

const SUMMARY_LABEL: Readonly<Record<HealthIncidentSummaryCode, string>> = {
  FOLLOW_UP_IN_PROGRESS: "后续跟进正在进行。",
  FOLLOW_UP_COMPLETED: "后续跟进已完成。",
  PLEASE_CHECK_PAGE_LATER: "请稍后查看页面内的更新。",
};
const DISPOSITION_LABEL: Readonly<Record<HealthIncidentDispositionCode, string>> = {
  OBSERVATION_RECHECKED: "已重新核对观察",
  FOLLOW_UP_SCHEDULED: "已安排跟进",
  GUARDIAN_SUMMARY_PREPARED: "已准备家长摘要",
};

const SUMMARY_OPTIONS: readonly [HealthIncidentSummaryCode, string][] = Object.entries(
  SUMMARY_LABEL,
) as [HealthIncidentSummaryCode, string][];
const STATUSES = Object.keys(STATUS_LABEL) as HealthIncidentStatus[];
const OBSERVATIONS: readonly HealthIncidentObservationCode[] = [
  "ROUTINE_OBSERVATION",
  "NEEDS_FOLLOW_UP",
  "URGENT_REVIEW",
];
const DISPOSITIONS = Object.keys(DISPOSITION_LABEL) as HealthIncidentDispositionCode[];
const SUMMARIES: readonly HealthIncidentSummaryCode[] = Object.keys(
  SUMMARY_LABEL,
) as HealthIncidentSummaryCode[];

const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= 500;
const oneOf = <T extends string>(value: unknown, values: readonly T[]): value is T =>
  typeof value === "string" && values.includes(value as T);

function validRow(value: unknown): value is HealthIncidentReviewRow {
  return Boolean(
    object(value) &&
    text(value.id) &&
    Number.isSafeInteger(value.version) &&
    Number(value.version) > 0 &&
    oneOf(value.status, STATUSES) &&
    text(value.statusLabel) &&
    typeof value.published === "boolean" &&
    text(value.tenantId) &&
    text(value.campusId) &&
    text(value.classId) &&
    text(value.studentLabel) &&
    oneOf(value.observationCode, OBSERVATIONS) &&
    text(value.observationLabel) &&
    (value.dispositionCode === null || oneOf(value.dispositionCode, DISPOSITIONS)) &&
    (value.dispositionLabel === null || text(value.dispositionLabel)) &&
    (value.summaryCode === null || oneOf(value.summaryCode, SUMMARIES)) &&
    value.synthetic === true,
  );
}

function validSession(value: unknown, profile: string): value is HealthIncidentReviewSession {
  return Boolean(
    object(value) &&
    value.profile === profile &&
    text(value.label) &&
    text(value.actorId) &&
    text(value.tenantId) &&
    text(value.campusId) &&
    Array.isArray(value.classIds) &&
    value.classIds.every(text) &&
    Array.isArray(value.actions) &&
    value.actions.every(text),
  );
}

function emptyCounts(): Record<HealthIncidentStatus, number> {
  return Object.fromEntries(STATUSES.map((status) => [status, 0])) as Record<
    HealthIncidentStatus,
    number
  >;
}

function countsFor(rows: readonly HealthIncidentReviewRow[]): HealthIncidentCounts {
  const counts = emptyCounts();
  for (const row of rows) counts[row.status] += 1;
  return counts;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/gu, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character] ?? character;
  });
}

function actionButton(
  action: HealthIncidentReviewAction,
  row: HealthIncidentReviewRow,
  editable: boolean,
): string {
  const labels: Readonly<Record<HealthIncidentReviewAction, string>> = {
    CONFIRM: "审核通过",
    RETURN: "退回报告者",
    ESCALATE: "标记人工跟进",
    SUPPLEMENT: "更新固定处置项",
    PUBLISH: "发布家长摘要",
    REVOKE: "撤回家长摘要",
  };
  const buttonClass = action === "CONFIRM" || action === "PUBLISH" ? "publish" : "save";
  return `<button type="button" class="${buttonClass}" data-health-incident-action="${action}" data-health-incident-id="${escapeHtml(row.id)}" data-health-incident-version="${row.version}"${editable ? "" : " disabled"}>${labels[action]}</button>`;
}

function summaryPicker(row: HealthIncidentReviewRow, editable: boolean): string {
  const options = SUMMARY_OPTIONS.map(
    ([code, label]) =>
      `<option value="${code}"${row.summaryCode === code ? " selected" : ""}>${label}</option>`,
  ).join("");
  return `<label>家长摘要<select data-health-incident-summary="${escapeHtml(row.id)}"${editable ? "" : " disabled"}>${options}</select></label>`;
}

function dispositionPicker(row: HealthIncidentReviewRow, editable: boolean): string {
  const options = DISPOSITIONS.map(
    (code) =>
      `<option value="${code}"${row.dispositionCode === code ? " selected" : ""}>${DISPOSITION_LABEL[code]}</option>`,
  ).join("");
  return `<label>固定处置项<select data-health-incident-disposition="${escapeHtml(row.id)}"${editable ? "" : " disabled"}>${options}</select></label>`;
}

export function renderHealthIncidentReview(
  snapshot: HealthIncidentReviewSnapshot,
  editable: boolean,
): string {
  const can = (action: string) =>
    editable && snapshot.status === "READY" && Boolean(snapshot.session?.actions.includes(action));
  const roleOptions = (Object.keys(ROLE_LABEL) as HealthIncidentReviewRole[])
    .map(
      (role) =>
        `<option value="${role}"${snapshot.role === role ? " selected" : ""}>${ROLE_LABEL[role]}</option>`,
    )
    .join("");
  const summary = STATUSES.map(
    (status) => `<div><dt>${STATUS_LABEL[status]}</dt><dd>${snapshot.counts[status]}</dd></div>`,
  ).join("");
  const platform = snapshot.role === "PLATFORM_ADMIN";
  const rows = snapshot.rows
    .map((row) => {
      const dispositionAction =
        row.status === "CONFIRMED" || row.status === "PUBLISHED"
          ? `${dispositionPicker(row, can("health:supplement"))}${actionButton("SUPPLEMENT", row, can("health:supplement"))}`
          : "";
      const actions =
        row.status === "SUBMITTED"
          ? `${actionButton("CONFIRM", row, can("health:review"))}${actionButton("RETURN", row, can("health:review"))}${actionButton("ESCALATE", row, can("health:review"))}`
          : row.status === "EXCEPTION_PENDING"
            ? `${actionButton("CONFIRM", row, can("health:review"))}${actionButton("RETURN", row, can("health:review"))}`
            : row.status === "CONFIRMED"
              ? `${dispositionAction}${summaryPicker(row, can("health:publish"))}${actionButton("PUBLISH", row, can("health:publish"))}`
              : row.status === "PUBLISHED"
                ? `${dispositionAction}${actionButton("REVOKE", row, can("health:revoke"))}`
                : "";
      return `<article class="field" data-health-incident-row="${escapeHtml(row.id)}"><h3>事件 ${escapeHtml(row.id)}</h3><p>版本 ${row.version} · ${escapeHtml(row.statusLabel)}</p><p>学生：${escapeHtml(row.studentLabel)} · 当前校区：${escapeHtml(row.campusId)} · 班级：${escapeHtml(row.classId)}</p><p>固定观察项：${escapeHtml(row.observationLabel)}</p><p>固定处置项：${escapeHtml(row.dispositionLabel ?? "尚未选择")}</p>${row.summaryCode ? `<p>已选家长摘要：${escapeHtml(SUMMARY_LABEL[row.summaryCode])}</p>` : ""}${actions ? `<div class="actions">${actions}</div>` : ""}</article>`;
    })
    .join("");
  const body = platform
    ? `<section class="panel"><h2>匿名统计</h2><p class="notice">平台管理员仅查看状态合计，不显示事件编号、学生、观察项、处置项或范围。</p></section>`
    : `<section class="panel"><h2>共享审核队列</h2>${rows || '<p class="notice">当前授权范围没有待处理健康异常。</p>'}</section>`;
  const status = snapshot.error ? `${snapshot.message}（${snapshot.error}）` : snapshot.message;
  return `<div class="shell"><header class="topbar"><strong>机构管理工作台</strong><span>本机共享健康异常审核</span><a href="/">返回管理首页</a></header><main><section class="panel"><p class="eyebrow">仅合成数据 · 本机内存共享 · 不连接外部服务</p><h1>健康异常审核与发布</h1><p>员工使用固定观察项和处置项上报；负责人审核后再单独发布家长摘要。页面不提供自由文本、医疗判断或诊断结论。</p><label>当前模拟角色<select id="health-incident-role"${editable ? "" : " disabled"}>${roleOptions}</select></label><p id="health-incident-feedback" role="status">${escapeHtml(status)}</p>${snapshot.session ? `<p>当前身份：${escapeHtml(snapshot.session.label)} · 校区：${escapeHtml(snapshot.session.campusId)} · 班级范围：${snapshot.session.classIds.length}</p>` : ""}</section><section class="panel"><h2>${platform ? "匿名状态统计" : "授权范围状态统计"}</h2><dl class="meta">${summary}</dl></section>${body}</main><footer>健康异常仅用于本地合成验证；不会发送真实通知，也不会替代人工判断。</footer></div>`;
}

export class HealthIncidentReviewClient {
  private handle: string | null = null;
  private generation = 0;
  private busy = false;
  private state: HealthIncidentReviewSnapshot;

  constructor(private readonly transport: typeof fetch = fetch.bind(globalThis)) {
    this.state = {
      role: "CAMPUS_REVIEWER",
      status: "IDLE",
      session: null,
      rows: [],
      counts: emptyCounts(),
      message: "尚未连接本机共享服务。",
      error: null,
    };
  }

  get snapshot(): HealthIncidentReviewSnapshot {
    return structuredClone(this.state);
  }

  private async request(path: string, method = "GET", body?: object): Promise<unknown> {
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
    if (!response.ok) {
      let code = `HTTP ${response.status}`;
      try {
        const payload = await response.json();
        if (object(payload) && text(payload.code)) code = payload.code;
      } catch {
        // Keep the bounded HTTP status for malformed local responses.
      }
      throw new Error(code);
    }
    return response.json();
  }

  async connect(role: HealthIncidentReviewRole): Promise<void> {
    if (!Object.hasOwn(ROLE_PROFILE, role)) throw new Error("INVALID_ROLE");
    const generation = ++this.generation;
    this.handle = null;
    this.busy = true;
    this.state = {
      ...this.state,
      role,
      status: "CONNECTING",
      session: null,
      rows: [],
      counts: emptyCounts(),
      error: null,
      message: "正在连接本机共享健康异常服务…",
    };
    if (role === "PLATFORM_ADMIN") {
      this.busy = false;
      this.state = {
        ...this.state,
        status: "READY",
        message: "平台管理员仅显示匿名统计。",
      };
      return;
    }
    const profile = ROLE_PROFILE[role];
    if (profile === null) throw new Error("PROFILE_UNAVAILABLE");
    try {
      const bootstrap = await this.request("/local/sessions", "POST", { profile });
      if (generation !== this.generation) return;
      if (!object(bootstrap) || !text(bootstrap.handle) || !/^[-\w]{43}$/u.test(bootstrap.handle))
        throw new Error("INVALID_SESSION");
      this.handle = bootstrap.handle;
      await this.readRows(generation);
    } catch (error) {
      if (generation === this.generation) this.fail(error);
    } finally {
      if (generation === this.generation) this.busy = false;
    }
  }

  private fail(error: unknown): void {
    this.handle = null;
    this.state = {
      ...this.state,
      status: "ERROR",
      session: null,
      rows: [],
      counts: emptyCounts(),
      error: error instanceof Error ? error.message : "LOCAL_SERVICE_UNAVAILABLE",
      message: "本次操作未完成或最新资料不可用；已清空旧资料，请重新连接核对。",
    };
  }

  private async readRows(generation: number): Promise<void> {
    const session = await this.request("/local/session");
    if (generation !== this.generation) return;
    const profile = ROLE_PROFILE[this.state.role];
    if (!profile || !validSession(session, profile) || !session.actions.includes("health:review"))
      throw new Error("INVALID_SCOPE");
    const value = await this.request(HEALTH_INCIDENT_REVIEW_ENDPOINT);
    if (generation !== this.generation) return;
    if (
      !Array.isArray(value) ||
      value.length > 200 ||
      !value.every(
        (row) =>
          validRow(row) &&
          row.tenantId === session.tenantId &&
          row.campusId === session.campusId &&
          session.classIds.includes(row.classId) &&
          ["SUBMITTED", "EXCEPTION_PENDING", "CONFIRMED", "PUBLISHED"].includes(row.status) &&
          row.published === (row.status === "PUBLISHED"),
      ) ||
      new Set(value.map((row) => row.id)).size !== value.length
    )
      throw new Error("INVALID_HEALTH_SCOPE");
    this.state = {
      ...this.state,
      status: "READY",
      session,
      rows: value,
      counts: countsFor(value),
      error: null,
      message: "已刷新本机共享健康异常审核队列。",
    };
  }

  async refresh(): Promise<void> {
    if (this.state.role === "PLATFORM_ADMIN" || !this.handle || this.busy) return;
    const generation = this.generation;
    this.busy = true;
    this.state = {
      ...this.state,
      status: "CONNECTING",
      session: null,
      rows: [],
      counts: emptyCounts(),
      error: null,
    };
    try {
      await this.readRows(generation);
    } catch (error) {
      if (generation === this.generation) this.fail(error);
    } finally {
      if (generation === this.generation) this.busy = false;
    }
  }

  async review(
    id: string,
    version: number,
    action: "CONFIRM" | "RETURN" | "ESCALATE",
  ): Promise<void> {
    if (action !== "CONFIRM" && action !== "RETURN" && action !== "ESCALATE")
      throw new Error("INVALID_ACTION");
    await this.versionedAction(id, version, "review", { action });
  }

  async publish(
    id: string,
    version: number,
    summaryCode: HealthIncidentSummaryCode,
  ): Promise<void> {
    if (!SUMMARIES.includes(summaryCode)) throw new Error("INVALID_SUMMARY");
    await this.versionedAction(id, version, "publish", { summaryCode });
  }

  async revoke(id: string, version: number): Promise<void> {
    await this.versionedAction(id, version, "revoke", {});
  }

  async supplement(
    id: string,
    version: number,
    dispositionCode: HealthIncidentDispositionCode,
  ): Promise<void> {
    if (!DISPOSITIONS.includes(dispositionCode)) throw new Error("INVALID_DISPOSITION");
    await this.versionedAction(id, version, "supplement", { dispositionCode });
  }

  private async versionedAction(
    id: string,
    version: number,
    action: "review" | "supplement" | "publish" | "revoke",
    extra: object,
  ): Promise<void> {
    if (
      this.busy ||
      this.state.status !== "READY" ||
      this.state.role === "PLATFORM_ADMIN" ||
      !this.handle ||
      !this.state.session?.actions.includes(`health:${action}`)
    )
      throw new Error("ACTION_UNAVAILABLE");
    const row = this.state.rows.find((candidate) => candidate.id === id);
    if (!row || !Number.isSafeInteger(version) || row.version !== version) throw new Error("STALE");
    const reviewAction = object(extra) ? extra.action : undefined;
    const allowed =
      action === "review"
        ? reviewAction === "ESCALATE"
          ? row.status === "SUBMITTED"
          : (reviewAction === "CONFIRM" || reviewAction === "RETURN") &&
            (row.status === "SUBMITTED" || row.status === "EXCEPTION_PENDING")
        : action === "supplement"
          ? row.status === "CONFIRMED" || row.status === "PUBLISHED"
          : action === "publish"
            ? row.status === "CONFIRMED"
            : row.status === "PUBLISHED";
    if (!allowed) throw new Error("ACTION_UNAVAILABLE");
    const generation = this.generation;
    this.busy = true;
    this.state = {
      ...this.state,
      status: "CONNECTING",
      session: null,
      rows: [],
      counts: emptyCounts(),
      error: null,
    };
    try {
      await this.request(`/local/health-incidents/${encodeURIComponent(id)}/${action}`, "POST", {
        version,
        ...extra,
      });
      if (generation === this.generation) await this.readRows(generation);
    } catch (error) {
      if (generation === this.generation) this.fail(error);
    } finally {
      if (generation === this.generation) this.busy = false;
    }
  }
}
