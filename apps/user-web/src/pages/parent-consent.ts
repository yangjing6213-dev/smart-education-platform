export type ConsentPurposeKey = "CARE_RECORD" | "HEALTH_SUPPORT" | "LEARNING_SUPPORT";
export type ParentBindingStatus = "NONE" | "PENDING" | "APPROVED" | "REJECTED" | "ENDED";
export type ParentConsentStatus = "ACTIVE" | "REVOKED";
export type ParentRetentionStatus =
  "WITHIN_PERIOD" | "REVIEW_DUE" | "REQUIRED_HOLD" | "SIMULATED_EXPIRED";
export type ParentPrivacyRequestType = "ACCESS" | "CORRECT" | "COPY" | "DELETE";
export type ParentPrivacyRequestStatus =
  "SUBMITTED" | "IN_REVIEW" | "SIMULATED_COMPLETE" | "WITHDRAWN";

export interface ConsentPolicyView {
  readonly key: ConsentPurposeKey;
  readonly title: string;
  readonly noticeVersion: string;
  readonly necessity: string;
  readonly dataClasses: readonly string[];
  readonly retentionDays: number;
  readonly retentionNotice: string;
}

export interface ParentConsentView {
  readonly id: string;
  readonly bindingId: string;
  readonly version: number;
  readonly purposeKey: ConsentPurposeKey;
  readonly purposeTitle: string;
  readonly noticeVersion: string;
  readonly status: ParentConsentStatus;
  readonly retentionStatus: ParentRetentionStatus;
  readonly retentionDays: number;
  readonly retainUntil: string;
  readonly retentionOutcomeNotice: string | null;
  readonly dataChanged: false;
}

export interface ParentPrivacyRequestView {
  readonly id: string;
  readonly version: number;
  readonly type: ParentPrivacyRequestType;
  readonly status: ParentPrivacyRequestStatus;
  readonly updatedAt: string;
  readonly dataChanged: false;
}

export interface ParentRelationshipView {
  readonly id: string;
  readonly studentId: string;
  readonly sourceApplicationId: string;
  readonly status: "ACTIVE" | "RELEASED";
  readonly version: number;
  readonly approvedAt: string;
}

export interface ParentStudentCandidateView {
  readonly id: string;
  readonly alias: string;
  readonly label: string;
}

export interface ParentConsentSnapshot {
  readonly status: "IDLE" | "CONNECTING" | "READY" | "BUSY" | "ERROR";
  readonly bindingStatus: ParentBindingStatus;
  readonly policies: readonly ConsentPolicyView[];
  readonly consents: readonly ParentConsentView[];
  readonly privacyRequests: readonly ParentPrivacyRequestView[];
  readonly relationship?: ParentRelationshipView | null;
  readonly students?: readonly ParentStudentCandidateView[];
  readonly selectedStudentId?: string | null;
  readonly governanceAvailable?: boolean;
  readonly message: string;
}

export interface ParentConsentClientOptions {
  readonly baseUrl?: string;
  readonly fetcher?: typeof fetch;
}

const API_BASE = "http://127.0.0.1:4317";
const PARENT_PROFILE = "parent-alpha";
const PARENT_STUDENT_ALIAS = "student-alpha";
const SYNTHETIC_STUDENT_ALIASES = ["student-alpha", "student-beta"] as const;
const PURPOSE_KEYS: readonly ConsentPurposeKey[] = [
  "CARE_RECORD",
  "HEALTH_SUPPORT",
  "LEARNING_SUPPORT",
];
const PRIVACY_REQUEST_TYPES: readonly ParentPrivacyRequestType[] = [
  "ACCESS",
  "CORRECT",
  "COPY",
  "DELETE",
];
const PRIVACY_REQUEST_STATUSES: readonly ParentPrivacyRequestStatus[] = [
  "SUBMITTED",
  "IN_REVIEW",
  "SIMULATED_COMPLETE",
  "WITHDRAWN",
];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isPurposeKey = (value: unknown): value is ConsentPurposeKey =>
  typeof value === "string" && PURPOSE_KEYS.includes(value as ConsentPurposeKey);
const isRetentionStatus = (value: unknown): value is ParentRetentionStatus =>
  value === "WITHIN_PERIOD" ||
  value === "REVIEW_DUE" ||
  value === "REQUIRED_HOLD" ||
  value === "SIMULATED_EXPIRED";

class LocalApiError extends Error {
  constructor(
    readonly code: string,
    readonly httpStatus?: number,
  ) {
    super(code);
  }
}

function parseApiError(value: unknown): string {
  return object(value) && object(value.error) && typeof value.error.code === "string"
    ? value.error.code
    : "REQUEST_FAILED";
}

