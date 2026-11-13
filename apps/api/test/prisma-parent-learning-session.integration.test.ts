import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaParentLearningSessionService } from "../src/modules/learning/prisma-parent-learning-session.service.js";

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

test(
  "parent learning fixed sessions persist, scope access, enforce current consent and controls, expire, and reject stale writes",
  { skip: adminDatabaseUrl === undefined },
  async () => {
    const baseUrl = new URL(adminDatabaseUrl!);
    assert.equal(baseUrl.hostname, "127.0.0.1");
    assert.equal(baseUrl.port, "55432");
    const databaseName = `student_care_a1315_${randomUUID().replaceAll("-", "")}`;
    const isolatedUrl = new URL(baseUrl);
    isolatedUrl.pathname = `/${databaseName}`;
    const admin = client(baseUrl.href);
    let databaseCreated = false;
    let prisma: PrismaClient | undefined;
    let reopened: PrismaClient | undefined;
    try {
      await admin.$connect();
      await admin.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
      databaseCreated = true;
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
            cwd: apiDirectory(),
            env: { ...process.env, DATABASE_URL: isolatedUrl.href },
            stdio: "pipe",
          },
        );
      } catch {
        throw new Error(
          "Prisma migrations could not be applied to the newly created local test database.",
        );
      }

      prisma = client(isolatedUrl.href);
      await prisma.$connect();
      const tenantId = randomUUID();
      const campusId = randomUUID();
      const studentId = randomUUID();
      const guardianUserId = randomUUID();
      const approverUserId = randomUUID();
      const approverMembershipId = randomUUID();
      const otherGuardianId = randomUUID();
      const bindingApplicationId = randomUUID();
      const relationshipId = randomUUID();
      const consentId = randomUUID();
      const startedAt = new Date("2026-10-24T09:00:00.000Z");
      let clock = new Date(startedAt);
      const context = {
        tenantId,
        campusId,
        actorId: guardianUserId,
        capabilities: ["binding:read"],
      };

      await prisma.tenant.create({
        data: {
          id: tenantId,
          name: "合成学习练习机构",
          slug: `learning-${tenantId}`,
          status: "ACTIVE",
        },
      });
      await prisma.campus.create({
        data: { tenantId, id: campusId, name: "合成东校区", status: "ACTIVE" },
      });
      await prisma.user.createMany({
        data: [guardianUserId, approverUserId, otherGuardianId].map((id) => ({
          id,
          status: "ACTIVE",
        })),
      });
      await prisma.membership.create({
        data: { id: approverMembershipId, tenantId, userId: approverUserId, status: "ACTIVE" },
      });
      await prisma.membershipCampus.create({
        data: { tenantId, campusId, membershipId: approverMembershipId },
      });
      await prisma.student.create({
        data: {
          tenantId,
          campusId,
          id: studentId,
          classRef: "合成三年级一班",
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
          reviewedByMembershipId: approverMembershipId,
          reviewedAt: startedAt,
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
          approvedByMembershipId: approverMembershipId,
          approvedAt: startedAt,
        },
      });
      await prisma.guardianConsent.create({
        data: {
          tenantId,
          campusId,
          id: consentId,
          guardianRelationshipId: relationshipId,
          studentId,
          guardianUserId,
          scope: "LEARNING_SUPPORT",
          consentVersion: "LEARNING_DEMO_V2",
          noticeVersion: "LEARNING_SUPPORT_NOTICE_V1",
          policyVersion: "AI_LEARNING_POLICY_SYNTHETIC_V1",
          status: "ACTIVE",
          version: 1,
          confirmedAt: startedAt,
        },
      });
      await prisma.aIInstitutionSetting.create({
        data: {
          tenantId,
          campusId,
          enabled: true,
          version: 1,
          updatedByMembershipId: approverMembershipId,
        },
      });
      await prisma.parentLearningControl.create({
        data: {
          tenantId,
          campusId,
          guardianRelationshipId: relationshipId,
          studentId,
          guardianUserId,
          enabled: true,
          maxDurationMinutes: 10,
          maxHintLevel: 2,
        },
      });

      const firstService = new PrismaParentLearningSessionService(prisma, () => new Date(clock));
      const created = await firstService.createSession(context, studentId, {
        questionId: "math-grade-3-addition-01",
        consentVersion: "LEARNING_DEMO_V2",
        durationMinutes: 5,
      });
      assert.equal(created.status, "ACTIVE");
      assert.equal(created.studentLabel, "模拟学生甲");
      await assert.rejects(
        firstService.createSession(context, studentId, {
          questionId: "math-grade-3-addition-01",
          consentVersion: "LEARNING_DEMO_V2",
          durationMinutes: 15,
        }),
        { statusCode: 403 },
      );
      await assert.rejects(
        firstService.getSession({ ...context, actorId: otherGuardianId }, created.id),
        { statusCode: 404 },
      );
      await assert.rejects(
        firstService.getSession({ ...context, tenantId: randomUUID() }, created.id),
        { statusCode: 404 },
      );

      await prisma.$disconnect();
      reopened = client(isolatedUrl.href);
      await reopened.$connect();
      const restartedService = new PrismaParentLearningSessionService(
        reopened,
        () => new Date(clock),
      );
      assert.equal((await restartedService.getSession(context, created.id)).mainAttempts, 0);

      const attempts = await Promise.allSettled([
        restartedService.answerSession(context, created.id, {
          itemId: "main",
          choice: "A",
          expectedVersion: created.version,
        }),
        restartedService.answerSession(context, created.id, {
          itemId: "main",
          choice: "A",
          expectedVersion: created.version,
        }),
      ]);
      assert.equal(attempts.filter((attempt) => attempt.status === "fulfilled").length, 1);
      assert.equal(attempts.filter((attempt) => attempt.status === "rejected").length, 1);
      const afterAnswer = await restartedService.getSession(context, created.id);
      assert.equal(afterAnswer.mainAttempts, 1);
      assert.equal(afterAnswer.version, 2);
      const afterHint = await restartedService.hintSession(context, created.id, {
        level: 0,
        expectedVersion: 2,
      });
      assert.equal(afterHint.visibleHint?.level, 0);

      clock = new Date(created.endsAt);
      const expired = await restartedService.getSession(context, created.id);
      assert.equal(expired.status, "EXPIRED");
      const stored = await reopened.parentLearningSession.findFirstOrThrow({
        where: { tenantId, campusId, id: created.id },
      });
      assert.equal(stored.status, "EXPIRED");
      assert.equal(stored.consentId, consentId);
      assert.equal(stored.needsTeacherFollowUp, false);

      await reopened.aIInstitutionSetting.update({
        where: { tenantId_campusId: { tenantId, campusId } },
        data: { enabled: false, version: { increment: 1 } },
      });
      await assert.rejects(restartedService.listSessions(context, studentId), { statusCode: 403 });
      await reopened.guardianConsent.update({
        where: { tenantId_campusId_id: { tenantId, campusId, id: consentId } },
        data: { status: "REVOKED", withdrawnAt: clock, version: { increment: 1 } },
      });
      await assert.rejects(restartedService.getSession(context, created.id), { statusCode: 404 });
    } finally {
      await reopened?.$disconnect();
      await prisma?.$disconnect();
      if (databaseCreated)
        await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
      await admin.$disconnect();
    }
  },
);
