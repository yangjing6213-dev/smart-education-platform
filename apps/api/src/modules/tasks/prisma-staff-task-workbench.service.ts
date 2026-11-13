import {
  STAFF_TASK_TITLES,
  STAFF_TASK_ACTIVITY_LABELS,
  type StaffTaskAssignmentChoice,
  type InvitedStaffTaskView,
} from "@student-care/contracts";
import { Prisma, type PrismaClient } from "../../generated/prisma/client.js";
import type { InviteAccountConfiguration } from "../../nest/invite-auth.service.js";
import type {
  StaffTaskWorkbenchContext,
  StaffTaskWorkbenchOperations,
} from "../../nest/api-tokens.js";
import {
  taskActions,
  validTaskDate,
  shanghaiTaskDate,
  uniqueTaskMembership,
} from "./staff-task-actions.js";

type Database = PrismaClient | Prisma.TransactionClient;
type Directory = readonly Pick<InviteAccountConfiguration, "identity" | "memberships">[];
type Staff = StaffTaskWorkbenchContext & {
  readonly membershipId: string;
  readonly classRefs: readonly string[];
};
const memberInclude = {
  membership: { select: { userId: true, status: true, user: { select: { status: true } } } },
  classAssignments: { select: { classRef: true } },
} as const;
const taskInclude = {
  assignee: { include: memberInclude },
  createdBy: { select: { membership: { select: { userId: true } } } },
  claimedBy: { select: { membership: { select: { userId: true } } } },
  completedBy: { select: { membership: { select: { userId: true } } } },
  checkedBy: { select: { membership: { select: { userId: true } } } },
  student: { select: { status: true, classRef: true, displayRef: true } },
} as const;
type Task = Prisma.WorkTaskGetPayload<{ include: typeof taskInclude }>;
class TaskFailure extends Error {
  public constructor(
    public readonly statusCode: number,
    public readonly code: string,
  ) {
    super(code);
  }
}
const forbidden = () => new TaskFailure(403, "FORBIDDEN_SCOPE");
const invalid = () => new TaskFailure(400, "VALIDATION_FAILED");
const missing = () => new TaskFailure(404, "NOT_FOUND_SCOPED");
const conflict = () => new TaskFailure(409, "CONFLICT_STATE");
function exact(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length === keys.length &&
    Object.keys(value).every((key) => keys.includes(key))
  );
}
function text(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 80;
}
function version(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1) throw invalid();
  return Number(value);
}
function scopeWhere(staff: Staff) {
  return {
    tenantId: staff.tenantId,
    campusId: staff.campusId,
    classRef: { in: [...staff.classRefs] },
  };
}
function activeAssignment(row: Task): boolean {
  return (
    row.assignee.membership.status === "ACTIVE" &&
    row.assignee.membership.user.status === "ACTIVE" &&
    row.assignee.classAssignments.some((item) => item.classRef === row.classRef) &&
    (!row.student || (row.student.status === "ACTIVE" && row.student.classRef === row.classRef))
  );
}

export class PrismaStaffTaskWorkbenchService implements StaffTaskWorkbenchOperations {
  public constructor(
    private readonly prisma: PrismaClient,
    private readonly directory: Directory = [],
    private readonly now: () => number = Date.now,
  ) {}

  private async staff(
    database: Database,
    context: StaffTaskWorkbenchContext,
    required: readonly string[],
  ): Promise<Staff> {
    if (!required.every((cap) => context.capabilities.includes(cap))) throw forbidden();
    const members = await database.membershipCampus.findMany({
      where: {
        tenantId: context.tenantId,
        campusId: context.campusId,
        campus: { status: "ACTIVE" },
        membership: {
          userId: context.actorId,
          status: "ACTIVE",
          user: { status: "ACTIVE" },
          tenant: { status: "ACTIVE" },
        },
      },
      select: { membershipId: true, classAssignments: { select: { classRef: true } } },
    });
    if (members.length !== 1) throw forbidden();
    return {
      ...context,
      membershipId: members[0]!.membershipId,
      classRefs: members[0]!.classAssignments.map((item) => item.classRef),
    };
  }

