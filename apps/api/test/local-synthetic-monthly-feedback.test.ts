import assert from "node:assert/strict";
import test from "node:test";
import { MonthlyFeedbackService } from "../src/local-synthetic/monthly-feedback.service.js";
import {
  LocalRepository,
  type Attendance,
  type Binding,
  type Care,
  type StaffDailyReport,
} from "../src/local-synthetic/repository.js";
import { LOCAL_STUDENT, memberForActor } from "../src/local-synthetic/sessions.js";
import { buildLocalSyntheticServer } from "../src/local-synthetic/server.js";

type App = Awaited<ReturnType<typeof buildLocalSyntheticServer>>;
type Row = Record<string, unknown> & { id: string; version: number; status: string };
type FeedbackRow = Row & {
  sourceVersion: number;
  published: boolean;
  parentAcknowledgedBy: unknown[];
};
type Response = { statusCode: number; body: string; json(): unknown };

async function call(
  app: App,
  actor: string,
  method: "GET" | "POST" | "PATCH",
  url: string,
  body?: unknown,
) {
  return app.inject({
    method,
    url,
    headers: { host: "127.0.0.1:4317", ...(actor ? { authorization: `Bearer ${actor}` } : {}) },
    ...(body === undefined ? {} : { payload: body as object }),
  } as never) as unknown as Promise<Response>;
}

async function session(app: App, profile: string) {
  const response = await call(app, "", "POST", "/local/sessions", { profile });
  assert.equal(response.statusCode, 201, response.body);
  return (response.json() as { handle: string }).handle;
}

async function approvedBinding(app: App, parent: string, owner: string) {
  const applied = await call(app, parent, "POST", "/local/binding-applications", {
    student: "student-alpha",
    relationship: "GUARDIAN",
  });
  assert.equal(applied.statusCode, 201, applied.body);
  const pending = applied.json() as Row;
  const approved = await call(
    app,
    owner,
    "POST",
    `/local/binding-applications/${pending.id}/review`,
    { version: pending.version, action: "approve" },
  );
  assert.equal(approved.statusCode, 200, approved.body);
}

const supplements = {
  learningParticipation: "PROGRESSING",
  dailyHabits: "KEEP_WATCHING",
  activityParticipation: "PROGRESSING",
  familySchoolCollaboration: "FOLLOW_UP",
};
const careValues = {
  arrival: "ARRIVED_AS_PLANNED",
  homework: "COMPLETED",
  meal: "FINISHED",
  rest: "RESTED",
  activity: "PARTICIPATED",
  wellbeing: "ROUTINE",
};

async function publishCare(app: App, teacher: string, owner: string, date: string) {
  const created = await call(app, teacher, "POST", "/local/care-records", {
    student: "student-alpha",
    date,
    values: careValues,
  });
  assert.equal(created.statusCode, 201, created.body);
  let row = created.json() as Row;
  for (const [actor, action, extra] of [
    [teacher, "submit", {}],
    [owner, "review", { action: "confirm" }],
    [owner, "publish", {}],
  ] as const) {
    const response = await call(app, actor, "POST", `/local/care-records/${row.id}/${action}`, {
      version: row.version,
      ...extra,
    });
    assert.equal(response.statusCode, 200, response.body);
    row = response.json() as Row;
  }
  return row;
}

