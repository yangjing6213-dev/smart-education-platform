import type { PrismaClient } from "../generated/prisma/client.js";
import type {
  AccountUpdateResult,
  ProfileChangeRecord,
} from "./api-tokens.js";
import type { InviteAccountConfiguration } from "./invite-auth.service.js";
import type { InviteAccountStore, StoredInviteAccount } from "./invite-account.store.js";

function accountStatus(status: string): StoredInviteAccount["account_status"] {
  if (status === "ACTIVE" || status === "REVOKED") return status;
  return "SUSPENDED";
}

function prismaCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) return undefined;
  return typeof error.code === "string" ? error.code : undefined;
}

function profileChangeRecord(value: {
  id: string;
  userId: string;
  requestedDisplayName: string;
  tenantId: string;
  status: string;
  version: number;
  createdAt: Date;
  reviewedAt: Date | null;
}): ProfileChangeRecord {
  return {
    id: value.id,
    actor_id: value.userId,
    display_name: value.requestedDisplayName,
    tenant_id: value.tenantId,
    status:
      value.status === "APPROVED" || value.status === "REJECTED" ? value.status : "PENDING",
    version: value.version,
    created_at: value.createdAt.toISOString(),
    ...(value.reviewedAt === null ? {} : { reviewed_at: value.reviewedAt.toISOString() }),
  };
}

export class PrismaInviteAccountStore implements InviteAccountStore {
  public constructor(private readonly prisma: PrismaClient) {}

  public async initialize(accounts: readonly InviteAccountConfiguration[]): Promise<void> {
    try {
      await this.prisma.$transaction(
        async (tx) => {
          for (const account of accounts) {
            const userId = account.identity.actor_id;
            const existing = await tx.inviteAuthAccount.findUnique({ where: { userId } });
            if (existing) continue;
            await tx.inviteAuthAccount.create({
              data: {
                userId,
                username: account.username,
                normalizedUsername: account.username.toLowerCase(),
                passwordHash: account.password_hash,
                displayName: account.identity.display_name,
              },
            });
          }
        },
        { isolationLevel: "Serializable", maxWait: 4000, timeout: 8000 },
      );
    } catch {
      throw new Error("Invite account initialization failed.");
    }
  }

  public async findByActorId(actorId: string): Promise<StoredInviteAccount | undefined> {
    const value = await this.prisma.inviteAuthAccount.findUnique({
      where: { userId: actorId },
      include: { user: { select: { status: true } } },
    });
    return value === null
      ? undefined
      : {
          actor_id: value.userId,
          username: value.username,
          normalized_username: value.normalizedUsername,
          password_hash: value.passwordHash,
          display_name: value.displayName,
          account_status: accountStatus(value.user.status),
          memberships: [],
        };
  }

  public async findByUsername(normalizedUsername: string): Promise<StoredInviteAccount | undefined> {
    const value = await this.prisma.inviteAuthAccount.findUnique({
      where: { normalizedUsername },
      include: { user: { select: { status: true } } },
    });
    return value === null
      ? undefined
      : {
          actor_id: value.userId,
          username: value.username,
          normalized_username: value.normalizedUsername,
          password_hash: value.passwordHash,
          display_name: value.displayName,
          account_status: accountStatus(value.user.status),
          memberships: [],
        };
  }

