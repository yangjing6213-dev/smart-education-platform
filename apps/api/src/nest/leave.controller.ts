import { resolveAuthContext, type AuthResolution } from "@student-care/auth";
import {
  LEAVE_REASON_CATEGORIES,
  type LeaveRequestCreateInput,
  type LeaveRequestResubmitInput,
  type LeaveRequestReviewInput,
  type LeaveRequestVersionInput,
} from "@student-care/contracts";
import { resolveScope, type ScopeContext } from "@student-care/tenant";
import { Body, Controller, Get, Inject, Param, Post, Req, Res } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { containsForgedIdentityClaim } from "../plugins/forged-identity-claims.js";
import {
  LEAVE_SERVICE,
  type LeaveCapability,
  type LeaveContext,
  type LeaveOperations,
  type LeaveResult,
} from "../modules/leave/prisma-leave.service.js";
import {
  TRUSTED_AUTH_PROVIDER,
  type ApiHttpRequest,
  type ApiHttpResponse,
  type TrustedAuthProvider,
} from "./api-tokens.js";

type AccessResult =
  | { readonly ok: true; readonly context: LeaveContext }
  | {
      readonly ok: false;
      readonly status: 400 | 401 | 403;
      readonly code: "VALIDATION_FAILED" | "UNAUTHENTICATED" | "FORBIDDEN_SCOPE";
      readonly message: string;
    };

function accessError(status: 400 | 401 | 403): Extract<AccessResult, { readonly ok: false }> {
  if (status === 401) {
    return { ok: false, status, code: "UNAUTHENTICATED", message: "Authentication is required." };
  }
  if (status === 403) {
    return {
      ok: false,
      status,
      code: "FORBIDDEN_SCOPE",
      message: "Scope access is not permitted.",
    };
  }
  return { ok: false, status, code: "VALIDATION_FAILED", message: "Request is invalid." };
}

