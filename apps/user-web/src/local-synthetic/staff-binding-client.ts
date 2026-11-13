export type StaffBindingApplication = {
  readonly id: string;
  readonly relationship: "GUARDIAN";
  readonly status: "PENDING";
  readonly version: number;
  readonly submitted_at: string;
  readonly reviewed_at: string | null;
  readonly applicant_label: string;
  readonly student_label: string;
};

export type StaffBindingSnapshot = {
  readonly status: "IDLE" | "BUSY" | "READY" | "DENIED" | "ERROR";
  readonly applications: readonly StaffBindingApplication[];
  readonly message: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const empty: StaffBindingSnapshot = {
  status: "IDLE",
  applications: [],
  message: "请使用已获关系审核权限的员工账号登录。",
};
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= 120;

function origin(value: string): string {
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
    throw new Error("关系审核只能通过安全的同源网页访问。");
  return url.origin;
}

function parseApplications(value: unknown): StaffBindingApplication[] {
  if (!Array.isArray(value) || value.length > 200) throw new Error("申请列表格式无效。");
  const rows = value.map((item) => {
    if (
      !object(item) ||
      typeof item.id !== "string" ||
      !UUID.test(item.id) ||
      item.relationship !== "GUARDIAN" ||
      item.status !== "PENDING" ||
      !Number.isSafeInteger(item.version) ||
      Number(item.version) < 1 ||
      typeof item.submitted_at !== "string" ||
      !Number.isFinite(Date.parse(item.submitted_at)) ||
      (item.reviewed_at !== null && typeof item.reviewed_at !== "string") ||
      !text(item.applicant_label) ||
      !text(item.student_label)
    )
      throw new Error("申请列表内容无效。");
    return item as unknown as StaffBindingApplication;
  });
  if (new Set(rows.map((row) => row.id)).size !== rows.length)
    throw new Error("申请列表包含重复记录。");
  return rows;
}

export class StaffBindingClient {
  private readonly baseUrl: string;
  private readonly fetcher: typeof fetch;
  private busy = false;
  private generation = 0;
  private value: StaffBindingSnapshot = empty;

  public constructor(options: { readonly baseUrl: string; readonly fetcher?: typeof fetch }) {
    this.baseUrl = origin(options.baseUrl);
    this.fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
  }

  public get snapshot(): StaffBindingSnapshot {
    return structuredClone(this.value);
  }

  public disconnect(): void {
    this.generation += 1;
    this.busy = false;
    this.value = empty;
  }

  public async refresh(): Promise<void> {
    if (this.busy) return;
    const generation = ++this.generation;
    this.busy = true;
    this.value = { ...this.value, status: "BUSY", message: "正在读取待审核申请…" };
    try {
      const data = await this.request("/api-local/staff/guardian-binding/applications");
      if (generation !== this.generation) return;
      const applications = parseApplications(data);
      this.value = {
        status: "READY",
        applications,
        message: applications.length ? "已读取当前校区待审核申请。" : "当前校区没有待审核申请。",
      };
    } catch (cause) {
      if (generation === this.generation) this.fail(statusOf(cause));
    } finally {
      if (generation === this.generation) this.busy = false;
    }
  }

  public async review(id: string, version: number, action: "approve" | "reject"): Promise<void> {
    if (this.busy) return;
    if (!UUID.test(id) || !Number.isSafeInteger(version) || version < 1) {
      this.fail(0);
      return;
    }
    const generation = ++this.generation;
    this.busy = true;
    this.value = {
      ...this.value,
      status: "BUSY",
      message: action === "approve" ? "正在批准关系申请…" : "正在退回关系申请…",
    };
    try {
      await this.request(`/api-local/staff/guardian-binding/applications/${id}/review`, {
        version,
        action,
      });
      if (generation === this.generation) await this.refreshFor(generation);
    } catch (cause) {
      if (generation === this.generation) this.fail(statusOf(cause));
    } finally {
      if (generation === this.generation) this.busy = false;
    }
  }

  private async refreshFor(generation: number): Promise<void> {
    try {
      const data = await this.request("/api-local/staff/guardian-binding/applications");
      if (generation !== this.generation) return;
      const applications = parseApplications(data);
      this.value = {
        status: "READY",
        applications,
        message: "审核结果已保存。",
      };
    } catch (cause) {
      if (generation === this.generation) this.fail(statusOf(cause));
    }
  }

  private async request(path: string, body?: object): Promise<unknown> {
    const response = await this.fetcher(new URL(path, this.baseUrl).href, {
      method: body === undefined ? "GET" : "POST",
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(5000),
      ...(body === undefined
        ? {}
        : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
    });
    if (!response.ok)
      throw Object.assign(new Error("Staff binding request failed"), { status: response.status });
    const payload: unknown = await response.json();
    if (!object(payload) || !("data" in payload)) throw new Error("Invalid staff binding response");
    return payload.data;
  }

  private fail(status: number): void {
    this.value = {
      status: status === 401 ? "IDLE" : status === 403 ? "DENIED" : "ERROR",
      applications: [],
      message:
        status === 401
          ? "请使用受邀员工账号登录。"
          : status === 403
            ? "当前账号没有关系审核权限或申请不在授权校区。"
            : "关系申请暂时无法读取，请刷新后重试。",
    };
  }
}

function statusOf(cause: unknown): number {
  return object(cause) && typeof cause.status === "number" ? cause.status : 0;
}
