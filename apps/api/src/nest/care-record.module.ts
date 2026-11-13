import { Module, type DynamicModule } from "@nestjs/common";
import { CARE_RECORD_SERVICE } from "../modules/care-records/prisma-care-record.service.js";
import { type ApiAppOptions, TRUSTED_AUTH_PROVIDER } from "./api-tokens.js";
import { CareRecordController } from "./care-record.controller.js";

@Module({})
export class CareRecordModule {
  public static register(options: ApiAppOptions = {}): DynamicModule {
    if (options.careRecordOperations === undefined) {
      return { module: CareRecordModule };
    }
    return {
      module: CareRecordModule,
      controllers: [CareRecordController],
      providers: [
        { provide: CARE_RECORD_SERVICE, useValue: options.careRecordOperations },
        {
          provide: TRUSTED_AUTH_PROVIDER,
          useValue: options.getTrustedAuthResult ?? (() => undefined),
        },
      ],
    };
  }
}
