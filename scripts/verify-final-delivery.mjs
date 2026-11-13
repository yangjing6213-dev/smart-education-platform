import { execFileSync } from "node:child_process";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { TextDecoder } from "node:util";
import { fileURLToPath, URL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const executionContract = "PHASE_1B_TASK_19_CODEX_EXECUTION.md";
const taskPlan = "docs/project/PHASE_1B_TASK_19_PLAN.md";
const implementationPlan = "docs/plans/PHASE_1B_V0_1_IMPLEMENTATION_PLAN.md";
const governancePath = "docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_V42.md";
const governanceSha256 = "7BECA819534A223D84C4D95FD117FC68C4B9CD4CDFC2E5345AF09E9547D188AB";
const expectedBranch = "feature/phase-1b-task-19-final-delivery-acceptance";
const continuationHead = "678fdf6171d845866403cfb22634c14e90a8904c";
const stageABaseline = continuationHead;
const expectedRemoteName = "origin";
const expectedRemoteBranch = expectedBranch;
const expectedRemoteCommit = "6f02fa113e69b14e05ca5a8ea03d3c1769aa8da2";
const task18Checkpoint = "e0c41bb859a87a031cf8b7d39373aea3b712681a";
const expectedLockSha256 = "01BCB5E41D0E3C786F5EACF933791BAB767ACF17B4487D919C04BB2582F4CD64";
const tempRoot = "artifacts/task-19/tmp/";
const untrackedBaselinePath = `${tempRoot}post-r1-existing-untracked-paths.txt`;
const reportRoot = "artifacts/final-delivery/task19";
const releaseReportPath = `${reportRoot}/release-verifier-report.json`;
const finalZipPath =
  "artifacts/release-package/student-care-platform-phase1b-v0.1-final-delivery-v1.0.zip";
const manifestPath = "SHA256SUMS_PHASE_1B_TASK_19.txt";
const reviewPath = "docs/reviews/PHASE_1B_TASK_19_FINAL_DELIVERY_REVIEW.md";
const prerequisiteReports = [
  `${reportRoot}/suite-evidence.json`,
  `${reportRoot}/browser-evidence.json`,
  `${reportRoot}/install-upgrade-rollback.json`,
  `${reportRoot}/performance-smoke.json`,
];
const routes = [
  ["/web/visitor/home", "web-visitor-home"],
  ["/web/staff/workbench", "web-staff-workbench"],
  ["/mini/visitor/home", "mini-visitor-home"],
  ["/mini/staff/workbench", "mini-staff-workbench"],
  ["/flow/ai-learning-assistant", "flow-ai-learning-assistant"],
  ["/flow/ai-teacher-summary", "flow-ai-teacher-summary"],
  ["/admin/audit-logs", "admin-audit-logs"],
];
const viewports = ["desktop-1440x1024", "mobile-390x844", "small-mobile-320x568"];
const screenshotPaths = routes.flatMap(([, slug]) =>
  viewports.map((viewport) => `${reportRoot}/browser/${slug}__${viewport}.png`),
);

function git(...args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8", windowsHide: true }).trim();
}

function tryGit(...args) {
  try {
    return git(...args);
  } catch {
    return "";
  }
}

function normalizePath(value) {
  return value.replaceAll("\\", "/");
}

function sorted(values) {
  return [...new Set(values.map(normalizePath))].sort((a, b) => {
    const folded = a.toLocaleLowerCase("en-US").localeCompare(b.toLocaleLowerCase("en-US"));
    return folded || a.localeCompare(b);
  });
}

function unique(values) {
  return [...new Set(values)];
}

export function sha256Bytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex").toUpperCase();
}

function sha256File(relativePath) {
  return sha256Bytes(readFileSync(resolve(root, relativePath)));
}

export function compareExactSet(actual, expected) {
  const actualSet = sorted(actual);
  const expectedSet = sorted(expected);
  const missing = expectedSet.filter((item) => !actualSet.includes(item));
  const extra = actualSet.filter((item) => !expectedSet.includes(item));
  return { ok: missing.length === 0 && extra.length === 0, missing, extra };
}

function isLocalRequest(value) {
  try {
    const url = new URL(value);
    if (["data:", "about:", "blob:"].includes(url.protocol)) return true;
    return (
      ["http:", "https:"].includes(url.protocol) &&
      ["127.0.0.1", "localhost", "::1"].includes(url.hostname)
    );
  } catch {
    return false;
  }
}

export function evaluateBrowserEvidence(evidence) {
  const blockers = [];
  const cases = Array.isArray(evidence?.cases) ? evidence.cases : [];
  const expected = routes.flatMap(([route]) => viewports.map((viewport) => `${route}|${viewport}`));
  const actual = cases.map((item) => `${item?.route}|${item?.viewport}`);
  const set = compareExactSet(actual, expected);
  blockers.push(...set.missing.map((item) => `BROWSER_CASE_MISSING:${item}`));
  blockers.push(...set.extra.map((item) => `BROWSER_CASE_UNEXPECTED:${item}`));
  for (const item of cases) {
    const id = `${item?.route ?? "UNKNOWN"}|${item?.viewport ?? "UNKNOWN"}`;
    if (typeof item?.heading !== "string" || item.heading.trim() === "")
      blockers.push(`HEADING_MISSING:${id}`);
    if (!Number.isFinite(item?.durationMs) || item.durationMs < 0)
      blockers.push(`DURATION_INVALID:${id}`);
    if (!Number.isFinite(item?.horizontalOverflowPx) || item.horizontalOverflowPx !== 0) {
      blockers.push(`HORIZONTAL_OVERFLOW:${id}`);
    }
    for (const field of [
      "overlap",
      "clipping",
      "unreadableControls",
      "brokenFocusOrder",
      "missingFocusIndicator",
    ]) {
      if (item?.[field] !== false) blockers.push(`VISUAL_${field.toUpperCase()}:${id}`);
    }
    for (const field of ["pageErrors", "severeConsoleErrors", "failedRequests"]) {
      for (const value of item?.[field] ?? [])
        blockers.push(`${field.toUpperCase()}:${id}:${value}`);
    }
    for (const request of item?.requests ?? [])
      if (!isLocalRequest(request)) blockers.push(`EXTERNAL_REQUEST:${id}:${request}`);
    if (!/^[0-9A-F]{64}$/u.test(item?.screenshotSha256 ?? ""))
      blockers.push(`SCREENSHOT_SHA_INVALID:${id}`);
  }
  return { ok: blockers.length === 0, blockers: unique(blockers) };
}

