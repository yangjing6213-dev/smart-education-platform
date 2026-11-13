import { Module, type DynamicModule } from "@nestjs/common";
import { ResourceService } from "../modules/resources/resource.service.js";
import { RESOURCE_SERVICE, TRUSTED_AUTH_PROVIDER, type ApiAppOptions } from "./api-tokens.js";
import { StaffResourcesController } from "./staff-resources.controller.js";

@Module({})
export class StaffResourcesModule {
  public static register(options: ApiAppOptions = {}): DynamicModule {
    return {
      module: StaffResourcesModule,
      controllers: [StaffResourcesController],
      providers: [
        {
          provide: RESOURCE_SERVICE,
          useValue: options.resourceService ?? new ResourceService(),
        },
        {
          provide: TRUSTED_AUTH_PROVIDER,
          useValue: options.getTrustedAuthResult ?? (() => undefined),
        },
      ],
    };
  }
}
