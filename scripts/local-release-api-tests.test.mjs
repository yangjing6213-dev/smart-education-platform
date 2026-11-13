import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const apiTests = await import("./local-release-api-tests.mjs").catch(() => ({}));

function nodeTestSegments(script) {
  return script
    .split(/\s*&&\s*/u)
    .map((segment) => segment.trim())
    .filter((segment) => /^node\s+--test(?:\s|$)/u.test(segment));
}

test("remaps only compiled API test paths in the actual curated package test script", async () => {
  assert.equal(typeof apiTests.createApiTestCommands, "function");
  const manifest = JSON.parse(
    await readFile(join(repositoryRoot, "apps/api/package.json"), "utf8"),
  );
  const outputRoot = "apps/api/.dist-rc-a1461-api";
  const originals = nodeTestSegments(manifest.scripts.test);
  const commands = apiTests.createApiTestCommands({
    testScript: manifest.scripts.test,
    apiDistRoot: outputRoot,
  });

  assert.equal(originals.length, 2);
  assert.equal(commands.length, originals.length);
  for (const [index, segment] of originals.entries()) {
    const originalArgs = segment.split(/\s+/u).slice(1);
    const expectedArgs = originalArgs.map((arg) =>
      arg.startsWith("apps/api/dist/")
        ? `${outputRoot}/${arg.slice("apps/api/dist/".length)}`
        : arg,
    );
    assert.equal(commands[index].command, process.execPath);
    assert.deepEqual(commands[index].args, expectedArgs);
  }
  assert.ok(commands[0].args.some((arg) => arg.startsWith(`${outputRoot}/`)));
  assert.ok(commands[1].args.includes("apps/api/src/modules/audit/audit.test.ts"));
});

test("rejects an API output root that escapes the repository", () => {
  assert.equal(typeof apiTests.createApiTestCommands, "function");
  assert.throws(
    () =>
      apiTests.createApiTestCommands({
        testScript: "node --test apps/api/dist/test/example.test.js",
        apiDistRoot: "../../outside/api-dist",
      }),
    /API_DIST_ROOT_INVALID/u,
  );
});

test("rejects package scripts without a supported curated node test command", () => {
  assert.equal(typeof apiTests.createApiTestCommands, "function");
  assert.throws(
    () =>
      apiTests.createApiTestCommands({
        testScript: "node scripts/run-everything.mjs",
        apiDistRoot: "artifacts/rc-a1461/run/api-dist",
      }),
    /API_TEST_COMMANDS_NOT_FOUND/u,
  );
});
