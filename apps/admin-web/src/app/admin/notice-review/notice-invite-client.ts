export type NoticeStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "RETURNED"
  | "APPROVED"
  | "PUBLISHED"
  | "REVOKED";

export type AdminNotice = Readonly<{
  id: string;
  templateCode: "INSTITUTION_ANNOUNCEMENT" | "CLASS_ACTIVITY";
  target: "INSTITUTION" | "CLASS";
  status: NoticeStatus;
  version: number;
  published: boolean;
  createdAt: string;
  updatedAt: string;
  title: string;
  body: string;
  synthetic: true;
}>;

export type NoticeInviteSnapshot = Readonly<{
  status: "IDLE" | "CHECKING" | "BUSY" | "READY" | "UNAUTHENTICATED" | "FORBIDDEN" | "ERROR";
  displayName: string;
  canPublish: boolean;
  canRevoke: boolean;
  notices: readonly AdminNotice[];
  message: string;
}>;

type ClientOptions = Readonly<{ fetcher?: typeof fetch }>;
type JsonRecord = Record<string, unknown>;
type ApiFailure = Error & Readonly<{ status: number }>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const FIELDS = [
  "id",
  "templateCode",
  "target",
  "status",
  "version",
  "published",
  "createdAt",
  "updatedAt",
  "title",
  "body",
  "synthetic",
] as const;
const STATUSES = ["DRAFT", "SUBMITTED", "RETURNED", "APPROVED", "PUBLISHED", "REVOKED"] as const;
const TEMPLATES = {
  INSTITUTION_ANNOUNCEMENT: {
    target: "INSTITUTION",
    title: "机构公告",
    body: "校区发布了新的服务安排，请家长查看页面内更新。",
  },
  CLASS_ACTIVITY: {
    target: "CLASS",
    title: "班级活动",
    body: "班级近期有活动安排，请家长查看并留意相关时间。",
  },
} as const;
const EMPTY: NoticeInviteSnapshot = {
  status: "IDLE",
  displayName: "",
  canPublish: false,
  canRevoke: false,
  notices: [],
  message: "请使用机构邀请账号登录。",
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function failure(status: number, message: string): ApiFailure {
  return Object.assign(new Error(message), { status });
}

function isIsoDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value
  );
}

function parseIdentity(value: unknown): {
  readonly displayName: string;
  readonly canPublish: boolean;
  readonly canRevoke: boolean;
} {
  if (
    !isRecord(value) ||
    typeof value.display_name !== "string" ||
    !value.display_name.trim() ||
    value.display_name.length > 120 ||
    !Array.isArray(value.memberships)
  )
    throw failure(502, "账号权限信息暂不可用，请稍后重试。");

  const active = value.memberships.filter(
    (membership) => isRecord(membership) && membership.status === "ACTIVE",
  );
  if (
    active.length !== 1 ||
    !isRecord(active[0]) ||
    !Array.isArray(active[0].capabilities) ||
    !active[0].capabilities.every((capability) => typeof capability === "string")
  )
    throw failure(403, "当前账号没有单一有效校区的通知审核权限。");

  const capabilities = new Set(active[0].capabilities as string[]);
  if (!capabilities.has("notice:review"))
    throw failure(403, "当前账号没有通知审核权限，通知内容已隐藏。");
  return {
    displayName: value.display_name,
    canPublish: capabilities.has("notice:publish"),
    canRevoke: capabilities.has("notice:revoke"),
  };
}

