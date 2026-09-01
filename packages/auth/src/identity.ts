import {
  IDENTITY_CAPABILITIES,
  MEMBERSHIP_STATUSES,
  type IdentityCapability,
  type MembershipStatus,
} from "@student-care/contracts";
import type { TrustedSession } from "./session.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export interface TrustedIdentity {
  readonly actor_id: string;
  readonly display_name: string;
}

export interface TrustedMembership {
  readonly tenant_id: string;
  readonly campus_ids: readonly string[];
  readonly status: MembershipStatus;
  readonly capabilities: readonly IdentityCapability[];
}

export interface TrustedAuthResult {
  readonly trusted: true;
  readonly session: TrustedSession;
  readonly identity: TrustedIdentity;
  readonly memberships: readonly TrustedMembership[];
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function isTrustedIdentity(value: unknown): value is TrustedIdentity {
  return (
    isRecord(value) &&
    isUuid(value.actor_id) &&
    typeof value.display_name === "string" &&
    value.display_name.length > 0
  );
}

export function isTrustedMembership(value: unknown): value is TrustedMembership {
  return (
    isRecord(value) &&
    isUuid(value.tenant_id) &&
    Array.isArray(value.campus_ids) &&
    value.campus_ids.every(isUuid) &&
    typeof value.status === "string" &&
    MEMBERSHIP_STATUSES.includes(value.status as MembershipStatus) &&
    Array.isArray(value.capabilities) &&
    value.capabilities.every(
      (capability) =>
        typeof capability === "string" &&
        IDENTITY_CAPABILITIES.includes(capability as IdentityCapability),
    )
  );
}