  private label(actorId: string | undefined, fallback: string): string {
    return (
      this.directory.find((account) => account.identity.actor_id === actorId)?.identity
        .display_name || fallback
    );
  }

  private view(row: Task, staff: Staff): InvitedStaffTaskView {
    const own = row.assignee.membership.userId === staff.actorId;
    const labels = STAFF_TASK_ACTIVITY_LABELS as Readonly<Record<string, string>>;
    return {
      id: row.id,
      version: row.version,
      code: row.code,
      title: STAFF_TASK_TITLES[row.code],
      targetType: row.targetType,
      targetLabel:
        row.targetType === "STUDENT"
          ? (row.student?.displayRef ?? "已停用学生")
          : row.targetType === "ACTIVITY"
            ? (labels[row.targetRef] ?? "活动事项")
            : row.targetType === "CLASS"
              ? "当前授权班级"
              : "当前授权校区",
      dueDate: row.dueDate.toISOString().slice(0, 10),
      priority: row.priority,
      status: row.status,
      result: row.result,
      assigneeLabel: this.label(row.assignee.membership.userId, "执行员工"),
      creatorLabel: this.label(row.createdBy.membership.userId, "分派负责人"),
      checkerLabel: row.checkedBy
        ? this.label(row.checkedBy.membership.userId, "检查负责人")
        : null,
      updatedAt: row.updatedAt.toISOString(),
      overdue:
        row.dueDate.toISOString().slice(0, 10) < shanghaiTaskDate(this.now()) &&
        row.status !== "CHECKED" &&
        row.status !== "CANCELLED",
      actions: taskActions(
        row.status,
        staff.capabilities,
        own,
        row.claimedBy?.membership.userId === staff.actorId,
        activeAssignment(row),
      ),
    };
  }

  public list(context: StaffTaskWorkbenchContext): Promise<unknown> {
    return this.execute(() =>
      this.prisma.$transaction(async (database) => {
        const staff = await this.staff(database, context, ["task:read"]);
        const rows = await database.workTask.findMany({
          where: { ...scopeWhere(staff), assigneeMembershipId: staff.membershipId },
          include: { student: taskInclude.student },
          orderBy: [{ dueDate: "asc" }, { id: "asc" }],
        });
        if (rows.length === 0) return { tasks: [] };

        // Sibling relation reads would share one pg connection inside this transaction.
        const scope = { tenantId: staff.tenantId, campusId: staff.campusId };
        const membershipIds = new Set([staff.membershipId]);
        for (const row of rows) {
          membershipIds.add(row.createdByMembershipId);
          if (row.claimedByMembershipId) membershipIds.add(row.claimedByMembershipId);
          if (row.completedByMembershipId) membershipIds.add(row.completedByMembershipId);
          if (row.checkedByMembershipId) membershipIds.add(row.checkedByMembershipId);
        }
        const people = await database.membershipCampus.findMany({
          where: { ...scope, membershipId: { in: [...membershipIds] } },
          include: { membership: memberInclude.membership },
        });
        const byId = new Map(people.map((person) => [person.membershipId, person]));
        function person(id: string) {
          const matched = byId.get(id);
          if (!matched) throw new Error("Missing staff task membership.");
          return matched;
        }
        const optionalPerson = (id: string | null) => (id ? (byId.get(id) ?? null) : null);
        const classAssignments = await database.membershipClass.findMany({
          where: { ...scope, membershipId: staff.membershipId },
          select: { classRef: true },
        });
        const assignee = { ...person(staff.membershipId), classAssignments };
        return {
          tasks: rows.map((row) =>
            this.view(
              {
                ...row,
                assignee,
                createdBy: person(row.createdByMembershipId),
                claimedBy: optionalPerson(row.claimedByMembershipId),
                completedBy: optionalPerson(row.completedByMembershipId),
                checkedBy: optionalPerson(row.checkedByMembershipId),
              },
              staff,
            ),
          ),
        };
      }),
    );
  }

