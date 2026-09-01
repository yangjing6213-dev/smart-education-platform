/* global console, process */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_HEAD = "af9219def7fab5b68f7b9c611cc5a6fb0e1822c2";
const TARGET_BRANCH = "feature/phase-1b-task-04-identity-membership";

const STAGE_A_FILES = new Map([
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

const STAGE_B_ALLOWED = new Set([
  "PHASE_1B_TASK_04_CODEX_EXECUTION.md",
  "docs/project/PHASE_1B_TASK_04_PLAN.md",
  "packages/contracts/src/identity.ts",
  "packages/contracts/test/identity.test.ts",
  "packages/auth/package.json",
  "packages/auth/tsconfig.json",
  "packages/auth/src/index.ts",
  "packages/auth/src/identity.ts",
  "packages/auth/src/session.ts",
  "packages/auth/src/membership-policy.ts",
  "packages/auth/test/policy.test.ts",
  "apps/api/package.json",
  "apps/api/src/server.ts",
  "apps/api/src/plugins/auth.plugin.ts",
  "apps/api/src/routes/me.route.ts",
  "apps/api/src/routes/memberships.route.ts",
  "apps/api/test/task04.routes.test.ts",
  "package.json",
  "pnpm-lock.yaml",
  "packages/contracts/package.json",
  "packages/contracts/src/index.ts",
  "tests/contracts/package-boundaries.test.mjs",
  "tests/workspace/paths.test.mjs",
  "scripts/verify_task_04.mjs",
]);

const REQUIRED_IMPLEMENTATION = [...STAGE_B_ALLOWED];
const STAGE_C_PATHS = [
  "docs/reviews/PHASE_1B_TASK_04_REVIEW.md",
  "SHA256SUMS_PHASE_1B_TASK_04.txt",
  "artifacts/review-package/student-care-platform-phase1b-task-04-review-pack-v1.0.zip",
  "docs/project/PHASE_1B_TASK_04_ACCEPTANCE.md",
];

const failures = [];
const verified = [];

function absolute(relativePath) {
  return path.join(ROOT, relativePath);
}

function git(args) {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
}

function fail(check, detail) {
  failures.push(`${check}: ${detail}`);
}

function ok(check, detail) {
  verified.push(`${check}: ${detail}`);
}

export function sha256File(relativePath) {
  return createHash("sha256")
    .update(readFileSync(absolute(relativePath)))
    .digest("hex")
    .toUpperCase();
}

function sourceFiles(relativeDirectory) {
  const directory = absolute(relativeDirectory);
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = `${relativeDirectory}/${entry.name}`;
    if (entry.isDirectory()) return sourceFiles(relativePath);
    if (!entry.isFile() || !/\.(?:mjs|ts)$/.test(entry.name)) return [];
    return [{ path: relativePath, content: readFileSync(absolute(relativePath), "utf8") }];
  });
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

function checkGitAndBoundary() {
  const branch = git(["branch", "--show-current"]);
  const head = git(["rev-parse", "HEAD"]);
  if (branch !== TARGET_BRANCH) fail("git branch", branch);
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", SOURCE_HEAD, head], {
      cwd: ROOT,
      stdio: "ignore",
    });
  } catch {
    fail("git ancestry", `${head} does not descend from ${SOURCE_HEAD}`);
  }

  const changed = [
    ...git(["diff", "--name-only"]).split("\n"),
    ...git(["ls-files", "--others", "--exclude-standard"]).split("\n"),
  ].filter(Boolean);
  for (const relativePath of changed) {
    if (!STAGE_B_ALLOWED.has(relativePath)) fail("changed path boundary", relativePath);
  }
  if (git(["diff", "--cached", "--name-only"])) fail("git index", "index is not clean");
  if (git(["remote"])) fail("git remote", "remote must remain absent");
  if (!failures.some((entry) => /^(git|changed path boundary)/.test(entry))) {
    ok("git boundary", `${changed.length} Stage A/B paths only, clean index, no remote`);
  }
}

