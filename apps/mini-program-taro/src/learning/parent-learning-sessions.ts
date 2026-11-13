import type {
  ConsentPurposeDefinition,
  ConsentRecord,
} from "../../../../packages/contracts/src/consent";
import type {
  LearningSessionView,
  ParentLearningSessionAnswerInput,
  ParentLearningSessionCloseInput,
  ParentLearningSessionHintInput,
  ParentLearningSessionStartInput,
} from "../../../../packages/contracts/src/learning-session";
import type {
  ParentBindingApplication,
  ParentGuardianRelationship,
} from "../binding/parent-binding";
import type {
  ParentLearningControl,
  ParentLearningProjection,
  ParentLearningStudent,
} from "./parent-learning-summary";

export type { LearningSessionView };

export type LearningSupportPolicy = Omit<
  ConsentPurposeDefinition,
  "key" | "consentVersion" | "policyVersion"
> & {
  readonly key: "LEARNING_SUPPORT";
  readonly consentVersion: "LEARNING_DEMO_V2";
  readonly policyVersion: "AI_LEARNING_POLICY_SYNTHETIC_V1";
};

export type ParentLearningConsent = Pick<
  ConsentRecord,
  | "id"
  | "version"
  | "bindingId"
  | "purposeKey"
  | "noticeVersion"
  | "consentVersion"
  | "policyVersion"
  | "status"
> & {
  readonly purposeKey: "LEARNING_SUPPORT";
  readonly consentVersion: "LEARNING_DEMO_V2";
  readonly policyVersion: "AI_LEARNING_POLICY_SYNTHETIC_V1";
};

export type ParentLearningBinding = {
  readonly id: string;
  readonly studentId: string;
  readonly status: "APPROVED";
};

export type ParentFixedLearningContext = {
  readonly student: ParentLearningStudent;
  readonly binding: ParentLearningBinding;
  readonly relationship: ParentGuardianRelationship;
  readonly control: ParentLearningControl;
  readonly policy: LearningSupportPolicy;
  readonly consent: ParentLearningConsent | null;
  readonly sessions: readonly LearningSessionView[];
};

export type AuthenticatedPost = (path: string, body: unknown) => Promise<unknown>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/u;
const SESSION_STATUSES = ["ACTIVE", "COMPLETED", "CLOSED", "EXPIRED", "HANDED_OFF"] as const;
const SESSION_DURATION = [5, 10, 15] as const;
const CHOICE_IDS = ["A", "B", "C"] as const;

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function onlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).length === keys.length && onlyKeys(value, keys);
}

function text(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && !!value.trim() && value.length <= maxLength;
}

function timestamp(value: unknown): value is string {
  return (
    typeof value === "string" && ISO_TIMESTAMP.test(value) && Number.isFinite(Date.parse(value))
  );
}

function positiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

function nonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function parsePolicy(value: unknown): LearningSupportPolicy | null {
  const keys = [
    "key",
    "title",
    "noticeVersion",
    "consentVersion",
    "policyVersion",
    "necessity",
    "dataClasses",
    "retentionDays",
    "retentionNotice",
    "impactReviewStatus",
  ];
  if (
    !record(value) ||
    !exactKeys(value, keys) ||
    value.key !== "LEARNING_SUPPORT" ||
    value.consentVersion !== "LEARNING_DEMO_V2" ||
    value.policyVersion !== "AI_LEARNING_POLICY_SYNTHETIC_V1" ||
    value.noticeVersion !== "LEARNING_SUPPORT_NOTICE_V1" ||
    value.impactReviewStatus !== "DEMO_ONLY_PENDING_HUMAN_REVIEW" ||
    !text(value.title, 80) ||
    !text(value.necessity, 500) ||
    !text(value.retentionNotice, 500) ||
    !positiveInteger(value.retentionDays) ||
    !Array.isArray(value.dataClasses) ||
    value.dataClasses.length < 1 ||
    value.dataClasses.length > 10 ||
    value.dataClasses.some((entry) => !text(entry, 80))
  )
    return null;
  return value as unknown as LearningSupportPolicy;
}

