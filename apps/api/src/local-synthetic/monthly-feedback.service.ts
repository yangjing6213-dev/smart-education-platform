import { randomUUID } from "node:crypto";
import { exactBody, LocalError } from "./binding-leave.service.js";
import {
  LocalRepository,
  type Binding,
  type MonthlyFeedback,
  type MonthlyFeedbackSource,
  type MonthlyFeedbackSourceKind,
  type MonthlyFeedbackSourceSummary,
  type MonthlyFeedbackSupplements,
  type MonthlyFeedbackSupplementCode,
} from "./repository.js";
import { memberForActor, type LocalAction, type LocalMember } from "./sessions.js";

const unavailable = () => new LocalError(403, "UNAVAILABLE");
const invalid = () => new LocalError(400, "INVALID_REQUEST");
const conflict = () => new LocalError(409, "STATE_CONFLICT");

const SUPPLEMENT_CODES: readonly MonthlyFeedbackSupplementCode[] = [
  "KEEP_WATCHING",
  "PROGRESSING",
  "FOLLOW_UP",
];
const SUPPLEMENT_FIELDS: readonly (keyof MonthlyFeedbackSupplements)[] = [
  "learningParticipation",
  "dailyHabits",
  "activityParticipation",
  "familySchoolCollaboration",
];
const SOURCES: readonly MonthlyFeedbackSourceKind[] = [
  "GROWTH_RECORD",
  "ATTENDANCE_OVERVIEW",
  "STAFF_DAILY",
];
const SOURCE_LABELS: Readonly<Record<MonthlyFeedbackSource["kind"], string>> = {
  GROWTH_RECORD: "已发布成长记录",
  ATTENDANCE_OVERVIEW: "已确认考勤概览",
  STAFF_DAILY: "已确认工作日报",
};
const SUPPLEMENT_LABELS: Readonly<Record<keyof MonthlyFeedbackSupplements, string>> = {
  learningParticipation: "学习参与",
  dailyHabits: "日常习惯",
  activityParticipation: "活动参与",
  familySchoolCollaboration: "家校协作",
};

function permission(member: LocalMember, action: LocalAction) {
  if (!member.actions.includes(action)) throw unavailable();
}

function scoped(
  member: LocalMember,
  row: Pick<MonthlyFeedback, "tenantId" | "campusId" | "classId">,
) {
  return (
    member.tenantId === row.tenantId &&
    member.campusId === row.campusId &&
    member.classIds.includes(row.classId)
  );
}

function expected(row: MonthlyFeedback, version: unknown) {
  if (!Number.isSafeInteger(version) || (version as number) < 1) throw invalid();
  if (row.version !== version) throw conflict();
}

function body(value: unknown, allowed: readonly string[]) {
  return exactBody(value, allowed);
}

function validMonth(value: unknown): value is string {
  if (typeof value !== "string" || !/^202[6-9]-(?:0[1-9]|1[0-2])$/.test(value)) return false;
  const [year, month] = value.split("-").map(Number);
  return year !== undefined && month !== undefined && year >= 2026 && month >= 1 && month <= 12;
}

function supplements(value: unknown): MonthlyFeedbackSupplements {
  const data = body(value, SUPPLEMENT_FIELDS);
  if (
    SUPPLEMENT_FIELDS.some(
      (field) =>
        typeof data[field] !== "string" ||
        !SUPPLEMENT_CODES.includes(data[field] as MonthlyFeedbackSupplementCode),
    )
  )
    throw invalid();
  return structuredClone(data) as unknown as MonthlyFeedbackSupplements;
}

function staffView(row: MonthlyFeedback) {
  const { sources, ...safeRow } = structuredClone(row);
  return {
    ...safeRow,
    authorLabel: memberForActor(row.createdBy)?.label ?? "示例教师",
    reviewerLabel: row.reviewedBy ? (memberForActor(row.reviewedBy)?.label ?? "示例负责人") : null,
    sourceSummary: sourceSummary(sources),
    synthetic: true as const,
  };
}

function sourceSummary(sources: readonly MonthlyFeedbackSource[]): MonthlyFeedbackSourceSummary[] {
  return SOURCES.map((kind) => {
    const refs = sources.filter((source) => source.kind === kind);
    return {
      kind,
      label: SOURCE_LABELS[kind],
      count: refs.length,
      dates: [...new Set(refs.map((source) => source.date))].sort(),
    };
  });
}

