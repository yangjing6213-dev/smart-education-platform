"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  InviteStaffMonthlyClient,
  type InviteStaffMonthlyRecord,
  type InviteStaffMonthlySnapshot,
  type MonthlyMutationOutcome,
  type MonthlySupplements,
} from "../../../../local-synthetic/invite-staff-monthly-client";
import styles from "../daily/staff-daily.module.css";

const labels = {
  learningParticipation: "学习参与",
  dailyHabits: "日常习惯",
  activityParticipation: "活动参与",
  familySchoolCollaboration: "家校协作",
} as const;
const fields = Object.keys(labels) as (keyof MonthlySupplements)[];
const options = {
  KEEP_WATCHING: "保持关注",
  PROGRESSING: "已有进步",
  FOLLOW_UP: "需要跟进",
} as const;
const statuses = {
  DRAFT: "草稿",
  SUBMITTED: "待负责人审核",
  RETURNED: "已退回修改",
  CONFIRMED: "已确认，待内部发布",
  PUBLISHED: "已内部发布",
  REVIEW_REQUIRED: "来源已变化，需要重新审核",
} as const;
const initialValues: MonthlySupplements = {
  learningParticipation: "KEEP_WATCHING",
  dailyHabits: "KEEP_WATCHING",
  activityParticipation: "KEEP_WATCHING",
  familySchoolCollaboration: "KEEP_WATCHING",
};
const initialSnapshot: InviteStaffMonthlySnapshot = {
  status: "CONNECTING",
  records: [],
  canCreate: false,
  message: "正在核对受邀员工身份…",
  error: null,
  requiresLogin: false,
};

