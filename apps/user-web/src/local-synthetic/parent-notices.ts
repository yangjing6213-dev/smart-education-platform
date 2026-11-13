export type ParentNoticeReceipt = "UNREAD" | "READ" | "ACKNOWLEDGED";
export type ParentNoticeAction = "read" | "ack";
export type ParentNotice = {
  readonly id: string;
  readonly version: number;
  readonly title: string;
  readonly body: string;
  readonly target: "INSTITUTION" | "CLASS";
  readonly receiptStatus: ParentNoticeReceipt;
};
export type ParentNoticeSnapshot = {
  readonly status: "IDLE" | "CONNECTING" | "BUSY" | "READY" | "ERROR" | "DENIED";
  readonly notices: readonly ParentNotice[];
  readonly message: string;
};
export type ParentNoticeClientOptions = {
  readonly baseUrl?: string;
  readonly fetcher?: typeof fetch;
};

type NoticeSession = {
  readonly handle: string;
  readonly actorId: string;
  readonly tenantId: string;
  readonly campusId: string;
  readonly classIds: readonly string[];
  readonly actions: readonly string[];
};

const API_BASE = "http://127.0.0.1:4317";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown, maxLength = 300): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;

class ParentNoticeError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

function validBase(baseUrl: string): URL {
  const base = new URL(baseUrl);
  if (
    base.protocol !== "http:" ||
    !["127.0.0.1", "localhost"].includes(base.hostname) ||
    !base.port ||
    base.username ||
    base.password ||
    base.pathname !== "/" ||
    base.search ||
    base.hash
  )
    throw new Error("家长通知只允许连接本机服务。");
  return base;
}

function allowedRequest(path: string, method: string): boolean {
  if (path === "/local/sessions") return method === "POST";
  if (path === "/local/session" || path === "/local/notices") return method === "GET";
  return (
    method === "POST" &&
    /^\/local\/notices\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/(read|ack)$/iu.test(
      path,
    )
  );
}

export function createParentNoticeTransport(
  baseUrl = API_BASE,
  fetcher: typeof fetch = globalThis.fetch.bind(globalThis),
): typeof fetch {
  const origin = validBase(baseUrl).origin;
  return async (input, init = {}) => {
    if (typeof input !== "string") return new Response(null, { status: 403 });
    let url: URL;
    try {
      url = new URL(input, origin);
    } catch {
      return new Response(null, { status: 403 });
    }
    const method = init.method ?? "GET";
    if (url.origin !== origin || url.search || url.hash || !allowedRequest(url.pathname, method))
      return new Response(null, { status: 403 });
    return fetcher(url, {
      ...init,
      credentials: "omit",
      cache: "no-store",
      redirect: "error",
    });
  };
}

function parseSession(value: unknown, handle: string): NoticeSession {
  const expectedKeys = [
    "mode",
    "profile",
    "label",
    "actorId",
    "tenantId",
    "campusId",
    "classIds",
    "actions",
  ];
  if (
    !object(value) ||
    Object.keys(value).length !== expectedKeys.length ||
    expectedKeys.some((key) => !Object.hasOwn(value, key)) ||
    value.mode !== "local-synthetic" ||
    value.profile !== "parent-alpha" ||
    !text(value.label, 120) ||
    typeof value.actorId !== "string" ||
    !UUID.test(value.actorId) ||
    typeof value.tenantId !== "string" ||
    !UUID.test(value.tenantId) ||
    typeof value.campusId !== "string" ||
    !UUID.test(value.campusId) ||
    !Array.isArray(value.classIds) ||
    value.classIds.length === 0 ||
    !value.classIds.every((id) => typeof id === "string" && UUID.test(id)) ||
    !Array.isArray(value.actions) ||
    !value.actions.every((action) => typeof action === "string") ||
    !value.actions.includes("notice:read") ||
    !value.actions.includes("notice:ack")
  )
    throw new ParentNoticeError("UNAVAILABLE");
  return {
    handle,
    actorId: value.actorId,
    tenantId: value.tenantId,
    campusId: value.campusId,
    classIds: value.classIds as string[],
    actions: value.actions as string[],
  };
}

