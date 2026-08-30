/* global Buffer, console, process */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { inflateRawSync } from "node:zlib";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_HEAD = "d122cb693de9cbc5782ee006b094ce410c76f365";
const TARGET_BRANCH = "feature/phase-1b-task-03-tenant-campus-scope";
const CONTRACT = "PHASE_1B_TASK_03_CODEX_EXECUTION.md";
const CONTRACT_SHA = "5DACCFDABCE2EF597F852D0DAB00ACC2FC7388FB25D58551199586A4CE6152D9";
const TASK_03_IMPLEMENTATION_COMMIT = "dd72ddcb2975e237dce95dfb81238d9367d7be99";
const TASK_03_ACCEPTANCE_COMMIT = "314b8dbbe15ea32300a2b253b287151005db4cec";
const TASK_03_ACCEPTANCE_RECORD = "docs/project/PHASE_1B_TASK_03_ACCEPTANCE.md";
const AUTHORITY = "docs/project/PHASE_1B_T10_T12_DEPENDENCY_AUTHORITY_V1.md";
const TASK_02_CONTRACT = "PHASE_1B_TASK_02_CODEX_EXECUTION.md";
const TASK_02_ACCEPTANCE = "docs/project/PHASE_1B_TASK_02_ACCEPTANCE.md";
const TASK_02_ZIP =
  "artifacts/review-package/student-care-platform-phase1b-task-02-review-pack-v1.0.zip";
const TASK_03_MANIFEST = "SHA256SUMS_PHASE_1B_TASK_03.txt";
const TASK_03_REVIEW = "docs/reviews/PHASE_1B_TASK_03_REVIEW.md";
const TASK_03_ZIP =
  "artifacts/review-package/student-care-platform-phase1b-task-03-review-pack-v1.0.zip";

const EXPECTED_HASHES = new Map([
  [CONTRACT, CONTRACT_SHA],
  [AUTHORITY, "B7F7509914399DD660D02F6FFD52E735EDF9EA850C0BF5C92F95698D8104F007"],
  [TASK_02_CONTRACT, "0292269A8264F7217014C629FFA53133E1818B0483DC90ECA275B8817C461A57"],
  [TASK_02_ACCEPTANCE, "62316AA2C94B5C5B3B52DA2E678799B2B20787589AA9C8E0D5FB6DBA239628DF"],
  [TASK_02_ZIP, "FB42ECCD371747D76A8D95CD3692081F392C1A6AE4662F355BEBEC1911966622"],
  [
    "docs/plans/PHASE_1B_TASK_DEPENDENCY_GRAPH.md",
    "9C9674E43042B229DEA32E3AF912B1876339259F0D6F581275AD3EE99001BA11",
  ],
  [
    "docs/plans/PHASE_1B_V0_1_IMPLEMENTATION_PLAN.md",
    "4DAB62008CCB3658D00DB1ACA080419F98E934D7E2C0F5DDC84BD7F05D2D6BED",
  ],
]);

