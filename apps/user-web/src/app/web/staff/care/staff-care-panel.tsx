"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  InviteStaffCareClient,
  type InviteStaffCareRecord,
  type InviteStaffCareSnapshot,
} from "../../../../local-synthetic/invite-staff-care-client.js";
import {
  CARE_RECORD_OPTIONS,
  type CareRecordValues,
} from "../../../../pages/care-record-workflow.js";
import sharedStyles from "../../parent/binding/parent-binding-panel.module.css";
import styles from "../../parent/home/parent-home.module.css";
import formStyles from "../../parent/leave/leave-panel.module.css";

const initialSnapshot: InviteStaffCareSnapshot = {
  status: "CONNECTING",
  records: [],
  students: [],
  message: "正在核对受邀员工身份…",
};
const errorSnapshot: InviteStaffCareSnapshot = {
  ...initialSnapshot,
  status: "ERROR",
  message: "成长记录暂时无法读取，请重新连接。",
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
  SUBMITTED: "待负责人审核",
  CONFIRMED: "审核已通过",
  RETURNED: "已退回修改",
  CANCELLED: "已撤回",
  EXCEPTION_PENDING: "待进一步复核",
} as const;
type Connection = { client: InviteStaffCareClient; busy: boolean };
type Editing = { record: InviteStaffCareRecord; mode: "edit" | "resubmit" };

function createConnection(): Connection {
  const baseUrl = window.location.origin;
  return {
    client: new InviteStaffCareClient({ baseUrl }),
    busy: false,
  };
}

function visibleSnapshot(client: InviteStaffCareClient): InviteStaffCareSnapshot {
  return client.snapshot;
}

