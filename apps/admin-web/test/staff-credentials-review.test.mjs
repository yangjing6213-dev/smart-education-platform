/* global Response, URL */

import assert from "node:assert/strict";
import test from "node:test";
import {
  createLocalStaffCredentialsTransport,
  StaffCredentialsReviewClient,
} from "../src/local-review/staff-credentials-review.ts";

const eastTenant = "00000000-0000-4000-8000-000000000100";
const eastCampus = "00000000-0000-4000-8000-000000000101";
const ownerId = "00000000-0000-4000-8000-000000000004";
const staffId = "00000000-0000-4000-8000-000000000003";
const credentialId = "11111111-1111-4111-8111-111111111111";
const handle = "h".repeat(43);

function membership(overrides = {}) {
  return {
    actorId: staffId,
    version: 1,
    profile: "teacher-east",
    label: "示例东校区教师",
    role: "教师",
    tenantId: eastTenant,
    campusId: eastCampus,
    classIds: [],
    status: "ACTIVE",
    capabilities: [],
    ...overrides,
  };
}

function credential(overrides = {}) {
  return {
    id: credentialId,
    version: 1,
    staffId,
    staffLabel: "示例东校区教师",
    staffRole: "教师",
    category: "TEACHING_QUALIFICATION",
    issueDate: "2025-01-01",
    expiryDate: "2026-11-01",
    expiryStatus: "EXPIRING_SOON",
    responsibleRole: "CAMPUS_OWNER",
    updatedAt: "2026-10-16T08:00:00.000Z",
    history: [],
    ...overrides,
  };
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function createHarness({ actions = ["membership:manage"], memberships, records } = {}) {
  const calls = [];
  const members = memberships ?? [membership()];
  let rows = records ?? [credential()];
  const transport = async (input, init = {}) => {
    const url = new URL(typeof input === "string" ? input : input.url, "http://127.0.0.1:4319");
    const method = (init.method ?? "GET").toUpperCase();
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ method, path: url.pathname, body });
    if (url.pathname === "/local/sessions" && method === "POST") return json({ handle }, 201);
    if (url.pathname === "/local/session" && method === "GET")
      return json({
        label: "示例东校区负责人",
        actorId: ownerId,
        tenantId: eastTenant,
        campusId: eastCampus,
        actions,
      });
    if (url.pathname === "/local/memberships" && method === "GET") return json(members);
    if (url.pathname === "/local/staff-credentials" && method === "GET") return json(rows);
    if (url.pathname === "/local/staff-credentials" && method === "POST") {
      const created = credential({ ...body, id: "22222222-2222-4222-8222-222222222222" });
      rows = [...rows, created];
      return json(created, 201);
    }
    const match = url.pathname.match(/^\/local\/staff-credentials\/([^/]+)$/u);
    if (match && method === "PATCH") {
      const current = rows.find((row) => row.id === match[1]);
      if (!current || current.version !== body.version)
        return json({ error: "STATE_CONFLICT" }, 409);
      const updated = { ...current, ...body, version: current.version + 1 };
      rows = rows.map((row) => (row.id === current.id ? updated : row));
      return json(updated);
    }
    return json({ error: "NOT_FOUND" }, 404);
  };
  return { calls, client: new StaffCredentialsReviewClient(transport) };
}

test("transport allows only the local credential and manager-scope endpoints", async () => {
  const calls = [];
  const transport = createLocalStaffCredentialsTransport(4319, async (input, init) => {
    calls.push({ url: input.url, method: init.method });
    return json([]);
  });
  await transport("/local/sessions", { method: "POST" });
  await transport("/local/session", { method: "GET" });
  await transport("/local/memberships", { method: "GET" });
  await transport("/local/staff-credentials", { method: "GET" });
  assert.equal(calls.length, 4);
  await assert.rejects(transport("https://example.com/local/staff-credentials", { method: "GET" }));
  await assert.rejects(transport("/local/staff-credentials?campusId=elsewhere", { method: "GET" }));
  await assert.rejects(transport("/local/staff-credentials", { method: "DELETE" }));
  await assert.rejects(transport("/local/memberships", { method: "PATCH" }));
  await assert.rejects(createLocalStaffCredentialsTransport(null)("/local/session"));
});

