import { activeMemberships, resolveAuthContext, type AuthResolution } from "@student-care/auth";
import type { InviteLoginRequest, InviteLoginResponse, InviteLogoutResponse } from "@student-care/contracts";
import { resolveScope } from "@student-care/tenant";
import { Body, Controller, Get, Inject, Post, Req, Res } from "@nestjs/common";
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

type IdentityCapability = "identity:read" | "memberships:read";

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