function parentBinding(repository: LocalRepository, member: LocalMember, row: MonthlyFeedback) {
  return repository
    .list()
    .some(
      (candidate): candidate is Binding =>
        candidate.kind === "binding" &&
        candidate.status === "APPROVED" &&
        candidate.guardianId === member.actorId &&
        scoped(member, row) &&
        candidate.tenantId === row.tenantId &&
        candidate.campusId === row.campusId &&
        candidate.classId === row.classId,
    );
}

export class MonthlyFeedbackService {
  constructor(
    private readonly repository: LocalRepository,
    private readonly now: () => number = Date.now,
  ) {}

  list(member: LocalMember) {
    permission(member, "feedback:read");
    const reviewer = member.actions.includes("feedback:review");
    return this.repository
      .list()
      .filter((row): row is MonthlyFeedback => row.kind === "monthlyFeedback")
      .filter((row) => scoped(member, row) && (reviewer || row.createdBy === member.actorId))
      .map((row) => staffView(this.sync(row, member)));
  }

  reviewQueue(member: LocalMember) {
    permission(member, "feedback:review");
    return this.repository
      .list()
      .filter((row): row is MonthlyFeedback => row.kind === "monthlyFeedback")
      .filter((row) => scoped(member, row))
      .map((row) => this.sync(row, member))
      .filter(
        (row) =>
          row.status === "SUBMITTED" ||
          row.status === "CONFIRMED" ||
          row.status === "PUBLISHED" ||
          row.status === "REVIEW_REQUIRED",
      )
      .map(staffView);
  }

  get(member: LocalMember, id: string) {
    permission(member, "feedback:read");
    const row = member.actions.includes("feedback:ack")
      ? this.rawRow(member, id)
      : this.staffRow(member, id);
    if (member.actions.includes("feedback:ack")) return this.parentView(member, row);
    return staffView(this.sync(row, member));
  }

  parentList(member: LocalMember) {
    permission(member, "feedback:read");
    return this.repository
      .list()
      .filter((row): row is MonthlyFeedback => row.kind === "monthlyFeedback")
      .filter(
        (row) =>
          ((row.status === "PUBLISHED" && row.published) || row.status === "REVIEW_REQUIRED") &&
          scoped(member, row) &&
          parentBinding(this.repository, member, row),
      )
      .map((row) => this.parentView(member, row));
  }

  create(member: LocalMember, value: unknown) {
    permission(member, "feedback:create");
    const data = body(value, ["month", "supplements"]);
    if (!validMonth(data.month) || member.classIds.length !== 1) throw invalid();
    const feedback = supplements(data.supplements);
    if (
      this.repository
        .list()
        .some(
          (row) =>
            row.kind === "monthlyFeedback" &&
            row.createdBy === member.actorId &&
            row.month === data.month,
        )
    )
      throw conflict();
    const sourceVersion = 1;
    const currentSources = this.sources(member, data.month);
    const row: MonthlyFeedback = {
      id: randomUUID(),
      version: 1,
      kind: "monthlyFeedback",
      tenantId: member.tenantId,
      campusId: member.campusId,
      classId: member.classIds[0]!,
      month: data.month,
      sourceVersion,
      sources: currentSources,
      supplements: feedback,
      status: "DRAFT",
      createdBy: member.actorId,
      reviewedBy: null,
      published: false,
      parentAcknowledgedBy: [],
      updatedBy: member.actorId,
      updatedAt: new Date(this.now()).toISOString(),
    };
    this.repository.insert(row);
    this.audit(member, row, "feedback.create");
    return staffView(row);
  }

  edit(member: LocalMember, id: string, value: unknown) {
    permission(member, "feedback:create");
    const data = body(value, ["version", "supplements"]);
    const row = this.sync(this.owned(member, id), member);
    expected(row, data.version);
    if (!["DRAFT", "RETURNED", "REVIEW_REQUIRED"].includes(row.status)) throw conflict();
    return this.change(member, row, "feedback.edit", {
      supplements: supplements(data.supplements),
      sources: this.sources(member, row.month),
      status: "DRAFT",
      reviewedBy: null,
      published: false,
      parentAcknowledgedBy: [],
    });
  }