  public async updateProfile(actorId: string, displayName: string): Promise<AccountUpdateResult> {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.inviteAuthAccount.updateMany({
        where: { userId: actorId, user: { status: "ACTIVE" } },
        data: { displayName },
      });
      if (updated.count !== 1) return { ok: false, reason: "ACCOUNT_NOT_FOUND" };
      await tx.identitySecurityEvent.create({
        data: { userId: actorId, eventType: "PROFILE_UPDATED", outcome: "SUCCESS" },
      });
      return { ok: true };
    });
  }

  public async updateUsername(
    actorId: string,
    username: string,
    normalizedUsername: string,
    now: Date,
  ): Promise<AccountUpdateResult> {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const owner = await tx.inviteAuthAccount.findUnique({ where: { normalizedUsername } });
          if (owner && owner.userId !== actorId) {
            return { ok: false, reason: "USERNAME_TAKEN" };
          }
          const updated = await tx.inviteAuthAccount.updateMany({
            where: { userId: actorId, user: { status: "ACTIVE" } },
            data: { username, normalizedUsername },
          });
          if (updated.count !== 1) return { ok: false, reason: "ACCOUNT_NOT_FOUND" };
          await tx.inviteAuthSession.deleteMany({ where: { userId: actorId } });
          await tx.identitySecurityEvent.create({
            data: { userId: actorId, eventType: "USERNAME_UPDATED", outcome: "SUCCESS", createdAt: now },
          });
          return { ok: true };
        },
        { isolationLevel: "Serializable", maxWait: 4000, timeout: 8000 },
      );
    } catch (error) {
      if (prismaCode(error) === "P2002") return { ok: false, reason: "USERNAME_TAKEN" };
      throw error;
    }
  }

  public async updatePassword(
    actorId: string,
    passwordHash: string,
    now: Date,
  ): Promise<AccountUpdateResult> {
    return this.prisma.$transaction(
      async (tx) => {
        const updated = await tx.inviteAuthAccount.updateMany({
          where: { userId: actorId, user: { status: "ACTIVE" } },
          data: { passwordHash, passwordChangedAt: now },
        });
        if (updated.count !== 1) return { ok: false, reason: "ACCOUNT_NOT_FOUND" };
        await tx.inviteAuthSession.deleteMany({ where: { userId: actorId } });
        await tx.identitySecurityEvent.create({
          data: { userId: actorId, eventType: "PASSWORD_UPDATED", outcome: "SUCCESS", createdAt: now },
        });
        return { ok: true };
      },
      { isolationLevel: "Serializable", maxWait: 4000, timeout: 8000 },
    );
  }

  public async countRecentReauthFailures(actorId: string, since: Date): Promise<number> {
    return this.prisma.identitySecurityEvent.count({
      where: {
        userId: actorId,
        eventType: "CREDENTIAL_REAUTH_FAILED",
        createdAt: { gte: since },
      },
    });
  }

  public async recordFailedReauth(actorId: string, now: Date): Promise<void> {
    await this.prisma.identitySecurityEvent.create({
      data: {
        userId: actorId,
        eventType: "CREDENTIAL_REAUTH_FAILED",
        outcome: "FAILED",
        createdAt: now,
      },
    });
  }

  public async logoutAll(actorId: string, now: Date): Promise<void> {
    await this.prisma.$transaction(
      async (tx) => {
        await tx.inviteAuthSession.deleteMany({ where: { userId: actorId } });
        await tx.identitySecurityEvent.create({
          data: { userId: actorId, eventType: "LOGOUT_ALL", outcome: "SUCCESS", createdAt: now },
        });
      },
      { isolationLevel: "Serializable", maxWait: 4000, timeout: 8000 },
    );
  }

  public async createProfileChangeRequest(
    actorId: string,
    tenantId: string,
    displayName: string,
    now: Date,
  ): Promise<{ readonly result: AccountUpdateResult; readonly request?: ProfileChangeRecord }> {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const membership = await tx.membership.findFirst({
            where: { userId: actorId, tenantId, status: "ACTIVE" },
            select: { id: true },
          });
          if (!membership) return { result: { ok: false, reason: "FORBIDDEN_SCOPE" } };
          const created = await tx.userProfileChangeRequest.create({
            data: { userId: actorId, tenantId, requestedDisplayName: displayName, createdAt: now },
          });
          await tx.identitySecurityEvent.create({
            data: {
              userId: actorId,
              eventType: "PROFILE_CHANGE_REQUESTED",
              outcome: "SUCCESS",
              createdAt: now,
            },
          });
          return { result: { ok: true }, request: profileChangeRecord(created) };
        },
        { isolationLevel: "Serializable", maxWait: 4000, timeout: 8000 },
      );
    } catch (error) {
      if (prismaCode(error) === "P2002") {
        return { result: { ok: false, reason: "PROFILE_CHANGE_PENDING" } };
      }
      throw error;
    }
  }

  public async listProfileChangeRequests(
    tenantId: string,
  ): Promise<readonly ProfileChangeRecord[]> {
    const values = await this.prisma.userProfileChangeRequest.findMany({
      where: { tenantId, status: "PENDING" },
      orderBy: { createdAt: "asc" },
    });
    return values.map(profileChangeRecord);
  }

  public async reviewProfileChangeRequest(input: {
    readonly requestId: string;
    readonly tenantId: string;
    readonly reviewerId: string;
    readonly expectedVersion: number;
    readonly approved: boolean;
    readonly now: Date;
  }): Promise<AccountUpdateResult> {
    return this.prisma.$transaction(
      async (tx) => {
        const reviewerMembership = await tx.membership.findFirst({
          where: { userId: input.reviewerId, tenantId: input.tenantId, status: "ACTIVE" },
          select: { id: true },
        });
        if (!reviewerMembership) return { ok: false, reason: "FORBIDDEN_SCOPE" };
        const request = await tx.userProfileChangeRequest.findFirst({
          where: { id: input.requestId, tenantId: input.tenantId },
        });
        if (!request) return { ok: false, reason: "PROFILE_CHANGE_NOT_FOUND" };
        if (request.status !== "PENDING" || request.version !== input.expectedVersion) {
          return { ok: false, reason: "PROFILE_CHANGE_CONFLICT" };
        }
        const applicantMembership = await tx.membership.findFirst({
          where: { userId: request.userId, tenantId: input.tenantId, status: "ACTIVE" },
          select: { id: true },
        });
        if (!applicantMembership) return { ok: false, reason: "FORBIDDEN_SCOPE" };
        const updated = await tx.userProfileChangeRequest.updateMany({
          where: {
            id: input.requestId,
            tenantId: input.tenantId,
            status: "PENDING",
            version: input.expectedVersion,
          },
          data: {
            status: input.approved ? "APPROVED" : "REJECTED",
            version: { increment: 1 },
            reviewerUserId: input.reviewerId,
            reviewedAt: input.now,
          },
        });
        if (updated.count !== 1) return { ok: false, reason: "PROFILE_CHANGE_CONFLICT" };
        if (input.approved) {
          const accountUpdated = await tx.inviteAuthAccount.updateMany({
            where: { userId: request.userId, user: { status: "ACTIVE" } },
            data: { displayName: request.requestedDisplayName },
          });
          if (accountUpdated.count !== 1) return { ok: false, reason: "ACCOUNT_NOT_FOUND" };
          await tx.identitySecurityEvent.create({
            data: {
              userId: request.userId,
              eventType: "PROFILE_UPDATED",
              outcome: "SUCCESS",
              createdAt: input.now,
            },
          });
        }
        await tx.identitySecurityEvent.create({
          data: {
            userId: input.reviewerId,
            eventType: "PROFILE_CHANGE_REVIEWED",
            outcome: "SUCCESS",
            createdAt: input.now,
          },
        });
        return { ok: true };
      },
      { isolationLevel: "Serializable", maxWait: 4000, timeout: 8000 },
    );
  }
}
