import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import fastify from "fastify";
import { ContentService } from "../src/modules/content/content.service.js";
import {
  InMemoryContentRepository,
  type ContentRecord,
} from "../src/modules/content/content.repository.js";
import { authPlugin } from "../src/plugins/auth.plugin.js";
import { buildServer } from "../src/server.js";

const require = createRequire(import.meta.url);
const openApiContract = require("@student-care/contracts/openapi/v1.json") as {
  readonly paths: Readonly<
    Record<
      string,
      {
        readonly get?: {
          readonly responses?: Readonly<Record<string, unknown>>;
          readonly [key: string]: unknown;
        };
      }
    >
  >;
};

const ACTOR_ID = "00000000-0000-4000-8000-000000000003";
const TENANT_ID = "00000000-0000-4000-8000-000000000001";
const CAMPUS_ID = "00000000-0000-4000-8000-000000000002";

const activeAuthResult = {
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
      capabilities: ["identity:read", "memberships:read"],
    },
    {
      tenant_id: TENANT_ID,
      campus_ids: [CAMPUS_ID],
      status: "SUSPENDED" as const,
      capabilities: ["memberships:read"],
    },
  ],
} as const;

const publicContentRecord: ContentRecord = {
  id: "institution-home",
  content_key: "institution-home",
  tenant_id: TENANT_ID,
  campus_id: CAMPUS_ID,
  type: "INSTITUTION",
  status: "PUBLISHED",
  title: "机构介绍",
  version: 2,
  visibility: "PUBLIC",
  body: { summary: "仅用于本机接口核验", blocks: [{ kind: "TEXT", text: "合成内容" }] },
  published_at: "2026-10-01T00:00:00.000Z",
  synthetic_data: true,
  editor_note: "",
  moderation_state: "APPROVED",
  tenant_admin_note: "",
  campus_admin_note: "",
  updated_by: ACTOR_ID,
  updated_at: "2026-10-01T00:00:00.000Z",
};

test("authentication evaluates session expiry against the injected clock", async () => {
  let clockCalls = 0;
  const app = fastify({ logger: false });
  const authResult = {
    ...activeAuthResult,
    session: { ...activeAuthResult.session, expires_at: "2020-01-02T00:00:00.000Z" },
  };
  await authPlugin(app, {
    getTrustedAuthResult: () => authResult,
    now: () => {
      clockCalls += 1;
      return new Date("2020-01-01T00:00:00.000Z");
    },
  });
  app.get("/clock-protected", { config: { authRequired: true } }, async (request) => ({
    actor_id: request.authContext?.identity.actor_id,
  }));

  try {
    const response = await app.inject({ method: "GET", url: "/clock-protected" });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().actor_id, ACTOR_ID);
    assert.equal(clockCalls, 1);
  } finally {
    await app.close();
  }
});

test("health remains public and bypasses the authentication adapter", async () => {
  let authCalls = 0;
  const app = buildServer({
    getTrustedAuthResult() {
      authCalls += 1;
      return undefined;
    },
  });
  try {
    const response = await app.inject({ method: "GET", url: "/health" });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { status: "ok" });
    assert.equal(authCalls, 0);
  } finally {
    await app.close();
  }
});

test("unauthenticated identity routes fail closed with the standard envelope", async () => {
  const app = buildServer({ getTrustedAuthResult: () => undefined });
  try {
    for (const url of ["/me", "/memberships"]) {
      const response = await app.inject({ method: "GET", url });
      assert.equal(response.statusCode, 401);
      assert.equal(response.json().error.code, "UNAUTHENTICATED");
    }
  } finally {
    await app.close();
  }
});

test("client identity and role claims are rejected even with a trusted server result", async () => {
  const app = buildServer({ getTrustedAuthResult: () => activeAuthResult });
  try {
    for (const request of [
      { method: "GET" as const, url: `/me?tenant_id=${TENANT_ID}&role=PLATFORM_ADMIN` },
      { method: "GET" as const, url: `/me?tenant_id=${TENANT_ID}&actor_id=${ACTOR_ID}` },
      { method: "GET" as const, url: `/me?tenant_id=${TENANT_ID}&identity_id=${ACTOR_ID}` },
      { method: "GET" as const, url: `/me?tenant_id=${TENANT_ID}&roles=PLATFORM_ADMIN` },
      {
        method: "GET" as const,
        url: `/memberships?tenant_id=${TENANT_ID}`,
        headers: { "x-actor-id": ACTOR_ID },
      },
      {
        method: "GET" as const,
        url: `/me?tenant_id=${TENANT_ID}`,
        headers: { "x-identity-id": ACTOR_ID },
      },
      {
        method: "GET" as const,
        url: `/me?tenant_id=${TENANT_ID}`,
        headers: { "x-role": "PLATFORM_ADMIN" },
      },
      {
        method: "GET" as const,
        url: `/me?tenant_id=${TENANT_ID}`,
        headers: { "x-roles": "PLATFORM_ADMIN" },
      },
    ]) {
      const response = await app.inject(request);
      assert.equal(response.statusCode, 401);
      assert.equal(response.json().error.code, "UNAUTHENTICATED");
    }
  } finally {
    await app.close();
  }
});

