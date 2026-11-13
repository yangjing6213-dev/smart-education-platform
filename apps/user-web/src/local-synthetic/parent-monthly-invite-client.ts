import type {
  ChildMonthlyParentSummary,
  MonthlyFeedbackSupplements,
  ChildMonthlySourceCounts,
} from "@student-care/contracts";

export interface MonthlyApprovedRelationship {
  readonly id: string;
  readonly studentId: string;
  readonly version: number;
  readonly label: string;
}
export interface ParentMonthlyInviteSnapshot {
  readonly status: "IDLE" | "CONNECTING" | "BUSY" | "READY" | "DENIED" | "ERROR";
  readonly message: string;
  readonly monthlyFeedback: readonly ChildMonthlyParentSummary[];
  readonly relationships: readonly MonthlyApprovedRelationship[];
  readonly selectedRelationshipId: string | null;
  readonly requiresLogin: boolean;
}
export interface ParentMonthlyInviteClientOptions {
  readonly baseUrl: string;
  readonly fetcher?: typeof fetch;
}
const EMPTY: ParentMonthlyInviteSnapshot = {
  status: "IDLE",
  message: "请使用机构邀请账号登录后查看孩子月报。",
  monthlyFeedback: [],
  relationships: [],
  selectedRelationshipId: null,
  requiresLogin: false,
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const integer = (value: unknown, minimum = 1): value is number =>
  Number.isSafeInteger(value) && (value as number) >= minimum;
const invalid = () => new Error("孩子月报数据格式不正确。");
const fields = [
  "learningParticipation",
  "dailyHabits",
  "activityParticipation",
  "familySchoolCollaboration",
] as const;
function supplements(value: unknown): MonthlyFeedbackSupplements {
  if (
    !object(value) ||
    fields.some(
      (key) =>
        typeof value[key] !== "string" ||
        !["KEEP_WATCHING", "PROGRESSING", "FOLLOW_UP"].includes(value[key]),
    )
  )
    throw invalid();
  return {
    learningParticipation: value.learningParticipation,
    dailyHabits: value.dailyHabits,
    activityParticipation: value.activityParticipation,
    familySchoolCollaboration: value.familySchoolCollaboration,
  } as MonthlyFeedbackSupplements;
}
function counts(value: unknown): ChildMonthlySourceCounts {
  if (!object(value) || !integer(value.GROWTH_RECORD, 0) || !integer(value.ATTENDANCE_OVERVIEW, 0))
    throw invalid();
  return { GROWTH_RECORD: value.GROWTH_RECORD, ATTENDANCE_OVERVIEW: value.ATTENDANCE_OVERVIEW };
}
export function parseChildMonthlyParentRecords(
  value: unknown,
  expectedStudentId?: string,
  relationshipVersion?: number,
): readonly ChildMonthlyParentSummary[] {
  if (!object(value) || !Array.isArray(value.records)) throw invalid();
  const records = value.records.map((row: unknown): ChildMonthlyParentSummary => {
    if (
      !object(row) ||
      typeof row.id !== "string" ||
      !UUID.test(row.id) ||
      typeof row.studentId !== "string" ||
      !UUID.test(row.studentId) ||
      typeof row.studentLabel !== "string" ||
      !row.studentLabel.trim() ||
      row.studentLabel.length > 120 ||
      UUID.test(row.studentLabel) ||
      typeof row.month !== "string" ||
      !/^(?:19|20|21)\d{2}-(?:0[1-9]|1[0-2])$/u.test(row.month) ||
      !integer(row.publicationVersion) ||
      !integer(row.relationshipVersion) ||
      typeof row.acknowledged !== "boolean" ||
      (expectedStudentId !== undefined && row.studentId !== expectedStudentId) ||
      (relationshipVersion !== undefined && row.relationshipVersion !== relationshipVersion)
    )
      throw invalid();
    return {
      id: row.id,
      studentId: row.studentId,
      studentLabel: row.studentLabel,
      month: row.month,
      publicationVersion: row.publicationVersion,
      relationshipVersion: row.relationshipVersion,
      supplements: supplements(row.supplements),
      sourceCounts: counts(row.sourceCounts),
      acknowledged: row.acknowledged,
    };
  });
  if (new Set(records.map((row) => row.id)).size !== records.length) throw invalid();
  return records;
}
function parseRelationships(value: unknown): readonly MonthlyApprovedRelationship[] {
  if (!Array.isArray(value)) throw invalid();
  const relationships: MonthlyApprovedRelationship[] = [];
  const seen = new Set<string>();
  for (const row of value) {
    if (
      !object(row) ||
      typeof row.status !== "string" ||
      !["ACTIVE", "RELEASED"].includes(row.status)
    )
      throw invalid();
    if (row.status !== "ACTIVE") continue;
    if (
      row.relationship !== "GUARDIAN" ||
      typeof row.id !== "string" ||
      !UUID.test(row.id) ||
      seen.has(row.id) ||
      typeof row.student_id !== "string" ||
      !UUID.test(row.student_id) ||
      !integer(row.version) ||
      typeof row.approved_at !== "string" ||
      !Number.isFinite(Date.parse(row.approved_at))
    )
      throw invalid();
    seen.add(row.id);
    relationships.push({
      id: row.id,
      studentId: row.student_id,
      version: row.version,
      label: "孩子 " + (relationships.length + 1),
    });
  }
  return relationships;
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
      (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname) && url.port)
    )
  )
    throw new Error("孩子月报只能通过安全的同源网页读取。");
  return url.origin;
}
const statusOf = (value: unknown): number =>
  object(value) && typeof value.status === "number" ? value.status : 0;
