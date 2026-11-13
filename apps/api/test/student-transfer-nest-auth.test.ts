import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";
import type { IdentityCapability } from "@student-care/contracts";
import type { TrustedAuthResult } from "@student-care/auth";
import { createApiApp } from "../src/nest/api-app.js";
import type { ApiHttpRequest } from "../src/nest/api-tokens.js";

const TENANT = "22222222-2222-4222-8222-222222222222";
const CAMPUS = "33333333-3333-4333-8333-333333333333";
const OTHER_CAMPUS = "44444444-4444-4444-8444-444444444444";
const ACTOR = "55555555-5555-4555-8555-555555555555";
const STUDENT = "66666666-6666-4666-8666-666666666666";

function trusted(capabilities: string[], campuses = [CAMPUS]): TrustedAuthResult {
  return {
    trusted: true,
    session: {
      trusted: true,
      status: "ACTIVE",
      actor_id: ACTOR,
      expires_at: "2099-01-01T00:00:00.000Z",
    },
    identity: { actor_id: ACTOR, display_name: "合成转班测试员工" },
    memberships: [
      {
        tenant_id: TENANT,
        campus_ids: campuses,
        status: "ACTIVE",
        capabilities: capabilities as IdentityCapability[],
      },
    ],
  };
}

test("student transfer HTTP routes require trusted permissions and reject forged scope", async (t) => {
  const calls: { method: string; context: unknown; input?: unknown }[] = [];
  const accounts: Record<string, TrustedAuthResult> = {
    requester: trusted(["students:transfer:request"]),
    reviewer: trusted(["students:transfer:review"]),
    denied: trusted(["identity:read"]),
    ambiguous: trusted(["students:transfer:review"], [CAMPUS, OTHER_CAMPUS]),
  };
  const options = {
    studentTransferOperations: {
      list: async (context: unknown) => {
        calls.push({ method: "list", context });
        return {
          students: [],
          destinationClasses: [],
          requests: [],
          canRequest: true,
          canReview: false,
        };
      },
      create: async (context: unknown, input: unknown) => {
        calls.push({ method: "create", context, input });
        return { id: STUDENT, status: "PENDING", version: 1 };
      },
      review: async (context: unknown, id: string, input: unknown) => {
        calls.push({ method: "review", context, input });
        return { id, status: "APPROVED", version: 2 };
      },
    },
    getTrustedAuthResult: (request: ApiHttpRequest) => {
      const token = request.headers.authorization;
      return typeof token === "string" ? accounts[token.replace(/^Bearer /u, "")] : undefined;
    },
  };
  const app = await createApiApp(options);
  await app.listen(0, "127.0.0.1");
  t.after(() => app.close());
  const base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  const request = (path: string, token?: string, init: RequestInit = {}) =>
    fetch(base + path, {
      ...init,
      headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...init.headers },
    });
  const path = "/admin/student-transfers";
  assert.equal((await request(path)).status, 401);
  assert.equal((await request(path, "denied")).status, 403);
  assert.equal((await request(path, "ambiguous")).status, 403);
  assert.equal((await request(path, "requester")).status, 200);
  assert.equal((await request(path, "reviewer")).status, 200);
  assert.equal((await request(path + "?campus_id=" + CAMPUS, "reviewer")).status, 400);
  assert.equal(
    (await request(path, "reviewer", { headers: { "x-tenant-id": TENANT } })).status,
    400,
  );
  const post = (body: unknown): RequestInit => ({
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const createInput = { student_id: STUDENT, destination_class_ref: "合成乙班" };
  assert.equal((await request(path, "reviewer", post(createInput))).status, 403);
  assert.equal(
    (await request(path, "requester", post({ ...createInput, tenant_id: TENANT }))).status,
    400,
  );
  assert.equal((await request(path, "requester", post(createInput))).status, 201);
  const reviewPath = `${path}/${STUDENT}/review`;
  assert.equal(
    (await request(reviewPath, "requester", post({ expected_version: 1, decision: "APPROVE" })))
      .status,
    403,
  );
  assert.equal(
    (await request(reviewPath, "reviewer", post({ expected_version: 0, decision: "APPROVE" })))
      .status,
    400,
  );
  assert.equal(
    (await request(reviewPath, "reviewer", post({ expected_version: 1, decision: "AUTO" }))).status,
    400,
  );
  assert.equal(
    (await request(reviewPath, "reviewer", post({ expected_version: 1, decision: "APPROVE" })))
      .status,
    200,
  );
  assert.deepEqual(
    calls.map((call) => call.method),
    ["list", "list", "create", "review"],
  );
  for (const call of calls)
    assert.ok(
      typeof call.context === "object" &&
        call.context !== null &&
        "campusId" in call.context &&
        call.context.campusId === CAMPUS,
    );
});
