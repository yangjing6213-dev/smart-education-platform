import { resolveAuthContext } from "@student-care/auth";
import { Body, Controller, Get, Inject, Param, Post, Req, Res } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { containsForgedIdentityClaim } from "../plugins/forged-identity-claims.js";
import {
  PARENT_GOVERNANCE_OPERATIONS,
  TRUSTED_AUTH_PROVIDER,
  type ApiHttpRequest,
  type ApiHttpResponse,
  type ParentGovernanceMember,
  type ParentGovernanceOperations,
  type TrustedAuthProvider,
} from "./api-tokens.js";

type Capability = "binding:apply" | "binding:read";
type AccessResult =
  | { readonly ok: true; readonly member: ParentGovernanceMember }
  | {
      readonly ok: false;
      readonly status: 400 | 401 | 403;
      readonly code: "VALIDATION_FAILED" | "UNAUTHENTICATED" | "FORBIDDEN_SCOPE";
      readonly message: string;
    };

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
  return { ok: false, status: 400, code: "VALIDATION_FAILED", message: "Request is invalid." };
}

function hasNoQuery(request: ApiHttpRequest): boolean {
  return Object.keys(request.query).length === 0;
}

function isUnsupportedScopeHeader(request: ApiHttpRequest): boolean {
  return (
    request.headers["x-tenant-id"] !== undefined || request.headers["x-campus-id"] !== undefined
  );
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
}

function errorBody(code: string, requestId: string) {
  return { error: { code, message: "本机家长服务暂不可用。" }, request_id: requestId };
}

function sendOperationError(error: unknown, response: ApiHttpResponse, requestId: string): unknown {
  const status =
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    [400, 403, 409].includes(Number(error.statusCode))
      ? (Number(error.statusCode) as 400 | 403 | 409)
      : 500;
  const code =
    typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
      ? error.code
      : "INTERNAL_ERROR";
  return response.status(status).json(errorBody(code, requestId));
}

@Controller()
export class ParentGovernanceController {
  public constructor(
    @Inject(PARENT_GOVERNANCE_OPERATIONS)
    private readonly service: ParentGovernanceOperations,
    @Inject(TRUSTED_AUTH_PROVIDER)
    private readonly getTrustedAuthResult: TrustedAuthProvider,
  ) {}

  private async authorize(request: ApiHttpRequest, capability: Capability): Promise<AccessResult> {
    if (containsForgedIdentityClaim(request.query, request.headers)) return accessError(401);
    if (isUnsupportedScopeHeader(request)) return accessError(400);
    const auth = resolveAuthContext(await this.getTrustedAuthResult(request));
    if (!auth.ok) return accessError(401);

    const members = auth.context.memberships
      .filter((membership) => {
        const capabilities: readonly string[] = membership.capabilities;
        return membership.status === "ACTIVE" && capabilities.includes(capability);
      })
      .flatMap((membership) =>
        membership.campus_ids
          .map((campusId) =>
            this.service.resolveMember({
              actorId: auth.context.identity.actor_id,
              tenantId: membership.tenant_id,
              campusId,
              capabilities: membership.capabilities,
            }),
          )
          .filter(
            (member): member is ParentGovernanceMember =>
              member !== undefined && member.actions.includes(capability),
          ),
      );
    if (members.length !== 1) return accessError(403);
    return { ok: true, member: members[0]! };
  }

  private sendAccessError(
    response: ApiHttpResponse,
    requestId: string,
    access: Extract<AccessResult, { readonly ok: false }>,
  ): unknown {
    return response.status(access.status).json({
      error: { code: access.code, message: access.message },
      request_id: requestId,
    });
  }

  private async authorizePickup(
    request: ApiHttpRequest,
    operation: "read" | "write",
  ): Promise<AccessResult> {
    const access = await this.authorize(
      request,
      operation === "read" ? "binding:read" : "binding:apply",
    );
    if (!access.ok) return access;
    if (
      !access.member.actions.includes("pickup:read") ||
      !access.member.actions.includes("pickup:authorize")
    )
      return accessError(403);
    return access;
  }

