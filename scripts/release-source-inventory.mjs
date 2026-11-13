import { execFileSync } from "node:child_process";
import console from "node:console";
import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { extname, isAbsolute, parse, relative, resolve, sep } from "node:path";
import process from "node:process";
import { TextDecoder } from "node:util";
import { fileURLToPath } from "node:url";

const apps = new Set(["api", "user-web", "admin-web", "mini-program-taro"]);
const packages = new Set(["auth", "contracts", "tenant", "validation"]);
const appDirectories = new Set([
  "src",
  "test",
  "tests",
  "public",
  "prisma",
  "config",
  "types",
  "scripts",
  "licenses",
]);
const packageDirectories = new Set(["src", "test", "tests", "openapi"]);
const textExtensions = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".yaml",
  ".yml",
  ".css",
  ".scss",
  ".html",
  ".md",
  ".txt",
  ".sql",
  ".prisma",
  ".toml",
  ".svg",
  ".sh",
  ".ps1",
]);
const imageExtensions = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".avif",
  ".ico",
  ".gif",
  ".woff",
  ".woff2",
]);
const controlFiles = new Set(["PLANS.md", "docs/exec-plans/active/project-completion.md"]);
const nginxTemplates = new Set([
  "docs/operations/trial-mini-api.nginx.conf",
  "docs/operations/trial-web-backend.nginx.conf",
  "docs/operations/trial-web.nginx.conf",
]);

function normalized(path) {
  if (
    typeof path !== "string" ||
    !path ||
    path.includes(":") ||
    Array.from(path).some((char) => char.charCodeAt(0) < 32)
  )
    throw Error("INVALID_SOURCE_PATH");
  const value = path.replaceAll("\\", "/");
  if (isAbsolute(value) || value.split("/").some((part) => !part || part === "." || part === ".."))
    throw Error("INVALID_SOURCE_PATH");
  return value;
}

function assertRootWithoutLinks(root) {
  const absolute = resolve(root);
  let current = parse(absolute).root;
  for (const part of relative(current, absolute).split(sep).filter(Boolean)) {
    current = resolve(current, part);
    if (lstatSync(current).isSymbolicLink()) throw Error("ROOT_ANCESTOR_SYMLINK_REJECTED");
  }
}

function safePath(root, path, allowMissing = false) {
  const name = normalized(path);
  assertRootWithoutLinks(root);
  let current = resolve(root);
  if (lstatSync(current).isSymbolicLink()) throw Error("ROOT_SYMLINK_REJECTED");
  for (const part of name.split("/")) {
    current = resolve(current, part);
    if (!existsSync(current)) {
      if (allowMissing) continue;
      throw Error("SOURCE_PATH_MISSING");
    }
    if (lstatSync(current).isSymbolicLink()) throw Error("SYMLINK_REJECTED");
  }
  const child = relative(resolve(root), current);
  if (child.startsWith(`..${sep}`) || isAbsolute(child)) throw Error("SOURCE_PATH_ESCAPE");
  return current;
}

function excludedReason(path, directory) {
  const parts = path.split("/");
  const name = parts.at(-1);
  if (
    /^(?:\.env(?:\..*)?|(?:credentials|secrets)(?:[._-].*)?|\.ssh|\.gnupg|id_(?:rsa|ed25519)(?:\.pub)?|project(?:\.private)?\.config\.json)$/iu.test(
      name,
    ) ||
    /\.(?:pem|key|p12|pfx|jks|keystore|crt|cer)$/iu.test(name)
  )
    return "PRIVATE_FILE_NAME";
  if (controlFiles.has(path)) return "MUTABLE_CONTROL_PLANE_RECORDED_SEPARATELY";
  if (
    /^(?:node_modules|dist|build|coverage|\.git|\.next.*|\.dist.*|\.task.*|\.cache.*|\.pnpm.*|\.npm|\.yarn)$/iu.test(
      name,
    ) ||
    /(?:\.tsbuildinfo|\.log|\.map)$/iu.test(name) ||
    name === "next-env.d.ts"
  )
    return "GENERATED_OR_LOCAL_ONLY";
  if (["artifacts", "phase-inputs", "prototypes"].includes(parts[0]))
    return "HISTORICAL_OR_LOCAL_EVIDENCE";
  if (parts[0] === "apps") {
    if (parts.length >= 2 && !apps.has(parts[1])) return "LEGACY_OR_OUTSIDE_TARGET_APPLICATIONS";
    if (directory && parts.length === 3 && !appDirectories.has(name))
      return "OUTSIDE_SOURCE_DIRECTORIES";
  } else if (parts[0] === "packages") {
    if (parts.length >= 2 && !packages.has(parts[1])) return "OUTSIDE_SHARED_PACKAGES";
    if (directory && parts.length === 3 && !packageDirectories.has(name))
      return "OUTSIDE_SOURCE_DIRECTORIES";
  } else if (
    directory &&
    parts.length === 1 &&
    !["scripts", "tests", "docs", ".github"].includes(name)
  )
    return "OUTSIDE_SOURCE_DIRECTORIES";
  if (
    !directory &&
    !nginxTemplates.has(path) &&
    !textExtensions.has(extname(name).toLowerCase()) &&
    !imageExtensions.has(extname(name).toLowerCase()) &&
    ![".gitignore", ".gitattributes", ".prettierignore", "Dockerfile", "LICENSE"].includes(name)
  )
    return "UNSUPPORTED_FILE_TYPE";
  return null;
}

