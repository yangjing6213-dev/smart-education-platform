export const ATTENDANCE_STATUSES = ["NOT_ARRIVED", "ARRIVED", "DEPARTED"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const ATTENDANCE_CORRECTION_STATUSES = ["PENDING", "APPROVED", "RETURNED"] as const;
export type AttendanceCorrectionStatus = (typeof ATTENDANCE_CORRECTION_STATUSES)[number];

export const ATTENDANCE_CORRECTION_REASONS = [
  "TIME_ENTRY_ERROR",
  "EVENT_ENTRY_ERROR",
  "LATE_ENTRY",
] as const;
export type AttendanceCorrectionReason = (typeof ATTENDANCE_CORRECTION_REASONS)[number];

export const ATTENDANCE_REVISION_ACTIONS = [
  "MIGRATED",
  "CREATED",
  "ARRIVED",
  "DEPARTED",
  "CORRECTION_REQUESTED",
  "CORRECTION_APPROVED",
  "CORRECTION_RETURNED",
] as const;
export type AttendanceRevisionAction = (typeof ATTENDANCE_REVISION_ACTIONS)[number];

export const ATTENDANCE_ACTIONS = [
  "create",
  "arrive",
  "depart",
  "correct",
  "approve",
  "return",
] as const;
export type AttendanceAction = (typeof ATTENDANCE_ACTIONS)[number];

export interface AttendanceValues {
  readonly status: AttendanceStatus;
  readonly arrival_time: string | null;
  readonly departure_time: string | null;
}

export interface AttendanceCreateInput {
  readonly student_id: string;
  readonly service_date: string;
}

export interface AttendanceTransitionInput {
  readonly version: number;
  readonly time: string;
}

export interface AttendanceCorrectionInput {
  readonly version: number;
  readonly reason: AttendanceCorrectionReason;
  readonly proposed: AttendanceValues;
}

export interface AttendanceReviewInput {
  readonly version: number;
  readonly action: "approve" | "return";
}

export interface AttendanceStaffStudentProjection {
  readonly id: string;
  readonly student_display_ref: string;
  readonly class_ref: string;
}

export interface AttendanceStaffProjection extends AttendanceValues {
  readonly id: string;
  readonly student_id: string;
  readonly student_display_ref: string;
  readonly class_ref: string;
  readonly service_date: string;
  readonly corrected: boolean;
  readonly version: number;
  readonly correction_status: AttendanceCorrectionStatus | null;
  readonly actions: readonly AttendanceAction[];
}

export interface AttendanceParentProjection {
  readonly id: string;
  readonly service_date: string;
  readonly status: AttendanceStatus;
  readonly arrival_time: string | null;
  readonly departure_time: string | null;
  readonly corrected: boolean;
  readonly confirmed_leave: boolean;
}
