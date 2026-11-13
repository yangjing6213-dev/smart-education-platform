import test from "node:test";
import assert from "node:assert/strict";
import type { TrustedAuthResult } from "@student-care/auth";
import type { ApiHttpRequest } from "../src/nest/api-tokens.js";
import { createApiApp } from "../src/nest/api-app.js";
import { buildLocalSyntheticServer } from "../src/local-synthetic/server.js";

const values = {
  arrival: "ARRIVED_AS_PLANNED",
  homework: "COMPLETED",
  activity: "PARTICIPATED",
  classroom: "ROUTINE",
  followUp: "NONE",
};

test("trusted invited staff can create and submit only safely projected synthetic daily reports", async (t) => {
  const local = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  const sessionResponse = await local.inject({
    method: "POST",
    url: "/local/sessions",
    payload: { profile: "teacher-east" },
  });
  assert.equal(sessionResponse.statusCode, 201);
  const { handle } = sessionResponse.json<{ readonly handle: string }>();

  const options = {
    staffDailyOperations: (local as unknown as { readonly staffDailyOperations?: unknown })
      .staffDailyOperations,
    getTrustedAuthResult: (request: ApiHttpRequest) => {
      const authorization = request.headers.authorization;
      const trusted = local.resolveTrustedAuth(
        typeof authorization === "string" ? authorization : undefined,
      );
      if (!trusted) return undefined;
      return {
        ...trusted,
        memberships: trusted.memberships.map((membership) => ({
          ...membership,
          capabilities: [
            ...membership.capabilities,
            "daily:read",
            "daily:create",
            "daily:submit",
            ...(membership.capabilities.includes("binding:review") ? ["daily:review"] : []),
          ],
        })),
      } as TrustedAuthResult;
    },
  } as Parameters<typeof createApiApp>[0];
  const app = await createApiApp(options);
  await app.listen(0, "127.0.0.1");
  t.after(async () => {
    await app.close();
    await local.close();
  });
  const baseUrl = await app.getUrl();
  const authorization = { authorization: `Bearer ${handle}` };

  const unauthenticated = await fetch(`${baseUrl}/staff/daily-reports`);
  assert.equal(unauthenticated.status, 401);

  const forbiddenScope = await fetch(`${baseUrl}/staff/daily-reports`, {
    headers: { ...authorization, "x-campus-id": "client-selected-campus" },
  });
  assert.equal(forbiddenScope.status, 400);

  const createdResponse = await fetch(`${baseUrl}/staff/daily-reports`, {
    method: "POST",
    headers: { ...authorization, "content-type": "application/json" },
    body: JSON.stringify({ date: "2026-10-19", values }),
  });
  assert.equal(createdResponse.status, 201);
  const createdBody = (await createdResponse.json()) as { data: Record<string, unknown> };
  const created = createdBody.data;
  assert.equal(created.status, "DRAFT");
  assert.equal(created.date, "2026-10-19");
  assert.deepEqual(created.values, values);
  assert.deepEqual(created.actions, ["edit", "submit"]);
  assert.equal("tenantId" in created, false);
  assert.equal("campusId" in created, false);
  assert.equal("classId" in created, false);
  assert.equal("studentId" in created, false);
  assert.equal("createdBy" in created, false);
  assert.equal("sourceRefs" in created, false);

  const id = created.id;
  assert.equal(typeof id, "string");
  const editedValues = { ...values, homework: "IN_PROGRESS" };
  const editedResponse = await fetch(`${baseUrl}/staff/daily-reports/${id as string}`, {
    method: "PATCH",
    headers: { ...authorization, "content-type": "application/json" },
    body: JSON.stringify({ version: 1, values: editedValues }),
  });
  assert.equal(editedResponse.status, 200);
  const editedBody = (await editedResponse.json()) as { data: Record<string, unknown> };
  assert.equal(editedBody.data.version, 2);
  assert.deepEqual(editedBody.data.values, editedValues);

  const submittedResponse = await fetch(`${baseUrl}/staff/daily-reports/${id as string}/submit`, {
    method: "POST",
    headers: { ...authorization, "content-type": "application/json" },
    body: JSON.stringify({ version: 2 }),
  });
  assert.equal(submittedResponse.status, 200);
  const submittedBody = (await submittedResponse.json()) as { data: Record<string, unknown> };
  assert.equal(submittedBody.data.status, "SUBMITTED");
  assert.equal(submittedBody.data.version, 3);
  assert.deepEqual(submittedBody.data.actions, []);

  const ownerSessionResponse = await local.inject({
    method: "POST",
    url: "/local/sessions",
    payload: { profile: "owner-east" },
  });
  assert.equal(ownerSessionResponse.statusCode, 201);
  const { handle: ownerHandle } = ownerSessionResponse.json<{ readonly handle: string }>();
  const ownerAuthorization = { authorization: `Bearer ${ownerHandle}` };
  const queueResponse = await fetch(`${baseUrl}/admin/daily-reports`, {
    headers: ownerAuthorization,
  });
  assert.equal(queueResponse.status, 200);
  const queue = (await queueResponse.json()) as { data: { records: Record<string, unknown>[] } };
  assert.deepEqual(queue.data.records[0]?.actions, ["confirm", "return"]);
  assert.equal(queue.data.records[0]?.authorLabel, "示例东校区教师");
  assert.doesNotMatch(
    JSON.stringify(queue),
    /tenantId|campusId|classId|studentId|createdBy|sourceRefs/,
  );
  assert.equal(
    (await fetch(`${baseUrl}/admin/daily-reports`, { headers: authorization })).status,
    403,
  );
  const returnedResponse = await fetch(`${baseUrl}/admin/daily-reports/${id as string}/review`, {
    method: "POST",
    headers: { ...ownerAuthorization, "content-type": "application/json" },
    body: JSON.stringify({ version: 3, action: "RETURN" }),
  });
  assert.equal(returnedResponse.status, 200);

  const resubmittedResponse = await fetch(
    `${baseUrl}/staff/daily-reports/${id as string}/resubmit`,
    {
      method: "POST",
      headers: { ...authorization, "content-type": "application/json" },
      body: JSON.stringify({ version: 4, values: editedValues }),
    },
  );
  assert.equal(resubmittedResponse.status, 200);
  const resubmittedBody = (await resubmittedResponse.json()) as {
    data: Record<string, unknown>;
  };
  assert.equal(resubmittedBody.data.status, "SUBMITTED");
  assert.equal(resubmittedBody.data.version, 5);

  const listResponse = await fetch(`${baseUrl}/staff/daily-reports`, { headers: authorization });
  assert.equal(listResponse.status, 200);
  const listBody = (await listResponse.json()) as {
    data: { readonly records: readonly Record<string, unknown>[]; readonly canCreate: boolean };
  };
  assert.equal(listBody.data.canCreate, true);
  assert.equal(listBody.data.records.length, 1);
  assert.equal(listBody.data.records[0]?.id, id);
  assert.equal(listBody.data.records[0]?.status, "SUBMITTED");
  assert.doesNotMatch(JSON.stringify(listBody), /tenantId|campusId|classId|studentId|sourceRefs/);

  const review = (suffix: string, body: unknown) =>
    fetch(`${baseUrl}/admin/daily-reports/${id as string}/${suffix}`, {
      method: "POST",
      headers: { ...ownerAuthorization, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  assert.equal((await review("review", { version: 5, action: "CONFIRM" })).status, 200);
  assert.equal((await review("review", { version: 5, action: "RETURN" })).status, 409);
  assert.equal((await review("withdraw", { version: 6 })).status, 200);
  assert.equal((await review("review", { version: 7, action: "CONFIRM" })).status, 409);

  const auditResponse = await fetch(`${baseUrl}/admin/daily-reports/${id as string}/audit-events`, {
    headers: ownerAuthorization,
  });
  assert.equal(auditResponse.status, 200);
  const auditBody = (await auditResponse.json()) as {
    data: { events: readonly { action: string; reportVersion: number }[] };
  };
  assert.deepEqual(
    auditBody.data.events.map(({ action, reportVersion }) => [action, reportVersion]),
    [
      ["CREATED", 1],
      ["EDITED", 2],
      ["SUBMITTED", 3],
      ["REVIEW_RETURNED", 4],
      ["RESUBMITTED", 5],
      ["REVIEW_CONFIRMED", 6],
      ["CONFIRMATION_WITHDRAWN", 7],
    ],
  );
  assert.doesNotMatch(JSON.stringify(auditBody), /tenantId|campusId|studentId|sourceRefs/);
  assert.equal(
    (
      await fetch(`${baseUrl}/admin/daily-reports/${id as string}/audit-events`, {
        headers: authorization,
      })
    ).status,
    403,
    "ordinary staff cannot read the review audit timeline",
  );

  const privateDraft = await fetch(`${baseUrl}/staff/daily-reports`, {
    method: "POST",
    headers: { ...authorization, "content-type": "application/json" },
    body: JSON.stringify({ date: "2026-10-20", values }),
  });
  assert.equal(privateDraft.status, 201);
  const ownerStaffList = await fetch(`${baseUrl}/staff/daily-reports`, {
    headers: ownerAuthorization,
  });
  assert.equal(ownerStaffList.status, 200);
  assert.deepEqual(
    ((await ownerStaffList.json()) as { data: { records: unknown[] } }).data.records,
    [],
    "read plus review must not expose other authors through the ordinary staff endpoint",
  );
  const ownerReviewList = await fetch(`${baseUrl}/admin/daily-reports`, {
    headers: ownerAuthorization,
  });
  const visible = (
    (await ownerReviewList.json()) as { data: { records: { id: string; status: string }[] } }
  ).data.records;
  assert.deepEqual(
    visible.map((row) => row.status),
    ["RETURNED"],
    "review list never exposes another author's draft",
  );
});