function parseNotices(value: unknown, session: NoticeSession): ParentNotice[] {
  if (!Array.isArray(value) || value.length > 200) throw new ParentNoticeError("INVALID_NOTICES");
  const ids = new Set<string>();
  const notices = value.map((row): ParentNotice | null => {
    if (
      !object(row) ||
      typeof row.id !== "string" ||
      !UUID.test(row.id) ||
      ids.has(row.id) ||
      !Number.isSafeInteger(row.version) ||
      Number(row.version) < 1 ||
      row.status !== "PUBLISHED" ||
      row.published !== true ||
      row.synthetic !== true ||
      !text(row.title) ||
      !text(row.body) ||
      (row.target !== "INSTITUTION" && row.target !== "CLASS") ||
      typeof row.classId !== "string" ||
      !session.classIds.includes(row.classId) ||
      row.requiresAcknowledgment !== true ||
      (row.receiptStatus !== "UNREAD" &&
        row.receiptStatus !== "READ" &&
        row.receiptStatus !== "ACKNOWLEDGED")
    )
      return null;
    ids.add(row.id);
    return {
      id: row.id,
      version: Number(row.version),
      title: row.title,
      body: row.body,
      target: row.target,
      receiptStatus: row.receiptStatus,
    };
  });
  if (notices.some((row) => row === null)) throw new ParentNoticeError("INVALID_NOTICES");
  return notices as ParentNotice[];
}

