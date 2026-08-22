/* global Buffer, console, process */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { inflateRawSync } from "node:zlib";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_HEAD = "badc119aa62835fae9fd45da089a19dafd063ddd";
const TARGET_BRANCH = "feature/phase-1b-task-02-shared-contracts-validation";
const COMMIT_SUBJECT = "feat: add shared v0.1 contracts and validation";
const CONTRACT = "PHASE_1B_TASK_02_CODEX_EXECUTION.md";
const CONTRACT_SHA = "0292269A8264F7217014C629FFA53133E1818B0483DC90ECA275B8817C461A57";
const TASK_01_ZIP =
  "artifacts/review-package/student-care-platform-phase1b-task-01-review-pack-v1.0.zip";
const TASK_01_ZIP_SHA = "E5821FB7578EA37403B19FA39B8E68B2B781A6C606FD7A17B282C59270B3C846";
const TASK_01_MEMBER_SHA = "FDEB4361570446DD359A8032E4B581591EBB652D838D027F5BC337CEF21FCFAB";
const REVIEW_ZIP =
  "artifacts/review-package/student-care-platform-phase1b-task-02-review-pack-v1.0.zip";
const MANIFEST = "SHA256SUMS_PHASE_1B_TASK_02.txt";
const MEMBER_LIST_SHA = "2F95991DD733B355EBAA212E7BEF904DD7DE412B2B09AC374FEC8A3DAE458A8A";
export const EXPECTED_MEMBERS = [
  ".prettierignore",
  ".prettierrc.json",
  CONTRACT,
  "SHA256SUMS_PHASE_1B_TASK_01.txt",
  MANIFEST,
  "apps/api/package.json",
  "apps/api/src/health/health.route.ts",
  "apps/api/src/index.ts",
  "apps/api/src/server.ts",
  "apps/api/test/health.route.test.ts",
  "apps/api/tsconfig.json",
  "docs/architecture/API_CONTRACT_BASELINE.md",
  "docs/architecture/MODULE_BOUNDARIES_BASELINE.md",
  "docs/architecture/SECURITY_AND_PRIVACY_BASELINE.md",
  "docs/architecture/TEST_STRATEGY_BASELINE.md",
  "docs/contracts/V0_1_ACCEPTANCE_TRACEABILITY.md",
  "docs/contracts/V0_1_API_SCHEMA.json",
  "docs/contracts/V0_1_CONTENT_SCHEMA.json",
  "docs/contracts/V0_1_ERROR_CATALOG.md",
  "docs/contracts/V0_1_PERMISSION_MATRIX.md",
  "docs/plans/PHASE_1B_TASK_DEPENDENCY_GRAPH.md",
  "docs/plans/PHASE_1B_V0_1_IMPLEMENTATION_PLAN.md",
  "docs/project/PHASE_1B_RUNTIME_BASELINE_DECISION.md",
  "docs/project/PHASE_1B_TASK_01_ACCEPTANCE.md",
  "docs/project/PHASE_1B_TASK_02_PLAN.md",
  "docs/reviews/PHASE_1B_TASK_01_REVIEW.md",
  "docs/reviews/PHASE_1B_TASK_02_REVIEW.md",
  "eslint.config.mjs",
  "package.json",
  "packages/contracts/package.json",
  "packages/contracts/src/content.ts",
  "packages/contracts/src/errors.ts",
  "packages/contracts/src/index.ts",
  "packages/contracts/src/requests.ts",
  "packages/contracts/test/schema.test.ts",
  "packages/contracts/tsconfig.json",
  "packages/validation/package.json",
  "packages/validation/src/content.ts",
  "packages/validation/src/envelope.ts",
  "packages/validation/src/index.ts",
  "packages/validation/src/primitives.ts",
  "packages/validation/src/request.ts",
  "packages/validation/test/schema.test.ts",
  "packages/validation/tsconfig.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "scripts/verify_task_02.mjs",
  "tests/contracts/package-boundaries.test.mjs",
  "tsconfig.base.json",
].sort();

