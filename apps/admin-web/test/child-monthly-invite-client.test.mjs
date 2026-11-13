/* global Response, URL, Headers */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

async function load() {
  const file = new URL(
    "../src/app/admin/child-monthly-review/child-monthly-review-client.ts",
    import.meta.url,
  );
  assert.ok(existsSync(file), "The monthly review invite client must be implemented.");
  return import(file.href);
}

const identity = {
  display_name: "合成负责人",
  memberships: [{ status: "ACTIVE", capabilities: ["feedback:read", "feedback:review"] }],
};
const row = {
  id: "11111111-1111-4111-8111-111111111111",
  version: 3,
  sourceVersion: 2,
  month: "2026-10",
  classRef: "合成甲班",
  studentId: "22222222-2222-4222-8222-222222222222",
  studentLabel: "模拟孩子甲",
  publicationVersion: 0,
  status: "SUBMITTED",
  supplements: {
    learningParticipation: "PROGRESSING",
    dailyHabits: "KEEP_WATCHING",
    activityParticipation: "FOLLOW_UP",
    familySchoolCollaboration: "PROGRESSING",
  },
  sourceCounts: { GROWTH_RECORD: 2, ATTENDANCE_OVERVIEW: 3 },
  actions: ["confirm", "return"],
};
const listing = (records = [row]) => ({ records, students: [] });
const ok = (data) => Response.json({ data, request_id: "synthetic-request" });
const denied = (status) =>
  Response.json({ error: { message: "private internal details" } }, { status });
const deferred = () => {
  let resolve;
  const promise = new Promise((release) => {
    resolve = release;
  });
  return { promise, resolve };
};

test("child monthly projection preserves all legal states and actions while removing private fields", async () => {
  const { parseChildMonthlyRecord } = await load();
  for (const [status, actions] of [
    ["DRAFT", ["edit", "submit"]],
    ["SUBMITTED", ["confirm", "return"]],
    ["RETURNED", ["edit"]],
    ["CONFIRMED", ["return", "publish"]],
    ["PUBLISHED", []],
    ["REVIEW_REQUIRED", ["edit"]],
  ]) {
    const expected = { ...row, status, actions };
    const parsed = parseChildMonthlyRecord({
      ...expected,
      tenantId: "private",
      createdByMembershipId: "private",
      sources: ["private"],
      supplements: { ...row.supplements, internalNote: "private" },
      sourceCounts: { ...row.sourceCounts, privateCount: 10 },
    });
    assert.deepEqual(parsed, expected);
    assert.notEqual(parsed.supplements, row.supplements);
  }
  for (const month of ["1900-01", "2199-12"])
    assert.equal(parseChildMonthlyRecord({ ...row, month }).month, month);
});

test("child monthly projection rejects malformed identity, versions, months, options, counts and actions", async () => {
  const { parseChildMonthlyRecord, parseChildMonthlyListing } = await load();
  for (const bad of [
    null,
    [],
    { ...row, id: "bad" },
    { ...row, studentId: "bad" },
    { ...row, studentLabel: "" },
    { ...row, studentLabel: "x".repeat(121) },
    { ...row, publicationVersion: 1.5 },
    { ...row, classRef: "" },
    { ...row, version: 0 },
    { ...row, version: "3" },
    { ...row, sourceVersion: Number.MAX_SAFE_INTEGER + 1 },
    { ...row, month: "1899-12" },
    { ...row, month: "2200-01" },
    { ...row, month: "2026-13" },
    { ...row, classRef: "x".repeat(81) },
    { ...row, publicationVersion: -1 },
    { ...row, status: "APPROVED" },
    { ...row, supplements: { ...row.supplements, dailyHabits: ["PROGRESSING"] } },
    { ...row, supplements: { ...row.supplements, dailyHabits: "UNKNOWN" } },
    { ...row, sourceCounts: { ...row.sourceCounts, GROWTH_RECORD: -1 } },
    { ...row, sourceCounts: { ...row.sourceCounts, ATTENDANCE_OVERVIEW: 1.5 } },
    { ...row, sourceCounts: { GROWTH_RECORD: 2 } },
    { ...row, actions: ["SOURCE_REFRESH"] },
    { ...row, actions: ["confirm", "confirm"] },
    { ...row, status: "PUBLISHED", actions: ["publish"] },
  ])
    assert.equal(parseChildMonthlyRecord(bad), undefined, JSON.stringify(bad));
  for (const bad of [
    [],
    { records: [row] },
    { records: [row], students: "invalid" },
    listing([row, row]),
    { records: [row], students: [{ id: "bad", displayRef: "模拟孩子", classRef: "合成班" }] },
    { records: [row], students: [null] },
  ])
    assert.equal(parseChildMonthlyListing(bad), undefined);
});