  submit(member: LocalMember, id: string, value: unknown) {
    permission(member, "feedback:submit");
    const data = body(value, ["version"]);
    const row = this.sync(this.owned(member, id), member);
    expected(row, data.version);
    if (row.status !== "DRAFT") throw conflict();
    return this.change(member, row, "feedback.submit", { status: "SUBMITTED" });
  }

  resubmit(member: LocalMember, id: string, value: unknown) {
    permission(member, "feedback:submit");
    const data = body(value, ["version", "supplements"]);
    const row = this.sync(this.owned(member, id), member);
    expected(row, data.version);
    if (row.status !== "RETURNED") throw conflict();
    return this.change(member, row, "feedback.resubmit", {
      supplements: supplements(data.supplements),
      status: "SUBMITTED",
      reviewedBy: null,
      published: false,
      parentAcknowledgedBy: [],
    });
  }

  review(member: LocalMember, id: string, value: unknown) {
    permission(member, "feedback:review");
    const data = body(value, ["version", "action"]);
    if (data.action !== "CONFIRM" && data.action !== "RETURN") throw invalid();
    const row = this.sync(this.staffRow(member, id), member);
    expected(row, data.version);
    if (
      (data.action === "CONFIRM" && row.status !== "SUBMITTED") ||
      (data.action === "RETURN" && row.status !== "SUBMITTED" && row.status !== "CONFIRMED")
    )
      throw conflict();
    return this.change(member, row, `feedback.${String(data.action).toLowerCase()}`, {
      status: data.action === "CONFIRM" ? "CONFIRMED" : "RETURNED",
      reviewedBy: member.actorId,
      published: false,
      parentAcknowledgedBy: [],
    });
  }

  publish(member: LocalMember, id: string, value: unknown) {
    permission(member, "feedback:publish");
    const data = body(value, ["version"]);
    const row = this.sync(this.staffRow(member, id), member);
    expected(row, data.version);
    if (row.status !== "CONFIRMED") throw conflict();
    return this.change(member, row, "feedback.publish", { status: "PUBLISHED", published: true });
  }

  sourceRefresh(member: LocalMember, id: string, value: unknown) {
    permission(member, "feedback:review");
    const data = body(value, ["version"]);
    const row = this.staffRow(member, id);
    expected(row, data.version);
    return staffView(this.sync(row, member));
  }

  ack(member: LocalMember, id: string, value: unknown) {
    permission(member, "feedback:ack");
    const data = body(value, ["version"]);
    const row = this.visibleParentRow(member, id);
    expected(row, data.version);
    if (row.status !== "PUBLISHED" || !row.published) throw conflict();
    if (!row.parentAcknowledgedBy.includes(member.actorId)) {
      return this.change(member, row, "feedback.ack", {
        parentAcknowledgedBy: [...row.parentAcknowledgedBy, member.actorId],
      });
    }
    return this.parentView(member, row);
  }

  denied(member: LocalMember, action: string, id: string) {
    const row = id ? this.repository.get(id) : undefined;
    this.repository.audit({
      actorId: member.actorId,
      objectId: row && scoped(member, row as MonthlyFeedback) ? row.id : null,
      version: null,
      action,
      outcome: "DENIED",
      at: new Date(this.now()).toISOString(),
      tenantId: member.tenantId,
      campusId: member.campusId,
    });
  }

  private sources(member: LocalMember, month: string): MonthlyFeedbackSource[] {
    const scopedSource = (row: { tenantId: string; campusId: string; classId: string }) =>
      row.tenantId === member.tenantId &&
      row.campusId === member.campusId &&
      member.classIds.includes(row.classId);
    const rows = this.repository.list();
    const sources = rows.flatMap((row): MonthlyFeedbackSource[] => {
      if (!scopedSource(row) || !("date" in row) || !row.date.startsWith(`${month}-`)) return [];
      if (row.kind === "care" && row.status === "CONFIRMED" && row.published)
        return [{ kind: "GROWTH_RECORD", id: row.id, version: row.version, date: row.date }];
      if (
        row.kind === "attendance" &&
        (row.status === "ARRIVED" || row.status === "DEPARTED") &&
        row.correction?.status !== "PENDING"
      )
        return [{ kind: "ATTENDANCE_OVERVIEW", id: row.id, version: row.version, date: row.date }];
      if (row.kind === "staffDaily" && row.status === "CONFIRMED")
        return [{ kind: "STAFF_DAILY", id: row.id, version: row.version, date: row.date }];
      return [];
    });
    return sources.sort(
      (left, right) =>
        SOURCES.indexOf(left.kind) - SOURCES.indexOf(right.kind) ||
        left.date.localeCompare(right.date) ||
        left.id.localeCompare(right.id),
    );
  }