function contextScopes(auth: AuthResolution): LeaveContext | undefined {
  if (!auth.ok) return undefined;
  const scopes = new Map<string, { scope: ScopeContext; capabilities: Set<LeaveCapability> }>();
  const validCapabilities: readonly LeaveCapability[] = [
    "leave:apply",
    "leave:review",
    "leave:read",
  ];
  for (const membership of auth.context.memberships) {
    if (membership.status !== "ACTIVE") continue;
    const capabilities = membership.capabilities.filter((value): value is LeaveCapability =>
      validCapabilities.includes(value as LeaveCapability),
    );
    if (capabilities.length === 0) continue;
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
      if (!resolved.ok) continue;
      const key = `${membership.tenant_id}:${campusId}`;
      const existing = scopes.get(key);
      if (existing === undefined) {
        scopes.set(key, { scope: resolved.scopeContext, capabilities: new Set(capabilities) });
      } else {
        for (const capability of capabilities) existing.capabilities.add(capability);
      }
    }
  }
  return {
    scopes: [...scopes.values()].map(({ scope, capabilities }) => ({
      scope,
      capabilities: [...capabilities],
    })),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactBody(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return (
    isRecord(value) &&
    Object.keys(value).length === keys.length &&
    Object.keys(value).every((key) => keys.includes(key))
  );
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

function isVersion(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

function isDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function createInput(value: unknown): LeaveRequestCreateInput | undefined {
  if (
    !exactBody(value, ["student_id", "start_date", "end_date", "reason_category"]) ||
    !isUuid(value.student_id) ||
    !isDate(value.start_date) ||
    !isDate(value.end_date) ||
    value.start_date > value.end_date ||
    !LEAVE_REASON_CATEGORIES.includes(
      value.reason_category as (typeof LEAVE_REASON_CATEGORIES)[number],
    )
  ) {
    return undefined;
  }
  return {
    student_id: value.student_id,
    start_date: value.start_date,
    end_date: value.end_date,
    reason_category: value.reason_category as LeaveRequestCreateInput["reason_category"],
  };
}

function resubmitInput(value: unknown): LeaveRequestResubmitInput | undefined {
  if (
    !exactBody(value, ["version", "start_date", "end_date", "reason_category"]) ||
    !isVersion(value.version) ||
    !isDate(value.start_date) ||
    !isDate(value.end_date) ||
    value.start_date > value.end_date ||
    !LEAVE_REASON_CATEGORIES.includes(
      value.reason_category as (typeof LEAVE_REASON_CATEGORIES)[number],
    )
  ) {
    return undefined;
  }
  return {
    version: value.version,
    start_date: value.start_date,
    end_date: value.end_date,
    reason_category: value.reason_category as LeaveRequestResubmitInput["reason_category"],
  };
}

function versionInput(value: unknown): LeaveRequestVersionInput | undefined {
  if (!exactBody(value, ["version"]) || !isVersion(value.version)) return undefined;
  return { version: value.version };
}

function reviewInput(value: unknown): LeaveRequestReviewInput | undefined {
  if (
    !exactBody(value, ["version", "action"]) ||
    !isVersion(value.version) ||
    (value.action !== "confirm" && value.action !== "return")
  ) {
    return undefined;
  }
  return { version: value.version, action: value.action };
}

function errorBody(code: string, message: string, requestId: string) {
  return { error: { code, message }, request_id: requestId };
}

function rejectScopeHeader(request: ApiHttpRequest): boolean {
  return (
    request.headers["x-tenant-id"] !== undefined || request.headers["x-campus-id"] !== undefined
  );
}

function sendResult<T>(
  result: LeaveResult<T>,
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
          : 409;
    return response.status(status).json({ error: result.error, request_id: requestId });
  }
  return response.status(successStatus).json({ data: result.data, request_id: requestId });
}

@Controller()
export class LeaveController {
  public constructor(
    @Inject(LEAVE_SERVICE) private readonly service: LeaveOperations,
    @Inject(TRUSTED_AUTH_PROVIDER) private readonly getTrustedAuthResult: TrustedAuthProvider,
  ) {}

  private async access(
    request: ApiHttpRequest,
    response: ApiHttpResponse,
    requestId: string,
    required: LeaveCapability,
  ): Promise<LeaveContext | undefined> {
    if (containsForgedIdentityClaim(request.query, request.headers)) {
      response
        .status(401)
        .json(errorBody("UNAUTHENTICATED", "Authentication is required.", requestId));
      return undefined;
    }
    if (rejectScopeHeader(request) || Object.keys(request.query).length > 0) {
      response.status(400).json(errorBody("VALIDATION_FAILED", "Request is invalid.", requestId));
      return undefined;
    }
    const auth = resolveAuthContext(await this.getTrustedAuthResult(request));
    const context = contextScopes(auth);
    if (context === undefined) {
      const error = accessError(auth.ok ? 403 : 401);
      response.status(error.status).json(errorBody(error.code, error.message, requestId));
      return undefined;
    }
    if (!context.scopes.some(({ capabilities }) => capabilities.includes(required))) {
      const error = accessError(403);
      response.status(error.status).json(errorBody(error.code, error.message, requestId));
      return undefined;
    }
    return context;
  }

  private validRequestId(requestId: string, response: ApiHttpResponse, id: string): boolean {
    if (isUuid(id)) return true;
    response.status(400).json(errorBody("VALIDATION_FAILED", "Request is invalid.", requestId));
    return false;
  }

  @Get("parent/leave-requests")
  public async listParent(
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const context = await this.access(request, response, requestId, "leave:read");
    if (context === undefined) return;
    return response
      .status(200)
      .json({ data: await this.service.listParent(context), request_id: requestId });
  }

  @Post("parent/leave-requests")
  public async create(
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const context = await this.access(request, response, requestId, "leave:apply");
    if (context === undefined) return;
    const input = createInput(body);
    if (input === undefined)
      return response
        .status(400)
        .json(errorBody("VALIDATION_FAILED", "Request is invalid.", requestId));
    return sendResult(await this.service.create(context, input), response, requestId, 201);
  }

  @Post("parent/leave-requests/:requestId/resubmit")
  public async resubmit(
    @Param("requestId") id: string,
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const context = await this.access(request, response, requestId, "leave:apply");
    if (context === undefined) return;
    if (!this.validRequestId(requestId, response, id)) return;
    const input = resubmitInput(body);
    if (input === undefined)
      return response
        .status(400)
        .json(errorBody("VALIDATION_FAILED", "Request is invalid.", requestId));
    return sendResult(await this.service.resubmit(context, id, input), response, requestId);
  }

  @Post("parent/leave-requests/:requestId/withdraw")
  public async withdraw(
    @Param("requestId") id: string,
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const context = await this.access(request, response, requestId, "leave:apply");
    if (context === undefined) return;
    if (!this.validRequestId(requestId, response, id)) return;
    const input = versionInput(body);
    if (input === undefined)
      return response
        .status(400)
        .json(errorBody("VALIDATION_FAILED", "Request is invalid.", requestId));
    return sendResult(await this.service.withdraw(context, id, input), response, requestId);
  }

  @Post("parent/leave-requests/:requestId/acknowledge")
  public async acknowledge(
    @Param("requestId") id: string,
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const context = await this.access(request, response, requestId, "leave:apply");
    if (context === undefined) return;
    if (!this.validRequestId(requestId, response, id)) return;
    const input = versionInput(body);
    if (input === undefined)
      return response
        .status(400)
        .json(errorBody("VALIDATION_FAILED", "Request is invalid.", requestId));
    return sendResult(await this.service.acknowledge(context, id, input), response, requestId);
  }

  @Get("staff/leave-requests")
  public async listStaff(
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const context = await this.access(request, response, requestId, "leave:review");
    if (context === undefined) return;
    return response
      .status(200)
      .json({ data: await this.service.listStaff(context), request_id: requestId });
  }

  @Post("staff/leave-requests/:requestId/review")
  public async review(
    @Param("requestId") id: string,
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const context = await this.access(request, response, requestId, "leave:review");
    if (context === undefined) return;
    if (!this.validRequestId(requestId, response, id)) return;
    const input = reviewInput(body);
    if (input === undefined)
      return response
        .status(400)
        .json(errorBody("VALIDATION_FAILED", "Request is invalid.", requestId));
    return sendResult(await this.service.review(context, id, input), response, requestId);
  }
}
