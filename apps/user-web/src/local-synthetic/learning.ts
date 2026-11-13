type LearningChoice = { readonly id: "A" | "B" | "C"; readonly label: string };
type LearningQuestion = {
  readonly prompt: string;
  readonly choices: readonly LearningChoice[];
};
export type LearningSession = {
  readonly id: string;
  readonly studentId?: string;
  readonly status: "ACTIVE" | "COMPLETED" | "CLOSED" | "EXPIRED" | "HANDED_OFF";
  readonly consentVersion: "LEARNING_DEMO_V2";
  readonly consentedAt: string;
  readonly guidanceMode: "FIXED_LOCAL";
  readonly studentLabel: string;
  readonly question: LearningQuestion;
  readonly mainAttempts: number;
  readonly mainAttemptLimit?: number;
  readonly mainAttemptLimitReached?: boolean;
  readonly lastHintAtAttempt: number;
  readonly mainCorrect: boolean;
  readonly highestHintLevel: -1 | 0 | 1 | 2 | 3;
  readonly visibleHint: { readonly level: 0 | 1 | 2 | 3; readonly text: string } | null;
  readonly consolidation: readonly {
    readonly id: "practice-1" | "practice-2";
    readonly prompt: string;
    readonly choices: readonly LearningChoice[];
    readonly answered: boolean;
    readonly correct: boolean | null;
  }[];
  readonly needsTeacherFollowUp: boolean;
  readonly endsAt: string;
};
export type LearningProfile = "parent-alpha" | "teacher-east";
export type LearningTeacherSummary = {
  readonly id: string;
  readonly status: "ACTIVE" | "COMPLETED" | "CLOSED" | "EXPIRED" | "HANDED_OFF";
  readonly studentLabel: string;
  readonly grade: string;
  readonly subject: string;
  readonly knowledgePoint: string;
  readonly mainAttempts: number;
  readonly highestHintLevel: -1 | 0 | 1 | 2 | 3;
  readonly consolidationCompleted: number;
  readonly needsTeacherFollowUp: boolean;
  readonly startedAt: string;
};
export type ParentLearningControl = {
  readonly studentId: string;
  readonly studentLabel: string;
  readonly enabled: boolean;
  readonly maxDurationMinutes: 5 | 10 | 15;
  readonly maxHintLevel: 0 | 1 | 2 | 3;
  readonly contactStatus: "NOT_REQUESTED" | "RECORDED_LOCAL";
};
export type LearningContactIntent = {
  readonly id: string;
  readonly studentLabel: string;
  readonly status: "RECORDED_LOCAL";
  readonly createdAt: string;
};
export type ApprovedLearningStudent = {
  readonly studentId: string;
  readonly studentLabel: string;
  readonly classLabel: string;
};
export type ParentLearningSummary = {
  readonly studentId: string;
  readonly studentLabel: string;
  readonly usedMinutes: number;
  readonly sessionCount: number;
  readonly completedSessions: number;
  readonly knowledgePoints: readonly {
    readonly label: string;
    readonly sessionCount: number;
    readonly completedSessions: number;
  }[];
  readonly attentionCount: number;
};
export type LearningKnowledgeResource = {
  readonly id: string;
  readonly version: number;
  readonly title: string;
  readonly summary: string;
  readonly content: string;
  readonly grade: string;
  readonly subject: string;
  readonly knowledgePoint: string;
  readonly sourceLabel: string;
  readonly expiresOn: string;
};
export interface ParentLearningSnapshot {
  readonly status: "IDLE" | "CONNECTING" | "BUSY" | "READY" | "DENIED" | "DISCONNECTED";
  readonly message: string;
  readonly approvedStudents: readonly ApprovedLearningStudent[];
  readonly knowledgeResources: readonly LearningKnowledgeResource[];
  readonly sessions: readonly LearningSession[];
  readonly activeSession: LearningSession | null;
  readonly profile?: LearningProfile;
  readonly teacherSummary?: readonly LearningTeacherSummary[];
  readonly parentControls?: readonly ParentLearningControl[];
  readonly parentContactIntents?: readonly LearningContactIntent[];
  readonly parentSummary?: readonly ParentLearningSummary[];
  readonly parentSummaryUpdatedAt?: string | null;
}

