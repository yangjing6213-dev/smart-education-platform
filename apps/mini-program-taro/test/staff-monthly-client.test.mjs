import assert from "node:assert/strict";
import test from "node:test";

const monthly = await import("../src/monthly-feedback/staff-monthly.ts").catch((error) => {
  if (error?.code === "ERR_MODULE_NOT_FOUND") return null;
  throw error;
});
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const supplements = {
  learningParticipation: "PROGRESSING",
  dailyHabits: "KEEP_WATCHING",
  activityParticipation: "FOLLOW_UP",
  familySchoolCollaboration: "PROGRESSING",
};
const row = (overrides = {}) => ({
  id,
  version: 2,
  sourceVersion: 1,
  status: "DRAFT",
  month: "2026-10",
  classRef: "合成月度班级",
  audience: "STAFF_INTERNAL",
  supplements,
  sourceCounts: { GROWTH_RECORD: 3, ATTENDANCE_OVERVIEW: 10001, STAFF_DAILY: 2 },
  actions: ["edit", "submit"],
  ...overrides,
});
function operation(name) {
  assert.equal(typeof monthly?.[name], "function", `Monthly client must provide ${name}`);
  return monthly[name];
}

test("monthly listing retains every authorized record and projects only the safe internal fields", async () => {
  const records = Array.from({ length: 501 }, (_, index) =>
    row({ id: `aaaaaaaa-aaaa-4aaa-8aaa-${index.toString(16).padStart(12, "0")}` }),
  );
  const paths = [];
  const actual = await operation("loadStaffMonthlyReports")(async (path) => {
    paths.push(path);
    return {
      records: records.map((record) => ({
        ...record,
        tenantId: "private",
        studentId: "private",
        sources: ["private"],
        supplements: { ...record.supplements, internalNote: "private" },
        sourceCounts: { ...record.sourceCounts, privateCount: 99 },
      })),
      canCreate: true,
      internalNote: "private",
    };
  });
  assert.deepEqual(paths, ["/staff/monthly-feedback"]);
  assert.deepEqual(actual, { records, canCreate: true });
  assert.notEqual(actual.records[0].supplements, supplements);
  assert.doesNotMatch(JSON.stringify(actual), /private/u);
});

test("monthly listing accepts all six states and five server-provided actions", async () => {
  const load = operation("loadStaffMonthlyReports");
  for (const [status, actions] of [
    ["DRAFT", ["edit", "submit"]],
    ["SUBMITTED", ["confirm", "return"]],
    ["RETURNED", ["edit"]],
    ["CONFIRMED", ["return", "publish"]],
    ["PUBLISHED", []],
    ["REVIEW_REQUIRED", ["edit"]],
  ]) {
    const record = row({ status, actions });
    assert.deepEqual(await load(async () => ({ records: [record], canCreate: false })), {
      records: [record],
      canCreate: false,
    });
  }
});

test("monthly listing rejects malformed projections and duplicate identifiers without coercing values", async () => {
  const load = operation("loadStaffMonthlyReports");
  for (const change of [
    { id: "bad" },
    { version: "2" },
    { version: 0 },
    { sourceVersion: 1.2 },
    { month: "2026-13" },
    { month: "2200-01" },
    { month: ["2026-10"] },
    { classRef: " " },
    { classRef: "x".repeat(81) },
    { audience: "PARENT" },
    { status: ["DRAFT"] },
    { status: "APPROVED" },
    { supplements: { ...supplements, dailyHabits: ["PROGRESSING"] } },
    { supplements: { ...supplements, dailyHabits: "UNKNOWN" } },
    { sourceCounts: { GROWTH_RECORD: 0 } },
    { sourceCounts: { ...row().sourceCounts, STAFF_DAILY: -1 } },
    { sourceCounts: { ...row().sourceCounts, STAFF_DAILY: "2" } },
    { sourceCounts: { ...row().sourceCounts, STAFF_DAILY: Number.MAX_SAFE_INTEGER + 1 } },
    { actions: ["resubmit"] },
    { actions: [["edit"]] },
    { actions: ["edit", "edit"] },
    { status: "PUBLISHED", actions: ["submit"] },
    { status: "SUBMITTED", actions: ["edit"] },
    { status: "RETURNED", actions: ["submit"] },
    { status: "REVIEW_REQUIRED", actions: ["confirm"] },
    { status: "CONFIRMED", actions: ["edit"] },
    { status: "DRAFT", actions: ["publish"] },
  ])
    await assert.rejects(load(async () => ({ records: [row(change)], canCreate: true })));
  for (const listing of [
    null,
    [],
    { records: [row()], canCreate: "true" },
    { records: [row(), row()], canCreate: true },
    { records: [row(), row({ id: id.toUpperCase() })], canCreate: true },
  ])
    await assert.rejects(load(async () => listing));
});

