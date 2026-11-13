export const CARE_RECORD_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "CONFIRMED",
  "RETURNED",
  "CANCELLED",
  "EXCEPTION_PENDING",
] as const;

export type CareRecordStatus = (typeof CARE_RECORD_STATUSES)[number];
export type CareRecordRole =
  "TEACHER" | "CAMPUS_REVIEWER" | "INSTITUTION_REVIEWER" | "PLATFORM_ADMIN" | "GUARDIAN";
export type CareRecordDecision = "CONFIRM" | "RETURN" | "ESCALATE";
export type CareRecordValues = {
  readonly arrival: "ARRIVED_AS_PLANNED" | "LATE" | "ABSENT";
  readonly homework: "COMPLETED" | "IN_PROGRESS" | "NEEDS_SUPPORT";
  readonly meal: "FINISHED" | "PARTIAL" | "NOT_RECORDED";
  readonly rest: "RESTED" | "QUIET_ACTIVITY" | "NOT_RECORDED";
  readonly activity: "PARTICIPATED" | "OBSERVED" | "NOT_RECORDED";
  readonly wellbeing: "ROUTINE" | "CHECK_IN" | "FOLLOW_UP";
};

export const CARE_RECORD_OPTIONS = Object.freeze({
  arrival: [
    { value: "ARRIVED_AS_PLANNED", label: "按计划到校" },
    { value: "LATE", label: "模拟迟到" },
    { value: "ABSENT", label: "模拟未到" },
  ],
  homework: [
    { value: "COMPLETED", label: "已完成整理" },
    { value: "IN_PROGRESS", label: "正在完成" },
    { value: "NEEDS_SUPPORT", label: "需要协助" },
  ],
  meal: [
    { value: "FINISHED", label: "按示例完成用餐" },
    { value: "PARTIAL", label: "模拟部分用餐" },
    { value: "NOT_RECORDED", label: "未记录" },
  ],
  rest: [
    { value: "RESTED", label: "完成模拟休息" },
    { value: "QUIET_ACTIVITY", label: "安静活动" },
    { value: "NOT_RECORDED", label: "未记录" },
  ],
  activity: [
    { value: "PARTICIPATED", label: "参与活动" },
    { value: "OBSERVED", label: "观察活动" },
    { value: "NOT_RECORDED", label: "未记录" },
  ],
  wellbeing: [
    { value: "ROUTINE", label: "日常状态" },
    { value: "CHECK_IN", label: "需要老师留意" },
    { value: "FOLLOW_UP", label: "需要后续跟进" },
  ],
});

const VALUE_LABELS = Object.fromEntries(
  Object.entries(CARE_RECORD_OPTIONS).map(([field, options]) => [
    field,
    Object.fromEntries(options.map((option) => [option.value, option.label])),
  ]),
) as Record<keyof CareRecordValues, Record<string, string>>;
const FIELD_NAMES = ["arrival", "homework", "meal", "rest", "activity", "wellbeing"] as const;
const STATUS_LABELS: Record<CareRecordStatus, string> = {
  DRAFT: "草稿",
  SUBMITTED: "待人工审核",
  CONFIRMED: "已确认",
  RETURNED: "已退回",
  CANCELLED: "已撤回",
  EXCEPTION_PENDING: "待升级复核",
};

