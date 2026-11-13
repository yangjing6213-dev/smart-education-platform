export type InviteRole = "PARENT" | "STAFF";
export type InviteSessionStatus = "SIGNED_OUT" | "CHECKING" | "BUSY" | "READY" | "ERROR";

export type InviteSessionSnapshot = {
  readonly status: InviteSessionStatus;
  readonly displayName: string;
  readonly roles: readonly InviteRole[];
  readonly canWriteCareRecords: boolean;
  readonly canReadMonthlyFeedback: boolean;
  readonly message: string;
};

export type StoredInviteSession = {
  readonly accessToken: string;
  readonly expiresAt: string;
};

export type InviteRequestOptions = {
  readonly method: "GET" | "POST" | "PATCH";
  readonly headers: Readonly<Record<string, string>>;
  readonly data?: unknown;
};

export type InviteRequestResult = {
  readonly statusCode: number;
  readonly data: unknown;
};

export type InviteRequest = (
  url: string,
  options: InviteRequestOptions,
) => Promise<InviteRequestResult>;

export type InviteSessionStore = {
  readonly load: () => unknown;
  readonly save: (session: StoredInviteSession) => void;
  readonly clear: () => void;
};

type InviteSessionOptions = {
  readonly baseUrl: string;
  readonly allowLocalHttp: boolean;
  readonly request: InviteRequest;
  readonly sessionStore: InviteSessionStore;
};

type Identity = {
  readonly displayName: string;
  readonly roles: readonly InviteRole[];
  readonly canWriteCareRecords: boolean;
  readonly canReadMonthlyFeedback: boolean;
};

const TOKEN = /^[A-Za-z0-9_-]{40,160}$/u;
// Shared only for this process. Never use an uncleared logout credential for authorization again.
const unclearedLogouts = new Set<string>();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const PARENT_CAPABILITIES = ["binding:apply", "care:read", "leave:apply", "leave:read"];
const STAFF_CAPABILITIES = [
  "task:read",
  "care:write",
  "care:review",
  "binding:review",
  "leave:review",
  "daily:read",
  "feedback:read",
];

const signedOut = (message = "使用机构邀请的账号登录。"): InviteSessionSnapshot => ({
  status: "SIGNED_OUT",
  displayName: "",
  roles: [],
  canWriteCareRecords: false,
  canReadMonthlyFeedback: false,
  message,
});

function storageLogoutWarning(): InviteSessionSnapshot {
  return {
    ...signedOut(
      "本次运行已停止访问，无法确认本机登录凭据已清除。重启后可能恢复登录，请先清理小程序缓存。",
    ),
    status: "ERROR",
  };
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function origin(value: string, allowLocalHttp: boolean): string | null {
  if (!value.trim()) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("账号服务地址无效。");
  }
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("账号服务地址必须是单独的 HTTPS 网站地址。");
  }
  if (url.protocol === "https:") return url.origin;
  if (allowLocalHttp && url.protocol === "http:" && url.hostname === "127.0.0.1" && !!url.port)
    return url.origin;
  throw new Error("账号服务必须使用 HTTPS；开发版仅可明确启用本机 127.0.0.1。");
}

function storedSession(value: unknown): value is StoredInviteSession {
  return (
    object(value) &&
    typeof value.accessToken === "string" &&
    TOKEN.test(value.accessToken) &&
    typeof value.expiresAt === "string" &&
    Number.isFinite(Date.parse(value.expiresAt))
  );
}

function payload(value: unknown): unknown {
  return object(value) && "data" in value ? value.data : undefined;
}

