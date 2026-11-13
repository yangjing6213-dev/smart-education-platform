import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";
import type { TrustedAuthResult } from "@student-care/auth";
import type { ApiHttpRequest } from "../src/nest/api-tokens.js";
import { createApiApp } from "../src/nest/api-app.js";
import { BindingLeaveService } from "../src/local-synthetic/binding-leave.service.js";
import { LocalSyntheticGuardianBindingAdapter } from "../src/local-synthetic/nest-guardian-binding-adapter.js";
import { LocalRepository } from "../src/local-synthetic/repository.js";
import { buildLocalSyntheticServer } from "../src/local-synthetic/server.js";
import { LocalSessions } from "../src/local-synthetic/sessions.js";

const TENANT_ID = "00000000-0000-4000-8000-000000000064";
const EAST_CAMPUS_ID = "00000000-0000-4000-8000-000000000065";
const WEST_CAMPUS_ID = "00000000-0000-4000-8000-000000000066";
const OTHER_TENANT_ID = "00000000-0000-4000-8000-00000000006e";
const OTHER_CAMPUS_ID = "00000000-0000-4000-8000-00000000006f";
const EAST_STUDENT_REF = "00000000-0000-4000-8000-0000000000c8";

test("unexpected local binding failures are allowed to reach server error handling", () => {
  const repository = new LocalRepository();
  const bindings = new BindingLeaveService(repository);
  bindings.applyBinding = () => {
    throw new Error("unexpected binding repository failure");
  };
  const adapter = new LocalSyntheticGuardianBindingAdapter(bindings, repository);

  assert.throws(
    () =>
      adapter.submit(
        {
          scopes: [
            {
              actorId: "00000000-0000-4000-8000-000000000001",
              tenantId: "00000000-0000-4000-8000-000000000064",
              campusId: "00000000-0000-4000-8000-000000000065",
            },
          ],
        },
        {
          student_candidate_ref: EAST_STUDENT_REF,
          relationship: "GUARDIAN",
          consent: true,
        },
      ),
    /unexpected binding repository failure/,
  );
});

function trustedAuth(
  actorId: string,
  campusId: string,
  capabilities: readonly ("binding:apply" | "binding:read" | "binding:review")[],
  tenantId = TENANT_ID,
): TrustedAuthResult {
  return {
    trusted: true,
    session: {
      trusted: true,
      status: "ACTIVE",
      actor_id: actorId,
      expires_at: "2099-01-01T00:00:00.000Z",
    },
    identity: { actor_id: actorId, display_name: "模拟账号" },
    memberships: [
      {
        tenant_id: tenantId,
        campus_ids: [campusId],
        status: "ACTIVE",
        capabilities,
      },
    ],
  };
}

const sessions: Readonly<Record<string, TrustedAuthResult>> = {
  "parent-east": trustedAuth("00000000-0000-4000-8000-000000000101", EAST_CAMPUS_ID, [
    "binding:apply",
    "binding:read",
  ]),
  "parent-other": trustedAuth("00000000-0000-4000-8000-000000000102", EAST_CAMPUS_ID, [
    "binding:apply",
    "binding:read",
  ]),
  "staff-east": trustedAuth("00000000-0000-4000-8000-000000000201", EAST_CAMPUS_ID, [
    "binding:review",
  ]),
  "staff-west": trustedAuth("00000000-0000-4000-8000-000000000202", WEST_CAMPUS_ID, [
    "binding:review",
  ]),
  "staff-other-tenant": trustedAuth(
    "00000000-0000-4000-8000-000000000203",
    OTHER_CAMPUS_ID,
    ["binding:review"],
    OTHER_TENANT_ID,
  ),
  "staff-no-review": trustedAuth("00000000-0000-4000-8000-000000000204", EAST_CAMPUS_ID, [
    "binding:read",
  ]),
};

async function withApi(run: (baseUrl: string) => Promise<void>): Promise<void> {
  const app = await createApiApp({
    getTrustedAuthResult: (request: ApiHttpRequest) => {
      const cookie = request.headers.cookie;
      if (typeof cookie !== "string") return undefined;
      const match = /^session=([a-z-]+)$/.exec(cookie);
      return match?.[1] === undefined ? undefined : sessions[match[1]];
    },
  });
  await app.listen(0, "127.0.0.1");
  const address = app.getHttpServer().address() as AddressInfo | null;
  if (!address) throw new Error("Local synthetic test server did not bind.");
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await app.close();
  }
}

