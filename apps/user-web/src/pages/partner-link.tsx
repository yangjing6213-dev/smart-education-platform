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
  const state = input.state ?? (items.length === 0 ? "EMPTY" : "LIST");
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
  };
}
