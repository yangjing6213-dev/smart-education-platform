import type { IdentityCapability } from "@student-care/contracts";
import {
  isRecord,
  isTrustedIdentity,
  isTrustedMembership,
  isUuid,
  type TrustedIdentity,
  type TrustedMembership,
} from "./identity.js";
import { isActiveTrustedSession } from "./session.js";

const FORGED_CLIENT_CLAIMS = ["actor_id", "identity_id", "role", "roles", "tenant_id", "campus_id"];

export type AuthDenialReason = "UNAUTHENTICATED";
export type MembershipDenialReason =
  | AuthDenialReason
  | "MEMBERSHIP_MISSING"
  | "MEMBERSHIP_INACTIVE"
  | "TENANT_SCOPE_MISMATCH"
  | "CAMPUS_SCOPE_INVALID"
  | "CAPABILITY_MISSING";

export interface AuthContext {
  readonly identity: TrustedIdentity;
  readonly memberships: readonly TrustedMembership[];
}

export type AuthResolution =
  | { readonly ok: true; readonly context: AuthContext }
  | { readonly ok: false; readonly reason: AuthDenialReason };

export type MembershipAuthorization =
  | { readonly ok: true; readonly membership: TrustedMembership }
  | { readonly ok: false; readonly reason: MembershipDenialReason };

function denial(reason: MembershipDenialReason): MembershipAuthorization {
  return { ok: false, reason };
}

export function resolveAuthContext(value: unknown, now: Date = new Date()): AuthResolution {
  if (
    !isRecord(value) ||
    value.trusted !== true ||
    FORGED_CLIENT_CLAIMS.some((claim) => claim in value) ||
    !isActiveTrustedSession(value.session, now) ||
    !isTrustedIdentity(value.identity) ||
    value.session.actor_id !== value.identity.actor_id ||
    !Array.isArray(value.memberships) ||
    !value.memberships.every(isTrustedMembership)
  ) {
    return { ok: false, reason: "UNAUTHENTICATED" };
  }

  return {
    ok: true,
    context: {
      identity: value.identity,
      memberships: value.memberships,
    },
  };
}

export function authorizeMembershipAccess(
  auth: AuthResolution,
  targetTenantId: unknown,
  targetCampusId?: unknown,
  requiredCapability?: IdentityCapability,
): MembershipAuthorization {
  if (!auth.ok) return denial(auth.reason);
  if (!isUuid(targetTenantId)) return denial("TENANT_SCOPE_MISMATCH");

  const tenantMemberships = auth.context.memberships.filter(
    (membership) => membership.tenant_id === targetTenantId,
  );
  if (tenantMemberships.length === 0) {
    return denial(
      auth.context.memberships.length === 0 ? "MEMBERSHIP_MISSING" : "TENANT_SCOPE_MISMATCH",
    );
  }

  const membership = tenantMemberships.find((candidate) => candidate.status === "ACTIVE");
  if (!membership) return denial("MEMBERSHIP_INACTIVE");
  if (
    targetCampusId !== undefined &&
    (!isUuid(targetCampusId) || !membership.campus_ids.includes(targetCampusId))
  ) {
    return denial("CAMPUS_SCOPE_INVALID");
  }
  if (requiredCapability !== undefined && !membership.capabilities.includes(requiredCapability)) {
    return denial("CAPABILITY_MISSING");
  }

  return { ok: true, membership };
}

export function activeMemberships(auth: AuthResolution): readonly TrustedMembership[] {
  return auth.ok
    ? auth.context.memberships.filter((membership) => membership.status === "ACTIVE")
    : [];
}
