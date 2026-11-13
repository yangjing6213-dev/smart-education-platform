"use client";

import { useMemo, useState } from "react";
import { AuditLogsPage, type AuditLogEventViewModel } from "../../../pages/audit-logs";
import styles from "./audit-logs-panel.module.css";

const SYNTHETIC_SCOPE = {
  tenantId: "tenant-synthetic-a",
  campusId: "campus-synthetic-east",
} as const;

const SYNTHETIC_EVENTS: readonly AuditLogEventViewModel[] = [
  {
    event_id: "audit-event-synthetic-001",
    actor_id: "00000000-0000-4000-8000-000000000003",
    tenant_id: "tenant-synthetic-a",
    campus_id: "campus-synthetic-east",
    action: "CONTENT_PUBLISHED",
    target_type: "HOME_CONTENT",
    target_id: "synthetic-home-announcement",
    occurred_at: "2026-10-16T08:00:00+08:00",
    correlation_id: "correlation-synthetic-audit-001",
    trace_id: "trace-synthetic-audit-001",
    metadata: {
      result: "SUCCESS",
      channel: "ADMIN_WEB",
      synthetic_reference: "synthetic-audit-001",
    },
    synthetic_data: true,
  },
  {
    event_id: "audit-event-synthetic-002",
    actor_id: "00000000-0000-4000-8000-000000000003",
    tenant_id: "tenant-synthetic-a",
    campus_id: "campus-synthetic-east",
    action: "CONTENT_DRAFT_UPDATED",
    target_type: "HOME_CONTENT",
    target_id: "synthetic-home-draft",
    occurred_at: "2026-10-16T07:20:00+08:00",
    correlation_id: "correlation-synthetic-audit-002",
    trace_id: "trace-synthetic-audit-002",
    metadata: {
      result: "SUCCESS",
      channel: "ADMIN_WEB",
      synthetic_reference: "synthetic-audit-002",
    },
    synthetic_data: true,
  },
  {
    event_id: "audit-event-synthetic-003",
    actor_id: "00000000-0000-4000-8000-000000000003",
    tenant_id: "tenant-synthetic-a",
    campus_id: "campus-synthetic-east",
    action: "CONTENT_DRAFT_CREATED",
    target_type: "HOME_CONTENT",
    target_id: "synthetic-home-notice",
    occurred_at: "2026-10-15T15:40:00+08:00",
    correlation_id: "correlation-synthetic-audit-003",
    trace_id: "trace-synthetic-audit-003",
    metadata: {
      result: "SUCCESS",
      channel: "ADMIN_WEB",
      synthetic_reference: "synthetic-audit-003",
    },
    synthetic_data: true,
  },
  {
    event_id: "audit-event-synthetic-004",
    actor_id: "00000000-0000-4000-8000-000000000003",
    tenant_id: "tenant-synthetic-a",
    campus_id: "campus-synthetic-east",
    action: "CONTENT_UNPUBLISHED",
    target_type: "PUBLIC_TEACHER",
    target_id: "synthetic-teacher-profile",
    occurred_at: "2026-10-14T14:10:00+08:00",
    correlation_id: "correlation-synthetic-audit-004",
    trace_id: "trace-synthetic-audit-004",
    metadata: {
      result: "SUCCESS",
      channel: "ADMIN_WEB",
      synthetic_reference: "synthetic-audit-004",
    },
    synthetic_data: true,
  },
  {
    event_id: "audit-event-synthetic-005",
    actor_id: "00000000-0000-4000-8000-000000000003",
    tenant_id: "tenant-synthetic-a",
    campus_id: "campus-synthetic-east",
    action: "FILE_INTENT_CREATED",
    target_type: "MEDIA_ASSET",
    target_id: "synthetic-file-intent",
    occurred_at: "2026-10-14T09:10:00+08:00",
    correlation_id: "correlation-synthetic-audit-005",
    trace_id: "trace-synthetic-audit-005",
    metadata: {
      result: "SUCCESS",
      channel: "ADMIN_WEB",
      synthetic_reference: "synthetic-audit-005",
    },
    synthetic_data: true,
  },
  {
    event_id: "audit-event-synthetic-006",
    actor_id: "00000000-0000-4000-8000-000000000003",
    tenant_id: "tenant-synthetic-a",
    campus_id: "campus-synthetic-east",
    action: "PARTNER_LINK_HANDOFF_CREATED",
    target_type: "PARTNER_LINK",
    target_id: "synthetic-partner-handoff",
    occurred_at: "2026-10-13T10:00:00+08:00",
    correlation_id: "correlation-synthetic-audit-006",
    trace_id: "trace-synthetic-audit-006",
    metadata: {
      result: "SUCCESS",
      channel: "ADMIN_WEB",
      synthetic_reference: "synthetic-audit-006",
    },
    synthetic_data: true,
  },
];

