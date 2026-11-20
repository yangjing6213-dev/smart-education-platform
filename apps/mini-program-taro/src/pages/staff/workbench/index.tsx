import { Button, Text, View } from "@tarojs/components";
import Taro, { useDidShow } from "@tarojs/taro";
import { useEffect, useRef, useState } from "react";
import { inviteSession } from "../../../auth/runtime-session";
import { hasRoleAccess } from "../../../auth/role-gate";
import {
  loadStaffBindingQueue,
  reviewStaffBinding,
  type StaffBindingDecision,
  type StaffBindingQueueItem,
} from "../../../binding/staff-binding-review";
import "./index.css";

type PageStatus = "LOADING" | "READY" | "ERROR";

function errorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null && "statusCode" in error) {
    const statusCode = Number(error.statusCode);
    if (statusCode === 401) return "登录状态已过期，请重新登录后查看。";
    if (statusCode === 403) return "当前账号没有关系审核权限。";
    if (statusCode === 409) return "申请已被处理或版本已变化，请刷新列表后再试。";
    if (statusCode === 503) return "机构服务暂未连接，请稍后再试。";
  }
  return "待审核申请暂时无法读取，请稍后重试。";
}

function submittedAt(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "" : date.toLocaleString("zh-CN");
}

export default function StaffWorkbenchPage() {
  const [status, setStatus] = useState<PageStatus>("LOADING");
  const [message, setMessage] = useState("正在读取当前校区待审核关系申请…");
  const [queue, setQueue] = useState<StaffBindingQueueItem[]>([]);
  const [busyId, setBusyId] = useState("");
  const mounted = useRef(false);
  const hasShown = useRef(false);
  const initialLoadDone = useRef(false);
  const queueRefreshInFlight = useRef(false);

  useEffect(() => {
    mounted.current = true;
    void loadInitial();
    return () => {
      mounted.current = false;
      initialLoadDone.current = false;
    };
  }, []);

  useDidShow(() => {
    if (hasShown.current && initialLoadDone.current) void refreshQueue();
    hasShown.current = true;
  });

  async function loadInitial() {
    const session = await inviteSession.restore();
    if (!mounted.current) return;
    if (!hasRoleAccess(session, "STAFF")) {
      void Taro.redirectTo({ url: "/pages/auth/login/index" });
      return;
    }
    await refreshQueue();
    initialLoadDone.current = true;
  }

  async function refreshQueue(resultMessage?: string) {
    if (queueRefreshInFlight.current) return;
    if (!hasRoleAccess(inviteSession.snapshot, "STAFF")) {
      void Taro.redirectTo({ url: "/pages/auth/login/index" });
      return;
    }
    queueRefreshInFlight.current = true;
    setStatus("LOADING");
    try {
      const next = await loadStaffBindingQueue((path) => inviteSession.getAuthenticated(path));
      if (!mounted.current) return;
      setQueue(next);
      setMessage(
        resultMessage ??
          (next.length ? "仅显示当前账号有权审核的申请。" : "当前校区暂无待审核关系申请。"),
      );
      setStatus("READY");
    } catch (error) {
      if (!mounted.current) return;
      setQueue([]);
      setMessage(errorMessage(error));
      setStatus("ERROR");
    } finally {
      queueRefreshInFlight.current = false;
    }
  }

  async function decide(item: StaffBindingQueueItem, action: StaffBindingDecision) {
    if (busyId) return;
    if (!hasRoleAccess(inviteSession.snapshot, "STAFF")) {
      void Taro.redirectTo({ url: "/pages/auth/login/index" });
      return;
    }
    const decisionName = action === "approve" ? "通过" : "驳回";
    const confirmation = await Taro.showModal({
      title: `确认${decisionName}申请`,
      content: `将${decisionName}${item.applicantLabel}提交的${item.studentLabel}关系申请。`,
      confirmText: decisionName,
      cancelText: "再看看",
    });
    if (!confirmation.confirm) return;

    setBusyId(item.id);
    try {
      await reviewStaffBinding(
        (path, body) => inviteSession.postAuthenticated(path, body),
        { id: item.id, version: item.version },
        action,
      );
      if (!mounted.current) return;
      await refreshQueue(
        action === "approve" ? "已通过申请；列表已更新。" : "已驳回申请；列表已更新。",
      );
    } catch (error) {
      if (!mounted.current) return;
      setMessage(errorMessage(error));
      setStatus("ERROR");
    } finally {
      if (mounted.current) setBusyId("");
    }
  }

  async function switchAccount() {
    await inviteSession.logout();
    void Taro.redirectTo({ url: "/pages/auth/login/index" });
  }

  return (
    <View className="staff-workbench-page">
      <View className="staff-brand">
        <View className="staff-brand-mark">心</View>
        <View>
          <Text className="staff-brand-name">同芯学园</Text>
          <Text className="staff-brand-subtitle">TONG XIN XUE YUAN</Text>
        </View>
      </View>

      <View className="staff-intro">
        <Text className="staff-eyebrow">员工端 · 关系审核</Text>
        <Text className="staff-title">待审核申请</Text>
        <Text className="staff-copy">
          申请按员工账号已授权的校区范围显示。审核决定由机构服务保存。
        </Text>
      </View>

      <View className="staff-section-heading">
        <View>
          <Text className="staff-section-title">家长关系申请</Text>
          <Text className="staff-message">{message}</Text>
        </View>
        <Button
          className="staff-refresh-button"
          disabled={status === "LOADING"}
          onClick={() => void refreshQueue()}
        >
          刷新
        </Button>
      </View>

      {status === "LOADING" ? (
        <View className="staff-state-card">
          <Text className="staff-state-title">正在读取</Text>
          <Text className="staff-copy">{message}</Text>
        </View>
      ) : null}

      {status === "ERROR" ? (
        <View className="staff-state-card">
          <Text className="staff-state-title">暂时无法读取</Text>
          <Text className="staff-copy">{message}</Text>
          <Button className="staff-primary-button" onClick={() => void refreshQueue()}>
            重新读取
          </Button>
        </View>
      ) : null}

      {status === "READY" && queue.length === 0 ? (
        <View className="staff-state-card">
          <Text className="staff-state-title">暂无待审核申请</Text>
          <Text className="staff-copy">家长提交申请后，会显示在这里。无需切换到其他页面查找。</Text>
        </View>
      ) : null}

      {status === "READY"
        ? queue.map((item) => (
            <View className="staff-application-card" key={item.id}>
              <Text className="staff-application-eyebrow">关系申请 · 待审核</Text>
              <Text className="staff-application-title">{item.applicantLabel}</Text>
              <Text className="staff-copy">申请关联：{item.studentLabel}</Text>
              <Text className="staff-copy">关系类型：监护人</Text>
              <Text className="staff-application-date">
                提交时间：{submittedAt(item.submittedAt)}
              </Text>
              <View className="staff-decision-row">
                <Button
                  className="staff-primary-button staff-decision-button"
                  disabled={!!busyId}
                  loading={busyId === item.id}
                  onClick={() => void decide(item, "approve")}
                >
                  通过申请
                </Button>
                <Button
                  className="staff-secondary-button staff-decision-button"
                  disabled={!!busyId}
                  onClick={() => void decide(item, "reject")}
                >
                  驳回申请
                </Button>
              </View>
            </View>
          ))
        : null}

      <View className="staff-footer-actions">
        <Button
          className="staff-primary-button"
          onClick={() => void Taro.navigateTo({ url: "/pages/staff/daily-report/index" })}
        >
          工作日报
        </Button>
        {inviteSession.snapshot.canReadMonthlyFeedback ? (
          <>
            <Button
              className="staff-primary-button"
              onClick={() => void Taro.navigateTo({ url: "/pages/staff/monthly/index" })}
            >
              班级月度总结
            </Button>
            <Button
              className="staff-primary-button"
              onClick={() => void Taro.navigateTo({ url: "/pages/staff/child-monthly/index" })}
            >
              孩子月度报告
            </Button>
          </>
        ) : null}
        <Button
          className="staff-primary-button"
          onClick={() => void Taro.navigateTo({ url: "/pages/staff/care-record/index" })}
        >
          成长记录
        </Button>
        <Button
          className="staff-primary-button"
          onClick={() => void Taro.navigateTo({ url: "/pages/staff/pickup/index" })}
        >
          接送核验
        </Button>
        <Button
          className="staff-secondary-button"
          onClick={() => void Taro.navigateTo({ url: "/pages/staff/health-report/index" })}
        >
          健康事项上报
        </Button>
        <Button
          className="staff-secondary-button"
          onClick={() => void Taro.navigateTo({ url: "/pages/staff/leave/index" })}
        >
          请假审核
        </Button>
        <Button className="staff-secondary-button" onClick={() => void switchAccount()}>
          切换账号
        </Button>
        <Button
          className="staff-secondary-button"
          onClick={() => void Taro.redirectTo({ url: "/pages/visitor/home/index" })}
        >
          返回访客首页
        </Button>
        <Button
          className="staff-secondary-button"
          onClick={() => void Taro.navigateTo({ url: "/pages/account/index" })}
        >
          我的账号
        </Button>
      </View>
      <Text className="staff-footnote">
        本页只展示机构服务返回的待审申请；无服务连接时不会生成模拟审核结果。
      </Text>
    </View>
  );
}
