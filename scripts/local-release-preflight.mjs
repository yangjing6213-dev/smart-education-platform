import { spawn } from "node:child_process";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { statSync } from "node:fs";
import { lstat, mkdir, readdir, writeFile } from "node:fs/promises";
import { basename, delimiter, dirname, isAbsolute, relative, resolve, sep } from "node:path";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";
import { validateTrialEnv } from "../apps/mini-program-taro/scripts/build-trial.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultArtifactRoot = "artifacts/task20-a1-261-local-release-preflight-20261022/run";
const environmentDirectories = [
  ".",
  "apps/user-web",
  "apps/admin-web",
  "apps/api",
  "apps/mini-program-taro",
];
const environmentNames = [
  "PATH",
  "PATHEXT",
  "SYSTEMROOT",
  "WINDIR",
  "COMSPEC",
  "HOMEDRIVE",
  "HOMEPATH",
  "USERPROFILE",
  "APPDATA",
  "LOCALAPPDATA",
  "TEMP",
  "TMP",
  "PROGRAMFILES",
  "PROGRAMFILES(X86)",
  "USER_WEB_BROWSER",
  "ADMIN_WEB_BROWSER",
];

function normalizeArtifactRoot(root, artifactRoot) {
  const absoluteRoot = isAbsolute(artifactRoot)
    ? resolve(artifactRoot)
    : resolve(root, artifactRoot);
  const artifactsDirectory = resolve(root, "artifacts");
  const relativeToArtifacts = relative(artifactsDirectory, absoluteRoot);

  if (
    relativeToArtifacts === "" ||
    relativeToArtifacts === ".." ||
    relativeToArtifacts.startsWith(`..${sep}`) ||
    isAbsolute(relativeToArtifacts)
  ) {
    throw new Error("ARTIFACT_ROOT_MUST_BE_INSIDE_REPOSITORY_ARTIFACTS");
  }

  const relativeToRepository = relative(root, absoluteRoot).replaceAll("\\", "/");
  const runId = basename(dirname(absoluteRoot));
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/u.test(runId)) {
    throw new Error("ARTIFACT_ROOT_RUN_ID_INVALID");
  }

  return { absoluteRoot, relativeToRepository, runId };
}

async function traversesSymlink(root, directory, lstatPath) {
  const descendants = relative(root, directory).split(sep).filter(Boolean);
  let currentPath = root;
  const candidates = [root];

  for (const part of descendants) {
    currentPath = resolve(currentPath, part);
    candidates.push(currentPath);
  }

  for (const candidate of candidates) {
    let entry;
    try {
      entry = await lstatPath(candidate);
    } catch (error) {
      if (error?.code === "ENOENT") break;
      throw error;
    }
    if (entry.isSymbolicLink()) return true;
  }

  return false;
}

function localEnvironment(baseEnvironment, overrides = {}) {
  const environment = {};
  const windowsKeys = process.platform === "win32" ? Object.keys(baseEnvironment) : [];
  for (const name of environmentNames) {
    const key = Object.hasOwn(baseEnvironment, name)
      ? name
      : windowsKeys.find(entry => entry.toUpperCase() === name);
    if (key !== undefined && typeof baseEnvironment[key] === "string") {
      environment[name] = baseEnvironment[key];
    }
  }

  return {
    ...environment,
    CI: "1",
    COREPACK_ENABLE_NETWORK: "0",
    DO_NOT_TRACK: "1",
    NEXT_TELEMETRY_DISABLED: "1",
    npm_config_offline: "true",
    TARO_APP_API_BASE_URL: "",
    ...overrides,
  };
}