function parseConsent(value: unknown, bindingId: string): ParentLearningConsent | null {
  if (
    !record(value) ||
    value.bindingId !== bindingId ||
    value.purposeKey !== "LEARNING_SUPPORT" ||
    typeof value.id !== "string" ||
    !UUID.test(value.id) ||
    !positiveInteger(value.version) ||
    value.noticeVersion !== "LEARNING_SUPPORT_NOTICE_V1" ||
    value.consentVersion !== "LEARNING_DEMO_V2" ||
    value.policyVersion !== "AI_LEARNING_POLICY_SYNTHETIC_V1" ||
    (value.status !== "ACTIVE" && value.status !== "REVOKED")
  )
    return null;
  return {
    id: value.id,
    version: value.version,
    bindingId,
    purposeKey: "LEARNING_SUPPORT",
    noticeVersion: value.noticeVersion,
    consentVersion: "LEARNING_DEMO_V2",
    policyVersion: "AI_LEARNING_POLICY_SYNTHETIC_V1",
    status: value.status,
  };
}

export function resolveParentFixedLearningContext(input: {
  readonly studentId: string;
  readonly projection: ParentLearningProjection;
  readonly applications: readonly ParentBindingApplication[];
  readonly relationships: readonly ParentGuardianRelationship[];
  readonly policies: unknown;
  readonly consents: unknown;
}): ParentFixedLearningContext {
  const { studentId, projection } = input;
  if (!UUID.test(studentId)) throw new Error("学生资料无效，请从家长首页重新进入。");

  const students = projection.approvedStudents.filter((item) => item.studentId === studentId);
  if (students.length !== 1) throw new Error("当前家长账号没有该孩子的已审核关联。");
  const student = students[0]!;
  const controls = (projection.parentControls ?? []).filter((item) => item.studentId === studentId);
  if (controls.length !== 1) throw new Error("家长学习设置暂不可用，请先刷新家长首页。");
  const control = controls[0]!;

  const activeRelationships = input.relationships.filter(
    (item) => item.studentId === studentId && item.status === "ACTIVE",
  );
  if (activeRelationships.length !== 1)
    throw new Error("当前监护关系暂不可用，请刷新后联系机构确认。");
  const relationship = activeRelationships[0]!;
  const applications = input.applications.filter(
    (item) =>
      item.id === relationship.sourceApplicationId &&
      item.studentId === studentId &&
      item.status === "APPROVED",
  );
  if (applications.length !== 1) throw new Error("当前已审核关系暂不可用，请刷新后联系机构确认。");
  const binding: ParentLearningBinding = {
    id: applications[0]!.id,
    studentId,
    status: "APPROVED",
  };

  if (!Array.isArray(input.policies) || input.policies.length > 20)
    throw new Error("学习支持说明暂不可用，请稍后重新读取。");
  const learningPolicies = input.policies.filter(
    (item) => record(item) && item.key === "LEARNING_SUPPORT",
  );
  const policy = learningPolicies.length === 1 ? parsePolicy(learningPolicies[0]) : null;
  if (!policy) throw new Error("学习支持说明版本暂不可用，请稍后重新读取。");

  if (!Array.isArray(input.consents) || input.consents.length > 100)
    throw new Error("学习授权记录暂不可用，请稍后重新读取。");
  const relevant = input.consents.filter(
    (item) =>
      record(item) && item.bindingId === binding.id && item.purposeKey === "LEARNING_SUPPORT",
  );
  const parsedConsents = relevant.map((item) => parseConsent(item, binding.id));
  if (parsedConsents.some((item) => item === null))
    throw new Error("学习授权记录格式暂不可用，请刷新后重试。");
  const activeConsents = (parsedConsents as ParentLearningConsent[]).filter(
    (item) => item.status === "ACTIVE",
  );
  if (activeConsents.length > 1) throw new Error("学习授权记录需要机构核对，请暂缓练习。");

  return {
    student,
    binding,
    relationship,
    control,
    policy,
    consent: activeConsents[0] ?? null,
    sessions: [],
  };
}

function parseChoice(
  value: unknown,
): { readonly id: "A" | "B" | "C"; readonly label: string } | null {
  if (
    !record(value) ||
    !exactKeys(value, ["id", "label"]) ||
    !CHOICE_IDS.includes(value.id as (typeof CHOICE_IDS)[number]) ||
    !text(value.label, 100)
  )
    return null;
  return { id: value.id as "A" | "B" | "C", label: value.label };
}

