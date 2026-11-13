export const PLATFORM_OPERATIONS_OPTIONS = {
  status: [
    ["ACTIVE", "已启用"],
    ["SUSPENDED", "已停用"],
  ],
  plan: [
    ["BASIC", "基础版"],
    ["STANDARD", "标准版"],
    ["EXPANDED", "扩展版"],
  ],
  supportStatus: [
    ["OPEN", "待处理"],
    ["IN_PROGRESS", "处理中"],
    ["CLOSED", "已完成"],
  ],
} as const;

export type PlatformTenantStatus = (typeof PLATFORM_OPERATIONS_OPTIONS.status)[number][0];
export type PlatformPlan = (typeof PLATFORM_OPERATIONS_OPTIONS.plan)[number][0];
export type SupportCaseStatus = (typeof PLATFORM_OPERATIONS_OPTIONS.supportStatus)[number][0];

const PLAN_QUOTAS: Record<PlatformPlan, { staffSeatLimit: number; storageLimitGb: number }> = {
  BASIC: { staffSeatLimit: 12, storageLimitGb: 40 },
  STANDARD: { staffSeatLimit: 30, storageLimitGb: 120 },
  EXPANDED: { staffSeatLimit: 60, storageLimitGb: 300 },
};

export const PLATFORM_OPERATION_LABELS = {
  status: Object.fromEntries(PLATFORM_OPERATIONS_OPTIONS.status),
  plan: Object.fromEntries(PLATFORM_OPERATIONS_OPTIONS.plan),
  supportStatus: Object.fromEntries(PLATFORM_OPERATIONS_OPTIONS.supportStatus),
  supportCategory: {
    ACCOUNT_ACCESS: "账号支持",
    QUOTA_CHANGE: "配额咨询",
  },
  priority: { NORMAL: "普通", HIGH: "较高" },
} as const;

export interface TenantHistoryEntry {
  version: number;
  status: PlatformTenantStatus;
  plan: PlatformPlan;
}

export interface SyntheticPlatformTenant {
  id: string;
  alias: string;
  status: PlatformTenantStatus;
  plan: PlatformPlan;
  staffSeatLimit: number;
  storageLimitGb: number;
  version: number;
  history: TenantHistoryEntry[];
}

export interface SupportCaseHistoryEntry {
  version: number;
  status: SupportCaseStatus;
}

export interface SyntheticSupportCase {
  id: string;
  tenantId: string;
  category: "ACCOUNT_ACCESS" | "QUOTA_CHANGE";
  priority: "NORMAL" | "HIGH";
  status: SupportCaseStatus;
  version: number;
  history: SupportCaseHistoryEntry[];
}

export interface PlatformOperationsSnapshot {
  tenants: SyntheticPlatformTenant[];
  supportCases: SyntheticSupportCase[];
  costSummary: {
    periodLabel: string;
    estimatedMonthlyCents: number;
    isSynthetic: true;
  };
  securitySummary: {
    periodLabel: string;
    deniedAccessEvents: number;
    unresolvedWarnings: number;
    isSynthetic: true;
  };
}

export type PlatformOperationError = "INVALID_INPUT" | "NOT_FOUND" | "VERSION_CONFLICT";
export type PlatformOperationResult<T> =
  { ok: true; record: T } | { ok: false; error: PlatformOperationError };

const INITIAL_TENANTS: SyntheticPlatformTenant[] = [
  {
    id: "tenant-synthetic-001",
    alias: "模拟机构一号",
    status: "ACTIVE",
    plan: "STANDARD",
    staffSeatLimit: PLAN_QUOTAS.STANDARD.staffSeatLimit,
    storageLimitGb: PLAN_QUOTAS.STANDARD.storageLimitGb,
    version: 1,
    history: [],
  },
  {
    id: "tenant-synthetic-002",
    alias: "模拟机构二号",
    status: "SUSPENDED",
    plan: "BASIC",
    staffSeatLimit: PLAN_QUOTAS.BASIC.staffSeatLimit,
    storageLimitGb: PLAN_QUOTAS.BASIC.storageLimitGb,
    version: 1,
    history: [],
  },
];