function dateTime(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function onlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function projectPolicies(value: unknown): ConsentPolicyView[] {
  if (!Array.isArray(value)) throw new LocalApiError("INVALID_POLICIES");
  const rows = value.map((row): ConsentPolicyView | null => {
    if (
      !object(row) ||
      !isPurposeKey(row.key) ||
      typeof row.title !== "string" ||
      typeof row.noticeVersion !== "string" ||
      typeof row.necessity !== "string" ||
      !Array.isArray(row.dataClasses) ||
      !row.dataClasses.every((item) => typeof item === "string") ||
      !Number.isSafeInteger(row.retentionDays) ||
      Number(row.retentionDays) < 1 ||
      typeof row.retentionNotice !== "string" ||
      row.impactReviewStatus !== "DEMO_ONLY_PENDING_HUMAN_REVIEW"
    )
      return null;
    return {
      key: row.key,
      title: row.title,
      noticeVersion: row.noticeVersion,
      necessity: row.necessity,
      dataClasses: row.dataClasses as string[],
      retentionDays: Number(row.retentionDays),
      retentionNotice: row.retentionNotice,
    };
  });
  if (
    rows.some((row) => row === null) ||
    rows.length !== PURPOSE_KEYS.length ||
    new Set(rows.map((row) => row?.key)).size !== PURPOSE_KEYS.length
  )
    throw new LocalApiError("INVALID_POLICIES");
  return rows as ConsentPolicyView[];
}

function projectBindings(
  value: unknown,
  selectedAlias = PARENT_STUDENT_ALIAS,
  allowedAliases: readonly string[] = SYNTHETIC_STUDENT_ALIASES,
): {
  status: ParentBindingStatus;
  id: string | null;
} {
  if (!Array.isArray(value)) throw new LocalApiError("INVALID_BINDINGS");
  const validRows = value.every(
    (row) =>
      object(row) &&
      typeof row.id === "string" &&
      UUID.test(row.id) &&
      row.relationship === "GUARDIAN" &&
      typeof row.studentAlias === "string" &&
      allowedAliases.includes(row.studentAlias) &&
      ["PENDING", "APPROVED", "REJECTED", "WITHDRAWN", "RELEASED"].includes(String(row.status)),
  );
  if (!validRows) throw new LocalApiError("INVALID_BINDINGS");
  const rows = (value as Record<string, unknown>[]).filter(
    (row) => row.studentAlias === selectedAlias,
  );
  const latest = rows.reduce<Record<string, unknown> | undefined>((selected, row) => {
    if (!selected) return row;
    const selectedAt =
      typeof selected.submitted_at === "string" ? Date.parse(selected.submitted_at) : Number.NaN;
    const rowAt = typeof row.submitted_at === "string" ? Date.parse(row.submitted_at) : Number.NaN;
    if (Number.isFinite(rowAt) && (!Number.isFinite(selectedAt) || rowAt >= selectedAt)) return row;
    return Number.isFinite(selectedAt) || Number.isFinite(rowAt) ? selected : row;
  }, undefined);
  if (!latest) return { status: "NONE", id: null };
  if (latest.status === "APPROVED") return { status: "APPROVED", id: String(latest.id) };
  if (latest.status === "PENDING") return { status: "PENDING", id: String(latest.id) };
  if (latest.status === "REJECTED") return { status: "REJECTED", id: String(latest.id) };
  if (latest.status === "RELEASED" || latest.status === "WITHDRAWN")
    return { status: "ENDED", id: null };
  return { status: "NONE", id: null };
}

function projectRelationships(value: unknown): ParentRelationshipView[] {
  if (!Array.isArray(value) || value.length > 100) throw new LocalApiError("INVALID_RELATIONSHIPS");
  const rows = value.map((row): ParentRelationshipView | null => {
    if (
      !object(row) ||
      !onlyKeys(row, [
        "id",
        "student_id",
        "relationship",
        "status",
        "source_application_id",
        "version",
        "approved_at",
      ]) ||
      typeof row.id !== "string" ||
      !UUID.test(row.id) ||
      typeof row.student_id !== "string" ||
      !UUID.test(row.student_id) ||
      row.relationship !== "GUARDIAN" ||
      (row.status !== "ACTIVE" && row.status !== "RELEASED") ||
      typeof row.source_application_id !== "string" ||
      !UUID.test(row.source_application_id) ||
      !Number.isSafeInteger(row.version) ||
      Number(row.version) < 1 ||
      !dateTime(row.approved_at)
    )
      return null;
    return {
      id: row.id,
      studentId: row.student_id,
      sourceApplicationId: row.source_application_id,
      status: row.status,
      version: Number(row.version),
      approvedAt: row.approved_at,
    };
  });
  if (rows.some((row) => row === null) || new Set(rows.map((row) => row?.id)).size !== rows.length)
    throw new LocalApiError("INVALID_RELATIONSHIPS");
  return rows as ParentRelationshipView[];
}

function projectStudentCandidates(value: unknown): { id: string; alias: string }[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 20)
    throw new LocalApiError("INVALID_STUDENT_OPTIONS");
  const rows = value.map((row): { id: string; alias: string } | null => {
    if (
      !object(row) ||
      typeof row.id !== "string" ||
      !UUID.test(row.id) ||
      typeof row.alias !== "string" ||
      !SYNTHETIC_STUDENT_ALIASES.includes(row.alias as (typeof SYNTHETIC_STUDENT_ALIASES)[number])
    )
      return null;
    return { id: row.id, alias: row.alias };
  });
  if (rows.some((row) => row === null)) throw new LocalApiError("INVALID_STUDENT_OPTIONS");
  return rows as { id: string; alias: string }[];
}

function projectInviteStudentCandidates(value: unknown): ParentStudentCandidateView[] {
  if (!Array.isArray(value) || value.length > 100)
    throw new LocalApiError("INVALID_STUDENT_OPTIONS");
  const rows = value.map((row): ParentStudentCandidateView => {
    if (
      !object(row) ||
      typeof row.id !== "string" ||
      !UUID.test(row.id) ||
      typeof row.alias !== "string" ||
      (row.alias !== row.id &&
        !SYNTHETIC_STUDENT_ALIASES.includes(
          row.alias as (typeof SYNTHETIC_STUDENT_ALIASES)[number],
        )) ||
      (row.label !== undefined &&
        (typeof row.label !== "string" || !row.label.trim() || row.label.length > 80)) ||
      (row.alias === row.id && row.label === undefined)
    )
      throw new LocalApiError("INVALID_STUDENT_OPTIONS");
    return {
      id: row.id,
      alias: row.alias,
      label:
        typeof row.label === "string"
          ? row.label
          : row.alias === "student-alpha"
            ? "示例学生甲"
            : "示例学生乙",
    };
  });
  if (
    new Set(rows.map((row) => row.id)).size !== rows.length ||
    new Set(rows.map((row) => row.alias)).size !== rows.length
  )
    throw new LocalApiError("INVALID_STUDENT_OPTIONS");
  return rows;
}

function projectBindingApplicationReceipt(
  value: unknown,
  studentCandidateRef: string,
  studentAlias?: string,
): string {
  if (
    object(value) &&
    !object(value.data) &&
    UUID.test(String(value.id)) &&
    value.studentId === studentCandidateRef &&
    (studentAlias === undefined || value.studentAlias === studentAlias) &&
    value.relationship === "GUARDIAN" &&
    value.status === "PENDING" &&
    Number.isSafeInteger(value.version) &&
    Number(value.version) >= 1
  )
    return String(value.id);
  if (
    !object(value) ||
    !object(value.data) ||
    !UUID.test(String(value.request_id)) ||
    !UUID.test(String(value.data.id)) ||
    value.data.student_candidate_ref !== studentCandidateRef ||
    value.data.relationship !== "GUARDIAN" ||
    value.data.status !== "PENDING" ||
    !Number.isSafeInteger(value.data.version) ||
    Number(value.data.version) < 1 ||
    !dateTime(value.data.submitted_at) ||
    value.data.reviewed_at !== null
  )
    throw new LocalApiError("INVALID_BINDING_RECEIPT");
  return String(value.data.id);
}

