import { LocalError } from "./binding-leave.service.js";
import {
  LocalRepository,
  type Binding,
  type FeeDocument,
  type FeeDocumentStatus,
  type FinanceLedgerRecord,
} from "./repository.js";
import { LOCAL_STUDENTS, studentForId, type LocalMember } from "./sessions.js";

const unavailable = () => new LocalError(403, "UNAVAILABLE");
const conflict = () => new LocalError(409, "STATE_CONFLICT");

const TENANT_EAST = "00000000-0000-4000-8000-000000000064";
const CAMPUS_EAST = "00000000-0000-4000-8000-000000000065";
const TENANT_WEST = "00000000-0000-4000-8000-00000000006e";
const CAMPUS_WEST = "00000000-0000-4000-8000-00000000006f";
const CLASS_WEST = "00000000-0000-4000-8000-000000000071";

const STATUS_REASONS: Readonly<Record<Exclude<FeeDocumentStatus, "AVAILABLE" | "PAID">, string>> = {
  VOIDED: "该资料已撤回",
  EXPIRED: "该资料已过期",
  REVOKED: "该资料已撤回",
};

function localDate(now: number) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(now));
}

function syntheticUuid(value: number) {
  return `00000000-0000-4000-8000-${value.toString(16).padStart(12, "0")}`;
}

function permission(member: LocalMember, action: "fees:read" | "fees:summary") {
  if (!member.actions.includes(action)) throw unavailable();
}

function knownStatus(value: unknown): value is FeeDocumentStatus {
  return ["AVAILABLE", "PAID", "VOIDED", "EXPIRED", "REVOKED"].includes(value as string);
}

function fixture(
  id: string,
  studentId: string,
  classId: string,
  documentType: FeeDocument["documentType"],
  status: FeeDocumentStatus,
  title: string,
  amount: number | null,
  validFrom: string,
  validTo: string,
  unavailableReason: string | null,
  summary: string,
  scope = { tenantId: TENANT_EAST, campusId: CAMPUS_EAST },
): FeeDocument {
  return {
    id,
    version: 1,
    kind: "feeDocument",
    tenantId: scope.tenantId,
    campusId: scope.campusId,
    classId,
    documentType,
    studentId,
    bindingVersion: 2,
    title,
    amount,
    currency: "CNY",
    period: "2026-10",
    sourceVersion: 1,
    validFrom,
    validTo,
    status,
    unavailableReason,
    summary,
  };
}

function fixtures(): FeeDocument[] {
  const alpha = LOCAL_STUDENTS[0]!;
  const beta = LOCAL_STUDENTS[1]!;
  return [
    fixture(
      "fee-item-alpha",
      alpha.id,
      alpha.classId,
      "FEE_ITEM",
      "AVAILABLE",
      "课后托管服务费",
      680,
      "2026-10-01",
      "2026-10-31",
      null,
      "2026 年 10 月课后托管服务合成收费项。",
    ),
    fixture(
      "bill-alpha",
      alpha.id,
      alpha.classId,
      "BILL",
      "PAID",
      "10 月服务账单",
      680,
      "2026-10-01",
      "2026-10-31",
      null,
      "该账单为本机合成已结清示例。",
    ),
    fixture(
      "receipt-alpha",
      alpha.id,
      alpha.classId,
      "RECEIPT",
      "PAID",
      "10 月服务收据",
      680,
      "2026-10-01",
      "2026-10-31",
      null,
      "该收据为本机合成已结清示例。",
    ),
    fixture(
      "agreement-alpha",
      alpha.id,
      alpha.classId,
      "AGREEMENT",
      "AVAILABLE",
      "课后托管服务协议",
      null,
      "2026-09-01",
      "2026-12-31",
      null,
      "本协议为本机合成阅读示例，不代表真实签署。",
    ),
    fixture(
      "agreement-expired-alpha",
      alpha.id,
      alpha.classId,
      "AGREEMENT",
      "EXPIRED",
      "历史服务协议",
      null,
      "2026-06-01",
      "2026-09-30",
      "该协议已过期",
      "本机合成历史协议正文不对外展示。",
    ),
    fixture(
      "receipt-revoked-alpha",
      alpha.id,
      alpha.classId,
      "RECEIPT",
      "REVOKED",
      "已撤回收据",
      null,
      "2026-09-01",
      "2026-12-31",
      "该收据已撤回",
      "本机合成撤回资料不对外展示。",
    ),
    fixture(
      "fee-item-beta",
      beta.id,
      beta.classId,
      "FEE_ITEM",
      "AVAILABLE",
      "另一名学生服务费",
      520,
      "2026-10-01",
      "2026-10-31",
      null,
      "另一名合成学生的服务费示例。",
    ),
    fixture(
      "fee-item-west",
      "student-west-synthetic",
      CLASS_WEST,
      "FEE_ITEM",
      "AVAILABLE",
      "西校区服务费",
      580,
      "2026-10-01",
      "2026-10-31",
      null,
      "西校区合成服务费示例。",
      { tenantId: TENANT_EAST, campusId: CAMPUS_WEST },
    ),
    fixture(
      "fee-item-other-tenant",
      "student-other-tenant",
      syntheticUuid(113),
      "FEE_ITEM",
      "AVAILABLE",
      "其他机构服务费",
      600,
      "2026-10-01",
      "2026-10-31",
      null,
      "其他机构合成服务费示例。",
      { tenantId: TENANT_WEST, campusId: CAMPUS_WEST },
    ),
  ];
}

