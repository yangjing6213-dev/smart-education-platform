import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateReleaseCandidate,
  evaluateTask18RepositoryLifecycle,
  inspectRepository,
  sha256Bytes,
  task18BaselineHead,
  verifyArtifactDigest,
} from "../../scripts/verify-release.mjs";

const task18Files = [
  "tests/e2e/visitor.spec.ts",
  "tests/e2e/staff.spec.ts",
  "tests/e2e/learning.spec.ts",
  "tests/security/isolation.spec.ts",
  "tests/release/acceptance.spec.ts",
  "scripts/verify-release.mjs",
];
const task18WriteSet = ["AGENTS.md", "PLANS.md", ...task18Files];

function developmentSnapshot(overrides = {}) {
  return {
    head: task18BaselineHead,
    baselineIsAncestor: true,
    changedTracked: ["AGENTS.md", "PLANS.md"],
    staged: [],
    committedPaths: [],
    trackedTask18Files: [],
    untrackedTask18Files: [...task18Files],
    untrackedCount: 77,
    ...overrides,
  };
}

function checkpointSnapshot(overrides = {}) {
  return {
    head: "1".repeat(40),
    baselineIsAncestor: true,
    changedTracked: [],
    staged: [],
    committedPaths: [...task18WriteSet],
    trackedTask18Files: [...task18Files],
    untrackedTask18Files: [],
    untrackedCount: 71,
    ...overrides,
  };
}

test("corrupted artifact blocks the release candidate", () => {
  const original = Buffer.from("synthetic release artifact\n", "utf8");
  const corrupted = Buffer.from("synthetic release artifact!\n", "utf8");
  const expectedSha256 = sha256Bytes(original);

  assert.deepEqual(verifyArtifactDigest(original, expectedSha256), {
    ok: true,
    actualSha256: expectedSha256,
  });
  assert.deepEqual(verifyArtifactDigest(corrupted, expectedSha256), {
    ok: false,
    actualSha256: sha256Bytes(corrupted),
  });
});

test("release candidate requires every suite, browser evidence, and rollback target", () => {
  const result = evaluateReleaseCandidate({
    suites: {
      focused: true,
      regression: true,
      typecheck: true,
      lint: true,
      format: true,
      build: true,
      diffChecks: true,
    },
    browser: { ok: false, blockers: ["BROWSER_EVIDENCE_MISSING"] },
    rollbackTarget: "",
    artifactDigest: "0".repeat(64),
    migrationId: "NONE_NO_SCHEMA_CHANGE",
  });

  assert.equal(result.status, "BLOCKED");
  assert.ok(result.blockers.includes("BROWSER_EVIDENCE_MISSING"));
  assert.ok(result.blockers.includes("ROLLBACK_TARGET_INVALID"));
});

test("repository lifecycle accepts development and clean checkpoint states", () => {
  assert.equal(task18BaselineHead, "b2bf3def53717d6c21e1c3f1125eb161b0d82608");
  assert.deepEqual(evaluateTask18RepositoryLifecycle(developmentSnapshot()), {
    status: "PASS",
    state: "DEVELOPMENT_PRE_CHECKPOINT",
    blockers: [],
  });
  assert.deepEqual(evaluateTask18RepositoryLifecycle(checkpointSnapshot()), {
    status: "PASS",
    state: "CLEAN_TASK18_CHECKPOINT",
    blockers: [],
  });
});

test("repository lifecycle rejects mixed and out-of-scope checkpoint states", () => {
  const mixed = evaluateTask18RepositoryLifecycle(
    developmentSnapshot({
      changedTracked: [],
      trackedTask18Files: [...task18Files],
      untrackedTask18Files: [],
      untrackedCount: 71,
    }),
  );
  assert.equal(mixed.status, "BLOCKED");
  assert.equal(mixed.state, "BLOCKED");
  assert.ok(mixed.blockers.includes("DEVELOPMENT_TRACKED_DIFF_MISMATCH:"));
  assert.ok(mixed.blockers.includes("DEVELOPMENT_TASK18_FILES_TRACKED"));

  const outOfScope = evaluateTask18RepositoryLifecycle(
    checkpointSnapshot({ committedPaths: [...task18WriteSet, "package.json"] }),
  );
  assert.equal(outOfScope.status, "BLOCKED");
  assert.ok(
    outOfScope.blockers.includes(
      `CHECKPOINT_WRITE_SET_MISMATCH:${[...task18WriteSet, "package.json"].sort().join(",")}`,
    ),
  );
});

test("repository lifecycle rejects a checkpoint outside the baseline ancestry", () => {
  const report = evaluateTask18RepositoryLifecycle(
    checkpointSnapshot({ baselineIsAncestor: false }),
  );

  assert.equal(report.status, "BLOCKED");
  assert.ok(report.blockers.includes(`HEAD_NOT_BASELINE_DESCENDANT:${"1".repeat(40)}`));
});

test("repository inspection enforces the exact Task 18 boundary", () => {
  const report = inspectRepository();
  const expectedLifecycleState =
    report.head === task18BaselineHead ? "DEVELOPMENT_PRE_CHECKPOINT" : "CLEAN_TASK18_CHECKPOINT";

  assert.deepEqual(report.blockers, []);
  assert.equal(report.lifecycleState, expectedLifecycleState);
  assert.equal(report.task18Files.length, 6);
  assert.equal(
    report.untrackedCount,
    expectedLifecycleState === "DEVELOPMENT_PRE_CHECKPOINT" ? 77 : 71,
  );
  assert.equal(report.remoteCount, 0);
});
