/* global Buffer, console, process */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_HEAD = "0c991fe2426d647644369d86b3e3ae595f4e0a41";
const TARGET_BRANCH = "feature/phase-1b-task-01-workspace-quality";
const BASE_CONTRACT_SHA = "117C382C91AE1FAB0D03E7BB452B89378E787A699F34D69E520DD75D7DEC3E24";
const AMENDMENT_SHA = "73BD643C6660334D1136BA32D9B3599C002E6152ED8F717C563C4202D2254108";
const MEMBER_LIST_SHA = "FDEB4361570446DD359A8032E4B581591EBB652D838D027F5BC337CEF21FCFAB";
const REVIEW_ZIP =
  "artifacts/review-package/student-care-platform-phase1b-task-01-review-pack-v1.0.zip";
const MANIFEST = "SHA256SUMS_PHASE_1B_TASK_01.txt";
const EXPECTED_MEMBERS = [
  ".prettierignore",
  ".prettierrc.json",
  "PHASE_1B_TASK_01_CODEX_EXECUTION.md",
  "PHASE_1B_TASK_01_RUNTIME_BASELINE_AMENDMENT_V1_1.md",
  MANIFEST,
  "apps/api/package.json",
  "apps/api/src/health/health.route.ts",
  "apps/api/src/index.ts",
  "apps/api/src/server.ts",
  "apps/api/test/health.route.test.ts",
  "apps/api/tsconfig.json",
  "docs/project/PHASE_1B_RUNTIME_BASELINE_DECISION.md",
  "docs/reviews/PHASE_1B_TASK_01_REVIEW.md",
  "eslint.config.mjs",
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "scripts/verify_task_01.mjs",
  "tests/workspace/paths.test.mjs",
  "tsconfig.base.json",
].sort();

const failures = [];
const warnings = [];
const passed = [];

function fail(check, detail) {
  failures.push(`${check}: ${detail}`);
}

function pass(check, detail) {
  passed.push(`${check}: ${detail}`);
}

function warn(check, detail) {
  warnings.push(`${check}: ${detail}`);
}

function text(relativePath) {
  return readFileSync(path.join(ROOT, relativePath), "utf8").replace(/\r\n/g, "\n");
}

function json(relativePath) {
  return JSON.parse(text(relativePath));
}

function sha256Buffer(buffer) {
  return createHash("sha256").update(buffer).digest("hex").toUpperCase();
}

function sha256File(relativePath) {
  return sha256Buffer(readFileSync(path.join(ROOT, relativePath)));
}

function command(file, args) {
  if (process.platform === "win32" && file === "corepack") {
    return execFileSync(
      process.env.ComSpec ?? "cmd.exe",
      ["/d", "/s", "/c", "corepack.cmd", ...args],
      {
        cwd: ROOT,
        encoding: "utf8",
      },
    ).trim();
  }
  return execFileSync(file, args, {
    cwd: ROOT,
    encoding: "utf8",
  }).trim();
}

function git(args) {
  return command("git", args);
}

function exists(relativePath) {
  return existsSync(path.join(ROOT, relativePath));
}

function semver(value) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(value);
  return match ? match.slice(1).map(Number) : null;
}

function inNode24Range(value) {
  const version = semver(value);
  return (
    version && version[0] === 24 && (version[1] > 14 || (version[1] === 14 && version[2] >= 0))
  );
}

