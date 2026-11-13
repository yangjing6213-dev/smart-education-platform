import { activeMemberships, resolveAuthContext, type AuthResolution } from "@student-care/auth";
import { resolveScope } from "@student-care/tenant";
import { Controller, Get, Inject, Param, Req, Res } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type {
  ResourceActorContext,
  ResourceCategory,
  ResourceResult,
  ResourceService,
} from "../modules/resources/resource.service.js";
import { containsForgedIdentityClaim } from "../plugins/forged-identity-claims.js";
import {
  RESOURCE_SERVICE,
  TRUSTED_AUTH_PROVIDER,
  type ApiHttpRequest,
  type ApiHttpResponse,
  type TrustedAuthProvider,
} from "./api-tokens.js";

const RESOURCE_SEARCH_KEYS = ["query", "category", "limit", "cursor"] as const;
const RESOURCE_DETAIL_KEYS = ["version"] as const;

type ResourceAccess =
  | { readonly ok: true; readonly context: ResourceActorContext }
  | {
      readonly ok: false;
      readonly status: 401 | 403;
      readonly code: "UNAUTHENTICATED" | "FORBIDDEN_SCOPE";
      readonly message: string;
    };

function denied(status: 401 | 403): Extract<ResourceAccess, { readonly ok: false }> {
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

function resourceContext(auth: AuthResolution, request: ApiHttpRequest): ResourceAccess {
  if (!auth.ok) return denied(401);
  if (activeMemberships(auth).length === 0) return denied(403);

  const requestedTenantId = request.query.tenant_id;
  const requestedCampusId = request.query.campus_id;
  const requestedCampusIdValue =
    typeof requestedCampusId === "string" ? requestedCampusId : undefined;
  const eligibleMemberships = auth.context.memberships.filter(
    (membership) =>
      membership.status === "ACTIVE" && membership.capabilities.includes("content:write"),
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
      actorId: auth.context.identity.actor_id,
      activeMembership: true,
      scope: { tenantId: membership.tenant_id, campusId },
      capabilities: membership.capabilities,
      roles: membership.capabilities,
    },
  };
}

function errorBody(code: string, message: string, requestId: string) {
  return { error: { code, message }, request_id: requestId };
}

function invalid(response: ApiHttpResponse, requestId: string): unknown {
  return response
    .status(400)
    .json(errorBody("VALIDATION_FAILED", "Resource request is invalid.", requestId));
}

function statusFor<T>(result: ResourceResult<T>): number {
  if (result.ok) return 200;
  if (result.error.code === "VALIDATION_FAILED" || result.error.code === "CURSOR_INVALID") {
    return 400;
  }
  if (result.error.code === "NOT_FOUND_SCOPED" || result.error.code === "FILE_UNAVAILABLE") {
    return 404;
  }
  if (result.error.code === "STALE_VERSION" || result.error.code === "SCOPE_STALE") return 409;
  return 403;
}

function hasOnlyKeys(query: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(query).every((key) => keys.includes(key));
}

function searchInput(query: Record<string, unknown>) {
  const limit = query.limit === undefined ? undefined : Number(query.limit);
  return {
    query: query.query,
    ...(query.category === undefined ? {} : { category: query.category as ResourceCategory }),
    ...(limit === undefined ? {} : { limit }),
    ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
  };
}

function version(query: Record<string, unknown>): number | undefined {
  if (typeof query.version !== "string" || !/^\d+$/.test(query.version)) return undefined;
  return Number(query.version);
}

function sendResult<T>(
  result: ResourceResult<T>,
  response: ApiHttpResponse,
  requestId: string,
): unknown {
  if (!result.ok) {
    return response.status(statusFor(result)).json({ error: result.error, request_id: requestId });
  }
  return response.status(200).json({ data: result.data, request_id: requestId });
}

@Controller("staff/resources")
export class StaffResourcesController {
  public constructor(
    @Inject(RESOURCE_SERVICE) private readonly resourceService: ResourceService,
    @Inject(TRUSTED_AUTH_PROVIDER) private readonly getTrustedAuthResult: TrustedAuthProvider,
  ) {}

  private async authorize(request: ApiHttpRequest): Promise<ResourceAccess> {
    if (containsForgedIdentityClaim(request.query, request.headers)) return denied(401);
    return resourceContext(resolveAuthContext(await this.getTrustedAuthResult(request)), request);
  }

  private sendAccessError(
    response: ApiHttpResponse,
    requestId: string,
    access: Extract<ResourceAccess, { readonly ok: false }>,
  ): unknown {
    return response.status(access.status).json(errorBody(access.code, access.message, requestId));
  }

  @Get()
  public async search(
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = await this.authorize(request);
    if (!access.ok) return this.sendAccessError(response, requestId, access);
    if (!hasOnlyKeys(request.query, RESOURCE_SEARCH_KEYS)) return invalid(response, requestId);
    return sendResult(
      this.resourceService.search(access.context, searchInput(request.query)),
      response,
      requestId,
    );
  }

  @Get(":resourceId")
  public async detail(
    @Param("resourceId") resourceId: string,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = await this.authorize(request);
    if (!access.ok) return this.sendAccessError(response, requestId, access);
    if (!hasOnlyKeys(request.query, RESOURCE_DETAIL_KEYS)) return invalid(response, requestId);
    const expectedVersion = version(request.query);
    if (expectedVersion === undefined) return invalid(response, requestId);
    return sendResult(
      this.resourceService.readDetail(access.context, resourceId, expectedVersion),
      response,
      requestId,
    );
  }
}
