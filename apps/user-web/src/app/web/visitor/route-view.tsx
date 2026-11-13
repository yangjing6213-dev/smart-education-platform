import type { ReactNode } from "react";
import { notFound } from "next/navigation.js";
import {
  createSyntheticPublicVerticalResponse,
  isPublicDayFlow,
  resolvePublicVertical,
} from "../../../pages/visitor-public-verticals";
import {
  PublicInstitutionClient,
  type PublicInstitutionReadState,
  type PublicInstitutionVisitorItem,
} from "./public-institution";
import { ContactIntent } from "./contact-intent";
import { PublicMealsPanel } from "./public-meals-panel";
import { SiteFooter, SiteHeader, type VisitorSection } from "./site-header";

const publicVerticals = createSyntheticPublicVerticalResponse();

function unavailableMessage(state: PublicInstitutionReadState): string {
  if (state === "NOT_CONFIGURED") return "公开机构资料尚未配置，暂时无法展示。";
  if (state === "EMPTY" || state === "READY") return "当前没有已发布且可公开的内容。";
  return "公开机构资料暂时无法读取，请稍后重试。";
}

function unavailablePage(title: string, state: PublicInstitutionReadState): ReactNode {
  return (
    <main
      id="main-content"
      className="visitor-main public-vertical-main"
      aria-labelledby="visitor-unavailable-heading"
    >
      <section className="public-vertical-hero" role="status" aria-live="polite">
        <p className="visitor-section-kicker">同芯学园 · 访客公开信息</p>
        <h1 id="visitor-unavailable-heading">{title}</h1>
        <p className="public-vertical-lede">{unavailableMessage(state)}</p>
        <a className="button button-dark" href="/visitor">
          返回访客首页
        </a>
      </section>
    </main>
  );
}

function publicContentPage(
  title: string,
  summary: string,
  paragraphs: readonly string[],
): ReactNode {
  return (
    <main
      id="main-content"
      className="visitor-main public-vertical-main"
      aria-labelledby="visitor-content-heading"
      data-synthetic="true"
    >
      <article className="content-page visitor-content-page">
        <header className="visitor-content-header">
          <p className="eyebrow">同芯学园 · 已发布公开内容 · 合成数据</p>
          <p className="visitor-content-brand">公开资料来自已发布的机构内容。</p>
        </header>
        <p className="status-message" role="status" aria-live="polite">
          当前显示已发布且可公开的内容。
        </p>
        <h1 id="visitor-content-heading">{title}</h1>
        {summary.length > 0 ? <p className="public-vertical-lede">{summary}</p> : null}
        <div className="content-body">
          {paragraphs.map((paragraph, index) => (
            <p key={`${index}:${paragraph}`}>{paragraph}</p>
          ))}
        </div>
        <a className="button button-secondary" href="/visitor" aria-label="返回访客首页">
          返回访客首页 <span aria-hidden="true">←</span>
        </a>
      </article>
    </main>
  );
}

function publicHomePage(items: readonly PublicInstitutionVisitorItem[]): ReactNode {
  return (
    <main
      id="main-content"
      className="visitor-main public-vertical-main"
      aria-labelledby="visitor-home-heading"
    >
      <section
        className="public-vertical-hero"
        aria-labelledby="visitor-home-heading"
        data-synthetic="true"
      >
        <p className="visitor-section-kicker">同芯学园 · 已发布公开信息 · 合成数据</p>
        <h1 id="visitor-home-heading">课后成长与校园动态</h1>
        <p className="public-vertical-lede">以下内容来自当前校区已发布且可公开的机构资料。</p>
      </section>
      <section
        className="public-vertical-section"
        aria-labelledby="visitor-public-content-heading"
        data-synthetic="true"
      >
        <div className="visitor-section-heading">
          <div>
            <p className="visitor-section-kicker">公开内容</p>
            <h2 id="visitor-public-content-heading">机构动态</h2>
          </div>
          <p className="section-note">仅展示已审核发布的合成内容。</p>
        </div>
        <div className="visitor-update-grid">
          {items.map((item) => (
            <article className="content-card" data-synthetic="true" key={item.slug}>
              <p className="eyebrow">公开内容 · 模拟数据</p>
              <h3>{item.title}</h3>
              <p className="content-card-summary">{item.summary}</p>
              <a className="text-link" href={`/visitor/content/${encodeURIComponent(item.slug)}`}>
                查看内容 <span aria-hidden="true">→</span>
              </a>
            </article>
          ))}
        </div>
      </section>
      <section
        className="public-vertical-section visitor-home-activity-section"
        aria-labelledby="visitor-home-activity-heading"
      >
        <div className="visitor-section-heading">
          <div>
            <p className="visitor-section-kicker">同芯学园 · 校园动态</p>
            <h2 id="visitor-home-activity-heading">校园活动现场</h2>
          </div>
          <p className="section-note">机构活动实景照片。</p>
        </div>
        <figure className="visitor-home-activity-card">
          <img
            className="visitor-home-activity-photo"
            data-institution-activity-photo
            src="/assets/institution-activity-visit.jpg"
            alt="同芯学园教师带领学生参加校园参观交流活动"
            loading="lazy"
            decoding="async"
          />
          <figcaption>教师与学生参加校园活动</figcaption>
        </figure>
      </section>
      <section
        className="public-vertical-section institution-team-section"
        aria-labelledby="institution-team-heading"
      >
        <div className="visitor-section-heading">
          <div>
            <p className="visitor-section-kicker">同芯学园 · 教师团队</p>
            <h2 id="institution-team-heading">用心陪伴孩子成长</h2>
          </div>
          <p className="section-note">教师团队真实合影。</p>
        </div>
        <div className="institution-team-grid">
          <figure className="institution-team-card">
            <img
              className="institution-team-photo"
              src="/assets/teacher-team-outdoor.jpg"
              alt="同芯学园教师团队户外合影"
              loading="lazy"
              decoding="async"
            />
            <figcaption>教师团队 · 户外合影</figcaption>
          </figure>
          <figure className="institution-team-card">
            <img
              className="institution-team-photo"
              src="/assets/teacher-team-campus.jpg"
              alt="同芯学园教师团队在校区合影"
              loading="lazy"
              decoding="async"
            />
            <figcaption>教师团队 · 校区合影</figcaption>
          </figure>
        </div>
      </section>
      <PublicMealsPanel />
      <section
        id="contact-intent"
        className="public-vertical-section visitor-contact-intent"
        aria-labelledby="contact-intent-heading"
      >
        <div className="visitor-section-heading">
          <div>
            <p className="visitor-section-kicker">联系意向 · 模拟</p>
            <h2 id="contact-intent-heading">想进一步了解同芯？</h2>
          </div>
          <p className="section-note">只展示本地确认流程，不接入真实联系服务。</p>
        </div>
        <div id="contact-intent-body" data-contact-intent-body />
        <ContactIntent />
      </section>
    </main>
  );
}

