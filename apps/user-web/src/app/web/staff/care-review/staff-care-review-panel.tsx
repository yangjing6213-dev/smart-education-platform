"use client";

import { useEffect, useRef, useState } from "react";
import {
  InviteStaffCareClient,
  type InviteStaffCareRecord,
  type InviteStaffCareSnapshot,
} from "../../../../local-synthetic/invite-staff-care-client.js";
import { CARE_RECORD_OPTIONS } from "../../../../pages/care-record-workflow.js";
import sharedStyles from "../../parent/binding/parent-binding-panel.module.css";
import styles from "../../parent/home/parent-home.module.css";
import formStyles from "../../parent/leave/leave-panel.module.css";

const initialSnapshot: InviteStaffCareSnapshot = {
  status: "CONNECTING",
  records: [],
  students: [],
  message: "正在核对负责人身份…",
};
const errorSnapshot: InviteStaffCareSnapshot = {
  ...initialSnapshot,
  status: "ERROR",
  message: "成长记录审核暂时不可用，请重新连接。",
};
const detailFields = [
  ["arrival", "到离状态"],
  ["homework", "作业整理"],
  ["meal", "餐食情况"],
  ["rest", "午休情况"],
  ["activity", "活动参与"],
  ["wellbeing", "一般状态"],
] as const;
const statusLabels = {
  DRAFT: "草稿",
  SUBMITTED: "待审核",
  CONFIRMED: "审核已通过",
  RETURNED: "已退回员工修改",
  CANCELLED: "已撤回",
  EXCEPTION_PENDING: "待进一步复核",
} as const;
type Connection = { client: InviteStaffCareClient; busy: boolean };

function createConnection(): Connection {
  return {
    client: new InviteStaffCareClient({ baseUrl: window.location.origin, loadStudents: false }),
    busy: false,
  };
}

function visibleSnapshot(client: InviteStaffCareClient): InviteStaffCareSnapshot {
  return client.snapshot;
}

function reviewRows(records: readonly InviteStaffCareRecord[]): InviteStaffCareRecord[] {
  return records.filter((record) => record.status !== "DRAFT" && record.status !== "CANCELLED");
}

