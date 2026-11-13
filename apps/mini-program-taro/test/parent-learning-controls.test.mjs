import assert from "node:assert/strict";
import test from "node:test";
import * as learning from "../src/learning/parent-learning-summary.ts";

const control = Object.freeze({
  studentId: "00000000-0000-4000-8000-000000000301",
  studentLabel: "合成学生甲",
  enabled: true,
  maxDurationMinutes: 15,
  maxHintLevel: 3,
  contactStatus: "NOT_REQUESTED",
});
const settings = Object.freeze({ enabled: false, maxDurationMinutes: 5, maxHintLevel: 0 });
const saved = () => ({
  studentId: control.studentId,
  studentLabel: control.studentLabel,
  ...settings,
});
const contacted = () => ({
  studentId: control.studentId,
  studentLabel: control.studentLabel,
  status: "RECORDED_LOCAL",
});

test("saving supervision sends only the current child's three settings and preserves contact status", async () => {
  const calls = [];
  const current = { ...control, contactStatus: "RECORDED_LOCAL" };
  const result = await learning.saveParentLearningControls(
    async (path, body) => {
      calls.push({ path, body });
      return saved();
    },
    current,
    settings,
  );
  assert.deepEqual(calls, [
    { path: `/parent/learning/${control.studentId}/controls`, body: settings },
  ]);
  assert.deepEqual(result, { ...current, ...settings });
  assert.notEqual(result, current);
  assert.deepEqual(current, { ...control, contactStatus: "RECORDED_LOCAL" });
});

test("invalid supervision values or extra fields are rejected before any request", async () => {
  let requests = 0;
  for (const invalid of [
    null,
    { ...settings, enabled: "false" },
    { ...settings, maxDurationMinutes: 60 },
    { ...settings, maxDurationMinutes: NaN },
    { ...settings, maxHintLevel: 4 },
    { ...settings, maxHintLevel: 0.5 },
    { ...settings, tenantId: "forged" },
    { enabled: false, maxDurationMinutes: 5 },
  ]) {
    await assert.rejects(
      learning.saveParentLearningControls(
        async () => {
          requests += 1;
          return saved();
        },
        control,
        invalid,
      ),
    );
  }
  assert.equal(requests, 0);
});

test("malformed targets cannot construct a request for either operation", async () => {
  let requests = 0;
  const write = async () => {
    requests += 1;
    return saved();
  };
  for (const invalid of [
    null,
    { ...control, studentId: "../another-child" },
    { ...control, studentLabel: " " },
    { ...control, contactStatus: "SENT" },
    { ...control, maxDurationMinutes: 60 },
    { ...control, tenantId: "forged" },
  ]) {
    await assert.rejects(learning.saveParentLearningControls(write, invalid, settings));
    await assert.rejects(learning.requestParentLearningContact(write, invalid));
  }
  assert.equal(requests, 0);
});

test("saving rejects a different child, different settings, missing or unexpected response fields", async () => {
  for (const response of [
    null,
    { ...saved(), studentId: "00000000-0000-4000-8000-000000000302" },
    { ...saved(), studentLabel: "合成学生乙" },
    { ...saved(), enabled: true },
    { ...saved(), maxDurationMinutes: 10 },
    { ...saved(), maxHintLevel: 1 },
    { ...saved(), contactStatus: "RECORDED_LOCAL" },
    { ...saved(), internalModelLog: "hidden" },
    { studentId: control.studentId, ...settings },
  ]) {
    await assert.rejects(
      learning.saveParentLearningControls(async () => response, control, settings),
    );
  }
  assert.equal(control.enabled, true);
  assert.equal(control.contactStatus, "NOT_REQUESTED");
});

test("contact records only an empty request for the current child and keeps settings unchanged", async () => {
  const calls = [];
  const result = await learning.requestParentLearningContact(async (path, body) => {
    calls.push({ path, body });
    return contacted();
  }, control);
  assert.deepEqual(calls, [{ path: `/parent/learning/${control.studentId}/contact`, body: {} }]);
  assert.deepEqual(result, { ...control, contactStatus: "RECORDED_LOCAL" });
  assert.notEqual(result, control);
  assert.equal(control.contactStatus, "NOT_REQUESTED");
});

test("contact rejects other identities, delivered claims and hidden or missing fields", async () => {
  for (const response of [
    null,
    { ...contacted(), studentId: "00000000-0000-4000-8000-000000000302" },
    { ...contacted(), studentLabel: "合成学生乙" },
    { ...contacted(), status: "SENT" },
    { ...contacted(), modelLog: "hidden" },
    { studentId: control.studentId, status: "RECORDED_LOCAL" },
  ]) {
    await assert.rejects(learning.requestParentLearningContact(async () => response, control));
  }
});

test("transport failures propagate without modifying the current control or editable settings", async () => {
  const cause = Object.assign(new Error("合成服务暂不可用"), { statusCode: 503 });
  const fail = async () => {
    throw cause;
  };
  await assert.rejects(
    learning.saveParentLearningControls(fail, control, settings),
    (error) => error === cause,
  );
  await assert.rejects(
    learning.requestParentLearningContact(fail, control),
    (error) => error === cause,
  );
  assert.deepEqual(settings, { enabled: false, maxDurationMinutes: 5, maxHintLevel: 0 });
  assert.equal(control.enabled, true);
  assert.equal(control.contactStatus, "NOT_REQUESTED");
});