const initialSnapshot = (profile: LearningProfile = "parent-alpha"): ParentLearningSnapshot => ({
  status: "IDLE",
  message: "请先连接本机合成服务。",
  approvedStudents: [],
  knowledgeResources: [],
  sessions: [],
  activeSession: null,
  profile,
  teacherSummary: [],
  parentControls: [],
  parentContactIntents: [],
  parentSummary: [],
  parentSummaryUpdatedAt: null,
});
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isChoice = (value: unknown): value is "A" | "B" | "C" =>
  value === "A" || value === "B" || value === "C";
const parseParentControl = (value: unknown): ParentLearningControl | null =>
  isObject(value) &&
  typeof value.studentId === "string" &&
  typeof value.studentLabel === "string" &&
  typeof value.enabled === "boolean" &&
  (value.maxDurationMinutes === 5 ||
    value.maxDurationMinutes === 10 ||
    value.maxDurationMinutes === 15) &&
  (value.maxHintLevel === 0 ||
    value.maxHintLevel === 1 ||
    value.maxHintLevel === 2 ||
    value.maxHintLevel === 3) &&
  (value.contactStatus === "NOT_REQUESTED" || value.contactStatus === "RECORDED_LOCAL")
    ? {
        studentId: value.studentId,
        studentLabel: value.studentLabel,
        enabled: value.enabled,
        maxDurationMinutes: value.maxDurationMinutes,
        maxHintLevel: value.maxHintLevel,
        contactStatus: value.contactStatus,
      }
    : null;
const parseContactIntent = (value: unknown): LearningContactIntent | null =>
  isObject(value) &&
  typeof value.id === "string" &&
  typeof value.studentLabel === "string" &&
  value.status === "RECORDED_LOCAL" &&
  typeof value.createdAt === "string"
    ? {
        id: value.id,
        studentLabel: value.studentLabel,
        status: value.status,
        createdAt: value.createdAt,
      }
    : null;
const parseParentLearningSummary = (
  value: unknown,
): ParentLearningSummary | null => {
  if (
    !isObject(value) ||
    typeof value.studentId !== "string" ||
    typeof value.studentLabel !== "string" ||
    ![
      value.usedMinutes,
      value.sessionCount,
      value.completedSessions,
      value.attentionCount,
    ].every((count) => Number.isSafeInteger(count) && (count as number) >= 0) ||
    !Array.isArray(value.knowledgePoints)
  )
    return null;
  const knowledgePoints = value.knowledgePoints.flatMap((item) =>
    isObject(item) &&
    typeof item.label === "string" &&
    Number.isSafeInteger(item.sessionCount) &&
    (item.sessionCount as number) >= 0 &&
    Number.isSafeInteger(item.completedSessions) &&
    (item.completedSessions as number) >= 0
      ? [
          {
            label: item.label,
            sessionCount: item.sessionCount as number,
            completedSessions: item.completedSessions as number,
          },
        ]
      : [],
  );
  return {
    studentId: value.studentId,
    studentLabel: value.studentLabel,
    usedMinutes: value.usedMinutes as number,
    sessionCount: value.sessionCount as number,
    completedSessions: value.completedSessions as number,
    knowledgePoints,
    attentionCount: value.attentionCount as number,
  };
};

export class ParentLearningClient {
  #handle: string | null = null;
  #profile: LearningProfile = "parent-alpha";
  #snapshot = initialSnapshot();
  #generation = 0;
  #refreshSequence = 0;

  #captureOperation(): { generation: number; handle: string; profile: LearningProfile } | null {
    return this.#handle
      ? { generation: this.#generation, handle: this.#handle, profile: this.#profile }
      : null;
  }

