"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { STAFF_DAILY_OPTIONS, type StaffDailyValues } from "../../../../local-synthetic/staff-daily";
import {
  InviteStaffDailyClient,
  type InviteStaffDailyRecord,
  type InviteStaffDailySnapshot,
} from "../../../../local-synthetic/invite-staff-daily-client";
import styles from "./staff-daily.module.css";

const fields = ["arrival", "homework", "activity", "classroom", "followUp"] as const;
type Field = (typeof fields)[number];
const labels: Record<Field, string> = {
  arrival: "到校状态",
  homework: "作业整理",
  activity: "活动参与",
  classroom: "班级秩序",
  followUp: "后续安排",
};
const statuses = {
  DRAFT: "草稿",
  SUBMITTED: "待负责人审核",
  RETURNED: "已退回修改",
  CONFIRMED: "已确认",
} as const;
const emptyValues: StaffDailyValues = {
  arrival: "ARRIVED_AS_PLANNED",
  homework: "COMPLETED",
  activity: "PARTICIPATED",
  classroom: "ROUTINE",
  followUp: "NONE",
};
const initialSnapshot: InviteStaffDailySnapshot = {
  status: "CONNECTING",
  records: [],
  canCreate: false,
  message: "正在核对受邀员工身份…",
  error: null,
};

function optionLabel(field: Field, code: string): string {
  return STAFF_DAILY_OPTIONS[field].find(([value]) => value === code)?.[1] ?? "";
}

function sourceLabel(row: InviteStaffDailyRecord): string {
  const count = row.sourceCounts;
  return `来源分类：任务 ${count.TASK} · 考勤 ${count.ATTENDANCE} · 托管记录 ${count.CARE_RECORD} · 接送 ${count.PICKUP} · 异常 ${count.PICKUP_EXCEPTION}`;
}

function learningLabel(row: InviteStaffDailyRecord): string | null {
  const summary = row.learningSummary;
  if (!summary) return null;
  return `学习摘要仅供内部教学参考：2 人及以上完成练习；${summary.usedGuidance ? "使用过分步提示" : "未使用分步提示"}；${summary.needsTeacherFollowUp ? "有教师跟进提示" : "暂无教师跟进提示"}。`;
}

