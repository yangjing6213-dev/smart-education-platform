import { Module, type DynamicModule } from "@nestjs/common";
import { InstitutionService } from "../modules/institution/institution.service.js";
import { INSTITUTION_SERVICE, TRUSTED_AUTH_PROVIDER, type ApiAppOptions } from "./api-tokens.js";
import { AdminInstitutionController } from "./admin-institution.controller.js";

@Module({})
export class AdminInstitutionModule {
  public static register(options: ApiAppOptions = {}): DynamicModule {
    return {
      module: AdminInstitutionModule,
      controllers: [AdminInstitutionController],
      providers: [
        {
          provide: INSTITUTION_SERVICE,
          useValue: options.institutionService ?? new InstitutionService(),
        },
        {
          provide: TRUSTED_AUTH_PROVIDER,
          useValue: options.getTrustedAuthResult ?? (() => undefined),
        },
      ],
    };
  }
}
