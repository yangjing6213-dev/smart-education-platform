import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ContentActorContext, ContentService } from "../modules/content/content.service.js";

const FORBIDDEN_CONTENT_QUERY_FIELDS = ["version", "publication", "status", "role"];

function queryRecord(request: FastifyRequest): Record<string, unknown> {
  return request.query as Record<string, unknown>;
}

function contentKeyParam(request: FastifyRequest): string {
  return (request.params as { contentKey: string }).contentKey;
}

export function registerPublicContentRoute(
  app: FastifyInstance,
  contentService: ContentService,
): void {
  app.get(
    "/public-content/:contentKey",
    { config: { authRequired: true, scopeRequired: true } },
    async (request, reply) => {
      const query = queryRecord(request);
      if (FORBIDDEN_CONTENT_QUERY_FIELDS.some((field) => field in query)) {
        return reply.code(400).send({
          error: { code: "VALIDATION_FAILED", message: "Content query claims are not accepted." },
          request_id: request.id,
        });
      }

      const contentKey = contentKeyParam(request);
      const scope = request.scopeContext;
      const authContext = request.authContext;
      if (scope === undefined || authContext === undefined) {
        return reply.code(403).send({
          error: { code: "FORBIDDEN_SCOPE", message: "Content scope access is not permitted." },
          request_id: request.id,
        });
      }

      const membership = authContext.memberships.find(
        (candidate) =>
          candidate.status === "ACTIVE" &&
          candidate.tenant_id === scope.tenantId &&
          (scope.campusId === undefined || candidate.campus_ids.includes(scope.campusId)),
      );
      if (membership === undefined) {
        return reply.code(403).send({
          error: { code: "FORBIDDEN_SCOPE", message: "Content scope access is not permitted." },
          request_id: request.id,
        });
      }

      const context: ContentActorContext = {
        trusted: true,
        actorId: scope.actorId,
        activeMembership: true,
        scope: {
          tenantId: scope.tenantId,
          ...(scope.campusId === undefined ? {} : { campusId: scope.campusId }),
        },
        capabilities: membership.capabilities,
      };
      const result = contentService.readPublic(context, contentKey);
      if (!result.ok) {
        const statusCode = result.error.code === "NOT_FOUND_SCOPED" ? 404 : 403;
        return reply.code(statusCode).send({
          error: result.error,
          request_id: request.id,
        });
      }

      return {
        data: result.data,
        request_id: request.id,
      };
    },
  );
}
