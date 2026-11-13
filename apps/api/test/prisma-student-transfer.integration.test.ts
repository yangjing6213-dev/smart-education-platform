import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaStudentTransferService } from "../src/modules/student-transfers/prisma-student-transfer.service.js";

const databaseUrl = process.env.TRANSFER_TEST_DATABASE_URL;
const rejectStatus = (operation: Promise<unknown>, status: number) =>
  assert.rejects(
    operation,
    (error: unknown) =>
      error instanceof Error && "statusCode" in error && error.statusCode === status,
  );

test(
  "same-campus transfers require independent approval, preserve rejected classes, and commit audit atomically",
  { skip: !databaseUrl },
  async () => {
    const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl! }) });
    const tenantId = randomUUID(),
      otherTenant = randomUUID();
    const campusId = randomUUID(),
      otherCampus = randomUUID(),
      foreignCampus = randomUUID();
    const requesterId = randomUUID(),
      reviewerId = randomUUID(),
      outsiderId = randomUUID();
    const requesterMember = randomUUID(),
      reviewerMember = randomUUID(),
      outsiderMember = randomUUID(),
      foreignMember = randomUUID();
    const students = Array.from({ length: 6 }, () => randomUUID());
    const targetStudent = randomUUID(),
      closingTarget = randomUUID(),
      crossStudent = randomUUID(),
      foreignStudent = randomUUID();
    const service = new PrismaStudentTransferService(db);
    const requester = {
      tenantId,
      campusId,
      actorId: requesterId,
      capabilities: ["students:transfer:request"],
    };
    const reviewer = {
      tenantId,
      campusId,
      actorId: reviewerId,
      capabilities: ["students:transfer:review"],
    };
    const outsider = { ...requester, actorId: outsiderId };
    const studentClass = async (id: string) =>
      (
        await db.student.findUniqueOrThrow({
          where: { tenantId_campusId_id: { tenantId, campusId, id } },
        })
      ).classRef;
    try {
      await db.tenant.createMany({
        data: [tenantId, otherTenant].map((id) => ({
          id,
          name: "合成转班测试机构",
          slug: `transfer-${id}`,
          status: "ACTIVE",
        })),
      });
      await db.campus.createMany({
        data: [
          { tenantId, id: campusId, name: "合成东校区", status: "ACTIVE" },
          { tenantId, id: otherCampus, name: "合成西校区", status: "ACTIVE" },
          { tenantId: otherTenant, id: foreignCampus, name: "合成其他机构校区", status: "ACTIVE" },
        ],
      });
      await db.user.createMany({
        data: [requesterId, reviewerId, outsiderId].map((id) => ({ id, status: "ACTIVE" })),
      });
      await db.membership.createMany({
        data: [
          { tenantId, id: requesterMember, userId: requesterId, status: "ACTIVE" },
          { tenantId, id: reviewerMember, userId: reviewerId, status: "ACTIVE" },
          { tenantId, id: outsiderMember, userId: outsiderId, status: "ACTIVE" },
          { tenantId: otherTenant, id: foreignMember, userId: reviewerId, status: "ACTIVE" },
        ],
      });
      await db.membershipCampus.createMany({
        data: [
          ...[requesterMember, reviewerMember, outsiderMember].map((membershipId) => ({
            tenantId,
            campusId,
            membershipId,
          })),
          { tenantId, campusId: otherCampus, membershipId: reviewerMember },
          { tenantId: otherTenant, campusId: foreignCampus, membershipId: foreignMember },
        ],
      });
      await db.membershipClass.createMany({
        data: [
          { tenantId, campusId, membershipId: requesterMember, classRef: "合成甲班" },
          { tenantId, campusId, membershipId: outsiderMember, classRef: "合成乙班" },
        ],
      });
      await db.student.createMany({
        data: [
          ...students.map((id, i) => ({
            tenantId,
            campusId,
            id,
            classRef: "合成甲班",
            status: "ACTIVE",
            displayRef: `示例学生${i + 1}`,
          })),
          {
            tenantId,
            campusId,
            id: targetStudent,
            classRef: "合成乙班",
            status: "ACTIVE",
            displayRef: "示例乙班学生",
          },
          {
            tenantId,
            campusId,
            id: closingTarget,
            classRef: "合成丙班",
            status: "ACTIVE",
            displayRef: "示例丙班学生",
          },
          {
            tenantId,
            campusId: otherCampus,
            id: crossStudent,
            classRef: "外校班",
            status: "ACTIVE",
            displayRef: "示例其他校区学生",
          },
          {
            tenantId: otherTenant,
            campusId: foreignCampus,
            id: foreignStudent,
            classRef: "其他机构班",
            status: "ACTIVE",
            displayRef: "示例其他机构学生",
          },
        ],
      });
      const listing = await service.list(requester);
      assert.equal(listing.students.length, 6);
      assert.deepEqual(
        listing.destinationClasses.slice().sort(),
        ["合成丙班", "合成乙班", "合成甲班"].sort(),
      );
      const input = { student_id: students[0]!, destination_class_ref: "合成乙班" };
      const pending = await service.create(requester, input);
      assert.equal(pending.status, "PENDING");
      assert.equal(await studentClass(input.student_id), "合成甲班");
      assert.deepEqual(
        pending.events.map((e) => e.action),
        ["CREATED"],
      );
      await rejectStatus(service.create(requester, input), 409);
      await rejectStatus(service.create(outsider, { ...input, student_id: students[1] }), 403);
      await rejectStatus(service.create(requester, { ...input, student_id: crossStudent }), 404);
      await rejectStatus(service.create(requester, { ...input, student_id: foreignStudent }), 404);
      await rejectStatus(
        service.create(requester, { ...input, destination_class_ref: "外校班" }),
        409,
      );
      await rejectStatus(
        service.create(requester, { ...input, destination_class_ref: "合成甲班" }),
        409,
      );
      await rejectStatus(service.create({ ...requester, capabilities: [] }, input), 403);
      await rejectStatus(
        service.review({ ...requester, capabilities: ["students:transfer:review"] }, pending.id, {
          decision: "APPROVE",
          expected_version: 1,
        }),
        403,
      );
      await rejectStatus(
        service.review(reviewer, pending.id, { decision: "APPROVE", expected_version: 2 }),
        409,
      );
      await rejectStatus(
        service.review({ ...reviewer, campusId: otherCampus }, pending.id, {
          decision: "APPROVE",
          expected_version: 1,
        }),
        404,
      );
      await rejectStatus(
        service.review(
          { ...reviewer, tenantId: otherTenant, campusId: foreignCampus },
          pending.id,
          { decision: "APPROVE", expected_version: 1 },
        ),
        404,
      );
      assert.equal((await service.list(outsider)).requests.length, 0);
      assert.equal((await service.list(reviewer)).requests[0]?.canApprove, true);
      const approved = await service.review(reviewer, pending.id, {
        decision: "APPROVE",
        expected_version: 1,
      });
      assert.equal(approved.status, "APPROVED");
      assert.equal(approved.version, 2);
      assert.equal(await studentClass(input.student_id), "合成乙班");
      assert.deepEqual(
        approved.events.map((e) => [e.action, e.actorId]),
        [
          ["CREATED", requesterId],
          ["APPROVED", reviewerId],
        ],
      );
      await rejectStatus(
        service.review(reviewer, pending.id, { decision: "REJECT", expected_version: 1 }),
        409,
      );

      const rejected = await service.create(requester, { ...input, student_id: students[1] });
      assert.equal(
        (await service.review(reviewer, rejected.id, { decision: "REJECT", expected_version: 1 }))
          .status,
        "REJECTED",
      );
      assert.equal(await studentClass(students[1]!), "合成甲班");

      const stale = await service.create(requester, { ...input, student_id: students[2] });
      const staleStudentId = students[2];
      assert.ok(staleStudentId);
      await db.student.updateMany({
        where: { tenantId, campusId, id: staleStudentId },
        data: { classRef: "合成乙班" },
      });
      await rejectStatus(
        service.review(reviewer, stale.id, { decision: "APPROVE", expected_version: 1 }),
        409,
      );
      assert.equal(
        (await service.list(reviewer)).requests.find((r) => r.id === stale.id)?.canApprove,
        false,
      );
      await service.review(reviewer, stale.id, { decision: "REJECT", expected_version: 1 });

      const noTarget = await service.create(requester, {
        student_id: students[3],
        destination_class_ref: "合成丙班",
      });
      await db.student.updateMany({
        where: { tenantId, campusId, id: closingTarget },
        data: { status: "INACTIVE" },
      });
      await rejectStatus(
        service.review(reviewer, noTarget.id, { decision: "APPROVE", expected_version: 1 }),
        409,
      );
      await service.review(reviewer, noTarget.id, { decision: "REJECT", expected_version: 1 });

      const competing = await Promise.allSettled(
        [1, 2].map(() => service.create(requester, { ...input, student_id: students[4] })),
      );
      assert.equal(competing.filter((r) => r.status === "fulfilled").length, 1);
      const created = competing.find((r) => r.status === "fulfilled");
      assert.ok(created?.status === "fulfilled");
      const reviews = await Promise.allSettled(
        ["APPROVE", "REJECT"].map((decision) =>
          service.review(reviewer, created.value.id, { decision, expected_version: 1 }),
        ),
      );
      assert.equal(reviews.filter((r) => r.status === "fulfilled").length, 1);
      assert.equal(
        await db.studentTransferAuditEvent.count({
          where: { tenantId, campusId, requestId: created.value.id },
        }),
        2,
      );

      const rollback = await service.create(requester, { ...input, student_id: students[5] });
      await db.$executeRawUnsafe(
        "CREATE FUNCTION transfer_test_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'intentional synthetic audit failure'; END; $$",
      );
      await db.$executeRawUnsafe(
        "CREATE TRIGGER transfer_test_audit_failure BEFORE INSERT ON student_transfer_audit_events FOR EACH ROW EXECUTE FUNCTION transfer_test_audit_failure()",
      );
      try {
        await assert.rejects(
          service.review(reviewer, rollback.id, { decision: "APPROVE", expected_version: 1 }),
          /intentional synthetic audit failure/u,
        );
        assert.equal(await studentClass(students[5]!), "合成甲班");
        assert.equal(
          (
            await db.studentTransferRequest.findUniqueOrThrow({
              where: { tenantId_campusId_id: { tenantId, campusId, id: rollback.id } },
            })
          ).status,
          "PENDING",
        );
        assert.equal(
          await db.studentTransferAuditEvent.count({
            where: { tenantId, campusId, requestId: rollback.id },
          }),
          1,
        );
      } finally {
        await db.$executeRawUnsafe(
          "DROP TRIGGER transfer_test_audit_failure ON student_transfer_audit_events",
        );
        await db.$executeRawUnsafe("DROP FUNCTION transfer_test_audit_failure()");
      }
      for (const sql of [
        "UPDATE student_transfer_audit_events SET request_version = request_version",
        "DELETE FROM student_transfer_audit_events",
        "TRUNCATE student_transfer_audit_events",
      ])
        await assert.rejects(db.$executeRawUnsafe(sql), /append-only/u);
      await db.membership.update({
        where: { tenantId_id: { tenantId, id: reviewerMember } },
        data: { status: "SUSPENDED" },
      });
      await rejectStatus(service.list(reviewer), 403);
    } finally {
      await db.$disconnect();
    }
  },
);
