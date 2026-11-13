import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import {
  PrismaCareRecordService,
  type CareRecordContext,
} from "../src/modules/care-records/prisma-care-record.service.js";
import { PrismaGuardianBindingService } from "../src/modules/guardian-bindings/prisma-guardian-binding.service.js";

const databaseUrl = process.env.DATABASE_URL;

test("binding reviewer sees trusted labels only from the application's exact scope", async () => {
  const actorId = randomUUID(),
    applicantId = randomUUID(),
    tenantId = randomUUID(),
    campusId = randomUUID(),
    studentId = randomUUID();
  const applicationId = randomUUID();
  const queries: unknown[] = [];
  let wrongCampus = false;
  const prisma = {
    bindingApplication: {
      findMany: async (query: unknown) => {
        queries.push(query);
        return [
          {
            id: applicationId,
            applicantUserId: applicantId,
            tenantId,
            campusId,
            studentCandidateRef: studentId,
            status: "PENDING",
            version: 1,
            createdAt: new Date("2026-10-21T00:00:00Z"),
            reviewedAt: null,
          },
        ];
      },
    },
    student: {
      findMany: async (query: unknown) => {
        queries.push(query);
        return [
          {
            id: studentId,
            tenantId,
            campusId: wrongCampus ? randomUUID() : campusId,
            displayRef: "虚构学生乙",
          },
        ];
      },
    },
  } as unknown as PrismaClient;
  const service = new PrismaGuardianBindingService(
    prisma,
    new Map(),
    new Map([[applicantId, "虚构家长乙"]]),
  );
  const context = { scopes: [{ actorId, tenantId, campusId }] };
  const rows = await service.listPendingForReview(context);
  assert.deepEqual(rows, [
    {
      id: applicationId,
      relationship: "GUARDIAN",
      status: "PENDING",
      version: 1,
      submitted_at: "2026-10-21T00:00:00.000Z",
      reviewed_at: null,
      applicant_label: "虚构家长乙",
      student_label: "虚构学生乙",
    },
  ]);
  assert.deepEqual(queries, [
    {
      where: { status: "PENDING", OR: [{ tenantId, campusId }] },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: 100,
    },
    {
      where: { OR: [{ id: studentId, tenantId, campusId }] },
      select: { id: true, tenantId: true, campusId: true, displayRef: true },
    },
  ]);
  assert.doesNotMatch(
    JSON.stringify(rows),
    /applicantUserId|studentCandidateRef|tenantId|campusId/,
  );
  wrongCampus = true;
  assert.equal((await service.listPendingForReview(context))[0]?.student_label, "学生信息待补充");
  assert.deepEqual(await service.listPendingForReview({ scopes: [] }), []);
});

