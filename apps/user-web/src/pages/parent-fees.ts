export type ParentFeeDocument = {
  readonly id: string;
  readonly title: string;
  readonly documentType: "FEE_ITEM" | "BILL" | "RECEIPT" | "AGREEMENT";
  readonly studentId: string;
  readonly studentAlias: string;
  readonly studentLabel: string;
  readonly period: string;
  readonly amount: number | null;
  readonly currency: "CNY" | null;
  readonly status: "AVAILABLE" | "PAID" | "VOIDED" | "EXPIRED" | "REVOKED";
  readonly available: boolean;
  readonly summary?: string;
  readonly unavailableReason?: string;
};

export type ParentFeeLedgerEntry = {
  readonly id: string;
  readonly type: "CHARGE" | "PAYMENT" | "REFUND";
  readonly amountMinor: number;
  readonly currency: "CNY";
  readonly studentAlias: string;
  readonly studentLabel: string;
  readonly period: string;
  readonly occurredOn: string;
};

export type ParentFeeLedger = {
  readonly entries: readonly ParentFeeLedgerEntry[];
  readonly reconciliation: {
    readonly chargeMinor: number;
    readonly paymentMinor: number;
    readonly refundMinor: number;
    readonly balanceDueMinor: number;
  };
};

export type ParentFeesSnapshot = {
  readonly status: "IDLE" | "CONNECTING" | "READY" | "BUSY" | "DENIED" | "ERROR";
  readonly bindingStatus: "NONE" | "PENDING" | "APPROVED" | "ENDED";
  readonly documents: readonly ParentFeeDocument[];
  readonly ledger: ParentFeeLedger | null;
  readonly message: string;
};

export interface ParentFeesClientOptions {
  readonly baseUrl?: string;
  readonly fetcher?: typeof fetch;
}

const API_BASE = "http://127.0.0.1:4317";
const PARENT_PROFILE = "parent-alpha";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const IDENTIFIER =
  /^(?:[a-z0-9](?:[a-z0-9-]{0,118}[a-z0-9])?|[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{12})$/iu;
const STUDENT_ALIAS = /^student-[a-z0-9-]{1,64}$/iu;
const FEE_TYPES = ["FEE_ITEM", "BILL", "RECEIPT", "AGREEMENT"] as const;
const FEE_STATUSES = ["AVAILABLE", "PAID", "VOIDED", "EXPIRED", "REVOKED"] as const;
const LEDGER_TYPES = ["CHARGE", "PAYMENT", "REFUND"] as const;

class ParentFeesError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/u.test(value) &&
    Number.isFinite(Date.parse(`${value}T00:00:00.000Z`))
  );
}

function safeText(value: unknown, max = 240): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= max;
}

export function projectBinding(value: unknown): ParentFeesSnapshot["bindingStatus"] {
  if (!Array.isArray(value) || value.length > 50) throw new ParentFeesError("INVALID_BINDINGS");
  if (
    !value.every(
      (row) =>
        record(row) &&
        typeof row.id === "string" &&
        UUID.test(row.id) &&
        row.relationship === "GUARDIAN" &&
        typeof row.studentAlias === "string" &&
        STUDENT_ALIAS.test(row.studentAlias) &&
        ["PENDING", "APPROVED", "REJECTED", "WITHDRAWN", "RELEASED", "EXPIRED"].includes(String(row.status)) &&
        (row.status !== "APPROVED" || safeText(row.studentLabel, 80)),
    )
  )
    throw new ParentFeesError("INVALID_BINDINGS");

  const rows = value;
  if (rows.some((row) => row.status === "APPROVED")) return "APPROVED";
  if (rows.some((row) => row.status === "PENDING")) return "PENDING";
  if (rows.some((row) => row.status === "RELEASED" || row.status === "WITHDRAWN" || row.status === "EXPIRED")) return "ENDED";
  return "NONE";
}

export function approvedStudentAliases(value: unknown): ReadonlySet<string> {
  projectBinding(value);
  if (!Array.isArray(value)) return new Set();
  return new Set(
    value
      .filter((row) => record(row) && row.status === "APPROVED")
      .map((row) => String((row as Record<string, unknown>).studentAlias)),
  );
}

