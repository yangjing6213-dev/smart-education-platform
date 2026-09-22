export type ResourceCategory = "LESSON" | "EXERCISE" | "READING" | "REFERENCE" | "WORKSHEET";

export interface ResourcesSearchState {
  readonly query: string;
  readonly category?: ResourceCategory;
  readonly limit: number;
  readonly cursor?: string;
}

export interface TeachingResourcesPageView {
  readonly route: "/web/staff/resources";
  readonly heading: "教学资源";
  readonly visibility: "AUTHORIZED_STAFF";
  readonly syntheticLabel: "模拟数据";
  readonly search: ResourcesSearchState;
  readonly emptyState: "暂无资源或无结果";
  readonly clearAction: "清除条件";
  readonly detailAction: "打开详情";
  readonly state: "LIST" | "EMPTY";
  readonly items: readonly TeachingResourceItem[];
  readonly html: string;
}

export interface TeachingResourceItem {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly category: ResourceCategory;
  readonly version: number;
  readonly status: "PUBLISHED";
}

const SYNTHETIC_RESOURCES: readonly TeachingResourceItem[] = [
  {
    id: "resource-lesson",
    title: "模拟课堂活动卡",
    summary: "适合课后小组活动的虚构教学资源。",
    category: "LESSON",
    version: 2,
    status: "PUBLISHED",
  },
  {
    id: "resource-reading",
    title: "模拟阅读引导单",
    summary: "帮助教师组织阅读分享的虚构资源。",
    category: "READING",
    version: 1,
    status: "PUBLISHED",
  },
];

export function TeachingResourcesPage(search: ResourcesSearchState): TeachingResourcesPageView {
  const query = search.query.trim().toLocaleLowerCase();
  const candidates = SYNTHETIC_RESOURCES.filter((resource) => {
    const matchesQuery =
      query.length === 0 ||
      `${resource.title} ${resource.summary}`.toLocaleLowerCase().includes(query);
    const matchesCategory = search.category === undefined || resource.category === search.category;
    return matchesQuery && matchesCategory;
  });
  const limit = Number.isInteger(search.limit) && search.limit > 0 ? search.limit : 20;
  const items = candidates.slice(0, limit);

  return {
    route: "/web/staff/resources",
    heading: "教学资源",
    visibility: "AUTHORIZED_STAFF",
    syntheticLabel: "模拟数据",
    search: { ...search, query: search.query.trim(), limit },
    emptyState: "暂无资源或无结果",
    clearAction: "清除条件",
    detailAction: "打开详情",
    state: items.length === 0 ? "EMPTY" : "LIST",
    items,
    html: resourcesHtml(items),
  };
}

function resourcesHtml(items: readonly TeachingResourceItem[]): string {
  const list = items
    .map(
      (resource) => `
        <article class="staff-content-card" data-resource-id="${escapeHtml(resource.id)}">
          <p class="staff-content-meta">${escapeHtml(resource.category)} · v${resource.version}</p>
          <h2>${escapeHtml(resource.title)}</h2>
          <p>${escapeHtml(resource.summary)}</p>
          <button type="button" data-action="open-resource">打开详情</button>
        </article>`,
    )
    .join("");

  return `
    <main class="internal-main" data-page="staff-resources">
      <p role="status" aria-live="polite">${items.length === 0 ? "暂无资源或无结果" : `已找到 ${items.length} 条模拟资源`}</p>
      <header class="internal-page-heading">
        <p class="section-kicker">TEACHING LIBRARY</p>
        <h1>教学资源</h1>
        <p>模拟数据 · 仅供授权员工查看</p>
      </header>
      <section class="staff-content-grid" aria-label="教学资源列表">
        ${list || '<p data-state="empty">暂无资源或无结果</p>'}
      </section>
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
