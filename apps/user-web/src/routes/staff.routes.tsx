export type StaffRole = "staff" | "teacher" | "visitor";
export type StaffMembership = "active" | "suspended" | "revoked" | "missing";

export interface StaffAccess {
  readonly session: string | null;
  readonly membership: StaffMembership;
  readonly role: StaffRole;
  readonly capabilities: readonly string[];
  readonly tenantId: string;
  readonly campusId: string;
  readonly classIds?: readonly string[];
  readonly scopeTenantId?: string;
  readonly scopeCampusId?: string;
}

export type StaffRouteKey =
  "workbench" | "report" | "guides" | "resources" | "partner-cloud" | "leave-review";

export type StaffRoute =
  | {
      readonly kind: "authorized";
      readonly path:
        | "/staff/workbench"
        | "/staff/report"
        | "/staff/report?view=leave-review"
        | "/staff/guides"
        | "/web/staff/resources"
        | "/web/staff/partner-cloud";
    }
  | {
      readonly kind: "denied";
      readonly path: "/staff/denied";
      readonly reason: "staff-access-required";
    };

export function selectStaffRoute(access: unknown, route: StaffRouteKey): StaffRoute {
  if (!isAuthorizedStaff(access, route)) {
    return {
      kind: "denied",
      path: "/staff/denied",
      reason: "staff-access-required",
    };
  }

  return {
    kind: "authorized",
    path:
      route === "leave-review"
        ? "/staff/report?view=leave-review"
        : route === "report"
          ? "/staff/report"
          : route === "guides"
            ? "/staff/guides"
            : route === "resources"
              ? "/web/staff/resources"
              : route === "partner-cloud"
                ? "/web/staff/partner-cloud"
                : "/staff/workbench",
  };
}

export function isAuthorizedStaff(
  access: unknown,
  route: StaffRouteKey = "workbench",
): access is StaffAccess {
  if (!isRecord(access)) {
    return false;
  }

  const capabilities = access.capabilities;
  if (
    typeof access.session !== "string" ||
    access.session.length === 0 ||
    access.membership !== "active" ||
    access.role === "visitor" ||
    typeof access.tenantId !== "string" ||
    access.tenantId.length === 0 ||
    typeof access.campusId !== "string" ||
    access.campusId.length === 0 ||
    !Array.isArray(capabilities) ||
    !capabilities.every((capability) => typeof capability === "string") ||
    !hasValidSyntheticScope(access)
  ) {
    return false;
  }

  const requiredCapability =
    route === "leave-review"
      ? "teacher:leave-review"
      : route === "report"
        ? "teacher:summary"
        : route === "partner-cloud"
          ? "employee:partner-cloud"
          : "employee:workbench";

  if (!capabilities.includes(requiredCapability)) return false;
  if (route === "report" || route === "leave-review") {
    if (access.role !== "teacher") return false;
  }
  if (route === "leave-review") {
    return (
      Array.isArray(access.classIds) &&
      access.classIds.length > 0 &&
      access.classIds.every((classId) => typeof classId === "string" && classId.length > 0)
    );
  }
  return true;
}

function hasValidSyntheticScope(access: Record<string, unknown>): boolean {
  for (const [scopeKey, identityKey] of [
    ["scopeTenantId", "tenantId"],
    ["scopeCampusId", "campusId"],
  ] as const) {
    const scopeValue = access[scopeKey];
    if (
      scopeValue !== undefined &&
      (typeof scopeValue !== "string" ||
        scopeValue.length === 0 ||
        scopeValue !== access[identityKey])
    ) {
      return false;
    }
  }

  return true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
