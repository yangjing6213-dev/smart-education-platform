import { createHash } from "node:crypto";
import {
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const limits = { entries: 50_000, bytes: 1024 ** 3, fileBytes: 256 * 1024 ** 2, depth: 100 };
const licenseName = /^(?:licen[cs]e|copying|notice)(?:[._-].*)?$/iu;
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const slash = (value) => value.replaceAll("\\", "/");

function inspect(file) {
  try {
    return lstatSync(file);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function contains(root, file) {
  const relative = path.relative(root, file);
  return (
    relative === "" ||
    (!path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(`..${path.sep}`))
  );
}

function relativeName(value) {
  if (
    typeof value !== "string" ||
    !value ||
    path.isAbsolute(value) ||
    value.includes(":") ||
    Array.from(value).some((character) => character.charCodeAt(0) < 32)
  )
    throw Error("INVALID_RELATIVE_PATH");
  const parts = slash(value).split("/");
  if (parts.some((part) => !part || part === "." || part === ".." || /[. ]$/u.test(part)))
    throw Error("INVALID_RELATIVE_PATH");
  return parts.join("/");
}

function absoluteName(value) {
  if (typeof value !== "string" || !path.isAbsolute(value) || /^[\\/]{2}/u.test(value))
    throw Error("INVALID_ABSOLUTE_PATH");
  relativeName(value.slice(path.parse(value).root.length));
  return path.resolve(value);
}

function rejectAncestorLinks(file) {
  let current = path.parse(file).root;
  for (const part of path.relative(current, file).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    const info = inspect(current);
    if (info?.isSymbolicLink()) throw Error("ANCESTOR_LINK_REJECTED");
  }
}

function rejectPrivateName(name) {
  if (
    /^(?:\.env.*|\.git|\.ssh|\.gnupg|\.aws|\.azure|\.npmrc|\.netrc|(?:credentials|secrets)(?:[._-].*)?|id_(?:rsa|ed25519)(?:\.pub)?)$/iu.test(
      name,
    ) ||
    /\.(?:pem|key|p12|pfx|jks|keystore|crt|cer)$/iu.test(name)
  )
    throw Error("PRIVATE_PATH_REJECTED");
}

// Resolve every link hop; realpath alone could hide an intermediate escape and return into the tree.
function containedEntry(root, file, links = new Set()) {
  if (!contains(root, file)) throw Error("LINK_OUTSIDE_PACKAGE");
  const parts = path.relative(root, file).split(path.sep).filter(Boolean);
  let current = root;
  for (const part of parts) {
    rejectPrivateName(part);
    current = path.join(current, part);
    const info = inspect(current);
    if (!info) throw Error("BROKEN_LINK_OR_SOURCE_MISSING");
    if (info.isSymbolicLink()) {
      if (links.has(current)) throw Error("CYCLIC_LINK");
      const nextLinks = new Set(links).add(current);
      const rawTarget = readlinkSync(current);
      if (path.isAbsolute(rawTarget) || path.win32.isAbsolute(rawTarget))
        throw Error("ABSOLUTE_LINK_REJECTED");
      if (
        rawTarget.includes(":") ||
        Array.from(rawTarget).some((character) => character.charCodeAt(0) < 32)
      )
        throw Error("INVALID_LINK_TARGET");
      const target = path.resolve(path.dirname(current), rawTarget);
      current = containedEntry(root, target, nextLinks);
    }
  }
  return current;
}

export function packageNextStandalone({ sourceRoot, app, distDir = ".next", destination }) {
  if (!["user-web", "admin-web"].includes(app)) throw Error("INVALID_APP");
  sourceRoot = absoluteName(sourceRoot);
  destination = absoluteName(destination);
  distDir = relativeName(distDir);
  for (const part of distDir.split("/")) rejectPrivateName(part);
  rejectAncestorLinks(sourceRoot);
  rejectAncestorLinks(destination);
  if (contains(sourceRoot, destination) || contains(destination, sourceRoot))
    throw Error("NESTED_SOURCE_DESTINATION");
  if (inspect(destination)) throw Error("DESTINATION_EXISTS");

  const appRoot = path.join(sourceRoot, "apps", app);
  const buildRoot = path.join(appRoot, distDir);
  const standalone = path.join(buildRoot, "standalone");
  const metadataPath = path.join(buildRoot, "required-server-files.json");
  rejectAncestorLinks(metadataPath);
  const metadataBytes = readFileSync(metadataPath);
  const metadata = JSON.parse(metadataBytes);
  if (
    metadata.appDir !== appRoot ||
    typeof metadata.relativeAppDir !== "string" ||
    slash(metadata.relativeAppDir) !== `apps/${app}` ||
    metadata.config?.distDir !== distDir ||
    metadata.config?.output !== "standalone" ||
    metadata.config?.outputFileTracingRoot !== sourceRoot
  )
    throw Error("BUILD_METADATA_MISMATCH");

  const files = new Map();
  const directories = new Map();
  const materializedLinks = [];
  let relativeLinks = [];
  const sourcePackages = [];
  let entries = 0;
  let totalBytes = 0;

  function walk(file, output, boundary, ancestors = new Set(), preserveLinks = false) {
    const normalized = relativeName(output);
    for (const part of normalized.split("/")) rejectPrivateName(part);
    if (++entries > limits.entries || normalized.split("/").length > limits.depth)
      throw Error("PACKAGE_ENTRY_LIMIT");
    const physical = containedEntry(boundary, file);
    const info = lstatSync(physical);
    if (file !== physical) {
      if (preserveLinks)
        relativeLinks.push({
          path: normalized,
          target: slash(readlinkSync(file)),
          type: info.isDirectory() ? "dir" : "file",
        });
      else
        materializedLinks.push({
          path: normalized,
          target: slash(path.relative(boundary, physical)),
        });
    }
    const key = normalized.toLowerCase();
    if (info.isDirectory()) {
      if (ancestors.has(physical)) throw Error("CYCLIC_LINK");
      if (files.has(key) || (directories.has(key) && directories.get(key) !== normalized))
        throw Error("OUTPUT_COLLISION");
      directories.set(key, normalized);
      const branch = new Set(ancestors).add(physical);
      for (const name of readdirSync(physical).sort()) {
        rejectPrivateName(name);
        walk(path.join(physical, name), `${normalized}/${name}`, boundary, branch, preserveLinks);
      }
    } else if (info.isFile()) {
      if (info.size > limits.fileBytes || totalBytes + info.size > limits.bytes)
        throw Error("PACKAGE_BYTE_LIMIT");
      if (directories.has(key) || (files.has(key) && files.get(key).path !== normalized))
        throw Error("OUTPUT_COLLISION");
      const existing = files.get(key);
      if (existing) {
        if (
          existing.bytes !== info.size ||
          hash(readFileSync(existing.source)) !== hash(readFileSync(physical))
        )
          throw Error("OUTPUT_COLLISION");
        existing.origins.push(slash(path.relative(sourceRoot, physical)));
      } else {
        totalBytes += info.size;
        files.set(key, {
          path: normalized,
          source: physical,
          bytes: info.size,
          origins: [slash(path.relative(sourceRoot, physical))],
          mode: info.mode & 0o777,
        });
      }
    } else throw Error("SPECIAL_FILE_REJECTED");
  }

  function addTree(directory, prefix, required, preserveLinks = false) {
    rejectAncestorLinks(directory);
    const info = inspect(directory);
    if (!info && !required) return;
    if (!info?.isDirectory()) throw Error("SOURCE_DIRECTORY_MISSING");
    if (prefix) walk(directory, prefix, directory, new Set(), preserveLinks);
    else
      for (const name of readdirSync(directory).sort())
        walk(path.join(directory, name), name, directory, new Set([directory]), preserveLinks);
  }

  addTree(standalone, "", true, true);
  // The complete graph above is checked for escapes, cycles and expansion limits first.
  // Keep real files once; preserve links instead of copying aliases with changed resolution context.
  const under = (name, parent) => name === parent || name.startsWith(`${parent}/`);
  const keptLinks = [];
  for (const link of relativeLinks.sort((a, b) => a.path.length - b.path.length))
    if (!keptLinks.some((parent) => under(link.path.toLowerCase(), parent.path.toLowerCase())))
      keptLinks.push(link);
  relativeLinks = keptLinks.sort((a, b) => a.path.localeCompare(b.path, "en"));
  const belowLink = (name) =>
    relativeLinks.some((link) => under(name.toLowerCase(), link.path.toLowerCase()));
  for (const [key, file] of files) if (belowLink(file.path)) files.delete(key);
  for (const [key, directory] of directories) if (belowLink(directory)) directories.delete(key);
  totalBytes = [...files.values()].reduce((total, file) => total + file.bytes, 0);
  addTree(path.join(appRoot, "public"), `apps/${app}/public`, false);
  addTree(path.join(buildRoot, "static"), `apps/${app}/${distDir}/static`, true);

  // Next's trace can omit adjacent licenses. Match source package bytes before adding them.
  for (const file of [...files.values()]) {
    if (path.basename(file.source) !== "package.json" || !contains(standalone, file.source))
      continue;
    const sourcePackage = containedEntry(
      sourceRoot,
      path.join(sourceRoot, path.relative(standalone, file.source)),
    );
    if (
      !lstatSync(sourcePackage).isFile() ||
      hash(readFileSync(sourcePackage)) !== hash(readFileSync(file.source))
    )
      throw Error("SOURCE_PACKAGE_MISMATCH");
    const sourceDirectory = path.dirname(sourcePackage);
    const licenses = readdirSync(sourceDirectory)
      .filter((name) => licenseName.test(name))
      .sort();
    sourcePackages.push({
      path: file.path,
      source: slash(path.relative(sourceRoot, sourcePackage)),
      licenses,
    });
    for (const name of licenses)
      walk(
        path.join(sourceDirectory, name),
        slash(path.join(path.dirname(file.path), name)),
        sourceRoot,
      );
  }

  const entrypoint = `apps/${app}/server.js`;
  if (!files.has(entrypoint.toLowerCase())) throw Error("SERVER_ENTRYPOINT_MISSING");
  if (files.has("package-manifest.json") || directories.has("package-manifest.json"))
    throw Error("OUTPUT_COLLISION");
  if (relativeLinks.some((link) => link.path.toLowerCase() === "package-manifest.json"))
    throw Error("OUTPUT_COLLISION");
  if (
    [...files.values()].some((file) => belowLink(file.path)) ||
    [...directories.values()].some(belowLink)
  )
    throw Error("OUTPUT_COLLISION");

  const planned = [...files.values()].sort((a, b) => a.path.localeCompare(b.path, "en"));
  for (const file of planned) file.sha256 = hash(readFileSync(file.source));
  rejectAncestorLinks(destination);
  if (inspect(destination)) throw Error("DESTINATION_EXISTS");
  mkdirSync(path.dirname(destination), { recursive: true });
  mkdirSync(destination);
  for (const directory of [...directories.values()].sort())
    mkdirSync(path.join(destination, directory), { recursive: true });
  for (const file of planned) {
    if (containedEntry(sourceRoot, file.source) !== file.source)
      throw Error("SOURCE_CHANGED_DURING_PACKAGING");
    const bytes = readFileSync(file.source);
    if (bytes.length !== file.bytes || hash(bytes) !== file.sha256)
      throw Error("SOURCE_CHANGED_DURING_PACKAGING");
    const output = path.join(destination, file.path);
    mkdirSync(path.dirname(output), { recursive: true });
    writeFileSync(output, bytes, { flag: "wx", mode: file.mode });
  }
  for (const link of relativeLinks) {
    const sourceLink = path.join(standalone, link.path);
    if (!lstatSync(sourceLink).isSymbolicLink() || slash(readlinkSync(sourceLink)) !== link.target)
      throw Error("SOURCE_CHANGED_DURING_PACKAGING");
    containedEntry(standalone, sourceLink);
    const output = path.join(destination, link.path);
    mkdirSync(path.dirname(output), { recursive: true });
    symlinkSync(link.target, output, link.type);
    if (slash(readlinkSync(output)) !== link.target) throw Error("OUTPUT_LINK_TARGET_MISMATCH");
  }
  for (const link of relativeLinks) containedEntry(destination, path.join(destination, link.path));
  const records = planned.map(({ path, bytes, sha256, origins }) => ({
    path,
    bytes,
    sha256,
    origins,
  }));
  const manifest = {
    version: 1,
    app,
    distDir,
    entrypoint,
    platform: process.platform,
    architecture: process.arch,
    buildMetadataSha256: hash(metadataBytes),
    totalBytes,
    limits,
    files: records,
    licenseFiles: records.filter((file) =>
      file.path
        .split("/")
        .some((part) => licenseName.test(part) || /\.LICENSE(?:\.|$)/iu.test(part)),
    ),
    sourcePackages,
    materializedLinks,
    relativeLinks,
  };
  writeFileSync(
    path.join(destination, "package-manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    { flag: "wx" },
  );
  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    const names = {
      "--source": "sourceRoot",
      "--app": "app",
      "--dist-dir": "distDir",
      "--output": "destination",
    };
    const options = {};
    if (args.length % 2) throw Error("INVALID_ARGUMENTS");
    for (let i = 0; i < args.length; i += 2) {
      const name = names[args[i]];
      if (!name || options[name] !== undefined || !args[i + 1]) throw Error("INVALID_ARGUMENTS");
      options[name] = args[i + 1];
    }
    const manifest = packageNextStandalone(options);
    process.stdout.write(
      `${JSON.stringify({ status: "PACKAGED_LOCAL_RUNTIME", files: manifest.files.length, bytes: manifest.totalBytes })}\n`,
    );
  } catch (error) {
    process.stderr.write(`PACKAGING_FAILED: ${error.code || error.message}\n`);
    process.exitCode = 1;
  }
}