export interface CareRecord {
  readonly id: string;
  readonly version: number;
  readonly date: string;
  readonly status: CareRecordStatus;
  readonly values: CareRecordValues;
  readonly tenantId: string;
  readonly campusId: string;
  readonly classId: string;
  readonly studentId: string;
  readonly createdBy: string;
  readonly reviewedBy: string | null;
  readonly published: boolean;
}
interface ParentCareRecordProjection {
  readonly id: string;
  readonly version: number;
  readonly date: string;
  readonly status: "CONFIRMED";
  readonly tenantId: string;
  readonly campusId: string;
  readonly classId: string;
  readonly studentId: string;
  readonly validFrom: string;
  readonly validUntil: string;
  readonly disabled: false;
  readonly confirmation: {
    readonly tenantId: string;
    readonly campusId: string;
    readonly classId: string;
    readonly studentId: string;
    readonly role: "TEACHER";
  };
  readonly arrival: string;
  readonly homework: string;
  readonly meal: string;
  readonly rest: string;
  readonly activity: string;
  readonly health: string;
}
export interface CareRecordContext {
  readonly actorId: string;
  readonly role: CareRecordRole;
  readonly actorStatus: "ACTIVE" | "SUSPENDED" | "REVOKED";
  readonly memberStatus: "ACTIVE" | "MISSING" | "SUSPENDED" | "REVOKED";
  readonly tenantId: string;
  readonly campusId: string;
  readonly authorizedClassIds: readonly string[];
  readonly relation: {
    readonly status: "ACTIVE" | "RELEASED";
    readonly tenantId: string;
    readonly campusId: string;
    readonly classId: string;
    readonly studentId: string;
    readonly guardianId: string;
  } | null;
}
export interface CareRecordEvent {
  readonly action: string;
  readonly actorRole: CareRecordRole;
  readonly recordId: string;
  readonly version: number;
}
export interface CareRecordState {
  readonly records: readonly CareRecord[];
  readonly receipts: readonly {
    readonly recordId: string;
    readonly version: number;
    readonly status: "READ" | "ACKNOWLEDGED";
  }[];
  readonly events: readonly CareRecordEvent[];
  readonly nextSequence: number;
}
export interface CareRecordResult {
  readonly ok: boolean;
  readonly state: CareRecordState;
  readonly record?: CareRecord;
  readonly receipt?: "READ" | "ACKNOWLEDGED";
  readonly message: string;
}

const FIXED_SCOPE = Object.freeze({
  tenantId: "tenant-synthetic-same-core",
  campusId: "campus-synthetic-east",
  classId: "class-synthetic-grade3-a",
  studentId: "student-synthetic-alpha",
  guardianId: "guardian-synthetic-demo",
});

export function createInitialCareRecordState(): CareRecordState {
  return { records: [], receipts: [], events: [], nextSequence: 1 };
}

export function createSyntheticCareRecordContext(
  role: CareRecordRole,
  override: Partial<
    Pick<
      CareRecordContext,
      "tenantId" | "campusId" | "authorizedClassIds" | "actorStatus" | "memberStatus"
    >
  > = {},
): CareRecordContext {
  const tenantId = override.tenantId ?? FIXED_SCOPE.tenantId;
  const campusId = override.campusId ?? FIXED_SCOPE.campusId;
  const classIds = override.authorizedClassIds ?? [FIXED_SCOPE.classId];
  return {
    actorId: `actor-synthetic-${role.toLowerCase()}`,
    role,
    actorStatus: override.actorStatus ?? "ACTIVE",
    memberStatus: override.memberStatus ?? "ACTIVE",
    tenantId,
    campusId,
    authorizedClassIds: classIds,
    relation:
      role === "GUARDIAN"
        ? {
            status: "ACTIVE",
            tenantId,
            campusId,
            classId: FIXED_SCOPE.classId,
            studentId: FIXED_SCOPE.studentId,
            guardianId: FIXED_SCOPE.guardianId,
          }
        : null,
  };
}

function validValues(value: unknown): value is CareRecordValues {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== FIELD_NAMES.length) return false;
  return FIELD_NAMES.every((field) =>
    CARE_RECORD_OPTIONS[field].some((option) => option.value === record[field]),
  );
}

function activeStaff(context: CareRecordContext, allowedRoles: readonly CareRecordRole[]): boolean {
  return (
    context.actorStatus === "ACTIVE" &&
    context.memberStatus === "ACTIVE" &&
    allowedRoles.includes(context.role) &&
    context.tenantId === FIXED_SCOPE.tenantId &&
    context.campusId === FIXED_SCOPE.campusId &&
    context.authorizedClassIds.includes(FIXED_SCOPE.classId)
  );
}

function inScope(record: CareRecord, context: CareRecordContext): boolean {
  return (
    record.tenantId === context.tenantId &&
    record.campusId === context.campusId &&
    context.authorizedClassIds.includes(record.classId)
  );
}

function updateRecord(
  state: CareRecordState,
  context: CareRecordContext,
  record: CareRecord,
  action: string,
  patch: Partial<CareRecord>,
  incrementVersion = true,
): CareRecordResult {
  const updated = {
    ...record,
    ...patch,
    version: incrementVersion ? record.version + 1 : record.version,
  };
  return {
    ok: true,
    state: {
      ...state,
      records: state.records.map((item) => (item.id === record.id ? updated : item)),
      events: [
        ...state.events,
        { action, actorRole: context.role, recordId: record.id, version: updated.version },
      ],
      receipts: updated.published
        ? state.receipts
        : state.receipts.filter((receipt) => receipt.recordId !== record.id),
    },
    record: updated,
    message: "日报模拟状态已在本机更新。",
  };
}

