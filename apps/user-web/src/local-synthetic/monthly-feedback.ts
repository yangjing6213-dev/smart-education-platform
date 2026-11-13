import type { MonthlyFeedbackSession, MonthlyFeedbackSnapshot } from "./monthly-feedback-client.js";

export type MonthlyFeedbackStatus =
  "DRAFT" | "SUBMITTED" | "RETURNED" | "CONFIRMED" | "PUBLISHED" | "REVIEW_REQUIRED";
export type MonthlyFeedbackSupplementCode = "KEEP_WATCHING" | "PROGRESSING" | "FOLLOW_UP";
export type MonthlyFeedbackSourceKind = "GROWTH_RECORD" | "ATTENDANCE_OVERVIEW" | "STAFF_DAILY";
export interface MonthlyFeedbackSourceSummary {
  readonly kind: MonthlyFeedbackSourceKind;
  readonly label: string;
  readonly count: number;
  readonly dates: readonly string[];
}
export type MonthlyFeedbackField =
  "learningParticipation" | "dailyHabits" | "activityParticipation" | "familySchoolCollaboration";
export const MONTHLY_FEEDBACK_OPTIONS: Readonly<
  Record<MonthlyFeedbackField, readonly [string, string][]>
> = {
  learningParticipation: [
    ["KEEP_WATCHING", "保持关注"],
    ["PROGRESSING", "已有进步"],
    ["FOLLOW_UP", "需要跟进"],
  ],
  dailyHabits: [
    ["KEEP_WATCHING", "保持关注"],
    ["PROGRESSING", "已有进步"],
    ["FOLLOW_UP", "需要跟进"],
  ],
  activityParticipation: [
    ["KEEP_WATCHING", "保持关注"],
    ["PROGRESSING", "已有进步"],
    ["FOLLOW_UP", "需要跟进"],
  ],
  familySchoolCollaboration: [
    ["KEEP_WATCHING", "保持关注"],
    ["PROGRESSING", "已有进步"],
    ["FOLLOW_UP", "需要跟进"],
  ],
};
const FIELD_LABELS: Record<MonthlyFeedbackField, string> = {
  learningParticipation: "学习参与",
  dailyHabits: "日常习惯",
  activityParticipation: "活动参与",
  familySchoolCollaboration: "家校协作",
};
const SOURCE_LABELS: Readonly<Record<MonthlyFeedbackSourceKind, string>> = {
  GROWTH_RECORD: "已发布成长记录",
  ATTENDANCE_OVERVIEW: "已确认考勤概览",
  STAFF_DAILY: "已确认工作日报",
};
const SOURCE_KINDS = Object.keys(SOURCE_LABELS) as MonthlyFeedbackSourceKind[];
const statuses = new Set<MonthlyFeedbackStatus>([
  "DRAFT",
  "SUBMITTED",
  "RETURNED",
  "CONFIRMED",
  "PUBLISHED",
  "REVIEW_REQUIRED",
]);
const uuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
const text = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= 200;
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const validMonth = (value: unknown): value is string =>
  typeof value === "string" && /^202[6-9]-(?:0[1-9]|1[0-2])$/u.test(value);
function fixedValue(value: unknown): value is MonthlyFeedbackSupplementCode {
  return value === "KEEP_WATCHING" || value === "PROGRESSING" || value === "FOLLOW_UP";
}
function fixedSupplements(
  value: unknown,
): value is Record<MonthlyFeedbackField, MonthlyFeedbackSupplementCode> {
  return (
    object(value) &&
    Object.keys(MONTHLY_FEEDBACK_OPTIONS).length === Object.keys(value).length &&
    (Object.keys(MONTHLY_FEEDBACK_OPTIONS) as MonthlyFeedbackField[]).every((field) =>
      fixedValue(value[field]),
    )
  );
}

export interface MonthlyFeedbackStaffRow {
  readonly kind: "staff";
  readonly id: string;
  readonly version: number;
  readonly status: MonthlyFeedbackStatus;
  readonly tenantId: string;
  readonly campusId: string;
  readonly classId: string;
  readonly month: string;
  readonly sourceSummary: readonly MonthlyFeedbackSourceSummary[];
  readonly supplements: Record<MonthlyFeedbackField, MonthlyFeedbackSupplementCode>;
  readonly createdBy: string;
  readonly authorLabel: string;
  readonly published: boolean;
  readonly synthetic: true;
}
export interface MonthlyFeedbackParentRow {
  readonly kind: "parent";
  readonly id: string;
  readonly version: number;
  readonly month: string;
  readonly status: "PUBLISHED" | "REVIEW_REQUIRED";
  readonly items: readonly { label: string; value: MonthlyFeedbackSupplementCode }[];
  readonly acknowledged: boolean;
  readonly synthetic: true;
}
export type MonthlyFeedbackRow = MonthlyFeedbackStaffRow | MonthlyFeedbackParentRow;

