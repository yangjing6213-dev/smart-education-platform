const REVIEW_PROFILES = [
  ["owner-east", "东校区负责人"],
  ["owner-west", "西校区负责人"],
  ["owner-other-tenant", "另一机构负责人"],
  ["teacher-east", "东校区教师"],
  ["content-editor-east", "内容编辑"],
  ["platform-admin", "平台管理员"],
] as const;
export type AdminStatisticsProfile = (typeof REVIEW_PROFILES)[number][0];
type ReviewProfile = AdminStatisticsProfile;
export const isOperationalStatisticsProfile = (value: unknown): value is ReviewProfile =>
  REVIEW_PROFILES.some(([key]) => key === value);

type StatisticsKind = "TASK" | "ATTENDANCE" | "PICKUP_EXCEPTION" | "HEALTH_INCIDENT";
type StatisticsMode = "SCOPED" | "ANONYMOUS";
interface StatisticsTotals {
  readonly tasks: number;
  readonly attendance: number;
  readonly pickupExceptions: number;
  readonly healthIncidents: number;
  readonly total: number;
}
interface StatisticsSource {
  readonly kind: StatisticsKind;
  readonly id: string;
  readonly version: number;
  readonly date: string;
}
interface StatisticsGroup {
  readonly date: string;
  readonly classId: string;
  readonly classLabel: string;
  readonly kind: StatisticsKind;
  readonly status: string;
  readonly count: number;
  readonly sources: readonly StatisticsSource[];
}
interface StatisticsFilter {
  readonly from: string;
  readonly to: string;
  readonly classId?: string;
}
export interface AdminStatisticsSnapshot {
  readonly status: "IDLE" | "CONNECTING" | "BUSY" | "READY" | "DENIED" | "DISCONNECTED";
  readonly profile: ReviewProfile | null;
  readonly mode: StatisticsMode | null;
  readonly message: string;
  readonly filters: StatisticsFilter;
  readonly campusLabel: string | null;
  readonly classOptions: readonly { readonly id: string; readonly label: string }[];
  readonly totals: StatisticsTotals;
  readonly groups: readonly StatisticsGroup[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const DATE = /^\d{4}-\d{2}-\d{2}$/u;
const KINDS: readonly StatisticsKind[] = [
  "TASK",
  "ATTENDANCE",
  "PICKUP_EXCEPTION",
  "HEALTH_INCIDENT",
];
const KIND_LABELS: Record<StatisticsKind, string> = {
  TASK: "工作任务",
  ATTENDANCE: "考勤",
  PICKUP_EXCEPTION: "接送异常",
  HEALTH_INCIDENT: "健康异常",
};
const STATUS_LABELS: Record<string, string> = {
  ASSIGNED: "待处理",
  CLAIMED: "处理中",
  STARTED: "进行中",
  COMPLETED: "已完成",
  CHECKED: "已检查",
  ARRIVED: "已到校",
  DEPARTED: "已离校",
  OPEN: "待处理",
  RESOLVED: "已处理",
  CONFIRMED: "已确认",
  PUBLISHED: "已发布",
};
const zeroTotals = (): StatisticsTotals => ({
  tasks: 0,
  attendance: 0,
  pickupExceptions: 0,
  healthIncidents: 0,
  total: 0,
});
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const exactKeys = (value: Record<string, unknown>, expected: readonly string[]) =>
  Object.keys(value).length === expected.length && expected.every((key) => key in value);
const validDate = (value: unknown): value is string =>
  typeof value === "string" &&
  DATE.test(value) &&
  Number.isFinite(Date.parse(`${value}T00:00:00.000Z`)) &&
  new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
const validRange = (filter: StatisticsFilter) => {
  if (!validDate(filter.from) || !validDate(filter.to) || filter.from > filter.to) return false;
  return (
    (Date.parse(`${filter.to}T00:00:00.000Z`) - Date.parse(`${filter.from}T00:00:00.000Z`)) /
      86_400_000 <=
    30
  );
};
const text = (value: unknown, max = 80): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= max;
const escape = (value: string | number) =>
  String(value).replace(
    /[&<>"']/gu,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!,
  );

function parseTotals(value: unknown): StatisticsTotals {
  const keys = ["tasks", "attendance", "pickupExceptions", "healthIncidents", "total"];
  if (
    !object(value) ||
    !exactKeys(value, keys) ||
    !keys.every((key) => Number.isSafeInteger(value[key]) && Number(value[key]) >= 0) ||
    Number(value.tasks) +
      Number(value.attendance) +
      Number(value.pickupExceptions) +
      Number(value.healthIncidents) !==
      Number(value.total)
  )
    throw new Error("Invalid statistics totals");
  return {
    tasks: Number(value.tasks),
    attendance: Number(value.attendance),
    pickupExceptions: Number(value.pickupExceptions),
    healthIncidents: Number(value.healthIncidents),
    total: Number(value.total),
  };
}

function parseSource(value: unknown): StatisticsSource {
  if (
    !object(value) ||
    !exactKeys(value, ["kind", "id", "version", "date"]) ||
    !KINDS.includes(value.kind as StatisticsKind) ||
    typeof value.id !== "string" ||
    !UUID.test(value.id) ||
    !Number.isSafeInteger(value.version) ||
    Number(value.version) < 1 ||
    !validDate(value.date)
  )
    throw new Error("Invalid statistics source");
  return {
    kind: value.kind as StatisticsKind,
    id: value.id,
    version: Number(value.version),
    date: value.date,
  };
}

function parseScoped(
  value: unknown,
): Omit<AdminStatisticsSnapshot, "status" | "profile" | "message"> {
  if (
    !object(value) ||
    !exactKeys(value, ["mode", "campusLabel", "filters", "classOptions", "totals", "groups"]) ||
    value.mode !== "SCOPED" ||
    value.campusLabel !== "当前授权校区" ||
    !Array.isArray(value.classOptions) ||
    !value.classOptions.every(
      (option) =>
        object(option) &&
        exactKeys(option, ["id", "label"]) &&
        typeof option.id === "string" &&
        UUID.test(option.id) &&
        text(option.label),
    ) ||
    !Array.isArray(value.groups)
  )
    throw new Error("Invalid scoped statistics");
  const rawFilters = value.filters;
  if (!object(rawFilters)) throw new Error("Invalid statistics filters");
  const from = rawFilters.from;
  const to = rawFilters.to;
  const classId = rawFilters.classId;
  if (
    !validDate(from) ||
    !validDate(to) ||
    Object.keys(rawFilters).some((key) => !["from", "to", "classId"].includes(key)) ||
    (classId !== undefined && (typeof classId !== "string" || !UUID.test(classId)))
  )
    throw new Error("Invalid statistics filters");
  const filters: StatisticsFilter = {
    from,
    to,
    ...(typeof classId === "string" ? { classId } : {}),
  };
  if (!validRange(filters)) throw new Error("Invalid statistics date range");
  const groups = value.groups.map((group): StatisticsGroup => {
    if (
      !object(group) ||
      !exactKeys(group, ["date", "classId", "classLabel", "kind", "status", "count", "sources"]) ||
      !validDate(group.date) ||
      typeof group.classId !== "string" ||
      !UUID.test(group.classId) ||
      !text(group.classLabel) ||
      !KINDS.includes(group.kind as StatisticsKind) ||
      !/^[A-Z_]+$/u.test(String(group.status)) ||
      !Number.isSafeInteger(group.count) ||
      Number(group.count) < 1 ||
      !Array.isArray(group.sources)
    )
      throw new Error("Invalid statistics group");
    const sources = group.sources.map(parseSource);
    if (sources.length !== Number(group.count)) throw new Error("Invalid statistics source count");
    return {
      date: group.date,
      classId: group.classId,
      classLabel: group.classLabel,
      kind: group.kind as StatisticsKind,
      status: String(group.status),
      count: Number(group.count),
      sources,
    };
  });
  return {
    mode: "SCOPED",
    campusLabel: "当前授权校区",
    filters,
    classOptions: value.classOptions as { readonly id: string; readonly label: string }[],
    totals: parseTotals(value.totals),
    groups,
  };
}

function parseAnonymous(value: unknown): Pick<AdminStatisticsSnapshot, "mode" | "totals"> {
  if (!object(value) || !exactKeys(value, ["mode", "totals"]) || value.mode !== "ANONYMOUS")
    throw new Error("Invalid anonymous statistics");
  return { mode: "ANONYMOUS", totals: parseTotals(value.totals) };
}

export class OperationalStatisticsAdminClient {
  private sequence = 0;
  private handle: string | null = null;
  private state: AdminStatisticsSnapshot = {
    status: "IDLE",
    profile: null,
    mode: null,
    message: "选择示例身份后查看运营统计。",
    filters: { from: today(), to: today() },
    campusLabel: null,
    classOptions: [],
    totals: zeroTotals(),
    groups: [],
  };

  constructor(private readonly transport: typeof fetch = fetch.bind(globalThis)) {}

  get snapshot(): AdminStatisticsSnapshot {
    return structuredClone(this.state);
  }

  disconnect(): void {
    this.sequence++;
    this.handle = null;
    this.state = {
      status: "IDLE",
      profile: null,
      mode: null,
      message: "统计页面未连接本机服务。",
      filters: { from: today(), to: today() },
      campusLabel: null,
      classOptions: [],
      totals: zeroTotals(),
      groups: [],
    };
  }

  private async request(path: string, method = "GET", body?: object): Promise<unknown> {
    const response = await this.transport(path, {
      method,
      credentials: "omit",
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(5000),
      headers: {
        ...(this.handle ? { Authorization: `Bearer ${this.handle}` } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) throw new Error("Local statistics request failed");
    return response.json();
  }

  async connect(profile: ReviewProfile): Promise<void> {
    this.disconnect();
    if (!isOperationalStatisticsProfile(profile)) return;
    const sequence = this.sequence;
    this.state = { ...this.state, status: "CONNECTING", profile, message: "正在连接本机统计服务…" };
    try {
      const bootstrap = await this.request("/local/sessions", "POST", { profile });
      if (sequence !== this.sequence) return;
      if (
        !object(bootstrap) ||
        typeof bootstrap.handle !== "string" ||
        !/^[-\w]{43}$/u.test(bootstrap.handle)
      )
        throw new Error("Invalid local session");
      this.handle = bootstrap.handle;
      const session = await this.request("/local/session");
      if (
        sequence !== this.sequence ||
        !object(session) ||
        session.profile !== profile ||
        !Array.isArray(session.actions) ||
        !session.actions.every((action) => typeof action === "string")
      )
        throw new Error("Invalid local session");
      const actions = session.actions as string[];
      if (actions.includes("statistics:summary")) {
        this.state = {
          ...this.state,
          status: "BUSY",
          mode: "ANONYMOUS",
          message: "正在读取匿名汇总…",
        };
        const data = parseAnonymous(await this.request("/local/statistics-summary"));
        if (sequence !== this.sequence) return;
        this.state = {
          ...this.state,
          ...data,
          status: "READY",
          message: "平台仅显示匿名数量，不提供范围和来源明细。",
        };
      } else if (actions.includes("statistics:read")) {
        this.state = {
          ...this.state,
          status: "BUSY",
          mode: "SCOPED",
          message: "正在读取当前授权范围…",
        };
        await this.readScoped(sequence, this.state.filters);
      } else {
        this.handle = null;
        this.state = {
          ...this.state,
          status: "DENIED",
          mode: null,
          message: "当前身份无权查看运营统计。",
          campusLabel: null,
          classOptions: [],
          totals: zeroTotals(),
          groups: [],
        };
      }
    } catch {
      if (sequence !== this.sequence) return;
      this.fail();
    }
  }

  private async readScoped(sequence: number, filters: StatisticsFilter): Promise<void> {
    if (!this.handle || !validRange(filters)) {
      this.state = {
        ...this.state,
        status: "READY",
        message: "请选择有效的日期范围（最多 31 天）。",
        groups: [],
      };
      return;
    }
    this.state = {
      ...this.state,
      status: "BUSY",
      mode: "SCOPED",
      filters,
      message: "正在更新运营统计…",
    };
    try {
      const query = new URLSearchParams({ from: filters.from, to: filters.to });
      if (filters.classId) query.set("classId", filters.classId);
      const result = parseScoped(await this.request(`/local/statistics?${query.toString()}`));
      if (sequence !== this.sequence) return;
      this.state = {
        ...this.state,
        ...result,
        status: "READY",
        message: "统计范围来自当前登录身份的授权，不接受客户端指定其他校区。",
      };
    } catch {
      if (sequence === this.sequence) this.fail();
    }
  }

  async refresh(): Promise<void> {
    if (!this.handle) return;
    const sequence = this.sequence;
    if (this.state.mode === "ANONYMOUS") {
      this.state = { ...this.state, status: "BUSY", message: "正在刷新匿名汇总…" };
      try {
        const data = parseAnonymous(await this.request("/local/statistics-summary"));
        if (sequence === this.sequence)
          this.state = {
            ...this.state,
            ...data,
            status: "READY",
            message: "平台仅显示匿名数量，不提供范围和来源明细。",
          };
      } catch {
        if (sequence === this.sequence) this.fail();
      }
    } else if (this.state.mode === "SCOPED") {
      await this.readScoped(sequence, this.state.filters);
    }
  }

  async applyFilters(filters: StatisticsFilter): Promise<void> {
    if (this.state.status !== "READY" || this.state.mode !== "SCOPED") return;
    if (
      !validRange(filters) ||
      (filters.classId && !this.state.classOptions.some((option) => option.id === filters.classId))
    ) {
      this.state = {
        ...this.state,
        message: "筛选无效：日期最多 31 天，班级必须在当前授权范围内。",
      };
      return;
    }
    await this.readScoped(this.sequence, filters);
  }

  private fail(): void {
    this.handle = null;
    this.state = {
      ...this.state,
      status: "DISCONNECTED",
      mode: null,
      message: "本机统计连接失败，已清空当前结果；请重新连接后再试。",
      campusLabel: null,
      classOptions: [],
      totals: zeroTotals(),
      groups: [],
    };
  }
}

function totalsHtml(totals: StatisticsTotals): string {
  return `<dl class="review-values"><div><dt>工作任务</dt><dd>${totals.tasks}</dd></div><div><dt>考勤</dt><dd>${totals.attendance}</dd></div><div><dt>接送异常</dt><dd>${totals.pickupExceptions}</dd></div><div><dt>健康异常</dt><dd>${totals.healthIncidents}</dd></div><div><dt>统计总数</dt><dd>${totals.total}</dd></div></dl>`;
}

function scopedHtml(snapshot: AdminStatisticsSnapshot): string {
  const options = snapshot.classOptions
    .map(
      (option) =>
        `<option value="${escape(option.id)}"${option.id === snapshot.filters.classId ? " selected" : ""}>${escape(option.label)}</option>`,
    )
    .join("");
  const filter = `<form class="panel review-filter" data-statistics-filter>
    <label>开始日期<input type="date" name="from" required value="${escape(snapshot.filters.from)}" /></label>
    <label>结束日期<input type="date" name="to" required value="${escape(snapshot.filters.to)}" /></label>
    <label>班级<select name="classId"><option value="">当前授权范围内全部班级</option>${options}</select></label>
    <button type="submit" class="save"${snapshot.status === "BUSY" ? " disabled" : ""}>应用筛选</button>
  </form>`;
  const groups = snapshot.groups
    .map(
      (group) =>
        `<article class="panel" data-statistics-group><h2>${escape(group.date)} · ${escape(group.classLabel)}</h2><p>${KIND_LABELS[group.kind]} · ${escape(STATUS_LABELS[group.status] ?? group.status)} · ${group.count} 条</p><ul>${group.sources
          .map(
            (source) =>
              `<li data-statistics-source="${escape(source.id)}">来源编号 ${escape(source.id)} · 版本 ${source.version} · ${escape(source.kind)} · ${escape(source.date)}</li>`,
          )
          .join("")}</ul></article>`,
    )
    .join("");
  return `<section data-operational-statistics data-statistics-mode="scoped"><h2>当前授权范围统计</h2><p>范围：${escape(snapshot.campusLabel ?? "当前授权校区")}；仅显示汇总及不含学生身份的来源编号。</p>${totalsHtml(snapshot.totals)}${filter}${groups || '<p data-statistics-empty="true">当前筛选条件下暂无统计。</p>'}</section>`;
}

function anonymousHtml(snapshot: AdminStatisticsSnapshot): string {
  return `<section data-operational-statistics data-statistics-mode="anonymous" data-statistics-anonymous="true"><h2>匿名汇总</h2><p>平台只查看本机模拟样本的分类数量，不包含校区、班级、日期、状态或来源明细。</p>${totalsHtml(snapshot.totals)}</section>`;
}

export function renderAdminStatistics(snapshot: AdminStatisticsSnapshot): string {
  const profileOptions = REVIEW_PROFILES.map(
    ([value, label]) =>
      `<option value="${value}"${value === snapshot.profile ? " selected" : ""}>${label}</option>`,
  ).join("");
  const profileForm = `<form class="panel review-connection" data-statistics-profile-form><label for="statistics-profile">当前示例身份</label><select id="statistics-profile" name="profile">${profileOptions}</select><button type="submit" class="save"${snapshot.status === "BUSY" || snapshot.status === "CONNECTING" ? " disabled" : ""}>连接身份</button></form>`;
  const refresh =
    snapshot.status === "READY"
      ? '<button type="button" class="save" data-statistics-refresh>刷新统计</button>'
      : snapshot.profile && snapshot.status === "DISCONNECTED"
        ? '<button type="button" class="save" data-statistics-reconnect>重新连接</button>'
        : "";
  const result =
    snapshot.mode === "SCOPED"
      ? scopedHtml(snapshot)
      : snapshot.mode === "ANONYMOUS"
        ? anonymousHtml(snapshot)
        : "";
  const summary = `<p role="status" data-statistics-status aria-live="polite">${escape(snapshot.message)}</p>`;
  return `<div class="shell"><header class="topbar"><strong class="brand">同芯学园 · 运营统计</strong><nav aria-label="统计导航"><a href="/admin/institution?shared=1&amp;profile=${encodeURIComponent(snapshot.profile ?? "owner-east")}">返回工作台</a></nav></header><main class="review-main" data-statistics-page><h1>运营统计</h1>${profileForm}${summary}${refresh ? `<div class="review-actions">${refresh}</div>` : ""}${snapshot.status === "DENIED" ? '<p class="notice">当前身份无权查看统计内容。</p>' : ""}${result}</main></div>`;
}
