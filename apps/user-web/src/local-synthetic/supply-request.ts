export const SUPPLY_CATALOG = {
  STATIONERY_SET: "日常文具包",
  ART_ACTIVITY_SET: "美术活动包",
  CLEANING_SET: "清洁用品包",
  FIRST_AID_SET: "基础急救包",
} as const;

export const SUPPLY_PURPOSE = {
  CLASS_ACTIVITY: "班级活动",
  DAILY_OPERATION: "日常运营",
  EMERGENCY_STOCK: "应急储备",
} as const;

export const SUPPLY_STATUS = {
  DRAFT: "草稿",
  SUBMITTED: "待负责人审核",
  RETURNED: "已退回，请修改后重提",
  READY: "待领取",
  OUT_OF_STOCK: "缺货，可重新申请",
  CANCELLED: "已取消",
  CLAIMED: "已领取",
} as const;

export type SupplyCatalog = keyof typeof SUPPLY_CATALOG;
export type SupplyPurpose = keyof typeof SUPPLY_PURPOSE;
export type SupplyStatus = keyof typeof SUPPLY_STATUS;
export type SupplyRequestAction = "submit" | "cancel" | "claim";

export interface SupplyRequestInput {
  readonly catalog: SupplyCatalog;
  readonly purpose: SupplyPurpose;
  readonly quantity: number;
}

export interface SupplyRequestSession {
  readonly profile: "teacher-east";
  readonly label: string;
  readonly actorId: string;
  readonly tenantId: string;
  readonly campusId: string;
  readonly classIds: readonly string[];
  readonly actions: readonly string[];
}

export interface SupplyRequestRow extends SupplyRequestInput {
  readonly id: string;
  readonly version: number;
  readonly kind: "supplyRequest";
  readonly tenantId: string;
  readonly campusId: string;
  readonly classId: string;
  readonly authorLabel: string;
  readonly status: SupplyStatus;
  readonly synthetic: true;
}

export interface SupplyRequestSummary {
  readonly synthetic: true;
  readonly counts: Readonly<Record<SupplyStatus, number>>;
}

export interface SupplyRequestSnapshot {
  readonly status: "IDLE" | "CONNECTING" | "BUSY" | "READY" | "ERROR";
  readonly session: SupplyRequestSession | null;
  readonly rows: readonly SupplyRequestRow[];
  readonly summary: SupplyRequestSummary | null;
  readonly message: string;
}

export interface SupplyRequestOptions {
  readonly fetcher?: typeof fetch;
}

const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const uuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
const text = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= 120;
const statuses = Object.keys(SUPPLY_STATUS) as SupplyStatus[];

export function isSupplyRequestInput(value: unknown): value is SupplyRequestInput {
  if (!object(value)) return false;
  const keys = Object.keys(value).sort();
  return (
    keys.length === 3 &&
    keys.join(",") === "catalog,purpose,quantity" &&
    typeof value.catalog === "string" &&
    Object.hasOwn(SUPPLY_CATALOG, value.catalog) &&
    typeof value.purpose === "string" &&
    Object.hasOwn(SUPPLY_PURPOSE, value.purpose) &&
    Number.isSafeInteger(value.quantity) &&
    Number(value.quantity) >= 1 &&
    Number(value.quantity) <= 20
  );
}

function parseSession(value: unknown): SupplyRequestSession {
  if (
    !object(value) ||
    value.mode !== "local-synthetic" ||
    value.profile !== "teacher-east" ||
    !text(value.label) ||
    !uuid(value.actorId) ||
    !uuid(value.tenantId) ||
    !uuid(value.campusId) ||
    !Array.isArray(value.classIds) ||
    value.classIds.length === 0 ||
    !value.classIds.every(uuid) ||
    !Array.isArray(value.actions) ||
    !value.actions.every(text) ||
    !value.actions.includes("supply:read") ||
    !value.actions.includes("supply:create")
  )
    throw new Error("当前员工身份没有物资申请权限。");
  return {
    profile: "teacher-east",
    label: value.label,
    actorId: value.actorId,
    tenantId: value.tenantId,
    campusId: value.campusId,
    classIds: [...value.classIds],
    actions: [...value.actions],
  };
}

