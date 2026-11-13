export type ParentBindingOption = {
  readonly id: string;
  readonly label: string;
};

export type ParentBindingReceipt = {
  readonly id: string;
  readonly status: "PENDING";
  readonly version: number;
  readonly submittedAt: string;
};

export type ParentBindingApplication = {
  readonly id: string;
  readonly studentId: string;
  readonly status: "PENDING" | "APPROVED" | "REJECTED";
  readonly version: number;
  readonly submittedAt: string;
  readonly reviewedAt: string | null;
};

export type ParentGuardianRelationship = {
  readonly id: string;
  readonly studentId: string;
  readonly sourceApplicationId: string;
  readonly status: "ACTIVE" | "RELEASED";
  readonly version: number;
  readonly approvedAt: string;
};

export function canSubmitParentBinding(
  studentId: string,
  applications: readonly ParentBindingApplication[],
  relationships: readonly ParentGuardianRelationship[],
): boolean {
  if (
    relationships.some(
      (relationship) => relationship.studentId === studentId && relationship.status === "ACTIVE",
    )
  )
    return false;

  const studentApplications = applications
    .filter((application) => application.studentId === studentId)
    .sort((left, right) => left.submittedAt.localeCompare(right.submittedAt));
  const latest = studentApplications[studentApplications.length - 1];
  if (!latest) return true;
  if (latest.status === "PENDING") return false;
  if (latest.status === "REJECTED") return true;
  if (latest.status !== "APPROVED") return false;

  return relationships.some(
    (relationship) =>
      relationship.sourceApplicationId === latest.id && relationship.status === "RELEASED",
  );
}

export function toggleParentBindingConsent(current: boolean): boolean {
  return !current;
}

export type AuthenticatedGet = (path: string) => Promise<unknown>;
export type AuthenticatedPost = (path: string, body: unknown) => Promise<unknown>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/u;

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function onlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

function label(value: unknown): value is string {
  return typeof value === "string" && !!value.trim() && value.length <= 80;
}

function timestamp(value: unknown): value is string {
  return (
    typeof value === "string" && ISO_TIMESTAMP.test(value) && Number.isFinite(Date.parse(value))
  );
}

export async function loadParentBindingOptions(
  get: AuthenticatedGet,
): Promise<ParentBindingOption[]> {
  const data = await get("/parent/student-options");
  if (!Array.isArray(data) || data.length > 100) throw new Error("可选学生资料格式不正确。");
  const seen = new Set<string>();
  return data.map((item) => {
    if (
      !record(item) ||
      !onlyKeys(item, ["id", "alias", "label"]) ||
      typeof item.id !== "string" ||
      !UUID.test(item.id) ||
      typeof item.alias !== "string" ||
      !item.alias.trim() ||
      item.alias.length > 80 ||
      !label(item.label) ||
      seen.has(item.id)
    )
      throw new Error("可选学生资料格式不正确。");
    seen.add(item.id);
    return { id: item.id, label: item.label.trim() };
  });
}

export async function loadParentBindingApplications(
  get: AuthenticatedGet,
): Promise<ParentBindingApplication[]> {
  const data = await get("/guardian-binding/applications");
  if (!Array.isArray(data) || data.length > 100) throw new Error("关系申请记录格式不正确。");
  const seen = new Set<string>();
  return data.map((item) => {
    if (
      !record(item) ||
      !onlyKeys(item, [
        "id",
        "student_candidate_ref",
        "relationship",
        "status",
        "version",
        "submitted_at",
        "reviewed_at",
      ]) ||
      typeof item.id !== "string" ||
      !UUID.test(item.id) ||
      seen.has(item.id) ||
      typeof item.student_candidate_ref !== "string" ||
      !UUID.test(item.student_candidate_ref) ||
      item.relationship !== "GUARDIAN" ||
      (item.status !== "PENDING" && item.status !== "APPROVED" && item.status !== "REJECTED") ||
      !Number.isSafeInteger(item.version) ||
      (item.version as number) < 1 ||
      !timestamp(item.submitted_at) ||
      (item.reviewed_at !== null && !timestamp(item.reviewed_at)) ||
      (item.status === "PENDING" && item.reviewed_at !== null) ||
      (item.status !== "PENDING" && item.reviewed_at === null)
    )
      throw new Error("关系申请记录格式不正确。");
    seen.add(item.id);
    return {
      id: item.id,
      studentId: item.student_candidate_ref,
      status: item.status,
      version: item.version as number,
      submittedAt: item.submitted_at,
      reviewedAt: item.reviewed_at,
    };
  });
}

