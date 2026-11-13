import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";
import type { TrustedAuthResult } from "@student-care/auth";
import type { GuardianBindingOperations } from "../src/modules/guardian-bindings/guardian-binding.service.js";
import { createApiApp } from "../src/nest/api-app.js";

const TENANT_ID = "00000000-0000-4000-8000-000000000064";
const EAST_CAMPUS_ID = "00000000-0000-4000-8000-000000000065";
const WEST_CAMPUS_ID = "00000000-0000-4000-8000-000000000066";
const STUDENT_REF = "00000000-0000-4000-8000-0000000000c8";

function authResult(
  actorId: string,
  displayName: string,
  campusId: string,
  capabilities: readonly ("binding:apply" | "binding:review")[],
): TrustedAuthResult {
  return {
    trusted: true,
    session: {
      trusted: true,
      status: "ACTIVE",
      actor_id: actorId,
      expires_at: "2099-01-01T00:00:00.000Z",
    },
    identity: { actor_id: actorId, display_name: displayName },
    memberships: [
      {
        tenant_id: TENANT_ID,
        campus_ids: [campusId],
        status: "ACTIVE",
        capabilities,
      },
    ],
  };
}

test("guardian-binding review queue shows trusted synthetic labels without internal references", async () => {
  const authByToken = new Map<string, TrustedAuthResult>([
    [
      "Bearer parent-token",
      authResult(
        "00000000-0000-4000-8000-000000000101",
        "模拟家长甲",
        EAST_CAMPUS_ID,
        ["binding:apply"],
      ),
    ],
    [
      "Bearer reviewer-east-token",
      authResult(
        "00000000-0000-4000-8000-000000000201",
        "模拟审核员",
        EAST_CAMPUS_ID,
        ["binding:review"],
      ),
    ],
    [
      "Bearer reviewer-west-token",
      authResult(
        "00000000-0000-4000-8000-000000000202",
        "西校区审核员",
        WEST_CAMPUS_ID,
        ["binding:review"],
      ),
    ],
  ]);
  const app = await createApiApp({
    getTrustedAuthResult: (request) => {
      const authorization = request.headers.authorization;
      return typeof authorization === "string" ? authByToken.get(authorization) : undefined;
    },
  });

  try {
    await app.listen(0, "127.0.0.1");
    const address = app.getHttpServer().address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const spoofedLabel = await fetch(`${baseUrl}/guardian-binding/applications`, {
      method: "POST",
      headers: {
        authorization: "Bearer parent-token",
        connection: "close",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        student_candidate_ref: STUDENT_REF,
        relationship: "GUARDIAN",
        consent: true,
        applicant_label: "伪造名称",
      }),
    });
    assert.equal(spoofedLabel.status, 400);

    const parent = await fetch(`${baseUrl}/guardian-binding/applications`, {
      method: "POST",
      headers: {
        authorization: "Bearer parent-token",
        connection: "close",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        student_candidate_ref: STUDENT_REF,
        relationship: "GUARDIAN",
        consent: true,
      }),
    });
    assert.equal(parent.status, 201);

    const eastQueueResponse = await fetch(`${baseUrl}/staff/guardian-binding/applications`, {
      headers: { authorization: "Bearer reviewer-east-token", connection: "close" },
    });
    assert.equal(eastQueueResponse.status, 200);
    const eastQueue = (await eastQueueResponse.json()) as {
      data: Record<string, unknown>[];
    };
    assert.equal(eastQueue.data.length, 1);
    const row = eastQueue.data[0]!;
    assert.equal(row.applicant_label, "模拟家长甲");
    assert.equal(row.student_label, "示例学生甲");
    assert.deepEqual(Object.keys(row).sort(), [
      "applicant_label",
      "id",
      "relationship",
      "reviewed_at",
      "status",
      "student_label",
      "submitted_at",
      "version",
    ]);
    assert.doesNotMatch(
      JSON.stringify(row),
      /student_candidate_ref|actor_id|tenant_id|campus_id|00000000-0000-4000-8000/u,
    );

    const westQueueResponse = await fetch(`${baseUrl}/staff/guardian-binding/applications`, {
      headers: { authorization: "Bearer reviewer-west-token", connection: "close" },
    });
    assert.equal(westQueueResponse.status, 200);
    const westQueue = (await westQueueResponse.json()) as { data: unknown[] };
    assert.deepEqual(westQueue.data, []);
  } finally {
    await app.close();
  }
});

test("guardian-binding queue fallback strips private references when a provider has no labels", async () => {
  const legacyApplication = {
    id: "00000000-0000-4000-8000-000000000301",
    student_candidate_ref: STUDENT_REF,
    relationship: "GUARDIAN",
    status: "PENDING",
    version: 1,
    submitted_at: "2026-10-18T08:00:00.000Z",
    reviewed_at: null,
  } as const;
  const app = await createApiApp({
    guardianBindingOperations: {
      listPending: () => [legacyApplication],
    } as unknown as GuardianBindingOperations,
    getTrustedAuthResult: () =>
      authResult(
        "00000000-0000-4000-8000-000000000201",
        "模拟审核员",
        EAST_CAMPUS_ID,
        ["binding:review"],
      ),
  });

  try {
    await app.listen(0, "127.0.0.1");
    const address = app.getHttpServer().address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${address.port}/staff/guardian-binding/applications`, {
      headers: { connection: "close" },
    });
    assert.equal(response.status, 200);
    const body = (await response.json()) as { data: Record<string, unknown>[] };
    assert.deepEqual(body.data[0], {
      id: legacyApplication.id,
      relationship: "GUARDIAN",
      status: "PENDING",
      version: 1,
      submitted_at: "2026-10-18T08:00:00.000Z",
      reviewed_at: null,
      applicant_label: "申请人信息待补充",
      student_label: "学生信息待补充",
    });
    assert.doesNotMatch(JSON.stringify(body), /student_candidate_ref|actor_id|tenant_id|campus_id/u);
  } finally {
    await app.close();
  }
});
