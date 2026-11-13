import assert from "node:assert/strict";
import test from "node:test";
import type { TrustedAuthResult } from "@student-care/auth";
import type {
  ApiHttpRequest,
  ApiHttpResponse,
  LearningInstitutionSettingOperations,
} from "../src/nest/api-tokens.js";
import { LearningInstitutionSettingController } from "../src/nest/learning-institution-setting.controller.js";

const request = (): ApiHttpRequest => ({ headers: {}, query: {}, params: {} });
function trusted(): TrustedAuthResult {
  return {
    trusted: true,
    session: {
      trusted: true,
      status: "ACTIVE",
      actor_id: "11111111-1111-4111-8111-111111111111",
      expires_at: "2099-01-01T00:00:00.000Z",
    },
    identity: { actor_id: "11111111-1111-4111-8111-111111111111", display_name: "合成负责人" },
    memberships: [
      {
        tenant_id: "22222222-2222-4222-8222-222222222222",
        campus_ids: ["33333333-3333-4333-8333-333333333333"],
        status: "ACTIVE",
        capabilities: ["learning:institution-setting"],
      },
    ],
  };
}
function capture() {
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

test("institution setting routes require trusted single active scope and never accept client scope", async () => {
  const calls: unknown[] = [];
  const service: LearningInstitutionSettingOperations = {
    read: async (context) => {
      calls.push(context);
      return { enabled: false, version: 0 };
    },
    update: async (context, body) => {
      calls.push({ context, body });
      return { enabled: true, version: 1 };
    },
  };
  const active = trusted();
  const cases: { auth: TrustedAuthResult | undefined; req: ApiHttpRequest; status: number }[] = [
    { auth: undefined, req: request(), status: 401 },
    {
      auth: { ...active, memberships: [{ ...active.memberships[0]!, capabilities: [] }] },
      req: request(),
      status: 403,
    },
    {
      auth: { ...active, memberships: [{ ...active.memberships[0]!, status: "SUSPENDED" }] },
      req: request(),
      status: 403,
    },
    {
      auth: {
        ...active,
        memberships: [
          {
            ...active.memberships[0]!,
            campus_ids: [
              "33333333-3333-4333-8333-333333333333",
              "44444444-4444-4444-8444-444444444444",
            ],
          },
        ],
      },
      req: request(),
      status: 403,
    },
    { auth: active, req: { ...request(), headers: { "x-tenant-id": "forged" } }, status: 400 },
    { auth: active, req: { ...request(), query: { actor_id: "forged" } }, status: 401 },
    { auth: active, req: { ...request(), query: { extra: "value" } }, status: 400 },
  ];
  for (const scenario of cases) {
    const controller = new LearningInstitutionSettingController(service, async () => scenario.auth);
    for (const write of [false, true]) {
      const res = capture();
      if (write)
        await controller.updateSetting(
          { enabled: true, expectedVersion: 0 },
          scenario.req,
          res.response,
        );
      else await controller.getSetting(scenario.req, res.response);
      assert.equal(res.status(), scenario.status);
    }
  }
  assert.equal(calls.length, 0);
  const controller = new LearningInstitutionSettingController(service, async () => active);
  const res = capture();
  await controller.updateSetting({ enabled: true, expectedVersion: 0 }, request(), res.response);
  assert.equal(res.status(), 200);
  assert.deepEqual(calls[0], {
    context: {
      actorId: "11111111-1111-4111-8111-111111111111",
      tenantId: "22222222-2222-4222-8222-222222222222",
      campusId: "33333333-3333-4333-8333-333333333333",
      capabilities: ["learning:institution-setting"],
    },
    body: { enabled: true, expectedVersion: 0 },
  });
});

test("institution setting controller returns safe conflict or unavailable responses", async () => {
  for (const [failure, expected] of [
    [{ statusCode: 409, code: "CONFLICT_STATE" }, 409],
    [new Error("private database details"), 500],
  ] as const) {
    const controller = new LearningInstitutionSettingController(
      {
        read: async () => {
          throw failure;
        },
        update: async () => {
          throw failure;
        },
      },
      async () => trusted(),
    );
    const res = capture();
    await controller.getSetting(request(), res.response);
    assert.equal(res.status(), expected);
    assert.doesNotMatch(JSON.stringify(res.body()), /private database/u);
  }
});
