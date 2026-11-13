export type MonthlyFeedbackSupplementCode = "KEEP_WATCHING" | "PROGRESSING" | "FOLLOW_UP";

export type MonthlyFeedbackItem =
  | "LEARNING_PARTICIPATION"
  | "DAILY_HABITS"
  | "ACTIVITY_PARTICIPATION"
  | "FAMILY_SCHOOL_COLLABORATION";

export interface MonthlyFeedbackSupplements {
  readonly learningParticipation: MonthlyFeedbackSupplementCode;
  readonly dailyHabits: MonthlyFeedbackSupplementCode;
  readonly activityParticipation: MonthlyFeedbackSupplementCode;
  readonly familySchoolCollaboration: MonthlyFeedbackSupplementCode;
}

export type MonthlyFeedbackSourceKind = "GROWTH_RECORD" | "ATTENDANCE_OVERVIEW" | "STAFF_DAILY";

export interface MonthlyFeedbackSource {
  readonly kind: MonthlyFeedbackSourceKind;
  readonly id: string;
  readonly version: number;
  readonly date: string;
}

export interface MonthlyFeedbackSourceSummary {
  readonly kind: MonthlyFeedbackSourceKind;
  readonly label: string;
  readonly count: number;
  readonly dates: readonly string[];
}

export type MonthlyFeedbackStatus =
  "DRAFT" | "SUBMITTED" | "RETURNED" | "CONFIRMED" | "PUBLISHED" | "REVIEW_REQUIRED";

export interface MonthlyFeedback extends ScopedRow {
  readonly kind: "monthlyFeedback";
  readonly month: string;
  readonly sourceVersion: number;
  readonly sources: readonly MonthlyFeedbackSource[];
  readonly supplements: MonthlyFeedbackSupplements;
  readonly status: MonthlyFeedbackStatus;
  readonly createdBy: string;
  readonly reviewedBy: string | null;
  readonly published: boolean;
  readonly parentAcknowledgedBy: readonly string[];
  readonly updatedBy: string;
  readonly updatedAt: string;
}

export interface ScopedRow {
  readonly id: string;
  readonly version: number;
  readonly tenantId: string;
  readonly campusId: string;
  readonly classId: string;
}

export interface MonthlyFeedbackParentSummary {
  readonly id: string;
  readonly version: number;
  readonly month: string;
  readonly status: "PUBLISHED" | "REVIEW_REQUIRED";
  readonly items: ReadonlyArray<{
    readonly label: string;
    readonly value: MonthlyFeedbackSupplementCode;
  }>;
  readonly acknowledged: boolean;
  readonly synthetic: true;
}
