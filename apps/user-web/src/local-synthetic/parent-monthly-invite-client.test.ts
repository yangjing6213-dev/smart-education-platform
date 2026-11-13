import assert from "node:assert/strict";
import test from "node:test";
import {
  ParentMonthlyInviteClient,
  parseChildMonthlyParentRecords,
} from "./parent-monthly-invite-client.js";

const id = "00000000-0000-4000-8000-000000000101";
const studentId = "00000000-0000-4000-8000-000000000102";
const relationshipId = "00000000-0000-4000-8000-000000000103";
const secondStudent = "00000000-0000-4000-8000-000000000104";
const secondRelationship = "00000000-0000-4000-8000-000000000105";
const supplements = {
  learningParticipation: "PROGRESSING",
  dailyHabits: "KEEP_WATCHING",
  activityParticipation: "FOLLOW_UP",
  familySchoolCollaboration: "PROGRESSING",
} as const;
const row = {
  id,
  studentId,
  studentLabel: "模拟孩子一",
  month: "2026-10",
  publicationVersion: 2,
  relationshipVersion: 3,
  supplements,
  sourceCounts: { GROWTH_RECORD: 1, ATTENDANCE_OVERVIEW: 2 },
  acknowledged: false,
};
const relationship = {
  id: relationshipId,
  student_id: studentId,
  relationship: "GUARDIAN",
  status: "ACTIVE",
  version: 3,
  approved_at: "2026-10-01T00:00:00Z",
};
const envelope = (data: unknown, status = 200) => Response.json({ data }, { status });

test("parent monthly preserves all valid reports and approved relationships beyond five hundred", async () => {
  const records = Array.from({ length: 501 }, (_, index) => ({
    ...row,
    id: `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  }));
  const relationships = Array.from({ length: 501 }, (_, index) => ({
    ...relationship,
    id: `20000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  }));
  assert.equal(parseChildMonthlyParentRecords({ records }, studentId, 3).length, 501);
  const client = new ParentMonthlyInviteClient({
    baseUrl: "https://parent.example",
    fetcher: async (input) =>
      envelope(String(input).endsWith("/guardian-relationships") ? relationships : { records }),
  });
  await client.connect();
  assert.equal(client.snapshot.status, "READY");
  assert.equal(client.snapshot.relationships.length, 501);
  assert.equal(client.snapshot.monthlyFeedback.length, 501);
});

test("parent monthly reads approved relationships then child reports and acknowledges both versions", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const client = new ParentMonthlyInviteClient({
    baseUrl: "https://parent.example",
    fetcher: async (input, init) => {
      const url = String(input);
      calls.push({ url, ...(init ? { init } : {}) });
      if (url.endsWith("/guardian-relationships"))
        return envelope([
          relationship,
          { ...relationship, id: secondRelationship, status: "RELEASED" },
        ]);
      if (init?.method === "POST") return envelope({ acknowledged: true });
      return envelope({ records: [row] });
    },
  });
  await client.connect();
  assert.equal(calls[0]?.url, "https://parent.example/api-local/guardian-relationships");
  assert.equal(client.snapshot.status, "READY");
  assert.equal(client.snapshot.relationships.length, 1);
  assert.equal(client.snapshot.selectedRelationshipId, relationshipId);
  assert.equal(client.snapshot.monthlyFeedback[0]?.id, id);
  await client.acknowledge(id);
  assert.equal(client.snapshot.monthlyFeedback[0]?.acknowledged, true);
  assert.equal(
    calls[2]?.url,
    "https://parent.example/api-local/parent/relationships/" +
      relationshipId +
      "/monthly-reports/" +
      id +
      "/ack",
  );
  assert.deepEqual(JSON.parse(String(calls[2]?.init?.body)), {
    publicationVersion: 2,
    relationshipVersion: 3,
  });
  for (const c of calls) {
    assert.equal(c.init?.credentials, "same-origin");
    assert.equal(c.init?.cache, "no-store");
    assert.equal(c.init?.redirect, "error");
    assert.ok(c.init?.signal);
    assert.equal(new Headers(c.init?.headers).has("authorization"), false);
  }
  await client.acknowledge(id);
  assert.equal(calls.length, 3);
});

test("parent projection strips private fields and rejects wrong child, wrong relationship version and malformed lists", () => {
  assert.deepEqual(
    parseChildMonthlyParentRecords(
      {
        records: [
          {
            ...row,
            tenantId: "private",
            supplements: { ...supplements, raw: "private" },
            sourceCounts: { ...row.sourceCounts, STAFF_DAILY: 999 },
          },
        ],
      },
      studentId,
      3,
    ),
    [row],
  );
  for (const value of [
    { records: [{ ...row, studentId: secondStudent }] },
    { records: [{ ...row, relationshipVersion: 4 }] },
    { records: [row, row] },
    { records: [{ ...row, acknowledged: "yes" }] },
    { records: Array.from({ length: 501 }, () => row) },
  ])
    assert.throws(() => parseChildMonthlyParentRecords(value, studentId, 3));
});

