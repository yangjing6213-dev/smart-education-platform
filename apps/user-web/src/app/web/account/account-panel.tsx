"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import styles from "./account-panel.module.css";

type Membership = {
  readonly tenant_id: string;
  readonly campus_ids: readonly string[];
  readonly status: string;
  readonly capabilities: readonly string[];
};

type Account = {
  readonly actor_id: string;
  readonly username: string;
  readonly display_name: string;
  readonly account_status: "ACTIVE" | "SUSPENDED" | "REVOKED";
  readonly memberships: readonly Membership[];
};

type ApiPayload = { readonly data?: unknown; readonly error?: { readonly code?: string } };

function isAccount(value: unknown): value is Account {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Account).actor_id === "string" &&
    typeof (value as Account).username === "string" &&
    typeof (value as Account).display_name === "string" &&
    Array.isArray((value as Account).memberships)
  );
}

function requestMessage(status: number): string {
  if (status === 401) return "登录状态已失效，请重新登录。";
  if (status === 403) return "当前账号无权执行此操作。";
  if (status === 409) return "账号信息已变化或申请正在等待处理，请刷新后重试。";
  if (status === 429) return "验证次数过多，请稍后再试。";
  return "账号服务暂时无法完成请求，请稍后重试。";
}

async function accountRequest(
  path: string,
  method: "GET" | "POST" | "PATCH",
  body?: Record<string, unknown>,
): Promise<unknown> {
  const response = await fetch(`/api-local/${path}`, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    redirect: "error",
    ...(body ? { headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {}),
  });
  const payload = (await response.json().catch(() => ({}))) as ApiPayload;
  if (!response.ok) throw Object.assign(new Error(requestMessage(response.status)), { status: response.status });
  return payload.data;
}

