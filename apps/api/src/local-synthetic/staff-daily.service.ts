import { randomUUID } from "node:crypto";
import { exactBody, LocalError } from "./binding-leave.service.js";
import {
  LocalRepository,
  type StaffDailyReport,
  type StaffDailySourceKind,
  type StaffDailySourceReference,
  type StaffDailyValues,
} from "./repository.js";
import { memberForActor, type LocalAction, type LocalMember } from "./sessions.js";
import type { StaffDailyLearningSummary } from "./learning-session.service.js";
import type { StaffDailyAuditEvent } from "@student-care/contracts";

const unavailable = () => new LocalError(403, "UNAVAILABLE");
const invalid = () => new LocalError(400, "INVALID_REQUEST");
const conflict = () => new LocalError(409, "STATE_CONFLICT");

const OPTIONS = {
  arrival: ["ARRIVED_AS_PLANNED", "LATE", "ABSENT"],
  homework: ["COMPLETED", "IN_PROGRESS", "NEEDS_SUPPORT"],
  activity: ["PARTICIPATED", "OBSERVED", "NOT_RECORDED"],
  classroom: ["ROUTINE", "NEEDS_ATTENTION", "NEEDS_FOLLOW_UP"],
  followUp: ["NONE", "OBSERVE_TOMORROW", "OWNER_ATTENTION"],
} as const;
const SOURCE_ORDER: Readonly<Record<StaffDailySourceKind, number>> = {
  TASK: 0,
  ATTENDANCE: 1,
  CARE_RECORD: 2,
  PICKUP: 3,
  PICKUP_EXCEPTION: 4,
};
const AUDIT_ACTIONS = {
  "daily.create": "CREATED",
  "daily.edit": "EDITED",
  "daily.submit": "SUBMITTED",
  "daily.resubmit": "RESUBMITTED",
  "daily.confirm": "REVIEW_CONFIRMED",
  "daily.return": "REVIEW_RETURNED",
  "daily.withdraw": "CONFIRMATION_WITHDRAWN",
} as const satisfies Readonly<Record<string, StaffDailyAuditEvent["action"]>>;

function permission(member: LocalMember, action: LocalAction) {
  if (!member.actions.includes(action)) throw unavailable();
}

function scoped(
  member: LocalMember,
  row: Pick<StaffDailyReport, "tenantId" | "campusId" | "classId">,
) {
  return (
    member.tenantId === row.tenantId &&
    member.campusId === row.campusId &&
    member.classIds.includes(row.classId)
  );
}

function expected(row: StaffDailyReport, version: unknown) {
  if (!Number.isSafeInteger(version) || (version as number) < 1) throw invalid();
  if (row.version !== version) throw conflict();
}

function validDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^202[6-9]-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}

function values(value: unknown): StaffDailyValues {
  const data = exactBody(value, ["arrival", "homework", "activity", "classroom", "followUp"]);
  const fields = Object.keys(OPTIONS) as (keyof StaffDailyValues)[];
  if (fields.some((field) => !OPTIONS[field].includes(data[field] as never))) throw invalid();
  return structuredClone(data) as unknown as StaffDailyValues;
}

function staffView(row: StaffDailyReport) {
  return {
    ...structuredClone(row),
    authorLabel: memberForActor(row.createdBy)?.label ?? "示例教师",
    reviewerLabel: row.reviewedBy ? (memberForActor(row.reviewedBy)?.label ?? "示例负责人") : null,
    synthetic: true as const,
  };
}

export class StaffDailyService {
  constructor(
    private readonly repository: LocalRepository,
    private readonly now: () => number = Date.now,
    private readonly learningSummary: (
      date: string,
      tenantId: string,
      campusId: string,
      classId: string,
    ) => StaffDailyLearningSummary | null = () => null,
  ) {}

  private view(row: StaffDailyReport) {
    return {
      ...staffView(row),
      learningSummary: this.learningSummary(row.date, row.tenantId, row.campusId, row.classId),
    };
  }

