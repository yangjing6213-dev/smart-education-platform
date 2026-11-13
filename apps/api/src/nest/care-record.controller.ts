import { resolveAuthContext, type AuthResolution } from "@student-care/auth";
import {
  CARE_ACTIVITIES,
  CARE_ARRIVALS,
  CARE_HOMEWORK,
  CARE_MEALS,
  CARE_RESTS,
  CARE_WELLBEING,
  type CareRecordCreateInput,
  type CareRecordReceiptInput,
  type CareRecordReviewInput,
  type CareRecordUpdateInput,
} from "@student-care/contracts";
import { resolveScope, type ScopeContext } from "@student-care/tenant";
import { Body, Controller, Get, Inject, Param, Patch, Post, Req, Res } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { containsForgedIdentityClaim } from "../plugins/forged-identity-claims.js";
import {
  CARE_RECORD_SERVICE,
  type CareRecordCapability,
  type CareRecordContext,
  type CareRecordOperations,
  type CareRecordResult,
} from "../modules/care-records/prisma-care-record.service.js";
import {
  TRUSTED_AUTH_PROVIDER,
  type ApiHttpRequest,
  type ApiHttpResponse,
  type TrustedAuthProvider,
} from "./api-tokens.js";

type AccessResult =
  | { readonly ok: true; readonly context: CareRecordContext }
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

function isCareValues(value: unknown): boolean {
  return (
    exactBody(value, ["arrival", "homework", "meal", "rest", "activity", "wellbeing"]) &&
    CARE_ARRIVALS.includes(value.arrival as (typeof CARE_ARRIVALS)[number]) &&
    CARE_HOMEWORK.includes(value.homework as (typeof CARE_HOMEWORK)[number]) &&
    CARE_MEALS.includes(value.meal as (typeof CARE_MEALS)[number]) &&
    CARE_RESTS.includes(value.rest as (typeof CARE_RESTS)[number]) &&
    CARE_ACTIVITIES.includes(value.activity as (typeof CARE_ACTIVITIES)[number]) &&
    CARE_WELLBEING.includes(value.wellbeing as (typeof CARE_WELLBEING)[number])
  );
}

function createInput(value: unknown): CareRecordCreateInput | undefined {
  if (
    !exactBody(value, ["student_id", "service_date", "values"]) ||
    !isUuid(value.student_id) ||
    !isDate(value.service_date) ||
    !isCareValues(value.values)
  ) {
    return undefined;
  }
  return {
    student_id: value.student_id,
    service_date: value.service_date,
    values: value.values as CareRecordCreateInput["values"],
  };
}

function updateInput(value: unknown): CareRecordUpdateInput | undefined {
  if (
    !exactBody(value, ["version", "values"]) ||
    !isVersion(value.version) ||
    !isCareValues(value.values)
  ) {
    return undefined;
  }
  return { version: value.version, values: value.values as CareRecordUpdateInput["values"] };
}

function versionInput(value: unknown): { readonly version: number } | undefined {
  if (!exactBody(value, ["version"]) || !isVersion(value.version)) return undefined;
  return { version: value.version };
}

function reviewInput(value: unknown): CareRecordReviewInput | undefined {
  if (
    !exactBody(value, ["version", "action"]) ||
    !isVersion(value.version) ||
    (value.action !== "confirm" && value.action !== "return")
  ) {
    return undefined;
  }
  return { version: value.version, action: value.action };
}

function receiptInput(value: unknown): CareRecordReceiptInput | undefined {
  if (
    !exactBody(value, ["version", "publication_version", "action"]) ||
    !isVersion(value.version) ||
    !isVersion(value.publication_version) ||
    (value.action !== "read" && value.action !== "acknowledge")
  ) {
    return undefined;
  }
  return {
    version: value.version,
    publication_version: value.publication_version,
    action: value.action,
  };
}

