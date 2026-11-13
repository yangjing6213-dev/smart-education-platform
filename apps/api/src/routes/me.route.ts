import { activeMemberships } from "@student-care/auth";
import type { MeResponseDto, SuccessEnvelope } from "@student-care/contracts";
import type { FastifyInstance } from "fastify";

export function registerMeRoute(app: FastifyInstance): void {
  app.get(
    "/me",
    {
      config: {
        authRequired: true,
        scopeRequired: true,
        capabilityRequired: "identity:read",
      },
      async preHandler(request, reply) {
        const requestedCampusId = (request.query as Record<string, unknown>).campus_id;
        if (requestedCampusId !== undefined && typeof requestedCampusId !== "string") {
          reply.code(403).send({
            error: {
              code: "FORBIDDEN_SCOPE",
              message: "Scope access is not permitted.",
            },
            request_id: request.id,
          });
        }
      },
    },
    async (request): Promise<SuccessEnvelope<MeResponseDto>> => {
      const authContext = request.authContext!;

      return {
        data: {
          actor_id: authContext.identity.actor_id,
          display_name: authContext.identity.display_name,
          memberships: activeMemberships({ ok: true, context: authContext }),
        },
        request_id: request.id,
      };
    },
  );
}
