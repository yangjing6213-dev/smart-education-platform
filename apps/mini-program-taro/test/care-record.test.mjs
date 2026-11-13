import assert from "node:assert/strict";
import test from "node:test";

const care = await import("../src/care-record/care-record.ts").catch((error) => {
  if (error?.code === "ERR_MODULE_NOT_FOUND") return null;
  throw error;
});

const studentId = "11111111-1111-4111-8111-111111111111";
const recordId = "22222222-2222-4222-8222-222222222222";
const values = {
  arrival: "ARRIVED_AS_PLANNED",
  homework: "COMPLETED",
  meal: "FINISHED",
  rest: "RESTED",
  activity: "PARTICIPATED",
  wellbeing: "ROUTINE",
};
const staffStudent = {
  id: studentId,
  student_display_ref: "模拟学生甲",
  class_ref: "三年级甲班",
};
const staffRecord = (overrides = {}) => ({
  id: recordId,
  student_id: studentId,
  student_display_ref: "模拟学生甲",
  class_ref: "三年级甲班",
  service_date: "2026-10-20",
  values,
  status: "DRAFT",
  version: 1,
  published: false,
  publication_version: 0,
  updated_at: "2026-10-20T08:00:00.000Z",
  actions: ["edit", "submit"],
  ...overrides,
});
const parentRecord = (overrides = {}) => ({
  id: recordId,
  student_display_ref: "模拟学生甲",
  service_date: "2026-10-20",
  values,
  version: 3,
  publication_version: 1,
  receipt_status: "UNREAD",
  ...overrides,
});

function requireCareFunction(name) {
  assert.equal(typeof care?.[name], "function", `care-record client must provide ${name}`);
  return care[name];
}

test("staff list is server-scoped and a reviewer without write access gets no create students", async () => {
  const load = requireCareFunction("loadStaffCareRecords");
  const calls = [];
  const result = await load(async (path) => {
    calls.push(path);
    if (path === "/staff/care-records")
      return [staffRecord({ status: "SUBMITTED", actions: ["review"] })];
    throw Object.assign(new Error("forbidden"), { statusCode: 403 });
  }, false);

  assert.deepEqual(calls, ["/staff/care-records"]);
  assert.deepEqual(result.students, []);
  assert.equal(result.records[0].actions.includes("review"), true);
});

test("missing write permission does not probe the student directory", async () => {
  const calls = [];
  const result = await requireCareFunction("loadStaffCareRecords")(async (path) => {
    calls.push(path);
    return [];
  });
  assert.deepEqual(calls, ["/staff/care-records"]);
  assert.deepEqual(result, { records: [], students: [] });
});

test("a writer loads scoped students and still respects a later server permission revocation", async () => {
  const load = requireCareFunction("loadStaffCareRecords");
  const calls = [];
  const result = await load(async (path) => {
    calls.push(path);
    return path === "/staff/care-records" ? [staffRecord()] : [staffStudent];
  }, true);
  assert.deepEqual(calls, ["/staff/care-records", "/staff/care-record-students"]);
  assert.deepEqual(result.students, [staffStudent]);

  const revoked = await load(async (path) => {
    if (path === "/staff/care-records") return [staffRecord({ actions: [] })];
    throw Object.assign(new Error("forbidden"), { statusCode: 403 });
  }, true);
  assert.deepEqual(revoked.students, []);
  assert.deepEqual(revoked.records[0].actions, []);
});

test("staff projection rejects unknown fields instead of showing unreviewed content", async () => {
  const load = requireCareFunction("loadStaffCareRecords");
  await assert.rejects(
    load(async (path) =>
      path === "/staff/care-records" ? [staffRecord({ private_note: "不应返回" })] : [staffStudent],
    ),
    /成长记录/u,
  );
});

test("staff can create only a fixed-field draft for a server-listed student", async () => {
  const create = requireCareFunction("createStaffCareRecord");
  const calls = [];
  const result = await create(
    async (path, body) => {
      calls.push({ path, body });
      return staffRecord();
    },
    [staffStudent],
    studentId,
    "2026-10-20",
    values,
  );

  assert.equal(result.status, "DRAFT");
  assert.deepEqual(calls, [
    {
      path: "/staff/care-records",
      body: { student_id: studentId, service_date: "2026-10-20", values },
    },
  ]);
});

