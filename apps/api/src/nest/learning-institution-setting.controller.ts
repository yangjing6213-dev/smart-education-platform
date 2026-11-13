import { resolveAuthContext } from "@student-care/auth";
import { Body, Controller, Get, Inject, Post, Req, Res } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { containsForgedIdentityClaim } from "../plugins/forged-identity-claims.js";
import {
  LEARNING_INSTITUTION_SETTING_OPERATIONS,
  TRUSTED_AUTH_PROVIDER,
  type ApiHttpRequest,
  type ApiHttpResponse,
  type LearningInstitutionSettingContext,
  type LearningInstitutionSettingOperations,
  type TrustedAuthProvider,
} from "./api-tokens.js";

class AccessFailure extends Error {
  public constructor(
    public readonly statusCode: number,
    public readonly code: string,
  ) {
    super(code);
  }
}

@Controller("admin/learning-institution-setting")
export class LearningInstitutionSettingController {
  public constructor(
    @Inject(LEARNING_INSTITUTION_SETTING_OPERATIONS)
    private readonly service: LearningInstitutionSettingOperations,
    @Inject(TRUSTED_AUTH_PROVIDER) private readonly getTrustedAuthResult: TrustedAuthProvider,
  ) {}

  private async authorize(request: ApiHttpRequest): Promise<LearningInstitutionSettingContext> {
    if (containsForgedIdentityClaim(request.query, request.headers))
      throw new AccessFailure(401, "UNAUTHENTICATED");
    if (
      request.headers["x-tenant-id"] !== undefined ||
      request.headers["x-campus-id"] !== undefined ||
      Object.keys(request.query).length !== 0
    )
      throw new AccessFailure(400, "VALIDATION_FAILED");
    const auth = resolveAuthContext(await this.getTrustedAuthResult(request));
    if (!auth.ok) throw new AccessFailure(401, "UNAUTHENTICATED");
    const scopes = auth.context.memberships
      .filter(
        (member) =>
          member.status === "ACTIVE" &&
          member.capabilities.includes("learning:institution-setting"),
      )
      .flatMap((member) =>
        member.campus_ids.map((campusId) => ({
          actorId: auth.context.identity.actor_id,
          tenantId: member.tenant_id,
          campusId,
          capabilities: member.capabilities,
        })),
      );
    if (scopes.length !== 1) throw new AccessFailure(403, "FORBIDDEN_SCOPE");
    return scopes[0]!;
  }

  private async handle(
    request: ApiHttpRequest,
    response: ApiHttpResponse,
    write: boolean,
    body?: unknown,
  ) {
    const requestId = randomUUID();
    try {
      const context = await this.authorize(request);
      const data = write
        ? await this.service.update(context, body)
        : await this.service.read(context);
      return response.status(200).json({ data, request_id: requestId });
    } catch (failure) {
      const status =
        typeof failure === "object" &&
        failure !== null &&
        "statusCode" in failure &&
        [400, 401, 403, 409].includes(Number(failure.statusCode))
          ? Number(failure.statusCode)
          : 500;
      const codes: Record<number, string> = {
        400: "VALIDATION_FAILED",
        401: "UNAUTHENTICATED",
        403: "FORBIDDEN_SCOPE",
        409: "CONFLICT_STATE",
        500: "INTERNAL_ERROR",
      };
      return response.status(status).json({
        error: { code: codes[status], message: "机构学习设置暂不可用。" },
        request_id: requestId,
      });
    }
  }

  @Get()
  public getSetting(@Req() request: ApiHttpRequest, @Res() response: ApiHttpResponse) {
    return this.handle(request, response, false);
  }

  @Post()
  public updateSetting(
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ) {
    return this.handle(request, response, true, body);
  }
}
