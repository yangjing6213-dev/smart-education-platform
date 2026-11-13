import type {
  ApprovedLearningStudent,
  ParentLearningControl,
  ParentLearningSnapshot,
  ParentLearningSummary,
} from "./learning.js";

type Projection = Pick<
  ParentLearningSnapshot,
  "approvedStudents" | "parentControls" | "parentSummary" | "parentSummaryUpdatedAt"
>;

const EMPTY: ParentLearningSnapshot = {
  status: "IDLE",
  message: "请使用机构邀请账号登录后查看学习摘要。",
  approvedStudents: [],
  knowledgeResources: [],
  sessions: [],
  activeSession: null,
  parentControls: [],
  parentSummary: [],
  parentSummaryUpdatedAt: null,
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  return Object.keys(value).sort().join(",") === [...expected].sort().join(",");
}

function localError(status: number): Error & { status: number } {
  const message =
    status === 401
      ? "邀请登录已过期，请重新登录后查看。"
      : status === 403
        ? "当前邀请账号没有家长学习查看权限。"
        : "学习摘要暂不可用，请稍后重试。";
  return Object.assign(new Error(message), { status });
}

function safeOrigin(value: string): string {
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
    throw new Error("学习摘要只能通过安全的同源网页读取。");
  return url.origin;
}

function parseApprovedStudent(value: unknown): ApprovedLearningStudent | null {
  if (
    !object(value) ||
    !hasExactKeys(value, ["studentId", "studentLabel", "classLabel"]) ||
    typeof value.studentId !== "string" ||
    !UUID.test(value.studentId) ||
    typeof value.studentLabel !== "string" ||
    typeof value.classLabel !== "string"
  )
    return null;
  return {
    studentId: value.studentId,
    studentLabel: value.studentLabel,
    classLabel: value.classLabel,
  };
}

function parseControl(value: unknown): ParentLearningControl | null {
  if (
    !object(value) ||
    !hasExactKeys(value, [
      "studentId",
      "studentLabel",
      "enabled",
      "maxDurationMinutes",
      "maxHintLevel",
      "contactStatus",
    ]) ||
    typeof value.studentId !== "string" ||
    !UUID.test(value.studentId) ||
    typeof value.studentLabel !== "string" ||
    typeof value.enabled !== "boolean" ||
    typeof value.maxDurationMinutes !== "number" ||
    ![5, 10, 15].includes(value.maxDurationMinutes) ||
    typeof value.maxHintLevel !== "number" ||
    ![0, 1, 2, 3].includes(value.maxHintLevel) ||
    (value.contactStatus !== "NOT_REQUESTED" && value.contactStatus !== "RECORDED_LOCAL")
  )
    return null;
  return {
    studentId: value.studentId,
    studentLabel: value.studentLabel,
    enabled: value.enabled,
    maxDurationMinutes: value.maxDurationMinutes as 5 | 10 | 15,
    maxHintLevel: value.maxHintLevel as 0 | 1 | 2 | 3,
    contactStatus: value.contactStatus,
  };
}

function parseSummary(value: unknown): ParentLearningSummary | null {
  if (
    !object(value) ||
    !hasExactKeys(value, [
      "studentId",
      "studentLabel",
      "usedMinutes",
      "sessionCount",
      "completedSessions",
      "knowledgePoints",
      "attentionCount",
    ]) ||
    typeof value.studentId !== "string" ||
    !UUID.test(value.studentId) ||
    typeof value.studentLabel !== "string" ||
    ![value.usedMinutes, value.sessionCount, value.completedSessions, value.attentionCount].every(
      (count) => Number.isSafeInteger(count) && Number(count) >= 0,
    ) ||
    !Array.isArray(value.knowledgePoints)
  )
    return null;
  const knowledgePoints = value.knowledgePoints.flatMap((item) =>
    object(item) &&
    hasExactKeys(item, ["label", "sessionCount", "completedSessions"]) &&
    typeof item.label === "string" &&
    Number.isSafeInteger(item.sessionCount) &&
    Number(item.sessionCount) >= 0 &&
    Number.isSafeInteger(item.completedSessions) &&
    Number(item.completedSessions) >= 0
      ? [
          {
            label: item.label,
            sessionCount: item.sessionCount as number,
            completedSessions: item.completedSessions as number,
          },
        ]
      : [],
  );
  if (knowledgePoints.length !== value.knowledgePoints.length) return null;
  return {
    studentId: value.studentId,
    studentLabel: value.studentLabel,
    usedMinutes: value.usedMinutes as number,
    sessionCount: value.sessionCount as number,
    completedSessions: value.completedSessions as number,
    knowledgePoints,
    attentionCount: value.attentionCount as number,
  };
}

