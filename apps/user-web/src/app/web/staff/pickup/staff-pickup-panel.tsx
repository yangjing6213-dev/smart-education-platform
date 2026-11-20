"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import styles from "./staff-pickup.module.css";

type Preview = {
  readonly studentLabel: string;
  readonly classLabel: string;
  readonly recipientLabel: string;
};
type Checks = { student: boolean; recipient: boolean; authorization: boolean };
type State = "IDLE" | "PREVIEWING" | "READY" | "CONFIRMING" | "DONE" | "ERROR";
const TOKEN = /^[A-Za-z0-9_-]{43}$/u;
const noChecks: Checks = { student: false, recipient: false, authorization: false };

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function request(path: string, credential: string, checks?: Checks): Promise<unknown> {
  const response = await fetch(`/api-local/staff/pickup/credentials/${path}`, {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    redirect: "error",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ credential, ...(checks ? { checks } : {}) }),
    signal: AbortSignal.timeout(8000),
  });
  const payload: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    const code = record(payload) && record(payload.error) ? payload.error.code : undefined;
    if (response.status === 401 || response.status === 403)
      throw new Error("当前账号没有接送核验权限，请重新登录或联系机构管理员。");
    if (response.status === 409 || code === "STATE_CONFLICT")
      throw new Error("核验未完成。请确认凭证未过期、未使用且现场信息一致，再让家长重新出示凭证。");
    throw new Error("接送核验暂时不可用，请稍后重试。");
  }
  if (!record(payload) || !record(payload.data))
    throw new Error("接送核验暂时不可用，请稍后重试。");
  return payload.data;
}

function parsePreview(value: unknown): Preview | null {
  if (
    !record(value) ||
    typeof value.studentLabel !== "string" ||
    typeof value.classLabel !== "string" ||
    typeof value.recipientLabel !== "string" ||
    !value.studentLabel.trim() ||
    !value.classLabel.trim() ||
    !value.recipientLabel.trim()
  )
    return null;
  return {
    studentLabel: value.studentLabel,
    classLabel: value.classLabel,
    recipientLabel: value.recipientLabel,
  };
}

