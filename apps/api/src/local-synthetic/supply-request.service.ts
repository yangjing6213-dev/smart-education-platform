import { randomUUID } from "node:crypto";
import { exactBody, LocalError } from "./binding-leave.service.js";
import {
  LocalRepository,
  type SupplyRequest,
  type SupplyRequestCatalogCode,
  type SupplyRequestPurposeCode,
} from "./repository.js";
import { memberForActor, type LocalAction, type LocalMember } from "./sessions.js";

const unavailable = () => new LocalError(403, "UNAVAILABLE");
const invalid = () => new LocalError(400, "INVALID_REQUEST");
const conflict = () => new LocalError(409, "STATE_CONFLICT");

export const SUPPLY_CATALOG = {
  STATIONERY_SET: "日常文具包",
  ART_ACTIVITY_SET: "美术活动包",
  CLEANING_SET: "清洁用品包",
  FIRST_AID_SET: "基础急救包",
} as const satisfies Record<SupplyRequestCatalogCode, string>;
export const SUPPLY_PURPOSE = {
  CLASS_ACTIVITY: "班级活动",
  DAILY_OPERATION: "日常运营",
  EMERGENCY_STOCK: "应急储备",
} as const satisfies Record<SupplyRequestPurposeCode, string>;

function permission(member: LocalMember, action: LocalAction) {
  if (!member.actions.includes(action)) throw unavailable();
}
function scoped(
  member: LocalMember,
  row: Pick<SupplyRequest, "tenantId" | "campusId" | "classId">,
) {
  return (
    member.tenantId === row.tenantId &&
    member.campusId === row.campusId &&
    member.classIds.includes(row.classId)
  );
}
function expected(row: SupplyRequest, version: unknown) {
  if (!Number.isSafeInteger(version) || (version as number) < 1) throw invalid();
  if (row.version !== version) throw conflict();
}
function input(value: unknown) {
  const data = exactBody(value, ["catalog", "quantity", "purpose"]);
  if (
    typeof data.catalog !== "string" ||
    typeof data.purpose !== "string" ||
    !Object.hasOwn(SUPPLY_CATALOG, data.catalog) ||
    !Object.hasOwn(SUPPLY_PURPOSE, data.purpose)
  )
    throw invalid();
  if (
    !Number.isSafeInteger(data.quantity) ||
    (data.quantity as number) < 1 ||
    (data.quantity as number) > 20
  )
    throw invalid();
  return {
    catalog: data.catalog as SupplyRequestCatalogCode,
    quantity: data.quantity as number,
    purpose: data.purpose as SupplyRequestPurposeCode,
  };
}
function staffView(row: SupplyRequest) {
  return {
    ...structuredClone(row),
    catalogLabel: SUPPLY_CATALOG[row.catalog],
    purposeLabel: SUPPLY_PURPOSE[row.purpose],
    authorLabel: memberForActor(row.createdBy)?.label ?? "示例教师",
    reviewerLabel: row.reviewedBy ? (memberForActor(row.reviewedBy)?.label ?? "示例负责人") : null,
    claimerLabel: row.claimedBy ? (memberForActor(row.claimedBy)?.label ?? "示例员工") : null,
    synthetic: true as const,
  };
}

export class SupplyRequestService {
  constructor(
    private readonly repository: LocalRepository,
    private readonly now: () => number = Date.now,
  ) {}

