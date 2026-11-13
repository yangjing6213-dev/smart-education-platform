import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";
import type { TrustedAuthResult } from "@student-care/auth";
import type { IdentityCapability } from "@student-care/contracts";
import {
  createInvitePasswordHash,
  InviteAuthService,
  parseInviteAccountsJson,
  type InviteAccountConfiguration,
} from "../src/nest/invite-auth.service.js";
import { createApiApp } from "../src/nest/api-app.js";
import { buildLocalSyntheticServer } from "../src/local-synthetic/server.js";

const TENANT_ID = "00000000-0000-4000-8000-000000000064";
const CAMPUS_ID = "00000000-0000-4000-8000-000000000065";
const PARENT_ID = "00000000-0000-4000-8000-000000000066";
const STAFF_ID = "00000000-0000-4000-8000-000000000067";
const SYNTHETIC_PASSWORD = "Synthetic-only-Invite-73!";

async function withApi(
  service: InviteAuthService,
  run: (base: string) => Promise<void>,
): Promise<void> {
  const app = await createApiApp({ inviteAuthService: service });
  try {
    await app.listen(0, "127.0.0.1");
    const address = app.getHttpServer().address() as AddressInfo;
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await app.close();
  }
}

async function postJson(base: string, path: string, body: unknown, token?: string) {
  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      connection: "close",
      "content-type": "application/json",
      ...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

async function getJson(base: string, path: string, token?: string) {
  const response = await fetch(`${base}${path}`, {
    headers: {
      connection: "close",
      ...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
    },
  });
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

async function makeAccount(
  username: string,
  actorId: string,
  displayName: string,
  capabilities: readonly IdentityCapability[],
): Promise<InviteAccountConfiguration> {
  return {
    username,
    password_hash: await createInvitePasswordHash(SYNTHETIC_PASSWORD),
    identity: { actor_id: actorId, display_name: displayName },
    memberships: [
      {
        tenant_id: TENANT_ID,
        campus_ids: [CAMPUS_ID],
        status: "ACTIVE",
        capabilities: [...capabilities],
      },
    ],
  } satisfies InviteAccountConfiguration;
}

test("synthetic invited parent and staff accounts use server-scoped memberships", async () => {
  const service = new InviteAuthService([
    await makeAccount("parent-demo", PARENT_ID, "模拟家长一号", [
      "identity:read",
      "memberships:read",
      "binding:apply",
      "binding:read",
    ]),
    await makeAccount("staff-demo", STAFF_ID, "模拟员工一号", [
      "identity:read",
      "memberships:read",
      "binding:read",
      "binding:review",
    ]),
  ]);

  await withApi(service, async (base) => {
    const parentLogin = await postJson(base, "/identity/login", {
      username: "parent-demo",
      password: SYNTHETIC_PASSWORD,
    });
    assert.equal(parentLogin.status, 200);
    const parentToken = (parentLogin.body.data as { access_token: string }).access_token;
    assert.equal(typeof parentToken, "string");
    const parentMe = await getJson(base, "/me", parentToken);
    assert.equal(parentMe.status, 200);
    assert.equal((parentMe.body.data as { actor_id: string }).actor_id, PARENT_ID);
    assert.deepEqual(
      (parentMe.body.data as { memberships: readonly { campus_ids: readonly string[] }[] })
        .memberships[0]?.campus_ids,
      [CAMPUS_ID],
    );

    const forgedRole = await getJson(base, "/staff/guardian-binding/applications?role=STAFF", parentToken);
    assert.equal(forgedRole.status, 401);

    const application = await postJson(
      base,
      "/guardian-binding/applications",
      {
        student_candidate_ref: "00000000-0000-4000-8000-0000000000c8",
        relationship: "GUARDIAN",
        consent: true,
      },
      parentToken,
    );
    assert.equal(application.status, 201);

    const staffLogin = await postJson(base, "/identity/login", {
      username: "staff-demo",
      password: SYNTHETIC_PASSWORD,
    });
    assert.equal(staffLogin.status, 200);
    const staffToken = (staffLogin.body.data as { access_token: string }).access_token;
    const pending = await getJson(base, "/staff/guardian-binding/applications", staffToken);
    assert.equal(pending.status, 200);
    const records = (pending.body.data as readonly { status: string }[]).map((item) => item.status);
    assert.deepEqual(records, ["PENDING"]);

    const authResult: TrustedAuthResult | undefined = await service.getTrustedAuthResult({
      query: {},
      headers: { authorization: `Bearer ${staffToken}` },
      params: {},
    });
    assert.equal(authResult?.identity.actor_id, STAFF_ID);
  });
});

test("invalid credentials are indistinguishable and client-selected scope is rejected", async () => {
  const service = new InviteAuthService([
    await makeAccount("parent-demo", PARENT_ID, "模拟家长一号", ["identity:read"]),
  ]);

  await withApi(service, async (base) => {
    const wrongPassword = await postJson(base, "/identity/login", {
      username: "parent-demo",
      password: "Wrong-password-73!",
    });
    const unknownUsername = await postJson(base, "/identity/login", {
      username: "missing-demo",
      password: "Wrong-password-73!",
    });
    assert.equal(wrongPassword.status, 401);
    assert.equal(unknownUsername.status, 401);
    assert.deepEqual(wrongPassword.body.error, unknownUsername.body.error);

    const clientSelectedScope = await postJson(base, "/identity/login", {
      username: "parent-demo",
      password: SYNTHETIC_PASSWORD,
      role: "STAFF",
      tenant_id: TENANT_ID,
      campus_id: CAMPUS_ID,
    });
    assert.equal(clientSelectedScope.status, 400);

    const forgedQueryClaim = await postJson(
      base,
      "/identity/login?role=STAFF",
      { username: "parent-demo", password: SYNTHETIC_PASSWORD },
    );
    assert.equal(forgedQueryClaim.status, 401);
  });
});

test("invite sessions expire and logout revokes the bearer token", async () => {
  const account = await makeAccount("parent-demo", PARENT_ID, "模拟家长一号", ["identity:read"]);
  let now = new Date();
  const service = new InviteAuthService([account], () => now);

  await withApi(service, async (base) => {
    const login = await postJson(base, "/identity/login", {
      username: "parent-demo",
      password: SYNTHETIC_PASSWORD,
    });
    assert.equal(login.status, 200);
    const token = (login.body.data as { access_token: string }).access_token;
    assert.equal(
      Date.parse((login.body.data as { expires_at: string }).expires_at) - now.getTime(),
      8 * 60 * 60 * 1000,
    );

    const logout = await postJson(base, "/identity/logout", {}, token);
    assert.equal(logout.status, 200);
    assert.equal((await getJson(base, "/me", token)).status, 401);

    const secondLogin = await postJson(base, "/identity/login", {
      username: "parent-demo",
      password: SYNTHETIC_PASSWORD,
    });
    const secondToken = (secondLogin.body.data as { access_token: string }).access_token;
    now = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    assert.equal((await getJson(base, "/me", secondToken)).status, 401);
  });
});

test("login fails closed when no invite accounts are configured", async () => {
  const service = new InviteAuthService([]);
  await withApi(service, async (base) => {
    const result = await postJson(base, "/identity/login", {
      username: "parent-demo",
      password: SYNTHETIC_PASSWORD,
    });
    assert.equal(result.status, 503);
    assert.equal((result.body.error as { code: string }).code, "PROVIDER_UNAVAILABLE");
  });
});

test("local synthetic invitation login fails closed when no auth service is configured", async () => {
  const app = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  try {
    const response = await app.inject({
      method: "POST",
      url: "/local/login",
      payload: { username: "parent-demo", password: SYNTHETIC_PASSWORD },
    });
    assert.equal(response.statusCode, 503);
    assert.equal(response.json().error.code, "AUTH_NOT_CONFIGURED");
  } finally {
    await app.close();
  }
});

test("local synthetic invitation login assigns only the profile bound to the trusted actor", async () => {
  const parentActorId = "00000000-0000-4000-8000-000000000001";
  const staffActorId = "00000000-0000-4000-8000-000000000003";
  const inviteAuthService = new InviteAuthService([
    await makeAccount("parent-local", parentActorId, "模拟家长甲", ["identity:read"]),
    await makeAccount("staff-local", staffActorId, "模拟员工甲", ["identity:read"]),
  ]);
  const app = await buildLocalSyntheticServer({ mode: "local-synthetic", inviteAuthService });

  try {
    assert.equal((await app.inject({ method: "GET", url: "/local/profiles" })).statusCode, 404);
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/local/sessions",
          payload: { profile: "teacher-east" },
        })
      ).statusCode,
      404,
    );

    const parentLogin = await app.inject({
      method: "POST",
      url: "/local/login",
      payload: { username: "parent-local", password: SYNTHETIC_PASSWORD },
    });
    assert.equal(parentLogin.statusCode, 201);
    const parentSession = parentLogin.json() as { handle: string; profile: string };
    assert.equal(parentSession.profile, "parent-alpha");
    assert.equal("access_token" in parentLogin.json(), false);
    const parentAuth = await app.resolveTrustedAuth(`Bearer ${parentSession.handle}`);
    assert.equal(parentAuth?.identity.actor_id, parentActorId);

    const staffLogin = await app.inject({
      method: "POST",
      url: "/local/login",
      payload: { username: "staff-local", password: SYNTHETIC_PASSWORD },
    });
    assert.equal(staffLogin.statusCode, 201);
    assert.equal((staffLogin.json() as { profile: string }).profile, "teacher-east");

    const forgedRole = await app.inject({
      method: "POST",
      url: "/local/login",
      payload: {
        username: "parent-local",
        password: SYNTHETIC_PASSWORD,
        profile: "teacher-east",
      },
    });
    assert.equal(forgedRole.statusCode, 400);

    const wrongPassword = await app.inject({
      method: "POST",
      url: "/local/login",
      payload: { username: "parent-local", password: "Wrong-password-73!" },
    });
    assert.equal(wrongPassword.statusCode, 401);
  } finally {
    await app.close();
  }
});

