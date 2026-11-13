/* global Request, Response, Headers, process, URL */
import assert from "node:assert/strict";
import test from "node:test";
const proxy = await import(
  new URL("../src/app/api/admin/[...path]/handler.ts", import.meta.url).href
);
const id = "11111111-1111-4111-8111-111111111111";
const token = "s".repeat(43);
const row = {
  id,
  version: 3,
  date: "2026-10-23",
  status: "SUBMITTED",
  authorLabel: "合成教师",
  values: {
    arrival: "ARRIVED_AS_PLANNED",
    homework: "COMPLETED",
    activity: "PARTICIPATED",
    classroom: "ROUTINE",
    followUp: "NONE",
  },
  sourceCounts: { TASK: 1, ATTENDANCE: 0, CARE_RECORD: 0, PICKUP: 0, PICKUP_EXCEPTION: 0 },
  learningSummary: null,
  actions: ["confirm", "return"],
};
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
const context = (path) => ({ params: Promise.resolve({ path }) });
async function environment(run) {
  const previous = Object.fromEntries(
    ["NODE_ENV", "ADMIN_WEB_LOCAL_NEST_API", "ADMIN_WEB_NEST_API_BASE_URL"].map((k) => [
      k,
      process.env[k],
    ]),
  );
  const originalFetch = globalThis.fetch;
  process.env.NODE_ENV = "development";
  process.env.ADMIN_WEB_LOCAL_NEST_API = "http://127.0.0.1:4321";
  try {
    await run();
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}
test("daily proxy retains all 501 valid pending and historical records", async () =>
  environment(async () => {
    const records = Array.from({ length: 501 }, (_, index) => ({
      ...row,
      id: `11111111-1111-4111-8111-${index.toString(16).padStart(12, "0")}`,
      status: index % 2 ? "RETURNED" : "SUBMITTED",
      actions: index % 2 ? [] : ["confirm", "return"],
    }));
    globalThis.fetch = async () => Response.json({ data: { records } });
    const response = await proxy.GET(request(["daily-reports"]), context(["daily-reports"]));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { data: { records } });
  }));

test("daily audit proxy accepts only scoped read routes and returns its safe event projection", async () =>
  environment(async () => {
    const calls = [];
    const events = [
      {
        action: "CREATED",
        reportVersion: 1,
        actorLabel: "合成教师",
        initiatedByLabel: "合成教师",
        occurredAt: "2026-10-30T08:00:00.000Z",
      },
    ];
    globalThis.fetch = async (url, init) => {
      calls.push({ url: String(url), init });
      return Response.json({ data: { events } });
    };
    const path = ["daily-reports", id, "audit-events"];
    const response = await proxy.GET(request(path), context(path));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { data: { events } });
    assert.equal(calls[0].url, `http://127.0.0.1:4321/admin/daily-reports/${id}/audit-events`);
    assert.equal(new Headers(calls[0].init.headers).get("authorization"), "Bearer " + token);
    assert.equal(response.headers.get("cache-control"), "no-store");

    const before = calls.length;
    for (const invalid of [
      ["daily-reports", "bad", "audit-events"],
      ["daily-reports", id, "other"],
    ])
      assert.equal((await proxy.GET(request(invalid), context(invalid))).status, 404);
    assert.equal(calls.length, before);
  }));

test("daily proxy uses server-held identity, strips private fields and never caches", async () =>
  environment(async () => {
    const calls = [];
    const path = ["daily-reports"];
    globalThis.fetch = async (url, init) => {
      calls.push({ url: String(url), init });
      return Response.json({
        data: {
          records: [{ ...row, tenantId: "private", createdBy: "private", sourceRefs: ["private"] }],
        },
      });
    };
    const response = await proxy.GET(
      request(path, "GET", undefined, { authorization: "Bearer forged", "x-tenant-id": "forged" }),
      context(path),
    );
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { data: { records: [row] } });
    assert.equal(calls[0].url, "http://127.0.0.1:4321/admin/daily-reports");
    const headers = new Headers(calls[0].init.headers);
    assert.equal(headers.get("authorization"), "Bearer " + token);
    assert.equal(headers.has("x-tenant-id"), false);
    assert.equal(headers.has("cookie"), false);
    assert.equal(response.headers.get("cache-control"), "no-store");
  }));
