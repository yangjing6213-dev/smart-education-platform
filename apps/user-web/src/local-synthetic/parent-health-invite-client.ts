export type ParentHealthInviteReceipt = "UNREAD" | "READ" | "ACKNOWLEDGED";
export type ParentHealthInviteAction = "read" | "ack";

export type ParentHealthInviteRecord = {
  readonly id: string;
  readonly version: number;
  readonly status: "PUBLISHED";
  readonly published: true;
  readonly date: string;
  readonly title: string;
  readonly parentSummary: string;
  readonly receiptStatus: ParentHealthInviteReceipt;
  readonly synthetic: true;
};

export type ParentHealthInviteSnapshot = {
  readonly status:
    "IDLE" | "CONNECTING" | "BUSY" | "READY" | "ERROR" | "DENIED";
  readonly records: readonly ParentHealthInviteRecord[];
  readonly message: string;
};

type ClientOptions = {
  readonly baseUrl: string;
  readonly fetcher?: typeof fetch;
};

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SERVICE_RECORD_KEYS = [
  "id",
  "parentSummary",
  "receiptStatus",
  "status",
  "studentLabel",
  "synthetic",
  "updatedAt",
  "version",
].sort();
const SAFE_PARENT_VIEW_KEYS = [
  "date",
  "id",
  "parentSummary",
  "published",
  "receiptStatus",
  "status",
  "synthetic",
  "title",
  "version",
].sort();

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const calendarDate = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(calendarDate.getTime()) && calendarDate.toISOString().slice(0, 10) === value;
}

function validUpdatedAt(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/u.test(value) ||
    !Number.isFinite(Date.parse(value))
  )
    return false;
  const date = value.slice(0, 10);
  const calendarDate = new Date(`${date}T00:00:00.000Z`);
  return (
    Number.isFinite(calendarDate.getTime()) &&
    calendarDate.toISOString().slice(0, 10) === date
  );
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validBase(baseUrl: string): URL {
  const base = new URL(baseUrl);
  const loopback = ["127.0.0.1", "localhost", "[::1]"].includes(base.hostname);
  if (
    (base.protocol !== "https:" &&
      !(base.protocol === "http:" && loopback && base.port)) ||
    base.username ||
    base.password ||
    base.pathname !== "/" ||
    base.search ||
    base.hash
  )
    throw new Error("健康摘要服务必须使用本机地址或 HTTPS 同源地址。");
  return base;
}

function parseRecord(value: unknown): ParentHealthInviteRecord {
  if (
    object(value) &&
    Object.keys(value).sort().join("\u0000") === SAFE_PARENT_VIEW_KEYS.join("\u0000")
  ) {
    if (
      typeof value.id !== "string" ||
      !UUID.test(value.id) ||
      !Number.isSafeInteger(value.version) ||
      Number(value.version) < 1 ||
      value.status !== "PUBLISHED" ||
      value.published !== true ||
      value.synthetic !== true ||
      !validDate(value.date) ||
      typeof value.title !== "string" ||
      value.title.trim().length === 0 ||
      value.title.length > 120 ||
      typeof value.parentSummary !== "string" ||
      value.parentSummary.trim().length === 0 ||
      value.parentSummary.length > 240 ||
      (value.receiptStatus !== "UNREAD" &&
        value.receiptStatus !== "READ" &&
        value.receiptStatus !== "ACKNOWLEDGED")
    )
      throw new Error("健康摘要内容格式无效。");
    return {
      id: value.id,
      version: Number(value.version),
      status: "PUBLISHED",
      published: true,
      date: value.date,
      title: value.title,
      parentSummary: value.parentSummary,
      receiptStatus: value.receiptStatus,
      synthetic: true,
    };
  }
  if (
    !object(value) ||
    Object.keys(value).sort().join("\u0000") !==
      SERVICE_RECORD_KEYS.join("\u0000") ||
    typeof value.id !== "string" ||
    !UUID.test(value.id) ||
    !Number.isSafeInteger(value.version) ||
    Number(value.version) < 1 ||
    value.status !== "PUBLISHED" ||
    value.synthetic !== true ||
    typeof value.studentLabel !== "string" ||
    value.studentLabel.trim().length === 0 ||
    value.studentLabel.length > 120 ||
    typeof value.parentSummary !== "string" ||
    value.parentSummary.trim().length === 0 ||
    value.parentSummary.length > 240 ||
    !validUpdatedAt(value.updatedAt) ||
    (value.receiptStatus !== "UNREAD" &&
      value.receiptStatus !== "READ" &&
      value.receiptStatus !== "ACKNOWLEDGED")
  )
    throw new Error("健康摘要内容格式无效。");
  return {
    id: value.id,
    version: Number(value.version),
    status: "PUBLISHED",
    published: true,
    date: new Date(value.updatedAt).toISOString().slice(0, 10),
    title: value.studentLabel,
    parentSummary: value.parentSummary,
    receiptStatus: value.receiptStatus,
    synthetic: true,
  };
}
function parseRecords(value: unknown): ParentHealthInviteRecord[] {
  if (!Array.isArray(value) || value.length > 100)
    throw new Error("健康摘要列表格式无效。");
  const rows = value.map(parseRecord);
  const ids = new Set(rows.map(({ id }) => id));
  if (ids.size !== rows.length) throw new Error("健康摘要列表包含重复记录。");
  return rows;
}

