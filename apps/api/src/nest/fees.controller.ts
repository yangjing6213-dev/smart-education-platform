import { resolveAuthContext } from "@student-care/auth";
import { resolveScope } from "@student-care/tenant";
import { Body, Controller, Get, Inject, Param, Post, Req, Res } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { containsForgedIdentityClaim } from "../plugins/forged-identity-claims.js";
import {
  FEES_OPERATIONS,
  TRUSTED_AUTH_PROVIDER,
  type ApiHttpRequest,
  type ApiHttpResponse,
  type FeesContext,
  type FeesOperations,
  type TrustedAuthProvider,
} from "./api-tokens.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const DATE = /^\d{4}-\d{2}-\d{2}$/u;
const PERIOD = /^\d{4}-(?:0[1-9]|1[0-2])$/u;
const SCOPE_HEADERS = ["x-tenant-id", "x-campus-id", "x-class-id", "x-student-id"] as const;

type Access =
  | { readonly ok: true; readonly context: FeesContext }
  | { readonly ok: false; readonly status: 400 | 401 | 403; readonly code: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return (
    isRecord(value) &&
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}

function noScopeOverrides(request: ApiHttpRequest): boolean {
  return (
    Object.keys(request.query).length === 0 &&
    !SCOPE_HEADERS.some((name) => request.headers[name] !== undefined)
  );
}

function validDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    DATE.test(value) &&
    Number.isFinite(Date.parse(`${value}T00:00:00.000Z`)) &&
    new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value
  );
}

function validCreateBody(value: unknown): boolean {
  return (
    exactKeys(value, [
      "student_id",
      "document_type",
      "title",
      "period",
      "amount_minor",
      "valid_from",
      "valid_to",
      "summary",
    ]) &&
    typeof value.student_id === "string" &&
    UUID.test(value.student_id) &&
    ["FEE_ITEM", "BILL", "AGREEMENT"].includes(String(value.document_type)) &&
    typeof value.title === "string" &&
    value.title.trim().length > 0 &&
    value.title.length <= 120 &&
    typeof value.period === "string" &&
    PERIOD.test(value.period) &&
    (value.document_type === "AGREEMENT"
      ? value.amount_minor === null
      : Number.isSafeInteger(value.amount_minor) && Number(value.amount_minor) >= 0) &&
    validDate(value.valid_from) &&
    validDate(value.valid_to) &&
    value.valid_to >= value.valid_from &&
    typeof value.summary === "string" &&
    value.summary.trim().length > 0 &&
    value.summary.length <= 500
  );
}

function accessError(status: 400 | 401 | 403) {
  return {
    ok: false as const,
    status,
    code: status === 400 ? "VALIDATION_FAILED" : status === 401 ? "UNAUTHENTICATED" : "FORBIDDEN_SCOPE",
  };
}

function statusCode(error: unknown): number {
  if (!isRecord(error) || typeof error.statusCode !== "number") return 500;
  return [400, 403, 404, 409].includes(error.statusCode) ? error.statusCode : 500;
}

function codeFor(error: unknown): string {
  return isRecord(error) && typeof error.code === "string" ? error.code : "INTERNAL_ERROR";
}

function sendError(response: ApiHttpResponse, requestId: string, status: number, code: string) {
  const message =
    status === 400 ? "费用信息格式不正确。" : status === 403 ? "当前账号无权查看或管理此范围。" : "费用请求暂时无法完成。";
  return response.status(status).json({ error: { code, message }, request_id: requestId });
}

@Controller()
export class FeesController {
  public constructor(
    @Inject(FEES_OPERATIONS) private readonly service: FeesOperations,
    @Inject(TRUSTED_AUTH_PROVIDER) private readonly getTrustedAuthResult: TrustedAuthProvider,
  ) {}