function guardianRelationships(value: unknown): ParentGuardianRelationship[] {
  if (!Array.isArray(value) || value.length > 100) throw new Error("监护关系记录格式不正确。");
  const seen = new Set<string>();
  return value.map((item) => {
    if (
      !record(item) ||
      !onlyKeys(item, [
        "id",
        "student_id",
        "relationship",
        "status",
        "source_application_id",
        "version",
        "approved_at",
      ]) ||
      typeof item.id !== "string" ||
      !UUID.test(item.id) ||
      seen.has(item.id) ||
      typeof item.student_id !== "string" ||
      !UUID.test(item.student_id) ||
      item.relationship !== "GUARDIAN" ||
      (item.status !== "ACTIVE" && item.status !== "RELEASED") ||
      typeof item.source_application_id !== "string" ||
      !UUID.test(item.source_application_id) ||
      !Number.isSafeInteger(item.version) ||
      (item.version as number) < 1 ||
      !timestamp(item.approved_at)
    )
      throw new Error("监护关系记录格式不正确。");
    seen.add(item.id);
    return {
      id: item.id,
      studentId: item.student_id,
      sourceApplicationId: item.source_application_id,
      status: item.status,
      version: item.version as number,
      approvedAt: item.approved_at,
    };
  });
}

export async function loadParentGuardianRelationships(
  get: AuthenticatedGet,
): Promise<ParentGuardianRelationship[]> {
  return guardianRelationships(await get("/guardian-relationships"));
}

export async function releaseParentGuardianRelationship(
  get: AuthenticatedGet,
  post: AuthenticatedPost,
  relationshipId: string,
  version: number,
  confirmed: boolean,
): Promise<ParentGuardianRelationship> {
  if (!confirmed) throw new Error("请先确认解除监护关系。");
  if (!UUID.test(relationshipId) || !Number.isSafeInteger(version) || version < 1)
    throw new Error("监护关系状态无效，请重新读取后再试。");

  const receipt = guardianRelationships([
    await post(`/guardian-relationships/${relationshipId}/release`, { version }),
  ])[0];
  if (
    !receipt ||
    receipt.id !== relationshipId ||
    receipt.status !== "RELEASED" ||
    receipt.version !== version + 1
  )
    throw new Error("关系解除回执与预期不一致，请重新读取状态。");

  const readback = (await loadParentGuardianRelationships(get)).find(
    (relationship) => relationship.id === relationshipId,
  );
  if (!readback || readback.status !== "RELEASED" || readback.version !== version + 1)
    throw new Error("关系状态尚未确认，请重新读取后再试。");
  return readback;
}

export async function submitParentBinding(
  post: AuthenticatedPost,
  studentCandidateRef: string,
  consentConfirmed: boolean,
): Promise<ParentBindingReceipt> {
  if (!UUID.test(studentCandidateRef)) throw new Error("请先选择学生。");
  if (consentConfirmed !== true) throw new Error("请先确认关系申请说明。");
  const data = await post("/guardian-binding/applications", {
    student_candidate_ref: studentCandidateRef,
    relationship: "GUARDIAN",
    consent: true,
  });
  if (
    !record(data) ||
    !onlyKeys(data, [
      "id",
      "student_candidate_ref",
      "relationship",
      "status",
      "version",
      "submitted_at",
      "reviewed_at",
    ]) ||
    typeof data.id !== "string" ||
    !UUID.test(data.id) ||
    data.student_candidate_ref !== studentCandidateRef ||
    data.relationship !== "GUARDIAN" ||
    data.status !== "PENDING" ||
    !Number.isSafeInteger(data.version) ||
    data.version !== 1 ||
    !timestamp(data.submitted_at) ||
    data.reviewed_at !== null
  )
    throw new Error("关系申请回执格式不正确。");
  return {
    id: data.id,
    status: "PENDING",
    version: 1,
    submittedAt: data.submitted_at,
  };
}
