import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

function normalizeApiDistRoot(root, apiDistRoot) {
  if (typeof apiDistRoot !== "string" || apiDistRoot.trim() === "") {
    throw new Error("API_DIST_ROOT_INVALID");
  }
  const absoluteOutput = resolve(root, apiDistRoot);
  const relativeOutput = relative(root, absoluteOutput);
  if (
    relativeOutput === "" ||
    relativeOutput === ".." ||
    relativeOutput.startsWith(`..${sep}`) ||
    isAbsolute(relativeOutput)
  ) {
    throw new Error("API_DIST_ROOT_INVALID");
  }
  return relativeOutput.split(sep).join("/");
}

export function createApiTestCommands({
  testScript,
  apiDistRoot,
  root = repositoryRoot,
} = {}) {
  if (typeof testScript !== "string" || testScript.trim() === "") {
    throw new Error("API_TEST_SCRIPT_REQUIRED");
  }
  const normalizedRoot = normalizeApiDistRoot(resolve(root), apiDistRoot);
  const segments = testScript
    .split(/\s*&&\s*/u)
    .map((segment) => segment.trim())
    .filter((segment) => /^node\s+--test(?:\s|$)/u.test(segment));

  if (segments.length === 0) throw new Error("API_TEST_COMMANDS_NOT_FOUND");
  let remappedCompiledPath = false;
  const commands = segments.map((segment) => {
    if (/[;|<>`]/u.test(segment) || /\$\(|\$\{/u.test(segment)) {
      throw new Error("API_TEST_COMMAND_UNSUPPORTED");
    }
    const tokens = segment.split(/\s+/u);
    if (tokens[0] !== "node" || tokens[1] !== "--test") {
      throw new Error("API_TEST_COMMAND_UNSUPPORTED");
    }
    const args = tokens.slice(1).map((token) => {
      if (!token.startsWith("apps/api/dist/")) return token;
      remappedCompiledPath = true;
      return `${normalizedRoot}/${token.slice("apps/api/dist/".length)}`;
    });
    return { command: process.execPath, args };
  });
  if (!remappedCompiledPath) throw new Error("API_TEST_COMPILED_PATH_MISSING");
  return commands;
}

function readApiTestScript(root) {
  const packagePath = resolve(root, "apps/api/package.json");
  const manifest = JSON.parse(readFileSync(packagePath, "utf8"));
  return manifest.scripts?.test;
}

function main(argv) {
  const outputArgument = argv.find((argument) => argument.startsWith("--api-dist-root="));
  if (
    !outputArgument ||
    argv.length !== 1 ||
    outputArgument.slice("--api-dist-root=".length).trim() === ""
  ) {
    process.stderr.write("API_DIST_ROOT_REQUIRED\n");
    return 2;
  }

  let commands;
  try {
    commands = createApiTestCommands({
      testScript: readApiTestScript(repositoryRoot),
      apiDistRoot: outputArgument.slice("--api-dist-root=".length),
      root: repositoryRoot,
    });
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    return 2;
  }

  for (const command of commands) {
    const result = spawnSync(command.command, command.args, {
      cwd: repositoryRoot,
      stdio: "inherit",
      windowsHide: true,
    });
    if (result.error) {
      process.stderr.write(`${result.error.code ?? "API_TEST_SPAWN_FAILED"}\n`);
      return 127;
    }
    if (result.status !== 0) return Number.isInteger(result.status) ? result.status : 1;
  }
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
