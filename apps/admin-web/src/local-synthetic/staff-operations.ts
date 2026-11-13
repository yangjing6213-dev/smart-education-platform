export const STAFF_OPERATION_OPTIONS = {
  staff: [
    ["synthetic-staff-east-001", "模拟教师一号"],
    ["synthetic-staff-east-002", "模拟教师二号"],
  ],
  materialCategory: [
    ["TRAINING_COMPLETED", "培训参与"],
    ["TASK_COMPLETED", "任务完成"],
    ["SUPPORT_FOLLOW_UP", "支持跟进"],
    ["RECOGNITION", "工作表扬"],
  ],
  materialStatus: [
    ["REVIEWED", "已核对"],
    ["NEEDS_FOLLOW_UP", "需跟进"],
  ],
  performanceArea: [
    ["CLASSROOM_SUPPORT", "课堂支持"],
    ["DAILY_CARE", "日常照护"],
    ["FAMILY_COMMUNICATION", "家校沟通"],
    ["LEARNING_SUPPORT", "学习支持"],
  ],
  performanceOutcome: [
    ["ROUTINE_PROGRESS", "按计划完成"],
    ["SUPPORT_COMPLETED", "已完成人工支持"],
    ["FOLLOW_UP_NEEDED", "需要继续关注"],
  ],
  performanceSupportAction: [
    ["NONE", "暂无额外支持"],
    ["PEER_COACHING", "安排同伴指导"],
    ["WORKFLOW_GUIDANCE", "沟通工作流程"],
    ["RESOURCE_SUPPORT", "提供工作资源"],
  ],
  performanceReviewStatus: [
    ["CONFIRMED", "负责人已确认记录"],
    ["FOLLOW_UP", "需持续跟进"],
  ],
  responsibleRole: [
    ["CAMPUS_OWNER", "校区负责人"],
    ["ADMIN", "行政岗位"],
  ],
  position: [
    ["TEACHER", "教师"],
    ["CARE_ASSISTANT", "托管助教"],
    ["ADMIN", "行政"],
  ],
  source: [
    ["EMPLOYEE_REFERRAL", "员工推荐"],
    ["PUBLIC_INQUIRY", "公开咨询"],
    ["CAREER_EVENT", "招聘活动"],
  ],
  recruitmentStage: [
    ["TO_CONTACT", "待联系"],
    ["CONTACTED", "已沟通"],
    ["INTERVIEW_SCHEDULED", "待面试"],
    ["INTERVIEW_COMPLETED", "面试已完成"],
    ["OFFERED", "已进入录用流程"],
    ["CLOSED", "已结束跟进"],
  ],
} as const;

export type StaffOperationStaffId = (typeof STAFF_OPERATION_OPTIONS.staff)[number][0];
export type WorkMaterialCategory = (typeof STAFF_OPERATION_OPTIONS.materialCategory)[number][0];
export type WorkMaterialStatus =
  "PENDING_REVIEW" | (typeof STAFF_OPERATION_OPTIONS.materialStatus)[number][0];
export type PerformanceArea = (typeof STAFF_OPERATION_OPTIONS.performanceArea)[number][0];
export type PerformanceOutcome = (typeof STAFF_OPERATION_OPTIONS.performanceOutcome)[number][0];
export type PerformanceSupportAction =
  (typeof STAFF_OPERATION_OPTIONS.performanceSupportAction)[number][0];
export type PerformanceReviewStatus =
  "PENDING_REVIEW" | (typeof STAFF_OPERATION_OPTIONS.performanceReviewStatus)[number][0];
export type StaffOperationRole = (typeof STAFF_OPERATION_OPTIONS.responsibleRole)[number][0];
export type RecruitmentPosition = (typeof STAFF_OPERATION_OPTIONS.position)[number][0];
export type RecruitmentSource = (typeof STAFF_OPERATION_OPTIONS.source)[number][0];
export type RecruitmentStage = (typeof STAFF_OPERATION_OPTIONS.recruitmentStage)[number][0];

