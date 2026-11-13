import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import type { ScopeContext } from "@student-care/tenant";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaChildMonthlyService } from "../src/modules/monthly-feedback/prisma-child-monthly.service.js";
import type { MonthlyFeedbackContext } from "../src/modules/monthly-feedback/prisma-monthly-feedback.service.js";

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

function apiDirectory() {
  const directory = [resolve(process.cwd(), "apps/api"), process.cwd()].find((candidate) =>
    existsSync(resolve(candidate, "prisma/schema.prisma")),
  );
  assert.ok(directory, "An API directory is required to migrate this test's disposable database.");
  return directory;
}
function client(connectionString: string) {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}
function dataOf<T>(
  result:
    | { readonly ok: true; readonly data: T }
    | { readonly ok: false; readonly error: { readonly code: string } },
): T {
  if (!result.ok) assert.fail(JSON.stringify(result));
  return result.data;
}
function errorOf(result: { readonly ok: boolean; readonly error?: { readonly code: string } }) {
  assert.equal(result.ok, false, "An unauthorized, stale or invalid operation must not succeed.");
  assert.ok(result.error);
  return result.error.code;
}

test(
  "child monthly reports persist independent review and guardian/version-bound acknowledgement",
  { skip: adminDatabaseUrl === undefined },
  async (t) => {
    const baseUrl = new URL(adminDatabaseUrl!);
    assert.equal(baseUrl.hostname, "127.0.0.1");
    assert.equal(baseUrl.port, "55449");
    const databaseName = `student_care_a1349_${randomUUID().replaceAll("-", "")}`;
    const isolatedUrl = new URL(baseUrl);
    isolatedUrl.pathname = `/${databaseName}`;
    const admin = client(baseUrl.href);
    let createdDatabase = false;
    let prisma: PrismaClient | undefined;
    try {
      await admin.$connect();
      await admin.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
      createdDatabase = true;
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
      const outsideTenantId = randomUUID();
      const campusId = randomUUID();
      const outsideCampusId = randomUUID();
      const externalCampusId = randomUUID();
      const classRef = "synthetic-child-monthly-class-a";
      const otherClassRef = "synthetic-child-monthly-class-b";
      const person = (tenant = tenantId, campus = campusId, classes = [classRef]) => ({
        userId: randomUUID(),
        membershipId: randomUUID(),
        tenantId: tenant,
        campusId: campus,
        classes,
      });
      const people = {
        writer: person(),
        reviewer: person(),
        colleague: person(),
        otherClass: person(tenantId, campusId, [otherClassRef]),
        otherCampus: person(tenantId, outsideCampusId),
        otherTenant: person(outsideTenantId, externalCampusId),
        guardian: person(tenantId, campusId, []),
        otherGuardian: person(tenantId, campusId, []),
      };
      type Person = typeof people.writer;
      const context = (
        actor: Person,
        allowed: MonthlyFeedbackContext["scopes"][number]["capabilities"] = capabilities,
      ): MonthlyFeedbackContext => ({
        scopes: [
          {
            scope: { tenantId: actor.tenantId, campusId: actor.campusId, actorId: actor.userId },
            capabilities: allowed,
          },
        ],
      });
      const parentScope: ScopeContext = { tenantId, campusId, actorId: people.guardian.userId };
      const writer = context(people.writer);
      const reviewer = context(people.reviewer);
      await db.tenant.createMany({
        data: [tenantId, outsideTenantId].map((id) => ({
          id,
          name: "合成月报机构",
          slug: `synthetic-child-monthly-${id}`,
          status: "ACTIVE",
        })),
      });
      await db.campus.createMany({
        data: [
          { tenantId, id: campusId, name: "合成甲校区", status: "ACTIVE" },
          { tenantId, id: outsideCampusId, name: "合成乙校区", status: "ACTIVE" },
          {
            tenantId: outsideTenantId,
            id: externalCampusId,
            name: "合成外部校区",
            status: "ACTIVE",
          },
        ],
      });
      await db.user.createMany({
        data: Object.values(people).map((p) => ({ id: p.userId, status: "ACTIVE" })),
      });
      await db.membership.createMany({
        data: Object.values(people).map((p) => ({
          tenantId: p.tenantId,
          id: p.membershipId,
          userId: p.userId,
          status: "ACTIVE",
        })),
      });
      await db.membershipCampus.createMany({
        data: Object.values(people).map((p) => ({
          tenantId: p.tenantId,
          campusId: p.campusId,
          membershipId: p.membershipId,
        })),
      });
      await db.membershipClass.createMany({
        data: Object.values(people).flatMap((p) =>
          p.classes.map((c) => ({
            tenantId: p.tenantId,
            campusId: p.campusId,
            membershipId: p.membershipId,
            classRef: c,
          })),
        ),
      });
      const studentFor = (p: Person, label: string) =>
        db.student.create({
          data: {
            tenantId: p.tenantId,
            campusId: p.campusId,
            id: randomUUID(),
            classRef: p.classes[0]!,
            status: "ACTIVE",
            displayRef: label,
          },
        });
      const child = await studentFor(people.writer, "合成孩子甲");
      const peer = await studentFor(people.writer, "合成孩子乙");
      const otherClassChild = await studentFor(people.otherClass, "合成其他班孩子");
      const otherCampusChild = await studentFor(people.otherCampus, "合成其他校区孩子");
      const otherTenantChild = await studentFor(people.otherTenant, "合成其他机构孩子");
      const service = new PrismaChildMonthlyService(db);
      type Child = typeof child;
      const date = (value: string) => new Date(`${value}T00:00:00.000Z`);
      const scopedId = (id: string) => ({ tenantId, campusId, id });
      const care = (student: Child, day: string, published = true) =>
        db.careRecord.create({
          data: {
            tenantId: student.tenantId,
            campusId: student.campusId,
            id: randomUUID(),
            studentId: student.id,
            classRef: student.classRef,
            serviceDate: date(day),
            arrival: "ARRIVED_AS_PLANNED",
            homework: "COMPLETED",
            meal: "FINISHED",
            rest: "RESTED",
            activity: "PARTICIPATED",
            wellbeing: "ROUTINE",
            status: published ? "CONFIRMED" : "DRAFT",
            published,
            publicationVersion: published ? 1 : 0,
            createdByMembershipId: people.writer.membershipId,
            reviewedByMembershipId: published ? people.reviewer.membershipId : null,
            updatedByMembershipId: people.writer.membershipId,
          },
        });
      const attendance = (student: Child, day: string) =>
        db.attendanceRecord.create({
          data: {
            tenantId: student.tenantId,
            campusId: student.campusId,
            id: randomUUID(),
            studentId: student.id,
            classRef: student.classRef,
            serviceDate: date(day),
            status: "ARRIVED",
            arrivalTime: "08:30",
            recordedByMembershipId: people.writer.membershipId,
            updatedByMembershipId: people.writer.membershipId,
          },
        });
      const relationship = async (student: Child, guardian = people.guardian, approved = true) => {
        const app = await db.bindingApplication.create({
          data: {
            tenantId: student.tenantId,
            campusId: student.campusId,
            id: randomUUID(),
            applicantUserId: guardian.userId,
            onboardingScopeRef: randomUUID(),
            studentCandidateRef: student.id,
            status: approved ? "APPROVED" : "PENDING",
            reviewedByMembershipId: approved ? people.reviewer.membershipId : null,
            reviewedAt: approved ? new Date() : null,
          },
        });
        return db.guardianRelationship.create({
          data: {
            tenantId: student.tenantId,
            campusId: student.campusId,
            id: randomUUID(),
            bindingApplicationId: app.id,
            guardianUserId: guardian.userId,
            studentId: student.id,
            status: "ACTIVE",
            version: 1,
            approvedByMembershipId: people.reviewer.membershipId,
            approvedAt: new Date(),
          },
        });
      };
      const relation = await relationship(child);
      const peerRelation = await relationship(peer, people.otherGuardian);
      const stored = (id: string) =>
        db.childMonthlyReport.findFirstOrThrow({ where: scopedId(id) });
      const events = (id: string) =>
        db.childMonthlyEvent.findMany({
          where: { tenantId, campusId, reportId: id },
          orderBy: { version: "asc" },
        });
      const create = async (month: string, studentId = child.id) =>
        dataOf(await service.create(writer, { studentId, month, supplements }));
      const publish = async (month: string, studentId = child.id) => {
        const draft = await create(month, studentId);
        const submitted = dataOf(
          await service.submit(writer, draft.id, { version: draft.version }),
        );
        const confirmed = dataOf(
          await service.review(reviewer, draft.id, {
            version: submitted.version,
            action: "CONFIRM",
          }),
        );
        return dataOf(await service.publish(reviewer, draft.id, { version: confirmed.version }));
      };
      const parentRecords = async (relationshipId = relation.id) =>
        dataOf(await service.listParent(parentScope, relationshipId)).records;

      await t.test(
        "a child's sources exclude peer records, drafts and class reports; publication is separate from review",
        async () => {
          const ownCare = await care(child, "2026-01-05");
          await attendance(child, "2026-01-05");
          await care(child, "2026-01-06", false);
          await care(peer, "2026-01-05");
          await attendance(peer, "2026-01-05");
          const internalDaily = await db.staffDailyReport.create({
            data: {
              tenantId,
              campusId,
              id: randomUUID(),
              classRef,
              date: date("2026-01-07"),
              arrival: "ARRIVED_AS_PLANNED",
              homework: "COMPLETED",
              activity: "PARTICIPATED",
              classroom: "ROUTINE",
              followUp: "NONE",
              status: "CONFIRMED",
              createdByMembershipId: people.writer.membershipId,
              reviewedByMembershipId: people.reviewer.membershipId,
              updatedByMembershipId: people.writer.membershipId,
            },
          });
          const choices = dataOf(await service.list(writer))
            .students.map((s) => s.id)
            .sort();
          assert.deepEqual(choices, [child.id, peer.id].sort());
          const draft = await create("2026-01");
          assert.deepEqual(draft.sourceCounts, { GROWTH_RECORD: 1, ATTENDANCE_OVERVIEW: 1 });
          assert.equal(draft.studentId, child.id);
          assert.equal(draft.status, "DRAFT");
          assert.deepEqual(await parentRecords(), []);
          const submitted = dataOf(
            await service.submit(writer, draft.id, { version: draft.version }),
          );
          assert.equal(submitted.status, "SUBMITTED");
          assert.equal(
            errorOf(
              await service.review(writer, draft.id, {
                version: submitted.version,
                action: "CONFIRM",
              }),
            ),
            "NOT_FOUND_SCOPED",
          );
          const returned = dataOf(
            await service.review(reviewer, draft.id, {
              version: submitted.version,
              action: "RETURN",
            }),
          );
          assert.equal(returned.status, "RETURNED");
          const revisedValues = { ...supplements, dailyHabits: "PROGRESSING" };
          const revised = dataOf(
            await service.edit(writer, draft.id, {
              version: returned.version,
              supplements: revisedValues,
            }),
          );
          const resubmitted = dataOf(
            await service.submit(writer, draft.id, { version: revised.version }),
          );
          const confirmed = dataOf(
            await service.review(reviewer, draft.id, {
              version: resubmitted.version,
              action: "CONFIRM",
            }),
          );
          assert.equal(confirmed.status, "CONFIRMED");
          assert.deepEqual(await parentRecords(), []);
          const published = dataOf(
            await service.publish(reviewer, draft.id, { version: confirmed.version }),
          );
          assert.equal(published.status, "PUBLISHED");
          assert.equal(published.publicationVersion, 1);
          assert.deepEqual(published.actions, []);
          const rows = await parentRecords();
          assert.equal(rows.length, 1);
          assert.deepEqual(
            Object.keys(rows[0]!).sort(),
            [
              "id",
              "studentId",
              "studentLabel",
              "month",
              "publicationVersion",
              "relationshipVersion",
              "supplements",
              "sourceCounts",
              "acknowledged",
            ].sort(),
          );
          assert.equal(rows[0]!.studentId, child.id);
          assert.equal(rows[0]!.studentLabel, "合成孩子甲");
          assert.deepEqual(rows[0]!.supplements, revisedValues);
          assert.equal(rows[0]!.acknowledged, false);
          assert.equal(JSON.stringify(rows).includes(ownCare.id), false);
          assert.equal(JSON.stringify(rows).includes(peer.id), false);
          assert.equal(JSON.stringify(rows).includes(people.writer.userId), false);
          assert.equal(
            JSON.stringify((await stored(draft.id)).sources).includes(internalDaily.id),
            false,
          );
          await db.staffDailyReport.updateMany({
            where: scopedId(internalDaily.id),
            data: { version: { increment: 1 } },
          });
          assert.deepEqual(
            await parentRecords(),
            rows,
            "Internal class-only changes must not invalidate a child's report.",
          );
          assert.equal((await events(draft.id)).length, 7);
          const reopened = client(isolatedUrl.href);
          try {
            const reopenedRows = dataOf(
              await new PrismaChildMonthlyService(reopened).listParent(parentScope, relation.id),
            ).records;
            assert.deepEqual(
              reopenedRows,
              rows,
              "A fresh connection must see the persisted published report.",
            );
          } finally {
            await reopened.$disconnect();
          }
        },
      );

      await t.test(
        "receipt acknowledgement is idempotent and bound to publication and relationship versions",
        async () => {
          await care(child, "2026-02-01");
          const first = await publish("2026-02");
          const body = { publicationVersion: 1, relationshipVersion: 1 };
          assert.equal(
            dataOf(await service.acknowledgeParent(parentScope, relation.id, first.id, body))
              .acknowledged,
            true,
          );
          const before = await db.childMonthlyReceipt.findMany({
            where: { tenantId, campusId, reportId: first.id },
          });
          assert.equal(before.length, 1);
          assert.equal(
            dataOf(await service.acknowledgeParent(parentScope, relation.id, first.id, body))
              .acknowledged,
            true,
          );
          assert.deepEqual(
            await db.childMonthlyReceipt.findMany({
              where: { tenantId, campusId, reportId: first.id },
            }),
            before,
          );
          assert.equal(
            errorOf(
              await service.acknowledgeParent(parentScope, relation.id, first.id, {
                publicationVersion: 99,
                relationshipVersion: 1,
              }),
            ),
            "CONFLICT_STATE",
          );
          await db.guardianRelationship.updateMany({
            where: scopedId(relation.id),
            data: { version: { increment: 1 } },
          });
          const renewed = (await parentRecords()).find((r) => r.id === first.id)!;
          assert.equal(renewed.relationshipVersion, 2);
          assert.equal(renewed.acknowledged, false);
          assert.equal(
            errorOf(await service.acknowledgeParent(parentScope, relation.id, first.id, body)),
            "CONFLICT_STATE",
          );
          assert.equal(
            dataOf(
              await service.acknowledgeParent(parentScope, relation.id, first.id, {
                publicationVersion: 1,
                relationshipVersion: 2,
              }),
            ).acknowledged,
            true,
          );
          assert.equal(
            await db.childMonthlyReceipt.count({
              where: { tenantId, campusId, reportId: first.id },
            }),
            2,
          );
        },
      );

      await t.test(
        "source changes hide old publications, commit invalidation, and require re-review with a new receipt",
        async () => {
          const source = await care(child, "2026-03-01");
          const report = await publish("2026-03");
          await service.acknowledgeParent(parentScope, relation.id, report.id, {
            publicationVersion: 1,
            relationshipVersion: 2,
          });
          const before = await stored(report.id);
          await db.careRecord.updateMany({
            where: scopedId(source.id),
            data: { version: { increment: 1 } },
          });
          assert.equal(
            (await parentRecords()).some((r) => r.id === report.id),
            false,
          );
          const invalid = await stored(report.id);
          assert.equal(invalid.status, "REVIEW_REQUIRED");
          assert.equal(invalid.reviewedByMembershipId, null);
          assert.equal(invalid.version, before.version + 1);
          assert.equal(invalid.sourceVersion, before.sourceVersion + 1);
          assert.equal((await events(report.id)).at(-1)!.action, "SOURCES_CHANGED");
          assert.equal(
            errorOf(
              await service.acknowledgeParent(parentScope, relation.id, report.id, {
                publicationVersion: 1,
                relationshipVersion: 2,
              }),
            ),
            "CONFLICT_STATE",
          );
          const edited = dataOf(
            await service.edit(writer, report.id, { version: invalid.version, supplements }),
          );
          const submitted = dataOf(
            await service.submit(writer, report.id, { version: edited.version }),
          );
          const confirmed = dataOf(
            await service.review(reviewer, report.id, {
              version: submitted.version,
              action: "CONFIRM",
            }),
          );
          const republished = dataOf(
            await service.publish(reviewer, report.id, { version: confirmed.version }),
          );
          assert.equal(republished.publicationVersion, 2);
          const parent = (await parentRecords()).find((r) => r.id === report.id)!;
          assert.equal(parent.acknowledged, false);
          assert.equal(
            errorOf(
              await service.acknowledgeParent(parentScope, relation.id, report.id, {
                publicationVersion: 1,
                relationshipVersion: 2,
              }),
            ),
            "CONFLICT_STATE",
          );
          assert.equal(
            dataOf(
              await service.acknowledgeParent(parentScope, relation.id, report.id, {
                publicationVersion: 2,
                relationshipVersion: 2,
              }),
            ).acknowledged,
            true,
          );
        },
      );

      await t.test(
        "a peer's new or changed source does not revoke this child's approved report",
        async () => {
          await care(child, "2026-04-01");
          const report = await publish("2026-04");
          const original = await stored(report.id);
          const other = await care(peer, "2026-04-01");
          await db.careRecord.updateMany({
            where: scopedId(other.id),
            data: { version: { increment: 1 } },
          });
          await attendance(peer, "2026-04-02");
          assert.equal(
            (await parentRecords()).some((r) => r.id === report.id),
            true,
          );
          assert.deepEqual(await stored(report.id), original);
        },
      );

      await t.test(
        "source addition or withdrawal on a write returns conflict while keeping invalidation committed",
        async () => {
          const source = await care(child, "2026-05-01");
          const draft = await create("2026-05");
          const submitted = dataOf(
            await service.submit(writer, draft.id, { version: draft.version }),
          );
          await attendance(child, "2026-05-02");
          assert.equal(
            errorOf(
              await service.review(reviewer, draft.id, {
                version: submitted.version,
                action: "CONFIRM",
              }),
            ),
            "CONFLICT_STATE",
          );
          const invalid = await stored(draft.id);
          assert.equal(invalid.status, "REVIEW_REQUIRED");
          assert.equal(invalid.version, submitted.version + 1);
          assert.equal((await events(draft.id)).at(-1)!.action, "SOURCES_CHANGED");
          const edited = dataOf(
            await service.edit(writer, draft.id, { version: invalid.version, supplements }),
          );
          const second = dataOf(
            await service.submit(writer, draft.id, { version: edited.version }),
          );
          const confirmed = dataOf(
            await service.review(reviewer, draft.id, {
              version: second.version,
              action: "CONFIRM",
            }),
          );
          await db.careRecord.updateMany({
            where: scopedId(source.id),
            data: { published: false, version: { increment: 1 } },
          });
          assert.equal(
            errorOf(await service.publish(reviewer, draft.id, { version: confirmed.version })),
            "CONFLICT_STATE",
          );
          assert.equal((await stored(draft.id)).status, "REVIEW_REQUIRED");
          assert.equal(
            (await parentRecords()).some((r) => r.id === draft.id),
            false,
          );
        },
      );

      await t.test("empty child sources may be drafted but cannot be submitted", async () => {
        await care(peer, "2026-06-01");
        const draft = await create("2026-06");
        assert.deepEqual(draft.sourceCounts, { GROWTH_RECORD: 0, ATTENDANCE_OVERVIEW: 0 });
        assert.equal(
          errorOf(await service.submit(writer, draft.id, { version: draft.version })),
          "CONFLICT_STATE",
        );
        assert.equal((await stored(draft.id)).status, "DRAFT");
        assert.equal((await events(draft.id)).length, 1);
      });

      await t.test(
        "staff cannot cross child, class, campus or tenant boundaries, combine capabilities, or use stale membership",
        async () => {
          for (const excluded of [otherClassChild, otherCampusChild, otherTenantChild]) {
            assert.equal(
              errorOf(
                await service.create(writer, {
                  studentId: excluded.id,
                  month: "2026-07",
                  supplements,
                }),
              ),
              "NOT_FOUND_SCOPED",
            );
          }
          await care(child, "2026-07-01");
          const report = await create("2026-07");
          for (const p of [people.otherClass, people.otherCampus, people.otherTenant]) {
            assert.equal(
              dataOf(await service.list(context(p))).records.some((r) => r.id === report.id),
              false,
            );
            assert.equal(
              errorOf(
                await service.edit(context(p), report.id, { version: report.version, supplements }),
              ),
              "NOT_FOUND_SCOPED",
            );
          }
          const split: MonthlyFeedbackContext = {
            scopes: [
              ...context(people.reviewer, ["feedback:read"]).scopes,
              {
                scope: { tenantId, campusId: outsideCampusId, actorId: people.reviewer.userId },
                capabilities: ["feedback:review"],
              },
            ],
          };
          const submitted = dataOf(
            await service.submit(writer, report.id, { version: report.version }),
          );
          assert.equal(
            (
              await service.review(split, report.id, {
                version: submitted.version,
                action: "CONFIRM",
              })
            ).ok,
            false,
          );
          await db.membership.updateMany({
            where: { tenantId, id: people.writer.membershipId },
            data: { status: "REVOKED" },
          });
          try {
            assert.equal(errorOf(await service.list(writer)), "FORBIDDEN_SCOPE");
          } finally {
            await db.membership.updateMany({
              where: { tenantId, id: people.writer.membershipId },
              data: { status: "ACTIVE" },
            });
          }
        },
      );

      await t.test(
        "guardian access requires own approved active unreleased binding and active unique membership",
        async () => {
          const pendingChild = await studentFor(people.writer, "合成待审批孩子");
          const rejected = await relationship(pendingChild, people.guardian, false);
          assert.equal((await service.listParent(parentScope, rejected.id)).ok, false);
          assert.equal((await service.listParent(parentScope, peerRelation.id)).ok, false);
          assert.equal(
            (
              await service.listParent(
                { ...parentScope, actorId: people.otherGuardian.userId },
                relation.id,
              )
            ).ok,
            false,
          );
          assert.equal(
            (await service.listParent({ ...parentScope, campusId: outsideCampusId }, relation.id))
              .ok,
            false,
          );
          assert.equal(
            (await service.listParent({ ...parentScope, tenantId: outsideTenantId }, relation.id))
              .ok,
            false,
          );
          for (const setStatus of [
            (status: string) =>
              db.user.updateMany({ where: { id: people.guardian.userId }, data: { status } }),
            (status: string) =>
              db.student.updateMany({ where: scopedId(child.id), data: { status } }),
            (status: string) =>
              db.campus.updateMany({ where: { tenantId, id: campusId }, data: { status } }),
            (status: string) => db.tenant.updateMany({ where: { id: tenantId }, data: { status } }),
          ]) {
            await setStatus("INACTIVE");
            try {
              assert.equal((await service.listParent(parentScope, relation.id)).ok, false);
            } finally {
              await setStatus("ACTIVE");
            }
          }
          await db.bindingApplication.updateMany({
            where: scopedId(relation.bindingApplicationId),
            data: { status: "REJECTED" },
          });
          try {
            assert.equal((await service.listParent(parentScope, relation.id)).ok, false);
          } finally {
            await db.bindingApplication.updateMany({
              where: scopedId(relation.bindingApplicationId),
              data: { status: "APPROVED" },
            });
          }
          await db.guardianRelationship.updateMany({
            where: scopedId(relation.id),
            data: { status: "RELEASED", releasedAt: new Date() },
          });
          try {
            assert.equal((await service.listParent(parentScope, relation.id)).ok, false);
          } finally {
            await db.guardianRelationship.updateMany({
              where: scopedId(relation.id),
              data: { status: "ACTIVE", releasedAt: null },
            });
          }
          await db.membership.updateMany({
            where: { tenantId, id: people.guardian.membershipId },
            data: { status: "REVOKED" },
          });
          try {
            assert.equal(
              errorOf(await service.listParent(parentScope, relation.id)),
              "FORBIDDEN_SCOPE",
            );
          } finally {
            await db.membership.updateMany({
              where: { tenantId, id: people.guardian.membershipId },
              data: { status: "ACTIVE" },
            });
          }
          const duplicate = await db.membership.create({
            data: { tenantId, id: randomUUID(), userId: people.guardian.userId, status: "ACTIVE" },
          });
          await db.membershipCampus.create({
            data: { tenantId, campusId, membershipId: duplicate.id },
          });
          try {
            assert.equal(
              errorOf(await service.listParent(parentScope, relation.id)),
              "FORBIDDEN_SCOPE",
            );
          } finally {
            await db.membership.updateMany({
              where: { tenantId, id: duplicate.id },
              data: { status: "REVOKED" },
            });
          }
        },
      );

      await t.test(
        "rebinding cannot inherit another relationship's receipt and foreign-child receipts fail at the database",
        async () => {
          await care(child, "2026-08-01");
          const report = await publish("2026-08");
          dataOf(
            await service.acknowledgeParent(parentScope, relation.id, report.id, {
              publicationVersion: 1,
              relationshipVersion: 2,
            }),
          );
          await db.guardianRelationship.updateMany({
            where: scopedId(relation.id),
            data: { status: "RELEASED", releasedAt: new Date() },
          });
          const replacement = await relationship(child);
          try {
            assert.equal(
              (
                await service.acknowledgeParent(parentScope, relation.id, report.id, {
                  publicationVersion: 1,
                  relationshipVersion: 2,
                })
              ).ok,
              false,
            );
            const rows = await parentRecords(replacement.id);
            assert.equal(rows.find((r) => r.id === report.id)!.acknowledged, false);
            dataOf(
              await service.acknowledgeParent(parentScope, replacement.id, report.id, {
                publicationVersion: 1,
                relationshipVersion: 1,
              }),
            );
            assert.equal(
              await db.childMonthlyReceipt.count({
                where: { tenantId, campusId, reportId: report.id },
              }),
              2,
            );
            await assert.rejects(
              db.childMonthlyReceipt.create({
                data: {
                  tenantId,
                  campusId,
                  reportId: report.id,
                  studentId: child.id,
                  guardianRelationshipId: peerRelation.id,
                  guardianUserId: people.otherGuardian.userId,
                  guardianRelationshipVersion: 1,
                  publicationVersion: 1,
                  acknowledgedAt: new Date(),
                },
              }),
              (error: unknown) =>
                typeof error === "object" &&
                error !== null &&
                "code" in error &&
                error.code === "P2003",
            );
          } finally {
            await db.guardianRelationship.updateMany({
              where: scopedId(replacement.id),
              data: { status: "RELEASED", releasedAt: new Date() },
            });
            await db.guardianRelationship.updateMany({
              where: scopedId(relation.id),
              data: { status: "ACTIVE", releasedAt: null },
            });
          }
        },
      );

      await t.test(
        "strict input and optimistic versions reject tampering without duplicate report or audit writes",
        async () => {
          await care(child, "2026-09-01");
          for (const body of [
            { studentId: child.id, month: "2026-09", supplements, tenantId },
            { studentId: child.id, month: "2026-13", supplements },
            {
              studentId: child.id,
              month: "2026-09",
              supplements: { ...supplements, dailyHabits: ["PROGRESSING"] },
            },
            {
              studentId: child.id,
              month: "2026-09",
              supplements: { ...supplements, extra: "private" },
            },
          ])
            assert.equal(errorOf(await service.create(writer, body)), "VALIDATION_FAILED");
          const draft = await create("2026-09");
          assert.equal(
            errorOf(
              await service.create(writer, { studentId: child.id, month: "2026-09", supplements }),
            ),
            "CONFLICT_STATE",
          );
          const current = await stored(draft.id);
          assert.equal(
            errorOf(
              await service.edit(writer, draft.id, { version: current.version + 1, supplements }),
            ),
            "CONFLICT_STATE",
          );
          assert.equal(
            errorOf(
              await service.submit(writer, draft.id, {
                version: current.version,
                studentId: peer.id,
              }),
            ),
            "VALIDATION_FAILED",
          );
          assert.equal(
            errorOf(
              await service.acknowledgeParent(parentScope, relation.id, draft.id, {
                publicationVersion: 1,
                relationshipVersion: 2,
                guardianUserId: people.guardian.userId,
              }),
            ),
            "VALIDATION_FAILED",
          );
          assert.deepEqual(await stored(draft.id), current);
          assert.equal((await events(draft.id)).length, 1);
        },
      );

      await t.test(
        "moving a child out of an assigned class removes the former teacher's access",
        async () => {
          await care(peer, "2026-10-01");
          const report = await create("2026-10", peer.id);
          await db.student.updateMany({
            where: scopedId(peer.id),
            data: { classRef: otherClassRef },
          });
          try {
            const visible = dataOf(await service.list(writer));
            assert.equal(
              visible.students.some((s) => s.id === peer.id),
              false,
            );
            assert.equal(
              visible.records.some((r) => r.id === report.id),
              false,
            );
            assert.equal(
              errorOf(await service.submit(writer, report.id, { version: report.version })),
              "NOT_FOUND_SCOPED",
            );
          } finally {
            await db.student.updateMany({ where: scopedId(peer.id), data: { classRef } });
          }
        },
      );

      await t.test(
        "same-class readers without review or publish access cannot see another teacher's published report or refresh it",
        async () => {
          const source = await care(child, "2028-11-01");
          const report = await publish("2028-11");
          await db.careRecord.updateMany({
            where: scopedId(source.id),
            data: { version: { increment: 1 } },
          });
          const beforeRead = await stored(report.id);
          const beforeEvents = await events(report.id);
          const readOnlyTeacher = context(people.colleague, [
            "feedback:read",
            "feedback:create",
            "feedback:submit",
          ]);

          const visible = dataOf(await service.list(readOnlyTeacher));
          assert.equal(
            visible.records.some((row) => row.id === report.id),
            false,
          );
          assert.deepEqual(await stored(report.id), beforeRead);
          assert.deepEqual(await events(report.id), beforeEvents);
        },
      );

      await t.test(
        "after a same-campus class transfer, published monthly history stays immutable for the parent and read-only for the new teacher",
        async () => {
          const source = await care(child, "2028-12-01");
          const report = await publish("2028-12");
          const unpublished = await create("2029-01");
          await db.careRecord.updateMany({
            where: scopedId(source.id),
            data: { version: { increment: 1 } },
          });
          const beforeTransfer = await stored(report.id);
          const beforeEvents = await events(report.id);
          const relationshipState = await db.guardianRelationship.findFirstOrThrow({
            where: scopedId(relation.id),
            select: { version: true },
          });

          await db.student.updateMany({
            where: scopedId(child.id),
            data: { classRef: otherClassRef },
          });
          try {
            const oldClass = dataOf(await service.list(writer));
            assert.equal(
              oldClass.records.some((row) => row.id === report.id),
              false,
            );
            assert.equal(
              oldClass.records.some((row) => row.id === unpublished.id),
              false,
            );
            assert.equal(
              errorOf(
                await service.edit(writer, report.id, {
                  version: beforeTransfer.version,
                  supplements: { ...supplements, dailyHabits: "PROGRESSING" },
                }),
              ),
              "NOT_FOUND_SCOPED",
            );

            const newClass = dataOf(await service.list(context(people.otherClass)));
            const historical = newClass.records.find((row) => row.id === report.id);
            assert.ok(historical);
            assert.equal(historical.status, "PUBLISHED");
            assert.deepEqual(historical.actions, []);
            assert.equal(
              newClass.records.some((row) => row.id === unpublished.id),
              false,
            );
            for (const outsideActor of [people.otherCampus, people.otherTenant]) {
              assert.equal(
                dataOf(await service.list(context(outsideActor))).records.some(
                  (row) => row.id === report.id,
                ),
                false,
              );
            }

            const parentRows = await parentRecords();
            const parentHistory = parentRows.find((row) => row.id === report.id);
            assert.ok(parentHistory);
            assert.equal(parentHistory.acknowledged, false);
            assert.equal(
              dataOf(
                await service.acknowledgeParent(parentScope, relation.id, report.id, {
                  publicationVersion: report.publicationVersion,
                  relationshipVersion: relationshipState.version,
                }),
              ).acknowledged,
              true,
            );
            assert.equal(
              (await parentRecords()).find((row) => row.id === report.id)?.acknowledged,
              true,
            );
            assert.deepEqual(await stored(report.id), beforeTransfer);
            assert.deepEqual(await events(report.id), beforeEvents);
          } finally {
            await db.student.updateMany({ where: scopedId(child.id), data: { classRef } });
          }
        },
      );

      await t.test(
        "a pending attendance correction invalidates a derived care source before parent acknowledgement",
        async () => {
          const arrival = await attendance(child, "2026-11-01");
          const source = await care(child, "2026-11-01");
          await db.careRecordRevision.create({
            data: {
              tenantId,
              campusId,
              careRecordId: source.id,
              updatedAt: new Date(),
              version: 1,
              arrival: source.arrival,
              homework: source.homework,
              meal: source.meal,
              rest: source.rest,
              activity: source.activity,
              wellbeing: source.wellbeing,
              status: "CONFIRMED",
              published: true,
              publicationVersion: 1,
              reviewedByMembershipId: people.reviewer.membershipId,
              updatedByMembershipId: people.writer.membershipId,
            },
          });
          await db.careRecordAttendanceSource.create({
            data: {
              tenantId,
              campusId,
              careRecordId: source.id,
              careRecordVersion: 1,
              sourceId: arrival.id,
              sourceVersion: 1,
              studentId: child.id,
              serviceDate: source.serviceDate,
            },
          });
          const report = await publish("2026-11");
          await db.attendanceCorrection.create({
            data: {
              tenantId,
              campusId,
              id: randomUUID(),
              attendanceRecordId: arrival.id,
              studentId: child.id,
              serviceDate: arrival.serviceDate,
              requestVersion: 1,
              proposedStatus: "DEPARTED",
              originalStatus: "ARRIVED",
              originalArrivalTime: "08:30",
              proposedArrivalTime: "08:30",
              proposedDepartureTime: "17:00",
              reason: "EVENT_ENTRY_ERROR",
              status: "PENDING",
              requestedByMembershipId: people.writer.membershipId,
            },
          });
          assert.equal(
            errorOf(
              await service.acknowledgeParent(parentScope, relation.id, report.id, {
                publicationVersion: 1,
                relationshipVersion: 2,
              }),
            ),
            "CONFLICT_STATE",
          );
          const updated = await stored(report.id);
          assert.equal(updated.status, "REVIEW_REQUIRED");
          assert.equal(updated.reviewedByMembershipId, null);
          assert.equal(
            (await parentRecords()).some((r) => r.id === report.id),
            false,
          );
          assert.equal(
            await db.childMonthlyReceipt.count({
              where: { tenantId, campusId, reportId: report.id },
            }),
            0,
          );
        },
      );

      await t.test(
        "a guardian cannot refresh or write audit events for an unpublished draft by guessing its id",
        async () => {
          const source = await care(child, "2027-01-01");
          const report = await create("2027-01");
          await db.careRecord.updateMany({
            where: scopedId(source.id),
            data: { version: { increment: 1 } },
          });
          const before = await stored(report.id);
          const beforeEvents = await events(report.id);
          const response = await service.acknowledgeParent(parentScope, relation.id, report.id, {
            publicationVersion: 1,
            relationshipVersion: 2,
          });
          assert.equal(response.ok, false);
          assert.deepEqual(
            await stored(report.id),
            before,
            "An unpublished draft is outside the parent's readable/writeable scope; acknowledgement must not refresh its sources.",
          );
          assert.deepEqual(await events(report.id), beforeEvents);
          assert.equal(
            await db.childMonthlyReceipt.count({
              where: { tenantId, campusId, reportId: report.id },
            }),
            0,
          );
        },
      );

      await t.test(
        "concurrent edits using the same version commit exactly one change and one audit event",
        async () => {
          await care(child, "2027-02-01");
          const report = await create("2027-02");
          const before = await stored(report.id);
          const beforeEvents = await events(report.id);
          const results = await Promise.all([
            service.edit(writer, report.id, {
              version: report.version,
              supplements: { ...supplements, dailyHabits: "PROGRESSING" },
            }),
            service.edit(writer, report.id, {
              version: report.version,
              supplements: { ...supplements, dailyHabits: "FOLLOW_UP" },
            }),
          ]);
          assert.equal(results.filter((result) => result.ok).length, 1);
          const rejected = results.find((result) => !result.ok)!;
          assert.equal(errorOf(rejected), "CONFLICT_STATE");
          const winner = dataOf(results.find((result) => result.ok)!);
          const saved = await stored(report.id);
          assert.equal(saved.version, before.version + 1);
          assert.equal(saved.dailyHabits, winner.supplements.dailyHabits);
          assert.equal((await events(report.id)).length, beforeEvents.length + 1);
        },
      );

      await t.test(
        "concurrent acknowledgement permits serializable retry without duplicate or rewritten receipts",
        async () => {
          await care(child, "2027-03-01");
          const report = await publish("2027-03");
          const body = { publicationVersion: report.publicationVersion, relationshipVersion: 2 };
          const results = await Promise.all([
            service.acknowledgeParent(parentScope, relation.id, report.id, body),
            service.acknowledgeParent(parentScope, relation.id, report.id, body),
          ]);
          assert.ok(results.some((result) => result.ok));
          for (const result of results) {
            if (!result.ok) assert.equal(errorOf(result), "CONFLICT_STATE");
          }
          const before = await db.childMonthlyReceipt.findMany({
            where: { tenantId, campusId, reportId: report.id },
          });
          assert.equal(before.length, 1);
          for (const result of results) {
            if (!result.ok)
              assert.equal(
                dataOf(await service.acknowledgeParent(parentScope, relation.id, report.id, body))
                  .acknowledged,
                true,
              );
          }
          assert.equal(
            dataOf(await service.acknowledgeParent(parentScope, relation.id, report.id, body))
              .acknowledged,
            true,
          );
          assert.deepEqual(
            await db.childMonthlyReceipt.findMany({
              where: { tenantId, campusId, reportId: report.id },
            }),
            before,
          );
        },
      );

      await t.test(
        "audit insertion failure rolls back the report transition atomically",
        async () => {
          await care(child, "2026-12-01");
          const report = await create("2026-12");
          const original = await stored(report.id);
          const originalEvents = await events(report.id);
          await db.$executeRawUnsafe(
            'ALTER TABLE "child_monthly_events" ADD CONSTRAINT "synthetic_a1349_event_failure" CHECK (false) NOT VALID',
          );
          try {
            let succeeded = false;
            try {
              succeeded = (await service.submit(writer, report.id, { version: report.version })).ok;
            } catch {
              /* The injected database constraint may propagate, but no write may commit. */
            }
            assert.equal(succeeded, false);
            assert.deepEqual(await stored(report.id), original);
            assert.deepEqual(await events(report.id), originalEvents);
          } finally {
            await db.$executeRawUnsafe(
              'ALTER TABLE "child_monthly_events" DROP CONSTRAINT "synthetic_a1349_event_failure"',
            );
          }
          assert.equal(
            dataOf(await service.submit(writer, report.id, { version: report.version })).status,
            "SUBMITTED",
          );
        },
      );
    } finally {
      await prisma?.$disconnect();
      if (createdDatabase)
        await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
      await admin.$disconnect();
    }
  },
);
