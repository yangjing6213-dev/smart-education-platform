export type StaffCredentialProfile = "owner-east" | "owner-west" | "owner-other-tenant";
export type CredentialCategory =
  "TEACHING_QUALIFICATION" | "FIRST_AID_TRAINING" | "CHILDCARE_TRAINING";
export type ResponsibleRole = "CAMPUS_OWNER" | "STAFF_MEMBER";
type ExpiryStatus = "VALID" | "EXPIRING_SOON" | "EXPIRED";
type ClientStatus = "IDLE" | "CONNECTING" | "READY" | "DENIED" | "ERROR";

export interface StaffCredentialRow {
  readonly id: string;
  readonly version: number;
  readonly staffId: string;
  readonly staffLabel: string;
  readonly staffRole: string;
  readonly category: CredentialCategory;
  readonly issueDate: string;
  readonly expiryDate: string;
  readonly expiryStatus: ExpiryStatus;
  readonly responsibleRole: ResponsibleRole;
  readonly updatedAt: string;
  readonly history: readonly {
    readonly version: number;
    readonly issueDate: string;
    readonly expiryDate: string;
    readonly responsibleRole: ResponsibleRole;
    readonly updatedAt: string;
  }[];
}

export interface StaffCredentialEmployee {
  readonly actorId: string;
  readonly label: string;
  readonly role: "教师" | "内容编辑";
  readonly status: "ACTIVE" | "SUSPENDED" | "REVOKED";
}

export interface StaffCredentialSnapshot {
  readonly status: ClientStatus;
  readonly message: string;
  readonly profile: StaffCredentialProfile;
  readonly label: string;
  readonly actorId: string;
  readonly tenantId: string;
  readonly campusId: string;
  readonly actions: readonly string[];
  readonly staff: readonly StaffCredentialEmployee[];
  readonly records: readonly StaffCredentialRow[];
}

export interface StaffCredentialDraft {
  readonly staffId: string;
  readonly category: CredentialCategory;
  readonly issueDate: string;
  readonly expiryDate: string;
  readonly responsibleRole: ResponsibleRole;
}

export interface StaffCredentialUpdate {
  readonly issueDate: string;
  readonly expiryDate: string;
  readonly responsibleRole: ResponsibleRole;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const HANDLE = /^[A-Za-z0-9_-]{43}$/u;
const PROFILES: readonly StaffCredentialProfile[] = [
  "owner-east",
  "owner-west",
  "owner-other-tenant",
];
const CATEGORIES: readonly CredentialCategory[] = [
  "TEACHING_QUALIFICATION",
  "FIRST_AID_TRAINING",
  "CHILDCARE_TRAINING",
];
const RESPONSIBLE_ROLES: readonly ResponsibleRole[] = ["CAMPUS_OWNER", "STAFF_MEMBER"];
const EXPIRY_STATUSES: readonly ExpiryStatus[] = ["VALID", "EXPIRING_SOON", "EXPIRED"];
const MEMBERSHIP_STATUSES = ["ACTIVE", "SUSPENDED", "REVOKED"] as const;
export const STAFF_CREDENTIAL_PROFILE_OPTIONS: readonly (readonly [
  StaffCredentialProfile,
  string,
])[] = [
  ["owner-east", "模拟东校区负责人"],
  ["owner-west", "模拟西校区负责人"],
  ["owner-other-tenant", "模拟另一机构负责人"],
];
export const STAFF_CREDENTIAL_CATEGORY_LABELS: Readonly<Record<CredentialCategory, string>> = {
  TEACHING_QUALIFICATION: "教师资格",
  FIRST_AID_TRAINING: "急救培训",
  CHILDCARE_TRAINING: "托育培训",
};
export const STAFF_CREDENTIAL_ROLE_LABELS: Readonly<Record<ResponsibleRole, string>> = {
  CAMPUS_OWNER: "校区负责人",
  STAFF_MEMBER: "员工本人",
};
const EXPECTED_RECORD_KEYS = [
  "category",
  "expiryDate",
  "expiryStatus",
  "history",
  "id",
  "issueDate",
  "responsibleRole",
  "staffId",
  "staffLabel",
  "staffRole",
  "updatedAt",
  "version",
].sort();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}

function isOneOf<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === "string" && values.includes(value as T);
}

export function isStaffCredentialProfile(value: string): value is StaffCredentialProfile {
  return PROFILES.includes(value as StaffCredentialProfile);
}