export const STAFF_OPERATION_LABELS = {
  staff: Object.fromEntries(STAFF_OPERATION_OPTIONS.staff),
  materialCategory: Object.fromEntries(STAFF_OPERATION_OPTIONS.materialCategory),
  materialStatus: {
    PENDING_REVIEW: "待人工核对",
    REVIEWED: "已核对",
    NEEDS_FOLLOW_UP: "需跟进",
  },
  performanceArea: Object.fromEntries(STAFF_OPERATION_OPTIONS.performanceArea),
  performanceOutcome: Object.fromEntries(STAFF_OPERATION_OPTIONS.performanceOutcome),
  performanceSupportAction: Object.fromEntries(STAFF_OPERATION_OPTIONS.performanceSupportAction),
  performanceReviewStatus: {
    PENDING_REVIEW: "待负责人复核",
    CONFIRMED: "负责人已确认记录",
    FOLLOW_UP: "需持续跟进",
  },
  responsibleRole: Object.fromEntries(STAFF_OPERATION_OPTIONS.responsibleRole),
  position: Object.fromEntries(STAFF_OPERATION_OPTIONS.position),
  source: Object.fromEntries(STAFF_OPERATION_OPTIONS.source),
  recruitmentStage: Object.fromEntries(STAFF_OPERATION_OPTIONS.recruitmentStage),
} as const;

export interface WorkMaterialHistoryEntry {
  version: number;
  status: WorkMaterialStatus;
}

export interface StaffWorkMaterial {
  id: string;
  version: number;
  tenantId: string;
  campusId: string;
  staffId: StaffOperationStaffId;
  period: string;
  category: WorkMaterialCategory;
  responsibleRole: StaffOperationRole;
  status: WorkMaterialStatus;
  history: WorkMaterialHistoryEntry[];
}

export interface StaffPerformanceReviewHistoryEntry {
  version: number;
  status: PerformanceReviewStatus;
}

export interface StaffPerformanceReview {
  id: string;
  version: number;
  tenantId: string;
  campusId: string;
  staffId: StaffOperationStaffId;
  period: string;
  area: PerformanceArea;
  outcome: PerformanceOutcome;
  supportAction: PerformanceSupportAction;
  status: PerformanceReviewStatus;
  history: StaffPerformanceReviewHistoryEntry[];
}

export interface RecruitmentHistoryEntry {
  version: number;
  stage: RecruitmentStage;
}

export interface RecruitmentLead {
  id: string;
  version: number;
  tenantId: string;
  campusId: string;
  alias: string;
  position: RecruitmentPosition;
  source: RecruitmentSource;
  responsibleRole: StaffOperationRole;
  stage: RecruitmentStage;
  nextFollowUpDate: string;
  history: RecruitmentHistoryEntry[];
}

export interface StaffOperationsSnapshot {
  workMaterials: StaffWorkMaterial[];
  performanceReviews: StaffPerformanceReview[];
  recruitmentLeads: RecruitmentLead[];
}

export type OperationError = "INVALID_INPUT" | "NOT_FOUND" | "VERSION_CONFLICT";

export type OperationResult<T> = { ok: true; record: T } | { ok: false; error: OperationError };

const STAFF_OPERATIONS_SCOPE = {
  tenantId: "tenant-synthetic-a",
  campusId: "campus-synthetic-east",
} as const;

const INITIAL_WORK_MATERIALS: StaffWorkMaterial[] = [
  {
    id: "work-material-synthetic-001",
    version: 1,
    ...STAFF_OPERATIONS_SCOPE,
    staffId: "synthetic-staff-east-001",
    period: "2026-10",
    category: "TRAINING_COMPLETED",
    responsibleRole: "CAMPUS_OWNER",
    status: "PENDING_REVIEW",
    history: [],
  },
];

const INITIAL_RECRUITMENT_LEADS: RecruitmentLead[] = [
  {
    id: "recruitment-lead-synthetic-001",
    version: 1,
    ...STAFF_OPERATIONS_SCOPE,
    alias: "模拟候选人01",
    position: "TEACHER",
    source: "EMPLOYEE_REFERRAL",
    responsibleRole: "CAMPUS_OWNER",
    stage: "CONTACTED",
    nextFollowUpDate: "2026-10-15",
    history: [],
  },
];

