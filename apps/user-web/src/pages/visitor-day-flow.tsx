import {
  escapePublicVerticalHtml,
  isPublicDayFlow,
  resolvePublicVertical,
  type PublicDayFlow,
  type PublicVerticalState,
  type PublicVerticalView,
} from "./visitor-public-verticals.js";

export interface VisitorDayFlowView extends PublicVerticalView {
  readonly route: "/web/visitor/day-flow";
  readonly heading: "一日流程";
  readonly html: string;
}

export function renderVisitorDayFlow(
  response: unknown,
  state: PublicVerticalState = "PUBLISHED",
): VisitorDayFlowView {
  const resolved = resolvePublicVertical<PublicDayFlow>(
    response,
    "dayFlow",
    state,
    isPublicDayFlow,
  );
  const statusAnnouncement = dayFlowStatusAnnouncement(resolved.state);
  return {
    route: "/web/visitor/day-flow",
    heading: "一日流程",
    state: resolved.state,
    statusAnnouncement,
    statusRole: "status",
    requests: [],
    externalDestinations: [],
    html: dayFlowHtml(resolved.state, statusAnnouncement, resolved.value),
  };
}

function dayFlowStatusAnnouncement(state: PublicVerticalState): string {
  if (state === "LOADING") {
    return "正在加载一日流程";
  }
  if (state === "EMPTY") {
    return "暂无可公开的一日流程";
  }
  if (state === "ERROR") {
    return "一日流程暂不可用";
  }
  return "已加载一日流程模拟数据";
}

function dayFlowHtml(
  state: PublicVerticalState,
  statusAnnouncement: string,
  dayFlow: PublicDayFlow | undefined,
): string {
  if (state !== "PUBLISHED" || dayFlow === undefined) {
    return `
      <main id="main-content" class="visitor-main public-vertical-main" aria-labelledby="day-flow-heading" data-synthetic="true">
        <section class="public-vertical-state" aria-labelledby="day-flow-heading">
          <p class="visitor-section-kicker">一日流程 · 访客公开信息 · 模拟数据</p>
          <h1 id="day-flow-heading">一日流程</h1>
          <p class="status-message" role="status" aria-live="polite">${escapePublicVerticalHtml(statusAnnouncement)}</p>
          <p class="public-vertical-state-copy">${escapePublicVerticalHtml(stateCopy(state))}</p>
          <a class="button button-dark" href="/visitor#routine">返回访客首页 <span aria-hidden="true">→</span></a>
        </section>
      </main>
    `.trim();
  }

  return `
    <main id="main-content" class="visitor-main public-vertical-main" aria-labelledby="day-flow-heading" data-synthetic="true">
      <section class="public-vertical-hero" aria-labelledby="day-flow-heading">
        <p class="visitor-section-kicker">一日流程 · 访客公开信息 · 模拟数据</p>
        <h1 id="day-flow-heading">${escapePublicVerticalHtml(dayFlow.title)}</h1>
        <p class="public-vertical-lede">${escapePublicVerticalHtml(dayFlow.summary)}</p>
        <p class="status-message" role="status" aria-live="polite">${escapePublicVerticalHtml(statusAnnouncement)}</p>
        <span class="public-vertical-chip">仅当前 synthetic scope · 已发布 · 可公开</span>
      </section>
      <section class="public-vertical-section" aria-labelledby="day-flow-steps-heading">
        <div class="visitor-section-heading">
          <div><p class="visitor-section-kicker">一段放学后时光</p><h2 id="day-flow-steps-heading">学习、探索，也好好回家</h2></div>
          <p class="section-note">模拟流程不代表任何真实校区排班。</p>
        </div>
        <div class="public-vertical-timeline">
          ${dayFlow.steps
            .map(
              (step, index) => `
                <details class="public-vertical-timeline-step" data-synthetic="true" open>
                  <summary>
                    <time datetime="${escapePublicVerticalHtml(step.time)}">${escapePublicVerticalHtml(step.time)}</time>
                    <span><span class="visitor-card-index">${String(index + 1).padStart(2, "0")}</span><strong class="public-vertical-timeline-title">${escapePublicVerticalHtml(step.title)}</strong></span>
                  </summary>
                  <p>${escapePublicVerticalHtml(step.description)}</p>
                </details>`,
            )
            .join("")}
        </div>
      </section>
      <section class="public-vertical-callout" aria-labelledby="day-flow-next-heading">
        <p class="visitor-section-kicker">返回理解</p>
        <h2 id="day-flow-next-heading">先认识同芯，再决定下一步</h2>
        <p>公开访客页面只展示已确认的模拟信息，不连接真实认证、联系方式或报名服务。</p>
        <div class="hero-actions">
          <a class="button button-dark" href="/web/visitor/institution#institution-culture">查看机构介绍 <span aria-hidden="true">→</span></a>
          <a class="button button-light" href="/visitor#routine">返回访客首页 <span aria-hidden="true">↩</span></a>
        </div>
      </section>
    </main>
  `.trim();
}

function stateCopy(state: PublicVerticalState): string {
  if (state === "LOADING") {
    return "正在准备一日流程，页面只会展示已确认的公开信息。";
  }
  if (state === "EMPTY") {
    return "当前没有已发布且可公开的一日流程，不会根据缺失信息推断排班。";
  }
  if (state === "ERROR") {
    return "当前一日流程数据无法通过公开投影校验，请稍后再试。";
  }
  return "所有内容均为模拟数据。";
}
