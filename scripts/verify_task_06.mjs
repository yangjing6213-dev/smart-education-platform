/* global Buffer, console, process */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE_HEAD = "4db46c39d6a1f18517fe561a43b2207e8fa1dfde";
const TARGET_BRANCH = "feature/phase-1b-task-04-identity-membership";
const ACTIVE_AUTHORITY_PATH = "docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V5.md";
const ACTIVE_AUTHORITY_SHA256 = "BC8B2232F3203368BD712586464734614D0E56D062792AFA284F8794A50914DB";
const C1_MEMBER_ORDER_POLICY = "POSIX_RELATIVE_PATHS_CASEFOLDED_UNICODE_ORDINAL_ASCENDING";

const TASK_06_FILES = new Set([
  "AGENTS.md",
  "PLANS.md",
  "README.md",
  "docs/project/DECISION_BASELINE.md",
  "docs/project/SCOPE_AND_NON_SCOPE.md",
  "docs/plans/PHASE_1B_TASK_DEPENDENCY_GRAPH.md",
  "docs/plans/PHASE_1B_V0_1_IMPLEMENTATION_PLAN.md",
  "docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V5.md",
  "docs/reviews/PHASE_1B_TASK_06_REVIEW.md",
  "SHA256SUMS_PHASE_1B_TASK_06.txt",
  "artifacts/review-package/student-care-platform-phase1b-task-06-review-pack-v1.0.zip",
  "PHASE_1B_TASK_06_CODEX_EXECUTION.md",
  "docs/project/PHASE_1B_TASK_06_PLAN.md",
  "apps/api/src/modules/institution/institution.service.ts",
  "apps/api/src/modules/institution/institution.test.ts",
  "apps/api/src/routes/admin-institution.route.ts",
  "apps/api/src/server.ts",
  "apps/api/package.json",
  "packages/contracts/src/identity.ts",
  "packages/contracts/test/identity.test.ts",
  "packages/auth/src/identity.ts",
  "packages/auth/test/policy.test.ts",
  "apps/admin-web/package.json",
  "apps/admin-web/tsconfig.json",
  "apps/admin-web/index.html",
  "apps/admin-web/src/main.ts",
  "apps/admin-web/src/pages/home-content.tsx",
  "apps/admin-web/test/home-content.test.mjs",
  "scripts/verify_task_06.mjs",
  "package.json",
  "pnpm-lock.yaml",
  "tests/contracts/package-boundaries.test.mjs",
  "tests/workspace/paths.test.mjs",
]);

const EXISTING_EVIDENCE_UNTRACKED = new Set([
  "SHA256SUMS_PHASE_1B_TASK_04.txt",
  "artifacts/review-package/student-care-platform-phase1b-task-04-review-pack-v1.0.zip",
  "docs/reviews/PHASE_1B_TASK_04_REVIEW.md",
  "SHA256SUMS_PHASE_1B_TASK_05.txt",
  "artifacts/review-package/student-care-platform-phase1b-task-05-review-pack-v1.0.zip",
  "docs/reviews/PHASE_1B_TASK_05_REVIEW.md",
]);

const TASK_06_C1_C2_FILES = [
  "docs/reviews/PHASE_1B_TASK_06_REVIEW.md",
  "SHA256SUMS_PHASE_1B_TASK_06.txt",
  "artifacts/review-package/student-care-platform-phase1b-task-06-review-pack-v1.0.zip",
  "docs/project/PHASE_1B_TASK_06_ACCEPTANCE.md",
];