test("local synthetic invitation login rejects an account outside the local campus", async () => {
  const actorId = "00000000-0000-4000-8000-000000000001";
  const account = await makeAccount("parent-local", actorId, "模拟家长甲", ["identity:read"]);
  const inviteAuthService = new InviteAuthService([
    {
      ...account,
      memberships: [
        {
          ...account.memberships[0]!,
          campus_ids: ["00000000-0000-4000-8000-000000000066"],
        },
      ],
    },
  ]);
  const app = await buildLocalSyntheticServer({ mode: "local-synthetic", inviteAuthService });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/local/login",
      payload: { username: "parent-local", password: SYNTHETIC_PASSWORD },
    });
    assert.equal(response.statusCode, 401);
    assert.equal((await app.inject({ method: "GET", url: "/local/profiles" })).statusCode, 404);
  } finally {
    await app.close();
  }
});

test("server invite configuration accepts hashed credentials and rejects unknown fields", async () => {
  const account = await makeAccount("parent-demo", PARENT_ID, "模拟家长一号", ["identity:read"]);
  assert.equal(parseInviteAccountsJson(JSON.stringify([account])).length, 1);
  assert.deepEqual(parseInviteAccountsJson(undefined), []);
  assert.throws(
    () => parseInviteAccountsJson(JSON.stringify([{ ...account, role: "PLATFORM_ADMIN" }])),
    /Invite account configuration is invalid\./,
  );
  assert.throws(
    () => parseInviteAccountsJson("not-json"),
    /Invite account configuration is invalid\./,
  );
  await assert.rejects(createInvitePasswordHash("short"), /12 to 128 characters/);
});
