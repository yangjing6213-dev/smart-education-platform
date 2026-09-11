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

export function publishedVisitorItems(
  response: PublicVisitorResponse,
): readonly PublicVisitorItem[] {
  return response.items.filter(
    (item) =>
      item.publicationStatus === "PUBLISHED" &&
      item.visibility === "PUBLIC" &&
      item.scope === "PUBLIC" &&
      item.syntheticData === "SIMULATED",
  );
}

export function renderVisitorHome(
  response: PublicVisitorResponse,
  state: VisitorPageState = "PUBLISHED",
): VisitorHomeView {
  const items = state === "PUBLISHED" ? publishedVisitorItems(response) : [];
  const resolvedState = state === "PUBLISHED" && items.length === 0 ? "EMPTY" : state;
  const statusAnnouncement =
    resolvedState === "LOADING"
      ? "Loading visitor content"
      : resolvedState === "EMPTY"
        ? "No published visitor content"
        : resolvedState === "ERROR"
          ? "Visitor content is unavailable"
          : `Published visitor content: ${items[0]?.title ?? "Synthetic learning welcome"}`;
  const focusOrder = items.map((item) => `visitor-content-${item.slug}`);

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
              <article data-synthetic="true" data-visibility="public">
                <h2>${escapeHtml(item.title)}</h2>
                <p>${escapeHtml(item.summary)}</p>
                <a id="visitor-content-${escapeHtml(item.slug)}" href="/visitor/content/${escapeHtml(item.slug)}" aria-label="Open ${escapeHtml(item.title)}">Open content</a>
              </article>`,
          )
          .join("")
      : "";

  return `
    <main aria-labelledby="visitor-home-heading" style="max-inline-size:100%;min-inline-size:0;overflow-x:hidden">
      <h1 id="visitor-home-heading">访客首页</h1>
      <p>模拟数据</p>
      <p role="status" aria-live="polite">${escapeHtml(statusAnnouncement)}</p>
      ${itemMarkup}
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
