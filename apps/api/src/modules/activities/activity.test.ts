import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import path from "node:path";
import fastify from "fastify";
import { buildServer } from "../../server.js";
import { registerPublicActivityRoutes } from "../../routes/public-activities.route.js";
import {
  ActivityService,
  InMemoryActivityRepository,
  type ActivityActorContext,
  type ActivityDraftPayload,
  type ActivityProfileRecord,
  type ActivityProfileRepository,
  type ActivityPublicationAuditEvent,
} from "./activity.service.js";
import {
  InMemoryMealRepository,
  MealService,
  type MealActorContext,
  type MealDraftPayload,
} from "../meals/meal.service.js";

const ACTOR_ID = "00000000-0000-4000-8000-000000000003";
const TENANT_ID = "00000000-0000-4000-8000-000000000001";
const CAMPUS_ID = "00000000-0000-4000-8000-000000000002";
const FOREIGN_TENANT_ID = "00000000-0000-4000-8000-000000000004";

const activityPayload = {
  title: "模拟春日手工活动",
  summary: "仅用于测试的虚构活动摘要。",
  start_date: "2026-09-10",
  end_date: "2026-09-12",
  location: "模拟一号教室",
  media_ref: "file-ref:/synthetic/activity-one.png",
  private_notes: "仅供机构内部使用的模拟备注",
} as const satisfies ActivityDraftPayload;

const ownerContext = {
  trusted: true,
  actorId: ACTOR_ID,
  activeMembership: true,
  scope: { tenantId: TENANT_ID, campusId: CAMPUS_ID },
  capabilities: ["content:write", "content:publish"],
} as const satisfies ActivityActorContext;

const mealPayload = {
  meal_date: "2026-09-10",
  meal_type: "LUNCH",
  items: ["模拟番茄面", "模拟时蔬"],
  notes: "仅用于测试的虚构菜单说明。",
  media_ref: "file-ref:/synthetic/meal-one.png",
  private_notes: "模拟过敏备注，不得公开",
} as const satisfies MealDraftPayload;

const mealContext = {
  trusted: true,
  actorId: ACTOR_ID,
  activeMembership: true,
  scope: { tenantId: TENANT_ID, campusId: CAMPUS_ID },
  capabilities: ["content:write", "content:publish"],
} as const satisfies MealActorContext;

test("public activities expose only published date-matched allowlisted fields", () => {
  const service = new ActivityService(new InMemoryActivityRepository());

  assert.deepEqual(service.listPublic(ownerContext.scope, "2026-09-10"), {
    ok: true,
    data: [],
  });
  assert.equal(service.createDraft(ownerContext, "activity-one", activityPayload).ok, true);
  assert.deepEqual(service.listPublic(ownerContext.scope, "2026-09-10"), {
    ok: true,
    data: [],
  });
  assert.equal(service.publish(ownerContext, "activity-one", 1).ok, true);

  const result = service.listPublic(ownerContext.scope, "2026-09-11");
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(Object.keys(result.data[0]!).sort(), [
    "end_date",
    "id",
    "location",
    "media_ref",
    "published_at",
    "start_date",
    "summary",
    "title",
  ]);
  assert.equal("version" in result.data[0]!, false);
  assert.equal("tenant_id" in result.data[0]!, false);
  assert.equal("campus_id" in result.data[0]!, false);
  assert.equal("private_notes" in result.data[0]!, false);
  assert.equal("synthetic_data" in result.data[0]!, false);
});

test("activity validation fails closed for dates, media, scope, and capability", () => {
  const service = new ActivityService(new InMemoryActivityRepository());
  const invalidPayloads: readonly unknown[] = [
    { ...activityPayload, start_date: "2026-02-30" },
    { ...activityPayload, start_date: "2026-09-13" },
    { ...activityPayload, start_date: "2026-09-10", end_date: "2026-09-09" },
    { ...activityPayload, media_ref: "https://external.invalid/activity.png" },
    { ...activityPayload, title: "" },
    { ...activityPayload, start_date: "09/10/2026" },
  ];
  for (const payload of invalidPayloads) {
    assert.equal(
      service.createDraft(ownerContext, "invalid-activity", payload as ActivityDraftPayload).ok,
      false,
    );
  }

  const deniedContexts: readonly ActivityActorContext[] = [
    { ...ownerContext, trusted: false } as unknown as ActivityActorContext,
    { ...ownerContext, activeMembership: false } as unknown as ActivityActorContext,
    { ...ownerContext, capabilities: ["content:read"] },
    { ...ownerContext, scope: { tenantId: "", campusId: CAMPUS_ID } } as ActivityActorContext,
    { ...ownerContext, scope: { tenantId: TENANT_ID, campusId: "" } } as ActivityActorContext,
  ];
  for (const context of deniedContexts) {
    assert.equal(service.createDraft(context, "denied-activity", activityPayload).ok, false);
  }
  assert.equal(service.createDraft(ownerContext, "scoped-activity", activityPayload).ok, true);
  assert.equal(service.publish(ownerContext, "scoped-activity", 1).ok, true);
  assert.equal(
    service.readPublic(
      { tenantId: FOREIGN_TENANT_ID, campusId: CAMPUS_ID },
      "scoped-activity",
      "2026-09-10",
    ).ok,
    false,
  );
});

