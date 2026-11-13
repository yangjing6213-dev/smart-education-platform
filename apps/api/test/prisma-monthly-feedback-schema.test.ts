import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("monthly class reports persist tenant/campus, membership provenance and one report per class/month", () => {
  const schema = readFileSync("apps/api/prisma/schema.prisma", "utf8");
  const model = schema.match(/model MonthlyFeedbackReport \{[\s\S]*?\n\}/u)?.[0];
  assert.ok(model, "The persistent monthly feedback model is missing");
  assert.match(model, /@@id\(\[tenantId, campusId, id\]\)/u);
  assert.match(
    model,
    /@@unique\(\[tenantId, campusId, classRef, month\], map: "monthly_feedback_reports_tenant_id_campus_id_class_ref_month_ke"\)/u,
  );
  assert.match(model, /sources\s+Json/u);
  assert.match(model, /sourceVersion\s+Int/u);
  assert.match(model, /references: \[tenantId, membershipId, campusId\]/u);
  assert.doesNotMatch(
    model,
    /parentAcknowledgedBy/u,
    "Parent acknowledgement needs a separate student-scoped contract",
  );
  const migration = readFileSync(
    "apps/api/prisma/migrations/202610250002_monthly_feedback_reports/migration.sql",
    "utf8",
  );
  assert.match(
    migration,
    /CREATE UNIQUE INDEX "monthly_feedback_reports_tenant_id_campus_id_class_ref_month_key" ON "monthly_feedback_reports"\("tenant_id", "campus_id", "class_ref", "month"\)/u,
  );
  assert.match(migration, /CHECK \("version" > 0 AND "source_version" > 0\)/u);
  assert.match(
    migration,
    /REFERENCES "membership_campuses"\("tenant_id", "membership_id", "campus_id"\)/u,
  );
  assert.match(
    migration,
    /CHECK \("status" NOT IN \('CONFIRMED', 'PUBLISHED'\) OR "reviewed_by_membership_id" IS NOT NULL\)/u,
  );
});