export function evaluateSuiteEvidence(evidence) {
  const blockers = [];
  const commands = Array.isArray(evidence?.commands) ? evidence.commands : [];
  const required = Array.isArray(evidence?.requiredCommandIds) ? evidence.requiredCommandIds : [];
  for (const id of required) {
    const command = commands.find((item) => item?.id === id);
    if (!command) blockers.push(`COMMAND_MISSING:${id}`);
    else if (command.exitCode !== 0) blockers.push(`COMMAND_FAILED:${id}:${command.exitCode}`);
  }
  for (const command of commands) {
    if (typeof command?.id !== "string" || !Number.isInteger(command?.exitCode))
      blockers.push("COMMAND_RECORD_INVALID");
  }
  return { ok: blockers.length === 0, blockers: unique(blockers) };
}

export function evaluateHistoricalRepositoryLifecycle(evidence) {
  if (evidence?.exitCode === 0) {
    return {
      ok: true,
      blockers: [],
      classification: "HISTORICAL_EVIDENCE_AVAILABLE",
      originalEvidence: evidence,
    };
  }

  const acceptedException =
    Number.isInteger(evidence?.exitCode) &&
    evidence.exitCode !== 0 &&
    evidence?.TASK18_HISTORICAL_LIFECYCLE_EVIDENCE === "UNAVAILABLE" &&
    evidence?.OWNER_ACCEPTED_HISTORICAL_EXCEPTION === "YES" &&
    evidence?.CURRENT_EQUIVALENT_LIFECYCLE === "PASS_SUPPLEMENTARY_ONLY" &&
    evidence?.failure?.blocker === "CHECKPOINT_UNTRACKED_COUNT_MISMATCH:0";

  if (!acceptedException) {
    return {
      ok: false,
      blockers: ["TASK18_HISTORICAL_LIFECYCLE_FAILED"],
      classification: "HISTORICAL_LIFECYCLE_FAILED",
      originalEvidence: evidence ?? null,
    };
  }

  return {
    ok: true,
    blockers: [],
    classification: "HISTORICAL_EVIDENCE_UNAVAILABLE",
    TASK18_HISTORICAL_LIFECYCLE_EVIDENCE: "UNAVAILABLE",
    OWNER_ACCEPTED_HISTORICAL_EXCEPTION: "YES",
    CURRENT_EQUIVALENT_LIFECYCLE: "PASS_SUPPLEMENTARY_ONLY",
    originalEvidence: evidence,
  };
}

export function evaluateHistoricalEvidence(evidence) {
  const blockers = [];
  const task06 = evidence?.task06 ?? {};
  const task06Accepted =
    task06.TASK06_HISTORICAL_EVIDENCE === "UNAVAILABLE" &&
    task06.OWNER_ACCEPTED_HISTORICAL_EXCEPTION === "YES" &&
    task06.CURRENT_EQUIVALENT_PACKAGE_BOUNDARY === "PASS_SUPPLEMENTARY_ONLY" &&
    task06.CURRENT_EQUIVALENT_CANNOT_REPLACE_HISTORICAL_EVIDENCE === true;
  if (!task06Accepted) blockers.push("TASK06_HISTORICAL_EXCEPTION_INVALID");

  const task18 = evaluateHistoricalRepositoryLifecycle(evidence?.task18);
  if (!task18.ok) blockers.push(...task18.blockers);

  return {
    ok: blockers.length === 0,
    blockers: unique(blockers),
    classification: blockers.length === 0 ? "HISTORICAL_EVIDENCE_UNAVAILABLE" : "BLOCKED",
    currentEquivalentCannotReplaceHistoricalEvidence: true,
    task06: {
      classification: "HISTORICAL_EVIDENCE_UNAVAILABLE",
      historicalEvidence: task06.TASK06_HISTORICAL_EVIDENCE,
      ownerAcceptedException: task06.OWNER_ACCEPTED_HISTORICAL_EXCEPTION,
    },
    task18,
  };
}

