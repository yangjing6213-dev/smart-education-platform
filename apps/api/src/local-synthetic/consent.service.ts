import { randomUUID } from "node:crypto";
import type {
  ConsentPurposeDefinition,
  ConsentEventAction,
  ConsentPurposeKey,
  ConsentRecord,
  ConsentRetentionStatus,
} from "@student-care/contracts";
import { BindingLeaveService, exactBody, LocalError } from "./binding-leave.service.js";
import { studentForId, type LocalAction, type LocalMember } from "./sessions.js";

type ConsentState = "ACTIVE" | "REVOKED";
type ConsentEvent = ConsentRecord["history"][number];
type Mutable<T> = { -readonly [Key in keyof T]: T[Key] };
type StoredConsent = Omit<
  Mutable<ConsentRecord>,
  "history" | "retentionStatus" | "retentionOutcomeNotice"
> & {
  retentionStatus: ConsentRetentionStatus;
  history: ConsentEvent[];
  requestedByActorId: string;
  studentId: string;
  tenantId: string;
  campusId: string;
  classId: string;
};

const invalid = () => new LocalError(400, "INVALID_REQUEST");
const unavailable = () => new LocalError(403, "UNAVAILABLE");
const conflict = () => new LocalError(409, "STATE_CONFLICT");
const DAY_MS = 24 * 60 * 60 * 1000;
const consentPurposes = [
  {
    key: "CARE_RECORD",
    title: "成长记录",
    noticeVersion: "CARE_RECORD_NOTICE_V1",
    consentVersion: null,
    policyVersion: null,
    necessity: "用于向监护人展示经审核发布的成长记录摘要。",
    dataClasses: ["成长活动摘要"],
    retentionDays: 30,
    retentionNotice: "演示期限 30 天，仅演示；实际期限须由机构与专业人员确认。",
    impactReviewStatus: "DEMO_ONLY_PENDING_HUMAN_REVIEW",
  },
  {
    key: "HEALTH_SUPPORT",
    title: "健康协助",
    noticeVersion: "HEALTH_SUPPORT_NOTICE_V1",
    consentVersion: null,
    policyVersion: null,
    necessity: "用于演示监护人知情后接收必要的健康事项摘要。",
    dataClasses: ["健康事项摘要"],
    retentionDays: 14,
    retentionNotice: "演示期限 14 天，仅演示；实际期限须由机构与专业人员确认。",
    impactReviewStatus: "DEMO_ONLY_PENDING_HUMAN_REVIEW",
  },
  {
    key: "LEARNING_SUPPORT",
    title: "学习支持",
    noticeVersion: "LEARNING_SUPPORT_NOTICE_V1",
    consentVersion: "LEARNING_DEMO_V2",
    policyVersion: "AI_LEARNING_POLICY_SYNTHETIC_V1",
    necessity: "用于演示监护人知情后开启固定题目的学习支持。",
    dataClasses: ["学习参与摘要"],
    retentionDays: 7,
    retentionNotice: "演示期限 7 天，仅演示；实际期限须由机构与专业人员确认。",
    impactReviewStatus: "DEMO_ONLY_PENDING_HUMAN_REVIEW",
  },
] as const satisfies readonly ConsentPurposeDefinition[];

function permitted(member: LocalMember, action: LocalAction) {
  if (!member.actions.includes(action)) throw unavailable();
}

function isPurposeKey(value: unknown): value is ConsentPurposeKey {
  return consentPurposes.some((purpose) => purpose.key === value);
}

export class ConsentService {
  readonly #records = new Map<string, StoredConsent>();

  constructor(
    private readonly relationships: Pick<BindingLeaveService, "bindings">,
    private readonly now: () => number = Date.now,
  ) {}

  policies(member: LocalMember) {
    this.#assertMember(member);
    return structuredClone(consentPurposes);
  }

