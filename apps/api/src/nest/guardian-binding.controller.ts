import { resolveAuthContext, type AuthResolution } from "@student-care/auth";
import type {
  GuardianBindingApplicationInput,
  GuardianBindingApplicationReviewInput,
  GuardianRelationshipReleaseInput,
} from "@student-care/contracts";
import { resolveScope, type ScopeContext } from "@student-care/tenant";
import { Body, Controller, Get, Inject, Param, Post, Req, Res } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { containsForgedIdentityClaim } from "../plugins/forged-identity-claims.js";
import {
  GUARDIAN_BINDING_SERVICE,
  type GuardianBindingContext,
  type GuardianBindingOperations,
  type GuardianBindingResult,
} from "../modules/guardian-bindings/guardian-binding.service.js";
import {
  TRUSTED_AUTH_PROVIDER,
  type ApiHttpRequest,
  type ApiHttpResponse,
  type TrustedAuthProvider,
} from "./api-tokens.js";

type Capability = "binding:apply" | "binding:read" | "binding:review";
type AccessResult =
  | { readonly ok: true; readonly context: GuardianBindingContext }
  | {
      readonly ok: false;
      readonly status: 400 | 401 | 403;
      readonly code: "VALIDATION_FAILED" | "UNAUTHENTICATED" | "FORBIDDEN_SCOPE";
      readonly message: string;
    };

function accessError(status: 400 | 401 | 403): Extract<AccessResult, { readonly ok: false }> {
  if (status === 401) {
    return {
      ok: false,
      status,
      code: "UNAUTHENTICATED",
      message: "Authentication is required.",
    };
  }
  if (status === 403) {
    return {
      ok: false,
      status,
      code: "FORBIDDEN_SCOPE",
      message: "Scope access is not permitted.",
    };
  }
  return { ok: false, status: 400, code: "VALIDATION_FAILED", message: "Request is invalid." };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

function bodyInput(value: unknown): GuardianBindingApplicationInput | undefined {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ["student_candidate_ref", "relationship", "consent"])
  ) {
    return undefined;
  }
  if (
    !isUuid(value.student_candidate_ref) ||
    value.relationship !== "GUARDIAN" ||
    value.consent !== true
  ) {
    return undefined;
  }
  return {
    student_candidate_ref: value.student_candidate_ref,
    relationship: "GUARDIAN",
    consent: true,
  };
}

function reviewInput(value: unknown): GuardianBindingApplicationReviewInput | undefined {
  if (!isRecord(value) || !hasOnlyKeys(value, ["version", "action"])) return undefined;
  if (!Number.isInteger(value.version) || (value.version as number) < 1) return undefined;
  if (value.action !== "approve" && value.action !== "reject") return undefined;
  return { version: value.version as number, action: value.action };
}

function releaseInput(value: unknown): GuardianRelationshipReleaseInput | undefined {
  if (!isRecord(value) || !hasOnlyKeys(value, ["version"])) return undefined;
  if (!Number.isInteger(value.version) || (value.version as number) < 1) return undefined;
  return { version: value.version as number };
}

function scopeContexts(
  auth: AuthResolution,
  capability: Capability,
): GuardianBindingContext | undefined {
  if (!auth.ok) return undefined;
  const actorId = auth.context.identity.actor_id;
  const scopes: ScopeContext[] = auth.context.memberships
    .filter(
      (membership) =>
        membership.status === "ACTIVE" && membership.capabilities.includes(capability),
    )
    .flatMap((membership) =>
      membership.campus_ids.flatMap((campusId) => {
        const scope = resolveScope({
          trustedActor: { actorId },
          membership: {
            tenantId: membership.tenant_id,
            campusIds: membership.campus_ids,
            status: "ACTIVE",
          },
          requestedCampusId: campusId,
        });
        return scope.ok ? [scope.scopeContext] : [];
      }),
    );
  return scopes.length === 0
    ? undefined
    : { scopes, applicantDisplayName: auth.context.identity.display_name };
}

function errorBody(code: string, message: string, requestId: string) {
  return { error: { code, message }, request_id: requestId };
}

function isUnsupportedScopeHeader(request: ApiHttpRequest): boolean {
  return (
    request.headers["x-tenant-id"] !== undefined || request.headers["x-campus-id"] !== undefined
  );
}

function sendResult<T>(
  result: GuardianBindingResult<T>,
  response: ApiHttpResponse,
  requestId: string,
  successStatus = 200,
): unknown {
  if (!result.ok) {
    const status =
      result.error.code === "NOT_FOUND_SCOPED"
        ? 404
        : result.error.code === "VERSION_MISMATCH" || result.error.code === "CONFLICT_STATE"
          ? 409
          : 403;
    return response.status(status).json({ error: result.error, request_id: requestId });
  }
  return response.status(successStatus).json({ data: result.data, request_id: requestId });
}

async function authorizeBindingRequest(
  request: ApiHttpRequest,
  capability: Capability,
  getTrustedAuthResult: TrustedAuthProvider,
): Promise<AccessResult> {
  if (containsForgedIdentityClaim(request.query, request.headers)) return accessError(401);
  if (isUnsupportedScopeHeader(request)) return accessError(400);
  const auth = resolveAuthContext(await getTrustedAuthResult(request));
  const context = scopeContexts(auth, capability);
  if (context === undefined) return accessError(auth.ok ? 403 : 401);
  return { ok: true, context };
}

function sendBindingAccessError(
  response: ApiHttpResponse,
  requestId: string,
  access: Extract<AccessResult, { readonly ok: false }>,
): unknown {
  return response.status(access.status).json(errorBody(access.code, access.message, requestId));
}

