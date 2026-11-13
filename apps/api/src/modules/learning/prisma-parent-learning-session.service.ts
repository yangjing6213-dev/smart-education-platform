import { Prisma, type PrismaClient } from "../../generated/prisma/client.js";
import type {
  LearningChoice,
  LearningPracticeView,
  LearningSessionStatus,
  LearningSessionView,
} from "@student-care/contracts";
import type { ParentLearningContext } from "../../nest/api-tokens.js";

const QUESTION_ID = "math-grade-3-addition-01";
const CONSENT_VERSION = "LEARNING_DEMO_V2" as const;
const POLICY_VERSION = "AI_LEARNING_POLICY_SYNTHETIC_V1" as const;
const MAIN_ATTEMPT_LIMIT = 5;
const choices: readonly LearningChoice[] = [
  { id: "A", label: "393" },
  { id: "B", label: "403" },
  { id: "C", label: "413" },
];
const question = {
  id: QUESTION_ID,
  grade: "三年级" as const,
  subject: "数学" as const,
  prompt: "238 + 165 = ？",
  knowledgePoint: "两位数加法与进位",
  choices,
};
const hints = [
  "先把加数拆开，分别观察相加时会不会进位。",
  "先算 238 + 100 = 338，再把剩下的 65 加上。",
  "338 + 60 = 398，最后再加 5。",
  "前两步已经得到 398。现在请把最后的 5 个一加上去，自行写出结果，再检查个位是否正确。",
] as const;
const practiceItems = [
  {
    id: "practice-1" as const,
    prompt: "326 + 47 = ？",
    choices: [
      { id: "A" as const, label: "373" },
      { id: "B" as const, label: "363" },
      { id: "C" as const, label: "383" },
    ],
    answer: "A" as const,
  },
  {
    id: "practice-2" as const,
    prompt: "500 - 168 = ？",
    choices: [
      { id: "A" as const, label: "342" },
      { id: "B" as const, label: "332" },
      { id: "C" as const, label: "322" },
    ],
    answer: "B" as const,
  },
];

type Database = Prisma.TransactionClient;
type SessionRow = {
  id: string;
  tenantId: string;
  campusId: string;
  guardianRelationshipId: string;
  studentId: string;
  guardianUserId: string;
  consentId: string;
  consentVersion: "LEARNING_DEMO_V2";
  policyVersion: "AI_LEARNING_POLICY_SYNTHETIC_V1";
  status: string;
  version: number;
  durationMinutes: number;
  startedAt: Date;
  endsAt: Date;
  endedAt: Date | null;
  mainAttempts: number;
  lastHintAtAttempt: number;
  mainWrongAttempts: number;
  answeredAfterHint: boolean;
  mainCorrect: boolean;
  highestHintLevel: number;
  visibleHintLevel: number | null;
  practiceOneAnswered: boolean;
  practiceOneCorrect: boolean | null;
  practiceTwoAnswered: boolean;
  practiceTwoCorrect: boolean | null;
  needsTeacherFollowUp: boolean;
};
type ParentScope = {
  relationship: { id: string; student: { id: string; displayRef: string } };
  consent: { id: string; consentVersion: string; policyVersion: string; confirmedAt: Date };
  control: { enabled: boolean; maxDurationMinutes: number; maxHintLevel: number };
};

class LearningSessionFailure extends Error {
  public readonly statusCode: 400 | 403 | 404 | 409;

  public constructor(
    public readonly code:
      "VALIDATION_FAILED" | "FORBIDDEN_SCOPE" | "NOT_FOUND_SCOPED" | "CONFLICT_STATE",
  ) {
    super(code);
    this.statusCode =
      code === "VALIDATION_FAILED"
        ? 400
        : code === "FORBIDDEN_SCOPE"
          ? 403
          : code === "NOT_FOUND_SCOPED"
            ? 404
            : 409;
  }
}

