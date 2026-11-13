export type LeaveReasonCategory = "FAMILY_ARRANGEMENT" | "TEMPORARY_MATTER";
export type ParentLeaveAction = "resubmit" | "withdraw" | "acknowledge";
export type StaffLeaveAction = "confirm" | "return";
export type LeaveRequestStatus = "SUBMITTED" | "RETURNED" | "CONFIRMED" | "WITHDRAWN";

export type ParentLeaveRequest = {
  readonly id: string;
  readonly studentId: string;
  readonly studentLabel: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly reasonCategory: LeaveReasonCategory;
  readonly status: LeaveRequestStatus;
  readonly version: number;
  readonly acknowledged: boolean;
  readonly actions: readonly ParentLeaveAction[];
  readonly updatedAt: string;
};

export type StaffLeaveRequest = Omit<ParentLeaveRequest, "actions"> & {
  readonly classLabel: string;
  readonly actions: readonly StaffLeaveAction[];
};

export type AuthenticatedGet = (path: string) => Promise<unknown>;
export type AuthenticatedPost = (path: string, body: unknown) => Promise<unknown>;

export type ParentLeaveInput = {
  readonly studentId: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly reasonCategory: LeaveReasonCategory;
};

export type ParentResubmitInput = Omit<ParentLeaveInput, "studentId">;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/u;
const REASONS: readonly LeaveReasonCategory[] = ["FAMILY_ARRANGEMENT", "TEMPORARY_MATTER"];
const STATUSES: readonly LeaveRequestStatus[] = ["SUBMITTED", "RETURNED", "CONFIRMED", "WITHDRAWN"];
const PARENT_ACTIONS: readonly ParentLeaveAction[] = ["resubmit", "withdraw", "acknowledge"];
const STAFF_ACTIONS: readonly StaffLeaveAction[] = ["confirm", "return"];

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && actual.every((key) => keys.includes(key));
}