const C1_MEMBER_FILES = new Set([
  "PHASE_1B_TASK_06_CODEX_EXECUTION.md",
  "apps/admin-web/index.html",
  "apps/admin-web/package.json",
  "apps/admin-web/src/main.ts",
  "apps/admin-web/src/pages/home-content.tsx",
  "apps/admin-web/test/home-content.test.mjs",
  "apps/admin-web/tsconfig.json",
  "apps/api/package.json",
  "apps/api/src/modules/institution/institution.service.ts",
  "apps/api/src/modules/institution/institution.test.ts",
  "apps/api/src/routes/admin-institution.route.ts",
  "apps/api/src/server.ts",
  "docs/project/PHASE_1B_TASK_06_PLAN.md",
  "docs/reviews/PHASE_1B_TASK_06_REVIEW.md",
  "package.json",
  "packages/auth/test/policy.test.ts",
  "packages/contracts/src/identity.ts",
  "packages/contracts/test/identity.test.ts",
  "pnpm-lock.yaml",
  "scripts/verify_task_06.mjs",
  "tests/contracts/package-boundaries.test.mjs",
  "tests/workspace/paths.test.mjs",
]);

const FROZEN_HASHES = new Map([
  [ACTIVE_AUTHORITY_PATH, ACTIVE_AUTHORITY_SHA256],
  [
    "docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V4.md",
    "11FD81FB5E9738B36F7EB495424F9D4161F6F5172DFDBA564BE1D5F0FD88DB5E",
  ],
  [
    "docs/project/PHASE_1B_TASK_04_ACCEPTANCE.md",
    "113870DB0895145A183740F1B97D2F4102E3D6EEC4806A12A017C41C7CAE4202",
  ],
  [
    "docs/project/PHASE_1B_TASK_05_ACCEPTANCE.md",
    "640BCF9B2B5C33ED1499E1F5C35E58608872953DCF0059A33086312FC260ECDD",
  ],
  [
    "docs/reviews/PHASE_1B_TASK_05_REVIEW.md",
    "639A8F4671B244F305E692FC8179220012A546CEBED59942FC1AFA4572588201",
  ],
  [
    "SHA256SUMS_PHASE_1B_TASK_05.txt",
    "0DD423E6BD35AA836AD308FBE1C64156AB545E973F4BD3F7237BFCCE7F6E8064",
  ],
  [
    "artifacts/review-package/student-care-platform-phase1b-task-05-review-pack-v1.0.zip",
    "08B93005CCBC86D323357D77E16807183CD6DB310A72E78269C1DDFD35FD038B",
  ],
]);

