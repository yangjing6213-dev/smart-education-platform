import { Button, Text, View } from "@tarojs/components";
import Taro, { useDidHide, useDidShow, useUnload } from "@tarojs/taro";
import { useRef, useState } from "react";
import { inviteSession } from "../../../auth/runtime-session";
import { hasRoleAccess } from "../../../auth/role-gate";
import {
  createHealthIncidentClient,
  type ParentHealthNotice,
} from "../../../health/health-incidents";
import "./index.css";

type HealthSession = typeof inviteSession.snapshot;
type PageView = {
  status: "LOADING" | "READY" | "ERROR" | "LOGIN";
  message: string;
  notices: readonly ParentHealthNotice[];
  session?: HealthSession;
};
const loading: PageView = { status: "LOADING", message: "正在读取已发布的健康消息…", notices: [] };
const changedMessage = "账号信息已变化，请刷新健康消息。";
const deniedMessage = "当前账号暂无权查看这些健康消息。";
const client = createHealthIncidentClient({
  get: (path) => inviteSession.getAuthenticated(path),
  post: (path, body) => inviteSession.postAuthenticated(path, body),
});

function statusCode(error: unknown) {
  return typeof error === "object" && error !== null && "statusCode" in error
    ? error.statusCode
    : undefined;
}

export default function ParentHealthNoticesPage() {
  const [view, setView] = useState<PageView>(loading);
  const context = useRef({
    active: false,
    busy: false,
    generation: 0,
    displayed: null as PageView | null,
  });
  const restoring = useRef<ReturnType<typeof inviteSession.restore> | null>(null);

  function clearPage() {
    const state = context.current;
    state.active = false;
    state.busy = false;
    state.generation++;
    state.displayed = null;
    setView(loading);
  }

  useDidShow(() => {
    context.current.active = true;
    void refreshNotices();
  });
  useDidHide(clearPage);
  useUnload(clearPage);

  async function refreshNotices(selected?: ParentHealthNotice) {
    const state = context.current;
    if (!state.active || state.busy) return;
    // A tap queued before a refresh must never acknowledge the replacement view.
    if (
      selected &&
      (state.displayed !== view ||
        !view.notices.includes(selected) ||
        selected.receiptStatus === "ACKNOWLEDGED")
    )
      return;
    let session = selected ? view.session : undefined;
    const generation = ++state.generation;
    const isCurrent = () => state.active && state.generation === generation;
    state.busy = true;
    state.displayed = null;
    setView(loading);

    function fail(message: string, status: "ERROR" | "LOGIN" = "ERROR") {
      setView({ status, message, notices: [] });
    }
    function hasCurrentAccess() {
      if (!isCurrent()) return false;
      const current = inviteSession.snapshot;
      if (current.status === "SIGNED_OUT") fail("请重新登录后查看健康消息。", "LOGIN");
      else if (session !== current) fail(changedMessage);
      else if (session.status !== "READY") fail("登录状态暂时无法核对，请稍后刷新。");
      else if (!hasRoleAccess(session, "PARENT")) fail(deniedMessage);
      else return true;
      return false;
    }

    try {
      if (!selected) {
        // A new visit must check the currently stored parent after an earlier visit's /me completes.
        if (restoring.current) {
          await restoring.current;
          if (!isCurrent()) return;
        }
        const pending = inviteSession.restore();
        restoring.current = pending;
        try {
          session = await pending;
        } finally {
          if (restoring.current === pending) restoring.current = null;
        }
      }
      if (!hasCurrentAccess()) return;
      let conflict = false;
      if (selected) {
        try {
          if (selected.receiptStatus === "READ")
            await client.acknowledgeParentNotice(selected.id, selected.version);
          else await client.markParentNoticeRead(selected.id, selected.version);
        } catch (error) {
          if (statusCode(error) !== 409) throw error;
          conflict = true;
        }
        if (!hasCurrentAccess()) return;
      }
      const notices = await client.loadParentNotices();
      if (!hasCurrentAccess()) return;
      const next: PageView = {
        status: "READY",
        session,
        notices,
        message: conflict
          ? "消息版本已变化，请重新阅读当前内容。"
          : notices.length
            ? `已发布 ${notices.length} 条健康消息。`
            : "暂无已发布的健康消息。",
      };
      state.displayed = next;
      setView(next);
    } catch (error) {
      if (!isCurrent() || (session && !hasCurrentAccess())) return;
      const code = statusCode(error);
      if (code === 401) fail("请重新登录后查看健康消息。", "LOGIN");
      else if (code === 403 || code === 404) fail(deniedMessage);
      else if (code === 503) fail("机构服务暂未连接，请稍后重试。");
      else fail("健康消息暂时无法读取或更新，请稍后重试。");
    } finally {
      if (isCurrent()) state.busy = false;
    }
  }

  const accountChanged = view.status === "READY" && view.session !== inviteSession.snapshot;
  const notices = accountChanged ? [] : view.notices;

  return (
    <View className="parent-health-page">
      <View className="parent-health-brand">
        <View className="parent-health-brand-mark">心</View>
        <View>
          <Text className="parent-health-brand-name">同芯学园</Text>
          <Text className="parent-health-brand-subtitle">TONG XIN XUE YUAN</Text>
        </View>
      </View>

      <View className="parent-health-card">
        <Text className="parent-health-eyebrow">同芯学园 · 家长服务</Text>
        <Text className="parent-health-title">健康消息</Text>
        <Text className="parent-health-copy">
          这里只展示管理端审核发布、且与你当前已确认关联学生有关的摘要。
        </Text>
      </View>

      <View className="parent-health-card">
        <Text className="parent-health-section-title">已发布消息</Text>
        <Text className="parent-health-message">
          {accountChanged ? changedMessage : view.message}
        </Text>
        {view.status === "LOGIN" ? (
          <Button
            className="parent-health-button"
            onClick={() => {
              clearPage();
              void Taro.redirectTo({ url: "/pages/auth/login/index" });
            }}
          >
            重新登录
          </Button>
        ) : (
          <Button
            className="parent-health-button"
            disabled={view.status === "LOADING"}
            onClick={() => void refreshNotices()}
          >
            {view.status === "LOADING" ? "正在刷新…" : "刷新消息"}
          </Button>
        )}
        {view.status === "READY" && !accountChanged && notices.length === 0 ? (
          <Text className="parent-health-empty">有新内容发布后，会显示在这里。</Text>
        ) : null}
        {notices
          .filter((notice) => notice.status === "PUBLISHED")
          .map((notice) => (
            <View className="parent-health-notice" key={notice.id}>
              <Text className="parent-health-student">{notice.studentLabel}</Text>
              <Text className="parent-health-summary">{notice.parentSummary}</Text>
              <Text className="parent-health-meta">
                更新时间：{notice.updatedAt.replace("T", " ").slice(0, 16)}
              </Text>
              {notice.receiptStatus === "ACKNOWLEDGED" ? (
                <Text className="parent-health-receipt">已确认知悉</Text>
              ) : notice.receiptStatus === "READ" ? (
                <Button
                  className="parent-health-button"
                  onClick={() => void refreshNotices(notice)}
                >
                  确认知悉
                </Button>
              ) : (
                <Button
                  className="parent-health-button parent-health-button-secondary"
                  onClick={() => void refreshNotices(notice)}
                >
                  查看并标记已读
                </Button>
              )}
            </View>
          ))}
      </View>

      <Text className="parent-health-footnote">
        健康消息仅包含已审核发布的简要内容；页面不展示员工内部审核信息。
      </Text>
    </View>
  );
}
