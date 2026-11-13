import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";
import type { TrustedAuthResult } from "@student-care/auth";
import { buildServer } from "../src/server.js";
import { createApiApp } from "../src/nest/api-app.js";

const ACTOR_ID = "00000000-0000-4000-8000-000000000003";
const TENANT_ID = "00000000-0000-4000-8000-000000000001";
const CAMPUS_ID = "00000000-0000-4000-8000-000000000002";

const activeAuthResult: TrustedAuthResult = {
  trusted: true,
  session: {
    trusted: true,
    status: "ACTIVE",
    actor_id: ACTOR_ID,
    expires_at: "2099-01-01T00:00:00.000Z",
  },
  identity: { actor_id: ACTOR_ID, display_name: "模拟员工一号" },
  memberships: [
    {
      tenant_id: TENANT_ID,
      campus_ids: [CAMPUS_ID],
      status: "ACTIVE",
      capabilities: ["identity:read", "memberships:read"],
    },
    {
      tenant_id: TENANT_ID,
      campus_ids: [CAMPUS_ID],
      status: "SUSPENDED",
      capabilities: ["identity:read", "memberships:read"],
    },
  ],
} as const;

async function withServers(
  getTrustedAuthResult: () => TrustedAuthResult | undefined,
  run: (nestBase: string, fastifyBase: string) => Promise<void>,
): Promise<void> {
  const nest = await createApiApp({ getTrustedAuthResult });
  const fastify = buildServer({ getTrustedAuthResult });

  try {
    await nest.listen(0, "127.0.0.1");
    await fastify.listen({ port: 0, host: "127.0.0.1" });
    const nestBase = `http://127.0.0.1:${(nest.getHttpServer().address() as AddressInfo).port}`;
    const fastifyBase = `http://127.0.0.1:${(fastify.server.address() as AddressInfo).port}`;
    assert.equal((nest.getHttpServer().address() as AddressInfo).address, "127.0.0.1");
    assert.equal((fastify.server.address() as AddressInfo).address, "127.0.0.1");
    await run(nestBase, fastifyBase);
  } finally {
    await Promise.all([nest.close(), fastify.close()]);
  }

  assert.equal(nest.getHttpServer().address(), null);
  assert.equal(fastify.server.address(), null);
}

