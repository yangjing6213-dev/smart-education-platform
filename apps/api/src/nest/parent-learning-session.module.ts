import { Module, type DynamicModule } from "@nestjs/common";
import {
  PARENT_LEARNING_SESSION_OPERATIONS,
  TRUSTED_AUTH_PROVIDER,
  type ApiAppOptions,
} from "./api-tokens.js";
import { ParentLearningSessionController } from "./parent-learning-session.controller.js";

@Module({})
export class ParentLearningSessionModule {
  public static register(options: ApiAppOptions): DynamicModule {
    return {
      module: ParentLearningSessionModule,
      controllers: [ParentLearningSessionController],
      providers: [
        {
          provide: PARENT_LEARNING_SESSION_OPERATIONS,
          useValue: options.parentLearningSessionOperations,
        },
        {
          provide: TRUSTED_AUTH_PROVIDER,
          useValue: options.getTrustedAuthResult ?? (() => undefined),
        },
      ],
    };
  }
}
