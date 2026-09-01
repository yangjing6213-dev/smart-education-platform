import type { TrustedAuthResult } from "@student-care/auth";
import fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import { registerHealthRoute } from "./health/health.route.js";
import { authPlugin } from "./plugins/auth.plugin.js";
import { scopePlugin } from "./plugins/scope.plugin.js";
import { registerMeRoute } from "./routes/me.route.js";
import { registerMembershipsRoute } from "./routes/memberships.route.js";

export interface ServerOptions {
  readonly getTrustedAuthResult?: (
    request: FastifyRequest,
  ) => TrustedAuthResult | null | undefined | Promise<TrustedAuthResult | null | undefined>;
}

function queryRecord(request: FastifyRequest): Record<string, unknown> {
  return typeof request.query === "object" && request.query !== null
    ? (request.query as Record<string, unknown>)
    : {};
}

export function buildServer(options: ServerOptions = {}): FastifyInstance {
  const app = fastify({ logger: false });

  void authPlugin(app, {
    getTrustedAuthResult: options.getTrustedAuthResult ?? (() => undefined),
  });
  void scopePlugin(app, {
    getScopeInput(request) {
      const query = queryRecord(request);
      const memberships = request.authContext?.memberships.filter(
        (membership) =>
          membership.status === "ACTIVE" &&
          (request.routeOptions.config.capabilityRequired === undefined ||
            membership.capabilities.includes(request.routeOptions.config.capabilityRequired)),
      );
      const requestedTenantId = query.tenant_id;
      const membership =
        memberships?.find((candidate) => candidate.tenant_id === requestedTenantId) ??
        (requestedTenantId === undefined ? memberships?.[0] : undefined);

      return {
        trustedActor: request.authContext
          ? { actorId: request.authContext.identity.actor_id }
          : undefined,
        membership: membership
          ? {
              tenantId: membership.tenant_id,
              campusIds: membership.campus_ids,
              status: "ACTIVE",
            }
          : undefined,
        requestedTenantId,
        requestedCampusId: query.campus_id,
      };
    },
  });

  registerHealthRoute(app);
  registerMeRoute(app);
  registerMembershipsRoute(app);
  return app;
}
