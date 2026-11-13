import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import {
  isRecord,
  isTrustedIdentity,
  isTrustedMembership,
  type TrustedAuthResult,
  type TrustedMembership,
} from "@student-care/auth";
import type {
  AccountCenterRecord,
  AccountUpdateResult,
  ApiHttpRequest,
  InviteAuthOperations,
  InviteLoginResult,
  ProfileChangeRecord,
} from "./api-tokens.js";
import { InMemoryInviteAccountStore, type InviteAccountStore } from "./invite-account.store.js";
import { InMemoryInviteSessionStore, type InviteSessionStore } from "./invite-session-store.js";

const PASSWORD_HASH_ALGORITHM = "scrypt";
const SCRYPT_COST = 16_384;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELISM = 1;
const PASSWORD_KEY_BYTES = 64;
const SESSION_LIFETIME_MS = 8 * 60 * 60 * 1000;
const DUMMY_SALT = Buffer.from("invite-auth-dummy-salt", "utf8");
const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,63}$/;

export interface InviteAccountConfiguration {
  readonly username: string;
  readonly password_hash: string;
  readonly identity: { readonly actor_id: string; readonly display_name: string };
  readonly memberships: readonly TrustedMembership[];
  readonly binding_student_ids?: readonly string[];
}

interface PasswordHashParts {
  readonly salt: Buffer;
  readonly derivedKey: Buffer;
}

function derivePasswordKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(
      password,
      salt,
      PASSWORD_KEY_BYTES,
      {
        N: SCRYPT_COST,
        r: SCRYPT_BLOCK_SIZE,
        p: SCRYPT_PARALLELISM,
        maxmem: 64 * 1024 * 1024,
      },
      (error, key) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(Buffer.from(key));
      },
    );
  });
}

function parsePasswordHash(value: string): PasswordHashParts | undefined {
  const parts = value.split("$");
  if (
    parts.length !== 6 ||
    parts[0] !== PASSWORD_HASH_ALGORITHM ||
    parts[1] !== String(SCRYPT_COST) ||
    parts[2] !== String(SCRYPT_BLOCK_SIZE) ||
    parts[3] !== String(SCRYPT_PARALLELISM) ||
    !/^[A-Za-z0-9_-]+$/.test(parts[4] ?? "") ||
    !/^[A-Za-z0-9_-]+$/.test(parts[5] ?? "")
  ) {
    return undefined;
  }
  const salt = Buffer.from(parts[4] ?? "", "base64url");
  const derivedKey = Buffer.from(parts[5] ?? "", "base64url");
  if (salt.length !== 16 || derivedKey.length !== PASSWORD_KEY_BYTES) return undefined;
  return { salt, derivedKey };
}

function normalizedUsername(value: string): string | undefined {
  const normalized = value.trim().toLowerCase();
  return USERNAME_PATTERN.test(normalized) ? normalized : undefined;
}

async function passwordMatches(password: string, passwordHash: string): Promise<boolean> {
  const parts = parsePasswordHash(passwordHash);
  if (parts === undefined) return false;
  const candidate = await derivePasswordKey(password, parts.salt);
  return timingSafeEqual(candidate, parts.derivedKey);
}

function cleanDisplayName(value: string): string | undefined {
  const cleaned = value.trim();
  return cleaned.length > 0 && cleaned.length <= 80 ? cleaned : undefined;
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

function validAccountConfiguration(value: unknown): value is InviteAccountConfiguration {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "username",
      "password_hash",
      "identity",
      "memberships",
      "binding_student_ids",
    ]) ||
    (value.binding_student_ids !== undefined &&
      (!Array.isArray(value.binding_student_ids) ||
        value.binding_student_ids.length > 100 ||
        !value.binding_student_ids.every(
          (id) =>
            typeof id === "string" &&
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id),
        ) ||
        new Set(value.binding_student_ids.map((id) => id.toLowerCase())).size !==
          value.binding_student_ids.length)) ||
    typeof value.username !== "string" ||
    normalizedUsername(value.username) !== value.username ||
    typeof value.password_hash !== "string" ||
    parsePasswordHash(value.password_hash) === undefined ||
    !isRecord(value.identity) ||
    !hasOnlyKeys(value.identity, ["actor_id", "display_name"]) ||
    !isTrustedIdentity(value.identity) ||
    !Array.isArray(value.memberships) ||
    value.memberships.length === 0 ||
    value.memberships.length > 20 ||
    !value.memberships.every(
      (membership) =>
        isRecord(membership) &&
        hasOnlyKeys(membership, ["tenant_id", "campus_ids", "status", "capabilities"]) &&
        isTrustedMembership(membership),
    )
  ) {
    return false;
  }
  return value.memberships.some((membership) => membership.status === "ACTIVE");
}