function escape(value: string): string {
  return value.replace(
    /[&<>"']/gu,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!,
  );
}

function receiptLabel(status: ParentNoticeReceipt): string {
  if (status === "ACKNOWLEDGED") return "已确认知悉";
  if (status === "READ") return "已阅读，等待确认知悉";
  return "未阅读";
}

export function renderParentNoticesPanel(snapshot: ParentNoticeSnapshot): string {
  const busy = snapshot.status === "CONNECTING" || snapshot.status === "BUSY";
  const reconnect =
    snapshot.status === "IDLE" || snapshot.status === "ERROR" || snapshot.status === "DENIED";
  const cards = snapshot.notices
    .map((notice) => {
      const action =
        notice.receiptStatus === "UNREAD"
          ? `<button class="button button-primary" type="button" data-parent-notice-action="read" data-parent-notice-id="${notice.id}" data-parent-notice-version="${notice.version}"${busy ? " disabled" : ""}>阅读通知</button>`
          : notice.receiptStatus === "READ"
            ? `<button class="button button-primary" type="button" data-parent-notice-action="ack" data-parent-notice-id="${notice.id}" data-parent-notice-version="${notice.version}"${busy ? " disabled" : ""}>确认知悉</button>`
            : "";
      return `<article class="parent-notice-card" data-parent-notice-id="${notice.id}"><div class="parent-notice-heading"><h3>${escape(notice.title)}</h3><span>${notice.target === "CLASS" ? "班级通知" : "机构通知"}</span></div><p class="parent-notice-body">${escape(notice.body)}</p><div class="parent-notice-footer"><span class="parent-notice-receipt">${receiptLabel(notice.receiptStatus)}</span>${action || '<span class="parent-notice-complete">已确认</span>'}</div></article>`;
    })
    .join("");
  return `<section class="parent-notices-panel" data-parent-notices-panel aria-labelledby="parent-notices-title"><div class="parent-notices-heading"><div><p class="section-kicker">家长服务 · 本机共享通知</p><h2 id="parent-notices-title">通知与确认</h2></div><button class="button button-light" type="button" data-parent-notices-refresh${busy ? " disabled" : ""}>${reconnect ? "重新连接" : "刷新通知"}</button></div><p class="parent-notices-note">只显示当前审核关系范围内已发布的通知。阅读和确认知悉分开记录，不代表已发送真实消息。</p><p class="parent-notices-status" data-parent-notices-status role="status" aria-live="polite" tabindex="-1">${escape(snapshot.message)}</p>${cards || (snapshot.status === "READY" ? '<p class="parent-notices-empty">当前没有已发布的通知。</p>' : "")}</section>`;
}

export class ParentNoticeClient {
  private readonly transport: typeof fetch;
  private generation = 0;
  private session: NoticeSession | null = null;
  private value: ParentNoticeSnapshot = {
    status: "IDLE",
    notices: [],
    message: "连接本机共享服务后查看已发布通知。",
  };

  constructor(options: ParentNoticeClientOptions = {}) {
    this.transport = createParentNoticeTransport(options.baseUrl, options.fetcher);
  }

  get snapshot(): ParentNoticeSnapshot {
    return structuredClone(this.value);
  }

  disconnect(): void {
    this.generation += 1;
    this.session = null;
    this.value = {
      status: "IDLE",
      notices: [],
      message: "本机通知连接已关闭。",
    };
  }

  async connect(): Promise<void> {
    this.disconnect();
    const generation = this.generation;
    this.value = {
      status: "CONNECTING",
      notices: [],
      message: "正在读取本机已发布通知…",
    };
    try {
      const created = await this.request(
        "/local/sessions",
        "POST",
        { profile: "parent-alpha" },
        null,
      );
      if (
        !object(created) ||
        typeof created.handle !== "string" ||
        !/^[\w-]{43}$/u.test(created.handle)
      )
        throw new ParentNoticeError("INVALID_SESSION");
      const next = parseSession(
        await this.request("/local/session", "GET", undefined, created.handle),
        created.handle,
      );
      if (generation !== this.generation) return;
      this.session = next;
      await this.load(generation, "已显示当前关系范围内的通知。");
    } catch (error) {
      if (generation !== this.generation) return;
      this.fail(error);
    }
  }

  async refresh(): Promise<void> {
    if (!this.session || this.value.status === "ERROR" || this.value.status === "DENIED") {
      await this.connect();
      return;
    }
    const generation = this.generation;
    this.value = { ...this.value, status: "BUSY", message: "正在刷新通知…" };
    try {
      await this.load(generation, "通知已更新。");
    } catch (error) {
      if (generation !== this.generation) return;
      this.fail(error);
    }
  }

  async receipt(id: string, version: number, action: ParentNoticeAction): Promise<void> {
    const notice = this.value.notices.find((row) => row.id === id);
    if (!this.session || !notice || notice.version !== version || !Number.isSafeInteger(version)) {
      this.value = { ...this.value, message: "通知版本已变化，请刷新后重试。" };
      return;
    }
    if (
      (action === "read" && notice.receiptStatus !== "UNREAD") ||
      (action === "ack" && notice.receiptStatus !== "READ")
    ) {
      this.value = {
        ...this.value,
        message:
          action === "ack" ? "请先阅读通知，再确认知悉。" : "此通知已阅读，请刷新后查看最新状态。",
      };
      return;
    }
    const generation = this.generation;
    this.value = {
      ...this.value,
      status: "BUSY",
      message: "正在保存通知回执…",
    };
    try {
      await this.request(`/local/notices/${id}/${action}`, "POST", { version });
      if (generation !== this.generation) return;
      await this.load(
        generation,
        action === "read" ? "通知已打开，可继续确认知悉。" : "已确认知悉这条通知。",
      );
    } catch (error) {
      if (generation !== this.generation) return;
      if (error instanceof ParentNoticeError && error.code === "STATE_CONFLICT") {
        try {
          await this.load(generation, "通知版本已更新，已刷新内容，请重新查看。");
        } catch (refreshError) {
          this.fail(refreshError);
        }
        return;
      }
      this.fail(error);
    }
  }

  private async load(generation: number, message: string): Promise<void> {
    if (!this.session) throw new ParentNoticeError("UNAVAILABLE");
    const rows = await this.request("/local/notices", "GET");
    if (generation !== this.generation || !this.session) return;
    this.value = {
      status: "READY",
      notices: parseNotices(rows, this.session),
      message,
    };
  }

  private async request(
    path: string,
    method = "GET",
    body?: object,
    handle = this.session?.handle ?? null,
  ): Promise<unknown> {
    if (!allowedRequest(path, method)) throw new ParentNoticeError("REQUEST_NOT_ALLOWED");
    const response = await this.transport(path, {
      method,
      headers: {
        Accept: "application/json",
        ...(handle ? { Authorization: `Bearer ${handle}` } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new ParentNoticeError("INVALID_RESPONSE");
    }
    if (!response.ok) {
      const code =
        object(data) && object(data.error) && typeof data.error.code === "string"
          ? data.error.code
          : "REQUEST_FAILED";
      throw new ParentNoticeError(code);
    }
    return data;
  }

  private fail(error: unknown): void {
    const code = error instanceof ParentNoticeError ? error.code : "REQUEST_FAILED";
    const denied = code === "UNAVAILABLE";
    this.session = null;
    this.value = {
      status: denied ? "DENIED" : "ERROR",
      notices: [],
      message: denied
        ? "当前家长示例身份没有查看通知的权限。"
        : "本机通知服务暂不可用；页面不会显示本地替代通知。",
    };
  }
}
