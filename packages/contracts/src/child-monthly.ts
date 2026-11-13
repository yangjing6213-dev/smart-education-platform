import type { MonthlyFeedbackStatus, MonthlyFeedbackSupplements } from "./monthly-feedback.js";

export type ChildMonthlyAction = "edit" | "submit" | "confirm" | "return" | "publish";

export interface ChildMonthlySourceCounts {
  readonly GROWTH_RECORD: number;
  readonly ATTENDANCE_OVERVIEW: number;
}

export interface ChildMonthlyStaffReport {
  readonly id: string;
  readonly studentId: string;
  readonly studentLabel: string;
  readonly classRef: string;
  readonly month: string;
  readonly status: MonthlyFeedbackStatus;
  readonly version: number;
  readonly sourceVersion: number;
  readonly publicationVersion: number;
  readonly supplements: MonthlyFeedbackSupplements;
  readonly sourceCounts: ChildMonthlySourceCounts;
  readonly actions: readonly ChildMonthlyAction[];
}

export interface ChildMonthlyStudentOption {
  readonly id: string;
  readonly displayRef: string;
  readonly classRef: string;
}

export interface ChildMonthlyStaffList {
  readonly records: readonly ChildMonthlyStaffReport[];
  readonly students: readonly ChildMonthlyStudentOption[];
}

export interface ChildMonthlyParentSummary {
  readonly id: string;
  readonly studentId: string;
  readonly studentLabel: string;
  readonly month: string;
  readonly publicationVersion: number;
  readonly relationshipVersion: number;
  readonly supplements: MonthlyFeedbackSupplements;
  readonly sourceCounts: ChildMonthlySourceCounts;
  readonly acknowledged: boolean;
}

export interface ChildMonthlyParentList {
  readonly records: readonly ChildMonthlyParentSummary[];
}

export interface ChildMonthlyCreateInput {
  readonly studentId: string;
  readonly month: string;
  readonly supplements: MonthlyFeedbackSupplements;
}

export interface ChildMonthlyEditInput {
  readonly version: number;
  readonly supplements: MonthlyFeedbackSupplements;
}

export interface ChildMonthlyVersionInput {
  readonly version: number;
}

export interface ChildMonthlyReviewInput {
  readonly version: number;
  readonly action: "CONFIRM" | "RETURN";
}

export interface ChildMonthlyAcknowledgeInput {
  readonly publicationVersion: number;
  readonly relationshipVersion: number;
}

export interface ChildMonthlyAcknowledgement {
  readonly acknowledged: true;
}