function date(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function timestamp(value: unknown): value is string {
  return (
    typeof value === "string" && ISO_TIMESTAMP.test(value) && Number.isFinite(Date.parse(value))
  );
}

function label(value: unknown): value is string {
  return (
    typeof value === "string" &&
    !!value.trim() &&
    value.length <= 80 &&
    !UUID.test(value.trim())
  );
}

function version(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

function actionList<T extends string>(value: unknown, allowed: readonly T[]): value is T[] {
  return (
    Array.isArray(value) &&
    value.length <= allowed.length &&
    value.every((action, index) => allowed.includes(action as T) && value.indexOf(action) === index)
  );
}

function parseParentRequest(value: unknown): ParentLeaveRequest {
  const keys = [
    "id",
    "student_id",
    "student_display_ref",
    "start_date",
    "end_date",
    "reason_category",
    "status",
    "version",
    "acknowledged",
    "actions",
    "updated_at",
  ];
  if (
    !record(value) ||
    !exactKeys(value, keys) ||
    typeof value.id !== "string" ||
    !UUID.test(value.id) ||
    typeof value.student_id !== "string" ||
    !UUID.test(value.student_id) ||
    !label(value.student_display_ref) ||
    !date(value.start_date) ||
    !date(value.end_date) ||
    value.start_date > value.end_date ||
    !REASONS.includes(value.reason_category as LeaveReasonCategory) ||
    !STATUSES.includes(value.status as LeaveRequestStatus) ||
    !version(value.version) ||
    typeof value.acknowledged !== "boolean" ||
    !actionList(value.actions, PARENT_ACTIONS) ||
    !timestamp(value.updated_at)
  ) {
    throw new Error("请假申请信息格式不正确。");
  }
  return {
    id: value.id,
    studentId: value.student_id,
    studentLabel: value.student_display_ref.trim(),
    startDate: value.start_date,
    endDate: value.end_date,
    reasonCategory: value.reason_category as LeaveReasonCategory,
    status: value.status as LeaveRequestStatus,
    version: value.version,
    acknowledged: value.acknowledged,
    actions: value.actions,
    updatedAt: value.updated_at,
  };
}

function parseStaffRequest(value: unknown, pendingOnly = true): StaffLeaveRequest {
  if (!record(value)) throw new Error("请假审核信息格式不正确。");
  const keys = [
    "id",
    "student_id",
    "student_display_ref",
    "start_date",
    "end_date",
    "reason_category",
    "status",
    "version",
    "acknowledged",
    "actions",
    "updated_at",
    "class_ref",
  ];
  if (
    !exactKeys(value, keys) ||
    !label(value.class_ref) ||
    !STATUSES.includes(value.status as LeaveRequestStatus) ||
    !actionList(value.actions, STAFF_ACTIONS)
  ) {
    throw new Error("请假审核信息格式不正确。");
  }
  if (
    (pendingOnly && value.status !== "SUBMITTED") ||
    (value.status === "SUBMITTED" && value.actions.length === 0) ||
    (value.status !== "SUBMITTED" && value.actions.length !== 0)
  ) {
    throw new Error("请假审核状态格式不正确。");
  }
  const parent = parseParentRequest({
    id: value.id,
    student_id: value.student_id,
    student_display_ref: value.student_display_ref,
    start_date: value.start_date,
    end_date: value.end_date,
    reason_category: value.reason_category,
    status: value.status,
    version: value.version,
    acknowledged: value.acknowledged,
    actions: [],
    updated_at: value.updated_at,
  });
  return { ...parent, classLabel: value.class_ref.trim(), actions: value.actions };
}

function parseList<T>(value: unknown, parse: (item: unknown) => T, message: string): T[] {
  if (!Array.isArray(value) || value.length > 100) throw new Error(message);
  const result = value.map(parse);
  const ids = new Set<string>();
  for (const item of result) {
    const id = (item as { readonly id: string }).id;
    if (ids.has(id)) throw new Error(message);
    ids.add(id);
  }
  return result;
}

function validInput(input: ParentLeaveInput | ParentResubmitInput): boolean {
  return (
    date(input.startDate) &&
    date(input.endDate) &&
    input.startDate <= input.endDate &&
    REASONS.includes(input.reasonCategory)
  );
}

export async function loadParentLeaveRequests(get: AuthenticatedGet): Promise<ParentLeaveRequest[]> {
  return parseList(await get("/parent/leave-requests"), parseParentRequest, "请假申请列表格式不正确。");
}

export async function createParentLeaveRequest(
  post: AuthenticatedPost,
  input: ParentLeaveInput,
): Promise<ParentLeaveRequest> {
  if (!UUID.test(input.studentId)) throw new Error("请选择已确认关联的学生。");
  if (!validInput(input)) {
    if (!date(input.startDate) || !date(input.endDate) || input.startDate > input.endDate) {
      throw new Error("请检查请假开始和结束日期。");
    }
    throw new Error("请选择申请原因。");
  }
  const result = parseParentRequest(await post("/parent/leave-requests", {
    student_id: input.studentId,
    start_date: input.startDate,
    end_date: input.endDate,
    reason_category: input.reasonCategory,
  }));
  if (result.status !== "SUBMITTED") throw new Error("申请状态未能确认，请刷新列表核对。");
  return result;
}

export async function runParentLeaveAction(
  post: AuthenticatedPost,
  request: ParentLeaveRequest,
  action: ParentLeaveAction,
  resubmit?: ParentResubmitInput,
): Promise<ParentLeaveRequest> {
  if (!request.actions.includes(action)) throw new Error("该申请当前没有此操作，请刷新列表。");
  let path: string;
  let body: Record<string, unknown>;
  if (action === "resubmit") {
    if (resubmit === undefined || !validInput(resubmit)) {
      throw new Error("请检查请假开始和结束日期，并选择申请原因。");
    }
    path = `/parent/leave-requests/${request.id}/resubmit`;
    body = {
      version: request.version,
      start_date: resubmit.startDate,
      end_date: resubmit.endDate,
      reason_category: resubmit.reasonCategory,
    };
  } else {
    path = `/parent/leave-requests/${request.id}/${action}`;
    body = { version: request.version };
  }
  return parseParentRequest(await post(path, body));
}

export async function loadStaffLeaveRequests(get: AuthenticatedGet): Promise<StaffLeaveRequest[]> {
  return parseList(await get("/staff/leave-requests"), parseStaffRequest, "请假审核列表格式不正确。");
}

export async function reviewStaffLeaveRequest(
  post: AuthenticatedPost,
  request: StaffLeaveRequest,
  action: StaffLeaveAction,
): Promise<StaffLeaveRequest> {
  if (!request.actions.includes(action)) throw new Error("该申请当前没有此审核操作，请刷新列表。");
  return parseStaffRequest(await post(`/staff/leave-requests/${request.id}/review`, {
    version: request.version,
    action,
  }), false);
}
