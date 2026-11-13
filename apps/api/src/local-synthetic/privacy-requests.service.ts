import { randomUUID } from "node:crypto";
import { BindingLeaveService, exactBody, LocalError } from "./binding-leave.service.js";
import { studentForId, type LocalAction, type LocalMember } from "./sessions.js";

export type PrivacyRequestType = "ACCESS" | "CORRECT" | "COPY" | "DELETE";
export type PrivacyRequestStatus = "SUBMITTED" | "IN_REVIEW" | "SIMULATED_COMPLETE" | "WITHDRAWN";

type PrivacyRequestEvent = {
  version: number;
  status: PrivacyRequestStatus;
  action: "SUBMIT" | "START" | "SIMULATED_COMPLETE" | "WITHDRAW";
  actorId: string;
  occurredAt: string;
  dataChanged: false;
};

type PrivacyRequestRecord = {
  id: string;
  version: number;
  type: PrivacyRequestType;
  status: PrivacyRequestStatus;
  bindingId: string;
  tenantId: string;
  campusId: string;
  classId: string;
  requestedBy: string;
  createdAt: string;
  updatedAt: string;
  dataChanged: false;
  history: PrivacyRequestEvent[];
};

const requestTypes: readonly PrivacyRequestType[] = ["ACCESS", "CORRECT", "COPY", "DELETE"];
const invalid = () => new LocalError(400, "INVALID_REQUEST");
const unavailable = () => new LocalError(403, "UNAVAILABLE");
const conflict = () => new LocalError(409, "STATE_CONFLICT");

function permitted(member: LocalMember, action: LocalAction) {
  if (!member.actions.includes(action)) throw unavailable();
}

export class PrivacyRequestService {
  readonly #records = new Map<string, PrivacyRequestRecord>();

  constructor(
    private readonly relationships: Pick<BindingLeaveService, "bindings">,
    private readonly now: () => number = Date.now,
  ) {}

  list(member: LocalMember) {
    if (member.profile.startsWith("owner-")) {
      permitted(member, "privacy:review");
      return [...this.#records.values()]
        .filter(
          (row) =>
            row.tenantId === member.tenantId &&
            row.campusId === member.campusId &&
            member.classIds.includes(row.classId),
        )
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
        .map((row) => this.#view(row));
    }
    if (!member.profile.startsWith("parent-")) throw unavailable();
    permitted(member, "privacy:request");
    return [...this.#records.values()]
      .filter((row) => row.requestedBy === member.actorId)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .map((row) => this.#view(row));
  }

  create(member: LocalMember, value: unknown) {
    if (!member.profile.startsWith("parent-")) throw unavailable();
    permitted(member, "privacy:request");
    const body = exactBody(value, ["bindingId", "type"]);
    if (
      typeof body.bindingId !== "string" ||
      !requestTypes.includes(body.type as PrivacyRequestType)
    )
      throw invalid();

    const binding = this.relationships
      .bindings(member)
      .find((row) => row.id === body.bindingId && row.status === "APPROVED");
    if (!binding) throw unavailable();
    const student = studentForId(binding.studentId);
    if (
      !student ||
      student.tenantId !== member.tenantId ||
      student.campusId !== member.campusId ||
      !member.classIds.includes(student.classId)
    )
      throw unavailable();

    const type = body.type as PrivacyRequestType;
    const duplicate = [...this.#records.values()].some(
      (row) =>
        row.requestedBy === member.actorId &&
        row.bindingId === binding.id &&
        row.type === type &&
        row.status !== "SIMULATED_COMPLETE" &&
        row.status !== "WITHDRAWN",
    );
    if (duplicate) throw conflict();

    const timestamp = new Date(this.now()).toISOString();
    const row: PrivacyRequestRecord = {
      id: randomUUID(),
      version: 1,
      type,
      status: "SUBMITTED",
      bindingId: binding.id,
      tenantId: student.tenantId,
      campusId: student.campusId,
      classId: student.classId,
      requestedBy: member.actorId,
      createdAt: timestamp,
      updatedAt: timestamp,
      dataChanged: false,
      history: [],
    };
    this.#recordEvent(row, member, "SUBMIT");
    this.#records.set(row.id, row);
    return this.#view(row);
  }

  review(member: LocalMember, id: string, value: unknown) {
    if (!member.profile.startsWith("owner-")) throw unavailable();
    permitted(member, "privacy:review");
    const body = exactBody(value, ["version", "action"]);
    if (
      typeof body.version !== "number" ||
      !Number.isInteger(body.version) ||
      (body.action !== "START" && body.action !== "COMPLETE")
    )
      throw invalid();
    const row = this.#reviewRow(member, id);
    if (body.version !== row.version) throw conflict();
    if (body.action === "START") {
      if (row.status !== "SUBMITTED") throw conflict();
      row.status = "IN_REVIEW";
      this.#recordEvent(row, member, "START");
    } else {
      if (row.status !== "IN_REVIEW") throw conflict();
      row.status = "SIMULATED_COMPLETE";
      this.#recordEvent(row, member, "SIMULATED_COMPLETE");
    }
    return this.#view(row);
  }

  withdraw(member: LocalMember, id: string, value: unknown) {
    if (!member.profile.startsWith("parent-")) throw unavailable();
    permitted(member, "privacy:request");
    const body = exactBody(value, ["version"]);
    if (typeof body.version !== "number" || !Number.isInteger(body.version)) throw invalid();
    const row = this.#records.get(id);
    if (!row || row.requestedBy !== member.actorId) throw unavailable();
    if (body.version !== row.version) throw conflict();
    if (row.status !== "SUBMITTED" && row.status !== "IN_REVIEW") throw conflict();
    row.status = "WITHDRAWN";
    this.#recordEvent(row, member, "WITHDRAW");
    return this.#view(row);
  }

  #reviewRow(member: LocalMember, id: string) {
    const row = this.#records.get(id);
    if (
      !row ||
      row.tenantId !== member.tenantId ||
      row.campusId !== member.campusId ||
      !member.classIds.includes(row.classId)
    )
      throw unavailable();
    return row;
  }

  #recordEvent(
    row: PrivacyRequestRecord,
    member: LocalMember,
    action: PrivacyRequestEvent["action"],
  ) {
    row.version += row.history.length === 0 ? 0 : 1;
    row.updatedAt = new Date(this.now()).toISOString();
    row.dataChanged = false;
    row.history.push({
      version: row.version,
      status: row.status,
      action,
      actorId: member.actorId,
      occurredAt: row.updatedAt,
      dataChanged: false,
    });
  }

  #view(row: PrivacyRequestRecord) {
    return structuredClone(row);
  }
}
