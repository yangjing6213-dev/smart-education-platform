import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "../src/generated/prisma/client.js";
import { PrismaInviteSessionStore } from "../src/nest/prisma-invite-session.store.js";

const databaseUrl = process.env.INVITE_REVOCATION_TEST_DATABASE_URL;

// Wait for PostgreSQL to report a real blocked writer before committing the first transaction.
async function race(
  db: PrismaClient,
  first: (tx: Prisma.TransactionClient) => Promise<unknown>,
  second: (tx: Prisma.TransactionClient) => Promise<unknown>,
): Promise<unknown> {
  let contender: Promise<unknown> | undefined;
  try {
    await db.$transaction(
      async (tx) => {
        await first(tx);
        contender = db.$transaction(second, { timeout: 12000 });
        void contender.catch(() => {});
        const until = Date.now() + 7000;
        do {
          const [state] = await tx.$queryRaw<{ waiting: boolean }[]>`
          SELECT EXISTS (
            SELECT FROM pg_catalog.pg_locks
            WHERE NOT granted AND pg_catalog.pg_backend_pid() = ANY(pg_catalog.pg_blocking_pids(pid))
          ) AS waiting
        `;
          if (state?.waiting) return;
          await delay(20);
        } while (Date.now() < until);
        assert.fail("Expected the competing operation to wait on the same user");
      },
      { timeout: 11000 },
    );
  } finally {
    await contender;
  }
  return contender;
}

test(
  "disabling an invite user serializes with issuance and old sessions never revive",
  { skip: !databaseUrl },
  async () => {
    assert(databaseUrl);
    assert(["127.0.0.1", "localhost", "[::1]"].includes(new URL(databaseUrl).hostname));
    const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
    const actor = randomUUID(),
      peer = randomUUID();
    const session = (actorId: string) => ({
      actorId,
      tokenHash: randomBytes(32).toString("hex"),
      expiresAt: new Date(Date.now() + 60000),
    });
    const old = session(actor),
      secondOld = session(actor),
      peerToken = session(peer),
      during = session(actor),
      after = session(actor);
    const store = new PrismaInviteSessionStore(db);
    const mark = (tx: Prisma.TransactionClient, status: string) =>
      tx.user.update({ where: { id: actor }, data: { status } });
    try {
      await db.user.createMany({ data: [actor, peer].map((id) => ({ id, status: "ACTIVE" })) });
      assert.equal(await store.create(peerToken), true);
      assert.equal(await store.create(secondOld), true);
      await race(
        db,
        async (tx) => {
          assert.equal(await new PrismaInviteSessionStore(tx).create(old), true);
        },
        (tx) => mark(tx, "DISABLED"),
      );
      assert.equal(await db.inviteAuthSession.count({ where: { userId: actor } }), 0);
      assert.equal(await store.find(old.tokenHash), undefined);
      assert.equal(await store.find(secondOld.tokenHash), undefined);
      assert.equal((await store.find(peerToken.tokenHash))?.actorId, peer);
      await mark(db, "ACTIVE");
      assert.equal(await store.find(old.tokenHash), undefined);
      const created = await race(
        db,
        (tx) => mark(tx, "DISABLED"),
        (tx) => new PrismaInviteSessionStore(tx).create(during),
      );
      assert.equal(created, false);
      assert.equal(await db.inviteAuthSession.count({ where: { userId: actor } }), 0);
      await mark(db, "ACTIVE");
      const fresh = new PrismaInviteSessionStore(db);
      assert.equal(await fresh.find(old.tokenHash), undefined);
      assert.equal(await fresh.find(during.tokenHash), undefined);
      assert.equal(await fresh.create(after), true);
      assert.equal((await fresh.find(after.tokenHash))?.actorId, actor);
      assert.equal((await fresh.find(peerToken.tokenHash))?.actorId, peer);
    } finally {
      try {
        await db.user.deleteMany({ where: { id: { in: [actor, peer] } } });
      } finally {
        await db.$disconnect();
      }
    }
  },
);
