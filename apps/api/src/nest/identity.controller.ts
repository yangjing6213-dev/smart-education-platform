import { activeMemberships, resolveAuthContext, type AuthResolution } from "@student-care/auth";
import type { InviteLoginRequest, InviteLoginResponse, InviteLogoutResponse } from "@student-care/contracts";
import { resolveScope } from "@student-care/tenant";
import { Body, Controller, Get, Inject, Param, Patch, Post, Req, Res } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { containsForgedIdentityClaim } from "../plugins/forged-identity-claims.js";
import {
  TRUSTED_AUTH_PROVIDER,
  INVITE_AUTH_SERVICE,
  type ApiHttpRequest,
  type ApiHttpResponse,
  type InviteAuthOperations,
  type TrustedAuthProvider,
} from "./api-tokens.js";

type IdentityCapability = "identity:read" | "memberships:read" | "memberships:manage";

type AccessResult =
  | { readonly ok: true; readonly auth: Extract<AuthResolution, { readonly ok: true }> }
  | {
      readonly ok: false;
      readonly status: 401 | 403;
      readonly code: "UNAUTHENTICATED" | "FORBIDDEN_SCOPE";
      readonly message: string;
    };

function scopeAllowed(
  auth: AuthResolution,
  request: ApiHttpRequest,
  requiredCapability: IdentityCapability,
): boolean {
  if (!auth.ok) return false;

  const requestedTenantId = request.query.tenant_id;
  const requestedCampusId = request.query.campus_id;
  if (requestedCampusId !== undefined && typeof requestedCampusId !== "string") return false;
  const requestedCampusIdValue =
    typeof requestedCampusId === "string" ? requestedCampusId : undefined;
  const eligibleMemberships = auth.context.memberships.filter(
    (membership) =>
      membership.status === "ACTIVE" && membership.capabilities.includes(requiredCapability),
  );
  const membership =
    eligibleMemberships.find(
      (candidate) =>
        candidate.tenant_id === requestedTenantId &&
        (requestedCampusIdValue === undefined ||
          candidate.campus_ids.includes(requestedCampusIdValue)),
    ) ??
    (requestedTenantId === undefined
      ? eligibleMemberships.find(
          (candidate) =>
            requestedCampusIdValue === undefined ||
            candidate.campus_ids.includes(requestedCampusIdValue),
        )
      : undefined);
  const scope = resolveScope({
    trustedActor: { actorId: auth.context.identity.actor_id },
    membership: membership
      ? {
          tenantId: membership.tenant_id,
          campusIds: membership.campus_ids,
          status: "ACTIVE",
        }
      : undefined,
    requestedTenantId,
    requestedCampusId: requestedCampusIdValue,
  });

  return scope.ok;
}

async function authorizeRequest(
  request: ApiHttpRequest,
  getTrustedAuthResult: TrustedAuthProvider,
  requiredCapability: IdentityCapability,
): Promise<AccessResult> {
  if (containsForgedIdentityClaim(request.query, request.headers)) {
    return {
      ok: false,
      status: 401,
      code: "UNAUTHENTICATED",
      message: "Authentication is required.",
    };
  }

  const auth = resolveAuthContext(await getTrustedAuthResult(request));
  if (!auth.ok) {
    return {
      ok: false,
      status: 401,
      code: "UNAUTHENTICATED",
      message: "Authentication is required.",
    };
  }
  if (!scopeAllowed(auth, request, requiredCapability)) {
    return {
      ok: false,
      status: 403,
      code: "FORBIDDEN_SCOPE",
      message: "Scope access is not permitted.",
    };
  }

  return { ok: true, auth };
}

function sendError(
  response: ApiHttpResponse,
  requestId: string,
  result: Extract<AccessResult, { readonly ok: false }>,
): unknown {
  return response
    .status(result.status)
    .json({ error: { code: result.code, message: result.message }, request_id: requestId });
}

function loginInput(value: unknown): InviteLoginRequest | undefined {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => key !== "username" && key !== "password")
  ) {
    return undefined;
  }
  const input = value as Record<string, unknown>;
  if (
    typeof input.username !== "string" ||
    input.username.length < 3 ||
    input.username.length > 64 ||
    typeof input.password !== "string" ||
    input.password.length < 1 ||
    input.password.length > 128
  ) {
    return undefined;
  }
  return { username: input.username, password: input.password };
}

