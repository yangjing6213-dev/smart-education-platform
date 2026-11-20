import { Button, Picker, Switch, Text, View } from "@tarojs/components";
import Taro, { useDidShow } from "@tarojs/taro";
import { useEffect, useRef, useState } from "react";
import { inviteSession } from "../../../auth/runtime-session";
import { hasRoleAccess } from "../../../auth/role-gate";
import {
  loadParentLearningSummary,
  requestParentLearningContact,
  saveParentLearningControls,
  selectParentLearningStudent,
  type ParentLearningControl,
  type ParentLearningProjection,
  type ParentLearningSettings,
  type ParentLearningStudentSummary,
} from "../../../learning/parent-learning-summary";
import "./index.css";

type PageStatus = "LOADING" | "READY" | "ERROR";

function errorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null && "statusCode" in error) {
    const statusCode = Number(error.statusCode);
    if (statusCode === 401) return "登录状态已过期，请重新登录后查看。";
    if (statusCode === 403) return "当前账号没有查看家长学习摘要的权限。";
  }
  return "学习摘要暂时无法读取，请稍后重试。";
}

function updatedAt(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "" : date.toLocaleString("zh-CN");
}

function SummaryCard({ summary }: { readonly summary: ParentLearningStudentSummary }) {
  return (
    <View className="parent-summary-card">
      <Text className="parent-student-name">{summary.studentLabel}</Text>
      <View className="parent-stats">
        <View className="parent-stat">
          <Text className="parent-stat-value">{summary.usedMinutes} 分钟</Text>
          <Text className="parent-stat-label">学习时长</Text>
        </View>
        <View className="parent-stat">
          <Text className="parent-stat-value">
            {summary.completedSessions}/{summary.sessionCount}
          </Text>
          <Text className="parent-stat-label">完成练习</Text>
        </View>
        <View className="parent-stat">
          <Text className="parent-stat-value">{summary.attentionCount}</Text>
          <Text className="parent-stat-label">教师复核后需关注</Text>
        </View>
      </View>

      <View className="parent-knowledge">
        <Text className="parent-section-label">知识点摘要</Text>
        {summary.knowledgePoints.length ? (
          <View className="parent-knowledge-list">
            {summary.knowledgePoints.map((point) => (
              <View className="parent-knowledge-item" key={point.label}>
                <Text className="parent-knowledge-name">{point.label}</Text>
                <Text className="parent-knowledge-count">
                  完成 {point.completedSessions}/{point.sessionCount} 次
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text className="parent-muted">暂无已审核的知识点摘要。</Text>
        )}
      </View>
    </View>
  );
}

function LearningControls({
  control,
  disabled,
  contextVersion,
  inFlight,
  onBusyChange,
  onSaved,
}: {
  readonly control: ParentLearningControl;
  readonly disabled: boolean;
  readonly contextVersion: { readonly current: number };
  readonly inFlight: { current: boolean };
  readonly onBusyChange: (busy: boolean) => void;
  readonly onSaved: (value: ParentLearningControl) => void;
}) {
  const [settings, setSettings] = useState<ParentLearningSettings>({
    enabled: control.enabled,
    maxDurationMinutes: control.maxDurationMinutes,
    maxHintLevel: control.maxHintLevel,
  });
  const [pending, setPending] = useState<"save" | "contact" | null>(null);
  const [feedback, setFeedback] = useState("");
  const active = useRef(false);
  const durations = [5, 10, 15];
  const hints = ["仅思路引导", "最多第 1 层提示", "最多第 2 层提示", "允许第 3 层讲解"];

  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);

  useEffect(() => {
    setSettings({
      enabled: control.enabled,
      maxDurationMinutes: control.maxDurationMinutes,
      maxHintLevel: control.maxHintLevel,
    });
  }, [control.enabled, control.maxDurationMinutes, control.maxHintLevel]);

  async function submit(action: "save" | "contact") {
    if (inFlight.current || disabled) return;
    const session = inviteSession.snapshot;
    if (!hasRoleAccess(session, "PARENT")) {
      setFeedback("请重新登录后操作。");
      return;
    }
    inFlight.current = true;
    onBusyChange(true);
    setPending(action);
    setFeedback("");
    const version = contextVersion.current;
    const isCurrent = () =>
      active.current && contextVersion.current === version && inviteSession.snapshot === session;
    const write = (path: string, body: unknown) => inviteSession.postAuthenticated(path, body);
    try {
      const result =
        action === "save"
          ? await saveParentLearningControls(write, control, settings)
          : await requestParentLearningContact(write, control);
      if (!isCurrent()) return;
      onSaved(result);
      setFeedback(
        action === "save" ? "学习设置已保存。" : "联系意向已记录，请通过机构现有方式联系老师。",
      );
    } catch {
      if (isCurrent()) setFeedback("未能确认操作结果，请刷新核对后重试；填写的设置仍保留。");
    } finally {
      inFlight.current = false;
      onBusyChange(false);
      if (active.current) setPending(null);
    }
  }

  return (
    <View className="parent-summary-card parent-controls-card">
      <Text className="parent-section-title">学习辅助设置</Text>
      <Text className="parent-muted">
        仅为{control.studentLabel}设置；实际使用还需机构开启学习辅助。
      </Text>
      <View className="parent-control-row">
        <Text className="parent-section-label">允许使用学习辅助</Text>
        <Switch
          checked={settings.enabled}
          color="#82b435"
          disabled={disabled || pending !== null}
          onChange={(event) => {
            setFeedback("");
            setSettings({ ...settings, enabled: event.detail.value });
          }}
        />
      </View>
      <Text className="parent-control-label">每次使用时长</Text>
      <Picker
        mode="selector"
        range={["5 分钟", "10 分钟", "15 分钟"]}
        value={durations.indexOf(settings.maxDurationMinutes)}
        disabled={disabled || pending !== null}
        onChange={(event) => {
          const duration = durations[Number(event.detail.value)];
          if (duration === undefined) return;
          setFeedback("");
          setSettings({ ...settings, maxDurationMinutes: duration });
        }}
      >
        <View className="parent-control-picker">{settings.maxDurationMinutes} 分钟 · 点击选择</View>
      </Picker>
      <Text className="parent-control-label">最多允许的提示</Text>
      <Picker
        mode="selector"
        range={hints}
        value={settings.maxHintLevel}
        disabled={disabled || pending !== null}
        onChange={(event) => {
          const level = Number(event.detail.value);
          if (!Number.isInteger(level) || level < 0 || level > 3) return;
          setFeedback("");
          setSettings({ ...settings, maxHintLevel: level });
        }}
      >
        <View className="parent-control-picker">{hints[settings.maxHintLevel]} · 点击选择</View>
      </Picker>
      <Text className="parent-muted">
        修改后请保存。联系操作仅记录联系意向，不发送通知，也不提交未保存的设置。
      </Text>
      <View className="parent-control-actions">
        <Button
          className="parent-button"
          disabled={disabled || pending !== null}
          loading={pending === "save"}
          onClick={() => void submit("save")}
        >
          保存设置
        </Button>
        <Button
          className="parent-button parent-button-secondary"
          disabled={disabled || pending !== null || control.contactStatus === "RECORDED_LOCAL"}
          loading={pending === "contact"}
          onClick={() => void submit("contact")}
        >
          {control.contactStatus === "RECORDED_LOCAL" ? "意向已记录" : "联系老师"}
        </Button>
      </View>
      {feedback ? <Text className="parent-muted">{feedback}</Text> : null}
    </View>
  );
}

export default function ParentHomePage() {
  const [displayName, setDisplayName] = useState("");
  const [status, setStatus] = useState<PageStatus>("LOADING");
  const [message, setMessage] = useState("正在确认家长服务权限…");
  const [projection, setProjection] = useState<ParentLearningProjection | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [controlBusy, setControlBusy] = useState(false);
  const controlWriteInFlight = useRef(false);
  const mounted = useRef(false);
  const hasShown = useRef(false);
  const initialLoadDone = useRef(false);
  const refreshInFlight = useRef(false);
  const contextVersion = useRef(0);

  useEffect(() => {
    mounted.current = true;
    void loadInitial();
    return () => {
      mounted.current = false;
      initialLoadDone.current = false;
      contextVersion.current += 1;
    };
  }, []);

  useDidShow(() => {
    if (hasShown.current && initialLoadDone.current) void refresh();
    hasShown.current = true;
  });

  async function loadInitial() {
    const session = await inviteSession.restore();
    if (!mounted.current) return;
    if (!hasRoleAccess(session, "PARENT")) {
      void Taro.redirectTo({ url: "/pages/auth/login/index" });
      return;
    }
    setDisplayName(session.displayName);
    const version = contextVersion.current;
    try {
      const result = await loadParentLearningSummary((path) =>
        inviteSession.getAuthenticated(path),
      );
      if (
        !mounted.current ||
        contextVersion.current !== version ||
        inviteSession.snapshot !== session
      )
        return;
      setProjection(result);
      setMessage("仅展示当前家长账号已审核关联的学习摘要。");
      setStatus("READY");
      initialLoadDone.current = true;
    } catch (error) {
      if (
        !mounted.current ||
        contextVersion.current !== version ||
        inviteSession.snapshot !== session
      )
        return;
      setMessage(errorMessage(error));
      setStatus("ERROR");
      initialLoadDone.current = true;
    }
  }

  async function refresh() {
    if (refreshInFlight.current || controlWriteInFlight.current) return;
    const session = inviteSession.snapshot;
    if (!hasRoleAccess(session, "PARENT")) {
      setProjection(null);
      void Taro.redirectTo({ url: "/pages/auth/login/index" });
      return;
    }
    refreshInFlight.current = true;
    const version = ++contextVersion.current;
    setRefreshing(true);
    try {
      const result = await loadParentLearningSummary((path) =>
        inviteSession.getAuthenticated(path),
      );
      if (
        !mounted.current ||
        contextVersion.current !== version ||
        inviteSession.snapshot !== session
      )
        return;
      setProjection(result);
      setMessage("学习摘要已更新。");
      setStatus("READY");
    } catch (error) {
      if (
        !mounted.current ||
        contextVersion.current !== version ||
        inviteSession.snapshot !== session
      )
        return;
      setMessage(errorMessage(error));
      setStatus("ERROR");
    } finally {
      refreshInFlight.current = false;
      if (mounted.current) setRefreshing(false);
    }
  }

  async function switchAccount() {
    contextVersion.current += 1;
    setProjection(null);
    setDisplayName("");
    setStatus("LOADING");
    setMessage("正在退出当前账号…");
    await inviteSession.logout();
    void Taro.redirectTo({ url: "/pages/auth/login/index" });
  }

  function returnToVisitor() {
    contextVersion.current += 1;
    void Taro.redirectTo({ url: "/pages/visitor/home/index" });
  }

  function openBinding() {
    contextVersion.current += 1;
    void Taro.navigateTo({ url: "/pages/parent/binding/index" });
  }

  function openCareRecords() {
    contextVersion.current += 1;
    void Taro.navigateTo({ url: "/pages/parent/care-record/index" });
  }

  function openFees() {
    contextVersion.current += 1;
    void Taro.navigateTo({ url: "/pages/parent/fees/index" });
  }

  function openChildMonthlyReports() {
    contextVersion.current += 1;
    void Taro.navigateTo({ url: "/pages/parent/child-monthly/index" });
  }

  function openNotices() {
    contextVersion.current += 1;
    void Taro.navigateTo({ url: "/pages/parent/notices/index" });
  }

  function openLeaveRequests() {
    contextVersion.current += 1;
    void Taro.navigateTo({ url: "/pages/parent/leave/index" });
  }

  function openHealthNotices() {
    contextVersion.current += 1;
    void Taro.navigateTo({ url: "/pages/parent/health-notices/index" });
  }

  function openPickup() {
    contextVersion.current += 1;
    void Taro.navigateTo({ url: "/pages/parent/pickup/index" });
  }

  function openParentFixedLearning(studentId: string) {
    contextVersion.current += 1;
    void Taro.navigateTo({
      url: `/pages/parent/learning/index?studentId=${encodeURIComponent(studentId)}`,
    });
  }

  const summaries = new Map((projection?.parentSummary ?? []).map((row) => [row.studentId, row]));
  const selectedStudent = selectParentLearningStudent(projection, selectedStudentId);
  const selectedSummary = selectedStudent ? summaries.get(selectedStudent.studentId) : undefined;
  const selectedControl = projection?.parentControls?.find(
    (control) => control.studentId === selectedStudent?.studentId,
  );

  return (
    <View className="parent-learning-page">
      <View className="parent-brand">
        <View className="parent-brand-mark">心</View>
        <View>
          <Text className="parent-brand-name">同芯学园</Text>
          <Text className="parent-brand-subtitle">TONG XIN XUE YUAN</Text>
        </View>
      </View>

      <View className="parent-intro">
        <Text className="parent-eyebrow">家长服务 · 学习成长</Text>
        <Text className="parent-title">孩子学习摘要</Text>
        <Text className="parent-copy">{displayName ? `${displayName}，你好。` : "你好。"}</Text>
        <Text className="parent-copy">
          查看学习时长、练习完成情况和知识点摘要；需关注内容经过教师复核后显示。
        </Text>
      </View>

      {status === "LOADING" ? (
        <View className="parent-state-card">
          <Text className="parent-state-title">正在读取</Text>
          <Text className="parent-muted">{message}</Text>
        </View>
      ) : null}

      {status === "ERROR" ? (
        <View className="parent-state-card">
          <Text className="parent-state-title">暂时无法显示</Text>
          <Text className="parent-muted">{message}</Text>
          <Button className="parent-button" loading={refreshing} onClick={() => void refresh()}>
            重新读取
          </Button>
        </View>
      ) : null}

      {status === "READY" && projection?.approvedStudents.length === 0 ? (
        <View className="parent-state-card">
          <Text className="parent-state-title">暂无已审核关联</Text>
          <Text className="parent-muted">
            完成家长关系审核后，这里会显示相应的学习摘要。当前没有可展示的学生资料。
          </Text>
          <Text className="parent-updated">
            更新时间：{updatedAt(projection.parentSummaryUpdatedAt)}
          </Text>
          <Button
            className="parent-button parent-button-secondary"
            disabled={refreshing}
            loading={refreshing}
            onClick={() => void refresh()}
          >
            重新读取
          </Button>
        </View>
      ) : null}

      {status === "READY" && projection?.approvedStudents.length ? (
        <View className="parent-results">
          <View className="parent-results-heading">
            <View>
              <Text className="parent-section-title">我的孩子</Text>
              <Text className="parent-muted">{message}</Text>
            </View>
            <Button
              className="parent-refresh-button"
              disabled={refreshing || controlBusy}
              loading={refreshing}
              onClick={() => void refresh()}
            >
              刷新
            </Button>
          </View>
          {projection.approvedStudents.length > 1 ? (
            <View className="parent-child-selector">
              <Text className="parent-child-selector-label">选择要查看的孩子</Text>
              <View className="parent-child-options">
                {projection.approvedStudents.map((student) => (
                  <Button
                    key={student.studentId}
                    className={`parent-child-option${selectedStudent?.studentId === student.studentId ? " parent-child-option-active" : ""}`}
                    disabled={refreshing || controlBusy}
                    onClick={() => {
                      if (controlWriteInFlight.current) return;
                      if (selectedStudent?.studentId === student.studentId) return;
                      contextVersion.current += 1;
                      setSelectedStudentId(student.studentId);
                    }}
                  >
                    {student.studentLabel}
                  </Button>
                ))}
              </View>
            </View>
          ) : null}
          {selectedStudent && selectedSummary ? (
            <SummaryCard key={selectedStudent.studentId} summary={selectedSummary} />
          ) : selectedStudent ? (
            <View className="parent-summary-card">
              <Text className="parent-student-name">{selectedStudent.studentLabel}</Text>
              <Text className="parent-muted">暂无已审核的学习摘要。</Text>
            </View>
          ) : null}
          {selectedControl ? (
            <LearningControls
              key={selectedControl.studentId}
              control={selectedControl}
              disabled={refreshing}
              contextVersion={contextVersion}
              inFlight={controlWriteInFlight}
              onBusyChange={(busy) => {
                if (mounted.current) setControlBusy(busy);
              }}
              onSaved={(control) =>
                setProjection((current) =>
                  current
                    ? {
                        ...current,
                        parentControls: current.parentControls?.map((value) =>
                          value.studentId === control.studentId ? control : value,
                        ),
                      }
                    : current,
                )
              }
            />
          ) : null}
          {selectedStudent && selectedControl ? (
            <View className="parent-summary-card parent-practice-card">
              <Text className="parent-section-title">固定题目练习</Text>
              <Text className="parent-muted">
                练习内容固定；开始前可查看学习支持说明并管理授权。
              </Text>
              <Button
                className="parent-button parent-practice-entry"
                disabled={refreshing || controlBusy}
                onClick={() => openParentFixedLearning(selectedStudent.studentId)}
              >
                固定题目练习
              </Button>
            </View>
          ) : null}
          <Text className="parent-updated">
            更新时间：{updatedAt(projection.parentSummaryUpdatedAt)}
          </Text>
        </View>
      ) : null}

      <Button className="parent-button" onClick={openBinding}>
        申请关联学生
      </Button>
      <Button className="parent-button parent-button-secondary" onClick={openCareRecords}>
        查看成长记录
      </Button>
      <Button className="parent-button parent-button-secondary" onClick={openChildMonthlyReports}>
        孩子月报
      </Button>
      <Button className="parent-button parent-button-secondary" onClick={openFees}>
        费用信息
      </Button>
      <Button className="parent-button parent-button-secondary" onClick={openNotices}>
        通知与确认
      </Button>
      <Button className="parent-button parent-button-secondary" onClick={openLeaveRequests}>
        请假申请
      </Button>
      <Button className="parent-button parent-button-secondary" onClick={openHealthNotices}>
        健康消息
      </Button>
      <Button className="parent-button parent-button-secondary" onClick={openPickup}>
        接送授权
      </Button>
      <Button className="parent-button parent-button-secondary" onClick={returnToVisitor}>
        返回访客首页
      </Button>
      <Button
        className="parent-button parent-button-secondary"
        onClick={() => void Taro.navigateTo({ url: "/pages/account/index" })}
      >
        我的账号
      </Button>
      <Button
        className="parent-button parent-button-secondary"
        onClick={() => void switchAccount()}
      >
        切换账号
      </Button>
      <Text className="parent-footnote">
        学习摘要由机构服务提供；本页不展示练习原题或教师待复核内容。
      </Text>
    </View>
  );
}
