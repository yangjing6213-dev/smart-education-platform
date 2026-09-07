import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import fastify from "fastify";
import type { AuthContext } from "@student-care/auth";
import { registerFileIntentRoutes } from "../../routes/file-intent.route.js";
import {
  FileService,
  MAX_FILE_BYTES,
  type FileActorContext,
  type FileUploadIntentInput,
} from "./file.service.js";
import { InMemoryCosStorage } from "../../adapters/cos.storage.js";

const ACTOR_ID = "00000000-0000-4000-8000-000000000003";
const TENANT_ID = "00000000-0000-4000-8000-000000000001";
const CAMPUS_ID = "00000000-0000-4000-8000-000000000002";
const FOREIGN_TENANT_ID = "00000000-0000-4000-8000-000000000004";
const FOREIGN_CAMPUS_ID = "00000000-0000-4000-8000-000000000005";

const imageBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01]);

function checksum(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function context(
  tenantId = TENANT_ID,
  campusId = CAMPUS_ID,
  capabilities: readonly string[] = ["content:write"],
): FileActorContext {
  return {
    trusted: true,
    actorId: ACTOR_ID,
    activeMembership: true,
    scope: { tenantId, campusId },
    capabilities,
  };
}

function input(overrides: Partial<FileUploadIntentInput> = {}): FileUploadIntentInput {
  return {
    declaredPurpose: "ACTIVITY_MEDIA",
    mimeType: "image/png",
    sizeBytes: imageBytes.byteLength,
    checksum: checksum(imageBytes),
    ...overrides,
  };
}

function authContext(): AuthContext {
  return {
    identity: { actor_id: ACTOR_ID, display_name: "模拟员工一号" },
    memberships: [
      {
        tenant_id: TENANT_ID,
        campus_ids: [CAMPUS_ID],
        status: "ACTIVE",
        capabilities: ["content:write"],
      },
    ],
  };
}

test("file service validates metadata before creating a scoped intent", () => {
  const service = new FileService(new InMemoryCosStorage());

  assert.equal(
    service.createUploadIntent(context(), input({ mimeType: "application/x-msdownload" })).ok,
    false,
  );
  assert.equal(
    service.createUploadIntent(context(), input({ sizeBytes: MAX_FILE_BYTES + 1 })).ok,
    false,
  );
  assert.equal(
    service.createUploadIntent(context(), input({ declaredPurpose: "UNKNOWN" })).ok,
    false,
  );
  assert.equal(
    service.createUploadIntent(context(), input({ checksum: "not-a-checksum" })).ok,
    false,
  );
  assert.equal(
    service.createUploadIntent(context(undefined as never, undefined as never, []), input()).ok,
    false,
  );
  assert.equal(service.createUploadIntent(context(TENANT_ID, FOREIGN_CAMPUS_ID), input()).ok, true);

  const declaredWrongSize = service.createUploadIntent(
    context(),
    input({ sizeBytes: imageBytes.byteLength + 1 }),
  );
  assert.equal(declaredWrongSize.ok, true);
  if (!declaredWrongSize.ok) return;
  assert.deepEqual(
    service.completeUpload(
      context(),
      declaredWrongSize.data.file.id,
      declaredWrongSize.data.intent.token,
      imageBytes,
    ),
    {
      ok: false,
      error: { code: "SIZE_NOT_ALLOWED", message: "The file size is not allowed." },
    },
  );
});

test("valid synthetic image becomes approved and exposes only a scoped read projection", () => {
  const service = new FileService(new InMemoryCosStorage(), {
    now: () => new Date("2026-09-08T00:00:00.000Z"),
  });
  const created = service.createUploadIntent(context(), input());
  assert.equal(created.ok, true);
  if (!created.ok) return;
  assert.equal(created.data.file.scan_state, "PENDING");
  assert.equal(created.data.file.tenant_id, TENANT_ID);
  assert.equal(created.data.file.campus_id, CAMPUS_ID);
  assert.equal("storage_key" in created.data.file, false);
  assert.equal("provider_url" in created.data.intent, false);
  assert.deepEqual(service.issueReadLink(context(), created.data.file.id), {
    ok: false,
    error: { code: "SCAN_NOT_APPROVED", message: "The file is not approved for reading." },
  });

  const completed = service.completeUpload(
    context(),
    created.data.file.id,
    created.data.intent.token,
    imageBytes,
  );
  assert.equal(completed.ok, true);
  if (!completed.ok) return;
  assert.equal(completed.data.scan_state, "APPROVED");
  assert.deepEqual(
    service.completeUpload(context(), created.data.file.id, created.data.intent.token, imageBytes),
    {
      ok: false,
      error: {
        code: "UPLOAD_INTENT_CONSUMED",
        message: "The upload intent has already been consumed.",
      },
    },
  );

  const link = service.issueReadLink(context(), created.data.file.id);
  assert.equal(link.ok, true);
  if (!link.ok) return;
  assert.equal("provider_url" in link.data, false);
  assert.equal("storage_key" in link.data, false);

  const read = service.readFile(context(), created.data.file.id, link.data.read_link);
  assert.equal(read.ok, true);
  if (!read.ok) return;
  assert.deepEqual([...read.data.bytes], [...imageBytes]);
  assert.equal(read.data.mime_type, "image/png");
  assert.equal("provider_url" in read.data, false);
});

test("foreign scope, unsigned access, expired intent, and expired link fail closed", () => {
  let now = new Date("2026-09-08T00:00:00.000Z");
  const service = new FileService(new InMemoryCosStorage(), { now: () => now });
  const created = service.createUploadIntent(context(), input());
  assert.equal(created.ok, true);
  if (!created.ok) return;

  assert.deepEqual(
    service.completeUpload(
      context(FOREIGN_TENANT_ID, CAMPUS_ID),
      created.data.file.id,
      created.data.intent.token,
      imageBytes,
    ),
    {
      ok: false,
      error: { code: "FORBIDDEN_SCOPE", message: "File scope access is not permitted." },
    },
  );
  assert.deepEqual(service.readFile(context(), created.data.file.id, ""), {
    ok: false,
    error: { code: "UNSIGNED_ACCESS", message: "A signed file read token is required." },
  });

  now = new Date("2026-09-08T00:10:01.000Z");
  assert.deepEqual(
    service.completeUpload(context(), created.data.file.id, created.data.intent.token, imageBytes),
    {
      ok: false,
      error: { code: "UPLOAD_INTENT_EXPIRED", message: "The upload intent has expired." },
    },
  );

  now = new Date("2026-09-08T01:00:00.000Z");
  const readable = service.createUploadIntent(context(), input());
  assert.equal(readable.ok, true);
  if (!readable.ok) return;
  assert.equal(
    service.completeUpload(context(), readable.data.file.id, readable.data.intent.token, imageBytes)
      .ok,
    true,
  );
  const link = service.issueReadLink(context(), readable.data.file.id);
  assert.equal(link.ok, true);
  if (!link.ok) return;
  now = new Date("2026-09-08T01:05:01.000Z");
  assert.deepEqual(service.readFile(context(), readable.data.file.id, link.data.read_link), {
    ok: false,
    error: { code: "READ_LINK_EXPIRED", message: "The file read link has expired." },
  });
});

test("checksum mismatch preserves the pending record and does not consume the intent", () => {
  const service = new FileService(new InMemoryCosStorage());
  const created = service.createUploadIntent(context(), input());
  assert.equal(created.ok, true);
  if (!created.ok) return;

  const changedBytes = new Uint8Array([...imageBytes, 0xff]);
  const failed = service.completeUpload(
    context(),
    created.data.file.id,
    created.data.intent.token,
    changedBytes,
  );
  assert.deepEqual(failed, {
    ok: false,
    error: { code: "CHECKSUM_MISMATCH", message: "The file checksum does not match." },
  });
  assert.equal(service.getFileRecord(context(), created.data.file.id).data?.scan_state, "PENDING");
  assert.equal(
    service.completeUpload(context(), created.data.file.id, created.data.intent.token, imageBytes)
      .ok,
    true,
  );
});

test("failed fake scan stays unreadable and denied operations do not emit success audit", () => {
  const auditEvents: string[] = [];
  const service = new FileService(new InMemoryCosStorage({ scan: () => "REJECTED" }), {
    onAuditEvent: (event) => auditEvents.push(event.eventType),
  });
  const created = service.createUploadIntent(context(), input());
  assert.equal(created.ok, true);
  if (!created.ok) return;

  const wrongBytes = new Uint8Array([...imageBytes, 0xff]);
  assert.equal(
    service.completeUpload(context(), created.data.file.id, created.data.intent.token, wrongBytes)
      .ok,
    false,
  );
  assert.deepEqual(auditEvents, ["UPLOAD_INTENT_ISSUED"]);

  const completed = service.completeUpload(
    context(),
    created.data.file.id,
    created.data.intent.token,
    imageBytes,
  );
  assert.equal(completed.ok, true);
  if (!completed.ok) return;
  assert.equal(completed.data.scan_state, "REJECTED");
  assert.deepEqual(auditEvents, ["UPLOAD_INTENT_ISSUED", "UPLOAD_REJECTED"]);
  assert.deepEqual(service.issueReadLink(context(), created.data.file.id), {
    ok: false,
    error: { code: "SCAN_NOT_APPROVED", message: "The file is not approved for reading." },
  });
  assert.deepEqual(auditEvents, ["UPLOAD_INTENT_ISSUED", "UPLOAD_REJECTED"]);
});

test("file intent routes derive scope from trusted request context and reject client claims", async () => {
  const app = fastify({ logger: false });
  const service = new FileService(new InMemoryCosStorage());
  app.decorateRequest("authContext", undefined);
  app.decorateRequest("scopeContext", undefined);
  app.addHook("preHandler", async (request) => {
    request.authContext = authContext();
    request.scopeContext = { actorId: ACTOR_ID, tenantId: TENANT_ID, campusId: CAMPUS_ID };
  });
  registerFileIntentRoutes(app, service);

  try {
    const created = await app.inject({
      method: "POST",
      url: "/files/intents",
      payload: {
        declared_purpose: "ACTIVITY_MEDIA",
        mime_type: "image/png",
        size_bytes: imageBytes.byteLength,
        checksum: checksum(imageBytes),
      },
    });
    assert.equal(created.statusCode, 201);
    const createdBody = created.json() as {
      data: { file: { id: string }; intent: { token: string } };
    };

    const complete = await app.inject({
      method: "POST",
      url: `/files/${createdBody.data.file.id}/complete`,
      payload: {
        upload_intent: createdBody.data.intent.token,
        bytes_base64: Buffer.from(imageBytes).toString("base64"),
      },
    });
    assert.equal(complete.statusCode, 200);

    const readLink = await app.inject({
      method: "POST",
      url: `/files/${createdBody.data.file.id}/read-link`,
    });
    assert.equal(readLink.statusCode, 200);
    const readLinkBody = readLink.json() as { data: { read_link: string } };

    const read = await app.inject({
      method: "GET",
      url: `/files/${createdBody.data.file.id}/read?read_token=${encodeURIComponent(readLinkBody.data.read_link)}`,
    });
    assert.equal(read.statusCode, 200);
    assert.equal(read.json().data.bytes_base64, Buffer.from(imageBytes).toString("base64"));

    const forged = await app.inject({
      method: "POST",
      url: "/files/intents?tenant_id=" + FOREIGN_TENANT_ID,
      payload: {
        declared_purpose: "ACTIVITY_MEDIA",
        mime_type: "image/png",
        size_bytes: imageBytes.byteLength,
        checksum: checksum(imageBytes),
      },
    });
    assert.equal(forged.statusCode, 400);
  } finally {
    await app.close();
  }
});
