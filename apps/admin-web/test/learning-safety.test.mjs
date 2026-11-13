/* global Response */
import assert from "node:assert/strict";
import test from "node:test";
import {
  LearningSafetyAdminClient,
  renderLearningSafety,
} from "../src/local-review/learning-safety.ts";

test("platform learning safety view renders anonymous totals only", () => {
  const html = renderLearningSafety({
    status: "READY",
    message: "仅显示匿名安全汇总。",
    summary: {
      metricVersion: "LEARNING_SAFETY_V2",
      totalSessions: 8,
      activeSessions: 2,
      completedSessions: 3,
      closedSessions: 1,
      expiredSessions: 2,
      hintRequests: 5,
      teacherFollowUps: 1,
      refusedActions: 2,
      teacherHandoffs: 1,
      fixedGuidanceSessions: 8,
      firstAttemptSuccesses: 2,
      hintAssistedSuccesses: 3,
      mainAnswerAttempts: 12,
      consolidationAnswered: 6,
      consolidationCorrect: 5,
      postHintAnswerRate: { numerator: 2, denominator: 4, percent: 50 },
      consolidationCompletionRate: { numerator: 6, denominator: 8, percent: 75 },
      teacherInterventionRate: { numerator: 1, denominator: 8, percent: 12.5 },
      answerErrorRate: { numerator: 3, denominator: 15, percent: 20 },
      severeSafetyEvents: 0,
    },
  });

  assert.match(html, /匿名安全汇总/u);
  assert.match(html, /指标口径：V2（本机合成数据）/u);
  assert.match(html, /学习会话总数[\s\S]*8/u);
  assert.match(html, /需教师跟进[\s\S]*1/u);
  assert.match(html, /拒绝操作次数[\s\S]*2/u);
  assert.match(html, /教师接手次数[\s\S]*1/u);
  assert.match(html, /固定题库指导会话[\s\S]*8/u);
  assert.match(html, /首次作答正确会话[\s\S]*2/u);
  assert.match(html, /提示后完成主问题[\s\S]*3/u);
  assert.match(html, /主问题作答总次数[\s\S]*12/u);
  assert.match(html, /巩固题作答数[\s\S]*6/u);
  assert.match(html, /巩固题答对数[\s\S]*5/u);
  assert.match(html, /提示后继续作答率[\s\S]*2 \/ 4（50\.0%）/u);
  assert.match(html, /同类巩固题完成率[\s\S]*6 \/ 8（75\.0%）/u);
  assert.match(html, /教师实际介入率[\s\S]*1 \/ 8（12\.5%）/u);
  assert.match(html, /作答错误率[\s\S]*3 \/ 15（20\.0%）/u);
  assert.match(html, /明确记录的严重安全事件[\s\S]*0/u);
  assert.match(html, /不代表独立学生人数/u);
  assert.doesNotMatch(html, /学生姓名|studentId|班级名称|模拟学生甲|data-learning-session-id/u);
});

test("learning safety client rejects missing or unknown metric versions", async () => {
  const originalFetch = globalThis.fetch;
  const numericSummary = {
    totalSessions: 8,
    activeSessions: 2,
    completedSessions: 3,
    closedSessions: 1,
    expiredSessions: 2,
    hintRequests: 5,
    teacherFollowUps: 1,
    refusedActions: 2,
    teacherHandoffs: 1,
    fixedGuidanceSessions: 8,
    firstAttemptSuccesses: 2,
    hintAssistedSuccesses: 3,
    mainAnswerAttempts: 12,
    consolidationAnswered: 6,
    consolidationCorrect: 5,
    postHintAnswerRate: { numerator: 2, denominator: 4, percent: 50 },
    consolidationCompletionRate: { numerator: 6, denominator: 8, percent: 75 },
    teacherInterventionRate: { numerator: 1, denominator: 8, percent: 12.5 },
    answerErrorRate: { numerator: 3, denominator: 15, percent: 20 },
    severeSafetyEvents: 0,
  };

  try {
    for (const summary of [
      numericSummary,
      { ...numericSummary, severeSafetyEvents: undefined },
      { ...numericSummary, metricVersion: "LEARNING_SAFETY_V9" },
      { ...numericSummary, answerErrorRate: { numerator: 1, denominator: 2, percent: 100.1 } },
      { ...numericSummary, answerErrorRate: { numerator: 1, denominator: 2, percent: 49.9 } },
      { ...numericSummary, postHintAnswerRate: { numerator: -1, denominator: 2, percent: 0 } },
      { ...numericSummary, studentId: "synthetic-identity-must-not-be-accepted" },
    ]) {
      globalThis.fetch = async (input) => {
        const path = String(input);
        const payload =
          path === "/local/sessions"
            ? { handle: "x".repeat(43) }
            : path === "/local/session"
              ? { profile: "platform-admin", actions: ["learning:safety-summary"] }
              : summary;
        return new Response(JSON.stringify(payload), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      };

      const client = new LearningSafetyAdminClient();
      await client.connect();
      assert.equal(client.snapshot.status, "DENIED");
      assert.equal(client.snapshot.summary, null);
      assert.match(client.snapshot.message, /安全汇总格式无效/u);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("learning safety view labels zero-denominator ratios as having no sample", () => {
  const html = renderLearningSafety({
    status: "READY",
    message: "仅显示不含个人信息的汇总数字。",
    summary: {
      metricVersion: "LEARNING_SAFETY_V2",
      totalSessions: 0,
      activeSessions: 0,
      completedSessions: 0,
      closedSessions: 0,
      expiredSessions: 0,
      hintRequests: 0,
      teacherFollowUps: 0,
      refusedActions: 0,
      teacherHandoffs: 0,
      fixedGuidanceSessions: 0,
      firstAttemptSuccesses: 0,
      hintAssistedSuccesses: 0,
      mainAnswerAttempts: 0,
      consolidationAnswered: 0,
      consolidationCorrect: 0,
      postHintAnswerRate: { numerator: 0, denominator: 0, percent: null },
      consolidationCompletionRate: { numerator: 0, denominator: 0, percent: null },
      teacherInterventionRate: { numerator: 0, denominator: 0, percent: null },
      answerErrorRate: { numerator: 0, denominator: 0, percent: null },
      severeSafetyEvents: 0,
    },
  });

  assert.match(html, /提示后继续作答率[\s\S]*暂无样本/u);
  assert.match(html, /同类巩固题完成率[\s\S]*暂无样本/u);
  assert.match(html, /教师实际介入率[\s\S]*暂无样本/u);
  assert.match(html, /作答错误率[\s\S]*暂无样本/u);
});

test("learning safety view fails closed without exposing stale totals", () => {
  const html = renderLearningSafety({
    status: "DENIED",
    message: "当前角色无权查看汇总。",
    summary: null,
  });

  assert.match(html, /当前角色无权查看汇总/u);
  assert.doesNotMatch(html, /学习会话总数/u);
});
