const REVIEW_PROFILES = [
  "owner-east",
  "owner-west",
  "owner-other-tenant",
  "teacher-east",
  "content-editor-east",
  "platform-admin",
] as const;
export type ReviewProfile = (typeof REVIEW_PROFILES)[number];
export const isResourceReviewProfile = (value: unknown): value is ReviewProfile =>
  REVIEW_PROFILES.some((profile) => profile === value);

export interface ManagedResource {
  readonly id: string;
  readonly version: number;
  readonly title: string;
  readonly summary: string;
  readonly grade: string;
  readonly subject: string;
  readonly tags: readonly string[];
  readonly scope: "CAMPUS" | "CLASS";
  readonly classId: string;
  readonly status: "PUBLISHED" | "REVOKED";
  readonly expiresOn: string;
  readonly sourceLabel: string;
  readonly ownerLabel: string;
  readonly learningSourceGovernance?: {
    readonly collection: "SYNTHETIC_CAMPUS_MATH_SET";
    readonly revision: "SYNTHETIC_2026_10_V1";
    readonly reviewStatus: "PENDING_REVIEW" | "APPROVED" | "RETURNED";
    readonly reviewedAt: string | null;
  };
}

export interface ResourceSummary {
  readonly total: number;
  readonly published: number;
  readonly expired: number;
  readonly revoked: number;
}

export interface ResourceLibraryAdminSnapshot {
  readonly status: "IDLE" | "CONNECTING" | "BUSY" | "READY" | "DISCONNECTED";
  readonly profile: ReviewProfile | null;
  readonly actions: readonly string[];
  readonly classIds: readonly string[];
  readonly resources: readonly ManagedResource[];
  readonly summary: ResourceSummary | null;
  readonly message: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const DATE = /^\d{4}-\d{2}-\d{2}$/u;
const EXPIRY_CHOICES = ["2026-10-31", "2026-12-31", "2027-03-31"] as const;
const SCOPE_CHOICES = ["CAMPUS", "CLASS"] as const;
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function text(value: unknown, max = 200): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= max;
}

function parseLearningSourceGovernance(
  value: unknown,
): ManagedResource["learningSourceGovernance"] {
  if (value === undefined) return undefined;
  if (
    !object(value) ||
    value.collection !== "SYNTHETIC_CAMPUS_MATH_SET" ||
    value.revision !== "SYNTHETIC_2026_10_V1" ||
    !["PENDING_REVIEW", "APPROVED", "RETURNED"].includes(String(value.reviewStatus)) ||
    !(
      value.reviewedAt === null ||
      (typeof value.reviewedAt === "string" && Number.isFinite(Date.parse(value.reviewedAt)))
    ) ||
    (value.reviewStatus === "PENDING_REVIEW") !== (value.reviewedAt === null)
  )
    throw new Error("Invalid learning source review status");
  return {
    collection: "SYNTHETIC_CAMPUS_MATH_SET",
    revision: "SYNTHETIC_2026_10_V1",
    reviewStatus: value.reviewStatus as "PENDING_REVIEW" | "APPROVED" | "RETURNED",
    reviewedAt: value.reviewedAt as string | null,
  };
}

function parseResource(value: unknown): ManagedResource {
  if (
    !object(value) ||
    typeof value.id !== "string" ||
    !UUID.test(value.id) ||
    !Number.isSafeInteger(value.version) ||
    Number(value.version) < 1 ||
    !text(value.title, 100) ||
    !text(value.summary, 240) ||
    !text(value.grade, 30) ||
    !text(value.subject, 40) ||
    !Array.isArray(value.tags) ||
    value.tags.length > 8 ||
    !value.tags.every((tag) => text(tag, 40)) ||
    (value.scope !== "CAMPUS" && value.scope !== "CLASS") ||
    typeof value.classId !== "string" ||
    !UUID.test(value.classId) ||
    (value.status !== "PUBLISHED" && value.status !== "REVOKED") ||
    typeof value.expiresOn !== "string" ||
    !DATE.test(value.expiresOn) ||
    !text(value.sourceLabel) ||
    !text(value.ownerLabel)
  )
    throw new Error("Invalid managed resource");
  const learningSourceGovernance = parseLearningSourceGovernance(value.learningSourceGovernance);
  return {
    id: value.id,
    version: Number(value.version),
    title: value.title,
    summary: value.summary,
    grade: value.grade,
    subject: value.subject,
    tags: value.tags as string[],
    scope: value.scope,
    classId: value.classId,
    status: value.status,
    expiresOn: value.expiresOn,
    sourceLabel: value.sourceLabel,
    ownerLabel: value.ownerLabel,
    ...(learningSourceGovernance ? { learningSourceGovernance } : {}),
  };
}

