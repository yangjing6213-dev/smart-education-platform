import { Button, Text, View } from "@tarojs/components";
import Taro, { useDidHide, useDidShow, useUnload } from "@tarojs/taro";
import { useRef, useState } from "react";
import { inviteSession } from "../../../auth/runtime-session";
import { hasRoleAccess } from "../../../auth/role-gate";
import {
  loadParentNotices,
  recordParentNoticeReceipt,
  type ParentNotice,
} from "../../../notices/parent-notices";
import "./index.css";

type Status = "LOADING" | "READY" | "ERROR" | "DENIED";
const labels = { UNREAD: "未读", READ: "已读，待确认", ACKNOWLEDGED: "已确认收到" };

function statusCode(error: unknown): number {
  return typeof error === "object" && error !== null && "statusCode" in error
    ? Number(error.statusCode)
    : 0;
}

export default function ParentNoticesPage() {
  const [view, setView] = useState<{
    status: Status;
    message: string;
    notices: readonly ParentNotice[];
  }>({ status: "LOADING", message: "正在读取通知…", notices: [] });
  const context = useRef({ active: false, generation: 0, busy: false });
  const restoring = useRef<ReturnType<typeof inviteSession.restore> | null>(null);

  function clearPage() {
    context.current.active = false;
    context.current.generation += 1;
    context.current.busy = false;
    setView({ status: "LOADING", message: "正在读取通知…", notices: [] });
  }

  useDidShow(() => {
    context.current.active = true;
    void perform();
  });
  useDidHide(clearPage);
  useUnload(clearPage);

  async function perform(selected?: ParentNotice, action?: "read" | "ack") {
    const state = context.current;
    if (!state.active || state.busy) return;
    state.busy = true;
    const generation = ++state.generation;
    const isCurrent = () => state.active && state.generation === generation;
    setView({
      status: "LOADING",
      message: selected ? "正在更新通知…" : "正在读取通知…",
      notices: [],
    });
    let session: typeof inviteSession.snapshot | undefined;
    const hasSameSession = () => {
      if (!isCurrent()) return false;
      if (session && inviteSession.snapshot === session && hasRoleAccess(session, "PARENT"))
        return true;
      setView({ status: "DENIED", message: "登录信息已变化，请重新登录。", notices: [] });
      return false;
    };
    try {
      // A hidden page may return before identity verification finishes.
      // Share that in-flight verification instead of treating CHECKING as signed out.
      const pending = restoring.current ?? inviteSession.restore();
      restoring.current = pending;
      try {
        session = await pending;
      } finally {
        if (restoring.current === pending) restoring.current = null;
      }
      if (!isCurrent()) return;
      if (
        session.status === "CHECKING" ||
        session.status === "BUSY" ||
        session.status === "ERROR"
      ) {
        setView({ status: "ERROR", message: "登录状态暂时无法读取，请稍后重试。", notices: [] });
        return;
      }
      if (!hasRoleAccess(session, "PARENT")) {
        setView({ status: "DENIED", message: "请使用家长账号登录后查看通知。", notices: [] });
        void Taro.redirectTo({ url: "/pages/auth/login/index" });
        return;
      }
      if (!hasSameSession()) return;
      let message = "阅读后请确认收到，方便机构了解送达情况。";
      if (selected && action) {
        try {
          await recordParentNoticeReceipt(
            (path, body) => inviteSession.postAuthenticated(path, body),
            selected,
            action,
          );
          message = action === "read" ? "已记录阅读，请确认收到。" : "已确认收到。";
        } catch (error) {
          if (statusCode(error) !== 409) throw error;
          message = "通知已更新，请重新阅读当前内容后再确认。";
        }
        if (!hasSameSession()) return;
      }
      // Re-read the server's current scope/version instead of trusting a cached card.
      const notices = await loadParentNotices((path) => inviteSession.getAuthenticated(path));
      if (!hasSameSession()) return;
      setView({
        status: "READY",
        message: notices.length ? message : "当前没有可查看的通知。",
        notices,
      });
    } catch (error) {
      if (!isCurrent()) return;
      const code = statusCode(error);
      const denied = code === 401 || code === 403 || code === 404;
      setView({
        status: denied ? "DENIED" : "ERROR",
        notices: [],
        message:
          code === 401
            ? "登录已过期，请重新登录。"
            : code === 403 || code === 404
              ? "通知或关系权限已变化，请重新读取。"
              : "通知暂时无法读取，请稍后重试。",
      });
    } finally {
      if (isCurrent()) state.busy = false;
    }
  }

  function back() {
    clearPage();
    void Taro.redirectTo({ url: "/pages/parent/home/index" });
  }

  return (
    <View className="parent-notices-page">
      <View className="parent-notices-topbar">
        <Button className="parent-notices-back" onClick={back}>
          ‹ 返回家长首页
        </Button>
        <Text className="parent-notices-role">家长端</Text>
      </View>
      <View className="parent-notices-intro">
        <Text className="parent-notices-eyebrow">同芯学园 · 家长服务</Text>
        <Text className="parent-notices-title">通知与确认</Text>
        <Text className="parent-notices-copy">查看机构和班级通知，阅读后确认收到。</Text>
      </View>
      <View className="parent-notices-state" aria-live="polite">
        <Text className="parent-notices-copy">{view.message}</Text>
        <View className="parent-notices-actions">
          <Button
            className="parent-notices-button"
            disabled={view.status === "LOADING"}
            onClick={() => void perform()}
          >
            {view.status === "LOADING"
              ? "正在读取…"
              : view.status === "READY"
                ? "刷新通知"
                : "重新读取"}
          </Button>
          {view.status === "DENIED" ? (
            <Button
              className="parent-notices-button parent-notices-secondary"
              onClick={() => {
                clearPage();
                void Taro.redirectTo({ url: "/pages/auth/login/index" });
              }}
            >
              重新登录
            </Button>
          ) : null}
        </View>
      </View>
      {view.status === "READY" && view.notices.length === 0 ? (
        <View className="parent-notices-card">
          <Text className="parent-notices-card-title">暂无通知</Text>
          <Text className="parent-notices-copy">
            机构发布后会在这里显示；如尚未关联学生，请先申请关联。
          </Text>
        </View>
      ) : null}
      {view.status === "READY"
        ? view.notices.map((notice) => (
            <View className="parent-notices-card" key={notice.id}>
              <View className="parent-notices-heading">
                <Text className="parent-notices-card-title">{notice.title}</Text>
                <Text className="parent-notices-receipt">{labels[notice.receiptStatus]}</Text>
              </View>
              <Text className="parent-notices-meta">
                {notice.target === "CLASS" ? "班级通知" : "机构通知"}
              </Text>
              <Text className="parent-notices-body">{notice.body}</Text>
              {notice.receiptStatus === "UNREAD" ? (
                <Button
                  className="parent-notices-button"
                  onClick={() => void perform(notice, "read")}
                >
                  标记已读
                </Button>
              ) : notice.receiptStatus === "READ" ? (
                <Button
                  className="parent-notices-button"
                  onClick={() => void perform(notice, "ack")}
                >
                  确认收到
                </Button>
              ) : (
                <Text className="parent-notices-copy">已确认收到这条通知。</Text>
              )}
            </View>
          ))
        : null}
      <Text className="parent-notices-footnote">仅显示当前关系范围内已发布的通知。</Text>
    </View>
  );
}
