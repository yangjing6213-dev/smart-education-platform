import type { FastifyInstance, FastifyRequest } from "fastify";
import type { AuthContext } from "@student-care/auth";
import {
  FileService,
  type FileActorContext,
  type FileResult,
  type FileUploadIntentInput,
} from "../modules/files/file.service.js";

const FORBIDDEN_QUERY_FIELDS = new Set([
  "actor_id",
  "identity_id",
  "tenant_id",
  "campus_id",
  "role",
  "roles",
  "membership",
  "ownership",
  "scope",
  "storage_key",
  "provider_url",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function queryRecord(request: FastifyRequest): Record<string, unknown> {
  return isRecord(request.query) ? request.query : {};
}

function hasForbiddenQueryClaim(request: FastifyRequest): boolean {
  return Object.keys(queryRecord(request)).some((key) => FORBIDDEN_QUERY_FIELDS.has(key));
}

function hasOnlyQueryKeys(request: FastifyRequest, keys: readonly string[]): boolean {
  return Object.keys(queryRecord(request)).every((key) => keys.includes(key));
}

function contextFromRequest(request: FastifyRequest): FileActorContext | undefined {
  const scope = request.scopeContext;
  const authContext: AuthContext | undefined = request.authContext;
  if (scope === undefined || authContext === undefined || scope.campusId === undefined) {
    return undefined;
  }
  if (authContext.identity.actor_id !== scope.actorId) return undefined;
  const membership = authContext.memberships.find(
    (candidate) =>
      candidate.status === "ACTIVE" &&
      candidate.tenant_id === scope.tenantId &&
      candidate.campus_ids.includes(scope.campusId!),
  );
  if (membership === undefined) return undefined;
  return {
    trusted: true,
    actorId: scope.actorId,
    activeMembership: true,
    scope: { tenantId: scope.tenantId, campusId: scope.campusId },
    capabilities: membership.capabilities,
    requestCorrelationId: request.id,
    traceId: request.id,
  };
}

function statusFor(code: string): number {
  if (
    code === "VALIDATION_FAILED" ||
    code === "MIME_NOT_ALLOWED" ||
    code === "SIZE_NOT_ALLOWED" ||
    code === "CHECKSUM_MISMATCH" ||
    code === "MIME_MISMATCH"
  ) {
    return 400;
  }
  if (code === "NOT_FOUND_SCOPED") return 404;
  if (code === "UPLOAD_INTENT_EXPIRED" || code === "READ_LINK_EXPIRED") return 410;
  if (code === "SCAN_NOT_APPROVED" || code === "UPLOAD_INTENT_CONSUMED") return 409;
  return 403;
}

function sendResult<T>(
  request: FastifyRequest,
  reply: { code: (status: number) => { send: (body: unknown) => unknown } },
  result: FileResult<T>,
  successStatus = 200,
) {
  if (!result.ok) {
    return reply.code(statusFor(result.error.code)).send({
      error: result.error,
      request_id: request.id,
    });
  }
  return reply.code(successStatus).send({ data: result.data, request_id: request.id });
}

function invalid(
  request: FastifyRequest,
  reply: { code: (status: number) => { send: (body: unknown) => unknown } },
) {
  return reply.code(400).send({
    error: { code: "VALIDATION_FAILED", message: "File input is invalid." },
    request_id: request.id,
  });
}

function forbidden(
  request: FastifyRequest,
  reply: { code: (status: number) => { send: (body: unknown) => unknown } },
) {
  return reply.code(403).send({
    error: { code: "FORBIDDEN_SCOPE", message: "File scope access is not permitted." },
    request_id: request.id,
  });
}

function fileId(request: FastifyRequest): string {
  return (request.params as { fileId: string }).fileId;
}

function bodyKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return isRecord(value) && Object.keys(value).every((key) => keys.includes(key));
}

function intentInput(value: unknown): FileUploadIntentInput | undefined {
  if (
    !bodyKeys(value, ["declared_purpose", "mime_type", "size_bytes", "checksum"]) ||
    typeof value.declared_purpose !== "string" ||
    typeof value.mime_type !== "string" ||
    typeof value.size_bytes !== "number" ||
    typeof value.checksum !== "string"
  ) {
    return undefined;
  }
  return {
    declaredPurpose: value.declared_purpose,
    mimeType: value.mime_type,
    sizeBytes: value.size_bytes,
    checksum: value.checksum,
  };
}

function completeInput(value: unknown): { uploadIntent: string; bytes: Uint8Array } | undefined {
  if (
    !bodyKeys(value, ["upload_intent", "bytes_base64"]) ||
    typeof value.upload_intent !== "string" ||
    typeof value.bytes_base64 !== "string" ||
    value.bytes_base64.length === 0 ||
    value.bytes_base64.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(value.bytes_base64)
  ) {
    return undefined;
  }
  const bytes = Buffer.from(value.bytes_base64, "base64");
  if (bytes.length === 0 || bytes.toString("base64") !== value.bytes_base64) return undefined;
  return { uploadIntent: value.upload_intent, bytes: new Uint8Array(bytes) };
}

function readToken(request: FastifyRequest): string | undefined {
  const query = queryRecord(request);
  return Object.keys(query).every((key) => key === "read_token") &&
    typeof query.read_token === "string"
    ? query.read_token
    : undefined;
}

export function registerFileIntentRoutes(app: FastifyInstance, service: FileService): void {
  app.post(
    "/files/intents",
    { config: { authRequired: true, scopeRequired: true, capabilityRequired: "content:write" } },
    async (request, reply) => {
      if (hasForbiddenQueryClaim(request) || !hasOnlyQueryKeys(request, [])) {
        return invalid(request, reply);
      }
      const context = contextFromRequest(request);
      const input = intentInput(request.body);
      if (input === undefined) return invalid(request, reply);
      if (context === undefined) return forbidden(request, reply);
      return sendResult(request, reply, service.createUploadIntent(context, input), 201);
    },
  );

  app.post(
    "/files/:fileId/complete",
    { config: { authRequired: true, scopeRequired: true, capabilityRequired: "content:write" } },
    async (request, reply) => {
      if (hasForbiddenQueryClaim(request) || !hasOnlyQueryKeys(request, [])) {
        return invalid(request, reply);
      }
      const context = contextFromRequest(request);
      const input = completeInput(request.body);
      if (input === undefined) return invalid(request, reply);
      if (context === undefined) return forbidden(request, reply);
      return sendResult(
        request,
        reply,
        service.completeUpload(context, fileId(request), input.uploadIntent, input.bytes),
      );
    },
  );

  app.post(
    "/files/:fileId/read-link",
    { config: { authRequired: true, scopeRequired: true, capabilityRequired: "content:write" } },
    async (request, reply) => {
      if (
        hasForbiddenQueryClaim(request) ||
        !hasOnlyQueryKeys(request, []) ||
        (request.body !== undefined &&
          (!isRecord(request.body) || Object.keys(request.body).length > 0))
      ) {
        return invalid(request, reply);
      }
      const context = contextFromRequest(request);
      if (context === undefined) return forbidden(request, reply);
      return sendResult(request, reply, service.issueReadLink(context, fileId(request)));
    },
  );

  app.get(
    "/files/:fileId/read",
    { config: { authRequired: true, scopeRequired: true, capabilityRequired: "content:write" } },
    async (request, reply) => {
      if (hasForbiddenQueryClaim(request) || !hasOnlyQueryKeys(request, ["read_token"])) {
        return invalid(request, reply);
      }
      const context = contextFromRequest(request);
      const token = readToken(request);
      if (context === undefined) return forbidden(request, reply);
      if (token === undefined)
        return sendResult(request, reply, service.readFile(context, fileId(request), ""));
      const result = service.readFile(context, fileId(request), token);
      if (!result.ok) return sendResult(request, reply, result);
      return reply.code(200).send({
        data: {
          file_id: result.data.file_id,
          bytes_base64: Buffer.from(result.data.bytes).toString("base64"),
          mime_type: result.data.mime_type,
          checksum: result.data.checksum,
        },
        request_id: request.id,
      });
    },
  );
}
