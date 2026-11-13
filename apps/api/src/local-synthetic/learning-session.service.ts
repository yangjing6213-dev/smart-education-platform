import { randomUUID } from "node:crypto";
import type {
  LearningChoice,
  LearningPracticeView,
  LearningQuestionView,
  LearningRateMetric,
  LearningSafetySummary,
  LearningSessionStatus,
  LearningSessionView,
  LearningTeacherSummary,
} from "@student-care/contracts";
import { exactBody, LocalError } from "./binding-leave.service.js";
import { LocalRepository, type ResourceLibraryRecord } from "./repository.js";
import { studentForId, type LocalAction, type LocalMember } from "./sessions.js";
import type { ConsentService } from "./consent.service.js";

const QUESTION_ID = "math-grade-3-addition-01";
const CONSENT_VERSION = "LEARNING_DEMO_V2";
// Local fixed practice: initial attempt plus one attempt after each of four hints.
const MAIN_ATTEMPT_LIMIT = 5;
const choices: readonly LearningChoice[] = [
  { id: "A", label: "393" },
  { id: "B", label: "403" },
  { id: "C", label: "413" },
];
const question: LearningQuestionView = {
  id: QUESTION_ID,
  grade: "三年级",
  subject: "数学",
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
const practiceQuestions = [
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

type ChoiceId = LearningChoice["id"];
export interface StaffDailyLearningSummary {
  completedLearnerBand: "2_PLUS";
  usedGuidance: boolean;
  needsTeacherFollowUp: boolean;
}

export interface LearningInstitutionSetting {
  enabled: boolean;
  version: number;
}

type ParentLearningControlValues = {
  enabled: boolean;
  maxDurationMinutes: 5 | 10 | 15;
  maxHintLevel: 0 | 1 | 2 | 3;
};

type ParentLearningControlView = ParentLearningControlValues & {
  studentId: string;
  studentLabel: string;
  contactStatus: "NOT_REQUESTED" | "RECORDED_LOCAL";
};

type ParentLearningContactIntent = {
  id: string;
  studentId: string;
  studentLabel: string;
  tenantId: string;
  campusId: string;
  classId: string;
  status: "RECORDED_LOCAL";
  createdAt: string;
};

type ParentLearningSummaryStudent = {
  studentId: string;
  studentLabel: string;
  usedMinutes: number;
  sessionCount: number;
  completedSessions: number;
  knowledgePoints: {
    label: string;
    sessionCount: number;
    completedSessions: number;
  }[];
  attentionCount: number;
};

interface LearningRecord {
  id: string;
  version: number;
  status: LearningSessionStatus;
  consentRecordId: string;
  consentVersion: "LEARNING_DEMO_V2";
  policyVersion: "AI_LEARNING_POLICY_SYNTHETIC_V1";
  consentedAt: string;
  guidanceMode: "FIXED_LOCAL";
  ownerActorId: string;
  studentId: string;
  studentLabel: string;
  tenantId: string;
  campusId: string;
  classId: string;
  durationMinutes: 5 | 10 | 15;
  startedAt: string;
  endsAt: string;
  endedAt: string | null;
  mainAttempts: number;
  lastHintAtAttempt: number;
  mainWrongAttempts: number;
  answeredAfterHint: boolean;
  mainCorrect: boolean;
  highestHintLevel: -1 | 0 | 1 | 2 | 3;
  visibleHint: { level: 0 | 1 | 2 | 3; text: string } | null;
  practice: { id: "practice-1" | "practice-2"; answered: boolean; correct: boolean | null }[];
  needsTeacherFollowUp: boolean;
}

const invalid = () => new LocalError(400, "INVALID_REQUEST");
const unavailable = () => new LocalError(403, "UNAVAILABLE");
const conflict = () => new LocalError(409, "STATE_CONFLICT");
const isChoice = (value: unknown): value is ChoiceId =>
  typeof value === "string" && ["A", "B", "C"].includes(value);
const rate = (numerator: number, denominator: number): LearningRateMetric => ({
  numerator,
  denominator,
  percent: denominator === 0 ? null : Math.round((numerator / denominator) * 1000) / 10,
});

function currentDate(now: number) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(now));
}

export class LearningSessionService {
  readonly #records = new Map<string, LearningRecord>();
  readonly #parentControls = new Map<string, ParentLearningControlValues>();
  readonly #parentContactIntents = new Map<string, ParentLearningContactIntent>();
  readonly #institutionSettings = new Map<string, LearningInstitutionSetting>();

