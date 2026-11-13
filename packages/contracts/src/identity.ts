export const MEMBERSHIP_STATUSES = ["ACTIVE", "SUSPENDED", "REVOKED", "INVITED"] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

export const IDENTITY_CAPABILITIES = [
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
] as const;
export type IdentityCapability = (typeof IDENTITY_CAPABILITIES)[number];

export interface MembershipDto {
  readonly tenant_id: string;
  readonly campus_ids: readonly string[];
  readonly status: MembershipStatus;
  readonly capabilities: readonly IdentityCapability[];
}

export interface MeDto {
  readonly actor_id: string;
  readonly display_name: string;
}

export interface MeResponseDto extends MeDto {
  readonly memberships: readonly MembershipDto[];
}

export type MembershipsResponseDto = readonly MembershipDto[];
