import { Module, type DynamicModule } from "@nestjs/common";
import { MealService } from "../modules/meals/meal.service.js";
import { MEAL_SERVICE, PUBLIC_MEAL_SCOPE_PROVIDER, type ApiAppOptions } from "./api-tokens.js";
import { PublicMealsController } from "./public-meals.controller.js";

@Module({})
export class PublicMealsModule {
  public static register(options: ApiAppOptions = {}): DynamicModule {
    return {
      module: PublicMealsModule,
      controllers: [PublicMealsController],
      providers: [
        {
          provide: MEAL_SERVICE,
          useValue: options.mealService ?? new MealService(),
        },
        {
          provide: PUBLIC_MEAL_SCOPE_PROVIDER,
          useValue: options.getPublicMealScope ?? (() => undefined),
        },
      ],
    };
  }
}