function parseProjection(value: unknown): Projection | null {
  if (
    !object(value) ||
    !hasExactKeys(value, ["approvedStudents", "parentControls", "parentSummary", "parentSummaryUpdatedAt"]) ||
    !Array.isArray(value.approvedStudents) ||
    !Array.isArray(value.parentControls) ||
    !Array.isArray(value.parentSummary) ||
    typeof value.parentSummaryUpdatedAt !== "string" ||
    Number.isNaN(Date.parse(value.parentSummaryUpdatedAt))
  )
    return null;
  const approvedStudents = value.approvedStudents.flatMap((row) => {
    const parsed = parseApprovedStudent(row);
    return parsed ? [parsed] : [];
  });
  const parentControls = value.parentControls.flatMap((row) => {
    const parsed = parseControl(row);
    return parsed ? [parsed] : [];
  });
  const parentSummary = value.parentSummary.flatMap((row) => {
    const parsed = parseSummary(row);
    return parsed ? [parsed] : [];
  });
  if (
    approvedStudents.length !== value.approvedStudents.length ||
    parentControls.length !== value.parentControls.length ||
    parentSummary.length !== value.parentSummary.length
  )
    return null;
  const approvedIds = new Set(approvedStudents.map(({ studentId }) => studentId));
  if (
    approvedIds.size !== approvedStudents.length ||
    parentControls.length !== approvedStudents.length ||
    parentControls.some((row) => !approvedIds.has(row.studentId)) ||
    parentSummary.some((row) => !approvedIds.has(row.studentId))
  )
    return null;
  return {
    approvedStudents,
    parentControls,
    parentSummary,
    parentSummaryUpdatedAt: value.parentSummaryUpdatedAt,
  };
}

export class ParentLearningInviteClient {
  private value: ParentLearningSnapshot = EMPTY;
  private readonly base: string;
  private readonly fetcher: typeof fetch;
  private generation = 0;
  private busy = false;

  public constructor(options: { readonly baseUrl: string; readonly fetcher?: typeof fetch }) {
    this.base = safeOrigin(options.baseUrl);
    this.fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
  }

  public get snapshot(): ParentLearningSnapshot {
    return this.value;
  }

  public disconnect(): void {
    this.generation += 1;
    this.busy = false;
    this.value = EMPTY;
  }

  public async connect(): Promise<void> {
    if (this.busy) return;
    const generation = ++this.generation;
    this.busy = true;
    this.value = { ...EMPTY, status: "CONNECTING", message: "正在确认邀请账号并读取学习摘要…" };
    try {
      await this.load(generation);
    } catch (error) {
      if (generation === this.generation) this.fail(error);
    } finally {
      if (generation === this.generation) this.busy = false;
    }
  }

  public async refresh(): Promise<void> {
    if (this.busy || this.value.status !== "READY") return;
    const generation = this.generation;
    this.busy = true;
    this.value = { ...this.value, status: "BUSY", message: "正在更新学习摘要…" };
    try {
      await this.load(generation);
    } catch (error) {
      if (generation === this.generation) this.fail(error);
    } finally {
      if (generation === this.generation) this.busy = false;
    }
  }

