import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import test from "node:test";
import { fileURLToPath, URL } from "node:url";

import { validateMiniTestPaths } from "../../scripts/mini-safe-test-runner.mjs";

const repositoryRoot = resolve(
  fileURLToPath(new URL("../..", import.meta.url)),
);
const runnerPath = resolve(repositoryRoot, "scripts/mini-safe-test-runner.mjs");
const safeTest = "apps/mini-program/src/pages/visitor.test.ts";
const protectedTest = "apps/mini-program/src/pages/staff.test.ts";

test("the runner accepts explicit Mini tests and normalizes Windows separators", () => {
  assert.equal(existsSync(resolve(repositoryRoot, safeTest)), true);
  assert.deepEqual(validateMiniTestPaths([safeTest.replaceAll("/", "\\")]), [
    { absolutePath: resolve(repositoryRoot, safeTest), displayPath: safeTest },
  ]);
});

test("the runner accepts an absolute path inside the Mini test directory", () => {
  assert.deepEqual(validateMiniTestPaths([resolve(repositoryRoot, safeTest)]), [
    { absolutePath: resolve(repositoryRoot, safeTest), displayPath: safeTest },
  ]);
});

test("the runner rejects the protected test with either path separator", () => {
  for (const input of [protectedTest, protectedTest.replaceAll("/", "\\")]) {
    assert.throws(() => validateMiniTestPaths([input]), /受保护/u);
  }
});

test("the runner rejects paths outside Mini, globs, duplicate paths and empty input", () => {
  for (const input of [
    "apps/user-web/src/pages/visitor.test.ts",
    "apps/mini-program/src/pages/*.test.ts",
    "apps/mini-program/src/pages/../pages/visitor.test.ts",
  ]) {
    assert.throws(() => validateMiniTestPaths([input]));
  }

  assert.throws(
    () => validateMiniTestPaths([safeTest, safeTest.replaceAll("/", "\\")]),
    /重复/u,
  );
  assert.throws(() => validateMiniTestPaths([]), /明确列出/u);
});

test("a protected path is rejected by the CLI before a test process starts", () => {
  const result = spawnSync(process.execPath, [runnerPath, protectedTest], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });

  assert.equal(result.status, 2);
  assert.match(result.stderr, /受保护/u);
  assert.equal(result.stdout, "");
  assert.doesNotMatch(`${result.stdout}${result.stderr}`, /TAP version/u);
});

test("dry-run prints only the validated explicit Mini test path", () => {
  const result = spawnSync(
    process.execPath,
    [runnerPath, "--dry-run", safeTest],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
    },
  );

  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), safeTest);
  assert.equal(result.stderr, "");
});