export const frozenTask01To05Evidence = new Map([
  [
    "docs/project/PHASE_1B_TASK_01_ACCEPTANCE.md",
    "BA31CBA67F263AD30A62FF9999099917A43A5136757262360C20BDE54663264A",
  ],
  [
    "docs/reviews/PHASE_1B_TASK_01_REVIEW.md",
    "13BDB068F6478B16844636DEC48D3BC6CEFDE7DEC1698085ABF134A408AD12E2",
  ],
  [
    "SHA256SUMS_PHASE_1B_TASK_01.txt",
    "813D0BA33C5627E48CEBAC641771F01E7B86A169D584CFE12B828EC48CA9D346",
  ],
  [
    "artifacts/review-package/student-care-platform-phase1b-task-01-review-pack-v1.0.zip",
    "E5821FB7578EA37403B19FA39B8E68B2B781A6C606FD7A17B282C59270B3C846",
  ],
  [
    "docs/project/PHASE_1B_TASK_02_ACCEPTANCE.md",
    "62316AA2C94B5C5B3B52DA2E678799B2B20787589AA9C8E0D5FB6DBA239628DF",
  ],
  [
    "docs/reviews/PHASE_1B_TASK_02_REVIEW.md",
    "85F11CB9921360C5DB6AD51C210145C96A89ED9D1CBE435E34D1DFB67499864D",
  ],
  [
    "SHA256SUMS_PHASE_1B_TASK_02.txt",
    "8DBA59828E9F385F240311E4D221DA725C6CE4FEA304EF45EAA87868084ECC1B",
  ],
  [
    "artifacts/review-package/student-care-platform-phase1b-task-02-review-pack-v1.0.zip",
    "FB42ECCD371747D76A8D95CD3692081F392C1A6AE4662F355BEBEC1911966622",
  ],
  [
    "docs/project/PHASE_1B_TASK_03_ACCEPTANCE.md",
    "3C8BAF78637162748A414FFC8998FC1822F30E6BF967EF440FACDEBBAAE0BF33",
  ],
  [
    "docs/reviews/PHASE_1B_TASK_03_REVIEW.md",
    "C35BD9CDC478513DF63877F2A09AC40AE99AC68B6928E73DCC7209A87B6C53AD",
  ],
  [
    "SHA256SUMS_PHASE_1B_TASK_03.txt",
    "19EE5E8C695B6D220DC4D5C7F7AABE02EC17DE4D865CCCF2ABA0EB04CEC52BCD",
  ],
  [
    "artifacts/review-package/student-care-platform-phase1b-task-03-review-pack-v1.0.zip",
    "9FB4E25364DF06A464FC8A796D2DA86D705BDA33C1D6D8A5D8061073623FA337",
  ],
  [
    "docs/project/PHASE_1B_TASK_04_ACCEPTANCE.md",
    "113870DB0895145A183740F1B97D2F4102E3D6EEC4806A12A017C41C7CAE4202",
  ],
  [
    "docs/reviews/PHASE_1B_TASK_04_REVIEW.md",
    "A13AA54A5DC094B074D850688F653176CF4C9DD2827175C215C69E3E43D1DA49",
  ],
  [
    "SHA256SUMS_PHASE_1B_TASK_04.txt",
    "22431AF07EC3B0DA4AE3B035DE0D22D75366EC454E6415F7325350DF363445BA",
  ],
  [
    "artifacts/review-package/student-care-platform-phase1b-task-04-review-pack-v1.0.zip",
    "36021A980590885FD1D8DA7DD5C34B7ADAF606662A7A8FE10618A003A946F288",
  ],
  [
    "docs/project/PHASE_1B_TASK_05_ACCEPTANCE.md",
    "640BCF9B2B5C33ED1499E1F5C35E58608872953DCF0059A33086312FC260ECDD",
  ],
  [
    "docs/reviews/PHASE_1B_TASK_05_REVIEW.md",
    "639A8F4671B244F305E692FC8179220012A546CEBED59942FC1AFA4572588201",
  ],
  [
    "SHA256SUMS_PHASE_1B_TASK_05.txt",
    "0DD423E6BD35AA836AD308FBE1C64156AB545E973F4BD3F7237BFCCE7F6E8064",
  ],
  [
    "artifacts/review-package/student-care-platform-phase1b-task-05-review-pack-v1.0.zip",
    "08B93005CCBC86D323357D77E16807183CD6DB310A72E78269C1DDFD35FD038B",
  ],
]);

const TEXT_FILES = [...TASK_06_FILES, ...FROZEN_HASHES.keys()]
  .filter((relativePath, index, paths) => paths.indexOf(relativePath) === index)
  .filter((relativePath) => /\.(md|json|ts|tsx|mjs|html|yaml)$/.test(relativePath));

const failures = [];

function absolute(relativePath) {
  return path.join(ROOT, relativePath);
}

function git(args) {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
}

function gitRaw(args) {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" });
}

function sha256File(relativePath) {
  return createHash("sha256")
    .update(readFileSync(absolute(relativePath)))
    .digest("hex")
    .toUpperCase();
}

function fail(check, detail) {
  failures.push(`${check}: ${detail}`);
}

function changedPaths() {
  const tracked = git(["diff", "--name-only", BASE_HEAD]).split("\n").filter(Boolean);
  const untracked = git(["ls-files", "--others", "--exclude-standard"])
    .split("\n")
    .filter(Boolean)
    .filter((relativePath) => !EXISTING_EVIDENCE_UNTRACKED.has(relativePath));
  return [...new Set([...tracked, ...untracked])];
}

