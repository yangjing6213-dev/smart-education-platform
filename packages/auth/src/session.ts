import { isRecord, isUuid } from "./identity.js";

export const SESSION_STATUSES = ["ACTIVE", "EXPIRED", "REVOKED"] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export interface TrustedSession {
  readonly trusted: true;
  readonly status: SessionStatus;
  readonly actor_id: string;
  readonly expires_at: string;
}

export function isActiveTrustedSession(value: unknown, now: Date): value is TrustedSession {
  if (
    !isRecord(value) ||
    value.trusted !== true ||
    value.status !== "ACTIVE" ||
    !isUuid(value.actor_id) ||
    typeof value.expires_at !== "string"
  ) {
    return false;
  }

  const expiresAt = Date.parse(value.expires_at);
  return Number.isFinite(expiresAt) && expiresAt > now.getTime();
}
