import { Module, type DynamicModule } from "@nestjs/common";
import { MEAL_SERVICE, TRUSTED_AUTH_PROVIDER, type ApiAppOptions } from "./api-tokens.js";
import { AdminMealsController } from "./admin-meals.controller.js";

@Module({})
export class AdminMealsModule {
  public static register(options: ApiAppOptions = {}): DynamicModule {
    if (options.mealService === undefined) return { module: AdminMealsModule };
    return {
      module: AdminMealsModule,
      controllers: [AdminMealsController],
      providers: [
        { provide: MEAL_SERVICE, useValue: options.mealService },
        {
          provide: TRUSTED_AUTH_PROVIDER,
          useValue: options.getTrustedAuthResult ?? (() => undefined),
        },
      ],
    };
  }
}
