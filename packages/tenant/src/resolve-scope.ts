import { uuidSchema } from "@student-care/validation";
import type {
  ResolveScopeInput,
  ScopeCacheKeyComponents,
  ScopeCacheKeyDenial,
  ScopeCacheKeyResult,
  ScopeContext,
  ScopeDenial,
  ScopeDenialReason,
  ScopeResolutionResult,
  TrustedActor,
  TrustedMembership,
} from "./scope-context.js";

const CACHE_COMPONENT_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && uuidSchema.safeParse(value).success;
}

function isTrustedActor(value: unknown): value is TrustedActor {
  return isRecord(value) && isUuid(value.actorId);
}

function isTrustedMembership(value: unknown): value is TrustedMembership {
  return (
    isRecord(value) &&
    isUuid(value.tenantId) &&
    Array.isArray(value.campusIds) &&
    value.campusIds.every(isUuid) &&
    (value.status === "ACTIVE" || value.status === "SUSPENDED")
  );
}

function denial(reason: ScopeDenialReason): ScopeDenial {
  return { ok: false, reason };
}

function cacheDenial(reason: "CACHE_KEY_INVALID" | "CACHE_KEY_COLLISION"): ScopeCacheKeyDenial {
  return { ok: false, denial: denial(reason) };
}

function isScopeContext(value: unknown): value is ScopeContext {
  return (
    isRecord(value) &&
    isUuid(value.actorId) &&
    isUuid(value.tenantId) &&
    (value.campusId === undefined || isUuid(value.campusId))
  );
}

function isCacheComponent(value: unknown): value is string {
  return typeof value === "string" && CACHE_COMPONENT_PATTERN.test(value);
}

function isCacheKeyComponents(value: unknown): value is ScopeCacheKeyComponents {
  return (
    isRecord(value) &&
    isCacheComponent(value.namespace) &&
    isCacheComponent(value.resource) &&
    isCacheComponent(value.key)
  );
}

export function resolveScope(input: ResolveScopeInput): ScopeResolutionResult {
  if (!isRecord(input) || !isTrustedActor(input.trustedActor)) {
    return denial("TRUSTED_PRINCIPAL_MISSING");
  }

  if (!isTrustedMembership(input.membership)) {
    return denial("MEMBERSHIP_MISSING");
  }

  if (input.membership.status === "SUSPENDED") {
    return denial("MEMBERSHIP_SUSPENDED");
  }

  const requestedTenantId = input.requestedTenantId;
  if (
    requestedTenantId !== undefined &&
    (!isUuid(requestedTenantId) || requestedTenantId !== input.membership.tenantId)
  ) {
    return denial("TENANT_SCOPE_MISMATCH");
  }

  const requestedCampusId = input.requestedCampusId;
  if (
    requestedCampusId !== undefined &&
    (!isUuid(requestedCampusId) || !input.membership.campusIds.includes(requestedCampusId))
  ) {
    return denial("CAMPUS_SCOPE_INVALID");
  }

  const baseScope = {
    actorId: input.trustedActor.actorId,
    tenantId: input.membership.tenantId,
  };

  if (requestedCampusId === undefined) {
    return { ok: true, scopeContext: baseScope };
  }

  return {
    ok: true,
    scopeContext: { ...baseScope, campusId: requestedCampusId },
  };
}

export function buildScopeCacheKey(
  scopeContext: ScopeContext,
  components: ScopeCacheKeyComponents,
): ScopeCacheKeyResult {
  if (!isScopeContext(scopeContext) || !isCacheKeyComponents(components)) {
    return cacheDenial("CACHE_KEY_INVALID");
  }

  return {
    ok: true,
    key: JSON.stringify([
      "scope-v1",
      scopeContext.tenantId,
      scopeContext.campusId ?? null,
      components.namespace,
      components.resource,
      components.key,
    ]),
  };
}

export function verifyScopeCacheKey(
  scopeContext: ScopeContext,
  components: ScopeCacheKeyComponents,
  candidate: unknown,
): ScopeCacheKeyResult {
  const expected = buildScopeCacheKey(scopeContext, components);
  if (!expected.ok) return expected;

  if (typeof candidate !== "string") {
    return cacheDenial("CACHE_KEY_INVALID");
  }

  if (candidate !== expected.key) {
    return cacheDenial("CACHE_KEY_COLLISION");
  }

  return expected;
}
