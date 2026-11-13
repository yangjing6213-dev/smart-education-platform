/* global Request, Response, Headers, process */
import assert from "node:assert/strict";
import { ReadableStream } from "node:stream/web";
import test from "node:test";
import { setImmediate as nextTurn } from "node:timers/promises";
import { GET, POST } from "../src/app/api/admin/[...path]/handler.ts";
const id = "11111111-1111-4111-8111-111111111111",
  token = "s".repeat(43);
const row = {
  id,
  version: 1,
  sourceVersion: 1,
  month: "2026-10",
  classRef: "合成一班",
  audience: "STAFF_INTERNAL",
  status: "SUBMITTED",
  supplements: {
    learningParticipation: "PROGRESSING",
    dailyHabits: "KEEP_WATCHING",
    activityParticipation: "PROGRESSING",
    familySchoolCollaboration: "FOLLOW_UP",
  },
  sourceCounts: { GROWTH_RECORD: 1, ATTENDANCE_OVERVIEW: 2, STAFF_DAILY: 1 },
  actions: ["confirm", "return"],
};
const ctx = (path) => ({ params: Promise.resolve({ path }) });

for (const cancellation of ["pending", "rejected"]) {
  test(`expired identity and monthly errors return independently of stream cancellation (${cancellation})`, async () =>
    environment(async () => {
      for (const [path, status] of [
        [["me"], 401],
        [["monthly-feedback"], 403],
        [["child-monthly-reports"], 401],
      ]) {
        let finish;
        let cancelled = false;
        globalThis.fetch = async () =>
          new Response(
            new ReadableStream({
              cancel() {
                cancelled = true;
                if (cancellation === "rejected")
                  return Promise.reject(new Error("private upstream detail"));
                return new Promise((resolve) => {
                  finish = resolve;
                });
              },
            }),
            { status },
          );
        try {
          const pending = GET(request(path), ctx(path));
          const response = await Promise.race([pending, nextTurn().then(() => null)]);
          assert.ok(cancelled);
          assert.ok(response, "error response must not wait for cancellation");
          assert.equal(response.status, status);
          assert.equal(
            /Max-Age=0/iu.test(response.headers.get("set-cookie") ?? ""),
            status === 401,
          );
          assert.doesNotMatch(await response.text(), /private upstream detail/u);
        } finally {
          finish?.();
        }
      }
    }));
}

test("monthly review startup and queue clear expired cookies even for non-JSON upstream errors", async () =>
  environment(async () => {
    for (const path of [["monthly-feedback"], ["me"]]) {
      globalThis.fetch = async () => new Response("Unauthorized", { status: 401 });
      const response = await GET(request(path), ctx(path));
      assert.equal(response.status, 401);
      assert.match(response.headers.get("set-cookie") ?? "", /Max-Age=0/iu);
      assert.doesNotMatch(JSON.stringify(await response.json()), /Unauthorized/u);
    }
  }));
