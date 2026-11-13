import assert from "node:assert/strict";
import test from "node:test";
import { buildLocalSyntheticServer } from "../src/local-synthetic/server.js";
import { LocalRepository } from "../src/local-synthetic/repository.js";
import { StaffDailyService } from "../src/local-synthetic/staff-daily.service.js";
import type {
  Attendance,
  Care,
  PickupException,
  PickupRecord,
  StaffTask,
} from "../src/local-synthetic/repository.js";
import type { LocalMember } from "../src/local-synthetic/sessions.js";

type App = Awaited<ReturnType<typeof buildLocalSyntheticServer>>;
type Row = Record<string, unknown> & { id: string; version: number; status: string };
type Response = { statusCode: number; body: string; json(): unknown };

const uuid = (value: number) => `00000000-0000-4000-8000-${value.toString(16).padStart(12, "0")}`;

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

async function grantLearningConsent(app: App, parent: string, owner: string, student: string) {
  const application = await call(app, parent, "POST", "/local/binding-applications", {
    student,
    relationship: "GUARDIAN",
  });
  assert.equal(application.statusCode, 201, application.body);
  const binding = application.json() as Row;
  const review = await call(
    app,
    owner,
    "POST",
    `/local/binding-applications/${binding.id}/review`,
    {
      version: binding.version,
      action: "approve",
    },
  );
  assert.equal(review.statusCode, 200, review.body);
  const consent = await call(app, parent, "POST", "/local/consents", {
    bindingId: binding.id,
    purposeKey: "LEARNING_SUPPORT",
    noticeVersion: "LEARNING_SUPPORT_NOTICE_V1",
    confirmed: true,
  });
  assert.equal(consent.statusCode, 201, consent.body);
}

async function completedLearningSession(
  app: App,
  teacher: string,
  studentId: string,
  options: { useGuidance: boolean; needsFollowUp: boolean },
) {
  const created = await call(app, teacher, "POST", "/local/learning-sessions", {
    studentId,
    questionId: "math-grade-3-addition-01",
    consentVersion: "LEARNING_DEMO_V2",
    durationMinutes: 10,
  });
  assert.equal(created.statusCode, 201, created.body);
  const id = (created.json() as { id: string }).id;
  if (options.useGuidance) {
    assert.equal(
      (
        await call(app, teacher, "POST", `/local/learning-sessions/${id}/answer`, {
          itemId: "main",
          choice: "C",
        })
      ).statusCode,
      200,
    );
    assert.equal(
      (await call(app, teacher, "POST", `/local/learning-sessions/${id}/hint`, { level: 0 }))
        .statusCode,
      200,
    );
  }
  assert.equal(
    (
      await call(app, teacher, "POST", `/local/learning-sessions/${id}/answer`, {
        itemId: "main",
        choice: "B",
      })
    ).statusCode,
    200,
  );
  assert.equal(
    (
      await call(app, teacher, "POST", `/local/learning-sessions/${id}/answer`, {
        itemId: "practice-1",
        choice: options.needsFollowUp ? "C" : "A",
      })
    ).statusCode,
    200,
  );
  const completed = await call(app, teacher, "POST", `/local/learning-sessions/${id}/answer`, {
    itemId: "practice-2",
    choice: "B",
  });
  assert.equal(completed.statusCode, 200, completed.body);
  assert.equal((completed.json() as { status: string }).status, "COMPLETED");
  return id;
}

const values = {
  arrival: "ARRIVED_AS_PLANNED",
  homework: "COMPLETED",
  activity: "PARTICIPATED",
  classroom: "ROUTINE",
  followUp: "NONE",
};