function checkFilesAndHashes() {
  for (const relativePath of REQUIRED_IMPLEMENTATION) {
    if (!existsSync(absolute(relativePath))) fail("workspace structure", `missing ${relativePath}`);
  }
  for (const [relativePath, expectedSha] of [...STAGE_A_FILES, ...frozenTask03Evidence]) {
    if (!existsSync(absolute(relativePath))) {
      fail("frozen SHA", `missing ${relativePath}`);
    } else if (sha256File(relativePath) !== expectedSha) {
      fail("frozen SHA", `${relativePath} differs`);
    }
  }
  for (const relativePath of STAGE_C_PATHS) {
    if (existsSync(absolute(relativePath))) fail("Stage C boundary", relativePath);
  }
  if (!failures.some((entry) => entry.startsWith("workspace structure"))) {
    ok("workspace structure", `${REQUIRED_IMPLEMENTATION.length} required Stage A/B paths exist`);
  }
  if (!failures.some((entry) => entry.startsWith("frozen SHA"))) {
    ok(
      "frozen SHA",
      `${STAGE_A_FILES.size} Stage A and ${frozenTask03Evidence.size} Task 03 anchors unchanged`,
    );
  }
  if (!failures.some((entry) => entry.startsWith("Stage C boundary"))) {
    ok("Stage C boundary", "review, manifest, ZIP, and acceptance remain absent");
  }
}

function checkImportsAndSafety() {
  const authSources = sourceFiles("packages/auth/src");
  for (const finding of findForbiddenImports(authSources, [
    "@student-care/validation",
    "@student-care/tenant",
    "fastify",
    "@student-care/api",
  ]))
    fail("auth package direction", finding);

  const taskFiles = [
    ...sourceFiles("packages/auth/src"),
    ...sourceFiles("packages/auth/test"),
    ...sourceFiles("apps/api/src/plugins"),
    ...sourceFiles("apps/api/src/routes"),
    ...sourceFiles("apps/api/test"),
  ];
  const secretPattern =
    /(-----BEGIN (?:RSA|EC|OPENSSH|PRIVATE) KEY-----|AKIA[0-9A-Z]{16}|(?:api[_-]?key|secret|password|cookie|token)\s*[:=]\s*["'][^"']{8,})/i;
  const personalPattern = /(?<!\d)1[3-9]\d{9}(?!\d)|(?<!\d)\d{17}[\dXx](?!\d)/;
  const networkPattern =
    /(?:fetch\s*\(|https?:\/\/|https?\.request|http\.request|axios|undici|net\.connect|dns\.lookup)/i;
  const servicePattern = /\.listen\s*\(/;
  for (const file of taskFiles) {
    if (secretPattern.test(file.content)) fail("secret scan", file.path);
    if (personalPattern.test(file.content)) fail("personal data scan", file.path);
    if (networkPattern.test(file.content)) fail("network boundary", file.path);
    if (servicePattern.test(file.content)) fail("service boundary", file.path);
  }
  if (
    !failures.some((entry) =>
      /^(auth package direction|secret scan|personal data scan|network boundary|service boundary)/.test(
        entry,
      ),
    )
  ) {
    ok(
      "security boundary",
      "package direction, synthetic data, secret, network, and service scans pass",
    );
  }
}

function checkLockfile() {
  const patch = git(["diff", "--unified=0", SOURCE_HEAD, "--", "pnpm-lock.yaml"]);
  const removed = patch
    .split("\n")
    .filter((line) => line.startsWith("-") && !line.startsWith("---"));
  const added = patch.split("\n").filter((line) => line.startsWith("+") && !line.startsWith("+++"));
  if (removed.length !== 0 || added.length !== 9)
    fail("lockfile", `removed=${removed.length}, added=${added.length}`);
  if (!patch.includes("link:../../packages/auth") || !patch.includes("link:../contracts")) {
    fail("lockfile", "expected auth workspace links are missing");
  }
  if (!failures.some((entry) => entry.startsWith("lockfile"))) {
    ok("lockfile", "9 additive workspace-link lines only; no external resolution change");
  }
}

function parseMode() {
  const modeArg = process.argv.find((argument) => argument.startsWith("--mode="));
  const mode = modeArg?.slice("--mode=".length);
  if (mode !== "structure" && mode !== "final-review") {
    throw new Error("mode must be structure or final-review");
  }
  return mode;
}

function main() {
  let mode;
  try {
    mode = parseMode();
  } catch (error) {
    console.error(`FAIL mode: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  checkGitAndBoundary();
  checkFilesAndHashes();
  checkImportsAndSafety();
  checkLockfile();
  for (const message of verified) console.log(`OK ${message}`);
  if (failures.length > 0) {
    for (const message of failures) console.error(`FAIL ${message}`);
    process.exitCode = 1;
    return;
  }
  console.log(
    mode === "structure" ? "TASK_04_STRUCTURE_VERIFY=PASS" : "TASK_04_FINAL_REVIEW_VERIFY=PASS",
  );
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) main();
