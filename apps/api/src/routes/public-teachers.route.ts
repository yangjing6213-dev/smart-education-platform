import type { FastifyInstance, FastifyRequest } from "fastify";
import type {
  TeacherActorContext,
  TeacherDraftPayload,
  TeacherProfileResult,
  TeacherProfileService,
  TeacherScope,
} from "../modules/teachers/public-profile.service.js";

export type PublicTeacherScopeResolver = (
  request: FastifyRequest,
) => TeacherScope | undefined | Promise<TeacherScope | undefined>;

interface DraftRequestBody {
  readonly payload: TeacherDraftPayload;
  readonly expected_version?: number | null;
}

const BODY_KEYS = new Set(["payload", "expected_version"]);
const PAYLOAD_KEYS = new Set([
  "display_name",
  "headline",
  "subjects",
  "bio",
  "photo_ref",
  "private_email",
  "internal_notes",
]);
const FORBIDDEN_QUERY_FIELDS = new Set([
  "actor_id",
  "identity_id",
  "tenant_id",
  "campus_id",
  "role",
  "publication",
  "status",
  "version",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasForbiddenQueryClaim(request: FastifyRequest): boolean {
  const query = isRecord(request.query) ? request.query : {};
  return Object.keys(query).some((key) => FORBIDDEN_QUERY_FIELDS.has(key));
}

function profileId(request: FastifyRequest): string {
  return (request.params as { profileId: string }).profileId;
}

function validDraftBody(value: unknown): value is DraftRequestBody {
  if (!isRecord(value) || [...Object.keys(value)].some((key) => !BODY_KEYS.has(key))) return false;
  if (
    !isRecord(value.payload) ||
    [...Object.keys(value.payload)].some((key) => !PAYLOAD_KEYS.has(key))
  ) {
    return false;
  }
  return (
    value.expected_version === undefined ||
    value.expected_version === null ||
    (typeof value.expected_version === "number" && Number.isInteger(value.expected_version))
  );
}

function contextFromRequest(request: FastifyRequest): TeacherActorContext | undefined {
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
  const campusId = scope.campusId ?? membership.campus_ids[0];
  if (campusId === undefined) return undefined;
  return {
    trusted: true,
    actorId: scope.actorId,
    activeMembership: true,
    scope: { tenantId: scope.tenantId, campusId },
    capabilities: membership.capabilities,
  };
}

function statusFor<T>(result: TeacherProfileResult<T>): number {
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
  result: TeacherProfileResult<T>,
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
    error: { code: "VALIDATION_FAILED", message: "Teacher profile input is invalid." },
    request_id: request.id,
  });
}

function forbiddenFailure(
  request: FastifyRequest,
  reply: { code: (status: number) => { send: (body: unknown) => unknown } },
) {
  return reply.code(403).send({
    error: {
      code: "FORBIDDEN_SCOPE",
      message: "Teacher profile scope access is not permitted.",
    },
    request_id: request.id,
  });
}

export function registerPublicTeacherRoutes(
  app: FastifyInstance,
  service: TeacherProfileService,
  publicScopeResolver?: PublicTeacherScopeResolver,
): void {
  app.post(
    "/admin/teachers/:profileId/draft",
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
        service.createDraft(
          context,
          profileId(request),
          body.payload,
          body.expected_version ?? null,
        ),
        201,
      );
    },
  );

  app.put(
    "/admin/teachers/:profileId/draft",
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
        service.updateDraft(context, profileId(request), body.payload, body.expected_version),
      );
    },
  );

  for (const action of ["publish", "unpublish"] as const) {
    app.post(
      `/admin/teachers/:profileId/${action}`,
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
            ? service.publish(context, profileId(request), body.expected_version)
            : service.unpublish(context, profileId(request), body.expected_version);
        return sendResult(request, reply, result);
      },
    );
  }

  app.get(
    "/public/teachers/:profileId",
    { config: { authRequired: false, scopeRequired: false } },
    async (request, reply) => {
      if (hasForbiddenQueryClaim(request)) return validationFailure(request, reply);
      const scope = await publicScopeResolver?.(request);
      if (scope === undefined) return forbiddenFailure(request, reply);
      return sendResult(request, reply, service.readPublic(scope, profileId(request)));
    },
  );
}
