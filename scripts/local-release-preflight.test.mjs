import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import process from "node:process";
import test from "node:test";
import { fileURLToPath, URL } from "node:url";
import { resolveReleaseBrowserPaths } from "../tests/e2e/helpers/release-browser-paths.mjs";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const artifactRoot = "artifacts/task20-a1-261-local-release-preflight-20261022/run";
const api = await import("./local-release-preflight.mjs").catch(() => ({}));

test("defines the fixed current-stack release command matrix", () => {
  assert.equal(typeof api.createLocalReleaseCommandMatrix, "function");
  const matrix = api.createLocalReleaseCommandMatrix({
    repositoryRoot,
    artifactRoot,
    baseEnvironment: { PATH: "synthetic-path" },
  });

  assert.deepEqual(
    matrix.map(({ id }) => id),
    [
      "api:typecheck",
      "api:schema",
      "api:build",
      "api:test",
      "user-web:typecheck",
      "user-web:lint",
      "user-web:build",
      "user-web:e2e",
      "admin-web:typecheck",
      "admin-web:lint",
      "admin-web:build",
      "admin-web:e2e",
      "mini:typecheck",
      "mini:test",
      "mini:build",
    ],
  );
  assert.ok(matrix.every(({ command }) => command === "corepack" || command === process.execPath));
  assert.ok(matrix.every(({ env }) => env.PATH === "synthetic-path"));
  assert.ok(matrix.every(({ env }) => !Object.hasOwn(env, "DATABASE_URL")));
  assert.ok(
    matrix.every(({ command, args }) => ![command, ...args].join(" ").includes("verify-release")),
  );
});

test("plan-only output does not claim execution readiness", () => {
  assert.equal(typeof api.createLocalReleasePlan, "function");
  const plan = api.createLocalReleasePlan(artifactRoot);

  assert.equal(plan.status, "PLAN_ONLY");
  assert.equal(plan.executionReadiness, "NOT_EVALUATED");
  assert.equal(plan.stages.length, 15);
});

const trialOptions = {
  artifactRoot: "artifacts/test-trial-matrix/run",
  miniTrial: true,
  baseEnvironment: {
    MINI_TRIAL_APP_ID: "wx0000000000000001",
    TARO_APP_API_BASE_URL: "https://api.synthetic-demo.org:443/",
    TARO_APP_PUBLIC_REFERENCE: "fixture-campus",
    TARO_APP_OUTPUT_ROOT: "untrusted-output",
    UNRELATED_PRIVATE_INPUT: "must-not-leak",
  },
};

test("mini trial selects the existing trial build only for the final planned and executed stage", async () => {
  const offline = api.createLocalReleaseCommandMatrix({ ...trialOptions, miniTrial: false });
  const stages = api.createLocalReleaseCommandMatrix(trialOptions);
  assert.deepEqual(stages.slice(0, -1), offline.slice(0, -1));
  assert.equal(offline.at(-1).env.TARO_APP_API_BASE_URL, "");
  assert.equal(offline.at(-1).args.at(-1), "build:weapp");
  const build = stages.at(-1);
  assert.equal(build.id, "mini:build");
  assert.deepEqual(build.args, ["pnpm", "--filter", "@student-care/mini-program-taro",
    "build:weapp:trial", "--output", "dist-test-trial-matrix-mini"]);
  assert.equal(build.env.MINI_TRIAL_APP_ID, trialOptions.baseEnvironment.MINI_TRIAL_APP_ID);
  assert.equal(build.env.TARO_APP_PUBLIC_REFERENCE, "fixture-campus");
  assert.equal(build.env.TARO_APP_API_BASE_URL, "https://api.synthetic-demo.org");
  assert.equal(build.env.TARO_APP_ALLOW_LOCAL_HTTP, "false");
  assert.equal(build.env.TARO_APP_OUTPUT_ROOT, undefined);
  assert.ok(stages.every(stage => !Object.hasOwn(stage.env, "UNRELATED_PRIVATE_INPUT")));
  assert.ok(stages.slice(0, -1).every(stage => stage.env.TARO_APP_API_BASE_URL === "" &&
    !Object.hasOwn(stage.env, "MINI_TRIAL_APP_ID") && !Object.hasOwn(stage.env, "TARO_APP_PUBLIC_REFERENCE")));
  const plan = api.createLocalReleasePlan(trialOptions.artifactRoot, trialOptions);
  const called = [];
  const report = await api.runLocalReleasePreflight({
    ...trialOptions,
    findEnvironmentFiles: async () => [],
    createDirectory: async () => {},
    writeFileContents: async () => {},
    runner: async stage => {
      called.push(stage);
      return { exitCode: stage.id === "mini:build" ? 7 : 0 };
    },
  });
  assert.deepEqual(called, stages);
  assert.deepEqual(plan.stages.map(s => s.command), called.map(s => [s.command, ...s.args]));
  assert.deepEqual(report.stages.at(-1).args, build.args);
  assert.equal(report.failedStage, "mini:build");
  assert.equal(report.stages.at(-1).exitCode, 7);
  assert.doesNotMatch(JSON.stringify([plan, report]), /must-not-leak/);
});

