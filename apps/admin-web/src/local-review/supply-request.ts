export const SUPPLY_REQUEST_REVIEW_ROUTE = "/admin/supply-request-review";
export type SupplyRequestReviewRole = "CAMPUS_REVIEWER" | "INSTITUTION_REVIEWER" | "PLATFORM_ADMIN";
export type SupplyRequestReviewAction = "CONFIRM" | "RETURN" | "OUT_OF_STOCK" | "CLAIM";
const STATUS_LABEL = {
  DRAFT: "草稿",
  SUBMITTED: "待审核",
  CONFIRMED: "已确认",
  RETURNED: "已退回",
  READY: "可领取",
  OUT_OF_STOCK: "缺货",
  CANCELLED: "已取消",
  CLAIMED: "已领取",
} as const;
type Status = keyof typeof STATUS_LABEL;
const CATALOG = {
  STATIONERY_SET: "日常文具包",
  ART_ACTIVITY_SET: "美术活动包",
  CLEANING_SET: "清洁用品包",
  FIRST_AID_SET: "基础急救包",
} as const;
const PURPOSE = {
  CLASS_ACTIVITY: "班级活动",
  DAILY_OPERATION: "日常运营",
  EMERGENCY_STOCK: "应急储备",
} as const;
const ROLE_LABEL = {
  CAMPUS_REVIEWER: "校区负责人（共享审核范围）",
  INSTITUTION_REVIEWER: "机构负责人（共享审核范围）",
  PLATFORM_ADMIN: "平台管理员（仅匿名统计）",
} as const;
interface Session {
  readonly profile: string;
  readonly label: string;
  readonly tenantId: string;
  readonly campusId: string;
  readonly classIds: readonly string[];
  readonly actions: readonly string[];
}
interface Row {
  readonly id: string;
  readonly version: number;
  readonly status: Status;
  readonly tenantId: string;
  readonly campusId: string;
  readonly classId: string;
  readonly catalog: keyof typeof CATALOG;
  readonly quantity: number;
  readonly purpose: keyof typeof PURPOSE;
  readonly authorLabel: string;
}
export interface SupplyRequestReviewSnapshot {
  readonly role: SupplyRequestReviewRole;
  readonly status: "IDLE" | "CONNECTING" | "READY" | "ERROR";
  readonly session: Session | null;
  readonly rows: readonly Row[];
  readonly history: readonly Row[];
  readonly counts: Readonly<Record<Status, number>>;
  readonly message: string;
}
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= 200;
const uuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
const owns = <T extends object>(map: T, value: unknown): value is keyof T =>
  typeof value === "string" && Object.hasOwn(map, value);
const emptyCounts = () =>
  Object.fromEntries(Object.keys(STATUS_LABEL).map((status) => [status, 0])) as Record<
    Status,
    number
  >;
