"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  InviteSessionClient,
  type InviteSessionSnapshot,
} from "../../../../local-synthetic/invite-session";
import {
  ParentCareInviteClient,
  type ParentCareInviteAction,
  type ParentCareInviteSnapshot,
} from "../../../../local-synthetic/parent-care-invite-client";
import sharedStyles from "../binding/parent-binding-panel.module.css";
import styles from "./parent-home.module.css";

const initialInvite: InviteSessionSnapshot = {
  status: "CHECKING",
  displayName: "",
  services: [],
  message: "正在核对登录状态…",
};
const initialCare: ParentCareInviteSnapshot = {
  status: "IDLE",
  records: [],
  message: "请先使用机构邀请账号登录。",
};
const receiptLabels = {
  UNREAD: "未读",
  READ: "已读",
  ACKNOWLEDGED: "已确认知悉",
} as const;
const detailFields = [
  ["arrival", "到离状态"],
  ["homework", "作业整理"],
  ["meal", "餐食情况"],
  ["rest", "午休情况"],
  ["activity", "活动参与"],
  ["wellbeing", "一般状态"],
] as const;
type CurrentClients = {
  readonly invite: InviteSessionClient;
  readonly care: ParentCareInviteClient;
  busy: boolean;
};

function canReadCare(snapshot: InviteSessionSnapshot): boolean {
  return (
    snapshot.status === "READY" &&
    snapshot.services.some((service) => service.href === "/web/parent/home")
  );
}

