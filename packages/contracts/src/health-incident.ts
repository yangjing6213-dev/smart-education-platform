export const HEALTH_INCIDENT_OBSERVATION_CODES = [
  "ROUTINE_OBSERVATION",
  "NEEDS_FOLLOW_UP",
  "URGENT_REVIEW",
] as const;
export type HealthIncidentObservationCode = (typeof HEALTH_INCIDENT_OBSERVATION_CODES)[number];

export const HEALTH_INCIDENT_DISPOSITION_CODES = [
  "OBSERVATION_RECHECKED",
  "FOLLOW_UP_SCHEDULED",
  "GUARDIAN_SUMMARY_PREPARED",
] as const;
export type HealthIncidentDispositionCode = (typeof HEALTH_INCIDENT_DISPOSITION_CODES)[number];

export const HEALTH_INCIDENT_SUMMARY_CODES = [
  "FOLLOW_UP_IN_PROGRESS",
  "FOLLOW_UP_COMPLETED",
  "PLEASE_CHECK_PAGE_LATER",
] as const;
export type HealthIncidentSummaryCode = (typeof HEALTH_INCIDENT_SUMMARY_CODES)[number];

export const HEALTH_INCIDENT_STATUS_VALUES = [
  "DRAFT",
  "SUBMITTED",
  "RETURNED",
  "CONFIRMED",
  "EXCEPTION_PENDING",
  "PUBLISHED",
  "REVOKED",
  "WITHDRAWN",
] as const;
export type HealthIncidentStatus = (typeof HEALTH_INCIDENT_STATUS_VALUES)[number];

export interface HealthIncident extends ScopedHealthRow {
  readonly kind: "healthIncident";
  readonly bindingId: string;
  readonly bindingVersion: number;
  readonly studentId: string;
  readonly observationCode: HealthIncidentObservationCode;
  readonly dispositionCode: HealthIncidentDispositionCode | null;
  readonly summaryCode: HealthIncidentSummaryCode | null;
  readonly status: HealthIncidentStatus;
  readonly published: boolean;
  readonly createdBy: string;
  readonly reviewedBy: string | null;
  readonly updatedBy: string;
  readonly updatedAt: string;
}

export interface HealthIncidentReceipt {
  readonly guardianId: string;
  readonly incidentId: string;
  readonly version: number;
  readonly status: "READ" | "ACKNOWLEDGED";
}

export interface HealthIncidentStudentOption {
  readonly id: string;
  readonly studentLabel: string;
}

export interface ScopedHealthRow {
  readonly id: string;
  readonly version: number;
  readonly tenantId: string;
  readonly campusId: string;
  readonly classId: string;
}
