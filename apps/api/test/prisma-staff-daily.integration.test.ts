import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import test from "node:test";
import type { TrustedAuthResult } from "@student-care/auth";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaStaffDailyService } from "../src/modules/staff-daily/prisma-staff-daily.service.js";
import { createApiApp } from "../src/nest/api-app.js";
import type { ApiHttpRequest } from "../src/nest/api-tokens.js";
import { listenOnFetchSafePort } from "./support/fetch-safe-port.js";

const databaseUrl = process.env.DATABASE_URL;
const values = {
  arrival: "ARRIVED_AS_PLANNED",
  homework: "COMPLETED",
  activity: "PARTICIPATED",
  classroom: "ROUTINE",
  followUp: "NONE",
} as const;

function createClient(): PrismaClient {
  if (databaseUrl === undefined) throw new Error("DATABASE_URL is required for this test.");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
}

function trustedAuth(
  actorId: string,
  campusId: string,
  tenantId: string,
  capabilities: TrustedAuthResult["memberships"][number]["capabilities"],
): TrustedAuthResult {
  return {
    trusted: true,
    session: {
      trusted: true,
      status: "ACTIVE",
      actor_id: actorId,
      expires_at: "2099-01-01T00:00:00.000Z",
    },
    identity: { actor_id: actorId, display_name: "合成员工" },
    memberships: [{ tenant_id: tenantId, campus_ids: [campusId], status: "ACTIVE", capabilities }],
  };
}

async function startApi(
  prisma: PrismaClient,
  sessions: Readonly<Record<string, TrustedAuthResult>>,
): Promise<{ readonly baseUrl: string; close(): Promise<void> }> {
  const app = await createApiApp({
    staffDailyOperations: new PrismaStaffDailyService(
      prisma,
      new Map(
        Object.values(sessions).map((session) => [
          session.identity.actor_id,
          session.identity.display_name,
        ]),
      ),
    ),
    getTrustedAuthResult: (request: ApiHttpRequest) => {
      const authorization = request.headers.authorization;
      if (typeof authorization !== "string") return undefined;
      const token = /^Bearer ([a-z-]+)$/u.exec(authorization)?.[1];
      return token === undefined ? undefined : sessions[token];
    },
  });
  await listenOnFetchSafePort((port) => app.listen(port, "127.0.0.1"));
  const address = app.getHttpServer().address() as AddressInfo | null;
  if (address === null) throw new Error("Synthetic API did not bind to loopback.");
  return { baseUrl: `http://127.0.0.1:${address.port}`, close: () => app.close() };
}

async function requestJson(
  baseUrl: string,
  path: string,
  token: string,
  method: "GET" | "POST" | "PATCH" = "GET",
  body?: unknown,
): Promise<{ readonly status: number; readonly body: Record<string, unknown> }> {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return {
    status: response.status,
    body: (await response.json()) as Record<string, unknown>,
  };
}

