import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { createInvitePasswordHash } from "../src/nest/invite-auth.service.js";
import {
  assertTrialMigrationHistory,
  parseTrialAccounts,
  verifyInvitedTrialDatabase,
} from "../src/nest/invited-trial-preflight.js";

test("trial mode refuses empty or invalid invitation configuration", () => {
  for (const value of [undefined, "", "   ", "[]", "{}", "[{}]", "private-broken-input"]) {
    assert.throws(() => parseTrialAccounts(value));
  }
});

test("compiled trial entry exits before serving and redacts invalid configuration", () => {
  const result = spawnSync(
    process.execPath,
    [fileURLToPath(new URL("../src/nest/api-main.js", import.meta.url)), "--invited-trial"],
    {
      env: {
        ...process.env,
        DATABASE_URL: "postgresql://invalid:placeholder@127.0.0.1:1/missing",
        STUDENT_CARE_API_HOST: "127.0.0.1",
        STUDENT_CARE_INVITE_ACCOUNTS_JSON: "private-placeholder-invalid-input",
      },
      timeout: 18000,
      encoding: "utf8",
    },
  );
  assert.equal(result.error, undefined);
  assert.equal(result.status, 1);
  assert.equal(result.stderr.trim(), "Invited trial API startup checks failed.");
  assert.equal(result.stdout, "");
});

test("trial migration ledger needs exactly one finished matching application per shipped migration", () => {
  const sql = "SELECT 1;\n";
  const checksum = createHash("sha256").update(sql).digest("hex");
  const expected = new Map([["001_init", new Set([checksum])]]);
  const applied = { migration_name: "001_init", checksum, finished_at: new Date() };
  assert.doesNotThrow(() => assertTrialMigrationHistory(expected, [applied]));
  for (const rows of [
    [],
    [applied, applied],
    [{ ...applied, finished_at: null }],
    [{ ...applied, checksum: "bad" }],
    [{ ...applied, migration_name: "other" }],
    [applied, { ...applied, migration_name: "future" }],
  ]) {
    assert.throws(() => assertTrialMigrationHistory(expected, rows));
  }
  assert.throws(() => assertTrialMigrationHistory(new Map(), []));
});

const fixtureUrl = process.env.INVITE_REVOCATION_TEST_DATABASE_URL;

test(
  "an active invite can start alongside a disabled one, but unknown or all-disabled accounts cannot",
  {
    skip: !fixtureUrl,
  },
  async () => {
    assert(fixtureUrl);
    assert.equal(new URL(fixtureUrl).hostname, "127.0.0.1");
    const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: fixtureUrl }) });
    const active = randomUUID(),
      disabled = randomUUID(),
      missing = randomUUID();
    const passwordHash = await createInvitePasswordHash(randomUUID());
    const accounts = (ids: string[]) =>
      ids.map((id) => ({
        username: id,
        password_hash: passwordHash,
        identity: { actor_id: id, display_name: "合成测试" },
        memberships: [],
      }));
    let created = false;
    try {
      await db.user.createMany({
        data: [
          { id: active, status: "ACTIVE" },
          { id: disabled, status: "DISABLED" },
        ],
      });
      created = true;
      await verifyInvitedTrialDatabase(db, accounts([active, disabled]));
      await assert.rejects(
        verifyInvitedTrialDatabase(db, accounts([disabled])),
        /accounts or session storage/,
      );
      await assert.rejects(
        verifyInvitedTrialDatabase(db, accounts([active, missing])),
        /accounts or session storage/,
      );
    } finally {
      try {
        if (created) await db.user.deleteMany({ where: { id: { in: [active, disabled] } } });
      } finally {
        await db.$disconnect();
      }
    }
  },
);
