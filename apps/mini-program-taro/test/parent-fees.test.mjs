import assert from "node:assert/strict";
import test from "node:test";

const feesModule = await import("../src/fees/parent-fees.ts").catch((error) => {
  if (error?.code === "ERR_MODULE_NOT_FOUND") return null;
  throw error;
});

const studentId = "00000000-0000-4000-8000-000000000341";
const documentId = "00000000-0000-4000-8000-000000000342";
const projection = {
  bindingApplications: [
    {
      id: "00000000-0000-4000-8000-000000000343",
      relationship: "GUARDIAN",
      studentAlias: "student-00000000",
      studentLabel: "合成学生甲",
      status: "APPROVED",
    },
  ],
  documents: [
    {
      id: documentId,
      version: 1,
      documentType: "BILL",
      title: "十月服务费用",
      studentId,
      studentAlias: "student-00000000",
      studentLabel: "合成学生甲",
      status: "AVAILABLE",
      amount: 480,
      currency: "CNY",
      period: "2026-10",
      sourceVersion: 1,
      validFrom: "2026-10-01",
      validTo: "2026-10-31",
      available: true,
      summary: "本地合成费用说明。",
      synthetic: true,
    },
  ],
  ledger: {
    scope: "parent",
    synthetic: true,
    entries: [
      {
        id: "00000000-0000-4000-8000-000000000344",
        type: "CHARGE",
        amountMinor: 48000,
        currency: "CNY",
        period: "2026-10",
        occurredOn: "2026-10-01",
        documentId,
        documentVersion: 1,
        studentAlias: "student-00000000",
        studentLabel: "合成学生甲",
        synthetic: true,
      },
    ],
    reconciliation: {
      chargeMinor: 48000,
      paymentMinor: 0,
      refundMinor: 0,
      balanceDueMinor: 48000,
      currency: "CNY",
    },
  },
};

test("parent fee reader uses the authenticated endpoint and keeps internal identifiers out of its projection", async () => {
  assert.ok(feesModule?.loadParentFees, "the parent fee reader must exist");
  const requests = [];
  const result = await feesModule.loadParentFees(async (path) => {
    requests.push(path);
    return projection;
  });

  assert.deepEqual(requests, ["/parent/fees"]);
  assert.deepEqual(result, {
    documents: [
      {
        key: documentId,
        documentType: "BILL",
        title: "十月服务费用",
        studentLabel: "合成学生甲",
        status: "AVAILABLE",
        amount: 480,
        currency: "CNY",
        period: "2026-10",
        validFrom: "2026-10-01",
        validTo: "2026-10-31",
        summary: "本地合成费用说明。",
      },
    ],
    reconciliation: {
      chargeMinor: 48000,
      paymentMinor: 0,
      refundMinor: 0,
      balanceDueMinor: 48000,
      currency: "CNY",
    },
  });
  assert.equal(JSON.stringify(result).includes(studentId), false);
});

test("parent fee reader rejects malformed totals and unexpected private response fields", async () => {
  assert.ok(feesModule?.loadParentFees, "the parent fee reader must exist");
  for (const invalid of [
    { ...projection, internalModelLog: "synthetic" },
    {
      ...projection,
      ledger: {
        ...projection.ledger,
        reconciliation: { ...projection.ledger.reconciliation, balanceDueMinor: -1 },
      },
    },
    {
      ...projection,
      documents: [{ ...projection.documents[0], staffNote: "not parent-facing" }],
    },
    {
      ...projection,
      ledger: {
        ...projection.ledger,
        reconciliation: {
          ...projection.ledger.reconciliation,
          balanceDueMinor: 47999,
        },
      },
    },
    {
      ...projection,
      ledger: {
        ...projection.ledger,
        reconciliation: {
          ...projection.ledger.reconciliation,
          chargeMinor: 47000,
          balanceDueMinor: 47000,
        },
      },
    },
    {
      ...projection,
      documents: [{ ...projection.documents[0], validFrom: "2026-02-31" }],
    },
  ]) {
    await assert.rejects(
      feesModule.loadParentFees(async () => invalid),
      /费用|格式/u,
    );
  }
});

test("parent fee reader rejects internal identifiers embedded in displayed labels", async () => {
  assert.ok(feesModule?.loadParentFees, "the parent fee reader must exist");
  const invalid = {
    ...projection,
    documents: [
      {
        ...projection.documents[0],
        studentLabel: "合成学生 00000000-0000-4000-8000-000000000399",
      },
    ],
  };
  await assert.rejects(
    feesModule.loadParentFees(async () => invalid),
    /费用|格式/u,
  );
});

test("parent fee reader accepts an unlinked binding label without exposing binding metadata", async () => {
  assert.ok(feesModule?.loadParentFees, "the parent fee reader must exist");
  const result = await feesModule.loadParentFees(async () => ({
    ...projection,
    bindingApplications: [{ ...projection.bindingApplications[0], studentLabel: null }],
  }));
  assert.deepEqual(Object.keys(result).sort(), ["documents", "reconciliation"]);
  assert.equal(result.documents.length, 1);
  assert.equal(JSON.stringify(result).includes("00000000-0000-4000-8000-000000000343"), false);
});
