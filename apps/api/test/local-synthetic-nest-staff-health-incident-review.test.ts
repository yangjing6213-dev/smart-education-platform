import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";
import type { TrustedAuthResult } from "@student-care/auth";
import type { ApiHttpRequest } from "../src/nest/api-tokens.js";
import { createApiApp } from "../src/nest/api-app.js";
import { buildLocalSyntheticServer } from "../src/local-synthetic/server.js";

const TENANT = "00000000-0000-4000-8000-000000000064";
const EAST = "00000000-0000-4000-8000-000000000065";
const WEST = "00000000-0000-4000-8000-000000000066";
const ACTORS = {
  parent: "00000000-0000-4000-8000-000000000001",
  teacher: "00000000-0000-4000-8000-000000000003",
  owner: "00000000-0000-4000-8000-000000000004",
  westOwner: "00000000-0000-4000-8000-000000000005",
};
const HEALTH_CAPABILITIES = [
  "health:review",
  "health:supplement",
  "health:publish",
  "health:revoke",
] as const;
const HEALTH_REPORT_CAPABILITIES = ["health:create", "health:submit"] as const;

function trusted(
  actorId: string,
  campus: string,
  capabilities: readonly string[],
  extraMemberships: readonly unknown[] = [],
): TrustedAuthResult {
  return {
    trusted: true,
    session: {
      trusted: true,
      status: "ACTIVE",
      actor_id: actorId,
      expires_at: "2099-01-01T00:00:00.000Z",
    },
    identity: { actor_id: actorId, display_name: "模拟员工" },
    memberships: [
      {
        tenant_id: TENANT,
        campus_ids: [campus],
        status: "ACTIVE",
        capabilities,
      },
      ...extraMemberships,
    ],
  } as TrustedAuthResult;
}

