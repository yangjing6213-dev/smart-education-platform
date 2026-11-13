import type { TrustedMembership } from "@student-care/auth";
import type {
  AccountCenterRecord,
  AccountUpdateResult,
  ProfileChangeRecord,
} from "./api-tokens.js";
import type { InviteAccountConfiguration } from "./invite-auth.service.js";
import type { InviteSessionStore } from "./invite-session-store.js";

export interface StoredInviteAccount extends AccountCenterRecord {
  readonly normalized_username: string;
  readonly password_hash: string;
  readonly memberships: readonly TrustedMembership[];
}

export interface InviteAccountStore {
  initialize(accounts: readonly InviteAccountConfiguration[]): Promise<void>;
  findByActorId(actorId: string): Promise<StoredInviteAccount | undefined>;
  findByUsername(normalizedUsername: string): Promise<StoredInviteAccount | undefined>;
  updateProfile(actorId: string, displayName: string): Promise<AccountUpdateResult>;
  updateUsername(
    actorId: string,
    username: string,
    normalizedUsername: string,
    now: Date,
  ): Promise<AccountUpdateResult>;
  updatePassword(actorId: string, passwordHash: string, now: Date): Promise<AccountUpdateResult>;
  countRecentReauthFailures(actorId: string, since: Date): Promise<number>;
  recordFailedReauth(actorId: string, now: Date): Promise<void>;
  logoutAll(actorId: string, now: Date): Promise<void>;
  createProfileChangeRequest(
    actorId: string,
    tenantId: string,
    displayName: string,
    now: Date,
  ): Promise<{ readonly result: AccountUpdateResult; readonly request?: ProfileChangeRecord }>;
  listProfileChangeRequests(tenantId: string): Promise<readonly ProfileChangeRecord[]>;
  reviewProfileChangeRequest(input: {
    readonly requestId: string;
    readonly tenantId: string;
    readonly reviewerId: string;
    readonly expectedVersion: number;
    readonly approved: boolean;
    readonly now: Date;
  }): Promise<AccountUpdateResult>;
}

interface MemoryAccount {
  actorId: string;
  username: string;
  normalizedUsername: string;
  passwordHash: string;
  displayName: string;
  memberships: readonly TrustedMembership[];
  accountStatus: AccountCenterRecord["account_status"];
}

interface MemorySecurityEvent {
  readonly actorId: string;
  readonly eventType: string;
  readonly outcome: string;
  readonly createdAt: Date;
}

interface MemoryProfileChange extends ProfileChangeRecord {
  readonly actorId: string;
  readonly created: Date;
  status: ProfileChangeRecord["status"];
  version: number;
  reviewedAt?: string;
}

function profileRecord(value: MemoryProfileChange): ProfileChangeRecord {
  return {
    id: value.id,
    actor_id: value.actor_id,
    display_name: value.display_name,
    tenant_id: value.tenant_id,
    status: value.status,
    version: value.version,
    created_at: value.created_at,
    ...(value.reviewedAt === undefined ? {} : { reviewed_at: value.reviewedAt }),
  };
}

function canManageMembership(memberships: readonly TrustedMembership[], tenantId: string): boolean {
  return memberships.some(
    (membership) =>
      membership.tenant_id === tenantId &&
      membership.status === "ACTIVE" &&
      membership.capabilities.includes("memberships:manage"),
  );
}

function isOrganizationMember(memberships: readonly TrustedMembership[], tenantId: string): boolean {
  return memberships.some(
    (membership) => membership.tenant_id === tenantId && membership.status === "ACTIVE",
  );
}

function canRequestOrganizationNameChange(
  memberships: readonly TrustedMembership[],
  tenantId: string,
): boolean {
  return memberships.some(
    (membership) =>
      membership.tenant_id === tenantId &&
      membership.status === "ACTIVE" &&
      (membership.capabilities.includes("care:write") ||
        membership.capabilities.includes("daily:create") ||
        membership.capabilities.includes("memberships:manage")),
  );
}

