import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaParentPickupService } from "../src/modules/pickup/prisma-parent-pickup.service.js";

const adminDatabaseUrl = process.env.DATABASE_URL;

function apiDirectory(): string {
  const candidates = [resolve(process.cwd(), "apps/api"), process.cwd()];
  const directory = candidates.find((candidate) =>
    existsSync(resolve(candidate, "prisma/schema.prisma")),
  );
  if (!directory)
    throw new Error("API Prisma folder could not be located for the disposable database test.");
  return directory;
}

function client(connectionString: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

test("active pickup authorization is valid throughout interior dates of its date range", async () => {
  const context = {
    tenantId: "00000000-0000-4000-8000-000000000001",
    campusId: "00000000-0000-4000-8000-000000000002",
    actorId: "00000000-0000-4000-8000-000000000003",
    capabilities: ["binding:read", "binding:apply"],
  } as const;
  const relationship = {
    id: "00000000-0000-4000-8000-000000000005",
    version: 1,
    student: {
      id: "00000000-0000-4000-8000-000000000004",
      displayRef: "模拟学生甲",
      classRef: "模拟三年级一班",
    },
  };
  const authorization = {
    id: "00000000-0000-4000-8000-000000000006",
    version: 2,
    status: "ACTIVE",
    startDate: new Date("2026-10-24T00:00:00.000Z"),
    endDate: new Date("2026-10-26T00:00:00.000Z"),
    startTime: "15:00",
    endTime: "18:00",
    guardianRelationshipId: relationship.id,
    studentId: relationship.student.id,
    authorizedPartyRef: "PICKUP_ALPHA",
    type: "REGULAR",
    student: { displayRef: "模拟学生甲", classRef: "模拟三年级一班" },
  };
  const prisma = {
    membershipCampus: { findMany: async () => [{ membershipId: "membership-synthetic" }] },
    guardianRelationship: { findMany: async () => [relationship] },
    pickupAuthorization: { findMany: async () => [authorization] },
    pickupRecord: { findMany: async () => [] },
  } as unknown as PrismaClient;
  const service = new PrismaParentPickupService(prisma, () => new Date("2026-10-25T04:00:00.000Z"));

  const projection = await service.list(context);

  assert.equal(projection.authorizations[0]?.currentlyValid, true);
});

test(
  "parent pickup persists scoped drafts and versioned activation and revocation using approved relationships",
  { skip: adminDatabaseUrl === undefined },
  async () => {
    const baseUrl = new URL(adminDatabaseUrl!);
    assert.equal(baseUrl.hostname, "127.0.0.1");
    assert.equal(baseUrl.port, "55432");
    const databaseName = `student_care_a1330_${randomUUID().replaceAll("-", "")}`;
    const isolatedUrl = new URL(baseUrl);
    isolatedUrl.pathname = `/${databaseName}`;
    const admin = client(baseUrl.href);
    let databaseCreated = false;
    let prisma: PrismaClient | undefined;
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
      const tenantId = randomUUID();
      const campusId = randomUUID();
      const otherCampusId = randomUUID();
      const guardianUserId = randomUUID();
      const otherGuardianUserId = randomUUID();
      const staffUserId = randomUUID();
      const guardianMembershipId = randomUUID();
      const otherGuardianMembershipId = randomUUID();
      const staffMembershipId = randomUUID();
      const studentId = randomUUID();
      const bindingApplicationId = randomUUID();
      const relationshipId = randomUUID();
      const now = new Date("2026-10-25T01:00:00.000Z");
      const context = {
        tenantId,
        campusId,
        actorId: guardianUserId,
        capabilities: ["binding:read", "binding:apply"],
      };
      const otherContext = { ...context, actorId: otherGuardianUserId };

      await prisma.tenant.create({
        data: { id: tenantId, name: "模拟托管机构", slug: `pickup-${tenantId}`, status: "ACTIVE" },
      });
      await prisma.campus.createMany({
        data: [campusId, otherCampusId].map((id, index) => ({
          tenantId,
          id,
          name: index === 0 ? "模拟东校区" : "模拟西校区",
          status: "ACTIVE",
        })),
      });
      await prisma.user.createMany({
        data: [guardianUserId, otherGuardianUserId, staffUserId].map((id) => ({
          id,
          status: "ACTIVE",
        })),
      });
      await prisma.membership.createMany({
        data: [guardianMembershipId, otherGuardianMembershipId, staffMembershipId].map(
          (id, index) => ({
            id,
            tenantId,
            userId: [guardianUserId, otherGuardianUserId, staffUserId][index]!,
            status: "ACTIVE" as const,
          }),
        ),
      });
      await prisma.membershipCampus.createMany({
        data: [guardianMembershipId, otherGuardianMembershipId, staffMembershipId].map(
          (membershipId) => ({ tenantId, campusId, membershipId }),
        ),
      });
      await prisma.student.create({
        data: {
          tenantId,
          campusId,
          id: studentId,
          classRef: "模拟三年级一班",
          status: "ACTIVE",
          displayRef: "模拟学生甲",
        },
      });
      await prisma.bindingApplication.create({
        data: {
          tenantId,
          campusId,
          id: bindingApplicationId,
          applicantUserId: guardianUserId,
          onboardingScopeRef: randomUUID(),
          studentCandidateRef: studentId,
          status: "APPROVED",
          reviewedByMembershipId: staffMembershipId,
          reviewedAt: now,
        },
      });
      await prisma.guardianRelationship.create({
        data: {
          tenantId,
          campusId,
          id: relationshipId,
          bindingApplicationId,
          guardianUserId,
          studentId,
          status: "ACTIVE",
          version: 1,
          approvedByMembershipId: staffMembershipId,
          approvedAt: now,
        },
      });

      const service = new PrismaParentPickupService(prisma, () => new Date(now));
      const initial = await service.list(context);
      assert.deepEqual(
        initial.bindings.map((binding) => binding.id),
        [relationshipId],
      );
      assert.deepEqual(initial.authorizations, []);
      assert.deepEqual(initial.records, []);
      assert.deepEqual(await service.list(otherContext), {
        bindings: [],
        authorizations: [],
        records: [],
      });

      const input = {
        bindingId: relationshipId,
        recipient: "pickup-alpha",
        type: "TEMPORARY",
        startDate: "2026-10-25",
        endDate: "2026-10-25",
        startTime: "09:00",
        endTime: "17:00",
      };
      const draft = await service.create(context, input);
      assert.equal(draft.status, "DRAFT");
      assert.equal(draft.version, 1);
      assert.equal(draft.studentLabel, "模拟学生甲");
      await assert.rejects(service.create(context, { ...input, actorId: otherGuardianUserId }), {
        statusCode: 400,
      });
      await assert.rejects(
        service.create(context, { ...input, endDate: "2027-01-25", type: "REGULAR" }),
        { statusCode: 400 },
      );
      await assert.rejects(service.create(context, { ...input, endDate: "2026-10-26" }), {
        statusCode: 400,
      });
      await assert.rejects(service.activate(otherContext, draft.id, { version: 1 }), {
        statusCode: 404,
      });

      const active = await service.activate(context, draft.id, { version: 1 });
      assert.equal(active.status, "ACTIVE");
      assert.equal(active.version, 2);
      assert.equal(active.currentlyValid, true);
      await assert.rejects(service.activate(context, draft.id, { version: 1 }), {
        statusCode: 409,
      });

      await prisma.$disconnect();
      prisma = client(isolatedUrl.href);
      await prisma.$connect();
      const restarted = new PrismaParentPickupService(prisma, () => new Date(now));
      const persisted = await restarted.list(context);
      assert.equal(persisted.authorizations[0]?.id, draft.id);
      assert.equal(persisted.authorizations[0]?.status, "ACTIVE");

      const attendanceRecordId = randomUUID();
      await prisma.attendanceRecord.create({
        data: {
          tenantId,
          campusId,
          id: attendanceRecordId,
          studentId,
          classRef: "模拟三年级一班",
          serviceDate: new Date("2026-10-25T00:00:00.000Z"),
          status: "ARRIVED",
          arrivalTime: "09:00",
          recordedByMembershipId: staffMembershipId,
          updatedByMembershipId: staffMembershipId,
        },
      });
      const correctionId = randomUUID();
      await prisma.attendanceCorrection.create({
        data: {
          tenantId,
          campusId,
          id: correctionId,
          attendanceRecordId,
          studentId,
          serviceDate: new Date("2026-10-25T00:00:00.000Z"),
          requestedByMembershipId: staffMembershipId,
          reason: "EVENT_ENTRY_ERROR",
          status: "PENDING",
          originalStatus: "ARRIVED",
          originalArrivalTime: "09:00",
          proposedStatus: "ARRIVED",
          proposedArrivalTime: "08:55",
          requestVersion: 1,
        },
      });
      type CredentialOperations = {
        issueCredential(
          actor: typeof context,
          authorizationId: string,
          value: unknown,
        ): Promise<{ credential: string; expiresAt: string }>;
        previewCredential(
          actor: { tenantId: string; campusId: string; actorId: string; capabilities: string[] },
          value: unknown,
        ): Promise<Record<string, unknown>>;
        confirmCredential(
          actor: { tenantId: string; campusId: string; actorId: string; capabilities: string[] },
          value: unknown,
        ): Promise<{ id: string; status: string }>;
      };
      const credentials = restarted as unknown as CredentialOperations;
      const staffContext = {
        tenantId,
        campusId,
        actorId: staffUserId,
        capabilities: ["attendance:write"],
      };
      await assert.rejects(credentials.issueCredential(context, draft.id, { version: 1 }), {
        statusCode: 409,
      });
      const first = await credentials.issueCredential(context, draft.id, { version: 2 });
      assert.equal(first.credential.length, 43);
      assert.equal(first.expiresAt, "2026-10-25T01:05:00.000Z");
      await assert.rejects(credentials.previewCredential(staffContext, { credential: "invalid" }), {
        statusCode: 400,
      });
      const credentialStore = (
        prisma as unknown as {
          pickupCredential: {
            findMany(args: unknown): Promise<
              {
                credentialHash: string;
                invalidatedAt: Date | null;
                consumedAt: Date | null;
              }[]
            >;
          };
        }
      ).pickupCredential;
      let storedCredentials = await credentialStore.findMany({
        where: { tenantId, campusId, authorizationId: draft.id },
      });
      assert.equal(
        storedCredentials.some((row) => row.credentialHash === first.credential),
        false,
      );
      assert.equal(
        storedCredentials.find((row) => row.invalidatedAt === null)?.credentialHash,
        createHash("sha256").update(first.credential).digest("hex"),
      );

      now.setTime(now.getTime() + 6 * 60 * 1000);
      await assert.rejects(
        credentials.previewCredential(staffContext, { credential: first.credential }),
        { statusCode: 409 },
      );
      const second = await credentials.issueCredential(context, draft.id, { version: 2 });
      await assert.rejects(
        credentials.previewCredential(staffContext, { credential: second.credential }),
        { statusCode: 409 },
      );
      await prisma.attendanceCorrection.updateMany({
        where: { tenantId, campusId, id: correctionId, status: "PENDING" },
        data: {
          status: "RETURNED",
          reviewedByMembershipId: staffMembershipId,
          reviewedAt: now,
          updatedAt: now,
        },
      });
      storedCredentials = await credentialStore.findMany({
        where: { tenantId, campusId, authorizationId: draft.id },
      });
      const firstStored = storedCredentials.find(
        (row) => row.credentialHash === createHash("sha256").update(first.credential).digest("hex"),
      );
      assert.ok(firstStored?.invalidatedAt);
      await assert.rejects(
        credentials.previewCredential(
          { ...staffContext, campusId: otherCampusId },
          { credential: second.credential },
        ),
        { statusCode: 403 },
      );
      const preview = await credentials.previewCredential(staffContext, {
        credential: second.credential,
      });
      assert.deepEqual(Object.keys(preview).sort(), [
        "classLabel",
        "recipientLabel",
        "studentLabel",
      ]);
      assert.deepEqual(preview, {
        studentLabel: "模拟学生甲",
        classLabel: "模拟三年级一班",
        recipientLabel: "示例接送人甲",
      });

      const checks = { student: true, recipient: true, authorization: true };
      await assert.rejects(
        credentials.confirmCredential(staffContext, {
          credential: second.credential,
          checks: { ...checks, recipient: false },
        }),
        { statusCode: 400 },
      );
      const concurrent = await Promise.allSettled([
        credentials.confirmCredential(staffContext, { credential: second.credential, checks }),
        credentials.confirmCredential(staffContext, { credential: second.credential, checks }),
      ]);
      assert.equal(concurrent.filter((result) => result.status === "fulfilled").length, 1);
      const completed = concurrent.find((result) => result.status === "fulfilled");
      assert.equal(
        completed?.status === "fulfilled" ? completed.value.status : undefined,
        "COMPLETED",
      );
      await assert.rejects(
        credentials.confirmCredential(staffContext, { credential: second.credential, checks }),
        { statusCode: 409 },
      );
      const departed = await prisma.attendanceRecord.findUniqueOrThrow({
        where: { tenantId_campusId_id: { tenantId, campusId, id: attendanceRecordId } },
      });
      assert.equal(departed.status, "DEPARTED");
      assert.equal(departed.version, 2);
      assert.equal(
        await prisma.attendanceRecordRevision.count({
          where: { tenantId, campusId, attendanceRecordId, version: 2, action: "DEPARTED" },
        }),
        1,
      );
      assert.equal(
        await prisma.pickupRecord.count({
          where: { tenantId, campusId, authorizationId: draft.id, studentId },
        }),
        1,
      );
      storedCredentials = await credentialStore.findMany({
        where: { tenantId, campusId, authorizationId: draft.id },
      });
      assert.equal(storedCredentials.filter((row) => row.consumedAt !== null).length, 1);

      const revoked = await restarted.revoke(context, draft.id, { version: 2 });
      assert.equal(revoked.status, "REVOKED");
      assert.equal(revoked.version, 3);
      await assert.rejects(restarted.revoke(context, draft.id, { version: 2 }), {
        statusCode: 409,
      });
      assert.equal((await restarted.list(otherContext)).authorizations.length, 0);
    } finally {
      await prisma?.$disconnect();
      if (databaseCreated)
        await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
      await admin.$disconnect();
    }
  },
);
