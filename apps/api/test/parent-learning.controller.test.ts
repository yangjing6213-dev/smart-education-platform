import assert from "node:assert/strict";
import { test } from "node:test";
import type { TrustedAuthResult } from "@student-care/auth";
import type { ApiHttpRequest, ApiHttpResponse, ParentLearningOperations } from "../src/nest/api-tokens.js";
import { ParentLearningController } from "../src/nest/parent-learning.controller.js";

const actorId = "11111111-1111-4111-8111-111111111111";
const tenantId = "22222222-2222-4222-8222-222222222222";
const campusId = "33333333-3333-4333-8333-333333333333";

function request(overrides: Partial<ApiHttpRequest> = {}): ApiHttpRequest {
  return {
    query: {},
    headers: {},
    params: {},
    ...overrides,
  };
}

function trusted(capabilities: TrustedAuthResult["memberships"][number]["capabilities"]): TrustedAuthResult {
  return {
    trusted: true,
    session: {
      trusted: true,
      status: "ACTIVE",
      actor_id: actorId,
      expires_at: "2099-01-01T00:00:00.000Z",
    },
    identity: { actor_id: actorId, display_name: "模拟家长甲" },
    memberships: [{ tenant_id: tenantId, campus_ids: [campusId], status: "ACTIVE", capabilities }],
  };
}

function responseCapture() {
  let status = 0;
  let body: unknown;
  const response: ApiHttpResponse = {
    status(value) {
      status = value;
      return response;
    },
    json(value) {
      body = value;
      return value;
    },
  };
  return { response, status: () => status, body: () => body };
}

function operations(): ParentLearningOperations & { calls: unknown[] } {
  const calls: unknown[] = [];
  return {
    calls,
    async parentLearning(context) {
      calls.push(context);
      return { approvedStudents: [], parentControls: [], parentSummary: [], parentSummaryUpdatedAt: "2026-10-20T00:00:00.000Z" };
    },
    async updateParentLearningControls(context) {
      calls.push(context);
      return {};
    },
    async recordParentLearningContact(context) {
      calls.push(context);
      return {};
    },
    async submitStaffSummary(context) {
      calls.push(context);
      return {};
    },
  };
}

test("parent learning controller rejects anonymous, missing-capability, forged, and client-scoped requests", async () => {
  const service = operations();
  const controller = new ParentLearningController(service, async () => undefined);
  const anonymous = responseCapture();
  await controller.parentLearning(request(), anonymous.response);
  assert.equal(anonymous.status(), 401);
  assert.equal(service.calls.length, 0);

  const withoutCapability = new ParentLearningController(
    service,
    async () => trusted(["daily:read"]),
  );
  const denied = responseCapture();
  await withoutCapability.parentLearning(request(), denied.response);
  assert.equal(denied.status(), 403);
  assert.equal(service.calls.length, 0);

  const authorized = new ParentLearningController(service, async () => trusted(["binding:read"]));
  const forged = responseCapture();
  await authorized.parentLearning(request({ query: { actor_id: actorId } }), forged.response);
  assert.equal(forged.status(), 401);
  assert.equal(service.calls.length, 0);

  const clientScope = responseCapture();
  await authorized.parentLearning(request({ headers: { "x-campus-id": campusId } }), clientScope.response);
  assert.equal(clientScope.status(), 400);
  assert.equal(service.calls.length, 0);

  const accepted = responseCapture();
  await authorized.parentLearning(request(), accepted.response);
  assert.equal(accepted.status(), 200);
  assert.deepEqual(service.calls[0], {
    actorId,
    tenantId,
    campusId,
    capabilities: ["binding:read"],
  });
});

test("staff summary submission is gated by the dedicated capability", async () => {
  const service = operations();
  const controller = new ParentLearningController(
    service,
    async () => trusted(["daily:submit"]),
  );
  const denied = responseCapture();
  await controller.submitStaffSummary({}, request(), denied.response);
  assert.equal(denied.status(), 403);
  assert.equal(service.calls.length, 0);

  const authorized = new ParentLearningController(
    service,
    async () => trusted(["learning:summary"]),
  );
  const accepted = responseCapture();
  await authorized.submitStaffSummary({}, request(), accepted.response);
  assert.equal(accepted.status(), 201);
  assert.deepEqual(service.calls[0], {
    actorId,
    tenantId,
    campusId,
    capabilities: ["learning:summary"],
  });
});