function responseData(value: unknown): unknown {
  if (!object(value) || !Object.hasOwn(value, "data"))
    throw new Error("健康摘要服务返回内容无效。");
  return value.data;
}

class ResponseError extends Error {
  public constructor(public readonly status: number) {
    super(`本机健康摘要服务返回 ${status}。`);
  }
}

export class ParentHealthInviteClient {
  private readonly origin: string;
  private readonly fetcher: typeof fetch;
  private value: ParentHealthInviteSnapshot = {
    status: "IDLE",
    records: [],
    message: "使用家长邀请账号登录后查看已发布摘要。",
  };

  public constructor(options: ClientOptions) {
    this.origin = validBase(options.baseUrl).origin;
    this.fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
  }

  public get snapshot(): ParentHealthInviteSnapshot {
    return structuredClone(this.value);
  }

  public disconnect(): void {
    this.value = {
      status: "IDLE",
      records: [],
      message: "健康摘要连接已关闭。",
    };
  }

  public async connect(): Promise<void> {
    this.value = {
      status: "CONNECTING",
      records: [],
      message: "正在确认邀请账号…",
    };
    await this.refresh();
  }

  public async refresh(): Promise<void> {
    this.value = {
      ...this.value,
      status: "BUSY",
      message: "正在刷新健康跟进摘要…",
    };
    try {
      const payload = await this.request(
        "/api-local/parent/health-incidents",
        "GET",
      );
      this.value = {
        status: "READY",
        records: parseRecords(responseData(payload)),
        message: "已显示当前审核关系内已发布的健康摘要。",
      };
    } catch (error) {
      const denied =
        error instanceof ResponseError && [401, 403].includes(error.status);
      this.value = {
        status: denied ? "DENIED" : "ERROR",
        records: [],
        message: denied
          ? "当前邀请账号或审核关系无权查看健康摘要，已清除之前显示的内容。"
          : "健康跟进摘要暂时无法读取，请稍后重试。",
      };
    }
  }

  public async receipt(
    id: string,
    version: number,
    action: ParentHealthInviteAction,
  ): Promise<void> {
    const record = this.value.records.find((row) => row.id === id);
    if (
      !record ||
      record.version !== version ||
      !Number.isSafeInteger(version) ||
      (action === "read" && record.receiptStatus !== "UNREAD") ||
      (action === "ack" && record.receiptStatus !== "READ")
    )
      return;
    try {
      const payload = await this.request(
        `/api-local/parent/health-incidents/${id}/${action}`,
        "POST",
        { version },
      );
      const updated = parseRecord(responseData(payload));
      if (updated.id !== id || updated.version !== version)
        throw new Error("健康摘要版本已变化，请刷新后重试。");
      this.value = {
        status: "READY",
        records: this.value.records.map((row) =>
          row.id === id ? updated : row,
        ),
        message:
          action === "read"
            ? "健康摘要已阅读，可以继续确认知悉。"
            : "已确认知悉这条健康摘要。",
      };
    } catch (error) {
      const denied =
        error instanceof ResponseError && [401, 403].includes(error.status);
      this.value = {
        status: denied ? "DENIED" : "ERROR",
        records: [],
        message: denied
          ? "当前邀请账号或审核关系无权更新摘要，已清除之前显示的内容。"
          : "健康摘要状态已变化，请刷新后重试。",
      };
      throw error;
    }
  }

  private async request(
    path: string,
    method: "GET" | "POST",
    body?: object,
  ): Promise<unknown> {
    const url = new URL(path, this.origin);
    if (url.origin !== this.origin || url.search || url.hash)
      throw new Error("健康摘要请求地址无效。");
    const response = await this.fetcher(url, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
      headers: {
        accept: "application/json",
        ...(body ? { "content-type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const payload: unknown = await response.json().catch(() => undefined);
    if (!response.ok) throw new ResponseError(response.status);
    return payload;
  }
}
