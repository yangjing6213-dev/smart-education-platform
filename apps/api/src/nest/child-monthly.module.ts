import { Module, type DynamicModule } from "@nestjs/common";
import {
  CHILD_MONTHLY_OPERATIONS,
  TRUSTED_AUTH_PROVIDER,
  type ApiAppOptions,
} from "./api-tokens.js";
import { ChildMonthlyController } from "./child-monthly.controller.js";

@Module({})
export class ChildMonthlyModule {
  public static register(options: ApiAppOptions = {}): DynamicModule {
    if (options.childMonthlyOperations === undefined) return { module: ChildMonthlyModule };
    return {
      module: ChildMonthlyModule,
      controllers: [ChildMonthlyController],
      providers: [
        { provide: CHILD_MONTHLY_OPERATIONS, useValue: options.childMonthlyOperations },
        {
          provide: TRUSTED_AUTH_PROVIDER,
          useValue: options.getTrustedAuthResult ?? (() => undefined),
        },
      ],
    };
  }
}
