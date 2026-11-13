"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { CareRecordReviewClient, type CareRecordReviewSnapshot } from "./care-record-client";

const STATUS_LABEL: Record<CareRecordReviewSnapshot["records"][number]["status"], string> = {
  DRAFT: "草稿",
  SUBMITTED: "待审核",
  CONFIRMED: "已通过",
  RETURNED: "已退回",
  CANCELLED: "已撤回",
  EXCEPTION_PENDING: "待升级复核",
};

const VALUE_LABEL: Record<string, Record<string, string>> = {
  arrival: { ARRIVED_AS_PLANNED: "按计划到校", LATE: "迟到", ABSENT: "未到校" },
  homework: { COMPLETED: "已完成整理", IN_PROGRESS: "正在完成", NEEDS_SUPPORT: "需要协助" },
  meal: { FINISHED: "按示例完成用餐", PARTIAL: "部分用餐", NOT_RECORDED: "未记录" },
  rest: { RESTED: "完成休息", QUIET_ACTIVITY: "安静活动", NOT_RECORDED: "未记录" },
  activity: { PARTICIPATED: "参与活动", OBSERVED: "观察活动", NOT_RECORDED: "未记录" },
  wellbeing: { ROUTINE: "日常状态", CHECK_IN: "需要老师留意", FOLLOW_UP: "需要后续跟进" },
};

const INITIAL: CareRecordReviewSnapshot = {
  status: "CHECKING",
  displayName: "",
  records: [],
  message: "正在确认当前账号权限…",
};

export function CareRecordReviewPanel() {
  const client = useMemo(() => new CareRecordReviewClient(), []);
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
      records: [],
      message: "正在更新成长记录…",
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

  return (
    <section
      aria-busy={busy}
      aria-labelledby="care-record-review-title"
      className="care-record-review"
      data-care-review-state={snapshot.status}
    >
      <header className="care-record-review-header">
        <p className="care-record-review-eyebrow">机构管理 · 成长记录</p>
        <h1 id="care-record-review-title">成长记录审核与发布</h1>
        <p>
          {snapshot.displayName
            ? `当前账号：${snapshot.displayName}。审核范围由账号的校区权限确定。`
            : "审核范围由当前登录账号的校区权限确定。"}
        </p>
      </header>

      <div className="care-record-review-controls">
        {snapshot.status === "UNAUTHENTICATED" ? (
          <Link
            className="care-record-review-primary"
            href="/admin/login?next=%2Fadmin%2Fcare-record-review"
          >
            前往账号登录
          </Link>
        ) : null}
        {ready || snapshot.status === "ERROR" || snapshot.status === "FORBIDDEN" ? (
          <button
            className="care-record-review-secondary"
            disabled={busy}
            onClick={() =>
              void perform(
                () => (client.snapshot.status === "READY" ? client.refresh() : client.connect()),
                true,
              )
            }
            type="button"
          >
            {busy ? "正在更新…" : ready ? "刷新记录" : "重新连接"}
          </button>
        ) : null}
        {snapshot.status !== "UNAUTHENTICATED" && snapshot.status !== "CHECKING" ? (
          <button
            className="care-record-review-secondary"
            disabled={busy}
            onClick={() =>
              void perform(async () => {
                await client.logout();
                if (client.snapshot.status === "IDLE") window.location.assign("/admin/login");
              }, true)
            }
            type="button"
          >
            退出登录
          </button>
        ) : null}
      </div>

      <p aria-live="polite" className="care-record-review-message" role="status">
        {snapshot.message}
      </p>

      {snapshot.status === "FORBIDDEN" ? (
        <p className="care-record-review-empty">当前账号无权查看该审核范围，记录内容已隐藏。</p>
      ) : null}

      {ready ? (
        <label className="care-record-review-confirm">
          <input
            checked={confirmed}
            disabled={busy}
            onChange={(event) => setConfirmed(event.currentTarget.checked)}
            type="checkbox"
            data-care-review-confirm
          />
          我已核对当前账号范围和记录内容。
        </label>
      ) : null}

      {ready ? (
        <dl aria-label="成长记录状态统计" className="care-record-review-counts">
          {Object.entries(STATUS_LABEL).map(([status, label]) => (
            <div key={status}>
              <dt>{label}</dt>
              <dd>{snapshot.records.filter((record) => record.status === status).length}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {ready && snapshot.records.length === 0 ? (
        <p className="care-record-review-empty">当前账号权限范围内没有可查看的成长记录。</p>
      ) : null}

      <ul className="care-record-review-list">
        {ready
          ? snapshot.records.map((record, index) => (
              <li className="care-record-review-row" data-care-review-row={index} key={record.id}>
                <div className="care-record-review-row-heading">
                  <h2>
                    {record.studentLabel} · {record.classLabel} · {record.date} · 成长记录
                  </h2>
                  <span>
                    {STATUS_LABEL[record.status]} · 第 {record.version} 版
                    {record.published ? " · 已发布给家长" : ""}
                  </span>
                </div>
                <p className="care-record-review-summary">
                  {Object.entries(record.values)
                    .map(([field, value]) => VALUE_LABEL[field]?.[value] ?? "待核对")
                    .join(" · ")}
                </p>
                {record.actions.includes("review") ? (
                  <div className="care-record-review-actions">
                    <button
                      className="care-record-review-primary"
                      disabled={busy || !confirmed}
                      onClick={() => {
                        void perform(() => client.review(record.id, record.version, "confirm"));
                      }}
                      type="button"
                    >
                      审核通过
                    </button>
                    <button
                      className="care-record-review-secondary"
                      disabled={busy || !confirmed}
                      onClick={() => {
                        void perform(() => client.review(record.id, record.version, "return"));
                      }}
                      type="button"
                    >
                      退回修改
                    </button>
                  </div>
                ) : null}
                {record.actions.includes("publish") ? (
                  <div className="care-record-review-actions">
                    <button
                      className="care-record-review-primary"
                      disabled={busy || !confirmed}
                      onClick={() => {
                        void perform(() => client.publish(record.id, record.version));
                      }}
                      type="button"
                    >
                      发布给家长
                    </button>
                  </div>
                ) : null}
                {record.actions.includes("revoke-publication") ? (
                  <div className="care-record-review-actions">
                    <button
                      className="care-record-review-secondary"
                      data-care-record-action="revoke-publication"
                      disabled={busy || !confirmed}
                      onClick={() => {
                        if (
                          !window.confirm(
                            "撤销后家长将立即无法查看这条成长记录；重新发布后家长需要重新查看确认。确定撤销吗？",
                          )
                        )
                          return;
                        void perform(() => client.revokePublication(record.id, record.version));
                      }}
                      type="button"
                    >
                      撤销发布
                    </button>
                  </div>
                ) : null}
              </li>
            ))
          : null}
      </ul>

      <p className="care-record-review-footnote">
        只有审核通过并单独发布的记录会显示给已绑定的家长；记录范围由服务端校区权限控制。
      </p>
    </section>
  );
}
