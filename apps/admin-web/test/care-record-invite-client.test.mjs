/* global Buffer, Response, URL */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function loadClient() {
  const path = new URL(
    "../src/app/admin/care-record-review/care-record-client.ts",
    import.meta.url,
  );
  const source = await readFile(path, "utf8");
  const output = ts.transpile(source, {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  });
  return import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
}

const actor = {
  display_name: "模拟校区审核员",
  memberships: [
    { status: "ACTIVE", capabilities: ["identity:read", "care:review", "care:publish"] },
  ],
};
const recordId = "11111111-1111-4111-8111-111111111111";
const baseRecord = {
  id: recordId,
  student_display_ref: "模拟学生甲",
  class_ref: "模拟一年级一班",
  service_date: "2026-10-19",
  values: {
    arrival: "ARRIVED_AS_PLANNED",
    homework: "COMPLETED",
    meal: "FINISHED",
    rest: "RESTED",
    activity: "PARTICIPATED",
    wellbeing: "ROUTINE",
  },
  status: "SUBMITTED",
  version: 1,
  published: false,
  publication_version: 0,
  updated_at: "2026-10-19T01:00:00.000Z",
  actions: ["review"],
  student_id: "22222222-2222-4222-8222-222222222222",
};

test("invite care client loads only when the current account has review or publish capability", async () => {
  const { CareRecordReviewClient } = await loadClient();
  const calls = [];
  const client = new CareRecordReviewClient({
    fetcher: async (input, init) => {
      calls.push({
        url: String(input),
        method: init?.method ?? "GET",
        credentials: init?.credentials,
      });
      if (String(input).endsWith("/me")) return Response.json({ data: actor });
      if (String(input).endsWith("/staff/care-records"))
        return Response.json({ data: [baseRecord] });
      throw new Error("unexpected request");
    },
  });

  await client.connect();
  assert.equal(client.snapshot.status, "READY");
  assert.equal(client.snapshot.displayName, "模拟校区审核员");
  assert.equal(client.snapshot.records[0]?.studentLabel, "模拟学生甲");
  assert.equal(client.snapshot.records[0]?.actions.includes("review"), true);
  assert.equal(JSON.stringify(client.snapshot).includes("student_id"), false);
  assert.deepEqual(
    calls.map((call) => call.url),
    ["/api/admin/me", "/api/admin/staff/care-records"],
  );
  assert.ok(calls.every((call) => call.credentials === "same-origin"));
});

test("invite care client hides rows and never requests the queue without review capability", async () => {
  const { CareRecordReviewClient } = await loadClient();
  const calls = [];
  const client = new CareRecordReviewClient({
    fetcher: async (input) => {
      calls.push(String(input));
      return Response.json({
        data: {
          ...actor,
          memberships: [{ status: "ACTIVE", capabilities: ["identity:read", "care:write"] }],
        },
      });
    },
  });

  await client.connect();
  assert.equal(client.snapshot.status, "FORBIDDEN");
  assert.deepEqual(client.snapshot.records, []);
  assert.deepEqual(calls, ["/api/admin/me"]);
});

test("review, publish, and publication revocation use server record versions, then refresh the queue", async () => {
  const { CareRecordReviewClient } = await loadClient();
  const calls = [];
  let record = { ...baseRecord };
  const client = new CareRecordReviewClient({
    fetcher: async (input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      calls.push({ url, method, body: init?.body });
      if (url === "/api/admin/me") return Response.json({ data: actor });
      if (url === "/api/admin/staff/care-records" && method === "GET")
        return Response.json({ data: [record] });
      if (url.endsWith("/review")) {
        assert.deepEqual(JSON.parse(String(init?.body)), { version: 1, action: "confirm" });
        record = { ...record, status: "CONFIRMED", version: 2, actions: ["publish"] };
        return Response.json({ data: record });
      }
      if (url.endsWith("/publish")) {
        assert.deepEqual(JSON.parse(String(init?.body)), { version: 2 });
        record = {
          ...record,
          published: true,
          version: 3,
          publication_version: 1,
          actions: ["revoke-publication"],
        };
        return Response.json({ data: record });
      }
      if (url.endsWith("/revoke-publication")) {
        assert.deepEqual(JSON.parse(String(init?.body)), { version: 3 });
        record = {
          ...record,
          published: false,
          version: 4,
          publication_version: 1,
          actions: ["publish"],
        };
        return Response.json({ data: record });
      }
      throw new Error("unexpected request");
    },
  });

  await client.connect();
  await client.review(recordId, 1, "confirm");
  assert.equal(client.snapshot.records[0]?.status, "CONFIRMED");
  await client.publish(recordId, 2);
  assert.equal(client.snapshot.records[0]?.published, true);
  assert.equal(client.snapshot.records[0]?.publicationVersion, 1);
  await client.revokePublication(recordId, 3);
  assert.equal(client.snapshot.records[0]?.published, false);
  assert.equal(client.snapshot.records[0]?.publicationVersion, 1);
  assert.equal(
    calls.filter((call) => call.url.endsWith("/staff/care-records") && call.method === "GET")
      .length,
    4,
  );
});
