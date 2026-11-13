"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ChildMonthlyReviewClient,
  type ChildMonthlyReviewRow,
  type ChildMonthlyReviewSnapshot,
} from "./child-monthly-review-client";
import styles from "../monthly-feedback-review/monthly-feedback-review.module.css";

const STATUS_LABEL: Readonly<Record<ChildMonthlyReviewRow["status"], string>> = {
  DRAFT: "草稿",
  SUBMITTED: "待审核",
  RETURNED: "已退回",
  CONFIRMED: "已审核",
  PUBLISHED: "已发布给家长",
  REVIEW_REQUIRED: "来源变化，需复核",
};
const FIELD_LABELS = {
  learningParticipation: "学习参与",
  dailyHabits: "日常习惯",
  activityParticipation: "活动参与",
  familySchoolCollaboration: "家校协作",
} as const;
const VALUE_LABEL = {
  KEEP_WATCHING: "保持关注",
  PROGRESSING: "已有进步",
  FOLLOW_UP: "需要跟进",
} as const;
const SOURCE_LABELS = {
  GROWTH_RECORD: "已发布成长记录",
  ATTENDANCE_OVERVIEW: "已确认考勤概览",
} as const;
const initialSnapshot: ChildMonthlyReviewSnapshot = {
  status: "CONNECTING",
  session: null,
  rows: [],
  message: "正在连接孩子月报审核队列…",
  error: null,
};

export function ChildMonthlyReviewPanel() {
  const clientRef = useRef<ChildMonthlyReviewClient | null>(null);
  const mounted = useRef(false);
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const busy = snapshot.status === "CONNECTING" || snapshot.status === "BUSY";

  useEffect(() => {
    mounted.current = true;
    const client = new ChildMonthlyReviewClient();
    clientRef.current = client;
    const pending = client.connect();
    setSnapshot(client.snapshot);
    void pending.finally(() => {
      if (mounted.current && clientRef.current === client) setSnapshot(client.snapshot);
    });
    return () => {
      mounted.current = false;
      client.disconnect();
      if (clientRef.current === client) clientRef.current = null;
    };
  }, []);

  function run(operation: (client: ChildMonthlyReviewClient) => Promise<void>): void {
    const client = clientRef.current;
    if (!client) return;
    const pending = operation(client);
    setSnapshot(client.snapshot);
    void pending.finally(() => {
      if (mounted.current && clientRef.current === client) setSnapshot(client.snapshot);
    });
  }

  const ready = snapshot.status === "READY";
  return (
    <section
      aria-busy={busy}
      aria-labelledby="child-monthly-review-heading"
      className={styles.panel}
      data-child-monthly-review-state={snapshot.status}
    >
      <div className={styles.toolbar}>
        <div>
          <p className={styles.eyebrow}>负责人审核 · 仅当前授权范围</p>
          <h2 id="child-monthly-review-heading">孩子月报审核队列</h2>
          <p>按页面提供的操作处理记录；同一人不能审核或发布自己创建的月报。</p>
        </div>
        <div className={styles.toolbarActions}>
          {snapshot.status === "UNAUTHENTICATED" || snapshot.status === "FORBIDDEN" ? (
            <Link
              className={styles.secondaryButton}
              href="/admin/login?next=/admin/child-monthly-review"
              prefetch={false}
            >
              {snapshot.status === "UNAUTHENTICATED" ? "登录审核账号" : "切换账号"}
            </Link>
          ) : snapshot.status === "ERROR" ? (
            <button
              className={styles.primaryButton}
              type="button"
              onClick={() => run((client) => client.connect())}
            >
              重新连接
            </button>
          ) : (
            <button
              className={styles.secondaryButton}
              data-child-monthly-review-refresh="true"
              disabled={busy || !ready}
              onClick={() => run((client) => client.refresh())}
              type="button"
            >
              刷新队列
            </button>
          )}
        </div>
      </div>
      <p aria-live="polite" className={styles.feedback} role={snapshot.error ? "alert" : "status"}>
        {snapshot.error ?? snapshot.message}
      </p>
      {snapshot.session ? (
        <p className={styles.scope}>当前审核人：{snapshot.session.label} · 仅当前授权校区与班级</p>
      ) : null}
      <dl className={styles.counts}>
        {Object.entries(STATUS_LABEL).map(([status, label]) => (
          <div className={styles.count} key={status}>
            <dt>{label}</dt>
            <dd>{ready ? snapshot.rows.filter((row) => row.status === status).length : 0}</dd>
          </div>
        ))}
      </dl>
      {ready && snapshot.rows.length ? (
        <div className={styles.rows}>
          {snapshot.rows.map((row) => (
            <article
              className={styles.row}
              data-child-monthly-review-row="true"
              data-child-monthly-review-status={row.status}
              key={row.id}
            >
              <header className={styles.rowHeader}>
                <div>
                  <p className={styles.eyebrow}>
                    {row.month} 孩子月报 · 第 {row.version} 版
                  </p>
                  <h3>
                    {row.studentLabel} · {row.month}
                  </h3>
                  <p>班级：{row.classRef}</p>
                </div>
                <span className={styles.status}>{STATUS_LABEL[row.status]}</span>
              </header>
              <section className={styles.sourceSection}>
                <h4>来源数量 · 第 {row.sourceVersion} 版</h4>
                <ul>
                  {Object.entries(SOURCE_LABELS).map(([kind, label]) => (
                    <li key={kind}>
                      <span>{label}</span>
                      <span>{row.sourceCounts[kind as keyof typeof SOURCE_LABELS]} 条</span>
                    </li>
                  ))}
                </ul>
              </section>
              <dl className={styles.fields}>
                {Object.entries(FIELD_LABELS).map(([field, label]) => (
                  <div key={field}>
                    <dt>{label}</dt>
                    <dd>{VALUE_LABEL[row.supplements[field as keyof typeof FIELD_LABELS]]}</dd>
                  </div>
                ))}
              </dl>
              <div className={styles.rowActions}>
                {row.actions
                  .filter(
                    (action) => action === "confirm" || action === "return" || action === "publish",
                  )
                  .map((code) => {
                    const action =
                      code === "confirm" ? "CONFIRM" : code === "return" ? "RETURN" : "PUBLISH";
                    return (
                      <button
                        className={
                          code === "return" ? styles.secondaryButton : styles.primaryButton
                        }
                        disabled={busy}
                        key={code}
                        type="button"
                        data-child-monthly-review-action={code}
                        onClick={() => run((client) => client.review(row.id, row.version, action))}
                      >
                        {code === "confirm"
                          ? "确认月报"
                          : code === "return"
                            ? "退回修改"
                            : "发布给家长"}
                      </button>
                    );
                  })}
              </div>
            </article>
          ))}
        </div>
      ) : ready ? (
        <p className={styles.empty}>当前授权范围暂无孩子个人月报。</p>
      ) : null}
      <p className={styles.footnote}>
        审核与发布分开操作。只有发布后，获批绑定该孩子的家长才能查看；来源变化后需重新审核发布。
      </p>
    </section>
  );
}
