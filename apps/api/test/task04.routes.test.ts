import assert from "node:assert/strict";
import test from "node:test";
import { buildServer } from "../src/server.js";

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