test("monthly feedback supports fixed supplements, review, publish and parent acknowledgement", async () => {
  const app = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  try {
    const teacher = await session(app, "teacher-east");
    const owner = await session(app, "owner-east");
    const parent = await session(app, "parent-alpha");
    await approvedBinding(app, parent, owner);

    const rejected = await call(app, teacher, "POST", "/local/monthly-feedback", {
      month: "2026-10",
      supplements: { ...supplements, note: "free text must be rejected" },
    });
    assert.equal(rejected.statusCode, 400, rejected.body);
    let response = await call(app, teacher, "POST", "/local/monthly-feedback", {
      month: "2026-10",
      supplements,
    });
    assert.equal(response.statusCode, 201, response.body);
    let row = response.json() as Row;
    assert.equal(row.status, "DRAFT");
    response = await call(app, teacher, "POST", `/local/monthly-feedback/${row.id}/submit`, {
      version: row.version,
    });
    assert.equal(response.statusCode, 200, response.body);
    row = response.json() as Row;
    response = await call(app, owner, "POST", `/local/monthly-feedback/${row.id}/review`, {
      version: row.version,
      action: "RETURN",
    });
    assert.equal(response.statusCode, 200, response.body);
    row = response.json() as Row;
    assert.equal(row.status, "RETURNED");
    response = await call(app, teacher, "POST", `/local/monthly-feedback/${row.id}/resubmit`, {
      version: row.version,
      supplements: { ...supplements, dailyHabits: "PROGRESSING" },
    });
    assert.equal(response.statusCode, 200, response.body);
    row = response.json() as Row;
    response = await call(app, owner, "POST", `/local/monthly-feedback/${row.id}/review`, {
      version: row.version,
      action: "CONFIRM",
    });
    assert.equal(response.statusCode, 200, response.body);
    row = response.json() as Row;
    response = await call(app, owner, "POST", `/local/monthly-feedback/${row.id}/publish`, {
      version: row.version,
    });
    assert.equal(response.statusCode, 200, response.body);
    row = response.json() as Row;
    assert.equal(row.status, "PUBLISHED");

    const parentSummary = await call(app, parent, "GET", "/local/monthly-feedback-parent");
    assert.equal(parentSummary.statusCode, 200, parentSummary.body);
    const summary = (parentSummary.json() as Array<Record<string, unknown>>)[0]!;
    assert.equal(summary.month, "2026-10");
    assert.equal(summary.synthetic, true);
    assert.equal("sources" in summary, false);
    assert.equal("reviewedBy" in summary, false);
    response = await call(app, parent, "POST", `/local/monthly-feedback/${row.id}/ack`, {
      version: row.version,
    });
    assert.equal(response.statusCode, 200, response.body);
    assert.equal((response.json() as { acknowledged: boolean }).acknowledged, true);
  } finally {
    await app.close();
  }
});

test("monthly feedback enforces scope, roles, version and source invalidation", async () => {
  const app = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  try {
    const teacher = await session(app, "teacher-east");
    const owner = await session(app, "owner-east");
    const west = await session(app, "owner-west");
    const parent = await session(app, "parent-alpha");
    await publishCare(app, teacher, owner, "2026-11-10");
    const created = await call(app, teacher, "POST", "/local/monthly-feedback", {
      month: "2026-11",
      supplements,
    });
    assert.equal(created.statusCode, 201, created.body);
    const row = created.json() as Row;
    assert.equal(
      (
        await call(app, teacher, "POST", `/local/monthly-feedback/${row.id}/submit`, {
          version: 99,
        })
      ).statusCode,
      409,
    );
    assert.equal(
      (await call(app, west, "GET", `/local/monthly-feedback/${row.id}`)).statusCode,
      403,
    );
    assert.equal(
      (await call(app, parent, "GET", "/local/monthly-feedback-parent")).statusCode,
      200,
    );
    let response = await call(app, teacher, "POST", `/local/monthly-feedback/${row.id}/submit`, {
      version: row.version,
    });
    const submitted = response.json() as Row;
    response = await call(app, owner, "POST", `/local/monthly-feedback/${row.id}/review`, {
      version: submitted.version,
      action: "CONFIRM",
    });
    const confirmed = response.json() as Row;
    response = await call(app, owner, "POST", `/local/monthly-feedback/${row.id}/publish`, {
      version: confirmed.version,
    });
    const published = response.json() as Row;
    response = await call(app, owner, "POST", `/local/monthly-feedback/${row.id}/source-refresh`, {
      version: published.version,
    });
    assert.equal(response.statusCode, 200, response.body);
    const unchanged = response.json() as Row;
    assert.equal(unchanged.status, "PUBLISHED", "refresh without source changes is read-only");
    assert.equal(unchanged.version, published.version);
    await publishCare(app, teacher, owner, "2026-11-11");
    response = await call(app, owner, "POST", `/local/monthly-feedback/${row.id}/source-refresh`, {
      version: unchanged.version,
    });
    assert.equal(response.statusCode, 200, response.body);
    assert.equal((response.json() as Row).status, "REVIEW_REQUIRED");
    const queue = (await call(app, owner, "GET", "/local/monthly-feedback-review")).json() as Row[];
    assert.equal(queue.find((item) => item.id === row.id)?.status, "REVIEW_REQUIRED");
  } finally {
    await app.close();
  }
});