function checkGitBoundary() {
  if (git(["branch", "--show-current"]) !== TARGET_BRANCH) {
    fail("git branch", git(["branch", "--show-current"]));
  }
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", BASE_HEAD, "HEAD"], {
      cwd: ROOT,
      stdio: "ignore",
    });
  } catch {
    fail("git ancestry", `HEAD does not descend from ${BASE_HEAD}`);
  }
  for (const relativePath of changedPaths()) {
    if (!TASK_06_FILES.has(relativePath)) fail("changed path boundary", relativePath);
  }
  if (git(["diff", "--cached", "--name-only"])) fail("git index", "index is not clean");
  if (git(["remote"])) fail("git remote", "remote must remain absent");
  if (git(["branch", "--list", "*task-06*"])) fail("task branch", "Task 06 branch exists");
  if (git(["worktree", "list"]).toLowerCase().includes("task-06")) {
    fail("task worktree", "Task 06 worktree exists");
  }
}

function checkRequiredFiles() {
  for (const relativePath of TASK_06_FILES) {
    if (relativePath === "pnpm-lock.yaml") continue;
    if (!existsSync(absolute(relativePath))) fail("required file", relativePath);
  }
  for (const relativePath of TASK_06_C1_C2_FILES.slice(0, 3)) {
    if (!existsSync(absolute(relativePath))) fail("Task 06 C1 required file", relativePath);
  }
  if (existsSync(absolute(TASK_06_C1_C2_FILES[3]))) {
    fail("Task 06 C2 boundary", TASK_06_C1_C2_FILES[3]);
  }
}

function checkFrozenHashes() {
  for (const [relativePath, expectedSha] of FROZEN_HASHES) {
    if (!existsSync(absolute(relativePath))) {
      fail("frozen hash", `missing ${relativePath}`);
    } else if (sha256File(relativePath) !== expectedSha) {
      fail("frozen hash", `${relativePath} differs`);
    }
  }
  for (const [relativePath, expectedSha] of frozenTask01To05Evidence) {
    if (!existsSync(absolute(relativePath))) {
      fail("Task 01-05 frozen evidence", `missing ${relativePath}`);
    } else if (sha256File(relativePath) !== expectedSha) {
      fail("Task 01-05 frozen evidence", `${relativePath} differs`);
    }
  }
}

function checkC1Package() {
  const manifestPath = absolute("SHA256SUMS_PHASE_1B_TASK_06.txt");
  const manifest = readFileSync(manifestPath, "utf8");
  const rows = manifest.trimEnd().split("\n");
  if (rows.length !== 22) fail("C1 manifest", `expected 22 rows, got ${rows.length}`);
  const names = rows.map((row) => row.split("  ")[1]);
  const sorted = [...names].sort((left, right) => {
    const leftKey = left.toLocaleLowerCase("en-US");
    const rightKey = right.toLocaleLowerCase("en-US");
    return leftKey < rightKey
      ? -1
      : leftKey > rightKey
        ? 1
        : left < right
          ? -1
          : left > right
            ? 1
            : 0;
  });
  if (JSON.stringify(names) !== JSON.stringify(sorted))
    fail("C1 manifest", `member order is not ${C1_MEMBER_ORDER_POLICY}`);
  if (names[0] !== "apps/admin-web/index.html")
    fail("C1 manifest", "first member is not apps/admin-web/index.html");
  if (new Set(names).size !== names.length) fail("C1 manifest", "duplicate member");
  for (const name of names) {
    if (!C1_MEMBER_FILES.has(name)) fail("C1 manifest", `unapproved member ${name}`);
    if (!existsSync(absolute(name))) fail("C1 manifest", `missing member ${name}`);
    if (sha256File(name) !== rows.find((row) => row.endsWith(`  ${name}`)).split("  ")[0]) {
      fail("C1 manifest", `member hash mismatch ${name}`);
    }
  }
  if (names.includes("SHA256SUMS_PHASE_1B_TASK_06.txt"))
    fail("C1 manifest", "manifest is not detached");
  if (names.includes("docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V5.md"))
    fail("C1 manifest", "V5 must be excluded");
  const zip = readFileSync(
    absolute("artifacts/review-package/student-care-platform-phase1b-task-06-review-pack-v1.0.zip"),
  );
  if (zip.length === 0) fail("C1 ZIP", "ZIP is empty");
}

