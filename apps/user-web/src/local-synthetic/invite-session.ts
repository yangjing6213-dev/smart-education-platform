export type InviteService = {
  readonly href:
    | "/web/parent/home"
    | "/web/parent/learning"
    | "/web/parent/monthly"
    | "/web/parent/fees"
    | "/web/parent/leave"
    | "/web/parent/binding"
    | "/web/parent/pickup"
    | "/web/staff/leave"
    | "/web/staff/workbench"
    | "/web/staff/binding"
    | "/web/staff/care"
    | "/web/staff/care-review"
    | "/web/staff/daily"
    | "/web/staff/monthly"
    | "/web/staff/child-monthly";
  readonly label: string;
};
export type InviteSessionSnapshot = {
  readonly status: "IDLE" | "CHECKING" | "BUSY" | "READY" | "DENIED" | "ERROR" | "LOGOUT_FAILED";
  readonly displayName: string;
  readonly services: readonly InviteService[];
  readonly message: string;
};
const destinations = [
  { href: "/web/parent/home", label: "成长记录", capabilities: ["care:read"] },
  { href: "/web/parent/learning", label: "学习摘要", capabilities: ["binding:read"] },
  { href: "/web/parent/monthly", label: "月度反馈", capabilities: ["binding:read"] },
  { href: "/web/parent/fees", label: "费用与流水", capabilities: ["binding:read"] },
  {
    href: "/web/parent/leave",
    label: "请假申请",
    capabilities: ["binding:read", "leave:apply", "leave:read"],
  },
  {
    href: "/web/parent/binding",
    label: "关系绑定与授权",
    capabilities: ["binding:apply", "binding:read"],
  },
  {
    href: "/web/parent/pickup",
    label: "接送授权",
    capabilities: ["binding:apply", "binding:read"],
  },
  { href: "/web/staff/leave", label: "请假审核", capabilities: ["leave:review"] },
  { href: "/web/staff/workbench", label: "员工工作台", capabilities: ["task:read"] },
  { href: "/web/staff/binding", label: "关系审核", capabilities: ["binding:review"] },
  { href: "/web/staff/care", label: "成长记录", capabilities: ["care:write"] },
  { href: "/web/staff/care-review", label: "成长记录审核", capabilities: ["care:review"] },
  {
    href: "/web/staff/daily",
    label: "工作日报",
    capabilities: ["daily:read", "daily:create", "daily:submit"],
  },
  { href: "/web/staff/monthly", label: "班级月度总结", capabilities: ["feedback:read"] },
  { href: "/web/staff/child-monthly", label: "孩子个人月报", capabilities: ["feedback:read"] },
] as const;
const empty: InviteSessionSnapshot = {
  status: "IDLE",
  displayName: "",
  services: [],
  message: "使用机构邀请的账号登录。",
};
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const failure = (status: number) => Object.assign(new Error("账号服务未能完成操作。"), { status });

export function inviteNextPath(value: string | null): InviteService["href"] | null {
  return destinations.find((destination) => destination.href === value)?.href ?? null;
}

function webOrigin(value: string): string {
  const url = new URL(value);
  if (
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    !(
      url.protocol === "https:" ||
      (url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname) && !!url.port)
    )
  )
    throw new Error("账号页面需要安全的同源网页地址。");
  return url.origin;
}

export function projectIdentity(
  value: unknown,
): Pick<InviteSessionSnapshot, "displayName" | "services"> {
  if (
    !object(value) ||
    typeof value.actor_id !== "string" ||
    !uuid.test(value.actor_id) ||
    typeof value.display_name !== "string" ||
    !value.display_name.trim() ||
    value.display_name.length > 120 ||
    uuid.test(value.display_name) ||
    !Array.isArray(value.memberships)
  )
    throw failure(502);
  const memberships = value.memberships;
  const services = destinations
    .filter((destination) =>
      memberships.some((membership: unknown) => {
        if (
          !object(membership) ||
          membership.status !== "ACTIVE" ||
          !Array.isArray(membership.capabilities)
        )
          return false;
        const capabilities = membership.capabilities;
        return destination.capabilities.every((capability) => capabilities.includes(capability));
      }),
    )
    .map(({ href, label }) => ({ href, label }));
  if (!services.length) throw failure(403);
  return { displayName: value.display_name, services };
}

export class InviteSessionClient {
  private value: InviteSessionSnapshot = empty;
  private readonly base: string;
  private readonly fetcher: typeof fetch;
  private generation = 0;
  private busy = false;

