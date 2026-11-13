import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaGuardianBindingService } from "../src/modules/guardian-bindings/prisma-guardian-binding.service.js";
import { createApiApp } from "../src/nest/api-app.js";

const databaseUrl = process.env.DATABASE_URL;

test("Nest application shutdown disconnects the Prisma binding client", async () => {
  let disconnectCount = 0;
  const service = new PrismaGuardianBindingService({
    $disconnect: async () => {
      disconnectCount += 1;
    },
  } as unknown as PrismaClient);
  const app = await createApiApp({ guardianBindingOperations: service });

  await app.init();
  await app.close();

  assert.equal(disconnectCount, 1);
});

function createClient() {
  if (databaseUrl === undefined) throw new Error("DATABASE_URL is required for this test.");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
}

test(
  "guardian binding persists approvals and isolates campus scope",
  { skip: databaseUrl === undefined },
  async () => {
    const parsedUrl = new URL(databaseUrl!);
    assert.equal(parsedUrl.hostname, "127.0.0.1");
    assert.equal(parsedUrl.port, "55432");

    const prisma = createClient();
    const tenantId = randomUUID();
    const eastCampusId = randomUUID();
    const westCampusId = randomUUID();
    const guardianUserId = randomUUID();
    const eastReviewerUserId = randomUUID();
    const westReviewerUserId = randomUUID();
    const guardianMembershipId = randomUUID();
    const eastReviewerMembershipId = randomUUID();
    const westReviewerMembershipId = randomUUID();
    const studentId = randomUUID();
    let restartedClient: PrismaClient | undefined;

    const guardianContext = {
      scopes: [{ actorId: guardianUserId, tenantId, campusId: eastCampusId }],
    } as const;
    const eastReviewerContext = {
      scopes: [{ actorId: eastReviewerUserId, tenantId, campusId: eastCampusId }],
    } as const;
    const westReviewerContext = {
      scopes: [{ actorId: westReviewerUserId, tenantId, campusId: westCampusId }],
    } as const;

    try {
      await prisma.$connect();
      await prisma.tenant.create({
        data: { id: tenantId, name: "合成机构", slug: `synthetic-${tenantId}`, status: "ACTIVE" },
      });
      await prisma.campus.createMany({
        data: [
          { id: eastCampusId, tenantId, name: "合成东校区", status: "ACTIVE" },
          { id: westCampusId, tenantId, name: "合成西校区", status: "ACTIVE" },
        ],
      });
      await prisma.user.createMany({
        data: [guardianUserId, eastReviewerUserId, westReviewerUserId].map((id) => ({
          id,
          status: "ACTIVE",
        })),
      });
      await prisma.membership.createMany({
        data: [
          { id: guardianMembershipId, tenantId, userId: guardianUserId, status: "ACTIVE" },
          { id: eastReviewerMembershipId, tenantId, userId: eastReviewerUserId, status: "ACTIVE" },
          { id: westReviewerMembershipId, tenantId, userId: westReviewerUserId, status: "ACTIVE" },
        ],
      });
      await prisma.membershipCampus.createMany({
        data: [
          { tenantId, campusId: eastCampusId, membershipId: guardianMembershipId },
          { tenantId, campusId: eastCampusId, membershipId: eastReviewerMembershipId },
          { tenantId, campusId: westCampusId, membershipId: westReviewerMembershipId },
        ],
      });
      await prisma.student.create({
        data: {
          id: studentId,
          tenantId,
          campusId: eastCampusId,
          classRef: "合成班级",
          status: "ACTIVE",
          displayRef: "模拟学生-01",
        },
      });

      const invitedStudents = new Map([[guardianUserId, [studentId]]]);
      const service = new PrismaGuardianBindingService(prisma, invitedStudents);
      const submissions = await Promise.all([
        service.submit(guardianContext, {
          student_candidate_ref: studentId,
          relationship: "GUARDIAN",
          consent: true,
        }),
        service.submit(guardianContext, {
          student_candidate_ref: studentId,
          relationship: "GUARDIAN",
          consent: true,
        }),
      ]);
      const accepted = submissions.filter((result) => result.ok);
      const rejected = submissions.filter((result) => !result.ok);
      assert.equal(accepted.length, 1);
      assert.equal(rejected.length, 1);
      if (rejected[0]?.ok !== false) assert.fail("Duplicate application must be rejected.");
      assert.equal(rejected[0].error.code, "CONFLICT_STATE");

      const application = accepted[0];
      if (application?.ok !== true) assert.fail("One application should be saved.");
      assert.equal((await service.listApplications(guardianContext)).length, 1);
      assert.equal((await service.listPending(eastReviewerContext)).length, 1);
      assert.deepEqual(await service.listPending(westReviewerContext), []);

      const hiddenReview = await service.review(westReviewerContext, application.data.id, {
        version: 1,
        action: "approve",
      });
      assert.equal(hiddenReview.ok, false);
      if (hiddenReview.ok) assert.fail("A reviewer from another campus must not see the request.");
      assert.equal(hiddenReview.error.code, "NOT_FOUND_SCOPED");

      const approved = await service.review(eastReviewerContext, application.data.id, {
        version: 1,
        action: "approve",
      });
      assert.equal(approved.ok, true);
      const staleReview = await service.review(eastReviewerContext, application.data.id, {
        version: 1,
        action: "approve",
      });
      assert.equal(staleReview.ok, false);
      if (staleReview.ok) assert.fail("A stale application version must be rejected.");
      assert.equal(staleReview.error.code, "VERSION_MISMATCH");
      const activeRelationships = await service.listRelationships(guardianContext);
      assert.equal(activeRelationships.length, 1);
      const relationship = activeRelationships[0];
      if (relationship === undefined) assert.fail("Approval should create a relationship.");

      const activeDuplicate = await service.submit(guardianContext, {
        student_candidate_ref: studentId,
        relationship: "GUARDIAN",
        consent: true,
      });
      assert.equal(activeDuplicate.ok, false);
      if (activeDuplicate.ok)
        assert.fail("An active relationship must block a duplicate application.");
      assert.equal(activeDuplicate.error.code, "CONFLICT_STATE");

      const activationEvent = await prisma.guardianRelationshipAuditEvent.findFirst({
        where: { tenantId, campusId: eastCampusId, guardianRelationshipId: relationship.id },
      });
      assert.equal(activationEvent?.action, "ACTIVATED");
      assert.equal(activationEvent?.actorMembershipId, eastReviewerMembershipId);
      assert.equal(activationEvent?.relationshipVersion, 1);

      const released = await service.release(guardianContext, relationship.id, {
        version: relationship.version,
      });
      assert.equal(released.ok, true);
      if (!released.ok) assert.fail("The guardian should release their active relationship.");
      assert.equal(released.data.status, "RELEASED");
      assert.equal(released.data.version, relationship.version + 1);

      const staleRelease = await service.release(guardianContext, relationship.id, {
        version: relationship.version,
      });
      assert.equal(staleRelease.ok, false);
      if (staleRelease.ok) assert.fail("A stale release must not be repeated.");
      assert.equal(staleRelease.error.code, "VERSION_MISMATCH");

      const persistedRelease = await prisma.guardianRelationship.findFirst({
        where: { tenantId, campusId: eastCampusId, id: relationship.id },
      });
      assert.equal(persistedRelease?.status, "RELEASED");
      assert.equal(persistedRelease?.version, relationship.version + 1);
      assert.ok(persistedRelease?.releasedAt instanceof Date);

      const relationshipEvents = await prisma.guardianRelationshipAuditEvent.findMany({
        where: { tenantId, campusId: eastCampusId, guardianRelationshipId: relationship.id },
        orderBy: { relationshipVersion: "asc" },
      });
      assert.deepEqual(
        relationshipEvents.map((event) => ({
          action: event.action,
          actorMembershipId: event.actorMembershipId,
          relationshipVersion: event.relationshipVersion,
        })),
        [
          {
            action: "ACTIVATED",
            actorMembershipId: eastReviewerMembershipId,
            relationshipVersion: 1,
          },
          {
            action: "RELEASED",
            actorMembershipId: guardianMembershipId,
            relationshipVersion: 2,
          },
        ],
      );
      const firstEvent = relationshipEvents[0];
      if (!firstEvent) assert.fail("The approval audit event must exist.");
      await assert.rejects(
        prisma.guardianRelationshipAuditEvent.updateMany({
          where: { tenantId, campusId: eastCampusId, id: firstEvent.id },
          data: { action: "RELEASED" },
        }),
        /append-only/u,
      );
      await assert.rejects(
        prisma.guardianRelationshipAuditEvent.deleteMany({
          where: { tenantId, campusId: eastCampusId, id: firstEvent.id },
        }),
        /append-only/u,
      );

      const resubmitted = await service.submit(guardianContext, {
        student_candidate_ref: studentId,
        relationship: "GUARDIAN",
        consent: true,
      });
      assert.equal(resubmitted.ok, true);
      if (!resubmitted.ok) assert.fail("A released relationship should allow a new application.");
      assert.equal(resubmitted.data.id === application.data.id, false);
      const approvedAgain = await service.review(eastReviewerContext, resubmitted.data.id, {
        version: 1,
        action: "approve",
      });
      assert.equal(approvedAgain.ok, true);
      const relationshipHistory = await service.listRelationships(guardianContext);
      assert.equal(relationshipHistory.length, 2);
      assert.deepEqual(relationshipHistory.map((row) => row.status).sort(), ["ACTIVE", "RELEASED"]);
      const allAuditEvents = await prisma.guardianRelationshipAuditEvent.findMany({
        where: { tenantId, campusId: eastCampusId },
      });
      assert.equal(allAuditEvents.length, 3);

      await prisma.$disconnect();
      restartedClient = createClient();
      const afterRestart = new PrismaGuardianBindingService(restartedClient, invitedStudents);
      const relationshipsAfterRestart = await afterRestart.listRelationships(guardianContext);
      assert.equal(relationshipsAfterRestart.length, 2);
      assert.deepEqual(relationshipsAfterRestart.map((row) => row.status).sort(), [
        "ACTIVE",
        "RELEASED",
      ]);
      assert.equal(
        (await afterRestart.listApplications(guardianContext)).filter(
          (row) => row.status === "APPROVED",
        ).length,
        2,
      );
    } finally {
      if (restartedClient === undefined) await prisma.$disconnect();
      const cleanup = restartedClient ?? createClient();
      try {
        await cleanup.$connect();
        await cleanup.$executeRawUnsafe(
          'DROP TRIGGER IF EXISTS "guardian_relationship_audit_events_append_only" ON "guardian_relationship_audit_events"',
        );
        await cleanup.guardianRelationshipAuditEvent.deleteMany({ where: { tenantId } });
        await cleanup.$executeRawUnsafe(
          'CREATE TRIGGER "guardian_relationship_audit_events_append_only" BEFORE UPDATE OR DELETE OR TRUNCATE ON "guardian_relationship_audit_events" FOR EACH STATEMENT EXECUTE FUNCTION "prevent_guardian_relationship_audit_event_mutation"()',
        );
        await cleanup.guardianRelationship.deleteMany({ where: { tenantId } });
        await cleanup.bindingApplication.deleteMany({ where: { tenantId } });
        await cleanup.student.deleteMany({ where: { tenantId } });
        await cleanup.membershipCampus.deleteMany({ where: { tenantId } });
        await cleanup.membership.deleteMany({ where: { tenantId } });
        await cleanup.user.deleteMany({
          where: { id: { in: [guardianUserId, eastReviewerUserId, westReviewerUserId] } },
        });
        await cleanup.campus.deleteMany({ where: { tenantId } });
        await cleanup.tenant.deleteMany({ where: { id: tenantId } });
      } finally {
        await cleanup.$disconnect();
      }
    }
  },
);
