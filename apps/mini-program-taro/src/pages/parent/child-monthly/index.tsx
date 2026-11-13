import { Button, Picker, Text, View } from "@tarojs/components";
import Taro, { useDidHide, useDidShow, useUnload } from "@tarojs/taro";
import { useRef, useState } from "react";
import { inviteSession } from "../../../auth/runtime-session";
import { hasRoleAccess } from "../../../auth/role-gate";
import {
  CHILD_MONTHLY_FIELDS,
  acknowledgeParentChildMonthlyReport,
  childMonthlyValueLabel,
  loadParentChildMonthlyReports,
  type ChildMonthlyParentSummary,
} from "../../../monthly-feedback/child-monthly";
import "./index.css";

type PageState = {
  status: "LOADING" | "READY" | "ERROR" | "DENIED";
  records: readonly ChildMonthlyParentSummary[];
  message: string;
};
type Session = typeof inviteSession.snapshot;

const empty: PageState = {
  status: "LOADING",
  records: [],
  message: "正在读取已发布的孩子月报…",
};

function statusCode(error: unknown): number {
  return typeof error === "object" && error !== null && "statusCode" in error
    ? Number(error.statusCode)
    : 0;
}

function messageFor(error: unknown): string {
  const code = statusCode(error);
  if (code === 401) return "登录状态已过期，请重新登录。";
  if (code === 403 || code === 404) return "当前账号没有查看这份报告的有效关系。";
  return "孩子月报暂时无法读取，请稍后重试。";
}