  @Get("parent/student-options")
  public async studentOptions(
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = await this.authorize(request, "binding:apply");
    if (!access.ok) return this.sendAccessError(response, requestId, access);
    if (!hasNoQuery(request))
      return response.status(400).json(errorBody("VALIDATION_FAILED", requestId));
    try {
      return response.status(200).json({
        data: this.service.studentOptions(access.member),
        request_id: requestId,
      });
    } catch (error) {
      return sendOperationError(error, response, requestId);
    }
  }

  @Get("parent/fees")
  public async parentFees(
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = await this.authorize(request, "binding:read");
    if (!access.ok) return this.sendAccessError(response, requestId, access);
    if (!hasNoQuery(request))
      return response.status(400).json(errorBody("VALIDATION_FAILED", requestId));
    try {
      return response.status(200).json({
        data: this.service.parentFees(access.member),
        request_id: requestId,
      });
    } catch (error) {
      return sendOperationError(error, response, requestId);
    }
  }

  @Get("parent/pickup")
  public async parentPickup(
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = await this.authorizePickup(request, "read");
    if (!access.ok) return this.sendAccessError(response, requestId, access);
    if (!hasNoQuery(request))
      return response.status(400).json(errorBody("VALIDATION_FAILED", requestId));
    try {
      return response.status(200).json({
        data: this.service.parentPickup(access.member),
        request_id: requestId,
      });
    } catch (error) {
      return sendOperationError(error, response, requestId);
    }
  }

  @Post("parent/pickup/authorizations")
  public async createParentPickupAuthorization(
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = await this.authorizePickup(request, "write");
    if (!access.ok) return this.sendAccessError(response, requestId, access);
    if (!hasNoQuery(request))
      return response.status(400).json(errorBody("VALIDATION_FAILED", requestId));
    try {
      return response.status(201).json({
        data: this.service.createParentPickupAuthorization(access.member, body),
        request_id: requestId,
      });
    } catch (error) {
      return sendOperationError(error, response, requestId);
    }
  }

  @Post("parent/pickup/authorizations/:id/activate")
  public async activateParentPickupAuthorization(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = await this.authorizePickup(request, "write");
    if (!access.ok) return this.sendAccessError(response, requestId, access);
    if (!isUuid(id) || !hasNoQuery(request))
      return response.status(400).json(errorBody("VALIDATION_FAILED", requestId));
    try {
      return response.status(200).json({
        data: this.service.activateParentPickupAuthorization(access.member, id, body),
        request_id: requestId,
      });
    } catch (error) {
      return sendOperationError(error, response, requestId);
    }
  }

  @Post("parent/pickup/authorizations/:id/revoke")
  public async revokeParentPickupAuthorization(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = await this.authorizePickup(request, "write");
    if (!access.ok) return this.sendAccessError(response, requestId, access);
    if (!isUuid(id) || !hasNoQuery(request))
      return response.status(400).json(errorBody("VALIDATION_FAILED", requestId));
    try {
      return response.status(200).json({
        data: this.service.revokeParentPickupAuthorization(access.member, id, body),
        request_id: requestId,
      });
    } catch (error) {
      return sendOperationError(error, response, requestId);
    }
  }

  @Post("parent/pickup/authorizations/:id/credential")
  public async issueParentPickupCredential(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = await this.authorizePickup(request, "write");
    if (!access.ok) return this.sendAccessError(response, requestId, access);
    if (!isUuid(id) || !hasNoQuery(request))
      return response.status(400).json(errorBody("VALIDATION_FAILED", requestId));
    try {
      return response.status(200).json({
        data: this.service.issueParentPickupCredential(access.member, id, body),
        request_id: requestId,
      });
    } catch (error) {
      return sendOperationError(error, response, requestId);
    }
  }

  @Get("parent/monthly-feedback")
  public async parentMonthlyFeedback(
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = await this.authorize(request, "binding:read");
    if (!access.ok) return this.sendAccessError(response, requestId, access);
    if (!hasNoQuery(request))
      return response.status(400).json(errorBody("VALIDATION_FAILED", requestId));
    try {
      return response.status(200).json({
        data: this.service.parentMonthlyFeedback(access.member),
        request_id: requestId,
      });
    } catch (error) {
      return sendOperationError(error, response, requestId);
    }
  }

