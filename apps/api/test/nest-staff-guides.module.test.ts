import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";
import type { TrustedAuthResult } from "@student-care/auth";
import {
  GuideService,
  InMemoryGuideFileAccessPort,
  InMemoryGuideRepository,
  type GuideRecord,
  type GuideScope,
} from "../src/modules/guides/guide.service.js";
import { buildServer } from "../src/server.js";
import { createApiApp } from "../src/nest/api-app.js";

const ACTOR_ID = "00000000-0000-4000-8000-000000000003";
const TENANT_ID = "00000000-0000-4000-8000-000000000001";
const EAST_CAMPUS_ID = "00000000-0000-4000-8000-000000000002";
const WEST_CAMPUS_ID = "00000000-0000-4000-8000-000000000004";
const FILE_REFERENCE = "file-ref:/synthetic/guide.pdf";

const STAFF_AUTH: TrustedAuthResult = {
  trusted: true,
  session: {
    trusted: true,
    status: "ACTIVE",
    actor_id: ACTOR_ID,
    expires_at: "2099-01-01T00:00:00.000Z",
  },
  identity: { actor_id: ACTOR_ID, display_name: "合成员工一号" },
  memberships: [
    {
      tenant_id: TENANT_ID,
      campus_ids: [EAST_CAMPUS_ID, WEST_CAMPUS_ID],
      status: "ACTIVE",
      capabilities: ["content:write"],
    },
  ],
};

const STAFF_WITHOUT_GUIDE_CAPABILITY: TrustedAuthResult = {
  ...STAFF_AUTH,
  memberships: [
    {
      ...STAFF_AUTH.memberships[0]!,
      capabilities: ["memberships:read"],
    },
  ],
};

const SUSPENDED_STAFF: TrustedAuthResult = {
  ...STAFF_AUTH,
  memberships: [
    {
      ...STAFF_AUTH.memberships[0]!,
      status: "SUSPENDED",
    },
  ],
};

function makeGuideService(): GuideService {
  const publishedEast: GuideRecord = {
    id: "guide-orientation",
    tenant_id: TENANT_ID,
    campus_id: EAST_CAMPUS_ID,
    status: "PUBLISHED",
    version: 2,
    title: "模拟入学指南",
    summary: "仅用于本机合成验证。",
    body: "这是虚构的指南正文。",
    category: "ORIENTATION",
    tags: ["模拟", "入学"],
    file_ref: FILE_REFERENCE,
    synthetic_data: true,
    updated_by: ACTOR_ID,
    updated_at: "2026-10-01T00:00:00.000Z",
  };
  const publishedWest: GuideRecord = {
    ...publishedEast,
    id: "guide-west-only",
    campus_id: WEST_CAMPUS_ID,
    title: "不应跨校区出现的指南",
    file_ref: null,
  };
  const draftEast: GuideRecord = {
    ...publishedEast,
    id: "guide-draft",
    status: "DRAFT",
    title: "不应公开的草稿",
  };
  return new GuideService(
    new InMemoryGuideRepository([publishedEast, publishedWest, draftEast]),
    new InMemoryGuideFileAccessPort([
      {
        reference: FILE_REFERENCE,
        display_name: "模拟指南.pdf",
        tenant_id: TENANT_ID,
        campus_id: EAST_CAMPUS_ID,
      },
    ]),
  );
}

async function withServers(
  auth: TrustedAuthResult | undefined,
  guideService: GuideService,
  run: (nestBase: string, fastifyBase: string) => Promise<void>,
  getStaffGuideScope?: () => GuideScope | undefined,
): Promise<void> {
  const getTrustedAuthResult = () => auth;
  const options = {
    getTrustedAuthResult,
    guideService,
    ...(getStaffGuideScope === undefined ? {} : { getStaffGuideScope }),
  };
  const nest = await createApiApp(options);
  const fastify = buildServer(options);

  try {
    await nest.listen(0, "127.0.0.1");
    await fastify.listen({ port: 0, host: "127.0.0.1" });
    const nestAddress = nest.getHttpServer().address() as AddressInfo;
    const fastifyAddress = fastify.server.address() as AddressInfo;
    const nestBase = `http://127.0.0.1:${nestAddress.port}`;
    const fastifyBase = `http://127.0.0.1:${fastifyAddress.port}`;
    assert.equal(nestAddress.address, "127.0.0.1");
    assert.equal(fastifyAddress.address, "127.0.0.1");
    await run(nestBase, fastifyBase);
  } finally {
    await Promise.all([nest.close(), fastify.close()]);
  }

  assert.equal(nest.getHttpServer().address(), null);
  assert.equal(fastify.server.address(), null);
}

async function getJson(
  base: string,
  path: string,
  headers?: Record<string, string>,
) {
  const response = await fetch(`${base}${path}`, {
    headers: { connection: "close", ...headers },
  });
  return {
    status: response.status,
    body: (await response.json()) as Record<string, unknown>,
  };
}

test("Nest staff guide routes match Fastify's unauthenticated denial", async () => {
  await withServers(
    undefined,
    makeGuideService(),
    async (nestBase, fastifyBase) => {
      const nest = await getJson(nestBase, "/staff/guides?query=模拟");
      const fastify = await getJson(fastifyBase, "/staff/guides?query=模拟");

      assert.equal(nest.status, 401);
      assert.equal(nest.status, fastify.status);
      assert.deepEqual(nest.body.error, fastify.body.error);
    },
  );
});