const failures = [];
const passed = [];

function fail(check, detail) {
  failures.push(`${check}: ${detail}`);
}

function pass(check, detail) {
  passed.push(`${check}: ${detail}`);
}

function absolute(relativePath) {
  return path.join(ROOT, relativePath);
}

function exists(relativePath) {
  return existsSync(absolute(relativePath));
}

function text(relativePath) {
  return readFileSync(absolute(relativePath), "utf8").replace(/\r\n/g, "\n");
}

function json(relativePath) {
  return JSON.parse(text(relativePath));
}

function sha256Buffer(buffer) {
  return createHash("sha256").update(buffer).digest("hex").toUpperCase();
}

function sha256File(relativePath) {
  return sha256Buffer(readFileSync(absolute(relativePath)));
}

function command(file, args) {
  return execFileSync(file, args, { cwd: ROOT, encoding: "utf8" }).trim();
}

function git(args) {
  return command("git", args);
}

export function findForbiddenImports(files, forbiddenSpecifiers) {
  const findings = [];
  for (const file of files) {
    for (const specifier of forbiddenSpecifiers) {
      if (file.content.includes(`"${specifier}"`) || file.content.includes(`'${specifier}'`))
        findings.push(`${file.path} -> ${specifier}`);
    }
  }
  return findings;
}

function sourceFiles(prefix) {
  return EXPECTED_MEMBERS.filter((name) => name.startsWith(prefix) && name.endsWith(".ts")).map(
    (name) => ({ path: name, content: text(name) }),
  );
}

function parseCentralDirectory(buffer) {
  let end = -1;
  for (let offset = buffer.length - 22; offset >= 0; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) {
      end = offset;
      break;
    }
  }
  if (end < 0) throw new Error("ZIP end-of-central-directory record is missing");

  const count = buffer.readUInt16LE(end + 10);
  const directorySize = buffer.readUInt32LE(end + 12);
  const directoryOffset = buffer.readUInt32LE(end + 16);
  const members = [];
  let offset = directoryOffset;
  for (let index = 0; index < count; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50)
      throw new Error(`ZIP central-directory entry ${index} is invalid`);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    members.push({
      name: buffer.subarray(offset + 46, offset + 46 + nameLength).toString("utf8"),
      flags: buffer.readUInt16LE(offset + 8),
      method: buffer.readUInt16LE(offset + 10),
      compressedSize: buffer.readUInt32LE(offset + 20),
      uncompressedSize: buffer.readUInt32LE(offset + 24),
      localOffset: buffer.readUInt32LE(offset + 42),
    });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  if (offset - directoryOffset !== directorySize)
    throw new Error("ZIP central-directory size does not match its entries");
  return members;
}

function readZipMember(buffer, member) {
  if (member.flags & 0x08) throw new Error(`ZIP data descriptor is unsupported for ${member.name}`);
  if (buffer.readUInt32LE(member.localOffset) !== 0x04034b50)
    throw new Error(`ZIP local header is missing for ${member.name}`);
  const nameLength = buffer.readUInt16LE(member.localOffset + 26);
  const extraLength = buffer.readUInt16LE(member.localOffset + 28);
  const start = member.localOffset + 30 + nameLength + extraLength;
  const compressed = buffer.subarray(start, start + member.compressedSize);
  const content =
    member.method === 0 ? compressed : member.method === 8 ? inflateRawSync(compressed) : null;
  if (!content) throw new Error(`ZIP compression method ${member.method} is unsupported`);
  if (content.length !== member.uncompressedSize)
    throw new Error(`ZIP size mismatch for ${member.name}`);
  return content;
}

