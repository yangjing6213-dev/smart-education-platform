import type { AuthenticatedGet, AuthenticatedPost } from "../binding/parent-binding";

export const CARE_RECORD_FIELDS = [
  {
    key: "arrival",
    label: "到离校情况",
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
    key: "meal",
    label: "餐食情况",
    options: [
      { value: "FINISHED", label: "完成用餐" },
      { value: "PARTIAL", label: "部分用餐" },
      { value: "NOT_RECORDED", label: "未记录" },
    ],
  },
  {
    key: "rest",
    label: "午休情况",
    options: [
      { value: "RESTED", label: "完成休息" },
      { value: "QUIET_ACTIVITY", label: "安静活动" },
      { value: "NOT_RECORDED", label: "未记录" },
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
    key: "wellbeing",
    label: "日常状态",
    options: [
      { value: "ROUTINE", label: "日常状态" },
      { value: "CHECK_IN", label: "需要关心" },
      { value: "FOLLOW_UP", label: "需要跟进" },
    ],
  },
] as const;

export type CareRecordValues = {
  readonly arrival: "ARRIVED_AS_PLANNED" | "LATE" | "ABSENT";
  readonly homework: "COMPLETED" | "IN_PROGRESS" | "NEEDS_SUPPORT";
  readonly meal: "FINISHED" | "PARTIAL" | "NOT_RECORDED";
  readonly rest: "RESTED" | "QUIET_ACTIVITY" | "NOT_RECORDED";
  readonly activity: "PARTICIPATED" | "OBSERVED" | "NOT_RECORDED";
  readonly wellbeing: "ROUTINE" | "CHECK_IN" | "FOLLOW_UP";
};

export type CareRecordStudent = {
  readonly id: string;
  readonly student_display_ref: string;
  readonly class_ref: string;
};

export type StaffCareRecord = {
  readonly id: string;
  readonly student_id: string;
  readonly student_display_ref: string;
  readonly class_ref: string;
  readonly service_date: string;
  readonly values: CareRecordValues;
  readonly status:
    "DRAFT" | "SUBMITTED" | "RETURNED" | "CONFIRMED" | "CANCELLED" | "EXCEPTION_PENDING";
  readonly version: number;
  readonly published: boolean;
  readonly publication_version: number;
  readonly updated_at: string;
  readonly actions: readonly (
    "edit" | "submit" | "resubmit" | "review" | "publish" | "withdraw" | "revoke-publication"
  )[];
};

export type ParentCareRecord = {
  readonly id: string;
  readonly studentLabel: string;
  readonly date: string;
  readonly values: CareRecordValues;
  readonly version: number;
  readonly publicationVersion: number;
  readonly receipt: "UNREAD" | "READ" | "ACKNOWLEDGED";
};

export type CareReviewDecision = "confirm" | "return";
export type CareStaffAction =
  "submit" | "resubmit" | "review" | "publish" | "withdraw" | "revoke-publication";
export type CareParentReceiptAction = "read" | "acknowledge";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/u;
const DATE = /^\d{4}-\d{2}-\d{2}$/u;
const STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "RETURNED",
  "CONFIRMED",
  "CANCELLED",
  "EXCEPTION_PENDING",
] as const;
const ACTIONS = [
  "edit",
  "submit",
  "resubmit",
  "review",
  "publish",
  "withdraw",
  "revoke-publication",
] as const;
const VALUE_KEYS = ["arrival", "homework", "meal", "rest", "activity", "wellbeing"] as const;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).sort().join(",") === [...keys].sort().join(",");
}

