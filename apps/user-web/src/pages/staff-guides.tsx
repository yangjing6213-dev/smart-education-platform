export interface StaffGuidesSearchState {
  readonly query: string;
  readonly category?: "ORIENTATION" | "POLICY" | "SAFETY";
  readonly limit: number;
}

export interface StaffGuidesPageView {
  readonly route: "/staff/guides";
  readonly heading: "新员工指南";
  readonly visibility: "AUTHORIZED_STAFF";
  readonly syntheticLabel: "模拟数据";
  readonly search: StaffGuidesSearchState;
  readonly state: "LIST" | "EMPTY";
  readonly items: readonly StaffGuideItem[];
  readonly html: string;
}

export interface StaffGuideItem {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly category: "ORIENTATION" | "POLICY" | "SAFETY";
  readonly version: number;
  readonly status: "PUBLISHED";
}

const SYNTHETIC_GUIDES: readonly StaffGuideItem[] = [
  {
    id: "guide-welcome",
    title: "新成员指南",
    summary: "模拟数据：介绍报到、校区范围和内部支持入口。",
    category: "ORIENTATION",
    version: 2,
    status: "PUBLISHED",
  },
  {
    id: "guide-safety",
    title: "安全沟通要点",
    summary: "模拟数据：帮助团队保持清晰、克制的沟通方式。",
    category: "SAFETY",
    version: 1,
    status: "PUBLISHED",
  },
];

export function StaffGuidesPage(search: StaffGuidesSearchState): StaffGuidesPageView {
  const query = search.query.trim().toLocaleLowerCase();
  const candidates = SYNTHETIC_GUIDES.filter((guide) => {
    const matchesQuery =
      query.length === 0 || `${guide.title} ${guide.summary}`.toLocaleLowerCase().includes(query);
    const matchesCategory = search.category === undefined || guide.category === search.category;
    return matchesQuery && matchesCategory;
  });
  const limit = Number.isInteger(search.limit) && search.limit > 0 ? search.limit : 20;
  const items = candidates.slice(0, limit);

  return {
    route: "/staff/guides",
    heading: "新员工指南",
    visibility: "AUTHORIZED_STAFF",
    syntheticLabel: "模拟数据",
    search: { ...search, query: search.query.trim(), limit },
    state: items.length === 0 ? "EMPTY" : "LIST",
    items,
    html: guidesHtml(items),
  };
}

function guidesHtml(items: readonly StaffGuideItem[]): string {
  const list = items
    .map(
      (guide) => `
        <article class="staff-content-card" data-guide-id="${escapeHtml(guide.id)}">
          <p class="staff-content-meta">${escapeHtml(guide.category)} · v${guide.version}</p>
          <h2>${escapeHtml(guide.title)}</h2>
          <p>${escapeHtml(guide.summary)}</p>
          <button type="button" data-action="open-guide">打开指南</button>
        </article>`,
    )
    .join("");

  return `
    <main class="internal-main" data-page="staff-guides">
      <p role="status" aria-live="polite">${items.length === 0 ? "暂无匹配指南" : `已找到 ${items.length} 条模拟指南`}</p>
      <header class="internal-page-heading">
        <p class="section-kicker">STAFF ORIENTATION</p>
        <h1>新员工指南</h1>
        <p>模拟数据 · 仅供授权员工查看</p>
      </header>
      <section class="staff-content-grid" aria-label="指南列表">
        ${list || '<p data-state="empty">暂无匹配指南</p>'}
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
