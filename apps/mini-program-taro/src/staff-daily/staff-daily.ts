import type { StaffDailyValues } from "../../../../packages/contracts/src/staff-daily";

export type StaffDailyStatus = "DRAFT" | "SUBMITTED" | "RETURNED" | "CONFIRMED";
export type StaffDailyAction = "edit" | "submit" | "resubmit";
export type StaffDailySourceKind =
  "TASK" | "ATTENDANCE" | "CARE_RECORD" | "PICKUP" | "PICKUP_EXCEPTION";

export interface StaffDailyRecord {
  readonly id: string;
  readonly version: number;
  readonly status: StaffDailyStatus;
  readonly date: string;
  readonly values: StaffDailyValues;
  readonly sourceCounts: Readonly<Record<StaffDailySourceKind, number>>;
  readonly learningSummary: {
    readonly completedLearnerBand: "2_PLUS";
    readonly usedGuidance: boolean;
    readonly needsTeacherFollowUp: boolean;
  } | null;
  readonly actions: readonly StaffDailyAction[];
}

export interface StaffDailyListing {
  readonly records: readonly StaffDailyRecord[];
  readonly canCreate: boolean;
}

type AuthenticatedGet = (path: string) => Promise<unknown>;
type AuthenticatedPost = (path: string, body: unknown) => Promise<unknown>;
type AuthenticatedPatch = (path: string, body: unknown) => Promise<unknown>;
type DailyFieldKey = keyof StaffDailyValues;
type DailyField = {
  readonly key: DailyFieldKey;
  readonly label: string;
  readonly options: readonly { readonly value: string; readonly label: string }[];
};

export const STAFF_DAILY_FIELDS: readonly DailyField[] = [
  {
    key: "arrival",
    label: "到校情况",
    options: [
      { value: "ARRIVED_AS_PLANNED", label: "按计划到校" },
      { value: "LATE", label: "较晚到校" },
      { value: "ABSENT", label: "未到校" },
    ],
  },
  {
    key: "homework",
    label: "作业整理",
    options: [
      { value: "COMPLETED", label: "已完成整理" },
      { value: "IN_PROGRESS", label: "正在整理" },
      { value: "NEEDS_SUPPORT", label: "需要协助" },
    ],
  },
  {
    key: "activity",
    label: "活动参与",
    options: [
      { value: "PARTICIPATED", label: "参与活动" },
      { value: "OBSERVED", label: "观察活动" },
      { value: "NOT_RECORDED", label: "未记录" },
    ],
  },
  {
    key: "classroom",
    label: "课堂状态",
    options: [
      { value: "ROUTINE", label: "日常状态" },
      { value: "NEEDS_ATTENTION", label: "需要关注" },
      { value: "NEEDS_FOLLOW_UP", label: "需要跟进" },
    ],
  },
  {
    key: "followUp",
    label: "后续安排",
    options: [
      { value: "NONE", label: "暂无后续事项" },
      { value: "OBSERVE_TOMORROW", label: "明日继续观察" },
      { value: "OWNER_ATTENTION", label: "请负责人关注" },
    ],
  },
];

const sourceKinds: readonly StaffDailySourceKind[] = [
  "TASK",
  "ATTENDANCE",
  "CARE_RECORD",
  "PICKUP",
  "PICKUP_EXCEPTION",
];
const valueKeys: readonly DailyFieldKey[] = [
  "arrival",
  "homework",
  "activity",
  "classroom",
  "followUp",
];
const statuses: readonly StaffDailyStatus[] = ["DRAFT", "SUBMITTED", "RETURNED", "CONFIRMED"];
const actions: readonly StaffDailyAction[] = ["edit", "submit", "resubmit"];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && actual.every((key) => keys.includes(key));
}

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function parseValues(value: unknown): StaffDailyValues {
  if (!isObject(value) || !hasExactKeys(value, valueKeys))
    throw new Error("工作日报内容格式不正确。");
  for (const field of STAFF_DAILY_FIELDS) {
    if (!field.options.some((option) => option.value === value[field.key]))
      throw new Error("工作日报包含无效选项。");
  }
  return value as unknown as StaffDailyValues;
}

function validateValues(value: StaffDailyValues): StaffDailyValues {
  return parseValues(value);
}

