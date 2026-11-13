import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import {
  PrismaCareRecordService,
  type CareRecordContext,
} from "../src/modules/care-records/prisma-care-record.service.js";
import { PrismaChildMonthlyService } from "../src/modules/monthly-feedback/prisma-child-monthly.service.js";
import type { MonthlyFeedbackContext } from "../src/modules/monthly-feedback/prisma-monthly-feedback.service.js";

const databaseUrl = process.env.DATABASE_URL;
const values = {
  arrival: "ARRIVED_AS_PLANNED",
  homework: "COMPLETED",
  meal: "FINISHED",
  rest: "RESTED",
  activity: "PARTICIPATED",
  wellbeing: "ROUTINE",
} as const;
const supplements = {
  learningParticipation: "PROGRESSING",
  dailyHabits: "KEEP_WATCHING",
  activityParticipation: "PROGRESSING",
  familySchoolCollaboration: "FOLLOW_UP",
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
function errorOf(
  result: { readonly ok: boolean; readonly error?: { readonly code: string } },
  expected: string,
) {
  assert.equal(result.ok, false);
  assert.equal(result.error?.code, expected);
}

test(
  "care sources are captured by production operations and rechecked before approval or parent access",
  { skip: databaseUrl === undefined },
  async (t) => {
    const base = new URL(databaseUrl!);
    assert.ok(["postgres:", "postgresql:"].includes(base.protocol));
    assert.equal(base.hostname, "127.0.0.1");
    assert.equal(base.port, "55456");
    assert.equal(base.search, "");
    assert.equal(base.hash, "");
    const databaseName = `student_care_a1356_${randomUUID().replaceAll("-", "")}`;
    assert.match(databaseName, /^student_care_a1356_[a-f0-9]{32}$/u);
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
        throw new Error("A356 isolated database migration failed; credentials were not logged.");
      }
      prisma = client(isolated.href);
      await prisma.$connect();
      const db = prisma;
      const tenantId = randomUUID();
      const campusId = randomUUID();
      const otherTenantId = randomUUID();
      const otherCampusId = randomUUID();
      const foreignCampusId = randomUUID();
      const classRef = "synthetic-a356-class";
      const scope = { tenantId, campusId };
      const key = (id: string) => ({ ...scope, id });
      const person = (tenant = tenantId, campus = campusId) => ({
        tenantId: tenant,
        campusId: campus,
        userId: randomUUID(),
        membershipId: randomUUID(),
      });
      const writer = person();
      const reviewer = person();
      const guardian = person();
      const otherCampusWriter = person(tenantId, otherCampusId);
      const foreignWriter = person(otherTenantId, foreignCampusId);
      for (const id of [tenantId, otherTenantId])
        await db.tenant.create({
          data: { id, name: "模拟来源机构", slug: `synthetic-a356-${id}`, status: "ACTIVE" },
        });
      await db.campus.createMany({
        data: [
          { tenantId, id: campusId, name: "模拟来源校区", status: "ACTIVE" },
          { tenantId, id: otherCampusId, name: "模拟其他校区", status: "ACTIVE" },
          {
            tenantId: otherTenantId,
            id: foreignCampusId,
            name: "模拟其他机构校区",
            status: "ACTIVE",
          },
        ],
      });
      for (const actor of [writer, reviewer, guardian, otherCampusWriter, foreignWriter]) {
        await db.user.create({ data: { id: actor.userId, status: "ACTIVE" } });
        await db.membership.create({
          data: {
            tenantId: actor.tenantId,
            id: actor.membershipId,
            userId: actor.userId,
            status: "ACTIVE",
          },
        });
        await db.membershipCampus.create({
          data: {
            tenantId: actor.tenantId,
            campusId: actor.campusId,
            membershipId: actor.membershipId,
          },
        });
        if (actor !== guardian)
          await db.membershipClass.create({
            data: {
              tenantId: actor.tenantId,
              campusId: actor.campusId,
              membershipId: actor.membershipId,
              classRef,
            },
          });
      }
      const careContext = (actor: typeof writer): CareRecordContext => ({
        scopes: [
          {
            scope: { tenantId: actor.tenantId, campusId: actor.campusId, actorId: actor.userId },
            capabilities:
              actor === guardian
                ? ["care:read"]
                : ["care:write", "care:review", "care:publish", "care:read"],
          },
        ],
      });
      const monthlyContext = (actor: typeof writer): MonthlyFeedbackContext => ({
        scopes: [
          {
            scope: { tenantId: actor.tenantId, campusId: actor.campusId, actorId: actor.userId },
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
      const writerContext = careContext(writer);
      const reviewerContext = careContext(reviewer);
      const parentContext = careContext(guardian);
      const studentFor = (actor: typeof writer, label: string, assignedClass = classRef) =>
        db.student.create({
          data: {
            tenantId: actor.tenantId,
            campusId: actor.campusId,
            id: randomUUID(),
            classRef: assignedClass,
            displayRef: label,
            status: "ACTIVE",
          },
        });
      const child = await studentFor(writer, "模拟孩子甲");
      const peer = await studentFor(writer, "模拟孩子乙");
      const otherClassChild = await studentFor(writer, "模拟其他班孩子", "synthetic-a356-other");
      const otherCampusChild = await studentFor(otherCampusWriter, "模拟其他校区孩子");
      const foreignChild = await studentFor(foreignWriter, "模拟其他机构孩子");
      const application = await db.bindingApplication.create({
        data: {
          ...scope,
          applicantUserId: guardian.userId,
          onboardingScopeRef: randomUUID(),
          studentCandidateRef: child.id,
          status: "APPROVED",
          reviewedByMembershipId: reviewer.membershipId,
          reviewedAt: new Date(),
        },
      });
      const relationship = await db.guardianRelationship.create({
        data: {
          ...scope,
          bindingApplicationId: application.id,
          guardianUserId: guardian.userId,
          studentId: child.id,
          status: "ACTIVE",
          approvedByMembershipId: reviewer.membershipId,
          approvedAt: new Date(),
        },
      });
      const service = new PrismaCareRecordService(db);
      const monthly = new PrismaChildMonthlyService(db);
      const parentScope = { ...scope, actorId: guardian.userId };
      const attendance = (day: string, student = child, actor = writer, departed = false) =>
        db.attendanceRecord.create({
          data: {
            tenantId: student.tenantId,
            campusId: student.campusId,
            studentId: student.id,
            classRef: student.classRef,
            serviceDate: dateOf(day),
            status: departed ? "DEPARTED" : "ARRIVED",
            arrivalTime: "08:30",
            departureTime: departed ? "17:00" : null,
            recordedByMembershipId: actor.membershipId,
            updatedByMembershipId: actor.membershipId,
          },
        });
      const meal = (day: string, actor = writer, published = true) =>
        db.mealPlan.create({
          data: {
            tenantId: actor.tenantId,
            campusId: actor.campusId,
            serviceDate: dateOf(day),
            mealPeriod: "LUNCH",
            notes: "模拟数据餐食",
            publishStatus: published ? "PUBLISHED" : "DRAFT",
            publishedAt: published ? new Date() : null,
            updatedByMembershipId: actor.membershipId,
          },
        });
      const create = async (day: string) =>
        dataOf(
          await service.create(writerContext, {
            student_id: child.id,
            service_date: day,
            values,
          }),
        );
      type View = Awaited<ReturnType<typeof create>>;
      const submit = async (row: View) =>
        dataOf(
          await service.submit(writerContext, row.id, {
            version: row.version,
          }),
        );
      const confirm = async (row: View) =>
        dataOf(
          await service.review(reviewerContext, row.id, {
            version: row.version,
            action: "confirm",
          }),
        );
      const publish = async (row: View) =>
        dataOf(
          await service.publish(reviewerContext, row.id, {
            version: row.version,
          }),
        );
      const publishDay = async (day: string) =>
        publish(await confirm(await submit(await create(day))));
      const stored = (id: string) =>
        db.careRecord.findFirstOrThrow({
          where: key(id),
          include: {
            revisions: { orderBy: { version: "asc" } },
            attendanceSources: true,
            mealPlanSources: true,
            pickupRecordSources: true,
            auditEvents: true,
            receipts: true,
          },
        });
      const assertReturned = async (before: View) => {
        const row = await stored(before.id);
        assert.equal(row.version, before.version + 1);
        assert.equal(row.status, "RETURNED");
        assert.equal(row.reviewedByMembershipId, null);
        assert.equal(row.published, false);
        assert.equal(row.publicationVersion, 0);
        assert.equal(row.receipts.length, 0);
        assert.equal(
          row.auditEvents.filter(
            (event) => event.version === row.version && String(event.action) === "SOURCES_CHANGED",
          ).length,
          1,
        );
        return row;
      };
      const monthlyDraft = async (month: string) =>
        dataOf(
          await monthly.create(monthlyContext(writer), { studentId: child.id, month, supplements }),
        );
      const publishMonthly = async (month: string) => {
        const draft = await monthlyDraft(month);
        const submitted = dataOf(
          await monthly.submit(monthlyContext(writer), draft.id, { version: draft.version }),
        );
        const confirmed = dataOf(
          await monthly.review(monthlyContext(reviewer), draft.id, {
            version: submitted.version,
            action: "CONFIRM",
          }),
        );
        return dataOf(
          await monthly.publish(monthlyContext(reviewer), draft.id, { version: confirmed.version }),
        );
      };

      await t.test(
        "real staff operations capture all qualified source kinds and preserve every revision",
        async () => {
          const day = "2026-01-01";
          const arrival = await attendance(day, child, writer, true);
          const lunch = await meal(day);
          await meal(day, writer, false);
          const authorization = await db.pickupAuthorization.create({
            data: {
              ...scope,
              studentId: child.id,
              guardianRelationshipId: relationship.id,
              guardianUserId: guardian.userId,
              authorizedPartyRef: "PICKUP_ALPHA",
              type: "TEMPORARY",
              startDate: dateOf(day),
              endDate: dateOf(day),
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
              authorizationId: authorization.id,
              authorizationVersion: authorization.version,
              guardianRelationshipId: relationship.id,
              guardianUserId: guardian.userId,
              studentId: child.id,
              attendanceRecordId: arrival.id,
              attendanceVersion: arrival.version,
              authorizedPartyRef: "PICKUP_ALPHA",
              serviceDate: dateOf(day),
              status: "COMPLETED",
              studentChecked: true,
              recipientChecked: true,
              authorizationChecked: true,
              checkedByMembershipId: writer.membershipId,
              occurredAt: new Date(`${day}T17:00:00.000Z`),
            },
          });
          const published = await publishDay(day);
          const row = await stored(published.id);
          assert.deepEqual(
            row.revisions.map((revision) => revision.version),
            [1, 2, 3, 4],
          );
          for (const revision of row.revisions) {
            assert.equal(Reflect.get(revision, "sourcesCaptured"), true);
            assert.deepEqual(
              row.attendanceSources
                .filter((link) => link.careRecordVersion === revision.version)
                .map((link) => [link.sourceId, link.sourceVersion]),
              [[arrival.id, arrival.version]],
            );
            assert.deepEqual(
              row.mealPlanSources
                .filter((link) => link.careRecordVersion === revision.version)
                .map((link) => [link.sourceId, link.sourceVersion]),
              [[lunch.id, lunch.version]],
            );
            assert.deepEqual(
              row.pickupRecordSources
                .filter((link) => link.careRecordVersion === revision.version)
                .map((link) => link.sourceId),
              [pickup.id],
            );
          }
          await db.pickupAuthorization.updateMany({
            where: key(authorization.id),
            data: { status: "REVOKED", version: { increment: 1 } },
          });
          assert.equal(dataOf(await service.getParent(parentContext, row.id)).id, row.id);
          assert.deepEqual((await monthlyDraft("2026-01")).sourceCounts, {
            GROWTH_RECORD: 1,
            ATTENDANCE_OVERVIEW: 1,
          });
        },
      );

      await t.test(
        "captured empty evidence is usable until a new qualified source requires monthly review",
        async () => {
          const published = await publishDay("2026-02-01");
          const row = await stored(published.id);
          assert.ok(
            row.revisions.every((revision) => Reflect.get(revision, "sourcesCaptured") === true),
          );
          assert.equal(
            row.attendanceSources.length +
              row.mealPlanSources.length +
              row.pickupRecordSources.length,
            0,
          );
          const report = await publishMonthly("2026-02");
          assert.equal(report.sourceCounts.GROWTH_RECORD, 1);
          assert.equal(
            dataOf(await monthly.listParent(parentScope, relationship.id)).records.some(
              (item) => item.id === report.id,
            ),
            true,
          );
          await meal("2026-02-01");
          assert.equal(
            dataOf(await monthly.listParent(parentScope, relationship.id)).records.some(
              (item) => item.id === report.id,
            ),
            false,
          );
          const invalid = await db.childMonthlyReport.findFirstOrThrow({ where: key(report.id) });
          assert.equal(invalid.status, "REVIEW_REQUIRED");
          assert.equal(invalid.reviewedByMembershipId, null);
          assert.equal(invalid.sourceVersion, report.sourceVersion + 1);
        },
      );

      await t.test(
        "submit commits source invalidation and explicit editing recaptures without approving",
        async () => {
          const source = await attendance("2026-03-01");
          const draft = await create("2026-03-01");
          await db.attendanceRecord.updateMany({
            where: key(source.id),
            data: { version: 2, arrivalTime: "08:35" },
          });
          errorOf(
            await service.submit(writerContext, draft.id, { version: draft.version }),
            "CONFLICT_STATE",
          );
          const invalid = await assertReturned(draft);
          const edited = dataOf(
            await service.update(writerContext, draft.id, { version: invalid.version, values }),
          );
          assert.equal(edited.status, "DRAFT");
          const recaptured = await stored(draft.id);
          assert.equal(recaptured.reviewedByMembershipId, null);
          assert.deepEqual(
            recaptured.attendanceSources
              .filter((link) => link.careRecordVersion === edited.version)
              .map((link) => [link.sourceId, link.sourceVersion]),
            [[source.id, 2]],
          );
          errorOf(
            await service.publish(reviewerContext, draft.id, { version: edited.version }),
            "CONFLICT_STATE",
          );
          assert.equal((await publish(await confirm(await submit(edited)))).published, true);
        },
      );

      await t.test(
        "confirmation rejects withdrawn meals and resubmission still needs independent review",
        async () => {
          const source = await meal("2026-04-01");
          const submitted = await submit(await create("2026-04-01"));
          await db.mealPlan.updateMany({
            where: key(source.id),
            data: { publishStatus: "UNPUBLISHED", publishedAt: null, version: 2 },
          });
          errorOf(
            await service.review(reviewerContext, submitted.id, {
              version: submitted.version,
              action: "confirm",
            }),
            "CONFLICT_STATE",
          );
          const invalid = await assertReturned(submitted);
          const resubmitted = dataOf(
            await service.resubmit(writerContext, submitted.id, {
              version: invalid.version,
              values,
            }),
          );
          assert.equal(resubmitted.status, "SUBMITTED");
          const row = await stored(submitted.id);
          assert.equal(
            row.mealPlanSources.filter((link) => link.careRecordVersion === resubmitted.version)
              .length,
            0,
          );
          assert.equal(Reflect.get(row.revisions.at(-1)!, "sourcesCaptured"), true);
          errorOf(
            await service.review(writerContext, submitted.id, {
              version: resubmitted.version,
              action: "confirm",
            }),
            "NOT_FOUND_SCOPED",
          );
          assert.equal((await publish(await confirm(resubmitted))).published, true);
        },
      );

      await t.test(
        "pending attendance correction blocks publication and resolving it does not reuse approval",
        async () => {
          const source = await attendance("2026-05-01");
          const confirmed = await confirm(await submit(await create("2026-05-01")));
          const correction = await db.attendanceCorrection.create({
            data: {
              ...scope,
              attendanceRecordId: source.id,
              studentId: child.id,
              serviceDate: source.serviceDate,
              requestedByMembershipId: writer.membershipId,
              reason: "EVENT_ENTRY_ERROR",
              status: "PENDING",
              originalStatus: "ARRIVED",
              originalArrivalTime: "08:30",
              proposedStatus: "ARRIVED",
              proposedArrivalTime: "08:35",
              requestVersion: 1,
            },
          });
          errorOf(
            await service.publish(reviewerContext, confirmed.id, { version: confirmed.version }),
            "CONFLICT_STATE",
          );
          const invalid = await assertReturned(confirmed);
          await db.attendanceCorrection.updateMany({
            where: key(correction.id),
            data: {
              status: "RETURNED",
              reviewedByMembershipId: reviewer.membershipId,
              reviewedAt: new Date(),
            },
          });
          errorOf(
            await service.publish(reviewerContext, confirmed.id, { version: invalid.version }),
            "CONFLICT_STATE",
          );
          const resubmitted = dataOf(
            await service.resubmit(writerContext, confirmed.id, {
              version: invalid.version,
              values,
            }),
          );
          assert.equal((await publish(await confirm(resubmitted))).published, true);
        },
      );

      await t.test(
        "parent list detail and receipt hide stale publications; republication starts a new receipt",
        async () => {
          const source = await meal("2026-06-01");
          const published = await publishDay("2026-06-01");
          dataOf(
            await service.receipt(parentContext, published.id, {
              version: published.version,
              publication_version: published.publication_version,
              action: "read",
            }),
          );
          await db.mealPlan.updateMany({ where: key(source.id), data: { version: 2 } });
          assert.equal(
            (await service.listParent(parentContext)).some((item) => item.id === published.id),
            false,
          );
          errorOf(await service.getParent(parentContext, published.id), "NOT_FOUND_SCOPED");
          errorOf(
            await service.receipt(parentContext, published.id, {
              version: published.version,
              publication_version: published.publication_version,
              action: "acknowledge",
            }),
            "NOT_FOUND_SCOPED",
          );
          const beforeRecovery = await stored(published.id);
          assert.equal(beforeRecovery.receipts[0]?.status, "READ");
          const revoked = dataOf(
            await service.revokePublication(reviewerContext, published.id, {
              version: beforeRecovery.version,
            }),
          );
          const edited = dataOf(
            await service.update(writerContext, published.id, { version: revoked.version, values }),
          );
          const republished = await publish(await confirm(await submit(edited)));
          assert.equal(republished.publication_version, published.publication_version + 1);
          const parent = dataOf(await service.getParent(parentContext, published.id));
          assert.equal(parent.receipt_status, "UNREAD");
          errorOf(
            await service.receipt(parentContext, published.id, {
              version: republished.version,
              publication_version: published.publication_version,
              action: "read",
            }),
            "VERSION_MISMATCH",
          );
          const recovered = await stored(published.id);
          assert.deepEqual(
            recovered.receipts
              .map((receipt) => [receipt.publicationVersion, receipt.status])
              .sort((a, b) => Number(a[0]) - Number(b[0])),
            [
              [1, "READ"],
              [2, "UNREAD"],
            ],
          );
        },
      );

      await t.test(
        "legacy manual records retain manual meaning without claiming new captured evidence",
        async () => {
          // Only this compatibility case seeds an old-format record. No case seeds care source links.
          const legacy = await db.careRecord.create({
            data: {
              ...scope,
              studentId: child.id,
              classRef,
              serviceDate: dateOf("2026-07-01"),
              ...values,
              status: "CONFIRMED",
              published: true,
              publicationVersion: 1,
              createdByMembershipId: writer.membershipId,
              reviewedByMembershipId: reviewer.membershipId,
              updatedByMembershipId: writer.membershipId,
            },
          });
          const revision = await db.careRecordRevision.create({
            data: {
              ...scope,
              careRecordId: legacy.id,
              version: 1,
              ...values,
              status: "CONFIRMED",
              published: true,
              publicationVersion: 1,
              reviewedByMembershipId: reviewer.membershipId,
              updatedByMembershipId: writer.membershipId,
              updatedAt: legacy.updatedAt,
            },
          });
          assert.equal(Reflect.get(revision, "sourcesCaptured"), false);
          const source = await meal("2026-07-01");
          await db.mealPlan.updateMany({ where: key(source.id), data: { version: 2 } });
          assert.equal(dataOf(await service.getParent(parentContext, legacy.id)).id, legacy.id);
          assert.equal((await monthlyDraft("2026-07")).sourceCounts.GROWTH_RECORD, 1);
          assert.equal((await stored(legacy.id)).version, 1);
        },
      );

      await t.test(
        "source capture and rechecks exclude peers other classes campuses tenants and dates",
        async () => {
          const day = "2026-08-01";
          const own = await attendance(day);
          const unrelated = await Promise.all([
            attendance(day, peer),
            attendance(day, otherClassChild),
            attendance(day, otherCampusChild, otherCampusWriter),
            attendance(day, foreignChild, foreignWriter),
            attendance("2026-08-02"),
          ]);
          await meal(day, otherCampusWriter);
          await meal(day, foreignWriter);
          const draft = await create(day);
          const row = await stored(draft.id);
          assert.deepEqual(
            row.attendanceSources.map((link) => link.sourceId),
            [own.id],
          );
          assert.equal(row.mealPlanSources.length, 0);
          for (const source of unrelated)
            await db.attendanceRecord.updateMany({
              where: { tenantId: source.tenantId, campusId: source.campusId, id: source.id },
              data: { version: 2 },
            });
          const published = await publish(await confirm(await submit(draft)));
          assert.equal(published.published, true);
          assert.equal(
            (await stored(draft.id)).auditEvents.some(
              (event) => String(event.action) === "SOURCES_CHANGED",
            ),
            false,
          );
          errorOf(
            await service.create(careContext(otherCampusWriter), {
              student_id: child.id,
              service_date: day,
              values,
            }),
            "NOT_FOUND_SCOPED",
          );
        },
      );

      await t.test(
        "newly added source kinds invalidate a nonempty frozen set instead of silently extending approval",
        async () => {
          await attendance("2026-09-01");
          const confirmed = await confirm(await submit(await create("2026-09-01")));
          const added = await meal("2026-09-01");
          errorOf(
            await service.publish(reviewerContext, confirmed.id, { version: confirmed.version }),
            "CONFLICT_STATE",
          );
          const invalid = await assertReturned(confirmed);
          assert.equal(
            invalid.mealPlanSources.some((link) => link.sourceId === added.id),
            false,
          );
          const resubmitted = dataOf(
            await service.resubmit(writerContext, confirmed.id, {
              version: invalid.version,
              values,
            }),
          );
          const recaptured = await stored(confirmed.id);
          assert.deepEqual(
            recaptured.mealPlanSources
              .filter((link) => link.careRecordVersion === resubmitted.version)
              .map((link) => link.sourceId),
            [added.id],
          );
          assert.equal((await publish(await confirm(resubmitted))).published, true);
        },
      );
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
