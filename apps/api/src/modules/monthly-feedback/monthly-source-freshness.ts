import type { Prisma } from "../../generated/prisma/client.js";
import { careSourcesMatch } from "../care-records/care-record-sources.js";

export interface MonthlySourceScope {
  readonly tenantId: string;
  readonly campusId: string;
  readonly classRef: string;
  readonly month: string;
  readonly studentId?: string;
}

type FrozenSource = { readonly sourceId: string; readonly sourceVersion: number };
type CurrentSource = { readonly id: string; readonly version: number; readonly valid: boolean };
const dateKey = (date: Date) => date.toISOString().slice(0, 10);

function byDate<T extends CurrentSource>(rows: readonly (T & { readonly date: Date })[]) {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const key = dateKey(row.date);
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  return groups;
}

export function matchesFrozenSources(
  frozen: readonly FrozenSource[],
  current: readonly CurrentSource[],
): boolean {
  if (frozen.length !== current.length || current.some((source) => !source.valid)) return false;
  const versions = new Map(current.map((source) => [source.id, source.version]));
  return frozen.every((source) => versions.get(source.sourceId) === source.sourceVersion);
}

/** Check frozen upstream evidence; never replace it with today's data or approve its owner. */
export async function loadFreshMonthlySources(
  db: Prisma.TransactionClient,
  record: MonthlySourceScope,
) {
  const { tenantId, campusId, classRef, month } = record;
  const start = new Date(`${month}-01T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  const range = { gte: start, lt: end };
  const scope = { tenantId, campusId, classRef };
  const child = record.studentId ? { studentId: record.studentId } : {};
  const student = { select: { status: true, classRef: true } } as const;
  const sourceRef = { select: { sourceId: true, sourceVersion: true } } as const;

  // One batch per monthly scope, including relation batches. No query runs inside a row loop.
  const [care, attendance, daily, tasks, meals, pickups, exceptions] = await Promise.all([
    db.careRecord.findMany({
      where: { ...scope, ...child, serviceDate: range, published: true },
      select: {
        id: true,
        studentId: true,
        version: true,
        serviceDate: true,
        status: true,
        publicationVersion: true,
        student,
        revisions: {
          select: {
            version: true,
            status: true,
            published: true,
            publicationVersion: true,
            sourcesCaptured: true,
          },
        },
        attendanceSources: {
          select: { careRecordVersion: true, sourceId: true, sourceVersion: true },
        },
        mealPlanSources: {
          select: { careRecordVersion: true, sourceId: true, sourceVersion: true },
        },
        pickupRecordSources: { select: { careRecordVersion: true, sourceId: true } },
      },
    }),
    db.attendanceRecord.findMany({
      where: { ...scope, ...child, serviceDate: range },
      select: {
        id: true,
        studentId: true,
        version: true,
        serviceDate: true,
        status: true,
        student,
        corrections: { where: { status: "PENDING" }, select: { id: true } },
      },
    }),
    record.studentId
      ? Promise.resolve([])
      : db.staffDailyReport.findMany({
          where: { ...scope, date: range, status: "CONFIRMED" },
          select: {
            id: true,
            version: true,
            date: true,
            workTaskSources: sourceRef,
            attendanceSources: sourceRef,
            careRecordSources: sourceRef,
            pickupRecordSources: sourceRef,
            pickupExceptionSources: sourceRef,
          },
        }),
    record.studentId
      ? Promise.resolve([])
      : db.workTask.findMany({
          where: { ...scope, dueDate: range, status: "CHECKED" },
          select: { id: true, version: true, dueDate: true },
        }),
    db.mealPlan.findMany({
      where: { tenantId, campusId, serviceDate: range },
      select: { id: true, version: true, serviceDate: true, publishStatus: true },
    }),
    db.pickupRecord.findMany({
      where: { tenantId, campusId, ...child, serviceDate: range, student: { is: { classRef } } },
      select: {
        id: true,
        studentId: true,
        serviceDate: true,
        status: true,
        studentChecked: true,
        recipientChecked: true,
        authorizationChecked: true,
        attendanceRecordId: true,
        attendanceVersion: true,
        student,
      },
    }),
    record.studentId
      ? Promise.resolve([])
      : db.pickupException.findMany({
          where: { ...scope, date: range },
          select: { id: true, version: true, date: true, student },
        }),
  ]);

  const activeStudent = (row: { student: { status: string; classRef: string } }) =>
    row.student.status === "ACTIVE" && row.student.classRef === classRef;
  const attendanceById = new Map(attendance.map((row) => [row.id, row]));
  const attendanceValid = new Map(
    attendance.map((row) => [row.id, activeStudent(row) && row.corrections.length === 0]),
  );
  const pickupValid = new Map(
    pickups.map((row) => {
      const source = attendanceById.get(row.attendanceRecordId);
      return [
        row.id,
        activeStudent(row) &&
          row.status === "COMPLETED" &&
          row.studentChecked &&
          row.recipientChecked &&
          row.authorizationChecked &&
          source !== undefined &&
          attendanceValid.get(source.id) === true &&
          source.studentId === row.studentId &&
          dateKey(source.serviceDate) === dateKey(row.serviceDate) &&
          source.status === "DEPARTED" &&
          source.version === row.attendanceVersion,
      ];
    }),
  );

  const careValid = new Map(
    care.map((row) => {
      if (!activeStudent(row) || row.status !== "CONFIRMED" || row.publicationVersion < 1)
        return [row.id, false] as const;
      const attendanceLinks = row.attendanceSources.filter(
        (source) => source.careRecordVersion === row.version,
      );
      const mealLinks = row.mealPlanSources.filter(
        (source) => source.careRecordVersion === row.version,
      );
      const pickupLinks = row.pickupRecordSources.filter(
        (source) => source.careRecordVersion === row.version,
      );
      const hasHistory =
        row.revisions.some((revision) => revision.sourcesCaptured) ||
        row.attendanceSources.length + row.mealPlanSources.length + row.pickupRecordSources.length >
          0;
      // Legacy manual records have no captured upstream evidence. Do not call them derived.
      if (!hasHistory) return [row.id, true] as const;
      const revision = row.revisions.find((revision) => revision.version === row.version);
      if (
        (!revision?.sourcesCaptured &&
          attendanceLinks.length + mealLinks.length + pickupLinks.length === 0) ||
        revision?.status !== "CONFIRMED" ||
        !revision.published ||
        revision.publicationVersion !== row.publicationVersion
      )
        return [row.id, false] as const;
      const onDate = (source: { serviceDate: Date }) =>
        dateKey(source.serviceDate) === dateKey(row.serviceDate);
      const forChild = (source: { serviceDate: Date; studentId: string }) =>
        source.studentId === row.studentId && onDate(source);
      const valid = careSourcesMatch(
        {
          captured: revision.sourcesCaptured,
          hasCapturedHistory: row.revisions.some((item) => item.sourcesCaptured),
          hasHistory,
          attendance: attendanceLinks,
          meals: mealLinks,
          pickups: pickupLinks.map((source) => ({ ...source, sourceVersion: 1 })),
        },
        {
          scopeValid: true,
          attendance: attendance.filter(forChild).map((source) => ({
            sourceId: source.id,
            sourceVersion: source.version,
            valid: attendanceValid.get(source.id) === true,
          })),
          meals: meals
            .filter((source) => onDate(source) && source.publishStatus === "PUBLISHED")
            .map((source) => ({ sourceId: source.id, sourceVersion: source.version, valid: true })),
          pickups: pickups.filter(forChild).map((source) => ({
            sourceId: source.id,
            sourceVersion: 1,
            valid: pickupValid.get(source.id) === true,
          })),
        },
      );
      return [row.id, valid] as const;
    }),
  );

  const tasksByDate = byDate(tasks.map((row) => ({ ...row, date: row.dueDate, valid: true })));
  // Mirror the producer's sets: absence and open exceptions also belong to a daily report.
  const attendanceByDate = byDate(
    attendance.map((row) => ({
      ...row,
      date: row.serviceDate,
      valid: attendanceValid.get(row.id)!,
    })),
  );
  const careByDate = byDate(
    care.map((row) => ({ ...row, date: row.serviceDate, valid: careValid.get(row.id)! })),
  );
  const pickupsByDate = byDate(
    pickups.map((row) => ({
      id: row.id,
      version: 1, // Completed pickup records have no revision counter; the producer freezes 1.
      date: row.serviceDate,
      valid: pickupValid.get(row.id)!,
    })),
  );
  const exceptionsByDate = byDate(exceptions.map((row) => ({ ...row, valid: activeStudent(row) })));

  return {
    care: care.filter((row) => careValid.get(row.id)),
    attendance: attendance.filter(
      (row) =>
        attendanceValid.get(row.id) && (row.status === "ARRIVED" || row.status === "DEPARTED"),
    ),
    daily: daily.filter((row) => {
      const date = dateKey(row.date);
      return (
        matchesFrozenSources(row.workTaskSources, tasksByDate.get(date) ?? []) &&
        matchesFrozenSources(row.attendanceSources, attendanceByDate.get(date) ?? []) &&
        matchesFrozenSources(row.careRecordSources, careByDate.get(date) ?? []) &&
        matchesFrozenSources(row.pickupRecordSources, pickupsByDate.get(date) ?? []) &&
        matchesFrozenSources(row.pickupExceptionSources, exceptionsByDate.get(date) ?? [])
      );
    }),
  };
}
