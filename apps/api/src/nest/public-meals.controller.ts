import { Controller, Get, Inject, Req, Res } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { MealOperations, MealResult } from "../modules/meals/meal.service.js";
import {
  MEAL_SERVICE,
  PUBLIC_MEAL_SCOPE_PROVIDER,
  type ApiHttpRequest,
  type ApiHttpResponse,
  type PublicMealScopeProvider,
} from "./api-tokens.js";

function errorBody(code: string, message: string, requestId: string) {
  return { error: { code, message }, request_id: requestId };
}

function statusFor<T>(result: MealResult<T>): number {
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
  return keys.every((key) => key === "date" || key === "public_ref") &&
    typeof query.date === "string"
    ? query.date
    : undefined;
}

@Controller("public/meals")
export class PublicMealsController {
  public constructor(
    @Inject(MEAL_SERVICE) private readonly mealService: MealOperations,
    @Inject(PUBLIC_MEAL_SCOPE_PROVIDER)
    private readonly getPublicMealScope: PublicMealScopeProvider,
  ) {}

  @Get()
  public async listPublicMeals(
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const date = queryDate(request.query);
    if (date === undefined) {
      return response
        .status(400)
        .json(errorBody("VALIDATION_FAILED", "Meal input is invalid.", requestId));
    }
    const scope = await this.getPublicMealScope(request);
    if (scope === undefined) {
      return response
        .status(403)
        .json(errorBody("FORBIDDEN_SCOPE", "Meal scope access is not permitted.", requestId));
    }

    const result = await this.mealService.listPublic(scope, date);
    if (!result.ok) {
      return response
        .status(statusFor(result))
        .json({ error: result.error, request_id: requestId });
    }
    return response.status(200).json({ data: result.data, request_id: requestId });
  }
}