async function withApi(run: (baseUrl: string, incidentId: string) => Promise<void>) {
  const local = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  let api: Awaited<ReturnType<typeof createApiApp>> | undefined;
  try {
    async function localSession(profile: string) {
      const response = await local.inject({
        method: "POST",
        url: "/local/sessions",
        payload: { profile },
      });
      assert.equal(response.statusCode, 201);
      return { authorization: `Bearer ${response.json().handle as string}` };
    }
    const parent = await localSession("parent-alpha");
    const owner = await localSession("owner-east");
    const applicationResponse = await local.inject({
      method: "POST",
      url: "/local/binding-applications",
      headers: parent,
      payload: { student: "student-alpha", relationship: "GUARDIAN" },
    });
    const application = applicationResponse.json();
    const bindingResponse = await local.inject({
      method: "POST",
      url: `/local/binding-applications/${application.id as string}/review`,
      headers: owner,
      payload: { version: application.version as number, action: "approve" },
    });
    assert.equal(bindingResponse.json().status, "APPROVED");
    const memberships: Record<string, TrustedAuthResult> = {
      parent: trusted(ACTORS.parent, EAST, ["binding:read"]),
      teacher: trusted(ACTORS.teacher, EAST, HEALTH_REPORT_CAPABILITIES),
      reviewer: trusted(ACTORS.owner, EAST, HEALTH_CAPABILITIES),
      reviewerNoPublish: trusted(ACTORS.owner, EAST, ["health:review", "health:supplement"]),
      observer: trusted(ACTORS.owner, EAST, ["health:supplement"]),
      westReviewer: trusted(ACTORS.westOwner, WEST, HEALTH_CAPABILITIES),
      duplicateMembership: trusted(ACTORS.owner, EAST, HEALTH_CAPABILITIES, [
        {
          tenant_id: TENANT,
          campus_ids: [EAST],
          status: "ACTIVE",
          capabilities: HEALTH_CAPABILITIES,
        },
      ]),
      multipleCampusMemberships: trusted(ACTORS.owner, EAST, HEALTH_CAPABILITIES, [
        {
          tenant_id: TENANT,
          campus_ids: [WEST],
          status: "ACTIVE",
          capabilities: HEALTH_CAPABILITIES,
        },
      ]),
    };
    const staffHealthIncidentReviewOperations = (
      local as unknown as { staffHealthIncidentReviewOperations?: unknown }
    ).staffHealthIncidentReviewOperations;
    api = await createApiApp({
      parentGovernanceOperations: local.parentGovernanceOperations,
      staffHealthIncidentReviewOperations,
      getTrustedAuthResult: (request: ApiHttpRequest) => {
        const authorization = request.headers.authorization;
        const token =
          typeof authorization === "string" ? authorization.replace(/^Bearer /u, "") : undefined;
        return token ? memberships[token] : undefined;
      },
    } as unknown as Parameters<typeof createApiApp>[0]);
    await api.listen(0, "127.0.0.1");
    const address = api.getHttpServer().address() as AddressInfo | null;
    if (!address) throw new Error("Local synthetic API did not bind.");
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const studentsResponse = await request(baseUrl, "teacher", "/staff/health-incidents/students");
    assert.equal(studentsResponse.status, 200, JSON.stringify(studentsResponse.body));
    const students = data(studentsResponse) as unknown as Array<Record<string, unknown>>;
    assert.equal(students.length, 1);
    assert.equal(typeof students[0]?.id, "string");
    assert.equal(typeof students[0]?.studentLabel, "string");
    const draftResponse = await request(baseUrl, "teacher", "/staff/health-incidents", "POST", {
      studentId: students[0]?.id,
      observationCode: "NEEDS_FOLLOW_UP",
      dispositionCode: "FOLLOW_UP_SCHEDULED",
    });
    assert.equal(draftResponse.status, 201, JSON.stringify(draftResponse.body));
    const draft = data(draftResponse);
    assert.equal(draft.status, "DRAFT");
    assert.equal(draft.synthetic, true);
    const savedDraftsResponse = await request(baseUrl, "teacher", "/staff/health-incidents/drafts");
    assert.equal(savedDraftsResponse.status, 200, JSON.stringify(savedDraftsResponse.body));
    const savedDrafts = data(savedDraftsResponse) as unknown as Array<Record<string, unknown>>;
    assert.deepEqual(savedDrafts, [
      {
        id: draft.id,
        version: draft.version,
        status: "DRAFT",
        statusLabel: "草稿",
        studentId: students[0]?.id,
        observationCode: "NEEDS_FOLLOW_UP",
        dispositionCode: "FOLLOW_UP_SCHEDULED",
        synthetic: true,
      },
    ]);
    const submittedResponse = await request(
      baseUrl,
      "teacher",
      `/staff/health-incidents/${String(draft.id)}/submit`,
      "POST",
      { version: draft.version },
    );
    assert.equal(submittedResponse.status, 200, JSON.stringify(submittedResponse.body));
    assert.equal(data(submittedResponse).status, "SUBMITTED");
    const emptyDraftsResponse = await request(baseUrl, "teacher", "/staff/health-incidents/drafts");
    assert.deepEqual(data(emptyDraftsResponse), []);
    await run(baseUrl, String(draft.id));
  } finally {
    await api?.close();
    await local.close();
  }
}

