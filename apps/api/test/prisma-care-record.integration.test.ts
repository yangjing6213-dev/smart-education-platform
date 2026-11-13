import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import test from "node:test";
import type { TrustedAuthResult } from "@student-care/auth";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaGuardianBindingService } from "../src/modules/guardian-bindings/prisma-guardian-binding.service.js";
import { PrismaCareRecordService } from "../src/modules/care-records/prisma-care-record.service.js";
import { createApiApp } from "../src/nest/api-app.js";
import type { ApiHttpRequest } from "../src/nest/api-tokens.js";
import { listenOnFetchSafePort } from "./support/fetch-safe-port.js";

const databaseUrl = process.env.DATABASE_URL;

function createClient(): PrismaClient {
  if (databaseUrl === undefined) throw new Error("DATABASE_URL is required for this test.");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
}

function trustedAuth(
  actorId: string,
  campusId: string,
  capabilities: TrustedAuthResult["memberships"][number]["capabilities"],
  tenantId: string,
): TrustedAuthResult {
  return {
    trusted: true,
    session: {
      trusted: true,
      status: "ACTIVE",
      actor_id: actorId,
      expires_at: "2099-01-01T00:00:00.000Z",
    },
    identity: { actor_id: actorId, display_name: "合成演示账号" },
    memberships: [{ tenant_id: tenantId, campus_ids: [campusId], status: "ACTIVE", capabilities }],
  };
}

