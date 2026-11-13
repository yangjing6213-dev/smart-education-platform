export type ConsentPurposeKey = "CARE_RECORD" | "HEALTH_SUPPORT" | "LEARNING_SUPPORT";
export interface ConsentPurposeDefinition {
  readonly key: ConsentPurposeKey;
  readonly title: string;
  readonly noticeVersion: string;
  readonly consentVersion: "LEARNING_DEMO_V2" | null;
  readonly policyVersion: "AI_LEARNING_POLICY_SYNTHETIC_V1" | null;
  readonly necessity: string;
  readonly dataClasses: readonly string[];
  readonly retentionDays: number;
  readonly retentionNotice: string;
  readonly impactReviewStatus: "DEMO_ONLY_PENDING_HUMAN_REVIEW";
}
export type ConsentStatus = "ACTIVE" | "REVOKED";
export type ConsentRetentionStatus =
  "WITHIN_PERIOD" | "REVIEW_DUE" | "REQUIRED_HOLD" | "SIMULATED_EXPIRED";
export type ConsentEventAction = "GRANT" | "REVOKE" | "REQUIRED_HOLD" | "SIMULATE_EXPIRY";

export interface ConsentRecordEvent {
  readonly version: number;
  readonly action: ConsentEventAction;
  readonly actorId: string;
  readonly occurredAt: string;
  readonly dataChanged: false;
}

export interface ConsentRecord {
  readonly id: string;
  readonly version: number;
  readonly bindingId: string;
  readonly purposeKey: ConsentPurposeKey;
  readonly purposeTitle: string;
  readonly noticeVersion: string;
  readonly consentVersion: "LEARNING_DEMO_V2" | null;
  readonly policyVersion: "AI_LEARNING_POLICY_SYNTHETIC_V1" | null;
  readonly necessity: string;
  readonly dataClasses: readonly string[];
  readonly impactReviewStatus: "DEMO_ONLY_PENDING_HUMAN_REVIEW";
  readonly authorizedByActorId: string;
  readonly authorizedAt: string;
  readonly revokedAt: string | null;
  readonly retentionDays: number;
  readonly retainUntil: string;
  readonly retentionStatus: ConsentRetentionStatus;
  readonly retentionOutcomeNotice: string | null;
  readonly status: ConsentStatus;
  readonly dataChanged: false;
  readonly history: readonly ConsentRecordEvent[];
}
