/* global Response, URL, Buffer */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
async function load() {
  const source = await readFile(
    new URL("../src/app/admin/staff-daily-review/staff-daily-review-client.ts", import.meta.url),
    "utf8",
  );
  return import(
    "data:text/javascript;base64," +
      Buffer.from(
        ts.transpile(source, { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }),
      ).toString("base64")
  );
}
const identity = {
  display_name: "合成负责人",
  memberships: [{ status: "ACTIVE", capabilities: ["daily:review"] }],
};
const row = {
  id: "11111111-1111-4111-8111-111111111111",
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
test("daily client retains all 501 valid pending and historical records", async () => {
  const { StaffDailyReviewClient } = await load();
  const records = Array.from({ length: 501 }, (_, index) => ({
    ...row,
    id: `11111111-1111-4111-8111-${index.toString(16).padStart(12, "0")}`,
    status: index % 2 ? "RETURNED" : "SUBMITTED",
    actions: index % 2 ? [] : ["confirm", "return"],
  }));
  const client = new StaffDailyReviewClient({
    fetcher: async (url) => Response.json({ data: url.endsWith("/me") ? identity : { records } }),
  });
  await client.connect();
  assert.equal(client.snapshot.status, "READY");
  assert.deepEqual(client.snapshot.rows, records);
});

test("daily invite client loads only current authorized identity and safe review projection", async () => {
  const { StaffDailyReviewClient } = await load();
  const calls = [];
  const client = new StaffDailyReviewClient({
    fetcher: async (url, init) => {
      calls.push({ url, init });
      return Response.json({
        data: url.endsWith("/me")
          ? identity
          : { records: [{ ...row, createdBy: "private", sourceRefs: ["private"] }] },
      });
    },
  });
  await client.connect();
  assert.equal(client.snapshot.status, "READY");
  assert.equal(client.snapshot.session.label, identity.display_name);
  assert.deepEqual(client.snapshot.rows, [row]);
  for (const { url, init } of calls) {
    assert.ok(url.startsWith("/api/admin/"));
    assert.equal(init.credentials, "same-origin");
    assert.equal(init.cache, "no-store");
    assert.equal(init.headers.authorization, undefined);
  }
});
test("daily client requires active review capability before reading records", async () => {
  const { StaffDailyReviewClient } = await load();
  for (const actor of [
    { ...identity, memberships: [] },
    { ...identity, memberships: [{ status: "DISABLED", capabilities: ["daily:review"] }] },
  ]) {
    let calls = 0;
    const client = new StaffDailyReviewClient({
      fetcher: async () => {
        calls++;
        return Response.json({ data: actor });
      },
    });
    await client.connect();
    assert.equal(client.snapshot.status, "FORBIDDEN");
    assert.equal(calls, 1);
    assert.deepEqual(client.snapshot.rows, []);
  }
});
test("daily mutations follow server actions, deduplicate clicks and reject stale local versions", async () => {
  const { StaffDailyReviewClient } = await load();
  let record = { ...row };
  const writes = [];
  let release;
  const client = new StaffDailyReviewClient({
    fetcher: async (url, init) => {
      if (url.endsWith("/me")) return Response.json({ data: identity });
      if (init.method === "POST") {
        writes.push({ url, body: JSON.parse(init.body) });
        await new Promise((resolve) => {
          release = resolve;
        });
        record = {
          ...row,
          version: record.version + 1,
          status: url.endsWith("/withdraw") ? "RETURNED" : "CONFIRMED",
          actions: url.endsWith("/withdraw") ? [] : ["return", "withdraw"],
        };
        return Response.json({ data: record });
      }
      return Response.json({ data: { records: [record] } });
    },
  });
  await client.connect();
  await client.review(row.id, 2, "CONFIRM");
  assert.equal(writes.length, 0);
  const pending = client.review(row.id, 3, "CONFIRM");
  await client.review(row.id, 3, "CONFIRM");
  assert.equal(writes.length, 1);
  release();
  await pending;
  assert.equal(client.snapshot.rows[0].status, "CONFIRMED");
  await client.review(row.id, 4, "CONFIRM");
  assert.equal(writes.length, 1);
  const withdrawal = client.review(row.id, 4, "WITHDRAW");
  assert.deepEqual(writes[1], {
    url: `/api/admin/daily-reports/${row.id}/withdraw`,
    body: { version: 4 },
  });
  release();
  await withdrawal;
  assert.equal(client.snapshot.rows[0].status, "RETURNED");
  assert.deepEqual(client.snapshot.rows[0].actions, []);
});
test("daily errors clear old records, reconnect and ignore responses after disconnect", async () => {
  const { StaffDailyReviewClient } = await load();
  for (const [status, expected] of [
    [401, "UNAUTHENTICATED"],
    [403, "FORBIDDEN"],
    [409, "ERROR"],
    [503, "ERROR"],
  ]) {
    let failing = false;
    const client = new StaffDailyReviewClient({
      fetcher: async (url) =>
        failing
          ? Response.json({ error: { message: "private" } }, { status })
          : Response.json({ data: url.endsWith("/me") ? identity : { records: [row] } }),
    });
    await client.connect();
    failing = true;
    await client.refresh();
    assert.equal(client.snapshot.status, expected);
    assert.deepEqual(client.snapshot.rows, []);
    assert.doesNotMatch(client.snapshot.message, /private/);
    failing = false;
    await client.connect();
    assert.equal(client.snapshot.status, "READY");
  }
  let release;
  const client = new StaffDailyReviewClient({
    fetcher: () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  });
  const pending = client.connect();
  client.disconnect();
  release(Response.json({ data: identity }));
  await pending;
  assert.equal(client.snapshot.status, "IDLE");
  assert.deepEqual(client.snapshot.rows, []);
});
test("daily client rejects inconsistent records and repeated ids", async () => {
  const { StaffDailyReviewClient } = await load();
  for (const records of [
    [{ ...row, status: "DRAFT" }],
    [{ ...row, actions: ["withdraw"] }],
    [{ ...row, date: "2026-02-30" }],
    [{ ...row, sourceCounts: { ...row.sourceCounts, TASK: -1 } }],
    [row, row],
  ]) {
    const client = new StaffDailyReviewClient({
      fetcher: async (url) => Response.json({ data: url.endsWith("/me") ? identity : { records } }),
    });
    await client.connect();
    assert.equal(client.snapshot.status, "ERROR");
    assert.deepEqual(client.snapshot.rows, []);
  }
});

test("daily review client loads a scoped audit timeline without exposing raw member ids", async () => {
  const { StaffDailyReviewClient } = await load();
  const events = [
    {
      action: "CREATED",
      reportVersion: 1,
      actorLabel: "合成教师",
      initiatedByLabel: "合成教师",
      occurredAt: "2026-10-30T08:00:00.000Z",
    },
  ];
  const client = new StaffDailyReviewClient({
    fetcher: async (url) => {
      if (url.endsWith("/me")) return Response.json({ data: identity });
      if (url.endsWith("/audit-events")) return Response.json({ data: { events } });
      return Response.json({ data: { records: [row] } });
    },
  });
  await client.connect();
  await client.loadAuditEvents(row.id);
  assert.deepEqual(client.snapshot.auditEvents[row.id], { status: "READY", events, error: null });
});
