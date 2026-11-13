"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { FeeAccessError, FeesAdminClient, type FeeAdminSnapshot } from "./fees-client";
import styles from "./fees-panel.module.css";

const EMPTY: FeeAdminSnapshot = { students: [], documents: [] };
const STATUS: Record<string, string> = {
  AVAILABLE: "家长可查看",
  PAID: "已记录",
  VOIDED: "已作废",
  EXPIRED: "已过期",
  REVOKED: "已撤回",
};

export function FeesPanel() {
  const client = useRef<FeesAdminClient | null>(null);
  const generation = useRef(0);
  const writing = useRef(false);
  const [snapshot, setSnapshot] = useState(EMPTY);
  const [state, setState] = useState<"LOADING" | "READY" | "AUTH" | "DENIED" | "ERROR">("LOADING");
  const [message, setMessage] = useState("正在读取当前校区的费用记录…");
  const [busy, setBusy] = useState(false);
  const [documentType, setDocumentType] = useState<"FEE_ITEM" | "BILL" | "AGREEMENT">("FEE_ITEM");

  function clearAccess(error: FeeAccessError) {
    setSnapshot(EMPTY);
    setDocumentType("FEE_ITEM");
    setState(error.status === 401 ? "AUTH" : "DENIED");
    setMessage(error.message);
  }

  const reload = async (messageOnSuccess = "费用资料只用于本机合成演示，不会收款或发送通知。") => {
    const current = client.current;
    if (!current) return;
    const request = ++generation.current;
    try {
      const value = await current.list();
      if (request !== generation.current) return;
      setSnapshot(value);
      setState("READY");
      setMessage(messageOnSuccess);
    } catch (error) {
      if (request !== generation.current) return;
      if (error instanceof FeeAccessError) return clearAccess(error);
      setSnapshot(EMPTY);
      setState("ERROR");
      setMessage("费用资料暂时无法读取，请检查本机服务后重试。");
    }
  };

  async function save(
    action: (current: FeesAdminClient) => Promise<void>,
    successMessage: string,
    onSuccess?: () => void,
  ) {
    const current = client.current;
    if (!current || writing.current || state !== "READY") return;
    writing.current = true;
    ++generation.current;
    setBusy(true);
    try {
      await action(current);
      if (client.current !== current) return;
      onSuccess?.();
      await reload(successMessage);
    } catch (error) {
      if (client.current !== current) return;
      if (error instanceof FeeAccessError) clearAccess(error);
      else setMessage(error instanceof Error ? error.message : "操作未完成，请刷新后重试。");
    } finally {
      if (client.current === current) {
        writing.current = false;
        setBusy(false);
      }
    }
  }

  useEffect(() => {
    client.current = new FeesAdminClient();
    void reload();
    return () => {
      ++generation.current;
      client.current = null;
    };
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (writing.current || state !== "READY") return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const selectedType = String(form.get("document_type")) as "FEE_ITEM" | "BILL" | "AGREEMENT";
    const amount = selectedType === "AGREEMENT" ? null : Number(form.get("amount"));
    const period = String(form.get("period") ?? "");
    const value = {
      student_id: String(form.get("student_id") ?? ""),
      document_type: selectedType,
      title: String(form.get("title") ?? "").trim(),
      period,
      amount_minor: amount === null ? null : Math.round(amount * 100),
      valid_from: String(form.get("valid_from") ?? ""),
      valid_to: String(form.get("valid_to") ?? ""),
      summary: String(form.get("summary") ?? "").trim(),
    };
    if (
      amount !== null &&
      (!Number.isFinite(amount) || amount < 0 || Math.abs(value.amount_minor! / 100 - amount) > 0.000001)
    ) {
      setMessage("金额最多填写到分，请检查后再保存。");
      return;
    }
    await save(
      (current) => current.create(value),
      "费用记录已保存，已审核关系的家长可以查看。",
      () => {
        formElement.reset();
        setDocumentType("FEE_ITEM");
      },
    );
  };

  const revoke = (id: string, version: number) =>
    save((current) => current.revoke(id, version), "费用资料已撤回；家长端将不再显示金额和正文。");

  return (
    <section className={styles.page} aria-labelledby="fees-title" data-fees-state={state}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>同芯学园 · 本机合成数据</p>
          <h1 id="fees-title">费用管理</h1>
          <p>录入校区费用资料，已审核关系的家长可在网页中查看。</p>
        </div>
        <button className={styles.secondaryButton} disabled={busy} onClick={() => { if (!writing.current) void reload(); }} type="button">
          刷新列表
        </button>
      </header>

      <p className={styles.notice} role="status" aria-live="polite">{message}</p>

      {state === "READY" ? (
        <>
          <section className={styles.card} aria-labelledby="fee-create-title">
            <h2 id="fee-create-title">新增费用资料</h2>
            <p>这里只保存演示记录，不会发起真实收款、退款或通知。</p>
            <form className={styles.form} onSubmit={(event) => void submit(event)}>
              <label>
                学生
                <select name="student_id" required>
                  <option value="">请选择</option>
                  {snapshot.students.map((student) => (
                    <option key={student.id} value={student.id}>{student.label}</option>
                  ))}
                </select>
              </label>
              <label>
                资料类型
                <select
                  name="document_type"
                  required
                  value={documentType}
                  onChange={(event) =>
                    setDocumentType(event.target.value as "FEE_ITEM" | "BILL" | "AGREEMENT")
                  }
                >
                  <option value="FEE_ITEM">收费项目</option>
                  <option value="BILL">账单</option>
                  <option value="AGREEMENT">协议资料</option>
                </select>
              </label>
              <label>
                标题
                <input name="title" maxLength={120} required />
              </label>
              <label>
                所属月份
                <input name="period" type="month" required />
              </label>
              <label>
                {documentType === "AGREEMENT" ? "金额（协议不单列）" : "金额（元）"}
                <input
                  name="amount"
                  type="number"
                  min="0"
                  step="0.01"
                  required={documentType !== "AGREEMENT"}
                  disabled={documentType === "AGREEMENT"}
                />
              </label>
              <label>
                开始日期
                <input name="valid_from" type="date" required />
              </label>
              <label>
                结束日期
                <input name="valid_to" type="date" required />
              </label>
              <label className={styles.fullWidth}>
                给家长看的说明
                <textarea name="summary" maxLength={500} required rows={3} />
              </label>
              <button className={styles.primaryButton} disabled={busy || snapshot.students.length === 0} type="submit">
                {busy ? "正在保存…" : "保存并供家长查看"}
              </button>
            </form>
          </section>

          <section className={styles.card} aria-labelledby="fee-list-title">
            <h2 id="fee-list-title">当前校区记录</h2>
            {snapshot.documents.length === 0 ? (
              <p>还没有费用资料。</p>
            ) : (
              <div className={styles.list}>
                {snapshot.documents.map((document) => (
                  <article className={styles.row} key={document.id} data-fee-document>
                    <div>
                      <h3>{document.title}</h3>
                      <p>{document.studentLabel} · {document.period} · {STATUS[document.status] ?? "状态未知"}</p>
                      <p>{document.amountMinor === null ? "未单列金额" : `¥${(document.amountMinor / 100).toFixed(2)}`} · 版本 {document.version}</p>
                    </div>
                    {document.status === "AVAILABLE" ? (
                      <button
                        className={styles.secondaryButton}
                        disabled={busy}
                        onClick={() => void revoke(document.id, document.version)}
                        type="button"
                      >
                        撤回
                      </button>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      ) : state === "AUTH" ? (
        <section className={styles.card} role="alert">
          <h2>请重新登录后管理费用</h2>
          <a href="/admin/login?next=%2Fadmin%2Ffees">使用机构账号登录</a>
        </section>
      ) : state === "DENIED" ? (
        <section className={styles.card} role="alert"><h2>暂不能管理费用</h2><p>{message}</p></section>
      ) : (
        <section className={styles.card} role={state === "ERROR" ? "alert" : undefined}>
          <h2>{state === "LOADING" ? "正在读取" : "费用服务暂不可用"}</h2>
          <p>{message}</p>
        </section>
      )}
    </section>
  );
}
