const LOCAL_PROFILES = [
  "parent-alpha",
  "parent-beta",
  "teacher-east",
  "owner-east",
  "owner-west",
  "owner-other-tenant",
  "teacher-other-class",
  "content-editor-east",
  "teacher-east-peer",
  "platform-admin",
] as const;
export type LocalProfile = (typeof LOCAL_PROFILES)[number];
export const isResourceLibraryProfile = (value: unknown): value is LocalProfile =>
  LOCAL_PROFILES.some((profile) => profile === value);

export const RESOURCE_CATEGORY_LABELS = {
  LESSON: "课堂活动",
  EXERCISE: "练习巩固",
  READING: "阅读引导",
  REFERENCE: "教学参考",
  WORKSHEET: "活动任务单",
} as const;

export type ResourceCategory = keyof typeof RESOURCE_CATEGORY_LABELS;
export interface ResourceLibraryItem {
  readonly id: string;
  readonly version: number;
  readonly title: string;
  readonly summary: string;
  readonly content: string;
  readonly category: ResourceCategory;
  readonly grade: string;
  readonly subject: string;
  readonly tags: readonly string[];
  readonly scope: "CAMPUS" | "CLASS";
  readonly sourceLabel: string;
  readonly ownerLabel: string;
  readonly expiresOn: string;
  readonly favorite: boolean;
  readonly lastUsedAt?: string;
}

export interface ResourceLibraryFilters {
  readonly query: string;
  readonly grade: string;
  readonly subject: string;
  readonly tag: string;
}

export interface ResourceLibrarySnapshot {
  readonly status: "IDLE" | "CONNECTING" | "BUSY" | "READY" | "DISCONNECTED";
  readonly profile: LocalProfile | null;
  readonly actions: readonly string[];
  readonly resources: readonly ResourceLibraryItem[];
  readonly favorites: readonly ResourceLibraryItem[];
  readonly recent: readonly ResourceLibraryItem[];
  readonly selected: ResourceLibraryItem | null;
  readonly filters: ResourceLibraryFilters;
  readonly message: string;
}

const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const GRADES = new Set(["三年级", "四年级"]);
const SUBJECTS = new Set(["数学", "语文", "科学", "综合实践"]);
const TAGS = new Set(["小组活动", "课堂探索", "阅读引导", "课堂分享", "数感练习"]);
const emptyFilters = (): ResourceLibraryFilters => ({ query: "", grade: "", subject: "", tag: "" });

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function boundedText(value: unknown, max = 240): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= max;
}

function parseResource(value: unknown): ResourceLibraryItem {
  if (
    !object(value) ||
    typeof value.id !== "string" ||
    !ID_PATTERN.test(value.id) ||
    !Number.isSafeInteger(value.version) ||
    Number(value.version) < 1 ||
    !boundedText(value.title, 100) ||
    !boundedText(value.summary, 240) ||
    !boundedText(value.content, 2000) ||
    typeof value.category !== "string" ||
    !(value.category in RESOURCE_CATEGORY_LABELS) ||
    typeof value.grade !== "string" ||
    !GRADES.has(value.grade) ||
    typeof value.subject !== "string" ||
    !SUBJECTS.has(value.subject) ||
    !Array.isArray(value.tags) ||
    value.tags.length > 8 ||
    value.tags.some((tag) => typeof tag !== "string" || !TAGS.has(tag)) ||
    (value.scope !== "CAMPUS" && value.scope !== "CLASS") ||
    !boundedText(value.sourceLabel, 100) ||
    !boundedText(value.ownerLabel, 100) ||
    typeof value.expiresOn !== "string" ||
    !DATE_PATTERN.test(value.expiresOn) ||
    typeof value.favorite !== "boolean" ||
    (value.lastUsedAt !== undefined && !boundedText(value.lastUsedAt, 40))
  )
    throw new Error("Invalid resource record");
  return {
    id: value.id,
    version: Number(value.version),
    title: value.title,
    summary: value.summary,
    content: value.content,
    category: value.category as ResourceCategory,
    grade: value.grade,
    subject: value.subject,
    tags: value.tags as string[],
    scope: value.scope,
    sourceLabel: value.sourceLabel,
    ownerLabel: value.ownerLabel,
    expiresOn: value.expiresOn,
    favorite: value.favorite,
    ...(typeof value.lastUsedAt === "string" ? { lastUsedAt: value.lastUsedAt } : {}),
  };
}

