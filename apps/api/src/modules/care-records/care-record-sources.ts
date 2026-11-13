import type { Prisma } from "../../generated/prisma/client.js";

export interface CareSourceScope {
  readonly tenantId: string;
  readonly campusId: string;
  readonly studentId: string;
  readonly classRef: string;
  readonly serviceDate: Date;
}
type Source = { readonly sourceId: string; readonly sourceVersion: number };
type CurrentSource = Source & { readonly valid: boolean };
export interface FrozenCareSources {
  readonly captured: boolean;
  readonly hasCapturedHistory: boolean;
  readonly hasHistory: boolean;
  readonly attendance: readonly Source[];
  readonly meals: readonly Source[];
  readonly pickups: readonly Source[];
}
export interface CurrentCareSources {
  readonly scopeValid: boolean;
  readonly attendance: readonly CurrentSource[];
  readonly meals: readonly CurrentSource[];
  readonly pickups: readonly CurrentSource[];
}

export function careSourcesMatch(frozen: FrozenCareSources, current: CurrentCareSources): boolean {
  if (frozen.hasCapturedHistory && !frozen.captured) return false;
  // Old manual records are not retroactively presented as derived from upstream data.
  if (!frozen.captured && !frozen.hasHistory) return true;
  if (!current.scopeValid) return false;
  if (!frozen.captured && ![...frozen.attendance, ...frozen.meals, ...frozen.pickups].length)
    return false;
  return (["attendance", "meals", "pickups"] as const).every((kind) => {
    const sources = new Map(current[kind].map((source) => [source.sourceId, source]));
    if (frozen.captured && sources.size !== frozen[kind].length) return false;
    return frozen[kind].every((source) => {
      const latest = sources.get(source.sourceId);
      return latest?.valid === true && latest.sourceVersion === source.sourceVersion;
    });
  });
}

export async function currentCareSources(db: Prisma.TransactionClient, row: CareSourceScope) {
  const { tenantId, campusId, studentId, classRef, serviceDate } = row;
  const scope = { tenantId, campusId, studentId, serviceDate };
  const [student, attendance, meals, pickups] = await Promise.all([
    db.student.findFirst({
      where: { tenantId, campusId, id: studentId, classRef, status: "ACTIVE" },
      select: { id: true },
    }),
    db.attendanceRecord.findMany({
      where: { ...scope, classRef },
      select: {
        id: true,
        version: true,
        status: true,
        corrections: { where: { status: "PENDING" }, select: { id: true } },
      },
    }),
    db.mealPlan.findMany({
      where: { tenantId, campusId, serviceDate, publishStatus: "PUBLISHED" },
      select: { id: true, version: true },
    }),
    db.pickupRecord.findMany({
      where: scope,
      select: {
        id: true,
        status: true,
        studentChecked: true,
        recipientChecked: true,
        authorizationChecked: true,
        attendanceRecordId: true,
        attendanceVersion: true,
      },
    }),
  ]);
  return {
    scopeValid: student !== null,
    attendance: attendance.map((source) => ({
      sourceId: source.id,
      sourceVersion: source.version,
      valid: source.corrections.length === 0,
    })),
    meals: meals.map((source) => ({
      sourceId: source.id,
      sourceVersion: source.version,
      valid: true,
    })),
    pickups: pickups.map((source) => {
      const attended = attendance.find((item) => item.id === source.attendanceRecordId);
      return {
        sourceId: source.id,
        sourceVersion: 1,
        valid:
          source.status === "COMPLETED" &&
          source.studentChecked &&
          source.recipientChecked &&
          source.authorizationChecked &&
          attended !== undefined &&
          attended.status === "DEPARTED" &&
          attended.corrections.length === 0 &&
          attended.version === source.attendanceVersion,
      };
    }),
  } satisfies CurrentCareSources;
}

export async function frozenCareSources(
  db: Prisma.TransactionClient,
  row: {
    readonly tenantId: string;
    readonly campusId: string;
    readonly id: string;
    readonly version: number;
  },
): Promise<FrozenCareSources> {
  const record = await db.careRecord.findUniqueOrThrow({
    where: { tenantId_campusId_id: { tenantId: row.tenantId, campusId: row.campusId, id: row.id } },
    select: {
      revisions: { select: { version: true, sourcesCaptured: true } },
      attendanceSources: {
        select: { careRecordVersion: true, sourceId: true, sourceVersion: true },
      },
      mealPlanSources: { select: { careRecordVersion: true, sourceId: true, sourceVersion: true } },
      pickupRecordSources: { select: { careRecordVersion: true, sourceId: true } },
    },
  });
  return {
    captured:
      record.revisions.find((revision) => revision.version === row.version)?.sourcesCaptured ??
      false,
    hasCapturedHistory: record.revisions.some((revision) => revision.sourcesCaptured),
    hasHistory:
      record.revisions.some((revision) => revision.sourcesCaptured) ||
      record.attendanceSources.length +
        record.mealPlanSources.length +
        record.pickupRecordSources.length >
        0,
    attendance: record.attendanceSources.filter(
      (source) => source.careRecordVersion === row.version,
    ),
    meals: record.mealPlanSources.filter((source) => source.careRecordVersion === row.version),
    pickups: record.pickupRecordSources
      .filter((source) => source.careRecordVersion === row.version)
      .map((source) => ({ sourceId: source.sourceId, sourceVersion: 1 })),
  };
}

export async function careSourcesFresh(
  db: Prisma.TransactionClient,
  row: CareSourceScope & { readonly id: string; readonly version: number },
): Promise<boolean> {
  const frozen = await frozenCareSources(db, row);
  if (!frozen.captured && !frozen.hasHistory) return true;
  return careSourcesMatch(frozen, await currentCareSources(db, row));
}

export async function saveCareSources(
  db: Prisma.TransactionClient,
  row: CareSourceScope & { readonly id: string; readonly version: number },
  sources: FrozenCareSources | CurrentCareSources,
): Promise<void> {
  const key = {
    tenantId: row.tenantId,
    campusId: row.campusId,
    careRecordId: row.id,
    careRecordVersion: row.version,
    studentId: row.studentId,
    serviceDate: row.serviceDate,
  };
  if (sources.attendance.length)
    await db.careRecordAttendanceSource.createMany({
      data: sources.attendance.map(({ sourceId, sourceVersion }) => ({
        ...key,
        sourceId,
        sourceVersion,
      })),
    });
  if (sources.meals.length)
    await db.careRecordMealPlanSource.createMany({
      data: sources.meals.map(({ sourceId, sourceVersion }) => ({
        ...key,
        sourceId,
        sourceVersion,
      })),
    });
  if (sources.pickups.length)
    await db.careRecordPickupRecordSource.createMany({
      data: sources.pickups.map(({ sourceId }) => ({ ...key, sourceId })),
    });
}
