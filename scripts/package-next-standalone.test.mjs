import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import process from "node:process";
import test from "node:test";
import { fileURLToPath, URL } from "node:url";
import { packageNextStandalone } from "./package-next-standalone.mjs";

const repository = fileURLToPath(new URL("../", import.meta.url));
const evidenceRoot = process.env.TASK20_PACK_TEST_ROOT;
assert(evidenceRoot && path.isAbsolute(evidenceRoot), "Explicit TASK20_PACK_TEST_ROOT required");
const evidenceRelative = path.relative(repository, evidenceRoot).replaceAll("\\", "/");
assert.match(evidenceRelative, /^artifacts\/[a-z0-9-]+\/pack-tool-[a-z0-9-]+$/u);
let evidenceAncestor = path.parse(evidenceRoot).root;
for (const segment of path.relative(evidenceAncestor, evidenceRoot).split(path.sep)) {
  evidenceAncestor = path.join(evidenceAncestor, segment);
  if (existsSync(evidenceAncestor)) assert(!lstatSync(evidenceAncestor).isSymbolicLink());
}
mkdirSync(evidenceRoot, { recursive: true });

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
function write(file, bytes) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, bytes);
}

function fixture(app = "user-web", distDir = ".next") {
  const directory = mkdtempSync(path.join(evidenceRoot, "case-"));
  const sourceRoot = path.join(directory, "source");
  const appRoot = path.join(sourceRoot, "apps", app);
  const buildRoot = path.join(appRoot, distDir);
  const standalone = path.join(buildRoot, "standalone");
  const manifest = {
    version: 1,
    appDir: appRoot,
    relativeAppDir: `apps/${app}`,
    config: { output: "standalone", outputFileTracingRoot: sourceRoot, distDir },
    files: [],
  };
  write(path.join(buildRoot, "required-server-files.json"), JSON.stringify(manifest));
  write(path.join(standalone, "apps", app, "server.js"), "console.log('local fixture');\n");
  write(path.join(standalone, "apps", app, distDir, "BUILD_ID"), "build-fixture");
  write(path.join(standalone, "node_modules", "example", "index.js"), "export default 1;\n");
  const packageJson = JSON.stringify({ name: "example", version: "1.0.0" });
  write(path.join(standalone, "node_modules", "example", "package.json"), packageJson);
  write(path.join(sourceRoot, "node_modules", "example", "package.json"), packageJson);
  write(path.join(sourceRoot, "node_modules", "example", "LICENSE"), "Fixture license\n");
  write(path.join(standalone, "node_modules", "example", "LICENSE"), "Fixture license\n");
  write(path.join(appRoot, "public", "photos", "school.jpg"), Buffer.from([0, 255, 19, 42]));
  write(path.join(buildRoot, "static", "chunks", "app.js"), "/* fixture chunk */\n");
  write(path.join(buildRoot, "static", "chunks", "app.js.LICENSE.txt"), "Chunk license\n");
  const options = { sourceRoot, app, distDir, destination: path.join(directory, "package") };
  return { directory, appRoot, buildRoot, standalone, manifest, options };
}

function rejectWithoutOutput(f, expected) {
  assert.throws(() => packageNextStandalone(f.options), expected);
  assert.equal(existsSync(f.options.destination), false);
}

function assertNoLinks(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const child = path.join(directory, entry.name);
    assert.equal(lstatSync(child).isSymbolicLink(), false, child);
    if (entry.isDirectory()) assertNoLinks(child);
  }
}

