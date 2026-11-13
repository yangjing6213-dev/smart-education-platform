import { Module, type DynamicModule } from "@nestjs/common";
import {
  STAFF_NOTICE_OPERATIONS,
  TRUSTED_AUTH_PROVIDER,
  type ApiAppOptions,
} from "./api-tokens.js";
import { StaffNoticesController } from "./staff-notices.controller.js";

@Module({})
export class StaffNoticesModule {
  public static register(options: ApiAppOptions = {}): DynamicModule {
    if (options.staffNoticeOperations === undefined) return { module: StaffNoticesModule };
    return {
      module: StaffNoticesModule,
      controllers: [StaffNoticesController],
      providers: [
        { provide: STAFF_NOTICE_OPERATIONS, useValue: options.staffNoticeOperations },
        {
          provide: TRUSTED_AUTH_PROVIDER,
          useValue: options.getTrustedAuthResult ?? (() => undefined),
        },
      ],
    };
  }
}
