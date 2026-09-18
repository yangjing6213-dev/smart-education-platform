import { execFileSync } from "node:child_process";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { TextDecoder } from "node:util";
import { fileURLToPath, URL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const governancePath = "docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V42.md";
const governanceSha256 = "7BECA819534A223D84C4D95FD117FC68C4B9CD4CDFC2E5345AF09E9547D188AB";
const expectedBranch = "feature/phase-1b-task-17-audit-logs";
export const task18BaselineHead = "b2bf3def53717d6c21e1c3f1125eb161b0d82608";
const expectedLockBlob = "2b0309badd8c972a61213bb0e7a222625eb305a2";
const protectedUntrackedCount = 71;

const controlFiles = ["AGENTS.md", "PLANS.md"];
const task18Files = [
  "tests/e2e/visitor.spec.ts",
  "tests/e2e/staff.spec.ts",
  "tests/e2e/learning.spec.ts",
  "tests/security/isolation.spec.ts",
  "tests/release/acceptance.spec.ts",
  "scripts/verify-release.mjs",
];
const task18WriteSet = [...controlFiles, ...task18Files];
const requiredRoutes = [
  "/web/visitor/home",
  "/web/staff/workbench",
  "/mini/staff/workbench",
  "/flow/ai-learning-assistant",
  "/flow/ai-teacher-summary",
];
const requiredViewports = ["desktop-1440x1024", "mobile-390x844", "small-mobile-320x568"];
const requiredSuites = [
  "focused",
  "regression",
  "typecheck",
  "lint",
  "format",
  "build",
  "diffChecks",
];

function git(...args) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
  }).trimEnd();
}

function normalizePath(value) {
  return value.replaceAll("\\", "/");
}

function lines(value) {
  return value.split(/\r?\n/u).filter(Boolean).map(normalizePath);
}

function unique(values) {
  return [...new Set(values)];
}

function sortedPaths(values) {
  return unique(values.map(normalizePath)).sort();
}

function samePathSet(actual, expected) {
  return JSON.stringify(sortedPaths(actual)) === JSON.stringify(sortedPaths(expected));
}

function pathSetBlocker(name, paths) {
  return `${name}:${sortedPaths(paths).join(",")}`;
}

function isGitAncestor(ancestor, descendant) {
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", ancestor, descendant], {
      cwd: root,
      stdio: "ignore",
      windowsHide: true,
    });
    return true;
  } catch {
    return false;
  }
}

export function evaluateTask18RepositoryLifecycle(snapshot) {
  const blockers = [];
  const changedTracked = sortedPaths(snapshot?.changedTracked ?? []);
  const staged = sortedPaths(snapshot?.staged ?? []);
  const committedPaths = sortedPaths(snapshot?.committedPaths ?? []);
  const trackedTask18Files = sortedPaths(snapshot?.trackedTask18Files ?? []);
  const untrackedTask18Files = sortedPaths(snapshot?.untrackedTask18Files ?? []);

  if (staged.length !== 0) blockers.push(pathSetBlocker("INDEX_NOT_CLEAN", staged));

  if (snapshot?.head === task18BaselineHead) {
    if (!samePathSet(changedTracked, controlFiles)) {
      blockers.push(pathSetBlocker("DEVELOPMENT_TRACKED_DIFF_MISMATCH", changedTracked));
    }
    if (committedPaths.length !== 0) {
      blockers.push(pathSetBlocker("DEVELOPMENT_COMMITTED_DIFF_PRESENT", committedPaths));
    }
    if (trackedTask18Files.length !== 0) blockers.push("DEVELOPMENT_TASK18_FILES_TRACKED");
    if (!samePathSet(untrackedTask18Files, task18Files)) {
      blockers.push(pathSetBlocker("DEVELOPMENT_TASK18_UNTRACKED_MISMATCH", untrackedTask18Files));
    }
    if (snapshot?.untrackedCount !== protectedUntrackedCount + task18Files.length) {
      blockers.push(`DEVELOPMENT_UNTRACKED_COUNT_MISMATCH:${snapshot?.untrackedCount}`);
    }

    return blockers.length === 0
      ? { status: "PASS", state: "DEVELOPMENT_PRE_CHECKPOINT", blockers: [] }
      : { status: "BLOCKED", state: "BLOCKED", blockers: unique(blockers) };
  }

  if (snapshot?.baselineIsAncestor !== true) {
    blockers.push(`HEAD_NOT_BASELINE_DESCENDANT:${snapshot?.head ?? "UNKNOWN"}`);
    return { status: "BLOCKED", state: "BLOCKED", blockers: unique(blockers) };
  }

  if (changedTracked.length !== 0) {
    blockers.push(pathSetBlocker("CHECKPOINT_WORKTREE_NOT_CLEAN", changedTracked));
  }
  if (!samePathSet(committedPaths, task18WriteSet)) {
    blockers.push(pathSetBlocker("CHECKPOINT_WRITE_SET_MISMATCH", committedPaths));
  }
  if (!samePathSet(trackedTask18Files, task18Files)) {
    blockers.push(pathSetBlocker("CHECKPOINT_TASK18_TRACKING_MISMATCH", trackedTask18Files));
  }
  if (untrackedTask18Files.length !== 0) {
    blockers.push(pathSetBlocker("CHECKPOINT_TASK18_FILES_UNTRACKED", untrackedTask18Files));
  }
  if (snapshot?.untrackedCount !== protectedUntrackedCount) {
    blockers.push(`CHECKPOINT_UNTRACKED_COUNT_MISMATCH:${snapshot?.untrackedCount}`);
  }

  return blockers.length === 0
    ? { status: "PASS", state: "CLEAN_TASK18_CHECKPOINT", blockers: [] }
    : { status: "BLOCKED", state: "BLOCKED", blockers: unique(blockers) };
}