async function acknowledgedFeedback(app: App) {
  const teacher = await session(app, "teacher-east");
  const owner = await session(app, "owner-east");
  const parent = await session(app, "parent-alpha");
  await approvedBinding(app, parent, owner);
  await publishCare(app, teacher, owner, "2026-10-13");
  const created = await call(app, teacher, "POST", "/local/monthly-feedback", {
    month: "2026-10",
    supplements,
  });
  assert.equal(created.statusCode, 201, created.body);
  let row = created.json() as Row;
  for (const [actor, action, extra] of [
    [teacher, "submit", {}],
    [owner, "review", { action: "CONFIRM" }],
    [owner, "publish", {}],
    [parent, "ack", {}],
  ] as const) {
    const response = await call(app, actor, "POST", `/local/monthly-feedback/${row.id}/${action}`, {
      version: row.version,
      ...extra,
    });
    assert.equal(response.statusCode, 200, response.body);
    row = response.json() as Row;
  }
  return { teacher, owner, parent, row };
}

test("source-invalidated feedback rebuilds a current-source draft before re-review and fresh parent acknowledgement", async () => {
  const app = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  try {
    const { teacher, owner, parent, row: acknowledged } = await acknowledgedFeedback(app);
    const path = `/local/monthly-feedback/${acknowledged.id}`;
    await publishCare(app, teacher, owner, "2026-10-14");
    const invalidated = await call(app, owner, "POST", `${path}/source-refresh`, {
      version: acknowledged.version,
    });
    assert.equal(invalidated.statusCode, 200, invalidated.body);
    let row = invalidated.json() as Row;
    assert.equal(row.status, "REVIEW_REQUIRED");
    const hidden = (
      await call(app, parent, "GET", "/local/monthly-feedback-parent")
    ).json() as Array<Record<string, unknown>>;
    assert.equal(hidden[0]?.status, "REVIEW_REQUIRED");
    assert.deepEqual(hidden[0]?.items, []);
    assert.equal(hidden[0]?.acknowledged, false);
    const refreshedAgain = await call(app, owner, "POST", `${path}/source-refresh`, {
      version: row.version,
    });
    assert.equal(refreshedAgain.statusCode, 200, refreshedAgain.body);
    assert.equal((refreshedAgain.json() as FeedbackRow).version, row.version);
    assert.equal((refreshedAgain.json() as FeedbackRow).sourceVersion, row.sourceVersion);
    const changed = {
      learningParticipation: "FOLLOW_UP",
      dailyHabits: "PROGRESSING",
      activityParticipation: "KEEP_WATCHING",
      familySchoolCollaboration: "PROGRESSING",
    };
    const previousVersion = row.version;
    const edited = await call(app, teacher, "PATCH", path, {
      version: row.version,
      supplements: changed,
    });
    assert.equal(
      edited.statusCode,
      200,
      "REVIEW_REQUIRED must have a same-record teacher rework route: " + edited.body,
    );
    row = edited.json() as Row;
    assert.equal(row.id, acknowledged.id);
    assert.equal(row.version, previousVersion + 1);
    assert.equal(row.status, "DRAFT");
    assert.equal(row.sourceVersion, 2, "repeated refresh must not invent another source version");
    assert.equal("sources" in row, false, "staff responses do not expose source record IDs");
    assert.deepEqual((row.sourceSummary as Array<{ count: number; dates: string[] }>)[0]?.dates, [
      "2026-10-13",
      "2026-10-14",
    ]);
    assert.equal((row.sourceSummary as Array<{ count: number }>)[0]?.count, 2);
    assert.deepEqual(row.supplements, changed);
    assert.equal(row.reviewedBy, null);
    assert.equal(row.published, false);
    assert.deepEqual(row.parentAcknowledgedBy, []);
    assert.deepEqual((await call(app, parent, "GET", "/local/monthly-feedback-parent")).json(), []);
    assert.equal(
      (await call(app, owner, "POST", `${path}/publish`, { version: row.version })).statusCode,
      409,
      "draft cannot skip review",
    );
    const staleEdit = await call(app, teacher, "PATCH", path, {
      version: previousVersion,
      supplements,
    });
    assert.equal(staleEdit.statusCode, 409);
    const submitted = await call(app, teacher, "POST", `${path}/submit`, { version: row.version });
    assert.equal(submitted.statusCode, 200, submitted.body);
    row = submitted.json() as Row;
    const queue = (await call(app, owner, "GET", "/local/monthly-feedback-review")).json() as Row[];
    assert.deepEqual(queue.find((item) => item.id === row.id)?.supplements, changed);
    assert.equal(
      (await call(app, owner, "POST", `${path}/publish`, { version: row.version })).statusCode,
      409,
      "submission cannot skip explicit confirmation",
    );
    const confirmed = await call(app, owner, "POST", `${path}/review`, {
      version: row.version,
      action: "CONFIRM",
    });
    assert.equal(confirmed.statusCode, 200, confirmed.body);
    row = confirmed.json() as Row;
    assert.deepEqual(
      (await call(app, parent, "GET", "/local/monthly-feedback-parent")).json(),
      [],
      "confirmation is not publication",
    );
    const published = await call(app, owner, "POST", `${path}/publish`, { version: row.version });
    assert.equal(published.statusCode, 200, published.body);
    row = published.json() as Row;
    const visible = (
      await call(app, parent, "GET", "/local/monthly-feedback-parent")
    ).json() as Array<Record<string, unknown>>;
    assert.equal(visible[0]?.status, "PUBLISHED");
    assert.equal(
      visible[0]?.acknowledged,
      false,
      "old acknowledgement must not survive new publication",
    );
    assert.deepEqual(
      (visible[0]?.items as Array<{ value: string }>).map((item) => item.value),
      Object.values(changed),
    );
    assert.equal(
      (await call(app, parent, "POST", `${path}/ack`, { version: acknowledged.version }))
        .statusCode,
      409,
    );
    const freshAck = await call(app, parent, "POST", `${path}/ack`, { version: row.version });
    assert.equal(freshAck.statusCode, 200, freshAck.body);
    assert.equal((freshAck.json() as { acknowledged: boolean }).acknowledged, true);
    const audit = await call(app, owner, "GET", "/local/audit");
    assert.equal(audit.statusCode, 200, audit.body);
    assert.match(audit.body, /feedback\.edit/u);
    assert.match(audit.body, /feedback\.source-invalidated/u);
  } finally {
    await app.close();
  }
});