export function StaffDailyPanel() {
  const clientRef = useRef<InviteStaffDailyClient | null>(null);
  const mounted = useRef(false);
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [values, setValues] = useState<StaffDailyValues>(emptyValues);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingVersion, setEditingVersion] = useState<number | null>(null);
  const [editingReturned, setEditingReturned] = useState(false);
  const busy = snapshot.status === "CONNECTING" || snapshot.status === "BUSY";

  useEffect(() => {
    mounted.current = true;
    const origin = window.location.origin;
    const client = new InviteStaffDailyClient({ baseUrl: origin });
    clientRef.current = client;
    const connecting = client.restore();
    setSnapshot(client.snapshot);
    void connecting.finally(() => {
      if (mounted.current) setSnapshot(client.snapshot);
    });
    return () => {
      mounted.current = false;
      client.disconnect();
      if (clientRef.current === client) clientRef.current = null;
    };
  }, []);

  function run(operation: (client: InviteStaffDailyClient) => Promise<void>): void {
    const client = clientRef.current;
    if (!client) return;
    const pending = operation(client);
    setSnapshot(client.snapshot);
    void pending.finally(() => {
      if (mounted.current) setSnapshot(client.snapshot);
    });
  }

  function beginEdit(row: InviteStaffDailyRecord): void {
    setEditingId(row.id);
    setEditingVersion(row.version);
    setEditingReturned(row.status === "RETURNED");
    setDate(row.date);
    setValues({ ...row.values });
  }

  function clearEdit(): void {
    setEditingId(null);
    setEditingVersion(null);
    setEditingReturned(false);
    setDate(new Date().toISOString().slice(0, 10));
    setValues(emptyValues);
  }

  async function save(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const client = clientRef.current;
    if (!client) return;
    const pending =
      editingId && editingVersion !== null
        ? editingReturned
          ? client.resubmit(editingId, editingVersion, values)
          : client.edit(editingId, editingVersion, values)
        : client.create(date, values);
    setSnapshot(client.snapshot);
    await pending;
    if (!mounted.current) return;
    setSnapshot(client.snapshot);
    if (client.snapshot.status === "READY") clearEdit();
  }

  function connect(): void {
    run((client) => client.restore());
  }

  const dayAlreadyHasReport = snapshot.records.some((row) => row.date === date);
  const editingRow = editingId ? snapshot.records.find((row) => row.id === editingId) : null;
  const showForm =
    snapshot.status === "READY" &&
    snapshot.canCreate &&
    (Boolean(editingRow) || !dayAlreadyHasReport);

  return (
    <section
      className={styles.panel}
      data-staff-daily-panel
      data-staff-daily-state={snapshot.status}
      aria-labelledby="staff-daily-title"
    >
      <div className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>员工内部流程 · 受邀账号权限范围内</p>
          <h2 id="staff-daily-title">工作日报</h2>
          <p>记录固定选项，提交后显示待审核状态；日报不会发送给家长。</p>
        </div>
        {snapshot.status === "ERROR" ? (
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={connect}
            data-staff-daily-reconnect
          >
            重新连接
          </button>
        ) : (
          <button
            className={styles.secondaryButton}
            type="button"
            disabled={busy || snapshot.status !== "READY"}
            onClick={() => run((client) => client.refresh())}
            data-staff-daily-refresh
          >
            刷新
          </button>
        )}
      </div>

      <p
        className={snapshot.error ? styles.error : styles.message}
        role={snapshot.error ? "alert" : "status"}
      >
        {snapshot.error ?? snapshot.message}
      </p>

      {showForm ? (
        <form className={styles.form} onSubmit={(event) => void save(event)} data-staff-daily-form>
          <h3>
            {editingReturned ? "修改并重新提交" : editingId ? "编辑日报草稿" : "填写工作日报"}
          </h3>
          <label className={styles.field}>
            日期
            <input
              name="date"
              type="date"
              value={date}
              required
              disabled={busy || Boolean(editingId)}
              onChange={(event) => setDate(event.target.value)}
            />
          </label>
          <div className={styles.fields}>
            {fields.map((field) => (
              <label className={styles.field} key={field}>
                {labels[field]}
                <select
                  name={field}
                  value={values[field]}
                  required
                  disabled={busy}
                  onChange={(event) =>
                    setValues((previous) => ({ ...previous, [field]: event.target.value }))
                  }
                >
                  {STAFF_DAILY_OPTIONS[field].map(([code, label]) => (
                    <option value={code} key={code}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <div className={styles.actions}>
            <button
              className={styles.primaryButton}
              type="submit"
              disabled={busy}
              data-staff-daily-save
            >
              {editingReturned ? "保存修改并重新提交" : editingId ? "保存草稿" : "保存日报草稿"}
            </button>
            {editingId ? (
              <button
                className={styles.secondaryButton}
                type="button"
                disabled={busy}
                onClick={clearEdit}
              >
                取消编辑
              </button>
            ) : null}
          </div>
        </form>
      ) : snapshot.status === "READY" && dayAlreadyHasReport && !editingId ? (
        <p className={styles.notice}>所选日期已有日报，请在下方打开草稿继续编辑或查看审核状态。</p>
      ) : null}

      <div className={styles.listHeading}>
        <h3>我的日报</h3>
        <span>{snapshot.records.length} 份</span>
      </div>
      {snapshot.records.length ? (
        <div className={styles.list}>
          {snapshot.records.map((row, index) => (
            <article
              className={styles.card}
              key={`${row.date}-${index}`}
              data-staff-daily-row={index}
            >
              <div className={styles.cardHeading}>
                <h4>工作日报 · {row.date}</h4>
                <span className={styles.badge} data-staff-daily-status={row.status}>
                  {statuses[row.status]} · 第 {row.version} 版
                </span>
              </div>
              <dl className={styles.details}>
                {fields.map((field) => (
                  <div key={field}>
                    <dt>{labels[field]}</dt>
                    <dd>{optionLabel(field, row.values[field])}</dd>
                  </div>
                ))}
              </dl>
              <p className={styles.note}>{sourceLabel(row)}</p>
              {learningLabel(row) ? <p className={styles.note}>{learningLabel(row)}</p> : null}
              {row.actions.length > 0 ? (
                <div className={styles.actions}>
                  {row.actions.includes("edit") || row.actions.includes("resubmit") ? (
                    <button
                      className={styles.secondaryButton}
                      type="button"
                      disabled={busy}
                      onClick={() => beginEdit(row)}
                      data-staff-daily-edit={index}
                    >
                      {row.status === "RETURNED" ? "修改并重新提交" : "编辑草稿"}
                    </button>
                  ) : null}
                  {row.actions.includes("submit") ? (
                    <button
                      className={styles.primaryButton}
                      type="button"
                      disabled={busy}
                      onClick={() => run((client) => client.submit(row.id, row.version))}
                      data-staff-daily-submit={index}
                    >
                      提交负责人审核
                    </button>
                  ) : null}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : snapshot.status === "READY" ? (
        <p className={styles.notice}>当前没有工作日报。填写上方固定选项即可保存一份草稿。</p>
      ) : null}
      <p className={styles.footnote}>
        页面只展示本人可处理的日报摘要，不展示学生姓名、来源记录编号或练习明细。
      </p>
    </section>
  );
}