function parseStaff(
  value: unknown,
  session: MonthlyFeedbackSession,
): MonthlyFeedbackStaffRow | undefined {
  if (!object(value)) return undefined;
  const sourceSummary = parseSourceSummary(value.sourceSummary, value.month);
  if (
    value.synthetic !== true ||
    !uuid(value.id) ||
    !Number.isSafeInteger(value.version) ||
    (value.version as number) < 1 ||
    !statuses.has(value.status as MonthlyFeedbackStatus) ||
    !uuid(value.tenantId) ||
    value.tenantId !== session.tenantId ||
    !uuid(value.campusId) ||
    value.campusId !== session.campusId ||
    !uuid(value.classId) ||
    !session.classIds.includes(value.classId) ||
    !validMonth(value.month) ||
    !sourceSummary ||
    "sources" in value ||
    "sourceLabels" in value ||
    !fixedSupplements(value.supplements) ||
    !uuid(value.createdBy) ||
    !text(value.authorLabel) ||
    typeof value.published !== "boolean"
  )
    return undefined;
  return {
    kind: "staff",
    id: value.id,
    version: value.version as number,
    status: value.status as MonthlyFeedbackStatus,
    tenantId: value.tenantId,
    campusId: value.campusId,
    classId: value.classId,
    month: value.month,
    sourceSummary,
    supplements: structuredClone(value.supplements) as Record<
      MonthlyFeedbackField,
      MonthlyFeedbackSupplementCode
    >,
    createdBy: value.createdBy,
    authorLabel: value.authorLabel,
    published: value.published,
    synthetic: true,
  };
}

function parseSourceSummary(
  value: unknown,
  monthValue: unknown,
): MonthlyFeedbackSourceSummary[] | undefined {
  if (!validMonth(monthValue) || !Array.isArray(value) || value.length !== SOURCE_KINDS.length)
    return undefined;
  const parsed = value.map((item) => {
    if (!object(item)) return undefined;
    const kind = item.kind as MonthlyFeedbackSourceKind;
    if (
      Object.keys(item).length !== 4 ||
      Object.keys(item).some((key) => !["kind", "label", "count", "dates"].includes(key)) ||
      !SOURCE_KINDS.includes(kind) ||
      item.label !== SOURCE_LABELS[kind] ||
      !Number.isSafeInteger(item.count) ||
      (item.count as number) < 0 ||
      !Array.isArray(item.dates) ||
      !item.dates.every(
        (date) =>
          typeof date === "string" &&
          /^202[6-9]-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/u.test(date) &&
          date.startsWith(`${monthValue}-`),
      )
    )
      return undefined;
    return {
      kind,
      label: item.label,
      count: item.count as number,
      dates: [...item.dates] as string[],
    };
  });
  if (
    parsed.some((item) => item === undefined) ||
    parsed.some((item, index) => item?.kind !== SOURCE_KINDS[index])
  )
    return undefined;
  return parsed as MonthlyFeedbackSourceSummary[];
}

function parseParent(value: unknown): MonthlyFeedbackParentRow | undefined {
  const allowed = ["acknowledged", "id", "items", "month", "status", "synthetic", "version"];
  if (
    !object(value) ||
    Object.keys(value).length !== allowed.length ||
    Object.keys(value).some((key) => !allowed.includes(key)) ||
    value.synthetic !== true ||
    !uuid(value.id) ||
    !Number.isSafeInteger(value.version) ||
    (value.version as number) < 1 ||
    !validMonth(value.month) ||
    (value.status !== "PUBLISHED" && value.status !== "REVIEW_REQUIRED") ||
    !Array.isArray(value.items) ||
    !value.items.every((item) => object(item) && text(item.label) && fixedValue(item.value)) ||
    typeof value.acknowledged !== "boolean"
  )
    return undefined;
  return {
    kind: "parent",
    id: value.id,
    version: value.version as number,
    month: value.month,
    status: value.status,
    items: structuredClone(value.items) as MonthlyFeedbackParentRow["items"],
    acknowledged: value.acknowledged,
    synthetic: true,
  };
}

export function parseMonthlyFeedbackRows(
  value: unknown,
  session: MonthlyFeedbackSession,
): MonthlyFeedbackStaffRow[] {
  if (!Array.isArray(value)) throw new Error("Invalid monthly feedback collection");
  const rows = value.map((item) => parseStaff(item, session));
  if (rows.some((item) => item === undefined)) throw new Error("Invalid monthly feedback scope");
  return rows as MonthlyFeedbackStaffRow[];
}
export function parseMonthlyFeedbackParentRows(value: unknown): MonthlyFeedbackParentRow[] {
  if (!Array.isArray(value)) throw new Error("Invalid monthly feedback parent collection");
  const rows = value.map(parseParent);
  if (rows.some((item) => item === undefined))
    throw new Error("Invalid monthly feedback parent scope");
  return rows as MonthlyFeedbackParentRow[];
}