function checkTextEncoding() {
  for (const relativePath of TEXT_FILES) {
    if (!existsSync(absolute(relativePath))) continue;
    const bytes = readFileSync(absolute(relativePath));
    if (bytes.length >= 3 && bytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))) {
      fail("encoding", `${relativePath} has BOM`);
    }
    const text = bytes.toString("utf8");
    if (!Buffer.from(text, "utf8").equals(bytes)) fail("encoding", `${relativePath} is not UTF-8`);
    if (text.includes("\r")) fail("line ending", `${relativePath} contains CR`);
    if (!text.endsWith("\n") || text.endsWith("\n\n")) {
      fail("trailing LF", `${relativePath} must have exactly one trailing LF`);
    }
  }
}

function checkLockfileBoundary() {
  const before = gitRaw(["show", `${BASE_HEAD}:pnpm-lock.yaml`]);
  const expected = before.replace("  apps/api:\n", "  apps/admin-web: {}\n\n  apps/api:\n");
  const current = readFileSync(absolute("pnpm-lock.yaml"), "utf8");
  if (current !== expected)
    fail("lockfile boundary", "expected only the admin-web workspace importer");
}

function checkSafety() {
  const sourceFiles = [
    "apps/api/src/modules/institution/institution.service.ts",
    "apps/api/src/routes/admin-institution.route.ts",
    "apps/api/src/server.ts",
    "apps/admin-web/src/main.ts",
    "apps/admin-web/src/pages/home-content.tsx",
  ];
  const networkPattern =
    /(?:fetch\s*\(|https?:\/\/|https?\.request|http\.request|axios|undici|net\.connect|dns\.lookup)/i;
  const secretPattern =
    /(-----BEGIN (?:RSA|EC|OPENSSH|PRIVATE) KEY-----|AKIA[0-9A-Z]{16}|(?:api[_-]?key|secret|password|cookie|token)\s*[:=]\s*["'][^"']{8,})/i;
  const personalPattern = /(?<!\d)1[3-9]\d{9}(?!\d)|(?<!\d)\d{17}[\dXx](?!\d)/;
  for (const relativePath of sourceFiles) {
    const content = readFileSync(absolute(relativePath), "utf8");
    if (networkPattern.test(content)) fail("network boundary", relativePath);
    if (secretPattern.test(content)) fail("secret boundary", relativePath);
    if (personalPattern.test(content)) fail("personal data boundary", relativePath);
  }
  const adminPackage = JSON.parse(readFileSync(absolute("apps/admin-web/package.json"), "utf8"));
  if (adminPackage.dependencies !== undefined || adminPackage.devDependencies !== undefined) {
    fail("admin-web dependency boundary", "no dependencies are allowed");
  }
}

function main() {
  const mode = process.argv.find((argument) => argument.startsWith("--mode="))?.slice(7);
  if (mode !== "structure" && mode !== "final-review") {
    console.error("FAIL mode: mode must be structure or final-review");
    process.exitCode = 1;
    return;
  }
  checkGitBoundary();
  checkRequiredFiles();
  checkFrozenHashes();
  checkTextEncoding();
  checkLockfileBoundary();
  checkSafety();
  checkC1Package();
  if (failures.length > 0) {
    for (const failure of failures) console.error(`FAIL ${failure}`);
    process.exitCode = 1;
    return;
  }
  console.log(`TASK06_MEMBER_ORDER_POLICY=${C1_MEMBER_ORDER_POLICY}`);
  console.log(
    mode === "structure" ? "TASK_06_STRUCTURE_VERIFY=PASS" : "TASK_06_FINAL_REVIEW_VERIFY=PASS",
  );
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) main();
