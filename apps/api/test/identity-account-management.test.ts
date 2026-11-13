import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";
import { createInvitePasswordHash, InviteAuthService } from "../src/nest/invite-auth.service.js";
import { createApiApp } from "../src/nest/api-app.js";
import type { InviteAccountConfiguration } from "../src/nest/invite-auth.service.js";

const TENANT_ID = "00000000-0000-4000-8000-000000000101";
const CAMPUS_ID = "00000000-0000-4000-8000-000000000102";
const PARENT_ID = "00000000-0000-4000-8000-000000000103";
const STAFF_ID = "00000000-0000-4000-8000-000000000104";
const ADMIN_ID = "00000000-0000-4000-8000-000000000105";
const INITIAL_PASSWORD = "Synthetic-Account-Password-2026!";

function account(
  username: string,
  actorId: string,
  displayName: string,
  passwordHash: string,
  capabilities: readonly string[],
): InviteAccountConfiguration {
  return {
    username,
    password_hash: passwordHash,
    identity: { actor_id: actorId, display_name: displayName },
    memberships: [
      {
        tenant_id: TENANT_ID,
        campus_ids: [CAMPUS_ID],
        status: "ACTIVE",
        capabilities,
      },
    ],
  } as InviteAccountConfiguration;
}

async function withIdentityApp(
  run: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const passwordHash = await createInvitePasswordHash(INITIAL_PASSWORD);
  const service = new InviteAuthService([
    account("parent.demo", PARENT_ID, "模拟家长", passwordHash, [
      "identity:read",
      "memberships:read",
      "binding:apply",
      "learning:summary",
      "leave:apply",
    ]),
    account("staff.demo", STAFF_ID, "模拟员工", passwordHash, [
      "identity:read",
      "memberships:read",
      "care:write",
      "daily:create",
    ]),
    account("admin.demo", ADMIN_ID, "模拟管理员", passwordHash, [
      "identity:read",
      "memberships:read",
      "memberships:manage",
      "care:review",
    ]),
  ]);
  const app = await createApiApp({ inviteAuthService: service });
  try {
    await app.listen(0, "127.0.0.1");
    const address = app.getHttpServer().address() as AddressInfo;
    assert.equal(address.address, "127.0.0.1");
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await app.close();
  }
}