const labels: Record<MonthlyFeedbackStatus, string> = {
  DRAFT: "草稿",
  SUBMITTED: "待负责人审核",
  RETURNED: "已退回",
  CONFIRMED: "已确认",
  PUBLISHED: "已发布",
  REVIEW_REQUIRED: "来源变化，需重新审核",
};
const escape = (value: string | number) =>
  String(value).replace(
    /[&<>"']/gu,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!,
  );
function optionMarkup(field: MonthlyFeedbackField, selected?: MonthlyFeedbackSupplementCode) {
  return MONTHLY_FEEDBACK_OPTIONS[field]
    .map(
      ([code, label]) =>
        `<option value="${code}"${code === selected ? " selected" : ""}>${escape(label)}</option>`,
    )
    .join("");
}
function staffCard(row: MonthlyFeedbackStaffRow, session: MonthlyFeedbackSession, busy: boolean) {
  const own = row.createdBy === session.actorId;
  const submit = own && session.actions.includes("feedback:submit") && row.status === "DRAFT";
  const review = !own && session.actions.includes("feedback:review") && row.status === "SUBMITTED";
  const publish =
    !own && session.actions.includes("feedback:publish") && row.status === "CONFIRMED";
  const refresh = !own && session.actions.includes("feedback:review") && row.status === "PUBLISHED";
  const reworkAction =
    own && row.status === "RETURNED" && session.actions.includes("feedback:submit")
      ? "resubmit"
      : own && row.status === "REVIEW_REQUIRED" && session.actions.includes("feedback:create")
        ? "rebuild"
        : undefined;
  const rework = reworkAction
    ? `<form data-monthly-feedback-form="${reworkAction}" data-monthly-feedback-id="${escape(row.id)}" data-monthly-feedback-version="${row.version}"><p class="notice">${reworkAction === "rebuild" ? "旧摘要已暂停展示。保存当前补充项后，请重新提交负责人审核。" : "修改固定补充项后，重新提交负责人审核。"}</p><div class="shared-fields">${(Object.keys(FIELD_LABELS) as MonthlyFeedbackField[]).map((field) => `<label>${escape(FIELD_LABELS[field])}<select name="${field}" required${busy ? " disabled" : ""}>${optionMarkup(field, row.supplements[field])}</select></label>`).join("")}</div><button class="button button-solid" type="submit"${busy ? " disabled" : ""}>${reworkAction === "rebuild" ? "按当前来源重建草稿" : "保存修改并重新提交"}</button></form>`
    : "";
  const sources = row.sourceSummary
    .map(
      (source) =>
        `${escape(source.label)} ${source.count} 条${source.dates.length ? `（${source.dates.map(escape).join("、")}）` : "（暂无）"}`,
    )
    .join("；");
  const values = (Object.keys(FIELD_LABELS) as MonthlyFeedbackField[])
    .map(
      (field) =>
        `<span><strong>${escape(FIELD_LABELS[field])}</strong>${escape(MONTHLY_FEEDBACK_OPTIONS[field].find(([code]) => code === row.supplements[field])?.[1] ?? "")}</span>`,
    )
    .join("");
  const actions = [
    submit
      ? `<button class="button button-solid" type="button" data-monthly-feedback-action="submit" data-monthly-feedback-id="${escape(row.id)}" data-monthly-feedback-version="${row.version}"${busy ? " disabled" : ""}>提交负责人审核</button>`
      : "",
    review
      ? `<button class="button button-solid" type="button" data-monthly-feedback-action="CONFIRM" data-monthly-feedback-id="${escape(row.id)}" data-monthly-feedback-version="${row.version}"${busy ? " disabled" : ""}>确认反馈</button><button class="button button-outline" type="button" data-monthly-feedback-action="RETURN" data-monthly-feedback-id="${escape(row.id)}" data-monthly-feedback-version="${row.version}"${busy ? " disabled" : ""}>退回修改</button>`
      : "",
    publish
      ? `<button class="button button-solid" type="button" data-monthly-feedback-action="publish" data-monthly-feedback-id="${escape(row.id)}" data-monthly-feedback-version="${row.version}"${busy ? " disabled" : ""}>发布家长摘要</button>`
      : "",
    refresh
      ? `<button class="button button-outline" type="button" data-monthly-feedback-action="source-refresh" data-monthly-feedback-id="${escape(row.id)}" data-monthly-feedback-version="${row.version}"${busy ? " disabled" : ""}>检查来源变化</button>`
      : "",
  ].join("");
  return `<article class="field monthly-feedback-row" data-monthly-feedback-row="${escape(row.id)}"><div class="heading-row"><div><h3>${escape(row.month)} 月度反馈</h3><p>${escape(row.authorLabel)} · 版本 ${row.version} · ${escape(labels[row.status])}</p></div><span class="status">${escape(labels[row.status])}</span></div><p class="notice">来源：${sources}</p><div class="monthly-feedback-values">${values}</div>${rework}<div class="actions">${actions}</div></article>`;
}

export function renderMonthlyFeedbackPanel(snapshot: MonthlyFeedbackSnapshot): string {
  const session = snapshot.session;
  if (!session || !session.actions.some((action) => action.startsWith("feedback:"))) return "";
  const busy = snapshot.status === "BUSY" || snapshot.status === "CONNECTING";
  if (session.actions.includes("feedback:ack")) {
    const rows = snapshot.monthlyFeedbackParent ?? [];
    return `<section class="shared-monthly-feedback" data-monthly-feedback-panel><div class="heading-row"><div><p class="section-kicker">家长可见摘要</p><h2>月度成长反馈</h2><p>页面仅显示负责人发布的固定摘要。</p></div><span class="status" data-shared-status>${escape(snapshot.message)}</span><button type="button" data-monthly-feedback-refresh${busy ? " disabled" : ""}>刷新</button></div>${rows.length ? rows.map((row) => `<article class="panel monthly-feedback-parent-row"><div class="heading-row"><h3>${escape(row.month)} 月</h3><span class="status">${escape(labels[row.status])}</span></div>${row.status === "PUBLISHED" ? `<div class="monthly-feedback-values">${row.items.map((item) => `<span><strong>${escape(item.label)}</strong>${escape(MONTHLY_FEEDBACK_OPTIONS.learningParticipation.find(([code]) => code === item.value)?.[1] ?? "")}</span>`).join("")}</div>${row.acknowledged ? '<p class="notice">已确认知悉</p>' : `<button class="button button-solid" type="button" data-monthly-feedback-action="ack" data-monthly-feedback-id="${escape(row.id)}" data-monthly-feedback-version="${row.version}"${busy ? " disabled" : ""}>确认知悉</button>`}` : '<p class="notice">来源发生变化，等待负责人重新审核后再查看。</p>'}</article>`).join("") : '<p class="notice">当前没有已发布的月度反馈。</p>'}</section>`;
  }
  const canCreate = session.actions.includes("feedback:create");
  const form = canCreate
    ? `<form class="panel monthly-feedback-form" data-monthly-feedback-form><h2>填写月度反馈</h2><p class="notice">仅选择固定项；家长只会看到负责人发布后的摘要。</p><label>月份<input name="month" type="month" value="${new Date().toISOString().slice(0, 7)}" required></label><div class="shared-fields">${(Object.keys(FIELD_LABELS) as MonthlyFeedbackField[]).map((field) => `<label>${escape(FIELD_LABELS[field])}<select name="${field}" required>${optionMarkup(field)}</select></label>`).join("")}</div><button class="button button-solid" type="submit"${busy ? " disabled" : ""}>保存反馈草稿</button></form>`
    : "";
  const rows = [...(snapshot.monthlyFeedbackOwned ?? []), ...(snapshot.monthlyFeedbackReview ?? [])]
    .filter((row): row is MonthlyFeedbackStaffRow => row.kind === "staff")
    .filter((row, index, all) => all.findIndex((item) => item.id === row.id) === index);
  return `<section class="shared-monthly-feedback" data-monthly-feedback-panel><div class="heading-row"><div><p class="section-kicker">员工内部流程</p><h2>月度成长反馈</h2><p>当前身份：${escape(session.label)} · 仅限当前机构、校区和班级。</p></div><span class="status" data-shared-status>${escape(snapshot.message)}</span><button type="button" data-monthly-feedback-refresh${busy ? " disabled" : ""}>刷新</button></div>${form}<section class="panel"><h3>反馈记录与审核队列</h3>${rows.length ? rows.map((row) => staffCard(row, session, busy)).join("") : '<p class="notice">当前没有月度反馈记录。</p>'}</section></section>`;
}

export function monthlyFeedbackFormValues(form: HTMLFormElement): Record<string, string> {
  const data = new FormData(form);
  const result: Record<string, string> = {};
  for (const key of [
    "month",
    "learningParticipation",
    "dailyHabits",
    "activityParticipation",
    "familySchoolCollaboration",
  ]) {
    const value = data.get(key);
    if (typeof value === "string") result[key] = value;
  }
  return result;
}