function parseNotice(value: unknown): AdminNotice {
  if (
    !isRecord(value) ||
    Object.keys(value).length !== FIELDS.length ||
    !FIELDS.every((field) => Object.hasOwn(value, field)) ||
    typeof value.id !== "string" ||
    !UUID.test(value.id) ||
    typeof value.templateCode !== "string" ||
    !(value.templateCode in TEMPLATES) ||
    !STATUSES.includes(value.status as (typeof STATUSES)[number]) ||
    !Number.isSafeInteger(value.version) ||
    Number(value.version) < 1 ||
    typeof value.published !== "boolean" ||
    (value.status === "PUBLISHED") !== value.published ||
    !isIsoDate(value.createdAt) ||
    !isIsoDate(value.updatedAt) ||
    value.synthetic !== true
  )
    throw failure(502, "通知内容格式不正确，已隐藏当前列表。");

  const template = TEMPLATES[value.templateCode as keyof typeof TEMPLATES];
  if (
    value.target !== template.target ||
    value.title !== template.title ||
    value.body !== template.body
  )
    throw failure(502, "通知模板内容与服务端约定不一致，已隐藏当前列表。");

  return {
    id: value.id,
    templateCode: value.templateCode as AdminNotice["templateCode"],
    target: template.target,
    status: value.status as NoticeStatus,
    version: Number(value.version),
    published: value.published,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    title: template.title,
    body: template.body,
    synthetic: true,
  };
}

function parseNoticeList(value: unknown): AdminNotice[] {
  if (!Array.isArray(value) || value.length > 500)
    throw failure(502, "通知列表暂不可用，请稍后重试。");
  const notices = value.map(parseNotice);
  if (new Set(notices.map(({ id }) => id)).size !== notices.length)
    throw failure(502, "通知列表暂不可用，请稍后重试。");
  return notices;
}

export class NoticeInviteClient {
  private value: NoticeInviteSnapshot = EMPTY;
  private readonly fetcher: typeof fetch;
  private generation = 0;
  private busy = false;

  public constructor(options: ClientOptions = {}) {
    this.fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
  }

  public get snapshot(): NoticeInviteSnapshot {
    return this.value;
  }

  public async connect(): Promise<void> {
    if (this.busy) return;
    const generation = ++this.generation;
    this.busy = true;
    this.value = { ...EMPTY, status: "CHECKING", message: "正在确认邀请账号权限…" };
    try {
      const identity = parseIdentity(await this.request("/me"));
      if (generation !== this.generation) return;
      this.value = {
        ...this.value,
        displayName: identity.displayName,
        canPublish: identity.canPublish,
        canRevoke: identity.canRevoke,
        message: "正在读取当前授权范围内的通知…",
      };
      await this.load(generation, "通知列表已更新。", identity);
    } catch (cause) {
      if (generation === this.generation) this.fail(cause);
    } finally {
      if (generation === this.generation) this.busy = false;
    }
  }

  public async refresh(): Promise<void> {
    if (this.busy) return;
    if (this.value.status !== "READY") {
      await this.connect();
      return;
    }
    const generation = this.generation;
    const identity = {
      displayName: this.value.displayName,
      canPublish: this.value.canPublish,
      canRevoke: this.value.canRevoke,
    };
    this.busy = true;
    this.value = { ...this.value, status: "BUSY", notices: [], message: "正在刷新通知…" };
    try {
      await this.load(generation, "通知列表已更新。", identity);
    } catch (cause) {
      if (generation === this.generation) this.fail(cause);
    } finally {
      if (generation === this.generation) this.busy = false;
    }
  }

  public async review(id: string, version: number, action: "APPROVE" | "RETURN"): Promise<void> {
    const message =
      action === "APPROVE"
        ? "通知已审核通过，可由有发布权限的员工单独发布。"
        : "通知已退回，提交人可修改后重新提交。";
    await this.mutate(id, version, "review", { version, action }, "SUBMITTED", message);
  }

  public async publish(id: string, version: number): Promise<void> {
    await this.mutate(
      id,
      version,
      "publish",
      { version },
      "APPROVED",
      "通知已发布，家长打开页面后可查看。",
    );
  }

  public async revoke(id: string, version: number): Promise<void> {
    await this.mutate(id, version, "revoke", { version }, "PUBLISHED", "通知已撤回。");
  }

  public disconnect(): void {
    this.generation += 1;
    this.busy = false;
    this.value = EMPTY;
  }