  private async choices(database: Database, staff: Staff): Promise<StaffTaskAssignmentChoice[]> {
    if (!staff.capabilities.includes("task:assign")) return [];
    const eligible = this.directory.filter((account) => {
      const membership = uniqueTaskMembership(account.memberships, ["task:read"]);
      return (
        membership &&
        membership.tenant_id === staff.tenantId &&
        membership.campus_ids[0] === staff.campusId &&
        ["task:claim", "task:start", "task:complete"].every((capability) =>
          membership.capabilities.includes(capability as never),
        )
      );
    });
    const members = await database.membershipCampus.findMany({
      where: {
        tenantId: staff.tenantId,
        campusId: staff.campusId,
        membership: {
          status: "ACTIVE",
          user: { status: "ACTIVE" },
          userId: { in: eligible.map((account) => account.identity.actor_id) },
        },
      },
      include: memberInclude,
    });
    const students = await database.student.findMany({
      where: {
        tenantId: staff.tenantId,
        campusId: staff.campusId,
        status: "ACTIVE",
        classRef: { in: [...staff.classRefs] },
      },
      select: { id: true, classRef: true, displayRef: true },
    });
    return members.flatMap((member) => {
      if (
        members.filter((other) => other.membership.userId === member.membership.userId).length !== 1
      )
        return [];
      const base = {
        assigneeRef: member.membershipId,
        assigneeLabel: this.label(member.membership.userId, "执行员工"),
      };
      return member.classAssignments
        .filter((item) => staff.classRefs.includes(item.classRef))
        .flatMap(({ classRef }) => [
          {
            ...base,
            classRef,
            targetType: "CLASS" as const,
            targetRef: classRef,
            targetLabel: "当前授权班级",
          },
          ...students
            .filter((student) => student.classRef === classRef)
            .map((student) => ({
              ...base,
              classRef,
              targetType: "STUDENT" as const,
              targetRef: student.id,
              targetLabel: student.displayRef,
            })),
          ...Object.entries(STAFF_TASK_ACTIVITY_LABELS).map(([targetRef, targetLabel]) => ({
            ...base,
            classRef,
            targetType: "ACTIVITY" as const,
            targetRef,
            targetLabel,
          })),
          {
            ...base,
            classRef,
            targetType: "CAMPUS" as const,
            targetRef: staff.campusId,
            targetLabel: "当前授权校区",
          },
        ]);
    });
  }

  public adminList(context: StaffTaskWorkbenchContext): Promise<unknown> {
    return this.execute(() =>
      this.prisma.$transaction(async (database) => {
        const staff = await this.staff(database, context, ["task:read"]);
        if (
          !["task:assign", "task:check", "task:cancel"].some((cap) =>
            staff.capabilities.includes(cap),
          )
        )
          throw forbidden();
        const rows = await database.workTask.findMany({
          where: scopeWhere(staff),
          include: taskInclude,
          orderBy: [{ dueDate: "asc" }, { id: "asc" }],
        });
        return {
          tasks: rows.map((row) => this.view(row, staff)),
          choices: await this.choices(database, staff),
          canAssign: staff.capabilities.includes("task:assign"),
        };
      }),
    );
  }

