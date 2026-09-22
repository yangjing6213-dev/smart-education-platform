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
      <section class="hero hero-panel" aria-labelledby="visitor-home-heading">
        <div class="hero-copy">
          <p class="eyebrow eyebrow-dark">课后成长服务 · 模拟数据</p>
          <h1 id="visitor-home-heading">让成长从放学后继续发生</h1>
          <p class="hero-lede">在安全、轻松、有趣的陪伴里，帮助孩子学习新技能，发现小小的热爱。</p>
          <p class="status-message" role="status" aria-live="polite">${escapeHtml(statusAnnouncement)}</p>
          <div class="hero-actions">
            ${primaryAction}
            <a class="button button-light" href="#about">了解同芯 <span aria-hidden="true">↓</span></a>
          </div>
        </div>
        <div class="hero-media" aria-label="孩子们在课后教室合作学习的场景图片">
          <img class="hero-photo" src="/assets/childcare-hero.avif" alt="孩子们在明亮教室里一起学习" />
          <img class="hero-cutout" src="/assets/children-cutout.avif" alt="" />
          <div class="hero-media-copy">
            <span class="hero-media-label">安心托管 · 快乐成长</span>
            <strong>每一步，都值得被认真记录。</strong>
          </div>
        </div>
      </section>

      <section id="about" class="intro-section section-band" data-reveal aria-labelledby="about-heading">
        <div class="section-kicker">关于同芯</div>
        <div class="intro-copy">
          <h2 id="about-heading">用心陪伴每一个<br />小小的明天</h2>
          <div>
            <p>我们相信，孩子的好奇心、创造力和自信心，应该在每天放学后继续被看见。</p>
            <p>同芯为家长提供清晰、安心的公开信息预览。当前页面使用模拟数据，真实服务上线前会经过确认后再公开。</p>
            <a class="button button-outline" href="#visitor-empty-states">认识我们的服务 <span aria-hidden="true">↗</span></a>
          </div>
        </div>
      </section>

      <section class="program-section section-band" data-reveal aria-labelledby="program-heading">
        <div class="section-heading section-heading-split">
          <div>
            <p class="section-kicker">服务方向</p>
            <h2 id="program-heading">学习有趣，成长有迹可循</h2>
          </div>
          <p class="section-note">暂无业务数据时，先用清晰的空状态告诉家长下一步。</p>
        </div>
        <div class="program-grid">
          <article class="program-card program-card-green">
            <span class="program-number">01</span>
            <img class="program-photo" src="/assets/playroom-discovery.avif" alt="孩子在游戏角探索玩具" loading="lazy" decoding="async" />
            <div class="program-icon" aria-hidden="true">✦</div>
            <h3>课后托管</h3>
            <p>从放学到回家，给孩子一段安心、有节奏的成长时间。</p>
            <span class="program-status">信息准备中</span>
          </article>
          <article class="program-card program-card-blue">
            <span class="program-number">02</span>
            <img class="program-photo" src="/assets/classroom-learning.avif" alt="孩子在教室里探索学习工具" loading="lazy" decoding="async" />
            <div class="program-icon" aria-hidden="true">◌</div>
            <h3>兴趣探索</h3>
            <p>用轻松的活动打开好奇心，让每一次尝试都值得被鼓励。</p>
            <span class="program-status">暂无课程</span>
          </article>
          <article class="program-card program-card-yellow">
            <span class="program-number">03</span>
            <img class="program-photo program-photo-cutout" src="/assets/children-cutout.avif" alt="孩子们背着书包准备探索新知识" loading="lazy" decoding="async" />
            <div class="program-icon" aria-hidden="true">↗</div>
            <h3>家长可见</h3>
            <p>重要的服务信息清晰呈现，帮助家长安心了解每一步。</p>
            <span class="program-status">访客预览</span>
          </article>
        </div>
      </section>

      <section class="routine-section section-band" data-reveal aria-labelledby="routine-heading">
        <div class="routine-heading">
          <p class="section-kicker">成长日常</p>
          <h2 id="routine-heading">一段有学习、有玩耍的放学后时光</h2>
        </div>
        <div class="routine-list">
          <article class="routine-step">
            <span class="routine-time">15:30</span>
            <div><h3>抵达与安顿</h3><p>先放下书包，也放松心情。</p></div>
          </article>
          <article class="routine-step">
            <span class="routine-time">16:00</span>
            <div><h3>专注与探索</h3><p>完成当天的小目标，发现新的兴趣。</p></div>
          </article>
          <article class="routine-step">
            <span class="routine-time">17:30</span>
            <div><h3>分享与回家</h3><p>把今天的收获带回家，也带走好心情。</p></div>
          </article>
        </div>
      </section>

      <section class="content-section section-band" data-reveal aria-labelledby="public-content-heading">
        <div class="section-heading">
          <div>
            <p class="section-kicker">公开内容</p>
            <h2 id="public-content-heading">给家长的最新消息</h2>
          </div>
          <p class="section-note">仅展示已发布的模拟内容</p>
        </div>
        <div class="content-grid">
          ${itemMarkup || '<p class="empty-copy" role="status" aria-live="polite">当前没有可展示的公开内容。</p>'}
        </div>
      </section>

      <section class="benefits-section section-band" data-reveal aria-labelledby="benefits-heading">
        <div class="section-heading section-heading-split">
          <div>
            <p class="section-kicker">为什么选择同芯</p>
            <h2 id="benefits-heading">让孩子学习、玩耍，也好好长大</h2>
          </div>
          <p class="section-note">把家长最关心的体验，变成简单清楚的承诺。</p>
        </div>
        <div class="benefit-grid">
          <article class="benefit-item"><span>01</span><h3>安全感</h3><p>明确的服务边界，让每一次公开都值得信赖。</p></article>
          <article class="benefit-item"><span>02</span><h3>好奇心</h3><p>给孩子空间去提问、尝试和表达自己的想法。</p></article>
          <article class="benefit-item"><span>03</span><h3>小目标</h3><p>把大成长拆成每一天可以完成的一小步。</p></article>
          <article class="benefit-item"><span>04</span><h3>好习惯</h3><p>在稳定的节奏里，慢慢建立属于自己的秩序。</p></article>
          <article class="benefit-item"><span>05</span><h3>被看见</h3><p>让孩子的努力被认真记录，也被温柔回应。</p></article>
          <article class="benefit-item"><span>06</span><h3>同成长</h3><p>让家长和孩子一起看见变化发生的过程。</p></article>
        </div>
      </section>

      <section id="visitor-empty-states" class="content-section section-band" data-reveal aria-labelledby="empty-states-heading">
        <div class="section-heading">
          <div>
            <p class="section-kicker">服务状态</p>
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

      <section class="stories-section section-band" data-reveal aria-labelledby="stories-heading">
        <div class="stories-heading">
          <p class="section-kicker">模拟反馈</p>
          <h2 id="stories-heading">来自家长的安心时刻</h2>
        </div>
        <div class="stories-grid">
          <blockquote class="story-card story-card-purple">
            <p>“信息清清楚楚地展示出来，作为家长，我更容易知道现在有什么、还缺什么。”</p>
            <footer>模拟家长 · 小雨的妈妈</footer>
          </blockquote>
          <blockquote class="story-card story-card-peach">
            <p>“孩子愿意分享他今天学到的小事情，这就是我期待的成长。”</p>
            <footer>模拟家长 · 乐乐的爸爸</footer>
          </blockquote>
        </div>
      </section>

      <section class="faq-section section-band" data-reveal aria-labelledby="faq-heading">
        <div class="faq-heading">
          <p class="section-kicker">家长常见问题</p>
          <h2 id="faq-heading">想了解的，都可以先问问</h2>
        </div>
        <div class="faq-list">
          <details><summary>目前页面展示的内容是真实业务数据吗？</summary><p>不是。本页面只使用明确标记的模拟数据，真实服务信息确认后才会公开。</p></details>
          <details><summary>什么时候可以看到课程和校区信息？</summary><p>课程、活动和校区信息准备完成并经过确认后，会从对应的空状态更新为公开内容。</p></details>
          <details><summary>家长可以从哪里了解最新进展？</summary><p>请关注访客首页的公开内容区域，页面会优先呈现已发布、可公开的信息。</p></details>
        </div>
      </section>

      <section class="cta-band" aria-labelledby="cta-heading">
        <div class="cta-decor cta-decor-one" aria-hidden="true"></div>
        <div class="cta-decor cta-decor-two" aria-hidden="true"></div>
        <p class="section-kicker">准备好一起成长了吗？</p>
        <h2 id="cta-heading">给孩子一个<br />充满可能的开始</h2>
        <p>先从公开信息开始了解同芯，服务准备好后，我们会把每个重要细节说清楚。</p>
        <a class="button button-dark" href="#site-footer">查看联系信息 <span aria-hidden="true">↗</span></a>
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
