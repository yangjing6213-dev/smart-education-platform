import type { InviteRole, InviteSessionSnapshot } from "./invite-session";

const supportedRoles: readonly InviteRole[] = ["PARENT", "STAFF"];

export function authorizedRoles(
  snapshot: Pick<InviteSessionSnapshot, "status" | "roles">,
): InviteRole[] {
  if (snapshot.status !== "READY") return [];
  return supportedRoles.filter((role) => snapshot.roles.includes(role));
}

export function hasRoleAccess(
  snapshot: Pick<InviteSessionSnapshot, "status" | "roles">,
  requiredRole: InviteRole,
): boolean {
  return authorizedRoles(snapshot).includes(requiredRole);
}
