import { activeMemberships, resolveAuthContext } from "@student-care/auth";
import { resolveScope } from "@student-care/tenant";
import { Body, Controller, Get, Inject, Param, Post, Query, Req, Res } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type {
  FileActorContext,
  FileResult,
  FileService,
  FileUploadIntentInput,
} from "../modules/files/file.service.js";
import { containsForgedIdentityClaim } from "../plugins/forged-identity-claims.js";
import {
  FILE_SERVICE,
  TRUSTED_AUTH_PROVIDER,
  type ApiHttpRequest,
  type ApiHttpResponse,
  type TrustedAuthProvider,
} from "./api-tokens.js";

const INTENT_KEYS = new Set(["declared_purpose", "mime_type", "size_bytes", "checksum"]);
const COMPLETE_KEYS = new Set(["upload_intent", "bytes_base64"]);
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

type AccessResult =
  | { readonly ok: true; readonly context: FileActorContext }
  | {
      readonly ok: false;
      readonly status: 401 | 403;
      readonly code: "UNAUTHENTICATED" | "FORBIDDEN_SCOPE";
      readonly message: string;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function denied(status: 401 | 403): Extract<AccessResult, { readonly ok: false }> {
  return status === 401
    ? {
        ok: false,
        status,
        code: "UNAUTHENTICATED",
        message: "Authentication is required.",
      }
    : {
        ok: false,
        status,
        code: "FORBIDDEN_SCOPE",
        message: "Scope access is not permitted.",
      };
}

function fileContext(authResult: unknown, request: ApiHttpRequest, requestId: string): AccessResult {
  if (containsForgedIdentityClaim(request.query, request.headers)) return denied(401);
  const auth = resolveAuthContext(authResult);
  if (!auth.ok) return denied(401);
  if (activeMemberships(auth).length === 0) return denied(403);

  const tenantValue = request.query.tenant_id;
  if (tenantValue !== undefined && typeof tenantValue !== "string") return denied(403);
  const requestedTenantId = typeof tenantValue === "string" ? tenantValue : undefined;
  const campusValue = request.query.campus_id;
  const requestedCampusId = typeof campusValue === "string" ? campusValue : undefined;
  const memberships = auth.context.memberships.filter(
    (membership) =>
      membership.status === "ACTIVE" && membership.capabilities.includes("content:write"),
  );
  const membership =
    memberships.find(
      (candidate) =>
        candidate.tenant_id === requestedTenantId &&
        (requestedCampusId === undefined || candidate.campus_ids.includes(requestedCampusId)),
    ) ??
    (requestedTenantId === undefined
      ? memberships.find(
          (candidate) =>
            requestedCampusId === undefined || candidate.campus_ids.includes(requestedCampusId),
        )
      : undefined);
  const campusId = requestedCampusId ?? membership?.campus_ids[0];
  const scope = resolveScope({
    trustedActor: { actorId: auth.context.identity.actor_id },
    membership: membership
      ? {
          tenantId: membership.tenant_id,
          campusIds: membership.campus_ids,
          status: "ACTIVE",
        }
      : undefined,
    requestedTenantId,
    requestedCampusId: campusId,
  });
  if (membership === undefined || campusId === undefined || !scope.ok) return denied(403);

  return {
    ok: true,
    context: {
      trusted: true,
      actorId: scope.scopeContext.actorId,
      activeMembership: true,
      scope: { tenantId: scope.scopeContext.tenantId, campusId },
      capabilities: membership.capabilities,
      requestCorrelationId: requestId,
      traceId: requestId,
    },
  };
}

function requestId(request: ApiHttpRequest): string {
  const candidate = (request as ApiHttpRequest & { readonly id?: unknown }).id;
  return typeof candidate === "string" && candidate.length > 0 ? candidate : randomUUID();
}

function invalid(response: ApiHttpResponse, id: string): unknown {
  return response.status(400).json({
    error: { code: "VALIDATION_FAILED", message: "File input is invalid." },
    request_id: id,
  });
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: ReadonlySet<string>): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}

