import assert from "node:assert/strict";
import test from "node:test";
import { LearningSessionService } from "../src/local-synthetic/learning-session.service.js";
import { LocalError } from "../src/local-synthetic/binding-leave.service.js";
import { LocalRepository, type ResourceLibraryRecord } from "../src/local-synthetic/repository.js";
import { memberForActor, studentForId } from "../src/local-synthetic/sessions.js";
import { buildLocalSyntheticServer } from "../src/local-synthetic/server.js";

const uuid = (value: number) => `00000000-0000-4000-8000-${value.toString(16).padStart(12, "0")}`;
const parent = memberForActor(uuid(1))!;
const teacher = memberForActor(uuid(3))!;
const owner = memberForActor(uuid(4))!;
const otherClassTeacher = memberForActor(uuid(7))!;
const platform = memberForActor(uuid(10))!;
const student = studentForId(uuid(200))!;

function learningService(repository: LocalRepository, now: () => number) {
  const service = new LearningSessionService(
    repository,
    {
      activeLearningConsent: () => ({
        id: uuid(901),
        consentVersion: "LEARNING_DEMO_V2",
        policyVersion: "AI_LEARNING_POLICY_SYNTHETIC_V1",
        authorizedAt: new Date(now()).toISOString(),
      }),
    },
    now,
  );
  service.updateInstitutionSetting(owner, { enabled: true, expectedVersion: 0 });
  return service;
}

function setup() {
  let now = Date.now();
  const repository = new LocalRepository();
  const service = learningService(repository, () => now);
  return {
    repository,
    service,
    advance(milliseconds: number) {
      now += milliseconds;
    },
    approveParentBinding() {
      repository.insert({
        id: uuid(900),
        version: 1,
        kind: "binding",
        tenantId: student.tenantId,
        campusId: student.campusId,
        classId: student.classId,
        guardianId: parent.actorId,
        studentId: student.id,
        relationship: "GUARDIAN",
        status: "APPROVED",
      });
    },
  };
}

const createBody = {
  studentId: student.id,
  questionId: "math-grade-3-addition-01",
  consentVersion: "LEARNING_DEMO_V2",
  durationMinutes: 10,
};

test("parent learning requires approved binding and strict synthetic consent", () => {
  const { repository, service, approveParentBinding } = setup();
  assert.throws(
    () => service.create(parent, createBody),
    (error) => error instanceof LocalError && error.statusCode === 403,
  );
  approveParentBinding();
  const session = service.create(parent, createBody);
  assert.equal(session.status, "ACTIVE");
  assert.equal(session.durationMinutes, 10);
  assert.equal(session.consentVersion, "LEARNING_DEMO_V2");
  assert.match(session.consentedAt, /^\d{4}-\d\d-\d\dT/u);
  assert.equal(session.guidanceMode, "FIXED_LOCAL");
  assert.equal("answer" in session.question, false);
  assert.throws(() => service.create(parent, { ...createBody, freeText: "真实资料" }));
  assert.throws(() => service.create(parent, { ...createBody, durationMinutes: "10" }));
  assert.throws(() => service.create(parent, { ...createBody, consentVersion: "" }));
  assert.equal(repository.audits().filter((row) => row.action === "learning.enable").length, 1);
});

test("attempts, hints and consolidation follow the supervised order and close blocks further work", () => {
  const { service, approveParentBinding } = setup();
  approveParentBinding();
  const session = service.create(parent, createBody);
  assert.throws(() => service.hint(parent, session.id, { level: 0 }));
  assert.throws(() => service.answer(parent, session.id, { itemId: "practice-1", choice: "A" }));
  let lastGuidance = session;
  for (let level = 0; level <= 3; level += 1) {
    const wrongChoice: "A" | "C" = level % 2 === 0 ? "C" : "A";
    service.answer(parent, session.id, { itemId: "main", choice: wrongChoice });
    lastGuidance = service.hint(parent, session.id, { level });
    assert.equal(lastGuidance.highestHintLevel, level);
    if (level < 3) assert.throws(() => service.hint(parent, session.id, { level: level + 1 }));
  }
  const finalHint = lastGuidance.visibleHint?.text ?? "";
  assert.match(finalHint, /自行/u);
  assert.doesNotMatch(finalHint, /403/u);
  service.answer(parent, session.id, { itemId: "main", choice: "B" });
  service.answer(parent, session.id, { itemId: "practice-1", choice: "A" });
  const completed = service.answer(parent, session.id, { itemId: "practice-2", choice: "B" });
  assert.equal(completed.status, "COMPLETED");
  assert.equal(completed.consolidation.length, 2);
  service.close(parent, session.id, {});
  assert.throws(() => service.answer(parent, session.id, { itemId: "main", choice: "B" }));
  assert.deepEqual(service.delete(parent, session.id, {}), { deleted: true });
  assert.deepEqual(service.list(parent), []);
});

test("ending completed learning preserves completion, time and scope on repeated requests", () => {
  const { repository, service, approveParentBinding, advance } = setup();
  approveParentBinding();
  const session = service.create(parent, createBody);
  advance(2 * 60_000);
  service.answer(parent, session.id, { itemId: "main", choice: "B" });
  service.answer(parent, session.id, { itemId: "practice-1", choice: "A" });
  const completed = service.answer(parent, session.id, { itemId: "practice-2", choice: "B" });
  const summary = service.parentSummary(parent);
  const metrics = service.safetySummary(platform);
  const teacherSummary = service.teacherSummary(teacher);
  assert.equal(summary.students[0]?.completedSessions, 1);
  assert.equal(summary.students[0]?.usedMinutes, 2);
  const audits = repository.audits().length;

  advance(4 * 60_000);
  const ended = service.close(parent, session.id, {});
  assert.deepEqual(service.parentSummary(parent), summary);
  assert.deepEqual(ended, completed);
  advance(15 * 60_000);
  assert.deepEqual(service.close(parent, session.id, {}), completed);
  assert.deepEqual(service.parentSummary(parent), summary);
  assert.deepEqual(service.safetySummary(platform), metrics);
  assert.deepEqual(service.teacherSummary(teacher), teacherSummary);
  assert.equal(repository.audits().length, audits, "no repeated state transition is audited");
  assert.throws(() => service.answer(parent, session.id, { itemId: "main", choice: "B" }));
  assert.throws(() => service.hint(parent, session.id, { level: 0 }));
  assert.throws(() => service.close(teacher, session.id, { handoff: true }));
  for (const actor of [teacher, otherClassTeacher, platform, memberForActor(uuid(2))!])
    assert.throws(
      () => service.close(actor, session.id, {}),
      (error) => error instanceof LocalError && error.statusCode === 403,
    );
  assert.throws(() => service.close(parent, session.id, { handoff: false }));
  const binding = repository.get(uuid(900));
  assert.ok(binding && binding.kind === "binding");
  assert.equal(
    repository.replaceBatch([{ ...binding, status: "RELEASED", version: binding.version + 1 }]),
    true,
  );
  assert.throws(
    () => service.close(parent, session.id, {}),
    (error) => error instanceof LocalError && error.statusCode === 403,
  );
});

