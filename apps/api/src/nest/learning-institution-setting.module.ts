import { Module, type DynamicModule } from "@nestjs/common";
import {
  LEARNING_INSTITUTION_SETTING_OPERATIONS,
  TRUSTED_AUTH_PROVIDER,
  type ApiAppOptions,
} from "./api-tokens.js";
import { LearningInstitutionSettingController } from "./learning-institution-setting.controller.js";

@Module({})
export class LearningInstitutionSettingModule {
  public static register(options: ApiAppOptions): DynamicModule {
    return {
      module: LearningInstitutionSettingModule,
      controllers: [LearningInstitutionSettingController],
      providers: [
        {
          provide: LEARNING_INSTITUTION_SETTING_OPERATIONS,
          useValue: options.learningInstitutionSettingOperations,
        },
        {
          provide: TRUSTED_AUTH_PROVIDER,
          useValue: options.getTrustedAuthResult ?? (() => undefined),
        },
      ],
    };
  }
}
