import assert from "node:assert/strict";
import test from "node:test";
import {
  ParentHealthInviteClient,
  type ParentHealthInviteRecord,
} from "./parent-health-invite-client.js";

const record: ParentHealthInviteRecord = {
  id: "00000000-0000-4000-8000-000000000102",
  version: 1,
  status: "PUBLISHED",
  published: true,
  date: "2026-10-19",
  title: "机构已发布健康跟进摘要",
  parentSummary: "后续跟进正在进行。",
  receiptStatus: "UNREAD",
  synthetic: true,
};

const serverRecord = {
  id: record.id,
  version: record.version,
  status: "PUBLISHED" as const,
  studentLabel: "模拟学生甲",
  parentSummary: "后续跟进正在进行。",
  receiptStatus: "UNREAD" as const,
  updatedAt: "2026-10-19T08:30:00.000Z",
  synthetic: true as const,
};
test("parent health client reads, requires READ before ACK, and sends same-origin cookie requests", async () => {
  const requests: { url: URL; init: RequestInit }[] = [];
  const client = new ParentHealthInviteClient({
    baseUrl: "http://127.0.0.1:3000",
    fetcher: async (input, init = {}) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      requests.push({ url, init });
      const receiptStatus = url.pathname.endsWith("/read")
        ? "READ"
        : url.pathname.endsWith("/ack")
          ? "ACKNOWLEDGED"
          : "UNREAD";
      return Response.json({
        data: init.method === "GET" ? [serverRecord] : { ...serverRecord, receiptStatus },
      });
    },
  });

  await client.connect();
  await client.receipt(record.id, record.version, "ack");
  assert.deepEqual(
    client.snapshot.records.map(({ receiptStatus }) => receiptStatus),
    ["UNREAD"],
  );
  assert.equal(requests.length, 1, "ACK before READ must not send a request");

  await client.receipt(record.id, record.version, "read");
  await client.receipt(record.id, record.version, "ack");
  assert.deepEqual(
    client.snapshot.records.map(({ receiptStatus }) => receiptStatus),
    ["ACKNOWLEDGED"],
  );
  assert.deepEqual(
    requests.map(({ url, init }) => [
      url.pathname,
      init.method,
      init.credentials,
    ]),
    [
      ["/api-local/parent/health-incidents", "GET", "same-origin"],
      [
        `/api-local/parent/health-incidents/${record.id}/read`,
        "POST",
        "same-origin",
      ],
      [
        `/api-local/parent/health-incidents/${record.id}/ack`,
        "POST",
        "same-origin",
      ],
    ],
  );
  assert.equal(
    requests.some(({ init }) => new Headers(init.headers).has("authorization")),
    false,
  );
});

test("parent health client rejects non-loopback origins", () => {
  assert.throws(
    () => new ParentHealthInviteClient({ baseUrl: "http://example.com" }),
    /本机地址或 HTTPS 同源地址/u,
  );
});

test("parent health client accepts an HTTPS page origin and keeps requests same-origin", async () => {
  const requests: { url: URL; init: RequestInit }[] = [];
  const client = new ParentHealthInviteClient({
    baseUrl: "https://trial.example",
    fetcher: async (input, init = {}) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      requests.push({ url, init });
      return Response.json({ data: [serverRecord] });
    },
  });

  await client.connect();

  assert.equal(client.snapshot.status, "READY");
  assert.equal(requests.length, 1);
  assert.equal(requests[0]?.url.origin, "https://trial.example");
  assert.equal(requests[0]?.url.pathname, "/api-local/parent/health-incidents");
  assert.equal(requests[0]?.init.credentials, "same-origin");
  assert.equal(
    new Headers(requests[0]?.init.headers).has("authorization"),
    false,
  );
});

test("parent health client clears summaries after an authorization failure", async () => {
  let denied = false;
  const client = new ParentHealthInviteClient({
    baseUrl: "http://127.0.0.1:3000",
    fetcher: async () =>
      denied
        ? Response.json({ error: { code: "UNAUTHENTICATED" } }, { status: 401 })
        : Response.json({ data: [serverRecord] }),
  });

  await client.connect();
  assert.equal(client.snapshot.records.length, 1);
  denied = true;
  await client.refresh();
  assert.equal(client.snapshot.status, "DENIED");
  assert.deepEqual(client.snapshot.records, []);
});

test("parent health client rejects a response that exposes internal health or relationship fields", async () => {
  const client = new ParentHealthInviteClient({
    baseUrl: "http://127.0.0.1:3000",
    fetcher: async () =>
      Response.json({
        data: [{ ...serverRecord, studentId: "synthetic-internal-id" }],
      }),
  });

  await client.connect();
  assert.equal(client.snapshot.status, "ERROR");
  assert.deepEqual(client.snapshot.records, []);
});

test("parent health client maps the current Nest parent-view DTO through list, READ, and ACK", async () => {
  const requests: { url: URL; init: RequestInit }[] = [];
  const client = new ParentHealthInviteClient({
    baseUrl: "http://127.0.0.1:3000",
    fetcher: async (input, init = {}) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      requests.push({ url, init });
      const receiptStatus = url.pathname.endsWith("/read")
        ? "READ"
        : url.pathname.endsWith("/ack")
          ? "ACKNOWLEDGED"
          : "UNREAD";
      return Response.json({
        data:
          init.method === "GET"
            ? [serverRecord]
            : { ...serverRecord, receiptStatus },
      });
    },
  });

  await client.connect();

  assert.equal(client.snapshot.status, "READY");
  assert.deepEqual(client.snapshot.records, [
    {
      id: record.id,
      version: record.version,
      status: "PUBLISHED",
      published: true,
      date: "2026-10-19",
      title: "模拟学生甲",
      parentSummary: "后续跟进正在进行。",
      receiptStatus: "UNREAD",
      synthetic: true,
    },
  ]);

  await client.receipt(record.id, record.version, "ack");
  assert.equal(requests.length, 1, "ACK before READ must not send a request");
  await client.receipt(record.id, record.version, "read");
  await client.receipt(record.id, record.version, "ack");

  assert.deepEqual(
    client.snapshot.records.map(({ receiptStatus }) => receiptStatus),
    ["ACKNOWLEDGED"],
  );
  assert.deepEqual(
    requests.map(({ url }) => url.pathname),
    [
      "/api-local/parent/health-incidents",
      `/api-local/parent/health-incidents/${record.id}/read`,
      `/api-local/parent/health-incidents/${record.id}/ack`,
    ],
  );
});
test("parent health client rejects impossible calendar dates in updatedAt", async () => {
  const client = new ParentHealthInviteClient({
    baseUrl: "http://127.0.0.1:3000",
    fetcher: async () =>
      Response.json({
        data: [
          { ...serverRecord, updatedAt: "2026-02-31T08:30:00.000Z" },
        ],
      }),
  });

  await client.connect();

  assert.equal(client.snapshot.status, "ERROR");
  assert.deepEqual(client.snapshot.records, []);
});
