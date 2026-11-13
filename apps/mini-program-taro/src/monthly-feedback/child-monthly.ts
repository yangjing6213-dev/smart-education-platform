export type ChildMonthlySupplement = "KEEP_WATCHING" | "PROGRESSING" | "FOLLOW_UP";
export type ChildMonthlySupplements = Readonly<{
  learningParticipation: ChildMonthlySupplement;
  dailyHabits: ChildMonthlySupplement;
  activityParticipation: ChildMonthlySupplement;
  familySchoolCollaboration: ChildMonthlySupplement;
}>;
export type ChildMonthlySourceCounts = Readonly<{
  GROWTH_RECORD: number;
  ATTENDANCE_OVERVIEW: number;
}>;
export type ChildMonthlyAction = "edit" | "submit" | "confirm" | "return" | "publish";
export type ChildMonthlyStudent = Readonly<{
  id: string;
  displayRef: string;
  classRef: string;
}>;
export type ChildMonthlyStaffReport = Readonly<{
  id: string;
  studentId: string;
  studentLabel: string;
  classRef: string;
  month: string;
  status: "DRAFT" | "SUBMITTED" | "RETURNED" | "CONFIRMED" | "PUBLISHED" | "REVIEW_REQUIRED";
  version: number;
  sourceVersion: number;
  publicationVersion: number;
  supplements: ChildMonthlySupplements;
  sourceCounts: ChildMonthlySourceCounts;
  actions: readonly ChildMonthlyAction[];
}>;
export type ChildMonthlyParentSummary = Readonly<{
  id: string;
  relationshipId: string;
  relationshipVersion: number;
  studentId: string;
  studentLabel: string;
  month: string;
  publicationVersion: number;
  supplements: ChildMonthlySupplements;
  sourceCounts: ChildMonthlySourceCounts;
  acknowledged: boolean;
}>;
export type ChildMonthlyStaffList = Readonly<{
  records: readonly ChildMonthlyStaffReport[];
  students: readonly ChildMonthlyStudent[];
}>;
export type AuthenticatedGet = (path: string) => Promise<unknown>;
export type AuthenticatedPost = (path: string, body: unknown) => Promise<unknown>;
export type AuthenticatedPatch = (path: string, body: unknown) => Promise<unknown>;

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const monthPattern = /^(?:19|20|21)\d{2}-(?:0[1-9]|1[0-2])$/u;
const supplements = ["KEEP_WATCHING", "PROGRESSING", "FOLLOW_UP"] as const;
const statusValues = ["DRAFT", "SUBMITTED", "RETURNED", "CONFIRMED", "PUBLISHED", "REVIEW_REQUIRED"] as const;
const actionValues = ["edit", "submit", "confirm", "return", "publish"] as const;
const fieldNames = [
  "learningParticipation",
  "dailyHabits",
  "activityParticipation",
  "familySchoolCollaboration",
] as const;
const invalid = () => new Error("孩子月度报告资料格式不正确，请重新读取后重试。");
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const positive = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0;
const nonNegative = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

type ParentRelationship = Readonly<{
  id: string;
  studentId: string;
  status: "ACTIVE" | "RELEASED";
  version: number;
}>;

function parseParentRelationships(value: unknown): ParentRelationship[] {
  if (!Array.isArray(value) || value.length > 100) throw invalid();
  const seen = new Set<string>();
  return value.map((item) => {
    if (
      !object(item) ||
      typeof item.id !== "string" ||
      !uuid.test(item.id) ||
      seen.has(item.id.toLowerCase()) ||
      typeof item.student_id !== "string" ||
      !uuid.test(item.student_id) ||
      item.relationship !== "GUARDIAN" ||
      (item.status !== "ACTIVE" && item.status !== "RELEASED") ||
      typeof item.source_application_id !== "string" ||
      !uuid.test(item.source_application_id) ||
      !positive(item.version) ||
      typeof item.approved_at !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/u.test(item.approved_at) ||
      !Number.isFinite(Date.parse(item.approved_at))
    )
      throw invalid();
    seen.add(item.id.toLowerCase());
    return {
      id: item.id.toLowerCase(),
      studentId: item.student_id.toLowerCase(),
      status: item.status,
      version: item.version,
    };
  });
}

export const CHILD_MONTHLY_FIELDS = [
  { key: "learningParticipation", label: "学习参与" },
  { key: "dailyHabits", label: "日常习惯" },
  { key: "activityParticipation", label: "活动参与" },
  { key: "familySchoolCollaboration", label: "家校协作" },
] as const;

