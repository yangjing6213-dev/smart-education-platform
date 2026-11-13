import assert from "node:assert/strict";
import test from "node:test";

const noticeId = "00000000-0000-4000-8000-000000000101";
const rows = [
  {
    id: noticeId,
    version: 2,
    status: "PUBLISHED",
    published: true,
    title: "本周活动安排",
    body: "周五进行合成示例活动。",
    target: "CLASS",
    requiresAcknowledgment: true,
    receiptStatus: "UNREAD",
    synthetic: true,
  },
];

type NoticeClient = {
  readonly snapshot: {
    readonly status: string;
    readonly notices: readonly { readonly id: string; readonly receiptStatus: string }[];
  };
  connect(): Promise<void>;
  refresh(): Promise<void>;
  receipt(id: string, version: number, action: "read" | "ack"): Promise<void>;
};

type NoticeClientConstructor = new (options: {
  readonly baseUrl: string;
  readonly fetcher?: typeof fetch;
}) => NoticeClient;

async function clientConstructor(): Promise<NoticeClientConstructor> {
  const modulePath = "./parent-notices-invite-client.js";
  const loaded: unknown = await import(modulePath).catch(() => undefined);
  assert.ok(loaded, "家长通知必须使用邀请会话客户端，而不是固定模拟身份。");
  assert.ok(typeof loaded === "object" && loaded !== null);
  assert.ok("ParentNoticesInviteClient" in loaded);
  return (loaded as { ParentNoticesInviteClient: NoticeClientConstructor })
    .ParentNoticesInviteClient;
}

function response(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ data }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("invited notice client uses only same-origin cookies and acknowledges after reading", async () => {
  const Client = await clientConstructor();
  const calls: { url: URL; init: RequestInit }[] = [];
  let receiptStatus = "UNREAD";
  const client = new Client({
    baseUrl: "http://127.0.0.1:3000",
    fetcher: async (input, init = {}) => {
      const url = input instanceof URL ? input : new URL(String(input));
      calls.push({ url, init });
      if (url.pathname === "/api-local/parent/notices" && init.method !== "POST") {
        return response(rows.map((row) => ({ ...row, receiptStatus })));
      }
      const action = url.pathname.endsWith("/read") ? "read" : "ack";
      receiptStatus = action === "read" ? "READ" : "ACKNOWLEDGED";
      return response({ ...rows[0], receiptStatus });
    },
  });

  await client.connect();
  assert.equal(client.snapshot.status, "READY");
  assert.equal(client.snapshot.notices[0]?.receiptStatus, "UNREAD");
  assert.equal(calls[0]?.url.pathname, "/api-local/parent/notices");
  assert.equal(calls[0]?.init.credentials, "same-origin");
  assert.equal(new Headers(calls[0]?.init.headers).has("authorization"), false);

  await client.receipt(noticeId, 2, "ack");
  assert.equal(calls.length, 1, "acknowledgement before reading must not send a request");
  await client.receipt(noticeId, 2, "read");
  assert.equal(client.snapshot.notices[0]?.receiptStatus, "READ");
  await client.receipt(noticeId, 2, "ack");
  assert.equal(client.snapshot.notices[0]?.receiptStatus, "ACKNOWLEDGED");
  await client.refresh();
  assert.equal(client.snapshot.notices[0]?.receiptStatus, "ACKNOWLEDGED");
  assert.ok(calls.every(({ url }) => url.origin === "http://127.0.0.1:3000"));
});

test("invited notice client accepts an HTTPS page origin and keeps requests same-origin", async () => {
  const Client = await clientConstructor();
  const calls: { url: URL; init: RequestInit }[] = [];
  const client = new Client({
    baseUrl: "https://trial.example",
    fetcher: async (input, init = {}) => {
      const url = input instanceof URL ? input : new URL(String(input));
      calls.push({ url, init });
      return response(rows);
    },
  });

  await client.connect();

  assert.equal(client.snapshot.status, "READY");
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.url.origin, "https://trial.example");
  assert.equal(calls[0]?.url.pathname, "/api-local/parent/notices");
  assert.equal(calls[0]?.init.credentials, "same-origin");
  assert.equal(new Headers(calls[0]?.init.headers).has("authorization"), false);
});

test("invited notice client rejects unsafe origins and clears old rows after authorization failure", async () => {
  const Client = await clientConstructor();
  for (const baseUrl of [
    "http://example.invalid",
    "https://user:password@example.invalid",
    "https://example.invalid/path",
    "https://example.invalid/?query=1",
    "https://example.invalid/#fragment",
  ])
    assert.throws(() => new Client({ baseUrl }), /本机地址或 HTTPS 同源地址/u);
  let fail = false;
  const client = new Client({
    baseUrl: "http://127.0.0.1:3000",
    fetcher: async () => (fail ? response({ error: "forbidden" }, 403) : response(rows)),
  });
  await client.connect();
  assert.equal(client.snapshot.notices.length, 1);
  fail = true;
  await client.refresh();
  assert.equal(client.snapshot.status, "DENIED");
  assert.deepEqual(client.snapshot.notices, []);
});

test("invited notice client clears visible rows when a receipt is denied", async () => {
  const Client = await clientConstructor();
  let denyReceipt = false;
  const client = new Client({
    baseUrl: "http://127.0.0.1:3000",
    fetcher: async (input) => {
      const url = input instanceof URL ? input : new URL(String(input));
      if (denyReceipt && url.pathname.endsWith("/read"))
        return response({ error: "forbidden" }, 403);
      return response(rows);
    },
  });
  await client.connect();
  denyReceipt = true;
  await assert.rejects(() => client.receipt(noticeId, 2, "read"));
  assert.equal(client.snapshot.status, "DENIED");
  assert.deepEqual(client.snapshot.notices, []);
});

test("invited notice client rejects unsafe or over-broad notice rows", async () => {
  const Client = await clientConstructor();
  for (const invalid of [
    { ...rows[0], classId: "00000000-0000-4000-8000-000000000201" },
    { ...rows[0], status: "DRAFT" },
    { ...rows[0], synthetic: false },
    { ...rows[0], receiptStatus: "UNKNOWN" },
  ]) {
    const client = new Client({
      baseUrl: "http://127.0.0.1:3000",
      fetcher: async () => response([invalid]),
    });
    await client.connect();
    assert.notEqual(client.snapshot.status, "READY");
    assert.deepEqual(client.snapshot.notices, []);
  }
});