function parseResources(value: unknown): ManagedResource[] {
  if (!Array.isArray(value)) throw new Error("Invalid resource list");
  return value.map(parseResource);
}

function parseSummary(value: unknown): ResourceSummary {
  if (
    !object(value) ||
    !["total", "published", "expired", "revoked"].every(
      (key) => Number.isSafeInteger(value[key]) && Number(value[key]) >= 0,
    ) ||
    Number(value.published) + Number(value.expired) + Number(value.revoked) !== Number(value.total)
  )
    throw new Error("Invalid anonymous resource summary");
  return {
    total: Number(value.total),
    published: Number(value.published),
    expired: Number(value.expired),
    revoked: Number(value.revoked),
  };
}

export class ResourceLibraryAdminClient {
  private state: ResourceLibraryAdminSnapshot = {
    status: "IDLE",
    profile: null,
    actions: [],
    classIds: [],
    resources: [],
    summary: null,
    message: "连接负责人身份后管理当前校区资源。",
  };
  private handle: string | null = null;

  constructor(private readonly transport: typeof fetch = fetch.bind(globalThis)) {}

  get snapshot(): ResourceLibraryAdminSnapshot {
    return structuredClone(this.state);
  }

  disconnect(): void {
    this.handle = null;
    this.state = {
      status: "IDLE",
      profile: null,
      actions: [],
      classIds: [],
      resources: [],
      summary: null,
      message: "当前页面未连接资源管理服务。",
    };
  }