function request(path, method = "GET", body, headers = {}, query = "") {
  return new Request("http://127.0.0.1:3000/api/admin/" + path.join("/") + query, {
    method,
    headers: {
      host: "127.0.0.1:3000",
      origin: "http://127.0.0.1:3000",
      cookie: "student_care_admin_session=" + token,
      ...(body ? { "content-type": "application/json" } : {}),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
async function environment(run) {
  const keys = [
    "NODE_ENV",
    "ADMIN_WEB_LOCAL_NEST_API",
    "ADMIN_WEB_NEST_API_BASE_URL",
    "ADMIN_WEB_LOCAL_PREVIEW",
  ];
  const previous = keys.map((k) => [k, process.env[k]]),
    fetcher = globalThis.fetch;
  process.env.NODE_ENV = "development";
  process.env.ADMIN_WEB_LOCAL_NEST_API = "http://127.0.0.1:4321";
  delete process.env.ADMIN_WEB_NEST_API_BASE_URL;
  try {
    await run();
  } finally {
    globalThis.fetch = fetcher;
    for (const [k, v] of previous) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}
test("monthly admin proxy maps three operations, forwards only cookie auth and strips private fields", async () =>
  environment(async () => {
    const calls = [];
    globalThis.fetch = async (url, init) => {
      calls.push({ url: String(url), init });
      return Response.json({
        data:
          init.method === "GET"
            ? { records: [{ ...row, tenantId: "private", sources: ["private"] }], canCreate: false }
            : { ...row, tenantId: "private" },
        access_token: "private",
      });
    };
    for (const [path, body] of [
      [["monthly-feedback"]],
      [["monthly-feedback", id, "review"], { version: 1, action: "CONFIRM" }],
      [["monthly-feedback", id, "publish"], { version: 1 }],
    ]) {
      const method = body ? "POST" : "GET";
      const response = await (body ? POST : GET)(
        request(path, method, body, { authorization: "Bearer forged", "x-tenant-id": "forged" }),
        ctx(path),
      );
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.deepEqual(await response.json(), {
        data: body ? row : { records: [row], canCreate: false },
      });
      const call = calls.at(-1);
      assert.equal(call.url, "http://127.0.0.1:4321/admin/" + path.join("/"));
      const headers = new Headers(call.init.headers);
      assert.equal(headers.get("authorization"), "Bearer " + token);
      assert.equal(headers.has("x-tenant-id"), false);
    }
  }));
test("monthly admin proxy rejects invalid inputs, forbidden operations, query and cross-site writes before forwarding", async () =>
  environment(async () => {
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      return Response.json({ data: row });
    };
    for (const body of [
      { version: 0, action: "CONFIRM" },
      { version: 1, action: ["CONFIRM"] },
      { version: 1, action: "PUBLISH" },
      { version: 1, action: "CONFIRM", campusId: "forged" },
    ]) {
      const path = ["monthly-feedback", id, "review"];
      assert.equal((await POST(request(path, "POST", body), ctx(path))).status, 400);
    }
    const path = ["monthly-feedback", id, "publish"];
    assert.equal(
      (await POST(request(path, "POST", { version: 1, extra: true }), ctx(path))).status,
      400,
    );
    assert.equal(
      (
        await POST(
          request(path, "POST", { version: 1 }, { origin: "https://untrusted.example" }),
          ctx(path),
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await GET(
          request(["monthly-feedback"], "GET", undefined, {}, "?tenant_id=forged"),
          ctx(["monthly-feedback"]),
        )
      ).status,
      400,
    );
    for (const action of ["submit", "source-refresh", "resubmit"]) {
      const p = ["monthly-feedback", id, action];
      assert.equal((await POST(request(p, "POST", { version: 1 }), ctx(p))).status, 404);
    }
    assert.equal(
      (await POST(request(["monthly-feedback"], "POST", {}), ctx(["monthly-feedback"]))).status,
      404,
    );
    assert.equal(calls, 0);
  }));
test("monthly admin proxy clears expired cookie, preserves error status and fails closed on invalid records", async () =>
  environment(async () => {
    const path = ["monthly-feedback"];
    for (const status of [401, 403, 404, 409]) {
      globalThis.fetch = async () =>
        Response.json(
          { error: { code: "UNAUTHENTICATED", message: "private details" } },
          { status },
        );
      const response = await GET(request(path), ctx(path));
      assert.equal(response.status, status);
      assert.doesNotMatch(JSON.stringify(await response.json()), /private details/u);
      if (status === 401) assert.match(response.headers.get("set-cookie") ?? "", /Max-Age=0/iu);
    }
    for (const data of [
      { records: [row, row], canCreate: false },
      { records: [{ ...row, audience: "PARENT" }], canCreate: false },
      { records: [{ ...row, actions: ["confirm", ["return"]] }], canCreate: false },
    ]) {
      globalThis.fetch = async () => Response.json({ data });
      assert.equal((await GET(request(path), ctx(path))).status, 502);
    }
    const records = Array.from({ length: 501 }, (_, i) => ({
      ...row,
      id: `11111111-1111-4111-8111-${i.toString(16).padStart(12, "0")}`,
    }));
    globalThis.fetch = async () => Response.json({ data: { records, canCreate: false } });
    const response = await GET(request(path), ctx(path));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).data.records.length, 501);
  }));
