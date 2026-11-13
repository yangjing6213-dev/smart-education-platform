import { Button, Checkbox, Picker, Text, View } from "@tarojs/components";
import Taro, { useLoad } from "@tarojs/taro";
import { useEffect, useRef, useState } from "react";
import {
  loadParentBindingApplications,
  loadParentGuardianRelationships,
} from "../../../binding/parent-binding";
import { inviteSession } from "../../../auth/runtime-session";
import { hasRoleAccess } from "../../../auth/role-gate";
import { loadParentLearningSummary } from "../../../learning/parent-learning-summary";
import {
  answerFixedLearningItem,
  closeFixedLearningSession,
  grantLearningSupportConsent,
  hasCurrentLearningSupportConsent,
  nextLearningHintLevel,
  parseParentLearningSessions,
  requestNextLearningHint,
  resolveParentFixedLearningContext,
  revokeLearningSupportConsent,
  startFixedLearningSession,
  type LearningSessionView,
  type ParentFixedLearningContext,
} from "../../../learning/parent-learning-sessions";
import "./index.css";

type PageStatus = "LOADING" | "READY" | "ERROR";
type PendingAction = "consent" | "start" | "answer-main" | "answer-practice" | "hint" | "close";

const STUDENT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const DURATIONS = [5, 10, 15] as const;

function errorCode(error: unknown): number | null {
  if (typeof error !== "object" || error === null || !("statusCode" in error)) return null;
  const value = Number(error.statusCode);
  return Number.isInteger(value) ? value : null;
}

function errorMessage(error: unknown): string {
  const code = errorCode(error);
  if (code === 401) return "登录状态已过期，请重新登录后继续。";
  if (code === 403) return "当前无法使用学习练习；请确认关系、授权和机构设置后重试。";
  if (code === 409) return "练习状态已变化，请重新读取后继续。";
  if (error instanceof Error && error.message) return error.message;
  return "学习练习暂时无法读取，请稍后重试。";
}

function statusLabel(status: LearningSessionView["status"]): string {
  if (status === "ACTIVE") return "进行中";
  if (status === "COMPLETED") return "已完成";
  if (status === "CLOSED") return "已结束";
  if (status === "EXPIRED") return "已到时间";
  return "已结束";
}