const ACTION_LABEL: Readonly<Record<string, string>> = {
  CONTENT_DRAFT_CREATED: "新建内容草稿",
  CONTENT_DRAFT_UPDATED: "修改内容草稿",
  CONTENT_PUBLISHED: "发布内容",
  CONTENT_UNPUBLISHED: "下架内容",
  FILE_INTENT_CREATED: "发起素材查看申请",
  PARTNER_LINK_HANDOFF_CREATED: "创建合作服务跳转",
};

const TARGET_LABEL: Readonly<Record<string, string>> = {
  HOME_CONTENT: "首页内容",
  PUBLIC_TEACHER: "教师介绍",
  MEDIA_ASSET: "素材",
  PARTNER_LINK: "合作服务入口",
};

const ACTION_OPTIONS = [
  ["CONTENT_DRAFT_CREATED", "新建内容草稿"],
  ["CONTENT_DRAFT_UPDATED", "修改内容草稿"],
  ["CONTENT_PUBLISHED", "发布内容"],
  ["CONTENT_UNPUBLISHED", "下架内容"],
  ["FILE_INTENT_CREATED", "发起素材查看申请"],
  ["PARTNER_LINK_HANDOFF_CREATED", "创建合作服务跳转"],
] as const;

export function AuditLogsPanel() {
  const [actionFilter, setActionFilter] = useState("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const filteredEvents = useMemo(
    () =>
      SYNTHETIC_EVENTS.filter((event) => {
        const eventDate = event.occurred_at.slice(0, 10);
        return (
          (actionFilter === "ALL" || event.action === actionFilter) &&
          (!fromDate || eventDate >= fromDate) &&
          (!toDate || eventDate <= toDate)
        );
      }),
    [actionFilter, fromDate, toDate],
  );
  const view = AuditLogsPage({
    status: "READY",
    scope: SYNTHETIC_SCOPE,
    events: filteredEvents,
  });

  return (
    <section
      aria-labelledby="audit-logs-title"
      className={`pickup-review audit-logs ${styles.panel}`}
    >
      <header className="pickup-review-header">
        <p className="pickup-review-eyebrow">只读审计 · 本机合成样例</p>
        <h1 id="audit-logs-title">审计日志</h1>
        <p>仅查看模拟东校区的示例记录。这里不连接正式审计服务，也不展示操作人或对象编号。</p>
      </header>

      <div className={styles.summary} data-audit-log-summary role="status">
        <span>当前范围：模拟东校区</span>
        <strong>
          {view.summary.total} 条事件 · {view.summary.synthetic} 条合成记录
        </strong>
      </div>

      <form className={styles.filters} onSubmit={(event) => event.preventDefault()}>
        <label className={styles.control}>
          <span>操作类型</span>
          <select
            aria-label="操作类型"
            onChange={(event) => setActionFilter(event.currentTarget.value)}
            value={actionFilter}
          >
            <option value="ALL">全部操作</option>
            {ACTION_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.control}>
          <span>开始日期</span>
          <input
            aria-label="开始日期"
            onChange={(event) => setFromDate(event.currentTarget.value)}
            type="date"
            value={fromDate}
          />
        </label>
        <label className={styles.control}>
          <span>结束日期</span>
          <input
            aria-label="结束日期"
            onChange={(event) => setToDate(event.currentTarget.value)}
            type="date"
            value={toDate}
          />
        </label>
        <button
          className={styles.clearButton}
          onClick={() => {
            setActionFilter("ALL");
            setFromDate("");
            setToDate("");
          }}
          type="button"
        >
          清空筛选
        </button>
      </form>

      {view.rows.length ? (
        <ul aria-label="审计样例列表" className="audit-logs-list">
          {view.rows.map((row, index) => {
            const targetType = row.targetReference.split(":", 1)[0] ?? "";
            const result = row.metadata.result === "SUCCESS" ? "已完成" : "状态未知";
            return (
              <li className="audit-log-row" data-audit-log-row={index} key={row.eventId}>
                <div className="audit-log-heading">
                  <h2>{ACTION_LABEL[row.action] ?? "其他操作"}</h2>
                  <span>合成记录</span>
                </div>
                <dl className="audit-log-details">
                  <div>
                    <dt>发生时间</dt>
                    <dd>{row.occurredAt.slice(0, 16).replace("T", " ")}</dd>
                  </div>
                  <div>
                    <dt>对象类别</dt>
                    <dd>{TARGET_LABEL[targetType] ?? "其他对象"}</dd>
                  </div>
                  <div>
                    <dt>处理结果</dt>
                    <dd>{result}</dd>
                  </div>
                </dl>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="audit-logs-empty" role="status">
          没有符合条件的审计样例。
        </p>
      )}

      <p className="pickup-review-footnote">
        记录只用于本机界面演示，刷新页面后恢复初始样例；不作为真实审计凭据。
      </p>
    </section>
  );
}
