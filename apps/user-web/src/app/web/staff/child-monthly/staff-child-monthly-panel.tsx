"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { ChildMonthlyStaffReport, MonthlyFeedbackSupplements } from "@student-care/contracts";
import {
  InviteStaffChildMonthlyClient,
  type InviteStaffChildMonthlySnapshot,
  type ChildMonthlyMutationOutcome,
} from "../../../../local-synthetic/invite-staff-child-monthly-client";
import styles from "../daily/staff-daily.module.css";

const labels = {
  learningParticipation: "学习参与",
  dailyHabits: "日常习惯",
  activityParticipation: "活动参与",
  familySchoolCollaboration: "家校协作",
} as const;
const fields = Object.keys(labels) as (keyof MonthlyFeedbackSupplements)[];
const options = {
  KEEP_WATCHING: "保持关注",
  PROGRESSING: "已有进步",
  FOLLOW_UP: "需要跟进",
} as const;
const statuses = {
  DRAFT: "草稿",
  SUBMITTED: "待负责人审核",
  RETURNED: "已退回修改",
  CONFIRMED: "已确认，待发布",
  PUBLISHED: "已发布给家长",
  REVIEW_REQUIRED: "来源已变化，需要重新审核",
} as const;
const initialValues: MonthlyFeedbackSupplements = {
  learningParticipation: "KEEP_WATCHING",
  dailyHabits: "KEEP_WATCHING",
  activityParticipation: "KEEP_WATCHING",
  familySchoolCollaboration: "KEEP_WATCHING",
};
const initialSnapshot: InviteStaffChildMonthlySnapshot = {
  status: "CONNECTING",
  records: [],
  students: [],
  canCreate: false,
  message: "正在核对受邀教师身份…",
  error: null,
  requiresLogin: false,
};

