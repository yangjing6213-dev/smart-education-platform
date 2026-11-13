import assert from "node:assert/strict";
import test from "node:test";
import { InviteStaffCareClient } from "./invite-staff-care-client.js";
import type { CareRecordValues } from "../pages/care-record-workflow.js";

const origin = "http://127.0.0.1:3000";
const studentId = "00000000-0000-4000-8000-000000000140";
const recordId = "00000000-0000-4000-8000-000000000141";
const values: CareRecordValues = {
  arrival: "ARRIVED_AS_PLANNED",
  homework: "COMPLETED",
  meal: "FINISHED",
  rest: "RESTED",
  activity: "PARTICIPATED",
  wellbeing: "ROUTINE",
};
const updatedValues: CareRecordValues = { ...values, wellbeing: "CHECK_IN" };
const student = {
  id: studentId,
  student_display_ref: "模拟学生甲",
  class_ref: "模拟一班",
};

function record(
  status: "DRAFT" | "SUBMITTED" | "CONFIRMED" | "RETURNED" | "CANCELLED",
  version: number,
  actions: readonly string[],
  published = false,
) {
  return {
    id: recordId,
    student_id: studentId,
    student_display_ref: student.student_display_ref,
    class_ref: student.class_ref,
    service_date: "2026-10-19",
    values,
    status,
    version,
    published,
    publication_version: 1,
    updated_at: "2026-10-19T08:00:00.000Z",
    actions,
  };
}

test("invited staff care client reads only the same-origin scoped API with cookies", async () => {
  const calls: { path: string; method: string; credentials: RequestCredentials | undefined }[] = [];
  const client = new InviteStaffCareClient({
    baseUrl: origin,
    fetcher: async (input, init = {}) => {
      const path = new URL(String(input)).pathname;
      const method = init.method ?? "GET";
      calls.push({ path, method, credentials: init.credentials });
      if (path === "/api-local/staff/care-record-students")
        return Response.json({ data: [student] });
      if (path === "/api-local/staff/care-records") return Response.json({ data: [] });
      return Response.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
    },
  });

  await client.restore();

  assert.equal(client.snapshot.status, "READY");
  assert.deepEqual(client.snapshot.students, [
    { id: studentId, label: "模拟学生甲", classLabel: "模拟一班" },
  ]);
  assert.deepEqual(calls, [
    {
      path: "/api-local/staff/care-record-students",
      method: "GET",
      credentials: "same-origin",
    },
    { path: "/api-local/staff/care-records", method: "GET", credentials: "same-origin" },
  ]);
});

