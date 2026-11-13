/* global Buffer, Response, URL */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const recordId = "11111111-1111-4111-8111-111111111111";
const studentId = "22222222-2222-4222-8222-222222222222";
const relationshipId = "33333333-3333-4333-8333-333333333333";
const values = {
  arrival: "ARRIVED_AS_PLANNED",
  homework: "COMPLETED",
  meal: "FINISHED",
  rest: "RESTED",
  activity: "PARTICIPATED",
  wellbeing: "ROUTINE",
};
const record = {
  id: recordId,
  student_display_ref: "模拟学生甲",
  service_date: "2026-10-19",
  values,
  version: 3,
  publication_version: 2,
  receipt_status: "UNREAD",
};
const success = (data) => Response.json({ data });

async function loadClient() {
  const workflowSource = await readFile(
    new URL("../pages/care-record-workflow.ts", import.meta.url),
    "utf8",
  );
  const workflowOutput = ts.transpile(workflowSource, {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  });
  const workflowUrl = `data:text/javascript;base64,${Buffer.from(workflowOutput).toString("base64")}`;
  const clientSource = await readFile(
    new URL("./parent-care-invite-client.ts", import.meta.url),
    "utf8",
  );
  const clientOutput = ts.transpile(
    clientSource.replace('from "../pages/care-record-workflow.js"', `from "${workflowUrl}"`),
    { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  );
  const clientUrl = `data:text/javascript;base64,${Buffer.from(clientOutput).toString("base64")}`;
  return import(clientUrl);
}

async function registerInviteSessionTests() {
  const inviteSource = await readFile(new URL("./invite-session.ts", import.meta.url), "utf8");
  const inviteOutput = ts.transpile(inviteSource, {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  });
  const inviteUrl = `data:text/javascript;base64,${Buffer.from(inviteOutput).toString("base64")}`;
  const tests = await readFile(new URL("./invite-session.test.ts", import.meta.url), "utf8");
  const testOutput = ts.transpile(
    tests.replace('from "./invite-session.js"', `from "${inviteUrl}"`),
    { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  );
  const testUrl = `data:text/javascript;base64,${Buffer.from(testOutput).toString("base64")}`;
  await import(testUrl);
}

await registerInviteSessionTests();

test("parent care client accepts only the safe published projection and uses same-origin requests", async () => {
  const { ParentCareInviteClient } = await loadClient();
  const calls = [];
  const client = new ParentCareInviteClient({
    baseUrl: "https://care.example.invalid",
    fetcher: async (input, init) => {
      calls.push({
        url: String(input),
        method: init?.method ?? "GET",
        credentials: init?.credentials,
        cache: init?.cache,
      });
      return success([record]);
    },
  });

  await client.refresh();

  assert.equal(client.snapshot.status, "READY");
  assert.equal(client.snapshot.records[0]?.studentLabel, "模拟学生甲");
  assert.equal(client.snapshot.records[0]?.values.arrival, "按计划到校");
  assert.equal(client.snapshot.records[0]?.receipt, "UNREAD");
  assert.deepEqual(calls, [
    {
      url: "https://care.example.invalid/api-local/parent/care-records",
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
    },
  ]);
  assert.doesNotMatch(
    JSON.stringify(client.snapshot),
    new RegExp(`${studentId}|${relationshipId}|student_id|relationship_id`, "u"),
  );
});

test("read and acknowledge receipts send only current versions and then refresh the server list", async () => {
  const { ParentCareInviteClient } = await loadClient();
  const calls = [];
  let current = record;
  const client = new ParentCareInviteClient({
    baseUrl: "http://127.0.0.1:3000",
    fetcher: async (input, init) => {
      const url = new URL(String(input));
      const method = init?.method ?? "GET";
      calls.push({
        method,
        path: url.pathname,
        body: init?.body ? JSON.parse(String(init.body)) : null,
      });
      if (method === "GET") return success([current]);
      const body = JSON.parse(String(init?.body));
      assert.deepEqual(Object.keys(body).sort(), ["action", "publication_version", "version"]);
      current = { ...current, receipt_status: body.action === "read" ? "READ" : "ACKNOWLEDGED" };
      return success(current);
    },
  });

  await client.refresh();
  await client.receipt(recordId, "read");
  assert.equal(client.snapshot.records[0]?.receipt, "READ");
  await client.receipt(recordId, "acknowledge");

  assert.equal(client.snapshot.records[0]?.receipt, "ACKNOWLEDGED");
  assert.deepEqual(calls, [
    { method: "GET", path: "/api-local/parent/care-records", body: null },
    {
      method: "POST",
      path: `/api-local/parent/care-records/${recordId}/receipt`,
      body: { version: 3, publication_version: 2, action: "read" },
    },
    { method: "GET", path: "/api-local/parent/care-records", body: null },
    {
      method: "POST",
      path: `/api-local/parent/care-records/${recordId}/receipt`,
      body: { version: 3, publication_version: 2, action: "acknowledge" },
    },
    { method: "GET", path: "/api-local/parent/care-records", body: null },
  ]);
});

test("unauthorized sessions and malformed projections clear all previously visible records", async () => {
  const { ParentCareInviteClient } = await loadClient();
  let response = success([record]);
  const client = new ParentCareInviteClient({
    baseUrl: "http://127.0.0.1:3000",
    fetcher: async () => response,
  });
  await client.refresh();
  assert.equal(client.snapshot.records.length, 1);

  response = Response.json({ error: { code: "FORBIDDEN_SCOPE" } }, { status: 403 });
  await client.refresh();
  assert.equal(client.snapshot.status, "DENIED");
  assert.deepEqual(client.snapshot.records, []);

  response = success([{ ...record, student_id: studentId }]);
  await client.refresh();
  assert.equal(client.snapshot.status, "ERROR");
  assert.deepEqual(client.snapshot.records, []);
});

test("stale publication versions do not leave a stale record on screen", async () => {
  const { ParentCareInviteClient } = await loadClient();
  const client = new ParentCareInviteClient({
    baseUrl: "http://127.0.0.1:3000",
    fetcher: async (_input, init) =>
      init?.method === "POST"
        ? Response.json({ error: { code: "STALE_VERSION" } }, { status: 409 })
        : success([record]),
  });
  await client.refresh();
  await client.receipt(recordId, "read");

  assert.equal(client.snapshot.status, "ERROR");
  assert.deepEqual(client.snapshot.records, []);
});