test("ending completed learning retains the daily aggregate until the record is deleted", () => {
  let now = Date.parse("2026-10-10T16:30:00.000Z");
  const service = learningService(new LocalRepository(), () => now);
  const records = [uuid(200), uuid(201)].map((studentId) => {
    const session = service.create(teacher, { ...createBody, studentId });
    service.answer(teacher, session.id, { itemId: "main", choice: "B" });
    service.answer(teacher, session.id, { itemId: "practice-1", choice: "A" });
    return service.answer(teacher, session.id, { itemId: "practice-2", choice: "B" });
  });
  const read = () =>
    service.dailySummary("2026-10-11", teacher.tenantId, teacher.campusId, teacher.classIds[0]!);
  const summary = read();
  assert.equal(summary?.completedLearnerBand, "2_PLUS");
  now += 20 * 60_000;
  for (const record of records) service.close(teacher, record.id, {});
  assert.deepEqual(read(), summary);
  service.delete(teacher, records[1]!.id, {});
  assert.equal(read(), null);
});

test("learning records can be deleted only after ending and within teacher class scope", () => {
  const { service, approveParentBinding } = setup();
  approveParentBinding();
  const parentSession = service.create(parent, createBody);

  assert.throws(
    () => service.delete(parent, parentSession.id, {}),
    (error) => error instanceof LocalError && error.statusCode === 409,
  );
  assert.throws(
    () => service.delete(teacher, parentSession.id, {}),
    (error) => error instanceof LocalError && error.statusCode === 409,
  );
  const unhandedSession = service.create(parent, createBody);
  service.close(parent, unhandedSession.id, {});
  assert.throws(
    () => service.delete(teacher, unhandedSession.id, {}),
    (error) => error instanceof LocalError && error.statusCode === 403,
  );
  service.close(teacher, parentSession.id, { handoff: true });
  assert.throws(
    () => service.delete(otherClassTeacher, parentSession.id, {}),
    (error) => error instanceof LocalError && error.statusCode === 403,
  );
  assert.deepEqual(service.delete(teacher, parentSession.id, {}), { deleted: true });

  const teacherSession = service.create(teacher, createBody);
  assert.throws(
    () => service.delete(teacher, teacherSession.id, {}),
    (error) => error instanceof LocalError && error.statusCode === 409,
  );
  service.answer(teacher, teacherSession.id, { itemId: "main", choice: "B" });
  service.answer(teacher, teacherSession.id, { itemId: "practice-1", choice: "A" });
  service.answer(teacher, teacherSession.id, { itemId: "practice-2", choice: "B" });
  assert.deepEqual(service.delete(teacher, teacherSession.id, {}), { deleted: true });
});

test("teacher summary stays in the teacher class and platform summary is anonymous", () => {
  const { service, repository, approveParentBinding } = setup();
  approveParentBinding();
  const parentSession = service.create(parent, createBody);
  service.denied(parent, "learning.enable", "");
  const handedOff = service.close(teacher, parentSession.id, { handoff: true });
  assert.equal(handedOff.status, "HANDED_OFF");
  assert.throws(() => service.answer(parent, handedOff.id, { itemId: "main", choice: "B" }));
  assert.throws(() => service.close(otherClassTeacher, parentSession.id, { handoff: true }));
  assert.equal(service.teacherSummary(teacher).sessions[0]?.status, "HANDED_OFF");

  const session = service.create(teacher, {
    ...createBody,
    durationMinutes: 5,
  });
  assert.equal(service.teacherSummary(teacher).sessions.length, 2);
  assert.deepEqual(service.teacherSummary(otherClassTeacher).sessions, []);
  service.answer(teacher, session.id, { itemId: "main", choice: "B" });
  assert.equal(service.teacherSummary(teacher).sessions[0]?.studentLabel, student.label);
  const summary = service.safetySummary(platform);
  assert.equal(Reflect.get(summary, "metricVersion"), "LEARNING_SAFETY_V2");
  assert.equal(summary.totalSessions, 2);
  assert.equal(summary.refusedActions, 1);
  assert.equal(summary.teacherHandoffs, 1);
  assert.equal(summary.fixedGuidanceSessions, 2);
  assert.equal(
    repository.audits().some((row) => JSON.stringify(row).includes("真实资料")),
    false,
  );
  assert.doesNotMatch(
    JSON.stringify(summary),
    /studentLabel|studentId|sessionId|tenantId|campusId|classId|actorId/iu,
  );
  assert.throws(
    () => service.safetySummary(teacher),
    (error) => error instanceof LocalError && error.statusCode === 403,
  );
});

test("expired practice cannot accept answers or hints", () => {
  const { service, approveParentBinding, advance } = setup();
  approveParentBinding();
  const session = service.create(parent, { ...createBody, durationMinutes: 5 });
  advance(5 * 60_000 + 1);
  assert.equal(service.get(parent, session.id).status, "EXPIRED");
  assert.throws(() => service.answer(parent, session.id, { itemId: "main", choice: "B" }));
  assert.throws(() => service.hint(parent, session.id, { level: 0 }));
});

