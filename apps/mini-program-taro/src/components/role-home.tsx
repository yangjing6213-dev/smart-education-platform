import Taro from "@tarojs/taro";
import { Button, Text, View } from "@tarojs/components";
import { useEffect, useState } from "react";
import { inviteSession } from "../auth/runtime-session";
import { hasRoleAccess } from "../auth/role-gate";
import type { InviteRole } from "../auth/invite-session";
import "./role-home.css";

type RoleHomeProps = {
  readonly requiredRole: InviteRole;
  readonly title: string;
  readonly description: string;
};

export function RoleHome({ requiredRole, title, description }: RoleHomeProps) {
  const [displayName, setDisplayName] = useState("");
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    let mounted = true;
    void inviteSession.restore().then((snapshot) => {
      if (!mounted) return;
      if (!hasRoleAccess(snapshot, requiredRole)) {
        void Taro.redirectTo({ url: "/pages/auth/login/index" });
        return;
      }
      setDisplayName(snapshot.displayName);
      setVerified(true);
    });
    return () => {
      mounted = false;
    };
  }, [requiredRole]);

  async function logout() {
    await inviteSession.logout();
    await Taro.redirectTo({ url: "/pages/auth/login/index" });
  }

  if (!verified) {
    return (
      <View className="role-page">
        <View className="role-card role-checking">
          <Text className="role-eyebrow">同芯学园 · 账号安全</Text>
          <Text className="role-title">正在确认服务权限</Text>
          <Text className="role-copy">请稍候，确认完成后再显示对应页面。</Text>
        </View>
      </View>
    );
  }

  return (
    <View className="role-page">
      <View className="role-brand">
        <View className="role-brand-mark">心</View>
        <View>
          <Text className="role-brand-name">同芯学园</Text>
          <Text className="role-brand-subtitle">TONG XIN XUE YUAN</Text>
        </View>
      </View>

      <View className="role-card">
        <Text className="role-eyebrow">机构已验证的服务身份</Text>
        <Text className="role-title">{title}</Text>
        <Text className="role-name">{displayName}</Text>
        <Text className="role-copy">{description}</Text>
        <View className="role-notice">
          <Text className="role-notice-title">业务模块迁移中</Text>
          <Text className="role-notice-copy">
            该页面目前用于验证账号与角色入口；具体业务功能尚未迁入，不会显示虚构的学生或工作数据。
          </Text>
        </View>
      </View>

      <Button
        className="role-action role-action-secondary"
        onClick={() => void Taro.redirectTo({ url: "/pages/auth/login/index" })}
      >
        切换服务入口
      </Button>
      <Button className="role-action" onClick={() => void logout()}>
        退出登录
      </Button>
      <Button
        className="role-action role-action-secondary"
        onClick={() => void Taro.redirectTo({ url: "/pages/visitor/home/index" })}
      >
        返回访客首页
      </Button>
    </View>
  );
}