export interface FeeParentView {
  id: string;
  version: number;
  documentType: FeeDocument["documentType"];
  title: string;
  studentId: string;
  studentAlias: string;
  studentLabel: string;
  status: FeeDocumentStatus;
  amount: number | null;
  currency: "CNY" | null;
  period: string;
  sourceVersion: number;
  validFrom: string;
  validTo: string;
  available: boolean;
  unavailableReason?: string;
  synthetic: true;
  summary?: string;
}

function isParent(member: LocalMember) {
  return member.actions.includes("fees:read");
}

function ledgerFixtures(): FinanceLedgerRecord[] {
  const alpha = LOCAL_STUDENTS[0]!;
  const beta = LOCAL_STUDENTS[1]!;
  const entry = (
    id: string,
    student: (typeof LOCAL_STUDENTS)[number],
    type: FinanceLedgerRecord["type"],
    amountMinor: number,
    occurredOn: string,
    documentId: string,
  ): FinanceLedgerRecord => ({
    id,
    version: 1,
    kind: "financeLedgerEntry",
    tenantId: student.tenantId,
    campusId: student.campusId,
    classId: student.classId,
    studentId: student.id,
    bindingVersion: 2,
    type,
    amountMinor,
    currency: "CNY",
    period: "2026-10",
    occurredOn,
    documentId,
    documentVersion: 1,
    synthetic: true,
  });
  return [
    entry("ledger-alpha-charge", alpha, "CHARGE", 68000, "2026-10-01", "bill-alpha"),
    entry("ledger-alpha-payment", alpha, "PAYMENT", 76000, "2026-10-03", "bill-alpha"),
    entry("ledger-alpha-refund", alpha, "REFUND", 8000, "2026-10-05", "bill-alpha"),
    entry("ledger-beta-charge", beta, "CHARGE", 52000, "2026-10-01", "fee-item-beta"),
  ];
}

function reconciliation(rows: readonly FinanceLedgerRecord[]) {
  const totals = rows.reduce(
    (result, row) => {
      result[row.type] += row.amountMinor;
      return result;
    },
    { CHARGE: 0, PAYMENT: 0, REFUND: 0 },
  );
  return {
    chargeMinor: totals.CHARGE,
    paymentMinor: totals.PAYMENT,
    refundMinor: totals.REFUND,
    balanceDueMinor: Math.max(totals.CHARGE - totals.PAYMENT + totals.REFUND, 0),
    currency: "CNY" as const,
  };
}

function countsByType(rows: readonly FinanceLedgerRecord[]) {
  return rows.reduce(
    (counts, row) => {
      counts[row.type] += 1;
      return counts;
    },
    { CHARGE: 0, PAYMENT: 0, REFUND: 0 },
  );
}