export function evaluateRepositoryContext(actual, expected = {}) {
  const target = {
    branch: expected.branch ?? expectedBranch,
    head: expected.head ?? continuationHead,
    remoteNames: expected.remoteNames ?? [expectedRemoteName],
    remoteBranch: expected.remoteBranch ?? expectedRemoteBranch,
    remoteCommit: expected.remoteCommit ?? expectedRemoteCommit,
  };
  const blockers = [];
  const branch = actual?.branch ?? "";
  const head = actual?.head ?? "";
  const remoteNames = Array.isArray(actual?.remoteNames) ? actual.remoteNames : [];
  if (branch !== target.branch) blockers.push(`BRANCH_MISMATCH:${branch || "DETACHED"}`);
  if (head !== target.head) blockers.push(`HEAD_MISMATCH:${head || "MISSING"}`);
  if (JSON.stringify(remoteNames) !== JSON.stringify(target.remoteNames))
    blockers.push(`REMOTE_NAMES_MISMATCH:${remoteNames.join(",") || "NONE"}`);
  if (actual?.remoteBranch !== target.remoteBranch)
    blockers.push(`REMOTE_BRANCH_MISMATCH:${actual?.remoteBranch || "MISSING"}`);
  if (actual?.remoteCommit !== target.remoteCommit)
    blockers.push(`REMOTE_TRACKING_COMMIT_MISMATCH:${actual?.remoteCommit || "MISSING"}`);
  return { ok: blockers.length === 0, blockers: unique(blockers), actual, expected: target };
}

export function evaluateProtectedInputs({
  expectedPaths = [],
  expectedMetadata = [],
  records = [],
}) {
  const blockers = [];
  const expected = new Set(expectedPaths.map(normalizePath));
  const actual = records.map((record) => normalizePath(record?.relativePath ?? ""));
  if (new Set(actual).size !== actual.length) blockers.push("PROTECTED_INPUT_DUPLICATE");
  const paths = compareExactSet(actual, [...expected]);
  blockers.push(...paths.missing.map((path) => `PROTECTED_INPUT_MISSING:${path}`));
  blockers.push(...paths.extra.map((path) => `PROTECTED_INPUT_UNEXPECTED:${path}`));
  const metadataByPath = new Map(
    expectedMetadata.map((item) => [normalizePath(item.relativePath), item]),
  );
  for (const record of records) {
    const path = normalizePath(record?.relativePath ?? "");
    if (!/^[0-9A-F]{64}$/u.test(record.sha256 ?? ""))
      blockers.push(`PROTECTED_SHA_INVALID:${path}`);
    const expectedItem = metadataByPath.get(path);
    if (!expectedItem) continue;
    if (record.type !== expectedItem.type) blockers.push(`PROTECTED_TYPE_MISMATCH:${path}`);
    if (record.size !== expectedItem.size) blockers.push(`PROTECTED_SIZE_MISMATCH:${path}`);
    if (Math.abs(Number(record.mtimeMs) - Number(expectedItem.mtimeMs)) > 1)
      blockers.push(`PROTECTED_MTIME_MISMATCH:${path}`);
  }
  return { ok: blockers.length === 0, blockers: unique(blockers), records };
}

function registeredUntrackedPaths() {
  if (!existsSync(resolve(root, untrackedBaselinePath))) return null;
  return readFileSync(resolve(root, untrackedBaselinePath), "utf8")
    .split(/\r?\n/u)
    .filter(Boolean)
    .map(normalizePath);
}

function normalizeRepositoryRelativePath(value) {
  if (typeof value !== "string") return null;
  const normalized = normalizePath(value);
  if (
    normalized.length === 0 ||
    normalized.startsWith("/") ||
    /^[A-Za-z]:\//u.test(normalized) ||
    normalized.includes("\0")
  )
    return null;
  const segments = normalized.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === ".."))
    return null;
  return normalized;
}

export function evaluateUntrackedBoundary(actualPaths, registeredPaths, permanentPaths = []) {
  if (!registeredPaths) {
    return { ok: false, blockers: [`UNTRACKED_BASELINE_MISSING:${untrackedBaselinePath}`] };
  }

  const blockers = [];
  const permanent = new Set(
    permanentPaths.map(normalizeRepositoryRelativePath).filter((path) => path !== null),
  );
  const invalidPaths = [];
  const normalizeList = (paths) =>
    paths.map((path) => {
      const normalized = normalizeRepositoryRelativePath(path);
      if (normalized === null) invalidPaths.push(String(path));
      return normalized;
    });
  const normalizedActual = normalizeList(actualPaths);
  const normalizedRegistered = normalizeList(registeredPaths);
  const comparable = (paths) =>
    paths.filter((path) => path !== null && path !== untrackedBaselinePath);
  const comparableActual = comparable(normalizedActual);
  const comparableRegistered = comparable(normalizedRegistered);
  const comparison = compareExactSet(comparableActual, comparableRegistered);
  const registeredSet = new Set(comparableRegistered);
  const missingPermanent = new Set([...permanent].filter((path) => !registeredSet.has(path)));
  const added = comparison.extra.filter((path) => !registeredSet.has(path));
  const allowedAdded = added.filter((path) => missingPermanent.has(path));
  const unexpectedAdded = added.filter((path) => !missingPermanent.has(path));

  blockers.push(...invalidPaths.map((path) => `UNTRACKED_PATH_ADDED:${path}`));
  blockers.push(...comparison.missing.map((path) => `UNTRACKED_PATH_REMOVED:${path}`));
  blockers.push(...unexpectedAdded.map((path) => `UNTRACKED_PATH_ADDED:${path}`));

  return {
    ok: blockers.length === 0,
    blockers: unique(blockers),
    registeredCount: comparableRegistered.length,
    actualCount: comparableActual.length,
    declaredPermanentPathCount: permanent.size,
    missingPermanentPaths: [...missingPermanent].sort(),
    addedPermanentPaths: allowedAdded,
    unexpectedAddedPaths: unexpectedAdded,
  };
}