function projectConsents(value: unknown): ParentConsentView[] {
  if (!Array.isArray(value)) throw new LocalApiError("INVALID_CONSENTS");
  const rows = value.map((row): ParentConsentView | null => {
    if (
      !object(row) ||
      typeof row.id !== "string" ||
      !UUID.test(row.id) ||
      !Number.isSafeInteger(row.version) ||
      Number(row.version) < 1 ||
      !UUID.test(String(row.bindingId)) ||
      !isPurposeKey(row.purposeKey) ||
      typeof row.purposeTitle !== "string" ||
      typeof row.noticeVersion !== "string" ||
      (row.status !== "ACTIVE" && row.status !== "REVOKED") ||
      !isRetentionStatus(row.retentionStatus) ||
      !Number.isSafeInteger(row.retentionDays) ||
      Number(row.retentionDays) < 1 ||
      !dateTime(row.retainUntil) ||
      (row.retentionOutcomeNotice !== null && typeof row.retentionOutcomeNotice !== "string") ||
      row.dataChanged !== false
    )
      return null;
    return {
      id: row.id,
      bindingId: String(row.bindingId),
      version: Number(row.version),
      purposeKey: row.purposeKey,
      purposeTitle: row.purposeTitle,
      noticeVersion: row.noticeVersion,
      status: row.status,
      retentionStatus: row.retentionStatus,
      retentionDays: Number(row.retentionDays),
      retainUntil: row.retainUntil,
      retentionOutcomeNotice: row.retentionOutcomeNotice,
      dataChanged: false,
    };
  });
  if (rows.some((row) => row === null)) throw new LocalApiError("INVALID_CONSENTS");
  return rows as ParentConsentView[];
}

function projectPrivacyRequests(value: unknown): ParentPrivacyRequestView[] {
  if (!Array.isArray(value)) throw new LocalApiError("INVALID_PRIVACY_REQUESTS");
  const rows = value.map((row): ParentPrivacyRequestView | null => {
    if (
      !object(row) ||
      typeof row.id !== "string" ||
      !UUID.test(row.id) ||
      !Number.isSafeInteger(row.version) ||
      Number(row.version) < 1 ||
      !PRIVACY_REQUEST_TYPES.includes(row.type as ParentPrivacyRequestType) ||
      !PRIVACY_REQUEST_STATUSES.includes(row.status as ParentPrivacyRequestStatus) ||
      !dateTime(row.updatedAt) ||
      row.dataChanged !== false
    )
      return null;
    return {
      id: row.id,
      version: Number(row.version),
      type: row.type as ParentPrivacyRequestType,
      status: row.status as ParentPrivacyRequestStatus,
      updatedAt: row.updatedAt,
      dataChanged: false,
    };
  });
  if (rows.some((row) => row === null)) throw new LocalApiError("INVALID_PRIVACY_REQUESTS");
  return rows as ParentPrivacyRequestView[];
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/gu, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character] ?? character;
  });
}

function retentionLabel(status: ParentRetentionStatus): string {
  switch (status) {
    case "WITHIN_PERIOD":
      return "演示期限内";
    case "REVIEW_DUE":
      return "等待负责人复核";
    case "REQUIRED_HOLD":
      return "已标记为演示保留";
    case "SIMULATED_EXPIRED":
      return "已完成到期状态演练";
  }
}

export class ParentConsentClient {
  private readonly fetcher: typeof fetch;
  private readonly baseUrl: string;
  private generation = 0;
  private handle: string | null = null;
  private bindingId: string | null = null;
  private value: ParentConsentSnapshot = {
    status: "IDLE",
    bindingStatus: "NONE",
    policies: [],
    consents: [],
    privacyRequests: [],
    message: "连接本机家长服务后查看固定用途说明。",
  };

  constructor(options: ParentConsentClientOptions = {}) {
    const baseUrl = new URL(options.baseUrl ?? API_BASE);
    if (
      baseUrl.protocol !== "http:" ||
      !["127.0.0.1", "localhost"].includes(baseUrl.hostname) ||
      baseUrl.port === "" ||
      baseUrl.username !== "" ||
      baseUrl.password !== ""
    )
      throw new Error("Only a loopback local service is allowed.");
    this.baseUrl = baseUrl.origin;
    this.fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
  }

  get snapshot(): ParentConsentSnapshot {
    return this.value;
  }

  disconnect(): void {
    this.generation += 1;
    this.handle = null;
    this.bindingId = null;
    this.value = {
      status: "IDLE",
      bindingStatus: "NONE",
      policies: [],
      consents: [],
      privacyRequests: [],
      message: "本机家长服务连接已关闭。",
    };
  }

  async connect(): Promise<void> {
    this.disconnect();
    const generation = this.generation;
    this.value = {
      ...this.value,
      status: "CONNECTING",
      message: "正在连接本机家长服务…",
    };
    try {
      const created = await this.request("/local/sessions", {
        method: "POST",
        body: JSON.stringify({ profile: PARENT_PROFILE }),
      });
      if (
        !object(created) ||
        typeof created.handle !== "string" ||
        !/^[\w-]{43}$/u.test(created.handle)
      )
        throw new LocalApiError("INVALID_SESSION");
      const handle = created.handle;
      const session = await this.request("/local/session", { handle });
      if (
        !object(session) ||
        session.mode !== "local-synthetic" ||
        session.profile !== PARENT_PROFILE ||
        !Array.isArray(session.actions) ||
        !session.actions.includes("binding:apply") ||
        !session.actions.includes("consent:manage") ||
        !session.actions.includes("privacy:request")
      )
        throw new LocalApiError("UNAVAILABLE");
      if (generation !== this.generation) return;
      this.handle = handle;
      await this.load(generation);
    } catch (error) {
      if (generation !== this.generation) return;
      this.handle = null;
      this.value = {
        status: "ERROR",
        bindingStatus: "NONE",
        policies: [],
        consents: [],
        privacyRequests: [],
        message: this.errorMessage(error),
      };
    }
  }

