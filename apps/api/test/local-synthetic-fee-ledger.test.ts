import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { resolve } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

function findWorkspaceRoot(start = process.cwd()): string {
  let current = resolve(start);
  while (true) {
    if (
      existsSync(resolve(current, "pnpm-workspace.yaml")) &&
      existsSync(resolve(current, "apps/api/package.json"))
    ) {
      return current;
    }
    const parent = resolve(current, "..");
    if (parent === current) {
      throw new Error("Could not find the repository root from the current test location.");
    }
    current = parent;
  }
}

const root = findWorkspaceRoot();
const workspacePackages: Record<string, string> = {
  "@student-care/auth": "packages/auth/dist/src/index.js",
  "@student-care/contracts": "packages/contracts/dist/src/index.js",
  "@student-care/tenant": "packages/tenant/dist/src/index.js",
  "@student-care/validation": "packages/validation/dist/src/index.js",
  fastify: "node_modules/.pnpm/fastify@5.12.1/node_modules/fastify/fastify.js",
  zod: "node_modules/.pnpm/zod@3.25.76/node_modules/zod/index.js",
};
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "fastify") {
      const fastifyUrl = pathToFileURL(
        resolve(root, "node_modules/.pnpm/fastify@5.12.1/node_modules/fastify/fastify.js"),
      ).href;
      const shim = `data:text/javascript,${encodeURIComponent(`import fastify from ${JSON.stringify(fastifyUrl)}; export default fastify;`)}`;
      return { url: shim, shortCircuit: true };
    }
    const target = workspacePackages[specifier];
    return target
      ? { url: pathToFileURL(resolve(root, target)).href, shortCircuit: true }
      : nextResolve(specifier, context);
  },
});
const { buildLocalSyntheticServer } = await import("../src/local-synthetic/server.js");
const { FeesService } = await import("../src/local-synthetic/fees.service.js");
const { LocalRepository } = await import("../src/local-synthetic/repository.js");
const { memberForActor } = await import("../src/local-synthetic/sessions.js");

const HOST = { host: "127.0.0.1:4317" };
const duringBillingPeriod = () => Date.parse("2026-10-12T01:00:00Z");
const id = (value: number) => `00000000-0000-4000-8000-${value.toString(16).padStart(12, "0")}`;
type App = Awaited<ReturnType<typeof buildLocalSyntheticServer>>;

async function login(app: App, profile: string): Promise<string> {
  const response = await app.inject({
    method: "POST",
    url: "/local/sessions",
    headers: HOST,
    payload: { profile },
  });
  assert.equal(response.statusCode, 201, response.body);
  return response.json<{ handle: string }>().handle;
}

function request(app: App, handle: string, method: "GET" | "POST", url: string, payload?: object) {
  return app.inject({
    method,
    url,
    headers: { ...HOST, authorization: `Bearer ${handle}` },
    ...(payload ? { payload } : {}),
  });
}

async function approvedBinding(app: App, parent: string, owner: string, student: string) {
  const applied = await request(app, parent, "POST", "/local/binding-applications", {
    student,
    relationship: "GUARDIAN",
  });
  assert.equal(applied.statusCode, 201, applied.body);
  const pending = applied.json<{ id: string; version: number }>();
  const approved = await request(
    app,
    owner,
    "POST",
    `/local/binding-applications/${pending.id}/review`,
    { version: pending.version, action: "approve" },
  );
  assert.equal(approved.statusCode, 200, approved.body);
  return approved.json<{ id: string; version: number; status: string }>();
}