function inspectPermanentOutputPaths(permanentPaths) {
  const blockers = [];
  const rootReal = realpathSync.native(root).toLowerCase();
  const records = [];
  for (const relativePath of permanentPaths) {
    const normalized = normalizeRepositoryRelativePath(relativePath);
    if (normalized === null) {
      blockers.push(`PERMANENT_PATH_INVALID:${relativePath}`);
      continue;
    }
    const absolutePath = resolve(root, normalized);
    try {
      const lstat = lstatSync(absolutePath);
      const real = realpathSync.native(absolutePath).toLowerCase();
      const inside = real === rootReal || real.startsWith(`${rootReal}\\`);
      const record = {
        relativePath: normalized,
        type: lstat.isFile() ? "file" : lstat.isDirectory() ? "directory" : "other",
        symbolicLink: lstat.isSymbolicLink(),
        inside,
      };
      records.push(record);
      if (!lstat.isFile()) blockers.push(`PERMANENT_PATH_NOT_FILE:${normalized}`);
      if (lstat.isSymbolicLink()) blockers.push(`PERMANENT_PATH_SYMLINK:${normalized}`);
      if (!inside) blockers.push(`PERMANENT_PATH_OUT_OF_BOUND:${normalized}`);
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      blockers.push(`PERMANENT_PATH_UNREADABLE:${normalized}`);
    }
  }
  return { ok: blockers.length === 0, blockers: unique(blockers), records };
}

function protectedInputCheck(lists) {
  const ledgerPath = "artifacts/task-19/tmp/run-ledger.json";
  if (!existsSync(resolve(root, ledgerPath)))
    return { ok: false, blockers: [`LEDGER_MISSING:${ledgerPath}`] };
  let ledger;
  try {
    ledger = JSON.parse(readFileSync(resolve(root, ledgerPath), "utf8"));
  } catch {
    return { ok: false, blockers: [`LEDGER_INVALID:${ledgerPath}`] };
  }
  const expectedMetadata = ledger?.baseline?.protectedMetadata;
  if (!Array.isArray(expectedMetadata))
    return { ok: false, blockers: ["PROTECTED_METADATA_MISSING"] };
  const records = [];
  const rootReal = realpathSync.native(root).toLowerCase();
  for (const relativePath of lists.protected) {
    const absolutePath = resolve(root, relativePath);
    try {
      const lstat = lstatSync(absolutePath);
      const real = realpathSync.native(absolutePath).toLowerCase();
      const inside = real === rootReal || real.startsWith(`${rootReal}\\`);
      const type = lstat.isFile() ? "file" : lstat.isDirectory() ? "directory" : "other";
      const record = {
        relativePath,
        type,
        size: lstat.isFile() ? lstat.size : 0,
        mtimeMs: lstat.mtimeMs,
        sha256: lstat.isFile() && inside ? sha256Bytes(readFileSync(absolutePath)) : "",
      };
      records.push(record);
      if (!inside) record.sha256 = "";
      if (lstat.isSymbolicLink() || !inside) record.type = "out-of-bound-link";
    } catch {
      records.push({ relativePath, type: "missing", size: 0, mtimeMs: 0, sha256: "" });
    }
  }
  const result = evaluateProtectedInputs({
    expectedPaths: lists.protected,
    expectedMetadata,
    records,
  });
  return {
    ...result,
    count: records.length,
    contentSha256Count: records.filter((record) => /^[0-9A-F]{64}$/u.test(record.sha256)).length,
  };
}

export function evaluateSecurityEvidence(evidence) {
  const blockers = [];
  for (const key of [
    "tenantBoundary",
    "campusBoundary",
    "permissionDenials",
    "auditExactlyOnce",
    "auditRollbackZero",
    "minorDataSyntheticOnly",
  ]) {
    if (evidence?.[key] !== true) blockers.push(`SECURITY_ASSERTION_FAILED:${key}`);
  }
  for (const request of evidence?.externalRequests ?? [])
    blockers.push(`EXTERNAL_REQUEST:${request}`);
  return { ok: blockers.length === 0, blockers: unique(blockers) };
}

export function evaluatePerformanceEvidence(evidence) {
  const blockers = [];
  if (evidence?.smokeOnly !== true) blockers.push("PERFORMANCE_NOT_SMOKE_ONLY");
  if (evidence?.slaClaimed === true) blockers.push("NUMERIC_SLA_CLAIM_PROHIBITED");
  const measurements = Array.isArray(evidence?.measurements) ? evidence.measurements : [];
  if (measurements.length === 0) blockers.push("PERFORMANCE_MEASUREMENTS_MISSING");
  for (const measurement of measurements) {
    if (
      typeof measurement?.name !== "string" ||
      !Number.isFinite(measurement?.durationMs) ||
      measurement.durationMs < 0
    ) {
      blockers.push("PERFORMANCE_MEASUREMENT_INVALID");
    }
    if (!Number.isInteger(measurement?.errors) || measurement.errors < 0)
      blockers.push("PERFORMANCE_ERROR_COUNT_INVALID");
  }
  return { ok: blockers.length === 0, blockers: unique(blockers) };
}

export function parseDetachedManifest(bytes, ownPath = manifestPath) {
  const blockers = [];
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf)
    blockers.push("MANIFEST_BOM");
  if (bytes.includes(0x0d)) blockers.push("MANIFEST_NON_LF");
  if (bytes.length === 0 || bytes.at(-1) !== 0x0a || (bytes.length > 1 && bytes.at(-2) === 0x0a))
    blockers.push("MANIFEST_TERMINAL_LF_INVALID");
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    blockers.push("MANIFEST_UTF8_INVALID");
  }
  const entries = [];
  for (const line of bytes.toString("utf8").split("\n").filter(Boolean)) {
    const match = line.match(/^([0-9A-F]{64}) {2}([^\\].*)$/u);
    if (!match || match[2].includes("\\")) blockers.push(`MANIFEST_LINE_INVALID:${line}`);
    else entries.push({ sha256: match[1], path: match[2] });
  }
  if (entries.some((entry) => entry.path === ownPath)) blockers.push("MANIFEST_SELF_REFERENCE");
  if (entries.some((entry) => entry.path === finalZipPath)) blockers.push("MANIFEST_ZIP_REFERENCE");
  const paths = entries.map((entry) => entry.path);
  if (new Set(paths).size !== paths.length) blockers.push("MANIFEST_DUPLICATE_PATH");
  if (JSON.stringify(paths) !== JSON.stringify(sorted(paths)))
    blockers.push("MANIFEST_ORDER_INVALID");
  return { ok: blockers.length === 0, blockers: unique(blockers), entries };
}

