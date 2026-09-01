import assert from "node:assert/strict";
import test from "node:test";
import {
  activeMemberships,
  authorizeMembershipAccess,
  resolveAuthContext,
  type TrustedAuthResult,
} from "../src/index.js";

const ACTOR_ID = "00000000-0000-4000-8000-000000000003";
const TENANT_ID = "00000000-0000-4000-8000-000000000001";
const OTHER_TENANT_ID = "00000000-0000-4000-8000-000000000004";
const CAMPUS_ID = "00000000-0000-4000-8000-000000000002";
const OTHER_CAMPUS_ID = "00000000-0000-4000-8000-000000000005";

const activeResult: TrustedAuthResult = {
  trusted: true,
  session: {
    trusted: true,
    status: "ACTIVE",
    actor_id: ACTOR_ID,
    expires_at: "2099-01-01T00:00:00.000Z",
  },
  identity: { actor_id: ACTOR_ID, display_name: "模拟员工一号" },
  memberships: [
    {
      tenant_id: TENANT_ID,
      campus_ids: [CAMPUS_ID],
      status: "ACTIVE",
      capabilities: ["memberships:read"],
    },
  ],
};

test("auth policy denies absent, expired, revoked, forged sessions and forged role claims", () => {
  const cases: readonly unknown[] = [
    null,
    undefined,
    { ...activeResult, session: undefined },
    { ...activeResult, session: { ...activeResult.session, status: "EXPIRED" } },
    { ...activeResult, session: { ...activeResult.session, status: "REVOKED" } },
    { ...activeResult, trusted: false },
    {
      ...activeResult,
      session: { ...activeResult.session, actor_id: OTHER_TENANT_ID },
    },
    { ...activeResult, memberships: "not-an-array" },
    { ...activeResult, memberships: [{ ...activeResult.memberships[0], tenant_id: "invalid" }] },
    { ...activeResult, role: "PLATFORM_ADMIN" },
    { ...activeResult, roles: ["PLATFORM_ADMIN"] },
  ];

  for (const value of cases) {
    assert.deepEqual(resolveAuthContext(value, new Date("2026-09-01T00:00:00.000Z")), {
      ok: false,
      reason: "UNAUTHENTICATED",
    });
  }
});

test("membership policy requires active target tenant and server-derived campus", () => {
  assert.deepEqual(
    authorizeMembershipAccess(resolveAuthContext(activeResult), TENANT_ID, CAMPUS_ID),
    { ok: true, membership: activeResult.memberships[0] },
  );

  for (const membershipStatus of ["SUSPENDED", "REVOKED", "INVITED"] as const) {
    const result = resolveAuthContext({
      ...activeResult,
      memberships: [{ ...activeResult.memberships[0], status: membershipStatus }],
    });
    assert.deepEqual(authorizeMembershipAccess(result, TENANT_ID, CAMPUS_ID), {
      ok: false,
      reason: "MEMBERSHIP_INACTIVE",
    });
  }

  assert.deepEqual(authorizeMembershipAccess(resolveAuthContext(activeResult), OTHER_TENANT_ID), {
    ok: false,
    reason: "TENANT_SCOPE_MISMATCH",
  });
  assert.deepEqual(
    authorizeMembershipAccess(resolveAuthContext(activeResult), TENANT_ID, OTHER_CAMPUS_ID),
    { ok: false, reason: "CAMPUS_SCOPE_INVALID" },
  );

  assert.deepEqual(authorizeMembershipAccess(resolveAuthContext(activeResult), "invalid"), {
    ok: false,
    reason: "TENANT_SCOPE_MISMATCH",
  });
  assert.deepEqual(
    authorizeMembershipAccess(resolveAuthContext({ ...activeResult, memberships: [] }), TENANT_ID),
    { ok: false, reason: "MEMBERSHIP_MISSING" },
  );
  assert.deepEqual(
    authorizeMembershipAccess(
      resolveAuthContext(activeResult),
      TENANT_ID,
      undefined,
      "identity:read",
    ),
    { ok: false, reason: "CAPABILITY_MISSING" },
  );
  assert.deepEqual(
    authorizeMembershipAccess(
      resolveAuthContext(activeResult),
      TENANT_ID,
      undefined,
      "memberships:read",
    ),
    { ok: true, membership: activeResult.memberships[0] },
  );
  assert.deepEqual(authorizeMembershipAccess({ ok: false, reason: "UNAUTHENTICATED" }, TENANT_ID), {
    ok: false,
    reason: "UNAUTHENTICATED",
  });
});

test("active membership projection excludes every inactive status and denied auth", () => {
  const result = resolveAuthContext({
    ...activeResult,
    memberships: [
      activeResult.memberships[0],
      { ...activeResult.memberships[0], status: "SUSPENDED" },
      { ...activeResult.memberships[0], status: "REVOKED" },
      { ...activeResult.memberships[0], status: "INVITED" },
    ],
  });

  assert.deepEqual(activeMemberships(result), [activeResult.memberships[0]]);
  assert.deepEqual(activeMemberships({ ok: false, reason: "UNAUTHENTICATED" }), []);
});
