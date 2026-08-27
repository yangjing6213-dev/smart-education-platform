export interface TrustedActor {
  readonly actorId: string;
}

export interface TrustedMembership {
  readonly tenantId: string;
  readonly campusIds: readonly string[];
  readonly status: "ACTIVE" | "SUSPENDED";
}

export interface ResolveScopeInput {
  readonly trustedActor: TrustedActor | null | undefined;
  readonly membership: TrustedMembership | null | undefined;
  readonly requestedTenantId?: unknown;
  readonly requestedCampusId?: unknown;
}

export interface ScopeContext {
  readonly actorId: string;
  readonly tenantId: string;
  readonly campusId?: string;
}

export type ScopeDenialReason =
  | "TRUSTED_PRINCIPAL_MISSING"
  | "MEMBERSHIP_MISSING"
  | "MEMBERSHIP_SUSPENDED"
  | "TENANT_SCOPE_MISMATCH"
  | "CAMPUS_SCOPE_INVALID"
  | "CACHE_KEY_INVALID"
  | "CACHE_KEY_COLLISION";

export interface ScopeDenial {
  readonly ok: false;
  readonly reason: ScopeDenialReason;
}

export interface ScopeResolutionSuccess {
  readonly ok: true;
  readonly scopeContext: ScopeContext;
}

export type ScopeResolutionResult = ScopeResolutionSuccess | ScopeDenial;

export interface ScopeCacheKeyComponents {
  readonly namespace: string;
  readonly resource: string;
  readonly key: string;
}

export interface ScopeCacheKeySuccess {
  readonly ok: true;
  readonly key: string;
}

export interface ScopeCacheKeyDenial {
  readonly ok: false;
  readonly denial: ScopeDenial;
}

export type ScopeCacheKeyResult = ScopeCacheKeySuccess | ScopeCacheKeyDenial;
