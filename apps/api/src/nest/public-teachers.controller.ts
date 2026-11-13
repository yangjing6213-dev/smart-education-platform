import { Controller, Get, Inject, Param, Req, Res } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type {
  TeacherProfileResult,
  TeacherProfileService,
} from "../modules/teachers/public-profile.service.js";
import {
  PUBLIC_TEACHER_SCOPE_PROVIDER,
  TEACHER_PROFILE_SERVICE,
  type ApiHttpRequest,
  type ApiHttpResponse,
  type PublicTeacherScopeProvider,
} from "./api-tokens.js";

const FORBIDDEN_PUBLIC_TEACHER_QUERY_FIELDS = [
  "actor_id",
  "identity_id",
  "tenant_id",
  "campus_id",
  "role",
  "publication",
  "status",
  "version",
];

function errorBody(code: string, message: string, requestId: string) {
  return { error: { code, message }, request_id: requestId };
}

function statusFor<T>(result: TeacherProfileResult<T>): number {
  if (result.ok) return 200;
  if (result.error.code === "VALIDATION_FAILED") return 400;
  if (result.error.code === "NOT_FOUND_SCOPED") return 404;
  if (result.error.code === "VERSION_MISMATCH" || result.error.code === "CONFLICT_STATE") {
    return 409;
  }
  return 403;
}

@Controller("public/teachers")
export class PublicTeachersController {
  public constructor(
    @Inject(TEACHER_PROFILE_SERVICE) private readonly teacherProfileService: TeacherProfileService,
    @Inject(PUBLIC_TEACHER_SCOPE_PROVIDER)
    private readonly getPublicTeacherScope: PublicTeacherScopeProvider,
  ) {}

  @Get(":profileId")
  public async getPublicTeacher(
    @Param("profileId") profileId: string,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    if (FORBIDDEN_PUBLIC_TEACHER_QUERY_FIELDS.some((field) => field in request.query)) {
      return response
        .status(400)
        .json(
          errorBody(
            "VALIDATION_FAILED",
            "Teacher profile query claims are not accepted.",
            requestId,
          ),
        );
    }

    const scope = await this.getPublicTeacherScope(request);
    if (scope === undefined) {
      return response
        .status(403)
        .json(
          errorBody("FORBIDDEN_SCOPE", "Teacher profile scope access is not permitted.", requestId),
        );
    }

    const result = this.teacherProfileService.readPublic(scope, profileId);
    if (!result.ok) {
      return response
        .status(statusFor(result))
        .json({ error: result.error, request_id: requestId });
    }
    return response.status(200).json({ data: result.data, request_id: requestId });
  }
}