export class FeesService {
  readonly #documentBindings = new Map<string, string>();

  constructor(
    private readonly repository: LocalRepository,
    private readonly now: () => number = Date.now,
  ) {
    for (const row of fixtures()) if (!this.repository.get(row.id)) this.repository.insert(row);
    for (const row of ledgerFixtures())
      if (!this.repository.get(row.id)) this.repository.insert(row);
  }

  list(member: LocalMember) {
    permission(member, "fees:read");
    return this.repository
      .list()
      .filter((row): row is FeeDocument => row.kind === "feeDocument")
      .filter((row) => this.parentBinding(member, row) !== undefined)
      .flatMap((row) => {
        const view = this.parentView(row, this.now());
        return view ? [view] : [];
      });
  }

  get(member: LocalMember, id: string, expectedVersion?: unknown) {
    permission(member, "fees:read");
    const row = this.visibleDocument(member, id);
    if (expectedVersion !== undefined && expectedVersion !== row.version) throw conflict();
    const view = this.parentView(row, this.now());
    if (!view) throw conflict();
    return view;
  }

  download(member: LocalMember, id: string) {
    const view = this.get(member, id);
    if (!view.available || !view.summary) throw conflict();
    return {
      id: view.id,
      version: view.version,
      mediaType: "text/plain",
      filename: `${view.documentType.toLowerCase()}-${view.id}.txt`,
      synthetic: true,
      text: `合成数据，仅用于本机演示\n${view.title}\n${view.summary}`,
    };
  }

  summary(member: LocalMember) {
    if (member.profile !== "platform-admin") permission(member, "fees:summary");
    const rows = this.repository
      .list()
      .filter((row): row is FeeDocument => row.kind === "feeDocument")
      .filter((row) =>
        member.profile === "platform-admin"
          ? true
          : row.tenantId === member.tenantId &&
            row.campusId === member.campusId &&
            member.classIds.includes(row.classId),
      );
    const known = rows.filter((row) => knownStatus(row.status));
    const active = known.filter((row) => this.parentView(row, this.now())?.available === true);
    const paid = active.filter((row) => row.status === "PAID");
    const result = {
      scope: member.profile === "platform-admin" ? "platform" : "campus",
      synthetic: true as const,
      totalDocuments: known.length,
      activeDocuments: active.length,
      paidDocuments: paid.length,
      unavailableDocuments: known.length - active.length,
      documentTypes: [...new Set(known.map((row) => row.documentType))].sort(),
    };
    if (member.profile === "platform-admin") return result;
    return {
      ...result,
      amountTotal: active.reduce((sum, row) => sum + (row.amount ?? 0), 0),
      amountCurrency: "CNY" as const,
    };
  }

  ledger(member: LocalMember) {
    permission(member, "fees:read");
    const entries = this.ledgerRows()
      .filter((entry) => {
        const document = this.currentLedgerDocument(entry);
        return (
          document !== undefined &&
          this.parentBinding(member, document) !== undefined &&
          this.parentView(document, this.now())?.available === true
        );
      })
      .sort((a, b) => a.occurredOn.localeCompare(b.occurredOn) || a.id.localeCompare(b.id))
      .map((entry) => {
        const student = studentForId(entry.studentId)!;
        return {
          id: entry.id,
          type: entry.type,
          amountMinor: entry.amountMinor,
          currency: entry.currency,
          period: entry.period,
          occurredOn: entry.occurredOn,
          documentId: entry.documentId,
          documentVersion: entry.documentVersion,
          studentAlias: student.alias,
          studentLabel: student.label,
          synthetic: true as const,
        };
      });
    const totals = entries.reduce(
      (sum, entry) => {
        sum[entry.type] += entry.amountMinor;
        return sum;
      },
      { CHARGE: 0, PAYMENT: 0, REFUND: 0 },
    );
    return {
      scope: "parent" as const,
      synthetic: true as const,
      entries,
      reconciliation: {
        chargeMinor: totals.CHARGE,
        paymentMinor: totals.PAYMENT,
        refundMinor: totals.REFUND,
        balanceDueMinor: Math.max(totals.CHARGE - totals.PAYMENT + totals.REFUND, 0),
        currency: "CNY" as const,
      },
    };
  }

