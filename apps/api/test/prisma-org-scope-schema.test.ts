import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const apiRoot = join(process.cwd(), "apps", "api");

test("PostgreSQL foundation keeps membership and campus references in one tenant", () => {
  const prismaConfig = readFileSync(join(apiRoot, "prisma7.config.ts"), "utf8");
  const schema = readFileSync(join(apiRoot, "prisma", "schema.prisma"), "utf8");
  const migration = readFileSync(
    join(apiRoot, "prisma", "migrations", "202610160001_org_scope_foundation", "migration.sql"),
    "utf8",
  );
  const studentMigration = readFileSync(
    join(apiRoot, "prisma", "migrations", "202610160002_student_scope_foundation", "migration.sql"),
    "utf8",
  );

  for (const model of ["Tenant", "Campus", "User", "Membership", "MembershipCampus"]) {
    assert.match(schema, new RegExp(`model ${model}\\s*\\{`));
  }

  const studentModel = schema.match(/model Student\s*\{[\s\S]*?\n\}/)?.[0];
  assert.ok(studentModel, "Student model exists");
  assert.match(studentModel, /^\s*id\s+String\s+@default\(uuid\(\)\)\s+@db\.Uuid$/m);
  assert.match(studentModel, /tenantId\s+String\s+@map\("tenant_id"\)/);
  assert.match(studentModel, /campusId\s+String\s+@map\("campus_id"\)/);
  assert.match(studentModel, /classRef\s+String\s+@map\("class_ref"\)/);
  assert.match(studentModel, /status\s+String/);
  assert.match(studentModel, /displayRef\s+String\s+@map\("display_ref"\)/);
  assert.match(studentModel, /@@id\(\[tenantId, campusId, id\]\)/);
  assert.match(
    studentModel,
    /campus\s+Campus\s+@relation\(fields: \[tenantId, campusId\], references: \[tenantId, id\], onDelete: Restrict/,
  );
  assert.doesNotMatch(studentModel, /\b(name|phone|address|birthDate|photo)\b/i);
  assert.match(
    studentMigration,
    /CREATE TABLE "students"[\s\S]*?CONSTRAINT "students_pkey" PRIMARY KEY \("tenant_id",\s*"campus_id",\s*"id"\)/,
  );
  assert.match(
    studentMigration,
    /ALTER TABLE "students" ADD CONSTRAINT "students_tenant_id_campus_id_fkey" FOREIGN KEY \("tenant_id",\s*"campus_id"\) REFERENCES "campuses"\("tenant_id",\s*"id"\) ON DELETE RESTRICT ON UPDATE CASCADE;/,
  );
  assert.match(
    prismaConfig,
    /url:\s*process\.env\.DATABASE_URL\s*\?\?\s*"postgresql:\/\/127\.0\.0\.1:9\/schema-validation"/,
  );
  assert.doesNotMatch(prismaConfig, /127\.0\.0\.1:5432/);
  assert.match(
    schema,
    /enum MembershipStatus[\s\S]*ACTIVE[\s\S]*SUSPENDED[\s\S]*REVOKED[\s\S]*INVITED/,
  );
  assert.equal([...schema.matchAll(/@@id\(\[tenantId, id\]\)/g)].length, 2);
  assert.match(schema, /@@index\(\[tenantId, userId\]\)/);
  assert.match(schema, /@@id\(\[tenantId, membershipId, campusId\]\)/);
  assert.match(
    migration,
    /FOREIGN KEY \("tenant_id",\s*"campus_id"\) REFERENCES "campuses"\("tenant_id",\s*"id"\)/,
  );
  assert.match(
    migration,
    /FOREIGN KEY \("tenant_id",\s*"membership_id"\) REFERENCES "memberships"\("tenant_id",\s*"id"\)/,
  );
  assert.doesNotMatch(migration, /ON DELETE CASCADE/i);
  assert.doesNotMatch(migration, /CREATE TABLE "students"/i);

  const careRecordModel = schema.match(/model CareRecord\s*\{[\s\S]*?\n\}/)?.[0];
  assert.ok(careRecordModel, "CareRecord model exists");
  assert.match(careRecordModel, /tenantId\s+String\s+@map\("tenant_id"\)/);
  assert.match(careRecordModel, /campusId\s+String\s+@map\("campus_id"\)/);
  assert.match(careRecordModel, /studentId\s+String\s+@map\("student_id"\)/);
  assert.match(careRecordModel, /classRef\s+String\s+@map\("class_ref"\)/);
  assert.match(careRecordModel, /serviceDate\s+DateTime\s+@map\("service_date"\)\s+@db\.Date/);
  for (const field of ["arrival", "homework", "meal", "rest", "activity", "wellbeing"]) {
    assert.match(careRecordModel, new RegExp(`^\\s*${field}\\s+Care[A-Z]`, "m"));
  }
  assert.match(careRecordModel, /status\s+CareRecordStatus/);
  assert.match(careRecordModel, /version\s+Int\s+@default\(1\)/);
  assert.match(careRecordModel, /published\s+Boolean\s+@default\(false\)/);
  assert.match(careRecordModel, /publicationVersion\s+Int\s+@default\(0\)/);
  assert.match(careRecordModel, /@@id\(\[tenantId, campusId, id\]\)/);
  assert.match(careRecordModel, /student\s+Student\s+@relation\("CareRecordStudent"/);
  assert.match(careRecordModel, /createdBy\s+MembershipCampus\s+@relation\("CareRecordCreator"/);
  assert.match(
    careRecordModel,
    /reviewedBy\s+MembershipCampus\?\s+@relation\("CareRecordReviewer"/,
  );
  assert.match(careRecordModel, /updatedBy\s+MembershipCampus\s+@relation\("CareRecordUpdater"/);
  assert.match(careRecordModel, /revisions\s+CareRecordRevision\[\]/);
  assert.doesNotMatch(careRecordModel, /\b(name|phone|address|birthDate|photo|note|diagnosis)\b/i);

  const careRevisionModel = schema.match(/model CareRecordRevision\s*\{[\s\S]*?\n\}/)?.[0];
  assert.ok(careRevisionModel, "CareRecordRevision model exists");
  assert.match(careRevisionModel, /@@id\(\[tenantId, campusId, careRecordId, version\]\)/);
  assert.match(careRevisionModel, /careRecord\s+CareRecord\s+@relation\("CareRecordRevisions"/);
  assert.match(
    careRevisionModel,
    /updatedBy\s+MembershipCampus\s+@relation\("CareRevisionUpdater"/,
  );
  assert.match(
    careRevisionModel,
    /reviewedBy\s+MembershipCampus\?\s+@relation\("CareRevisionReviewer"/,
  );

  for (const [name, values] of Object.entries({
    CareRecordStatus: [
      "DRAFT",
      "SUBMITTED",
      "RETURNED",
      "CONFIRMED",
      "CANCELLED",
      "EXCEPTION_PENDING",
    ],
    CareArrival: ["ARRIVED_AS_PLANNED", "LATE", "ABSENT"],
    CareHomework: ["COMPLETED", "IN_PROGRESS", "NEEDS_SUPPORT"],
    CareMeal: ["FINISHED", "PARTIAL", "NOT_RECORDED"],
    CareRest: ["RESTED", "QUIET_ACTIVITY", "NOT_RECORDED"],
    CareActivity: ["PARTICIPATED", "OBSERVED", "NOT_RECORDED"],
    CareWellbeing: ["ROUTINE", "CHECK_IN", "FOLLOW_UP"],
  })) {
    const enumBlock = schema.match(new RegExp(`enum ${name}\\s*\\{[\\s\\S]*?\\n\\}`))?.[0];
    assert.ok(enumBlock, `${name} enum exists`);
    for (const value of values) assert.match(enumBlock, new RegExp(`^\\s*${value}\\s*$`, "m"));
  }

  const careMigration = readFileSync(
    join(apiRoot, "prisma", "migrations", "202610160003_care_record_scope", "migration.sql"),
    "utf8",
  );
  assert.match(
    careMigration,
    /CREATE TABLE "care_records"[\s\S]*?PRIMARY KEY \("tenant_id",\s*"campus_id",\s*"id"\)/,
  );
  assert.match(
    careMigration,
    /CREATE TABLE "care_record_revisions"[\s\S]*?PRIMARY KEY \("tenant_id",\s*"campus_id",\s*"care_record_id",\s*"version"\)/,
  );
  assert.match(
    careMigration,
    /CREATE UNIQUE INDEX "care_records_active_student_date_key" ON "care_records"\("tenant_id",\s*"campus_id",\s*"student_id",\s*"service_date"\) WHERE "status" <> 'CANCELLED';/,
  );
  assert.match(
    careMigration,
    /FOREIGN KEY \("tenant_id",\s*"campus_id",\s*"student_id"\) REFERENCES "students"\("tenant_id",\s*"campus_id",\s*"id"\)/,
  );
  for (const actorField of [
    "created_by_membership_id",
    "reviewed_by_membership_id",
    "updated_by_membership_id",
  ]) {
    assert.match(
      careMigration,
      new RegExp(
        `FOREIGN KEY \\("tenant_id",\\s*"${actorField}",\\s*"campus_id"\\) REFERENCES "membership_campuses"\\("tenant_id",\\s*"membership_id",\\s*"campus_id"\\)`,
      ),
    );
  }
  assert.match(
    careMigration,
    /FOREIGN KEY \("tenant_id",\s*"campus_id",\s*"care_record_id"\) REFERENCES "care_records"\("tenant_id",\s*"campus_id",\s*"id"\)/,
  );
  assert.match(
    careMigration,
    /FOREIGN KEY \("tenant_id",\s*"updated_by_membership_id",\s*"campus_id"\) REFERENCES "membership_campuses"\("tenant_id",\s*"membership_id",\s*"campus_id"\)/,
  );
  assert.doesNotMatch(careMigration, /ON DELETE CASCADE/i);
});

test("attendance records keep student, actor, date, and revision scope together", () => {
  const schema = readFileSync(join(apiRoot, "prisma", "schema.prisma"), "utf8");
  const attendanceModel = schema.match(/model AttendanceRecord\s*\{[\s\S]*?\n\}/)?.[0];
  assert.ok(attendanceModel, "AttendanceRecord model exists");
  assert.match(attendanceModel, /tenantId\s+String\s+@map\("tenant_id"\)/);
  assert.match(attendanceModel, /campusId\s+String\s+@map\("campus_id"\)/);
  assert.match(attendanceModel, /studentId\s+String\s+@map\("student_id"\)/);
  assert.match(attendanceModel, /classRef\s+String\s+@map\("class_ref"\)/);
  assert.match(attendanceModel, /serviceDate\s+DateTime\s+@map\("service_date"\)\s+@db\.Date/);
  assert.match(attendanceModel, /status\s+AttendanceStatus/);
  assert.match(
    attendanceModel,
    /arrivalTime\s+String\?\s+@map\("arrival_time"\)\s+@db\.VarChar\(5\)/,
  );
  assert.match(
    attendanceModel,
    /departureTime\s+String\?\s+@map\("departure_time"\)\s+@db\.VarChar\(5\)/,
  );
  assert.match(attendanceModel, /corrected\s+Boolean\s+@default\(false\)/);
  assert.match(
    attendanceModel,
    /recordedByMembershipId\s+String\s+@map\("recorded_by_membership_id"\)/,
  );
  assert.match(attendanceModel, /version\s+Int\s+@default\(1\)/);
  assert.match(attendanceModel, /@@unique\(\[tenantId, campusId, studentId, serviceDate\]\)/);
  assert.match(attendanceModel, /student\s+Student\s+@relation\("AttendanceStudent"/);
  assert.match(attendanceModel, /recordedBy\s+MembershipCampus\s+@relation\("AttendanceRecorder"/);
  assert.match(attendanceModel, /updatedBy\s+MembershipCampus\s+@relation\("AttendanceUpdater"/);
  assert.doesNotMatch(
    attendanceModel,
    /\b(name|phone|address|birthDate|photo|note|location|device)\b/i,
  );

  const attendanceRevision = schema.match(/model AttendanceRecordRevision\s*\{[\s\S]*?\n\}/)?.[0];
  assert.ok(attendanceRevision, "AttendanceRecordRevision model exists");
  assert.match(attendanceRevision, /@@id\(\[tenantId, campusId, attendanceRecordId, version\]\)/);
  assert.match(
    attendanceRevision,
    /attendanceRecord\s+AttendanceRecord\s+@relation\("AttendanceRecordRevisions"/,
  );
  assert.match(attendanceRevision, /status\s+AttendanceStatus/);
  assert.match(attendanceRevision, /arrivalTime\s+String\?/);
  assert.match(attendanceRevision, /departureTime\s+String\?/);
  assert.match(attendanceRevision, /corrected\s+Boolean/);
  assert.match(
    attendanceRevision,
    /updatedBy\s+MembershipCampus\s+@relation\("AttendanceRevisionUpdater"/,
  );

  const attendanceEnum = schema.match(/enum AttendanceStatus\s*\{[\s\S]*?\n\}/)?.[0];
  assert.ok(attendanceEnum, "AttendanceStatus enum exists");
  for (const status of ["NOT_ARRIVED", "ARRIVED", "DEPARTED"]) {
    assert.match(attendanceEnum, new RegExp(`^\\s*${status}\\s*$`, "m"));
  }

  const migration = readFileSync(
    join(apiRoot, "prisma", "migrations", "202610160004_attendance_scope", "migration.sql"),
    "utf8",
  );
  assert.match(
    migration,
    /CREATE TABLE "attendance_records"[\s\S]*?PRIMARY KEY \("tenant_id",\s*"campus_id",\s*"id"\)/,
  );
  assert.match(
    migration,
    /CREATE UNIQUE INDEX "attendance_records_[^"]+" ON "attendance_records"\("tenant_id",\s*"campus_id",\s*"student_id",\s*"service_date"\);/,
  );
  assert.match(migration, /arrival_time_hhmm_check/);
  assert.match(migration, /departure_time_hhmm_check/);
  for (const table of ["attendance_records", "attendance_record_revisions"]) {
    for (const field of ["arrival_time", "departure_time"]) {
      assert.ok(
        migration.includes(
          `CHECK ("${field}" IS NULL OR "${field}" ~ '^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$')`,
        ),
        `${table}.${field} stores a valid 24-hour HH:mm value`,
      );
    }
  }
  assert.match(
    migration,
    /FOREIGN KEY \("tenant_id",\s*"campus_id",\s*"student_id"\) REFERENCES "students"\("tenant_id",\s*"campus_id",\s*"id"\)/,
  );
  for (const actorField of ["recorded_by_membership_id", "updated_by_membership_id"]) {
    assert.match(
      migration,
      new RegExp(
        `FOREIGN KEY \\("tenant_id",\\s*"${actorField}",\\s*"campus_id"\\) REFERENCES "membership_campuses"\\("tenant_id",\\s*"membership_id",\\s*"campus_id"\\)`,
      ),
    );
  }
  assert.match(
    migration,
    /FOREIGN KEY \("tenant_id",\s*"campus_id",\s*"attendance_record_id"\) REFERENCES "attendance_records"\("tenant_id",\s*"campus_id",\s*"id"\)/,
  );
  assert.match(
    migration,
    /FOREIGN KEY \("tenant_id",\s*"updated_by_membership_id",\s*"campus_id"\) REFERENCES "membership_campuses"\("tenant_id",\s*"membership_id",\s*"campus_id"\)/,
  );
  assert.doesNotMatch(migration, /ON DELETE CASCADE/i);
});

test("leave requests keep requester, student, and guardian relationship within one scope", () => {
  const schema = readFileSync(join(apiRoot, "prisma", "schema.prisma"), "utf8");
  const leaveRequest = schema.match(/model LeaveRequest\s*\{[\s\S]*?\n\}/)?.[0];
  assert.ok(leaveRequest, "LeaveRequest model exists");
  assert.match(leaveRequest, /tenantId\s+String\s+@map\("tenant_id"\)/);
  assert.match(leaveRequest, /campusId\s+String\s+@map\("campus_id"\)/);
  assert.match(leaveRequest, /studentId\s+String\s+@map\("student_id"\)/);
  assert.match(
    leaveRequest,
    /guardianRelationshipId\s+String\s+@map\("guardian_relationship_id"\)/,
  );
  assert.match(leaveRequest, /requesterUserId\s+String\s+@map\("requester_user_id"\)/);
  assert.match(leaveRequest, /startDate\s+DateTime\s+@map\("start_date"\)\s+@db\.Date/);
  assert.match(leaveRequest, /endDate\s+DateTime\s+@map\("end_date"\)\s+@db\.Date/);
  assert.match(leaveRequest, /reasonCategory\s+LeaveReasonCategory\s+@map\("reason_category"\)/);
  assert.match(leaveRequest, /status\s+LeaveRequestStatus/);
  assert.match(leaveRequest, /version\s+Int\s+@default\(1\)/);
  assert.match(leaveRequest, /acknowledged\s+Boolean\s+@default\(false\)/);
  assert.match(
    leaveRequest,
    /guardianRelationship\s+GuardianRelationship\s+@relation\("LeaveRequestRelationship",\s*fields:\s*\[tenantId,\s*campusId,\s*guardianRelationshipId,\s*studentId,\s*requesterUserId\],\s*references:\s*\[tenantId,\s*campusId,\s*id,\s*studentId,\s*guardianUserId\]/,
  );
  assert.match(leaveRequest, /student\s+Student\s+@relation\("LeaveRequestStudent"/);
  assert.match(leaveRequest, /requester\s+User\s+@relation\("LeaveRequestRequester"/);
  assert.match(leaveRequest, /updatedBy\s+MembershipCampus\s+@relation\("LeaveRequestUpdater"/);
  assert.match(leaveRequest, /revisions\s+LeaveRequestRevision\[\]/);
  assert.doesNotMatch(leaveRequest, /\b(reason|studentName|phone|address|nationalId)\s+String\b/i);

  for (const [name, values] of Object.entries({
    LeaveReasonCategory: ["FAMILY_ARRANGEMENT", "TEMPORARY_MATTER"],
    LeaveRequestStatus: ["SUBMITTED", "RETURNED", "CONFIRMED", "WITHDRAWN"],
  })) {
    const block = schema.match(new RegExp(`enum ${name}\\s*\\{[\\s\\S]*?\\n\\}`))?.[0];
    assert.ok(block, `${name} enum exists`);
    const actualValues = [...block.matchAll(/^\s+([A-Z][A-Z0-9_]*)\s*$/gm)].map(
      ([, value]) => value,
    );
    assert.deepEqual(actualValues, values, `${name} has only the current service values`);
  }

  const guardianRelationship = schema.match(/model GuardianRelationship\s*\{[\s\S]*?\n\}/)?.[0];
  assert.ok(guardianRelationship, "GuardianRelationship model exists");
  assert.match(
    guardianRelationship,
    /@@unique\(\[tenantId, campusId, id, studentId, guardianUserId\]\)/,
  );

  const migration = readFileSync(
    join(apiRoot, "prisma", "migrations", "202610170001_leave_request_scope", "migration.sql"),
    "utf8",
  );
  assert.match(
    migration,
    /FOREIGN KEY \("tenant_id",\s*"campus_id",\s*"guardian_relationship_id",\s*"student_id",\s*"requester_user_id"\)\s+REFERENCES "guardian_relationships"\("tenant_id",\s*"campus_id",\s*"id",\s*"student_id",\s*"guardian_user_id"\)/,
  );
  assert.match(migration, /leave_requests_start_before_end_check/);
  assert.match(migration, /leave_requests_version_positive_check/);
  assert.match(migration, /leave_requests_acknowledgement_state_check/);
  assert.match(migration, /leave_request_revisions_start_before_end_check/);
  assert.match(migration, /leave_request_revisions_version_positive_check/);
  assert.match(migration, /leave_request_revisions_acknowledgement_state_check/);
  assert.doesNotMatch(migration, /EXCLUDE\s+USING/i);
  assert.doesNotMatch(migration, /ON DELETE CASCADE/i);
});

test("leave request revisions preserve only fixed fields and scoped actors", () => {
  const schema = readFileSync(join(apiRoot, "prisma", "schema.prisma"), "utf8");
  const revision = schema.match(/model LeaveRequestRevision\s*\{[\s\S]*?\n\}/)?.[0];
  assert.ok(revision, "LeaveRequestRevision model exists");
  assert.match(revision, /tenantId\s+String\s+@map\("tenant_id"\)/);
  assert.match(revision, /campusId\s+String\s+@map\("campus_id"\)/);
  assert.match(revision, /leaveRequestId\s+String\s+@map\("leave_request_id"\)/);
  assert.match(revision, /version\s+Int/);
  assert.match(revision, /startDate\s+DateTime\s+@map\("start_date"\)\s+@db\.Date/);
  assert.match(revision, /endDate\s+DateTime\s+@map\("end_date"\)\s+@db\.Date/);
  assert.match(revision, /reasonCategory\s+LeaveReasonCategory\s+@map\("reason_category"\)/);
  assert.match(revision, /status\s+LeaveRequestStatus/);
  assert.match(revision, /acknowledged\s+Boolean/);
  assert.match(
    revision,
    /leaveRequest\s+LeaveRequest\s+@relation\("LeaveRequestRevisions",\s*fields:\s*\[tenantId,\s*campusId,\s*leaveRequestId\],\s*references:\s*\[tenantId,\s*campusId,\s*id\]/,
  );
  assert.match(revision, /updatedBy\s+MembershipCampus\s+@relation\("LeaveRequestRevisionUpdater"/);
  assert.match(revision, /@@id\(\[tenantId, campusId, leaveRequestId, version\]\)/);
  assert.doesNotMatch(revision, /\b(summary|freeText|studentName|phone|address)\b/i);

  const migration = readFileSync(
    join(apiRoot, "prisma", "migrations", "202610170001_leave_request_scope", "migration.sql"),
    "utf8",
  );
  assert.match(
    migration,
    /CREATE TABLE "leave_requests"[\s\S]*?PRIMARY KEY \("tenant_id",\s*"campus_id",\s*"id"\)/,
  );
  assert.match(
    migration,
    /CREATE TABLE "leave_request_revisions"[\s\S]*?PRIMARY KEY \("tenant_id",\s*"campus_id",\s*"leave_request_id",\s*"version"\)/,
  );
  assert.match(
    migration,
    /FOREIGN KEY \("tenant_id",\s*"campus_id",\s*"leave_request_id"\)\s+REFERENCES "leave_requests"\("tenant_id",\s*"campus_id",\s*"id"\)/,
  );
  assert.match(
    migration,
    /FOREIGN KEY \("tenant_id",\s*"updated_by_membership_id",\s*"campus_id"\)\s+REFERENCES "membership_campuses"\("tenant_id",\s*"membership_id",\s*"campus_id"\)/,
  );
  assert.doesNotMatch(migration, /ON DELETE CASCADE/i);
});

test("meal plans keep ordered menu items and publication scope within one campus", () => {
  const schema = readFileSync(join(apiRoot, "prisma", "schema.prisma"), "utf8");
  const mealPlan = schema.match(/model MealPlan\s*\{[\s\S]*?\n\}/)?.[0];
  assert.ok(mealPlan, "MealPlan model exists");
  assert.match(mealPlan, /tenantId\s+String\s+@map\("tenant_id"\)/);
  assert.match(mealPlan, /campusId\s+String\s+@map\("campus_id"\)/);
  assert.match(mealPlan, /serviceDate\s+DateTime\s+@map\("service_date"\)\s+@db\.Date/);
  assert.match(mealPlan, /mealPeriod\s+MealPeriod\s+@map\("meal_period"\)/);
  assert.match(mealPlan, /publishStatus\s+MealPlanStatus\s+@map\("publish_status"\)/);
  assert.match(mealPlan, /notes\s+String\s+@db\.VarChar\(500\)/);
  assert.match(mealPlan, /version\s+Int\s+@default\(1\)/);
  assert.match(mealPlan, /publishedAt\s+DateTime\?\s+@map\("published_at"\)/);
  assert.match(mealPlan, /updatedByMembershipId\s+String\s+@map\("updated_by_membership_id"\)/);
  assert.match(mealPlan, /@@id\(\[tenantId, campusId, id\]\)/);
  assert.match(mealPlan, /@@index\(\[tenantId, campusId, serviceDate, mealPeriod\]\)/);
  assert.doesNotMatch(mealPlan, /@@unique\(\[tenantId, campusId, serviceDate, mealPeriod\]\)/);
  assert.match(mealPlan, /campus\s+Campus\s+@relation\("MealPlanCampus"/);
  assert.match(mealPlan, /updatedBy\s+MembershipCampus\s+@relation\("MealPlanUpdater"/);
  assert.match(mealPlan, /items\s+MealPlanItem\[\]/);
  assert.doesNotMatch(mealPlan, /\b(privateNotes|mediaRef|allergy|studentId|phone|address)\b/i);

  const mealItem = schema.match(/model MealPlanItem\s*\{[\s\S]*?\n\}/)?.[0];
  assert.ok(mealItem, "MealPlanItem model exists");
  assert.match(mealItem, /tenantId\s+String\s+@map\("tenant_id"\)/);
  assert.match(mealItem, /campusId\s+String\s+@map\("campus_id"\)/);
  assert.match(mealItem, /mealPlanId\s+String\s+@map\("meal_plan_id"\)/);
  assert.match(mealItem, /position\s+Int/);
  assert.match(mealItem, /itemName\s+String\s+@map\("item_name"\)\s+@db\.VarChar\(120\)/);
  assert.match(mealItem, /@@id\(\[tenantId, campusId, mealPlanId, position\]\)/);
  assert.match(mealItem, /mealPlan\s+MealPlan\s+@relation\("MealPlanItems"/);

  for (const [name, values] of Object.entries({
    MealPeriod: ["BREAKFAST", "LUNCH", "SNACK", "DINNER"],
    MealPlanStatus: ["DRAFT", "PUBLISHED", "UNPUBLISHED"],
  })) {
    const enumBlock = schema.match(new RegExp(`enum ${name}\\s*\\{[\\s\\S]*?\\n\\}`))?.[0];
    assert.ok(enumBlock, `${name} enum exists`);
    for (const value of values) assert.match(enumBlock, new RegExp(`^\\s*${value}\\s*$`, "m"));
  }

  const migration = readFileSync(
    join(apiRoot, "prisma", "migrations", "202610160005_meal_plan_scope", "migration.sql"),
    "utf8",
  );
  assert.match(
    migration,
    /CREATE TABLE "meal_plans"[\s\S]*?PRIMARY KEY \("tenant_id","campus_id","id"\)/,
  );
  assert.match(
    migration,
    /CREATE TABLE "meal_plan_items"[\s\S]*?PRIMARY KEY \("tenant_id","campus_id","meal_plan_id","position"\)/,
  );
  assert.match(
    migration,
    /CREATE INDEX "meal_plans_tenant_id_campus_id_service_date_meal_period_idx"/,
  );
  assert.match(migration, /CHECK \("position" >= 0 AND "position" < 12\)/);
  assert.match(migration, /CHECK \(char_length\("item_name"\) >= 1\)/);
  assert.match(
    migration,
    /FOREIGN KEY \("tenant_id",\s*"campus_id"\) REFERENCES "campuses"\("tenant_id",\s*"id"\)/,
  );
  assert.match(
    migration,
    /FOREIGN KEY \("tenant_id",\s*"campus_id",\s*"meal_plan_id"\) REFERENCES "meal_plans"\("tenant_id",\s*"campus_id",\s*"id"\)/,
  );
  assert.match(
    migration,
    /FOREIGN KEY \("tenant_id",\s*"updated_by_membership_id",\s*"campus_id"\) REFERENCES "membership_campuses"\("tenant_id",\s*"membership_id",\s*"campus_id"\)/,
  );
  assert.doesNotMatch(migration, /UNIQUE[^;]*service_date[^;]*meal_period/i);
  assert.doesNotMatch(migration, /ON DELETE CASCADE/i);
});

test("binding applications keep onboarding references single-use and non-identifying", () => {
  const schema = readFileSync(join(apiRoot, "prisma", "schema.prisma"), "utf8");
  const application = schema.match(/model BindingApplication\s*\{[\s\S]*?\n\}/)?.[0];
  assert.ok(application, "BindingApplication model exists");
  assert.match(application, /tenantId\s+String\s+@map\("tenant_id"\)/);
  assert.match(application, /campusId\s+String\s+@map\("campus_id"\)/);
  assert.match(application, /applicantUserId\s+String\s+@map\("applicant_user_id"\)/);
  assert.match(
    application,
    /onboardingScopeRef\s+String\s+@map\("onboarding_scope_ref"\)\s+@db\.Uuid/,
  );
  assert.match(
    application,
    /studentCandidateRef\s+String\s+@map\("student_candidate_ref"\)\s+@db\.Uuid/,
  );
  assert.match(
    application,
    /reasonCategory\s+String\?\s+@map\("reason_category"\)\s+@db\.VarChar\(80\)/,
  );
  assert.match(application, /status\s+BindingApplicationStatus\s+@default\(PENDING\)/);
  assert.match(application, /reviewedByMembershipId\s+String\?/);
  assert.match(
    application,
    /reviewedBy\s+MembershipCampus\?\s+@relation\("BindingApplicationReviewer"/,
  );
  assert.match(application, /@@id\(\[tenantId, campusId, id\]\)/);
  assert.match(application, /@@unique\(\[tenantId, campusId, onboardingScopeRef\]\)/);
  assert.match(application, /@@unique\(\[tenantId, campusId, id, applicantUserId\]\)/);
  assert.match(application, /applicant\s+User\s+@relation\("BindingApplicationApplicant"/);
  assert.doesNotMatch(
    application,
    /\b(studentId|studentName|phone|address|nationalId|password)\b/i,
  );

  const status = schema.match(/enum BindingApplicationStatus\s*\{[\s\S]*?\n\}/)?.[0];
  assert.ok(status, "BindingApplicationStatus enum exists");
  for (const value of ["PENDING", "APPROVED", "REJECTED", "WITHDRAWN", "EXPIRED"])
    assert.match(status, new RegExp(`^\\s*${value}\\s*$`, "m"));
});

test("guardian relationships bind the approved source and limit active duplicates to one", () => {
  const schema = readFileSync(join(apiRoot, "prisma", "schema.prisma"), "utf8");
  const relationship = schema.match(/model GuardianRelationship\s*\{[\s\S]*?\n\}/)?.[0];
  assert.ok(relationship, "GuardianRelationship model exists");
  assert.match(relationship, /tenantId\s+String\s+@map\("tenant_id"\)/);
  assert.match(relationship, /campusId\s+String\s+@map\("campus_id"\)/);
  assert.match(relationship, /bindingApplicationId\s+String\s+@map\("binding_application_id"\)/);
  assert.match(relationship, /guardianUserId\s+String\s+@map\("guardian_user_id"\)/);
  assert.match(relationship, /studentId\s+String\s+@map\("student_id"\)/);
  assert.match(relationship, /status\s+GuardianRelationshipStatus/);
  assert.match(
    relationship,
    /approvedByMembershipId\s+String\s+@map\("approved_by_membership_id"\)/,
  );
  assert.match(relationship, /approvedAt\s+DateTime\s+@map\("approved_at"\)/);
  assert.match(relationship, /releasedAt\s+DateTime\?\s+@map\("released_at"\)/);
  assert.match(
    relationship,
    /sourceApplication\s+BindingApplication\s+@relation\("BindingApplicationRelationship",\s*fields:\s*\[tenantId,\s*campusId,\s*bindingApplicationId,\s*guardianUserId\],\s*references:\s*\[tenantId,\s*campusId,\s*id,\s*applicantUserId\]/,
  );
  assert.match(relationship, /student\s+Student\s+@relation\("GuardianRelationshipStudent"/);
  assert.match(
    relationship,
    /approvedBy\s+MembershipCampus\s+@relation\("GuardianRelationshipApprover"/,
  );
  assert.match(relationship, /@@unique\(\[tenantId, campusId, bindingApplicationId\]\)/);
  assert.doesNotMatch(
    relationship,
    /@@unique\(\[tenantId, campusId, guardianUserId, studentId\]\)/,
  );

  const status = schema.match(/enum GuardianRelationshipStatus\s*\{[\s\S]*?\n\}/)?.[0];
  assert.ok(status, "GuardianRelationshipStatus enum exists");
  for (const value of ["ACTIVE", "RELEASED"])
    assert.match(status, new RegExp(`^\\s*${value}\\s*$`, "m"));

  const migration = readFileSync(
    join(apiRoot, "prisma", "migrations", "202610160006_guardian_binding_scope", "migration.sql"),
    "utf8",
  );
  assert.match(
    migration,
    /CREATE UNIQUE INDEX "binding_applications_tenant_id_campus_id_onboarding_scope_r_key"/,
  );
  assert.match(
    migration,
    /CREATE UNIQUE INDEX "binding_applications_[^"]+" ON "binding_applications"\("tenant_id", "campus_id", "id", "applicant_user_id"\)/,
  );
  assert.match(
    migration,
    /guardian_relationships_active_guardian_student_unique_idx[\s\S]*?WHERE "status" = 'ACTIVE'/,
  );
  assert.match(migration, /binding_applications_review_state_check/);
  assert.match(
    migration,
    /binding_applications_review_state_check[\s\S]*?"status" IN \('APPROVED', 'REJECTED'\)[\s\S]*?"reviewed_at" IS NOT NULL[\s\S]*?"reviewed_by_membership_id" IS NOT NULL[\s\S]*?"reviewed_at" IS NULL[\s\S]*?"reviewed_by_membership_id" IS NULL/,
  );
  assert.match(migration, /guardian_relationships_release_state_check/);
  assert.match(
    migration,
    /FOREIGN KEY \("tenant_id",\s*"campus_id",\s*"student_id"\) REFERENCES "students"\("tenant_id",\s*"campus_id",\s*"id"\)/,
  );
  assert.match(
    migration,
    /FOREIGN KEY \("tenant_id",\s*"campus_id",\s*"binding_application_id",\s*"guardian_user_id"\) REFERENCES "binding_applications"\("tenant_id",\s*"campus_id",\s*"id",\s*"applicant_user_id"\)/,
  );
  assert.match(
    migration,
    /FOREIGN KEY \("tenant_id",\s*"approved_by_membership_id",\s*"campus_id"\) REFERENCES "membership_campuses"\("tenant_id",\s*"membership_id",\s*"campus_id"\)/,
  );
  assert.doesNotMatch(migration, /ON DELETE CASCADE/i);
});

test("pickup authorizations and records keep synthetic references within one scope", () => {
  const schema = readFileSync(join(apiRoot, "prisma", "schema.prisma"), "utf8");
  const authorization = schema.match(/model PickupAuthorization\s*\{[\s\S]*?\n\}/)?.[0];
  assert.ok(authorization, "PickupAuthorization model exists");
  const record = schema.match(/model PickupRecord\s*\{[\s\S]*?\n\}/)?.[0];
  assert.ok(record, "PickupRecord model exists");

  for (const [name, values] of Object.entries({
    PickupRecipient: ["PICKUP_ALPHA", "PICKUP_BETA"],
    PickupAuthorizationType: ["REGULAR", "TEMPORARY"],
    PickupAuthorizationStatus: ["DRAFT", "ACTIVE", "REVOKED"],
    PickupRecordStatus: ["COMPLETED"],
  })) {
    const enumBlock = schema.match(new RegExp(`enum ${name}\\s*\\{[\\s\\S]*?\\n\\}`))?.[0];
    assert.ok(enumBlock, `${name} enum exists`);
    for (const value of values) assert.match(enumBlock, new RegExp(`^\\s*${value}\\b`, "m"));
  }

  for (const field of [
    "tenantId",
    "campusId",
    "studentId",
    "guardianRelationshipId",
    "guardianUserId",
    "authorizedPartyRef",
    "startDate",
    "endDate",
    "startTime",
    "endTime",
    "version",
    "status",
    "createdByMembershipId",
    "updatedByMembershipId",
  ]) {
    assert.match(authorization, new RegExp(`^\\s*${field}\\s+`, "m"));
  }
  assert.match(
    authorization,
    /guardianRelationship\s+GuardianRelationship\s+@relation\("PickupAuthorizationRelationship"/,
  );
  assert.match(authorization, /student\s+Student\s+@relation\("PickupAuthorizationStudent"/);
  assert.match(
    authorization,
    /createdBy\s+MembershipCampus\s+@relation\("PickupAuthorizationCreator"/,
  );
  assert.match(
    authorization,
    /updatedBy\s+MembershipCampus\s+@relation\("PickupAuthorizationUpdater"/,
  );
  assert.match(
    authorization,
    /@@unique\(\[tenantId, campusId, id, studentId, guardianRelationshipId, guardianUserId\]\)/,
  );
  assert.doesNotMatch(authorization, /\b(name|phone|address|birthDate|photo|deviceLabel|note)\b/i);

  for (const field of [
    "tenantId",
    "campusId",
    "studentId",
    "authorizationId",
    "authorizationVersion",
    "guardianRelationshipId",
    "guardianUserId",
    "attendanceRecordId",
    "attendanceVersion",
    "authorizedPartyRef",
    "serviceDate",
    "status",
    "studentChecked",
    "recipientChecked",
    "authorizationChecked",
    "checkedByMembershipId",
    "occurredAt",
  ]) {
    assert.match(record, new RegExp(`^\\s*${field}\\s+`, "m"));
  }
  assert.match(
    record,
    /authorization\s+PickupAuthorization\s+@relation\("PickupRecordAuthorization"/,
  );
  assert.match(record, /attendanceRecord\s+AttendanceRecord\s+@relation\("PickupRecordAttendance"/);
  assert.match(record, /checkedBy\s+MembershipCampus\s+@relation\("PickupRecordChecker"/);
  assert.match(record, /@@unique\(\[tenantId, campusId, studentId, serviceDate\]\)/);
  assert.doesNotMatch(
    record,
    /\b(name|phone|address|birthDate|photo|deviceLabel|note|incidentRef)\b/i,
  );
  const attendance = schema.match(/model AttendanceRecord\s*\{[\s\S]*?\n\}/)?.[0];
  assert.ok(attendance, "AttendanceRecord model exists");
  assert.match(attendance, /@@unique\(\[tenantId, campusId, id, studentId, serviceDate\]\)/);

  const migration = readFileSync(
    join(apiRoot, "prisma", "migrations", "202610170002_pickup_scope", "migration.sql"),
    "utf8",
  );
  assert.match(
    migration,
    /CREATE TYPE "pickup_recipient" AS ENUM \('pickup-alpha', 'pickup-beta'\)/,
  );
  assert.match(
    migration,
    /CREATE TABLE "pickup_authorizations"[\s\S]*?PRIMARY KEY \("tenant_id",\s*"campus_id",\s*"id"\)/,
  );
  assert.match(
    migration,
    /CREATE TABLE "pickup_records"[\s\S]*?PRIMARY KEY \("tenant_id",\s*"campus_id",\s*"id"\)/,
  );
  assert.match(
    migration,
    /CREATE UNIQUE INDEX "pickup_records_tenant_id_campus_id_student_id_service_date_key"/,
  );
  assert.match(
    migration,
    /CREATE UNIQUE INDEX "attendance_records_tenant_id_campus_id_id_student_id_servic_key"/,
  );
  assert.match(
    migration,
    /FOREIGN KEY \("tenant_id",\s*"campus_id",\s*"student_id"\) REFERENCES "students"\("tenant_id",\s*"campus_id",\s*"id"\)/,
  );
  assert.match(
    migration,
    /FOREIGN KEY \("tenant_id",\s*"campus_id",\s*"guardian_relationship_id",\s*"student_id",\s*"guardian_user_id"\) REFERENCES "guardian_relationships"/,
  );
  assert.match(
    migration,
    /FOREIGN KEY \("tenant_id",\s*"campus_id",\s*"attendance_record_id",\s*"student_id",\s*"service_date"\) REFERENCES "attendance_records"/,
  );
  for (const actorField of [
    "created_by_membership_id",
    "updated_by_membership_id",
    "checked_by_membership_id",
  ]) {
    assert.match(
      migration,
      new RegExp(
        `FOREIGN KEY \\("tenant_id",\\s*"${actorField}",\\s*"campus_id"\\) REFERENCES "membership_campuses"`,
      ),
    );
  }
  assert.match(migration, /pickup_authorizations_date_range_check/);
  assert.match(migration, /pickup_authorizations_time_format_check/);
  assert.match(migration, /pickup_authorizations_temporary_single_day_check/);
  assert.match(migration, /pickup_authorizations_positive_version_check/);
  assert.match(migration, /pickup_records_positive_versions_check/);
  assert.match(migration, /pickup_records_checks_complete_check/);
  assert.match(migration, /CHECK \("start_date" <= "end_date"\)/);
  assert.match(migration, /CHECK \("type" <> 'TEMPORARY' OR "start_date" = "end_date"\)/);
  assert.match(
    migration,
    /CHECK \("student_checked" AND "recipient_checked" AND "authorization_checked"\)/,
  );
  assert.doesNotMatch(migration, /ON DELETE CASCADE/i);
});

test("pickup credentials persist only one-time hashes inside tenant and campus scope", () => {
  const schema = readFileSync(join(apiRoot, "prisma", "schema.prisma"), "utf8");
  const credential = schema.match(/model PickupCredential\s*\{[\s\S]*?\n\}/)?.[0];
  assert.ok(credential, "PickupCredential model exists");
  for (const field of [
    "tenantId",
    "campusId",
    "id",
    "authorizationId",
    "authorizationVersion",
    "credentialHash",
    "issuedByMembershipId",
    "expiresAt",
    "consumedAt",
    "invalidatedAt",
  ]) {
    assert.match(credential, new RegExp(`^\\s*${field}\\s+`, "m"));
  }
  assert.match(credential, /@@id\(\[tenantId, campusId, id\]\)/);
  assert.match(credential, /credentialHash\s+String\s+@unique/);
  assert.match(
    credential,
    /authorization\s+PickupAuthorization\s+@relation\("PickupCredentialAuthorization"/,
  );
  assert.match(credential, /issuedBy\s+MembershipCampus\s+@relation\("PickupCredentialIssuer"/);
  assert.doesNotMatch(credential, /\b(rawToken|credential|secret|phone|name)\b/i);

  const migration = readFileSync(
    join(apiRoot, "prisma", "migrations", "202610250001_pickup_credentials", "migration.sql"),
    "utf8",
  );
  assert.match(
    migration,
    /CREATE TABLE "pickup_credentials"[\s\S]*?PRIMARY KEY \("tenant_id",\s*"campus_id",\s*"id"\)/,
  );
  assert.match(
    migration,
    /FOREIGN KEY \("tenant_id",\s*"campus_id",\s*"authorization_id"\) REFERENCES "pickup_authorizations"/,
  );
  assert.match(
    migration,
    /FOREIGN KEY \("tenant_id",\s*"issued_by_membership_id",\s*"campus_id"\) REFERENCES "membership_campuses"/,
  );
  assert.match(migration, /CHECK \(length\("credential_hash"\) = 64\)/);
  assert.match(migration, /ON DELETE RESTRICT/);
  assert.doesNotMatch(migration, /ON DELETE CASCADE/i);
});

test("health incidents and parent receipts persist only fixed codes in one guardian scope", () => {
  const schema = readFileSync(join(apiRoot, "prisma", "schema.prisma"), "utf8");
  const incident = schema.match(/model HealthIncident\s*\{[\s\S]*?\n\}/)?.[0];
  assert.ok(incident, "HealthIncident model exists");
  const receipt = schema.match(/model HealthIncidentReceipt\s*\{[\s\S]*?\n\}/)?.[0];
  assert.ok(receipt, "HealthIncidentReceipt model exists");

  for (const [name, values] of Object.entries({
    HealthIncidentObservationCode: ["ROUTINE_OBSERVATION", "NEEDS_FOLLOW_UP", "URGENT_REVIEW"],
    HealthIncidentDispositionCode: [
      "OBSERVATION_RECHECKED",
      "FOLLOW_UP_SCHEDULED",
      "GUARDIAN_SUMMARY_PREPARED",
    ],
    HealthIncidentSummaryCode: [
      "FOLLOW_UP_IN_PROGRESS",
      "FOLLOW_UP_COMPLETED",
      "PLEASE_CHECK_PAGE_LATER",
    ],
    HealthIncidentStatus: [
      "DRAFT",
      "SUBMITTED",
      "RETURNED",
      "CONFIRMED",
      "EXCEPTION_PENDING",
      "PUBLISHED",
      "REVOKED",
      "WITHDRAWN",
    ],
    HealthIncidentReceiptStatus: ["READ", "ACKNOWLEDGED"],
  })) {
    const enumBlock = schema.match(new RegExp(`enum ${name}\\s*\\{[\\s\\S]*?\\n\\}`))?.[0];
    assert.ok(enumBlock, `${name} enum exists`);
    for (const value of values) assert.match(enumBlock, new RegExp(`^\\s*${value}\\b`, "m"));
  }

  for (const field of [
    "tenantId",
    "campusId",
    "studentId",
    "guardianRelationshipId",
    "guardianUserId",
    "guardianRelationshipVersion",
    "observationCode",
    "dispositionCode",
    "summaryCode",
    "status",
    "published",
    "version",
    "createdByMembershipId",
    "reviewedByMembershipId",
    "updatedByMembershipId",
  ]) {
    assert.match(incident, new RegExp(`^\\s*${field}\\s+`, "m"));
  }
  assert.match(
    incident,
    /guardianRelationship\s+GuardianRelationship\s+@relation\("HealthIncidentRelationship"/,
  );
  assert.match(incident, /student\s+Student\s+@relation\("HealthIncidentStudent"/);
  assert.match(incident, /createdBy\s+MembershipCampus\s+@relation\("HealthIncidentCreator"/);
  assert.match(incident, /reviewedBy\s+MembershipCampus\?\s+@relation\("HealthIncidentReviewer"/);
  assert.match(incident, /updatedBy\s+MembershipCampus\s+@relation\("HealthIncidentUpdater"/);
  assert.match(incident, /receipts\s+HealthIncidentReceipt\[\]/);
  assert.doesNotMatch(
    incident,
    /\b(name|phone|address|birthDate|photo|diagnosis|symptoms|details|notes|freeText)\b/i,
  );

  for (const field of ["tenantId", "campusId", "incidentId", "version", "status", "updatedAt"]) {
    assert.match(receipt, new RegExp(`^\\s*${field}\\s+`, "m"));
  }
  assert.match(receipt, /incident\s+HealthIncident\s+@relation\("HealthIncidentReceipts"/);
  assert.match(receipt, /@@id\(\[tenantId, campusId, incidentId\]\)/);
  assert.doesNotMatch(receipt, /\b(name|phone|address|birthDate|photo|message|deliveryStatus)\b/i);

  const migration = readFileSync(
    join(apiRoot, "prisma", "migrations", "202610170003_health_incident_scope", "migration.sql"),
    "utf8",
  );
  assert.match(
    migration,
    /CREATE TYPE "health_incident_observation_code" AS ENUM \('ROUTINE_OBSERVATION', 'NEEDS_FOLLOW_UP', 'URGENT_REVIEW'\)/,
  );
  assert.match(
    migration,
    /CREATE TABLE "health_incidents"[\s\S]*?PRIMARY KEY \("tenant_id",\s*"campus_id",\s*"id"\)/,
  );
  assert.match(
    migration,
    /CREATE TABLE "health_incident_receipts"[\s\S]*?PRIMARY KEY \("tenant_id",\s*"campus_id",\s*"incident_id"\)/,
  );
  assert.match(
    migration,
    /FOREIGN KEY \("tenant_id",\s*"campus_id",\s*"guardian_relationship_id",\s*"student_id",\s*"guardian_user_id"\) REFERENCES "guardian_relationships"/,
  );
  assert.match(
    migration,
    /FOREIGN KEY \("tenant_id",\s*"campus_id",\s*"incident_id"\) REFERENCES "health_incidents"/,
  );
  for (const actorField of [
    "created_by_membership_id",
    "reviewed_by_membership_id",
    "updated_by_membership_id",
  ]) {
    assert.match(
      migration,
      new RegExp(
        `FOREIGN KEY \\("tenant_id",\\s*"${actorField}",\\s*"campus_id"\\) REFERENCES "membership_campuses"`,
      ),
    );
  }
  assert.match(migration, /health_incidents_positive_version_check/);
  assert.match(migration, /health_incidents_relationship_version_check/);
  assert.match(migration, /health_incidents_published_projection_check/);
  assert.match(migration, /health_incidents_review_state_check/);
  assert.match(migration, /health_incident_receipts_positive_version_check/);
  assert.match(migration, /CHECK \("published" = \("status" = 'PUBLISHED'\)\)/);
  assert.match(migration, /CHECK \("version" >= 1\)/);
  assert.doesNotMatch(migration, /ON DELETE CASCADE/i);
});

test("guardian AI consents preserve fixed scope and version history inside one relationship", () => {
  const schema = readFileSync(join(apiRoot, "prisma", "schema.prisma"), "utf8");
  const consent = schema.match(/model GuardianConsent\s*\{[\s\S]*?\n\}/)?.[0];
  assert.ok(consent, "GuardianConsent model exists");

  for (const [name, value] of [
    ["GuardianConsentScope", "LEARNING_SUPPORT"],
    ["GuardianConsentVersion", "LEARNING_DEMO_V2"],
    ["GuardianConsentNoticeVersion", "LEARNING_SUPPORT_NOTICE_V1"],
    ["GuardianConsentPolicyVersion", "AI_LEARNING_POLICY_SYNTHETIC_V1"],
    ["GuardianConsentStatus", "ACTIVE"],
  ]) {
    const enumBlock = schema.match(new RegExp("enum " + name + "\\s*\\{[\\s\\S]*?\\n\\}"))?.[0];
    assert.ok(enumBlock, name + " enum exists");
    assert.match(enumBlock, new RegExp("^\\s*" + value + "\\b", "m"));
  }

  for (const field of [
    "tenantId",
    "campusId",
    "guardianRelationshipId",
    "studentId",
    "guardianUserId",
    "scope",
    "consentVersion",
    "noticeVersion",
    "policyVersion",
    "status",
    "version",
    "confirmedAt",
    "withdrawnAt",
  ]) {
    assert.match(consent, new RegExp("^\\s*" + field + "\\s+", "m"));
  }
  assert.match(
    consent,
    /guardianRelationship\s+GuardianRelationship\s+@relation\("GuardianConsentRelationship"/,
  );
  assert.match(consent, /student\s+Student\s+@relation\("GuardianConsentStudent"/);
  assert.match(consent, /@@id\(\[tenantId, campusId, id\]\)/);
  assert.doesNotMatch(
    consent,
    /\b(name|phone|address|birthDate|photo|noticeText|policyText|freeText)\b/i,
  );

  const migration = readFileSync(
    join(apiRoot, "prisma", "migrations", "202610170004_guardian_consent_scope", "migration.sql"),
    "utf8",
  );
  assert.match(migration, /CREATE TYPE "guardian_consent_scope" AS ENUM \('LEARNING_SUPPORT'\)/);
  assert.match(migration, /CREATE TYPE "guardian_consent_status" AS ENUM \('ACTIVE', 'REVOKED'\)/);
  assert.match(migration, /AI_LEARNING_POLICY_SYNTHETIC_V1/);
  assert.match(migration, /LEARNING_SUPPORT_NOTICE_V1/);
  assert.match(migration, /LEARNING_DEMO_V2/);
  assert.match(
    migration,
    /FOREIGN KEY \("tenant_id",\s*"campus_id",\s*"guardian_relationship_id",\s*"student_id",\s*"guardian_user_id"\) REFERENCES "guardian_relationships"/,
  );
  assert.match(migration, /guardian_consents_one_active_scope/);
  assert.match(migration, /WHERE \("status" = 'ACTIVE'\)/);
  assert.match(migration, /guardian_consents_positive_version_check/);
  assert.match(migration, /guardian_consents_withdrawal_state_check/);
  assert.match(migration, /CHECK \("version" >= 1\)/);
  assert.match(
    migration,
    /CHECK \(\("status" = 'ACTIVE' AND "withdrawn_at" IS NULL\) OR \("status" = 'REVOKED' AND "withdrawn_at" IS NOT NULL\)\)/,
  );
  assert.doesNotMatch(migration, /ON DELETE CASCADE/i);

  const dataModel = readFileSync(
    join(process.cwd(), "docs", "architecture", "DATA_MODEL_DRAFT.md"),
    "utf8",
  );
  const learningFlow = readFileSync(
    join(process.cwd(), "docs", "ai", "AI_LEARNING_FLOW.md"),
    "utf8",
  );
  assert.match(dataModel, /AI_LEARNING_POLICY_SYNTHETIC_V1/);
  assert.match(learningFlow, /AI_LEARNING_POLICY_SYNTHETIC_V1/);
});

test("staff work tasks preserve campus, class, target, and actor scope", () => {
  const schema = readFileSync(join(apiRoot, "prisma", "schema.prisma"), "utf8");
  const task = schema.match(/model WorkTask\s*\{[\s\S]*?\n\}/)?.[0];
  assert.ok(task, "WorkTask model exists");

  for (const [name, values] of [
    [
      "StaffTaskCode",
      [
        "DAILY_CHECK",
        "TEMPORARY_SUPPORT",
        "STUDENT_FOLLOW_UP",
        "ACTIVITY_SETUP",
        "SAFETY_RESPONSE",
      ],
    ],
    ["StaffTaskTargetType", ["CLASS", "STUDENT", "ACTIVITY", "CAMPUS"]],
    ["StaffTaskPriority", ["NORMAL", "IMPORTANT", "URGENT"]],
    [
      "StaffTaskStatus",
      ["ASSIGNED", "CLAIMED", "IN_PROGRESS", "COMPLETED", "CHECKED", "RETURNED", "CANCELLED"],
    ],
    ["StaffTaskResult", ["COMPLETED_AS_PLANNED", "FOLLOW_UP_REQUIRED", "BLOCKED"]],
  ] as const) {
    const block = schema.match(new RegExp("enum " + name + "\\s*\\{([\\s\\S]*?)\\n\\}"))?.[1];
    assert.ok(block, name + " enum exists");
    for (const value of values) assert.match(block, new RegExp("^\\s*" + value + "\\s*$", "m"));
  }

  for (const field of [
    "tenantId",
    "campusId",
    "id",
    "classRef",
    "code",
    "targetType",
    "targetRef",
    "studentId",
    "dueDate",
    "priority",
    "status",
    "result",
    "version",
    "createdByMembershipId",
    "assigneeMembershipId",
    "claimedByMembershipId",
    "completedByMembershipId",
    "checkedByMembershipId",
    "updatedByMembershipId",
    "updatedAt",
  ]) {
    assert.match(task, new RegExp("^\\s*" + field + "\\s+", "m"));
  }
  for (const [field, relation] of [
    ["createdBy", "WorkTaskCreator"],
    ["assignee", "WorkTaskAssignee"],
    ["claimedBy", "WorkTaskClaimer"],
    ["completedBy", "WorkTaskCompleter"],
    ["checkedBy", "WorkTaskChecker"],
    ["updatedBy", "WorkTaskUpdater"],
  ] as const) {
    assert.match(
      task,
      new RegExp(
        "^\\s*" + field + '\\s+MembershipCampus\\??\\s+@relation\\(\\"' + relation + '\\"',
        "m",
      ),
    );
  }
  assert.match(task, /student\s+Student\?\s+@relation\("WorkTaskStudentTarget"/);
  assert.match(task, /@@id\(\[tenantId, campusId, id\]\)/);
  assert.doesNotMatch(
    task,
    /\b(name|phone|address|birthDate|photo|description|notes|details|freeText)\b/i,
  );

  const migration = readFileSync(
    join(apiRoot, "prisma", "migrations", "202610170005_staff_task_scope", "migration.sql"),
    "utf8",
  );
  assert.match(
    migration,
    /CREATE TABLE "work_tasks"[\s\S]*?PRIMARY KEY \("tenant_id",\s*"campus_id",\s*"id"\)/,
  );
  assert.match(migration, /FOREIGN KEY \("tenant_id",\s*"campus_id"\) REFERENCES "campuses"/);
  assert.match(
    migration,
    /FOREIGN KEY \("tenant_id",\s*"campus_id",\s*"student_id"\) REFERENCES "students"/,
  );
  for (const actorField of [
    "created_by_membership_id",
    "assignee_membership_id",
    "claimed_by_membership_id",
    "completed_by_membership_id",
    "checked_by_membership_id",
    "updated_by_membership_id",
  ]) {
    assert.match(
      migration,
      new RegExp(
        `FOREIGN KEY \\("tenant_id",\\s*"${actorField}",\\s*"campus_id"\\) REFERENCES "membership_campuses"`,
      ),
    );
  }
  assert.match(migration, /work_tasks_positive_version_check/);
  assert.match(migration, /work_tasks_student_target_check/);
  assert.doesNotMatch(migration, /ON DELETE CASCADE/i);
});

test("pickup exceptions preserve fixed outcomes and tenant, campus, student, and reviewer scope", () => {
  const schema = readFileSync(join(apiRoot, "prisma", "schema.prisma"), "utf8");
  const exception = schema.match(/model PickupException\s*\{[\s\S]*?\n\}/)?.[0];
  assert.ok(exception, "PickupException model exists");

  for (const [name, values] of [
    [
      "PickupExceptionCategory",
      ["NO_AUTHORIZATION", "INFORMATION_MISMATCH", "INVALID_CREDENTIAL", "OVERDUE"],
    ],
    ["PickupExceptionStatus", ["OPEN", "FOLLOWING", "RESOLVED"]],
    [
      "PickupExceptionOutcome",
      ["CONTACT_GUARDIAN", "INFORMATION_RECHECKED", "ARRANGEMENT_CONFIRMED"],
    ],
  ] as const) {
    const block = schema.match(new RegExp("enum " + name + "\\s*\\{([\\s\\S]*?)\\n\\}"))?.[1];
    assert.ok(block, name + " enum exists");
    for (const value of values) assert.match(block, new RegExp("^\\s*" + value + "\\s*$", "m"));
  }

  for (const field of [
    "tenantId",
    "campusId",
    "id",
    "studentId",
    "classRef",
    "date",
    "category",
    "status",
    "version",
    "createdByMembershipId",
    "createdAt",
    "reviewedByMembershipId",
    "reviewedAt",
    "outcome",
  ]) {
    assert.match(exception, new RegExp("^\\s*" + field + "\\s+", "m"));
  }
  for (const [field, relation] of [
    ["campus", "PickupExceptionCampus"],
    ["student", "PickupExceptionStudent"],
    ["createdBy", "PickupExceptionCreator"],
    ["reviewedBy", "PickupExceptionReviewer"],
  ] as const) {
    assert.match(
      exception,
      new RegExp("^\\s*" + field + '\\s+\\w+\\??\\s+@relation\\(\\"' + relation + '\\"', "m"),
    );
  }
  assert.match(exception, /@@id\(\[tenantId, campusId, id\]\)/);
  assert.doesNotMatch(
    exception,
    /\b(name|phone|address|birthDate|photo|credential|token|description|notes|details|freeText)\b/i,
  );

  const migration = readFileSync(
    join(apiRoot, "prisma", "migrations", "202610170006_pickup_exception_scope", "migration.sql"),
    "utf8",
  );
  assert.match(migration, /CREATE TYPE "pickup_exception_category" AS ENUM/);
  assert.match(
    migration,
    /CREATE TYPE "pickup_exception_status" AS ENUM \('OPEN', 'FOLLOWING', 'RESOLVED'\)/,
  );
  assert.match(migration, /CREATE TYPE "pickup_exception_outcome" AS ENUM/);
  assert.match(
    migration,
    /CREATE TABLE "pickup_exceptions"[\s\S]*?PRIMARY KEY \("tenant_id",\s*"campus_id",\s*"id"\)/,
  );
  assert.match(
    migration,
    /FOREIGN KEY \("tenant_id",\s*"campus_id",\s*"student_id"\) REFERENCES "students"/,
  );
  for (const actorField of ["created_by_membership_id", "reviewed_by_membership_id"]) {
    assert.match(
      migration,
      new RegExp(
        `FOREIGN KEY \\("tenant_id",\\s*"${actorField}",\\s*"campus_id"\\) REFERENCES "membership_campuses"`,
      ),
    );
  }
  assert.match(migration, /pickup_exceptions_positive_version_check/);
  assert.match(migration, /pickup_exceptions_review_state_check/);
  assert.match(migration, /pickup_exceptions_review_time_check/);
  assert.match(migration, /CHECK \("version" >= 1\)/);
  assert.doesNotMatch(migration, /ON DELETE CASCADE/i);

  const dataModel = readFileSync(
    join(process.cwd(), "docs", "architecture", "DATA_MODEL_DRAFT.md"),
    "utf8",
  );
  assert.match(dataModel, /`PickupException`/);
});

test("staff daily reports keep fixed values and typed sources within one campus", () => {
  const schema = readFileSync(join(apiRoot, "prisma", "schema.prisma"), "utf8");
  const expectedEnums = [
    ["StaffDailyStatus", ["DRAFT", "SUBMITTED", "RETURNED", "CONFIRMED"]],
    ["StaffDailyArrivalCode", ["ARRIVED_AS_PLANNED", "LATE", "ABSENT"]],
    ["StaffDailyHomeworkCode", ["COMPLETED", "IN_PROGRESS", "NEEDS_SUPPORT"]],
    ["StaffDailyActivityCode", ["PARTICIPATED", "OBSERVED", "NOT_RECORDED"]],
    ["StaffDailyClassroomCode", ["ROUTINE", "NEEDS_ATTENTION", "NEEDS_FOLLOW_UP"]],
    ["StaffDailyFollowUpCode", ["NONE", "OBSERVE_TOMORROW", "OWNER_ATTENTION"]],
  ] as const;
  for (const [name, values] of expectedEnums) {
    const block = schema.match(new RegExp("enum " + name + "\\s*\\{([\\s\\S]*?)\\n\\}"))?.[1];
    assert.ok(block, name + " enum exists");
    for (const value of values) assert.match(block, new RegExp("^\\s*" + value + "\\s*$", "m"));
  }

  const report = schema.match(/model StaffDailyReport\s*\{[\s\S]*?\n\}/)?.[0];
  assert.ok(report, "StaffDailyReport model exists");
  for (const field of [
    "tenantId",
    "campusId",
    "id",
    "classRef",
    "date",
    "arrival",
    "homework",
    "activity",
    "classroom",
    "followUp",
    "status",
    "version",
    "createdByMembershipId",
    "reviewedByMembershipId",
    "updatedByMembershipId",
    "updatedAt",
  ]) {
    assert.match(report, new RegExp("^\\s*" + field + "\\s+", "m"));
  }
  assert.match(report, /@@id\(\[tenantId, campusId, id\]\)/);
  assert.match(report, /@@unique\(\[tenantId, campusId, createdByMembershipId, date\]\)/);
  assert.doesNotMatch(
    report,
    /\b(name|phone|address|studentId|summary|handoff|nextFocus|description|notes|freeText)\b/i,
  );

  const sources = [
    [
      "StaffDailyReportWorkTaskSource",
      "WorkTask",
      "work_tasks",
      "staff_daily_report_work_task_sources",
      "StaffDailyReportWorkTaskReport",
      "StaffDailyReportWorkTaskTarget",
      "workTask",
    ],
    [
      "StaffDailyReportAttendanceSource",
      "AttendanceRecord",
      "attendance_records",
      "staff_daily_report_attendance_sources",
      "StaffDailyReportAttendanceReport",
      "StaffDailyReportAttendanceTarget",
      "attendanceRecord",
    ],
    [
      "StaffDailyReportCareRecordSource",
      "CareRecord",
      "care_records",
      "staff_daily_report_care_record_sources",
      "StaffDailyReportCareRecordReport",
      "StaffDailyReportCareRecordTarget",
      "careRecord",
    ],
    [
      "StaffDailyReportPickupRecordSource",
      "PickupRecord",
      "pickup_records",
      "staff_daily_report_pickup_record_sources",
      "StaffDailyReportPickupRecordReport",
      "StaffDailyReportPickupRecordTarget",
      "pickupRecord",
    ],
    [
      "StaffDailyReportPickupExceptionSource",
      "PickupException",
      "pickup_exceptions",
      "staff_daily_report_pickup_exception_sources",
      "StaffDailyReportPickupExceptionReport",
      "StaffDailyReportPickupExceptionTarget",
      "pickupException",
    ],
  ] as const;
  for (const [modelName, sourceModel, , , reportRelation, targetRelation, targetField] of sources) {
    const source = schema.match(
      new RegExp("model " + modelName + "\\s*\\{([\\s\\S]*?)\\n\\}"),
    )?.[0];
    assert.ok(source, modelName + " model exists");
    for (const field of ["tenantId", "campusId", "reportId", "sourceId", "sourceVersion"]) {
      assert.match(source, new RegExp("^\\s*" + field + "\\s+", "m"));
    }
    assert.match(
      source,
      new RegExp('report\\s+StaffDailyReport\\s+@relation\\(\\"' + reportRelation),
    );
    assert.match(
      source,
      new RegExp(targetField + "\\s+" + sourceModel + '\\s+@relation\\(\\"' + targetRelation),
    );
    assert.match(source, /@@id\(\[tenantId, campusId, reportId, sourceId\]\)/);
    assert.doesNotMatch(
      source,
      /\b(name|phone|address|summary|handoff|description|notes|freeText)\b/i,
    );
    assert.match(
      schema,
      new RegExp(
        "staffDailyReportSources\\s+" + modelName + '\\[\\]\\s+@relation\\(\\"' + targetRelation,
      ),
    );
  }

  const migration = readFileSync(
    join(apiRoot, "prisma", "migrations", "202610170007_staff_daily_report_scope", "migration.sql"),
    "utf8",
  );
  for (const [name] of expectedEnums) {
    assert.match(
      migration,
      new RegExp(
        'CREATE TYPE "' +
          name.replace(/[A-Z]/g, (letter) => "_" + letter.toLowerCase()).replace(/^_/, "") +
          '" AS ENUM',
      ),
    );
  }
  assert.match(migration, /CREATE TABLE "staff_daily_reports"/);
  assert.match(migration, /staff_daily_reports_positive_version_check/);
  assert.match(migration, /staff_daily_reports_review_state_check/);
  assert.match(migration, /CHECK \("version" >= 1\)/);
  for (const [, , tableName, sourceTableName] of sources) {
    assert.match(migration, new RegExp('CREATE TABLE "' + sourceTableName + '"'));
    assert.match(
      migration,
      new RegExp(
        'FOREIGN KEY \\("tenant_id",\\s*"campus_id",\\s*"source_id"\\) REFERENCES "' +
          tableName +
          '"\\("tenant_id",\\s*"campus_id",\\s*"id"\\)',
      ),
    );
    assert.match(migration, new RegExp(sourceTableName + "_positive_version_check"));
  }
  assert.match(migration, /staff_daily_report_\w+_sources_positive_version_check/);
  assert.match(migration, /CHECK \("source_version" >= 1\)/);
  assert.doesNotMatch(migration, /ON DELETE CASCADE/i);

  const dataModel = readFileSync(
    join(process.cwd(), "docs", "architecture", "DATA_MODEL_DRAFT.md"),
    "utf8",
  );
  assert.match(dataModel, /`StaffDailyReport`/);
});

test("care-record source snapshots bind to a revision and matching scoped objects", () => {
  const schema = readFileSync(join(apiRoot, "prisma", "schema.prisma"), "utf8");
  const revision = schema.match(/model CareRecordRevision\s*\{[\s\S]*?\n\}/)?.[0];
  assert.ok(revision, "CareRecordRevision model exists");
  for (const modelName of [
    "CareRecordAttendanceSource",
    "CareRecordMealPlanSource",
    "CareRecordPickupRecordSource",
  ]) {
    const model = schema.match(new RegExp(`model ${modelName}\\s*\\{[\\s\\S]*?\\n\\}`))?.[0];
    assert.ok(model, `${modelName} model exists`);
    for (const field of [
      "tenantId",
      "campusId",
      "careRecordId",
      "careRecordVersion",
      "studentId",
      "serviceDate",
      "sourceId",
    ]) {
      assert.match(model, new RegExp(`^\\s*${field}\\s+`, "m"));
    }
    assert.match(
      model,
      /@@id\(\[tenantId, campusId, careRecordId, careRecordVersion, sourceId\]\)/,
    );
    assert.match(model, /revision\s+CareRecordRevision\s+@relation\(/);
    assert.match(model, /careRecord\s+CareRecord\s+@relation\(/);
    assert.doesNotMatch(model, /\b(name|phone|address|photo|diagnosis|freeText|notes)\b/i);
    assert.match(revision, new RegExp(`${modelName}\\[\\]\\s+@relation\\(`));
  }

  for (const sourceModel of ["CareRecordAttendanceSource", "CareRecordMealPlanSource"]) {
    const model = schema.match(new RegExp(`model ${sourceModel}\\s*\\{[\\s\\S]*?\\n\\}`))?.[0];
    assert.ok(model, `${sourceModel} model exists`);
    assert.match(model, /sourceVersion\s+Int\s+@map\("source_version"\)/);
  }
  const pickupSource = schema.match(/model CareRecordPickupRecordSource\s*\{[\s\S]*?\n\}/)?.[0];
  assert.ok(pickupSource, "CareRecordPickupRecordSource model exists");
  assert.doesNotMatch(pickupSource, /sourceVersion/);

  const migration = readFileSync(
    join(
      apiRoot,
      "prisma",
      "migrations",
      "202610170008_care_record_source_snapshots",
      "migration.sql",
    ),
    "utf8",
  );
  for (const table of [
    "care_record_attendance_sources",
    "care_record_meal_plan_sources",
    "care_record_pickup_record_sources",
  ]) {
    assert.match(migration, new RegExp(`CREATE TABLE "${table}"`));
    assert.match(
      migration,
      new RegExp(
        `FOREIGN KEY \\("tenant_id",\\s*"campus_id",\\s*"care_record_id",\\s*"care_record_version"\\) REFERENCES "care_record_revisions"`,
      ),
    );
    assert.match(
      migration,
      new RegExp(
        `FOREIGN KEY \\("tenant_id",\\s*"campus_id",\\s*"care_record_id",\\s*"student_id",\\s*"service_date"\\) REFERENCES "care_records"`,
      ),
    );
  }
  assert.match(
    migration,
    /FOREIGN KEY \("tenant_id",\s*"campus_id",\s*"source_id",\s*"student_id",\s*"service_date"\) REFERENCES "attendance_records"/,
  );
  assert.match(
    migration,
    /FOREIGN KEY \("tenant_id",\s*"campus_id",\s*"source_id",\s*"service_date"\) REFERENCES "meal_plans"/,
  );
  assert.match(
    migration,
    /FOREIGN KEY \("tenant_id",\s*"campus_id",\s*"source_id",\s*"student_id",\s*"service_date"\) REFERENCES "pickup_records"/,
  );
  for (const table of [
    "care_record_attendance_sources",
    "care_record_meal_plan_sources",
    "care_record_pickup_record_sources",
  ]) {
    assert.match(migration, new RegExp(`${table}_positive_care_record_version_check`));
    assert.match(
      migration,
      new RegExp(`ALTER TABLE "${table}"[\\s\\S]*?CHECK \\("care_record_version" >= 1\\)`),
    );
  }
  for (const table of ["care_record_attendance_sources", "care_record_meal_plan_sources"]) {
    assert.match(migration, new RegExp(`${table}_positive_source_version_check`));
    assert.match(
      migration,
      new RegExp(`ALTER TABLE "${table}"[\\s\\S]*?CHECK \\("source_version" >= 1\\)`),
    );
  }
  assert.doesNotMatch(migration, /ON DELETE CASCADE/i);

  const dataModel = readFileSync(
    join(process.cwd(), "docs", "architecture", "DATA_MODEL_DRAFT.md"),
    "utf8",
  );
  assert.match(dataModel, /菜单上下文，不代表学生实际食用/);
  assert.match(dataModel, /CareRecordRevision/);
});

test("institution AI learning settings default closed and stay within one campus", () => {
  const schema = readFileSync(join(apiRoot, "prisma", "schema.prisma"), "utf8");
  const model = schema.match(/model AIInstitutionSetting\s*\{[\s\S]*?\n\}/)?.[0];
  assert.ok(model, "AIInstitutionSetting model exists");
  assert.match(model, /tenantId\s+String\s+@map\("tenant_id"\)/);
  assert.match(model, /campusId\s+String\s+@map\("campus_id"\)/);
  assert.match(model, /enabled\s+Boolean\s+@default\(false\)/);
  assert.match(model, /version\s+Int\s+@default\(1\)/);
  assert.match(model, /updatedByMembershipId\s+String\s+@map\("updated_by_membership_id"\)/);
  assert.match(model, /updatedAt\s+DateTime\s+@updatedAt\s+@map\("updated_at"\)/);
  assert.match(model, /campus\s+Campus\s+@relation\(/);
  assert.match(model, /updatedBy\s+MembershipCampus\s+@relation\(/);
  assert.match(model, /@@id\(\[tenantId, campusId\]\)/);
  assert.match(model, /@@map\("ai_institution_settings"\)/);
  assert.doesNotMatch(model, /\b(student|guardian|prompt|output|notes|freeText)\b/i);

  const migration = readFileSync(
    join(apiRoot, "prisma", "migrations", "202610170009_ai_institution_setting", "migration.sql"),
    "utf8",
  );
  assert.match(migration, /CREATE TABLE "ai_institution_settings"/);
  assert.match(
    migration,
    /"enabled" BOOLEAN NOT NULL DEFAULT false[\s\S]*?"version" INTEGER NOT NULL DEFAULT 1/,
  );
  assert.match(migration, /PRIMARY KEY \("tenant_id",\s*"campus_id"\)/);
  assert.match(
    migration,
    /FOREIGN KEY \("tenant_id",\s*"campus_id"\) REFERENCES "campuses"\("tenant_id",\s*"id"\)/,
  );
  assert.match(
    migration,
    /FOREIGN KEY \("tenant_id",\s*"updated_by_membership_id",\s*"campus_id"\) REFERENCES "membership_campuses"\("tenant_id",\s*"membership_id",\s*"campus_id"\)/,
  );
  assert.match(migration, /ai_institution_settings_positive_version_check/);
  assert.match(migration, /CHECK \("version" >= 1\)/);
  assert.doesNotMatch(migration, /ON DELETE CASCADE/i);

  const dataModel = readFileSync(
    join(process.cwd(), "docs", "architecture", "DATA_MODEL_DRAFT.md"),
    "utf8",
  );
  assert.match(dataModel, /AIInstitutionSetting/);
  assert.match(dataModel, /机构开关默认关闭/);
  assert.match(dataModel, /运行时仍未接入/);
});

test("care-record and attendance persistence keeps tenant and campus scope", () => {
  const schema = readFileSync(join(apiRoot, "prisma", "schema.prisma"), "utf8");
  for (const model of [
    "MembershipClass",
    "CareRecord",
    "CareRecordReceipt",
    "CareRecordAuditEvent",
    "AttendanceCorrection",
  ]) {
    assert.match(schema, new RegExp(`model ${model}\\s*\\{`));
  }

  const careMigration = readFileSync(
    join(apiRoot, "prisma", "migrations", "202610180002_care_record_persistence", "migration.sql"),
    "utf8",
  );
  const careRecordScopeMigration = readFileSync(
    join(apiRoot, "prisma", "migrations", "202610160003_care_record_scope", "migration.sql"),
    "utf8",
  );
  assert.ok(careRecordScopeMigration.includes('CREATE TABLE "care_records"'));
  assert.match(careRecordScopeMigration, /tenant_id/);
  assert.match(careRecordScopeMigration, /campus_id/);
  for (const table of ["care_record_receipts", "care_record_audit_events"]) {
    assert.ok(careMigration.includes(`CREATE TABLE "${table}"`));
  }
  assert.match(careMigration, /tenant_id/);
  assert.match(careMigration, /campus_id/);
  assert.doesNotMatch(careMigration, /ON DELETE CASCADE/i);

  const attendanceMigration = readFileSync(
    join(apiRoot, "prisma", "migrations", "202610180003_attendance_persistence", "migration.sql"),
    "utf8",
  );
  assert.match(attendanceMigration, /CREATE TABLE "attendance_corrections"/);
  assert.match(attendanceMigration, /attendance_corrections_one_pending_per_record/);
  assert.match(attendanceMigration, /tenant_id/);
  assert.match(attendanceMigration, /campus_id/);
  assert.doesNotMatch(attendanceMigration, /ON DELETE CASCADE/i);
});

test("meal publication history is append-only and tied to one tenant campus", () => {
  const schema = readFileSync(join(apiRoot, "prisma", "schema.prisma"), "utf8");
  const model = schema.match(/model MealPublicationEvent\s*\{[\s\S]*?\n\}/)?.[0];
  assert.ok(model, "MealPublicationEvent model exists");
  assert.match(model, /tenantId\s+String\s+@map\("tenant_id"\)/);
  assert.match(model, /campusId\s+String\s+@map\("campus_id"\)/);
  assert.match(model, /mealPlanId\s+String\s+@map\("meal_plan_id"\)/);
  assert.match(model, /actorMembershipId\s+String\s+@map\("actor_membership_id"\)/);
  assert.match(model, /@@id\(\[tenantId, campusId, id\]\)/);
  assert.match(model, /MealPlan\s+@relation\("MealPublicationEventMealPlan"/);
  assert.match(model, /MembershipCampus\s+@relation\("MealPublicationEventActor"/);
  assert.match(schema, /@@index\(\[publicProfileRef\]\)/);

  const migration = readFileSync(
    join(
      apiRoot,
      "prisma",
      "migrations",
      "202610230001_public_campus_meal_publication_audit",
      "migration.sql",
    ),
    "utf8",
  );
  assert.match(migration, /CREATE TABLE "meal_publication_events"/);
  assert.match(migration, /CHECK \("action" IN \('PUBLISHED', 'UNPUBLISHED'\)\)/);
  assert.match(migration, /FOREIGN KEY \("tenant_id", "campus_id", "meal_plan_id"\)/);
  assert.match(migration, /FOREIGN KEY \("tenant_id", "actor_membership_id", "campus_id"\)/);
  assert.match(migration, /CREATE INDEX "campuses_public_profile_ref_idx"/);
  assert.doesNotMatch(migration, /ON DELETE CASCADE/i);
});

test("institution content stays tenant and campus scoped with immutable publication events", () => {
  const schema = readFileSync(join(apiRoot, "prisma", "schema.prisma"), "utf8");
  const content = schema.match(/model InstitutionContentRecord\s*\{[\s\S]*?\n\}/)?.[0];
  const event = schema.match(/model InstitutionContentPublicationEvent\s*\{[\s\S]*?\n\}/)?.[0];
  assert.ok(content, "InstitutionContentRecord model exists");
  assert.ok(event, "InstitutionContentPublicationEvent model exists");
  assert.match(content, /tenantId\s+String\s+@map\("tenant_id"\)/);
  assert.match(content, /campusId\s+String\?\s+@map\("campus_id"\)/);
  assert.match(content, /contentKey\s+String\s+@map\("content_key"\)/);
  assert.match(content, /body\s+Json\s+@db\.JsonB/);
  assert.match(content, /syntheticData\s+Boolean\s+@default\(true\)/);
  assert.match(event, /tenantId\s+String\s+@map\("tenant_id"\)/);
  assert.match(event, /contentId\s+String\s+@map\("content_id"\)/);
  assert.match(event, /actorReference\s+String\s+@map\("actor_reference"\)/);

  const migration = readFileSync(
    join(
      apiRoot,
      "prisma",
      "migrations",
      "202610230002_institution_content_publication",
      "migration.sql",
    ),
    "utf8",
  );
  assert.match(
    migration,
    /CREATE UNIQUE INDEX "institution_content_records_tenant_profile_key"[\s\S]*WHERE "campus_id" IS NULL/,
  );
  assert.match(
    migration,
    /CREATE UNIQUE INDEX "institution_content_records_campus_content_key"[\s\S]*WHERE "campus_id" IS NOT NULL/,
  );
  assert.match(
    migration,
    /FOREIGN KEY \("tenant_id", "campus_id"\) REFERENCES "campuses"\("tenant_id", "id"\)/,
  );
  assert.match(
    migration,
    /FOREIGN KEY \("tenant_id", "content_id"\) REFERENCES "institution_content_records"\("tenant_id", "id"\)/,
  );
  assert.match(migration, /institution_content_publication_events_append_only/);
  assert.match(migration, /BEFORE UPDATE OR DELETE ON "institution_content_publication_events"/);
  assert.doesNotMatch(migration, /ON DELETE CASCADE/i);
  assert.doesNotMatch(content, /student|child|phone|address|birthDate|photo/i);
});