function findCurrent(
  state: CareRecordState,
  context: CareRecordContext,
  id: string,
  version: number,
) {
  const record = state.records.find((item) => item.id === id);
  return record && record.version === version && inScope(record, context) ? record : undefined;
}

export function createCareRecordDraft(
  state: CareRecordState,
  context: CareRecordContext,
  values: unknown,
): CareRecordResult {
  if (!activeStaff(context, ["TEACHER"]) || !validValues(values))
    return { ok: false, state, message: "日报选项或教师范围不可用。" };
  const record: CareRecord = {
    ...FIXED_SCOPE,
    id: `care-synthetic-${state.nextSequence}`,
    version: 1,
    date: "2026-09-30",
    status: "DRAFT",
    values,
    createdBy: context.actorId,
    reviewedBy: null,
    published: false,
  };
  return {
    ok: true,
    state: {
      ...state,
      records: [...state.records, record],
      events: [
        ...state.events,
        {
          action: "CREATE_DRAFT",
          actorRole: context.role,
          recordId: record.id,
          version: record.version,
        },
      ],
      nextSequence: state.nextSequence + 1,
    },
    record,
    message: "合成日报草稿已建立。",
  };
}

export function submitCareRecord(
  state: CareRecordState,
  context: CareRecordContext,
  id: string,
  version: number,
): CareRecordResult {
  if (!activeStaff(context, ["TEACHER"])) return { ok: false, state, message: "教师范围不可用。" };
  const record = findCurrent(state, context, id, version);
  if (!record || record.createdBy !== context.actorId || record.status !== "DRAFT")
    return { ok: false, state, message: "日报草稿、状态或版本已失效。" };
  return updateRecord(state, context, record, "SUBMIT", { status: "SUBMITTED" });
}

export function withdrawCareRecord(
  state: CareRecordState,
  context: CareRecordContext,
  id: string,
  version: number,
): CareRecordResult {
  if (!activeStaff(context, ["TEACHER"])) return { ok: false, state, message: "教师范围不可用。" };
  const record = findCurrent(state, context, id, version);
  if (
    !record ||
    record.createdBy !== context.actorId ||
    !["DRAFT", "SUBMITTED", "RETURNED"].includes(record.status)
  )
    return { ok: false, state, message: "当前日报不可撤回。" };
  return updateRecord(state, context, record, "WITHDRAW", {
    status: "CANCELLED",
    published: false,
  });
}

export function reviewCareRecord(
  state: CareRecordState,
  context: CareRecordContext,
  id: string,
  version: number,
  decision: CareRecordDecision,
): CareRecordResult {
  if (!activeStaff(context, ["CAMPUS_REVIEWER", "INSTITUTION_REVIEWER"]))
    return { ok: false, state, message: "审核范围不可用。" };
  const record = findCurrent(state, context, id, version);
  const canReview =
    record?.status === "SUBMITTED" ||
    (record?.status === "EXCEPTION_PENDING" && context.role === "INSTITUTION_REVIEWER");
  if (!record || !canReview || (decision === "ESCALATE" && context.role !== "INSTITUTION_REVIEWER"))
    return { ok: false, state, message: "审核对象、状态、版本或范围已失效。" };
  const status =
    decision === "CONFIRM" ? "CONFIRMED" : decision === "RETURN" ? "RETURNED" : "EXCEPTION_PENDING";
  return updateRecord(state, context, record, `REVIEW_${decision}`, {
    status,
    reviewedBy: context.actorId,
    published: false,
  });
}

export function resubmitCareRecord(
  state: CareRecordState,
  context: CareRecordContext,
  id: string,
  version: number,
  values: unknown,
): CareRecordResult {
  if (!activeStaff(context, ["TEACHER"]) || !validValues(values))
    return { ok: false, state, message: "日报选项或教师范围不可用。" };
  const record = findCurrent(state, context, id, version);
  if (!record || record.createdBy !== context.actorId || record.status !== "RETURNED")
    return { ok: false, state, message: "退回记录已失效。" };
  return updateRecord(state, context, record, "RESUBMIT", {
    values,
    status: "SUBMITTED",
    reviewedBy: null,
    published: false,
  });
}