test("mini trial validates explicit inputs before writes or execution and guards its project root", async () => {
  const never = () => assert.fail("invalid or existing trial must not run or write");
  for (const bad of [
    { MINI_TRIAL_APP_ID: undefined }, { TARO_APP_PUBLIC_REFERENCE: "" },
    { TARO_APP_API_BASE_URL: "http://127.0.0.1" }, { TARO_APP_ALLOW_LOCAL_HTTP: "true" },
  ]) {
    const options = { ...trialOptions, baseEnvironment: { ...trialOptions.baseEnvironment, ...bad } };
    assert.throws(() => api.createLocalReleaseCommandMatrix(options), /MINI_TRIAL_APP_ID|TARO_APP_/);
    await assert.rejects(api.runLocalReleasePreflight({
      ...options, createDirectory: never, runner: never,
    }), /MINI_TRIAL_APP_ID|TARO_APP_/);
  }
  const path = "apps/mini-program-taro/dist-test-trial-matrix-mini";
  const report = await api.runLocalReleasePreflight({
    ...trialOptions,
    lstatPath: async candidate => {
      if (candidate === resolve(repositoryRoot, path)) return { isSymbolicLink: () => false };
      throw Object.assign(new Error("missing"), { code: "ENOENT" });
    },
    createDirectory: never, runner: never,
  });
  assert.deepEqual(report, { status: "BLOCKED_ARTIFACT_EXISTS", existingPaths: [path], stages: [] });
});

test("mini trial CLI requires a single explicit opt-in in plan and run modes", () => {
  for (const [flag, mode] of [["--plan", "plan"], ["--run-local", "run-local"]]) {
    const args = [flag, "--artifact-root=" + trialOptions.artifactRoot];
    assert.deepEqual(api.parseLocalReleasePreflightArgs([...args, "--mini-trial"]), {
      mode, artifactRoot: trialOptions.artifactRoot, miniTrial: true,
    });
    assert.equal(api.parseLocalReleasePreflightArgs(args).miniTrial, undefined);
    for (const invalid of [["--mini-trial", "--mini-trial"], ["--mini-trial=yes"]]) {
      assert.equal(api.parseLocalReleasePreflightArgs([...args, ...invalid]).mode, "invalid");
    }
  }
});

test("mini trial cannot create a project through a linked package directory", async () => {
  const packagePath = resolve(repositoryRoot, "apps/mini-program-taro");
  const report = await api.runLocalReleasePreflight({
    ...trialOptions,
    lstatPath: async path => {
      if ([repositoryRoot, join(repositoryRoot, "apps"), packagePath].includes(path)) {
        return { isSymbolicLink: () => path === packagePath };
      }
      throw Object.assign(new Error("missing"), { code: "ENOENT" });
    },
    findEnvironmentFiles: async () => [],
    createDirectory: () => assert.fail("linked package must be rejected before writes"),
  });
  assert.equal(report.status, "BLOCKED_MINI_PROJECT_SYMLINK");
  assert.deepEqual(report.stages, []);
});

test("mini trial CLI documents the stage in a plan and refuses bad configuration without echoing it", () => {
  const args = ["scripts/local-release-preflight.mjs", "--plan", "--mini-trial",
    "--artifact-root=" + trialOptions.artifactRoot];
  const inspect = (values) => spawnSync(process.execPath, args, {
    cwd: repositoryRoot, env: values, encoding: "utf8", windowsHide: true,
  });
  const good = inspect(trialOptions.baseEnvironment);
  assert.equal(good.status, 0, good.stderr);
  assert.ok(JSON.parse(good.stdout).stages.at(-1).command.includes("build:weapp:trial"));
  const bad = inspect({ ...trialOptions.baseEnvironment, TARO_APP_API_BASE_URL: "private-invalid-input" });
  assert.equal(bad.status, 2);
  assert.equal(JSON.parse(bad.stdout).status, "BLOCKED_INVALID_PREFLIGHT_INPUT");
  assert.doesNotMatch(bad.stdout + bad.stderr, /private-invalid-input/);
});

