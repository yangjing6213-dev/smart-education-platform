import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { AdminFeesClient, renderAdminFees } from "../dist/local-review/fees.js";

const mainSource = await readFile(new globalThis.URL("../src/main.ts", import.meta.url), "utf8");
const uuid = (value) => `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
const campusSummary = {
  scope: "campus",
  synthetic: true,
  totalDocuments: 9,
  activeDocuments: 6,
  paidDocuments: 2,
  unavailableDocuments: 3,
  documentTypes: ["AGREEMENT", "BILL", "RECEIPT"],
  amountTotal: 2040,
  amountCurrency: "CNY",
};
const campusLedger = {
  scope: "campus",
  synthetic: true,
  entryCount: 4,
  countsByType: { CHARGE: 2, PAYMENT: 1, REFUND: 1 },
  chargeMinor: 120000,
  paymentMinor: 76000,
  refundMinor: 8000,
  balanceDueMinor: 52000,
  currency: "CNY",
};
const platformSummary = {
  scope: "platform",
  synthetic: true,
  totalDocuments: 9,
  activeDocuments: 6,
  paidDocuments: 2,
  unavailableDocuments: 3,
  documentTypes: ["AGREEMENT", "BILL", "RECEIPT"],
};
const platformLedger = {
  scope: "platform",
  synthetic: true,
  entryCount: 4,
  countsByType: { CHARGE: 2, PAYMENT: 1, REFUND: 1 },
};

function createFetcher(profile, overrides = {}) {
  const calls = [];
  const fetcher = async (input, init = {}) => {
    const url = new globalThis.URL(
      typeof input === "string" ? input : input instanceof globalThis.URL ? input.href : input.url,
    );
    const method = init.method ?? "GET";
    calls.push({ url, method, headers: new globalThis.Headers(init.headers) });
    const body =
      url.pathname === "/local/sessions"
        ? { handle: "a".repeat(43) }
        : url.pathname === "/local/session"
          ? {
              mode: "local-synthetic",
              profile,
              label: "本机合成身份",
              actorId: uuid(4),
              actions: profile === "platform-admin" ? [] : ["fees:summary"],
            }
          : url.pathname === "/local/fee-summary"
            ? (overrides.summary ??
              (profile === "platform-admin" ? platformSummary : campusSummary))
            : url.pathname === "/local/fee-ledger-summary"
              ? (overrides.ledger ?? (profile === "platform-admin" ? platformLedger : campusLedger))
              : {};
    return new globalThis.Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  return { fetcher, calls };
}

test("admin fees page is routed and linked from the institution overview", () => {
  assert.equal(mainSource.includes('path === "/admin/fees"'), true);
  assert.equal(mainSource.includes('href="/admin/fees"'), true);
});

test("campus owner sees only summary totals through loopback GET requests", async () => {
  const { fetcher, calls } = createFetcher("owner-east");
  const client = new AdminFeesClient(4317, fetcher);
  await client.connect("owner-east");

  const html = renderAdminFees(client.snapshot);
  assert.equal(client.snapshot.status, "READY");
  assert.match(html, /2,040\.00 CNY/u);
  assert.match(html, /费用流水汇总/u);
  assert.equal(
    calls.every(
      ({ url }) => url.origin === "http://127.0.0.1:4317" && url.pathname.startsWith("/local/"),
    ),
    true,
  );
  assert.equal(
    calls.every(({ method }) => method === "GET" || method === "POST"),
    true,
  );
  assert.equal(
    calls.some(({ method, url }) => method === "POST" && url.pathname !== "/local/sessions"),
    false,
  );
  assert.doesNotMatch(html, /模拟学生|student-alpha|ledger-alpha|data-payment|data-refund/u);
});

test("platform identity receives anonymous counts with no amounts or fee detail", async () => {
  const { fetcher, calls } = createFetcher("platform-admin");
  const client = new AdminFeesClient(4317, fetcher);
  await client.connect("platform-admin");

  const html = renderAdminFees(client.snapshot);
  assert.equal(client.snapshot.status, "READY");
  assert.match(html, /匿名/u);
  assert.match(html, /流水数量/u);
  assert.doesNotMatch(html, /2040|2,040|CNY|模拟学生|student-alpha/u);
  assert.equal(
    calls.some(({ url }) => url.pathname === "/local/fee-summary"),
    true,
  );
});

test("platform response containing an amount fails closed", async () => {
  const { fetcher } = createFetcher("platform-admin", {
    summary: { ...platformSummary, amountTotal: 2040, amountCurrency: "CNY" },
  });
  const client = new AdminFeesClient(4317, fetcher);
  await client.connect("platform-admin");

  assert.equal(client.snapshot.status, "ERROR");
  assert.equal(client.snapshot.summary, null);
  assert.doesNotMatch(renderAdminFees(client.snapshot), /2040|CNY/u);
});

test("client rejects mismatched role sessions and unavailable service ports", async () => {
  const { fetcher } = createFetcher("owner-west");
  const mismatched = new AdminFeesClient(4317, fetcher);
  await mismatched.connect("owner-east");
  assert.equal(mismatched.snapshot.status, "ERROR");
  assert.equal(mismatched.snapshot.summary, null);

  const unavailable = new AdminFeesClient(null, fetcher);
  await unavailable.connect("owner-east");
  assert.equal(unavailable.snapshot.status, "ERROR");
  assert.equal(unavailable.snapshot.summary, null);
});
