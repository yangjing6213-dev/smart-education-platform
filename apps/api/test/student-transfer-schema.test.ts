import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const apiRoot = join(process.cwd(), "apps", "api");

test("student transfer storage preserves scoped requests and append-only audit events", () => {
  const schema = readFileSync(join(apiRoot, "prisma/schema.prisma"), "utf8");
  assert.ok(
    /model StudentTransferRequest\s*\{/u.test(schema),
    "transfer request model is required",
  );
  assert.ok(
    /model StudentTransferAuditEvent\s*\{/u.test(schema),
    "transfer audit model is required",
  );
  const migrationPath = join(
    apiRoot,
    "prisma/migrations/202610300002_student_transfer_workflow/migration.sql",
  );
  assert.equal(existsSync(migrationPath), true, "transfer migration is required");
  const migration = readFileSync(migrationPath, "utf8");
  assert.match(migration, /CREATE UNIQUE INDEX[\s\S]*WHERE[\s\S]*PENDING/u);
  assert.match(migration, /BEFORE UPDATE OR DELETE/u);
  assert.match(migration, /BEFORE TRUNCATE/u);
  assert.match(migration, /FOREIGN KEY \("tenant_id", "campus_id", "student_id"\)/u);
});
