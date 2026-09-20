export type VisitorPageState = "LOADING" | "EMPTY" | "ERROR" | "PUBLISHED";

export interface PublicVisitorItem {
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  readonly body: readonly string[];
  readonly publicationStatus: "PUBLISHED" | "DRAFT";
  readonly visibility: "PUBLIC" | "PRIVATE";
  readonly scope: "PUBLIC" | "FOREIGN";
  readonly syntheticData: "SIMULATED";
  readonly freshnessStatus: "FRESH" | "STALE";
  readonly enabledStatus: "ENABLED" | "DISABLED";
}

export interface PublicVisitorResponse {
  readonly items: readonly PublicVisitorItem[];
}

export interface VisitorLayoutConstraints {
  readonly maxInlineSize: "100%";
  readonly minInlineSize: "0";
  readonly overflowX: "hidden";
}

export interface VisitorHomeView {
  readonly route: "/visitor";
  readonly heading: "访客首页";
  readonly state: VisitorPageState;
  readonly statusAnnouncement: string;
  readonly statusRole: "status";
  readonly items: readonly PublicVisitorItem[];
  readonly focusOrder: readonly string[];
  readonly layout: VisitorLayoutConstraints;
  readonly requests: readonly string[];
  readonly externalDestinations: readonly string[];
  readonly html: string;
}

const LAYOUT: VisitorLayoutConstraints = {
  maxInlineSize: "100%",
  minInlineSize: "0",
  overflowX: "hidden",
};

export function publishedVisitorItems(response: unknown): readonly PublicVisitorItem[] {
  const parsed = parseVisitorResponse(response);
  if (!parsed.valid) {
    return [];
  }

  return parsed.items.filter(isPublishedVisitorItem);
}

export function renderVisitorHome(
  response: unknown,
  state: VisitorPageState = "PUBLISHED",
): VisitorHomeView {
  const parsed = parseVisitorResponse(response);
  const items =
    state === "PUBLISHED" && parsed.valid ? parsed.items.filter(isPublishedVisitorItem) : [];
  const resolvedState =
    state === "PUBLISHED" && !parsed.valid
      ? "ERROR"
      : state === "PUBLISHED" && items.length === 0
        ? "EMPTY"
        : state;
  const statusAnnouncement =
    resolvedState === "LOADING"
      ? "Loading visitor content"
      : resolvedState === "EMPTY"
        ? "No published visitor content"
        : resolvedState === "ERROR"
          ? "Visitor content is unavailable"
          : `Published visitor content: ${items[0]?.title ?? "Synthetic learning welcome"}`;
  const focusOrder =
    resolvedState === "EMPTY"
      ? ["visitor-home-empty-action"]
      : ["visitor-primary-action", ...items.map((item) => `visitor-content-${item.slug}`)];

  return {
    route: "/visitor",
    heading: "访客首页",
    state: resolvedState,
    statusAnnouncement,
    statusRole: "status",
    items,
    focusOrder,
    layout: LAYOUT,
    requests: [],
    externalDestinations: [],
    html: visitorHomeHtml(resolvedState, statusAnnouncement, items),
  };
}