test(
  "staff daily reports persist transitions and remain restricted to database class assignments",
  { skip: databaseUrl === undefined },
  async () => {
    const parsedUrl = new URL(databaseUrl!);
    assert.equal(parsedUrl.hostname, "127.0.0.1");
    assert.equal(parsedUrl.port, "55434");

    const tenantId = randomUUID();
    const otherTenantId = randomUUID();
    const campusId = randomUUID();
    const otherCampusId = randomUUID();
    const otherTenantCampusId = randomUUID();
    const writerId = randomUUID();
    const reviewerId = randomUUID();
    const reviewerMembershipId = randomUUID();
    const otherClassId = randomUUID();
    const otherCampusStaffId = randomUUID();
    const otherTenantStaffId = randomUUID();
    const writerMembershipId = randomUUID();
    const otherClassMembershipId = randomUUID();
    const otherCampusMembershipId = randomUUID();
    const otherTenantMembershipId = randomUUID();
    const reportDate = "2026-10-19";
    const sessions: Readonly<Record<string, TrustedAuthResult>> = {
      writer: trustedAuth(writerId, campusId, tenantId, [
        "daily:read",
        "daily:create",
        "daily:submit",
      ]),
      reviewer: trustedAuth(reviewerId, campusId, tenantId, ["daily:review"]),
      selfreview: trustedAuth(writerId, campusId, tenantId, ["daily:review"]),
      otherclass: trustedAuth(otherClassId, campusId, tenantId, [
        "daily:read",
        "daily:create",
        "daily:submit",
        "daily:review",
      ]),
      othercampus: trustedAuth(otherCampusStaffId, otherCampusId, tenantId, [
        "daily:read",
        "daily:create",
        "daily:submit",
        "daily:review",
      ]),
      othertenant: trustedAuth(otherTenantStaffId, otherTenantCampusId, otherTenantId, [
        "daily:read",
        "daily:create",
        "daily:submit",
        "daily:review",
      ]),
    };
    let prisma = createClient();
    let connected = false;
    let api: Awaited<ReturnType<typeof startApi>> | undefined;
    let restartedApi: Awaited<ReturnType<typeof startApi>> | undefined;
    let restartedPrisma: PrismaClient | undefined;

    try {
      await prisma.$connect();
      connected = true;
      await prisma.tenant.createMany({
        data: [
          { id: tenantId, name: "合成机构甲", slug: `synthetic-${tenantId}`, status: "ACTIVE" },
          {
            id: otherTenantId,
            name: "合成机构乙",
            slug: `synthetic-${otherTenantId}`,
            status: "ACTIVE",
          },
        ],
      });
      await prisma.campus.createMany({
        data: [
          { id: campusId, tenantId, name: "合成东校区", status: "ACTIVE" },
          { id: otherCampusId, tenantId, name: "合成西校区", status: "ACTIVE" },
          {
            id: otherTenantCampusId,
            tenantId: otherTenantId,
            name: "合成外部校区",
            status: "ACTIVE",
          },
        ],
      });
      await prisma.user.createMany({
        data: [writerId, reviewerId, otherClassId, otherCampusStaffId, otherTenantStaffId].map(
          (id) => ({
            id,
            status: "ACTIVE",
          }),
        ),
      });
      await prisma.membership.createMany({
        data: [
          { id: writerMembershipId, tenantId, userId: writerId, status: "ACTIVE" },
          { id: reviewerMembershipId, tenantId, userId: reviewerId, status: "ACTIVE" },
          { id: otherClassMembershipId, tenantId, userId: otherClassId, status: "ACTIVE" },
          { id: otherCampusMembershipId, tenantId, userId: otherCampusStaffId, status: "ACTIVE" },
          {
            id: otherTenantMembershipId,
            tenantId: otherTenantId,
            userId: otherTenantStaffId,
            status: "ACTIVE",
          },
        ],
      });
      await prisma.membershipCampus.createMany({
        data: [
          { tenantId, membershipId: writerMembershipId, campusId },
          { tenantId, membershipId: reviewerMembershipId, campusId },
          { tenantId, membershipId: otherClassMembershipId, campusId },
          { tenantId, membershipId: otherCampusMembershipId, campusId: otherCampusId },
          {
            tenantId: otherTenantId,
            membershipId: otherTenantMembershipId,
            campusId: otherTenantCampusId,
          },
        ],
      });
      await prisma.membershipClass.createMany({
        data: [
          { tenantId, membershipId: writerMembershipId, campusId, classRef: "class-synthetic-a" },
          { tenantId, membershipId: reviewerMembershipId, campusId, classRef: "class-synthetic-a" },
          {
            tenantId,
            membershipId: otherClassMembershipId,
            campusId,
            classRef: "class-synthetic-b",
          },
          {
            tenantId,
            membershipId: otherCampusMembershipId,
            campusId: otherCampusId,
            classRef: "class-synthetic-a",
          },
          {
            tenantId: otherTenantId,
            membershipId: otherTenantMembershipId,
            campusId: otherTenantCampusId,
            classRef: "class-synthetic-a",
          },
        ],
      });

      const sourceTask = await prisma.workTask.create({
        data: {
          tenantId,
          campusId,
          classRef: "class-synthetic-a",
          code: "DAILY_CHECK",
          targetType: "CLASS",
          targetRef: "class-synthetic-a",
          dueDate: new Date(`${reportDate}T00:00:00.000Z`),
          priority: "NORMAL",
          status: "CHECKED",
          version: 2,
          createdByMembershipId: reviewerMembershipId,
          assigneeMembershipId: writerMembershipId,
          checkedByMembershipId: reviewerMembershipId,
          updatedByMembershipId: reviewerMembershipId,
        },
      });
      api = await startApi(prisma, sessions);
      const created = await requestJson(api.baseUrl, "/staff/daily-reports", "writer", "POST", {
        date: reportDate,
        values,
      });
      assert.equal(created.status, 201, JSON.stringify(created.body));
      const createdData = created.body.data as { id: string; version: number; status: string };
      assert.equal(createdData.version, 1);
      assert.equal(createdData.status, "DRAFT");
      const recordsOf = (body: Record<string, unknown>) =>
        (
          body.data as {
            records: {
              id: string;
              status: string;
              version: number;
              actions: string[];
              authorLabel: string;
            }[];
          }
        ).records;
      const queue = (token = "reviewer") =>
        requestJson(api!.baseUrl, "/admin/daily-reports", token);
      const review = (version: number, action: string, token = "reviewer") =>
        requestJson(api!.baseUrl, `/admin/daily-reports/${createdData.id}/review`, token, "POST", {
          version,
          action,
        });
      assert.deepEqual(recordsOf((await queue()).body), [], "unsubmitted drafts stay private");
      assert.equal((await review(1, "CONFIRM")).status, 409);
      assert.equal((await queue("writer")).status, 403);
      assert.equal((await queue("unknown")).status, 401);

      const duplicate = await requestJson(api.baseUrl, "/staff/daily-reports", "writer", "POST", {
        date: reportDate,
        values,
      });
      assert.equal(duplicate.status, 409);

      const edited = await requestJson(
        api.baseUrl,
        `/staff/daily-reports/${createdData.id}`,
        "writer",
        "PATCH",
        { version: 1, values: { ...values, followUp: "OBSERVE_TOMORROW" } },
      );
      assert.equal(edited.status, 200);
      assert.equal((edited.body.data as { version: number }).version, 2);

      const submitted = await requestJson(
        api.baseUrl,
        `/staff/daily-reports/${createdData.id}/submit`,
        "writer",
        "POST",
        { version: 2 },
      );
      assert.equal(submitted.status, 200);
      assert.equal((submitted.body.data as { status: string }).status, "SUBMITTED");
      const submittedQueue = await queue();
      assert.equal(submittedQueue.status, 200);
      assert.equal(recordsOf(submittedQueue.body)[0]?.id, createdData.id);
      assert.equal(recordsOf(submittedQueue.body)[0]?.authorLabel, "合成员工");
      assert.deepEqual(recordsOf(submittedQueue.body)[0]?.actions, ["confirm", "return"]);
      assert.doesNotMatch(
        JSON.stringify(submittedQueue.body),
        /tenantId|campusId|classRef|MembershipId|sourceRefs|createdBy/,
      );
      assert.equal((await review(3, "CONFIRM", "writer")).status, 403);
      for (const token of ["selfreview", "otherclass", "othercampus", "othertenant"]) {
        assert.deepEqual(recordsOf((await queue(token)).body), []);
        assert.equal((await review(3, "CONFIRM", token)).status, 404);
      }
      // A replacement membership must not turn the author's own old report into another person's report.
      const replacementMembershipId = randomUUID();
      await prisma.membership.updateMany({
        where: { tenantId, id: writerMembershipId },
        data: { status: "SUSPENDED" },
      });
      await prisma.membership.create({
        data: { id: replacementMembershipId, tenantId, userId: writerId, status: "ACTIVE" },
      });
      await prisma.membershipCampus.create({
        data: { tenantId, campusId, membershipId: replacementMembershipId },
      });
      await prisma.membershipClass.create({
        data: {
          tenantId,
          campusId,
          membershipId: replacementMembershipId,
          classRef: "class-synthetic-a",
        },
      });
      assert.deepEqual(recordsOf((await queue("selfreview")).body), []);
      assert.equal((await review(3, "CONFIRM", "selfreview")).status, 404);
      await prisma.membership.updateMany({
        where: { tenantId, id: replacementMembershipId },
        data: { status: "SUSPENDED" },
      });
      await prisma.membership.updateMany({
        where: { tenantId, id: writerMembershipId },
        data: { status: "ACTIVE" },
      });
      for (const body of [
        { version: 3, action: "PUBLISH" },
        { version: 0, action: "CONFIRM" },
        { version: 3.5, action: "RETURN" },
        { version: 3, action: "CONFIRM", tenantId },
      ]) {
        assert.equal(
          (
            await requestJson(
              api.baseUrl,
              `/admin/daily-reports/${createdData.id}/review`,
              "reviewer",
              "POST",
              body,
            )
          ).status,
          400,
        );
      }
      assert.equal(
        (await requestJson(api.baseUrl, "/admin/daily-reports?campusId=forged", "reviewer")).status,
        400,
      );
      assert.equal(
        (await requestJson(api.baseUrl, "/admin/daily-reports?page=1", "reviewer")).status,
        400,
      );
      assert.equal(
        (
          await requestJson(
            api.baseUrl,
            "/admin/daily-reports/not-a-uuid/review",
            "reviewer",
            "POST",
            { version: 3, action: "CONFIRM" },
          )
        ).status,
        400,
      );
      assert.equal(
        (
          await fetch(`${api.baseUrl}/admin/daily-reports`, {
            headers: { authorization: "Bearer reviewer", "x-campus-id": campusId },
          })
        ).status,
        400,
      );

      const staleEdit = await requestJson(
        api.baseUrl,
        `/staff/daily-reports/${createdData.id}`,
        "writer",
        "PATCH",
        { version: 2, values },
      );
      assert.equal(staleEdit.status, 409);

      for (const token of ["otherclass", "othercampus", "othertenant"]) {
        const foreignEdit = await requestJson(
          api.baseUrl,
          `/staff/daily-reports/${createdData.id}`,
          token,
          "PATCH",
          { version: 3, values },
        );
        assert.equal(foreignEdit.status, 404);
      }

      await api.close();
      api = undefined;
      await prisma.$disconnect();
      connected = false;
      restartedPrisma = createClient();
      await restartedPrisma.$connect();
      restartedApi = await startApi(restartedPrisma, sessions);
      const afterReconnect = await requestJson(
        restartedApi.baseUrl,
        "/staff/daily-reports",
        "writer",
      );
      assert.equal(afterReconnect.status, 200);
      const reports = (
        afterReconnect.body.data as { records: { id: string; status: string; version: number }[] }
      ).records;
      const persisted = reports.find((record) => record.id === createdData.id);
      assert.deepEqual(
        { id: persisted?.id, status: persisted?.status, version: persisted?.version },
        { id: createdData.id, status: "SUBMITTED", version: 3 },
      );

      await restartedApi.close();
      restartedApi = undefined;
      await restartedPrisma.$disconnect();
      restartedPrisma = undefined;

      prisma = createClient();
      await prisma.$connect();
      connected = true;
      api = await startApi(prisma, sessions);
      assert.equal((await review(3, "RETURN")).status, 200);
      assert.equal((await review(3, "CONFIRM")).status, 409);
      const resubmitted = await requestJson(
        api.baseUrl,
        `/staff/daily-reports/${createdData.id}/resubmit`,
        "writer",
        "POST",
        { version: 4, values },
      );
      assert.equal(resubmitted.status, 200);
      assert.equal(
        (resubmitted.body.data as { status: string; version: number }).status,
        "SUBMITTED",
      );
      assert.equal((resubmitted.body.data as { status: string; version: number }).version, 5);

      const sourceBefore = await prisma.staffDailyReport.findFirstOrThrow({
        where: { tenantId, campusId, id: createdData.id },
        include: {
          workTaskSources: true,
          attendanceSources: true,
          careRecordSources: true,
          pickupRecordSources: true,
          pickupExceptionSources: true,
        },
      });
      const concurrent = await Promise.all([review(5, "CONFIRM"), review(5, "CONFIRM")]);
      assert.equal(sourceBefore.workTaskSources.length, 1);
      assert.equal(sourceBefore.workTaskSources[0]?.sourceId, sourceTask.id);
      assert.equal(sourceBefore.workTaskSources[0]?.sourceVersion, 2);
      assert.deepEqual(concurrent.map((row) => row.status).sort(), [200, 409]);
      const stored = await prisma.staffDailyReport.findFirstOrThrow({
        where: { tenantId, campusId, id: createdData.id },
        include: {
          workTaskSources: true,
          attendanceSources: true,
          careRecordSources: true,
          pickupRecordSources: true,
          pickupExceptionSources: true,
        },
      });
      assert.equal(stored.status, "CONFIRMED");
      assert.equal(stored.version, 6);
      assert.equal(stored.reviewedByMembershipId, reviewerMembershipId);
      assert.equal(stored.updatedByMembershipId, reviewerMembershipId);
      for (const key of [
        "workTaskSources",
        "attendanceSources",
        "careRecordSources",
        "pickupRecordSources",
        "pickupExceptionSources",
      ] as const)
        assert.deepEqual(stored[key], sourceBefore[key]);
      assert.deepEqual(recordsOf((await queue()).body)[0]?.actions, ["return", "withdraw"]);
      assert.equal((await review(6, "CONFIRM")).status, 409);
      assert.equal((await review(6, "RETURN")).status, 200, "confirmed reports can be returned");
      assert.equal(
        (
          await requestJson(
            api.baseUrl,
            `/staff/daily-reports/${createdData.id}/resubmit`,
            "writer",
            "POST",
            { version: 7, values },
          )
        ).status,
        200,
      );
      assert.equal((await review(8, "CONFIRM")).status, 200);

      // A still-valid trusted session cannot bypass the database membership state.
      await prisma.membership.updateMany({
        where: { tenantId, id: reviewerMembershipId },
        data: { status: "SUSPENDED" },
      });
      assert.equal((await queue()).status, 403);
      assert.equal((await review(9, "RETURN")).status, 403);
      await prisma.membership.updateMany({
        where: { tenantId, id: reviewerMembershipId },
        data: { status: "ACTIVE" },
      });
      for (const target of ["user", "campus", "tenant"] as const) {
        if (target === "user")
          await prisma.user.update({ where: { id: reviewerId }, data: { status: "SUSPENDED" } });
        if (target === "campus")
          await prisma.campus.updateMany({
            where: { id: campusId, tenantId },
            data: { status: "SUSPENDED" },
          });
        if (target === "tenant")
          await prisma.tenant.update({ where: { id: tenantId }, data: { status: "SUSPENDED" } });
        assert.equal((await queue()).status, 403, `inactive ${target} cannot review`);
        assert.equal((await review(9, "RETURN")).status, 403);
        if (target === "user")
          await prisma.user.update({ where: { id: reviewerId }, data: { status: "ACTIVE" } });
        if (target === "campus")
          await prisma.campus.updateMany({
            where: { id: campusId, tenantId },
            data: { status: "ACTIVE" },
          });
        if (target === "tenant")
          await prisma.tenant.update({ where: { id: tenantId }, data: { status: "ACTIVE" } });
      }
      await prisma.membershipClass.deleteMany({
        where: { tenantId, campusId, membershipId: reviewerMembershipId },
      });
      assert.deepEqual(recordsOf((await queue()).body), []);
      assert.equal((await review(9, "RETURN")).status, 404);
      await prisma.membershipClass.create({
        data: {
          tenantId,
          campusId,
          membershipId: reviewerMembershipId,
          classRef: "class-synthetic-a",
        },
      });
      const withdrawn = await requestJson(
        api.baseUrl,
        `/admin/daily-reports/${createdData.id}/withdraw`,
        "reviewer",
        "POST",
        { version: 9 },
      );
      assert.equal(withdrawn.status, 200);
      assert.equal((withdrawn.body.data as { status: string }).status, "RETURNED");
      assert.equal(
        (
          await requestJson(
            api.baseUrl,
            `/admin/daily-reports/${createdData.id}/withdraw`,
            "reviewer",
            "POST",
            { version: 10 },
          )
        ).status,
        409,
      );

      const auditPath = `/admin/daily-reports/${createdData.id}/audit-events`;
      const auditResponse = await requestJson(api.baseUrl, auditPath, "reviewer");
      assert.equal(auditResponse.status, 200);
      const auditEvents = (
        auditResponse.body.data as {
          events: readonly {
            action: string;
            reportVersion: number;
            actorLabel: string | null;
            initiatedByLabel: string;
            occurredAt: string;
          }[];
        }
      ).events;
      assert.deepEqual(
        auditEvents.map(({ action, reportVersion }) => [action, reportVersion]),
        [
          ["CREATED", 1],
          ["EDITED", 2],
          ["SUBMITTED", 3],
          ["REVIEW_RETURNED", 4],
          ["RESUBMITTED", 5],
          ["REVIEW_CONFIRMED", 6],
          ["REVIEW_RETURNED", 7],
          ["RESUBMITTED", 8],
          ["REVIEW_CONFIRMED", 9],
          ["CONFIRMATION_WITHDRAWN", 10],
        ],
      );
      assert.ok(auditEvents.every((event) => event.actorLabel && event.initiatedByLabel));
      assert.ok(auditEvents.every((event) => Number.isFinite(Date.parse(event.occurredAt))));
      assert.doesNotMatch(
        JSON.stringify(auditResponse.body),
        /tenantId|campusId|MembershipId|studentId|sourceRefs|createdBy/,
      );
      assert.equal((await requestJson(api.baseUrl, auditPath, "writer")).status, 403);
      for (const token of ["selfreview", "otherclass", "othercampus", "othertenant"])
        assert.equal((await requestJson(api.baseUrl, auditPath, token)).status, 404);
      assert.equal(
        (await requestJson(api.baseUrl, auditPath + "?campusId=forged", "reviewer")).status,
        400,
      );

      const auditRows = await prisma.staffDailyReportAuditEvent.findMany({
        where: { tenantId, campusId, reportId: createdData.id },
        orderBy: { reportVersion: "asc" },
      });
      assert.equal(auditRows.length, 10, "conflicts must not create successful audit events");
      await assert.rejects(
        prisma.$executeRaw`UPDATE "staff_daily_report_audit_events"
          SET "report_version" = 11
          WHERE "tenant_id" = ${tenantId}::uuid AND "campus_id" = ${campusId}::uuid
            AND "report_id" = ${createdData.id}::uuid`,
        /staff daily report audit events are append-only/u,
      );
      await assert.rejects(
        prisma.$executeRaw`DELETE FROM "staff_daily_report_audit_events"
          WHERE "tenant_id" = ${tenantId}::uuid AND "campus_id" = ${campusId}::uuid
            AND "report_id" = ${createdData.id}::uuid`,
        /staff daily report audit events are append-only/u,
      );
      await assert.rejects(
        prisma.$executeRaw`TRUNCATE TABLE "staff_daily_report_audit_events"`,
        /staff daily report audit events are append-only/u,
      );

      await api.close();
      api = undefined;
      await prisma.$disconnect();
      connected = false;
      restartedPrisma = createClient();
      await restartedPrisma.$connect();
      restartedApi = await startApi(restartedPrisma, sessions);
      const finalReport = recordsOf(
        (await requestJson(restartedApi.baseUrl, "/staff/daily-reports", "writer")).body,
      ).find((row) => row.id === createdData.id);
      assert.deepEqual(
        {
          status: finalReport?.status,
          version: finalReport?.version,
          actions: finalReport?.actions,
        },
        { status: "RETURNED", version: 10, actions: ["resubmit"] },
      );
    } finally {
      if (api) await api.close();
      if (restartedApi) await restartedApi.close();
      if (connected) await prisma.$disconnect();
      if (restartedPrisma) await restartedPrisma.$disconnect();
    }
  },
);
