import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaFeesService } from "../src/modules/fees/prisma-fees.service.js";

const databaseUrl = process.env.FEES_TEST_DATABASE_URL;

test(
  "fee storage stays campus-scoped, parent reads require active links, and history is append-only",
  { skip: databaseUrl === undefined },
  async () => {
    const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl! }) });
    const tenantId = randomUUID();
    const campusId = randomUUID();
    const otherCampusId = randomUUID();
    const managerId = randomUUID();
    const managerMembershipId = randomUUID();
    const parentId = randomUUID();
    const studentId = randomUUID();
    const unrelatedStudentId = randomUUID();
    const otherCampusStudentId = randomUUID();
    const applicationId = randomUUID();
    const relationshipId = randomUUID();
    const now = new Date("2026-10-24T08:00:00.000Z");
    const service = new PrismaFeesService(prisma, () => now);
    const manager = {
      actorId: managerId,
      tenantId,
      campusId,
      capabilities: ["fees:manage"],
    } as const;
    const parent = {
      actorId: parentId,
      tenantId,
      campusId,
      capabilities: ["binding:read"],
    } as const;

    try {
      await prisma.$executeRaw`INSERT INTO tenants (id, name, slug, status)
        VALUES (${tenantId}::uuid, '合成费用测试机构', ${`fees-${tenantId}`}, 'ACTIVE')`;
      await prisma.$executeRaw`INSERT INTO campuses (tenant_id, id, name, status)
        VALUES (${tenantId}::uuid, ${campusId}::uuid, '合成东校区', 'ACTIVE'),
               (${tenantId}::uuid, ${otherCampusId}::uuid, '合成西校区', 'ACTIVE')`;
      await prisma.$executeRaw`INSERT INTO users (id, status)
        VALUES (${managerId}::uuid, 'ACTIVE'), (${parentId}::uuid, 'ACTIVE')`;
      await prisma.$executeRaw`INSERT INTO memberships (tenant_id, id, user_id, status, updated_at)
        VALUES (${tenantId}::uuid, ${managerMembershipId}::uuid, ${managerId}::uuid,
                'ACTIVE'::membership_status, ${now})`;
      await prisma.$executeRaw`INSERT INTO membership_campuses (tenant_id, membership_id, campus_id)
        VALUES (${tenantId}::uuid, ${managerMembershipId}::uuid, ${campusId}::uuid)`;
      await prisma.$executeRaw`INSERT INTO students (tenant_id, campus_id, id, class_ref, status, display_ref)
        VALUES (${tenantId}::uuid, ${campusId}::uuid, ${studentId}::uuid, '合成班级甲', 'ACTIVE', '示例学生甲'),
               (${tenantId}::uuid, ${campusId}::uuid, ${unrelatedStudentId}::uuid, '合成班级乙', 'ACTIVE', '示例学生乙'),
               (${tenantId}::uuid, ${otherCampusId}::uuid, ${otherCampusStudentId}::uuid, '合成班级丙', 'ACTIVE', '示例学生丙')`;
      await prisma.$executeRaw`INSERT INTO binding_applications (
          tenant_id, campus_id, id, applicant_user_id, onboarding_scope_ref, student_candidate_ref,
          status, version, reviewed_by_membership_id, reviewed_at, updated_at
        ) VALUES (
          ${tenantId}::uuid, ${campusId}::uuid, ${applicationId}::uuid, ${parentId}::uuid,
          ${randomUUID()}::uuid, ${studentId}::uuid, 'APPROVED'::binding_application_status,
          2, ${managerMembershipId}::uuid, ${now}, ${now}
        )`;
      await prisma.$executeRaw`INSERT INTO guardian_relationships (
          tenant_id, campus_id, id, binding_application_id, guardian_user_id, student_id,
          status, version, approved_by_membership_id, approved_at, updated_at
        ) VALUES (
          ${tenantId}::uuid, ${campusId}::uuid, ${relationshipId}::uuid, ${applicationId}::uuid,
          ${parentId}::uuid, ${studentId}::uuid, 'ACTIVE'::guardian_relationship_status,
          1, ${managerMembershipId}::uuid, ${now}, ${now}
        )`;

      const created = await service.createFee(manager, {
        student_id: studentId,
        document_type: "BILL",
        title: "十月托管费",
        period: "2026-10",
        amount_minor: 68000,
        valid_from: "2026-10-01",
        valid_to: "2026-10-31",
        summary: "仅用于本机数据库验证的合成账单。",
      });
      assert.equal(created.version, 1);
      assert.equal(created.status, "AVAILABLE");

      await service.createFee(manager, {
        student_id: unrelatedStudentId,
        document_type: "FEE_ITEM",
        title: "未绑定学生的合成费用",
        period: "2026-10",
        amount_minor: 1000,
        valid_from: "2026-10-01",
        valid_to: "2026-10-31",
        summary: "家长没有该学生的已审核关系。",
      });
      await service.createFee(manager, {
        student_id: studentId,
        document_type: "AGREEMENT",
        title: "托管服务协议",
        period: "2026-10",
        amount_minor: null,
        valid_from: "2026-10-01",
        valid_to: "2026-10-31",
        summary: "协议资料不单列金额。",
      });
      await assert.rejects(
        service.createFee(manager, {
          student_id: otherCampusStudentId,
          document_type: "BILL",
          title: "跨校区合成费用",
          period: "2026-10",
          amount_minor: 1000,
          valid_from: "2026-10-01",
          valid_to: "2026-10-31",
          summary: "不能跨校区录入。",
        }),
        (error: unknown) =>
          error instanceof Error &&
          error.message === "NOT_FOUND_SCOPED" &&
          "statusCode" in error &&
          error.statusCode === 404,
      );

      const adminSnapshot = await service.adminFees(manager);
      assert.equal(adminSnapshot.students.length, 2);
      assert.equal(adminSnapshot.documents.length, 3);
      const parentSnapshot = await service.parentFees(parent);
      assert.equal(parentSnapshot.bindingApplications[0]?.status, "APPROVED");
      assert.equal(parentSnapshot.bindingApplications[0]?.studentLabel, "示例学生甲");
      assert.equal(parentSnapshot.documents.length, 2);
      assert.equal(parentSnapshot.documents.find((document) => document.title === "十月托管费")?.amount, 680);
      assert.equal(parentSnapshot.documents.find((document) => document.title === "托管服务协议")?.amount, null);
      assert.equal(parentSnapshot.ledger.entries.length, 1);
      assert.equal(parentSnapshot.ledger.reconciliation.balanceDueMinor, 68000);

      const revoked = await service.revokeFee(manager, created.id, { expected_version: 1 });
      assert.deepEqual(
        { version: revoked.version, status: revoked.status },
        { version: 2, status: "REVOKED" },
      );
      await assert.rejects(
        service.revokeFee(manager, created.id, { expected_version: 1 }),
        (error: unknown) =>
          error instanceof Error &&
          error.message === "CONFLICT_STATE" &&
          "statusCode" in error &&
          error.statusCode === 409,
      );
      const hiddenParentSnapshot = await service.parentFees(parent);
      const hiddenBill = hiddenParentSnapshot.documents.find((document) => document.title === "十月托管费");
      assert.equal(hiddenBill?.amount, null);
      assert.equal(hiddenBill?.available, false);
      assert.equal(hiddenParentSnapshot.documents.length, 2);
      assert.equal(hiddenParentSnapshot.ledger.entries.length, 0);

      const audit = await prisma.$queryRaw<{ count: bigint }[]>`
        SELECT count(*) AS "count" FROM fee_document_audit_events
        WHERE tenant_id = ${tenantId}::uuid AND campus_id = ${campusId}::uuid
      `;
      assert.equal(Number(audit[0]?.count), 4);
      await assert.rejects(
        prisma.$executeRaw`TRUNCATE fee_ledger_entries`,
        /fee history is append-only/u,
      );
      await assert.rejects(
        prisma.$executeRaw`TRUNCATE fee_document_audit_events`,
        /fee history is append-only/u,
      );
    } finally {
      await prisma.$disconnect();
    }
  },
);
