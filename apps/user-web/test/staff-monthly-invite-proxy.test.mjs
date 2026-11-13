/* global Request, Response, Headers, process */
import assert from "node:assert/strict";
import test from "node:test";
import { GET, POST, PATCH } from "../src/app/api-local/[...path]/handler.ts";

const id = "11111111-1111-4111-8111-111111111111";
const token = "s".repeat(43);
const supplements = {
  learningParticipation: "PROGRESSING",
  dailyHabits: "KEEP_WATCHING",
  activityParticipation: "PROGRESSING",
  familySchoolCollaboration: "FOLLOW_UP",
};
const row = {
  id,
  version: 1,
  sourceVersion: 1,
  month: "2026-10",
  classRef: "合成一班",
  audience: "STAFF_INTERNAL",
  status: "DRAFT",
  supplements,
  sourceCounts: { GROWTH_RECORD: 1, ATTENDANCE_OVERVIEW: 2, STAFF_DAILY: 1 },
  actions: ["edit", "submit"],
};
const ctx = (path) => ({ params: Promise.resolve({ path }) });

test("monthly staff proxy handles non-JSON expiry and strips nested unknown output fields", async () =>
  environment(async () => {
    const path = ["staff", "monthly-feedback"];
    globalThis.fetch = async () => new Response("Unauthorized", { status: 401 });
    let response = await GET(request(path), ctx(path));
    assert.equal(response.status, 401);
    assert.match(response.headers.get("set-cookie") ?? "", /Max-Age=0/iu);
    globalThis.fetch = async () =>
      Response.json({
        data: {
          records: [
            {
              ...row,
              supplements: { ...row.supplements, privateNote: "private" },
              sourceCounts: { ...row.sourceCounts, extra: "private" },
            },
          ],
          canCreate: true,
        },
      });
    response = await GET(request(path), ctx(path));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { data: { records: [row], canCreate: true } });
  }));
function request(path, method = "GET", body, headers = {}, query = "") {
  return new Request("http://127.0.0.1:3000/api-local/" + path.join("/") + query, {
    method,
    headers: {
      origin: "http://127.0.0.1:3000",
      cookie: "student_care_local_session=" + token,
      ...(body ? { "content-type": "application/json" } : {}),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
async function environment(run) {
  const keys = [
    "NODE_ENV",
    "USER_WEB_LOCAL_NEST_API",
    "USER_WEB_NEST_API_BASE_URL",
    "USER_WEB_LOCAL_PREVIEW",
  ];
  const previous = keys.map((key) => [key, process.env[key]]),
    fetcher = globalThis.fetch;
  process.env.NODE_ENV = "development";
  process.env.USER_WEB_LOCAL_NEST_API = "http://127.0.0.1:4321";
  delete process.env.USER_WEB_NEST_API_BASE_URL;
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
test("monthly staff proxy forwards four exact operations with cookie identity and a safe projection", async () =>
  environment(async () => {
    const calls = [];
    globalThis.fetch = async (url, init) => {
      calls.push({ url: String(url), init });
      return Response.json({
        data:
          init.method === "GET"
            ? {
                records: [{ ...row, sources: ["private"], tenantId: "private" }],
                canCreate: true,
                extra: "private",
              }
            : { ...row, sources: ["private"] },
        token: "private",
      });
    };
    for (const [method, path, body] of [
      ["GET", ["staff", "monthly-feedback"]],
      ["POST", ["staff", "monthly-feedback"], { month: row.month, supplements }],
      ["PATCH", ["staff", "monthly-feedback", id], { version: 1, supplements }],
      ["POST", ["staff", "monthly-feedback", id, "submit"], { version: 1 }],
    ]) {
      const response = await { GET, POST, PATCH }[method](
        request(path, method, body, { authorization: "Bearer forged", "x-campus-id": "forged" }),
        ctx(path),
      );
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.deepEqual(await response.json(), {
        data: method === "GET" ? { records: [row], canCreate: true } : row,
      });
      const call = calls.at(-1);
      assert.equal(call.url, "http://127.0.0.1:4321/" + path.join("/"));
      assert.equal(call.init.method, method);
      const headers = new Headers(call.init.headers);
      assert.equal(headers.get("authorization"), "Bearer " + token);
      assert.equal(headers.has("x-campus-id"), false);
    }
  }));
test("monthly staff proxy blocks forged body scope, unknown actions, malformed options, query and cross-origin writes", async () =>
  environment(async () => {
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      return Response.json({ data: row });
    };
    for (const body of [
      { month: row.month, supplements, tenantId: "forged" },
      { month: "2026-13", supplements },
      { month: row.month, supplements: { ...supplements, dailyHabits: ["PROGRESSING"] } },
      { month: row.month, supplements: { ...supplements, unknown: "PROGRESSING" } },
    ])
      assert.equal(
        (
          await POST(
            request(["staff", "monthly-feedback"], "POST", body),
            ctx(["staff", "monthly-feedback"]),
          )
        ).status,
        400,
      );
    assert.equal(
      (
        await PATCH(
          request(["staff", "monthly-feedback", id], "PATCH", { version: 0, supplements }),
          ctx(["staff", "monthly-feedback", id]),
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await GET(
          request(["staff", "monthly-feedback"], "GET", undefined, {}, "?campus_id=forged"),
          ctx(["staff", "monthly-feedback"]),
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await POST(
          request(
            ["staff", "monthly-feedback"],
            "POST",
            { month: row.month, supplements },
            { origin: "https://untrusted.example" },
          ),
          ctx(["staff", "monthly-feedback"]),
        )
      ).status,
      403,
    );
    for (const action of ["publish", "review", "resubmit", "source-refresh"])
      assert.equal(
        (
          await POST(
            request(["staff", "monthly-feedback", id, action], "POST", { version: 1 }),
            ctx(["staff", "monthly-feedback", id, action]),
          )
        ).status,
        404,
      );
    assert.equal(calls, 0);
  }));
test("monthly staff proxy clears expired sessions, preserves status without leaking errors, and rejects malformed lists", async () =>
  environment(async () => {
    const path = ["staff", "monthly-feedback"];
    for (const status of [401, 403, 404, 409]) {
      globalThis.fetch = async () =>
        Response.json(
          {
            error: {
              code: status === 401 ? "UNAUTHENTICATED" : "CONFLICT_STATE",
              message: "private details",
            },
          },
          { status },
        );
      const response = await GET(request(path), ctx(path));
      assert.equal(response.status, status);
      assert.doesNotMatch(JSON.stringify(await response.json()), /private details/u);
      if (status === 401) assert.match(response.headers.get("set-cookie") ?? "", /Max-Age=0/iu);
    }
    for (const data of [
      { records: [row, row], canCreate: true },
      { records: [{ ...row, audience: "PARENT" }], canCreate: true },
      {
        records: [{ ...row, supplements: { ...supplements, dailyHabits: ["PROGRESSING"] } }],
        canCreate: true,
      },
    ]) {
      globalThis.fetch = async () => Response.json({ data });
      assert.equal((await GET(request(path), ctx(path))).status, 502);
    }
    const records = Array.from({ length: 501 }, (_, i) => ({
      ...row,
      id: `11111111-1111-4111-8111-${i.toString(16).padStart(12, "0")}`,
    }));
    globalThis.fetch = async () => Response.json({ data: { records, canCreate: true } });
    const response = await GET(request(path), ctx(path));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).data.records.length, 501);
  }));
