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

const adminDatabaseUrl = process.env.DATABASE_URL;
const supplements = {
  learningParticipation: "PROGRESSING",
  dailyHabits: "KEEP_WATCHING",
  activityParticipation: "PROGRESSING",
  familySchoolCollaboration: "FOLLOW_UP",
} as const;
const capabilities = [
  "feedback:read",
  "feedback:create",
  "feedback:submit",
  "feedback:review",
  "feedback:publish",
] as const;

function apiDirectory(): string {
  const directory = [resolve(process.cwd(), "apps/api"), process.cwd()].find((candidate) =>
    existsSync(resolve(candidate, "prisma/schema.prisma")),
  );
  if (!directory) throw new Error("The API Prisma folder is required for this isolated test.");
  return directory;
}

function client(connectionString: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

function dataOf<T>(
  result:
    | { readonly ok: true; readonly data: T }
    | {
        readonly ok: false;
        readonly error: { readonly code: string };
      },
): T {
  if (!result.ok) assert.fail(JSON.stringify(result));
  return result.data;
}

function errorOf(result: {
  readonly ok: boolean;
  readonly error?: { readonly code: string };
}): string {
  assert.equal(result.ok, false, "The operation must fail without changing the report.");
  assert.ok(result.error);
  return result.error.code;
}

test(
  "monthly feedback persists scoped review transitions, fresh sources and atomic versioned events",
  { skip: adminDatabaseUrl === undefined },
  async (t) => {
    const baseUrl = new URL(adminDatabaseUrl!);
    assert.equal(baseUrl.hostname, "127.0.0.1");
    assert.equal(baseUrl.port, "55443");
    const databaseName = `student_care_a1343_${randomUUID().replaceAll("-", "")}`;
    const isolatedUrl = new URL(baseUrl);
    isolatedUrl.pathname = `/${databaseName}`;
    const admin = client(baseUrl.href);
    let databaseCreated = false;
    let prisma: PrismaClient | undefined;
    let restartedPrisma: PrismaClient | undefined;
    try {
      await admin.$connect();
      await admin.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
      databaseCreated = true;
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
          cwd: apiDirectory(),
          env: { ...process.env, DATABASE_URL: isolatedUrl.href },
          stdio: "pipe",
        },
      );
      prisma = client(isolatedUrl.href);
      await prisma.$connect();
      const db = prisma;
      const tenantId = randomUUID();
      const otherTenantId = randomUUID();
      const campusId = randomUUID();
      const otherCampusId = randomUUID();
      const otherTenantCampusId = randomUUID();
      const classRef = "synthetic-class-a";
      const secondClassRef = "synthetic-class-b";
      const people = {
        writer: {
          userId: randomUUID(),
          membershipId: randomUUID(),
          tenantId,
          campusId,
          classes: [classRef],
        },
        colleague: {
          userId: randomUUID(),
          membershipId: randomUUID(),
          tenantId,
          campusId,
          classes: [classRef],
        },
        reviewer: {
          userId: randomUUID(),
          membershipId: randomUUID(),
          tenantId,
          campusId,
          classes: [classRef, secondClassRef],
        },
        otherClass: {
          userId: randomUUID(),
          membershipId: randomUUID(),
          tenantId,
          campusId,
          classes: [secondClassRef],
        },
        otherCampus: {
          userId: randomUUID(),
          membershipId: randomUUID(),
          tenantId,
          campusId: otherCampusId,
          classes: [classRef],
        },
        otherTenant: {
          userId: randomUUID(),
          membershipId: randomUUID(),
          tenantId: otherTenantId,
          campusId: otherTenantCampusId,
          classes: [classRef],
        },
        otherCampusReviewer: {
          userId: randomUUID(),
          membershipId: randomUUID(),
          tenantId,
          campusId: otherCampusId,
          classes: [classRef],
        },
        otherTenantReviewer: {
          userId: randomUUID(),
          membershipId: randomUUID(),
          tenantId: otherTenantId,
          campusId: otherTenantCampusId,
          classes: [classRef],
        },
      };
      type Person = (typeof people)[keyof typeof people];
      const context = (
        person: Person,
        allowed: MonthlyFeedbackContext["scopes"][number]["capabilities"] = capabilities,
      ): MonthlyFeedbackContext => ({
        scopes: [
          {
            scope: { actorId: person.userId, tenantId: person.tenantId, campusId: person.campusId },
            capabilities: allowed,
          },
        ],
      });
      const writer = context(people.writer);
      const reviewer = context(people.reviewer);
      await db.tenant.createMany({
        data: [tenantId, otherTenantId].map((id) => ({
          id,
          name: "合成机构",
          slug: `monthly-${id}`,
          status: "ACTIVE",
        })),
      });
      await db.campus.createMany({
        data: [
          { tenantId, id: campusId, name: "合成东校区", status: "ACTIVE" },
          { tenantId, id: otherCampusId, name: "合成西校区", status: "ACTIVE" },
          {
            tenantId: otherTenantId,
            id: otherTenantCampusId,
            name: "合成外部校区",
            status: "ACTIVE",
          },
        ],
      });
      await db.user.createMany({
        data: Object.values(people).map((person) => ({ id: person.userId, status: "ACTIVE" })),
      });
      await db.membership.createMany({
        data: Object.values(people).map((person) => ({
          id: person.membershipId,
          tenantId: person.tenantId,
          userId: person.userId,
          status: "ACTIVE",
        })),
      });
      await db.membershipCampus.createMany({
        data: Object.values(people).map((person) => ({
          tenantId: person.tenantId,
          campusId: person.campusId,
          membershipId: person.membershipId,
        })),
      });
      await db.membershipClass.createMany({
        data: Object.values(people).flatMap((person) =>
          person.classes.map((assignedClass) => ({
            tenantId: person.tenantId,
            campusId: person.campusId,
            membershipId: person.membershipId,
            classRef: assignedClass,
          })),
        ),
      });

      const service = new PrismaMonthlyFeedbackService(db);
      const sourceReviewer = (person: Person) =>
        person.campusId === campusId
          ? people.reviewer.membershipId
          : person.campusId === otherCampusId
            ? people.otherCampusReviewer.membershipId
            : people.otherTenantReviewer.membershipId;
      const dateOf = (date: string) => new Date(`${date}T00:00:00.000Z`);
      const studentFor = async (person: Person) =>
        db.student.create({
          data: {
            tenantId: person.tenantId,
            campusId: person.campusId,
            id: randomUUID(),
            classRef: person.classes[0]!,
            status: "ACTIVE",
            displayRef: "合成学生",
          },
        });
      const care = async (
        date: string,
        person: Person = people.writer,
        options: { status?: "DRAFT" | "CONFIRMED"; published?: boolean } = {},
      ) => {
        const student = await studentFor(person);
        return db.careRecord.create({
          data: {
            tenantId: person.tenantId,
            campusId: person.campusId,
            id: randomUUID(),
            studentId: student.id,
            classRef: person.classes[0]!,
            serviceDate: dateOf(date),
            arrival: "ARRIVED_AS_PLANNED",
            homework: "COMPLETED",
            meal: "FINISHED",
            rest: "RESTED",
            activity: "PARTICIPATED",
            wellbeing: "ROUTINE",
            status: options.status ?? "CONFIRMED",
            published: options.published ?? options.status !== "DRAFT",
            publicationVersion: (options.published ?? options.status !== "DRAFT") ? 1 : 0,
            createdByMembershipId: person.membershipId,
            reviewedByMembershipId: options.status === "DRAFT" ? null : sourceReviewer(person),
            updatedByMembershipId: person.membershipId,
          },
        });
      };
      const attendance = async (
        date: string,
        person: Person = people.writer,
        status: "ARRIVED" | "DEPARTED" | "NOT_ARRIVED" = "ARRIVED",
      ) => {
        const student = await studentFor(person);
        return db.attendanceRecord.create({
          data: {
            tenantId: person.tenantId,
            campusId: person.campusId,
            id: randomUUID(),
            studentId: student.id,
            classRef: person.classes[0]!,
            serviceDate: dateOf(date),
            status,
            arrivalTime: status === "NOT_ARRIVED" ? null : "08:30",
            departureTime: status === "DEPARTED" ? "17:00" : null,
            recordedByMembershipId: person.membershipId,
            updatedByMembershipId: person.membershipId,
          },
        });
      };
      const daily = async (
        date: string,
        person: Person = people.writer,
        status: "DRAFT" | "CONFIRMED" = "CONFIRMED",
      ) => {
        const record = await db.staffDailyReport.create({
          data: {
            tenantId: person.tenantId,
            campusId: person.campusId,
            id: randomUUID(),
            classRef: person.classes[0]!,
            date: dateOf(date),
            arrival: "ARRIVED_AS_PLANNED",
            homework: "COMPLETED",
            activity: "PARTICIPATED",
            classroom: "ROUTINE",
            followUp: "NONE",
            status,
            createdByMembershipId: person.membershipId,
            reviewedByMembershipId: status === "CONFIRMED" ? sourceReviewer(person) : null,
            updatedByMembershipId: person.membershipId,
          },
        });
        const sourceWhere = {
          tenantId: person.tenantId,
          campusId: person.campusId,
          classRef: person.classes[0]!,
          serviceDate: dateOf(date),
        };
        const [careSources, attendanceSources] = await Promise.all([
          db.careRecord.findMany({
            where: { ...sourceWhere, status: "CONFIRMED", published: true },
            select: { id: true, version: true },
          }),
          db.attendanceRecord.findMany({
            where: sourceWhere,
            select: { id: true, version: true },
          }),
        ]);
        const sourceRows = (sources: readonly { id: string; version: number }[]) =>
          sources.map((source) => ({
            tenantId: person.tenantId,
            campusId: person.campusId,
            reportId: record.id,
            sourceId: source.id,
            sourceVersion: source.version,
          }));
        if (careSources.length)
          await db.staffDailyReportCareRecordSource.createMany({ data: sourceRows(careSources) });
        if (attendanceSources.length)
          await db.staffDailyReportAttendanceSource.createMany({
            data: sourceRows(attendanceSources),
          });
        return record;
      };
      const reportWhere = (id: string) => ({ tenantId, campusId, id });
      const stored = (id: string) =>
        db.monthlyFeedbackReport.findFirstOrThrow({ where: reportWhere(id) });
      const events = (id: string) =>
        db.monthlyFeedbackEvent.findMany({
          where: { tenantId, campusId, reportId: id },
          orderBy: { version: "asc" },
        });
      const listed = async (id: string, actor = writer) => {
        const record = dataOf(await service.list(actor)).records.find((entry) => entry.id === id);
        assert.ok(record, "The scoped report should remain visible.");
        return record;
      };
      const create = async (month: string) =>
        dataOf(await service.create(writer, { month, supplements }));
      const confirm = async (id: string, version: number) => {
        const submitted = dataOf(await service.submit(writer, id, { version }));
        return dataOf(
          await service.review(reviewer, id, { version: submitted.version, action: "CONFIRM" }),
        );
      };

      await t.test(
        "only eligible sources from the report class and month reach a durable, independently reviewed publication",
        async () => {
          await care("2026-10-01");
          await care("2026-10-02", people.writer, { published: false });
          await care("2026-10-03", people.writer, { status: "DRAFT" });
          await attendance("2026-10-01");
          await attendance("2026-10-02", people.writer, "DEPARTED");
          await attendance("2026-10-03", people.writer, "NOT_ARRIVED");
          const pending = await attendance("2026-10-04");
          await db.attendanceCorrection.create({
            data: {
              tenantId,
              campusId,
              id: randomUUID(),
              attendanceRecordId: pending.id,
              studentId: pending.studentId,
              serviceDate: pending.serviceDate,
              requestedByMembershipId: people.writer.membershipId,
              reason: "TIME_ENTRY_ERROR",
              status: "PENDING",
              originalStatus: "ARRIVED",
              originalArrivalTime: pending.arrivalTime,
              proposedStatus: "ARRIVED",
              proposedArrivalTime: "09:00",
              requestVersion: 1,
            },
          });
          await daily("2026-10-01");
          await daily("2026-10-02", people.writer, "DRAFT");
          for (const outsider of [people.otherClass, people.otherCampus, people.otherTenant]) {
            await care("2026-10-01", outsider);
            await attendance("2026-10-01", outsider);
            await daily("2026-10-01", outsider);
          }
          await care("2026-09-30");
          await attendance("2026-09-30");
          await daily("2026-09-30");
          let report = await create("2026-10");
          assert.equal(report.status, "DRAFT");
          assert.equal(report.version, 1);
          assert.equal(report.sourceVersion, 1);
          assert.deepEqual(report.sourceCounts, {
            GROWTH_RECORD: 1,
            ATTENDANCE_OVERVIEW: 2,
            STAFF_DAILY: 1,
          });
          assert.equal(
            errorOf(
              await service.create(context(people.colleague), { month: "2026-10", supplements }),
            ),
            "CONFLICT_STATE",
            "The uniqueness rule is per class, not per author.",
          );
          assert.equal(
            dataOf(await service.list(reviewer)).canCreate,
            false,
            "A multi-class reviewer cannot choose an implicit class for creation.",
          );
          errorOf(await service.create(reviewer, { month: "2026-11", supplements }));
          assert.equal(
            errorOf(
              await service.edit(context(people.colleague), report.id, {
                version: report.version,
                supplements,
              }),
            ),
            "NOT_FOUND_SCOPED",
          );
          for (const outsider of [people.otherClass, people.otherCampus, people.otherTenant]) {
            assert.equal(
              dataOf(await service.list(context(outsider))).records.some(
                (row) => row.id === report.id,
              ),
              false,
            );
            assert.equal(
              errorOf(
                await service.edit(context(outsider), report.id, {
                  version: report.version,
                  supplements,
                }),
              ),
              "NOT_FOUND_SCOPED",
            );
            assert.equal(
              errorOf(
                await service.review(context(outsider), report.id, {
                  version: report.version,
                  action: "CONFIRM",
                }),
              ),
              "NOT_FOUND_SCOPED",
            );
          }
          assert.equal(
            errorOf(await service.publish(reviewer, report.id, { version: report.version })),
            "CONFLICT_STATE",
          );
          const unchangedEvents = await events(report.id);
          assert.equal((await listed(report.id)).version, 1);
          assert.equal((await listed(report.id)).version, 1);
          assert.deepEqual(await events(report.id), unchangedEvents);

          report = dataOf(
            await service.edit(writer, report.id, {
              version: report.version,
              supplements: { ...supplements, dailyHabits: "PROGRESSING" },
            }),
          );
          report = dataOf(await service.submit(writer, report.id, { version: report.version }));
          assert.equal(report.status, "SUBMITTED");
          assert.equal(
            errorOf(
              await service.review(writer, report.id, {
                version: report.version,
                action: "CONFIRM",
              }),
            ),
            "NOT_FOUND_SCOPED",
          );
          report = dataOf(
            await service.review(reviewer, report.id, {
              version: report.version,
              action: "RETURN",
            }),
          );
          assert.equal(report.status, "RETURNED");
          report = dataOf(
            await service.edit(writer, report.id, { version: report.version, supplements }),
          );
          report = await confirm(report.id, report.version);
          assert.equal(report.status, "CONFIRMED");
          assert.equal(
            errorOf(await service.publish(writer, report.id, { version: report.version })),
            "NOT_FOUND_SCOPED",
          );
          report = dataOf(await service.publish(reviewer, report.id, { version: report.version }));
          assert.equal(report.status, "PUBLISHED");
          assert.equal(
            errorOf(await service.publish(reviewer, report.id, { version: report.version - 1 })),
            "CONFLICT_STATE",
          );
          const beforeReviewerRead = await stored(report.id);
          const reviewerView = await listed(report.id, reviewer);
          assert.deepEqual(
            reviewerView.sourceCounts,
            report.sourceCounts,
            "The reviewer's second class must not contaminate the report sources.",
          );
          assert.deepEqual(await stored(report.id), beforeReviewerRead);
          restartedPrisma = client(isolatedUrl.href);
          await restartedPrisma.$connect();
          const restarted = new PrismaMonthlyFeedbackService(restartedPrisma);
          const restored = dataOf(await restarted.list(writer)).records.find(
            (row) => row.id === report.id,
          );
          assert.ok(restored);
          assert.equal(restored.status, "PUBLISHED");
          assert.equal(restored.version, report.version);
          assert.deepEqual(restored.supplements, supplements);
          const history = await events(report.id);
          assert.deepEqual(
            history.map((event) => event.version),
            Array.from({ length: report.version }, (_, index) => index + 1),
          );
          assert.equal(history.at(-1)?.status, "PUBLISHED");
        },
      );

      await t.test(
        "source changes invalidate stale drafts and every approved boundary, and invalidation survives a conflict response",
        async () => {
          const draftSource = await care("2026-12-01");
          const draft = await create("2026-12");
          await db.careRecord.updateMany({
            where: reportWhere(draftSource.id),
            data: { version: { increment: 1 } },
          });
          assert.equal(
            errorOf(await service.submit(writer, draft.id, { version: draft.version })),
            "CONFLICT_STATE",
          );
          const refreshedDraft = await stored(draft.id);
          assert.equal(refreshedDraft.status, "DRAFT");
          assert.equal(refreshedDraft.version, draft.version + 1);
          assert.equal(refreshedDraft.sourceVersion, draft.sourceVersion + 1);
          assert.equal((await events(draft.id)).at(-1)?.version, refreshedDraft.version);
          assert.equal((await listed(draft.id)).version, refreshedDraft.version);

          let submitted = await create("2027-01");
          submitted = dataOf(
            await service.submit(writer, submitted.id, { version: submitted.version }),
          );
          await attendance("2027-01-01");
          assert.equal(
            errorOf(
              await service.review(reviewer, submitted.id, {
                version: submitted.version,
                action: "CONFIRM",
              }),
            ),
            "CONFLICT_STATE",
          );
          const invalidSubmitted = await stored(submitted.id);
          assert.equal(invalidSubmitted.status, "REVIEW_REQUIRED");
          assert.equal(invalidSubmitted.reviewedByMembershipId, null);
          assert.equal(invalidSubmitted.version, submitted.version + 1);
          assert.equal(invalidSubmitted.sourceVersion, submitted.sourceVersion + 1);

          const dailySource = await daily("2027-02-01");
          let confirmed = await create("2027-02");
          confirmed = await confirm(confirmed.id, confirmed.version);
          await db.staffDailyReport.updateMany({
            where: reportWhere(dailySource.id),
            data: { version: { increment: 1 } },
          });
          assert.equal(
            errorOf(await service.publish(reviewer, confirmed.id, { version: confirmed.version })),
            "CONFLICT_STATE",
          );
          const invalidConfirmed = await stored(confirmed.id);
          assert.equal(invalidConfirmed.status, "REVIEW_REQUIRED");
          assert.equal(invalidConfirmed.reviewedByMembershipId, null);
          assert.equal(invalidConfirmed.version, confirmed.version + 1);

          const publishedSource = await care("2027-03-01");
          let published = await create("2027-03");
          published = await confirm(published.id, published.version);
          published = dataOf(
            await service.publish(reviewer, published.id, { version: published.version }),
          );
          await db.careRecord.updateMany({
            where: reportWhere(publishedSource.id),
            data: { published: false },
          });
          const invalidPublished = await listed(published.id, reviewer);
          assert.equal(invalidPublished.status, "REVIEW_REQUIRED");
          assert.equal(invalidPublished.version, published.version + 1);
          assert.equal(invalidPublished.sourceVersion, published.sourceVersion + 1);
          assert.equal(invalidPublished.sourceCounts.GROWTH_RECORD, 0);
          assert.equal((await stored(published.id)).reviewedByMembershipId, null);
          const stableEvents = await events(published.id);
          assert.equal((await listed(published.id)).version, invalidPublished.version);
          assert.deepEqual(await events(published.id), stableEvents);
          assert.equal(
            errorOf(
              await service.publish(reviewer, published.id, { version: invalidPublished.version }),
            ),
            "CONFLICT_STATE",
          );
          published = dataOf(
            await service.edit(writer, published.id, {
              version: invalidPublished.version,
              supplements,
            }),
          );
          published = await confirm(published.id, published.version);
          assert.equal(
            dataOf(await service.publish(reviewer, published.id, { version: published.version }))
              .status,
            "PUBLISHED",
          );
        },
      );

      await t.test(
        "capabilities, current database permissions and author identity are enforced before writes",
        async () => {
          let report = await create("2027-04");
          const noCapabilities = context(people.writer, []);
          for (const result of [
            await service.list(noCapabilities),
            await service.create(noCapabilities, { month: "2027-05", supplements }),
            await service.edit(noCapabilities, report.id, { version: report.version, supplements }),
            await service.submit(noCapabilities, report.id, { version: report.version }),
            await service.review(noCapabilities, report.id, {
              version: report.version,
              action: "CONFIRM",
            }),
            await service.publish(noCapabilities, report.id, { version: report.version }),
          ])
            assert.equal(errorOf(result), "FORBIDDEN_SCOPE");
          const original = await stored(report.id);
          const replacementMembershipId = randomUUID();
          try {
            await db.membership.updateMany({
              where: { tenantId, id: people.writer.membershipId },
              data: { status: "SUSPENDED" },
            });
            assert.equal(
              errorOf(
                await service.edit(writer, report.id, { version: report.version, supplements }),
              ),
              "FORBIDDEN_SCOPE",
            );
            await db.membership.updateMany({
              where: { tenantId, id: people.writer.membershipId },
              data: { status: "ACTIVE" },
            });
            await db.membershipClass.deleteMany({
              where: { tenantId, campusId, membershipId: people.writer.membershipId, classRef },
            });
            assert.equal(
              errorOf(
                await service.edit(writer, report.id, { version: report.version, supplements }),
              ),
              "FORBIDDEN_SCOPE",
            );
            await db.membershipClass.create({
              data: { tenantId, campusId, membershipId: people.writer.membershipId, classRef },
            });
            await db.user.update({
              where: { id: people.writer.userId },
              data: { status: "SUSPENDED" },
            });
            assert.equal(
              errorOf(await service.submit(writer, report.id, { version: report.version })),
              "FORBIDDEN_SCOPE",
            );
            await db.user.update({
              where: { id: people.writer.userId },
              data: { status: "ACTIVE" },
            });
            assert.deepEqual(await stored(report.id), original);

            report = dataOf(await service.submit(writer, report.id, { version: report.version }));
            await db.membership.updateMany({
              where: { tenantId, id: people.writer.membershipId },
              data: { status: "SUSPENDED" },
            });
            await db.membership.create({
              data: {
                tenantId,
                id: replacementMembershipId,
                userId: people.writer.userId,
                status: "ACTIVE",
              },
            });
            await db.membershipCampus.create({
              data: { tenantId, campusId, membershipId: replacementMembershipId },
            });
            await db.membershipClass.create({
              data: { tenantId, campusId, membershipId: replacementMembershipId, classRef },
            });
            assert.equal(
              errorOf(
                await service.review(writer, report.id, {
                  version: report.version,
                  action: "CONFIRM",
                }),
              ),
              "NOT_FOUND_SCOPED",
              "Replacing a membership must not let the author review their own old report.",
            );
            report = dataOf(
              await service.review(reviewer, report.id, {
                version: report.version,
                action: "CONFIRM",
              }),
            );
            assert.equal(
              errorOf(await service.publish(writer, report.id, { version: report.version })),
              "NOT_FOUND_SCOPED",
            );
          } finally {
            await db.membership.updateMany({
              where: { tenantId, id: replacementMembershipId },
              data: { status: "SUSPENDED" },
            });
            await db.membership.updateMany({
              where: { tenantId, id: people.writer.membershipId },
              data: { status: "ACTIVE" },
            });
            await db.user.update({
              where: { id: people.writer.userId },
              data: { status: "ACTIVE" },
            });
            await db.membershipClass.createMany({
              data: [{ tenantId, campusId, membershipId: people.writer.membershipId, classRef }],
              skipDuplicates: true,
            });
          }
        },
      );

      await t.test(
        "malformed and forged fields are rejected without changing reports or events",
        async () => {
          const report = await create("2027-05");
          const original = await stored(report.id);
          const originalEvents = await events(report.id);
          const reportCount = await db.monthlyFeedbackReport.count({
            where: { tenantId, campusId },
          });
          const eventCount = await db.monthlyFeedbackEvent.count({ where: { tenantId, campusId } });
          for (const body of [
            { month: "2027-13", supplements },
            { month: "2027-06", supplements, tenantId: otherTenantId },
            { month: "2027-06", supplements, classRef: secondClassRef },
            { month: "2027-06", supplements: { ...supplements, unapprovedNote: "synthetic" } },
            { month: "2027-06", supplements: { ...supplements, dailyHabits: "UNKNOWN" } },
            { month: "2027-06", supplements: { ...supplements, dailyHabits: ["PROGRESSING"] } },
          ])
            assert.equal(errorOf(await service.create(writer, body)), "VALIDATION_FAILED");
          for (const result of [
            await service.edit(writer, report.id, {
              version: report.version,
              supplements,
              status: "PUBLISHED",
            }),
            await service.submit(writer, report.id, {
              version: report.version,
              classRef: secondClassRef,
            }),
            await service.review(reviewer, report.id, {
              version: report.version,
              action: "CONFIRM",
              reviewedByMembershipId: people.writer.membershipId,
            }),
            await service.review(reviewer, report.id, {
              version: report.version,
              action: "PUBLISH",
            }),
            await service.publish(reviewer, report.id, { version: report.version, sources: [] }),
            await service.edit(writer, report.id, { version: 0, supplements }),
            await service.edit(writer, report.id, {
              version: report.version,
              supplements: { ...supplements, dailyHabits: ["PROGRESSING"] },
            }),
          ])
            assert.equal(errorOf(result), "VALIDATION_FAILED");
          assert.deepEqual(await stored(report.id), original);
          assert.deepEqual(await events(report.id), originalEvents);
          assert.equal(
            await db.monthlyFeedbackReport.count({ where: { tenantId, campusId } }),
            reportCount,
          );
          assert.equal(
            await db.monthlyFeedbackEvent.count({ where: { tenantId, campusId } }),
            eventCount,
          );
        },
      );

      await t.test(
        "concurrent writers cannot duplicate a class-month or overwrite the same version",
        async () => {
          const creations = await Promise.all([
            service.create(writer, { month: "2027-06", supplements }),
            service.create(context(people.colleague), { month: "2027-06", supplements }),
          ]);
          assert.equal(creations.filter((result) => result.ok).length, 1);
          assert.equal(errorOf(creations.find((result) => !result.ok)!), "CONFLICT_STATE");
          assert.equal(
            await db.monthlyFeedbackReport.count({
              where: { tenantId, campusId, classRef, month: "2027-06" },
            }),
            1,
          );
          const report = await create("2027-07");
          const edits = await Promise.all([
            service.edit(writer, report.id, {
              version: report.version,
              supplements: { ...supplements, dailyHabits: "PROGRESSING" },
            }),
            service.edit(writer, report.id, {
              version: report.version,
              supplements: { ...supplements, dailyHabits: "FOLLOW_UP" },
            }),
          ]);
          assert.equal(edits.filter((result) => result.ok).length, 1);
          assert.equal(errorOf(edits.find((result) => !result.ok)!), "CONFLICT_STATE");
          const winner = dataOf(edits.find((result) => result.ok)!);
          assert.equal((await stored(report.id)).dailyHabits, winner.supplements.dailyHabits);
          assert.equal((await stored(report.id)).version, report.version + 1);
          assert.equal((await events(report.id)).length, 2);
        },
      );

      await t.test(
        "an event write failure rolls back the report and its source snapshot in the same transaction",
        async () => {
          const source = await care("2027-08-01");
          const report = await create("2027-08");
          const original = await stored(report.id);
          const originalEvents = await events(report.id);
          await db.careRecord.updateMany({
            where: reportWhere(source.id),
            data: { version: { increment: 1 } },
          });
          // This constraint is added only in this test's random disposable database.
          await db.$executeRawUnsafe(
            'ALTER TABLE "monthly_feedback_events" ADD CONSTRAINT "synthetic_event_failure" CHECK (false) NOT VALID',
          );
          try {
            let successful = false;
            try {
              successful = (await service.submit(writer, report.id, { version: report.version }))
                .ok;
            } catch {
              // The injected database error may propagate; no successful write is acceptable.
            }
            assert.equal(successful, false);
            assert.deepEqual(await stored(report.id), original);
            assert.deepEqual(await events(report.id), originalEvents);
          } finally {
            await db.$executeRawUnsafe(
              'ALTER TABLE "monthly_feedback_events" DROP CONSTRAINT "synthetic_event_failure"',
            );
          }
          assert.equal(
            errorOf(await service.submit(writer, report.id, { version: report.version })),
            "CONFLICT_STATE",
          );
          assert.equal((await stored(report.id)).version, original.version + 1);
          assert.equal((await events(report.id)).length, originalEvents.length + 1);
        },
      );
    } finally {
      await restartedPrisma?.$disconnect();
      await prisma?.$disconnect();
      if (databaseCreated)
        await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
      await admin.$disconnect();
    }
  },
);