async function call(
  baseUrl: string,
  method: string,
  path: string,
  body?: unknown,
  token?: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      connection: "close",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

async function login(baseUrl: string, username: string, password: string): Promise<string> {
  const response = await call(baseUrl, "POST", "/identity/login", { username, password });
  assert.equal(response.status, 200);
  return String((response.body.data as { access_token: string }).access_token);
}

test("identity account center shares profile and securely changes credentials and sessions", async () => {
  await withIdentityApp(async (baseUrl) => {
    const anonymous = await call(baseUrl, "GET", "/me");
    assert.equal(anonymous.status, 401);

    const parentToken = await login(baseUrl, "parent.demo", INITIAL_PASSWORD);
    const initial = await call(baseUrl, "GET", "/identity/account", undefined, parentToken);
    assert.equal(initial.status, 200);
    assert.equal((initial.body.data as { username: string }).username, "parent.demo");

    const forged = await call(
      baseUrl,
      "PATCH",
      "/identity/account/profile",
      { display_name: "冒名修改", actor_id: STAFF_ID, tenant_id: TENANT_ID },
      parentToken,
    );
    assert.equal(forged.status, 400);
    const unchanged = await call(baseUrl, "GET", "/me", undefined, parentToken);
    assert.equal((unchanged.body.data as { display_name: string }).display_name, "模拟家长");

    const profile = await call(
      baseUrl,
      "PATCH",
      "/identity/account/profile",
      { display_name: "家长新名称" },
      parentToken,
    );
    assert.equal(profile.status, 200);
    const afterProfile = await call(baseUrl, "GET", "/me", undefined, parentToken);
    assert.equal((afterProfile.body.data as { display_name: string }).display_name, "家长新名称");

    const duplicate = await call(
      baseUrl,
      "PATCH",
      "/identity/account/username",
      { current_password: INITIAL_PASSWORD, new_username: "STAFF.DEMO" },
      parentToken,
    );
    assert.equal(duplicate.status, 409);

    const badPassword = await call(
      baseUrl,
      "POST",
      "/identity/account/password",
      { current_password: "incorrect-password", new_password: "New-Synthetic-Password-2026!" },
      parentToken,
    );
    assert.equal(badPassword.status, 401);

    const usernameUpdate = await call(
      baseUrl,
      "PATCH",
      "/identity/account/username",
      { current_password: INITIAL_PASSWORD, new_username: "parent.renamed" },
      parentToken,
    );
    assert.equal(usernameUpdate.status, 200);
    assert.equal((await call(baseUrl, "GET", "/me", undefined, parentToken)).status, 401);
    assert.equal((await call(baseUrl, "POST", "/identity/login", {
      username: "parent.demo",
      password: INITIAL_PASSWORD,
    })).status, 401);

    const renamedToken = await login(baseUrl, "PARENT.RENAMED", INITIAL_PASSWORD);
    const passwordUpdate = await call(
      baseUrl,
      "POST",
      "/identity/account/password",
      { current_password: INITIAL_PASSWORD, new_password: "New-Synthetic-Password-2026!" },
      renamedToken,
    );
    assert.equal(passwordUpdate.status, 200);
    assert.equal((await call(baseUrl, "GET", "/me", undefined, renamedToken)).status, 401);
    assert.equal((await call(baseUrl, "POST", "/identity/login", {
      username: "parent.renamed",
      password: INITIAL_PASSWORD,
    })).status, 401);

    const firstSession = await login(baseUrl, "parent.renamed", "New-Synthetic-Password-2026!");
    const secondSession = await login(baseUrl, "parent.renamed", "New-Synthetic-Password-2026!");
    const logoutAll = await call(baseUrl, "POST", "/identity/account/logout-all", {}, firstSession);
    assert.equal(logoutAll.status, 200);
    assert.equal((await call(baseUrl, "GET", "/me", undefined, firstSession)).status, 401);
    assert.equal((await call(baseUrl, "GET", "/me", undefined, secondSession)).status, 401);
  });
});

test("staff display-name changes require an authorized same-tenant admin review", async () => {
  await withIdentityApp(async (baseUrl) => {
    const staffToken = await login(baseUrl, "staff.demo", INITIAL_PASSWORD);
    const request = await call(
      baseUrl,
      "POST",
      "/identity/account/profile-change-requests",
      { tenant_id: TENANT_ID, display_name: "员工申请新名称" },
      staffToken,
    );
    assert.equal(request.status, 201);
    const requestId = String((request.body.data as { id: string }).id);
    const staffBeforeReview = await call(baseUrl, "GET", "/me", undefined, staffToken);
    assert.equal((staffBeforeReview.body.data as { display_name: string }).display_name, "模拟员工");

    const adminToken = await login(baseUrl, "admin.demo", INITIAL_PASSWORD);
    const queue = await call(
      baseUrl,
      "GET",
      `/identity/profile-change-requests?tenant_id=${TENANT_ID}`,
      undefined,
      adminToken,
    );
    assert.equal(queue.status, 200);
    assert.ok(Array.isArray(queue.body.data));

    const reviewed = await call(
      baseUrl,
      "POST",
      `/identity/profile-change-requests/${requestId}/approve?tenant_id=${TENANT_ID}`,
      { expected_version: 1 },
      adminToken,
    );
    assert.equal(reviewed.status, 200);
    const staffAfterReview = await call(baseUrl, "GET", "/me", undefined, staffToken);
    assert.equal((staffAfterReview.body.data as { display_name: string }).display_name, "员工申请新名称");
  });
});
