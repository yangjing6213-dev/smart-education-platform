import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaStaffDailyService } from "../src/modules/staff-daily/prisma-staff-daily.service.js";
import {
  PrismaCareRecordService,
  type CareRecordContext,
} from "../src/modules/care-records/prisma-care-record.service.js";
import type { StaffDailyContext, StaffDailyResult } from "../src/nest/api-tokens.js";

const databaseUrl = process.env.DATABASE_URL;
const values = {
  arrival: "ARRIVED_AS_PLANNED",
  homework: "COMPLETED",
  activity: "PARTICIPATED",
  classroom: "ROUTINE",
  followUp: "NONE",
} as const;
const careValues = {
  arrival: "ARRIVED_AS_PLANNED",
  homework: "COMPLETED",
  meal: "FINISHED",
  rest: "RESTED",
  activity: "PARTICIPATED",
  wellbeing: "ROUTINE",
} as const;
const dateOf = (day: string) => new Date(`${day}T00:00:00.000Z`);
type View = { id: string; version: number; status: string; actions: readonly string[] };
function dataOf<T>(
  result:
    | { readonly ok: true; readonly data: T }
    | { readonly ok: false; readonly error: { readonly code: string } },
): T {
  if (!result.ok) assert.fail(`Unexpected business error: ${result.error.code}`);
  return result.data;
}
function view(value: unknown): View {
  assert.ok(typeof value === "object" && value !== null);
  assert.equal(typeof Reflect.get(value, "id"), "string");
  assert.equal(typeof Reflect.get(value, "version"), "number");
  assert.equal(typeof Reflect.get(value, "status"), "string");
  return value as View;
}
const report = (result: StaffDailyResult<unknown>) => view(dataOf(result));
function errorOf(result: StaffDailyResult<unknown>, expected = "CONFLICT_STATE") {
  assert.equal(result.ok, false);
  if (result.ok) assert.fail("An outdated or unauthorized report action must fail.");
  assert.equal(result.error.code, expected);
}

