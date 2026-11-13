import assert from "node:assert/strict";
import test from "node:test";
import { STAFF_DAILY_OPTIONS, type StaffDailyValues } from "./staff-daily.js";
import { InviteStaffDailyClient } from "./invite-staff-daily-client.js";

const values: StaffDailyValues = {
  arrival: "ARRIVED_AS_PLANNED",
  homework: "COMPLETED",
  activity: "PARTICIPATED",
  classroom: "ROUTINE",
  followUp: "NONE",
};
const sourceCounts = {
  TASK: 0,
  ATTENDANCE: 0,
  CARE_RECORD: 0,
  PICKUP: 0,
  PICKUP_EXCEPTION: 0,
};
const record = {
  id: "11111111-1111-4111-8111-111111111111",
  version: 1,
  status: "DRAFT",
  date: "2026-10-19",
  values,
  sourceCounts,
  learningSummary: null,
  actions: ["edit", "submit"],
};

function ok(data: unknown, status = 200): Response {
  return Response.json({ data }, { status });
}

test("invited staff daily client reads a safe projection through the same-origin cookie proxy", async () => {
  const requests: { url: string; init: RequestInit }[] = [];
  const client = new InviteStaffDailyClient({
    baseUrl: "https://school.example",
    fetcher: async (input, init = {}) => {
      requests.push({ url: String(input), init });
      return ok({ records: [record], canCreate: true });
    },
  });

  await client.restore();

  assert.equal(client.snapshot.status, "READY");
  assert.equal(client.snapshot.canCreate, true);
  assert.deepEqual(client.snapshot.records, [record]);
  assert.equal(requests.length, 1);
  assert.equal(requests[0]?.url, "https://school.example/api-local/staff/daily-reports");
  assert.equal(requests[0]?.init.method, "GET");
  assert.equal(requests[0]?.init.credentials, "same-origin");
  assert.equal(new Headers(requests[0]?.init.headers).has("authorization"), false);
  assert.equal(requests[0]?.init.body, undefined);
});

test("invited staff can create, edit, submit, and resubmit records using exact bodies", async () => {
  const requests: { url: string; init: RequestInit }[] = [];
  const draftV1 = { ...record, actions: ["edit", "submit"] };
  const draftV2 = { ...record, version: 2, actions: ["edit", "submit"] };
  const submitted = { ...record, status: "SUBMITTED", version: 3, actions: [] };
  const returned = { ...record, status: "RETURNED", version: 4, actions: ["resubmit"] };
  const resubmitted = { ...record, status: "SUBMITTED", version: 5, actions: [] };
  const responses = [
    { records: [], canCreate: true },
    draftV1,
    draftV2,
    submitted,
    { records: [returned], canCreate: false },
    resubmitted,
  ];
  const client = new InviteStaffDailyClient({
    baseUrl: "https://school.example",
    fetcher: async (input, init = {}) => {
      requests.push({ url: String(input), init });
      return ok(responses.shift());
    },
  });

  await client.restore();
  await client.create("2026-10-19", values);
  await client.edit(record.id, 1, values);
  await client.submit(record.id, 2);
  await client.refresh();
  await client.resubmit(record.id, 4, values);

  assert.deepEqual(
    requests.map(({ url, init }) => ({ url, method: init.method, body: init.body })),
    [
      {
        url: "https://school.example/api-local/staff/daily-reports",
        method: "GET",
        body: undefined,
      },
      {
        url: "https://school.example/api-local/staff/daily-reports",
        method: "POST",
        body: JSON.stringify({ date: "2026-10-19", values }),
      },
      {
        url: `https://school.example/api-local/staff/daily-reports/${record.id}`,
        method: "PATCH",
        body: JSON.stringify({ version: 1, values }),
      },
      {
        url: `https://school.example/api-local/staff/daily-reports/${record.id}/submit`,
        method: "POST",
        body: JSON.stringify({ version: 2 }),
      },
      {
        url: "https://school.example/api-local/staff/daily-reports",
        method: "GET",
        body: undefined,
      },
      {
        url: `https://school.example/api-local/staff/daily-reports/${record.id}/resubmit`,
        method: "POST",
        body: JSON.stringify({ version: 4, values }),
      },
    ],
  );
  assert.equal(client.snapshot.records[0]?.status, "SUBMITTED");
});

test("expired and unauthorized invite sessions clear report data", async () => {
  for (const [status, message] of [
    [401, "邀请账号已失效，请重新登录。"],
    [403, "当前账号没有工作日报权限。"],
  ] as const) {
    let call = 0;
    const client = new InviteStaffDailyClient({
      baseUrl: "https://school.example",
      fetcher: async () => {
        call += 1;
        return call === 1
          ? ok({ records: [record], canCreate: true })
          : Response.json({ error: { code: "DENIED" } }, { status });
      },
    });
    await client.restore();
    await client.refresh();
    assert.equal(client.snapshot.status, "ERROR");
    assert.deepEqual(client.snapshot.records, []);
    assert.equal(client.snapshot.canCreate, false);
    assert.equal(client.snapshot.error, message);
  }
});

test("daily client rejects malformed projections and insecure remote origins", async () => {
  const client = new InviteStaffDailyClient({
    baseUrl: "https://school.example",
    fetcher: async () => ok({ records: [{ ...record, tenantId: "leaked" }], canCreate: true }),
  });
  await client.restore();
  assert.equal(client.snapshot.status, "ERROR");
  assert.deepEqual(client.snapshot.records, []);
  assert.throws(
    () =>
      new InviteStaffDailyClient({
        baseUrl: "http://external.example",
      }),
    /安全的同源/,
  );

  assert.ok(STAFF_DAILY_OPTIONS.arrival.some(([code]) => code === values.arrival));
});
