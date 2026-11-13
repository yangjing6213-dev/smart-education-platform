import { Module, type DynamicModule } from "@nestjs/common";
import {
  STAFF_TASK_WORKBENCH_OPERATIONS,
  TRUSTED_AUTH_PROVIDER,
  type ApiAppOptions,
} from "./api-tokens.js";
import { StaffTaskWorkbenchController } from "./staff-task-workbench.controller.js";

@Module({})
export class StaffTaskWorkbenchModule {
  public static register(options: ApiAppOptions = {}): DynamicModule {
    if (options.staffTaskWorkbenchOperations === undefined) {
      return { module: StaffTaskWorkbenchModule };
    }
    return {
      module: StaffTaskWorkbenchModule,
      controllers: [StaffTaskWorkbenchController],
      providers: [
        {
          provide: STAFF_TASK_WORKBENCH_OPERATIONS,
          useValue: options.staffTaskWorkbenchOperations,
        },
        {
          provide: TRUSTED_AUTH_PROVIDER,
          useValue: options.getTrustedAuthResult ?? (() => undefined),
        },
      ],
    };
  }
}
