import {
  publishedVisitorItems,
  type PublicVisitorResponse,
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
  response: PublicVisitorResponse,
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
    <main aria-labelledby="visitor-content-heading" style="max-inline-size:100%;min-inline-size:0;overflow-x:hidden">
      <p role="status" aria-live="polite">${escapeHtml(statusAnnouncement)}</p>
      <h1 id="visitor-content-heading">${escapeHtml(item?.title ?? "Visitor content unavailable")}</h1>
      ${bodyMarkup}
      <a href="/visitor" aria-label="Return to visitor home">Back to visitor home</a>
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
