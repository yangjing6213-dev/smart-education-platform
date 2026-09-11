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
      : items.map((item) => `visitor-content-${item.slug}`);

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
  const emptyAction =
    state === "EMPTY"
      ? '<a id="visitor-home-empty-action" href="/visitor" aria-label="重新查看公开内容">重新查看公开内容</a>'
      : "";

  return `
    <main aria-labelledby="visitor-home-heading" style="max-inline-size:100%;min-inline-size:0;overflow-x:hidden">
      <h1 id="visitor-home-heading">访客首页</h1>
      <p>模拟数据</p>
      <p role="status" aria-live="polite">${escapeHtml(statusAnnouncement)}</p>
      ${emptyAction}
      ${itemMarkup}
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
