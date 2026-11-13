import { Module, type DynamicModule } from "@nestjs/common";
import { GuideService } from "../modules/guides/guide.service.js";
import {
  GUIDE_SERVICE,
  STAFF_GUIDE_SCOPE_PROVIDER,
  TRUSTED_AUTH_PROVIDER,
  type ApiAppOptions,
} from "./api-tokens.js";
import { StaffGuidesController } from "./staff-guides.controller.js";

@Module({})
export class StaffGuidesModule {
  public static register(options: ApiAppOptions = {}): DynamicModule {
    return {
      module: StaffGuidesModule,
      controllers: [StaffGuidesController],
      providers: [
        {
          provide: GUIDE_SERVICE,
          useValue: options.guideService ?? new GuideService(),
        },
        {
          provide: TRUSTED_AUTH_PROVIDER,
          useValue: options.getTrustedAuthResult ?? (() => undefined),
        },
        {
          provide: STAFF_GUIDE_SCOPE_PROVIDER,
          useValue: options.getStaffGuideScope ?? (() => undefined),
        },
      ],
    };
  }
}