async function collectStage(stage) {
  const child = api.spawnLocalReleaseStage({ cwd: repositoryRoot, env: process.env, ...stage });
  let stdout = "";
  child.stdout.on("data", chunk => { stdout += chunk; });
  return new Promise((done, reject) => {
    child.once("error", reject);
    child.once("close", code => done({ code, stdout }));
  });
}

test("release subprocess preserves spaces and shell metacharacters as literal path arguments", async () => {
  const path = "a directory with spaces & echo SYNTHETIC_SECOND_COMMAND";
  const args = ["--eval", "process.stdout.write(JSON.stringify(process.argv.slice(1)))", "--", path];
  const result = await collectStage({ command: process.execPath, args });
  assert.equal(result.code, 0);
  assert.deepEqual(JSON.parse(result.stdout), [path]);
});

test("Windows release subprocess runs installed Corepack without a shell and fails when absent", {
  skip: process.platform !== "win32",
}, async () => {
  const command = "corepack";
  const result = await collectStage({ command, args: ["--version"] });
  assert.equal(result.code, 0);
  assert.match(result.stdout.trim(), /^\d+\.\d+\.\d+/);
  await assert.rejects(collectStage({ command, args: ["--version"], env: { PATH: "" } }), /corepack/i);
});

test("Windows trial stage preserves whitelisted mixed-case environment names after spreading process.env", {
  skip: process.platform !== "win32",
}, async () => {
  const baseEnvironment = { ...process.env, ...trialOptions.baseEnvironment };
  // A plain object loses the case-insensitive lookup provided by Windows process.env.
  for (const key of Object.keys(baseEnvironment)) {
    if (["PATH", "SYSTEMROOT", "COMSPEC"].includes(key.toUpperCase())) delete baseEnvironment[key];
  }
  Object.assign(baseEnvironment, {
    Path: process.env.PATH,
    SystemRoot: process.env.SYSTEMROOT,
    ComSpec: process.env.COMSPEC,
  });
  const stage = api.createLocalReleaseCommandMatrix({ ...trialOptions, baseEnvironment }).at(-1);
  for (const name of ["PATH", "SYSTEMROOT", "COMSPEC"]) {
    assert.ok(stage.env[name] === process.env[name], name + " was lost during environment filtering");
  }
  assert.equal(stage.env.UNRELATED_PRIVATE_INPUT, undefined);
  const result = await collectStage({ ...stage, args: ["--version"] });
  assert.equal(result.code, 0);
  assert.match(result.stdout.trim(), /^\d+\.\d+\.\d+/);
});

test("each package command exists and the Taro test command points at the current suite", async () => {
  assert.equal(typeof api.createLocalReleaseCommandMatrix, "function");
  const matrix = api.createLocalReleaseCommandMatrix({
    repositoryRoot,
    artifactRoot,
    baseEnvironment: { PATH: "synthetic-path" },
  });
  const manifests = new Map(
    await Promise.all(
      [
        ["@student-care/api", "apps/api/package.json"],
        ["@student-care/user-web", "apps/user-web/package.json"],
        ["@student-care/admin-web", "apps/admin-web/package.json"],
        ["@student-care/mini-program-taro", "apps/mini-program-taro/package.json"],
      ].map(async ([name, path]) => [
        name,
        JSON.parse(await readFile(join(repositoryRoot, path), "utf8")),
      ]),
    ),
  );

  for (const stage of matrix.filter(({ command }) => command === "corepack")) {
    const filterIndex = stage.args.indexOf("--filter");
    const packageName = stage.args[filterIndex + 1];
    assert.ok(manifests.has(packageName), `${stage.id} package must exist`);
    const execIndex = stage.args.indexOf("exec");
    if (execIndex >= 0) {
      assert.equal(
        stage.args[execIndex + 1],
        "tsc",
        `${stage.id} must use the package TypeScript compiler`,
      );
    } else {
      const scriptName = stage.args[filterIndex + 2];
      assert.ok(
        Object.hasOwn(manifests.get(packageName).scripts, scriptName),
        `${stage.id} script must exist`,
      );
    }
  }
  const miniTests = (await readdir(join(repositoryRoot, "apps/mini-program-taro/test"))).filter(
    (name) => name.endsWith(".test.mjs"),
  );
  assert.equal(miniTests.length, 36);
  assert.equal(
    matrix.find(({ id }) => id === "mini:test").args.at(-1),
    "apps/mini-program-taro/test/*.test.mjs",
  );
});