test("child monthly listing keeps all 501 authorized records and uses same-origin invite identity", async () => {
  const { ChildMonthlyReviewClient } = await load();
  const records = Array.from({ length: 501 }, (_, index) => ({
    ...row,
    id: `11111111-1111-4111-8111-${index.toString(16).padStart(12, "0")}`,
  }));
  const calls = [];
  const client = new ChildMonthlyReviewClient({
    fetcher: async (url, init) => {
      calls.push({ url, init });
      return ok(url.endsWith("/me") ? identity : listing(records));
    },
  });
  await client.connect();
  assert.equal(client.snapshot.status, "READY");
  assert.equal(client.snapshot.rows.length, 501);
  assert.deepEqual(client.snapshot.session, { label: identity.display_name });
  assert.deepEqual(
    calls.map(({ url }) => url),
    ["/api/admin/me", "/api/admin/child-monthly-reports"],
  );
  for (const { init } of calls) {
    assert.equal(init.credentials, "same-origin");
    assert.equal(init.cache, "no-store");
    assert.equal(init.redirect, "error");
    assert.equal(new Headers(init.headers).has("authorization"), false);
    assert.ok(init.signal);
  }
});

test("child monthly review requires read and review on the same active membership before listing", async () => {
  const { ChildMonthlyReviewClient } = await load();
  for (const memberships of [
    [],
    [{ status: "ACTIVE", capabilities: ["feedback:read"] }],
    [{ status: "SUSPENDED", capabilities: ["feedback:read", "feedback:review"] }],
    [
      { status: "ACTIVE", capabilities: ["feedback:read"] },
      { status: "ACTIVE", capabilities: ["feedback:review"] },
    ],
  ]) {
    const calls = [];
    const client = new ChildMonthlyReviewClient({
      fetcher: async (url) => {
        calls.push(url);
        return ok({ ...identity, memberships });
      },
    });
    await client.connect();
    assert.equal(client.snapshot.status, "FORBIDDEN");
    assert.equal(client.snapshot.session, null);
    assert.deepEqual(client.snapshot.rows, []);
    assert.deepEqual(calls, ["/api/admin/me"]);
  }
});

test("child monthly commands follow server actions and displayed version including confirmed return", async () => {
  const { ChildMonthlyReviewClient } = await load();
  for (const [status, actions, action, suffix, body] of [
    ["SUBMITTED", ["confirm"], "CONFIRM", "review", { version: 3, action: "CONFIRM" }],
    ["CONFIRMED", ["return"], "RETURN", "review", { version: 3, action: "RETURN" }],
    ["CONFIRMED", ["publish"], "PUBLISH", "publish", { version: 3 }],
  ]) {
    const calls = [];
    const allowedRow = { ...row, status, actions };
    const client = new ChildMonthlyReviewClient({
      fetcher: async (url, init) => {
        calls.push({ url, init });
        return ok(
          url.endsWith("/me")
            ? identity
            : init.method === "POST"
              ? allowedRow
              : listing([allowedRow]),
        );
      },
    });
    await client.connect();
    await client.review(row.id, 2, action);
    await client.review(row.id, 3, "SOURCE_REFRESH");
    assert.equal(calls.length, 2);
    await client.review(row.id, 3, action);
    const writes = calls.filter(({ init }) => init.method === "POST");
    assert.equal(writes.length, 1);
    assert.equal(writes[0].url, `/api/admin/child-monthly-reports/${row.id}/${suffix}`);
    assert.deepEqual(JSON.parse(writes[0].init.body), body);
    assert.equal(calls.at(-1).url, "/api/admin/child-monthly-reports");
  }
  const client = new ChildMonthlyReviewClient({
    fetcher: async (url) => ok(url.endsWith("/me") ? identity : listing([{ ...row, actions: [] }])),
  });
  await client.connect();
  await client.review(row.id, row.version, "CONFIRM");
  assert.equal(client.snapshot.status, "READY");
  assert.match(client.snapshot.message, /权限|刷新/u);
});

