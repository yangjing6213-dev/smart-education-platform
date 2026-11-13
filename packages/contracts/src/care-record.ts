export const CARE_RECORD_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "RETURNED",
  "CONFIRMED",
  "CANCELLED",
  "EXCEPTION_PENDING",
] as const;
export type CareRecordStatus = (typeof CARE_RECORD_STATUSES)[number];

export const CARE_ARRIVALS = ["ARRIVED_AS_PLANNED", "LATE", "ABSENT"] as const;
export type CareArrival = (typeof CARE_ARRIVALS)[number];

export const CARE_HOMEWORK = ["COMPLETED", "IN_PROGRESS", "NEEDS_SUPPORT"] as const;
export type CareHomework = (typeof CARE_HOMEWORK)[number];

export const CARE_MEALS = ["FINISHED", "PARTIAL", "NOT_RECORDED"] as const;
export type CareMeal = (typeof CARE_MEALS)[number];

export const CARE_RESTS = ["RESTED", "QUIET_ACTIVITY", "NOT_RECORDED"] as const;
export type CareRest = (typeof CARE_RESTS)[number];

export const CARE_ACTIVITIES = ["PARTICIPATED", "OBSERVED", "NOT_RECORDED"] as const;
export type CareActivity = (typeof CARE_ACTIVITIES)[number];

export const CARE_WELLBEING = ["ROUTINE", "CHECK_IN", "FOLLOW_UP"] as const;
export type CareWellbeing = (typeof CARE_WELLBEING)[number];

export const CARE_RECORD_RECEIPT_STATUSES = ["UNREAD", "READ", "ACKNOWLEDGED"] as const;
export type CareRecordReceiptStatus = (typeof CARE_RECORD_RECEIPT_STATUSES)[number];

export const CARE_RECORD_ACTIONS = [
  "edit",
  "submit",
  "resubmit",
  "review",
  "publish",
  "withdraw",
  "revoke-publication",
] as const;
export type CareRecordAction = (typeof CARE_RECORD_ACTIONS)[number];

export interface CareRecordValues {
  readonly arrival: CareArrival;
  readonly homework: CareHomework;
  readonly meal: CareMeal;
  readonly rest: CareRest;
  readonly activity: CareActivity;
  readonly wellbeing: CareWellbeing;
}

export interface CareRecordCreateInput {
  readonly student_id: string;
  readonly service_date: string;
  readonly values: CareRecordValues;
}

export interface CareRecordUpdateInput {
  readonly version: number;
  readonly values: CareRecordValues;
}

export interface CareRecordTransitionInput {
  readonly version: number;
}

export interface CareRecordReviewInput extends CareRecordTransitionInput {
  readonly action: "confirm" | "return";
}

export interface CareRecordReceiptInput extends CareRecordTransitionInput {
  readonly publication_version: number;
  readonly action: "read" | "acknowledge";
}

export interface CareRecordStaffProjection {
  readonly id: string;
  readonly student_id: string;
  readonly student_display_ref: string;
  readonly class_ref: string;
  readonly service_date: string;
  readonly values: CareRecordValues;
  readonly status: CareRecordStatus;
  readonly version: number;
  readonly published: boolean;
  readonly publication_version: number;
  readonly updated_at: string;
  readonly actions: readonly CareRecordAction[];
}

export interface CareRecordStudentProjection {
  readonly id: string;
  readonly student_display_ref: string;
  readonly class_ref: string;
}

export interface CareRecordParentProjection {
  readonly id: string;
  readonly student_display_ref: string;
  readonly service_date: string;
  readonly values: CareRecordValues;
  readonly version: number;
  readonly publication_version: number;
  readonly receipt_status: CareRecordReceiptStatus;
}