test(
  "care mutation and detail responses preserve current authorized actions throughout review and publication",
  { skip: databaseUrl === undefined },
  async () => {
    const url = new URL(databaseUrl!);
    assert.equal(url.hostname, "127.0.0.1");
    assert.equal(url.port, "55436");
    assert.equal(url.pathname, "/student_care_a188_synthetic");
    const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
    const tenantId = randomUUID(),
      campusId = randomUUID(),
      otherCampusId = randomUUID();
    const teacherId = randomUUID(),
      reviewerId = randomUUID(),
      studentId = randomUUID();
    const teacherMembership = randomUUID(),
      reviewerMembership = randomUUID();
    const classRef = "A190-虚构班级";
    const teacher: CareRecordContext = {
      scopes: [
        {
          scope: { actorId: teacherId, tenantId, campusId },
          capabilities: ["care:write", "care:review"],
        },
      ],
    };
    const reviewer: CareRecordContext = {
      scopes: [
        {
          scope: { actorId: reviewerId, tenantId, campusId },
          capabilities: ["care:review", "care:publish"],
        },
      ],
    };
    const values = {
      arrival: "ARRIVED_AS_PLANNED",
      homework: "IN_PROGRESS",
      meal: "FINISHED",
      rest: "RESTED",
      activity: "PARTICIPATED",
      wellbeing: "ROUTINE",
    } as const;
    try {
      await prisma.$connect();
      await prisma.tenant.create({
        data: {
          id: tenantId,
          name: "A190独立虚构机构",
          slug: `a190-${tenantId}`,
          status: "ACTIVE",
        },
      });
      await prisma.campus.createMany({
        data: [campusId, otherCampusId].map((id) => ({
          id,
          tenantId,
          name: "A190虚构校区",
          status: "ACTIVE",
        })),
      });
      for (const [userId, membershipId] of [
        [teacherId, teacherMembership],
        [reviewerId, reviewerMembership],
      ] as const) {
        await prisma.user.create({ data: { id: userId, status: "ACTIVE" } });
        await prisma.membership.create({
          data: { id: membershipId, tenantId, userId, status: "ACTIVE" },
        });
        await prisma.membershipCampus.create({ data: { tenantId, campusId, membershipId } });
        await prisma.membershipClass.create({
          data: { tenantId, campusId, membershipId, classRef },
        });
      }
      await prisma.student.create({
        data: {
          id: studentId,
          tenantId,
          campusId,
          classRef,
          displayRef: "A190虚构学生",
          status: "ACTIVE",
        },
      });
      const service = new PrismaCareRecordService(prisma);
      const created = await service.create(teacher, {
        student_id: studentId,
        service_date: "2026-10-21",
        values,
      });
      assert.ok(created.ok);
      assert.deepEqual(created.data.actions, ["edit", "submit", "withdraw"]);
      const detail = await service.getStaff(teacher, created.data.id);
      assert.ok(detail.ok);
      assert.deepEqual(detail.data.actions, ["edit", "submit", "withdraw"]);
      const hidden = await service.getStaff(
        {
          scopes: [
            {
              ...reviewer.scopes[0]!,
              scope: { actorId: reviewerId, tenantId, campusId: otherCampusId },
            },
          ],
        },
        created.data.id,
      );
      assert.equal(hidden.ok, false);
      const submitted = await service.submit(teacher, created.data.id, {
        version: created.data.version,
      });
      assert.ok(submitted.ok);
      assert.deepEqual(submitted.data.actions, ["withdraw"]);
      const ownReview = await service.review(teacher, created.data.id, {
        version: submitted.data.version,
        action: "confirm",
      });
      assert.equal(ownReview.ok, false);
      const reviewDetail = await service.getStaff(reviewer, created.data.id);
      assert.ok(reviewDetail.ok);
      assert.deepEqual(reviewDetail.data.actions, ["review"]);
      const returned = await service.review(reviewer, created.data.id, {
        version: submitted.data.version,
        action: "return",
      });
      assert.ok(returned.ok);
      assert.deepEqual(returned.data.actions, []);
      const writerDetail = await service.getStaff(teacher, created.data.id);
      assert.ok(writerDetail.ok);
      assert.deepEqual(writerDetail.data.actions, ["edit", "resubmit", "withdraw"]);
      const resubmitted = await service.resubmit(teacher, created.data.id, {
        version: returned.data.version,
        values,
      });
      assert.ok(resubmitted.ok);
      assert.deepEqual(resubmitted.data.actions, ["withdraw"]);
      const confirmed = await service.review(reviewer, created.data.id, {
        version: resubmitted.data.version,
        action: "confirm",
      });
      assert.ok(confirmed.ok);
      assert.deepEqual(confirmed.data.actions, ["publish"]);
      const published = await service.publish(reviewer, created.data.id, {
        version: confirmed.data.version,
      });
      assert.ok(published.ok);
      assert.equal(published.data.published, true);
      assert.deepEqual(published.data.actions, ["revoke-publication"]);
      const authorCannotRevoke = await service.revokePublication(teacher, created.data.id, {
        version: published.data.version,
      });
      assert.equal(authorCannotRevoke.ok, false);
      const revoked = await service.revokePublication(reviewer, created.data.id, {
        version: published.data.version,
      });
      assert.ok(revoked.ok);
      assert.equal(revoked.data.published, false);
      assert.equal(revoked.data.publication_version, 1);
      assert.deepEqual(revoked.data.actions, ["publish"]);
      const staleRevocation = await service.revokePublication(reviewer, created.data.id, {
        version: published.data.version,
      });
      assert.equal(staleRevocation.ok, false);
      const republished = await service.publish(reviewer, created.data.id, {
        version: revoked.data.version,
      });
      assert.ok(republished.ok);
      assert.equal(republished.data.published, true);
      assert.equal(republished.data.publication_version, 2);
      assert.deepEqual(republished.data.actions, ["revoke-publication"]);
    } finally {
      await prisma.$disconnect();
    }
  },
);