export function approvedStudentLabels(value: unknown): ReadonlyMap<string, string> {
  projectBinding(value);
  if (!Array.isArray(value)) return new Map();
  return new Map(
    value
      .filter((row) => record(row) && row.status === "APPROVED")
      .map((row) => {
        const binding = row as Record<string, unknown>;
        return [String(binding.studentAlias), String(binding.studentLabel)] as const;
      }),
  );
}

export function projectDocuments(value: unknown): ParentFeeDocument[] {
  if (!Array.isArray(value) || value.length > 200) throw new ParentFeesError("INVALID_FEES");
  const rows = value.map((row): ParentFeeDocument | null => {
    if (
      !record(row) ||
      !IDENTIFIER.test(String(row.id)) ||
      !Number.isSafeInteger(row.version) ||
      !UUID.test(String(row.studentId)) ||
      typeof row.studentAlias !== "string" ||
      !STUDENT_ALIAS.test(row.studentAlias) ||
      !safeText(row.studentLabel, 80) ||
      !FEE_TYPES.includes(row.documentType as (typeof FEE_TYPES)[number]) ||
      !safeText(row.title, 120) ||
      !safeText(row.period, 80) ||
      (row.amount !== null &&
        (typeof row.amount !== "number" || !Number.isFinite(row.amount) || row.amount < 0)) ||
      (row.currency !== "CNY" && row.currency !== null) ||
      !FEE_STATUSES.includes(row.status as (typeof FEE_STATUSES)[number]) ||
      !Number.isSafeInteger(row.sourceVersion) ||
      !validDate(row.validFrom) ||
      !validDate(row.validTo) ||
      typeof row.available !== "boolean" ||
      row.synthetic !== true ||
      (row.summary !== undefined && !safeText(row.summary, 500)) ||
      (row.unavailableReason !== undefined && !safeText(row.unavailableReason, 200)) ||
      (row.available
        ? (row.status !== "AVAILABLE" && row.status !== "PAID") || !safeText(row.summary, 500)
        : !safeText(row.unavailableReason, 200))
    )
      return null;

    return {
      id: String(row.id),
      title: row.title,
      documentType: row.documentType as ParentFeeDocument["documentType"],
      studentId: String(row.studentId),
      studentAlias: row.studentAlias,
      studentLabel: row.studentLabel as string,
      period: row.period,
      amount: row.amount as number | null,
      currency: row.currency as "CNY" | null,
      status: row.status as ParentFeeDocument["status"],
      available: row.available,
      ...(row.summary === undefined ? {} : { summary: row.summary as string }),
      ...(row.unavailableReason === undefined
        ? {}
        : { unavailableReason: row.unavailableReason as string }),
    };
  });
  if (rows.some((row) => row === null)) throw new ParentFeesError("INVALID_FEES");
  return rows as ParentFeeDocument[];
}