test("parent learning controls are relation-scoped and enforced for starting and hints", () => {
  const { service, approveParentBinding } = setup();
  approveParentBinding();
  const readControls = Reflect.get(service, "parentControls") as
    ((member: typeof parent) => { students: readonly Record<string, unknown>[] }) | undefined;
  assert.equal(typeof readControls, "function", "the parent controls service is missing");
  if (!readControls) return;

  assert.deepEqual(readControls.call(service, parent).students[0], {
    studentId: student.id,
    studentLabel: student.label,
    enabled: true,
    maxDurationMinutes: 15,
    maxHintLevel: 3,
    contactStatus: "NOT_REQUESTED",
  });

  const saveControls = Reflect.get(service, "updateParentControls") as
    | ((member: typeof parent, studentId: string, value: unknown) => Record<string, unknown>)
    | undefined;
  assert.equal(typeof saveControls, "function", "saving parent controls is missing");
  if (!saveControls) return;
  assert.equal(
    saveControls.call(service, parent, student.id, {
      enabled: false,
      maxDurationMinutes: 5,
      maxHintLevel: 0,
    }).enabled,
    false,
  );
  assert.throws(
    () => service.create(parent, { ...createBody, durationMinutes: 5 }),
    (error) => error instanceof LocalError && error.statusCode === 403,
    "turning learning off must block new sessions",
  );

  saveControls.call(service, parent, student.id, {
    enabled: true,
    maxDurationMinutes: 5,
    maxHintLevel: 0,
  });
  assert.throws(
    () => service.create(parent, createBody),
    (error) => error instanceof LocalError && error.statusCode === 403,
    "the service must enforce the selected maximum duration",
  );
  const session = service.create(parent, { ...createBody, durationMinutes: 5 });
  service.answer(parent, session.id, { itemId: "main", choice: "C" });
  service.hint(parent, session.id, { level: 0 });
  service.answer(parent, session.id, { itemId: "main", choice: "C" });
  assert.throws(
    () => service.hint(parent, session.id, { level: 1 }),
    (error) => error instanceof LocalError && error.statusCode === 403,
    "the service must enforce the selected maximum hint level",
  );

  const otherParent = { ...parent, actorId: uuid(12) };
  assert.deepEqual(readControls.call(service, otherParent).students, []);
  assert.throws(
    () =>
      saveControls.call(service, otherParent, student.id, {
        enabled: false,
        maxDurationMinutes: 5,
        maxHintLevel: 0,
      }),
    (error) => error instanceof LocalError && error.statusCode === 403,
  );
});

test("revoking a parent binding immediately removes access to existing learning sessions", () => {
  const { repository, service, approveParentBinding } = setup();
  approveParentBinding();
  const session = service.create(parent, createBody);
  const binding = repository.get(uuid(900));
  assert.ok(binding && binding.kind === "binding");
  assert.equal(
    repository.replaceBatch([{ ...binding, status: "RELEASED", version: binding.version + 1 }]),
    true,
  );

  assert.deepEqual(service.list(parent), []);
  for (const operation of [
    () => service.get(parent, session.id),
    () => service.answer(parent, session.id, { itemId: "main", choice: "B" }),
    () => service.hint(parent, session.id, { level: 0 }),
    () => service.close(parent, session.id, {}),
    () => service.delete(parent, session.id, {}),
  ])
    assert.throws(
      operation,
      (error) => error instanceof LocalError && error.statusCode === 403,
      "a parent without a current approved binding must not read or change an old session",
    );
});

test("parent control changes immediately constrain an active learning session", () => {
  const { repository, service, approveParentBinding, advance } = setup();
  approveParentBinding();
  const session = service.create(parent, { ...createBody, durationMinutes: 15 });
  advance(2 * 60_000);

  service.updateParentControls(parent, student.id, {
    enabled: true,
    maxDurationMinutes: 5,
    maxHintLevel: 3,
  });
  const shortened = service.get(parent, session.id);
  assert.equal(shortened.durationMinutes, 5);
  assert.equal(
    shortened.endsAt,
    new Date(Date.parse(session.startedAt) + 5 * 60_000).toISOString(),
  );

  service.updateParentControls(parent, student.id, {
    enabled: true,
    maxDurationMinutes: 15,
    maxHintLevel: 3,
  });
  const afterRaisingLimit = service.get(parent, session.id);
  assert.equal(
    afterRaisingLimit.durationMinutes,
    shortened.durationMinutes,
    "raising the limit must not restore a session's previous duration",
  );
  assert.equal(
    afterRaisingLimit.endsAt,
    shortened.endsAt,
    "raising the limit must not extend a session that was already shortened",
  );

  service.updateParentControls(parent, student.id, {
    enabled: false,
    maxDurationMinutes: 15,
    maxHintLevel: 3,
  });
  assert.equal(service.get(parent, session.id).status, "CLOSED");
  assert.throws(
    () => service.answer(parent, session.id, { itemId: "main", choice: "B" }),
    (error) => error instanceof LocalError && error.statusCode === 409,
  );
  assert.deepEqual(
    repository
      .audits()
      .filter((entry) =>
        ["learning.parent-controls.duration-limit", "learning.parent-controls.disable"].includes(
          entry.action,
        ),
      )
      .map(({ actorId, objectId, action, outcome }) => ({ actorId, objectId, action, outcome })),
    [
      {
        actorId: parent.actorId,
        objectId: session.id,
        action: "learning.parent-controls.duration-limit",
        outcome: "ACCEPTED",
      },
      {
        actorId: parent.actorId,
        objectId: session.id,
        action: "learning.parent-controls.disable",
        outcome: "ACCEPTED",
      },
    ],
  );
});

test("parent contact intent stays local and appears only in the responsible teacher summary", () => {
  const { service, approveParentBinding } = setup();
  approveParentBinding();
  const contactTeacher = Reflect.get(service, "contactTeacher") as
    | ((member: typeof parent, studentId: string, body: unknown) => Record<string, unknown>)
    | undefined;
  assert.equal(typeof contactTeacher, "function", "the local contact intent service is missing");
  if (!contactTeacher) return;

  const intent = contactTeacher.call(service, parent, student.id, {});
  assert.equal(intent.status, "RECORDED_LOCAL");
  assert.equal(intent.studentLabel, student.label);
  const teacherContacts = service.teacherContactIntents(teacher);
  const otherTeacherContacts = service.teacherContactIntents(otherClassTeacher);
  assert.equal(teacherContacts?.[0]?.studentLabel, student.label);
  assert.deepEqual(otherTeacherContacts, []);
  assert.throws(
    () => contactTeacher.call(service, { ...parent, actorId: uuid(12) }, student.id, {}),
    (error) => error instanceof LocalError && error.statusCode === 403,
  );
});