test("owner connection shows only same-campus credential summaries", async () => {
  const { client } = createHarness();
  await client.connect("owner-east");
  assert.equal(client.snapshot.status, "READY");
  assert.equal(client.snapshot.records.length, 1);
  assert.equal(client.snapshot.records[0]?.expiryStatus, "EXPIRING_SOON");
  assert.deepEqual(
    client.snapshot.staff.map(({ label }) => label),
    ["示例东校区教师"],
  );
  assert.equal(client.snapshot.actions.includes("membership:manage"), true);
});

test("credential creation and update send only fixed fields and the displayed version", async () => {
  const { client, calls } = createHarness();
  await client.connect("owner-east");
  const created = await client.create({
    staffId,
    category: "FIRST_AID_TRAINING",
    issueDate: "2026-01-01",
    expiryDate: "2027-01-01",
    responsibleRole: "STAFF_MEMBER",
  });
  assert.equal(created, true);
  const createCall = calls.find(
    ({ method, path }) => method === "POST" && path === "/local/staff-credentials",
  );
  assert.deepEqual(Object.keys(createCall.body).sort(), [
    "category",
    "expiryDate",
    "issueDate",
    "responsibleRole",
    "staffId",
  ]);
  assert.equal("tenantId" in createCall.body, false);
  assert.equal("campusId" in createCall.body, false);
  const row = client.snapshot.records.find((record) => record.category === "FIRST_AID_TRAINING");
  assert.ok(row);
  assert.equal(
    await client.update(row.id, row.version, {
      issueDate: "2026-01-01",
      expiryDate: "2028-01-01",
      responsibleRole: "CAMPUS_OWNER",
    }),
    true,
  );
  const updateCall = calls.find(({ method, path }) => method === "PATCH" && path.endsWith(row.id));
  assert.deepEqual(updateCall.body, {
    version: 1,
    issueDate: "2026-01-01",
    expiryDate: "2028-01-01",
    responsibleRole: "CAMPUS_OWNER",
  });
  assert.equal(client.snapshot.records.find((record) => record.id === row.id)?.version, 2);
});

test("permission denial and mismatched-campus rows fail closed", async () => {
  const denied = createHarness({ actions: ["care:review"] }).client;
  await denied.connect("owner-east");
  assert.equal(denied.snapshot.status, "DENIED");
  assert.equal(denied.snapshot.records.length, 0);

  const crossCampus = createHarness({
    records: [credential({ campusId: "00000000-0000-4000-8000-000000000102" })],
  }).client;
  await crossCampus.connect("owner-east");
  assert.equal(crossCampus.snapshot.status, "DENIED");
  assert.equal(crossCampus.snapshot.records.length, 0);
});

test("disconnect prevents a late read from restoring credential rows", async () => {
  let release;
  const gate = new Promise((resolve) => (release = resolve));
  const base = createHarness().client;
  const client = new StaffCredentialsReviewClient(async (input, init = {}) => {
    const url = new URL(typeof input === "string" ? input : input.url, "http://127.0.0.1:4319");
    if (url.pathname === "/local/staff-credentials" && init.method === "GET") await gate;
    return json(
      url.pathname === "/local/sessions"
        ? { handle }
        : url.pathname === "/local/session"
          ? {
              label: "示例东校区负责人",
              actorId: ownerId,
              tenantId: eastTenant,
              campusId: eastCampus,
              actions: ["membership:manage"],
            }
          : url.pathname === "/local/memberships"
            ? [membership()]
            : [credential()],
    );
  });
  const pending = client.connect("owner-east");
  await Promise.resolve();
  client.disconnect();
  release();
  await pending;
  assert.equal(client.snapshot.status, "IDLE");
  assert.equal(client.snapshot.records.length, 0);
  assert.equal(base.snapshot.status, "IDLE");
});