export function projectLedger(value: unknown): ParentFeeLedger {
  if (
    !record(value) ||
    Object.keys(value).sort().join(",") !== "entries,reconciliation,scope,synthetic" ||
    value.scope !== "parent" ||
    value.synthetic !== true ||
    !Array.isArray(value.entries) ||
    value.entries.length > 200 ||
    !record(value.reconciliation) ||
    Object.keys(value.reconciliation).sort().join(",") !==
      "balanceDueMinor,chargeMinor,currency,paymentMinor,refundMinor"
  )
    throw new ParentFeesError("INVALID_LEDGER");

  const entries = value.entries.map((row): ParentFeeLedgerEntry | null => {
    if (
      !record(row) ||
      Object.keys(row).length !== 11 ||
      !IDENTIFIER.test(String(row.id)) ||
      !LEDGER_TYPES.includes(row.type as (typeof LEDGER_TYPES)[number]) ||
      !Number.isSafeInteger(row.amountMinor) ||
      Number(row.amountMinor) < 0 ||
      row.currency !== "CNY" ||
      typeof row.period !== "string" ||
      !/^\d{4}-(?:0[1-9]|1[0-2])$/u.test(row.period) ||
      !validDate(row.occurredOn) ||
      !IDENTIFIER.test(String(row.documentId)) ||
      !Number.isSafeInteger(row.documentVersion) ||
      Number(row.documentVersion) < 1 ||
      typeof row.studentAlias !== "string" ||
      !STUDENT_ALIAS.test(row.studentAlias) ||
      !safeText(row.studentLabel, 80) ||
      row.synthetic !== true
    )
      return null;
    return {
      id: String(row.id),
      type: row.type as ParentFeeLedgerEntry["type"],
      amountMinor: Number(row.amountMinor),
      currency: "CNY",
      studentAlias: row.studentAlias,
      studentLabel: row.studentLabel as string,
      period: row.period,
      occurredOn: row.occurredOn,
    };
  });
  const summary = value.reconciliation;
  if (
    entries.some((entry) => entry === null) ||
    new Set(entries.map((entry) => entry?.id)).size !== entries.length ||
    summary.currency !== "CNY" ||
    ![
      summary.chargeMinor,
      summary.paymentMinor,
      summary.refundMinor,
      summary.balanceDueMinor,
    ].every((amount) => Number.isSafeInteger(amount) && Number(amount) >= 0)
  )
    throw new ParentFeesError("INVALID_LEDGER");

  const typedEntries = entries as ParentFeeLedgerEntry[];
  const totals = typedEntries.reduce(
    (result, row) => {
      result[row.type] += row.amountMinor;
      return result;
    },
    { CHARGE: 0, PAYMENT: 0, REFUND: 0 },
  );
  if (
    totals.CHARGE !== summary.chargeMinor ||
    totals.PAYMENT !== summary.paymentMinor ||
    totals.REFUND !== summary.refundMinor ||
    Math.max(totals.CHARGE - totals.PAYMENT + totals.REFUND, 0) !== summary.balanceDueMinor
  )
    throw new ParentFeesError("INVALID_LEDGER_TOTALS");

  return {
    entries: typedEntries,
    reconciliation: {
      chargeMinor: Number(summary.chargeMinor),
      paymentMinor: Number(summary.paymentMinor),
      refundMinor: Number(summary.refundMinor),
      balanceDueMinor: Number(summary.balanceDueMinor),
    },
  };
}

const EMPTY_SNAPSHOT: ParentFeesSnapshot = {
  status: "IDLE",
  bindingStatus: "NONE",
  documents: [],
  ledger: null,
  message: "连接本机家长服务后查看合成费用资料。",
};

export class ParentFeesClient {
  private readonly baseUrl: string;
  private readonly fetcher: typeof fetch;
  private generation = 0;
  private handle: string | null = null;
  private value = EMPTY_SNAPSHOT;

  constructor(options: ParentFeesClientOptions = {}) {
    const baseUrl = new URL(options.baseUrl ?? API_BASE);
    if (
      baseUrl.protocol !== "http:" ||
      !["127.0.0.1", "localhost"].includes(baseUrl.hostname) ||
      baseUrl.port === "" ||
      baseUrl.username !== "" ||
      baseUrl.password !== ""
    )
      throw new Error("Only a loopback local service is allowed.");
    this.baseUrl = baseUrl.origin;
    this.fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
  }

  get snapshot(): ParentFeesSnapshot {
    return this.value;
  }

  disconnect(): void {
    this.generation += 1;
    this.handle = null;
    this.value = EMPTY_SNAPSHOT;
  }