function localSyntheticDatabaseEnvironment(baseEnvironment) {
  const databaseUrl = baseEnvironment.DATABASE_URL;
  const databasePort = baseEnvironment.TASK20_TEST_DATABASE_PORT;
  const hasDatabaseUrl = typeof databaseUrl === "string" && databaseUrl.length > 0;
  const hasDatabasePort = typeof databasePort === "string" && databasePort.length > 0;

  if (!hasDatabaseUrl && !hasDatabasePort) return {};
  if (
    !hasDatabaseUrl ||
    !hasDatabasePort ||
    databaseUrl.trim() !== databaseUrl ||
    !/^[1-9][0-9]{3,4}$/u.test(databasePort) ||
    Number(databasePort) < 1024 ||
    Number(databasePort) > 65535
  ) {
    throw new Error("LOCAL_TEST_DATABASE_CONFIGURATION_INVALID");
  }

  let url;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error("LOCAL_TEST_DATABASE_CONFIGURATION_INVALID");
  }
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    url.hostname !== "127.0.0.1" ||
    url.port !== databasePort ||
    url.search ||
    url.hash
  ) {
    throw new Error("LOCAL_TEST_DATABASE_CONFIGURATION_INVALID");
  }

  return {
    DATABASE_URL: databaseUrl,
    TASK20_TEST_DATABASE_PORT: databasePort,
  };
}

function command(stage, args, environment, root) {
  return {
    id: stage,
    command: "corepack",
    args: ["pnpm", ...args],
    cwd: root,
    cwdRelative: ".",
    env: environment,
  };
}

function packageExecCommand(stage, filter, executableArgs, environment, root) {
  return {
    id: stage,
    command: "corepack",
    args: ["pnpm", "--filter", filter, "exec", ...executableArgs],
    cwd: root,
    cwdRelative: ".",
    env: environment,
  };
}

