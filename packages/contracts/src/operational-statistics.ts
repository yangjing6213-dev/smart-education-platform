export type OperationalStatisticsKind =
  "TASK" | "ATTENDANCE" | "PICKUP_EXCEPTION" | "HEALTH_INCIDENT";

export interface OperationalStatisticsSource {
  readonly kind: OperationalStatisticsKind;
  readonly id: string;
  readonly version: number;
  readonly date: string;
}

export interface OperationalStatisticsGroup {
  readonly date: string;
  readonly classId: string;
  readonly classLabel: string;
  readonly kind: OperationalStatisticsKind;
  readonly status: string;
  readonly count: number;
  readonly sources: readonly OperationalStatisticsSource[];
}

export interface OperationalStatisticsTotals {
  readonly tasks: number;
  readonly attendance: number;
  readonly pickupExceptions: number;
  readonly healthIncidents: number;
  readonly total: number;
}

export interface OperationalStatisticsFilter {
  readonly from: string;
  readonly to: string;
  readonly campusId?: string;
  readonly classId?: string;
}

export interface OperationalStatisticsResult {
  readonly mode: "SCOPED";
  readonly campusLabel: "当前授权校区";
  readonly filters: Pick<OperationalStatisticsFilter, "from" | "to" | "classId">;
  readonly classOptions: readonly { readonly id: string; readonly label: string }[];
  readonly totals: OperationalStatisticsTotals;
  readonly groups: readonly OperationalStatisticsGroup[];
}

export interface OperationalStatisticsAnonymousSummary {
  readonly mode: "ANONYMOUS";
  readonly totals: OperationalStatisticsTotals;
}