const crcTable = new Uint32Array(256).map((_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function localHeader(name, bytes, crc) {
  const nameBytes = Buffer.from(name, "utf8");
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0x0800, 6);
  header.writeUInt16LE(0, 8);
  header.writeUInt16LE(0, 10);
  header.writeUInt16LE(0x0021, 12);
  header.writeUInt32LE(crc, 14);
  header.writeUInt32LE(bytes.length, 18);
  header.writeUInt32LE(bytes.length, 22);
  header.writeUInt16LE(nameBytes.length, 26);
  return Buffer.concat([header, nameBytes]);
}

function centralHeader(name, bytes, crc, offset) {
  const nameBytes = Buffer.from(name, "utf8");
  const header = Buffer.alloc(46);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(20, 6);
  header.writeUInt16LE(0x0800, 8);
  header.writeUInt16LE(0, 10);
  header.writeUInt16LE(0, 12);
  header.writeUInt16LE(0x0021, 14);
  header.writeUInt32LE(crc, 16);
  header.writeUInt32LE(bytes.length, 20);
  header.writeUInt32LE(bytes.length, 24);
  header.writeUInt16LE(nameBytes.length, 28);
  header.writeUInt32LE(offset, 42);
  return Buffer.concat([header, nameBytes]);
}

export function buildDeterministicZip(members) {
  const ordered = [...members]
    .map((member) => ({ name: normalizePath(member.name), bytes: Buffer.from(member.bytes) }))
    .sort((a, b) => (sorted([a.name, b.name])[0] === a.name ? -1 : 1));
  const local = [];
  const central = [];
  let offset = 0;
  for (const member of ordered) {
    const crc = crc32(member.bytes);
    const header = localHeader(member.name, member.bytes, crc);
    local.push(header, member.bytes);
    central.push(centralHeader(member.name, member.bytes, crc, offset));
    offset += header.length + member.bytes.length;
  }
  const centralBytes = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(ordered.length, 8);
  eocd.writeUInt16LE(ordered.length, 10);
  eocd.writeUInt32LE(centralBytes.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, centralBytes, eocd]);
}

export function parseZip(bytes) {
  const blockers = [];
  const eocdOffset = bytes.length - 22;
  if (eocdOffset < 0 || bytes.readUInt32LE(eocdOffset) !== 0x06054b50)
    return { ok: false, blockers: ["ZIP_EOCD_INVALID"], members: [] };
  const count = bytes.readUInt16LE(eocdOffset + 10);
  const centralOffset = bytes.readUInt32LE(eocdOffset + 16);
  let cursor = centralOffset;
  const members = [];
  for (let index = 0; index < count; index += 1) {
    if (bytes.readUInt32LE(cursor) !== 0x02014b50) {
      blockers.push("ZIP_CENTRAL_HEADER_INVALID");
      break;
    }
    const flags = bytes.readUInt16LE(cursor + 8);
    const method = bytes.readUInt16LE(cursor + 10);
    const time = bytes.readUInt16LE(cursor + 12);
    const date = bytes.readUInt16LE(cursor + 14);
    const crc = bytes.readUInt32LE(cursor + 16);
    const compressedLength = bytes.readUInt32LE(cursor + 20);
    const length = bytes.readUInt32LE(cursor + 24);
    const nameLength = bytes.readUInt16LE(cursor + 28);
    const extraLength = bytes.readUInt16LE(cursor + 30);
    const commentLength = bytes.readUInt16LE(cursor + 32);
    const localOffset = bytes.readUInt32LE(cursor + 42);
    const name = bytes.subarray(cursor + 46, cursor + 46 + nameLength).toString("utf8");
    if (bytes.readUInt32LE(localOffset) !== 0x04034b50)
      blockers.push(`ZIP_LOCAL_HEADER_INVALID:${name}`);
    const localNameLength = bytes.readUInt16LE(localOffset + 26);
    const localExtraLength = bytes.readUInt16LE(localOffset + 28);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    const data = bytes.subarray(dataOffset, dataOffset + compressedLength);
    members.push({ name, flags, method, time, date, crc, length, compressedLength, data });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return { ok: blockers.length === 0, blockers, members };
}

export function validateZip(bytes, expectedMembers) {
  const parsed = parseZip(bytes);
  const blockers = [...parsed.blockers];
  const expected = new Map(
    expectedMembers.map((member) => [normalizePath(member.name), Buffer.from(member.bytes)]),
  );
  const set = compareExactSet(
    parsed.members.map((member) => member.name),
    [...expected.keys()],
  );
  blockers.push(...set.missing.map((path) => `ZIP_MEMBER_MISSING:${path}`));
  blockers.push(...set.extra.map((path) => `ZIP_MEMBER_EXTRA:${path}`));
  for (const member of parsed.members) {
    const source = expected.get(member.name);
    if (member.flags !== 0x0800) blockers.push(`ZIP_UTF8_FLAG_INVALID:${member.name}`);
    if (member.method !== 0) blockers.push(`ZIP_METHOD_NOT_STORED:${member.name}`);
    if (member.time !== 0 || member.date !== 0x0021)
      blockers.push(`ZIP_TIMESTAMP_INVALID:${member.name}`);
    if (member.length !== member.compressedLength || member.length !== member.data.length)
      blockers.push(`ZIP_LENGTH_INVALID:${member.name}`);
    if (crc32(member.data) !== member.crc) blockers.push(`ZIP_CRC_INVALID:${member.name}`);
    if (source && !member.data.equals(source))
      blockers.push(`ZIP_SOURCE_BYTES_MISMATCH:${member.name}`);
  }
  return { ok: blockers.length === 0, blockers: unique(blockers), members: parsed.members };
}

function contractLists() {
  const text = readFileSync(resolve(root, executionContract), "utf8");
  const product = [];
  const evidence = [];
  let target = null;
  for (const line of text.split(/\r?\n/u)) {
    if (line === "The 13 proposed product inputs are:") {
      target = product;
      continue;
    }
    if (line === "The 58 proposed frozen-evidence inputs are:") {
      target = evidence;
      continue;
    }
    const match = target && line.match(/^\d+\. `([^`]+)`$/u);
    if (match) target.push(match[1]);
    if (target && line.startsWith("Repository-external execution-receipt JSON")) target = null;
  }
  const section = text.slice(
    text.indexOf("## 5. Future Stage B permanent write whitelist"),
    text.indexOf("## 6. Future Stage B temporary writes and cleanup"),
  );
  const permanent = [...section.matchAll(/^\d+\. `([^`]+)`$/gmu)].map((match) => match[1]);
  return { product, evidence, protected: [...product, ...evidence], permanent };
}

function isAncestor(ancestor, descendant) {
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

function inspectText(relativePath) {
  const blockers = [];
  const bytes = readFileSync(resolve(root, relativePath));
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf)
    blockers.push(`UTF8_BOM:${relativePath}`);
  if (bytes.includes(0x0d)) blockers.push(`NON_LF:${relativePath}`);
  if (bytes.length === 0 || bytes.at(-1) !== 0x0a || (bytes.length > 1 && bytes.at(-2) === 0x0a))
    blockers.push(`TERMINAL_LF_INVALID:${relativePath}`);
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    blockers.push(`UTF8_INVALID:${relativePath}`);
  }
  return blockers;
}

