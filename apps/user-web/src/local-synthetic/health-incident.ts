export type HealthIncidentRole = "teacher" | "parent";
export type HealthIncidentAction = "edit" | "submit" | "withdraw" | "read" | "ack";

const API_BASE = "http://127.0.0.1:4317";
const PROFILE: Readonly<Record<HealthIncidentRole, string>> = {
  teacher: "teacher-east",
  parent: "parent-alpha",
};
const OBSERVATIONS = [
  ["ROUTINE_OBSERVATION", "日常状态观察"],
  ["NEEDS_FOLLOW_UP", "需要跟进"],
  ["URGENT_REVIEW", "需要尽快复核"],
] as const;
const DISPOSITIONS = [
  ["OBSERVATION_RECHECKED", "已重新核对观察"],
  ["FOLLOW_UP_SCHEDULED", "已安排跟进"],
  ["GUARDIAN_SUMMARY_PREPARED", "已准备家长摘要"],
] as const;
const STAFF_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "RETURNED",
  "CONFIRMED",
  "EXCEPTION_PENDING",
  "PUBLISHED",
  "REVOKED",
  "WITHDRAWN",
] as const;

type ObservationCode = (typeof OBSERVATIONS)[number][0];
type DispositionCode = (typeof DISPOSITIONS)[number][0];
type StaffStatus = (typeof STAFF_STATUSES)[number];
type HealthRecord = StaffHealthRecord | ParentHealthRecord;

interface StaffHealthRecord {
  readonly id: string;
  readonly version: number;
  readonly status: StaffStatus;
  readonly statusLabel: string;
  readonly studentLabel: string;
  readonly observationCode: ObservationCode;
  readonly observationLabel: string;
  readonly dispositionCode: DispositionCode | null;
  readonly dispositionLabel: string | null;
  readonly createdBy: string;
  readonly synthetic: true;
}

interface ParentHealthRecord {
  readonly id: string;
  readonly version: number;
  readonly status: "PUBLISHED";
  readonly title: string;
  readonly date: string;
  readonly parentSummary: string;
  readonly receiptStatus: "UNREAD" | "READ" | "ACKNOWLEDGED";
  readonly synthetic: true;
}

export interface HealthIncidentSnapshot {
  readonly role: HealthIncidentRole;
  readonly status: "IDLE" | "CONNECTING" | "BUSY" | "READY" | "ERROR";
  readonly actorId: string | null;
  readonly records: readonly HealthRecord[];
  readonly message: string;
}

export interface HealthIncidentClientOptions {
  readonly baseUrl?: string;
  readonly fetcher?: typeof fetch;
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOption<T extends string>(
  value: unknown,
  options: readonly (readonly [T, string])[],
): value is T {
  return typeof value === "string" && options.some(([code]) => code === value);
}

function parseStaff(value: unknown): StaffHealthRecord | null {
  if (
    !object(value) ||
    typeof value.id !== "string" ||
    !Number.isSafeInteger(value.version) ||
    typeof value.status !== "string" ||
    !(STAFF_STATUSES as readonly string[]).includes(value.status) ||
    typeof value.statusLabel !== "string" ||
    typeof value.studentLabel !== "string" ||
    !isOption(value.observationCode, OBSERVATIONS) ||
    typeof value.observationLabel !== "string" ||
    (value.dispositionCode !== null && !isOption(value.dispositionCode, DISPOSITIONS)) ||
    (value.dispositionLabel !== null && typeof value.dispositionLabel !== "string") ||
    typeof value.createdBy !== "string" ||
    value.synthetic !== true
  )
    return null;
  return value as unknown as StaffHealthRecord;
}

function parseParent(value: unknown): ParentHealthRecord | null {
  if (
    !object(value) ||
    typeof value.id !== "string" ||
    !Number.isSafeInteger(value.version) ||
    value.status !== "PUBLISHED" ||
    typeof value.title !== "string" ||
    typeof value.date !== "string" ||
    typeof value.parentSummary !== "string" ||
    !["UNREAD", "READ", "ACKNOWLEDGED"].includes(String(value.receiptStatus)) ||
    value.synthetic !== true
  )
    return null;
  return value as unknown as ParentHealthRecord;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/gu, (character) => {
    const replacements: Readonly<Record<string, string>> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return replacements[character] ?? character;
  });
}

