export const NOTICE_REVIEW_ROUTE = "/admin/notice-review";

export type NoticeReviewAction = "CONFIRM" | "RETURN" | "PUBLISH" | "REVOKE";
type NoticeStatus = "DRAFT" | "SUBMITTED" | "RETURNED" | "CONFIRMED" | "PUBLISHED" | "REVOKED";

interface Session {
  readonly profile: "owner-east";
  readonly label: string;
  readonly actorId: string;
  readonly tenantId: string;
  readonly campusId: string;
  readonly classIds: readonly string[];
  readonly actions: readonly string[];
}

interface NoticeRow {
  readonly id: string;
  readonly version: number;
  readonly status: NoticeStatus;
  readonly published: boolean;
  readonly title: string;
  readonly body: string;
  readonly target: "INSTITUTION" | "CLASS";
  readonly classId: string;
  readonly requiresAcknowledgment: true;
  readonly template: "INSTITUTION_ANNOUNCEMENT" | "CLASS_ACTIVITY";
  readonly authorId: string;
  readonly authorLabel: string;
  readonly updatedAt: string;
}

export interface NoticeReviewSnapshot {
  readonly status: "IDLE" | "CONNECTING" | "READY" | "ERROR";
  readonly session: Session | null;
  readonly queue: readonly NoticeRow[];
  readonly history: readonly NoticeRow[];
  readonly message: string;
}

const API_BASE = "http://127.0.0.1:4317";
const STATUS_LABEL: Record<NoticeStatus, string> = {
  DRAFT: "草稿",
  SUBMITTED: "待审核",
  RETURNED: "已退回",
  CONFIRMED: "已审核",
  PUBLISHED: "已发布",
  REVOKED: "已撤回",
};
const TEMPLATE_LABEL = {
  INSTITUTION_ANNOUNCEMENT: "机构公告",
  CLASS_ACTIVITY: "班级活动",
} as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const escape = (value: string | number): string =>
  String(value).replace(
    /[&<>"']/gu,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!,
  );

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
    throw new Error("通知审核仅允许连接本机服务。");
  return base;
}

function allowedRequest(path: string, method: string): boolean {
  if (path === "/local/sessions") return method === "POST";
  if (["/local/session", "/local/notice-review", "/local/notice-owned"].includes(path))
    return method === "GET";
  return (
    /^\/local\/notices\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/(review|publish|revoke)$/iu.test(
      path,
    ) && method === "POST"
  );
}

