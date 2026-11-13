import { resolveAuthContext, type AuthResolution } from "@student-care/auth";
import { Body, Controller, Get, Inject, Param, Post, Req, Res } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { containsForgedIdentityClaim } from "../plugins/forged-identity-claims.js";
import {
  STAFF_HEALTH_INCIDENT_REVIEW_OPERATIONS,
  TRUSTED_AUTH_PROVIDER,
  type ApiHttpRequest,
  type ApiHttpResponse,
  type StaffHealthIncidentReviewContext,
  type StaffHealthIncidentReviewOperations,
  type TrustedAuthProvider,
} from "./api-tokens.js";

type Capability =
  | "health:create"
  | "health:submit"
  | "health:review"
  | "health:supplement"
  | "health:publish"
  | "health:revoke";
type Access =
  | { readonly ok: true; readonly context: StaffHealthIncidentReviewContext }
  | {
      readonly ok: false;
      readonly status: 400 | 401 | 403;
      readonly code: string;
    };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const OBSERVATIONS = ["ROUTINE_OBSERVATION", "NEEDS_FOLLOW_UP", "URGENT_REVIEW"] as const;
const ACTIONS = ["CONFIRM", "RETURN", "ESCALATE"] as const;
const DISPOSITIONS = [
  "OBSERVATION_RECHECKED",
  "FOLLOW_UP_SCHEDULED",
  "GUARDIAN_SUMMARY_PREPARED",
] as const;
const SUMMARIES = [
  "FOLLOW_UP_IN_PROGRESS",
  "FOLLOW_UP_COMPLETED",
  "PLEASE_CHECK_PAGE_LATER",
] as const;

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function access(auth: AuthResolution, required: Capability): Access {
  if (!auth.ok) return { ok: false, status: 401, code: "UNAUTHENTICATED" };
  const actorId = auth.context.identity.actor_id;
  const memberships = auth.context.memberships.filter(
    (membership) => membership.status === "ACTIVE",
  );
  const membership = memberships[0];
  const reviewAction = required !== "health:create" && required !== "health:submit";
  const capabilities: readonly string[] = membership?.capabilities ?? [];
  if (memberships.length !== 1 || !membership || membership.campus_ids.length !== 1)
    return { ok: false, status: 403, code: "FORBIDDEN_SCOPE" };
  if (!capabilities.includes(required) || (reviewAction && !capabilities.includes("health:review")))
    return { ok: false, status: 403, code: "FORBIDDEN_SCOPE" };
  return {
    ok: true,
    context: {
      actorId,
      tenantId: membership.tenant_id,
      campusId: membership.campus_ids[0]!,
      capabilities: membership.capabilities,
    },
  };
}

function validCreateBody(value: unknown): boolean {
  if (!record(value)) return false;
  const keys = Object.keys(value);
  return (
    keys.length === 3 &&
    keys.includes("studentId") &&
    UUID.test(String(value.studentId)) &&
    keys.includes("observationCode") &&
    OBSERVATIONS.includes(value.observationCode as never) &&
    keys.includes("dispositionCode") &&
    DISPOSITIONS.includes(value.dispositionCode as never)
  );
}

function validBody(
  action: "submit" | "review" | "supplement" | "publish" | "revoke",
  value: unknown,
) {
  if (!record(value)) return false;
  const keys = Object.keys(value);
  if (!Number.isSafeInteger(value.version) || Number(value.version) < 1) return false;
  if (action === "review")
    return keys.length === 2 && keys.includes("version") && ACTIONS.includes(value.action as never);
  if (action === "supplement")
    return (
      keys.length === 2 &&
      keys.includes("version") &&
      DISPOSITIONS.includes(value.dispositionCode as never)
    );
  if (action === "publish")
    return (
      keys.length === 2 &&
      keys.includes("version") &&
      SUMMARIES.includes(value.summaryCode as never)
    );
  return keys.length === 1 && keys[0] === "version";
}

function responseError(
  response: ApiHttpResponse,
  status: number,
  code: string,
  requestId: string,
): unknown {
  return response.status(status).json({
    error: {
      code,
      message: status === 401 ? "Authentication is required." : "Request is invalid.",
    },
    request_id: requestId,
  });
}

function operationError(error: unknown, response: ApiHttpResponse, requestId: string): unknown {
  const status =
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    [400, 403, 404, 409].includes(Number(error.statusCode))
      ? (Number(error.statusCode) as 400 | 403 | 404 | 409)
      : 500;
  const code =
    typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
      ? error.code
      : "INTERNAL_ERROR";
  return response.status(status).json({
    error: { code, message: "健康审核服务暂不可用。" },
    request_id: requestId,
  });
}

function invalidScope(request: ApiHttpRequest): boolean {
  return (
    request.headers["x-tenant-id"] !== undefined || request.headers["x-campus-id"] !== undefined
  );
}

@Controller("staff/health-incidents")
export class StaffHealthIncidentReviewController {
  public constructor(
    @Inject(STAFF_HEALTH_INCIDENT_REVIEW_OPERATIONS)
    private readonly operations: StaffHealthIncidentReviewOperations,
    @Inject(TRUSTED_AUTH_PROVIDER)
    private readonly getTrustedAuthResult: TrustedAuthProvider,
  ) {}

