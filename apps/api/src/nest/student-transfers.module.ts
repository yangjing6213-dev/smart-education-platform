import { Module, type DynamicModule } from "@nestjs/common";
import {
  STUDENT_TRANSFER_OPERATIONS,
  TRUSTED_AUTH_PROVIDER,
  type ApiAppOptions,
} from "./api-tokens.js";
import { StudentTransfersController } from "./student-transfers.controller.js";

@Module({})
export class StudentTransfersModule {
  public static register(options: ApiAppOptions): DynamicModule {
    return {
      module: StudentTransfersModule,
      controllers: [StudentTransfersController],
      providers: [
        { provide: STUDENT_TRANSFER_OPERATIONS, useValue: options.studentTransferOperations },
        {
          provide: TRUSTED_AUTH_PROVIDER,
          useValue: options.getTrustedAuthResult ?? (() => undefined),
        },
      ],
    };
  }
}