test("daily proxy accepts only exact versioned review and withdrawal requests", async () =>
  environment(async () => {
    const calls = [];
    globalThis.fetch = async (url, init) => {
      calls.push({ url: String(url), body: JSON.parse(init.body) });
      return Response.json({ data: { ...row, status: "RETURNED", actions: [] } });
    };
    for (const [action, body] of [
      ["review", { version: 3, action: "CONFIRM" }],
      ["review", { version: 3, action: "RETURN" }],
      ["withdraw", { version: 4 }],
    ]) {
      const path = ["daily-reports", id, action];
      assert.equal((await proxy.POST(request(path, "POST", body), context(path))).status, 200);
      assert.deepEqual(calls.at(-1), {
        url: "http://127.0.0.1:4321/admin/" + path.join("/"),
        body,
      });
    }
    const before = calls.length;
    for (const [path, method, body, headers, query, status] of [
      [["daily-reports"], "GET", undefined, { cookie: "" }, "", 401],
      [["daily-reports"], "GET", undefined, {}, "?campusId=forged", 400],
      [
        ["daily-reports", id, "review"],
        "POST",
        { version: 3, action: "CONFIRM" },
        { origin: "https://foreign.invalid" },
        "",
        403,
      ],
      [
        ["daily-reports", id, "review"],
        "POST",
        { version: 3, action: "CONFIRM", tenantId: "forged" },
        {},
        "",
        400,
      ],
      [["daily-reports", id, "review"], "POST", { version: 0, action: "CONFIRM" }, {}, "", 400],
      [["daily-reports", id, "withdraw"], "POST", { version: 4, action: "RETURN" }, {}, "", 400],
      [["daily-reports", "bad", "review"], "POST", { version: 1, action: "CONFIRM" }, {}, "", 404],
      [["daily-reports", id, "publish"], "POST", { version: 1 }, {}, "", 404],
    ])
      assert.equal(
        (await proxy[method](request(path, method, body, headers, query), context(path))).status,
        status,
      );
    assert.equal(calls.length, before);
    process.env.NODE_ENV = "production";
    process.env.ADMIN_WEB_NEST_API_BASE_URL = "https://127.0.0.1:4321";
    assert.equal(
      (await proxy.GET(request(["daily-reports"]), context(["daily-reports"]))).status,
      503,
    );
    assert.equal(calls.length, before);
  }));
test("daily proxy rejects malformed upstream records and preserves failure statuses", async () =>
  environment(async () => {
    const path = ["daily-reports"];
    for (const bad of [
      { ...row, date: "2026-02-30" },
      { ...row, actions: ["withdraw"] },
      { ...row, authorLabel: "" },
      { ...row, sourceCounts: { ...row.sourceCounts, TASK: -1 } },
      {
        ...row,
        learningSummary: {
          completedLearnerBand: "1",
          usedGuidance: false,
          needsTeacherFollowUp: false,
        },
      },
    ]) {
      globalThis.fetch = async () => Response.json({ data: { records: [bad] } });
      assert.equal((await proxy.GET(request(path), context(path))).status, 502);
    }
    globalThis.fetch = async () => Response.json({ data: { records: [row, row] } });
    assert.equal((await proxy.GET(request(path), context(path))).status, 502);
    for (const status of [401, 403, 409, 503]) {
      globalThis.fetch = async () =>
        Response.json({ error: { message: "private internal details" } }, { status });
      const response = await proxy.GET(request(path), context(path));
      assert.equal(response.status, status);
      assert.doesNotMatch(await response.text(), /private internal/);
    }
  }));
