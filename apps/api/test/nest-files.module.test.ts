import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import type { AddressInfo } from "node:net";
import test from "node:test";
import type { TrustedAuthResult } from "@student-care/auth";
import { FileService } from "../src/modules/files/file.service.js";
import { createApiApp } from "../src/nest/api-app.js";
import { buildServer } from "../src/server.js";

const ACTOR_ID = "00000000-0000-4000-8000-000000000003";
const TENANT_ID = "00000000-0000-4000-8000-000000000001";
const CAMPUS_ID = "00000000-0000-4000-8000-000000000002";
const OTHER_TENANT_ID = "00000000-0000-4000-8000-000000000004";
const OTHER_CAMPUS_ID = "00000000-0000-4000-8000-000000000005";
const imageBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01]);

function checksum(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function trustedAuthResult(
  tenantId = TENANT_ID,
  campusIds: string[] = [CAMPUS_ID],
): TrustedAuthResult {
  return {
    trusted: true,
    session: {
      trusted: true,
      status: "ACTIVE",
      actor_id: ACTOR_ID,
      expires_at: "2099-01-01T00:00:00.000Z",
    },
    identity: { actor_id: ACTOR_ID, display_name: "模拟员工一号" },
    memberships: [
      {
        tenant_id: tenantId,
        campus_ids: campusIds,
        status: "ACTIVE",
        capabilities: ["content:write"],
      },
    ],
  };
}

async function requestJson(
  base: string,
  path: string,
  method: "GET" | "POST",
  body?: unknown,
) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      connection: "close",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

function errorCode(body: Record<string, unknown>): string | undefined {
  const error = body.error as Record<string, unknown> | undefined;
  return typeof error?.code === "string" ? error.code : undefined;
}

test("Nest file lifecycle matches Fastify with in-memory synthetic files and scoped links", async () => {
  let auth: TrustedAuthResult | undefined = trustedAuthResult();
  let now = new Date("2026-10-16T00:00:00.000Z");
  const getTrustedAuthResult = () => auth;
  const nestService = new FileService(undefined, { now: () => now });
  const fastifyService = new FileService(undefined, { now: () => now });
  const options = { getTrustedAuthResult, fileService: nestService };
  const nest = await createApiApp(options);
  const fastify = buildServer({ getTrustedAuthResult, fileService: fastifyService });

  try {
    await nest.listen(0, "127.0.0.1");
    await fastify.listen({ port: 0, host: "127.0.0.1" });
    const nestAddress = nest.getHttpServer().address() as AddressInfo;
    const fastifyAddress = fastify.server.address() as AddressInfo;
    assert.equal(nestAddress.address, "127.0.0.1");
    assert.equal(fastifyAddress.address, "127.0.0.1");
    const nestBase = `http://127.0.0.1:${nestAddress.port}`;
    const fastifyBase = `http://127.0.0.1:${fastifyAddress.port}`;
    const input = {
      declared_purpose: "ACTIVITY_MEDIA",
      mime_type: "image/png",
      size_bytes: imageBytes.byteLength,
      checksum: checksum(imageBytes),
    };

    const [nestCreated, fastifyCreated] = await Promise.all([
      requestJson(nestBase, "/files/intents", "POST", input),
      requestJson(fastifyBase, "/files/intents", "POST", input),
    ]);
    assert.equal(fastifyCreated.status, 201);
    assert.equal(nestCreated.status, fastifyCreated.status, JSON.stringify(nestCreated.body));
    const runLifecycle = async (base: string, created: Record<string, unknown>) => {
      const createdData = created.data as {
        file: { id: string; tenant_id: string; campus_id: string; synthetic_data: boolean };
        intent: { token: string };
      };
      assert.equal(createdData.file.tenant_id, TENANT_ID);
      assert.equal(createdData.file.campus_id, CAMPUS_ID);
      assert.equal(createdData.file.synthetic_data, true);
      assert.deepEqual(Object.keys(createdData.file).sort(), [
        "campus_id",
        "checksum",
        "created_at",
        "declared_purpose",
        "id",
        "mime_type",
        "scan_state",
        "size_bytes",
        "synthetic_data",
        "tenant_id",
        "updated_at",
      ]);
      const fileId = createdData.file.id;
      const uploadToken = createdData.intent.token;
      const complete = await requestJson(base, `/files/${fileId}/complete`, "POST", {
        upload_intent: uploadToken,
        bytes_base64: Buffer.from(imageBytes).toString("base64"),
      });
      assert.equal(complete.status, 200, JSON.stringify(complete.body));
      assert.equal(
        ((complete.body.data as Record<string, unknown>).scan_state as string),
        "APPROVED",
      );
      const readLink = await requestJson(base, `/files/${fileId}/read-link`, "POST");
      assert.equal(readLink.status, 200, JSON.stringify(readLink.body));
      const link = (readLink.body.data as { read_link: string }).read_link;
      const read = await requestJson(
        base,
        `/files/${fileId}/read?read_token=${encodeURIComponent(link)}`,
        "GET",
      );
      assert.equal(read.status, 200, JSON.stringify(read.body));
      const readData = read.body.data as { bytes_base64: string; checksum: string; mime_type: string };
      assert.deepEqual(Object.keys(readData).sort(), [
        "bytes_base64",
        "checksum",
        "file_id",
        "mime_type",
      ]);
      assert.equal(readData.bytes_base64, Buffer.from(imageBytes).toString("base64"));
      assert.equal(readData.checksum, checksum(imageBytes));
      assert.equal(readData.mime_type, "image/png");
      const reused = await requestJson(base, `/files/${fileId}/complete`, "POST", {
        upload_intent: uploadToken,
        bytes_base64: Buffer.from(imageBytes).toString("base64"),
      });
      assert.equal(reused.status, 409);
      return { fileId, link };
    };

    const nestFlow = await runLifecycle(nestBase, nestCreated.body);
    const fastifyFlow = await runLifecycle(fastifyBase, fastifyCreated.body);

    const validScopeQuery = await requestJson(
      nestBase,
      `/files/intents?tenant_id=${TENANT_ID}&campus_id=${CAMPUS_ID}`,
      "POST",
      input,
    );
    assert.equal(validScopeQuery.status, 400);
    assert.equal(errorCode(validScopeQuery.body), "VALIDATION_FAILED");
    const validScopeFastify = await requestJson(
      fastifyBase,
      `/files/intents?tenant_id=${TENANT_ID}&campus_id=${CAMPUS_ID}`,
      "POST",
      input,
    );
    assert.equal(validScopeFastify.status, validScopeQuery.status);
    const outsideUrl = `/files/intents?tenant_id=${OTHER_TENANT_ID}&campus_id=${OTHER_CAMPUS_ID}`;
    const [outsideScope, outsideScopeFastify] = await Promise.all([
      requestJson(nestBase, outsideUrl, "POST", input),
      requestJson(fastifyBase, outsideUrl, "POST", input),
    ]);
    assert.equal(outsideScope.status, 403);
    assert.equal(outsideScopeFastify.status, outsideScope.status);
    assert.equal(errorCode(outsideScopeFastify.body), errorCode(outsideScope.body));

    const forgedIdentity = await requestJson(
      nestBase,
      `/files/intents?actor_id=${ACTOR_ID}`,
      "POST",
      input,
    );
    assert.equal(forgedIdentity.status, 401);
    assert.equal(errorCode(forgedIdentity.body), "UNAUTHENTICATED");
    const extraProviderField = await requestJson(nestBase, "/files/intents", "POST", {
      ...input,
      provider_url: "synthetic-invalid-provider",
    });
    assert.equal(extraProviderField.status, 400);
    assert.equal(errorCode(extraProviderField.body), "VALIDATION_FAILED");
    for (const [invalidInput, expectedCode] of [
      [{ ...input, mime_type: "application/pdf" }, "MIME_NOT_ALLOWED"],
      [{ ...input, size_bytes: 10 * 1024 * 1024 + 1 }, "SIZE_NOT_ALLOWED"],
    ] as const) {
      const [nestInvalid, fastifyInvalid] = await Promise.all([
        requestJson(nestBase, "/files/intents", "POST", invalidInput),
        requestJson(fastifyBase, "/files/intents", "POST", invalidInput),
      ]);
      assert.equal(nestInvalid.status, 400);
      assert.equal(fastifyInvalid.status, nestInvalid.status);
      assert.equal(errorCode(nestInvalid.body), expectedCode);
      assert.equal(errorCode(fastifyInvalid.body), expectedCode);
    }

    const malformedBase64 = await requestJson(
      nestBase,
      `/files/${nestFlow.fileId}/complete`,
      "POST",
      { upload_intent: "synthetic-invalid", bytes_base64: "%%%=" },
    );
    assert.equal(malformedBase64.status, 400);
    const unsignedRead = await requestJson(nestBase, `/files/${nestFlow.fileId}/read`, "GET");
    assert.equal(unsignedRead.status, 403);
    assert.equal(errorCode(unsignedRead.body), "UNSIGNED_ACCESS");

    auth = trustedAuthResult(OTHER_TENANT_ID, [OTHER_CAMPUS_ID]);
    const crossScopeNest = await requestJson(
      nestBase,
      `/files/${nestFlow.fileId}/read?read_token=${encodeURIComponent(nestFlow.link)}`,
      "GET",
    );
    const crossScopeFastify = await requestJson(
      fastifyBase,
      `/files/${fastifyFlow.fileId}/read?read_token=${encodeURIComponent(fastifyFlow.link)}`,
      "GET",
    );
    assert.equal(crossScopeNest.status, 403, JSON.stringify(crossScopeNest.body));
    assert.equal(crossScopeFastify.status, crossScopeNest.status);
    assert.equal(errorCode(crossScopeFastify.body), errorCode(crossScopeNest.body));

    auth = trustedAuthResult();
    const create = async (base: string, overrides: Record<string, unknown> = {}) => {
      const response = await requestJson(base, "/files/intents", "POST", {
        declared_purpose: "ACTIVITY_MEDIA",
        mime_type: "image/png",
        size_bytes: imageBytes.byteLength,
        checksum: checksum(imageBytes),
        ...overrides,
      });
      assert.equal(response.status, 201, JSON.stringify(response.body));
      return (response.body.data as { file: { id: string }; intent: { token: string } });
    };
    const wrongChecksum = new Uint8Array(imageBytes);
    wrongChecksum[8] = (wrongChecksum[8] ?? 0) ^ 1;
    for (const [mimeType, bytes] of [
      ["image/png", wrongChecksum],
      ["image/jpeg", imageBytes],
    ] as const) {
      const [nestRecord, fastifyRecord] = await Promise.all([
        create(nestBase, { mime_type: mimeType }),
        create(fastifyBase, { mime_type: mimeType }),
      ]);
      const complete = (base: string, record: { file: { id: string }; intent: { token: string } }) =>
        requestJson(base, `/files/${record.file.id}/complete`, "POST", {
          upload_intent: record.intent.token,
          bytes_base64: Buffer.from(bytes).toString("base64"),
        });
      const [nestFailure, fastifyFailure] = await Promise.all([
        complete(nestBase, nestRecord),
        complete(fastifyBase, fastifyRecord),
      ]);
      assert.equal(nestFailure.status, fastifyFailure.status);
      assert.equal(nestFailure.status, 400);
      assert.equal(errorCode(nestFailure.body), errorCode(fastifyFailure.body));
      assert.equal(errorCode(nestFailure.body), mimeType === "image/png" ? "CHECKSUM_MISMATCH" : "MIME_MISMATCH");
    }

    const expiringUploadNest = await create(nestBase);
    const expiringUploadFastify = await create(fastifyBase);
    const expiringReadNest = await create(nestBase);
    const expiringReadFastify = await create(fastifyBase);
    const prepareReadLink = async (
      base: string,
      record: { file: { id: string }; intent: { token: string } },
    ) => {
      const complete = await requestJson(base, `/files/${record.file.id}/complete`, "POST", {
        upload_intent: record.intent.token,
        bytes_base64: Buffer.from(imageBytes).toString("base64"),
      });
      assert.equal(complete.status, 200);
      const link = await requestJson(base, `/files/${record.file.id}/read-link`, "POST");
      assert.equal(link.status, 200);
      return (link.body.data as { read_link: string }).read_link;
    };
    const [expiringReadLinkNest, expiringReadLinkFastify] = await Promise.all([
      prepareReadLink(nestBase, expiringReadNest),
      prepareReadLink(fastifyBase, expiringReadFastify),
    ]);
    now = new Date(now.getTime() + 6 * 60 * 1000);
    const [expiredReadNest, expiredReadFastify] = await Promise.all([
      requestJson(
        nestBase,
        `/files/${expiringReadNest.file.id}/read?read_token=${encodeURIComponent(expiringReadLinkNest)}`,
        "GET",
      ),
      requestJson(
        fastifyBase,
        `/files/${expiringReadFastify.file.id}/read?read_token=${encodeURIComponent(expiringReadLinkFastify)}`,
        "GET",
      ),
    ]);
    assert.equal(expiredReadNest.status, 410);
    assert.equal(expiredReadFastify.status, expiredReadNest.status);
    assert.equal(errorCode(expiredReadNest.body), "READ_LINK_EXPIRED");
    now = new Date(now.getTime() + 5 * 60 * 1000);
    const [expiredUploadNest, expiredUploadFastify] = await Promise.all([
      requestJson(nestBase, `/files/${expiringUploadNest.file.id}/complete`, "POST", {
        upload_intent: expiringUploadNest.intent.token,
        bytes_base64: Buffer.from(imageBytes).toString("base64"),
      }),
      requestJson(fastifyBase, `/files/${expiringUploadFastify.file.id}/complete`, "POST", {
        upload_intent: expiringUploadFastify.intent.token,
        bytes_base64: Buffer.from(imageBytes).toString("base64"),
      }),
    ]);
    assert.equal(expiredUploadNest.status, 410);
    assert.equal(expiredUploadFastify.status, expiredUploadNest.status);
    assert.equal(errorCode(expiredUploadNest.body), "UPLOAD_INTENT_EXPIRED");

    auth = { ...trustedAuthResult(), memberships: [] };
    const [noMembershipNest, noMembershipFastify] = await Promise.all([
      requestJson(nestBase, "/files/intents", "POST", input),
      requestJson(fastifyBase, "/files/intents", "POST", input),
    ]);
    assert.equal(noMembershipNest.status, 403);
    assert.equal(noMembershipFastify.status, noMembershipNest.status);
    auth = {
      ...trustedAuthResult(),
      memberships: [{
        tenant_id: TENANT_ID,
        campus_ids: [CAMPUS_ID],
        status: "ACTIVE",
        capabilities: [],
      }],
    };
    const [noCapabilityNest, noCapabilityFastify] = await Promise.all([
      requestJson(nestBase, "/files/intents", "POST", input),
      requestJson(fastifyBase, "/files/intents", "POST", input),
    ]);
    assert.equal(noCapabilityNest.status, 403);
    assert.equal(noCapabilityFastify.status, noCapabilityNest.status);

    auth = undefined;
    const unauthenticated = await requestJson(nestBase, "/files/intents", "POST", input);
    assert.equal(unauthenticated.status, 401);
    assert.equal(errorCode(unauthenticated.body), "UNAUTHENTICATED");
  } finally {
    await nest.close();
    await fastify.close();
  }
});
