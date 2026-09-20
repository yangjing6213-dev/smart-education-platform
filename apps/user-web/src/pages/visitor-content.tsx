import {
  publishedVisitorItems,
  type PublicVisitorItem,
  type VisitorLayoutConstraints,
  type VisitorPageState,
  // @ts-expect-error TS6142: this package intentionally keeps JSX-free .tsx page boundaries.
} from "./visitor-home.js";

export interface VisitorContentView {
  readonly route: `/visitor/content/${string}`;
  readonly heading: string;
  readonly state: VisitorPageState;
  readonly statusAnnouncement: string;
  readonly statusRole: "status";
  readonly item?: PublicVisitorItem;
  readonly layout: VisitorLayoutConstraints;
  readonly requests: readonly string[];
  readonly externalDestinations: readonly string[];
  readonly html: string;
}

export function renderVisitorContent(
  response: unknown,
  slug: string,
  state: VisitorPageState = "PUBLISHED",
): VisitorContentView {
  const item =
    state === "PUBLISHED"
      ? publishedVisitorItems(response).find((candidate) => candidate.slug === slug)
      : undefined;
  const resolvedState: VisitorPageState =
    item === undefined && state === "PUBLISHED" ? "ERROR" : state;
  const statusAnnouncement =
    resolvedState === "LOADING"
      ? "Loading visitor content"
      : resolvedState === "EMPTY"
        ? "No published visitor content"
        : resolvedState === "ERROR"
          ? "Visitor content is unavailable"
          : `Published visitor content: ${item?.title ?? "Synthetic learning welcome"}`;

  return {
    route: `/visitor/content/${slug}`,
    heading: item?.title ?? "Visitor content unavailable",
    state: resolvedState,
    statusAnnouncement,
    statusRole: "status",
    ...(item === undefined ? {} : { item }),
    layout: {
      maxInlineSize: "100%",
      minInlineSize: "0",
      overflowX: "hidden",
    },
    requests: [],
    externalDestinations: [],
    html: visitorContentHtml(resolvedState, statusAnnouncement, item),
  };
}

function visitorContentHtml(
  state: VisitorPageState,
  statusAnnouncement: string,
  item: PublicVisitorItem | undefined,
): string {
  const bodyMarkup =
    state === "PUBLISHED" && item !== undefined
      ? item.body.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")
      : "";

  return `
    <main id="main-content" class="visitor-main" aria-labelledby="visitor-content-heading">
      <article class="content-page">
        <p class="eyebrow">公开内容 · 模拟数据</p>
        <p class="status-message" role="status" aria-live="polite">${escapeHtml(statusAnnouncement)}</p>
        <h1 id="visitor-content-heading">${escapeHtml(item?.title ?? "访客内容暂不可用")}</h1>
        <div class="content-body">${bodyMarkup}</div>
        <a class="button button-secondary" href="/visitor" aria-label="返回访客首页">返回访客首页 <span aria-hidden="true">←</span></a>
      </article>
    </main>
  `.trim();
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
