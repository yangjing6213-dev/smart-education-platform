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
