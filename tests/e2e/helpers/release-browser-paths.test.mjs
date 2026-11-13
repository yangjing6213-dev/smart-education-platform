import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, symlinkSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  assertTaskOwnedDirectory,
  browserApiModuleUrl,
  resolveLocalTestDatabase,
  resolveReleaseBrowserPaths,
} from "./release-browser-paths.mjs";

const repository = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const evidenceRoot = resolveReleaseBrowserPaths(repository).artifactRoot;
mkdirSync(evidenceRoot, { recursive: true });
const testRoot = mkdtempSync(join(evidenceRoot, "paths-test-"));
const root = join(testRoot, "repository");
const task = "task20-synthetic-path-check";
const artifact = join(root, "artifacts", task, "run");
mkdirSync(artifact, { recursive: true });
const env = { TASK20_BROWSER_ARTIFACT_ROOT: artifact };

test("owned output directories accept safe normalized children and reject sibling or parent paths", () => {
  const output = join(artifact, "new-output", "screenshots");
  assert.equal(assertTaskOwnedDirectory(artifact, output), output);
  assert.equal(assertTaskOwnedDirectory(artifact, "new-output/sub/../screenshots"), output);
  assert.equal(assertTaskOwnedDirectory(root, artifact), artifact);
  for (const path of [
    artifact,
    root,
    join(artifact, "../other-run"),
    join(artifact, "child/../../outside"),
  ])
    assert.throws(() => assertTaskOwnedDirectory(artifact, path), /TASK_DIRECTORY_OUTSIDE_PARENT/u);
});

test("screenshots, profiles, workspace and application junctions cannot escape an owned directory", () => {
  const linkedOutputs = join(artifact, "linked-outputs");
  const target = join(testRoot, "output-link-target");
  mkdirSync(linkedOutputs);
  mkdirSync(target);
  for (const name of ["screenshots", "browser-profiles", "web-workspace"]) {
    const link = join(linkedOutputs, name);
    symlinkSync(target, link, "junction");
    assert.throws(
      () => assertTaskOwnedDirectory(artifact, join(link, "new-directory")),
      /PATH_ANCESTOR_LINK/u,
    );
    assert.throws(
      () => assertTaskOwnedDirectory(link, join(link, "new-directory")),
      /PATH_ANCESTOR_LINK/u,
    );
  }
  const apps = join(artifact, "real-workspace", "apps");
  mkdirSync(apps, { recursive: true });
  const appLink = join(apps, "admin-web");
  symlinkSync(target, appLink, "junction");
  assert.throws(() => assertTaskOwnedDirectory(artifact, appLink), /PATH_ANCESTOR_LINK/u);
  const app = join(apps, "user-web");
  mkdirSync(app);
  symlinkSync(target, join(app, "node_modules"), "junction");
  assert.equal(assertTaskOwnedDirectory(artifact, app), app);
  assert.equal(
    assertTaskOwnedDirectory(app, join(app, ".next-current")),
    join(app, ".next-current"),
  );
});

test("explicit artifact paths derive task-owned runtimes and separate Next output names", () => {
  assert.deepEqual(resolveReleaseBrowserPaths(root, env), {
    artifactRoot: artifact,
    apiRuntimeRoot: join(artifact, "api-dist/runtime/src"),
    userDistDirectory: `.next-${task}-user-web`,
    adminDistDirectory: `.next-${task}-admin-web`,
  });
  const relative = `artifacts/${task}/run/sub/../`;
  assert.equal(
    resolveReleaseBrowserPaths(root, { TASK20_BROWSER_ARTIFACT_ROOT: relative }).artifactRoot,
    artifact,
  );
  assert.equal(
    resolveReleaseBrowserPaths(root, {
      ...env,
      TASK20_API_RUNTIME: join(artifact, "custom-runtime"),
    }).apiRuntimeRoot,
    join(artifact, "custom-runtime"),
  );
});

test("missing or blank artifact configuration never selects a historic batch", () => {
  for (const value of [undefined, "", " ", "\t", " artifacts/task "])
    assert.throws(
      () => resolveReleaseBrowserPaths(root, { TASK20_BROWSER_ARTIFACT_ROOT: value }),
      /ARTIFACT_ROOT_REQUIRED/u,
    );
});