  async refresh(): Promise<void> {
    if (!this.handle || this.value.status !== "READY") return;
    const generation = this.generation;
    this.value = { ...this.value, status: "BUSY", message: "正在更新本机状态…" };
    try {
      await this.load(generation);
    } catch (error) {
      if (generation !== this.generation) return;
      this.value = { ...this.value, status: "ERROR", message: this.errorMessage(error) };
    }
  }

  async applyBinding(): Promise<void> {
    if (
      this.value.status !== "READY" ||
      !this.handle ||
      !["NONE", "REJECTED", "ENDED"].includes(this.value.bindingStatus)
    )
      return;
    const handle = this.handle;
    if (!handle) return;
    const generation = this.generation;
    this.value = { ...this.value, status: "BUSY", message: "正在提交关系申请…" };
    let submittedId: string | null = null;
    try {
      const candidates = projectStudentCandidates(
        await this.request("/local/student-options", { handle }),
      );
      const candidate = candidates.find((row) => row.alias === PARENT_STUDENT_ALIAS);
      if (!candidate) throw new LocalApiError("STUDENT_NOT_AVAILABLE");
      const receipt = await this.request("/local/binding-applications", {
        method: "POST",
        body: JSON.stringify({
          student: candidate.alias,
          relationship: "GUARDIAN",
        }),
        handle,
      });
      submittedId = projectBindingApplicationReceipt(receipt, candidate.id, candidate.alias);
      await this.load(generation, "关系申请已提交；仅更新本机的合成演示关系。");
      if (this.bindingId !== submittedId || this.value.bindingStatus !== "PENDING")
        throw new LocalApiError("BINDING_NOT_READ_BACK");
    } catch (error) {
      if (generation !== this.generation) return;
      this.value = {
        ...this.value,
        status: submittedId ? "ERROR" : "READY",
        message: submittedId
          ? "申请已发送，但尚未从关系记录中核对成功。请刷新状态后再继续。"
          : this.errorMessage(error),
      };
    }
  }

  async grant(key: ConsentPurposeKey, confirmed: boolean): Promise<void> {
    if (
      !confirmed ||
      this.value.status !== "READY" ||
      this.value.bindingStatus !== "APPROVED" ||
      !this.bindingId ||
      !this.handle
    )
      return;
    const policy = this.value.policies.find((row) => row.key === key);
    if (
      !policy ||
      this.value.consents.some((row) => row.purposeKey === key && row.status === "ACTIVE")
    )
      return;
    await this.mutate(
      "/local/consents",
      {
        method: "POST",
        body: JSON.stringify({
          bindingId: this.bindingId,
          purposeKey: policy.key,
          noticeVersion: policy.noticeVersion,
          confirmed: true,
        }),
      },
      "consent",
    );
  }

  async revoke(index: number, confirmed: boolean): Promise<void> {
    if (!confirmed || this.value.status !== "READY" || !this.handle) return;
    const row = this.value.consents[index];
    if (!row || row.status !== "ACTIVE") return;
    await this.mutate(
      `/local/consents/${row.id}/revoke`,
      {
        method: "POST",
        body: JSON.stringify({ version: row.version }),
      },
      "consent",
    );
  }

  async submitPrivacyRequest(type: ParentPrivacyRequestType): Promise<void> {
    if (
      this.value.status !== "READY" ||
      this.value.bindingStatus !== "APPROVED" ||
      !this.bindingId ||
      !this.handle ||
      !PRIVACY_REQUEST_TYPES.includes(type) ||
      this.value.privacyRequests.some(
        (row) =>
          row.type === type && row.status !== "SIMULATED_COMPLETE" && row.status !== "WITHDRAWN",
      )
    )
      return;
    await this.mutatePrivacyRequest(
      `/local/privacy-requests`,
      {
        method: "POST",
        body: JSON.stringify({ bindingId: this.bindingId, type }),
      },
      "SUBMITTED",
      "申请已提交至本机审核队列；没有读取或改变真实资料。dataChanged=false。",
    );
  }

  async withdrawPrivacyRequest(index: number): Promise<void> {
    if (this.value.status !== "READY" || !this.handle) return;
    const row = this.value.privacyRequests[index];
    if (!row || (row.status !== "SUBMITTED" && row.status !== "IN_REVIEW")) return;
    await this.mutatePrivacyRequest(
      `/local/privacy-requests/${row.id}/withdraw`,
      {
        method: "POST",
        body: JSON.stringify({ version: row.version }),
      },
      "WITHDRAWN",
      "申请已撤回；本机没有访问或改变真实资料。dataChanged=false。",
    );
  }

  private async mutatePrivacyRequest(
    path: string,
    init: RequestInit,
    expectedStatus: ParentPrivacyRequestStatus,
    message: string,
  ): Promise<void> {
    if (!this.handle) return;
    const generation = this.generation;
    this.value = { ...this.value, status: "BUSY", message: "正在更新本机申请状态…" };
    try {
      const receipt = await this.request(path, { ...init, handle: this.handle });
      const projected = projectPrivacyRequests([receipt])[0];
      if (!projected || projected.status !== expectedStatus)
        throw new LocalApiError("INVALID_RECEIPT");
      await this.load(generation, message);
    } catch (error) {
      if (generation !== this.generation) return;
      this.value = { ...this.value, status: "READY", message: this.errorMessage(error) };
    }
  }

  private async mutate(
    path: string,
    init: RequestInit,
    receiptKind: "binding" | "consent",
  ): Promise<void> {
    if (!this.handle) return;
    const generation = this.generation;
    this.value = { ...this.value, status: "BUSY", message: "正在更新本机演示状态…" };
    try {
      const receipt = await this.request(path, { ...init, handle: this.handle });
      const validReceipt =
        object(receipt) &&
        (receiptKind === "consent"
          ? receipt.dataChanged === false
          : receipt.status === "PENDING" &&
            receipt.relationship === "GUARDIAN" &&
            receipt.studentAlias === PARENT_STUDENT_ALIAS);
      if (!validReceipt) throw new LocalApiError("INVALID_RECEIPT");
      await this.load(
        generation,
        receiptKind === "consent"
          ? "本机演示状态已更新；没有访问、删除或改变真实数据。dataChanged=false。"
          : "关系申请已提交；仅更新本机的合成演示关系。",
      );
    } catch (error) {
      if (generation !== this.generation) return;
      this.value = { ...this.value, status: "READY", message: this.errorMessage(error) };
    }
  }