const INITIAL_PERFORMANCE_REVIEWS: StaffPerformanceReview[] = [
  {
    id: "performance-review-synthetic-001",
    version: 1,
    ...STAFF_OPERATIONS_SCOPE,
    staffId: "synthetic-staff-east-001",
    period: "2026-10",
    area: "DAILY_CARE",
    outcome: "ROUTINE_PROGRESS",
    supportAction: "NONE",
    status: "PENDING_REVIEW",
    history: [],
  },
];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" && value !== null && Object.getPrototypeOf(value) === Object.prototype
  );
}

function hasExactKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  if (!isPlainObject(value)) return false;
  const actual = Object.keys(value).sort();
  return (
    actual.length === keys.length && actual.every((key, index) => key === [...keys].sort()[index])
  );
}

function includesValue<const T extends readonly (readonly [string, string])[]>(
  options: T,
  value: unknown,
): value is T[number][0] {
  return typeof value === "string" && options.some(([option]) => option === value);
}

function isValidMonth(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/u.test(value)) return false;
  return true;
}

function isValidDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function invalid<T>(): OperationResult<T> {
  return { ok: false, error: "INVALID_INPUT" };
}

function findError<T extends { id: string; version: number }>(
  records: readonly T[],
  id: string,
  expectedVersion: number,
): OperationError | undefined {
  const record = records.find((item) => item.id === id);
  if (!record) return "NOT_FOUND";
  if (!Number.isSafeInteger(expectedVersion) || record.version !== expectedVersion)
    return "VERSION_CONFLICT";
  return undefined;
}