test("child monthly in-flight mutation clears rows and rejects duplicate commands and refresh", async () => {
  const { ChildMonthlyReviewClient } = await load();
  const gate = deferred();
  const calls = [];
  const client = new ChildMonthlyReviewClient({
    fetcher: async (url, init) => {
      calls.push({ url, method: init.method });
      if (init.method === "POST") return gate.promise;
      return ok(url.endsWith("/me") ? identity : listing());
    },
  });
  await client.connect();
  const pending = client.review(row.id, row.version, "CONFIRM");
  assert.equal(client.snapshot.status, "BUSY");
  assert.deepEqual(client.snapshot.rows, []);
  await client.review(row.id, row.version, "CONFIRM");
  await client.refresh();
  assert.equal(calls.length, 3);
  gate.resolve(ok(row));
  await pending;
  assert.equal(calls.filter(({ method }) => method === "POST").length, 1);
  assert.equal(client.snapshot.status, "READY");
});

test("child monthly conflict reloads once without replaying the write and reports not saved", async () => {
  const { ChildMonthlyReviewClient } = await load();
  const latest = { ...row, version: 4, status: "REVIEW_REQUIRED", actions: [] };
  const calls = [];
  let changed = false;
  const client = new ChildMonthlyReviewClient({
    fetcher: async (url, init) => {
      calls.push({ url, method: init.method });
      if (init.method === "POST") {
        changed = true;
        return denied(409);
      }
      return ok(url.endsWith("/me") ? identity : listing(changed ? [latest] : [row]));
    },
  });
  await client.connect();
  await client.review(row.id, row.version, "CONFIRM");
  assert.deepEqual(
    calls.map(({ method }) => method),
    ["GET", "GET", "POST", "GET"],
  );
  assert.equal(client.snapshot.status, "READY");
  assert.equal(client.snapshot.rows[0].version, 4);
  assert.match(client.snapshot.message, /未保存/u);
  assert.doesNotMatch(client.snapshot.message, /private internal/u);
});

test("child monthly failures clear records and identity, including failed conflict reload", async () => {
  const { ChildMonthlyReviewClient } = await load();
  for (const [status, expected] of [
    [401, "UNAUTHENTICATED"],
    [403, "FORBIDDEN"],
    [404, "FORBIDDEN"],
    [503, "ERROR"],
  ]) {
    let failing = false;
    const client = new ChildMonthlyReviewClient({
      fetcher: async (url) =>
        failing ? denied(status) : ok(url.endsWith("/me") ? identity : listing()),
    });
    await client.connect();
    failing = true;
    await client.refresh();
    assert.equal(client.snapshot.status, expected);
    assert.equal(client.snapshot.session, null);
    assert.deepEqual(client.snapshot.rows, []);
    assert.doesNotMatch(client.snapshot.message, /private internal/u);
  }
  let changed = false;
  const client = new ChildMonthlyReviewClient({
    fetcher: async (url, init) => {
      if (init.method === "POST") {
        changed = true;
        return denied(409);
      }
      return changed ? denied(401) : ok(url.endsWith("/me") ? identity : listing());
    },
  });
  await client.connect();
  await client.review(row.id, row.version, "CONFIRM");
  assert.equal(client.snapshot.status, "UNAUTHENTICATED");
  assert.equal(client.snapshot.session, null);
  assert.deepEqual(client.snapshot.rows, []);
});

