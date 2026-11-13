import { resolveAuthContext } from "@student-care/auth";
import { resolveScope } from "@student-care/tenant";
import { Body, Controller, Get, Inject, Param, Patch, Post, Req, Res } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type {
  MonthlyFeedbackCapability,
  MonthlyFeedbackContext,
  MonthlyFeedbackResult,
} from "../modules/monthly-feedback/prisma-monthly-feedback.service.js";
import { containsForgedIdentityClaim } from "../plugins/forged-identity-claims.js";
import {
  MONTHLY_FEEDBACK_OPERATIONS,
  TRUSTED_AUTH_PROVIDER,
  type ApiHttpRequest,
  type ApiHttpResponse,
  type MonthlyFeedbackOperations,
  type TrustedAuthProvider,
} from "./api-tokens.js";

type Access =
  { ok: true; context: MonthlyFeedbackContext } | { ok: false; status: 400 | 401 | 403 };
const capabilitiesAllowed: readonly MonthlyFeedbackCapability[] = [
  "feedback:read",
  "feedback:create",
  "feedback:submit",
  "feedback:review",
  "feedback:publish",
];
function exact(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length === keys.length &&
    Object.keys(value).every((key) => keys.includes(key))
  );
}
function validSupplements(value: unknown): boolean {
  return (
    exact(value, [
      "learningParticipation",
      "dailyHabits",
      "activityParticipation",
      "familySchoolCollaboration",
    ]) &&
    Object.values(value).every(
      (item) =>
        typeof item === "string" && ["KEEP_WATCHING", "PROGRESSING", "FOLLOW_UP"].includes(item),
    )
  );
}
function validVersion(value: unknown): boolean {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}
function validId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
}
function error(response: ApiHttpResponse, status: 400 | 401 | 403, requestId: string) {
  const code =
    status === 401 ? "UNAUTHENTICATED" : status === 403 ? "FORBIDDEN_SCOPE" : "VALIDATION_FAILED";
  const message =
    status === 401
      ? "Authentication is required."
      : status === 403
        ? "Scope access is not permitted."
        : "Request is invalid.";
  return response.status(status).json({ error: { code, message }, request_id: requestId });
}
function send<T>(
  result: MonthlyFeedbackResult<T>,
  response: ApiHttpResponse,
  requestId: string,
  status = 200,
) {
  if (result.ok) return response.status(status).json({ data: result.data, request_id: requestId });
  const errorStatus =
    result.error.code === "NOT_FOUND_SCOPED"
      ? 404
      : result.error.code === "CONFLICT_STATE"
        ? 409
        : result.error.code === "VALIDATION_FAILED"
          ? 400
          : 403;
  return response.status(errorStatus).json({ error: result.error, request_id: requestId });
}

@Controller()
export class MonthlyFeedbackController {
  public constructor(
    @Inject(MONTHLY_FEEDBACK_OPERATIONS) private readonly service: MonthlyFeedbackOperations,
    @Inject(TRUSTED_AUTH_PROVIDER) private readonly getTrustedAuthResult: TrustedAuthProvider,
  ) {}

  private async authorize(
    request: ApiHttpRequest,
    required: readonly MonthlyFeedbackCapability[],
  ): Promise<Access> {
    if (containsForgedIdentityClaim(request.query, request.headers))
      return { ok: false, status: 401 };
    if (
      request.headers["x-tenant-id"] !== undefined ||
      request.headers["x-campus-id"] !== undefined
    )
      return { ok: false, status: 400 };
    const auth = resolveAuthContext(await this.getTrustedAuthResult(request));
    if (!auth.ok) return { ok: false, status: 401 };
    const scopes: MonthlyFeedbackContext["scopes"][number][] = [];
    for (const membership of auth.context.memberships) {
      // Require all route permissions on this membership, never borrow from another campus.
      if (
        membership.status !== "ACTIVE" ||
        !required.every((capability) => membership.capabilities.includes(capability))
      )
        continue;
      const capabilities = capabilitiesAllowed.filter((capability) =>
        membership.capabilities.includes(capability),
      );
      for (const campusId of membership.campus_ids) {
        const resolved = resolveScope({
          trustedActor: { actorId: auth.context.identity.actor_id },
          membership: {
            tenantId: membership.tenant_id,
            campusIds: membership.campus_ids,
            status: "ACTIVE",
          },
          requestedCampusId: campusId,
        });
        if (resolved.ok) scopes.push({ scope: resolved.scopeContext, capabilities });
      }
    }
    return scopes.length ? { ok: true, context: { scopes } } : { ok: false, status: 403 };
  }

