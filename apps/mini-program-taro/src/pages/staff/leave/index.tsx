import { Button, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { useEffect, useRef, useState } from "react";
import { inviteSession } from "../../../auth/runtime-session";
import { hasRoleAccess } from "../../../auth/role-gate";
import {
  loadStaffLeaveRequests,
  reviewStaffLeaveRequest,
  type StaffLeaveAction,
  type StaffLeaveRequest,
} from "../../../leave/leave-requests";
import "./index.css";

type PageStatus = "LOADING" | "READY" | "ERROR";

function errorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null && "statusCode" in error) {
    const statusCode = Number(error.statusCode);
    if (statusCode === 401) return "登录状态已过期，请重新登录后查看。";
    if (statusCode === 403) return "当前账号没有请假审核权限，请联系机构负责人。";
    if (statusCode === 409) return "申请状态已变化，请刷新列表后再审核。";
    if (statusCode === 503) return "机构服务暂未连接，请稍后再试。";
  }
  return "请假审核列表暂时无法读取，请稍后重试。";
}

function showDate(value: string): string {
  const [year, month, day] = value.split("-");
  return `${year}年${Number(month)}月${Number(day)}日`;
}

function reasonLabel(category: StaffLeaveRequest["reasonCategory"]): string {
  return category === "FAMILY_ARRANGEMENT" ? "家庭安排" : "临时事项";
}

