import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ContentOperationResult, DraftPayload } from "../modules/content/content.service.js";
import {
  InstitutionService,
  type InstitutionActorContext,
  type InstitutionContentKind,
  type InstitutionPublicScope,
} from "../modules/institution/institution.service.js";

type RouteKind = "profile" | "home";

type PublicScopeResolver = (
  request: FastifyRequest,
  kind: InstitutionContentKind,
) => InstitutionPublicScope | undefined | Promise<InstitutionPublicScope | undefined>;

interface DraftRequestBody {
  readonly payload: DraftPayload;
  readonly expected_version?: number | null;
}

const BODY_KEYS = new Set(["payload", "expected_version"]);
const PAYLOAD_KEYS = new Set([
  "title",
  "type",
  "visibility",
  "body",
  "editor_note",
  "moderation_state",
  "tenant_admin_note",
  "campus_admin_note",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function routeKind(value: unknown): RouteKind | undefined {
  return value === "profile" || value === "home" ? value : undefined;
}

function contentKey(request: FastifyRequest): string {
  return (request.params as { contentKey: string }).contentKey;
}

function requestKind(request: FastifyRequest): RouteKind | undefined {
  return routeKind((request.params as { kind?: unknown }).kind);
}

function validBody(value: unknown): value is DraftRequestBody {
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

function contextFromRequest(request: FastifyRequest): InstitutionActorContext | undefined {
  const scope = request.scopeContext;
  const authContext = request.authContext;
  if (scope === undefined || authContext === undefined) return undefined;
  if (authContext.identity.actor_id !== scope.actorId) return undefined;
  const membership = authContext.memberships.find(
    (candidate) =>
      candidate.status === "ACTIVE" &&
      candidate.tenant_id === scope.tenantId &&
      (scope.campusId === undefined || candidate.campus_ids.includes(scope.campusId)),
  );
  if (membership === undefined) return undefined;
  return {
    trusted: true,
    actorId: scope.actorId,
    activeMembership: true,
    scope: {
      tenantId: scope.tenantId,
      ...(scope.campusId === undefined ? {} : { campusId: scope.campusId }),
    },
    capabilities: membership.capabilities as readonly string[],
    ...(scope.campusId === undefined ? {} : { auditCampusId: scope.campusId }),
    requestCorrelationId: request.id,
    traceId: request.id,
  };
}

function statusFor<T>(result: ContentOperationResult<T>): number {
  if (result.ok) return 200;
  if (result.error.code === "VALIDATION_FAILED") return 400;
  if (result.error.code === "NOT_FOUND_SCOPED") return 404;
  if (result.error.code === "VERSION_MISMATCH" || result.error.code === "CONFLICT_STATE")
    return 409;
  return 403;
}

function sendResult<T>(
  request: FastifyRequest,
  reply: { code: (status: number) => { send: (body: unknown) => unknown } },
  result: ContentOperationResult<T>,
  successStatus = 200,
) {
  if (!result.ok)
    return reply.code(statusFor(result)).send({ error: result.error, request_id: request.id });
  return reply.code(successStatus).send({ data: result.data, request_id: request.id });
}

export function registerAdminInstitutionRoute(
  app: FastifyInstance,
  service: InstitutionService,
  publicScopeResolver?: PublicScopeResolver,
): void {
  app.post(
    "/admin/institution/:kind/:contentKey/draft",
    { config: { authRequired: true, scopeRequired: true } },
    async (request, reply) => {
      const kind = requestKind(request);
      const context = contextFromRequest(request);
      const body = request.body;
      if (kind === undefined || !validBody(body)) {
        return reply.code(400).send({
          error: { code: "VALIDATION_FAILED", message: "Content input is invalid." },
          request_id: request.id,
        });
      }
      if (context === undefined) {
        return reply.code(403).send({
          error: { code: "FORBIDDEN_SCOPE", message: "Content scope access is not permitted." },
          request_id: request.id,
        });
      }
      const result =
        kind === "profile"
          ? service.createInstitutionDraft(
              context,
              contentKey(request),
              body.payload,
              body.expected_version ?? null,
            )
          : service.createHomeDraft(
              context,
              contentKey(request),
              body.payload,
              body.expected_version ?? null,
            );
      return sendResult(request, reply, result, 201);
    },
  );

  app.put(
    "/admin/institution/:kind/:contentKey/draft",
    { config: { authRequired: true, scopeRequired: true } },
    async (request, reply) => {
      const kind = requestKind(request);
      const context = contextFromRequest(request);
      const body = request.body;
      if (
        kind === undefined ||
        !validBody(body) ||
        body.expected_version === undefined ||
        body.expected_version === null
      ) {
        return reply.code(400).send({
          error: { code: "VALIDATION_FAILED", message: "Content input is invalid." },
          request_id: request.id,
        });
      }
      if (context === undefined) {
        return reply.code(403).send({
          error: { code: "FORBIDDEN_SCOPE", message: "Content scope access is not permitted." },
          request_id: request.id,
        });
      }
      const result =
        kind === "profile"
          ? service.updateInstitutionDraft(
              context,
              contentKey(request),
              body.payload,
              body.expected_version,
            )
          : service.updateHomeDraft(
              context,
              contentKey(request),
              body.payload,
              body.expected_version,
            );
      return sendResult(request, reply, result);
    },
  );

  for (const action of ["publish", "unpublish"] as const) {
    app.post(
      `/admin/institution/:kind/:contentKey/${action}`,
      { config: { authRequired: true, scopeRequired: true } },
      async (request, reply) => {
        const kind = requestKind(request);
        const context = contextFromRequest(request);
        const body = request.body;
        if (
          kind === undefined ||
          context === undefined ||
          !isRecord(body) ||
          Object.keys(body).some((key) => key !== "expected_version") ||
          typeof body.expected_version !== "number" ||
          !Number.isInteger(body.expected_version)
        ) {
          return reply.code(400).send({
            error: { code: "VALIDATION_FAILED", message: "Content input is invalid." },
            request_id: request.id,
          });
        }
        const result =
          action === "publish"
            ? kind === "profile"
              ? service.publishInstitution(context, contentKey(request), body.expected_version)
              : service.publishHome(context, contentKey(request), body.expected_version)
            : kind === "profile"
              ? service.unpublishInstitution(context, contentKey(request), body.expected_version)
              : service.unpublishHome(context, contentKey(request), body.expected_version);
        return sendResult(request, reply, result);
      },
    );
  }

  app.get(
    "/public/institution/:kind/:contentKey",
    { config: { authRequired: false, scopeRequired: false } },
    async (request, reply) => {
      const kind = requestKind(request);
      if (kind === undefined) {
        return reply.code(400).send({
          error: { code: "VALIDATION_FAILED", message: "Content input is invalid." },
          request_id: request.id,
        });
      }
      const scope = await publicScopeResolver?.(
        request,
        kind === "profile" ? "INSTITUTION" : "HOME_BLOCK",
      );
      if (scope === undefined) {
        return reply.code(403).send({
          error: { code: "FORBIDDEN_SCOPE", message: "Content scope access is not permitted." },
          request_id: request.id,
        });
      }
      const result =
        kind === "profile"
          ? service.readInstitutionPublicForVisitor(scope, contentKey(request))
          : service.readHomePublicForVisitor(scope, contentKey(request));
      return sendResult(request, reply, result);
    },
  );
}
