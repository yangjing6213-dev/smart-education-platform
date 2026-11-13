import { Module, type DynamicModule } from "@nestjs/common";
import { TeacherProfileService } from "../modules/teachers/public-profile.service.js";
import {
  PUBLIC_TEACHER_SCOPE_PROVIDER,
  TEACHER_PROFILE_SERVICE,
  type ApiAppOptions,
} from "./api-tokens.js";
import { PublicTeachersController } from "./public-teachers.controller.js";

@Module({})
export class PublicTeachersModule {
  public static register(options: ApiAppOptions = {}): DynamicModule {
    return {
      module: PublicTeachersModule,
      controllers: [PublicTeachersController],
      providers: [
        {
          provide: TEACHER_PROFILE_SERVICE,
          useValue: options.teacherProfileService ?? new TeacherProfileService(),
        },
        {
          provide: PUBLIC_TEACHER_SCOPE_PROVIDER,
          useValue: options.getPublicTeacherScope ?? (() => undefined),
        },
      ],
    };
  }
}
