import test from "node:test";
import assert from "node:assert/strict";
import type { TrustedAuthResult } from "@student-care/auth";
import { createApiApp } from "../src/nest/api-app.js";
import type { ApiHttpRequest } from "../src/nest/api-tokens.js";
import { buildLocalSyntheticServer } from "../src/local-synthetic/server.js";

const values = {
  arrival: "ARRIVED_AS_PLANNED",
  homework: "COMPLETED",
  meal: "FINISHED",
  rest: "RESTED",
  activity: "PARTICIPATED",
  wellbeing: "ROUTINE",
};

test("local synthetic Nest care adapter supports author withdrawal and publication revocation", async (t) => {
  const local = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  const writerSession = await local.inject({
    method: "POST",
    url: "/local/sessions",
    payload: { profile: "teacher-east" },
  });
  const publisherSession = await local.inject({
    method: "POST",
    url: "/local/sessions",
    payload: { profile: "owner-east" },
  });
  assert.equal(writerSession.statusCode, 201);
  assert.equal(publisherSession.statusCode, 201);
  const writerToken = writerSession.json<{ readonly handle: string }>().handle;
  const publisherToken = publisherSession.json<{ readonly handle: string }>().handle;

  const app = await createApiApp({
    careRecordOperations: local.careRecordOperations,
    getTrustedAuthResult: (request: ApiHttpRequest) => {
      const authorization = request.headers.authorization;
      const trusted = local.resolveTrustedAuth(
        typeof request.headers.authorization === "string"
          ? request.headers.authorization
          : undefined,
      );
      if (!trusted) return undefined;
      const careCapabilities =
        authorization === `Bearer ${writerToken}`
          ? ["care:write"]
          : authorization === `Bearer ${publisherToken}`
            ? ["care:review", "care:publish"]
            : [];
      return {
        ...trusted,
        memberships: trusted.memberships.map((membership) => ({
          ...membership,
          capabilities: [...membership.capabilities, ...careCapabilities],
        })),
      } as TrustedAuthResult;
    },
  });
  await app.listen(0, "127.0.0.1");
  t.after(async () => {
    await app.close();
    await local.close();
  });
  const baseUrl = await app.getUrl();
  const post = async (token: string, path: string, body: unknown) =>
    fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });

  const studentsResponse = await fetch(`${baseUrl}/staff/care-record-students`, {
    headers: { authorization: `Bearer ${writerToken}` },
  });
  assert.equal(studentsResponse.status, 200);
  const students = (await studentsResponse.json()) as {
    readonly data: readonly { readonly id: string }[];
  };
  const studentId = students.data[0]?.id;
  assert.ok(studentId);

  const withdrawnDraft = await post(writerToken, "/staff/care-records", {
    student_id: studentId,
    service_date: "2026-10-22",
    values,
  });
  assert.equal(withdrawnDraft.status, 201);
  const draft = (await withdrawnDraft.json()) as { readonly data: { readonly id: string } };
  const draftId = draft.data.id;
  const submitted = await post(writerToken, `/staff/care-records/${draftId}/submit`, {
    version: 1,
  });
  assert.equal(submitted.status, 200);
  const withdrawn = await post(writerToken, `/staff/care-records/${draftId}/withdraw`, {
    version: 2,
  });
  assert.equal(withdrawn.status, 200);
  const withdrawnData = (await withdrawn.json()) as {
    readonly data: {
      readonly status: string;
      readonly version: number;
      readonly actions: unknown[];
    };
  };
  assert.equal(withdrawnData.data.status, "CANCELLED");
  assert.equal(withdrawnData.data.version, 3);
  assert.deepEqual(withdrawnData.data.actions, []);

  const draftForPublication = await post(writerToken, "/staff/care-records", {
    student_id: studentId,
    service_date: "2026-10-23",
    values,
  });
  assert.equal(draftForPublication.status, 201);
  const publicationDraft = (await draftForPublication.json()) as {
    readonly data: { readonly id: string };
  };
  const publicationId = publicationDraft.data.id;
  assert.equal(
    (await post(writerToken, `/staff/care-records/${publicationId}/submit`, { version: 1 })).status,
    200,
  );
  const confirmed = await post(publisherToken, `/staff/care-records/${publicationId}/review`, {
    version: 2,
    action: "confirm",
  });
  assert.equal(confirmed.status, 200);
  const published = await post(publisherToken, `/staff/care-records/${publicationId}/publish`, {
    version: 3,
  });
  assert.equal(published.status, 200);
  const publishedData = (await published.json()) as {
    readonly data: {
      readonly published: boolean;
      readonly publication_version: number;
      readonly actions: unknown[];
    };
  };
  assert.equal(publishedData.data.published, true);
  assert.equal(publishedData.data.publication_version, 1);
  assert.deepEqual(publishedData.data.actions, ["revoke-publication"]);

  const revoked = await post(
    publisherToken,
    `/staff/care-records/${publicationId}/revoke-publication`,
    { version: 4 },
  );
  assert.equal(revoked.status, 200);
  const revokedData = (await revoked.json()) as {
    readonly data: {
      readonly status: string;
      readonly version: number;
      readonly published: boolean;
      readonly publication_version: number;
      readonly actions: unknown[];
    };
  };
  assert.equal(revokedData.data.status, "CONFIRMED");
  assert.equal(revokedData.data.version, 5);
  assert.equal(revokedData.data.published, false);
  assert.equal(revokedData.data.publication_version, 1);
  assert.deepEqual(revokedData.data.actions, ["publish"]);
});