export function collectSourcePaths(repositoryRoot) {
  const root = resolve(repositoryRoot);
  assertRootWithoutLinks(root);
  if (lstatSync(root).isSymbolicLink()) throw Error("ROOT_SYMLINK_REJECTED");
  const candidates = [],
    excluded = [],
    blockers = [];
  function walk(path = "") {
    for (const entry of readdirSync(path ? safePath(root, path) : root, { withFileTypes: true })) {
      const child = normalized(path ? `${path}/${entry.name}` : entry.name);
      const reason = excludedReason(child, entry.isDirectory() || entry.isSymbolicLink());
      if (reason) {
        excluded.push({ path: child, reason });
        continue;
      }
      const details = lstatSync(resolve(root, child));
      if (details.isSymbolicLink()) {
        blockers.push({ path: child, reason: "SYMLINK_REJECTED" });
        continue;
      }
      if (details.isDirectory()) walk(child);
      else if (details.isFile()) candidates.push(child);
      else blockers.push({ path: child, reason: "NON_REGULAR_FILE" });
    }
  }
  walk();
  candidates.sort();
  excluded.sort((a, b) => a.path.localeCompare(b.path));
  blockers.sort((a, b) => a.path.localeCompare(b.path));
  return { candidates, excluded, blockers };
}

