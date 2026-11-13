export type MediaAssetsProfile =
  "owner-east" | "owner-west" | "platform-admin" | "teacher-east" | "parent-alpha";

export function createLocalMediaTransport(
  servicePort: number | null,
  transport: typeof fetch = fetch.bind(globalThis),
): typeof fetch {
  const validPort =
    Number.isSafeInteger(servicePort) &&
    servicePort !== null &&
    servicePort >= 1 &&
    servicePort <= 65535;
  const origin = validPort ? `http://127.0.0.1:${servicePort}` : null;
  return (input, init) => {
    if (origin === null) return Promise.reject(new Error("本机服务端口无效。"));
    const rawUrl =
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const target = new URL(rawUrl, origin);
    if (target.origin !== origin || !target.pathname.startsWith("/local/"))
      return Promise.reject(new Error("文件管理只允许访问本机合成服务。"));
    return transport(target, init);
  };
}

export const MEDIA_ASSET_PROFILE_OPTIONS: ReadonlyArray<readonly [MediaAssetsProfile, string]> = [
  ["owner-east", "东校区负责人"],
  ["owner-west", "西校区负责人"],
  ["platform-admin", "平台管理员（仅匿名汇总）"],
  ["teacher-east", "东校区教师（无文件管理权限）"],
  ["parent-alpha", "家长（无文件管理权限）"],
];

type MediaAssetStatus = "AVAILABLE" | "REFERENCED" | "EXPIRED" | "ARCHIVED" | "REVOKED" | "DELETED";

export interface MediaAssetRow {
  readonly id: string;
  readonly alias: string;
  readonly title: string;
  readonly version: number;
  readonly type: "IMAGE" | "DOCUMENT";
  readonly status: MediaAssetStatus;
  readonly expiresOn: string;
  readonly references: readonly {
    readonly id: string;
    readonly label: string;
    readonly kind: "TEACHER_INTRO" | "FAMILY_GUIDE" | "ACTIVITY";
  }[];
}

export interface MediaAssetEventRow {
  readonly id: string;
  readonly actorProfile: string;
  readonly assetAlias: string;
  readonly action: string;
  readonly outcome: string;
  readonly occurredAt: string;
}

export interface MediaAssetSummaryRow {
  readonly total: number;
  readonly available: number;
  readonly referenced: number;
  readonly expired: number;
  readonly archived: number;
  readonly revoked: number;
  readonly deleted: number;
}

export interface MediaAssetsAdminSnapshot {
  readonly status: "IDLE" | "CONNECTING" | "BUSY" | "READY" | "DENIED" | "ERROR";
  readonly profile: MediaAssetsProfile | null;
  readonly actions: readonly string[];
  readonly assets: readonly MediaAssetRow[];
  readonly events: readonly MediaAssetEventRow[];
  readonly summary: MediaAssetSummaryRow | null;
  readonly message: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const DATE = /^\d{4}-\d{2}-\d{2}$/u;
const STATUS = new Set<MediaAssetStatus>([
  "AVAILABLE",
  "REFERENCED",
  "EXPIRED",
  "ARCHIVED",
  "REVOKED",
  "DELETED",
]);
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown, max = 160): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= max;

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return (
    Object.keys(value).length === keys.length &&
    Object.keys(value).every((key) => keys.includes(key))
  );
}

function parseAsset(value: unknown): MediaAssetRow {
  if (
    !object(value) ||
    !exactKeys(value, [
      "id",
      "alias",
      "title",
      "version",
      "type",
      "status",
      "expiresOn",
      "references",
    ]) ||
    typeof value.id !== "string" ||
    !UUID.test(value.id) ||
    !text(value.alias) ||
    !text(value.title) ||
    !Number.isSafeInteger(value.version) ||
    Number(value.version) < 1 ||
    (value.type !== "IMAGE" && value.type !== "DOCUMENT") ||
    !STATUS.has(value.status as MediaAssetStatus) ||
    typeof value.expiresOn !== "string" ||
    !DATE.test(value.expiresOn) ||
    !Array.isArray(value.references)
  )
    throw new Error("Invalid media metadata");
  const references = value.references.map((reference) => {
    if (
      !object(reference) ||
      !exactKeys(reference, ["id", "label", "kind"]) ||
      typeof reference.id !== "string" ||
      !UUID.test(reference.id) ||
      !text(reference.label) ||
      !["TEACHER_INTRO", "FAMILY_GUIDE", "ACTIVITY"].includes(String(reference.kind))
    )
      throw new Error("Invalid media reference");
    return {
      id: reference.id,
      label: reference.label,
      kind: reference.kind as MediaAssetRow["references"][number]["kind"],
    };
  });
  return {
    id: value.id,
    alias: value.alias,
    title: value.title,
    version: Number(value.version),
    type: value.type,
    status: value.status as MediaAssetStatus,
    expiresOn: value.expiresOn,
    references,
  };
}

function parseAssets(value: unknown): MediaAssetRow[] {
  if (!object(value) || !exactKeys(value, ["assets"]) || !Array.isArray(value.assets))
    throw new Error("Invalid media list");
  return value.assets.map(parseAsset);
}

