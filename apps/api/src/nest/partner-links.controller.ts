import { activeMemberships, resolveAuthContext, type AuthResolution } from "@student-care/auth";
import { resolveScope } from "@student-care/tenant";
import { Controller, Get, Inject, Param, Req, Res } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import {
  createPartnerLinkMembershipId,
  createPartnerLinkScopeFingerprint,
  type PartnerLinkActorContext,
  type PartnerLinkResult,
  type PartnerLinkService,
} from "../modules/partner-links/partner-link.service.js";
import { containsForgedIdentityClaim } from "../plugins/forged-identity-claims.js";
import {
  PARTNER_LINK_SERVICE,
  TRUSTED_AUTH_PROVIDER,
  type ApiHttpRequest,
  type ApiHttpResponse,
  type TrustedAuthProvider,
} from "./api-tokens.js";

type PartnerAccess =
  | { readonly ok: true; readonly context: PartnerLinkActorContext }
  | {
      readonly ok: false;
      readonly status: 401 | 403;
      readonly code: "UNAUTHENTICATED" | "FORBIDDEN_SCOPE";
      readonly message: string;
    };

function denied(status: 401 | 403): Extract<PartnerAccess, { readonly ok: false }> {
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
        message: "Partner link scope access is not permitted.",
      };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function partnerContext(
  auth: AuthResolution,
  requestId: string,
  query: Record<string, unknown>,
): PartnerAccess {
  if (!auth.ok) return denied(401);
  if (activeMemberships(auth).length === 0) return denied(403);

  const requestedTenantId = query.tenant_id;
  const requestedCampusId = query.campus_id;
  const requestedCampusIdValue =
    typeof requestedCampusId === "string" ? requestedCampusId : undefined;
  const eligibleMemberships = auth.context.memberships.filter(
    (candidate) =>
      candidate.status === "ACTIVE" && candidate.capabilities.includes("content:write"),
  );
  const membership =
    eligibleMemberships.find(
      (candidate) =>
        candidate.tenant_id === requestedTenantId &&
        (requestedCampusIdValue === undefined ||
          candidate.campus_ids.includes(requestedCampusIdValue)),
    ) ??
    (requestedTenantId === undefined
      ? eligibleMemberships.find(
          (candidate) =>
            requestedCampusIdValue === undefined ||
            candidate.campus_ids.includes(requestedCampusIdValue),
        )
      : undefined);
  const campusId = requestedCampusIdValue ?? membership?.campus_ids[0];
  if (membership === undefined || campusId === undefined) return denied(403);
  if (requestedTenantId !== undefined && typeof requestedTenantId !== "string") {
    return denied(403);
  }

  const scope = resolveScope({
    trustedActor: { actorId: auth.context.identity.actor_id },
    membership: {
      tenantId: membership.tenant_id,
      campusIds: membership.campus_ids,
      status: "ACTIVE",
    },
    requestedTenantId,
    requestedCampusId: campusId,
  });
  if (!scope.ok) return denied(403);

  const allowedScopes = auth.context.memberships
    .filter(
      (candidate) =>
        candidate.status === "ACTIVE" && candidate.tenant_id === membership.tenant_id,
    )
    .flatMap((candidate) =>
      candidate.campus_ids.map((allowedCampusId) => ({
        tenantId: membership.tenant_id,
        campusId: allowedCampusId,
      })),
    );
  const membershipId =
    isRecord(membership) && typeof membership.membership_id === "string"
      ? membership.membership_id
      : createPartnerLinkMembershipId({
          actorId: auth.context.identity.actor_id,
          tenantId: membership.tenant_id,
          campusIds: membership.campus_ids,
          membershipStatus: "ACTIVE",
          capabilities: membership.capabilities,
        });
  const roles = membership.capabilities;
  const scopeFingerprint = createPartnerLinkScopeFingerprint({
    actorId: auth.context.identity.actor_id,
    tenantId: membership.tenant_id,
    campusId,
    allowedScopes,
    membershipId,
    membershipStatus: "ACTIVE",
    membershipTenantId: membership.tenant_id,
    membershipCampusIds: membership.campus_ids,
    capabilities: membership.capabilities,
    roles,
  });

  return {
    ok: true,
    context: {
      trusted: true,
      actorId: auth.context.identity.actor_id,
      activeMembership: true,
      scope: { tenantId: membership.tenant_id, campusId },
      allowedScopes,
      membershipId,
      membershipStatus: "ACTIVE",
      membershipTenantId: membership.tenant_id,
      membershipCampusIds: membership.campus_ids,
      capabilities: membership.capabilities,
      roles,
      scopeFingerprint,
      requestCorrelationId: requestId,
    },
  };
}