export function createLocalNoticeReviewTransport(
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

function parseSession(value: unknown): Session {
  const keys = [
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
    Object.keys(value).length !== keys.length ||
    keys.some((key) => !Object.hasOwn(value, key)) ||
    value.mode !== "local-synthetic" ||
    value.profile !== "owner-east" ||
    typeof value.label !== "string" ||
    value.label.length === 0 ||
    value.label.length > 120 ||
    typeof value.actorId !== "string" ||
    !UUID.test(value.actorId) ||
    typeof value.tenantId !== "string" ||
    !UUID.test(value.tenantId) ||
    typeof value.campusId !== "string" ||
    !UUID.test(value.campusId) ||
    !Array.isArray(value.classIds) ||
    value.classIds.length === 0 ||
    !value.classIds.every((id) => typeof id === "string" && UUID.test(id)) ||
    new Set(value.classIds).size !== value.classIds.length ||
    !Array.isArray(value.actions) ||
    !value.actions.every((action) => typeof action === "string") ||
    !value.actions.includes("notice:review") ||
    !value.actions.includes("notice:publish") ||
    !value.actions.includes("notice:revoke")
  )
    throw new Error("当前示例身份没有通知审核权限或校区范围不正确。");
  return {
    profile: "owner-east",
    label: value.label,
    actorId: value.actorId as string,
    tenantId: value.tenantId as string,
    campusId: value.campusId as string,
    classIds: value.classIds as string[],
    actions: value.actions as string[],
  };
}

function parseRows(value: unknown, session: Session, queue: boolean): NoticeRow[] {
  if (!Array.isArray(value) || value.length > 200)
    throw new Error("通知记录格式不正确，已停止显示。");
  const ids = new Set<string>();
  const keys = [
    "id",
    "version",
    "status",
    "published",
    "title",
    "body",
    "target",
    "classId",
    "requiresAcknowledgment",
    "receiptStatus",
    "synthetic",
    "template",
    "authorId",
    "authorLabel",
    "updatedAt",
  ];
  return value.map((candidate) => {
    if (
      !object(candidate) ||
      Object.keys(candidate).length !== keys.length ||
      keys.some((key) => !Object.hasOwn(candidate, key)) ||
      typeof candidate.id !== "string" ||
      !UUID.test(candidate.id) ||
      ids.has(candidate.id) ||
      !Number.isSafeInteger(candidate.version) ||
      Number(candidate.version) < 1 ||
      candidate.synthetic !== true ||
      !["DRAFT", "SUBMITTED", "RETURNED", "CONFIRMED", "PUBLISHED", "REVOKED"].includes(
        String(candidate.status),
      ) ||
      candidate.published !== (candidate.status === "PUBLISHED") ||
      typeof candidate.title !== "string" ||
      candidate.title.length === 0 ||
      candidate.title.length > 120 ||
      typeof candidate.body !== "string" ||
      candidate.body.length === 0 ||
      candidate.body.length > 300 ||
      !["INSTITUTION_ANNOUNCEMENT", "CLASS_ACTIVITY"].includes(String(candidate.template)) ||
      !["INSTITUTION", "CLASS"].includes(String(candidate.target)) ||
      typeof candidate.classId !== "string" ||
      !UUID.test(candidate.classId) ||
      !session.classIds.includes(candidate.classId) ||
      candidate.requiresAcknowledgment !== true ||
      typeof candidate.authorId !== "string" ||
      !UUID.test(candidate.authorId) ||
      typeof candidate.authorLabel !== "string" ||
      candidate.authorLabel.length === 0 ||
      candidate.authorLabel.length > 120 ||
      typeof candidate.updatedAt !== "string" ||
      !Number.isFinite(Date.parse(candidate.updatedAt)) ||
      new Date(candidate.updatedAt).toISOString() !== candidate.updatedAt ||
      candidate.receiptStatus !== "UNREAD" ||
      (queue && candidate.status !== "SUBMITTED")
    )
      throw new Error("通知超出当前负责人班级范围或数据格式不正确，已停止显示。");
    ids.add(candidate.id);
    return {
      id: candidate.id,
      version: Number(candidate.version),
      status: candidate.status as NoticeStatus,
      published: candidate.published,
      title: candidate.title,
      body: candidate.body,
      target: candidate.target as NoticeRow["target"],
      classId: candidate.classId,
      requiresAcknowledgment: true,
      template: candidate.template as NoticeRow["template"],
      authorId: candidate.authorId,
      authorLabel: candidate.authorLabel,
      updatedAt: candidate.updatedAt,
    };
  });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "本机共享服务暂时不可用，请稍后刷新。";
}

export function renderAdminNoticeReview(snapshot: NoticeReviewSnapshot, editable = true): string {
  const renderRow = (row: NoticeRow) => {
    let controls = "";
    if (editable && row.status === "SUBMITTED")
      controls = `<div class="actions"><button type="button" class="publish" data-notice-action="CONFIRM" data-notice-id="${escape(row.id)}" data-notice-version="${row.version}">确认通过</button><button type="button" class="save" data-notice-action="RETURN" data-notice-id="${escape(row.id)}" data-notice-version="${row.version}">退回修改</button></div>`;
    else if (editable && row.status === "CONFIRMED")
      controls = `<div class="actions"><button type="button" class="publish" data-notice-action="PUBLISH" data-notice-id="${escape(row.id)}" data-notice-version="${row.version}">发布给家长</button></div>`;
    else if (editable && row.status === "PUBLISHED")
      controls = `<div class="actions"><button type="button" class="save" data-notice-action="REVOKE" data-notice-id="${escape(row.id)}" data-notice-version="${row.version}">撤回发布</button></div>`;
    return `<article class="panel" data-notice-row="${escape(row.id)}"><div class="heading-row"><h3>${TEMPLATE_LABEL[row.template]} · ${STATUS_LABEL[row.status]}</h3><span class="status">第 ${row.version} 版</span></div><p>提交人：${escape(row.authorLabel)} · ${row.target === "CLASS" ? "班级通知" : "机构公告"}</p><h4>${escape(row.title)}</h4><p>${escape(row.body)}</p><p>家长需单独打开并确认；发布只更新本机合成数据。</p>${controls}</article>`;
  };
  const queue =
    snapshot.queue.map(renderRow).join("") || '<p class="notice">当前授权范围暂无待审核通知。</p>';
  const historyRows = snapshot.history
    .filter((row) => row.status !== "SUBMITTED")
    .map((row) => {
      return renderRow(row);
    })
    .join("");
  const history =
    snapshot.status === "CONNECTING"
      ? '<p class="notice">正在读取当前校区的通知…</p>'
      : snapshot.status === "ERROR"
        ? '<p class="notice">请检查本机共享服务后刷新；无效数据不会显示。</p>'
        : historyRows || '<p class="notice">暂无已审核通知。</p>';
  const session = snapshot.session;
  return `<div class="shell"><header class="topbar"><strong>机构管理工作台 · 通知审核</strong><span>${session ? `${escape(session.label)} · 当前授权校区` : "负责人审核"}</span><a href="/admin/institution">返回管理首页</a></header><main><section class="panel"><p class="eyebrow">通知协作 · 本机共享数据</p><h1>通知审核与发布</h1><p>只审核固定模板；发布后家长可查看，并需单独确认。这里不发送真实通知。</p>${session ? `<p>当前范围：当前机构 · 当前校区 · ${session.classIds.length} 个授权班级</p>` : ""}<button type="button" class="save" data-notice-refresh${snapshot.status === "CONNECTING" ? " disabled" : ""}>刷新通知</button><p id="notice-review-feedback" class="notice" role="status" aria-live="polite">${escape(snapshot.message)}</p></section><section class="panel"><h2>待审核通知</h2>${snapshot.status === "READY" ? queue : history}</section><section class="panel"><h2>已处理记录</h2>${history}</section><footer>仅本机合成数据，不代表通知已发送至真实家长。</footer></main></div>`;
}

export class NoticeReviewClient {
  private handle: string | null = null;
  private generation = 0;
  private state: NoticeReviewSnapshot = {
    status: "IDLE",
    session: null,
    queue: [],
    history: [],
    message: "连接本机共享服务后查看通知审核队列。",
  };

  constructor(private readonly transport: typeof fetch = createLocalNoticeReviewTransport()) {}

  get snapshot(): NoticeReviewSnapshot {
    return structuredClone(this.state);
  }

  disconnect(message = "尚未连接本机共享服务。"): void {
    this.generation += 1;
    this.handle = null;
    this.state = {
      status: "IDLE",
      session: null,
      queue: [],
      history: [],
      message,
    };
  }

  private async request(path: string, method = "GET", body?: object): Promise<unknown> {
    if (!allowedRequest(path, method)) throw new Error("通知审核请求不在本机白名单内。");
    const response = await this.transport(path, {
      method,
      credentials: "omit",
      cache: "no-store",
      redirect: "error",
      headers: {
        Accept: "application/json",
        ...(this.handle ? { Authorization: `Bearer ${this.handle}` } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok)
      throw new Error(
        response.status === 409
          ? "通知状态已变化，请刷新后再操作。"
          : response.status === 403
            ? "当前身份无权审核此通知。"
            : "本机共享服务暂时不可用，请稍后刷新。",
      );
    return response.json();
  }

  async connect(): Promise<void> {
    const generation = ++this.generation;
    this.handle = null;
    this.state = {
      status: "CONNECTING",
      session: null,
      queue: [],
      history: [],
      message: "正在连接本机共享服务…",
    };
    try {
      const value = await this.request("/local/sessions", "POST", {
        profile: "owner-east",
      });
      if (!object(value) || typeof value.handle !== "string" || !/^[\w-]{43}$/u.test(value.handle))
        throw new Error("本机登录状态无效，已停止显示通知。");
      this.handle = value.handle;
      await this.refresh(generation);
    } catch (error) {
      if (generation === this.generation)
        this.state = {
          status: "ERROR",
          session: null,
          queue: [],
          history: [],
          message: errorMessage(error),
        };
    }
  }

  async refresh(generation = this.generation): Promise<void> {
    if (!this.handle) {
      await this.connect();
      return;
    }
    try {
      const session = parseSession(await this.request("/local/session"));
      const [queueValue, historyValue] = await Promise.all([
        this.request("/local/notice-review"),
        this.request("/local/notice-owned"),
      ]);
      const queue = parseRows(queueValue, session, true);
      const history = parseRows(historyValue, session, false);
      if (
        queue.some(
          (row) =>
            !history.some((record) => record.id === row.id && record.version === row.version),
        )
      )
        throw new Error("通知审核列表与记录版本不一致，已停止显示。");
      if (generation !== this.generation) return;
      this.state = {
        status: "READY",
        session,
        queue,
        history,
        message: "通知已更新；发布后家长需自行查看并确认。",
      };
    } catch (error) {
      if (generation === this.generation)
        this.state = {
          ...this.state,
          status: "ERROR",
          session: null,
          queue: [],
          history: [],
          message: errorMessage(error),
        };
    }
  }

  async command(id: string, version: number, action: NoticeReviewAction): Promise<void> {
    const row = this.state.history.find((candidate) => candidate.id === id);
    const validAction =
      row !== undefined &&
      row.version === version &&
      (((action === "CONFIRM" || action === "RETURN") && row.status === "SUBMITTED") ||
        (action === "PUBLISH" && row.status === "CONFIRMED") ||
        (action === "REVOKE" && row.status === "PUBLISHED"));
    if (this.state.status !== "READY" || !this.handle || !validAction) {
      this.state = {
        ...this.state,
        message: "通知已变化或当前状态不能执行此操作，请刷新后重试。",
      };
      return;
    }
    const scope = this.state.session;
    if (
      !scope?.actions.includes(
        `notice:${action === "CONFIRM" || action === "RETURN" ? "review" : action.toLowerCase()}`,
      )
    ) {
      this.state = { ...this.state, message: "当前身份无权执行此通知操作。" };
      return;
    }
    const method = action === "CONFIRM" || action === "RETURN" ? "review" : action.toLowerCase();
    const body = action === "CONFIRM" || action === "RETURN" ? { version, action } : { version };
    try {
      await this.request(`/local/notices/${id}/${method}`, "POST", body);
      await this.refresh();
      if (this.state.status === "READY")
        this.state = {
          ...this.state,
          message: `${STATUS_LABEL[this.state.history.find((item) => item.id === id)?.status ?? "DRAFT"]}；记录版本已更新。`,
        };
    } catch (error) {
      const message = errorMessage(error);
      await this.refresh();
      if (this.state.status === "READY") this.state = { ...this.state, message };
      else this.state = { ...this.state, message };
    }
  }
}