  private async load(
    generation: number,
    message = "仅显示当前模拟关系和本机演示记录。",
  ): Promise<void> {
    const handle = this.handle;
    if (!handle) throw new LocalApiError("UNAVAILABLE");
    const [bindingValue, policyValue, consentValue] = await Promise.all([
      this.request("/local/binding-applications", { handle }),
      this.request("/local/consent-policies", { handle }),
      this.request("/local/consents", { handle }),
    ]);
    const binding = projectBindings(bindingValue);
    const policies = projectPolicies(policyValue);
    const consents = projectConsents(consentValue).filter((row) => row.bindingId === binding.id);
    const privacyRequestValue =
      binding.status === "APPROVED"
        ? await this.request("/local/privacy-requests", { handle })
        : [];
    const privacyRequests = projectPrivacyRequests(privacyRequestValue);
    if (generation !== this.generation) return;
    this.bindingId = binding.id;
    this.value = {
      status: "READY",
      bindingStatus: binding.status,
      policies,
      consents,
      privacyRequests,
      message,
    };
  }

  private async request(
    path: string,
    options: RequestInit & { handle?: string },
  ): Promise<unknown> {
    const { handle, ...init } = options;
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    if (init.body !== undefined) headers.set("Content-Type", "application/json");
    if (handle) headers.set("Authorization", `Bearer ${handle}`);
    const response = await this.fetcher(new URL(path, this.baseUrl), {
      ...init,
      cache: "no-store",
      redirect: "error",
      headers,
    });
    let value: unknown;
    try {
      value = await response.json();
    } catch {
      throw new LocalApiError("INVALID_RESPONSE");
    }
    if (!response.ok) throw new LocalApiError(parseApiError(value));
    return value;
  }

  private errorMessage(error: unknown): string {
    if (error instanceof LocalApiError) {
      if (error.code === "STATE_CONFLICT") return "记录状态已变化，请刷新后再试。";
      if (error.code === "UNAVAILABLE") return "当前模拟身份暂不能处理此事项。";
    }
    return "暂时无法连接本机服务，请确认本机演示服务已启动后重试。";
  }
}

export class ParentInviteConsentClient {
  private readonly fetcher: typeof fetch;
  private readonly baseUrl: string;
  private generation = 0;
  private bindingId: string | null = null;
  private value: ParentConsentSnapshot = {
    status: "IDLE",
    bindingStatus: "NONE",
    policies: [],
    consents: [],
    privacyRequests: [],
    relationship: null,
    message: "使用受邀家长账号登录后查看关系与授权。",
  };

  constructor(options: { readonly baseUrl: string; readonly fetcher?: typeof fetch }) {
    const baseUrl = new URL(options.baseUrl);
    const loopback =
      baseUrl.protocol === "http:" &&
      ["127.0.0.1", "localhost"].includes(baseUrl.hostname) &&
      baseUrl.port !== "";
    if (
      (!loopback && baseUrl.protocol !== "https:") ||
      baseUrl.username !== "" ||
      baseUrl.password !== "" ||
      baseUrl.pathname !== "/" ||
      baseUrl.search !== "" ||
      baseUrl.hash !== ""
    )
      throw new Error("Invite requests require a safe same-origin web address.");
    this.baseUrl = baseUrl.origin;
    this.fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
  }

  get snapshot(): ParentConsentSnapshot {
    return this.value;
  }

  disconnect(): void {
    this.generation += 1;
    this.bindingId = null;
    this.candidates = [];
    this.selectedStudentId = null;
    this.value = {
      status: "IDLE",
      bindingStatus: "NONE",
      policies: [],
      consents: [],
      privacyRequests: [],
      relationship: null,
      message: "关系服务已断开。",
    };
  }

  async connect(): Promise<void> {
    this.disconnect();
    const generation = this.generation;
    this.value = { ...this.value, status: "CONNECTING", message: "正在核对受邀账号…" };
    try {
      const identity = this.dataOf(await this.request("/api-local/me"));
      if (!this.hasParentAccess(identity)) throw new LocalApiError("UNAVAILABLE");
      await this.load(generation);
    } catch (error) {
      if (generation !== this.generation) return;
      this.value = {
        status: "ERROR",
        bindingStatus: "NONE",
        policies: [],
        consents: [],
        privacyRequests: [],
        message: this.errorMessage(error),
      };
    }
  }

  async refresh(): Promise<void> {
    if (this.value.status !== "READY") return;
    const generation = this.generation;
    this.value = { ...this.value, status: "BUSY", message: "正在更新关系和授权状态…" };
    try {
      await this.load(generation);
    } catch (error) {
      if (generation === this.generation)
        this.value = { ...this.value, status: "ERROR", message: this.errorMessage(error) };
    }
  }

  async applyBinding(): Promise<void> {
    if (
      this.value.status !== "READY" ||
      !["NONE", "REJECTED", "ENDED"].includes(this.value.bindingStatus)
    )
      return;
    const candidate = this.candidates.find((row) => row.id === this.selectedStudentId);
    if (!candidate) {
      this.value = { ...this.value, message: "请先选择当前账号可申请的学生。" };
      return;
    }
    const generation = this.generation;
    this.value = { ...this.value, status: "BUSY", message: "正在提交关系申请…" };
    let submittedId: string | null = null;
    try {
      const receipt = await this.request("/api-local/guardian-binding/applications", {
        method: "POST",
        body: JSON.stringify({
          student_candidate_ref: candidate.id,
          relationship: "GUARDIAN",
          consent: true,
        }),
      });
      submittedId = projectBindingApplicationReceipt(receipt, candidate.id);
      await this.load(generation, "关系申请已提交，请等待员工审核。");
      if (this.bindingId !== submittedId || this.value.bindingStatus !== "PENDING")
        throw new LocalApiError("BINDING_NOT_READ_BACK");
    } catch (error) {
      if (generation !== this.generation) return;
      this.value = {
        ...this.value,
        status: submittedId ? "ERROR" : "READY",
        message: submittedId
          ? "申请已提交，但暂未核对到最新状态。请刷新后重试。"
          : this.errorMessage(error),
      };
    }
  }