function statusFor(code: string): number {
  if (code === "VALIDATION_FAILED") return 400;
  if (code === "NOT_FOUND_SCOPED") return 404;
  if (code === "HANDOFF_EXPIRED" || code === "HANDOFF_REUSED") return 409;
  return 403;
}

function sendResult<T>(
  result: PartnerLinkResult<T>,
  response: ApiHttpResponse,
  requestId: string,
): unknown {
  if (!result.ok) {
    return response
      .status(statusFor(result.error.code))
      .json({ error: result.error, request_id: requestId });
  }
  return response.status(200).json({ data: result.data, request_id: requestId });
}

function queryRecord(request: ApiHttpRequest): Record<string, unknown> {
  return isRecord(request.query) ? request.query : {};
}

function hasOnlyKeys(query: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(query).every((key) => keys.includes(key));
}

function searchInput(query: Record<string, unknown>) {
  const limit = query.limit === undefined ? undefined : Number(query.limit);
  return {
    ...(query.query === undefined ? {} : { query: query.query }),
    ...(limit === undefined ? {} : { limit }),
  };
}

@Controller("staff/partner-cloud-links")
export class PartnerLinksController {
  public constructor(
    @Inject(PARTNER_LINK_SERVICE) private readonly service: PartnerLinkService,
    @Inject(TRUSTED_AUTH_PROVIDER) private readonly getTrustedAuthResult: TrustedAuthProvider,
  ) {}

  private async authorize(request: ApiHttpRequest, requestId: string): Promise<PartnerAccess> {
    if (containsForgedIdentityClaim(request.query, request.headers)) return denied(401);
    return partnerContext(
      resolveAuthContext(await this.getTrustedAuthResult(request)),
      requestId,
      queryRecord(request),
    );
  }

  private sendAccessError(
    response: ApiHttpResponse,
    requestId: string,
    access: Extract<PartnerAccess, { readonly ok: false }>,
  ): unknown {
    return response
      .status(access.status)
      .json({ error: { code: access.code, message: access.message }, request_id: requestId });
  }

  @Get()
  public async search(
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = await this.authorize(request, requestId);
    if (!access.ok) return this.sendAccessError(response, requestId, access);
    const query = queryRecord(request);
    if (!hasOnlyKeys(query, ["query", "limit"])) {
      this.service.recordDenial(requestId, "ROUTE_QUERY_VALIDATION", "VALIDATION_FAILED");
      return response.status(400).json({
        error: { code: "VALIDATION_FAILED", message: "Partner link input is invalid." },
        request_id: requestId,
      });
    }
    return sendResult(this.service.search(access.context, searchInput(query)), response, requestId);
  }

  @Get(":linkId/entry-check")
  public async issueEntry(
    @Param("linkId") linkId: string,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = await this.authorize(request, requestId);
    if (!access.ok) return this.sendAccessError(response, requestId, access);
    if (!hasOnlyKeys(queryRecord(request), [])) {
      this.service.recordDenial(
        requestId,
        "ROUTE_QUERY_VALIDATION",
        "VALIDATION_FAILED",
        undefined,
        linkId,
      );
      return response.status(400).json({
        error: { code: "VALIDATION_FAILED", message: "Partner link input is invalid." },
        request_id: requestId,
      });
    }
    return sendResult(this.service.issueEntry(access.context, linkId), response, requestId);
  }
}
