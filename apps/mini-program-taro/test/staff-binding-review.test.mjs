import assert from "node:assert/strict";
import test from "node:test";

const reviewModule = await import("../src/binding/staff-binding-review.ts").catch((error) => {
  if (error?.code === "ERR_MODULE_NOT_FOUND") return null;
  throw error;
});

const id = "00000000-0000-4000-8000-000000000401";
const submittedAt = "2026-10-20T03:00:00.000Z";
const queue = [{
  id,
  relationship: "GUARDIAN",
  status: "PENDING",
  version: 1,
  submitted_at: submittedAt,
  reviewed_at: null,
  applicant_label: "合成监护人甲",
  student_label: "合成学生甲",
}];

test("staff queue reads only the scoped review projection", async () => {
  assert.ok(reviewModule?.loadStaffBindingQueue, "staff binding queue reader must exist");
  const paths = [];
  const result = await reviewModule.loadStaffBindingQueue(async (path) => {
    paths.push(path);
    return queue;
  });

  assert.deepEqual(paths, ["/staff/guardian-binding/applications"]);
  assert.deepEqual(result, [{ id, applicantLabel: "合成监护人甲", studentLabel: "合成学生甲", relationship: "GUARDIAN", version: 1, submittedAt }]);
  assert.doesNotMatch(JSON.stringify(result), /campus|tenant|student_candidate_ref|actor_id/u);
});

test("staff review sends the current version and returns the server decision", async () => {
  assert.ok(reviewModule?.reviewStaffBinding, "staff binding review action must exist");
  const calls = [];
  const result = await reviewModule.reviewStaffBinding(async (path, body) => {
    calls.push({ path, body });
    return { id, student_candidate_ref: "00000000-0000-4000-8000-000000000301", relationship: "GUARDIAN", status: "APPROVED", version: 2, submitted_at: submittedAt, reviewed_at: "2026-10-20T03:10:00.000Z" };
  }, { id, version: 1 }, "approve");

  assert.deepEqual(calls, [{ path: `/staff/guardian-binding/applications/${id}/review`, body: { version: 1, action: "approve" } }]);
  assert.deepEqual(result, { id, status: "APPROVED", version: 2, reviewedAt: "2026-10-20T03:10:00.000Z" });
});

test("staff queue and review reject malformed scope, status, and sensitive response fields", async () => {
  assert.ok(reviewModule?.loadStaffBindingQueue, "staff binding queue reader must exist");
  assert.ok(reviewModule?.reviewStaffBinding, "staff binding review action must exist");
  await assert.rejects(reviewModule.loadStaffBindingQueue(async () => [{ ...queue[0], status: "APPROVED" }]), /格式/u);
  await assert.rejects(reviewModule.loadStaffBindingQueue(async () => [{ ...queue[0], model_log: "synthetic secret" }]), /格式/u);
  await assert.rejects(reviewModule.loadStaffBindingQueue(async () => [{ ...queue[0], submitted_at: "bad-date" }]), /格式/u);
  await assert.rejects(reviewModule.reviewStaffBinding(async () => ({ id, status: "PENDING", version: 1, reviewed_at: null }), { id, version: 1 }, "approve"), /格式/u);
  await assert.rejects(reviewModule.reviewStaffBinding(async () => ({}), { id: "../../outside", version: 1 }, "approve"), /申请/u);
  await assert.rejects(reviewModule.reviewStaffBinding(async () => ({}), { id, version: 0 }, "reject"), /版本/u);
});