export function createStaffOperationsStore() {
  let workMaterials = clone(INITIAL_WORK_MATERIALS);
  let performanceReviews = clone(INITIAL_PERFORMANCE_REVIEWS);
  let recruitmentLeads = clone(INITIAL_RECRUITMENT_LEADS);
  let nextMaterialNumber = workMaterials.length + 1;
  let nextPerformanceNumber = performanceReviews.length + 1;
  let nextLeadNumber = recruitmentLeads.length + 1;

  return {
    get snapshot(): StaffOperationsSnapshot {
      return {
        workMaterials: clone(workMaterials),
        performanceReviews: clone(performanceReviews),
        recruitmentLeads: clone(recruitmentLeads),
      };
    },

    createWorkMaterial(input: unknown): OperationResult<StaffWorkMaterial> {
      const keys = ["staffId", "period", "category", "responsibleRole"];
      if (
        !hasExactKeys(input, keys) ||
        !includesValue(STAFF_OPERATION_OPTIONS.staff, input.staffId) ||
        !isValidMonth(input.period) ||
        !includesValue(STAFF_OPERATION_OPTIONS.materialCategory, input.category) ||
        !includesValue(STAFF_OPERATION_OPTIONS.responsibleRole, input.responsibleRole)
      )
        return invalid();

      const record: StaffWorkMaterial = {
        id: `work-material-synthetic-${String(nextMaterialNumber++).padStart(3, "0")}`,
        version: 1,
        ...STAFF_OPERATIONS_SCOPE,
        staffId: input.staffId,
        period: input.period,
        category: input.category,
        responsibleRole: input.responsibleRole,
        status: "PENDING_REVIEW",
        history: [],
      };
      workMaterials = [...workMaterials, record];
      return { ok: true, record: clone(record) };
    },

    reviewWorkMaterial(
      id: string,
      expectedVersion: number,
      status: unknown,
    ): OperationResult<StaffWorkMaterial> {
      if (!includesValue(STAFF_OPERATION_OPTIONS.materialStatus, status)) return invalid();
      const error = findError(workMaterials, id, expectedVersion);
      if (error) return { ok: false, error };
      const current = workMaterials.find((item) => item.id === id);
      if (!current) return { ok: false, error: "NOT_FOUND" };
      const record: StaffWorkMaterial = {
        ...current,
        version: current.version + 1,
        status,
        history: [...current.history, { version: current.version, status: current.status }],
      };
      workMaterials = workMaterials.map((item) => (item.id === id ? record : item));
      return { ok: true, record: clone(record) };
    },

    createPerformanceReview(input: unknown): OperationResult<StaffPerformanceReview> {
      const keys = ["staffId", "period", "area", "outcome", "supportAction"];
      if (
        !hasExactKeys(input, keys) ||
        !includesValue(STAFF_OPERATION_OPTIONS.staff, input.staffId) ||
        !isValidMonth(input.period) ||
        !includesValue(STAFF_OPERATION_OPTIONS.performanceArea, input.area) ||
        !includesValue(STAFF_OPERATION_OPTIONS.performanceOutcome, input.outcome) ||
        !includesValue(STAFF_OPERATION_OPTIONS.performanceSupportAction, input.supportAction)
      )
        return invalid();

      const record: StaffPerformanceReview = {
        id: `performance-review-synthetic-${String(nextPerformanceNumber++).padStart(3, "0")}`,
        version: 1,
        ...STAFF_OPERATIONS_SCOPE,
        staffId: input.staffId,
        period: input.period,
        area: input.area,
        outcome: input.outcome,
        supportAction: input.supportAction,
        status: "PENDING_REVIEW",
        history: [],
      };
      performanceReviews = [...performanceReviews, record];
      return { ok: true, record: clone(record) };
    },

    reviewPerformanceReview(
      id: string,
      expectedVersion: number,
      status: unknown,
    ): OperationResult<StaffPerformanceReview> {
      if (!includesValue(STAFF_OPERATION_OPTIONS.performanceReviewStatus, status)) return invalid();
      const error = findError(performanceReviews, id, expectedVersion);
      if (error) return { ok: false, error };
      const current = performanceReviews.find((item) => item.id === id);
      if (!current) return { ok: false, error: "NOT_FOUND" };
      const record: StaffPerformanceReview = {
        ...current,
        version: current.version + 1,
        status,
        history: [...current.history, { version: current.version, status: current.status }],
      };
      performanceReviews = performanceReviews.map((item) => (item.id === id ? record : item));
      return { ok: true, record: clone(record) };
    },

    createRecruitmentLead(input: unknown): OperationResult<RecruitmentLead> {
      const keys = ["position", "source", "responsibleRole", "nextFollowUpDate"];
      if (
        !hasExactKeys(input, keys) ||
        !includesValue(STAFF_OPERATION_OPTIONS.position, input.position) ||
        !includesValue(STAFF_OPERATION_OPTIONS.source, input.source) ||
        !includesValue(STAFF_OPERATION_OPTIONS.responsibleRole, input.responsibleRole) ||
        !isValidDate(input.nextFollowUpDate)
      )
        return invalid();

      const record: RecruitmentLead = {
        id: `recruitment-lead-synthetic-${String(nextLeadNumber).padStart(3, "0")}`,
        version: 1,
        ...STAFF_OPERATIONS_SCOPE,
        alias: `模拟候选人${String(nextLeadNumber++).padStart(2, "0")}`,
        position: input.position,
        source: input.source,
        responsibleRole: input.responsibleRole,
        stage: "TO_CONTACT",
        nextFollowUpDate: input.nextFollowUpDate,
        history: [],
      };
      recruitmentLeads = [...recruitmentLeads, record];
      return { ok: true, record: clone(record) };
    },

    updateRecruitmentLead(
      id: string,
      expectedVersion: number,
      input: unknown,
    ): OperationResult<RecruitmentLead> {
      const keys = ["stage", "nextFollowUpDate"];
      if (
        !hasExactKeys(input, keys) ||
        !includesValue(STAFF_OPERATION_OPTIONS.recruitmentStage, input.stage) ||
        !isValidDate(input.nextFollowUpDate)
      )
        return invalid();
      const error = findError(recruitmentLeads, id, expectedVersion);
      if (error) return { ok: false, error };
      const current = recruitmentLeads.find((item) => item.id === id);
      if (!current) return { ok: false, error: "NOT_FOUND" };
      const record: RecruitmentLead = {
        ...current,
        version: current.version + 1,
        stage: input.stage,
        nextFollowUpDate: input.nextFollowUpDate,
        history: [...current.history, { version: current.version, stage: current.stage }],
      };
      recruitmentLeads = recruitmentLeads.map((item) => (item.id === id ? record : item));
      return { ok: true, record: clone(record) };
    },
  };
}
