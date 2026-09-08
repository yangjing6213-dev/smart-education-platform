import type { FastifyInstance, FastifyRequest } from "fastify";
import type {
  ResourceActorContext,
  ResourceCategory,
  ResourceResult,
  ResourceService,
} from "../modules/resources/resource.service.js";

const FORBIDDEN_QUERY_FIELDS = new Set([
  "actor_id",
  "identity_id",
  "tenant_id",
  "campus_id",
  "role",
  "roles",
  "membership",
  "publication",
  "ownership",
  "search_scope",
  "file_ref",
  "provider_url",
]);
const SEARCH_QUERY_KEYS = ["query", "category", "limit", "cursor"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function queryRecord(request: FastifyRequest): Record<string, unknown> {
  return isRecord(request.query) ? request.query : {};
}

function hasOnlyQueryKeys(request: FastifyRequest, keys: readonly string[]): boolean {
  return Object.keys(queryRecord(request)).every((key) => keys.includes(key));
}

function hasForbiddenQueryClaim(request: FastifyRequest): boolean {
  return Object.keys(queryRecord(request)).some((key) => FORBIDDEN_QUERY_FIELDS.has(key));
}

function contextFromRequest(request: FastifyRequest): ResourceActorContext | undefined {
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
  if (membership === undefined) return undefined;
  return {
    trusted: true,
    actorId: scope.actorId,
    activeMembership: true,
    scope: { tenantId: scope.tenantId, campusId: scope.campusId },
    capabilities: membership.capabilities,
    roles: membership.capabilities,
  };
}

function statusFor(code: string): number {
  if (code === "VALIDATION_FAILED" || code === "CURSOR_INVALID") return 400;
  if (code === "NOT_FOUND_SCOPED" || code === "FILE_UNAVAILABLE") return 404;
  if (code === "STALE_VERSION" || code === "SCOPE_STALE") return 409;
  return 403;
}

function sendResult<T>(
  request: FastifyRequest,
  reply: { code: (status: number) => { send: (body: unknown) => unknown } },
  result: ResourceResult<T>,
) {
  if (!result.ok) {
    return reply.code(statusFor(result.error.code)).send({
      error: result.error,
      request_id: request.id,
    });
  }
  return reply.code(200).send({ data: result.data, request_id: request.id });
}

function invalid(
  request: FastifyRequest,
  reply: { code: (status: number) => { send: (body: unknown) => unknown } },
) {
  return reply.code(400).send({
    error: { code: "VALIDATION_FAILED", message: "Resource request is invalid." },
    request_id: request.id,
  });
}

function forbidden(
  request: FastifyRequest,
  reply: { code: (status: number) => { send: (body: unknown) => unknown } },
) {
  return reply.code(403).send({
    error: { code: "FORBIDDEN_SCOPE", message: "Resource scope access is not permitted." },
    request_id: request.id,
  });
}

function searchInput(request: FastifyRequest): Record<string, unknown> {
  const query = queryRecord(request);
  const limit = query.limit === undefined ? undefined : Number(query.limit);
  return {
    query: query.query,
    ...(query.category === undefined ? {} : { category: query.category as ResourceCategory }),
    ...(limit === undefined ? {} : { limit }),
    ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
  };
}

function version(request: FastifyRequest): number | undefined {
  const query = queryRecord(request);
  if (typeof query.version !== "string" || !/^\d+$/.test(query.version)) return undefined;
  return Number(query.version);
}

export function registerStaffResourceRoutes(app: FastifyInstance, service: ResourceService): void {
  app.get(
    "/staff/resources",
    { config: { authRequired: true, scopeRequired: true, capabilityRequired: "content:write" } },
    async (request, reply) => {
      if (hasForbiddenQueryClaim(request) || !hasOnlyQueryKeys(request, SEARCH_QUERY_KEYS)) {
        return invalid(request, reply);
      }
      const context = contextFromRequest(request);
      if (context === undefined) return forbidden(request, reply);
      return sendResult(request, reply, service.search(context, searchInput(request)));
    },
  );

  app.get(
    "/staff/resources/:resourceId",
    { config: { authRequired: true, scopeRequired: true, capabilityRequired: "content:write" } },
    async (request, reply) => {
      if (hasForbiddenQueryClaim(request) || !hasOnlyQueryKeys(request, ["version"])) {
        return invalid(request, reply);
      }
      const context = contextFromRequest(request);
      if (context === undefined) return forbidden(request, reply);
      const expectedVersion = version(request);
      if (expectedVersion === undefined) return invalid(request, reply);
      return sendResult(
        request,
        reply,
        service.readDetail(
          context,
          (request.params as { resourceId: string }).resourceId,
          expectedVersion,
        ),
      );
    },
  );
}
