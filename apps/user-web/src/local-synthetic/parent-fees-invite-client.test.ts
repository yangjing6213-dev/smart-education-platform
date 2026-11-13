import assert from "node:assert/strict";
import test from "node:test";
import { ParentFeesInviteClient } from "./parent-fees-invite-client.js";

const bindingId = "00000000-0000-4000-8000-000000000101";
const studentId = "00000000-0000-4000-8000-0000000000c8";

function feesPayload(status: "PENDING" | "APPROVED") {
  const approved = status === "APPROVED";
  return {
    data: {
      bindingApplications: [
        { id: bindingId, relationship: "GUARDIAN", studentAlias: "student-alpha", studentLabel: "示例学生甲", status },
      ],
      documents: approved
        ? [
            {
              id: "fee-item-alpha",
              version: 1,
              studentId,
              studentAlias: "student-alpha",
              studentLabel: "示例学生甲",
              documentType: "BILL",
              title: "合成费用单",
              period: "2026年10月",
              amount: 680,
              currency: "CNY",
              status: "AVAILABLE",
              sourceVersion: 1,
              validFrom: "2026-10-01",
              validTo: "2026-10-31",
              available: true,
              summary: "仅供本机流程验证的合成费用资料。",
              synthetic: true,
            },
          ]
        : [],
      ledger: {
        scope: "parent",
        synthetic: true,
        entries: approved
          ? [
              {
                id: "ledger-alpha-charge",
                type: "CHARGE",
                amountMinor: 68000,
                currency: "CNY",
                period: "2026-10",
                occurredOn: "2026-10-01",
                documentId: "fee-item-alpha",
                documentVersion: 1,
                studentAlias: "student-alpha",
                studentLabel: "示例学生甲",
                synthetic: true,
              },
            ]
          : [],
        reconciliation: {
          chargeMinor: approved ? 68000 : 0,
          paymentMinor: 0,
          refundMinor: 0,
          balanceDueMinor: approved ? 68000 : 0,
          currency: "CNY",
        },
      },
    },
    request_id: "00000000-0000-4000-8000-000000000102",
  };
}

test("invited parent fees client reads only the same-origin endpoint and projects approved synthetic data", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const client = new ParentFeesInviteClient({
    baseUrl: "https://parent.example",
    fetcher: async (input, init) => {
      calls.push(init ? { url: String(input), init } : { url: String(input) });
      return new Response(JSON.stringify(feesPayload("APPROVED")), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  await client.connect();

  assert.equal(client.snapshot.status, "READY");
  assert.equal(client.snapshot.bindingStatus, "APPROVED");
  assert.equal(client.snapshot.documents.length, 1);
  assert.equal(client.snapshot.ledger?.entries.length, 1);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.url, "https://parent.example/api-local/parent/fees");
  assert.equal(calls[0]?.init?.method, "GET");
  assert.equal(calls[0]?.init?.credentials, "same-origin");
  assert.equal(new Headers(calls[0]?.init?.headers).has("authorization"), false);
  assert.equal(calls[0]?.init?.body, undefined);
});

test("invited parent can view records for multiple approved children with matching labels", async () => {
  const base = feesPayload("APPROVED");
  const firstDocument = base.data.documents[0]!;
  const firstEntry = base.data.ledger.entries[0]!;
  const multiChildPayload = {
    ...base,
    data: {
      ...base.data,
      bindingApplications: [
        ...base.data.bindingApplications,
        { ...base.data.bindingApplications[0]!, id: "00000000-0000-4000-8000-000000000103", studentAlias: "student-beta", studentLabel: "示例学生乙" },
      ],
      documents: [
        firstDocument,
        { ...firstDocument, id: "00000000-0000-4000-8000-000000000104", studentId: "00000000-0000-4000-8000-000000000105", studentAlias: "student-beta", studentLabel: "示例学生乙", title: "合成课程费" },
      ],
      ledger: {
        ...base.data.ledger,
        entries: [
          firstEntry,
          { ...firstEntry, id: "ledger-beta-charge", documentId: "fee-item-beta", studentAlias: "student-beta", studentLabel: "示例学生乙" },
        ],
        reconciliation: { ...base.data.ledger.reconciliation, chargeMinor: 136000, balanceDueMinor: 136000 },
      },
    },
  };
  const client = new ParentFeesInviteClient({
    baseUrl: "https://parent.example",
    fetcher: async () => new Response(JSON.stringify(multiChildPayload), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  });

  await client.connect();

  assert.equal(client.snapshot.status, "READY");
  assert.deepEqual(client.snapshot.documents.map((row) => row.studentLabel), ["示例学生甲", "示例学生乙"]);
  assert.deepEqual(client.snapshot.ledger?.entries.map((row) => row.studentLabel), ["示例学生甲", "示例学生乙"]);
});

test("pending or missing invitation access never keeps fee rows visible", async () => {
  const client = new ParentFeesInviteClient({
    baseUrl: "http://localhost:3000",
    fetcher: async () =>
      new Response(JSON.stringify(feesPayload("PENDING")), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
  });

  await client.connect();

  assert.equal(client.snapshot.status, "READY");
  assert.equal(client.snapshot.bindingStatus, "PENDING");
  assert.deepEqual(client.snapshot.documents, []);
  assert.equal(client.snapshot.ledger, null);
});

for (const [status, expectedState] of [[401, "SIGNED_OUT"], [403, "DENIED"], [503, "ERROR"]] as const) {
  test(`refresh after HTTP ${status} clears previously visible fees and reports ${expectedState}`, async () => {
    let expired = false;
    const client = new ParentFeesInviteClient({
      baseUrl: "https://parent.example",
      fetcher: async () =>
        expired
          ? new Response("PRIVATE", { status })
          : Response.json(feesPayload("APPROVED")),
    });
    await client.connect();
    assert.equal(client.snapshot.documents.length, 1);
    assert.equal(client.snapshot.ledger?.entries.length, 1);
    expired = true;
    await client.refresh();
    assert.equal(client.snapshot.status, expectedState);
    assert.equal(client.snapshot.bindingStatus, "NONE");
    assert.deepEqual(client.snapshot.documents, []);
    assert.equal(client.snapshot.ledger, null);
    assert.doesNotMatch(client.snapshot.message, /PRIVATE/u);
    if (status === 403) assert.doesNotMatch(client.snapshot.message, /登录/u);
  });
}
