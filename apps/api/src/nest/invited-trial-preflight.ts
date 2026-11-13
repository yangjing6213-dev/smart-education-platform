import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import type { PrismaClient } from "../generated/prisma/client.js";
import { parseInviteAccountsJson, type InviteAccountConfiguration } from "./invite-auth.service.js";

export function parseTrialAccounts(
  value: string | undefined,
): readonly InviteAccountConfiguration[] {
  const accounts = parseInviteAccountsJson(value);
  if (!accounts.length) throw new Error("Invited trial accounts are required.");
  return accounts;
}

interface AppliedMigration {
  migration_name: string;
  checksum: string;
  finished_at: Date | null;
}

export function assertTrialMigrationHistory(
  expected: ReadonlyMap<string, ReadonlySet<string>>,
  applied: readonly AppliedMigration[],
): void {
  const seen = new Set<string>();
  for (const row of applied) {
    if (
      !row.finished_at ||
      seen.has(row.migration_name) ||
      !expected.get(row.migration_name)?.has(row.checksum)
    ) {
      throw new Error("Invited trial migration history does not match this build.");
    }
    seen.add(row.migration_name);
  }
  if (!expected.size || seen.size !== expected.size) {
    throw new Error("Invited trial migrations are incomplete.");
  }
}

export async function verifyInvitedTrialDatabase(
  prisma: PrismaClient,
  accounts: readonly InviteAccountConfiguration[],
): Promise<void> {
  const directory = new URL("../../../prisma/migrations/", import.meta.url);
  const expected = new Map<string, Set<string>>();
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const sql = await readFile(
      new URL(encodeURIComponent(entry.name) + "/migration.sql", directory),
      "utf8",
    );
    if (!sql.trim()) throw new Error("Invited trial migration file is empty.");
    // Prisma accepts migrations checked out with either LF or CRLF line endings.
    const lf = sql.replaceAll("\r\n", "\n");
    const checksums = [sql, lf, lf.replaceAll("\n", "\r\n")].map((text) =>
      createHash("sha256").update(text).digest("hex"),
    );
    expected.set(entry.name, new Set(checksums));
  }
  await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      const rows = await tx.$queryRaw<AppliedMigration[]>`
      SELECT migration_name, checksum, finished_at FROM public._prisma_migrations WHERE rolled_back_at IS NULL
    `;
      assertTrialMigrationHistory(expected, rows);
      await tx.$queryRaw`SELECT token_hash, user_id, expires_at, created_at FROM public.invite_auth_sessions LIMIT 0`;
      await tx.$queryRaw`SELECT user_id, username, normalized_username, password_hash, display_name FROM public.invite_auth_accounts LIMIT 0`;
      await tx.$queryRaw`SELECT id, user_id, event_type, outcome, created_at FROM public.identity_security_events LIMIT 0`;
      await tx.$queryRaw`SELECT id, user_id, tenant_id, requested_display_name, status, version FROM public.user_profile_change_requests LIMIT 0`;
      const [rights] = await tx.$queryRaw<{ ready: boolean }[]>`
      SELECT NOT pg_is_in_recovery()
         AND current_setting('default_transaction_read_only') = 'off'
         AND has_table_privilege(current_user, 'public.invite_auth_sessions', 'INSERT')
         AND has_table_privilege(current_user, 'public.invite_auth_sessions', 'DELETE')
         AND has_table_privilege(current_user, 'public.invite_auth_accounts', 'SELECT')
         AND has_table_privilege(current_user, 'public.invite_auth_accounts', 'INSERT')
         AND has_table_privilege(current_user, 'public.invite_auth_accounts', 'UPDATE')
         AND has_table_privilege(current_user, 'public.identity_security_events', 'SELECT')
         AND has_table_privilege(current_user, 'public.identity_security_events', 'INSERT')
         AND has_table_privilege(current_user, 'public.user_profile_change_requests', 'SELECT')
         AND has_table_privilege(current_user, 'public.user_profile_change_requests', 'INSERT')
         AND has_table_privilege(current_user, 'public.user_profile_change_requests', 'UPDATE') AS ready
    `;
      const actorIds = accounts.map((account) => account.identity.actor_id);
      const users = await tx.user.findMany({
        where: { id: { in: actorIds } },
        select: { status: true },
      });
      if (
        !rights?.ready ||
        users.length !== actorIds.length ||
        !users.some((user) => user.status === "ACTIVE")
      ) {
        throw new Error("Invited trial accounts or session storage are unavailable.");
      }
    },
    { isolationLevel: "RepeatableRead", maxWait: 4000, timeout: 5000 },
  );
}