function appCommandMatrix({ root, artifact, baseEnvironment, miniTrial = false }) {
  if (typeof miniTrial !== "boolean") throw new Error("MINI_TRIAL_MODE_INVALID");
  const trial = miniTrial ? validateTrialEnv(baseEnvironment) : undefined;
  const userDistDirectory = `.next-${artifact.runId}-user-web`;
  const adminDistDirectory = `.next-${artifact.runId}-admin-web`;
  const apiOutputRelative = `apps/api/.dist-${artifact.runId}-api`;
  const apiOutputDirectory = resolve(root, apiOutputRelative);
  const miniOutputDirectory = `dist-${artifact.runId}-mini`;
  const userTsconfigPath = resolve(artifact.absoluteRoot, "user-web.next.tsconfig.json");
  const adminTsconfigPath = resolve(artifact.absoluteRoot, "admin-web.next.tsconfig.json");
  // Next joins tsconfigPath to its own app root. tsc -p accepts the absolute paths above.
  const appRelativeTsconfig = (app, path) => relative(resolve(root, "apps", app), path).split(sep).join("/");
  const userNextTsconfig = appRelativeTsconfig("user-web", userTsconfigPath);
  const adminNextTsconfig = appRelativeTsconfig("admin-web", adminTsconfigPath);
  const userEvidenceRoot = `${artifact.relativeToRepository}/user-web-e2e`;
  const adminEvidenceRoot = resolve(artifact.absoluteRoot, "admin-web-e2e");
  const api = "@student-care/api";
  const userWeb = "@student-care/user-web";
  const adminWeb = "@student-care/admin-web";
  const mini = "@student-care/mini-program-taro";
  const make = (id, filter, script, overrides = {}, args = []) =>
    command(
      id,
      ["--filter", filter, script, ...args],
      localEnvironment(baseEnvironment, overrides),
      root,
    );

  const userEnvironment = {
    TASK20_NEXT_DIST_DIR: userDistDirectory,
    TASK20_NEXT_ADMIN_DIST_DIR: adminDistDirectory,
    TASK20_NEXT_TSCONFIG: userNextTsconfig,
    USER_WEB_E2E_ARTIFACT_ROOT: userEvidenceRoot,
  };
  const userE2eDatabaseEnvironment = localSyntheticDatabaseEnvironment(baseEnvironment);
  const adminEnvironment = {
    TASK20_NEXT_DIST_DIR: adminDistDirectory,
    TASK20_NEXT_TSCONFIG: adminNextTsconfig,
  };
  const adminE2eEnvironment = {
    TASK20_ADMIN_NEXT_MODE: "production",
    TASK20_ADMIN_NEXT_DIST_DIR: adminDistDirectory,
    TASK20_NEXT_TSCONFIG: adminNextTsconfig,
    ADMIN_NEXT_EVIDENCE_DIR: adminEvidenceRoot,
  };

  return [
    make("api:typecheck", api, "typecheck"),
    make("api:schema", api, "db:schema:validate"),
    packageExecCommand(
      "api:build",
      api,
      ["tsc", "-p", "tsconfig.json", "--outDir", apiOutputDirectory],
      localEnvironment(baseEnvironment),
      root,
    ),
    {
      id: "api:test",
      command: process.execPath,
      args: [
        "scripts/local-release-api-tests.mjs",
        `--api-dist-root=${apiOutputRelative}`,
      ],
      cwd: root,
      cwdRelative: ".",
      env: localEnvironment(baseEnvironment),
    },
    packageExecCommand(
      "user-web:typecheck",
      userWeb,
      ["tsc", "-p", userTsconfigPath, "--noEmit", "--incremental", "false"],
      localEnvironment(baseEnvironment, userEnvironment),
      root,
    ),
    make("user-web:lint", userWeb, "next:lint", userEnvironment),
    make("user-web:build", userWeb, "next:build", userEnvironment),
    make("user-web:e2e", userWeb, "next:e2e", {
      ...userEnvironment,
      ...userE2eDatabaseEnvironment,
      TASK20_BROWSER_ARTIFACT_ROOT: artifact.absoluteRoot,
      TASK20_BROWSER_API_MODE: "preflight-candidate",
      TASK20_ADMIN_NEXT_TSCONFIG: adminNextTsconfig,
    }),
    packageExecCommand(
      "admin-web:typecheck",
      adminWeb,
      ["tsc", "-p", adminTsconfigPath, "--noEmit", "--incremental", "false"],
      localEnvironment(baseEnvironment, adminEnvironment),
      root,
    ),
    make("admin-web:lint", adminWeb, "next:lint", adminEnvironment),
    make("admin-web:build", adminWeb, "next:build", adminEnvironment),
    make("admin-web:e2e", adminWeb, "next:e2e", adminE2eEnvironment),
    make("mini:typecheck", mini, "typecheck"),
    {
      id: "mini:test",
      command: process.execPath,
      args: [
        "--experimental-strip-types",
        "--test",
        "--test-concurrency=1",
        "apps/mini-program-taro/test/*.test.mjs",
      ],
      cwd: root,
      cwdRelative: ".",
      env: localEnvironment(baseEnvironment),
    },
    trial
      ? make(
          "mini:build", mini, "build:weapp:trial",
          {
            MINI_TRIAL_APP_ID: trial.appid,
            TARO_APP_API_BASE_URL: trial.origin,
            TARO_APP_PUBLIC_REFERENCE: trial.reference,
            TARO_APP_ALLOW_LOCAL_HTTP: "false",
          },
          ["--output", miniOutputDirectory],
        )
      : make("mini:build", mini, "build:weapp", { TARO_APP_OUTPUT_ROOT: miniOutputDirectory }),
  ];
}

export function createLocalReleaseCommandMatrix({
  repositoryRoot: root = repositoryRoot,
  artifactRoot = defaultArtifactRoot,
  baseEnvironment = process.env,
  miniTrial,
} = {}) {
  const absoluteRepositoryRoot = resolve(root);
  const artifact = normalizeArtifactRoot(absoluteRepositoryRoot, artifactRoot);
  return appCommandMatrix({ root: absoluteRepositoryRoot, artifact, baseEnvironment, miniTrial });
}