export function StaffCareReviewPanel() {
  const clientRef = useRef<Connection | null>(null);
  const [snapshot, setSnapshot] = useState(initialSnapshot);

  useEffect(() => {
    let disposed = false;
    const connect = async () => {
      let current: Connection | null = null;
      try {
        current = createConnection();
        current.busy = true;
        clientRef.current = current;
        await current.client.restore();
        if (!disposed && clientRef.current === current)
          setSnapshot(visibleSnapshot(current.client));
      } catch {
        if (disposed || (current && clientRef.current !== current)) return;
        current?.client.disconnect();
        setSnapshot(errorSnapshot);
      } finally {
        if (current && clientRef.current === current) current.busy = false;
      }
    };
    void connect();
    return () => {
      disposed = true;
      const current = clientRef.current;
      clientRef.current = null;
      current?.client.disconnect();
    };
  }, []);

  const perform = async (action: (client: InviteStaffCareClient) => Promise<void>) => {
    let current = clientRef.current;
    if (current?.busy) return;
    try {
      if (!current) {
        current = createConnection();
        clientRef.current = current;
      }
      current.busy = true;
      setSnapshot({ ...initialSnapshot, status: "BUSY", message: "正在更新审核状态…" });
      await action(current.client);
      if (clientRef.current === current) setSnapshot(visibleSnapshot(current.client));
    } catch {
      if (current && clientRef.current !== current) return;
      current?.client.disconnect();
      setSnapshot(errorSnapshot);
    } finally {
      if (current && clientRef.current === current) current.busy = false;
    }
  };

  const busy = snapshot.status === "CONNECTING" || snapshot.status === "BUSY";
  const unavailable = snapshot.status === "ERROR" || snapshot.status === "DENIED";
  const rows = reviewRows(snapshot.records);

  return (
    <section
      aria-labelledby="care-review-title"
      aria-busy={busy}
      className={styles.panel}
      data-care-review-state={snapshot.status}
    >
      <div className={styles.sectionHeading}>
        <p className={styles.kicker}>复核并发布</p>
        <h2 id="care-review-title">待审核与待发布</h2>
        <p>审核通过后，家长还看不到记录；点击“发布给家长”后，记录才会出现在家长首页。</p>
      </div>
      <div className={styles.toolbar}>
        <p className={styles.status} role="status" aria-live="polite">
          {snapshot.message}
        </p>
        <button
          className={`${sharedStyles.secondaryButton} ${styles.actionButton}`}
          data-care-review-refresh
          disabled={busy}
          onClick={() =>
            void perform((client) =>
              client.snapshot.status === "READY" ? client.refresh() : client.restore(),
            )
          }
          type="button"
        >
          {busy ? "正在更新…" : unavailable || snapshot.status === "IDLE" ? "重新连接" : "刷新记录"}
        </button>
      </div>

      {snapshot.status === "IDLE" ? (
        <div className={styles.stateCard} role="alert">
          <h3>请先登录</h3>
          <p>{snapshot.message}</p>
          <a href="/web/login?next=%2Fweb%2Fstaff%2Fcare-review">使用负责人邀请账号登录</a>
        </div>
      ) : unavailable ? (
        <div className={styles.stateCard} role="alert">
          <h3>当前账号无法审核成长记录</h3>
          <p>记录内容已清除。请使用有审核权限的负责人账号重新连接。</p>
        </div>
      ) : snapshot.status !== "READY" ? (
        <p className={styles.stateCard} role="status">
          正在读取当前校区的审核记录…
        </p>
      ) : rows.length === 0 ? (
        <p className={styles.stateCard}>当前没有待审核或待发布的成长记录。</p>
      ) : (
        <div className={styles.recordList}>
          {rows.map((record) => {
            const canReview = record.status === "SUBMITTED" && record.actions.includes("review");
            const canPublish =
              record.status === "CONFIRMED" && !record.published && record.actions.includes("publish");
            return (
              <article
                className={styles.recordCard}
                data-care-review-row
                data-care-status={record.status}
                data-care-published={record.published}
                data-care-review-published={record.published ? "true" : undefined}
                key={record.id}
              >
                <div className={styles.recordHeading}>
                  <h3>{record.studentLabel}</h3>
                  <span className={styles.receipt}>{statusLabels[record.status]}</span>
                </div>
                <p className={styles.summary}>
                  <time dateTime={record.date}>{record.date}</time>
                  <span> · {record.classLabel}</span>
                  <span>{record.published ? " · 已发布给家长" : " · 尚未发布给家长"}</span>
                </p>
                <dl className={styles.details}>
                  {detailFields.map(([field, label]) => (
                    <div className={styles.detailItem} key={field}>
                      <dt>{label}</dt>
                      <dd>
                        {
                          CARE_RECORD_OPTIONS[field].find(
                            (option) => option.value === record.values[field],
                          )?.label
                        }
                      </dd>
                    </div>
                  ))}
                </dl>
                {canReview ? (
                  <div className={formStyles.actions}>
                    <button
                      className={`${sharedStyles.primaryButton} ${styles.actionButton}`}
                      data-care-review-action="confirm"
                      disabled={busy}
                      onClick={() => void perform((client) => client.review(record.id, record.version, "confirm"))}
                      type="button"
                    >
                      审核通过
                    </button>
                    <button
                      className={`${sharedStyles.secondaryButton} ${styles.actionButton}`}
                      data-care-review-action="return"
                      disabled={busy}
                      onClick={() => void perform((client) => client.review(record.id, record.version, "return"))}
                      type="button"
                    >
                      退回修改
                    </button>
                  </div>
                ) : canPublish ? (
                  <div className={formStyles.actions}>
                    <button
                      className={`${sharedStyles.primaryButton} ${styles.actionButton}`}
                      data-care-review-action="publish"
                      disabled={busy}
                      onClick={() => void perform((client) => client.publish(record.id, record.version))}
                      type="button"
                    >
                      发布给家长
                    </button>
                  </div>
                ) : record.status === "SUBMITTED" ? (
                  <p className={styles.summary}>这条记录由当前账号创建，需另一位负责人审核。</p>
                ) : record.status === "EXCEPTION_PENDING" ? (
                  <p className={styles.summary}>这条记录需要进一步人工复核，目前不能直接发布。</p>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