for (const [app, distDir] of [
  ["user-web", ".next"],
  ["admin-web", ".next-custom"],
]) {
  test(`${app} packages runtime, public assets and custom-dist static files with exact hashes`, () => {
    const f = fixture(app, distDir);
    const result = packageNextStandalone(f.options);
    const written = JSON.parse(
      readFileSync(path.join(f.options.destination, "package-manifest.json")),
    );
    assert.deepEqual(written, result);
    assert.equal(result.entrypoint, `apps/${app}/server.js`);
    assert.equal(result.distDir, distDir);
    assert.equal(result.files.length, 8);
    for (const file of result.files) {
      const bytes = readFileSync(path.join(f.options.destination, file.path));
      assert.equal(file.sha256, hash(bytes));
      assert.equal(file.bytes, bytes.length);
    }
    assert.deepEqual(
      readFileSync(path.join(f.options.destination, "apps", app, "public/photos/school.jpg")),
      Buffer.from([0, 255, 19, 42]),
    );
    assert.equal(
      readFileSync(
        path.join(f.options.destination, "apps", app, distDir, "static/chunks/app.js"),
        "utf8",
      ),
      "/* fixture chunk */\n",
    );
    assert.deepEqual(result.licenseFiles.map((file) => file.path).sort(), [
      `apps/${app}/${distDir}/static/chunks/app.js.LICENSE.txt`,
      "node_modules/example/LICENSE",
    ]);
    assertNoLinks(f.options.destination);
  });
}

test("existing destinations are rejected without overwriting their contents", () => {
  const f = fixture();
  write(path.join(f.options.destination, "keep.txt"), "keep");
  assert.throws(() => packageNextStandalone(f.options), /DESTINATION_EXISTS/u);
  assert.equal(readFileSync(path.join(f.options.destination, "keep.txt"), "utf8"), "keep");
});

test("Windows build metadata accepts native separators without changing package layout", () => {
  const f = fixture();
  f.manifest.relativeAppDir = "apps\\user-web";
  write(path.join(f.buildRoot, "required-server-files.json"), JSON.stringify(f.manifest));
  assert.equal(packageNextStandalone(f.options).entrypoint, "apps/user-web/server.js");
});

test("invalid app, traversal, nested output and mismatched build metadata are rejected", () => {
  for (const change of [
    { app: "api" },
    { distDir: "../.next" },
    { distDir: ".next/../.next" },
    { distDir: ".next:stream" },
    { destination: "relative-output" },
  ]) {
    const f = fixture();
    f.options = { ...f.options, ...change };
    assert.throws(() => packageNextStandalone(f.options), /INVALID_|PATH_/u);
  }
  const nested = fixture();
  nested.options.destination = path.join(nested.options.sourceRoot, "nested-package");
  rejectWithoutOutput(nested, /NESTED_SOURCE_DESTINATION/u);
  for (const property of [
    "distDir",
    "appDir",
    "relativeAppDir",
    "outputFileTracingRoot",
    "output",
  ]) {
    const f = fixture();
    if (property in f.manifest.config) f.manifest.config[property] = "wrong";
    else f.manifest[property] = "wrong";
    write(path.join(f.buildRoot, "required-server-files.json"), JSON.stringify(f.manifest));
    rejectWithoutOutput(f, /BUILD_METADATA_MISMATCH/u);
  }
});

test("private names in runtime, public and static trees are rejected before destination creation", () => {
  for (const name of [
    ".env",
    ".env.production",
    ".env-example",
    ".git",
    ".npmrc",
    "id_rsa",
    "secret.key",
    "credentials.json",
  ]) {
    for (const tree of ["standalone", "public", "static"]) {
      const f = fixture();
      const base =
        tree === "standalone"
          ? f.standalone
          : tree === "public"
            ? path.join(f.appRoot, "public")
            : path.join(f.buildRoot, "static");
      // A broken junction proves private names are rejected before following its contents.
      symlinkSync(
        path.join(f.directory, "absent-private-target"),
        path.join(base, name),
        "junction",
      );
      rejectWithoutOutput(f, /PRIVATE_PATH_REJECTED/u);
    }
  }
});

test("a private build directory is rejected before its metadata content is read", () => {
  const f = fixture("user-web", ".env-build");
  write(path.join(f.buildRoot, "required-server-files.json"), "not JSON, must not be read");
  rejectWithoutOutput(f, /PRIVATE_PATH_REJECTED/u);
});

