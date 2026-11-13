import { exactBody, LocalError } from "./binding-leave.service.js";
import { memberForActor, LOCAL_STUDENTS, type LocalMember } from "./sessions.js";
import {
  STAFF_TASK_ACTIVITY_LABELS,
  type StaffTaskAssignmentChoice,
  type InvitedStaffTaskView,
} from "@student-care/contracts";
import { taskActions } from "../modules/tasks/staff-task-actions.js";
import { StaffTaskService } from "./task-assignment.service.js";
import type {
  StaffTaskWorkbenchContext,
  StaffTaskWorkbenchOperations,
} from "../nest/api-tokens.js";

const TASK_CAPABILITIES = [
  "task:read",
  "task:assign",
  "task:claim",
  "task:start",
  "task:complete",
  "task:check",
  "task:cancel",
] as const;

export class LocalSyntheticNestStaffTaskWorkbenchAdapter implements StaffTaskWorkbenchOperations {
  public constructor(private readonly tasks: StaffTaskService) {}

  public list(context: StaffTaskWorkbenchContext) {
    const member = this.member(context);
    return {
      tasks: this.tasks
        .list(member)
        .filter((row) => row.assigneeId === member.actorId)
        .map((row) => this.view(row, member)),
    };
  }

  private view(
    row: ReturnType<StaffTaskService["list"]>[number],
    member: LocalMember,
  ): InvitedStaffTaskView {
    return {
      id: row.id,
      version: row.version,
      code: row.code,
      title: row.title,
      targetType: row.targetType,
      targetLabel: row.targetLabel,
      dueDate: row.dueDate,
      priority: row.priority,
      status: row.status,
      result: row.result,
      assigneeLabel: row.assigneeLabel,
      creatorLabel: row.creatorLabel,
      checkerLabel: row.checkerLabel,
      updatedAt: row.updatedAt,
      overdue: row.overdue,
      actions: taskActions(
        row.status,
        member.actions,
        row.assigneeId === member.actorId,
        row.claimedBy === member.actorId,
      ),
    };
  }

  private choices(member: LocalMember): StaffTaskAssignmentChoice[] {
    if (!member.actions.includes("task:assign")) return [];
    return this.tasks.assignees(member).flatMap((assignee) =>
      assignee.classIds
        .filter((classRef) => member.classIds.includes(classRef))
        .flatMap((classRef) => {
          const base = { assigneeRef: assignee.actorId, assigneeLabel: assignee.label, classRef };
          return [
            {
              ...base,
              targetType: "CLASS" as const,
              targetRef: classRef,
              targetLabel: "当前授权班级",
            },
            ...LOCAL_STUDENTS.filter(
              (student) =>
                student.tenantId === member.tenantId &&
                student.campusId === member.campusId &&
                student.classId === classRef,
            ).map((student) => ({
              ...base,
              targetType: "STUDENT" as const,
              targetRef: student.id,
              targetLabel: student.label,
            })),
            ...Object.entries(STAFF_TASK_ACTIVITY_LABELS).map(([targetRef, targetLabel]) => ({
              ...base,
              targetType: "ACTIVITY" as const,
              targetRef,
              targetLabel,
            })),
            {
              ...base,
              targetType: "CAMPUS" as const,
              targetRef: member.campusId,
              targetLabel: "当前授权校区",
            },
          ];
        }),
    );
  }

  public adminList(context: StaffTaskWorkbenchContext) {
    const member = this.member(context);
    if (
      !["task:assign", "task:check", "task:cancel"].some((cap) =>
        member.actions.includes(cap as never),
      )
    )
      throw new LocalError(403, "UNAVAILABLE");
    return {
      tasks: this.tasks
        .list({ ...member, actions: [...member.actions, "task:check"] })
        .map((row) => this.view(row, member)),
      choices: this.choices(member),
      canAssign: member.actions.includes("task:assign"),
    };
  }

  public create(context: StaffTaskWorkbenchContext, body: unknown) {
    const member = this.member(context);
    const value = exactBody(body, [
      "code",
      "assigneeRef",
      "classRef",
      "targetType",
      "targetRef",
      "dueDate",
      "priority",
    ]);
    const choice = this.choices(member).find(
      (item) =>
        item.assigneeRef === value.assigneeRef &&
        item.classRef === value.classRef &&
        item.targetType === value.targetType &&
        item.targetRef === value.targetRef,
    );
    if (!choice) throw new LocalError(403, "UNAVAILABLE");
    return this.view(
      this.tasks.create(
        { ...member, classIds: [choice.classRef] },
        {
          code: value.code,
          assigneeId: choice.assigneeRef,
          targetType: choice.targetType,
          targetId: choice.targetRef,
          dueDate: value.dueDate,
          priority: value.priority,
        },
      ),
      member,
    );
  }

  public check(context: StaffTaskWorkbenchContext, id: string, body: unknown) {
    const member = this.member(context);
    return this.view(this.tasks.check(member, id, body), member);
  }

  public cancel(context: StaffTaskWorkbenchContext, id: string, body: unknown) {
    const member = this.member(context);
    return this.view(this.tasks.cancel(member, id, body), member);
  }

  public claim(context: StaffTaskWorkbenchContext, taskId: string, body: unknown) {
    const member = this.member(context);
    return this.view(this.tasks.claim(member, taskId, body), member);
  }

  public start(context: StaffTaskWorkbenchContext, taskId: string, body: unknown) {
    const member = this.member(context);
    return this.view(this.tasks.start(member, taskId, body), member);
  }

  public complete(context: StaffTaskWorkbenchContext, taskId: string, body: unknown) {
    const member = this.member(context);
    return this.view(this.tasks.complete(member, taskId, body), member);
  }

  private member(context: StaffTaskWorkbenchContext): LocalMember {
    const profile = memberForActor(context.actorId);
    if (
      !profile ||
      profile.tenantId !== context.tenantId ||
      profile.campusId !== context.campusId
    ) {
      throw new LocalError(403, "UNAVAILABLE");
    }
    const capabilities = new Set(context.capabilities);
    const actions = profile.actions.filter(
      (action) =>
        (TASK_CAPABILITIES as readonly string[]).includes(action) && capabilities.has(action),
    );
    if (!actions.includes("task:read")) throw new LocalError(403, "UNAVAILABLE");
    return { ...profile, actions };
  }
}
