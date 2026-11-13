import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDeterministicZip,
  compareExactSet,
  evaluateHistoricalEvidence,
  evaluateProtectedInputs,
  evaluateRepositoryContext,
  evaluateBrowserEvidence,
  evaluatePerformanceEvidence,
  evaluateSecurityEvidence,
  evaluateSuiteEvidence,
  evaluateUntrackedBoundary,
  parseDetachedManifest,
  parseZip,
  sha256Bytes,
  validateZip,
} from "../../scripts/verify-final-delivery.mjs";

const routes = [
  "/web/visitor/home",
  "/web/staff/workbench",
  "/mini/visitor/home",
  "/mini/staff/workbench",
  "/flow/ai-learning-assistant",
  "/flow/ai-teacher-summary",
  "/admin/audit-logs",
];
const viewports = ["desktop-1440x1024", "mobile-390x844", "small-mobile-320x568"];

function browserCases() {
  return routes.flatMap((route) =>
    viewports.map((viewport) => ({
      route,
      viewport,
      heading: "模拟数据",
      screenshot: `${route.slice(1).replaceAll("/", "-")}__${viewport}.png`,
      screenshotSha256: "A".repeat(64),
      durationMs: 12,
      horizontalOverflowPx: 0,
      overlap: false,
      clipping: false,
      unreadableControls: false,
      brokenFocusOrder: false,
      missingFocusIndicator: false,
      pageErrors: [],
      severeConsoleErrors: [],
      failedRequests: [],
      requests: ["http://127.0.0.1:4173/"],
    })),
  );
}

test("exact-set comparison rejects additions and omissions", () => {
  assert.deepEqual(compareExactSet(["b", "a"], ["a", "b"]), { ok: true, missing: [], extra: [] });
  assert.deepEqual(compareExactSet(["a", "c"], ["a", "b"]), {
    ok: false,
    missing: ["b"],
    extra: ["c"],
  });
});

test("repository context accepts the real branch and confirmed remote, but rejects stale or detached state", () => {
  const expected = {
    branch: "feature/phase-1b-task-19-final-delivery-acceptance",
    head: "678fdf6171d845866403cfb22634c14e90a8904c",
    remoteNames: ["origin"],
    remoteBranch: "feature/phase-1b-task-19-final-delivery-acceptance",
    remoteCommit: "6f02fa113e69b14e05ca5a8ea03d3c1769aa8da2",
  };
  assert.equal(evaluateRepositoryContext(expected).ok, true);
  assert.ok(
    evaluateRepositoryContext({
      ...expected,
      head: "38ef0608e6be8dc93e5678dfeacf580b96e84c7d",
    }).blockers.includes("HEAD_MISMATCH:38ef0608e6be8dc93e5678dfeacf580b96e84c7d"),
  );
  assert.ok(
    evaluateRepositoryContext({ ...expected, branch: "" }).blockers.includes(
      "BRANCH_MISMATCH:DETACHED",
    ),
  );
  assert.ok(
    evaluateRepositoryContext({ ...expected, remoteCommit: "0".repeat(40) }).blockers.includes(
      "REMOTE_TRACKING_COMMIT_MISMATCH:0000000000000000000000000000000000000000",
    ),
  );
  assert.ok(
    evaluateRepositoryContext({ ...expected, remoteNames: ["upstream"] }).blockers.includes(
      "REMOTE_NAMES_MISMATCH:upstream",
    ),
  );
});

test("protected input validation rejects an out-of-scope or malformed input", () => {
  const expectedMetadata = [
    { relativePath: "a.txt", type: "file", size: 1, mtimeMs: 10 },
    { relativePath: "b.txt", type: "file", size: 2, mtimeMs: 20 },
  ];
  const records = expectedMetadata.map((metadata) => ({ ...metadata, sha256: "A".repeat(64) }));
  assert.equal(
    evaluateProtectedInputs({ expectedPaths: ["a.txt", "b.txt"], expectedMetadata, records }).ok,
    true,
  );
  const result = evaluateProtectedInputs({
    expectedPaths: ["a.txt", "b.txt"],
    expectedMetadata,
    records: [...records, { relativePath: "outside.txt", type: "file", size: 1, mtimeMs: 10 }],
  });
  assert.ok(result.blockers.includes("PROTECTED_INPUT_UNEXPECTED:outside.txt"));
  assert.ok(result.blockers.includes("PROTECTED_SHA_INVALID:outside.txt"));
});