function visitorHomeHtml(
  state: VisitorPageState,
  statusAnnouncement: string,
  items: readonly PublicVisitorItem[],
): string {
  const itemMarkup =
    state === "PUBLISHED"
      ? items
          .map(
            (item) => `
              <article class="content-card" data-synthetic="true" data-visibility="public">
                <p class="eyebrow">公开内容 · 模拟数据</p>
                <h2>${escapeHtml(item.title)}</h2>
                <p class="content-card-summary">${escapeHtml(item.summary)}</p>
                <a class="text-link" id="visitor-content-${escapeHtml(item.slug)}" href="/visitor/content/${escapeHtml(item.slug)}" aria-label="查看${escapeHtml(item.title)}">查看内容 <span aria-hidden="true">→</span></a>
              </article>`,
          )
          .join("")
      : "";
  const primaryAction =
    state === "PUBLISHED" && items[0] !== undefined
      ? `<a class="button button-primary" id="visitor-primary-action" href="/visitor/content/${escapeHtml(items[0].slug)}">查看公开内容 <span aria-hidden="true">→</span></a>`
      : '<a class="button button-primary" id="visitor-home-empty-action" href="/visitor" aria-label="重新查看公开内容">重新查看公开内容</a>';

  return `
    <main id="main-content" class="visitor-main" aria-labelledby="visitor-home-heading">
      <section class="hero" aria-labelledby="visitor-home-heading">
        <div class="hero-copy">
          <p class="eyebrow">家长端 · 模拟数据</p>
          <h1 id="visitor-home-heading">访客首页</h1>
          <p class="hero-lede">查看课后成长服务的公开信息，内容以清晰、安心的方式呈现给家长。</p>
          <p class="status-message" role="status" aria-live="polite">${escapeHtml(statusAnnouncement)}</p>
          <div class="hero-actions">
            ${primaryAction}
            <a class="text-link" href="#visitor-empty-states">查看服务状态 <span aria-hidden="true">↓</span></a>
          </div>
        </div>
        <div class="hero-media" aria-label="托管服务模拟预览">
          <span class="hero-media-label">安全 · 清晰 · 可查</span>
          <strong>每一次成长，都值得被认真记录。</strong>
        </div>
      </section>

      <section class="content-section" aria-labelledby="public-content-heading">
        <div class="section-heading">
          <div>
            <p class="eyebrow">公开内容</p>
            <h2 id="public-content-heading">给家长的最新消息</h2>
          </div>
          <p class="section-note">仅展示已发布的模拟内容</p>
        </div>
        <div class="content-grid">
          ${itemMarkup || '<p class="empty-copy">当前没有可展示的公开内容。</p>'}
        </div>
      </section>

      <section id="visitor-empty-states" class="content-section" aria-labelledby="empty-states-heading">
        <div class="section-heading">
          <div>
            <p class="eyebrow">服务状态</p>
            <h2 id="empty-states-heading">正在准备的服务</h2>
          </div>
          <p class="section-note">暂无业务数据时保持诚实透明</p>
        </div>
        <div class="empty-state-grid">
          <article class="empty-state" aria-labelledby="courses-empty-heading">
            <span class="empty-state-index">01</span>
            <h3 id="courses-empty-heading">暂无课程</h3>
            <p>课程信息准备好后会在这里展示。</p>
          </article>
          <article class="empty-state" aria-labelledby="events-empty-heading">
            <span class="empty-state-index">02</span>
            <h3 id="events-empty-heading">暂无活动</h3>
            <p>活动安排将在确认后公开呈现。</p>
          </article>
          <article class="empty-state" aria-labelledby="campuses-empty-heading">
            <span class="empty-state-index">03</span>
            <h3 id="campuses-empty-heading">暂无校区</h3>
            <p>校区信息仅在正式发布后出现。</p>
          </article>
        </div>
      </section>
    </main>
  `.trim();
}

function parseVisitorItem(value: unknown): PublicVisitorItem | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const body = value.body;
  if (
    typeof value.slug !== "string" ||
    typeof value.title !== "string" ||
    typeof value.summary !== "string" ||
    !Array.isArray(body) ||
    !body.every((paragraph) => typeof paragraph === "string") ||
    (value.publicationStatus !== "PUBLISHED" && value.publicationStatus !== "DRAFT") ||
    (value.visibility !== "PUBLIC" && value.visibility !== "PRIVATE") ||
    (value.scope !== "PUBLIC" && value.scope !== "FOREIGN") ||
    value.syntheticData !== "SIMULATED" ||
    (value.freshnessStatus !== "FRESH" && value.freshnessStatus !== "STALE") ||
    (value.enabledStatus !== "ENABLED" && value.enabledStatus !== "DISABLED")
  ) {
    return undefined;
  }

  return {
    slug: value.slug,
    title: value.title,
    summary: value.summary,
    body,
    publicationStatus: value.publicationStatus,
    visibility: value.visibility,
    scope: value.scope,
    syntheticData: value.syntheticData,
    freshnessStatus: value.freshnessStatus,
    enabledStatus: value.enabledStatus,
  };
}

function parseVisitorResponse(
  response: unknown,
):
  | { readonly valid: true; readonly items: readonly PublicVisitorItem[] }
  | { readonly valid: false; readonly items: readonly [] } {
  if (!isRecord(response) || !Array.isArray(response.items)) {
    return { valid: false, items: [] };
  }

  const items = response.items.map(parseVisitorItem);
  if (items.some((item) => item === undefined)) {
    return { valid: false, items: [] };
  }

  return { valid: true, items: items as PublicVisitorItem[] };
}

function isPublishedVisitorItem(item: PublicVisitorItem): boolean {
  return (
    item.publicationStatus === "PUBLISHED" &&
    item.visibility === "PUBLIC" &&
    item.scope === "PUBLIC" &&
    item.syntheticData === "SIMULATED" &&
    item.freshnessStatus === "FRESH" &&
    item.enabledStatus === "ENABLED"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