  @Post("parent/monthly-feedback/:id/ack")
  public async acknowledgeParentMonthlyFeedback(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = await this.authorize(request, "binding:read");
    if (!access.ok) return this.sendAccessError(response, requestId, access);
    if (!isUuid(id) || !hasNoQuery(request))
      return response.status(400).json(errorBody("VALIDATION_FAILED", requestId));
    try {
      return response.status(200).json({
        data: this.service.acknowledgeParentMonthlyFeedback(access.member, id, body),
        request_id: requestId,
      });
    } catch (error) {
      return sendOperationError(error, response, requestId);
    }
  }

  @Get("parent/notices")
  public async parentNotices(
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = await this.authorize(request, "binding:read");
    if (!access.ok) return this.sendAccessError(response, requestId, access);
    if (!hasNoQuery(request))
      return response.status(400).json(errorBody("VALIDATION_FAILED", requestId));
    try {
      return response.status(200).json({
        data: this.service.parentNotices(access.member),
        request_id: requestId,
      });
    } catch (error) {
      return sendOperationError(error, response, requestId);
    }
  }

  @Post("parent/notices/:id/read")
  public async readParentNotice(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = await this.authorize(request, "binding:read");
    if (!access.ok) return this.sendAccessError(response, requestId, access);
    if (!isUuid(id) || !hasNoQuery(request))
      return response.status(400).json(errorBody("VALIDATION_FAILED", requestId));
    try {
      return response.status(200).json({
        data: this.service.readParentNotice(access.member, id, body),
        request_id: requestId,
      });
    } catch (error) {
      return sendOperationError(error, response, requestId);
    }
  }

  @Post("parent/notices/:id/ack")
  public async acknowledgeParentNotice(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = await this.authorize(request, "binding:read");
    if (!access.ok) return this.sendAccessError(response, requestId, access);
    if (!isUuid(id) || !hasNoQuery(request))
      return response.status(400).json(errorBody("VALIDATION_FAILED", requestId));
    try {
      return response.status(200).json({
        data: this.service.acknowledgeParentNotice(access.member, id, body),
        request_id: requestId,
      });
    } catch (error) {
      return sendOperationError(error, response, requestId);
    }
  }

  @Get("parent/health-incidents")
  public async parentHealthIncidents(
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = await this.authorize(request, "binding:read");
    if (!access.ok) return this.sendAccessError(response, requestId, access);
    if (!hasNoQuery(request))
      return response.status(400).json(errorBody("VALIDATION_FAILED", requestId));
    try {
      return response.status(200).json({
        data: this.service.parentHealthIncidents(access.member),
        request_id: requestId,
      });
    } catch (error) {
      return sendOperationError(error, response, requestId);
    }
  }

  @Post("parent/health-incidents/:id/read")
  public async readParentHealthIncident(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = await this.authorize(request, "binding:read");
    if (!access.ok) return this.sendAccessError(response, requestId, access);
    if (!isUuid(id) || !hasNoQuery(request))
      return response.status(400).json(errorBody("VALIDATION_FAILED", requestId));
    try {
      return response.status(200).json({
        data: this.service.readParentHealthIncident(access.member, id, body),
        request_id: requestId,
      });
    } catch (error) {
      return sendOperationError(error, response, requestId);
    }
  }

