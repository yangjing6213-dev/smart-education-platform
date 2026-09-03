/* global Buffer, console, process */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { inflateRawSync } from "node:zlib";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE_HEAD = "452e6cd81e5f57d10cfcee737077a91a6ba4d0fd";
const TARGET_BRANCH = "feature/phase-1b-task-04-identity-membership";
const ACTIVE_AUTHORITY_PATH = "docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V9.md";
const ACTIVE_AUTHORITY_SHA256 = "B4E53F632AC135925CBAE802CE360D361EE2394044C339137F11A9B045A96165";
const C1_MEMBER_ORDER_POLICY = "POSIX_RELATIVE_PATHS_CASEFOLDED_UNICODE_ORDINAL_ASCENDING";

const TASK_06_FILES = new Set([
  "AGENTS.md",
  "PLANS.md",
  "README.md",
  "docs/project/DECISION_BASELINE.md",
  "docs/project/SCOPE_AND_NON_SCOPE.md",
  "docs/plans/PHASE_1B_TASK_DEPENDENCY_GRAPH.md",
  "docs/plans/PHASE_1B_V0_1_IMPLEMENTATION_PLAN.md",
  "docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V6.md",
  "docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V5.md",
  "docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V8.md",
  "docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V7.md",
  "docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V9.md",
  "docs/reviews/PHASE_1B_TASK_06_REVIEW.md",
  "SHA256SUMS_PHASE_1B_TASK_06.txt",
  "artifacts/review-package/student-care-platform-phase1b-task-06-review-pack-v1.0.zip",
  "PHASE_1B_TASK_06_CODEX_EXECUTION.md",
  "docs/project/PHASE_1B_TASK_06_PLAN.md",
  "docs/project/PHASE_1B_TASK_06_ACCEPTANCE.md",
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
  "PHASE_1B_TASK_07_CODEX_EXECUTION.md",
  "docs/project/PHASE_1B_TASK_07_PLAN.md",
  "apps/api/src/modules/teachers/public-profile.service.ts",
  "apps/api/src/routes/public-teachers.route.ts",
  "apps/api/src/modules/teachers/public-profile.test.ts",
  "apps/admin-web/src/pages/public-teachers.tsx",
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

const C1_MUTABLE_MEMBERS = new Set([
  "PHASE_1B_TASK_06_CODEX_EXECUTION.md",
  "docs/project/PHASE_1B_TASK_06_PLAN.md",
  "scripts/verify_task_06.mjs",
]);

const FROZEN_HASHES = new Map([
  [ACTIVE_AUTHORITY_PATH, ACTIVE_AUTHORITY_SHA256],
  [
    "docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V8.md",
    "4CE2089247EF111CFCA78EC0AE7A6C06016F72E160E741F79AD6D6A1ECCF218B",
  ],
  [
    "docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V7.md",
    "073DC0C05BFFA151B009404A7DB67785411B5208B7DBC967A4CEC1EA03F4B489",
  ],
  [
    "docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V6.md",
    "E695C9455B75704BE1BB61CB06EC815F30857B048F2FF2131CA4E51F0D6ED7BD",
  ],
  [
    "docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V5.md",
    "BC8B2232F3203368BD712586464734614D0E56D062792AFA284F8794A50914DB",
  ],
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
  [
    "docs/project/PHASE_1B_TASK_06_ACCEPTANCE.md",
    "0B690B77CF4C08653FAE3495ABB9B218C640E8C4F02121CC14DEE0557850F68C",
  ],
  [
    "docs/reviews/PHASE_1B_TASK_06_REVIEW.md",
    "48C3799F74D56B300E03D155A1A9160A9930041598267F5862482573FF0E2A17",
  ],
  [
    "SHA256SUMS_PHASE_1B_TASK_06.txt",
    "92C49EE2DFDC594DD9F347BE4BA698958AF9BE1DCE8CEA4D1EE3BF19539DBBF5",
  ],
  [
    "artifacts/review-package/student-care-platform-phase1b-task-06-review-pack-v1.0.zip",
    "E30E444ACC507DC4CCF0053B3261545F5DED8C84D8C8293678C7F0EBA8208855",
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
  if (git(["branch", "--list", "*task-07*"])) fail("task branch", "Task 07 branch exists");
  if (git(["worktree", "list"]).toLowerCase().includes("task-06")) {
    fail("task worktree", "Task 06 worktree exists");
  }
  if (git(["worktree", "list"]).toLowerCase().includes("task-07")) {
    fail("task worktree", "Task 07 worktree exists");
  }
}

function checkRequiredFiles() {
  for (const relativePath of TASK_06_FILES) {
    if (relativePath === "pnpm-lock.yaml") continue;
    if (!existsSync(absolute(relativePath))) fail("required file", relativePath);
  }
  for (const relativePath of TASK_06_C1_C2_FILES) {
    if (!existsSync(absolute(relativePath))) fail("Task 06 C1 required file", relativePath);
  }
}

function checkActiveGovernance() {
  const activeReferenceFiles = [
    "AGENTS.md",
    "PLANS.md",
    "README.md",
    "docs/project/DECISION_BASELINE.md",
    "docs/project/SCOPE_AND_NON_SCOPE.md",
    "docs/plans/PHASE_1B_TASK_DEPENDENCY_GRAPH.md",
    "docs/plans/PHASE_1B_V0_1_IMPLEMENTATION_PLAN.md",
    "PHASE_1B_TASK_07_CODEX_EXECUTION.md",
    "docs/project/PHASE_1B_TASK_07_PLAN.md",
    "scripts/verify_task_06.mjs",
  ];
  for (const relativePath of activeReferenceFiles) {
    const content = readFileSync(absolute(relativePath), "utf8");
    if (!content.includes(ACTIVE_AUTHORITY_PATH)) {
      fail("active authority reference", `${relativePath} does not reference V9`);
    }
    if (!content.includes(ACTIVE_AUTHORITY_SHA256)) {
      fail("active authority reference", `${relativePath} does not reference the V9 SHA`);
    }
    if (/TASK_06_STAGE_C2_STATUS=(?:NOT_ACCEPTED|ABSENT)/.test(content)) {
      fail("active Task 06 state", `${relativePath} contains stale C2 status`);
    }
    if (/TASK_06_STAGE_C2_AUTHORIZATION=(?:NOT_GRANTED|ABSENT)/.test(content)) {
      fail("active Task 06 state", `${relativePath} contains stale C2 authorization`);
    }
  }
  const authority = readFileSync(absolute(ACTIVE_AUTHORITY_PATH), "utf8");
  for (const required of [
    "PHASE_1B_STARTED=YES_FOR_TASK_01_TO_TASK_07_STAGE_B_ONLY",
    "PHASE_1B_COMPLETED_TASKS=TASK_01|TASK_02|TASK_03|TASK_04|TASK_05|TASK_06",
    "PHASE_1B_ACTIVE_TASK=TASK_07_STAGE_B_REPAIR_AND_IMPLEMENTATION",
    "TASK_06_OWNER_REVIEW=ACCEPTED",
    "TASK_06_STAGE_C2_STATUS=ACCEPTED",
    "TASK_06_STAGE_C2_AUTHORIZATION=GRANTED",
    "TASK_07_STAGE_A_STATUS=OWNER_REVIEW_PASSED",
    "TASK_07_STAGE_B_STATUS=REPAIR_AND_IMPLEMENTATION_IN_PROGRESS",
    "TASK_07_STAGE_B_IMPLEMENTATION_AUTHORIZATION=GRANTED",
    "TASK_07_PLUS_STARTED=NO",
    "TASK_07_PLUS_AUTHORIZATION=NOT_GRANTED",
  ]) {
    if (!authority.includes(required)) fail("active authority state", required);
  }
}

function checkC2Acceptance() {
  const acceptancePath = "docs/project/PHASE_1B_TASK_06_ACCEPTANCE.md";
  const content = readFileSync(absolute(acceptancePath), "utf8");
  for (const required of [
    "TASK_ID=PHASE_1B_TASK_06",
    "STAGE=C2",
    "STATUS=ACCEPTED",
    "PROJECT_OWNER_ACCEPTANCE=PASS",
    "TASK_06_C2_STATUS=ACCEPTED",
    "TASK_06_C2_AUTHORIZATION=GRANTED",
    "TASK_07_PLUS_STARTED=NO",
    "STOP_REASON=TASK06_ACCEPTED_STOP_BEFORE_TASK07",
  ]) {
    if (!content.includes(required)) fail("C2 acceptance", `${acceptancePath} missing ${required}`);
  }
  if (
    content.includes(
      "TASK_06_ACCEPTANCE_SHA256=0B690B77CF4C08653FA3495ABB9B218C640E8C4F02121CC14DEE0557850F68C",
    )
  ) {
    fail("C2 acceptance", "acceptance must not contain its own SHA");
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

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function parseZipEntries(zip) {
  let eocd = -1;
  for (let offset = zip.length - 22; offset >= Math.max(0, zip.length - 65557); offset -= 1) {
    if (zip.readUInt32LE(offset) === 0x06054b50) {
      eocd = offset;
      break;
    }
  }
  if (eocd < 0) throw new Error("ZIP end-of-central-directory record is missing");
  const count = zip.readUInt16LE(eocd + 10);
  const directorySize = zip.readUInt32LE(eocd + 12);
  const directoryOffset = zip.readUInt32LE(eocd + 16);
  if (directoryOffset + directorySize > eocd) throw new Error("ZIP central directory is invalid");

  const entries = [];
  let offset = directoryOffset;
  for (let index = 0; index < count; index += 1) {
    if (zip.readUInt32LE(offset) !== 0x02014b50)
      throw new Error("ZIP central directory entry is invalid");
    const flags = zip.readUInt16LE(offset + 8);
    const method = zip.readUInt16LE(offset + 10);
    const modifiedTime = zip.readUInt16LE(offset + 12);
    const modifiedDate = zip.readUInt16LE(offset + 14);
    const expectedCrc = zip.readUInt32LE(offset + 16);
    const compressedSize = zip.readUInt32LE(offset + 20);
    const uncompressedSize = zip.readUInt32LE(offset + 24);
    const nameLength = zip.readUInt16LE(offset + 28);
    const extraLength = zip.readUInt16LE(offset + 30);
    const commentLength = zip.readUInt16LE(offset + 32);
    const localOffset = zip.readUInt32LE(offset + 42);
    const name = zip.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");
    if ((flags & 1) !== 0) throw new Error(`encrypted ZIP member ${name}`);
    if (modifiedDate !== 0x21 || modifiedTime !== 0) {
      throw new Error(`non-fixed ZIP timestamp ${name}`);
    }
    if (
      name.startsWith("/") ||
      name.includes("\\") ||
      name.split("/").includes("..") ||
      name.includes("\0")
    ) {
      throw new Error(`unsafe ZIP member path ${name}`);
    }
    if (zip.readUInt32LE(localOffset) !== 0x04034b50)
      throw new Error(`invalid local header ${name}`);
    const localNameLength = zip.readUInt16LE(localOffset + 26);
    const localExtraLength = zip.readUInt16LE(localOffset + 28);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = zip.subarray(dataOffset, dataOffset + compressedSize);
    const content = method === 0 ? compressed : method === 8 ? inflateRawSync(compressed) : null;
    if (content === null)
      throw new Error(`unsupported ZIP compression method ${method} for ${name}`);
    if (content.length !== uncompressedSize) throw new Error(`ZIP size mismatch ${name}`);
    if (crc32(content) !== expectedCrc) throw new Error(`ZIP CRC mismatch ${name}`);
    entries.push({ name, content, expectedCrc });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  if (offset !== directoryOffset + directorySize)
    throw new Error("ZIP central directory size mismatch");
  return entries;
}

function checkC1Package() {
  const manifestPath = absolute("SHA256SUMS_PHASE_1B_TASK_06.txt");
  const manifest = readFileSync(manifestPath, "utf8");
  const rows = manifest.endsWith("\n") ? manifest.slice(0, -1).split("\n") : [];
  if (rows.length !== 22) fail("C1 manifest", `expected 22 rows, got ${rows.length}`);
  const records = [];
  for (const row of rows) {
    const match = /^([A-F0-9]{64})  (.+)$/.exec(row);
    if (!match) fail("C1 manifest", `malformed row ${row}`);
    else records.push({ sha: match[1], name: match[2] });
  }
  const names = records.map(({ name }) => name);
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
    if (name.startsWith("/") || name.includes("\\") || name.split("/").includes(".."))
      fail("C1 manifest", `unsafe member path ${name}`);
  }

  const zip = readFileSync(
    absolute("artifacts/review-package/student-care-platform-phase1b-task-06-review-pack-v1.0.zip"),
  );
  let entries;
  try {
    entries = parseZipEntries(zip);
  } catch (error) {
    fail("C1 ZIP", error instanceof Error ? error.message : String(error));
    return;
  }
  const zipNames = entries.map(({ name }) => name);
  if (JSON.stringify(zipNames) !== JSON.stringify(names))
    fail("C1 ZIP", "member order differs from manifest");
  if (entries.length !== 22) fail("C1 ZIP", `expected 22 members, got ${entries.length}`);
  if (new Set(zipNames).size !== zipNames.length) fail("C1 ZIP", "duplicate member");
  for (const { name, content, expectedCrc } of entries) {
    const record = records.find((candidate) => candidate.name === name);
    const memberSha = createHash("sha256").update(content).digest("hex").toUpperCase();
    if (!record || record.sha !== memberSha) fail("C1 ZIP", `member SHA mismatch ${name}`);
    if (crc32(content) !== expectedCrc) fail("C1 ZIP", `member CRC mismatch ${name}`);
    if (!C1_MUTABLE_MEMBERS.has(name)) {
      if (!existsSync(absolute(name))) fail("C1 disk", `missing member ${name}`);
      else if (sha256File(name) !== memberSha)
        fail("C1 disk", `member differs from frozen ZIP ${name}`);
    }
  }
  if (zipNames.includes("SHA256SUMS_PHASE_1B_TASK_06.txt"))
    fail("C1 ZIP", "manifest is not detached");
  for (const excluded of [
    "docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V6.md",
    "docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V5.md",
    "docs/project/PHASE_1B_TASK_06_ACCEPTANCE.md",
    "docs/project/PHASE_1B_TASK_04_ACCEPTANCE.md",
    "docs/project/PHASE_1B_TASK_05_ACCEPTANCE.md",
  ]) {
    if (zipNames.includes(excluded)) fail("C1 ZIP", `excluded member present ${excluded}`);
  }
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
  const current = readFileSync(absolute("pnpm-lock.yaml"), "utf8");
  if (current !== before) fail("lockfile boundary", "pnpm-lock.yaml changed");
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
  checkActiveGovernance();
  checkC2Acceptance();
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
