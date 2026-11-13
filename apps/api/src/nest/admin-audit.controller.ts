import { activeMemberships, resolveAuthContext, type AuthResolution } from "@student-care/auth";
import { resolveScope } from "@student-care/tenant";
import { Controller, Get, Inject, Optional, Req, Res } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type {
  AuditAction,
  AuditQuery,
  AuditReadContext,
  AuditResult,
  AuditService,
} from "../modules/audit/audit.service.js";
import { containsForgedIdentityClaim } from "../plugins/forged-identity-claims.js";
import {
  AUDIT_SERVICE,
  MEAL_PUBLICATION_AUDIT_SERVICE,
  TRUSTED_AUTH_PROVIDER,
  type ApiHttpRequest,
  type ApiHttpResponse,
  type TrustedAuthProvider,
} from "./api-tokens.js";
import type { MealPublicationAuditOperations } from "../modules/audit/prisma-meal-publication-audit.service.js";

const ALLOWED_QUERY_FIELDS = new Set([
  "action",
  "actor_ref",
  "target_type",
  "target_ref",
  "correlation_id",
  "trace_id",
  "from",
  "to",
  "limit",
]);
const FORBIDDEN_SCOPE_FIELDS = new Set([
  "actor_id",
  "identity_id",
  "tenant_id",
  "campus_id",
  "role",
  "roles",
  "capability",
  "capabilities",
  "membership",
  "raw_request_body",
]);

type AuditAccess =
  | { readonly ok: true; readonly context: AuditReadContext }
  | {
      readonly ok: false;
      readonly status: 401 | 403;
      readonly code: "UNAUTHENTICATED" | "FORBIDDEN_SCOPE";
      readonly message: string;
    };

function denied(status: 401 | 403): Extract<AuditAccess, { readonly ok: false }> {
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

function auditContext(auth: AuthResolution, request: ApiHttpRequest): AuditAccess {
  if (!auth.ok) return denied(401);
  if (activeMemberships(auth).length === 0) return denied(403);

  const requestedTenantId = request.query.tenant_id as string | undefined;
  const requestedCampusId = request.query.campus_id;
  const requestedCampusIdValue =
    typeof requestedCampusId === "string" ? requestedCampusId : undefined;
  const memberships = auth.context.memberships.filter(
    (membership) => membership.status === "ACTIVE",
  );
  const membership =
    memberships.find(
      (candidate) =>
        candidate.tenant_id === requestedTenantId &&
        (requestedCampusIdValue === undefined ||
          candidate.campus_ids.includes(requestedCampusIdValue)),
    ) ??
    (requestedTenantId === undefined
      ? memberships.find(
          (candidate) =>
            requestedCampusIdValue === undefined ||
            candidate.campus_ids.includes(requestedCampusIdValue),
        )
      : undefined);
  const campusId =
    requestedCampusIdValue ??
    (typeof requestedCampusId === "string" ? undefined : membership?.campus_ids[0]);
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
      actorId: scope.scopeContext.actorId,
      activeMembership: true,
      scope: { tenantId: scope.scopeContext.tenantId, campusId: scope.scopeContext.campusId! },
      capabilities: membership.capabilities,
    },
  };
}

function errorBody(code: string, message: string, requestId: string) {
  return { error: { code, message }, request_id: requestId };
}