test("staff cannot create for a student outside the server-returned choices", async () => {
  const create = requireCareFunction("createStaffCareRecord");
  let requests = 0;
  await assert.rejects(
    create(
      async () => {
        requests += 1;
        return staffRecord();
      },
      [],
      studentId,
      "2026-10-20",
      values,
    ),
    /负责范围内/u,
  );
  assert.equal(requests, 0);
});

test("staff can submit a draft only when the service projection permits it", async () => {
  const act = requireCareFunction("runStaffCareAction");
  const calls = [];
  const current = staffRecord();
  const submitted = staffRecord({ version: 2, status: "SUBMITTED", actions: ["review"] });
  const result = await act(
    async (path, body) => {
      calls.push({ path, body });
      return submitted;
    },
    current,
    "submit",
  );

  assert.equal(result.status, "SUBMITTED");
  assert.deepEqual(calls, [
    { path: `/staff/care-records/${recordId}/submit`, body: { version: 1 } },
  ]);
});

test("staff cannot run a transition not listed by the service", async () => {
  const act = requireCareFunction("runStaffCareAction");
  let requests = 0;
  await assert.rejects(
    act(
      async () => {
        requests += 1;
        return staffRecord();
      },
      staffRecord({ actions: [] }),
      "publish",
    ),
    /当前服务未开放/u,
  );
  assert.equal(requests, 0);
});

test("review and publication are separate server-confirmed transitions", async () => {
  const act = requireCareFunction("runStaffCareAction");
  const calls = [];
  const submitted = staffRecord({ version: 2, status: "SUBMITTED", actions: ["review"] });
  const confirmed = staffRecord({ version: 3, status: "CONFIRMED", actions: ["publish"] });
  const published = staffRecord({
    version: 4,
    status: "CONFIRMED",
    published: true,
    publication_version: 1,
    actions: [],
  });
  const reviewResult = await act(
    async (path, body) => {
      calls.push({ path, body });
      return confirmed;
    },
    submitted,
    "review",
    "confirm",
  );
  const publishResult = await act(
    async (path, body) => {
      calls.push({ path, body });
      return published;
    },
    reviewResult,
    "publish",
  );

  assert.equal(reviewResult.published, false);
  assert.equal(publishResult.published, true);
  assert.deepEqual(calls, [
    { path: `/staff/care-records/${recordId}/review`, body: { version: 2, action: "confirm" } },
    { path: `/staff/care-records/${recordId}/publish`, body: { version: 3 } },
  ]);
});

test("returned records are resubmitted with the selected fixed values", async () => {
  const act = requireCareFunction("runStaffCareAction");
  const returned = staffRecord({ version: 3, status: "RETURNED", actions: ["edit", "resubmit"] });
  let request;
  await act(
    async (path, body) => {
      request = { path, body };
      return staffRecord({ version: 4, status: "SUBMITTED", actions: ["review"] });
    },
    returned,
    "resubmit",
  );

  assert.deepEqual(request, {
    path: `/staff/care-records/${recordId}/resubmit`,
    body: { version: 3, values },
  });
});

test("withdrawal and publication revocation use the current server action and record version", async () => {
  const act = requireCareFunction("runStaffCareAction");
  const calls = [];
  const submitted = staffRecord({ status: "SUBMITTED", version: 3, actions: ["withdraw"] });
  const withdrawn = await act(
    async (path, body) => {
      calls.push({ path, body });
      return staffRecord({ status: "CANCELLED", version: 4, actions: [] });
    },
    submitted,
    "withdraw",
  );
  assert.equal(withdrawn.status, "CANCELLED");

  const published = staffRecord({
    status: "CONFIRMED",
    version: 7,
    published: true,
    publication_version: 2,
    actions: ["revoke-publication"],
  });
  const revoked = await act(
    async (path, body) => {
      calls.push({ path, body });
      return staffRecord({
        status: "CONFIRMED",
        version: 8,
        published: false,
        publication_version: 2,
        actions: ["publish"],
      });
    },
    published,
    "revoke-publication",
  );
  assert.equal(revoked.published, false);
  assert.equal(revoked.publication_version, 2);
  assert.deepEqual(calls, [
    { path: `/staff/care-records/${recordId}/withdraw`, body: { version: 3 } },
    {
      path: `/staff/care-records/${recordId}/revoke-publication`,
      body: { version: 7 },
    },
  ]);
});