const ROOT_SCRIPTS = {
  typecheck:
    "corepack pnpm --filter @student-care/contracts typecheck && corepack pnpm --filter @student-care/validation typecheck && corepack pnpm --filter @student-care/tenant typecheck && corepack pnpm --filter @student-care/api typecheck",
  lint: "corepack pnpm --filter @student-care/contracts lint && corepack pnpm --filter @student-care/validation lint && eslint eslint.config.mjs tests scripts",
  "format:check":
    "prettier --check --ignore-unknown package.json pnpm-workspace.yaml tsconfig.base.json eslint.config.mjs .prettierrc.json apps/api/package.json apps/api/tsconfig.json apps/api/src/**/*.ts apps/api/test/**/*.ts packages/*/package.json packages/*/tsconfig.json packages/*/src/**/*.ts packages/*/test/**/*.ts tests/**/*.mjs scripts/**/*.mjs PHASE_1B_TASK_03_CODEX_EXECUTION.md SHA256SUMS_PHASE_1B_TASK_03.txt docs/project/PHASE_1B_RUNTIME_BASELINE_DECISION.md docs/project/PHASE_1B_TASK_01_ACCEPTANCE.md docs/project/PHASE_1B_TASK_02_PLAN.md docs/project/PHASE_1B_TASK_03_PLAN.md docs/reviews/PHASE_1B_TASK_01_REVIEW.md",
  test: "corepack pnpm --filter @student-care/contracts test && corepack pnpm --filter @student-care/validation test && corepack pnpm --filter @student-care/tenant test && corepack pnpm --filter @student-care/api test && node --test tests/workspace/paths.test.mjs tests/contracts/package-boundaries.test.mjs",
  "test:coverage":
    "corepack pnpm --filter @student-care/tenant test:coverage && corepack pnpm --filter @student-care/api test:coverage && node --test tests/workspace/paths.test.mjs tests/contracts/package-boundaries.test.mjs",
  build:
    "corepack pnpm --filter @student-care/contracts build && corepack pnpm --filter @student-care/validation build && corepack pnpm --filter @student-care/tenant build && corepack pnpm --filter @student-care/api build",
  verify:
    "corepack pnpm typecheck && corepack pnpm lint && corepack pnpm format:check && corepack pnpm test && corepack pnpm test:coverage && corepack pnpm build && node scripts/verify_task_03.mjs",
};

const ALLOWED_CHANGED_PATHS = new Set([
  "apps/api/package.json",
  "apps/api/src/plugins/scope.plugin.ts",
  "apps/api/test/scope.plugin.test.ts",
  TASK_03_MANIFEST,
  TASK_03_REVIEW,
  TASK_03_ZIP,
  "docs/project/PHASE_1B_TASK_03_PLAN.md",
  "package.json",
  "packages/tenant/package.json",
  "packages/tenant/src/index.ts",
  "packages/tenant/src/resolve-scope.ts",
  "packages/tenant/src/scope-context.ts",
  "packages/tenant/test/isolation.test.ts",
  "packages/tenant/tsconfig.json",
  "pnpm-lock.yaml",
  "scripts/verify_task_03.mjs",
  "tests/contracts/package-boundaries.test.mjs",
  "tests/workspace/paths.test.mjs",
]);

const COMMITTED_ALLOWED_PATHS = new Set([...ALLOWED_CHANGED_PATHS, TASK_03_ACCEPTANCE_RECORD]);

const EVIDENCE_PATHS = new Set([TASK_03_MANIFEST, TASK_03_REVIEW, TASK_03_ZIP]);
const REQUIRED_IMPLEMENTATION_PATHS = [...ALLOWED_CHANGED_PATHS].filter(
  (relativePath) => relativePath !== "pnpm-lock.yaml" && !EVIDENCE_PATHS.has(relativePath),
);

const failures = [];
const verified = [];

function fail(check, detail) {
  failures.push(`${check}: ${detail}`);
}

function ok(check, detail) {
  verified.push(`${check}: ${detail}`);
}