function inspectTextFile(relativePath) {
  const blockers = [];
  const absolutePath = resolve(root, relativePath);
  if (!existsSync(absolutePath)) {
    return { blockers: [`FILE_MISSING:${relativePath}`] };
  }

  const bytes = readFileSync(absolutePath);
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    blockers.push(`UTF8_BOM_PRESENT:${relativePath}`);
  }
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    blockers.push(`UTF8_INVALID:${relativePath}`);
  }
  if (bytes.includes(0x0d)) blockers.push(`NON_LF_LINE_ENDING:${relativePath}`);
  if (bytes.length === 0 || bytes.at(-1) !== 0x0a || (bytes.length > 1 && bytes.at(-2) === 0x0a)) {
    blockers.push(`TRAILING_LF_COUNT_INVALID:${relativePath}`);
  }
  return { blockers };
}

function isLocalRequest(value) {
  try {
    const url = new URL(value);
    if (url.protocol === "data:" || url.protocol === "about:") return true;
    if (url.protocol === "blob:") return isLocalRequest(url.pathname);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      ["127.0.0.1", "localhost", "::1"].includes(url.hostname)
    );
  } catch {
    return false;
  }
}

function parseJsonArgument(value, name) {
  if (!value) throw new Error(`${name}_MISSING`);
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  } catch {
    throw new Error(`${name}_INVALID`);
  }
}

function argumentsByName(argv) {
  return Object.fromEntries(
    argv.map((argument) => {
      const [name, ...value] = argument.replace(/^--/u, "").split("=");
      return [name, value.join("=")];
    }),
  );
}

function aggregateTask18Digest() {
  const hash = createHash("sha256");
  for (const relativePath of task18Files) {
    hash.update(`${relativePath}\0`, "utf8");
    hash.update(readFileSync(resolve(root, relativePath)));
    hash.update("\0", "utf8");
  }
  return hash.digest("hex").toUpperCase();
}

export function sha256Bytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex").toUpperCase();
}

export function verifyArtifactDigest(bytes, expectedSha256) {
  const actualSha256 = sha256Bytes(bytes);
  return { ok: actualSha256 === expectedSha256, actualSha256 };
}

export function evaluateLearningTrace(trace) {
  const blockers = [];
  if (trace?.attempted !== true) blockers.push("ATTEMPT_REQUIRED");
  if (JSON.stringify(trace?.hintLevels) !== JSON.stringify([0, 1, 2, 3])) {
    blockers.push("HINT_SEQUENCE_INVALID");
  }
  if (!Number.isInteger(trace?.consolidationCount) || trace.consolidationCount < 1) {
    blockers.push("CONSOLIDATION_REQUIRED");
  }
  if (trace?.summaryRecipient !== "teacher") blockers.push("SUMMARY_RECIPIENT_INVALID");
  if (trace?.role !== "teacher" && trace?.summaryBodyExposed === true) {
    blockers.push("TEACHER_SUMMARY_EXPOSED_TO_GUARDIAN");
  }
  return { ok: blockers.length === 0, blockers };
}