test("parent ledger contains only the current approved child's fixed synthetic entries", async () => {
  const app = await buildLocalSyntheticServer({ mode: "local-synthetic", now: duringBillingPeriod });
  try {
    const owner = await login(app, "owner-east");
    const parentAlpha = await login(app, "parent-alpha");
    await approvedBinding(app, parentAlpha, owner, "student-alpha");
    const response = await request(app, parentAlpha, "GET", "/local/fee-ledger");
    assert.equal(response.statusCode, 200, response.body);
    const ledger = response.json<{
      scope: string;
      synthetic: boolean;
      entries: {
        id: string;
        type: string;
        amountMinor: number;
        currency: string;
        period: string;
        occurredOn: string;
        documentId: string;
        documentVersion: number;
        studentAlias: string;
        synthetic: boolean;
      }[];
      reconciliation: {
        chargeMinor: number;
        paymentMinor: number;
        refundMinor: number;
        balanceDueMinor: number;
        currency: string;
      };
    }>();

    assert.equal(ledger.scope, "parent");
    assert.equal(ledger.synthetic, true);
    assert.deepEqual(ledger.entries.map((entry) => entry.type).sort(), [
      "CHARGE",
      "PAYMENT",
      "REFUND",
    ]);
    assert.ok(ledger.entries.every((entry) => entry.studentAlias === "student-alpha"));
    assert.ok(
      ledger.entries.every(
        (entry) =>
          Number.isInteger(entry.amountMinor) &&
          entry.currency === "CNY" &&
          entry.documentVersion === 1 &&
          entry.synthetic,
      ),
    );
    assert.deepEqual(ledger.reconciliation, {
      chargeMinor: 68000,
      paymentMinor: 76000,
      refundMinor: 8000,
      balanceDueMinor: 0,
      currency: "CNY",
    });

    const beta = await login(app, "parent-beta");
    await approvedBinding(app, beta, owner, "student-beta");
    const betaLedger = await request(app, beta, "GET", "/local/fee-ledger");
    assert.equal(betaLedger.statusCode, 200, betaLedger.body);
    const betaResult = betaLedger.json<{
      entries: { studentAlias: string }[];
      reconciliation: { balanceDueMinor: number };
    }>();
    assert.ok(betaResult.entries.every((entry) => entry.studentAlias === "student-beta"));
    assert.equal(betaResult.reconciliation.balanceDueMinor, 52000);
  } finally {
    await app.close();
  }
});

test("an approved parent loses access to October ledger entries at midnight in Shanghai", async () => {
  let now = Date.parse("2026-10-31T23:59:59+08:00");
  const app = await buildLocalSyntheticServer({ mode: "local-synthetic", now: () => now });
  try {
    const owner = await login(app, "owner-east");
    const parent = await login(app, "parent-alpha");
    await approvedBinding(app, parent, owner, "student-alpha");
    const before = await request(app, parent, "GET", "/local/fee-ledger");
    assert.equal(before.statusCode, 200, before.body);
    assert.equal(before.json<{ entries: unknown[] }>().entries.length, 3);

    now = Date.parse("2026-11-01T00:00:00+08:00");
    const after = await request(app, parent, "GET", "/local/fee-ledger");
    assert.equal(after.statusCode, 200, after.body);
    assert.deepEqual(after.json<{ entries: unknown[] }>().entries, []);
  } finally {
    await app.close();
  }
});

test("released parent relationship immediately removes ledger rows and client scope filters are rejected", async () => {
  const app = await buildLocalSyntheticServer({ mode: "local-synthetic", now: duringBillingPeriod });
  try {
    const parent = await login(app, "parent-alpha");
    const owner = await login(app, "owner-east");
    await approvedBinding(app, parent, owner, "student-alpha");
    const bindings = await request(app, parent, "GET", "/local/binding-applications");
    assert.equal(bindings.statusCode, 200, bindings.body);
    const binding = bindings
      .json<{ id: string; version: number; status: string }[]>()
      .find((row) => row.status === "APPROVED");
    assert.ok(binding);

    const released = await request(
      app,
      parent,
      "POST",
      `/local/binding-applications/${binding.id}/release`,
      { version: binding.version },
    );
    assert.equal(released.statusCode, 200, released.body);
    assert.deepEqual(
      (await request(app, parent, "GET", "/local/fee-ledger")).json<{ entries: unknown[] }>()
        .entries,
      [],
    );
    const newParent = await login(app, "parent-beta");
    await approvedBinding(app, newParent, owner, "student-alpha");
    const currentParentLedger = await request(app, newParent, "GET", "/local/fee-ledger");
    assert.equal(currentParentLedger.statusCode, 200, currentParentLedger.body);
    assert.deepEqual(
      currentParentLedger
        .json<{ entries: { studentAlias: string }[] }>()
        .entries.map((entry) => entry.studentAlias),
      ["student-alpha", "student-alpha", "student-alpha"],
    );
    assert.ok(
      (await request(app, newParent, "GET", "/local/fees")).json<{ id: string }[]>().length > 0,
    );
    assert.deepEqual(
      (await request(app, parent, "GET", "/local/fee-ledger")).json<{ entries: unknown[] }>()
        .entries,
      [],
    );
    assert.deepEqual((await request(app, parent, "GET", "/local/fees")).json<unknown[]>(), []);
    assert.equal(
      (await request(app, parent, "GET", "/local/fee-ledger?studentId=student-beta")).statusCode,
      400,
    );
  } finally {
    await app.close();
  }
});

