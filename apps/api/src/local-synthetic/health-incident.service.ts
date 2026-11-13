import { randomUUID } from "node:crypto";
import { exactBody, LocalError } from "./binding-leave.service.js";
import {
  LocalRepository,
  type Binding,
  type HealthIncident,
  type HealthIncidentDispositionCode,
  type HealthIncidentObservationCode,
  type HealthIncidentReceipt,
  type HealthIncidentStatus,
  type HealthIncidentSummaryCode,
  type ScopedRow,
} from "./repository.js";
import {
  memberForActor,
  studentForId,
  studentsForMember,
  type LocalAction,
  type LocalMember,
} from "./sessions.js";

const unavailable = () => new LocalError(403, "UNAVAILABLE");
const invalid = () => new LocalError(400, "INVALID_REQUEST");
const conflict = () => new LocalError(409, "STATE_CONFLICT");

const OBSERVATION_LABELS: Readonly<Record<HealthIncidentObservationCode, string>> = {
  ROUTINE_OBSERVATION: "日常状态观察",
  NEEDS_FOLLOW_UP: "需要跟进",
  URGENT_REVIEW: "需要尽快复核",
};
const DISPOSITION_LABELS: Readonly<Record<HealthIncidentDispositionCode, string>> = {
  OBSERVATION_RECHECKED: "已重新核对观察",
  FOLLOW_UP_SCHEDULED: "已安排跟进",
  GUARDIAN_SUMMARY_PREPARED: "已准备家长摘要",
};
const SUMMARY_LABELS: Readonly<Record<HealthIncidentSummaryCode, string>> = {
  FOLLOW_UP_IN_PROGRESS: "后续跟进正在进行。",
  FOLLOW_UP_COMPLETED: "后续跟进已完成。",
  PLEASE_CHECK_PAGE_LATER: "请稍后查看页面内的更新。",
};
const STATUS_LABELS: Readonly<Record<HealthIncidentStatus, string>> = {
  DRAFT: "草稿",
  SUBMITTED: "待审核",
  RETURNED: "已退回",
  CONFIRMED: "已审核",
  EXCEPTION_PENDING: "需负责人继续跟进",
  PUBLISHED: "已发布",
  REVOKED: "已撤回",
  WITHDRAWN: "作者已撤回",
};
const OBSERVATIONS = Object.keys(OBSERVATION_LABELS) as HealthIncidentObservationCode[];
const DISPOSITIONS = Object.keys(DISPOSITION_LABELS) as HealthIncidentDispositionCode[];
const SUMMARIES = Object.keys(SUMMARY_LABELS) as HealthIncidentSummaryCode[];

function permission(member: LocalMember, action: LocalAction) {
  if (!member.actions.includes(action)) throw unavailable();
}

function scoped(member: LocalMember, row: Pick<ScopedRow, "tenantId" | "campusId" | "classId">) {
  return (
    member.tenantId === row.tenantId &&
    member.campusId === row.campusId &&
    member.classIds.includes(row.classId)
  );
}

function active(member: LocalMember) {
  return member.tenantId.length > 0 && member.campusId.length > 0 && member.classIds.length > 0;
}

function version(row: ScopedRow, value: unknown) {
  if (!Number.isSafeInteger(value) || (value as number) < 1) throw invalid();
  if (row.version !== value) throw conflict();
}

function fixed<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === "string" && values.includes(value as T);
}

function bodyKeys(value: unknown, allowed: readonly string[]) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw invalid();
  const body = value as Record<string, unknown>;
  if (Object.keys(body).some((key) => !allowed.includes(key))) throw invalid();
  return body;
}

function bindingForStudent(
  repository: LocalRepository,
  member: LocalMember,
  studentId: string,
  id?: string,
) {
  const row = id ? repository.get(id) : undefined;
  if (
    row &&
    row.kind === "binding" &&
    row.status === "APPROVED" &&
    row.studentId === studentId &&
    scoped(member, row)
  )
    return row;
  return repository
    .list()
    .find(
      (candidate): candidate is Binding =>
        candidate.kind === "binding" &&
        candidate.status === "APPROVED" &&
        candidate.studentId === studentId &&
        scoped(member, candidate),
    );
}

function parentBinding(repository: LocalRepository, member: LocalMember, row: HealthIncident) {
  const binding = repository.get(row.bindingId);
  return binding &&
    binding.kind === "binding" &&
    binding.status === "APPROVED" &&
    binding.guardianId === member.actorId &&
    binding.studentId === row.studentId &&
    binding.version === row.bindingVersion &&
    scoped(member, binding)
    ? (binding as Binding)
    : undefined;
}

