import { Module, type DynamicModule } from "@nestjs/common";
import { InstitutionService } from "../modules/institution/institution.service.js";
import {
  INSTITUTION_SERVICE,
  PUBLIC_INSTITUTION_SCOPE_PROVIDER,
  type ApiAppOptions,
} from "./api-tokens.js";
import { PublicInstitutionController } from "./public-institution.controller.js";

@Module({})
export class PublicInstitutionModule {
  public static register(options: ApiAppOptions = {}): DynamicModule {
    return {
      module: PublicInstitutionModule,
      controllers: [PublicInstitutionController],
      providers: [
        {
          provide: INSTITUTION_SERVICE,
          useValue: options.institutionService ?? new InstitutionService(),
        },
        {
          provide: PUBLIC_INSTITUTION_SCOPE_PROVIDER,
          useValue: options.getPublicInstitutionScope ?? (() => undefined),
        },
      ],
    };
  }
}