test("source-invalidated rework rejects peers, other scopes, stale versions and illegal supplement fields", async () => {
  const app = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  try {
    const { teacher, owner, row: published } = await acknowledgedFeedback(app);
    const path = `/local/monthly-feedback/${published.id}`;
    await publishCare(app, teacher, owner, "2026-10-14");
    const invalidated = await call(app, owner, "POST", `${path}/source-refresh`, {
      version: published.version,
    });
    assert.equal(invalidated.statusCode, 200, invalidated.body);
    const row = invalidated.json() as Row;
    for (const profile of [
      "teacher-east-peer",
      "teacher-other-class",
      "owner-west",
      "owner-other-tenant",
      "parent-alpha",
      "platform-admin",
      "owner-east",
    ]) {
      const actor = await session(app, profile);
      const rejected = await call(app, actor, "PATCH", path, { version: row.version, supplements });
      assert.equal(rejected.statusCode, 403, `${profile}: ${rejected.body}`);
    }
    for (const body of [
      { version: row.version, supplements: { ...supplements, dailyHabits: "arbitrary" } },
      { version: row.version, supplements: { ...supplements, note: "free text" } },
      { version: row.version, supplements: { learningParticipation: "PROGRESSING" } },
      { version: row.version, supplements, sourceVersion: 99 },
      { version: row.version, supplements, tenantId: "forged" },
    ]) {
      const rejected = await call(app, teacher, "PATCH", path, body);
      assert.equal(rejected.statusCode, 400, rejected.body);
    }
    assert.equal(
      (await call(app, teacher, "PATCH", path, { version: row.version - 1, supplements }))
        .statusCode,
      409,
    );
    assert.equal(
      (await call(app, teacher, "POST", `${path}/submit`, { version: row.version })).statusCode,
      409,
    );
    assert.equal(
      (await call(app, teacher, "POST", `${path}/resubmit`, { version: row.version, supplements }))
        .statusCode,
      409,
    );
    const unchanged = await call(app, teacher, "GET", path);
    assert.equal(unchanged.statusCode, 200, unchanged.body);
    assert.deepEqual(
      unchanged.json(),
      row,
      "rejected rework must not mutate source or feedback state",
    );
  } finally {
    await app.close();
  }
});