test("untracked boundary allows only exact declared permanent outputs", () => {
  const baseline = ["existing.txt"];
  const permanent = [
    "docs/reviews/PHASE_1B_TASK_19_FINAL_DELIVERY_REVIEW.md",
    "artifacts/final-delivery/task19/suite-evidence.json",
    "artifacts/final-delivery/task19/browser-evidence.json",
    "artifacts/final-delivery/task19/install-upgrade-rollback.json",
    "artifacts/final-delivery/task19/performance-smoke.json",
    "artifacts/final-delivery/task19/release-verifier-report.json",
    "SHA256SUMS_PHASE_1B_TASK_19.txt",
    "artifacts/release-package/student-care-platform-phase1b-v0.1-final-delivery-v1.0.zip",
  ];

  assert.equal(
    evaluateUntrackedBoundary([...baseline, permanent[0]], baseline, permanent).ok,
    true,
  );
  assert.equal(
    evaluateUntrackedBoundary([...baseline, ...permanent], baseline, permanent).ok,
    true,
  );

  const normalizedSeparator = evaluateUntrackedBoundary(
    [...baseline, "artifacts\\final-delivery\\task19\\suite-evidence.json"],
    baseline,
    permanent,
  );
  assert.equal(normalizedSeparator.ok, true);

  const extra = evaluateUntrackedBoundary(
    [...baseline, ...permanent, "artifacts/final-delivery/task19/README.txt"],
    baseline,
    permanent,
  );
  assert.equal(extra.ok, false);
  assert.ok(
    extra.blockers.includes("UNTRACKED_PATH_ADDED:artifacts/final-delivery/task19/README.txt"),
  );

  const ninth = evaluateUntrackedBoundary(
    [...baseline, ...permanent, "artifacts/release-package/unregistered.zip"],
    baseline,
    permanent,
  );
  assert.equal(ninth.ok, false);
  assert.ok(
    ninth.blockers.includes("UNTRACKED_PATH_ADDED:artifacts/release-package/unregistered.zip"),
  );

  const automationOutput = evaluateUntrackedBoundary(
    [...baseline, ".playwright-mcp/console.log"],
    baseline,
    permanent,
  );
  assert.equal(automationOutput.ok, false);
  assert.ok(automationOutput.blockers.includes("UNTRACKED_PATH_ADDED:.playwright-mcp/console.log"));

  const unregisteredTemporaryOutput = evaluateUntrackedBoundary(
    [...baseline, "artifacts/task-19/tmp/unregistered.json"],
    baseline,
    permanent,
  );
  assert.equal(unregisteredTemporaryOutput.ok, false);
  assert.ok(
    unregisteredTemporaryOutput.blockers.includes(
      "UNTRACKED_PATH_ADDED:artifacts/task-19/tmp/unregistered.json",
    ),
  );
});

test("untracked boundary rejects traversal, absolute, and non-canonical permanent paths", () => {
  const baseline = ["existing.txt"];
  const permanent = ["artifacts/final-delivery/task19/suite-evidence.json"];
  for (const unsafe of [
    "artifacts/final-delivery/task19/../outside.json",
    "C:/outside.json",
    "ARTIFACTS/final-delivery/task19/suite-evidence.json",
  ]) {
    const result = evaluateUntrackedBoundary([...baseline, unsafe], baseline, permanent);
    assert.equal(result.ok, false, unsafe);
  }
});

test("browser evidence requires every route and viewport and rejects unsafe requests", () => {
  assert.deepEqual(evaluateBrowserEvidence({ cases: browserCases() }), { ok: true, blockers: [] });
  const unsafe = browserCases().slice(1);
  unsafe[0].requests.push("https://example.com/");
  const result = evaluateBrowserEvidence({ cases: unsafe });
  assert.equal(result.ok, false);
  assert.ok(result.blockers.some((item) => item.startsWith("BROWSER_CASE_MISSING:")));
  assert.ok(result.blockers.some((item) => item.startsWith("EXTERNAL_REQUEST:")));
});

test("suite and security evidence fail closed", () => {
  const suites = evaluateSuiteEvidence({
    commands: [
      { id: "focused-current", exitCode: 0 },
      { id: "focused-rollback", exitCode: 0 },
    ],
    requiredCommandIds: ["focused-current", "focused-rollback"],
  });
  assert.deepEqual(suites, { ok: true, blockers: [] });
  assert.equal(
    evaluateSecurityEvidence({
      tenantBoundary: true,
      campusBoundary: true,
      permissionDenials: true,
      auditExactlyOnce: true,
      auditRollbackZero: true,
      minorDataSyntheticOnly: true,
      externalRequests: [],
    }).ok,
    true,
  );
  assert.equal(evaluateSecurityEvidence({ tenantBoundary: false }).ok, false);
});

