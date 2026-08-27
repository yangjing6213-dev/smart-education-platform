import assert from "node:assert/strict";
import test from "node:test";
import {
  buildScopeCacheKey,
  resolveScope,
  verifyScopeCacheKey,
  type ResolveScopeInput,
  type ScopeCacheKeyComponents,
  type ScopeCacheKeyResult,
  type ScopeContext,
  type ScopeDenialReason,
  type ScopeResolutionResult,
} from "../src/index.js";

const ACTOR_ID = "00000000-0000-4000-8000-00000000000a";
const OTHER_ACTOR_ID = "00000000-0000-4000-8000-00000000000b";
const TENANT_ID = "00000000-0000-4000-8000-00000000000c";
const OTHER_TENANT_ID = "00000000-0000-4000-8000-00000000000d";
const CAMPUS_ID = "00000000-0000-4000-8000-00000000000e";
const OTHER_CAMPUS_ID = "00000000-0000-4000-8000-00000000000f";
const OUTSIDE_CAMPUS_ID = "00000000-0000-4000-8000-000000000010";

const trustedActor = { actorId: ACTOR_ID } as const;
const activeMembership = {
  tenantId: TENANT_ID,
  campusIds: [CAMPUS_ID, OTHER_CAMPUS_ID],
  status: "ACTIVE",
} as const;
const cacheComponents = {
  namespace: "student-care.scope",
  resource: "daily_report",
  key: "synthetic:001",
} as const;

function asResolveInput(value: unknown): ResolveScopeInput {
  return value as ResolveScopeInput;
}

function asScopeContext(value: unknown): ScopeContext {
  return value as ScopeContext;
}

function asCacheComponents(value: unknown): ScopeCacheKeyComponents {
  return value as ScopeCacheKeyComponents;
}

function expectScopeDenial(result: ScopeResolutionResult, reason: ScopeDenialReason): void {
  assert.deepEqual(result, { ok: false, reason });
}

function expectCacheDenial(result: ScopeCacheKeyResult, reason: ScopeDenialReason): void {
  assert.deepEqual(result, { ok: false, denial: { ok: false, reason } });
}

test("trusted actor input fails closed before all later checks", () => {
  const invalidInputs: readonly unknown[] = [
    null,
    undefined,
    "actor",
    [],
    {},
    { trustedActor: null, membership: activeMembership },
    { trustedActor: undefined, membership: activeMembership },
    { trustedActor: "actor", membership: activeMembership },
    { trustedActor: [], membership: activeMembership },
    { trustedActor: {}, membership: activeMembership },
    { trustedActor: { actorId: 1 }, membership: activeMembership },
    { trustedActor: { actorId: "" }, membership: activeMembership },
    { trustedActor: { actorId: " " }, membership: activeMembership },
    { trustedActor: { actorId: "not-a-uuid" }, membership: activeMembership },
    { trustedActor: { actorId: ACTOR_ID.toUpperCase() }, membership: activeMembership },
  ];

  for (const input of invalidInputs) {
    expectScopeDenial(resolveScope(asResolveInput(input)), "TRUSTED_PRINCIPAL_MISSING");
  }
});

test("membership input fails closed after a trusted actor is established", () => {
  const invalidMemberships: readonly unknown[] = [
    null,
    undefined,
    "membership",
    [],
    {},
    { tenantId: TENANT_ID, campusIds: [CAMPUS_ID] },
    { tenantId: 1, campusIds: [CAMPUS_ID], status: "ACTIVE" },
    { tenantId: "not-a-uuid", campusIds: [CAMPUS_ID], status: "ACTIVE" },
    { tenantId: TENANT_ID, campusIds: "campus", status: "ACTIVE" },
    { tenantId: TENANT_ID, campusIds: [1], status: "ACTIVE" },
    { tenantId: TENANT_ID, campusIds: ["not-a-uuid"], status: "ACTIVE" },
    { tenantId: TENANT_ID, campusIds: [CAMPUS_ID], status: 1 },
    { tenantId: TENANT_ID, campusIds: [CAMPUS_ID], status: "UNKNOWN" },
  ];

  for (const membership of invalidMemberships) {
    expectScopeDenial(
      resolveScope(asResolveInput({ trustedActor, membership })),
      "MEMBERSHIP_MISSING",
    );
  }
});

test("suspended membership denial precedes requested tenant and campus validation", () => {
  const membership = { ...activeMembership, status: "SUSPENDED" } as const;
  expectScopeDenial(
    resolveScope(
      asResolveInput({
        trustedActor,
        membership,
        requestedTenantId: 42,
        requestedCampusId: 42,
      }),
    ),
    "MEMBERSHIP_SUSPENDED",
  );
});

test("tenant mismatch denial precedes campus denial and accepts no coercion or trimming", () => {
  const invalidTenantIds: readonly unknown[] = [
    null,
    42,
    "",
    ` ${TENANT_ID}`,
    "not-a-uuid",
    OTHER_TENANT_ID,
  ];

  for (const requestedTenantId of invalidTenantIds) {
    expectScopeDenial(
      resolveScope(
        asResolveInput({
          trustedActor,
          membership: activeMembership,
          requestedTenantId,
          requestedCampusId: OUTSIDE_CAMPUS_ID,
        }),
      ),
      "TENANT_SCOPE_MISMATCH",
    );
  }
});

test("campus scope fails closed for malformed or out-of-membership values", () => {
  const invalidCampusIds: readonly unknown[] = [
    null,
    42,
    "",
    ` ${CAMPUS_ID}`,
    "not-a-uuid",
    OUTSIDE_CAMPUS_ID,
  ];

  for (const requestedCampusId of invalidCampusIds) {
    expectScopeDenial(
      resolveScope(
        asResolveInput({
          trustedActor,
          membership: activeMembership,
          requestedTenantId: TENANT_ID,
          requestedCampusId,
        }),
      ),
      "CAMPUS_SCOPE_INVALID",
    );
  }
});