test("campus ledger totals include other classes in the same campus", () => {
  const repository = new LocalRepository();
  const fees = new FeesService(repository, () => Date.parse("2026-10-12T01:00:00.000Z"));
  const otherClass = id(104);
  repository.insert({
    id: "bill-other-class",
    version: 1,
    kind: "feeDocument",
    tenantId: id(100),
    campusId: id(101),
    classId: otherClass,
    studentId: "student-other-class",
    bindingVersion: 2,
    documentType: "BILL",
    title: "另一班合成账单",
    amount: 300,
    currency: "CNY",
    period: "2026-10",
    sourceVersion: 1,
    validFrom: "2026-10-01",
    validTo: "2026-10-31",
    status: "PAID",
    unavailableReason: null,
    summary: "仅用于同校区汇总范围测试。",
  });
  repository.insert({
    id: "ledger-other-class-charge",
    version: 1,
    kind: "financeLedgerEntry",
    tenantId: id(100),
    campusId: id(101),
    classId: otherClass,
    studentId: "student-other-class",
    bindingVersion: 2,
    type: "CHARGE",
    amountMinor: 30000,
    currency: "CNY",
    period: "2026-10",
    occurredOn: "2026-10-02",
    documentId: "bill-other-class",
    documentVersion: 1,
    synthetic: true,
  });

  const owner = memberForActor(id(4));
  assert.ok(owner);
  assert.equal(owner.classIds.includes(otherClass), false);
  const summary = fees.ledgerSummary(owner);
  assert.equal(summary.entryCount, 5);
  assert.equal("chargeMinor" in summary ? summary.chargeMinor : 0, 150000);
  assert.equal("balanceDueMinor" in summary ? summary.balanceDueMinor : 0, 82000);
});

test("campus managers get scoped reconciliation totals while platform admins get counts only", async () => {
  const app = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  try {
    for (const profile of ["owner-west", "owner-other-tenant"]) {
      const otherScope = await login(app, profile);
      const otherSummary = await request(app, otherScope, "GET", "/local/fee-ledger-summary");
      assert.equal(otherSummary.statusCode, 200, otherSummary.body);
      assert.equal(otherSummary.json<{ entryCount: number }>().entryCount, 0);
    }
    const owner = await login(app, "owner-east");
    const ownerResponse = await request(app, owner, "GET", "/local/fee-ledger-summary");
    assert.equal(ownerResponse.statusCode, 200, ownerResponse.body);
    assert.deepEqual(ownerResponse.json(), {
      scope: "campus",
      synthetic: true,
      entryCount: 4,
      countsByType: { CHARGE: 2, PAYMENT: 1, REFUND: 1 },
      chargeMinor: 120000,
      paymentMinor: 76000,
      refundMinor: 8000,
      balanceDueMinor: 52000,
      currency: "CNY",
    });

    const platform = await login(app, "platform-admin");
    const platformResponse = await request(app, platform, "GET", "/local/fee-ledger-summary");
    assert.equal(platformResponse.statusCode, 200, platformResponse.body);
    const anonymous = platformResponse.json<Record<string, unknown>>();
    assert.deepEqual(anonymous, {
      scope: "platform",
      synthetic: true,
      entryCount: 4,
      countsByType: { CHARGE: 2, PAYMENT: 1, REFUND: 1 },
    });
    assert.equal(
      Object.keys(anonymous).some((key) => /amount|minor|student|document/i.test(key)),
      false,
    );

    const teacher = await login(app, "teacher-east");
    assert.equal((await request(app, teacher, "GET", "/local/fee-ledger")).statusCode, 403);
    assert.equal((await request(app, teacher, "GET", "/local/fee-ledger-summary")).statusCode, 403);
    assert.equal((await request(app, owner, "POST", "/local/fee-ledger")).statusCode, 404);
  } finally {
    await app.close();
  }
});
