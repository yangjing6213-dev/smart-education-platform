import { resolveAuthContext, type AuthResolution } from "@student-care/auth";
import { resolveScope, type ScopeContext } from "@student-care/tenant";
import { Body, Controller, Get, Inject, Param, Patch, Post, Req, Res } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { containsForgedIdentityClaim } from "../plugins/forged-identity-claims.js";
import {
  STAFF_DAILY_OPERATIONS,
  TRUSTED_AUTH_PROVIDER,
  type ApiHttpRequest,
  type ApiHttpResponse,
  type StaffDailyCapability,
  type StaffDailyContext,
  type StaffDailyOperations,
  type StaffDailyResult,
  type TrustedAuthProvider,
} from "./api-tokens.js";

type AccessResult =
  | { readonly ok: true; readonly context: StaffDailyContext }
  | {
      readonly ok: false;
      readonly status: 400 | 401 | 403;
      readonly code: "VALIDATION_FAILED" | "UNAUTHENTICATED" | "FORBIDDEN_SCOPE";
      readonly message: string;
    };

function accessError(status: 400 | 401 | 403): Extract<AccessResult, { readonly ok: false }> {
  if (status === 401)
    return { ok: false, status, code: "UNAUTHENTICATED", message: "Authentication is required." };
  if (status === 403)
    return {
      ok: false,
      status,
      code: "FORBIDDEN_SCOPE",
      message: "Scope access is not permitted.",
    };
  return { ok: false, status, code: "VALIDATION_FAILED", message: "Request is invalid." };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactBody(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return (
    isObject(value) &&
    Object.keys(value).length === keys.length &&
    Object.keys(value).every((key) => keys.includes(key))
  );
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value)
  );
}

function isDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function values(value: unknown): Record<string, string> | undefined {
  const fields = ["arrival", "homework", "activity", "classroom", "followUp"] as const;
  if (!exactBody(value, fields)) return undefined;
  if (fields.some((field) => typeof value[field] !== "string")) return undefined;
  return value as Record<string, string>;
}

function createBody(
  value: unknown,
): { readonly date: string; readonly values: Record<string, string> } | undefined {
  if (!exactBody(value, ["date", "values"]) || !isDate(value.date)) return undefined;
  const reportValues = values(value.values);
  return reportValues ? { date: value.date, values: reportValues } : undefined;
}

function updateBody(
  value: unknown,
): { readonly version: number; readonly values: Record<string, string> } | undefined {
  if (
    !exactBody(value, ["version", "values"]) ||
    !Number.isSafeInteger(value.version) ||
    (value.version as number) < 1
  )
    return undefined;
  const reportValues = values(value.values);
  return reportValues ? { version: value.version as number, values: reportValues } : undefined;
}

function versionBody(value: unknown): { readonly version: number } | undefined {
  if (
    !exactBody(value, ["version"]) ||
    !Number.isSafeInteger(value.version) ||
    (value.version as number) < 1
  )
    return undefined;
  return { version: value.version as number };
}

