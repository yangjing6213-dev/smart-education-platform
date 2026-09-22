export type StaffRole = "staff" | "teacher" | "visitor";
export type StaffMembership = "active" | "suspended" | "revoked" | "missing";

export interface StaffAccess {
  readonly session: string | null;
  readonly membership: StaffMembership;
  readonly role: StaffRole;
  readonly capabilities: readonly string[];
  readonly tenantId: string;
  readonly campusId: string;
}

export type StaffRouteKey = "workbench" | "report" | "guides" | "resources";

export type StaffRoute =
  | {
      readonly kind: "authorized";
      readonly path:
        "/staff/workbench" | "/staff/report" | "/staff/guides" | "/web/staff/resources";
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
      route === "report"
        ? "/staff/report"
        : route === "guides"
          ? "/staff/guides"
          : route === "resources"
            ? "/web/staff/resources"
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
    !capabilities.includes("employee:workbench")
  ) {
    return false;
  }

  return (
    route !== "report" || (access.role === "teacher" && capabilities.includes("teacher:summary"))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
