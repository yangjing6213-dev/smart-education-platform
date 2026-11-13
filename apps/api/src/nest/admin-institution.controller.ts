import { activeMemberships, resolveAuthContext } from "@student-care/auth";
import type { InstitutionAdminRouteKind } from "@student-care/contracts";
import { resolveScope } from "@student-care/tenant";
import { Body, Controller, Get, Inject, Param, Post, Put, Req, Res } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { ContentOperationResult, DraftPayload } from "../modules/content/content.service.js";
import type {
  InstitutionActorContext,
  InstitutionServiceOperations,
} from "../modules/institution/institution.service.js";
import { containsForgedIdentityClaim } from "../plugins/forged-identity-claims.js";
import {
  INSTITUTION_SERVICE,
  TRUSTED_AUTH_PROVIDER,
  type ApiHttpRequest,
  type ApiHttpResponse,
  type TrustedAuthProvider,
} from "./api-tokens.js";

const BODY_KEYS = new Set(["payload", "expected_version"]);
const PAYLOAD_KEYS = new Set([
  "title",
  "type",
  "visibility",
  "body",
  "editor_note",
  "moderation_state",
  "tenant_admin_note",
  "campus_admin_note",
]);

type AccessResult =
  | { readonly ok: true; readonly context: InstitutionActorContext }
  | {
      readonly ok: false;
      readonly status: 401 | 403;
      readonly code: "UNAUTHENTICATED" | "FORBIDDEN_SCOPE";
      readonly message: string;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function routeKind(value: unknown): InstitutionAdminRouteKind | undefined {
  return value === "profile" || value === "home" ? value : undefined;
}

function errorBody(code: string, message: string, requestId: string) {
  return { error: { code, message }, request_id: requestId };
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

function institutionContext(
  authResult: unknown,
  request: ApiHttpRequest,
  requestId: string,
): AccessResult {
  if (containsForgedIdentityClaim(request.query, request.headers)) return denied(401);

  const auth = resolveAuthContext(authResult);
  if (!auth.ok) return denied(401);
  if (activeMemberships(auth).length === 0) return denied(403);

  const requestedTenant = request.query.tenant_id;
  if (requestedTenant !== undefined && typeof requestedTenant !== "string") return denied(403);
  const requestedTenantId = typeof requestedTenant === "string" ? requestedTenant : undefined;
  const requestedCampus = request.query.campus_id;
  const requestedCampusId = typeof requestedCampus === "string" ? requestedCampus : undefined;
  const memberships = auth.context.memberships.filter(
    (membership) => membership.status === "ACTIVE",
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
  if (membership === undefined || !scope.ok) return denied(403);

  return {
    ok: true,
    context: {
      trusted: true,
      actorId: scope.scopeContext.actorId,
      activeMembership: true,
      scope: {
        tenantId: scope.scopeContext.tenantId,
        ...(scope.scopeContext.campusId === undefined
          ? {}
          : { campusId: scope.scopeContext.campusId }),
      },
      capabilities: membership.capabilities,
      ...(scope.scopeContext.campusId === undefined
        ? {}
        : { auditCampusId: scope.scopeContext.campusId }),
      requestCorrelationId: requestId,
      traceId: requestId,
    },
  };
}

function validDraftBody(
  value: unknown,
  requiresVersion: boolean,
): value is { payload: DraftPayload; expected_version?: number | null } {
  if (!isRecord(value) || Object.keys(value).some((key) => !BODY_KEYS.has(key))) return false;
  if (
    !isRecord(value.payload) ||
    Object.keys(value.payload).some((key) => !PAYLOAD_KEYS.has(key))
  ) {
    return false;
  }
  if (
    requiresVersion &&
    (typeof value.expected_version !== "number" || !Number.isInteger(value.expected_version))
  ) {
    return false;
  }
  return (
    value.expected_version === undefined ||
    value.expected_version === null ||
    (typeof value.expected_version === "number" && Number.isInteger(value.expected_version))
  );
}

function validPublicationBody(value: unknown): value is { expected_version: number } {
  return (
    isRecord(value) &&
    Object.keys(value).length === 1 &&
    Object.keys(value)[0] === "expected_version" &&
    typeof value.expected_version === "number" &&
    Number.isInteger(value.expected_version)
  );
}

function statusFor<T>(result: ContentOperationResult<T>): number {
  if (result.ok) return 200;
  if (result.error.code === "VALIDATION_FAILED") return 400;
  if (result.error.code === "NOT_FOUND_SCOPED") return 404;
  if (result.error.code === "VERSION_MISMATCH" || result.error.code === "CONFLICT_STATE")
    return 409;
  return 403;
}

function sendResult<T>(
  request: ApiHttpResponse,
  requestId: string,
  result: ContentOperationResult<T>,
  successStatus = 200,
) {
  if (!result.ok) {
    return request.status(statusFor(result)).json({ error: result.error, request_id: requestId });
  }
  return request.status(successStatus).json({ data: result.data, request_id: requestId });
}

function sendAccessError(response: ApiHttpResponse, requestId: string, access: AccessResult) {
  if (access.ok) return undefined;
  return response.status(access.status).json(errorBody(access.code, access.message, requestId));
}

@Controller("admin/institution")
export class AdminInstitutionController {
  public constructor(
    @Inject(INSTITUTION_SERVICE) private readonly institutionService: InstitutionServiceOperations,
    @Inject(TRUSTED_AUTH_PROVIDER) private readonly getTrustedAuthResult: TrustedAuthProvider,
  ) {}

  @Get(":kind/:contentKey/draft")
  public async readDraft(
    @Param("kind") kindValue: string,
    @Param("contentKey") contentKey: string,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = institutionContext(await this.getTrustedAuthResult(request), request, requestId);
    if (!access.ok) return sendAccessError(response, requestId, access);
    if (!access.context.capabilities.includes("content:write"))
      return sendAccessError(response, requestId, denied(403));

    const kind = routeKind(kindValue);
    if (kind === undefined) {
      return response
        .status(400)
        .json(errorBody("VALIDATION_FAILED", "Content input is invalid.", requestId));
    }
    const result =
      kind === "profile"
        ? await this.institutionService.readInstitutionDraft(access.context, contentKey)
        : await this.institutionService.readHomeDraft(access.context, contentKey);
    return sendResult(response, requestId, result);
  }

  @Post(":kind/:contentKey/draft")
  public async createDraft(
    @Param("kind") kindValue: string,
    @Param("contentKey") contentKey: string,
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = institutionContext(await this.getTrustedAuthResult(request), request, requestId);
    if (!access.ok) return sendAccessError(response, requestId, access);

    const kind = routeKind(kindValue);
    if (kind === undefined || !validDraftBody(body, false)) {
      return response
        .status(400)
        .json(errorBody("VALIDATION_FAILED", "Content input is invalid.", requestId));
    }

    const result =
      kind === "profile"
        ? await this.institutionService.createInstitutionDraft(
            access.context,
            contentKey,
            body.payload,
            body.expected_version ?? null,
          )
        : await this.institutionService.createHomeDraft(
            access.context,
            contentKey,
            body.payload,
            body.expected_version ?? null,
          );
    return sendResult(response, requestId, result, 201);
  }

  @Put(":kind/:contentKey/draft")
  public async updateDraft(
    @Param("kind") kindValue: string,
    @Param("contentKey") contentKey: string,
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = institutionContext(await this.getTrustedAuthResult(request), request, requestId);
    if (!access.ok) return sendAccessError(response, requestId, access);

    const kind = routeKind(kindValue);
    if (kind === undefined || !validDraftBody(body, true)) {
      return response
        .status(400)
        .json(errorBody("VALIDATION_FAILED", "Content input is invalid.", requestId));
    }

    const result =
      kind === "profile"
        ? await this.institutionService.updateInstitutionDraft(
            access.context,
            contentKey,
            body.payload,
            body.expected_version!,
          )
        : await this.institutionService.updateHomeDraft(
            access.context,
            contentKey,
            body.payload,
            body.expected_version!,
          );
    return sendResult(response, requestId, result);
  }

  @Post(":kind/:contentKey/publish")
  public async publish(
    @Param("kind") kindValue: string,
    @Param("contentKey") contentKey: string,
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = institutionContext(await this.getTrustedAuthResult(request), request, requestId);
    if (!access.ok) return sendAccessError(response, requestId, access);

    const kind = routeKind(kindValue);
    if (kind === undefined || !validPublicationBody(body)) {
      return response
        .status(400)
        .json(errorBody("VALIDATION_FAILED", "Content input is invalid.", requestId));
    }
    const result =
      kind === "profile"
        ? await this.institutionService.publishInstitution(
            access.context,
            contentKey,
            body.expected_version,
          )
        : await this.institutionService.publishHome(
            access.context,
            contentKey,
            body.expected_version,
          );
    return sendResult(response, requestId, result);
  }

  @Post(":kind/:contentKey/unpublish")
  public async unpublish(
    @Param("kind") kindValue: string,
    @Param("contentKey") contentKey: string,
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = institutionContext(await this.getTrustedAuthResult(request), request, requestId);
    if (!access.ok) return sendAccessError(response, requestId, access);

    const kind = routeKind(kindValue);
    if (kind === undefined || !validPublicationBody(body)) {
      return response
        .status(400)
        .json(errorBody("VALIDATION_FAILED", "Content input is invalid.", requestId));
    }
    const result =
      kind === "profile"
        ? await this.institutionService.unpublishInstitution(
            access.context,
            contentKey,
            body.expected_version,
          )
        : await this.institutionService.unpublishHome(
            access.context,
            contentKey,
            body.expected_version,
          );
    return sendResult(response, requestId, result);
  }
}