export function StaffCarePanel() {
  const clientRef = useRef<Connection | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [editing, setEditing] = useState<Editing | null>(null);

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

  useEffect(() => {
    if (!editing) return;
    formRef.current?.scrollIntoView({ block: "start", behavior: "instant" });
    formRef.current?.querySelector<HTMLSelectElement>('[name="arrival"]')?.focus({
      preventScroll: true,
    });
  }, [editing]);

  const perform = async (action: (client: InviteStaffCareClient) => Promise<void>) => {
    let current = clientRef.current;
    if (current?.busy) return;
    try {
      if (!current) {
        current = createConnection();
        clientRef.current = current;
      }
      current.busy = true;
      setEditing(null);
      setSnapshot({ ...initialSnapshot, status: "BUSY", message: "正在更新成长记录…" });
      await action(current.client);
      if (clientRef.current === current) setSnapshot(visibleSnapshot(current.client));
    } catch {
      if (current && clientRef.current !== current) return;
      current?.client.disconnect();
      setEditing(null);
      setSnapshot(errorSnapshot);
    } finally {
      if (current && clientRef.current === current) current.busy = false;
    }
  };

  const submitForm = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (clientRef.current?.busy || snapshot.status !== "READY") return;
    const data = new FormData(event.currentTarget);
    if (
      !detailFields.every(([field]) =>
        CARE_RECORD_OPTIONS[field].some((option) => option.value === data.get(field)),
      )
    ) {
      setSnapshot({ ...snapshot, message: "请为六项日常观察选择固定选项。" });
      return;
    }
    const values = Object.fromEntries(
      detailFields.map(([field]) => [field, data.get(field)]),
    ) as CareRecordValues;
    if (editing) {
      const { record, mode } = editing;
      void perform((client) =>
        mode === "resubmit"
          ? client.command(record.id, record.version, "resubmit", values)
          : client.edit(record.id, record.version, values),
      );
      return;
    }
    const studentId = String(data.get("student") ?? "");
    const student = snapshot.students.find((row) => row.id === studentId);
    const date = data.get("date");
    if (!student || typeof date !== "string" || !date) {
      setSnapshot({ ...snapshot, message: "请选择孩子并填写记录日期。" });
      return;
    }
    void perform((client) => client.create(student.id, date, values));
  };

  const beginEdit = (record: InviteStaffCareRecord, mode: Editing["mode"]) => {
    if (clientRef.current?.busy || snapshot.status !== "READY") return;
    setEditing({ record, mode });
  };

  const busy = snapshot.status === "CONNECTING" || snapshot.status === "BUSY";
  const unavailable = snapshot.status === "ERROR" || snapshot.status === "DENIED";

  return (
    <section
      aria-labelledby="staff-care-title"
      aria-busy={busy}
      className={styles.panel}
      data-staff-care-state={snapshot.status}
    >
      <div className={styles.sectionHeading}>
        <p className={styles.kicker}>记录日常观察</p>
        <h2 id="staff-care-title">孩子的成长记录</h2>
        <p>仅显示当前受邀账号负责范围内的记录。保存草稿后可以修改，提交后由负责人审核。</p>
      </div>
      <div className={styles.toolbar}>
        <p className={styles.status} role="status" aria-live="polite">
          {snapshot.message}
        </p>
        <button
          className={`${sharedStyles.secondaryButton} ${styles.actionButton}`}
          data-staff-care-refresh
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
          <a href="/web/login?next=%2Fweb%2Fstaff%2Fcare">使用受邀员工账号登录</a>
        </div>
      ) : unavailable ? (
        <div className={styles.stateCard} role="alert">
          <h3>暂时无法查看成长记录</h3>
          <p>之前显示的记录和孩子列表已清除。请重新连接，核对当前状态后再操作。</p>
        </div>
      ) : snapshot.status !== "READY" ? (
        <p className={styles.stateCard}>正在读取当前负责的孩子和成长记录…</p>
      ) : (
        <>
          {snapshot.students.length === 0 ? (
            <p className={styles.stateCard}>当前没有可填写成长记录的孩子。</p>
          ) : (
            <form
              className={styles.recordCard}
              data-staff-care-form
              data-staff-care-mode={editing?.mode ?? "create"}
              key={editing?.record.id ?? "create"}
              onSubmit={submitForm}
              ref={formRef}
            >
              <h3>
                {editing?.mode === "resubmit"
                  ? "修改并重新提交"
                  : editing
                    ? "修改成长记录"
                    : "填写成长记录"}
              </h3>
              {editing ? (
                <p className={styles.summary}>
                  孩子和日期保持不变。
                  {editing.mode === "resubmit"
                    ? "修改六项观察后，重新提交负责人审核。"
                    : "保存后恢复为草稿，需要再次提交审核。"}
                </p>
              ) : (
                <p className={styles.summary}>同一孩子每天一条记录；不同孩子可以选择同一天。</p>
              )}
              <div className={formStyles.fields}>
                <label htmlFor="staff-care-student">
                  孩子
                  <select
                    defaultValue={editing ? "editing" : (snapshot.students[0]?.id ?? "")}
                    disabled={Boolean(editing)}
                    id="staff-care-student"
                    name="student"
                    required
                  >
                    {editing ? (
                      <option value="editing">{editing.record.studentLabel}</option>
                    ) : (
                      snapshot.students.map((student) => (
                        <option key={student.id} value={student.id}>
                          {student.label} · {student.classLabel}
                        </option>
                      ))
                    )}
                  </select>
                </label>
                <label htmlFor="staff-care-date">
                  记录日期
                  <input
                    defaultValue={
                      editing?.record.date ??
                      new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(
                        new Date(),
                      )
                    }
                    id="staff-care-date"
                    max="2029-12-31"
                    min="2026-01-01"
                    name="date"
                    readOnly={Boolean(editing)}
                    required
                    type="date"
                  />
                </label>
                {detailFields.map(([field, label]) => (
                  <label htmlFor={`staff-care-${field}`} key={field}>
                    {label}
                    <select
                      defaultValue={editing?.record.values[field]}
                      id={`staff-care-${field}`}
                      name={field}
                      required
                    >
                      {CARE_RECORD_OPTIONS[field].map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
              <div className={formStyles.actions}>
                <button
                  className={`${sharedStyles.primaryButton} ${styles.actionButton}`}
                  data-staff-care-action="save-draft"
                  type="submit"
                >
                  {editing?.mode === "resubmit" ? "重新提交审核" : "保存草稿"}
                </button>
                {editing ? (
                  <button
                    className={`${sharedStyles.secondaryButton} ${styles.actionButton}`}
                    data-staff-care-action="cancel-edit"
                    onClick={() => {
                      if (!clientRef.current?.busy) setEditing(null);
                    }}
                    type="button"
                  >
                    取消编辑
                  </button>
                ) : null}
              </div>
            </form>
          )}

          <div className={styles.sectionHeading}>
            <h2>成长记录列表</h2>
          </div>
          {snapshot.records.length === 0 ? (
            <p className={styles.stateCard}>当前负责范围内没有成长记录。</p>
          ) : (
            <div className={styles.recordList}>
              {snapshot.records.map((record, index) => {
                const canEdit = record.actions.includes("edit") && !record.published;
                const canSubmit = record.actions.includes("submit");
                const canResubmit = record.actions.includes("resubmit");
                const canWithdraw = record.actions.includes("withdraw");
                const canRevokePublication = record.actions.includes("revoke-publication");
                return (
                  <article
                    className={styles.recordCard}
                    data-staff-care-record={index}
                    data-care-status={record.status}
                    data-care-published={record.published}
                    key={record.id}
                  >
                    <div className={styles.recordHeading}>
                      <h3>{record.studentLabel}</h3>
                      <span className={styles.receipt}>{statusLabels[record.status]}</span>
                    </div>
                    <p className={styles.summary}>
                      <time dateTime={record.date}>{record.date}</time>
                      {record.published ? " · 已发布给家长" : " · 尚未发布给家长"}
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
                    <div className={formStyles.actions}>
                      {canResubmit ? (
                        <button
                          className={`${sharedStyles.primaryButton} ${styles.actionButton}`}
                          data-staff-care-action="resubmit"
                          onClick={() => beginEdit(record, "resubmit")}
                          type="button"
                        >
                          修改并重新提交
                        </button>
                      ) : canEdit ? (
                        <button
                          className={`${sharedStyles.secondaryButton} ${styles.actionButton}`}
                          data-staff-care-action="edit"
                          onClick={() => beginEdit(record, "edit")}
                          type="button"
                        >
                          修改草稿
                        </button>
                      ) : null}
                      {canSubmit ? (
                        <button
                          className={`${sharedStyles.primaryButton} ${styles.actionButton}`}
                          data-staff-care-action="submit"
                          onClick={() =>
                            void perform((client) =>
                              client.command(record.id, record.version, "submit"),
                            )
                          }
                          type="button"
                        >
                          提交审核
                        </button>
                      ) : null}
                      {canWithdraw ? (
                        <button
                          className={`${sharedStyles.secondaryButton} ${styles.actionButton}`}
                          data-staff-care-action="withdraw"
                          onClick={() => {
                            if (
                              !window.confirm(
                                "撤回后这条成长记录将取消，家长无法查看。确定撤回吗？",
                              )
                            )
                              return;
                            void perform((client) => client.withdraw(record.id, record.version));
                          }}
                          type="button"
                        >
                          撤回记录
                        </button>
                      ) : null}
                      {canRevokePublication ? (
                        <button
                          className={`${sharedStyles.secondaryButton} ${styles.actionButton}`}
                          data-staff-care-action="revoke-publication"
                          onClick={() => {
                            if (
                              !window.confirm(
                                "撤销后家长将立即无法查看；重新发布后家长需要重新查看确认。确定撤销吗？",
                              )
                            )
                              return;
                            void perform((client) =>
                              client.revokePublication(record.id, record.version),
                            );
                          }}
                          type="button"
                        >
                          撤销发布
                        </button>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
}
