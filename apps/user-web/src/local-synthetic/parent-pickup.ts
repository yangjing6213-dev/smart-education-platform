export type ParentPickupStatus = "IDLE" | "CONNECTING" | "READY" | "BUSY" | "ERROR";
export type ParentPickupRecipient = "pickup-alpha" | "pickup-beta";
export type ParentPickupAuthorizationType = "REGULAR" | "TEMPORARY";

export interface ParentPickupBinding {
  readonly id: string;
  readonly version: number;
  readonly studentId: string;
  readonly studentLabel: string;
  readonly classLabel: string;
}

export interface ParentPickupAuthorization {
  readonly id: string;
  readonly version: number;
  readonly status: "DRAFT" | "ACTIVE" | "REVOKED" | "COMPLETED";
  readonly currentlyValid: boolean;
  readonly bindingId: string;
  readonly studentId: string;
  readonly studentLabel: string;
  readonly classLabel: string;
  readonly recipient: ParentPickupRecipient;
  readonly recipientLabel: string;
  readonly type: ParentPickupAuthorizationType;
  readonly startDate: string;
  readonly endDate: string;
  readonly startTime: string;
  readonly endTime: string;
}

export interface ParentPickupRecord {
  readonly id: string;
  readonly date: string;
  readonly time: string;
  readonly studentLabel: string;
  readonly recipient: string;
}

export interface ParentPickupCredential {
  readonly authorizationId: string;
  readonly expiresAt: string;
  readonly value: string;
}

export interface ParentPickupSnapshot {
  readonly status: ParentPickupStatus;
  readonly bindings: readonly ParentPickupBinding[];
  readonly authorizations: readonly ParentPickupAuthorization[];
  readonly records: readonly ParentPickupRecord[];
  readonly credential: ParentPickupCredential | null;
  readonly historyFrom: string;
  readonly historyTo: string;
  readonly message: string;
}

export interface ParentPickupInput {
  readonly bindingId: string;
  readonly recipient: ParentPickupRecipient;
  readonly type: ParentPickupAuthorizationType;
  readonly startDate: string;
  readonly endDate: string;
  readonly startTime: string;
  readonly endTime: string;
}

interface ParentPickupClientOptions {
  readonly baseUrl: string;
  readonly fetcher?: typeof fetch;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const DATE = /^\d{4}-\d{2}-\d{2}$/u;
const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/u;
const MAX_PICKUP_WINDOW_DAYS = 90;
const MAX_CREDENTIAL_LIFETIME_MS = 5 * 60 * 1000 + 30 * 1000;
const EMPTY: ParentPickupSnapshot = {
  status: "IDLE",
  bindings: [],
  authorizations: [],
  records: [],
  credential: null,
  historyFrom: "",
  historyTo: "",
  message: "请使用家长邀请账号登录后查看接送安排。",
};

const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown, max = 80): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= max;
const version = (value: unknown): value is number =>
  Number.isSafeInteger(value) && Number(value) > 0;
