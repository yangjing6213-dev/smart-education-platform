import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";
import Fastify from "fastify";
import {
  ActivityService,
  InMemoryActivityRepository,
  type ActivityActorContext,
  type ActivityScope,
} from "../src/modules/activities/activity.service.js";
import { registerPublicActivityRoutes } from "../src/routes/public-activities.route.js";
import { createApiApp } from "../src/nest/api-app.js";

const ON_DATE = "2026-10-15";
const EAST_SCOPE: ActivityScope = {
  tenantId: "00000000-0000-4000-8000-000000000001",
  campusId: "00000000-0000-4000-8000-000000000002",
};
const WEST_SCOPE: ActivityScope = {
  tenantId: EAST_SCOPE.tenantId,
  campusId: "00000000-0000-4000-8000-000000000004",
};

function activityContext(scope: ActivityScope, actorId: string): ActivityActorContext {
  return {
    trusted: true,
    actorId,
    activeMembership: true,
    scope,
    capabilities: ["content:write", "content:publish"],
  };
}

function publishedActivityService(): ActivityService {
  const service = new ActivityService(new InMemoryActivityRepository(), {
    now: () => new Date("2026-10-01T08:00:00.000Z"),
  });
  const payload = {
    title: "模拟校园活动",
    summary: "仅用于本机测试的虚构公开活动。",
    start_date: ON_DATE,
    end_date: ON_DATE,
    location: "模拟活动室",
    media_ref: "file-ref:/synthetic/activity.png",
    private_notes: "不应对外显示的内部模拟备注",
  } as const;

  for (const [id, scope, actorId] of [
    ["synthetic-activity-east", EAST_SCOPE, "synthetic-owner-east"],
    ["synthetic-activity-west", WEST_SCOPE, "synthetic-owner-west"],
  ] as const) {
    const owner = activityContext(scope, actorId);
    assert.equal(service.createDraft(owner, id, payload).ok, true);
    assert.equal(service.publish(owner, id, 1).ok, true);
  }
  return service;
}

test("Nest public activities fails closed when no server-owned campus scope is configured", async () => {
  const app = await createApiApp({ activityService: publishedActivityService() });
  const server = app.getHttpServer();

  try {
    await app.listen(0, "127.0.0.1");
    const address = server.address() as AddressInfo;
    const response = await fetch(
      `http://127.0.0.1:${address.port}/public/activities?date=${ON_DATE}`,
      {
        headers: { connection: "close" },
      },
    );

    assert.equal(address.address, "127.0.0.1");
    assert.equal(response.status, 403);
    const body = (await response.json()) as { readonly error?: { readonly code?: string } };
    assert.equal(body.error?.code, "FORBIDDEN_SCOPE");
  } finally {
    await app.close();
  }

  assert.equal(server.address(), null);
});

test("Nest public activities matches Fastify and returns only published in-scope projections", async () => {
  const activityService = publishedActivityService();
  const nestApp = await createApiApp({
    activityService,
    getPublicActivityScope: () => EAST_SCOPE,
  });
  const nestServer = nestApp.getHttpServer();
  const fastifyApp = Fastify();
  registerPublicActivityRoutes(fastifyApp, activityService, () => EAST_SCOPE);

  try {
    await Promise.all([nestApp.listen(0, "127.0.0.1"), fastifyApp.ready()]);
    const address = nestServer.address() as AddressInfo;
    const url = `http://127.0.0.1:${address.port}/public/activities?date=${ON_DATE}`;
    const [nestResponse, fastifyResponse] = await Promise.all([
      fetch(url, { headers: { connection: "close" } }),
      fastifyApp.inject({ method: "GET", url: `/public/activities?date=${ON_DATE}` }),
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
      nestBody.data.map((activity) => activity.id),
      ["synthetic-activity-east"],
    );
    assert.deepEqual(Object.keys(nestBody.data[0]!).sort(), [
      "end_date",
      "id",
      "location",
      "media_ref",
      "published_at",
      "start_date",
      "summary",
      "title",
    ]);
    assert.equal("tenant_id" in nestBody.data[0]!, false);
    assert.equal("campus_id" in nestBody.data[0]!, false);
    assert.equal("private_notes" in nestBody.data[0]!, false);
    assert.equal(typeof nestBody.request_id, "string");
  } finally {
    await Promise.all([nestApp.close(), fastifyApp.close()]);
  }

  assert.equal(nestServer.address(), null);
});

test("Nest public activities matches Fastify validation for missing, invalid, and forged filters", async () => {
  const activityService = publishedActivityService();
  const nestApp = await createApiApp({
    activityService,
    getPublicActivityScope: () => EAST_SCOPE,
  });
  const nestServer = nestApp.getHttpServer();
  const fastifyApp = Fastify();
  registerPublicActivityRoutes(fastifyApp, activityService, () => EAST_SCOPE);
  const urls = [
    "/public/activities",
    "/public/activities?date=2026-02-31",
    `/public/activities?date=${ON_DATE}&extra=unexpected`,
    `/public/activities?date=${ON_DATE}&campus_id=${WEST_SCOPE.campusId}`,
    `/public/activities?date=${ON_DATE}&role=PLATFORM_ADMIN`,
  ];

  try {
    await Promise.all([nestApp.listen(0, "127.0.0.1"), fastifyApp.ready()]);
    const address = nestServer.address() as AddressInfo;
    const comparisons = await Promise.all(
      urls.map(async (url) => {
        const [nestResponse, fastifyResponse] = await Promise.all([
          fetch(`http://127.0.0.1:${address.port}${url}`, {
            headers: { connection: "close" },
          }),
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

    assert.deepEqual(comparisons, [
      {
        nestStatus: 400,
        fastifyStatus: 400,
        nestCode: "VALIDATION_FAILED",
        fastifyCode: "VALIDATION_FAILED",
      },
      {
        nestStatus: 400,
        fastifyStatus: 400,
        nestCode: "VALIDATION_FAILED",
        fastifyCode: "VALIDATION_FAILED",
      },
      {
        nestStatus: 400,
        fastifyStatus: 400,
        nestCode: "VALIDATION_FAILED",
        fastifyCode: "VALIDATION_FAILED",
      },
      {
        nestStatus: 400,
        fastifyStatus: 400,
        nestCode: "VALIDATION_FAILED",
        fastifyCode: "VALIDATION_FAILED",
      },
      {
        nestStatus: 400,
        fastifyStatus: 400,
        nestCode: "VALIDATION_FAILED",
        fastifyCode: "VALIDATION_FAILED",
      },
    ]);
  } finally {
    await Promise.all([nestApp.close(), fastifyApp.close()]);
  }

  assert.equal(nestServer.address(), null);
});