test("browser API imports select the local build for standalone tests and the candidate for preflight", () => {
  const file = "nest/api-app.js";
  const ordinary = fileURLToPath(browserApiModuleUrl(root, file, {}));
  assert.equal(ordinary, join(root, "apps", "api", "dist", "src", file));
  const release = { ...env, TASK20_BROWSER_API_MODE: "preflight-candidate" };
  assert.equal(
    fileURLToPath(browserApiModuleUrl(root, file, release)),
    join(root, "apps", "api", `.dist-${task}-api`, "src", file),
  );
  assert.throws(
    () => browserApiModuleUrl(root, file, { ...release, TASK20_API_RUNTIME: "external" }),
    /API_RUNTIME_OVERRIDE_FORBIDDEN/u,
  );
  assert.throws(
    () => browserApiModuleUrl(root, "../escape.js", release),
    /API_MODULE_OUTSIDE_RUNTIME/u,
  );
});

test("the preflight candidate cannot be overridden or selected from a nested task", () => {
  const candidate = { ...env, TASK20_BROWSER_API_MODE: "preflight-candidate" };
  const expected = join(root, "apps", "api", `.dist-${task}-api`, "src");
  assert.equal(resolveReleaseBrowserPaths(root, candidate).apiRuntimeRoot, expected);
  for (const override of [expected, join(artifact, "custom-runtime"), ""])
    assert.throws(
      () => resolveReleaseBrowserPaths(root, { ...candidate, TASK20_API_RUNTIME: override }),
      /API_RUNTIME_OVERRIDE_FORBIDDEN/u,
    );
  assert.throws(
    () => resolveReleaseBrowserPaths(root, { ...env, TASK20_BROWSER_API_MODE: "unrecognized" }),
    /API_RUNTIME_MODE_INVALID/u,
  );
  assert.throws(
    () =>
      resolveReleaseBrowserPaths(root, {
        ...candidate,
        TASK20_BROWSER_ARTIFACT_ROOT: join(artifact, "nested", "run"),
      }),
    /CANDIDATE_ARTIFACT_ROOT_INVALID/u,
  );
});

test("candidate API directories reject junctions along the compiled package path", () => {
  const apiPackage = join(root, "apps", "api");
  mkdirSync(apiPackage, { recursive: true });
  symlinkSync(artifact, join(apiPackage, `.dist-${task}-api`), "junction");
  assert.throws(
    () =>
      resolveReleaseBrowserPaths(root, { ...env, TASK20_BROWSER_API_MODE: "preflight-candidate" }),
    /PATH_ANCESTOR_LINK/u,
  );
});

test("artifact root, repository root, siblings and traversal escapes are rejected", () => {
  for (const path of [
    root,
    join(root, "artifacts"),
    join(root, "artifacts-sibling/task"),
    join(testRoot, "outside-task"),
    "artifacts/task/../../elsewhere",
  ])
    assert.throws(
      () => resolveReleaseBrowserPaths(root, { TASK20_BROWSER_ARTIFACT_ROOT: path }),
      /ARTIFACT_ROOT_OUTSIDE_TASK/u,
    );
});

test("task directory names must have safe lowercase characters and at most 63 characters", () => {
  for (const name of ["Task20", "task_name", "task.name", "-task", "a".repeat(64)])
    assert.throws(
      () =>
        resolveReleaseBrowserPaths(root, {
          TASK20_BROWSER_ARTIFACT_ROOT: join(root, "artifacts", name),
        }),
      /TASK_DIRECTORY_INVALID/u,
    );
  assert.equal(
    resolveReleaseBrowserPaths(root, {
      TASK20_BROWSER_ARTIFACT_ROOT: join(root, "artifacts", "a".repeat(63)),
    }).userDistDirectory,
    `.next-${"a".repeat(63)}-user-web`,
  );
});

test("explicit API runtime must be a strict child of the current artifact directory", () => {
  for (const path of [
    artifact,
    root,
    join(root, "artifacts", task, "other-run"),
    join(root, "artifacts", "prior-task", "api-dist"),
    join(artifact, "../outside"),
  ])
    assert.throws(
      () => resolveReleaseBrowserPaths(root, { ...env, TASK20_API_RUNTIME: path }),
      /API_RUNTIME_OUTSIDE_TASK/u,
    );
  assert.throws(
    () => resolveReleaseBrowserPaths(root, { ...env, TASK20_API_RUNTIME: " " }),
    /API_RUNTIME_INVALID/u,
  );
});

test("artifact and API ancestor junctions are rejected even when their target stays inside the task", () => {
  const real = join(testRoot, "real-directory");
  mkdirSync(real);
  const taskLink = join(root, "artifacts", "linked-task");
  symlinkSync(real, taskLink, "junction");
  assert.throws(
    () =>
      resolveReleaseBrowserPaths(root, {
        TASK20_BROWSER_ARTIFACT_ROOT: join(taskLink, "new-child"),
      }),
    /PATH_ANCESTOR_LINK/u,
  );
  const runtimeLink = join(artifact, "linked-runtime");
  symlinkSync(real, runtimeLink, "junction");
  assert.throws(
    () =>
      resolveReleaseBrowserPaths(root, { ...env, TASK20_API_RUNTIME: join(runtimeLink, "src") }),
    /PATH_ANCESTOR_LINK/u,
  );
  const sameTaskLink = join(artifact, "same-task-link");
  symlinkSync(join(artifact, "api-target"), sameTaskLink, "junction");
  assert.throws(
    () => resolveReleaseBrowserPaths(root, { ...env, TASK20_API_RUNTIME: sameTaskLink }),
    /PATH_ANCESTOR_LINK/u,
  );
});