test("parent switching immediately clears old child and disconnect blocks late data", async () => {
  let release!: (value: Response) => void;
  let reads = 0;
  const client = new ParentMonthlyInviteClient({
    baseUrl: "http://localhost:3000",
    fetcher: async (input) => {
      if (String(input).endsWith("guardian-relationships"))
        return envelope([
          relationship,
          { ...relationship, id: secondRelationship, student_id: secondStudent },
        ]);
      reads += 1;
      if (reads === 1) return envelope({ records: [row] });
      return new Promise<Response>((resolve) => {
        release = resolve;
      });
    },
  });
  await client.connect();
  const pending = client.selectRelationship(secondRelationship);
  assert.deepEqual(client.snapshot.monthlyFeedback, []);
  assert.equal(client.snapshot.status, "BUSY");
  await client.selectRelationship(relationshipId);
  assert.equal(reads, 2);
  client.disconnect();
  release(envelope({ records: [{ ...row, studentId: secondStudent }] }));
  await pending;
  assert.equal(client.snapshot.status, "IDLE");
  assert.deepEqual(client.snapshot.monthlyFeedback, []);
});

test("parent conflict refreshes approval and publication without replaying acknowledgement", async () => {
  let writes = 0;
  let changed = false;
  const client = new ParentMonthlyInviteClient({
    baseUrl: "http://localhost:3000",
    fetcher: async (input, init) => {
      if (init?.method === "POST") {
        writes += 1;
        changed = true;
        return envelope({}, 409);
      }
      if (String(input).endsWith("guardian-relationships"))
        return envelope([{ ...relationship, version: changed ? 4 : 3 }]);
      return envelope({
        records: [
          { ...row, publicationVersion: changed ? 3 : 2, relationshipVersion: changed ? 4 : 3 },
        ],
      });
    },
  });
  await client.connect();
  await client.acknowledge(id);
  assert.equal(writes, 1);
  assert.equal(client.snapshot.status, "READY");
  assert.equal(client.snapshot.monthlyFeedback[0]?.publicationVersion, 3);
  assert.equal(client.snapshot.monthlyFeedback[0]?.acknowledged, false);
  assert.match(client.snapshot.message, /重新核对/u);
});

test("parent authentication, permission, network and invalid responses clear all old data", async () => {
  for (const failure of [401, 403, 404, 503, 409, "network", "invalid-json"] as const) {
    let failing = false;
    const client = new ParentMonthlyInviteClient({
      baseUrl: "http://localhost:3000",
      fetcher: async (input) => {
        if (failing) {
          if (failure === "network") throw new Error("offline");
          if (failure === "invalid-json") return new Response("invalid");
          return envelope({}, failure);
        }
        return String(input).endsWith("guardian-relationships")
          ? envelope([relationship])
          : envelope({ records: [row] });
      },
    });
    await client.connect();
    assert.equal(client.snapshot.monthlyFeedback.length, 1);
    failing = true;
    await client.refresh();
    assert.equal(client.snapshot.status, failure === 401 || failure === 403 ? "DENIED" : "ERROR");
    assert.deepEqual(client.snapshot.monthlyFeedback, []);
    assert.deepEqual(client.snapshot.relationships, []);
    failing = false;
    await client.refresh();
    assert.equal(client.snapshot.status, "READY");
  }
  for (const origin of [
    "http://remote.example",
    "https://parent.example/path",
    "https://u:p@parent.example",
  ])
    assert.throws(() => new ParentMonthlyInviteClient({ baseUrl: origin }));
});

test("parent empty approvals never request reports or write and malformed approvals fail closed", async () => {
  let requests = 0;
  const client = new ParentMonthlyInviteClient({
    baseUrl: "https://parent.example",
    fetcher: async () => {
      requests += 1;
      return envelope([{ ...relationship, status: "RELEASED" }]);
    },
  });
  await client.connect();
  await client.selectRelationship(relationshipId);
  await client.acknowledge(id);
  assert.equal(requests, 1);
  assert.equal(client.snapshot.status, "READY");
  assert.deepEqual(client.snapshot.monthlyFeedback, []);
  const invalid = new ParentMonthlyInviteClient({
    baseUrl: "https://parent.example",
    fetcher: async () => envelope([{ ...relationship, version: 0 }]),
  });
  await invalid.connect();
  assert.equal(invalid.snapshot.status, "ERROR");
});
