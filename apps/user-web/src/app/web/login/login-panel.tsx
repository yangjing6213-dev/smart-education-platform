"use client";

import { useEffect, useRef, useState } from "react";
import {
  InviteSessionClient,
  inviteNextPath,
  type InviteService,
  type InviteSessionSnapshot,
} from "../../../local-synthetic/invite-session";
import styles from "./login-panel.module.css";

const initial: InviteSessionSnapshot = {
  status: "CHECKING",
  displayName: "",
  services: [],
  message: "正在核对登录状态…",
};

export function LoginPanel() {
  const clientRef = useRef<InviteSessionClient | null>(null);
  const [snapshot, setSnapshot] = useState(initial);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [nextPath, setNextPath] = useState<InviteService["href"] | null>(null);

  useEffect(() => {
    setNextPath(inviteNextPath(new URLSearchParams(window.location.search).get("next")));
    const client = new InviteSessionClient({ baseUrl: window.location.origin });
    clientRef.current = client;
    void client.restore().then(() => {
      if (clientRef.current === client) setSnapshot(client.snapshot);
    });
    return () => {
      if (clientRef.current === client) clientRef.current = null;
      client.disconnect();
    };
  }, []);

  useEffect(() => {
    if (snapshot.status !== "READY") return;
    const target = nextPath
      ? snapshot.services.find((service) => service.href === nextPath)
      : snapshot.services.length === 1
        ? snapshot.services[0]
        : undefined;
    if (target) window.location.replace(target.href);
  }, [snapshot, nextPath]);

  const perform = async (action: (client: InviteSessionClient) => Promise<void>) => {
    const client = clientRef.current;
    if (!client) return;
    const work = action(client);
    setSnapshot(client.snapshot);
    await work;
    if (clientRef.current === client) setSnapshot(client.snapshot);
  };
  const busy = snapshot.status === "CHECKING" || snapshot.status === "BUSY";
  const unavailableTarget =
    snapshot.status === "READY" &&
    nextPath &&
    !snapshot.services.some((service) => service.href === nextPath);

  return (
    <section
      className={styles.card}
      aria-labelledby="invite-login-title"
      aria-busy={busy}
      data-invite-state={snapshot.status}
    >
      <p className={styles.eyebrow}>欢迎回来</p>
      <h2 id="invite-login-title">
        {snapshot.status === "READY" ? `你好，${snapshot.displayName}` : "账号登录"}
      </h2>
      <p
        className={styles.status}
        role={
          snapshot.status === "ERROR" ||
          snapshot.status === "DENIED" ||
          snapshot.status === "LOGOUT_FAILED"
            ? "alert"
            : "status"
        }
        aria-live="polite"
      >
        {snapshot.message}
      </p>
      {snapshot.status === "READY" ? (
        <>
          {unavailableTarget ? (
            <p className={styles.notice}>当前账号无权打开刚才的页面，请选择下面已授权的服务。</p>
          ) : null}
          <div className={styles.services}>
            {snapshot.services.map((service) => (
              <a
                key={service.href}
                href={service.href}
                className={styles.primary}
                data-invite-service
              >
                {service.label}
                <span aria-hidden="true">→</span>
              </a>
            ))}
          </div>
          <button
            type="button"
            className={styles.secondary}
            data-invite-logout
            onClick={() => void perform((client) => client.logout())}
          >
            退出并切换账号
          </button>
        </>
      ) : snapshot.status === "LOGOUT_FAILED" ? (
        <button
          type="button"
          className={styles.secondary}
          data-invite-logout
          onClick={() => void perform((client) => client.logout())}
        >
          重试退出登录
        </button>
      ) : (
        <form
          data-invite-login
          onSubmit={(event) => {
            event.preventDefault();
            const submittedPassword = password;
            setPassword("");
            void perform((client) => client.login(username, submittedPassword));
          }}
        >
          <label htmlFor="invite-username">受邀账号</label>
          <input
            id="invite-username"
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={120}
            value={username}
            onChange={(event) => setUsername(event.currentTarget.value)}
            required
            disabled={busy}
          />
          <label htmlFor="invite-password">密码</label>
          <input
            id="invite-password"
            name="password"
            type="password"
            autoComplete="current-password"
            maxLength={1024}
            value={password}
            onChange={(event) => setPassword(event.currentTarget.value)}
            required
            disabled={busy}
          />
          <button type="submit" className={styles.primary} data-invite-submit disabled={busy}>
            {busy ? "正在核对…" : "登录并进入服务"}
            <span aria-hidden="true">→</span>
          </button>
          <p className={styles.help}>暂不开放自主注册。如未收到邀请账号，请联系机构负责人。</p>
        </form>
      )}
    </section>
  );
}
