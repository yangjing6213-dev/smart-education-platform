import assert from "node:assert/strict";
import test from "node:test";
import type { ChildMonthlyStaffReport, MonthlyFeedbackSupplements } from "@student-care/contracts";
import {
  InviteStaffChildMonthlyClient,
  parseChildMonthlyStaffRecord,
  parseChildMonthlyStaffListing,
} from "./invite-staff-child-monthly-client.js";

const id = "00000000-0000-4000-8000-000000000201";
const studentId = "00000000-0000-4000-8000-000000000202";
const supplements: MonthlyFeedbackSupplements = {
  learningParticipation: "PROGRESSING",
  dailyHabits: "KEEP_WATCHING",
  activityParticipation: "FOLLOW_UP",
  familySchoolCollaboration: "PROGRESSING",
};
const row: ChildMonthlyStaffReport = {
  id,
  studentId,
  studentLabel: "模拟孩子",
  classRef: "模拟班",
  month: "2026-10",
  status: "DRAFT",
  version: 1,
  sourceVersion: 1,
  publicationVersion: 0,
  supplements,
  sourceCounts: { GROWTH_RECORD: 1, ATTENDANCE_OVERVIEW: 2 },
  actions: ["edit", "submit"],
};
const listing = {
  records: [row],
  students: [{ id: studentId, displayRef: "模拟孩子", classRef: "模拟班" }],
};
const identity = (
  memberships = [
    { status: "ACTIVE", capabilities: ["feedback:read", "feedback:create", "feedback:submit"] },
  ],
) => ({ actor_id: "00000000-0000-4000-8000-000000000203", display_name: "模拟教师", memberships });
const envelope = (data: unknown, status = 200) => Response.json({ data }, { status });

test("staff monthly listing preserves every valid report and student beyond five hundred", () => {
  const records = Array.from({ length: 501 }, (_, index) => ({
    ...row,
    id: `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  }));
  const students = Array.from({ length: 501 }, (_, index) => ({
    ...listing.students[0],
    id: `20000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  }));
  const result = parseChildMonthlyStaffListing({ records, students });
  assert.equal(result.records.length, 501);
  assert.equal(result.students.length, 501);
  assert.deepEqual(result.records.at(-1), records.at(-1));
  assert.deepEqual(result.students.at(-1), students.at(-1));
});

test("staff child monthly uses cookie-only child routes for create edit and submit", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const client = new InviteStaffChildMonthlyClient({
    baseUrl: "https://staff.example",
    fetcher: async (input, init) => {
      const url = String(input);
      calls.push({ url, ...(init ? { init } : {}) });
      if (url.endsWith("/me")) return envelope(identity());
      if (!init?.method || init.method === "GET") return envelope({ ...listing, records: [] });
      return envelope({
        ...row,
        version: url.endsWith("/submit") ? 3 : init.method === "PATCH" ? 2 : 1,
        status: url.endsWith("/submit") ? "SUBMITTED" : "DRAFT",
        actions: url.endsWith("/submit") ? [] : row.actions,
      });
    },
  });
  await client.restore();
  assert.equal(client.snapshot.canCreate, true);
  assert.equal(await client.create(studentId, "2026-10", supplements), "saved");
  assert.equal(await client.edit(id, 1, supplements), "saved");
  assert.equal(await client.submit(id, 2), "saved");
  assert.equal(client.snapshot.records[0]?.status, "SUBMITTED");
  assert.deepEqual(
    calls.slice(2).map((c) => [c.url, c.init?.method, JSON.parse(String(c.init?.body))]),
    [
      [
        "https://staff.example/api-local/staff/child-monthly-reports",
        "POST",
        { studentId, month: "2026-10", supplements },
      ],
      [
        "https://staff.example/api-local/staff/child-monthly-reports/" + id,
        "PATCH",
        { version: 1, supplements },
      ],
      [
        "https://staff.example/api-local/staff/child-monthly-reports/" + id + "/submit",
        "POST",
        { version: 2 },
      ],
    ],
  );
  for (const c of calls) {
    assert.equal(c.init?.credentials, "same-origin");
    assert.equal(c.init?.cache, "no-store");
    assert.equal(c.init?.redirect, "error");
    assert.ok(c.init?.signal);
    assert.equal(new Headers(c.init?.headers).has("authorization"), false);
  }
});

