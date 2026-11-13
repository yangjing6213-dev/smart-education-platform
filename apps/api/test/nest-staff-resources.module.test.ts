import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";
import type { TrustedAuthResult } from "@student-care/auth";
import {
  InMemoryResourceFileAccessPort,
  InMemoryResourceRepository,
  ResourceService,
  type ResourceRecord,
} from "../src/modules/resources/resource.service.js";
import { createApiApp } from "../src/nest/api-app.js";
import { buildServer } from "../src/server.js";

const ACTOR_ID = "00000000-0000-4000-8000-000000000003";
const TENANT_ID = "00000000-0000-4000-8000-000000000001";
const EAST_CAMPUS_ID = "00000000-0000-4000-8000-000000000002";
const WEST_CAMPUS_ID = "00000000-0000-4000-8000-000000000004";
const FOREIGN_TENANT_ID = "00000000-0000-4000-8000-000000000005";
const FILE_REFERENCE = "file-ref:/synthetic/lesson.pdf";

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

const STAFF_WITHOUT_CONTENT_CAPABILITY: TrustedAuthResult = {
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

const records = [
  {
    id: "resource-lesson",
    tenant_id: TENANT_ID,
    campus_id: EAST_CAMPUS_ID,
    status: "PUBLISHED",
    version: 2,
    title: "Synthetic lesson resource",
    summary: "A fictional resource for scoped search tests.",
    body: "Synthetic lesson details for the authorized staff projection.",
    category: "LESSON",
    keywords: ["synthetic", "lesson"],
    role_scope: ["content:write"],
    file_ref: FILE_REFERENCE,
    synthetic_data: true,
    updated_by: ACTOR_ID,
    updated_at: "2026-10-01T00:00:00.000Z",
  },
  {
    id: "resource-reference",
    tenant_id: TENANT_ID,
    campus_id: EAST_CAMPUS_ID,
    status: "PUBLISHED",
    version: 1,
    title: "Synthetic reference resource",
    summary: "A second fictional resource for cursor tests.",
    body: "Synthetic reference details.",
    category: "REFERENCE",
    keywords: ["synthetic", "reference"],
    role_scope: ["content:write"],
    file_ref: null,
    synthetic_data: true,
    updated_by: ACTOR_ID,
    updated_at: "2026-10-01T00:00:00.000Z",
  },
  {
    id: "resource-draft",
    tenant_id: TENANT_ID,
    campus_id: EAST_CAMPUS_ID,
    status: "DRAFT",
    version: 1,
    title: "Synthetic draft resource",
    summary: "A draft which must remain hidden.",
    body: "Synthetic draft details.",
    category: "LESSON",
    keywords: ["synthetic", "draft"],
    role_scope: ["content:write"],
    file_ref: null,
    synthetic_data: true,
    updated_by: ACTOR_ID,
    updated_at: "2026-10-01T00:00:00.000Z",
  },
  {
    id: "resource-west-campus",
    tenant_id: TENANT_ID,
    campus_id: WEST_CAMPUS_ID,
    status: "PUBLISHED",
    version: 1,
    title: "Synthetic west campus resource",
    summary: "A resource outside the resolved campus.",
    body: "Synthetic west campus details.",
    category: "LESSON",
    keywords: ["synthetic", "west"],
    role_scope: ["content:write"],
    file_ref: null,
    synthetic_data: true,
    updated_by: ACTOR_ID,
    updated_at: "2026-10-01T00:00:00.000Z",
  },
  {
    id: "resource-file-unavailable",
    tenant_id: TENANT_ID,
    campus_id: EAST_CAMPUS_ID,
    status: "PUBLISHED",
    version: 1,
    title: "Synthetic missing attachment",
    summary: "Its file is not in the safe file projection fixture.",
    body: "Synthetic missing attachment details.",
    category: "LESSON",
    keywords: ["synthetic", "file"],
    role_scope: ["content:write"],
    file_ref: "file-ref:/synthetic/missing.pdf",
    synthetic_data: true,
    updated_by: ACTOR_ID,
    updated_at: "2026-10-01T00:00:00.000Z",
  },
] as const satisfies readonly ResourceRecord[];

function makeResourceService(): ResourceService {
  return new ResourceService(
    new InMemoryResourceRepository(records),
    new InMemoryResourceFileAccessPort([
      {
        tenant_id: TENANT_ID,
        campus_id: EAST_CAMPUS_ID,
        reference: FILE_REFERENCE,
        display_name: "Synthetic lesson attachment.pdf",
      },
    ]),
    {
      now: () => new Date("2026-10-01T00:00:00.000Z"),
      readIntentSecret: "synthetic-only-resource-read-intent-key",
    },
  );
}

async function withServers(
  auth: TrustedAuthResult | undefined,
  resourceService: ResourceService,
  run: (nestBase: string, fastifyBase: string) => Promise<void>,
): Promise<void> {
  const options = {
    getTrustedAuthResult: () => auth,
    resourceService,
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

async function getJson(base: string, path: string, headers?: Record<string, string>) {
  const response = await fetch(`${base}${path}`, {
    headers: { connection: "close", ...headers },
  });
  return {
    status: response.status,
    body: (await response.json()) as Record<string, unknown>,
  };
}

function errorCode(body: Record<string, unknown>): string | undefined {
  const error = body.error as Record<string, unknown> | undefined;
  return typeof error?.code === "string" ? error.code : undefined;
}

test("Nest staff resource routes match Fastify's unauthenticated denial", async () => {
  await withServers(undefined, makeResourceService(), async (nestBase, fastifyBase) => {
    for (const url of [
      "/staff/resources?query=synthetic",
      "/staff/resources/resource-lesson?version=2",
    ]) {
      const nest = await getJson(nestBase, url);
      const fastify = await getJson(fastifyBase, url);
      assert.equal(nest.status, fastify.status);
      assert.equal(nest.status, 401);
      assert.equal(errorCode(nest.body), errorCode(fastify.body));
    }
  });
});

test("Nest staff resource search, cursor paging, and safe detail match Fastify", async () => {
  await withServers(STAFF_AUTH, makeResourceService(), async (nestBase, fastifyBase) => {
    const nestFirst = await getJson(nestBase, "/staff/resources?query=resource&limit=1");
    const fastifyFirst = await getJson(fastifyBase, "/staff/resources?query=resource&limit=1");
    assert.equal(nestFirst.status, 200);
    assert.equal(nestFirst.status, fastifyFirst.status);

    const nestPage = nestFirst.body.data as {
      items: readonly Record<string, unknown>[];
      next_cursor: string | null;
    };
    const fastifyPage = fastifyFirst.body.data as {
      items: readonly Record<string, unknown>[];
      next_cursor: string | null;
    };
    assert.deepEqual(nestPage.items, fastifyPage.items);
    assert.deepEqual(
      nestPage.items.map((item) => item.id),
      ["resource-lesson"],
    );
    assert.deepEqual(Object.keys(nestPage.items[0]!).sort(), [
      "category",
      "id",
      "keywords",
      "summary",
      "title",
      "version",
    ]);
    assert.equal(typeof nestPage.next_cursor, "string");
    assert.equal(typeof fastifyPage.next_cursor, "string");

    const nestSecond = await getJson(
      nestBase,
      `/staff/resources?query=resource&limit=1&cursor=${encodeURIComponent(nestPage.next_cursor!)}`,
    );
    const fastifySecond = await getJson(
      fastifyBase,
      `/staff/resources?query=resource&limit=1&cursor=${encodeURIComponent(fastifyPage.next_cursor!)}`,
    );
    assert.equal(nestSecond.status, 200);
    assert.deepEqual(
      (nestSecond.body.data as { items: readonly Record<string, unknown>[] }).items,
      (fastifySecond.body.data as { items: readonly Record<string, unknown>[] }).items,
    );
    assert.deepEqual(
      (nestSecond.body.data as { items: readonly Record<string, unknown>[] }).items.map(
        (item) => item.id,
      ),
      ["resource-reference"],
    );
    assert.equal((nestSecond.body.data as { next_cursor: string | null }).next_cursor, null);

    const nestDetail = await getJson(nestBase, "/staff/resources/resource-lesson?version=2");
    const fastifyDetail = await getJson(fastifyBase, "/staff/resources/resource-lesson?version=2");
    assert.equal(nestDetail.status, 200);
    assert.deepEqual(nestDetail.body.data, fastifyDetail.body.data);
    const detail = nestDetail.body.data as Record<string, unknown>;
    assert.deepEqual(Object.keys(detail).sort(), [
      "body",
      "category",
      "file",
      "id",
      "keywords",
      "summary",
      "title",
      "version",
    ]);
    for (const field of [
      "tenant_id",
      "campus_id",
      "file_ref",
      "provider_url",
      "synthetic_data",
      "updated_by",
      "updated_at",
    ]) {
      assert.equal(field in detail, false);
    }
    assert.deepEqual(Object.keys(detail.file as Record<string, unknown>).sort(), [
      "display_name",
      "expires_at",
      "read_intent",
      "reference",
    ]);
  });
});

test("Nest staff resources deny inactive or underprivileged memberships like Fastify", async () => {
  for (const auth of [STAFF_WITHOUT_CONTENT_CAPABILITY, SUSPENDED_STAFF]) {
    await withServers(auth, makeResourceService(), async (nestBase, fastifyBase) => {
      const nest = await getJson(nestBase, "/staff/resources?query=synthetic");
      const fastify = await getJson(fastifyBase, "/staff/resources?query=synthetic");
      assert.equal(nest.status, 403);
      assert.equal(nest.status, fastify.status);
      assert.equal(errorCode(nest.body), errorCode(fastify.body));
    });
  }
});

test("staff resources select the eligible membership regardless of a lower-privilege membership's order", async () => {
  const lowerPrivilege = STAFF_WITHOUT_CONTENT_CAPABILITY.memberships[0]!;
  const eligible = STAFF_AUTH.memberships[0]!;
  for (const memberships of [
    [lowerPrivilege, eligible],
    [eligible, lowerPrivilege],
  ]) {
    await withServers(
      { ...STAFF_AUTH, memberships },
      makeResourceService(),
      async (nestBase, fastifyBase) => {
        for (const path of [
          "/staff/resources?query=lesson",
          "/staff/resources/resource-lesson?version=2",
        ]) {
          const nest = await getJson(nestBase, path);
          const fastify = await getJson(fastifyBase, path);
          assert.equal(nest.status, 200, path);
          assert.equal(fastify.status, 200, path);
          assert.deepEqual(fastify.body.data, nest.body.data);
        }
      },
    );
  }
});

test("staff resource memberships cannot borrow capabilities across status, tenant, or campus", async () => {
  const eligible = STAFF_AUTH.memberships[0]!;
  for (const candidate of [
    { ...eligible, status: "SUSPENDED" as const },
    { ...eligible, tenant_id: FOREIGN_TENANT_ID },
    { ...eligible, campus_ids: [WEST_CAMPUS_ID] },
  ]) {
    const auth = {
      ...STAFF_AUTH,
      memberships: [STAFF_WITHOUT_CONTENT_CAPABILITY.memberships[0]!, candidate],
    };
    await withServers(auth, makeResourceService(), async (nestBase, fastifyBase) => {
      for (const base of [nestBase, fastifyBase]) {
        const response = await getJson(base, "/staff/resources/resource-lesson?version=2");
        assert.equal(response.status, candidate.status === "SUSPENDED" ? 403 : 404);
        assert.equal(
          errorCode(response.body),
          candidate.status === "SUSPENDED" ? "FORBIDDEN_SCOPE" : "NOT_FOUND_SCOPED",
        );
        assert.equal("data" in response.body, false);
      }
    });
  }
});

test("staff resource cursors become SCOPE_STALE after the trusted campus changes", async () => {
  const service = makeResourceService();
  const cursors: string[] = [];
  await withServers(STAFF_AUTH, service, async (nestBase, fastifyBase) => {
    for (const base of [nestBase, fastifyBase]) {
      const response = await getJson(base, "/staff/resources?query=resource&limit=1");
      assert.equal(response.status, 200);
      const page = response.body.data as { next_cursor: string | null };
      assert.equal(typeof page.next_cursor, "string");
      cursors.push(page.next_cursor!);
    }
  });
  const westAuth = {
    ...STAFF_AUTH,
    memberships: [{ ...STAFF_AUTH.memberships[0]!, campus_ids: [WEST_CAMPUS_ID, EAST_CAMPUS_ID] }],
  };
  await withServers(westAuth, service, async (nestBase, fastifyBase) => {
    for (const [index, base] of [nestBase, fastifyBase].entries()) {
      const response = await getJson(
        base,
        `/staff/resources?query=resource&limit=1&cursor=${encodeURIComponent(cursors[index]!)}`,
      );
      assert.equal(response.status, 409);
      assert.equal(errorCode(response.body), "SCOPE_STALE");
      assert.equal("data" in response.body, false);
    }
  });
});

test("Nest staff resource errors preserve Fastify validation, scope, and version behavior", async () => {
  await withServers(STAFF_AUTH, makeResourceService(), async (nestBase, fastifyBase) => {
    const cases = [
      { url: `/staff/resources?query=synthetic&tenant_id=${TENANT_ID}`, status: 400 },
      { url: `/staff/resources?query=synthetic&tenant_id=${FOREIGN_TENANT_ID}`, status: 403 },
      { url: `/staff/resources?query=synthetic&campus_id=${EAST_CAMPUS_ID}`, status: 400 },
      { url: "/staff/resources?query=synthetic&role=content%3Awrite", status: 401 },
      { url: "/staff/resources?query=synthetic&unknown_filter=value", status: 400 },
      { url: "/staff/resources?query=synthetic&cursor=forged", status: 400 },
      { url: "/staff/resources/resource-lesson?version=2.5", status: 400 },
      { url: "/staff/resources/resource-lesson?version=1", status: 409 },
      { url: "/staff/resources/resource-draft?version=1", status: 404 },
      { url: "/staff/resources/resource-west-campus?version=1", status: 404 },
      { url: "/staff/resources/resource-file-unavailable?version=1", status: 404 },
    ] as const;

    for (const { url, status } of cases) {
      const nest = await getJson(nestBase, url);
      const fastify = await getJson(fastifyBase, url);
      assert.equal(nest.status, fastify.status, url);
      assert.equal(nest.status, status, url);
      assert.equal(errorCode(nest.body), errorCode(fastify.body), url);
    }

    const forged = await getJson(nestBase, "/staff/resources?query=synthetic", {
      "x-actor-id": ACTOR_ID,
    });
    const fastifyForged = await getJson(fastifyBase, "/staff/resources?query=synthetic", {
      "x-actor-id": ACTOR_ID,
    });
    assert.equal(forged.status, 401);
    assert.equal(forged.status, fastifyForged.status);
    assert.equal(errorCode(forged.body), errorCode(fastifyForged.body));
  });
});
