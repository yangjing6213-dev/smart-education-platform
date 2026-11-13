"use client";

import { useEffect, useRef, useState } from "react";
import {
  ParentNoticesInviteClient,
  type ParentNoticesInviteSnapshot,
} from "../../../../local-synthetic/parent-notices-invite-client";
import sharedStyles from "../binding/parent-binding-panel.module.css";
import styles from "./parent-home.module.css";

const initialSnapshot: ParentNoticesInviteSnapshot = {
  status: "CONNECTING",
  notices: [],
  message: "正在连接本机通知服务…",
};

const receiptLabels = {
  UNREAD: "未阅读",
  READ: "已阅读，等待确认知悉",
  ACKNOWLEDGED: "已确认知悉",
} as const;

export function ParentNoticesPanel() {
  const clientRef = useRef<{ client: ParentNoticesInviteClient; busy: boolean } | null>(null);
  const [snapshot, setSnapshot] = useState(initialSnapshot);

  useEffect(() => {
    const client = new ParentNoticesInviteClient({ baseUrl: window.location.origin });
    const current = { client, busy: true };
    clientRef.current = current;
    void client.connect().then(() => {
      if (clientRef.current !== current) return;
      current.busy = false;
      setSnapshot(client.snapshot);
    });
    return () => {
      client.disconnect();
      if (clientRef.current === current) clientRef.current = null;
    };
  }, []);

  const perform = async (action: (client: ParentNoticesInviteClient) => Promise<void>) => {
    const current = clientRef.current;
    if (!current || current.busy) return;
    current.busy = true;
    setSnapshot({ ...initialSnapshot, status: "BUSY", message: "正在更新通知…" });
    try {
      await action(current.client);
      if (clientRef.current === current) setSnapshot(current.client.snapshot);
    } catch {
      if (clientRef.current !== current) return;
      current.client.disconnect();
      setSnapshot({
        ...initialSnapshot,
        status: "ERROR",
        message: "本机通知服务暂不可用，请重新连接。",
      });
    } finally {
      if (clientRef.current === current) current.busy = false;
    }
  };

  const busy = snapshot.status === "CONNECTING" || snapshot.status === "BUSY";
  const unavailable = snapshot.status === "ERROR" || snapshot.status === "DENIED";

  return (
    <section
      aria-labelledby="parent-notices-title"
      aria-busy={busy}
      className={styles.panel}
      data-parent-notices-state={snapshot.status}
    >
      <div className={styles.sectionHeading}>
        <p className={styles.kicker}>与机构保持联系</p>
        <h2 id="parent-notices-title">通知与确认</h2>
        <p>仅显示当前关系范围内已发布的通知，阅读与确认知悉分开记录。</p>
      </div>
      <div className={styles.toolbar}>
        <p className={styles.status} role="status" aria-live="polite">
          {snapshot.message}
        </p>
        <button
          className={`${sharedStyles.secondaryButton} ${styles.actionButton}`}
          data-parent-notices-refresh
          disabled={busy}
          onClick={() =>
            void perform((client) =>
              client.snapshot.status === "READY" ? client.refresh() : client.connect(),
            )
          }
          type="button"
        >
          {busy ? "正在更新…" : unavailable ? "重新连接" : "刷新通知"}
        </button>
      </div>

      {unavailable ? (
        <div className={styles.stateCard} role="alert">
          <h3>{snapshot.status === "DENIED" ? "暂时无法查看通知" : "暂时无法连接通知服务"}</h3>
          <p>
            {snapshot.status === "DENIED"
              ? "当前关系或权限不允许查看，页面已清除之前显示的通知。"
              : "请确认本机服务正在运行，再重新连接读取通知。"}
          </p>
          <button
            className={`${sharedStyles.primaryButton} ${styles.actionButton}`}
            disabled={busy}
            onClick={() => void perform((client) => client.connect())}
            type="button"
          >
            重新连接
          </button>
        </div>
      ) : snapshot.status !== "READY" ? (
        <p className={styles.stateCard}>正在读取已发布的通知…</p>
      ) : snapshot.notices.length === 0 ? (
        <p className={styles.stateCard}>当前没有已发布的通知。</p>
      ) : (
        <div className={styles.recordList}>
          {snapshot.notices.map((notice) => (
            <article
              className={styles.recordCard}
              data-parent-notice-row
              data-record-id={notice.id}
              data-receipt={notice.receiptStatus}
              key={notice.id}
            >
              <div className={styles.recordHeading}>
                <h3>{notice.title}</h3>
                <span className={styles.receipt}>{receiptLabels[notice.receiptStatus]}</span>
              </div>
              <p className={styles.recordMeta}>
                {notice.target === "CLASS" ? "班级通知" : "机构通知"}
              </p>
              <p className={styles.body}>{notice.body}</p>
              {notice.receiptStatus === "UNREAD" ? (
                <button
                  className={`${sharedStyles.primaryButton} ${styles.actionButton}`}
                  data-parent-notice-action="read"
                  disabled={busy}
                  onClick={() =>
                    void perform((client) => client.receipt(notice.id, notice.version, "read"))
                  }
                  type="button"
                >
                  阅读通知
                </button>
              ) : notice.receiptStatus === "READ" ? (
                <button
                  className={`${sharedStyles.primaryButton} ${styles.actionButton}`}
                  data-parent-notice-action="ack"
                  disabled={busy}
                  onClick={() =>
                    void perform((client) => client.receipt(notice.id, notice.version, "ack"))
                  }
                  type="button"
                >
                  确认知悉
                </button>
              ) : (
                <p className={styles.acknowledged}>已确认知悉这条通知。</p>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
