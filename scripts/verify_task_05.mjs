/* global console, process */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE_HEAD = "9dd4d54aecb92f41ca8c4fcd59f4e0f8cba4141f";
const TARGET_BRANCH = "feature/phase-1b-task-04-identity-membership";

const TASK_05_FILES = new Set([
  "apps/api/src/modules/content/content.service.ts",
  "apps/api/src/modules/content/content.repository.ts",
  "apps/api/src/routes/public-content.route.ts",
  "apps/api/src/modules/content/content.test.ts",
  "scripts/verify_task_05.mjs",
  "apps/api/src/server.ts",
  "apps/api/package.json",
  "packages/contracts/src/index.ts",
  "packages/contracts/package.json",
  "package.json",
  "pnpm-lock.yaml",
  "tests/contracts/package-boundaries.test.mjs",
  "tests/workspace/paths.test.mjs",
]);

const ACTIVE_GOVERNANCE_FILES = new Set([
  "docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V3.md",
  "AGENTS.md",
  "PLANS.md",
  "README.md",
  "docs/project/DECISION_BASELINE.md",
  "docs/project/SCOPE_AND_NON_SCOPE.md",
  "docs/plans/PHASE_1B_TASK_DEPENDENCY_GRAPH.md",
  "docs/plans/PHASE_1B_V0_1_IMPLEMENTATION_PLAN.md",
]);

const EXISTING_EVIDENCE_UNTRACKED = new Set([
  "SHA256SUMS_PHASE_1B_TASK_04.txt",
  "artifacts/review-package/student-care-platform-phase1b-task-04-review-pack-v1.0.zip",
  "docs/reviews/PHASE_1B_TASK_04_REVIEW.md",
  "SHA256SUMS_PHASE_1B_TASK_05.txt",
  "artifacts/review-package/student-care-platform-phase1b-task-05-review-pack-v1.0.zip",
  "docs/reviews/PHASE_1B_TASK_05_REVIEW.md",
]);

const REQUIRED_FILES = [...TASK_05_FILES];
const TASK_05_C2_FILES = ["docs/project/PHASE_1B_TASK_05_ACCEPTANCE.md"];

const FROZEN_HASHES = new Map([
  [
    "docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V2.md",
    "5C9FA63960F47AC3986C18D36069D395086A2E7C4FD23A56412D5232589299AA",
  ],
  [
    "docs/project/PHASE_1B_TASK_04_ACCEPTANCE.md",
    "113870DB0895145A183740F1B97D2F4102E3D6EEC4806A12A017C41C7CAE4202",
  ],
  [
    "PHASE_1B_TASK_04_CODEX_EXECUTION.md",
    "8CC94CD40573BEA3C3A75D3A7C51A49E4B187C4CA31D048C12293EDE3179EBE0",
  ],
  [
    "docs/project/PHASE_1B_TASK_04_PLAN.md",
    "352D49ACCC2C88EAF1CFA32B718564CA14CBCCC435C4DADCF847A166BFB3612C",
  ],
]);

export const frozenTask03Evidence = new Map([
  [
    "scripts/verify_task_03.mjs",
    "67C9D18CB99A880D9B7A624FCD800202B0EB6C96DED516ECD0A98ABA74638BE8",
  ],
  [
    "PHASE_1B_TASK_03_CODEX_EXECUTION.md",
    "5DACCFDABCE2EF597F852D0DAB00ACC2FC7388FB25D58551199586A4CE6152D9",
  ],
  [
    "docs/project/PHASE_1B_TASK_03_PLAN.md",
    "0E3D57C4FFFD82B0F4C8BF4FCA788A4B553A0BA74835E42248C9E2057284E304",
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
]);

const failures = [];

function absolute(relativePath) {
  return path.join(ROOT, relativePath);
}

function git(args) {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
}

export function sha256File(relativePath) {
  return createHash("sha256")
    .update(readFileSync(absolute(relativePath)))
    .digest("hex")
    .toUpperCase();
}

function fail(check, detail) {
  failures.push(`${check}: ${detail}`);
}

function moduleSpecifiers(content) {
  const specifiers = [];
  const pattern = /(?:\bfrom\s+|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*)["']([^"']+)["']/g;
  for (const match of content.matchAll(pattern)) specifiers.push(match[1]);
  return specifiers;
}

export function findForbiddenImports(files, forbiddenSpecifiers) {
  const findings = [];
  for (const file of files) {
    for (const specifier of moduleSpecifiers(file.content)) {
      for (const forbidden of forbiddenSpecifiers) {
        if (specifier === forbidden || specifier.startsWith(`${forbidden}/`)) {
          findings.push(`${file.path} -> ${forbidden}`);
        }
      }
    }
  }
  return findings;
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
    if (!TASK_05_FILES.has(relativePath) && !ACTIVE_GOVERNANCE_FILES.has(relativePath)) {
      fail("changed path boundary", relativePath);
    }
  }
  if (git(["diff", "--cached", "--name-only"])) fail("git index", "index is not clean");
  if (git(["remote"])) fail("git remote", "remote must remain absent");
}