function validatedAccounts(values: readonly unknown[]): readonly InviteAccountConfiguration[] {
  if (values.length > 100 || !values.every(validAccountConfiguration)) {
    throw new Error("Invite account configuration is invalid.");
  }
  const usernames = new Set<string>();
  const actorIds = new Set<string>();
  for (const account of values) {
    if (usernames.has(account.username) || actorIds.has(account.identity.actor_id)) {
      throw new Error("Invite account configuration is invalid.");
    }
    usernames.add(account.username);
    actorIds.add(account.identity.actor_id);
  }
  return values.map((account) => ({
    username: account.username,
    password_hash: account.password_hash,
    identity: { ...account.identity },
    ...(account.binding_student_ids === undefined
      ? {}
      : { binding_student_ids: [...account.binding_student_ids] }),
    memberships: account.memberships.map((membership) => ({
      tenant_id: membership.tenant_id,
      campus_ids: [...membership.campus_ids],
      status: membership.status,
      capabilities: [...membership.capabilities],
    })),
  }));
}

export function parseInviteAccountsJson(
  value: string | undefined,
): readonly InviteAccountConfiguration[] {
  if (value === undefined || value.trim().length === 0) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) throw new Error("Invalid format.");
    return validatedAccounts(parsed);
  } catch {
    throw new Error("Invite account configuration is invalid.");
  }
}

export async function createInvitePasswordHash(password: string): Promise<string> {
  if (password.length < 12 || password.length > 128) {
    throw new Error("Invite passwords must contain 12 to 128 characters.");
  }
  const salt = randomBytes(16);
  const derivedKey = await derivePasswordKey(password, salt);
  return [
    PASSWORD_HASH_ALGORITHM,
    String(SCRYPT_COST),
    String(SCRYPT_BLOCK_SIZE),
    String(SCRYPT_PARALLELISM),
    salt.toString("base64url"),
    derivedKey.toString("base64url"),
  ].join("$");
}

export class InviteAuthService implements InviteAuthOperations {
  private readonly accountsByActorId: ReadonlyMap<string, InviteAccountConfiguration>;
  private readonly accountStore: InviteAccountStore;
  private initialization: Promise<void> | undefined;

  public constructor(
    accounts: readonly InviteAccountConfiguration[],
    private readonly now: () => Date = () => new Date(),
    private readonly sessions: InviteSessionStore = new InMemoryInviteSessionStore(),
    accountStore?: InviteAccountStore,
  ) {
    const validated = validatedAccounts(accounts);
    this.accountsByActorId = new Map(
      validated.map((account) => [account.identity.actor_id, account]),
    );
    this.accountStore = accountStore ?? new InMemoryInviteAccountStore(this.sessions);
  }

  public async login(username: string, password: string): Promise<InviteLoginResult> {
    if (this.accountsByActorId.size === 0) return { ok: false, reason: "AUTH_NOT_CONFIGURED" };
    await this.ensureInitialized();

    const normalized = normalizedUsername(username);
    const stored = normalized === undefined ? undefined : await this.accountStore.findByUsername(normalized);
    const configured = stored ? this.accountsByActorId.get(stored.actor_id) : undefined;
    if (
      stored === undefined ||
      configured === undefined ||
      stored.account_status !== "ACTIVE"
    ) {
      await derivePasswordKey(password, DUMMY_SALT);
      return { ok: false, reason: "INVALID_CREDENTIALS" };
    }

    if (!(await passwordMatches(password, stored.password_hash))) {
      return { ok: false, reason: "INVALID_CREDENTIALS" };
    }

    const now = this.now().getTime();
    await this.sessions.deleteExpired(new Date(now));
    const expiresAt = now + SESSION_LIFETIME_MS;
    const accessToken = randomBytes(32).toString("base64url");
    const created = await this.sessions.create({
      tokenHash: this.hashToken(accessToken),
      actorId: stored.actor_id,
      expiresAt: new Date(expiresAt),
    });
    if (!created) return { ok: false, reason: "INVALID_CREDENTIALS" };
    return {
      ok: true,
      access_token: accessToken,
      expires_at: new Date(expiresAt).toISOString(),
    };
  }

  public async getTrustedAuthResult(
    request: ApiHttpRequest,
  ): Promise<TrustedAuthResult | undefined> {
    await this.ensureInitialized();
    const token = this.readBearerToken(request);
    if (token === undefined) return undefined;
    const tokenHash = this.hashToken(token);
    const session = await this.sessions.find(tokenHash);
    if (session === undefined) return undefined;

    const now = this.now();
    if (session.expiresAt <= now) {
      await this.sessions.delete(tokenHash);
      return undefined;
    }
    const account = this.accountsByActorId.get(session.actorId);
    const stored = account === undefined ? undefined : await this.accountStore.findByActorId(session.actorId);
    if (account === undefined || stored === undefined || stored.account_status !== "ACTIVE") {
      await this.sessions.delete(tokenHash);
      return undefined;
    }
    return {
      trusted: true,
      session: {
        trusted: true,
        status: "ACTIVE",
        actor_id: account.identity.actor_id,
        expires_at: session.expiresAt.toISOString(),
      },
      identity: { actor_id: account.identity.actor_id, display_name: stored.display_name },
      memberships: account.memberships,
    };
  }