const INITIAL_SUPPORT_CASES: SyntheticSupportCase[] = [
  {
    id: "support-synthetic-001",
    tenantId: "tenant-synthetic-001",
    category: "ACCOUNT_ACCESS",
    priority: "NORMAL",
    status: "OPEN",
    version: 1,
    history: [],
  },
  {
    id: "support-synthetic-002",
    tenantId: "tenant-synthetic-002",
    category: "QUOTA_CHANGE",
    priority: "HIGH",
    status: "IN_PROGRESS",
    version: 1,
    history: [],
  },
];

function clone<T>(value: T): T {
  return structuredClone(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" && value !== null && Object.getPrototypeOf(value) === Object.prototype
  );
}

function hasExactKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  if (!isPlainObject(value)) return false;
  const expected = [...keys].sort();
  const actual = Object.keys(value).sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function includesValue<const T extends readonly (readonly [string, string])[]>(
  options: T,
  value: unknown,
): value is T[number][0] {
  return typeof value === "string" && options.some(([option]) => option === value);
}

function findError<T extends { id: string; version: number }>(
  records: readonly T[],
  id: string,
  expectedVersion: number,
): PlatformOperationError | undefined {
  const record = records.find((item) => item.id === id);
  if (!record) return "NOT_FOUND";
  if (!Number.isSafeInteger(expectedVersion) || record.version !== expectedVersion)
    return "VERSION_CONFLICT";
  return undefined;
}

export function createPlatformOperationsStore() {
  let tenants = clone(INITIAL_TENANTS);
  let supportCases = clone(INITIAL_SUPPORT_CASES);

  return {
    get snapshot(): PlatformOperationsSnapshot {
      return {
        tenants: clone(tenants),
        supportCases: clone(supportCases),
        costSummary: {
          periodLabel: "近 30 天 · 合成汇总",
          estimatedMonthlyCents: 4800,
          isSynthetic: true,
        },
        securitySummary: {
          periodLabel: "近 7 天 · 合成汇总",
          deniedAccessEvents: 3,
          unresolvedWarnings: 1,
          isSynthetic: true,
        },
      };
    },

    updateTenant(
      id: string,
      expectedVersion: number,
      input: unknown,
    ): PlatformOperationResult<SyntheticPlatformTenant> {
      if (
        !hasExactKeys(input, ["status", "plan"]) ||
        !includesValue(PLATFORM_OPERATIONS_OPTIONS.status, input.status) ||
        !includesValue(PLATFORM_OPERATIONS_OPTIONS.plan, input.plan)
      )
        return { ok: false, error: "INVALID_INPUT" };
      const error = findError(tenants, id, expectedVersion);
      if (error) return { ok: false, error };
      const current = tenants.find((tenant) => tenant.id === id);
      if (!current) return { ok: false, error: "NOT_FOUND" };
      const quotas = PLAN_QUOTAS[input.plan];
      const record: SyntheticPlatformTenant = {
        ...current,
        status: input.status,
        plan: input.plan,
        ...quotas,
        version: current.version + 1,
        history: [
          ...current.history,
          { version: current.version, status: current.status, plan: current.plan },
        ],
      };
      tenants = tenants.map((tenant) => (tenant.id === id ? record : tenant));
      return { ok: true, record: clone(record) };
    },

    updateSupportCase(
      id: string,
      expectedVersion: number,
      status: unknown,
    ): PlatformOperationResult<SyntheticSupportCase> {
      if (!includesValue(PLATFORM_OPERATIONS_OPTIONS.supportStatus, status))
        return { ok: false, error: "INVALID_INPUT" };
      const error = findError(supportCases, id, expectedVersion);
      if (error) return { ok: false, error };
      const current = supportCases.find((supportCase) => supportCase.id === id);
      if (!current) return { ok: false, error: "NOT_FOUND" };
      const record: SyntheticSupportCase = {
        ...current,
        status,
        version: current.version + 1,
        history: [...current.history, { version: current.version, status: current.status }],
      };
      supportCases = supportCases.map((supportCase) =>
        supportCase.id === id ? record : supportCase,
      );
      return { ok: true, record: clone(record) };
    },
  };
}