export function evaluateBrowserEvidence(evidence) {
  const blockers = [];
  const routes = Array.isArray(evidence?.routes) ? evidence.routes : [];

  for (const route of routes) {
    const identity = `${route?.route ?? "UNKNOWN"}:${route?.viewport ?? "UNKNOWN"}`;
    if (!requiredRoutes.includes(route?.route)) blockers.push(`UNEXPECTED_ROUTE:${identity}`);
    if (!requiredViewports.includes(route?.viewport)) {
      blockers.push(`UNEXPECTED_VIEWPORT:${identity}`);
    }
    if (typeof route?.heading !== "string" || route.heading.trim() === "") {
      blockers.push(`HEADING_MISSING:${identity}`);
    }
    if (!Number.isFinite(route?.durationMs) || route.durationMs < 0) {
      blockers.push(`SMOKE_DURATION_INVALID:${identity}`);
    }
    if (!Number.isFinite(route?.horizontalOverflowPx) || route.horizontalOverflowPx < 0) {
      blockers.push(`HORIZONTAL_OVERFLOW_EVIDENCE_INVALID:${identity}`);
    } else if (route.horizontalOverflowPx > 0) {
      blockers.push(`HORIZONTAL_OVERFLOW:${identity}:${route.horizontalOverflowPx}`);
    }
    for (const error of route?.pageErrors ?? []) blockers.push(`PAGE_ERROR:${identity}:${error}`);
    for (const error of route?.severeConsoleErrors ?? []) {
      blockers.push(`CONSOLE_ERROR:${identity}:${error}`);
    }
    for (const request of route?.failedRequests ?? []) {
      blockers.push(`FAILED_REQUEST:${identity}:${request}`);
    }
    for (const request of route?.requests ?? []) {
      if (!isLocalRequest(request)) blockers.push(`EXTERNAL_REQUEST:${identity}:${request}`);
    }
  }

  for (const route of requiredRoutes) {
    for (const viewport of requiredViewports) {
      if (!routes.some((entry) => entry?.route === route && entry?.viewport === viewport)) {
        blockers.push(`BROWSER_CASE_MISSING:${route}:${viewport}`);
      }
    }
  }

  const learning = evaluateLearningTrace(evidence?.learning);
  blockers.push(...learning.blockers.map((blocker) => `LEARNING:${blocker}`));
  return { ok: blockers.length === 0, blockers: unique(blockers) };
}

export function evaluateReleaseCandidate(candidate) {
  const blockers = [];
  for (const suite of requiredSuites) {
    if (candidate?.suites?.[suite] !== true) blockers.push(`SUITE_NOT_PASSED:${suite}`);
  }
  if (candidate?.browser?.ok !== true) {
    blockers.push(...(candidate?.browser?.blockers ?? ["BROWSER_EVIDENCE_MISSING"]));
  }
  if (!/^[0-9a-f]{40}$/iu.test(candidate?.rollbackTarget ?? "")) {
    blockers.push("ROLLBACK_TARGET_INVALID");
  }
  if (!/^[0-9a-f]{64}$/iu.test(candidate?.artifactDigest ?? "")) {
    blockers.push("ARTIFACT_DIGEST_INVALID");
  }
  if (candidate?.migrationId !== "NONE_NO_SCHEMA_CHANGE") {
    blockers.push("MIGRATION_DECLARATION_INVALID");
  }
  const uniqueBlockers = unique(blockers);
  return {
    status: uniqueBlockers.length === 0 ? "READY_PENDING_OWNER_REVIEW" : "BLOCKED",
    blockers: uniqueBlockers,
  };
}