function statusReceipt(repository: LocalRepository, member: LocalMember, row: HealthIncident) {
  return repository.healthIncidentReceipt(member.actorId, row.id, row.version)?.status ?? "UNREAD";
}

function staffView(row: HealthIncident) {
  const student = studentForId(row.studentId);
  if (!student) throw unavailable();
  return {
    id: row.id,
    version: row.version,
    status: row.status,
    statusLabel: STATUS_LABELS[row.status],
    published: row.published,
    tenantId: row.tenantId,
    campusId: row.campusId,
    classId: row.classId,
    studentId: row.studentId,
    studentLabel: student.label,
    bindingId: row.bindingId,
    bindingVersion: row.bindingVersion,
    observationCode: row.observationCode,
    observationLabel: OBSERVATION_LABELS[row.observationCode],
    dispositionCode: row.dispositionCode,
    dispositionLabel: row.dispositionCode ? DISPOSITION_LABELS[row.dispositionCode] : null,
    summaryCode: row.summaryCode,
    reviewedBy: row.reviewedBy,
    createdBy: row.createdBy,
    createdByLabel: memberForActor(row.createdBy)?.label ?? "示例员工",
    updatedAt: row.updatedAt,
    synthetic: true as const,
  };
}

function parentView(repository: LocalRepository, member: LocalMember, row: HealthIncident) {
  const receiptStatus = statusReceipt(repository, member, row);
  const summary = row.summaryCode ? SUMMARY_LABELS[row.summaryCode] : "机构已发布固定跟进摘要。";
  return {
    id: row.id,
    version: row.version,
    status: "PUBLISHED" as const,
    published: true as const,
    studentId: row.studentId,
    bindingId: row.bindingId,
    bindingVersion: row.bindingVersion,
    date: row.updatedAt.slice(0, 10),
    title: "机构已发布健康跟进摘要",
    parentSummary: summary,
    processingStatus:
      row.dispositionCode === "GUARDIAN_SUMMARY_PREPARED"
        ? ("PROCESSED" as const)
        : ("PROCESSING" as const),
    receiptStatus,
    publicationStatus: "PUBLISHED" as const,
    parentVisible: true as const,
    availability: "ENABLED" as const,
    source: "LOCAL_SYNTHETIC" as const,
    synthetic: true as const,
  };
}

export class HealthIncidentService {
  constructor(
    private readonly repository: LocalRepository,
    private readonly now: () => number = Date.now,
  ) {}

  listStudents(member: LocalMember) {
    if (!active(member)) throw unavailable();
    permission(member, "health:create");
    return studentsForMember(member)
      .filter((student) => bindingForStudent(this.repository, member, student.id) !== undefined)
      .map((student) => ({
        id: student.id,
        studentLabel: student.label,
        synthetic: true as const,
      }));
  }

  listDrafts(member: LocalMember) {
    const eligibleStudentIds = new Set(this.listStudents(member).map(({ id }) => id));
    return this.repository
      .list()
      .filter((row): row is HealthIncident => row.kind === "healthIncident")
      .filter(
        (row) =>
          row.status === "DRAFT" &&
          row.createdBy === member.actorId &&
          scoped(member, row) &&
          eligibleStudentIds.has(row.studentId),
      )
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map((row) => ({
        id: row.id,
        version: row.version,
        status: "DRAFT" as const,
        statusLabel: STATUS_LABELS.DRAFT,
        studentId: row.studentId,
        observationCode: row.observationCode,
        dispositionCode: row.dispositionCode,
        synthetic: true as const,
      }));
  }

  owned(member: LocalMember) {
    if (!active(member)) throw unavailable();
    permission(member, "health:create");
    return this.repository
      .list()
      .filter((row): row is HealthIncident => row.kind === "healthIncident")
      .filter((row) => row.createdBy === member.actorId && scoped(member, row))
      .map(staffView);
  }

  reviewQueue(member: LocalMember) {
    permission(member, "health:review");
    return this.repository
      .list()
      .filter((row): row is HealthIncident => row.kind === "healthIncident")
      .filter(
        (row) =>
          ["SUBMITTED", "EXCEPTION_PENDING", "CONFIRMED", "PUBLISHED"].includes(row.status) &&
          scoped(member, row),
      )
      .map(staffView);
  }

  parentList(member: LocalMember) {
    permission(member, "health:read");
    return this.repository
      .list()
      .filter((row): row is HealthIncident => row.kind === "healthIncident")
      .filter(
        (row) =>
          row.status === "PUBLISHED" &&
          row.published &&
          parentBinding(this.repository, member, row),
      )
      .map((row) => parentView(this.repository, member, row));
  }