  list(member: LocalMember) {
    permission(member, "daily:read");
    const broadScope = member.actions.includes("daily:review");
    return this.repository
      .list()
      .filter((row): row is StaffDailyReport => row.kind === "staffDaily")
      .filter((row) => scoped(member, row) && (broadScope || row.createdBy === member.actorId))
      .map((row) => this.view(row));
  }

  auditEvents(member: LocalMember, id: string): readonly StaffDailyAuditEvent[] {
    permission(member, "daily:review");
    const row = this.staffRow(member, id);
    if (row.createdBy === member.actorId) throw unavailable();
    return this.repository
      .audits()
      .filter(
        (event) =>
          event.outcome === "ACCEPTED" &&
          event.objectId === id &&
          event.version !== null &&
          event.tenantId === row.tenantId &&
          event.campusId === row.campusId &&
          event.action in AUDIT_ACTIONS,
      )
      .sort((left, right) => (left.version ?? 0) - (right.version ?? 0))
      .map((event) => {
        const label = memberForActor(event.actorId)?.label ?? "机构成员";
        return {
          action: AUDIT_ACTIONS[event.action as keyof typeof AUDIT_ACTIONS],
          reportVersion: event.version ?? 0,
          actorLabel: label,
          initiatedByLabel: label,
          occurredAt: event.at,
        };
      });
  }

  get(member: LocalMember, id: string) {
    permission(member, "daily:read");
    return this.view(this.staffRow(member, id));
  }

  reviewQueue(member: LocalMember) {
    permission(member, "daily:review");
    return this.repository
      .list()
      .filter((row): row is StaffDailyReport => row.kind === "staffDaily")
      .filter((row) => scoped(member, row) && row.status === "SUBMITTED")
      .map((row) => this.view(row));
  }

  create(member: LocalMember, body: unknown) {
    permission(member, "daily:create");
    const data = exactBody(body, ["date", "values"]);
    if (!validDate(data.date) || member.classIds.length !== 1) throw invalid();
    const reportValues = values(data.values);
    if (
      this.repository
        .list()
        .some(
          (row) =>
            row.kind === "staffDaily" && row.createdBy === member.actorId && row.date === data.date,
        )
    )
      throw conflict();
    const row: StaffDailyReport = {
      id: randomUUID(),
      version: 1,
      kind: "staffDaily",
      tenantId: member.tenantId,
      campusId: member.campusId,
      classId: member.classIds[0]!,
      date: data.date,
      values: reportValues,
      sourceRefs: this.sourceRefs(member, data.date),
      status: "DRAFT",
      createdBy: member.actorId,
      reviewedBy: null,
      updatedBy: member.actorId,
      updatedAt: new Date(this.now()).toISOString(),
    };
    this.repository.insert(row);
    this.audit(member, row, "daily.create");
    return this.view(row);
  }

  edit(member: LocalMember, id: string, body: unknown) {
    permission(member, "daily:create");
    const data = exactBody(body, ["version", "values"]);
    const row = this.owned(member, id);
    expected(row, data.version);
    if (row.status !== "DRAFT" && row.status !== "RETURNED") throw conflict();
    return this.change(member, row, "daily.edit", {
      values: values(data.values),
      sourceRefs: this.sourceRefs(member, row.date),
      status: "DRAFT",
      reviewedBy: null,
    });
  }

  submit(member: LocalMember, id: string, body: unknown) {
    permission(member, "daily:submit");
    const data = exactBody(body, ["version"]);
    const row = this.owned(member, id);
    expected(row, data.version);
    if (row.status !== "DRAFT") throw conflict();
    return this.change(member, row, "daily.submit", { status: "SUBMITTED" });
  }

  resubmit(member: LocalMember, id: string, body: unknown) {
    permission(member, "daily:submit");
    const data = exactBody(body, ["version", "values"]);
    const row = this.owned(member, id);
    expected(row, data.version);
    if (row.status !== "RETURNED") throw conflict();
    return this.change(member, row, "daily.resubmit", {
      values: values(data.values),
      sourceRefs: this.sourceRefs(member, row.date),
      status: "SUBMITTED",
      reviewedBy: null,
    });
  }

