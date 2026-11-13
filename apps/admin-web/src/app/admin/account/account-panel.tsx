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
type ChangeRequest = {
  readonly id: string;
  readonly actor_id: string;
  readonly display_name: string;
  readonly tenant_id: string;
  readonly status: "PENDING";
  readonly version: number;
  readonly created_at: string;
};
type ApiPayload = { readonly data?: unknown; readonly error?: { readonly message?: string } };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isAccount(value: unknown): value is Account {
  return isRecord(value) && typeof value.actor_id === "string" && typeof value.username === "string" &&
    typeof value.display_name === "string" && Array.isArray(value.memberships);
}
function isChange(value: unknown): value is ChangeRequest {
  return isRecord(value) && typeof value.id === "string" && typeof value.actor_id === "string" &&
    typeof value.display_name === "string" && typeof value.tenant_id === "string" &&
    value.status === "PENDING" && Number.isSafeInteger(value.version) && typeof value.created_at === "string";
}
function messageFor(status: number): string {
  if (status === 401) return "登录状态已失效，请重新登录。";
  if (status === 403) return "当前账号没有管理此机构账号申请的权限。";
  if (status === 409) return "申请状态已变化，请刷新后重试。";
  return "账号服务暂时无法完成请求，请稍后重试。";
}

async function request(path: string, method: "GET" | "POST" | "PATCH", body?: Record<string, unknown>) {
  const response = await fetch(`/api/admin/${path}`, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    redirect: "error",
    ...(body ? { headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {}),
  });
  const payload = (await response.json().catch(() => ({}))) as ApiPayload;
  if (!response.ok) throw Object.assign(new Error(messageFor(response.status)), { status: response.status });
  return payload.data;
}