function parseEvents(value: unknown): MediaAssetEventRow[] {
  if (!Array.isArray(value)) throw new Error("Invalid media audit events");
  return value.map((event) => {
    if (
      !object(event) ||
      !exactKeys(event, ["id", "actorProfile", "assetAlias", "action", "outcome", "occurredAt"]) ||
      typeof event.id !== "string" ||
      !UUID.test(event.id) ||
      !text(event.actorProfile) ||
      !text(event.assetAlias) ||
      !text(event.action) ||
      !text(event.outcome) ||
      !text(event.occurredAt)
    )
      throw new Error("Invalid media audit event");
    return {
      id: event.id,
      actorProfile: event.actorProfile,
      assetAlias: event.assetAlias,
      action: event.action,
      outcome: event.outcome,
      occurredAt: event.occurredAt,
    };
  });
}

function parseSummary(value: unknown): MediaAssetSummaryRow {
  const keys = ["total", "available", "referenced", "expired", "archived", "revoked", "deleted"];
  if (
    !object(value) ||
    !exactKeys(value, keys) ||
    keys.some((key) => !Number.isSafeInteger(value[key]) || Number(value[key]) < 0) ||
    keys.slice(1).reduce((total, key) => total + Number(value[key]), 0) !== Number(value.total)
  )
    throw new Error("Invalid anonymous media summary");
  return Object.fromEntries(
    keys.map((key) => [key, Number(value[key])]),
  ) as unknown as MediaAssetSummaryRow;
}

function isProfile(value: string): value is MediaAssetsProfile {
  return MEDIA_ASSET_PROFILE_OPTIONS.some(([profile]) => profile === value);
}

function messageFor(error: unknown): string {
  const code = error instanceof MediaAssetsRequestError ? error.code : "";
  if (code === "STATE_CONFLICT") return "资料状态或版本已变化，或仍有引用；请刷新后重试。";
  if (code === "UNAVAILABLE") return "当前身份没有权限，或资料不属于当前校区。";
  if (code === "INVALID_REQUEST") return "操作内容无效，请刷新后重试。";
  return "本机文件服务暂不可用，请确认服务已启动后重新连接。";
}

class MediaAssetsRequestError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

export class MediaAssetsAdminClient {
  private state: MediaAssetsAdminSnapshot = {
    status: "IDLE",
    profile: null,
    actions: [],
    assets: [],
    events: [],
    summary: null,
    message: "连接本机合成身份后查看文件引用。",
  };
  private handle: string | null = null;
  private generation = 0;

  constructor(private readonly transport: typeof fetch = fetch.bind(globalThis)) {}

  get snapshot(): MediaAssetsAdminSnapshot {
    return structuredClone(this.state);
  }

  disconnect(): void {
    this.generation += 1;
    this.handle = null;
    this.state = {
      status: "IDLE",
      profile: null,
      actions: [],
      assets: [],
      events: [],
      summary: null,
      message: "当前页面未连接文件服务。",
    };
  }

  private isCurrent(generation: number): boolean {
    return this.generation === generation;
  }