test("repository and artifacts ancestor junctions cannot bypass the boundary", () => {
  const linkedRepository = join(testRoot, "linked-repository");
  symlinkSync(root, linkedRepository, "junction");
  assert.throws(
    () =>
      resolveReleaseBrowserPaths(linkedRepository, {
        TASK20_BROWSER_ARTIFACT_ROOT: `artifacts/${task}/run`,
      }),
    /PATH_ANCESTOR_LINK/u,
  );
  const anotherRoot = join(testRoot, "other-repository");
  mkdirSync(anotherRoot);
  symlinkSync(join(root, "artifacts"), join(anotherRoot, "artifacts"), "junction");
  assert.throws(
    () =>
      resolveReleaseBrowserPaths(anotherRoot, {
        TASK20_BROWSER_ARTIFACT_ROOT: `artifacts/${task}/run`,
      }),
    /PATH_ANCESTOR_LINK/u,
  );
});

test("local database requires both explicit configuration values and returns a URL", () => {
  for (const protocol of ["postgres:", "postgresql:"]) {
    const value = `${protocol}//synthetic:synthetic@127.0.0.1:56366/test_db`;
    const result = resolveLocalTestDatabase({
      DATABASE_URL: value,
      TASK20_TEST_DATABASE_PORT: "56366",
    });
    assert.equal(result.href, value);
    assert.equal(result.hostname, "127.0.0.1");
  }
  for (const values of [
    {},
    { DATABASE_URL: "postgresql://127.0.0.1:56366/test" },
    { TASK20_TEST_DATABASE_PORT: "56366" },
    { DATABASE_URL: " ", TASK20_TEST_DATABASE_PORT: "56366" },
  ])
    assert.throws(() => resolveLocalTestDatabase(values), /DATABASE_CONFIGURATION_REQUIRED/u);
});

test("remote, alternate loopback names, wrong schemes and port mismatches are rejected", () => {
  for (const url of [
    "https://127.0.0.1:56366/test",
    "postgresql://example.invalid:56366/test",
    "postgresql://localhost:56366/test",
    "postgresql://[::1]:56366/test",
    "postgresql://127.0.0.2:56366/test",
    "postgresql://127.0.0.1/test",
    "postgresql://127.0.0.1:56365/test",
    "not a URL",
  ])
    assert.throws(
      () => resolveLocalTestDatabase({ DATABASE_URL: url, TASK20_TEST_DATABASE_PORT: "56366" }),
      /LOCAL_DATABASE_INVALID/u,
    );
});

test("database ports require exact canonical integers from 1024 to 65535", () => {
  for (const port of ["1024", "65535"])
    assert.equal(
      resolveLocalTestDatabase({
        DATABASE_URL: `postgresql://127.0.0.1:${port}/test`,
        TASK20_TEST_DATABASE_PORT: port,
      }).port,
      port,
    );
  for (const port of ["0", "1023", "65536", "056366", "56366.0", "56366 ", "5e4"])
    assert.throws(
      () =>
        resolveLocalTestDatabase({
          DATABASE_URL: "postgresql://127.0.0.1:56366/test",
          TASK20_TEST_DATABASE_PORT: port,
        }),
      /LOCAL_DATABASE_INVALID/u,
    );
});

test("connection query overrides and fragments cannot redirect database access", () => {
  for (const suffix of ["?host=example.invalid", "?port=5432", "#other-host"])
    assert.throws(
      () =>
        resolveLocalTestDatabase({
          DATABASE_URL: `postgresql://127.0.0.1:56366/test${suffix}`,
          TASK20_TEST_DATABASE_PORT: "56366",
        }),
      /LOCAL_DATABASE_INVALID/u,
    );
});

test("invalid database diagnostics never echo supplied credentials", () => {
  const secret = "synthetic-never-print-me";
  assert.throws(
    () =>
      resolveLocalTestDatabase({
        DATABASE_URL: `postgresql://user:${secret}@remote.invalid:56366/test`,
        TASK20_TEST_DATABASE_PORT: "56366",
      }),
    (error) => error.message === "LOCAL_DATABASE_INVALID" && !String(error).includes(secret),
  );
});
