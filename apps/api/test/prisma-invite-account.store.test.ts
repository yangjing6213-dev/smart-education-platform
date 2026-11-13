import assert from "node:assert/strict";
import test from "node:test";
import type { PrismaClient } from "../src/generated/prisma/client.js";
import type { InviteAccountConfiguration } from "../src/nest/invite-auth.service.js";
import { PrismaInviteAccountStore } from "../src/nest/prisma-invite-account.store.js";

const ACTOR_ID = "00000000-0000-4000-8000-000000000103";

type StoredRow = {
  userId: string;
  username: string;
  normalizedUsername: string;
  passwordHash: string;
  displayName: string;
  user: { status: string };
};

class FakePrisma {
  public readonly accounts = new Map<string, StoredRow>();
  public readonly inviteAuthAccount = {
    findUnique: async ({ where }: { where: { userId?: string; normalizedUsername?: string } }) => {
      const account = where.userId
        ? this.accounts.get(where.userId)
        : [...this.accounts.values()].find(
            (candidate) => candidate.normalizedUsername === where.normalizedUsername,
          );
      return account ?? null;
    },
    create: async ({ data }: { data: Omit<StoredRow, "user"> }) => {
      const row: StoredRow = { ...data, user: { status: "ACTIVE" } };
      this.accounts.set(row.userId, row);
      return row;
    },
  };

  public async $transaction<T>(operation: (transaction: this) => Promise<T>): Promise<T> {
    return operation(this);
  }
}

test("invite account initialization is idempotent and preserves user changes", async () => {
  const prisma = new FakePrisma();
  const store = new PrismaInviteAccountStore(prisma as unknown as PrismaClient);
  const config = {
    username: "parent.demo",
    password_hash: "initial-hash",
    identity: { actor_id: ACTOR_ID, display_name: "模拟家长" },
    memberships: [
      {
        tenant_id: "00000000-0000-4000-8000-000000000101",
        campus_ids: ["00000000-0000-4000-8000-000000000102"],
        status: "ACTIVE",
        capabilities: ["identity:read", "binding:apply"],
      },
    ],
  } as InviteAccountConfiguration;

  await store.initialize([config]);
  const row = prisma.accounts.get(ACTOR_ID);
  assert.ok(row);
  row.username = "parent.changed";
  row.normalizedUsername = "parent.changed";
  row.passwordHash = "updated-hash";
  row.displayName = "家长新名称";

  await store.initialize([config]);
  const account = await store.findByUsername("parent.changed");
  assert.equal(account?.actor_id, ACTOR_ID);
  assert.equal(account?.username, "parent.changed");
  assert.equal(account?.password_hash, "updated-hash");
  assert.equal(account?.display_name, "家长新名称");
  assert.equal(await store.findByUsername("parent.demo"), undefined);
});