  constructor(
    private readonly repository: LocalRepository,
    private readonly consents: Pick<ConsentService, "activeLearningConsent">,
    private readonly now: () => number = Date.now,
  ) {}

  institutionSetting(member: LocalMember): LearningInstitutionSetting {
    this.#permitInstitutionOwner(member);
    return { ...this.#institutionSettingFor(member) };
  }

  updateInstitutionSetting(member: LocalMember, value: unknown): LearningInstitutionSetting {
    this.#permitInstitutionOwner(member);
    const body = exactBody(value, ["enabled", "expectedVersion"]);
    if (
      typeof body.enabled !== "boolean" ||
      !Number.isSafeInteger(body.expectedVersion) ||
      Number(body.expectedVersion) < 0
    )
      throw invalid();

    const current = this.#institutionSettingFor(member);
    if (body.expectedVersion !== current.version) throw conflict();
    if (body.enabled === current.enabled) return { ...current };

    const next = { enabled: body.enabled, version: current.version + 1 };
    this.#institutionSettings.set(this.#institutionSettingKey(member), next);
    this.repository.audit({
      actorId: member.actorId,
      objectId: null,
      version: next.version,
      action: "learning.institution-setting.update",
      outcome: "ACCEPTED",
      at: new Date(this.now()).toISOString(),
      tenantId: member.tenantId,
      campusId: member.campusId,
    });

    if (!next.enabled) {
      for (const record of this.#records.values()) {
        if (
          record.tenantId !== member.tenantId ||
          record.campusId !== member.campusId ||
          this.#refresh(record) !== "ACTIVE"
        )
          continue;
        this.#finish(record, "CLOSED");
        record.visibleHint = null;
        record.version += 1;
        this.#audit(member, record, "learning.institution-setting.disable", "ACCEPTED");
      }
    }
    return { ...next };
  }

  create(member: LocalMember, value: unknown) {
    const body = exactBody(value, ["studentId", "questionId", "consentVersion", "durationMinutes"]);
    if (
      typeof body.studentId !== "string" ||
      body.questionId !== QUESTION_ID ||
      body.consentVersion !== CONSENT_VERSION ||
      typeof body.durationMinutes !== "number" ||
      ![5, 10, 15].includes(body.durationMinutes)
    )
      throw invalid();
    this.#permit(member, "learning:enable");
    const student = studentForId(body.studentId);
    if (
      !student ||
      student.tenantId !== member.tenantId ||
      student.campusId !== member.campusId ||
      !member.classIds.includes(student.classId)
    )
      throw unavailable();

    if (member.profile.startsWith("parent-")) {
      this.#approvedParentStudent(member, student.id);
      const controls = this.#parentControl(member.actorId, student);
      if (!controls.enabled || body.durationMinutes > controls.maxDurationMinutes)
        throw unavailable();
    } else if (!member.profile.startsWith("teacher-")) {
      throw unavailable();
    }

    this.#assertInstitutionEnabled(member);

    const consent = this.consents.activeLearningConsent(member, student.id);
    if (
      !consent ||
      consent.consentVersion !== CONSENT_VERSION ||
      consent.policyVersion !== "AI_LEARNING_POLICY_SYNTHETIC_V1"
    )
      throw unavailable();

    const started = this.now();
    const durationMinutes = body.durationMinutes as 5 | 10 | 15;
    const record: LearningRecord = {
      id: randomUUID(),
      version: 1,
      status: "ACTIVE",
      consentRecordId: consent.id,
      consentVersion: consent.consentVersion,
      policyVersion: consent.policyVersion,
      consentedAt: consent.authorizedAt,
      guidanceMode: "FIXED_LOCAL",
      ownerActorId: member.actorId,
      studentId: student.id,
      studentLabel: student.label,
      tenantId: student.tenantId,
      campusId: student.campusId,
      classId: student.classId,
      durationMinutes,
      startedAt: new Date(started).toISOString(),
      endsAt: new Date(started + durationMinutes * 60_000).toISOString(),
      endedAt: null,
      mainAttempts: 0,
      lastHintAtAttempt: 0,
      mainWrongAttempts: 0,
      answeredAfterHint: false,
      mainCorrect: false,
      highestHintLevel: -1,
      visibleHint: null,
      practice: [
        { id: "practice-1", answered: false, correct: null },
        { id: "practice-2", answered: false, correct: null },
      ],
      needsTeacherFollowUp: false,
    };
    this.#records.set(record.id, record);
    this.#audit(member, record, "learning.enable", "ACCEPTED");
    return this.#view(record);
  }

  list(member: LocalMember) {
    this.#permit(member, "learning:read");
    if (!member.profile.startsWith("parent-") && !member.profile.startsWith("teacher-"))
      throw unavailable();
    return [...this.#records.values()]
      .filter((record) => record.ownerActorId === member.actorId)
      .filter(
        (record) =>
          !member.profile.startsWith("parent-") ||
          this.#hasApprovedParentBinding(member, record.studentId),
      )
      .sort((left, right) => right.startedAt.localeCompare(left.startedAt))
      .map((record) => this.#view(record));
  }

  parentSummary(member: LocalMember): {
    students: ParentLearningSummaryStudent[];
  } {
    this.#permit(member, "learning:read");
    if (!member.profile.startsWith("parent-")) throw unavailable();
    const students = new Map<string, NonNullable<ReturnType<typeof studentForId>>>();
    for (const row of this.repository.list()) {
      if (
        row.kind !== "binding" ||
        row.status !== "APPROVED" ||
        row.guardianId !== member.actorId ||
        row.tenantId !== member.tenantId ||
        row.campusId !== member.campusId
      )
        continue;
      const student = studentForId(row.studentId);
      if (
        student &&
        student.tenantId === row.tenantId &&
        student.campusId === row.campusId &&
        student.classId === row.classId &&
        member.classIds.includes(student.classId)
      )
        students.set(student.id, student);
    }

    return {
      students: [...students.values()].map((student) => {
        const records = [...this.#records.values()].filter(
          (record) =>
            record.studentId === student.id &&
            record.tenantId === member.tenantId &&
            record.campusId === member.campusId &&
            record.classId === student.classId,
        );
        const statuses = records.map((record) => this.#refresh(record));
        const usedMilliseconds = records.reduce(
          (total, record, index) => total + this.#usedMilliseconds(record, statuses[index]!),
          0,
        );
        const usedMinutes = Math.ceil(usedMilliseconds / 60_000);
        const completedSessions = statuses.filter((status) => status === "COMPLETED").length;
        const knowledgePoints = records.length
          ? [
              {
                label: question.knowledgePoint,
                sessionCount: records.length,
                completedSessions,
              },
            ]
          : [];
        return {
          studentId: student.id,
          studentLabel: student.label,
          usedMinutes,
          sessionCount: records.length,
          completedSessions,
          knowledgePoints,
          attentionCount: statuses.filter((status) => status === "HANDED_OFF").length,
        };
      }),
    };
  }

  learningKnowledge(member: LocalMember) {
    this.#permit(member, "learning:read");

    let audience: "PARENT" | "TEACHER";
    let classIds: string[];
    if (member.profile.startsWith("parent-")) {
      audience = "PARENT";
      const approvedBindings = this.repository.list().filter((row) => {
        if (
          row.kind !== "binding" ||
          row.status !== "APPROVED" ||
          row.guardianId !== member.actorId ||
          row.tenantId !== member.tenantId ||
          row.campusId !== member.campusId
        )
          return false;
        const student = studentForId(row.studentId);
        return (
          student?.tenantId === row.tenantId &&
          student.campusId === row.campusId &&
          student.classId === row.classId
        );
      });
      if (approvedBindings.length === 0) throw unavailable();
      classIds = [...new Set(approvedBindings.map((binding) => binding.classId))];
    } else if (member.profile.startsWith("teacher-")) {
      audience = "TEACHER";
      classIds = member.classIds;
    } else {
      throw unavailable();
    }

    const today = currentDate(this.now());
    return this.repository
      .list()
      .filter((row): row is ResourceLibraryRecord => row.kind === "resourceLibrary")
      .filter(
        (resource) =>
          resource.tenantId === member.tenantId &&
          resource.campusId === member.campusId &&
          resource.audienceRoles.includes(audience) &&
          resource.status === "PUBLISHED" &&
          resource.learningSourceGovernance?.reviewStatus === "APPROVED" &&
          resource.learningSourceGovernance.reviewedAt !== null &&
          resource.expiresOn >= today &&
          resource.grade === question.grade &&
          resource.subject === question.subject &&
          resource.tags.includes(question.knowledgePoint) &&
          (resource.scope === "CAMPUS" || classIds.includes(resource.classId)),
      )
      .sort((left, right) => left.title.localeCompare(right.title, "zh-CN"))
      .map((resource) => ({
        id: resource.id,
        version: resource.version,
        title: resource.title,
        summary: resource.summary,
        content: resource.content,
        grade: resource.grade,
        subject: resource.subject,
        knowledgePoint: question.knowledgePoint,
        sourceLabel: resource.sourceLabel,
        expiresOn: resource.expiresOn,
      }));
  }

  get(member: LocalMember, id: string) {
    this.#permit(member, "learning:read");
    if (!member.profile.startsWith("parent-") && !member.profile.startsWith("teacher-"))
      throw unavailable();
    const record = this.#owned(member, id);
    return this.#view(record);
  }

  answer(member: LocalMember, id: string, value: unknown) {
    const body = exactBody(value, ["itemId", "choice"]);
    if (typeof body.itemId !== "string" || !isChoice(body.choice)) throw invalid();
    this.#permit(member, "learning:enable");
    const record = this.#owned(member, id);
    this.#active(record);
    this.#assertConsentActive(member, record);
    if (body.itemId === "main") {
      if (record.mainCorrect || record.mainAttempts >= MAIN_ATTEMPT_LIMIT) throw conflict();
      if (record.highestHintLevel >= 0) record.answeredAfterHint = true;
      record.mainAttempts += 1;
      if (body.choice === "B") record.mainCorrect = true;
      else {
        record.mainWrongAttempts += 1;
        if (record.mainWrongAttempts >= 4) record.needsTeacherFollowUp = true;
      }
    } else if (body.itemId === "practice-1" || body.itemId === "practice-2") {
      if (!record.mainCorrect) throw conflict();
      const item = record.practice.find((row) => row.id === body.itemId)!;
      if (item.answered) throw conflict();
      const answer = practiceQuestions.find((row) => row.id === body.itemId)!.answer;
      item.answered = true;
      item.correct = body.choice === answer;
      if (!item.correct) record.needsTeacherFollowUp = true;
      if (record.practice.every((row) => row.answered)) this.#finish(record, "COMPLETED");
    } else {
      throw invalid();
    }
    record.version += 1;
    this.#audit(member, record, "learning.answer", "ACCEPTED");
    return this.#view(record);
  }

  hint(member: LocalMember, id: string, value: unknown) {
    const body = exactBody(value, ["level"]);
    if (
      typeof body.level !== "number" ||
      !Number.isInteger(body.level) ||
      body.level < 0 ||
      body.level > 3
    )
      throw invalid();
    this.#permit(member, "learning:enable");
    const record = this.#owned(member, id);
    this.#active(record);
    this.#assertConsentActive(member, record);
    const level = Number(body.level) as 0 | 1 | 2 | 3;
    if (member.profile.startsWith("parent-")) {
      const student = this.#approvedParentStudent(member, record.studentId);
      if (level > this.#parentControl(member.actorId, student).maxHintLevel) throw unavailable();
    }
    if (
      record.mainCorrect ||
      record.mainAttempts >= MAIN_ATTEMPT_LIMIT ||
      level !== record.highestHintLevel + 1 ||
      record.mainWrongAttempts < level + 1 ||
      record.mainAttempts <= record.lastHintAtAttempt
    )
      throw conflict();
    record.highestHintLevel = level;
    record.lastHintAtAttempt = record.mainAttempts;
    record.visibleHint = { level, text: hints[level] };
    record.version += 1;
    this.#audit(member, record, `learning.hint.${level}`, "ACCEPTED");
    return this.#view(record);
  }

  close(member: LocalMember, id: string, value: unknown) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) throw invalid();
    const body = value as Record<string, unknown>;
    if (Object.keys(body).some((key) => key !== "handoff")) throw invalid();
    this.#permit(member, "learning:close");
    if (body.handoff !== undefined && body.handoff !== true) throw invalid();
    if (body.handoff === true) {
      if (!member.profile.startsWith("teacher-")) throw unavailable();
      const record = this.#withinTeacherScope(member, id);
      this.#active(record);
      this.#finish(record, "HANDED_OFF");
      record.needsTeacherFollowUp = true;
      record.version += 1;
      this.#audit(member, record, "learning.teacher-handoff", "ACCEPTED");
      return this.#view(record);
    }
    const record = this.#owned(member, id);
    this.#refresh(record);
    if (record.status === "COMPLETED") return this.#view(record);
    if (record.status !== "ACTIVE") throw conflict();
    this.#finish(record, "CLOSED");
    record.version += 1;
    this.#audit(member, record, "learning.close", "ACCEPTED");
    return this.#view(record);
  }

  delete(member: LocalMember, id: string, value: unknown) {
    exactBody(value, []);
    this.#permit(member, "learning:delete");
    const teacher = member.profile.startsWith("teacher-");
    const record = teacher ? this.#withinTeacherScope(member, id) : this.#owned(member, id);
    const status = this.#refresh(record);
    if (status === "ACTIVE") throw conflict();
    if (teacher && record.ownerActorId !== member.actorId && status !== "HANDED_OFF")
      throw unavailable();
    this.#records.delete(id);
    this.#audit(member, record, "learning.delete", "ACCEPTED");
    return { deleted: true };
  }

  teacherSummary(member: LocalMember): LearningTeacherSummary {
    this.#permit(member, "learning:summary");
    if (!member.profile.startsWith("teacher-")) throw unavailable();
    const sessions = [...this.#records.values()]
      .filter(
        (record) =>
          record.tenantId === member.tenantId &&
          record.campusId === member.campusId &&
          member.classIds.includes(record.classId),
      )
      .sort((left, right) => right.startedAt.localeCompare(left.startedAt))
      .map((record) => ({
        id: record.id,
        status: this.#refresh(record),
        studentLabel: record.studentLabel,
        grade: "三年级" as const,
        subject: "数学" as const,
        knowledgePoint: question.knowledgePoint,
        mainAttempts: record.mainAttempts,
        highestHintLevel: record.highestHintLevel,
        consolidationCompleted: record.practice.filter((item) => item.answered && item.correct)
          .length,
        needsTeacherFollowUp: record.needsTeacherFollowUp,
        startedAt: record.startedAt,
      }));
    return { sessions };
  }

  parentControls(member: LocalMember): {
    students: ParentLearningControlView[];
    parentSummary: ParentLearningSummaryStudent[];
    parentSummaryUpdatedAt: string;
  } {
    this.#permit(member, "learning:read");
    if (!member.profile.startsWith("parent-")) throw unavailable();
    const students = new Map<string, NonNullable<ReturnType<typeof studentForId>>>();
    for (const row of this.repository.list()) {
      if (
        row.kind !== "binding" ||
        row.status !== "APPROVED" ||
        row.guardianId !== member.actorId ||
        row.tenantId !== member.tenantId ||
        row.campusId !== member.campusId
      )
        continue;
      const student = studentForId(row.studentId);
      if (
        student &&
        student.tenantId === row.tenantId &&
        student.campusId === row.campusId &&
        student.classId === row.classId &&
        member.classIds.includes(student.classId)
      )
        students.set(student.id, student);
    }
    const parentSummary = this.parentSummary(member).students;
    return {
      students: [...students.values()].map((student) =>
        this.#parentControl(member.actorId, student),
      ),
      parentSummary,
      parentSummaryUpdatedAt: new Date(this.now()).toISOString(),
    };
  }

  updateParentControls(
    member: LocalMember,
    studentId: string,
    value: unknown,
  ): ParentLearningControlView {
    this.#permit(member, "learning:enable");
    const student = this.#approvedParentStudent(member, studentId);
    const body = exactBody(value, ["enabled", "maxDurationMinutes", "maxHintLevel"]);
    if (
      typeof body.enabled !== "boolean" ||
      typeof body.maxDurationMinutes !== "number" ||
      ![5, 10, 15].includes(body.maxDurationMinutes) ||
      typeof body.maxHintLevel !== "number" ||
      !Number.isInteger(body.maxHintLevel) ||
      body.maxHintLevel < 0 ||
      body.maxHintLevel > 3
    )
      throw invalid();
    this.#parentControls.set(this.#parentControlKey(member.actorId, student.id), {
      enabled: body.enabled,
      maxDurationMinutes: body.maxDurationMinutes as 5 | 10 | 15,
      maxHintLevel: body.maxHintLevel as 0 | 1 | 2 | 3,
    });
    for (const record of this.#records.values()) {
      if (
        record.ownerActorId !== member.actorId ||
        record.studentId !== student.id ||
        this.#refresh(record) !== "ACTIVE"
      )
        continue;
      if (!body.enabled) {
        this.#finish(record, "CLOSED");
        record.version += 1;
        this.#audit(member, record, "learning.parent-controls.disable", "ACCEPTED");
        continue;
      }
      const allowedEnd = Date.parse(record.startedAt) + body.maxDurationMinutes * 60_000;
      if (allowedEnd < Date.parse(record.endsAt)) {
        record.durationMinutes = body.maxDurationMinutes as 5 | 10 | 15;
        record.endsAt = new Date(allowedEnd).toISOString();
        record.version += 1;
        this.#audit(member, record, "learning.parent-controls.duration-limit", "ACCEPTED");
      }
    }
    this.#auditParentAction(member, student.id, "learning.parent-controls.update");
    return this.#parentControl(member.actorId, student);
  }

  contactTeacher(
    member: LocalMember,
    studentId: string,
    value: unknown,
  ): {
    id: string;
    studentId: string;
    studentLabel: string;
    status: "RECORDED_LOCAL";
    createdAt: string;
  } {
    this.#permit(member, "learning:read");
    exactBody(value, []);
    const student = this.#approvedParentStudent(member, studentId);
    const key = this.#parentControlKey(member.actorId, student.id);
    let intent = this.#parentContactIntents.get(key);
    if (!intent) {
      intent = {
        id: randomUUID(),
        studentId: student.id,
        studentLabel: student.label,
        tenantId: student.tenantId,
        campusId: student.campusId,
        classId: student.classId,
        status: "RECORDED_LOCAL",
        createdAt: new Date(this.now()).toISOString(),
      };
      this.#parentContactIntents.set(key, intent);
      this.#auditParentAction(member, student.id, "learning.parent-contact.record-local");
    }
    return {
      id: intent.id,
      studentId: intent.studentId,
      studentLabel: intent.studentLabel,
      status: intent.status,
      createdAt: intent.createdAt,
    };
  }

  teacherContactIntents(member: LocalMember) {
    this.#permit(member, "learning:summary");
    if (!member.profile.startsWith("teacher-")) throw unavailable();
    return [...this.#parentContactIntents.values()]
      .filter(
        (intent) =>
          intent.tenantId === member.tenantId &&
          intent.campusId === member.campusId &&
          member.classIds.includes(intent.classId),
      )
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map(({ id, studentLabel, status, createdAt }) => ({ id, studentLabel, status, createdAt }));
  }

  safetySummary(member: LocalMember): LearningSafetySummary {
    this.#permit(member, "learning:safety-summary");
    if (member.profile !== "platform-admin") throw unavailable();
    const records = [...this.#records.values()];
    const counts = records.map((record) => this.#refresh(record));
    const learningAudit = this.repository
      .audits()
      .filter((event) => event.action.startsWith("learning."));
    const hintedSessions = records.filter((record) => record.highestHintLevel >= 0);
    const sessionsWithTeacherIntervention = new Set(
      learningAudit
        .filter(
          (event) =>
            event.action === "learning.teacher-handoff" &&
            event.outcome === "ACCEPTED" &&
            event.objectId !== null &&
            records.some((record) => record.id === event.objectId),
        )
        .map((event) => event.objectId),
    ).size;
    const consolidationAnswered = records.reduce(
      (total, record) => total + record.practice.filter((item) => item.answered).length,
      0,
    );
    const consolidationIncorrect = records.reduce(
      (total, record) =>
        total + record.practice.filter((item) => item.answered && !item.correct).length,
      0,
    );
    const mainAnswerAttempts = records.reduce((total, record) => total + record.mainAttempts, 0);
    const answerCount = mainAnswerAttempts + consolidationAnswered;
    return {
      metricVersion: "LEARNING_SAFETY_V2",
      totalSessions: records.length,
      activeSessions: counts.filter((status) => status === "ACTIVE").length,
      completedSessions: counts.filter((status) => status === "COMPLETED").length,
      closedSessions: counts.filter((status) => status === "CLOSED").length,
      expiredSessions: counts.filter((status) => status === "EXPIRED").length,
      hintRequests: records.reduce((total, record) => total + record.highestHintLevel + 1, 0),
      teacherFollowUps: records.filter((record) => record.needsTeacherFollowUp).length,
      refusedActions: learningAudit.filter((event) => event.outcome === "DENIED").length,
      teacherHandoffs: learningAudit.filter(
        (event) => event.action === "learning.teacher-handoff" && event.outcome === "ACCEPTED",
      ).length,
      fixedGuidanceSessions: records.filter((record) => record.guidanceMode === "FIXED_LOCAL")
        .length,
      firstAttemptSuccesses: records.filter(
        (record) => record.mainCorrect && record.mainAttempts === 1,
      ).length,
      hintAssistedSuccesses: records.filter(
        (record) => record.mainCorrect && record.highestHintLevel >= 0,
      ).length,
      mainAnswerAttempts,
      consolidationAnswered,
      consolidationCorrect: records.reduce(
        (total, record) =>
          total + record.practice.filter((item) => item.answered && item.correct).length,
        0,
      ),
      postHintAnswerRate: rate(
        hintedSessions.filter((record) => record.answeredAfterHint).length,
        hintedSessions.length,
      ),
      consolidationCompletionRate: rate(
        consolidationAnswered,
        records.filter((record) => record.mainCorrect).length * practiceQuestions.length,
      ),
      teacherInterventionRate: rate(sessionsWithTeacherIntervention, records.length),
      answerErrorRate: rate(
        records.reduce((total, record) => total + record.mainWrongAttempts, 0) +
          consolidationIncorrect,
        answerCount,
      ),
      severeSafetyEvents: learningAudit.filter(
        (event) => event.action === "learning.safety-incident" && event.outcome === "ACCEPTED",
      ).length,
    };
  }

  dailySummary(
    date: string,
    tenantId: string,
    campusId: string,
    classId: string,
  ): StaffDailyLearningSummary | null {
    const completed = [...this.#records.values()].filter((record) => {
      const status = this.#refresh(record);
      return (
        status === "COMPLETED" &&
        currentDate(Date.parse(record.startedAt)) === date &&
        record.tenantId === tenantId &&
        record.campusId === campusId &&
        record.classId === classId
      );
    });
    if (new Set(completed.map((record) => record.studentId)).size < 2) return null;
    return {
      completedLearnerBand: "2_PLUS",
      usedGuidance: completed.some((record) => record.highestHintLevel >= 0),
      needsTeacherFollowUp: completed.some((record) => record.needsTeacherFollowUp),
    };
  }

  #withinTeacherScope(member: LocalMember, id: string) {
    const record = this.#records.get(id);
    if (
      !record ||
      record.tenantId !== member.tenantId ||
      record.campusId !== member.campusId ||
      !member.classIds.includes(record.classId)
    )
      throw unavailable();
    if (member.profile.startsWith("parent-")) this.#approvedParentStudent(member, record.studentId);
    return record;
  }

  #approvedParentStudent(member: LocalMember, studentId: string) {
    this.#permit(member, "learning:read");
    if (!member.profile.startsWith("parent-")) throw unavailable();
    const student = studentForId(studentId);
    if (
      !student ||
      student.tenantId !== member.tenantId ||
      student.campusId !== member.campusId ||
      !member.classIds.includes(student.classId) ||
      !this.#hasApprovedParentBinding(member, studentId)
    )
      throw unavailable();
    return student;
  }

  #hasApprovedParentBinding(member: LocalMember, studentId: string) {
    const student = studentForId(studentId);
    return Boolean(
      student &&
      student.tenantId === member.tenantId &&
      student.campusId === member.campusId &&
      member.classIds.includes(student.classId) &&
      this.repository
        .list()
        .some(
          (row) =>
            row.kind === "binding" &&
            row.status === "APPROVED" &&
            row.guardianId === member.actorId &&
            row.studentId === student.id &&
            row.tenantId === student.tenantId &&
            row.campusId === student.campusId &&
            row.classId === student.classId,
        ),
    );
  }

  #parentControlKey(parentActorId: string, studentId: string) {
    return JSON.stringify([parentActorId, studentId]);
  }