export function batchReviewCareRecords(
  state: CareRecordState,
  context: CareRecordContext,
  actions: readonly {
    readonly id: string;
    readonly version: number;
    readonly decision: "CONFIRM" | "RETURN";
  }[],
): CareRecordResult {
  if (!activeStaff(context, ["CAMPUS_REVIEWER", "INSTITUTION_REVIEWER"]) || actions.length === 0)
    return { ok: false, state, message: "批量审核范围或选择不可用。" };
  const ids = new Set(actions.map((action) => action.id));
  const records = actions.map((action) => findCurrent(state, context, action.id, action.version));
  if (ids.size !== actions.length || records.some((record) => record?.status !== "SUBMITTED"))
    return { ok: false, state, message: "整批日报已变化或包含越权记录；本次未修改任何记录。" };
  let next = state;
  for (const action of actions) {
    const result = reviewCareRecord(next, context, action.id, action.version, action.decision);
    next = result.state;
  }
  return { ok: true, state: next, message: "整批日报审核已在本机完成。" };
}

export function publishCareRecord(
  state: CareRecordState,
  context: CareRecordContext,
  id: string,
  version: number,
): CareRecordResult {
  if (!activeStaff(context, ["CAMPUS_REVIEWER", "INSTITUTION_REVIEWER"]))
    return { ok: false, state, message: "发布角色不可用。" };
  const record = findCurrent(state, context, id, version);
  if (!record || record.status !== "CONFIRMED" || record.published)
    return { ok: false, state, message: "日报必须经审核确认后单独发布。" };
  return updateRecord(state, context, record, "PUBLISH", { published: true });
}

export function revokeCareRecordPublication(
  state: CareRecordState,
  context: CareRecordContext,
  id: string,
  version: number,
): CareRecordResult {
  if (!activeStaff(context, ["CAMPUS_REVIEWER", "INSTITUTION_REVIEWER"]))
    return { ok: false, state, message: "撤回角色不可用。" };
  const record = findCurrent(state, context, id, version);
  if (!record || record.status !== "CONFIRMED" || !record.published)
    return { ok: false, state, message: "当前日报没有可撤回的发布。" };
  return updateRecord(state, context, record, "REVOKE_PUBLICATION", { published: false });
}

function canParentRead(record: CareRecord, context: CareRecordContext): boolean {
  const relation = context.relation;
  return (
    context.role === "GUARDIAN" &&
    context.actorStatus === "ACTIVE" &&
    context.memberStatus === "ACTIVE" &&
    relation?.status === "ACTIVE" &&
    relation.tenantId === record.tenantId &&
    relation.campusId === record.campusId &&
    relation.classId === record.classId &&
    relation.studentId === record.studentId &&
    record.status === "CONFIRMED" &&
    record.published
  );
}

export function projectCareRecordsForParent(state: CareRecordState, context: CareRecordContext) {
  const records = state.records
    .filter((record) => canParentRead(record, context))
    .map((record) => ({
      id: record.id,
      version: record.version,
      date: record.date,
      values: Object.fromEntries(
        FIELD_NAMES.map((field) => [field, VALUE_LABELS[field][record.values[field]]]),
      ) as Record<keyof CareRecordValues, string>,
      receipt:
        state.receipts.find(
          (receipt) => receipt.recordId === record.id && receipt.version === record.version,
        )?.status ?? "UNREAD",
    }));
  return { allowed: context.role === "GUARDIAN" && context.relation?.status === "ACTIVE", records };
}

function changeReceipt(
  state: CareRecordState,
  context: CareRecordContext,
  id: string,
  version: number,
  action: "READ" | "ACKNOWLEDGE",
): CareRecordResult {
  const record = state.records.find((item) => item.id === id && item.version === version);
  if (!record || !canParentRead(record, context))
    return { ok: false, state, message: "当前家长范围没有可查看的日报。" };
  const existing = state.receipts.find(
    (receipt) => receipt.recordId === id && receipt.version === version,
  );
  if (
    action === "ACKNOWLEDGE" &&
    existing?.status !== "READ" &&
    existing?.status !== "ACKNOWLEDGED"
  )
    return { ok: false, state, message: "请先打开日报摘要，再单独确认知悉。" };
  const status = action === "READ" ? (existing?.status ?? "READ") : "ACKNOWLEDGED";
  const receipts = existing
    ? state.receipts.map((receipt) =>
        receipt.recordId === id && receipt.version === version ? { ...receipt, status } : receipt,
      )
    : [...state.receipts, { recordId: id, version, status: "READ" as const }];
  return {
    ok: true,
    state: {
      ...state,
      receipts,
      events: [...state.events, { action, actorRole: context.role, recordId: id, version }],
    },
    receipt: status,
    message: action === "READ" ? "日报摘要已在本机打开。" : "已记录本机知悉，不代表真实通知送达。",
  };
}

