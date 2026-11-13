import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  createInvitePasswordHash,
  InviteAuthService,
  type InviteAccountConfiguration,
} from "../src/nest/invite-auth.service.js";
import { PrismaInviteSessionStore } from "../src/nest/prisma-invite-session.store.js";
import type { PrismaClient } from "../src/generated/prisma/client.js";

type FakeSessionRow = {
  readonly tokenHash: string;
  readonly userId: string;
  readonly expiresAt: Date;
};

const PASSWORD = "Synthetic-only-Invite-73!";
const ACTOR_ID = "00000000-0000-4000-8000-000000000066";
const TENANT_ID = "00000000-0000-4000-8000-000000000064";
const CAMPUS_ID = "00000000-0000-4000-8000-000000000065";

function createFakePrisma(): {
  readonly prisma: Pick<PrismaClient, "inviteAuthSession">;
  readonly rows: Map<string, FakeSessionRow>;
  readonly inactiveActors: Set<string>;
} {
  const rows = new Map<string, FakeSessionRow>();
  const inactiveActors = new Set<string>();
  const inviteAuthSession = {
    async createMany({ data }: { data: FakeSessionRow }) {
      if (inactiveActors.has(data.userId)) return { count: 0 };
      rows.set(data.tokenHash, data);
      return { count: 1 };
    },
    async findUnique({ where }: { where: { tokenHash: string; user?: { status: string } } }) {
      const row = rows.get(where.tokenHash);
      if (row && where.user?.status === "ACTIVE" && inactiveActors.has(row.userId)) return null;
      return row ?? null;
    },
    async deleteMany({ where }: { where: { tokenHash?: string; expiresAt?: { lte: Date } } }) {
      let count = 0;
      for (const [tokenHash, row] of rows) {
        if (
          (where.tokenHash !== undefined && tokenHash === where.tokenHash) ||
          (where.expiresAt !== undefined && row.expiresAt <= where.expiresAt.lte)
        ) {
          rows.delete(tokenHash);
          count += 1;
        }
      }
      return { count };
    },
  };
  return {
    prisma: { inviteAuthSession } as unknown as Pick<PrismaClient, "inviteAuthSession">,
    rows,
    inactiveActors,
  };
}

test("an inactive invited actor cannot use an existing session or obtain a new token", async () => {
  const account = await createAccount();
  const database = createFakePrisma();
  const service = new InviteAuthService(
    [account],
    undefined,
    new PrismaInviteSessionStore(database.prisma),
  );
  const login = await service.login(account.username, PASSWORD);
  assert(login.ok);
  database.inactiveActors.add(ACTOR_ID);
  const request = {
    query: {},
    params: {},
    headers: { authorization: `Bearer ${login.access_token}` },
  };
  assert.equal((await service.getTrustedAuthResult(request)) === undefined, true);
  const bad = await service.login(account.username, "different-synthetic-password");
  assert.equal(bad.ok, false);
  const disabled = await service.login(account.username, PASSWORD);
  assert.equal(disabled.ok, false);
  if (!disabled.ok && !bad.ok) assert.equal(disabled.reason, bad.reason);
  assert.equal(database.rows.size, 1);
});

test("session persistence errors cannot issue a token or authenticate a request", async () => {
  const account = await createAccount();
  const failure = async () => {
    throw new Error("synthetic store failure");
  };
  const service = new InviteAuthService([account], undefined, {
    create: failure,
    find: failure,
    delete: failure,
    deleteExpired: async () => {},
  });
  await assert.rejects(service.login(account.username, PASSWORD), /synthetic store failure/);
  await assert.rejects(
    service.getTrustedAuthResult({
      query: {},
      params: {},
      headers: { authorization: "Bearer " + "X".repeat(43) },
    }),
    /synthetic store failure/,
  );
});

async function createAccount(): Promise<InviteAccountConfiguration> {
  return {
    username: "synthetic.parent",
    password_hash: await createInvitePasswordHash(PASSWORD),
    identity: { actor_id: ACTOR_ID, display_name: "模拟家长" },
    memberships: [
      {
        tenant_id: TENANT_ID,
        campus_ids: [CAMPUS_ID],
        status: "ACTIVE",
        capabilities: ["binding:apply"],
      },
    ],
  };
}

