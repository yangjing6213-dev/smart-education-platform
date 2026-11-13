export type StaffMonthlyStatus =
  "DRAFT" | "SUBMITTED" | "RETURNED" | "CONFIRMED" | "PUBLISHED" | "REVIEW_REQUIRED";
export type StaffMonthlyAction = "edit" | "submit" | "confirm" | "return" | "publish";
export type MonthlySupplement = "KEEP_WATCHING" | "PROGRESSING" | "FOLLOW_UP";
export interface MonthlySupplements {
  readonly learningParticipation: MonthlySupplement;
  readonly dailyHabits: MonthlySupplement;
  readonly activityParticipation: MonthlySupplement;
  readonly familySchoolCollaboration: MonthlySupplement;
}
export interface StaffMonthlyRecord {
  readonly id: string;
  readonly version: number;
  readonly sourceVersion: number;
  readonly status: StaffMonthlyStatus;
  readonly month: string;
  readonly classRef: string;
  readonly audience: "STAFF_INTERNAL";
  readonly supplements: MonthlySupplements;
  readonly sourceCounts: Readonly<{
    GROWTH_RECORD: number;
    ATTENDANCE_OVERVIEW: number;
    STAFF_DAILY: number;
  }>;
  readonly actions: readonly StaffMonthlyAction[];
}
export interface StaffMonthlyListing {
  readonly records: readonly StaffMonthlyRecord[];
  readonly canCreate: boolean;
}

type AuthenticatedGet = (path: string) => Promise<unknown>;
type AuthenticatedWrite = (path: string, body: unknown) => Promise<unknown>;
const options = [
  { value: "KEEP_WATCHING", label: "保持关注" },
  { value: "PROGRESSING", label: "已有进步" },
  { value: "FOLLOW_UP", label: "需要跟进" },
] as const;
export const STAFF_MONTHLY_FIELDS = [
  { key: "learningParticipation", label: "学习参与", options },
  { key: "dailyHabits", label: "日常习惯", options },
  { key: "activityParticipation", label: "活动参与", options },
  { key: "familySchoolCollaboration", label: "家校协作", options },
] as const;

