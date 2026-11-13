import { randomUUID } from "node:crypto";
import { exactBody, LocalError } from "./binding-leave.service.js";
import { memberForActor, type LocalMember, type LocalSessions } from "./sessions.js";

export const STAFF_CREDENTIAL_CATEGORIES = [
  "TEACHING_QUALIFICATION",
  "FIRST_AID_TRAINING",
  "CHILDCARE_TRAINING",
] as const;
export type StaffCredentialCategory = (typeof STAFF_CREDENTIAL_CATEGORIES)[number];
export const STAFF_CREDENTIAL_RESPONSIBLE_ROLES = ["CAMPUS_OWNER", "STAFF_MEMBER"] as const;
export type StaffCredentialResponsibleRole = (typeof STAFF_CREDENTIAL_RESPONSIBLE_ROLES)[number];
export type StaffCredentialExpiryStatus = "VALID" | "EXPIRING_SOON" | "EXPIRED";

interface StaffCredentialRevision {
  version: number;
  issueDate: string;
  expiryDate: string;
  responsibleRole: StaffCredentialResponsibleRole;
  updatedAt: string;
}

interface StaffCredentialRecord {
  id: string;
  tenantId: string;
  campusId: string;
  staffId: string;
  category: StaffCredentialCategory;
  issueDate: string;
  expiryDate: string;
  responsibleRole: StaffCredentialResponsibleRole;
  version: number;
  updatedAt: string;
  history: StaffCredentialRevision[];
}

const unavailable = () => new LocalError(403, "UNAVAILABLE");
const invalid = () => new LocalError(400, "INVALID_REQUEST");
const conflict = () => new LocalError(409, "STATE_CONFLICT");
const uuid = (value: number) => `00000000-0000-4000-8000-${value.toString(16).padStart(12, "0")}`;

function utcDate(milliseconds: number) {
  return new Date(milliseconds).toISOString().slice(0, 10);
}

function shiftDate(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return utcDate(value.getTime());
}

function isDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(`${value}T00:00:00.000Z`)) &&
    utcDate(Date.parse(`${value}T00:00:00.000Z`)) === value
  );
}

function isOneOf<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === "string" && values.includes(value as T);
}

function expiryStatus(expiryDate: string, now: number): StaffCredentialExpiryStatus {
  const today = utcDate(now);
  if (expiryDate < today) return "EXPIRED";
  if (expiryDate <= shiftDate(today, 30)) return "EXPIRING_SOON";
  return "VALID";
}

export class StaffCredentialsService {
  readonly #records = new Map<string, StaffCredentialRecord>();

  constructor(
    private readonly sessions: LocalSessions,
    private readonly now: () => number = Date.now,
  ) {
    const today = utcDate(this.now());
    this.seed(uuid(3), "TEACHING_QUALIFICATION", shiftDate(today, 30));
    this.seed(uuid(9), "FIRST_AID_TRAINING", shiftDate(today, -1));
  }

  list(manager: LocalMember) {
    const staff = this.staffFor(manager);
    return [...this.#records.values()]
      .filter(
        (record) =>
          record.tenantId === manager.tenantId &&
          record.campusId === manager.campusId &&
          staff.has(record.staffId),
      )
      .map((record) => this.view(record, staff.get(record.staffId)!));
  }

  create(manager: LocalMember, value: unknown) {
    const body = exactBody(value, [
      "staffId",
      "category",
      "issueDate",
      "expiryDate",
      "responsibleRole",
    ]);
    if (
      typeof body.staffId !== "string" ||
      !isOneOf(body.category, STAFF_CREDENTIAL_CATEGORIES) ||
      !isDate(body.issueDate) ||
      !isDate(body.expiryDate) ||
      body.expiryDate < body.issueDate ||
      !isOneOf(body.responsibleRole, STAFF_CREDENTIAL_RESPONSIBLE_ROLES)
    )
      throw invalid();
    const staff = this.staffFor(manager);
    const target = staff.get(body.staffId);
    if (!target || target.status !== "ACTIVE") throw unavailable();
    const record: StaffCredentialRecord = {
      id: randomUUID(),
      tenantId: manager.tenantId,
      campusId: manager.campusId,
      staffId: target.actorId,
      category: body.category,
      issueDate: body.issueDate,
      expiryDate: body.expiryDate,
      responsibleRole: body.responsibleRole,
      version: 1,
      updatedAt: new Date(this.now()).toISOString(),
      history: [],
    };
    this.#records.set(record.id, record);
    return this.view(record, target);
  }

  update(manager: LocalMember, id: string, value: unknown) {
    const body = exactBody(value, ["version", "issueDate", "expiryDate", "responsibleRole"]);
    if (
      !Number.isSafeInteger(body.version) ||
      (body.version as number) < 1 ||
      !isDate(body.issueDate) ||
      !isDate(body.expiryDate) ||
      body.expiryDate < body.issueDate ||
      !isOneOf(body.responsibleRole, STAFF_CREDENTIAL_RESPONSIBLE_ROLES)
    )
      throw invalid();
    const target = this.staffFor(manager).get(this.#records.get(id)?.staffId ?? "");
    const record = this.#records.get(id);
    if (
      !record ||
      !target ||
      record.tenantId !== manager.tenantId ||
      record.campusId !== manager.campusId
    )
      throw unavailable();
    if (record.version !== body.version) throw conflict();
    record.history.push({
      version: record.version,
      issueDate: record.issueDate,
      expiryDate: record.expiryDate,
      responsibleRole: record.responsibleRole,
      updatedAt: record.updatedAt,
    });
    record.issueDate = body.issueDate;
    record.expiryDate = body.expiryDate;
    record.responsibleRole = body.responsibleRole;
    record.version += 1;
    record.updatedAt = new Date(this.now()).toISOString();
    return this.view(record, target);
  }

  private staffFor(manager: LocalMember) {
    if (!manager.actions.includes("membership:manage")) throw unavailable();
    const memberships = this.sessions.membershipsFor(manager);
    if (!memberships) throw unavailable();
    return new Map(
      memberships
        .filter((row) => row.tenantId === manager.tenantId && row.campusId === manager.campusId)
        .map((row) => [row.actorId, row]),
    );
  }

  private seed(staffId: string, category: StaffCredentialCategory, expiryDate: string) {
    const staff = memberForActor(staffId);
    if (!staff) return;
    const record: StaffCredentialRecord = {
      id: randomUUID(),
      tenantId: staff.tenantId,
      campusId: staff.campusId,
      staffId,
      category,
      issueDate: shiftDate(expiryDate, -365),
      expiryDate,
      responsibleRole: "CAMPUS_OWNER",
      version: 1,
      updatedAt: new Date(this.now()).toISOString(),
      history: [],
    };
    this.#records.set(record.id, record);
  }

  private view(
    record: StaffCredentialRecord,
    staff: NonNullable<ReturnType<LocalSessions["membershipsFor"]>>[number],
  ) {
    return structuredClone({
      id: record.id,
      version: record.version,
      staffId: record.staffId,
      staffLabel: staff.label,
      staffRole: staff.role,
      category: record.category,
      issueDate: record.issueDate,
      expiryDate: record.expiryDate,
      expiryStatus: expiryStatus(record.expiryDate, this.now()),
      responsibleRole: record.responsibleRole,
      updatedAt: record.updatedAt,
      history: record.history,
    });
  }
}