function validUpdate(value: unknown): value is StaffCredentialUpdate {
  return (
    isRecord(value) &&
    Object.keys(value).sort().join("|") ===
      ["expiryDate", "issueDate", "responsibleRole"].join("|") &&
    isDate(value.issueDate) &&
    isDate(value.expiryDate) &&
    value.expiryDate >= value.issueDate &&
    isOneOf(value.responsibleRole, RESPONSIBLE_ROLES)
  );
}

function parseSession(value: unknown):
  | {
      readonly label: string;
      readonly actorId: string;
      readonly tenantId: string;
      readonly campusId: string;
      readonly actions: readonly string[];
    }
  | undefined {
  if (
    !isRecord(value) ||
    typeof value.label !== "string" ||
    !value.label.startsWith("示例") ||
    typeof value.actorId !== "string" ||
    !UUID.test(value.actorId) ||
    typeof value.tenantId !== "string" ||
    !UUID.test(value.tenantId) ||
    typeof value.campusId !== "string" ||
    !UUID.test(value.campusId) ||
    !Array.isArray(value.actions) ||
    !value.actions.every((item) => typeof item === "string")
  )
    return undefined;
  return {
    label: value.label,
    actorId: value.actorId,
    tenantId: value.tenantId,
    campusId: value.campusId,
    actions: value.actions,
  };
}

function parseStaff(
  value: unknown,
  session: StaffCredentialSnapshot,
): readonly StaffCredentialEmployee[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const result: StaffCredentialEmployee[] = [];
  const seen = new Set<string>();
  for (const row of value) {
    if (
      !isRecord(row) ||
      typeof row.actorId !== "string" ||
      !UUID.test(row.actorId) ||
      seen.has(row.actorId) ||
      !Number.isSafeInteger(row.version) ||
      (row.version as number) < 1 ||
      typeof row.profile !== "string" ||
      typeof row.label !== "string" ||
      !/^(示例|模拟)/u.test(row.label) ||
      (row.role !== "教师" && row.role !== "内容编辑") ||
      row.tenantId !== session.tenantId ||
      row.campusId !== session.campusId ||
      !Array.isArray(row.classIds) ||
      !row.classIds.every((id) => typeof id === "string" && UUID.test(id)) ||
      !isOneOf(row.status, MEMBERSHIP_STATUSES) ||
      !Array.isArray(row.capabilities) ||
      !row.capabilities.every((item) => typeof item === "string")
    )
      return undefined;
    seen.add(row.actorId);
    result.push({ actorId: row.actorId, label: row.label, role: row.role, status: row.status });
  }
  return result;
}

function parseRecord(
  value: unknown,
  staff: readonly StaffCredentialEmployee[],
): StaffCredentialRow | undefined {
  if (
    !isRecord(value) ||
    Object.keys(value).sort().join("|") !== EXPECTED_RECORD_KEYS.join("|") ||
    typeof value.id !== "string" ||
    !UUID.test(value.id) ||
    !Number.isSafeInteger(value.version) ||
    (value.version as number) < 1 ||
    typeof value.staffId !== "string" ||
    !UUID.test(value.staffId) ||
    typeof value.staffLabel !== "string" ||
    !/^(示例|模拟)/u.test(value.staffLabel) ||
    typeof value.staffRole !== "string" ||
    !CATEGORIES.includes(value.category as CredentialCategory) ||
    !isDate(value.issueDate) ||
    !isDate(value.expiryDate) ||
    value.expiryDate < value.issueDate ||
    !isOneOf(value.expiryStatus, EXPIRY_STATUSES) ||
    !isOneOf(value.responsibleRole, RESPONSIBLE_ROLES) ||
    typeof value.updatedAt !== "string" ||
    !Number.isFinite(Date.parse(value.updatedAt)) ||
    !Array.isArray(value.history)
  )
    return undefined;
  const member = staff.find((item) => item.actorId === value.staffId);
  if (!member || member.label !== value.staffLabel || member.role !== value.staffRole)
    return undefined;
  const history = [];
  for (const item of value.history) {
    if (
      !isRecord(item) ||
      !Number.isSafeInteger(item.version) ||
      (item.version as number) < 1 ||
      !isDate(item.issueDate) ||
      !isDate(item.expiryDate) ||
      !isOneOf(item.responsibleRole, RESPONSIBLE_ROLES) ||
      typeof item.updatedAt !== "string" ||
      !Number.isFinite(Date.parse(item.updatedAt))
    )
      return undefined;
    history.push({
      version: item.version as number,
      issueDate: item.issueDate,
      expiryDate: item.expiryDate,
      responsibleRole: item.responsibleRole,
      updatedAt: item.updatedAt,
    });
  }
  return {
    id: value.id,
    version: value.version as number,
    staffId: value.staffId,
    staffLabel: value.staffLabel,
    staffRole: value.staffRole,
    category: value.category as CredentialCategory,
    issueDate: value.issueDate,
    expiryDate: value.expiryDate,
    expiryStatus: value.expiryStatus,
    responsibleRole: value.responsibleRole,
    updatedAt: value.updatedAt,
    history,
  };
}

