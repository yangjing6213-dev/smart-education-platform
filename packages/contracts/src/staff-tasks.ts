export const STAFF_TASK_TITLES = {
  DAILY_CHECK: "完成班级日常检查",
  TEMPORARY_SUPPORT: "处理临时工作事项",
  STUDENT_FOLLOW_UP: "完成学生事项跟进",
  ACTIVITY_SETUP: "完成活动准备",
  SAFETY_RESPONSE: "跟进安全与设施事项",
} as const;
export const STAFF_TASK_ACTIVITY_LABELS = {
  ART_WORKSHOP: "美术活动",
  OUTDOOR_ACTIVITY: "户外活动",
  FAMILY_OPEN_DAY: "家长开放日",
} as const;
export type StaffTaskAction = "claim" | "start" | "complete" | "check" | "cancel";
export interface InvitedStaffTaskView {
  readonly id: string;
  readonly version: number;
  readonly code: keyof typeof STAFF_TASK_TITLES;
  readonly title: string;
  readonly targetType: "CLASS" | "STUDENT" | "ACTIVITY" | "CAMPUS";
  readonly targetLabel: string;
  readonly dueDate: string;
  readonly priority: "NORMAL" | "IMPORTANT" | "URGENT";
  readonly status:
    "ASSIGNED" | "CLAIMED" | "IN_PROGRESS" | "COMPLETED" | "CHECKED" | "RETURNED" | "CANCELLED";
  readonly result: "COMPLETED_AS_PLANNED" | "FOLLOW_UP_REQUIRED" | "BLOCKED" | null;
  readonly assigneeLabel: string;
  readonly creatorLabel: string;
  readonly checkerLabel: string | null;
  readonly updatedAt: string;
  readonly overdue: boolean;
  readonly actions: readonly StaffTaskAction[];
}
export interface StaffTaskAssignmentChoice {
  readonly assigneeRef: string;
  readonly assigneeLabel: string;
  readonly classRef: string;
  readonly targetType: InvitedStaffTaskView["targetType"];
  readonly targetRef: string;
  readonly targetLabel: string;
}
