export const LEAVE_REQUEST_STATUSES = ["SUBMITTED", "RETURNED", "CONFIRMED", "WITHDRAWN"] as const;
export type LeaveRequestStatus = (typeof LEAVE_REQUEST_STATUSES)[number];

export const LEAVE_REASON_CATEGORIES = ["FAMILY_ARRANGEMENT", "TEMPORARY_MATTER"] as const;
export type LeaveReasonCategory = (typeof LEAVE_REASON_CATEGORIES)[number];

export const LEAVE_REVIEW_ACTIONS = ["confirm", "return"] as const;
export type LeaveReviewAction = (typeof LEAVE_REVIEW_ACTIONS)[number];

export const LEAVE_REQUEST_ACTIONS = [
  "resubmit",
  "withdraw",
  "acknowledge",
  "confirm",
  "return",
] as const;
export type LeaveRequestAction = (typeof LEAVE_REQUEST_ACTIONS)[number];

export interface LeaveRequestCreateInput {
  readonly student_id: string;
  readonly start_date: string;
  readonly end_date: string;
  readonly reason_category: LeaveReasonCategory;
}

export interface LeaveRequestResubmitInput {
  readonly version: number;
  readonly start_date: string;
  readonly end_date: string;
  readonly reason_category: LeaveReasonCategory;
}

export interface LeaveRequestVersionInput {
  readonly version: number;
}

export interface LeaveRequestReviewInput extends LeaveRequestVersionInput {
  readonly action: LeaveReviewAction;
}

export interface LeaveRequestParentProjection {
  readonly id: string;
  readonly student_id: string;
  readonly student_display_ref: string;
  readonly start_date: string;
  readonly end_date: string;
  readonly reason_category: LeaveReasonCategory;
  readonly status: LeaveRequestStatus;
  readonly version: number;
  readonly acknowledged: boolean;
  readonly actions: readonly LeaveRequestAction[];
  readonly updated_at: string;
}

export interface LeaveRequestStaffProjection extends LeaveRequestParentProjection {
  readonly class_ref: string;
}
