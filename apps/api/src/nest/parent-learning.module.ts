import { Module, type DynamicModule } from "@nestjs/common";
import {
  PARENT_LEARNING_OPERATIONS,
  TRUSTED_AUTH_PROVIDER,
  type ApiAppOptions,
} from "./api-tokens.js";
import { ParentLearningController } from "./parent-learning.controller.js";

@Module({})
export class ParentLearningModule {
  public static register(options: ApiAppOptions): DynamicModule {
    return {
      module: ParentLearningModule,
      controllers: [ParentLearningController],
      providers: [
        {
          provide: PARENT_LEARNING_OPERATIONS,
          useValue: options.parentLearningOperations,
        },
        {
          provide: TRUSTED_AUTH_PROVIDER,
          useValue: options.getTrustedAuthResult ?? (() => undefined),
        },
      ],
    };
  }
}