  private async request(path: string, method = "GET", body?: object): Promise<unknown> {
    const response = await this.transport(path, {
      method,
      credentials: "omit",
      cache: "no-store",
      redirect: "error",
      headers: {
        ...(this.handle ? { Authorization: `Bearer ${this.handle}` } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) throw new Error("Local resource request failed");
    return response.json();
  }

  async connect(profile: ReviewProfile): Promise<void> {
    this.disconnect();
    if (!isResourceReviewProfile(profile)) return;
    this.state = { ...this.state, status: "CONNECTING", profile, message: "正在连接资源管理服务…" };
    try {
      const bootstrap = await this.request("/local/sessions", "POST", { profile });
      if (
        !object(bootstrap) ||
        typeof bootstrap.handle !== "string" ||
        !/^[-\w]{43}$/u.test(bootstrap.handle)
      )
        throw new Error("Invalid resource session");
      this.handle = bootstrap.handle;
      const session = await this.request("/local/session");
      if (
        !object(session) ||
        session.profile !== profile ||
        !Array.isArray(session.actions) ||
        !Array.isArray(session.classIds) ||
        !session.classIds.every((id) => typeof id === "string" && UUID.test(id))
      )
        throw new Error("Invalid resource session");
      const actions = session.actions.filter(
        (action): action is string => typeof action === "string",
      );
      this.state = {
        ...this.state,
        actions,
        classIds: session.classIds,
        status: "READY",
        message: "身份已连接，正在读取当前授权范围。",
      };
      await this.refresh();
    } catch {
      this.handle = null;
      this.state = {
        ...this.state,
        status: "DISCONNECTED",
        resources: [],
        summary: null,
        message: "资源管理连接失败，请确认本机服务已启动后重新连接。",
      };
    }
  }

  async refresh(): Promise<void> {
    if (!this.handle) return;
    this.state = { ...this.state, status: "BUSY", message: "正在更新资源状态…" };
    try {
      if (this.state.actions.includes("resource:manage")) {
        const resources = parseResources(await this.request("/local/resources-managed"));
        this.state = {
          ...this.state,
          status: "READY",
          resources,
          summary: null,
          message: "已显示当前机构和校区范围内的资源。",
        };
      } else if (this.state.actions.includes("resource:summary")) {
        const summary = parseSummary(await this.request("/local/resource-summary"));
        this.state = {
          ...this.state,
          status: "READY",
          resources: [],
          summary,
          message: "仅显示匿名汇总，不提供资源正文或负责人信息。",
        };
      } else {
        this.state = {
          ...this.state,
          status: "READY",
          resources: [],
          summary: null,
          message: "当前身份没有资源管理权限。",
        };
      }
    } catch {
      this.handle = null;
      this.state = {
        ...this.state,
        status: "DISCONNECTED",
        resources: [],
        summary: null,
        message: "资源更新失败，当前列表已清空。请重新连接后再试。",
      };
    }
  }

  async update(
    id: string,
    version: number,
    scope: (typeof SCOPE_CHOICES)[number],
    expiresOn: (typeof EXPIRY_CHOICES)[number],
    classId?: string,
  ): Promise<void> {
    const item = this.state.resources.find((resource) => resource.id === id);
    if (
      !this.handle ||
      !item ||
      item.version !== version ||
      !SCOPE_CHOICES.includes(scope) ||
      !EXPIRY_CHOICES.includes(expiresOn) ||
      (scope === "CLASS" && (!classId || !this.state.classIds.includes(classId)))
    )
      return;
    this.state = { ...this.state, status: "BUSY", message: "正在保存资源范围和到期时间…" };
    try {
      await this.request(`/local/resources/${id}`, "PATCH", {
        version,
        scope,
        expiresOn,
        ...(scope === "CLASS" ? { classId } : {}),
      });
      await this.refresh();
      if (this.state.status === "READY")
        this.state = { ...this.state, message: "资源版本已更新。" };
    } catch {
      this.state = {
        ...this.state,
        status: "READY",
        message: "保存失败，可能是版本已变化；请先刷新。",
      };
    }
  }

  async revoke(id: string, version: number): Promise<void> {
    const item = this.state.resources.find((resource) => resource.id === id);
    if (!this.handle || !item || item.version !== version || item.status !== "PUBLISHED") return;
    this.state = { ...this.state, status: "BUSY", message: "正在撤回资源…" };
    try {
      await this.request(`/local/resources/${id}/revoke`, "POST", { version });
      await this.refresh();
      if (this.state.status === "READY")
        this.state = { ...this.state, message: "资源已撤回，员工入口将不再显示。" };
    } catch {
      this.state = {
        ...this.state,
        status: "READY",
        message: "撤回失败，可能是版本已变化；请先刷新。",
      };
    }
  }

  async reviewSource(id: string, version: number, action: "APPROVE" | "RETURN"): Promise<void> {
    const item = this.state.resources.find((resource) => resource.id === id);
    if (
      !this.handle ||
      !item ||
      item.version !== version ||
      item.status !== "PUBLISHED" ||
      item.learningSourceGovernance?.reviewStatus !== "PENDING_REVIEW" ||
      (action !== "APPROVE" && action !== "RETURN")
    )
      return;
    this.state = { ...this.state, status: "BUSY", message: "正在保存来源复核结果…" };
    try {
      await this.request(`/local/resources/${id}`, "PATCH", {
        version,
        scope: item.scope,
        expiresOn: item.expiresOn,
        ...(item.scope === "CLASS" ? { classId: item.classId } : {}),
        learningSourceAction: action,
      });
      await this.refresh();
      if (this.state.status === "READY")
        this.state = {
          ...this.state,
          message:
            action === "APPROVE"
              ? "来源已通过复核，可进入学习资料检索。"
              : "来源已退回，不会进入学习资料检索。",
        };
    } catch {
      this.state = {
        ...this.state,
        status: "READY",
        message: "来源复核未保存，可能是资料版本已变化；请先刷新。",
      };
    }
  }
}

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/gu,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!,
  );

function summaryHtml(summary: ResourceSummary): string {
  return `<dl><div><dt>资源总数</dt><dd>${summary.total}</dd></div><div><dt>当前有效</dt><dd>${summary.published}</dd></div><div><dt>已过期</dt><dd>${summary.expired}</dd></div><div><dt>已撤回</dt><dd>${summary.revoked}</dd></div></dl>`;
}

export function renderAdminResourceLibrary(snapshot: ResourceLibraryAdminSnapshot): string {
  const busy = snapshot.status === "BUSY" || snapshot.status === "CONNECTING";
  if (snapshot.summary)
    return `<section data-resource-summary><h2>资源匿名汇总</h2><p>${escapeHtml(snapshot.message)}</p>${summaryHtml(snapshot.summary)}</section>`;
  if (!snapshot.actions.includes("resource:manage"))
    return `<section data-resource-management><p>${escapeHtml(snapshot.message)}</p>${snapshot.status === "DISCONNECTED" && snapshot.profile ? '<button type="button" data-resource-reconnect>重新连接</button>' : ""}</section>`;
  const cards = snapshot.resources
    .map((item) => {
      const classOptions = snapshot.classIds
        .map(
          (id, index) =>
            `<option value="${id}" ${id === item.classId ? "selected" : ""}>第 ${index + 1} 个当前授权班级</option>`,
        )
        .join("");
      const status =
        item.status === "REVOKED" ? "已撤回" : item.expiresOn < today() ? "已过期" : "已发布";
      const sourceReviewStatus = item.learningSourceGovernance?.reviewStatus;
      const sourceReviewLabel =
        sourceReviewStatus === "PENDING_REVIEW"
          ? "待复核"
          : sourceReviewStatus === "APPROVED"
            ? "已通过"
            : sourceReviewStatus === "RETURNED"
              ? "已退回"
              : "未纳入学习资料";
      const sourceReviewDate = item.learningSourceGovernance?.reviewedAt
        ? ` · 复核日期：${escapeHtml(item.learningSourceGovernance.reviewedAt.slice(0, 10))}`
        : "";
      const sourceReviewControls =
        item.status === "PUBLISHED" && sourceReviewStatus === "PENDING_REVIEW"
          ? `<div><button type="button" data-learning-source-review data-learning-source-action="APPROVE" data-resource-id="${item.id}" data-resource-version="${item.version}" ${busy ? "disabled" : ""}>通过来源复核</button><button type="button" data-learning-source-review data-learning-source-action="RETURN" data-resource-id="${item.id}" data-resource-version="${item.version}" ${busy ? "disabled" : ""}>退回来源</button></div>`
          : "";
      const expiryOptions = `<option value="" disabled ${EXPIRY_CHOICES.includes(item.expiresOn as (typeof EXPIRY_CHOICES)[number]) ? "" : "selected"}>请选择新的到期时间</option>${EXPIRY_CHOICES.map((date) => `<option value="${date}" ${date === item.expiresOn ? "selected" : ""}>${date}</option>`).join("")}`;
      const controls =
        item.status === "PUBLISHED"
          ? `<form data-resource-update data-resource-id="${item.id}" data-resource-version="${item.version}">
          <label>适用范围<select name="scope" ${busy ? "disabled" : ""}><option value="CAMPUS" ${item.scope === "CAMPUS" ? "selected" : ""}>当前校区</option><option value="CLASS" ${item.scope === "CLASS" ? "selected" : ""}>当前班级</option></select></label>
          <label>到期时间<select name="expiresOn" required ${busy ? "disabled" : ""}>${expiryOptions}</select></label>
          <label>授权班级<select name="classId" ${busy ? "disabled" : ""}>${classOptions}</select></label>
          <button type="submit" ${busy ? "disabled" : ""}>保存范围和到期时间</button>
          <button type="button" data-resource-revoke data-resource-id="${item.id}" data-resource-version="${item.version}" ${busy ? "disabled" : ""}>撤回资源</button>
        </form>`
          : "<p>已撤回的资源只保留状态记录，不能再次编辑。</p>";
      return `<article class="panel" data-resource-id="${item.id}">
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.summary)}</p>
        <p>${escapeHtml(item.grade)} · ${escapeHtml(item.subject)} · ${item.tags.map(escapeHtml).join("、")}</p>
        <p>第 ${item.version} 版 · ${status} · ${escapeHtml(item.scope === "CLASS" ? "当前班级" : "当前校区")} · 到期：${escapeHtml(item.expiresOn)}</p>
        <p>来源：${escapeHtml(item.sourceLabel)} · 责任人：${escapeHtml(item.ownerLabel)}</p>
        ${item.learningSourceGovernance ? `<p data-learning-source-status>合成资料集 ${escapeHtml(item.learningSourceGovernance.revision)} · ${sourceReviewLabel}${sourceReviewDate}</p>${sourceReviewControls}` : ""}
        ${controls}
      </article>`;
    })
    .join("");
  return `<section data-resource-management>
    <p data-resource-admin-status role="status" aria-live="polite">${escapeHtml(snapshot.message)}</p>
    ${snapshot.status === "DISCONNECTED" && snapshot.profile ? '<button type="button" data-resource-reconnect>重新连接</button>' : ""}
    <button type="button" data-resource-refresh ${busy ? "disabled" : ""}>刷新资源</button>
    <p>仅管理当前会话获准范围内的合成资源；保存会递增版本，撤回后员工端收藏与最近入口也将隐藏。</p>
    ${cards || "<p>当前授权范围内没有资源。</p>"}
  </section>`;
}
