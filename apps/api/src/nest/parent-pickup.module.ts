import { Module, type DynamicModule } from "@nestjs/common";
import {
  PARENT_PICKUP_OPERATIONS,
  TRUSTED_AUTH_PROVIDER,
  type ApiAppOptions,
} from "./api-tokens.js";
import { ParentPickupController } from "./parent-pickup.controller.js";

@Module({})
export class ParentPickupModule {
  public static register(options: ApiAppOptions): DynamicModule {
    return {
      module: ParentPickupModule,
      controllers: [ParentPickupController],
      providers: [
        {
          provide: PARENT_PICKUP_OPERATIONS,
          useValue: options.parentPickupOperations,
        },
        {
          provide: TRUSTED_AUTH_PROVIDER,
          useValue: options.getTrustedAuthResult ?? (() => undefined),
        },
      ],
    };
  }
}
