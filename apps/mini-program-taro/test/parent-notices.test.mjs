import assert from "node:assert/strict";
import test from "node:test";

const api = await import("../src/notices/parent-notices.ts").catch((error) => {
  if (error.code === "ERR_MODULE_NOT_FOUND") return null;
  throw error;
});
const id = "00000000-0000-4000-8000-000000000339";
function notice(changes = {}) {
  return {
    id,
    version: 2,
    status: "PUBLISHED",
    published: true,
    title: "本周活动安排",
    body: "合成通知，请阅读活动安排。",
    target: "CLASS",
    requiresAcknowledgment: true,
    receiptStatus: "UNREAD",
    synthetic: true,
    ...changes,
  };
}

test("loads only the authenticated parent notice list without client scope claims", async () => {
  assert.ok(api?.loadParentNotices);
  const calls = [];
  const result = await api.loadParentNotices(async (...args) => {
    calls.push(args);
    return [notice()];
  });
  assert.deepEqual(calls, [["/parent/notices"]]);
  assert.deepEqual(result, [notice()]);
  assert.deepEqual(await api.loadParentNotices(async () => []), []);
});

test("rejects private, unpublished, malformed and duplicate records without partial display", async () => {
  assert.ok(api?.loadParentNotices);
  const invalid = [
    {},
    [notice({ published: false })],
    [notice({ status: "DRAFT" })],
    [notice({ synthetic: false })],
    [notice({ tenant_id: id })],
    [notice({ version: 0 })],
    [notice({ version: 1.5 })],
    [notice({ id: "../another" })],
    [notice({ receiptStatus: "DONE" })],
    [notice({ requiresAcknowledgment: "true" })],
    [notice({ target: "STUDENT" })],
    [notice({ receiptStatus: ["READ"] })],
    [notice({ body: " " })],
    [notice({ title: `学生 ${id}` })],
    [notice(), notice()],
    [notice(), notice({ id: "invalid" })],
  ];
  for (const response of invalid) {
    await assert.rejects(
      api.loadParentNotices(async () => response),
      /通知/u,
    );
  }
});

test("records read then acknowledgment with only the selected version and validates the receipt", async () => {
  assert.ok(api?.recordParentNoticeReceipt);
  const calls = [];
  const post = async (...args) => {
    calls.push(args);
    return notice({ receiptStatus: args[0].endsWith("/read") ? "READ" : "ACKNOWLEDGED" });
  };
  const read = await api.recordParentNoticeReceipt(post, notice(), "read");
  await api.recordParentNoticeReceipt(post, read, "ack");
  assert.deepEqual(calls, [
    [`/parent/notices/${id}/read`, { version: 2 }],
    [`/parent/notices/${id}/ack`, { version: 2 }],
  ]);
  const neverPost = async () => assert.fail("invalid receipt must not reach the API");
  await assert.rejects(api.recordParentNoticeReceipt(neverPost, notice(), "ack"), /阅读/u);
  await assert.rejects(api.recordParentNoticeReceipt(neverPost, notice(), "delete"), /通知/u);
  await assert.rejects(api.recordParentNoticeReceipt(neverPost, notice({ version: -1 }), "read"));
  for (const response of [
    notice(),
    notice({ version: 3, receiptStatus: "READ" }),
    notice({ id: "00000000-0000-4000-8000-000000000340", receiptStatus: "READ" }),
  ]) {
    await assert.rejects(
      api.recordParentNoticeReceipt(async () => response, notice(), "read"),
      /通知/u,
    );
  }
  assert.equal(
    (
      await api.recordParentNoticeReceipt(
        async () => notice({ receiptStatus: "ACKNOWLEDGED" }),
        notice(),
        "read",
      )
    ).receiptStatus,
    "ACKNOWLEDGED",
  );
  await assert.rejects(
    api.recordParentNoticeReceipt(
      async () => notice({ receiptStatus: "READ" }),
      notice({ receiptStatus: "READ" }),
      "ack",
    ),
    /通知/u,
  );
});