export async function VisitorRouteView({
  path,
  section,
}: {
  readonly path: string;
  readonly section: VisitorSection;
}) {
  let content: ReactNode;
  const institutionClient = new PublicInstitutionClient({
    baseUrl: process.env.PUBLIC_API_BASE_URL,
    publicRef: process.env.PUBLIC_CAMPUS_REF,
  });

  if (path.startsWith("/visitor/content/")) {
    const slug = path.slice("/visitor/content/".length);
    const result = await institutionClient.read("home", slug);
    if (result.state === "EMPTY") notFound();
    content =
      result.state === "READY" && result.item !== undefined
        ? publicContentPage(result.item.title, result.item.summary, result.item.body)
        : unavailablePage("访客内容暂不可用", result.state);
  } else if (section === "home") {
    const result = await institutionClient.list("home");
    if (result.state === "READY" && result.items.length > 0) {
      content = publicHomePage(result.items);
    } else {
      content = unavailablePage("访客公开内容暂不可用", result.state);
    }
  } else if (section === "institution") {
    const result = await institutionClient.list("profile");
    const institution = result.items[0];
    content =
      result.state === "READY" && institution !== undefined
        ? publicContentPage(institution.title, institution.summary, institution.body)
        : unavailablePage("机构介绍暂不可用", result.state);
  } else {
    const result = resolvePublicVertical(publicVerticals, "dayFlow", "PUBLISHED", isPublicDayFlow);
    const flow = result.value;
    content = (
      <main
        id="main-content"
        className="visitor-main public-vertical-main"
        aria-labelledby="day-flow-heading"
        data-synthetic="true"
      >
        <section className="public-vertical-hero" aria-labelledby="day-flow-heading">
          <p className="visitor-section-kicker">一日流程 · 访客公开信息 · 模拟数据</p>
          <h1 id="day-flow-heading">{flow?.title ?? "一日流程"}</h1>
          <p className="public-vertical-lede">{flow?.summary ?? "暂无可公开的一日流程。"}</p>
          <p className="status-message" role="status" aria-live="polite">
            已加载合成的一日流程示例。
          </p>
          <span className="public-vertical-chip">仅作演示 · 不代表真实校区安排</span>
        </section>
        <section className="public-vertical-section" aria-labelledby="day-flow-steps-heading">
          <div className="visitor-section-heading">
            <div>
              <p className="visitor-section-kicker">一段放学后时光</p>
              <h2 id="day-flow-steps-heading">学习、探索，也好好回家</h2>
            </div>
            <p className="section-note">具体安排以经确认的校区信息为准。</p>
          </div>
          <div className="public-vertical-timeline">
            {flow?.steps.map((step, index) => (
              <details
                className="public-vertical-timeline-step"
                data-synthetic="true"
                open
                key={step.time}
              >
                <summary>
                  <time>{step.time}</time>
                  <span>
                    <span className="visitor-card-index">{String(index + 1).padStart(2, "0")}</span>
                    <strong className="public-vertical-timeline-title">{step.title}</strong>
                  </span>
                </summary>
                <p>{step.description}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="public-vertical-callout" aria-labelledby="day-flow-next-heading">
          <h2 id="day-flow-next-heading">每一天都留有余地</h2>
          <p>流程仅用于说明服务节奏，具体安排以经确认的校区信息为准。</p>
          <a className="button button-dark" href="/visitor#routine">
            返回访客首页 <span aria-hidden="true">→</span>
          </a>
        </section>
      </main>
    );
  }

  return (
    <>
      <SiteHeader active={section} />
      {content}
      <SiteFooter />
    </>
  );
}
