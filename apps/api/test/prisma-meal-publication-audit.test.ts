import assert from "node:assert/strict";
import test from "node:test";
import type { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaMealPublicationAuditService } from "../src/modules/audit/prisma-meal-publication-audit.service.js";
import { PrismaMealService } from "../src/modules/meals/prisma-meal.service.js";
import type { AuditReadContext } from "../src/modules/audit/audit.service.js";

const TENANT_ID = "00000000-0000-4000-8000-000000000001";
const CAMPUS_ID = "00000000-0000-4000-8000-000000000002";
const OTHER_CAMPUS_ID = "00000000-0000-4000-8000-000000000003";
const MEMBERSHIP_ID = "00000000-0000-4000-8000-000000000004";
const ACTOR_ID = "00000000-0000-4000-8000-000000000005";
const MEAL_ID = "00000000-0000-4000-8000-000000000006";

interface StoredEvent {
  readonly id: string;
  readonly tenant_id: string;
  readonly campus_id: string;
  readonly meal_plan_id: string;
  readonly action: "PUBLISHED" | "UNPUBLISHED";
  readonly resulting_version: number;
  readonly actor_membership_id: string;
  readonly occurred_at: Date;
}

function context(campusId = CAMPUS_ID): AuditReadContext {
  return {
    trusted: true,
    actorId: ACTOR_ID,
    activeMembership: true,
    scope: { tenantId: TENANT_ID, campusId },
    capabilities: ["content:publish", "memberships:read"],
  };
}

function createPrismaFixture() {
  let row = {
    tenantId: TENANT_ID,
    campusId: CAMPUS_ID,
    id: MEAL_ID,
    publishStatus: "DRAFT",
    version: 1,
    serviceDate: new Date("2026-10-22T00:00:00.000Z"),
    mealPeriod: "LUNCH",
    notes: "仅用于本机自动测试的合成餐食。",
    publishedAt: null as Date | null,
    updatedByMembershipId: MEMBERSHIP_ID,
    updatedAt: new Date("2026-10-22T08:00:00.000Z"),
    items: [{ position: 0, itemName: "合成主食" }],
    updatedBy: { membership: { userId: ACTOR_ID } },
  };
  const events: StoredEvent[] = [];
  let insideTransaction = false;
  let failNextEventWrite = false;

  const database = {
    membershipCampus: {
      findMany: async () => [{ membershipId: MEMBERSHIP_ID }],
    },
    mealPlan: {
      findUnique: async () => row,
      updateMany: async ({ data }: { data: Partial<typeof row> }) => {
        row = { ...row, ...data };
        return { count: 1 };
      },
    },
    $executeRaw: async (_strings: TemplateStringsArray, ...values: unknown[]) => {
      assert.equal(
        insideTransaction,
        true,
        "the publication event is written inside the meal transaction",
      );
      if (failNextEventWrite) {
        failNextEventWrite = false;
        throw new Error("synthetic audit insert failure");
      }
      events.push({
        tenant_id: String(values[0]),
        campus_id: String(values[1]),
        id: String(values[2]),
        meal_plan_id: String(values[3]),
        action: values[4] as StoredEvent["action"],
        resulting_version: Number(values[5]),
        actor_membership_id: String(values[6]),
        occurred_at: values[7] as Date,
      });
      return 1;
    },
  };

  const prisma = {
    $transaction: async <T>(work: (transaction: typeof database) => Promise<T>) => {
      const rowBefore = row;
      const eventCountBefore = events.length;
      insideTransaction = true;
      try {
        return await work(database);
      } catch (error) {
        row = rowBefore;
        events.splice(eventCountBefore);
        throw error;
      } finally {
        insideTransaction = false;
      }
    },
    $queryRaw: async (_strings: TemplateStringsArray, ...values: unknown[]) => {
      const tenantId = String(values[0]);
      const campusId = String(values[1]);
      const limit = Number(values[2]);
      return events
        .filter((event) => event.tenant_id === tenantId && event.campus_id === campusId)
        .sort((left, right) => right.occurred_at.getTime() - left.occurred_at.getTime())
        .slice(0, limit);
    },
  } as unknown as PrismaClient;

  return {
    prisma,
    events,
    get row() {
      return row;
    },
    failNextEventWrite() {
      failNextEventWrite = true;
    },
  };
}

test("publish and unpublish append durable scoped events in the same transaction", async () => {
  const fixture = createPrismaFixture();
  const meals = new PrismaMealService(fixture.prisma, () => new Date("2026-10-22T09:00:00.000Z"));
  const audit = new PrismaMealPublicationAuditService(fixture.prisma);

  const published = await meals.publish(context(), MEAL_ID, 1);
  assert.equal(published.ok, true);
  assert.equal(fixture.events.length, 1);
  assert.equal(fixture.events[0]?.action, "PUBLISHED");
  assert.equal(fixture.events[0]?.resulting_version, 2);
  assert.equal(fixture.events[0]?.actor_membership_id, MEMBERSHIP_ID);

  const afterRecreation = new PrismaMealPublicationAuditService(fixture.prisma);
  const listed = await afterRecreation.list(context(), 10);
  assert.equal(listed.ok, true);
  if (!listed.ok) return;
  assert.equal(listed.data.length, 1);
  assert.equal(listed.data[0]?.meal_id, MEAL_ID);
  assert.equal("student_id" in listed.data[0]!, false);
  assert.deepEqual(await audit.list(context(OTHER_CAMPUS_ID)), { ok: true, data: [] });

  const stale = await meals.publish(context(), MEAL_ID, 1);
  assert.equal(stale.ok, false);
  assert.equal(fixture.events.length, 1, "a stale transition does not append another event");

  const unpublished = await meals.unpublish(context(), MEAL_ID, 2);
  assert.equal(unpublished.ok, true);
  assert.equal(fixture.events.length, 2);
  assert.equal(fixture.events[1]?.action, "UNPUBLISHED");
  assert.equal(fixture.events[1]?.resulting_version, 3);
});

test("publication state rolls back when its audit event cannot be stored", async () => {
  const fixture = createPrismaFixture();
  const meals = new PrismaMealService(fixture.prisma, () => new Date("2026-10-22T09:00:00.000Z"));
  assert.equal((await meals.publish(context(), MEAL_ID, 1)).ok, true);
  const before = fixture.row;
  fixture.failNextEventWrite();

  await assert.rejects(meals.unpublish(context(), MEAL_ID, 2), /synthetic audit insert failure/);
  assert.equal(fixture.row.publishStatus, before.publishStatus);
  assert.equal(fixture.row.version, before.version);
  assert.equal(fixture.events.length, 1);
});

test("meal publication audit reads require the existing audit membership capability", async () => {
  const fixture = createPrismaFixture();
  const audit = new PrismaMealPublicationAuditService(fixture.prisma);
  const unauthorized = await audit.list({ ...context(), capabilities: ["content:read"] });
  assert.deepEqual(unauthorized, { ok: false, error: { code: "FORBIDDEN_SCOPE" } });
  assert.deepEqual(await audit.list(context(), 101), {
    ok: false,
    error: { code: "VALIDATION_FAILED" },
  });
});
