export type PickupReviewProfile = "owner-east" | "owner-west" | "teacher-east" | "platform-admin";
export type PickupExceptionAction = "follow" | "resolve";

type Status = "IDLE" | "CONNECTING" | "READY" | "BUSY" | "ERROR";
type ExceptionStatus = "OPEN" | "FOLLOWING" | "RESOLVED";
type ExceptionCategory =
  "NO_AUTHORIZATION" | "INFORMATION_MISMATCH" | "INVALID_CREDENTIAL" | "OVERDUE";
type ExceptionOutcome = "CONTACT_GUARDIAN" | "INFORMATION_RECHECKED" | "ARRANGEMENT_CONFIRMED";

interface Session {
  readonly profile: PickupReviewProfile;
  readonly label: string;
  readonly actorId: string;
  readonly tenantId: string;
  readonly campusId: string;
  readonly classIds: readonly string[];
  readonly actions: readonly string[];
}

interface PickupAuthorization {
  readonly id: string;
  readonly version: number;
  readonly status: "DRAFT" | "ACTIVE" | "REVOKED";
  readonly currentlyValid: boolean;
  readonly studentLabel: string;
  readonly recipientLabel: string;
  readonly type: "REGULAR" | "TEMPORARY";
  readonly startDate: string;
  readonly endDate: string;
  readonly startTime: string;
  readonly endTime: string;
}

interface PickupRecord {
  readonly id: string;
  readonly version: number;
  readonly date: string;
  readonly time: string;
  readonly studentLabel: string;
  readonly recipient: string;
}

interface PickupException {
  readonly id: string;
  readonly version: number;
  readonly status: ExceptionStatus;
  readonly studentLabel: string;
  readonly date: string;
  readonly category: ExceptionCategory;
  readonly outcome: ExceptionOutcome | null;
}

interface PickupSummary {
  readonly synthetic: true;
  readonly counts: {
    readonly activeAuthorizations: number;
    readonly completedRecords: number;
    readonly openExceptions: number;
    readonly followingExceptions: number;
    readonly resolvedExceptions: number;
  };
}

export interface PickupReviewSnapshot {
  readonly profile: PickupReviewProfile;
  readonly status: Status;
  readonly session: Session | null;
  readonly authorizations: readonly PickupAuthorization[];
  readonly records: readonly PickupRecord[];
  readonly exceptions: readonly PickupException[];
  readonly summary: PickupSummary | null;
  readonly message: string;
}

const PROFILES: readonly PickupReviewProfile[] = [
  "owner-east",
  "owner-west",
  "teacher-east",
  "platform-admin",
];
const EXCEPTION_CATEGORIES = [
  "NO_AUTHORIZATION",
  "INFORMATION_MISMATCH",
  "INVALID_CREDENTIAL",
  "OVERDUE",
] as const satisfies readonly ExceptionCategory[];
const EXCEPTION_OUTCOMES = [
  "CONTACT_GUARDIAN",
  "INFORMATION_RECHECKED",
  "ARRANGEMENT_CONFIRMED",
] as const satisfies readonly ExceptionOutcome[];
const CATEGORY_LABEL: Readonly<Record<ExceptionCategory, string>> = {
  NO_AUTHORIZATION: "未找到有效授权",
  INFORMATION_MISMATCH: "信息不一致",
  INVALID_CREDENTIAL: "凭证不可用",
  OVERDUE: "超过约定时间",
};
const STATUS_LABEL: Readonly<Record<ExceptionStatus, string>> = {
  OPEN: "待跟进",
  FOLLOWING: "跟进中",
  RESOLVED: "已解决",
};
const OUTCOME_LABEL: Readonly<Record<ExceptionOutcome, string>> = {
  CONTACT_GUARDIAN: "已记录联系家长",
  INFORMATION_RECHECKED: "已记录重新核对",
  ARRANGEMENT_CONFIRMED: "已记录后续安排",
};
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isText = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= 120;
const isUuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
const isDate = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/u.test(value);
const isTime = (value: unknown): value is string =>
  typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/u.test(value);
