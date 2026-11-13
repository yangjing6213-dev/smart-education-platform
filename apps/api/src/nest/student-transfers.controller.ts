import { resolveAuthContext } from "@student-care/auth";
import { resolveScope } from "@student-care/tenant";
import { Body, Controller, Get, Inject, Param, Post, Req, Res } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { containsForgedIdentityClaim } from "../plugins/forged-identity-claims.js";
import {
  parseTransferCreate,
  parseTransferReview,
  StudentTransferFailure,
  TRANSFER_UUID,
  type StudentTransferContext,
  type StudentTransferOperations,
} from "../modules/student-transfers/student-transfer.service.js";
import {
  STUDENT_TRANSFER_OPERATIONS,
  TRUSTED_AUTH_PROVIDER,
  type ApiHttpRequest,
  type ApiHttpResponse,
  type TrustedAuthProvider,
} from "./api-tokens.js";

type Capability = "students:transfer:request" | "students:transfer:review";

@Controller("admin/student-transfers")
export class StudentTransfersController {
  public constructor(
    @Inject(STUDENT_TRANSFER_OPERATIONS) private readonly operations: StudentTransferOperations,
    @Inject(TRUSTED_AUTH_PROVIDER) private readonly trustedAuth: TrustedAuthProvider,
  ) {}

  private async handle(
    request: ApiHttpRequest,
    response: ApiHttpResponse,
    capability: Capability | undefined,
    status: number,
    operation: (context: StudentTransferContext) => Promise<unknown>,
  ) {
    const requestId = randomUUID();
    const fail = (code: string, statusCode: number) =>
      response.status(statusCode).json({
        error: {
          code,
          message:
            statusCode === 401
              ? "请使用机构邀请账号登录。"
              : statusCode === 409
                ? "申请或班级状态已变化，请刷新后处理。"
                : statusCode === 403
                  ? "当前账号无权处理这项转班申请。"
                  : "暂时无法处理转班请求，请检查资料后重试。",
        },
        request_id: requestId,
      });
    if (containsForgedIdentityClaim(request.query, request.headers))
      return fail("UNAUTHENTICATED", 401);
    if (
      Object.keys(request.query).length ||
      ["x-tenant-id", "x-campus-id", "x-class-id", "x-student-id"].some(
        (key) => request.headers[key] !== undefined,
      )
    )
      return fail("VALIDATION_FAILED", 400);
    const auth = resolveAuthContext(await this.trustedAuth(request));
    if (!auth.ok) return fail("UNAUTHENTICATED", 401);
    const contexts = new Map<string, StudentTransferContext>();
    for (const membership of auth.context.memberships) {
      if (
        membership.status !== "ACTIVE" ||
        !(capability
          ? membership.capabilities.includes(capability)
          : membership.capabilities.some(
              (cap) => cap === "students:transfer:request" || cap === "students:transfer:review",
            ))
      )
        continue;
      for (const campusId of membership.campus_ids) {
        const result = resolveScope({
          trustedActor: { actorId: auth.context.identity.actor_id },
          membership: {
            tenantId: membership.tenant_id,
            campusIds: membership.campus_ids,
            status: "ACTIVE",
          },
          requestedCampusId: campusId,
        });
        if (result.ok && result.scopeContext.campusId)
          contexts.set(`${membership.tenant_id}:${campusId}`, {
            actorId: result.scopeContext.actorId,
            tenantId: result.scopeContext.tenantId,
            campusId: result.scopeContext.campusId,
            capabilities: membership.capabilities,
          });
      }
    }
    const context = contexts.size === 1 ? contexts.values().next().value : undefined;
    if (!context) return fail("FORBIDDEN_SCOPE", 403);
    try {
      return response
        .status(status)
        .json({ data: await operation(context), request_id: requestId });
    } catch (error) {
      if (error instanceof StudentTransferFailure) return fail(error.code, error.statusCode);
      return fail("INTERNAL_ERROR", 500);
    }
  }

  @Get()
  public list(@Req() request: ApiHttpRequest, @Res() response: ApiHttpResponse) {
    return this.handle(request, response, undefined, 200, (context) =>
      this.operations.list(context),
    );
  }

  @Post()
  public create(
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ) {
    return this.handle(request, response, "students:transfer:request", 201, (context) =>
      this.operations.create(context, parseTransferCreate(body)),
    );
  }

  @Post(":id/review")
  public review(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ) {
    return this.handle(request, response, "students:transfer:review", 200, (context) => {
      if (!TRANSFER_UUID.test(id)) throw new StudentTransferFailure("VALIDATION_FAILED", 400);
      return this.operations.review(context, id.toLowerCase(), parseTransferReview(body));
    });
  }
}