test("Nest staff guide search and detail match Fastify's scoped public projection", async () => {
  await withServers(
    STAFF_AUTH,
    makeGuideService(),
    async (nestBase, fastifyBase) => {
      for (const path of [
        "/staff/guides?query=模拟入学&category=ORIENTATION&limit=10",
        "/staff/guides?query=模拟入学&unused=ignored",
        "/staff/guides/guide-orientation?version=2",
      ]) {
        const nest = await getJson(nestBase, path);
        const fastify = await getJson(fastifyBase, path);

        assert.equal(nest.status, 200);
        assert.equal(nest.status, fastify.status);
        assert.deepEqual(nest.body.data, fastify.body.data);
      }

      const search = await getJson(
        nestBase,
        "/staff/guides?query=模拟&category=ORIENTATION&limit=10",
      );
      const records = search.body.data as readonly Record<string, unknown>[];
      assert.deepEqual(
        records.map((record) => record.id),
        ["guide-orientation"],
      );
      assert.deepEqual(Object.keys(records[0]!).sort(), [
        "category",
        "id",
        "summary",
        "tags",
        "title",
        "version",
      ]);

      const detail = await getJson(
        nestBase,
        "/staff/guides/guide-orientation?version=2",
      );
      const guide = detail.body.data as Record<string, unknown>;
      assert.deepEqual(Object.keys(guide).sort(), [
        "body",
        "category",
        "file",
        "id",
        "summary",
        "tags",
        "title",
        "version",
      ]);
      assert.deepEqual(guide.file, {
        reference: FILE_REFERENCE,
        display_name: "模拟指南.pdf",
      });
      for (const field of [
        "tenant_id",
        "campus_id",
        "private_notes",
        "file_ref",
        "updated_by",
      ]) {
        assert.equal(field in guide, false, `${field} must not be returned`);
      }
    },
  );
});

test("Nest staff guide routes match Fastify authorization and request validation", async () => {
  await withServers(
    STAFF_AUTH,
    makeGuideService(),
    async (nestBase, fastifyBase) => {
      const requests = [
        {
          path: "/staff/guides?query=模拟&tenant_id=00000000-0000-4000-8000-000000000009",
          expected: 403,
        },
        {
          path: `/staff/guides?query=模拟&tenant_id=${TENANT_ID}`,
          expected: 400,
        },
        {
          path: "/staff/guides?query=模拟&campus_id=00000000-0000-4000-8000-000000000009",
          expected: 403,
        },
        {
          path: `/staff/guides?query=模拟&campus_id=${EAST_CAMPUS_ID}`,
          expected: 400,
        },
        {
          path: "/staff/guides?query=模拟&publication=PUBLISHED",
          expected: 400,
        },
        {
          path: "/staff/guides?query=模拟&actor_id=00000000-0000-4000-8000-000000000003",
          expected: 401,
        },
        { path: "/staff/guides?query=模拟&category=UNKNOWN", expected: 400 },
        { path: "/staff/guides/guide-orientation", expected: 400 },
        {
          path: "/staff/guides/guide-orientation?version=2&version=3",
          expected: 400,
        },
        { path: "/staff/guides/guide-orientation?version=1", expected: 404 },
        { path: "/staff/guides/guide-west-only?version=2", expected: 404 },
      ];

      for (const request of requests) {
        const nest = await getJson(nestBase, request.path);
        const fastify = await getJson(fastifyBase, request.path);
        assert.equal(nest.status, request.expected, request.path);
        assert.equal(nest.status, fastify.status, request.path);
        assert.deepEqual(nest.body.error, fastify.body.error, request.path);
      }

      const forgedHeaderNest = await getJson(
        nestBase,
        "/staff/guides?query=模拟",
        {
          "x-role": "PLATFORM_ADMIN",
        },
      );
      const forgedHeaderFastify = await getJson(
        fastifyBase,
        "/staff/guides?query=模拟",
        {
          "x-role": "PLATFORM_ADMIN",
        },
      );
      assert.equal(forgedHeaderNest.status, 401);
      assert.equal(forgedHeaderNest.status, forgedHeaderFastify.status);
      assert.deepEqual(
        forgedHeaderNest.body.error,
        forgedHeaderFastify.body.error,
      );
    },
  );
});

test("Nest staff guides require the same active content capability as Fastify", async () => {
  for (const auth of [STAFF_WITHOUT_GUIDE_CAPABILITY, SUSPENDED_STAFF]) {
    await withServers(
      auth,
      makeGuideService(),
      async (nestBase, fastifyBase) => {
        const nest = await getJson(nestBase, "/staff/guides?query=模拟");
        const fastify = await getJson(fastifyBase, "/staff/guides?query=模拟");

        assert.equal(nest.status, 403);
        assert.equal(nest.status, fastify.status);
        assert.deepEqual(nest.body.error, fastify.body.error);
      },
    );
  }
});

test("Nest staff guide detail rejects a mismatched trusted file scope", async () => {
  const mismatchedScope: GuideScope = {
    tenantId: TENANT_ID,
    campusId: WEST_CAMPUS_ID,
  };
  await withServers(
    STAFF_AUTH,
    makeGuideService(),
    async (nestBase, fastifyBase) => {
      const path = "/staff/guides/guide-orientation?version=2";
      const nest = await getJson(nestBase, path);
      const fastify = await getJson(fastifyBase, path);

      assert.equal(nest.status, 403);
      assert.equal(nest.status, fastify.status);
      assert.deepEqual(nest.body.error, fastify.body.error);
    },
    () => mismatchedScope,
  );
});