test("staff daily report supports fixed-option submit, return, resubmit and confirm", async () => {
  const app = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  try {
    const teacher = await session(app, "teacher-east");
    const owner = await session(app, "owner-east");
    const ownerWest = await session(app, "owner-west");

    assert.deepEqual((await call(app, teacher, "GET", "/local/staff-daily-reports")).json(), []);
    assert.equal(
      (
        await call(app, teacher, "POST", "/local/staff-daily-reports", {
          date: "2026-10-04",
          values: { ...values, note: "free text must be rejected" },
        })
      ).statusCode,
      400,
    );
    assert.equal(
      (
        await call(app, teacher, "POST", "/local/staff-daily-reports", {
          date: "2026-10-04",
          values: { ...values, classroom: "free text" },
        })
      ).statusCode,
      400,
    );

    const created = await call(app, teacher, "POST", "/local/staff-daily-reports", {
      date: "2026-10-04",
      values,
    });
    assert.equal(created.statusCode, 201, created.body);
    const draft = created.json() as Row;
    assert.equal(draft.status, "DRAFT");
    assert.equal(draft.version, 1);
    assert.equal(
      (await call(app, teacher, "GET", `/local/staff-daily-reports/${draft.id}`)).statusCode,
      200,
    );
    assert.equal(
      (
        await call(app, teacher, "POST", `/local/staff-daily-reports/${draft.id}/submit`, {
          version: 1,
        })
      ).statusCode,
      200,
    );
    assert.equal(
      ((await call(app, owner, "GET", "/local/staff-daily-review")).json() as Row[])[0]?.id,
      draft.id,
    );
    assert.deepEqual((await call(app, ownerWest, "GET", "/local/staff-daily-review")).json(), []);

    const returned = await call(
      app,
      owner,
      "POST",
      `/local/staff-daily-reports/${draft.id}/review`,
      {
        version: 2,
        action: "RETURN",
      },
    );
    assert.equal(returned.statusCode, 200, returned.body);
    assert.equal((returned.json() as Row).status, "RETURNED");
    const resubmitted = await call(
      app,
      teacher,
      "POST",
      `/local/staff-daily-reports/${draft.id}/resubmit`,
      { version: 3, values: { ...values, homework: "NEEDS_SUPPORT" } },
    );
    assert.equal(resubmitted.statusCode, 200, resubmitted.body);
    assert.equal((resubmitted.json() as Row).status, "SUBMITTED");
    assert.equal(
      (
        await call(app, owner, "POST", `/local/staff-daily-reports/${draft.id}/review`, {
          version: 4,
          action: "CONFIRM",
        })
      ).statusCode,
      200,
    );
    assert.equal(
      ((await call(app, owner, "GET", `/local/staff-daily-reports/${draft.id}`)).json() as Row)
        .status,
      "CONFIRMED",
    );
  } finally {
    await app.close();
  }
});

test("staff daily report enforces author, scope, role, and version boundaries", async () => {
  const app = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  try {
    const teacher = await session(app, "teacher-east");
    const peer = await session(app, "teacher-east-peer");
    const owner = await session(app, "owner-east");
    const ownerWest = await session(app, "owner-west");
    const parent = await session(app, "parent-alpha");
    const platform = await session(app, "platform-admin");
    const created = (
      await call(app, teacher, "POST", "/local/staff-daily-reports", {
        date: "2026-10-05",
        values,
      })
    ).json() as Row;

    assert.equal(
      (
        await call(app, teacher, "POST", `/local/staff-daily-reports/${created.id}/submit`, {
          version: 99,
        })
      ).statusCode,
      409,
    );
    assert.equal(
      (await call(app, peer, "GET", `/local/staff-daily-reports/${created.id}`)).statusCode,
      403,
    );
    assert.equal(
      (
        await call(app, teacher, "POST", `/local/staff-daily-reports/${created.id}/review`, {
          version: 1,
          action: "CONFIRM",
        })
      ).statusCode,
      403,
    );
    assert.equal(
      (await call(app, ownerWest, "GET", `/local/staff-daily-reports/${created.id}`)).statusCode,
      403,
    );
    assert.equal((await call(app, parent, "GET", "/local/staff-daily-reports")).statusCode, 403);
    assert.equal((await call(app, platform, "GET", "/local/staff-daily-review")).statusCode, 403);
    assert.equal(
      (
        await call(app, teacher, "POST", "/local/staff-daily-reports", {
          date: "2026-10-05",
          tenantId: "forged",
          values,
        })
      ).statusCode,
      400,
    );

    const submitted = await call(
      app,
      teacher,
      "POST",
      `/local/staff-daily-reports/${created.id}/submit`,
      { version: 1 },
    );
    assert.equal(submitted.statusCode, 200, submitted.body);
    const confirmed = await call(
      app,
      owner,
      "POST",
      `/local/staff-daily-reports/${created.id}/review`,
      {
        version: 2,
        action: "CONFIRM",
      },
    );
    assert.equal(confirmed.statusCode, 200, confirmed.body);
    const reopened = await call(
      app,
      owner,
      "POST",
      `/local/staff-daily-reports/${created.id}/review`,
      {
        version: 3,
        action: "RETURN",
      },
    );
    assert.equal(reopened.statusCode, 200, reopened.body);
    assert.equal((reopened.json() as Row).status, "RETURNED");
    assert.equal(
      (
        await call(app, teacher, "POST", `/local/staff-daily-reports/${created.id}/resubmit`, {
          version: 3,
          values,
        })
      ).statusCode,
      409,
    );
  } finally {
    await app.close();
  }
});

