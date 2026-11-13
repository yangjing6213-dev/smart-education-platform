"use client";

import { useEffect, useRef, useState } from "react";
import {
  STAFF_DAILY_REVIEW_FIELD_LABELS,
  STAFF_DAILY_REVIEW_OPTIONS,
} from "../../../local-review/staff-daily";
import Link from "next/link";
import {
  StaffDailyReviewClient,
  type StaffDailyAuditAction,
  type StaffDailyReviewAction,
  type StaffDailyReviewSnapshot,
} from "./staff-daily-review-client";
import styles from "./staff-daily-review.module.css";

type Field = keyof typeof STAFF_DAILY_REVIEW_OPTIONS;
const fields = Object.keys(STAFF_DAILY_REVIEW_OPTIONS) as Field[];
const statusLabels = {
  SUBMITTED: "待负责人审核",
  CONFIRMED: "已确认",
  RETURNED: "已退回修改",
} as const;
const auditActionLabels: Readonly<Record<StaffDailyAuditAction, string>> = {
  CREATED: "创建日报",
  EDITED: "修改日报",
  SUBMITTED: "提交审核",
  RESUBMITTED: "重新提交审核",
  REVIEW_CONFIRMED: "审核确认",
  REVIEW_RETURNED: "审核退回",
  CONFIRMATION_WITHDRAWN: "撤回审核确认",
  SOURCES_INVALIDATED: "来源变化，系统退回重核",
};
const initialSnapshot: StaffDailyReviewSnapshot = {
  status: "CONNECTING",
  session: null,
  rows: [],
  auditEvents: {},
  message: "正在连接审核队列…",
  error: null,
};