  async releaseRelationship(confirmed: boolean): Promise<void> {
    const relationship = this.value.relationship;
    if (
      !confirmed ||
      this.value.status !== "READY" ||
      this.value.bindingStatus !== "APPROVED" ||
      relationship?.status !== "ACTIVE"
    )
      return;
    const generation = this.generation;
    this.value = { ...this.value, status: "BUSY", message: "正在解除本机合成监护关系…" };
    try {
      const receipt = projectRelationships([
        this.dataOf(
          await this.request(`/api-local/guardian-relationships/${relationship.id}/release`, {
            method: "POST",
            body: JSON.stringify({ version: relationship.version }),
          }),
        ),
      ])[0];
      if (
        !receipt ||
        receipt.id !== relationship.id ||
        receipt.status !== "RELEASED" ||
        receipt.version !== relationship.version + 1
      )
        throw new LocalApiError("INVALID_RELEASE_RECEIPT");
      await this.load(generation, "关系已解除，并已核对服务端的最新状态。");
      if (generation === this.generation && this.value.relationship?.status !== "RELEASED")
        throw new LocalApiError("RELEASE_NOT_READ_BACK");
    } catch (error) {
      if (generation === this.generation)
        this.value = { ...this.value, status: "READY", message: this.errorMessage(error) };
    }
  }

  async grant(key: ConsentPurposeKey, confirmed: boolean): Promise<void> {
    if (!confirmed || this.value.status !== "READY" || this.value.bindingStatus !== "APPROVED")
      return;
    const policy = this.value.policies.find((row) => row.key === key);
    if (
      !policy ||
      this.value.consents.some((row) => row.purposeKey === key && row.status === "ACTIVE") ||
      !this.bindingId
    )
      return;
    await this.mutateConsent(
      "/api-local/consents",
      {
        method: "POST",
        body: JSON.stringify({
          bindingId: this.bindingId,
          purposeKey: policy.key,
          noticeVersion: policy.noticeVersion,
          confirmed: true,
        }),
      },
      "本机授权状态已更新；没有读取或改变真实资料。dataChanged=false。",
    );
  }

  async revoke(index: number, confirmed: boolean): Promise<void> {
    if (!confirmed || this.value.status !== "READY") return;
    const row = this.value.consents[index];
    if (!row || row.status !== "ACTIVE") return;
    await this.mutateConsent(
      `/api-local/consents/${row.id}/revoke`,
      { method: "POST", body: JSON.stringify({ version: row.version }) },
      "授权已撤回；本机没有访问或改变真实资料。dataChanged=false。",
    );
  }

  async submitPrivacyRequest(type: ParentPrivacyRequestType): Promise<void> {
    if (
      this.value.status !== "READY" ||
      this.value.bindingStatus !== "APPROVED" ||
      !this.bindingId ||
      !this.value.governanceAvailable ||
      !PRIVACY_REQUEST_TYPES.includes(type) ||
      this.value.privacyRequests.some(
        (row) =>
          row.type === type && row.status !== "SIMULATED_COMPLETE" && row.status !== "WITHDRAWN",
      )
    )
      return;
    await this.mutatePrivacyRequest(
      "/api-local/privacy-requests",
      { method: "POST", body: JSON.stringify({ bindingId: this.bindingId, type }) },
      "SUBMITTED",
      "申请已提交至本机审核队列；没有读取或改变真实资料。dataChanged=false。",
    );
  }

  async withdrawPrivacyRequest(index: number): Promise<void> {
    if (this.value.status !== "READY") return;
    const row = this.value.privacyRequests[index];
    if (!row || (row.status !== "SUBMITTED" && row.status !== "IN_REVIEW")) return;
    await this.mutatePrivacyRequest(
      `/api-local/privacy-requests/${row.id}/withdraw`,
      { method: "POST", body: JSON.stringify({ version: row.version }) },
      "WITHDRAWN",
      "申请已撤回；本机没有访问或改变真实资料。dataChanged=false。",
    );
  }

  private candidates: ParentStudentCandidateView[] = [];
  private selectedStudentId: string | null = null;

  async selectStudent(id: string): Promise<void> {
    if (this.value.status !== "READY") return;
    this.selectedStudentId = this.candidates.some((row) => row.id === id) ? id : null;
    this.bindingId = null;
    this.value = {
      ...this.value,
      selectedStudentId: this.selectedStudentId,
      bindingStatus: "NONE",
      relationship: null,
      consents: [],
      privacyRequests: [],
    };
    await this.refresh();
  }

  private hasParentAccess(value: unknown): boolean {
    if (!object(value) || !Array.isArray(value.memberships)) return false;
    const required = ["binding:apply", "binding:read"];
    return value.memberships.some((membership: unknown) => {
      if (!object(membership) || membership.status !== "ACTIVE") return false;
      const capabilities = membership.capabilities;
      return (
        Array.isArray(capabilities) &&
        required.every((capability) => capabilities.includes(capability))
      );
    });
  }

  private dataOf(value: unknown): unknown {
    return object(value) && "data" in value ? value.data : value;
  }