async function startApi(
  prisma: PrismaClient,
  sessions: Readonly<Record<string, TrustedAuthResult>>,
): Promise<{ readonly baseUrl: string; close(): Promise<void> }> {
  const app = await createApiApp({
    careRecordOperations: new PrismaCareRecordService(prisma),
    getTrustedAuthResult: (request: ApiHttpRequest) => {
      const authorization = request.headers.authorization;
      if (typeof authorization !== "string") return undefined;
      const token = /^Bearer ([a-z-]+)$/.exec(authorization)?.[1];
      return token === undefined ? undefined : sessions[token];
    },
  });
  await listenOnFetchSafePort((port) => app.listen(port, "127.0.0.1"));
  const address = app.getHttpServer().address() as AddressInfo | null;
  if (address === null) throw new Error("Local synthetic API did not bind to loopback.");
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
  "care records persist the full staff review and parent acknowledgement flow within assigned scope",
  { skip: databaseUrl === undefined },
  async () => {
    const parsedUrl = new URL(databaseUrl!);
    assert.equal(parsedUrl.hostname, "127.0.0.1");
    assert.equal(parsedUrl.port, "55433");

    const prisma = createClient();
    const tenantId = randomUUID();
    const otherTenantId = randomUUID();
    const campusId = randomUUID();
    const otherCampusId = randomUUID();
    const otherTenantCampusId = randomUUID();
    const writerId = randomUUID();
    const reviewerId = randomUUID();
    const otherClassReviewerId = randomUUID();
    const otherCampusReviewerId = randomUUID();
    const otherTenantReviewerId = randomUUID();
    const publisherId = randomUUID();
    const guardianId = randomUUID();
    const writerMembershipId = randomUUID();
    const reviewerMembershipId = randomUUID();
    const otherClassReviewerMembershipId = randomUUID();
    const otherCampusReviewerMembershipId = randomUUID();
    const otherTenantReviewerMembershipId = randomUUID();
    const publisherMembershipId = randomUUID();
    const guardianMembershipId = randomUUID();
    const studentId = randomUUID();
    let api: Awaited<ReturnType<typeof startApi>> | undefined;
    let restartedApi: Awaited<ReturnType<typeof startApi>> | undefined;
    let restartedClient: PrismaClient | undefined;
    let connected = false;
    let restartedConnected = false;

    const sessions: Readonly<Record<string, TrustedAuthResult>> = {
      writer: trustedAuth(writerId, campusId, ["care:write", "care:review"], tenantId),
      reviewer: trustedAuth(reviewerId, campusId, ["care:review"], tenantId),
      otherclass: trustedAuth(otherClassReviewerId, campusId, ["care:review"], tenantId),
      othercampus: trustedAuth(otherCampusReviewerId, otherCampusId, ["care:review"], tenantId),
      othertenant: trustedAuth(
        otherTenantReviewerId,
        otherTenantCampusId,
        ["care:review"],
        otherTenantId,
      ),
      publisher: trustedAuth(publisherId, campusId, ["care:publish"], tenantId),
      guardian: trustedAuth(guardianId, campusId, ["care:read"], tenantId),
    };
    const scope = (actorId: string) => [{ actorId, tenantId, campusId }] as const;

    try {
      await prisma.$connect();
      connected = true;
      await prisma.tenant.createMany({
        data: [tenantId, otherTenantId].map((id) => ({
          id,
          name: "合成机构",
          slug: `synthetic-${id}`,
          status: "ACTIVE",
        })),
      });
      await prisma.campus.createMany({
        data: [
          { id: campusId, tenantId, name: "合成校区", status: "ACTIVE" },
          { id: otherCampusId, tenantId, name: "无关校区", status: "ACTIVE" },
          {
            id: otherTenantCampusId,
            tenantId: otherTenantId,
            name: "其他租户校区",
            status: "ACTIVE",
          },
        ],
      });
      await prisma.user.createMany({
        data: [
          writerId,
          reviewerId,
          otherClassReviewerId,
          otherCampusReviewerId,
          otherTenantReviewerId,
          publisherId,
          guardianId,
        ].map((id) => ({ id, status: "ACTIVE" })),
      });
      await prisma.membership.createMany({
        data: [
          { id: writerMembershipId, tenantId, userId: writerId, status: "ACTIVE" },
          { id: reviewerMembershipId, tenantId, userId: reviewerId, status: "ACTIVE" },
          {
            id: otherClassReviewerMembershipId,
            tenantId,
            userId: otherClassReviewerId,
            status: "ACTIVE",
          },
          {
            id: otherCampusReviewerMembershipId,
            tenantId,
            userId: otherCampusReviewerId,
            status: "ACTIVE",
          },
          {
            id: otherTenantReviewerMembershipId,
            tenantId: otherTenantId,
            userId: otherTenantReviewerId,
            status: "ACTIVE",
          },
          { id: publisherMembershipId, tenantId, userId: publisherId, status: "ACTIVE" },
          { id: guardianMembershipId, tenantId, userId: guardianId, status: "ACTIVE" },
        ],
      });
      await prisma.membershipCampus.createMany({
        data: [
          writerMembershipId,
          reviewerMembershipId,
          otherClassReviewerMembershipId,
          publisherMembershipId,
          guardianMembershipId,
        ].map((membershipId) => ({ tenantId, campusId, membershipId })),
      });
      await prisma.membershipCampus.createMany({
        data: [
          {
            tenantId,
            campusId: otherCampusId,
            membershipId: otherCampusReviewerMembershipId,
          },
          {
            tenantId: otherTenantId,
            campusId: otherTenantCampusId,
            membershipId: otherTenantReviewerMembershipId,
          },
        ],
      });
      await prisma.membershipClass.createMany({
        data: [
          { tenantId, campusId, membershipId: writerMembershipId, classRef: "合成一班" },
          { tenantId, campusId, membershipId: reviewerMembershipId, classRef: "合成一班" },
          {
            tenantId,
            campusId,
            membershipId: otherClassReviewerMembershipId,
            classRef: "合成二班",
          },
          {
            tenantId,
            campusId: otherCampusId,
            membershipId: otherCampusReviewerMembershipId,
            classRef: "合成一班",
          },
          {
            tenantId: otherTenantId,
            campusId: otherTenantCampusId,
            membershipId: otherTenantReviewerMembershipId,
            classRef: "合成一班",
          },
          { tenantId, campusId, membershipId: publisherMembershipId, classRef: "合成一班" },
        ],
      });
      await prisma.student.create({
        data: {
          id: studentId,
          tenantId,
          campusId,
          classRef: "合成一班",
          status: "ACTIVE",
          displayRef: "模拟学生-01",
        },
      });

      const bindingService = new PrismaGuardianBindingService(
        prisma,
        new Map([[guardianId, [studentId]]]),
      );
      const application = await bindingService.submit(
        { scopes: scope(guardianId) },
        { student_candidate_ref: studentId, relationship: "GUARDIAN", consent: true },
      );
      assert.equal(application.ok, true);
      if (!application.ok) assert.fail("Synthetic guardian binding should be submitted.");
      const relationship = await bindingService.review(
        { scopes: scope(reviewerId) },
        application.data.id,
        { version: 1, action: "approve" },
      );
      assert.equal(relationship.ok, true);

      api = await startApi(prisma, sessions);
      const values = {
        arrival: "ARRIVED_AS_PLANNED",
        homework: "COMPLETED",
        meal: "FINISHED",
        rest: "RESTED",
        activity: "PARTICIPATED",
        wellbeing: "ROUTINE",
      } as const;
      const editedValues = { ...values, meal: "PARTIAL" as const };
      const writerStudents = await requestJson(
        api.baseUrl,
        "/staff/care-record-students",
        "writer",
      );
      assert.equal(writerStudents.status, 200);
      assert.deepEqual(writerStudents.body.data, [
        {
          id: studentId,
          student_display_ref: "模拟学生-01",
          class_ref: "合成一班",
        },
      ]);
      const otherClassStudents = await requestJson(
        api.baseUrl,
        "/staff/care-record-students",
        "otherclass",
      );
      assert.equal(otherClassStudents.status, 403);
      const initialList = await requestJson(api.baseUrl, "/staff/care-records", "writer");
      assert.equal(initialList.status, 200);
      assert.deepEqual(initialList.body.data, []);

      const invalidDraft = await requestJson(api.baseUrl, "/staff/care-records", "writer", "POST", {
        student_id: studentId,
        service_date: "2026-10-18",
        values,
        note: "不允许自由文本",
      });
      assert.equal(invalidDraft.status, 400);

      const created = await requestJson(api.baseUrl, "/staff/care-records", "writer", "POST", {
        student_id: studentId,
        service_date: "2026-10-18",
        values,
      });
      assert.equal(created.status, 201);
      const createdRecord = created.body.data as Record<string, unknown>;
      assert.equal(createdRecord.status, "DRAFT");
      assert.equal(createdRecord.version, 1);
      const recordId = String(createdRecord.id);
      const writerRecords = await requestJson(api.baseUrl, "/staff/care-records", "writer");
      const writerRecord = (writerRecords.body.data as Record<string, unknown>[])[0];
      assert.deepEqual(writerRecord?.actions, ["edit", "submit", "withdraw"]);

      const duplicateDate = await requestJson(
        api.baseUrl,
        "/staff/care-records",
        "writer",
        "POST",
        { student_id: studentId, service_date: "2026-10-18", values },
      );
      assert.equal(duplicateDate.status, 409);

      const edited = await requestJson(
        api.baseUrl,
        `/staff/care-records/${recordId}`,
        "writer",
        "PATCH",
        { version: 1, values: editedValues },
      );
      assert.equal(edited.status, 200);
      assert.equal((edited.body.data as Record<string, unknown>).version, 2);

      const submitted = await requestJson(
        api.baseUrl,
        `/staff/care-records/${recordId}/submit`,
        "writer",
        "POST",
        { version: 2 },
      );
      assert.equal(submitted.status, 200);
      assert.equal((submitted.body.data as Record<string, unknown>).status, "SUBMITTED");

      const reviewerPending = await requestJson(api.baseUrl, "/staff/care-records", "reviewer");
      assert.equal(reviewerPending.status, 200);
      assert.equal((reviewerPending.body.data as Record<string, unknown>[]).length, 1);
      assert.deepEqual((reviewerPending.body.data as Record<string, unknown>[])[0]?.actions, [
        "review",
      ]);

      const selfReview = await requestJson(
        api.baseUrl,
        `/staff/care-records/${recordId}/review`,
        "writer",
        "POST",
        { version: 3, action: "confirm" },
      );
      assert.equal(selfReview.status, 404);

      const wrongClassPending = await requestJson(api.baseUrl, "/staff/care-records", "otherclass");
      assert.deepEqual(wrongClassPending.body.data, []);
      const wrongClassReview = await requestJson(
        api.baseUrl,
        `/staff/care-records/${recordId}/review`,
        "otherclass",
        "POST",
        { version: 3, action: "confirm" },
      );
      assert.equal(wrongClassReview.status, 404);

      const otherCampusReview = await requestJson(
        api.baseUrl,
        `/staff/care-records/${recordId}/review`,
        "othercampus",
        "POST",
        { version: 3, action: "confirm" },
      );
      assert.equal(otherCampusReview.status, 404);
      const otherTenantReview = await requestJson(
        api.baseUrl,
        `/staff/care-records/${recordId}/review`,
        "othertenant",
        "POST",
        { version: 3, action: "confirm" },
      );
      assert.equal(otherTenantReview.status, 404);

      const returned = await requestJson(
        api.baseUrl,
        `/staff/care-records/${recordId}/review`,
        "reviewer",
        "POST",
        { version: 3, action: "return" },
      );
      assert.equal(returned.status, 200);
      assert.equal((returned.body.data as Record<string, unknown>).status, "RETURNED");

      const resubmitted = await requestJson(
        api.baseUrl,
        `/staff/care-records/${recordId}/resubmit`,
        "writer",
        "POST",
        { version: 4, values },
      );
      assert.equal(resubmitted.status, 200);
      assert.equal((resubmitted.body.data as Record<string, unknown>).status, "SUBMITTED");

      const confirmed = await requestJson(
        api.baseUrl,
        `/staff/care-records/${recordId}/review`,
        "reviewer",
        "POST",
        { version: 5, action: "confirm" },
      );
      assert.equal(confirmed.status, 200);
      assert.equal((confirmed.body.data as Record<string, unknown>).status, "CONFIRMED");
      const publisherPending = await requestJson(api.baseUrl, "/staff/care-records", "publisher");
      assert.deepEqual((publisherPending.body.data as Record<string, unknown>[])[0]?.actions, [
        "publish",
      ]);

      const staleReview = await requestJson(
        api.baseUrl,
        `/staff/care-records/${recordId}/review`,
        "reviewer",
        "POST",
        { version: 3, action: "confirm" },
      );
      assert.equal(staleReview.status, 409);

      const parentBeforePublish = await requestJson(
        api.baseUrl,
        "/parent/care-records",
        "guardian",
      );
      assert.deepEqual(parentBeforePublish.body.data, []);

      const published = await requestJson(
        api.baseUrl,
        `/staff/care-records/${recordId}/publish`,
        "publisher",
        "POST",
        { version: 6 },
      );
      assert.equal(published.status, 200);
      const publishedRecord = published.body.data as Record<string, unknown>;
      assert.equal(publishedRecord.published, true);
      assert.equal(publishedRecord.publication_version, 1);

      const parentList = await requestJson(api.baseUrl, "/parent/care-records", "guardian");
      assert.equal(parentList.status, 200);
      const parentRecord = (parentList.body.data as Record<string, unknown>[])[0];
      assert.ok(parentRecord);
      assert.equal(parentRecord.student_display_ref, "模拟学生-01");
      assert.equal(parentRecord.class_ref, undefined);
      assert.equal(parentRecord.receipt_status, "UNREAD");

      const readReceipt = await requestJson(
        api.baseUrl,
        `/parent/care-records/${recordId}/receipt`,
        "guardian",
        "POST",
        { version: 7, publication_version: 1, action: "read" },
      );
      assert.equal(readReceipt.status, 200);
      assert.equal((readReceipt.body.data as Record<string, unknown>).receipt_status, "READ");

      const acknowledged = await requestJson(
        api.baseUrl,
        `/parent/care-records/${recordId}/receipt`,
        "guardian",
        "POST",
        { version: 7, publication_version: 1, action: "acknowledge" },
      );
      assert.equal(acknowledged.status, 200);
      assert.equal(
        (acknowledged.body.data as Record<string, unknown>).receipt_status,
        "ACKNOWLEDGED",
      );

      const repeatedRead = await requestJson(
        api.baseUrl,
        `/parent/care-records/${recordId}/receipt`,
        "guardian",
        "POST",
        { version: 7, publication_version: 1, action: "read" },
      );
      assert.equal(repeatedRead.status, 409);
      await api.close();
      api = undefined;
      await prisma.$disconnect();
      connected = false;

      restartedClient = createClient();
      await restartedClient.$connect();
      restartedConnected = true;
      restartedApi = await startApi(restartedClient, sessions);
      const afterRestart = await requestJson(
        restartedApi.baseUrl,
        `/parent/care-records/${recordId}`,
        "guardian",
      );
      assert.equal(afterRestart.status, 200);
      assert.equal(
        (afterRestart.body.data as Record<string, unknown>).receipt_status,
        "ACKNOWLEDGED",
      );
      const persisted = await restartedClient.careRecord.findFirst({
        where: { tenantId, campusId, id: recordId },
        include: { revisions: true, auditEvents: true, receipts: true },
      });
      assert.equal(persisted?.status, "CONFIRMED");
      assert.equal(persisted?.published, true);
      assert.equal(persisted?.revisions.length, 7);
      assert.equal(persisted?.auditEvents.length, 9);
      assert.equal(persisted?.receipts[0]?.status, "ACKNOWLEDGED");

      const unauthorizedRevocation = await requestJson(
        restartedApi.baseUrl,
        `/staff/care-records/${recordId}/revoke-publication`,
        "writer",
        "POST",
        { version: 7 },
      );
      assert.equal(unauthorizedRevocation.status, 403);

      const revoked = await requestJson(
        restartedApi.baseUrl,
        `/staff/care-records/${recordId}/revoke-publication`,
        "publisher",
        "POST",
        { version: 7 },
      );
      assert.equal(revoked.status, 200);
      assert.equal((revoked.body.data as Record<string, unknown>).status, "CONFIRMED");
      assert.equal((revoked.body.data as Record<string, unknown>).version, 8);
      assert.equal((revoked.body.data as Record<string, unknown>).published, false);
      assert.equal((revoked.body.data as Record<string, unknown>).publication_version, 1);
      assert.deepEqual((revoked.body.data as Record<string, unknown>).actions, ["publish"]);
      assert.deepEqual(
        (await requestJson(restartedApi.baseUrl, "/parent/care-records", "guardian")).body.data,
        [],
      );
      assert.equal(
        (await requestJson(restartedApi.baseUrl, `/parent/care-records/${recordId}`, "guardian"))
          .status,
        404,
      );
      assert.equal(
        (
          await requestJson(
            restartedApi.baseUrl,
            `/parent/care-records/${recordId}/receipt`,
            "guardian",
            "POST",
            { version: 7, publication_version: 1, action: "read" },
          )
        ).status,
        404,
      );

      const republished = await requestJson(
        restartedApi.baseUrl,
        `/staff/care-records/${recordId}/publish`,
        "publisher",
        "POST",
        { version: 8 },
      );
      assert.equal(republished.status, 200);
      assert.equal((republished.body.data as Record<string, unknown>).version, 9);
      assert.equal((republished.body.data as Record<string, unknown>).published, true);
      assert.equal((republished.body.data as Record<string, unknown>).publication_version, 2);
      assert.deepEqual((republished.body.data as Record<string, unknown>).actions, [
        "revoke-publication",
      ]);
      const newPublication = await requestJson(
        restartedApi.baseUrl,
        "/parent/care-records",
        "guardian",
      );
      assert.equal(newPublication.status, 200);
      assert.equal(
        (newPublication.body.data as Record<string, unknown>[])[0]?.receipt_status,
        "UNREAD",
      );

      const secondDraft = await requestJson(
        restartedApi.baseUrl,
        "/staff/care-records",
        "writer",
        "POST",
        { student_id: studentId, service_date: "2026-10-19", values },
      );
      assert.equal(secondDraft.status, 201);
      const secondRecordId = String((secondDraft.body.data as Record<string, unknown>).id);
      assert.deepEqual((secondDraft.body.data as Record<string, unknown>).actions, [
        "edit",
        "submit",
        "withdraw",
      ]);
      const secondSubmitted = await requestJson(
        restartedApi.baseUrl,
        `/staff/care-records/${secondRecordId}/submit`,
        "writer",
        "POST",
        { version: 1 },
      );
      assert.equal(secondSubmitted.status, 200);
      assert.deepEqual((secondSubmitted.body.data as Record<string, unknown>).actions, [
        "withdraw",
      ]);
      const concurrentWithdrawals = await Promise.all([
        requestJson(
          restartedApi.baseUrl,
          `/staff/care-records/${secondRecordId}/withdraw`,
          "writer",
          "POST",
          { version: 2 },
        ),
        requestJson(
          restartedApi.baseUrl,
          `/staff/care-records/${secondRecordId}/withdraw`,
          "writer",
          "POST",
          { version: 2 },
        ),
      ]);
      assert.deepEqual(concurrentWithdrawals.map((response) => response.status).sort(), [200, 409]);
      const withdrawn = concurrentWithdrawals.find((response) => response.status === 200);
      assert.ok(withdrawn);
      assert.equal((withdrawn.body.data as Record<string, unknown>).status, "CANCELLED");
      assert.equal((withdrawn.body.data as Record<string, unknown>).version, 3);
      assert.deepEqual((withdrawn.body.data as Record<string, unknown>).actions, []);

      const finalRecord = await restartedClient.careRecord.findFirst({
        where: { tenantId, campusId, id: recordId },
        include: { revisions: true, auditEvents: true, receipts: true },
      });
      assert.equal(finalRecord?.revisions.length, 9);
      assert.equal(finalRecord?.auditEvents.length, 11);
      assert.deepEqual(
        finalRecord?.auditEvents.map((event) => event.action).sort(),
        [
          "CREATED",
          "EDITED",
          "PUBLISHED",
          "PUBLISHED",
          "RECEIPT_ACKNOWLEDGED",
          "RECEIPT_READ",
          "RESUBMITTED",
          "REVIEW_CONFIRMED",
          "REVIEW_RETURNED",
          "SUBMITTED",
          "PUBLICATION_REVOKED",
        ].sort(),
      );
      assert.equal(finalRecord?.receipts.length, 2);
      assert.equal(
        finalRecord?.receipts.find((receipt) => receipt.publicationVersion === 1)?.status,
        "ACKNOWLEDGED",
      );
      assert.equal(
        finalRecord?.receipts.find((receipt) => receipt.publicationVersion === 2)?.status,
        "UNREAD",
      );

      const withdrawnRecord = await restartedClient.careRecord.findFirst({
        where: { tenantId, campusId, id: secondRecordId },
        include: { revisions: true, auditEvents: true },
      });
      assert.equal(withdrawnRecord?.status, "CANCELLED");
      assert.equal(withdrawnRecord?.revisions.length, 3);
      assert.deepEqual(
        withdrawnRecord?.auditEvents.map((event) => event.action),
        ["CREATED", "SUBMITTED", "WITHDRAWN"],
      );
      const parentAfterWithdrawal = await requestJson(
        restartedApi.baseUrl,
        "/parent/care-records",
        "guardian",
      );
      assert.deepEqual(
        (parentAfterWithdrawal.body.data as Record<string, unknown>[]).map((row) => row.id),
        [recordId],
      );

      await restartedClient.student.updateMany({
        where: { tenantId, campusId, id: studentId },
        data: { classRef: "合成二班" },
      });
      try {
        for (const formerStaff of ["writer", "reviewer"]) {
          const formerList = await requestJson(
            restartedApi.baseUrl,
            "/staff/care-records",
            formerStaff,
          );
          assert.equal(formerList.status, 200);
          const ids = (formerList.body.data as Record<string, unknown>[]).map((row) => row.id);
          assert.equal(ids.includes(recordId), false);
          assert.equal(ids.includes(secondRecordId), false);
        }
        assert.equal(
          (await requestJson(restartedApi.baseUrl, `/staff/care-records/${recordId}`, "writer"))
            .status,
          404,
        );
        const newClassList = await requestJson(
          restartedApi.baseUrl,
          "/staff/care-records",
          "otherclass",
        );
        const visibleHistory = (newClassList.body.data as Record<string, unknown>[]).find(
          (row) => row.id === recordId,
        );
        assert.ok(visibleHistory);
        assert.deepEqual(visibleHistory.actions, []);
        assert.equal(
          (newClassList.body.data as Record<string, unknown>[]).some(
            (row) => row.id === secondRecordId,
          ),
          false,
        );
        const newClassDetail = await requestJson(
          restartedApi.baseUrl,
          `/staff/care-records/${recordId}`,
          "otherclass",
        );
        assert.equal(newClassDetail.status, 200);
        assert.deepEqual((newClassDetail.body.data as Record<string, unknown>).actions, []);
        const parentHistory = await requestJson(
          restartedApi.baseUrl,
          "/parent/care-records",
          "guardian",
        );
        assert.ok(
          (parentHistory.body.data as Record<string, unknown>[]).some((row) => row.id === recordId),
        );
        assert.equal(
          (await requestJson(restartedApi.baseUrl, `/parent/care-records/${recordId}`, "guardian"))
            .status,
          200,
        );
        const historicalRead = await requestJson(
          restartedApi.baseUrl,
          `/parent/care-records/${recordId}/receipt`,
          "guardian",
          "POST",
          { version: 9, publication_version: 2, action: "read" },
        );
        assert.equal(historicalRead.status, 200);
        const historicalAcknowledgement = await requestJson(
          restartedApi.baseUrl,
          `/parent/care-records/${recordId}/receipt`,
          "guardian",
          "POST",
          { version: 9, publication_version: 2, action: "acknowledge" },
        );
        assert.equal(historicalAcknowledgement.status, 200);
        assert.equal(
          (historicalAcknowledgement.body.data as Record<string, unknown>).receipt_status,
          "ACKNOWLEDGED",
        );
      } finally {
        await restartedClient.student.updateMany({
          where: { tenantId, campusId, id: studentId },
          data: { classRef: "合成一班" },
        });
      }

      await restartedClient.guardianRelationship.updateMany({
        where: { tenantId, campusId, guardianUserId: guardianId, status: "ACTIVE" },
        data: { status: "RELEASED", releasedAt: new Date() },
      });
      const expiredRelationshipRecord = await requestJson(
        restartedApi.baseUrl,
        `/parent/care-records/${recordId}`,
        "guardian",
      );
      assert.equal(expiredRelationshipRecord.status, 404);
      const expiredRelationshipList = await requestJson(
        restartedApi.baseUrl,
        "/parent/care-records",
        "guardian",
      );
      assert.deepEqual(expiredRelationshipList.body.data, []);
      await restartedApi.close();
      restartedApi = undefined;
      await restartedClient.$disconnect();
      restartedConnected = false;
    } finally {
      if (api !== undefined) await api.close();
      if (restartedApi !== undefined) await restartedApi.close();
      if (connected) await prisma.$disconnect();
      if (restartedConnected && restartedClient !== undefined) await restartedClient.$disconnect();
      const cleanup = createClient();
      try {
        await cleanup.$connect();
        await cleanup.careRecordAuditEvent.deleteMany({ where: { tenantId } });
        await cleanup.careRecordReceipt.deleteMany({ where: { tenantId } });
        await cleanup.careRecordRevision.deleteMany({ where: { tenantId } });
        await cleanup.careRecord.deleteMany({ where: { tenantId } });
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
        const tenantIds = [tenantId, otherTenantId];
        await cleanup.membershipClass.deleteMany({ where: { tenantId: { in: tenantIds } } });
        await cleanup.membershipCampus.deleteMany({ where: { tenantId: { in: tenantIds } } });
        await cleanup.membership.deleteMany({ where: { tenantId: { in: tenantIds } } });
        await cleanup.user.deleteMany({
          where: {
            id: {
              in: [
                writerId,
                reviewerId,
                otherClassReviewerId,
                otherCampusReviewerId,
                otherTenantReviewerId,
                publisherId,
                guardianId,
              ],
            },
          },
        });
        await cleanup.campus.deleteMany({ where: { tenantId: { in: tenantIds } } });
        await cleanup.tenant.deleteMany({ where: { id: { in: tenantIds } } });
      } finally {
        await cleanup.$disconnect();
      }
    }
  },
);