function parseRecords(
  value: unknown,
  staff: readonly StaffCredentialEmployee[],
): readonly StaffCredentialRow[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const result: StaffCredentialRow[] = [];
  const ids = new Set<string>();
  for (const item of value) {
    const row = parseRecord(item, staff);
    if (!row || ids.has(row.id)) return undefined;
    ids.add(row.id);
    result.push(row);
  }
  return result;
}

function allowed(path: string, method: string): boolean {
  if (path === "/local/sessions") return method === "POST";
  if (["/local/session", "/local/memberships"].includes(path)) return method === "GET";
  if (path === "/local/staff-credentials") return method === "GET" || method === "POST";
  return (
    /^\/local\/staff-credentials\/[0-9a-f-]{36}$/iu.test(path) &&
    UUID.test(path.slice(path.lastIndexOf("/") + 1)) &&
    method === "PATCH"
  );
}

export function createLocalStaffCredentialsTransport(
  servicePort: number | null,
  transport: typeof fetch = fetch.bind(globalThis),
): typeof fetch {
  const origin =
    servicePort === 4317 || servicePort === 4319 ? `http://127.0.0.1:${servicePort}` : null;
  return (input, init) => {
    if (!origin) return Promise.reject(new Error("本机证照服务端口无效。"));
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const target = new URL(raw, origin);
    const method = (
      init?.method ?? (input instanceof Request ? input.method : "GET")
    ).toUpperCase();
    if (
      target.origin !== origin ||
      target.search ||
      target.hash ||
      !allowed(target.pathname, method)
    )
      return Promise.reject(new Error("资格材料只允许访问授权的本机服务。"));
    return transport(target, { ...init, redirect: "error" });
  };
}

