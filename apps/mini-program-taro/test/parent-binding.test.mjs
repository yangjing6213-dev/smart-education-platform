import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const bindingModule = await import("../src/binding/parent-binding.ts").catch((error) => {
  if (error?.code === "ERR_MODULE_NOT_FOUND") return null;
  throw error;
});
const parentBindingPage = await readFile(
  resolve(dirname(fileURLToPath(import.meta.url)), "../src/pages/parent/binding/index.tsx"),
  "utf8",
);

const studentId = "00000000-0000-4000-8000-000000000301";
const relationshipId = "00000000-0000-4000-8000-000000000501";
const submittedAt = "2026-10-20T03:00:00.000Z";
const approvedAt = "2026-10-20T03:05:00.000Z";
const application = {
  id: "00000000-0000-4000-8000-000000000401",
  student_candidate_ref: studentId,
  relationship: "GUARDIAN",
  status: "PENDING",
  version: 1,
  submitted_at: submittedAt,
  reviewed_at: null,
};
const activeRelationship = {
  id: relationshipId,
  student_id: studentId,
  relationship: "GUARDIAN",
  status: "ACTIVE",
  source_application_id: application.id,
  version: 3,
  approved_at: approvedAt,
};

test("parent choices are loaded from the scoped API and only safe labels are returned", async () => {
  assert.ok(bindingModule?.loadParentBindingOptions, "parent binding options reader must exist");
  const paths = [];
  const options = await bindingModule.loadParentBindingOptions(async (path) => {
    paths.push(path);
    return [{ id: studentId, alias: "student-demo-a", label: "合成学生甲" }];
  });

  assert.deepEqual(paths, ["/parent/student-options"]);
  assert.deepEqual(options, [{ id: studentId, label: "合成学生甲" }]);
  assert.doesNotMatch(JSON.stringify(options), /alias|tenant|campus/u);
});

test("parent binding page reloads only the signed-in parent's own application statuses", async () => {
  assert.ok(
    bindingModule?.loadParentBindingApplications,
    "parent application status reader must exist",
  );
  const paths = [];
  const result = await bindingModule.loadParentBindingApplications(async (path) => {
    paths.push(path);
    return [application];
  });

  assert.deepEqual(paths, ["/guardian-binding/applications"]);
  assert.deepEqual(result, [
    {
      id: application.id,
      studentId,
      status: "PENDING",
      version: 1,
      submittedAt,
      reviewedAt: null,
    },
  ]);
  assert.doesNotMatch(JSON.stringify(result), /guardian_actor|tenant|campus/u);
});

test("parent submission sends only the confirmed guardian application fields", async () => {
  assert.ok(bindingModule?.submitParentBinding, "parent binding submitter must exist");
  const calls = [];
  const result = await bindingModule.submitParentBinding(
    async (path, body) => {
      calls.push({ path, body });
      return application;
    },
    studentId,
    true,
  );

  assert.deepEqual(calls, [
    {
      path: "/guardian-binding/applications",
      body: { student_candidate_ref: studentId, relationship: "GUARDIAN", consent: true },
    },
  ]);
  assert.deepEqual(result, { id: application.id, status: "PENDING", version: 1, submittedAt });
});

test("parent submission cannot imply consent when the parent has not confirmed it", async () => {
  assert.ok(bindingModule?.submitParentBinding, "parent binding submitter must exist");
  let requests = 0;
  await assert.rejects(
    bindingModule.submitParentBinding(
      async () => {
        requests += 1;
        return application;
      },
      studentId,
      false,
    ),
    /确认/u,
  );
  assert.equal(requests, 0);
});

test("parent can toggle consent from the explanatory copy as well as the checkbox", () => {
  assert.ok(bindingModule?.toggleParentBindingConsent, "consent toggle behavior must be shared and testable");
  assert.equal(bindingModule.toggleParentBindingConsent(false), true);
  assert.equal(bindingModule.toggleParentBindingConsent(true), false);
  assert.match(
    parentBindingPage,
    /className="binding-consent-copy"\s+onClick=\{\(\) => setConsent\(\(current\) => toggleParentBindingConsent\(current\)\)\}/u,
  );
});

