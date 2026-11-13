import assert from "node:assert/strict";
import test from "node:test";
import { URL } from "node:url";
import {
  AdminLeaveReviewClient,
  createAdminLeaveReviewTransport,
} from "../dist/local-review/leave-review-client.js";

const handle = "a".repeat(43);
const request = {
  id: "00000000-0000-4000-8000-000000000321",
  version: 1,
  bindingId: "00000000-0000-4000-8000-000000000103",
  status: "SUBMITTED",
  startDate: "2026-12-01",
  endDate: "2026-12-02",
  reason: "FAMILY_ARRANGEMENT",
  acknowledged: false,
  studentId: "00000000-0000-4000-8000-000000000200",
  studentLabel: "示例学生甲",
  guardianLabel: "示例监护人甲",
  updatedBy: "00000000-0000-4000-8000-000000000001",
  updatedAt: "2026-10-13T00:00:00.000Z",
  history: [],
};

test("transport permits only loopback leave-review requests with approved methods", async () => {
  const calls = [];
  const transport = createAdminLeaveReviewTransport("http://127.0.0.1:4317", async (url, init) => {
    calls.push({ url: String(url), init });
    return new globalThis.Response("[]", { status: 200 });
  });
  await assert.rejects(
    async () => createAdminLeaveReviewTransport("https://example.invalid:4317", globalThis.fetch),
    /本机/u,
  );
  assert.equal((await transport("/local/leave-requests", { method: "GET" })).status, 200);
  assert.equal(
    (
      await transport("/local/leave-requests/00000000-0000-4000-8000-000000000321/review", {
        method: "POST",
      })
    ).status,
    200,
  );
  assert.equal(
    (await transport("https://example.invalid/local/leave-requests", { method: "GET" })).status,
    403,
  );
  assert.equal((await transport("/local/profiles", { method: "GET" })).status, 403);
  assert.equal((await transport("/local/leave-requests", { method: "POST" })).status, 403);
  assert.equal(calls.length, 2);
});

test("client uses the fixed campus reviewer, reads the shared queue, and reviews with the shown version", async () => {
  let rows = [request];
  const calls = [];
  const fetcher = async (url, init = {}) => {
    const path = new URL(String(url)).pathname;
    const method = init.method ?? "GET";
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({
      path,
      method,
      body,
      authorization: new globalThis.Headers(init.headers).get("authorization"),
    });
    if (path === "/local/sessions" && method === "POST")
      return globalThis.Response.json(
        { mode: "local-synthetic", handle, expiresAt: "2026-10-13T00:30:00.000Z" },
        { status: 201 },
      );
    if (path === "/local/session" && method === "GET")
      return globalThis.Response.json({
        mode: "local-synthetic",
        profile: "owner-east",
        actorId: "00000000-0000-4000-8000-000000000001",
        tenantId: "00000000-0000-4000-8000-000000000064",
        campusId: "00000000-0000-4000-8000-000000000065",
        classIds: ["00000000-0000-4000-8000-000000000103"],
        actions: ["leave:review"],
      });
    if (path === "/local/leave-requests" && method === "GET") return globalThis.Response.json(rows);
    if (path.endsWith("/review") && method === "POST") {
      assert.deepEqual(body, { version: 1, action: "confirm" });
      rows = [{ ...request, status: "CONFIRMED", version: 2 }];
      return globalThis.Response.json(rows[0]);
    }
    return globalThis.Response.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  };
  const client = new AdminLeaveReviewClient({ baseUrl: "http://127.0.0.1:4317", fetcher });

  await client.connect();
  assert.equal(client.snapshot.status, "READY");
  assert.equal(client.snapshot.profile, "owner-east");
  assert.equal(client.snapshot.records[0]?.id, request.id);
  assert.ok(
    calls
      .filter((call) => call.path !== "/local/sessions")
      .every((call) => call.authorization === `Bearer ${handle}`),
  );

  await client.review(request.id, request.version, "CONFIRM");
  assert.equal(client.snapshot.records[0]?.status, "CONFIRMED");
  assert.equal(client.snapshot.records[0]?.version, 2);
  assert.ok(calls.some((call) => call.path === `/local/leave-requests/${request.id}/review`));
  assert.equal(client.snapshot.message, "已通过申请，家长端可刷新查看。");
});

test("malformed remote rows fail closed and do not remain visible", async () => {
  const fetcher = async (url) => {
    const path = new URL(String(url)).pathname;
    if (path === "/local/sessions")
      return globalThis.Response.json(
        { mode: "local-synthetic", handle, expiresAt: "2026-10-13T00:30:00.000Z" },
        { status: 201 },
      );
    if (path === "/local/session")
      return globalThis.Response.json({
        mode: "local-synthetic",
        profile: "owner-east",
        actorId: "00000000-0000-4000-8000-000000000001",
        tenantId: "00000000-0000-4000-8000-000000000064",
        campusId: "00000000-0000-4000-8000-000000000065",
        classIds: [],
        actions: ["leave:review"],
      });
    return globalThis.Response.json([{ ...request, studentLabel: "真人姓名" }]);
  };
  const client = new AdminLeaveReviewClient({ baseUrl: "http://127.0.0.1:4317", fetcher });
  await client.connect();
  assert.equal(client.snapshot.status, "ERROR");
  assert.deepEqual(client.snapshot.records, []);
});