function parseChoices(
  value: unknown,
): readonly { readonly id: "A" | "B" | "C"; readonly label: string }[] | null {
  if (!Array.isArray(value) || value.length !== 3) return null;
  const choices = value.map(parseChoice);
  if (choices.some((choice) => choice === null)) return null;
  const parsed = choices as { readonly id: "A" | "B" | "C"; readonly label: string }[];
  return parsed
    .map((choice, index) => (choice.id === CHOICE_IDS[index] ? choice : null))
    .every(Boolean)
    ? parsed
    : null;
}

function parseQuestion(value: unknown): LearningSessionView["question"] | null {
  if (
    !record(value) ||
    !exactKeys(value, ["id", "grade", "subject", "prompt", "knowledgePoint", "choices"]) ||
    value.id !== "math-grade-3-addition-01" ||
    value.grade !== "三年级" ||
    value.subject !== "数学" ||
    !text(value.prompt, 300) ||
    !text(value.knowledgePoint, 80)
  )
    return null;
  const choices = parseChoices(value.choices);
  return choices ? ({ ...value, choices } as LearningSessionView["question"]) : null;
}

function parsePractice(value: unknown): LearningSessionView["consolidation"][number] | null {
  if (
    !record(value) ||
    !exactKeys(value, ["id", "prompt", "choices", "answered", "correct"]) ||
    (value.id !== "practice-1" && value.id !== "practice-2") ||
    !text(value.prompt, 300) ||
    typeof value.answered !== "boolean" ||
    (value.correct !== null && typeof value.correct !== "boolean") ||
    (!value.answered && value.correct !== null)
  )
    return null;
  const choices = parseChoices(value.choices);
  return choices ? ({ ...value, choices } as LearningSessionView["consolidation"][number]) : null;
}

function parseSession(value: unknown, studentId: string): LearningSessionView | null {
  const required = [
    "id",
    "version",
    "status",
    "consentVersion",
    "consentedAt",
    "guidanceMode",
    "studentId",
    "studentLabel",
    "question",
    "durationMinutes",
    "startedAt",
    "endsAt",
    "mainAttempts",
    "lastHintAtAttempt",
    "mainCorrect",
    "highestHintLevel",
    "visibleHint",
    "consolidation",
    "needsTeacherFollowUp",
  ];
  const allowed = [...required, "mainAttemptLimit", "mainAttemptLimitReached"];
  if (
    !record(value) ||
    !required.every((key) => Object.prototype.hasOwnProperty.call(value, key)) ||
    !onlyKeys(value, allowed) ||
    typeof value.id !== "string" ||
    !UUID.test(value.id) ||
    !positiveInteger(value.version) ||
    !SESSION_STATUSES.includes(value.status as (typeof SESSION_STATUSES)[number]) ||
    value.consentVersion !== "LEARNING_DEMO_V2" ||
    !timestamp(value.consentedAt) ||
    value.guidanceMode !== "FIXED_LOCAL" ||
    value.studentId !== studentId ||
    !text(value.studentLabel, 80) ||
    !SESSION_DURATION.includes(value.durationMinutes as (typeof SESSION_DURATION)[number]) ||
    !timestamp(value.startedAt) ||
    !timestamp(value.endsAt) ||
    !nonNegativeInteger(value.mainAttempts) ||
    !nonNegativeInteger(value.lastHintAtAttempt) ||
    typeof value.mainCorrect !== "boolean" ||
    !Number.isInteger(value.highestHintLevel) ||
    (value.highestHintLevel as number) < -1 ||
    (value.highestHintLevel as number) > 3 ||
    typeof value.needsTeacherFollowUp !== "boolean" ||
    (value.mainAttemptLimit !== undefined && !positiveInteger(value.mainAttemptLimit)) ||
    (value.mainAttemptLimitReached !== undefined &&
      typeof value.mainAttemptLimitReached !== "boolean") ||
    !Array.isArray(value.consolidation) ||
    value.consolidation.length > 2
  )
    return null;
  const question = parseQuestion(value.question);
  if (!question) return null;
  const consolidation = value.consolidation.map(parsePractice);
  if (
    consolidation.some((item) => item === null) ||
    new Set((consolidation as LearningSessionView["consolidation"]).map((item) => item.id)).size !==
      consolidation.length
  )
    return null;
  let visibleHint: LearningSessionView["visibleHint"] = null;
  if (value.visibleHint !== null) {
    if (
      !record(value.visibleHint) ||
      !exactKeys(value.visibleHint, ["level", "text"]) ||
      !Number.isInteger(value.visibleHint.level) ||
      (value.visibleHint.level as number) < 0 ||
      (value.visibleHint.level as number) > 3 ||
      !text(value.visibleHint.text, 300)
    )
      return null;
    visibleHint = {
      level: value.visibleHint.level as 0 | 1 | 2 | 3,
      text: value.visibleHint.text,
    };
  }
  return {
    ...value,
    question,
    visibleHint,
    consolidation: consolidation as LearningSessionView["consolidation"],
  } as LearningSessionView;
}