function feedbackFixture() {
  const teacher = memberForActor("00000000-0000-4000-8000-000000000003")!;
  const owner = memberForActor("00000000-0000-4000-8000-000000000004")!;
  const parent = memberForActor("00000000-0000-4000-8000-000000000001")!;
  const repository = new LocalRepository();
  repository.insert({
    id: "binding-for-monthly-feedback",
    version: 1,
    kind: "binding",
    tenantId: LOCAL_STUDENT.tenantId,
    campusId: LOCAL_STUDENT.campusId,
    classId: LOCAL_STUDENT.classId,
    guardianId: parent.actorId,
    studentId: LOCAL_STUDENT.id,
    relationship: "GUARDIAN",
    status: "APPROVED",
  } satisfies Binding);
  return { teacher, owner, parent, repository, service: new MonthlyFeedbackService(repository) };
}

function sourceCare(id: string, overrides: Partial<Care> = {}): Care {
  const teacher = memberForActor("00000000-0000-4000-8000-000000000003")!;
  const owner = memberForActor("00000000-0000-4000-8000-000000000004")!;
  return {
    id,
    version: 3,
    kind: "care",
    tenantId: LOCAL_STUDENT.tenantId,
    campusId: LOCAL_STUDENT.campusId,
    classId: LOCAL_STUDENT.classId,
    studentId: LOCAL_STUDENT.id,
    date: "2026-10-04",
    values: {
      arrival: "ARRIVED_AS_PLANNED",
      homework: "COMPLETED",
      meal: "FINISHED",
      rest: "RESTED",
      activity: "PARTICIPATED",
      wellbeing: "ROUTINE",
    },
    status: "CONFIRMED",
    createdBy: teacher.actorId,
    reviewedBy: owner.actorId,
    updatedBy: owner.actorId,
    updatedAt: "2026-10-04T09:00:00.000Z",
    published: true,
    publicationVersion: 1,
    history: [],
    ...overrides,
  };
}

function sourceAttendance(id: string, overrides: Partial<Attendance> = {}): Attendance {
  return {
    id,
    version: 2,
    kind: "attendance",
    tenantId: LOCAL_STUDENT.tenantId,
    campusId: LOCAL_STUDENT.campusId,
    classId: LOCAL_STUDENT.classId,
    studentId: LOCAL_STUDENT.id,
    date: "2026-10-05",
    status: "ARRIVED",
    arrivalTime: "08:00",
    departureTime: null,
    corrected: false,
    updatedBy: "synthetic-staff",
    updatedAt: "2026-10-05T08:00:00.000Z",
    correction: null,
    history: [],
    ...overrides,
  };
}

function sourceDaily(id: string, overrides: Partial<StaffDailyReport> = {}): StaffDailyReport {
  const teacher = memberForActor("00000000-0000-4000-8000-000000000003")!;
  const owner = memberForActor("00000000-0000-4000-8000-000000000004")!;
  return {
    id,
    version: 4,
    kind: "staffDaily",
    tenantId: LOCAL_STUDENT.tenantId,
    campusId: LOCAL_STUDENT.campusId,
    classId: LOCAL_STUDENT.classId,
    date: "2026-10-06",
    values: {
      arrival: "ARRIVED_AS_PLANNED",
      homework: "COMPLETED",
      activity: "PARTICIPATED",
      classroom: "ROUTINE",
      followUp: "NONE",
    },
    sourceRefs: [],
    status: "CONFIRMED",
    createdBy: teacher.actorId,
    reviewedBy: owner.actorId,
    updatedBy: owner.actorId,
    updatedAt: "2026-10-06T17:00:00.000Z",
    ...overrides,
  };
}