@Controller()
export class GuardianBindingController {
  public constructor(
    @Inject(GUARDIAN_BINDING_SERVICE) private readonly service: GuardianBindingOperations,
    @Inject(TRUSTED_AUTH_PROVIDER) private readonly getTrustedAuthResult: TrustedAuthProvider,
  ) {}

  @Post("guardian-binding/applications")
  public async submit(
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = await authorizeBindingRequest(
      request,
      "binding:apply",
      this.getTrustedAuthResult,
    );
    if (!access.ok) return sendBindingAccessError(response, requestId, access);
    if (Object.keys(request.query).length > 0) {
      return response
        .status(400)
        .json(errorBody("VALIDATION_FAILED", "Request is invalid.", requestId));
    }
    const input = bodyInput(body);
    if (input === undefined) {
      return response
        .status(400)
        .json(errorBody("VALIDATION_FAILED", "Request is invalid.", requestId));
    }
    return sendResult(await this.service.submit(access.context, input), response, requestId, 201);
  }

  @Get("guardian-binding/applications")
  public async listMine(
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = await authorizeBindingRequest(
      request,
      "binding:read",
      this.getTrustedAuthResult,
    );
    if (!access.ok) return sendBindingAccessError(response, requestId, access);
    if (Object.keys(request.query).length > 0) {
      return response
        .status(400)
        .json(errorBody("VALIDATION_FAILED", "Request is invalid.", requestId));
    }
    return response.status(200).json({
      data: await this.service.listApplications(access.context),
      request_id: requestId,
    });
  }

  @Get("guardian-relationships")
  public async listRelationships(
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = await authorizeBindingRequest(
      request,
      "binding:read",
      this.getTrustedAuthResult,
    );
    if (!access.ok) return sendBindingAccessError(response, requestId, access);
    if (Object.keys(request.query).length > 0) {
      return response
        .status(400)
        .json(errorBody("VALIDATION_FAILED", "Request is invalid.", requestId));
    }
    return response.status(200).json({
      data: await this.service.listRelationships(access.context),
      request_id: requestId,
    });
  }

  @Post("guardian-relationships/:relationshipId/release")
  public async releaseRelationship(
    @Param("relationshipId") relationshipId: string,
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = await authorizeBindingRequest(
      request,
      "binding:apply",
      this.getTrustedAuthResult,
    );
    if (!access.ok) return sendBindingAccessError(response, requestId, access);
    if (Object.keys(request.query).length > 0 || !isUuid(relationshipId)) {
      return response
        .status(400)
        .json(errorBody("VALIDATION_FAILED", "Request is invalid.", requestId));
    }
    const input = releaseInput(body);
    if (input === undefined) {
      return response
        .status(400)
        .json(errorBody("VALIDATION_FAILED", "Request is invalid.", requestId));
    }
    return sendResult(
      await this.service.release(access.context, relationshipId, input),
      response,
      requestId,
    );
  }

  @Get("staff/guardian-binding/applications")
  public async listPending(
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = await authorizeBindingRequest(
      request,
      "binding:review",
      this.getTrustedAuthResult,
    );
    if (!access.ok) return sendBindingAccessError(response, requestId, access);
    if (Object.keys(request.query).length > 0) {
      return response
        .status(400)
        .json(errorBody("VALIDATION_FAILED", "Request is invalid.", requestId));
    }
    const data = this.service.listPendingForReview
      ? await this.service.listPendingForReview(access.context)
      : (await this.service.listPending(access.context)).map((application) => ({
          id: application.id,
          relationship: application.relationship,
          status: application.status,
          version: application.version,
          submitted_at: application.submitted_at,
          reviewed_at: application.reviewed_at,
          applicant_label: "申请人信息待补充",
          student_label: "学生信息待补充",
        }));
    return response.status(200).json({ data, request_id: requestId });
  }

  @Post("staff/guardian-binding/applications/:applicationId/review")
  public async review(
    @Param("applicationId") applicationId: string,
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = await authorizeBindingRequest(
      request,
      "binding:review",
      this.getTrustedAuthResult,
    );
    if (!access.ok) return sendBindingAccessError(response, requestId, access);
    if (Object.keys(request.query).length > 0 || !isUuid(applicationId)) {
      return response
        .status(400)
        .json(errorBody("VALIDATION_FAILED", "Request is invalid.", requestId));
    }
    const input = reviewInput(body);
    if (input === undefined) {
      return response
        .status(400)
        .json(errorBody("VALIDATION_FAILED", "Request is invalid.", requestId));
    }
    return sendResult(
      await this.service.review(access.context, applicationId, input),
      response,
      requestId,
    );
  }
}

@Controller()
export class GuardianBindingStudentOptionsController {
  public constructor(
    @Inject(GUARDIAN_BINDING_SERVICE) private readonly service: GuardianBindingOperations,
    @Inject(TRUSTED_AUTH_PROVIDER) private readonly getTrustedAuthResult: TrustedAuthProvider,
  ) {}

  @Get("parent/student-options")
  public async studentOptions(
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = await authorizeBindingRequest(
      request,
      "binding:apply",
      this.getTrustedAuthResult,
    );
    if (!access.ok) return sendBindingAccessError(response, requestId, access);
    if (Object.keys(request.query).length > 0) {
      return response
        .status(400)
        .json(errorBody("VALIDATION_FAILED", "Request is invalid.", requestId));
    }
    const data = this.service.listStudentOptions
      ? await this.service.listStudentOptions(access.context)
      : [];
    return response.status(200).json({ data, request_id: requestId });
  }
}