export function parseSupplyRequestRows(
  value: unknown,
  session: SupplyRequestSession,
): SupplyRequestRow[] {
  if (!Array.isArray(value) || !session.actions.includes("supply:read"))
    throw new Error("物资申请列表无效，已停止显示。");
  return value.map((entry: unknown) => {
    if (
      !object(entry) ||
      !isSupplyRequestInput({
        catalog: entry.catalog,
        purpose: entry.purpose,
        quantity: entry.quantity,
      }) ||
      !uuid(entry.id) ||
      !Number.isSafeInteger(entry.version) ||
      Number(entry.version) < 1 ||
      entry.kind !== "supplyRequest" ||
      entry.synthetic !== true ||
      entry.tenantId !== session.tenantId ||
      entry.campusId !== session.campusId ||
      !uuid(entry.classId) ||
      !session.classIds.includes(entry.classId) ||
      !text(entry.authorLabel) ||
      !statuses.includes(entry.status as SupplyStatus)
    )
      throw new Error("申请超出当前校区或班级范围，已停止显示。");
    return {
      id: entry.id,
      version: Number(entry.version),
      kind: "supplyRequest",
      catalog: entry.catalog as SupplyCatalog,
      purpose: entry.purpose as SupplyPurpose,
      quantity: Number(entry.quantity),
      tenantId: session.tenantId,
      campusId: session.campusId,
      classId: entry.classId,
      authorLabel: entry.authorLabel,
      status: entry.status as SupplyStatus,
      synthetic: true,
    };
  });
}

function allowedRequest(pathname: string, method: string): boolean {
  if (pathname === "/local/sessions") return method === "POST";
  if (pathname === "/local/session") return method === "GET";
  if (pathname === "/local/supply-requests") return method === "GET" || method === "POST";
  if (/^\/local\/supply-requests\/[0-9a-f-]{36}$/iu.test(pathname)) return method === "PATCH";
  return (
    /^\/local\/supply-requests\/[0-9a-f-]{36}\/(?:submit|cancel|claim)$/iu.test(pathname) &&
    method === "POST"
  );
}

export function createLocalSupplyRequestTransport(
  fetcher: typeof fetch = globalThis.fetch.bind(globalThis),
): typeof fetch {
  return async (input, init = {}) => {
    let url: URL;
    try {
      const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      url = new URL(raw, "http://127.0.0.1");
    } catch {
      return new Response(null, { status: 403 });
    }
    const method = init.method ?? (input instanceof Request ? input.method : "GET");
    const relativeLocalPath = typeof input === "string" && input.startsWith("/local/");
    if (
      !relativeLocalPath ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !allowedRequest(url.pathname, method)
    )
      return new Response(null, { status: 403 });
    return fetcher(input, {
      ...init,
      credentials: "omit",
      cache: "no-store",
      redirect: "error",
    });
  };
}

