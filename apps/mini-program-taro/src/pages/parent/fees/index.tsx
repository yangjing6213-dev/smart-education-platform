import { Button, Text, View } from "@tarojs/components";
import Taro, { useDidHide, useDidShow, useUnload } from "@tarojs/taro";
import { useRef, useState } from "react";
import { inviteSession } from "../../../auth/runtime-session";
import { hasRoleAccess } from "../../../auth/role-gate";
import {
  buildParentFeesPageModel,
  loadParentFees,
  type ParentFeesPageModel,
} from "../../../fees/parent-fees";
import "./index.css";

type PageStatus = "LOADING" | "READY" | "ERROR" | "LOGIN";
const loadingMessage = "正在读取家长费用信息…";
const changedMessage = "账号信息已变化，请重新读取费用信息。";
const deniedMessage = "当前账号没有查看费用信息的权限。";

export default function ParentFeesPage() {
  const [status, setStatus] = useState<PageStatus>("LOADING");
  const [message, setMessage] = useState(loadingMessage);
  const [model, setModel] = useState<ParentFeesPageModel | null>(null);
  const context = useRef({ active: false, generation: 0, busy: false });
  const restoring = useRef<ReturnType<typeof inviteSession.restore> | null>(null);
  const displaySession = useRef<typeof inviteSession.snapshot | null>(null);

  function clearView(next: PageStatus, text: string) {
    displaySession.current = null;
    setModel(null);
    setStatus(next);
    setMessage(text);
  }

  function clearPage() {
    context.current.active = false;
    context.current.generation += 1;
    context.current.busy = false;
    clearView("LOADING", loadingMessage);
  }

  useDidShow(() => {
    context.current.active = true;
    void refresh();
  });
  useDidHide(clearPage);
  useUnload(clearPage);

  async function refresh() {
    const state = context.current;
    if (!state.active || state.busy) return;
    state.busy = true;
    const generation = ++state.generation;
    const isCurrent = () => state.active && state.generation === generation;
    clearView("LOADING", loadingMessage);
    let session: typeof inviteSession.snapshot | undefined;
    const checkSession = () => {
      if (!isCurrent()) return false;
      const current = inviteSession.snapshot;
      if (current.status === "SIGNED_OUT") {
        clearView("LOGIN", "请重新登录后查看费用信息。");
        return false;
      }
      if (session !== current) {
        clearView("ERROR", changedMessage);
        return false;
      }
      if (session.status !== "READY") {
        clearView("ERROR", "登录状态暂时无法读取，请稍后重试。");
        return false;
      }
      if (!hasRoleAccess(session, "PARENT")) {
        clearView("ERROR", deniedMessage);
        return false;
      }
      return true;
    };
    try {
      // A new page visit must verify the currently stored account, even if an older visit is still checking.
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
      if (!checkSession()) return;
      const projection = await loadParentFees((path) => inviteSession.getAuthenticated(path));
      if (!checkSession()) return;
      displaySession.current = session;
      setModel(buildParentFeesPageModel(projection));
      setMessage("仅显示当前家长账号可查看的费用资料。");
      setStatus("READY");
    } catch (error) {
      if (!isCurrent() || (session && !checkSession())) return;
      const code =
        typeof error === "object" && error !== null && "statusCode" in error
          ? error.statusCode
          : undefined;
      if (code === 401) clearView("LOGIN", "请重新登录后查看费用信息。");
      else if (code === 403) clearView("ERROR", deniedMessage);
      else if (code === 503) clearView("ERROR", "机构服务暂未连接，请稍后再试。");
      else clearView("ERROR", "费用信息暂时无法读取，请稍后重试。");
    } finally {
      if (isCurrent()) state.busy = false;
    }
  }

  function returnToParentHome() {
    clearPage();
    void Taro.redirectTo({ url: "/pages/parent/home/index" });
  }

  const accountChanged = status === "READY" && displaySession.current !== inviteSession.snapshot;
  return (
    <View className="parent-fees-page">
      <View className="parent-fees-topbar">
        <Button className="parent-fees-back" onClick={returnToParentHome}>
          <Text>‹ 返回家长首页</Text>
        </Button>
        <Text className="parent-fees-role">家长端</Text>
      </View>

      <View className="parent-fees-intro">
        <Text className="parent-fees-eyebrow">同芯学园 · 家长服务</Text>
        <Text className="parent-fees-title">费用信息</Text>
        <Text className="parent-fees-copy">
          查看已发布的费用资料和汇总信息。本页面仅供查看，不处理支付、退款或签约。
        </Text>
      </View>

      <View className="parent-fees-state" aria-live="polite">
        <Text className="parent-fees-message">{accountChanged ? changedMessage : message}</Text>
        {status === "ERROR" || accountChanged ? (
          <Button className="parent-fees-button" onClick={() => void refresh()}>
            重新读取
          </Button>
        ) : null}
        {status === "LOGIN" ? (
          <Button
            className="parent-fees-button"
            onClick={() => {
              clearPage();
              void Taro.redirectTo({ url: "/pages/auth/login/index" });
            }}
          >
            重新登录
          </Button>
        ) : null}
      </View>

      {status === "READY" && !accountChanged && model ? (
        <>
          <View className="parent-fees-balance">
            <Text className="parent-fees-eyebrow">只读汇总</Text>
            <Text className="parent-fees-balance-label">待结余额</Text>
            <Text className="parent-fees-balance-value">{model.balanceText}</Text>
            <Text className="parent-fees-muted">金额以机构正式发布资料为准。</Text>
          </View>

          {model.empty ? (
            <View className="parent-fees-empty">
              <Text className="parent-fees-card-title">暂无可查看的费用资料</Text>
              <Text className="parent-fees-muted">如需了解费用安排，请联系机构工作人员。</Text>
            </View>
          ) : (
            <View className="parent-fees-list">
              <Text className="parent-fees-section-title">已发布资料</Text>
              {model.documents.map((document) => (
                <View className="parent-fees-card" key={document.key}>
                  <View className="parent-fees-card-heading">
                    <Text className="parent-fees-card-title">{document.title}</Text>
                    <Text className="parent-fees-status">{document.statusText}</Text>
                  </View>
                  <Text className="parent-fees-student">{document.studentLabel}</Text>
                  <Text className="parent-fees-muted">费用周期：{document.period}</Text>
                  <Text className="parent-fees-amount">{document.amountText}</Text>
                  <Text className="parent-fees-muted">{document.validityText}</Text>
                  <Text className="parent-fees-summary">{document.summary}</Text>
                </View>
              ))}
            </View>
          )}
        </>
      ) : null}

      <Text className="parent-fees-footnote">
        本页不提供在线支付、退款或签约；费用问题请联系机构工作人员。
      </Text>
    </View>
  );
}
