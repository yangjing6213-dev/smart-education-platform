import type {
  LeaveRequestAction,
  LeaveRequestParentProjection,
  LeaveRequestStaffProjection,
} from "@student-care/contracts";
import type {
  LeaveCapability,
  LeaveContext,
  LeaveOperations,
  LeaveResult,
} from "../modules/leave/prisma-leave.service.js";
import { BindingLeaveService, LocalError } from "./binding-leave.service.js";
import { memberForActor, type LocalMember } from "./sessions.js";

type LocalLeaveView = ReturnType<BindingLeaveService["leaves"]>[number];

function parentActions(row: LocalLeaveView): readonly LeaveRequestAction[] {
  const actions: LeaveRequestAction[] = [];
  if (row.status === "SUBMITTED" || row.status === "RETURNED") actions.push("withdraw");
  if (row.status === "RETURNED") actions.push("resubmit");
  if ((row.status === "RETURNED" || row.status === "CONFIRMED") && !row.acknowledged) {
    actions.push("acknowledge");
  }
  return actions;
}

function parentProjection(row: LocalLeaveView): LeaveRequestParentProjection {
  return {
    id: row.id,
    student_id: row.studentId,
    student_display_ref: row.studentLabel,
    start_date: row.startDate,
    end_date: row.endDate,
    reason_category: row.reason,
    status: row.status,
    version: row.version,
    acknowledged: row.acknowledged,
    actions: parentActions(row),
    updated_at: row.updatedAt,
  };
}

function staffProjection(
  row: LocalLeaveView,
  classRef: string,
): LeaveRequestStaffProjection {
  return {
    ...parentProjection(row),
    class_ref: classRef,
    actions: row.status === "SUBMITTED" ? ["confirm", "return"] : [],
  };
}

function failure<T>(error: unknown): LeaveResult<T> {
  if (!(error instanceof LocalError)) throw error;
  const code =
    error.statusCode === 409
      ? "CONFLICT_STATE"
      : error.statusCode === 400
        ? "VALIDATION_FAILED"
        : "NOT_FOUND_SCOPED";
  return { ok: false, error: { code, message: error.message } };
}

export class LocalSyntheticNestLeaveAdapter implements LeaveOperations {
  public constructor(private readonly service: BindingLeaveService) {}

  private member(context: LeaveContext, required: LeaveCapability): LocalMember | undefined {
    const actorIds = new Set(context.scopes.map(({ scope }) => scope.actorId));
    if (actorIds.size !== 1) return undefined;
    const actorId = [...actorIds][0];
    if (actorId === undefined) return undefined;
    const member = memberForActor(actorId);
    if (!member) return undefined;

    const matchingScopes = context.scopes.filter(
      ({ scope, capabilities }) =>
        scope.actorId === actorId &&
        scope.tenantId === member.tenantId &&
        scope.campusId === member.campusId &&
        capabilities.includes(required),
    );
    if (matchingScopes.length === 0) return undefined;

    const parent = member.actions.includes("leave:apply");
    const staff = member.actions.includes("leave:review");
    if (parent === staff) return undefined;
    if (required === "leave:apply" && !parent) return undefined;
    if (required === "leave:read" && !parent) return undefined;
    if (required === "leave:review" && !staff) return undefined;
    return member;
  }

  private execute<T>(operation: () => T): Promise<LeaveResult<T>> {
    try {
      return Promise.resolve({ ok: true, data: operation() });
    } catch (error) {
      return Promise.resolve(failure<T>(error));
    }
  }

  public async listParent(context: LeaveContext): Promise<readonly LeaveRequestParentProjection[]> {
    const member = this.member(context, "leave:read");
    if (!member) return [];
    return this.service.leaves(member).map(parentProjection);
  }

  public async listStaff(context: LeaveContext): Promise<readonly LeaveRequestStaffProjection[]> {
    const member = this.member(context, "leave:review");
    if (!member) return [];
    const classByStudentId = new Map(
      this.service.bindings(member).map((binding) => [binding.studentId, binding.classLabel]),
    );
    return this.service.leaves(member)
      .filter((row) => row.status === "SUBMITTED")
      .flatMap((row) => {
        const classRef = classByStudentId.get(row.studentId);
        return classRef ? [staffProjection(row, classRef)] : [];
      });
  }

  public create(
    context: LeaveContext,
    input: Parameters<LeaveOperations["create"]>[1],
  ): Promise<LeaveResult<LeaveRequestParentProjection>> {
    return this.execute(() => {
      const member = this.member(context, "leave:apply");
      if (!member) throw new LocalError(403, "UNAVAILABLE");
      const binding = this.service.bindings(member).find(
        (candidate) => candidate.studentId === input.student_id && candidate.status === "APPROVED",
      );
      if (!binding) throw new LocalError(403, "UNAVAILABLE");
      const row = this.service.applyLeave(member, {
        bindingId: binding.id,
        startDate: input.start_date,
        endDate: input.end_date,
        reason: input.reason_category,
      });
      return parentProjection(row);
    });
  }

  public resubmit(
    context: LeaveContext,
    requestId: string,
    input: Parameters<LeaveOperations["resubmit"]>[2],
  ): Promise<LeaveResult<LeaveRequestParentProjection>> {
    return this.execute(() => {
      const member = this.member(context, "leave:apply");
      if (!member) throw new LocalError(403, "UNAVAILABLE");
      return parentProjection(
        this.service.resubmitLeave(member, requestId, {
          version: input.version,
          startDate: input.start_date,
          endDate: input.end_date,
          reason: input.reason_category,
        }),
      );
    });
  }

  public withdraw(
    context: LeaveContext,
    requestId: string,
    input: Parameters<LeaveOperations["withdraw"]>[2],
  ): Promise<LeaveResult<LeaveRequestParentProjection>> {
    return this.execute(() => {
      const member = this.member(context, "leave:apply");
      if (!member) throw new LocalError(403, "UNAVAILABLE");
      return parentProjection(this.service.withdrawLeave(member, requestId, input));
    });
  }

  public acknowledge(
    context: LeaveContext,
    requestId: string,
    input: Parameters<LeaveOperations["acknowledge"]>[2],
  ): Promise<LeaveResult<LeaveRequestParentProjection>> {
    return this.execute(() => {
      const member = this.member(context, "leave:apply");
      if (!member) throw new LocalError(403, "UNAVAILABLE");
      return parentProjection(this.service.acknowledge(member, requestId, input));
    });
  }

  public review(
    context: LeaveContext,
    requestId: string,
    input: Parameters<LeaveOperations["review"]>[2],
  ): Promise<LeaveResult<LeaveRequestStaffProjection>> {
    return this.execute(() => {
      const member = this.member(context, "leave:review");
      if (!member) throw new LocalError(403, "UNAVAILABLE");
      const row = this.service.reviewLeave(member, requestId, input);
      if (!row) throw new LocalError(403, "UNAVAILABLE");
      const classRef = this.service
        .bindings(member)
        .find((binding) => binding.studentId === row.studentId)?.classLabel;
      if (!classRef) throw new LocalError(403, "UNAVAILABLE");
      return staffProjection(row, classRef);
    });
  }
}