  private async authorize(request: ApiHttpRequest, capability: "binding:read" | "fees:manage"): Promise<Access> {
    if (containsForgedIdentityClaim(request.query, request.headers)) return accessError(401);
    if (!noScopeOverrides(request)) return accessError(400);
    const auth = resolveAuthContext(await this.getTrustedAuthResult(request));
    if (!auth.ok) return accessError(401);

    const contexts: FeesContext[] = [];
    for (const membership of auth.context.memberships) {
      if (membership.status !== "ACTIVE" || !membership.capabilities.includes(capability)) continue;
      for (const campusId of membership.campus_ids) {
        const scope = resolveScope({
          trustedActor: { actorId: auth.context.identity.actor_id },
          membership: {
            tenantId: membership.tenant_id,
            campusIds: membership.campus_ids,
            status: "ACTIVE",
          },
          requestedCampusId: campusId,
        });
        if (!scope.ok || scope.scopeContext.campusId === undefined) continue;
        contexts.push({
          actorId: scope.scopeContext.actorId,
          tenantId: scope.scopeContext.tenantId,
          campusId: scope.scopeContext.campusId,
          capabilities: membership.capabilities,
        });
      }
    }

    const unique = new Map(
      contexts.map((context) => [`${context.tenantId}:${context.campusId}`, context]),
    );
    const context = unique.size === 1 ? unique.values().next().value : undefined;
    return context === undefined ? accessError(403) : { ok: true, context };
  }

  private accessFailure(response: ApiHttpResponse, requestId: string, access: Access) {
    if (access.ok) return undefined;
    const message = access.status === 401 ? "需要使用邀请账号登录。" : "当前账号无权访问此范围。";
    return response.status(access.status).json({
      error: { code: access.code, message },
      request_id: requestId,
    });
  }

  @Get("parent/fees")
  public async parentFees(@Req() request: ApiHttpRequest, @Res() response: ApiHttpResponse) {
    const requestId = randomUUID();
    const access = await this.authorize(request, "binding:read");
    if (!access.ok) return this.accessFailure(response, requestId, access);
    try {
      return response.status(200).json({
        data: await this.service.parentFees(access.context),
        request_id: requestId,
      });
    } catch (cause) {
      return sendError(response, requestId, statusCode(cause), codeFor(cause));
    }
  }

  @Get("admin/fees")
  public async adminFees(@Req() request: ApiHttpRequest, @Res() response: ApiHttpResponse) {
    const requestId = randomUUID();
    const access = await this.authorize(request, "fees:manage");
    if (!access.ok) return this.accessFailure(response, requestId, access);
    try {
      return response.status(200).json({
        data: await this.service.adminFees(access.context),
        request_id: requestId,
      });
    } catch (cause) {
      return sendError(response, requestId, statusCode(cause), codeFor(cause));
    }
  }

  @Post("admin/fees")
  public async createFee(
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ) {
    const requestId = randomUUID();
    const access = await this.authorize(request, "fees:manage");
    if (!access.ok) return this.accessFailure(response, requestId, access);
    if (!validCreateBody(body)) return sendError(response, requestId, 400, "VALIDATION_FAILED");
    try {
      return response.status(201).json({
        data: await this.service.createFee(access.context, body),
        request_id: requestId,
      });
    } catch (cause) {
      return sendError(response, requestId, statusCode(cause), codeFor(cause));
    }
  }

  @Post("admin/fees/:id/revoke")
  public async revokeFee(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ) {
    const requestId = randomUUID();
    const access = await this.authorize(request, "fees:manage");
    if (!access.ok) return this.accessFailure(response, requestId, access);
    if (
      !UUID.test(id) ||
      !exactKeys(body, ["expected_version"]) ||
      !Number.isSafeInteger(body.expected_version) ||
      Number(body.expected_version) < 1
    )
      return sendError(response, requestId, 400, "VALIDATION_FAILED");
    try {
      return response.status(200).json({
        data: await this.service.revokeFee(access.context, id.toLowerCase(), body),
        request_id: requestId,
      });
    } catch (cause) {
      return sendError(response, requestId, statusCode(cause), codeFor(cause));
    }
  }
}
