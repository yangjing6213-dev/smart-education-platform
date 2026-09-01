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
