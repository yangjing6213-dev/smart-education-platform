export interface LearningSafetySummary {
  readonly metricVersion: "LEARNING_SAFETY_V2";
  readonly totalSessions: number;
  readonly activeSessions: number;
  readonly completedSessions: number;
  readonly closedSessions: number;
  readonly expiredSessions: number;
  readonly hintRequests: number;
  readonly teacherFollowUps: number;
  readonly refusedActions: number;
  readonly teacherHandoffs: number;
  readonly fixedGuidanceSessions: number;
  readonly firstAttemptSuccesses: number;
  readonly hintAssistedSuccesses: number;
  readonly mainAnswerAttempts: number;
  readonly consolidationAnswered: number;
  readonly consolidationCorrect: number;
  readonly postHintAnswerRate: LearningRateMetric;
  readonly consolidationCompletionRate: LearningRateMetric;
  readonly teacherInterventionRate: LearningRateMetric;
  readonly answerErrorRate: LearningRateMetric;
  readonly severeSafetyEvents: number;
}

export interface LearningRateMetric {
  readonly numerator: number;
  readonly denominator: number;
  readonly percent: number | null;
}

export interface LearningSafetySnapshot {
  readonly status: "IDLE" | "CONNECTING" | "READY" | "DENIED" | "DISCONNECTED";
  readonly message: string;
  readonly summary: LearningSafetySummary | null;
}

const empty = (): LearningSafetySnapshot => ({
  status: "IDLE",
  message: "仅显示匿名安全汇总。",
  summary: null,
});
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isRateMetric = (value: unknown): value is LearningRateMetric => {
  if (
    !isObject(value) ||
    Object.keys(value).length !== 3 ||
    !["numerator", "denominator", "percent"].every((key) =>
      Object.hasOwn(value, key),
    ) ||
    !Number.isSafeInteger(value.numerator) ||
    !Number.isSafeInteger(value.denominator) ||
    Number(value.numerator) < 0 ||
    Number(value.denominator) < 0 ||
    Number(value.numerator) > Number(value.denominator)
  )
    return false;
  if (value.denominator === 0)
    return value.numerator === 0 && value.percent === null;
  return (
    typeof value.percent === "number" &&
    Number.isFinite(value.percent) &&
    value.percent >= 0 &&
    value.percent <= 100 &&
    Number.isInteger(value.percent * 10) &&
    value.percent ===
      Math.round((Number(value.numerator) / Number(value.denominator)) * 1000) /
        10
  );
};
const numericFields = [
  "totalSessions",
  "activeSessions",
  "completedSessions",
  "closedSessions",
  "expiredSessions",
  "hintRequests",
  "teacherFollowUps",
  "refusedActions",
  "teacherHandoffs",
  "fixedGuidanceSessions",
  "firstAttemptSuccesses",
  "hintAssistedSuccesses",
  "mainAnswerAttempts",
  "consolidationAnswered",
  "consolidationCorrect",
  "severeSafetyEvents",
] as const;
const rateFields = [
  "postHintAnswerRate",
  "consolidationCompletionRate",
  "teacherInterventionRate",
  "answerErrorRate",
] as const;
const allowedFields = new Set<string>([
  "metricVersion",
  ...numericFields,
  ...rateFields,
]);
const validSummary = (value: unknown): value is LearningSafetySummary =>
  isObject(value) &&
  Object.keys(value).length === allowedFields.size &&
  Object.keys(value).every((key) => allowedFields.has(key)) &&
  value.metricVersion === "LEARNING_SAFETY_V2" &&
  numericFields.every(
    (key) => Number.isSafeInteger(value[key]) && Number(value[key]) >= 0,
  ) &&
  rateFields.every((key) => isRateMetric(value[key]));