function parseCentralDirectory(buffer) {
  const endSignature = 0x06054b50;
  let end = -1;
  for (let offset = buffer.length - 22; offset >= 0; offset -= 1) {
    if (buffer.readUInt32LE(offset) === endSignature) {
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
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error(`ZIP central-directory entry ${index} is invalid`);
    }
    const flags = buffer.readUInt16LE(offset + 8);
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");
    members.push({
      name,
      flags,
      method,
      compressedSize,
      uncompressedSize,
      localOffset,
    });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  if (offset - directoryOffset !== directorySize) {
    throw new Error("ZIP central-directory size does not match its entries");
  }
  return members;
}

function readZipMember(buffer, member) {
  if (member.flags & 0x08) throw new Error(`ZIP data descriptor is unsupported for ${member.name}`);
  if (buffer.readUInt32LE(member.localOffset) !== 0x04034b50) {
    throw new Error(`ZIP local header is missing for ${member.name}`);
  }
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

function checkRequiredFiles() {
  for (const relativePath of [
    "package.json",
    "pnpm-workspace.yaml",
    "pnpm-lock.yaml",
    "tsconfig.base.json",
    "eslint.config.mjs",
    ".prettierrc.json",
    ".prettierignore",
    "apps/api/package.json",
    "apps/api/tsconfig.json",
    "apps/api/src/health/health.route.ts",
    "apps/api/src/server.ts",
    "apps/api/src/index.ts",
    "apps/api/test/health.route.test.ts",
    "tests/workspace/paths.test.mjs",
    "scripts/verify_task_01.mjs",
    "docs/project/PHASE_1B_RUNTIME_BASELINE_DECISION.md",
    "docs/reviews/PHASE_1B_TASK_01_REVIEW.md",
    MANIFEST,
  ]) {
    if (!exists(relativePath)) fail("workspace structure", `missing ${relativePath}`);
  }
  if (failures.length === 0) pass("workspace structure", "required Task 01 paths exist");
  for (const forbidden of [
    ".npmrc",
    "apps/user-web",
    "apps/admin-web",
    "apps/mini-program",
    "packages",
  ]) {
    if (exists(forbidden)) fail("scope boundary", `forbidden path exists: ${forbidden}`);
  }
}

function checkContracts() {
  for (const [relativePath, expected] of [
    ["PHASE_1B_TASK_01_CODEX_EXECUTION.md", BASE_CONTRACT_SHA],
    ["PHASE_1B_TASK_01_RUNTIME_BASELINE_AMENDMENT_V1_1.md", AMENDMENT_SHA],
  ]) {
    const actual = sha256File(relativePath);
    if (actual !== expected) fail("contract integrity", `${relativePath} is ${actual}`);
  }
  if (!failures.some((entry) => entry.startsWith("contract integrity"))) {
    pass("contract integrity", "base contract and runtime amendment hashes match");
  }
}

function checkRuntime() {
  if (!inNode24Range(process.version))
    fail("runtime", `Node ${process.version} is outside >=24.14.0 <25.0.0`);
  const corepackVersion = command("corepack", ["--version"]);
  if (!inNode24Range(process.version) || !corepackVersion)
    fail("runtime", "Corepack version is unavailable");
  const pnpmVersion = command("corepack", ["pnpm", "--version"]);
  if (pnpmVersion !== "11.22.0") fail("runtime", `project-pinned pnpm resolved to ${pnpmVersion}`);
  if (!failures.some((entry) => entry.startsWith("runtime"))) {
    pass("runtime", `${process.version}, corepack ${corepackVersion}, pnpm ${pnpmVersion}`);
  }
}

function checkGit() {
  const branch = git(["branch", "--show-current"]);
  if (branch !== TARGET_BRANCH) fail("git provenance", `branch is ${branch}`);
  const head = git(["rev-parse", "HEAD"]);
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", SOURCE_HEAD, head], {
      cwd: ROOT,
      stdio: "ignore",
    });
  } catch {
    fail("git provenance", `${SOURCE_HEAD} is not an ancestor of ${head}`);
  }
  if (git(["remote"]).length > 0) fail("git safety", "a remote is configured");
  if (!failures.some((entry) => entry.startsWith("git provenance")))
    pass("git provenance", `${branch}, source ancestor verified`);
  if (!failures.some((entry) => entry.startsWith("git safety")))
    pass("git safety", "remote count is zero");
}

