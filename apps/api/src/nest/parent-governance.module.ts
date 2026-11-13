import { Module, type DynamicModule } from "@nestjs/common";
import {
  PARENT_GOVERNANCE_OPERATIONS,
  TRUSTED_AUTH_PROVIDER,
  type ApiAppOptions,
} from "./api-tokens.js";
import { ParentGovernanceController } from "./parent-governance.controller.js";

@Module({})
export class ParentGovernanceModule {
  public static register(options: ApiAppOptions): DynamicModule {
    return {
      module: ParentGovernanceModule,
      controllers: [ParentGovernanceController],
      providers: [
        {
          provide: PARENT_GOVERNANCE_OPERATIONS,
          useValue: options.parentGovernanceOperations,
        },
        {
          provide: TRUSTED_AUTH_PROVIDER,
          useValue: options.getTrustedAuthResult ?? (() => undefined),
        },
      ],
    };
  }
}