test("active membership resolves deterministic tenant and optional campus scope", () => {
  const omitted = resolveScope(asResolveInput({ trustedActor, membership: activeMembership }));
  assert.deepEqual(omitted, {
    ok: true,
    scopeContext: { actorId: ACTOR_ID, tenantId: TENANT_ID },
  });
  if (omitted.ok) assert.equal("campusId" in omitted.scopeContext, false);

  assert.deepEqual(
    resolveScope(
      asResolveInput({
        trustedActor,
        membership: activeMembership,
        requestedTenantId: undefined,
        requestedCampusId: undefined,
      }),
    ),
    omitted,
  );

  assert.deepEqual(
    resolveScope(
      asResolveInput({
        trustedActor,
        membership: activeMembership,
        requestedTenantId: TENANT_ID,
        requestedCampusId: CAMPUS_ID,
      }),
    ),
    {
      ok: true,
      scopeContext: { actorId: ACTOR_ID, tenantId: TENANT_ID, campusId: CAMPUS_ID },
    },
  );
});

test("cache key validates every scope UUID before serialization", () => {
  const invalidScopes: readonly unknown[] = [
    null,
    [],
    {},
    { actorId: 1, tenantId: TENANT_ID },
    { actorId: "not-a-uuid", tenantId: TENANT_ID },
    { actorId: ACTOR_ID, tenantId: 1 },
    { actorId: ACTOR_ID, tenantId: "not-a-uuid" },
    { actorId: ACTOR_ID, tenantId: TENANT_ID, campusId: null },
    { actorId: ACTOR_ID, tenantId: TENANT_ID, campusId: 1 },
    { actorId: ACTOR_ID, tenantId: TENANT_ID, campusId: "not-a-uuid" },
  ];

  for (const scopeContext of invalidScopes) {
    expectCacheDenial(
      buildScopeCacheKey(asScopeContext(scopeContext), cacheComponents),
      "CACHE_KEY_INVALID",
    );
  }
});

test("cache components require strict 1-128 character ASCII values without coercion", () => {
  const scopeContext = { actorId: ACTOR_ID, tenantId: TENANT_ID } as const;
  const invalidValues: readonly unknown[] = [
    null,
    42,
    "",
    " ",
    " leading",
    "line\nbreak",
    "模拟",
    "x".repeat(129),
  ];

  expectCacheDenial(buildScopeCacheKey(scopeContext, asCacheComponents(null)), "CACHE_KEY_INVALID");
  expectCacheDenial(buildScopeCacheKey(scopeContext, asCacheComponents([])), "CACHE_KEY_INVALID");

  for (const field of ["namespace", "resource", "key"] as const) {
    for (const value of invalidValues) {
      expectCacheDenial(
        buildScopeCacheKey(scopeContext, asCacheComponents({ ...cacheComponents, [field]: value })),
        "CACHE_KEY_INVALID",
      );
    }
  }

  assert.equal(
    buildScopeCacheKey(scopeContext, { ...cacheComponents, key: "x".repeat(128) }).ok,
    true,
  );
});

test("cache key serialization is exact and tenant-campus isolated", () => {
  const tenantScope = { actorId: ACTOR_ID, tenantId: TENANT_ID } as const;
  const campusScope = { ...tenantScope, campusId: CAMPUS_ID } as const;
  const tenantResult = buildScopeCacheKey(tenantScope, cacheComponents);
  const campusResult = buildScopeCacheKey(campusScope, cacheComponents);

  assert.deepEqual(tenantResult, {
    ok: true,
    key: JSON.stringify([
      "scope-v1",
      TENANT_ID,
      null,
      cacheComponents.namespace,
      cacheComponents.resource,
      cacheComponents.key,
    ]),
  });
  assert.deepEqual(campusResult, {
    ok: true,
    key: JSON.stringify([
      "scope-v1",
      TENANT_ID,
      CAMPUS_ID,
      cacheComponents.namespace,
      cacheComponents.resource,
      cacheComponents.key,
    ]),
  });
  assert.notDeepEqual(tenantResult, campusResult);
  assert.notDeepEqual(
    tenantResult,
    buildScopeCacheKey({ actorId: ACTOR_ID, tenantId: OTHER_TENANT_ID }, cacheComponents),
  );
  assert.notDeepEqual(
    campusResult,
    buildScopeCacheKey({ ...tenantScope, campusId: OTHER_CAMPUS_ID }, cacheComponents),
  );
  assert.deepEqual(
    tenantResult,
    buildScopeCacheKey({ actorId: OTHER_ACTOR_ID, tenantId: TENANT_ID }, cacheComponents),
  );
});

test("cache key verification maps invalid candidates and collisions precisely", () => {
  const scopeContext = { actorId: ACTOR_ID, tenantId: TENANT_ID, campusId: CAMPUS_ID } as const;
  const built = buildScopeCacheKey(scopeContext, cacheComponents);
  assert.equal(built.ok, true);
  if (!built.ok) assert.fail("expected a valid synthetic cache key");

  expectCacheDenial(verifyScopeCacheKey(scopeContext, cacheComponents, null), "CACHE_KEY_INVALID");
  expectCacheDenial(
    verifyScopeCacheKey(scopeContext, { ...cacheComponents, key: "" }, built.key),
    "CACHE_KEY_INVALID",
  );
  expectCacheDenial(
    verifyScopeCacheKey(scopeContext, cacheComponents, `${built.key}:foreign`),
    "CACHE_KEY_COLLISION",
  );
  assert.deepEqual(verifyScopeCacheKey(scopeContext, cacheComponents, built.key), built);
});