const statuses: readonly string[] = [
  "DRAFT",
  "SUBMITTED",
  "RETURNED",
  "CONFIRMED",
  "PUBLISHED",
  "REVIEW_REQUIRED",
];
const actionsByStatus: Readonly<Record<StaffMonthlyStatus, readonly string[]>> = {
  DRAFT: ["edit", "submit"],
  SUBMITTED: ["confirm", "return"],
  RETURNED: ["edit"],
  CONFIRMED: ["return", "publish"],
  PUBLISHED: [],
  REVIEW_REQUIRED: ["edit"],
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const validMonth = (value: unknown): value is string =>
  typeof value === "string" && /^(?:19|20|21)\d{2}-(?:0[1-9]|1[0-2])$/u.test(value);
const positive = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0;
const invalid = () => new Error("班级月度总结资料格式不正确，请刷新后重试。");

function parseSupplements(value: unknown, exact = false): MonthlySupplements {
  if (
    !object(value) ||
    (exact && Object.keys(value).length !== STAFF_MONTHLY_FIELDS.length) ||
    STAFF_MONTHLY_FIELDS.some(({ key }) => !options.some((option) => option.value === value[key]))
  )
    throw invalid();
  return {
    learningParticipation: value.learningParticipation as MonthlySupplement,
    dailyHabits: value.dailyHabits as MonthlySupplement,
    activityParticipation: value.activityParticipation as MonthlySupplement,
    familySchoolCollaboration: value.familySchoolCollaboration as MonthlySupplement,
  };
}

function parseRecord(value: unknown): StaffMonthlyRecord {
  if (
    !object(value) ||
    typeof value.id !== "string" ||
    !uuid.test(value.id) ||
    !positive(value.version) ||
    !positive(value.sourceVersion) ||
    typeof value.status !== "string" ||
    !statuses.includes(value.status) ||
    !validMonth(value.month) ||
    typeof value.classRef !== "string" ||
    !value.classRef.trim() ||
    value.classRef.length > 80 ||
    value.audience !== "STAFF_INTERNAL" ||
    !object(value.sourceCounts) ||
    !Array.isArray(value.actions) ||
    value.actions.some(
      (action) =>
        typeof action !== "string" ||
        !actionsByStatus[value.status as StaffMonthlyStatus].includes(action),
    ) ||
    new Set(value.actions).size !== value.actions.length
  )
    throw invalid();
  const counts = value.sourceCounts;
  for (const key of ["GROWTH_RECORD", "ATTENDANCE_OVERVIEW", "STAFF_DAILY"] as const)
    if (typeof counts[key] !== "number" || !Number.isSafeInteger(counts[key]) || counts[key] < 0)
      throw invalid();
  return {
    id: value.id.toLowerCase(),
    version: value.version,
    sourceVersion: value.sourceVersion,
    status: value.status as StaffMonthlyStatus,
    month: value.month,
    classRef: value.classRef,
    audience: "STAFF_INTERNAL",
    supplements: parseSupplements(value.supplements),
    sourceCounts: {
      GROWTH_RECORD: counts.GROWTH_RECORD as number,
      ATTENDANCE_OVERVIEW: counts.ATTENDANCE_OVERVIEW as number,
      STAFF_DAILY: counts.STAFF_DAILY as number,
    },
    actions: [...value.actions] as StaffMonthlyAction[],
  };
}

function reportId(value: string): string {
  if (typeof value !== "string" || !uuid.test(value)) throw invalid();
  return value.toLowerCase();
}
function version(value: number): number {
  if (!positive(value)) throw invalid();
  return value;
}

export async function loadStaffMonthlyReports(get: AuthenticatedGet): Promise<StaffMonthlyListing> {
  const value = await get("/staff/monthly-feedback");
  if (!object(value) || !Array.isArray(value.records) || typeof value.canCreate !== "boolean")
    throw invalid();
  const records = value.records.map(parseRecord);
  if (new Set(records.map((record) => record.id)).size !== records.length) throw invalid();
  return { records, canCreate: value.canCreate };
}

export async function createStaffMonthlyDraft(
  post: AuthenticatedWrite,
  month: string,
  supplements: MonthlySupplements,
): Promise<StaffMonthlyRecord> {
  if (!validMonth(month)) throw new Error("请选择有效的月度总结月份。");
  const record = parseRecord(
    await post("/staff/monthly-feedback", {
      month,
      supplements: parseSupplements(supplements, true),
    }),
  );
  if (record.month !== month) throw invalid();
  return record;
}

export async function editStaffMonthlyDraft(
  patch: AuthenticatedWrite,
  id: string,
  currentVersion: number,
  supplements: MonthlySupplements,
): Promise<StaffMonthlyRecord> {
  const target = reportId(id);
  const record = parseRecord(
    await patch(`/staff/monthly-feedback/${target}`, {
      version: version(currentVersion),
      supplements: parseSupplements(supplements, true),
    }),
  );
  if (record.id !== target) throw invalid();
  return record;
}

export async function submitStaffMonthlyDraft(
  post: AuthenticatedWrite,
  id: string,
  currentVersion: number,
): Promise<StaffMonthlyRecord> {
  const target = reportId(id);
  const record = parseRecord(
    await post(`/staff/monthly-feedback/${target}/submit`, {
      version: version(currentVersion),
    }),
  );
  if (record.id !== target) throw invalid();
  return record;
}

export function staffMonthlyValueLabel(key: keyof MonthlySupplements, value: string): string {
  return (
    STAFF_MONTHLY_FIELDS.find((field) => field.key === key)?.options.find(
      (option) => option.value === value,
    )?.label ?? "未记录"
  );
}