  private async mutate(
    id: string,
    version: number,
    action: "review" | "publish" | "revoke",
    body: JsonRecord,
    expectedStatus: NoticeStatus,
    message: string,
  ): Promise<void> {
    if (
      this.busy ||
      this.value.status !== "READY" ||
      !UUID.test(id) ||
      !Number.isSafeInteger(version) ||
      version < 1 ||
      (action === "publish" && !this.value.canPublish) ||
      (action === "revoke" && !this.value.canRevoke)
    )
      return;

    const notice = this.value.notices.find((candidate) => candidate.id === id);
    if (!notice || notice.version !== version || notice.status !== expectedStatus) {
      this.value = { ...this.value, message: "通知状态或版本已变化，请刷新后重试。" };
      return;
    }

    const generation = this.generation;
    const identity = {
      displayName: this.value.displayName,
      canPublish: this.value.canPublish,
      canRevoke: this.value.canRevoke,
    };
    this.busy = true;
    this.value = { ...this.value, status: "BUSY", notices: [], message: "正在保存通知处理结果…" };
    try {
      const result = parseNotice(
        await this.request(`/staff/notices/${id}/${action}`, { method: "POST", body }),
      );
      const expectedResult: Record<string, NoticeStatus> = {
        review: body.action === "APPROVE" ? "APPROVED" : "RETURNED",
        publish: "PUBLISHED",
        revoke: "REVOKED",
      };
      if (result.id !== id || result.version !== version + 1 || result.status !== expectedResult[action])
        throw failure(502, "通知处理结果与提交内容不一致，已隐藏当前列表。");
      if (generation !== this.generation) return;
      await this.load(generation, message, identity);
    } catch (cause) {
      if (generation === this.generation) this.fail(cause);
    } finally {
      if (generation === this.generation) this.busy = false;
    }
  }

  private async load(
    generation: number,
    message: string,
    identity: { readonly displayName: string; readonly canPublish: boolean; readonly canRevoke: boolean },
  ): Promise<void> {
    const rows = parseNoticeList(await this.request("/staff/notices/review"));
    if (generation !== this.generation) return;
    const notices = rows.filter(
      (notice) =>
        notice.status === "SUBMITTED" ||
        (notice.status === "APPROVED" && identity.canPublish) ||
        (notice.status === "PUBLISHED" && identity.canRevoke),
    );
    this.value = { status: "READY", ...identity, notices, message };
  }

  private async request(
    path: string,
    init: { readonly method?: string; readonly body?: JsonRecord } = {},
  ): Promise<unknown> {
    const response = await this.fetcher("/api/admin" + path, {
      method: init.method ?? "GET",
      cache: "no-store",
      credentials: "same-origin",
      redirect: "error",
      signal: AbortSignal.timeout(5000),
      headers: {
        accept: "application/json",
        ...(init.body ? { "content-type": "application/json" } : {}),
      },
      ...(init.body ? { body: JSON.stringify(init.body) } : {}),
    });
    const payload: unknown = await response.json().catch(() => undefined);
    if (!response.ok) {
      const status = response.status;
      const message =
        isRecord(payload) && isRecord(payload.error) && typeof payload.error.message === "string"
          ? payload.error.message
          : "通知操作未完成，请刷新后重试。";
      throw failure(status, message);
    }
    if (!isRecord(payload) || !("data" in payload))
      throw failure(502, "管理服务返回内容不完整，请稍后重试。");
    return payload.data;
  }

  private fail(cause: unknown): void {
    const status = isRecord(cause) && typeof cause.status === "number" ? cause.status : 0;
    const message = cause instanceof Error ? cause.message : "暂时无法读取通知，请稍后重试。";
    this.value = {
      ...EMPTY,
      status: status === 401 ? "UNAUTHENTICATED" : status === 403 ? "FORBIDDEN" : "ERROR",
      message:
        status === 401
          ? "登录状态已失效，请重新登录。"
          : status === 403
            ? "当前账号没有通知审核权限，通知内容已隐藏。"
            : message,
    };
  }
}