test("parent binding rejects malformed, out-of-scope shaped, and sensitive API data", async () => {
  assert.ok(bindingModule?.loadParentBindingOptions, "parent binding options reader must exist");
  assert.ok(bindingModule?.submitParentBinding, "parent binding submitter must exist");
  await assert.rejects(
    bindingModule.loadParentBindingOptions(async () => [
      { id: studentId, alias: "", label: "合成学生甲" },
    ]),
    /格式/u,
  );
  await assert.rejects(
    bindingModule.loadParentBindingOptions(async () => [
      { id: studentId, alias: "x", label: "合成学生甲", campus_id: "hidden" },
    ]),
    /格式/u,
  );
  await assert.rejects(
    bindingModule.loadParentBindingApplications(async () => [
      { ...application, applicant_actor_id: "private" },
    ]),
    /格式/u,
  );
  await assert.rejects(
    bindingModule.loadParentBindingApplications(async () => [
      { ...application, status: "UNDER_REVIEW" },
    ]),
    /格式/u,
  );
  await assert.rejects(
    bindingModule.submitParentBinding(
      async () => ({ ...application, student_id: studentId }),
      studentId,
      true,
    ),
    /格式/u,
  );
  await assert.rejects(
    bindingModule.submitParentBinding(async () => application, "//outside.invalid", true),
    /选择/u,
  );
});

test("parent relationship reader returns only validated relationships from the signed-in account", async () => {
  assert.ok(
    bindingModule?.loadParentGuardianRelationships,
    "guardian relationship reader must exist",
  );
  const paths = [];
  const result = await bindingModule.loadParentGuardianRelationships(async (path) => {
    paths.push(path);
    return [activeRelationship];
  });

  assert.deepEqual(paths, ["/guardian-relationships"]);
  assert.deepEqual(result, [
    {
      id: relationshipId,
      studentId,
      sourceApplicationId: application.id,
      status: "ACTIVE",
      version: 3,
      approvedAt,
    },
  ]);
  assert.doesNotMatch(JSON.stringify(result), /tenant|campus|guardian_actor/u);
});

test("parent relationship reader rejects duplicate and sensitive relationship rows", async () => {
  assert.ok(
    bindingModule?.loadParentGuardianRelationships,
    "guardian relationship reader must exist",
  );
  await assert.rejects(
    bindingModule.loadParentGuardianRelationships(async () => [
      activeRelationship,
      activeRelationship,
    ]),
    /格式/u,
  );
  await assert.rejects(
    bindingModule.loadParentGuardianRelationships(async () => [
      { ...activeRelationship, guardian_actor_id: "private" },
    ]),
    /格式/u,
  );
  await assert.rejects(
    bindingModule.loadParentGuardianRelationships(async () => [
      { ...activeRelationship, status: "PENDING" },
    ]),
    /格式/u,
  );
});

test("parent release requires confirmation, sends the current version, and verifies server readback", async () => {
  assert.ok(
    bindingModule?.releaseParentGuardianRelationship,
    "guardian relationship release helper must exist",
  );
  const calls = [];
  const released = { ...activeRelationship, status: "RELEASED", version: 4 };
  const result = await bindingModule.releaseParentGuardianRelationship(
    async (path) => {
      calls.push({ method: "GET", path });
      return [released];
    },
    async (path, body) => {
      calls.push({ method: "POST", path, body });
      return released;
    },
    relationshipId,
    3,
    true,
  );

  assert.deepEqual(calls, [
    {
      method: "POST",
      path: `/guardian-relationships/${relationshipId}/release`,
      body: { version: 3 },
    },
    { method: "GET", path: "/guardian-relationships" },
  ]);
  assert.deepEqual(result, {
    id: relationshipId,
    studentId,
    sourceApplicationId: application.id,
    status: "RELEASED",
    version: 4,
    approvedAt,
  });
});