  private async authorize(request: ApiHttpRequest, capability: Capability): Promise<Access> {
    if (containsForgedIdentityClaim(request.query, request.headers))
      return { ok: false, status: 401, code: "UNAUTHENTICATED" };
    if (invalidScope(request)) return { ok: false, status: 400, code: "VALIDATION_FAILED" };
    return access(resolveAuthContext(await this.getTrustedAuthResult(request)), capability);
  }

  @Post()
  public async create(
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
    @Body() body: unknown,
  ): Promise<unknown> {
    const requestId = randomUUID();
    if (!validCreateBody(body)) return responseError(response, 400, "VALIDATION_FAILED", requestId);
    const allowed = await this.authorize(request, "health:create");
    if (!allowed.ok) return responseError(response, allowed.status, allowed.code, requestId);
    if (Object.keys(request.query).length > 0)
      return responseError(response, 400, "VALIDATION_FAILED", requestId);
    const create = this.operations.create;
    if (!create) return responseError(response, 501, "OPERATION_UNAVAILABLE", requestId);
    try {
      const data = await create.call(this.operations, allowed.context, body);
      return response.status(201).json({ data, request_id: requestId });
    } catch (error) {
      return operationError(error, response, requestId);
    }
  }

  @Get("students")
  public async listEligibleStudents(
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const allowed = await this.authorize(request, "health:create");
    if (!allowed.ok) return responseError(response, allowed.status, allowed.code, requestId);
    if (Object.keys(request.query).length > 0)
      return responseError(response, 400, "VALIDATION_FAILED", requestId);
    const listStudents = this.operations.listStudents;
    if (!listStudents) return responseError(response, 501, "OPERATION_UNAVAILABLE", requestId);
    try {
      return response.status(200).json({
        data: await listStudents.call(this.operations, allowed.context),
        request_id: requestId,
      });
    } catch (error) {
      return operationError(error, response, requestId);
    }
  }

  @Get("drafts")
  public async listDrafts(
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const allowed = await this.authorize(request, "health:create");
    if (!allowed.ok) return responseError(response, allowed.status, allowed.code, requestId);
    if (Object.keys(request.query).length > 0)
      return responseError(response, 400, "VALIDATION_FAILED", requestId);
    const listDrafts = this.operations.listDrafts;
    if (!listDrafts) return responseError(response, 501, "OPERATION_UNAVAILABLE", requestId);
    try {
      return response.status(200).json({
        data: await listDrafts.call(this.operations, allowed.context),
        request_id: requestId,
      });
    } catch (error) {
      return operationError(error, response, requestId);
    }
  }

  @Get()
  public async list(
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const allowed = await this.authorize(request, "health:review");
    if (!allowed.ok) return responseError(response, allowed.status, allowed.code, requestId);
    if (Object.keys(request.query).length > 0)
      return responseError(response, 400, "VALIDATION_FAILED", requestId);
    try {
      return response.status(200).json({
        data: await this.operations.list(allowed.context),
        request_id: requestId,
      });
    } catch (error) {
      return operationError(error, response, requestId);
    }
  }

  @Post(":incidentId/review")
  public async review(
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
    @Param("incidentId") incidentId: string,
    @Body() body: unknown,
  ): Promise<unknown> {
    return this.mutate("review", request, response, incidentId, body);
  }

  @Post(":incidentId/submit")
  public async submit(
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
    @Param("incidentId") incidentId: string,
    @Body() body: unknown,
  ): Promise<unknown> {
    return this.mutate("submit", request, response, incidentId, body);
  }

  @Post(":incidentId/supplement")
  public async supplement(
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
    @Param("incidentId") incidentId: string,
    @Body() body: unknown,
  ): Promise<unknown> {
    return this.mutate("supplement", request, response, incidentId, body);
  }

  @Post(":incidentId/publish")
  public async publish(
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
    @Param("incidentId") incidentId: string,
    @Body() body: unknown,
  ): Promise<unknown> {
    return this.mutate("publish", request, response, incidentId, body);
  }

  @Post(":incidentId/revoke")
  public async revoke(
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
    @Param("incidentId") incidentId: string,
    @Body() body: unknown,
  ): Promise<unknown> {
    return this.mutate("revoke", request, response, incidentId, body);
  }

  private async mutate(
    action: "submit" | "review" | "supplement" | "publish" | "revoke",
    request: ApiHttpRequest,
    response: ApiHttpResponse,
    incidentId: string,
    body: unknown,
  ): Promise<unknown> {
    const requestId = randomUUID();
    if (!UUID.test(incidentId) || !validBody(action, body))
      return responseError(response, 400, "VALIDATION_FAILED", requestId);
    const capability = `health:${action}` as Capability;
    const allowed = await this.authorize(request, capability);
    if (!allowed.ok) return responseError(response, allowed.status, allowed.code, requestId);
    if (Object.keys(request.query).length > 0)
      return responseError(response, 400, "VALIDATION_FAILED", requestId);
    const operation = this.operations[action];
    if (!operation) return responseError(response, 501, "OPERATION_UNAVAILABLE", requestId);
    try {
      const result = await operation.call(this.operations, allowed.context, incidentId, body);
      return response.status(200).json({ data: result, request_id: requestId });
    } catch (error) {
      return operationError(error, response, requestId);
    }
  }
}
