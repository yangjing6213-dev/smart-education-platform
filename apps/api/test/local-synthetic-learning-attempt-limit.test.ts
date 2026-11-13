import assert from "node:assert/strict";
import test from "node:test";
import { LearningSessionService } from "../src/local-synthetic/learning-session.service.js";
import { LocalError } from "../src/local-synthetic/binding-leave.service.js";
import { LocalRepository } from "../src/local-synthetic/repository.js";
import { memberForActor, studentForId } from "../src/local-synthetic/sessions.js";

const uuid = (n: number) => `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
const parent = memberForActor(uuid(1))!;
const teacher = memberForActor(uuid(3))!;
const otherTeacher = memberForActor(uuid(7))!;
const platform = memberForActor(uuid(10))!;
const student = studentForId(uuid(200))!;
const body = {
  studentId: student.id,
  questionId: "math-grade-3-addition-01",
  consentVersion: "LEARNING_DEMO_V2",
  durationMinutes: 10,
};
const rejected = (code: number) => (error: unknown) =>
  error instanceof LocalError && error.statusCode === code;

function setup() {
  let now = Date.parse("2026-10-13T00:00:00Z");
  const repository = new LocalRepository();
  const service = new LearningSessionService(
    repository,
    {
      activeLearningConsent: () => ({
        id: uuid(901),
        consentVersion: "LEARNING_DEMO_V2",
        policyVersion: "AI_LEARNING_POLICY_SYNTHETIC_V1",
        authorizedAt: new Date(now).toISOString(),
      }),
    },
    () => now,
  );
  service.updateInstitutionSetting(memberForActor(uuid(4))!, {
    enabled: true,
    expectedVersion: 0,
  });
  const binding = {
    id: uuid(900),
    version: 1,
    kind: "binding" as const,
    tenantId: student.tenantId,
    campusId: student.campusId,
    classId: student.classId,
    guardianId: parent.actorId,
    studentId: student.id,
    relationship: "GUARDIAN" as const,
    status: "APPROVED" as const,
  };
  repository.insert(binding);
  const exhaust = (member = teacher) => {
    let session = service.create(member, body);
    for (let i = 0; i < 5; i += 1)
      session = service.answer(member, session.id, { itemId: "main", choice: "A" });
    return session;
  };
  return {
    service,
    repository,
    binding,
    exhaust,
    expire() {
      now += 10 * 60_000;
    },
  };
}

test("the sixth answer and a late unused hint cannot bypass the cap", () => {
  const { service, exhaust } = setup();
  const session = exhaust();
  assert.throws(
    () => service.answer(teacher, session.id, { itemId: "main", choice: "A" }),
    rejected(409),
  );
  assert.throws(() => service.hint(teacher, session.id, { level: 0 }), rejected(409));
});

test("five attempts are enforced without hints; rejected actions cannot mutate the record", () => {
  const { service, repository } = setup();
  let session = service.create(teacher, body);
  assert.equal(session.mainAttemptLimit, 5);
  assert.equal(session.mainAttemptLimitReached, false);
  for (let i = 1; i <= 5; i += 1) {
    session = service.answer(teacher, session.id, { itemId: "main", choice: "A" });
    assert.equal(session.mainAttempts, i);
    assert.equal(session.mainAttemptLimitReached, i === 5);
  }
  assert.equal(session.status, "ACTIVE", "no automatic teacher handoff");
  assert.equal(session.needsTeacherFollowUp, true);
  const audits = repository.audits().length;
  for (const choice of ["A", "B", "C"]) {
    assert.throws(
      () => service.answer(teacher, session.id, { itemId: "main", choice }),
      rejected(409),
    );
  }
  assert.throws(() => service.hint(teacher, session.id, { level: 0 }), rejected(409));
  assert.throws(
    () => service.answer(teacher, session.id, { itemId: "practice-1", choice: "A" }),
    rejected(409),
  );
  assert.deepEqual(service.get(teacher, session.id), session);
  assert.equal(
    repository.audits().length,
    audits,
    "no accepted action or version after exhaustion",
  );
});

test("four wrong attempts and four hints still allow a correct fifth answer and both consolidation items", () => {
  const { service } = setup();
  let session = service.create(teacher, body);
  assert.throws(() => service.hint(teacher, session.id, { level: 0 }), rejected(409));
  for (let level = 0; level <= 3; level += 1) {
    session = service.answer(teacher, session.id, { itemId: "main", choice: "A" });
    session = service.hint(teacher, session.id, { level });
    assert.equal(session.visibleHint?.level, level);
    assert.equal(session.mainAttemptLimitReached, false);
  }
  session = service.answer(teacher, session.id, { itemId: "main", choice: "B" });
  assert.equal(session.mainCorrect, true);
  assert.equal(session.mainAttemptLimitReached, false);
  assert.equal(session.mainAttempts, 5);
  assert.throws(
    () => service.answer(teacher, session.id, { itemId: "main", choice: "B" }),
    rejected(409),
  );
  session = service.answer(teacher, session.id, { itemId: "practice-1", choice: "B" });
  assert.equal(session.status, "ACTIVE");
  session = service.answer(teacher, session.id, { itemId: "practice-2", choice: "B" });
  assert.equal(session.status, "COMPLETED");
  assert.equal(session.mainAttempts, 5);
  assert.equal(session.consolidation.filter((item) => item.answered).length, 2);
  assert.equal(service.close(teacher, session.id, {}).status, "COMPLETED");
});

test("exhaustion preserves owner closure and does not claim a teacher has intervened", () => {
  const { service, exhaust } = setup();
  const session = exhaust(parent);
  assert.equal(session.status, "ACTIVE");
  assert.throws(() => service.close(parent, session.id, { handoff: true }), rejected(403));
  assert.equal(service.close(parent, session.id, {}).status, "CLOSED");
  assert.throws(
    () => service.answer(parent, session.id, { itemId: "main", choice: "A" }),
    rejected(409),
  );
});

test("only an explicit scoped teacher action hands an exhausted session over", () => {
  const { service, exhaust } = setup();
  const session = exhaust(parent);
  assert.throws(() => service.close(otherTeacher, session.id, { handoff: true }), rejected(403));
  assert.throws(() => service.close(platform, session.id, { handoff: true }), rejected(403));
  assert.equal(service.get(parent, session.id).status, "ACTIVE");
  const handed = service.close(teacher, session.id, { handoff: true });
  assert.equal(handed.status, "HANDED_OFF");
  assert.equal(service.get(parent, session.id).status, "HANDED_OFF");
  assert.throws(() => service.hint(parent, session.id, { level: 0 }), rejected(409));
});

test("time expiry and binding revocation remain authoritative for exhausted sessions", () => {
  const { service, exhaust, expire, repository, binding } = setup();
  const session = exhaust(parent);
  expire();
  assert.equal(service.get(parent, session.id).status, "EXPIRED");
  assert.throws(() => service.close(teacher, session.id, { handoff: true }), rejected(409));
  assert.equal(repository.replaceBatch([{ ...binding, version: 2, status: "RELEASED" }]), true);
  assert.throws(() => service.get(parent, session.id), rejected(403));
  assert.throws(
    () => service.answer(parent, session.id, { itemId: "main", choice: "A" }),
    rejected(403),
  );
});