test("isolates Next and browser-test outputs inside the requested artifact run", () => {
  assert.equal(typeof api.createLocalReleaseCommandMatrix, "function");
  const matrix = api.createLocalReleaseCommandMatrix({
    repositoryRoot,
    artifactRoot,
    baseEnvironment: { PATH: "synthetic-path" },
  });
  const userWeb = matrix.find(({ id }) => id === "user-web:e2e");
  const adminWeb = matrix.find(({ id }) => id === "admin-web:e2e");

  assert.equal(userWeb.env.USER_WEB_E2E_ARTIFACT_ROOT, `${artifactRoot}/user-web-e2e`);
  assert.equal(
    adminWeb.env.ADMIN_NEXT_EVIDENCE_DIR,
    resolve(repositoryRoot, artifactRoot, "admin-web-e2e"),
  );
  assert.equal(
    matrix.find(({ id }) => id === "user-web:build").env.TASK20_NEXT_DIST_DIR,
    ".next-task20-a1-261-local-release-preflight-20261022-user-web",
  );
  assert.equal(
    matrix.find(({ id }) => id === "admin-web:build").env.TASK20_NEXT_DIST_DIR,
    ".next-task20-a1-261-local-release-preflight-20261022-admin-web",
  );
  assert.equal(
    userWeb.env.TASK20_NEXT_DIST_DIR,
    ".next-task20-a1-261-local-release-preflight-20261022-user-web",
  );
  assert.equal(
    userWeb.env.TASK20_NEXT_ADMIN_DIST_DIR,
    ".next-task20-a1-261-local-release-preflight-20261022-admin-web",
  );
  assert.equal(adminWeb.env.TASK20_ADMIN_NEXT_MODE, "production");
  assert.equal(
    adminWeb.env.TASK20_ADMIN_NEXT_DIST_DIR,
    ".next-task20-a1-261-local-release-preflight-20261022-admin-web",
  );
});

test("Next type checks disable incremental caches for the application worktrees", () => {
  const matrix = api.createLocalReleaseCommandMatrix({
    repositoryRoot,
    artifactRoot,
    baseEnvironment: { PATH: "synthetic-path" },
  });

  for (const id of ["user-web:typecheck", "admin-web:typecheck"]) {
    const stage = matrix.find((entry) => entry.id === id);
    assert.ok(stage);
    assert.ok(stage.args.includes("exec"));
    assert.ok(stage.args.includes("--incremental"));
    assert.ok(stage.args.includes("false"));
  }
});

test("user browser tests receive the same API build as the matrix and the admin server's tsconfig", () => {
  const matrix = api.createLocalReleaseCommandMatrix({
    repositoryRoot,
    artifactRoot: "artifacts/rc-a1470/run",
    baseEnvironment: {
      TASK20_BROWSER_ARTIFACT_ROOT: "artifacts/unrelated/run",
      TASK20_BROWSER_API_MODE: "untrusted",
      TASK20_API_RUNTIME: "apps/api/dist/src",
      TASK20_ADMIN_NEXT_TSCONFIG: "unexpected.json",
    },
  });
  const stage = matrix.find(({ id }) => id === "user-web:e2e");
  const build = matrix.find(({ id }) => id === "api:build");
  const paths = resolveReleaseBrowserPaths(repositoryRoot, stage.env);
  assert.equal(paths.artifactRoot, join(repositoryRoot, "artifacts", "rc-a1470", "run"));
  assert.equal(paths.apiRuntimeRoot, join(build.args[build.args.indexOf("--outDir") + 1], "src"));
  assert.equal(
    join(repositoryRoot, "apps", "admin-web", stage.env.TASK20_ADMIN_NEXT_TSCONFIG),
    join(paths.artifactRoot, "admin-web.next.tsconfig.json"),
  );
  for (const { id, env } of matrix) {
    assert.equal(Object.hasOwn(env, "TASK20_API_RUNTIME"), false);
    for (const key of [
      "TASK20_BROWSER_ARTIFACT_ROOT",
      "TASK20_BROWSER_API_MODE",
      "TASK20_ADMIN_NEXT_TSCONFIG",
    ])
      assert.equal(Object.hasOwn(env, key), id === "user-web:e2e");
  }
});

