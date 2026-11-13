import { Module, type DynamicModule } from "@nestjs/common";
import { LEAVE_SERVICE } from "../modules/leave/prisma-leave.service.js";
import { type ApiAppOptions, TRUSTED_AUTH_PROVIDER } from "./api-tokens.js";
import { LeaveController } from "./leave.controller.js";

@Module({})
export class LeaveModule {
  public static register(options: ApiAppOptions = {}): DynamicModule {
    if (options.leaveOperations === undefined) {
      return { module: LeaveModule };
    }
    return {
      module: LeaveModule,
      controllers: [LeaveController],
      providers: [
        { provide: LEAVE_SERVICE, useValue: options.leaveOperations },
        {
          provide: TRUSTED_AUTH_PROVIDER,
          useValue: options.getTrustedAuthResult ?? (() => undefined),
        },
      ],
    };
  }
}
