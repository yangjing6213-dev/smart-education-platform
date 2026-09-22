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
  readonly items: readonly unknown[];
}

export interface VisitorLayoutConstraints {
  readonly maxInlineSize: "100%";
  readonly minInlineSize: "0";
  readonly overflowX: "hidden";
}

export interface VisitorHomeView {
  readonly route: "pages/visitor/home";
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
  return parsed.valid ? parsed.items.filter(isPublishedVisitorItem) : [];
}

export function renderVisitorHome(
  response: unknown,
  state: VisitorPageState = "PUBLISHED",
): VisitorHomeView {
  const parsed = parseVisitorResponse(response);
  const items =
    state === "PUBLISHED" && parsed.valid ? parsed.items.filter(isPublishedVisitorItem) : [];
  const resolvedState: VisitorPageState =
    state === "PUBLISHED"
      ? !parsed.valid
        ? "ERROR"
        : items.length === 0
          ? "EMPTY"
          : "PUBLISHED"
      : state;
  const statusAnnouncement = statusFor(resolvedState, items[0]?.title);
  const focusOrder =
    resolvedState === "EMPTY"
      ? ["visitor-home-empty-action"]
      : items.map((item) => `visitor-content-${item.slug}`);

  return {
    route: "pages/visitor/home",
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
                <button data-action="select" data-content-key="${escapeHtml(item.slug)}" id="visitor-content-${escapeHtml(item.slug)}" type="button">打开内容</button>
              </article>`,
          )
          .join("")
      : "";
  const emptyAction =
    state === "EMPTY"
      ? '<button data-action="refresh" id="visitor-home-empty-action" type="button">重新查看公开内容</button>'
      : "";

  return `
    <main data-platform="mini-program" aria-labelledby="visitor-home-heading" style="max-inline-size:100%;min-inline-size:0;overflow-x:hidden">
      <h1 id="visitor-home-heading">访客首页</h1>
      <p>模拟数据</p>
      <p role="status" aria-live="polite">${escapeHtml(statusAnnouncement)}</p>
      ${emptyAction}
      ${itemMarkup}
    </main>
  `.trim();
}

function parseVisitorResponse(
  response: unknown,
):
  | { readonly valid: true; readonly items: readonly PublicVisitorItem[] }
  | { readonly valid: false; readonly items: readonly [] } {
  if (!isRecord(response) || !Array.isArray(response.items)) {
    return { valid: false, items: [] };
  }

  return {
    valid: true,
    items: response.items.flatMap((item) => {
      const parsed = parseVisitorItem(item);
      return parsed === undefined ? [] : [parsed];
    }),
  };
}

function parseVisitorItem(value: unknown): PublicVisitorItem | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const body = value.body;
  if (
    typeof value.slug !== "string" ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.slug) ||
    typeof value.title !== "string" ||
    value.title.trim().length === 0 ||
    typeof value.summary !== "string" ||
    value.summary.trim().length === 0 ||
    !Array.isArray(body) ||
    body.length === 0 ||
    !body.every((paragraph) => typeof paragraph === "string" && paragraph.trim().length > 0) ||
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

function statusFor(state: VisitorPageState, firstTitle: string | undefined): string {
  return state === "LOADING"
    ? "正在加载公开内容"
    : state === "EMPTY"
      ? "暂无已发布公开内容"
      : state === "ERROR"
        ? "公开内容暂不可用"
        : `已发布公开内容：${firstTitle ?? "模拟学习欢迎"}`;
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
