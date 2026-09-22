import { getStaffRoute, getStaffScope, type StaffAccessInput } from "../../routes/staff.routes.ts";

export type QuickAction = "REVIEW_TASKS" | "CHECK_SYNTHETIC_STATUS";

export type QuickActionResult = {
  status: "READY" | "DENIED";
  action: QuickAction;
  result: string | null;
};

const localResults: Record<QuickAction, string> = {
  REVIEW_TASKS: "模拟任务已准备查看",
  CHECK_SYNTHETIC_STATUS: "模拟状态检查已完成",
};

export function runQuickAction(input: StaffAccessInput, action: QuickAction): QuickActionResult {
  const scope = getStaffScope(input);
  if (!scope || !getStaffRoute(input, "quick-action", scope).allowed) {
    return { status: "DENIED", action, result: null };
  }

  return { status: "READY", action, result: localResults[action] };
}
