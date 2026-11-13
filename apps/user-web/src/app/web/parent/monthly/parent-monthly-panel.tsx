"use client";

import { useEffect, useRef, useState } from "react";
import {
  ParentMonthlyInviteClient,
  type ParentMonthlyInviteSnapshot,
} from "../../../../local-synthetic/parent-monthly-invite-client";
import sharedStyles from "../binding/parent-binding-panel.module.css";
import styles from "../home/parent-home.module.css";
import formStyles from "../leave/leave-panel.module.css";

const initialSnapshot: ParentMonthlyInviteSnapshot = {
  status: "CONNECTING",
  monthlyFeedback: [],
  relationships: [],
  selectedRelationshipId: null,
  requiresLogin: false,
  message: "正在确认邀请账号及孩子关系…",
};
const labels = {
  learningParticipation: "学习参与",
  dailyHabits: "日常习惯",
  activityParticipation: "活动参与",
  familySchoolCollaboration: "家校协作",
} as const;
const fields = Object.keys(labels) as (keyof typeof labels)[];
const valueLabels = {
  KEEP_WATCHING: "保持关注",
  PROGRESSING: "已有进步",
  FOLLOW_UP: "需要跟进",
} as const;

export function ParentMonthlyPanel() {
  const clientRef = useRef<ParentMonthlyInviteClient | null>(null);
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  useEffect(() => {
    const client = new ParentMonthlyInviteClient({ baseUrl: window.location.origin });
    clientRef.current = client;
    void client.connect().then(() => {
      if (clientRef.current === client) setSnapshot(client.snapshot);
    });
    return () => {
      client.disconnect();
      if (clientRef.current === client) clientRef.current = null;
    };
  }, []);
  const busy = snapshot.status === "CONNECTING" || snapshot.status === "BUSY";
  async function perform(
    action: (client: ParentMonthlyInviteClient) => Promise<void>,
  ): Promise<void> {
    const client = clientRef.current;
    if (!client || busy) return;
    try {
      const pending = action(client);
      setSnapshot(client.snapshot);
      await pending;
      if (clientRef.current === client) setSnapshot(client.snapshot);
    } catch {
      if (clientRef.current !== client) return;
      client.disconnect();
      setSnapshot({
        ...initialSnapshot,
        status: "ERROR",
        message: "孩子月报暂不可用，请重新连接后查看。",
      });
    }
  }
  return (
    <section
      aria-labelledby="parent-monthly-title"
      aria-busy={busy}
      className={styles.panel}
      data-testid="parent-monthly-panel"
      data-parent-monthly-state={snapshot.status}
    >
      <div className={styles.sectionHeading}>
        <p className={styles.kicker}>一起回顾孩子的成长</p>
        <h2 id="parent-monthly-title">已发布的孩子月报</h2>
        <p>只显示当前已批准绑定孩子的个人摘要。来源或关系变化后，以重新审核发布的内容为准。</p>
      </div>
      <div className={styles.toolbar}>
        <p className={styles.status} role="status" aria-live="polite">
          {snapshot.message}
        </p>
        <button
          className={`${sharedStyles.secondaryButton} ${styles.actionButton}`}
          data-parent-monthly-refresh
          disabled={busy}
          onClick={() => void perform((client) => client.refresh())}
          type="button"
        >
          {busy
            ? "正在更新…"
            : snapshot.status === "DENIED" || snapshot.status === "ERROR"
              ? "重新连接"
              : "刷新月度反馈"}
        </button>
      </div>
      {snapshot.requiresLogin ? (
        <a
          className={sharedStyles.secondaryButton}
          href="/web/login?next=%2Fweb%2Fparent%2Fmonthly"
        >
          重新登录
        </a>
      ) : null}
      {snapshot.status === "DENIED" || snapshot.status === "ERROR" ? (
        <div className={styles.stateCard} role="alert">
          <h3>暂时无法查看孩子月报</h3>
          <p>之前显示的孩子和摘要已清除，请重新连接读取当前允许查看的内容。</p>
        </div>
      ) : snapshot.status !== "READY" ? (
        <p className={styles.stateCard}>正在读取已发布的孩子月报…</p>
      ) : !snapshot.relationships.length ? (
        <div className={styles.stateCard}>
          <p>当前没有已批准的孩子关系。</p>
          <a href="/web/parent/binding">前往关系绑定与授权</a>
        </div>
      ) : (
        <>
          <div className={formStyles.fields}>
            <label>
              选择孩子
              <select
                name="studentId"
                value={snapshot.selectedRelationshipId ?? ""}
                disabled={busy}
                onChange={(event) =>
                  void perform((client) => client.selectRelationship(event.target.value))
                }
              >
                {snapshot.relationships.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {!snapshot.monthlyFeedback.length ? (
            <p className={styles.stateCard}>这个孩子当前没有已发布的月报。</p>
          ) : (
            <div className={styles.recordList}>
              {snapshot.monthlyFeedback.map((row) => (
                <article
                  className={styles.recordCard}
                  data-parent-monthly-row
                  data-month={row.month}
                  data-monthly-status="PUBLISHED"
                  data-acknowledged={row.acknowledged}
                  key={row.id}
                >
                  <div className={styles.recordHeading}>
                    <h3>
                      {row.studentLabel} · <time dateTime={row.month}>{row.month}</time> 月度反馈
                    </h3>
                    <span className={styles.receipt}>已发布</span>
                  </div>
                  <dl className={styles.details}>
                    {fields.map((field) => (
                      <div className={styles.detailItem} key={field}>
                        <dt>{labels[field]}</dt>
                        <dd>{valueLabels[row.supplements[field]]}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className={styles.summary}>
                    本月汇总成长记录 {row.sourceCounts.GROWTH_RECORD} 条、考勤概览{" "}
                    {row.sourceCounts.ATTENDANCE_OVERVIEW} 条。
                  </p>
                  {row.acknowledged ? (
                    <p className={styles.acknowledged}>已确认知悉</p>
                  ) : (
                    <div
                      className={styles.toolbar}
                      style={{ justifyContent: "center", justifySelf: "stretch" }}
                    >
                      <button
                        className={`${sharedStyles.primaryButton} ${styles.actionButton}`}
                        data-parent-monthly-action="ack"
                        data-parent-monthly-ack
                        disabled={busy}
                        onClick={() => void perform((client) => client.acknowledge(row.id))}
                        type="button"
                      >
                        确认知悉
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
