import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaLearningInstitutionSettingService } from "../src/modules/learning/prisma-learning-institution-setting.service.js";

test(
  "real PostgreSQL institution setting persists across service restart, scopes every campus and prevents concurrent overwrite",
  { skip: !process.env.DATABASE_URL },
  async () => {
    const url = new URL(process.env.DATABASE_URL!);
    assert.equal(url.hostname, "127.0.0.1");
    assert.equal(url.port, "55432");
    assert.equal(url.pathname, "/student_care_a1310");
    const create = () =>
      new PrismaClient({ adapter: new PrismaPg({ connectionString: url.href }) });
    const prisma = create();
    let reopened: PrismaClient | undefined;
    const tenant = randomUUID(),
      otherTenant = randomUUID(),
      east = randomUUID(),
      west = randomUUID(),
      otherCampus = randomUUID(),
      actor = randomUUID(),
      member = randomUUID(),
      otherMember = randomUUID();
    const context = {
      tenantId: tenant,
      campusId: east,
      actorId: actor,
      capabilities: ["learning:institution-setting"],
    };
    try {
      await prisma.tenant.createMany({
        data: [tenant, otherTenant].map((id) => ({
          id,
          name: "合成学习设置机构",
          slug: "setting-" + id,
          status: "ACTIVE",
        })),
      });
      await prisma.campus.createMany({
        data: [
          { tenantId: tenant, id: east, name: "合成东校区", status: "ACTIVE" },
          { tenantId: tenant, id: west, name: "合成西校区", status: "ACTIVE" },
          { tenantId: otherTenant, id: otherCampus, name: "合成其他机构校区", status: "ACTIVE" },
        ],
      });
      await prisma.user.create({ data: { id: actor, status: "ACTIVE" } });
      await prisma.membership.createMany({
        data: [
          { id: member, tenantId: tenant, userId: actor, status: "ACTIVE" },
          { id: otherMember, tenantId: otherTenant, userId: actor, status: "ACTIVE" },
        ],
      });
      await prisma.membershipCampus.createMany({
        data: [
          { tenantId: tenant, campusId: east, membershipId: member },
          { tenantId: tenant, campusId: west, membershipId: member },
          { tenantId: otherTenant, campusId: otherCampus, membershipId: otherMember },
        ],
      });
      const service = new PrismaLearningInstitutionSettingService(prisma);
      assert.deepEqual(await service.read(context), { enabled: false, version: 0 });
      const first = await Promise.allSettled([
        service.update(context, { enabled: true, expectedVersion: 0 }),
        service.update(context, { enabled: false, expectedVersion: 0 }),
      ]);
      assert.equal(first.filter((r) => r.status === "fulfilled").length, 1);
      const duplicate = first.find((r) => r.status === "rejected");
      assert.equal(duplicate?.status === "rejected" && duplicate.reason.statusCode, 409);
      const initial = await service.read(context);
      assert.equal(initial.version, 1);
      assert.deepEqual(await service.read({ ...context, campusId: west }), {
        enabled: false,
        version: 0,
      });
      assert.deepEqual(
        await service.read({ ...context, tenantId: otherTenant, campusId: otherCampus }),
        { enabled: false, version: 0 },
      );
      await assert.rejects(
        service.update(
          { ...context, tenantId: otherTenant },
          { enabled: true, expectedVersion: 1 },
        ),
        { statusCode: 403 },
      );
      await assert.rejects(service.read({ ...context, actorId: randomUUID() }), {
        statusCode: 403,
      });
      const writes = await Promise.allSettled([
        service.update(context, { enabled: true, expectedVersion: 1 }),
        service.update(context, { enabled: false, expectedVersion: 1 }),
      ]);
      assert.equal(writes.filter((r) => r.status === "fulfilled").length, 1);
      const conflict = writes.find((r) => r.status === "rejected");
      assert.equal(conflict?.status === "rejected" && conflict.reason.statusCode, 409);
      const saved = await service.read(context);
      assert.equal(saved.version, 2);
      await prisma.$disconnect();
      reopened = create();
      const restarted = new PrismaLearningInstitutionSettingService(reopened);
      assert.deepEqual(await restarted.read(context), saved);
      const stored = await reopened.aIInstitutionSetting.findUniqueOrThrow({
        where: { tenantId_campusId: { tenantId: tenant, campusId: east } },
      });
      assert.equal(stored.updatedByMembershipId, member);
      await reopened.membership.update({
        where: { tenantId_id: { tenantId: tenant, id: member } },
        data: { status: "SUSPENDED" },
      });
      await assert.rejects(
        restarted.update(context, { enabled: !saved.enabled, expectedVersion: 2 }),
        { statusCode: 403 },
      );
      assert.equal(
        (
          await reopened.aIInstitutionSetting.findUniqueOrThrow({
            where: { tenantId_campusId: { tenantId: tenant, campusId: east } },
          })
        ).version,
        2,
      );
    } finally {
      const cleanup = reopened ?? prisma;
      await cleanup.aIInstitutionSetting.deleteMany({
        where: { tenantId: { in: [tenant, otherTenant] } },
      });
      await cleanup.membershipCampus.deleteMany({
        where: { tenantId: { in: [tenant, otherTenant] } },
      });
      await cleanup.membership.deleteMany({ where: { tenantId: { in: [tenant, otherTenant] } } });
      await cleanup.user.deleteMany({ where: { id: actor } });
      await cleanup.campus.deleteMany({ where: { tenantId: { in: [tenant, otherTenant] } } });
      await cleanup.tenant.deleteMany({ where: { id: { in: [tenant, otherTenant] } } });
      await cleanup.$disconnect();
      if (reopened) await prisma.$disconnect();
    }
  },
);