  #parentControl(parentActorId: string, student: NonNullable<ReturnType<typeof studentForId>>) {
    const key = this.#parentControlKey(parentActorId, student.id);
    const values = this.#parentControls.get(key) ?? {
      enabled: true,
      maxDurationMinutes: 15 as const,
      maxHintLevel: 3 as const,
    };
    return {
      studentId: student.id,
      studentLabel: student.label,
      ...values,
      contactStatus: this.#parentContactIntents.has(key)
        ? ("RECORDED_LOCAL" as const)
        : ("NOT_REQUESTED" as const),
    };
  }

  #auditParentAction(member: LocalMember, studentId: string, action: string) {
    this.repository.audit({
      actorId: member.actorId,
      objectId: studentId,
      version: 1,
      action,
      outcome: "ACCEPTED",
      at: new Date(this.now()).toISOString(),
      tenantId: member.tenantId,
      campusId: member.campusId,
    });
  }

  denied(member: LocalMember, action: string, id: string) {
    const record = this.#records.get(id);
    this.repository.audit({
      actorId: member.actorId,
      objectId: id || null,
      version: record?.version ?? null,
      action,
      outcome: "DENIED",
      at: new Date(this.now()).toISOString(),
      tenantId: member.tenantId,
      campusId: member.campusId,
    });
  }

  #owned(member: LocalMember, id: string) {
    const record = this.#records.get(id);
    if (
      !record ||
      record.ownerActorId !== member.actorId ||
      record.tenantId !== member.tenantId ||
      record.campusId !== member.campusId ||
      !member.classIds.includes(record.classId)
    )
      throw unavailable();
    if (member.profile.startsWith("parent-")) this.#approvedParentStudent(member, record.studentId);
    return record;
  }

  #active(record: LearningRecord) {
    if (this.#refresh(record) !== "ACTIVE") throw conflict();
  }

  #assertConsentActive(member: LocalMember, record: LearningRecord) {
    this.#assertInstitutionEnabled(member, record);
    const consent = this.consents.activeLearningConsent(
      member,
      record.studentId,
      record.consentRecordId,
    );
    if (
      !consent ||
      consent.consentVersion !== record.consentVersion ||
      consent.policyVersion !== record.policyVersion
    )
      throw unavailable();
  }

  #refresh(record: LearningRecord): LearningSessionStatus {
    if (record.status === "ACTIVE" && this.now() >= Date.parse(record.endsAt)) {
      this.#finish(record, "EXPIRED", Date.parse(record.endsAt));
      record.version += 1;
      this.#audit(
        { actorId: record.ownerActorId, tenantId: record.tenantId, campusId: record.campusId },
        record,
        "learning.expire",
        "ACCEPTED",
      );
    }
    return record.status;
  }

  #permitInstitutionOwner(member: LocalMember) {
    this.#permit(member, "learning:institution-setting");
    if (!member.profile.startsWith("owner-")) throw unavailable();
  }

  #institutionSettingKey(member: Pick<LocalMember, "tenantId" | "campusId">) {
    return JSON.stringify([member.tenantId, member.campusId]);
  }

  #institutionSettingFor(
    member: Pick<LocalMember, "tenantId" | "campusId">,
  ): LearningInstitutionSetting {
    return (
      this.#institutionSettings.get(this.#institutionSettingKey(member)) ?? {
        enabled: false,
        version: 0,
      }
    );
  }

  #assertInstitutionEnabled(member: LocalMember, record?: LearningRecord) {
    const scope = record ?? member;
    if (this.#institutionSettingFor(scope).enabled) return;
    if (record && record.status === "ACTIVE") {
      this.#finish(record, "CLOSED");
      record.visibleHint = null;
      record.version += 1;
      this.#audit(member, record, "learning.institution-setting.disable", "ACCEPTED");
    }
    throw unavailable();
  }

  #finish(record: LearningRecord, status: LearningSessionStatus, endedAt = this.now()) {
    record.status = status;
    record.endedAt = new Date(endedAt).toISOString();
  }

  #usedMilliseconds(record: LearningRecord, status: LearningSessionStatus): number {
    const startedAt = Date.parse(record.startedAt);
    const stoppedAt =
      status === "ACTIVE"
        ? Math.min(this.now(), Date.parse(record.endsAt))
        : Date.parse(record.endedAt ?? record.endsAt);
    const elapsed = Math.max(0, stoppedAt - startedAt);
    return Math.min(record.durationMinutes * 60_000, elapsed);
  }

  #view(record: LearningRecord): LearningSessionView & {
    readonly mainAttemptLimit: number;
    readonly mainAttemptLimitReached: boolean;
  } {
    const status = this.#refresh(record);
    const consolidation: LearningPracticeView[] = record.mainCorrect
      ? practiceQuestions.map((item) => {
          const state = record.practice.find((row) => row.id === item.id)!;
          return {
            id: item.id,
            prompt: item.prompt,
            choices: item.choices,
            answered: state.answered,
            correct: state.correct,
          };
        })
      : [];
    return {
      id: record.id,
      version: record.version,
      status,
      consentVersion: record.consentVersion,
      consentedAt: record.consentedAt,
      guidanceMode: record.guidanceMode,
      studentId: record.studentId,
      studentLabel: record.studentLabel,
      question,
      durationMinutes: record.durationMinutes,
      startedAt: record.startedAt,
      endsAt: record.endsAt,
      mainAttempts: record.mainAttempts,
      mainAttemptLimit: MAIN_ATTEMPT_LIMIT,
      mainAttemptLimitReached: !record.mainCorrect && record.mainAttempts >= MAIN_ATTEMPT_LIMIT,
      lastHintAtAttempt: record.lastHintAtAttempt,
      mainCorrect: record.mainCorrect,
      highestHintLevel: record.highestHintLevel,
      visibleHint: record.visibleHint,
      consolidation,
      needsTeacherFollowUp: record.needsTeacherFollowUp,
    };
  }

  #permit(member: LocalMember, action: LocalAction) {
    if (!member.actions.includes(action)) throw unavailable();
  }

  #audit(
    member: Pick<LocalMember, "actorId" | "tenantId" | "campusId">,
    record: LearningRecord,
    action: string,
    outcome: "ACCEPTED" | "DENIED",
  ) {
    this.repository.audit({
      actorId: member.actorId,
      objectId: record.id,
      version: record.version,
      action,
      outcome,
      at: new Date(this.now()).toISOString(),
      tenantId: member.tenantId,
      campusId: member.campusId,
    });
  }
}