export default function ParentChildMonthlyPage() {
  const [view, setView] = useState<PageState>(empty);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const viewRef = useRef(view);
  const context = useRef({ active: false, busy: false, generation: 0 });
  const verified = useRef<Session | null>(null);

  function updateView(next: PageState) {
    viewRef.current = next;
    setView(next);
  }

  function clearPage() {
    context.current.active = false;
    context.current.busy = false;
    context.current.generation += 1;
    verified.current = null;
    setSelectedStudentId("");
    updateView(empty);
  }

  function denied(message: string) {
    verified.current = null;
    updateView({ ...empty, status: "DENIED", message });
  }

  useDidShow(() => {
    context.current.active = true;
    void perform();
  });
  useDidHide(clearPage);
  useUnload(clearPage);

  async function perform(acknowledging?: ChildMonthlyParentSummary) {
    const state = context.current;
    if (!state.active || state.busy) return;
    if (acknowledging) {
      const current = viewRef.current.records.find(
        (record) =>
          record.id === acknowledging.id &&
          record.relationshipId === acknowledging.relationshipId &&
          record.publicationVersion === acknowledging.publicationVersion &&
          record.relationshipVersion === acknowledging.relationshipVersion &&
          !record.acknowledged,
      );
      if (
        !current ||
        !verified.current ||
        inviteSession.snapshot !== verified.current ||
        !hasRoleAccess(verified.current, "PARENT")
      ) {
        denied("登录或关系状态已变化，请重新读取后操作。");
        return;
      }
    }
    state.busy = true;
    const generation = ++state.generation;
    const isCurrent = () => state.active && state.generation === generation;
    let session = acknowledging ? verified.current : null;
    const sameSession = () => {
      if (!isCurrent()) return false;
      if (session && inviteSession.snapshot === session && hasRoleAccess(session, "PARENT"))
        return true;
      denied("登录状态或家长权限已变化，请重新读取后操作。");
      return false;
    };
    updateView({ ...empty, message: acknowledging ? "正在确认并刷新报告…" : empty.message });
    try {
      if (!acknowledging) session = await inviteSession.restore();
      if (!isCurrent() || !session) return;
      if (session.status === "CHECKING" || session.status === "BUSY" || session.status === "ERROR") {
        verified.current = null;
        updateView({ ...empty, status: "ERROR", message: "登录状态暂时无法读取，请稍后重试。" });
        return;
      }
      if (!hasRoleAccess(session, "PARENT")) {
        denied("请使用已审核关联的家长账号登录。");
        void Taro.redirectTo({ url: "/pages/auth/login/index" });
        return;
      }
      if (!sameSession()) return;

      let resultMessage = "只显示机构已发布的孩子月报；负责人待审核内容不会展示。";
      if (acknowledging) {
        try {
          await acknowledgeParentChildMonthlyReport(
            (path, body) => inviteSession.postAuthenticated(path, body),
            acknowledging,
          );
          resultMessage = "已确认，并已读取最新报告状态。";
        } catch (error) {
          if (statusCode(error) !== 409) throw error;
          resultMessage = "报告或关系版本已变化，未重复确认。最新状态已刷新，请重新查看。";
        }
        if (!sameSession()) return;
      }

      const records = await loadParentChildMonthlyReports((path) =>
        inviteSession.getAuthenticated(path),
      );
      if (!sameSession()) return;
      const children = [...new Map(records.map((record) => [record.studentId, record.studentLabel])).entries()];
      const selected = children.some(([studentId]) => studentId === selectedStudentId)
        ? selectedStudentId
        : (children[0]?.[0] ?? "");
      verified.current = session;
      setSelectedStudentId(selected);
      updateView({
        status: "READY",
        records,
        message: records.length ? resultMessage : "目前还没有已发布的孩子月报。",
      });
    } catch (error) {
      if (!isCurrent()) return;
      const code = statusCode(error);
      if (code === 401 || code === 403 || code === 404) {
        denied(messageFor(error));
        if (code === 401) void Taro.redirectTo({ url: "/pages/auth/login/index" });
      } else {
        verified.current = null;
        updateView({ ...empty, status: "ERROR", message: messageFor(error) });
      }
    } finally {
      if (isCurrent()) state.busy = false;
    }
  }

  function back() {
    clearPage();
    void Taro.redirectTo({ url: "/pages/parent/home/index" });
  }

  const children = [...new Map(view.records.map((record) => [record.studentId, record.studentLabel])).entries()];
  const selectedIndex = Math.max(0, children.findIndex(([studentId]) => studentId === selectedStudentId));
  const visibleRecords = view.records.filter((record) => record.studentId === selectedStudentId);

  return (
    <View className="child-monthly-page" data-child-monthly-state={view.status}>
      <View className="child-monthly-topbar">
        <Button className="child-monthly-back" onClick={back}>‹ 返回家长首页</Button>
        <Text className="child-monthly-role">家长端</Text>
      </View>
      <View className="child-monthly-card">
        <Text className="child-monthly-eyebrow">同芯学园 · 家长服务</Text>
        <Text className="child-monthly-title">孩子成长月报</Text>
        <Text className="child-monthly-copy">
          查看负责人审核并发布的月度成长摘要；报告只显示已授权关系内的内容。
        </Text>
      </View>
      <View className="child-monthly-card" aria-live="polite">
        <Text className="child-monthly-copy">{view.message}</Text>
        <View className="child-monthly-actions">
          <Button
            className="child-monthly-button"
            disabled={view.status === "LOADING" || context.current.busy}
            onClick={() => void perform()}
          >
            {view.status === "LOADING" ? "正在读取…" : view.status === "READY" ? "刷新月报" : "重新读取"}
          </Button>
          {view.status === "DENIED" ? (
            <Button className="child-monthly-button child-monthly-secondary" onClick={() => void Taro.redirectTo({ url: "/pages/auth/login/index" })}>
              重新登录
            </Button>
          ) : null}
        </View>
      </View>
      {view.status === "READY" && view.records.length === 0 ? (
        <View className="child-monthly-card">
          <Text className="child-monthly-heading">暂无已发布月报</Text>
          <Text className="child-monthly-copy">负责人发布后，报告会显示在这里。</Text>
        </View>
      ) : null}
      {view.status === "READY" && children.length > 1 ? (
        <View className="child-monthly-card">
          <Text className="child-monthly-label">选择孩子</Text>
          <Picker
            data-child-monthly-field="student"
            mode="selector"
            range={children.map(([, label]) => label)}
            value={selectedIndex}
            disabled={context.current.busy}
            onChange={(event) => {
              const selected = children[Number(event.detail.value)];
              if (selected) setSelectedStudentId(selected[0]);
            }}
          >
            <View className="child-monthly-picker">{children[selectedIndex]?.[1] ?? "请选择孩子"}　⌄</View>
          </Picker>
        </View>
      ) : null}
      {view.status === "READY"
        ? visibleRecords.map((record) => (
            <View className="child-monthly-card" key={`${record.relationshipId}:${record.id}`} data-child-monthly-row={record.id}>
              <Text className="child-monthly-heading">{record.studentLabel} · {record.month}</Text>
              {CHILD_MONTHLY_FIELDS.map((field) => (
                <Text className="child-monthly-copy" key={field.key}>
                  {field.label}：{childMonthlyValueLabel(record.supplements[field.key])}
                </Text>
              ))}
              <Text className="child-monthly-copy">
                成长记录 {record.sourceCounts.GROWTH_RECORD} 条 · 到校记录 {record.sourceCounts.ATTENDANCE_OVERVIEW} 条
              </Text>
              {record.acknowledged ? (
                <Text className="child-monthly-acknowledged">已确认阅读</Text>
              ) : (
                <Button
                  className="child-monthly-button"
                  disabled={context.current.busy}
                  onClick={() => void perform(record)}
                >确认已阅读</Button>
              )}
            </View>
          ))
        : null}
      <Text className="child-monthly-footnote">只展示已发布摘要；不显示班级内部内容或未审核资料。</Text>
    </View>
  );
}
