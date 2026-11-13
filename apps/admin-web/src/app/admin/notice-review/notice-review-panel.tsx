"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  NoticeInviteClient,
  type AdminNotice,
  type NoticeInviteSnapshot,
} from "./notice-invite-client";

const STATUS_LABEL: Record<AdminNotice["status"], string> = {
  DRAFT: "草稿",
  SUBMITTED: "待审核",
  RETURNED: "已退回",
  APPROVED: "已审核，待发布",
  PUBLISHED: "已发布",
  REVOKED: "已撤回",
};

const INITIAL: NoticeInviteSnapshot = {
  status: "CHECKING",
  displayName: "",
  canPublish: false,
  canRevoke: false,
  notices: [],
  message: "正在确认邀请账号权限…",
};

function targetLabel(target: AdminNotice["target"]): string {
  return target === "CLASS" ? "班级通知" : "机构公告";
}

export function NoticeReviewPanel() {
  const client = useMemo(() => new NoticeInviteClient(), []);
  const [snapshot, setSnapshot] = useState(INITIAL);
  const [confirmed, setConfirmed] = useState(false);
  const busyRef = useRef(true);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    void client.connect().then(() => {
      if (!mountedRef.current) return;
      busyRef.current = false;
      setSnapshot(client.snapshot);
    });
    return () => {
      mountedRef.current = false;
      client.disconnect();
    };
  }, [client]);

  async function perform(action: () => Promise<void>, allowUnavailable = false) {
    if (busyRef.current || (!allowUnavailable && snapshot.status !== "READY")) return;
    busyRef.current = true;
    setConfirmed(false);
    setSnapshot({
      ...client.snapshot,
      status: "BUSY",
      notices: [],
      message: "正在更新通知…",
    });
    try {
      await action();
    } finally {
      if (mountedRef.current) {
        busyRef.current = false;
        setSnapshot(client.snapshot);
      }
    }
  }

  const busy = snapshot.status === "CHECKING" || snapshot.status === "BUSY";
  const ready = snapshot.status === "READY";

  function renderNotice(notice: AdminNotice) {
    return (
      <article className="notice-review-row" key={notice.id}>
        <div className="notice-review-row-heading">
          <h2>
            {notice.title} · {STATUS_LABEL[notice.status]}
          </h2>
          <span>第 {notice.version} 版</span>
        </div>
        <p className="notice-review-meta">{targetLabel(notice.target)}</p>
        <p className="notice-review-body">{notice.body}</p>
        {notice.status === "SUBMITTED" ? (
          <div className="notice-review-actions">
            <button
              className="notice-review-primary"
              disabled={busy || !confirmed}
              onClick={() =>
                void perform(() => client.review(notice.id, notice.version, "APPROVE"))
              }
              type="button"
            >
              审核通过
            </button>
            <button
              className="notice-review-secondary"
              disabled={busy || !confirmed}
              onClick={() =>
                void perform(() => client.review(notice.id, notice.version, "RETURN"))
              }
              type="button"
            >
              退回修改
            </button>
          </div>
        ) : null}
        {notice.status === "APPROVED" && snapshot.canPublish ? (
          <div className="notice-review-actions">
            <button
              className="notice-review-primary"
              disabled={busy || !confirmed}
              onClick={() => void perform(() => client.publish(notice.id, notice.version))}
              type="button"
            >
              发布给家长
            </button>
          </div>
        ) : null}
        {notice.status === "PUBLISHED" && snapshot.canRevoke ? (
          <div className="notice-review-actions">
            <button
              className="notice-review-secondary"
              disabled={busy || !confirmed}
              onClick={() => void perform(() => client.revoke(notice.id, notice.version))}
              type="button"
            >
              撤回发布
            </button>
          </div>
        ) : null}
      </article>
    );
  }

  return (
    <section
      aria-busy={busy}
      aria-labelledby="notice-review-title"
      className="notice-review"
      data-notice-review-state={snapshot.status}
    >
      <header className="notice-review-header">
        <p className="notice-review-eyebrow">机构管理 · 通知协作</p>
        <h1 id="notice-review-title">通知审核与发布</h1>
        <p>
          {snapshot.displayName
            ? `当前账号：${snapshot.displayName}。审核范围由服务端校区和班级权限确定。`
            : "使用机构发放的账号登录；审核范围由服务端校区和班级权限确定。"}
        </p>
        <p>审核通过和发布是两个步骤。家长打开页面后可查看并确认。</p>
      </header>

      <div className="notice-review-toolbar">
        <span>{ready ? snapshot.notices.length : 0} 条待处理通知</span>
        {ready || snapshot.status === "ERROR" || snapshot.status === "FORBIDDEN" ? (
          <button
            className="notice-review-secondary"
            disabled={busy}
            onClick={() =>
              void perform(
                () => (client.snapshot.status === "READY" ? client.refresh() : client.connect()),
                true,
              )
            }
            type="button"
          >
            {busy ? "正在刷新…" : ready ? "刷新通知" : "重新连接"}
          </button>
        ) : null}
      </div>

      <p aria-live="polite" className="notice-review-message" role="status">
        {snapshot.message}
      </p>

      {snapshot.status === "UNAUTHENTICATED" ? (
        <p className="notice-review-empty">
          <Link href="/admin/login?next=%2Fadmin%2Fnotice-review">前往管理端登录</Link>
        </p>
      ) : null}

      {ready ? (
        <label className="notice-review-confirm">
          <input
            checked={confirmed}
            disabled={busy}
            onChange={(event) => setConfirmed(event.currentTarget.checked)}
            type="checkbox"
          />
          我已确认：本次处理使用开发测试资料，不会向真实家长发送通知。
        </label>
      ) : null}

      {snapshot.status === "FORBIDDEN" ? (
        <p className="notice-review-empty">当前账号无权查看通知，通知内容已隐藏。</p>
      ) : null}

      <section aria-labelledby="notice-review-queue-title" className="notice-review-section">
        <div className="notice-review-section-heading">
          <h2 id="notice-review-queue-title">待处理通知</h2>
          <span>{ready ? snapshot.notices.length : 0}</span>
        </div>
        {ready && snapshot.notices.length > 0 ? (
          <div className="notice-review-list">{snapshot.notices.map(renderNotice)}</div>
        ) : (
          <p className="notice-review-empty">
            {snapshot.status === "CHECKING"
              ? "正在读取当前授权范围的通知…"
              : snapshot.status === "ERROR"
                ? "当前通知列表不可用，请刷新后重试。"
                : "当前授权范围暂无待处理通知。"}
          </p>
        )}
      </section>

      <p className="notice-review-footnote">
        仅使用开发测试资料；通知记录保存在当前本地演示服务中，不连接外部消息服务。
      </p>
    </section>
  );
}
