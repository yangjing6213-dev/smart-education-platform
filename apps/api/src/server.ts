import type { TrustedAuthResult } from "@student-care/auth";
import fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import { ContentService } from "./modules/content/content.service.js";
import {
  InstitutionService,
  type InstitutionContentKind,
  type InstitutionPublicScope,
} from "./modules/institution/institution.service.js";
import { registerHealthRoute } from "./health/health.route.js";
import { authPlugin } from "./plugins/auth.plugin.js";
import { scopePlugin } from "./plugins/scope.plugin.js";
import { registerAdminInstitutionRoute } from "./routes/admin-institution.route.js";
import { registerMeRoute } from "./routes/me.route.js";
import { registerMembershipsRoute } from "./routes/memberships.route.js";
import { registerPublicContentRoute } from "./routes/public-content.route.js";
import {
  TeacherProfileService,
  type TeacherScope,
} from "./modules/teachers/public-profile.service.js";
import { registerPublicTeacherRoutes } from "./routes/public-teachers.route.js";

export interface ServerOptions {
  readonly getTrustedAuthResult?: (
    request: FastifyRequest,
  ) => TrustedAuthResult | null | undefined | Promise<TrustedAuthResult | null | undefined>;
  readonly contentService?: ContentService;
  readonly institutionService?: InstitutionService;
  readonly getPublicInstitutionScope?: (
    request: FastifyRequest,
    kind: InstitutionContentKind,
  ) => InstitutionPublicScope | undefined | Promise<InstitutionPublicScope | undefined>;
  readonly teacherProfileService?: TeacherProfileService;
  readonly getPublicTeacherScope?: (
    request: FastifyRequest,
  ) => TeacherScope | undefined | Promise<TeacherScope | undefined>;
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
      const requestedCampusId = query.campus_id;
      const requestedCampusIdValue =
        typeof requestedCampusId === "string" ? requestedCampusId : undefined;
      const membership =
        memberships?.find(
          (candidate) =>
            candidate.tenant_id === requestedTenantId &&
            (requestedCampusIdValue === undefined ||
              candidate.campus_ids.includes(requestedCampusIdValue)),
        ) ??
        (requestedTenantId === undefined
          ? memberships?.find(
              (candidate) =>
                requestedCampusIdValue === undefined ||
                candidate.campus_ids.includes(requestedCampusIdValue),
            )
          : undefined);

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
        requestedCampusId,
      };
    },
  });

  registerHealthRoute(app);
  registerMeRoute(app);
  registerMembershipsRoute(app);
  registerPublicContentRoute(app, options.contentService ?? new ContentService());
  registerAdminInstitutionRoute(
    app,
    options.institutionService ?? new InstitutionService(),
    options.getPublicInstitutionScope,
  );
  registerPublicTeacherRoutes(
    app,
    options.teacherProfileService ?? new TeacherProfileService(),
    options.getPublicTeacherScope,
  );
  return app;
}