function contextScopes(auth: AuthResolution): StaffDailyContext | undefined {
  if (!auth.ok) return undefined;
  const capabilitiesAllowed: readonly StaffDailyCapability[] = [
    "daily:read",
    "daily:create",
    "daily:submit",
    "daily:review",
  ];
  const scopes: {
    readonly scope: ScopeContext;
    readonly capabilities: readonly StaffDailyCapability[];
  }[] = [];
  for (const membership of auth.context.memberships) {
    if (membership.status !== "ACTIVE") continue;
    const capabilities = capabilitiesAllowed.filter((capability) =>
      membership.capabilities.includes(capability as never),
    );
    if (!capabilities.length) continue;
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
  return scopes.length ? { scopes } : undefined;
}

function errorBody(code: string, message: string, requestId: string) {
  return { error: { code, message }, request_id: requestId };
}

function unsupportedScopeHeader(request: ApiHttpRequest): boolean {
  return (
    request.headers["x-tenant-id"] !== undefined || request.headers["x-campus-id"] !== undefined
  );
}

function sendResult<T>(
  result: StaffDailyResult<T>,
  response: ApiHttpResponse,
  requestId: string,
  successStatus = 200,
): unknown {
  if (!result.ok) {
    const status =
      result.error.code === "NOT_FOUND_SCOPED"
        ? 404
        : result.error.code === "VALIDATION_FAILED"
          ? 400
          : result.error.code === "CONFLICT_STATE"
            ? 409
            : 403;
    return response
      .status(status)
      .json(errorBody(result.error.code, result.error.message, requestId));
  }
  return response.status(successStatus).json({ data: result.data, request_id: requestId });
}

@Controller()
export class StaffDailyController {
  public constructor(
    @Inject(STAFF_DAILY_OPERATIONS) private readonly service: StaffDailyOperations,
    @Inject(TRUSTED_AUTH_PROVIDER) private readonly getTrustedAuthResult: TrustedAuthProvider,
  ) {}

  private async authorize(
    request: ApiHttpRequest,
    required: StaffDailyCapability,
  ): Promise<AccessResult> {
    if (containsForgedIdentityClaim(request.query, request.headers)) return accessError(401);
    if (unsupportedScopeHeader(request)) return accessError(400);
    const auth = resolveAuthContext(await this.getTrustedAuthResult(request));
    const context = contextScopes(auth);
    if (!context) return accessError(auth.ok ? 403 : 401);
    if (!context.scopes.some(({ capabilities }) => capabilities.includes(required)))
      return accessError(403);
    return { ok: true, context };
  }

  private rejectQuery(request: ApiHttpRequest): boolean {
    return Object.keys(request.query).length > 0;
  }

  private sendAccessError(
    response: ApiHttpResponse,
    requestId: string,
    access: Extract<AccessResult, { readonly ok: false }>,
  ): unknown {
    return response.status(access.status).json(errorBody(access.code, access.message, requestId));
  }

  @Get("admin/daily-reports")
  public async reviewList(
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = await this.authorize(request, "daily:review");
    if (!access.ok) return this.sendAccessError(response, requestId, access);
    if (this.rejectQuery(request))
      return response
        .status(400)
        .json(errorBody("VALIDATION_FAILED", "Request is invalid.", requestId));
    return sendResult(await this.service.reviewList(access.context), response, requestId);
  }

  @Get("admin/daily-reports/:reportId/audit-events")
  public async auditEvents(
    @Param("reportId") reportId: string,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = await this.authorize(request, "daily:review");
    if (!access.ok) return this.sendAccessError(response, requestId, access);
    if (this.rejectQuery(request) || !isUuid(reportId))
      return response
        .status(400)
        .json(errorBody("VALIDATION_FAILED", "Request is invalid.", requestId));
    return sendResult(
      await this.service.auditEvents(access.context, reportId),
      response,
      requestId,
    );
  }

  @Post("admin/daily-reports/:reportId/review")
  public async review(
    @Param("reportId") reportId: string,
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = await this.authorize(request, "daily:review");
    if (!access.ok) return this.sendAccessError(response, requestId, access);
    if (
      this.rejectQuery(request) ||
      !isUuid(reportId) ||
      !exactBody(body, ["version", "action"]) ||
      !versionBody({ version: body.version }) ||
      (body.action !== "CONFIRM" && body.action !== "RETURN")
    )
      return response
        .status(400)
        .json(errorBody("VALIDATION_FAILED", "Request is invalid.", requestId));
    return sendResult(
      await this.service.review(access.context, reportId, body),
      response,
      requestId,
    );
  }

  @Post("admin/daily-reports/:reportId/withdraw")
  public async withdraw(
    @Param("reportId") reportId: string,
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = await this.authorize(request, "daily:review");
    if (!access.ok) return this.sendAccessError(response, requestId, access);
    const input = versionBody(body);
    if (this.rejectQuery(request) || !isUuid(reportId) || !input)
      return response
        .status(400)
        .json(errorBody("VALIDATION_FAILED", "Request is invalid.", requestId));
    return sendResult(
      await this.service.withdraw(access.context, reportId, input),
      response,
      requestId,
    );
  }

  @Get("staff/daily-reports")
  public async list(
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = await this.authorize(request, "daily:read");
    if (!access.ok) return this.sendAccessError(response, requestId, access);
    if (this.rejectQuery(request))
      return response
        .status(400)
        .json(errorBody("VALIDATION_FAILED", "Request is invalid.", requestId));
    return sendResult(await this.service.list(access.context), response, requestId);
  }

  @Post("staff/daily-reports")
  public async create(
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = await this.authorize(request, "daily:create");
    if (!access.ok) return this.sendAccessError(response, requestId, access);
    const input = createBody(body);
    if (this.rejectQuery(request) || !input)
      return response
        .status(400)
        .json(errorBody("VALIDATION_FAILED", "Request is invalid.", requestId));
    return sendResult(await this.service.create(access.context, input), response, requestId, 201);
  }

  @Patch("staff/daily-reports/:reportId")
  public async edit(
    @Param("reportId") reportId: string,
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = await this.authorize(request, "daily:create");
    if (!access.ok) return this.sendAccessError(response, requestId, access);
    const input = updateBody(body);
    if (this.rejectQuery(request) || !isUuid(reportId) || !input)
      return response
        .status(400)
        .json(errorBody("VALIDATION_FAILED", "Request is invalid.", requestId));
    return sendResult(
      await this.service.edit(access.context, reportId, input),
      response,
      requestId,
    );
  }

  @Post("staff/daily-reports/:reportId/submit")
  public async submit(
    @Param("reportId") reportId: string,
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = await this.authorize(request, "daily:submit");
    if (!access.ok) return this.sendAccessError(response, requestId, access);
    const input = versionBody(body);
    if (this.rejectQuery(request) || !isUuid(reportId) || !input)
      return response
        .status(400)
        .json(errorBody("VALIDATION_FAILED", "Request is invalid.", requestId));
    return sendResult(
      await this.service.submit(access.context, reportId, input),
      response,
      requestId,
    );
  }

  @Post("staff/daily-reports/:reportId/resubmit")
  public async resubmit(
    @Param("reportId") reportId: string,
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = await this.authorize(request, "daily:submit");
    if (!access.ok) return this.sendAccessError(response, requestId, access);
    const input = updateBody(body);
    if (this.rejectQuery(request) || !isUuid(reportId) || !input)
      return response
        .status(400)
        .json(errorBody("VALIDATION_FAILED", "Request is invalid.", requestId));
    return sendResult(
      await this.service.resubmit(access.context, reportId, input),
      response,
      requestId,
    );
  }
}
