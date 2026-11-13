const API_BASE = "http://127.0.0.1:4317";

export type StaffDailyStatus = "DRAFT" | "SUBMITTED" | "RETURNED" | "CONFIRMED";
export type StaffDailyReviewAction = "CONFIRM" | "RETURN";
export type StaffDailySourceKind =
  "TASK" | "ATTENDANCE" | "CARE_RECORD" | "PICKUP" | "PICKUP_EXCEPTION";
type StaffDailyField = "arrival" | "homework" | "activity" | "classroom" | "followUp";

export interface StaffDailyValues extends Record<StaffDailyField, string> {
  arrival: string;
  homework: string;
  activity: string;
  classroom: string;
  followUp: string;
}

export const STAFF_DAILY_OPTIONS: Readonly<
  Record<StaffDailyField, readonly (readonly [string, string])[]>
> = {
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

export interface StaffDailySession {
  readonly profile: "teacher-east";
  readonly label: string;
  readonly actorId: string;
  readonly tenantId: string;
  readonly campusId: string;
  readonly classIds: readonly string[];
  readonly actions: readonly string[];
}

export interface StaffDailyLearningSummary {
  readonly completedLearnerBand: "2_PLUS";
  readonly usedGuidance: boolean;
  readonly needsTeacherFollowUp: boolean;
}

export interface StaffDailyRow {
  readonly id: string;
  readonly version: number;
  readonly status: StaffDailyStatus;
  readonly date: string;
  readonly values: StaffDailyValues;
  readonly authorLabel: string;
  readonly sourceCounts: Readonly<Record<StaffDailySourceKind, number>>;
  readonly learningSummary: StaffDailyLearningSummary | null;
}

export interface StaffDailySnapshot {
  readonly status: "IDLE" | "CONNECTING" | "BUSY" | "READY" | "ERROR";
  readonly session: StaffDailySession | null;
  readonly rows: readonly StaffDailyRow[];
  readonly message: string;
  readonly error: string | null;
}

export interface StaffDailyClientOptions {
  readonly baseUrl?: string;
  readonly fetcher?: typeof fetch;
}

const fields: readonly StaffDailyField[] = [
  "arrival",
  "homework",
  "activity",
  "classroom",
  "followUp",
];
const statuses = new Set<StaffDailyStatus>(["DRAFT", "SUBMITTED", "RETURNED", "CONFIRMED"]);
const sourceKinds: readonly StaffDailySourceKind[] = [
  "TASK",
  "ATTENDANCE",

  "CARE_RECORD",
  "PICKUP",
  "PICKUP_EXCEPTION",
];
const rowKeys = new Set([
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
const escape = (value: string | number): string =>
  String(value).replace(
    /[&<>"']/gu,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!,
  );

function validValues(value: unknown): value is StaffDailyValues {
  return (
    object(value) &&
    Object.keys(value).length === fields.length &&
    fields.every((field) => STAFF_DAILY_OPTIONS[field].some(([code]) => code === value[field]))
  );
}

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

function parseSession(value: unknown): StaffDailySession {
  if (
    !object(value) ||
    value.mode !== "local-synthetic" ||
    value.profile !== "teacher-east" ||
    !text(value.label) ||
    !uuid(value.actorId) ||
    !uuid(value.tenantId) ||
    !uuid(value.campusId) ||
    !Array.isArray(value.classIds) ||
    value.classIds.length !== 1 ||
    !value.classIds.every(uuid) ||
    !Array.isArray(value.actions) ||
    !value.actions.every(text) ||
    !value.actions.includes("daily:read") ||
    !value.actions.includes("daily:create") ||
    !value.actions.includes("daily:submit")
  )
    throw new Error("当前示例身份不能填写工作日报。");
  return {
    profile: "teacher-east",
    label: value.label,
    actorId: value.actorId,
    tenantId: value.tenantId,
    campusId: value.campusId,
    classIds: value.classIds,
    actions: value.actions,
  };
}

function parseRow(value: unknown, session: StaffDailySession): StaffDailyRow | undefined {
  if (!object(value) || Object.keys(value).some((key) => !rowKeys.has(key))) return undefined;
  const values = object(value.values) ? value.values : null;
  const learningSummary = parseLearningSummary(value.learningSummary);
  if (
    !uuid(value.id) ||
    !Number.isSafeInteger(value.version) ||
    Number(value.version) < 1 ||
    value.kind !== "staffDaily" ||
    value.tenantId !== session.tenantId ||
    value.campusId !== session.campusId ||
    !session.classIds.includes(String(value.classId)) ||
    !uuid(value.classId) ||
    !validDate(value.date) ||
    !statuses.has(value.status as StaffDailyStatus) ||
    value.createdBy !== session.actorId ||
    !text(value.authorLabel) ||
    value.synthetic !== true ||
    learningSummary === undefined ||
    !validValues(values) ||
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
  for (const ref of value.sourceRefs) {
    if (
      !object(ref) ||
      Object.keys(ref).length !== 3 ||
      !sourceKinds.includes(ref.kind as StaffDailySourceKind) ||
      !uuid(ref.id) ||
      !Number.isSafeInteger(ref.version) ||
      Number(ref.version) < 1
    )
      return undefined;
    const key = `${ref.kind}:${ref.id}`;
    if (seen.has(key)) return undefined;
    seen.add(key);
    sourceCounts[ref.kind as StaffDailySourceKind] += 1;
  }
  return {
    id: value.id,
    version: Number(value.version),
    status: value.status as StaffDailyStatus,
    date: value.date,
    values,
    authorLabel: value.authorLabel,
    sourceCounts,
    learningSummary,
  };
}

export function parseStaffDailyRows(value: unknown, session: StaffDailySession): StaffDailyRow[] {
  if (!Array.isArray(value) || value.length > 200) throw new Error("日报列表格式不正确。");
  const rows = value.map((item) => parseRow(item, session));
  if (
    rows.some((row) => row === undefined) ||
    new Set(rows.map((row) => row?.id)).size !== rows.length
  )
    throw new Error("日报超出当前校区或班级范围。");
  return rows as StaffDailyRow[];
}

function allowedRequest(path: string, method: string): boolean {
  if (path === "/local/sessions") return method === "POST";
  if (path === "/local/session" || path === "/local/staff-daily-owned") return method === "GET";
  if (path === "/local/staff-daily-reports") return method === "POST";
  const report =
    /^\/local\/staff-daily-reports\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
      path,
    );
  const command =
    /^\/local\/staff-daily-reports\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/(?:submit|resubmit)$/iu.test(
      path,
    );
  return (report && method === "PATCH") || (command && method === "POST");
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
    throw new Error("工作日报仅允许连接本机服务。");
  const origin = base.origin;
  return async (input, init = {}) => {
    if (typeof input !== "string") return new Response(null, { status: 403 });
    let url: URL;
    try {
      url = new URL(input, origin);
    } catch {
      return new Response(null, { status: 403 });
    }
    const method = init.method ?? "GET";
    if (url.origin !== origin || !allowedRequest(url.pathname, method))
      return new Response(null, { status: 403 });
    return fetcher(url, { ...init, credentials: "omit", cache: "no-store", redirect: "error" });
  };
}

export function createStaffDailyProxyTransport(
  baseUrl: string,
  fetcher: typeof fetch = globalThis.fetch.bind(globalThis),
): typeof fetch {
  const guarded = createLocalStaffDailyTransport(baseUrl, (input, init) => {
    const url = new URL(String(input), baseUrl);
    url.pathname = "/staff-local" + url.pathname.slice("/local".length);
    return fetcher(url, init);
  });
  return (input, init) => guarded(input instanceof URL ? input.href : input, init);
}

const statusLabels: Record<StaffDailyStatus, string> = {
  DRAFT: "草稿",
  SUBMITTED: "待负责人审核",
  RETURNED: "已退回修改",
  CONFIRMED: "已确认",
};
const fieldLabels: Record<StaffDailyField, string> = {
  arrival: "到校状态",
  homework: "作业整理",
  activity: "活动参与",
  classroom: "班级秩序",
  followUp: "后续安排",
};

function optionHtml(field: StaffDailyField, selected?: string): string {
  return STAFF_DAILY_OPTIONS[field]
    .map(
      ([code, label]) =>
        `<option value="${code}"${code === selected ? " selected" : ""}>${escape(label)}</option>`,
    )
    .join("");
}

function sourceSummary(row: StaffDailyRow): string {
  const count = row.sourceCounts;
  return `<p>来源记录：任务 ${count.TASK} · 考勤 ${count.ATTENDANCE} · 托管记录 ${count.CARE_RECORD} · 接送 ${count.PICKUP} · 异常 ${count.PICKUP_EXCEPTION}</p>`;
}

function learningSummary(row: StaffDailyRow): string {
  const summary = row.learningSummary;
  if (!summary) return "";
  return `<p>固定题学习摘要（本机合成）：2 人及以上已完成练习；${summary.usedGuidance ? "使用过分步提示" : "未使用分步提示"}；${summary.needsTeacherFollowUp ? "有教师跟进提示" : "暂无教师跟进提示"}。</p>`;
}

function rowHtml(row: StaffDailyRow, busy: boolean): string {
  const values = fields
    .map((field) => {
      const label =
        STAFF_DAILY_OPTIONS[field].find(([code]) => code === row.values[field])?.[1] ?? "";
      return `<div><dt>${fieldLabels[field]}</dt><dd>${escape(label)}</dd></div>`;
    })
    .join("");
  const rework =
    row.status === "RETURNED"
      ? `<form data-staff-daily-form="resubmit" data-staff-daily-id="${escape(row.id)}" data-staff-daily-version="${row.version}"><input type="hidden" name="date" value="${escape(row.date)}"><div class="staff-daily-fields">${fields.map((field) => `<label>${fieldLabels[field]}<select name="${field}" required${busy ? " disabled" : ""}>${optionHtml(field, row.values[field])}</select></label>`).join("")}</div><button type="submit"${busy ? " disabled" : ""}>保存并重新提交</button></form>`
      : "";
  const submit =
    row.status === "DRAFT"
      ? `<button type="button" data-staff-daily-action="submit" data-staff-daily-id="${escape(row.id)}" data-staff-daily-version="${row.version}"${busy ? " disabled" : ""}>提交负责人审核</button>`
      : "";
  return `<article class="staff-daily-card" data-staff-daily-row="${escape(row.id)}"><div class="staff-daily-heading"><h3>工作日报 · ${escape(row.date)}</h3><span>${statusLabels[row.status]} · 第 ${row.version} 版</span></div><dl>${values}</dl>${sourceSummary(row)}${learningSummary(row)}${rework}<div class="staff-daily-actions">${submit}</div></article>`;
}

export function renderStaffDailyPanel(snapshot: StaffDailySnapshot): string {
  const session = snapshot.session;
  const busy = snapshot.status === "BUSY" || snapshot.status === "CONNECTING";
  const fieldsHtml = fields
    .map(
      (field) =>
        `<label>${fieldLabels[field]}<select name="${field}" required${busy ? " disabled" : ""}>${optionHtml(field)}</select></label>`,
    )
    .join("");
  const form = session?.actions.includes("daily:create")
    ? `<form class="staff-daily-form" data-staff-daily-form="create"><h3>填写今日工作日报</h3><label>日期<input name="date" type="date" value="${new Date().toISOString().slice(0, 10)}" required></label><div class="staff-daily-fields">${fieldsHtml}</div><button type="submit"${busy ? " disabled" : ""}>保存日报草稿</button></form>`
    : "";
  const rows = snapshot.rows.map((row) => rowHtml(row, busy)).join("");
  return `<section class="staff-daily-panel" data-staff-daily-panel><div class="staff-daily-heading"><div><p>员工内部流程</p><h2>工作日报</h2><span>${session ? `当前身份：${escape(session.label)} · 本校区、本班级范围` : "固定示例员工 · 本机共享资料"}</span></div><button type="button" data-staff-daily-refresh${busy ? " disabled" : ""}>刷新</button></div><p class="staff-daily-status" role="status">${escape(snapshot.error ?? snapshot.message)}</p>${form}<section><h3>我的日报</h3>${rows || '<p class="staff-daily-empty">当前没有工作日报。</p>'}</section><p class="staff-daily-footnote">仅供员工与负责人内部查看；不会发送给家长或写入真实机构。</p></section>`;
}

export function staffDailyFormValues(
  form: HTMLFormElement,
): { date: string; values: StaffDailyValues } | null {
  const data = new FormData(form);
  const date = data.get("date");
  const values = Object.fromEntries(fields.map((field) => [field, data.get(field)]));
  return typeof date === "string" && validDate(date) && validValues(values)
    ? { date, values: values as StaffDailyValues }
    : null;
}

export class StaffDailyClient {
  private handle: string | null = null;
  private generation = 0;
  private value: StaffDailySnapshot = {
    status: "IDLE",
    session: null,
    rows: [],
    message: "连接本机共享服务后填写工作日报。",
    error: null,
  };
  private readonly transport: typeof fetch;

  constructor(options: StaffDailyClientOptions = {}) {
    this.transport = createLocalStaffDailyTransport(options.baseUrl ?? API_BASE, options.fetcher);
  }

  get snapshot(): StaffDailySnapshot {
    return structuredClone(this.value);
  }

  disconnect(): void {
    this.generation += 1;
    this.handle = null;
    this.value = {
      status: "IDLE",
      session: null,
      rows: [],
      message: "已离开工作日报。",
      error: null,
    };
  }

  private async request(path: string, method = "GET", body?: object): Promise<unknown> {
    if (!allowedRequest(path, method)) throw new Error("日报请求不在本机白名单内。");
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
      let message = `本机服务暂不可用（${response.status}）。`;
      try {
        const payload: unknown = await response.json();
        if (object(payload) && typeof payload.code === "string")
          message = "日报状态已变化，请刷新后重试。";
      } catch {
        /* Keep the bounded local-service message. */
      }
      throw new Error(message);
    }
    return response.json();
  }

  async connect(): Promise<void> {
    const generation = ++this.generation;
    this.handle = null;
    this.value = {
      ...this.value,
      status: "CONNECTING",
      session: null,
      rows: [],
      error: null,
      message: "正在连接本机工作日报…",
    };
    try {
      const bootstrap: unknown = await this.request("/local/sessions", "POST", {
        profile: "teacher-east",
      });
      if (generation !== this.generation) return;
      if (
        !object(bootstrap) ||
        typeof bootstrap.handle !== "string" ||
        !/^[\w-]{43}$/u.test(bootstrap.handle)
      )
        throw new Error("本机服务未返回有效的示例会话。");
      this.handle = bootstrap.handle;
      const session = parseSession(await this.request("/local/session"));
      if (generation !== this.generation) return;
      const rows = await this.loadRows(session);
      if (generation !== this.generation) return;
      this.value = {
        status: "READY",
        session,
        rows,
        message: "日报已连接本机共享资料。",
        error: null,
      };
    } catch (error) {
      if (generation !== this.generation) return;
      this.handle = null;
      this.value = {
        ...this.value,
        status: "ERROR",
        session: null,
        rows: [],
        error: error instanceof Error ? error.message : "本机连接失败。",
        message: "工作日报暂时无法连接。",
      };
    }
  }

  async refresh(): Promise<void> {
    const session = this.value.session;
    if (!this.handle || !session || !["READY", "ERROR"].includes(this.value.status)) return;
    const generation = this.generation;
    this.value = {
      ...this.value,
      status: "BUSY",
      rows: [],
      error: null,
      message: "正在刷新工作日报…",
    };
    try {
      const rows = await this.loadRows(session);
      if (generation !== this.generation) return;
      this.value = {
        ...this.value,
        status: "READY",
        rows,
        error: null,
        message: "工作日报已刷新。",
      };
    } catch (error) {
      if (generation !== this.generation) return;
      this.handle = null;
      this.value = {
        ...this.value,
        status: "ERROR",
        session: null,
        rows: [],
        error: error instanceof Error ? error.message : "日报刷新失败。",
        message: "刷新结果未能确认，请重新连接查看。",
      };
    }
  }

  async create(date: string, values: StaffDailyValues): Promise<void> {
    const session = this.value.session;
    if (
      !session ||
      this.value.status !== "READY" ||
      !this.handle ||
      !session.actions.includes("daily:create") ||
      !validDate(date) ||
      !validValues(values)
    )
      return;
    await this.mutate(async (generation) => {
      const row = parseStaffDailyRows(
        [await this.request("/local/staff-daily-reports", "POST", { date, values })],
        session,
      )[0];
      if (!row || row.status !== "DRAFT" || row.version !== 1)
        throw new Error("本机服务返回的日报草稿格式不正确。");
      return generation === this.generation ? this.loadRows(session) : null;
    }, "日报草稿已保存。");
  }

  async edit(id: string, version: number, values: StaffDailyValues): Promise<void> {
    const row = this.value.rows.find((item) => item.id === id);
    const session = this.value.session;
    if (
      !session ||
      this.value.status !== "READY" ||
      !this.handle ||
      !row ||
      row.version !== version ||
      row.status !== "DRAFT" ||
      !session.actions.includes("daily:create") ||
      !validValues(values)
    )
      return;
    await this.mutate(async (generation) => {
      const next = parseStaffDailyRows(
        [
          await this.request(`/local/staff-daily-reports/${encodeURIComponent(id)}`, "PATCH", {
            version,
            values,
          }),
        ],
        session,
      )[0];
      if (!next || next.id !== id || next.version !== version + 1 || next.status !== "DRAFT")
        throw new Error("本机服务返回的日报草稿修改结果不正确。");
      return generation === this.generation ? this.loadRows(session) : null;
    }, "日报草稿已保存。");
  }

  async submit(id: string, version: number): Promise<void> {
    const row = this.value.rows.find((item) => item.id === id);
    const session = this.value.session;
    if (
      !session ||
      this.value.status !== "READY" ||
      !this.handle ||
      !row ||
      row.version !== version ||
      row.status !== "DRAFT" ||
      !session.actions.includes("daily:submit")
    )
      return;
    await this.mutate(async (generation) => {
      const next = parseStaffDailyRows(
        [
          await this.request(
            `/local/staff-daily-reports/${encodeURIComponent(id)}/submit`,
            "POST",
            { version },
          ),
        ],
        session,
      )[0];
      if (!next || next.id !== id || next.version !== version + 1 || next.status !== "SUBMITTED")
        throw new Error("本机服务返回的日报提交结果不正确。");
      return generation === this.generation ? this.loadRows(session) : null;
    }, "日报已提交负责人审核。");
  }

  async resubmit(id: string, version: number, values: StaffDailyValues): Promise<void> {
    const row = this.value.rows.find((item) => item.id === id);
    const session = this.value.session;
    if (
      !session ||
      this.value.status !== "READY" ||
      !this.handle ||
      !row ||
      row.version !== version ||
      row.status !== "RETURNED" ||
      !session.actions.includes("daily:submit") ||
      !validValues(values)
    )
      return;
    await this.mutate(async (generation) => {
      const next = parseStaffDailyRows(
        [
          await this.request(
            `/local/staff-daily-reports/${encodeURIComponent(id)}/resubmit`,
            "POST",
            { version, values },
          ),
        ],
        session,
      )[0];
      if (!next || next.id !== id || next.version !== version + 1 || next.status !== "SUBMITTED")
        throw new Error("本机服务返回的日报重新提交结果不正确。");
      return generation === this.generation ? this.loadRows(session) : null;
    }, "修改已提交负责人复核。");
  }

  private async mutate(
    operation: (generation: number) => Promise<StaffDailyRow[] | null>,
    message: string,
  ): Promise<void> {
    const generation = this.generation;
    this.value = { ...this.value, status: "BUSY", error: null, message: "正在保存工作日报…" };
    try {
      const rows = await operation(generation);
      if (generation !== this.generation || rows === null) return;
      this.value = { ...this.value, status: "READY", rows, error: null, message };
    } catch (error) {
      if (generation !== this.generation) return;
      this.handle = null;
      this.value = {
        ...this.value,
        status: "ERROR",
        session: null,
        rows: [],
        error: error instanceof Error ? error.message : "日报更新失败。",
        message: "日报操作结果未能确认，请重新连接查看，勿重复提交。",
      };
    }
  }

  private async loadRows(session: StaffDailySession): Promise<StaffDailyRow[]> {
    return parseStaffDailyRows(await this.request("/local/staff-daily-owned"), session);
  }
}
