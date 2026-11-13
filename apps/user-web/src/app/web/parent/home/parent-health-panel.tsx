"use client";

import { useEffect, useRef, useState } from "react";
import {
  ParentHealthInviteClient,
  type ParentHealthInviteSnapshot,
} from "../../../../local-synthetic/parent-health-invite-client";
import sharedStyles from "../binding/parent-binding-panel.module.css";
import styles from "./parent-home.module.css";

const initialSnapshot: ParentHealthInviteSnapshot = {
  status: "CONNECTING",
  records: [],
  message: "正在确认邀请账号…",
};

const receiptLabels = {
  UNREAD: "尚未查看",
  READ: "已查看，等待确认知悉",
  ACKNOWLEDGED: "已确认知悉",
} as const;

export function ParentHealthPanel() {
  const clientRef = useRef<{
    client: ParentHealthInviteClient;
    busy: boolean;
  } | null>(null);
  const [snapshot, setSnapshot] = useState(initialSnapshot);

  useEffect(() => {
    const client = new ParentHealthInviteClient({
      baseUrl: window.location.origin,
    });
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

  const perform = async (
    action: (client: ParentHealthInviteClient) => Promise<void>,
  ) => {
    const current = clientRef.current;
    if (!current || current.busy) return;
    current.busy = true;
    setSnapshot({
      ...initialSnapshot,
      status: "BUSY",
      message: "正在更新健康跟进摘要…",
    });
    try {
      await action(current.client);
      if (clientRef.current === current) setSnapshot(current.client.snapshot);
    } catch {
      if (clientRef.current !== current) return;
      current.client.disconnect();
      setSnapshot({
        ...initialSnapshot,
        status: "ERROR",
        message: "健康摘要暂时无法读取，请使用邀请账号重新登录后再试。",
      });
    } finally {
      if (clientRef.current === current) current.busy = false;
    }
  };

  const busy = snapshot.status === "CONNECTING" || snapshot.status === "BUSY";
  const records = snapshot.records;

  return (
    <section
      aria-labelledby="parent-health-title"
      aria-busy={busy}
      className={styles.panel}
      data-parent-health-state={snapshot.status}
    >
      <div className={styles.sectionHeading}>
        <p className={styles.kicker}>一起关注日常状态</p>
        <h2 id="parent-health-title">健康跟进摘要</h2>
        <p>查看机构已发布给家长的摘要，阅读后可单独确认知悉。</p>
      </div>
      <div className={styles.toolbar}>
        <p className={styles.status} role="status" aria-live="polite">
          {snapshot.message}
        </p>
        <button
          className={`${sharedStyles.secondaryButton} ${styles.actionButton}`}
          data-parent-health-refresh
          disabled={busy}
          onClick={() =>
            void perform((client) =>
              client.snapshot.status === "READY"
                ? client.refresh()
                : client.connect(),
            )
          }
          type="button"
        >
          {busy
            ? "正在更新…"
            : snapshot.status === "ERROR" || snapshot.status === "DENIED"
              ? "重新读取"
              : "刷新健康摘要"}
        </button>
      </div>

      {snapshot.status === "ERROR" || snapshot.status === "DENIED" ? (
        <div className={styles.stateCard} role="alert">
          <h3>暂时无法读取健康跟进摘要</h3>
          <p>
            请使用家长邀请账号重新登录并确认关系状态。页面已隐藏之前显示的摘要。
          </p>
          <button
            className={`${sharedStyles.primaryButton} ${styles.actionButton}`}
            disabled={busy}
            onClick={() => void perform((client) => client.connect())}
            type="button"
          >
            重新读取
          </button>
        </div>
      ) : snapshot.status !== "READY" ? (
        <p className={styles.stateCard}>正在读取已发布的健康跟进摘要…</p>
      ) : records.length === 0 ? (
        <p className={styles.stateCard}>当前没有已发布的健康跟进摘要。</p>
      ) : (
        <div className={styles.recordList}>
          {records.map((record) => (
            <article
              className={styles.recordCard}
              data-parent-health-row
              data-record-id={record.id}
              data-receipt={record.receiptStatus}
              key={record.id}
            >
              <div className={styles.recordHeading}>
                <h3>{record.title}</h3>
                <span className={styles.receipt}>
                  {receiptLabels[record.receiptStatus]}
                </span>
              </div>
              <p className={styles.recordMeta}>
                <time dateTime={record.date}>{record.date}</time> · 已发布摘要
              </p>
              {record.receiptStatus === "UNREAD" ? (
                <>
                  <p className={styles.summary}>
                    有一条已发布的健康跟进摘要，打开后可查看内容。
                  </p>
                  <button
                    className={`${sharedStyles.primaryButton} ${styles.actionButton}`}
                    data-parent-health-action="read"
                    disabled={busy}
                    onClick={() =>
                      void perform((client) =>
                        client.receipt(record.id, record.version, "read"),
                      )
                    }
                    type="button"
                  >
                    查看摘要
                  </button>
                </>
              ) : (
                <>
                  <p className={styles.body}>{record.parentSummary}</p>
                  {record.receiptStatus === "READ" ? (
                    <button
                      className={`${sharedStyles.primaryButton} ${styles.actionButton}`}
                      data-parent-health-action="ack"
                      disabled={busy}
                      onClick={() =>
                        void perform((client) =>
                          client.receipt(record.id, record.version, "ack"),
                        )
                      }
                      type="button"
                    >
                      确认知悉
                    </button>
                  ) : (
                    <p className={styles.acknowledged}>
                      已确认知悉这条健康跟进摘要。
                    </p>
                  )}
                </>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