function hasInvalidQueryFields(query: Record<string, unknown>): boolean {
  return Object.keys(query).some(
    (key) => FORBIDDEN_SCOPE_FIELDS.has(key) || !ALLOWED_QUERY_FIELDS.has(key),
  );
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function queryFromRequest(query: Record<string, unknown>): AuditQuery | undefined {
  if (hasInvalidQueryFields(query)) return undefined;
  const limitValue = stringValue(query.limit);
  if (query.limit !== undefined && (limitValue === undefined || !/^\d{1,3}$/.test(limitValue))) {
    return undefined;
  }
  const limit = limitValue === undefined ? undefined : Number(limitValue);
  const action = stringValue(query.action);
  const actorReference = stringValue(query.actor_ref);
  const targetType = stringValue(query.target_type);
  const targetReference = stringValue(query.target_ref);
  const correlationId = stringValue(query.correlation_id);
  const traceId = stringValue(query.trace_id);
  const occurredFrom = stringValue(query.from);
  const occurredTo = stringValue(query.to);

  return {
    ...(action === undefined ? {} : { action: action as AuditAction }),
    ...(actorReference === undefined ? {} : { actorReference }),
    ...(targetType === undefined ? {} : { targetType }),
    ...(targetReference === undefined ? {} : { targetReference }),
    ...(correlationId === undefined ? {} : { correlationId }),
    ...(traceId === undefined ? {} : { traceId }),
    ...(occurredFrom === undefined ? {} : { occurredFrom }),
    ...(occurredTo === undefined ? {} : { occurredTo }),
    ...(limit === undefined ? {} : { limit }),
  };
}

function mealPublicationLimit(query: Record<string, unknown>): number | undefined {
  if (
    Object.keys(query).some((key) => !["tenant_id", "campus_id", "limit"].includes(key)) ||
    (query.tenant_id !== undefined && typeof query.tenant_id !== "string") ||
    (query.campus_id !== undefined && typeof query.campus_id !== "string")
  ) {
    return undefined;
  }
  if (query.limit === undefined) return 50;
  if (typeof query.limit !== "string" || !/^\d{1,3}$/.test(query.limit)) return undefined;
  const value = Number(query.limit);
  return value >= 1 && value <= 100 ? value : undefined;
}

function statusFor<T>(result: AuditResult<T>): number {
  if (result.ok) return 200;
  return result.error.code === "VALIDATION_FAILED" ? 400 : 403;
}

@Controller("admin/audit-logs")
export class AdminAuditController {
  public constructor(
    @Inject(AUDIT_SERVICE) private readonly auditService: AuditService,
    @Inject(TRUSTED_AUTH_PROVIDER)
    private readonly getTrustedAuthResult: TrustedAuthProvider,
    @Optional()
    @Inject(MEAL_PUBLICATION_AUDIT_SERVICE)
    private readonly mealPublicationAuditService?: MealPublicationAuditOperations | null,
  ) {}

  @Get("meal-publications")
  public async listMealPublications(
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const limit = mealPublicationLimit(request.query);
    if (limit === undefined) {
      return response
        .status(400)
        .json(errorBody("VALIDATION_FAILED", "Audit query is invalid.", requestId));
    }
    if (containsForgedIdentityClaim(request.query, request.headers)) {
      return response
        .status(401)
        .json(errorBody("UNAUTHENTICATED", "Authentication is required.", requestId));
    }

    const access = auditContext(
      resolveAuthContext(await this.getTrustedAuthResult(request)),
      request,
    );
    if (!access.ok) {
      return response.status(access.status).json(errorBody(access.code, access.message, requestId));
    }
    if (this.mealPublicationAuditService == null) {
      return response
        .status(503)
        .json(errorBody("AUDIT_UNAVAILABLE", "Audit history is unavailable.", requestId));
    }

    const result = await this.mealPublicationAuditService.list(access.context, limit);
    if (!result.ok) {
      const status = result.error.code === "VALIDATION_FAILED" ? 400 : 403;
      return response.status(status).json({ error: result.error, request_id: requestId });
    }
    return response.status(200).json({ data: result.data, request_id: requestId });
  }

  @Get()
  public async list(
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    if (containsForgedIdentityClaim(request.query, request.headers)) {
      return response
        .status(401)
        .json(errorBody("UNAUTHENTICATED", "Authentication is required.", requestId));
    }

    const access = auditContext(
      resolveAuthContext(await this.getTrustedAuthResult(request)),
      request,
    );
    if (!access.ok) {
      return response.status(access.status).json(errorBody(access.code, access.message, requestId));
    }

    const query = queryFromRequest(request.query);
    if (query === undefined) {
      return response
        .status(400)
        .json(errorBody("VALIDATION_FAILED", "Audit query is invalid.", requestId));
    }

    const result = this.auditService.listEvents(access.context, query);
    if (!result.ok) {
      return response
        .status(statusFor(result))
        .json({ error: result.error, request_id: requestId });
    }
    return response.status(200).json({ data: result.data, request_id: requestId });
  }
}
