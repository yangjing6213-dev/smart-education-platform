import { Module, type DynamicModule } from "@nestjs/common";
import {
  PARENT_NOTICE_OPERATIONS,
  TRUSTED_AUTH_PROVIDER,
  type ApiAppOptions,
} from "./api-tokens.js";
import { ParentNoticesController } from "./parent-notices.controller.js";

@Module({})
export class ParentNoticesModule {
  public static register(options: ApiAppOptions = {}): DynamicModule {
    if (options.parentNoticeOperations === undefined) return { module: ParentNoticesModule };
    return {
      module: ParentNoticesModule,
      controllers: [ParentNoticesController],
      providers: [
        { provide: PARENT_NOTICE_OPERATIONS, useValue: options.parentNoticeOperations },
        {
          provide: TRUSTED_AUTH_PROVIDER,
          useValue: options.getTrustedAuthResult ?? (() => undefined),
        },
      ],
    };
  }
}