export class StaffCredentialsReviewClient {
  readonly #transport: typeof fetch;
  #handle: string | null = null;
  #generation = 0;
  #refreshGeneration = 0;
  #value: StaffCredentialSnapshot = {
    status: "IDLE",
    message: "请选择模拟负责人查看授权校区的资格材料。",
    profile: "owner-east",
    label: "",
    actorId: "",
    tenantId: "",
    campusId: "",
    actions: [],
    staff: [],
    records: [],
  };

  constructor(transport: typeof fetch) {
    this.#transport = transport;
  }

  get snapshot(): StaffCredentialSnapshot {
    return structuredClone(this.#value);
  }

  async connect(profile: StaffCredentialProfile): Promise<void> {
    const generation = ++this.#generation;
    this.#refreshGeneration += 1;
    this.#handle = null;
    this.#value = {
      ...this.#value,
      status: "CONNECTING",
      message: "正在读取本机资格材料…",
      profile,
      label: "",
      actorId: "",
      tenantId: "",
      campusId: "",
      actions: [],
      staff: [],
      records: [],
    };
    try {
      const response = await this.#transport("/local/sessions", {
        method: "POST",
        credentials: "omit",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile }),
      });
      const body = await response.json();
      if (generation !== this.#generation) return;
      if (
        !response.ok ||
        !isRecord(body) ||
        typeof body.handle !== "string" ||
        !HANDLE.test(body.handle)
      ) {
        this.#disconnect("当前负责人身份无法建立有效的本机演示会话。", "DENIED");
        return;
      }
      this.#handle = body.handle;
      const session = parseSession(await this.#request("/local/session", "GET"));
      if (generation !== this.#generation) return;
      if (!session || !session.actions.includes("membership:manage")) {
        this.#disconnect("当前身份没有资格材料管理权限。", "DENIED");
        return;
      }
      this.#value = { ...this.#value, ...session };
      await this.refresh();
    } catch {
      if (generation === this.#generation)
        this.#disconnect("连接失败，资料已清空。请确认本机服务运行后重新连接。", "ERROR");
    }
  }

  async refresh(): Promise<void> {
    const generation = this.#generation;
    const refreshGeneration = ++this.#refreshGeneration;
    if (!this.#handle) return;
    try {
      const [staffValue, recordsValue] = await Promise.all([
        this.#request("/local/memberships", "GET"),
        this.#request("/local/staff-credentials", "GET"),
      ]);
      if (generation !== this.#generation || refreshGeneration !== this.#refreshGeneration) return;
      const staff = parseStaff(staffValue, this.#value);
      const records = staff ? parseRecords(recordsValue, staff) : undefined;
      if (!staff || !records) throw new Error("服务返回的资格资料超出当前负责人范围");
      this.#value = {
        ...this.#value,
        status: "READY",
        message: "资格材料已更新；到期状态只作提醒。",
        staff,
        records,
      };
    } catch {
      if (generation === this.#generation && refreshGeneration === this.#refreshGeneration)
        this.#disconnect("当前身份无法读取本校区资格材料，或本机服务不可用。", "DENIED");
    }
  }

  async create(input: StaffCredentialDraft): Promise<boolean> {
    if (
      this.#value.status !== "READY" ||
      !this.#value.actions.includes("membership:manage") ||
      !isRecord(input) ||
      Object.keys(input).sort().join("|") !==
        ["category", "expiryDate", "issueDate", "responsibleRole", "staffId"].join("|") ||
      !this.#value.staff.some(
        (staff) => staff.actorId === input.staffId && staff.status === "ACTIVE",
      ) ||
      !CATEGORIES.includes(input.category) ||
      !isDate(input.issueDate) ||
      !isDate(input.expiryDate) ||
      input.expiryDate < input.issueDate ||
      !RESPONSIBLE_ROLES.includes(input.responsibleRole)
    )
      return false;
    try {
      const created = await this.#request("/local/staff-credentials", "POST", {
        staffId: input.staffId,
        category: input.category,
        issueDate: input.issueDate,
        expiryDate: input.expiryDate,
        responsibleRole: input.responsibleRole,
      });
      if (!parseRecord(created, this.#value.staff)) throw new Error("服务返回的资格资料无效");
      await this.refresh();
      return this.#value.status === "READY";
    } catch {
      this.#disconnect("资格材料没有保存确认，资料已清空。请重新连接并核对后再操作。", "ERROR");
      return false;
    }
  }

  async update(id: string, version: number, input: StaffCredentialUpdate): Promise<boolean> {
    const row = this.#value.records.find((item) => item.id === id);
    if (
      this.#value.status !== "READY" ||
      !this.#value.actions.includes("membership:manage") ||
      !row ||
      row.version !== version ||
      !UUID.test(id) ||
      !Number.isSafeInteger(version) ||
      version < 1 ||
      !validUpdate(input)
    )
      return false;
    try {
      const updated = await this.#request(`/local/staff-credentials/${id}`, "PATCH", {
        version,
        ...input,
      });
      if (!parseRecord(updated, this.#value.staff)) throw new Error("服务返回的资格资料无效");
      await this.refresh();
      return this.#value.status === "READY";
    } catch {
      this.#disconnect("资格材料没有更新确认，资料已清空。请重新连接并核对后再操作。", "ERROR");
      return false;
    }
  }

  disconnect(): void {
    this.#generation += 1;
    this.#disconnect("资格材料页面已关闭。", "IDLE");
  }

  async #request(path: string, method: string, body?: object): Promise<unknown> {
    const handle = this.#handle;
    const response = await this.#transport(path, {
      method,
      credentials: "omit",
      headers: {
        ...(handle ? { Authorization: `Bearer ${handle}` } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) throw new Error(`本机资格材料服务拒绝请求：${response.status}`);
    return response.json();
  }

  #disconnect(message: string, status: "IDLE" | "DENIED" | "ERROR"): void {
    this.#refreshGeneration += 1;
    this.#handle = null;
    this.#value = {
      ...this.#value,
      status,
      message,
      label: "",
      actorId: "",
      tenantId: "",
      campusId: "",
      actions: [],
      staff: [],
      records: [],
    };
  }
}
