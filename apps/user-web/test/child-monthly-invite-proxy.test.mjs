/* global Request, Response, Headers, process */
import assert from "node:assert/strict";
import test from "node:test";
import { GET, POST, PATCH } from "../src/app/api-local/[...path]/handler.ts";
const id = "11111111-1111-4111-8111-111111111111",
  studentId = "22222222-2222-4222-8222-222222222222",
  relation = "33333333-3333-4333-8333-333333333333",
  token = "s".repeat(43);
const supplements = {
  learningParticipation: "PROGRESSING",
  dailyHabits: "KEEP_WATCHING",
  activityParticipation: "PROGRESSING",
  familySchoolCollaboration: "FOLLOW_UP",
};
const row = {
  id,
  studentId,
  studentLabel: "合成孩子甲",
  classRef: "合成甲班",
  month: "2026-10",
  status: "DRAFT",
  version: 1,
  sourceVersion: 1,
  publicationVersion: 0,
  supplements,
  sourceCounts: { GROWTH_RECORD: 0, ATTENDANCE_OVERVIEW: 1 },
  actions: ["edit", "submit"],
};
const parentRow = {
  id,
  studentId,
  studentLabel: row.studentLabel,
  month: row.month,
  publicationVersion: 1,
  relationshipVersion: 2,
  supplements,
  sourceCounts: row.sourceCounts,
  acknowledged: false,
};
const staff = ["staff", "child-monthly-reports"],
  parent = ["parent", "relationships", relation, "monthly-reports"];