function checkWorkspaceAndGit() {
  if (
    path.normalize(ROOT) !== path.normalize("C:\\Users\\HU\\Documents\\student-care-saas-platform")
  )
    fail("workspace root", ROOT);
  else pass("workspace root", ROOT);

  const branch = git(["branch", "--show-current"]);
  const head = git(["rev-parse", "HEAD"]);
  if (branch !== TARGET_BRANCH) fail("git provenance", `branch is ${branch}`);
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", SOURCE_HEAD, head], {
      cwd: ROOT,
      stdio: "ignore",
    });
  } catch {
    fail("git provenance", `${SOURCE_HEAD} is not an ancestor of ${head}`);
  }
  const commitCount = Number(git(["rev-list", "--count", `${SOURCE_HEAD}..${head}`]));
  if (commitCount > 1) fail("git provenance", `${commitCount} commits exist after source HEAD`);
  if (commitCount === 1) {
    if (git(["rev-parse", `${head}^`]) !== SOURCE_HEAD)
      fail("git provenance", "Task 02 commit is not the direct child of source HEAD");
    if (git(["show", "-s", "--format=%s", head]) !== COMMIT_SUBJECT)
      fail("git provenance", "Task 02 commit subject differs from the approved subject");
  }
  if (git(["remote"])) fail("git safety", "a remote is configured");
  if (!failures.some((entry) => entry.startsWith("git provenance")))
    pass("git provenance", `${branch}, source ancestor and commit count verified`);
  if (!failures.some((entry) => entry.startsWith("git safety")))
    pass("git safety", "remote count is zero");

  const allowed = new Set([...EXPECTED_MEMBERS, REVIEW_ZIP]);
  const status = git(["status", "--porcelain=v1", "--untracked-files=all"]);
  for (const line of status ? status.split("\n") : []) {
    const relativePath = line.replace(/^[ MADRCU?!]{1,2}\s+/, "").replace(/\\/g, "/");
    if (!allowed.has(relativePath))
      fail("workspace scope", `unapproved changed path ${relativePath}`);
  }
}

function checkAnchors() {
  if (!exists(CONTRACT) || statSync(absolute(CONTRACT)).size !== 22012)
    fail("contract integrity", "contract is missing or size differs from 22012 bytes");
  else if (sha256File(CONTRACT) !== CONTRACT_SHA)
    fail("contract integrity", `contract SHA is ${sha256File(CONTRACT)}`);
  else pass("contract integrity", `${CONTRACT_SHA}, 22012 bytes`);

  if (!exists(TASK_01_ZIP) || sha256File(TASK_01_ZIP) !== TASK_01_ZIP_SHA)
    fail("Task 01 frozen package", "ZIP is missing or its SHA differs");
  else {
    const names = parseCentralDirectory(readFileSync(absolute(TASK_01_ZIP)))
      .map((member) => member.name)
      .sort();
    const nameHash = sha256Buffer(Buffer.from(`${names.join("\n")}\n`, "utf8"));
    if (names.length !== 20 || nameHash !== TASK_01_MEMBER_SHA)
      fail("Task 01 frozen package", `${names.length} members, member-list SHA ${nameHash}`);
  }
  const frozenDiff = git([
    "diff",
    "--name-only",
    SOURCE_HEAD,
    "--",
    "docs/reviews/PHASE_1B_TASK_01_REVIEW.md",
    "SHA256SUMS_PHASE_1B_TASK_01.txt",
    TASK_01_ZIP,
  ]);
  if (frozenDiff) fail("Task 01 frozen package", `modified frozen path: ${frozenDiff}`);
  if (!failures.some((entry) => entry.startsWith("Task 01 frozen package")))
    pass("Task 01 frozen package", "ZIP, 20-member list, review, and Manifest remain frozen");

  const acceptance = text("docs/project/PHASE_1B_TASK_01_ACCEPTANCE.md");
  for (const anchor of [
    "TASK_01_PROJECT_OWNER_ACCEPTANCE=PASS",
    "TASK_01_ACCEPTANCE_DATE=2026-08-22",
    `TASK_01_COMMIT=${SOURCE_HEAD}`,
    `TASK_01_REVIEW_PACKAGE_SHA256=${TASK_01_ZIP_SHA}`,
    "TASK_01_REVIEW_PACKAGE_MEMBER_COUNT=20",
    `TASK_01_REVIEW_PACKAGE_MEMBER_LIST_SHA256=${TASK_01_MEMBER_SHA}`,
    "TASK_01_RISK_GLOB_10_5_0=NON_BLOCKING_TRANSITIVE_DEPENDENCY_WATCH",
  ]) {
    if (!acceptance.includes(anchor)) fail("Task 01 acceptance", `missing ${anchor}`);
  }
  if (!failures.some((entry) => entry.startsWith("Task 01 acceptance")))
    pass("Task 01 acceptance", "owner-approved anchors recorded without changing frozen evidence");
}

