/* global Request, Response, Headers, process */
import assert from "node:assert/strict";
import test from "node:test";
import { URL } from "node:url";
import { GET, PATCH, POST } from "../src/app/api/admin/[...path]/handler.ts";

const token = "a".repeat(43);
const actorId = "00000000-0000-4000-8000-000000000001";
const tenantId = "00000000-0000-4000-8000-000000000064";
const requestId = "00000000-0000-4000-8000-000000000101";
const account = { actor_id: actorId, username: "institution.admin", display_name: "合成管理员甲", account_status: "ACTIVE", memberships: [{ tenant_id: tenantId, campus_ids: [], status: "ACTIVE", capabilities: ["identity:read", "memberships:manage"] }] };
const change = { id: requestId, actor_id: "00000000-0000-4000-8000-000000000002", display_name: "合成员工乙", tenant_id: tenantId, status: "PENDING", version: 1, created_at: "2026-11-14T00:00:00.000Z" };
const context = (path) => ({ params: Promise.resolve({ path }) });

function req(path, method = "GET", body, query = "") {
  return new Request("http://127.0.0.1:3000/api/admin/" + path.join("/") + query, {
    method,
    headers: {
      host: "127.0.0.1:3000",
      origin: "http://127.0.0.1:3000",
      cookie: `student_care_admin_session=${token}`,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function withApi(run) {
  const keys = ["NODE_ENV", "ADMIN_WEB_LOCAL_NEST_API", "ADMIN_WEB_NEST_API_BASE_URL"];
  const previous = keys.map((key) => [key, process.env[key]]);
  process.env.NODE_ENV = "development";
  process.env.ADMIN_WEB_LOCAL_NEST_API = "http://127.0.0.1:4321";
  delete process.env.ADMIN_WEB_NEST_API_BASE_URL;
  try { await run(); }
  finally { for (const [key, value] of previous) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } }
}

test("account proxy forwards own-account requests with cookie authentication and filters response fields", async (t) => withApi(async () => {
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, init) => {
    calls.push({ url: String(url), init });
    if (new URL(String(url)).pathname.endsWith("profile-change-requests")) return Response.json({ data: [change] });
    if (new URL(String(url)).pathname.endsWith("/approve")) return Response.json({ data: { reviewed: true, status: "APPROVED", private: "drop" } });
    if (init.method === "GET") return Response.json({ data: { ...account, password_hash: "private", access_token: "private" } });
    return Response.json({ data: { changed: true, reauthentication_required: true, access_token: "private" } });
  });
  const getPath = ["identity", "account"];
  const profile = await GET(req(getPath), context(getPath));
  assert.equal(profile.status, 200);
  assert.deepEqual(await profile.json(), { data: account });
  const changePath = ["identity", "profile-change-requests"];
  const list = await GET(req(changePath, "GET", undefined, `?tenant_id=${tenantId}`), context(changePath));
  assert.deepEqual(await list.json(), { data: [change] });
  const patchPath = ["identity", "account", "username"];
  const changed = await PATCH(req(patchPath, "PATCH", { current_password: "synthetic-current-password", new_username: "admin.next" }), context(patchPath));
  assert.deepEqual(await changed.json(), { data: { changed: true, reauthentication_required: true } });
  assert.match(changed.headers.get("set-cookie") ?? "", /Max-Age=0/u);
  const approvePath = ["identity", "profile-change-requests", requestId, "approve"];
  const approved = await POST(req(approvePath, "POST", { expected_version: 1 }, `?tenant_id=${tenantId}`), context(approvePath));
  assert.deepEqual(await approved.json(), { data: { reviewed: true, status: "APPROVED" } });
  for (const call of calls) {
    const headers = new Headers(call.init.headers);
    assert.equal(headers.get("authorization"), `Bearer ${token}`);
    assert.equal(headers.has("cookie"), false);
    assert.equal(headers.has("x-tenant-id"), false);
    assert.equal(call.init.cache, "no-store");
    assert.equal(call.init.redirect, "error");
  }
}));

test("account proxy rejects cross-tenant query, malformed writes and unlisted actions before forwarding", async (t) => withApi(async () => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => { calls++; return Response.json({ data: account }); });
  const list = ["identity", "profile-change-requests"];
  assert.equal((await GET(req(list, "GET", undefined, "?tenant_id=forged&campus_id=forged"), context(list))).status, 400);
  const profile = ["identity", "account", "profile"];
  assert.equal((await PATCH(req(profile, "PATCH", { display_name: "含越界claim", role: "ADMIN" }), context(profile))).status, 400);
  const action = ["identity", "account", "delete"];
  assert.equal((await POST(req(action, "POST", {}), context(action))).status, 404);
  assert.equal(calls, 0);
}));