async function getJson(base: string, path: string, headers?: Record<string, string>) {
  const response = await fetch(`${base}${path}`, { headers: { connection: "close", ...headers } });
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

test("Nest identity routes match Fastify's default fail-closed behavior", async () => {
  await withServers(
    () => undefined,
    async (nestBase, fastifyBase) => {
      for (const path of ["/me", "/memberships"]) {
        const nest = await getJson(nestBase, path);
        const fastify = await getJson(fastifyBase, path);

        assert.equal(nest.status, 401);
        assert.equal(fastify.status, 401);
        assert.equal((nest.body.error as { code: string }).code, "UNAUTHENTICATED");
        assert.equal((fastify.body.error as { code: string }).code, "UNAUTHENTICATED");
      }
    },
  );
});

test("Nest identity routes return the same active identity and memberships as Fastify", async () => {
  await withServers(
    () => activeAuthResult,
    async (nestBase, fastifyBase) => {
      for (const path of [
        `/me?tenant_id=${TENANT_ID}&campus_id=${CAMPUS_ID}`,
        `/memberships?tenant_id=${TENANT_ID}`,
      ]) {
        const nest = await getJson(nestBase, path);
        const fastify = await getJson(fastifyBase, path);

        assert.equal(nest.status, 200);
        assert.equal(fastify.status, 200);
        assert.deepEqual(nest.body.data, fastify.body.data);
        assert.equal(Array.isArray(nest.body.data) || typeof nest.body.data === "object", true);
      }
    },
  );
});

test("Nest identity routes match Fastify's forged-claim and scope denials", async () => {
  await withServers(
    () => activeAuthResult,
    async (nestBase, fastifyBase) => {
      for (const path of [
        `/me?tenant_id=${TENANT_ID}&role=PLATFORM_ADMIN`,
        `/me?tenant_id=${TENANT_ID}&actor_id=${ACTOR_ID}`,
        "/memberships?tenant_id=00000000-0000-4000-8000-000000000004",
        "/me?tenant_id=00000000-0000-4000-8000-000000000001&campus_id=00000000-0000-4000-8000-000000000005",
      ]) {
        const nest = await getJson(nestBase, path);
        const fastify = await getJson(fastifyBase, path);

        assert.equal(nest.status, fastify.status);
        assert.equal(nest.status, path.includes("role=") || path.includes("actor_id=") ? 401 : 403);
        assert.deepEqual(nest.body.error, fastify.body.error);
      }

      const forgedHeaderNest = await getJson(nestBase, `/memberships?tenant_id=${TENANT_ID}`, {
        "x-role": "PLATFORM_ADMIN",
      });
      const forgedHeaderFastify = await getJson(
        fastifyBase,
        `/memberships?tenant_id=${TENANT_ID}`,
        {
          "x-role": "PLATFORM_ADMIN",
        },
      );
      assert.equal(forgedHeaderNest.status, 401);
      assert.equal(forgedHeaderNest.status, forgedHeaderFastify.status);

      const forgedActorHeaderNest = await getJson(nestBase, `/me?tenant_id=${TENANT_ID}`, {
        "x-actor-id": ACTOR_ID,
      });
      const forgedActorHeaderFastify = await getJson(fastifyBase, `/me?tenant_id=${TENANT_ID}`, {
        "x-actor-id": ACTOR_ID,
      });
      assert.equal(forgedActorHeaderNest.status, 401);
      assert.equal(forgedActorHeaderNest.status, forgedActorHeaderFastify.status);
    },
  );
});

test("Nest identity routes reject repeated campus IDs instead of broadening scope", async () => {
  await withServers(
    () => activeAuthResult,
    async (nestBase, fastifyBase) => {
      for (const path of [
        `/me?tenant_id=${TENANT_ID}&campus_id=${CAMPUS_ID}&campus_id=00000000-0000-4000-8000-000000000005`,
        `/memberships?tenant_id=${TENANT_ID}&campus_id=${CAMPUS_ID}&campus_id=00000000-0000-4000-8000-000000000005`,
      ]) {
        const nest = await getJson(nestBase, path);
        const fastify = await getJson(fastifyBase, path);

        assert.equal(nest.status, 403);
        assert.equal(nest.status, fastify.status);
        assert.deepEqual(nest.body.error, fastify.body.error);
      }
    },
  );
});

test("Nest memberships require the same route capability as Fastify", async () => {
  const noMembershipRead: TrustedAuthResult = {
    ...activeAuthResult,
    memberships: [
      {
        tenant_id: TENANT_ID,
        campus_ids: [CAMPUS_ID],
        status: "ACTIVE",
        capabilities: ["identity:read"],
      },
    ],
  };
  await withServers(
    () => noMembershipRead,
    async (nestBase, fastifyBase) => {
      const path = `/memberships?tenant_id=${TENANT_ID}`;
      const nest = await getJson(nestBase, path);
      const fastify = await getJson(fastifyBase, path);

      assert.equal(nest.status, 403);
      assert.equal(nest.status, fastify.status);
      assert.deepEqual(nest.body.error, fastify.body.error);
    },
  );
});

test("Nest me route requires identity:read in the active membership", async () => {
  const noIdentityRead: TrustedAuthResult = {
    ...activeAuthResult,
    memberships: [
      {
        tenant_id: TENANT_ID,
        campus_ids: [CAMPUS_ID],
        status: "ACTIVE",
        capabilities: ["memberships:read"],
      },
    ],
  };
  await withServers(
    () => noIdentityRead,
    async (nestBase, fastifyBase) => {
      const path = `/me?tenant_id=${TENANT_ID}`;
      const nest = await getJson(nestBase, path);
      const fastify = await getJson(fastifyBase, path);

      assert.equal(nest.status, 403);
      assert.equal(nest.status, fastify.status);
      assert.deepEqual(nest.body.error, fastify.body.error);
    },
  );
});
