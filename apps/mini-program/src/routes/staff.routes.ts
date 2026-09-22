export const STAFF_ROUTES = {
  home: "/home",
  workbench: "/staff/workbench",
  quickAction: "/staff/quick-action",
  denied: "/access-denied",
} as const;

export type StaffRouteTarget = "workbench" | "quick-action";
export type IdentityType = "EMPLOYEE" | "VISITOR";
export type IdentityStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED";
export type MembershipStatus = "ACTIVE" | "SUSPENDED" | "REVOKED";

export type StaffAccessInput = {
  identityType: IdentityType;
  identityStatus: IdentityStatus;
  tenantId: string;
  campusId: string;
  membership?: {
    status: MembershipStatus;
    tenantId: string;
    campusId: string;
    capabilities: string[];
  };
};

export type StaffScope = {
  tenantId: string;
  campusId: string;
};

export type StaffRouteDecision =
  | { allowed: true; route: string }
  | { allowed: false; route: typeof STAFF_ROUTES.denied; reason: string };

const capabilityForTarget: Record<StaffRouteTarget, string> = {
  workbench: "STAFF_WORKBENCH",
  "quick-action": "STAFF_QUICK_ACTION",
};

export function getStaffScope(input: unknown): StaffScope | null {
  if (!isRecord(input)) {
    return null;
  }

  return typeof input.tenantId === "string" && typeof input.campusId === "string"
    ? { tenantId: input.tenantId, campusId: input.campusId }
    : null;
}

export function getStaffRoute(
  input: unknown,
  target: StaffRouteTarget,
  scope: StaffScope,
): StaffRouteDecision {
  const denied = (reason: string): StaffRouteDecision => ({
    allowed: false,
    route: STAFF_ROUTES.denied,
    reason,
  });

  if (!isRecord(input)) {
    return denied("MALFORMED_ACCESS");
  }
  if (input.identityType !== "EMPLOYEE") {
    return denied("EMPLOYEE_ONLY");
  }
  if (input.identityStatus !== "ACTIVE") {
    return denied("IDENTITY_INACTIVE");
  }
  if (input.tenantId !== scope.tenantId || input.campusId !== scope.campusId) {
    return denied("SCOPE_MISMATCH");
  }

  const membership = input.membership;
  if (!isRecord(membership)) {
    return denied("MEMBERSHIP_REQUIRED");
  }
  if (membership.status !== "ACTIVE") {
    return denied("MEMBERSHIP_INACTIVE");
  }
  if (membership.tenantId !== scope.tenantId || membership.campusId !== scope.campusId) {
    return denied("MEMBERSHIP_SCOPE_MISMATCH");
  }
  if (
    !Array.isArray(membership.capabilities) ||
    !membership.capabilities.includes(capabilityForTarget[target])
  ) {
    return denied("CAPABILITY_REQUIRED");
  }

  return {
    allowed: true,
    route: STAFF_ROUTES[target === "workbench" ? "workbench" : "quickAction"],
  };
}

export function getBackRoute(route: string): string {
  return route === STAFF_ROUTES.quickAction ? STAFF_ROUTES.workbench : STAFF_ROUTES.home;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
