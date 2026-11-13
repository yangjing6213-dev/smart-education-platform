import { CARE_RECORD_OPTIONS, type CareRecordValues } from "../pages/care-record-workflow.js";

export type ParentCareInviteReceipt = "UNREAD" | "READ" | "ACKNOWLEDGED";
export type ParentCareInviteAction = "read" | "acknowledge";
export type ParentCareInviteRecord = {
  readonly id: string;
  readonly version: number;
  readonly publicationVersion: number;
  readonly date: string;
  readonly studentLabel: string;
  readonly values: Readonly<Record<keyof CareRecordValues, string>>;
  readonly receipt: ParentCareInviteReceipt;
};
export type ParentCareInviteSnapshot = {
  readonly status: "IDLE" | "CONNECTING" | "BUSY" | "READY" | "ERROR" | "DENIED";
  readonly records: readonly ParentCareInviteRecord[];
  readonly message: string;
};

const fields = ["arrival", "homework", "meal", "rest", "activity", "wellbeing"] as const;
const recordKeys = [
  "id",
  "student_display_ref",
  "service_date",
  "values",
  "version",
  "publication_version",
  "receipt_status",
] as const;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const empty: ParentCareInviteSnapshot = {
  status: "IDLE",
  records: [],
  message: "请使用机构邀请账号登录。",
};
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const failure = (status: number) => Object.assign(new Error("成长记录服务暂不可用。"), { status });

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every((key) => key in value);
}

function parseValues(value: unknown): Readonly<Record<keyof CareRecordValues, string>> {
  if (!object(value) || !exactKeys(value, fields)) throw failure(502);
  const projected = {} as Record<keyof CareRecordValues, string>;
  for (const field of fields) {
    const option = CARE_RECORD_OPTIONS[field].find((item) => item.value === value[field]);
    if (!option) throw failure(502);
    projected[field] = option.label;
  }
  return projected;
}

function parseRecord(value: unknown): ParentCareInviteRecord {
  if (
    !object(value) ||
    !exactKeys(value, recordKeys) ||
    typeof value.id !== "string" ||
    !uuid.test(value.id) ||
    typeof value.student_display_ref !== "string" ||
    !value.student_display_ref.trim() ||
    value.student_display_ref.length > 80 ||
    uuid.test(value.student_display_ref) ||
    typeof value.service_date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/u.test(value.service_date) ||
    new Date(`${value.service_date}T00:00:00.000Z`).toISOString().slice(0, 10) !==
      value.service_date ||
    !Number.isSafeInteger(value.version) ||
    (value.version as number) < 1 ||
    !Number.isSafeInteger(value.publication_version) ||
    (value.publication_version as number) < 1 ||
    !["UNREAD", "READ", "ACKNOWLEDGED"].includes(String(value.receipt_status))
  )
    throw failure(502);
  return {
    id: value.id,
    version: value.version as number,
    publicationVersion: value.publication_version as number,
    date: value.service_date,
    studentLabel: value.student_display_ref,
    values: parseValues(value.values),
    receipt: value.receipt_status as ParentCareInviteReceipt,
  };
}

function parseList(value: unknown): ParentCareInviteRecord[] {
  if (!Array.isArray(value)) throw failure(502);
  const records = value.map(parseRecord);
  if (new Set(records.map((record) => record.id)).size !== records.length) throw failure(502);
  return records;
}

function safeOrigin(value: string): string {
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
    throw new Error("成长记录只能通过安全的同源网页读取。");
  return url.origin;
}

export class ParentCareInviteClient {
  private value: ParentCareInviteSnapshot = empty;
  private readonly base: string;
  private readonly fetcher: typeof fetch;
  private generation = 0;
  private busy = false;

  constructor(options: { readonly baseUrl: string; readonly fetcher?: typeof fetch }) {
    this.base = safeOrigin(options.baseUrl);
    this.fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
  }

  get snapshot(): ParentCareInviteSnapshot {
    return this.value;
  }

  disconnect(): void {
    this.generation += 1;
    this.busy = false;
    this.value = empty;
  }

  async refresh(): Promise<void> {
    if (this.busy) return;
    const generation = ++this.generation;
    this.busy = true;
    this.value = {
      status: this.value.records.length ? "BUSY" : "CONNECTING",
      records: this.value.records,
      message: "正在读取已发布的成长记录…",
    };
    try {
      await this.loadRecords(generation);
    } catch (cause) {
      if (generation === this.generation) this.fail(cause);
    } finally {
      if (generation === this.generation) this.busy = false;
    }
  }

  async receipt(recordId: string, action: ParentCareInviteAction): Promise<void> {
    if (this.busy || !uuid.test(recordId) || this.value.status !== "READY") return;
    const current = this.value.records.find((record) => record.id === recordId);
    if (
      !current ||
      (action === "read" && current.receipt !== "UNREAD") ||
      (action === "acknowledge" && current.receipt !== "READ")
    )
      return;

    const generation = ++this.generation;
    this.busy = true;
    this.value = {
      status: "BUSY",
      records: this.value.records,
      message: action === "read" ? "正在打开成长记录…" : "正在确认知悉…",
    };
    try {
      const updated = parseRecord(
        await this.request(`/api-local/parent/care-records/${current.id}/receipt`, "POST", {
          version: current.version,
          publication_version: current.publicationVersion,
          action,
        }),
      );
      const expectedReceipt = action === "read" ? "READ" : "ACKNOWLEDGED";
      if (
        updated.id !== current.id ||
        updated.version !== current.version ||
        updated.publicationVersion !== current.publicationVersion ||
        updated.receipt !== expectedReceipt
      )
        throw failure(409);
      await this.loadRecords(generation);
    } catch (cause) {
      if (generation === this.generation) this.fail(cause);
    } finally {
      if (generation === this.generation) this.busy = false;
    }
  }

  private async loadRecords(generation: number): Promise<void> {
    const records = parseList(await this.request("/api-local/parent/care-records", "GET"));
    if (generation !== this.generation) return;
    this.value = {
      status: "READY",
      records,
      message: "只显示当前受邀账号可查看的已发布记录。",
    };
  }

  private async request(path: string, method: "GET" | "POST", body?: object): Promise<unknown> {
    if (
      !(
        path === "/api-local/parent/care-records" ||
        /^\/api-local\/parent\/care-records\/[0-9a-f-]{36}\/receipt$/iu.test(path)
      ) ||
      (method === "GET") !== (path === "/api-local/parent/care-records")
    )
      throw failure(404);
    const response = await this.fetcher(new URL(path, this.base).href, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(5000),
      ...(body === undefined
        ? {}
        : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
    });
    if (!response.ok) throw failure(response.status);
    const payload: unknown = await response.json();
    if (!object(payload) || !("data" in payload)) throw failure(502);
    return payload.data;
  }

  private fail(cause: unknown): void {
    const status = object(cause) && typeof cause.status === "number" ? cause.status : 0;
    this.value = {
      ...empty,
      status: status === 401 || status === 403 ? "DENIED" : "ERROR",
      message:
        status === 401 || status === 403
          ? "登录已过期或当前账号没有查看权限，页面已清除已显示的记录。"
          : status === 409
            ? "记录已更新，请刷新后重新查看。"
            : "成长记录暂时无法读取，请稍后刷新。",
    };
  }
}