function exactObject(value: unknown, keys: readonly string[]): Record<string, unknown> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  return Object.keys(record).every((key) => keys.includes(key)) ? record : undefined;
}

function hasSelfServiceParentRole(auth: Extract<AuthResolution, { readonly ok: true }>): boolean {
  const active = auth.context.memberships.filter((membership) => membership.status === "ACTIVE");
  const capabilities = new Set(active.flatMap((membership) => membership.capabilities));
  const parentCapability =
    capabilities.has("binding:apply") ||
    capabilities.has("leave:apply") ||
    capabilities.has("learning:summary");
  const organizationCapability =
    capabilities.has("memberships:manage") ||
    capabilities.has("care:write") ||
    capabilities.has("care:review") ||
    capabilities.has("daily:create");
  return parentCapability && !organizationCapability;
}

function sendAccountFailure(
  response: ApiHttpResponse,
  requestId: string,
  reason: string,
): unknown {
  const mapping: Record<string, { status: number; code: string; message: string }> = {
    ACCOUNT_NOT_FOUND: { status: 404, code: "ACCOUNT_UNAVAILABLE", message: "账号暂不可用。" },
    CURRENT_PASSWORD_INVALID: { status: 401, code: "REAUTH_FAILED", message: "当前密码不正确。" },
    PROFILE_INVALID: { status: 400, code: "VALIDATION_FAILED", message: "姓名长度应为1至80个字符。" },
    PASSWORD_INVALID: { status: 400, code: "VALIDATION_FAILED", message: "新密码长度应为12至128个字符。" },
    USERNAME_INVALID: { status: 400, code: "VALIDATION_FAILED", message: "用户名格式无效。" },
    USERNAME_TAKEN: { status: 409, code: "USERNAME_UNAVAILABLE", message: "该用户名不可用。" },
    RATE_LIMITED: { status: 429, code: "RATE_LIMITED", message: "验证次数过多，请15分钟后重试。" },
    PROFILE_CHANGE_PENDING: { status: 409, code: "PROFILE_CHANGE_PENDING", message: "已有一项更名申请等待审核。" },
    PROFILE_CHANGE_NOT_FOUND: { status: 404, code: "PROFILE_CHANGE_NOT_FOUND", message: "该申请不存在或不在当前机构范围内。" },
    PROFILE_CHANGE_CONFLICT: { status: 409, code: "PROFILE_CHANGE_CONFLICT", message: "申请状态已变化，请刷新后重试。" },
    FORBIDDEN_SCOPE: { status: 403, code: "FORBIDDEN_SCOPE", message: "当前账号无权处理此机构范围。" },
  };
  const error = mapping[reason] ?? { status: 503, code: "IDENTITY_UNAVAILABLE", message: "账号服务暂不可用。" };
  return response.status(error.status).json({
    error: { code: error.code, message: error.message },
    request_id: requestId,
  });
}

@Controller()
export class IdentityController {
  public constructor(
    @Inject(TRUSTED_AUTH_PROVIDER) private readonly getTrustedAuthResult: TrustedAuthProvider,
    @Inject(INVITE_AUTH_SERVICE) private readonly inviteAuthService: InviteAuthOperations,
  ) {}

  @Post("identity/login")
  public async login(
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    if (containsForgedIdentityClaim(request.query, request.headers)) {
      return response.status(401).json({
        error: { code: "UNAUTHENTICATED", message: "Authentication is required." },
        request_id: requestId,
      });
    }
    const input = loginInput(body);
    if (input === undefined) {
      return response.status(400).json({
        error: { code: "VALIDATION_FAILED", message: "Request is invalid." },
        request_id: requestId,
      });
    }

    const result = await this.inviteAuthService.login(input.username, input.password);
    if (!result.ok) {
      const notConfigured = result.reason === "AUTH_NOT_CONFIGURED";
      return response.status(notConfigured ? 503 : 401).json({
        error: {
          code: notConfigured ? "PROVIDER_UNAVAILABLE" : "UNAUTHENTICATED",
          message: notConfigured ? "Invite sign-in is not configured." : "Sign-in failed.",
        },
        request_id: requestId,
      });
    }
    const data: InviteLoginResponse = {
      access_token: result.access_token,
      token_type: "Bearer",
      expires_at: result.expires_at,
    };
    return response.status(200).json({
      data,
      request_id: requestId,
    });
  }