  list(member: LocalMember) {
    this.#assertMember(member);
    const rows = [...this.#records.values()].filter((row) =>
      member.profile.startsWith("parent-")
        ? row.requestedByActorId === member.actorId
        : row.tenantId === member.tenantId &&
          row.campusId === member.campusId &&
          member.classIds.includes(row.classId),
    );
    return rows
      .sort((left, right) => left.authorizedAt.localeCompare(right.authorizedAt))
      .map((row) => this.#view(row));
  }

  activeLearningConsent(
    member: LocalMember,
    studentId: string,
    consentId?: string,
  ): {
    id: string;
    consentVersion: "LEARNING_DEMO_V2";
    policyVersion: "AI_LEARNING_POLICY_SYNTHETIC_V1";
    authorizedAt: string;
  } | null {
    permitted(member, "learning:enable");
    const student = studentForId(studentId);
    if (
      !student ||
      student.tenantId !== member.tenantId ||
      student.campusId !== member.campusId ||
      !member.classIds.includes(student.classId)
    )
      return null;

    const parent = member.profile.startsWith("parent-");
    const teacher = member.profile.startsWith("teacher-");
    if (!parent && !teacher) return null;
    if (
      parent &&
      !this.relationships
        .bindings(member)
        .some(
          (binding) =>
            binding.status === "APPROVED" &&
            binding.relationship === "GUARDIAN" &&
            binding.studentId === student.id,
        )
    )
      return null;

    const row = [...this.#records.values()].find(
      (consent) =>
        consent.status === "ACTIVE" &&
        consent.purposeKey === "LEARNING_SUPPORT" &&
        consent.studentId === student.id &&
        consent.tenantId === student.tenantId &&
        consent.campusId === student.campusId &&
        consent.classId === student.classId &&
        consent.noticeVersion === "LEARNING_SUPPORT_NOTICE_V1" &&
        consent.consentVersion === "LEARNING_DEMO_V2" &&
        consent.policyVersion === "AI_LEARNING_POLICY_SYNTHETIC_V1" &&
        (consentId === undefined || consent.id === consentId) &&
        (!parent || consent.requestedByActorId === member.actorId),
    );
    if (!row) return null;
    return {
      id: row.id,
      consentVersion: "LEARNING_DEMO_V2",
      policyVersion: "AI_LEARNING_POLICY_SYNTHETIC_V1",
      authorizedAt: row.authorizedAt,
    };
  }

  create(member: LocalMember, value: unknown) {
    if (!member.profile.startsWith("parent-")) throw unavailable();
    permitted(member, "consent:manage");
    const body = exactBody(value, ["bindingId", "purposeKey", "noticeVersion", "confirmed"]);
    if (
      typeof body.bindingId !== "string" ||
      !isPurposeKey(body.purposeKey) ||
      typeof body.noticeVersion !== "string" ||
      body.confirmed !== true
    )
      throw invalid();

    const purpose = consentPurposes.find(({ key }) => key === body.purposeKey);
    if (!purpose) throw invalid();
    if (body.noticeVersion !== purpose.noticeVersion) throw conflict();
    const binding = this.relationships
      .bindings(member)
      .find((row) => row.id === body.bindingId && row.status === "APPROVED");
    if (!binding || binding.relationship !== "GUARDIAN") throw unavailable();
    const student = studentForId(binding.studentId);
    if (
      !student ||
      student.tenantId !== member.tenantId ||
      student.campusId !== member.campusId ||
      !member.classIds.includes(student.classId)
    )
      throw unavailable();
    if (
      [...this.#records.values()].some(
        (row) =>
          row.requestedByActorId === member.actorId &&
          row.bindingId === binding.id &&
          row.purposeKey === purpose.key &&
          row.status === "ACTIVE",
      )
    )
      throw conflict();

    const timestamp = new Date(this.now()).toISOString();
    const row: StoredConsent = {
      id: randomUUID(),
      version: 1,
      bindingId: binding.id,
      purposeKey: purpose.key,
      purposeTitle: purpose.title,
      noticeVersion: purpose.noticeVersion,
      consentVersion: purpose.consentVersion,
      policyVersion: purpose.policyVersion,
      necessity: purpose.necessity,
      dataClasses: [...purpose.dataClasses],
      impactReviewStatus: purpose.impactReviewStatus,
      authorizedByActorId: member.actorId,
      authorizedAt: timestamp,
      revokedAt: null,
      retentionDays: purpose.retentionDays,
      retainUntil: new Date(Date.parse(timestamp) + purpose.retentionDays * DAY_MS).toISOString(),
      retentionStatus: "WITHIN_PERIOD",
      status: "ACTIVE",
      dataChanged: false,
      history: [],
      requestedByActorId: member.actorId,
      studentId: student.id,
      tenantId: student.tenantId,
      campusId: student.campusId,
      classId: student.classId,
    };
    this.#recordEvent(row, member, "GRANT");
    this.#records.set(row.id, row);
    return this.#view(row);
  }

  revoke(member: LocalMember, id: string, value: unknown) {
    if (!member.profile.startsWith("parent-")) throw unavailable();
    permitted(member, "consent:manage");
    const body = exactBody(value, ["version"]);
    if (typeof body.version !== "number" || !Number.isInteger(body.version)) throw invalid();
    const row = this.#records.get(id);
    if (!row || row.requestedByActorId !== member.actorId) throw unavailable();
    if (body.version !== row.version) throw conflict();
    if (row.status !== "ACTIVE") throw conflict();
    row.status = "REVOKED";
    row.revokedAt = new Date(this.now()).toISOString();
    this.#recordEvent(row, member, "REVOKE");
    return this.#view(row);
  }

  reviewRetention(member: LocalMember, id: string, value: unknown) {
    if (!member.profile.startsWith("owner-")) throw unavailable();
    permitted(member, "consent:review");
    const body = exactBody(value, ["version", "action"]);
    if (
      typeof body.version !== "number" ||
      !Number.isInteger(body.version) ||
      (body.action !== "REQUIRED_HOLD" && body.action !== "SIMULATE_EXPIRY")
    )
      throw invalid();

    const row = this.#records.get(id);
    if (
      !row ||
      row.tenantId !== member.tenantId ||
      row.campusId !== member.campusId ||
      !member.classIds.includes(row.classId)
    )
      throw unavailable();
    if (body.version !== row.version) throw conflict();
    if (this.#view(row).retentionStatus !== "REVIEW_DUE") throw conflict();
    const action = body.action as Extract<ConsentEventAction, "REQUIRED_HOLD" | "SIMULATE_EXPIRY">;
    row.retentionStatus = action === "REQUIRED_HOLD" ? "REQUIRED_HOLD" : "SIMULATED_EXPIRED";
    this.#recordEvent(row, member, action);
    return this.#view(row);
  }

  #assertMember(member: LocalMember) {
    if (member.profile.startsWith("parent-")) {
      permitted(member, "consent:manage");
      return;
    }
    if (member.profile.startsWith("owner-")) {
      permitted(member, "consent:review");
      return;
    }
    throw unavailable();
  }

  #recordEvent(row: StoredConsent, member: LocalMember, action: ConsentEventAction) {
    if (row.history.length > 0) row.version += 1;
    row.dataChanged = false;
    row.history.push({
      version: row.version,
      action,
      actorId: member.actorId,
      occurredAt: new Date(this.now()).toISOString(),
      dataChanged: false,
    });
  }

  #view(row: StoredConsent): ConsentRecord {
    let retentionStatus = row.retentionStatus;
    if (retentionStatus === "WITHIN_PERIOD" && this.now() >= Date.parse(row.retainUntil))
      retentionStatus = "REVIEW_DUE";
    return {
      id: row.id,
      version: row.version,
      bindingId: row.bindingId,
      purposeKey: row.purposeKey,
      purposeTitle: row.purposeTitle,
      noticeVersion: row.noticeVersion,
      consentVersion: row.consentVersion,
      policyVersion: row.policyVersion,
      necessity: row.necessity,
      dataClasses: [...row.dataClasses],
      impactReviewStatus: row.impactReviewStatus,
      authorizedByActorId: row.authorizedByActorId,
      authorizedAt: row.authorizedAt,
      revokedAt: row.revokedAt,
      retentionDays: row.retentionDays,
      retainUntil: row.retainUntil,
      retentionStatus,
      retentionOutcomeNotice:
        retentionStatus === "SIMULATED_EXPIRED" ? "仅为演示到期状态，尚未删除任何数据。" : null,
      status: row.status as ConsentState,
      dataChanged: false,
      history: structuredClone(row.history),
    };
  }
}