test("safe relative dependency links are preserved without duplicate alias files", () => {
  const f = fixture();
  symlinkSync("example", path.join(f.standalone, "node_modules/alias"), "dir");
  const result = packageNextStandalone(f.options);
  assert.equal(
    readFileSync(path.join(f.options.destination, "node_modules/alias/LICENSE"), "utf8"),
    "Fixture license\n",
  );
  assert.equal(result.materializedLinks.length, 0);
  assert.equal(result.licenseFiles.length, 2);
  assert.deepEqual(result.relativeLinks, [
    { path: "node_modules/alias", target: "example", type: "dir" },
  ]);
  assert(lstatSync(path.join(f.options.destination, "node_modules/alias")).isSymbolicLink());
  assert.equal(
    result.files.some((file) => file.path.startsWith("node_modules/alias/")),
    false,
  );
});

test("pnpm sibling dependencies still load after moving the complete package", () => {
  const f = fixture();
  const framework = "node_modules/.pnpm/fixture-framework@1/node_modules/fixture-framework";
  const helper = "node_modules/.pnpm/fixture-helper@1/node_modules/fixture-helper";
  for (const [relative, name, body] of [
    [framework, "fixture-framework", "module.exports = require('fixture-helper');\n"],
    [helper, "fixture-helper", "module.exports = 'isolated-helper-v1';\n"],
  ]) {
    const pkg = JSON.stringify({ name, version: "1.0.0", main: "index.cjs" });
    write(path.join(f.options.sourceRoot, relative, "package.json"), pkg);
    write(path.join(f.standalone, relative, "package.json"), pkg);
    write(path.join(f.standalone, relative, "index.cjs"), body);
  }
  const appAlias = path.join(f.standalone, "apps/user-web/node_modules/fixture-framework");
  const helperAlias = path.join(f.standalone, framework, "../fixture-helper");
  mkdirSync(path.dirname(appAlias), { recursive: true });
  for (const [link, target] of [
    [appAlias, path.join(f.standalone, framework)],
    [helperAlias, path.join(f.standalone, helper)],
  ])
    symlinkSync(path.relative(path.dirname(link), target), link, "dir");
  const result = packageNextStandalone(f.options);
  const relocated = path.join(f.directory, "relocated");
  cpSync(f.options.destination, relocated, {
    recursive: true,
    dereference: false,
    verbatimSymlinks: true,
    force: false,
    errorOnExist: true,
  });
  const run = spawnSync(
    process.execPath,
    [
      "-e",
      "process.stdout.write(require(process.argv[1]));",
      path.join(relocated, "apps/user-web/node_modules/fixture-framework"),
    ],
    { encoding: "utf8", windowsHide: true },
  );
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stdout, "isolated-helper-v1");
  assert.equal(result.relativeLinks.length, 2);
  for (const link of result.relativeLinks) {
    const moved = path.join(relocated, link.path);
    assert(lstatSync(moved).isSymbolicLink());
    assert.equal(readlinkSync(moved).replaceAll("\\", "/"), link.target);
  }
});

test("absolute internal junctions are rejected instead of made nonportable", () => {
  const f = fixture();
  symlinkSync(
    path.join(f.standalone, "node_modules/example"),
    path.join(f.standalone, "node_modules/absolute"),
    "junction",
  );
  rejectWithoutOutput(f, /ABSOLUTE_LINK_REJECTED/u);
});

test("filesystem-normalized drive-relative link targets are rejected without an output", () => {
  const f = fixture();
  const drive = path.parse(f.standalone).root.match(/^[A-Za-z]:/u)?.[0] ?? "D:";
  const target = `${drive}example`;
  const link = path.join(f.standalone, "node_modules/drive-relative");
  symlinkSync(target, link, "dir");
  const storedTarget = readlinkSync(link);
  assert(storedTarget === target || path.isAbsolute(storedTarget));
  rejectWithoutOutput(f, /ABSOLUTE_LINK_REJECTED|INVALID_LINK_TARGET/u);
});