test("parent release does not write without confirmation and rejects stale or malformed readback", async () => {
  assert.ok(
    bindingModule?.releaseParentGuardianRelationship,
    "guardian relationship release helper must exist",
  );
  let requests = 0;
  await assert.rejects(
    bindingModule.releaseParentGuardianRelationship(
      async () => {
        requests += 1;
        return [];
      },
      async () => {
        requests += 1;
        return {};
      },
      relationshipId,
      3,
      false,
    ),
    /确认/u,
  );
  assert.equal(requests, 0);

  await assert.rejects(
    bindingModule.releaseParentGuardianRelationship(
      async () => [{ ...activeRelationship, status: "RELEASED", version: 5 }],
      async () => ({ ...activeRelationship, status: "RELEASED", version: 4 }),
      relationshipId,
      3,
      true,
    ),
    /状态/u,
  );
  await assert.rejects(
    bindingModule.releaseParentGuardianRelationship(
      async () => [{ ...activeRelationship, status: "RELEASED", version: 4 }],
      async () => ({ ...activeRelationship, status: "RELEASED", version: 5 }),
      relationshipId,
      3,
      true,
    ),
    /回执/u,
  );
});

test("parent binding page shows release only for active relationships after a native confirmation", async () => {
  const page = await readFile(
    resolve(dirname(fileURLToPath(import.meta.url)), "../src/pages/parent/binding/index.tsx"),
    "utf8",
  );

  assert.ok(page.includes("Taro.showModal"), "release must use a native confirmation dialog");
  assert.ok(
    page.includes("releaseParentGuardianRelationship"),
    "confirmed release must call the validated flow",
  );
  assert.ok(
    page.includes('relationship.status === "ACTIVE"'),
    "only active relationships may be released",
  );
  assert.ok(
    page.includes("binding-release-button"),
    "active relationships must expose a release control",
  );
  assert.ok(page.includes("监护关系已结束"), "released relationships must show an ended state");
});

test("a released relationship can be applied for again while pending or active ones stay blocked", () => {
  assert.equal(
    typeof bindingModule?.canSubmitParentBinding,
    "function",
    "parent binding helper must expose the reapplication rule",
  );
  const existing = {
    id: application.id,
    studentId,
    status: "PENDING",
    version: 1,
    submittedAt,
    reviewedAt: null,
  };
  const approved = { ...existing, status: "APPROVED", reviewedAt: approvedAt };
  const active = {
    id: relationshipId,
    studentId,
    sourceApplicationId: application.id,
    status: "ACTIVE",
    version: 3,
    approvedAt,
  };
  const released = { ...active, status: "RELEASED" };

  assert.equal(
    bindingModule.canSubmitParentBinding(studentId, [approved], [released]),
    true,
    "a completed and released relationship should allow reapplication",
  );
  assert.equal(
    bindingModule.canSubmitParentBinding(studentId, [existing], []),
    false,
    "a pending application must not be duplicated",
  );
  assert.equal(
    bindingModule.canSubmitParentBinding(studentId, [approved], [active]),
    false,
    "an active relationship must not be duplicated",
  );
  assert.equal(
    bindingModule.canSubmitParentBinding(studentId, [approved], []),
    false,
    "an approved application without a released relationship is inconsistent and must stay blocked",
  );
});

test("released parent binding page exposes an explicit reapplication control", async () => {
  const page = await readFile(
    resolve(dirname(fileURLToPath(import.meta.url)), "../src/pages/parent/binding/index.tsx"),
    "utf8",
  );

  assert.ok(
    page.includes("canSubmitParentBinding"),
    "the page must use the shared eligibility rule",
  );
  assert.ok(page.includes("重新申请关系"), "released relationships must expose reapplication");
  assert.doesNotMatch(page, /不会提供重新申请该关系的入口/u);
});
