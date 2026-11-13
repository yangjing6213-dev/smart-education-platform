import { resolveAuthContext, type AuthResolution } from "@student-care/auth";
import { Body, Controller, Get, Inject, Param, Post, Req, Res } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { containsForgedIdentityClaim } from "../plugins/forged-identity-claims.js";
import {
  STAFF_NOTICE_OPERATIONS,
  TRUSTED_AUTH_PROVIDER,
  type ApiHttpRequest,
  type ApiHttpResponse,
  type StaffNoticeContext,
  type StaffNoticeOperations,
  type TrustedAuthProvider,
} from "./api-tokens.js";

type Capability =
  "notice:create" | "notice:submit" | "notice:review" | "notice:publish" | "notice:revoke";
type Access =
  | { readonly ok: true; readonly context: StaffNoticeContext }
  | { readonly ok: false; readonly status: 400 | 401 | 403; readonly code: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function access(auth: AuthResolution, required: Capability): Access {
  if (!auth.ok) return { ok: false, status: 401, code: "UNAUTHENTICATED" };
  const memberships = auth.context.memberships.filter(({ status }) => status === "ACTIVE");
  const membership = memberships[0];
  const capabilities = membership?.capabilities ?? [];
  const reviewAction = required === "notice:publish" || required === "notice:revoke";
  if (
    memberships.length !== 1 ||
    !membership ||
    membership.campus_ids.length !== 1 ||
    !capabilities.includes(required) ||
    (reviewAction && !capabilities.includes("notice:review"))
  )
    return { ok: false, status: 403, code: "FORBIDDEN_SCOPE" };
  return {
    ok: true,
    context: {
      actorId: auth.context.identity.actor_id,
      tenantId: membership.tenant_id,
      campusId: membership.campus_ids[0]!,
      capabilities,
    },
  };
}

function invalidScope(request: ApiHttpRequest): boolean {
  return (
    request.headers["x-tenant-id"] !== undefined || request.headers["x-campus-id"] !== undefined
  );
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
    error: { code, message: "通知服务暂不可用。" },
    request_id: requestId,
  });
}

@Controller("staff/notices")
export class StaffNoticesController {
  public constructor(
    @Inject(STAFF_NOTICE_OPERATIONS) private readonly operations: StaffNoticeOperations,
    @Inject(TRUSTED_AUTH_PROVIDER) private readonly getTrustedAuthResult: TrustedAuthProvider,
  ) {}

  private async authorize(request: ApiHttpRequest, capability: Capability): Promise<Access> {
    if (containsForgedIdentityClaim(request.query, request.headers))
      return { ok: false, status: 401, code: "UNAUTHENTICATED" };
    if (invalidScope(request)) return { ok: false, status: 400, code: "VALIDATION_FAILED" };
    return access(resolveAuthContext(await this.getTrustedAuthResult(request)), capability);
  }

  @Get("review")
  public async listForReview(
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const allowed = await this.authorize(request, "notice:review");
    if (!allowed.ok) return responseError(response, allowed.status, allowed.code, requestId);
    if (Object.keys(request.query).length > 0)
      return responseError(response, 400, "VALIDATION_FAILED", requestId);
    try {
      return response.status(200).json({
        data: await this.operations.listForReview(allowed.context),
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
    const allowed = await this.authorize(request, "notice:create");
    if (!allowed.ok) return responseError(response, allowed.status, allowed.code, requestId);
    if (Object.keys(request.query).length > 0)
      return responseError(response, 400, "VALIDATION_FAILED", requestId);
    try {
      return response.status(200).json({
        data: await this.operations.listAuthored(allowed.context),
        request_id: requestId,
      });
    } catch (error) {
      return operationError(error, response, requestId);
    }
  }

  @Post()
  public async create(
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
    @Body() body: unknown,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const allowed = await this.authorize(request, "notice:create");
    if (!allowed.ok) return responseError(response, allowed.status, allowed.code, requestId);
    if (Object.keys(request.query).length > 0)
      return responseError(response, 400, "VALIDATION_FAILED", requestId);
    try {
      return response.status(201).json({
        data: await this.operations.create(allowed.context, body),
        request_id: requestId,
      });
    } catch (error) {
      return operationError(error, response, requestId);
    }
  }

  @Post(":noticeId/submit")
  public async submit(
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
    @Param("noticeId") noticeId: string,
    @Body() body: unknown,
  ): Promise<unknown> {
    return this.mutate("notice:submit", request, response, noticeId, body);
  }

  @Post(":noticeId/review")
  public async review(
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
    @Param("noticeId") noticeId: string,
    @Body() body: unknown,
  ): Promise<unknown> {
    return this.mutate("notice:review", request, response, noticeId, body);
  }

  @Post(":noticeId/publish")
  public async publish(
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
    @Param("noticeId") noticeId: string,
    @Body() body: unknown,
  ): Promise<unknown> {
    return this.mutate("notice:publish", request, response, noticeId, body);
  }

  @Post(":noticeId/revoke")
  public async revoke(
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
    @Param("noticeId") noticeId: string,
    @Body() body: unknown,
  ): Promise<unknown> {
    return this.mutate("notice:revoke", request, response, noticeId, body);
  }

  private async mutate(
    capability: Exclude<Capability, "notice:create">,
    request: ApiHttpRequest,
    response: ApiHttpResponse,
    noticeId: string,
    body: unknown,
  ): Promise<unknown> {
    const requestId = randomUUID();
    if (!UUID.test(noticeId)) return responseError(response, 400, "VALIDATION_FAILED", requestId);
    const allowed = await this.authorize(request, capability);
    if (!allowed.ok) return responseError(response, allowed.status, allowed.code, requestId);
    if (Object.keys(request.query).length > 0)
      return responseError(response, 400, "VALIDATION_FAILED", requestId);
    try {
      const operation =
        capability === "notice:submit"
          ? this.operations.submit
          : capability === "notice:review"
            ? this.operations.review
            : capability === "notice:publish"
              ? this.operations.publish
              : this.operations.revoke;
      return response.status(200).json({
        data: await operation.call(this.operations, allowed.context, noticeId, body),
        request_id: requestId,
      });
    } catch (error) {
      return operationError(error, response, requestId);
    }
  }
}
