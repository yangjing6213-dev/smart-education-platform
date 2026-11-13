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

test("identity transport exposes the approved contract capabilities", () => {
  assert.deepEqual(IDENTITY_CAPABILITIES, [
    "identity:read",
    "memberships:read",
    "memberships:manage",
    "binding:apply",
    "binding:read",
    "binding:review",
    "content:write",
    "content:publish",
    "care:write",
    "care:review",
    "care:publish",
    "care:read",
    "daily:read",
    "daily:create",
    "daily:submit",
    "daily:review",
    "feedback:read",
    "feedback:create",
    "feedback:submit",
    "feedback:review",
    "feedback:publish",
    "fees:manage",
    "learning:summary",
    "learning:institution-setting",
    "health:create",
    "health:submit",
    "health:review",
    "health:supplement",
    "health:publish",
    "health:revoke",
    "notice:create",
    "notice:submit",
    "notice:review",
    "notice:publish",
    "notice:revoke",
    "attendance:write",
    "attendance:review",
    "attendance:read",
    "leave:apply",
    "leave:review",
    "leave:read",
    "students:transfer:request",
    "students:transfer:review",
    "task:read",
    "task:assign",
    "task:claim",
    "task:start",
    "task:complete",
    "task:check",
    "task:cancel",
  ]);

  const capabilities = [
    "content:write",
    "content:publish",
  ] as const satisfies readonly IdentityCapability[];
  assert.deepEqual(capabilities, ["content:write", "content:publish"]);

  const learningCapabilities = [
    "learning:summary",
  ] as const satisfies readonly IdentityCapability[];
  assert.deepEqual(learningCapabilities, ["learning:summary"]);

  const careCapabilities = [
    "care:write",
    "care:review",
    "care:publish",
    "care:read",
  ] as const satisfies readonly IdentityCapability[];
  assert.deepEqual(careCapabilities, ["care:write", "care:review", "care:publish", "care:read"]);

  const bindingCapabilities = [
    "binding:apply",
    "binding:read",
    "binding:review",
  ] as const satisfies readonly IdentityCapability[];
  assert.deepEqual(bindingCapabilities, ["binding:apply", "binding:read", "binding:review"]);

  const healthCapabilities = [
    "health:create",
    "health:submit",
    "health:review",
    "health:supplement",
    "health:publish",
    "health:revoke",
  ] as const satisfies readonly IdentityCapability[];
  assert.deepEqual(healthCapabilities, [
    "health:create",
    "health:submit",
    "health:review",
    "health:supplement",
    "health:publish",
    "health:revoke",
  ]);

  const attendanceCapabilities = [
    "attendance:write",
    "attendance:review",
    "attendance:read",
  ] as const;
  assert.deepEqual(attendanceCapabilities, [
    "attendance:write",
    "attendance:review",
    "attendance:read",
  ]);
});
