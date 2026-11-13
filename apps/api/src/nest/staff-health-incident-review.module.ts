import { Module, type DynamicModule } from "@nestjs/common";
import {
  STAFF_HEALTH_INCIDENT_REVIEW_OPERATIONS,
  TRUSTED_AUTH_PROVIDER,
  type ApiAppOptions,
} from "./api-tokens.js";
import { StaffHealthIncidentReviewController } from "./staff-health-incident-review.controller.js";

@Module({})
export class StaffHealthIncidentReviewModule {
  public static register(options: ApiAppOptions = {}): DynamicModule {
    if (options.staffHealthIncidentReviewOperations === undefined) {
      return { module: StaffHealthIncidentReviewModule };
    }
    return {
      module: StaffHealthIncidentReviewModule,
      controllers: [StaffHealthIncidentReviewController],
      providers: [
        {
          provide: STAFF_HEALTH_INCIDENT_REVIEW_OPERATIONS,
          useValue: options.staffHealthIncidentReviewOperations,
        },
        {
          provide: TRUSTED_AUTH_PROVIDER,
          useValue: options.getTrustedAuthResult ?? (() => undefined),
        },
      ],
    };
  }
}