test("activity stale writes are atomic and emit no success audit", () => {
  const events: ActivityPublicationAuditEvent[] = [];
  const service = new ActivityService(new InMemoryActivityRepository(), {
    onPublicationAuditEvent: (event) => events.push(event),
  });
  assert.equal(service.createDraft(ownerContext, "atomic-activity", activityPayload).ok, true);

  const first = service.updateDraft(ownerContext, "atomic-activity", activityPayload, 1);
  const stale = service.updateDraft(
    ownerContext,
    "atomic-activity",
    { ...activityPayload, title: "模拟过期修改" },
    1,
  );
  const stalePublish = service.publish(ownerContext, "atomic-activity", 1);

  assert.equal(first.ok, true);
  assert.deepEqual(stale, {
    ok: false,
    error: { code: "VERSION_MISMATCH", message: "Activity version is stale." },
  });
  assert.deepEqual(stalePublish, {
    ok: false,
    error: { code: "VERSION_MISMATCH", message: "Activity version is stale." },
  });
  assert.equal(service.repository.get(ownerContext.scope, "atomic-activity")?.version, 2);
  assert.equal(service.repository.get(ownerContext.scope, "atomic-activity")?.status, "DRAFT");
  assert.equal(events.length, 0);
});

test("activity routes derive scope server-side and reject client claims", async () => {
  const service = new ActivityService(new InMemoryActivityRepository());
  const app = fastify({ logger: false });
  app.decorateRequest("authContext", undefined);
  app.decorateRequest("scopeContext", undefined);
  app.addHook("preHandler", async (request) => {
    request.authContext = {
      identity: { actor_id: ACTOR_ID },
      memberships: [
        {
          tenant_id: TENANT_ID,
          campus_ids: [CAMPUS_ID],
          status: "ACTIVE",
          capabilities: ["content:write", "content:publish"],
        },
      ],
    } as never;
    request.scopeContext = { actorId: ACTOR_ID, tenantId: TENANT_ID, campusId: CAMPUS_ID };
  });
  registerPublicActivityRoutes(app, service, () => ({ tenantId: TENANT_ID, campusId: CAMPUS_ID }));

  try {
    const created = await app.inject({
      method: "POST",
      url: "/admin/activities/activity-one/draft",
      payload: { payload: activityPayload },
    });
    assert.equal(created.statusCode, 201);

    const forged = await app.inject({
      method: "GET",
      url: "/public/activities?date=2026-09-10&tenant_id=" + FOREIGN_TENANT_ID,
    });
    assert.equal(forged.statusCode, 400);

    const published = await app.inject({
      method: "POST",
      url: "/admin/activities/activity-one/publish",
      payload: { expected_version: 1 },
    });
    assert.equal(published.statusCode, 200);

    const publicResponse = await app.inject({
      method: "GET",
      url: "/public/activities?date=2026-09-11",
    });
    assert.equal(publicResponse.statusCode, 200);
    assert.equal(publicResponse.json().data[0].title, activityPayload.title);
  } finally {
    await app.close();
  }
});

test("meals enforce typed dates and published public projections", () => {
  const service = new MealService(new InMemoryMealRepository());
  assert.equal(service.createDraft(mealContext, "meal-one", mealPayload).ok, true);
  assert.deepEqual(service.listPublic(mealContext.scope, "2026-09-10"), { ok: true, data: [] });
  assert.equal(service.publish(mealContext, "meal-one", 1).ok, true);

  const result = service.listPublic(mealContext.scope, "2026-09-10");
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const meal = result.data[0];
  assert.ok(meal);
  assert.deepEqual(meal, {
    id: "meal-one",
    meal_date: "2026-09-10",
    meal_type: "LUNCH",
    items: ["模拟番茄面", "模拟时蔬"],
    notes: "仅用于测试的虚构菜单说明。",
    media_ref: "file-ref:/synthetic/meal-one.png",
    published_at: meal.published_at,
  });
  assert.equal("private_notes" in meal, false);
  assert.equal("version" in meal, false);

  const invalid = service.createDraft(mealContext, "bad-meal", {
    ...mealPayload,
    meal_date: "2026-02-30",
  });
  assert.deepEqual(invalid, {
    ok: false,
    error: { code: "VALIDATION_FAILED", message: "Meal input is invalid." },
  });
});