test("monthly feedback snapshots only eligible records from the same month and scope", () => {
  const { teacher, repository, service } = feedbackFixture();
  const eligibleCare = sourceCare("growth-eligible");
  const eligibleAttendance = sourceAttendance("attendance-eligible");
  const eligibleDaily = sourceDaily("daily-eligible");
  repository.insert(eligibleCare);
  repository.insert(eligibleAttendance);
  repository.insert(eligibleDaily);
  repository.insert(sourceCare("growth-unpublished", { published: false }));
  repository.insert(sourceCare("growth-wrong-month", { date: "2026-09-30" }));
  repository.insert(sourceCare("growth-wrong-campus", { campusId: "synthetic-other-campus" }));
  repository.insert(sourceAttendance("attendance-incomplete", { status: "NOT_ARRIVED" }));
  repository.insert(
    sourceAttendance("attendance-correction-pending", {
      correction: {
        id: "correction-pending",
        status: "PENDING",
        reason: "TIME_ENTRY_ERROR",
        proposed: { status: "ARRIVED", arrivalTime: "08:20", departureTime: null },
        original: { status: "ARRIVED", arrivalTime: "08:00", departureTime: null },
        requestedBy: "synthetic-staff",
        requestedAt: "2026-10-05T08:30:00.000Z",
        reviewedBy: null,
        reviewedAt: null,
      },
    }),
  );
  repository.insert(sourceDaily("daily-not-confirmed", { status: "SUBMITTED" }));

  const view = service.create(teacher, { month: "2026-10", supplements }) as Record<
    string,
    unknown
  >;
  const stored = repository.get(String(view.id)) as { sources: unknown[] };
  assert.deepEqual(stored.sources, [
    {
      kind: "GROWTH_RECORD",
      id: eligibleCare.id,
      version: eligibleCare.version,
      date: eligibleCare.date,
    },
    {
      kind: "ATTENDANCE_OVERVIEW",
      id: eligibleAttendance.id,
      version: eligibleAttendance.version,
      date: eligibleAttendance.date,
    },
    {
      kind: "STAFF_DAILY",
      id: eligibleDaily.id,
      version: eligibleDaily.version,
      date: eligibleDaily.date,
    },
  ]);
  assert.equal("sources" in view, false, "staff screens receive counts and dates, not source IDs");
  assert.deepEqual(view.sourceSummary, [
    { kind: "GROWTH_RECORD", label: "已发布成长记录", count: 1, dates: ["2026-10-04"] },
    { kind: "ATTENDANCE_OVERVIEW", label: "已确认考勤概览", count: 1, dates: ["2026-10-05"] },
    { kind: "STAFF_DAILY", label: "已确认工作日报", count: 1, dates: ["2026-10-06"] },
  ]);
});

test("monthly source refresh is inert without changes and invalidates only after a real source change", () => {
  const { teacher, owner, parent, repository, service } = feedbackFixture();
  const initialSource = sourceCare("growth-current");
  repository.insert(initialSource);
  let row = service.create(teacher, { month: "2026-10", supplements }) as FeedbackRow;
  const noChange = service.sourceRefresh(owner, row.id, { version: row.version }) as FeedbackRow;
  assert.equal(noChange.version, row.version);
  assert.equal(noChange.sourceVersion, row.sourceVersion);
  assert.equal(noChange.status, "DRAFT");

  row = service.submit(teacher, row.id, { version: noChange.version }) as FeedbackRow;
  row = service.review(owner, row.id, { version: row.version, action: "CONFIRM" }) as FeedbackRow;
  row = service.publish(owner, row.id, { version: row.version }) as FeedbackRow;
  const parentBefore = service.parentList(parent)[0] as Record<string, unknown>;
  assert.equal(parentBefore.status, "PUBLISHED");

  const updatedSource = { ...initialSource, version: initialSource.version + 1 };
  assert.equal(repository.replaceBatch([updatedSource]), true);
  const invalidated = service.sourceRefresh(owner, row.id, { version: row.version }) as FeedbackRow;
  assert.equal(invalidated.status, "REVIEW_REQUIRED");
  assert.equal(invalidated.sourceVersion, row.sourceVersion + 1);
  assert.equal(invalidated.version, row.version + 1);
  assert.equal(invalidated.published, false);
  assert.deepEqual(invalidated.parentAcknowledgedBy, []);
  const parentAfter = service.parentList(parent)[0] as Record<string, unknown>;
  assert.equal(parentAfter.status, "REVIEW_REQUIRED");
  assert.deepEqual(parentAfter.items, []);
  assert.equal("sources" in parentAfter, false);
  assert.equal("sourceSummary" in parentAfter, false);
  const refreshedAgain = service.sourceRefresh(owner, invalidated.id, {
    version: invalidated.version,
  }) as FeedbackRow;
  assert.equal(refreshedAgain.version, invalidated.version);
  assert.equal(refreshedAgain.sourceVersion, invalidated.sourceVersion);
});
