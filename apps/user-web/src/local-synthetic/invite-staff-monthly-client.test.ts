import assert from "node:assert/strict";
import test from "node:test";
import {
  InviteStaffMonthlyClient,
  parseMonthlyListing,
  parseMonthlyRecord,
} from "./invite-staff-monthly-client.js";

const values = {
  learningParticipation: "PROGRESSING",
  dailyHabits: "KEEP_WATCHING",
  activityParticipation: "PROGRESSING",
  familySchoolCollaboration: "FOLLOW_UP",
} as const;
const record = {
  id: "11111111-1111-4111-8111-111111111111",
  version: 1,
  sourceVersion: 1,
  status: "DRAFT",
  month: "2026-10",
  classRef: "合成班级",
  audience: "STAFF_INTERNAL",
  supplements: values,
  sourceCounts: { GROWTH_RECORD: 1, ATTENDANCE_OVERVIEW: 2, STAFF_DAILY: 3 },
  actions: ["edit", "submit"],
};
const ok = (data: unknown) => Response.json({ data });
const listing = (rows = [record], canCreate = true) => ({ records: rows, canCreate });

test("monthly parser accepts all six statuses and five actions, strips unknown data, and keeps 501 unique records", () => {
  for (const status of [
    "DRAFT",
    "SUBMITTED",
    "RETURNED",
    "CONFIRMED",
    "PUBLISHED",
    "REVIEW_REQUIRED",
  ]) {
    const projected = parseMonthlyRecord({
      ...record,
      status,
      actions: ["edit", "submit", "confirm", "return", "publish"],
      sources: ["private-source"],
      tenantId: "private-tenant",
      supplements: { ...values, extra: "private" },
      sourceCounts: { ...record.sourceCounts, privateCount: 9 },
    });
    assert.equal(projected.status, status);
    assert.equal(projected.audience, "STAFF_INTERNAL");
    assert.doesNotMatch(JSON.stringify(projected), /private/);
  }
  const records = Array.from({ length: 501 }, (_, index) => ({
    ...record,
    id: `11111111-1111-4111-8111-${String(index).padStart(12, "0")}`,
  }));
  assert.equal(
    parseMonthlyListing({ records, canCreate: false, privateData: "hidden" }).records.length,
    501,
  );
  assert.throws(() => parseMonthlyListing({ records: [record, record], canCreate: true }));
});

test("monthly parser rejects arrays masquerading as strings, invalid scopes, versions, dates and counts", () => {
  for (const change of [
    { status: ["DRAFT"] },
    { actions: [["edit"]] },
    { month: ["2026-10"] },
    { month: "2026-13" },
    { month: "2200-01" },
    { audience: "PARENT" },
    { classRef: [] },
    { version: 0 },
    { sourceVersion: 1.2 },
    { id: "not-a-uuid" },
    { supplements: { ...values, dailyHabits: ["PROGRESSING"] } },
    { supplements: { ...values, dailyHabits: "UNKNOWN" } },
    { sourceCounts: { ...record.sourceCounts, GROWTH_RECORD: -1 } },
    { actions: ["resubmit"] },
  ])
    assert.throws(() => parseMonthlyRecord({ ...record, ...change }));
  assert.throws(() => parseMonthlyListing({ records: [], canCreate: "true" }));
});

test("monthly requests use only the same-origin cookie and exact create, edit and submit bodies", async () => {
  const requests: { url: string; init: RequestInit }[] = [];
  const responses = [
    listing([], true),
    record,
    { ...record, version: 2 },
    { ...record, version: 3, status: "SUBMITTED", actions: [] },
  ];
  const client = new InviteStaffMonthlyClient({
    baseUrl: "https://school.example",
    fetcher: async (input, init = {}) => {
      requests.push({ url: String(input), init });
      return ok(responses.shift());
    },
  });
  await client.restore();
  assert.equal(await client.create("2026-10", values), "saved");
  assert.equal(await client.edit(record.id, 1, values), "saved");
  assert.equal(await client.submit(record.id, 2), "saved");
  assert.deepEqual(
    requests.map(({ url, init }) => [
      new URL(url).pathname,
      init.method,
      init.body ? JSON.parse(String(init.body)) : null,
    ]),
    [
      ["/api-local/staff/monthly-feedback", "GET", null],
      ["/api-local/staff/monthly-feedback", "POST", { month: "2026-10", supplements: values }],
      [
        `/api-local/staff/monthly-feedback/${record.id}`,
        "PATCH",
        { version: 1, supplements: values },
      ],
      [`/api-local/staff/monthly-feedback/${record.id}/submit`, "POST", { version: 2 }],
    ],
  );
  for (const { url, init } of requests) {
    assert.equal(new URL(url).origin, "https://school.example");
    assert.equal(init.credentials, "same-origin");
    assert.equal(init.cache, "no-store");
    assert.equal(init.redirect, "error");
    assert.equal(new Headers(init.headers).has("authorization"), false);
  }
  assert.equal(client.snapshot.records[0]?.status, "SUBMITTED");
});

