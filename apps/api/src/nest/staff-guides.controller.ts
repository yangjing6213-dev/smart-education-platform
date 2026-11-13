import {
  activeMemberships,
  resolveAuthContext,
  type AuthResolution,
} from "@student-care/auth";
import { resolveScope } from "@student-care/tenant";
import { Controller, Get, Inject, Param, Req, Res } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type {
  GuideActorContext,
  GuideCategory,
  GuideResult,
  GuideService,
} from "../modules/guides/guide.service.js";
import { containsForgedIdentityClaim } from "../plugins/forged-identity-claims.js";
import {
  GUIDE_SERVICE,
  STAFF_GUIDE_SCOPE_PROVIDER,
  TRUSTED_AUTH_PROVIDER,
  type ApiHttpRequest,
  type ApiHttpResponse,
  type StaffGuideScopeProvider,
  type TrustedAuthProvider,
} from "./api-tokens.js";

const FORBIDDEN_GUIDE_CLAIMS = [
  "tenant_id",
  "campus_id",
  "membership",
  "publication",
  "ownership",
  "search_scope",
  "file_ref",
];

type GuideAccess =
  | { readonly ok: true; readonly context: GuideActorContext }
  | {
      readonly ok: false;
      readonly status: 401 | 403;
      readonly code: "UNAUTHENTICATED" | "FORBIDDEN_SCOPE";
      readonly message: string;
    };

function guideAccess(
  auth: AuthResolution,
  query: Record<string, unknown>,
): GuideAccess {
  if (!auth.ok) {
    return {
      ok: false,
      status: 401,
      code: "UNAUTHENTICATED",
      message: "Authentication is required.",
    };
  }
  if (activeMemberships(auth).length === 0) {
    return {
      ok: false,
      status: 403,
      code: "FORBIDDEN_SCOPE",
      message: "Scope access is not permitted.",
    };
  }

  const requestedTenantId = query.tenant_id;
  const requestedCampusId = query.campus_id;
  const requestedCampusIdValue =
    typeof requestedCampusId === "string" ? requestedCampusId : undefined;
  const eligibleMemberships = auth.context.memberships.filter(
    (candidate) =>
      candidate.status === "ACTIVE" &&
      candidate.capabilities.includes("content:write"),
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
  if (membership === undefined || campusId === undefined || !scope.ok) {
    return {
      ok: false,
      status: 403,
      code: "FORBIDDEN_SCOPE",
      message: "Scope access is not permitted.",
    };
  }

  return {
    ok: true,
    context: {
      trusted: true,
      actorId: auth.context.identity.actor_id,
      activeMembership: true,
      scope: { tenantId: membership.tenant_id, campusId },
      capabilities: membership.capabilities,
    },
  };
}

function errorBody(code: string, message: string, requestId: string) {
  return { error: { code, message }, request_id: requestId };
}

function statusFor<T>(result: GuideResult<T>): number {
  if (result.ok) return 200;
  if (result.error.code === "VALIDATION_FAILED") return 400;
  if (result.error.code === "NOT_FOUND_SCOPED") return 404;
  return 403;
}

function queryHasForbiddenGuideClaim(query: Record<string, unknown>): boolean {
  return FORBIDDEN_GUIDE_CLAIMS.some((field) => field in query);
}

function searchInput(query: Record<string, unknown>) {
  const limit = query.limit === undefined ? undefined : Number(query.limit);
  return {
    query: query.query,
    ...(query.category === undefined
      ? {}
      : { category: query.category as GuideCategory }),
    ...(limit === undefined ? {} : { limit }),
  };
}

function version(query: Record<string, unknown>): number | undefined {
  if (typeof query.version !== "string" || !/^\d+$/.test(query.version))
    return undefined;
  return Number(query.version);
}

@Controller("staff/guides")
export class StaffGuidesController {
  public constructor(
    @Inject(GUIDE_SERVICE) private readonly guideService: GuideService,
    @Inject(TRUSTED_AUTH_PROVIDER)
    private readonly getTrustedAuthResult: TrustedAuthProvider,
    @Inject(STAFF_GUIDE_SCOPE_PROVIDER)
    private readonly getStaffGuideScope: StaffGuideScopeProvider,
  ) {}

  private async authorize(request: ApiHttpRequest): Promise<GuideAccess> {
    if (containsForgedIdentityClaim(request.query, request.headers)) {
      return {
        ok: false,
        status: 401,
        code: "UNAUTHENTICATED",
        message: "Authentication is required.",
      };
    }
    return guideAccess(
      resolveAuthContext(await this.getTrustedAuthResult(request)),
      request.query,
    );
  }

  private sendAccessError(
    response: ApiHttpResponse,
    requestId: string,
    access: Extract<GuideAccess, { readonly ok: false }>,
  ) {
    return response
      .status(access.status)
      .json(errorBody(access.code, access.message, requestId));
  }

  @Get()
  public async search(
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = await this.authorize(request);
    if (!access.ok) return this.sendAccessError(response, requestId, access);
    if (queryHasForbiddenGuideClaim(request.query)) {
      return response
        .status(400)
        .json(
          errorBody(
            "VALIDATION_FAILED",
            "Guide request is invalid.",
            requestId,
          ),
        );
    }

    const result = this.guideService.search(
      access.context,
      searchInput(request.query),
    );
    if (!result.ok) {
      return response
        .status(statusFor(result))
        .json({ error: result.error, request_id: requestId });
    }
    return response
      .status(200)
      .json({ data: result.data, request_id: requestId });
  }

  @Get(":guideId")
  public async detail(
    @Param("guideId") guideId: string,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = await this.authorize(request);
    if (!access.ok) return this.sendAccessError(response, requestId, access);
    if (queryHasForbiddenGuideClaim(request.query)) {
      return response
        .status(400)
        .json(
          errorBody(
            "VALIDATION_FAILED",
            "Guide request is invalid.",
            requestId,
          ),
        );
    }

    const guideScope = await this.getStaffGuideScope(request);
    if (
      guideScope !== undefined &&
      (guideScope.tenantId !== access.context.scope.tenantId ||
        guideScope.campusId !== access.context.scope.campusId)
    ) {
      return response
        .status(403)
        .json(
          errorBody(
            "FORBIDDEN_SCOPE",
            "Guide scope access is not permitted.",
            requestId,
          ),
        );
    }

    const expectedVersion = version(request.query);
    if (expectedVersion === undefined) {
      return response
        .status(400)
        .json(
          errorBody(
            "VALIDATION_FAILED",
            "Guide request is invalid.",
            requestId,
          ),
        );
    }

    const result = this.guideService.readDetail(
      access.context,
      guideId,
      expectedVersion,
    );
    if (!result.ok) {
      return response
        .status(statusFor(result))
        .json({ error: result.error, request_id: requestId });
    }
    return response
      .status(200)
      .json({ data: result.data, request_id: requestId });
  }
}