export function createIsolatedNextTypeScriptConfig({
  repositoryRoot: root = repositoryRoot,
  artifactRoot = defaultArtifactRoot,
  application,
} = {}) {
  if (!["user-web", "admin-web"].includes(application)) {
    throw new Error("NEXT_APPLICATION_INVALID");
  }
  const absoluteRoot = resolve(root);
  const artifact = normalizeArtifactRoot(absoluteRoot, artifactRoot);
  const appRoot = resolve(absoluteRoot, "apps", application);
  const distDirectory = `.next-${artifact.runId}-${application}`;
  const fromArtifactRoot = (path) => relative(artifact.absoluteRoot, path).replaceAll("\\", "/");

  return {
    extends: fromArtifactRoot(resolve(appRoot, "next.tsconfig.json")),
    include: [
      fromArtifactRoot(resolve(appRoot, "next-env.d.ts")),
      fromArtifactRoot(resolve(appRoot, distDirectory, "types", "**", "*.ts")),
      fromArtifactRoot(resolve(appRoot, distDirectory, "dev", "types", "**", "*.ts")),
      fromArtifactRoot(resolve(appRoot, "src/app", "**", "*.ts")),
      fromArtifactRoot(resolve(appRoot, "src/app", "**", "*.tsx")),
    ],
  };
}

async function prepareIsolatedNextTypeScriptConfigs({
  repositoryRoot: root,
  artifact,
  createDirectory = mkdir,
  writeFileContents = writeFile,
}) {
  await createDirectory(artifact.absoluteRoot, { recursive: true });
  for (const application of ["user-web", "admin-web"]) {
    const config = createIsolatedNextTypeScriptConfig({
      repositoryRoot: root,
      artifactRoot: artifact.absoluteRoot,
      application,
    });
    const configPath = resolve(artifact.absoluteRoot, `${application}.next.tsconfig.json`);
    await writeFileContents(configPath, `${JSON.stringify(config, null, 2)}\n`, { flag: "wx" });
  }
}

export async function findEnvironmentFileNames(
  root = repositoryRoot,
  { readDirectory = readdir } = {},
) {
  const names = [];
  for (const directory of environmentDirectories) {
    const absoluteDirectory = resolve(root, directory);
    let entries;
    try {
      entries = await readDirectory(absoluteDirectory, { withFileTypes: true });
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      names.push(`${directory}/<unreadable>`);
      continue;
    }

    for (const entry of entries) {
      if (!(entry.isFile() || entry.isSymbolicLink()) || !/^\.env(?:\.|$)/u.test(entry.name))
        continue;
      if (/^\.env(?:\..+)?\.example$/u.test(entry.name)) continue;
      names.push(`${directory === "." ? "" : `${directory}/`}${entry.name}`);
    }
  }
  return names.sort();
}

