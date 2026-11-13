import { resolveAuthContext, type AuthResolution } from "@student-care/auth";
import { Body, Controller, Get, Inject, Param, Post, Req, Res } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { containsForgedIdentityClaim } from "../plugins/forged-identity-claims.js";
import {
  PARENT_HEALTH_INCIDENT_OPERATIONS,
  TRUSTED_AUTH_PROVIDER,
  type ApiHttpRequest,
  type ApiHttpResponse,
  type ParentHealthIncidentContext,
  type ParentHealthIncidentOperations,
  type TrustedAuthProvider,
} from "./api-tokens.js";

type Access =
  | { readonly ok: true; readonly context: ParentHealthIncidentContext }
  | { readonly ok: false; readonly status: 400 | 401 | 403; readonly code: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validVersionBody(value: unknown): value is { readonly version: number } {
  return (
    isRecord(value) &&
    Object.keys(value).length === 1 &&
    Object.keys(value)[0] === "version" &&
    Number.isSafeInteger(value.version) &&
    Number(value.version) > 0
  );
}

function access(auth: AuthResolution): Access {
  if (!auth.ok) return { ok: false, status: 401, code: "UNAUTHENTICATED" };
  const memberships = auth.context.memberships.filter(
    (membership) => membership.status === "ACTIVE",
  );
  const membership = memberships[0];
  const capabilities: readonly string[] = membership?.capabilities ?? [];
  if (memberships.length !== 1 || !membership || membership.campus_ids.length !== 1)
    return { ok: false, status: 403, code: "FORBIDDEN_SCOPE" };
  if (!capabilities.includes("binding:read"))
    return { ok: false, status: 403, code: "FORBIDDEN_SCOPE" };
  return {
    ok: true,
    context: {
      actorId: auth.context.identity.actor_id,
      tenantId: membership.tenant_id,
      campusId: membership.campus_ids[0]!,
      capabilities,
    },
  };
}

function responseError(
  response: ApiHttpResponse,
  status: number,
  code: string,
  requestId: string,
): unknown {
  return response.status(status).json({
    error: {
      code,
      message: status === 401 ? "Authentication is required." : "Request is invalid.",
    },
    request_id: requestId,
  });
}

function operationError(error: unknown, response: ApiHttpResponse, requestId: string): unknown {
  const status =
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    [400, 403, 404, 409].includes(Number(error.statusCode))
      ? (Number(error.statusCode) as 400 | 403 | 404 | 409)
      : 500;
  const code =
    typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
      ? error.code
      : "INTERNAL_ERROR";
  return response.status(status).json({
    error: { code, message: "家长健康摘要暂不可用。" },
    request_id: requestId,
  });
}

function invalidScope(request: ApiHttpRequest): boolean {
  return (
    request.headers["x-tenant-id"] !== undefined || request.headers["x-campus-id"] !== undefined
  );
}

@Controller("parent/health-incidents")
export class ParentHealthIncidentController {
  public constructor(
    @Inject(PARENT_HEALTH_INCIDENT_OPERATIONS)
    private readonly operations: ParentHealthIncidentOperations,
    @Inject(TRUSTED_AUTH_PROVIDER)
    private readonly getTrustedAuthResult: TrustedAuthProvider,
  ) {}

  private async authorize(request: ApiHttpRequest): Promise<Access> {
    if (containsForgedIdentityClaim(request.query, request.headers))
      return { ok: false, status: 401, code: "UNAUTHENTICATED" };
    if (invalidScope(request)) return { ok: false, status: 400, code: "VALIDATION_FAILED" };
    return access(resolveAuthContext(await this.getTrustedAuthResult(request)));
  }

  @Get()
  public async list(
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const allowed = await this.authorize(request);
    if (!allowed.ok) return responseError(response, allowed.status, allowed.code, requestId);
    if (Object.keys(request.query).length > 0)
      return responseError(response, 400, "VALIDATION_FAILED", requestId);
    try {
      return response.status(200).json({
        data: await this.operations.list(allowed.context),
        request_id: requestId,
      });
    } catch (error) {
      return operationError(error, response, requestId);
    }
  }

  @Post(":incidentId/read")
  public async read(
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
    @Param("incidentId") incidentId: string,
    @Body() body: unknown,
  ): Promise<unknown> {
    return this.mutate("read", request, response, incidentId, body);
  }

  @Post(":incidentId/ack")
  public async acknowledge(
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
    @Param("incidentId") incidentId: string,
    @Body() body: unknown,
  ): Promise<unknown> {
    return this.mutate("acknowledge", request, response, incidentId, body);
  }

  private async mutate(
    action: "read" | "acknowledge",
    request: ApiHttpRequest,
    response: ApiHttpResponse,
    incidentId: string,
    body: unknown,
  ): Promise<unknown> {
    const requestId = randomUUID();
    if (!UUID.test(incidentId) || !validVersionBody(body))
      return responseError(response, 400, "VALIDATION_FAILED", requestId);
    const allowed = await this.authorize(request);
    if (!allowed.ok) return responseError(response, allowed.status, allowed.code, requestId);
    if (Object.keys(request.query).length > 0)
      return responseError(response, 400, "VALIDATION_FAILED", requestId);
    try {
      const data =
        action === "read"
          ? await this.operations.read(allowed.context, incidentId, body)
          : await this.operations.acknowledge(allowed.context, incidentId, body);
      return response.status(200).json({ data, request_id: requestId });
    } catch (error) {
      return operationError(error, response, requestId);
    }
  }
}