  @Post("parent/health-incidents/:id/ack")
  public async acknowledgeParentHealthIncident(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = await this.authorize(request, "binding:read");
    if (!access.ok) return this.sendAccessError(response, requestId, access);
    if (!isUuid(id) || !hasNoQuery(request))
      return response.status(400).json(errorBody("VALIDATION_FAILED", requestId));
    try {
      return response.status(200).json({
        data: this.service.acknowledgeParentHealthIncident(access.member, id, body),
        request_id: requestId,
      });
    } catch (error) {
      return sendOperationError(error, response, requestId);
    }
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
      return response.status(400).json(errorBody("VALIDATION_FAILED", requestId));
    try {
      return response.status(200).json({
        data: this.service.parentLearning(access.member),
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
    if (!isUuid(studentId) || !hasNoQuery(request))
      return response.status(400).json(errorBody("VALIDATION_FAILED", requestId));
    try {
      return response.status(200).json({
        data: this.service.updateParentLearningControls(access.member, studentId, body),
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
    if (!isUuid(studentId) || !hasNoQuery(request))
      return response.status(400).json(errorBody("VALIDATION_FAILED", requestId));
    try {
      return response.status(201).json({
        data: this.service.recordParentLearningContact(access.member, studentId, body),
        request_id: requestId,
      });
    } catch (error) {
      return sendOperationError(error, response, requestId);
    }
  }

  @Get("consent-policies")
  public async policies(
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = await this.authorize(request, "binding:read");
    if (!access.ok) return this.sendAccessError(response, requestId, access);
    if (!hasNoQuery(request))
      return response.status(400).json(errorBody("VALIDATION_FAILED", requestId));
    try {
      return response.status(200).json({
        data: this.service.policies(access.member),
        request_id: requestId,
      });
    } catch (error) {
      return sendOperationError(error, response, requestId);
    }
  }

  @Get("consents")
  public async listConsents(
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = await this.authorize(request, "binding:read");
    if (!access.ok) return this.sendAccessError(response, requestId, access);
    if (!hasNoQuery(request))
      return response.status(400).json(errorBody("VALIDATION_FAILED", requestId));
    try {
      return response.status(200).json({
        data: this.service.listConsents(access.member),
        request_id: requestId,
      });
    } catch (error) {
      return sendOperationError(error, response, requestId);
    }
  }

  @Post("consents")
  public async createConsent(
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = await this.authorize(request, "binding:apply");
    if (!access.ok) return this.sendAccessError(response, requestId, access);
    if (!hasNoQuery(request))
      return response.status(400).json(errorBody("VALIDATION_FAILED", requestId));
    try {
      return response.status(201).json({
        data: this.service.createConsent(access.member, body),
        request_id: requestId,
      });
    } catch (error) {
      return sendOperationError(error, response, requestId);
    }
  }

  @Post("consents/:consentId/revoke")
  public async revokeConsent(
    @Param("consentId") consentId: string,
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = await this.authorize(request, "binding:apply");
    if (!access.ok) return this.sendAccessError(response, requestId, access);
    if (!hasNoQuery(request) || !isUuid(consentId))
      return response.status(400).json(errorBody("VALIDATION_FAILED", requestId));
    try {
      return response.status(200).json({
        data: this.service.revokeConsent(access.member, consentId, body),
        request_id: requestId,
      });
    } catch (error) {
      return sendOperationError(error, response, requestId);
    }
  }

  @Get("privacy-requests")
  public async listPrivacyRequests(
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = await this.authorize(request, "binding:read");
    if (!access.ok) return this.sendAccessError(response, requestId, access);
    if (!hasNoQuery(request))
      return response.status(400).json(errorBody("VALIDATION_FAILED", requestId));
    try {
      return response.status(200).json({
        data: this.service.listPrivacyRequests(access.member),
        request_id: requestId,
      });
    } catch (error) {
      return sendOperationError(error, response, requestId);
    }
  }

  @Post("privacy-requests")
  public async createPrivacyRequest(
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = await this.authorize(request, "binding:apply");
    if (!access.ok) return this.sendAccessError(response, requestId, access);
    if (!hasNoQuery(request))
      return response.status(400).json(errorBody("VALIDATION_FAILED", requestId));
    try {
      return response.status(201).json({
        data: this.service.createPrivacyRequest(access.member, body),
        request_id: requestId,
      });
    } catch (error) {
      return sendOperationError(error, response, requestId);
    }
  }

  @Post("privacy-requests/:requestId/withdraw")
  public async withdrawPrivacyRequest(
    @Param("requestId") requestIdValue: string,
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = await this.authorize(request, "binding:apply");
    if (!access.ok) return this.sendAccessError(response, requestId, access);
    if (!hasNoQuery(request) || !isUuid(requestIdValue))
      return response.status(400).json(errorBody("VALIDATION_FAILED", requestId));
    try {
      return response.status(200).json({
        data: this.service.withdrawPrivacyRequest(access.member, requestIdValue, body),
        request_id: requestId,
      });
    } catch (error) {
      return sendOperationError(error, response, requestId);
    }
  }
}