const date = (value: unknown): value is string => {
  if (typeof value !== "string" || !DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};
const time = (value: unknown): value is string => typeof value === "string" && TIME.test(value);
function shanghaiToday(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}
function dateOrdinal(value: string): number {
  return Date.parse(`${value}T00:00:00.000Z`);
}

function sameOrigin(value: string): string {
  const url = new URL(value);
  const localHttp =
    url.protocol === "http:" &&
    ["127.0.0.1", "localhost"].includes(url.hostname) &&
    url.port !== "";
  if (
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    !(url.protocol === "https:" || localHttp)
  )
    throw new Error("接送资料只能通过安全的同源网页读取。");
  return url.origin;
}

function parseBindings(value: unknown): ParentPickupBinding[] {
  if (!Array.isArray(value)) throw new Error("INVALID_BINDINGS");
  return value.flatMap((row) => {
    if (!object(row) || row.status !== "APPROVED") return [];
    if (
      typeof row.id !== "string" ||
      !UUID.test(row.id) ||
      !version(row.version) ||
      typeof row.studentId !== "string" ||
      !UUID.test(row.studentId) ||
      !text(row.studentLabel) ||
      !text(row.classLabel)
    )
      throw new Error("INVALID_BINDING");
    return [
      {
        id: row.id,
        version: row.version,
        studentId: row.studentId,
        studentLabel: row.studentLabel,
        classLabel: row.classLabel,
      },
    ];
  });
}

function parseAuthorizations(
  value: unknown,
  bindings: readonly ParentPickupBinding[],
): ParentPickupAuthorization[] {
  if (!Array.isArray(value)) throw new Error("INVALID_AUTHORIZATIONS");
  const bindingsById = new Map(bindings.map((row) => [row.id, row]));
  return value.flatMap((row) => {
    if (!object(row) || typeof row.bindingId !== "string") return [];
    const binding = bindingsById.get(row.bindingId);
    if (!binding) return [];
    if (
      typeof row.studentId === "string" &&
      UUID.test(row.studentId) &&
      row.studentId !== binding.studentId
    )
      return [];
    if (
      typeof row.id !== "string" ||
      !UUID.test(row.id) ||
      !version(row.version) ||
      !["DRAFT", "ACTIVE", "REVOKED", "COMPLETED"].includes(String(row.status)) ||
      typeof row.currentlyValid !== "boolean" ||
      typeof row.studentId !== "string" ||
      !UUID.test(row.studentId) ||
      !["pickup-alpha", "pickup-beta"].includes(String(row.recipient)) ||
      !text(row.recipientLabel) ||
      !["REGULAR", "TEMPORARY"].includes(String(row.type)) ||
      !date(row.startDate) ||
      !date(row.endDate) ||
      !time(row.startTime) ||
      !time(row.endTime)
    )
      throw new Error("INVALID_AUTHORIZATION");
    return [
      {
        id: row.id,
        version: row.version,
        status: row.status as ParentPickupAuthorization["status"],
        currentlyValid: row.currentlyValid,
        bindingId: row.bindingId,
        studentId: binding.studentId,
        studentLabel: binding.studentLabel,
        classLabel: binding.classLabel,
        recipient: row.recipient as ParentPickupRecipient,
        recipientLabel: row.recipientLabel,
        type: row.type as ParentPickupAuthorizationType,
        startDate: row.startDate,
        endDate: row.endDate,
        startTime: row.startTime,
        endTime: row.endTime,
      },
    ];
  });
}

function parseRecords(
  value: unknown,
  bindings: readonly ParentPickupBinding[],
): ParentPickupRecord[] {
  if (!Array.isArray(value)) throw new Error("INVALID_RECORDS");
  const studentIds = new Set(bindings.map((row) => row.studentId));
  return value.flatMap((row) => {
    if (!object(row) || typeof row.studentId !== "string" || !studentIds.has(row.studentId))
      return [];
    if (
      typeof row.id !== "string" ||
      !UUID.test(row.id) ||
      !date(row.date) ||
      !time(row.time) ||
      !text(row.studentLabel) ||
      !text(row.recipient) ||
      row.status !== "COMPLETED"
    )
      throw new Error("INVALID_RECORD");
    return [
      {
        id: row.id,
        date: row.date,
        time: row.time,
        studentLabel: row.studentLabel,
        recipient: row.recipient,
      },
    ];
  });
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

const authorizationStatus = (row: ParentPickupAuthorization): string => {
  if (row.status === "DRAFT") return "待确认";
  if (row.status === "REVOKED") return "已撤销";
  if (row.status === "COMPLETED") return "已完成";
  return row.currentlyValid ? "已生效" : "已到期";
};

export class ParentPickupClient {
  private readonly baseUrl: string;
  private readonly fetcher: typeof fetch;
  private generation = 0;
  private credentialExpiryTimer: ReturnType<typeof setTimeout> | null = null;
  private credentialExpiryListener: (() => void) | null = null;
  private value: ParentPickupSnapshot = EMPTY;

  constructor(options: ParentPickupClientOptions) {
    this.baseUrl = sameOrigin(options.baseUrl);
    this.fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
  }

  get snapshot(): ParentPickupSnapshot {
    return this.value;
  }

  setCredentialExpiryListener(listener: (() => void) | null): void {
    this.credentialExpiryListener = listener;
  }

  disconnect(): void {
    this.clearCredentialExpiryTimer();
    this.generation += 1;
    this.value = EMPTY;
    this.credentialExpiryListener?.();
    this.credentialExpiryListener = null;
  }

  async connect(): Promise<void> {
    this.clearCredentialExpiryTimer();
    this.generation += 1;
    this.value = EMPTY;
    const generation = this.generation;
    this.value = {
      ...EMPTY,
      status: "CONNECTING",
      message: "正在确认邀请账号并读取接送资料…",
    };
    try {
      if (generation !== this.generation) return;
      await this.load(generation);
    } catch {
      this.fail(generation, "请使用家长邀请账号登录；如关系尚未审核通过，接送资料会保持隐藏。");
    }
  }

  async refresh(): Promise<void> {
    if (this.value.status !== "READY") return;
    this.clearCredentialExpiryTimer();
    const generation = this.generation;
    this.value = { ...this.value, status: "BUSY", credential: null, message: "正在更新接送记录…" };
    try {
      await this.load(generation);
    } catch {
      this.fail(generation, "更新失败，已隐藏接送明细；请重新读取后再试。");
    }
  }

  async create(input: ParentPickupInput): Promise<void> {
    if (this.value.status !== "READY") return;
    const binding = this.value.bindings.find((row) => row.id === input.bindingId);
    if (
      !binding ||
      !["pickup-alpha", "pickup-beta"].includes(input.recipient) ||
      !["REGULAR", "TEMPORARY"].includes(input.type)
    ) {
      this.value = { ...this.value, message: "请选择已审核的孩子、接送人和授权类型。" };
      return;
    }
    if (
      !date(input.startDate) ||
      !date(input.endDate) ||
      input.endDate < input.startDate ||
      input.endDate < shanghaiToday() ||
      dateOrdinal(input.endDate) - dateOrdinal(input.startDate) >
        MAX_PICKUP_WINDOW_DAYS * 86400000 ||
      (input.type === "TEMPORARY" && input.startDate !== input.endDate)
    ) {
      this.value = {
        ...this.value,
        message: "结束日期不能早于今天，日期范围最多90天；临时授权仅限同一天。",
      };
      return;
    }
    if (!time(input.startTime) || !time(input.endTime) || input.startTime > input.endTime) {
      this.value = { ...this.value, message: "请检查接送时间，结束时间不能早于开始时间。" };
      return;
    }
    await this.mutate("/api-local/parent/pickup/authorizations", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async activate(id: string, expectedVersion: number): Promise<void> {
    const row = this.findAuthorization(id, expectedVersion);
    if (!row || row.status !== "DRAFT") return;
    await this.mutate(
      `/api-local/parent/pickup/authorizations/${encodeURIComponent(id)}/activate`,
      {
        method: "POST",
        body: JSON.stringify({ version: row.version }),
      },
    );
  }

  async revoke(id: string, expectedVersion: number): Promise<void> {
    const row = this.findAuthorization(id, expectedVersion);
    if (!row || row.status !== "ACTIVE") return;
    await this.mutate(`/api-local/parent/pickup/authorizations/${encodeURIComponent(id)}/revoke`, {
      method: "POST",
      body: JSON.stringify({ version: row.version }),
    });
  }

  async issueCredential(id: string, expectedVersion: number): Promise<void> {
    const row = this.findAuthorization(id, expectedVersion);
    if (!row || row.status !== "ACTIVE" || !row.currentlyValid) return;
    this.clearCredentialExpiryTimer();
    const generation = this.generation;
    this.value = {
      ...this.value,
      status: "BUSY",
      credential: null,
      message: "正在生成当前页面凭证…",
    };
    try {
      const result = await this.request(
        `/api-local/parent/pickup/authorizations/${encodeURIComponent(id)}/credential`,
        { method: "POST", body: JSON.stringify({ version: row.version }) },
      );
      const expiresAt =
        object(result) && typeof result.expiresAt === "string"
          ? Date.parse(result.expiresAt)
          : Number.NaN;
      if (
        !object(result) ||
        result.authorizationId !== id ||
        typeof result.expiresAt !== "string" ||
        !Number.isFinite(expiresAt) ||
        expiresAt <= Date.now() ||
        expiresAt - Date.now() > MAX_CREDENTIAL_LIFETIME_MS ||
        typeof result.credential !== "string" ||
        !/^[A-Za-z0-9_-]{43}$/u.test(result.credential)
      )
        throw new Error("INVALID_CREDENTIAL");
      await this.load(generation);
      if (generation !== this.generation) return;
      const currentAuthorization = this.value.authorizations.find((row) => row.id === id);
      if (
        currentAuthorization?.version !== expectedVersion ||
        currentAuthorization.status !== "ACTIVE" ||
        !currentAuthorization.currentlyValid
      ) {
        this.value = {
          ...this.value,
          message: "授权已变化，凭证未显示；请重新核对接送安排。",
        };
        return;
      }
      const remainingLifetime = expiresAt - Date.now();
      if (remainingLifetime <= 0) throw new Error("EXPIRED_CREDENTIAL");
      const credentialValue = result.credential;
      this.value = {
        ...this.value,
        credential: {
          authorizationId: id,
          expiresAt: result.expiresAt,
          value: result.credential,
        },
        message: "凭证只在当前页面临时显示；离开页面后需要重新生成。",
      };
      this.credentialExpiryTimer = setTimeout(() => {
        this.credentialExpiryTimer = null;
        if (
          this.value.credential?.authorizationId !== id ||
          this.value.credential.value !== credentialValue
        )
          return;
        this.value = {
          ...this.value,
          credential: null,
          message: "临时凭证已过期，已自动隐藏；如仍需核验请重新生成。",
        };
        this.credentialExpiryListener?.();
      }, remainingLifetime);
    } catch {
      this.fail(generation, "凭证生成失败或授权已变化；请刷新后重新核对。");
    }
  }

  setHistoryFilter(from: string, to: string): void {
    const historyFrom = from === "" || date(from) ? from : "";
    const historyTo = to === "" || date(to) ? to : "";
    this.value = { ...this.value, historyFrom, historyTo };
  }

  private findAuthorization(id: string, expectedVersion: number) {
    if (this.value.status !== "READY" || !UUID.test(id)) return undefined;
    const row = this.value.authorizations.find((item) => item.id === id);
    return row?.version === expectedVersion ? row : undefined;
  }

  private async mutate(path: string, init: RequestInit): Promise<void> {
    if (this.value.status !== "READY") return;
    this.clearCredentialExpiryTimer();
    const generation = this.generation;
    this.value = { ...this.value, status: "BUSY", credential: null, message: "正在保存接送安排…" };
    try {
      await this.request(path, init);
      await this.load(generation);
    } catch {
      this.fail(generation, "操作未完成；请刷新后重新核对接送安排。");
    }
  }

  private clearCredentialExpiryTimer(): void {
    if (this.credentialExpiryTimer !== null) clearTimeout(this.credentialExpiryTimer);
    this.credentialExpiryTimer = null;
  }

  private async load(generation: number): Promise<void> {
    const projection = await this.request("/api-local/parent/pickup", { method: "GET" });
    if (!object(projection)) throw new Error("INVALID_PICKUP_PROJECTION");
    const bindings = parseBindings(projection.bindings);
    const authorizations = parseAuthorizations(projection.authorizations, bindings);
    const records = parseRecords(projection.records, bindings);
    if (generation !== this.generation) return;
    this.value = {
      ...this.value,
      status: "READY",
      bindings,
      authorizations,
      records,
      credential: null,
      message:
        bindings.length === 0
          ? "尚无已审核的孩子关系；审核通过后可新增接送授权。"
          : "仅显示当前邀请账号已审核关系内的模拟接送资料。",
    };
  }

  private fail(generation: number, message: string): void {
    if (generation !== this.generation) return;
    this.clearCredentialExpiryTimer();
    this.value = { ...EMPTY, status: "ERROR", message };
  }

  private async request(path: string, init: RequestInit): Promise<unknown> {
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    if (init.body !== undefined) headers.set("Content-Type", "application/json");
    const response = await this.fetcher(new URL(path, this.baseUrl), {
      ...init,
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(5000),
      headers,
    });
    if (!response.ok) throw new Error(`HTTP_${response.status}`);
    const envelope: unknown = await response.json();
    if (!object(envelope) || !("data" in envelope)) throw new Error("INVALID_RESPONSE");
    return envelope.data;
  }
}

export function renderParentPickupPanel(snapshot: ParentPickupSnapshot): string {
  const disabled = snapshot.status === "READY" ? "" : " disabled";
  const bindings = snapshot.bindings
    .map(
      (row) =>
        `<option value="${escapeHtml(row.id)}">${escapeHtml(row.studentLabel)} · ${escapeHtml(row.classLabel)}</option>`,
    )
    .join("");
  const authorizations = snapshot.authorizations.length
    ? snapshot.authorizations
        .map((row) => {
          const actions =
            row.status === "DRAFT"
              ? `<button type="button" class="button button-primary" data-parent-pickup-action="activate" data-id="${escapeHtml(row.id)}" data-version="${row.version}"${disabled}>确认接送授权</button>`
              : row.status === "ACTIVE"
                ? `<div class="pickup-parent-actions">${row.currentlyValid ? `<button type="button" class="button button-primary" data-parent-pickup-action="credential" data-id="${escapeHtml(row.id)}" data-version="${row.version}"${disabled}>生成现场凭证</button>` : ""}<button type="button" class="button button-light" data-parent-pickup-action="revoke" data-id="${escapeHtml(row.id)}" data-version="${row.version}"${disabled}>撤销授权</button></div>`
                : "";
          return `<article class="pickup-parent-card" data-parent-pickup-id="${escapeHtml(row.id)}"><p class="pickup-parent-kicker">${row.type === "TEMPORARY" ? "临时授权" : "常用授权"} · ${authorizationStatus(row)}</p><h3>${escapeHtml(row.studentLabel)} · ${escapeHtml(row.recipientLabel)}</h3><p>${escapeHtml(row.startDate)} 至 ${escapeHtml(row.endDate)}，每天 ${escapeHtml(row.startTime)}–${escapeHtml(row.endTime)}</p>${actions}</article>`;
        })
        .join("")
    : '<p class="pickup-parent-empty">当前没有接送授权。</p>';
  const recordRows = snapshot.records.filter(
    (row) =>
      (!snapshot.historyFrom || row.date >= snapshot.historyFrom) &&
      (!snapshot.historyTo || row.date <= snapshot.historyTo),
  );
  const records = recordRows.length
    ? `<ul>${recordRows.map((row) => `<li><strong>${escapeHtml(row.studentLabel)}</strong><span>${escapeHtml(row.date)} ${escapeHtml(row.time)} · ${escapeHtml(row.recipient)}</span></li>`).join("")}</ul>`
    : '<p class="pickup-parent-empty">暂无符合日期的接送记录。</p>';
  const form = snapshot.bindings.length
    ? `<form class="pickup-parent-card pickup-parent-form" data-parent-pickup-form><h3>新增接送安排</h3><label>孩子<select name="bindingId" required${disabled}>${bindings}</select></label><label>接送人<select name="recipient" required${disabled}><option value="pickup-alpha">示例接送人甲</option><option value="pickup-beta">示例接送人乙</option></select></label><label>授权类型<select name="type" required${disabled}><option value="TEMPORARY">临时授权</option><option value="REGULAR">常用授权</option></select></label><div class="pickup-parent-fields"><label>开始日期<input name="startDate" type="date" required${disabled}></label><label>结束日期<input name="endDate" type="date" required${disabled}></label><label>开始时间<input name="startTime" type="time" required${disabled}></label><label>结束时间<input name="endTime" type="time" required${disabled}></label></div><button type="submit" class="button button-primary"${disabled}>保存接送安排</button></form>`
    : `<p class="pickup-parent-empty">尚无已审核的孩子关系，当前不能创建接送授权。</p>`;
  const credential = snapshot.credential
    ? `<aside class="pickup-parent-credential" role="status"><strong>现场凭证已生成</strong><span>仅当前页面显示，${escapeHtml(snapshot.credential.expiresAt)} 前有效。</span><code>${escapeHtml(snapshot.credential.value)}</code></aside>`
    : "";
  const reconnect =
    snapshot.status === "ERROR"
      ? `<button type="button" class="button button-light" data-parent-pickup-reconnect>重新读取</button>`
      : `<button type="button" class="button button-light" data-parent-pickup-refresh${disabled}>刷新接送记录</button>`;
  return `<section class="pickup-parent" aria-labelledby="parent-pickup-title" data-parent-pickup-panel><div class="pickup-parent-heading"><div><p class="eyebrow">邀请账号 · 家长服务</p><h2 id="parent-pickup-title">接送安排</h2></div>${reconnect}</div><p class="pickup-parent-note">仅展示邀请账号可查看的模拟资料。现场接送仍由员工核对，页面不会发送真实通知。</p><p class="pickup-parent-message" role="status" tabindex="-1">${escapeHtml(snapshot.message)}</p>${authorizations}${credential}${form}<div class="pickup-parent-history"><div><h3>接送历史</h3><p>只查看当前已审核孩子的已完成记录。</p></div><div class="pickup-parent-fields pickup-parent-date-filter"><label>开始日期<input name="historyFrom" type="date" value="${escapeHtml(snapshot.historyFrom)}"></label><label>结束日期<input name="historyTo" type="date" value="${escapeHtml(snapshot.historyTo)}"></label></div>${records}</div></section>`;
}