export function StaffChildMonthlyPanel() {
  const clientRef = useRef<InviteStaffChildMonthlyClient | null>(null);
  const editorTitleRef = useRef<HTMLHeadingElement | null>(null);
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [studentId, setStudentId] = useState("");
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [values, setValues] = useState<MonthlyFeedbackSupplements>(initialValues);
  const [editor, setEditor] = useState<{
    id: string;
    version: number;
    studentId: string;
    studentLabel: string;
  } | null>(null);
  const busy = snapshot.status === "CONNECTING" || snapshot.status === "BUSY";

  useEffect(() => {
    if (!editor) return;
    editorTitleRef.current?.focus({ preventScroll: true });
    editorTitleRef.current?.scrollIntoView({ block: "center" });
  }, [editor]);

  useEffect(() => {
    const client = new InviteStaffChildMonthlyClient({ baseUrl: window.location.origin });
    clientRef.current = client;
    void client.restore().then(() => {
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
    operation: (
      client: InviteStaffChildMonthlyClient,
    ) => Promise<void | ChildMonthlyMutationOutcome>,
  ): Promise<void | ChildMonthlyMutationOutcome> {
    const client = clientRef.current;
    if (!client || busy) return;
    try {
      const pending = operation(client);
      setSnapshot(client.snapshot);
      const outcome = await pending;
      if (clientRef.current !== client) return;
      setSnapshot(client.snapshot);
      if (outcome === "conflict" || client.snapshot.status === "ERROR") clearEdit();
      return outcome;
    } catch {
      if (clientRef.current !== client) return;
      client.disconnect();
      clearEdit();
      setSnapshot({
        ...initialSnapshot,
        status: "ERROR",
        error: "孩子月报暂不可用，请重新连接。",
        message: "孩子月报暂不可用，请重新连接。",
      });
    }
  }
  const selectedStudent =
    editor?.studentId ??
    (snapshot.students.some((row) => row.id === studentId)
      ? studentId
      : (snapshot.students[0]?.id ?? ""));
  const existing = snapshot.records.some(
    (row) => row.studentId === selectedStudent && row.month === month,
  );
  const editingRow = editor
    ? snapshot.records.find(
        (row) =>
          row.id === editor.id && row.version === editor.version && row.actions.includes("edit"),
      )
    : undefined;
  function edit(row: ChildMonthlyStaffReport): void {
    if (busy || snapshot.status !== "READY" || !row.actions.includes("edit")) return;
    setEditor({
      id: row.id,
      version: row.version,
      studentId: row.studentId,
      studentLabel: row.studentLabel,
    });
    setStudentId(row.studentId);
    setMonth(row.month);
    setValues({ ...row.supplements });
  }
  async function save(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const outcome = await run((client) =>
      editor
        ? client.edit(editor.id, editor.version, values)
        : client.create(selectedStudent, month, values),
    );
    if (outcome === "saved") clearEdit();
  }
  function refresh(): void {
    if (busy) return;
    clearEdit();
    void run((client) => client.refresh());
  }
  return (
    <section
      className={styles.panel}
      data-staff-child-monthly-panel
      data-staff-child-monthly-state={snapshot.status}
      aria-labelledby="staff-child-monthly-title"
      aria-busy={busy}
    >
      <div className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>按孩子回顾成长</p>
          <h2 id="staff-child-monthly-title">孩子个人月报</h2>
          <p>教师填写，负责人审核并单独发布；家长只查看已批准绑定孩子的已发布摘要。</p>
        </div>
        <button
          className={styles.secondaryButton}
          type="button"
          disabled={busy}
          onClick={refresh}
          data-staff-child-monthly-refresh
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
          href="/web/login?next=%2Fweb%2Fstaff%2Fchild-monthly"
          data-staff-child-monthly-login
        >
          重新登录
        </a>
      ) : null}
      {snapshot.status === "READY" &&
      (editingRow || (snapshot.canCreate && snapshot.students.length > 0)) ? (
        <form
          className={styles.form}
          onSubmit={(event) => void save(event)}
          data-staff-child-monthly-form
        >
          <h3 ref={editorTitleRef} tabIndex={-1}>
            {editor ? "编辑孩子月报" : "填写孩子月报"}
          </h3>
          {editingRow && ["RETURNED", "REVIEW_REQUIRED"].includes(editingRow.status) ? (
            <p className={styles.notice}>请核对当前来源并保存草稿，再单独提交审核。</p>
          ) : null}
          <div className={styles.fields}>
            <label className={styles.field}>
              孩子
              <select
                name="studentId"
                value={selectedStudent}
                required
                disabled={busy || !!editor}
                onChange={(event) => {
                  setStudentId(event.target.value);
                  setValues(initialValues);
                }}
              >
                {editor && !snapshot.students.some((row) => row.id === editor.studentId) ? (
                  <option value={editor.studentId}>{editor.studentLabel}</option>
                ) : null}
                {snapshot.students.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.displayRef} · {row.classRef}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              月份
              <input
                name="month"
                type="month"
                value={month}
                min="1900-01"
                max="2199-12"
                required
                disabled={busy || !!editor}
                onChange={(event) => setMonth(event.target.value)}
              />
            </label>
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
                  {Object.entries(options).map(([code, text]) => (
                    <option key={code} value={code}>
                      {text}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          {!editor && existing ? (
            <p className={styles.notice}>
              这个孩子该月份已有月报，请编辑下方记录，或选择其他孩子、月份。
            </p>
          ) : null}
          <div className={styles.actions} style={{ justifyContent: "center" }}>
            <button
              className={styles.primaryButton}
              type="submit"
              disabled={busy || (!editor && existing)}
              data-staff-child-monthly-action="save"
            >
              {editor ? "保存草稿" : "保存月报草稿"}
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
      ) : null}
      <div className={styles.listHeading}>
        <h3>孩子月报记录</h3>
        <span>{snapshot.records.length} 份</span>
      </div>
      {snapshot.status === "READY" && snapshot.records.length ? (
        <div className={styles.list}>
          {snapshot.records.map((row, index) => (
            <article
              className={styles.card}
              key={row.id}
              data-staff-child-monthly-row={index}
              data-month={row.month}
            >
              <div className={styles.cardHeading}>
                <h4>
                  {row.studentLabel} · {row.month}
                </h4>
                <span className={styles.badge} data-staff-child-monthly-status={row.status}>
                  {statuses[row.status]} · 第 {row.version} 版
                </span>
              </div>
              <p className={styles.note}>{row.classRef}</p>
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
                {row.sourceCounts.ATTENDANCE_OVERVIEW}；来源第 {row.sourceVersion} 版。
              </p>
              <div className={styles.actions} style={{ justifyContent: "center" }}>
                {row.actions.includes("edit") ? (
                  <button
                    className={styles.secondaryButton}
                    type="button"
                    disabled={busy}
                    onClick={() => edit(row)}
                    data-staff-child-monthly-action="edit"
                  >
                    {row.status === "DRAFT" ? "编辑草稿" : "核对并修改"}
                  </button>
                ) : null}
                {row.actions.includes("submit") ? (
                  <button
                    className={styles.primaryButton}
                    type="button"
                    disabled={busy || !!editor}
                    onClick={() => void run((client) => client.submit(row.id, row.version))}
                    data-staff-child-monthly-action="submit"
                  >
                    提交负责人审核
                  </button>
                ) : null}
              </div>
              {editor?.id === row.id ? (
                <p className={styles.notice}>请先保存草稿或取消编辑，再提交审核。</p>
              ) : null}
            </article>
          ))}
        </div>
      ) : snapshot.status === "READY" ? (
        <p className={styles.notice}>当前没有可查看的孩子个人月报。</p>
      ) : null}
      <p className={styles.footnote}>
        本页不提供自动能力判断或健康结论；审核和发布在管理网页分别完成。
      </p>
    </section>
  );
}
