import { Controller, Get, Inject, Param, Req, Res } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { PublicInstitutionRouteKind } from "@student-care/contracts";
import type { ContentOperationResult } from "../modules/content/content.service.js";
import type {
  InstitutionContentKind,
  InstitutionServiceOperations,
} from "../modules/institution/institution.service.js";
import {
  INSTITUTION_SERVICE,
  PUBLIC_INSTITUTION_SCOPE_PROVIDER,
  type ApiHttpRequest,
  type ApiHttpResponse,
  type PublicInstitutionScopeProvider,
} from "./api-tokens.js";

function routeKind(value: unknown): PublicInstitutionRouteKind | undefined {
  return value === "profile" || value === "home" ? value : undefined;
}

function contentKind(kind: PublicInstitutionRouteKind): InstitutionContentKind {
  return kind === "profile" ? "INSTITUTION" : "HOME_BLOCK";
}

function errorBody(code: string, message: string, requestId: string) {
  return { error: { code, message }, request_id: requestId };
}

function statusFor<T>(result: ContentOperationResult<T>): number {
  if (result.ok) return 200;
  if (result.error.code === "VALIDATION_FAILED") return 400;
  if (result.error.code === "NOT_FOUND_SCOPED") return 404;
  return 403;
}

@Controller("public/institution")
export class PublicInstitutionController {
  public constructor(
    @Inject(INSTITUTION_SERVICE)
    private readonly institutionService: InstitutionServiceOperations,
    @Inject(PUBLIC_INSTITUTION_SCOPE_PROVIDER)
    private readonly getPublicInstitutionScope: PublicInstitutionScopeProvider,
  ) {}

  @Get(":kind")
  public async list(
    @Param("kind") kindValue: string,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const kind = routeKind(kindValue);
    if (
      kind === undefined ||
      Object.keys(request.query).some((key) => key !== "public_ref") ||
      (request.query.public_ref !== undefined && typeof request.query.public_ref !== "string")
    ) {
      return response
        .status(400)
        .json(errorBody("VALIDATION_FAILED", "Content input is invalid.", requestId));
    }

    const scope = await this.getPublicInstitutionScope(request, contentKind(kind));
    if (scope === undefined) {
      return response
        .status(403)
        .json(errorBody("FORBIDDEN_SCOPE", "Content scope access is not permitted.", requestId));
    }

    const result =
      kind === "profile"
        ? await this.institutionService.listInstitutionPublicForVisitor(scope)
        : await this.institutionService.listHomePublicForVisitor(scope);
    if (!result.ok) {
      return response
        .status(statusFor(result))
        .json({ error: result.error, request_id: requestId });
    }
    return response.status(200).json({ data: result.data, request_id: requestId });
  }

  @Get(":kind/:contentKey")
  public async read(
    @Param("kind") kindValue: string,
    @Param("contentKey") contentKey: string,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const kind = routeKind(kindValue);
    if (
      kind === undefined ||
      Object.keys(request.query).some((key) => key !== "public_ref") ||
      (request.query.public_ref !== undefined && typeof request.query.public_ref !== "string")
    ) {
      return response
        .status(400)
        .json(errorBody("VALIDATION_FAILED", "Content input is invalid.", requestId));
    }

    const scope = await this.getPublicInstitutionScope(request, contentKind(kind));
    if (scope === undefined) {
      return response
        .status(403)
        .json(errorBody("FORBIDDEN_SCOPE", "Content scope access is not permitted.", requestId));
    }

    const result =
      kind === "profile"
        ? await this.institutionService.readInstitutionPublicForVisitor(scope, contentKey)
        : await this.institutionService.readHomePublicForVisitor(scope, contentKey);
    if (!result.ok) {
      return response
        .status(statusFor(result))
        .json({ error: result.error, request_id: requestId });
    }
    return response.status(200).json({ data: result.data, request_id: requestId });
  }
}