export function readCareRecord(
  state: CareRecordState,
  context: CareRecordContext,
  id: string,
  version: number,
) {
  return changeReceipt(state, context, id, version, "READ");
}
export function acknowledgeCareRecord(
  state: CareRecordState,
  context: CareRecordContext,
  id: string,
  version: number,
) {
  return changeReceipt(state, context, id, version, "ACKNOWLEDGE");
}

export function toParentUpdatesCareRecords(state: CareRecordState): ParentCareRecordProjection[] {
  return state.records
    .filter((record) => record.status === "CONFIRMED" && record.published)
    .map((record) => ({
      id: record.id,
      version: record.version,
      date: record.date,
      status: "CONFIRMED",
      tenantId: record.tenantId,
      campusId: record.campusId,
      classId: record.classId,
      studentId: record.studentId,
      validFrom: record.date,
      validUntil: record.date,
      disabled: false,
      confirmation: {
        tenantId: record.tenantId,
        campusId: record.campusId,
        classId: record.classId,
        studentId: record.studentId,
        role: "TEACHER",
      },
      arrival: `模拟日报：${VALUE_LABELS.arrival[record.values.arrival]}`,
      homework: `模拟数据：${VALUE_LABELS.homework[record.values.homework]}`,
      meal: `模拟数据：${VALUE_LABELS.meal[record.values.meal]}`,
      rest: `模拟数据：${VALUE_LABELS.rest[record.values.rest]}`,
      activity: `模拟数据：${VALUE_LABELS.activity[record.values.activity]}`,
      health: `模拟数据：${VALUE_LABELS.wellbeing[record.values.wellbeing]}；不含具体健康细节。`,
    }));
}

export function renderParentCareRecordPanel(state: CareRecordState, context: CareRecordContext) {
  const view = projectCareRecordsForParent(state, context);
  if (!view.allowed) {
    return '<section class="contact-intent-state" data-parent-care-records aria-label="成长日报"><h2>成长日报</h2><p role="status">当前模拟关系无权查看成长日报。</p></section>';
  }
  const rows = view.records
    .map((record) => {
      const action =
        record.receipt === "UNREAD"
          ? `<button type="button" data-parent-care-record-action="read" data-parent-care-record-id="${escapeHtml(record.id)}" data-parent-care-record-version="${record.version}">打开成长日报</button>`
          : record.receipt === "READ"
            ? `<button type="button" data-parent-care-record-action="acknowledge" data-parent-care-record-id="${escapeHtml(record.id)}" data-parent-care-record-version="${record.version}">确认本机已知悉</button>`
            : "<p>已在本机确认知悉</p>";
      const summary = FIELD_NAMES.map(
        (field) => `<li>${fieldLabel(field)}：${escapeHtml(record.values[field])}</li>`,
      ).join("");
      return `<article class="field" data-parent-care-record-row><h3>成长日报 · ${escapeHtml(record.date)}</h3><ul>${summary}</ul><p role="status">${record.receipt === "ACKNOWLEDGED" ? "已在本机确认知悉" : record.receipt === "READ" ? "已打开，尚未确认知悉" : "已发布，可查看摘要"}</p>${action}</article>`;
    })
    .join("");
  return `<section class="contact-intent-state" data-parent-care-records aria-labelledby="parent-care-record-heading"><p class="section-kicker">家长服务 · 合成数据</p><h2 id="parent-care-record-heading">成长日报</h2><p>只显示单独发布的固定选项摘要；查看后可单独确认知悉。本机记录不代表真实通知送达。</p>${rows || "<p>当前没有已发布的成长日报。</p>"}</section>`;
}

