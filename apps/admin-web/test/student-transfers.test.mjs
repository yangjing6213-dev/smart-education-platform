import assert from "node:assert/strict";
import test from "node:test";
import {
  parseTransferRecord,
  parseTransferListing,
  createTransfer,
  reviewTransfer,
  loadTransfers,
} from "../src/app/admin/student-transfers/student-transfers-client.ts";

const id = "66666666-6666-4666-8666-666666666666";
const actor = "55555555-5555-4555-8555-555555555555";
const record = {
  id,
  studentId: id,
  studentLabel: "示例学生甲",
  sourceClassRef: "合成甲班",
  destinationClassRef: "合成乙班",
  status: "PENDING",
  version: 1,
  requestedAt: "2026-10-30T08:00:00.000Z",
  reviewedAt: null,
  isOwnRequest: true,
  canReview: false,
  canApprove: false,
  events: [
    { action: "CREATED", version: 1, actorId: actor, occurredAt: "2026-10-30T08:00:00.000Z" },
  ],
};
const listing = {
  students: [{ id, label: "示例学生甲", classRef: "合成甲班" }],
  destinationClasses: ["合成甲班", "合成乙班"],
  requests: [record],
  canRequest: true,
  canReview: false,
};

test("transfer projections reject malformed or contradictory approval and audit states", () => {
  assert.deepEqual(parseTransferRecord(record), record);
  assert.deepEqual(parseTransferListing(listing), listing);
  for (const invalid of [
    { ...record, canReview: true },
    { ...record, canApprove: true },
    { ...record, events: [] },
    { ...record, version: 2 },
    { ...record, status: "APPROVED" },
    { ...record, tenant_id: id },
  ])
    assert.equal(parseTransferRecord(invalid), undefined);
  assert.equal(
    parseTransferListing({
      ...listing,
      canReview: false,
      requests: [{ ...record, isOwnRequest: false, canReview: true }],
    }),
    undefined,
  );
});

test("transfer client uses same-origin cookies, minimal input, and never replays a failed mutation", async () => {
  const calls = [];
  const fetcher = async (url, init) => {
    calls.push({ url, init });
    return new globalThis.Response(
      JSON.stringify({
        data: url.endsWith("/review")
          ? {
              ...record,
              status: "REJECTED",
              version: 2,
              reviewedAt: "2026-10-30T08:01:00.000Z",
              events: [
                ...record.events,
                {
                  action: "REJECTED",
                  version: 2,
                  actorId: id,
                  occurredAt: "2026-10-30T08:01:00.000Z",
                },
              ],
            }
          : init.method === "GET"
            ? listing
            : record,
      }),
    );
  };
  await loadTransfers(fetcher);
  await createTransfer({ student_id: id, destination_class_ref: "合成乙班" }, fetcher);
  await reviewTransfer(id, { decision: "REJECT", expected_version: 1 }, fetcher);
  assert.deepEqual(
    calls.map((c) => [c.url, c.init.method]),
    [
      ["/api/admin/student-transfers", "GET"],
      ["/api/admin/student-transfers", "POST"],
      [`/api/admin/student-transfers/${id}/review`, "POST"],
    ],
  );
  assert.deepEqual(JSON.parse(calls[1].init.body), {
    student_id: id,
    destination_class_ref: "合成乙班",
  });
  assert.ok(
    calls.every((c) => c.init.credentials === "same-origin" && c.init.redirect === "error"),
  );
  await assert.rejects(
    createTransfer({ student_id: id, destination_class_ref: "合成乙班", campus_id: id }, fetcher),
  );
  assert.equal(calls.length, 3);
  let attempts = 0;
  await assert.rejects(
    createTransfer({ student_id: id, destination_class_ref: "合成乙班" }, async () => {
      attempts++;
      throw new Error("internal network details");
    }),
    /刷新/u,
  );
  assert.equal(attempts, 1);
  const rejectedResponse = new globalThis.Response("{}", { status: 409 });
  await assert.rejects(
    reviewTransfer(id, { decision: "APPROVE", expected_version: 1 }, async () => rejectedResponse),
    /状态已变化/u,
  );
  assert.equal(
    rejectedResponse.bodyUsed,
    true,
    "Consume the error response before allowing refresh or navigation.",
  );
});
