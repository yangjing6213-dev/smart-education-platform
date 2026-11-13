import assert from "node:assert/strict";
import { URL } from "node:url";
import test from "node:test";
import { createStaffOperationsStore } from "../src/local-synthetic/staff-operations.ts";

test("creates a fixed synthetic work review with no score or personal-decision field", () => {
  const store = createStaffOperationsStore();
  const result = store.createPerformanceReview({
    staffId: "synthetic-staff-east-002",
    period: "2026-11",
    area: "LEARNING_SUPPORT",
    outcome: "ROUTINE_PROGRESS",
    supportAction: "PEER_COACHING",
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.record.staffId, "synthetic-staff-east-002");
  assert.equal(result.record.period, "2026-11");
  assert.equal(result.record.area, "LEARNING_SUPPORT");
  assert.equal(result.record.outcome, "ROUTINE_PROGRESS");
  assert.equal(result.record.supportAction, "PEER_COACHING");
  assert.equal(result.record.status, "PENDING_REVIEW");
  assert.equal(result.record.version, 1);
  assert.equal("score" in result.record, false);
  assert.equal("ranking" in result.record, false);
  assert.equal("personnelDecision" in result.record, false);
});

test("rejects unknown employees, non-fixed values, and free-text fields without changing state", () => {
  const store = createStaffOperationsStore();
  const before = store.snapshot.performanceReviews;
  const base = {
    staffId: "synthetic-staff-east-001",
    period: "2026-11",
    area: "CLASSROOM_SUPPORT",
    outcome: "ROUTINE_PROGRESS",
    supportAction: "NONE",
  };

  for (const input of [
    { ...base, staffId: "real-person" },
    { ...base, outcome: "PERFORMANCE_SCORE_5" },
    { ...base, notes: "自由文本员工评价" },
    { ...base, period: "2026-13" },
  ]) {
    assert.equal(store.createPerformanceReview(input).ok, false);
  }
  assert.deepEqual(store.snapshot.performanceReviews, before);
});

test("records human review history and rejects stale versions", () => {
  const store = createStaffOperationsStore();
  const created = store.createPerformanceReview({
    staffId: "synthetic-staff-east-001",
    period: "2026-11",
    area: "FAMILY_COMMUNICATION",
    outcome: "SUPPORT_COMPLETED",
    supportAction: "WORKFLOW_GUIDANCE",
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;

  const reviewed = store.reviewPerformanceReview(created.record.id, 1, "CONFIRMED");
  assert.equal(reviewed.ok, true);
  if (!reviewed.ok) return;
  assert.equal(reviewed.record.status, "CONFIRMED");
  assert.equal(reviewed.record.version, 2);
  assert.deepEqual(reviewed.record.history, [{ version: 1, status: "PENDING_REVIEW" }]);

  const beforeStaleWrite = store.snapshot.performanceReviews;
  const stale = store.reviewPerformanceReview(created.record.id, 1, "FOLLOW_UP");
  assert.deepEqual(stale, { ok: false, error: "VERSION_CONFLICT" });
  assert.deepEqual(store.snapshot.performanceReviews, beforeStaleWrite);
});

test("the page presents work reviews as internal support records without a scoring interface", async () => {
  const source = await import("../dist/pages/staff-operations.js");
  assert.equal(typeof source.createStaffOperationsSection, "function");
  const pageSource = await import("node:fs/promises").then(({ readFile }) =>
    readFile(new URL("../src/pages/staff-operations.ts", import.meta.url), "utf8"),
  );
  assert.match(pageSource, /员工工作回顾/u);
  assert.match(pageSource, /不打分|不计算分数/u);
  assert.doesNotMatch(pageSource, /评分\s*input|排名\s*input/u);
});

test("all staff operation objects carry the fixed synthetic tenant and campus scope", () => {
  const store = createStaffOperationsStore();
  const expectedScope = {
    tenantId: "tenant-synthetic-a",
    campusId: "campus-synthetic-east",
  };
  const snapshot = store.snapshot;

  for (const records of [
    snapshot.workMaterials,
    snapshot.performanceReviews,
    snapshot.recruitmentLeads,
  ]) {
    assert.ok(records.length > 0);
    for (const record of records) {
      assert.equal(record.tenantId, expectedScope.tenantId);
      assert.equal(record.campusId, expectedScope.campusId);
    }
  }

  const workMaterial = store.createWorkMaterial({
    staffId: "synthetic-staff-east-001",
    period: "2026-11",
    category: "TRAINING_COMPLETED",
    responsibleRole: "CAMPUS_OWNER",
  });
  const performanceReview = store.createPerformanceReview({
    staffId: "synthetic-staff-east-001",
    period: "2026-11",
    area: "DAILY_CARE",
    outcome: "ROUTINE_PROGRESS",
    supportAction: "NONE",
  });
  const recruitmentLead = store.createRecruitmentLead({
    position: "TEACHER",
    source: "EMPLOYEE_REFERRAL",
    responsibleRole: "CAMPUS_OWNER",
    nextFollowUpDate: "2026-11-20",
  });

  for (const result of [workMaterial, performanceReview, recruitmentLead]) {
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.record.tenantId, expectedScope.tenantId);
      assert.equal(result.record.campusId, expectedScope.campusId);
    }
  }

  if (workMaterial.ok) {
    const reviewed = store.reviewWorkMaterial(
      workMaterial.record.id,
      1,
      "REVIEWED",
    );
    assert.equal(reviewed.ok, true);
    if (reviewed.ok) {
      assert.equal(reviewed.record.tenantId, expectedScope.tenantId);
      assert.equal(reviewed.record.campusId, expectedScope.campusId);
    }
  }
  if (performanceReview.ok) {
    const reviewed = store.reviewPerformanceReview(
      performanceReview.record.id,
      1,
      "CONFIRMED",
    );
    assert.equal(reviewed.ok, true);
    if (reviewed.ok) {
      assert.equal(reviewed.record.tenantId, expectedScope.tenantId);
      assert.equal(reviewed.record.campusId, expectedScope.campusId);
    }
  }
  if (recruitmentLead.ok) {
    const updated = store.updateRecruitmentLead(recruitmentLead.record.id, 1, {
      stage: "CONTACTED",
      nextFollowUpDate: "2026-11-21",
    });
    assert.equal(updated.ok, true);
    if (updated.ok) {
      assert.equal(updated.record.tenantId, expectedScope.tenantId);
      assert.equal(updated.record.campusId, expectedScope.campusId);
    }
  }
});

test("staff operation creation rejects caller-supplied foreign scope without changing state", () => {
  const store = createStaffOperationsStore();
  const before = JSON.stringify(store.snapshot);

  assert.equal(
    store.createWorkMaterial({
      staffId: "synthetic-staff-east-001",
      period: "2026-11",
      category: "TRAINING_COMPLETED",
      responsibleRole: "CAMPUS_OWNER",
      tenantId: "tenant-synthetic-foreign",
      campusId: "campus-synthetic-west",
    }).ok,
    false,
  );
  assert.equal(
    store.createPerformanceReview({
      staffId: "synthetic-staff-east-001",
      period: "2026-11",
      area: "DAILY_CARE",
      outcome: "ROUTINE_PROGRESS",
      supportAction: "NONE",
      tenantId: "tenant-synthetic-foreign",
      campusId: "campus-synthetic-west",
    }).ok,
    false,
  );
  assert.equal(
    store.createRecruitmentLead({
      position: "TEACHER",
      source: "EMPLOYEE_REFERRAL",
      responsibleRole: "CAMPUS_OWNER",
      nextFollowUpDate: "2026-11-20",
      tenantId: "tenant-synthetic-foreign",
      campusId: "campus-synthetic-west",
    }).ok,
    false,
  );

  assert.equal(JSON.stringify(store.snapshot), before);
});
