import {
  publishedVisitorItems,
  type PublicVisitorItem,
  type VisitorLayoutConstraints,
  type VisitorPageState,
  // @ts-expect-error TS6142: this package intentionally keeps JSX-free .tsx page boundaries.
} from "./visitor-home.js";
import type { PublicMealProjection } from "../local-synthetic/public-meals.js";

export type PublicMealPageState =
  | { readonly status: "LOADING"; readonly date: string; readonly meals: readonly [] }
  | { readonly status: "ERROR"; readonly date: string; readonly meals: readonly [] }
  | {
      readonly status: "READY";
      readonly date: string;
      readonly meals: readonly PublicMealProjection[];
    };

export interface VisitorContentView {
  readonly route: `/visitor/content/${string}`;
  readonly heading: string;
  readonly state: VisitorPageState;
  readonly statusAnnouncement: string;
  readonly statusRole: "status";
  readonly item?: PublicVisitorItem;
  readonly publicMeals?: PublicMealPageState;
  readonly layout: VisitorLayoutConstraints;
  readonly requests: readonly string[];
  readonly externalDestinations: readonly string[];
  readonly html: string;
}

export function renderVisitorContent(
  response: unknown,
  slug: string,
  state: VisitorPageState = "PUBLISHED",
  publicMeals?: PublicMealPageState,
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
          : `已发布公开内容：${item?.title ?? "家校共育"}`;

  return {
    route: `/visitor/content/${slug}`,
    heading: item?.title ?? "Visitor content unavailable",
    state: resolvedState,
    statusAnnouncement,
    statusRole: "status",
    ...(item === undefined ? {} : { item }),
    ...(slug === "meal-plan" ? { publicMeals: publicMeals ?? { status: "LOADING", date: "", meals: [] } } : {}),
    layout: {
      maxInlineSize: "100%",
      minInlineSize: "0",
      overflowX: "hidden",
    },
    requests: [],
    externalDestinations: [],
    html: visitorContentHtml(resolvedState, statusAnnouncement, item, publicMeals),
  };
}

function visitorContentHtml(
  state: VisitorPageState,
  statusAnnouncement: string,
  item: PublicVisitorItem | undefined,
  publicMeals: PublicMealPageState | undefined,
): string {
  const isMealPlan = item?.slug === "meal-plan";
  const bodyMarkup =
    state === "PUBLISHED" && item !== undefined
      ? isMealPlan
        ? mealPlanMarkup(publicMeals)
        : item.body.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")
      : "";

  return `
    <main id="main-content" class="visitor-main" aria-labelledby="visitor-content-heading" data-synthetic="true">
      <article class="content-page visitor-content-page">
        <header class="visitor-content-header">
          <p class="eyebrow">同芯学园 · 公开内容 · 模拟数据</p>
          <p class="visitor-content-brand">机构品牌信息：同芯学园</p>
        </header>
        <p class="status-message" role="status" aria-live="polite">${escapeHtml(statusAnnouncement)}</p>
        <h1 id="visitor-content-heading">${escapeHtml(item?.title ?? "访客内容暂不可用")}</h1>
        <div class="content-body">${bodyMarkup || '<p class="visitor-empty-panel" role="status" aria-live="polite">公开内容暂不可用，请返回访客首页查看当前可公开的信息。</p>'}</div>
        <a class="button button-secondary" href="/visitor" aria-label="返回访客首页">返回访客首页 <span aria-hidden="true">←</span></a>
      </article>
    </main>
  `.trim();
}

function mealPlanMarkup(state: PublicMealPageState | undefined): string {
  if (state === undefined || state.status === "LOADING")
    return '<p class="visitor-empty-panel" role="status" aria-live="polite">正在读取本日已发布餐食。</p>';
  if (state.status === "ERROR")
    return '<p class="visitor-empty-panel" role="status" aria-live="polite">公开餐食暂时无法读取，请刷新页面后重试。</p>';
  if (state.meals.length === 0)
    return '<p class="visitor-empty-panel" role="status" aria-live="polite">本日暂无已发布餐食。</p>';
  const mealLabels: Record<PublicMealProjection["meal_type"], string> = {
    BREAKFAST: "早餐",
    LUNCH: "午餐",
    SNACK: "加餐",
    DINNER: "晚餐",
  };
  return state.meals
    .map(
      (meal) =>
        `<section class="visitor-meal-card" aria-label="${escapeHtml(mealLabels[meal.meal_type])}"><h2>${escapeHtml(state.date)} · ${escapeHtml(mealLabels[meal.meal_type])}</h2><ul>${meal.items.map((entry) => `<li>${escapeHtml(entry)}</li>`).join("")}</ul>${meal.notes ? `<p>${escapeHtml(meal.notes)}</p>` : ""}</section>`,
    )
    .join("");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