export function parseParentLearningSessions(
  value: unknown,
  studentId: string,
): LearningSessionView[] {
  if (!UUID.test(studentId) || !Array.isArray(value) || value.length > 20)
    throw new Error("练习记录暂不可用，请刷新后重试。");
  const sessions = value.map((item) => parseSession(item, studentId));
  if (sessions.some((item) => item === null))
    throw new Error("练习记录格式暂不可用，请刷新后重试。");
  return sessions as LearningSessionView[];
}

export function hasCurrentLearningSupportConsent(
  context: Pick<ParentFixedLearningContext, "policy" | "consent">,
): context is Pick<ParentFixedLearningContext, "policy"> & {
  readonly consent: ParentLearningConsent;
} {
  return (
    context.consent !== null &&
    context.consent.status === "ACTIVE" &&
    context.consent.noticeVersion === context.policy.noticeVersion &&
    context.consent.consentVersion === context.policy.consentVersion &&
    context.consent.policyVersion === context.policy.policyVersion
  );
}

function parseConsentResponse(value: unknown, bindingId: string): ParentLearningConsent {
  const result = parseConsent(value, bindingId);
  if (!result) throw new Error("学习授权结果暂不可用，请刷新后核对。");
  return result;
}

export async function grantLearningSupportConsent(
  post: AuthenticatedPost,
  bindingId: string,
  policyValue: unknown,
  confirmed: boolean,
): Promise<ParentLearningConsent> {
  if (!confirmed) throw new Error("请先阅读并确认学习支持说明。");
  if (!UUID.test(bindingId)) throw new Error("当前监护关系无效，请刷新后重试。");
  const policy = parsePolicy(policyValue);
  if (!policy) throw new Error("学习支持说明版本暂不可用，请重新读取。");
  const result = await post("/consents", {
    bindingId,
    purposeKey: "LEARNING_SUPPORT",
    noticeVersion: policy.noticeVersion,
    confirmed: true,
  });
  const consent = parseConsentResponse(result, bindingId);
  if (consent.status !== "ACTIVE") throw new Error("学习授权未能生效，请刷新后核对。");
  return consent;
}

export async function revokeLearningSupportConsent(
  post: AuthenticatedPost,
  consent: ParentLearningConsent,
): Promise<ParentLearningConsent> {
  if (consent.status !== "ACTIVE" || !UUID.test(consent.id) || !positiveInteger(consent.version))
    throw new Error("当前学习授权已变化，请刷新后核对。");
  const result = await post(`/consents/${encodeURIComponent(consent.id)}/revoke`, {
    version: consent.version,
  });
  const revoked = parseConsentResponse(result, consent.bindingId);
  if (revoked.id !== consent.id || revoked.status !== "REVOKED")
    throw new Error("学习授权撤回结果暂不可用，请刷新后核对。");
  return revoked;
}

function currentSession(value: LearningSessionView): boolean {
  return value.status === "ACTIVE" && UUID.test(value.id) && positiveInteger(value.version);
}