function identity(value: unknown): Identity {
  if (
    !object(value) ||
    typeof value.actor_id !== "string" ||
    !UUID.test(value.actor_id) ||
    typeof value.display_name !== "string" ||
    !value.display_name.trim() ||
    value.display_name.length > 120 ||
    UUID.test(value.display_name) ||
    !Array.isArray(value.memberships)
  )
    throw new Error("账号信息格式不正确。");

  const memberships = value.memberships.filter(
    (membership): membership is Record<string, unknown> =>
      object(membership) &&
      membership.status === "ACTIVE" &&
      Array.isArray(membership.capabilities),
  );
  const roles: InviteRole[] = [];
  if (
    memberships.some((membership) =>
      PARENT_CAPABILITIES.some((capability) =>
        (membership.capabilities as unknown[]).includes(capability),
      ),
    )
  )
    roles.push("PARENT");
  if (
    memberships.some((membership) =>
      STAFF_CAPABILITIES.some((capability) =>
        (membership.capabilities as unknown[]).includes(capability),
      ),
    )
  )
    roles.push("STAFF");
  if (!roles.length)
    throw Object.assign(new Error("当前账号尚未开通可用服务。"), { statusCode: 403 });
  return {
    displayName: value.display_name,
    roles,
    canWriteCareRecords: memberships.some((membership) =>
      (membership.capabilities as unknown[]).includes("care:write"),
    ),
    canReadMonthlyFeedback: memberships.some((membership) =>
      (membership.capabilities as unknown[]).includes("feedback:read"),
    ),
  };
}

function serviceMessage(statusCode: number | undefined): string {
  if (statusCode === 401) return "账号或密码不正确，或登录状态已过期。";
  if (statusCode === 403) return "当前账号尚未开通可用服务，请联系机构负责人。";
  if (statusCode === 503) return "账号服务尚未配置，当前可以先浏览访客首页。";
  return "账号服务暂时无法连接，请稍后重试。";
}

export class InviteSession {
  private readonly baseUrl: string | null;
  private readonly request: InviteRequest;
  private readonly sessionStore: InviteSessionStore;
  private credential: StoredInviteSession | null = null;
  private current: InviteSessionSnapshot = signedOut();
  private busy = false;

  public constructor(options: InviteSessionOptions) {
    this.baseUrl = origin(options.baseUrl, options.allowLocalHttp);
    this.request = options.request;
    this.sessionStore = options.sessionStore;
  }

  public get snapshot(): InviteSessionSnapshot {
    if (this.current.status === "READY") this.matchesStorage(this.credential);
    return this.current;
  }

  private logoutKey(token: string): string {
    return `${this.baseUrl}\n${token}`;
  }

  // A different page or session instance may have replaced or removed the saved account.
  // Discard this instance's authority without clearing or verifying the replacement implicitly.
  private matchesStorage(expected: StoredInviteSession | null): boolean {
    let saved: unknown;
    try {
      saved = this.sessionStore.load();
    } catch {
      this.credential = null;
      this.current = { ...signedOut("登录状态暂时无法读取，请重试。"), status: "ERROR" };
      return false;
    }
    if (expected === null && (saved === null || saved === undefined || saved === "")) return true;
    const valid = storedSession(saved) && Date.parse(saved.expiresAt) > Date.now() ? saved : null;
    if (valid && unclearedLogouts.has(this.logoutKey(valid.accessToken))) {
      // A deliberate fresh login may replace the unremovable storage entry.
      if (expected === null) return true;
      this.credential = null;
      this.current = storageLogoutWarning();
      return false;
    }
    if (
      valid &&
      expected &&
      valid.accessToken === expected.accessToken &&
      valid.expiresAt === expected.expiresAt
    )
      return true;
    this.credential = null;
    this.current = valid
      ? { ...signedOut("账号已变化，请重新核对登录状态。"), status: "ERROR" }
      : signedOut("登录已过期或已退出，请重新登录。");
    return false;
  }

  private clearStoredSession(): void {
    this.credential = null;
    try {
      this.sessionStore.clear();
    } catch {
      // Do not expose storage errors or retain the in-memory bearer token.
    }
  }

