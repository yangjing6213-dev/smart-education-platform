import {
  escapePublicVerticalHtml,
  isPublicInstitution,
  resolvePublicVertical,
  type PublicInstitution,
  type PublicVerticalResponse,
  type PublicVerticalState,
  type PublicVerticalView,
} from "./visitor-public-verticals.js";

export interface VisitorInstitutionView extends PublicVerticalView {
  readonly route: "/web/visitor/institution";
  readonly heading: "机构介绍";
  readonly html: string;
}

export function renderVisitorInstitution(
  response: unknown,
  state: PublicVerticalState = "PUBLISHED",
): VisitorInstitutionView {
  const resolved = resolvePublicVertical<PublicInstitution>(
    response,
    "institution",
    state,
    isPublicInstitution,
  );
  const statusAnnouncement = institutionStatusAnnouncement(resolved.state);
  return {
    route: "/web/visitor/institution",
    heading: "机构介绍",
    state: resolved.state,
    statusAnnouncement,
    statusRole: "status",
    requests: [],
    externalDestinations: [],
    html: institutionHtml(resolved.state, statusAnnouncement, resolved.value),
  };
}

function institutionStatusAnnouncement(state: PublicVerticalState): string {
  if (state === "LOADING") {
    return "正在加载机构介绍";
  }
  if (state === "EMPTY") {
    return "暂无可公开的机构介绍";
  }
  if (state === "ERROR") {
    return "机构介绍暂不可用";
  }
  return "已加载机构介绍模拟数据";
}

function institutionHtml(
  state: PublicVerticalState,
  statusAnnouncement: string,
  institution: PublicInstitution | undefined,
): string {
  if (state !== "PUBLISHED" || institution === undefined) {
    return `
      <main id="main-content" class="visitor-main public-vertical-main" aria-labelledby="institution-heading" data-synthetic="true">
        <section class="public-vertical-state" aria-labelledby="institution-heading">
          <p class="visitor-section-kicker">机构介绍 · 访客公开信息 · 模拟数据</p>
          <h1 id="institution-heading">机构介绍</h1>
          <p class="status-message" role="status" aria-live="polite">${escapePublicVerticalHtml(statusAnnouncement)}</p>
          <p class="public-vertical-state-copy">${escapePublicVerticalHtml(stateCopy(state, "机构介绍"))}</p>
          <a class="button button-dark" href="/visitor#about">返回访客首页 <span aria-hidden="true">→</span></a>
        </section>
      </main>
    `.trim();
  }

  return `
    <main id="main-content" class="visitor-main public-vertical-main" aria-labelledby="institution-heading" data-synthetic="true">
      <section class="public-vertical-hero" aria-labelledby="institution-heading">
        <p class="visitor-section-kicker">机构介绍 · 访客公开信息 · 模拟数据</p>
        <h1 id="institution-heading">${escapePublicVerticalHtml(institution.title)}</h1>
        <p class="public-vertical-lede">${escapePublicVerticalHtml(institution.summary)}</p>
        <p class="status-message" role="status" aria-live="polite">${escapePublicVerticalHtml(statusAnnouncement)}</p>
        <span class="public-vertical-chip">仅当前 synthetic scope · 已发布 · 可公开</span>
      </section>
      <section class="public-vertical-section" aria-labelledby="institution-audience-heading">
        <p class="visitor-section-kicker">我们是谁</p>
        <h2 id="institution-audience-heading">${escapePublicVerticalHtml(institution.audience)}</h2>
        <p>同芯学园用稳定的日常、清晰的边界和家长听得懂的信息，帮助访客先了解服务气质，再决定是否继续沟通。</p>
      </section>
      <section class="public-vertical-section" aria-labelledby="institution-principles-heading">
        <div class="visitor-section-heading">
          <div><p class="visitor-section-kicker">服务原则</p><h2 id="institution-principles-heading">把重要的事情说清楚</h2></div>
          <p class="section-note">公开资料只展示已确认的模拟信息。</p>
        </div>
        <div class="public-vertical-grid">
          ${institution.principles
            .map(
              (principle, index) => `
                <article class="public-vertical-card" data-synthetic="true">
                  <span class="visitor-card-index">${String(index + 1).padStart(2, "0")}</span>
                  <h3>${escapePublicVerticalHtml(principle)}</h3>
                  <p>模拟公开说明 · 不对应真实机构政策。</p>
                </article>`,
            )
            .join("")}
        </div>
      </section>
      <section id="institution-culture" class="public-vertical-section" aria-labelledby="institution-culture-heading">
        <div class="visitor-section-heading">
          <div><p class="visitor-section-kicker">企业文化</p><h2 id="institution-culture-heading">把共同的期待写下来</h2></div>
          <p class="section-note">独立公开区块 · 模拟数据</p>
        </div>
        <div class="public-vertical-grid">
          <article class="public-vertical-card" data-synthetic="true"><h3>尊重尝试</h3><p>给孩子保留表达、提问和重新开始的空间。</p></article>
          <article class="public-vertical-card" data-synthetic="true"><h3>清楚沟通</h3><p>用家长能理解的语言说明日常陪伴边界。</p></article>
        </div>
      </section>
      <section class="public-vertical-callout" aria-labelledby="institution-next-heading">
        <p class="visitor-section-kicker">继续了解</p>
        <h2 id="institution-next-heading">看看一段怎样的放学后时光</h2>
        <p>从机构理念进入日常流程，理解孩子抵达、学习、探索与回家的节奏。</p>
        <div class="hero-actions">
          <a class="button button-dark" href="/web/visitor/day-flow">查看一日流程 <span aria-hidden="true">→</span></a>
          <a class="button button-light" href="/visitor#about">返回访客首页 <span aria-hidden="true">↩</span></a>
        </div>
      </section>
    </main>
  `.trim();
}

function stateCopy(state: PublicVerticalState, label: string): string {
  if (state === "LOADING") {
    return `正在准备${label}，页面只会展示已确认的公开信息。`;
  }
  if (state === "EMPTY") {
    return `当前没有已发布且可公开的${label}，不会根据缺失信息推断机构资料。`;
  }
  if (state === "ERROR") {
    return `当前${label}数据无法通过公开投影校验，请稍后再试。`;
  }
  return "所有内容均为模拟数据。";
}

export type { PublicVerticalResponse };
