import { resolveAuthContext, type AuthResolution } from "@student-care/auth";
import { Body, Controller, Get, Inject, Param, Post, Req, Res } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { containsForgedIdentityClaim } from "../plugins/forged-identity-claims.js";
import { uniqueTaskMembership } from "../modules/tasks/staff-task-actions.js";
import {
  STAFF_TASK_WORKBENCH_OPERATIONS,
  TRUSTED_AUTH_PROVIDER,
  type ApiHttpRequest,
  type ApiHttpResponse,
  type StaffTaskWorkbenchContext,
  type StaffTaskWorkbenchOperations,
  type TrustedAuthProvider,
} from "./api-tokens.js";

type Capability =
  | "task:read"
  | "task:claim"
  | "task:start"
  | "task:complete"
  | "task:assign"
  | "task:check"
  | "task:cancel";
type Access =
  | { readonly ok: true; readonly context: StaffTaskWorkbenchContext }
  | { readonly ok: false; readonly status: 400 | 401 | 403; readonly code: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const RESULTS = ["COMPLETED_AS_PLANNED", "FOLLOW_UP_REQUIRED", "BLOCKED"] as const;
const ACTION_CAPABILITIES: Readonly<Record<"claim" | "start" | "complete", Capability>> = {
  claim: "task:claim",
  start: "task:start",
  complete: "task:complete",
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function access(auth: AuthResolution, required: readonly Capability[]): Access {
  if (!auth.ok) return { ok: false, status: 401, code: "UNAUTHENTICATED" };
  const actorId = auth.context.identity.actor_id;
  const membership = uniqueTaskMembership(auth.context.memberships, required);
  if (!membership) return { ok: false, status: 403, code: "FORBIDDEN_SCOPE" };
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

function validBody(action: "claim" | "start" | "complete", value: unknown): boolean {
  if (!record(value)) return false;
  const expectedKeys = action === "complete" ? ["version", "result"] : ["version"];
  if (
    Object.keys(value).length !== expectedKeys.length ||
    Object.keys(value).some((key) => !expectedKeys.includes(key)) ||
    !Number.isSafeInteger(value.version) ||
    (value.version as number) < 1
  )
    return false;
  return action !== "complete" || RESULTS.includes(value.result as (typeof RESULTS)[number]);
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

function unsupportedScope(request: ApiHttpRequest): boolean {
  return (
    request.headers["x-tenant-id"] !== undefined || request.headers["x-campus-id"] !== undefined
  );
}

@Controller()
export class StaffTaskWorkbenchController {
  public constructor(
    @Inject(STAFF_TASK_WORKBENCH_OPERATIONS)
    private readonly operations: StaffTaskWorkbenchOperations,
    @Inject(TRUSTED_AUTH_PROVIDER) private readonly getTrustedAuthResult: TrustedAuthProvider,
  ) {}

  private async authorize(request: ApiHttpRequest, capability: Capability): Promise<Access> {
    if (containsForgedIdentityClaim(request.query, request.headers))
      return { ok: false, status: 401, code: "UNAUTHENTICATED" };
    if (unsupportedScope(request)) return { ok: false, status: 400, code: "VALIDATION_FAILED" };
    return access(resolveAuthContext(await this.getTrustedAuthResult(request)), [
      "task:read",
      capability,
    ]);
  }

  @Get("staff/tasks")
  public async list(
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const allowed = await this.authorize(request, "task:read");
    if (!allowed.ok) return responseError(response, allowed.status, allowed.code, requestId);
    if (Object.keys(request.query).length > 0)
      return responseError(response, 400, "VALIDATION_FAILED", requestId);
    try {
      return response.status(200).json({
        data: await this.operations.list(allowed.context),
        request_id: requestId,
      });
    } catch (cause) {
      return this.operationError(cause, response, requestId);
    }
  }

  @Post("staff/tasks/:taskId/claim")
  public claim(
    @Param("taskId") taskId: string,
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): unknown {
    return this.mutate("claim", taskId, body, request, response);
  }

  @Post("staff/tasks/:taskId/start")
  public start(
    @Param("taskId") taskId: string,
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): unknown {
    return this.mutate("start", taskId, body, request, response);
  }

  @Post("staff/tasks/:taskId/complete")
  public complete(
    @Param("taskId") taskId: string,
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): unknown {
    return this.mutate("complete", taskId, body, request, response);
  }

  @Get("admin/tasks")
  public adminList(
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    return this.manage("adminList", undefined, undefined, request, response);
  }

  @Post("admin/tasks")
  public create(
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    return this.manage("create", undefined, body, request, response);
  }

  @Post("admin/tasks/:taskId/check")
  public check(
    @Param("taskId") id: string,
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    return this.manage("check", id, body, request, response);
  }

  @Post("admin/tasks/:taskId/cancel")
  public cancel(
    @Param("taskId") id: string,
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    return this.manage("cancel", id, body, request, response);
  }

  private async manage(
    action: "adminList" | "create" | "check" | "cancel",
    id: string | undefined,
    body: unknown,
    request: ApiHttpRequest,
    response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const allowed = await this.authorize(
      request,
      action === "adminList"
        ? "task:read"
        : action === "create"
          ? "task:assign"
          : action === "check"
            ? "task:check"
            : "task:cancel",
    );
    if (!allowed.ok) return responseError(response, allowed.status, allowed.code, requestId);
    if (
      action === "adminList" &&
      !["task:assign", "task:check", "task:cancel"].some((capability) =>
        allowed.context.capabilities.includes(capability),
      )
    )
      return responseError(response, 403, "FORBIDDEN_SCOPE", requestId);
    if (Object.keys(request.query).length || (id !== undefined && !UUID.test(id)))
      return responseError(response, 400, "VALIDATION_FAILED", requestId);
    try {
      const data =
        action === "adminList"
          ? await this.operations.adminList(allowed.context)
          : action === "create"
            ? await this.operations.create(allowed.context, body)
            : await this.operations[action](allowed.context, id!, body);
      return response.status(action === "create" ? 201 : 200).json({ data, request_id: requestId });
    } catch (cause) {
      return this.operationError(cause, response, requestId);
    }
  }

  private async mutate(
    action: "claim" | "start" | "complete",
    taskId: string,
    body: unknown,
    request: ApiHttpRequest,
    response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const allowed = await this.authorize(request, ACTION_CAPABILITIES[action]);
    if (!allowed.ok) return responseError(response, allowed.status, allowed.code, requestId);
    if (Object.keys(request.query).length > 0 || !UUID.test(taskId) || !validBody(action, body))
      return responseError(response, 400, "VALIDATION_FAILED", requestId);
    try {
      const data = await this.operations[action](allowed.context, taskId, body);
      return response.status(200).json({ data, request_id: requestId });
    } catch (cause) {
      return this.operationError(cause, response, requestId);
    }
  }

  private operationError(cause: unknown, response: ApiHttpResponse, requestId: string): unknown {
    if (record(cause) && typeof cause.statusCode === "number" && typeof cause.code === "string") {
      const codes: Record<number, string> = {
        400: "VALIDATION_FAILED",
        403: "FORBIDDEN_SCOPE",
        404: "NOT_FOUND_SCOPED",
        409: "CONFLICT_STATE",
      };
      return responseError(
        response,
        cause.statusCode,
        codes[cause.statusCode] ?? cause.code,
        requestId,
      );
    }
    throw cause;
  }
}
