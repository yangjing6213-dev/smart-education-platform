import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import {
  PrismaMonthlyFeedbackService,
  type MonthlyFeedbackContext,
} from "../src/modules/monthly-feedback/prisma-monthly-feedback.service.js";
import { PrismaStaffDailyService } from "../src/modules/staff-daily/prisma-staff-daily.service.js";
import type { StaffDailyContext } from "../src/nest/api-tokens.js";

const databaseUrl = process.env.DATABASE_URL;
const supplements = {
  learningParticipation: "PROGRESSING",
  dailyHabits: "KEEP_WATCHING",
  activityParticipation: "PROGRESSING",
  familySchoolCollaboration: "FOLLOW_UP",
} as const;
const careValues = {
  arrival: "ARRIVED_AS_PLANNED",
  homework: "COMPLETED",
  meal: "FINISHED",
  rest: "RESTED",
  activity: "PARTICIPATED",
  wellbeing: "ROUTINE",
} as const;
const dailyValues = {
  arrival: "ARRIVED_AS_PLANNED",
  homework: "COMPLETED",
  activity: "PARTICIPATED",
  classroom: "ROUTINE",
  followUp: "NONE",
} as const;
const dateOf = (date: string) => new Date(`${date}T00:00:00.000Z`);
function dataOf<T>(
  result:
    | { readonly ok: true; readonly data: T }
    | { readonly ok: false; readonly error: { readonly code: string } },
): T {
  if (!result.ok) assert.fail(`Unexpected business error: ${result.error.code}`);
  return result.data;
}
function conflict(result: { readonly ok: boolean; readonly error?: { readonly code: string } }) {
  assert.equal(result.ok, false, "An outdated upstream approval must not authorize this action.");
  assert.equal(result.error?.code, "CONFLICT_STATE");
}

