const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const PERIOD = /^\d{4}-(?:0[1-9]|1[0-2])$/u;
const DATE = /^\d{4}-\d{2}-\d{2}$/u;
const STUDENT_ALIAS = /^student-[0-9a-f]{8}$/u;
const PRIVATE_IDENTIFIER =
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/iu;
const DOCUMENT_TYPES = new Set(["FEE_ITEM", "BILL", "RECEIPT", "AGREEMENT"]);
const DOCUMENT_STATUSES = new Set(["AVAILABLE", "PAID", "VOIDED", "EXPIRED", "REVOKED"]);
const BINDING_STATUSES = new Set([
  "APPROVED",
  "PENDING",
  "RELEASED",
  "WITHDRAWN",
  "EXPIRED",
  "REJECTED",
]);
const LEDGER_TYPES = new Set(["CHARGE", "PAYMENT", "REFUND"]);

export type ParentFeeDocument = {
  readonly key: string;
  readonly documentType: "FEE_ITEM" | "BILL" | "RECEIPT" | "AGREEMENT";
  readonly title: string;
  readonly studentLabel: string;
  readonly status: "AVAILABLE" | "PAID";
  readonly amount: number | null;
  readonly currency: "CNY";
  readonly period: string;
  readonly validFrom: string;
  readonly validTo: string;
  readonly summary: string;
};

export type ParentFeesProjection = {
  readonly documents: readonly ParentFeeDocument[];
  readonly reconciliation: {
    readonly chargeMinor: number;
    readonly paymentMinor: number;
    readonly refundMinor: number;
    readonly balanceDueMinor: number;
    readonly currency: "CNY";
  };
};

export type ParentFeesPageModel = {
  readonly empty: boolean;
  readonly balanceText: string;
  readonly documents: readonly {
    readonly key: string;
    readonly title: string;
    readonly studentLabel: string;
    readonly period: string;
    readonly statusText: string;
    readonly amountText: string;
    readonly validityText: string;
    readonly summary: string;
  }[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return isRecord(value) && Object.keys(value).sort().join(",") === [...keys].sort().join(",");
}

function validDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    DATE.test(value) &&
    Number.isFinite(Date.parse(`${value}T00:00:00.000Z`)) &&
    new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value
  );
}

function safeText(value: unknown, maximumLength: number): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= maximumLength &&
    !PRIVATE_IDENTIFIER.test(value)
  );
}

function safeMinor(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function validAmount(value: unknown): value is number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return false;
  const minor = Math.round(value * 100);
  return Number.isSafeInteger(minor) && Math.abs(value * 100 - minor) < 0.000001;
}

function invalidFees(): Error {
  return new Error("费用信息格式不正确，请稍后重试。");
}

function parseBindings(value: unknown): void {
  if (!Array.isArray(value)) throw invalidFees();
  for (const binding of value) {
    if (
      !exactKeys(binding, ["id", "relationship", "studentAlias", "studentLabel", "status"]) ||
      typeof binding.id !== "string" ||
      !UUID.test(binding.id) ||
      binding.relationship !== "GUARDIAN" ||
      typeof binding.studentAlias !== "string" ||
      !STUDENT_ALIAS.test(binding.studentAlias) ||
      (binding.studentLabel !== null && !safeText(binding.studentLabel, 80)) ||
      typeof binding.status !== "string" ||
      !BINDING_STATUSES.has(binding.status)
    )
      throw invalidFees();
  }
}

function parseDocuments(value: unknown): ParentFeeDocument[] {
  if (!Array.isArray(value)) throw invalidFees();
  const ids = new Set<string>();
  const documents: ParentFeeDocument[] = [];

  for (const document of value) {
    if (!isRecord(document) || typeof document.available !== "boolean") throw invalidFees();
    const keys = [
      "id",
      "version",
      "documentType",
      "title",
      "studentId",
      "studentAlias",
      "studentLabel",
      "status",
      "amount",
      "currency",
      "period",
      "sourceVersion",
      "validFrom",
      "validTo",
      "available",
      "synthetic",
      document.available ? "summary" : "unavailableReason",
    ];
    const availableStatus = document.status === "AVAILABLE" || document.status === "PAID";
    if (
      !exactKeys(document, keys) ||
      typeof document.id !== "string" ||
      !UUID.test(document.id) ||
      ids.has(document.id) ||
      !Number.isSafeInteger(document.version) ||
      Number(document.version) < 1 ||
      typeof document.documentType !== "string" ||
      !DOCUMENT_TYPES.has(document.documentType) ||
      !safeText(document.title, 120) ||
      typeof document.studentId !== "string" ||
      !UUID.test(document.studentId) ||
      typeof document.studentAlias !== "string" ||
      !STUDENT_ALIAS.test(document.studentAlias) ||
      !safeText(document.studentLabel, 80) ||
      typeof document.status !== "string" ||
      !DOCUMENT_STATUSES.has(document.status) ||
      document.available !== availableStatus ||
      typeof document.period !== "string" ||
      !PERIOD.test(document.period) ||
      !Number.isSafeInteger(document.sourceVersion) ||
      document.sourceVersion !== document.version ||
      !validDate(document.validFrom) ||
      !validDate(document.validTo) ||
      document.validTo < document.validFrom ||
      document.synthetic !== true
    )
      throw invalidFees();

    if (document.available) {
      if (
        document.currency !== "CNY" ||
        (document.amount !== null && !validAmount(document.amount)) ||
        !safeText(document.summary, 500)
      )
        throw invalidFees();
      documents.push({
        key: document.id,
        documentType: document.documentType as ParentFeeDocument["documentType"],
        title: document.title,
        studentLabel: document.studentLabel,
        status: document.status as ParentFeeDocument["status"],
        amount: document.amount as number | null,
        currency: "CNY",
        period: document.period as string,
        validFrom: document.validFrom,
        validTo: document.validTo,
        summary: document.summary,
      });
    } else if (
      document.amount !== null ||
      document.currency !== null ||
      !safeText(document.unavailableReason, 160)
    ) {
      throw invalidFees();
    }
    ids.add(document.id);
  }

  return documents;
}

