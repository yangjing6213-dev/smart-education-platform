"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LearningSafetyAdminClient,
  type LearningSafetySnapshot,
  type LearningSafetySummary,
} from "../../../local-review/learning-safety";
import styles from "./learning-safety.module.css";

function formatRate(
  metric: LearningSafetySummary["postHintAnswerRate"],
): string {
  return metric.percent === null
    ? "暂无样本"
    : `${metric.numerator} / ${metric.denominator}（${metric.percent.toFixed(1)}%）`;
}

function metrics(summary: LearningSafetySummary) {
  return [
    ["学习会话总数", summary.totalSessions],
    ["进行中", summary.activeSessions],
    ["已完成", summary.completedSessions],
    ["已关闭", summary.closedSessions],
    ["已超时", summary.expiredSessions],
    ["提示请求次数", summary.hintRequests],
    ["需教师跟进", summary.teacherFollowUps],
    ["拒绝操作次数", summary.refusedActions],
    ["教师接手次数", summary.teacherHandoffs],
    ["固定题库指导会话", summary.fixedGuidanceSessions],
    ["首次作答正确会话", summary.firstAttemptSuccesses],
    ["提示后完成主问题", summary.hintAssistedSuccesses],
    ["主问题作答总次数", summary.mainAnswerAttempts],
    ["巩固题作答数", summary.consolidationAnswered],
    ["巩固题答对数", summary.consolidationCorrect],
    ["提示后继续作答率", formatRate(summary.postHintAnswerRate)],
    ["同类巩固题完成率", formatRate(summary.consolidationCompletionRate)],
    ["教师实际介入率", formatRate(summary.teacherInterventionRate)],
    ["作答错误率", formatRate(summary.answerErrorRate)],
    ["明确记录的严重安全事件", summary.severeSafetyEvents],
  ] as const;
}

export function LearningSafetyPanel({
  baseUrl,
}: Readonly<{ baseUrl: string }>) {
  const client = useMemo(
    () =>
      new LearningSafetyAdminClient((input, init) =>
        fetch(new URL(String(input), baseUrl), init),
      ),
    [baseUrl],
  );
  const [snapshot, setSnapshot] = useState<LearningSafetySnapshot>(
    client.snapshot,
  );
  const load = useCallback(async () => {
    setSnapshot({
      status: "CONNECTING",
      message: "正在读取匿名安全汇总…",
      summary: null,
    });
    await client.connect();
    setSnapshot(client.snapshot);
  }, [client]);

  useEffect(() => {
    void load();
    return () => client.disconnect();
  }, [client, load]);

  const summary = snapshot.status === "READY" ? snapshot.summary : null;
  return (
    <section
      className={styles.panel}
      data-learning-safety
      data-learning-safety-state={snapshot.status}
      aria-label="匿名学习安全汇总"
    >
      <div className={styles.panelHeading}>
        <div>
          <h2>匿名安全汇总</h2>
          <p>只显示统计总量；不展示学生或学习记录明细。</p>
        </div>
        <button
          className={styles.refreshButton}
          type="button"
          disabled={snapshot.status === "CONNECTING"}
          onClick={() => void load()}
        >
          刷新汇总
        </button>
      </div>
      <p
        className={styles.status}
        role="status"
        aria-live="polite"
        data-learning-safety-status
      >
        {snapshot.message}
      </p>
      {summary ? (
        <>
          <p className={styles.version}>指标口径：V2（本机合成数据）</p>
          <div className={styles.grid} aria-label="匿名学习评测指标">
            {metrics(summary).map(([label, value]) => (
              <article
                className={styles.metric}
                data-learning-safety-metric
                key={label}
              >
                <span>{label}</span>
                <strong>{value}</strong>
              </article>
            ))}
          </div>
        </>
      ) : null}
      <p className={styles.note}>
        比率按分子和分母展示；分母为零时显示“暂无样本”。这些数据只反映本机固定题库演示，不证明真实学习效果或生产环境安全性。
      </p>
    </section>
  );
}