const ctx = (path) => ({ params: Promise.resolve({ path }) });
function req(path, method = "GET", body, headers = {}, query = "") {
  return new Request("http://127.0.0.1:3000/api-local/" + path.join("/") + query, {
    method,
    headers: {
      origin: "http://127.0.0.1:3000",
      cookie: "student_care_local_session=" + token,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
const handler = { GET, POST, PATCH };
async function env(run) {
  const keys = [
      "NODE_ENV",
      "USER_WEB_LOCAL_NEST_API",
      "USER_WEB_NEST_API_BASE_URL",
      "USER_WEB_LOCAL_PREVIEW",
    ],
    before = keys.map((k) => [k, process.env[k]]),
    fetcher = globalThis.fetch;
  process.env.NODE_ENV = "development";
  process.env.USER_WEB_LOCAL_NEST_API = "http://127.0.0.1:4321";
  delete process.env.USER_WEB_NEST_API_BASE_URL;
  try {
    await run();
  } finally {
    globalThis.fetch = fetcher;
    for (const [k, v] of before) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}
const operations = [
  [
    staff,
    "GET",
    undefined,
    {
      records: [row],
      students: [{ id: studentId, displayRef: row.studentLabel, classRef: row.classRef }],
    },
  ],
  [staff, "POST", { studentId, month: row.month, supplements }, row],
  [[...staff, id], "PATCH", { version: 1, supplements }, row],
  [[...staff, id, "submit"], "POST", { version: 1 }, row],
  [parent, "GET", undefined, { records: [parentRow] }],
  [
    [...parent, id, "ack"],
    "POST",
    { publicationVersion: 1, relationshipVersion: 2 },
    { acknowledged: true },
  ],
];

test("parent relationship expiry clears the invite cookie even with a non-JSON upstream response", async () =>
  env(async () => {
    globalThis.fetch = async () => new Response("private upstream stack", { status: 401 });
    const path = ["guardian-relationships"];
    const response = await GET(req(path), ctx(path));
    assert.equal(response.status, 401);
    assert.match(response.headers.get("set-cookie") ?? "", /Max-Age=0/u);
    assert.doesNotMatch(JSON.stringify(await response.json()), /private|stack/u);
  }));
test("child monthly proxy forwards six exact operations using only the invite cookie", async () =>
  env(async () => {
    for (const [path, method, body, data] of operations) {
      let call;
      globalThis.fetch = async (url, init) => {
        call = { url: String(url), init };
        return Response.json(
          { data, internalNote: "private" },
          { status: method === "POST" && path.length === 2 ? 201 : 200 },
        );
      };
      const result = await handler[method](req(path, method, body), ctx(path));
      assert.equal(result.status, method === "POST" && path.length === 2 ? 201 : 200);
      assert.deepEqual(await result.json(), { data });
      assert.equal(call.url, "http://127.0.0.1:4321/" + path.join("/"));
      const headers = new Headers(call.init.headers);
      assert.equal(headers.get("authorization"), "Bearer " + token);
      assert.equal(headers.get("cookie"), null);
      assert.equal(call.init.cache, "no-store");
      assert.equal(call.init.redirect, "error");
      assert.ok(call.init.signal);
      assert.deepEqual(call.init.body === undefined ? undefined : JSON.parse(call.init.body), body);
    }
  }));
test("child monthly proxy rejects scope injection, extra fields, bad versions and cross-origin writes before upstream", async () =>
  env(async () => {
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      return Response.json({ data: row });
    };
    for (const [path, method, body] of operations) {
      assert.equal(
        (await handler[method](req(path, method, body, {}, "?tenantId=forged"), ctx(path))).status,
        400,
      );
      assert.equal(
        (await handler[method](req(path, method, body, { "x-campus-id": id }), ctx(path))).status,
        400,
      );
      assert.equal(
        (await handler[method](req(path, method, body, { cookie: "" }), ctx(path))).status,
        401,
      );
      if (body) {
        assert.equal(
          (await handler[method](req(path, method, { ...body, extra: true }), ctx(path))).status,
          400,
        );
        assert.equal(
          (
            await handler[method](
              req(path, method, body, { origin: "https://example.invalid" }),
              ctx(path),
            )
          ).status,
          403,
        );
      }
    }
    for (const body of [
      { publicationVersion: 0, relationshipVersion: 2 },
      { publicationVersion: 1, relationshipVersion: "2" },
      { publicationVersion: 1 },
      { publicationVersion: 1, relationshipVersion: 1.5 },
    ])
      assert.equal(
        (await POST(req([...parent, id, "ack"], "POST", body), ctx([...parent, id, "ack"]))).status,
        400,
      );
    for (const body of [
      { studentId: "bad", month: row.month, supplements },
      { studentId, month: "2026-13", supplements },
      { studentId, month: row.month, supplements: { ...supplements, privateNote: "x" } },
    ])
      assert.equal((await POST(req(staff, "POST", body), ctx(staff))).status, 400);
    for (const path of [
      [...staff, id, "publish"],
      [...parent, id, "delete"],
      ["parent", "relationships", "bad", "monthly-reports"],
    ])
      assert.equal((await POST(req(path, "POST", {}), ctx(path))).status, 404);
    assert.equal(calls, 0);
  }));
test("child monthly proxy clears expired cookies and preserves safe errors without upstream details", async () =>
  env(async () => {
    for (const status of [400, 401, 403, 404, 409, 500])
      for (const path of [staff, parent]) {
        globalThis.fetch = async () =>
          new Response("private stack and internal identifiers", { status });
        const result = await GET(req(path), ctx(path));
        assert.equal(result.status, status);
        assert.doesNotMatch(JSON.stringify(await result.json()), /private|stack|internal/u);
        if (status === 401) assert.match(result.headers.get("set-cookie") ?? "", /Max-Age=0/u);
      }
  }));
test("child monthly proxy removes internal fields and rejects invalid success payloads", async () =>
  env(async () => {
    globalThis.fetch = async () =>
      Response.json({
        data: {
          records: [
            {
              ...parentRow,
              tenantId: id,
              classRef: "private",
              sources: ["secret"],
              supplements: { ...supplements, note: "secret" },
              sourceCounts: { ...row.sourceCounts, STAFF_DAILY: 3 },
            },
          ],
          secret: "hidden",
        },
      });
    assert.deepEqual(await (await GET(req(parent), ctx(parent))).json(), {
      data: { records: [parentRow] },
    });
    for (const data of [
      { records: [{ ...parentRow, relationshipVersion: 0 }] },
      { records: [{ ...parentRow, studentId: "bad" }] },
      { records: [parentRow, parentRow] },
      { records: [{ ...parentRow, supplements: { ...supplements, dailyHabits: "UNKNOWN" } }] },
    ]) {
      globalThis.fetch = async () => Response.json({ data });
      assert.equal((await GET(req(parent), ctx(parent))).status, 502);
    }
    globalThis.fetch = async () =>
      Response.json({ data: { records: [{ ...row, sourceVersion: 0 }], students: [] } });
    assert.equal((await GET(req(staff), ctx(staff))).status, 502);
    globalThis.fetch = async () => Response.json({ data: { acknowledged: false } });
    assert.equal(
      (
        await POST(
          req([...parent, id, "ack"], "POST", { publicationVersion: 1, relationshipVersion: 2 }),
          ctx([...parent, id, "ack"]),
        )
      ).status,
      502,
    );
  }));
test("child monthly proxy keeps valid rows beyond five hundred and fails closed on transport errors", async () =>
  env(async () => {
    const records = Array.from({ length: 501 }, (_, i) => ({
      ...parentRow,
      id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
    }));
    globalThis.fetch = async () => Response.json({ data: { records } });
    const result = await GET(req(parent), ctx(parent));
    assert.equal(result.status, 200);
    assert.equal((await result.json()).data.records.length, 501);
    globalThis.fetch = async () => {
      throw new Error("private transport detail");
    };
    const failed = await GET(req(parent), ctx(parent));
    assert.equal(failed.status, 503);
    assert.doesNotMatch(JSON.stringify(await failed.json()), /private transport/u);
  }));