const escape = (value: string | number) =>
  String(value).replace(
    /[&<>"']/gu,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );

export class LearningSafetyAdminClient {
  #fetcher: typeof fetch;
  #handle: string | null = null;
  #snapshot = empty();

  constructor(fetcher: typeof fetch = fetch) {
    this.#fetcher = fetcher;
  }

  get snapshot(): LearningSafetySnapshot {
    return this.#snapshot;
  }

  async connect(profile: "platform-admin" = "platform-admin"): Promise<void> {
    this.#handle = null;
    this.#snapshot = {
      ...empty(),
      status: "CONNECTING",
      message: "正在读取匿名安全汇总…",
    };
    try {
      const created = await this.#request<{ handle: string }>(
        "/local/sessions",
        "POST",
        {
          profile,
        },
      );
      if (
        typeof created.handle !== "string" ||
        !/^[\w-]{43}$/u.test(created.handle)
      )
        throw new Error("本机管理身份无效。");
      this.#handle = created.handle;
      const session = await this.#request<{
        profile: string;
        actions: readonly string[];
      }>("/local/session");
      if (
        session.profile !== profile ||
        !session.actions.includes("learning:safety-summary")
      )
        throw new Error("当前身份无权查看匿名安全汇总。");
      await this.refresh();
    } catch (error) {
      this.#snapshot = {
        status: "DENIED",
        message:
          error instanceof Error ? error.message : "无法读取匿名安全汇总。",
        summary: null,
      };
    }
  }

  async refresh(): Promise<void> {
    if (!this.#handle) return;
    try {
      const summary = await this.#request<unknown>(
        "/local/learning-safety-summary",
      );
      if (!validSummary(summary)) throw new Error("安全汇总格式无效。");
      this.#snapshot = {
        status: "READY",
        message: "仅显示不含个人信息的汇总数字。",
        summary,
      };
    } catch (error) {
      this.#snapshot = {
        status: "DENIED",
        message:
          error instanceof Error ? error.message : "无法读取匿名安全汇总。",
        summary: null,
      };
    }
  }

  disconnect(): void {
    this.#handle = null;
    this.#snapshot = {
      ...empty(),
      status: "DISCONNECTED",
      message: "汇总页面已关闭。",
    };
  }

  async #request<T>(
    path: string,
    method: "GET" | "POST" = "GET",
    body?: unknown,
  ): Promise<T> {
    const response = await this.#fetcher(path, {
      method,
      headers: {
        ...(this.#handle ? { authorization: `Bearer ${this.#handle}` } : {}),
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok)
      throw new Error(`本机汇总读取失败（${response.status}）。`);
    return (await response.json()) as T;
  }
}

export function renderLearningSafety(snapshot: LearningSafetySnapshot): string {
  const summary = snapshot.status === "READY" ? snapshot.summary : null;
  const formatRate = (metric: LearningRateMetric) =>
    metric.percent === null
      ? "暂无样本"
      : `${metric.numerator} / ${metric.denominator}（${metric.percent.toFixed(1)}%）`;
  const metrics: readonly (readonly [string, number | string])[] = summary
    ? [
        ["学习会话总数", summary.totalSessions],
        ["进行中", summary.activeSessions],
        ["已完成", summary.completedSessions],
        ["已关闭", summary.closedSessions],
        ["已超时", summary.expiredSessions],
        ["提示请求次数", summary.hintRequests],
        ["需教师跟进", summary.teacherFollowUps],
        ["拒绝操作次数", summary.refusedActions],
        ["教师接手次数", summary.teacherHandoffs],
        ["固定题库指导会话", summary.fixedGuidanceSessions],
        ["首次作答正确会话", summary.firstAttemptSuccesses],
        ["提示后完成主问题", summary.hintAssistedSuccesses],
        ["主问题作答总次数", summary.mainAnswerAttempts],
        ["巩固题作答数", summary.consolidationAnswered],
        ["巩固题答对数", summary.consolidationCorrect],
        ["提示后继续作答率", formatRate(summary.postHintAnswerRate)],
        ["同类巩固题完成率", formatRate(summary.consolidationCompletionRate)],
        ["教师实际介入率", formatRate(summary.teacherInterventionRate)],
        ["作答错误率", formatRate(summary.answerErrorRate)],
        ["明确记录的严重安全事件", summary.severeSafetyEvents],
      ]
    : [];
  const cards = metrics
    .map(
      ([label, value]) =>
        `<article class="panel learning-safety-metric"><span>${escape(label)}</span><strong>${escape(value)}</strong></article>`,
    )
    .join("");
  return `<main class="review-main learning-safety" data-learning-safety><header class="heading-row"><div><p class="section-kicker">平台管理 · 合成演示</p><h1>学习安全汇总</h1><p>仅显示匿名总量，不包含学生、班级或学习记录明细。</p></div><span class="status">匿名安全汇总</span></header><p class="notice" role="status" aria-live="polite" data-learning-safety-status>${escape(snapshot.message)}</p>${summary ? `<p class="learning-safety-version">指标口径：V2（本机合成数据）</p><section class="learning-safety-grid" aria-label="匿名学习评测指标">${cards}</section>` : ""}<p class="learning-safety-note">比例展示分子与分母；分母为零时显示“暂无样本”。数据不代表独立学生人数，也不能证明学习提升或教师减负；它们只反映本机固定题库演示，不接入正式 AI，也不代表生产环境的安全或学习效果结论。</p></main>`;
}