export function inspectStructure() {
  const blockers = [];
  const lists = contractLists();
  if (lists.product.length !== 13) blockers.push(`PRODUCT_PATH_COUNT:${lists.product.length}`);
  if (lists.evidence.length !== 58) blockers.push(`EVIDENCE_PATH_COUNT:${lists.evidence.length}`);
  if (lists.protected.length !== 71)
    blockers.push(`PROTECTED_PATH_COUNT:${lists.protected.length}`);
  if (lists.permanent.length !== 31)
    blockers.push(`PERMANENT_PATH_COUNT:${lists.permanent.length}`);
  const branch = git("branch", "--show-current");
  const head = git("rev-parse", "HEAD");
  const repository = evaluateRepositoryContext({
    branch,
    head,
    remoteNames: tryGit("remote").split(/\r?\n/u).filter(Boolean),
    remoteBranch: tryGit(
      "rev-parse",
      "--abbrev-ref",
      `refs/remotes/${expectedRemoteName}/${expectedRemoteBranch}`,
    ).replace(`${expectedRemoteName}/`, ""),
    remoteCommit: tryGit("rev-parse", `refs/remotes/${expectedRemoteName}/${expectedRemoteBranch}`),
  });
  blockers.push(...repository.blockers);
  if (!isAncestor(stageABaseline, head)) blockers.push(`HEAD_NOT_STAGE_A_DESCENDANT:${head}`);
  const tracked = git("diff", "--name-only").split(/\r?\n/u).filter(Boolean);
  const staged = git("diff", "--cached", "--name-only").split(/\r?\n/u).filter(Boolean);
  const authorizedControlPlaneChanges = new Set([
    executionContract,
    taskPlan,
    "scripts/verify-final-delivery.mjs",
    "tests/release/final-delivery.spec.ts",
  ]);
  const unexpectedTracked = tracked.filter((path) => !authorizedControlPlaneChanges.has(path));
  if (unexpectedTracked.length)
    blockers.push(`TRACKED_WORKTREE_DIRTY:${unexpectedTracked.join(",")}`);
  if (staged.length) blockers.push(`INDEX_DIRTY:${staged.join(",")}`);
  if (sha256File(governancePath) !== governanceSha256) blockers.push("V42_SHA_MISMATCH");
  if (sha256File("pnpm-lock.yaml") !== expectedLockSha256) blockers.push("LOCKFILE_SHA_MISMATCH");
  if (
    readFileSync(resolve(root, "package.json"), "utf8").includes(
      '"packageManager": "pnpm@11.22.0"',
    ) === false
  )
    blockers.push("PACKAGE_MANAGER_MISMATCH");
  for (const version of ["V43", "V44"])
    if (
      existsSync(
        resolve(root, `docs/project/PHASE_1B_GOVERNANCE_AND_API_FRAMEWORK_AUTHORITY_${version}.md`),
      )
    )
      blockers.push(`PARALLEL_GOVERNANCE:${version}`);
  for (const path of [executionContract, taskPlan, implementationPlan])
    blockers.push(...inspectText(path));
  const protectedInputs = protectedInputCheck(lists);
  blockers.push(...protectedInputs.blockers);
  const permanentOutputs = inspectPermanentOutputPaths(lists.permanent);
  blockers.push(...permanentOutputs.blockers);
  const untracked = git("ls-files", "--others", "--exclude-standard")
    .split(/\r?\n/u)
    .filter(Boolean)
    .map(normalizePath);
  const untrackedBoundary = evaluateUntrackedBoundary(
    untracked,
    registeredUntrackedPaths(),
    lists.permanent,
  );
  blockers.push(...untrackedBoundary.blockers);
  return {
    status: blockers.length ? "BLOCKED" : "PASS",
    blockers: unique(blockers),
    branch,
    head,
    task18Checkpoint,
    repository,
    protectedInputs,
    permanentOutputs,
    untrackedBoundary,
    authorizedControlPlaneChanges: tracked.filter((path) =>
      authorizedControlPlaneChanges.has(path),
    ),
    lists,
  };
}

