import assert from "node:assert/strict";
import test from "node:test";
import { renderParentLearningPage } from "./parent-learning.js";

const binding = {
  studentId: "student-synthetic-01",
  studentLabel: "模拟学生甲",
  classLabel: "三年级 A 班",
};

function cappedSnapshot(profile: "parent-alpha" | "teacher-east" = "parent-alpha") {
  const session = {
    id: "session-cap-synthetic",
    studentId: binding.studentId,
    status: "ACTIVE" as const,
    consentVersion: "LEARNING_DEMO_V2" as const,
    consentedAt: "2026-10-13T00:00:00.000Z",
    guidanceMode: "FIXED_LOCAL" as const,
    studentLabel: binding.studentLabel,
    question: {
      prompt: "238 + 165 = ？",
      choices: [
        { id: "A" as const, label: "393" },
        { id: "B" as const, label: "403" },
        { id: "C" as const, label: "413" },
      ],
    },
    mainAttempts: 5,
    mainAttemptLimit: 5,
    mainAttemptLimitReached: true,
    lastHintAtAttempt: 0,
    mainCorrect: false,
    highestHintLevel: -1 as const,
    visibleHint: null,
    consolidation: [],
    needsTeacherFollowUp: true,
    endsAt: "2026-10-13T00:10:00.000Z",
  };
  return {
    status: "READY" as const,
    message: "学习记录已更新。",
    profile,
    approvedStudents: [binding],
    sessions: [session],
    activeSession: session,
    knowledgeResources: [],
    teacherSummary: [
      {
        id: session.id,
        status: session.status,
        studentLabel: binding.studentLabel,
        grade: "三年级",
        subject: "数学",
        knowledgePoint: "加法",
        mainAttempts: 5,
        highestHintLevel: -1 as const,
        consolidationCompleted: 0,
        needsTeacherFollowUp: true,
        startedAt: session.consentedAt,
      },
    ],
  };
}

for (const profile of ["parent-alpha", "teacher-east"] as const) {
  test(`${profile} exhausted main choices are disabled and hints stop without automatic handoff`, () => {
    const html = renderParentLearningPage(cappedSnapshot(profile));
    const choices = [...html.matchAll(/<button\b[^>]*data-learning-answer="main"[^>]*>/gu)];
    assert.equal(choices.length, 3);
    for (const [button] of choices) assert.match(button, /\bdisabled\b/u);
    assert.doesNotMatch(html, /data-learning-hint=/u);
    assert.match(html, /已达到本次练习尝试上限，请教师协助/u);
    assert.match(html, /等待教师协助/u);
    assert.match(html, /data-learning-close/u);
    assert.doesNotMatch(html, /教师已接手本次练习/u);
    assert.equal(html.includes("data-learning-handoff="), profile === "teacher-east");
  });
}

test("the last available attempt and hint remain usable; a final correct answer still allows consolidation", () => {
  const snapshot = cappedSnapshot();
  const ready = renderParentLearningPage({
    ...snapshot,
    activeSession: {
      ...snapshot.activeSession,
      mainAttempts: 4,
      mainAttemptLimitReached: false,
      highestHintLevel: 2,
      lastHintAtAttempt: 3,
    },
  });
  assert.match(ready, /已尝试 4 \/ 5 次/u);
  assert.match(ready, /data-learning-hint="3"/u);
  for (const [button] of ready.matchAll(/<button\b[^>]*data-learning-answer="main"[^>]*>/gu))
    assert.doesNotMatch(button, /\bdisabled\b/u);
  const correct = renderParentLearningPage({
    ...snapshot,
    activeSession: {
      ...snapshot.activeSession,
      mainCorrect: true,
      mainAttemptLimitReached: false,
      consolidation: [
        {
          id: "practice-1",
          prompt: "合成巩固题一",
          choices: snapshot.activeSession.question.choices,
          answered: true,
          correct: false,
        },
        {
          id: "practice-2",
          prompt: "合成巩固题二",
          choices: snapshot.activeSession.question.choices,
          answered: false,
          correct: null,
        },
      ],
    },
  });
  assert.doesNotMatch(correct, /data-learning-answer="main"|data-learning-answer="practice-1"/u);
  assert.match(correct, /data-learning-answer="practice-2"/u);
  assert.doesNotMatch(correct, /已达到本次练习尝试上限/u);
});

test("parent learning page requires explicit adult consent and only approved synthetic relations", () => {
  const html = renderParentLearningPage({
    status: "READY",
    message: "请选择授权学生并确认用途。",
    approvedStudents: [binding],
    knowledgeResources: [],
    sessions: [],
    activeSession: null,
  });

  assert.match(html, /陪伴式学习/u);
  assert.match(html, /模拟学生甲/u);
  assert.match(html, /我同意本次限时数学练习由成人陪同/u);
  assert.match(html, /本机合成数据/u);
  assert.doesNotMatch(html, /student-real|真实姓名|真实手机号/u);
});

