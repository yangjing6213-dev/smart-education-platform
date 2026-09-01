import {
  activeMemberships,
  resolveAuthContext,
  type AuthContext,
  type TrustedAuthResult,
} from "@student-care/auth";
import type { IdentityCapability } from "@student-care/contracts";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";

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
}

const FORGED_IDENTITY_QUERY_FIELDS = ["actor_id", "identity_id", "role", "roles"];
const FORGED_IDENTITY_HEADERS = ["x-actor-id", "x-identity-id", "x-role", "x-roles"];

function containsForgedIdentityClaim(request: FastifyRequest): boolean {
  const query = request.query as Record<string, unknown>;

  return (
    FORGED_IDENTITY_QUERY_FIELDS.some((field) => field in query) ||
    FORGED_IDENTITY_HEADERS.some((header) => request.headers[header] !== undefined)
  );
}

export const authPlugin: FastifyPluginAsync<AuthPluginOptions> = async (app, options) => {
  app.decorateRequest("authContext", undefined);

  app.addHook("preHandler", async (request, reply) => {
    if (request.routeOptions.config.authRequired !== true) return;

    const resolution = containsForgedIdentityClaim(request)
      ? { ok: false as const, reason: "UNAUTHENTICATED" as const }
      : resolveAuthContext(await options.getTrustedAuthResult(request));
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