function parseRecord(value: unknown): StaffDailyRecord {
  const keys = [
    "id",
    "version",
    "status",
    "date",
    "values",
    "sourceCounts",
    "learningSummary",
    "actions",
  ];
  if (
    !isObject(value) ||
    !hasExactKeys(value, keys) ||
    typeof value.id !== "string" ||
    !uuid.test(value.id) ||
    !Number.isSafeInteger(value.version) ||
    (value.version as number) < 1 ||
    !statuses.includes(value.status as StaffDailyStatus) ||
    !validDate(value.date)
  )
    throw new Error("工作日报资料格式不正确。");
  const reportActions = value.actions;
  if (
    !Array.isArray(reportActions) ||
    reportActions.length > actions.length ||
    reportActions.some(
      (action, index) =>
        !actions.includes(action as StaffDailyAction) || reportActions.indexOf(action) !== index,
    )
  )
    throw new Error("工作日报操作项格式不正确。");

  if (!isObject(value.sourceCounts) || !hasExactKeys(value.sourceCounts, sourceKinds))
    throw new Error("工作日报来源统计格式不正确。");
  const sourceCounts = {} as Record<StaffDailySourceKind, number>;
  for (const kind of sourceKinds) {
    const count = value.sourceCounts[kind];
    if (!Number.isSafeInteger(count) || (count as number) < 0 || (count as number) > 10000)
      throw new Error("工作日报来源统计格式不正确。");
    sourceCounts[kind] = count as number;
  }

  let learningSummary: StaffDailyRecord["learningSummary"];
  if (value.learningSummary === null) {
    learningSummary = null;
  } else if (
    isObject(value.learningSummary) &&
    hasExactKeys(value.learningSummary, [
      "completedLearnerBand",
      "usedGuidance",
      "needsTeacherFollowUp",
    ]) &&
    value.learningSummary.completedLearnerBand === "2_PLUS" &&
    typeof value.learningSummary.usedGuidance === "boolean" &&
    typeof value.learningSummary.needsTeacherFollowUp === "boolean"
  ) {
    learningSummary = {
      completedLearnerBand: "2_PLUS",
      usedGuidance: value.learningSummary.usedGuidance,
      needsTeacherFollowUp: value.learningSummary.needsTeacherFollowUp,
    };
  } else {
    throw new Error("工作日报学习摘要格式不正确。");
  }

  return {
    id: value.id,
    version: value.version as number,
    status: value.status as StaffDailyStatus,
    date: value.date,
    values: parseValues(value.values),
    sourceCounts,
    learningSummary,
    actions: value.actions as StaffDailyAction[],
  };
}

function parseListing(value: unknown): StaffDailyListing {
  if (
    !isObject(value) ||
    !hasExactKeys(value, ["records", "canCreate"]) ||
    !Array.isArray(value.records) ||
    value.records.length > 200 ||
    typeof value.canCreate !== "boolean"
  )
    throw new Error("工作日报列表格式不正确。");
  return { records: value.records.map(parseRecord), canCreate: value.canCreate };
}

function reportId(value: string): string {
  if (!uuid.test(value)) throw new Error("工作日报编号不正确。");
  return value;
}

function version(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error("工作日报版本不正确。");
  return value;
}

export async function loadStaffDailyReports(get: AuthenticatedGet): Promise<StaffDailyListing> {
  return parseListing(await get("/staff/daily-reports"));
}

export async function createStaffDailyDraft(
  post: AuthenticatedPost,
  date: string,
  values: StaffDailyValues,
): Promise<StaffDailyRecord> {
  if (!validDate(date)) throw new Error("请选择有效的工作日报日期。");
  return parseRecord(await post("/staff/daily-reports", { date, values: validateValues(values) }));
}

export async function editStaffDailyDraft(
  patch: AuthenticatedPatch,
  id: string,
  currentVersion: number,
  values: StaffDailyValues,
): Promise<StaffDailyRecord> {
  return parseRecord(
    await patch(`/staff/daily-reports/${reportId(id)}`, {
      version: version(currentVersion),
      values: validateValues(values),
    }),
  );
}

export async function submitStaffDailyDraft(
  post: AuthenticatedPost,
  id: string,
  currentVersion: number,
): Promise<StaffDailyRecord> {
  return parseRecord(
    await post(`/staff/daily-reports/${reportId(id)}/submit`, { version: version(currentVersion) }),
  );
}

export async function resubmitStaffDailyDraft(
  post: AuthenticatedPost,
  id: string,
  currentVersion: number,
  values: StaffDailyValues,
): Promise<StaffDailyRecord> {
  return parseRecord(
    await post(`/staff/daily-reports/${reportId(id)}/resubmit`, {
      version: version(currentVersion),
      values: validateValues(values),
    }),
  );
}

export function staffDailyValueLabel(key: DailyFieldKey, value: string): string {
  return (
    STAFF_DAILY_FIELDS.find((field) => field.key === key)?.options.find(
      (option) => option.value === value,
    )?.label ?? "未记录"
  );
}