  async connect(): Promise<void> {
    this.disconnect();
    const generation = this.generation;
    this.value = { ...EMPTY_SNAPSHOT, status: "CONNECTING", message: "正在连接本机家长服务…" };
    try {
      const created = await this.request("/local/sessions", {
        method: "POST",
        body: JSON.stringify({ profile: PARENT_PROFILE }),
      });
      if (
        !record(created) ||
        typeof created.handle !== "string" ||
        !/^[\w-]{43}$/u.test(created.handle)
      )
        throw new ParentFeesError("INVALID_SESSION");
      const handle = created.handle;
      const session = await this.request("/local/session", { handle });
      if (
        !record(session) ||
        session.mode !== "local-synthetic" ||
        session.profile !== PARENT_PROFILE ||
        !Array.isArray(session.actions) ||
        !session.actions.includes("fees:read")
      )
        throw new ParentFeesError("UNAVAILABLE");
      if (generation !== this.generation) return;
      this.handle = handle;
      await this.load(generation);
    } catch {
      if (generation !== this.generation) return;
      this.handle = null;
      this.value = {
        ...EMPTY_SNAPSHOT,
        status: "ERROR",
        message: "暂时无法连接本机服务，请确认本机演示服务已启动后重试。",
      };
    }
  }

  async refresh(): Promise<void> {
    if (!this.handle || this.value.status !== "READY") return;
    const generation = this.generation;
    this.value = { ...this.value, status: "BUSY", message: "正在更新本机费用摘要…" };
    try {
      await this.load(generation);
    } catch {
      if (generation !== this.generation) return;
      this.value = {
        ...EMPTY_SNAPSHOT,
        status: "ERROR",
        message: "本机费用资料暂不可用，已隐藏明细；请重新连接后再试。",
      };
    }
  }

  private async load(generation: number): Promise<void> {
    const handle = this.handle;
    if (!handle) throw new ParentFeesError("UNAVAILABLE");
    const bindingValue = await this.request("/local/binding-applications", { handle });
    const bindingStatus = projectBinding(bindingValue);
    if (generation !== this.generation) return;
    if (bindingStatus !== "APPROVED") {
      this.value = {
        status: "READY",
        bindingStatus,
        documents: [],
        ledger: null,
        message:
          bindingStatus === "PENDING"
            ? "监护关系正在审核；审核通过后可查看费用资料。"
            : "当前没有已审核的监护关系，暂不能查看费用资料。",
      };
      return;
    }
    const approvedLabels = approvedStudentLabels(bindingValue);
    const [feeValue, ledgerValue] = await Promise.all([
      this.request("/local/fees", { handle }),
      this.request("/local/fee-ledger", { handle }),
    ]);
    const documents = projectDocuments(feeValue);
    const ledger = projectLedger(ledgerValue);
    if (
      documents.some((row) => approvedLabels.get(row.studentAlias) !== row.studentLabel) ||
      ledger.entries.some((row) => approvedLabels.get(row.studentAlias) !== row.studentLabel)
    )
      throw new ParentFeesError("CROSS_CHILD_FEES");
    if (generation !== this.generation) return;
    this.value = {
      status: "READY",
      bindingStatus,
      documents,
      ledger,
      message: "仅显示当前已审核合成关系内的只读资料；不代表真实收付款。",
    };
  }

  private async request(
    path: string,
    options: RequestInit & { handle?: string },
  ): Promise<unknown> {
    const { handle, ...init } = options;
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    if (init.body !== undefined) headers.set("Content-Type", "application/json");
    if (handle) headers.set("Authorization", `Bearer ${handle}`);
    const response = await this.fetcher(new URL(path, this.baseUrl), {
      ...init,
      cache: "no-store",
      redirect: "error",
      headers,
    });
    let value: unknown;
    try {
      value = await response.json();
    } catch {
      throw new ParentFeesError("INVALID_RESPONSE");
    }
    if (!response.ok) throw new ParentFeesError("REQUEST_FAILED");
    return value;
  }
}

