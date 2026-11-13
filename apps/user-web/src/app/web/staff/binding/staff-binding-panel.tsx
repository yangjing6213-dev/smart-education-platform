"use client";

import { useEffect, useRef, useState } from "react";
import {
  StaffBindingClient,
  type StaffBindingSnapshot,
} from "../../../../local-synthetic/staff-binding-client";
import sharedStyles from "../../parent/binding/parent-binding-panel.module.css";
import styles from "../../parent/home/parent-home.module.css";
import workbenchStyles from "../workbench/staff-workbench.module.css";

const initial: StaffBindingSnapshot = {
  status: "BUSY",
  applications: [],
  message: "正在读取待审核申请…",
};

export function StaffBindingPanel() {
  const clientRef = useRef<StaffBindingClient | null>(null);
  const [snapshot, setSnapshot] = useState(initial);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let disposed = false;
    const client = new StaffBindingClient({ baseUrl: window.location.origin });
    clientRef.current = client;
    void client.refresh().then(() => {
      if (clientRef.current === client && !disposed) setSnapshot(client.snapshot);
    });
    return () => {
      disposed = true;
      if (clientRef.current === client) clientRef.current = null;
      client.disconnect();
    };
  }, []);

  const perform = async (action: (client: StaffBindingClient) => Promise<void>) => {
    const client = clientRef.current;
    if (!client || busy) return;
    setBusy(true);
    try {
      await action(client);
      if (clientRef.current === client) setSnapshot(client.snapshot);
    } finally {
      if (clientRef.current === client) setBusy(false);
    }
  };

  const refresh = () => void perform((client) => client.refresh());

  return (
    <section
      aria-labelledby="staff-binding-title"
      aria-busy={busy || snapshot.status === "BUSY"}
      className={styles.panel}
      data-staff-binding-state={snapshot.status}
    >
      <div className={styles.sectionHeading}>
        <p className={styles.kicker}>只显示你有权处理的申请</p>
        <h2 id="staff-binding-title">待审核关系申请</h2>
        <p>处理结果会同步到家长页面，申请版本不一致时需要先刷新。</p>
      </div>
      <div className={styles.toolbar}>
        <p className={styles.status} role="status" aria-live="polite">
          {snapshot.message}
        </p>
        <button
          className={`${sharedStyles.secondaryButton} ${styles.actionButton}`}
          data-staff-binding-refresh
          disabled={busy}
          onClick={refresh}
          type="button"
        >
          刷新申请
        </button>
      </div>
      {snapshot.status === "IDLE" ? (
        <div className={styles.stateCard} role="alert">
          <h3>请先登录</h3>
          <p>{snapshot.message}</p>
          <a href="/web/login?next=%2Fweb%2Fstaff%2Fbinding">使用受邀员工账号登录</a>
        </div>
      ) : snapshot.status === "DENIED" || snapshot.status === "ERROR" ? (
        <div className={styles.stateCard} role="alert">
          <h3>暂时无法读取审核申请</h3>
          <p>{snapshot.message}</p>
        </div>
      ) : snapshot.status !== "READY" ? (
        <p className={styles.stateCard}>正在读取当前校区的待审核申请…</p>
      ) : snapshot.applications.length === 0 ? (
        <p className={styles.stateCard}>当前校区没有待审核关系申请。</p>
      ) : (
        <div className={styles.recordList}>
          {snapshot.applications.map((application, index) => (
            <article
              className={styles.recordCard}
              data-staff-binding-application={index}
              data-application-status={application.status}
              key={application.id}
            >
              <div className={styles.recordHeading}>
                <h3>
                  {application.applicant_label} · {application.student_label}
                </h3>
                <span className={styles.receipt}>待审核</span>
              </div>
              <dl className={styles.details}>
                <div className={styles.detailItem}>
                  <dt>关系</dt>
                  <dd>监护人</dd>
                </div>
                <div className={styles.detailItem}>
                  <dt>提交时间</dt>
                  <dd>
                    <time dateTime={application.submitted_at}>{application.submitted_at}</time>
                  </dd>
                </div>
              </dl>
              <div className={workbenchStyles.actions}>
                <button
                  className={`${sharedStyles.primaryButton} ${styles.actionButton}`}
                  data-staff-binding-action="approve"
                  disabled={busy}
                  onClick={() =>
                    void perform((client) =>
                      client.review(application.id, application.version, "approve"),
                    )
                  }
                  type="button"
                >
                  批准关系
                </button>
                <button
                  className={`${sharedStyles.secondaryButton} ${styles.actionButton}`}
                  data-staff-binding-action="reject"
                  disabled={busy}
                  onClick={() =>
                    void perform((client) =>
                      client.review(application.id, application.version, "reject"),
                    )
                  }
                  type="button"
                >
                  退回申请
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
