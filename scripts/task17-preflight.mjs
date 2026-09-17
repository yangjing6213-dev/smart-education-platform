import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const governancePath = "docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V42.md";
const governanceSha256 = "F2C77C7A1EEE626619CB19DDD994D2D373D59C54CBB939260E7C3B7C77B52D5A";
const expectedBranch = "feature/phase-1b-task-17-audit-logs";
const task17Whitelist = new Set([
  "AGENTS.md",
  "PLANS.md",
  ".gitattributes",
  "scripts/task17-preflight.mjs",
  "apps/api/src/server.ts",
  "apps/api/src/modules/audit/audit.test.ts",
  "apps/api/src/modules/content/content.service.ts",
  "apps/api/src/modules/files/file.service.ts",
  "apps/api/src/modules/partner-links/partner-link.service.ts",
  "apps/api/src/modules/institution/institution.service.ts",
  "apps/api/src/routes/admin-institution.route.ts",
  "apps/api/src/routes/file-intent.route.ts",
]);

function git(...args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trimEnd();
}

function occurrences(text, value) {
  return text.split(value).length - 1;
}

function classifyUntracked(path) {
  if (
    /^(PHASE_1B_TASK_\d+_CODEX_EXECUTION\.md|docs\/project\/PHASE_1B_TASK_\d+_(PLAN|ACCEPTANCE)\.md)$/.test(
      path,
    )
  )
    return "TASK_DOCUMENT";
  if (/^SHA256SUMS_PHASE_1B_TASK_\d+\.txt$/.test(path)) return "SHA_MANIFEST";
  if (/^apps\/mini-program\//.test(path)) return "MINI_PROGRAM_EVIDENCE";
  if (/^apps\/user-web\//.test(path)) return "USER_WEB_EVIDENCE";
  if (/^artifacts\/review-package\/.*\.zip$/.test(path)) return "REVIEW_ZIP";
  if (/^docs\/project\/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V\d+\.md$/.test(path))
    return "HISTORICAL_GOVERNANCE";
  if (/^docs\/reviews\/PHASE_1B_TASK_\d+_REVIEW\.md$/.test(path)) return "REVIEW_EVIDENCE";
  return "UNKNOWN";
}

const blockers = [];
const warnings = [];
const governanceAbsolutePath = resolve(root, governancePath);
if (!existsSync(governanceAbsolutePath)) {
  blockers.push(`ACTIVE_GOVERNANCE_MISSING:${governancePath}`);
} else {
  const actualSha = createHash("sha256")
    .update(readFileSync(governanceAbsolutePath))
    .digest("hex")
    .toUpperCase();
  if (actualSha !== governanceSha256) {
    blockers.push(`ACTIVE_GOVERNANCE_SHA_MISMATCH:${actualSha}`);
  }
}

const branch = git("branch", "--show-current");
if (branch !== expectedBranch) blockers.push(`TASK_IDENTITY_MISMATCH:${branch}`);

for (const path of ["AGENTS.md", "PLANS.md"]) {
  const text = readFileSync(resolve(root, path), "utf8");
  if (occurrences(text, governancePath) !== 1) {
    blockers.push(`ACTIVE_GOVERNANCE_REFERENCE_COUNT:${path}`);
  }
  if (!text.includes("PHASE_1B_ACTIVE_TASK=TASK17")) {
    blockers.push(`ACTIVE_TASK_REFERENCE_MISSING:${path}`);
  }
}

for (const version of ["V43", "V44"]) {
  const path = `docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_${version}.md`;
  if (existsSync(resolve(root, path))) blockers.push(`PARALLEL_GOVERNANCE_PRESENT:${path}`);
}

const statusLines = git("status", "--porcelain=v1", "--untracked-files=all")
  .split(/\r?\n/u)
  .filter(Boolean);
const classifications = new Map();
for (const line of statusLines) {
  const code = line.slice(0, 2);
  const path = line.slice(3).replaceAll("\\", "/");
  let classification = "REPORTED_ONLY";
  if (task17Whitelist.has(path)) classification = "TASK17_ACTIVE_CHANGE";
  else if (code === "??") classification = classifyUntracked(path);
  classifications.set(classification, (classifications.get(classification) ?? 0) + 1);
  if (classification === "UNKNOWN" || classification === "REPORTED_ONLY") {
    warnings.push(`${classification}:${code}:${path}`);
  }
}

const output = {
  status: blockers.length === 0 ? "PASS" : "BLOCKED",
  execution_mode: "DEVELOPMENT_MODE",
  active_governance: "V42",
  governance_sha256: governanceSha256,
  active_task: "TASK17",
  branch,
  worktree_status_count: statusLines.length,
  classifications: Object.fromEntries([...classifications].sort()),
  unknown_or_reported_only_blocks_development: false,
  warnings,
  blockers,
};

process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
process.exitCode = blockers.length === 0 ? 0 : 1;