test("local routes expose parent controls and reject contact intent without an approved relation", async () => {
  const app = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  try {
    const sessionResponse = await app.inject({
      method: "POST",
      url: "/local/sessions",
      payload: { profile: "parent-alpha" },
    });
    assert.equal(sessionResponse.statusCode, 201);
    const handle = (sessionResponse.json() as { handle: string }).handle;
    const headers = { authorization: `Bearer ${handle}` };
    const controls = await app.inject({
      method: "GET",
      url: "/local/learning-parent-controls",
      headers,
    });
    assert.equal(controls.statusCode, 200);
    const controlsBody = controls.json() as {
      students: unknown[];
      parentSummary: unknown[];
      parentSummaryUpdatedAt: string;
    };
    assert.deepEqual(controlsBody.students, []);
    assert.deepEqual(controlsBody.parentSummary, []);
    assert.equal(Number.isNaN(Date.parse(controlsBody.parentSummaryUpdatedAt)), false);

    const teacherSessionResponse = await app.inject({
      method: "POST",
      url: "/local/sessions",
      payload: { profile: "teacher-east" },
    });
    assert.equal(teacherSessionResponse.statusCode, 201);
    const teacherHandle = (teacherSessionResponse.json() as { handle: string }).handle;
    const teacherSummaryAccess = await app.inject({
      method: "GET",
      url: "/local/learning-parent-controls",
      headers: { authorization: `Bearer ${teacherHandle}` },
    });
    assert.equal(teacherSummaryAccess.statusCode, 403);

    const contact = await app.inject({
      method: "POST",
      url: `/local/learning-parent-contact/${student.id}`,
      headers,
      payload: {},
    });
    assert.equal(contact.statusCode, 403);
  } finally {
    await app.close();
  }
});

test("learning requires active guardian consent and stops processing after revocation", async () => {
  const app = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  try {
    const parentResponse = await app.inject({
      method: "POST",
      url: "/local/sessions",
      payload: { profile: "parent-alpha" },
    });
    const ownerResponse = await app.inject({
      method: "POST",
      url: "/local/sessions",
      payload: { profile: "owner-east" },
    });
    const teacherResponse = await app.inject({
      method: "POST",
      url: "/local/sessions",
      payload: { profile: "teacher-east" },
    });
    const parentHandle = (parentResponse.json() as { handle: string }).handle;
    const ownerHandle = (ownerResponse.json() as { handle: string }).handle;
    const teacherHandle = (teacherResponse.json() as { handle: string }).handle;
    const parentHeaders = { authorization: `Bearer ${parentHandle}` };
    const ownerHeaders = { authorization: `Bearer ${ownerHandle}` };
    const teacherHeaders = { authorization: `Bearer ${teacherHandle}` };
    const bindingResponse = await app.inject({
      method: "POST",
      url: "/local/binding-applications",
      headers: parentHeaders,
      payload: { student: "student-alpha", relationship: "GUARDIAN" },
    });
    assert.equal(bindingResponse.statusCode, 201, bindingResponse.body);
    const binding = bindingResponse.json() as { id: string; version: number };
    const reviewResponse = await app.inject({
      method: "POST",
      url: `/local/binding-applications/${binding.id}/review`,
      headers: ownerHeaders,
      payload: { version: binding.version, action: "approve" },
    });
    assert.equal(reviewResponse.statusCode, 200, reviewResponse.body);

    const learningBody = {
      studentId: student.id,
      questionId: "math-grade-3-addition-01",
      consentVersion: "LEARNING_DEMO_V2",
      durationMinutes: 10,
    };
    const withoutConsent = await app.inject({
      method: "POST",
      url: "/local/learning-sessions",
      headers: parentHeaders,
      payload: learningBody,
    });
    assert.equal(withoutConsent.statusCode, 403, withoutConsent.body);
    const teacherWithoutConsent = await app.inject({
      method: "POST",
      url: "/local/learning-sessions",
      headers: teacherHeaders,
      payload: learningBody,
    });
    assert.equal(teacherWithoutConsent.statusCode, 403, teacherWithoutConsent.body);

    const careConsent = await app.inject({
      method: "POST",
      url: "/local/consents",
      headers: parentHeaders,
      payload: {
        bindingId: binding.id,
        purposeKey: "CARE_RECORD",
        noticeVersion: "CARE_RECORD_NOTICE_V1",
        confirmed: true,
      },
    });
    assert.equal(careConsent.statusCode, 201, careConsent.body);
    assert.equal((careConsent.json() as { consentVersion: string | null }).consentVersion, null);
    const careConsentCannotEnableLearning = await app.inject({
      method: "POST",
      url: "/local/learning-sessions",
      headers: parentHeaders,
      payload: learningBody,
    });
    assert.equal(careConsentCannotEnableLearning.statusCode, 403);

    const consentResponse = await app.inject({
      method: "POST",
      url: "/local/consents",
      headers: parentHeaders,
      payload: {
        bindingId: binding.id,
        purposeKey: "LEARNING_SUPPORT",
        noticeVersion: "LEARNING_SUPPORT_NOTICE_V1",
        confirmed: true,
      },
    });
    assert.equal(consentResponse.statusCode, 201, consentResponse.body);
    const consent = consentResponse.json() as {
      id: string;
      version: number;
      consentVersion: string | null;
      policyVersion: string | null;
    };
    assert.equal(consent.consentVersion, "LEARNING_DEMO_V2");
    assert.equal(consent.policyVersion, "AI_LEARNING_POLICY_SYNTHETIC_V1");

    const institutionSetting = await app.inject({
      method: "PATCH",
      url: "/local/learning-institution-setting",
      headers: ownerHeaders,
      payload: { enabled: true, expectedVersion: 0 },
    });
    assert.equal(institutionSetting.statusCode, 200, institutionSetting.body);

    const learningResponse = await app.inject({
      method: "POST",
      url: "/local/learning-sessions",
      headers: parentHeaders,
      payload: learningBody,
    });
    assert.equal(learningResponse.statusCode, 201, learningResponse.body);
    const learning = learningResponse.json() as { id: string };
    const teacherLearningResponse = await app.inject({
      method: "POST",
      url: "/local/learning-sessions",
      headers: teacherHeaders,
      payload: learningBody,
    });
    assert.equal(teacherLearningResponse.statusCode, 201, teacherLearningResponse.body);
    const teacherLearning = teacherLearningResponse.json() as { id: string };
    const revoked = await app.inject({
      method: "POST",
      url: `/local/consents/${consent.id}/revoke`,
      headers: parentHeaders,
      payload: { version: consent.version },
    });
    assert.equal(revoked.statusCode, 200, revoked.body);
    const answer = await app.inject({
      method: "POST",
      url: `/local/learning-sessions/${learning.id}/answer`,
      headers: parentHeaders,
      payload: { itemId: "main", choice: "A" },
    });
    assert.equal(answer.statusCode, 403, answer.body);
    const teacherAnswer = await app.inject({
      method: "POST",
      url: `/local/learning-sessions/${teacherLearning.id}/answer`,
      headers: teacherHeaders,
      payload: { itemId: "main", choice: "A" },
    });
    assert.equal(teacherAnswer.statusCode, 403, teacherAnswer.body);
    const hint = await app.inject({
      method: "POST",
      url: `/local/learning-sessions/${learning.id}/hint`,
      headers: parentHeaders,
      payload: { level: 0 },
    });
    assert.equal(hint.statusCode, 403, hint.body);
    const close = await app.inject({
      method: "POST",
      url: `/local/learning-sessions/${learning.id}/close`,
      headers: parentHeaders,
      payload: {},
    });
    assert.equal(close.statusCode, 200, close.body);
    const teacherClose = await app.inject({
      method: "POST",
      url: `/local/learning-sessions/${teacherLearning.id}/close`,
      headers: teacherHeaders,
      payload: {},
    });
    assert.equal(teacherClose.statusCode, 200, teacherClose.body);
  } finally {
    await app.close();
  }
});