const isOneOf = <T extends string>(value: unknown, values: readonly T[]): value is T =>
  typeof value === "string" && values.includes(value as T);

function validProfile(value: unknown): value is PickupReviewProfile {
  return isOneOf(value, PROFILES);
}

function validSession(value: unknown, profile: PickupReviewProfile): value is Session {
  return Boolean(
    isObject(value) &&
    value.profile === profile &&
    isText(value.label) &&
    isUuid(value.actorId) &&
    isUuid(value.tenantId) &&
    isUuid(value.campusId) &&
    Array.isArray(value.classIds) &&
    value.classIds.length <= 100 &&
    value.classIds.every(isUuid) &&
    Array.isArray(value.actions) &&
    value.actions.length <= 100 &&
    value.actions.every(isText),
  );
}

function sameScope(row: Record<string, unknown>, session: Session): boolean {
  // The local API filters each list by the active member's tenant/campus/class,
  // but intentionally omits those internal scope identifiers from its DTOs.
  // When an endpoint does return scope metadata, use it as an additional guard.
  return (
    (row.tenantId === undefined || (isUuid(row.tenantId) && row.tenantId === session.tenantId)) &&
    (row.campusId === undefined || (isUuid(row.campusId) && row.campusId === session.campusId)) &&
    (row.classId === undefined || (isUuid(row.classId) && session.classIds.includes(row.classId)))
  );
}

function parseRows<T>(value: unknown, parse: (row: unknown) => T): T[] {
  if (!Array.isArray(value) || value.length > 200) throw new Error("列表格式不正确，已停止显示。");
  return value.map(parse);
}

function parseSummary(value: unknown): PickupSummary {
  if (!isObject(value) || value.synthetic !== true || !isObject(value.counts))
    throw new Error("接送汇总格式无效，已停止显示。");
  const counts = value.counts;
  const expectedCounts = [
    "activeAuthorizations",
    "completedRecords",
    "followingExceptions",
    "openExceptions",
    "resolvedExceptions",
  ];
  if (
    Object.keys(value).sort().join(",") !== "counts,synthetic" ||
    Object.keys(counts).sort().join(",") !== expectedCounts.join(",") ||
    expectedCounts.some((key) => !Number.isSafeInteger(counts[key]) || Number(counts[key]) < 0)
  )
    throw new Error("接送汇总格式无效，已停止显示。");
  return {
    synthetic: true,
    counts: {
      activeAuthorizations: Number(counts.activeAuthorizations),
      completedRecords: Number(counts.completedRecords),
      openExceptions: Number(counts.openExceptions),
      followingExceptions: Number(counts.followingExceptions),
      resolvedExceptions: Number(counts.resolvedExceptions),
    },
  };
}

function parseAuthorization(value: unknown, session: Session): PickupAuthorization {
  if (
    !isObject(value) ||
    !isUuid(value.id) ||
    !Number.isSafeInteger(value.version) ||
    Number(value.version) < 1 ||
    !isOneOf(value.status, ["DRAFT", "ACTIVE", "REVOKED"] as const) ||
    typeof value.currentlyValid !== "boolean" ||
    !isUuid(value.studentId) ||
    !isText(value.studentLabel) ||
    !isText(value.recipientLabel) ||
    !isOneOf(value.type, ["REGULAR", "TEMPORARY"] as const) ||
    !isDate(value.startDate) ||
    !isDate(value.endDate) ||
    !isTime(value.startTime) ||
    !isTime(value.endTime) ||
    !sameScope(value, session)
  )
    throw new Error("接送授权或当前范围无效，已停止显示。");
  return {
    id: value.id,
    version: Number(value.version),
    status: value.status,
    currentlyValid: value.currentlyValid,
    studentLabel: value.studentLabel,
    recipientLabel: value.recipientLabel,
    type: value.type,
    startDate: value.startDate,
    endDate: value.endDate,
    startTime: value.startTime,
    endTime: value.endTime,
  };
}

