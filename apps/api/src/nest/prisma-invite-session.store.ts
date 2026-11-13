import type { PrismaClient } from "../generated/prisma/client.js";
import type { InviteSession, InviteSessionStore } from "./invite-session-store.js";

export class PrismaInviteSessionStore implements InviteSessionStore {
  public constructor(private readonly prisma: Pick<PrismaClient, "inviteAuthSession">) {}

  public async create(session: InviteSession): Promise<boolean> {
    const { count } = await this.prisma.inviteAuthSession.createMany({
      data: {
        tokenHash: session.tokenHash,
        userId: session.actorId,
        expiresAt: session.expiresAt,
      },
    });
    return count === 1;
  }

  public async find(tokenHash: string): Promise<InviteSession | undefined> {
    const session = await this.prisma.inviteAuthSession.findUnique({
      where: { tokenHash, user: { status: "ACTIVE" } },
    });
    return session === null
      ? undefined
      : {
          tokenHash: session.tokenHash,
          actorId: session.userId,
          expiresAt: session.expiresAt,
        };
  }

  public async delete(tokenHash: string): Promise<void> {
    await this.prisma.inviteAuthSession.deleteMany({ where: { tokenHash } });
  }

  public async deleteExpired(expiresAtOrBefore: Date): Promise<void> {
    await this.prisma.inviteAuthSession.deleteMany({
      where: { expiresAt: { lte: expiresAtOrBefore } },
    });
  }
}