function select(
  name: string,
  values: readonly (readonly [string, string])[],
  selected?: string,
  disabled = false,
): string {
  const options = values
    .map(
      ([code, label]) =>
        `<option value="${code}"${selected === code ? " selected" : ""}>${escapeHtml(label)}</option>`,
    )
    .join("");
  return `<label>${name === "observationCode" ? "固定观察项" : "固定处置项"}<select name="${name}"${disabled ? " disabled" : ""}>${options}</select></label>`;
}

export class HealthIncidentClient {
  private readonly baseUrl: string;
  private readonly fetcher: typeof fetch;
  private generation = 0;
  private handle: string | null = null;
  private value: HealthIncidentSnapshot;

  constructor(
    readonly role: HealthIncidentRole,
    options: HealthIncidentClientOptions = {},
  ) {
    const base = new URL(options.baseUrl ?? API_BASE);
    if (
      base.protocol !== "http:" ||
      !["127.0.0.1", "localhost"].includes(base.hostname) ||
      base.port === "" ||
      base.username !== "" ||
      base.password !== ""
    )
      throw new Error("Only a loopback local service is allowed.");
    this.baseUrl = base.origin;
    this.fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
    this.value = {
      role,
      status: "IDLE",
      actorId: null,
      records: [],
      message: "连接本机共享健康记录后查看。",
    };
  }

  get snapshot(): HealthIncidentSnapshot {
    return this.value;
  }

  disconnect(): void {
    this.generation += 1;
    this.handle = null;
    this.value = {
      role: this.role,
      status: "IDLE",
      actorId: null,
      records: [],
      message: "本机健康记录连接已关闭。",
    };
  }

  async connect(): Promise<void> {
    this.disconnect();
    const generation = this.generation;
    this.value = { ...this.value, status: "CONNECTING", message: "正在连接本机共享健康记录…" };
    try {
      const created = await this.request("/local/sessions", {
        method: "POST",
        body: JSON.stringify({ profile: PROFILE[this.role] }),
      });
      if (
        !object(created) ||
        typeof created.handle !== "string" ||
        !/^[\w-]{43}$/u.test(created.handle)
      )
        throw new Error("INVALID_SESSION");
      const handle = created.handle;
      const session = await this.request("/local/session", { handle });
      const required =
        this.role === "teacher"
          ? ["health:create", "health:submit"]
          : ["health:read", "health:ack"];
      if (
        !object(session) ||
        session.mode !== "local-synthetic" ||
        session.profile !== PROFILE[this.role] ||
        typeof session.actorId !== "string" ||
        !Array.isArray(session.actions) ||
        required.some((action) => !(session.actions as unknown[]).includes(action))
      )
        throw new Error("UNAVAILABLE");
      if (generation !== this.generation) return;
      this.handle = handle;
      this.value = { ...this.value, actorId: session.actorId, status: "READY" };
      await this.load(generation);
    } catch {
      if (generation !== this.generation) return;
      this.handle = null;
      this.value = {
        ...this.value,
        status: "ERROR",
        actorId: null,
        records: [],
        message: "本机健康记录服务暂不可用；当前页面未保存任何资料。",
      };
    }
  }

  async refresh(): Promise<void> {
    if (!this.handle || this.value.status !== "READY") return;
    const generation = this.generation;
    this.value = { ...this.value, status: "BUSY", message: "正在更新本机健康记录…" };
    try {
      await this.load(generation);
    } catch {
      if (generation !== this.generation) return;
      this.value = {
        ...this.value,
        status: "ERROR",
        records: [],
        message: "更新失败，已隐藏当前健康记录。",
      };
    }
  }