test("learning resources require an approved parent binding and stay within trusted role scope", () => {
  const { repository, service, approveParentBinding } = setup();
  const resource = (id: number, overrides: Partial<ResourceLibraryRecord> = {}) =>
    ({
      id: uuid(id),
      version: 3,
      kind: "resourceLibrary",
      tenantId: student.tenantId,
      campusId: student.campusId,
      classId: student.classId,
      scope: "CLASS",
      audienceRoles: ["PARENT", "TEACHER"],
      category: "LESSON",
      title: "两位数加法分步学习卡",
      summary: "按步骤理解进位过程。",
      content: "先拆分数位，再依次相加；完成后请与老师或家长核对。",
      grade: "三年级",
      subject: "数学",
      tags: ["两位数加法与进位"],
      sourceLabel: "合成教研组",
      ownerId: uuid(4),
      ownerRole: "机构负责人",
      ownerLabel: "示例校区负责人",
      learningSourceGovernance: {
        collection: "SYNTHETIC_CAMPUS_MATH_SET",
        revision: "SYNTHETIC_2026_10_V1",
        reviewStatus: "APPROVED",
        reviewedAt: "2026-10-01T00:00:00.000Z",
      },
      status: "PUBLISHED",
      expiresOn: "2027-03-31",
      updatedBy: uuid(4),
      updatedAt: "2026-10-01T00:00:00.000Z",
      ...overrides,
    }) as unknown as ResourceLibraryRecord;
  repository.insert(resource(920));
  repository.insert(resource(921, { expiresOn: "2025-01-01" }));
  repository.insert(resource(922, { status: "REVOKED" }));
  repository.insert(resource(923, { classId: otherClassTeacher.classIds[0]! }));
  repository.insert(resource(924, { tags: ["其他知识点"] }));
  repository.insert(
    resource(925, {
      audienceRoles: ["OWNER"] as unknown as ResourceLibraryRecord["audienceRoles"],
    }),
  );
  repository.insert(
    resource(926, {
      tenantId: "00000000-0000-4000-8000-00000000006e",
      campusId: "00000000-0000-4000-8000-00000000006f",
      classId: "00000000-0000-4000-8000-000000000071",
    }),
  );
  repository.insert(
    resource(927, {
      learningSourceGovernance: {
        collection: "SYNTHETIC_CAMPUS_MATH_SET",
        revision: "SYNTHETIC_2026_10_V1",
        reviewStatus: "PENDING_REVIEW",
        reviewedAt: null,
      },
    }),
  );
  repository.insert(
    resource(928, {
      learningSourceGovernance: {
        collection: "SYNTHETIC_CAMPUS_MATH_SET",
        revision: "SYNTHETIC_2026_10_V1",
        reviewStatus: "RETURNED",
        reviewedAt: "2026-10-05T00:00:00.000Z",
      },
    }),
  );
  repository.insert(
    resource(929, {
      learningSourceGovernance: {
        collection: "SYNTHETIC_CAMPUS_MATH_SET",
        revision: "SYNTHETIC_2026_10_V1",
        reviewStatus: "APPROVED",
        reviewedAt: null,
      },
    }),
  );
  const reader = (member: typeof parent) =>
    Reflect.get(service, "learningKnowledge")?.call(service, member) as
      Array<Record<string, unknown>> | undefined;

  assert.throws(
    () => reader(parent),
    (error) => error instanceof LocalError && error.statusCode === 403,
  );
  approveParentBinding();

  const parentResources = reader(parent);
  const teacherResources = reader(teacher);
  assert.ok(parentResources);
  assert.ok(teacherResources);
  assert.deepEqual(parentResources, teacherResources);
  assert.equal(parentResources.length, 1);
  assert.deepEqual(parentResources[0], {
    id: uuid(920),
    version: 3,
    title: "两位数加法分步学习卡",
    summary: "按步骤理解进位过程。",
    content: "先拆分数位，再依次相加；完成后请与老师或家长核对。",
    grade: "三年级",
    subject: "数学",
    knowledgePoint: "两位数加法与进位",
    sourceLabel: "合成教研组",
    expiresOn: "2027-03-31",
  });
  assert.doesNotMatch(
    JSON.stringify(parentResources),
    /studentId|tenantId|campusId|classId|ownerId|ownerLabel|actorId/iu,
  );
  assert.deepEqual(
    reader(otherClassTeacher)?.map((resource) => resource.id),
    [uuid(923)],
  );
});

