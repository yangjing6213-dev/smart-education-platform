/* global fetch, URL */
import assert from "node:assert/strict";
import test from "node:test";
import { buildLocalSyntheticServer } from "../../apps/api/dist/src/local-synthetic/server.js";

test("supervised learning requires an approved relation, sequential attempts and scoped summaries", async () => {
  let now = Date.now();
  const service = await buildLocalSyntheticServer({ mode: "local-synthetic", now: () => now });
  const serviceUrl = new URL(await service.start(0));
  const api = async (handle, method, path, body, expected = 200) => {
    const response = await fetch(new URL(path, serviceUrl), {
      method,
      headers: {
        origin: serviceUrl.origin,
        ...(handle ? { authorization: `Bearer ${handle}` } : {}),
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    assert.equal(response.status, expected, `${method} ${path}`);
    return response.status === 204 ? null : response.json();
  };
  const connect = async (profile) =>
    (await api("", "POST", "/local/sessions", { profile }, 201)).handle;

  try {
    const parent = await connect("parent-alpha");
    const unapprovedParent = await connect("parent-beta");
    const owner = await connect("owner-east");
    const teacher = await connect("teacher-east");
    const otherClassTeacher = await connect("teacher-other-class");
    const platform = await connect("platform-admin");
    const student = (await api(parent, "GET", "/local/student-options"))[0];
    const pendingBinding = await api(
      parent,
      "POST",
      "/local/binding-applications",
      { student: student.alias, relationship: "GUARDIAN" },
      201,
    );
    await api(owner, "POST", `/local/binding-applications/${pendingBinding.id}/review`, {
      version: pendingBinding.version,
      action: "approve",
    });

    const createBody = {
      studentId: student.id,
      questionId: "math-grade-3-addition-01",
      consentVersion: "LEARNING_DEMO_V2",
      durationMinutes: 10,
    };
    await api(unapprovedParent, "POST", "/local/learning-sessions", createBody, 403);
    await api(
      parent,
      "POST",
      "/local/learning-sessions",
      { ...createBody, studentId: "other" },
      403,
    );
    const session = await api(parent, "POST", "/local/learning-sessions", createBody, 201);
    assert.equal(session.status, "ACTIVE");
    assert.equal(session.durationMinutes, 10);
    assert.equal(session.consentVersion, "LEARNING_DEMO_V2");
    assert.equal(session.guidanceMode, "FIXED_LOCAL");
    await api(
      parent,
      "POST",
      "/local/learning-sessions",
      { ...createBody, freeText: "不要记录这段虚构输入" },
      400,
    );
    await api(
      parent,
      "POST",
      "/local/learning-sessions",
      { ...createBody, questionId: "unsupported-grade-subject" },
      400,
    );
    await api(
      parent,
      "POST",
      "/local/learning-sessions",
      { ...createBody, consentVersion: "LEARNING_DEMO_V1" },
      400,
    );
    const auditRows = await api(owner, "GET", "/local/audit");
    assert.ok(
      auditRows.some((row) => row.action === "learning.enable" && row.outcome === "DENIED"),
    );
    assert.doesNotMatch(JSON.stringify(auditRows), /不要记录这段虚构输入/u);
    assert.equal(session.question.id, createBody.questionId);
    assert.equal("correctAnswer" in session.question, false);

    const answer = (itemId, choice, expected = 200) =>
      api(
        parent,
        "POST",
        `/local/learning-sessions/${session.id}/answer`,
        { itemId, choice },
        expected,
      );
    const hint = (level, expected = 200) =>
      api(parent, "POST", `/local/learning-sessions/${session.id}/hint`, { level }, expected);
    await hint(0, 409);
    await answer("main", "C");
    await answer("main", "C");
    const level0 = await hint(0);
    assert.match(level0.visibleHint.text, /先把加数拆开/u);
    await hint(1, 409);
    await answer("main", "C");
    assert.match((await hint(1)).visibleHint.text, /剩下的 65/u);
    await hint(2, 409);
    await answer("main", "C");
    await hint(2);
    await hint(3, 409);
    await answer("main", "C");
    const finalHint = await hint(3);
    assert.match(finalHint.visibleHint.text, /自行/u);
    assert.doesNotMatch(finalHint.visibleHint.text, /403/u);
    await answer("main", "B");
    await answer("practice-1", "A");
    const completed = await answer("practice-2", "B");
    assert.equal(completed.status, "COMPLETED");
    assert.equal(completed.consolidation.length, 2);

    const parentRows = await api(parent, "GET", "/local/learning-sessions");
    assert.equal(parentRows.length, 1);
    const teacherSummary = await api(teacher, "GET", "/local/learning-teacher-summary");
    assert.equal(teacherSummary.sessions.length, 1);
    assert.equal(teacherSummary.sessions[0].studentLabel, student.label);
    assert.deepEqual(
      (await api(otherClassTeacher, "GET", "/local/learning-teacher-summary")).sessions,
      [],
    );

    const anonymous = await api(platform, "GET", "/local/learning-safety-summary");
    assert.equal(anonymous.metricVersion, "LEARNING_SAFETY_V2");
    assert.equal(anonymous.totalSessions, 1);
    assert.deepEqual(anonymous.postHintAnswerRate, { numerator: 1, denominator: 1, percent: 100 });
    assert.deepEqual(anonymous.consolidationCompletionRate, {
      numerator: 2,
      denominator: 2,
      percent: 100,
    });
    assert.deepEqual(anonymous.teacherInterventionRate, {
      numerator: 0,
      denominator: 1,
      percent: 0,
    });
    assert.deepEqual(anonymous.answerErrorRate, {
      numerator: 5,
      denominator: 8,
      percent: 62.5,
    });
    assert.equal(anonymous.severeSafetyEvents, 0);
    assert.doesNotMatch(
      JSON.stringify(anonymous),
      /studentId|studentLabel|student-alpha|sessionId|tenantId|campusId|classId/u,
    );
    await api(parent, "GET", `/local/learning-sessions/${session.id}`, undefined, 200);
    await api(parent, "POST", `/local/learning-sessions/${session.id}/close`, {});
    await answer("main", "B", 409);
    await api(parent, "POST", `/local/learning-sessions/${session.id}/delete`, {});
    assert.deepEqual(await api(parent, "GET", "/local/learning-sessions"), []);
    assert.equal((await api(teacher, "GET", "/local/learning-teacher-summary")).sessions.length, 0);

    const teacherStudents = await api(teacher, "GET", "/local/student-options");
    assert.equal(teacherStudents[0].id, student.id);
    const teacherSession = await api(teacher, "POST", "/local/learning-sessions", createBody, 201);
    assert.equal((await api(teacher, "GET", "/local/learning-sessions"))[0].id, teacherSession.id);
    assert.equal(
      (await api(teacher, "GET", `/local/learning-sessions/${teacherSession.id}`)).id,
      teacherSession.id,
    );
    await api(parent, "GET", `/local/learning-sessions/${teacherSession.id}`, undefined, 403);
    await api(
      otherClassTeacher,
      "GET",
      `/local/learning-sessions/${teacherSession.id}`,
      undefined,
      403,
    );
    assert.equal((await api(teacher, "GET", "/local/learning-teacher-summary")).sessions.length, 1);
    assert.deepEqual(
      (await api(otherClassTeacher, "GET", "/local/learning-teacher-summary")).sessions,
      [],
    );

    const handoffSession = await api(parent, "POST", "/local/learning-sessions", createBody, 201);
    await api(
      parent,
      "POST",
      `/local/learning-sessions/${handoffSession.id}/close`,
      { handoff: true },
      403,
    );
    await api(
      teacher,
      "POST",
      `/local/learning-sessions/${handoffSession.id}/close`,
      { handoff: true },
      200,
    );
    assert.equal(
      (await api(parent, "GET", `/local/learning-sessions/${handoffSession.id}`)).status,
      "HANDED_OFF",
    );
    await api(
      parent,
      "POST",
      `/local/learning-sessions/${handoffSession.id}/answer`,
      { itemId: "main", choice: "B" },
      409,
    );
    await api(
      otherClassTeacher,
      "POST",
      `/local/learning-sessions/${handoffSession.id}/close`,
      { handoff: true },
      403,
    );
    await api(
      otherClassTeacher,
      "POST",
      `/local/learning-sessions/${handoffSession.id}/delete`,
      {},
      403,
    );
    await api(teacher, "POST", `/local/learning-sessions/${handoffSession.id}/delete`, {});
    assert.equal(
      (await api(teacher, "GET", "/local/learning-teacher-summary")).sessions.some(
        (row) => row.id === handoffSession.id,
      ),
      false,
    );
    const safety = await api(platform, "GET", "/local/learning-safety-summary");
    assert.ok(safety.refusedActions >= 2);
    assert.equal(safety.teacherHandoffs, 1);
    assert.equal(safety.fixedGuidanceSessions, 1);
    assert.doesNotMatch(JSON.stringify(safety), /不要记录这段虚构输入/u);

    const expiring = await api(
      parent,
      "POST",
      "/local/learning-sessions",
      {
        ...createBody,
        durationMinutes: 5,
      },
      201,
    );
    now += 5 * 60_000 + 1;
    await api(
      parent,
      "POST",
      `/local/learning-sessions/${expiring.id}/answer`,
      { itemId: "main", choice: "B" },
      409,
    );
    assert.equal(
      (await api(parent, "GET", `/local/learning-sessions/${expiring.id}`)).status,
      "EXPIRED",
    );
  } finally {
    await service.close();
  }
});