export class InMemoryInviteAccountStore implements InviteAccountStore {
  private readonly accountsByActorId = new Map<string, MemoryAccount>();
  private readonly actorIdByUsername = new Map<string, string>();
  private readonly events: MemorySecurityEvent[] = [];
  private readonly profileChanges = new Map<string, MemoryProfileChange>();

  public constructor(private readonly sessions?: InviteSessionStore) {}

  public async initialize(accounts: readonly InviteAccountConfiguration[]): Promise<void> {
    for (const account of accounts) {
      const actorId = account.identity.actor_id;
      const existing = this.accountsByActorId.get(actorId);
      if (existing) continue;
      const normalizedUsername = account.username.toLowerCase();
      const owner = this.actorIdByUsername.get(normalizedUsername);
      if (owner !== undefined && owner !== actorId) {
        throw new Error("Invite account initialization conflicts with an existing username.");
      }
      const record: MemoryAccount = {
        actorId,
        username: account.username,
        normalizedUsername,
        passwordHash: account.password_hash,
        displayName: account.identity.display_name,
        memberships: account.memberships,
        accountStatus: "ACTIVE",
      };
      this.accountsByActorId.set(actorId, record);
      this.actorIdByUsername.set(normalizedUsername, actorId);
    }
  }

  public async findByActorId(actorId: string): Promise<StoredInviteAccount | undefined> {
    const account = this.accountsByActorId.get(actorId);
    return account === undefined ? undefined : this.toStored(account);
  }

  public async findByUsername(normalizedUsername: string): Promise<StoredInviteAccount | undefined> {
    const actorId = this.actorIdByUsername.get(normalizedUsername);
    return actorId === undefined ? undefined : this.findByActorId(actorId);
  }

  public async updateProfile(actorId: string, displayName: string): Promise<AccountUpdateResult> {
    const account = this.accountsByActorId.get(actorId);
    if (!account) return { ok: false, reason: "ACCOUNT_NOT_FOUND" };
    account.displayName = displayName;
    this.recordEvent(actorId, "PROFILE_UPDATED", "SUCCESS", new Date());
    return { ok: true };
  }

  public async updateUsername(
    actorId: string,
    username: string,
    normalizedUsername: string,
    now: Date,
  ): Promise<AccountUpdateResult> {
    const account = this.accountsByActorId.get(actorId);
    if (!account) return { ok: false, reason: "ACCOUNT_NOT_FOUND" };
    const owner = this.actorIdByUsername.get(normalizedUsername);
    if (owner !== undefined && owner !== actorId) {
      return { ok: false, reason: "USERNAME_TAKEN" };
    }
    this.actorIdByUsername.delete(account.normalizedUsername);
    account.username = username;
    account.normalizedUsername = normalizedUsername;
    this.actorIdByUsername.set(normalizedUsername, actorId);
    await this.sessions?.deleteByActor?.(actorId);
    this.recordEvent(actorId, "USERNAME_UPDATED", "SUCCESS", now);
    return { ok: true };
  }

  public async updatePassword(
    actorId: string,
    passwordHash: string,
    now: Date,
  ): Promise<AccountUpdateResult> {
    const account = this.accountsByActorId.get(actorId);
    if (!account) return { ok: false, reason: "ACCOUNT_NOT_FOUND" };
    account.passwordHash = passwordHash;
    await this.sessions?.deleteByActor?.(actorId);
    this.recordEvent(actorId, "PASSWORD_UPDATED", "SUCCESS", now);
    return { ok: true };
  }

  public async countRecentReauthFailures(actorId: string, since: Date): Promise<number> {
    return this.events.filter(
      (event) =>
        event.actorId === actorId &&
        event.eventType === "CREDENTIAL_REAUTH_FAILED" &&
        event.createdAt >= since,
    ).length;
  }

  public async recordFailedReauth(actorId: string, now: Date): Promise<void> {
    this.recordEvent(actorId, "CREDENTIAL_REAUTH_FAILED", "FAILED", now);
  }

