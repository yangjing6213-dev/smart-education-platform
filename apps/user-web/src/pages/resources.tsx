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
}

export function TeachingResourcesPage(search: ResourcesSearchState): TeachingResourcesPageView {
  return {
    route: "/web/staff/resources",
    heading: "教学资源",
    visibility: "AUTHORIZED_STAFF",
    syntheticLabel: "模拟数据",
    search,
    emptyState: "暂无资源或无结果",
    clearAction: "清除条件",
    detailAction: "打开详情",
  };
}