  review(member: LocalMember, id: string, body: unknown) {
    permission(member, "daily:review");
    const data = exactBody(body, ["version", "action"]);
    if (data.action !== "CONFIRM" && data.action !== "RETURN") throw invalid();
    const row = this.staffRow(member, id);
    if (row.createdBy === member.actorId) throw unavailable();
    expected(row, data.version);
    if (
      (data.action === "CONFIRM" && row.status !== "SUBMITTED") ||
      (data.action === "RETURN" && row.status !== "SUBMITTED" && row.status !== "CONFIRMED")
    )
      throw conflict();
    return this.change(member, row, `daily.${String(data.action).toLowerCase()}`, {
      status: data.action === "CONFIRM" ? "CONFIRMED" : "RETURNED",
      reviewedBy: member.actorId,
    });
  }

  withdraw(member: LocalMember, id: string, body: unknown) {
    permission(member, "daily:review");
    const data = exactBody(body, ["version"]);
    const row = this.staffRow(member, id);
    if (row.createdBy === member.actorId) throw unavailable();
    expected(row, data.version);
    if (row.status !== "CONFIRMED") throw conflict();
    return this.change(member, row, "daily.withdraw", {
      status: "RETURNED",
      reviewedBy: member.actorId,
    });
  }

  denied(member: LocalMember, action: string, id: string) {
    this.repository.audit({
      actorId: member.actorId,
      objectId: id || null,
      version: null,
      action,
      outcome: "DENIED",
      at: new Date(this.now()).toISOString(),
      tenantId: member.tenantId,
      campusId: member.campusId,
    });
  }

  private staffRow(member: LocalMember, id: string) {
    const row = this.repository.get(id);
    if (!row || row.kind !== "staffDaily" || !scoped(member, row)) throw unavailable();
    if (!member.actions.includes("daily:review") && row.createdBy !== member.actorId)
      throw unavailable();
    return row;
  }

  private owned(member: LocalMember, id: string) {
    const row = this.staffRow(member, id);
    if (row.createdBy !== member.actorId) throw unavailable();
    return row;
  }

  private sourceRefs(member: LocalMember, date: string): StaffDailySourceReference[] {
    const sources: StaffDailySourceReference[] = [];
    for (const row of this.repository.list()) {
      if (!scoped(member, row)) continue;
      if (row.kind === "staffTask" && row.status === "CHECKED" && row.dueDate === date) {
        sources.push({ kind: "TASK", id: row.id, version: row.version });
      } else if (row.kind === "attendance" && row.date === date) {
        sources.push({ kind: "ATTENDANCE", id: row.id, version: row.version });
      } else if (
        row.kind === "care" &&
        row.date === date &&
        row.status === "CONFIRMED" &&
        row.published === true
      ) {
        sources.push({ kind: "CARE_RECORD", id: row.id, version: row.version });
      } else if (row.kind === "pickup" && row.date === date) {
        sources.push({ kind: "PICKUP", id: row.id, version: row.version });
      } else if (row.kind === "pickupException" && row.date === date) {
        sources.push({ kind: "PICKUP_EXCEPTION", id: row.id, version: row.version });
      }
    }
    return sources.sort(
      (left, right) =>
        SOURCE_ORDER[left.kind] - SOURCE_ORDER[right.kind] || left.id.localeCompare(right.id),
    );
  }

  private change(
    member: LocalMember,
    row: StaffDailyReport,
    action: string,
    patch: Partial<Pick<StaffDailyReport, "values" | "sourceRefs" | "status" | "reviewedBy">>,
  ) {
    const next: StaffDailyReport = {
      ...row,
      ...patch,
      version: row.version + 1,
      updatedBy: member.actorId,
      updatedAt: new Date(this.now()).toISOString(),
    };
    if (!this.repository.replaceBatch([next])) throw conflict();
    this.audit(member, next, action);
    return this.view(next);
  }

  private audit(member: LocalMember, row: StaffDailyReport, action: string) {
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