export default function ParentFixedLearningPage() {
  const [studentId, setStudentId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [status, setStatus] = useState<PageStatus>("LOADING");
  const [message, setMessage] = useState("正在确认家长服务权限…");
  const [context, setContext] = useState<ParentFixedLearningContext | null>(null);
  const [session, setSession] = useState<LearningSessionView | null>(null);
  const [durationMinutes, setDurationMinutes] = useState<number>(5);
  const [consentChecked, setConsentChecked] = useState(false);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [feedback, setFeedback] = useState("");
  const mounted = useRef(false);
  const requestVersion = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      requestVersion.current += 1;
    };
  }, []);

  useLoad((params) => {
    const requestedStudentId = typeof params?.studentId === "string" ? params.studentId : "";
    void loadPage(requestedStudentId);
  });

  async function loadPage(requestedStudentId: string) {
    const version = ++requestVersion.current;
    setStudentId(requestedStudentId);
    setStatus("LOADING");
    setMessage("正在读取已审核关系和学习设置…");
    setFeedback("");
    setContext(null);
    setSession(null);
    if (!STUDENT_ID.test(requestedStudentId)) {
      setStatus("ERROR");
      setMessage("学生资料无效，请从家长首页重新进入。");
      return;
    }

    const authenticated = await inviteSession.restore();
    if (!mounted.current || requestVersion.current !== version) return;
    if (!hasRoleAccess(authenticated, "PARENT")) {
      void Taro.redirectTo({ url: "/pages/auth/login/index" });
      return;
    }
    setDisplayName(authenticated.displayName);
    const isCurrent = () =>
      mounted.current &&
      requestVersion.current === version &&
      inviteSession.snapshot === authenticated;
    const read = (path: string) => inviteSession.getAuthenticated(path);

    try {
      const projection = await loadParentLearningSummary(read);
      if (!isCurrent()) return;
      if (!projection.approvedStudents.some((student) => student.studentId === requestedStudentId))
        throw new Error("当前家长账号没有该孩子的已审核关联。");

      const [applications, relationships, policies, consents] = await Promise.all([
        loadParentBindingApplications(read),
        loadParentGuardianRelationships(read),
        read("/consent-policies"),
        read("/consents"),
      ]);
      if (!isCurrent()) return;

      const base = resolveParentFixedLearningContext({
        studentId: requestedStudentId,
        projection,
        applications,
        relationships,
        policies,
        consents,
      });
      let nextContext = base;
      if (base.control.enabled && hasCurrentLearningSupportConsent(base)) {
        const sessionRows = await read(
          `/parent/students/${encodeURIComponent(requestedStudentId)}/learning-sessions`,
        );
        if (!isCurrent()) return;
        const sessions = parseParentLearningSessions(sessionRows, requestedStudentId);
        nextContext = { ...base, sessions };
      }
      setContext(nextContext);
      setSession(
        nextContext.sessions.find((item) => item.status === "ACTIVE") ??
          nextContext.sessions[0] ??
          null,
      );
      setDurationMinutes(5);
      setMessage("仅显示当前家长账号已审核关联的孩子和练习记录。");
      setStatus("READY");
    } catch (error) {
      if (!isCurrent()) return;
      setMessage(errorMessage(error));
      setStatus("ERROR");
    }
  }

  async function perform<T>(
    action: PendingAction,
    operation: () => Promise<T>,
    onSuccess: (result: T) => void,
    successMessage: string,
  ) {
    if (pending !== null) return;
    const authenticated = inviteSession.snapshot;
    if (!hasRoleAccess(authenticated, "PARENT")) {
      void Taro.redirectTo({ url: "/pages/auth/login/index" });
      return;
    }
    const version = requestVersion.current;
    const isCurrent = () =>
      mounted.current &&
      requestVersion.current === version &&
      inviteSession.snapshot === authenticated;
    setPending(action);
    setFeedback("");
    try {
      const result = await operation();
      if (!isCurrent()) return;
      onSuccess(result);
      setFeedback(successMessage);
    } catch (error) {
      if (!isCurrent()) return;
      setFeedback(errorMessage(error));
      if (errorCode(error) === 409) void loadPage(studentId);
    } finally {
      if (mounted.current) setPending(null);
    }
  }

  async function grantConsent() {
    if (!context) return;
    await perform(
      "consent",
      () =>
        grantLearningSupportConsent(
          (path, body) => inviteSession.postAuthenticated(path, body),
          context.binding.id,
          context.policy,
          consentChecked,
        ),
      (consent) => {
        setContext((current) => (current ? { ...current, consent } : current));
        setConsentChecked(false);
      },
      "学习支持授权已记录。你可以开始固定题目练习。",
    );
  }

  async function revokeConsent() {
    if (!context?.consent || context.consent.status !== "ACTIVE") return;
    const confirmation = await Taro.showModal({
      title: "撤回学习授权",
      content: "撤回后不能继续学习练习；已记录内容不会因此删除。",
      confirmText: "撤回授权",
      cancelText: "暂不撤回",
    });
    if (!confirmation.confirm) return;
    await perform(
      "consent",
      () =>
        revokeLearningSupportConsent(
          (path, body) => inviteSession.postAuthenticated(path, body),
          context.consent!,
        ),
      (consent) => {
        setContext((current) => (current ? { ...current, consent, sessions: [] } : current));
        setSession(null);
      },
      "学习授权已撤回；本页已隐藏练习记录。撤回不会删除机构保存的记录。",
    );
  }

  async function startOrResume() {
    if (!context) return;
    await perform(
      "start",
      () =>
        startFixedLearningSession(
          (path, body) => inviteSession.postAuthenticated(path, body),
          context,
          durationMinutes,
        ),
      (next) => setSession(next),
      "练习已读取。",
    );
  }

  async function answer(itemId: "main" | "practice-1" | "practice-2", choice: "A" | "B" | "C") {
    if (!session) return;
    await perform(
      itemId === "main" ? "answer-main" : "answer-practice",
      () =>
        answerFixedLearningItem(
          (path, body) => inviteSession.postAuthenticated(path, body),
          session,
          itemId,
          choice,
        ),
      (next) => setSession(next),
      "答案已保存。",
    );
  }

  async function requestHint() {
    if (!session || !context) return;
    await perform(
      "hint",
      () =>
        requestNextLearningHint(
          (path, body) => inviteSession.postAuthenticated(path, body),
          session,
          context.control.maxHintLevel,
        ),
      (next) => setSession(next),
      "提示已读取。",
    );
  }

  async function closeSession() {
    if (!session || session.status !== "ACTIVE") return;
    const confirmation = await Taro.showModal({
      title: "结束本次练习",
      content: "结束后可以重新开始一份固定题目练习。",
      confirmText: "结束练习",
      cancelText: "继续练习",
    });
    if (!confirmation.confirm) return;
    await perform(
      "close",
      () =>
        closeFixedLearningSession(
          (path, body) => inviteSession.postAuthenticated(path, body),
          session,
        ),
      (next) => setSession(next),
      "本次练习已结束。",
    );
  }

  function returnHome() {
    void Taro.redirectTo({ url: "/pages/parent/home/index" });
  }

  const currentConsent = context ? hasCurrentLearningSupportConsent(context) : false;
  const activeConsent = context?.consent?.status === "ACTIVE";
  const activeSession = session?.status === "ACTIVE" ? session : null;
  const allowedDurations = context
    ? DURATIONS.filter((duration) => duration <= context.control.maxDurationMinutes)
    : [];
  const nextHint =
    session && context ? nextLearningHintLevel(session, context.control.maxHintLevel) : null;

  return (
    <View className="parent-fixed-learning-page">
      <View className="parent-fixed-learning-topbar">
        <Button className="parent-fixed-learning-back" onClick={returnHome}>
          返回家长首页
        </Button>
      </View>
      <View className="parent-fixed-learning-brand">
        <View className="parent-fixed-learning-mark">心</View>
        <View>
          <Text className="parent-fixed-learning-brand-name">同芯学园</Text>
          <Text className="parent-fixed-learning-brand-caption">家长服务 · 学习成长</Text>
        </View>
      </View>

      <View className="parent-fixed-learning-card parent-fixed-learning-intro">
        <Text className="parent-fixed-learning-eyebrow">固定题目 · 家长可控</Text>
        <Text className="parent-fixed-learning-title">学习练习</Text>
        <Text className="parent-fixed-learning-copy">
          {displayName ? `${displayName}，` : ""}
          这里只展示你已审核关联孩子的固定题目练习。时长和提示范围按家长设置执行。
        </Text>
      </View>

      {status === "LOADING" ? (
        <View className="parent-fixed-learning-card">
          <Text className="parent-fixed-learning-section-title">正在读取</Text>
          <Text className="parent-fixed-learning-muted">{message}</Text>
        </View>
      ) : null}

      {status === "ERROR" ? (
        <View className="parent-fixed-learning-card">
          <Text className="parent-fixed-learning-section-title">暂时无法显示</Text>
          <Text className="parent-fixed-learning-muted">{message}</Text>
          <Button
            className="parent-fixed-learning-button"
            loading={pending !== null}
            onClick={() => void loadPage(studentId)}
          >
            重新读取
          </Button>
        </View>
      ) : null}

      {status === "READY" && context ? (
        <>
          <View className="parent-fixed-learning-card">
            <Text className="parent-fixed-learning-eyebrow">当前孩子</Text>
            <Text className="parent-fixed-learning-section-title">
              {context.student.studentLabel}
            </Text>
            <Text className="parent-fixed-learning-muted">{context.student.classLabel}</Text>
            <Text className="parent-fixed-learning-muted">{message}</Text>
            <Button
              className="parent-fixed-learning-button parent-fixed-learning-button-secondary"
              disabled={pending !== null}
              onClick={() => void loadPage(studentId)}
            >
              重新读取
            </Button>
          </View>

          <View className="parent-fixed-learning-card">
            <Text className="parent-fixed-learning-section-title">学习支持说明</Text>
            <Text className="parent-fixed-learning-copy">{context.policy.necessity}</Text>
            <Text className="parent-fixed-learning-muted">
              记录内容：{context.policy.dataClasses.join("、")}
            </Text>
            <Text className="parent-fixed-learning-muted">{context.policy.retentionNotice}</Text>
            <Text className="parent-fixed-learning-muted">
              当前只提供固定题目和选项，不接入开放式聊天或照片上传。
            </Text>

            {activeConsent && currentConsent ? (
              <View className="parent-fixed-learning-consent-state">
                <Text className="parent-fixed-learning-consent-label">学习支持已授权</Text>
                <Text className="parent-fixed-learning-muted">
                  说明版本：{context.policy.noticeVersion} · 方案：{context.policy.policyVersion}
                </Text>
                <Button
                  className="parent-fixed-learning-button parent-fixed-learning-button-secondary"
                  disabled={pending !== null}
                  loading={pending === "consent"}
                  onClick={() => void revokeConsent()}
                >
                  撤回学习授权
                </Button>
              </View>
            ) : activeConsent ? (
              <View className="parent-fixed-learning-consent-state">
                <Text className="parent-fixed-learning-warning">
                  学习说明已更新，请先撤回旧授权，再阅读并确认新说明。
                </Text>
                <Button
                  className="parent-fixed-learning-button parent-fixed-learning-button-secondary"
                  disabled={pending !== null}
                  loading={pending === "consent"}
                  onClick={() => void revokeConsent()}
                >
                  撤回旧授权
                </Button>
              </View>
            ) : (
              <View className="parent-fixed-learning-consent-form">
                <View className="parent-fixed-learning-checkbox-row">
                  <Checkbox
                    value="learning-support-consent"
                    checked={consentChecked}
                    color="#82B435"
                    disabled={pending !== null}
                    onChange={(event) =>
                      setConsentChecked(event.detail.value.includes("learning-support-consent"))
                    }
                  />
                  <Text className="parent-fixed-learning-checkbox-copy">
                    我已阅读并同意以上学习支持说明
                  </Text>
                </View>
                <Button
                  className="parent-fixed-learning-button"
                  disabled={!consentChecked || pending !== null}
                  loading={pending === "consent"}
                  onClick={() => void grantConsent()}
                >
                  同意并开启学习支持
                </Button>
              </View>
            )}
          </View>

          {context.control.enabled ? (
            currentConsent ? (
              <View className="parent-fixed-learning-card">
                <View className="parent-fixed-learning-row">
                  <View>
                    <Text className="parent-fixed-learning-section-title">固定题目练习</Text>
                    <Text className="parent-fixed-learning-muted">
                      单次最多 {context.control.maxDurationMinutes} 分钟 · 提示最多第{" "}
                      {context.control.maxHintLevel} 层
                    </Text>
                  </View>
                  {session ? (
                    <Text className="parent-fixed-learning-status">
                      {statusLabel(session.status)}
                    </Text>
                  ) : null}
                </View>

                {!activeSession ? (
                  <Picker
                    mode="selector"
                    range={allowedDurations.map((duration) => `${duration} 分钟`)}
                    value={Math.max(0, allowedDurations.indexOf(durationMinutes as 5 | 10 | 15))}
                    disabled={pending !== null || allowedDurations.length < 2}
                    onChange={(event) => {
                      const duration = allowedDurations[Number(event.detail.value)];
                      if (duration !== undefined) setDurationMinutes(duration);
                    }}
                  >
                    <View className="parent-fixed-learning-picker">
                      本次时长：{durationMinutes} 分钟 · 点击选择
                    </View>
                  </Picker>
                ) : null}

                <Button
                  className="parent-fixed-learning-button"
                  disabled={pending !== null}
                  loading={pending === "start"}
                  onClick={() => void startOrResume()}
                >
                  {activeSession ? "继续练习" : session ? "再做一次" : "开始练习"}
                </Button>

                {session ? (
                  <View className="parent-fixed-learning-exercise">
                    <Text className="parent-fixed-learning-eyebrow">三年级 · 数学</Text>
                    <Text className="parent-fixed-learning-question">
                      {session.question.prompt}
                    </Text>
                    <Text className="parent-fixed-learning-muted">
                      知识点：{session.question.knowledgePoint}
                    </Text>

                    {session.visibleHint ? (
                      <View className="parent-fixed-learning-hint">
                        <Text className="parent-fixed-learning-consent-label">
                          第 {session.visibleHint.level + 1} 层提示
                        </Text>
                        <Text className="parent-fixed-learning-copy">
                          {session.visibleHint.text}
                        </Text>
                      </View>
                    ) : null}

                    {!session.mainCorrect && session.status === "ACTIVE" ? (
                      <>
                        <Text className="parent-fixed-learning-muted">
                          已尝试 {session.mainAttempts}/{session.mainAttemptLimit ?? 3} 次
                        </Text>
                        {session.mainAttempts < (session.mainAttemptLimit ?? 3) ? (
                          <View className="parent-fixed-learning-choice-list">
                            {session.question.choices.map((choice) => (
                              <Button
                                key={choice.id}
                                className="parent-fixed-learning-choice"
                                disabled={pending !== null}
                                loading={pending === "answer-main"}
                                onClick={() => void answer("main", choice.id)}
                              >
                                {choice.label}
                              </Button>
                            ))}
                          </View>
                        ) : (
                          <Text className="parent-fixed-learning-warning">
                            本次尝试次数已用完，可以结束练习或重新开始。
                          </Text>
                        )}
                      </>
                    ) : null}

                    {session.mainCorrect ? (
                      <View className="parent-fixed-learning-practice-list">
                        <Text className="parent-fixed-learning-consent-label">
                          主练习已完成 · 继续完成巩固题
                        </Text>
                        {session.consolidation.map((item) => (
                          <View className="parent-fixed-learning-practice-item" key={item.id}>
                            <Text className="parent-fixed-learning-question">{item.prompt}</Text>
                            {item.answered ? (
                              <Text className="parent-fixed-learning-muted">
                                {item.correct ? "已完成" : "已记录"}
                              </Text>
                            ) : session.status === "ACTIVE" ? (
                              <View className="parent-fixed-learning-choice-list">
                                {item.choices.map((choice) => (
                                  <Button
                                    key={choice.id}
                                    className="parent-fixed-learning-choice"
                                    disabled={pending !== null}
                                    loading={pending === "answer-practice"}
                                    onClick={() => void answer(item.id, choice.id)}
                                  >
                                    {choice.label}
                                  </Button>
                                ))}
                              </View>
                            ) : null}
                          </View>
                        ))}
                      </View>
                    ) : null}

                    {nextHint !== null ? (
                      <Button
                        className="parent-fixed-learning-button parent-fixed-learning-button-secondary"
                        disabled={pending !== null}
                        loading={pending === "hint"}
                        onClick={() => void requestHint()}
                      >
                        查看第 {nextHint + 1} 层提示
                      </Button>
                    ) : null}

                    {session.status === "ACTIVE" ? (
                      <Button
                        className="parent-fixed-learning-button parent-fixed-learning-button-secondary"
                        disabled={pending !== null}
                        loading={pending === "close"}
                        onClick={() => void closeSession()}
                      >
                        结束本次练习
                      </Button>
                    ) : (
                      <Text className="parent-fixed-learning-muted">
                        本次练习{statusLabel(session.status)}。
                      </Text>
                    )}
                  </View>
                ) : (
                  <Text className="parent-fixed-learning-muted">
                    开始后会保存固定题目的练习进度，可返回此页继续。
                  </Text>
                )}
              </View>
            ) : (
              <View className="parent-fixed-learning-card">
                <Text className="parent-fixed-learning-muted">完成学习支持授权后可开始练习。</Text>
              </View>
            )
          ) : (
            <View className="parent-fixed-learning-card">
              <Text className="parent-fixed-learning-section-title">学习辅助已关闭</Text>
              <Text className="parent-fixed-learning-muted">
                请先返回家长首页开启学习辅助并保存设置，再开始练习。
              </Text>
            </View>
          )}
        </>
      ) : null}

      {feedback ? <Text className="parent-fixed-learning-feedback">{feedback}</Text> : null}
      <Text className="parent-fixed-learning-footnote">
        固定示例题目 · 只保存选项和练习进度 · 不接入正式人工智能服务
      </Text>
    </View>
  );
}
