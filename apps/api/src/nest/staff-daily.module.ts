import { Module, type DynamicModule } from "@nestjs/common";
import {
  STAFF_DAILY_OPERATIONS,
  type ApiAppOptions,
  TRUSTED_AUTH_PROVIDER,
} from "./api-tokens.js";
import { StaffDailyController } from "./staff-daily.controller.js";

@Module({})
export class StaffDailyModule {
  public static register(options: ApiAppOptions = {}): DynamicModule {
    if (options.staffDailyOperations === undefined) return { module: StaffDailyModule };
    return {
      module: StaffDailyModule,
      controllers: [StaffDailyController],
      providers: [
        { provide: STAFF_DAILY_OPERATIONS, useValue: options.staffDailyOperations },
        {
          provide: TRUSTED_AUTH_PROVIDER,
          useValue: options.getTrustedAuthResult ?? (() => undefined),
        },
      ],
    };
  }
}