test("active session renders the fixed question, ordered hint controls and consolidation", () => {
  const html = renderParentLearningPage({
    status: "READY",
    message: "学习进行中。",
    approvedStudents: [binding],
    knowledgeResources: [],
    sessions: [],
    activeSession: {
      id: "session-synthetic-01",
      status: "ACTIVE",
      consentVersion: "LEARNING_DEMO_V2",
      consentedAt: "2026-10-07T10:00:00.000Z",
      guidanceMode: "FIXED_LOCAL",
      studentLabel: "模拟学生甲",
      question: {
        prompt: "238 + 165 = ？",
        choices: [
          { id: "A", label: "393" },
          { id: "B", label: "403" },
          { id: "C", label: "413" },
        ],
      },
      mainAttempts: 1,
      lastHintAtAttempt: 0,
      mainCorrect: false,
      highestHintLevel: -1,
      visibleHint: null,
      consolidation: [],
      needsTeacherFollowUp: false,
      endsAt: "2026-10-07T10:05:00.000Z",
    },
  });

  assert.match(html, /238 \+ 165/u);
  assert.match(html, /data-learning-answer="main"/u);
  assert.match(html, /data-learning-hint="0"/u);
  assert.doesNotMatch(html, /data-learning-hint="1"/u);
  assert.match(html, /先尝试，再按顺序查看固定提示/u);
});

test("parent history hides deletion for another active session but keeps ended records removable", () => {
  const html = renderParentLearningPage({
    status: "READY",
    message: "学习记录已更新。",
    approvedStudents: [binding],
    knowledgeResources: [],
    sessions: [
      { id: "session-active-other", status: "ACTIVE", studentLabel: "模拟学生甲" },
      { id: "session-ended", status: "CLOSED", studentLabel: "模拟学生乙" },
    ],
    activeSession: null,
    profile: "parent-alpha",
  } as unknown as Parameters<typeof renderParentLearningPage>[0]);

  assert.doesNotMatch(html, /data-learning-delete="session-active-other"/u);
  assert.match(html, /data-learning-delete="session-ended"/u);
});

test("teacher learning view shows only the scoped class summary and supervised start", () => {
  const snapshot = {
    status: "READY",
    message: "已读取本班学习摘要。",
    approvedStudents: [
      { studentId: "student-synthetic-01", studentLabel: "模拟学生甲", classLabel: "三年级 A 班" },
    ],
    knowledgeResources: [],
    sessions: [],
    activeSession: null,
    teacherSummary: [
      {
        id: "session-synthetic-01",
        status: "ACTIVE",
        studentLabel: "模拟学生甲",
        grade: "三年级",
        subject: "数学",
        knowledgePoint: "两位数加法与进位",
        mainAttempts: 1,
        lastHintAtAttempt: 0,
        highestHintLevel: -1,
        consolidationCompleted: 0,
        needsTeacherFollowUp: false,
        startedAt: "2026-10-07T10:00:00.000Z",
      },
      {
        id: "session-synthetic-02",
        status: "HANDED_OFF",
        studentLabel: "模拟学生乙",
        grade: "三年级",
        subject: "数学",
        knowledgePoint: "两位数加法与进位",
        mainAttempts: 2,
        lastHintAtAttempt: 1,
        highestHintLevel: 0,
        consolidationCompleted: 0,
        needsTeacherFollowUp: true,
        startedAt: "2026-10-07T10:05:00.000Z",
      },
    ],
    profile: "teacher-east",
  } as unknown as Parameters<typeof renderParentLearningPage>[0];
  const html = renderParentLearningPage(snapshot);

  assert.match(html, /教师端/u);
  assert.match(html, /本班学习摘要/u);
  assert.match(html, /模拟学生甲/u);
  assert.match(html, /data-learning-open-form/u);
  assert.match(html, /data-learning-handoff="session-synthetic-01"/u);
  assert.match(html, /data-learning-delete="session-synthetic-02"/u);
  assert.doesNotMatch(html, /其他校区学生/u);
});

test("handed-off session is read-only and clearly indicates teacher support", () => {
  const html = renderParentLearningPage({
    status: "READY",
    message: "教师已接手。",
    approvedStudents: [binding],
    knowledgeResources: [],
    sessions: [],
    activeSession: {
      id: "session-synthetic-02",
      status: "HANDED_OFF",
      consentVersion: "LEARNING_DEMO_V2",
      consentedAt: "2026-10-07T10:00:00.000Z",
      guidanceMode: "FIXED_LOCAL",
      studentLabel: "模拟学生甲",
      question: { prompt: "238 + 165 = ？", choices: [] },
      mainAttempts: 1,
      lastHintAtAttempt: 0,
      mainCorrect: false,
      highestHintLevel: -1,
      visibleHint: null,
      consolidation: [],
      needsTeacherFollowUp: true,
      endsAt: "2026-10-07T10:05:00.000Z",
    },
    profile: "parent-alpha",
  });

  assert.match(html, /教师已接手/u);
  assert.doesNotMatch(html, /data-learning-answer/u);
});