test("staff read and create must be in one active membership and actions control writes", async () => {
  for (const memberships of [
    [{ status: "ACTIVE", capabilities: ["feedback:read"] }],
    [
      { status: "ACTIVE", capabilities: ["feedback:read"] },
      { status: "ACTIVE", capabilities: ["feedback:create"] },
    ],
  ]) {
    let writes = 0;
    const client = new InviteStaffChildMonthlyClient({
      baseUrl: "https://staff.example",
      fetcher: async (input, init) => {
        if (init?.method === "POST" || init?.method === "PATCH") writes += 1;
        return envelope(
          String(input).endsWith("/me")
            ? identity(memberships)
            : { ...listing, records: [{ ...row, actions: [] }] },
        );
      },
    });
    await client.restore();
    assert.equal(client.snapshot.canCreate, false);
    assert.equal(await client.create(studentId, "2026-11", supplements), "ignored");
    assert.equal(await client.edit(id, 1, supplements), "ignored");
    assert.equal(await client.submit(id, 1), "ignored");
    assert.equal(writes, 0);
  }
  let requests = 0;
  const inactive = new InviteStaffChildMonthlyClient({
    baseUrl: "https://staff.example",
    fetcher: async () => {
      requests += 1;
      return envelope(
        identity([{ status: "SUSPENDED", capabilities: ["feedback:read", "feedback:create"] }]),
      );
    },
  });
  await inactive.restore();
  assert.equal(inactive.snapshot.status, "ERROR");
  assert.equal(requests, 1);
});

test("staff parsers strip unknown nested fields and reject malformed duplicate or oversized data", () => {
  assert.deepEqual(
    parseChildMonthlyStaffRecord({
      ...row,
      private: "secret",
      supplements: { ...supplements, raw: "secret" },
      sourceCounts: { ...row.sourceCounts, STAFF_DAILY: 9 },
    }),
    row,
  );
  for (const bad of [
    { ...row, version: 0 },
    { ...row, publicationVersion: -1 },
    { ...row, actions: ["edit", "edit"] },
    { ...row, sourceCounts: { ...row.sourceCounts, GROWTH_RECORD: -1 } },
  ])
    assert.throws(() => parseChildMonthlyStaffRecord(bad));
  for (const bad of [
    { ...listing, records: [row, row] },
    { ...listing, students: [listing.students[0], listing.students[0]] },
    { ...listing, records: Array.from({ length: 501 }, () => row) },
  ])
    assert.throws(() => parseChildMonthlyStaffListing(bad));
});

test("staff conflict reloads once without mutation replay and rejects stale version", async () => {
  let writes = 0;
  let version = 1;
  const client = new InviteStaffChildMonthlyClient({
    baseUrl: "https://staff.example",
    fetcher: async (input, init) => {
      if (String(input).endsWith("/me")) return envelope(identity());
      if (init?.method === "PATCH") {
        writes += 1;
        version = 2;
        return envelope({}, 409);
      }
      return envelope({ ...listing, records: [{ ...row, version }] });
    },
  });
  await client.restore();
  assert.equal(await client.edit(id, 1, supplements), "conflict");
  assert.equal(writes, 1);
  assert.equal(client.snapshot.records[0]?.version, 2);
  assert.equal(await client.edit(id, 1, supplements), "ignored");
});

test("staff busy and disconnect prevent duplicate reads and late restoration", async () => {
  let release!: (response: Response) => void;
  let calls = 0;
  const client = new InviteStaffChildMonthlyClient({
    baseUrl: "https://staff.example",
    fetcher: async () => {
      calls += 1;
      return new Promise<Response>((resolve) => {
        release = resolve;
      });
    },
  });
  const pending = client.restore();
  await client.refresh();
  assert.equal(calls, 1);
  client.disconnect();
  release(envelope(identity()));
  await pending;
  assert.equal(client.snapshot.status, "IDLE");
  assert.deepEqual(client.snapshot.records, []);
  assert.equal(calls, 1);
});

test("staff errors clear records and permission, unsafe origins never connect", async () => {
  for (const failure of [401, 403, 503, "json", "network"] as const) {
    let fail = false;
    const client = new InviteStaffChildMonthlyClient({
      baseUrl: "http://localhost:3000",
      fetcher: async (input) => {
        if (fail) {
          if (failure === "network") throw new Error("offline");
          return failure === "json" ? new Response("bad") : envelope({}, failure);
        }
        return envelope(String(input).endsWith("/me") ? identity() : listing);
      },
    });
    await client.restore();
    fail = true;
    await client.refresh();
    assert.equal(client.snapshot.status, "ERROR");
    assert.equal(client.snapshot.requiresLogin, failure === 401);
    assert.deepEqual(client.snapshot.records, []);
    assert.deepEqual(client.snapshot.students, []);
    assert.equal(client.snapshot.canCreate, false);
  }
  for (const origin of [
    "http://unsafe.example",
    "https://staff.example/path",
    "https://u:p@staff.example",
  ])
    assert.throws(() => new InviteStaffChildMonthlyClient({ baseUrl: origin }));
});