test(
  "monthly consumption rejects stale frozen upstream sources without changing those sources",
  { skip: databaseUrl === undefined },
  async (t) => {
    const base = new URL(databaseUrl!);
    assert.ok(["postgres:", "postgresql:"].includes(base.protocol));
    assert.equal(base.hostname, "127.0.0.1");
    assert.equal(base.port, "55443");
    assert.equal(base.search, "");
    assert.equal(base.hash, "");
    const databaseName = `student_care_a1347_${randomUUID().replaceAll("-", "")}`;
    assert.match(databaseName, /^student_care_a1347_[a-f0-9]{32}$/u);
    const isolated = new URL(base);
    isolated.pathname = `/${databaseName}`;
    assert.notEqual(isolated.pathname, base.pathname);
    const client = (connectionString: string) =>
      new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
    const admin = client(base.href);
    let created = false;
    let prisma: PrismaClient | undefined;
    try {
      await admin.$connect();
      await admin.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
      created = true;
      const apiDirectory = [resolve(process.cwd(), "apps/api"), process.cwd()].find((path) =>
        existsSync(resolve(path, "prisma/schema.prisma")),
      );
      assert.ok(apiDirectory);
      try {
        execFileSync(
          process.execPath,
          [
            "node_modules/prisma/build/index.js",
            "migrate",
            "deploy",
            "--config",
            "prisma7.config.ts",
          ],
          {
            cwd: apiDirectory,
            env: { ...process.env, DATABASE_URL: isolated.href },
            stdio: "pipe",
            windowsHide: true,
          },
        );
      } catch {
        throw new Error("A347 isolated database migration failed; credentials were not logged.");
      }
      prisma = client(isolated.href);
      await prisma.$connect();
      const db = prisma;
      const tenantId = randomUUID(),
        campusId = randomUUID(),
        classRef = "synthetic-a347-a";
      const writer = { userId: randomUUID(), membershipId: randomUUID() };
      const reviewer = { userId: randomUUID(), membershipId: randomUUID() };
      await db.tenant.create({
        data: {
          id: tenantId,
          name: "合成来源机构",
          slug: `freshness-${tenantId}`,
          status: "ACTIVE",
        },
      });
      await db.campus.create({
        data: { tenantId, id: campusId, name: "合成来源校区", status: "ACTIVE" },
      });
      for (const person of [writer, reviewer]) {
        await db.user.create({ data: { id: person.userId, status: "ACTIVE" } });
        await db.membership.create({
          data: { tenantId, id: person.membershipId, userId: person.userId, status: "ACTIVE" },
        });
        await db.membershipCampus.create({
          data: { tenantId, campusId, membershipId: person.membershipId },
        });
        await db.membershipClass.create({
          data: { tenantId, campusId, membershipId: person.membershipId, classRef },
        });
      }
      const scope = { tenantId, campusId };
      const key = (id: string) => ({ ...scope, id });
      const context = (actorId: string): MonthlyFeedbackContext => ({
        scopes: [
          {
            scope: { ...scope, actorId },
            capabilities: [
              "feedback:read",
              "feedback:create",
              "feedback:submit",
              "feedback:review",
              "feedback:publish",
            ],
          },
        ],
      });
      const writerContext = context(writer.userId),
        reviewerContext = context(reviewer.userId);
      const dailyContext = (actorId: string): StaffDailyContext => ({
        scopes: [
          {
            scope: { ...scope, actorId },
            capabilities: ["daily:read", "daily:create", "daily:submit", "daily:review"],
          },
        ],
      });
      const service = new PrismaMonthlyFeedbackService(db);
      const dailyService = new PrismaStaffDailyService(db);
      const makeCare = async (date: string, assignedClass = classRef) => {
        const student = await db.student.create({
          data: {
            ...scope,
            id: randomUUID(),
            classRef: assignedClass,
            displayRef: "合成来源学生",
            status: "ACTIVE",
          },
        });
        return db.careRecord.create({
          data: {
            ...scope,
            id: randomUUID(),
            studentId: student.id,
            classRef: assignedClass,
            serviceDate: dateOf(date),
            ...careValues,
            status: "CONFIRMED",
            published: true,
            publicationVersion: 1,
            createdByMembershipId: writer.membershipId,
            reviewedByMembershipId: reviewer.membershipId,
            updatedByMembershipId: reviewer.membershipId,
          },
        });
      };
      type Care = Awaited<ReturnType<typeof makeCare>>;
      const freezeRevision = (care: Care, version = care.version) =>
        db.careRecordRevision.create({
          data: {
            ...scope,
            careRecordId: care.id,
            version,
            ...careValues,
            status: "CONFIRMED",
            published: true,
            publicationVersion: care.publicationVersion,
            reviewedByMembershipId: reviewer.membershipId,
            updatedByMembershipId: reviewer.membershipId,
            updatedAt: new Date(),
          },
        });
      const makeMeal = (date: string) =>
        db.mealPlan.create({
          data: {
            ...scope,
            id: randomUUID(),
            serviceDate: dateOf(date),
            mealPeriod: "LUNCH",
            notes: "合成餐食",
            publishStatus: "PUBLISHED",
            publishedAt: new Date(),
            updatedByMembershipId: reviewer.membershipId,
          },
        });
      const linkMeal = (care: Care, meal: { id: string; version: number }) =>
        db.careRecordMealPlanSource.create({
          data: {
            ...scope,
            careRecordId: care.id,
            careRecordVersion: care.version,
            studentId: care.studentId,
            serviceDate: care.serviceDate,
            sourceId: meal.id,
            sourceVersion: meal.version,
          },
        });
      const derivedCare = async (date: string) => {
        const care = await makeCare(date),
          meal = await makeMeal(date);
        await freezeRevision(care);
        await linkMeal(care, meal);
        return { care, meal };
      };
      const makeAttendance = (care: Care) =>
        db.attendanceRecord.create({
          data: {
            ...scope,
            id: randomUUID(),
            studentId: care.studentId,
            classRef: care.classRef,
            serviceDate: care.serviceDate,
            status: "ARRIVED",
            arrivalTime: "08:30",
            recordedByMembershipId: writer.membershipId,
            updatedByMembershipId: writer.membershipId,
          },
        });
      const makeTask = (date: string, assignedClass = classRef) =>
        db.workTask.create({
          data: {
            ...scope,
            id: randomUUID(),
            classRef: assignedClass,
            code: "DAILY_CHECK",
            targetType: "CLASS",
            targetRef: assignedClass,
            dueDate: dateOf(date),
            priority: "NORMAL",
            status: "CHECKED",
            createdByMembershipId: reviewer.membershipId,
            assigneeMembershipId: writer.membershipId,
            checkedByMembershipId: reviewer.membershipId,
            updatedByMembershipId: reviewer.membershipId,
          },
        });
      type Ref = { id: string; version: number };
      const makeDaily = async (
        date: string,
        sources: { tasks?: Ref[]; care?: Ref[]; attendance?: Ref[]; pickups?: Ref[] } = {},
      ) => {
        const daily = await db.staffDailyReport.create({
          data: {
            ...scope,
            id: randomUUID(),
            classRef,
            date: dateOf(date),
            ...dailyValues,
            status: "CONFIRMED",
            createdByMembershipId: writer.membershipId,
            reviewedByMembershipId: reviewer.membershipId,
            updatedByMembershipId: reviewer.membershipId,
          },
        });
        const refs = (items: Ref[]) =>
          items.map((item) => ({
            ...scope,
            reportId: daily.id,
            sourceId: item.id,
            sourceVersion: item.version,
          }));
        if (sources.tasks?.length)
          await db.staffDailyReportWorkTaskSource.createMany({ data: refs(sources.tasks) });
        if (sources.care?.length)
          await db.staffDailyReportCareRecordSource.createMany({ data: refs(sources.care) });
        if (sources.attendance?.length)
          await db.staffDailyReportAttendanceSource.createMany({ data: refs(sources.attendance) });
        if (sources.pickups?.length)
          await db.staffDailyReportPickupRecordSource.createMany({ data: refs(sources.pickups) });
        return daily;
      };
      const stored = (id: string) => db.monthlyFeedbackReport.findFirstOrThrow({ where: key(id) });
      const events = (id: string) =>
        db.monthlyFeedbackEvent.findMany({
          where: { ...scope, reportId: id },
          orderBy: { version: "asc" },
        });
      const listed = async (id: string) => {
        const row = dataOf(await service.list(reviewerContext)).records.find(
          (entry) => entry.id === id,
        );
        assert.ok(row);
        return row;
      };
      const create = async (month: string) =>
        dataOf(await service.create(writerContext, { month, supplements }));
      type Report = Awaited<ReturnType<typeof create>>;
      const submit = async (row: Report) =>
        dataOf(await service.submit(writerContext, row.id, { version: row.version }));
      const confirm = async (row: Report) => {
        const submitted = await submit(row);
        return dataOf(
          await service.review(reviewerContext, row.id, {
            version: submitted.version,
            action: "CONFIRM",
          }),
        );
      };
      const publish = async (row: Report) =>
        dataOf(await service.publish(reviewerContext, row.id, { version: row.version }));
      async function invalidated(previous: Report, expectedCounts: Report["sourceCounts"]) {
        const row = await stored(previous.id);
        assert.equal(row.status, "REVIEW_REQUIRED");
        assert.equal(row.reviewedByMembershipId, null);
        assert.equal(row.version, previous.version + 1);
        assert.equal(row.sourceVersion, previous.sourceVersion + 1);
        const history = await events(row.id);
        assert.equal(history.at(-1)?.action, "SOURCES_CHANGED");
        assert.equal(history.at(-1)?.version, row.version);
        const view = await listed(row.id);
        assert.deepEqual(view.sourceCounts, expectedCounts);
        assert.equal(view.version, row.version);
        assert.deepEqual(
          await events(row.id),
          history,
          "A repeated read must not create another invalidation event.",
        );
        return view;
      }

      await t.test(
        "manual care is compatible, but a missing current link cannot erase an older derived revision",
        async () => {
          await makeCare("2027-01-01"); // Intentionally MANUAL: no links in any revision.
          const { care } = await derivedCare("2027-01-02");
          await db.careRecord.updateMany({ where: key(care.id), data: { version: 2 } });
          await freezeRevision(care, 2); // Version 1 still proves this is DERIVED, not manual.
          await makeCare("2027-01-03", "synthetic-unrelated-class");
          const monthly = await create("2027-01");
          assert.deepEqual(monthly.sourceCounts, {
            GROWTH_RECORD: 1,
            ATTENDANCE_OVERVIEW: 0,
            STAFF_DAILY: 0,
          });
        },
      );

      await t.test(
        "draft submission commits upstream invalidation and its audit before returning conflict",
        async () => {
          const { meal } = await derivedCare("2028-05-01");
          const row = await create("2028-05");
          await db.mealPlan.updateMany({ where: key(meal.id), data: { version: 2 } });
          conflict(await service.submit(writerContext, row.id, { version: row.version }));
          const refreshed = await stored(row.id);
          assert.equal(refreshed.status, "DRAFT");
          assert.equal(refreshed.version, row.version + 1);
          assert.equal(refreshed.sourceVersion, row.sourceVersion + 1);
          assert.equal(refreshed.reviewedByMembershipId, null);
          const history = await events(row.id);
          assert.equal(history.at(-1)?.action, "SOURCES_CHANGED");
          assert.equal(history.at(-1)?.version, refreshed.version);
          const view = await listed(row.id);
          assert.equal(view.sourceCounts.GROWTH_RECORD, 0);
          assert.equal(view.version, refreshed.version);
          assert.deepEqual(await events(row.id), history);
        },
      );

      for (const [month, boundary, mutation] of [
        ["2027-02", "confirm", "version"],
        ["2027-03", "publish", "withdraw"],
        ["2027-04", "read", "version"],
      ] as const) {
        await t.test(
          `frozen care meal ${mutation} invalidates monthly ${boundary} without revoking the care row itself`,
          async () => {
            const { care, meal } = await derivedCare(`${month}-01`);
            let row = await create(month);
            assert.equal(row.sourceCounts.GROWTH_RECORD, 1);
            row = boundary === "confirm" ? await submit(row) : await confirm(row);
            if (boundary === "read") row = await publish(row);
            await db.mealPlan.updateMany({
              where: key(meal.id),
              data:
                mutation === "version"
                  ? { version: { increment: 1 } }
                  : { publishStatus: "UNPUBLISHED", version: { increment: 1 }, publishedAt: null },
            });
            if (boundary === "confirm")
              conflict(
                await service.review(reviewerContext, row.id, {
                  version: row.version,
                  action: "CONFIRM",
                }),
              );
            else if (boundary === "publish")
              conflict(await service.publish(reviewerContext, row.id, { version: row.version }));
            else await listed(row.id);
            await invalidated(row, { GROWTH_RECORD: 0, ATTENDANCE_OVERVIEW: 0, STAFF_DAILY: 0 });
            assert.deepEqual(
              await db.careRecord.findFirstOrThrow({ where: key(care.id) }),
              care,
              "Monthly consumption must not mutate upstream business state.",
            );
          },
        );
      }

      for (const [month, change] of [
        ["2027-05", "version"],
        ["2027-06", "added"],
        ["2027-07", "removed"],
      ] as const) {
        await t.test(`confirmed daily frozen task set rejects ${change} sources`, async () => {
          const date = `${month}-01`,
            task = await makeTask(date);
          const daily = await makeDaily(date, { tasks: [task] });
          const row = await publish(await confirm(await create(month)));
          assert.equal(row.sourceCounts.STAFF_DAILY, 1);
          if (change === "added") await makeTask(date);
          else
            await db.workTask.updateMany({
              where: key(task.id),
              data:
                change === "version"
                  ? { version: { increment: 1 } }
                  : { status: "ASSIGNED", checkedByMembershipId: null, version: { increment: 1 } },
            });
          await listed(row.id);
          await invalidated(row, { GROWTH_RECORD: 0, ATTENDANCE_OVERVIEW: 0, STAFF_DAILY: 0 });
          assert.deepEqual(
            await db.staffDailyReport.findFirstOrThrow({ where: key(daily.id) }),
            daily,
          );
        });
      }

      await t.test(
        "recursive care invalidates its daily and recovery requires upstream and monthly re-review",
        async () => {
          const { care, meal } = await derivedCare("2027-08-01");
          const daily = await makeDaily("2027-08-01", { care: [care] });
          const row = await confirm(await create("2027-08"));
          assert.deepEqual(row.sourceCounts, {
            GROWTH_RECORD: 1,
            ATTENDANCE_OVERVIEW: 0,
            STAFF_DAILY: 1,
          });
          await db.mealPlan.updateMany({ where: key(meal.id), data: { version: 2 } });
          conflict(await service.publish(reviewerContext, row.id, { version: row.version }));
          let view = await invalidated(row, {
            GROWTH_RECORD: 0,
            ATTENDANCE_OVERVIEW: 0,
            STAFF_DAILY: 0,
          });
          conflict(await service.publish(reviewerContext, view.id, { version: view.version }));
          // Seed a newly reviewed derived revision. Source capture UI is intentionally outside A347.
          const reviewedCare = await db.careRecord.update({
            where: { tenantId_campusId_id: key(care.id) },
            data: { version: 2, publicationVersion: 2 },
          });
          await freezeRevision(reviewedCare);
          await linkMeal(reviewedCare, { id: meal.id, version: 2 });
          view = await listed(row.id);
          assert.equal(view.status, "REVIEW_REQUIRED");
          assert.equal(view.sourceCounts.GROWTH_RECORD, 1);
          assert.equal(
            view.sourceCounts.STAFF_DAILY,
            0,
            "Refreshing a care source cannot silently approve the old daily snapshot.",
          );
          dataOf(
            await dailyService.review(dailyContext(reviewer.userId), daily.id, {
              version: 1,
              action: "RETURN",
            }),
          );
          dataOf(
            await dailyService.edit(dailyContext(writer.userId), daily.id, {
              version: 2,
              values: dailyValues,
            }),
          );
          dataOf(await dailyService.submit(dailyContext(writer.userId), daily.id, { version: 3 }));
          assert.equal(
            (await listed(row.id)).sourceCounts.STAFF_DAILY,
            0,
            "Submitting the corrected daily is not approval.",
          );
          dataOf(
            await dailyService.review(dailyContext(reviewer.userId), daily.id, {
              version: 4,
              action: "CONFIRM",
            }),
          );
          view = await listed(row.id);
          assert.equal(view.sourceCounts.STAFF_DAILY, 1);
          assert.equal(view.status, "REVIEW_REQUIRED");
          conflict(await service.publish(reviewerContext, view.id, { version: view.version }));
          const edited = dataOf(
            await service.edit(writerContext, view.id, { version: view.version, supplements }),
          );
          assert.equal((await publish(await confirm(edited))).status, "PUBLISHED");
        },
      );

      for (const [month, change] of [
        ["2027-09", "version"],
        ["2027-10", "pending-correction"],
      ] as const) {
        await t.test(
          `frozen care attendance ${change} removes care as well as refreshing direct attendance`,
          async () => {
            const care = await makeCare(`${month}-01`),
              attendance = await makeAttendance(care);
            await freezeRevision(care);
            await db.careRecordAttendanceSource.create({
              data: {
                ...scope,
                careRecordId: care.id,
                careRecordVersion: 1,
                studentId: care.studentId,
                serviceDate: care.serviceDate,
                sourceId: attendance.id,
                sourceVersion: 1,
              },
            });
            const row = await confirm(await create(month));
            if (change === "version")
              await db.attendanceRecord.updateMany({
                where: key(attendance.id),
                data: { version: 2 },
              });
            else
              await db.attendanceCorrection.create({
                data: {
                  ...scope,
                  id: randomUUID(),
                  attendanceRecordId: attendance.id,
                  studentId: care.studentId,
                  serviceDate: care.serviceDate,
                  requestedByMembershipId: writer.membershipId,
                  reason: "TIME_ENTRY_ERROR",
                  status: "PENDING",
                  originalStatus: "ARRIVED",
                  originalArrivalTime: "08:30",
                  proposedStatus: "ARRIVED",
                  proposedArrivalTime: "08:35",
                  requestVersion: 1,
                },
              });
            conflict(await service.publish(reviewerContext, row.id, { version: row.version }));
            await invalidated(row, {
              GROWTH_RECORD: 0,
              ATTENDANCE_OVERVIEW: change === "version" ? 1 : 0,
              STAFF_DAILY: 0,
            });
          },
        );
      }

      await t.test(
        "empty daily snapshots require an actually empty qualified day; unrelated sources and stable reads do not invalidate",
        async () => {
          const daily = await makeDaily("2027-11-01");
          const row = await publish(await confirm(await create("2027-11")));
          assert.equal(row.sourceCounts.STAFF_DAILY, 1);
          const before = await events(row.id);
          const unrelated = await makeTask("2027-11-01", "synthetic-unrelated-class");
          await makeTask("2027-12-01");
          await db.workTask.updateMany({ where: key(unrelated.id), data: { version: 2 } });
          assert.equal((await listed(row.id)).version, row.version);
          assert.deepEqual(await events(row.id), before);
          await makeTask("2027-11-01");
          await listed(row.id);
          await invalidated(row, { GROWTH_RECORD: 0, ATTENDANCE_OVERVIEW: 0, STAFF_DAILY: 0 });
          assert.equal(
            (await db.staffDailyReport.findFirstOrThrow({ where: key(daily.id) })).version,
            1,
          );
        },
      );

      await t.test(
        "completed pickup preserves historical authorization, but not a stale referenced attendance version",
        async () => {
          const care = await makeCare("2028-01-01");
          const initialAttendance = await makeAttendance(care);
          const attendance = await db.attendanceRecord.update({
            where: { tenantId_campusId_id: key(initialAttendance.id) },
            data: { status: "DEPARTED", departureTime: "17:00", version: 2 },
          });
          const guardianUserId = randomUUID();
          await db.user.create({ data: { id: guardianUserId, status: "ACTIVE" } });
          const application = await db.bindingApplication.create({
            data: {
              ...scope,
              id: randomUUID(),
              applicantUserId: guardianUserId,
              onboardingScopeRef: randomUUID(),
              studentCandidateRef: care.studentId,
              status: "APPROVED",
              reviewedByMembershipId: reviewer.membershipId,
              reviewedAt: new Date(),
            },
          });
          const relationship = await db.guardianRelationship.create({
            data: {
              ...scope,
              id: randomUUID(),
              bindingApplicationId: application.id,
              guardianUserId,
              studentId: care.studentId,
              status: "ACTIVE",
              approvedByMembershipId: reviewer.membershipId,
              approvedAt: new Date(),
            },
          });
          const authorization = await db.pickupAuthorization.create({
            data: {
              ...scope,
              id: randomUUID(),
              studentId: care.studentId,
              guardianRelationshipId: relationship.id,
              guardianUserId,
              authorizedPartyRef: "PICKUP_ALPHA",
              type: "TEMPORARY",
              startDate: care.serviceDate,
              endDate: care.serviceDate,
              startTime: "16:00",
              endTime: "18:00",
              status: "ACTIVE",
              createdByMembershipId: writer.membershipId,
              updatedByMembershipId: writer.membershipId,
            },
          });
          const pickup = await db.pickupRecord.create({
            data: {
              ...scope,
              id: randomUUID(),
              authorizationId: authorization.id,
              authorizationVersion: 1,
              guardianRelationshipId: relationship.id,
              guardianUserId,
              studentId: care.studentId,
              attendanceRecordId: attendance.id,
              attendanceVersion: 2,
              authorizedPartyRef: "PICKUP_ALPHA",
              serviceDate: care.serviceDate,
              status: "COMPLETED",
              studentChecked: true,
              recipientChecked: true,
              authorizationChecked: true,
              checkedByMembershipId: writer.membershipId,
              occurredAt: new Date("2028-01-01T17:00:00.000Z"),
            },
          });
          await freezeRevision(care);
          await db.careRecordPickupRecordSource.create({
            data: {
              ...scope,
              careRecordId: care.id,
              careRecordVersion: 1,
              studentId: care.studentId,
              serviceDate: care.serviceDate,
              sourceId: pickup.id,
            },
          });
          await makeDaily("2028-01-01", {
            care: [care],
            attendance: [attendance],
            pickups: [{ id: pickup.id, version: 1 }],
          });
          const row = await confirm(await create("2028-01"));
          assert.deepEqual(row.sourceCounts, {
            GROWTH_RECORD: 1,
            ATTENDANCE_OVERVIEW: 1,
            STAFF_DAILY: 1,
          });
          const before = await events(row.id);
          await db.pickupAuthorization.updateMany({
            where: key(authorization.id),
            data: { status: "REVOKED", version: 2 },
          });
          assert.equal((await listed(row.id)).version, row.version);
          assert.deepEqual(
            await events(row.id),
            before,
            "Later authorization revocation does not undo the completed pickup fact.",
          );
          await db.attendanceRecord.updateMany({ where: key(attendance.id), data: { version: 3 } });
          conflict(await service.publish(reviewerContext, row.id, { version: row.version }));
          await invalidated(row, { GROWTH_RECORD: 0, ATTENDANCE_OVERVIEW: 1, STAFF_DAILY: 0 });
        },
      );

      await t.test(
        "daily producer scope includes absence and open pickup exceptions, and exception revisions invalidate it",
        async () => {
          const care = await makeCare("2028-02-01");
          const initialAttendance = await makeAttendance(care);
          const attendance = await db.attendanceRecord.update({
            where: { tenantId_campusId_id: key(initialAttendance.id) },
            data: { status: "NOT_ARRIVED", arrivalTime: null },
          });
          const exception = await db.pickupException.create({
            data: {
              ...scope,
              id: randomUUID(),
              studentId: care.studentId,
              classRef,
              date: care.serviceDate,
              category: "NO_AUTHORIZATION",
              status: "OPEN",
              createdByMembershipId: writer.membershipId,
            },
          });
          const daily = await makeDaily("2028-02-01", { care: [care], attendance: [attendance] });
          await db.staffDailyReportPickupExceptionSource.create({
            data: { ...scope, reportId: daily.id, sourceId: exception.id, sourceVersion: 1 },
          });
          const row = await confirm(await create("2028-02"));
          assert.deepEqual(row.sourceCounts, {
            GROWTH_RECORD: 1,
            ATTENDANCE_OVERVIEW: 0,
            STAFF_DAILY: 1,
          });
          await db.pickupException.updateMany({
            where: key(exception.id),
            data: {
              version: 2,
              status: "FOLLOWING",
              reviewedByMembershipId: reviewer.membershipId,
              reviewedAt: new Date(),
              outcome: "CONTACT_GUARDIAN",
            },
          });
          conflict(await service.publish(reviewerContext, row.id, { version: row.version }));
          await invalidated(row, { GROWTH_RECORD: 1, ATTENDANCE_OVERVIEW: 0, STAFF_DAILY: 0 });
        },
      );

      for (const [month, change] of [
        ["2028-03", "pending"],
        ["2028-04", "inactive-student"],
      ] as const) {
        await t.test(
          `daily attendance ${change} is not hidden by an unchanged frozen version`,
          async () => {
            const care = await makeCare(`${month}-01`),
              attendance = await makeAttendance(care);
            await makeDaily(`${month}-01`, { care: [care], attendance: [attendance] });
            const row = await confirm(await create(month));
            if (change === "pending")
              await db.attendanceCorrection.create({
                data: {
                  ...scope,
                  id: randomUUID(),
                  attendanceRecordId: attendance.id,
                  studentId: care.studentId,
                  serviceDate: care.serviceDate,
                  requestedByMembershipId: writer.membershipId,
                  reason: "TIME_ENTRY_ERROR",
                  status: "PENDING",
                  originalStatus: "ARRIVED",
                  originalArrivalTime: "08:30",
                  proposedStatus: "ARRIVED",
                  proposedArrivalTime: "08:35",
                  requestVersion: 1,
                },
              });
            else
              await db.student.updateMany({
                where: key(care.studentId),
                data: { status: "INACTIVE" },
              });
            conflict(await service.publish(reviewerContext, row.id, { version: row.version }));
            await invalidated(row, {
              GROWTH_RECORD: change === "pending" ? 1 : 0,
              ATTENDANCE_OVERVIEW: 0,
              STAFF_DAILY: 0,
            });
          },
        );
      }
    } finally {
      try {
        await prisma?.$disconnect();
      } finally {
        try {
          if (created)
            await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
        } finally {
          await admin.$disconnect();
        }
      }
    }
  },
);
