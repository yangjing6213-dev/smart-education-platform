"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { ParentLearningSnapshot } from "../../../../local-synthetic/learning";
import { ParentLearningInviteClient } from "../../../../local-synthetic/parent-learning-invite-client";
import styles from "./learning-panel.module.css";

const initialSnapshot: ParentLearningSnapshot = {
  status: "CONNECTING",
  message: "正在确认邀请账号…",
  approvedStudents: [],
  knowledgeResources: [],
  sessions: [],
  activeSession: null,
  parentControls: [],
  parentSummary: [],
  parentSummaryUpdatedAt: null,
};

export function ParentLearningPanel() {
  const clientRef = useRef<ParentLearningInviteClient | null>(null);
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const client = new ParentLearningInviteClient({ baseUrl: window.location.origin });
    clientRef.current = client;
    let active = true;
    void client.connect().then(() => {
      if (active) setSnapshot(client.snapshot);
    });
    return () => {
      active = false;
      client.disconnect();
      clientRef.current = null;
    };
  }, []);

  const refresh = async () => {
    const client = clientRef.current;
    if (!client || busy) return;
    setBusy(true);
    await client.refresh();
    setSnapshot(client.snapshot);
    setBusy(false);
  };

  const saveControls = async (event: FormEvent<HTMLFormElement>, studentId: string) => {
    event.preventDefault();
    const client = clientRef.current;
    if (!client || busy) return;
    const values = new FormData(event.currentTarget);
    const maxDurationMinutes = Number(values.get("maxDurationMinutes"));
    const maxHintLevel = Number(values.get("maxHintLevel"));
    if (![5, 10, 15].includes(maxDurationMinutes) || ![0, 1, 2, 3].includes(maxHintLevel)) {
      setSnapshot({ ...client.snapshot, message: "请选择有效的学习时长和提示范围。" });
      return;
    }
    setBusy(true);
    await client.updateParentControls(studentId, {
      enabled: values.get("enabled") === "on",
      maxDurationMinutes: maxDurationMinutes as 5 | 10 | 15,
      maxHintLevel: maxHintLevel as 0 | 1 | 2 | 3,
    });
    setSnapshot(client.snapshot);
    setBusy(false);
  };

  const contactTeacher = async (studentId: string) => {
    const client = clientRef.current;
    if (!client || busy) return;
    setBusy(true);
    await client.contactTeacher(studentId);
    setSnapshot(client.snapshot);
    setBusy(false);
  };

  const connectAgain = async () => {
    const client = clientRef.current;
    if (!client || busy) return;
    setBusy(true);
    await client.connect();
    setSnapshot(client.snapshot);
    setBusy(false);
  };

  const summaries = snapshot.parentSummary ?? [];
  const controls = snapshot.parentControls ?? [];

  return (
    <section
      aria-label="家长学习服务"
      className={styles.panel}
      data-parent-learning-state={snapshot.status}
      data-parent-learning-ready={snapshot.status === "READY" ? "true" : "false"}
    >
      <div className={styles.toolbar}>
        <p className={styles.status} data-parent-status role="status" aria-live="polite">
          {snapshot.message}
        </p>
        <button className={styles.secondaryButton} disabled={busy} onClick={refresh} type="button">
          {busy ? "正在更新…" : "刷新摘要"}
        </button>
      </div>

      {snapshot.status === "DENIED" || snapshot.status === "DISCONNECTED" ? (
        <div className={styles.emptyState} role="alert">
          <strong>暂时无法读取学习摘要</strong>
          <p>请使用机构邀请账号重新登录。当前页面不会保留上次显示的孩子资料。</p>
          <a
            className={styles.primaryButton}
            data-parent-learning-login
            href="/web/login?next=%2Fweb%2Fparent%2Flearning"
          >
            前往邀请登录
          </a>
          <button
            className={styles.primaryButton}
            disabled={busy}
            onClick={connectAgain}
            type="button"
          >
            重新读取
          </button>
        </div>
      ) : snapshot.status !== "READY" ? (
        <p className={styles.emptyState}>正在载入已审核关系和摘要…</p>
      ) : snapshot.approvedStudents.length === 0 ? (
        <p className={styles.emptyState}>暂时没有已审核的学生关系。</p>
      ) : (
        <div className={styles.studentList}>
          {snapshot.approvedStudents.map((student) => {
            const summary = summaries.find((item) => item.studentId === student.studentId);
            const control = controls.find((item) => item.studentId === student.studentId);
            if (!control) return null;
            const durationId = `max-duration-${student.studentId}`;
            const hintId = `max-hint-${student.studentId}`;
            return (
              <article className={styles.studentCard} key={student.studentId}>
                <div className={styles.studentHeading}>
                  <div>
                    <p className={styles.studentClass}>{student.classLabel} · 已审核关系</p>
                    <h2>{student.studentLabel}</h2>
                  </div>
                  <span className={styles.approvedBadge}>家长可见</span>
                </div>

                <section aria-label={`${student.studentLabel}学习情况`} className={styles.summary}>
                  <h3>学习情况</h3>
                  {summary ? (
                    <>
                      <dl className={styles.metrics}>
                        <div>
                          <dt>累计练习</dt>
                          <dd>{summary.usedMinutes} 分钟</dd>
                        </div>
                        <div>
                          <dt>练习次数</dt>
                          <dd>{summary.sessionCount} 次</dd>
                        </div>
                        <div>
                          <dt>已完成</dt>
                          <dd>{summary.completedSessions} 次</dd>
                        </div>
                        <div>
                          <dt>需要教师关注</dt>
                          <dd>{summary.attentionCount} 项</dd>
                        </div>
                      </dl>
                      <ul className={styles.knowledgeList}>
                        {summary.knowledgePoints.map((point) => (
                          <li key={point.label}>
                            <span>{point.label}</span>
                            <span>
                              {point.completedSessions}/{point.sessionCount} 次完成
                            </span>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <p className={styles.muted}>暂无学习摘要。</p>
                  )}
                </section>

                <section
                  aria-label={`${student.studentLabel}学习监督设置`}
                  className={styles.controls}
                >
                  <h3>学习监督设置</h3>
                  <form
                    className={styles.controlsForm}
                    data-parent-controls-form
                    onSubmit={(event) => void saveControls(event, student.studentId)}
                  >
                    <label className={styles.toggle}>
                      <input defaultChecked={control.enabled} name="enabled" type="checkbox" />
                      <span>开启陪伴学习</span>
                    </label>
                    <label htmlFor={durationId}>单次最长时长</label>
                    <select
                      defaultValue={control.maxDurationMinutes}
                      id={durationId}
                      name="maxDurationMinutes"
                    >
                      <option value="5">5 分钟</option>
                      <option value="10">10 分钟</option>
                      <option value="15">15 分钟</option>
                    </select>
                    <label htmlFor={hintId}>最高提示层级</label>
                    <select defaultValue={control.maxHintLevel} id={hintId} name="maxHintLevel">
                      <option value="0">第 0 层</option>
                      <option value="1">第 1 层</option>
                      <option value="2">第 2 层</option>
                      <option value="3">第 3 层</option>
                    </select>
                    <button className={styles.primaryButton} disabled={busy} type="submit">
                      保存设置
                    </button>
                  </form>
                  <div className={styles.contactRow}>
                    <p>联系意向仅保存在本机，不会自动发送消息。</p>
                    <button
                      className={styles.secondaryButton}
                      data-parent-contact
                      disabled={busy || control.contactStatus === "RECORDED_LOCAL"}
                      onClick={() => void contactTeacher(student.studentId)}
                      type="button"
                    >
                      {control.contactStatus === "RECORDED_LOCAL" ? "已记录联系意向" : "联系教师"}
                    </button>
                  </div>
                </section>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