export function StaffPickupPanel() {
  const [state, setState] = useState<State>("IDLE");
  const [credential, setCredential] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [checks, setChecks] = useState<Checks>(noChecks);
  const [message, setMessage] = useState("请输入家长当前展示的一次性接送凭证。");
  const busy = state === "PREVIEWING" || state === "CONFIRMING";
  const allChecked = checks.student && checks.recipient && checks.authorization;

  function updateCredential(value: string) {
    setCredential(value.replace(/\s/gu, "").slice(0, 43));
    if (state === "DONE" || state === "ERROR") {
      setState("IDLE");
      setPreview(null);
      setChecks(noChecks);
      setMessage("请输入家长当前展示的一次性接送凭证。");
    }
  }

  async function previewCredential(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!TOKEN.test(credential)) {
      setPreview(null);
      setChecks(noChecks);
      setState("ERROR");
      setCredential("");
      setMessage("凭证格式无效。请让家长重新打开接送码后再试。");
      return;
    }
    setState("PREVIEWING");
    setPreview(null);
    setChecks(noChecks);
    setMessage("正在核对凭证…");
    try {
      const value = parsePreview(await request("preview", credential));
      if (!value) throw new Error("接送核验暂时不可用，请稍后重试。");
      setPreview(value);
      setState("READY");
      setMessage("请当面逐项核对以下信息，全部确认后才能记录离校。");
    } catch (error) {
      setState("ERROR");
      setCredential("");
      setMessage(error instanceof Error ? error.message : "接送核验暂时不可用，请稍后重试。");
    }
  }

  async function confirmCredential() {
    if (state !== "READY" || !preview || !TOKEN.test(credential) || !allChecked) return;
    setState("CONFIRMING");
    setMessage("正在提交核验结果…");
    try {
      const result = await request("confirm", credential, checks);
      if (!record(result) || result.status !== "COMPLETED")
        throw new Error("核验暂未完成，请刷新后确认记录状态。");
      setCredential("");
      setChecks(noChecks);
      setState("DONE");
      setMessage("核验完成，服务端已记录学生离校。一次性凭证已清除。");
    } catch (error) {
      setCredential("");
      setPreview(null);
      setChecks(noChecks);
      setState("ERROR");
      setMessage(error instanceof Error ? error.message : "接送核验暂时不可用，请稍后重试。");
    }
  }

  function updateCheck(key: keyof Checks, checked: boolean) {
    setChecks((current) => ({ ...current, [key]: checked }));
  }

  return (
    <section
      aria-labelledby="staff-pickup-title"
      aria-busy={busy}
      className={styles.panel}
      data-staff-pickup-state={state}
    >
      <div className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>接送服务 · 一次性凭证</p>
          <h2 id="staff-pickup-title">核对后确认离校</h2>
          <p>只接受家长当前有效的凭证。核验成功后，同一凭证不能重复使用。</p>
        </div>
      </div>

      {state !== "DONE" ? (
        <form className={styles.form} onSubmit={previewCredential}>
          <label className={styles.field} htmlFor="staff-pickup-credential">
            家长展示的接送凭证
            <input
              autoComplete="off"
              data-staff-pickup-credential
              id="staff-pickup-credential"
              inputMode="text"
              maxLength={43}
              onChange={(event) => updateCredential(event.currentTarget.value)}
              spellCheck={false}
              type="password"
              value={credential}
            />
          </label>
          <p className={styles.note}>
            凭证只发送到本站安全接口，不会写入网址、浏览器存储或页面日志。
          </p>
          <button
            className={styles.primaryButton}
            data-staff-pickup-preview
            disabled={busy || credential.length !== 43}
            type="submit"
          >
            {state === "PREVIEWING" ? "正在核对…" : "核对凭证"}
          </button>
        </form>
      ) : null}

      {preview && state !== "ERROR" ? (
        <div className={styles.preview} data-staff-pickup-preview-state={state}>
          <h3>请当面核对</h3>
          <dl className={styles.details}>
            <div>
              <dt>学生</dt>
              <dd>{preview.studentLabel}</dd>
            </div>
            <div>
              <dt>班级</dt>
              <dd>{preview.classLabel}</dd>
            </div>
            <div>
              <dt>授权接送人</dt>
              <dd>{preview.recipientLabel}</dd>
            </div>
          </dl>
          {state === "READY" ? (
            <fieldset className={styles.checks}>
              <legend>逐项确认后才能完成核验</legend>
              <label>
                <input
                  checked={checks.student}
                  data-pickup-check="student"
                  onChange={(event) => updateCheck("student", event.currentTarget.checked)}
                  type="checkbox"
                />
                学生本人及照片/身份信息相符
              </label>
              <label>
                <input
                  checked={checks.recipient}
                  data-pickup-check="recipient"
                  onChange={(event) => updateCheck("recipient", event.currentTarget.checked)}
                  type="checkbox"
                />
                接送人信息与现场人员相符
              </label>
              <label>
                <input
                  checked={checks.authorization}
                  data-pickup-check="authorization"
                  onChange={(event) => updateCheck("authorization", event.currentTarget.checked)}
                  type="checkbox"
                />
                授权状态有效，且学生已登记到校
              </label>
            </fieldset>
          ) : null}
          {state === "READY" ? (
            <button
              className={styles.primaryButton}
              data-staff-pickup-confirm
              disabled={!allChecked || busy}
              onClick={() => void confirmCredential()}
              type="button"
            >
              {busy ? "正在提交…" : "确认并记录离校"}
            </button>
          ) : null}
        </div>
      ) : null}

      <p
        className={
          state === "ERROR" ? styles.error : state === "DONE" ? styles.success : styles.message
        }
        data-staff-pickup-message
        role={state === "ERROR" ? "alert" : "status"}
        aria-live="polite"
      >
        {message}
      </p>

      {state === "DONE" ? (
        <div className={styles.successCard} data-staff-pickup-receipt>
          <h3>离校记录已完成</h3>
          <p>
            {preview?.studentLabel} · {preview?.classLabel}
          </p>
          <p>接送人：{preview?.recipientLabel}</p>
          <button
            className={styles.secondaryButton}
            onClick={() => {
              setState("IDLE");
              setPreview(null);
              setMessage("请输入家长当前展示的一次性接送凭证。");
            }}
            type="button"
          >
            开始下一次核验
          </button>
        </div>
      ) : null}
    </section>
  );
}