test("invited staff can save, edit, submit, and resubmit a scoped synthetic care record", async () => {
  const calls: {
    path: string;
    method: string;
    body: unknown;
    authorization: string | undefined;
  }[] = [];
  let current: ReturnType<typeof record> | null = null;
  const client = new InviteStaffCareClient({
    baseUrl: origin,
    fetcher: async (input, init = {}) => {
      const path = new URL(String(input)).pathname;
      const method = init.method ?? "GET";
      const body = typeof init.body === "string" ? JSON.parse(init.body) : undefined;
      calls.push({
        path,
        method,
        body,
        authorization: new Headers(init.headers).get("authorization") ?? undefined,
      });
      if (path === "/api-local/staff/care-record-students")
        return Response.json({ data: [student] });
      if (path === "/api-local/staff/care-records" && method === "GET")
        return Response.json({ data: current ? [current] : [] });
      if (path === "/api-local/staff/care-records" && method === "POST") {
        current = record("DRAFT", 1, ["edit", "submit"]);
        return Response.json({ data: current }, { status: 201 });
      }
      if (path === `/api-local/staff/care-records/${recordId}` && method === "PATCH") {
        current = { ...record("DRAFT", 2, ["edit", "submit"]), values: body.values };
        return Response.json({ data: current });
      }
      if (path === `/api-local/staff/care-records/${recordId}/submit` && method === "POST") {
        current = record("SUBMITTED", 3, []);
        return Response.json({ data: current });
      }
      if (path === `/api-local/staff/care-records/${recordId}/resubmit` && method === "POST") {
        current = { ...record("SUBMITTED", 5, []), values: body.values };
        return Response.json({ data: current });
      }
      return Response.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
    },
  });

  await client.restore();
  await client.create(studentId, "2026-10-19", values);
  assert.equal(client.snapshot.records[0]?.status, "DRAFT");
  await client.edit(recordId, 1, updatedValues);
  assert.equal(client.snapshot.records[0]?.values.wellbeing, "CHECK_IN");
  await client.command(recordId, 2, "submit");
  assert.equal(client.snapshot.records[0]?.status, "SUBMITTED");

  current = record("RETURNED", 4, ["edit", "resubmit"]);
  await client.refresh();
  await client.command(recordId, 4, "resubmit", updatedValues);
  assert.equal(client.snapshot.records[0]?.status, "SUBMITTED");

  const writes = calls.filter(({ method }) => method !== "GET");
  assert.deepEqual(
    writes.map(({ path, method, body }) => ({ path, method, body })),
    [
      {
        path: "/api-local/staff/care-records",
        method: "POST",
        body: { student_id: studentId, service_date: "2026-10-19", values },
      },
      {
        path: `/api-local/staff/care-records/${recordId}`,
        method: "PATCH",
        body: { version: 1, values: updatedValues },
      },
      {
        path: `/api-local/staff/care-records/${recordId}/submit`,
        method: "POST",
        body: { version: 2 },
      },
      {
        path: `/api-local/staff/care-records/${recordId}/resubmit`,
        method: "POST",
        body: { version: 4, values: updatedValues },
      },
    ],
  );
  assert.ok(calls.every(({ authorization }) => authorization === undefined));
});

test("invited reviewer can confirm a submitted care record and separately publish it", async () => {
  const calls: { path: string; method: string; body: unknown }[] = [];
  let current = record("SUBMITTED", 3, ["review"]);
  const client = new InviteStaffCareClient({
    baseUrl: origin,
    fetcher: async (input, init = {}) => {
      const path = new URL(String(input)).pathname;
      const method = init.method ?? "GET";
      const body = typeof init.body === "string" ? JSON.parse(init.body) : undefined;
      calls.push({ path, method, body });
      if (path === "/api-local/staff/care-record-students")
        return Response.json({ data: [student] });
      if (path === "/api-local/staff/care-records" && method === "GET")
        return Response.json({ data: [current] });
      if (path === `/api-local/staff/care-records/${recordId}/review` && method === "POST") {
        current = record("CONFIRMED", 4, ["publish"]);
        return Response.json({ data: current });
      }
      if (path === `/api-local/staff/care-records/${recordId}/publish` && method === "POST") {
        current = record("CONFIRMED", 5, [], true);
        return Response.json({ data: current });
      }
      return Response.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
    },
  });
  await client.restore();
  await client.review(recordId, 3, "confirm");
  assert.equal(client.snapshot.records[0]?.status, "CONFIRMED");
  assert.equal(client.snapshot.records[0]?.published, false);
  await client.publish(recordId, 4);
  assert.equal(client.snapshot.records[0]?.published, true);

  assert.deepEqual(
    calls.filter(({ method }) => method !== "GET"),
    [
      {
        path: `/api-local/staff/care-records/${recordId}/review`,
        method: "POST",
        body: { version: 3, action: "confirm" },
      },
      {
        path: `/api-local/staff/care-records/${recordId}/publish`,
        method: "POST",
        body: { version: 4 },
      },
    ],
  );
});

