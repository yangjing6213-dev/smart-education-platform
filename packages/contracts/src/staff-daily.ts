export type StaffDailyArrivalCode = "ARRIVED_AS_PLANNED" | "LATE" | "ABSENT";
export type StaffDailyHomeworkCode = "COMPLETED" | "IN_PROGRESS" | "NEEDS_SUPPORT";
export type StaffDailyActivityCode = "PARTICIPATED" | "OBSERVED" | "NOT_RECORDED";
export type StaffDailyClassroomCode = "ROUTINE" | "NEEDS_ATTENTION" | "NEEDS_FOLLOW_UP";
export type StaffDailyFollowUpCode = "NONE" | "OBSERVE_TOMORROW" | "OWNER_ATTENTION";

export interface StaffDailyValues {
  readonly arrival: StaffDailyArrivalCode;
  readonly homework: StaffDailyHomeworkCode;
  readonly activity: StaffDailyActivityCode;
  readonly classroom: StaffDailyClassroomCode;
  readonly followUp: StaffDailyFollowUpCode;
}

export type StaffDailySourceKind =
  "TASK" | "ATTENDANCE" | "CARE_RECORD" | "PICKUP" | "PICKUP_EXCEPTION";

export interface StaffDailySourceReference {
  readonly kind: StaffDailySourceKind;
  readonly id: string;
  readonly version: number;
}

export type StaffDailyStatus = "DRAFT" | "SUBMITTED" | "RETURNED" | "CONFIRMED";

export type StaffDailyAuditAction =
  | "CREATED"
  | "EDITED"
  | "SUBMITTED"
  | "RESUBMITTED"
  | "REVIEW_CONFIRMED"
  | "REVIEW_RETURNED"
  | "CONFIRMATION_WITHDRAWN"
  | "SOURCES_INVALIDATED";

export interface StaffDailyAuditEvent {
  readonly action: StaffDailyAuditAction;
  readonly reportVersion: number;
  readonly actorLabel: string | null;
  readonly initiatedByLabel: string;
  readonly occurredAt: string;
}

export interface StaffDailyReport {
  readonly id: string;
  readonly version: number;
  readonly kind: "staffDaily";
  readonly tenantId: string;
  readonly campusId: string;
  readonly classId: string;
  readonly date: string;
  readonly values: StaffDailyValues;
  readonly sourceRefs: readonly StaffDailySourceReference[];
  readonly status: StaffDailyStatus;
  readonly createdBy: string;
  readonly reviewedBy: string | null;
  readonly updatedBy: string;
  readonly updatedAt: string;
}