  @Get("staff/monthly-feedback")
  public async list(
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = await this.authorize(request, ["feedback:read"]);
    if (!access.ok) return error(response, access.status, requestId);
    if (Object.keys(request.query).length) return error(response, 400, requestId);
    return send(await this.service.list(access.context), response, requestId);
  }

  @Get("admin/monthly-feedback")
  public async reviewList(
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = await this.authorize(request, ["feedback:read", "feedback:review"]);
    if (!access.ok) return error(response, access.status, requestId);
    if (Object.keys(request.query).length) return error(response, 400, requestId);
    return send(await this.service.list(access.context), response, requestId);
  }

  @Post("staff/monthly-feedback")
  public async create(
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = await this.authorize(request, ["feedback:create"]);
    if (!access.ok) return error(response, access.status, requestId);
    if (
      Object.keys(request.query).length ||
      !exact(body, ["month", "supplements"]) ||
      typeof body.month !== "string" ||
      !/^(19\d{2}|20\d{2}|21\d{2})-(0[1-9]|1[0-2])$/u.test(body.month) ||
      !validSupplements(body.supplements)
    )
      return error(response, 400, requestId);
    return send(await this.service.create(access.context, body), response, requestId, 201);
  }

  @Patch("staff/monthly-feedback/:id")
  public async edit(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = await this.authorize(request, ["feedback:create"]);
    if (!access.ok) return error(response, access.status, requestId);
    if (
      Object.keys(request.query).length ||
      !validId(id) ||
      !exact(body, ["version", "supplements"]) ||
      !validVersion(body.version) ||
      !validSupplements(body.supplements)
    )
      return error(response, 400, requestId);
    return send(await this.service.edit(access.context, id, body), response, requestId);
  }

  @Post("staff/monthly-feedback/:id/submit")
  public async submit(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = await this.authorize(request, ["feedback:submit"]);
    if (!access.ok) return error(response, access.status, requestId);
    if (
      Object.keys(request.query).length ||
      !validId(id) ||
      !exact(body, ["version"]) ||
      !validVersion(body.version)
    )
      return error(response, 400, requestId);
    return send(await this.service.submit(access.context, id, body), response, requestId);
  }

  @Post("admin/monthly-feedback/:id/review")
  public async review(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = await this.authorize(request, ["feedback:review"]);
    if (!access.ok) return error(response, access.status, requestId);
    if (
      Object.keys(request.query).length ||
      !validId(id) ||
      !exact(body, ["version", "action"]) ||
      !validVersion(body.version) ||
      (body.action !== "CONFIRM" && body.action !== "RETURN")
    )
      return error(response, 400, requestId);
    return send(await this.service.review(access.context, id, body), response, requestId);
  }

  @Post("admin/monthly-feedback/:id/publish")
  public async publish(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = await this.authorize(request, ["feedback:publish"]);
    if (!access.ok) return error(response, access.status, requestId);
    if (
      Object.keys(request.query).length ||
      !validId(id) ||
      !exact(body, ["version"]) ||
      !validVersion(body.version)
    )
      return error(response, 400, requestId);
    return send(await this.service.publish(access.context, id, body), response, requestId);
  }
}
