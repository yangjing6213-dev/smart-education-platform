import assert from "node:assert/strict";
import test from "node:test";
import {
  IDENTITY_CAPABILITIES,
  MEMBERSHIP_STATUSES,
  type IdentityCapability,
  type MembershipDto,
  type MeDto,
  type SuccessEnvelope,
} from "../src/index.js";

const TENANT_ID = "00000000-0000-4000-8000-000000000001";
const CAMPUS_ID = "00000000-0000-4000-8000-000000000002";

test("identity transport exports stable membership statuses and readonly DTO shapes", () => {
  assert.deepEqual(MEMBERSHIP_STATUSES, ["ACTIVE", "SUSPENDED", "REVOKED", "INVITED"]);

  const membership = {
    tenant_id: TENANT_ID,
    campus_ids: [CAMPUS_ID],
    status: "ACTIVE",
    capabilities: ["memberships:read"],
  } as const satisfies MembershipDto;
  const me = {
    actor_id: "00000000-0000-4000-8000-000000000003",
    display_name: "模拟员工一号",
  } as const satisfies MeDto;
  const envelope = {
    data: { ...me, memberships: [membership] },
    request_id: "req-synthetic-identity-001",
  } satisfies SuccessEnvelope<MeDto & { memberships: readonly MembershipDto[] }>;

  assert.equal(envelope.data.memberships[0]?.status, "ACTIVE");
  assert.equal(envelope.data.memberships[0]?.tenant_id, TENANT_ID);
});

test("identity transport exposes the Task 06 content capabilities", () => {
  assert.deepEqual(IDENTITY_CAPABILITIES, [
    "identity:read",
    "memberships:read",
    "content:write",
    "content:publish",
  ]);

  const capabilities = [
    "content:write",
    "content:publish",
  ] as const satisfies readonly IdentityCapability[];
  assert.deepEqual(capabilities, ["content:write", "content:publish"]);
});
