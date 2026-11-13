import { Module, type DynamicModule } from "@nestjs/common";
import {
  GuardianBindingService,
  GUARDIAN_BINDING_SERVICE,
} from "../modules/guardian-bindings/guardian-binding.service.js";
import { TRUSTED_AUTH_PROVIDER, type ApiAppOptions } from "./api-tokens.js";
import {
  GuardianBindingController,
  GuardianBindingStudentOptionsController,
} from "./guardian-binding.controller.js";

@Module({})
export class GuardianBindingModule {
  public static register(options: ApiAppOptions = {}): DynamicModule {
    return {
      module: GuardianBindingModule,
      controllers: [
        GuardianBindingController,
        ...(!options.parentGovernanceOperations ? [GuardianBindingStudentOptionsController] : []),
      ],
      providers: [
        {
          provide: GUARDIAN_BINDING_SERVICE,
          useValue: options.guardianBindingOperations ?? new GuardianBindingService(),
        },
        {
          provide: TRUSTED_AUTH_PROVIDER,
          useValue: options.getTrustedAuthResult ?? (() => undefined),
        },
      ],
    };
  }
}