function checkRequiredFiles() {
  for (const relativePath of REQUIRED_FILES) {
    if (!existsSync(absolute(relativePath))) fail("required file", relativePath);
  }
  for (const relativePath of TASK_05_C2_FILES) {
    if (existsSync(absolute(relativePath))) fail("Task 05 C1/C2 boundary", relativePath);
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
  for (const [relativePath, expectedSha] of frozenTask03Evidence) {
    if (!existsSync(absolute(relativePath))) {
      fail("Task 03 frozen hash", `missing ${relativePath}`);
    } else if (sha256File(relativePath) !== expectedSha) {
      fail("Task 03 frozen hash", `${relativePath} differs`);
    }
  }
}

function checkScripts() {
  const rootPackage = JSON.parse(readFileSync(absolute("package.json"), "utf8"));
  const apiPackage = JSON.parse(readFileSync(absolute("apps/api/package.json"), "utf8"));
  if (!rootPackage.scripts.verify.includes("scripts/verify_task_05.mjs --mode=structure")) {
    fail("root verify", "Task 05 structure verifier is not the active gate");
  }
  if (rootPackage.scripts.verify.includes("verify_task_04")) {
    fail("root verify", "historical Task 04 verifier remains in root gate");
  }
  if (!rootPackage.scripts["format:check"].includes("PHASE_1B_TASK_05_CODEX_EXECUTION.md")) {
    fail("root format", "Task 05 contract is not covered");
  }
  if (!rootPackage.scripts["format:check"].includes("scripts/verify_task_05.mjs")) {
    fail("root format", "Task 05 verifier is not covered");
  }
  if (!apiPackage.scripts.test.includes("dist/src/modules/content/content.test.js")) {
    fail("api test script", "Task 05 tests are not executed");
  }
  if (!apiPackage.scripts["test:coverage"].includes("content.service.js")) {
    fail("api coverage script", "content service is not covered");
  }
}

function sourceFiles() {
  return [
    "apps/api/src/modules/content/content.service.ts",
    "apps/api/src/modules/content/content.repository.ts",
    "apps/api/src/routes/public-content.route.ts",
    "apps/api/src/modules/content/content.test.ts",
    "apps/api/src/server.ts",
  ].map((relativePath) => ({
    path: relativePath,
    content: readFileSync(absolute(relativePath), "utf8"),
  }));
}

function checkSafety() {
  const files = sourceFiles();
  const forbiddenImports = findForbiddenImports(files, [
    "axios",
    "undici",
    "@student-care/api",
    "@student-care/validation",
  ]);
  for (const finding of forbiddenImports) fail("package direction", finding);
  const networkPattern =
    /(?:fetch\s*\(|https?:\/\/|https?\.request|http\.request|axios|undici|net\.connect|dns\.lookup)/i;
  const secretPattern =
    /(-----BEGIN (?:RSA|EC|OPENSSH|PRIVATE) KEY-----|AKIA[0-9A-Z]{16}|(?:api[_-]?key|secret|password|cookie|token)\s*[:=]\s*["'][^"']{8,})/i;
  const personalPattern = /(?<!\d)1[3-9]\d{9}(?!\d)|(?<!\d)\d{17}[\dXx](?!\d)/;
  for (const file of files) {
    if (networkPattern.test(file.content)) fail("network boundary", file.path);
    if (secretPattern.test(file.content)) fail("secret boundary", file.path);
    if (personalPattern.test(file.content)) fail("personal data boundary", file.path);
  }
}

function main() {
  const mode = process.argv
    .find((argument) => argument.startsWith("--mode="))
    ?.slice("--mode=".length);
  if (mode !== "structure" && mode !== "final-review") {
    console.error("FAIL mode: mode must be structure or final-review");
    process.exitCode = 1;
    return;
  }
  checkGitBoundary();
  checkRequiredFiles();
  checkFrozenHashes();
  checkScripts();
  checkSafety();
  if (failures.length > 0) {
    for (const failure of failures) console.error(`FAIL ${failure}`);
    process.exitCode = 1;
    return;
  }
  console.log(
    mode === "structure" ? "TASK_05_STRUCTURE_VERIFY=PASS" : "TASK_05_FINAL_REVIEW_VERIFY=PASS",
  );
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) main();