const invalid = () => new LearningSessionFailure("VALIDATION_FAILED");
const forbidden = () => new LearningSessionFailure("FORBIDDEN_SCOPE");
const notFound = () => new LearningSessionFailure("NOT_FOUND_SCOPED");
const conflict = () => new LearningSessionFailure("CONFLICT_STATE");

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactBody(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return (
    isRecord(value) &&
    Object.keys(value).length === keys.length &&
    Object.keys(value).every((key) => keys.includes(key))
  );
}

function isChoice(value: unknown): value is LearningChoice["id"] {
  return value === "A" || value === "B" || value === "C";
}

function expectedVersion(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0 && Number(value) < 2_147_483_647;
}

function mapStatus(value: string): LearningSessionStatus {
  if (value === "ACTIVE" || value === "COMPLETED" || value === "CLOSED" || value === "EXPIRED")
    return value;
  throw conflict();
}

function effectiveEnd(session: SessionRow, maxDurationMinutes: number): Date {
  const controlEnd = new Date(session.startedAt.getTime() + maxDurationMinutes * 60_000);
  return controlEnd < session.endsAt ? controlEnd : session.endsAt;
}

export class PrismaParentLearningSessionService {
  public constructor(
    private readonly prisma: PrismaClient,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async listSessions(context: ParentLearningContext, studentId: string) {
    this.#requireCapability(context);
    if (!this.#uuid(studentId)) throw invalid();
    return this.#transaction(async (database) => {
      const scope = await this.#parentScope(database, context, studentId);
      const sessions = await database.parentLearningSession.findMany({
        where: {
          tenantId: context.tenantId,
          campusId: context.campusId,
          guardianUserId: context.actorId,
          guardianRelationshipId: scope.relationship.id,
          studentId,
        },
        orderBy: { startedAt: "desc" },
        take: 20,
      });
      const refreshed: LearningSessionView[] = [];
      for (const session of sessions) {
        const current = await this.#refreshExpiry(database, context, session, scope.control);
        refreshed.push(
          this.#view(
            current,
            scope.relationship.student.displayRef,
            scope.consent.confirmedAt,
            scope.control,
          ),
        );
      }
      return refreshed;
    });
  }

  public async createSession(context: ParentLearningContext, studentId: string, value: unknown) {
    this.#requireCapability(context);
    if (!this.#uuid(studentId)) throw invalid();
    if (
      !exactBody(value, ["questionId", "consentVersion", "durationMinutes"]) ||
      value.questionId !== QUESTION_ID ||
      value.consentVersion !== CONSENT_VERSION ||
      ![5, 10, 15].includes(Number(value.durationMinutes)) ||
      !Number.isInteger(value.durationMinutes)
    )
      throw invalid();

    return this.#transaction(async (database) => {
      const scope = await this.#parentScope(database, context, studentId);
      const durationMinutes = Number(value.durationMinutes);
      if (!scope.control.enabled || durationMinutes > scope.control.maxDurationMinutes)
        throw forbidden();
      const startedAt = this.now();
      const row = await database.parentLearningSession.create({
        data: {
          tenantId: context.tenantId,
          campusId: context.campusId,
          guardianRelationshipId: scope.relationship.id,
          studentId,
          guardianUserId: context.actorId,
          consentId: scope.consent.id,
          consentVersion: CONSENT_VERSION,
          policyVersion: POLICY_VERSION,
          status: "ACTIVE",
          version: 1,
          durationMinutes,
          startedAt,
          endsAt: new Date(startedAt.getTime() + durationMinutes * 60_000),
        },
      });
      return this.#view(
        row,
        scope.relationship.student.displayRef,
        scope.consent.confirmedAt,
        scope.control,
      );
    });
  }

  public async getSession(context: ParentLearningContext, sessionId: string) {
    this.#requireCapability(context);
    if (!this.#uuid(sessionId)) throw invalid();
    return this.#transaction(async (database) => {
      const { row, scope } = await this.#scopedSession(database, context, sessionId);
      const current = await this.#refreshExpiry(database, context, row, scope.control);
      return this.#view(
        current,
        scope.relationship.student.displayRef,
        scope.consent.confirmedAt,
        scope.control,
      );
    });
  }

  public async answerSession(context: ParentLearningContext, sessionId: string, value: unknown) {
    this.#requireCapability(context);
    if (!this.#uuid(sessionId)) throw invalid();
    if (
      !exactBody(value, ["itemId", "choice", "expectedVersion"]) ||
      !isChoice(value.choice) ||
      !expectedVersion(value.expectedVersion) ||
      typeof value.itemId !== "string"
    )
      throw invalid();
    if (!["main", "practice-1", "practice-2"].includes(value.itemId)) throw invalid();
    return this.#transaction(async (database) => {
      const { row, scope } = await this.#scopedSession(database, context, sessionId);
      const current = await this.#refreshExpiry(database, context, row, scope.control);
      if (current.version !== value.expectedVersion || current.status !== "ACTIVE")
        throw conflict();
      const data: Record<string, unknown> = { version: { increment: 1 } };
      if (value.itemId === "main") {
        if (current.mainCorrect || current.mainAttempts >= MAIN_ATTEMPT_LIMIT) throw conflict();
        data.mainAttempts = current.mainAttempts + 1;
        if (current.highestHintLevel >= 0) data.answeredAfterHint = true;
        if (value.choice === "B") {
          data.mainCorrect = true;
        } else {
          const wrong = current.mainWrongAttempts + 1;
          data.mainWrongAttempts = wrong;
          if (wrong >= 4) data.needsTeacherFollowUp = true;
        }
      } else {
        if (!current.mainCorrect) throw conflict();
        const first = value.itemId === "practice-1";
        const answeredKey = first ? "practiceOneAnswered" : "practiceTwoAnswered";
        const correctKey = first ? "practiceOneCorrect" : "practiceTwoCorrect";
        if (current[answeredKey]) throw conflict();
        const correct =
          practiceItems.find((item) => item.id === value.itemId)!.answer === value.choice;
        data[answeredKey] = true;
        data[correctKey] = correct;
        if (!correct) data.needsTeacherFollowUp = true;
        const otherAnswered = first ? current.practiceTwoAnswered : current.practiceOneAnswered;
        if (otherAnswered) {
          data.status = "COMPLETED";
          data.endedAt = this.now();
        }
      }
      const updated = await database.parentLearningSession.updateMany({
        where: this.#mutationWhere(context, current),
        data,
      });
      if (updated.count !== 1) throw conflict();
      return this.#updatedView(database, context, sessionId, scope);
    });
  }

  public async hintSession(context: ParentLearningContext, sessionId: string, value: unknown) {
    this.#requireCapability(context);
    if (!this.#uuid(sessionId)) throw invalid();
    if (
      !exactBody(value, ["level", "expectedVersion"]) ||
      !Number.isSafeInteger(value.level) ||
      !expectedVersion(value.expectedVersion)
    )
      throw invalid();
    const level = Number(value.level);
    if (level < 0 || level > 3) throw invalid();
    return this.#transaction(async (database) => {
      const { row, scope } = await this.#scopedSession(database, context, sessionId);
      const current = await this.#refreshExpiry(database, context, row, scope.control);
      if (current.version !== value.expectedVersion || current.status !== "ACTIVE")
        throw conflict();
      if (
        level > scope.control.maxHintLevel ||
        current.mainCorrect ||
        current.mainAttempts >= MAIN_ATTEMPT_LIMIT ||
        level !== current.highestHintLevel + 1 ||
        current.mainWrongAttempts < level + 1 ||
        current.mainAttempts <= current.lastHintAtAttempt
      )
        throw conflict();
      const updated = await database.parentLearningSession.updateMany({
        where: this.#mutationWhere(context, current),
        data: {
          highestHintLevel: level,
          visibleHintLevel: level,
          lastHintAtAttempt: current.mainAttempts,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) throw conflict();
      return this.#updatedView(database, context, sessionId, scope);
    });
  }

  public async closeSession(context: ParentLearningContext, sessionId: string, value: unknown) {
    this.#requireCapability(context);
    if (!this.#uuid(sessionId)) throw invalid();
    if (!exactBody(value, ["expectedVersion"]) || !expectedVersion(value.expectedVersion))
      throw invalid();
    return this.#transaction(async (database) => {
      const { row, scope } = await this.#scopedSession(database, context, sessionId);
      const current = await this.#refreshExpiry(database, context, row, scope.control);
      if (current.version !== value.expectedVersion || current.status !== "ACTIVE")
        throw conflict();
      const now = this.now();
      const updated = await database.parentLearningSession.updateMany({
        where: this.#mutationWhere(context, current),
        data: { status: "CLOSED", endedAt: now, version: { increment: 1 } },
      });
      if (updated.count !== 1) throw conflict();
      return this.#updatedView(database, context, sessionId, scope);
    });
  }

  async #parentScope(
    database: Database,
    context: ParentLearningContext,
    studentId: string,
    expected?: Pick<SessionRow, "guardianRelationshipId" | "consentId">,
  ): Promise<ParentScope> {
    const relationship = await database.guardianRelationship.findFirst({
      where: {
        tenantId: context.tenantId,
        campusId: context.campusId,
        guardianUserId: context.actorId,
        studentId,
        status: "ACTIVE",
        campus: { status: "ACTIVE" },
        student: { status: "ACTIVE" },
        guardian: { status: "ACTIVE" },
      },
      select: { id: true, student: { select: { id: true, displayRef: true } } },
    });
    if (!relationship || (expected && relationship.id !== expected.guardianRelationshipId))
      throw forbidden();

    const now = this.now();
    const consent = await database.guardianConsent.findFirst({
      where: {
        tenantId: context.tenantId,
        campusId: context.campusId,
        guardianRelationshipId: relationship.id,
        guardianUserId: context.actorId,
        studentId,
        scope: "LEARNING_SUPPORT",
        consentVersion: CONSENT_VERSION,
        noticeVersion: "LEARNING_SUPPORT_NOTICE_V1",
        policyVersion: POLICY_VERSION,
        status: "ACTIVE",
        withdrawnAt: null,
        confirmedAt: { lte: now },
        ...(expected ? { id: expected.consentId } : {}),
      },
      orderBy: { confirmedAt: "desc" },
      select: { id: true, consentVersion: true, policyVersion: true, confirmedAt: true },
    });
    const setting = await database.aIInstitutionSetting.findUnique({
      where: { tenantId_campusId: { tenantId: context.tenantId, campusId: context.campusId } },
      select: { enabled: true },
    });
    const control = await database.parentLearningControl.findFirst({
      where: {
        tenantId: context.tenantId,
        campusId: context.campusId,
        guardianRelationshipId: relationship.id,
        guardianUserId: context.actorId,
        studentId,
      },
      select: { enabled: true, maxDurationMinutes: true, maxHintLevel: true },
    });
    if (!consent || !setting?.enabled) throw forbidden();
    if (expected && consent.id !== expected.consentId) throw forbidden();
    const resolvedControl = control ?? { enabled: true, maxDurationMinutes: 15, maxHintLevel: 3 };
    if (!resolvedControl.enabled) throw forbidden();
    return { relationship, consent, control: resolvedControl };
  }

  async #scopedSession(database: Database, context: ParentLearningContext, sessionId: string) {
    const row = await database.parentLearningSession.findFirst({
      where: {
        id: sessionId,
        tenantId: context.tenantId,
        campusId: context.campusId,
        guardianUserId: context.actorId,
      },
    });
    if (!row) throw notFound();
    let scope: ParentScope;
    try {
      scope = await this.#parentScope(database, context, row.studentId, row);
    } catch (error) {
      if (error instanceof LearningSessionFailure && error.statusCode === 403) throw notFound();
      throw error;
    }
    return { row: row as SessionRow, scope };
  }

  async #refreshExpiry(
    database: Database,
    context: ParentLearningContext,
    session: SessionRow,
    control: ParentScope["control"],
  ): Promise<SessionRow> {
    if (session.status !== "ACTIVE") return session;
    const deadline = effectiveEnd(session, control.maxDurationMinutes);
    if (deadline.getTime() > this.now().getTime()) return session;
    const updated = await database.parentLearningSession.updateMany({
      where: this.#mutationWhere(context, session),
      data: { status: "EXPIRED", endedAt: deadline, version: { increment: 1 } },
    });
    if (updated.count === 1)
      return { ...session, status: "EXPIRED", endedAt: deadline, version: session.version + 1 };
    const latest = await database.parentLearningSession.findFirst({
      where: {
        id: session.id,
        tenantId: context.tenantId,
        campusId: context.campusId,
        guardianUserId: context.actorId,
      },
    });
    if (!latest) throw notFound();
    return latest as SessionRow;
  }

  #mutationWhere(context: ParentLearningContext, session: SessionRow) {
    return {
      id: session.id,
      tenantId: context.tenantId,
      campusId: context.campusId,
      guardianUserId: context.actorId,
      guardianRelationshipId: session.guardianRelationshipId,
      studentId: session.studentId,
      consentId: session.consentId,
      status: "ACTIVE",
      version: session.version,
    };
  }

  async #updatedView(
    database: Database,
    context: ParentLearningContext,
    sessionId: string,
    scope: ParentScope,
  ) {
    const row = await database.parentLearningSession.findFirst({
      where: {
        id: sessionId,
        tenantId: context.tenantId,
        campusId: context.campusId,
        guardianUserId: context.actorId,
      },
    });
    if (!row) throw notFound();
    return this.#view(
      row as SessionRow,
      scope.relationship.student.displayRef,
      scope.consent.confirmedAt,
      scope.control,
    );
  }

  #view(
    session: SessionRow,
    studentLabel: string,
    consentedAt: Date,
    control: ParentScope["control"],
  ): LearningSessionView {
    const consolidation: LearningPracticeView[] = session.mainCorrect
      ? practiceItems.map((item) => {
          const answered =
            item.id === "practice-1" ? session.practiceOneAnswered : session.practiceTwoAnswered;
          const correct =
            item.id === "practice-1" ? session.practiceOneCorrect : session.practiceTwoCorrect;
          return { id: item.id, prompt: item.prompt, choices: item.choices, answered, correct };
        })
      : [];
    const hintLevel = session.visibleHintLevel;
    const visibleHint =
      hintLevel !== null && hintLevel <= control.maxHintLevel
        ? { level: hintLevel as 0 | 1 | 2 | 3, text: hints[hintLevel]! }
        : null;
    return {
      id: session.id,
      version: session.version,
      status: mapStatus(session.status),
      consentVersion: session.consentVersion,
      consentedAt: consentedAt.toISOString(),
      guidanceMode: "FIXED_LOCAL",
      studentId: session.studentId,
      studentLabel,
      question,
      durationMinutes: session.durationMinutes as 5 | 10 | 15,
      startedAt: session.startedAt.toISOString(),
      endsAt: effectiveEnd(session, control.maxDurationMinutes).toISOString(),
      mainAttempts: session.mainAttempts,
      mainAttemptLimit: MAIN_ATTEMPT_LIMIT,
      mainAttemptLimitReached: !session.mainCorrect && session.mainAttempts >= MAIN_ATTEMPT_LIMIT,
      lastHintAtAttempt: session.lastHintAtAttempt,
      mainCorrect: session.mainCorrect,
      highestHintLevel: session.highestHintLevel as -1 | 0 | 1 | 2 | 3,
      visibleHint,
      consolidation,
      needsTeacherFollowUp: session.needsTeacherFollowUp,
    };
  }

  #requireCapability(context: ParentLearningContext) {
    if (!context.capabilities.includes("binding:read")) throw forbidden();
  }

  #uuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
      value,
    );
  }

  async #transaction<T>(operation: (database: Database) => Promise<T>): Promise<T> {
    try {
      return await this.prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ["P2002", "P2034"].includes(error.code)
      )
        throw conflict();
      throw error;
    }
  }
}
