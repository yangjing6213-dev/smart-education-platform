import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import test from "node:test";
import type { TrustedAuthResult } from "@student-care/auth";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { createApiApp } from "../src/nest/api-app.js";
import type { ApiHttpRequest } from "../src/nest/api-tokens.js";
import { PrismaLeaveService } from "../src/modules/leave/prisma-leave.service.js";
import { listenOnFetchSafePort } from "./support/fetch-safe-port.js";

const databaseUrl = process.env.DATABASE_URL;

function createClient(): PrismaClient {
  if (databaseUrl === undefined) throw new Error("DATABASE_URL is required for this test.");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
}

function trustedAuth(
  actorId: string,
  campusId: string,
  tenantId: string,
  capabilities: readonly TrustedAuthResult["memberships"][number]["capabilities"][number][],
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
    leaveOperations: new PrismaLeaveService(prisma),
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
  "leave requests persist the parent lifecycle and enforce current relationship and class scope",
  { skip: databaseUrl === undefined },
  async () => {
    const parsedUrl = new URL(databaseUrl!);
    assert.equal(parsedUrl.hostname, "127.0.0.1");
    assert.equal(parsedUrl.port, "55435");

    const prisma = createClient();
    const tenantId = randomUUID();
    const otherTenantId = randomUUID();
    const campusId = randomUUID();
    const otherCampusId = randomUUID();
    const otherTenantCampusId = randomUUID();
    const guardianId = randomUUID();
    const unrelatedGuardianId = randomUUID();
    const staffId = randomUUID();
    const otherClassStaffId = randomUUID();
    const otherCampusStaffId = randomUUID();
    const otherTenantStaffId = randomUUID();
    const guardianMembershipId = randomUUID();
    const unrelatedGuardianMembershipId = randomUUID();
    const staffMembershipId = randomUUID();
    const otherClassStaffMembershipId = randomUUID();
    const otherCampusStaffMembershipId = randomUUID();
    const otherTenantStaffMembershipId = randomUUID();
    const studentId = randomUUID();
    const relationshipId = randomUUID();
    const bindingApplicationId = randomUUID();
    let connected = false;
    let api: Awaited<ReturnType<typeof startApi>> | undefined;
    const sessions: Readonly<Record<string, TrustedAuthResult>> = {
      guardian: trustedAuth(guardianId, campusId, tenantId, ["leave:apply", "leave:read"]),
      unrelated: trustedAuth(unrelatedGuardianId, campusId, tenantId, [
        "leave:apply",
        "leave:read",
      ]),
      staff: trustedAuth(staffId, campusId, tenantId, ["leave:review", "leave:read"]),
      otherclass: trustedAuth(otherClassStaffId, campusId, tenantId, ["leave:review"]),
      othercampus: trustedAuth(otherCampusStaffId, otherCampusId, tenantId, ["leave:review"]),
      othertenant: trustedAuth(otherTenantStaffId, otherTenantCampusId, otherTenantId, [
        "leave:review",
      ]),
    };

    try {
      await prisma.$connect();
      connected = true;
      await prisma.tenant.createMany({
        data: [
          { id: tenantId, name: "合成机构", slug: `synthetic-${tenantId}`, status: "ACTIVE" },
          {
            id: otherTenantId,
            name: "隔离机构",
            slug: `synthetic-${otherTenantId}`,
            status: "ACTIVE",
          },
        ],
      });
      await prisma.campus.createMany({
        data: [
          { id: campusId, tenantId, name: "合成校区", status: "ACTIVE" },
          { id: otherCampusId, tenantId, name: "隔离校区", status: "ACTIVE" },
          {
            id: otherTenantCampusId,
            tenantId: otherTenantId,
            name: "隔离机构校区",
            status: "ACTIVE",
          },
        ],
      });
      await prisma.user.createMany({
        data: [
          guardianId,
          unrelatedGuardianId,
          staffId,
          otherClassStaffId,
          otherCampusStaffId,
          otherTenantStaffId,
        ].map((id) => ({ id, status: "ACTIVE" })),
      });
      await prisma.membership.createMany({
        data: [
          { id: guardianMembershipId, tenantId, userId: guardianId, status: "ACTIVE" },
          {
            id: unrelatedGuardianMembershipId,
            tenantId,
            userId: unrelatedGuardianId,
            status: "ACTIVE",
          },
          { id: staffMembershipId, tenantId, userId: staffId, status: "ACTIVE" },
          {
            id: otherClassStaffMembershipId,
            tenantId,
            userId: otherClassStaffId,
            status: "ACTIVE",
          },
          {
            id: otherCampusStaffMembershipId,
            tenantId,
            userId: otherCampusStaffId,
            status: "ACTIVE",
          },
          {
            id: otherTenantStaffMembershipId,
            tenantId: otherTenantId,
            userId: otherTenantStaffId,
            status: "ACTIVE",
          },
        ],
      });
      await prisma.membershipCampus.createMany({
        data: [
          { tenantId, campusId, membershipId: guardianMembershipId },
          { tenantId, campusId, membershipId: unrelatedGuardianMembershipId },
          { tenantId, campusId, membershipId: staffMembershipId },
          { tenantId, campusId, membershipId: otherClassStaffMembershipId },
          { tenantId, campusId: otherCampusId, membershipId: otherCampusStaffMembershipId },
          {
            tenantId: otherTenantId,
            campusId: otherTenantCampusId,
            membershipId: otherTenantStaffMembershipId,
          },
        ],
      });
      await prisma.membershipClass.createMany({
        data: [
          { tenantId, campusId, membershipId: staffMembershipId, classRef: "合成一班" },
          { tenantId, campusId, membershipId: otherClassStaffMembershipId, classRef: "合成二班" },
          {
            tenantId,
            campusId: otherCampusId,
            membershipId: otherCampusStaffMembershipId,
            classRef: "其他校区班",
          },
          {
            tenantId: otherTenantId,
            campusId: otherTenantCampusId,
            membershipId: otherTenantStaffMembershipId,
            classRef: "其他机构班",
          },
        ],
      });
      await prisma.student.create({
        data: {
          id: studentId,
          tenantId,
          campusId,
          classRef: "合成一班",
          status: "ACTIVE",
          displayRef: "模拟学生-请假-01",
        },
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
          reviewedByMembershipId: staffMembershipId,
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
          approvedByMembershipId: staffMembershipId,
          approvedAt: new Date("2026-10-01T00:00:00.000Z"),
        },
      });

      api = await startApi(prisma, sessions);
      const created = await requestJson(api.baseUrl, "/parent/leave-requests", "guardian", "POST", {
        student_id: studentId,
        start_date: "2026-10-21",
        end_date: "2026-10-22",
        reason_category: "FAMILY_ARRANGEMENT",
      });
      assert.equal(created.status, 201);
      const createdData = created.body.data as Record<string, unknown>;
      assert.equal(createdData.status, "SUBMITTED");
      assert.equal(createdData.version, 1);
      assert.equal(createdData.student_display_ref, "模拟学生-请假-01");
      const requestId = createdData.id as string;

      const overlap = await requestJson(api.baseUrl, "/parent/leave-requests", "guardian", "POST", {
        student_id: studentId,
        start_date: "2026-10-22",
        end_date: "2026-10-23",
        reason_category: "TEMPORARY_MATTER",
      });
      assert.equal(overlap.status, 409);

      const unrelated = await requestJson(api.baseUrl, "/parent/leave-requests", "unrelated");
      assert.equal(unrelated.status, 200);
      assert.deepEqual(unrelated.body.data, []);

      const wrongClass = await requestJson(
        api.baseUrl,
        `/staff/leave-requests/${requestId}/review`,
        "otherclass",
        "POST",
        { version: 1, action: "confirm" },
      );
      assert.equal(wrongClass.status, 404);
      const wrongCampus = await requestJson(
        api.baseUrl,
        `/staff/leave-requests/${requestId}/review`,
        "othercampus",
        "POST",
        { version: 1, action: "confirm" },
      );
      assert.equal(wrongCampus.status, 404);
      const wrongTenant = await requestJson(
        api.baseUrl,
        `/staff/leave-requests/${requestId}/review`,
        "othertenant",
        "POST",
        { version: 1, action: "confirm" },
      );
      assert.equal(wrongTenant.status, 404);

      const returned = await requestJson(
        api.baseUrl,
        `/staff/leave-requests/${requestId}/review`,
        "staff",
        "POST",
        { version: 1, action: "return" },
      );
      assert.equal(returned.status, 200);
      assert.equal((returned.body.data as Record<string, unknown>).status, "RETURNED");
      assert.equal((returned.body.data as Record<string, unknown>).version, 2);

      const stale = await requestJson(
        api.baseUrl,
        `/parent/leave-requests/${requestId}/acknowledge`,
        "guardian",
        "POST",
        { version: 1 },
      );
      assert.equal(stale.status, 409);

      const acknowledgedReturned = await requestJson(
        api.baseUrl,
        `/parent/leave-requests/${requestId}/acknowledge`,
        "guardian",
        "POST",
        { version: 2 },
      );
      assert.equal(acknowledgedReturned.status, 200);
      assert.equal((acknowledgedReturned.body.data as Record<string, unknown>).acknowledged, true);
      const resubmitted = await requestJson(
        api.baseUrl,
        `/parent/leave-requests/${requestId}/resubmit`,
        "guardian",
        "POST",
        {
          version: 3,
          start_date: "2026-10-23",
          end_date: "2026-10-24",
          reason_category: "TEMPORARY_MATTER",
        },
      );
      assert.equal(resubmitted.status, 200);
      assert.equal((resubmitted.body.data as Record<string, unknown>).status, "SUBMITTED");
      assert.equal((resubmitted.body.data as Record<string, unknown>).acknowledged, false);

      const confirmed = await requestJson(
        api.baseUrl,
        `/staff/leave-requests/${requestId}/review`,
        "staff",
        "POST",
        { version: 4, action: "confirm" },
      );
      assert.equal(confirmed.status, 200);
      assert.equal((confirmed.body.data as Record<string, unknown>).status, "CONFIRMED");
      const acknowledged = await requestJson(
        api.baseUrl,
        `/parent/leave-requests/${requestId}/acknowledge`,
        "guardian",
        "POST",
        { version: 5 },
      );
      assert.equal(acknowledged.status, 200);
      assert.equal((acknowledged.body.data as Record<string, unknown>).version, 6);

      const history = await prisma.leaveRequestRevision.findMany({
        where: { tenantId, campusId, leaveRequestId: requestId },
        orderBy: { version: "asc" },
      });
      assert.deepEqual(
        history.map(({ version }) => version),
        [1, 2, 3, 4, 5, 6],
      );
      const parentList = await requestJson(api.baseUrl, "/parent/leave-requests", "guardian");
      assert.equal(parentList.status, 200);
      const parentData = parentList.body.data as readonly Record<string, unknown>[];
      assert.equal(parentData.length, 1);
      assert.equal(parentData[0]?.status, "CONFIRMED");
      assert.equal("guardian_relationship_id" in (parentData[0] ?? {}), false);
      assert.equal("requester_user_id" in (parentData[0] ?? {}), false);

      await prisma.guardianRelationship.update({
        where: { tenantId_campusId_id: { tenantId, campusId, id: relationshipId } },
        data: { status: "RELEASED", releasedAt: new Date() },
      });
      const revokedParentList = await requestJson(
        api.baseUrl,
        "/parent/leave-requests",
        "guardian",
      );
      assert.equal(revokedParentList.status, 200);
      assert.deepEqual(revokedParentList.body.data, []);
    } finally {
      if (api !== undefined) await api.close();
      if (connected) {
        await prisma.leaveRequestRevision.deleteMany({ where: { tenantId } });
        await prisma.leaveRequest.deleteMany({ where: { tenantId } });
        await prisma.guardianRelationship.deleteMany({ where: { tenantId } });
        await prisma.bindingApplication.deleteMany({ where: { tenantId } });
        await prisma.student.deleteMany({ where: { tenantId } });
        await prisma.membershipClass.deleteMany({
          where: { tenantId: { in: [tenantId, otherTenantId] } },
        });
        await prisma.membershipCampus.deleteMany({
          where: { tenantId: { in: [tenantId, otherTenantId] } },
        });
        await prisma.membership.deleteMany({
          where: { tenantId: { in: [tenantId, otherTenantId] } },
        });
        await prisma.user.deleteMany({
          where: {
            id: {
              in: [
                guardianId,
                unrelatedGuardianId,
                staffId,
                otherClassStaffId,
                otherCampusStaffId,
                otherTenantStaffId,
              ],
            },
          },
        });
        await prisma.campus.deleteMany({ where: { tenantId: { in: [tenantId, otherTenantId] } } });
        await prisma.tenant.deleteMany({ where: { id: { in: [tenantId, otherTenantId] } } });
        await prisma.$disconnect();
      }
    }
  },
);