function escape(value: string | number): string {
  return String(value).replace(
    /[&<>"']/gu,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!,
  );
}

function fields(row?: SupplyRequestRow, disabled = false): string {
  const catalog = Object.entries(SUPPLY_CATALOG)
    .map(
      ([key, label]) =>
        `<option value="${key}"${row?.catalog === key ? " selected" : ""}>${label}</option>`,
    )
    .join("");
  const purpose = Object.entries(SUPPLY_PURPOSE)
    .map(
      ([key, label]) =>
        `<option value="${key}"${row?.purpose === key ? " selected" : ""}>${label}</option>`,
    )
    .join("");
  return `<label>物资<select name="catalog" required${disabled ? " disabled" : ""}>${catalog}</select></label><label>用途<select name="purpose" required${disabled ? " disabled" : ""}>${purpose}</select></label><label>数量<input name="quantity" type="number" min="1" max="20" step="1" value="${row?.quantity ?? 1}" required${disabled ? " disabled" : ""}></label>`;
}

function renderRow(row: SupplyRequestRow, busy: boolean): string {
  const controls: string[] = [];
  if (row.status === "DRAFT" || row.status === "RETURNED") {
    controls.push(
      `<button class="button button-primary" type="button" data-supply-action="submit" data-supply-id="${row.id}" data-supply-version="${row.version}"${busy ? " disabled" : ""}>${row.status === "RETURNED" ? "重新提交" : "提交审核"}</button>`,
    );
    controls.push(
      `<button class="button button-outline" type="button" data-supply-action="cancel" data-supply-id="${row.id}" data-supply-version="${row.version}"${busy ? " disabled" : ""}>取消申请</button>`,
    );
  }
  if (row.status === "READY")
    controls.push(
      `<button class="button button-primary" type="button" data-supply-action="claim" data-supply-id="${row.id}" data-supply-version="${row.version}"${busy ? " disabled" : ""}>确认领取</button>`,
    );
  const editable = row.status === "DRAFT" || row.status === "RETURNED";
  return `<article class="panel supply-request-row" data-supply-row="${row.id}"><div class="heading-row"><h3>${escape(SUPPLY_CATALOG[row.catalog])} · ${row.quantity} 份</h3><span>${escape(SUPPLY_STATUS[row.status])}</span></div><p>${escape(SUPPLY_PURPOSE[row.purpose])}</p>${editable ? `<form data-supply-form="edit" data-supply-id="${row.id}" data-supply-version="${row.version}">${fields(row, busy)}<button class="button button-outline" type="submit"${busy ? " disabled" : ""}>保存修改</button></form>` : ""}<div class="actions">${controls.join("")}</div></article>`;
}

export function renderSupplyPanel(snapshot: SupplyRequestSnapshot): string {
  const busy = snapshot.status !== "READY";
  const form =
    snapshot.session?.actions.includes("supply:create") === true
      ? `<form class="panel" data-supply-form="create"><h3>新建物资申请</h3>${fields(undefined, busy)}<button class="button button-primary" type="submit"${busy ? " disabled" : ""}>保存申请草稿</button></form>`
      : "";
  const rows = snapshot.rows.length
    ? snapshot.rows.map((row) => renderRow(row, busy)).join("")
    : '<p class="notice">当前没有物资申请。</p>';
  return `<section class="shared-supply" data-supply-panel><div class="heading-row"><div><h2>物资申请</h2><p>仅使用固定物资与用途；负责人审核后可领取。</p></div><button class="button button-outline" type="button" data-supply-refresh${snapshot.status === "CONNECTING" || snapshot.status === "BUSY" ? " disabled" : ""}>刷新</button></div><p role="status" data-supply-message>${escape(snapshot.message)}</p>${form}<section class="panel"><h3>我的申请</h3>${rows}</section><p class="notice">合成数据 · 仅保存在本机共享演示中，不产生采购或支付。</p></section>`;
}

export function supplyRequestFormValues(form: HTMLFormElement): SupplyRequestInput | null {
  const data = new FormData(form);
  const raw = {
    catalog: String(data.get("catalog") ?? ""),
    purpose: String(data.get("purpose") ?? ""),
    quantity: Number(data.get("quantity")),
  };
  return isSupplyRequestInput(raw) ? raw : null;
}

export class SupplyRequestClient {
  private handle: string | null = null;
  private generation = 0;
  private state: SupplyRequestSnapshot = {
    status: "IDLE",
    session: null,
    rows: [],
    summary: null,
    message: "尚未连接本机共享服务。",
  };
  private readonly transport: typeof fetch;

  constructor(fetcher: typeof fetch = globalThis.fetch.bind(globalThis)) {
    this.transport = createLocalSupplyRequestTransport(fetcher);
  }

  get snapshot(): SupplyRequestSnapshot {
    return structuredClone(this.state);
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
            ? "当前员工身份无权进行此操作。"
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
      rows: [],
      summary: null,
      message: "正在连接本机共享服务…",
    };
    try {
      const bootstrap = await this.request(
        "/local/sessions",
        "POST",
        { profile: "teacher-east" },
        null,
      );
      if (generation !== this.generation) return;
      if (
        !object(bootstrap) ||
        typeof bootstrap.handle !== "string" ||
        !/^[\w-]{43}$/u.test(bootstrap.handle)
      )
        throw new Error("本机模拟会话无效，请重新连接。");
      this.handle = bootstrap.handle;
      const session = parseSession(await this.request("/local/session"));
      if (generation !== this.generation) return;
      this.state = { ...this.state, session };
      await this.refresh(generation);
    } catch (error) {
      if (generation === this.generation) this.fail(error);
    }
  }

  async refresh(expectedGeneration = this.generation): Promise<void> {
    const session = this.state.session;
    if (!session || !this.handle) {
      this.fail(new Error("请先连接本机共享服务。"));
      return;
    }
    this.state = { ...this.state, status: "BUSY", message: "正在刷新物资申请…" };
    try {
      const rows = parseSupplyRequestRows(await this.request("/local/supply-requests"), session);
      if (expectedGeneration !== this.generation) return;
      this.state = {
        ...this.state,
        status: "READY",
        rows,
        message: "已刷新当前授权班级的物资申请。",
      };
    } catch (error) {
      if (expectedGeneration === this.generation) this.fail(error);
    }
  }

  async create(input: SupplyRequestInput): Promise<void> {
    if (!isSupplyRequestInput(input)) return;
    const session = this.state.session;
    if (!session?.actions.includes("supply:create") || !this.handle) {
      this.fail(new Error("当前员工身份无权创建物资申请。"));
      return;
    }
    const generation = this.generation;
    this.state = { ...this.state, status: "BUSY", message: "正在保存申请草稿…" };
    try {
      await this.request("/local/supply-requests", "POST", input);
      if (generation !== this.generation) return;
      await this.refresh(generation);
    } catch (error) {
      if (generation === this.generation) this.fail(error);
    }
  }

  async edit(id: string, version: number, input: SupplyRequestInput): Promise<void> {
    if (!uuid(id) || !Number.isSafeInteger(version) || !isSupplyRequestInput(input)) return;
    const row = this.state.rows.find((item) => item.id === id && item.version === version);
    if (!row || (row.status !== "DRAFT" && row.status !== "RETURNED")) return;
    const generation = this.generation;
    this.state = { ...this.state, status: "BUSY", message: "正在保存修改…" };
    try {
      await this.request(`/local/supply-requests/${id}`, "PATCH", { ...input, version });
      if (generation !== this.generation) return;
      await this.refresh(generation);
    } catch (error) {
      if (generation === this.generation) this.fail(error);
    }
  }

  async command(action: SupplyRequestAction, id: string, version: number): Promise<void> {
    if (!uuid(id) || !Number.isSafeInteger(version)) return;
    const row = this.state.rows.find((item) => item.id === id && item.version === version);
    const allowed =
      (action === "submit" && (row?.status === "DRAFT" || row?.status === "RETURNED")) ||
      (action === "cancel" && (row?.status === "DRAFT" || row?.status === "RETURNED")) ||
      (action === "claim" && row?.status === "READY");
    if (!allowed || !this.handle) return;
    const generation = this.generation;
    this.state = { ...this.state, status: "BUSY", message: "正在更新申请状态…" };
    try {
      await this.request(`/local/supply-requests/${id}/${action}`, "POST", { version });
      if (generation !== this.generation) return;
      await this.refresh(generation);
    } catch (error) {
      if (generation === this.generation) this.fail(error);
    }
  }

  disconnect(): void {
    this.generation += 1;
    this.handle = null;
    this.state = {
      status: "IDLE",
      session: null,
      rows: [],
      summary: null,
      message: "离开页面后，本机申请资料已清除。",
    };
  }

  private fail(error: unknown): void {
    this.handle = null;
    this.state = {
      status: "ERROR",
      session: null,
      rows: [],
      summary: null,
      message: error instanceof Error ? error.message : "本机共享服务暂时不可用。",
    };
  }
}
