import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

function sourcePath(relative: string): string {
  const candidates = [
    new URL(`../prisma/${relative}`, import.meta.url),
    new URL(`../../prisma/${relative}`, import.meta.url),
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) throw new Error(`Prisma source file not found: ${relative}`);
  return fileURLToPath(found);
}

test("parent learning session schema enforces campus, guardian, relationship and consent scope", () => {
  const schema = readFileSync(sourcePath("schema.prisma"), "utf8");
  const migration = readFileSync(
    sourcePath("migrations/202610240002_parent_learning_sessions/migration.sql"),
    "utf8",
  );
  const consent = schema.slice(
    schema.indexOf("model GuardianConsent {"),
    schema.indexOf("model ParentLearningSession {"),
  );
  const session = schema.slice(
    schema.indexOf("model ParentLearningSession {"),
    schema.indexOf("model ParentLearningSummarySnapshot {"),
  );
  assert.match(
    consent,
    /@@unique\(\[tenantId, campusId, id, guardianRelationshipId, studentId, guardianUserId\]/u,
  );
  assert.match(session, /@@map\("parent_learning_sessions"\)/u);
  assert.match(
    session,
    /fields: \[tenantId, campusId, guardianRelationshipId, studentId, guardianUserId\]/u,
  );
  assert.match(
    session,
    /fields: \[tenantId, campusId, consentId, guardianRelationshipId, studentId, guardianUserId\]/u,
  );
  assert.match(session, /highestHintLevel\s+Int/u);
  assert.match(session, /practiceOneCorrect\s+Boolean\?/u);
  assert.match(session, /practiceTwoCorrect\s+Boolean\?/u);
  assert.doesNotMatch(session, /freeText|image|attachment|deviceId/iu);
  assert.match(migration, /guardian_consents_session_scope_key/u);
  assert.match(migration, /REFERENCES "guardian_relationships"/u);
  assert.match(migration, /REFERENCES "guardian_consents"/u);
  assert.match(migration, /"duration_minutes" IN \(5, 10, 15\)/u);
  assert.match(migration, /"status" IN \('ACTIVE', 'COMPLETED', 'CLOSED', 'EXPIRED'\)/u);
});
