import {
  CARE_RECORD_ACTIONS,
  type CareRecordParentProjection,
  type CareRecordStaffProjection,
  type CareRecordStudentProjection,
  type CareRecordValues,
} from "@student-care/contracts";
import type {
  CareRecordCapability,
  CareRecordContext,
  CareRecordOperations,
  CareRecordResult,
} from "../modules/care-records/prisma-care-record.service.js";
import { CareRecordService } from "./care-record.service.js";
import { LocalError } from "./binding-leave.service.js";
import { memberForActor, studentForId, studentsForMember, type LocalMember } from "./sessions.js";
import { type Care, type LocalRepository } from "./repository.js";

type LocalStaffRecord = {
  readonly id: string;
  readonly version: number;
  readonly tenantId: string;
  readonly campusId: string;
  readonly classId: string;
  readonly studentId: string;
  readonly date: string;
  readonly values: CareRecordValues;
  readonly status: CareRecordStaffProjection["status"];
  readonly createdBy: string;
  readonly reviewedBy: string | null;
  readonly published: boolean;
  readonly publicationVersion: number;
  readonly updatedAt: string;
};

type LocalParentRecord = {
  readonly id: string;
  readonly version: number;
  readonly publicationVersion: number;
  readonly bindingId: string;
  readonly date: string;
  readonly studentId: string;
  readonly studentLabel: string;
  readonly values: unknown;
  readonly receipt: "UNREAD" | "READ" | "ACKNOWLEDGED";
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function staffRecord(value: unknown): value is LocalStaffRecord {
  return (
    isObject(value) &&
    typeof value.id === "string" &&
    Number.isSafeInteger(value.version) &&
    typeof value.tenantId === "string" &&
    typeof value.campusId === "string" &&
    typeof value.classId === "string" &&
    typeof value.studentId === "string" &&
    typeof value.date === "string" &&
    isObject(value.values) &&
    typeof value.createdBy === "string" &&
    (typeof value.reviewedBy === "string" || value.reviewedBy === null) &&
    typeof value.published === "boolean" &&
    Number.isSafeInteger(value.publicationVersion) &&
    typeof value.updatedAt === "string"
  );
}

function parentRecord(value: unknown): value is LocalParentRecord {
  return (
    isObject(value) &&
    typeof value.id === "string" &&
    Number.isSafeInteger(value.version) &&
    Number.isSafeInteger(value.publicationVersion) &&
    typeof value.bindingId === "string" &&
    typeof value.date === "string" &&
    typeof value.studentId === "string" &&
    typeof value.studentLabel === "string" &&
    isObject(value.values) &&
    ["UNREAD", "READ", "ACKNOWLEDGED"].includes(String(value.receipt))
  );
}

function availableStaffActions(
  record: LocalStaffRecord,
  member: LocalMember,
): CareRecordStaffProjection["actions"] {
  const own = record.createdBy === member.actorId;
  const actions = new Set<CareRecordStaffProjection["actions"][number]>();
  if (own && member.actions.includes("care:write") && !record.published) {
    if (["DRAFT", "RETURNED", "CONFIRMED"].includes(record.status)) actions.add("edit");
    if (record.status === "DRAFT") actions.add("submit");
    if (record.status === "RETURNED") {
      actions.add("edit");
      actions.add("resubmit");
    }
    if (["DRAFT", "SUBMITTED", "RETURNED"].includes(record.status)) actions.add("withdraw");
  }
  if (!own && record.status === "SUBMITTED" && member.actions.includes("care:review"))
    actions.add("review");
  if (
    record.status === "CONFIRMED" &&
    record.reviewedBy !== null &&
    record.reviewedBy !== record.createdBy &&
    member.actions.includes("care:publish")
  ) {
    actions.add(record.published ? "revoke-publication" : "publish");
  }
  return CARE_RECORD_ACTIONS.filter((action) => actions.has(action));
}

function toStaffProjection(value: unknown, member: LocalMember): CareRecordStaffProjection {
  if (!staffRecord(value)) throw new LocalError(403, "UNAVAILABLE");
  const record = value;
  const student = studentForId(record.studentId);
  if (!student) throw new LocalError(403, "UNAVAILABLE");
  return {
    id: record.id,
    student_id: student.id,
    student_display_ref: student.label,
    class_ref: student.classLabel,
    service_date: record.date,
    values: record.values,
    status: record.status,
    version: record.version,
    published: record.published,
    publication_version: record.publicationVersion,
    updated_at: record.updatedAt,
    actions: availableStaffActions(record, member),
  };
}

function toParentProjection(value: unknown, source: Care): CareRecordParentProjection {
  if (
    !parentRecord(value) ||
    source.id !== value.id ||
    source.studentId !== value.studentId ||
    source.version !== value.version ||
    source.publicationVersion !== value.publicationVersion ||
    source.status !== "CONFIRMED" ||
    !source.published
  )
    throw new LocalError(403, "UNAVAILABLE");
  const record = value;
  return {
    id: record.id,
    student_display_ref: record.studentLabel,
    service_date: source.date,
    values: source.values as CareRecordValues,
    version: source.version,
    publication_version: source.publicationVersion,
    receipt_status: record.receipt,
  };
}

function failure<T>(error: unknown): CareRecordResult<T> {
  if (!(error instanceof LocalError)) throw error;
  const code =
    error.statusCode === 409
      ? "CONFLICT_STATE"
      : error.statusCode === 400
        ? "VALIDATION_FAILED"
        : "NOT_FOUND_SCOPED";
  return { ok: false, error: { code, message: error.message } };
}

export class LocalSyntheticNestCareRecordAdapter implements CareRecordOperations {
  public constructor(
    private readonly service: CareRecordService,
    private readonly repository: LocalRepository,
  ) {}

  private member(
    context: CareRecordContext,
    required: CareRecordCapability | readonly CareRecordCapability[],
  ): LocalMember | undefined {
    const actorIds = new Set(context.scopes.map(({ scope }) => scope.actorId));
    if (actorIds.size !== 1) return undefined;
    const actorId = [...actorIds][0];
    if (actorId === undefined) return undefined;
    const local = memberForActor(actorId);
    if (!local) return undefined;

    const matchingScopes = context.scopes.filter(
      ({ scope }) =>
        scope.actorId === actorId &&
        scope.tenantId === local.tenantId &&
        scope.campusId === local.campusId,
    );
    const capabilities = new Set(matchingScopes.flatMap(({ capabilities }) => capabilities));
    const requiredList = Array.isArray(required) ? required : [required];
    if (!requiredList.some((capability) => capabilities.has(capability))) return undefined;

    return {
      ...local,
      actions: local.actions.filter((action) => capabilities.has(action as CareRecordCapability)),
    };
  }

  private execute<T>(operation: () => T): Promise<CareRecordResult<T>> {
    try {
      return Promise.resolve({ ok: true, data: operation() });
    } catch (error) {
      return Promise.resolve(failure<T>(error));
    }
  }

  public async listStaffStudents(
    context: CareRecordContext,
  ): Promise<readonly CareRecordStudentProjection[]> {
    const member = this.member(context, "care:write");
    if (!member) return [];
    return studentsForMember(member).map((student) => ({
      id: student.id,
      student_display_ref: student.label,
      class_ref: student.classLabel,
    }));
  }

  public async listStaff(
    context: CareRecordContext,
  ): Promise<readonly CareRecordStaffProjection[]> {
    const member = this.member(context, ["care:write", "care:review", "care:publish"]);
    if (!member) return [];
    return this.service
      .list(member)
      .flatMap((record) => (staffRecord(record) ? [toStaffProjection(record, member)] : []));
  }

  public create(
    context: CareRecordContext,
    input: Parameters<CareRecordOperations["create"]>[1],
  ): Promise<CareRecordResult<CareRecordStaffProjection>> {
    return this.execute(() => {
      const member = this.member(context, "care:write");
      const student = studentForId(input.student_id);
      if (!member || !student) throw new LocalError(403, "UNAVAILABLE");
      return toStaffProjection(
        this.service.create(member, {
          student: student.alias,
          date: input.service_date,
          values: input.values,
        }),
        member,
      );
    });
  }

  public getStaff(
    context: CareRecordContext,
    recordId: string,
  ): Promise<CareRecordResult<CareRecordStaffProjection>> {
    return this.execute(() => {
      const member = this.member(context, ["care:write", "care:review", "care:publish"]);
      if (!member) throw new LocalError(403, "UNAVAILABLE");
      const record = this.service.get(member, recordId);
      if (!staffRecord(record)) throw new LocalError(403, "UNAVAILABLE");
      return toStaffProjection(record, member);
    });
  }

  public update(
    context: CareRecordContext,
    recordId: string,
    input: Parameters<CareRecordOperations["update"]>[2],
  ): Promise<CareRecordResult<CareRecordStaffProjection>> {
    return this.execute(() => {
      const member = this.member(context, "care:write");
      if (!member) throw new LocalError(403, "UNAVAILABLE");
      return toStaffProjection(this.service.edit(member, recordId, input), member);
    });
  }

  public submit(
    context: CareRecordContext,
    recordId: string,
    input: Parameters<CareRecordOperations["submit"]>[2],
  ): Promise<CareRecordResult<CareRecordStaffProjection>> {
    return this.execute(() => {
      const member = this.member(context, "care:write");
      if (!member) throw new LocalError(403, "UNAVAILABLE");
      return toStaffProjection(this.service.transition(member, recordId, input, "submit"), member);
    });
  }

  public resubmit(
    context: CareRecordContext,
    recordId: string,
    input: Parameters<CareRecordOperations["resubmit"]>[2],
  ): Promise<CareRecordResult<CareRecordStaffProjection>> {
    return this.execute(() => {
      const member = this.member(context, "care:write");
      if (!member) throw new LocalError(403, "UNAVAILABLE");
      return toStaffProjection(
        this.service.transition(member, recordId, input, "resubmit"),
        member,
      );
    });
  }

  public review(
    context: CareRecordContext,
    recordId: string,
    input: Parameters<CareRecordOperations["review"]>[2],
  ): Promise<CareRecordResult<CareRecordStaffProjection>> {
    return this.execute(() => {
      const member = this.member(context, "care:review");
      if (!member) throw new LocalError(403, "UNAVAILABLE");
      return toStaffProjection(this.service.review(member, recordId, input), member);
    });
  }

  public publish(
    context: CareRecordContext,
    recordId: string,
    input: Parameters<CareRecordOperations["publish"]>[2],
  ): Promise<CareRecordResult<CareRecordStaffProjection>> {
    return this.execute(() => {
      const member = this.member(context, "care:publish");
      if (!member) throw new LocalError(403, "UNAVAILABLE");
      return toStaffProjection(this.service.transition(member, recordId, input, "publish"), member);
    });
  }

  public withdraw(
    context: CareRecordContext,
    recordId: string,
    input: Parameters<CareRecordOperations["withdraw"]>[2],
  ): Promise<CareRecordResult<CareRecordStaffProjection>> {
    return this.execute(() => {
      const member = this.member(context, "care:write");
      if (!member) throw new LocalError(403, "UNAVAILABLE");
      const current = this.service.get(member, recordId);
      if (staffRecord(current) && current.published) throw new LocalError(409, "CONFLICT");
      return toStaffProjection(
        this.service.transition(member, recordId, input, "withdraw"),
        member,
      );
    });
  }

  public revokePublication(
    context: CareRecordContext,
    recordId: string,
    input: Parameters<CareRecordOperations["revokePublication"]>[2],
  ): Promise<CareRecordResult<CareRecordStaffProjection>> {
    return this.execute(() => {
      const member = this.member(context, "care:publish");
      if (!member) throw new LocalError(403, "UNAVAILABLE");
      return toStaffProjection(
        this.service.transition(member, recordId, input, "revoke-publication"),
        member,
      );
    });
  }

  public async listParent(
    context: CareRecordContext,
  ): Promise<readonly CareRecordParentProjection[]> {
    const member = this.member(context, "care:read");
    if (!member) return [];
    return this.service.list(member).flatMap((record) => {
      if (!parentRecord(record)) return [];
      const source = this.repository.get(record.id);
      return source?.kind === "care" ? [toParentProjection(record, source)] : [];
    });
  }

  public getParent(
    context: CareRecordContext,
    recordId: string,
  ): Promise<CareRecordResult<CareRecordParentProjection>> {
    return this.execute(() => {
      const member = this.member(context, "care:read");
      if (!member) throw new LocalError(403, "UNAVAILABLE");
      const record = this.service.get(member, recordId);
      if (!parentRecord(record)) throw new LocalError(403, "UNAVAILABLE");
      const source = this.repository.get(recordId);
      if (source?.kind !== "care") throw new LocalError(403, "UNAVAILABLE");
      return toParentProjection(record, source);
    });
  }

  public receipt(
    context: CareRecordContext,
    recordId: string,
    input: Parameters<CareRecordOperations["receipt"]>[2],
  ): Promise<CareRecordResult<CareRecordParentProjection>> {
    return this.execute(() => {
      const member = this.member(context, "care:read");
      if (!member) throw new LocalError(403, "UNAVAILABLE");
      const current = this.service.get(member, recordId);
      if (!parentRecord(current)) throw new LocalError(403, "UNAVAILABLE");
      const updated = this.service.receipt(member, recordId, {
        bindingId: current.bindingId,
        version: input.version,
        publicationVersion: input.publication_version,
        action: input.action,
      });
      if (!parentRecord(updated)) throw new LocalError(403, "UNAVAILABLE");
      const source = this.repository.get(recordId);
      if (source?.kind !== "care") throw new LocalError(403, "UNAVAILABLE");
      return toParentProjection(updated, source);
    });
  }
}