function parseLedger(value: unknown): ParentFeesProjection["reconciliation"] {
  if (
    !exactKeys(value, ["scope", "synthetic", "entries", "reconciliation"]) ||
    value.scope !== "parent" ||
    value.synthetic !== true ||
    !Array.isArray(value.entries)
  )
    throw invalidFees();

  const entryTotals = { CHARGE: 0, PAYMENT: 0, REFUND: 0 };
  for (const entry of value.entries) {
    if (
      !exactKeys(entry, [
        "id",
        "type",
        "amountMinor",
        "currency",
        "period",
        "occurredOn",
        "documentId",
        "documentVersion",
        "studentAlias",
        "studentLabel",
        "synthetic",
      ]) ||
      typeof entry.id !== "string" ||
      !UUID.test(entry.id) ||
      typeof entry.type !== "string" ||
      !LEDGER_TYPES.has(entry.type) ||
      !safeMinor(entry.amountMinor) ||
      entry.currency !== "CNY" ||
      typeof entry.period !== "string" ||
      !PERIOD.test(entry.period) ||
      !validDate(entry.occurredOn) ||
      typeof entry.documentId !== "string" ||
      !UUID.test(entry.documentId) ||
      !Number.isSafeInteger(entry.documentVersion) ||
      Number(entry.documentVersion) < 1 ||
      typeof entry.studentAlias !== "string" ||
      !STUDENT_ALIAS.test(entry.studentAlias) ||
      !safeText(entry.studentLabel, 80) ||
      entry.synthetic !== true
    )
      throw invalidFees();

    const nextTotal = entryTotals[entry.type as keyof typeof entryTotals] + entry.amountMinor;
    if (!Number.isSafeInteger(nextTotal)) throw invalidFees();
    entryTotals[entry.type as keyof typeof entryTotals] = nextTotal;
  }

  const totals = value.reconciliation;
  if (
    !exactKeys(totals, [
      "chargeMinor",
      "paymentMinor",
      "refundMinor",
      "balanceDueMinor",
      "currency",
    ]) ||
    !safeMinor(totals.chargeMinor) ||
    !safeMinor(totals.paymentMinor) ||
    !safeMinor(totals.refundMinor) ||
    !safeMinor(totals.balanceDueMinor) ||
    totals.currency !== "CNY"
  )
    throw invalidFees();

  const expectedBalance = Math.max(
    Number(totals.chargeMinor) - Number(totals.paymentMinor) + Number(totals.refundMinor),
    0,
  );
  if (!Number.isSafeInteger(expectedBalance) || expectedBalance !== totals.balanceDueMinor)
    throw invalidFees();
  if (
    entryTotals.CHARGE !== totals.chargeMinor ||
    entryTotals.PAYMENT !== totals.paymentMinor ||
    entryTotals.REFUND !== totals.refundMinor
  )
    throw invalidFees();

  return {
    chargeMinor: totals.chargeMinor,
    paymentMinor: totals.paymentMinor,
    refundMinor: totals.refundMinor,
    balanceDueMinor: totals.balanceDueMinor,
    currency: "CNY",
  };
}

export async function loadParentFees(
  read: (path: string) => Promise<unknown>,
): Promise<ParentFeesProjection> {
  const response = await read("/parent/fees");
  if (!exactKeys(response, ["bindingApplications", "documents", "ledger"])) throw invalidFees();
  parseBindings(response.bindingApplications);
  const documents = parseDocuments(response.documents);
  const reconciliation = parseLedger(response.ledger);
  return { documents, reconciliation };
}

function formatMinor(minor: number): string {
  const whole = Math.floor(minor / 100).toLocaleString("en-US");
  const fraction = String(minor % 100).padStart(2, "0");
  return `¥${whole}.${fraction}`;
}

function formatAmount(amount: number | null): string {
  if (amount === null) return "金额以机构发布信息为准";
  return formatMinor(Math.round(amount * 100));
}

function statusText(status: ParentFeeDocument["status"]): string {
  return status === "PAID" ? "已支付" : "待查看";
}

export function buildParentFeesPageModel(projection: ParentFeesProjection): ParentFeesPageModel {
  if (
    !Array.isArray(projection.documents) ||
    !safeMinor(projection.reconciliation?.balanceDueMinor)
  )
    throw invalidFees();
  const documents = projection.documents.map((document) => ({
    key: document.key,
    title: document.title,
    studentLabel: document.studentLabel,
    period: document.period,
    statusText: statusText(document.status),
    amountText: formatAmount(document.amount),
    validityText: `有效期至 ${document.validTo}`,
    summary: document.summary,
  }));
  return {
    empty: documents.length === 0,
    balanceText: formatMinor(projection.reconciliation.balanceDueMinor),
    documents,
  };
}
