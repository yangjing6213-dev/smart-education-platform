import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import test from "node:test";
import type { TrustedAuthResult } from "@student-care/auth";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaNoticeService } from "../src/modules/notices/prisma-notice.service.js";
import { createApiApp } from "../src/nest/api-app.js";
import type { ApiHttpRequest } from "../src/nest/api-tokens.js";
import { listenOnFetchSafePort } from "./support/fetch-safe-port.js";

const databaseUrl = process.env.TASK20_NOTICE_DATABASE_URL;

function isDedicatedLocalDatabase(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "postgresql:" &&
      url.hostname === "127.0.0.1" &&
      url.port === "55437" &&
      url.pathname === "/synthetic"
    );
  } catch {
    return false;
  }
}

const useDedicatedDatabase = isDedicatedLocalDatabase(databaseUrl);

function trustedAuth(
  actorId: string,
  campusId: string,
  tenantId: string,
  capabilities: readonly string[],
): TrustedAuthResult {
  return {
    trusted: true,
    session: {
      trusted: true,
      status: "ACTIVE",
      actor_id: actorId,
      expires_at: "2099-01-01T00:00:00.000Z",
    },
    identity: { actor_id: actorId, display_name: "合成通知流程参与者" },
    memberships: [
      {
        tenant_id: tenantId,
        campus_ids: [campusId],
        status: "ACTIVE",
        capabilities: capabilities as TrustedAuthResult["memberships"][number]["capabilities"],
      },
    ],
  };
}

