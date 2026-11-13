import {
  activeMemberships,
  resolveAuthContext,
  type AuthContext,
  type TrustedAuthResult,
} from "@student-care/auth";
import type { IdentityCapability } from "@student-care/contracts";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { containsForgedIdentityClaim } from "./forged-identity-claims.js";

declare module "fastify" {
  interface FastifyContextConfig {
    authRequired?: boolean;
    capabilityRequired?: IdentityCapability;
  }

  interface FastifyRequest {
    authContext: AuthContext | undefined;
  }
}

export interface AuthPluginOptions {
  readonly getTrustedAuthResult: (
    request: FastifyRequest,
  ) => TrustedAuthResult | null | undefined | Promise<TrustedAuthResult | null | undefined>;
  readonly now?: () => Date;
}

export const authPlugin: FastifyPluginAsync<AuthPluginOptions> = async (app, options) => {
  app.decorateRequest("authContext", undefined);

  app.addHook("preHandler", async (request, reply) => {
    if (request.routeOptions.config.authRequired !== true) return;

    const resolution = containsForgedIdentityClaim(request.query, request.headers)
      ? { ok: false as const, reason: "UNAUTHENTICATED" as const }
      : resolveAuthContext(
          await options.getTrustedAuthResult(request),
          options.now?.() ?? new Date(),
        );
    if (!resolution.ok) {
      return reply.code(401).send({
        error: { code: "UNAUTHENTICATED", message: "Authentication is required." },
        request_id: request.id,
      });
    }

    if (activeMemberships(resolution).length === 0) {
      return reply.code(403).send({
        error: { code: "FORBIDDEN_SCOPE", message: "Scope access is not permitted." },
        request_id: request.id,
      });
    }

    request.authContext = resolution.context;
  });
};