  public async updateParentControls(
    studentId: string,
    controls: Pick<ParentLearningControl, "enabled" | "maxDurationMinutes" | "maxHintLevel">,
  ): Promise<void> {
    const current = this.value.parentControls?.find((row) => row.studentId === studentId);
    if (
      this.busy ||
      this.value.status !== "READY" ||
      !current ||
      !this.value.approvedStudents.some((row) => row.studentId === studentId) ||
      typeof controls.enabled !== "boolean" ||
      ![5, 10, 15].includes(controls.maxDurationMinutes) ||
      ![0, 1, 2, 3].includes(controls.maxHintLevel)
    ) {
      this.value = { ...this.value, message: "只能为已审核关系保存有效的学习监督设置。" };
      return;
    }
    await this.mutate(
      `/api-local/parent/learning/${encodeURIComponent(studentId)}/controls`,
      controls,
      (result) => {
        const saved = parseControl(result);
        return (
          saved?.studentId === studentId &&
          saved.enabled === controls.enabled &&
          saved.maxDurationMinutes === controls.maxDurationMinutes &&
          saved.maxHintLevel === controls.maxHintLevel
        );
      },
      "学习监督设置已保存。",
    );
  }

  public async contactTeacher(studentId: string): Promise<void> {
    if (
      this.busy ||
      this.value.status !== "READY" ||
      !this.value.parentControls?.some((row) => row.studentId === studentId)
    ) {
      this.value = { ...this.value, message: "只能为已审核关系记录联系意向。" };
      return;
    }
    await this.mutate(
      `/api-local/parent/learning/${encodeURIComponent(studentId)}/contact`,
      {},
      (result) =>
        object(result) &&
        hasExactKeys(result, ["id", "studentId", "studentLabel", "status", "createdAt"]) &&
        result.studentId === studentId &&
        result.status === "RECORDED_LOCAL" &&
        typeof result.id === "string" &&
        typeof result.studentLabel === "string" &&
        typeof result.createdAt === "string",
      "联系意向已在本机记录，尚未发送消息。",
    );
  }

  private async mutate(
    path: string,
    body: unknown,
    verify: (result: unknown) => boolean,
    message: string,
  ): Promise<void> {
    const generation = this.generation;
    this.busy = true;
    this.value = { ...this.value, status: "BUSY", message: "正在保存家长设置…" };
    try {
      const result = await this.request(path, "POST", body);
      if (!verify(result)) throw localError(502);
      const projection = await this.readProjection();
      if (generation === this.generation)
        this.value = { ...EMPTY, status: "READY", message, ...projection };
    } catch (error) {
      if (generation === this.generation) this.fail(error);
    } finally {
      if (generation === this.generation) this.busy = false;
    }
  }

  private async load(generation: number): Promise<void> {
    const projection = await this.readProjection();
    if (generation === this.generation)
      this.value = {
        ...EMPTY,
        status: "READY",
        message: "学习摘要已按当前邀请账号更新。",
        ...projection,
      };
  }

  private async readProjection(): Promise<Projection> {
    const data = await this.request("/api-local/parent/learning", "GET");
    const projection = parseProjection(data);
    if (!projection) throw localError(502);
    return projection;
  }

  private async request(path: string, method: "GET" | "POST", body?: unknown): Promise<unknown> {
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
    if (!response.ok) throw localError(response.status);
    let envelope: unknown;
    try {
      envelope = await response.json();
    } catch {
      throw localError(502);
    }
    if (!object(envelope) || !("data" in envelope)) throw localError(502);
    return envelope.data;
  }

  private fail(error: unknown): void {
    const status = object(error) && typeof error.status === "number" ? error.status : 0;
    const safeError = localError(status);
    this.value = {
      ...EMPTY,
      status: "DENIED",
      message: safeError.message,
    };
  }
}