  list(member: LocalMember) {
    permission(member, "supply:read");
    const broad = member.actions.includes("supply:review");
    return this.repository
      .list()
      .filter((row): row is SupplyRequest => row.kind === "supplyRequest")
      .filter((row) => scoped(member, row) && (broad || row.createdBy === member.actorId))
      .map(staffView);
  }
  reviewQueue(member: LocalMember) {
    permission(member, "supply:review");
    return this.repository
      .list()
      .filter((row): row is SupplyRequest => row.kind === "supplyRequest")
      .filter(
        (row) =>
          scoped(member, row) &&
          ["SUBMITTED", "CONFIRMED", "READY", "OUT_OF_STOCK"].includes(row.status),
      )
      .map(staffView);
  }
  summary(member: LocalMember) {
    permission(member, "supply:summary");
    const counts = Object.fromEntries(
      [
        "DRAFT",
        "SUBMITTED",
        "CONFIRMED",
        "RETURNED",
        "READY",
        "OUT_OF_STOCK",
        "CANCELLED",
        "CLAIMED",
      ].map((status) => [status, 0]),
    ) as Record<SupplyRequest["status"], number>;
    for (const row of this.repository.list()) {
      if (row.kind === "supplyRequest") counts[row.status] += 1;
    }
    return { synthetic: true as const, counts };
  }
  get(member: LocalMember, id: string) {
    permission(member, "supply:read");
    return staffView(this.staffRow(member, id));
  }
  create(member: LocalMember, value: unknown) {
    permission(member, "supply:create");
    const data = input(value);
    if (member.classIds.length !== 1) throw invalid();
    this.requireNoDuplicate(member, data);
    const row: SupplyRequest = {
      id: randomUUID(),
      version: 1,
      kind: "supplyRequest",
      tenantId: member.tenantId,
      campusId: member.campusId,
      classId: member.classIds[0]!,
      ...data,
      status: "DRAFT",
      createdBy: member.actorId,
      reviewedBy: null,
      claimedBy: null,
      updatedBy: member.actorId,
      updatedAt: new Date(this.now()).toISOString(),
    };
    this.repository.insert(row);
    this.audit(member, row, "supply.create");
    return staffView(row);
  }
  edit(member: LocalMember, id: string, value: unknown) {
    permission(member, "supply:create");
    const data = exactBody(value, ["version", "catalog", "quantity", "purpose"]);
    const row = this.owned(member, id);
    expected(row, data.version);
    if (row.status !== "DRAFT" && row.status !== "RETURNED") throw conflict();
    const updated = input({
      catalog: data.catalog,
      quantity: data.quantity,
      purpose: data.purpose,
    });
    this.requireNoDuplicate(member, updated, row.id);
    return this.change(member, row, "supply.edit", {
      ...updated,
      status: "DRAFT",
      reviewedBy: null,
    });
  }
  submit(member: LocalMember, id: string, value: unknown) {
    permission(member, "supply:submit");
    const data = exactBody(value, ["version"]);
    const row = this.owned(member, id);
    expected(row, data.version);
    if (row.status !== "DRAFT") throw conflict();
    return this.change(member, row, "supply.submit", { status: "SUBMITTED" });
  }
  review(member: LocalMember, id: string, value: unknown) {
    permission(member, "supply:review");
    const data = exactBody(value, ["version", "action"]);
    if (data.action !== "CONFIRM" && data.action !== "RETURN" && data.action !== "OUT_OF_STOCK")
      throw invalid();
    const row = this.staffRow(member, id);
    expected(row, data.version);
    if (row.status !== "SUBMITTED") throw conflict();
    const status =
      data.action === "CONFIRM" ? "READY" : data.action === "RETURN" ? "RETURNED" : "OUT_OF_STOCK";
    return this.change(member, row, `supply.${String(data.action).toLowerCase()}`, {
      status,
      reviewedBy: member.actorId,
    });
  }
  claim(member: LocalMember, id: string, value: unknown) {
    permission(member, "supply:claim");
    const data = exactBody(value, ["version"]);
    const row = this.staffRow(member, id);
    expected(row, data.version);
    if (row.status !== "READY") throw conflict();
    return this.change(member, row, "supply.claim", {
      status: "CLAIMED",
      claimedBy: member.actorId,
    });
  }
  cancel(member: LocalMember, id: string, value: unknown) {
    permission(member, "supply:create");
    const data = exactBody(value, ["version"]);
    const row = this.owned(member, id);
    expected(row, data.version);
    if (!["DRAFT", "SUBMITTED", "RETURNED"].includes(row.status)) throw conflict();
    return this.change(member, row, "supply.cancel", { status: "CANCELLED" });
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
    if (!row || row.kind !== "supplyRequest" || !scoped(member, row)) throw unavailable();
    if (!member.actions.includes("supply:review") && row.createdBy !== member.actorId)
      throw unavailable();
    return row;
  }
  private owned(member: LocalMember, id: string) {
    const row = this.staffRow(member, id);
    if (row.createdBy !== member.actorId) throw unavailable();
    return row;
  }
  private requireNoDuplicate(
    member: LocalMember,
    data: ReturnType<typeof input>,
    excludeId?: string,
  ) {
    if (
      this.repository
        .list()
        .some(
          (row) =>
            row.kind === "supplyRequest" &&
            row.id !== excludeId &&
            scoped(member, row) &&
            row.createdBy === member.actorId &&
            row.catalog === data.catalog &&
            row.purpose === data.purpose &&
            !["CANCELLED", "CLAIMED", "OUT_OF_STOCK"].includes(row.status),
        )
    )
      throw conflict();
  }
  private change(
    member: LocalMember,
    row: SupplyRequest,
    action: string,
    patch: Partial<SupplyRequest>,
  ) {
    const next: SupplyRequest = {
      ...row,
      ...patch,
      version: row.version + 1,
      updatedBy: member.actorId,
      updatedAt: new Date(this.now()).toISOString(),
    };
    if (!this.repository.replaceBatch([next])) throw conflict();
    this.audit(member, next, action);
    return staffView(next);
  }
  private audit(member: LocalMember, row: SupplyRequest, action: string) {
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
