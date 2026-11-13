import { Module, type DynamicModule } from "@nestjs/common";
import { ATTENDANCE_SERVICE } from "../modules/attendance/prisma-attendance.service.js";
import { type ApiAppOptions, TRUSTED_AUTH_PROVIDER } from "./api-tokens.js";
import { AttendanceController } from "./attendance.controller.js";

@Module({})
export class AttendanceModule {
  public static register(options: ApiAppOptions = {}): DynamicModule {
    if (options.attendanceOperations === undefined) {
      return { module: AttendanceModule };
    }
    return {
      module: AttendanceModule,
      controllers: [AttendanceController],
      providers: [
        { provide: ATTENDANCE_SERVICE, useValue: options.attendanceOperations },
        {
          provide: TRUSTED_AUTH_PROVIDER,
          useValue: options.getTrustedAuthResult ?? (() => undefined),
        },
      ],
    };
  }
}