test("the author can withdraw a server-authorized unpublished record with its current version", async () => {
  const calls: { path: string; method: string; body: unknown }[] = [];
  let current = record("SUBMITTED", 3, ["withdraw"]);
  const client = new InviteStaffCareClient({
    baseUrl: origin,
    fetcher: async (input, init = {}) => {
      const path = new URL(String(input)).pathname;
      const method = init.method ?? "GET";
      const body = typeof init.body === "string" ? JSON.parse(init.body) : undefined;
      calls.push({ path, method, body });
      if (path === "/api-local/staff/care-record-students")
        return Response.json({ data: [student] });
      if (path === "/api-local/staff/care-records" && method === "GET")
        return Response.json({ data: [current] });
      if (path === `/api-local/staff/care-records/${recordId}/withdraw` && method === "POST") {
        current = record("CANCELLED", 4, []);
        return Response.json({ data: current });
      }
      return Response.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
    },
  });

  await client.restore();
  await client.withdraw(recordId, 3);

  assert.equal(client.snapshot.records[0]?.status, "CANCELLED");
  assert.deepEqual(
    calls.filter(({ method }) => method !== "GET"),
    [
      {
        path: `/api-local/staff/care-records/${recordId}/withdraw`,
        method: "POST",
        body: { version: 3 },
      },
    ],
  );
});

test("a publisher can revoke publication only from the server-authorized published projection", async () => {
  const calls: { path: string; method: string; body: unknown }[] = [];
  let current = record("CONFIRMED", 5, ["revoke-publication"], true);
  const client = new InviteStaffCareClient({
    baseUrl: origin,
    fetcher: async (input, init = {}) => {
      const path = new URL(String(input)).pathname;
      const method = init.method ?? "GET";
      const body = typeof init.body === "string" ? JSON.parse(init.body) : undefined;
      calls.push({ path, method, body });
      if (path === "/api-local/staff/care-record-students")
        return Response.json({ data: [student] });
      if (path === "/api-local/staff/care-records" && method === "GET")
        return Response.json({ data: [current] });
      if (
        path === `/api-local/staff/care-records/${recordId}/revoke-publication` &&
        method === "POST"
      ) {
        current = record("CONFIRMED", 6, ["publish"], false);
        return Response.json({ data: current });
      }
      return Response.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
    },
  });

  await client.restore();
  await client.revokePublication(recordId, 5);

  assert.equal(client.snapshot.records[0]?.published, false);
  assert.deepEqual(
    calls.filter(({ method }) => method !== "GET"),
    [
      {
        path: `/api-local/staff/care-records/${recordId}/revoke-publication`,
        method: "POST",
        body: { version: 5 },
      },
    ],
  );
});

test("review-only client reads review records without requesting writer student options", async () => {
  const calls: string[] = [];
  const client = new InviteStaffCareClient({
    baseUrl: origin,
    loadStudents: false,
    fetcher: async (input) => {
      const path = new URL(String(input)).pathname;
      calls.push(path);
      if (path === "/api-local/staff/care-records")
        return Response.json({ data: [record("SUBMITTED", 3, ["review"])] });
      return Response.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
    },
  });

  await client.restore();

  assert.equal(client.snapshot.status, "READY");
  assert.deepEqual(client.snapshot.students, []);
  assert.equal(client.snapshot.records[0]?.actions.includes("review"), true);
  assert.deepEqual(calls, ["/api-local/staff/care-records"]);
});

test("expired and unauthorized sessions clear records and report the right next step", async () => {
  for (const [status, expectedState] of [
    [401, "IDLE"],
    [403, "DENIED"],
  ] as const) {
    const client = new InviteStaffCareClient({
      baseUrl: origin,
      fetcher: async () => Response.json({ error: { code: "UNAVAILABLE" } }, { status }),
    });
    await client.restore();
    assert.equal(client.snapshot.status, expectedState);
    assert.deepEqual(client.snapshot.students, []);
    assert.deepEqual(client.snapshot.records, []);
    assert.ok(client.snapshot.message.length > 0);
  }
});

test("invalid API records fail closed and external origins are rejected", async () => {
  const client = new InviteStaffCareClient({
    baseUrl: origin,
    fetcher: async () => Response.json({ data: [{ ...student, tenant_id: "forged" }] }),
  });
  await client.restore();
  assert.equal(client.snapshot.status, "ERROR");
  assert.deepEqual(client.snapshot.students, []);

  assert.throws(
    () => new InviteStaffCareClient({ baseUrl: "https://example.invalid/path" }),
    /同源/u,
  );
});
