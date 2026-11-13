import type { InvitedStaffTaskView, StaffTaskAction } from "@student-care/contracts";
import type { TrustedMembership } from "@student-care/auth";

export function uniqueTaskMembership(
  memberships: readonly TrustedMembership[],
  required: readonly string[],
): TrustedMembership | undefined {
  const candidates = memberships.filter(
    (membership) =>
      membership.status === "ACTIVE" &&
      membership.campus_ids.length === 1 &&
      required.every((capability) => membership.capabilities.includes(capability as never)),
  );
  return candidates.length === 1 ? candidates[0] : undefined;
}

export function taskActions(
  status: InvitedStaffTaskView["status"],
  capabilities: readonly string[],
  own: boolean,
  claimedBySelf: boolean,
  activeAssignment = true,
): StaffTaskAction[] {
  if (status === "CHECKED" || status === "CANCELLED") return [];
  const actions: StaffTaskAction[] = [];
  if (activeAssignment) {
    if (
      own &&
      (status === "ASSIGNED" || status === "RETURNED") &&
      capabilities.includes("task:claim")
    )
      actions.push("claim");
    if (own && claimedBySelf && status === "CLAIMED" && capabilities.includes("task:start"))
      actions.push("start");
    if (own && status === "IN_PROGRESS" && capabilities.includes("task:complete"))
      actions.push("complete");
    if (!own && status === "COMPLETED" && capabilities.includes("task:check"))
      actions.push("check");
  }
  if (capabilities.includes("task:cancel")) actions.push("cancel");
  return actions;
}

export function validTaskDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/u.test(value) &&
    Number.isFinite(Date.parse(value + "T00:00:00Z")) &&
    new Date(value + "T00:00:00Z").toISOString().slice(0, 10) === value
  );
}

export function shanghaiTaskDate(now: number): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  return ["year", "month", "day"]
    .map((type) => parts.find((part) => part.type === type)?.value)
    .join("-");
}
