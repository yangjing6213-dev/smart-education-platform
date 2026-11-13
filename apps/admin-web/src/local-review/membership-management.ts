type MembershipStatus = "ACTIVE" | "SUSPENDED" | "REVOKED";
type MembershipProfile = "owner-east" | "owner-west" | "owner-other-tenant";
type ViewStatus = "IDLE" | "CONNECTING" | "READY" | "DENIED" | "ERROR";

interface MembershipRow {
  readonly actorId: string;
  readonly version: number;
  readonly profile: string;
  readonly label: string;
  readonly role: "教师" | "内容编辑";
  readonly tenantId: string;
  readonly campusId: string;
  readonly classIds: readonly string[];
  readonly status: MembershipStatus;
  readonly capabilities: readonly string[];
}

interface MembershipEvent {
  readonly actorId: string;
  readonly targetActorId: string;
  readonly fromStatus: MembershipStatus;
  readonly toStatus: MembershipStatus;
  readonly occurredAt: string;
}

interface MembershipSnapshot {
  readonly status: ViewStatus;
  readonly message: string;
  readonly profile: MembershipProfile;
  readonly label: string;
  readonly actorId: string;
  readonly tenantId: string;
  readonly campusId: string;
  readonly actions: readonly string[];
  readonly memberships: readonly MembershipRow[];
  readonly events: readonly MembershipEvent[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const HANDLE = /^[A-Za-z0-9_-]{43}$/u;
const profiles: readonly (readonly [MembershipProfile, string])[] = [
  ["owner-east", "东校区负责人"],
  ["owner-west", "西校区负责人"],
  ["owner-other-tenant", "另一机构负责人"],
];
const statuses: readonly MembershipStatus[] = ["ACTIVE", "SUSPENDED", "REVOKED"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMembershipProfile(value: string): value is MembershipProfile {
  return profiles.some(([profile]) => profile === value);
}

function isMembershipStatus(value: unknown): value is MembershipStatus {
  return typeof value === "string" && statuses.includes(value as MembershipStatus);
}

function escape(value: string): string {
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

function parseSession(value: unknown):
  | {
      readonly label: string;
      readonly actorId: string;
      readonly tenantId: string;
      readonly campusId: string;
      readonly actions: readonly string[];
    }
  | undefined {
  if (
    !isRecord(value) ||
    typeof value.label !== "string" ||
    typeof value.actorId !== "string" ||
    !UUID.test(value.actorId) ||
    typeof value.tenantId !== "string" ||
    !UUID.test(value.tenantId) ||
    typeof value.campusId !== "string" ||
    !UUID.test(value.campusId) ||
    !Array.isArray(value.actions) ||
    !value.actions.every((action) => typeof action === "string")
  )
    return undefined;
  return {
    label: value.label,
    actorId: value.actorId,
    tenantId: value.tenantId,
    campusId: value.campusId,
    actions: value.actions,
  };
}

function parseMemberships(
  value: unknown,
  snapshot: MembershipSnapshot,
): readonly MembershipRow[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const result: MembershipRow[] = [];
  for (const row of value) {
    if (
      !isRecord(row) ||
      typeof row.actorId !== "string" ||
      !UUID.test(row.actorId) ||
      !Number.isSafeInteger(row.version) ||
      (row.version as number) < 1 ||
      typeof row.profile !== "string" ||
      typeof row.label !== "string" ||
      (row.role !== "教师" && row.role !== "内容编辑") ||
      row.tenantId !== snapshot.tenantId ||
      row.campusId !== snapshot.campusId ||
      !Array.isArray(row.classIds) ||
      !row.classIds.every((id) => typeof id === "string" && UUID.test(id)) ||
      !isMembershipStatus(row.status) ||
      !Array.isArray(row.capabilities) ||
      !row.capabilities.every((capability) => typeof capability === "string")
    )
      return undefined;
    result.push({
      actorId: row.actorId,
      version: row.version as number,
      profile: row.profile,
      label: row.label,
      role: row.role,
      tenantId: row.tenantId,
      campusId: row.campusId,
      classIds: row.classIds,
      status: row.status,
      capabilities: row.capabilities,
    });
  }
  return result;
}

function parseEvents(value: unknown): readonly MembershipEvent[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const result: MembershipEvent[] = [];
  for (const row of value) {
    if (
      !isRecord(row) ||
      typeof row.actorId !== "string" ||
      !UUID.test(row.actorId) ||
      typeof row.targetActorId !== "string" ||
      !UUID.test(row.targetActorId) ||
      !isMembershipStatus(row.fromStatus) ||
      !isMembershipStatus(row.toStatus) ||
      typeof row.occurredAt !== "string" ||
      !Number.isFinite(Date.parse(row.occurredAt))
    )
      return undefined;
    result.push({
      actorId: row.actorId,
      targetActorId: row.targetActorId,
      fromStatus: row.fromStatus,
      toStatus: row.toStatus,
      occurredAt: row.occurredAt,
    });
  }
  return result;
}

function isAllowedRequest(path: string, method: string): boolean {
  if (path === "/local/sessions") return method === "POST";
  if (
    path === "/local/session" ||
    path === "/local/memberships" ||
    path === "/local/membership-events"
  )
    return method === "GET";
  const membershipPath = path.match(/^\/local\/memberships\/(.+)$/u);
  return membershipPath !== null && UUID.test(membershipPath[1] ?? "") && method === "PATCH";
}

export function createLocalMembershipTransport(
  servicePort: number | null,
  transport: typeof fetch = fetch.bind(globalThis),
): typeof fetch {
  const validPort =
    servicePort !== null &&
    Number.isSafeInteger(servicePort) &&
    servicePort >= 1 &&
    servicePort <= 65535;
  const origin = validPort ? `http://127.0.0.1:${servicePort}` : null;
  return (input, init) => {
    if (origin === null) return Promise.reject(new Error("本机成员服务端口无效。"));
    const rawUrl =
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const target = new URL(rawUrl, origin);
    const method = (
      init?.method ?? (input instanceof Request ? input.method : "GET")
    ).toUpperCase();
    if (
      target.origin !== origin ||
      target.search !== "" ||
      target.hash !== "" ||
      !isAllowedRequest(target.pathname, method)
    )
      return Promise.reject(new Error("成员管理只允许访问本机合成成员服务。"));
    return transport(target, { ...init, redirect: "error" });
  };
}

export class MembershipManagementClient {
  #handle: string | null = null;
  #generation = 0;
  #refreshGeneration = 0;
  #value: MembershipSnapshot = {
    status: "IDLE",
    message: "请选择示例负责人查看本校区员工。",
    profile: "owner-east",
    label: "",
    actorId: "",
    tenantId: "",
    campusId: "",
    actions: [],
    memberships: [],
    events: [],
  };

  constructor(private readonly transport: typeof fetch) {}

  get snapshot(): MembershipSnapshot {
    return structuredClone(this.#value);
  }

  async connect(profile: MembershipProfile): Promise<void> {
    const generation = ++this.#generation;
    this.#refreshGeneration += 1;
    this.#handle = null;
    this.#value = {
      ...this.#value,
      status: "CONNECTING",
      message: "正在读取本机合成成员资料…",
      profile,
      label: "",
      actorId: "",
      tenantId: "",
      campusId: "",
      actions: [],
      memberships: [],
      events: [],
    };
    try {
      const bootstrap = await this.transport("/local/sessions", {
        method: "POST",
        credentials: "omit",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile }),
      });
      const created = await bootstrap.json();
      if (generation !== this.#generation) return;
      if (
        !bootstrap.ok ||
        !isRecord(created) ||
        typeof created.handle !== "string" ||
        !HANDLE.test(created.handle)
      ) {
        this.#disconnect("当前示例身份无法建立有效会话。", "DENIED");
        return;
      }
      const handle = created.handle;
      this.#handle = handle;
      const session = parseSession(await this.#request("/local/session", "GET", undefined, handle));
      if (generation !== this.#generation) return;
      if (!session) throw new Error("成员会话资料格式无效");
      this.#value = { ...this.#value, ...session };
      if (!session.actions.includes("membership:manage")) {
        this.#disconnect("当前示例身份没有员工成员管理权限。", "DENIED");
        return;
      }
      await this.refresh();
    } catch {
      if (generation === this.#generation)
        this.#disconnect("连接失败，请确认本机服务已启动后重试。", "ERROR");
    }
  }

  async refresh(): Promise<void> {
    const generation = this.#generation;
    const refreshGeneration = ++this.#refreshGeneration;
    const handle = this.#handle;
    if (!handle) return;
    try {
      const [membersValue, eventsValue] = await Promise.all([
        this.#request("/local/memberships", "GET", undefined, handle),
        this.#request("/local/membership-events", "GET", undefined, handle),
      ]);
      if (generation !== this.#generation || refreshGeneration !== this.#refreshGeneration) return;
      const memberships = parseMemberships(membersValue, this.#value);
      const events = parseEvents(eventsValue);
      if (!memberships || !events) throw new Error("员工成员资料格式无效或范围不匹配");
      this.#value = {
        ...this.#value,
        status: "READY",
        message: "成员资料已更新；所有内容仅在本机演示。",
        memberships,
        events,
      };
    } catch {
      if (generation === this.#generation && refreshGeneration === this.#refreshGeneration)
        this.#disconnect("当前身份无法读取本校区员工资料，或本机服务不可用。", "DENIED");
    }
  }

  async setStatus(actorId: string, status: MembershipStatus): Promise<boolean> {
    const handle = this.#handle;
    const generation = this.#generation;
    const member = this.#value.memberships.find((row) => row.actorId === actorId);
    if (
      !handle ||
      this.#value.status !== "READY" ||
      !this.#value.actions.includes("membership:manage") ||
      !member ||
      !UUID.test(actorId) ||
      !statuses.includes(status) ||
      member.status === "REVOKED"
    )
      return false;
    try {
      await this.#request(
        `/local/memberships/${actorId}`,
        "PATCH",
        { status, version: member.version },
        handle,
      );
      if (generation !== this.#generation) return false;
      await this.refresh();
      return (
        generation === this.#generation &&
        this.#value.status === "READY" &&
        this.#value.memberships.some((row) => row.actorId === actorId && row.status === status)
      );
    } catch (error) {
      if (generation !== this.#generation) return false;
      if (error instanceof MembershipRequestError && error.status === 409) {
        await this.refresh();
        if (generation !== this.#generation) return false;
        this.#value = {
          ...this.#value,
          message: "成员状态已被更新，页面已刷新；请核对当前状态后再操作。",
        };
      } else {
        this.#value = { ...this.#value, message: "成员状态没有更新，请刷新后重试。" };
      }
      return false;
    }
  }

  disconnect(message = "成员管理页面已关闭。", status: "IDLE" | "DENIED" = "IDLE"): void {
    this.#generation += 1;
    this.#disconnect(message, status);
  }

  async #request(
    path: string,
    method: string,
    body: object | undefined,
    handle: string | null,
  ): Promise<unknown> {
    const response = await this.transport(path, {
      method,
      credentials: "omit",
      headers: {
        ...(handle ? { Authorization: `Bearer ${handle}` } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) throw new MembershipRequestError(response.status);
    return response.json();
  }

  #disconnect(message: string, status: "IDLE" | "DENIED" | "ERROR"): void {
    this.#refreshGeneration += 1;
    this.#handle = null;
    this.#value = {
      ...this.#value,
      status,
      message,
      memberships: [],
      events: [],
    };
  }
}

class MembershipRequestError extends Error {
  constructor(readonly status: number) {
    super("本机成员服务拒绝该请求");
  }
}

function statusLabel(status: MembershipStatus): string {
  return status === "ACTIVE" ? "有效" : status === "SUSPENDED" ? "已停用" : "已撤销";
}

export function renderMembershipManagement(snapshot: MembershipSnapshot, editable = true): string {
  const options = profiles
    .map(
      ([profile, label]) =>
        `<option value="${profile}"${snapshot.profile === profile ? " selected" : ""}>${label}</option>`,
    )
    .join("");
  let content = `<p class="notice" role="status" data-membership-message>${escape(snapshot.message)}</p>`;
  if (snapshot.status === "READY") {
    const rows = snapshot.memberships
      .map((row) => {
        const controls = !editable
          ? ""
          : row.status === "ACTIVE"
            ? '<button class="save" data-membership-action="SUSPENDED">停用</button><button class="save" data-membership-action="REVOKED">撤销</button>'
            : row.status === "SUSPENDED"
              ? '<button class="save" data-membership-action="ACTIVE">恢复</button><button class="save" data-membership-action="REVOKED">撤销</button>'
              : "";
        return `<article class="panel" data-membership-row="${escape(row.actorId)}" data-membership-version="${row.version}"><h3>${escape(row.label)} · ${row.role}</h3><p>岗位：${row.role} · 校区范围：当前校区 · 班级数：${row.classIds.length}</p><p>能力范围：${escape(row.capabilities.join("、"))}</p><p>状态：<span data-membership-status="${row.status}">${statusLabel(row.status)}</span></p><div>${controls}</div></article>`;
      })
      .join("");
    const events = snapshot.events
      .slice()
      .reverse()
      .map(
        (event) =>
          `<li>${escape(event.targetActorId)}：${statusLabel(event.fromStatus)} → ${statusLabel(event.toStatus)}</li>`,
      )
      .join("");
    content += `<section data-membership-list><h2>当前校区员工</h2>${rows || "<p>当前校区暂无可管理员工。</p>"}</section><section class="panel"><h2>成员状态记录</h2><ul data-membership-events>${events || "<li>暂无变更记录。</li>"}</ul></section>`;
  } else if (snapshot.status === "DENIED") {
    content += '<p class="notice">没有权限时不显示员工名单。</p>';
  }
  return `<section class="panel" data-membership-management><h2>员工成员管理</h2><p>本机合成资料 · 岗位和能力固定展示 · 状态变更仅作用于当前演示服务</p><form data-membership-profile-form><label for="membership-profile">当前示例身份</label><select id="membership-profile" name="profile"${editable ? "" : " disabled"}>${options}</select><button class="save" type="submit"${editable ? "" : " disabled"}>切换身份</button></form>${content}</section>`;
}

export function isMembershipManagementProfile(value: string): value is MembershipProfile {
  return isMembershipProfile(value);
}