function isDate(value: unknown): value is string {
  if (typeof value !== "string" || !DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function isTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" && ISO_TIMESTAMP.test(value) && Number.isFinite(Date.parse(value))
  );
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function parseValues(value: unknown): CareRecordValues | null {
  if (!isObject(value) || !hasExactKeys(value, VALUE_KEYS)) return null;
  const valid = CARE_RECORD_FIELDS.every((field) =>
    field.options.some((option) => option.value === value[field.key]),
  );
  if (!valid) return null;
  return {
    arrival: value.arrival as CareRecordValues["arrival"],
    homework: value.homework as CareRecordValues["homework"],
    meal: value.meal as CareRecordValues["meal"],
    rest: value.rest as CareRecordValues["rest"],
    activity: value.activity as CareRecordValues["activity"],
    wellbeing: value.wellbeing as CareRecordValues["wellbeing"],
  };
}

function parseStudent(value: unknown): CareRecordStudent | null {
  if (
    !isObject(value) ||
    !hasExactKeys(value, ["id", "student_display_ref", "class_ref"]) ||
    typeof value.id !== "string" ||
    !UUID.test(value.id) ||
    typeof value.student_display_ref !== "string" ||
    !value.student_display_ref.trim() ||
    value.student_display_ref.length > 80 ||
    typeof value.class_ref !== "string" ||
    !value.class_ref.trim() ||
    value.class_ref.length > 80
  )
    return null;
  return {
    id: value.id,
    student_display_ref: value.student_display_ref.trim(),
    class_ref: value.class_ref.trim(),
  };
}

function parseStaffRecord(value: unknown): StaffCareRecord | null {
  if (
    !isObject(value) ||
    !hasExactKeys(value, [
      "id",
      "student_id",
      "student_display_ref",
      "class_ref",
      "service_date",
      "values",
      "status",
      "version",
      "published",
      "publication_version",
      "updated_at",
      "actions",
    ]) ||
    typeof value.id !== "string" ||
    !UUID.test(value.id) ||
    typeof value.student_id !== "string" ||
    !UUID.test(value.student_id) ||
    typeof value.student_display_ref !== "string" ||
    !value.student_display_ref.trim() ||
    value.student_display_ref.length > 80 ||
    typeof value.class_ref !== "string" ||
    !value.class_ref.trim() ||
    value.class_ref.length > 80 ||
    !isDate(value.service_date) ||
    !STATUSES.includes(value.status as (typeof STATUSES)[number]) ||
    !isPositiveInteger(value.version) ||
    typeof value.published !== "boolean" ||
    !isNonNegativeInteger(value.publication_version) ||
    !isTimestamp(value.updated_at) ||
    !Array.isArray(value.actions) ||
    value.actions.some((action) => !ACTIONS.includes(action as (typeof ACTIONS)[number]))
  )
    return null;
  const values = parseValues(value.values);
  if (!values) return null;
  return {
    id: value.id,
    student_id: value.student_id,
    student_display_ref: value.student_display_ref.trim(),
    class_ref: value.class_ref.trim(),
    service_date: value.service_date,
    values,
    status: value.status as StaffCareRecord["status"],
    version: value.version,
    published: value.published,
    publication_version: value.publication_version,
    updated_at: value.updated_at,
    actions: [...new Set(value.actions as StaffCareRecord["actions"])],
  };
}

function parseParentRecord(value: unknown): ParentCareRecord | null {
  if (
    !isObject(value) ||
    !hasExactKeys(value, [
      "id",
      "student_display_ref",
      "service_date",
      "values",
      "version",
      "publication_version",
      "receipt_status",
    ]) ||
    typeof value.id !== "string" ||
    !UUID.test(value.id) ||
    typeof value.student_display_ref !== "string" ||
    !value.student_display_ref.trim() ||
    value.student_display_ref.length > 80 ||
    !isDate(value.service_date) ||
    !isPositiveInteger(value.version) ||
    !isPositiveInteger(value.publication_version) ||
    !["UNREAD", "READ", "ACKNOWLEDGED"].includes(String(value.receipt_status))
  )
    return null;
  const values = parseValues(value.values);
  if (!values) return null;
  return {
    id: value.id,
    studentLabel: value.student_display_ref.trim(),
    date: value.service_date,
    values,
    version: value.version,
    publicationVersion: value.publication_version,
    receipt: value.receipt_status as ParentCareRecord["receipt"],
  };
}

function sameValues(left: CareRecordValues, right: CareRecordValues): boolean {
  return VALUE_KEYS.every((key) => left[key] === right[key]);
}

function statusCode(error: unknown): number | undefined {
  return isObject(error) && typeof error.statusCode === "number" ? error.statusCode : undefined;
}

function careRecordError(): Error {
  return new Error("成长记录格式暂不可用，请稍后重新读取。");
}

export async function loadStaffCareRecords(
  get: AuthenticatedGet,
  canWriteCareRecords = false,
): Promise<{ readonly records: StaffCareRecord[]; readonly students: CareRecordStudent[] }> {
  const rawRecords = await get("/staff/care-records");
  if (!Array.isArray(rawRecords) || rawRecords.length > 100) throw careRecordError();
  const records = rawRecords.map(parseStaffRecord);
  if (records.some((record) => record === null)) throw careRecordError();
  const validatedRecords = records as StaffCareRecord[];
  if (new Set(validatedRecords.map((record) => record.id)).size !== validatedRecords.length)
    throw careRecordError();
  if (!canWriteCareRecords) return { records: validatedRecords, students: [] };

  let rawStudents: unknown;
  try {
    rawStudents = await get("/staff/care-record-students");
  } catch (error) {
    if (statusCode(error) === 403) return { records: validatedRecords, students: [] };
    throw error;
  }
  if (!Array.isArray(rawStudents) || rawStudents.length > 100) throw careRecordError();
  const students = rawStudents.map(parseStudent);
  if (students.some((student) => student === null)) throw careRecordError();
  const validatedStudents = students as CareRecordStudent[];
  if (new Set(validatedStudents.map((student) => student.id)).size !== validatedStudents.length)
    throw careRecordError();
  return { records: validatedRecords, students: validatedStudents };
}

export async function createStaffCareRecord(
  post: AuthenticatedPost,
  students: readonly CareRecordStudent[],
  studentId: string,
  serviceDate: string,
  values: CareRecordValues,
): Promise<StaffCareRecord> {
  if (!students.some((student) => student.id === studentId))
    throw new Error("只能为当前负责范围内的学生建立记录。");
  const validatedValues = parseValues(values);
  if (!UUID.test(studentId) || !isDate(serviceDate) || !validatedValues)
    throw new Error("请检查成长记录日期和选项。");
  const result = parseStaffRecord(
    await post("/staff/care-records", {
      student_id: studentId,
      service_date: serviceDate,
      values: validatedValues,
    }),
  );
  if (
    !result ||
    result.student_id !== studentId ||
    result.service_date !== serviceDate ||
    !sameValues(result.values, validatedValues) ||
    result.status !== "DRAFT" ||
    result.published ||
    result.actions.includes("submit") === false
  )
    throw careRecordError();
  return result;
}

export async function runStaffCareAction(
  post: AuthenticatedPost,
  targetInput: StaffCareRecord,
  action: CareStaffAction,
  decision?: CareReviewDecision,
  valuesInput?: CareRecordValues,
): Promise<StaffCareRecord> {
  const target = parseStaffRecord(targetInput);
  if (!target || !target.actions.includes(action))
    throw new Error("当前服务未开放这项成长记录操作，请刷新列表后再试。");
  if (action === "review" && decision !== "confirm" && decision !== "return")
    throw new Error("请选择审核结果。");

  const path = `/staff/care-records/${target.id}`;
  let result: StaffCareRecord | null;
  if (action === "submit") {
    result = parseStaffRecord(await post(`${path}/submit`, { version: target.version }));
  } else if (action === "resubmit") {
    const values = parseValues(valuesInput ?? target.values);
    if (!values) throw new Error("请检查成长记录选项。");
    result = parseStaffRecord(await post(`${path}/resubmit`, { version: target.version, values }));
  } else if (action === "review") {
    result = parseStaffRecord(
      await post(`${path}/review`, { version: target.version, action: decision }),
    );
  } else if (action === "publish") {
    result = parseStaffRecord(await post(`${path}/publish`, { version: target.version }));
  } else if (action === "withdraw") {
    result = parseStaffRecord(await post(`${path}/withdraw`, { version: target.version }));
  } else {
    result = parseStaffRecord(
      await post(`${path}/revoke-publication`, { version: target.version }),
    );
  }

  const expectedStatus =
    action === "submit" || action === "resubmit"
      ? "SUBMITTED"
      : action === "review"
        ? decision === "confirm"
          ? "CONFIRMED"
          : "RETURNED"
        : action === "withdraw"
          ? "CANCELLED"
          : "CONFIRMED";
  const isPublish = action === "publish";
  if (
    !result ||
    result.id !== target.id ||
    result.student_id !== target.student_id ||
    result.version !== target.version + 1 ||
    result.status !== expectedStatus ||
    result.published !== (isPublish ? true : false) ||
    result.publication_version !== target.publication_version + (isPublish ? 1 : 0) ||
    (action === "resubmit" &&
      !sameValues(result.values, parseValues(valuesInput ?? target.values)!)) ||
    ((action === "withdraw" || action === "revoke-publication") &&
      !sameValues(result.values, target.values))
  )
    throw careRecordError();
  return result;
}

export async function loadParentCareRecords(get: AuthenticatedGet): Promise<ParentCareRecord[]> {
  const rawRecords = await get("/parent/care-records");
  if (!Array.isArray(rawRecords) || rawRecords.length > 100) throw careRecordError();
  const records = rawRecords.map(parseParentRecord);
  if (records.some((record) => record === null)) throw careRecordError();
  const validated = records as ParentCareRecord[];
  if (new Set(validated.map((record) => record.id)).size !== validated.length)
    throw careRecordError();
  return validated;
}

export async function recordParentCareReceipt(
  post: AuthenticatedPost,
  target: ParentCareRecord,
  action: CareParentReceiptAction,
): Promise<ParentCareRecord> {
  if (action === "acknowledge" && target.receipt !== "READ")
    throw new Error("请先打开并查看成长记录，再确认知悉。");
  if (action === "read" && target.receipt !== "UNREAD")
    throw new Error("这条成长记录已打开，请刷新列表确认状态。");
  if (
    !UUID.test(target.id) ||
    !isPositiveInteger(target.version) ||
    !isPositiveInteger(target.publicationVersion)
  )
    throw careRecordError();

  const result = parseParentRecord(
    await post(`/parent/care-records/${target.id}/receipt`, {
      version: target.version,
      publication_version: target.publicationVersion,
      action,
    }),
  );
  const expectedReceipt = action === "read" ? "READ" : "ACKNOWLEDGED";
  if (
    !result ||
    result.id !== target.id ||
    result.version !== target.version ||
    result.publicationVersion !== target.publicationVersion ||
    result.receipt !== expectedReceipt
  )
    throw careRecordError();
  return result;
}

export function careRecordValueLabel(fieldKey: keyof CareRecordValues, value: string): string {
  const field = CARE_RECORD_FIELDS.find((item) => item.key === fieldKey);
  return field?.options.find((option) => option.value === value)?.label ?? "未记录";
}
