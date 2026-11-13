import { Controller, Get, Inject, Req, Res } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { ActivityResult, ActivityService } from "../modules/activities/activity.service.js";
import {
  ACTIVITY_SERVICE,
  PUBLIC_ACTIVITY_SCOPE_PROVIDER,
  type ApiHttpRequest,
  type ApiHttpResponse,
  type PublicActivityScopeProvider,
} from "./api-tokens.js";

function errorBody(code: string, message: string, requestId: string) {
  return { error: { code, message }, request_id: requestId };
}

function statusFor<T>(result: ActivityResult<T>): number {
  if (result.ok) return 200;
  if (result.error.code === "VALIDATION_FAILED") return 400;
  if (result.error.code === "NOT_FOUND_SCOPED") return 404;
  if (result.error.code === "VERSION_MISMATCH" || result.error.code === "CONFLICT_STATE") {
    return 409;
  }
  return 403;
}

function queryDate(query: Record<string, unknown>): string | undefined {
  const keys = Object.keys(query);
  return keys.length === 1 && keys[0] === "date" && typeof query.date === "string"
    ? query.date
    : undefined;
}

@Controller("public/activities")
export class PublicActivitiesController {
  public constructor(
    @Inject(ACTIVITY_SERVICE) private readonly activityService: ActivityService,
    @Inject(PUBLIC_ACTIVITY_SCOPE_PROVIDER)
    private readonly getPublicActivityScope: PublicActivityScopeProvider,
  ) {}

  @Get()
  public async listPublicActivities(
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const date = queryDate(request.query);
    const scope = await this.getPublicActivityScope(request);
    if (date === undefined) {
      return response
        .status(400)
        .json(errorBody("VALIDATION_FAILED", "Activity input is invalid.", requestId));
    }
    if (scope === undefined) {
      return response
        .status(403)
        .json(errorBody("FORBIDDEN_SCOPE", "Activity scope access is not permitted.", requestId));
    }

    const result = this.activityService.listPublic(scope, date);
    if (!result.ok) {
      return response
        .status(statusFor(result))
        .json({ error: result.error, request_id: requestId });
    }
    return response.status(200).json({ data: result.data, request_id: requestId });
  }
}
