import assert from "node:assert/strict";
import test from "node:test";
import { StaffBindingClient } from "./staff-binding-client.js";

const applicationId = "00000000-0000-4000-8000-000000000201";
const application = {
  id: applicationId,
  relationship: "GUARDIAN",
  status: "PENDING",
  version: 1,
  submitted_at: "2026-10-19T04:00:00.000Z",
  reviewed_at: null,
  applicant_label: "示例监护人甲",
  student_label: "示例学生甲",
};

test("staff relationship review uses the invite cookie proxy and versioned approval body", async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetcher: typeof fetch = async (input, init = {}) => {
    calls.push({ url: String(input), init });
    return Response.json({
      data: new URL(String(input)).pathname.endsWith("/applications")
        ? [application]
        : { ...application, status: "APPROVED", version: 2 },
    });
  };
  const client = new StaffBindingClient({ baseUrl: "https://app.example.test", fetcher });
  await client.refresh();
  assert.equal(client.snapshot.applications[0]?.id, applicationId);
  await client.review(applicationId, 1, "approve");
  assert.equal(
    calls[0]?.url,
    "https://app.example.test/api-local/staff/guardian-binding/applications",
  );
  assert.equal(calls[0]?.init.credentials, "same-origin");
  assert.equal(new Headers(calls[0]?.init.headers).has("authorization"), false);
  assert.deepEqual(JSON.parse(String(calls[1]?.init.body)), { version: 1, action: "approve" });
  assert.equal(
    calls[1]?.url,
    `https://app.example.test/api-local/staff/guardian-binding/applications/${applicationId}/review`,
  );
});

test("staff relationship review client rejects malformed application identifiers", async () => {
  let requests = 0;
  const client = new StaffBindingClient({
    baseUrl: "http://127.0.0.1:3000",
    fetcher: async () => {
      requests += 1;
      return Response.json({ data: [] });
    },
  });
  await client.review("not-a-uuid", 1, "reject");
  assert.equal(client.snapshot.status, "ERROR");
  assert.equal(requests, 0);
});