  constructor(options: { readonly baseUrl: string; readonly fetcher?: typeof fetch }) {
    this.base = webOrigin(options.baseUrl);
    this.fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
  }

  get snapshot(): InviteSessionSnapshot {
    return this.value;
  }

  disconnect(): void {
    this.generation += 1;
    this.busy = false;
    this.value = empty;
  }

  async restore(): Promise<void> {
    if (this.busy) return;
    const generation = ++this.generation;
    this.busy = true;
    this.value = { ...empty, status: "CHECKING", message: "正在核对登录状态…" };
    try {
      const identity = await this.request("/api-local/me");
      if (generation !== this.generation) return;
      this.value = {
        ...projectIdentity(identity),
        status: "READY",
        message: "已登录，请选择已授权的服务。",
      };
    } catch (cause) {
      if (generation !== this.generation) return;
      this.fail(cause, true);
      if (this.value.status === "DENIED") await this.clearCookie();
    } finally {
      if (generation === this.generation) this.busy = false;
    }
  }

  async login(username: string, password: string): Promise<void> {
    if (this.busy) return;
    if (!username.trim() || username.trim().length > 120 || !password || password.length > 1024) {
      this.value = { ...empty, status: "ERROR", message: "请填写受邀账号和密码。" };
      return;
    }
    const generation = ++this.generation;
    this.busy = true;
    this.value = { ...empty, status: "BUSY", message: "正在验证账号…" };
    try {
      const result = await this.request("/api-local/identity/login", {
        username: username.trim(),
        password,
      });
      if (generation !== this.generation) return;
      if (
        !object(result) ||
        result.token_type !== "Bearer" ||
        "access_token" in result ||
        typeof result.expires_at !== "string" ||
        !Number.isFinite(Date.parse(result.expires_at)) ||
        Date.parse(result.expires_at) <= Date.now()
      )
        throw failure(502);
      const identity = await this.request("/api-local/me");
      if (generation !== this.generation) return;
      this.value = {
        ...projectIdentity(identity),
        status: "READY",
        message: "登录成功，请选择已授权的服务。",
      };
    } catch (cause) {
      if (generation !== this.generation) return;
      this.fail(cause, false);
      await this.clearCookie();
    } finally {
      if (generation === this.generation) this.busy = false;
    }
  }

  async logout(): Promise<void> {
    if (this.busy) return;
    const generation = ++this.generation;
    this.busy = true;
    this.value = { ...empty, status: "BUSY", message: "正在退出登录…" };
    try {
      await this.request("/api-local/identity/logout", {});
      if (generation === this.generation) this.value = { ...empty, message: "已退出登录。" };
    } catch {
      if (generation === this.generation)
        this.value = {
          ...empty,
          status: "LOGOUT_FAILED",
          message: "暂时无法确认退出，请重试退出登录。",
        };
    } finally {
      if (generation === this.generation) this.busy = false;
    }
  }

  private async clearCookie(): Promise<void> {
    try {
      await this.request("/api-local/identity/logout", {});
    } catch {
      /* The UI remains closed; no business request is made. */
    }
  }

  private async request(
    path: "/api-local/me" | "/api-local/identity/login" | "/api-local/identity/logout",
    body?: object,
  ): Promise<unknown> {
    const response = await this.fetcher(new URL(path, this.base).href, {
      method: body === undefined ? "GET" : "POST",
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(5000),
      ...(body === undefined
        ? {}
        : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
    });
    if (!response.ok) {
      await response.arrayBuffer().catch(() => undefined);
      throw failure(response.status);
    }
    const payload: unknown = await response.json();
    if (!object(payload) || !("data" in payload)) throw failure(502);
    return payload.data;
  }

  private fail(cause: unknown, restoring: boolean): void {
    const status = object(cause) && typeof cause.status === "number" ? cause.status : 0;
    this.value = {
      ...empty,
      status:
        status === 401 && restoring
          ? "IDLE"
          : status === 401 || status === 403
            ? "DENIED"
            : "ERROR",
      message:
        status === 401
          ? restoring
            ? "请使用受邀账号登录。"
            : "账号或密码不正确，请重新填写。"
          : status === 403
            ? "此账号尚未获准使用当前已接入的服务，请联系机构。"
            : "账号服务暂不可用，请稍后重试。",
    };
  }
}
