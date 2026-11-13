import type {
  OperationalStatisticsAnonymousSummary,
  OperationalStatisticsFilter,
  OperationalStatisticsGroup,
  OperationalStatisticsKind,
  OperationalStatisticsResult,
  OperationalStatisticsSource,
  OperationalStatisticsTotals,
} from "@student-care/contracts";
import { LocalError } from "./binding-leave.service.js";
import type {
  Attendance,
  HealthIncident,
  LocalRepository,
  PickupException,
  StaffTask,
} from "./repository.js";
import type { LocalMember } from "./sessions.js";

const invalid = () => new LocalError(400, "INVALID_REQUEST");
const unavailable = () => new LocalError(403, "UNAVAILABLE");
const SOURCE_KINDS = ["staffTask", "attendance", "pickupException", "healthIncident"] as const;

function validDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/u.test(value) &&
    Number.isFinite(Date.parse(`${value}T00:00:00.000Z`)) &&
    new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value
  );
}

function requestDateRange(filters: OperationalStatisticsFilter) {
  if (!validDate(filters.from) || !validDate(filters.to) || filters.from > filters.to)
    throw invalid();
  const first = Date.parse(`${filters.from}T00:00:00.000Z`);
  const last = Date.parse(`${filters.to}T00:00:00.000Z`);
  if ((last - first) / 86_400_000 > 30) throw invalid();
  return { from: filters.from, to: filters.to };
}

function sourceKind(kind: (typeof SOURCE_KINDS)[number]): OperationalStatisticsKind {
  return kind === "staffTask"
    ? "TASK"
    : kind === "attendance"
      ? "ATTENDANCE"
      : kind === "pickupException"
        ? "PICKUP_EXCEPTION"
        : "HEALTH_INCIDENT";
}

function sourceDate(row: StaffTask | Attendance | PickupException | HealthIncident): string {
  if (row.kind === "staffTask") return row.dueDate;
  if (row.kind === "attendance" || row.kind === "pickupException") return row.date;
  const timestamp = Date.parse(row.updatedAt);
  if (!Number.isFinite(timestamp)) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(timestamp);
  const value = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function totalsFor(
  counts: Readonly<Record<OperationalStatisticsKind, number>>,
): OperationalStatisticsTotals {
  const totals = {
    tasks: counts.TASK,
    attendance: counts.ATTENDANCE,
    pickupExceptions: counts.PICKUP_EXCEPTION,
    healthIncidents: counts.HEALTH_INCIDENT,
  };
  return {
    ...totals,
    total: totals.tasks + totals.attendance + totals.pickupExceptions + totals.healthIncidents,
  };
}

function emptyCounts(): Record<OperationalStatisticsKind, number> {
  return { TASK: 0, ATTENDANCE: 0, PICKUP_EXCEPTION: 0, HEALTH_INCIDENT: 0 };
}

function sourceRows(repository: LocalRepository) {
  return repository
    .list()
    .filter((row) => SOURCE_KINDS.includes(row.kind as (typeof SOURCE_KINDS)[number])) as (
    StaffTask | Attendance | PickupException | HealthIncident
  )[];
}

export class OperationalStatisticsService {
  constructor(private readonly repository: LocalRepository) {}

  read(member: LocalMember, filters: OperationalStatisticsFilter): OperationalStatisticsResult {
    if (!member.actions.includes("statistics:read")) throw unavailable();
    if (!filters || typeof filters !== "object") throw invalid();
    if (Object.keys(filters).some((key) => !["from", "to", "campusId", "classId"].includes(key)))
      throw invalid();
    const range = requestDateRange(filters);
    if (filters.campusId !== undefined && filters.campusId !== member.campusId) throw unavailable();
    if (filters.classId !== undefined && !member.classIds.includes(filters.classId))
      throw unavailable();

    const classOptions = member.classIds.map((id, index) => ({
      id,
      label: `授权班级 ${index + 1}`,
    }));
    const labels = new Map(classOptions.map((option) => [option.id, option.label]));
    const grouped = new Map<
      string,
      {
        date: string;
        classId: string;
        kind: OperationalStatisticsKind;
        status: string;
        sources: OperationalStatisticsSource[];
      }
    >();
    const counts = emptyCounts();

    for (const row of sourceRows(this.repository)) {
      if (
        row.tenantId !== member.tenantId ||
        row.campusId !== member.campusId ||
        !member.classIds.includes(row.classId) ||
        (filters.classId !== undefined && row.classId !== filters.classId)
      )
        continue;
      const date = sourceDate(row);
      if (!validDate(date) || date < range.from || date > range.to) continue;
      const kind = sourceKind(row.kind);
      const key = JSON.stringify([date, row.classId, kind, row.status]);
      const group = grouped.get(key) ?? {
        date,
        classId: row.classId,
        kind,
        status: row.status,
        sources: [],
      };
      group.sources.push({ kind, id: row.id, version: row.version, date });
      grouped.set(key, group);
      counts[kind] = counts[kind]! + 1;
    }

    const groups: OperationalStatisticsGroup[] = [...grouped.values()]
      .map((group) => ({
        ...group,
        classLabel: labels.get(group.classId) ?? "授权班级",
        count: group.sources.length,
        sources: group.sources.sort((left, right) => left.id.localeCompare(right.id)),
      }))
      .sort(
        (left, right) =>
          left.date.localeCompare(right.date) ||
          left.classLabel.localeCompare(right.classLabel, "zh-CN") ||
          left.kind.localeCompare(right.kind) ||
          left.status.localeCompare(right.status),
      );

    return {
      mode: "SCOPED",
      campusLabel: "当前授权校区",
      filters: { ...range, ...(filters.classId ? { classId: filters.classId } : {}) },
      classOptions,
      totals: totalsFor(counts),
      groups,
    };
  }

  anonymousSummary(member: LocalMember): OperationalStatisticsAnonymousSummary {
    if (!member.actions.includes("statistics:summary")) throw unavailable();
    const counts = emptyCounts();
    for (const row of sourceRows(this.repository)) {
      const kind = sourceKind(row.kind);
      counts[kind] = counts[kind]! + 1;
    }
    return { mode: "ANONYMOUS", totals: totalsFor(counts) };
  }
}