  #isCurrentOperation(operation: {
    generation: number;
    handle: string;
    profile: LearningProfile;
  }): boolean {
    return (
      operation.generation === this.#generation &&
      operation.handle === this.#handle &&
      operation.profile === this.#profile
    );
  }

  get snapshot(): ParentLearningSnapshot {
    return this.#snapshot;
  }

  async connect(profile: LearningProfile = "parent-alpha"): Promise<void> {
    const generation = ++this.#generation;
    this.#profile = profile;
    this.#handle = null;
    this.#snapshot = {
      ...initialSnapshot(profile),
      status: "CONNECTING",
      message: "正在连接本机合成服务…",
    };
    try {
      const session = await this.#request<{ handle: string }>("/local/sessions", "POST", {
        profile,
      });
      if (generation !== this.#generation) return;
      if (typeof session.handle !== "string" || !/^[\w-]{43}$/u.test(session.handle))
        throw new Error("本机服务身份无效。请刷新后重试。");
      this.#handle = session.handle;
      const current = await this.#request<{ profile: string; actions: readonly string[] }>(
        "/local/session",
      );
      if (generation !== this.#generation) return;
      if (
        current.profile !== profile ||
        !current.actions.includes("learning:enable") ||
        (profile === "teacher-east" &&
          (!current.actions.includes("learning:summary") ||
            !current.actions.includes("learning:read")))
      )
        throw new Error("当前示例身份没有开启学习的权限。");
      this.#snapshot = { ...this.#snapshot, status: "READY", message: "已连接本机合成服务。" };
      await this.#refresh(generation);
    } catch (error) {
      if (generation !== this.#generation) return;
      this.#snapshot = {
        ...initialSnapshot(profile),
        status: "DENIED",
        message: error instanceof Error ? error.message : "连接失败，请刷新后重试。",
      };
    }
  }

  async refresh(): Promise<void> {
    await this.#refresh(this.#generation);
  }

  async updateParentControls(
    studentId: string,
    controls: Pick<ParentLearningControl, "enabled" | "maxDurationMinutes" | "maxHintLevel">,
  ): Promise<void> {
    const operation = this.#captureOperation();
    const currentControl = this.#snapshot.parentControls?.find(
      (item) => item.studentId === studentId,
    );
    if (
      !operation ||
      operation.profile !== "parent-alpha" ||
      !currentControl ||
      !this.#snapshot.approvedStudents.some((student) => student.studentId === studentId)
    )
      throw new Error("只能修改已审核通过的学生学习设置。");
    if (
      typeof controls.enabled !== "boolean" ||
      ![5, 10, 15].includes(controls.maxDurationMinutes) ||
      ![0, 1, 2, 3].includes(controls.maxHintLevel)
    )
      throw new Error("请选择有效的学习时长和提示范围。");
    try {
      const saved = parseParentControl(
        await this.#request<unknown>(
          `/local/learning-parent-controls/${encodeURIComponent(studentId)}`,
          "POST",
          controls,
          operation.handle,
        ),
      );
      if (!this.#isCurrentOperation(operation)) return;
      if (!saved || saved.studentId !== studentId)
        throw new Error("学习设置格式无效，请刷新后重试。");
      this.#snapshot = {
        ...this.#snapshot,
        status: "READY",
        message: "学习设置已保存。",
        parentControls: (this.#snapshot.parentControls ?? []).map((item) =>
          item.studentId === studentId ? saved : item,
        ),
      };
      await this.#refresh(operation.generation);
      if (this.#isCurrentOperation(operation) && this.#snapshot.status === "READY")
        this.#snapshot = { ...this.#snapshot, message: "学习设置已保存。" };
    } catch (error) {
      if (!this.#isCurrentOperation(operation)) return;
      this.#snapshot = {
        ...this.#snapshot,
        status: "READY",
        message: error instanceof Error ? error.message : "设置未保存，请刷新后重试。",
      };
    }
  }

  async contactTeacher(studentId: string): Promise<void> {
    const operation = this.#captureOperation();
    if (
      !operation ||
      operation.profile !== "parent-alpha" ||
      !this.#snapshot.parentControls?.some((item) => item.studentId === studentId)
    )
      throw new Error("只能为已审核通过的学生记录联系意向。");
    try {
      const result = await this.#request<unknown>(
        `/local/learning-parent-contact/${encodeURIComponent(studentId)}`,
        "POST",
        {},
        operation.handle,
      );
      if (!this.#isCurrentOperation(operation)) return;
      if (!isObject(result) || result.status !== "RECORDED_LOCAL")
        throw new Error("联系意向没有记录，请刷新后重试。");
      this.#snapshot = {
        ...this.#snapshot,
        status: "READY",
        message: "联系意向已在本机记录；尚未发送消息，请通过常用渠道联系教师。",
        parentControls: (this.#snapshot.parentControls ?? []).map((item) =>
          item.studentId === studentId ? { ...item, contactStatus: "RECORDED_LOCAL" } : item,
        ),
      };
    } catch (error) {
      if (!this.#isCurrentOperation(operation)) return;
      this.#snapshot = {
        ...this.#snapshot,
        status: "READY",
        message: error instanceof Error ? error.message : "联系意向未记录，请刷新后重试。",
      };
    }
  }

  async #refresh(generation: number): Promise<void> {
    const sequence = ++this.#refreshSequence;
    const handle = this.#handle;
    const profile = this.#profile;
    if (!handle || generation !== this.#generation) return;
    const isCurrent = () =>
      generation === this.#generation &&
      handle === this.#handle &&
      sequence === this.#refreshSequence;
    this.#snapshot = { ...this.#snapshot, status: "BUSY", message: "正在更新学习记录…" };
    try {
      const [bindings, sessions, summary, controlResponse, contactResponse] = await Promise.all([
        profile === "teacher-east"
          ? this.#request<unknown>("/local/student-options", "GET", undefined, handle)
          : this.#request<unknown>("/local/binding-applications", "GET", undefined, handle),
        this.#request<unknown>("/local/learning-sessions", "GET", undefined, handle),
        profile === "teacher-east"
          ? this.#request<unknown>("/local/learning-teacher-summary", "GET", undefined, handle)
          : Promise.resolve({ sessions: [] }),
        profile === "parent-alpha"
          ? this.#request<unknown>("/local/learning-parent-controls", "GET", undefined, handle)
          : Promise.resolve({ students: [] }),
        profile === "teacher-east"
          ? this.#request<unknown>(
              "/local/learning-parent-contact-intents",
              "GET",
              undefined,
              handle,
            )
          : Promise.resolve([]),
      ]);
      if (!isCurrent()) return;
      if (
        !Array.isArray(bindings) ||
        !Array.isArray(sessions) ||
        !isObject(summary) ||
        !isObject(controlResponse) ||
        !Array.isArray(controlResponse.students) ||
        !Array.isArray(contactResponse)
      )
        throw new Error("本机记录格式无效。");
      const approvedStudents =
        profile === "teacher-east"
          ? bindings.flatMap((item): ApprovedLearningStudent[] =>
              isObject(item) &&
              typeof item.id === "string" &&
              typeof item.label === "string" &&
              typeof item.classLabel === "string"
                ? [
                    {
                      studentId: item.id,
                      studentLabel: item.label,
                      classLabel: item.classLabel,
                    },
                  ]
                : [],
            )
          : bindings.flatMap((item): ApprovedLearningStudent[] => {
              if (
                !isObject(item) ||
                item.status !== "APPROVED" ||
                typeof item.studentId !== "string" ||
                typeof item.studentLabel !== "string" ||
                typeof item.classLabel !== "string"
              )
                return [];
              return [
                {
                  studentId: item.studentId,
                  studentLabel: item.studentLabel,
                  classLabel: item.classLabel,
                },
              ];
            });
      const resourceRows =
        profile === "teacher-east" || approvedStudents.length > 0
          ? await this.#request<unknown>("/local/learning-knowledge", "GET", undefined, handle)
          : [];
      if (!isCurrent()) return;
      if (!Array.isArray(resourceRows)) throw new Error("学习资料格式无效。");
      const knowledgeResources = resourceRows.flatMap((item): LearningKnowledgeResource[] =>
        isObject(item) &&
        typeof item.id === "string" &&
        Number.isSafeInteger(item.version) &&
        typeof item.title === "string" &&
        typeof item.summary === "string" &&
        typeof item.content === "string" &&
        typeof item.grade === "string" &&
        typeof item.subject === "string" &&
        typeof item.knowledgePoint === "string" &&
        typeof item.sourceLabel === "string" &&
        typeof item.expiresOn === "string"
          ? [
              {
                id: item.id,
                version: item.version as number,
                title: item.title,
                summary: item.summary,
                content: item.content,
                grade: item.grade,
                subject: item.subject,
                knowledgePoint: item.knowledgePoint,
                sourceLabel: item.sourceLabel,
                expiresOn: item.expiresOn,
              },
            ]
          : [],
      );
      const learningSessions = sessions.filter(
        (item): item is LearningSession =>
          isObject(item) && typeof item.id === "string" && typeof item.status === "string",
      );
      const activeSession = learningSessions.find((item) => item.status === "ACTIVE") ?? null;
      const parentControls = controlResponse.students.flatMap((item): ParentLearningControl[] => {
        const parsed = parseParentControl(item);
        return parsed ? [parsed] : [];
      });
      const parentContactIntents = contactResponse.flatMap((item): LearningContactIntent[] => {
        const parsed = parseContactIntent(item);
        return parsed ? [parsed] : [];
      });
      const approvedStudentIds = new Set(approvedStudents.map((student) => student.studentId));
      const parentSummary = (
        Array.isArray(controlResponse.parentSummary)
          ? controlResponse.parentSummary
          : []
      ).flatMap((item): ParentLearningSummary[] => {
        const parsed = parseParentLearningSummary(item);
        return parsed && approvedStudentIds.has(parsed.studentId)
          ? [parsed]
          : [];
      });
      const parentSummaryUpdatedAt =
        typeof controlResponse.parentSummaryUpdatedAt === "string" &&
        !Number.isNaN(Date.parse(controlResponse.parentSummaryUpdatedAt))
          ? controlResponse.parentSummaryUpdatedAt
          : null;
      this.#snapshot = {
        status: "READY",
        message: "学习记录已更新。",
        profile,
        approvedStudents,
        knowledgeResources,
        sessions: learningSessions,
        activeSession,
        teacherSummary: Array.isArray(summary.sessions)
          ? (summary.sessions as LearningTeacherSummary[])
          : [],
        parentControls,
        parentContactIntents,
        parentSummary,
        parentSummaryUpdatedAt,
      };
    } catch (error) {
      if (!isCurrent()) return;
      this.#snapshot = {
        ...initialSnapshot(profile),
        status: "DENIED",
        message: error instanceof Error ? error.message : "读取失败，请刷新后重试。",
      };
    }
  }

  async open(studentId: string, durationMinutes: 5 | 10 | 15): Promise<void> {
    const operation = this.#captureOperation();
    if (
      !operation ||
      !this.#snapshot.approvedStudents.some((student) => student.studentId === studentId)
    )
      throw new Error("只能为已审核通过的关系开启学习。");
    if (operation.profile === "parent-alpha") {
      const controls = this.#snapshot.parentControls?.find((item) => item.studentId === studentId);
      if (!controls?.enabled || durationMinutes > controls.maxDurationMinutes)
        throw new Error("当前学习已关闭，或本次时长超过家长设定。");
    }
    const session = await this.#request<LearningSession>(
      "/local/learning-sessions",
      "POST",
      {
        studentId,
        questionId: "math-grade-3-addition-01",
        consentVersion: "LEARNING_DEMO_V2",
        durationMinutes,
      },
      operation.handle,
    );
    if (!this.#isCurrentOperation(operation)) return;
    this.#snapshot = {
      ...this.#snapshot,
      status: "READY",
      message: "已开启限时学习，请由成人陪伴完成。",
      activeSession: session,
      sessions: [session, ...this.#snapshot.sessions],
    };
    await this.#refreshTeacherSummary(operation);
  }

  async answer(itemId: "main" | "practice-1" | "practice-2", choice: "A" | "B" | "C") {
    if (!isChoice(choice)) throw new Error("请选择一个答案。");
    const operation = this.#captureOperation();
    const session = this.#snapshot.activeSession;
    if (!operation || !session) throw new Error("当前没有进行中的学习。");
    if (itemId === "main" && session.mainAttemptLimitReached)
      throw new Error("已达到本次练习尝试上限，请教师协助，或结束练习。");
    const updated = await this.#request<LearningSession>(
      `/local/learning-sessions/${encodeURIComponent(session.id)}/answer`,
      "POST",
      { itemId, choice },
      operation.handle,
    );
    if (!this.#isCurrentOperation(operation)) return;
    this.#replaceSession(
      updated,
      updated.mainAttemptLimitReached
        ? "已达到本次练习尝试上限，请教师协助，或结束练习。"
        : itemId === "main"
          ? updated.mainCorrect
            ? "这道题答对了，可以继续完成两道巩固题。"
            : "答案已提交，可以按顺序查看提示。"
          : "巩固答案已提交。 ",
    );
    await this.#refreshTeacherSummary(operation);
  }

  async hint(level: 0 | 1 | 2 | 3): Promise<void> {
    const operation = this.#captureOperation();
    const session = this.#snapshot.activeSession;
    if (!operation || !session) throw new Error("当前没有进行中的学习。");
    if (session.mainAttemptLimitReached)
      throw new Error("已达到本次练习尝试上限，请教师协助，或结束练习。");
    if (operation.profile === "parent-alpha") {
      const controls = this.#snapshot.parentControls?.find(
        (item) => item.studentId === session.studentId,
      );
      if (!controls || level > controls.maxHintLevel)
        throw new Error("提示层级超过家长设置的范围。");
    }
    const updated = await this.#request<LearningSession>(
      `/local/learning-sessions/${encodeURIComponent(session.id)}/hint`,
      "POST",
      { level },
      operation.handle,
    );
    if (!this.#isCurrentOperation(operation)) return;
    this.#replaceSession(updated, `第 ${level} 层提示已打开。`);
    await this.#refreshTeacherSummary(operation);
  }

  async close(): Promise<void> {
    await this.#sessionAction("close", "本次学习已结束。");
  }

  async handoff(id: string): Promise<void> {
    const operation = this.#captureOperation();
    if (!operation || operation.profile !== "teacher-east")
      throw new Error("只有负责教师可以接手本班练习。");
    const updated = await this.#request<LearningSession>(
      `/local/learning-sessions/${encodeURIComponent(id)}/close`,
      "POST",
      { handoff: true },
      operation.handle,
    );
    if (!this.#isCurrentOperation(operation)) return;
    this.#replaceSession(updated, "教师已接手，本次练习已停止继续作答。");
    await this.#refreshTeacherSummary(operation);
  }

  async delete(id: string): Promise<void> {
    const operation = this.#captureOperation();
    if (!operation || !this.#snapshot.sessions.some((session) => session.id === id))
      throw new Error("找不到这条本机学习记录。");
    await this.#request(
      `/local/learning-sessions/${encodeURIComponent(id)}/delete`,
      "POST",
      {},
      operation.handle,
    );
    if (!this.#isCurrentOperation(operation)) return;
    this.#snapshot = {
      ...this.#snapshot,
      status: "READY",
      message: "本机学习记录已删除。",
      sessions: this.#snapshot.sessions.filter((session) => session.id !== id),
      activeSession: this.#snapshot.activeSession?.id === id ? null : this.#snapshot.activeSession,
    };
  }

  disconnect(): void {
    this.#generation += 1;
    this.#handle = null;
    this.#profile = "parent-alpha";
    this.#snapshot = initialSnapshot();
  }

  async #sessionAction(action: "close", message: string): Promise<void> {
    const operation = this.#captureOperation();
    const session = this.#snapshot.activeSession;
    if (!operation || !session) throw new Error("当前没有可结束的学习。");
    const updated = await this.#request<LearningSession>(
      `/local/learning-sessions/${encodeURIComponent(session.id)}/${action}`,
      "POST",
      {},
      operation.handle,
    );
    if (!this.#isCurrentOperation(operation)) return;
    this.#replaceSession(updated, message);
    await this.#refreshTeacherSummary(operation);
  }

  async #refreshTeacherSummary(operation: {
    generation: number;
    handle: string;
    profile: LearningProfile;
  }): Promise<void> {
    if (operation.profile !== "teacher-east" || !this.#isCurrentOperation(operation)) return;
    const summary = await this.#request<unknown>(
      "/local/learning-teacher-summary",
      "GET",
      undefined,
      operation.handle,
    );
    if (!this.#isCurrentOperation(operation)) return;
    if (!isObject(summary) || !Array.isArray(summary.sessions))
      throw new Error("本班学习摘要格式无效。");
    this.#snapshot = {
      ...this.#snapshot,
      teacherSummary: summary.sessions as LearningTeacherSummary[],
    };
  }

  #replaceSession(session: LearningSession, message: string): void {
    const sessions = [session, ...this.#snapshot.sessions.filter((item) => item.id !== session.id)];
    this.#snapshot = {
      ...this.#snapshot,
      status: "READY",
      message,
      sessions,
      activeSession: session.status === "ACTIVE" ? session : null,
    };
  }

  async #request<T>(
    path: string,
    method: "GET" | "POST" = "GET",
    body?: unknown,
    handle = this.#handle,
  ): Promise<T> {
    const response = await fetch(path, {
      method,
      headers: {
        ...(handle ? { authorization: `Bearer ${handle}` } : {}),
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) throw new Error(`本机学习操作未完成（${response.status}）。`);
    return (await response.json()) as T;
  }
}
