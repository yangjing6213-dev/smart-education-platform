import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";
import Fastify from "fastify";
import {
  InMemoryMealRepository,
  MealService,
  type MealActorContext,
  type MealDraftPayload,
  type MealScope,
} from "../src/modules/meals/meal.service.js";
import { registerPublicMealRoutes } from "../src/routes/public-meals.route.js";
import { createApiApp } from "../src/nest/api-app.js";

const ON_DATE = "2026-10-15";
const EAST_SCOPE: MealScope = {
  tenantId: "00000000-0000-4000-8000-000000000001",
  campusId: "00000000-0000-4000-8000-000000000002",
};
const WEST_SCOPE: MealScope = {
  tenantId: EAST_SCOPE.tenantId,
  campusId: "00000000-0000-4000-8000-000000000004",
};

function mealContext(scope: MealScope, actorId: string): MealActorContext {
  return {
    trusted: true,
    actorId,
    activeMembership: true,
    scope,
    capabilities: ["content:write", "content:publish"],
  };
}

function payload(mealDate: string): MealDraftPayload {
  return {
    meal_date: mealDate,
    meal_type: "LUNCH",
    items: ["模拟主食", "模拟蔬菜"],
    notes: "仅用于本机验证的虚构餐食。",
    media_ref: "file-ref:/synthetic/meal.png",
    private_notes: "不得公开的模拟内部备注",
  };
}

function mealServiceWithPublishedRecords(): MealService {
  const service = new MealService(new InMemoryMealRepository(), {
    now: () => new Date("2026-10-01T08:00:00.000Z"),
  });
  const records = [
    ["synthetic-meal-east", EAST_SCOPE, "synthetic-owner-east", ON_DATE, true],
    ["synthetic-meal-west", WEST_SCOPE, "synthetic-owner-west", ON_DATE, true],
    ["synthetic-meal-other-date", EAST_SCOPE, "synthetic-owner-east", "2026-10-16", true],
    ["synthetic-meal-draft", EAST_SCOPE, "synthetic-owner-east", ON_DATE, false],
  ] as const;

  for (const [id, scope, actorId, date, shouldPublish] of records) {
    const owner = mealContext(scope, actorId);
    assert.equal(service.createDraft(owner, id, payload(date)).ok, true);
    if (shouldPublish) assert.equal(service.publish(owner, id, 1).ok, true);
  }
  return service;
}

test("Nest public meal read fails closed without a server-owned campus scope", async () => {
  const service = mealServiceWithPublishedRecords();
  const nestApp = await createApiApp({ mealService: service });
  const nestServer = nestApp.getHttpServer();
  const fastifyApp = Fastify();
  registerPublicMealRoutes(fastifyApp, service);

  try {
    await Promise.all([nestApp.listen(0, "127.0.0.1"), fastifyApp.ready()]);
    const address = nestServer.address() as AddressInfo;
    const [nestResponse, fastifyResponse] = await Promise.all([
      fetch(`http://127.0.0.1:${address.port}/public/meals?date=${ON_DATE}`, {
        headers: { connection: "close" },
      }),
      fastifyApp.inject({ method: "GET", url: `/public/meals?date=${ON_DATE}` }),
    ]);
    const nestBody = (await nestResponse.json()) as {
      readonly error?: { readonly code?: string };
    };
    const fastifyBody = fastifyResponse.json() as {
      readonly error?: { readonly code?: string };
    };

    assert.equal(address.address, "127.0.0.1");
    assert.equal(nestResponse.status, 403);
    assert.equal(nestResponse.status, fastifyResponse.statusCode);
    assert.equal(nestBody.error?.code, "FORBIDDEN_SCOPE");
    assert.equal(nestBody.error?.code, fastifyBody.error?.code);
  } finally {
    await Promise.all([nestApp.close(), fastifyApp.close()]);
  }

  assert.equal(nestServer.address(), null);
});

