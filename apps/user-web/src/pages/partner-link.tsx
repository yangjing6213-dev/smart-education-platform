export type PartnerLinkPageState =
  "LIST" | "EMPTY" | "DETAIL" | "CONFIRMATION" | "EXPIRED" | "DENIED" | "UNAVAILABLE";

export interface PartnerLinkItem {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly symbolicDestination: string;
  readonly normalizedHost: string;
  readonly normalizedPath: string;
  readonly publicationStatus: "PUBLISHED";
  readonly enabledStatus: "ENABLED";
  readonly policyVersion: string;
  readonly version: number;
  readonly syntheticData: "模拟数据";
}

export interface PartnerLinkPageInput {
  readonly state?: PartnerLinkPageState;
  readonly query?: string;
  readonly selectedId?: string;
}

export interface PartnerLinkPageView {
  readonly route: "/web/staff/partner-cloud";
  readonly heading: "伙伴云入口";
  readonly visibility: "AUTHORIZED_STAFF";
  readonly syntheticLabel: "模拟数据";
  readonly state: PartnerLinkPageState;
  readonly query: string;
  readonly items: readonly PartnerLinkItem[];
  readonly selected?: PartnerLinkItem;
  readonly emptyState: "暂无已批准入口";
  readonly detailAction: "查看详情";
  readonly confirmationAction: "确认进入模拟入口";
  readonly expiredState: "入口已过期";
  readonly deniedState: "访问已拒绝";
  readonly unavailableState: "入口暂不可用";
  readonly externalRequests: readonly string[];
  readonly externalResources: readonly string[];
  readonly html: string;
}

const SYNTHETIC_LINKS: readonly PartnerLinkItem[] = [
  {
    id: "partner-link-1",
    title: "模拟伙伴工作台",
    description: "仅用于本地审阅的虚构伙伴入口。",
    symbolicDestination: "PARTNER_CLOUD_SYNTHETIC_WORKSPACE",
    normalizedHost: "synthetic.partner.invalid",
    normalizedPath: "/approved/workspace",
    publicationStatus: "PUBLISHED",
    enabledStatus: "ENABLED",
    policyVersion: "policy-v1",
    version: 3,
    syntheticData: "模拟数据",
  },
  {
    id: "partner-link-2",
    title: "模拟排班查看器",
    description: "仅用于本地审阅的虚构排班入口。",
    symbolicDestination: "PARTNER_CLOUD_SYNTHETIC_SCHEDULE",
    normalizedHost: "synthetic.partner.invalid",
    normalizedPath: "/approved/schedule",
    publicationStatus: "PUBLISHED",
    enabledStatus: "ENABLED",
    policyVersion: "policy-v1",
    version: 2,
    syntheticData: "模拟数据",
  },
];

export function PartnerLinkPage(input: PartnerLinkPageInput = {}): PartnerLinkPageView {
  const query = input.query?.trim() ?? "";
  const items = SYNTHETIC_LINKS.filter((link) =>
    [link.title, link.description, link.symbolicDestination]
      .join(" ")
      .toLocaleLowerCase()
      .includes(query.toLocaleLowerCase()),
  );
  const state = "UNAVAILABLE" as const;
  const selected = SYNTHETIC_LINKS.find((link) => link.id === input.selectedId);

  return {
    route: "/web/staff/partner-cloud",
    heading: "伙伴云入口",
    visibility: "AUTHORIZED_STAFF",
    syntheticLabel: "模拟数据",
    state,
    query,
    items,
    ...(selected === undefined ? {} : { selected }),
    emptyState: "暂无已批准入口",
    detailAction: "查看详情",
    confirmationAction: "确认进入模拟入口",
    expiredState: "入口已过期",
    deniedState: "访问已拒绝",
    unavailableState: "入口暂不可用",
    externalRequests: [],
    externalResources: [],
    html: partnerHtml(),
  };
}

function partnerHtml(): string {
  const entries = SYNTHETIC_LINKS.map(
    (link) => `
      <article class="staff-content-card">
        <p class="staff-content-meta">模拟伙伴入口 · ${escapeHtml(link.symbolicDestination)}</p>
        <h2>${escapeHtml(link.title)}</h2>
        <p>${escapeHtml(link.description)}</p>
        <p class="staff-content-meta">角色说明：仅供已授权员工查看入口说明。</p>
      </article>`,
  ).join("");

  return `
    <main class="internal-main" data-page="partner-link" data-external-requests="0">
      <p role="status" aria-live="polite">伙伴云入口暂未开放，当前不连接外部服务。</p>
      <header class="internal-page-heading">
        <p class="section-kicker">PARTNER CLOUD BOUNDARY</p>
        <h1>伙伴云入口</h1>
        <p>本页仅展示本地合成说明，不提供跳转、登录或外部请求。</p>
      </header>
      <section class="staff-content-grid" aria-label="伙伴入口说明">
        ${entries}
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