test("child monthly disconnect ignores late identity, read, success and conflict responses", async () => {
  const { ChildMonthlyReviewClient } = await load();
  for (const stage of ["identity", "read", "write", "conflict"]) {
    const gate = deferred();
    const calls = [];
    let delay = stage === "identity";
    const client = new ChildMonthlyReviewClient({
      fetcher: async (url, init) => {
        calls.push({ url, method: init.method });
        if (delay) return gate.promise;
        return ok(url.endsWith("/me") ? identity : listing());
      },
    });
    let pending;
    if (stage === "identity") pending = client.connect();
    else {
      await client.connect();
      delay = true;
      pending = stage === "read" ? client.refresh() : client.review(row.id, row.version, "CONFIRM");
    }
    const count = calls.length;
    client.disconnect();
    gate.resolve(
      stage === "conflict"
        ? denied(409)
        : ok(stage === "identity" ? identity : stage === "write" ? row : listing()),
    );
    await pending;
    assert.equal(calls.length, count, stage);
    assert.equal(client.snapshot.status, "IDLE", stage);
    assert.equal(client.snapshot.session, null);
    assert.deepEqual(client.snapshot.rows, []);
  }
});

test("child monthly older read cannot replace a reconnected identity or its records", async () => {
  const { ChildMonthlyReviewClient } = await load();
  const gate = deferred();
  let delay = false;
  let nextIdentity = identity;
  const client = new ChildMonthlyReviewClient({
    fetcher: async (url) => {
      if (url.endsWith("/me")) return ok(nextIdentity);
      return delay ? gate.promise : ok(listing());
    },
  });
  await client.connect();
  delay = true;
  const pending = client.refresh();
  client.disconnect();
  delay = false;
  nextIdentity = { ...identity, display_name: "合成负责人乙" };
  await client.connect();
  gate.resolve(ok(listing([{ ...row, version: 8 }])));
  await pending;
  assert.equal(client.snapshot.session.label, "合成负责人乙");
  assert.equal(client.snapshot.rows[0].version, 3);
});

test("child monthly mutation rejects a response for a different child, month or class", async () => {
  const { ChildMonthlyReviewClient } = await load();
  for (const replacement of [
    { studentId: "33333333-3333-4333-8333-333333333333" },
    { month: "2026-09" },
    { classRef: "合成乙班" },
  ]) {
    const calls = [];
    const client = new ChildMonthlyReviewClient({
      fetcher: async (url, init) => {
        calls.push({ url, method: init.method });
        return ok(
          url.endsWith("/me")
            ? identity
            : init.method === "POST"
              ? { ...row, ...replacement }
              : listing(),
        );
      },
    });
    await client.connect();
    await client.review(row.id, row.version, "CONFIRM");
    assert.equal(client.snapshot.status, "ERROR");
    assert.equal(client.snapshot.session, null);
    assert.deepEqual(client.snapshot.rows, []);
    assert.deepEqual(
      calls.map(({ method }) => method),
      ["GET", "GET", "POST"],
    );
  }
});

test("child monthly student options strip private fields and malformed responses clear the session", async () => {
  const { ChildMonthlyReviewClient, parseChildMonthlyListing } = await load();
  const student = { id: row.studentId, displayRef: row.studentLabel, classRef: row.classRef };
  assert.deepEqual(
    parseChildMonthlyListing({ records: [row], students: [{ ...student, tenantId: "private" }] }),
    {
      records: [row],
      students: [student],
    },
  );
  assert.equal(
    parseChildMonthlyListing({ records: [row], students: [student, student] }),
    undefined,
  );
  for (const response of [
    () => Response.json({ data: { records: [{ ...row, studentId: "invalid" }], students: [] } }),
    () => Response.json({ data: { records: [row] } }),
    () => new Response("not json"),
    () => {
      throw new Error("private network details");
    },
  ]) {
    let failing = false;
    const client = new ChildMonthlyReviewClient({
      fetcher: async (url) =>
        failing ? response() : ok(url.endsWith("/me") ? identity : listing()),
    });
    await client.connect();
    failing = true;
    await client.refresh();
    assert.equal(client.snapshot.status, "ERROR");
    assert.equal(client.snapshot.session, null);
    assert.deepEqual(client.snapshot.rows, []);
    assert.doesNotMatch(client.snapshot.message, /private|not json/u);
  }
});
