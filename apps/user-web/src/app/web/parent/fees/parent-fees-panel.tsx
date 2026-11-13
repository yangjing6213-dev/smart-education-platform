"use client";

import { useEffect, useRef, useState } from "react";
import {
  ParentFeesInviteClient,
  type ParentFeesInviteSnapshot,
} from "../../../../local-synthetic/parent-fees-invite-client";
import sharedStyles from "../binding/parent-binding-panel.module.css";
import styles from "../home/parent-home.module.css";

const initialSnapshot: ParentFeesInviteSnapshot = {
  status: "CONNECTING",
  bindingStatus: "NONE",
  documents: [],
  ledger: null,
  message: "正在读取费用资料…",
};

const documentLabels = {
  FEE_ITEM: "收费项目",
  BILL: "账单",
  RECEIPT: "收据",
  AGREEMENT: "服务协议",
} as const;
const statusLabels = {
  AVAILABLE: "可查看",
  PAID: "已记录",
  VOIDED: "已作废",
  EXPIRED: "已过期",
  REVOKED: "已撤回",
} as const;
const ledgerLabels = { CHARGE: "收费记录", PAYMENT: "入账记录", REFUND: "退款记录" } as const;
const totalLabels = [
  ["chargeMinor", "收费"],
  ["paymentMinor", "入账"],
  ["refundMinor", "退款记录"],
  ["balanceDueMinor", "待核对差额"],
] as const;