interface RequestOptions {
  readonly session?: string;
  readonly authorization?: string;
  readonly method?: "GET" | "POST";
  readonly body?: unknown;
  readonly headers?: Readonly<Record<string, string>>;
}

async function requestJson(
  baseUrl: string,
  path: string,
  options: RequestOptions = {},
): Promise<{ readonly status: number; readonly body: Record<string, unknown> }> {
  const headers = new Headers(options.headers);
  if (options.session !== undefined) headers.set("cookie", `session=${options.session}`);
  if (options.authorization !== undefined) headers.set("authorization", options.authorization);
  if (options.body !== undefined) headers.set("content-type", "application/json");
  const response = await fetch(new URL(path, baseUrl), {
    method: options.method ?? (options.body === undefined ? "GET" : "POST"),
    headers,
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });
  return {
    status: response.status,
    body: (await response.json()) as Record<string, unknown>,
  };
}

function dataOf(response: { readonly body: Record<string, unknown> }): Record<string, unknown> {
  return response.body.data as Record<string, unknown>;
}

function errorCodeOf(response: { readonly body: Record<string, unknown> }): string | undefined {
  const error = response.body.error as { readonly code?: string } | undefined;
  return error?.code;
}

async function withLocalSessionApi(
  run: (localBaseUrl: string, baseUrl: string) => Promise<void>,
): Promise<void> {
  const local = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  const localBaseUrl = await local.start(0);
  const api = await createApiApp({
    guardianBindingOperations: local.guardianBindingOperations,
    getTrustedAuthResult: (request: ApiHttpRequest) => {
      const authorization = request.headers.authorization;
      return local.resolveTrustedAuth(
        typeof authorization === "string" ? authorization : undefined,
      );
    },
  });
  await api.listen(0, "127.0.0.1");
  const address = api.getHttpServer().address() as AddressInfo | null;
  if (!address) throw new Error("Local synthetic Nest API did not bind.");
  try {
    await run(localBaseUrl, `http://127.0.0.1:${address.port}`);
  } finally {
    await api.close();
    await local.close();
  }
}

async function localSession(localBaseUrl: string, profile: string): Promise<string> {
  const response = await fetch(new URL("/local/sessions", localBaseUrl), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ profile }),
  });
  const body = (await response.json()) as { readonly handle: string };
  assert.equal(response.status, 201);
  return body.handle;
}

