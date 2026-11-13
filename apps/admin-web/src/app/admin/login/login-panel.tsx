"use client";

import { useEffect, useState, type FormEvent } from "react";
import styles from "./login-panel.module.css";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function AdminLoginPanel() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => setReady(true), []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/identity/login", {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: { accept: "application/json", "content-type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      if (!response.ok) {
        const payload: unknown = await response.json().catch(() => undefined);
        const error = isRecord(payload) && isRecord(payload.error) ? payload.error : undefined;
        setMessage(
          response.status === 401
            ? "账号或密码不正确，请重试。"
            : typeof error?.message === "string"
              ? error.message
              : "登录未完成，请检查账号信息后重试。",
        );
        return;
      }
      await response.json();
      setPassword("");
      const requested = new URLSearchParams(window.location.search).get("next");
      const nextPath =
        requested === "/admin/home-content" ||
        requested === "/admin/institution" ||
        requested === "/admin/staff-daily-review" ||
        requested === "/admin/monthly-feedback-review" ||
        requested === "/admin/child-monthly-review" ||
        requested === "/admin/staff-tasks" ||
        requested === "/admin/care-record-review" ||
        requested === "/admin/binding-review" ||
        requested === "/admin/notice-review" ||
        requested === "/admin/student-transfers" ||
        requested === "/admin/meals" ||
        requested === "/admin/fees" ||
        requested === "/admin/leave-review" ||
        requested === "/admin/health-incident-review"
          ? requested
          : "/admin/binding-review";
      window.location.replace(nextPath);
    } catch {
      setMessage("暂时无法连接登录服务，请稍后重试。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      aria-busy={!ready || busy}
      className={styles.form}
      onSubmit={(event) => void submit(event)}
    >
      <label className={styles.field} htmlFor="admin-login-username">
        账号
        <input
          autoComplete="username"
          disabled={!ready || busy}
          id="admin-login-username"
          maxLength={64}
          onChange={(event) => setUsername(event.currentTarget.value)}
          required
          type="text"
          value={username}
        />
      </label>
      <label className={styles.field} htmlFor="admin-login-password">
        密码
        <input
          autoComplete="current-password"
          disabled={!ready || busy}
          id="admin-login-password"
          maxLength={128}
          onChange={(event) => setPassword(event.currentTarget.value)}
          required
          type="password"
          value={password}
        />
      </label>
      <p aria-live="polite" className={styles.message} role="status">
        {message}
      </p>
      <button className={styles.submit} disabled={!ready || busy} type="submit">
        {busy ? "正在登录…" : "登录"}
      </button>
    </form>
  );
}