test("activity repository compare-and-save rejects a repeated expected version", () => {
  class AtomicRepository implements ActivityProfileRepository {
    private record: ActivityProfileRecord | undefined;

    public get(_scope: { tenantId: string; campusId: string }, _activityId: string) {
      void _scope;
      void _activityId;
      return this.record === undefined ? undefined : { ...this.record };
    }

    public list(): readonly ActivityProfileRecord[] {
      return this.record === undefined ? [] : [{ ...this.record }];
    }

    public save(record: ActivityProfileRecord): void {
      this.record = { ...record };
    }

    public compareAndSave(
      _scope: { tenantId: string; campusId: string },
      _activityId: string,
      expectedVersion: number,
      record: ActivityProfileRecord,
    ): boolean {
      if (this.record?.version !== expectedVersion) return false;
      this.record = { ...record };
      return true;
    }
  }

  const repository = new AtomicRepository();
  const service = new ActivityService(repository);
  assert.equal(service.createDraft(ownerContext, "atomic-repository", activityPayload).ok, true);
  assert.equal(service.updateDraft(ownerContext, "atomic-repository", activityPayload, 1).ok, true);
  assert.deepEqual(service.updateDraft(ownerContext, "atomic-repository", activityPayload, 1), {
    ok: false,
    error: { code: "VERSION_MISMATCH", message: "Activity version is stale." },
  });
});

test("buildServer registers activity and meal HTTP routes", async () => {
  const app = buildServer();
  try {
    const activityPublic = await app.inject({
      method: "GET",
      url: "/public/activities?date=2026-09-10",
    });
    const mealPublic = await app.inject({
      method: "GET",
      url: "/public/meals?date=2026-09-10",
    });
    const activityAdmin = await app.inject({
      method: "POST",
      url: "/admin/activities/synthetic-activity/draft",
      payload: {},
    });
    const mealAdmin = await app.inject({
      method: "POST",
      url: "/admin/meals/synthetic-meal/draft",
      payload: {},
    });

    assert.notEqual(activityPublic.statusCode, 404);
    assert.notEqual(mealPublic.statusCode, 404);
    assert.notEqual(activityAdmin.statusCode, 404);
    assert.notEqual(mealAdmin.statusCode, 404);
  } finally {
    await app.close();
  }
});

test("buildServer exposes scoped meal admin and published public HTTP behavior", async () => {
  const service = new MealService(new InMemoryMealRepository());
  const authResult = {
    trusted: true as const,
    session: {
      trusted: true as const,
      status: "ACTIVE" as const,
      actor_id: ACTOR_ID,
      expires_at: "2099-01-01T00:00:00.000Z",
    },
    identity: { actor_id: ACTOR_ID, display_name: "模拟员工一号" },
    memberships: [
      {
        tenant_id: TENANT_ID,
        campus_ids: [CAMPUS_ID],
        status: "ACTIVE" as const,
        capabilities: ["content:write", "content:publish"] as const,
      },
    ],
  };
  const app = buildServer({
    getTrustedAuthResult: () => authResult,
    mealService: service,
    getPublicMealScope: () => mealContext.scope,
  });
  try {
    const created = await app.inject({
      method: "POST",
      url: "/admin/meals/meal-one/draft",
      payload: { payload: mealPayload },
    });
    assert.equal(created.statusCode, 201);

    const published = await app.inject({
      method: "POST",
      url: "/admin/meals/meal-one/publish",
      payload: { expected_version: 1 },
    });
    assert.equal(published.statusCode, 200);

    const publicResponse = await app.inject({
      method: "GET",
      url: "/public/meals?date=2026-09-10",
    });
    assert.equal(publicResponse.statusCode, 200);
    assert.deepEqual(publicResponse.json().data[0], {
      id: "meal-one",
      meal_date: "2026-09-10",
      meal_type: "LUNCH",
      items: ["模拟番茄面", "模拟时蔬"],
      notes: "仅用于测试的虚构菜单说明。",
      media_ref: "file-ref:/synthetic/meal-one.png",
      published_at: publicResponse.json().data[0].published_at,
    });

    const forged = await app.inject({
      method: "GET",
      url: `/public/meals?date=2026-09-10&tenant_id=${FOREIGN_TENANT_ID}`,
    });
    assert.equal(forged.statusCode, 400);
  } finally {
    await app.close();
  }
});

test("admin entry exposes the meals page route while preserving existing pages", () => {
  const fromRoot = path.resolve(process.cwd(), "apps/admin-web/src/main.ts");
  const fromApi = path.resolve(process.cwd(), "../admin-web/src/main.ts");
  const mainPath = existsSync(fromRoot) ? fromRoot : fromApi;
  const main = readFileSync(mainPath, "utf8");
  assert.match(main, /MealsPage/);
  assert.match(main, /\/admin\/meals/);
  assert.match(main, /HomeContentPage/);
  assert.match(main, /\/admin\/public-teachers/);
});
