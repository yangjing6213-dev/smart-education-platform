import {
  publishedVisitorItems,
  type PublicVisitorItem,
  type VisitorLayoutConstraints,
  type VisitorPageState,
} from "./home.ts";

export interface VisitorBackNavigation {
  readonly route: "pages/visitor/home";
}

export interface VisitorContentView {
  readonly route: `pages/visitor/content/${string}`;
  readonly heading: string;
  readonly state: VisitorPageState;
  readonly statusAnnouncement: string;
  readonly statusRole: "status";
  readonly item?: PublicVisitorItem;
  readonly backNavigation: VisitorBackNavigation;
  readonly layout: VisitorLayoutConstraints;
  readonly requests: readonly string[];
  readonly externalDestinations: readonly string[];
  readonly html: string;
}

export function renderVisitorContent(
  response: unknown,
  contentKey: string,
  state: VisitorPageState = "PUBLISHED",
): VisitorContentView {
  const item =
    state === "PUBLISHED"
      ? publishedVisitorItems(response).find((candidate) => candidate.slug === contentKey)
      : undefined;
  const resolvedState: VisitorPageState =
    item === undefined && state === "PUBLISHED" ? "ERROR" : state;
  const statusAnnouncement =
    resolvedState === "LOADING"
      ? "正在加载公开内容"
      : resolvedState === "EMPTY"
        ? "暂无已发布公开内容"
        : resolvedState === "ERROR"
          ? "公开内容暂不可用"
          : `已发布公开内容：${item?.title ?? "模拟学习欢迎"}`;

  return {
    route: `pages/visitor/content/${contentKey}`,
    heading: item?.title ?? "公开内容不可用",
    state: resolvedState,
    statusAnnouncement,
    statusRole: "status",
    ...(item === undefined ? {} : { item }),
    backNavigation: { route: "pages/visitor/home" },
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
    <main data-platform="mini-program" aria-labelledby="visitor-content-heading" style="max-inline-size:100%;min-inline-size:0;overflow-x:hidden">
      <p role="status" aria-live="polite">${escapeHtml(statusAnnouncement)}</p>
      <h1 id="visitor-content-heading">${escapeHtml(item?.title ?? "公开内容不可用")}</h1>
      ${bodyMarkup}
      <button data-action="back" type="button">返回访客首页</button>
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