export function ParentFeesPanel() {
  const clientRef = useRef<{ client: ParentFeesInviteClient; busy: boolean } | null>(null);
  const [snapshot, setSnapshot] = useState(initialSnapshot);

  useEffect(() => {
    const client = new ParentFeesInviteClient({ baseUrl: window.location.origin });
    const current = { client, busy: true };
    clientRef.current = current;
    void client.connect().then(() => {
      if (clientRef.current !== current) return;
      current.busy = false;
      setSnapshot(client.snapshot);
    });
    return () => {
      if (clientRef.current === current) clientRef.current = null;
      client.disconnect();
    };
  }, []);

  const refresh = async () => {
    const current = clientRef.current;
    if (!current || current.busy) return;
    current.busy = true;
    setSnapshot({ ...initialSnapshot, status: "BUSY", message: "正在更新费用资料…" });
    try {
      if (current.client.snapshot.status === "READY") await current.client.refresh();
      else await current.client.connect();
      if (clientRef.current === current) setSnapshot(current.client.snapshot);
    } catch {
      if (clientRef.current !== current) return;
      current.client.disconnect();
      setSnapshot({
        ...initialSnapshot,
        status: "ERROR",
        message: "费用资料暂不可用，请检查邀请账号或稍后重试。",
      });
    } finally {
      if (clientRef.current === current) current.busy = false;
    }
  };

  const busy = snapshot.status === "CONNECTING" || snapshot.status === "BUSY";

  return (
    <section
      aria-labelledby="parent-fees-title"
      aria-busy={busy}
      className={styles.panel}
      data-testid="parent-fees-panel"
      data-parent-fees-state={snapshot.status}
    >
      <div className={styles.sectionHeading}>
        <p className={styles.kicker}>清楚了解每一项记录</p>
        <h2 id="parent-fees-title">费用与流水</h2>
        <p>仅显示当前已审核关系内的资料，失效资料只显示不可查看的原因。</p>
      </div>
      <div className={styles.toolbar}>
        <p className={styles.status} role="status" aria-live="polite">
          {snapshot.message}
        </p>
        {snapshot.status === "SIGNED_OUT" ? (
          <a className={sharedStyles.backLink} href="/web/login?next=/web/parent/fees">
            登录并返回费用资料
          </a>
        ) : (
          <button
            className={`${sharedStyles.secondaryButton} ${styles.actionButton}`}
            data-parent-fees-refresh
            disabled={busy}
            onClick={() => void refresh()}
            type="button"
          >
            {busy
              ? "正在更新…"
              : snapshot.status === "ERROR"
                ? "重新连接"
                : snapshot.status === "DENIED"
                  ? "重新读取"
                  : "刷新费用"}
          </button>
        )}
      </div>

      {snapshot.status === "SIGNED_OUT" || snapshot.status === "ERROR" || snapshot.status === "DENIED" ? (
        <div className={styles.stateCard} role="alert">
          <h3>暂时无法查看费用资料</h3>
          <p>{snapshot.message}</p>
        </div>
      ) : snapshot.status !== "READY" ? (
        <p className={styles.stateCard}>正在读取费用资料与流水…</p>
      ) : snapshot.bindingStatus !== "APPROVED" ? (
        <div className={styles.stateCard}>
          <h3>
            {snapshot.bindingStatus === "PENDING" ? "监护关系正在审核" : "当前没有已审核的监护关系"}
          </h3>
          <p>关系审核通过后，才能查看对应费用资料。</p>
          <a className={sharedStyles.backLink} href="/web/parent/binding">
            查看关系绑定与授权
          </a>
        </div>
      ) : (
        <>
          <section aria-label="合成费用资料" className={styles.recordList}>
            {snapshot.documents.length === 0 ? (
              <p className={styles.stateCard}>当前关系内暂无可查看费用资料。</p>
            ) : (
              snapshot.documents.map((document) => (
                <article
                  className={styles.recordCard}
                  data-parent-fee-document
                  data-document-status={document.status}
                  key={document.id}
                >
                  <div className={styles.recordHeading}>
                    <h3>{document.title}</h3>
                    <span className={styles.receipt}>{statusLabels[document.status]}</span>
                  </div>
                  <p className={styles.recordMeta}>{document.studentLabel} · {documentLabels[document.documentType]}</p>
                  {document.available ? (
                    <>
                      <dl className={styles.details}>
                        <div className={styles.detailItem}>
                          <dt>所属期间</dt>
                          <dd>{document.period}</dd>
                        </div>
                        <div className={styles.detailItem}>
                          <dt>金额</dt>
                          <dd>
                            {document.amount === null || document.currency === null
                              ? "未单列金额"
                              : `¥${document.amount.toFixed(2)}`}
                          </dd>
                        </div>
                      </dl>
                      <p className={styles.body}>{document.summary}</p>
                    </>
                  ) : (
                    <p className={styles.body}>{document.unavailableReason ?? "当前不可查看。"}</p>
                  )}
                </article>
              ))
            )}
          </section>

          {snapshot.ledger ? (
            <section
              aria-labelledby="parent-fee-ledger-title"
              className={styles.recordCard}
              data-parent-fee-ledger
            >
              <div className={styles.recordHeading}>
                <h3 id="parent-fee-ledger-title">费用流水</h3>
                <span className={styles.receipt}>只读记录</span>
              </div>
              <dl className={styles.details} data-parent-fee-totals>
                {totalLabels.map(([field, label]) => (
                  <div className={styles.detailItem} key={field}>
                    <dt>{label}</dt>
                    <dd>¥{(snapshot.ledger!.reconciliation[field] / 100).toFixed(2)}</dd>
                  </div>
                ))}
              </dl>
              {snapshot.ledger.entries.length === 0 ? (
                <p className={styles.summary}>暂无流水记录。</p>
              ) : (
                <div className={styles.recordList}>
                  {snapshot.ledger.entries.map((entry) => (
                    <p className={styles.body} data-parent-fee-ledger-entry key={entry.id}>
                      <time dateTime={entry.occurredOn}>{entry.occurredOn}</time>
                      {` · ${entry.studentLabel} · ${entry.period} · ${ledgerLabels[entry.type]} · ¥${(entry.amountMinor / 100).toFixed(2)}`}
                    </p>
                  ))}
                </div>
              )}
              <p className={styles.recordMeta}>以上为模拟流水，不代表真实应付金额或收付款结果。</p>
            </section>
          ) : null}
        </>
      )}
    </section>
  );
}