test("identity routes authenticate before Task 03 scope and return active memberships only", async () => {
  const app = buildServer({ getTrustedAuthResult: () => activeAuthResult });
  try {
    const me = await app.inject({
      method: "GET",
      url: `/me?tenant_id=${TENANT_ID}&campus_id=${CAMPUS_ID}`,
    });
    assert.equal(me.statusCode, 200);
    assert.deepEqual(me.json().data, {
      actor_id: ACTOR_ID,
      display_name: "模拟员工一号",
      memberships: [activeAuthResult.memberships[0]],
    });

    const memberships = await app.inject({
      method: "GET",
      url: `/memberships?tenant_id=${TENANT_ID}`,
    });
    assert.equal(memberships.statusCode, 200);
    assert.deepEqual(memberships.json().data, [activeAuthResult.memberships[0]]);
  } finally {
    await app.close();
  }
});

test("foreign tenant and disallowed campus are rejected by the Task 03 scope envelope", async () => {
  const app = buildServer({ getTrustedAuthResult: () => activeAuthResult });
  try {
    for (const url of [
      "/me?tenant_id=00000000-0000-4000-8000-000000000004",
      "/me?tenant_id=00000000-0000-4000-8000-000000000001&campus_id=00000000-0000-4000-8000-000000000005",
    ]) {
      const response = await app.inject({ method: "GET", url });
      assert.equal(response.statusCode, 403);
      assert.equal(response.json().error.code, "FORBIDDEN_SCOPE");
    }
  } finally {
    await app.close();
  }
});

test("identity routes reject repeated campus scope instead of treating it as unspecified", async () => {
  const app = buildServer({ getTrustedAuthResult: () => activeAuthResult });
  try {
    for (const url of [
      `/me?tenant_id=${TENANT_ID}&campus_id=${CAMPUS_ID}&campus_id=00000000-0000-4000-8000-000000000005`,
      `/memberships?tenant_id=${TENANT_ID}&campus_id=${CAMPUS_ID}&campus_id=00000000-0000-4000-8000-000000000005`,
    ]) {
      const response = await app.inject({ method: "GET", url });
      assert.equal(response.statusCode, 403);
      assert.equal(response.json().error.code, "FORBIDDEN_SCOPE");
    }
  } finally {
    await app.close();
  }
});

test("route capability is derived from the target active membership", async () => {
  const withoutMembershipRead = {
    ...activeAuthResult,
    memberships: [
      {
        ...activeAuthResult.memberships[0],
        capabilities: ["identity:read" as const],
      },
    ],
  };
  const app = buildServer({ getTrustedAuthResult: () => withoutMembershipRead });
  try {
    const response = await app.inject({
      method: "GET",
      url: `/memberships?tenant_id=${TENANT_ID}`,
    });
    assert.equal(response.statusCode, 403);
    assert.equal(response.json().error.code, "FORBIDDEN_SCOPE");
  } finally {
    await app.close();
  }
});

test("authenticated identities without an active membership fail closed", async () => {
  const inactiveOnly = {
    ...activeAuthResult,
    memberships: [activeAuthResult.memberships[1]],
  };
  const app = buildServer({ getTrustedAuthResult: () => inactiveOnly });
  try {
    const response = await app.inject({ method: "GET", url: `/me?tenant_id=${TENANT_ID}` });
    assert.equal(response.statusCode, 403);
    assert.equal(response.json().error.code, "FORBIDDEN_SCOPE");
  } finally {
    await app.close();
  }
});

