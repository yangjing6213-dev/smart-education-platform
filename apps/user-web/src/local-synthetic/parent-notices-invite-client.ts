export type ParentNoticesInviteReceipt = "UNREAD" | "READ" | "ACKNOWLEDGED";
export type ParentNoticesInviteAction = "read" | "ack";

export type ParentNoticesInviteNotice = {
  readonly id: string;
  readonly version: number;
  readonly status: "PUBLISHED";
  readonly published: true;
  readonly title: string;
  readonly body: string;
  readonly target: "INSTITUTION" | "CLASS";
  readonly requiresAcknowledgment: true;
  readonly receiptStatus: ParentNoticesInviteReceipt;
  readonly synthetic: true;
};

export type ParentNoticesInviteSnapshot = {
  readonly status: "IDLE" | "CONNECTING" | "BUSY" | "READY" | "ERROR" | "DENIED";
  readonly notices: readonly ParentNoticesInviteNotice[];
  readonly message: string;
};

type ClientOptions = {
  readonly baseUrl: string;
  readonly fetcher?: typeof fetch;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const NOTICE_KEYS = [
  "body",
  "id",
  "published",
  "receiptStatus",
  "requiresAcknowledgment",
  "status",
  "synthetic",
  "target",
  "title",
  "version",
].sort();

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
    throw new Error("通知服务必须使用本机地址或 HTTPS 同源地址。");
  return base;
}

function parseNotice(value: unknown): ParentNoticesInviteNotice {
  if (
    !object(value) ||
    Object.keys(value).sort().join("\u0000") !== NOTICE_KEYS.join("\u0000") ||
    typeof value.id !== "string" ||
    !UUID.test(value.id) ||
    !Number.isSafeInteger(value.version) ||
    Number(value.version) < 1 ||
    value.status !== "PUBLISHED" ||
    value.published !== true ||
    value.synthetic !== true ||
    typeof value.title !== "string" ||
    value.title.trim().length === 0 ||
    value.title.length > 120 ||
    typeof value.body !== "string" ||
    value.body.trim().length === 0 ||
    value.body.length > 2000 ||
    (value.target !== "INSTITUTION" && value.target !== "CLASS") ||
    value.requiresAcknowledgment !== true ||
    (value.receiptStatus !== "UNREAD" &&
      value.receiptStatus !== "READ" &&
      value.receiptStatus !== "ACKNOWLEDGED")
  )
    throw new Error("通知内容格式无效。");
  return value as ParentNoticesInviteNotice;
}

function parseNotices(value: unknown): ParentNoticesInviteNotice[] {
  if (!Array.isArray(value) || value.length > 200) throw new Error("通知列表格式无效。");
  const ids = new Set<string>();
  const rows = value.map((entry) => parseNotice(entry));
  for (const row of rows) {
    if (ids.has(row.id)) throw new Error("通知列表包含重复记录。");
    ids.add(row.id);
  }
  return rows;
}

function responseData(value: unknown): unknown {
  if (!object(value) || !Object.hasOwn(value, "data")) throw new Error("通知服务返回内容无效。");
  return value.data;
}

export class ParentNoticesInviteClient {
  private readonly origin: string;
  private readonly fetcher: typeof fetch;
  private value: ParentNoticesInviteSnapshot = {
    status: "IDLE",
    notices: [],
    message: "使用邀请账号登录后查看已发布通知。",
  };

  public constructor(options: ClientOptions) {
    this.origin = validBase(options.baseUrl).origin;
    this.fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
  }

  public get snapshot(): ParentNoticesInviteSnapshot {
    return structuredClone(this.value);
  }

  public disconnect(): void {
    this.value = {
      status: "IDLE",
      notices: [],
      message: "通知连接已关闭。",
    };
  }

  public async connect(): Promise<void> {
    this.value = {
      status: "CONNECTING",
      notices: [],
      message: "正在读取已发布的通知…",
    };
    await this.refresh();
  }

  public async refresh(): Promise<void> {
    this.value = { ...this.value, status: "BUSY", message: "正在刷新通知…" };
    try {
      const payload = await this.request("/api-local/parent/notices", "GET");
      this.value = {
        status: "READY",
        notices: parseNotices(responseData(payload)),
        message: "已显示当前审核关系范围内的已发布通知。",
      };
    } catch (error) {
      const denied = error instanceof ResponseError && [401, 403].includes(error.status);
      this.value = {
        status: denied ? "DENIED" : "ERROR",
        notices: [],
        message: denied
          ? "当前关系或权限不允许查看通知，已清除之前显示的内容。"
          : "通知暂时无法读取，请稍后重试。",
      };
    }
  }

  public async receipt(
    id: string,
    version: number,
    action: ParentNoticesInviteAction,
  ): Promise<void> {
    const notice = this.value.notices.find((row) => row.id === id);
    if (
      !notice ||
      notice.version !== version ||
      !Number.isSafeInteger(version) ||
      (action === "read" && notice.receiptStatus !== "UNREAD") ||
      (action === "ack" && notice.receiptStatus !== "READ")
    )
      return;
    try {
      const payload = await this.request(`/api-local/parent/notices/${id}/${action}`, "POST", {
        version,
      });
      const updated = parseNotice(responseData(payload));
      if (updated.id !== id || updated.version !== version)
        throw new Error("通知版本已变化，请刷新后重试。");
      this.value = {
        status: "READY",
        notices: this.value.notices.map((row) => (row.id === id ? updated : row)),
        message: action === "read" ? "通知已阅读，可以继续确认知悉。" : "已确认知悉这条通知。",
      };
    } catch (error) {
      const denied = error instanceof ResponseError && [401, 403].includes(error.status);
      this.value = {
        status: denied ? "DENIED" : "ERROR",
        notices: [],
        message: denied
          ? "当前关系或权限不允许更新通知，已清除之前显示的内容。"
          : "通知状态已变化，请刷新后重试。",
      };
      throw error;
    }
  }

  private async request(path: string, method: "GET" | "POST", body?: object): Promise<unknown> {
    const url = new URL(path, this.origin);
    if (url.origin !== this.origin || url.search || url.hash) throw new Error("通知请求地址无效。");
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

class ResponseError extends Error {
  public constructor(public readonly status: number) {
    super(`本机通知服务返回 ${status}。`);
  }
}