test("staff daily report projects a live privacy-limited learning summary for its Shanghai date", async () => {
  const now = Date.now() + 60_000;
  const reportDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(now));
  const followingDate = new Date(Date.parse(`${reportDate}T00:00:00.000Z`) + 86_400_000)
    .toISOString()
    .slice(0, 10);
  const app = await buildLocalSyntheticServer({
    mode: "local-synthetic",
    now: () => now,
  });
  try {
    const teacher = await session(app, "teacher-east");
    const owner = await session(app, "owner-east");
    const parent = await session(app, "parent-alpha");
    const platform = await session(app, "platform-admin");
    const institutionSetting = await call(
      app,
      owner,
      "PATCH",
      "/local/learning-institution-setting",
      { enabled: true, expectedVersion: 0 },
    );
    assert.equal(institutionSetting.statusCode, 200, institutionSetting.body);
    await grantLearningConsent(app, parent, owner, "student-alpha");
    const firstLearningId = await completedLearningSession(app, teacher, uuid(200), {
      useGuidance: true,
      needsFollowUp: false,
    });
    const secondParent = await session(app, "parent-beta");
    await grantLearningConsent(app, secondParent, owner, "student-beta");
    await completedLearningSession(app, teacher, uuid(201), {
      useGuidance: false,
      needsFollowUp: true,
    });

    const sameDay = await call(app, teacher, "POST", "/local/staff-daily-reports", {
      date: reportDate,
      values,
    });
    assert.equal(sameDay.statusCode, 201, sameDay.body);
    const report = sameDay.json() as Row & { learningSummary: unknown };
    assert.deepEqual(report.learningSummary, {
      completedLearnerBand: "2_PLUS",
      usedGuidance: true,
      needsTeacherFollowUp: true,
    });
    assert.doesNotMatch(sameDay.body, /studentId|studentLabel|sessionId|prompt|answer|hintText/u);

    const otherDay = await call(app, teacher, "POST", "/local/staff-daily-reports", {
      date: followingDate,
      values,
    });
    assert.equal(otherDay.statusCode, 201, otherDay.body);
    assert.equal((otherDay.json() as { learningSummary: unknown }).learningSummary, null);
    assert.equal((await call(app, parent, "GET", "/local/staff-daily-reports")).statusCode, 403);
    assert.equal((await call(app, platform, "GET", "/local/staff-daily-reports")).statusCode, 403);

    const deleted = await call(
      app,
      teacher,
      "POST",
      `/local/learning-sessions/${firstLearningId}/delete`,
      {},
    );
    assert.equal(deleted.statusCode, 200, deleted.body);
    const refreshed = await call(app, teacher, "GET", `/local/staff-daily-reports/${report.id}`);
    assert.equal(refreshed.statusCode, 200, refreshed.body);
    assert.equal((refreshed.json() as { learningSummary: unknown }).learningSummary, null);
  } finally {
    await app.close();
  }
});

