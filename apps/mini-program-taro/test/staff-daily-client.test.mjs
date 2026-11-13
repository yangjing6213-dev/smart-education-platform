import assert from "node:assert/strict";
import test from "node:test";

const daily = await import("../src/staff-daily/staff-daily.ts").catch((error) => {
  if (error?.code === "ERR_MODULE_NOT_FOUND") return null;
  throw error;
});

const reportId = "00000000-0000-4000-8000-000000000335";
const values = {
  arrival: "ARRIVED_AS_PLANNED",
  homework: "COMPLETED",
  activity: "PARTICIPATED",
  classroom: "ROUTINE",
  followUp: "NONE",
};
const row = (overrides = {}) => ({
  id: reportId,
  version: 1,
  status: "DRAFT",
  date: "2026-10-25",
  values,
  sourceCounts: {
    TASK: 0,
    ATTENDANCE: 0,
    CARE_RECORD: 0,
    PICKUP: 0,
    PICKUP_EXCEPTION: 0,
  },
  learningSummary: null,
  actions: ["edit", "submit"],
  ...overrides,
});

function requireFunction(name) {
  assert.equal(typeof daily?.[name], "function", `Taro daily-report client must provide ${name}`);
  return daily[name];
}

test("staff daily listing uses the server-scoped endpoint and validates the returned report", async () => {
  const calls = [];
  const result = await requireFunction("loadStaffDailyReports")(async (path) => {
    calls.push(path);
    return { records: [row()], canCreate: true };
  });

  assert.deepEqual(calls, ["/staff/daily-reports"]);
  assert.deepEqual(result, { records: [row()], canCreate: true });
  assert.equal("studentId" in result.records[0], false);
});

test("staff daily listing rejects malformed or student-level response fields", async () => {
  const load = requireFunction("loadStaffDailyReports");
  await assert.rejects(
    load(async () => ({ records: [row({ studentId: reportId })], canCreate: true })),
    /日报|格式/u,
  );
  await assert.rejects(
    load(async () => ({
      records: [row({ values: { ...values, classroom: "OTHER" } })],
      canCreate: true,
    })),
    /日报|选项/u,
  );
});

test("staff can create a draft, edit it, submit it, and resubmit a returned report", async () => {
  const calls = [];
  const post = async (path, body) => {
    calls.push({ method: "POST", path, body });
    return row({
      status: path.endsWith("/submit") ? "SUBMITTED" : "DRAFT",
      actions: path.endsWith("/submit") ? [] : ["edit", "submit"],
    });
  };
  const patch = async (path, body) => {
    calls.push({ method: "PATCH", path, body });
    return row({ version: 2, values: body.values });
  };

  await requireFunction("createStaffDailyDraft")(post, "2026-10-25", values);
  await requireFunction("editStaffDailyDraft")(patch, reportId, 1, values);
  await requireFunction("submitStaffDailyDraft")(post, reportId, 2);
  await requireFunction("resubmitStaffDailyDraft")(post, reportId, 3, values);

  assert.deepEqual(calls, [
    { method: "POST", path: "/staff/daily-reports", body: { date: "2026-10-25", values } },
    { method: "PATCH", path: `/staff/daily-reports/${reportId}`, body: { version: 1, values } },
    { method: "POST", path: `/staff/daily-reports/${reportId}/submit`, body: { version: 2 } },
    {
      method: "POST",
      path: `/staff/daily-reports/${reportId}/resubmit`,
      body: { version: 3, values },
    },
  ]);
});

test("daily mutations reject invalid dates, versions, values, and report identifiers before requests", async () => {
  let requests = 0;
  const write = async () => {
    requests += 1;
    return row();
  };
  await assert.rejects(
    requireFunction("createStaffDailyDraft")(write, "2026-02-30", values),
    /日期/u,
  );
  await assert.rejects(
    requireFunction("editStaffDailyDraft")(write, "bad-id", 0, values),
    /日报|编号|版本/u,
  );
  await assert.rejects(
    requireFunction("submitStaffDailyDraft")(write, reportId, 0),
    /日报|编号|版本/u,
  );
  await assert.rejects(
    requireFunction("resubmitStaffDailyDraft")(write, reportId, 1, {
      ...values,
      followUp: "UNKNOWN",
    }),
    /日报|选项/u,
  );
  assert.equal(requests, 0);
});