function contextScopes(auth: AuthResolution): CareRecordContext | undefined {
  if (!auth.ok) return undefined;
  const scopes = new Map<
    string,
    { scope: ScopeContext; capabilities: Set<CareRecordCapability> }
  >();
  const validCapabilities: readonly CareRecordCapability[] = [
    "care:write",
    "care:review",
    "care:publish",
    "care:read",
  ];
  for (const membership of auth.context.memberships) {
    if (membership.status !== "ACTIVE") continue;
    const capabilities = membership.capabilities.filter((value): value is CareRecordCapability =>
      validCapabilities.includes(value as CareRecordCapability),
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

function errorBody(code: string, message: string, requestId: string) {
  return { error: { code, message }, request_id: requestId };
}

function unsupportedScopeHeader(request: ApiHttpRequest): boolean {
  return (
    request.headers["x-tenant-id"] !== undefined || request.headers["x-campus-id"] !== undefined
  );
}

function sendResult<T>(
  result: CareRecordResult<T>,
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
export class CareRecordController {
  public constructor(
    @Inject(CARE_RECORD_SERVICE) private readonly service: CareRecordOperations,
    @Inject(TRUSTED_AUTH_PROVIDER) private readonly getTrustedAuthResult: TrustedAuthProvider,
  ) {}

  private async authorize(
    request: ApiHttpRequest,
    required: CareRecordCapability | readonly CareRecordCapability[],
  ): Promise<AccessResult> {
    if (containsForgedIdentityClaim(request.query, request.headers)) return accessError(401);
    if (unsupportedScopeHeader(request)) return accessError(400);
    const auth = resolveAuthContext(await this.getTrustedAuthResult(request));
    const context = contextScopes(auth);
    if (context === undefined) return accessError(auth.ok ? 403 : 401);
    const requiredList = Array.isArray(required) ? required : [required];
    if (
      !context.scopes.some((access) =>
        requiredList.some((capability) => access.capabilities.includes(capability)),
      )
    ) {
      return accessError(403);
    }
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

  private validRecordId(recordId: string): boolean {
    return isUuid(recordId);
  }

  @Get("staff/care-records")
  public async listStaff(
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = await this.authorize(request, ["care:write", "care:review", "care:publish"]);
    if (!access.ok) return this.sendAccessError(response, requestId, access);
    if (this.rejectQuery(request))
      return response
        .status(400)
        .json(errorBody("VALIDATION_FAILED", "Request is invalid.", requestId));
    return response
      .status(200)
      .json({ data: await this.service.listStaff(access.context), request_id: requestId });
  }

  @Get("staff/care-record-students")
  public async listStaffStudents(
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = await this.authorize(request, "care:write");
    if (!access.ok) return this.sendAccessError(response, requestId, access);
    if (this.rejectQuery(request))
      return response
        .status(400)
        .json(errorBody("VALIDATION_FAILED", "Request is invalid.", requestId));
    return response.status(200).json({
      data: await this.service.listStaffStudents(access.context),
      request_id: requestId,
    });
  }

  @Post("staff/care-records")
  public async createStaff(
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = await this.authorize(request, "care:write");
    if (!access.ok) return this.sendAccessError(response, requestId, access);
    if (this.rejectQuery(request))
      return response
        .status(400)
        .json(errorBody("VALIDATION_FAILED", "Request is invalid.", requestId));
    const input = createInput(body);
    if (input === undefined)
      return response
        .status(400)
        .json(errorBody("VALIDATION_FAILED", "Request is invalid.", requestId));
    return sendResult(await this.service.create(access.context, input), response, requestId, 201);
  }

  @Get("staff/care-records/:recordId")
  public async getStaff(
    @Param("recordId") recordId: string,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = await this.authorize(request, ["care:write", "care:review", "care:publish"]);
    if (!access.ok) return this.sendAccessError(response, requestId, access);
    if (this.rejectQuery(request) || !this.validRecordId(recordId))
      return response
        .status(400)
        .json(errorBody("VALIDATION_FAILED", "Request is invalid.", requestId));
    return sendResult(await this.service.getStaff(access.context, recordId), response, requestId);
  }

  @Patch("staff/care-records/:recordId")
  public async updateStaff(
    @Param("recordId") recordId: string,
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = await this.authorize(request, "care:write");
    if (!access.ok) return this.sendAccessError(response, requestId, access);
    if (this.rejectQuery(request) || !this.validRecordId(recordId))
      return response
        .status(400)
        .json(errorBody("VALIDATION_FAILED", "Request is invalid.", requestId));
    const input = updateInput(body);
    if (input === undefined)
      return response
        .status(400)
        .json(errorBody("VALIDATION_FAILED", "Request is invalid.", requestId));
    return sendResult(
      await this.service.update(access.context, recordId, input),
      response,
      requestId,
    );
  }

  @Post("staff/care-records/:recordId/submit")
  public async submit(
    @Param("recordId") recordId: string,
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = await this.authorize(request, "care:write");
    if (!access.ok) return this.sendAccessError(response, requestId, access);
    if (this.rejectQuery(request) || !this.validRecordId(recordId))
      return response
        .status(400)
        .json(errorBody("VALIDATION_FAILED", "Request is invalid.", requestId));
    const input = versionInput(body);
    if (input === undefined)
      return response
        .status(400)
        .json(errorBody("VALIDATION_FAILED", "Request is invalid.", requestId));
    return sendResult(
      await this.service.submit(access.context, recordId, input),
      response,
      requestId,
    );
  }

  @Post("staff/care-records/:recordId/resubmit")
  public async resubmit(
    @Param("recordId") recordId: string,
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = await this.authorize(request, "care:write");
    if (!access.ok) return this.sendAccessError(response, requestId, access);
    if (this.rejectQuery(request) || !this.validRecordId(recordId))
      return response
        .status(400)
        .json(errorBody("VALIDATION_FAILED", "Request is invalid.", requestId));
    const input = updateInput(body);
    if (input === undefined)
      return response
        .status(400)
        .json(errorBody("VALIDATION_FAILED", "Request is invalid.", requestId));
    return sendResult(
      await this.service.resubmit(access.context, recordId, input),
      response,
      requestId,
    );
  }

  @Post("staff/care-records/:recordId/review")
  public async review(
    @Param("recordId") recordId: string,
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = await this.authorize(request, "care:review");
    if (!access.ok) return this.sendAccessError(response, requestId, access);
    if (this.rejectQuery(request) || !this.validRecordId(recordId))
      return response
        .status(400)
        .json(errorBody("VALIDATION_FAILED", "Request is invalid.", requestId));
    const input = reviewInput(body);
    if (input === undefined)
      return response
        .status(400)
        .json(errorBody("VALIDATION_FAILED", "Request is invalid.", requestId));
    return sendResult(
      await this.service.review(access.context, recordId, input),
      response,
      requestId,
    );
  }

  @Post("staff/care-records/:recordId/publish")
  public async publish(
    @Param("recordId") recordId: string,
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = await this.authorize(request, "care:publish");
    if (!access.ok) return this.sendAccessError(response, requestId, access);
    if (this.rejectQuery(request) || !this.validRecordId(recordId))
      return response
        .status(400)
        .json(errorBody("VALIDATION_FAILED", "Request is invalid.", requestId));
    const input = versionInput(body);
    if (input === undefined)
      return response
        .status(400)
        .json(errorBody("VALIDATION_FAILED", "Request is invalid.", requestId));
    return sendResult(
      await this.service.publish(access.context, recordId, input),
      response,
      requestId,
    );
  }

  @Post("staff/care-records/:recordId/withdraw")
  public async withdraw(
    @Param("recordId") recordId: string,
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = await this.authorize(request, "care:write");
    if (!access.ok) return this.sendAccessError(response, requestId, access);
    if (this.rejectQuery(request) || !this.validRecordId(recordId))
      return response
        .status(400)
        .json(errorBody("VALIDATION_FAILED", "Request is invalid.", requestId));
    const input = versionInput(body);
    if (input === undefined)
      return response
        .status(400)
        .json(errorBody("VALIDATION_FAILED", "Request is invalid.", requestId));
    return sendResult(
      await this.service.withdraw(access.context, recordId, input),
      response,
      requestId,
    );
  }

  @Post("staff/care-records/:recordId/revoke-publication")
  public async revokePublication(
    @Param("recordId") recordId: string,
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = await this.authorize(request, "care:publish");
    if (!access.ok) return this.sendAccessError(response, requestId, access);
    if (this.rejectQuery(request) || !this.validRecordId(recordId))
      return response
        .status(400)
        .json(errorBody("VALIDATION_FAILED", "Request is invalid.", requestId));
    const input = versionInput(body);
    if (input === undefined)
      return response
        .status(400)
        .json(errorBody("VALIDATION_FAILED", "Request is invalid.", requestId));
    return sendResult(
      await this.service.revokePublication(access.context, recordId, input),
      response,
      requestId,
    );
  }

  @Get("parent/care-records")
  public async listParent(
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = await this.authorize(request, "care:read");
    if (!access.ok) return this.sendAccessError(response, requestId, access);
    if (this.rejectQuery(request))
      return response
        .status(400)
        .json(errorBody("VALIDATION_FAILED", "Request is invalid.", requestId));
    return response
      .status(200)
      .json({ data: await this.service.listParent(access.context), request_id: requestId });
  }

  @Get("parent/care-records/:recordId")
  public async getParent(
    @Param("recordId") recordId: string,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = await this.authorize(request, "care:read");
    if (!access.ok) return this.sendAccessError(response, requestId, access);
    if (this.rejectQuery(request) || !this.validRecordId(recordId))
      return response
        .status(400)
        .json(errorBody("VALIDATION_FAILED", "Request is invalid.", requestId));
    return sendResult(await this.service.getParent(access.context, recordId), response, requestId);
  }

  @Post("parent/care-records/:recordId/receipt")
  public async receipt(
    @Param("recordId") recordId: string,
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = await this.authorize(request, "care:read");
    if (!access.ok) return this.sendAccessError(response, requestId, access);
    if (this.rejectQuery(request) || !this.validRecordId(recordId))
      return response
        .status(400)
        .json(errorBody("VALIDATION_FAILED", "Request is invalid.", requestId));
    const input = receiptInput(body);
    if (input === undefined)
      return response
        .status(400)
        .json(errorBody("VALIDATION_FAILED", "Request is invalid.", requestId));
    return sendResult(
      await this.service.receipt(access.context, recordId, input),
      response,
      requestId,
    );
  }
}