function escapeHtml(value: string | number): string {
  return String(value).replace(/[&<>"']/gu, (character) => {
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

function money(amount: number | null, currency: "CNY" | null): string {
  return amount === null || currency === null ? "未单列金额" : `${currency} ${amount.toFixed(2)}`;
}

function formatMinor(amount: number): string {
  return `CNY ${(amount / 100).toFixed(2)}`;
}

const documentLabels: Record<ParentFeeDocument["documentType"], string> = {
  FEE_ITEM: "收费项目",
  BILL: "账单",
  RECEIPT: "收据",
  AGREEMENT: "服务协议",
};
const statusLabels: Record<ParentFeeDocument["status"], string> = {
  AVAILABLE: "可查看",
  PAID: "已记录",
  VOIDED: "已作废",
  EXPIRED: "已过期",
  REVOKED: "已撤回",
};
const ledgerLabels: Record<ParentFeeLedgerEntry["type"], string> = {
  CHARGE: "收费记录",
  PAYMENT: "入账记录",
  REFUND: "退款记录",
};

export function renderParentFeesPage(snapshot: ParentFeesSnapshot): string {
  const documents =
    snapshot.bindingStatus !== "APPROVED"
      ? ""
      : snapshot.documents.length
        ? snapshot.documents
            .map(
              (row) =>
                `<article class="content-card fee-card"><p class="section-kicker">${escapeHtml(documentLabels[row.documentType])} · ${escapeHtml(statusLabels[row.status])}</p><h2>${escapeHtml(row.title)}</h2><p>${escapeHtml(row.period)} · ${escapeHtml(money(row.amount, row.currency))}</p><p>${escapeHtml(row.available ? (row.summary ?? "仅展示合成资料摘要。") : (row.unavailableReason ?? "当前不可查看。"))}</p></article>`,
            )
            .join("")
        : '<p class="content-card">当前关系内暂无可查看费用资料。</p>';
  const ledger =
    snapshot.bindingStatus !== "APPROVED" || snapshot.ledger === null
      ? ""
      : `<section class="content-card fee-ledger" aria-labelledby="parent-fee-ledger-title"><h2 id="parent-fee-ledger-title">费用流水</h2><dl><div><dt>收费</dt><dd>${formatMinor(snapshot.ledger.reconciliation.chargeMinor)}</dd></div><div><dt>入账</dt><dd>${formatMinor(snapshot.ledger.reconciliation.paymentMinor)}</dd></div><div><dt>退款记录</dt><dd>${formatMinor(snapshot.ledger.reconciliation.refundMinor)}</dd></div><div><dt>待核对差额</dt><dd>${formatMinor(snapshot.ledger.reconciliation.balanceDueMinor)}</dd></div></dl><ol>${snapshot.ledger.entries.map((row) => `<li>${escapeHtml(row.occurredOn)} · ${escapeHtml(ledgerLabels[row.type])} · ${formatMinor(row.amountMinor)}</li>`).join("") || "<li>暂无流水记录。</li>"}</ol></section>`;
  const relationNotice =
    snapshot.bindingStatus === "PENDING"
      ? "监护关系审核通过后，才能查看对应费用资料。"
      : snapshot.bindingStatus === "APPROVED"
        ? "当前监护关系已审核。"
        : "当前没有已审核的监护关系。";
  return `<main class="internal-main parent-fees-main" id="main-content"><div class="internal-page-heading"><p class="section-kicker">家长服务 · 费用与流水</p><h1>费用资料</h1><p>只读查看本机合成费用记录，不收款、不退款、不签署协议，也不连接真实机构。</p></div><p class="parent-consent-status" role="status" aria-live="polite">${escapeHtml(snapshot.message)}</p><section class="content-card"><p class="section-kicker">关系状态 · ${snapshot.bindingStatus === "APPROVED" ? "已审核" : "待审核或未绑定"}</p><p>${relationNotice}</p></section>${snapshot.status === "BUSY" || snapshot.status === "CONNECTING" ? '<p aria-live="polite">正在读取本机资料…</p>' : ""}${snapshot.status === "ERROR" ? '<button class="button button-primary" type="button" data-parent-fees-reconnect>重新连接</button>' : ""}${snapshot.status === "READY" ? '<button class="button button-light" type="button" data-parent-fees-refresh>刷新费用</button>' : ""}<section class="parent-fees-documents" aria-label="合成费用资料">${documents}</section>${ledger}<p class="parent-consent-footnote">所有金额和记录均为合成示例，不代表真实收付款；页面不提供支付、退款或签署操作。</p><a class="button button-light" href="/web/parent/binding">返回家长服务</a></main>`;
}
