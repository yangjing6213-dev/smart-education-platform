import assert from "node:assert/strict";
import test from "node:test";
import * as healthIncidentModule from "../src/health/health-incidents.ts";

const { createHealthIncidentClient } = healthIncidentModule;

const studentId = "00000000-0000-4000-8000-000000000101";
const incidentId = "00000000-0000-4000-8000-000000000201";

test("staff can load only the server-scoped student options and save a health report draft", async () => {
  const calls = [];
  const client = createHealthIncidentClient({
    get: async (path) => {
      calls.push({ method: "GET", path });
      return [{ id: studentId, studentLabel: "学生 01" }];
    },
    post: async (path, body) => {
      calls.push({ method: "POST", path, body });
      return { id: incidentId, version: 1, status: "DRAFT", statusLabel: "草稿", synthetic: true };
    },
  });

  const students = await client.loadStaffStudents();
  const draft = await client.createStaffDraft({
    studentId,
    observationCode: "NEEDS_FOLLOW_UP",
    dispositionCode: "FOLLOW_UP_SCHEDULED",
  });

  assert.deepEqual(students, [{ id: studentId, studentLabel: "学生 01" }]);
  assert.equal(draft.id, incidentId);
  assert.equal(draft.status, "DRAFT");
  assert.deepEqual(calls, [
    { method: "GET", path: "/staff/health-incidents/students" },
    {
      method: "POST",
      path: "/staff/health-incidents",
      body: {
        studentId,
        observationCode: "NEEDS_FOLLOW_UP",
        dispositionCode: "FOLLOW_UP_SCHEDULED",
      },
    },
  ]);
});

test("staff submits a saved draft with its current version", async () => {
  const calls = [];
  const client = createHealthIncidentClient({
    get: async () => [],
    post: async (path, body) => {
      calls.push({ path, body });
      return {
        id: incidentId,
        version: 2,
        status: "SUBMITTED",
        statusLabel: "待审核",
        synthetic: true,
      };
    },
  });

  const submitted = await client.submitStaffDraft(incidentId, 1);

  assert.equal(submitted.status, "SUBMITTED");
  assert.deepEqual(calls, [
    { path: `/staff/health-incidents/${incidentId}/submit`, body: { version: 1 } },
  ]);
});

test("staff can restore a saved draft and submit its current version", async () => {
  const calls = [];
  const savedDraft = {
    id: incidentId,
    version: 4,
    status: "DRAFT",
    statusLabel: "草稿",
    studentId,
    observationCode: "NEEDS_FOLLOW_UP",
    dispositionCode: "FOLLOW_UP_SCHEDULED",
    synthetic: true,
  };
  const client = createHealthIncidentClient({
    get: async (path) => {
      calls.push({ method: "GET", path });
      return [savedDraft];
    },
    post: async (path, body) => {
      calls.push({ method: "POST", path, body });
      return {
        id: incidentId,
        version: 5,
        status: "SUBMITTED",
        statusLabel: "待审核",
        synthetic: true,
      };
    },
  });

  const [draft] = await client.loadStaffDrafts();
  assert.deepEqual(draft, {
    id: incidentId,
    version: 4,
    status: "DRAFT",
    statusLabel: "草稿",
    studentId,
    observationCode: "NEEDS_FOLLOW_UP",
    dispositionCode: "FOLLOW_UP_SCHEDULED",
  });
  const submitted = await client.submitStaffDraft(draft.id, draft.version);

  assert.equal(submitted.status, "SUBMITTED");
  assert.deepEqual(calls, [
    { method: "GET", path: "/staff/health-incidents/drafts" },
    {
      method: "POST",
      path: `/staff/health-incidents/${incidentId}/submit`,
      body: { version: 4 },
    },
  ]);
});

test("parent reads published summaries, marks them read, and acknowledges only after reading", async () => {
  const calls = [];
  let published = false;
  const notice = {
    id: incidentId,
    version: 3,
    status: "PUBLISHED",
    studentLabel: "学生 01",
    parentSummary: "已安排后续关注，请留意后续沟通。",
    receiptStatus: "UNREAD",
    updatedAt: "2026-10-21T01:00:00.000Z",
    synthetic: true,
  };
  const client = createHealthIncidentClient({
    get: async (path) => {
      calls.push({ method: "GET", path });
      return published ? [notice] : [];
    },
    post: async (path, body) => {
      calls.push({ method: "POST", path, body });
      return { ...notice, receiptStatus: path.endsWith("/read") ? "READ" : "ACKNOWLEDGED" };
    },
  });

  const beforePublish = await client.loadParentNotices();
  published = true;
  const notices = await client.loadParentNotices();
  const read = await client.markParentNoticeRead(incidentId, 3);
  const acknowledged = await client.acknowledgeParentNotice(incidentId, 3);

  assert.deepEqual(beforePublish, []);
  assert.deepEqual(notices, [notice]);
  assert.equal(read.receiptStatus, "READ");
  assert.equal(acknowledged.receiptStatus, "ACKNOWLEDGED");
  assert.deepEqual(calls, [
    { method: "GET", path: "/parent/health-incidents" },
    { method: "GET", path: "/parent/health-incidents" },
    { method: "POST", path: `/parent/health-incidents/${incidentId}/read`, body: { version: 3 } },
    { method: "POST", path: `/parent/health-incidents/${incidentId}/ack`, body: { version: 3 } },
  ]);
});

test("client rejects malformed or non-published parent data", async () => {
  const client = createHealthIncidentClient({
    get: async () => [
      {
        id: incidentId,
        version: 1,
        status: "SUBMITTED",
        studentLabel: "学生 01",
        parentSummary: "内部审核内容",
        receiptStatus: "UNREAD",
        updatedAt: "2026-10-21T01:00:00.000Z",
        synthetic: true,
      },
    ],
    post: async () => ({}),
  });

  await assert.rejects(client.loadParentNotices(), /家长健康消息/u);
});

test("a second staff action during a pending health request is ignored", async () => {
  assert.equal(typeof healthIncidentModule.runHealthIncidentSingleFlight, "function");
  const lock = { current: false };
  let requests = 0;
  let release;
  const pending = new Promise((resolve) => {
    release = resolve;
  });

  const first = healthIncidentModule.runHealthIncidentSingleFlight(lock, async () => {
    requests += 1;
    await pending;
    return "submitted";
  });
  const second = await healthIncidentModule.runHealthIncidentSingleFlight(lock, async () => {
    requests += 1;
    return "duplicate";
  });

  assert.deepEqual(second, { started: false });
  assert.equal(requests, 1);
  assert.equal(lock.current, true);
  release();
  assert.deepEqual(await first, { started: true, value: "submitted" });
  assert.equal(lock.current, false);
});