  private async request(path: string, method = "GET", body?: object): Promise<unknown> {
    const response = await this.transport(path, {
      method,
      credentials: "omit",
      cache: "no-store",
      redirect: "error",
      headers: {
        ...(this.handle ? { Authorization: `Bearer ${this.handle}` } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const code =
        object(payload) && object(payload.error) && typeof payload.error.code === "string"
          ? payload.error.code
          : "REQUEST_FAILED";
      throw new MediaAssetsRequestError(code);
    }
    return payload;
  }

  private async load(generation: number): Promise<void> {
    if (!this.isCurrent(generation)) return;
    if (!this.handle || !this.state.profile) throw new MediaAssetsRequestError("UNAVAILABLE");
    if (this.state.profile === "platform-admin") {
      const summary = await this.request("/local/media-asset-summary");
      if (!this.isCurrent(generation)) return;
      this.state = {
        ...this.state,
        summary: parseSummary(summary),
        assets: [],
        events: [],
      };
      return;
    }
    const [assets, events] = await Promise.all([
      this.request("/local/media-assets"),
      this.request("/local/media-asset-events"),
    ]);
    if (!this.isCurrent(generation)) return;
    this.state = {
      ...this.state,
      assets: parseAssets(assets),
      events: parseEvents(events),
      summary: null,
    };
  }

  async connect(profile: string): Promise<void> {
    this.disconnect();
    const generation = this.generation;
    if (!isProfile(profile)) {
      this.state = { ...this.state, status: "DENIED", message: "当前本机演示身份不可用。" };
      return;
    }
    this.state = { ...this.state, status: "CONNECTING", profile, message: "正在连接本机文件服务…" };
    try {
      const bootstrap = await this.request("/local/sessions", "POST", { profile });
      if (!this.isCurrent(generation)) return;
      if (
        !object(bootstrap) ||
        typeof bootstrap.handle !== "string" ||
        !/^[-\w]{43}$/u.test(bootstrap.handle)
      )
        throw new Error("Invalid local session");
      this.handle = bootstrap.handle;
      const session = await this.request("/local/session");
      if (!this.isCurrent(generation)) return;
      if (
        !object(session) ||
        session.profile !== profile ||
        !Array.isArray(session.actions) ||
        !session.actions.every((action) => typeof action === "string")
      )
        throw new Error("Invalid local session profile");
      const actions = session.actions as string[];
      const permitted =
        profile === "platform-admin"
          ? actions.includes("media:summary")
          : actions.includes("media:read") || actions.includes("media:manage");
      if (!permitted) {
        this.handle = null;
        this.state = {
          status: "DENIED",
          profile,
          actions,
          assets: [],
          events: [],
          summary: null,
          message: "当前身份无权查看文件资料；平台管理员只可查看匿名汇总。",
        };
        return;
      }
      this.state = {
        ...this.state,
        actions,
        status: "BUSY",
        message: "正在读取当前范围的合成资料…",
      };
      await this.load(generation);
      if (!this.isCurrent(generation)) return;
      this.state = {
        ...this.state,
        status: "READY",
        message: "已加载本机合成资料；没有读取真实文件。",
      };
    } catch (error) {
      if (!this.isCurrent(generation)) return;
      this.handle = null;
      this.state = {
        status: "ERROR",
        profile,
        actions: [],
        assets: [],
        events: [],
        summary: null,
        message: messageFor(error),
      };
    }
  }

  async refresh(): Promise<void> {
    if (!this.handle || !this.state.profile) {
      this.state = { ...this.state, status: "ERROR", message: "请先连接本机合成身份。" };
      return;
    }
    const generation = this.generation;
    this.state = { ...this.state, status: "BUSY", message: "正在刷新本机合成资料…" };
    try {
      await this.load(generation);
      if (!this.isCurrent(generation)) return;
      this.state = { ...this.state, status: "READY", message: "已从本机服务刷新当前状态。" };
    } catch (error) {
      if (!this.isCurrent(generation)) return;
      this.state = { ...this.state, status: "ERROR", message: messageFor(error) };
    }
  }

  private async mutate(path: string, body: object, success: string): Promise<void> {
    if (!this.handle || !this.state.actions.includes("media:manage")) {
      this.state = { ...this.state, status: "DENIED", message: "当前身份不能管理文件引用。" };
      return;
    }
    const generation = this.generation;
    this.state = { ...this.state, status: "BUSY", message: "正在更新本机引用状态…" };
    try {
      await this.request(path, "POST", body);
      if (!this.isCurrent(generation)) return;
      await this.load(generation);
      if (!this.isCurrent(generation)) return;
      this.state = { ...this.state, status: "READY", message: success };
    } catch (error) {
      if (!this.isCurrent(generation)) return;
      this.state = { ...this.state, status: "ERROR", message: messageFor(error) };
    }
  }

  async checkAccess(id: string, version: number): Promise<void> {
    if (!this.handle || !this.state.actions.includes("media:read")) {
      this.state = { ...this.state, status: "DENIED", message: "当前身份不能校验文件查看权限。" };
      return;
    }
    const generation = this.generation;
    this.state = { ...this.state, status: "BUSY", message: "正在本机校验查看权限…" };
    try {
      const result = await this.request(`/local/media-assets/${id}/access-check`, "POST", {
        version,
      });
      if (!this.isCurrent(generation)) return;
      if (!object(result) || typeof result.allowed !== "boolean" || result.recorded !== true) {
        throw new Error("Invalid media access result");
      }
      await this.load(generation);
      if (!this.isCurrent(generation)) return;
      this.state = {
        ...this.state,
        status: "READY",
        message: typeof result.message === "string" ? result.message : "权限校验已记录。",
      };
    } catch (error) {
      if (!this.isCurrent(generation)) return;
      this.state = { ...this.state, status: "ERROR", message: messageFor(error) };
    }
  }

  async replaceReference(
    id: string,
    version: number,
    referenceId: string,
    target: MediaAssetRow,
  ): Promise<void> {
    await this.mutate(
      `/local/media-assets/${id}/replace-reference`,
      { version, referenceId, targetAssetId: target.id, targetVersion: target.version },
      "引用已更换，旧素材保留；没有写入真实文件。",
    );
  }

  async archive(id: string, version: number): Promise<void> {
    await this.mutate(
      `/local/media-assets/${id}/archive`,
      { version },
      "素材已在本机归档。没有删除真实文件。",
    );
  }

  async revoke(id: string, version: number, confirmReferences: boolean): Promise<void> {
    await this.mutate(
      `/local/media-assets/${id}/revoke`,
      { version, confirmReferences },
      "素材已撤回；已保留引用记录并记录本机审计。",
    );
  }

  async softDelete(id: string, version: number): Promise<void> {
    await this.mutate(
      `/local/media-assets/${id}/delete`,
      { version },
      "素材已标记为本机软删除；没有删除实际文件。",
    );
  }
}
