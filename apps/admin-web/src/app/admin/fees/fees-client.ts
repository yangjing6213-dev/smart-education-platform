export type FeeStudent = { readonly id: string; readonly label: string };
export type FeeDocument = {
  readonly id: string;
  readonly version: number;
  readonly documentType: "FEE_ITEM" | "BILL" | "RECEIPT" | "AGREEMENT";
  readonly title: string;
  readonly studentId: string;
  readonly studentLabel: string;
  readonly period: string;
  readonly amountMinor: number | null;
  readonly status: "AVAILABLE" | "PAID" | "VOIDED" | "EXPIRED" | "REVOKED";
  readonly validFrom: string;
  readonly validTo: string;
  readonly summary: string;
  readonly synthetic: true;
};
export type FeeAdminSnapshot = {
  readonly students: readonly FeeStudent[];
  readonly documents: readonly FeeDocument[];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const DOCUMENT_TYPES = ["FEE_ITEM", "BILL", "RECEIPT", "AGREEMENT"] as const;
const DOCUMENT_STATUSES = ["AVAILABLE", "PAID", "VOIDED", "EXPIRED", "REVOKED"] as const;
const DATE = /^\d{4}-\d{2}-\d{2}$/u;

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeLabel(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 80;
}

function parseSnapshot(value: unknown): FeeAdminSnapshot {
  if (
    !record(value) ||
    Object.keys(value).sort().join(",") !== "documents,students,synthetic" ||
    value.synthetic !== true ||
    !Array.isArray(value.students) ||
    !Array.isArray(value.documents) ||
    value.students.length > 200 ||
    value.documents.length > 200
  )
    throw new Error("费用列表格式不正确。");

  const students = value.students.map((item): FeeStudent => {
    if (
      !record(item) ||
      Object.keys(item).sort().join(",") !== "id,label" ||
      typeof item.id !== "string" ||
      !UUID.test(item.id) ||
      !safeLabel(item.label)
    )
      throw new Error("学生选项格式不正确。");
    return { id: item.id, label: item.label };
  });
  const knownStudents = new Map(students.map((student) => [student.id, student.label]));
  const documents = value.documents.map((item): FeeDocument => {
    if (
      !record(item) ||
      Object.keys(item).sort().join(",") !==
        "amountMinor,documentType,id,period,status,studentId,studentLabel,summary,synthetic,title,validFrom,validTo,version" ||
      typeof item.id !== "string" ||
      !UUID.test(item.id) ||
      !Number.isSafeInteger(item.version) ||
      Number(item.version) < 1 ||
      !DOCUMENT_TYPES.includes(item.documentType as (typeof DOCUMENT_TYPES)[number]) ||
      !safeLabel(item.title) ||
      typeof item.studentId !== "string" ||
      !safeLabel(item.studentLabel) ||
      (knownStudents.has(String(item.studentId)) && knownStudents.get(String(item.studentId)) !== item.studentLabel) ||
      typeof item.period !== "string" ||
      !/^\d{4}-(?:0[1-9]|1[0-2])$/u.test(item.period) ||
      (item.amountMinor !== null &&
        (!Number.isSafeInteger(item.amountMinor) || Number(item.amountMinor) < 0)) ||
      !DOCUMENT_STATUSES.includes(item.status as (typeof DOCUMENT_STATUSES)[number]) ||
      typeof item.validFrom !== "string" ||
      !DATE.test(item.validFrom) ||
      typeof item.validTo !== "string" ||
      !DATE.test(item.validTo) ||
      !safeLabel(item.summary) ||
      item.synthetic !== true
    )
      throw new Error("费用记录格式不正确。");
    return item as FeeDocument;
  });
  return { students, documents };
}

export class FeeAccessError extends Error {
  constructor(readonly status: 401 | 403) {
    super(status === 401 ? "登录已失效，请重新登录。" : "当前账号没有费用管理权限。");
  }
}

export class FeesAdminClient {
  constructor(private readonly fetcher: typeof fetch = globalThis.fetch.bind(globalThis)) {}

  async list(): Promise<FeeAdminSnapshot> {
    return parseSnapshot(await this.request("/api/admin/fees"));
  }

  async create(value: {
    readonly student_id: string;
    readonly document_type: "FEE_ITEM" | "BILL" | "AGREEMENT";
    readonly title: string;
    readonly period: string;
    readonly amount_minor: number | null;
    readonly valid_from: string;
    readonly valid_to: string;
    readonly summary: string;
  }): Promise<void> {
    await this.request("/api/admin/fees", { method: "POST", body: JSON.stringify(value) });
  }

  async revoke(id: string, expectedVersion: number): Promise<void> {
    if (!UUID.test(id) || !Number.isSafeInteger(expectedVersion) || expectedVersion < 1)
      throw new Error("撤回请求格式不正确。");
    await this.request(`/api/admin/fees/${id}/revoke`, {
      method: "POST",
      body: JSON.stringify({ expected_version: expectedVersion }),
    });
  }

  private async request(path: string, init: RequestInit = {}): Promise<unknown> {
    const response = await this.fetcher(path, {
      ...init,
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
      headers: {
        ...(init.body === undefined ? {} : { "content-type": "application/json" }),
        ...init.headers,
      },
      signal: AbortSignal.timeout(8000),
    });
    if (response.status === 401 || response.status === 403) {
      // Update access immediately even if the error body is empty, malformed or slow.
      void response.text().catch(() => {});
      throw new FeeAccessError(response.status);
    }
    let envelope: unknown;
    try {
      envelope = await response.json();
    } catch {
      throw new Error("费用服务返回内容无法读取。");
    }
    if (!response.ok) {
      const code = record(envelope) && record(envelope.error) ? envelope.error.code : undefined;
      if (response.status === 409) throw new Error("记录已被更新，请刷新后再试。");
      if (response.status === 404) throw new Error("记录不存在或不属于当前校区。");
      throw new Error(typeof code === "string" ? "费用操作暂不可用，请稍后重试。" : "费用服务暂不可用，请稍后重试。");
    }
    if (!record(envelope) || !Object.hasOwn(envelope, "data"))
      throw new Error("费用服务返回内容格式不正确。");
    return envelope.data;
  }
}