  private sync(row: MonthlyFeedback, member: LocalMember) {
    const current = this.sources(member, row.month);
    if (JSON.stringify(row.sources) === JSON.stringify(current)) return row;
    const invalidatesPublished = row.status === "PUBLISHED" && row.published;
    const next: MonthlyFeedback = {
      ...row,
      version: row.version + 1,
      sourceVersion: row.sourceVersion + 1,
      sources: current,
      status:
        invalidatesPublished || row.status === "REVIEW_REQUIRED" ? "REVIEW_REQUIRED" : row.status,
      published: invalidatesPublished ? false : row.published,
      parentAcknowledgedBy: invalidatesPublished ? [] : row.parentAcknowledgedBy,
      updatedBy: member.actorId,
      updatedAt: new Date(this.now()).toISOString(),
    };
    if (!this.repository.replaceBatch([next])) throw conflict();
    this.audit(
      member,
      next,
      invalidatesPublished ? "feedback.source-invalidated" : "feedback.sources-updated",
    );
    return next;
  }

  private staffRow(member: LocalMember, id: string) {
    const row = this.rawRow(member, id);
    if (!member.actions.includes("feedback:review") && row.createdBy !== member.actorId)
      throw unavailable();
    return row;
  }

  private rawRow(member: LocalMember, id: string) {
    const row = this.repository.get(id);
    if (!row || row.kind !== "monthlyFeedback" || !scoped(member, row)) throw unavailable();
    return row;
  }

  private owned(member: LocalMember, id: string) {
    const row = this.staffRow(member, id);
    if (row.createdBy !== member.actorId) throw unavailable();
    return row;
  }

  private visibleParentRow(member: LocalMember, id: string) {
    const row = this.rawRow(member, id);
    const current = this.sync(row, member);
    if (
      (current.status !== "PUBLISHED" && current.status !== "REVIEW_REQUIRED") ||
      !parentBinding(this.repository, member, current)
    )
      throw unavailable();
    return current;
  }

  private parentView(member: LocalMember, row: MonthlyFeedback) {
    const current = this.sync(row, member);
    const valid = current.status === "PUBLISHED" && current.published;
    return {
      id: current.id,
      version: current.version,
      month: current.month,
      status: valid ? ("PUBLISHED" as const) : ("REVIEW_REQUIRED" as const),
      items: valid
        ? SUPPLEMENT_FIELDS.map((field) => ({
            label: SUPPLEMENT_LABELS[field],
            value: current.supplements[field],
          }))
        : [],
      acknowledged: current.parentAcknowledgedBy.includes(member.actorId),
      synthetic: true as const,
    };
  }

  private change(
    member: LocalMember,
    row: MonthlyFeedback,
    action: string,
    patch: Partial<
      Pick<
        MonthlyFeedback,
        | "supplements"
        | "sourceVersion"
        | "sources"
        | "status"
        | "reviewedBy"
        | "published"
        | "parentAcknowledgedBy"
      >
    >,
  ) {
    const next: MonthlyFeedback = {
      ...row,
      ...patch,
      version: row.version + 1,
      updatedBy: member.actorId,
      updatedAt: new Date(this.now()).toISOString(),
    };
    if (!this.repository.replaceBatch([next])) throw conflict();
    this.audit(member, next, action);
    return member.actions.includes("feedback:ack")
      ? this.parentView(member, next)
      : staffView(next);
  }

  private audit(member: LocalMember, row: MonthlyFeedback, action: string) {
    this.repository.audit({
      actorId: member.actorId,
      objectId: row.id,
      version: row.version,
      action,
      outcome: "ACCEPTED",
      at: new Date(this.now()).toISOString(),
      tenantId: row.tenantId,
      campusId: row.campusId,
    });
  }
}
