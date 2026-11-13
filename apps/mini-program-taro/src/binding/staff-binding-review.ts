import type { AuthenticatedGet, AuthenticatedPost } from "./parent-binding";

export type StaffBindingQueueItem = {
  readonly id: string;
  readonly applicantLabel: string;
  readonly studentLabel: string;
  readonly relationship: "GUARDIAN";
  readonly version: number;
  readonly submittedAt: string;
};

export type StaffBindingDecision = "approve" | "reject";

export type StaffBindingReviewReceipt = {
  readonly id: string;
  readonly status: "APPROVED" | "REJECTED";
  readonly version: number;
  readonly reviewedAt: string;
};

type ReviewTarget = { readonly id: string; readonly version: number };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/u;

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function onlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

function validLabel(value: unknown): value is string {
  return typeof value === "string" && !!value.trim() && value.length <= 80;
}

function validTimestamp(value: unknown): value is string {
  return typeof value === "string" && ISO_TIMESTAMP.test(value) && Number.isFinite(Date.parse(value));
}

export async function loadStaffBindingQueue(get: AuthenticatedGet): Promise<StaffBindingQueueItem[]> {
  const data = await get("/staff/guardian-binding/applications");
  if (!Array.isArray(data) || data.length > 100) throw new Error("待审核申请格式不正确。");
  const seen = new Set<string>();
  return data.map((item) => {
    if (
      !record(item) ||
      !onlyKeys(item, ["id", "relationship", "status", "version", "submitted_at", "reviewed_at", "applicant_label", "student_label"]) ||
      typeof item.id !== "string" ||
      !UUID.test(item.id) ||
      seen.has(item.id) ||
      item.relationship !== "GUARDIAN" ||
      item.status !== "PENDING" ||
      !Number.isSafeInteger(item.version) ||
      (item.version as number) < 1 ||
      !validTimestamp(item.submitted_at) ||
      item.reviewed_at !== null ||
      !validLabel(item.applicant_label) ||
      !validLabel(item.student_label)
    )
      throw new Error("待审核申请格式不正确。");
    seen.add(item.id);
    return {
      id: item.id,
      applicantLabel: item.applicant_label.trim(),
      studentLabel: item.student_label.trim(),
      relationship: "GUARDIAN",
      version: item.version as number,
      submittedAt: item.submitted_at,
    };
  });
}

export async function reviewStaffBinding(
  post: AuthenticatedPost,
  target: ReviewTarget,
  action: StaffBindingDecision,
): Promise<StaffBindingReviewReceipt> {
  if (!UUID.test(target.id)) throw new Error("申请编号无效。");
  if (!Number.isSafeInteger(target.version) || target.version < 1) throw new Error("申请版本无效。");
  const data = await post(`/staff/guardian-binding/applications/${target.id}/review`, {
    version: target.version,
    action,
  });
  const expectedStatus = action === "approve" ? "APPROVED" : "REJECTED";
  if (
    !record(data) ||
    !onlyKeys(data, ["id", "student_candidate_ref", "relationship", "status", "version", "submitted_at", "reviewed_at"]) ||
    data.id !== target.id ||
    typeof data.student_candidate_ref !== "string" ||
    !UUID.test(data.student_candidate_ref) ||
    data.relationship !== "GUARDIAN" ||
    data.status !== expectedStatus ||
    data.version !== target.version + 1 ||
    !validTimestamp(data.submitted_at) ||
    !validTimestamp(data.reviewed_at)
  )
    throw new Error("审核回执格式不正确。");
  return {
    id: target.id,
    status: expectedStatus,
    version: target.version + 1,
    reviewedAt: data.reviewed_at,
  };
}