export default function StaffLeavePage() {
  const [status, setStatus] = useState<PageStatus>("LOADING");
  const [message, setMessage] = useState("正在读取当前账号可审核的请假申请…");
  const [requests, setRequests] = useState<StaffLeaveRequest[]>([]);
  const [busyId, setBusyId] = useState("");
  const mounted = useRef(false);
  const inFlight = useRef(false);

  useEffect(() => {
    mounted.current = true;
    void loadInitial();
    return () => {
      mounted.current = false;
    };
  }, []);

  async function loadInitial() {
    try {
      const session = await inviteSession.restore();
      if (!mounted.current) return;
      if (!hasRoleAccess(session, "STAFF")) {
        void Taro.redirectTo({ url: "/pages/auth/login/index" });
        return;
      }
      await refreshQueue();
    } catch (error) {
      if (!mounted.current) return;
      setRequests([]);
      setMessage(errorMessage(error));
      setStatus("ERROR");
    }
  }

  async function refreshQueue(resultMessage?: string) {
    if (!hasRoleAccess(inviteSession.snapshot, "STAFF")) {
      void Taro.redirectTo({ url: "/pages/auth/login/index" });
      return;
    }
    setStatus("LOADING");
    try {
      const next = await loadStaffLeaveRequests((path) => inviteSession.getAuthenticated(path));
      if (!mounted.current) return;
      setRequests(next);
      setMessage(resultMessage ?? (next.length
        ? "仅显示当前账号授权范围内的待审核申请。"
        : "当前账号范围内暂无待审核申请。"));
      setStatus("READY");
    } catch (error) {
      if (!mounted.current) return;
      setRequests([]);
      setMessage(errorMessage(error));
      setStatus("ERROR");
    }
  }

  async function review(request: StaffLeaveRequest, action: StaffLeaveAction) {
    if (inFlight.current || busyId || !request.actions.includes(action)) return;
    if (!hasRoleAccess(inviteSession.snapshot, "STAFF")) {
      void Taro.redirectTo({ url: "/pages/auth/login/index" });
      return;
    }
    const actionLabel = action === "confirm" ? "同意请假" : "退回补充";
    const confirmation = await Taro.showModal({
      title: `确认${actionLabel}`,
      content: `将${actionLabel}：${request.studentLabel}，${showDate(request.startDate)} 至 ${showDate(request.endDate)}。`,
      confirmText: actionLabel,
      cancelText: "再看看",
    });
    if (!confirmation.confirm || inFlight.current) return;

    inFlight.current = true;
    setBusyId(request.id);
    try {
      await reviewStaffLeaveRequest(
        (path, body) => inviteSession.postAuthenticated(path, body),
        request,
        action,
      );
      if (!mounted.current) return;
      await refreshQueue(action === "confirm" ? "已同意请假，审核列表已更新。" : "已退回补充，审核列表已更新。");
    } catch (error) {
      if (!mounted.current) return;
      setMessage(errorMessage(error));
      setStatus("ERROR");
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusyId("");
    }
  }

  return (
    <View className="staff-leave-page">
      <View className="staff-leave-brand">
        <View className="staff-leave-brand-mark">心</View>
        <View>
          <Text className="staff-leave-brand-name">同芯学园</Text>
          <Text className="staff-leave-brand-subtitle">TONG XIN XUE YUAN</Text>
        </View>
      </View>

      <View className="staff-leave-card">
        <Text className="staff-leave-eyebrow">员工端 · 请假服务</Text>
        <Text className="staff-leave-title">请假审核</Text>
        <Text className={`staff-leave-message${status === "ERROR" ? " staff-leave-error" : ""}`}>{message}</Text>
        <Button
          className="staff-leave-button staff-leave-wide-button"
          disabled={status === "LOADING" || !!busyId}
          onClick={() => void refreshQueue("请假审核列表已更新。")}
        >
          刷新申请
        </Button>
      </View>

      {status === "LOADING" ? (
        <View className="staff-leave-card"><Text className="staff-leave-copy">正在读取申请…</Text></View>
      ) : null}

      {status === "ERROR" ? (
        <View className="staff-leave-card">
          <Text className="staff-leave-section-title">暂时无法读取</Text>
          <Button className="staff-leave-button staff-leave-wide-button" onClick={() => void refreshQueue()}>
            重新读取
          </Button>
        </View>
      ) : null}

      {status === "READY" && requests.length === 0 ? (
        <View className="staff-leave-card">
          <Text className="staff-leave-section-title">暂无待审核申请</Text>
          <Text className="staff-leave-empty">家长提交申请后，会按当前员工账号的校区和班级范围显示在这里。</Text>
        </View>
      ) : null}

      {status === "READY" ? requests.map((request) => (
        <View className="staff-leave-card" key={request.id}>
          <Text className="staff-leave-eyebrow">请假申请 · 待审核</Text>
          <Text className="staff-leave-request-title">{request.studentLabel}</Text>
          <Text className="staff-leave-meta">班级：{request.classLabel}</Text>
          <Text className="staff-leave-meta">日期：{showDate(request.startDate)} 至 {showDate(request.endDate)}</Text>
          <Text className="staff-leave-meta">申请原因：{reasonLabel(request.reasonCategory)}</Text>
          <Text className="staff-leave-meta">最近更新：{new Date(request.updatedAt).toLocaleString("zh-CN")}</Text>
          {request.actions.includes("confirm") || request.actions.includes("return") ? (
            <View className="staff-leave-action-row">
              {request.actions.includes("confirm") ? (
                <Button
                  className="staff-leave-button"
                  disabled={!!busyId}
                  loading={busyId === request.id}
                  onClick={() => void review(request, "confirm")}
                >
                  同意请假
                </Button>
              ) : null}
              {request.actions.includes("return") ? (
                <Button
                  className="staff-leave-button staff-leave-button-secondary"
                  disabled={!!busyId}
                  onClick={() => void review(request, "return")}
                >
                  退回补充
                </Button>
              ) : null}
            </View>
          ) : null}
        </View>
      )) : null}

      <Button
        className="staff-leave-button staff-leave-button-secondary staff-leave-wide-button"
        onClick={() => void Taro.redirectTo({ url: "/pages/staff/workbench/index" })}
      >
        返回工作台
      </Button>
      <Text className="staff-leave-footnote">审核范围由机构服务根据当前员工账号确定。</Text>
    </View>
  );
}