test("the release browser suite loads API modules through the selected build", async () => {
  const userWebPackage = resolve(repositoryRoot, "apps/user-web");
  const manifest = JSON.parse(await readFile(join(userWebPackage, "package.json"), "utf8"));
  const browserTests = manifest.scripts["next:e2e"].split(/\s+/u).filter((arg) => arg.endsWith(".mjs"));
  assert.ok(browserTests.length > 0);
  for (const path of [...browserTests, "../../tests/e2e/helpers/user-web-next-browser.mjs"]) {
    const source = await readFile(resolve(userWebPackage, path), "utf8");
    assert.doesNotMatch(source, /apps\/api\/dist(?:\/|["'])/u, path);
  }
  const helper = await readFile(resolve(repositoryRoot, "tests/e2e/helpers/user-web-next-browser.mjs"), "utf8");
  assert.match(helper, /startNextAdminLocal\(\{[^}]*buildLocalSyntheticServer[^}]*\}\)/u);
});

test("runs fixed stages sequentially and stores only hashes of child output", async () => {
  assert.equal(typeof api.runLocalReleasePreflight, "function");
  const calls = [];
  const secretOutput = "synthetic child output that must not be persisted";
  const report = await api.runLocalReleasePreflight({
    repositoryRoot,
    artifactRoot,
    baseEnvironment: { PATH: "synthetic-path", STUDENT_CARE_INVITE_ACCOUNTS_JSON: "do-not-copy" },
    findEnvironmentFiles: async () => [],
    createDirectory: async () => {},
    writeFileContents: async () => {},
    runner: async (stage, output) => {
      calls.push(stage.id);
      output.stdout(Buffer.from(secretOutput));
      return { exitCode: 0 };
    },
  });
  const expectedHash = createHash("sha256")
    .update("stdout\0")
    .update(createHash("sha256").update(secretOutput).digest())
    .update("stderr\0")
    .update(createHash("sha256").digest())
    .digest("hex")
    .toUpperCase();

  assert.equal(report.status, "PASS");
  assert.deepEqual(
    calls,
    report.stages.map(({ id }) => id),
  );
  assert.equal(report.stages[0].outputSha256, expectedHash);
  assert.doesNotMatch(JSON.stringify(report), /synthetic child output|do-not-copy/u);
  assert.ok(
    report.stages.every(
      (stage) => !Object.hasOwn(stage, "stdout") && !Object.hasOwn(stage, "stderr"),
    ),
  );
});

test("stops at the first failing stage", async () => {
  assert.equal(typeof api.runLocalReleasePreflight, "function");
  const calls = [];
  const report = await api.runLocalReleasePreflight({
    repositoryRoot,
    artifactRoot,
    baseEnvironment: { PATH: "synthetic-path" },
    findEnvironmentFiles: async () => [],
    createDirectory: async () => {},
    writeFileContents: async () => {},
    runner: async (stage) => {
      calls.push(stage.id);
      return { exitCode: stage.id === "api:schema" ? 7 : 0 };
    },
  });

  assert.equal(report.status, "FAIL");
  assert.equal(report.failedStage, "api:schema");
  assert.deepEqual(calls, ["api:typecheck", "api:schema"]);
});

test("refuses execution when an environment file name is present", async () => {
  assert.equal(typeof api.runLocalReleasePreflight, "function");
  const calls = [];
  const report = await api.runLocalReleasePreflight({
    repositoryRoot,
    artifactRoot,
    baseEnvironment: { PATH: "synthetic-path" },
    findEnvironmentFiles: async () => ["apps/api/.env.local"],
    runner: async (stage) => {
      calls.push(stage.id);
      return { exitCode: 0 };
    },
  });

  assert.equal(report.status, "BLOCKED_ENV_FILES");
  assert.deepEqual(calls, []);
  assert.deepEqual(report.environmentFileNames, ["apps/api/.env.local"]);
  assert.doesNotMatch(JSON.stringify(report), /DATABASE_URL|password|token/iu);
});

test("environment preflight checks only names and finds no active environment files", async () => {
  assert.equal(typeof api.findEnvironmentFileNames, "function");
  assert.deepEqual(await api.findEnvironmentFileNames(repositoryRoot), []);
});

test("environment preflight treats symlinked environment files as active", async () => {
  assert.equal(typeof api.findEnvironmentFileNames, "function");
  const report = await api.findEnvironmentFileNames(repositoryRoot, {
    readDirectory: async (directory) => {
      if (directory === repositoryRoot) {
        return [
          {
            name: ".env.local",
            isFile: () => false,
            isSymbolicLink: () => true,
          },
        ];
      }
      const error = new Error("missing fixture directory");
      error.code = "ENOENT";
      throw error;
    },
  });

  assert.deepEqual(report, [".env.local"]);
});

test("routes validated local synthetic database settings only to user-web e2e", () => {
  assert.equal(typeof api.createLocalReleaseCommandMatrix, "function");
  const databaseUrl = "postgresql://synthetic:synthetic@127.0.0.1:54321/postgres";
  const matrix = api.createLocalReleaseCommandMatrix({
    repositoryRoot,
    artifactRoot,
    baseEnvironment: {
      PATH: "synthetic-path",
      DATABASE_URL: databaseUrl,
      TASK20_TEST_DATABASE_PORT: "54321",
    },
  });
  const databaseStages = matrix.filter(
    ({ env }) => Object.hasOwn(env, "DATABASE_URL") || Object.hasOwn(env, "TASK20_TEST_DATABASE_PORT"),
  );

  assert.equal(databaseStages.length, 1);
  assert.equal(databaseStages[0].id, "user-web:e2e");
  assert.equal(databaseStages[0].env.DATABASE_URL, databaseUrl);
  assert.equal(databaseStages[0].env.TASK20_TEST_DATABASE_PORT, "54321");
});

test("fails closed on incomplete or non-loopback synthetic database settings", () => {
  assert.equal(typeof api.createLocalReleaseCommandMatrix, "function");
  const invalidConfigurations = [
    { DATABASE_URL: "postgresql://synthetic:synthetic@127.0.0.1:54321/postgres" },
    { TASK20_TEST_DATABASE_PORT: "54321" },
    {
      DATABASE_URL: "postgresql://synthetic:synthetic@db.example.invalid:54321/postgres",
      TASK20_TEST_DATABASE_PORT: "54321",
    },
    {
      DATABASE_URL: "postgresql://synthetic:synthetic@127.0.0.1:54322/postgres",
      TASK20_TEST_DATABASE_PORT: "54321",
    },
    {
      DATABASE_URL: "postgresql://synthetic:synthetic@127.0.0.1:54321/postgres?sslmode=require",
      TASK20_TEST_DATABASE_PORT: "54321",
    },
  ];

  for (const variables of invalidConfigurations) {
    assert.throws(
      () =>
        api.createLocalReleaseCommandMatrix({
          repositoryRoot,
          artifactRoot,
          baseEnvironment: { PATH: "synthetic-path", ...variables },
        }),
      { message: "LOCAL_TEST_DATABASE_CONFIGURATION_INVALID" },
    );
  }
});

test("rejects artifact paths outside the repository artifacts directory", () => {
  assert.equal(typeof api.createLocalReleaseCommandMatrix, "function");
  assert.throws(
    () =>
      api.createLocalReleaseCommandMatrix({
        repositoryRoot,
        artifactRoot: "../outside",
        baseEnvironment: { PATH: "synthetic-path" },
      }),
    /artifact/i,
  );
});

test("refuses artifact paths that traverse a symbolic link", async () => {
  assert.equal(typeof api.runLocalReleasePreflight, "function");
  const calls = [];
  const inspectedPaths = [];
  const symbolicLinkPath = resolve(repositoryRoot, "artifacts", "redirect");
  const report = await api.runLocalReleasePreflight({
    repositoryRoot,
    artifactRoot: "artifacts/redirect/run",
    baseEnvironment: { PATH: "synthetic-path" },
    lstatPath: async (path) => {
      inspectedPaths.push(path);
      return { isSymbolicLink: () => path === symbolicLinkPath };
    },
    findEnvironmentFiles: async () => [],
    runner: async (stage) => {
      calls.push(stage.id);
      return { exitCode: 0 };
    },
  });

  assert.equal(report.status, "BLOCKED_ARTIFACT_SYMLINK");
  assert.deepEqual(calls, []);
  assert.ok(inspectedPaths.includes(symbolicLinkPath));
});

test("user-web E2E screenshot paths accept an isolated evidence root", async () => {
  const pickup = await readFile(
    join(repositoryRoot, "tests/e2e/user-web-next-parent-pickup.spec.mjs"),
    "utf8",
  );
  const workbench = await readFile(
    join(repositoryRoot, "tests/e2e/user-web-next-staff-workbench.spec.mjs"),
    "utf8",
  );

  assert.match(pickup, /process\.env\.USER_WEB_E2E_ARTIFACT_ROOT/u);
  assert.match(workbench, /process\.env\.USER_WEB_E2E_ARTIFACT_ROOT/u);
  assert.match(pickup, /relative\(resolve\(repositoryRoot, "artifacts"\)/u);
  assert.match(workbench, /relative\(resolve\(repositoryRoot, "artifacts"\)/u);
  assert.match(pickup, /process\.env\.TASK20_NEXT_DIST_DIR\s*\?\?=/u);
  assert.match(workbench, /TASK20_NEXT_DIST_DIR:\s*process\.env\.TASK20_NEXT_DIST_DIR\s*\?\?/u);
});

test("local execution requires a caller-selected evidence root", () => {
  assert.equal(typeof api.parseLocalReleasePreflightArgs, "function");
  assert.deepEqual(api.parseLocalReleasePreflightArgs(["--run-local"]), {
    mode: "blocked",
    status: "BLOCKED_ARTIFACT_ROOT_REQUIRED",
  });
});

test("programmatic local execution also requires an explicit evidence root", async () => {
  assert.equal(typeof api.runLocalReleasePreflight, "function");
  const calls = [];
  const report = await api.runLocalReleasePreflight({
    repositoryRoot,
    baseEnvironment: { PATH: "synthetic-path" },
    runner: async (stage) => {
      calls.push(stage.id);
      return { exitCode: 0 };
    },
  });

  assert.equal(report.status, "BLOCKED_ARTIFACT_ROOT_REQUIRED");
  assert.deepEqual(calls, []);
});

test("local execution stops before stages when the evidence root already exists", async () => {
  assert.equal(typeof api.runLocalReleasePreflight, "function");
  const artifactRoot = "artifacts/task20-a1-323-existing-evidence/run";
  const existingPath = resolve(repositoryRoot, artifactRoot);
  const calls = [];
  const report = await api.runLocalReleasePreflight({
    repositoryRoot,
    artifactRoot,
    baseEnvironment: { PATH: "synthetic-path" },
    lstatPath: async (path) => {
      if (resolve(path) === existingPath) return { isSymbolicLink: () => false };
      const error = new Error("missing fixture path");
      error.code = "ENOENT";
      throw error;
    },
    findEnvironmentFiles: async () => [],
    runner: async (stage) => {
      calls.push(stage.id);
      return { exitCode: 0 };
    },
  });

  assert.equal(report.status, "BLOCKED_ARTIFACT_EXISTS");
  assert.deepEqual(report.existingPaths, [artifactRoot]);
  assert.deepEqual(calls, []);
});

test("local execution stops before stages when a run-specific Next output already exists", async () => {
  assert.equal(typeof api.runLocalReleasePreflight, "function");
  const artifactRoot = "artifacts/task20-a1-323-existing-next-output/run";
  const existingPath = resolve(
    repositoryRoot,
    "apps/user-web/.next-task20-a1-323-existing-next-output-user-web",
  );
  const calls = [];
  const report = await api.runLocalReleasePreflight({
    repositoryRoot,
    artifactRoot,
    baseEnvironment: { PATH: "synthetic-path" },
    lstatPath: async (path) => {
      if (resolve(path) === existingPath) return { isSymbolicLink: () => false };
      const error = new Error("missing fixture path");
      error.code = "ENOENT";
      throw error;
    },
    findEnvironmentFiles: async () => [],
    runner: async (stage) => {
      calls.push(stage.id);
      return { exitCode: 0 };
    },
  });

  assert.equal(report.status, "BLOCKED_ARTIFACT_EXISTS");
  assert.deepEqual(report.existingPaths, [
    "apps/user-web/.next-task20-a1-323-existing-next-output-user-web",
  ]);
  assert.deepEqual(calls, []);
});

test("API compile and test stages use only the isolated run output", () => {
  const artifactRoot = "artifacts/rc-a1461/run";
  const matrix = api.createLocalReleaseCommandMatrix({
    repositoryRoot,
    artifactRoot,
    baseEnvironment: { PATH: "synthetic-path" },
  });
  const build = matrix.find(({ id }) => id === "api:build");
  const apiTests = matrix.find(({ id }) => id === "api:test");
  const outputIndex = build.args.indexOf("--outDir");

  assert.ok(outputIndex >= 0);
  assert.equal(
    build.args[outputIndex + 1],
    resolve(repositoryRoot, "apps/api/.dist-rc-a1461-api"),
  );
  assert.equal(apiTests.command, process.execPath);
  assert.deepEqual(apiTests.args, [
    "scripts/local-release-api-tests.mjs",
    "--api-dist-root=apps/api/.dist-rc-a1461-api",
  ]);
});

test("local execution stops before stages when the isolated API output already exists", async () => {
  const artifactRoot = "artifacts/rc-a1461/run";
  const existingPath = resolve(repositoryRoot, "apps/api/.dist-rc-a1461-api");
  const calls = [];
  const report = await api.runLocalReleasePreflight({
    repositoryRoot,
    artifactRoot,
    baseEnvironment: { PATH: "synthetic-path" },
    lstatPath: async (path) => {
      if (resolve(path) === existingPath) return { isSymbolicLink: () => false };
      const error = new Error("missing fixture path");
      error.code = "ENOENT";
      throw error;
    },
    findEnvironmentFiles: async () => [],
    runner: async (stage) => {
      calls.push(stage.id);
      return { exitCode: 0 };
    },
  });

  assert.equal(report.status, "BLOCKED_ARTIFACT_EXISTS");
  assert.deepEqual(report.existingPaths, ["apps/api/.dist-rc-a1461-api"]);
  assert.deepEqual(calls, []);
});

test("Taro build uses a run-specific output and preflight guards it before stages", async () => {
  const artifactRoot = "artifacts/rc-a1461/run";
  const matrix = api.createLocalReleaseCommandMatrix({
    repositoryRoot,
    artifactRoot,
    baseEnvironment: { PATH: "synthetic-path" },
  });
  assert.equal(
    matrix.find(({ id }) => id === "mini:build").env.TARO_APP_OUTPUT_ROOT,
    "dist-rc-a1461-mini",
  );

  const existingPath = resolve(repositoryRoot, "apps/mini-program-taro/dist-rc-a1461-mini");
  const calls = [];
  const report = await api.runLocalReleasePreflight({
    repositoryRoot,
    artifactRoot,
    baseEnvironment: { PATH: "synthetic-path" },
    lstatPath: async (path) => {
      if (resolve(path) === existingPath) return { isSymbolicLink: () => false };
      const error = new Error("missing fixture path");
      error.code = "ENOENT";
      throw error;
    },
    findEnvironmentFiles: async () => [],
    runner: async (stage) => {
      calls.push(stage.id);
      return { exitCode: 0 };
    },
  });

  assert.equal(report.status, "BLOCKED_ARTIFACT_EXISTS");
  assert.deepEqual(report.existingPaths, ["apps/mini-program-taro/dist-rc-a1461-mini"]);
  assert.deepEqual(calls, []);
});

test("Next typecheck and build stages share run-specific TypeScript configs", () => {
  const artifactRoot = "artifacts/rc-a1463/run";
  const matrix = api.createLocalReleaseCommandMatrix({
    repositoryRoot,
    artifactRoot,
    baseEnvironment: { PATH: "synthetic-path" },
  });

  for (const app of ["user-web", "admin-web"]) {
    const configPath = resolve(repositoryRoot, artifactRoot, `${app}.next.tsconfig.json`);
    const typecheck = matrix.find(({ id }) => id === `${app}:typecheck`);
    const build = matrix.find(({ id }) => id === `${app}:build`);
    const projectIndex = typecheck.args.indexOf("-p");

    assert.ok(projectIndex >= 0);
    assert.equal(typecheck.args[projectIndex + 1], configPath);
    const appRoot = join(repositoryRoot, "apps", app);
    for (const stage of [typecheck, build, matrix.find(({ id }) => id === `${app}:e2e`)]) {
      // Next joins this setting to the application directory, even if given an absolute path.
      assert.equal(join(appRoot, stage.env.TASK20_NEXT_TSCONFIG), configPath);
    }
  }
});

test("preflight writes isolated Next type configs after guards and before stages", async () => {
  const artifactRoot = "artifacts/rc-a1463/run";
  const writes = [];
  let directoryCreated = false;
  const report = await api.runLocalReleasePreflight({
    repositoryRoot,
    artifactRoot,
    baseEnvironment: { PATH: "synthetic-path" },
    lstatPath: async () => {
      const error = new Error("missing fixture path");
      error.code = "ENOENT";
      throw error;
    },
    findEnvironmentFiles: async () => [],
    createDirectory: async () => {
      directoryCreated = true;
    },
    writeFileContents: async (path, contents, options) => {
      writes.push({ path, config: JSON.parse(contents), options });
    },
    runner: async () => {
      assert.equal(directoryCreated, true);
      assert.equal(writes.length, 2);
      return { exitCode: 0 };
    },
  });

  assert.equal(report.status, "PASS");
  assert.equal(writes.length, 2);
  for (const [index, app] of ["user-web", "admin-web"].entries()) {
    const write = writes[index];
    assert.equal(write.path, resolve(repositoryRoot, artifactRoot, `${app}.next.tsconfig.json`));
    assert.equal(write.options.flag, "wx");
    assert.equal(write.config.extends, `../../../apps/${app}/next.tsconfig.json`);
    assert.ok(
      write.config.include.includes(
        `../../../apps/${app}/.next-rc-a1463-${app}/types/**/*.ts`,
      ),
    );
    assert.ok(!write.config.include.some((path) => path.includes("/.next/types/")));
    assert.ok(write.config.include.includes(`../../../apps/${app}/src/app/**/*.tsx`));
  }
});