function sendAccessError(response: ApiHttpResponse, id: string, access: AccessResult) {
  if (access.ok) return undefined;
  return response.status(access.status).json({
    error: { code: access.code, message: access.message },
    request_id: id,
  });
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
  response: ApiHttpResponse,
  id: string,
  result: FileResult<T>,
  successStatus = 200,
) {
  if (!result.ok) {
    return response.status(statusFor(result.error.code)).json({ error: result.error, request_id: id });
  }
  return response.status(successStatus).json({ data: result.data, request_id: id });
}

function uploadInput(value: unknown): FileUploadIntentInput | undefined {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, INTENT_KEYS) ||
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

function completeInput(value: unknown):
  | { readonly uploadIntent: string; readonly bytes: Uint8Array }
  | undefined {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, COMPLETE_KEYS) ||
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

function hasInvalidQuery(request: ApiHttpRequest, allowed: readonly string[]): boolean {
  return (
    Object.keys(request.query).some((key) => FORBIDDEN_QUERY_FIELDS.has(key)) ||
    Object.keys(request.query).some((key) => !allowed.includes(key))
  );
}

@Controller("files")
export class FilesController {
  public constructor(
    @Inject(FILE_SERVICE) private readonly fileService: FileService,
    @Inject(TRUSTED_AUTH_PROVIDER) private readonly getTrustedAuthResult: TrustedAuthProvider,
  ) {}

  @Post("intents")
  public async createIntent(
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const id = requestId(request);
    const access = fileContext(await this.getTrustedAuthResult(request), request, id);
    if (!access.ok) return sendAccessError(response, id, access);
    const input = uploadInput(body);
    if (hasInvalidQuery(request, []) || input === undefined) return invalid(response, id);
    return sendResult(response, id, this.fileService.createUploadIntent(access.context, input), 201);
  }

  @Post(":fileId/complete")
  public async complete(
    @Param("fileId") fileId: string,
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const id = requestId(request);
    const access = fileContext(await this.getTrustedAuthResult(request), request, id);
    if (!access.ok) return sendAccessError(response, id, access);
    const input = completeInput(body);
    if (hasInvalidQuery(request, []) || input === undefined) return invalid(response, id);
    return sendResult(
      response,
      id,
      this.fileService.completeUpload(access.context, fileId, input.uploadIntent, input.bytes),
    );
  }

  @Post(":fileId/read-link")
  public async createReadLink(
    @Param("fileId") fileId: string,
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const id = requestId(request);
    const access = fileContext(await this.getTrustedAuthResult(request), request, id);
    if (!access.ok) return sendAccessError(response, id, access);
    if (
      hasInvalidQuery(request, []) ||
      (body !== undefined && (!isRecord(body) || Object.keys(body).length > 0))
    ) {
      return invalid(response, id);
    }
    return sendResult(response, id, this.fileService.issueReadLink(access.context, fileId));
  }

  @Get(":fileId/read")
  public async read(
    @Param("fileId") fileId: string,
    @Query("read_token") token: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const id = requestId(request);
    const access = fileContext(await this.getTrustedAuthResult(request), request, id);
    if (!access.ok) return sendAccessError(response, id, access);
    if (hasInvalidQuery(request, ["read_token"]) || (token !== undefined && typeof token !== "string")) {
      return invalid(response, id);
    }
    const result = this.fileService.readFile(access.context, fileId, token ?? "");
    if (!result.ok) return sendResult(response, id, result);
    return response.status(200).json({
      data: {
        file_id: result.data.file_id,
        bytes_base64: Buffer.from(result.data.bytes).toString("base64"),
        mime_type: result.data.mime_type,
        checksum: result.data.checksum,
      },
      request_id: id,
    });
  }
}
