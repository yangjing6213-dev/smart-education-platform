import { existsSync, realpathSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const repositoryRoot = resolve(dirname(scriptPath), "..");
const miniSourceRoot = resolve(repositoryRoot, "apps", "mini-program", "src");
const protectedTestPath = resolve(miniSourceRoot, "pages", "staff.test.ts");

function toPosixPath(value) {
  return value.split(sep).join("/");
}

function isWithin(parent, child) {
  const pathFromParent = relative(parent, child);
  return (
    pathFromParent === "" ||
    (!pathFromParent.startsWith(`..${sep}`) &&
      pathFromParent !== ".." &&
      !isAbsolute(pathFromParent))
  );
}

function normalizeInputPath(input) {
  if (
    typeof input !== "string" ||
    input.length === 0 ||
    input.trim() !== input
  ) {
    throw new Error("每个测试路径都必须是非空的明确路径。");
  }
  if (
    ["*", "?", "[", "]", "{", "}"].some((character) =>
      input.includes(character),
    )
  ) {
    throw new Error("不接受通配符；请明确列出每个测试文件。");
  }

  const normalizedInput = input.replace(/[\\/]+/gu, sep);
  if (normalizedInput.split(sep).includes("..")) {
    throw new Error("不接受包含上级目录的测试路径。");
  }

  const absolutePath = isAbsolute(normalizedInput)
    ? resolve(normalizedInput)
    : resolve(repositoryRoot, normalizedInput);

  if (absolutePath.toLowerCase() === protectedTestPath.toLowerCase()) {
    throw new Error("拒绝运行受保护的 staff.test.ts。");
  }
  if (!isWithin(miniSourceRoot, absolutePath)) {
    throw new Error("测试路径必须位于 apps/mini-program/src/ 下。");
  }
  if (!absolutePath.endsWith(".test.ts")) {
    throw new Error("只接受明确的小程序 *.test.ts 文件。");
  }
  if (!existsSync(absolutePath)) {
    throw new Error(
      `测试文件不存在：${toPosixPath(relative(repositoryRoot, absolutePath))}`,
    );
  }
  if (!statSync(absolutePath).isFile()) {
    throw new Error("测试路径必须指向文件。");
  }

  const realPath = realpathSync(absolutePath);
  if (realPath.toLowerCase() === protectedTestPath.toLowerCase()) {
    throw new Error("拒绝运行受保护的 staff.test.ts。");
  }
  if (!isWithin(miniSourceRoot, realPath)) {
    throw new Error("测试文件实际位置超出小程序源码目录。");
  }

  return {
    absolutePath: realPath,
    displayPath: toPosixPath(relative(repositoryRoot, realPath)),
  };
}

export function validateMiniTestPaths(inputs) {
  if (!Array.isArray(inputs) || inputs.length === 0) {
    throw new Error("请明确列出至少一个小程序测试文件；不会自动扫描测试目录。");
  }

  const selected = inputs.map(normalizeInputPath);
  const uniquePaths = new Set(
    selected.map(({ absolutePath }) => absolutePath.toLowerCase()),
  );
  if (uniquePaths.size !== selected.length) {
    throw new Error("测试清单包含重复路径。");
  }

  return selected;
}

function main(args) {
  const dryRun = args[0] === "--dry-run";
  const inputs = dryRun ? args.slice(1) : args;

  let selected;
  try {
    selected = validateMiniTestPaths(inputs);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 2;
    return;
  }

  if (dryRun) {
    process.stdout.write(
      `${selected.map(({ displayPath }) => displayPath).join("\n")}\n`,
    );
    return;
  }

  const testResult = spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      "--test",
      "--test-concurrency=1",
      ...selected.map(({ absolutePath }) => absolutePath),
    ],
    {
      cwd: repositoryRoot,
      env: {
        ...process.env,
        LOCAL_SYNTHETIC_CORE_ROOT:
          process.env.LOCAL_SYNTHETIC_CORE_ROOT ?? repositoryRoot,
      },
      stdio: "inherit",
    },
  );

  if (testResult.error) {
    process.stderr.write(`${testResult.error.message}\n`);
    process.exitCode = 1;
    return;
  }
  process.exitCode = testResult.status ?? 1;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main(process.argv.slice(2));
}
