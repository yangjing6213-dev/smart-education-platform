import assert from "node:assert/strict";
import test from "node:test";

import { ParentFeesClient, renderParentFeesPage } from "./parent-fees.js";

const uuid = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
const feeDocument = {
  id: uuid(300),
  version: 1,
  documentType: "BILL",
  studentId: uuid(200),
  studentAlias: "student-alpha",
  studentLabel: "示例学生甲",
  title: "托管服务费",
  period: "2026年10月",
  amount: 680,
  currency: "CNY",
  status: "PAID",
  sourceVersion: 1,
  validFrom: "2026-10-01",
  validTo: "2026-10-31",
  available: true,
  synthetic: true,
  summary: "合成账单摘要。",
} as const;
const ledger = {
  scope: "parent",
  synthetic: true,
  entries: [
    {
      id: "ledger-alpha-charge",
      type: "CHARGE",
      amountMinor: 68000,
      currency: "CNY",
      period: "2026-10",
      occurredOn: "2026-10-01",
      documentId: "bill-alpha",
      documentVersion: 1,
      studentAlias: "student-alpha",
      studentLabel: "示例学生甲",
      synthetic: true,
    },
  ],
  reconciliation: {
    chargeMinor: 68000,
    paymentMinor: 0,
    refundMinor: 0,
    balanceDueMinor: 68000,
    currency: "CNY",
  },
} as const;

function response(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function parentFetch(bindingStatus = "APPROVED", overrides: Record<string, unknown> = {}) {
  const paths: string[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
    );
    paths.push(`${init?.method ?? "GET"} ${url.origin}${url.pathname}`);
    const body =
      url.pathname === "/local/sessions"
        ? { handle: "a".repeat(43) }
        : url.pathname === "/local/session"
          ? { mode: "local-synthetic", profile: "parent-alpha", actions: ["fees:read"] }
          : url.pathname === "/local/binding-applications"
            ? [
                ...(overrides.bindings as unknown[] | undefined) ?? [
                  {
                    id: uuid(20),
                    relationship: "GUARDIAN",
                    studentAlias: "student-alpha",
                    studentLabel: "示例学生甲",
                    status: bindingStatus,
                  },
                ],
              ]
            : url.pathname === "/local/fees"
              ? (overrides.fees ?? [feeDocument])
              : url.pathname === "/local/fee-ledger"
                ? (overrides.ledger ?? ledger)
                : {};
    return response(body);
  };
  return { fetcher, paths };
}

test("approved guardian sees only fee rows covered by the current synthetic relationship", async () => {
  const { fetcher, paths } = parentFetch();
  const client = new ParentFeesClient({ fetcher });

  await client.connect();

  assert.equal(client.snapshot.status, "READY");
  assert.equal(client.snapshot.bindingStatus, "APPROVED");
  assert.equal(client.snapshot.documents.length, 1);
  assert.equal(client.snapshot.ledger?.entries.length, 1);
  assert.equal(
    paths.every((path) => path.includes("http://127.0.0.1:4317/local/")),
    true,
  );
  assert.equal(
    paths.some((path) => path.includes("/local/fees")),
    true,
  );
});

test("approved guardian can view fee records for multiple approved children", async () => {
  const secondDocument = {
    ...feeDocument,
    id: uuid(301),
    studentId: uuid(201),
    studentAlias: "student-beta",
    studentLabel: "示例学生乙",
    title: "兴趣课程费",
  };
  const secondEntry = {
    ...ledger.entries[0]!,
    id: "ledger-beta-charge",
    documentId: "bill-beta",
    studentAlias: "student-beta",
    studentLabel: "示例学生乙",
  };
  const { fetcher } = parentFetch("APPROVED", {
    bindings: [
      { id: uuid(20), relationship: "GUARDIAN", studentAlias: "student-alpha", studentLabel: "示例学生甲", status: "APPROVED" },
      { id: uuid(21), relationship: "GUARDIAN", studentAlias: "student-beta", studentLabel: "示例学生乙", status: "APPROVED" },
    ],
    fees: [feeDocument, secondDocument],
    ledger: {
      ...ledger,
      entries: [ledger.entries[0]!, secondEntry],
      reconciliation: { ...ledger.reconciliation, chargeMinor: 136000, balanceDueMinor: 136000 },
    },
  });
  const client = new ParentFeesClient({ fetcher });
  await client.connect();

  assert.equal(client.snapshot.status, "READY");
  assert.deepEqual(client.snapshot.documents.map((row) => row.studentAlias), ["student-alpha", "student-beta"]);
  assert.deepEqual(client.snapshot.ledger?.entries.map((row) => row.studentAlias), ["student-alpha", "student-beta"]);
});

test("approved guardian rejects a fee row with a mismatched synthetic student label", async () => {
  const mismatched = { ...feeDocument, studentLabel: "模拟学生甲" };
  const { fetcher } = parentFetch("APPROVED", { fees: [mismatched] });
  const client = new ParentFeesClient({ fetcher });

  await client.connect();

  assert.equal(client.snapshot.status, "ERROR");
  assert.equal(client.snapshot.documents.length, 0);
  assert.equal(client.snapshot.ledger, null);
});

test("pending relation never requests or renders fee details", async () => {
  const { fetcher, paths } = parentFetch("PENDING");
  const client = new ParentFeesClient({ fetcher });
  await client.connect();

  const html = renderParentFeesPage(client.snapshot);
  assert.equal(client.snapshot.bindingStatus, "PENDING");
  assert.deepEqual(client.snapshot.documents, []);
  assert.equal(
    paths.some((path) => path.includes("/local/fees") || path.includes("/local/fee-ledger")),
    false,
  );
  assert.equal(html.includes("托管服务费"), false);
  assert.equal(html.includes("关系审核通过后"), true);
});

test("malformed or cross-child fee responses fail closed", async () => {
  const unrelated = { ...feeDocument, studentAlias: "student-beta", studentLabel: "示例学生乙" };
  const { fetcher } = parentFetch("APPROVED", { fees: [unrelated] });
  const client = new ParentFeesClient({ fetcher });
  await client.connect();

  assert.equal(client.snapshot.status, "ERROR");
  assert.deepEqual(client.snapshot.documents, []);
  assert.equal(renderParentFeesPage(client.snapshot).includes("托管服务费"), false);
});

test("parent fee view is read-only and the client rejects non-loopback services", () => {
  const html = renderParentFeesPage({
    status: "READY",
    bindingStatus: "APPROVED",
    documents: [feeDocument],
    ledger,
    message: "仅显示模拟流水。",
  });
  assert.equal(html.includes("托管服务费"), true);
  assert.equal(/<button[^>]*>[^<]*(?:支付|付款|退款)/u.test(html), false);
  assert.equal(html.includes("data-fee-action"), false);
  assert.throws(() => new ParentFeesClient({ baseUrl: "https://example.invalid" }), /loopback/u);
});