test("anonymous learning evaluation reports V3 rates without exposing session details", () => {
  const { service, repository, approveParentBinding } = setup();
  approveParentBinding();

  const firstTry = service.create(parent, createBody);
  service.answer(parent, firstTry.id, { itemId: "main", choice: "B" });
  service.answer(parent, firstTry.id, { itemId: "practice-1", choice: "A" });
  service.answer(parent, firstTry.id, { itemId: "practice-2", choice: "B" });

  const hintAssisted = service.create(parent, createBody);
  service.answer(parent, hintAssisted.id, { itemId: "main", choice: "C" });
  service.hint(parent, hintAssisted.id, { level: 0 });
  service.answer(parent, hintAssisted.id, { itemId: "main", choice: "A" });
  service.hint(parent, hintAssisted.id, { level: 1 });
  service.answer(parent, hintAssisted.id, { itemId: "main", choice: "B" });
  service.answer(parent, hintAssisted.id, { itemId: "practice-1", choice: "A" });
  service.answer(parent, hintAssisted.id, { itemId: "practice-2", choice: "A" });

  const handedOff = service.create(teacher, createBody);
  service.answer(teacher, handedOff.id, { itemId: "main", choice: "B" });
  service.close(teacher, handedOff.id, { handoff: true });
  const handoffAudit = repository
    .audits()
    .find((event) => event.action === "learning.teacher-handoff");
  assert.ok(handoffAudit);
  repository.audit(handoffAudit);
  repository.audit({ ...handoffAudit, action: "learning.safety-incident" });
  repository.audit({
    ...handoffAudit,
    action: "learning.safety-incident",
    outcome: "DENIED",
  });

  const summary = service.safetySummary(platform);
  assert.equal(Reflect.get(summary, "metricVersion"), "LEARNING_SAFETY_V2");
  assert.equal(summary.firstAttemptSuccesses, 2);
  assert.equal(summary.hintAssistedSuccesses, 1);
  assert.equal(summary.mainAnswerAttempts, 5);
  assert.equal(summary.consolidationAnswered, 4);
  assert.equal(summary.consolidationCorrect, 3);
  assert.deepEqual(summary.postHintAnswerRate, {
    numerator: 1,
    denominator: 1,
    percent: 100,
  });
  assert.deepEqual(summary.consolidationCompletionRate, {
    numerator: 4,
    denominator: 6,
    percent: 66.7,
  });
  assert.deepEqual(summary.teacherInterventionRate, {
    numerator: 1,
    denominator: 3,
    percent: 33.3,
  });
  assert.deepEqual(summary.answerErrorRate, {
    numerator: 3,
    denominator: 9,
    percent: 33.3,
  });
  assert.equal(summary.severeSafetyEvents, 1);
  assert.doesNotMatch(
    JSON.stringify(summary),
    /studentId|studentLabel|sessionId|tenantId|campusId|classId|actorId/u,
  );
});

test("anonymous learning evaluation uses null rates when there are no samples", () => {
  const { service } = setup();
  const summary = service.safetySummary(platform);

  assert.deepEqual(summary.postHintAnswerRate, { numerator: 0, denominator: 0, percent: null });
  assert.deepEqual(summary.consolidationCompletionRate, {
    numerator: 0,
    denominator: 0,
    percent: null,
  });
  assert.deepEqual(summary.teacherInterventionRate, {
    numerator: 0,
    denominator: 0,
    percent: null,
  });
  assert.deepEqual(summary.answerErrorRate, { numerator: 0, denominator: 0, percent: null });
  assert.equal(summary.severeSafetyEvents, 0);
});

test("daily report summary uses Shanghai date, exact class scope, distinct completed learners and live deletion", () => {
  let now = Date.parse("2026-10-10T16:30:00.000Z");
  const repository = new LocalRepository();
  const service = learningService(repository, () => now);
  const complete = (studentId: string) => {
    const record = service.create(teacher, { ...createBody, studentId, durationMinutes: 10 });
    service.answer(teacher, record.id, { itemId: "main", choice: "B" });
    service.answer(teacher, record.id, { itemId: "practice-1", choice: "A" });
    service.answer(teacher, record.id, { itemId: "practice-2", choice: "B" });
    return record.id;
  };
  complete(uuid(200));
  complete(uuid(200));
  const active = service.create(teacher, {
    ...createBody,
    studentId: uuid(201),
    durationMinutes: 5,
  });

  assert.equal(
    service.dailySummary("2026-10-11", teacher.tenantId, teacher.campusId, teacher.classIds[0]!),
    null,
  );
  now += 5 * 60_000 + 1;
  assert.equal(service.get(teacher, active.id).status, "EXPIRED");
  assert.equal(
    service.dailySummary("2026-10-11", teacher.tenantId, teacher.campusId, teacher.classIds[0]!),
    null,
  );

  const second = complete(uuid(201));
  const summary = service.dailySummary(
    "2026-10-11",
    teacher.tenantId,
    teacher.campusId,
    teacher.classIds[0]!,
  );
  assert.deepEqual(summary, {
    completedLearnerBand: "2_PLUS",
    usedGuidance: false,
    needsTeacherFollowUp: false,
  });
  assert.equal(
    service.dailySummary("2026-10-10", teacher.tenantId, teacher.campusId, teacher.classIds[0]!),
    null,
  );
  assert.equal(
    service.dailySummary("2026-10-11", teacher.tenantId, teacher.campusId, uuid(104)),
    null,
  );
  assert.equal(
    service.dailySummary("2026-10-11", uuid(110), teacher.campusId, teacher.classIds[0]!),
    null,
  );
  service.delete(teacher, second, {});
  assert.equal(
    service.dailySummary("2026-10-11", teacher.tenantId, teacher.campusId, teacher.classIds[0]!),
    null,
  );
});