export const CHILD_MONTHLY_OPTIONS = [
  { value: "KEEP_WATCHING", label: "保持关注" },
  { value: "PROGRESSING", label: "已有进步" },
  { value: "FOLLOW_UP", label: "需要跟进" },
] as const;

export function childMonthlyValueLabel(value: string): string {
  return CHILD_MONTHLY_OPTIONS.find((option) => option.value === value)?.label ?? "未记录";
}

function parseSupplements(value: unknown): ChildMonthlySupplements {
  if (
    !object(value) ||
    Object.keys(value).length !== fieldNames.length ||
    fieldNames.some((key) => !supplements.includes(value[key] as ChildMonthlySupplement))
  )
    throw invalid();
  return {
    learningParticipation: value.learningParticipation as ChildMonthlySupplement,
    dailyHabits: value.dailyHabits as ChildMonthlySupplement,
    activityParticipation: value.activityParticipation as ChildMonthlySupplement,
    familySchoolCollaboration: value.familySchoolCollaboration as ChildMonthlySupplement,
  };
}

function parseCounts(value: unknown): ChildMonthlySourceCounts {
  if (
    !object(value) ||
    Object.keys(value).length !== 2 ||
    !nonNegative(value.GROWTH_RECORD) ||
    !nonNegative(value.ATTENDANCE_OVERVIEW)
  )
    throw invalid();
  return {
    GROWTH_RECORD: value.GROWTH_RECORD,
    ATTENDANCE_OVERVIEW: value.ATTENDANCE_OVERVIEW,
  };
}

function parseStudent(value: unknown): ChildMonthlyStudent {
  if (
    !object(value) ||
    typeof value.id !== "string" ||
    !uuid.test(value.id) ||
    typeof value.displayRef !== "string" ||
    !value.displayRef.trim() ||
    value.displayRef.length > 80 ||
    typeof value.classRef !== "string" ||
    !value.classRef.trim() ||
    value.classRef.length > 80
  )
    throw invalid();
  return { id: value.id.toLowerCase(), displayRef: value.displayRef, classRef: value.classRef };
}

function parseStaffReport(value: unknown): ChildMonthlyStaffReport {
  if (
    !object(value) ||
    typeof value.id !== "string" ||
    !uuid.test(value.id) ||
    typeof value.studentId !== "string" ||
    !uuid.test(value.studentId) ||
    typeof value.studentLabel !== "string" ||
    !value.studentLabel.trim() ||
    value.studentLabel.length > 80 ||
    typeof value.classRef !== "string" ||
    !value.classRef.trim() ||
    value.classRef.length > 80 ||
    typeof value.month !== "string" ||
    !monthPattern.test(value.month) ||
    typeof value.status !== "string" ||
    !statusValues.includes(value.status as (typeof statusValues)[number]) ||
    !positive(value.version) ||
    !positive(value.sourceVersion) ||
    !nonNegative(value.publicationVersion) ||
    !Array.isArray(value.actions) ||
    value.actions.some((action) => !actionValues.includes(action as ChildMonthlyAction)) ||
    new Set(value.actions).size !== value.actions.length
  )
    throw invalid();
  return {
    id: value.id.toLowerCase(),
    studentId: value.studentId.toLowerCase(),
    studentLabel: value.studentLabel,
    classRef: value.classRef,
    month: value.month,
    status: value.status as ChildMonthlyStaffReport["status"],
    version: value.version,
    sourceVersion: value.sourceVersion,
    publicationVersion: value.publicationVersion,
    supplements: parseSupplements(value.supplements),
    sourceCounts: parseCounts(value.sourceCounts),
    actions: [...value.actions] as ChildMonthlyAction[],
  };
}

function parseParentSummary(
  value: unknown,
  relationshipId: string,
  studentId: string,
  relationshipVersion: number,
): ChildMonthlyParentSummary {
  if (
    !object(value) ||
    typeof value.id !== "string" ||
    !uuid.test(value.id) ||
    typeof value.studentId !== "string" ||
    !uuid.test(value.studentId) ||
    value.studentId.toLowerCase() !== studentId ||
    typeof value.studentLabel !== "string" ||
    !value.studentLabel.trim() ||
    value.studentLabel.length > 80 ||
    typeof value.month !== "string" ||
    !monthPattern.test(value.month) ||
    !positive(value.publicationVersion) ||
    value.relationshipVersion !== relationshipVersion ||
    typeof value.acknowledged !== "boolean"
  )
    throw invalid();
  return {
    id: value.id.toLowerCase(),
    relationshipId,
    relationshipVersion,
    studentId,
    studentLabel: value.studentLabel,
    month: value.month,
    publicationVersion: value.publicationVersion,
    supplements: parseSupplements(value.supplements),
    sourceCounts: parseCounts(value.sourceCounts),
    acknowledged: value.acknowledged,
  };
}