function absolute(relativePath) {
  return path.join(ROOT, relativePath);
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

function rawCommand(file, args) {
  return execFileSync(file, args, { cwd: ROOT, encoding: "utf8" });
}

function command(file, args) {
  return rawCommand(file, args).trim();
}

function git(args) {
  return command("git", args);
}

function commitExists(commit) {
  try {
    execFileSync("git", ["cat-file", "-e", `${commit}^{commit}`], {
      cwd: ROOT,
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

function commitIsAncestor(ancestor, descendant) {
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", ancestor, descendant], {
      cwd: ROOT,
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

function sourceFiles(relativeDirectory) {
  const directory = absolute(relativeDirectory);
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = `${relativeDirectory}/${entry.name}`;
    if (entry.isDirectory()) return sourceFiles(relativePath);
    if (!entry.isFile() || !/\.(?:mjs|ts)$/.test(entry.name)) return [];
    return [{ path: relativePath, content: text(relativePath) }];
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
    const imports = moduleSpecifiers(file.content);
    for (const forbidden of forbiddenSpecifiers) {
      if (
        imports.some(
          (specifier) => specifier === forbidden || specifier.startsWith(`${forbidden}/`),
        )
      )
        findings.push(`${file.path} -> ${forbidden}`);
    }
  }
  return findings;
}

function ordinalCompare(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function determineEvidenceMode(presence) {
  if (
    !Array.isArray(presence) ||
    presence.length !== 3 ||
    presence.some((value) => typeof value !== "boolean")
  ) {
    throw new TypeError("evidence presence must contain three booleans");
  }
  const presentCount = presence.filter(Boolean).length;
  if (presentCount === 0) return "implementation";
  if (presentCount === 3) return "final-review";
  throw new Error("partial evidence is not an accepted verification mode");
}

function checkGitAndWorkspace() {
  const expectedRoot = "C:\\Users\\HU\\Documents\\student-care-saas-platform";
  if (path.normalize(ROOT) !== path.normalize(expectedRoot)) fail("workspace root", ROOT);
  else ok("workspace root", ROOT);

  const branch = git(["branch", "--show-current"]);
  const head = git(["rev-parse", "HEAD"]);
  if (branch !== TARGET_BRANCH) fail("git branch", branch);
  if (!commitIsAncestor(SOURCE_HEAD, head))
    fail("git HEAD", `${head} is not descended from ${SOURCE_HEAD}`);
  if (!commitExists(TASK_03_IMPLEMENTATION_COMMIT))
    fail(
      "committed Task 03 state",
      `missing implementation commit ${TASK_03_IMPLEMENTATION_COMMIT}`,
    );
  else if (!commitIsAncestor(TASK_03_IMPLEMENTATION_COMMIT, head))
    fail(
      "committed Task 03 state",
      `implementation commit ${TASK_03_IMPLEMENTATION_COMMIT} is not an ancestor of ${head}`,
    );
  if (!commitExists(TASK_03_ACCEPTANCE_COMMIT))
    fail("committed Task 03 state", `missing acceptance commit ${TASK_03_ACCEPTANCE_COMMIT}`);
  else if (!commitIsAncestor(TASK_03_ACCEPTANCE_COMMIT, head))
    fail(
      "committed Task 03 state",
      `acceptance commit ${TASK_03_ACCEPTANCE_COMMIT} is not an ancestor of ${head}`,
    );
  if (!existsSync(absolute(TASK_03_ACCEPTANCE_RECORD))) {
    fail("committed Task 03 state", `missing ${TASK_03_ACCEPTANCE_RECORD}`);
  } else {
    const acceptanceText = text(TASK_03_ACCEPTANCE_RECORD);
    const requiredAcceptanceFields = [
      "TASK_03_PROJECT_OWNER_ACCEPTANCE=PASS",
      `TASK_03_IMPLEMENTATION_COMMIT=${TASK_03_IMPLEMENTATION_COMMIT}`,
      "TASK_03_IMPLEMENTATION_STATE=COMMITTED",
      `TASK_03_ACCEPTANCE_COMMIT=${TASK_03_ACCEPTANCE_COMMIT}`,
      "TASK_03_ACCEPTANCE_RECORD_STATUS=COMMITTED",
      `TASK_03_SOURCE_HEAD=${SOURCE_HEAD}`,
    ];
    for (const field of requiredAcceptanceFields) {
      if (!acceptanceText.split("\n").includes(field))
        fail("committed Task 03 state", `${TASK_03_ACCEPTANCE_RECORD} is missing ${field}`);
    }
    try {
      if (
        git(["ls-files", "--error-unmatch", TASK_03_ACCEPTANCE_RECORD]) !==
        TASK_03_ACCEPTANCE_RECORD
      )
        fail("committed Task 03 state", `${TASK_03_ACCEPTANCE_RECORD} is not tracked`);
    } catch {
      fail("committed Task 03 state", `${TASK_03_ACCEPTANCE_RECORD} is not tracked`);
    }
    if (git(["diff", "--name-only", "--", TASK_03_ACCEPTANCE_RECORD]))
      fail("committed Task 03 state", `${TASK_03_ACCEPTANCE_RECORD} has uncommitted changes`);
  }
  if (git(["remote"])) fail("git remote", "a remote is configured");
  if (git(["diff", "--cached", "--name-only"])) fail("git index", "staged paths exist");
  if (!failures.some((entry) => entry.startsWith("git branch"))) ok("git branch", branch);
  if (!failures.some((entry) => entry.startsWith("git HEAD")))
    ok("git HEAD", `${head} descends from ${SOURCE_HEAD}`);
  if (!failures.some((entry) => entry.startsWith("committed Task 03 state")))
    ok(
      "committed Task 03 state",
      `implementation ${TASK_03_IMPLEMENTATION_COMMIT}; acceptance ${TASK_03_ACCEPTANCE_COMMIT}; HEAD ${head}`,
    );
  if (!failures.some((entry) => entry.startsWith("git remote"))) ok("git remote", "count 0");
  if (!failures.some((entry) => entry.startsWith("git index"))) ok("git index", "clean");

  const status = rawCommand("git", ["status", "--porcelain=v1", "--untracked-files=all"]).trimEnd();
  for (const line of status ? status.split("\n") : []) {
    const relativePath = line.slice(3).replace(/\\/g, "/");
    if (!ALLOWED_CHANGED_PATHS.has(relativePath))
      fail("workspace whitelist", `unapproved changed path ${relativePath}`);
  }
  if (!failures.some((entry) => entry.startsWith("workspace whitelist")))
    ok("workspace whitelist", `${ALLOWED_CHANGED_PATHS.size} approved paths only`);

  const committedPaths = git(["diff", "--name-only", SOURCE_HEAD, head])
    .split("\n")
    .map((relativePath) => relativePath.trim())
    .filter(Boolean);
  for (const relativePath of committedPaths) {
    if (!COMMITTED_ALLOWED_PATHS.has(relativePath))
      fail("committed change boundary", `unapproved committed path ${relativePath}`);
  }
  if (!failures.some((entry) => entry.startsWith("committed change boundary")))
    ok("committed change boundary", `${committedPaths.length} approved paths only`);

  for (const relativePath of REQUIRED_IMPLEMENTATION_PATHS) {
    if (!existsSync(absolute(relativePath))) fail("workspace structure", `missing ${relativePath}`);
  }
  if (!failures.some((entry) => entry.startsWith("workspace structure")))
    ok("workspace structure", "all authorized implementation paths exist");
}

function checkFrozenAnchors() {
  for (const [relativePath, expectedHash] of EXPECTED_HASHES) {
    if (!existsSync(absolute(relativePath))) {
      fail("frozen anchor", `missing ${relativePath}`);
      continue;
    }
    const actualHash = sha256File(relativePath);
    if (actualHash !== expectedHash)
      fail("frozen anchor", `${relativePath} SHA ${actualHash}, expected ${expectedHash}`);
  }

  const frozenPaths = [
    ...EXPECTED_HASHES.keys(),
    "apps/api/src/health/health.route.ts",
    "apps/api/src/index.ts",
    "apps/api/src/server.ts",
    "docs/reviews/PHASE_1B_TASK_02_REVIEW.md",
    "SHA256SUMS_PHASE_1B_TASK_02.txt",
  ];
  const frozenDiff = git(["diff", "--name-only", SOURCE_HEAD, "--", ...frozenPaths]);
  if (frozenDiff) fail("frozen anchor", `changed frozen path ${frozenDiff}`);

  if (!failures.some((entry) => entry.startsWith("frozen anchor")))
    ok("frozen anchors", `${EXPECTED_HASHES.size} SHA anchors and API entry files unchanged`);
}

function checkRootAndPackageContracts() {
  const rootPackage = json("package.json");
  const rootScriptKeys = Object.keys(rootPackage.scripts ?? {}).sort(ordinalCompare);
  const expectedScriptKeys = Object.keys(ROOT_SCRIPTS).sort(ordinalCompare);
  if (JSON.stringify(rootScriptKeys) !== JSON.stringify(expectedScriptKeys))
    fail("root scripts", `keys are ${rootScriptKeys.join("|")}`);
  for (const [name, expected] of Object.entries(ROOT_SCRIPTS)) {
    if (rootPackage.scripts?.[name] !== expected) fail("root scripts", `${name} differs`);
  }

  const contracts = json("packages/contracts/package.json");
  const validation = json("packages/validation/package.json");
  const tenant = json("packages/tenant/package.json");
  const api = json("apps/api/package.json");
  const expectedExports = { ".": { types: "./src/index.ts", import: "./dist/src/index.js" } };

  if (contracts.dependencies !== undefined) fail("package direction", "contracts has dependencies");
  if (
    JSON.stringify(validation.dependencies) !==
    JSON.stringify({ "@student-care/contracts": "workspace:*", zod: "3.25.76" })
  )
    fail("package direction", "validation dependencies differ");
  if (
    JSON.stringify(tenant.dependencies) !==
    JSON.stringify({ "@student-care/validation": "workspace:*" })
  )
    fail("package direction", "tenant dependencies differ");
  if (
    JSON.stringify(api.dependencies) !==
    JSON.stringify({
      "@student-care/contracts": "workspace:*",
      "@student-care/tenant": "workspace:*",
      "@student-care/validation": "workspace:*",
      fastify: "5.12.1",
    })
  )
    fail("package direction", "API dependencies differ");
  for (const [name, manifest] of [
    ["contracts", contracts],
    ["validation", validation],
    ["tenant", tenant],
  ]) {
    if (JSON.stringify(manifest.exports) !== JSON.stringify(expectedExports))
      fail("package exports", `${name} exports differ`);
  }

  const contractsSources = sourceFiles("packages/contracts/src");
  const validationSources = sourceFiles("packages/validation/src");
  const tenantSources = sourceFiles("packages/tenant/src");
  for (const finding of findForbiddenImports(contractsSources, [
    "@student-care/validation",
    "@student-care/tenant",
  ]))
    fail("package imports", finding);
  for (const finding of findForbiddenImports(validationSources, ["@student-care/tenant"]))
    fail("package imports", finding);
  for (const finding of findForbiddenImports(tenantSources, [
    "zod",
    "fastify",
    "@student-care/api",
  ]))
    fail("package imports", finding);
  for (const file of tenantSources) {
    for (const specifier of moduleSpecifiers(file.content)) {
      if (specifier.startsWith(".")) {
        const resolvedImport = path.resolve(path.dirname(absolute(file.path)), specifier);
        const repositoryImport = path.relative(ROOT, resolvedImport).replace(/\\/g, "/");
        if (repositoryImport === "apps/api" || repositoryImport.startsWith("apps/api/"))
          fail("package imports", `${file.path} -> ${specifier}`);
      } else if (specifier !== "@student-care/validation") {
        fail("package imports", `${file.path} -> ${specifier}`);
      }
    }
  }

  if (!existsSync(absolute("apps/api/node_modules/@student-care/tenant")))
    fail("workspace links", "API to tenant link is missing");
  if (!existsSync(absolute("packages/tenant/node_modules/@student-care/validation")))
    fail("workspace links", "tenant to validation link is missing");

  if (!failures.some((entry) => entry.startsWith("root scripts")))
    ok("root scripts", "exact Task 03 strings retained including blocked SHA path");
  if (!failures.some((entry) => entry.startsWith("package direction")))
    ok("package direction", "contracts -> validation -> tenant -> API");
  if (!failures.some((entry) => entry.startsWith("package exports")))
    ok("package exports", "types/source and runtime/dist split verified");
  if (!failures.some((entry) => entry.startsWith("package imports")))
    ok("package imports", "no reverse or direct forbidden import");
  if (!failures.some((entry) => entry.startsWith("workspace links")))
    ok("workspace links", "ratified local junctions are present");
}

function checkLockfile() {
  const numstat = git(["diff", "--numstat", SOURCE_HEAD, "--", "pnpm-lock.yaml"]);
  if (numstat !== "9\t0\tpnpm-lock.yaml") fail("lockfile", `unexpected numstat ${numstat}`);

  const patch = git(["diff", "--no-ext-diff", "--unified=0", SOURCE_HEAD, "--", "pnpm-lock.yaml"]);
  const removedLines = patch
    .split("\n")
    .filter((line) => line.startsWith("-") && !line.startsWith("---"));
  const addedLines = patch
    .split("\n")
    .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
    .map((line) => line.slice(1))
    .filter(Boolean);
  const expectedAddedLines = [
    "      '@student-care/tenant':",
    "        specifier: workspace:*",
    "        version: link:../../packages/tenant",
    "  packages/tenant:",
    "    dependencies:",
    "      '@student-care/validation':",
    "        specifier: workspace:*",
    "        version: link:../validation",
  ];
  if (removedLines.length > 0) fail("lockfile", "tracked lockfile lines were removed");
  if (JSON.stringify(addedLines) !== JSON.stringify(expectedAddedLines))
    fail("lockfile", `added lines differ: ${addedLines.join("|")}`);

  const headLockfile = rawCommand("git", ["show", `${SOURCE_HEAD}:pnpm-lock.yaml`]).replace(
    /\r\n/g,
    "\n",
  );
  const currentLockfile = text("pnpm-lock.yaml");
  const packagesMarker = "\npackages:\n";
  const headMarkerIndex = headLockfile.indexOf(packagesMarker);
  const currentMarkerIndex = currentLockfile.indexOf(packagesMarker);
  const headPackages = headLockfile.slice(headMarkerIndex).trimEnd();
  const currentPackages = currentLockfile.slice(currentMarkerIndex).trimEnd();
  if (
    headMarkerIndex < 0 ||
    currentMarkerIndex < 0 ||
    !headPackages ||
    headPackages !== currentPackages
  )
    fail("lockfile", "packages or snapshots section changed");

  if (!failures.some((entry) => entry.startsWith("lockfile")))
    ok("lockfile", "only two ratified workspace links differ; external resolution is frozen");
}

function checkCandidateMembers() {
  const contractText = text(CONTRACT);
  const matches = [...contractText.matchAll(/^REVIEW_PACKAGE_MEMBER_(\d{3})=(.+)$/gm)];
  const numbers = matches.map((match) => Number(match[1]));
  const members = matches.map((match) => match[2]);
  const payload = Buffer.from(`${members.join("\n")}\n`, "utf8");
  const expectedNumbers = Array.from({ length: 64 }, (_, index) => index + 1);
  const internalPayloadCount = Number(
    contractText.match(/^REVIEW_PACKAGE_INTERNAL_MANIFEST_PAYLOAD_COUNT=(\d+)$/m)?.[1],
  );

  if (JSON.stringify(numbers) !== JSON.stringify(expectedNumbers))
    fail("candidate members", `sequence is ${numbers.join("|")}`);
  if (internalPayloadCount !== 63)
    fail("candidate members", `internal payload count is ${internalPayloadCount}`);
  if (new Set(members).size !== 64) fail("candidate members", "paths are not unique");
  if (JSON.stringify([...members].sort(ordinalCompare)) !== JSON.stringify(members))
    fail("candidate members", "paths are not ordinal sorted");
  if (payload.length !== 2199) fail("candidate members", `payload is ${payload.length} bytes`);
  const digest = sha256Buffer(payload);
  if (digest !== "23EF5FC311BC2B64F15E617EA91FEA91BC9102992D89688CAC4022F72785AC1D")
    fail("candidate members", `payload SHA is ${digest}`);
  for (const [index, expected] of [
    [5, "SHA256SUMS_PHASE_1B_TASK_02.txt"],
    [27, AUTHORITY],
    [63, "tsconfig.base.json"],
  ]) {
    if (members[index] !== expected)
      fail(
        "candidate members",
        `member ${String(index + 1).padStart(3, "0")} is ${members[index]}`,
      );
  }

  if (!failures.some((entry) => entry.startsWith("candidate members")))
    ok("candidate members", `64 paths, 2199 bytes, SHA ${digest}`);
}

function checkSafetyAndPhaseBoundary() {
  const applicationFiles = [
    ...sourceFiles("packages/tenant/src"),
    ...sourceFiles("packages/tenant/test"),
    ...sourceFiles("apps/api/src/plugins"),
    ...sourceFiles("apps/api/test"),
  ];
  const secretPattern =
    /(-----BEGIN (?:RSA|EC|OPENSSH|PRIVATE) KEY-----|AKIA[0-9A-Z]{16}|(?:api[_-]?key|secret|token|password)\s*[:=]\s*["'][^"']{8,})/i;
  const personalPattern = /(?<!\d)1[3-9]\d{9}(?!\d)|(?<!\d)\d{17}[\dXx](?!\d)/;
  const networkPattern =
    /(?:fetch\s*\(|https?:\/\/|https?\.request|http\.request|axios|undici|net\.connect|dns\.lookup)/i;
  const servicePattern = /\.listen\s*\(/;
  for (const file of applicationFiles) {
    if (secretPattern.test(file.content))
      fail("security scan", `secret-like value in ${file.path}`);
    if (personalPattern.test(file.content))
      fail("security scan", `personal-data-like value in ${file.path}`);
    if (networkPattern.test(file.content)) fail("network boundary", `request code in ${file.path}`);
    if (servicePattern.test(file.content)) fail("service boundary", `listener in ${file.path}`);
  }

  const repositoryPaths = [
    ...git(["ls-files"]).split("\n"),
    ...git(["ls-files", "--others", "--exclude-standard"]).split("\n"),
  ].filter(Boolean);
  const forbiddenPaths = [
    /^apps\/(?:user-web|admin-web|mini-program)(?:\/|$)/i,
    /^packages\/(?:identity|auth|database|db|storage|ai)(?:\/|$)/i,
    /^(?:prisma|migrations?|deploy)(?:\/|$)/i,
    /(^|\/)\.env(?:\.|$)/i,
  ];
  for (const relativePath of repositoryPaths) {
    if (forbiddenPaths.some((pattern) => pattern.test(relativePath)))
      fail("Task 04 boundary", relativePath);
  }

  if (!failures.some((entry) => entry.startsWith("security scan")))
    ok("security scan", "no secret or personal-data pattern in Task 03 application/test files");
  if (!failures.some((entry) => entry.startsWith("network boundary")))
    ok("network boundary", "no external request code in Task 03 application/test files");
  if (!failures.some((entry) => entry.startsWith("service boundary")))
    ok("service boundary", "no service listener in Task 03 application/test files");
  if (!failures.some((entry) => entry.startsWith("Task 04 boundary")))
    ok("Task 04 boundary", "identity, database, client, AI, storage, and deployment remain absent");
}

function candidateMembers() {
  return [...text(CONTRACT).matchAll(/^REVIEW_PACKAGE_MEMBER_(\d{3})=(.+)$/gm)].map(
    (match) => match[2],
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

function hashLinesForMembers(members, readContent) {
  return members
    .filter((relativePath) => relativePath !== TASK_03_MANIFEST)
    .map((relativePath) => `${sha256Buffer(readContent(relativePath))}  ${relativePath}`)
    .sort(ordinalCompare);
}

function manifestLines(buffer, label) {
  if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf)
    fail("review package", `${label} contains a UTF-8 BOM`);
  const value = buffer.toString("utf8");
  if (value.includes("\r")) fail("review package", `${label} contains CRLF or CR line endings`);
  if (!value.endsWith("\n") || value.endsWith("\n\n"))
    fail("review package", `${label} must end with exactly one LF`);
  return value.slice(0, -1).split("\n");
}

function checkImplementationEvidence() {
  for (const relativePath of [TASK_03_MANIFEST, TASK_03_REVIEW, TASK_03_ZIP]) {
    if (existsSync(absolute(relativePath)))
      fail("evidence gate", `implementation mode requires absent ${relativePath}`);
  }
  if (!failures.some((entry) => entry.startsWith("evidence gate")))
    ok("evidence gate", "implementation mode: all three final evidence artifacts are absent");
}

function checkFinalEvidence() {
  const members = candidateMembers();
  const manifestBuffer = readFileSync(absolute(TASK_03_MANIFEST));
  const zipBuffer = readFileSync(absolute(TASK_03_ZIP));
  const rootLines = manifestLines(manifestBuffer, TASK_03_MANIFEST);

  const expectedRootHashLines = hashLinesForMembers(members, (relativePath) =>
    readFileSync(absolute(relativePath)),
  );
  const rootZipLines = rootLines.filter((line) => line.startsWith("REVIEW_PACKAGE_SHA256="));
  const actualRootHashLines = rootLines
    .filter((line) => !line.startsWith("REVIEW_PACKAGE_SHA256="))
    .sort(ordinalCompare);
  if (JSON.stringify(actualRootHashLines) !== JSON.stringify(expectedRootHashLines))
    fail("review package", "root SHA manifest differs from current 63 payload files");
  if (rootZipLines.length !== 1)
    fail("review package", "root SHA manifest must contain one REVIEW_PACKAGE_SHA256 line");
  else if (rootZipLines[0] !== `REVIEW_PACKAGE_SHA256=${sha256Buffer(zipBuffer)}`)
    fail("review package", "root SHA manifest ZIP digest is incorrect");

  const reviewText = text(TASK_03_REVIEW);
  if (!reviewText.includes("PROJECT_OWNER_ACCEPTANCE=PASS"))
    fail("review package", "review report must record PROJECT_OWNER_ACCEPTANCE=PASS");

  let zipMembers;
  try {
    zipMembers = parseCentralDirectory(zipBuffer);
  } catch (error) {
    fail("review package", error.message);
    zipMembers = [];
  }
  const zipNames = zipMembers.map((member) => member.name);
  if (zipNames.length !== members.length)
    fail("review package", `ZIP has ${zipNames.length} members, expected ${members.length}`);
  if (new Set(zipNames).size !== zipNames.length)
    fail("review package", "ZIP contains duplicate member names");
  if (JSON.stringify([...zipNames].sort(ordinalCompare)) !== JSON.stringify(members))
    fail("review package", "ZIP member set differs from the canonical 64 paths");

  const contents = new Map();
  for (const member of zipMembers) {
    try {
      contents.set(member.name, readZipMember(zipBuffer, member));
    } catch (error) {
      fail("review package", error.message);
    }
  }
  for (const relativePath of members) {
    if (!existsSync(absolute(relativePath))) {
      fail("review package", `canonical member is missing: ${relativePath}`);
      continue;
    }
    if (relativePath === TASK_03_MANIFEST) continue;
    const archived = contents.get(relativePath);
    if (!archived || !archived.equals(readFileSync(absolute(relativePath))))
      fail("review package", `ZIP content differs for ${relativePath}`);
  }

  const innerManifest = contents.get(TASK_03_MANIFEST);
  if (!innerManifest) {
    fail("review package", "ZIP does not contain the Task 03 SHA manifest");
  } else {
    const innerLines = manifestLines(innerManifest, "ZIP Task 03 SHA manifest").sort(
      ordinalCompare,
    );
    const expectedInnerHashLines = hashLinesForMembers(members, (relativePath) =>
      contents.get(relativePath),
    );
    if (JSON.stringify(innerLines) !== JSON.stringify(expectedInnerHashLines))
      fail("review package", "inner SHA manifest differs from the other 63 ZIP members");
  }

  if (!failures.some((entry) => entry.startsWith("review package")))
    ok("review package", `64 members, 63 payload hashes, ZIP SHA ${sha256Buffer(zipBuffer)}`);
}

function main() {
  let evidenceMode;
  try {
    evidenceMode = determineEvidenceMode(
      [TASK_03_MANIFEST, TASK_03_REVIEW, TASK_03_ZIP].map((relativePath) =>
        existsSync(absolute(relativePath)),
      ),
    );
  } catch (error) {
    console.error(`FAIL evidence gate: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  checkGitAndWorkspace();
  checkFrozenAnchors();
  checkRootAndPackageContracts();
  checkLockfile();
  checkCandidateMembers();
  checkSafetyAndPhaseBoundary();
  if (evidenceMode === "implementation") checkImplementationEvidence();
  else checkFinalEvidence();

  for (const message of verified) console.log(`OK ${message}`);
  if (failures.length > 0) {
    for (const message of failures) console.error(`FAIL ${message}`);
    process.exitCode = 1;
    return;
  }

  console.log(`EVIDENCE_MODE=${evidenceMode}`);
  console.log(
    evidenceMode === "implementation"
      ? "TASK_03_IMPLEMENTATION_VERIFY=PASS"
      : "TASK_03_FINAL_REVIEW_VERIFY=PASS",
  );
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) main();
