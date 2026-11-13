"use client";

import { useEffect, useRef, useState } from "react";
import {
  ParentPickupClient,
  type ParentPickupAuthorization,
  type ParentPickupInput,
  type ParentPickupSnapshot,
} from "../../../../local-synthetic/parent-pickup";
import sharedStyles from "../binding/parent-binding-panel.module.css";
import styles from "../home/parent-home.module.css";
import pickupStyles from "./parent-pickup.module.css";

const initialSnapshot: ParentPickupSnapshot = {
  status: "CONNECTING",
  bindings: [],
  authorizations: [],
  records: [],
  credential: null,
  historyFrom: "",
  historyTo: "",
  message: "正在读取邀请账号可查看的接送资料…",
};
const initialInput: ParentPickupInput = {
  bindingId: "",
  recipient: "pickup-alpha",
  type: "TEMPORARY",
  startDate: "",
  endDate: "",
  startTime: "",
  endTime: "",
};
const dateTimeFields = [
  ["startDate", "开始日期", "date"],
  ["endDate", "结束日期", "date"],
  ["startTime", "开始时间", "time"],
  ["endTime", "结束时间", "time"],
] as const;

function authorizationLabel(row: ParentPickupAuthorization): string {
  if (row.status === "DRAFT") return "待确认";
  if (row.status === "REVOKED") return "已撤销";
  if (row.status === "COMPLETED") return "已完成";
  return row.currentlyValid ? "已生效" : "当前不在有效时段";
}