  @Post("identity/logout")
  public async logout(
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const auth = resolveAuthContext(await this.getTrustedAuthResult(request));
    if (!auth.ok) {
      return response.status(401).json({
        error: { code: "UNAUTHENTICATED", message: "Authentication is required." },
        request_id: requestId,
      });
    }
    await this.inviteAuthService.logout(request);
    const data: InviteLogoutResponse = { logged_out: true };
    return response.status(200).json({ data, request_id: requestId });
  }

  @Get("me")
  public async getMe(
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = await authorizeRequest(request, this.getTrustedAuthResult, "identity:read");
    if (!access.ok) return sendError(response, requestId, access);

    return response.status(200).json({
      data: {
        actor_id: access.auth.context.identity.actor_id,
        display_name: access.auth.context.identity.display_name,
        memberships: activeMemberships(access.auth),
      },
      request_id: requestId,
    });
  }

  @Get("identity/account")
  public async getAccount(
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = await authorizeRequest(request, this.getTrustedAuthResult, "identity:read");
    if (!access.ok) return sendError(response, requestId, access);
    const account = await this.inviteAuthService.getAccount(access.auth.context.identity.actor_id);
    if (!account) return sendAccountFailure(response, requestId, "ACCOUNT_NOT_FOUND");
    return response.status(200).json({
      data: { ...account, memberships: activeMemberships(access.auth) },
      request_id: requestId,
    });
  }

  @Patch("identity/account/profile")
  public async updateProfile(
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = await authorizeRequest(request, this.getTrustedAuthResult, "identity:read");
    if (!access.ok) return sendError(response, requestId, access);
    if (!hasSelfServiceParentRole(access.auth)) {
      return response.status(403).json({
        error: { code: "FORBIDDEN_SCOPE", message: "机构身份姓名请提交更名申请。" },
        request_id: requestId,
      });
    }
    const input = exactObject(body, ["display_name"]);
    if (!input || typeof input.display_name !== "string") {
      return response.status(400).json({
        error: { code: "VALIDATION_FAILED", message: "请求内容无效。" },
        request_id: requestId,
      });
    }
    const result = await this.inviteAuthService.updateProfile(
      access.auth.context.identity.actor_id,
      input.display_name,
    );
    if (!result.ok) return sendAccountFailure(response, requestId, result.reason);
    const refreshed = await this.inviteAuthService.getAccount(access.auth.context.identity.actor_id);
    return response.status(200).json({
      data: refreshed ? { ...refreshed, memberships: activeMemberships(access.auth) } : null,
      request_id: requestId,
    });
  }

  @Patch("identity/account/username")
  public async updateUsername(
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = await authorizeRequest(request, this.getTrustedAuthResult, "identity:read");
    if (!access.ok) return sendError(response, requestId, access);
    const input = exactObject(body, ["current_password", "new_username"]);
    if (
      !input ||
      typeof input.current_password !== "string" ||
      input.current_password.length < 1 ||
      input.current_password.length > 128 ||
      typeof input.new_username !== "string" ||
      input.new_username.length > 64
    ) {
      return response.status(400).json({
        error: { code: "VALIDATION_FAILED", message: "请求内容无效。" },
        request_id: requestId,
      });
    }
    const result = await this.inviteAuthService.changeUsername(
      access.auth.context.identity.actor_id,
      input.current_password,
      input.new_username,
    );
    if (!result.ok) return sendAccountFailure(response, requestId, result.reason);
    return response.status(200).json({ data: { changed: true, reauthentication_required: true }, request_id: requestId });
  }

  @Post("identity/account/password")
  public async updatePassword(
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = await authorizeRequest(request, this.getTrustedAuthResult, "identity:read");
    if (!access.ok) return sendError(response, requestId, access);
    const input = exactObject(body, ["current_password", "new_password"]);
    if (
      !input ||
      typeof input.current_password !== "string" ||
      input.current_password.length < 1 ||
      input.current_password.length > 128 ||
      typeof input.new_password !== "string" ||
      input.new_password.length > 128
    ) {
      return response.status(400).json({
        error: { code: "VALIDATION_FAILED", message: "请求内容无效。" },
        request_id: requestId,
      });
    }
    const result = await this.inviteAuthService.changePassword(
      access.auth.context.identity.actor_id,
      input.current_password,
      input.new_password,
    );
    if (!result.ok) return sendAccountFailure(response, requestId, result.reason);
    return response.status(200).json({ data: { changed: true, reauthentication_required: true }, request_id: requestId });
  }