test("public asset links are materialized separately from runtime dependency links", () => {
  const f = fixture();
  symlinkSync("photos", path.join(f.appRoot, "public/photo-alias"), "dir");
  const result = packageNextStandalone(f.options);
  assert.equal(result.relativeLinks.length, 0);
  assert.equal(result.materializedLinks.length, 1);
  assert.deepEqual(
    readFileSync(path.join(f.options.destination, "apps/user-web/public/photo-alias/school.jpg")),
    Buffer.from([0, 255, 19, 42]),
  );
  assertNoLinks(f.options.destination);
});

test("licenses present beside source package.json are added when tracing omits them", () => {
  const f = fixture();
  const license = path.join(f.options.sourceRoot, "node_modules/example/NOTICE.txt");
  write(license, "Additional source notice\n");
  const result = packageNextStandalone(f.options);
  assert.equal(
    readFileSync(path.join(f.options.destination, "node_modules/example/NOTICE.txt"), "utf8"),
    "Additional source notice\n",
  );
  assert.equal(result.licenseFiles.length, 3);
  assert.equal(result.sourcePackages.length, 1);
  assert.deepEqual(result.sourcePackages[0].licenses.sort(), ["LICENSE", "NOTICE.txt"]);
});

test("source package version drift and conflicting traced license bytes are rejected", () => {
  for (const file of ["package.json", "LICENSE"]) {
    const f = fixture();
    write(path.join(f.options.sourceRoot, "node_modules/example", file), "changed source bytes");
    rejectWithoutOutput(f, /SOURCE_PACKAGE_MISMATCH|OUTPUT_COLLISION/u);
  }
});

test("external, dangling and recursive junctions cannot escape or expand the package", () => {
  for (const kind of ["external", "dangling", "cycle"]) {
    const f = fixture();
    const outside = path.join(f.directory, "outside");
    mkdirSync(outside);
    const target =
      kind === "cycle"
        ? f.standalone
        : kind === "external"
          ? outside
          : path.join(f.standalone, "missing");
    const link = path.join(f.standalone, "invalid-link");
    symlinkSync(path.relative(path.dirname(link), target) || ".", link, "dir");
    rejectWithoutOutput(f, /LINK_OUTSIDE_PACKAGE|BROKEN_LINK|CYCLIC_LINK/u);
  }
});

test("linked source or destination ancestors are rejected", () => {
  for (const kind of ["source", "destination"]) {
    const f = fixture();
    const alias = path.join(f.directory, "alias");
    const target = kind === "source" ? f.options.sourceRoot : path.join(f.directory, "outputs");
    mkdirSync(target, { recursive: true });
    symlinkSync(target, alias, "junction");
    if (kind === "source") f.options.sourceRoot = alias;
    else f.options.destination = path.join(alias, "new-package");
    rejectWithoutOutput(f, /ANCESTOR_LINK_REJECTED/u);
  }
});

test("conflicting public assets cannot silently replace traced runtime files", () => {
  const f = fixture();
  write(path.join(f.standalone, "apps/user-web/public/photos/school.jpg"), "conflicting bytes");
  rejectWithoutOutput(f, /OUTPUT_COLLISION/u);
});

test("CLI packages explicit inputs without installing or invoking Next", () => {
  const f = fixture();
  const run = spawnSync(
    process.execPath,
    [
      fileURLToPath(new URL("./package-next-standalone.mjs", import.meta.url)),
      "--source",
      f.options.sourceRoot,
      "--app",
      "user-web",
      "--dist-dir",
      ".next",
      "--output",
      f.options.destination,
    ],
    { encoding: "utf8", windowsHide: true },
  );
  assert.equal(run.status, 0, run.stderr);
  assert.equal(JSON.parse(run.stdout).status, "PACKAGED_LOCAL_RUNTIME");
  assert(existsSync(path.join(f.options.destination, "apps/user-web/server.js")));
});