test("invite sessions survive auth-service recreation without storing bearer tokens", async () => {
  const now = new Date("2026-10-19T12:00:00.000Z");
  const account = await createAccount();
  const database = createFakePrisma();
  const first = new InviteAuthService(
    [account],
    () => new Date(now),
    new PrismaInviteSessionStore(database.prisma),
  );

  const login = await first.login(account.username, PASSWORD);
  assert.equal(login.ok, true);
  if (!login.ok) return;

  assert.equal(database.rows.size, 1);
  const [stored] = database.rows.values();
  assert.ok(stored);
  assert.match(stored.tokenHash, /^[0-9a-f]{64}$/u);
  assert.notEqual(stored.tokenHash, login.access_token);
  assert.equal(stored.userId, ACTOR_ID);
  assert.equal(stored.expiresAt.toISOString(), "2026-10-19T20:00:00.000Z");

  const second = new InviteAuthService(
    [account],
    () => new Date(now),
    new PrismaInviteSessionStore(database.prisma),
  );
  const request = {
    query: {},
    params: {},
    headers: { authorization: `Bearer ${login.access_token}` },
  };
  const trusted = await second.getTrustedAuthResult(request);
  assert.equal(trusted?.identity.actor_id, ACTOR_ID);
  assert.deepEqual(trusted?.memberships[0]?.campus_ids, [CAMPUS_ID]);

  await second.logout(request);
  assert.equal(await first.getTrustedAuthResult(request), undefined);
  assert.equal(database.rows.size, 0);
});

test("expired sessions are rejected and removed from the shared session store", async () => {
  const now = new Date("2026-10-20T04:00:00.000Z");
  const database = createFakePrisma();
  const expiredToken = "A".repeat(43);
  const expiredTokenHash = createHash("sha256").update(expiredToken).digest("hex");
  database.rows.set(expiredTokenHash, {
    tokenHash: expiredTokenHash,
    userId: ACTOR_ID,
    expiresAt: new Date(now),
  });
  const service = new InviteAuthService(
    [],
    () => new Date(now),
    new PrismaInviteSessionStore(database.prisma),
  );
  const request = {
    query: {},
    params: {},
    headers: { authorization: `Bearer ${expiredToken}` },
  };
  assert.equal(await service.getTrustedAuthResult(request), undefined);
  assert.equal(database.rows.size, 0);
});

test("sessions for invite accounts removed from current configuration are revoked", async () => {
  const now = new Date("2026-10-19T12:00:00.000Z");
  const database = createFakePrisma();
  const token = "B".repeat(43);
  const tokenHash = createHash("sha256").update(token).digest("hex");
  database.rows.set(tokenHash, {
    tokenHash,
    userId: ACTOR_ID,
    expiresAt: new Date("2026-10-19T20:00:00.000Z"),
  });
  const service = new InviteAuthService(
    [],
    () => new Date(now),
    new PrismaInviteSessionStore(database.prisma),
  );

  const trusted = await service.getTrustedAuthResult({
    query: {},
    params: {},
    headers: { authorization: `Bearer ${token}` },
  });

  assert.equal(trusted, undefined);
  assert.equal(database.rows.size, 0);
});

test("Prisma invite session store maps actor IDs and cleans expired rows", async () => {
  const database = createFakePrisma();
  const store = new PrismaInviteSessionStore(database.prisma);
  const expiresAt = new Date("2026-10-19T20:00:00.000Z");
  const stored = {
    tokenHash: "c".repeat(64),
    actorId: ACTOR_ID,
    expiresAt,
  };
  await store.create(stored);
  assert.deepEqual(database.rows.get(stored.tokenHash), {
    tokenHash: stored.tokenHash,
    userId: ACTOR_ID,
    expiresAt,
  });
  assert.deepEqual(await store.find(stored.tokenHash), stored);

  await store.deleteExpired(expiresAt);
  assert.equal(database.rows.size, 0);

  await store.create({ ...stored, tokenHash: "d".repeat(64) });
  await store.delete("d".repeat(64));
  assert.equal(database.rows.size, 0);
});
