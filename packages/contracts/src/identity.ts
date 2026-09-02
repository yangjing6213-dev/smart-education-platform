export const MEMBERSHIP_STATUSES = ["ACTIVE", "SUSPENDED", "REVOKED", "INVITED"] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

export const IDENTITY_CAPABILITIES = [
  "identity:read",
  "memberships:read",
  "content:write",
  "content:publish",
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
