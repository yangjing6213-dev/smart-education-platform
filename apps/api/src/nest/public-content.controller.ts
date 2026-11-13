import { activeMemberships, resolveAuthContext, type AuthContext } from "@student-care/auth";
import { resolveScope } from "@student-care/tenant";
import { Controller, Get, Inject, Param, Req, Res } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { ContentActorContext, ContentService } from "../modules/content/content.service.js";
import { containsForgedIdentityClaim } from "../plugins/forged-identity-claims.js";
import {
  CONTENT_SERVICE,
  TRUSTED_AUTH_PROVIDER,
  type ApiHttpRequest,
  type ApiHttpResponse,
  type TrustedAuthProvider,
} from "./api-tokens.js";

const FORBIDDEN_CONTENT_QUERY_FIELDS = ["version", "publication", "status", "role"];

function errorBody(code: string, message: string, requestId: string) {
  return { error: { code, message }, request_id: requestId };
}

function activeMembershipForScope(authContext: AuthContext, request: ApiHttpRequest) {
  const query = request.query;
  const requestedTenantId = query.tenant_id;
  const requestedCampusId = query.campus_id;
  const requestedCampusIdValue =
    typeof requestedCampusId === "string" ? requestedCampusId : undefined;
  return (
    authContext.memberships.find(
      (membership) =>
        membership.status === "ACTIVE" &&
        membership.tenant_id === requestedTenantId &&
        (requestedCampusIdValue === undefined ||
          membership.campus_ids.includes(requestedCampusIdValue)),
    ) ??
    (requestedTenantId === undefined
      ? authContext.memberships.find(
          (membership) =>
            membership.status === "ACTIVE" &&
            (requestedCampusIdValue === undefined ||
              membership.campus_ids.includes(requestedCampusIdValue)),
        )
      : undefined)
  );
}

@Controller("public-content")
export class PublicContentController {
  public constructor(
    @Inject(CONTENT_SERVICE) private readonly contentService: ContentService,
    @Inject(TRUSTED_AUTH_PROVIDER) private readonly getTrustedAuthResult: TrustedAuthProvider,
  ) {}

  @Get(":contentKey")
  public async getPublicContent(
    @Param("contentKey") contentKey: string,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    if (containsForgedIdentityClaim(request.query, request.headers)) {
      return response
        .status(401)
        .json(errorBody("UNAUTHENTICATED", "Authentication is required.", requestId));
    }

    const authResolution = resolveAuthContext(await this.getTrustedAuthResult(request));
    if (!authResolution.ok) {
      return response
        .status(401)
        .json(errorBody("UNAUTHENTICATED", "Authentication is required.", requestId));
    }
    const authContext = authResolution.context;
    if (activeMemberships(authResolution).length === 0) {
      return response
        .status(403)
        .json(errorBody("FORBIDDEN_SCOPE", "Scope access is not permitted.", requestId));
    }

    const membership = activeMembershipForScope(authContext, request);
    const requestedCampusId = request.query.campus_id;
    const scopeResolution = resolveScope({
      trustedActor: { actorId: authContext.identity.actor_id },
      membership: membership
        ? {
            tenantId: membership.tenant_id,
            campusIds: membership.campus_ids,
            status: "ACTIVE",
          }
        : undefined,
      requestedTenantId: request.query.tenant_id,
      requestedCampusId: typeof requestedCampusId === "string" ? requestedCampusId : undefined,
    });
    if (!scopeResolution.ok) {
      return response
        .status(403)
        .json(errorBody("FORBIDDEN_SCOPE", "Scope access is not permitted.", requestId));
    }

    if (FORBIDDEN_CONTENT_QUERY_FIELDS.some((field) => field in request.query)) {
      return response
        .status(400)
        .json(errorBody("VALIDATION_FAILED", "Content query claims are not accepted.", requestId));
    }

    const scope = scopeResolution.scopeContext;
    const contentMembership = authContext.memberships.find(
      (candidate) =>
        candidate.status === "ACTIVE" &&
        candidate.tenant_id === scope.tenantId &&
        (scope.campusId === undefined || candidate.campus_ids.includes(scope.campusId)),
    );
    if (contentMembership === undefined) {
      return response
        .status(403)
        .json(errorBody("FORBIDDEN_SCOPE", "Content scope access is not permitted.", requestId));
    }

    const context: ContentActorContext = {
      trusted: true,
      actorId: scope.actorId,
      activeMembership: true,
      scope: {
        tenantId: scope.tenantId,
        ...(scope.campusId === undefined ? {} : { campusId: scope.campusId }),
      },
      capabilities: contentMembership.capabilities,
    };
    const result = this.contentService.readPublic(context, contentKey);
    if (!result.ok) {
      const statusCode = result.error.code === "NOT_FOUND_SCOPED" ? 404 : 403;
      return response.status(statusCode).json({ error: result.error, request_id: requestId });
    }

    return response.status(200).json({ data: result.data, request_id: requestId });
  }
}
