import { Module, type DynamicModule } from "@nestjs/common";
import { FEES_OPERATIONS, TRUSTED_AUTH_PROVIDER, type ApiAppOptions } from "./api-tokens.js";
import { FeesController } from "./fees.controller.js";

@Module({})
export class FeesModule {
  public static register(options: ApiAppOptions = {}): DynamicModule {
    return {
      module: FeesModule,
      controllers: [FeesController],
      providers: [
        { provide: FEES_OPERATIONS, useValue: options.feesOperations },
        {
          provide: TRUSTED_AUTH_PROVIDER,
          useValue: options.getTrustedAuthResult ?? (() => undefined),
        },
      ],
    };
  }
}
