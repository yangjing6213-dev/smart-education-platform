import { Button, Input, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { useEffect, useState } from "react";
import { inviteSession } from "../../../auth/runtime-session";
import type { InviteRole, InviteSessionSnapshot } from "../../../auth/invite-session";
import { hasRoleAccess } from "../../../auth/role-gate";
import "./index.css";

const roleNames: Record<InviteRole, string> = {
  PARENT: "家长",
  STAFF: "员工",
};

const rolePages: Record<InviteRole, string> = {
  PARENT: "/pages/parent/home/index",
  STAFF: "/pages/staff/workbench/index",
};

function isBusy(snapshot: InviteSessionSnapshot): boolean {
  return snapshot.status === "BUSY" || snapshot.status === "CHECKING";
}

export default function InviteLoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [snapshot, setSnapshot] = useState<InviteSessionSnapshot>(inviteSession.snapshot);

  useEffect(() => {
    let mounted = true;
    void inviteSession.restore().then((next) => {
      if (mounted) setSnapshot(next);
    });
    return () => {
      mounted = false;
    };
  }, []);

  async function submitLogin() {
    const next = await inviteSession.login(username, password);
    setPassword("");
    setSnapshot(next);
  }

  async function signOut() {
    setSnapshot(await inviteSession.logout());
  }

  function enterRole(role: InviteRole) {
    if (!hasRoleAccess(snapshot, role)) return;
    void Taro.redirectTo({ url: rolePages[role] });
  }

  const busy = isBusy(snapshot);

  return (
    <View className="auth-page">
      <View className="auth-brand">
        <View className="auth-brand-mark">心</View>
        <View>
          <Text className="auth-brand-name">同芯学园</Text>
          <Text className="auth-brand-subtitle">TONG XIN XUE YUAN</Text>
        </View>
      </View>

      <View className="auth-card">
        <Text className="auth-eyebrow">机构邀请账号</Text>
        <Text className="auth-title">欢迎回来</Text>
        <Text className="auth-description">使用机构提供的账号和密码登录。</Text>

        {snapshot.status === "READY" ? (
          <View className="auth-ready">
            <Text className="auth-ready-name">{snapshot.displayName}</Text>
            <Text className="auth-ready-role">
              {snapshot.roles.map((role) => roleNames[role]).join(" · ")}
            </Text>
            <Text className="auth-status-copy">
              已按您的账号权限显示可用服务入口。
            </Text>
            <View className="auth-role-actions">
              {snapshot.roles.map((role) => (
                <Button
                  key={role}
                  className="auth-role-button"
                  onClick={() => enterRole(role)}
                >
                  进入{roleNames[role]}
                </Button>
              ))}
            </View>
            <Button className="auth-submit" onClick={() => void signOut()}>
              退出登录
            </Button>
          </View>
        ) : (
          <View className="auth-form">
            <Input
              className="auth-input"
              value={username}
              maxlength={64}
              placeholder="受邀账号"
              placeholderClass="auth-placeholder"
              onInput={(event) => setUsername(event.detail.value)}
            />
            <Input
              className="auth-input"
              value={password}
              maxlength={128}
              password
              placeholder="登录密码"
              placeholderClass="auth-placeholder"
              onInput={(event) => setPassword(event.detail.value)}
            />
            <Button
              className="auth-submit"
              disabled={busy}
              loading={busy}
              onClick={() => void submitLogin()}
            >
              登录
            </Button>
          </View>
        )}

        <Text className={`auth-message ${snapshot.status === "ERROR" ? "auth-message-error" : ""}`}>
          {snapshot.message}
        </Text>
        <Text className="auth-footnote">账号由机构邀请开通；本页面不提供自行注册。</Text>
      </View>

      <Button
        className="auth-back"
        onClick={() => void Taro.reLaunch({ url: "/pages/visitor/home/index" })}
      >
        返回访客首页
      </Button>
    </View>
  );
}
