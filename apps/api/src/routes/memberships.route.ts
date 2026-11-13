import { activeMemberships } from "@student-care/auth";
import type { MembershipsResponseDto, SuccessEnvelope } from "@student-care/contracts";
import type { FastifyInstance } from "fastify";

export function registerMembershipsRoute(app: FastifyInstance): void {
  app.get(
    "/memberships",
    {
      config: {
        authRequired: true,
        scopeRequired: true,
        capabilityRequired: "memberships:read",
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
    async (request): Promise<SuccessEnvelope<MembershipsResponseDto>> => {
      const authContext = request.authContext!;

      return {
        data: activeMemberships({ ok: true, context: authContext }),
        request_id: request.id,
      };
    },
  );
}