  public create(context: StaffTaskWorkbenchContext, body: unknown): Promise<unknown> {
    return this.execute(() =>
      this.prisma.$transaction(
        async (database) => {
          const staff = await this.staff(database, context, ["task:read", "task:assign"]);
          if (
            !exact(body, [
              "code",
              "assigneeRef",
              "classRef",
              "targetType",
              "targetRef",
              "dueDate",
              "priority",
            ]) ||
            typeof body.code !== "string" ||
            !Object.hasOwn(STAFF_TASK_TITLES, body.code) ||
            !text(body.assigneeRef) ||
            !text(body.classRef) ||
            !text(body.targetRef) ||
            !["CLASS", "STUDENT", "ACTIVITY", "CAMPUS"].includes(String(body.targetType)) ||
            !validTaskDate(body.dueDate) ||
            !["NORMAL", "IMPORTANT", "URGENT"].includes(String(body.priority))
          )
            throw invalid();
          const choices = await this.choices(database, staff);
          const choice = choices.find(
            (item) =>
              item.assigneeRef === body.assigneeRef &&
              item.classRef === body.classRef &&
              item.targetType === body.targetType &&
              item.targetRef === body.targetRef,
          );
          if (!choice) throw forbidden();
          const row = await database.workTask.create({
            data: {
              tenantId: staff.tenantId,
              campusId: staff.campusId,
              classRef: choice.classRef,
              code: body.code as Task["code"],
              targetType: choice.targetType,
              targetRef: choice.targetRef,
              studentId: choice.targetType === "STUDENT" ? choice.targetRef : null,
              dueDate: new Date(body.dueDate + "T00:00:00Z"),
              priority: body.priority as Task["priority"],
              createdByMembershipId: staff.membershipId,
              assigneeMembershipId: choice.assigneeRef,
              updatedByMembershipId: staff.membershipId,
            },
            include: taskInclude,
          });
          return this.view(row, staff);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
  }

  public claim(context: StaffTaskWorkbenchContext, id: string, body: unknown) {
    return this.mutate(context, id, body, "claim");
  }
  public start(context: StaffTaskWorkbenchContext, id: string, body: unknown) {
    return this.mutate(context, id, body, "start");
  }
  public complete(context: StaffTaskWorkbenchContext, id: string, body: unknown) {
    return this.mutate(context, id, body, "complete");
  }
  public check(context: StaffTaskWorkbenchContext, id: string, body: unknown) {
    return this.mutate(context, id, body, "check");
  }
  public cancel(context: StaffTaskWorkbenchContext, id: string, body: unknown) {
    return this.mutate(context, id, body, "cancel");
  }

  private mutate(
    context: StaffTaskWorkbenchContext,
    id: string,
    body: unknown,
    action: "claim" | "start" | "complete" | "check" | "cancel",
  ): Promise<unknown> {
    return this.execute(() =>
      this.prisma.$transaction(
        async (database) => {
          const staff = await this.staff(database, context, ["task:read", "task:" + action]);
          if (
            !exact(
              body,
              action === "complete"
                ? ["version", "result"]
                : action === "check"
                  ? ["version", "action"]
                  : ["version"],
            )
          )
            throw invalid();
          const expected = version(body.version);
          if (
            action === "complete" &&
            !["COMPLETED_AS_PLANNED", "FOLLOW_UP_REQUIRED", "BLOCKED"].includes(String(body.result))
          )
            throw invalid();
          if (action === "check" && body.action !== "CONFIRM" && body.action !== "RETURN")
            throw invalid();
          const where = {
            ...scopeWhere(staff),
            id,
            ...(["claim", "start", "complete"].includes(action)
              ? { assigneeMembershipId: staff.membershipId }
              : {}),
          };
          const row = await database.workTask.findFirst({ where, include: taskInclude });
          if (!row) throw missing();
          if (
            action === "check" &&
            (row.assignee.membership.userId === staff.actorId ||
              row.completedBy?.membership.userId === staff.actorId)
          )
            throw forbidden();
          if (action !== "cancel" && !activeAssignment(row)) throw forbidden();
          if (row.version !== expected || !this.view(row, staff).actions.includes(action))
            throw conflict();
          const patch: Prisma.WorkTaskUncheckedUpdateManyInput = {
            version: { increment: 1 },
            updatedByMembershipId: staff.membershipId,
          };
          if (action === "claim") {
            patch.status = "CLAIMED";
            patch.claimedByMembershipId = staff.membershipId;
            patch.checkedByMembershipId = null;
          }
          if (action === "start") patch.status = "IN_PROGRESS";
          if (action === "complete") {
            patch.status = "COMPLETED";
            patch.result = body.result as Task["result"];
            patch.completedByMembershipId = staff.membershipId;
          }
          if (action === "check") {
            patch.status = body.action === "CONFIRM" ? "CHECKED" : "RETURNED";
            patch.checkedByMembershipId = staff.membershipId;
          }
          if (action === "cancel") patch.status = "CANCELLED";
          const changed = await database.workTask.updateMany({
            where: { ...where, version: expected, status: row.status },
            data: patch,
          });
          if (changed.count !== 1) throw conflict();
          const updated = await database.workTask.findFirstOrThrow({ where, include: taskInclude });
          return this.view(updated, staff);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
  }

  private async execute<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error) {
        if (["P2034", "P2002", "P2025"].includes(String(error.code))) throw conflict();
        if (error.code === "P2003") throw missing();
      }
      throw error;
    }
  }
}