function reportId(value: string): string {
  if (!uuid.test(value)) throw invalid();
  return value.toLowerCase();
}

function version(value: number): number {
  if (!positive(value)) throw invalid();
  return value;
}

export async function loadStaffChildMonthlyReports(
  get: AuthenticatedGet,
): Promise<ChildMonthlyStaffList> {
  const value = await get("/staff/child-monthly-reports");
  if (!object(value) || !Array.isArray(value.records) || !Array.isArray(value.students)) throw invalid();
  const students = value.students.map(parseStudent);
  const records = value.records.map(parseStaffReport);
  const studentIds = new Set(students.map((student) => student.id));
  if (
    studentIds.size !== students.length ||
    records.some((record) => !studentIds.has(record.studentId)) ||
    new Set(records.map((record) => record.id)).size !== records.length ||
    new Set(records.map((record) => `${record.studentId}:${record.month}`)).size !== records.length
  )
    throw invalid();
  return { students, records };
}

export async function createStaffChildMonthlyReport(
  post: AuthenticatedPost,
  input: { studentId: string; month: string; supplements: ChildMonthlySupplements },
): Promise<ChildMonthlyStaffReport> {
  if (!uuid.test(input.studentId) || !monthPattern.test(input.month)) throw invalid();
  const record = parseStaffReport(await post("/staff/child-monthly-reports", {
    studentId: input.studentId.toLowerCase(),
    month: input.month,
    supplements: parseSupplements(input.supplements),
  }));
  if (record.studentId !== input.studentId.toLowerCase() || record.month !== input.month) throw invalid();
  return record;
}

export async function editStaffChildMonthlyReport(
  patch: AuthenticatedPatch,
  id: string,
  currentVersion: number,
  values: ChildMonthlySupplements,
): Promise<ChildMonthlyStaffReport> {
  const target = reportId(id);
  const record = parseStaffReport(await patch(`/staff/child-monthly-reports/${target}`, {
    version: version(currentVersion),
    supplements: parseSupplements(values),
  }));
  if (record.id !== target) throw invalid();
  return record;
}

export async function submitStaffChildMonthlyReport(
  post: AuthenticatedPost,
  id: string,
  currentVersion: number,
): Promise<ChildMonthlyStaffReport> {
  const target = reportId(id);
  const record = parseStaffReport(await post(`/staff/child-monthly-reports/${target}/submit`, {
    version: version(currentVersion),
  }));
  if (record.id !== target) throw invalid();
  return record;
}

export async function loadParentChildMonthlyReports(
  get: AuthenticatedGet,
): Promise<readonly ChildMonthlyParentSummary[]> {
  const relationships = parseParentRelationships(await get("/guardian-relationships"));
  const active = relationships.filter((relationship) => relationship.status === "ACTIVE");
  const groups = await Promise.all(active.map(async (relationship) => {
    const value = await get(
      `/parent/relationships/${encodeURIComponent(relationship.id)}/monthly-reports`,
    );
    if (!object(value) || !Array.isArray(value.records)) throw invalid();
    return value.records.map((record) =>
      parseParentSummary(record, relationship.id, relationship.studentId, relationship.version),
    );
  }));
  const records: ChildMonthlyParentSummary[] = [];
  for (const group of groups) records.push(...group);
  if (new Set(records.map((record) => `${record.relationshipId}:${record.id}`)).size !== records.length)
    throw invalid();
  return records.sort((left, right) =>
    right.month.localeCompare(left.month) || left.studentLabel.localeCompare(right.studentLabel, "zh-CN"),
  );
}

export async function acknowledgeParentChildMonthlyReport(
  post: AuthenticatedPost,
  record: ChildMonthlyParentSummary,
): Promise<void> {
  if (record.acknowledged) throw new Error("这份月报已经确认阅读。");
  const relationshipId = reportId(record.relationshipId);
  const id = reportId(record.id);
  await post(
    `/parent/relationships/${relationshipId}/monthly-reports/${id}/ack`,
    {
      publicationVersion: version(record.publicationVersion),
      relationshipVersion: version(record.relationshipVersion),
    },
  );
}
