export const FEE_DOCUMENT_TYPES = ["FEE_ITEM", "BILL", "RECEIPT", "AGREEMENT"] as const;
export const FEE_DOCUMENT_STATUSES = ["AVAILABLE", "PAID", "VOIDED", "EXPIRED", "REVOKED"] as const;

export type FeeDocumentType = (typeof FEE_DOCUMENT_TYPES)[number];
export type FeeDocumentStatus = (typeof FEE_DOCUMENT_STATUSES)[number];

export const FINANCE_LEDGER_ENTRY_TYPES = ["CHARGE", "PAYMENT", "REFUND"] as const;

export type FinanceLedgerEntryType = (typeof FINANCE_LEDGER_ENTRY_TYPES)[number];

/** Fixed local examples only; this is not a payment or refund receipt. */
export interface FinanceLedgerEntry {
  readonly id: string;
  readonly tenant_id: string;
  readonly campus_id: string;
  readonly class_id: string;
  readonly student_id: string;
  readonly type: FinanceLedgerEntryType;
  readonly amount_minor: number;
  readonly currency: "CNY";
  readonly period: string;
  readonly occurred_on: string;
  readonly document_id: string;
  readonly document_version: number;
  readonly synthetic_data: true;
}

export type ParentFinanceLedgerEntry = Omit<
  FinanceLedgerEntry,
  "tenant_id" | "campus_id" | "class_id" | "student_id"
> & {
  readonly student_alias: string;
  readonly student_label: string;
};

/** Read-only financial projection; payment, refund and signing commands are out of scope. */
export interface FeeDocument {
  readonly id: string;
  readonly tenant_id: string;
  readonly campus_id: string;
  readonly student_id: string;
  readonly document_type: FeeDocumentType;
  readonly version: number;
  readonly binding_version: number;
  readonly title: string;
  readonly amount: number | null;
  readonly currency: "CNY";
  readonly period: string;
  readonly source_version: number;
  readonly valid_from: string;
  readonly valid_to: string;
  readonly status: FeeDocumentStatus;
  readonly unavailable_reason?: string | null;
  readonly synthetic_data: true;
}
