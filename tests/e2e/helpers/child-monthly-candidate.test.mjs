import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createLocalReleaseCommandMatrix } from "../../../scripts/local-release-preflight.mjs";

const repository = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const task = "monthly-browser-path-check";
const artifact = join(repository, "artifacts", task, "run");
const stage = createLocalReleaseCommandMatrix({
  repositoryRoot: repository, artifactRoot: artifact, baseEnvironment: process.env,
}).find(({ id }) => id === "user-web:e2e");

function probe(env, body = "") {
  const source = `import * as monthly from "./tests/e2e/helpers/child-monthly-web-browser.mjs";\n${body}`;
  return spawnSync(process.execPath, ["--input-type=module", "--eval", source], {
    cwd: repository, env, encoding: "utf8", windowsHide: true,
  });
}

test("monthly browser uses the current matrix API and the candidate browser contract", () => {
  const run = probe(stage.env, `
    import assert from "node:assert/strict";
    console.log(JSON.stringify([monthly.artifactRoot, monthly.apiRuntimeRoot]));
    await assert.rejects(monthly.startLegacyBrowser(null, { skipLegacyApi: true, fixedNow: "no" }),
      /独立邀请服务测试不能同时启动旧管理服务或固定时钟服务/);
  `);
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(JSON.parse(run.stdout), [artifact, join(repository, "apps/api", `.dist-${task}-api`, "src")]);
});

test("monthly browser rejects an API override or a different candidate web build", () => {
  for (const [override, reason] of [
    [{ TASK20_API_RUNTIME: join(repository, "apps/api/dist/src") }, /API_RUNTIME_OVERRIDE_FORBIDDEN/],
    [{ TASK20_NEXT_DIST_DIR: ".next" }, /CANDIDATE_USER_DIST_MISMATCH/],
  ]) {
    const run = probe({ ...stage.env, ...override });
    assert.equal(run.status, 1);
    assert.match(run.stderr, reason);
  }
});

test("standalone monthly browser keeps its API inside the task workspace", () => {
  const standalone = { ...stage.env };
  delete standalone.TASK20_BROWSER_API_MODE;
  const run = probe(standalone, "console.log(JSON.stringify(monthly.apiRuntimeRoot));");
  assert.equal(run.status, 0, run.stderr);
  assert.equal(JSON.parse(run.stdout), join(artifact, "api-dist/runtime/src"));
  const escaped = probe({ ...standalone, TASK20_API_RUNTIME: join(repository, "apps/api/dist/src") });
  assert.equal(escaped.status, 1);
  assert.match(escaped.stderr, /API_RUNTIME_OUTSIDE_TASK/);
});