export function inspectRepository() {
  const blockers = [];
  const branch = git("branch", "--show-current");
  const head = git("rev-parse", "HEAD");
  const remoteCount = lines(git("remote")).length;
  const changedTracked = lines(git("diff", "--name-only"));
  const staged = lines(git("diff", "--cached", "--name-only"));
  const untracked = git("ls-files", "--others", "--exclude-standard", "-z")
    .split("\0")
    .filter(Boolean)
    .map(normalizePath)
    .sort();
  const baselineIsAncestor = isGitAncestor(task18BaselineHead, head);
  const committedPaths =
    baselineIsAncestor && head !== task18BaselineHead
      ? lines(git("diff", "--name-only", task18BaselineHead, head))
      : [];
  const trackedTask18Files = lines(git("ls-files", "--", ...task18Files)).sort();
  const untrackedTask18Files = task18Files.filter((path) => untracked.includes(path)).sort();
  const lifecycle = evaluateTask18RepositoryLifecycle({
    head,
    baselineIsAncestor,
    changedTracked,
    staged,
    committedPaths,
    trackedTask18Files,
    untrackedTask18Files,
    untrackedCount: untracked.length,
  });

  if (branch !== expectedBranch) blockers.push(`BRANCH_MISMATCH:${branch || "DETACHED"}`);
  if (remoteCount !== 0) blockers.push(`REMOTE_PRESENT:${remoteCount}`);
  blockers.push(...lifecycle.blockers);

  const governanceAbsolutePath = resolve(root, governancePath);
  if (!existsSync(governanceAbsolutePath)) {
    blockers.push(`ACTIVE_GOVERNANCE_MISSING:${governancePath}`);
  } else {
    const actualSha256 = sha256Bytes(readFileSync(governanceAbsolutePath));
    if (actualSha256 !== governanceSha256) {
      blockers.push(`ACTIVE_GOVERNANCE_SHA_MISMATCH:${actualSha256}`);
    }
  }
  if (git("hash-object", "pnpm-lock.yaml") !== expectedLockBlob) {
    blockers.push("LOCKFILE_WORKTREE_BLOB_MISMATCH");
  }
  if (git("rev-parse", "HEAD:pnpm-lock.yaml") !== expectedLockBlob) {
    blockers.push("LOCKFILE_HEAD_BLOB_MISMATCH");
  }
  for (const version of ["V43", "V44"]) {
    const path = `docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_${version}.md`;
    if (existsSync(resolve(root, path))) blockers.push(`PARALLEL_GOVERNANCE_PRESENT:${path}`);
  }
  for (const path of task18WriteSet) {
    blockers.push(...inspectTextFile(path).blockers);
  }
  for (const path of controlFiles) {
    const text = readFileSync(resolve(root, path), "utf8");
    if (!text.includes("PHASE_1B_ACTIVE_TASK=TASK18")) {
      blockers.push(`ACTIVE_TASK_REFERENCE_MISSING:${path}`);
    }
    if (!text.includes("TASK18_AUTHORIZATION=GRANTED")) {
      blockers.push(`TASK18_AUTHORIZATION_MISSING:${path}`);
    }
    if (!text.includes(governanceSha256)) {
      blockers.push(`ACTIVE_GOVERNANCE_SHA_REFERENCE_MISSING:${path}`);
    }
  }

  return {
    blockers: unique(blockers),
    branch,
    head,
    baselineHead: task18BaselineHead,
    baselineIsAncestor,
    lifecycleState: lifecycle.state,
    remoteCount,
    changedTracked,
    staged,
    committedPaths,
    trackedTask18Files,
    untrackedCount: untracked.length,
    protectedUntrackedCount,
    task18Files: [...task18Files],
    task18Digest: task18Files.every((path) => existsSync(resolve(root, path)))
      ? aggregateTask18Digest()
      : null,
    governancePath,
    governanceSha256,
    lockBlob: expectedLockBlob,
  };
}

function runCli() {
  const args = argumentsByName(process.argv.slice(2));
  const mode = args.mode ?? "structure";
  const repository = inspectRepository();
  let output = {
    mode,
    status: repository.blockers.length === 0 ? "PASS" : "BLOCKED",
    repository,
    blockers: [...repository.blockers],
  };

  if (mode === "local-validation" || mode === "final") {
    try {
      const suites = parseJsonArgument(args["suite-evidence"], "SUITE_EVIDENCE");
      const browser =
        mode === "final"
          ? evaluateBrowserEvidence(parseJsonArgument(args["browser-evidence"], "BROWSER_EVIDENCE"))
          : { ok: true, blockers: [] };
      const release = evaluateReleaseCandidate({
        suites,
        browser,
        rollbackTarget: args["rollback-target"],
        artifactDigest: args["artifact-digest"],
        migrationId: args["migration-id"],
      });
      if (args["artifact-digest"] !== repository.task18Digest) {
        release.blockers.push("ARTIFACT_DIGEST_MISMATCH");
        release.status = "BLOCKED";
      }
      output = {
        ...output,
        status: output.status === "PASS" && release.status !== "BLOCKED" ? "PASS" : "BLOCKED",
        suites,
        browser,
        release,
        blockers: unique([...output.blockers, ...release.blockers]),
      };
    } catch (error) {
      output.status = "BLOCKED";
      output.blockers = unique([...output.blockers, error.message]);
    }
  } else if (mode !== "structure") {
    output.status = "BLOCKED";
    output.blockers.push(`MODE_INVALID:${mode}`);
  }

  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  process.exitCode = output.status === "PASS" ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli();
}