test("staff daily draft snapshots only same-date scoped source IDs and versions", () => {
  const repository = new LocalRepository();
  const member: LocalMember = {
    actorId: "teacher-east",
    profile: "teacher-east",
    label: "示例教师",
    tenantId: "00000000-0000-4000-8000-000000000100",
    campusId: "00000000-0000-4000-8000-000000000101",
    classIds: ["00000000-0000-4000-8000-000000000103"],
    actions: ["daily:create", "daily:submit"],
  };
  const base = {
    tenantId: member.tenantId,
    campusId: member.campusId,
    classId: member.classIds[0]!,
  };
  const actorId = member.actorId;
  const task: StaffTask = {
    ...base,
    id: "00000000-0000-4000-8000-000000000301",
    version: 4,
    kind: "staffTask",
    code: "DAILY_CHECK",
    targetType: "CLASS",
    targetId: base.classId,
    dueDate: "2026-10-07",
    priority: "NORMAL",
    status: "CHECKED",
    createdBy: actorId,
    assigneeId: actorId,
    claimedBy: actorId,
    completedBy: actorId,
    result: "COMPLETED_AS_PLANNED",
    checkerId: "owner-east",
    updatedBy: "owner-east",
    updatedAt: "2026-10-07T09:00:00.000Z",
  };
  const attendance: Attendance = {
    ...base,
    id: "00000000-0000-4000-8000-000000000302",
    version: 2,
    kind: "attendance",
    studentId: "must-not-be-copied",
    date: "2026-10-07",
    status: "ARRIVED",
    arrivalTime: "08:30",
    departureTime: null,
    corrected: false,
    updatedBy: actorId,
    updatedAt: "2026-10-07T00:30:00.000Z",
    correction: null,
    history: [],
  };
  const pickup: PickupRecord = {
    ...base,
    id: "00000000-0000-4000-8000-000000000303",
    version: 3,
    kind: "pickup",
    authorizationId: "00000000-0000-4000-8000-000000000401",
    authorizationVersion: 1,
    bindingId: "00000000-0000-4000-8000-000000000402",
    studentId: "must-not-be-copied",
    date: "2026-10-07",
    time: "17:00",
    recipient: "pickup-alpha",
    teacherId: actorId,
    deviceLabel: "合成设备",
    attendanceId: attendance.id,
    attendanceVersion: attendance.version,
    checks: { student: true, recipient: true, authorization: true },
    createdAt: "2026-10-07T09:00:00.000Z",
  };
  const exception: PickupException = {
    ...base,
    id: "00000000-0000-4000-8000-000000000304",
    version: 1,
    kind: "pickupException",
    studentId: "must-not-be-copied",
    date: "2026-10-07",
    category: "NO_AUTHORIZATION",
    status: "OPEN",
    createdBy: actorId,
    createdAt: "2026-10-07T10:00:00.000Z",
    reviewedBy: null,
    reviewedAt: null,
    outcome: null,
  };
  const care: Care = {
    ...base,
    id: "00000000-0000-4000-8000-000000000308",
    version: 4,
    kind: "care",
    studentId: "must-not-be-copied",
    date: "2026-10-07",
    values: {
      arrival: "ARRIVED_AS_PLANNED",
      homework: "COMPLETED",
      meal: "FINISHED",
      rest: "RESTED",
      activity: "PARTICIPATED",
      wellbeing: "FOLLOW_UP",
    },
    status: "CONFIRMED",
    createdBy: actorId,
    reviewedBy: "owner-east",
    updatedBy: "owner-east",
    updatedAt: "2026-10-07T11:00:00.000Z",
    published: true,
    publicationVersion: 1,
    history: [],
  };
  repository.insert(task);
  repository.insert(attendance);
  repository.insert(pickup);
  repository.insert(exception);

  repository.insert(care);
  repository.insert({
    ...care,
    id: "00000000-0000-4000-8000-000000000313",
    tenantId: "00000000-0000-4000-8000-000000000198",
  });
  repository.insert({
    ...care,
    id: "00000000-0000-4000-8000-000000000314",
    classId: "00000000-0000-4000-8000-000000000197",
  });
  repository.insert({
    ...care,
    id: "00000000-0000-4000-8000-000000000312",
    status: "SUBMITTED",
    published: true,
  });
  repository.insert({
    ...care,
    id: "00000000-0000-4000-8000-000000000309",
    studentId: "student-not-published",
    status: "CONFIRMED",
    published: false,
  });
  repository.insert({
    ...care,
    id: "00000000-0000-4000-8000-000000000310",
    studentId: "student-other-date",
    date: "2026-10-06",
  });
  repository.insert({
    ...care,
    id: "00000000-0000-4000-8000-000000000311",
    studentId: "student-other-campus",
    campusId: "00000000-0000-4000-8000-000000000199",
  });
  repository.insert({
    ...task,
    id: "00000000-0000-4000-8000-000000000305",
    dueDate: "2026-10-06",
  });
  repository.insert({
    ...attendance,
    id: "00000000-0000-4000-8000-000000000306",
    campusId: "00000000-0000-4000-8000-000000000199",
  });
  repository.insert({
    ...exception,
    id: "00000000-0000-4000-8000-000000000307",
    classId: "00000000-0000-4000-8000-000000000199",
  });

  const reviewer: LocalMember = {
    ...member,
    actorId: "owner-east",
    profile: "owner-east",
    actions: ["daily:review"],
  };
  const service = new StaffDailyService(repository, () => Date.parse("2026-10-07T12:00:00Z"));
  const report = service.create(member, { date: "2026-10-07", values });
  const sourceRefs = (report as typeof report & { sourceRefs?: unknown }).sourceRefs;

  assert.deepEqual(sourceRefs, [
    { kind: "TASK", id: task.id, version: task.version },
    { kind: "ATTENDANCE", id: attendance.id, version: attendance.version },

    { kind: "CARE_RECORD", id: care.id, version: care.version },
    { kind: "PICKUP", id: pickup.id, version: pickup.version },
    { kind: "PICKUP_EXCEPTION", id: exception.id, version: exception.version },
  ]);
  assert.ok(Array.isArray(sourceRefs));
  for (const source of sourceRefs) {
    assert.deepEqual(Object.keys(source as object).sort(), ["id", "kind", "version"]);
  }
  assert.doesNotMatch(JSON.stringify(report), /must-not-be-copied/u);

  const changedTask = { ...task, version: task.version + 1 };

  const changedCare = { ...care, version: care.version + 1 };
  assert.equal(repository.replaceBatch([changedTask, changedCare]), true);
  const edited = service.edit(member, report.id, { version: report.version, values });
  assert.equal(
    (
      edited as typeof edited & { sourceRefs: Array<{ kind: string; version: number }> }
    ).sourceRefs.find((source) => source.kind === "TASK")?.version,
    changedTask.version,
  );
  assert.equal(
    (
      edited as typeof edited & { sourceRefs: Array<{ kind: string; version: number }> }
    ).sourceRefs.find((source) => source.kind === "CARE_RECORD")?.version,
    changedCare.version,
  );
  assert.equal(service.submit(member, report.id, { version: edited.version }).status, "SUBMITTED");
  const returned = service.review(reviewer, report.id, {
    version: edited.version + 1,
    action: "RETURN",
  });
  const changedException = { ...exception, version: exception.version + 1 };

  const changedCareAgain = { ...changedCare, version: changedCare.version + 1 };
  assert.equal(repository.replaceBatch([changedException, changedCareAgain]), true);
  const resubmitted = service.resubmit(member, report.id, {
    version: returned.version,
    values,
  });
  assert.equal(resubmitted.status, "SUBMITTED");
  assert.equal(
    (
      resubmitted as typeof resubmitted & { sourceRefs: Array<{ kind: string; version: number }> }
    ).sourceRefs.find((source) => source.kind === "PICKUP_EXCEPTION")?.version,
    changedException.version,
  );
  assert.equal(
    (
      resubmitted as typeof resubmitted & { sourceRefs: Array<{ kind: string; version: number }> }
    ).sourceRefs.find((source) => source.kind === "CARE_RECORD")?.version,
    changedCareAgain.version,
  );
});
