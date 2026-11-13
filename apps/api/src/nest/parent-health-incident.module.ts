import { Module, type DynamicModule } from "@nestjs/common";
import {
  PARENT_HEALTH_INCIDENT_OPERATIONS,
  TRUSTED_AUTH_PROVIDER,
  type ApiAppOptions,
} from "./api-tokens.js";
import { ParentHealthIncidentController } from "./parent-health-incident.controller.js";

@Module({})
export class ParentHealthIncidentModule {
  public static register(options: ApiAppOptions): DynamicModule {
    if (options.parentHealthIncidentOperations === undefined)
      return { module: ParentHealthIncidentModule };
    return {
      module: ParentHealthIncidentModule,
      controllers: [ParentHealthIncidentController],
      providers: [
        {
          provide: PARENT_HEALTH_INCIDENT_OPERATIONS,
          useValue: options.parentHealthIncidentOperations,
        },
        {
          provide: TRUSTED_AUTH_PROVIDER,
          useValue: options.getTrustedAuthResult ?? (() => undefined),
        },
      ],
    };
  }
}
