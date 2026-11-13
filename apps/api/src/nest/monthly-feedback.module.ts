import { Module, type DynamicModule } from "@nestjs/common";
import {
  MONTHLY_FEEDBACK_OPERATIONS,
  TRUSTED_AUTH_PROVIDER,
  type ApiAppOptions,
} from "./api-tokens.js";
import { MonthlyFeedbackController } from "./monthly-feedback.controller.js";

@Module({})
export class MonthlyFeedbackModule {
  public static register(options: ApiAppOptions = {}): DynamicModule {
    if (options.monthlyFeedbackOperations === undefined) return { module: MonthlyFeedbackModule };
    return {
      module: MonthlyFeedbackModule,
      controllers: [MonthlyFeedbackController],
      providers: [
        { provide: MONTHLY_FEEDBACK_OPERATIONS, useValue: options.monthlyFeedbackOperations },
        {
          provide: TRUSTED_AUTH_PROVIDER,
          useValue: options.getTrustedAuthResult ?? (() => undefined),
        },
      ],
    };
  }
}