test("performance evidence requires measured non-negative fields without SLA claims", () => {
  assert.equal(
    evaluatePerformanceEvidence({
      smokeOnly: true,
      slaClaimed: false,
      measurements: [{ name: "visitor", durationMs: 1.25, errors: 0 }],
    }).ok,
    true,
  );
  assert.equal(evaluatePerformanceEvidence({ smokeOnly: true, measurements: [] }).ok, false);
  assert.equal(
    evaluatePerformanceEvidence({
      smokeOnly: true,
      slaClaimed: true,
      measurements: [{ name: "x", durationMs: 1, errors: 0 }],
    }).ok,
    false,
  );
});

test("detached manifest rejects self references and malformed lines", () => {
  const valid = `${"A".repeat(64)}  a.txt\n${"B".repeat(64)}  nested/b.txt\n`;
  assert.equal(
    parseDetachedManifest(Buffer.from(valid), "SHA256SUMS_PHASE_1B_TASK_19.txt").ok,
    true,
  );
  assert.equal(
    parseDetachedManifest(
      Buffer.from(`${"A".repeat(64)}  SHA256SUMS_PHASE_1B_TASK_19.txt\n`),
      "SHA256SUMS_PHASE_1B_TASK_19.txt",
    ).ok,
    false,
  );
  assert.equal(parseDetachedManifest(Buffer.from("bad\n"), "manifest.txt").ok, false);
});

test("deterministic ZIP is stored, fixed-time, UTF-8, CRC checked, and byte stable", () => {
  const members = [
    { name: "a.txt", bytes: Buffer.from("alpha\n") },
    { name: "nested/测试.txt", bytes: Buffer.from("beta\n") },
  ];
  const first = buildDeterministicZip(members);
  const second = buildDeterministicZip([...members].reverse());
  assert.deepEqual(first, second);
  const parsed = parseZip(first);
  assert.equal(parsed.ok, true);
  assert.deepEqual(
    parsed.members.map((member) => member.name),
    ["a.txt", "nested/测试.txt"],
  );
  assert.equal(validateZip(first, members).ok, true);
  const corrupted = Buffer.from(first);
  corrupted[corrupted.indexOf(Buffer.from("alpha\n"))] ^= 0xff;
  assert.equal(validateZip(corrupted, members).ok, false);
  assert.doesNotThrow(() => validateZip(first.subarray(0, first.length - 3), members));
  assert.equal(validateZip(first.subarray(0, first.length - 3), members).ok, false);
});

test("historical Task 06 and Task 18 gaps stay explicit and cannot become historical PASS", () => {
  const accepted = evaluateHistoricalEvidence({
    task06: {
      TASK06_HISTORICAL_EVIDENCE: "UNAVAILABLE",
      OWNER_ACCEPTED_HISTORICAL_EXCEPTION: "YES",
      CURRENT_EQUIVALENT_PACKAGE_BOUNDARY: "PASS_SUPPLEMENTARY_ONLY",
      CURRENT_EQUIVALENT_CANNOT_REPLACE_HISTORICAL_EVIDENCE: true,
    },
    task18: {
      exitCode: 1,
      TASK18_HISTORICAL_LIFECYCLE_EVIDENCE: "UNAVAILABLE",
      OWNER_ACCEPTED_HISTORICAL_EXCEPTION: "YES",
      CURRENT_EQUIVALENT_LIFECYCLE: "PASS_SUPPLEMENTARY_ONLY",
      failure: { blocker: "CHECKPOINT_UNTRACKED_COUNT_MISMATCH:0" },
    },
  });
  assert.equal(accepted.ok, true);
  assert.equal(accepted.classification, "HISTORICAL_EVIDENCE_UNAVAILABLE");
  assert.equal(accepted.currentEquivalentCannotReplaceHistoricalEvidence, true);
  assert.equal(accepted.task18.classification, "HISTORICAL_EVIDENCE_UNAVAILABLE");

  const rejected = evaluateHistoricalEvidence({
    task06: {
      TASK06_HISTORICAL_EVIDENCE: "UNAVAILABLE",
      OWNER_ACCEPTED_HISTORICAL_EXCEPTION: "NO",
    },
    task18: { exitCode: 0 },
  });
  assert.equal(rejected.ok, false);
  assert.ok(rejected.blockers.includes("TASK06_HISTORICAL_EXCEPTION_INVALID"));
  assert.equal(rejected.task18.classification, "HISTORICAL_EVIDENCE_AVAILABLE");
});

test("sha256 helper returns uppercase detached hashes", () => {
  assert.equal(
    sha256Bytes(Buffer.from("abc")),
    "BA7816BF8F01CFEA414140DE5DAE2223B00361A396177A9CB410FF61F20015AD",
  );
});