async function request(
  baseUrl: string,
  token: string | undefined,
  path: string,
  method: "GET" | "POST" = "GET",
  body?: unknown,
  extraHeaders: Record<string, string> = {},
) {
  const headers = new Headers(extraHeaders);
  if (token) headers.set("authorization", `Bearer ${token}`);
  if (body !== undefined) headers.set("content-type", "application/json");
  const response = await fetch(new URL(path, baseUrl), {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return {
    status: response.status,
    body: (await response.json()) as Record<string, unknown>,
  };
}

const data = (response: { body: Record<string, unknown> }) =>
  response.body.data as Record<string, unknown>;

test("invited health review uses trusted capability and campus scope, then releases only a fixed parent summary", async () => {
  await withApi(async (baseUrl, incidentId) => {
    assert.equal((await request(baseUrl, undefined, "/staff/health-incidents")).status, 401);
    assert.equal(
      (await request(baseUrl, undefined, "/staff/health-incidents/drafts")).status,
      401,
    );
    const parentDenied = await request(baseUrl, "parent", "/staff/health-incidents");
    assert.equal(parentDenied.status, 403, JSON.stringify(parentDenied.body));
    assert.equal(
      (await request(baseUrl, "parent", "/staff/health-incidents/drafts")).status,
      403,
    );
    assert.equal(
      (await request(baseUrl, "reviewer", "/staff/health-incidents/drafts")).status,
      403,
    );
    assert.equal(
      (
        await request(baseUrl, "teacher", "/staff/health-incidents/drafts", "GET", undefined, {
          "x-campus-id": WEST,
        })
      ).status,
      400,
    );
    assert.equal((await request(baseUrl, "observer", "/staff/health-incidents")).status, 403);

    const forged = await request(baseUrl, "reviewer", "/staff/health-incidents", "GET", undefined, {
      "x-campus-id": WEST,
    });
    assert.equal(forged.status, 400);
    assert.equal(
      (await request(baseUrl, "duplicateMembership", "/staff/health-incidents")).status,
      403,
    );
    assert.equal(
      (await request(baseUrl, "multipleCampusMemberships", "/staff/health-incidents")).status,
      403,
    );

    const westQueue = await request(baseUrl, "westReviewer", "/staff/health-incidents");
    assert.equal(westQueue.status, 200);
    assert.deepEqual(data(westQueue), []);

    const parentBeforePublish = await request(baseUrl, "parent", "/parent/health-incidents");
    assert.equal(parentBeforePublish.status, 200);
    assert.deepEqual(data(parentBeforePublish), []);

    const queue = await request(baseUrl, "reviewer", "/staff/health-incidents");
    assert.equal(queue.status, 200);
    assert.ok(Array.isArray(data(queue)));
    const rows = data(queue) as unknown as Array<Record<string, unknown>>;
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.id, incidentId);
    assert.equal(rows[0]?.status, "SUBMITTED");
    assert.equal(
      (
        await request(
          baseUrl,
          "reviewerNoPublish",
          `/staff/health-incidents/${incidentId}/publish`,
          "POST",
          { version: rows[0]?.version, summaryCode: "FOLLOW_UP_IN_PROGRESS" },
        )
      ).status,
      403,
    );

    const current = rows[0]?.version as number;
    assert.ok(current > 1, "合成队列应包含至少一次状态变化后的版本。 ");
    const reviewed = await request(
      baseUrl,
      "reviewer",
      `/staff/health-incidents/${incidentId}/review`,
      "POST",
      { version: current - 1, action: "CONFIRM" },
    );
    assert.equal(reviewed.status, 409, "提交版本变化后必须阻止过期审核。 ");
    const confirmed = await request(
      baseUrl,
      "reviewer",
      `/staff/health-incidents/${incidentId}/review`,
      "POST",
      { version: current, action: "CONFIRM" },
    );
    assert.equal(confirmed.status, 200);
    const confirmedData = data(confirmed);
    assert.equal(confirmedData.status, "CONFIRMED");

    const supplemented = await request(
      baseUrl,
      "reviewer",
      `/staff/health-incidents/${incidentId}/supplement`,
      "POST",
      {
        version: confirmedData.version,
        dispositionCode: "GUARDIAN_SUMMARY_PREPARED",
      },
    );
    assert.equal(supplemented.status, 200);
    const supplementedData = data(supplemented);
    const published = await request(
      baseUrl,
      "reviewer",
      `/staff/health-incidents/${incidentId}/publish`,
      "POST",
      {
        version: supplementedData.version,
        summaryCode: "FOLLOW_UP_IN_PROGRESS",
      },
    );
    assert.equal(published.status, 200);
    assert.equal(data(published).status, "PUBLISHED");

    const parentAfterPublish = await request(baseUrl, "parent", "/parent/health-incidents");
    assert.equal(parentAfterPublish.status, 200);
    const parentRows = data(parentAfterPublish) as unknown as Array<Record<string, unknown>>;
    assert.equal(parentRows.length, 1);
    assert.equal(parentRows[0]?.status, "PUBLISHED");
    assert.equal(parentRows[0]?.parentSummary, "后续跟进正在进行。");
    assert.equal(parentRows[0]?.studentId, undefined);
  });
});