test(
  "daily source rechecks persist invalidation and require explicit recapture and independent review",
  {
    skip: databaseUrl === undefined,
  },
  async (t) => {
    const parsed = new URL(databaseUrl!);
    assert.ok(["postgres:", "postgresql:"].includes(parsed.protocol));
    assert.equal(parsed.hostname, "127.0.0.1");
    assert.equal(parsed.port, "55457");
    assert.equal(parsed.search, "");
    assert.equal(parsed.hash, "");
    // The A357 runner supplies an already migrated, owned, disposable database.
    const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl! }) });
    try {
      await db.$connect();
      const tenantId = randomUUID(),
        campusId = randomUUID(),
        otherCampusId = randomUUID();
      const foreignTenantId = randomUUID(),
        foreignCampusId = randomUUID();
      const classRef = "synthetic-a357-class";
      for (const id of [tenantId, foreignTenantId])
        await db.tenant.create({
          data: { id, name: "模拟日报机构", slug: `synthetic-a357-${id}`, status: "ACTIVE" },
        });
      for (const scope of [
        { tenantId, id: campusId },
        { tenantId, id: otherCampusId },
        { tenantId: foreignTenantId, id: foreignCampusId },
      ])
        await db.campus.create({ data: { ...scope, name: "模拟日报校区", status: "ACTIVE" } });
      const actor = async (tenant = tenantId, campus = campusId, assignedClass = classRef) => {
        const person = {
          tenantId: tenant,
          campusId: campus,
          classRef: assignedClass,
          userId: randomUUID(),
          membershipId: randomUUID(),
        };
        await db.user.create({ data: { id: person.userId, status: "ACTIVE" } });
        await db.membership.create({
          data: {
            tenantId: tenant,
            id: person.membershipId,
            userId: person.userId,
            status: "ACTIVE",
          },
        });
        await db.membershipCampus.create({
          data: { tenantId: tenant, campusId: campus, membershipId: person.membershipId },
        });
        await db.membershipClass.create({
          data: {
            tenantId: tenant,
            campusId: campus,
            membershipId: person.membershipId,
            classRef: assignedClass,
          },
        });
        return person;
      };
      const writer = await actor(),
        reviewer = await actor();
      const otherClass = await actor(tenantId, campusId, "synthetic-a357-other");
      const otherCampus = await actor(tenantId, otherCampusId);
      const foreign = await actor(foreignTenantId, foreignCampusId);
      const foreignReviewer = await actor(foreignTenantId, foreignCampusId);
      type Actor = typeof writer;
      const scope = (person = writer) => ({ tenantId: person.tenantId, campusId: person.campusId });
      const key = (id: string, person = writer) => ({ ...scope(person), id });
      const context = (person: Actor): StaffDailyContext => ({
        scopes: [
          {
            scope: { ...scope(person), actorId: person.userId },
            capabilities: ["daily:read", "daily:create", "daily:submit", "daily:review"],
          },
        ],
      });
      const careContext = (person: Actor): CareRecordContext => ({
        scopes: [
          {
            scope: { ...scope(person), actorId: person.userId },
            capabilities: ["care:read", "care:write", "care:review", "care:publish"],
          },
        ],
      });
      const service = new PrismaStaffDailyService(db);
      const care = new PrismaCareRecordService(db);
      const student = await db.student.create({
        data: { ...scope(), classRef, displayRef: "模拟日报孩子", status: "ACTIVE" },
      });
      const task = (day: string, person = writer) =>
        db.workTask.create({
          data: {
            ...scope(person),
            classRef: person.classRef,
            code: "DAILY_CHECK",
            targetType: "CLASS",
            targetRef: person.classRef,
            dueDate: dateOf(day),
            priority: "NORMAL",
            status: "CHECKED",
            createdByMembershipId: person.membershipId,
            assigneeMembershipId: person.membershipId,
            checkedByMembershipId: person.membershipId,
            updatedByMembershipId: person.membershipId,
          },
        });
      const create = async (day: string, person = writer) =>
        report(await service.create(context(person), { date: day, values }));
      const submit = async (row: View, person = writer) =>
        report(await service.submit(context(person), row.id, { version: row.version }));
      const confirm = async (row: View, person = reviewer) =>
        report(
          await service.review(context(person), row.id, {
            version: row.version,
            action: "CONFIRM",
          }),
        );
      const resubmit = async (row: View, person = writer) =>
        report(await service.resubmit(context(person), row.id, { version: row.version, values }));
      const stored = (id: string, person = writer) =>
        db.staffDailyReport.findFirstOrThrow({
          where: key(id, person),
          include: {
            workTaskSources: true,
            attendanceSources: true,
            careRecordSources: true,
            pickupRecordSources: true,
            pickupExceptionSources: true,
          },
        });
      const sourceKeys = [
        "workTaskSources",
        "attendanceSources",
        "careRecordSources",
        "pickupRecordSources",
        "pickupExceptionSources",
      ] as const;
      const frozen = (row: Awaited<ReturnType<typeof stored>>) =>
        Object.fromEntries(
          sourceKeys.map((name) => [
            name,
            row[name]
              .map((source) => [source.sourceId, source.sourceVersion])
              .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
          ]),
        );
      const invalidated = async (before: Awaited<ReturnType<typeof stored>>, by: Actor) => {
        const row = await stored(before.id);
        assert.equal(row.status, "RETURNED");
        assert.equal(row.reviewedByMembershipId, null);
        assert.equal(row.version, before.version + 1);
        assert.equal(row.updatedByMembershipId, by.membershipId);
        assert.deepEqual(
          frozen(row),
          frozen(before),
          "Invalidation must preserve the old frozen references.",
        );
        return view({ ...row, actions: ["resubmit"] });
      };

      await t.test(
        "an empty snapshot detects new evidence on submit and only resubmit captures it",
        async () => {
          const draft = await create("2026-10-01");
          const before = await stored(draft.id);
          const added = await task("2026-10-01");
          errorOf(await service.submit(context(writer), draft.id, { version: draft.version }));
          const returned = await invalidated(before, writer);
          const submitInvalidation = await db.staffDailyReportAuditEvent.findFirstOrThrow({
            where: {
              tenantId,
              campusId,
              reportId: draft.id,
              reportVersion: returned.version,
            },
          });
          assert.equal(submitInvalidation.action, "SOURCES_INVALIDATED");
          assert.equal(submitInvalidation.actorMembershipId, null);
          assert.equal(submitInvalidation.initiatedByMembershipId, writer.membershipId);
          const validReturned = await stored(draft.id);
          for (const [status, reviewerId] of [
            ["CONFIRMED", null],
            ["DRAFT", reviewer.membershipId],
            ["SUBMITTED", reviewer.membershipId],
          ] as const) {
            await assert.rejects(
              db.$executeRaw`UPDATE "staff_daily_reports"
                SET "status" = ${status}::"staff_daily_status", "reviewed_by_membership_id" = ${reviewerId}::uuid
                WHERE "tenant_id" = ${tenantId}::uuid AND "campus_id" = ${campusId}::uuid AND "id" = ${draft.id}::uuid`,
              (error: unknown) => {
                assert.ok(error instanceof Error);
                assert.match(error.message, /staff_daily_reports_review_state_check/u);
                return true;
              },
            );
            assert.deepEqual(await stored(draft.id), validReturned);
          }
          const submitted = await resubmit(returned);
          assert.equal(submitted.status, "SUBMITTED");
          assert.deepEqual(
            (await stored(draft.id)).workTaskSources.map((source) => [
              source.sourceId,
              source.sourceVersion,
            ]),
            [[added.id, 1]],
          );
          errorOf(
            await service.review(context(writer), draft.id, {
              version: submitted.version,
              action: "CONFIRM",
            }),
            "NOT_FOUND_SCOPED",
          );
          assert.equal((await confirm(submitted)).status, "CONFIRMED");
        },
      );

      await t.test(
        "confirmation detects changed versions and edit recaptures before a new submission",
        async () => {
          const source = await task("2026-10-02");
          const submitted = await submit(await create("2026-10-02"));
          const before = await stored(submitted.id);
          await db.workTask.updateMany({ where: key(source.id), data: { version: 2 } });
          errorOf(
            await service.review(context(reviewer), submitted.id, {
              version: submitted.version,
              action: "CONFIRM",
            }),
          );
          const returned = await invalidated(before, reviewer);
          const reviewInvalidation = await db.staffDailyReportAuditEvent.findFirstOrThrow({
            where: {
              tenantId,
              campusId,
              reportId: submitted.id,
              reportVersion: returned.version,
            },
          });
          assert.equal(reviewInvalidation.action, "SOURCES_INVALIDATED");
          assert.equal(reviewInvalidation.actorMembershipId, null);
          assert.equal(reviewInvalidation.initiatedByMembershipId, reviewer.membershipId);
          const edited = report(
            await service.edit(context(writer), returned.id, { version: returned.version, values }),
          );
          assert.equal(edited.status, "DRAFT");
          assert.equal((await stored(edited.id)).reviewedByMembershipId, null);
          assert.equal((await stored(edited.id)).workTaskSources[0]?.sourceVersion, 2);
          assert.equal((await confirm(await submit(edited))).status, "CONFIRMED");
        },
      );

      await t.test(
        "reopening a checked task removes it from the qualified set without refreshing old refs",
        async () => {
          const source = await task("2026-10-03");
          const draft = await create("2026-10-03");
          const before = await stored(draft.id);
          await db.workTask.updateMany({
            where: key(source.id),
            data: { status: "IN_PROGRESS", checkedByMembershipId: null, version: 2 },
          });
          errorOf(await service.submit(context(writer), draft.id, { version: draft.version }));
          const returned = await invalidated(before, writer);
          assert.equal((await stored(draft.id)).workTaskSources[0]?.sourceId, source.id);
          const submitted = await resubmit(returned);
          assert.equal((await stored(draft.id)).workTaskSources.length, 0);
          assert.equal((await confirm(submitted)).status, "CONFIRMED");
        },
      );

      await t.test(
        "pending attendance corrections remain invalid candidates and resubmit cannot filter them away",
        async () => {
          const day = "2026-10-04";
          const arrival = await db.attendanceRecord.create({
            data: {
              ...scope(),
              studentId: student.id,
              classRef,
              serviceDate: dateOf(day),
              status: "ARRIVED",
              arrivalTime: "08:30",
              recordedByMembershipId: writer.membershipId,
              updatedByMembershipId: writer.membershipId,
            },
          });
          const draft = await create(day);
          const before = await stored(draft.id);
          const correction = await db.attendanceCorrection.create({
            data: {
              ...scope(),
              attendanceRecordId: arrival.id,
              studentId: student.id,
              serviceDate: dateOf(day),
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
          errorOf(await service.submit(context(writer), draft.id, { version: draft.version }));
          const returned = await invalidated(before, writer);
          const beforeRetry = await stored(draft.id);
          errorOf(
            await service.resubmit(context(writer), returned.id, {
              version: returned.version,
              values,
            }),
          );
          assert.deepEqual(await stored(draft.id), beforeRetry);
          await db.attendanceCorrection.updateMany({
            where: key(correction.id),
            data: {
              status: "RETURNED",
              reviewedByMembershipId: reviewer.membershipId,
              reviewedAt: new Date(),
            },
          });
          assert.equal((await confirm(await resubmit(returned))).status, "CONFIRMED");
        },
      );

      await t.test(
        "unchanged care versions still require valid upstream evidence and explicit care re-review",
        async () => {
          const day = "2026-10-05";
          const meal = await db.mealPlan.create({
            data: {
              ...scope(),
              serviceDate: dateOf(day),
              mealPeriod: "LUNCH",
              notes: "模拟数据餐食",
              publishStatus: "PUBLISHED",
              publishedAt: new Date(),
              updatedByMembershipId: writer.membershipId,
            },
          });
          const draft = dataOf(
            await care.create(careContext(writer), {
              student_id: student.id,
              service_date: day,
              values: careValues,
            }),
          );
          const careSubmit = dataOf(
            await care.submit(careContext(writer), draft.id, { version: draft.version }),
          );
          const careConfirm = dataOf(
            await care.review(careContext(reviewer), draft.id, {
              version: careSubmit.version,
              action: "confirm",
            }),
          );
          const published = dataOf(
            await care.publish(careContext(reviewer), draft.id, { version: careConfirm.version }),
          );
          const submitted = await submit(await create(day));
          const before = await stored(submitted.id);
          await db.mealPlan.updateMany({ where: key(meal.id), data: { version: 2 } });
          errorOf(
            await service.review(context(reviewer), submitted.id, {
              version: submitted.version,
              action: "CONFIRM",
            }),
          );
          const returned = await invalidated(before, reviewer);
          assert.equal(
            (await db.careRecord.findFirstOrThrow({ where: key(draft.id) })).version,
            published.version,
          );
          errorOf(
            await service.resubmit(context(writer), returned.id, {
              version: returned.version,
              values,
            }),
          );
          const revoked = dataOf(
            await care.revokePublication(careContext(reviewer), draft.id, {
              version: published.version,
            }),
          );
          const edited = dataOf(
            await care.update(careContext(writer), draft.id, {
              version: revoked.version,
              values: careValues,
            }),
          );
          const newSubmit = dataOf(
            await care.submit(careContext(writer), draft.id, { version: edited.version }),
          );
          const newConfirm = dataOf(
            await care.review(careContext(reviewer), draft.id, {
              version: newSubmit.version,
              action: "confirm",
            }),
          );
          const republished = dataOf(
            await care.publish(careContext(reviewer), draft.id, { version: newConfirm.version }),
          );
          const newDaily = await resubmit(returned);
          assert.equal(
            (await stored(returned.id)).careRecordSources[0]?.sourceVersion,
            republished.version,
          );
          assert.equal(newDaily.status, "SUBMITTED");
          assert.equal((await confirm(newDaily)).status, "CONFIRMED");
        },
      );

      await t.test(
        "author listing returns the committed invalidation once and never mutates another tenant",
        async () => {
          const day = "2026-10-06";
          const source = await task(day),
            foreignSource = await task(day, foreign);
          const confirmed = await confirm(await submit(await create(day)));
          const foreignConfirmed = await confirm(
            await submit(await create(day, foreign), foreign),
            foreignReviewer,
          );
          const before = await stored(confirmed.id),
            foreignBefore = await stored(foreignConfirmed.id, foreign);
          await db.workTask.updateMany({ where: key(source.id), data: { version: 2 } });
          await db.workTask.updateMany({
            where: key(foreignSource.id, foreign),
            data: { version: 2 },
          });
          const listed = dataOf(await service.list(context(writer)))
            .records.map(view)
            .find((row) => row.id === confirmed.id);
          const returned = await invalidated(before, writer);
          assert.equal(listed?.status, "RETURNED");
          assert.equal(listed?.version, returned.version);
          assert.deepEqual(listed?.actions, ["resubmit"]);
          assert.deepEqual(await stored(foreignConfirmed.id, foreign), foreignBefore);
          const after = await stored(confirmed.id);
          dataOf(await service.list(context(writer)));
          assert.deepEqual(await stored(confirmed.id), after);
        },
      );

      await t.test(
        "review listing invalidates submitted and confirmed records and preserves frozen references",
        async () => {
          const day = "2026-10-07";
          const source = await task(day);
          const confirmed = await confirm(await submit(await create(day)));
          const before = await stored(confirmed.id);
          const pendingSource = await task("2026-10-17");
          const pending = await submit(await create("2026-10-17"));
          const pendingBefore = await stored(pending.id);
          await db.workTask.updateMany({ where: key(source.id), data: { version: 2 } });
          await db.workTask.updateMany({ where: key(pendingSource.id), data: { version: 2 } });
          const records = dataOf(await service.reviewList(context(reviewer))).records.map(view);
          const listed = records.find((row) => row.id === confirmed.id);
          const returned = await invalidated(before, reviewer);
          assert.equal(listed?.status, "RETURNED");
          assert.equal(listed?.version, returned.version);
          assert.deepEqual(listed?.actions, []);
          const pendingListed = records.find((row) => row.id === pending.id);
          const pendingReturned = await invalidated(pendingBefore, reviewer);
          assert.equal(pendingListed?.status, "RETURNED");
          assert.equal(pendingListed?.version, pendingReturned.version);
          assert.deepEqual(pendingListed?.actions, []);
          const after = await stored(confirmed.id);
          const pendingAfter = await stored(pending.id);
          dataOf(await service.reviewList(context(reviewer)));
          assert.deepEqual(await stored(confirmed.id), after);
          assert.deepEqual(await stored(pending.id), pendingAfter);
        },
      );

      await t.test(
        "source set changes outside the trusted class campus tenant and date are ignored",
        async () => {
          const day = "2026-10-08";
          const own = await task(day);
          const outside = [
            await task(day, otherClass),
            await task(day, otherCampus),
            await task(day, foreign),
            await task("2026-10-18"),
          ];
          const draft = await create(day);
          assert.deepEqual(
            (await stored(draft.id)).workTaskSources.map((row) => row.sourceId),
            [own.id],
          );
          for (const source of outside)
            await db.workTask.updateMany({
              where: {
                tenantId: source.tenantId,
                campusId: source.campusId,
                id: source.id,
              },
              data: { version: 2 },
            });
          assert.equal((await confirm(await submit(draft))).status, "CONFIRMED");
          const confirmed = await stored(draft.id);
          assert.equal(confirmed.version, 3);
          assert.equal(confirmed.reviewedByMembershipId, reviewer.membershipId);
        },
      );

      await t.test(
        "self review old versions foreign scope and revoked members cannot trigger source writes",
        async () => {
          const day = "2026-10-09";
          const source = await task(day);
          const submitted = await submit(await create(day));
          const before = await stored(submitted.id);
          await db.workTask.updateMany({ where: key(source.id), data: { version: 2 } });
          errorOf(
            await service.review(context(writer), submitted.id, {
              version: submitted.version,
              action: "CONFIRM",
            }),
            "NOT_FOUND_SCOPED",
          );
          errorOf(
            await service.review(context(reviewer), submitted.id, {
              version: submitted.version + 1,
              action: "CONFIRM",
            }),
          );
          errorOf(
            await service.review(context(foreignReviewer), submitted.id, {
              version: submitted.version,
              action: "CONFIRM",
            }),
            "NOT_FOUND_SCOPED",
          );
          assert.deepEqual(await stored(submitted.id), before);
          await db.membership.updateMany({
            where: { tenantId, id: reviewer.membershipId },
            data: { status: "REVOKED" },
          });
          try {
            errorOf(
              await service.review(context(reviewer), submitted.id, {
                version: submitted.version,
                action: "CONFIRM",
              }),
              "FORBIDDEN_SCOPE",
            );
            assert.deepEqual(await stored(submitted.id), before);
          } finally {
            await db.membership.updateMany({
              where: { tenantId, id: reviewer.membershipId },
              data: { status: "ACTIVE" },
            });
          }
          errorOf(
            await service.review(context(reviewer), submitted.id, {
              version: submitted.version,
              action: "CONFIRM",
            }),
          );
          await invalidated(before, reviewer);
        },
      );

      await t.test(
        "pickup validity checks its referenced attendance version even when attendance itself is unchanged",
        async () => {
          const day = "2026-10-10";
          const arrival = await db.attendanceRecord.create({
            data: {
              ...scope(),
              studentId: student.id,
              classRef,
              serviceDate: dateOf(day),
              status: "DEPARTED",
              arrivalTime: "08:30",
              departureTime: "17:00",
              recordedByMembershipId: writer.membershipId,
              updatedByMembershipId: writer.membershipId,
            },
          });
          const guardian = await db.user.create({ data: { status: "ACTIVE" } });
          const application = await db.bindingApplication.create({
            data: {
              ...scope(),
              applicantUserId: guardian.id,
              onboardingScopeRef: randomUUID(),
              studentCandidateRef: student.id,
              status: "APPROVED",
              reviewedByMembershipId: reviewer.membershipId,
              reviewedAt: new Date(),
            },
          });
          const relationship = await db.guardianRelationship.create({
            data: {
              ...scope(),
              bindingApplicationId: application.id,
              guardianUserId: guardian.id,
              studentId: student.id,
              status: "ACTIVE",
              approvedByMembershipId: reviewer.membershipId,
              approvedAt: new Date(),
            },
          });
          const authorization = await db.pickupAuthorization.create({
            data: {
              ...scope(),
              studentId: student.id,
              guardianRelationshipId: relationship.id,
              guardianUserId: guardian.id,
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
              ...scope(),
              authorizationId: authorization.id,
              authorizationVersion: 1,
              guardianRelationshipId: relationship.id,
              guardianUserId: guardian.id,
              studentId: student.id,
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
          const draft = await create(day);
          const before = await stored(draft.id);
          assert.equal(before.pickupRecordSources[0]?.sourceId, pickup.id);
          assert.equal(before.pickupRecordSources[0]?.sourceVersion, 1);
          await db.pickupRecord.updateMany({
            where: key(pickup.id),
            data: { attendanceVersion: 2 },
          });
          assert.deepEqual(
            await db.attendanceRecord.findFirstOrThrow({ where: key(arrival.id) }),
            arrival,
          );
          assert.deepEqual(frozen(await stored(draft.id)), frozen(before));
          errorOf(await service.submit(context(writer), draft.id, { version: draft.version }));
          const returned = await invalidated(before, writer);
          const beforeRetry = await stored(draft.id);
          errorOf(
            await service.resubmit(context(writer), returned.id, {
              version: returned.version,
              values,
            }),
          );
          assert.deepEqual(await stored(draft.id), beforeRetry);
          await db.pickupRecord.updateMany({
            where: key(pickup.id),
            data: { attendanceVersion: arrival.version },
          });
          assert.equal((await confirm(await resubmit(returned))).status, "CONFIRMED");
        },
      );

      await t.test(
        "inactive or transferred students prevent submission while invalid evidence remains visible in drafts",
        async () => {
          const day = "2026-10-11";
          const affected = await db.student.create({
            data: { ...scope(), classRef, displayRef: "模拟范围变更孩子", status: "ACTIVE" },
          });
          const arrival = await db.attendanceRecord.create({
            data: {
              ...scope(),
              studentId: affected.id,
              classRef,
              serviceDate: dateOf(day),
              status: "ARRIVED",
              arrivalTime: "08:30",
              recordedByMembershipId: writer.membershipId,
              updatedByMembershipId: writer.membershipId,
            },
          });
          await db.student.updateMany({ where: key(affected.id), data: { status: "INACTIVE" } });
          try {
            const draft = await create(day);
            assert.equal(draft.status, "DRAFT");
            const edited = report(
              await service.edit(context(writer), draft.id, { version: draft.version, values }),
            );
            assert.equal(edited.status, "DRAFT");
            const before = await stored(edited.id);
            assert.equal(before.attendanceSources[0]?.sourceId, arrival.id);
            errorOf(await service.submit(context(writer), edited.id, { version: edited.version }));
            const returned = await invalidated(before, writer);
            const beforeRetry = await stored(edited.id);
            errorOf(
              await service.resubmit(context(writer), returned.id, {
                version: returned.version,
                values,
              }),
            );
            assert.deepEqual(await stored(edited.id), beforeRetry);
            await db.student.updateMany({ where: key(affected.id), data: { status: "ACTIVE" } });
            const submitted = await resubmit(returned);
            const beforeTransfer = await stored(submitted.id);
            await db.student.updateMany({
              where: key(affected.id),
              data: { classRef: "synthetic-a357-transferred" },
            });
            assert.deepEqual(
              await db.attendanceRecord.findFirstOrThrow({ where: key(arrival.id) }),
              arrival,
            );
            errorOf(
              await service.review(context(reviewer), submitted.id, {
                version: submitted.version,
                action: "CONFIRM",
              }),
            );
            const moved = await invalidated(beforeTransfer, reviewer);
            await db.student.updateMany({ where: key(affected.id), data: { classRef } });
            assert.equal((await confirm(await resubmit(moved))).status, "CONFIRMED");
          } finally {
            await db.student.updateMany({
              where: key(affected.id),
              data: { status: "ACTIVE", classRef },
            });
          }
        },
      );

      await t.test(
        "open pickup exceptions are captured and both revision changes and invalid students revoke daily approval",
        async () => {
          const day = "2026-10-12";
          const affected = await db.student.create({
            data: { ...scope(), classRef, displayRef: "模拟接送异常孩子", status: "ACTIVE" },
          });
          const draft = await create(day);
          const before = await stored(draft.id);
          const exception = await db.pickupException.create({
            data: {
              ...scope(),
              studentId: affected.id,
              classRef,
              date: dateOf(day),
              category: "NO_AUTHORIZATION",
              status: "OPEN",
              createdByMembershipId: writer.membershipId,
            },
          });
          errorOf(await service.submit(context(writer), draft.id, { version: draft.version }));
          const returned = await invalidated(before, writer);
          const submitted = await resubmit(returned);
          const beforeRevision = await stored(draft.id);
          assert.deepEqual(
            beforeRevision.pickupExceptionSources.map((source) => [
              source.sourceId,
              source.sourceVersion,
            ]),
            [[exception.id, 1]],
          );
          await db.pickupException.updateMany({
            where: key(exception.id),
            data: {
              status: "FOLLOWING",
              version: 2,
              reviewedByMembershipId: reviewer.membershipId,
              reviewedAt: new Date(),
              outcome: "CONTACT_GUARDIAN",
            },
          });
          errorOf(
            await service.review(context(reviewer), submitted.id, {
              version: submitted.version,
              action: "CONFIRM",
            }),
          );
          const changed = await invalidated(beforeRevision, reviewer);
          const resubmitted = await resubmit(changed);
          const beforeInactive = await stored(resubmitted.id);
          assert.equal(beforeInactive.pickupExceptionSources[0]?.sourceVersion, 2);
          await db.student.updateMany({ where: key(affected.id), data: { status: "INACTIVE" } });
          try {
            assert.equal(
              (await db.pickupException.findFirstOrThrow({ where: key(exception.id) })).version,
              2,
            );
            errorOf(
              await service.review(context(reviewer), resubmitted.id, {
                version: resubmitted.version,
                action: "CONFIRM",
              }),
            );
            const inactive = await invalidated(beforeInactive, reviewer);
            await db.student.updateMany({ where: key(affected.id), data: { status: "ACTIVE" } });
            assert.equal((await confirm(await resubmit(inactive))).status, "CONFIRMED");
          } finally {
            await db.student.updateMany({ where: key(affected.id), data: { status: "ACTIVE" } });
          }
        },
      );
    } finally {
      await db.$disconnect();
    }
  },
);
