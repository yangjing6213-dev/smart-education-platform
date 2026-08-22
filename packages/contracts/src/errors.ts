export const ERROR_CODES = [
  "UNAUTHENTICATED",
  "FORBIDDEN_ROLE",
  "FORBIDDEN_SCOPE",
  "NOT_FOUND_SCOPED",
  "VALIDATION_FAILED",
  "CONSENT_REQUIRED",
  "CONFLICT_STATE",
  "VERSION_MISMATCH",
  "IDEMPOTENCY_REPLAY_MISMATCH",
  "RATE_LIMITED",
  "FILE_TYPE_REJECTED",
  "FILE_SCAN_PENDING",
  "AI_SAFETY_BLOCKED",
  "PROVIDER_UNAVAILABLE",
  "DELETION_PENDING",
  "INTERNAL_ERROR",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];
export type ErrorDetailScalar = string | number | boolean | null;
export type ErrorDetails = Readonly<Record<string, ErrorDetailScalar>>;

export interface ApiError {
  readonly code: ErrorCode;
  readonly message: string;
  readonly details?: ErrorDetails;
}

export interface ErrorEnvelope {
  readonly error: ApiError;
  readonly request_id: string;
}

export interface SuccessEnvelope<T> {
  readonly data: T;
  readonly request_id: string;
}
