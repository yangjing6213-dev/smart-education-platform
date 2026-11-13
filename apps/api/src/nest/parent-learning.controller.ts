import { resolveAuthContext } from "@student-care/auth";
import { Body, Controller, Get, Inject, Param, Post, Req, Res } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { containsForgedIdentityClaim } from "../plugins/forged-identity-claims.js";
import {
  PARENT_LEARNING_OPERATIONS,
  TRUSTED_AUTH_PROVIDER,
  type ApiHttpRequest,
  type ApiHttpResponse,
  type ParentLearningContext,
  type ParentLearningOperations,
  type TrustedAuthProvider,
} from "./api-tokens.js";

type AccessResult =
  | { readonly ok: true; readonly context: ParentLearningContext }
  | {
      readonly ok: false;
      readonly status: 400 | 401 | 403;
      readonly code: "VALIDATION_FAILED" | "UNAUTHENTICATED" | "FORBIDDEN_SCOPE";
      readonly message: string;
  };
type Capability = "binding:read" | "binding:apply" | "learning:summary";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function hasNoQuery(request: ApiHttpRequest): boolean {
  return Object.keys(request.query).length === 0;
}

function accessError(status: 400 | 401 | 403): Extract<AccessResult, { readonly ok: false }> {
  if (status === 401)
    return {
      ok: false,
      status,
      code: "UNAUTHENTICATED",
      message: "Authentication is required.",
    };
  if (status === 403)
    return {
      ok: false,
      status,
      code: "FORBIDDEN_SCOPE",
      message: "Scope access is not permitted.",
    };
  return { ok: false, status, code: "VALIDATION_FAILED", message: "Request is invalid." };
}

function sendOperationError(error: unknown, response: ApiHttpResponse, requestId: string): unknown {
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
    error: { code, message: "学习记录暂不可用。" },
    request_id: requestId,
  });
}

@Controller()
export class ParentLearningController {
  public constructor(
    @Inject(PARENT_LEARNING_OPERATIONS)
    private readonly service: ParentLearningOperations,
    @Inject(TRUSTED_AUTH_PROVIDER)
    private readonly getTrustedAuthResult: TrustedAuthProvider,
  ) {}

  private async authorize(request: ApiHttpRequest, capability: Capability): Promise<AccessResult> {
    if (containsForgedIdentityClaim(request.query, request.headers)) return accessError(401);
    if (request.headers["x-tenant-id"] !== undefined || request.headers["x-campus-id"] !== undefined)
      return accessError(400);
    const auth = resolveAuthContext(await this.getTrustedAuthResult(request));
    if (!auth.ok) return accessError(401);

    const scopes = auth.context.memberships
      .filter(
        (membership) =>
          membership.status === "ACTIVE" && membership.capabilities.includes(capability),
      )
      .flatMap((membership) =>
        membership.campus_ids.map((campusId) => ({
          actorId: auth.context.identity.actor_id,
          tenantId: membership.tenant_id,
          campusId,
          capabilities: membership.capabilities,
        })),
      );
    if (scopes.length !== 1) return accessError(403);
    return { ok: true, context: scopes[0]! };
  }

  private sendAccessError(
    response: ApiHttpResponse,
    requestId: string,
    access: Extract<AccessResult, { readonly ok: false }>,
  ) {
    return response.status(access.status).json({
      error: { code: access.code, message: access.message },
      request_id: requestId,
    });
  }

  @Get("parent/learning")
  public async parentLearning(
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = await this.authorize(request, "binding:read");
    if (!access.ok) return this.sendAccessError(response, requestId, access);
    if (!hasNoQuery(request))
      return response.status(400).json({
        error: { code: "VALIDATION_FAILED", message: "Request is invalid." },
        request_id: requestId,
      });
    try {
      return response.status(200).json({
        data: await this.service.parentLearning(access.context),
        request_id: requestId,
      });
    } catch (error) {
      return sendOperationError(error, response, requestId);
    }
  }

  @Post("parent/learning/:studentId/controls")
  public async updateParentLearningControls(
    @Param("studentId") studentId: string,
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = await this.authorize(request, "binding:apply");
    if (!access.ok) return this.sendAccessError(response, requestId, access);
    if (!UUID.test(studentId) || !hasNoQuery(request))
      return response.status(400).json({
        error: { code: "VALIDATION_FAILED", message: "Request is invalid." },
        request_id: requestId,
      });
    try {
      return response.status(200).json({
        data: await this.service.updateParentLearningControls(access.context, studentId, body),
        request_id: requestId,
      });
    } catch (error) {
      return sendOperationError(error, response, requestId);
    }
  }

  @Post("parent/learning/:studentId/contact")
  public async recordParentLearningContact(
    @Param("studentId") studentId: string,
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = await this.authorize(request, "binding:read");
    if (!access.ok) return this.sendAccessError(response, requestId, access);
    if (!UUID.test(studentId) || !hasNoQuery(request))
      return response.status(400).json({
        error: { code: "VALIDATION_FAILED", message: "Request is invalid." },
        request_id: requestId,
      });
    try {
      return response.status(201).json({
        data: await this.service.recordParentLearningContact(access.context, studentId, body),
        request_id: requestId,
      });
    } catch (error) {
      return sendOperationError(error, response, requestId);
    }
  }

  @Post("staff/learning-summaries")
  public async submitStaffSummary(
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = await this.authorize(request, "learning:summary");
    if (!access.ok) return this.sendAccessError(response, requestId, access);
    if (!hasNoQuery(request))
      return response.status(400).json({
        error: { code: "VALIDATION_FAILED", message: "Request is invalid." },
        request_id: requestId,
      });
    try {
      return response.status(201).json({
        data: await this.service.submitStaffSummary(access.context, body),
        request_id: requestId,
      });
    } catch (error) {
      return sendOperationError(error, response, requestId);
    }
  }
}