test("daily report summary excludes closed and handed-off learning sessions", () => {
  const now = Date.parse("2026-10-10T16:30:00.000Z");
  const summaryFor = (status: "CLOSED" | "HANDED_OFF") => {
    const repository = new LocalRepository();
    const service = learningService(repository, () => now);
    const complete = service.create(teacher, {
      ...createBody,
      studentId: uuid(200),
      durationMinutes: 10,
    });
    service.answer(teacher, complete.id, { itemId: "main", choice: "B" });
    service.answer(teacher, complete.id, { itemId: "practice-1", choice: "A" });
    service.answer(teacher, complete.id, { itemId: "practice-2", choice: "B" });
    const secondStudent = studentForId(uuid(201))!;
    repository.insert({
      id: uuid(900),
      version: 1,
      kind: "binding",
      tenantId: secondStudent.tenantId,
      campusId: secondStudent.campusId,
      classId: secondStudent.classId,
      guardianId: parent.actorId,
      studentId: secondStudent.id,
      relationship: "GUARDIAN",
      status: "APPROVED",
    });
    const ineligible = service.create(parent, {
      ...createBody,
      studentId: uuid(201),
      durationMinutes: 10,
    });
    service.close(status === "HANDED_OFF" ? teacher : parent, ineligible.id, {
      ...(status === "HANDED_OFF" ? { handoff: true } : {}),
    });
    return service.dailySummary(
      "2026-10-11",
      teacher.tenantId,
      teacher.campusId,
      teacher.classIds[0]!,
    );
  };

  assert.equal(summaryFor("CLOSED"), null);
  assert.equal(summaryFor("HANDED_OFF"), null);
});

test("parent learning summary aggregates only approved children and never exposes automatic judgments", () => {
  const { repository, service, approveParentBinding, advance } = setup();
  approveParentBinding();
  const secondStudent = studentForId(uuid(201))!;
  const secondParent = memberForActor(uuid(2))!;
  repository.insert({
    id: uuid(901),
    version: 1,
    kind: "binding",
    tenantId: secondStudent.tenantId,
    campusId: secondStudent.campusId,
    classId: secondStudent.classId,
    guardianId: parent.actorId,
    studentId: secondStudent.id,
    relationship: "GUARDIAN",
    status: "PENDING",
  });
  repository.insert({
    id: uuid(902),
    version: 1,
    kind: "binding",
    tenantId: secondStudent.tenantId,
    campusId: secondStudent.campusId,
    classId: secondStudent.classId,
    guardianId: secondParent.actorId,
    studentId: secondStudent.id,
    relationship: "GUARDIAN",
    status: "APPROVED",
  });
  const secondStudentSession = service.create(teacher, {
    ...createBody,
    studentId: secondStudent.id,
  });
  service.close(teacher, secondStudentSession.id, {});
  const readSummary = Reflect.get(service, "parentSummary") as
    | ((member: typeof parent) => {
        students: readonly {
          studentId: string;
          studentLabel: string;
          usedMinutes: number;
          sessionCount: number;
          completedSessions: number;
          knowledgePoints: readonly {
            label: string;
            sessionCount: number;
            completedSessions: number;
          }[];
          attentionCount: number;
        }[];
      })
    | undefined;
  assert.equal(typeof readSummary, "function", "the parent-safe summary endpoint is missing");
  if (!readSummary) return;

  const completedSession = service.create(teacher, createBody);
  advance(2 * 60_000);
  service.answer(teacher, completedSession.id, { itemId: "main", choice: "B" });
  service.answer(teacher, completedSession.id, {
    itemId: "practice-1",
    choice: "A",
  });
  service.answer(teacher, completedSession.id, {
    itemId: "practice-2",
    choice: "B",
  });

  const automaticallyFlagged = service.create(parent, createBody);
  for (let attempt = 0; attempt < 4; attempt += 1)
    service.answer(parent, automaticallyFlagged.id, {
      itemId: "main",
      choice: "A",
    });
  assert.equal(readSummary.call(service, parent)?.students[0]?.attentionCount, 0);

  const handedOffSession = service.create(teacher, createBody);
  service.close(teacher, handedOffSession.id, { handoff: true });
  const summary = readSummary.call(service, parent);
  const child = summary?.students[0];
  assert.equal(summary?.students.length, 1);
  assert.equal(child?.studentId, student.id);
  assert.equal(child?.studentLabel, student.label);
  assert.equal(child?.usedMinutes, 2);
  assert.equal(child?.sessionCount, 3);
  assert.equal(child?.completedSessions, 1);
  assert.deepEqual(child?.knowledgePoints, [
    {
      label: "两位数加法与进位",
      sessionCount: 3,
      completedSessions: 1,
    },
  ]);
  assert.equal(child?.attentionCount, 1);
  assert.deepEqual(service.parentControls(parent).parentSummary, summary?.students);
  assert.equal(
    Number.isNaN(Date.parse(service.parentControls(parent).parentSummaryUpdatedAt)),
    false,
  );
  assert.doesNotMatch(
    JSON.stringify(summary),
    /sessionId|prompt|visibleHint|needsTeacherFollowUp|tenantId|campusId|classId|actorId/iu,
  );
  assert.doesNotMatch(JSON.stringify(summary), /238 \+ 165|先把加数拆开/u);
  assert.deepEqual(readSummary.call(service, { ...parent, campusId: uuid(202) })?.students, []);
  assert.deepEqual(readSummary.call(service, { ...parent, tenantId: uuid(102) })?.students, []);
  assert.deepEqual(readSummary.call(service, { ...parent, classIds: [uuid(104)] })?.students, []);
  assert.deepEqual(
    readSummary.call(service, secondParent)?.students.map((row) => row.studentId),
    [secondStudent.id],
  );
});

test("parent learning summary disappears immediately after the binding is revoked", () => {
  const { repository, service, approveParentBinding } = setup();
  approveParentBinding();
  service.create(teacher, createBody);
  const readSummary = Reflect.get(service, "parentSummary") as
    ((member: typeof parent) => { students: readonly unknown[] }) | undefined;
  assert.equal(typeof readSummary, "function", "the parent-safe summary endpoint is missing");
  if (!readSummary) return;
  assert.equal(readSummary.call(service, parent).students.length, 1);

  const binding = repository.get(uuid(900));
  assert.ok(binding && binding.kind === "binding");
  assert.equal(
    repository.replaceBatch([{ ...binding, status: "RELEASED", version: binding.version + 1 }]),
    true,
  );
  assert.deepEqual(readSummary.call(service, parent), { students: [] });
});