export function renderSharedParentCareRecordPanel(
  records: readonly {
    readonly id: string;
    readonly version: number;
    readonly date: string;
    readonly studentLabel: string;
    readonly values: Readonly<Record<keyof CareRecordValues, string>>;
    readonly receipt: "UNREAD" | "READ" | "ACKNOWLEDGED";
  }[],
  feedback: string,
  busy = false,
): string {
  const rows = records
    .map((record) => {
      const action =
        record.receipt === "UNREAD"
          ? `<button type="button" data-parent-care-record-action="read" data-parent-care-record-id="${escapeHtml(record.id)}" data-parent-care-record-version="${record.version}"${busy ? " disabled" : ""}>打开成长记录</button>`
          : record.receipt === "READ"
            ? `<button type="button" data-parent-care-record-action="acknowledge" data-parent-care-record-id="${escapeHtml(record.id)}" data-parent-care-record-version="${record.version}"${busy ? " disabled" : ""}>确认知悉</button>`
            : "<p>已确认知悉</p>";
      const summary = FIELD_NAMES.map(
        (field) => `<li>${fieldLabel(field)}：${escapeHtml(record.values[field])}</li>`,
      ).join("");
      return `<article class="field" data-parent-care-record-row><h3>成长记录 · ${escapeHtml(record.date)}</h3><p>${escapeHtml(record.studentLabel)}</p><ul>${summary}</ul><p role="status">${record.receipt === "ACKNOWLEDGED" ? "已确认知悉" : record.receipt === "READ" ? "已打开，等待确认知悉" : "已发布，可查看"}</p>${action}</article>`;
    })
    .join("");
  return `<section class="contact-intent-state" data-parent-care-records aria-labelledby="parent-care-record-heading"><p class="section-kicker">家长服务 · 本机共享记录</p><h2 id="parent-care-record-heading">成长记录</h2><p>仅显示已审核并单独发布给当前合成家长身份的记录。</p><p role="status" aria-live="polite">${escapeHtml(feedback)}</p><button type="button" data-parent-care-record-refresh${busy ? " disabled" : ""}>刷新成长记录</button>${rows || "<p>当前没有已发布的成长记录。</p>"}</section>`;
}

