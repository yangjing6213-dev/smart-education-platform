import { createLocalMediaTransport } from "./media-assets.js";

export type AdminFeesProfile = "owner-east" | "owner-west" | "platform-admin";
type FeeDocumentType = "FEE_ITEM" | "BILL" | "RECEIPT" | "AGREEMENT";

export type FeeSummary = {
  readonly scope: "campus" | "platform";
  readonly synthetic: true;
  readonly totalDocuments: number;
  readonly activeDocuments: number;
  readonly paidDocuments: number;
  readonly unavailableDocuments: number;
  readonly documentTypes: readonly FeeDocumentType[];
  readonly amountTotal?: number;
  readonly amountCurrency?: "CNY";
};

export type FeeLedgerSummary =
  | {
      readonly scope: "campus";
      readonly synthetic: true;
      readonly entryCount: number;
      readonly countsByType: {
        readonly CHARGE: number;
        readonly PAYMENT: number;
        readonly REFUND: number;
      };
      readonly chargeMinor: number;
      readonly paymentMinor: number;
      readonly refundMinor: number;
      readonly balanceDueMinor: number;
      readonly currency: "CNY";
    }
  | {
      readonly scope: "platform";
      readonly synthetic: true;
      readonly entryCount: number;
      readonly countsByType: {
        readonly CHARGE: number;
        readonly PAYMENT: number;
        readonly REFUND: number;
      };
    };

export type AdminFeesSnapshot = {
  readonly status: "IDLE" | "CONNECTING" | "READY" | "BUSY" | "ERROR";
  readonly profile: AdminFeesProfile | null;
  readonly summary: FeeSummary | null;
  readonly ledgerSummary: FeeLedgerSummary | null;
  readonly message: string;
};