  public async logoutAll(actorId: string, now: Date): Promise<void> {
    await this.sessions?.deleteByActor?.(actorId);
    this.recordEvent(actorId, "LOGOUT_ALL", "SUCCESS", now);
  }

  public async createProfileChangeRequest(
    actorId: string,
    tenantId: string,
    displayName: string,
    now: Date,
  ): Promise<{ readonly result: AccountUpdateResult; readonly request?: ProfileChangeRecord }> {
    const account = this.accountsByActorId.get(actorId);
    if (!account) return { result: { ok: false, reason: "ACCOUNT_NOT_FOUND" } };
    if (!canRequestOrganizationNameChange(account.memberships, tenantId)) {
      return { result: { ok: false, reason: "FORBIDDEN_SCOPE" } };
    }
    if (
      [...this.profileChanges.values()].some(
        (request) =>
          request.actor_id === actorId &&
          request.tenant_id === tenantId &&
          request.status === "PENDING",
      )
    ) {
      return { result: { ok: false, reason: "PROFILE_CHANGE_PENDING" } };
    }
    const request: MemoryProfileChange = {
      id: crypto.randomUUID(),
      actorId,
      actor_id: actorId,
      display_name: displayName,
      tenant_id: tenantId,
      status: "PENDING",
      version: 1,
      created: now,
      created_at: now.toISOString(),
    };
    this.profileChanges.set(request.id, request);
    this.recordEvent(actorId, "PROFILE_CHANGE_REQUESTED", "SUCCESS", now);
    return { result: { ok: true }, request: profileRecord(request) };
  }

  public async listProfileChangeRequests(tenantId: string): Promise<readonly ProfileChangeRecord[]> {
    return [...this.profileChanges.values()]
      .filter((request) => request.tenant_id === tenantId && request.status === "PENDING")
      .sort((left, right) => left.created.getTime() - right.created.getTime())
      .map(profileRecord);
  }

  public async reviewProfileChangeRequest(input: {
    readonly requestId: string;
    readonly tenantId: string;
    readonly reviewerId: string;
    readonly expectedVersion: number;
    readonly approved: boolean;
    readonly now: Date;
  }): Promise<AccountUpdateResult> {
    const reviewer = this.accountsByActorId.get(input.reviewerId);
    if (!reviewer || !canManageMembership(reviewer.memberships, input.tenantId)) {
      return { ok: false, reason: "FORBIDDEN_SCOPE" };
    }
    const request = this.profileChanges.get(input.requestId);
    if (!request || request.tenant_id !== input.tenantId) {
      return { ok: false, reason: "PROFILE_CHANGE_NOT_FOUND" };
    }
    if (request.status !== "PENDING" || request.version !== input.expectedVersion) {
      return { ok: false, reason: "PROFILE_CHANGE_CONFLICT" };
    }
    const target = this.accountsByActorId.get(request.actorId);
    if (!target || !isOrganizationMember(target.memberships, input.tenantId)) {
      return { ok: false, reason: "FORBIDDEN_SCOPE" };
    }
    request.status = input.approved ? "APPROVED" : "REJECTED";
    request.version += 1;
    request.reviewedAt = input.now.toISOString();
    if (input.approved) {
      target.displayName = request.display_name;
      this.recordEvent(target.actorId, "PROFILE_UPDATED", "SUCCESS", input.now);
    }
    this.recordEvent(input.reviewerId, "PROFILE_CHANGE_REVIEWED", "SUCCESS", input.now);
    return { ok: true };
  }

  private toStored(account: MemoryAccount): StoredInviteAccount {
    return {
      actor_id: account.actorId,
      username: account.username,
      normalized_username: account.normalizedUsername,
      password_hash: account.passwordHash,
      display_name: account.displayName,
      account_status: account.accountStatus,
      memberships: account.memberships,
    };
  }

  private recordEvent(actorId: string, eventType: string, outcome: string, createdAt: Date): void {
    this.events.push({ actorId, eventType, outcome, createdAt });
  }
}