  create(member: LocalMember, body: unknown) {
    permission(member, "health:create");
    const data = bodyKeys(body, ["bindingId", "student", "observationCode", "dispositionCode"]);
    if (
      typeof data.student !== "string" ||
      !fixed(data.observationCode, OBSERVATIONS) ||
      !fixed(data.dispositionCode, DISPOSITIONS)
    )
      throw unavailable();
    const student = studentsForMember(member).find(
      (candidate) => candidate.alias === data.student || candidate.id === data.student,
    );
    if (!student) throw unavailable();
    const binding = bindingForStudent(
      this.repository,
      member,
      student.id,
      typeof data.bindingId === "string" ? data.bindingId : undefined,
    );
    if (!binding) throw unavailable();
    const row: HealthIncident = {
      id: randomUUID(),
      version: 1,
      kind: "healthIncident",
      tenantId: student.tenantId,
      campusId: student.campusId,
      classId: student.classId,
      bindingId: binding.id,
      bindingVersion: binding.version,
      studentId: student.id,
      observationCode: data.observationCode,
      dispositionCode: data.dispositionCode,
      summaryCode: null,
      status: "DRAFT",
      published: false,
      createdBy: member.actorId,
      reviewedBy: null,
      updatedBy: member.actorId,
      updatedAt: new Date(this.now()).toISOString(),
    };
    this.repository.insert(row);
    this.audit(member, row, "health.create");
    return staffView(row);
  }

  submit(member: LocalMember, id: string, body: unknown) {
    permission(member, "health:submit");
    const data = exactBody(body, ["version"]);
    const row = this.ownedRow(member, id);
    version(row, data.version);
    if (row.status !== "DRAFT" && row.status !== "RETURNED") throw conflict();
    const next = this.change(member, row, {
      status: "SUBMITTED",
      published: false,
      summaryCode: null,
      reviewedBy: null,
    });
    return staffView(next);
  }

  edit(member: LocalMember, id: string, body: unknown) {
    permission(member, "health:create");
    const data = exactBody(body, ["version", "observationCode", "dispositionCode"]);
    if (!fixed(data.observationCode, OBSERVATIONS) || !fixed(data.dispositionCode, DISPOSITIONS))
      throw invalid();
    const row = this.ownedRow(member, id);
    version(row, data.version);
    if (row.status !== "DRAFT" && row.status !== "RETURNED") throw conflict();
    return staffView(
      this.change(member, row, {
        status: "DRAFT",
        observationCode: data.observationCode,
        dispositionCode: data.dispositionCode,
        summaryCode: null,
        published: false,
        reviewedBy: null,
      }),
    );
  }

  withdraw(member: LocalMember, id: string, body: unknown) {
    permission(member, "health:submit");
    const data = exactBody(body, ["version"]);
    const row = this.ownedRow(member, id);
    version(row, data.version);
    if (!["DRAFT", "SUBMITTED", "RETURNED"].includes(row.status)) throw conflict();
    const next = this.change(member, row, {
      status: "WITHDRAWN",
      published: false,
      summaryCode: null,
      reviewedBy: null,
    });
    this.repository.clearHealthIncidentReceipts(row.id);
    return staffView(next);
  }

  review(member: LocalMember, id: string, body: unknown) {
    permission(member, "health:review");
    const data = exactBody(body, ["version", "action"]);
    if (data.action !== "CONFIRM" && data.action !== "RETURN" && data.action !== "ESCALATE")
      throw invalid();
    const row = this.visibleStaffRow(member, id);
    version(row, data.version);
    if (
      data.action === "ESCALATE"
        ? row.status !== "SUBMITTED"
        : row.status !== "SUBMITTED" && row.status !== "EXCEPTION_PENDING"
    )
      throw conflict();
    const next = this.change(member, row, {
      status:
        data.action === "CONFIRM"
          ? "CONFIRMED"
          : data.action === "RETURN"
            ? "RETURNED"
            : "EXCEPTION_PENDING",
      published: false,
      summaryCode: null,
      reviewedBy: member.actorId,
    });
    return staffView(next);
  }

  supplement(member: LocalMember, id: string, body: unknown) {
    permission(member, "health:supplement");
    const data = exactBody(body, ["version", "dispositionCode"]);
    if (!fixed(data.dispositionCode, DISPOSITIONS)) throw invalid();
    const row = this.visibleStaffRow(member, id);
    version(row, data.version);
    if (row.status !== "CONFIRMED" && row.status !== "PUBLISHED") throw conflict();
    const next = this.change(member, row, {
      status: "CONFIRMED",
      published: false,
      dispositionCode: data.dispositionCode,
      summaryCode: null,
      reviewedBy: member.actorId,
    });
    this.repository.clearHealthIncidentReceipts(row.id);
    return staffView(next);
  }

