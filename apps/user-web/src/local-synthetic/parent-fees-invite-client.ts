import {
  approvedStudentLabels,
  projectBinding,
  projectDocuments,
  projectLedger,
  type ParentFeesSnapshot,
} from "../pages/parent-fees.js";

export type ParentFeesInviteSnapshot = Omit<ParentFeesSnapshot, "status"> & {
  readonly status: ParentFeesSnapshot["status"] | "SIGNED_OUT";
};

const EMPTY: ParentFeesInviteSnapshot = {
  status: "IDLE",
  bindingStatus: "NONE",
  documents: [],
  ledger: null,
  message: "请使用机构邀请账号登录。",
};

const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function failure(status: number) {
  return Object.assign(new Error("家长费用服务暂不可用。"), { status });
}

function sameOrigin(value: string): string {
  const url = new URL(value);
  const localHttp =
    url.protocol === "http:" &&
    ["127.0.0.1", "localhost"].includes(url.hostname) &&
    url.port !== "";
  if (
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    !(url.protocol === "https:" || localHttp)
  )
    throw new Error("费用资料只能通过安全的同源网页读取。");
  return url.origin;
}

export class ParentFeesInviteClient {
  private value: ParentFeesInviteSnapshot = EMPTY;
  private readonly base: string;
  private readonly fetcher: typeof fetch;
  private generation = 0;
  private busy = false;

  constructor(options: { readonly baseUrl: string; readonly fetcher?: typeof fetch }) {
    this.base = sameOrigin(options.baseUrl);
    this.fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
  }

  get snapshot(): ParentFeesInviteSnapshot {
    return this.value;
  }

  disconnect(): void {
    this.generation += 1;
    this.busy = false;
    this.value = EMPTY;
  }

  async connect(): Promise<void> {
    if (this.busy) return;
    const generation = ++this.generation;
    this.busy = true;
    this.value = {
      ...EMPTY,
      status: "CONNECTING",
      message: "正在确认邀请账号并读取费用资料…",
    };
    try {
      await this.load(generation);
    } catch (cause) {
      if (generation === this.generation) this.fail(cause);
    } finally {
      if (generation === this.generation) this.busy = false;
    }
  }

  async refresh(): Promise<void> {
    if (this.busy || this.value.status !== "READY") return;
    const generation = this.generation;
    this.busy = true;
    this.value = { ...EMPTY, status: "BUSY", message: "正在更新费用资料…" };
    try {
      await this.load(generation);
    } catch (cause) {
      if (generation === this.generation) this.fail(cause);
    } finally {
      if (generation === this.generation) this.busy = false;
    }
  }

  private async load(generation: number): Promise<void> {
    const payload = await this.request();
    if (
      !object(payload) ||
      Object.keys(payload).sort().join(",") !== "bindingApplications,documents,ledger"
    )
      throw failure(502);
    const bindingStatus = projectBinding(payload.bindingApplications);
    const documents = projectDocuments(payload.documents);
    const ledger = projectLedger(payload.ledger);
    const approvedLabels = approvedStudentLabels(payload.bindingApplications);
    if (
      documents.some((row) => approvedLabels.get(row.studentAlias) !== row.studentLabel) ||
      ledger.entries.some((row) => approvedLabels.get(row.studentAlias) !== row.studentLabel)
    )
      throw failure(502);
    if (generation !== this.generation) return;
    if (bindingStatus !== "APPROVED") {
      if (documents.length > 0 || ledger.entries.length > 0) throw failure(502);
      this.value = {
        status: "READY",
        bindingStatus,
        documents: [],
        ledger: null,
        message:
          bindingStatus === "PENDING"
            ? "监护关系正在审核；审核通过后可查看费用资料。"
            : "当前没有已审核的监护关系，暂不能查看费用资料。",
      };
      return;
    }
    this.value = {
      status: "READY",
      bindingStatus,
      documents,
      ledger,
      message: "仅显示当前已审核合成关系内的只读资料；不代表真实收付款。",
    };
  }

  private async request(): Promise<unknown> {
    const response = await this.fetcher(new URL("/api-local/parent/fees", this.base).href, {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw failure(response.status);
    let envelope: unknown;
    try {
      envelope = await response.json();
    } catch {
      throw failure(502);
    }
    if (!object(envelope) || !("data" in envelope)) throw failure(502);
    return envelope.data;
  }

  private fail(cause: unknown): void {
    const status = object(cause) && typeof cause.status === "number" ? cause.status : 0;
    this.value = {
      ...EMPTY,
      status: status === 401 ? "SIGNED_OUT" : status === 403 ? "DENIED" : "ERROR",
      message:
        status === 401
          ? "请登录家长邀请账号，继续查看费用资料。"
          : status === 403
            ? "当前账号没有查看费用资料的权限，请联系机构确认。"
            : "费用资料暂时无法读取，已清除已显示内容，请稍后重试。",
    };
  }
}
