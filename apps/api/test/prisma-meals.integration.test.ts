import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import type { MealActorContext, MealDraftPayload } from "../src/modules/meals/meal.service.js";
import { createProductionApiOptions } from "../src/nest/production-api-options.js";

const databaseUrl = process.env.TASK20_MEALS_DATABASE_URL;

function client(): PrismaClient {
  if (databaseUrl === undefined) throw new Error("TASK20_MEALS_DATABASE_URL is required.");
  const url = new URL(databaseUrl);
  assert.equal(url.hostname, "127.0.0.1");
  assert.equal(url.port, "55439");
  assert.equal(url.pathname, "/synthetic_admin_meals");
  assert.equal(url.username, "synthetic");
  assert.equal(url.password, "");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
}

function context(actorId: string, tenantId: string, campusId: string): MealActorContext {
  return {
    trusted: true,
    actorId,
    activeMembership: true,
    scope: { tenantId, campusId },
    capabilities: ["content:write", "content:publish"],
  };
}

test(
  "Prisma meals persist ordered menus across client restart with scoped atomic versions",
  { skip: databaseUrl === undefined },
  async () => {
    const prisma = client();
    let restarted: PrismaClient | undefined;
    const tenantId = randomUUID();
    const foreignTenantId = randomUUID();
    const east = randomUUID();
    const west = randomUUID();
    const foreignCampus = randomUUID();
    const owner = randomUUID();
    const westOwner = randomUUID();
    const foreignOwner = randomUUID();
    const membershipId = randomUUID();
    const westMembershipId = randomUUID();
    const foreignMembershipId = randomUUID();
    const mealId = `a${randomUUID().slice(1)}`;
    const eastContext = context(owner, tenantId, east);
    const upperContext = context(owner.toUpperCase(), tenantId.toUpperCase(), east.toUpperCase());
    const payload: MealDraftPayload = {
      meal_date: "2026-10-22",
      meal_type: "LUNCH",
      items: ["合成主食", "合成蔬菜"],
      notes: "本地合成餐食。",
    };
    try {
      await prisma.$connect();
      const service = createProductionApiOptions(prisma, []).mealService;
      assert.ok(service, "production must provide the persistent meal service");
      await prisma.tenant.createMany({
        data: [tenantId, foreignTenantId].map((id) => ({
          id,
          name: "合成机构",
          slug: `synthetic-${id}`,
          status: "ACTIVE",
        })),
      });
      await prisma.campus.createMany({
        data: [
          { tenantId, id: east, name: "合成东校区", status: "ACTIVE" },
          { tenantId, id: west, name: "合成西校区", status: "ACTIVE" },
          { tenantId: foreignTenantId, id: foreignCampus, name: "其他合成机构", status: "ACTIVE" },
        ],
      });
      await prisma.user.createMany({
        data: [owner, westOwner, foreignOwner].map((id) => ({ id, status: "ACTIVE" })),
      });
      await prisma.membership.createMany({
        data: [
          { tenantId, id: membershipId, userId: owner, status: "ACTIVE" },
          { tenantId, id: westMembershipId, userId: westOwner, status: "ACTIVE" },
          {
            tenantId: foreignTenantId,
            id: foreignMembershipId,
            userId: foreignOwner,
            status: "ACTIVE",
          },
        ],
      });
      await prisma.membershipCampus.createMany({
        data: [
          { tenantId, campusId: east, membershipId },
          { tenantId, campusId: west, membershipId: westMembershipId },
          { tenantId: foreignTenantId, campusId: foreignCampus, membershipId: foreignMembershipId },
        ],
      });

      const created = await service.createDraft(upperContext, mealId.toUpperCase(), payload);
      assert.equal(created.ok, true);
      if (!created.ok) return;
      assert.equal(created.data.id, mealId);
      assert.equal(created.data.version, 1);
      const updated = await service.updateDraft(
        upperContext,
        mealId.toUpperCase(),
        { ...payload, items: ["合成蔬菜", "合成主食", "合成水果"] },
        1,
      );
      assert.equal(updated.ok, true);
      if (!updated.ok) return;
      assert.equal(updated.data.version, 2);
      for (const otherContext of [
        context(westOwner, tenantId, west),
        context(foreignOwner, foreignTenantId, foreignCampus),
      ]) {
        const rows = await service.listAdmin(otherContext);
        assert.equal(rows.ok, true);
        if (rows.ok) assert.deepEqual(rows.data, []);
        const denial = await service.publish(otherContext, mealId, 2);
        assert.equal(denial.ok, false);
        if (!denial.ok) assert.equal(denial.error.code, "NOT_FOUND_SCOPED");
      }
      const forgedMembership = await service.listAdmin(context(foreignOwner, tenantId, east));
      assert.equal(forgedMembership.ok, false);
      if (!forgedMembership.ok) assert.equal(forgedMembership.error.code, "FORBIDDEN_SCOPE");
      const stale = await service.updateDraft(eastContext, mealId, payload, 1);
      assert.equal(stale.ok, false);
      if (!stale.ok) assert.equal(stale.error.code, "VERSION_MISMATCH");
      const unsupported = await service.createDraft(eastContext, randomUUID(), {
        ...payload,
        private_notes: "不支持的字段",
      });
      assert.equal(unsupported.ok, false);
      if (!unsupported.ok) assert.equal(unsupported.error.code, "VALIDATION_FAILED");

      await prisma.$disconnect();
      restarted = client();
      await restarted.$connect();
      const reopened = createProductionApiOptions(restarted, []).mealService;
      assert.ok(reopened);
      const persisted = await reopened.listAdmin(upperContext);
      assert.equal(persisted.ok, true);
      if (!persisted.ok) return;
      assert.equal(persisted.data.length, 1);
      assert.equal(persisted.data[0]?.id, mealId);
      assert.equal(persisted.data[0]?.version, 2);
      assert.deepEqual(persisted.data[0]?.items, ["合成蔬菜", "合成主食", "合成水果"]);

      const concurrent = await Promise.all([
        reopened.publish(eastContext, mealId, 2),
        reopened.publish(eastContext, mealId, 2),
      ]);
      assert.equal(concurrent.filter((result) => result.ok).length, 1);
      const loser = concurrent.find((result) => !result.ok);
      assert.ok(loser && !loser.ok);
      assert.equal(loser.error.code, "VERSION_MISMATCH");
      const publishedEdit = await reopened.updateDraft(eastContext, mealId, payload, 3);
      assert.equal(publishedEdit.ok, false);
      if (!publishedEdit.ok) assert.equal(publishedEdit.error.code, "CONFLICT_STATE");
      const publicRead = await reopened.listPublic(upperContext.scope, payload.meal_date);
      assert.equal(publicRead.ok, true);
      if (!publicRead.ok) return;
      assert.equal(publicRead.data.length, 1);
      assert.deepEqual(Object.keys(publicRead.data[0]!).sort(), [
        "id",
        "items",
        "meal_date",
        "meal_type",
        "notes",
        "published_at",
      ]);
      const westPublic = await reopened.listPublic({ tenantId, campusId: west }, payload.meal_date);
      assert.equal(westPublic.ok, true);
      if (westPublic.ok) assert.deepEqual(westPublic.data, []);

      await restarted.membership.updateMany({
        where: { tenantId, id: membershipId },
        data: { status: "SUSPENDED" },
      });
      assert.equal((await reopened.listAdmin(eastContext)).ok, false);
      assert.equal((await reopened.unpublish(eastContext, mealId, 3)).ok, false);
      await restarted.membership.updateMany({
        where: { tenantId, id: membershipId },
        data: { status: "ACTIVE" },
      });
      await restarted.user.update({ where: { id: owner }, data: { status: "INACTIVE" } });
      assert.equal((await reopened.listAdmin(eastContext)).ok, false);
      await restarted.user.update({ where: { id: owner }, data: { status: "ACTIVE" } });
      await restarted.campus.update({
        where: { tenantId_id: { tenantId, id: east } },
        data: { status: "INACTIVE" },
      });
      assert.equal((await reopened.listAdmin(eastContext)).ok, false);
      const inactivePublic = await reopened.listPublic(eastContext.scope, payload.meal_date);
      assert.equal(inactivePublic.ok, true);
      if (inactivePublic.ok) assert.deepEqual(inactivePublic.data, []);
      await restarted.campus.update({
        where: { tenantId_id: { tenantId, id: east } },
        data: { status: "ACTIVE" },
      });
      const withdrawn = await reopened.unpublish(eastContext, mealId, 3);
      assert.equal(withdrawn.ok, true);
      if (withdrawn.ok) assert.equal(withdrawn.data.version, 4);
      const hidden = await reopened.listPublic(eastContext.scope, payload.meal_date);
      assert.equal(hidden.ok, true);
      if (hidden.ok) assert.deepEqual(hidden.data, []);
    } finally {
      await prisma.$disconnect();
      await restarted?.$disconnect();
    }
  },
);