test("identity route responses and access failures are represented in shared OpenAPI", async () => {
  const app = buildServer({ getTrustedAuthResult: () => activeAuthResult });
  const unauthenticatedApp = buildServer({ getTrustedAuthResult: () => undefined });

  try {
    const health = await app.inject({ method: "GET", url: "/health" });
    const me = await app.inject({
      method: "GET",
      url: `/me?tenant_id=${TENANT_ID}&campus_id=${CAMPUS_ID}`,
    });
    const memberships = await app.inject({
      method: "GET",
      url: `/memberships?tenant_id=${TENANT_ID}`,
    });
    const denied = await unauthenticatedApp.inject({ method: "GET", url: "/me" });
    const forbidden = await app.inject({
      method: "GET",
      url: "/me?tenant_id=00000000-0000-4000-8000-000000000004",
    });

    assert.ok(openApiContract.paths["/health"]?.get?.responses?.["200"]);
    assert.ok(openApiContract.paths["/me"]?.get?.responses?.["200"]);
    assert.ok(openApiContract.paths["/me"]?.get?.responses?.["401"]);
    assert.ok(openApiContract.paths["/me"]?.get?.responses?.["403"]);
    assert.ok(openApiContract.paths["/memberships"]?.get?.responses?.["200"]);
    assert.ok(openApiContract.paths["/memberships"]?.get?.responses?.["401"]);
    assert.ok(openApiContract.paths["/memberships"]?.get?.responses?.["403"]);

    assert.equal(health.statusCode, 200);
    assert.deepEqual(health.json(), { status: "ok" });
    assert.equal(me.statusCode, 200);
    assert.deepEqual(Object.keys(me.json().data).sort(), [
      "actor_id",
      "display_name",
      "memberships",
    ]);
    assert.equal(typeof me.json().request_id, "string");
    assert.equal(memberships.statusCode, 200);
    assert.ok(Array.isArray(memberships.json().data));
    assert.equal(denied.statusCode, 401);
    assert.equal(denied.json().error.code, "UNAUTHENTICATED");
    assert.equal(forbidden.statusCode, 403);
    assert.equal(forbidden.json().error.code, "FORBIDDEN_SCOPE");
  } finally {
    await app.close();
    await unauthenticatedApp.close();
  }
});

test("public content response and access outcomes match the shared OpenAPI contract", async () => {
  const contentService = new ContentService(new InMemoryContentRepository([publicContentRecord]));
  const app = buildServer({
    getTrustedAuthResult: () => activeAuthResult,
    contentService,
  });
  const unauthenticatedApp = buildServer({ contentService });

  try {
    const content = await app.inject({
      method: "GET",
      url: `/public-content/${publicContentRecord.content_key}?tenant_id=${TENANT_ID}&campus_id=${CAMPUS_ID}`,
    });
    const denied = await unauthenticatedApp.inject({
      method: "GET",
      url: `/public-content/${publicContentRecord.content_key}?tenant_id=${TENANT_ID}&campus_id=${CAMPUS_ID}`,
    });
    const forbidden = await app.inject({
      method: "GET",
      url: `/public-content/${publicContentRecord.content_key}?tenant_id=00000000-0000-4000-8000-000000000004`,
    });
    const rejectedClientFilter = await app.inject({
      method: "GET",
      url: `/public-content/${publicContentRecord.content_key}?tenant_id=${TENANT_ID}&campus_id=${CAMPUS_ID}&status=PUBLISHED`,
    });
    const notFound = await app.inject({
      method: "GET",
      url: `/public-content/missing-content?tenant_id=${TENANT_ID}&campus_id=${CAMPUS_ID}`,
    });

    const operation = openApiContract.paths["/public-content/{contentKey}"]?.get;
    assert.ok(operation?.responses?.["200"]);
    assert.ok(operation.responses?.["400"]);
    assert.ok(operation.responses?.["401"]);
    assert.ok(operation.responses?.["403"]);
    assert.ok(operation.responses?.["404"]);

    assert.equal(content.statusCode, 200);
    assert.deepEqual(content.json().data, {
      id: publicContentRecord.id,
      content_key: publicContentRecord.content_key,
      type: publicContentRecord.type,
      title: publicContentRecord.title,
      version: publicContentRecord.version,
      visibility: publicContentRecord.visibility,
      summary: publicContentRecord.body.summary,
      blocks: [{ kind: "TEXT", text: "合成内容" }],
      published_at: publicContentRecord.published_at,
    });
    assert.equal(typeof content.json().request_id, "string");
    assert.equal(denied.statusCode, 401);
    assert.equal(denied.json().error.code, "UNAUTHENTICATED");
    assert.equal(forbidden.statusCode, 403);
    assert.equal(forbidden.json().error.code, "FORBIDDEN_SCOPE");
    assert.equal(rejectedClientFilter.statusCode, 400);
    assert.equal(rejectedClientFilter.json().error.code, "VALIDATION_FAILED");
    assert.equal(notFound.statusCode, 404);
    assert.equal(notFound.json().error.code, "NOT_FOUND_SCOPED");
  } finally {
    await app.close();
    await unauthenticatedApp.close();
  }
});
