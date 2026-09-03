import type { FastifyInstance, FastifyRequest } from "fastify";
import type {
  MealActorContext,
  MealDraftPayload,
  MealResult,
  MealScope,
  MealService,
} from "../modules/meals/meal.service.js";

export type PublicMealScopeResolver = (
  request: FastifyRequest,
) => MealScope | undefined | Promise<MealScope | undefined>;

interface MealDraftRequestBody {
  readonly payload: MealDraftPayload;
  readonly expected_version?: number | null;
}

const BODY_KEYS = new Set(["payload", "expected_version"]);
const FORBIDDEN_QUERY_FIELDS = new Set([
  "actor_id",
  "identity_id",
  "tenant_id",
  "campus_id",
  "role",
  "publication",
  "status",
  "version",
  "ownership",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasForbiddenQueryClaim(request: FastifyRequest): boolean {
  const query = isRecord(request.query) ? request.query : {};
  return Object.keys(query).some((key) => FORBIDDEN_QUERY_FIELDS.has(key));
}

function mealId(request: FastifyRequest): string {
  return (request.params as { mealId: string }).mealId;
}

function validDraftBody(value: unknown): value is MealDraftRequestBody {
  if (!isRecord(value) || Object.keys(value).some((key) => !BODY_KEYS.has(key))) return false;
  return (
    isRecord(value.payload) &&
    (value.expected_version === undefined ||
      value.expected_version === null ||
      (typeof value.expected_version === "number" && Number.isInteger(value.expected_version)))
  );
}

function contextFromRequest(request: FastifyRequest): MealActorContext | undefined {
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
    capabilities: membership.capabilities,
  };
}

function statusFor<T>(result: MealResult<T>): number {
  if (result.ok) return 200;
  if (result.error.code === "VALIDATION_FAILED") return 400;
  if (result.error.code === "NOT_FOUND_SCOPED") return 404;
  if (result.error.code === "VERSION_MISMATCH" || result.error.code === "CONFLICT_STATE") {
    return 409;
  }
  return 403;
}

function sendResult<T>(
  request: FastifyRequest,
  reply: { code: (status: number) => { send: (body: unknown) => unknown } },
  result: MealResult<T>,
  successStatus = 200,
) {
  if (!result.ok) {
    return reply.code(statusFor(result)).send({ error: result.error, request_id: request.id });
  }
  return reply.code(successStatus).send({ data: result.data, request_id: request.id });
}

function validationFailure(
  request: FastifyRequest,
  reply: { code: (status: number) => { send: (body: unknown) => unknown } },
) {
  return reply.code(400).send({
    error: { code: "VALIDATION_FAILED", message: "Meal input is invalid." },
    request_id: request.id,
  });
}

function forbiddenFailure(
  request: FastifyRequest,
  reply: { code: (status: number) => { send: (body: unknown) => unknown } },
) {
  return reply.code(403).send({
    error: { code: "FORBIDDEN_SCOPE", message: "Meal scope access is not permitted." },
    request_id: request.id,
  });
}

function queryDate(request: FastifyRequest): string | undefined {
  const query = isRecord(request.query) ? request.query : {};
  return typeof query.date === "string" && Object.keys(query).every((key) => key === "date")
    ? query.date
    : undefined;
}

export function registerPublicMealRoutes(
  app: FastifyInstance,
  service: MealService,
  publicScopeResolver?: PublicMealScopeResolver,
): void {
  app.post(
    "/admin/meals/:mealId/draft",
    { config: { authRequired: true, scopeRequired: true } },
    async (request, reply) => {
      if (hasForbiddenQueryClaim(request)) return validationFailure(request, reply);
      const context = contextFromRequest(request);
      const body = request.body;
      if (!validDraftBody(body)) return validationFailure(request, reply);
      if (context === undefined) return forbiddenFailure(request, reply);
      return sendResult(
        request,
        reply,
        service.createDraft(context, mealId(request), body.payload, body.expected_version ?? null),
        201,
      );
    },
  );

  app.put(
    "/admin/meals/:mealId/draft",
    { config: { authRequired: true, scopeRequired: true } },
    async (request, reply) => {
      if (hasForbiddenQueryClaim(request)) return validationFailure(request, reply);
      const context = contextFromRequest(request);
      const body = request.body;
      if (
        !validDraftBody(body) ||
        body.expected_version === undefined ||
        body.expected_version === null
      ) {
        return validationFailure(request, reply);
      }
      if (context === undefined) return forbiddenFailure(request, reply);
      return sendResult(
        request,
        reply,
        service.updateDraft(context, mealId(request), body.payload, body.expected_version),
      );
    },
  );

  for (const action of ["publish", "unpublish"] as const) {
    app.post(
      `/admin/meals/:mealId/${action}`,
      { config: { authRequired: true, scopeRequired: true } },
      async (request, reply) => {
        if (hasForbiddenQueryClaim(request)) return validationFailure(request, reply);
        const context = contextFromRequest(request);
        const body = request.body;
        if (
          !isRecord(body) ||
          Object.keys(body).some((key) => key !== "expected_version") ||
          typeof body.expected_version !== "number" ||
          !Number.isInteger(body.expected_version)
        ) {
          return validationFailure(request, reply);
        }
        if (context === undefined) return forbiddenFailure(request, reply);
        const result =
          action === "publish"
            ? service.publish(context, mealId(request), body.expected_version)
            : service.unpublish(context, mealId(request), body.expected_version);
        return sendResult(request, reply, result);
      },
    );
  }

  app.get(
    "/public/meals",
    { config: { authRequired: false, scopeRequired: false } },
    async (request, reply) => {
      if (hasForbiddenQueryClaim(request)) return validationFailure(request, reply);
      const date = queryDate(request);
      const scope = await publicScopeResolver?.(request);
      if (date === undefined || scope === undefined) {
        return date === undefined
          ? validationFailure(request, reply)
          : forbiddenFailure(request, reply);
      }
      return sendResult(request, reply, service.listPublic(scope, date));
    },
  );
}