test("parent learning page shows the curated resource source, version and expiry", () => {
  const html = renderParentLearningPage({
    status: "READY",
    message: "学习记录已更新。",
    approvedStudents: [binding],
    sessions: [],
    activeSession: null,
    profile: "parent-alpha",
    knowledgeResources: [
      {
        id: "resource-synthetic-01",
        version: 3,
        title: "两位数加法分步学习卡",
        summary: "按步骤理解进位过程。",
        content: "先拆分数位，再依次相加。",
        grade: "三年级",
        subject: "数学",
        knowledgePoint: "两位数加法与进位",
        sourceLabel: "校内教研组（合成示例）",
        expiresOn: "2027-03-31",
      },
    ],
  });

  assert.match(html, /推荐学习资料/u);
  assert.match(html, /两位数加法分步学习卡/u);
  assert.match(html, /校内教研组（合成示例）/u);
  assert.match(html, /版本 3/u);
  assert.match(html, /有效期至 2027-03-31/u);
});

test("parent controls and teacher contact intent render only in the correct role view", () => {
  const parentHtml = renderParentLearningPage({
    status: "READY",
    message: "学习设置已更新。",
    approvedStudents: [binding],
    sessions: [],
    activeSession: null,
    profile: "parent-alpha",
    knowledgeResources: [],
    parentControls: [
      {
        studentId: binding.studentId,
        studentLabel: binding.studentLabel,
        enabled: true,
        maxDurationMinutes: 10,
        maxHintLevel: 2,
        contactStatus: "NOT_REQUESTED",
      },
    ],
  } as unknown as Parameters<typeof renderParentLearningPage>[0]);
  assert.match(parentHtml, /data-learning-control-form/u);
  assert.match(parentHtml, /单次最长时长/u);
  assert.match(parentHtml, /最高提示层级/u);
  assert.match(parentHtml, /联系教师/u);

  const teacherHtml = renderParentLearningPage({
    status: "READY",
    message: "已读取负责班级学习摘要。",
    approvedStudents: [],
    sessions: [],
    activeSession: null,
    profile: "teacher-east",
    knowledgeResources: [],
    parentContactIntents: [
      {
        id: "contact-synthetic-01",
        studentLabel: binding.studentLabel,
        status: "RECORDED_LOCAL",
        createdAt: "2026-10-11T00:00:00.000Z",
      },
    ],
  } as unknown as Parameters<typeof renderParentLearningPage>[0]);
  assert.match(teacherHtml, /家长联系意向/u);
  assert.match(teacherHtml, /已记录/u);
  assert.doesNotMatch(teacherHtml, /data-learning-control-form/u);
});

test("parent learning duration choices stay within the selected student's saved limit", () => {
  const html = renderParentLearningPage({
    status: "READY",
    message: "学习设置已更新。",
    approvedStudents: [binding],
    knowledgeResources: [],
    sessions: [],
    activeSession: null,
    profile: "parent-alpha",
    parentControls: [
      {
        studentId: binding.studentId,
        studentLabel: binding.studentLabel,
        enabled: true,
        maxDurationMinutes: 5,
        maxHintLevel: 1,
        contactStatus: "NOT_REQUESTED",
      },
    ],
  });

  assert.match(html, /<option value="5" selected>5 分钟<\/option>/u);
  assert.match(html, /<option value="10"[^>]*disabled[^>]*>10 分钟<\/option>/u);
  assert.match(html, /<option value="15"[^>]*disabled[^>]*>15 分钟<\/option>/u);
});

test("parent page shows the approved-child summary without session details", () => {
  const html = renderParentLearningPage({
    status: "READY",
    message: "学习记录已更新。",
    approvedStudents: [binding],
    knowledgeResources: [],
    sessions: [],
    activeSession: null,
    parentSummary: [
      {
        studentId: binding.studentId,
        studentLabel: binding.studentLabel,
        usedMinutes: 7,
        sessionCount: 2,
        completedSessions: 1,
        knowledgePoints: [{ label: "两位数加法与进位", sessionCount: 2, completedSessions: 1 }],
        attentionCount: 1,
      },
    ],
    parentSummaryUpdatedAt: "2026-10-12T03:00:00.000Z",
  } as unknown as Parameters<typeof renderParentLearningPage>[0]);

  assert.match(html, /孩子学习摘要/u);
  assert.match(html, /累计练习 7 分钟/u);
  assert.match(html, /已完成 1 次/u);
  assert.match(html, /两位数加法与进位/u);
  assert.match(html, /教师已接手 1 条练习记录/u);
  assert.match(html, /来源：本机学习记录/u);
  assert.match(html, /更新时间：/u);
  assert.doesNotMatch(html, /session-synthetic|238 \+ 165|visibleHint|needsTeacherFollowUp/u);
});