  @Post("identity/account/logout-all")
  public async logoutAll(
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = await authorizeRequest(request, this.getTrustedAuthResult, "identity:read");
    if (!access.ok) return sendError(response, requestId, access);
    await this.inviteAuthService.logoutAll(request);
    return response.status(200).json({ data: { logged_out_all: true }, request_id: requestId });
  }

  @Post("identity/account/profile-change-requests")
  public async createProfileChangeRequest(
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = await authorizeRequest(request, this.getTrustedAuthResult, "identity:read");
    if (!access.ok) return sendError(response, requestId, access);
    const input = exactObject(body, ["tenant_id", "display_name"]);
    if (
      !input ||
      typeof input.tenant_id !== "string" ||
      typeof input.display_name !== "string" ||
      !access.auth.context.memberships.some(
        (membership) =>
          membership.status === "ACTIVE" &&
          membership.tenant_id === input.tenant_id &&
          membership.capabilities.includes("identity:read"),
      )
    ) {
      return sendAccountFailure(response, requestId, "FORBIDDEN_SCOPE");
    }
    const result = await this.inviteAuthService.createProfileChangeRequest(
      access.auth.context.identity.actor_id,
      input.tenant_id,
      input.display_name,
    );
    if (!result.result.ok) return sendAccountFailure(response, requestId, result.result.reason);
    return response.status(201).json({ data: result.request, request_id: requestId });
  }

  @Get("identity/profile-change-requests")
  public async listProfileChangeRequests(
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = await authorizeRequest(request, this.getTrustedAuthResult, "memberships:manage");
    if (!access.ok) return sendError(response, requestId, access);
    const tenantId = request.query.tenant_id;
    if (typeof tenantId !== "string") {
      return response.status(400).json({
        error: { code: "VALIDATION_FAILED", message: "必须选择当前机构范围。" },
        request_id: requestId,
      });
    }
    return response.status(200).json({
      data: await this.inviteAuthService.listProfileChangeRequests(tenantId),
      request_id: requestId,
    });
  }

  @Post("identity/profile-change-requests/:id/approve")
  public async approveProfileChangeRequest(
    @Param("id") requestIdValue: string,
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    return this.reviewProfileChangeRequest(requestIdValue, true, body, request, response);
  }

  @Post("identity/profile-change-requests/:id/reject")
  public async rejectProfileChangeRequest(
    @Param("id") requestIdValue: string,
    @Body() body: unknown,
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    return this.reviewProfileChangeRequest(requestIdValue, false, body, request, response);
  }

  private async reviewProfileChangeRequest(
    changeId: string,
    approved: boolean,
    body: unknown,
    request: ApiHttpRequest,
    response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = await authorizeRequest(request, this.getTrustedAuthResult, "memberships:manage");
    if (!access.ok) return sendError(response, requestId, access);
    const input = exactObject(body, ["expected_version"]);
    const tenantId = request.query.tenant_id;
    if (
      typeof tenantId !== "string" ||
      !input ||
      typeof input.expected_version !== "number" ||
      !Number.isInteger(input.expected_version) ||
      input.expected_version < 1
    ) {
      return response.status(400).json({
        error: { code: "VALIDATION_FAILED", message: "请求内容无效。" },
        request_id: requestId,
      });
    }
    const result = await this.inviteAuthService.reviewProfileChangeRequest({
      requestId: changeId,
      tenantId,
      reviewerId: access.auth.context.identity.actor_id,
      expectedVersion: input.expected_version,
      approved,
    });
    if (!result.ok) return sendAccountFailure(response, requestId, result.reason);
    return response.status(200).json({ data: { reviewed: true, status: approved ? "APPROVED" : "REJECTED" }, request_id: requestId });
  }

  @Get("memberships")
  public async getMemberships(
    @Req() request: ApiHttpRequest,
    @Res() response: ApiHttpResponse,
  ): Promise<unknown> {
    const requestId = randomUUID();
    const access = await authorizeRequest(request, this.getTrustedAuthResult, "memberships:read");
    if (!access.ok) return sendError(response, requestId, access);

    return response.status(200).json({
      data: activeMemberships(access.auth),
      request_id: requestId,
    });
  }
}