export function ParentPickupPanel() {
  const clientRef = useRef<{ client: ParentPickupClient; busy: boolean } | null>(null);
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [input, setInput] = useState(initialInput);

  useEffect(() => {
    const createConnection = () => {
      const client = new ParentPickupClient({ baseUrl: window.location.origin });
      const current = { client, busy: false };
      client.setCredentialExpiryListener(() => {
        if (clientRef.current === current) setSnapshot({ ...client.snapshot, credential: null });
      });
      return current;
    };
    const current = createConnection();
    current.busy = true;
    clientRef.current = current;
    void current.client.connect().then(() => {
      if (clientRef.current !== current) return;
      current.busy = false;
      setSnapshot({ ...current.client.snapshot, credential: null });
    });

    const hide = () => {
      const previous = clientRef.current;
      if (!previous) return;
      clientRef.current = null;
      previous.client.setCredentialExpiryListener(null);
      previous.client.disconnect();
      clientRef.current = createConnection();
      setInput(initialInput);
      setSnapshot({
        ...initialSnapshot,
        status: "IDLE",
        message: "接送资料与临时凭证已隐藏，请重新读取后查看。",
      });
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") hide();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", hide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", hide);
      const active = clientRef.current;
      clientRef.current = null;
      active?.client.setCredentialExpiryListener(null);
      active?.client.disconnect();
    };
  }, []);

  const perform = async (
    action: (client: ParentPickupClient) => Promise<void>,
    credentialFor?: string,
  ) => {
    const current = clientRef.current;
    if (!current || current.busy) return;
    current.busy = true;
    setSnapshot({ ...initialSnapshot, status: "BUSY", message: "正在更新接送安排…" });
    try {
      await action(current.client);
      if (clientRef.current === current) {
        const next = current.client.snapshot;
        setSnapshot({
          ...next,
          credential:
            next.status === "READY" && next.credential?.authorizationId === credentialFor
              ? next.credential
              : null,
        });
      }
    } catch {
      if (clientRef.current !== current) return;
      current.client.setCredentialExpiryListener(null);
      current.client.disconnect();
      current.client.setCredentialExpiryListener(() => {
        if (clientRef.current === current)
          setSnapshot({ ...current.client.snapshot, credential: null });
      });
      setSnapshot({
        ...initialSnapshot,
        status: "ERROR",
        message: "接送资料暂不可用，请检查邀请账号或稍后重试。",
      });
    } finally {
      if (clientRef.current === current) current.busy = false;
    }
  };

  const updateInput = <Field extends keyof ParentPickupInput>(
    field: Field,
    value: ParentPickupInput[Field],
  ) => setInput((current) => ({ ...current, [field]: value }));

  const filterHistory = (from: string, to: string) => {
    const current = clientRef.current;
    if (!current || current.busy || current.client.snapshot.status !== "READY") return;
    current.client.setHistoryFilter(from, to);
    setSnapshot({ ...current.client.snapshot, credential: null });
  };
  const busy = snapshot.status === "CONNECTING" || snapshot.status === "BUSY";
  const reconnect = snapshot.status === "ERROR" || snapshot.status === "IDLE";
  const bindingId = snapshot.bindings.some((binding) => binding.id === input.bindingId)
    ? input.bindingId
    : (snapshot.bindings[0]?.id ?? "");
  const records = snapshot.records.filter(
    (record) =>
      (!snapshot.historyFrom || record.date >= snapshot.historyFrom) &&
      (!snapshot.historyTo || record.date <= snapshot.historyTo),
  );

  return (
    <section
      aria-labelledby="parent-pickup-title"
      aria-busy={busy}
      className={styles.panel}
      data-testid="parent-pickup-panel"
      data-parent-pickup-state={snapshot.status}
    >
      <div className={styles.sectionHeading}>
        <p className={styles.kicker}>邀请账号 · 已审核关系</p>
        <h2 id="parent-pickup-title">接送授权与记录</h2>
        <p>仅显示当前已审核孩子的安排。保存后仍需确认授权，现场凭证只在当前页面临时显示。</p>
      </div>
      <div className={styles.toolbar}>
        <p className={styles.status} role="status" aria-live="polite">
          {snapshot.message}
        </p>
        <button
          className={`${sharedStyles.secondaryButton} ${styles.actionButton}`}
          data-parent-pickup-refresh
          disabled={busy}
          onClick={() =>
            void perform((client) =>
              client.snapshot.status === "READY" ? client.refresh() : client.connect(),
            )
          }
          type="button"
        >
          {busy ? "正在更新…" : reconnect ? "重新连接" : "刷新接送记录"}
        </button>
      </div>

      {snapshot.status === "ERROR" ? (
        <div className={styles.stateCard} role="alert">
          <h3>暂时无法查看接送资料</h3>
          <p>之前显示的安排、凭证和历史已清除。请重新读取当前账号可查看的内容。</p>
        </div>
      ) : snapshot.status === "IDLE" ? (
        <div className={styles.stateCard}>
          <h3>接送资料已隐藏</h3>
          <p>重新读取后可继续查看；如需现场凭证，请重新生成。</p>
        </div>
      ) : snapshot.status !== "READY" ? (
        <p className={styles.stateCard}>正在读取当前可查看的接送资料…</p>
      ) : snapshot.bindings.length === 0 ? (
        <div className={styles.stateCard}>
          <h3>尚无已审核的孩子关系</h3>
          <p>关系审核通过后，才能新增接送授权或查看接送历史。</p>
          <a className={sharedStyles.backLink} href="/web/parent/binding">
            查看关系绑定与授权
          </a>
        </div>
      ) : (
        <>
          <section aria-label="接送授权" className={styles.recordList}>
            {snapshot.authorizations.length === 0 ? (
              <p className={styles.stateCard}>当前没有接送授权。</p>
            ) : (
              snapshot.authorizations.map((row) => (
                <article
                  className={styles.recordCard}
                  data-parent-pickup-authorization
                  data-pickup-status={row.status}
                  data-pickup-type={row.type}
                  data-pickup-valid={row.currentlyValid}
                  key={row.id}
                >
                  <div className={styles.recordHeading}>
                    <h3>
                      {row.studentLabel} · {row.recipientLabel}
                    </h3>
                    <span className={styles.receipt}>{authorizationLabel(row)}</span>
                  </div>
                  <p className={styles.recordMeta}>
                    {row.classLabel} · {row.type === "TEMPORARY" ? "临时授权" : "常用授权"}
                  </p>
                  <p className={styles.body}>
                    {row.startDate} 至 {row.endDate}，每天 {row.startTime}–{row.endTime}
                  </p>
                  {row.status === "DRAFT" ? (
                    <button
                      className={`${sharedStyles.primaryButton} ${styles.actionButton}`}
                      data-parent-pickup-action="activate"
                      disabled={busy}
                      onClick={() => void perform((client) => client.activate(row.id, row.version))}
                      type="button"
                    >
                      确认接送授权
                    </button>
                  ) : row.status === "ACTIVE" ? (
                    <div className={pickupStyles.actions}>
                      {row.currentlyValid ? (
                        <button
                          className={`${sharedStyles.primaryButton} ${styles.actionButton}`}
                          data-parent-pickup-action="credential"
                          disabled={busy}
                          onClick={() =>
                            void perform(
                              (client) => client.issueCredential(row.id, row.version),
                              row.id,
                            )
                          }
                          type="button"
                        >
                          生成现场凭证
                        </button>
                      ) : null}
                      <button
                        className={`${sharedStyles.secondaryButton} ${styles.actionButton}`}
                        data-parent-pickup-action="revoke"
                        disabled={busy}
                        onClick={() => {
                          if (clientRef.current?.busy) return;
                          if (
                            window.confirm(
                              `将撤销${row.studentLabel}由${row.recipientLabel}接送的授权，现场凭证会立即失效。确认撤销？`,
                            )
                          )
                            void perform((client) => client.revoke(row.id, row.version));
                        }}
                        type="button"
                      >
                        撤销授权
                      </button>
                    </div>
                  ) : null}
                </article>
              ))
            )}
          </section>

          {snapshot.credential ? (
            <aside className={pickupStyles.credential} data-parent-pickup-credential role="status">
              <h3>现场凭证已生成</h3>
              <p>
                仅当前页面显示，北京时间{" "}
                <time dateTime={snapshot.credential.expiresAt}>
                  {new Date(snapshot.credential.expiresAt).toLocaleTimeString("zh-CN", {
                    timeZone: "Asia/Shanghai",
                    hour12: false,
                  })}
                </time>{" "}
                前有效。 离开或隐藏页面后需要重新生成。
              </p>
              <code>{snapshot.credential.value}</code>
              <button
                className={`${sharedStyles.secondaryButton} ${styles.actionButton}`}
                data-parent-pickup-hide-credential
                disabled={busy}
                onClick={() => void perform((client) => client.refresh())}
                type="button"
              >
                隐藏现场凭证
              </button>
            </aside>
          ) : null}

          <form
            className={`${styles.recordCard} ${pickupStyles.form}`}
            data-parent-pickup-form
            onSubmit={(event) => {
              event.preventDefault();
              void perform((client) => client.create({ ...input, bindingId }));
            }}
          >
            <div className={styles.recordHeading}>
              <h3>新增接送安排</h3>
            </div>
            <p className={styles.recordMeta}>
              临时授权仅限同一天，常用授权日期范围最多90天。时间使用北京时间。
            </p>
            <div className={pickupStyles.fields}>
              <label>
                孩子
                <select
                  name="bindingId"
                  onChange={(event) => updateInput("bindingId", event.currentTarget.value)}
                  required
                  value={bindingId}
                >
                  {snapshot.bindings.map((binding) => (
                    <option key={binding.id} value={binding.id}>
                      {binding.studentLabel} · {binding.classLabel}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                接送人
                <select
                  name="recipient"
                  onChange={(event) =>
                    updateInput(
                      "recipient",
                      event.currentTarget.value as ParentPickupInput["recipient"],
                    )
                  }
                  required
                  value={input.recipient}
                >
                  <option value="pickup-alpha">示例接送人甲</option>
                  <option value="pickup-beta">示例接送人乙</option>
                </select>
              </label>
              <label>
                授权类型
                <select
                  name="type"
                  onChange={(event) =>
                    updateInput("type", event.currentTarget.value as ParentPickupInput["type"])
                  }
                  required
                  value={input.type}
                >
                  <option value="TEMPORARY">临时授权</option>
                  <option value="REGULAR">常用授权</option>
                </select>
              </label>
              {dateTimeFields.map(([field, label, type]) => (
                <label key={field}>
                  {label}
                  <input
                    name={field}
                    onChange={(event) => updateInput(field, event.currentTarget.value)}
                    required
                    type={type}
                    value={input[field]}
                  />
                </label>
              ))}
            </div>
            <button
              className={`${sharedStyles.primaryButton} ${styles.actionButton}`}
              disabled={busy}
              type="submit"
            >
              保存接送安排
            </button>
          </form>

          <section
            aria-labelledby="parent-pickup-history-title"
            className={styles.recordCard}
            data-parent-pickup-history
          >
            <div className={styles.recordHeading}>
              <h3 id="parent-pickup-history-title">接送历史</h3>
            </div>
            <p className={styles.recordMeta}>仅查看当前已审核孩子的已完成记录，可按日期筛选。</p>
            <div className={pickupStyles.fields}>
              <label>
                开始日期
                <input
                  name="historyFrom"
                  onChange={(event) => filterHistory(event.currentTarget.value, snapshot.historyTo)}
                  type="date"
                  value={snapshot.historyFrom}
                />
              </label>
              <label>
                结束日期
                <input
                  name="historyTo"
                  onChange={(event) =>
                    filterHistory(snapshot.historyFrom, event.currentTarget.value)
                  }
                  type="date"
                  value={snapshot.historyTo}
                />
              </label>
            </div>
            {records.length === 0 ? (
              <p className={styles.summary}>暂无符合日期的接送记录。</p>
            ) : (
              <div className={styles.recordList}>
                {records.map((record) => (
                  <p className={styles.body} data-parent-pickup-record key={record.id}>
                    <strong>{record.studentLabel}</strong>
                    {` · ${record.date} ${record.time} · ${record.recipient} · 已完成`}
                  </p>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </section>
  );
}
