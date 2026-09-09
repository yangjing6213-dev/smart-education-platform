import type { FastifyInstance, FastifyRequest } from "fastify";
import type {
  PartnerLinkActorContext,
  PartnerLinkResult,
  PartnerLinkScope,
  PartnerLinkService,
} from "../modules/partner-links/partner-link.service.js";

const FORBIDDEN_QUERY_FIELDS = new Set([
  "actor_id",
  "identity_id",
  "tenant_id",
  "campus_id",
  "role",
  "roles",
  "membership",
  "capability",
  "destination",
  "normalized_host",
  "normalized_path",
  "publication_status",
  "enabled_status",
  "policy_version",
  "expires_at",
  "handoff",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function queryKeys(request: FastifyRequest): readonly string[] {
  return isRecord(request.query) ? Object.keys(request.query) : [];
}

function hasForbiddenClaim(request: FastifyRequest): boolean {
  return queryKeys(request).some((key) => FORBIDDEN_QUERY_FIELDS.has(key));
}

function hasOnlyQueryKeys(request: FastifyRequest, allowed: readonly string[]): boolean {
  const allowedKeys = new Set(allowed);
  return queryKeys(request).every((key) => allowedKeys.has(key));
}

function contextFromRequest(request: FastifyRequest): PartnerLinkActorContext | undefined {
  const scope = request.scopeContext;
  const authContext = request.authContext;
  if (scope === undefined || authContext === undefined || scope.campusId === undefined) {
    return undefined;
  }
  if (authContext.identity.actor_id !== scope.actorId) return undefined;
  const membership = authContext.memberships.find(
    (candidate) =>
      candidate.status === "ACTIVE" &&
      candidate.tenant_id === scope.tenantId &&
      candidate.campus_ids.includes(scope.campusId!),
  );
  if (membership === undefined || !membership.capabilities.includes("content:write")) {
    return undefined;
  }
  const resolvedScope: PartnerLinkScope = {
    tenantId: scope.tenantId,
    campusId: scope.campusId,
  };
  return {
    trusted: true,
    actorId: scope.actorId,
    activeMembership: true,
    scope: resolvedScope,
    allowedScopes: authContext.memberships
      .filter(
        (candidate) => candidate.status === "ACTIVE" && candidate.tenant_id === scope.tenantId,
      )
      .flatMap((candidate) =>
        candidate.campus_ids.map((campusId) => ({ tenantId: scope.tenantId, campusId })),
      ),
    capabilities: membership.capabilities,
    roles: membership.capabilities,
  };
}

function statusFor(code: string): number {
  if (code === "VALIDATION_FAILED") return 400;
  if (code === "NOT_FOUND_SCOPED") return 404;
  if (code === "HANDOFF_EXPIRED" || code === "HANDOFF_REUSED") return 409;
  return 403;
}

function sendResult<T>(
  request: FastifyRequest,
  reply: { code: (status: number) => { send: (body: unknown) => unknown } },
  result: PartnerLinkResult<T>,
) {
  if (!result.ok) {
    return reply
      .code(statusFor(result.error.code))
      .send({ error: result.error, request_id: request.id });
  }
  return reply.code(200).send({ data: result.data, request_id: request.id });
}

function invalid(
  request: FastifyRequest,
  reply: { code: (status: number) => { send: (body: unknown) => unknown } },
) {
  return reply.code(400).send({
    error: { code: "VALIDATION_FAILED", message: "Partner link input is invalid." },
    request_id: request.id,
  });
}

function forbidden(
  request: FastifyRequest,
  reply: { code: (status: number) => { send: (body: unknown) => unknown } },
) {
  return reply.code(403).send({
    error: { code: "FORBIDDEN_SCOPE", message: "Partner link scope access is not permitted." },
    request_id: request.id,
  });
}

function searchInput(request: FastifyRequest): Record<string, unknown> {
  const query = isRecord(request.query) ? request.query : {};
  const limit = query.limit === undefined ? undefined : Number(query.limit);
  return {
    ...(query.query === undefined ? {} : { query: query.query }),
    ...(limit === undefined ? {} : { limit }),
  };
}

export function registerPartnerLinkRoutes(app: FastifyInstance, service: PartnerLinkService): void {
  app.get(
    "/staff/partner-cloud-links",
    { config: { authRequired: true, scopeRequired: true, capabilityRequired: "content:write" } },
    async (request, reply) => {
      if (hasForbiddenClaim(request) || !hasOnlyQueryKeys(request, ["query", "limit"])) {
        return invalid(request, reply);
      }
      const context = contextFromRequest(request);
      if (context === undefined) return forbidden(request, reply);
      return sendResult(request, reply, service.search(context, searchInput(request)));
    },
  );

  app.get(
    "/staff/partner-cloud-links/:linkId/entry-check",
    { config: { authRequired: true, scopeRequired: true, capabilityRequired: "content:write" } },
    async (request, reply) => {
      if (hasForbiddenClaim(request) || !hasOnlyQueryKeys(request, [])) {
        return invalid(request, reply);
      }
      const context = contextFromRequest(request);
      if (context === undefined) return forbidden(request, reply);
      const linkId = (request.params as { linkId: string }).linkId;
      return sendResult(request, reply, service.issueEntry(context, linkId));
    },
  );
}