test("institution learning setting defaults off, is owner scoped, and closes campus sessions", async () => {
  const app = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  try {
    const createHandle = async (profile: string) => {
      const response = await app.inject({
        method: "POST",
        url: "/local/sessions",
        payload: { profile },
      });
      assert.equal(response.statusCode, 201, response.body);
      return (response.json() as { handle: string }).handle;
    };
    const parentHandle = await createHandle("parent-alpha");
    const ownerHandle = await createHandle("owner-east");
    const westOwnerHandle = await createHandle("owner-west");
    const otherTenantOwnerHandle = await createHandle("owner-other-tenant");
    const teacherHandle = await createHandle("teacher-east");
    const platformHandle = await createHandle("platform-admin");
    const headers = (handle: string) => ({ authorization: `Bearer ${handle}` });
    const parentHeaders = headers(parentHandle);
    const ownerHeaders = headers(ownerHandle);
    const teacherHeaders = headers(teacherHandle);

    const defaultSetting = await app.inject({
      method: "GET",
      url: "/local/learning-institution-setting",
      headers: ownerHeaders,
    });
    assert.equal(defaultSetting.statusCode, 200, defaultSetting.body);
    assert.deepEqual(defaultSetting.json(), { enabled: false, version: 0 });

    const westSetting = await app.inject({
      method: "GET",
      url: "/local/learning-institution-setting",
      headers: headers(westOwnerHandle),
    });
    assert.deepEqual(westSetting.json(), { enabled: false, version: 0 });
    const otherTenantSetting = await app.inject({
      method: "GET",
      url: "/local/learning-institution-setting",
      headers: headers(otherTenantOwnerHandle),
    });
    assert.deepEqual(otherTenantSetting.json(), { enabled: false, version: 0 });

    for (const handle of [parentHandle, teacherHandle, platformHandle]) {
      const denied = await app.inject({
        method: "GET",
        url: "/local/learning-institution-setting",
        headers: headers(handle),
      });
      assert.equal(denied.statusCode, 403);
    }
    const parentCannotUpdate = await app.inject({
      method: "PATCH",
      url: "/local/learning-institution-setting",
      headers: parentHeaders,
      payload: { enabled: true, expectedVersion: 0 },
    });
    assert.equal(parentCannotUpdate.statusCode, 403);

    const bindingResponse = await app.inject({
      method: "POST",
      url: "/local/binding-applications",
      headers: parentHeaders,
      payload: { student: "student-alpha", relationship: "GUARDIAN" },
    });
    assert.equal(bindingResponse.statusCode, 201, bindingResponse.body);
    const binding = bindingResponse.json() as { id: string; version: number };
    const reviewed = await app.inject({
      method: "POST",
      url: `/local/binding-applications/${binding.id}/review`,
      headers: ownerHeaders,
      payload: { version: binding.version, action: "approve" },
    });
    assert.equal(reviewed.statusCode, 200, reviewed.body);
    const consentResponse = await app.inject({
      method: "POST",
      url: "/local/consents",
      headers: parentHeaders,
      payload: {
        bindingId: binding.id,
        purposeKey: "LEARNING_SUPPORT",
        noticeVersion: "LEARNING_SUPPORT_NOTICE_V1",
        confirmed: true,
      },
    });
    assert.equal(consentResponse.statusCode, 201, consentResponse.body);
    const learningBody = {
      studentId: student.id,
      questionId: "math-grade-3-addition-01",
      consentVersion: "LEARNING_DEMO_V2",
      durationMinutes: 10,
    };
    const closedByDefault = await app.inject({
      method: "POST",
      url: "/local/learning-sessions",
      headers: parentHeaders,
      payload: learningBody,
    });
    assert.equal(closedByDefault.statusCode, 403);

    const enabled = await app.inject({
      method: "PATCH",
      url: "/local/learning-institution-setting",
      headers: ownerHeaders,
      payload: { enabled: true, expectedVersion: 0 },
    });
    assert.equal(enabled.statusCode, 200, enabled.body);
    assert.deepEqual(enabled.json(), { enabled: true, version: 1 });
    const staleUpdate = await app.inject({
      method: "PATCH",
      url: "/local/learning-institution-setting",
      headers: ownerHeaders,
      payload: { enabled: false, expectedVersion: 0 },
    });
    assert.equal(staleUpdate.statusCode, 409);
    const forgedScope = await app.inject({
      method: "PATCH",
      url: "/local/learning-institution-setting",
      headers: ownerHeaders,
      payload: {
        enabled: true,
        expectedVersion: 1,
        campusId: "00000000-0000-4000-8000-000000000102",
      },
    });
    assert.equal(forgedScope.statusCode, 400);

    const parentLearning = await app.inject({
      method: "POST",
      url: "/local/learning-sessions",
      headers: parentHeaders,
      payload: learningBody,
    });
    assert.equal(parentLearning.statusCode, 201, parentLearning.body);
    const parentSession = parentLearning.json() as { id: string };
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: `/local/learning-sessions/${parentSession.id}/answer`,
          headers: parentHeaders,
          payload: { itemId: "main", choice: "A" },
        })
      ).statusCode,
      200,
    );
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: `/local/learning-sessions/${parentSession.id}/hint`,
          headers: parentHeaders,
          payload: { level: 0 },
        })
      ).statusCode,
      200,
    );
    const teacherLearning = await app.inject({
      method: "POST",
      url: "/local/learning-sessions",
      headers: teacherHeaders,
      payload: learningBody,
    });
    assert.equal(teacherLearning.statusCode, 201, teacherLearning.body);
    const teacherSession = teacherLearning.json() as { id: string };

    const disabled = await app.inject({
      method: "PATCH",
      url: "/local/learning-institution-setting",
      headers: ownerHeaders,
      payload: { enabled: false, expectedVersion: 1 },
    });
    assert.equal(disabled.statusCode, 200, disabled.body);
    assert.deepEqual(disabled.json(), { enabled: false, version: 2 });
    for (const { handle, id } of [
      { handle: parentHandle, id: parentSession.id },
      { handle: teacherHandle, id: teacherSession.id },
    ]) {
      const session = await app.inject({
        method: "GET",
        url: `/local/learning-sessions/${id}`,
        headers: headers(handle),
      });
      assert.equal(session.statusCode, 200, session.body);
      assert.equal((session.json() as { status: string }).status, "CLOSED");
      assert.equal((session.json() as { visibleHint: unknown }).visibleHint, null);
      for (const action of ["answer", "hint"]) {
        const rejected = await app.inject({
          method: "POST",
          url: `/local/learning-sessions/${id}/${action}`,
          headers: headers(handle),
          payload: action === "answer" ? { itemId: "main", choice: "B" } : { level: 1 },
        });
        assert.equal(rejected.statusCode, 409);
      }
    }
  } finally {
    await app.close();
  }
});
