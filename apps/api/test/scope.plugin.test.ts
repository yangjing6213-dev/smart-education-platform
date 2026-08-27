import assert from "node:assert/strict";
import test from "node:test";
import fastify from "fastify";
import { scopePlugin } from "../src/plugins/scope.plugin.js";

const ACTOR_ID = "00000000-0000-4000-8000-00000000000a";
const TENANT_ID = "00000000-0000-4000-8000-00000000000c";
const CAMPUS_ID = "00000000-0000-4000-8000-00000000000e";

test("scope-required denial returns the fixed safe envelope and bypasses the handler", async () => {
  const app = fastify({ logger: false });
  let handlerCalls = 0;
  let requestId: string | undefined;

  await scopePlugin(app, {
    getScopeInput(request) {
      requestId = request.id;
      return { trustedActor: { actorId: ACTOR_ID }, membership: null };
    },
  });
  app.get("/scope-test", { config: { scopeRequired: true } }, async () => {
    handlerCalls += 1;
    return { reached: true };
  });

  try {
    const response = await app.inject({ method: "GET", url: "/scope-test" });

    assert.equal(response.statusCode, 403);
    assert.deepEqual(response.json(), {
      error: {
        code: "FORBIDDEN_SCOPE",
        message: "Scope access is not permitted.",
      },
      request_id: requestId,
    });
    assert.equal(handlerCalls, 0);
  } finally {
    await app.close();
  }
});

test("scope-required success decorates the request before the handler", async () => {
  const app = fastify({ logger: false });
  const expectedScope = { actorId: ACTOR_ID, tenantId: TENANT_ID, campusId: CAMPUS_ID } as const;

  await scopePlugin(app, {
    getScopeInput() {
      return {
        trustedActor: { actorId: ACTOR_ID },
        membership: {
          tenantId: TENANT_ID,
          campusIds: [CAMPUS_ID],
          status: "ACTIVE",
        },
        requestedTenantId: TENANT_ID,
        requestedCampusId: CAMPUS_ID,
      };
    },
  });
  app.get("/scope-test", { config: { scopeRequired: true } }, async (request) => ({
    scope: request.scopeContext,
  }));

  try {
    const response = await app.inject({ method: "GET", url: "/scope-test" });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { scope: expectedScope });
  } finally {
    await app.close();
  }
});

test("unscoped routes do not resolve scope and retain an undefined decorator", async () => {
  const app = fastify({ logger: false });
  let getScopeInputCalls = 0;

  await scopePlugin(app, {
    getScopeInput() {
      getScopeInputCalls += 1;
      return { trustedActor: null, membership: null };
    },
  });
  app.get("/unscoped-test", async (request) => ({
    scope_is_undefined: request.scopeContext === undefined,
  }));

  try {
    const response = await app.inject({ method: "GET", url: "/unscoped-test" });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { scope_is_undefined: true });
    assert.equal(getScopeInputCalls, 0);
  } finally {
    await app.close();
  }
});