function checkPackages() {
  for (const relativePath of EXPECTED_MEMBERS) {
    if (!exists(relativePath)) fail("workspace structure", `missing ${relativePath}`);
  }
  const canonicalMemberHash = sha256Buffer(Buffer.from(`${EXPECTED_MEMBERS.join("\n")}\n`, "utf8"));
  if (EXPECTED_MEMBERS.length !== 49 || canonicalMemberHash !== MEMBER_LIST_SHA)
    fail(
      "review member contract",
      `${EXPECTED_MEMBERS.length} members, SHA ${canonicalMemberHash}`,
    );
  else pass("review member contract", "approved 49-member set and canonical SHA match");

  const contracts = json("packages/contracts/package.json");
  const validation = json("packages/validation/package.json");
  const api = json("apps/api/package.json");
  if (contracts.dependencies || contracts.devDependencies)
    fail("dependency policy", "contracts has dependencies");
  if (
    JSON.stringify(validation.dependencies) !==
    JSON.stringify({ "@student-care/contracts": "workspace:*", zod: "3.25.76" })
  )
    fail("dependency policy", "validation dependencies differ from contracts plus exact Zod");
  if (
    JSON.stringify(api.dependencies) !==
    JSON.stringify({
      "@student-care/contracts": "workspace:*",
      "@student-care/validation": "workspace:*",
      fastify: "5.12.1",
    })
  )
    fail(
      "dependency policy",
      "API dependencies differ from approved workspace packages and Fastify",
    );
  const expectedExports = { ".": { types: "./src/index.ts", import: "./dist/src/index.js" } };
  if (JSON.stringify(contracts.exports) !== JSON.stringify(expectedExports))
    fail("package resolution", "contracts exports are not the approved types/runtime split");
  if (JSON.stringify(validation.exports) !== JSON.stringify(expectedExports))
    fail("package resolution", "validation exports are not the approved types/runtime split");

  const zodMetadataPath = "packages/validation/node_modules/zod/package.json";
  if (!exists(zodMetadataPath)) fail("Zod metadata", "installed metadata is unavailable");
  else {
    const metadata = json(zodMetadataPath);
    if (metadata.version !== "3.25.76" || metadata.license !== "MIT")
      fail("Zod metadata", `${metadata.version}, ${metadata.license ?? "missing license"}`);
    for (const scriptName of ["preinstall", "install", "postinstall", "prepare"]) {
      if (metadata.scripts?.[scriptName]) fail("Zod metadata", `declares ${scriptName}`);
    }
  }
  if (!text("pnpm-lock.yaml").includes("zod@3.25.76"))
    fail("lockfile", "exact Zod resolution is missing");

  const reverseImports = [
    ...findForbiddenImports(sourceFiles("packages/contracts/"), [
      "@student-care/validation",
      "zod",
    ]),
    ...findForbiddenImports(sourceFiles("packages/validation/"), ["@student-care/api"]),
  ];
  for (const finding of reverseImports) fail("package direction", finding);
  for (const file of [
    ...sourceFiles("packages/contracts/"),
    ...sourceFiles("packages/validation/"),
  ]) {
    if (file.content.includes("apps/api"))
      fail("package direction", `${file.path} imports apps/api`);
  }

  if (!failures.some((entry) => entry.startsWith("workspace structure")))
    pass("workspace structure", "all 49 approved review members exist");
  if (!failures.some((entry) => entry.startsWith("dependency policy")))
    pass("dependency policy", "one external direct dependency and approved workspace edges only");
  if (!failures.some((entry) => entry.startsWith("package resolution")))
    pass("package resolution", "source types and compiled ESM exports are explicit");
  if (!failures.some((entry) => entry.startsWith("Zod metadata")))
    pass("Zod metadata", "3.25.76, MIT, no install-time lifecycle script");
  if (!failures.some((entry) => entry.startsWith("lockfile")))
    pass("lockfile", "exact Zod resolution and workspace links are recorded");
  if (!failures.some((entry) => entry.startsWith("package direction")))
    pass("package direction", "contracts -> validation -> API with no reverse import");
}