  private async load(
    generation: number,
    message = "已显示当前受邀账号可见的合成关系和记录。",
  ): Promise<void> {
    const [bindingValue, studentValue, policyValue, relationshipValue] = await Promise.all([
      this.request("/api-local/guardian-binding/applications"),
      this.request("/api-local/parent/student-options"),
      this.request("/api-local/consent-policies").catch((error: unknown) => {
        if (error instanceof LocalApiError && error.httpStatus === 404) return null;
        throw error;
      }),
      this.request("/api-local/guardian-relationships"),
    ]);
    const candidates = projectInviteStudentCandidates(this.dataOf(studentValue));
    const selectedStudentId = candidates.some((row) => row.id === this.selectedStudentId)
      ? this.selectedStudentId
      : candidates.length === 1
        ? candidates[0]!.id
        : null;
    const parentCandidate = candidates.find((row) => row.id === selectedStudentId);
    const rows = this.dataOf(bindingValue);
    const normalizedBindings = Array.isArray(rows)
      ? rows.map((row) => {
          if (!object(row) || typeof row.student_candidate_ref !== "string") return row;
          const candidate = candidates.find((item) => item.id === row.student_candidate_ref);
          return { ...row, studentAlias: candidate?.alias ?? "" };
        })
      : rows;
    const application = projectBindings(
      normalizedBindings,
      parentCandidate?.alias ?? "",
      candidates.map((row) => row.alias),
    );
    const relationships = projectRelationships(this.dataOf(relationshipValue));
    const matchingRelationships = relationships.filter(
      (row) => row.sourceApplicationId === application.id,
    );
    if (matchingRelationships.length > 1) throw new LocalApiError("DUPLICATE_RELATIONSHIPS");
    const relationship = matchingRelationships[0] ?? null;
    if (relationship && relationship.studentId !== parentCandidate?.id)
      throw new LocalApiError("RELATIONSHIP_SCOPE_MISMATCH");
    if (application.status === "APPROVED" && !relationship)
      throw new LocalApiError("RELATIONSHIP_NOT_READ_BACK");
    const bindingStatus = relationship?.status === "RELEASED" ? "ENDED" : application.status;
    const activeBindingId = bindingStatus === "APPROVED" ? application.id : null;
    const governanceAvailable = policyValue !== null;
    const policies = governanceAvailable ? projectPolicies(this.dataOf(policyValue)) : [];
    const [consentValue, privacyRequestValue] =
      bindingStatus === "APPROVED" && governanceAvailable
        ? await Promise.all([
            this.request("/api-local/consents"),
            this.request("/api-local/privacy-requests"),
          ])
        : [[], []];
    const consents = projectConsents(this.dataOf(consentValue)).filter(
      (row) => row.bindingId === activeBindingId,
    );
    const privacyRequests = projectPrivacyRequests(this.dataOf(privacyRequestValue));
    if (generation !== this.generation) return;
    this.candidates = candidates;
    this.selectedStudentId = selectedStudentId;
    this.bindingId = application.id;
    this.value = {
      status: "READY",
      bindingStatus,
      policies,
      students: candidates,
      selectedStudentId,
      governanceAvailable,
      consents,
      privacyRequests,
      relationship,
      message,
    };
  }

  private async mutateConsent(path: string, init: RequestInit, message: string): Promise<void> {
    const generation = this.generation;
    this.value = { ...this.value, status: "BUSY", message: "正在更新授权状态…" };
    try {
      const receipt = this.dataOf(await this.request(path, init));
      if (!object(receipt) || receipt.dataChanged !== false)
        throw new LocalApiError("INVALID_RECEIPT");
      await this.load(generation, message);
    } catch (error) {
      if (generation === this.generation)
        this.value = { ...this.value, status: "READY", message: this.errorMessage(error) };
    }
  }

  private async mutatePrivacyRequest(
    path: string,
    init: RequestInit,
    expectedStatus: ParentPrivacyRequestStatus,
    message: string,
  ): Promise<void> {
    const generation = this.generation;
    this.value = { ...this.value, status: "BUSY", message: "正在更新个人信息申请状态…" };
    try {
      const receipt = this.dataOf(await this.request(path, init));
      const projected = projectPrivacyRequests([receipt])[0];
      if (!projected || projected.status !== expectedStatus)
        throw new LocalApiError("INVALID_RECEIPT");
      await this.load(generation, message);
    } catch (error) {
      if (generation === this.generation)
        this.value = { ...this.value, status: "READY", message: this.errorMessage(error) };
    }
  }

  private async request(path: string, init: RequestInit = {}): Promise<unknown> {
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    if (init.body !== undefined) headers.set("Content-Type", "application/json");
    const response = await this.fetcher(new URL(path, this.baseUrl), {
      ...init,
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
      headers,
    });
    let value: unknown;
    try {
      value = await response.json();
    } catch {
      throw new LocalApiError("INVALID_RESPONSE");
    }
    if (!response.ok) throw new LocalApiError(parseApiError(value), response.status);
    return value;
  }

  private errorMessage(error: unknown): string {
    if (error instanceof LocalApiError) {
      if (error.code === "UNAUTHENTICATED") return "请先使用机构邀请的账号登录，再查看家长服务。";
      if (error.code === "FORBIDDEN_SCOPE" || error.code === "UNAVAILABLE")
        return "当前受邀账号没有此家长服务权限。";
      if (error.code === "STATE_CONFLICT") return "记录状态已变化，请刷新后再试。";
    }
    return "暂时无法连接家长服务，请稍后刷新重试。";
  }
}

