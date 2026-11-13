/* global Headers, Request, Response, URL, process */

import assert from "node:assert/strict";
import test from "node:test";

const routeUrl = new URL("../src/app/api/admin/[...path]/handler.ts", import.meta.url);
const routeModule = await import(routeUrl.href);
const TOKEN = "v".repeat(43);
const REQUEST_ID = "11111111-1111-4111-8111-111111111111";

function context(path) {
  return { params: Promise.resolve({ path }) };
}

function request(path, { method = "GET", body, cookie = `student_care_admin_session=${TOKEN}` } = {}) {
  const headers = new Headers({ origin: "http://127.0.0.1:3000", host: "127.0.0.1:3000" });
  if (cookie) headers.set("cookie", cookie);
  if (body !== undefined) headers.set("content-type", "application/json");
  return new Request(new URL("/api/admin/" + path.join("/"), "http://127.0.0.1:3000"), {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function withEnvironment(run) {
  const previous = {
    NODE_ENV: process.env.NODE_ENV,
    ADMIN_WEB_LOCAL_NEST_API: process.env.ADMIN_WEB_LOCAL_NEST_API,
    ADMIN_WEB_NEST_API_BASE_URL: process.env.ADMIN_WEB_NEST_API_BASE_URL,
  };
  process.env.NODE_ENV = "development";
  process.env.ADMIN_WEB_LOCAL_NEST_API = "http://127.0.0.1:4321";
  delete process.env.ADMIN_WEB_NEST_API_BASE_URL;
  try {
    await run();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("invite proxy exposes a minimal leave-review projection and sends the server-held identity", async () => {
  await withEnvironment(async () => {
    const originalFetch = globalThis.fetch;
    const calls = [];
    const upstreamRow = {
      id: REQUEST_ID,
      student_id: "22222222-2222-4222-8222-222222222222",
      student_display_ref: "示例学生甲",
      class_ref: "三年级一班",
      start_date: "2026-10-22",
      end_date: "2026-10-22",
      reason_category: "FAMILY_ARRANGEMENT",
      status: "SUBMITTED",
      version: 1,
      acknowledged: false,
      actions: ["confirm", "return"],
      updated_at: "2026-10-19T02:00:00.000Z",
      tenant_id: "must-not-reach-browser",
      campus_id: "must-not-reach-browser",
      guardian_id: "must-not-reach-browser",
      requester_user_id: "must-not-reach-browser",
    };
    globalThis.fetch = async (input, init = {}) => {
      calls.push({ url: String(input), init });
      return Response.json({ data: [upstreamRow] });
    };
    try {
      const response = await routeModule.GET(
        request(["staff", "leave-requests"]),
        context(["staff", "leave-requests"]),
      );
      assert.equal(response.status, 200);
      const payload = await response.json();
      assert.deepEqual(payload.data, [
        {
          id: REQUEST_ID,
          student_display_ref: "示例学生甲",
          class_ref: "三年级一班",
          start_date: "2026-10-22",
          end_date: "2026-10-22",
          reason_category: "FAMILY_ARRANGEMENT",
          status: "SUBMITTED",
          version: 1,
          acknowledged: false,
        },
      ]);
      assert.doesNotMatch(JSON.stringify(payload), /tenant_id|campus_id|guardian_id|student_id/u);
      assert.equal(calls.length, 1);
      assert.equal(calls[0].url, "http://127.0.0.1:4321/staff/leave-requests");
      assert.equal(new Headers(calls[0].init.headers).get("authorization"), `Bearer ${TOKEN}`);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test("invite proxy accepts only versioned leave decisions and the exact review route", async () => {
  await withEnvironment(async () => {
    const originalFetch = globalThis.fetch;
    const calls = [];
    globalThis.fetch = async (input, init = {}) => {
      calls.push({ url: String(input), init });
      return Response.json({
        data: {
          id: REQUEST_ID,
          student_id: "22222222-2222-4222-8222-222222222222",
          student_display_ref: "示例学生甲",
          class_ref: "三年级一班",
          start_date: "2026-10-22",
          end_date: "2026-10-22",
          reason_category: "FAMILY_ARRANGEMENT",
          status: "CONFIRMED",
          version: 2,
          acknowledged: false,
          actions: [],
          updated_at: "2026-10-19T02:01:00.000Z",
          campus_id: "must-not-reach-browser",
        },
      });
    };
    try {
      const path = ["staff", "leave-requests", REQUEST_ID, "review"];
      const response = await routeModule.POST(
        request(path, { method: "POST", body: { version: 1, action: "confirm" } }),
        context(path),
      );
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), {
        data: { id: REQUEST_ID, status: "CONFIRMED", version: 2 },
      });
      assert.equal(calls.length, 1);
      assert.equal(calls[0].url, `http://127.0.0.1:4321/staff/leave-requests/${REQUEST_ID}/review`);
      assert.deepEqual(JSON.parse(calls[0].init.body), { version: 1, action: "confirm" });

      const invalid = await routeModule.POST(
        request(path, {
          method: "POST",
          body: { version: 1, action: "confirm", campus_id: "forged" },
        }),
        context(path),
      );
      assert.equal(invalid.status, 400);
      const unknown = await routeModule.GET(
        request(["staff", "leave-requests", "not-a-request"]),
        context(["staff", "leave-requests", "not-a-request"]),
      );
      assert.equal(unknown.status, 404);
      assert.equal(calls.length, 1, "invalid and unlisted requests must not reach the upstream service");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
