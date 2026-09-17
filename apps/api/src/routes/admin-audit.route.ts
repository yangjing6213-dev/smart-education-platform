import type { FastifyInstance, FastifyRequest } from "fastify";
import type {
  AuditAction,
  AuditService,
  AuditQuery,
  AuditReadContext,
  AuditResult,
} from "../modules/audit/audit.service.js";

const ALLOWED_QUERY_FIELDS = new Set([
  "action",
  "actor_ref",
  "target_type",
  "target_ref",
  "correlation_id",
  "trace_id",
  "from",
  "to",
  "limit",
]);
const FORBIDDEN_SCOPE_FIELDS = new Set([
  "actor_id",
  "identity_id",
  "tenant_id",
  "campus_id",
  "role",
  "roles",
  "capability",
  "capabilities",
  "membership",
  "raw_request_body",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function queryRecord(request: FastifyRequest): Record<string, unknown> {
  return isRecord(request.query) ? request.query : {};
}

function hasInvalidQueryFields(request: FastifyRequest): boolean {
  return Object.keys(queryRecord(request)).some(
    (key) => FORBIDDEN_SCOPE_FIELDS.has(key) || !ALLOWED_QUERY_FIELDS.has(key),
  );
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function queryFromRequest(request: FastifyRequest): AuditQuery | undefined {
  if (hasInvalidQueryFields(request)) return undefined;
  const query = queryRecord(request);
  const limitValue = stringValue(query.limit);
  if (query.limit !== undefined && (limitValue === undefined || !/^\d{1,3}$/.test(limitValue))) {
    return undefined;
  }
  const limit = limitValue === undefined ? undefined : Number(limitValue);
  const action = stringValue(query.action);
  const actorReference = stringValue(query.actor_ref);
  const targetType = stringValue(query.target_type);
  const targetReference = stringValue(query.target_ref);
  const correlationId = stringValue(query.correlation_id);
  const traceId = stringValue(query.trace_id);
  const occurredFrom = stringValue(query.from);
  const occurredTo = stringValue(query.to);

  return {
    ...(action === undefined ? {} : { action: action as AuditAction }),
    ...(actorReference === undefined ? {} : { actorReference }),
    ...(targetType === undefined ? {} : { targetType }),
    ...(targetReference === undefined ? {} : { targetReference }),
    ...(correlationId === undefined ? {} : { correlationId }),
    ...(traceId === undefined ? {} : { traceId }),
    ...(occurredFrom === undefined ? {} : { occurredFrom }),
    ...(occurredTo === undefined ? {} : { occurredTo }),
    ...(limit === undefined ? {} : { limit }),
  };
}

function contextFromRequest(request: FastifyRequest): AuditReadContext | undefined {
  const scope = request.scopeContext;
  const authContext = request.authContext;
  if (scope === undefined || authContext === undefined || scope.campusId === undefined) {
    return undefined;
  }
  if (authContext.identity.actor_id !== scope.actorId) return undefined;
  const membership = authContext.memberships.find(
    (candidate) =>
      candidate.status === "ACTIVE" &&
      candidate.tenant_id === scope.tenantId &&
      candidate.campus_ids.includes(scope.campusId!),
  );
  if (membership === undefined) return undefined;

  return {
    trusted: true,
    actorId: scope.actorId,
    activeMembership: true,
    scope: { tenantId: scope.tenantId, campusId: scope.campusId },
    capabilities: membership.capabilities as readonly string[],
  };
}

function statusFor<T>(result: AuditResult<T>): number {
  if (result.ok) return 200;
  return result.error.code === "VALIDATION_FAILED" ? 400 : 403;
}

function invalid(
  request: FastifyRequest,
  reply: { code: (status: number) => { send: (body: unknown) => unknown } },
) {
  return reply.code(400).send({
    error: { code: "VALIDATION_FAILED", message: "Audit query is invalid." },
    request_id: request.id,
  });
}

function forbidden(
  request: FastifyRequest,
  reply: { code: (status: number) => { send: (body: unknown) => unknown } },
) {
  return reply.code(403).send({
    error: { code: "FORBIDDEN_SCOPE", message: "Audit scope access is not permitted." },
    request_id: request.id,
  });
}

export function registerAdminAuditRoute(app: FastifyInstance, service: AuditService): void {
  app.get(
    "/admin/audit-logs",
    { config: { authRequired: true, scopeRequired: true } },
    async (request, reply) => {
      const query = queryFromRequest(request);
      if (query === undefined) return invalid(request, reply);
      const context = contextFromRequest(request);
      if (context === undefined) return forbidden(request, reply);

      const result = service.listEvents(context, query);
      if (!result.ok) {
        return reply.code(statusFor(result)).send({
          error: result.error,
          request_id: request.id,
        });
      }
      return reply.code(200).send({ data: result.data, request_id: request.id });
    },
  );
}
