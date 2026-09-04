import type { FastifyInstance, FastifyRequest } from "fastify";
import type {
  GuideActorContext,
  GuideCategory,
  GuideResult,
  GuideScope,
  GuideService,
} from "../modules/guides/guide.service.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasForbiddenClaim(request: FastifyRequest): boolean {
  const query = isRecord(request.query) ? request.query : {};
  return Object.keys(query).some((key) =>
    new Set([
      "actor_id",
      "identity_id",
      "tenant_id",
      "campus_id",
      "role",
      "membership",
      "publication",
      "ownership",
      "search_scope",
      "file_ref",
    ]).has(key),
  );
}

function contextFromRequest(request: FastifyRequest): GuideActorContext | undefined {
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
  };
}

function statusFor<T>(result: GuideResult<T>): number {
  if (result.ok) return 200;
  if (result.error.code === "VALIDATION_FAILED") return 400;
  if (result.error.code === "NOT_FOUND_SCOPED") return 404;
  return 403;
}

function sendResult<T>(
  request: FastifyRequest,
  reply: { code: (status: number) => { send: (body: unknown) => unknown } },
  result: GuideResult<T>,
) {
  if (!result.ok) {
    return reply.code(statusFor(result)).send({ error: result.error, request_id: request.id });
  }
  return reply.code(200).send({ data: result.data, request_id: request.id });
}

function forbidden(
  request: FastifyRequest,
  reply: { code: (status: number) => { send: (body: unknown) => unknown } },
) {
  return reply.code(403).send({
    error: { code: "FORBIDDEN_SCOPE", message: "Guide scope access is not permitted." },
    request_id: request.id,
  });
}

function invalid(
  request: FastifyRequest,
  reply: { code: (status: number) => { send: (body: unknown) => unknown } },
) {
  return reply.code(400).send({
    error: { code: "VALIDATION_FAILED", message: "Guide request is invalid." },
    request_id: request.id,
  });
}

function searchInput(request: FastifyRequest): Record<string, unknown> {
  const query = isRecord(request.query) ? request.query : {};
  const limit = query.limit === undefined ? undefined : Number(query.limit);
  return {
    query: query.query,
    ...(query.category === undefined ? {} : { category: query.category as GuideCategory }),
    ...(limit === undefined ? {} : { limit }),
  };
}

function version(request: FastifyRequest): number | undefined {
  const query = isRecord(request.query) ? request.query : {};
  if (typeof query.version !== "string" || !/^\d+$/.test(query.version)) return undefined;
  return Number(query.version);
}

export type StaffGuideScopeResolver = (
  request: FastifyRequest,
) => GuideScope | undefined | Promise<GuideScope | undefined>;

export function registerStaffGuideRoutes(
  app: FastifyInstance,
  service: GuideService,
  scopeResolver?: StaffGuideScopeResolver,
): void {
  app.get(
    "/staff/guides",
    { config: { authRequired: true, scopeRequired: true, capabilityRequired: "content:write" } },
    async (request, reply) => {
      if (hasForbiddenClaim(request)) return invalid(request, reply);
      const context = contextFromRequest(request);
      if (context === undefined) return forbidden(request, reply);
      return sendResult(request, reply, service.search(context, searchInput(request)));
    },
  );

  app.get(
    "/staff/guides/:guideId",
    { config: { authRequired: true, scopeRequired: true, capabilityRequired: "content:write" } },
    async (request, reply) => {
      if (hasForbiddenClaim(request)) return invalid(request, reply);
      const context = contextFromRequest(request);
      if (context === undefined) return forbidden(request, reply);
      const guideScope = await scopeResolver?.(request);
      if (
        guideScope !== undefined &&
        (guideScope.tenantId !== context.scope.tenantId ||
          guideScope.campusId !== context.scope.campusId)
      ) {
        return forbidden(request, reply);
      }
      const expectedVersion = version(request);
      if (expectedVersion === undefined) return invalid(request, reply);
      return sendResult(
        request,
        reply,
        service.readDetail(
          context,
          (request.params as { guideId: string }).guideId,
          expectedVersion,
        ),
      );
    },
  );
}