function checkManifests() {
  const rootPackage = json("package.json");
  const apiPackage = json("apps/api/package.json");
  const expectedDev = {
    "@eslint/js": "9.39.4",
    "@types/node": "24.13.3",
    eslint: "9.39.4",
    prettier: "3.9.6",
    typescript: "5.7.3",
    "typescript-eslint": "8.67.0",
  };
  if (rootPackage.packageManager !== "pnpm@11.22.0")
    fail("dependency policy", "packageManager pin is incorrect");
  if (
    rootPackage.engines?.node !== ">=24.14.0 <25.0.0" ||
    rootPackage.engines?.pnpm !== ">=11.22.0 <12.0.0"
  ) {
    fail("dependency policy", "engine ranges are incorrect");
  }
  if (JSON.stringify(rootPackage.devDependencies) !== JSON.stringify(expectedDev)) {
    fail("dependency policy", "root direct development dependencies differ from the approved set");
  }
  if (JSON.stringify(apiPackage.dependencies) !== JSON.stringify({ fastify: "5.12.1" })) {
    fail("dependency policy", "API direct dependency set differs from the approved set");
  }
  if (apiPackage.devDependencies)
    fail("dependency policy", "API has unapproved development dependencies");
  const workspace = text("pnpm-workspace.yaml");
  for (const line of [
    'packages:\n  - "apps/*"',
    "engineStrict: true",
    "strictPeerDependencies: true",
    "sharedWorkspaceLockfile: true",
    "ignoreScripts: true",
  ]) {
    if (!workspace.includes(line))
      fail("pnpm policy", `missing workspace setting: ${line.replace(/\n/g, " ")}`);
  }
  if (exists(".npmrc")) fail("pnpm policy", ".npmrc is not authorized");
  const lock = text("pnpm-lock.yaml");
  for (const line of [
    "lockfileVersion: '9.0'",
    "apps/api:",
    "version: 5.12.1",
    "typescript: 5.7.3",
  ]) {
    if (!lock.includes(line)) fail("lockfile", `missing ${line}`);
  }
  if (!/resolution:\s*\{integrity:\s*sha512-/.test(lock))
    fail("lockfile", "integrity fields are missing");
  if (/^\s+(?:file|link):\s/m.test(lock))
    fail("lockfile", "local dependency resolution is present");
  if (lock.includes("glob@10.5.0") && lock.includes("deprecated:")) {
    warn(
      "lockfile",
      "pnpm reported deprecated transitive glob@10.5.0; retained and documented for follow-up",
    );
  }
  if (!failures.some((entry) => entry.startsWith("dependency policy")))
    pass("dependency policy", "approved seven direct dependency categories only");
  if (!failures.some((entry) => entry.startsWith("pnpm policy")))
    pass("pnpm policy", "pnpm 11 settings are in pnpm-workspace.yaml");
  if (!failures.some((entry) => entry.startsWith("lockfile")))
    pass("lockfile", "lockfile v9 and integrity metadata present");
}

function packageMetadata(packageName, packageRoot) {
  const packagePath = path.join(
    ROOT,
    packageRoot,
    "node_modules",
    ...packageName.split("/"),
    "package.json",
  );
  return existsSync(packagePath) ? JSON.parse(readFileSync(packagePath, "utf8")) : null;
}

function checkPackageMetadata() {
  const selected = [
    ["fastify", "apps/api", "5.12.1"],
    ["@eslint/js", ".", "9.39.4"],
    ["@types/node", ".", "24.13.3"],
    ["eslint", ".", "9.39.4"],
    ["prettier", ".", "3.9.6"],
    ["typescript", ".", "5.7.3"],
    ["typescript-eslint", ".", "8.67.0"],
  ];
  const allowedLicenses = new Set(["MIT", "Apache-2.0"]);
  for (const [name, location, expectedVersion] of selected) {
    const metadata = packageMetadata(name, location);
    if (!metadata) {
      fail("package metadata", `${name} metadata is unavailable`);
      continue;
    }
    if (metadata.version !== expectedVersion)
      fail("package metadata", `${name} is ${metadata.version}`);
    if (!allowedLicenses.has(metadata.license))
      fail(
        "package metadata",
        `${name} license ${metadata.license ?? "missing"} is outside policy`,
      );
    for (const scriptName of ["preinstall", "install", "postinstall", "prepare"]) {
      if (metadata.scripts?.[scriptName])
        fail("package lifecycle", `${name} declares ${scriptName}`);
    }
  }
  if (!failures.some((entry) => entry.startsWith("package metadata")))
    pass("package metadata", "versions and licenses match the approved selection");
  if (!failures.some((entry) => entry.startsWith("package lifecycle")))
    pass("package lifecycle", "no selected package requires an install-time script");
}

function taskFiles() {
  return EXPECTED_MEMBERS.filter(
    (relativePath) => /\.(?:mjs|ts|json|yaml|md)$/.test(relativePath) && exists(relativePath),
  );
}

function checkStaticSafety() {
  const sourceFiles = EXPECTED_MEMBERS.filter(
    (relativePath) =>
      /\.(?:mjs|ts)$/.test(relativePath) &&
      relativePath !== "scripts/verify_task_01.mjs" &&
      exists(relativePath),
  );
  const secretPattern =
    /(-----BEGIN (?:RSA|EC|OPENSSH|PRIVATE) KEY-----|AKIA[0-9A-Z]{16}|(?:api[_-]?key|secret|token|password)\s*[:=]\s*["'][^"']{8,})/i;
  const personalPattern = /(?<!\d)1[3-9]\d{9}(?!\d)|(?<!\d)\d{17}[\dXx](?!\d)/;
  const networkPattern =
    /(?:fetch\s*\(|https?:\/\/|https?\.request|http\.request|axios|undici|net\.connect|dns\.lookup)/i;
  for (const relativePath of taskFiles()) {
    const content = text(relativePath);
    if (secretPattern.test(content)) fail("security scan", `secret-like value in ${relativePath}`);
    if (personalPattern.test(content))
      fail("security scan", `personal-data-like value in ${relativePath}`);
    if (sourceFiles.includes(relativePath) && networkPattern.test(content))
      fail("network boundary", `external-network pattern in ${relativePath}`);
  }
  const health = text("apps/api/src/health/health.route.ts");
  if (!health.includes('({ status: "ok" as const })'))
    fail("health route", "health route does not expose the exact safe response");
  if (/listen\s*\(|process\.env|database|redis|cos|tenant|campus|student|user/i.test(health)) {
    fail("health route", "health route contains a forbidden integration or data field");
  }
  const review = text("docs/reviews/PHASE_1B_TASK_01_REVIEW.md");
  if (!review.includes("TASK_01_COMMIT=RECORDED_IN_EXTERNAL_FINAL_RECEIPT_AFTER_COMMIT")) {
    fail("review evidence", "review report self-reference guard is missing");
  }
  if (!failures.some((entry) => entry.startsWith("security scan")))
    pass("security scan", "no secret or personal-data pattern in Task 01 files");
  if (!failures.some((entry) => entry.startsWith("network boundary")))
    pass("network boundary", "source and tests contain no external request pattern");
  if (!failures.some((entry) => entry.startsWith("health route")))
    pass("health route", "response is exactly { status: ok } and has no integration");
}

function checkZip() {
  const zipPath = path.join(ROOT, REVIEW_ZIP);
  if (!existsSync(zipPath)) {
    fail("review package", `missing ${REVIEW_ZIP}`);
    return;
  }
  const buffer = readFileSync(zipPath);
  const members = parseCentralDirectory(buffer);
  const names = members.map((member) => member.name);
  const sortedNames = [...names].sort();
  if (new Set(names).size !== names.length) fail("review package", "duplicate ZIP members exist");
  if (JSON.stringify(sortedNames) !== JSON.stringify(EXPECTED_MEMBERS))
    fail("review package", "ZIP member set differs from the approved 20 paths");
  const memberListHash = sha256Buffer(Buffer.from(`${sortedNames.join("\n")}\n`, "utf8"));
  if (memberListHash !== MEMBER_LIST_SHA)
    fail("review package", `member-list SHA is ${memberListHash}`);
  const contents = new Map(members.map((member) => [member.name, readZipMember(buffer, member)]));
  const innerManifest = contents.get(MANIFEST)?.toString("utf8").replace(/\r\n/g, "\n");
  if (!innerManifest) fail("review package", "inner manifest is missing");
  else {
    const lines = innerManifest.trimEnd().split("\n").sort();
    const expectedManifestLines = EXPECTED_MEMBERS.filter((name) => name !== MANIFEST)
      .map((name) => `${sha256Buffer(contents.get(name))}  ${name}`)
      .sort();
    if (JSON.stringify(lines) !== JSON.stringify(expectedManifestLines))
      fail("review package", "inner manifest does not match member hashes");
  }
  const rootManifest = text(MANIFEST).trimEnd().split("\n");
  const expectedRootHashLines = EXPECTED_MEMBERS.filter((name) => name !== MANIFEST)
    .map((name) => `${sha256File(name)}  ${name}`)
    .sort();
  const actualRootHashLines = rootManifest
    .filter((line) => !line.startsWith("REVIEW_PACKAGE_SHA256="))
    .sort();
  if (JSON.stringify(actualRootHashLines) !== JSON.stringify(expectedRootHashLines)) {
    fail("review package", "root manifest does not match current member hashes");
  }
  const zipHashLine = rootManifest.find((line) => line.startsWith("REVIEW_PACKAGE_SHA256="));
  const actualZipHash = sha256File(REVIEW_ZIP);
  if (zipHashLine !== `REVIEW_PACKAGE_SHA256=${actualZipHash}`)
    fail("review package", "root manifest ZIP hash is incorrect");
  if (!failures.some((entry) => entry.startsWith("review package")))
    pass("review package", "20 members, sorted-name SHA, inner manifest, and ZIP hash verified");
}

function checkZipSafety() {
  if (!exists(REVIEW_ZIP)) return;
  const buffer = readFileSync(path.join(ROOT, REVIEW_ZIP));
  const names = parseCentralDirectory(buffer).map((member) => member.name);
  for (const name of names) {
    if (name.startsWith("../") || name.includes("\\") || name.endsWith("/"))
      fail("review package safety", `unsafe member path ${name}`);
  }
  if (!failures.some((entry) => entry.startsWith("review package safety")))
    pass("review package safety", "ZIP paths are relative POSIX files only");
}

function main() {
  if (
    path.normalize(ROOT) !== path.normalize("C:\\Users\\HU\\Documents\\student-care-saas-platform")
  ) {
    fail("workspace root", `running from ${ROOT}`);
  } else pass("workspace root", ROOT);
  checkRequiredFiles();
  checkContracts();
  checkRuntime();
  checkGit();
  checkManifests();
  checkPackageMetadata();
  checkStaticSafety();
  checkZip();
  checkZipSafety();

  for (const message of passed) console.log(`PASS ${message}`);
  for (const message of warnings) console.log(`WARN ${message}`);
  if (failures.length > 0) {
    for (const message of failures) console.error(`FAIL ${message}`);
    process.exitCode = 1;
    return;
  }
  console.log("TASK_01_VERIFY=PASS");
}

main();