  ledgerSummary(member: LocalMember) {
    if (member.profile !== "platform-admin") permission(member, "fees:summary");
    const rows = this.ledgerRows().filter((row) => this.currentLedgerDocument(row) !== undefined);
    const scoped =
      member.profile === "platform-admin"
        ? rows
        : rows.filter(
            (row) => row.tenantId === member.tenantId && row.campusId === member.campusId,
          );
    const base = {
      scope: member.profile === "platform-admin" ? ("platform" as const) : ("campus" as const),
      synthetic: true as const,
      entryCount: scoped.length,
      countsByType: countsByType(scoped),
    };
    if (member.profile === "platform-admin") return base;
    return { ...base, ...reconciliation(scoped) };
  }

  private ledgerRows() {
    return this.repository
      .list()
      .filter((row): row is FinanceLedgerRecord => row.kind === "financeLedgerEntry")
      .filter((row) => row.synthetic && Number.isInteger(row.amountMinor) && row.amountMinor >= 0);
  }

  private currentLedgerDocument(entry: FinanceLedgerRecord) {
    const document = this.repository.get(entry.documentId);
    return document &&
      document.kind === "feeDocument" &&
      document.version === entry.documentVersion &&
      document.tenantId === entry.tenantId &&
      document.campusId === entry.campusId &&
      document.classId === entry.classId &&
      document.studentId === entry.studentId &&
      document.bindingVersion === entry.bindingVersion &&
      (document.status === "AVAILABLE" || document.status === "PAID")
      ? document
      : undefined;
  }

  private visibleDocument(member: LocalMember, id: string) {
    const row = this.repository.get(id);
    if (!row || row.kind !== "feeDocument" || !knownStatus(row.status)) throw unavailable();
    if (!this.parentBinding(member, row)) throw unavailable();
    return row;
  }

  private parentBinding(member: LocalMember, row: FeeDocument): Binding | undefined {
    if (!isParent(member)) return undefined;
    const binding = this.repository
      .list()
      .find(
        (candidate): candidate is Binding =>
          candidate.kind === "binding" &&
          candidate.status === "APPROVED" &&
          candidate.guardianId === member.actorId &&
          candidate.studentId === row.studentId &&
          candidate.version === row.bindingVersion &&
          candidate.tenantId === row.tenantId &&
          candidate.campusId === row.campusId &&
          member.tenantId === row.tenantId &&
          member.campusId === row.campusId &&
          member.classIds.includes(row.classId),
      );
    if (!binding) return undefined;
    const key = `${member.actorId}:${row.id}`;
    const claimedBinding = this.#documentBindings.get(key);
    if (claimedBinding && claimedBinding !== binding.id) return undefined;
    if (!claimedBinding) this.#documentBindings.set(key, binding.id);
    return binding;
  }

  private parentView(row: FeeDocument, now: number): FeeParentView | undefined {
    const student = studentForId(row.studentId);
    if (!student || !knownStatus(row.status)) return undefined;
    const inPeriod = localDate(now) >= row.validFrom && localDate(now) <= row.validTo;
    const available = (row.status === "AVAILABLE" || row.status === "PAID") && inPeriod;
    const unavailableReason = available
      ? undefined
      : (row.unavailableReason ??
        (row.status === "AVAILABLE" || row.status === "PAID"
          ? localDate(now) < row.validFrom
            ? "该资料尚未到有效期"
            : "该资料已过期"
          : STATUS_REASONS[row.status]));
    return {
      id: row.id,
      version: row.version,
      documentType: row.documentType,
      title: row.title,
      studentId: student.id,
      studentAlias: student.alias,
      studentLabel: student.label,
      status: row.status,
      amount: available ? row.amount : null,
      currency: available ? row.currency : null,
      period: row.period,
      sourceVersion: row.sourceVersion,
      validFrom: row.validFrom,
      validTo: row.validTo,
      available,
      ...(unavailableReason ? { unavailableReason } : {}),
      synthetic: true,
      ...(available ? { summary: row.summary } : {}),
    };
  }
}
