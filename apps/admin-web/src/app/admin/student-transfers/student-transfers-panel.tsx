"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type {
  StudentTransferDto,
  StudentTransferListing,
} from "../../../../../../packages/contracts/src/student-transfer.js";
import {
  createTransfer,
  loadTransfers,
  reviewTransfer,
  TransferHttpError,
} from "./student-transfers-client";
import styles from "./student-transfers-panel.module.css";

const EMPTY: StudentTransferListing = {
  students: [],
  destinationClasses: [],
  requests: [],
  canRequest: false,
  canReview: false,
};
const STATUS = { PENDING: "待审核", APPROVED: "已批准", REJECTED: "已拒绝" };
const ACTION = { CREATED: "提交申请", APPROVED: "批准并完成转班", REJECTED: "拒绝申请" };
const date = (value: string) => new Date(value).toLocaleString("zh-CN", { hour12: false });

export function StudentTransfersPanel() {
  const [snapshot, setSnapshot] = useState(EMPTY);
  const [state, setState] = useState<"LOADING" | "READY" | "ERROR" | "AUTH">("LOADING");
  const [message, setMessage] = useState("正在读取转班申请…");
  const [studentId, setStudentId] = useState("");
  const [destination, setDestination] = useState("");
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const selected = snapshot.students.find((student) => student.id === studentId);
  const pendingStudentIds = new Set(
    snapshot.requests.filter((row) => row.status === "PENDING").map((row) => row.studentId),
  );

  const refresh = async () => {
    setState("LOADING");
    try {
      const value = await loadTransfers();
      if (!mounted.current) return false;
      setSnapshot(value);
      setState("READY");
      setMessage("申请后由另一名审核人员处理，批准后学生才会转入新班级。");
      return true;
    } catch (error) {
      if (!mounted.current) return false;
      const unauthenticated = error instanceof TransferHttpError && error.status === 401;
      if (error instanceof TransferHttpError && [401, 403].includes(error.status))
        setSnapshot(EMPTY);
      setState(unauthenticated ? "AUTH" : "ERROR");
      setMessage(error instanceof Error ? error.message : "暂时无法读取，请刷新重试。");
      return false;
    }
  };

  useEffect(() => {
    mounted.current = true;
    void refresh();
    return () => {
      mounted.current = false;
    };
  }, []);

  const perform = async (operation: () => Promise<StudentTransferDto>, success: string) => {
    if (inFlight.current || state !== "READY") return;
    inFlight.current = true;
    setBusy(true);
    try {
      await operation();
      if (!mounted.current) return;
      setStudentId("");
      setDestination("");
      const loaded = await refresh();
      if (mounted.current)
        setMessage(loaded ? success : `${success} 列表刷新未完成，请点击刷新列表。`);
    } catch (error) {
      if (!mounted.current) return;
      const unauthenticated = error instanceof TransferHttpError && error.status === 401;
      if (error instanceof TransferHttpError && [401, 403].includes(error.status))
        setSnapshot(EMPTY);
      setState(unauthenticated ? "AUTH" : "ERROR");
      setMessage(error instanceof Error ? error.message : "操作结果尚未确认，请先刷新列表。");
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (
      !selected ||
      !destination ||
      selected.classRef === destination ||
      pendingStudentIds.has(studentId)
    )
      return;
    void perform(
      () => createTransfer({ student_id: studentId, destination_class_ref: destination }),
      "转班申请已提交，等待另一名审核人员处理。",
    );
  };
  const ready = state === "READY" && !busy;
  const pending = snapshot.requests.filter((row) => row.status === "PENDING");
  const history = snapshot.requests.filter((row) => row.status !== "PENDING");
  const renderRequest = (row: StudentTransferDto) => (
    <article className={styles.request} key={row.id} data-transfer-id={row.id}>
      <div className={styles.row}>
        <h3>{row.studentLabel}</h3>
        <span className={styles.status}>{STATUS[row.status]}</span>
      </div>
      <p>
        {row.sourceClassRef} → {row.destinationClassRef}
      </p>
      <p className={styles.muted}>
        {row.isOwnRequest ? "由我提交 · " : "提交时间 · "}
        {date(row.requestedAt)}
      </p>
      {row.status === "PENDING" && row.isOwnRequest && (
        <p className={styles.muted}>需要另一名有审核权的员工处理。</p>
      )}
      {row.canReview && (
        <>
          {!row.canApprove && <p role="note">学生或班级状态已变化，可拒绝本次申请后重新发起。</p>}
          <div className={styles.actions}>
            <button
              type="button"
              disabled={!ready || !row.canApprove}
              onClick={() =>
                void perform(
                  () =>
                    reviewTransfer(row.id, { decision: "APPROVE", expected_version: row.version }),
                  "审核已通过，学生已转入新班级。",
                )
              }
            >
              批准转班
            </button>
            <button
              type="button"
              className={styles.secondary}
              disabled={!ready}
              onClick={() =>
                void perform(
                  () =>
                    reviewTransfer(row.id, { decision: "REJECT", expected_version: row.version }),
                  "申请已拒绝，学生班级未更改。",
                )
              }
            >
              拒绝申请
            </button>
          </div>
        </>
      )}
      <details className={styles.audit}>
        <summary>操作记录（{row.events.length}）</summary>
        <ol>
          {row.events.map((entry) => (
            <li key={entry.version}>
              {ACTION[entry.action]} · {date(entry.occurredAt)}
            </li>
          ))}
        </ol>
      </details>
    </article>
  );

  return (
    <section
      className={styles.page}
      data-student-transfers-state={state}
      aria-busy={busy || state === "LOADING"}
    >
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>当前校区 · 学生管理</p>
          <h1>学生转班审核</h1>
          <p>选择学生和目标班级，即可提交转班申请。</p>
        </div>
        <button
          type="button"
          className={styles.refresh}
          disabled={busy || state === "LOADING"}
          onClick={() => void refresh()}
        >
          刷新列表
        </button>
      </header>
      <p role="status" aria-live="polite" className={styles.notice}>
        {message}
      </p>
      {state === "AUTH" && <a href="/admin/login?next=%2Fadmin%2Fstudent-transfers">重新登录</a>}
      {snapshot.canRequest && (
        <section className={styles.card} aria-label="发起转班申请">
          <h2>发起申请</h2>
          <form className={styles.form} onSubmit={submit}>
            <label>
              学生
              <select
                value={studentId}
                onChange={(event) => {
                  setStudentId(event.target.value);
                  setDestination("");
                }}
                required
                disabled={!ready}
              >
                <option value="">请选择学生</option>
                {snapshot.students.map((student) => (
                  <option
                    key={student.id}
                    value={student.id}
                    disabled={pendingStudentIds.has(student.id)}
                  >
                    {student.label} · {student.classRef}
                    {pendingStudentIds.has(student.id) ? "（已有待审申请）" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label>
              目标班级
              <select
                value={destination}
                onChange={(event) => setDestination(event.target.value)}
                required
                disabled={!ready || !selected}
              >
                <option value="">请选择同校区班级</option>
                {snapshot.destinationClasses
                  .filter((entry) => entry !== selected?.classRef)
                  .map((entry) => (
                    <option key={entry} value={entry}>
                      {entry}
                    </option>
                  ))}
              </select>
            </label>
            <div className={styles.actions}>
              <button
                type="submit"
                disabled={!ready || !selected || !destination || pendingStudentIds.has(studentId)}
              >
                提交转班申请
              </button>
            </div>
          </form>
          {!snapshot.students.length && (
            <p className={styles.muted}>当前没有可申请转班的学生，请检查负责班级的分配。</p>
          )}
          <p className={styles.muted}>目标班级需在本校区有在读学生。</p>
        </section>
      )}
      <section className={styles.card} aria-label="待审核申请">
        <h2>待审核（{pending.length}）</h2>
        {pending.length ? (
          pending.map(renderRequest)
        ) : (
          <p className={styles.muted}>暂无待审核申请。</p>
        )}
      </section>
      <section className={styles.card} aria-label="转班历史">
        <h2>处理记录</h2>
        {history.length ? (
          history.map(renderRequest)
        ) : (
          <p className={styles.muted}>暂无已处理的转班申请。</p>
        )}
      </section>
    </section>
  );
}
