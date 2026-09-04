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
}

export function StaffGuidesPage(search: StaffGuidesSearchState): StaffGuidesPageView {
  return {
    route: "/staff/guides",
    heading: "新员工指南",
    visibility: "AUTHORIZED_STAFF",
    syntheticLabel: "模拟数据",
    search,
  };
}