test("parent list accepts only the published summary projection", async () => {
  const load = requireCareFunction("loadParentCareRecords");
  const records = await load(async (path) => {
    assert.equal(path, "/parent/care-records");
    return [parentRecord()];
  });

  assert.equal(records[0].studentLabel, "模拟学生甲");
  assert.equal(records[0].receipt, "UNREAD");
  await assert.rejects(
    load(async () => [parentRecord({ teacher_review_note: "内部内容" })]),
    /成长记录/u,
  );
});

test("parent must open a record before a separate acknowledgement can be recorded", async () => {
  const receipt = requireCareFunction("recordParentCareReceipt");
  let requests = 0;
  await assert.rejects(
    receipt(
      async () => {
        requests += 1;
        return parentRecord({ receipt_status: "ACKNOWLEDGED" });
      },
      parentRecord(),
      "acknowledge",
    ),
    /先打开/u,
  );
  assert.equal(requests, 0);
});

test("parent read and acknowledgement use separate versioned receipts", async () => {
  const receipt = requireCareFunction("recordParentCareReceipt");
  const calls = [];
  const unread = {
    id: recordId,
    version: 3,
    publicationVersion: 1,
    date: "2026-10-20",
    studentLabel: "模拟学生甲",
    values,
    receipt: "UNREAD",
  };
  const read = await receipt(
    async (path, body) => {
      calls.push({ path, body });
      return parentRecord({ receipt_status: "READ" });
    },
    unread,
    "read",
  );
  const acknowledged = await receipt(
    async (path, body) => {
      calls.push({ path, body });
      return parentRecord({ receipt_status: "ACKNOWLEDGED" });
    },
    read,
    "acknowledge",
  );

  assert.equal(acknowledged.receipt, "ACKNOWLEDGED");
  assert.deepEqual(calls, [
    {
      path: `/parent/care-records/${recordId}/receipt`,
      body: { version: 3, publication_version: 1, action: "read" },
    },
    {
      path: `/parent/care-records/${recordId}/receipt`,
      body: { version: 3, publication_version: 1, action: "acknowledge" },
    },
  ]);
});

test("the complete staff-to-parent workflow advances only on service receipts", async () => {
  const create = requireCareFunction("createStaffCareRecord");
  const act = requireCareFunction("runStaffCareAction");
  const loadParent = requireCareFunction("loadParentCareRecords");
  const receipt = requireCareFunction("recordParentCareReceipt");
  const calls = [];
  const post = async (path, body) => {
    calls.push({ path, body });
    if (path === "/staff/care-records") return staffRecord();
    if (path.endsWith("/submit"))
      return staffRecord({ status: "SUBMITTED", version: 2, actions: ["review"] });
    if (path.endsWith("/review"))
      return staffRecord({ status: "CONFIRMED", version: 3, actions: ["publish"] });
    if (path.endsWith("/publish"))
      return staffRecord({
        status: "CONFIRMED",
        version: 4,
        published: true,
        publication_version: 1,
        actions: [],
      });
    if (body.action === "read") return parentRecord({ receipt_status: "READ" });
    if (body.action === "acknowledge") return parentRecord({ receipt_status: "ACKNOWLEDGED" });
    throw new Error(`unexpected workflow request: ${path}`);
  };

  const draft = await create(post, [staffStudent], studentId, "2026-10-20", values);
  const submitted = await act(post, draft, "submit");
  const reviewed = await act(post, submitted, "review", "confirm");
  const published = await act(post, reviewed, "publish");
  assert.equal(published.published, true);

  const parentRecords = await loadParent(async () => [parentRecord()]);
  const opened = await receipt(post, parentRecords[0], "read");
  const acknowledged = await receipt(post, opened, "acknowledge");
  assert.equal(acknowledged.receipt, "ACKNOWLEDGED");
  assert.deepEqual(
    calls.map(({ path }) => path),
    [
      "/staff/care-records",
      `/staff/care-records/${recordId}/submit`,
      `/staff/care-records/${recordId}/review`,
      `/staff/care-records/${recordId}/publish`,
      `/parent/care-records/${recordId}/receipt`,
      `/parent/care-records/${recordId}/receipt`,
    ],
  );
});