async function localRequest(
  localBaseUrl: string,
  handle: string,
  method: "GET" | "POST",
  url: string,
  body?: object,
) {
  const response = await fetch(new URL(url, localBaseUrl), {
    method,
    headers: {
      authorization: `Bearer ${handle}`,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return {
    status: response.status,
    body: (await response.json()) as Record<string, unknown>,
  };
}

test("Nest synthetic guardian binding completes parent application, campus review, and parent read", async () => {
  await withApi(async (baseUrl) => {
    const submitted = await requestJson(baseUrl, "/guardian-binding/applications", {
      session: "parent-east",
      body: {
        student_candidate_ref: EAST_STUDENT_REF,
        relationship: "GUARDIAN",
        consent: true,
      },
    });
    assert.equal(submitted.status, 201);
    const application = dataOf(submitted);
    assert.equal(typeof application.submitted_at, "string");
    assert.equal(
      new Date(application.submitted_at as string).toISOString(),
      application.submitted_at,
    );
    assert.deepEqual(Object.keys(application).sort(), [
      "id",
      "relationship",
      "reviewed_at",
      "status",
      "student_candidate_ref",
      "submitted_at",
      "version",
    ]);
    assert.equal(application.status, "PENDING");
    assert.equal(application.version, 1);

    const staffQueue = await requestJson(baseUrl, "/staff/guardian-binding/applications", {
      session: "staff-east",
    });
    assert.equal(staffQueue.status, 200);
    assert.deepEqual(
      (dataOf(staffQueue) as unknown as Record<string, unknown>[]).map((row) => row.id),
      [application.id],
    );

    const unrelatedParent = await requestJson(baseUrl, "/guardian-binding/applications", {
      session: "parent-other",
    });
    assert.equal(unrelatedParent.status, 200);
    assert.deepEqual(dataOf(unrelatedParent), []);

    for (const session of ["staff-west", "staff-other-tenant"]) {
      const hidden = await requestJson(
        baseUrl,
        `/staff/guardian-binding/applications/${application.id as string}/review`,
        { session, body: { version: 1, action: "approve" } },
      );
      assert.equal(hidden.status, 404);
      assert.equal(errorCodeOf(hidden), "NOT_FOUND_SCOPED");
    }

    const approved = await requestJson(
      baseUrl,
      `/staff/guardian-binding/applications/${application.id as string}/review`,
      { session: "staff-east", body: { version: 1, action: "approve" } },
    );
    assert.equal(approved.status, 200);
    assert.equal(dataOf(approved).status, "APPROVED");
    assert.equal(dataOf(approved).version, 2);

    const parentRelationships = await requestJson(baseUrl, "/guardian-relationships", {
      session: "parent-east",
    });
    assert.equal(parentRelationships.status, 200);
    const relationships = dataOf(parentRelationships) as unknown as Record<string, unknown>[];
    assert.equal(relationships.length, 1);
    assert.deepEqual(Object.keys(relationships[0]!).sort(), [
      "approved_at",
      "id",
      "relationship",
      "source_application_id",
      "status",
      "student_id",
      "version",
    ]);
    assert.equal(relationships[0]?.student_id, EAST_STUDENT_REF);
    assert.equal(relationships[0]?.status, "ACTIVE");

    const otherRelationships = await requestJson(baseUrl, "/guardian-relationships", {
      session: "parent-other",
    });
    assert.equal(otherRelationships.status, 200);
    assert.deepEqual(dataOf(otherRelationships), []);
  });
});

test("Nest guardian relationship release is parent-owned, scoped, and versioned", async () => {
  await withLocalSessionApi(async (localBaseUrl, baseUrl) => {
    const parentHandle = await localSession(localBaseUrl, "parent-alpha");
    const otherParentHandle = await localSession(localBaseUrl, "parent-beta");
    const reviewerHandle = await localSession(localBaseUrl, "owner-east");
    const submitted = await requestJson(baseUrl, "/guardian-binding/applications", {
      authorization: `Bearer ${parentHandle}`,
      body: {
        student_candidate_ref: EAST_STUDENT_REF,
        relationship: "GUARDIAN",
        consent: true,
      },
    });
    assert.equal(submitted.status, 201, JSON.stringify(submitted.body));
    const application = dataOf(submitted);
    const approved = await localRequest(
      localBaseUrl,
      reviewerHandle,
      "POST",
      `/local/binding-applications/${application.id as string}/review`,
      { version: application.version, action: "approve" },
    );
    assert.equal(approved.status, 200, JSON.stringify(approved.body));

    const listed = await requestJson(baseUrl, "/guardian-relationships", {
      authorization: `Bearer ${parentHandle}`,
    });
    assert.equal(listed.status, 200, JSON.stringify(listed.body));
    const relationship = (dataOf(listed) as unknown as Record<string, unknown>[]).find(
      (row) => row.source_application_id === application.id,
    );
    assert.ok(relationship);
    assert.equal(relationship.status, "ACTIVE");

    const relationshipId = relationship.id as string;
    const releaseUrl = `/guardian-relationships/${relationshipId}/release`;
    const unavailableToAnotherParent = await requestJson(baseUrl, releaseUrl, {
      authorization: `Bearer ${otherParentHandle}`,
      body: { version: relationship.version },
    });
    assert.equal(unavailableToAnotherParent.status, 404);
    assert.equal(errorCodeOf(unavailableToAnotherParent), "NOT_FOUND_SCOPED");

    const unavailableToReviewer = await requestJson(baseUrl, releaseUrl, {
      authorization: `Bearer ${reviewerHandle}`,
      body: { version: relationship.version },
    });
    assert.equal(unavailableToReviewer.status, 403);
    assert.equal(errorCodeOf(unavailableToReviewer), "FORBIDDEN_SCOPE");

    const invalidBody = await requestJson(baseUrl, releaseUrl, {
      authorization: `Bearer ${parentHandle}`,
      body: { version: relationship.version, guardian_user_id: "forged" },
    });
    assert.equal(invalidBody.status, 400);
    assert.equal(errorCodeOf(invalidBody), "VALIDATION_FAILED");

    const released = await requestJson(baseUrl, releaseUrl, {
      authorization: `Bearer ${parentHandle}`,
      body: { version: relationship.version },
    });
    assert.equal(released.status, 200, JSON.stringify(released.body));
    assert.equal(dataOf(released).status, "RELEASED");
    assert.equal(dataOf(released).version, (relationship.version as number) + 1);

    const staleRetry = await requestJson(baseUrl, releaseUrl, {
      authorization: `Bearer ${parentHandle}`,
      body: { version: relationship.version },
    });
    assert.equal(staleRetry.status, 409);
    assert.equal(errorCodeOf(staleRetry), "VERSION_MISMATCH");

    const releasedList = await requestJson(baseUrl, "/guardian-relationships", {
      authorization: `Bearer ${parentHandle}`,
    });
    const persistedProjection = (dataOf(releasedList) as unknown as Record<string, unknown>[]).find(
      (row) => row.id === relationshipId,
    );
    assert.equal(persistedProjection?.status, "RELEASED");
    assert.equal(persistedProjection?.version, (relationship.version as number) + 1);

    const resubmitted = await requestJson(baseUrl, "/guardian-binding/applications", {
      authorization: `Bearer ${parentHandle}`,
      body: {
        student_candidate_ref: EAST_STUDENT_REF,
        relationship: "GUARDIAN",
        consent: true,
      },
    });
    assert.equal(resubmitted.status, 201, JSON.stringify(resubmitted.body));
    const nextApplication = dataOf(resubmitted);
    assert.notEqual(nextApplication.id, application.id);
    assert.equal(nextApplication.status, "PENDING");

    const reviewedAgain = await localRequest(
      localBaseUrl,
      reviewerHandle,
      "POST",
      `/local/binding-applications/${nextApplication.id as string}/review`,
      { version: nextApplication.version, action: "approve" },
    );
    assert.equal(reviewedAgain.status, 200, JSON.stringify(reviewedAgain.body));

    const finalApplications = await requestJson(baseUrl, "/guardian-binding/applications", {
      authorization: `Bearer ${parentHandle}`,
    });
    const applicationHistory = dataOf(finalApplications) as unknown as Record<string, unknown>[];
    assert.equal(applicationHistory.length, 2);
    assert.deepEqual(applicationHistory.map((row) => row.status).sort(), ["APPROVED", "APPROVED"]);

    const finalRelationships = await requestJson(baseUrl, "/guardian-relationships", {
      authorization: `Bearer ${parentHandle}`,
    });
    const relationshipHistory = dataOf(finalRelationships) as unknown as Record<string, unknown>[];
    assert.equal(relationshipHistory.length, 2);
    assert.deepEqual(relationshipHistory.map((row) => row.status).sort(), ["ACTIVE", "RELEASED"]);
    assert.equal(
      relationshipHistory.filter((row) => row.source_application_id === nextApplication.id).length,
      1,
    );
  });
});

test("Nest review shares legacy bindings and the approved relationship remains usable", async () => {
  await withLocalSessionApi(async (localBaseUrl, baseUrl) => {
    const parentHandle = await localSession(localBaseUrl, "parent-alpha");
    const ownerHandle = await localSession(localBaseUrl, "owner-east");
    const submitted = await localRequest(
      localBaseUrl,
      parentHandle,
      "POST",
      "/local/binding-applications",
      {
        student: "student-alpha",
        relationship: "GUARDIAN",
      },
    );
    assert.equal(submitted.status, 201, JSON.stringify(submitted.body));
    const legacyApplication = submitted.body as unknown as { id: string; version: number };

    const staffQueue = await requestJson(baseUrl, "/staff/guardian-binding/applications", {
      authorization: `Bearer ${ownerHandle}`,
    });
    assert.equal(staffQueue.status, 200);
    assert.deepEqual(
      (dataOf(staffQueue) as unknown as Record<string, unknown>[]).map((row) => row.id),
      [legacyApplication.id],
    );
    const queuedApplication = (dataOf(staffQueue) as unknown as Record<string, unknown>[])[0]!;
    assert.equal(typeof queuedApplication.submitted_at, "string");
    assert.equal(
      new Date(queuedApplication.submitted_at as string).toISOString(),
      queuedApplication.submitted_at,
    );

    const approved = await requestJson(
      baseUrl,
      `/staff/guardian-binding/applications/${legacyApplication.id}/review`,
      {
        authorization: `Bearer ${ownerHandle}`,
        body: { version: legacyApplication.version, action: "approve" },
      },
    );
    assert.equal(approved.status, 200);
    assert.equal(dataOf(approved).status, "APPROVED");
    assert.equal(typeof dataOf(approved).reviewed_at, "string");

    const legacyBindings = await localRequest(
      localBaseUrl,
      parentHandle,
      "GET",
      "/local/binding-applications",
    );
    const approvedBinding = (legacyBindings.body as unknown as Record<string, unknown>[]).find(
      (row) => row.id === legacyApplication.id,
    );
    assert.equal(approvedBinding?.status, "APPROVED");

    const leave = await localRequest(localBaseUrl, parentHandle, "POST", "/local/leave-requests", {
      bindingId: legacyApplication.id,
      startDate: "2026-10-20",
      endDate: "2026-10-20",
      reason: "FAMILY_ARRANGEMENT",
    });
    assert.equal(leave.status, 201, JSON.stringify(leave.body));
  });
});

test("legacy review shares Nest applications, relationship reads, and release state", async () => {
  await withLocalSessionApi(async (localBaseUrl, baseUrl) => {
    const parentHandle = await localSession(localBaseUrl, "parent-beta");
    const ownerHandle = await localSession(localBaseUrl, "owner-east");
    const submitted = await requestJson(baseUrl, "/guardian-binding/applications", {
      authorization: `Bearer ${parentHandle}`,
      body: {
        student_candidate_ref: "00000000-0000-4000-8000-0000000000c9",
        relationship: "GUARDIAN",
        consent: true,
      },
    });
    assert.equal(submitted.status, 201);
    const application = dataOf(submitted);

    const legacyParentApplications = await localRequest(
      localBaseUrl,
      parentHandle,
      "GET",
      "/local/binding-applications",
    );
    const legacyParentApplication = (
      legacyParentApplications.body as unknown as Record<string, unknown>[]
    ).find((row) => row.id === application.id);
    assert.equal(legacyParentApplication?.status, "PENDING");

    const legacyQueue = await localRequest(
      localBaseUrl,
      ownerHandle,
      "GET",
      "/local/binding-applications",
    );
    assert.deepEqual(
      (legacyQueue.body as unknown as Record<string, unknown>[]).map((row) => row.id),
      [application.id],
    );

    const approved = await localRequest(
      localBaseUrl,
      ownerHandle,
      "POST",
      `/local/binding-applications/${application.id as string}/review`,
      { version: application.version, action: "approve" },
    );
    assert.equal(approved.status, 200, JSON.stringify(approved.body));

    const nestApplications = await requestJson(baseUrl, "/guardian-binding/applications", {
      authorization: `Bearer ${parentHandle}`,
    });
    const projectedApplication = (
      dataOf(nestApplications) as unknown as Record<string, unknown>[]
    ).find((row) => row.id === application.id);
    assert.equal(projectedApplication?.status, "APPROVED");
    assert.equal(typeof projectedApplication?.reviewed_at, "string");

    const relationships = await requestJson(baseUrl, "/guardian-relationships", {
      authorization: `Bearer ${parentHandle}`,
    });
    const relationship = (dataOf(relationships) as unknown as Record<string, unknown>[]).find(
      (row) => row.source_application_id === application.id,
    );
    assert.equal(relationship?.status, "ACTIVE");
    assert.notEqual(relationship?.id, application.id);

    const released = await localRequest(
      localBaseUrl,
      parentHandle,
      "POST",
      `/local/binding-applications/${application.id as string}/release`,
      { version: 2 },
    );
    assert.equal(released.status, 200, JSON.stringify(released.body));
    const releasedRelationships = await requestJson(baseUrl, "/guardian-relationships", {
      authorization: `Bearer ${parentHandle}`,
    });
    const releasedRelationship = (
      dataOf(releasedRelationships) as unknown as Record<string, unknown>[]
    ).find((row) => row.source_application_id === application.id);
    assert.equal(releasedRelationship?.status, "RELEASED");

    const rejectedSubmission = await requestJson(baseUrl, "/guardian-binding/applications", {
      authorization: `Bearer ${parentHandle}`,
      body: {
        student_candidate_ref: EAST_STUDENT_REF,
        relationship: "GUARDIAN",
        consent: true,
      },
    });
    assert.equal(rejectedSubmission.status, 201, JSON.stringify(rejectedSubmission.body));
    const rejectedApplication = dataOf(rejectedSubmission);
    const rejected = await localRequest(
      localBaseUrl,
      ownerHandle,
      "POST",
      `/local/binding-applications/${rejectedApplication.id as string}/review`,
      { version: rejectedApplication.version, action: "reject" },
    );
    assert.equal(rejected.status, 200, JSON.stringify(rejected.body));
    const rejectedApplications = await requestJson(baseUrl, "/guardian-binding/applications", {
      authorization: `Bearer ${parentHandle}`,
    });
    assert.equal(
      (dataOf(rejectedApplications) as unknown as Record<string, unknown>[]).find(
        (row) => row.id === rejectedApplication.id,
      )?.status,
      "REJECTED",
    );
    const relationshipsAfterReject = await requestJson(baseUrl, "/guardian-relationships", {
      authorization: `Bearer ${parentHandle}`,
    });
    assert.equal(
      (dataOf(relationshipsAfterReject) as unknown as Record<string, unknown>[]).some(
        (row) => row.source_application_id === rejectedApplication.id,
      ),
      false,
    );

    const withdrawnSubmission = await requestJson(baseUrl, "/guardian-binding/applications", {
      authorization: `Bearer ${parentHandle}`,
      body: {
        student_candidate_ref: EAST_STUDENT_REF,
        relationship: "GUARDIAN",
        consent: true,
      },
    });
    assert.equal(withdrawnSubmission.status, 201, JSON.stringify(withdrawnSubmission.body));
    const withdrawnApplication = dataOf(withdrawnSubmission);
    const withdrawn = await localRequest(
      localBaseUrl,
      parentHandle,
      "POST",
      `/local/binding-applications/${withdrawnApplication.id as string}/withdraw`,
      { version: withdrawnApplication.version },
    );
    assert.equal(withdrawn.status, 200, JSON.stringify(withdrawn.body));
    const withdrawnApplications = await requestJson(baseUrl, "/guardian-binding/applications", {
      authorization: `Bearer ${parentHandle}`,
    });
    assert.equal(
      (dataOf(withdrawnApplications) as unknown as Record<string, unknown>[]).find(
        (row) => row.id === withdrawnApplication.id,
      )?.status,
      "WITHDRAWN",
    );
    const relationshipsAfterWithdraw = await requestJson(baseUrl, "/guardian-relationships", {
      authorization: `Bearer ${parentHandle}`,
    });
    assert.equal(
      (dataOf(relationshipsAfterWithdraw) as unknown as Record<string, unknown>[]).some(
        (row) => row.source_application_id === withdrawnApplication.id,
      ),
      false,
    );
  });
});

test("Nest synthetic guardian binding permits a new application after the earlier relationship is released", async () => {
  await withLocalSessionApi(async (localBaseUrl, baseUrl) => {
    const parentHandle = await localSession(localBaseUrl, "parent-alpha");
    const reviewerHandle = await localSession(localBaseUrl, "owner-east");
    const submit = () =>
      requestJson(baseUrl, "/guardian-binding/applications", {
        authorization: `Bearer ${parentHandle}`,
        body: {
          student_candidate_ref: EAST_STUDENT_REF,
          relationship: "GUARDIAN",
          consent: true,
        },
      });
    const review = (id: string, version: number) =>
      localRequest(
        localBaseUrl,
        reviewerHandle,
        "POST",
        `/local/binding-applications/${id}/review`,
        { version, action: "approve" },
      );

    const firstSubmission = await submit();
    assert.equal(firstSubmission.status, 201);
    const firstApplication = dataOf(firstSubmission);
    const firstApproval = await review(
      firstApplication.id as string,
      firstApplication.version as number,
    );
    assert.equal(firstApproval.status, 200);
    const firstRelationships = await requestJson(baseUrl, "/guardian-relationships", {
      authorization: `Bearer ${parentHandle}`,
    });
    const firstRelationship = (
      dataOf(firstRelationships) as unknown as Record<string, unknown>[]
    )[0];
    assert.ok(firstRelationship);

    const released = await requestJson(
      baseUrl,
      `/guardian-relationships/${firstRelationship.id as string}/release`,
      {
        authorization: `Bearer ${parentHandle}`,
        body: { version: firstRelationship.version },
      },
    );
    assert.equal(released.status, 200);
    assert.equal(dataOf(released).status, "RELEASED");

    const secondSubmission = await submit();
    assert.equal(
      secondSubmission.status,
      201,
      "releasing the earlier relationship must allow a fresh application",
    );
    const secondApplication = dataOf(secondSubmission);
    assert.notEqual(secondApplication.id, firstApplication.id);
    const secondApproval = await review(
      secondApplication.id as string,
      secondApplication.version as number,
    );
    assert.equal(secondApproval.status, 200);

    const history = await requestJson(baseUrl, "/guardian-relationships", {
      authorization: `Bearer ${parentHandle}`,
    });
    const relationships = dataOf(history) as unknown as Record<string, unknown>[];
    assert.equal(relationships.length, 2);
    assert.deepEqual(relationships.map((row) => row.status).sort(), ["ACTIVE", "RELEASED"]);
    assert.equal(
      relationships.find((row) => row.status === "ACTIVE")?.source_application_id,
      secondApplication.id,
    );
  });
});

test("local synthetic sessions combine existing identity access with scoped guardian-binding capabilities", () => {
  const sessions = new LocalSessions();
  const parentSession = sessions.create("parent-alpha");
  const reviewerSession = sessions.create("owner-east");
  const unrelatedSession = sessions.create("teacher-east");

  assert.ok(parentSession);
  assert.ok(reviewerSession);
  assert.ok(unrelatedSession);
  const parentAuth = sessions.resolve(`Bearer ${parentSession.handle}`);
  const reviewerAuth = sessions.resolve(`Bearer ${reviewerSession.handle}`);
  const unrelatedAuth = sessions.resolve(`Bearer ${unrelatedSession.handle}`);
  assert.ok(parentAuth);
  assert.ok(reviewerAuth);
  assert.ok(unrelatedAuth);

  assert.deepEqual([...parentAuth.memberships[0]!.capabilities].sort(), [
    "binding:apply",
    "binding:read",
    "identity:read",
  ]);
  assert.deepEqual([...reviewerAuth.memberships[0]!.capabilities].sort(), [
    "binding:read",
    "binding:review",
    "identity:read",
    "memberships:read",
  ]);
  assert.deepEqual(unrelatedAuth.memberships[0]?.capabilities, ["identity:read"]);
});

test("real local synthetic sessions complete the Nest guardian-binding flow in the same campus", async () => {
  const local = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  const parent = await local.inject({
    method: "POST",
    url: "/local/sessions",
    headers: { host: "127.0.0.1:4317" },
    payload: { profile: "parent-alpha" },
  });
  const reviewer = await local.inject({
    method: "POST",
    url: "/local/sessions",
    headers: { host: "127.0.0.1:4317" },
    payload: { profile: "owner-east" },
  });
  assert.equal(parent.statusCode, 201, parent.body);
  assert.equal(reviewer.statusCode, 201, reviewer.body);
  const parentHandle = parent.json<{ handle: string }>().handle;
  const reviewerHandle = reviewer.json<{ handle: string }>().handle;
  const api = await createApiApp({
    getTrustedAuthResult: (request: ApiHttpRequest) => {
      const authorization = request.headers.authorization;
      return local.resolveTrustedAuth(
        typeof authorization === "string" ? authorization : undefined,
      );
    },
  });
  await api.listen(0, "127.0.0.1");
  const address = api.getHttpServer().address() as AddressInfo | null;
  if (!address) throw new Error("Local Nest test server did not bind.");

  const request = async (path: string, handle: string, method: "GET" | "POST", body?: unknown) => {
    const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${handle}`,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
  };

  try {
    const submitted = await request("/guardian-binding/applications", parentHandle, "POST", {
      student_candidate_ref: EAST_STUDENT_REF,
      relationship: "GUARDIAN",
      consent: true,
    });
    assert.equal(submitted.status, 201);
    const application = (submitted.body.data ?? {}) as Record<string, unknown>;

    const queue = await request("/staff/guardian-binding/applications", reviewerHandle, "GET");
    assert.equal(queue.status, 200);
    const pending = (queue.body.data as Record<string, unknown>[])[0]!;
    assert.equal((queue.body.data as Record<string, unknown>[]).length, 1);
    assert.equal(pending.applicant_label, "示例监护人甲");
    assert.equal(pending.student_label, "示例学生甲");
    assert.deepEqual(Object.keys(pending).sort(), [
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
      JSON.stringify(pending),
      /student_candidate_ref|actor_id|tenant_id|campus_id/u,
    );

    const approved = await request(
      `/staff/guardian-binding/applications/${application.id as string}/review`,
      reviewerHandle,
      "POST",
      { version: 1, action: "approve" },
    );
    assert.equal(approved.status, 200);

    const relationships = await request("/guardian-relationships", parentHandle, "GET");
    assert.equal(relationships.status, 200);
    assert.equal((relationships.body.data as Record<string, unknown>[]).length, 1);
  } finally {
    await api.close();
    await local.close();
  }
});

test("Nest synthetic guardian binding rejects duplicates, stale reviews, and unapproved relationships", async () => {
  await withApi(async (baseUrl) => {
    const input = {
      student_candidate_ref: EAST_STUDENT_REF,
      relationship: "GUARDIAN",
      consent: true,
    };
    const first = await requestJson(baseUrl, "/guardian-binding/applications", {
      session: "parent-east",
      body: input,
    });
    assert.equal(first.status, 201);
    const applicationId = dataOf(first).id as string;

    const duplicate = await requestJson(baseUrl, "/guardian-binding/applications", {
      session: "parent-east",
      body: input,
    });
    assert.equal(duplicate.status, 409);
    assert.equal(errorCodeOf(duplicate), "CONFLICT_STATE");

    const rejected = await requestJson(
      baseUrl,
      `/staff/guardian-binding/applications/${applicationId}/review`,
      { session: "staff-east", body: { version: 1, action: "reject" } },
    );
    assert.equal(rejected.status, 200);
    assert.equal(dataOf(rejected).status, "REJECTED");

    const staleReview = await requestJson(
      baseUrl,
      `/staff/guardian-binding/applications/${applicationId}/review`,
      { session: "staff-east", body: { version: 1, action: "approve" } },
    );
    assert.equal(staleReview.status, 409);
    assert.equal(errorCodeOf(staleReview), "VERSION_MISMATCH");

    const relationships = await requestJson(baseUrl, "/guardian-relationships", {
      session: "parent-east",
    });
    assert.equal(relationships.status, 200);
    assert.deepEqual(dataOf(relationships), []);
  });
});

test("Nest synthetic guardian binding rejects untrusted scope, identity, capability, and input fields", async () => {
  await withApi(async (baseUrl) => {
    const unauthenticated = await requestJson(baseUrl, "/guardian-binding/applications");
    assert.equal(unauthenticated.status, 401);
    assert.equal(errorCodeOf(unauthenticated), "UNAUTHENTICATED");

    const noReviewCapability = await requestJson(baseUrl, "/staff/guardian-binding/applications", {
      session: "staff-no-review",
    });
    assert.equal(noReviewCapability.status, 403);
    assert.equal(errorCodeOf(noReviewCapability), "FORBIDDEN_SCOPE");

    const injectedCampus = await requestJson(
      baseUrl,
      "/guardian-binding/applications?campus_id=00000000-0000-4000-8000-000000000004",
      { session: "parent-east" },
    );
    assert.equal(injectedCampus.status, 400);
    assert.equal(errorCodeOf(injectedCampus), "VALIDATION_FAILED");

    const forgedIdentity = await requestJson(baseUrl, "/guardian-binding/applications", {
      session: "parent-east",
      headers: { "x-actor-id": "00000000-0000-4000-8000-000000000999" },
    });
    assert.equal(forgedIdentity.status, 401);
    assert.equal(errorCodeOf(forgedIdentity), "UNAUTHENTICATED");

    const forgedScopeHeader = await requestJson(baseUrl, "/guardian-binding/applications", {
      session: "parent-east",
      headers: { "x-campus-id": WEST_CAMPUS_ID },
    });
    assert.equal(forgedScopeHeader.status, 400);
    assert.equal(errorCodeOf(forgedScopeHeader), "VALIDATION_FAILED");

    const extraBodyField = await requestJson(baseUrl, "/guardian-binding/applications", {
      session: "parent-east",
      body: {
        student_candidate_ref: EAST_STUDENT_REF,
        relationship: "GUARDIAN",
        consent: true,
        tenant_id: TENANT_ID,
      },
    });
    assert.equal(extraBodyField.status, 400);
    assert.equal(errorCodeOf(extraBodyField), "VALIDATION_FAILED");

    const unknownCandidate = await requestJson(baseUrl, "/guardian-binding/applications", {
      session: "parent-east",
      body: {
        student_candidate_ref: "00000000-0000-4000-8000-000000000099",
        relationship: "GUARDIAN",
        consent: true,
      },
    });
    assert.equal(unknownCandidate.status, 404);
    assert.equal(errorCodeOf(unknownCandidate), "NOT_FOUND_SCOPED");
  });
});