function parseResources(value: unknown): ResourceLibraryItem[] {
  if (!Array.isArray(value)) throw new Error("Invalid resource list");
  return value.map(parseResource);
}

function normalizeFilters(filters: Partial<ResourceLibraryFilters>): ResourceLibraryFilters {
  return {
    query: typeof filters.query === "string" ? filters.query.trim().slice(0, 80) : "",
    grade: typeof filters.grade === "string" && GRADES.has(filters.grade) ? filters.grade : "",
    subject:
      typeof filters.subject === "string" && SUBJECTS.has(filters.subject) ? filters.subject : "",
    tag: typeof filters.tag === "string" && TAGS.has(filters.tag) ? filters.tag : "",
  };
}

export class ResourceLibraryClient {
  private state: ResourceLibrarySnapshot = {
    status: "IDLE",
    profile: null,
    actions: [],
    resources: [],
    favorites: [],
    recent: [],
    selected: null,
    filters: emptyFilters(),
    message: "请选择员工身份后查看资源。",
  };
  private handle: string | null = null;

  constructor(private readonly transport: typeof fetch = fetch.bind(globalThis)) {}

  get snapshot(): ResourceLibrarySnapshot {
    return structuredClone(this.state);
  }

  disconnect(): void {
    this.handle = null;
    this.state = {
      status: "IDLE",
      profile: null,
      actions: [],
      resources: [],
      favorites: [],
      recent: [],
      selected: null,
      filters: emptyFilters(),
      message: "当前页面未连接共享资源服务。",
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

  async connect(
    profile: LocalProfile,
    filters: Partial<ResourceLibraryFilters> = {},
  ): Promise<void> {
    this.disconnect();
    if (!isResourceLibraryProfile(profile)) return;
    this.state = {
      ...this.state,
      status: "CONNECTING",
      profile,
      filters: normalizeFilters(filters),
      message: "正在连接共享资源目录…",
    };
    try {
      const bootstrap = await this.request("/local/sessions", "POST", { profile });
      if (
        !object(bootstrap) ||
        typeof bootstrap.handle !== "string" ||
        !/^[\w-]{43}$/u.test(bootstrap.handle)
      )
        throw new Error("Invalid resource session");
      this.handle = bootstrap.handle;
      const session = await this.request("/local/session");
      if (!object(session) || session.profile !== profile || !Array.isArray(session.actions))
        throw new Error("Invalid resource session");
      const actions = session.actions.filter(
        (action): action is string => typeof action === "string",
      );
      if (!actions.includes("resource:read")) throw new Error("Resource access denied");
      this.state = {
        ...this.state,
        status: "READY",
        actions,
        message: "资源已按当前身份范围加载。",
      };
      await this.refresh(this.state.filters);
    } catch {
      this.handle = null;
      this.state = {
        ...this.state,
        status: "DISCONNECTED",
        actions: [],
        resources: [],
        favorites: [],
        recent: [],
        selected: null,
        message: "共享资源暂不可用，请确认本机服务已启动并重新连接。",
      };
    }
  }

  async refresh(filters: Partial<ResourceLibraryFilters> = this.state.filters): Promise<void> {
    if (!this.handle || !this.state.actions.includes("resource:read")) return;
    const normalized = normalizeFilters(filters);
    this.state = { ...this.state, status: "BUSY", filters: normalized, message: "正在更新资源…" };
    try {
      const params = new URLSearchParams();
      for (const key of ["query", "grade", "subject", "tag"] as const)
        if (normalized[key]) params.set(key, normalized[key]);
      const suffix = params.size ? `?${params.toString()}` : "";
      const [resources, favorites, recent] = await Promise.all([
        this.request(`/local/resources${suffix}`),
        this.request("/local/resources-favorites"),
        this.request("/local/resources-recent"),
      ]);
      this.state = {
        ...this.state,
        status: "READY",
        resources: parseResources(resources),
        favorites: parseResources(favorites),
        recent: parseResources(recent),
        selected: null,
        message: "资源已按当前身份范围加载。",
      };
    } catch {
      this.state = {
        ...this.state,
        status: "DISCONNECTED",
        resources: [],
        favorites: [],
        recent: [],
        selected: null,
        message: "资源更新失败，当前内容已清空。请重新连接后再试。",
      };
      this.handle = null;
    }
  }

  async open(id: string): Promise<void> {
    if (!this.handle || !ID_PATTERN.test(id)) return;
    this.state = { ...this.state, status: "BUSY", message: "正在打开资源详情…" };
    try {
      const selected = parseResource(await this.request(`/local/resources/${id}`));
      this.state = { ...this.state, status: "READY", selected, message: "资源详情已打开。" };
    } catch {
      this.state = {
        ...this.state,
        status: "READY",
        selected: null,
        message: "资源已不可用，请刷新目录。",
      };
    }
  }

  closeDetail(): void {
    this.state = { ...this.state, selected: null, message: "已返回资源列表。" };
  }

  async toggleFavorite(id: string): Promise<void> {
    const item = [...this.state.resources, ...this.state.favorites, ...this.state.recent].find(
      (resource) => resource.id === id,
    );
    if (!this.handle || !item) return;
    this.state = { ...this.state, status: "BUSY", message: "正在更新收藏…" };
    try {
      await this.request(`/local/resources/${item.id}/favorite`, "POST", {
        version: item.version,
        favorite: !item.favorite,
      });
      await this.refresh(this.state.filters);
      if (this.state.status === "READY") this.state = { ...this.state, message: "收藏已更新。" };
    } catch {
      this.state = { ...this.state, status: "READY", message: "收藏未更新，请刷新后再试。" };
    }
  }

  async use(id: string): Promise<void> {
    const item =
      this.state.selected?.id === id
        ? this.state.selected
        : this.state.resources.find((row) => row.id === id);
    if (!this.handle || !item) return;
    this.state = { ...this.state, status: "BUSY", message: "正在记录最近使用…" };
    try {
      const used = parseResource(
        await this.request(`/local/resources/${id}/use`, "POST", { version: item.version }),
      );
      await this.refresh(this.state.filters);
      if (this.state.status === "READY")
        this.state = { ...this.state, selected: used, message: "已加入最近使用。" };
    } catch {
      this.state = { ...this.state, status: "READY", message: "记录失败，请刷新资源后再试。" };
    }
  }
}

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/gu,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!,
  );

function renderResourceRows(
  records: readonly ResourceLibraryItem[],
  collection: "search" | "favorites" | "recent",
  busy: boolean,
): string {
  if (records.length === 0)
    return `<p class="shared-note" data-resource-collection="${collection}">暂无资源</p>`;
  return `<div class="resource-library-list staff-content-grid" data-resource-collection="${collection}">${records
    .map(
      (
        resource,
      ) => `<article class="panel staff-content-card resource-library-item" data-resource-id="${resource.id}">
        <p class="staff-content-meta">第 ${resource.version} 版 · ${escapeHtml(RESOURCE_CATEGORY_LABELS[resource.category])}</p>
        <h2>${escapeHtml(resource.title)}</h2>
        <p>${escapeHtml(resource.summary)}</p>
        <p>${escapeHtml(resource.grade)} · ${escapeHtml(resource.subject)} · ${resource.tags.map(escapeHtml).join("、")}</p>
        <p>来源：${escapeHtml(resource.sourceLabel)} · 责任人：${escapeHtml(resource.ownerLabel)} · 到期：${escapeHtml(resource.expiresOn)}</p>
        <div class="shared-actions">
          <button class="button button-light" type="button" data-resource-action="open" data-resource-id="${resource.id}" ${busy ? "disabled" : ""}>查看详情</button>
          <button class="button button-light" type="button" data-resource-action="favorite" data-resource-id="${resource.id}" ${busy ? "disabled" : ""}>${resource.favorite ? "取消收藏" : "收藏"}</button>
          ${collection === "search" ? `<button class="button button-primary" type="button" data-resource-action="use" data-resource-id="${resource.id}" ${busy ? "disabled" : ""}>使用资源</button>` : ""}
        </div>
      </article>`,
    )
    .join("")}</div>`;
}

export function renderResourceLibraryPage(snapshot: ResourceLibrarySnapshot): string {
  const disabled = snapshot.status === "BUSY" || snapshot.status === "CONNECTING";
  const selected = snapshot.selected;
  const detail = selected
    ? `<section class="panel staff-content-card" data-resource-detail aria-labelledby="resource-detail-title">
        <div class="shared-actions"><button class="button button-light" type="button" data-resource-action="return" ${disabled ? "disabled" : ""}>返回资源列表</button><span>第 ${selected.version} 版</span></div>
        <h2 id="resource-detail-title">${escapeHtml(selected.title)}</h2>
        <p>${escapeHtml(selected.summary)}</p>
        <p>${escapeHtml(selected.grade)} · ${escapeHtml(selected.subject)} · ${escapeHtml(RESOURCE_CATEGORY_LABELS[selected.category])} · ${selected.tags.map(escapeHtml).join("、")}</p>
        <p>适用范围：${selected.scope === "CLASS" ? "当前班级" : "当前校区"} · 来源：${escapeHtml(selected.sourceLabel)} · 责任人：${escapeHtml(selected.ownerLabel)}</p>
        <p>到期时间：${escapeHtml(selected.expiresOn)}</p>
        <div class="resource-library-content">${escapeHtml(selected.content)}</div>
        <button class="button button-primary" type="button" data-resource-action="use" data-resource-id="${selected.id}" ${disabled ? "disabled" : ""}>记为最近使用</button>
      </section>`
    : "";
  const options = (items: readonly string[], selectedValue: string) =>
    `<option value="">全部</option>${items
      .map(
        (item) =>
          `<option value="${escapeHtml(item)}" ${item === selectedValue ? "selected" : ""}>${escapeHtml(item)}</option>`,
      )
      .join("")}`;
  const gradeOptions = options(["三年级", "四年级"], snapshot.filters.grade);
  const subjectOptions = options(["数学", "语文", "科学", "综合实践"], snapshot.filters.subject);
  const tagOptions = options(
    ["小组活动", "课堂探索", "阅读引导", "课堂分享", "数感练习"],
    snapshot.filters.tag,
  );
  return `<main class="internal-main shared-main resource-library-main staff-daily-panel" data-resource-library>
    <p><a class="button button-light" href="/staff/workbench?mode=shared&profile=${encodeURIComponent(snapshot.profile ?? "teacher-east")}">返回工作台</a></p>
    <header class="internal-page-heading"><p class="section-kicker">员工端 · 教学资源</p><h1>教学资源</h1><p>资源仅按当前登录身份和校区范围显示，所有内容均为合成示例。</p></header>
    <p data-resource-status role="status" aria-live="polite" tabindex="-1">${escapeHtml(snapshot.message)}</p>
    ${snapshot.status === "DISCONNECTED" && snapshot.profile ? `<button class="button button-light" type="button" data-resource-action="connect">重新连接</button>` : ""}
    <section class="panel staff-content-card" aria-labelledby="resource-search-heading">
      <h2 id="resource-search-heading">搜索与筛选</h2>
      <form class="shared-fields staff-daily-fields" data-resource-search>
        <label>关键词<input name="query" maxlength="80" value="${escapeHtml(snapshot.filters.query)}" autocomplete="off" /></label>
        <label>年级<select name="grade">${gradeOptions}</select></label>
        <label>学科<select name="subject">${subjectOptions}</select></label>
        <label>标签<select name="tag">${tagOptions}</select></label>
        <button class="button button-solid" type="submit" ${disabled ? "disabled" : ""}>搜索</button>
        <button class="button button-outline" type="button" data-resource-action="clear" ${disabled ? "disabled" : ""}>清除条件</button>
      </form>
    </section>
    ${detail}
    <section class="panel staff-content-card"><h2>资源目录</h2>${renderResourceRows(snapshot.resources, "search", disabled)}</section>
    <div class="resource-library-columns staff-content-grid">
      <section class="panel staff-content-card"><h2>我的收藏</h2>${renderResourceRows(snapshot.favorites, "favorites", disabled)}</section>
      <section class="panel staff-content-card"><h2>最近使用</h2>${renderResourceRows(snapshot.recent, "recent", disabled)}</section>
    </div>
    <p>收藏和最近使用只保存在当前本机服务进程中，重启服务后会清空。</p>
  </main>`;
}
