import { Module, type DynamicModule } from "@nestjs/common";
import {
  STAFF_LIBRARY_OPERATIONS,
  TRUSTED_AUTH_PROVIDER,
  type ApiAppOptions,
} from "./api-tokens.js";
import { StaffLibraryController } from "./staff-library.controller.js";

@Module({})
export class StaffLibraryModule {
  public static register(options: ApiAppOptions): DynamicModule {
    return {
      module: StaffLibraryModule,
      controllers: [StaffLibraryController],
      providers: [
        { provide: STAFF_LIBRARY_OPERATIONS, useValue: options.staffLibraryOperations },
        {
          provide: TRUSTED_AUTH_PROVIDER,
          useValue: options.getTrustedAuthResult ?? (() => undefined),
        },
      ],
    };
  }
}