test("returned or invalidated summaries save a draft before a separate submit and read-only accounts cannot write", async () => {
  for (const status of ["RETURNED", "REVIEW_REQUIRED"]) {
    const methods: string[] = [];
    const responses = [
      listing([{ ...record, status, actions: ["edit"] }], false),
      record,
      { ...record, version: 2, status: "SUBMITTED", actions: [] },
    ];
    const client = new InviteStaffMonthlyClient({
      baseUrl: "https://school.example",
      fetcher: async (_input, init) => {
        methods.push(init?.method ?? "GET");
        return ok(responses.shift());
      },
    });
    await client.restore();
    assert.equal(await client.create("2026-11", values), "ignored");
    assert.equal(await client.submit(record.id, 1), "ignored");
    assert.equal(await client.edit(record.id, 1, values), "saved");
    assert.equal(await client.submit(record.id, 1), "saved");
    assert.deepEqual(methods, ["GET", "PATCH", "POST"]);
  }
  const client = new InviteStaffMonthlyClient({
    baseUrl: "https://school.example",
    fetcher: async () => ok(listing([{ ...record, actions: [] }], false)),
  });
  await client.restore();
  assert.equal(await client.edit(record.id, 1, values), "ignored");
  assert.equal(await client.submit(record.id, 1), "ignored");
});

test("409 rereads the latest version exactly once without replaying a write or reporting a save", async () => {
  const requests: string[] = [];
  const latest = {
    ...record,
    version: 3,
    sourceVersion: 2,
    status: "REVIEW_REQUIRED",
    actions: ["edit"],
  };
  const responses = [
    ok(listing()),
    Response.json({ error: { code: "CONFLICT_STATE" } }, { status: 409 }),
    ok(listing([latest])),
  ];
  const client = new InviteStaffMonthlyClient({
    baseUrl: "https://school.example",
    fetcher: async (_input, init) => {
      requests.push(init?.method ?? "GET");
      return responses.shift()!;
    },
  });
  await client.restore();
  assert.equal(await client.submit(record.id, 1), "conflict");
  assert.deepEqual(requests, ["GET", "POST", "GET"]);
  assert.equal(client.snapshot.status, "READY");
  assert.equal(client.snapshot.records[0]?.version, 3);
  assert.match(client.snapshot.message, /重新核对/);
  assert.doesNotMatch(client.snapshot.message, /已保存|已提交/);
});

test("401, 403, 404 and malformed results clear existing content, and only 401 offers login", async () => {
  for (const status of [401, 403, 404, 502]) {
    let count = 0;
    const client = new InviteStaffMonthlyClient({
      baseUrl: "https://school.example",
      fetcher: async () =>
        ++count === 1 ? ok(listing()) : Response.json({ error: { code: "DENIED" } }, { status }),
    });
    await client.restore();
    await client.refresh();
    assert.equal(client.snapshot.status, "ERROR");
    assert.deepEqual(client.snapshot.records, []);
    assert.equal(client.snapshot.canCreate, false);
    assert.equal(client.snapshot.requiresLogin, status === 401);
  }
  let count = 0;
  const client = new InviteStaffMonthlyClient({
    baseUrl: "https://school.example",
    fetcher: async () =>
      ++count === 1 ? ok(listing()) : ok({ records: [record, record], canCreate: true }),
  });
  await client.restore();
  await client.refresh();
  assert.deepEqual(client.snapshot.records, []);
});

test("the busy lock and disconnect generation ignore duplicate actions and late replies", async () => {
  let complete!: (response: Response) => void;
  let calls = 0;
  const client = new InviteStaffMonthlyClient({
    baseUrl: "https://school.example",
    fetcher: async () =>
      ++calls === 1
        ? ok(listing())
        : new Promise<Response>((resolve) => {
            complete = resolve;
          }),
  });
  await client.restore();
  const pending = client.edit(record.id, 1, values);
  assert.equal(await client.submit(record.id, 1), "ignored");
  await client.refresh();
  assert.equal(calls, 2);
  client.disconnect();
  complete(ok({ ...record, version: 2 }));
  assert.equal(await pending, "ignored");
  assert.equal(client.snapshot.status, "IDLE");
  assert.deepEqual(client.snapshot.records, []);
});

test("a stalled request times out, clears stale content and permits reconnecting", async (t) => {
  let stall = false;
  let receivedSignal = false;
  let deadline = 0;
  const client = new InviteStaffMonthlyClient({
    baseUrl: "https://school.example",
    fetcher: async (_input, init) => {
      if (!stall) return ok(listing());
      const signal = init?.signal;
      receivedSignal = signal instanceof AbortSignal;
      assert.ok(signal, "Every request must provide a bounded cancellation signal");
      return new Promise<Response>((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      });
    },
  });
  await client.restore();
  assert.equal(client.snapshot.records.length, 1);
  t.mock.method(AbortSignal, "timeout", (milliseconds: number) => {
    deadline = milliseconds;
    const controller = new AbortController();
    setTimeout(() => controller.abort(new Error("Synthetic request timeout")), 5);
    return controller.signal;
  });
  stall = true;
  assert.equal(await client.edit(record.id, 1, values), "failed");
  assert.equal(receivedSignal, true);
  assert.equal(deadline, 10_000);
  assert.equal(client.snapshot.status, "ERROR");
  assert.deepEqual(client.snapshot.records, []);
  assert.equal(client.snapshot.canCreate, false);
  stall = false;
  await client.refresh();
  assert.equal(client.snapshot.status, "READY");
  assert.equal(client.snapshot.records.length, 1);
});