export function AccountPanel() {
  const [account, setAccount] = useState<Account | null>(null);
  const [tenantId, setTenantId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [usernameCurrentPassword, setUsernameCurrentPassword] = useState("");
  const [passwordCurrentPassword, setPasswordCurrentPassword] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [message, setMessage] = useState("正在读取账号资料…");
  const [busy, setBusy] = useState(false);
  const memberships = useMemo(() => account?.memberships.filter((item) => item.status === "ACTIVE") ?? [], [account]);
  const manageableTenants = useMemo(
    () => memberships.filter((item) => item.capabilities.includes("memberships:manage")),
    [memberships],
  );

  async function loadAccount() {
    setBusy(true);
    try {
      const value = await request("identity/account", "GET");
      if (!isAccount(value)) throw new Error("账号资料格式不正确。");
      setAccount(value);
      setDisplayName(value.display_name);
      const nextTenant = manageableTenants.find((item) => item.tenant_id === tenantId)?.tenant_id ??
        value.memberships.find((item) => item.status === "ACTIVE" && item.capabilities.includes("memberships:manage"))?.tenant_id ?? "";
      if (nextTenant) {
        setTenantId(nextTenant);
        await loadRequests(nextTenant);
      } else {
        setMessage("已读取账号资料；当前账号没有机构更名审核权限。");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "账号服务暂时无法连接。");
    } finally {
      setBusy(false);
    }
  }

  async function loadRequests(tenant: string) {
    const value = await request(`identity/profile-change-requests?tenant_id=${encodeURIComponent(tenant)}`, "GET");
    const rows = isRecord(value) && Array.isArray(value.data) ? value.data : value;
    if (!Array.isArray(rows) || !rows.every(isChange)) throw new Error("更名申请列表格式不正确。");
    setRequests(rows);
  }

  useEffect(() => { void loadAccount(); }, []);

  async function requestNameChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tenantId) return;
    setBusy(true);
    try {
      await request("identity/account/profile-change-requests", "POST", { tenant_id: tenantId, display_name: displayName.trim() });
      setMessage("更名申请已提交，请等待同机构管理员审核。");
    } catch (error) { setMessage(error instanceof Error ? error.message : "更名申请未能提交。"); }
    finally { setBusy(false); }
  }

  async function changeUsername(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      await request("identity/account/username", "PATCH", { current_password: usernameCurrentPassword, new_username: newUsername.trim() });
      window.location.replace("/admin/login");
    } catch (error) { setMessage(error instanceof Error ? error.message : "用户名未能更新。"); }
    finally { setBusy(false); }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      await request("identity/account/password", "POST", { current_password: passwordCurrentPassword, new_password: newPassword });
      window.location.replace("/admin/login");
    } catch (error) { setMessage(error instanceof Error ? error.message : "密码未能更新。"); }
    finally { setBusy(false); }
  }

  async function logoutAll() {
    setBusy(true);
    try {
      await request("identity/account/logout-all", "POST", {});
      window.location.replace("/admin/login");
    } catch (error) { setMessage(error instanceof Error ? error.message : "退出所有设备未能完成。"); setBusy(false); }
  }

  async function review(row: ChangeRequest, action: "approve" | "reject") {
    setBusy(true);
    try {
      await request(`identity/profile-change-requests/${row.id}/${action}?tenant_id=${encodeURIComponent(row.tenant_id)}`, "POST", { expected_version: row.version });
      await loadRequests(row.tenant_id);
      setMessage(action === "approve" ? "已批准更名申请。" : "已退回更名申请。");
    } catch (error) { setMessage(error instanceof Error ? error.message : "审核未能完成。"); }
    finally { setBusy(false); }
  }

  return (
    <section className={styles.page} aria-labelledby="account-title" aria-busy={busy}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>机构管理 · 账号安全</p>
        <h1 id="account-title">我的账号</h1>
        <p role="status" aria-live="polite">{message}</p>
      </header>
      {!account ? (
        <section className={styles.card}><a className={styles.secondary} href="/admin/login?next=%2Fadmin%2Faccount">前往登录</a><button className={styles.secondary} type="button" onClick={() => void loadAccount()} disabled={busy}>重新读取</button></section>
      ) : (
        <>
          <section className={styles.card} aria-labelledby="profile-heading">
            <h2 id="profile-heading">账号资料</h2>
            <dl className={styles.details}>
              <div><dt>登录用户名</dt><dd>{account.username}</dd></div>
              <div><dt>账号编号</dt><dd>{account.actor_id}</dd></div>
              <div><dt>账号状态</dt><dd>{account.account_status === "ACTIVE" ? "正常" : "不可用"}</dd></div>
              <div><dt>成员关系</dt><dd>{memberships.length} 个有效机构范围，只读</dd></div>
              {memberships.map((item, index) => <div key={item.tenant_id}><dt>机构范围 {index + 1}</dt><dd>{item.campus_ids.length} 个授权校区</dd></div>)}
            </dl>
          </section>
          <section className={styles.card} aria-labelledby="name-heading">
            <h2 id="name-heading">机构身份名称</h2>
            <p>机构名称修改需经同机构管理员审核；审核范围由服务端成员关系确定。</p>
            <form onSubmit={(event) => void requestNameChange(event)}>
              <label htmlFor="admin-account-name">申请显示姓名</label>
              <input id="admin-account-name" value={displayName} onChange={(event) => setDisplayName(event.currentTarget.value)} maxLength={80} required />
              <label htmlFor="admin-account-tenant">申请机构</label>
              <select id="admin-account-tenant" value={tenantId} onChange={(event) => setTenantId(event.currentTarget.value)} required>
                {memberships.filter((item) => item.status === "ACTIVE").map((item, index) => <option key={item.tenant_id} value={item.tenant_id}>机构范围 {index + 1}</option>)}
              </select>
              <button className={styles.primary} type="submit" disabled={busy || !tenantId}>提交更名申请</button>
            </form>
          </section>
          {manageableTenants.length ? (
            <section className={styles.card} aria-labelledby="review-heading">
              <div className={styles.row}><h2 id="review-heading">同机构待审核更名</h2><label htmlFor="review-tenant">审核机构</label><select id="review-tenant" value={tenantId} onChange={(event) => { setTenantId(event.currentTarget.value); void loadRequests(event.currentTarget.value); }}>
                {manageableTenants.map((item) => <option key={item.tenant_id} value={item.tenant_id}>{item.tenant_id}</option>)}
              </select></div>
              {requests.length ? requests.map((row) => (
                <article className={styles.request} key={row.id}>
                  <p>账号 {row.actor_id} 申请姓名“{row.display_name}”</p>
                  <p>提交于 {new Date(row.created_at).toLocaleString("zh-CN")}</p>
                  <div className={styles.actions}>
                    <button className={styles.primary} type="button" disabled={busy} onClick={() => void review(row, "approve")}>批准</button>
                    <button className={styles.secondary} type="button" disabled={busy} onClick={() => void review(row, "reject")}>退回</button>
                  </div>
                </article>
              )) : <p>当前机构暂无待审核申请。</p>}
            </section>
          ) : null}
          <section className={styles.card} aria-labelledby="security-heading">
            <h2 id="security-heading">登录与安全</h2>
            <form onSubmit={(event) => void changeUsername(event)}>
              <label htmlFor="admin-account-current-username">当前密码</label><input id="admin-account-current-username" type="password" autoComplete="current-password" value={usernameCurrentPassword} onChange={(event) => setUsernameCurrentPassword(event.currentTarget.value)} required />
              <label htmlFor="admin-account-new-username">新用户名</label><input id="admin-account-new-username" autoComplete="username" value={newUsername} onChange={(event) => setNewUsername(event.currentTarget.value)} maxLength={64} required />
              <button className={styles.secondary} type="submit" disabled={busy}>修改用户名并重新登录</button>
            </form>
            <form onSubmit={(event) => void changePassword(event)}>
              <label htmlFor="admin-account-current-password">当前密码</label><input id="admin-account-current-password" type="password" autoComplete="current-password" value={passwordCurrentPassword} onChange={(event) => setPasswordCurrentPassword(event.currentTarget.value)} required />
              <label htmlFor="admin-account-new-password">新密码</label><input id="admin-account-new-password" type="password" autoComplete="new-password" minLength={12} maxLength={128} value={newPassword} onChange={(event) => setNewPassword(event.currentTarget.value)} required />
              <button className={styles.secondary} type="submit" disabled={busy}>修改密码并重新登录</button>
            </form>
            <p>修改用户名或密码后，原设备会话失效，需要重新登录。</p>
            <div className={styles.actions}>
              <button className={styles.secondary} type="button" onClick={() => { void request("identity/logout", "POST", {}).then(() => window.location.replace("/admin/login")); }} disabled={busy}>退出当前设备</button>
              <button className={styles.secondary} type="button" onClick={() => void logoutAll()} disabled={busy}>退出所有设备</button>
            </div>
          </section>
        </>
      )}
    </section>
  );
}