export function StaffDailyReviewPanel() {
  const clientRef = useRef<StaffDailyReviewClient | null>(null);
  const mounted = useRef(false);
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [expandedAuditId, setExpandedAuditId] = useState<string | null>(null);
  const busy = snapshot.status === "CONNECTING" || snapshot.status === "BUSY";

  useEffect(() => {
    mounted.current = true;
    const client = new StaffDailyReviewClient();
    clientRef.current = client;
    const connecting = client.connect();
    setSnapshot(client.snapshot);
    void connecting.finally(() => {
      if (mounted.current && clientRef.current === client) setSnapshot(client.snapshot);
    });
    return () => {
      mounted.current = false;
      client.disconnect();
      if (clientRef.current === client) clientRef.current = null;
    };
  }, []);

  function run(operation: (client: StaffDailyReviewClient) => Promise<void>): void {
    const client = clientRef.current;
    if (!client) return;
    const pending = operation(client);
    setSnapshot(client.snapshot);
    void pending.finally(() => {
      if (mounted.current && clientRef.current === client) setSnapshot(client.snapshot);
    });
  }

  return (
    <section
      className={styles.panel}
      data-staff-daily-review-panel
      data-staff-daily-review-state={snapshot.status}
      aria-labelledby="staff-daily-review-title"
    >
      <div className={styles.toolbar}>
        <div>
          <p className={styles.eyebrow}>负责人审核 · 授权校区和班级</p>
          <h2 id="staff-daily-review-title">待审核日报</h2>
          <p>只能审核其他员工提交的日报；审核确认后，员工可查看处理结果。</p>
        </div>
        {snapshot.status === "UNAUTHENTICATED" ? (
          <Link
            className={styles.secondaryButton}
            href="/admin/login?next=/admin/staff-daily-review"
            prefetch={false}
          >
            登录审核账号
          </Link>
        ) : snapshot.status === "FORBIDDEN" ? (
          <Link
            className={styles.secondaryButton}
            href="/admin/login?next=/admin/staff-daily-review"
            prefetch={false}
          >
            切换账号
          </Link>
        ) : snapshot.status === "ERROR" ? (
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={() => run((client) => client.connect())}
            data-staff-daily-review-reconnect
          >
            重新连接
          </button>
        ) : (
          <button
            className={styles.secondaryButton}
            type="button"
            disabled={busy || snapshot.status !== "READY"}
            onClick={() => run((client) => client.refresh())}
            data-staff-daily-review-refresh
          >
            刷新队列
          </button>
        )}
      </div>
      <p
        className={snapshot.error ? styles.error : styles.message}
        role={snapshot.error ? "alert" : "status"}
      >
        {snapshot.error ?? snapshot.message}
      </p>
      {snapshot.session ? (
        <p className={styles.scope}>
          当前审核身份：{snapshot.session.label} · 仅本校区及已授权班级
        </p>
      ) : null}
      {snapshot.rows.length ? (
        <div className={styles.list}>
          {snapshot.rows.map((row, index) => (
            <article
              className={styles.card}
              key={`${row.date}-${index}`}
              data-staff-daily-review-row={index}
            >
              <div className={styles.cardHeading}>
                <div>
                  <p className={styles.author}>提交人：{row.authorLabel}</p>
                  <h3>工作日报 · {row.date}</h3>
                </div>
                <span className={styles.badge} data-staff-daily-review-status={row.status}>
                  {statusLabels[row.status]} · 第 {row.version} 版
                </span>
              </div>
              <dl className={styles.details}>
                {fields.map((field) => {
                  const label =
                    STAFF_DAILY_REVIEW_OPTIONS[field].find(
                      ([code]) => code === row.values[field],
                    )?.[1] ?? "";
                  return (
                    <div key={field}>
                      <dt>{STAFF_DAILY_REVIEW_FIELD_LABELS[field]}</dt>
                      <dd>{label}</dd>
                    </div>
                  );
                })}
              </dl>
              <p className={styles.note}>
                来源分类：任务 {row.sourceCounts.TASK} · 考勤 {row.sourceCounts.ATTENDANCE} ·
                托管记录 {row.sourceCounts.CARE_RECORD} · 接送 {row.sourceCounts.PICKUP} · 异常{" "}
                {row.sourceCounts.PICKUP_EXCEPTION}
              </p>
              {row.learningSummary ? (
                <p className={styles.note}>
                  固定题学习摘要（本机合成）：2 人及以上完成练习；
                  {row.learningSummary.usedGuidance ? "使用过分步提示" : "未使用分步提示"}；
                  {row.learningSummary.needsTeacherFollowUp ? "有教师跟进提示" : "暂无教师跟进提示"}
                  。
                </p>
              ) : null}
              <div className={styles.actions}>
                {row.actions.map((code) => {
                  const action: StaffDailyReviewAction =
                    code === "confirm" ? "CONFIRM" : code === "return" ? "RETURN" : "WITHDRAW";
                  return (
                    <button
                      className={
                        action === "CONFIRM" ? styles.primaryButton : styles.secondaryButton
                      }
                      type="button"
                      key={action}
                      disabled={busy}
                      data-staff-daily-review-action={action}
                      onClick={() => run((client) => client.review(row.id, row.version, action))}
                    >
                      {action === "CONFIRM"
                        ? "确认日报"
                        : action === "RETURN"
                          ? "退回修改"
                          : "撤回确认"}
                    </button>
                  );
                })}
              </div>
              <div className={styles.auditActions}>
                <button
                  className={styles.secondaryButton}
                  type="button"
                  aria-expanded={expandedAuditId === row.id}
                  aria-controls={`staff-daily-audit-${row.id}`}
                  data-staff-daily-audit-toggle={row.id}
                  onClick={() => {
                    if (expandedAuditId === row.id) {
                      setExpandedAuditId(null);
                      return;
                    }
                    setExpandedAuditId(row.id);
                    if (snapshot.auditEvents[row.id]?.status !== "READY")
                      run((client) => client.loadAuditEvents(row.id));
                  }}
                >
                  {expandedAuditId === row.id ? "收起操作记录" : "查看操作记录"}
                </button>
              </div>
              {expandedAuditId === row.id ? (
                <div
                  className={styles.auditTrail}
                  id={`staff-daily-audit-${row.id}`}
                  data-staff-daily-audit-events={row.id}
                >
                  <h4>操作记录</h4>
                  {snapshot.auditEvents[row.id]?.status === "LOADING" ? (
                    <p role="status">正在读取操作记录…</p>
                  ) : snapshot.auditEvents[row.id]?.status === "ERROR" ? (
                    <p role="alert">{snapshot.auditEvents[row.id]?.error}</p>
                  ) : snapshot.auditEvents[row.id]?.status === "READY" &&
                    snapshot.auditEvents[row.id]?.events.length ? (
                    <ol>
                      {snapshot.auditEvents[row.id]?.events.map((event) => (
                        <li key={event.reportVersion}>
                          <strong>
                            {auditActionLabels[event.action]} · 第 {event.reportVersion} 版
                          </strong>
                          <span>
                            {event.actorLabel ?? `系统核验（由 ${event.initiatedByLabel} 触发）`}
                          </span>
                          <time dateTime={event.occurredAt}>
                            {new Date(event.occurredAt).toLocaleString("zh-CN")}
                          </time>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p>暂无操作记录。此功能启用前的操作不会补录。</p>
                  )}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : snapshot.status === "READY" ? (
        <p className={styles.empty}>当前授权范围没有待审核日报。</p>
      ) : null}
      <p className={styles.footnote}>
        页面只显示固定工作选项、来源分类数量和已批准的汇总提示；不会展示学生身份或练习明细。
      </p>
    </section>
  );
}