async function startApi(
  prisma: PrismaClient,
  sessions: Readonly<Record<string, TrustedAuthResult>>,
): Promise<{ readonly baseUrl: string; close(): Promise<void> }> {
  const service = new PrismaNoticeService(prisma);
  const app = await createApiApp({
    staffNoticeOperations: service,
    parentNoticeOperations: service,
    getTrustedAuthResult: (request: ApiHttpRequest) => {
      const authorization = request.headers.authorization;
      const token =
        typeof authorization === "string"
          ? /^Bearer ([a-z-]+)$/u.exec(authorization)?.[1]
          : undefined;
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
  method: "GET" | "POST" = "GET",
  body?: unknown,
  extraHeaders: Record<string, string> = {},
): Promise<{ readonly status: number; readonly body: Record<string, unknown> }> {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...extraHeaders,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

test(
  "notice lifecycle persists and limits parent visibility to active approved relationships",
  { skip: !useDedicatedDatabase },
  async () => {
    assert.ok(databaseUrl);
    const parsed = new URL(databaseUrl);
    assert.equal(parsed.hostname, "127.0.0.1");
    assert.equal(parsed.port, "55437");
    assert.equal(parsed.pathname, "/synthetic");

    const tenantId = randomUUID();
    const campusId = randomUUID();
    const authorId = randomUUID();
    const authorMembershipId = randomUUID();
    const reviewerId = randomUUID();
    const reviewerMembershipId = randomUUID();
    const limitedReviewerId = randomUUID();
    const limitedReviewerMembershipId = randomUUID();
    const publisherWithoutRevokeId = randomUUID();
    const publisherWithoutRevokeMembershipId = randomUUID();
    const otherClassReviewerId = randomUUID();
    const otherClassReviewerMembershipId = randomUUID();
    const guardianId = randomUUID();
    const guardianMembershipId = randomUUID();
    const unboundGuardianId = randomUUID();
    const unboundGuardianMembershipId = randomUUID();
    const otherCampusId = randomUUID();
    const otherCampusStaffId = randomUUID();
    const otherCampusStaffMembershipId = randomUUID();
    const otherCampusGuardianId = randomUUID();
    const otherCampusGuardianMembershipId = randomUUID();
    const otherCampusStudentId = randomUUID();
    const otherCampusApplicationId = randomUUID();
    const otherCampusRelationshipId = randomUUID();
    const otherTenantId = randomUUID();
    const otherTenantCampusId = randomUUID();
    const otherTenantStaffId = randomUUID();
    const otherTenantStaffMembershipId = randomUUID();
    const otherTenantGuardianId = randomUUID();
    const otherTenantGuardianMembershipId = randomUUID();
    const otherTenantStudentId = randomUUID();
    const otherTenantApplicationId = randomUUID();
    const otherTenantRelationshipId = randomUUID();
    const studentId = randomUUID();
    const applicationId = randomUUID();
    const relationshipId = randomUUID();
    const sessions = {
      author: trustedAuth(authorId, campusId, tenantId, ["notice:create", "notice:submit"]),
      reviewer: trustedAuth(reviewerId, campusId, tenantId, [
        "notice:review",
        "notice:publish",
        "notice:revoke",
      ]),
      limitedreviewer: trustedAuth(limitedReviewerId, campusId, tenantId, ["notice:review"]),
      publisherwithoutrevoke: trustedAuth(publisherWithoutRevokeId, campusId, tenantId, [
        "notice:review",
        "notice:publish",
      ]),
      otherclass: trustedAuth(otherClassReviewerId, campusId, tenantId, ["notice:review"]),
      parent: trustedAuth(guardianId, campusId, tenantId, ["binding:read"]),
      unboundparent: trustedAuth(unboundGuardianId, campusId, tenantId, ["binding:read"]),
      othercampus: trustedAuth(otherCampusGuardianId, otherCampusId, tenantId, ["binding:read"]),
      othertenant: trustedAuth(otherTenantGuardianId, otherTenantCampusId, otherTenantId, [
        "binding:read",
      ]),
    } satisfies Readonly<Record<string, TrustedAuthResult>>;
    let prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
    let api: Awaited<ReturnType<typeof startApi>> | undefined;

    try {
      await prisma.$connect();
      await prisma.tenant.create({
        data: { id: tenantId, name: "合成通知机构", slug: `notice-${tenantId}`, status: "ACTIVE" },
      });
      await prisma.tenant.create({
        data: {
          id: otherTenantId,
          name: "合成隔离机构",
          slug: `notice-${otherTenantId}`,
          status: "ACTIVE",
        },
      });
      await prisma.campus.createMany({
        data: [
          { id: campusId, tenantId, name: "合成通知校区", status: "ACTIVE" },
          { id: otherCampusId, tenantId, name: "合成隔离校区", status: "ACTIVE" },
          {
            id: otherTenantCampusId,
            tenantId: otherTenantId,
            name: "合成外部机构校区",
            status: "ACTIVE",
          },
        ],
      });
      await prisma.user.createMany({
        data: [
          authorId,
          reviewerId,
          limitedReviewerId,
          publisherWithoutRevokeId,
          otherClassReviewerId,
          guardianId,
          unboundGuardianId,
          otherCampusStaffId,
          otherCampusGuardianId,
          otherTenantStaffId,
          otherTenantGuardianId,
        ].map((id) => ({ id, status: "ACTIVE" })),
      });
      await prisma.membership.createMany({
        data: [
          { id: authorMembershipId, tenantId, userId: authorId, status: "ACTIVE" },
          { id: reviewerMembershipId, tenantId, userId: reviewerId, status: "ACTIVE" },
          { id: limitedReviewerMembershipId, tenantId, userId: limitedReviewerId, status: "ACTIVE" },
          {
            id: publisherWithoutRevokeMembershipId,
            tenantId,
            userId: publisherWithoutRevokeId,
            status: "ACTIVE",
          },
          {
            id: otherClassReviewerMembershipId,
            tenantId,
            userId: otherClassReviewerId,
            status: "ACTIVE",
          },
          { id: guardianMembershipId, tenantId, userId: guardianId, status: "ACTIVE" },
          {
            id: unboundGuardianMembershipId,
            tenantId,
            userId: unboundGuardianId,
            status: "ACTIVE",
          },
          {
            id: otherCampusStaffMembershipId,
            tenantId,
            userId: otherCampusStaffId,
            status: "ACTIVE",
          },
          {
            id: otherCampusGuardianMembershipId,
            tenantId,
            userId: otherCampusGuardianId,
            status: "ACTIVE",
          },
          {
            id: otherTenantStaffMembershipId,
            tenantId: otherTenantId,
            userId: otherTenantStaffId,
            status: "ACTIVE",
          },
          {
            id: otherTenantGuardianMembershipId,
            tenantId: otherTenantId,
            userId: otherTenantGuardianId,
            status: "ACTIVE",
          },
        ],
      });
      await prisma.membershipCampus.createMany({
        data: [
          ...[
            authorMembershipId,
            reviewerMembershipId,
            limitedReviewerMembershipId,
            publisherWithoutRevokeMembershipId,
            otherClassReviewerMembershipId,
            guardianMembershipId,
            unboundGuardianMembershipId,
          ].map((membershipId) => ({ tenantId, campusId, membershipId })),
          { tenantId, campusId: otherCampusId, membershipId: otherCampusStaffMembershipId },
          { tenantId, campusId: otherCampusId, membershipId: otherCampusGuardianMembershipId },
          {
            tenantId: otherTenantId,
            campusId: otherTenantCampusId,
            membershipId: otherTenantStaffMembershipId,
          },
          {
            tenantId: otherTenantId,
            campusId: otherTenantCampusId,
            membershipId: otherTenantGuardianMembershipId,
          },
        ],
      });
      await prisma.membershipClass.createMany({
        data: [
          { tenantId, campusId, membershipId: authorMembershipId, classRef: "synthetic-class-a" },
          { tenantId, campusId, membershipId: reviewerMembershipId, classRef: "synthetic-class-a" },
          { tenantId, campusId, membershipId: limitedReviewerMembershipId, classRef: "synthetic-class-a" },
          {
            tenantId,
            campusId,
            membershipId: otherClassReviewerMembershipId,
            classRef: "synthetic-class-b",
          },
        ],
      });
      await prisma.student.createMany({
        data: [
          {
            id: studentId,
            tenantId,
            campusId,
            classRef: "synthetic-class-a",
            status: "ACTIVE",
            displayRef: "模拟学生甲",
          },
          {
            id: otherCampusStudentId,
            tenantId,
            campusId: otherCampusId,
            classRef: "synthetic-class-a",
            status: "ACTIVE",
            displayRef: "模拟学生乙",
          },
          {
            id: otherTenantStudentId,
            tenantId: otherTenantId,
            campusId: otherTenantCampusId,
            classRef: "synthetic-class-a",
            status: "ACTIVE",
            displayRef: "模拟学生丙",
          },
        ],
      });
      await prisma.bindingApplication.createMany({
        data: [
          {
            id: applicationId,
            tenantId,
            campusId,
            applicantUserId: guardianId,
            onboardingScopeRef: randomUUID(),
            studentCandidateRef: randomUUID(),
            status: "APPROVED",
            reviewedByMembershipId: authorMembershipId,
            reviewedAt: new Date("2026-10-19T00:00:00.000Z"),
          },
          {
            id: otherCampusApplicationId,
            tenantId,
            campusId: otherCampusId,
            applicantUserId: otherCampusGuardianId,
            onboardingScopeRef: randomUUID(),
            studentCandidateRef: randomUUID(),
            status: "APPROVED",
            reviewedByMembershipId: otherCampusStaffMembershipId,
            reviewedAt: new Date("2026-10-19T00:00:00.000Z"),
          },
          {
            id: otherTenantApplicationId,
            tenantId: otherTenantId,
            campusId: otherTenantCampusId,
            applicantUserId: otherTenantGuardianId,
            onboardingScopeRef: randomUUID(),
            studentCandidateRef: randomUUID(),
            status: "APPROVED",
            reviewedByMembershipId: otherTenantStaffMembershipId,
            reviewedAt: new Date("2026-10-19T00:00:00.000Z"),
          },
        ],
      });
      await prisma.guardianRelationship.createMany({
        data: [
          {
            id: relationshipId,
            tenantId,
            campusId,
            bindingApplicationId: applicationId,
            guardianUserId: guardianId,
            studentId,
            status: "ACTIVE",
            version: 1,
            approvedByMembershipId: authorMembershipId,
            approvedAt: new Date("2026-10-19T00:00:00.000Z"),
          },
          {
            id: otherCampusRelationshipId,
            tenantId,
            campusId: otherCampusId,
            bindingApplicationId: otherCampusApplicationId,
            guardianUserId: otherCampusGuardianId,
            studentId: otherCampusStudentId,
            status: "ACTIVE",
            version: 1,
            approvedByMembershipId: otherCampusStaffMembershipId,
            approvedAt: new Date("2026-10-19T00:00:00.000Z"),
          },
          {
            id: otherTenantRelationshipId,
            tenantId: otherTenantId,
            campusId: otherTenantCampusId,
            bindingApplicationId: otherTenantApplicationId,
            guardianUserId: otherTenantGuardianId,
            studentId: otherTenantStudentId,
            status: "ACTIVE",
            version: 1,
            approvedByMembershipId: otherTenantStaffMembershipId,
            approvedAt: new Date("2026-10-19T00:00:00.000Z"),
          },
        ],
      });
      await prisma.notice.create({
        data: {
          tenantId,
          campusId,
          templateCode: "CLASS_ACTIVITY",
          target: "CLASS",
          classRef: "synthetic-class-b",
          status: "PUBLISHED",
          published: true,
          publishedAt: new Date("2026-10-19T00:00:00.000Z"),
          version: 1,
          createdByMembershipId: otherClassReviewerMembershipId,
          reviewedByMembershipId: reviewerMembershipId,
        },
      });

      api = await startApi(prisma, sessions);
      const forgedScope = await requestJson(
        api.baseUrl,
        "/staff/notices",
        "author",
        "POST",
        { templateCode: "CLASS_ACTIVITY", classRef: "synthetic-class-a" },
        { "x-campus-id": randomUUID() },
      );
      assert.equal(forgedScope.status, 400);
      const freeText = await requestJson(api.baseUrl, "/staff/notices", "author", "POST", {
        templateCode: "CLASS_ACTIVITY",
        classRef: "synthetic-class-a",
        body: "不可由客户端提供的自由文本",
      });
      assert.equal(freeText.status, 400);
      const unassignedClass = await requestJson(api.baseUrl, "/staff/notices", "author", "POST", {
        templateCode: "CLASS_ACTIVITY",
        classRef: "synthetic-class-b",
      });
      assert.equal(unassignedClass.status, 404);
      const institutionDraft = await requestJson(api.baseUrl, "/staff/notices", "author", "POST", {
        templateCode: "INSTITUTION_ANNOUNCEMENT",
      });
      assert.equal(institutionDraft.status, 201);
      assert.equal((institutionDraft.body.data as Record<string, unknown>).target, "INSTITUTION");
      assert.equal("classRef" in (institutionDraft.body.data as Record<string, unknown>), false);

      const returnedDraft = await requestJson(api.baseUrl, "/staff/notices", "author", "POST", {
        templateCode: "CLASS_ACTIVITY",
        classRef: "synthetic-class-a",
      });
      assert.equal(returnedDraft.status, 201);
      const returnedNotice = returnedDraft.body.data as { id: string };
      const returnedSubmit = await requestJson(
        api.baseUrl,
        `/staff/notices/${returnedNotice.id}/submit`,
        "author",
        "POST",
        { version: 1 },
      );
      assert.equal(returnedSubmit.status, 200);
      const returnedReview = await requestJson(
        api.baseUrl,
        `/staff/notices/${returnedNotice.id}/review`,
        "reviewer",
        "POST",
        { version: 2, action: "RETURN" },
      );
      assert.equal((returnedReview.body.data as Record<string, unknown>).status, "RETURNED");
      const resubmitted = await requestJson(
        api.baseUrl,
        `/staff/notices/${returnedNotice.id}/submit`,
        "author",
        "POST",
        { version: 3 },
      );
      assert.equal((resubmitted.body.data as Record<string, unknown>).version, 4);
      const approvedAfterReturn = await requestJson(
        api.baseUrl,
        `/staff/notices/${returnedNotice.id}/review`,
        "reviewer",
        "POST",
        { version: 4, action: "APPROVE" },
      );
      assert.equal((approvedAfterReturn.body.data as Record<string, unknown>).status, "APPROVED");
      const notYetPublished = await requestJson(api.baseUrl, "/parent/notices", "parent");
      assert.deepEqual(notYetPublished.body.data, []);

      const created = await requestJson(api.baseUrl, "/staff/notices", "author", "POST", {
        templateCode: "CLASS_ACTIVITY",
        classRef: "synthetic-class-a",
      });
      assert.equal(created.status, 201, JSON.stringify(created.body));
      const notice = created.body.data as { id: string; version: number; status: string };
      assert.equal(notice.version, 1);
      assert.equal(notice.status, "DRAFT");

      const submit = await requestJson(
        api.baseUrl,
        `/staff/notices/${notice.id}/submit`,
        "author",
        "POST",
        { version: 1 },
      );
      assert.equal(submit.status, 200, JSON.stringify(submit.body));
      const staleSubmit = await requestJson(
        api.baseUrl,
        `/staff/notices/${notice.id}/submit`,
        "author",
        "POST",
        { version: 1 },
      );
      assert.equal(staleSubmit.status, 409);
      const submittedQueue = await requestJson(api.baseUrl, "/staff/notices/review", "reviewer");
      assert.equal(submittedQueue.status, 200);
      const submittedItem = (submittedQueue.body.data as Record<string, unknown>[]).find(
        (item) => item.id === notice.id,
      );
      assert.equal(submittedItem?.title, "班级活动");
      assert.equal(
        submittedItem?.body,
        "班级近期有活动安排，请家长查看并留意相关时间。",
      );
      assert.equal("classRef" in (submittedItem ?? {}), false);
      const limitedSubmittedQueue = await requestJson(
        api.baseUrl,
        "/staff/notices/review",
        "limitedreviewer",
      );
      assert.ok(
        (limitedSubmittedQueue.body.data as Record<string, unknown>[]).some(
          (item) => item.id === notice.id,
        ),
      );
      const authorCannotReview = await requestJson(
        api.baseUrl,
        `/staff/notices/${notice.id}/review`,
        "author",
        "POST",
        { version: 2, action: "APPROVE" },
      );
      assert.equal(authorCannotReview.status, 403);
      const outsiderQueue = await requestJson(api.baseUrl, "/staff/notices/review", "otherclass");
      assert.equal(outsiderQueue.status, 200);
      assert.deepEqual(outsiderQueue.body.data, []);

      const reviewed = await requestJson(
        api.baseUrl,
        `/staff/notices/${notice.id}/review`,
        "reviewer",
        "POST",
        { version: 2, action: "APPROVE" },
      );
      assert.equal(reviewed.status, 200, JSON.stringify(reviewed.body));
      const pendingPublication = await requestJson(api.baseUrl, "/staff/notices/review", "reviewer");
      const approvedItem = (pendingPublication.body.data as Record<string, unknown>[]).find(
        (item) => item.id === notice.id,
      );
      assert.equal(approvedItem?.status, "APPROVED");
      assert.equal(approvedItem?.version, 3);
      const limitedPendingPublication = await requestJson(
        api.baseUrl,
        "/staff/notices/review",
        "limitedreviewer",
      );
      assert.equal(
        (limitedPendingPublication.body.data as Record<string, unknown>[]).some(
          (item) => item.id === notice.id && item.status === "APPROVED",
        ),
        false,
      );
      const published = await requestJson(
        api.baseUrl,
        `/staff/notices/${notice.id}/publish`,
        "reviewer",
        "POST",
        { version: 3 },
      );
      assert.equal(published.status, 200, JSON.stringify(published.body));
      const afterPublishQueue = await requestJson(api.baseUrl, "/staff/notices/review", "reviewer");
      const publishedItem = (afterPublishQueue.body.data as Record<string, unknown>[]).find(
        (item) => item.id === notice.id,
      );
      assert.equal(publishedItem?.status, "PUBLISHED");
      assert.equal(publishedItem?.published, true);
      const noRevokeQueue = await requestJson(
        api.baseUrl,
        "/staff/notices/review",
        "publisherwithoutrevoke",
      );
      assert.equal(
        (noRevokeQueue.body.data as Record<string, unknown>[]).some(
          (item) => item.id === notice.id,
        ),
        false,
      );

      const parentList = await requestJson(api.baseUrl, "/parent/notices", "parent");
      assert.equal(parentList.status, 200, JSON.stringify(parentList.body));
      const visibleNotices = parentList.body.data as Record<string, unknown>[];
      assert.equal(visibleNotices.length, 1);
      const parentNotice = visibleNotices[0];
      assert.ok(parentNotice);
      assert.equal(parentNotice.id, notice.id);
      assert.deepEqual(Object.keys(parentNotice).sort(), [
        "body",
        "id",
        "published",
        "receiptStatus",
        "requiresAcknowledgment",
        "status",
        "synthetic",
        "target",
        "title",
        "version",
      ]);
      assert.equal(parentNotice.receiptStatus, "UNREAD");
      const otherCampusList = await requestJson(api.baseUrl, "/parent/notices", "othercampus");
      assert.deepEqual(otherCampusList.body.data, []);
      const otherTenantList = await requestJson(api.baseUrl, "/parent/notices", "othertenant");
      assert.deepEqual(otherTenantList.body.data, []);
      const unboundList = await requestJson(api.baseUrl, "/parent/notices", "unboundparent");
      assert.deepEqual(unboundList.body.data, []);
      const unboundRead = await requestJson(
        api.baseUrl,
        `/parent/notices/${notice.id}/read`,
        "unboundparent",
        "POST",
        { version: 4 },
      );
      assert.equal(unboundRead.status, 404);
      const staleRead = await requestJson(
        api.baseUrl,
        `/parent/notices/${notice.id}/read`,
        "parent",
        "POST",
        { version: 3 },
      );
      assert.equal(staleRead.status, 409);
      const ackBeforeRead = await requestJson(
        api.baseUrl,
        `/parent/notices/${notice.id}/ack`,
        "parent",
        "POST",
        { version: 4 },
      );
      assert.equal(ackBeforeRead.status, 409);
      const read = await requestJson(
        api.baseUrl,
        `/parent/notices/${notice.id}/read`,
        "parent",
        "POST",
        { version: 4 },
      );
      assert.equal(read.status, 200, JSON.stringify(read.body));
      const acknowledged = await requestJson(
        api.baseUrl,
        `/parent/notices/${notice.id}/ack`,
        "parent",
        "POST",
        { version: 4 },
      );
      assert.equal(acknowledged.status, 200, JSON.stringify(acknowledged.body));
      assert.equal(
        (acknowledged.body.data as Record<string, unknown>).receiptStatus,
        "ACKNOWLEDGED",
      );

      await api.close();
      api = undefined;
      await prisma.$disconnect();
      prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
      await prisma.$connect();
      api = await startApi(prisma, sessions);
      const persisted = await requestJson(api.baseUrl, "/parent/notices", "parent");
      assert.equal(
        (persisted.body.data as Record<string, unknown>[])[0]?.receiptStatus,
        "ACKNOWLEDGED",
      );

      const revoked = await requestJson(
        api.baseUrl,
        `/staff/notices/${notice.id}/revoke`,
        "reviewer",
        "POST",
        { version: 4 },
      );
      assert.equal(revoked.status, 200, JSON.stringify(revoked.body));
      assert.equal((revoked.body.data as Record<string, unknown>).status, "REVOKED");
      const afterRevokeQueue = await requestJson(api.baseUrl, "/staff/notices/review", "reviewer");
      assert.equal(
        (afterRevokeQueue.body.data as Record<string, unknown>[]).some(
          (item) => item.id === notice.id,
        ),
        false,
      );
      const hiddenAfterRevoke = await requestJson(api.baseUrl, "/parent/notices", "parent");
      assert.deepEqual(hiddenAfterRevoke.body.data, []);
    } finally {
      if (api) await api.close();
      await prisma.$disconnect();
    }
  },
);
