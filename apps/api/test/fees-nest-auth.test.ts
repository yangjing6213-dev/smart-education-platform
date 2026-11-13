import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";
import type { IdentityCapability } from "@student-care/contracts";
import type { TrustedAuthResult } from "@student-care/auth";
import type { ApiHttpRequest, FeesContext, FeesOperations } from "../src/nest/api-tokens.js";
import { createApiApp } from "../src/nest/api-app.js";

const TENANT = "22222222-2222-4222-8222-222222222222";
const CAMPUS = "33333333-3333-4333-8333-333333333333";
const OTHER_CAMPUS = "44444444-4444-4444-8444-444444444444";
const PARENT = "11111111-1111-4111-8111-111111111111";
const ADMIN = "55555555-5555-4555-8555-555555555555";
const FEE_ID = "66666666-6666-4666-8666-666666666666";

function trusted(
  actorId: string,
  capabilities: IdentityCapability[],
  campusIds = [CAMPUS],
): TrustedAuthResult {
  return {
    trusted: true,
    session: {
      trusted: true,
      status: "ACTIVE",
      actor_id: actorId,
      expires_at: "2099-01-01T00:00:00.000Z",
    },
    identity: { actor_id: actorId, display_name: "合成邀请账号" },
    memberships: [
      { tenant_id: TENANT, campus_ids: campusIds, status: "ACTIVE", capabilities },
    ],
  };
}

function fakeOperations(calls: { readonly method: string; readonly context: FeesContext }[]): FeesOperations {
  return {
    parentFees: async (context) => {
      calls.push({ method: "parentFees", context });
      return { bindingApplications: [], documents: [], ledger: null, synthetic: true };
    },
    adminFees: async (context) => {
      calls.push({ method: "adminFees", context });
      return { students: [], documents: [], synthetic: true };
    },
    createFee: async (context) => {
      calls.push({ method: "createFee", context });
      return { id: FEE_ID, version: 1, synthetic: true };
    },
    revokeFee: async (context) => {
      calls.push({ method: "revokeFee", context });
      return { id: FEE_ID, version: 2, status: "REVOKED", synthetic: true };
    },
  };
}

async function startApi(t: { after(callback: () => void | Promise<void>): void }) {
  const calls: { method: string; context: FeesContext }[] = [];
  const auth: Record<string, TrustedAuthResult> = {
    parent: trusted(PARENT, ["binding:read"]),
    manager: trusted(ADMIN, ["fees:manage"]),
    noFeesPermission: trusted(ADMIN, ["content:write"]),
    ambiguous: trusted(ADMIN, ["fees:manage"], [CAMPUS, OTHER_CAMPUS]),
  };
  const app = await createApiApp({
    feesOperations: fakeOperations(calls),
    getTrustedAuthResult: (request: ApiHttpRequest) => {
      const token = request.headers.authorization;
      return typeof token === "string" ? auth[token.replace(/^Bearer /u, "")] : undefined;
    },
  });
  await app.listen(0, "127.0.0.1");
  t.after(() => app.close());
  const address = app.getHttpServer().address() as AddressInfo;
  return { base: `http://127.0.0.1:${address.port}`, calls };
}

async function request(base: string, path: string, token: string, init: RequestInit = {}) {
  return fetch(base + path, {
    ...init,
    headers: { authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
  });
}

test("fees routes derive one trusted campus and enforce separate parent and manager capabilities", async (t) => {
  const { base, calls } = await startApi(t);
  const parent = await request(base, "/parent/fees", "parent");
  assert.equal(parent.status, 200);
  assert.deepEqual((await parent.json() as { data: unknown }).data, {
    bindingApplications: [],
    documents: [],
    ledger: null,
    synthetic: true,
  });

  assert.equal((await request(base, "/parent/fees?campus_id=" + CAMPUS, "parent")).status, 400);
  assert.equal((await request(base, "/parent/fees", "parent", { headers: { "x-tenant-id": TENANT } })).status, 400);
  assert.equal((await request(base, "/admin/fees", "parent")).status, 403);
  assert.equal((await request(base, "/admin/fees", "noFeesPermission")).status, 403);
  assert.equal((await request(base, "/admin/fees", "ambiguous")).status, 403);

  const adminList = await request(base, "/admin/fees", "manager");
  assert.equal(adminList.status, 200);
  assert.equal((await adminList.json() as { data: { synthetic: boolean } }).data.synthetic, true);

  const payload = {
    student_id: FEE_ID,
    document_type: "BILL",
    title: "合成十月账单",
    period: "2026-10",
    amount_minor: 68000,
    valid_from: "2026-10-01",
    valid_to: "2026-10-31",
    summary: "仅供本机演示。",
  };
  const create = await request(base, "/admin/fees", "manager", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  assert.equal(create.status, 201);
  assert.equal((await create.json() as { data: { id: string } }).data.id, FEE_ID);

  const revoke = await request(base, `/admin/fees/${FEE_ID}/revoke`, "manager", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ expected_version: 1 }),
  });
  assert.equal(revoke.status, 200);
  assert.equal((await revoke.json() as { data: { status: string } }).data.status, "REVOKED");

  const invalidCreate = await request(base, "/admin/fees", "manager", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...payload, tenant_id: TENANT }),
  });
  assert.equal(invalidCreate.status, 400);
  assert.deepEqual(calls.map(({ method }) => method), ["parentFees", "adminFees", "createFee", "revokeFee"]);
  assert.ok(calls.every(({ context }) => context.tenantId === TENANT && context.campusId === CAMPUS));
});
