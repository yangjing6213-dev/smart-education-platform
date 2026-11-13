import { resolveAuthContext, type AuthResolution } from "@student-care/auth";
import {
  ATTENDANCE_CORRECTION_REASONS,
  ATTENDANCE_STATUSES,
  type AttendanceCorrectionInput,
  type AttendanceCreateInput,
  type AttendanceReviewInput,
  type AttendanceTransitionInput,
  type AttendanceValues,
} from "@student-care/contracts";
import { resolveScope, type ScopeContext } from "@student-care/tenant";
import { Body, Controller, Get, Inject, Param, Post, Req, Res } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { containsForgedIdentityClaim } from "../plugins/forged-identity-claims.js";
import {
  ATTENDANCE_SERVICE,
  type AttendanceCapability,
  type AttendanceContext,
  type AttendanceOperations,
  type AttendanceResult,
} from "../modules/attendance/prisma-attendance.service.js";
import {
  TRUSTED_AUTH_PROVIDER,
  type ApiHttpRequest,
  type ApiHttpResponse,
  type TrustedAuthProvider,
} from "./api-tokens.js";

type AccessResult =
  | { readonly ok: true; readonly context: AttendanceContext }
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

function contextScopes(auth: AuthResolution): AttendanceContext | undefined {
  if (!auth.ok) return undefined;
  const scopes = new Map<
    string,
    { scope: ScopeContext; capabilities: Set<AttendanceCapability> }
  >();
  const validCapabilities: readonly AttendanceCapability[] = [
    "attendance:write",
    "attendance:review",
    "attendance:read",
  ];
  for (const membership of auth.context.memberships) {
    if (membership.status !== "ACTIVE") continue;
    const capabilities = membership.capabilities.filter((value): value is AttendanceCapability =>
      validCapabilities.includes(value as AttendanceCapability),
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

function isTime(value: unknown): value is string {
  return typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function isAttendanceValues(value: unknown): value is AttendanceValues {
  if (!exactBody(value, ["status", "arrival_time", "departure_time"])) return false;
  if (!ATTENDANCE_STATUSES.includes(value.status as (typeof ATTENDANCE_STATUSES)[number]))
    return false;
  if (value.status === "NOT_ARRIVED")
    return value.arrival_time === null && value.departure_time === null;
  if (value.status === "ARRIVED")
    return isTime(value.arrival_time) && value.departure_time === null;
  return (
    isTime(value.arrival_time) &&
    isTime(value.departure_time) &&
    value.departure_time >= value.arrival_time
  );
}

function createInput(value: unknown): AttendanceCreateInput | undefined {
  if (
    !exactBody(value, ["student_id", "service_date"]) ||
    !isUuid(value.student_id) ||
    !isDate(value.service_date)
  )
    return undefined;
  return { student_id: value.student_id, service_date: value.service_date };
}

function transitionInput(value: unknown): AttendanceTransitionInput | undefined {
  if (!exactBody(value, ["version", "time"]) || !isVersion(value.version) || !isTime(value.time))
    return undefined;
  return { version: value.version, time: value.time };
}

function correctionInput(value: unknown): AttendanceCorrectionInput | undefined {
  if (
    !exactBody(value, ["version", "reason", "proposed"]) ||
    !isVersion(value.version) ||
    !ATTENDANCE_CORRECTION_REASONS.includes(
      value.reason as (typeof ATTENDANCE_CORRECTION_REASONS)[number],
    ) ||
    !isAttendanceValues(value.proposed)
  )
    return undefined;
  return {
    version: value.version,
    reason: value.reason as AttendanceCorrectionInput["reason"],
    proposed: value.proposed,
  };
}

function reviewInput(value: unknown): AttendanceReviewInput | undefined {
  if (
    !exactBody(value, ["version", "action"]) ||
    !isVersion(value.version) ||
    (value.action !== "approve" && value.action !== "return")
  )
    return undefined;
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
  value: AttendanceResult<T>,
  response: ApiHttpResponse,
  requestId: string,
  successStatus = 200,
): unknown {
  if (!value.ok) {
    const status =
      value.error.code === "NOT_FOUND_SCOPED"
        ? 404
        : value.error.code === "VALIDATION_FAILED"
          ? 400
          : value.error.code === "FORBIDDEN_ACTOR"
            ? 403
            : 409;
    return response.status(status).json({ error: value.error, request_id: requestId });
  }
  return response.status(successStatus).json({ data: value.data, request_id: requestId });
}

@Controller()
export class AttendanceController {
  public constructor(
    @Inject(ATTENDANCE_SERVICE) private readonly service: AttendanceOperations,
    @Inject(TRUSTED_AUTH_PROVIDER) private readonly getTrustedAuthResult: TrustedAuthProvider,
  ) {}

  private async authorize(
    request: ApiHttpRequest,
    required: AttendanceCapability | readonly AttendanceCapability[],
  ): Promise<AccessResult> {
    if (containsForgedIdentityClaim(request.query, request.headers)) return accessError(401);
    if (rejectScopeHeader(request)) return accessError(400);
    const auth = resolveAuthContext(await this.getTrustedAuthResult(request));
    const context = contextScopes(auth);
    if (context === undefined) return accessError(auth.ok ? 403 : 401);
    const capabilities = Array.isArray(required) ? required : [required];
    if (
      !context.scopes.some((scope) =>
        capabilities.some((capability) => scope.capabilities.includes(capability)),
      )
    )
      return accessError(403);
    return { ok: true, context };
  }

  private async access(
    request: ApiHttpRequest,
    response: ApiHttpResponse,
    requestId: string,
    required: AttendanceCapability | readonly AttendanceCapability[],
  ): Promise<AttendanceContext | undefined> {
    const access = await this.authorize(request, required);
    if (!access.ok) {
      response.status(access.status).json(errorBody(access.code, access.message, requestId));
      return undefined;
    }
    if (Object.keys(request.query).length > 0) {
      response.status(400).json(errorBody("VALIDATION_FAILED", "Request is invalid.", requestId));
      return undefined;
    }
    return access.context;
  }

  @Get("staff/attendance-students")
  public async listStudents(
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const context = await this.access(request, response, requestId, "attendance:write");
    if (context === undefined) return;
    return response.status(200).json({
      data: await this.service.listStaffStudents(context),
      request_id: requestId,
    });
  }

  @Get("staff/attendance-records")
  public async listStaff(
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const context = await this.access(request, response, requestId, [
      "attendance:write",
      "attendance:review",
    ]);
    if (context === undefined) return;
    return response.status(200).json({
      data: await this.service.listStaff(context),
      request_id: requestId,
    });
  }

  @Post("staff/attendance-records")
  public async create(
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const context = await this.access(request, response, requestId, "attendance:write");
    if (context === undefined) return;
    const input = createInput(body);
    if (input === undefined)
      return response
        .status(400)
        .json(errorBody("VALIDATION_FAILED", "Request is invalid.", requestId));
    return sendResult(await this.service.create(context, input), response, requestId, 201);
  }

  @Get("staff/attendance-records/:recordId")
  public async getStaff(
    @Param("recordId") recordId: string,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const context = await this.access(request, response, requestId, [
      "attendance:write",
      "attendance:review",
    ]);
    if (context === undefined) return;
    if (!isUuid(recordId))
      return response
        .status(400)
        .json(errorBody("VALIDATION_FAILED", "Request is invalid.", requestId));
    return sendResult(await this.service.getStaff(context, recordId), response, requestId);
  }

  @Post("staff/attendance-records/:recordId/arrive")
  public async arrive(
    @Param("recordId") recordId: string,
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    return this.transition(recordId, body, request, response, "arrive");
  }

  @Post("staff/attendance-records/:recordId/depart")
  public async depart(
    @Param("recordId") recordId: string,
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    return this.transition(recordId, body, request, response, "depart");
  }

  private async transition(
    recordId: string,
    body: unknown,
    request: ApiHttpRequest,
    response: ApiHttpResponse,
    action: "arrive" | "depart",
  ): Promise<unknown> {
    const requestId = randomUUID();
    const context = await this.access(request, response, requestId, "attendance:write");
    if (context === undefined) return;
    if (!isUuid(recordId))
      return response
        .status(400)
        .json(errorBody("VALIDATION_FAILED", "Request is invalid.", requestId));
    const input = transitionInput(body);
    if (input === undefined)
      return response
        .status(400)
        .json(errorBody("VALIDATION_FAILED", "Request is invalid.", requestId));
    return sendResult(
      await this.service.transition(context, recordId, input, action),
      response,
      requestId,
    );
  }

  @Post("staff/attendance-records/:recordId/correction")
  public async requestCorrection(
    @Param("recordId") recordId: string,
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const context = await this.access(request, response, requestId, "attendance:write");
    if (context === undefined) return;
    if (!isUuid(recordId))
      return response
        .status(400)
        .json(errorBody("VALIDATION_FAILED", "Request is invalid.", requestId));
    const input = correctionInput(body);
    if (input === undefined)
      return response
        .status(400)
        .json(errorBody("VALIDATION_FAILED", "Request is invalid.", requestId));
    return sendResult(
      await this.service.requestCorrection(context, recordId, input),
      response,
      requestId,
    );
  }

  @Post("staff/attendance-records/:recordId/review")
  public async reviewCorrection(
    @Param("recordId") recordId: string,
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const context = await this.access(request, response, requestId, "attendance:review");
    if (context === undefined) return;
    if (!isUuid(recordId))
      return response
        .status(400)
        .json(errorBody("VALIDATION_FAILED", "Request is invalid.", requestId));
    const input = reviewInput(body);
    if (input === undefined)
      return response
        .status(400)
        .json(errorBody("VALIDATION_FAILED", "Request is invalid.", requestId));
    return sendResult(
      await this.service.reviewCorrection(context, recordId, input),
      response,
      requestId,
    );
  }

  @Get("parent/attendance-records")
  public async listParent(
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const context = await this.access(request, response, requestId, "attendance:read");
    if (context === undefined) return;
    return response.status(200).json({
      data: await this.service.listParent(context),
      request_id: requestId,
    });
  }

  @Get("parent/attendance-records/:recordId")
  public async getParent(
    @Param("recordId") recordId: string,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const context = await this.access(request, response, requestId, "attendance:read");
    if (context === undefined) return;
    if (!isUuid(recordId))
      return response
        .status(400)
        .json(errorBody("VALIDATION_FAILED", "Request is invalid.", requestId));
    return sendResult(await this.service.getParent(context, recordId), response, requestId);
  }
}
