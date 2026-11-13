export type VisitorPageState = "LOADING" | "EMPTY" | "ERROR" | "PUBLISHED";
export type VisitorContactIntentState = "IDLE" | "INVALID" | "SUBMITTING" | "CONFIRMED";

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
  readonly contactIntentState: "IDLE";
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

export function renderVisitorContactIntent(state: VisitorContactIntentState): string {
  if (state === "SUBMITTING") {
    return `
      <div class="contact-intent-state contact-intent-state-submitting" data-contact-intent-state="SUBMITTING" role="status" aria-live="polite">
        <span class="visitor-card-index">处理中</span>
        <h3>模拟提交中</h3>
        <p>正在准备本地演示确认，不会发送网络请求。</p>
      </div>
    `.trim();
  }

  if (state === "CONFIRMED") {
    return `
      <div class="contact-intent-state contact-intent-state-confirmed" data-contact-intent-state="CONFIRMED" role="status" aria-live="polite">
        <span class="visitor-card-index">已确认</span>
        <h3>已收到你的模拟意向</h3>
        <p>这是本地演示确认态，不会保存信息、不会发送消息或连接外部服务。</p>
      </div>
    `.trim();
  }

  const errorMessage =
    state === "INVALID"
      ? '<p class="contact-intent-error" id="contact-intent-error" role="alert">请填写模拟称呼并选择想了解的内容。</p>'
      : "";

  return `
    <form class="contact-intent-form" data-contact-intent-form="true" data-contact-intent-state="${state}" novalidate>
      <p class="contact-intent-note" id="contact-intent-note">仅用于当前浏览器演示，不保存、不发送。</p>
      ${errorMessage}
      <div class="contact-intent-fields">
        <label class="contact-intent-field">
          <span>联系人称呼（模拟）</span>
          <input id="contact-intent-name" name="contactName" type="text" autocomplete="off" placeholder="例如：示例家长" aria-describedby="contact-intent-note${state === "INVALID" ? " contact-intent-error" : ""}" />
        </label>
        <label class="contact-intent-field">
          <span>想先了解什么</span>
          <select id="contact-intent-topic" name="contactTopic" aria-describedby="contact-intent-note${state === "INVALID" ? " contact-intent-error" : ""}">
            <option value="">请选择一个方向</option>
            <option value="care">课后托管</option>
            <option value="team">教师团队</option>
            <option value="routine">一日流程</option>
          </select>
        </label>
      </div>
      <button id="contact-intent-submit" class="button button-dark" type="submit">提交模拟意向 <span aria-hidden="true">→</span></button>
    </form>
  `.trim();
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
          : `已发布公开内容：${items[0]?.title ?? "家校共育"}`;
  const primaryActionId =
    resolvedState === "PUBLISHED" && items[0] !== undefined
      ? "visitor-primary-action"
      : "visitor-home-empty-action";
  const focusOrder = [
    primaryActionId,
    ...items.map((item) => `visitor-content-${item.slug}`),
    "contact-intent-name",
    "contact-intent-topic",
    "contact-intent-submit",
  ];

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
    contactIntentState: "IDLE",
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
                <h3>${escapeHtml(item.title)}</h3>
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
    <main id="main-content" class="visitor-main" aria-labelledby="visitor-home-heading" data-synthetic="true">
      <section class="visitor-hero" aria-labelledby="visitor-home-heading">
        <div class="visitor-hero-copy">
          <p class="eyebrow eyebrow-dark">同芯学园 · 公开访客预览 · 模拟数据</p>
          <h1 id="visitor-home-heading">同芯学园</h1>
          <p class="visitor-hero-title">让成长从放学后继续发生</p>
          <p class="hero-lede">给孩子一段安全、有节奏、愿意探索的课后时光，也让家长清楚看见机构如何陪伴成长。</p>
          <p class="status-message" role="status" aria-live="polite">${escapeHtml(statusAnnouncement)}</p>
          <div class="hero-actions">
            ${primaryAction}
            <a class="button button-light" href="/web/visitor/institution">了解机构 <span aria-hidden="true">→</span></a>
          </div>
        </div>
        <div class="visitor-hero-media" aria-label="孩子们在课后教室合作学习的模拟场景">
          <img class="visitor-hero-photo" src="/assets/childcare-hero.avif" alt="孩子们在明亮教室里一起学习" />
          <img class="visitor-hero-cutout" src="/assets/children-cutout.avif" alt="" />
          <div class="visitor-hero-caption">
            <span>安心托管 · 快乐成长</span>
            <strong>每一步，都值得被认真记录。</strong>
          </div>
        </div>
      </section>

      <section id="about" class="visitor-home-section visitor-intro" data-reveal aria-labelledby="about-heading">
        <div class="visitor-section-kicker">机构介绍</div>
        <div class="visitor-section-split">
          <div>
            <h2 id="about-heading">先认识同芯，再了解每一天</h2>
            <p class="visitor-lede">同芯学园是面向访客的课后成长服务品牌示例。我们用稳定的日常、清晰的边界和家长可理解的信息，支持孩子在放学后继续学习与表达。</p>
            <a class="button button-dark" href="/web/visitor/institution">查看机构介绍 <span aria-hidden="true">→</span></a>
          </div>
          <div class="visitor-fact-list">
            <div class="visitor-fact"><span>品牌</span><strong>同芯学园</strong><small>模拟机构品牌信息</small></div>
            <div class="visitor-fact"><span>定位</span><strong>课后成长陪伴</strong><small>公开访客信息预览</small></div>
            <div class="visitor-fact"><span>状态</span><strong>内容准备中</strong><small>真实服务信息确认后公开</small></div>
          </div>
        </div>
      </section>

      <section id="family" class="visitor-home-section visitor-family" data-reveal aria-labelledby="family-heading">
        <div class="visitor-section-heading">
          <div>
            <p class="visitor-section-kicker">家校共育</p>
            <h2 id="family-heading">让家长看见过程，也参与成长</h2>
          </div>
          <p class="section-note">用模拟信息展示家长与教师之间的共同语言。</p>
        </div>
        <div class="visitor-family-grid">
          <article class="visitor-family-card visitor-family-card-green"><span class="visitor-card-index">01</span><h3>孩子先尝试</h3><p>保留孩子自己动手、提问和表达的空间，再把值得分享的小进步带回家。</p></article>
          <article class="visitor-family-card visitor-family-card-yellow"><span class="visitor-card-index">02</span><h3>教师做记录</h3><p>用清晰、克制的日常观察帮助家长了解过程，不生成未经确认的评价。</p></article>
          <article class="visitor-family-card visitor-family-card-blue"><span class="visitor-card-index">03</span><h3>家庭有回应</h3><p>家长可以从公开内容开始了解机构，再在合适的时机与团队沟通。</p></article>
        </div>
      </section>

      <section id="routine" class="visitor-home-section visitor-routine" data-reveal aria-labelledby="routine-heading">
        <div class="visitor-section-split visitor-routine-layout">
          <div>
            <p class="visitor-section-kicker">一日流程</p>
            <h2 id="routine-heading">一段有学习、有玩耍的放学后时光</h2>
            <p class="visitor-lede">以下是明确标注的模拟流程，用来帮助访客理解服务节奏，不代表任何真实校区排班。</p>
          </div>
          <div class="visitor-routine-list">
            <article class="visitor-routine-step"><time>15:30</time><div><h3>抵达与安顿</h3><p>放下书包，也放松心情。</p></div></article>
            <article class="visitor-routine-step"><time>16:00</time><div><h3>专注与探索</h3><p>完成当天的小目标，发现新的兴趣。</p></div></article>
            <article class="visitor-routine-step"><time>17:30</time><div><h3>分享与回家</h3><p>把今天的收获带回家，也带走好心情。</p></div></article>
            <a class="button button-dark" href="/web/visitor/day-flow">查看完整一日流程 <span aria-hidden="true">→</span></a>
          </div>
        </div>
      </section>

      <section id="teachers" class="visitor-home-section visitor-teachers" data-reveal aria-labelledby="teachers-heading">
        <div class="visitor-section-heading">
          <div><p class="visitor-section-kicker">教师团队</p><h2 id="teachers-heading">有耐心，也有边界的陪伴者</h2></div>
          <p class="section-note">团队资料均为不可对应真人的模拟信息。</p>
        </div>
        <div class="visitor-team-grid">
          <article class="visitor-team-card" data-synthetic="true"><img src="/assets/classroom-learning.avif" alt="模拟教师团队活动场景" loading="lazy" decoding="async" /><p class="visitor-card-label">模拟教师 01</p><h3>林老师</h3><p>负责日常陪伴与家长沟通示例。</p></article>
          <article class="visitor-team-card" data-synthetic="true"><img src="/assets/playroom-discovery.avif" alt="模拟教师团队活动空间" loading="lazy" decoding="async" /><p class="visitor-card-label">模拟教师 02</p><h3>周老师</h3><p>关注孩子的探索过程与表达空间。</p></article>
          <article class="visitor-team-card" data-synthetic="true"><p class="visitor-card-label">模拟教师 03</p><h3>许老师</h3><p>协助整理日常信息与家庭反馈。</p></article>
        </div>
      </section>

      <section id="activities" class="visitor-home-section visitor-public-updates" data-reveal aria-labelledby="activities-heading">
        <div class="visitor-section-heading">
          <div><p class="visitor-section-kicker">活动与消息</p><h2 id="activities-heading">公开内容会在确认后出现</h2></div>
          <p class="section-note">仅展示已发布、可公开的模拟内容。</p>
        </div>
        <div class="visitor-update-grid">
          ${itemMarkup || '<p class="empty-copy" role="status" aria-live="polite">当前没有可展示的公开内容。</p>'}
          <article class="visitor-empty-panel" aria-labelledby="activities-empty-heading"><span class="visitor-card-index">状态</span><h3 id="activities-empty-heading">暂无活动</h3><p>暂无已发布活动，确认后会在这里展示。</p></article>
        </div>
      </section>

      <section id="meals" class="visitor-home-section visitor-meals" data-reveal aria-labelledby="meals-heading">
        <div class="visitor-section-split">
          <div><p class="visitor-section-kicker">餐食与食谱</p><h2 id="meals-heading">与孩子有关的信息，等确认后再公开</h2></div>
          <article class="visitor-empty-panel" aria-labelledby="meals-empty-heading"><span class="visitor-card-index">状态</span><h3 id="meals-empty-heading">暂无餐食</h3><p>暂无公开餐食或食谱，准备完成后会明确标注日期与适用范围。</p></article>
        </div>
      </section>

      <section id="campus" class="visitor-home-section visitor-environment" data-reveal aria-labelledby="campus-heading">
        <div class="visitor-section-heading">
          <div><p class="visitor-section-kicker">环境与校区</p><h2 id="campus-heading">先看看空间气质，校区资料保持空状态</h2></div>
          <p class="section-note">图片来自项目自有 first-party 资产，仅作视觉示例。</p>
        </div>
        <div class="visitor-environment-grid">
          <figure class="visitor-environment-photo"><img src="/assets/playroom-discovery.avif" alt="明亮开放的模拟活动空间" loading="lazy" decoding="async" /><figcaption>模拟环境示例 · 明亮、可探索、可照看</figcaption></figure>
          <article class="visitor-empty-panel" aria-labelledby="campus-empty-heading"><span class="visitor-card-index">状态</span><h3 id="campus-empty-heading">暂无校区</h3><p>暂无公开校区信息，不推断校区或地址。</p></article>
          <article id="contact-status" class="visitor-empty-panel visitor-contact-panel" aria-labelledby="contact-heading"><span class="visitor-card-index">状态</span><h3 id="contact-heading">联系状态</h3><p>联系信息准备中。当前页面不连接真实电话、表单或外部服务。</p></article>
        </div>
      </section>

      <section id="contact-intent" class="visitor-home-section visitor-contact-intent" data-reveal aria-labelledby="contact-intent-heading">
        <div class="visitor-section-heading">
          <div><p class="visitor-section-kicker">联系意向 · 模拟</p><h2 id="contact-intent-heading">想进一步了解同芯？</h2></div>
          <p class="section-note">只展示本地确认流程，不接入真实联系服务。</p>
        </div>
        <div id="contact-intent-body" data-contact-intent-body>${renderVisitorContactIntent("IDLE")}</div>
      </section>

      <section id="visitor-empty-states" class="visitor-home-section visitor-service-status" data-reveal aria-labelledby="empty-states-heading">
        <div class="visitor-section-heading">
          <div><p class="visitor-section-kicker">服务状态</p><h2 id="empty-states-heading">没有真实内容时，就清楚显示空状态</h2></div>
          <p class="section-note">访客可以知道当前有什么，也知道还没有什么。</p>
        </div>
        <div class="visitor-empty-grid">
          <article class="visitor-empty-panel" aria-labelledby="courses-empty-heading"><span class="visitor-card-index">01</span><h3 id="courses-empty-heading">暂无课程</h3><p>课程安排确认后再公开。</p></article>
          <article class="visitor-empty-panel" aria-labelledby="events-empty-heading"><span class="visitor-card-index">02</span><h3 id="events-empty-heading">暂无活动</h3><p>暂无已发布活动。</p></article>
          <article class="visitor-empty-panel" aria-labelledby="campuses-empty-heading"><span class="visitor-card-index">03</span><h3 id="campuses-empty-heading">暂无校区</h3><p>暂无公开校区信息。</p></article>
        </div>
      </section>

      <section class="visitor-home-section visitor-closing-note" aria-labelledby="closing-heading">
        <p class="visitor-section-kicker">访客端说明</p><h2 id="closing-heading">所有内容均为模拟数据</h2>
        <p>这是 V0.1 公开访客页面的静态预览。真实机构、校区、人员、餐食和联系信息均未接入，也不会从页面推断。</p>
        <a class="button button-dark" href="/visitor#contact-status">查看联系状态 <span aria-hidden="true">↓</span></a>
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