export function ParentHomePanel() {
  const clientsRef = useRef<CurrentClients | null>(null);
  const [inviteSnapshot, setInviteSnapshot] = useState(initialInvite);
  const [careSnapshot, setCareSnapshot] = useState(initialCare);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    const current: CurrentClients = {
      invite: new InviteSessionClient({ baseUrl: window.location.origin }),
      care: new ParentCareInviteClient({ baseUrl: window.location.origin }),
      busy: false,
    };
    clientsRef.current = current;
    void (async () => {
      await current.invite.restore();
      if (clientsRef.current !== current) return;
      setInviteSnapshot(current.invite.snapshot);
      if (canReadCare(current.invite.snapshot)) {
        setCareSnapshot({
          ...initialCare,
          status: "CONNECTING",
          message: "正在读取已发布的成长记录…",
        });
        await current.care.refresh();
        if (clientsRef.current === current) setCareSnapshot(current.care.snapshot);
      }
    })();
    return () => {
      current.invite.disconnect();
      current.care.disconnect();
      if (clientsRef.current === current) clientsRef.current = null;
    };
  }, []);

  const login = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const current = clientsRef.current;
    if (!current || current.busy) return;
    current.busy = true;
    const loginRequest = current.invite.login(username, password);
    setInviteSnapshot(current.invite.snapshot);
    await loginRequest;
    if (clientsRef.current !== current) return;
    setInviteSnapshot(current.invite.snapshot);
    setPassword("");
    if (canReadCare(current.invite.snapshot)) {
      setCareSnapshot({
        ...initialCare,
        status: "CONNECTING",
        message: "正在读取已发布的成长记录…",
      });
      await current.care.refresh();
      if (clientsRef.current === current) setCareSnapshot(current.care.snapshot);
    } else {
      current.care.disconnect();
      setCareSnapshot({
        ...initialCare,
        status: "DENIED",
        message: "当前受邀账号没有成长记录查看权限。",
      });
    }
    if (clientsRef.current === current) current.busy = false;
  };

  const logout = async () => {
    const current = clientsRef.current;
    if (!current || current.busy) return;
    current.busy = true;
    current.care.disconnect();
    setCareSnapshot(initialCare);
    await current.invite.logout();
    if (clientsRef.current !== current) return;
    setInviteSnapshot(current.invite.snapshot);
    current.busy = false;
  };

  const refresh = async () => {
    const current = clientsRef.current;
    if (!current || current.busy || !canReadCare(current.invite.snapshot)) return;
    current.busy = true;
    setCareSnapshot({ ...current.care.snapshot, status: "BUSY", message: "正在刷新成长记录…" });
    await current.care.refresh();
    if (clientsRef.current === current) {
      setCareSnapshot(current.care.snapshot);
      current.busy = false;
    }
  };

  const receipt = async (recordId: string, action: ParentCareInviteAction) => {
    const current = clientsRef.current;
    if (!current || current.busy || !canReadCare(current.invite.snapshot)) return;
    current.busy = true;
    setCareSnapshot({ ...current.care.snapshot, status: "BUSY", message: "正在更新成长记录…" });
    await current.care.receipt(recordId, action);
    if (clientsRef.current === current) {
      setCareSnapshot(current.care.snapshot);
      current.busy = false;
    }
  };

  const busy =
    inviteSnapshot.status === "CHECKING" ||
    inviteSnapshot.status === "BUSY" ||
    careSnapshot.status === "CONNECTING" ||
    careSnapshot.status === "BUSY";
  const hasCareAccess = canReadCare(inviteSnapshot);
  const retryableInvite = ["READY", "DENIED", "ERROR", "LOGOUT_FAILED"].includes(
    inviteSnapshot.status,
  );

  return (
    <section
      aria-labelledby="parent-care-title"
      aria-busy={busy}
      className={styles.panel}
      data-parent-care-state={hasCareAccess ? careSnapshot.status : inviteSnapshot.status}
    >
      <div className={styles.sectionHeading}>
        <p className={styles.kicker}>关注孩子的每一天</p>
        <h2 id="parent-care-title">成长记录</h2>
        <p>仅显示已审核关系下、由机构发布的记录。</p>
      </div>

      {!hasCareAccess ? (
        <div className={styles.stateCard}>
          {inviteSnapshot.status === "IDLE" ? (
            <>
              <h3>使用受邀账号登录</h3>
              <p role="status" aria-live="polite">
                {inviteSnapshot.message}
              </p>
              <form onSubmit={(event) => void login(event)}>
                <label>
                  受邀账号
                  <input
                    autoComplete="username"
                    maxLength={120}
                    onChange={(event) => setUsername(event.currentTarget.value)}
                    required
                    value={username}
                  />
                </label>
                <label>
                  密码
                  <input
                    autoComplete="current-password"
                    onChange={(event) => setPassword(event.currentTarget.value)}
                    required
                    type="password"
                    value={password}
                  />
                </label>
                <button className={sharedStyles.primaryButton} disabled={busy} type="submit">
                  {busy ? "正在验证…" : "登录并查看成长记录"}
                </button>
              </form>
            </>
          ) : inviteSnapshot.status === "CHECKING" || inviteSnapshot.status === "BUSY" ? (
            <p role="status" aria-live="polite">
              {inviteSnapshot.message}
            </p>
          ) : (
            <>
              <h3>当前账号无法查看成长记录</h3>
              <p role="status" aria-live="polite">
                {inviteSnapshot.status === "READY"
                  ? "此账号未开通成长记录查看权限。请使用机构邀请的家长账号。"
                  : inviteSnapshot.message}
              </p>
              {retryableInvite ? (
                <button
                  className={sharedStyles.secondaryButton}
                  disabled={busy}
                  onClick={() => void logout()}
                  type="button"
                >
                  使用其他账号
                </button>
              ) : null}
            </>
          )}
        </div>
      ) : (
        <>
          <div className={styles.toolbar}>
            <p className={styles.status} role="status" aria-live="polite">
              {careSnapshot.message}
            </p>
            <button
              className={`${sharedStyles.secondaryButton} ${styles.actionButton}`}
              data-parent-care-refresh
              disabled={busy}
              onClick={() => void refresh()}
              type="button"
            >
              {busy ? "正在更新…" : "刷新成长记录"}
            </button>
            <button
              className={`${sharedStyles.secondaryButton} ${styles.actionButton}`}
              data-parent-care-logout
              disabled={busy}
              onClick={() => void logout()}
              type="button"
            >
              退出登录
            </button>
          </div>

          {careSnapshot.status === "ERROR" || careSnapshot.status === "DENIED" ? (
            <div className={styles.stateCard} role="alert">
              <h3>
                {careSnapshot.status === "DENIED" ? "暂时无法查看成长记录" : "成长记录暂不可用"}
              </h3>
              <p>{careSnapshot.message}</p>
            </div>
          ) : careSnapshot.status !== "READY" ? (
            <p className={styles.stateCard} role="status">
              {careSnapshot.message}
            </p>
          ) : careSnapshot.records.length === 0 ? (
            <p className={styles.stateCard}>当前没有已发布的成长记录。</p>
          ) : (
            <div className={styles.recordList}>
              {careSnapshot.records.map((record) => (
                <article
                  className={styles.recordCard}
                  data-parent-care-row
                  data-record-id={record.id}
                  data-receipt={record.receipt}
                  key={record.id}
                >
                  <div className={styles.recordHeading}>
                    <h3>
                      {record.studentLabel} · <time dateTime={record.date}>{record.date}</time>
                    </h3>
                    <span className={styles.receipt}>{receiptLabels[record.receipt]}</span>
                  </div>
                  {record.receipt === "UNREAD" ? (
                    <>
                      <p className={styles.summary} data-parent-care-alert role="status">
                        新成长记录已发布，打开后可查看当日摘要。
                      </p>
                      <button
                        className={`${sharedStyles.primaryButton} ${styles.actionButton}`}
                        data-parent-care-action="read"
                        disabled={busy}
                        onClick={() => void receipt(record.id, "read")}
                        type="button"
                      >
                        打开成长记录
                      </button>
                    </>
                  ) : (
                    <>
                      <dl className={styles.details}>
                        {detailFields.map(([field, label]) => (
                          <div className={styles.detailItem} key={field}>
                            <dt>{label}</dt>
                            <dd>{record.values[field]}</dd>
                          </div>
                        ))}
                      </dl>
                      {record.receipt === "READ" ? (
                        <button
                          className={`${sharedStyles.primaryButton} ${styles.actionButton}`}
                          data-parent-care-action="acknowledge"
                          disabled={busy}
                          onClick={() => void receipt(record.id, "acknowledge")}
                          type="button"
                        >
                          确认知悉
                        </button>
                      ) : (
                        <p className={styles.acknowledged}>已确认知悉这条成长记录。</p>
                      )}
                    </>
                  )}
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