const requestError = (status: number) =>
  Object.assign(
    new Error(
      status === 401
        ? "邀请登录已过期，请重新登录后查看。"
        : status === 403
          ? "当前账号没有孩子月报查看权限。"
          : status === 404
            ? "孩子关系或月报已不可用，请重新核对。"
            : status === 409
              ? "孩子月报已更新，请重新核对后操作。"
              : "孩子月报暂不可用，请重新连接。",
    ),
    { status },
  );

export class ParentMonthlyInviteClient {
  private value: ParentMonthlyInviteSnapshot = EMPTY;
  private readonly base: string;
  private readonly fetcher: typeof fetch;
  private generation = 0;
  private busy = false;
  public constructor(options: ParentMonthlyInviteClientOptions) {
    this.base = safeOrigin(options.baseUrl);
    this.fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
  }
  public get snapshot(): ParentMonthlyInviteSnapshot {
    return structuredClone(this.value);
  }
  public disconnect(): void {
    this.generation += 1;
    this.busy = false;
    this.value = EMPTY;
  }
  public connect(): Promise<void> {
    return this.refresh();
  }
  public async refresh(): Promise<void> {
    if (this.busy) return;
    const preferred = this.value.selectedRelationshipId;
    const generation = ++this.generation;
    this.busy = true;
    this.value = { ...EMPTY, status: "CONNECTING", message: "正在读取已批准的孩子关系及月报…" };
    try {
      await this.load(generation, preferred);
    } catch (cause) {
      if (generation === this.generation) this.fail(cause);
    } finally {
      if (generation === this.generation) this.busy = false;
    }
  }
  private async load(generation: number, preferred: string | null): Promise<void> {
    const relationships = parseRelationships(await this.request("/guardian-relationships"));
    if (generation !== this.generation) return;
    const selected = relationships.find((row) => row.id === preferred) ?? relationships[0];
    if (!selected) {
      this.value = {
        ...EMPTY,
        status: "READY",
        message: "当前没有已批准的孩子关系，请先完成关系绑定。",
      };
      return;
    }
    await this.loadChild(generation, relationships, selected);
  }
  private async loadChild(
    generation: number,
    relationships: readonly MonthlyApprovedRelationship[],
    selected: MonthlyApprovedRelationship,
  ): Promise<void> {
    const records = parseChildMonthlyParentRecords(
      await this.request("/parent/relationships/" + selected.id + "/monthly-reports"),
      selected.studentId,
      selected.version,
    );
    if (generation !== this.generation) return;
    this.value = {
      status: "READY",
      monthlyFeedback: records,
      relationships: relationships.map((row) =>
        row.id === selected.id && records[0] ? { ...row, label: records[0].studentLabel } : row,
      ),
      selectedRelationshipId: selected.id,
      requiresLogin: false,
      message: records.length ? "孩子月报已更新。" : "这个孩子当前没有已发布的月报。",
    };
  }
  public async selectRelationship(id: string): Promise<void> {
    if (this.busy || this.value.status !== "READY" || id === this.value.selectedRelationshipId)
      return;
    const selected = this.value.relationships.find((row) => row.id === id);
    if (!selected) return;
    const relationships = this.value.relationships;
    const generation = ++this.generation;
    this.busy = true;
    this.value = { ...EMPTY, status: "BUSY", message: "正在读取所选孩子的月报…" };
    try {
      await this.loadChild(generation, relationships, selected);
    } catch (cause) {
      if (generation === this.generation) this.fail(cause);
    } finally {
      if (generation === this.generation) this.busy = false;
    }
  }
  public async acknowledge(id: string): Promise<void> {
    if (this.busy || this.value.status !== "READY" || !UUID.test(id)) return;
    const selected = this.value.relationships.find(
      (row) => row.id === this.value.selectedRelationshipId,
    );
    const current = this.value.monthlyFeedback.find((row) => row.id === id);
    if (
      !selected ||
      !current ||
      current.acknowledged ||
      current.studentId !== selected.studentId ||
      current.relationshipVersion !== selected.version
    )
      return;
    const previous = this.value;
    const generation = ++this.generation;
    this.busy = true;
    this.value = { ...EMPTY, status: "BUSY", message: "正在确认知悉…" };
    try {
      const data = await this.request(
        "/parent/relationships/" + selected.id + "/monthly-reports/" + id + "/ack",
        "POST",
        {
          publicationVersion: current.publicationVersion,
          relationshipVersion: current.relationshipVersion,
        },
      );
      if (generation !== this.generation) return;
      if (!object(data) || data.acknowledged !== true) throw invalid();
      this.value = {
        ...previous,
        status: "READY",
        message: "已确认知悉。",
        monthlyFeedback: previous.monthlyFeedback.map((row) =>
          row.id === id ? { ...row, acknowledged: true } : row,
        ),
      };
    } catch (cause) {
      if (generation !== this.generation) return;
      if (statusOf(cause) === 409) {
        try {
          await this.load(generation, selected.id);
          if (generation === this.generation)
            this.value = { ...this.value, message: "内容或绑定关系已更新，请重新核对后操作。" };
        } catch (reloadError) {
          if (generation === this.generation) this.fail(reloadError);
        }
      } else this.fail(cause);
    } finally {
      if (generation === this.generation) this.busy = false;
    }
  }
  private fail(cause: unknown): void {
    const status = statusOf(cause);
    this.value = {
      ...EMPTY,
      status: status === 401 || status === 403 ? "DENIED" : "ERROR",
      requiresLogin: status === 401,
      message: requestError(status).message,
    };
  }
  private async request(path: string, method = "GET", body?: object): Promise<unknown> {
    let response: Response;
    try {
      response = await this.fetcher(new URL("/api-local" + path, this.base), {
        method,
        credentials: "same-origin",
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(10000),
        headers: {
          accept: "application/json",
          ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch {
      throw requestError(0);
    }
    if (!response.ok) throw requestError(response.status);
    const envelope: unknown = await response.json().catch(() => undefined);
    if (!object(envelope) || !("data" in envelope)) throw invalid();
    return envelope.data;
  }
}
