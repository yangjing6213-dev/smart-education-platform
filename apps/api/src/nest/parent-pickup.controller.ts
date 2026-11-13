import { resolveAuthContext } from "@student-care/auth";
import { Body, Controller, Get, Inject, Param, Post, Req, Res } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { containsForgedIdentityClaim } from "../plugins/forged-identity-claims.js";
import {
  PARENT_PICKUP_OPERATIONS,
  TRUSTED_AUTH_PROVIDER,
  type ApiHttpRequest,
  type ApiHttpResponse,
  type ParentPickupContext,
  type ParentPickupOperations,
  type TrustedAuthProvider,
} from "./api-tokens.js";

type AccessResult =
  | { readonly ok: true; readonly context: ParentPickupContext }
  | {
      readonly ok: false;
      readonly status: 400 | 401 | 403;
      readonly code: "VALIDATION_FAILED" | "UNAUTHENTICATED" | "FORBIDDEN_SCOPE";
      readonly message: string;
    };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

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

function operationFailure(error: unknown): { readonly status: number; readonly code: string } {
  const status =
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    [400, 403, 404, 409].includes(Number(error.statusCode))
      ? Number(error.statusCode)
      : 500;
  const code =
    typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
      ? error.code
      : "INTERNAL_ERROR";
  return { status, code };
}

function errorBody(code: string, requestId: string) {
  return { error: { code, message: "接送安排暂不可用。" }, request_id: requestId };
}

@Controller()
export class ParentPickupController {
  public constructor(
    @Inject(PARENT_PICKUP_OPERATIONS)
    private readonly service: ParentPickupOperations,
    @Inject(TRUSTED_AUTH_PROVIDER)
    private readonly getTrustedAuthResult: TrustedAuthProvider,
  ) {}

  private async authorize(request: ApiHttpRequest): Promise<AccessResult> {
    if (containsForgedIdentityClaim(request.query, request.headers)) return accessError(401);
    if (
      request.headers["x-tenant-id"] !== undefined ||
      request.headers["x-campus-id"] !== undefined
    )
      return accessError(400);
    const auth = resolveAuthContext(await this.getTrustedAuthResult(request));
    if (!auth.ok) return accessError(401);
    const scopes = auth.context.memberships
      .filter(
        (membership) =>
          membership.status === "ACTIVE" &&
          membership.capabilities.includes("binding:read") &&
          membership.capabilities.includes("binding:apply"),
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

  private async authorizeStaff(request: ApiHttpRequest): Promise<AccessResult> {
    if (containsForgedIdentityClaim(request.query, request.headers)) return accessError(401);
    if (
      request.headers["x-tenant-id"] !== undefined ||
      request.headers["x-campus-id"] !== undefined
    )
      return accessError(400);
    const auth = resolveAuthContext(await this.getTrustedAuthResult(request));
    if (!auth.ok) return accessError(401);
    const scopes = auth.context.memberships
      .filter(
        (membership) =>
          membership.status === "ACTIVE" && membership.capabilities.includes("attendance:write"),
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
    error: Extract<AccessResult, { readonly ok: false }>,
  ) {
    return response
      .status(error.status)
      .json({ error: { code: error.code, message: error.message }, request_id: requestId });
  }

  private async sendOperation(
    response: ApiHttpResponse,
    requestId: string,
    operation: () => Promise<unknown>,
    successStatus = 200,
  ) {
    try {
      return response
        .status(successStatus)
        .json({ data: await operation(), request_id: requestId });
    } catch (error) {
      const failure = operationFailure(error);
      return response.status(failure.status).json(errorBody(failure.code, requestId));
    }
  }

  @Get("parent/pickup")
  public async parentPickup(@Req() request: ApiHttpRequest, @Res() response: ApiHttpResponse) {
    const requestId = randomUUID();
    const access = await this.authorize(request);
    if (!access.ok) return this.sendAccessError(response, requestId, access);
    if (!hasNoQuery(request))
      return response.status(400).json(errorBody("VALIDATION_FAILED", requestId));
    return this.sendOperation(response, requestId, () => this.service.list(access.context));
  }

  @Post("parent/pickup/authorizations")
  public async create(
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ) {
    const requestId = randomUUID();
    const access = await this.authorize(request);
    if (!access.ok) return this.sendAccessError(response, requestId, access);
    if (!hasNoQuery(request))
      return response.status(400).json(errorBody("VALIDATION_FAILED", requestId));
    return this.sendOperation(
      response,
      requestId,
      () => this.service.create(access.context, body),
      201,
    );
  }

  @Post("parent/pickup/authorizations/:authorizationId/activate")
  public async activate(
    @Param("authorizationId") authorizationId: string,
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ) {
    const requestId = randomUUID();
    const access = await this.authorize(request);
    if (!access.ok) return this.sendAccessError(response, requestId, access);
    if (!UUID.test(authorizationId) || !hasNoQuery(request))
      return response.status(400).json(errorBody("VALIDATION_FAILED", requestId));
    return this.sendOperation(response, requestId, () =>
      this.service.activate(access.context, authorizationId, body),
    );
  }

  @Post("parent/pickup/authorizations/:authorizationId/revoke")
  public async revoke(
    @Param("authorizationId") authorizationId: string,
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ) {
    const requestId = randomUUID();
    const access = await this.authorize(request);
    if (!access.ok) return this.sendAccessError(response, requestId, access);
    if (!UUID.test(authorizationId) || !hasNoQuery(request))
      return response.status(400).json(errorBody("VALIDATION_FAILED", requestId));
    return this.sendOperation(response, requestId, () =>
      this.service.revoke(access.context, authorizationId, body),
    );
  }

  @Post("parent/pickup/authorizations/:authorizationId/credential")
  public async issueCredential(
    @Param("authorizationId") authorizationId: string,
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ) {
    const requestId = randomUUID();
    const access = await this.authorize(request);
    if (!access.ok) return this.sendAccessError(response, requestId, access);
    if (!UUID.test(authorizationId) || !hasNoQuery(request))
      return response.status(400).json(errorBody("VALIDATION_FAILED", requestId));
    return this.sendOperation(response, requestId, () =>
      this.service.issueCredential(access.context, authorizationId, body),
    );
  }

  @Post("staff/pickup/credentials/preview")
  public async previewCredential(
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ) {
    const requestId = randomUUID();
    const access = await this.authorizeStaff(request);
    if (!access.ok) return this.sendAccessError(response, requestId, access);
    if (!hasNoQuery(request))
      return response.status(400).json(errorBody("VALIDATION_FAILED", requestId));
    return this.sendOperation(response, requestId, () =>
      this.service.previewCredential(access.context, body),
    );
  }

  @Post("staff/pickup/credentials/confirm")
  public async confirmCredential(
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ) {
    const requestId = randomUUID();
    const access = await this.authorizeStaff(request);
    if (!access.ok) return this.sendAccessError(response, requestId, access);
    if (!hasNoQuery(request))
      return response.status(400).json(errorBody("VALIDATION_FAILED", requestId));
    return this.sendOperation(response, requestId, () =>
      this.service.confirmCredential(access.context, body),
    );
  }
}