  async create(observationCode: string, dispositionCode: string): Promise<void> {
    if (
      this.role !== "teacher" ||
      this.value.status !== "READY" ||
      !isOption(observationCode, OBSERVATIONS) ||
      !isOption(dispositionCode, DISPOSITIONS)
    )
      return;
    await this.mutate("/local/health-incidents", {
      method: "POST",
      body: JSON.stringify({
        student: "student-alpha",
        observationCode,
        dispositionCode,
      }),
    });
  }

  async command(
    action: HealthIncidentAction,
    id: string,
    fields: { observationCode?: string; dispositionCode?: string } = {},
  ): Promise<void> {
    if (this.value.status !== "READY" || !this.handle) return;
    const row = this.value.records.find((item) => item.id === id);
    if (!row || row.version < 1) return;
    const body: Record<string, unknown> = { version: row.version };
    if (this.role === "teacher") {
      if (!("createdBy" in row) || row.createdBy !== this.value.actorId) return;
      if (action === "edit") {
        if (!("statusLabel" in row) || !["DRAFT", "RETURNED"].includes(row.status)) return;
        if (
          !isOption(fields.observationCode, OBSERVATIONS) ||
          !isOption(fields.dispositionCode, DISPOSITIONS)
        )
          return;
        body.observationCode = fields.observationCode;
        body.dispositionCode = fields.dispositionCode;
      } else if (action === "submit" || action === "withdraw") {
        if (
          !("statusLabel" in row) ||
          !["DRAFT", "RETURNED", ...(action === "withdraw" ? ["SUBMITTED"] : [])].includes(
            row.status,
          )
        )
          return;
      } else return;
    } else {
      if (!("receiptStatus" in row) || (action !== "read" && action !== "ack")) return;
      if (
        (action === "read" && row.receiptStatus !== "UNREAD") ||
        (action === "ack" && row.receiptStatus !== "READ")
      )
        return;
    }
    await this.mutate(`/local/health-incidents/${encodeURIComponent(id)}/${action}`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  private async mutate(path: string, init: RequestInit): Promise<void> {
    const generation = this.generation;
    this.value = { ...this.value, status: "BUSY", message: "正在处理本机健康记录…" };
    try {
      await this.request(path, {
        ...init,
        ...(this.handle ? { handle: this.handle } : {}),
      });
      await this.load(generation);
    } catch {
      if (generation !== this.generation) return;
      this.value = {
        ...this.value,
        status: "ERROR",
        records: [],
        message: "操作未完成；请刷新后重新核对记录。",
      };
    }
  }

  private async load(generation: number): Promise<void> {
    const path =
      this.role === "teacher" ? "/local/health-incident-owned" : "/local/health-incidents";
    const rows = await this.request(path, this.handle ? { handle: this.handle } : {});
    if (!Array.isArray(rows)) throw new Error("INVALID_RECORDS");
    const parsed = rows.map((row) =>
      this.role === "teacher" ? parseStaff(row) : parseParent(row),
    );
    if (parsed.some((row) => row === null)) throw new Error("INVALID_RECORDS");
    if (generation !== this.generation) return;
    this.value = {
      ...this.value,
      status: "READY",
      records: parsed as HealthRecord[],
      message:
        parsed.length === 0 ? "当前授权范围没有可显示的健康记录。" : "已更新本机共享健康记录。",
    };
  }

  private async request(path: string, init: RequestInit & { handle?: string }): Promise<unknown> {
    const { handle, ...requestInit } = init;
    const headers = new Headers(requestInit.headers);
    headers.set("Accept", "application/json");
    if (requestInit.body !== undefined) headers.set("Content-Type", "application/json");
    if (handle) headers.set("Authorization", `Bearer ${handle}`);
    const response = await this.fetcher(new URL(path, this.baseUrl), {
      ...requestInit,
      credentials: "omit",
      cache: "no-store",
      redirect: "error",
      headers,
    });
    if (!response.ok) throw new Error(`HTTP_${response.status}`);
    return response.json();
  }
}

export function renderHealthIncidentPanel(snapshot: HealthIncidentSnapshot): string {
  const actions = (action: HealthIncidentAction, row: HealthRecord, label: string) =>
    `<button type="button" class="button button-light" data-health-action="${action}" data-health-id="${escapeHtml(row.id)}"${snapshot.status === "READY" ? "" : " disabled"}>${label}</button>`;
  const records = snapshot.records
    .map((row) => {
      if (snapshot.role === "parent" && "receiptStatus" in row) {
        const opened = row.receiptStatus !== "UNREAD";
        return `<article class="content-card" data-health-record="${escapeHtml(row.id)}"><h3>${escapeHtml(row.title)}</h3><p>${escapeHtml(row.date)} · 仅显示已发布摘要</p>${opened ? `<p>${escapeHtml(row.parentSummary)}</p>` : "<p>有一条已发布的健康跟进摘要，打开后可查看内容。</p>"}<p>家长回执：${row.receiptStatus === "UNREAD" ? "尚未查看" : row.receiptStatus === "READ" ? "已查看，尚未确认" : "已确认知悉"}</p>${row.receiptStatus === "UNREAD" ? actions("read", row, "查看摘要") : row.receiptStatus === "READ" ? actions("ack", row, "我已知悉") : ""}</article>`;
      }
      if (!("createdBy" in row)) return "";
      const owner = row.createdBy === snapshot.actorId;
      const editable = owner && (row.status === "DRAFT" || row.status === "RETURNED");
      const controls = editable
        ? `<div class="shared-fields">${select("observationCode", OBSERVATIONS, row.observationCode, snapshot.status !== "READY")}${select("dispositionCode", DISPOSITIONS, row.dispositionCode ?? undefined, snapshot.status !== "READY")}</div><div class="shared-actions">${actions("edit", row, "保存修改")}${actions("submit", row, "提交审核")}${actions("withdraw", row, "撤回记录")}</div>`
        : owner && row.status === "SUBMITTED"
          ? actions("withdraw", row, "撤回记录")
          : "";
      return `<article class="content-card" data-health-record="${escapeHtml(row.id)}"><h3>${escapeHtml(row.studentLabel)} · ${escapeHtml(row.statusLabel)}</h3><p>固定观察项：${escapeHtml(row.observationLabel)}</p><p>固定处置项：${escapeHtml(row.dispositionLabel ?? "尚未选择")}</p>${controls}</article>`;
    })
    .join("");
  const create =
    snapshot.role === "teacher"
      ? `<form class="content-card" data-health-create><h3>上报健康观察</h3><p>仅可选择固定观察项和处置项，不填写自由文本。</p>${select("observationCode", OBSERVATIONS, undefined, snapshot.status !== "READY")}${select("dispositionCode", DISPOSITIONS, undefined, snapshot.status !== "READY")}<button class="button button-primary" type="submit"${snapshot.status === "READY" ? "" : " disabled"}>创建记录</button></form>`
      : "";
  const refresh = `<button type="button" class="button button-light" data-health-refresh${snapshot.status === "CONNECTING" || snapshot.status === "BUSY" ? " disabled" : ""}>刷新记录</button>`;
  return `<section class="contact-intent-state" aria-label="健康记录共享流程"><p class="section-kicker">健康记录 · 本机共享</p><h2>${snapshot.role === "teacher" ? "健康观察记录" : "健康跟进摘要"}</h2><p role="status" aria-live="polite">${escapeHtml(snapshot.message)}</p>${refresh}${create}${records || (snapshot.status === "READY" ? `<article class="content-card"><p>${snapshot.role === "teacher" ? "尚无记录。可从上方固定选项创建一条记录。" : "当前没有已发布的健康跟进摘要。"}</p></article>` : "")}</section>`;
}