test("Nest public meals matches Fastify and returns only published in-scope projections", async () => {
  const service = mealServiceWithPublishedRecords();
  const nestApp = await createApiApp({
    mealService: service,
    getPublicMealScope: () => EAST_SCOPE,
  });
  const nestServer = nestApp.getHttpServer();
  const fastifyApp = Fastify();
  registerPublicMealRoutes(fastifyApp, service, () => EAST_SCOPE);

  try {
    await Promise.all([nestApp.listen(0, "127.0.0.1"), fastifyApp.ready()]);
    const address = nestServer.address() as AddressInfo;
    const url = `/public/meals?date=${ON_DATE}`;
    const [nestResponse, fastifyResponse] = await Promise.all([
      fetch(`http://127.0.0.1:${address.port}${url}`, { headers: { connection: "close" } }),
      fastifyApp.inject({ method: "GET", url }),
    ]);
    const nestBody = (await nestResponse.json()) as {
      readonly data: readonly Record<string, unknown>[];
      readonly request_id: string;
    };
    const fastifyBody = fastifyResponse.json() as {
      readonly data: readonly Record<string, unknown>[];
    };

    assert.equal(address.address, "127.0.0.1");
    assert.equal(nestResponse.status, fastifyResponse.statusCode);
    assert.deepEqual(nestBody.data, fastifyBody.data);
    assert.deepEqual(
      nestBody.data.map((meal) => meal.id),
      ["synthetic-meal-east"],
    );
    assert.deepEqual(Object.keys(nestBody.data[0]!).sort(), [
      "id",
      "items",
      "meal_date",
      "meal_type",
      "media_ref",
      "notes",
      "published_at",
    ]);
    assert.equal("tenant_id" in nestBody.data[0]!, false);
    assert.equal("campus_id" in nestBody.data[0]!, false);
    assert.equal("private_notes" in nestBody.data[0]!, false);
    assert.equal("version" in nestBody.data[0]!, false);
    assert.equal("synthetic_data" in nestBody.data[0]!, false);
    assert.equal(typeof nestBody.request_id, "string");
  } finally {
    await Promise.all([nestApp.close(), fastifyApp.close()]);
  }

  assert.equal(nestServer.address(), null);
});

test("Nest public meals matches Fastify validation for invalid dates and client filters", async () => {
  const service = mealServiceWithPublishedRecords();
  const nestApp = await createApiApp({
    mealService: service,
    getPublicMealScope: () => EAST_SCOPE,
  });
  const nestServer = nestApp.getHttpServer();
  const fastifyApp = Fastify();
  registerPublicMealRoutes(fastifyApp, service, () => EAST_SCOPE);
  const urls = [
    "/public/meals",
    "/public/meals?date=2026-02-31",
    `/public/meals?date=${ON_DATE}&date=2026-10-16`,
    `/public/meals?date=${ON_DATE}&extra=unexpected`,
    `/public/meals?date=${ON_DATE}&campus_id=${WEST_SCOPE.campusId}`,
    `/public/meals?date=${ON_DATE}&role=PLATFORM_ADMIN`,
  ];

  try {
    await Promise.all([nestApp.listen(0, "127.0.0.1"), fastifyApp.ready()]);
    const address = nestServer.address() as AddressInfo;
    const comparisons = await Promise.all(
      urls.map(async (url) => {
        const [nestResponse, fastifyResponse] = await Promise.all([
          fetch(`http://127.0.0.1:${address.port}${url}`, { headers: { connection: "close" } }),
          fastifyApp.inject({ method: "GET", url }),
        ]);
        const nestBody = (await nestResponse.json()) as {
          readonly error?: { readonly code?: string };
        };
        const fastifyBody = fastifyResponse.json() as {
          readonly error?: { readonly code?: string };
        };
        return {
          nestStatus: nestResponse.status,
          fastifyStatus: fastifyResponse.statusCode,
          nestCode: nestBody.error?.code,
          fastifyCode: fastifyBody.error?.code,
        };
      }),
    );

    assert.equal(address.address, "127.0.0.1");
    assert.deepEqual(
      comparisons,
      urls.map(() => ({
        nestStatus: 400,
        fastifyStatus: 400,
        nestCode: "VALIDATION_FAILED",
        fastifyCode: "VALIDATION_FAILED",
      })),
    );
  } finally {
    await Promise.all([nestApp.close(), fastifyApp.close()]);
  }

  assert.equal(nestServer.address(), null);
});

test("Nest public meals requires a public reference and rejects client-selected scope", async () => {
  const service = mealServiceWithPublishedRecords();
  const nest = await createApiApp({
    mealService: service,
    getPublicMealScope: (request) =>
      request.query.public_ref === "synthetic-campus-east" ? EAST_SCOPE : undefined,
  });

  try {
    await nest.listen(0, "127.0.0.1");
    const address = nest.getHttpServer().address() as AddressInfo;
    const base = `http://127.0.0.1:${address.port}`;
    const valid = await fetch(
      `${base}/public/meals?date=${ON_DATE}&public_ref=synthetic-campus-east`,
      { headers: { connection: "close" } },
    );
    const missingReference = await fetch(`${base}/public/meals?date=${ON_DATE}`, {
      headers: { connection: "close" },
    });
    const forged = await fetch(
      `${base}/public/meals?date=${ON_DATE}&public_ref=synthetic-campus-east&campus_id=${WEST_SCOPE.campusId}`,
      { headers: { connection: "close" } },
    );
    assert.equal(valid.status, 200);
    assert.equal(missingReference.status, 403);
    assert.equal(forged.status, 400);
  } finally {
    await nest.close();
  }
});
