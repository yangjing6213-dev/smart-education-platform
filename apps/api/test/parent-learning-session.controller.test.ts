import assert from "node:assert/strict";
import test from "node:test";
import type { TrustedAuthResult } from "@student-care/auth";
import type { ApiHttpRequest, ApiHttpResponse } from "../src/nest/api-tokens.js";

const actorId = "10000000-0000-4000-8000-000000000001";
const tenantId = "20000000-0000-4000-8000-000000000001";
const campusId = "30000000-0000-4000-8000-000000000001";
const studentId = "40000000-0000-4000-8000-000000000001";

function request(overrides: Partial<ApiHttpRequest> = {}): ApiHttpRequest {
  return { query: {}, headers: {}, params: {}, ...overrides };
}

function trusted(
  capabilities: TrustedAuthResult["memberships"][number]["capabilities"],
): TrustedAuthResult {
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

async function makeController() {
  const calls: unknown[][] = [];
  const service = {
    async listSessions(...args: unknown[]) {
      calls.push(args);
      return [];
    },
    async createSession(...args: unknown[]) {
      calls.push(args);
      return { id: "session-synthetic" };
    },
    async getSession(...args: unknown[]) {
      calls.push(args);
      return { id: "session-synthetic" };
    },
    async answerSession(...args: unknown[]) {
      calls.push(args);
      return { id: "session-synthetic" };
    },
    async hintSession(...args: unknown[]) {
      calls.push(args);
      return { id: "session-synthetic" };
    },
    async closeSession(...args: unknown[]) {
      calls.push(args);
      return { id: "session-synthetic" };
    },
  };
  const modulePath = "../src/nest/parent-learning-session.controller" + ".js";
  const { ParentLearningSessionController } = await import(modulePath);
  return {
    calls,
    ParentLearningSessionController,
    controller: new ParentLearningSessionController(service, async () => trusted(["binding:read"])),
  };
}

test("parent learning session controller rejects client scope and forwards trusted scope only", async () => {
  const { calls, controller } = await makeController();
  const clientScope = responseCapture();
  await controller.createSession(
    studentId,
    {
      questionId: "math-grade-3-addition-01",
      consentVersion: "LEARNING_DEMO_V2",
      durationMinutes: 5,
    },
    request({ headers: { "x-campus-id": campusId } }),
    clientScope.response,
  );
  assert.equal(clientScope.status(), 400);
  assert.equal(calls.length, 0);

  const accepted = responseCapture();
  const body = {
    questionId: "math-grade-3-addition-01",
    consentVersion: "LEARNING_DEMO_V2",
    durationMinutes: 5,
  };
  await controller.createSession(studentId, body, request(), accepted.response);
  assert.equal(accepted.status(), 201);
  assert.deepEqual(calls[0], [
    { actorId, tenantId, campusId, capabilities: ["binding:read"] },
    studentId,
    body,
  ]);
});

test("parent learning session controller denies unauthenticated or unscoped routes before service calls", async () => {
  const { calls, controller, ParentLearningSessionController } = await makeController();
  const anonymous = responseCapture();
  const anonymousController = new ParentLearningSessionController(
    {
      listSessions: async () => {
        calls.push(["unexpected"]);
        return [];
      },
    },
    async () => undefined,
  );
  await anonymousController.listSessions(studentId, request(), anonymous.response);
  assert.equal(anonymous.status(), 401);
  assert.equal(calls.length, 0);

  const query = responseCapture();
  await controller.listSessions(studentId, request({ query: { tenantId } }), query.response);
  assert.equal(query.status(), 400);
  assert.equal(calls.length, 0);
});
