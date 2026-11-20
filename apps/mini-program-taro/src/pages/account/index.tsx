import { Button, Input, Picker, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { useEffect, useMemo, useState } from "react";
import { inviteSession } from "../../auth/runtime-session";
import { hasRoleAccess } from "../../auth/role-gate";
import "./index.css";

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
type Payload = { readonly data?: unknown };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isAccount(value: unknown): value is Account {
  return isRecord(value) && typeof value.actor_id === "string" && typeof value.username === "string" &&
    typeof value.display_name === "string" && Array.isArray(value.memberships);
}
function errorMessage(error: unknown): string {
  if (isRecord(error) && typeof error.statusCode === "number") {
    if (error.statusCode === 401) return "登录已过期，请重新登录。";
    if (error.statusCode === 403) return "当前账号没有此项账号管理权限。";
    if (error.statusCode === 409) return "账号或申请状态已变化，请刷新后重试。";
    if (error.statusCode === 429) return "验证次数过多，请稍后再试。";
  }
  return "账号服务暂时无法完成请求，请稍后重试。";
}

export default function AccountPage() {
  const [account, setAccount] = useState<Account | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [usernameCurrentPassword, setUsernameCurrentPassword] = useState("");
  const [passwordCurrentPassword, setPasswordCurrentPassword] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("正在核对当前登录账号…");
  const [busy, setBusy] = useState(false);
  const roles = inviteSession.snapshot.roles;
  const memberships = useMemo(() => account?.memberships.filter((item) => item.status === "ACTIVE") ?? [], [account]);
  const hasOrganizationRole = memberships.some((item) => item.capabilities.some((value) =>
    ["memberships:manage", "care:write", "daily:create"].includes(value),
  ));
  const canEditOwnName = roles.includes("PARENT") && !hasOrganizationRole;

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const session = await inviteSession.restore();
      if (!mounted) return;
      if (!hasRoleAccess(session, "PARENT") && !hasRoleAccess(session, "STAFF")) {
        void Taro.redirectTo({ url: "/pages/auth/login/index" });
        return;
      }
      try {
        const value = await inviteSession.getAuthenticated("/identity/account");
        if (!mounted) return;
        if (!isAccount(value)) throw new Error("账号资料格式不正确。");
        setAccount(value);
        setDisplayName(value.display_name);
        setTenantId(value.memberships.find((item) => item.status === "ACTIVE")?.tenant_id ?? "");
        setMessage("账号已确认；角色、机构和校区范围由服务端管理。");
      } catch (error) {
        if (mounted) setMessage(errorMessage(error));
      }
    })();
    return () => { mounted = false; };
  }, []);

  async function updateName() {
    if (!displayName.trim()) return;
    setBusy(true);
    try {
      if (canEditOwnName) {
        const result = await inviteSession.patchAuthenticated("/identity/account/profile", { display_name: displayName.trim() });
        if (isAccount(result)) setAccount(result);
        setMessage("显示姓名已更新。");
      } else {
        await inviteSession.postAuthenticated("/identity/account/profile-change-requests", {
          tenant_id: tenantId,
          display_name: displayName.trim(),
        });
        setMessage("更名申请已提交，请等待机构管理员审核。");
      }
    } catch (error) { setMessage(errorMessage(error)); }
    finally { setBusy(false); }
  }

  async function changeUsername() {
    setBusy(true);
    try {
      await inviteSession.patchAuthenticated("/identity/account/username", {
        current_password: usernameCurrentPassword,
        new_username: newUsername.trim(),
      });
      await inviteSession.logout();
      setMessage("用户名已更新，请使用新用户名重新登录。");
      void Taro.redirectTo({ url: "/pages/auth/login/index" });
    } catch (error) { setMessage(errorMessage(error)); }
    finally { setBusy(false); }
  }

  async function changePassword() {
    setBusy(true);
    try {
      await inviteSession.postAuthenticated("/identity/account/password", {
        current_password: passwordCurrentPassword,
        new_password: newPassword,
      });
      await inviteSession.logout();
      setMessage("密码已更新，请使用新密码重新登录。");
      void Taro.redirectTo({ url: "/pages/auth/login/index" });
    } catch (error) { setMessage(errorMessage(error)); }
    finally { setBusy(false); }
  }

  async function logoutAll() {
    setBusy(true);
    try {
      await inviteSession.postAuthenticated("/identity/account/logout-all", {});
      await inviteSession.logout();
      void Taro.redirectTo({ url: "/pages/auth/login/index" });
    } catch (error) { setMessage(errorMessage(error)); setBusy(false); }
  }

  async function logout() {
    await inviteSession.logout();
    void Taro.redirectTo({ url: "/pages/auth/login/index" });
  }

  return (
    <View className="account-page" aria-busy={busy}>
      <View className="account-brand"><Text className="account-brand-name">同芯学园</Text><Text className="account-brand-subtitle">TONG XIN XUE YUAN</Text></View>
      <View className="account-card account-heading">
        <Text className="account-eyebrow">账号安全 · 个人资料</Text>
        <Text className="account-title">我的账号</Text>
        <Text className="account-message" aria-live="polite">{message}</Text>
      </View>
      {account ? <>
        <View className="account-card">
          <Text className="account-section-title">账号资料</Text>
          <View className="account-detail"><Text>登录用户名</Text><Text>{account.username}</Text></View>
          <View className="account-detail"><Text>账号编号</Text><Text>{account.actor_id}</Text></View>
          <View className="account-detail"><Text>账号状态</Text><Text>{account.account_status === "ACTIVE" ? "正常" : "不可用"}</Text></View>
          <View className="account-detail"><Text>当前角色</Text><Text>{roles.map((role) => role === "PARENT" ? "家长" : "员工").join(" · ")}</Text></View>
          <View className="account-detail"><Text>机构范围</Text><Text>{memberships.length} 个有效范围，只读</Text></View>
        </View>
        <View className="account-card">
          <Text className="account-section-title">展示姓名</Text>
          <Text className="account-copy">{canEditOwnName ? "此姓名显示在当前账号的新页面和新操作中。" : "机构身份更名需要机构管理员审核，历史记录会保留原姓名快照。"}</Text>
          <Input className="account-input" value={displayName} maxlength={80} onInput={(event) => setDisplayName(event.detail.value)} placeholder="请输入展示姓名" />
          {!canEditOwnName && memberships.length > 1 ? <Picker mode="selector" range={memberships.map((_, index) => `机构范围 ${index + 1}`)} value={Math.max(0, memberships.findIndex((item) => item.tenant_id === tenantId))} onChange={(event) => setTenantId(memberships[Number(event.detail.value)]?.tenant_id ?? "")}><View className="account-picker"><Text>申请所属机构：机构范围 {Math.max(1, memberships.findIndex((item) => item.tenant_id === tenantId) + 1)}</Text><Text>⌄</Text></View></Picker> : !canEditOwnName ? <Text className="account-copy">更名申请将提交至当前授权机构。</Text> : null}
          <Button className="account-primary" disabled={busy || !displayName.trim() || (!canEditOwnName && !tenantId)} onClick={() => void updateName()}>{canEditOwnName ? "保存姓名" : "提交更名申请"}</Button>
        </View>
        <View className="account-card">
          <Text className="account-section-title">登录与安全</Text>
          <View className="account-form">
            <Text className="account-label">修改用户名</Text>
            <Input className="account-input" value={usernameCurrentPassword} password onInput={(event) => setUsernameCurrentPassword(event.detail.value)} placeholder="当前密码" />
            <Input className="account-input" value={newUsername} maxlength={64} onInput={(event) => setNewUsername(event.detail.value)} placeholder="新用户名" />
            <Button className="account-secondary" disabled={busy || !usernameCurrentPassword || !newUsername.trim()} onClick={() => void changeUsername()}>修改用户名并重新登录</Button>
          </View>
          <View className="account-form">
            <Text className="account-label">修改密码</Text>
            <Input className="account-input" value={passwordCurrentPassword} password onInput={(event) => setPasswordCurrentPassword(event.detail.value)} placeholder="当前密码" />
            <Input className="account-input" value={newPassword} password maxlength={128} onInput={(event) => setNewPassword(event.detail.value)} placeholder="至少 12 位新密码" />
            <Button className="account-secondary" disabled={busy || !passwordCurrentPassword || newPassword.length < 12} onClick={() => void changePassword()}>修改密码并重新登录</Button>
          </View>
          <Button className="account-secondary" disabled={busy} onClick={() => void logoutAll()}>退出所有设备</Button>
          <Button className="account-secondary" disabled={busy} onClick={() => void logout()}>退出当前设备</Button>
        </View>
      </> : <View className="account-card"><Text className="account-copy">正在读取或无法读取账号资料，请重新登录后再试。</Text><Button className="account-secondary" onClick={() => void Taro.redirectTo({ url: "/pages/auth/login/index" })}>前往登录</Button></View>}
      <Button className="account-secondary account-home" onClick={() => void Taro.navigateBack()}>返回上一页</Button>
    </View>
  );
}