export function renderCareRecordStaffPanel(
  state: CareRecordState,
  role: Exclude<CareRecordRole, "GUARDIAN" | "PLATFORM_ADMIN">,
  values: CareRecordValues,
  feedback: string | null,
  sharedService = false,
): string {
  const roleOptions: readonly { readonly value: typeof role; readonly label: string }[] = [
    { value: "TEACHER", label: "教师填报" },
    { value: "CAMPUS_REVIEWER", label: "校区审核" },
    { value: "INSTITUTION_REVIEWER", label: "机构复核" },
  ];
  const select = (field: keyof CareRecordValues) =>
    `<label>${fieldLabel(field)}<select data-care-record-field="${field}">${CARE_RECORD_OPTIONS[
      field
    ]
      .map(
        (option) =>
          `<option value="${option.value}"${option.value === values[field] ? " selected" : ""}>${option.label}</option>`,
      )
      .join("")}</select></label>`;
  const recordCards = state.records
    .filter((record) => inScope(record, createSyntheticCareRecordContext(role)))
    .map((record) => {
      const actions: string[] = [];
      const button = (action: string, label: string) =>
        `<button type="button" data-care-record-action="${action}" data-care-record-id="${record.id}" data-care-record-version="${record.version}">${label}</button>`;
      if (role === "TEACHER" && record.createdBy === `actor-synthetic-${role.toLowerCase()}`) {
        if (record.status === "DRAFT") actions.push(button("submit", "提交人工审核"));
        if (record.status === "RETURNED") actions.push(button("resubmit", "按固定选项重新提交"));
        if (["DRAFT", "SUBMITTED", "RETURNED"].includes(record.status))
          actions.push(button("withdraw", "撤回模拟日报"));
      } else if (role !== "TEACHER") {
        if (record.status === "SUBMITTED") {
          actions.push(button("review-confirm", "审核确认"));
          actions.push(button("review-return", "退回修改"));
          if (role === "INSTITUTION_REVIEWER") actions.push(button("review-escalate", "升级复核"));
        }
        if (record.status === "EXCEPTION_PENDING" && role === "INSTITUTION_REVIEWER") {
          actions.push(button("review-confirm", "完成机构复核"));
          actions.push(button("review-return", "退回处理"));
        }
        if (record.status === "CONFIRMED")
          actions.push(
            button(
              record.published ? "revoke" : "publish",
              record.published ? "撤回家长发布" : "单独发布给家长",
            ),
          );
      }
      const summary = FIELD_NAMES.map(
        (field) => `<li>${fieldLabel(field)}：${VALUE_LABELS[field][record.values[field]]}</li>`,
      ).join("");
      return `<article class="field" data-care-record-row><h3>模拟日报 ${record.id.slice(-3)} · ${STATUS_LABELS[record.status]}</h3><p>${record.date} · 第 ${record.version} 版</p><ul>${summary}</ul>${record.published ? "<p>已单独发布给家长</p>" : "<p>未发布</p>"}<label><input type="checkbox" data-care-record-batch-id="${record.id}" data-care-record-version="${record.version}"${record.status === "SUBMITTED" && role !== "TEACHER" ? "" : " disabled"}>加入批量审核</label><div class="actions">${actions.join("")}</div></article>`;
    })
    .join("");
  const rolePicker = sharedService
    ? ""
    : `<label>本地演示角色<select data-care-record-role>${roleOptions.map((option) => `<option value="${option.value}"${option.value === role ? " selected" : ""}>${option.label}</option>`).join("")}</select></label>`;
  const createControls =
    role === "TEACHER"
      ? `<div class="field"><h3>填写今日成长记录</h3>${FIELD_NAMES.map(select).join("")}<button type="button" data-care-record-action="create">${sharedService ? "保存草稿" : "建立模拟草稿"}</button></div>`
      : "";
  const batchControls =
    role === "TEACHER"
      ? ""
      : `<div class="actions"><button type="button" data-care-record-action="batch-confirm">批量确认</button><button type="button" data-care-record-action="batch-return">批量退回</button></div>`;
  return `<section class="contact-intent-state" data-care-record-panel aria-labelledby="care-record-heading"><p class="section-kicker">成长记录 · 仅合成数据</p><h2 id="care-record-heading">成长记录填写与审核</h2><p>${sharedService ? "使用当前员工身份填写固定选项；审核由管理端完成，审核通过后仍需单独发布。" : "固定选项，不填写真人资料；审核确认后仍需单独发布。页面刷新后本次数据清空。"}</p>${rolePicker}<p id="care-record-status" role="status" aria-live="polite" tabindex="-1">${escapeHtml(feedback ?? "选择固定选项开始填写成长记录。")}</p>${sharedService ? '<button type="button" data-care-record-refresh>刷新成长记录</button>' : ""}${createControls}<h3>成长记录列表</h3>${recordCards || "<p>当前范围没有成长记录。</p>"}${batchControls}</section>`;
}

function fieldLabel(field: keyof CareRecordValues): string {
  return {
    arrival: "到离状态",
    homework: "作业整理",
    meal: "餐食情况",
    rest: "午休情况",
    activity: "活动参与",
    wellbeing: "一般状态",
  }[field];
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function projectCareRecordAdminView(input: {
  readonly actor: CareRecordContext | null;
  readonly state: CareRecordState;
}) {
  const statuses = CARE_RECORD_STATUSES;
  const emptyCounts = () =>
    Object.fromEntries(statuses.map((status) => [status, 0])) as Record<CareRecordStatus, number>;
  const counts = emptyCounts();
  if (!input.actor || input.actor.actorStatus !== "ACTIVE" || input.actor.memberStatus !== "ACTIVE")
    return { mode: "DENIED" as const, counts, rows: [] };
  if (input.actor.role === "PLATFORM_ADMIN") {
    for (const record of input.state.records) counts[record.status] += 1;
    return { mode: "AGGREGATE_ONLY" as const, counts, rows: [] };
  }
  if (!activeStaff(input.actor, ["CAMPUS_REVIEWER", "INSTITUTION_REVIEWER"]))
    return { mode: "DENIED" as const, counts, rows: [] };
  const rows = input.state.records
    .filter((record) => inScope(record, input.actor!))
    .map((record) => ({
      id: record.id,
      status: record.status,
      statusLabel: STATUS_LABELS[record.status],
    }));
  for (const row of rows) counts[row.status] += 1;
  return { mode: "SCOPED_REVIEW" as const, counts, rows };
}
