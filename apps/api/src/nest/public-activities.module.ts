import { Module, type DynamicModule } from "@nestjs/common";
import { ActivityService } from "../modules/activities/activity.service.js";
import {
  ACTIVITY_SERVICE,
  PUBLIC_ACTIVITY_SCOPE_PROVIDER,
  type ApiAppOptions,
} from "./api-tokens.js";
import { PublicActivitiesController } from "./public-activities.controller.js";

@Module({})
export class PublicActivitiesModule {
  public static register(options: ApiAppOptions = {}): DynamicModule {
    return {
      module: PublicActivitiesModule,
      controllers: [PublicActivitiesController],
      providers: [
        {
          provide: ACTIVITY_SERVICE,
          useValue: options.activityService ?? new ActivityService(),
        },
        {
          provide: PUBLIC_ACTIVITY_SCOPE_PROVIDER,
          useValue: options.getPublicActivityScope ?? (() => undefined),
        },
      ],
    };
  }
}
