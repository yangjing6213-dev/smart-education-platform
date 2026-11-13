import { resolveAuthContext } from "@student-care/auth";
import { resolveScope } from "@student-care/tenant";
import { Body, Controller, Get, Inject, Param, Post, Put, Req, Res } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import {
  isMealDraftPayload,
  type MealActorContext,
  type MealOperations,
  type MealRecord,
  type MealResult,
} from "../modules/meals/meal.service.js";
import { containsForgedIdentityClaim } from "../plugins/forged-identity-claims.js";
import {
  MEAL_SERVICE,
  TRUSTED_AUTH_PROVIDER,
  type ApiHttpRequest,
  type ApiHttpResponse,
  type TrustedAuthProvider,
} from "./api-tokens.js";

type Capability = "content:write" | "content:publish";
type Action = "create" | "update" | "publish" | "unpublish";
type Access =
  | { readonly ok: true; readonly context: MealActorContext }
  | { readonly ok: false; readonly status: 400 | 401 | 403 };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exact(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return (
    object(value) && Object.keys(value).length === keys.length && keys.every((key) => key in value)
  );
}

function version(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

function projection(row: MealRecord, context: MealActorContext) {
  const actions: string[] = [];
  if (context.capabilities.includes("content:write") && row.status !== "PUBLISHED")
    actions.push("edit");
  if (context.capabilities.includes("content:publish"))
    actions.push(row.status === "PUBLISHED" ? "unpublish" : "publish");
  return {
    id: row.id,
    meal_date: row.meal_date,
    meal_type: row.meal_type,
    items: [...row.items],
    notes: row.notes,
    status: row.status,
    version: row.version,
    published_at: row.published_at,
    updated_at: row.updated_at,
    actions,
  };
}

function error(response: ApiHttpResponse, requestId: string, status: number, code: string) {
  return response.status(status).json({
    error: { code, message: "Meal request could not be completed." },
    request_id: requestId,
  });
}

function statusFor(result: Extract<MealResult<unknown>, { readonly ok: false }>): number {
  if (result.error.code === "VALIDATION_FAILED") return 400;
  if (result.error.code === "NOT_FOUND_SCOPED") return 404;
  if (result.error.code === "FORBIDDEN_SCOPE") return 403;
  return 409;
}

@Controller("admin/meals")
export class AdminMealsController {
  public constructor(
    @Inject(MEAL_SERVICE) private readonly service: MealOperations,
    @Inject(TRUSTED_AUTH_PROVIDER) private readonly getTrustedAuthResult: TrustedAuthProvider,
  ) {}

  private async authorize(request: ApiHttpRequest, capability: Capability): Promise<Access> {
    if (containsForgedIdentityClaim(request.query, request.headers))
      return { ok: false, status: 401 };
    if (
      Object.keys(request.query).length > 0 ||
      ["x-tenant-id", "x-campus-id"].some((name) => request.headers[name] !== undefined)
    )
      return { ok: false, status: 400 };
    const auth = resolveAuthContext(await this.getTrustedAuthResult(request));
    if (!auth.ok) return { ok: false, status: 401 };
    const contexts = new Map<string, MealActorContext>();
    for (const membership of auth.context.memberships) {
      if (membership.status !== "ACTIVE") continue;
      for (const campusId of membership.campus_ids) {
        const scoped = resolveScope({
          trustedActor: { actorId: auth.context.identity.actor_id },
          membership: {
            tenantId: membership.tenant_id,
            campusIds: membership.campus_ids,
            status: "ACTIVE",
          },
          requestedCampusId: campusId,
        });
        if (!scoped.ok || scoped.scopeContext.campusId === undefined) continue;
        const key = `${scoped.scopeContext.tenantId}:${scoped.scopeContext.campusId}`;
        const current = contexts.get(key);
        contexts.set(key, {
          trusted: true,
          activeMembership: true,
          actorId: scoped.scopeContext.actorId,
          scope: { tenantId: scoped.scopeContext.tenantId, campusId: scoped.scopeContext.campusId },
          capabilities: [
            ...new Set([...(current?.capabilities ?? []), ...membership.capabilities]),
          ],
        });
      }
    }
    const context = contexts.size === 1 ? contexts.values().next().value : undefined;
    return context === undefined || !context.capabilities.includes(capability)
      ? { ok: false, status: 403 }
      : { ok: true, context };
  }

  private accessError(response: ApiHttpResponse, requestId: string, status: 400 | 401 | 403) {
    return error(
      response,
      requestId,
      status,
      status === 401 ? "UNAUTHENTICATED" : status === 403 ? "FORBIDDEN_SCOPE" : "VALIDATION_FAILED",
    );
  }

  @Get()
  public async list(
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = await this.authorize(request, "content:write");
    if (!access.ok) return this.accessError(response, requestId, access.status);
    const result = await this.service.listAdmin(access.context);
    if (!result.ok) return error(response, requestId, statusFor(result), result.error.code);
    return response.status(200).json({
      data: result.data.map((row) => projection(row, access.context)),
      request_id: requestId,
    });
  }

  private async mutate(
    action: Action,
    request: ApiHttpRequest,
    response: ApiHttpResponse,
    mealId: string,
    body: unknown,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = await this.authorize(
      request,
      action === "create" || action === "update" ? "content:write" : "content:publish",
    );
    if (!access.ok) return this.accessError(response, requestId, access.status);
    if (!UUID.test(mealId)) return error(response, requestId, 400, "VALIDATION_FAILED");
    mealId = mealId.toLowerCase();
    let result: MealResult<MealRecord>;
    if (action === "create" || action === "update") {
      if (
        !object(body) ||
        !object(body.payload) ||
        !exact(body.payload, ["meal_date", "meal_type", "items", "notes"]) ||
        !isMealDraftPayload(body.payload)
      )
        return error(response, requestId, 400, "VALIDATION_FAILED");
      if (action === "create") {
        if (
          Object.keys(body).some((key) => key !== "payload" && key !== "expected_version") ||
          (body.expected_version !== undefined &&
            body.expected_version !== null &&
            !version(body.expected_version))
        )
          return error(response, requestId, 400, "VALIDATION_FAILED");
        result = await this.service.createDraft(
          access.context,
          mealId,
          body.payload,
          body.expected_version === undefined || body.expected_version === null
            ? null
            : (body.expected_version as number),
        );
      } else {
        if (!exact(body, ["payload", "expected_version"]) || !version(body.expected_version))
          return error(response, requestId, 400, "VALIDATION_FAILED");
        result = await this.service.updateDraft(
          access.context,
          mealId,
          body.payload,
          body.expected_version,
        );
      }
    } else {
      if (!exact(body, ["expected_version"]) || !version(body.expected_version))
        return error(response, requestId, 400, "VALIDATION_FAILED");
      result =
        action === "publish"
          ? await this.service.publish(access.context, mealId, body.expected_version)
          : await this.service.unpublish(access.context, mealId, body.expected_version);
    }
    if (!result.ok) return error(response, requestId, statusFor(result), result.error.code);
    return response
      .status(action === "create" ? 201 : 200)
      .json({ data: projection(result.data, access.context), request_id: requestId });
  }

  @Post(":mealId/draft")
  public createDraft(
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
    @Param("mealId") mealId: string,
    @Body() body: unknown,
  ): Promise<unknown> {
    return this.mutate("create", request, response, mealId, body);
  }

  @Put(":mealId/draft")
  public updateDraft(
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
    @Param("mealId") mealId: string,
    @Body() body: unknown,
  ): Promise<unknown> {
    return this.mutate("update", request, response, mealId, body);
  }

  @Post(":mealId/publish")
  public publish(
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
    @Param("mealId") mealId: string,
    @Body() body: unknown,
  ): Promise<unknown> {
    return this.mutate("publish", request, response, mealId, body);
  }

  @Post(":mealId/unpublish")
  public unpublish(
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
    @Param("mealId") mealId: string,
    @Body() body: unknown,
  ): Promise<unknown> {
    return this.mutate("unpublish", request, response, mealId, body);
  }
}