function checkSafetyAndReview() {
  const taskSources = EXPECTED_MEMBERS.filter(
    (name) =>
      /^(?:apps\/api|packages|tests\/contracts)\/.+\.(?:mjs|ts)$/.test(name) && exists(name),
  );
  const secretPattern =
    /(-----BEGIN (?:RSA|EC|OPENSSH|PRIVATE) KEY-----|AKIA[0-9A-Z]{16}|(?:api[_-]?key|secret|token|password)\s*[:=]\s*["'][^"']{8,})/i;
  const personalPattern = /(?<!\d)1[3-9]\d{9}(?!\d)|(?<!\d)\d{17}[\dXx](?!\d)/;
  const networkPattern =
    /(?:fetch\s*\(|https?:\/\/|https?\.request|http\.request|axios|undici|net\.connect|dns\.lookup)/i;
  for (const relativePath of taskSources) {
    const content = text(relativePath);
    if (secretPattern.test(content)) fail("security scan", `secret-like value in ${relativePath}`);
    if (personalPattern.test(content))
      fail("security scan", `personal-data-like value in ${relativePath}`);
    if (networkPattern.test(content))
      fail("network boundary", `external request in ${relativePath}`);
  }

  const trackedAndUntracked = [
    ...git(["ls-files"]).split("\n"),
    ...git(["ls-files", "--others", "--exclude-standard"]).split("\n"),
  ].filter(Boolean);
  const forbiddenPaths = [
    /^apps\/(?:user-web|admin-web|mini-program)(?:\/|$)/i,
    /^packages\/(?:tenant|identity|auth|database|db|storage|ai)(?:\/|$)/i,
    /^(?:prisma|migrations?|deploy)(?:\/|$)/i,
    /(^|\/)\.env(?:\.|$)/i,
  ];
  for (const relativePath of trackedAndUntracked) {
    if (forbiddenPaths.some((pattern) => pattern.test(relativePath)))
      fail("Task 03 boundary", `forbidden implementation path ${relativePath}`);
  }

  const health = text("apps/api/src/health/health.route.ts");
  if (!health.includes('({ status: "ok" as const })'))
    fail("API regression", "health response changed");
  if (/listen\s*\(|process\.env|database|redis|cos|tenant|campus|student|user/i.test(health))
    fail("API regression", "health route contains a forbidden integration");
  const apiSources = sourceFiles("apps/api/");
  if (
    apiSources.some((file) =>
      /(?:CONTENT_TYPES|CONTENT_STATUSES|CONTENT_VISIBILITIES|BLOCK_KINDS)\s*=/.test(file.content),
    )
  )
    fail("API consumption", "API duplicates a shared value set");

  const review = text("docs/reviews/PHASE_1B_TASK_02_REVIEW.md");
  for (const anchor of [
    "PHASE_1B_TASK_02_STATUS=PASS",
    "TASK_03_STARTED=NO",
    "TASK_02_COMMIT=RECORDED_IN_EXTERNAL_FINAL_RECEIPT_AFTER_COMMIT",
    "BLOCKERS=NONE",
  ]) {
    if (!review.includes(anchor)) fail("review evidence", `missing ${anchor}`);
  }

  if (!failures.some((entry) => entry.startsWith("security scan")))
    pass("security scan", "no secret or personal-data pattern in executable Task 02 files");
  if (!failures.some((entry) => entry.startsWith("network boundary")))
    pass("network boundary", "application and tests contain no external request");
  if (!failures.some((entry) => entry.startsWith("Task 03 boundary")))
    pass("Task 03 boundary", "no tenant, identity, database, client, deployment, or env path");
  if (!failures.some((entry) => entry.startsWith("API regression")))
    pass("API regression", "health route remains exactly { status: ok }");
  if (!failures.some((entry) => entry.startsWith("API consumption")))
    pass("API consumption", "workspace dependencies are consumed without schema duplication");
}

function checkReviewZip() {
  if (!exists(REVIEW_ZIP)) {
    fail("review package", `missing ${REVIEW_ZIP}`);
    return;
  }
  const buffer = readFileSync(absolute(REVIEW_ZIP));
  const members = parseCentralDirectory(buffer);
  const names = members.map((member) => member.name);
  const sortedNames = [...names].sort();
  if (new Set(names).size !== names.length) fail("review package", "duplicate members exist");
  if (JSON.stringify(sortedNames) !== JSON.stringify(EXPECTED_MEMBERS))
    fail("review package", "member set differs from the approved 49 paths");
  const nameHash = sha256Buffer(Buffer.from(`${sortedNames.join("\n")}\n`, "utf8"));
  if (nameHash !== MEMBER_LIST_SHA) fail("review package", `member-list SHA is ${nameHash}`);
  for (const name of names) {
    if (name.startsWith("../") || name.includes("\\") || name.endsWith("/"))
      fail("review package safety", `unsafe path ${name}`);
  }

  const contents = new Map(members.map((member) => [member.name, readZipMember(buffer, member)]));
  const innerManifest = contents.get(MANIFEST)?.toString("utf8").replace(/\r\n/g, "\n");
  const expectedInnerLines = EXPECTED_MEMBERS.filter((name) => name !== MANIFEST)
    .map((name) => `${sha256Buffer(contents.get(name))}  ${name}`)
    .sort();
  if (
    !innerManifest ||
    JSON.stringify(innerManifest.trimEnd().split("\n").sort()) !==
      JSON.stringify(expectedInnerLines)
  )
    fail("review package", "inner Manifest does not cover the other 48 ZIP members");

  const rootLines = text(MANIFEST).trimEnd().split("\n");
  const expectedRootLines = EXPECTED_MEMBERS.filter((name) => name !== MANIFEST)
    .map((name) => `${sha256File(name)}  ${name}`)
    .sort();
  const actualRootLines = rootLines
    .filter((line) => !line.startsWith("REVIEW_PACKAGE_SHA256="))
    .sort();
  if (JSON.stringify(actualRootLines) !== JSON.stringify(expectedRootLines))
    fail("review package", "root Manifest differs from current files");
  const zipHash = sha256File(REVIEW_ZIP);
  if (!rootLines.includes(`REVIEW_PACKAGE_SHA256=${zipHash}`))
    fail("review package", "root Manifest ZIP digest is missing or incorrect");

  if (!failures.some((entry) => entry.startsWith("review package:")))
    pass("review package", `49 members, 48 payload hashes, ZIP SHA ${zipHash}`);
  if (!failures.some((entry) => entry.startsWith("review package safety")))
    pass("review package safety", "relative POSIX file paths only");
}

function main() {
  checkWorkspaceAndGit();
  checkAnchors();
  checkPackages();
  checkSafetyAndReview();
  checkReviewZip();

  for (const message of passed) console.log(`PASS ${message}`);
  if (failures.length > 0) {
    for (const message of failures) console.error(`FAIL ${message}`);
    process.exitCode = 1;
    return;
  }
  console.log("TASK_02_VERIFY=PASS");
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) main();