  private async send(
    path: string,
    options: {
      readonly method: "GET" | "POST" | "PATCH";
      readonly data?: unknown;
      readonly accessToken?: string;
    },
  ): Promise<unknown> {
    if (!this.baseUrl)
      throw Object.assign(new Error("账号服务地址尚未配置。"), { statusCode: 503 });
    const headers: Record<string, string> = { Accept: "application/json" };
    if (options.data !== undefined) headers["Content-Type"] = "application/json";
    if (options.accessToken) headers.Authorization = `Bearer ${options.accessToken}`;
    const response = await this.request(new URL(path, this.baseUrl).toString(), {
      method: options.method,
      headers,
      ...(options.data === undefined ? {} : { data: options.data }),
    });
    if (
      !Number.isInteger(response.statusCode) ||
      response.statusCode < 200 ||
      response.statusCode >= 300
    ) {
      throw Object.assign(new Error("账号服务未完成请求。"), { statusCode: response.statusCode });
    }
    const data = payload(response.data);
    if (data === undefined) throw new Error("账号服务响应格式不正确。");
    return data;
  }

  private async authenticated(
    path: string,
    method: InviteRequestOptions["method"],
    data?: unknown,
  ): Promise<unknown> {
    if (!/^\/(?!\/)[A-Za-z0-9/_-]+$/u.test(path)) throw new Error("接口路径无效。");
    const before = this.snapshot;
    const credential = this.credential;
    if (before.status !== "READY" || !credential) throw new Error("请先登录后再使用此服务。");
    try {
      const result = await this.send(path, { method, data, accessToken: credential.accessToken });
      if (this.snapshot !== before) throw new Error("登录状态已变化，请重新读取。");
      return result;
    } catch (cause) {
      if (
        object(cause) &&
        cause.statusCode === 401 &&
        this.credential?.accessToken === credential.accessToken &&
        this.credential.expiresAt === credential.expiresAt &&
        this.matchesStorage(credential)
      ) {
        this.clearStoredSession();
        this.current = signedOut("登录已过期，请重新登录。");
      }
      throw cause;
    }
  }

  public getAuthenticated(path: string): Promise<unknown> {
    return this.authenticated(path, "GET");
  }

  public postAuthenticated(path: string, data: unknown): Promise<unknown> {
    return this.authenticated(path, "POST", data);
  }

  public patchAuthenticated(path: string, data: unknown): Promise<unknown> {
    return this.authenticated(path, "PATCH", data);
  }

  private async readIdentity(accessToken: string): Promise<Identity> {
    return identity(await this.send("/me", { method: "GET", accessToken }));
  }

  public async login(username: string, password: string): Promise<InviteSessionSnapshot> {
    if (this.busy) return this.current;
    this.clearStoredSession();
    if (
      username.trim().length < 3 ||
      username.trim().length > 64 ||
      !password ||
      password.length > 128
    ) {
      this.current = { ...signedOut("请填写受邀账号和密码。"), status: "ERROR" };
      return this.current;
    }
    this.busy = true;
    this.current = { ...signedOut("正在核对受邀账号…"), status: "BUSY" };
    try {
      const result = await this.send("/identity/login", {
        method: "POST",
        data: { username: username.trim(), password },
      });
      if (
        !object(result) ||
        typeof result.access_token !== "string" ||
        !TOKEN.test(result.access_token) ||
        result.token_type !== "Bearer" ||
        typeof result.expires_at !== "string" ||
        !Number.isFinite(Date.parse(result.expires_at)) ||
        Date.parse(result.expires_at) <= Date.now()
      )
        throw new Error("账号服务响应格式不正确。");
      const accessToken = result.access_token;
      const expiresAt = result.expires_at;
      if (unclearedLogouts.has(this.logoutKey(accessToken))) {
        this.current = storageLogoutWarning();
        return this.current;
      }
      const verified = await this.readIdentity(accessToken);
      if (!this.matchesStorage(null)) return this.current;
      if (Date.parse(expiresAt) <= Date.now())
        throw Object.assign(new Error("登录已过期。"), { statusCode: 401 });
      const credential = { accessToken, expiresAt };
      try {
        this.sessionStore.save(credential);
      } catch (cause) {
        if (this.matchesStorage(credential)) this.clearStoredSession();
        throw cause;
      }
      this.credential = credential;
      this.current = {
        status: "READY",
        displayName: verified.displayName,
        roles: verified.roles,
        canWriteCareRecords: verified.canWriteCareRecords,
        canReadMonthlyFeedback: verified.canReadMonthlyFeedback,
        message: "账号已确认，可用服务按机构授权范围显示。",
      };
    } catch (cause) {
      if (!this.matchesStorage(null)) return this.current;
      const statusCode =
        object(cause) && typeof cause.statusCode === "number" ? cause.statusCode : undefined;
      this.current = { ...signedOut(serviceMessage(statusCode)), status: "ERROR" };
    } finally {
      this.busy = false;
    }
    return this.current;
  }