function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalJson(value[key])]),
    );
  }
  return value;
}

function moduleSpecifiers(content) {
  return [
    ...content.matchAll(
      /(?:\bfrom\s+|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*)["']([^"']+)["']/g,
    ),
  ].map((match) => match[1]);
}

function forbiddenImports(files, forbidden) {
  const findings = [];
  for (const file of files) {
    for (const specifier of moduleSpecifiers(file.content)) {
      for (const item of forbidden) {
        if (specifier === item || specifier.startsWith(`${item}/`))
          findings.push(`${file.path} -> ${item}`);
      }
    }
  }
  return findings;
}

export function inspectCurrentPackageBoundary() {
  const blockers = [];
  const readPackage = (path) => JSON.parse(readFileSync(resolve(root, path), "utf8"));
  const expectedDependencies = {
    "packages/auth/package.json": { "@student-care/contracts": "workspace:*" },
    "packages/validation/package.json": {
      "@student-care/contracts": "workspace:*",
      zod: "3.25.76",
    },
    "packages/tenant/package.json": { "@student-care/validation": "workspace:*" },
    "apps/api/package.json": {
      "@student-care/auth": "workspace:*",
      "@student-care/contracts": "workspace:*",
      "@student-care/tenant": "workspace:*",
      "@student-care/validation": "workspace:*",
      fastify: "5.12.1",
    },
  };
  const expectedExports = {
    ".": { import: "./dist/src/index.js", types: "./src/index.ts" },
  };
  for (const [path, expected] of Object.entries(expectedDependencies)) {
    const actual = readPackage(path).dependencies;
    if (JSON.stringify(canonicalJson(actual)) !== JSON.stringify(canonicalJson(expected)))
      blockers.push(`DEPENDENCY_MANIFEST_MISMATCH:${path}`);
  }
  for (const path of [
    "packages/contracts/package.json",
    "packages/auth/package.json",
    "packages/validation/package.json",
    "packages/tenant/package.json",
  ]) {
    if (
      JSON.stringify(canonicalJson(readPackage(path).exports)) !==
      JSON.stringify(canonicalJson(expectedExports))
    )
      blockers.push(`EXPORTS_MISMATCH:${path}`);
  }
  if (readPackage("packages/contracts/package.json").dependencies !== undefined)
    blockers.push("CONTRACTS_DEPENDENCIES_PRESENT");
  const tenantSources = ["src/index.ts", "src/resolve-scope.ts", "src/scope-context.ts"].map(
    (file) => ({
      path: `packages/tenant/${file}`,
      content: readFileSync(resolve(root, `packages/tenant/${file}`), "utf8"),
    }),
  );
  const authSources = ["identity.ts", "index.ts", "membership-policy.ts", "session.ts"].map(
    (file) => ({
      path: `packages/auth/src/${file}`,
      content: readFileSync(resolve(root, `packages/auth/src/${file}`), "utf8"),
    }),
  );
  blockers.push(...forbiddenImports(tenantSources, ["zod", "fastify", "@student-care/api"]));
  blockers.push(
    ...forbiddenImports(authSources, [
      "@student-care/validation",
      "@student-care/tenant",
      "fastify",
      "@student-care/api",
    ]),
  );
  const reverseProbe = forbiddenImports(
    [
      {
        path: "packages/tenant/src/probe.ts",
        content: 'import "zod"; import "@student-care/api/private";',
      },
    ],
    ["zod", "@student-care/api"],
  );
  if (reverseProbe.length !== 2) blockers.push("REVERSE_IMPORT_DETECTOR_FAILED");
  const workspace = readFileSync(resolve(root, "pnpm-workspace.yaml"), "utf8");
  if (!workspace.includes('packages:\n  - "apps/*"\n  - "packages/*"'))
    blockers.push("WORKSPACE_SCOPE_MISMATCH");
  if (sha256File("pnpm-lock.yaml") !== expectedLockSha256) blockers.push("LOCKFILE_SHA_MISMATCH");
  if (readPackage("package.json").packageManager !== "pnpm@11.22.0")
    blockers.push("PACKAGE_MANAGER_MISMATCH");
  const lists = contractLists();
  if (lists.permanent.length !== 31)
    blockers.push(`PERMANENT_PATH_COUNT:${lists.permanent.length}`);
  for (const path of ["scripts/verify-final-delivery.mjs", "tests/release/final-delivery.spec.ts"])
    if (!lists.permanent.includes(path)) blockers.push(`TASK19_OUTPUT_NOT_DECLARED:${path}`);
  const currentUntracked = git("ls-files", "--others", "--exclude-standard")
    .split(/\r?\n/u)
    .filter(Boolean)
    .map(normalizePath);
  blockers.push(
    ...evaluateUntrackedBoundary(currentUntracked, registeredUntrackedPaths(), lists.permanent)
      .blockers,
  );
  return {
    mode: "package-boundary",
    status: blockers.length ? "BLOCKED" : "PASS",
    blockers: unique(blockers),
    lockfileSha256: sha256File("pnpm-lock.yaml"),
    workspaceSha256: sha256File("pnpm-workspace.yaml"),
    permanentPathCount: lists.permanent.length,
  };
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(resolve(root, relativePath), "utf8"));
}