export function StaffMonthlyPanel() {
  const clientRef = useRef<InviteStaffMonthlyClient | null>(null);
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [values, setValues] = useState<MonthlySupplements>(initialValues);
  const [editor, setEditor] = useState<{ id: string; version: number } | null>(null);
  const busy = snapshot.status === "CONNECTING" || snapshot.status === "BUSY";
  useEffect(() => {
    const client = new InviteStaffMonthlyClient({ baseUrl: window.location.origin });
    clientRef.current = client;
    const connecting = client.restore();
    setSnapshot(client.snapshot);
    void connecting.then(() => {
      if (clientRef.current === client) setSnapshot(client.snapshot);
    });
    return () => {
      client.disconnect();
      if (clientRef.current === client) clientRef.current = null;
    };
  }, []);

  function clearEdit(): void {
    setEditor(null);
    setValues(initialValues);
  }
  async function run(
    operation: (client: InviteStaffMonthlyClient) => Promise<void | MonthlyMutationOutcome>,
  ): Promise<void | MonthlyMutationOutcome> {
    const client = clientRef.current;
    if (!client) return;
    const pending = operation(client);
    setSnapshot(client.snapshot);
    const outcome = await pending;
    if (clientRef.current !== client) return;
    setSnapshot(client.snapshot);
    if (outcome === "conflict" || client.snapshot.status === "ERROR") clearEdit();
    return outcome;
  }
  function edit(row: InviteStaffMonthlyRecord): void {
    setEditor({ id: row.id, version: row.version });
    setMonth(row.month);
    setValues({ ...row.supplements });
  }
  async function save(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const outcome = await run((client) =>
      editor ? client.edit(editor.id, editor.version, values) : client.create(month, values),
    );
    if (outcome === "saved") clearEdit();
  }
  async function submit(row: InviteStaffMonthlyRecord): Promise<void> {
    if (editor) return;
    const outcome = await run((client) => client.submit(row.id, row.version));
    if (outcome === "saved") clearEdit();
  }
  function refresh(): void {
    clearEdit();
    void run((client) => client.refresh());
  }
  const editingRow = editor
    ? snapshot.records.find((row) => row.id === editor.id && row.actions.includes("edit"))
    : undefined;
  const monthExists = snapshot.records.some((row) => row.month === month);
  const showForm =
    snapshot.status === "READY" && (Boolean(editingRow) || (snapshot.canCreate && !monthExists));

  return (
    <section
      className={styles.panel}
      data-staff-monthly-panel
      data-staff-monthly-state={snapshot.status}
      aria-labelledby="staff-monthly-title"
      aria-busy={busy}
    >
      <div className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>员工内部流程</p>
          <h2 id="staff-monthly-title">班级月度总结</h2>
          <p>汇总班级工作，审核后仅供内部查看，不作为孩子个人月报发送给家长。</p>
        </div>
        <button
          className={styles.secondaryButton}
          type="button"
          disabled={busy}
          onClick={refresh}
          data-staff-monthly-refresh
        >
          {snapshot.status === "ERROR" ? "重新连接" : "刷新"}
        </button>
      </div>
      <p
        className={snapshot.error ? styles.error : styles.message}
        role={snapshot.error ? "alert" : "status"}
        aria-live="polite"
      >
        {snapshot.error ?? snapshot.message}
      </p>
      {snapshot.requiresLogin ? (
        <a
          className={styles.secondaryButton}
          href="/web/login?next=%2Fweb%2Fstaff%2Fmonthly"
          data-staff-monthly-login
        >
          重新登录
        </a>
      ) : null}
      {showForm ? (
        <form
          className={styles.form}
          onSubmit={(event) => void save(event)}
          data-staff-monthly-form
        >
          <h3>{editor ? "编辑班级月度总结" : "填写班级月度总结"}</h3>
          {editingRow && ["RETURNED", "REVIEW_REQUIRED"].includes(editingRow.status) ? (
            <p className={styles.notice}>核对来源后保存草稿，再单独提交负责人审核。</p>
          ) : null}
          <label className={styles.field}>
            月份
            <input
              name="month"
              type="month"
              value={month}
              min="1900-01"
              max="2199-12"
              required
              disabled={busy || Boolean(editor)}
              onChange={(event) => setMonth(event.target.value)}
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
                  {Object.entries(options).map(([code, label]) => (
                    <option key={code} value={code}>
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
              data-staff-monthly-save
            >
              {editor ? "保存草稿" : "保存总结草稿"}
            </button>
            {editor ? (
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
      ) : snapshot.status === "READY" && snapshot.canCreate && monthExists && !editor ? (
        <div className={styles.form}>
          <p className={styles.notice}>该月份已有班级总结，请打开下方记录继续编辑或查看状态。</p>
          <label className={styles.field}>
            选择其他月份
            <input
              name="month"
              type="month"
              value={month}
              min="1900-01"
              max="2199-12"
              onChange={(event) => setMonth(event.target.value)}
            />
          </label>
        </div>
      ) : null}
      <div className={styles.listHeading}>
        <h3>班级总结记录</h3>
        <span>{snapshot.records.length} 份</span>
      </div>
      {snapshot.records.length ? (
        <div className={styles.list}>
          {snapshot.records.map((row, index) => (
            <article className={styles.card} key={row.id} data-staff-monthly-row={index}>
              <div className={styles.cardHeading}>
                <h4>
                  {row.month} · {row.classRef}
                </h4>
                <span className={styles.badge} data-staff-monthly-status={row.status}>
                  {statuses[row.status]} · 第 {row.version} 版
                </span>
              </div>
              <dl className={styles.details}>
                {fields.map((field) => (
                  <div key={field}>
                    <dt>{labels[field]}</dt>
                    <dd>{options[row.supplements[field]]}</dd>
                  </div>
                ))}
              </dl>
              <p className={styles.note}>
                来源数量：成长记录 {row.sourceCounts.GROWTH_RECORD} · 考勤概览{" "}
                {row.sourceCounts.ATTENDANCE_OVERVIEW} · 工作日报 {row.sourceCounts.STAFF_DAILY}
                ；来源第 {row.sourceVersion} 版。
              </p>
              {row.actions.includes("edit") || row.actions.includes("submit") ? (
                <div className={styles.actions}>
                  {row.actions.includes("edit") ? (
                    <button
                      className={styles.secondaryButton}
                      type="button"
                      disabled={busy}
                      onClick={() => edit(row)}
                      data-staff-monthly-edit={index}
                    >
                      {row.status === "DRAFT" ? "编辑草稿" : "核对并修改"}
                    </button>
                  ) : null}
                  {row.actions.includes("submit") ? (
                    <button
                      className={styles.primaryButton}
                      type="button"
                      disabled={busy || Boolean(editor)}
                      onClick={() => void submit(row)}
                      data-staff-monthly-submit={index}
                    >
                      提交负责人审核
                    </button>
                  ) : null}
                </div>
              ) : null}
              {editor?.id === row.id ? (
                <p className={styles.notice}>请先保存草稿或取消编辑，再提交负责人审核。</p>
              ) : null}
            </article>
          ))}
        </div>
      ) : snapshot.status === "READY" ? (
        <p className={styles.notice}>当前没有可查看的班级月度总结。</p>
      ) : null}
      <p className={styles.footnote}>
        此处不展示学生姓名、来源记录编号或个人学习明细；负责人审核和内部发布在管理网页完成。
      </p>
    </section>
  );
}