function createOutputHandlers() {
  const stdoutHash = createHash("sha256");
  const stderrHash = createHash("sha256");
  return {
    stdout(chunk) {
      stdoutHash.update(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
    },
    stderr(chunk) {
      stderrHash.update(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
    },
    digest() {
      return createHash("sha256")
        .update("stdout\0", "utf8")
        .update(stdoutHash.digest())
        .update("stderr\0", "utf8")
        .update(stderrHash.digest())
        .digest("hex")
        .toUpperCase();
    },
  };
}

// Corepack's Windows npm shim is a .cmd file. Run its CLI with the current Node
// executable so repository and artifact paths reach the command as literal arguments.
function windowsCorepack(env) {
  const pathKey = Object.keys(env).find(key => key.toUpperCase() === "PATH");
  const searchPath = pathKey === undefined ? "" : env[pathKey];
  for (const entry of searchPath.split(delimiter)) {
    const directory = entry.replace(/^"(.*)"$/u, "$1");
    if (!isAbsolute(directory)) continue;
    const executable = resolve(directory, "corepack.exe");
    if (statSync(executable, { throwIfNoEntry: false })?.isFile()) return [executable];
    const moduleRoot = basename(directory).toLowerCase() === ".bin"
      ? resolve(directory, "..")
      : resolve(directory, "node_modules");
    const script = resolve(moduleRoot, "corepack/dist/corepack.js");
    if (statSync(script, { throwIfNoEntry: false })?.isFile()) return [process.execPath, script];
  }
  throw new Error("Corepack executable or JavaScript CLI not found on PATH.");
}

export function spawnLocalReleaseStage(stage) {
  const [executable, ...prefix] = process.platform === "win32" && stage.command === "corepack"
    ? windowsCorepack(stage.env)
    : [stage.command];
  return spawn(executable, [...prefix, ...stage.args], {
    cwd: stage.cwd,
    env: stage.env,
    shell: false,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function runChildProcess(stage, output) {
  return new Promise((resolveResult) => {
    let settled = false;
    const finish = (exitCode) => {
      if (settled) return;
      settled = true;
      resolveResult({ exitCode });
    };

    let child;
    try {
      child = spawnLocalReleaseStage(stage);
    } catch {
      finish(127);
      return;
    }

    child.stdout.on("data", (chunk) => output.stdout(chunk));
    child.stderr.on("data", (chunk) => output.stderr(chunk));
    child.once("error", () => finish(127));
    child.once("close", (code) => finish(Number.isInteger(code) ? code : 1));
  });
}

function publicStage(stage, exitCode, outputSha256) {
  return {
    id: stage.id,
    command: stage.command,
    args: stage.args,
    cwd: stage.cwdRelative,
    exitCode,
    outputSha256,
    status: exitCode === 0 ? "PASS" : "FAIL",
  };
}

export async function runLocalReleasePreflight({
  repositoryRoot: root = repositoryRoot,
  artifactRoot,
  baseEnvironment = process.env,
  miniTrial,
  lstatPath = lstat,
  findEnvironmentFiles = findEnvironmentFileNames,
  runner = runChildProcess,
  createDirectory = mkdir,
  writeFileContents = writeFile,
} = {}) {
  if (typeof artifactRoot !== "string" || artifactRoot.trim() === "") {
    return { status: "BLOCKED_ARTIFACT_ROOT_REQUIRED", stages: [] };
  }
  const absoluteRoot = resolve(root);
  const artifact = normalizeArtifactRoot(absoluteRoot, artifactRoot);
  const stages = appCommandMatrix({
    root: absoluteRoot,
    artifact,
    baseEnvironment,
    miniTrial,
  });
  if (await traversesSymlink(resolve(absoluteRoot, "artifacts"), artifact.absoluteRoot, lstatPath)) {
    return {
      status: "BLOCKED_ARTIFACT_SYMLINK",
      stages: [],
    };
  }
  if (
    miniTrial &&
    await traversesSymlink(absoluteRoot, resolve(absoluteRoot, "apps/mini-program-taro"), lstatPath)
  ) {
    return { status: "BLOCKED_MINI_PROJECT_SYMLINK", stages: [] };
  }
  const existingPaths = [];
  const nextBuilds = [
    ["user-web", "apps/user-web"],
    ["admin-web", "apps/admin-web"],
  ];
  const outputPaths = [
    [artifact.absoluteRoot, artifact.relativeToRepository],
    [
      resolve(absoluteRoot, "apps/api", `.dist-${artifact.runId}-api`),
      `apps/api/.dist-${artifact.runId}-api`,
    ],
    ...nextBuilds.map(([id, directory]) => {
      const stage = stages.find(({ id: stageId }) => stageId === `${id}:build`);
      const nextOutput = stage?.env.TASK20_NEXT_DIST_DIR;
      return [resolve(absoluteRoot, directory, nextOutput), `${directory}/${nextOutput}`];
    }),
    [
      resolve(absoluteRoot, "apps/mini-program-taro", `dist-${artifact.runId}-mini`),
      `apps/mini-program-taro/dist-${artifact.runId}-mini`,
    ],
  ];
  for (const [absolutePath, relativePath] of outputPaths) {
    try {
      await lstatPath(absolutePath);
      existingPaths.push(relativePath.replaceAll("\\", "/"));
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  if (existingPaths.length > 0) {
    return {
      status: "BLOCKED_ARTIFACT_EXISTS",
      existingPaths,
      stages: [],
    };
  }
  const environmentFileNames = await findEnvironmentFiles(absoluteRoot);
  if (environmentFileNames.length > 0) {
    return {
      status: "BLOCKED_ENV_FILES",
      environmentFileNames,
      stages: [],
    };
  }

  try {
    await prepareIsolatedNextTypeScriptConfigs({
      repositoryRoot: absoluteRoot,
      artifact,
      createDirectory,
      writeFileContents,
    });
  } catch {
    return {
      status: "BLOCKED_NEXT_CONFIG_PREPARATION",
      stages: [],
    };
  }

  const completed = [];
  for (const stage of stages) {
    const output = createOutputHandlers();
    let result;
    try {
      result = await runner(stage, output);
    } catch {
      result = { exitCode: 127 };
    }
    const exitCode = Number.isInteger(result?.exitCode) ? result.exitCode : 1;
    completed.push(publicStage(stage, exitCode, output.digest()));
    if (exitCode !== 0) {
      return {
        status: "FAIL",
        failedStage: stage.id,
        stages: completed,
      };
    }
  }

  return { status: "PASS", stages: completed };
}

export function createLocalReleasePlan(
  artifactRoot = defaultArtifactRoot,
  { miniTrial, baseEnvironment } = {},
) {
  const stages = createLocalReleaseCommandMatrix({ artifactRoot, miniTrial, baseEnvironment });
  return {
    mode: "plan-only",
    status: "PLAN_ONLY",
    executionReadiness: "NOT_EVALUATED",
    artifactRoot,
    stages: stages.map(({ id, command: executable, args, cwdRelative }) => ({
      id,
      command: [executable, ...args],
      cwd: cwdRelative,
    })),
  };
}

export function parseLocalReleasePreflightArgs(argv) {
  const [action = "--plan", ...flags] = argv;
  const allowedFlags = flags.every(flag => flag === "--mini-trial" || flag.startsWith("--artifact-root="));
  const roots = flags.filter((argument) => argument.startsWith("--artifact-root="));
  const miniTrial = flags.includes("--mini-trial");
  if (
    !["--plan", "--run-local"].includes(action) ||
    !allowedFlags || roots.length > 1 || new Set(flags).size !== flags.length
  ) {
    return { mode: "invalid", status: "INVALID_ARGUMENTS" };
  }
  const [artifactRootArgument] = roots;
  const artifactRoot =
    artifactRootArgument?.slice("--artifact-root=".length) ?? defaultArtifactRoot;
  if (action === "--run-local" && (!artifactRootArgument || artifactRoot.trim() === "")) {
    return { mode: "blocked", status: "BLOCKED_ARTIFACT_ROOT_REQUIRED" };
  }
  return {
    mode: action === "--plan" ? "plan" : "run-local",
    artifactRoot,
    ...(miniTrial ? { miniTrial: true } : {}),
  };
}

async function main(argv) {
  const invocation = parseLocalReleasePreflightArgs(argv);
  const usage =
    "node scripts/local-release-preflight.mjs (--plan | --run-local) --artifact-root=artifacts/<run-id>/run [--mini-trial]";
  if (invocation.mode === "blocked") {
    process.stdout.write(
      `${JSON.stringify({ mode: "run-local", status: invocation.status, usage, stages: [] }, null, 2)}\n`,
    );
    return 2;
  }

  if (invocation.mode === "invalid") {
    process.stdout.write(`${JSON.stringify({ status: "INVALID_ARGUMENTS", usage })}\n`);
    return 2;
  }

  let report;
  try {
    if (invocation.mode === "plan") {
      const plan = createLocalReleasePlan(invocation.artifactRoot, invocation);
      process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
      return 0;
    }
    report = await runLocalReleasePreflight(invocation);
  } catch {
    process.stdout.write(`${JSON.stringify({ status: "BLOCKED_INVALID_PREFLIGHT_INPUT" })}\n`);
    return 2;
  }
  process.stdout.write(`${JSON.stringify({ mode: "run-local", ...report }, null, 2)}\n`);
  return report.status === "PASS" ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2))
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch(() => {
      process.stdout.write(`${JSON.stringify({ status: "FAIL_PREFLIGHT" })}\n`);
      process.exitCode = 1;
    });
}