export function scanSensitiveText(path, text) {
  const rules = [
    ["PRIVATE_KEY", /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----/gu],
    ["GITHUB_TOKEN", /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/gu],
    ["OPENAI_KEY", /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{24,}\b/gu],
    ["CLOUD_ACCESS_KEY", /\b(?:AKIA[A-Z0-9]{16}|AKID[A-Za-z0-9]{28,}|AIza[A-Za-z0-9_-]{30,})\b/gu],
    ["SLACK_TOKEN", /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/gu],
    [
      "EMBEDDED_CONNECTION_PASSWORD",
      /\b(?:postgres(?:ql)?|mysql|redis):\/\/[^\s"'/:]+:([^\s"'@]+)@/gu,
    ],
  ];
  const findings = [];
  for (const [rule, expression] of rules) {
    for (const match of text.matchAll(expression)) {
      findings.push({ path, line: text.slice(0, match.index).split("\n").length, rule });
    }
  }
  const assignments =
    /\b(?:api[_-]?key|api[_-]?secret|access[_-]?token|client[_-]?secret|password)\b["']?\s*[:=]\s*["']([^"'\r\n]{12,})["']/giu;
  for (const match of text.matchAll(assignments)) {
    findings.push({
      path,
      line: text.slice(0, match.index).split("\n").length,
      rule: "POSSIBLE_HARDCODED_CREDENTIAL",
    });
  }
  return findings.sort((a, b) => a.line - b.line || a.rule.localeCompare(b.rule));
}

const digest = (bytes) => createHash("sha256").update(bytes).digest("hex").toUpperCase();

function permittedSourcePath(path) {
  const parts = normalized(path).split("/");
  return parts.every(
    (_, index) => !excludedReason(parts.slice(0, index + 1).join("/"), index < parts.length - 1),
  );
}

export function inspectSourceFiles(
  repositoryRoot,
  selection,
  { trackedPaths = [], modifiedPaths = [] } = {},
) {
  const tracked = new Set(trackedPaths),
    modified = new Set(modifiedPaths);
  const files = [],
    findings = [...selection.blockers];
  for (const path of selection.candidates) {
    if (!permittedSourcePath(path)) throw Error("INVALID_SOURCE_PATH_CLASSIFICATION");
    const absolute = safePath(repositoryRoot, path);
    const before = statSync(absolute, { bigint: true });
    if (!before.isFile()) throw Error("NON_REGULAR_SOURCE_FILE");
    const bytes = readFileSync(absolute);
    const after = statSync(safePath(repositoryRoot, path), { bigint: true });
    if (before.size !== after.size || before.mtimeNs !== after.mtimeNs)
      throw Error("SOURCE_CHANGED_DURING_READ");
    const binary = imageExtensions.has(extname(path).toLowerCase());
    if (!binary) {
      try {
        findings.push(
          ...scanSensitiveText(path, new TextDecoder("utf-8", { fatal: true }).decode(bytes)),
        );
      } catch {
        findings.push({ path, rule: "INVALID_UTF8_TEXT" });
      }
    }
    files.push({
      path,
      bytes: bytes.length,
      sha256: digest(bytes),
      scan: binary ? "BINARY_HASH_ONLY" : "TEXT_RULE_SCAN",
      gitState: tracked.has(path)
        ? modified.has(path)
          ? "TRACKED_MODIFIED"
          : "TRACKED"
        : "UNTRACKED_CANDIDATE",
    });
  }
  return {
    status: findings.length ? "REVIEW_REQUIRED" : "PASS_SOURCE_INVENTORY_ONLY",
    files,
    findings,
    excluded: selection.excluded,
    releaseReady: "NO",
    limitations: [
      "Only selected current source paths; excluded files and Git history are not scanned.",
      "Pattern scanning cannot prove the absence of all private data or secrets.",
      "Binary assets are hashed only; no OCR, rights inference or metadata inspection.",
      "This is not a standalone deployment package, Git staging list approval or publication authorization.",
    ],
  };
}

export function verifySourceInventory(root, inventory) {
  const differences = [];
  for (const file of inventory.files) {
    try {
      if (!permittedSourcePath(file.path)) throw Error("INVALID_SOURCE_PATH_CLASSIFICATION");
      const path = safePath(root, file.path);
      if (excludedReason(file.path, false) || digest(readFileSync(path)) !== file.sha256)
        differences.push({ path: file.path, reason: "CHANGED" });
    } catch {
      differences.push({ path: file.path, reason: "MISSING_OR_UNSAFE_PATH" });
    }
  }
  const current = collectSourcePaths(root);
  differences.push(...current.blockers);
  const selectedNow = current.candidates;
  const original = new Set(inventory.files.map((entry) => entry.path));
  for (const path of selectedNow)
    if (!original.has(path)) differences.push({ path, reason: "NEW_SOURCE_FILE" });
  return {
    status: differences.length ? "FAIL_CURRENT_FILES_CHANGED" : "PASS_CURRENT_FILES_MATCH",
    checked: inventory.files.length,
    differences,
  };
}

export function writeSourceInventory(root, output, metadata = {}) {
  let path;
  try {
    path = normalized(output);
  } catch {
    throw Error("INVALID_ARTIFACT_PATH");
  }
  if (!path.startsWith("artifacts/")) throw Error("OUTPUT_MUST_BE_INSIDE_ARTIFACTS");
  const destination = safePath(root, path, true);
  if (existsSync(destination)) throw Error("OUTPUT_EXISTS");
  const selection = collectSourcePaths(root);
  mkdirSync(destination, { recursive: true });
  writeFileSync(resolve(destination, "selection.json"), JSON.stringify(selection, null, 2) + "\n", {
    flag: "wx",
  });
  const result = inspectSourceFiles(root, selection, metadata);
  writeFileSync(resolve(destination, "inventory.json"), JSON.stringify(result, null, 2) + "\n", {
    flag: "wx",
  });
  return result;
}

export function readSourceInventory(root, file) {
  const path = normalized(file);
  if (
    !path.startsWith("artifacts/") ||
    !path.endsWith("/inventory.json") ||
    path.split("/").some((part) => excludedReason(part, false) === "PRIVATE_FILE_NAME")
  )
    throw Error("INVALID_INVENTORY_FILE_PATH");
  const absolute = safePath(root, path);
  if (!statSync(absolute).isFile() || statSync(absolute).size > 8 * 1024 * 1024)
    throw Error("INVALID_INVENTORY_FILE");
  let inventory;
  try {
    inventory = JSON.parse(readFileSync(absolute, "utf8"));
  } catch {
    throw Error("INVALID_INVENTORY_JSON");
  }
  if (
    !inventory ||
    !Array.isArray(inventory.files) ||
    inventory.files.some(
      (entry) => !entry || typeof entry.path !== "string" || !/^[0-9A-F]{64}$/u.test(entry.sha256),
    )
  )
    throw Error("INVALID_INVENTORY_SCHEMA");
  if (new Set(inventory.files.map((entry) => entry.path)).size !== inventory.files.length)
    throw Error("DUPLICATE_INVENTORY_PATH");
  return inventory;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = process.cwd();
  const args = process.argv.slice(2);
  if (args.length !== 2 || !["--output", "--verify"].includes(args[0]))
    throw Error(
      "Use --output artifacts/<new-directory> or --verify artifacts/<directory>/inventory.json",
    );
  const git = (args) =>
    execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      windowsHide: true,
      maxBuffer: 16 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    })
      .split("\0")
      .filter(Boolean);
  if (resolve(git(["rev-parse", "--show-toplevel"])[0].trim()) !== resolve(root))
    throw Error("RUN_FROM_REPOSITORY_ROOT");
  let result;
  if (args[0] === "--verify") {
    result = verifySourceInventory(root, readSourceInventory(root, args[1]));
  } else
    result = writeSourceInventory(root, args[1], {
      trackedPaths: git(["ls-files", "--cached", "-z"]),
      modifiedPaths: git(["diff", "--no-ext-diff", "--name-only", "-z"]),
    });
  console.log(
    JSON.stringify({
      status: result.status,
      files: result.files?.length ?? result.checked,
      findings: result.findings?.length ?? result.differences?.length,
      releaseReady: "NO",
    }),
  );
  if (!result.status.startsWith("PASS_")) process.exitCode = 1;
}