const escape = (value: string | number) =>
  String(value).replace(
    /[&<>"']/gu,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!,
  );

function parseRows(value: unknown, session: Session): Row[] {
  if (!Array.isArray(value)) throw new Error("申请数据格式不正确，请刷新后重试。");
  const ids = new Set<string>();
  return value.map((row: unknown) => {
    if (
      !object(row) ||
      !uuid(row.id) ||
      ids.has(row.id) ||
      !Number.isSafeInteger(row.version) ||
      (row.version as number) < 1 ||
      !owns(STATUS_LABEL, row.status) ||
      !owns(CATALOG, row.catalog) ||
      !owns(PURPOSE, row.purpose) ||
      !Number.isSafeInteger(row.quantity) ||
      (row.quantity as number) < 1 ||
      (row.quantity as number) > 20 ||
      row.tenantId !== session.tenantId ||
      row.campusId !== session.campusId ||
      !uuid(row.classId) ||
      !session.classIds.includes(row.classId) ||
      row.kind !== "supplyRequest" ||
      row.synthetic !== true ||
      !text(row.authorLabel)
    )
      throw new Error("申请数据或授权范围不正确，已停止显示明细。");
    ids.add(row.id);
    return {
      id: row.id,
      version: row.version as number,
      status: row.status,
      tenantId: session.tenantId,
      campusId: session.campusId,
      classId: row.classId,
      catalog: row.catalog,
      quantity: row.quantity as number,
      purpose: row.purpose,
      authorLabel: row.authorLabel,
    };
  });
}
function parseCounts(value: unknown): Record<Status, number> {
  if (
    !object(value) ||
    value.synthetic !== true ||
    Object.keys(value).some((key) => key !== "synthetic" && key !== "counts") ||
    !object(value.counts)
  )
    throw new Error("匿名统计格式不正确，已停止显示。");
  const counts = emptyCounts();
  if (Object.keys(value.counts).length !== Object.keys(counts).length)
    throw new Error("匿名统计格式不正确，已停止显示。");
  for (const status of Object.keys(counts) as Status[]) {
    const count = value.counts[status];
    if (!Number.isSafeInteger(count) || (count as number) < 0)
      throw new Error("匿名统计格式不正确，已停止显示。");
    counts[status] = count as number;
  }
  return counts;
}

export function renderSupplyRequestReview(
  snapshot: SupplyRequestReviewSnapshot,
  editable: boolean,
): string {
  const platform = snapshot.role === "PLATFORM_ADMIN";
  const ready = snapshot.status === "READY";
  const roleOptions = (Object.keys(ROLE_LABEL) as SupplyRequestReviewRole[])
    .map(
      (role) =>
        `<option value="${role}"${snapshot.role === role ? " selected" : ""}>${ROLE_LABEL[role]}</option>`,
    )
    .join("");
  const renderRow = (row: Row, inQueue: boolean) => {
    const button = (action: SupplyRequestReviewAction, label: string) =>
      `<button type="button" class="${action === "CONFIRM" || action === "CLAIM" ? "publish" : "save"}" data-supply-action="${action}" data-supply-id="${escape(row.id)}" data-supply-version="${row.version}">${label}</button>`;
    const canReview =
      inQueue && editable && ready && snapshot.session?.actions.includes("supply:review");
    const canClaim =
      inQueue && editable && ready && snapshot.session?.actions.includes("supply:claim");
    const actions =
      canReview && row.status === "SUBMITTED"
        ? button("CONFIRM", "确认可领取") +
          button("RETURN", "退回修改") +
          button("OUT_OF_STOCK", "标记缺货")
        : canClaim && row.status === "READY"
          ? button("CLAIM", "确认领取")
          : "";
    return `<article class="panel" data-supply-row="${escape(row.id)}"><h3>${CATALOG[row.catalog]} · ${row.quantity} 份</h3><p>版本 ${row.version} · ${STATUS_LABEL[row.status]} · 申请教师：${escape(row.authorLabel)}</p><p>固定用途：${PURPOSE[row.purpose]}</p>${row.status === "READY" ? '<p class="notice">已确认备妥，教师或授权负责人可登记领取一次。</p>' : ""}${actions ? `<div class="actions">${actions}</div>` : ""}</article>`;
  };
  const summary = (Object.keys(STATUS_LABEL) as Status[])
    .map(
      (status) =>
        `<div><dt>${STATUS_LABEL[status]}</dt><dd data-supply-count="${status}">${ready ? snapshot.counts[status] : "—"}</dd></div>`,
    )
    .join("");
  const content = platform
    ? '<section class="panel"><p class="notice">平台管理员只查看状态合计，不显示申请编号、教师、班级或用途。</p></section>'
    : `<section class="panel"><h2>负责人审核队列</h2>${snapshot.rows.map((row) => renderRow(row, true)).join("") || `<p class="notice">${ready ? "当前授权范围没有待处理的物资申请。" : "连接后显示授权范围内的申请。"}</p>`}</section><section class="panel"><h2>其他申请记录</h2>${snapshot.history.map((row) => renderRow(row, false)).join("") || '<p class="notice">暂无其他申请记录。</p>'}</section>`;
  return `<div class="shell"><header class="topbar"><strong>机构管理工作台</strong><span>物资申请</span><a href="/">返回管理首页</a></header><main><section class="panel"><p class="eyebrow">模拟数据 · 仅本机演示</p><h1>物资申请审核</h1><p>核对固定目录、数量和用途，确认后可登记领取；不产生真实采购。</p><label>当前模拟角色<select id="supply-role"${editable ? "" : " disabled"}>${roleOptions}</select></label><div class="actions"><button type="button" class="save" id="supply-refresh"${snapshot.status === "CONNECTING" ? " disabled" : ""}>刷新申请</button></div><p id="supply-feedback" role="status">${escape(snapshot.message)}</p>${!platform && snapshot.session ? `<p>当前身份：${escape(snapshot.session.label)}</p>` : ""}</section><section class="panel"><h2>${platform ? "匿名状态统计" : "授权范围状态统计"}</h2><dl class="meta">${summary}</dl></section>${content}</main><footer>仅模拟数据，不会发起真实采购或外部通知。</footer></div>`;
}

export class SupplyRequestReviewClient {
  private handle: string | null = null;
  private generation = 0;
  private busy = false;
  private state: SupplyRequestReviewSnapshot = {
    role: "CAMPUS_REVIEWER",
    status: "IDLE",
    session: null,
    rows: [],
    history: [],
    counts: emptyCounts(),
    message: "尚未连接本机共享服务。",
  };
  constructor(private readonly transport: typeof fetch = fetch.bind(globalThis)) {}
  get snapshot() {
    return structuredClone(this.state);
  }
  disconnect(): void {
    this.generation += 1;
    this.handle = null;
    this.busy = false;
    this.state = {
      role: this.state.role,
      status: "IDLE",
      session: null,
      rows: [],
      history: [],
      counts: emptyCounts(),
      message: "尚未连接本机共享服务。",
    };
  }
  private async request(
    path: string,
    method = "GET",
    body?: object,
    handle = this.handle,
  ): Promise<unknown> {
    const response = await this.transport(path, {
      method,
      credentials: "omit",
      cache: "no-store",
      redirect: "error",
      headers: {
        ...(handle ? { Authorization: `Bearer ${handle}` } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok)
      throw new Error(
        response.status === 409
          ? "申请状态已变化，请刷新后按最新状态操作。"
          : response.status === 403
            ? "当前角色无权进行此操作。"
            : "本机共享服务暂时不可用，请稍后刷新。",
      );
    return response.json();
  }
  private fail(error: unknown) {
    this.state = {
      ...this.state,
      status: "ERROR",
      session: null,
      rows: [],
      history: [],
      counts: emptyCounts(),
      message: error instanceof Error ? error.message : "本机共享服务暂时不可用，请稍后刷新。",
    };
  }
  async connect(role: SupplyRequestReviewRole): Promise<void> {
    const generation = ++this.generation;
    this.handle = null;
    this.state = {
      role,
      status: "CONNECTING",
      session: null,
      rows: [],
      history: [],
      counts: emptyCounts(),
      message: "正在连接本机共享物资服务…",
    };
    try {
      const profile = role === "PLATFORM_ADMIN" ? "platform-admin" : "owner-east";
      const bootstrap = await this.request("/local/sessions", "POST", { profile }, null);
      if (generation !== this.generation) return;
      if (
        !object(bootstrap) ||
        typeof bootstrap.handle !== "string" ||
        !/^[\w-]{43}$/u.test(bootstrap.handle)
      )
        throw new Error("本机模拟会话无效，请重新连接。");
      this.handle = bootstrap.handle;
      if (role !== "PLATFORM_ADMIN") {
        const session = await this.request("/local/session");
        if (generation !== this.generation) return;
        if (
          !object(session) ||
          session.profile !== profile ||
          !text(session.label) ||
          !uuid(session.tenantId) ||
          !uuid(session.campusId) ||
          !Array.isArray(session.classIds) ||
          !session.classIds.every(uuid) ||
          !Array.isArray(session.actions) ||
          !session.actions.every(text) ||
          !session.actions.includes("supply:review")
        )
          throw new Error("本机模拟身份的授权范围无效。");
        this.state = {
          ...this.state,
          session: {
            profile,
            label: session.label,
            tenantId: session.tenantId,
            campusId: session.campusId,
            classIds: [...session.classIds],
            actions: [...session.actions],
          },
        };
      }
      await this.refresh();
    } catch (error) {
      if (generation !== this.generation) return;
      this.handle = null;
      this.fail(error);
    }
  }
  async refresh(): Promise<void> {
    const generation = this.generation;
    const { role, session } = this.state;
    const handle = this.handle;
    if (!handle) throw new Error("请先连接本机共享服务。");
    try {
      if (role === "PLATFORM_ADMIN") {
        const value = await this.request("/local/supply-summary", "GET", undefined, handle);
        if (generation !== this.generation) return;
        this.state = {
          ...this.state,
          status: "READY",
          session: null,
          rows: [],
          history: [],
          counts: parseCounts(value),
          message: "已刷新匿名状态统计。",
        };
      } else {
        if (!session) throw new Error("本机模拟身份的授权范围无效。");
        const [queue, all] = await Promise.all([
          this.request("/local/supply-requests-review", "GET", undefined, handle),
          this.request("/local/supply-requests", "GET", undefined, handle),
        ]);
        if (generation !== this.generation) return;
        const rows = parseRows(queue, session);
        if (
          rows.some(
            (row) => !["SUBMITTED", "CONFIRMED", "READY", "OUT_OF_STOCK"].includes(row.status),
          )
        )
          throw new Error("审核队列状态不正确，请刷新后重试。");
        const allRows = parseRows(all, session);
        const counts = emptyCounts();
        for (const row of allRows) counts[row.status] += 1;
        const queueIds = new Set(rows.map((row) => row.id));
        this.state = {
          ...this.state,
          status: "READY",
          rows,
          history: allRows.filter((row) => !queueIds.has(row.id)),
          counts,
          message: "已刷新授权范围内的物资申请。",
        };
      }
    } catch (error) {
      if (generation !== this.generation) return;
      this.fail(error);
      throw error;
    }
  }
  async command(id: string, version: number, action: SupplyRequestReviewAction): Promise<void> {
    if (this.state.role === "PLATFORM_ADMIN") throw new Error("当前角色无权进行此操作。");
    const row = this.state.rows.find((candidate) => candidate.id === id);
    if (this.busy || !row || row.version !== version || !Number.isSafeInteger(version))
      throw new Error("申请状态已变化，请刷新后按最新状态操作。");
    if (!["CONFIRM", "RETURN", "OUT_OF_STOCK", "CLAIM"].includes(action))
      throw new Error("操作无效。");
    if (
      this.state.status !== "READY" ||
      !this.state.session?.actions.includes(action === "CLAIM" ? "supply:claim" : "supply:review")
    )
      throw new Error("当前角色无权进行此操作。");
    if (row.status !== (action === "CLAIM" ? "READY" : "SUBMITTED"))
      throw new Error("申请状态已变化，请刷新后按最新状态操作。");
    const generation = this.generation;
    this.busy = true;
    try {
      await this.request(
        `/local/supply-requests/${encodeURIComponent(id)}/${action === "CLAIM" ? "claim" : "review"}`,
        "POST",
        { version, ...(action === "CLAIM" ? {} : { action }) },
      );
      if (generation !== this.generation) return;
      await this.refresh();
      if (generation !== this.generation) return;
      this.state = {
        ...this.state,
        message: {
          CONFIRM: "已确认，教师或授权负责人可登记领取。",
          RETURN: "已退回，教师可修改后重新提交或取消。",
          OUT_OF_STOCK: "已标记缺货。",
          CLAIM: "已登记领取，该申请不能重复领取。",
        }[action],
      };
    } catch (error) {
      if (generation !== this.generation) return;
      try {
        await this.refresh();
      } catch {
        /* refresh already clears unavailable data */
      }
      if (generation !== this.generation) return;
      this.state = {
        ...this.state,
        message: error instanceof Error ? error.message : "操作失败，请刷新后重试。",
      };
      throw error;
    } finally {
      this.busy = false;
    }
  }
}
