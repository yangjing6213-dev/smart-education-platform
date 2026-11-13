import { createHash } from "node:crypto";
import { lstatSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve, parse, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

// Display rights for these photographs do not make them public repository assets.
export const privatePhotos = Object.freeze([
  { name: "institution-activity-visit.jpg", sha256: "3AA1B35FB8C143B4D89C2087C8D3CD7EF64AD646CED8A57C6AC057F24AEAE944" },
  { name: "teacher-team-outdoor.jpg", sha256: "BDFD9B4A8174588D00886BDEBF0F613805B8E0AA959EC22148609C652D7663A6" },
  { name: "teacher-team-campus.jpg", sha256: "AEBA907495851C8B66C2E3FDB63775FBE016A2FEEFD5CCB88378EEF72EC365FD" },
]);
const targets = ["apps/user-web/public/assets", "apps/mini-program-taro/src/assets"];
const digest = bytes => createHash("sha256").update(bytes).digest("hex").toUpperCase();
function requireThat(condition, code) { if (!condition) throw new Error(code); }
function directory(path, create = false) {
  const absolute = resolve(path);
  let current = parse(absolute).root;
  for (const part of relative(current, absolute).split(sep).filter(Boolean)) {
    current = resolve(current, part);
    let info = lstatSync(current, { throwIfNoEntry: false });
    if (!info && create) { mkdirSync(current); info = lstatSync(current); }
    if (!info && !create) return false;
    requireThat(info?.isDirectory() && !info.isSymbolicLink(), "UNSAFE_DIRECTORY");
  }
  return true;
}
function bytesAt(path, expected) {
  requireThat(directory(dirname(path)), "MISSING_SOURCE_DIRECTORY");
  const before = lstatSync(path, { bigint: true, throwIfNoEntry: false });
  requireThat(before?.isFile() && !before.isSymbolicLink() && before.nlink === 1n, "UNSAFE_PHOTO_FILE");
  requireThat(before.size > 3n && before.size <= 16777216n, "PHOTO_SIZE_INVALID");
  const bytes = readFileSync(path);
  const after = lstatSync(path, { bigint: true });
  requireThat(before.dev === after.dev && before.ino === after.ino && before.size === after.size &&
    before.mtimeNs === after.mtimeNs && before.ctimeNs === after.ctimeNs && after.nlink === 1n &&
    after.isFile() && !after.isSymbolicLink() && BigInt(bytes.length) === after.size, "PHOTO_CHANGED_DURING_READ");
  requireThat(bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff, "PHOTO_NOT_JPEG");
  requireThat(digest(bytes) === expected, "PHOTO_HASH_MISMATCH");
  return bytes;
}
export function preparePrivatePhotos({ source, root, check = false }) {
  requireThat(typeof source === "string" && source.length > 0 && typeof root === "string" && root.length > 0, "SOURCE_AND_ROOT_REQUIRED");
  source = resolve(source); root = resolve(root);
  requireThat(directory(source) && directory(root), "SOURCE_OR_ROOT_MISSING");
  requireThat(directory(resolve(root, "apps/user-web")) && directory(resolve(root, "apps/mini-program-taro")), "NOT_PROJECT_ROOT");
  // Validate every source and every destination before creating any files.
  const inputs = privatePhotos.map(photo => ({ ...photo, bytes: bytesAt(resolve(source, photo.name), photo.sha256) }));
  const plan = [];
  for (const target of targets) {
    directory(resolve(root, target));
    for (const photo of inputs) {
      const path = resolve(root, target, photo.name);
      const exists = lstatSync(path, { throwIfNoEntry: false });
      if (exists) bytesAt(path, photo.sha256);
      plan.push({ photo, path, relativePath: `${target}/${photo.name}`, action: exists ? "ALREADY_MATCHES" : "CREATE" });
    }
  }
  if (!check) {
    for (const item of plan.filter(item => item.action === "CREATE")) {
      directory(dirname(item.path), true);
      // Exclusive creation never overwrites an existing asset, including a race.
      writeFileSync(item.path, item.photo.bytes, { flag: "wx", mode: 0o600 });
      bytesAt(item.path, item.photo.sha256);
    }
  }
  return { status: check ? "PASS_CHECK_ONLY" : "PASS_PRIVATE_ASSETS_READY", written: check ? 0 : plan.filter(item => item.action === "CREATE").length,
    files: plan.map(item => ({ path: item.relativePath, action: item.action, sha256: item.photo.sha256 })) };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    const options = { root: resolve(dirname(fileURLToPath(import.meta.url)), ".."), check: false };
    const seen = new Set();
    for (let index = 0; index < args.length; index++) {
      const key = args[index];
      requireThat(!seen.has(key), "DUPLICATE_ARGUMENT"); seen.add(key);
      if (key === "--check") options.check = true;
      else if (key === "--source" || key === "--root") {
        const value = args[++index];
        requireThat(value && !value.startsWith("--"), "ARGUMENT_VALUE_REQUIRED");
        options[key.slice(2)] = value;
      } else throw new Error("UNKNOWN_ARGUMENT");
    }
    console.log(JSON.stringify(preparePrivatePhotos(options)));
  } catch (error) {
    const allowed = new Set(["UNSAFE_DIRECTORY", "MISSING_SOURCE_DIRECTORY", "UNSAFE_PHOTO_FILE", "PHOTO_SIZE_INVALID", "PHOTO_CHANGED_DURING_READ", "PHOTO_NOT_JPEG", "PHOTO_HASH_MISMATCH", "SOURCE_AND_ROOT_REQUIRED", "SOURCE_OR_ROOT_MISSING", "NOT_PROJECT_ROOT", "DUPLICATE_ARGUMENT", "ARGUMENT_VALUE_REQUIRED", "UNKNOWN_ARGUMENT"]);
    console.error(JSON.stringify({ status: "FAIL", reason: allowed.has(error.message) ? error.message : "FILESYSTEM_OPERATION_FAILED" }));
    process.exitCode = 1;
  }
}