export function renderParentConsentPage(snapshot: ParentConsentSnapshot): string {
  const statusCopy = escapeHtml(snapshot.message);
  const relationship =
    snapshot.bindingStatus === "APPROVED"
      ? `<section class="content-card parent-consent-binding"><p class="section-kicker">关系状态 · 已审核</p><h2>监护关系已确认</h2><p>模拟学生甲 · 监护人</p><p>仅用于本机演示；服务端会再次确认关系有效后才接受授权。</p></section>`
      : snapshot.bindingStatus === "PENDING"
        ? `<section class="content-card parent-consent-binding"><p class="section-kicker">关系状态 · 等待审核</p><h2>关系申请已提交</h2><p>机构审核通过后，刷新本页即可查看用途说明。现在不能提交数据授权。</p></section>`
        : snapshot.bindingStatus === "REJECTED"
          ? `<section class="content-card parent-consent-binding"><p class="section-kicker">关系状态 · 未通过</p><h2>请联系机构核对演示关系</h2><p>在审核通过前，不会显示授权或撤回操作。</p><button class="button button-light" type="button" data-parent-binding>重新提交模拟关系申请</button></section>`
          : snapshot.bindingStatus === "ENDED"
            ? `<section class="content-card parent-consent-binding"><p class="section-kicker">关系状态 · 已结束</p><h2>当前没有有效监护关系</h2><p>重新审核通过后，才可继续查看授权事项。</p><button class="button button-light" type="button" data-parent-binding>提交模拟关系申请</button></section>`
            : `<section class="content-card parent-consent-binding"><p class="section-kicker">关系状态 · 尚未申请</p><h2>先提交监护关系申请</h2><p>只使用虚构资料“模拟学生甲”。申请会进入机构审核页面；通过后才可查看固定用途。</p><button class="button button-primary" type="button" data-parent-binding ${snapshot.status !== "READY" ? "disabled" : ""}>提交模拟关系申请</button></section>`;

  const consentCards =
    snapshot.bindingStatus !== "APPROVED"
      ? ""
      : snapshot.policies
          .map((policy) => {
            const index = snapshot.consents.map((row) => row.purposeKey).lastIndexOf(policy.key);
            const record = index >= 0 ? snapshot.consents[index] : undefined;
            const activeRecord = record?.status === "ACTIVE" ? record : null;
            const state = activeRecord
              ? `<p class="parent-consent-state">${retentionLabel(activeRecord.retentionStatus)} · 版本 ${activeRecord.version}</p><p>演示期限 ${activeRecord.retentionDays} 天，截止 ${escapeHtml(activeRecord.retainUntil.slice(0, 10))}。</p>${activeRecord.retentionOutcomeNotice ? `<p class="notice">${escapeHtml(activeRecord.retentionOutcomeNotice)}</p>` : ""}<label class="parent-consent-confirm"><input type="checkbox" data-parent-revoke-confirm="${index}" />我确认这是本机演示状态</label><button class="button button-light" type="button" data-parent-revoke="${index}" disabled>撤回授权</button>`
              : `<label class="parent-consent-confirm"><input type="checkbox" data-parent-grant-confirm="${policy.key}" />我已阅读并确认用途、告知版本和演示期限</label><button class="button button-primary" type="button" data-parent-grant="${policy.key}" ${snapshot.status !== "READY" ? "disabled" : ""}>确认并授权</button>`;
            return `<article class="content-card parent-consent-card"><p class="section-kicker">固定用途 · ${escapeHtml(policy.noticeVersion)}</p><h2>${escapeHtml(policy.title)}</h2><p>${escapeHtml(policy.necessity)}</p><p>示例资料类别：${policy.dataClasses.map(escapeHtml).join("、")}</p><p>${escapeHtml(policy.retentionNotice)}</p>${state}</article>`;
          })
          .join("");
  const privacyTypeLabels: Record<ParentPrivacyRequestType, string> = {
    ACCESS: "查阅资料",
    CORRECT: "更正资料",
    COPY: "获取资料副本",
    DELETE: "删除申请",
  };
  const privacyStatusLabels: Record<ParentPrivacyRequestStatus, string> = {
    SUBMITTED: "等待负责人查看",
    IN_REVIEW: "负责人处理中",
    SIMULATED_COMPLETE: "本机处理演示完成",
    WITHDRAWN: "已撤回",
  };
  const privacyRequests =
    snapshot.bindingStatus !== "APPROVED"
      ? ""
      : `<section class="content-card parent-privacy-requests" aria-labelledby="parent-privacy-title">
          <div class="parent-consent-heading"><h2 id="parent-privacy-title">个人信息申请</h2><span class="section-kicker">仅处理本机申请</span></div>
          <p>可申请查阅、更正、获取副本或删除。此页面只演示审核流程，不读取、复制、更正或删除真实资料。</p>
          <form class="parent-privacy-form" data-parent-privacy-form>
            <label for="parent-privacy-type">申请事项</label>
            <select id="parent-privacy-type" name="type" required ${snapshot.status !== "READY" ? "disabled" : ""}>
              <option value="" disabled selected>请选择申请事项</option>
              ${PRIVACY_REQUEST_TYPES.map((type) => `<option value="${type}">${privacyTypeLabels[type]}</option>`).join("")}
            </select>
            <button class="button button-primary" type="submit" ${snapshot.status !== "READY" ? "disabled" : ""}>提交申请</button>
          </form>
          <h3>申请进度</h3>
          ${
            snapshot.privacyRequests.length === 0
              ? `<p class="empty-state">暂无申请记录。</p>`
              : `<ul class="parent-privacy-list">${snapshot.privacyRequests
                  .map((request, index) => {
                    const canWithdraw =
                      request.status === "SUBMITTED" || request.status === "IN_REVIEW";
                    const completedNotice =
                      request.status === "SIMULATED_COMPLETE"
                        ? `<p class="notice">本机处理演示已完成，没有访问、复制、更正或删除真实资料；dataChanged=false。</p>`
                        : "";
                    return `<li><strong>${privacyTypeLabels[request.type]}</strong><span>${privacyStatusLabels[request.status]}</span><time datetime="${escapeHtml(request.updatedAt)}">更新于 ${escapeHtml(request.updatedAt.slice(0, 10))}</time>${completedNotice}${canWithdraw ? `<button class="button button-light" type="button" data-parent-privacy-withdraw="${index}" ${snapshot.status !== "READY" ? "disabled" : ""}>撤回申请</button>` : ""}</li>`;
                  })
                  .join("")}</ul>`
          }
          <p class="parent-consent-footnote">申请完成状态不代表真实资料已被访问、复制、更正或删除；dataChanged=false。</p>
        </section>`;

  return `<main class="internal-main parent-consent-main" id="main-content">
    <div class="internal-page-heading"><p class="section-kicker">家长服务 · 数据授权</p><h1>查看与管理授权</h1><p>仅用于本机合成演示。固定用途与期限不代表真实机构政策或法律意见；实际内容须由机构和专业人员确认。</p></div>
    <p class="parent-consent-status" role="status" aria-live="polite">${statusCopy}</p>
    ${snapshot.status === "ERROR" ? `<button class="button button-primary" type="button" data-parent-reconnect>重新连接</button>` : ""}
    ${relationship}
    ${snapshot.bindingStatus === "APPROVED" ? '<a class="button button-primary" href="/web/parent/home">查看费用与流水</a>' : ""}
    ${snapshot.bindingStatus === "APPROVED" ? `<section aria-labelledby="parent-consent-list-title"><div class="parent-consent-heading"><h2 id="parent-consent-list-title">固定用途说明</h2><button class="button button-light" type="button" data-parent-refresh ${snapshot.status === "BUSY" || snapshot.status === "CONNECTING" ? "disabled" : ""}>刷新状态</button></div><div class="parent-consent-grid">${consentCards}</div></section>` : ""}
    ${privacyRequests}
    <p class="parent-consent-footnote">撤回、必要保留和期限到期都只改变本机演示状态，不会删除任何资料；dataChanged=false。</p>
  </main>`;
}