const PROFILES: readonly (readonly [AdminFeesProfile, string])[] = [
  ["owner-east", "东校区负责人"],
  ["owner-west", "西校区负责人"],
  ["platform-admin", "平台管理员（仅匿名汇总）"],
];
const DOCUMENT_TYPES: readonly FeeDocumentType[] = ["FEE_ITEM", "BILL", "RECEIPT", "AGREEMENT"];
const SUMMARY_KEYS = [
  "activeDocuments",
  "documentTypes",
  "paidDocuments",
  "scope",
  "synthetic",
  "totalDocuments",
  "unavailableDocuments",
];
const CAMPUS_SUMMARY_KEYS = [...SUMMARY_KEYS, "amountCurrency", "amountTotal"].sort().join(",");
const BASE_SUMMARY_KEYS = SUMMARY_KEYS.slice().sort().join(",");
const LEDGER_KEYS = "CHARGE,PAYMENT,REFUND";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCount(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function isAdminFeesProfile(value: unknown): value is AdminFeesProfile {
  return PROFILES.some(([profile]) => profile === value);
}

function parseSummary(value: unknown, profile: AdminFeesProfile): FeeSummary {
  if (!isRecord(value)) throw new Error("汇总格式无效。");
  const expectedScope = profile === "platform-admin" ? "platform" : "campus";
  const keys = Object.keys(value).sort().join(",");
  if (
    value.scope !== expectedScope ||
    value.synthetic !== true ||
    keys !== (expectedScope === "platform" ? BASE_SUMMARY_KEYS : CAMPUS_SUMMARY_KEYS) ||
    !isCount(value.totalDocuments) ||
    !isCount(value.activeDocuments) ||
    !isCount(value.paidDocuments) ||
    !isCount(value.unavailableDocuments) ||
    value.activeDocuments + value.unavailableDocuments !== value.totalDocuments ||
    value.paidDocuments > value.activeDocuments ||
    !Array.isArray(value.documentTypes) ||
    !value.documentTypes.every((type) => DOCUMENT_TYPES.includes(type as FeeDocumentType)) ||
    new Set(value.documentTypes).size !== value.documentTypes.length
  )
    throw new Error("费用汇总与当前身份范围不一致。");
  if (
    expectedScope === "campus" &&
    (typeof value.amountTotal !== "number" ||
      !Number.isFinite(value.amountTotal) ||
      value.amountTotal < 0 ||
      value.amountCurrency !== "CNY")
  )
    throw new Error("校区费用汇总金额无效。");
  return value as FeeSummary;
}

function parseLedgerSummary(value: unknown, profile: AdminFeesProfile): FeeLedgerSummary {
  if (!isRecord(value) || !isRecord(value.countsByType)) throw new Error("流水汇总格式无效。");
  const counts = value.countsByType;
  const expectedScope = profile === "platform-admin" ? "platform" : "campus";
  const keys = Object.keys(value).sort().join(",");
  const expectedKeys =
    expectedScope === "platform"
      ? "countsByType,entryCount,scope,synthetic"
      : "balanceDueMinor,chargeMinor,countsByType,currency,entryCount,paymentMinor,refundMinor,scope,synthetic";
  if (
    value.scope !== expectedScope ||
    value.synthetic !== true ||
    keys !== expectedKeys ||
    Object.keys(counts).sort().join(",") !== LEDGER_KEYS ||
    ![counts.CHARGE, counts.PAYMENT, counts.REFUND].every(isCount) ||
    !isCount(value.entryCount) ||
    Number(counts.CHARGE) + Number(counts.PAYMENT) + Number(counts.REFUND) !== value.entryCount
  )
    throw new Error("流水汇总与当前身份范围不一致。");
  if (expectedScope === "platform") return value as FeeLedgerSummary;
  if (
    ![value.chargeMinor, value.paymentMinor, value.refundMinor, value.balanceDueMinor].every(
      isCount,
    ) ||
    value.currency !== "CNY" ||
    Math.max(
      Number(value.chargeMinor) - Number(value.paymentMinor) + Number(value.refundMinor),
      0,
    ) !== value.balanceDueMinor
  )
    throw new Error("校区流水金额核对失败。");
  return value as FeeLedgerSummary;
}

const EMPTY_SNAPSHOT: AdminFeesSnapshot = {
  status: "IDLE",
  profile: null,
  summary: null,
  ledgerSummary: null,
  message: "选择本机演示身份后，查看对应范围的只读费用汇总。",
};

export class AdminFeesClient {
  private readonly fetcher: typeof fetch;
  private generation = 0;
  private handle: string | null = null;
  private value: AdminFeesSnapshot = EMPTY_SNAPSHOT;

  constructor(servicePort: number | null, fetcher: typeof fetch = fetch.bind(globalThis)) {
    this.fetcher = createLocalMediaTransport(servicePort, fetcher);
  }

  get snapshot(): AdminFeesSnapshot {
    return this.value;
  }

  disconnect(): void {
    this.generation += 1;
    this.handle = null;
    this.value = EMPTY_SNAPSHOT;
  }

  async connect(profile: AdminFeesProfile): Promise<void> {
    if (!isAdminFeesProfile(profile)) return;
    this.disconnect();
    const generation = this.generation;
    this.value = {
      ...EMPTY_SNAPSHOT,
      status: "CONNECTING",
      profile,
      message: "正在连接本机合成服务…",
    };
    try {
      const created = await this.request("/local/sessions", {
        method: "POST",
        body: JSON.stringify({ profile }),
      });
      if (
        !isRecord(created) ||
        typeof created.handle !== "string" ||
        !/^[A-Za-z0-9_-]{43}$/u.test(created.handle)
      )
        throw new Error("本机身份会话无效。");
      const handle = created.handle;
      const session = await this.request("/local/session", { handle });
      if (
        !isRecord(session) ||
        session.mode !== "local-synthetic" ||
        session.profile !== profile ||
        typeof session.actorId !== "string" ||
        !UUID.test(session.actorId) ||
        !Array.isArray(session.actions) ||
        !session.actions.every((action) => typeof action === "string") ||
        (profile !== "platform-admin" && !session.actions.includes("fees:summary"))
      )
        throw new Error("本机身份没有对应费用汇总权限。");
      if (generation !== this.generation) return;
      this.handle = handle;
      await this.load(generation, profile);
    } catch {
      if (generation !== this.generation) return;
      this.handle = null;
      this.value = {
        status: "ERROR",
        profile,
        summary: null,
        ledgerSummary: null,
        message: "本机费用汇总暂不可用，已隐藏数据；请检查服务与身份范围后重试。",
      };
    }
  }

  async refresh(): Promise<void> {
    const profile = this.value.profile;
    if (!this.handle || this.value.status !== "READY" || !profile) return;
    const generation = this.generation;
    this.value = { ...this.value, status: "BUSY", message: "正在刷新本机费用汇总…" };
    try {
      await this.load(generation, profile);
    } catch {
      if (generation !== this.generation) return;
      this.value = {
        status: "ERROR",
        profile,
        summary: null,
        ledgerSummary: null,
        message: "本机费用汇总暂不可用，已隐藏数据；请重新连接后重试。",
      };
    }
  }

  private async load(generation: number, profile: AdminFeesProfile): Promise<void> {
    const handle = this.handle;
    if (!handle) throw new Error("当前没有本机会话。");
    const [summaryValue, ledgerValue] = await Promise.all([
      this.request("/local/fee-summary", { handle }),
      this.request("/local/fee-ledger-summary", { handle }),
    ]);
    const summary = parseSummary(summaryValue, profile);
    const ledgerSummary = parseLedgerSummary(ledgerValue, profile);
    if (generation !== this.generation) return;
    this.value = {
      status: "READY",
      profile,
      summary,
      ledgerSummary,
      message:
        profile === "platform-admin"
          ? "平台身份仅查看匿名数量和类型，不显示金额或学生/账单明细。"
          : "仅显示当前校区的合成费用汇总，不显示学生或账单明细。",
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
    const response = await this.fetcher(path, {
      ...init,
      cache: "no-store",
      redirect: "error",
      headers,
    });
    let value: unknown;
    try {
      value = await response.json();
    } catch {
      throw new Error("本机服务返回内容无效。");
    }
    if (!response.ok) throw new Error("本机服务暂不可用。");
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

function countItems(summary: FeeSummary): string {
  const types = summary.documentTypes.map(
    (type) =>
      ({
        FEE_ITEM: "费用项目",
        BILL: "账单",
        RECEIPT: "收据",
        AGREEMENT: "服务协议",
      })[type],
  );
  return types.length ? types.map(escapeHtml).join("、") : "暂无";
}

function money(amountMinor: number): string {
  return `${(amountMinor / 100).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CNY`;
}

export function renderAdminFees(snapshot: AdminFeesSnapshot): string {
  const options = PROFILES.map(
    ([profile, label]) =>
      `<option value="${profile}"${snapshot.profile === profile ? " selected" : ""}>${escapeHtml(label)}</option>`,
  ).join("");
  const profileLabel = PROFILES.find(([profile]) => profile === snapshot.profile)?.[1] ?? "未选择";
  const summary = snapshot.summary;
  const feeMetrics = summary
    ? `<section class="panel" aria-label="当前范围费用汇总"><h2>费用资料汇总</h2><dl class="meta"><div><dt>资料数量</dt><dd>${summary.totalDocuments}</dd></div><div><dt>可查看资料</dt><dd>${summary.activeDocuments}</dd></div><div><dt>已记录入账</dt><dd>${summary.paidDocuments}</dd></div><div><dt>当前不可用</dt><dd>${summary.unavailableDocuments}</dd></div>${summary.scope === "campus" ? `<div><dt>合成金额合计</dt><dd>${escapeHtml(money(Math.round((summary.amountTotal ?? 0) * 100)))}</dd></div>` : ""}<div><dt>资料类型</dt><dd>${countItems(summary)}</dd></div></dl></section>`
    : "";
  const ledger = snapshot.ledgerSummary;
  const ledgerMetrics = ledger
    ? `<section class="panel" aria-label="流水汇总"><h2>费用流水汇总</h2><p class="notice">仅本机合成流水，不代表真实收付款。</p><dl class="meta"><div><dt>流水数量</dt><dd>${ledger.entryCount}</dd></div><div><dt>收费记录</dt><dd>${ledger.countsByType.CHARGE}</dd></div><div><dt>入账记录</dt><dd>${ledger.countsByType.PAYMENT}</dd></div><div><dt>退款记录</dt><dd>${ledger.countsByType.REFUND}</dd></div>${ledger.scope === "campus" ? `<div><dt>收费合计</dt><dd>${escapeHtml(money(ledger.chargeMinor))}</dd></div><div><dt>入账合计</dt><dd>${escapeHtml(money(ledger.paymentMinor))}</dd></div><div><dt>退款合计</dt><dd>${escapeHtml(money(ledger.refundMinor))}</dd></div><div><dt>待核对差额</dt><dd>${escapeHtml(money(ledger.balanceDueMinor))}</dd></div>` : ""}</dl></section>`
    : "";
  return `<div class="shell"><header class="topbar"><strong class="brand">同芯学园 · 费用资料</strong><span>${escapeHtml(profileLabel)}</span><a href="/admin">返回管理首页</a></header><main class="review-main"><section class="panel"><p class="notice">合成数据 · 只读汇总 · 不连接支付或外部服务</p><label for="admin-fees-profile">查看范围</label><select id="admin-fees-profile"><option value="">选择本机身份</option>${options}</select><button type="button" id="admin-fees-refresh"${snapshot.status === "CONNECTING" || snapshot.status === "BUSY" ? " disabled" : ""}>刷新汇总</button><p role="status" aria-live="polite" data-fees-message>${escapeHtml(snapshot.message)}</p></section>${feeMetrics}${ledgerMetrics}</main></div>`;
}
