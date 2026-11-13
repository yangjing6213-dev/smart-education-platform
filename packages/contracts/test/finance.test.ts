import assert from "node:assert/strict";
import test from "node:test";
import {
  FINANCE_LEDGER_ENTRY_TYPES,
  type FinanceLedgerEntry,
  type ParentFinanceLedgerEntry,
} from "../src/finance.js";

const tenantId = "00000000-0000-4000-8000-000000000064";
const campusId = "00000000-0000-4000-8000-000000000065";
const classId = "00000000-0000-4000-8000-000000000067";

test("finance ledger contract uses fixed synthetic entry kinds and integer CNY cents", () => {
  assert.deepEqual(FINANCE_LEDGER_ENTRY_TYPES, ["CHARGE", "PAYMENT", "REFUND"]);

  const entry = {
    id: "ledger-synthetic-001",
    tenant_id: tenantId,
    campus_id: campusId,
    class_id: classId,
    student_id: "student-alpha",
    type: "CHARGE",
    amount_minor: 68000,
    currency: "CNY",
    period: "2026-10",
    occurred_on: "2026-10-01",
    document_id: "bill-alpha",
    document_version: 1,
    synthetic_data: true,
  } as const satisfies FinanceLedgerEntry;
  const parentEntry = {
    id: entry.id,
    type: entry.type,
    amount_minor: entry.amount_minor,
    currency: entry.currency,
    period: entry.period,
    occurred_on: entry.occurred_on,
    document_id: entry.document_id,
    document_version: entry.document_version,
    student_alias: "student-alpha",
    student_label: "示例学生甲",
    synthetic_data: true,
  } satisfies ParentFinanceLedgerEntry;

  assert.equal(Number.isInteger(parentEntry.amount_minor), true);
  assert.equal(parentEntry.synthetic_data, true);
  assert.equal(FINANCE_LEDGER_ENTRY_TYPES.includes(parentEntry.type), true);
});