export function AccountPanel() {
  const [account, setAccount] = useState<Account | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [usernameCurrentPassword, setUsernameCurrentPassword] = useState("");
  const [passwordCurrentPassword, setPasswordCurrentPassword] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("正在读取账号资料…");
  const [busy, setBusy] = useState(false);

  const memberships = useMemo(
    () => account?.memberships.filter((membership) => membership.status === "ACTIVE") ?? [],
    [account],
  );
  const isParent = memberships.some((membership) =>
    membership.capabilities.some((capability) => ["binding:apply", "learning:summary", "leave:apply"].includes(capability)),
  );
  const hasOrganizationRole = memberships.some((membership) =>
    membership.capabilities.some((capability) => ["care:write", "daily:create", "memberships:manage"].includes(capability)),
  );
  const canEditOwnName = isParent && !hasOrganizationRole;

  async function loadAccount() {
    setBusy(true);
    try {
      const value = await accountRequest("identity/account", "GET");
      if (!isAccount(value)) throw new Error("账号资料格式不正确，请稍后重试。");
      setAccount(value);
      setDisplayName(value.display_name);
      setTenantId((current) => current || value.memberships.find((item) => item.status === "ACTIVE")?.tenant_id || "");
      setMessage("账号资料已更新。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "账号服务暂时无法连接。");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void loadAccount();
  }, []);

  async function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      await accountRequest("identity/account/profile", "PATCH", { display_name: displayName.trim() });
      await loadAccount();
      setMessage("姓名已更新。其他设备将在下次读取时显示新姓名。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "姓名未能更新。");
    } finally {
      setBusy(false);
    }
  }

  async function requestOrganizationName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tenantId) return;
    setBusy(true);
    try {
      await accountRequest("identity/account/profile-change-requests", "POST", {
        tenant_id: tenantId,
        display_name: displayName.trim(),
      });
      setMessage("更名申请已提交，机构管理员审核后生效。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "更名申请未能提交。");
    } finally {
      setBusy(false);
    }
  }

  async function changeUsername(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      await accountRequest("identity/account/username", "PATCH", {
        current_password: usernameCurrentPassword,
        new_username: newUsername.trim(),
      });
      setUsernameCurrentPassword("");
      await endAllSessions("用户名已更新，请使用新用户名重新登录。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "用户名未能更新。");
    } finally {
      setBusy(false);
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      await accountRequest("identity/account/password", "POST", {
        current_password: passwordCurrentPassword,
        new_password: newPassword,
      });
      setPasswordCurrentPassword("");
      setNewPassword("");
      await endAllSessions("密码已更新，请使用新密码重新登录。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "密码未能更新。");
    } finally {
      setBusy(false);
    }
  }

  async function endAllSessions(successMessage: string) {
    try {
      await accountRequest("identity/account/logout-all", "POST", {});
    } catch {
      // Credential changes already revoke the sessions in the API transaction.
    }
    setMessage(successMessage);
    window.location.replace("/web/login");
  }

  async function logout() {
    setBusy(true);
    try {
      await accountRequest("identity/logout", "POST", {});
      window.location.replace("/web/login");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "退出未能确认，请重试。");
      setBusy(false);
    }
  }

  async function logoutAll() {
    setBusy(true);
    try {
      await accountRequest("identity/account/logout-all", "POST", {});
      try {
        await accountRequest("identity/logout", "POST", {});
      } catch {
        // The current session is already revoked; the next login page request clears its cookie.
      }
      window.location.replace("/web/login");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "退出其他设备未能完成。");
      setBusy(false);
    }
  }

  return (
    <section className={styles.account} aria-labelledby="account-title" aria-busy={busy}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>同芯学园 · 账号安全</p>
        <h1 id="account-title">我的账号</h1>
        <p role="status" aria-live="polite">{message}</p>
      </header>

      {!account ? (
        <div className={styles.card}>
          <a className={styles.buttonSecondary} href="/web/login">前往登录</a>
          <button className={styles.buttonSecondary} type="button" onClick={() => void loadAccount()} disabled={busy}>
            重新读取
          </button>
        </div>
      ) : (
        <>
          <section className={styles.card} aria-labelledby="account-profile-heading">
            <h2 id="account-profile-heading">账号资料</h2>
            <dl className={styles.details}>
              <div><dt>登录用户名</dt><dd>{account.username}</dd></div>
              <div><dt>账号编号</dt><dd>{account.actor_id}</dd></div>
              <div><dt>账号状态</dt><dd>{account.account_status === "ACTIVE" ? "正常" : "不可用"}</dd></div>
              <div><dt>当前角色</dt><dd>{[isParent ? "家长" : "", hasOrganizationRole ? "机构成员" : ""].filter(Boolean).join(" · ") || "已登录账号"}</dd></div>
              <div><dt>机构/校区成员关系</dt><dd>{memberships.length} 个有效机构范围，只读</dd></div>
            </dl>
          </section>

          <section className={styles.card} aria-labelledby="account-name-heading">
            <h2 id="account-name-heading">展示姓名</h2>
            <form onSubmit={(event) => void (isParent || !hasOrganizationRole ? submitProfile(event) : requestOrganizationName(event))}>
              <label htmlFor="account-display-name">显示姓名</label>
              <input id="account-display-name" autoComplete="name" maxLength={80} value={displayName} onChange={(event) => setDisplayName(event.currentTarget.value)} required />
              {canEditOwnName ? (
                <button className={styles.buttonPrimary} type="submit" disabled={busy}>保存姓名</button>
              ) : (
                <>
                  <label htmlFor="account-tenant">申请所属机构</label>
                  <select id="account-tenant" value={tenantId} onChange={(event) => setTenantId(event.currentTarget.value)} required>
                    {memberships.map((membership) => <option key={membership.tenant_id} value={membership.tenant_id}>机构范围 {membership.tenant_id.slice(0, 8)}</option>)}
                  </select>
                  <button className={styles.buttonPrimary} type="submit" disabled={busy}>提交更名申请</button>
                </>
              )}
            </form>
          </section>

          <section className={styles.card} aria-labelledby="account-security-heading">
            <h2 id="account-security-heading">登录与安全</h2>
            <form onSubmit={(event) => void changeUsername(event)}>
              <label htmlFor="account-current-password-username">当前密码</label>
              <input id="account-current-password-username" type="password" autoComplete="current-password" value={usernameCurrentPassword} onChange={(event) => setUsernameCurrentPassword(event.currentTarget.value)} required />
              <label htmlFor="account-new-username">新用户名</label>
              <input id="account-new-username" autoComplete="username" autoCapitalize="none" maxLength={64} value={newUsername} onChange={(event) => setNewUsername(event.currentTarget.value)} required />
              <button className={styles.buttonSecondary} type="submit" disabled={busy}>修改用户名</button>
            </form>
            <form onSubmit={(event) => void changePassword(event)}>
              <label htmlFor="account-current-password-password">当前密码</label>
              <input id="account-current-password-password" type="password" autoComplete="current-password" value={passwordCurrentPassword} onChange={(event) => setPasswordCurrentPassword(event.currentTarget.value)} required />
              <label htmlFor="account-new-password">新密码</label>
              <input id="account-new-password" type="password" autoComplete="new-password" minLength={12} maxLength={128} value={newPassword} onChange={(event) => setNewPassword(event.currentTarget.value)} required />
              <button className={styles.buttonSecondary} type="submit" disabled={busy}>修改密码</button>
            </form>
            <p className={styles.help}>用户名或密码变更后，所有设备都需要重新登录。忘记凭据时，请联系机构管理员重置邀请账号。</p>
            <div className={styles.actions}>
              <button className={styles.buttonSecondary} type="button" onClick={() => void logout()} disabled={busy}>退出当前设备</button>
              <button className={styles.buttonSecondary} type="button" onClick={() => void logoutAll()} disabled={busy}>退出所有设备</button>
            </div>
          </section>
        </>
      )}
    </section>
  );
}
