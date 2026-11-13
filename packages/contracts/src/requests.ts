import type { ContentBody, ContentType } from "./content.js";

export interface ContentInput {
  readonly type: ContentType;
  readonly title: string;
  readonly body: ContentBody;
}

export interface ContentInputSyntax extends ContentInput {
  readonly campus_id?: string | null;
}

export interface DailyReportInput {
  readonly report_id: string;
  readonly note: string;
  readonly version: number;
}

export interface RelationshipInput {
  readonly student_id: string;
  readonly consent: true;
}

export interface InviteLoginRequest {
  readonly username: string;
  readonly password: string;
}

export interface InviteLoginResponse {
  readonly access_token: string;
  readonly token_type: "Bearer";
  readonly expires_at: string;
}

export interface InviteLogoutResponse {
  readonly logged_out: true;
}

export const GUARDIAN_BINDING_APPLICATION_STATUSES = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "WITHDRAWN",
  "EXPIRED",
] as const;
export type GuardianBindingApplicationStatus =
  (typeof GUARDIAN_BINDING_APPLICATION_STATUSES)[number];

export const GUARDIAN_RELATIONSHIP_STATUSES = ["ACTIVE", "RELEASED"] as const;
export type GuardianRelationshipStatus = (typeof GUARDIAN_RELATIONSHIP_STATUSES)[number];

export const GUARDIAN_RELATIONSHIPS = ["GUARDIAN"] as const;
export type GuardianRelationshipKind = (typeof GUARDIAN_RELATIONSHIPS)[number];

export interface GuardianBindingApplicationInput {
  readonly student_candidate_ref: string;
  readonly relationship: GuardianRelationshipKind;
  readonly consent: true;
}

export interface GuardianBindingStudentOption {
  readonly id: string;
  readonly alias: string;
  readonly label: string;
}

export interface GuardianBindingApplicationReviewInput {
  readonly version: number;
  readonly action: "approve" | "reject";
}

export interface GuardianRelationshipReleaseInput {
  readonly version: number;
}

export interface GuardianBindingApplicationProjection {
  readonly id: string;
  readonly student_candidate_ref: string;
  readonly relationship: GuardianRelationshipKind;
  readonly status: GuardianBindingApplicationStatus;
  readonly version: number;
  readonly submitted_at: string;
  readonly reviewed_at: string | null;
}

export interface GuardianRelationshipProjection {
  readonly id: string;
  readonly student_id: string;
  readonly relationship: GuardianRelationshipKind;
  readonly status: GuardianRelationshipStatus;
  readonly source_application_id: string;
  readonly version: number;
  readonly approved_at: string;
}

export interface LearningStartInput {
  readonly student_id: string;
  readonly supervision: true;
}

export interface ParentLearningControlsInput {
  readonly enabled: boolean;
  readonly maxDurationMinutes: 5 | 10 | 15;
  readonly maxHintLevel: 0 | 1 | 2 | 3;
}

export interface ParentLearningKnowledgePointInput {
  readonly label: "两位数加法" | "两位数加法与进位";
  readonly sessionCount: number;
  readonly completedSessions: number;
}

export interface StaffLearningSummaryInput {
  readonly studentId: string;
  readonly summaryDate: string;
  readonly usedMinutes: number;
  readonly sessionCount: number;
  readonly completedSessions: number;
  readonly knowledgePoints: readonly ParentLearningKnowledgePointInput[];
  readonly attentionCount: number;
}

export interface HintInput {
  readonly session_id: string;
  readonly level: 0 | 1 | 2 | 3;
}

export interface PaginationQuery {
  readonly page_size?: number;
  readonly cursor?: string;
}

export interface RequestHeaders {
  readonly "Idempotency-Key"?: string;
  readonly "If-Match"?: string;
}