  public async logout(request: ApiHttpRequest): Promise<void> {
    const token = this.readBearerToken(request);
    if (token !== undefined) await this.sessions.delete(this.hashToken(token));
  }

  public async logoutAll(request: ApiHttpRequest): Promise<void> {
    await this.ensureInitialized();
    const token = this.readBearerToken(request);
    if (token === undefined) return;
    const session = await this.sessions.find(this.hashToken(token));
    if (session === undefined || session.expiresAt <= this.now()) return;
    await this.accountStore.logoutAll(session.actorId, this.now());
  }

  public async getAccount(actorId: string): Promise<AccountCenterRecord | undefined> {
    await this.ensureInitialized();
    if (!this.accountsByActorId.has(actorId)) return undefined;
    const account = await this.accountStore.findByActorId(actorId);
    if (account === undefined) return undefined;
    return {
      actor_id: account.actor_id,
      username: account.username,
      display_name: account.display_name,
      account_status: account.account_status,
    };
  }

  public async updateProfile(actorId: string, displayName: string): Promise<AccountUpdateResult> {
    await this.ensureInitialized();
    const cleaned = cleanDisplayName(displayName);
    if (cleaned === undefined) return { ok: false, reason: "PROFILE_INVALID" };
    if (!this.accountsByActorId.has(actorId)) return { ok: false, reason: "ACCOUNT_NOT_FOUND" };
    return this.accountStore.updateProfile(actorId, cleaned);
  }

  public async changeUsername(
    actorId: string,
    currentPassword: string,
    newUsername: string,
  ): Promise<AccountUpdateResult> {
    await this.ensureInitialized();
    const normalized = normalizedUsername(newUsername);
    if (normalized === undefined) return { ok: false, reason: "USERNAME_INVALID" };
    if (!this.accountsByActorId.has(actorId)) return { ok: false, reason: "ACCOUNT_NOT_FOUND" };
    const verified = await this.verifyCurrentPassword(actorId, currentPassword);
    if (!verified.ok) return verified;
    return this.accountStore.updateUsername(actorId, normalized, normalized, this.now());
  }

  public async changePassword(
    actorId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<AccountUpdateResult> {
    await this.ensureInitialized();
    if (newPassword.length < 12 || newPassword.length > 128) {
      return { ok: false, reason: "PASSWORD_INVALID" };
    }
    if (!this.accountsByActorId.has(actorId)) return { ok: false, reason: "ACCOUNT_NOT_FOUND" };
    const verified = await this.verifyCurrentPassword(actorId, currentPassword);
    if (!verified.ok) return verified;
    const passwordHash = await createInvitePasswordHash(newPassword);
    return this.accountStore.updatePassword(actorId, passwordHash, this.now());
  }

  public async createProfileChangeRequest(
    actorId: string,
    tenantId: string,
    displayName: string,
  ): Promise<{ readonly result: AccountUpdateResult; readonly request?: ProfileChangeRecord }> {
    await this.ensureInitialized();
    const cleaned = cleanDisplayName(displayName);
    if (cleaned === undefined) return { result: { ok: false, reason: "PROFILE_INVALID" } };
    return this.accountStore.createProfileChangeRequest(actorId, tenantId, cleaned, this.now());
  }

  public async listProfileChangeRequests(tenantId: string): Promise<readonly ProfileChangeRecord[]> {
    await this.ensureInitialized();
    return this.accountStore.listProfileChangeRequests(tenantId);
  }

  public async reviewProfileChangeRequest(input: {
    readonly requestId: string;
    readonly tenantId: string;
    readonly reviewerId: string;
    readonly expectedVersion: number;
    readonly approved: boolean;
  }): Promise<AccountUpdateResult> {
    await this.ensureInitialized();
    return this.accountStore.reviewProfileChangeRequest({ ...input, now: this.now() });
  }

  private async verifyCurrentPassword(
    actorId: string,
    currentPassword: string,
  ): Promise<AccountUpdateResult> {
    const now = this.now();
    if ((await this.accountStore.countRecentReauthFailures(actorId, new Date(now.getTime() - 15 * 60_000))) >= 5) {
      return { ok: false, reason: "RATE_LIMITED" };
    }
    const account = await this.accountStore.findByActorId(actorId);
    if (account === undefined || account.account_status !== "ACTIVE") {
      return { ok: false, reason: "ACCOUNT_NOT_FOUND" };
    }
    if (!(await passwordMatches(currentPassword, account.password_hash))) {
      await this.accountStore.recordFailedReauth(actorId, now);
      return { ok: false, reason: "CURRENT_PASSWORD_INVALID" };
    }
    return { ok: true };
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialization) {
      this.initialization = this.accountStore.initialize([...this.accountsByActorId.values()]).catch((error: unknown) => {
        this.initialization = undefined;
        throw error;
      });
    }
    await this.initialization;
  }

  private readBearerToken(request: ApiHttpRequest): string | undefined {
    const header = request.headers.authorization;
    if (typeof header !== "string") return undefined;
    const match = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(header);
    return match?.[1];
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }
}
