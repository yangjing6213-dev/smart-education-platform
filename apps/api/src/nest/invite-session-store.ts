export interface InviteSession {
  readonly tokenHash: string;
  readonly actorId: string;
  readonly expiresAt: Date;
}

export interface InviteSessionStore {
  create(session: InviteSession): Promise<boolean>;
  find(tokenHash: string): Promise<InviteSession | undefined>;
  delete(tokenHash: string): Promise<void>;
  deleteByActor?(actorId: string): Promise<void>;
  deleteExpired(expiresAtOrBefore: Date): Promise<void>;
}

export class InMemoryInviteSessionStore implements InviteSessionStore {
  private readonly sessions = new Map<string, InviteSession>();

  public async create(session: InviteSession): Promise<boolean> {
    this.sessions.set(session.tokenHash, session);
    return true;
  }

  public async find(tokenHash: string): Promise<InviteSession | undefined> {
    return this.sessions.get(tokenHash);
  }

  public async delete(tokenHash: string): Promise<void> {
    this.sessions.delete(tokenHash);
  }

  public async deleteByActor(actorId: string): Promise<void> {
    for (const [tokenHash, session] of this.sessions) {
      if (session.actorId === actorId) this.sessions.delete(tokenHash);
    }
  }

  public async deleteExpired(expiresAtOrBefore: Date): Promise<void> {
    for (const [tokenHash, session] of this.sessions) {
      if (session.expiresAt <= expiresAtOrBefore) this.sessions.delete(tokenHash);
    }
  }
}