export async function startFixedLearningSession(
  post: AuthenticatedPost,
  context: ParentFixedLearningContext,
  durationMinutes: number,
): Promise<LearningSessionView> {
  if (!context.control.enabled) throw new Error("家长已关闭学习辅助，请先在家长首页开启。");
  if (!hasCurrentLearningSupportConsent(context)) throw new Error("请先完成学习支持知情同意。");
  if (
    !SESSION_DURATION.includes(durationMinutes as (typeof SESSION_DURATION)[number]) ||
    durationMinutes > context.control.maxDurationMinutes
  )
    throw new Error("练习时长超出家长允许范围，请重新选择。");
  const active = context.sessions.find(currentSession);
  if (active) return active;
  const input: ParentLearningSessionStartInput = {
    questionId: "math-grade-3-addition-01",
    consentVersion: context.policy.consentVersion,
    durationMinutes: durationMinutes as 5 | 10 | 15,
  };
  const result = parseSession(
    await post(
      `/parent/students/${encodeURIComponent(context.student.studentId)}/learning-sessions`,
      input,
    ),
    context.student.studentId,
  );
  if (!result || result.status !== "ACTIVE") throw new Error("练习暂未开始，请刷新记录后重试。");
  return result;
}

function assertActiveSession(session: LearningSessionView): void {
  if (!currentSession(session)) throw new Error("当前练习已结束，请刷新后查看。");
}

function parseSessionResponse(value: unknown, current: LearningSessionView): LearningSessionView {
  const result = parseSession(value, current.studentId);
  if (!result || result.id !== current.id || result.version <= current.version)
    throw new Error("练习状态暂未同步，请刷新后重新读取。");
  return result;
}

export async function answerFixedLearningItem(
  post: AuthenticatedPost,
  session: LearningSessionView,
  itemId: ParentLearningSessionAnswerInput["itemId"],
  choice: ParentLearningSessionAnswerInput["choice"],
): Promise<LearningSessionView> {
  assertActiveSession(session);
  if (!CHOICE_IDS.includes(choice)) throw new Error("请选择题目中的一个选项。");
  if (itemId === "main") {
    const limit = session.mainAttemptLimit ?? 3;
    if (session.mainCorrect || session.mainAttempts >= limit)
      throw new Error("这道题已完成当前可尝试次数。");
  } else {
    const item = session.consolidation.find((entry) => entry.id === itemId);
    if (!session.mainCorrect || !item || item.answered) throw new Error("当前巩固题暂不可作答。");
  }
  const input: ParentLearningSessionAnswerInput = {
    itemId,
    choice,
    expectedVersion: session.version,
  };
  const result = await post(
    `/parent/learning-sessions/${encodeURIComponent(session.id)}/answer`,
    input,
  );
  return parseSessionResponse(result, session);
}

export function nextLearningHintLevel(
  session: LearningSessionView,
  maxHintLevel: number,
): 0 | 1 | 2 | 3 | null {
  const next = session.highestHintLevel + 1;
  const attemptLimit = session.mainAttemptLimit ?? 3;
  if (
    !currentSession(session) ||
    session.mainCorrect ||
    session.mainAttempts <= session.lastHintAtAttempt ||
    session.mainAttempts >= attemptLimit ||
    next > maxHintLevel ||
    next > 3
  )
    return null;
  return next as 0 | 1 | 2 | 3;
}

export async function requestNextLearningHint(
  post: AuthenticatedPost,
  session: LearningSessionView,
  maxHintLevel: number,
): Promise<LearningSessionView> {
  const level = nextLearningHintLevel(session, maxHintLevel);
  if (level === null) throw new Error("暂时没有可用提示，或已达到家长允许的提示范围。");
  const input: ParentLearningSessionHintInput = { level, expectedVersion: session.version };
  const result = await post(
    `/parent/learning-sessions/${encodeURIComponent(session.id)}/hint`,
    input,
  );
  return parseSessionResponse(result, session);
}

export async function closeFixedLearningSession(
  post: AuthenticatedPost,
  session: LearningSessionView,
): Promise<LearningSessionView> {
  assertActiveSession(session);
  const input: ParentLearningSessionCloseInput = { expectedVersion: session.version };
  const result = await post(
    `/parent/learning-sessions/${encodeURIComponent(session.id)}/close`,
    input,
  );
  return parseSessionResponse(result, session);
}