function parseRecord(value: unknown, session: Session): PickupRecord {
  if (
    !isObject(value) ||
    !isUuid(value.id) ||
    !Number.isSafeInteger(value.version) ||
    Number(value.version) < 1 ||
    value.status !== "COMPLETED" ||
    !isDate(value.date) ||
    !isTime(value.time) ||
    !isUuid(value.studentId) ||
    !isText(value.studentLabel) ||
    !isText(value.recipient) ||
    !sameScope(value, session)
  )
    throw new Error("接送记录或当前范围无效，已停止显示。");
  return {
    id: value.id,
    version: Number(value.version),
    date: value.date,
    time: value.time,
    studentLabel: value.studentLabel,
    recipient: value.recipient,
  };
}

function parseException(value: unknown, session: Session): PickupException {
  if (
    !isObject(value) ||
    !isUuid(value.id) ||
    !Number.isSafeInteger(value.version) ||
    Number(value.version) < 1 ||
    !isOneOf(value.status, ["OPEN", "FOLLOWING", "RESOLVED"] as const) ||
    !isUuid(value.studentId) ||
    !isText(value.studentLabel) ||
    !isDate(value.date) ||
    !isOneOf(value.category, EXCEPTION_CATEGORIES) ||
    !(value.outcome === null || isOneOf(value.outcome, EXCEPTION_OUTCOMES)) ||
    !sameScope(value, session)
  )
    throw new Error("接送异常或当前范围无效，已停止显示。");
  return {
    id: value.id,
    version: Number(value.version),
    status: value.status,
    studentLabel: value.studentLabel,
    date: value.date,
    category: value.category,
    outcome: value.outcome,
  };
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

const emptySnapshot = (
  profile: PickupReviewProfile,
  status: Status,
  message: string,
): PickupReviewSnapshot => ({
  profile,
  status,
  session: null,
  authorizations: [],
  records: [],
  exceptions: [],
  summary: null,
  message,
});

export class PickupReviewClient {
  private state: PickupReviewSnapshot = emptySnapshot("owner-east", "IDLE", "请连接本机合成服务。");
  private handle: string | null = null;
  private generation = 0;
  private controller = new AbortController();

  constructor(private readonly transport: typeof fetch = fetch.bind(globalThis)) {}

  get snapshot(): PickupReviewSnapshot {
    return structuredClone(this.state);
  }

  disconnect(): void {
    this.generation += 1;
    this.controller.abort();
    this.controller = new AbortController();
    this.handle = null;
    this.state = emptySnapshot(this.state.profile, "IDLE", "连接已断开，本机资料已清除。");
  }

  private async request(path: string, method = "GET", body?: object): Promise<unknown> {
    const response = await this.transport(path, {
      method,
      credentials: "omit",
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.any([this.controller.signal, AbortSignal.timeout(5000)]),
      headers: {
        ...(this.handle ? { Authorization: `Bearer ${this.handle}` } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok)
      throw new Error(
        response.status === 409
          ? "记录已变化，请刷新后重试。"
          : "本机接送服务暂不可用，请稍后刷新。",
      );
    return response.json();
  }

  private fail(message: string): void {
    this.handle = null;
    this.state = emptySnapshot(this.state.profile, "ERROR", message);
  }

  async connect(profile: PickupReviewProfile): Promise<void> {
    if (!validProfile(profile)) return;
    this.disconnect();
    const generation = this.generation;
    this.state = emptySnapshot(profile, "CONNECTING", "正在读取本机授权范围…");
    try {
      const bootstrap = await this.request("/local/sessions", "POST", {
        profile,
      });
      if (generation !== this.generation) return;
      if (
        !isObject(bootstrap) ||
        typeof bootstrap.handle !== "string" ||
        !/^[\w-]{43}$/u.test(bootstrap.handle)
      )
        throw new Error("本机模拟会话无效，请重新连接。");
      this.handle = bootstrap.handle;
      const rawSession = await this.request("/local/session");
      if (generation !== this.generation) return;
      if (!validSession(rawSession, profile)) throw new Error("本机模拟身份范围无效，已停止显示。");
      const session: Session = {
        profile: rawSession.profile,
        label: rawSession.label,
        actorId: rawSession.actorId,
        tenantId: rawSession.tenantId,
        campusId: rawSession.campusId,
        classIds: [...rawSession.classIds],
        actions: [...rawSession.actions],
      };
      if (profile === "platform-admin") {
        if (!session.actions.includes("pickup:summary")) {
          this.state = {
            ...emptySnapshot(profile, "READY", "当前角色没有接送汇总权限。"),
            session,
          };
          return;
        }
        const summary = parseSummary(await this.request("/local/pickup-summary"));
        if (generation !== this.generation) return;
        this.state = {
          ...emptySnapshot(profile, "READY", "仅显示本机合成数据的数字汇总，不含接送明细。"),
          session,
          summary,
        };
        return;
      }
      if (
        !rawSession.actions.some((action) => action === "pickup:read" || action === "pickup:review")
      ) {
        this.state = emptySnapshot(profile, "READY", "当前角色没有接送资料查看权限。");
        return;
      }
      const [rawAuthorizations, rawRecords, rawExceptions] = await Promise.all([
        rawSession.actions.includes("pickup:read")
          ? this.request("/local/pickup-authorizations")
          : Promise.resolve([]),
        rawSession.actions.includes("pickup:read")
          ? this.request("/local/pickup-records")
          : Promise.resolve([]),
        rawSession.actions.includes("pickup:review")
          ? this.request("/local/pickup-exceptions")
          : Promise.resolve([]),
      ]);
      if (generation !== this.generation) return;
      this.state = {
        profile,
        status: "READY",
        session,
        authorizations: parseRows(rawAuthorizations, (row) => parseAuthorization(row, session)),
        records: parseRows(rawRecords, (row) => parseRecord(row, session)),
        exceptions: parseRows(rawExceptions, (row) => parseException(row, session)),
        summary: null,
        message: "仅显示当前校区的合成接送摘要；处理异常不会直接放行。",
      };
    } catch (error) {
      if (generation !== this.generation) return;
      this.fail(error instanceof Error ? error.message : "本机接送服务暂不可用。");
    }
  }

  async refresh(): Promise<void> {
    const profile = this.state.profile;
    if (this.state.status !== "READY") return;
    await this.connect(profile);
  }

  async review(id: string, version: number, action: PickupExceptionAction): Promise<void> {
    const snapshot = this.state;
    const row = snapshot.exceptions.find((item) => item.id === id);
    if (
      snapshot.status !== "READY" ||
      !this.handle ||
      !snapshot.session?.actions.includes("pickup:review") ||
      (action !== "follow" && action !== "resolve") ||
      !row ||
      row.version !== version ||
      (action === "follow" && row.status !== "OPEN") ||
      (action === "resolve" && row.status !== "FOLLOWING")
    )
      return;
    const generation = this.generation;
    this.state = {
      ...snapshot,
      status: "BUSY",
      message: "正在保存异常处理结果…",
    };
    try {
      await this.request(`/local/pickup-exceptions/${id}/review`, "POST", {
        version,
        action,
        outcome: action === "follow" ? "CONTACT_GUARDIAN" : "ARRANGEMENT_CONFIRMED",
      });
      if (generation !== this.generation) return;
      await this.connect(snapshot.profile);
    } catch (error) {
      if (generation !== this.generation) return;
      this.fail(error instanceof Error ? error.message : "异常处理未完成，请刷新后核对。");
    }
  }
}

export function renderPickupReview(snapshot: PickupReviewSnapshot, editable: boolean): string {
  const profileOptions: readonly [PickupReviewProfile, string][] = [
    ["owner-east", "校区负责人"],
    ["owner-west", "西区负责人"],
    ["teacher-east", "员工只读"],
    ["platform-admin", "平台管理员"],
  ];
  const options = profileOptions
    .map(
      ([profile, label]) =>
        `<option value="${profile}"${snapshot.profile === profile ? " selected" : ""}>${label}</option>`,
    )
    .join("");
  const canReview =
    editable &&
    snapshot.status === "READY" &&
    snapshot.session?.actions.includes("pickup:review") === true;
  const disabled = !editable || snapshot.status === "BUSY" || snapshot.status === "CONNECTING";
  const exceptionCards = snapshot.exceptions
    .map((row) => {
      const actions = canReview
        ? row.status === "OPEN"
          ? `<button type="button" class="save" data-pickup-action="follow" data-pickup-id="${escape(row.id)}" data-pickup-version="${row.version}">跟进异常</button>`
          : row.status === "FOLLOWING"
            ? `<button type="button" class="publish" data-pickup-action="resolve" data-pickup-id="${escape(row.id)}" data-pickup-version="${row.version}">记录处理结果</button>`
            : ""
        : "";
      const outcome = row.outcome ? ` · ${OUTCOME_LABEL[row.outcome]}` : "";
      return `<article class="panel pickup-exception" data-pickup-exception="${escape(row.id)}"><h3>${escape(row.studentLabel)} · ${escape(row.date)}</h3><p>${CATEGORY_LABEL[row.category]} · ${STATUS_LABEL[row.status]} · 版本 ${row.version}${outcome}</p><p>此处仅记录跟进结果，不替代员工现场核验和放行。</p>${actions ? `<div class="actions">${actions}</div>` : ""}</article>`;
    })
    .join("");
  const authorizations = snapshot.authorizations
    .map(
      (row) =>
        `<article class="panel pickup-authorization"><h3>${escape(row.studentLabel)} · ${escape(row.recipientLabel)}</h3><p>${row.type === "REGULAR" ? "常用授权" : "临时授权"} · ${row.status === "ACTIVE" ? (row.currentlyValid ? "当前有效" : "已到期") : row.status === "DRAFT" ? "待激活" : "已撤销"}</p><p>${escape(row.startDate)} 至 ${escape(row.endDate)} · ${escape(row.startTime)}–${escape(row.endTime)}</p></article>`,
    )
    .join("");
  const records = snapshot.records
    .map(
      (row) =>
        `<article class="panel pickup-record"><h3>${escape(row.studentLabel)} · ${escape(row.date)} ${escape(row.time)}</h3><p>接送人：${escape(row.recipient)} · 已完成 · 版本 ${row.version}</p></article>`,
    )
    .join("");
  const platformSummary = snapshot.summary
    ? `<div class="pickup-summary-grid" aria-label="平台接送汇总"><article><strong>${snapshot.summary.counts.activeAuthorizations}</strong><span>当前有效授权</span></article><article><strong>${snapshot.summary.counts.completedRecords}</strong><span>已完成接送</span></article><article><strong>${snapshot.summary.counts.openExceptions}</strong><span>待跟进异常</span></article><article><strong>${snapshot.summary.counts.followingExceptions}</strong><span>跟进中异常</span></article><article><strong>${snapshot.summary.counts.resolvedExceptions}</strong><span>已记录处理结果</span></article></div>`
    : "";
  const platformOnly = snapshot.profile === "platform-admin";
  return `<section class="panel pickup-review"><p class="eyebrow">合成数据 · 仅本机展示</p><h1>接送异常处理</h1><p>负责人可查看当前校区摘要并记录异常跟进；异常处理不会替代员工现场核验。</p><label for="pickup-review-profile">当前演示角色</label><select id="pickup-review-profile" data-pickup-profile${disabled ? " disabled" : ""}>${options}</select><div class="actions"><button type="button" class="save" data-pickup-refresh${disabled ? " disabled" : ""}>刷新接送摘要</button></div><p role="status" tabindex="-1" data-pickup-message>${escape(snapshot.message)}</p>${platformOnly ? (snapshot.status === "READY" ? `<h2>平台汇总</h2><p class="notice">仅含本机模拟数据的数字统计，不显示学生、校区或单条记录。</p>${platformSummary}` : "") : snapshot.status === "READY" ? `<h2>接送异常 ${snapshot.exceptions.length}</h2>${exceptionCards || '<p class="notice">当前授权范围没有待处理的接送异常。</p>'}<h2>当前授权摘要 ${snapshot.authorizations.length}</h2>${authorizations || '<p class="notice">当前授权范围没有接送授权。</p>'}<h2>近期已完成接送 ${snapshot.records.length}</h2>${records || '<p class="notice">当前授权范围没有已完成接送记录。</p>'}` : ""}</section>`;
}
