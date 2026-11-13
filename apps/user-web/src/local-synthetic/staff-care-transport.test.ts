import assert from "node:assert/strict";
import test from "node:test";
import { createStaffCareTransport } from "./staff-care-transport.js";
const id = "00000000-0000-4000-8000-0000000000c8";

test("staff care adapter maps only teacher care and student endpoints with bounded transport", async () => {
  const sent: { url: string; init?: RequestInit }[] = [];
  const transport = createStaffCareTransport(
    "http://127.0.0.1:4400",
    async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      sent.push({ url: String(input), ...(init ? { init } : {}) });
      return Response.json({ ok: true });
    },
  );
  const endpoints = [
    ["GET", "/local/session"],
    ["GET", "/local/student-options"],
    ["GET", "/local/care-records"],
    ["POST", "/local/care-records"],
    ["PATCH", "/local/care-records/" + id],
    ...["submit", "withdraw", "resubmit"].map(
      (action) => ["POST", "/local/care-records/" + id + "/" + action] as const,
    ),
  ] as const;
  for (const [method, path] of endpoints) {
    const response = await transport(path, {
      method,
      credentials: "include",
      cache: "force-cache",
      redirect: "follow",
    });
    assert.equal(response.status, 200);
    const request = sent.at(-1)!;
    assert.equal(request.url, "http://127.0.0.1:4400/staff-local" + path.slice("/local".length));
    assert.equal(request.init?.method, method);
    assert.equal(request.init?.credentials, "omit");
    assert.equal(request.init?.cache, "no-store");
    assert.equal(request.init?.redirect, "error");
    assert.ok(request.init?.signal instanceof AbortSignal);
  }
  const errorTransport = createStaffCareTransport("http://127.0.0.1:4400", async () =>
    Response.json({ error: { code: "STATE_CONFLICT" } }, { status: 409 }),
  );
  const errorResponse = await errorTransport("/local/care-records", { method: "GET" });
  assert.equal(errorResponse.status, 409);
  assert.deepEqual(
    await errorResponse.json(),
    { error: { code: "STATE_CONFLICT" } },
    "错误正文必须保留给已有客户端消费。",
  );
});

test("staff care adapter refuses unrelated routes, identities and unsafe URLs without sending", async () => {
  let sent = 0;
  const transport = createStaffCareTransport("http://127.0.0.1:4400", async () => {
    sent += 1;
    return Response.json({});
  });
  const requests = [
    ["GET", "/local/profiles"],
    ["GET", "/local/resources"],
    ["GET", "/local/care-records/" + id],
    ["POST", "/local/care-records/" + id + "/review"],
    ["POST", "/local/care-records/" + id + "/publish"],
    ["POST", "/local/care-records/" + id + "/receipt"],
    ["PATCH", "/local/staff-tasks/" + id],
    ["DELETE", "/local/care-records/" + id],
    ["GET", "/local/student-options?campusId=other"],
    ["GET", "/local/care-records#fragment"],
    ["GET", "http://name@127.0.0.1:4400/local/care-records"],
    ["GET", "https://example.com/local/care-records"],
    ["PATCH", "/local/care-records/not-a-uuid"],
  ];
  for (const [method, path] of requests)
    assert.equal((await transport(path!, { method: method! })).status, 403);
  for (const body of [
    undefined,
    "{}",
    JSON.stringify({ profile: "owner-east" }),
    JSON.stringify({ profile: "teacher-east", extra: true }),
  ])
    assert.equal(
      (await transport("/local/sessions", { method: "POST", ...(body ? { body } : {}) })).status,
      403,
    );
  assert.equal(sent, 0);
  assert.equal(
    (
      await transport("/local/sessions", {
        method: "POST",
        body: JSON.stringify({ profile: "teacher-east" }),
      })
    ).status,
    200,
  );
  assert.equal(sent, 1);
  for (const base of [
    "https://example.com",
    "http://127.0.0.1:4400/path",
    "http://a@127.0.0.1:4400",
    "http://127.0.0.1:4400?q=x",
    "http://127.0.0.1:4400#x",
  ])
    assert.throws(() => createStaffCareTransport(base), /本机/u);
});
