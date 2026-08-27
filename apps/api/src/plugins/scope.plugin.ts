import { resolveScope, type ResolveScopeInput, type ScopeContext } from "@student-care/tenant";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";

declare module "fastify" {
  interface FastifyContextConfig {
    scopeRequired?: boolean;
  }

  interface FastifyRequest {
    scopeContext: ScopeContext | undefined;
  }
}

export interface ScopePluginOptions {
  readonly getScopeInput: (request: FastifyRequest) => ResolveScopeInput;
}

export const scopePlugin: FastifyPluginAsync<ScopePluginOptions> = async (app, options) => {
  app.decorateRequest("scopeContext", undefined);

  app.addHook("preHandler", async (request, reply) => {
    if (request.routeOptions.config.scopeRequired !== true) return;

    const resolution = resolveScope(options.getScopeInput(request));
    if (!resolution.ok) {
      return reply.code(403).send({
        error: {
          code: "FORBIDDEN_SCOPE",
          message: "Scope access is not permitted.",
        },
        request_id: request.id,
      });
    }

    request.scopeContext = resolution.scopeContext;
  });
};