  publish(member: LocalMember, id: string, body: unknown) {
    permission(member, "health:publish");
    const data = exactBody(body, ["version", "summaryCode"]);
    if (!fixed(data.summaryCode, SUMMARIES)) throw invalid();
    const row = this.visibleStaffRow(member, id);
    version(row, data.version);
    if (row.status !== "CONFIRMED" && row.status !== "PUBLISHED") throw conflict();
    const next = this.change(member, row, {
      status: "PUBLISHED",
      published: true,
      summaryCode: data.summaryCode,
      reviewedBy: member.actorId,
    });
    this.repository.clearHealthIncidentReceipts(row.id, next.version);
    return staffView(next);
  }

  revoke(member: LocalMember, id: string, body: unknown) {
    permission(member, "health:revoke");
    const data = exactBody(body, ["version"]);
    const row = this.visibleStaffRow(member, id);
    version(row, data.version);
    if (row.status !== "PUBLISHED") throw conflict();
    const next = this.change(member, row, {
      status: "REVOKED",
      published: false,
      summaryCode: null,
      reviewedBy: member.actorId,
    });
    this.repository.clearHealthIncidentReceipts(row.id);
    return staffView(next);
  }

  read(member: LocalMember, id: string, body: unknown) {
    permission(member, "health:read");
    const data = exactBody(body, ["version"]);
    const row = this.visibleParentRow(member, id);
    version(row, data.version);
    const current = this.repository.healthIncidentReceipt(member.actorId, row.id, row.version);
    if (!current) {
      const receipt: HealthIncidentReceipt = {
        guardianId: member.actorId,
        incidentId: row.id,
        version: row.version,
        status: "READ",
      };
      this.repository.setHealthIncidentReceipt(receipt);
    }
    this.audit(member, row, "health.read");
    return {
      ...parentView(this.repository, member, row),
      receiptStatus:
        this.repository.healthIncidentReceipt(member.actorId, row.id, row.version)?.status ??
        "READ",
    };
  }

  ack(member: LocalMember, id: string, body: unknown) {
    permission(member, "health:ack");
    const data = exactBody(body, ["version"]);
    const row = this.visibleParentRow(member, id);
    version(row, data.version);
    const current = this.repository.healthIncidentReceipt(member.actorId, row.id, row.version);
    if (!current) throw conflict();
    if (current.status !== "ACKNOWLEDGED")
      this.repository.setHealthIncidentReceipt({ ...current, status: "ACKNOWLEDGED" });
    this.audit(member, row, "health.ack");
    return { ...parentView(this.repository, member, row), receiptStatus: "ACKNOWLEDGED" as const };
  }

  denied(member: LocalMember, action: string, objectId?: string) {
    const row = objectId ? this.repository.get(objectId) : undefined;
    this.repository.audit({
      actorId: member.actorId,
      objectId: row && scoped(member, row) ? row.id : null,
      version: null,
      action,
      outcome: "DENIED",
      at: new Date(this.now()).toISOString(),
      tenantId: member.tenantId,
      campusId: member.campusId,
    });
  }

  private visibleStaffRow(member: LocalMember, id: string) {
    const row = this.repository.get(id);
    if (!row || row.kind !== "healthIncident" || !scoped(member, row)) throw unavailable();
    return row as HealthIncident;
  }
  private ownedRow(member: LocalMember, id: string) {
    const row = this.visibleStaffRow(member, id);
    if (row.createdBy !== member.actorId) throw unavailable();
    return row;
  }
  private visibleParentRow(member: LocalMember, id: string) {
    const row = this.visibleStaffRow(member, id);
    if (
      row.status !== "PUBLISHED" ||
      !row.published ||
      !parentBinding(this.repository, member, row)
    )
      throw unavailable();
    return row;
  }
  private change(member: LocalMember, row: HealthIncident, changes: Partial<HealthIncident>) {
    const next: HealthIncident = {
      ...row,
      ...changes,
      version: row.version + 1,
      updatedBy: member.actorId,
      updatedAt: new Date(this.now()).toISOString(),
    };
    if (!this.repository.replaceBatch([next])) throw conflict();
    this.audit(member, next, `health.${String(changes.status ?? "update").toLowerCase()}`);
    return next;
  }
  private audit(member: LocalMember, row: HealthIncident, action: string) {
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