test("monthly mutations use exact create, edit and submit requests without review or resubmit", async () => {
  const calls = [];
  const post = async (path, body) => {
    calls.push({ method: "POST", path, body });
    return row();
  };
  const patch = async (path, body) => {
    calls.push({ method: "PATCH", path, body });
    return row({ version: 3 });
  };
  await operation("createStaffMonthlyDraft")(post, "2026-10", supplements);
  await operation("editStaffMonthlyDraft")(patch, id, 2, supplements);
  await operation("submitStaffMonthlyDraft")(post, id, 3);
  assert.deepEqual(calls, [
    { method: "POST", path: "/staff/monthly-feedback", body: { month: "2026-10", supplements } },
    { method: "PATCH", path: `/staff/monthly-feedback/${id}`, body: { version: 2, supplements } },
    { method: "POST", path: `/staff/monthly-feedback/${id}/submit`, body: { version: 3 } },
  ]);
  for (const month of ["1900-01", "2199-12"])
    await operation("createStaffMonthlyDraft")(async () => row({ month }), month, supplements);
});

test("monthly mutations reject invalid inputs before sending and mismatched returned identities", async () => {
  let calls = 0;
  const write = async () => {
    calls++;
    return row();
  };
  const create = operation("createStaffMonthlyDraft");
  const edit = operation("editStaffMonthlyDraft");
  const submit = operation("submitStaffMonthlyDraft");
  for (const month of ["1899-12", "2026-13", ["2026-10"], "2026-10-01"])
    await assert.rejects(create(write, month, supplements));
  for (const values of [
    [],
    { ...supplements, dailyHabits: ["PROGRESSING"] },
    { ...supplements, tenantId: "forged" },
    { learningParticipation: "PROGRESSING" },
  ]) {
    await assert.rejects(create(write, "2026-10", values));
    await assert.rejects(edit(write, id, 2, values));
  }
  for (const version of [0, -1, 1.5, "2", Number.MAX_SAFE_INTEGER + 1]) {
    await assert.rejects(edit(write, id, version, supplements));
    await assert.rejects(submit(write, id, version));
  }
  await assert.rejects(edit(write, "bad-id", 2, supplements));
  await assert.rejects(submit(write, "bad-id", 2));
  assert.equal(calls, 0);
  const mismatched = async () => row({ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" });
  await assert.rejects(edit(mismatched, id, 2, supplements));
  await assert.rejects(submit(mismatched, id, 2));
  await assert.rejects(create(async () => row({ month: "2026-11" }), "2026-10", supplements));
});

test("monthly operations preserve HTTP errors and never retry writes or reload implicitly", async () => {
  const submit = operation("submitStaffMonthlyDraft");
  for (const statusCode of [401, 403, 404, 409, 503]) {
    let calls = 0;
    const cause = Object.assign(new Error("synthetic request rejected"), { statusCode });
    await assert.rejects(
      submit(
        async () => {
          calls++;
          throw cause;
        },
        id,
        2,
      ),
      (error) => error === cause,
    );
    assert.equal(calls, 1);
  }
});

test("monthly picker metadata supplies the same four strict supplement fields", () => {
  assert.deepEqual(
    monthly?.STAFF_MONTHLY_FIELDS?.map(({ key }) => key),
    Object.keys(supplements),
  );
  for (const field of monthly.STAFF_MONTHLY_FIELDS) {
    assert.ok(field.label);
    assert.deepEqual(
      field.options.map(({ value }) => value),
      ["KEEP_WATCHING", "PROGRESSING", "FOLLOW_UP"],
    );
    for (const option of field.options)
      assert.equal(operation("staffMonthlyValueLabel")(field.key, option.value), option.label);
  }
  assert.equal(operation("staffMonthlyValueLabel")("dailyHabits", "UNKNOWN"), "未记录");
});
