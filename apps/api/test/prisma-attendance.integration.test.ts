import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import test from "node:test";
import type { TrustedAuthResult } from "@student-care/auth";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
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
  capabilities: readonly string[],
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
  const attendanceServiceModule = "../src/modules/attendance/prisma-attendance.service.js";
  const { PrismaAttendanceService } = await import(attendanceServiceModule);
  const app = await createApiApp({
    attendanceOperations: new PrismaAttendanceService(prisma),
    getTrustedAuthResult: (request: ApiHttpRequest) => {
      const authorization = request.headers.authorization;
      if (typeof authorization !== "string") return undefined;
      const token = /^Bearer ([a-z-]+)$/.exec(authorization)?.[1];
      return token === undefined ? undefined : sessions[token];
    },
  } as Parameters<typeof createApiApp>[0]);
  await listenOnFetchSafePort((port) => app.listen(port, "127.0.0.1"));
  const address = app.getHttpServer().address() as AddressInfo | null;
  if (address === null) throw new Error("Local synthetic API did not bind to loopback.");
  return { baseUrl: `http://127.0.0.1:${address.port}`, close: () => app.close() };
}

async function requestJson(
  baseUrl: string,
  path: string,
  token: string,
  method: "GET" | "POST" = "GET",
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
  "attendance persistence supports scoped staff lifecycle, independent correction review, and parent summary",
  { skip: databaseUrl === undefined },
  async () => {
    const parsedUrl = new URL(databaseUrl!);
    assert.equal(parsedUrl.hostname, "127.0.0.1");
    assert.equal(parsedUrl.port, "55434");

    let prisma = createClient();
    const tenantId = randomUUID();
    const otherTenantId = randomUUID();
    const campusId = randomUUID();
    const otherCampusId = randomUUID();
    const otherTenantCampusId = randomUUID();
    const writerId = randomUUID();
    const reviewerId = randomUUID();
    const otherCampusReviewerId = randomUUID();
    const otherTenantStaffId = randomUUID();
    const guardianId = randomUUID();
    const otherGuardianId = randomUUID();
    const writerMembershipId = randomUUID();
    const reviewerMembershipId = randomUUID();
    const otherCampusReviewerMembershipId = randomUUID();
    const otherTenantMembershipId = randomUUID();
    const guardianMembershipId = randomUUID();
    const otherGuardianMembershipId = randomUUID();
    const studentId = randomUUID();
    const otherClassStudentId = randomUUID();
    const otherCampusStudentId = randomUUID();
    const otherTenantStudentId = randomUUID();
    const bindingApplicationId = randomUUID();
    const relationshipId = randomUUID();
    const serviceDate = "2026-10-17";
    const confirmedLeaveDate = "2026-10-18";
    let connected = false;
    let api: Awaited<ReturnType<typeof startApi>> | undefined;
    const sessions: Readonly<Record<string, TrustedAuthResult>> = {
      writer: trustedAuth(writerId, campusId, ["attendance:write", "attendance:review"], tenantId),
      reviewer: trustedAuth(
        reviewerId,
        campusId,
        ["attendance:write", "attendance:review"],
        tenantId,
      ),
      othercampus: trustedAuth(
        otherCampusReviewerId,
        otherCampusId,
        ["attendance:write"],
        tenantId,
      ),
      othertenant: trustedAuth(
        otherTenantStaffId,
        otherTenantCampusId,
        ["attendance:write"],
        otherTenantId,
      ),
      guardian: trustedAuth(guardianId, campusId, ["attendance:read"], tenantId),
      unrelated: trustedAuth(otherGuardianId, campusId, ["attendance:read"], tenantId),
    };

    try {
      await prisma.$connect();
      connected = true;
      await prisma.tenant.create({
        data: { id: tenantId, name: "合成机构", slug: `synthetic-${tenantId}`, status: "ACTIVE" },
      });
      await prisma.tenant.create({
        data: {
          id: otherTenantId,
          name: "合成机构-隔离样本",
          slug: `synthetic-${otherTenantId}`,
          status: "ACTIVE",
        },
      });
      await prisma.campus.createMany({
        data: [
          { id: campusId, tenantId, name: "合成校区", status: "ACTIVE" },
          { id: otherCampusId, tenantId, name: "合成校区-隔离样本", status: "ACTIVE" },
          {
            id: otherTenantCampusId,
            tenantId: otherTenantId,
            name: "合成机构-隔离校区",
            status: "ACTIVE",
          },
        ],
      });
      await prisma.user.createMany({
        data: [
          writerId,
          reviewerId,
          otherCampusReviewerId,
          otherTenantStaffId,
          guardianId,
          otherGuardianId,
        ].map((id) => ({ id, status: "ACTIVE" })),
      });
      await prisma.membership.createMany({
        data: [
          { id: writerMembershipId, tenantId, userId: writerId, status: "ACTIVE" },
          { id: reviewerMembershipId, tenantId, userId: reviewerId, status: "ACTIVE" },
          {
            id: otherCampusReviewerMembershipId,
            tenantId,
            userId: otherCampusReviewerId,
            status: "ACTIVE",
          },
          {
            id: otherTenantMembershipId,
            tenantId: otherTenantId,
            userId: otherTenantStaffId,
            status: "ACTIVE",
          },
          { id: guardianMembershipId, tenantId, userId: guardianId, status: "ACTIVE" },
          { id: otherGuardianMembershipId, tenantId, userId: otherGuardianId, status: "ACTIVE" },
        ],
      });
      await prisma.membershipCampus.createMany({
        data: [
          { tenantId, campusId, membershipId: writerMembershipId },
          { tenantId, campusId, membershipId: reviewerMembershipId },
          { tenantId, campusId: otherCampusId, membershipId: otherCampusReviewerMembershipId },
          {
            tenantId: otherTenantId,
            campusId: otherTenantCampusId,
            membershipId: otherTenantMembershipId,
          },
          { tenantId, campusId, membershipId: guardianMembershipId },
          { tenantId, campusId, membershipId: otherGuardianMembershipId },
        ],
      });
      await prisma.membershipClass.createMany({
        data: [
          { tenantId, campusId, membershipId: writerMembershipId, classRef: "合成一班" },
          { tenantId, campusId, membershipId: reviewerMembershipId, classRef: "合成一班" },
          {
            tenantId,
            campusId: otherCampusId,
            membershipId: otherCampusReviewerMembershipId,
            classRef: "其他校区合成班",
          },
          {
            tenantId: otherTenantId,
            campusId: otherTenantCampusId,
            membershipId: otherTenantMembershipId,
            classRef: "其他机构合成班",
          },
        ],
      });
      await prisma.student.createMany({
        data: [
          {
            id: studentId,
            tenantId,
            campusId,
            classRef: "合成一班",
            status: "ACTIVE",
            displayRef: "模拟学生-01",
          },
          {
            id: otherClassStudentId,
            tenantId,
            campusId,
            classRef: "合成二班",
            status: "ACTIVE",
            displayRef: "模拟学生-02",
          },
          {
            id: otherCampusStudentId,
            tenantId,
            campusId: otherCampusId,
            classRef: "其他校区合成班",
            status: "ACTIVE",
            displayRef: "模拟学生-校区隔离",
          },
          {
            id: otherTenantStudentId,
            tenantId: otherTenantId,
            campusId: otherTenantCampusId,
            classRef: "其他机构合成班",
            status: "ACTIVE",
            displayRef: "模拟学生-机构隔离",
          },
        ],
      });
      await prisma.bindingApplication.create({
        data: {
          id: bindingApplicationId,
          tenantId,
          campusId,
          applicantUserId: guardianId,
          onboardingScopeRef: randomUUID(),
          studentCandidateRef: studentId,
          status: "APPROVED",
          reviewedByMembershipId: reviewerMembershipId,
          reviewedAt: new Date("2026-10-17T08:00:00.000Z"),
        },
      });
      await prisma.guardianRelationship.create({
        data: {
          id: relationshipId,
          tenantId,
          campusId,
          bindingApplicationId,
          guardianUserId: guardianId,
          studentId,
          status: "ACTIVE",
          approvedByMembershipId: reviewerMembershipId,
          approvedAt: new Date("2026-10-01T00:00:00.000Z"),
        },
      });
      await prisma.leaveRequest.create({
        data: {
          tenantId,
          campusId,
          studentId,
          guardianRelationshipId: relationshipId,
          requesterUserId: guardianId,
          startDate: new Date(`${confirmedLeaveDate}T00:00:00.000Z`),
          endDate: new Date(`${confirmedLeaveDate}T00:00:00.000Z`),
          reasonCategory: "FAMILY_ARRANGEMENT",
          status: "CONFIRMED",
          acknowledged: true,
          updatedByMembershipId: reviewerMembershipId,
        },
      });

      api = await startApi(prisma, sessions);
      const studentList = await requestJson(api.baseUrl, "/staff/attendance-students", "writer");
      assert.equal(studentList.status, 200);
      assert.deepEqual(studentList.body.data, [
        { id: studentId, student_display_ref: "模拟学生-01", class_ref: "合成一班" },
      ]);
      const invalidDate = await requestJson(
        api.baseUrl,
        "/staff/attendance-records",
        "writer",
        "POST",
        { student_id: studentId, service_date: "2026-02-30" },
      );
      assert.equal(invalidDate.status, 400);

      const otherCampusCreated = await requestJson(
        api.baseUrl,
        "/staff/attendance-records",
        "othercampus",
        "POST",
        { student_id: otherCampusStudentId, service_date: serviceDate },
      );
      assert.equal(otherCampusCreated.status, 201);
      const otherTenantCreated = await requestJson(
        api.baseUrl,
        "/staff/attendance-records",
        "othertenant",
        "POST",
        { student_id: otherTenantStudentId, service_date: serviceDate },
      );
      assert.equal(otherTenantCreated.status, 201);

      const writerRecordsBeforeCreate = await requestJson(
        api.baseUrl,
        "/staff/attendance-records",
        "writer",
      );
      assert.deepEqual(writerRecordsBeforeCreate.body.data, []);
      for (const [token, expectedCount] of [
        ["othercampus", 1],
        ["othertenant", 1],
      ] as const) {
        const scopedRecords = await requestJson(api.baseUrl, "/staff/attendance-records", token);
        assert.equal((scopedRecords.body.data as readonly unknown[]).length, expectedCount);
      }

      for (const outOfScopeStudentId of [otherCampusStudentId, otherTenantStudentId]) {
        const outOfScopeCreate = await requestJson(
          api.baseUrl,
          "/staff/attendance-records",
          "writer",
          "POST",
          { student_id: outOfScopeStudentId, service_date: serviceDate },
        );
        assert.equal(outOfScopeCreate.status, 404);
      }

      const otherClassStudent = await requestJson(
        api.baseUrl,
        "/staff/attendance-records",
        "writer",
        "POST",
        { student_id: otherClassStudentId, service_date: serviceDate },
      );
      assert.equal(otherClassStudent.status, 404);

      const created = await requestJson(
        api.baseUrl,
        "/staff/attendance-records",
        "writer",
        "POST",
        { student_id: studentId, service_date: serviceDate },
      );
      assert.equal(created.status, 201);
      assert.equal((created.body.data as Record<string, unknown>).status, "NOT_ARRIVED");
      const record = created.body.data as Record<string, unknown>;
      const recordId = record.id as string;
      assert.equal(typeof recordId, "string");
      const invalidArrival = await requestJson(
        api.baseUrl,
        `/staff/attendance-records/${recordId}/arrive`,
        "writer",
        "POST",
        { version: 1, time: "25:00" },
      );
      assert.equal(invalidArrival.status, 400);
      const leaveDayRecord = await requestJson(
        api.baseUrl,
        "/staff/attendance-records",
        "writer",
        "POST",
        { student_id: studentId, service_date: confirmedLeaveDate },
      );
      assert.equal(leaveDayRecord.status, 201);

      const duplicate = await requestJson(
        api.baseUrl,
        "/staff/attendance-records",
        "writer",
        "POST",
        { student_id: studentId, service_date: serviceDate },
      );
      assert.equal(duplicate.status, 409);

      const arrive = await requestJson(
        api.baseUrl,
        `/staff/attendance-records/${recordId}/arrive`,
        "writer",
        "POST",
        { version: 1, time: "08:10" },
      );
      assert.equal(arrive.status, 200);
      assert.equal((arrive.body.data as Record<string, unknown>).status, "ARRIVED");

      const staleDepart = await requestJson(
        api.baseUrl,
        `/staff/attendance-records/${recordId}/depart`,
        "writer",
        "POST",
        { version: 1, time: "17:05" },
      );
      assert.equal(staleDepart.status, 409);

      const depart = await requestJson(
        api.baseUrl,
        `/staff/attendance-records/${recordId}/depart`,
        "writer",
        "POST",
        { version: 2, time: "17:05" },
      );
      assert.equal(depart.status, 200);
      assert.equal((depart.body.data as Record<string, unknown>).status, "DEPARTED");

      const correction = await requestJson(
        api.baseUrl,
        `/staff/attendance-records/${recordId}/correction`,
        "writer",
        "POST",
        {
          version: 3,
          reason: "TIME_ENTRY_ERROR",
          proposed: { status: "DEPARTED", arrival_time: "08:15", departure_time: "17:00" },
        },
      );
      assert.equal(correction.status, 200);
      assert.equal((correction.body.data as Record<string, unknown>).correction_status, "PENDING");

      const selfReview = await requestJson(
        api.baseUrl,
        `/staff/attendance-records/${recordId}/review`,
        "writer",
        "POST",
        { version: 4, action: "approve" },
      );
      assert.equal(selfReview.status, 403);

      const approved = await requestJson(
        api.baseUrl,
        `/staff/attendance-records/${recordId}/review`,
        "reviewer",
        "POST",
        { version: 4, action: "approve" },
      );
      assert.equal(approved.status, 200);
      assert.equal((approved.body.data as Record<string, unknown>).corrected, true);

      const parentRecords = await requestJson(
        api.baseUrl,
        "/parent/attendance-records",
        "guardian",
      );
      assert.equal(parentRecords.status, 200);
      const parentRecord = (parentRecords.body.data as Array<Record<string, unknown>>).find(
        (item) => item.service_date === serviceDate,
      );
      assert.deepEqual(Object.keys(parentRecord ?? {}).sort(), [
        "arrival_time",
        "confirmed_leave",
        "corrected",
        "departure_time",
        "id",
        "service_date",
        "status",
      ]);
      assert.equal(parentRecord?.arrival_time, "08:15");
      assert.equal(parentRecord?.corrected, true);
      assert.equal(parentRecord?.confirmed_leave, false);
      const leaveParentRecord = (parentRecords.body.data as Array<Record<string, unknown>>).find(
        (item) => item.service_date === confirmedLeaveDate,
      );
      assert.equal(leaveParentRecord?.confirmed_leave, true);
      const unrelatedParent = await requestJson(
        api.baseUrl,
        "/parent/attendance-records",
        "unrelated",
      );
      assert.deepEqual(unrelatedParent.body.data, []);
      const revisions = await prisma.attendanceRecordRevision.findMany({
        where: { tenantId, campusId, attendanceRecordId: recordId },
        orderBy: { version: "asc" },
      });
      const revisionRows = revisions as unknown as ReadonlyArray<{ readonly action: string }>;
      assert.deepEqual(
        revisionRows.map(({ action }) => action),
        ["CREATED", "ARRIVED", "DEPARTED", "CORRECTION_REQUESTED", "CORRECTION_APPROVED"],
      );
      assert.equal(revisions.length, 5);
      const forbiddenStudent = await requestJson(
        api.baseUrl,
        "/staff/attendance-records",
        "writer",
        "POST",
        { student_id: otherClassStudentId, service_date: serviceDate },
      );
      assert.equal(forbiddenStudent.status, 404);

      await api.close();
      api = undefined;
      await prisma.$disconnect();
      connected = false;
      prisma = createClient();
      await prisma.$connect();
      connected = true;
      api = await startApi(prisma, sessions);
      const afterReconnect = await requestJson(
        api.baseUrl,
        "/parent/attendance-records",
        "guardian",
      );
      assert.equal(afterReconnect.status, 200);
      assert.equal(
        (afterReconnect.body.data as Array<Record<string, unknown>>).find(
          (item) => item.service_date === serviceDate,
        )?.arrival_time,
        "08:15",
      );
      const releasedRelationship = await prisma.guardianRelationship.updateMany({
        where: { tenantId, campusId, id: relationshipId, status: "ACTIVE" },
        data: { status: "RELEASED", releasedAt: new Date("2026-10-18T09:00:00.000Z") },
      });
      assert.equal(releasedRelationship.count, 1);
      const releasedParent = await requestJson(
        api.baseUrl,
        "/parent/attendance-records",
        "guardian",
      );
      assert.deepEqual(releasedParent.body.data, []);
    } finally {
      await api?.close();
      if (connected) {
        const cleanup = new PrismaClient({
          adapter: new PrismaPg({ connectionString: databaseUrl! }),
        });
        await cleanup.$connect();
        try {
          for (const cleanupTenantId of [tenantId, otherTenantId]) {
            await (
              cleanup as unknown as {
                readonly attendanceCorrection: {
                  deleteMany(args: { where: { tenantId: string } }): Promise<unknown>;
                };
              }
            ).attendanceCorrection.deleteMany({ where: { tenantId: cleanupTenantId } });
            await cleanup.attendanceRecordRevision.deleteMany({
              where: { tenantId: cleanupTenantId },
            });
            await cleanup.attendanceRecord.deleteMany({ where: { tenantId: cleanupTenantId } });
            await cleanup.leaveRequest.deleteMany({ where: { tenantId: cleanupTenantId } });
            await cleanup.guardianRelationship.deleteMany({ where: { tenantId: cleanupTenantId } });
            await cleanup.bindingApplication.deleteMany({ where: { tenantId: cleanupTenantId } });
            await cleanup.student.deleteMany({ where: { tenantId: cleanupTenantId } });
            await cleanup.membershipClass.deleteMany({ where: { tenantId: cleanupTenantId } });
            await cleanup.membershipCampus.deleteMany({ where: { tenantId: cleanupTenantId } });
            await cleanup.membership.deleteMany({ where: { tenantId: cleanupTenantId } });
            await cleanup.campus.deleteMany({ where: { tenantId: cleanupTenantId } });
          }
          await cleanup.user.deleteMany({
            where: {
              id: {
                in: [
                  writerId,
                  reviewerId,
                  otherCampusReviewerId,
                  otherTenantStaffId,
                  guardianId,
                  otherGuardianId,
                ],
              },
            },
          });
          await cleanup.tenant.deleteMany({ where: { id: { in: [tenantId, otherTenantId] } } });
        } finally {
          await cleanup.$disconnect();
        }
      }
      if (connected) await prisma.$disconnect();
    }
  },
);