  public async restore(): Promise<InviteSessionSnapshot> {
    if (this.busy) return this.current;
    let stored: unknown;
    try {
      stored = this.sessionStore.load();
    } catch {
      this.credential = null;
      this.current = { ...signedOut("登录状态暂时无法读取，请重新登录。"), status: "ERROR" };
      return this.current;
    }
    if (stored === null || stored === undefined || stored === "") {
      this.credential = null;
      this.current = signedOut();
      return this.current;
    }
    if (!storedSession(stored) || Date.parse(stored.expiresAt) <= Date.now()) {
      this.clearStoredSession();
      this.current = signedOut("登录已过期，请重新登录。");
      return this.current;
    }
    if (unclearedLogouts.has(this.logoutKey(stored.accessToken))) {
      this.credential = null;
      this.current = storageLogoutWarning();
      return this.current;
    }
    this.busy = true;
    const expected = { accessToken: stored.accessToken, expiresAt: stored.expiresAt };
    this.credential = expected;
    this.current = { ...signedOut("正在核对登录状态…"), status: "CHECKING" };
    try {
      const verified = await this.readIdentity(expected.accessToken);
      if (!this.matchesStorage(expected)) return this.current;
      this.current = {
        status: "READY",
        displayName: verified.displayName,
        roles: verified.roles,
        canWriteCareRecords: verified.canWriteCareRecords,
        canReadMonthlyFeedback: verified.canReadMonthlyFeedback,
        message: "已登录，账号权限由机构统一管理。",
      };
    } catch (cause) {
      if (!this.matchesStorage(expected)) return this.current;
      const statusCode =
        object(cause) && typeof cause.statusCode === "number" ? cause.statusCode : undefined;
      if (statusCode === 401 || statusCode === 403) {
        this.clearStoredSession();
        this.current = signedOut("登录已过期或服务权限已变化，请重新登录。");
      } else {
        this.current = { ...signedOut(serviceMessage(statusCode)), status: "ERROR" };
      }
    } finally {
      this.busy = false;
    }
    return this.current;
  }

  public async logout(): Promise<InviteSessionSnapshot> {
    const credential = this.credential;
    if (this.busy && this.current.status !== "CHECKING") return this.current;
    if (!this.matchesStorage(credential)) return this.current;
    this.clearStoredSession();
    let removed = false;
    try {
      const saved = this.sessionStore.load();
      removed =
        !storedSession(saved) ||
        (credential
          ? saved.accessToken !== credential.accessToken
          : !unclearedLogouts.has(this.logoutKey(saved.accessToken)));
    } catch {
      // An unreadable store cannot confirm local deletion.
    }
    if (!removed && credential) unclearedLogouts.add(this.logoutKey(credential.accessToken));
    const ended = removed
      ? signedOut(credential ? "本机登录已清除；服务器会话可能保留至到期。" : "已退出登录。")
      : storageLogoutWarning();
    this.current = ended;
    try {
      if (credential) {
        await this.send("/identity/logout", {
          method: "POST",
          accessToken: credential.accessToken,
        });
        if (this.current === ended && removed) this.current = signedOut("已退出登录。");
      }
    } catch {
      // Local access has already ended even if the server cannot confirm logout.
    }
    return this.current;
  }
}
