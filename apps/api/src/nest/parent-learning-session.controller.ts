import { resolveAuthContext } from "@student-care/auth";
import { Body, Controller, Get, Inject, Param, Post, Req, Res } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { containsForgedIdentityClaim } from "../plugins/forged-identity-claims.js";
import {
  PARENT_LEARNING_SESSION_OPERATIONS,
  TRUSTED_AUTH_PROVIDER,
  type ApiHttpRequest,
  type ApiHttpResponse,
  type ParentLearningContext,
  type ParentLearningSessionOperations,
  type TrustedAuthProvider,
} from "./api-tokens.js";

type AccessResult =
  | { readonly ok: true; readonly context: ParentLearningContext }
  | {
      readonly ok: false;
      readonly status: 400 | 401 | 403;
      readonly code: string;
      readonly message: string;
    };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function hasNoQuery(request: ApiHttpRequest): boolean {
  return Object.keys(request.query).length === 0;
}

function accessError(status: 400 | 401 | 403): Extract<AccessResult, { readonly ok: false }> {
  if (status === 401)
    return { ok: false, status, code: "UNAUTHENTICATED", message: "Authentication is required." };
  if (status === 403)
    return {
      ok: false,
      status,
      code: "FORBIDDEN_SCOPE",
      message: "Scope access is not permitted.",
    };
  return { ok: false, status, code: "VALIDATION_FAILED", message: "Request is invalid." };
}

function operationFailure(error: unknown): { status: number; code: string } {
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

@Controller()
export class ParentLearningSessionController {
  public constructor(
    @Inject(PARENT_LEARNING_SESSION_OPERATIONS)
    private readonly service: ParentLearningSessionOperations,
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
          membership.status === "ACTIVE" && membership.capabilities.includes("binding:read"),
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

  private async sendOperation<T>(
    response: ApiHttpResponse,
    requestId: string,
    operation: () => Promise<T>,
    successStatus = 200,
  ) {
    try {
      return response
        .status(successStatus)
        .json({ data: await operation(), request_id: requestId });
    } catch (error) {
      const failure = operationFailure(error);
      return response.status(failure.status).json({
        error: { code: failure.code, message: "学习练习暂不可用。" },
        request_id: requestId,
      });
    }
  }

  @Get("parent/students/:studentId/learning-sessions")
  public async listSessions(
    @Param("studentId") studentId: string,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ) {
    const requestId = randomUUID();
    const access = await this.authorize(request);
    if (!access.ok) return this.sendAccessError(response, requestId, access);
    if (!UUID.test(studentId) || !hasNoQuery(request))
      return response.status(400).json({
        error: { code: "VALIDATION_FAILED", message: "Request is invalid." },
        request_id: requestId,
      });
    return this.sendOperation(response, requestId, () =>
      this.service.listSessions(access.context, studentId),
    );
  }

  @Post("parent/students/:studentId/learning-sessions")
  public async createSession(
    @Param("studentId") studentId: string,
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ) {
    const requestId = randomUUID();
    const access = await this.authorize(request);
    if (!access.ok) return this.sendAccessError(response, requestId, access);
    if (!UUID.test(studentId) || !hasNoQuery(request))
      return response.status(400).json({
        error: { code: "VALIDATION_FAILED", message: "Request is invalid." },
        request_id: requestId,
      });
    return this.sendOperation(
      response,
      requestId,
      () => this.service.createSession(access.context, studentId, body),
      201,
    );
  }

  @Get("parent/learning-sessions/:sessionId")
  public async getSession(
    @Param("sessionId") sessionId: string,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ) {
    const requestId = randomUUID();
    const access = await this.authorize(request);
    if (!access.ok) return this.sendAccessError(response, requestId, access);
    if (!UUID.test(sessionId) || !hasNoQuery(request))
      return response.status(400).json({
        error: { code: "VALIDATION_FAILED", message: "Request is invalid." },
        request_id: requestId,
      });
    return this.sendOperation(response, requestId, () =>
      this.service.getSession(access.context, sessionId),
    );
  }

  @Post("parent/learning-sessions/:sessionId/answer")
  public async answerSession(
    @Param("sessionId") sessionId: string,
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ) {
    const requestId = randomUUID();
    const access = await this.authorize(request);
    if (!access.ok) return this.sendAccessError(response, requestId, access);
    if (!UUID.test(sessionId) || !hasNoQuery(request))
      return response.status(400).json({
        error: { code: "VALIDATION_FAILED", message: "Request is invalid." },
        request_id: requestId,
      });
    return this.sendOperation(response, requestId, () =>
      this.service.answerSession(access.context, sessionId, body),
    );
  }

  @Post("parent/learning-sessions/:sessionId/hint")
  public async hintSession(
    @Param("sessionId") sessionId: string,
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ) {
    const requestId = randomUUID();
    const access = await this.authorize(request);
    if (!access.ok) return this.sendAccessError(response, requestId, access);
    if (!UUID.test(sessionId) || !hasNoQuery(request))
      return response.status(400).json({
        error: { code: "VALIDATION_FAILED", message: "Request is invalid." },
        request_id: requestId,
      });
    return this.sendOperation(response, requestId, () =>
      this.service.hintSession(access.context, sessionId, body),
    );
  }

  @Post("parent/learning-sessions/:sessionId/close")
  public async closeSession(
    @Param("sessionId") sessionId: string,
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ) {
    const requestId = randomUUID();
    const access = await this.authorize(request);
    if (!access.ok) return this.sendAccessError(response, requestId, access);
    if (!UUID.test(sessionId) || !hasNoQuery(request))
      return response.status(400).json({
        error: { code: "VALIDATION_FAILED", message: "Request is invalid." },
        request_id: requestId,
      });
    return this.sendOperation(response, requestId, () =>
      this.service.closeSession(access.context, sessionId, body),
    );
  }
}