function expectedPackageMembers(lists) {
  const tracked = git("ls-tree", "-r", "--name-only", "HEAD").split(/\r?\n/u).filter(Boolean);
  return sorted([
    ...tracked,
    ...lists.protected,
    "scripts/verify-final-delivery.mjs",
    "tests/release/final-delivery.spec.ts",
    reviewPath,
    ...prerequisiteReports,
    releaseReportPath,
    ...screenshotPaths,
  ]).filter((path) => path !== manifestPath && path !== finalZipPath && !path.startsWith(tempRoot));
}

function evidenceMode(structure) {
  const blockers = [...structure.blockers];
  let suite = null;
  let browser = null;
  let install = null;
  let performance = null;
  let historicalRepositoryLifecycle = null;
  for (const path of [...prerequisiteReports, reviewPath, ...screenshotPaths])
    if (!existsSync(resolve(root, path))) blockers.push(`EVIDENCE_MISSING:${path}`);
  if (blockers.length === 0) {
    [suite, browser, install, performance] = prerequisiteReports.map(readJson);
    blockers.push(...evaluateSuiteEvidence(suite).blockers);
    blockers.push(...evaluateSecurityEvidence(suite.security).blockers);
    blockers.push(...evaluateBrowserEvidence(browser).blockers);
    blockers.push(...evaluatePerformanceEvidence(performance).blockers);
    if (
      install?.current?.lockfileByteEqual !== true ||
      install?.rollback?.lockfileByteEqual !== true
    )
      blockers.push("INSTALL_LOCKFILE_DRIFT");
    if (install?.current?.downloaded !== 0 || install?.rollback?.downloaded !== 0)
      blockers.push("INSTALL_DOWNLOAD_DETECTED");
    historicalRepositoryLifecycle = evaluateHistoricalRepositoryLifecycle(
      install?.historicalRepositoryLifecycle,
    );
    blockers.push(...historicalRepositoryLifecycle.blockers);
  }
  const report = {
    schemaVersion: 1,
    status: blockers.length ? "BLOCKED" : "PASS",
    generatedAtUtc: new Date().toISOString(),
    baselineHead: structure.head,
    anchors: { v42Sha256: governanceSha256, lockfileSha256: expectedLockSha256 },
    inputs: prerequisiteReports.map((path) => ({
      path,
      sha256: existsSync(resolve(root, path)) ? sha256File(path) : null,
    })),
    screenshotCount: screenshotPaths.filter((path) => existsSync(resolve(root, path))).length,
    historicalRepositoryLifecycle,
    blockers: unique(blockers),
  };
  if (report.status === "PASS")
    writeFileSync(resolve(root, releaseReportPath), `${JSON.stringify(report, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
  return report;
}

function finalMode(structure) {
  const blockers = [...structure.blockers];
  for (const path of [releaseReportPath, manifestPath, finalZipPath])
    if (!existsSync(resolve(root, path))) blockers.push(`FINAL_INPUT_MISSING:${path}`);
  let memberCount = 0;
  if (blockers.length === 0) {
    const report = readJson(releaseReportPath);
    if (report.status !== "PASS") blockers.push("RELEASE_REPORT_NOT_PASS");
    const manifest = parseDetachedManifest(readFileSync(resolve(root, manifestPath)));
    blockers.push(...manifest.blockers);
    const expectedNames = expectedPackageMembers(structure.lists);
    const manifestSet = compareExactSet(
      manifest.entries.map((entry) => entry.path),
      expectedNames,
    );
    blockers.push(...manifestSet.missing.map((path) => `MANIFEST_MEMBER_MISSING:${path}`));
    blockers.push(...manifestSet.extra.map((path) => `MANIFEST_MEMBER_EXTRA:${path}`));
    const sources = expectedNames.map((name) => ({
      name,
      bytes: readFileSync(resolve(root, name)),
    }));
    const zip = validateZip(readFileSync(resolve(root, finalZipPath)), sources);
    blockers.push(...zip.blockers);
    memberCount = zip.members.length;
    for (const entry of manifest.entries) {
      const source = sources.find((item) => item.name === entry.path);
      if (source && sha256Bytes(source.bytes) !== entry.sha256)
        blockers.push(`MANIFEST_SHA_MISMATCH:${entry.path}`);
    }
  }
  return {
    mode: "final",
    status: blockers.length ? "BLOCKED" : "PASS",
    blockers: unique(blockers),
    memberCount,
  };
}

function runCli() {
  const modeArg = process.argv.find((arg) => arg.startsWith("--mode="));
  const mode = modeArg?.slice("--mode=".length) ?? "structure";
  let output;
  if (mode === "package-boundary") output = inspectCurrentPackageBoundary();
  else {
    const structure = inspectStructure();
    if (mode === "structure") output = { mode, ...structure };
    else if (mode === "evidence") output = { mode, ...evidenceMode(structure) };
    else if (mode === "final") output = finalMode(structure);
    else output = { mode, status: "BLOCKED", blockers: [`MODE_INVALID:${mode}`] };
  }
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  process.exitCode = output.status === "PASS" ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) runCli();
