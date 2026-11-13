import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const load = `
  const { createRequire } = require("node:module");
  const req = createRequire(process.argv[1]);
  const loadConfig = req("next/dist/server/config.js").default;
  const { PHASE_PRODUCTION_BUILD } = req("next/constants");
  const { Bundler } = req("next/dist/lib/bundler.js");
  loadConfig(PHASE_PRODUCTION_BUILD, process.argv[2], {
    silent: true, bundler: Bundler.Webpack,
  }).then(config => console.log(JSON.stringify({
    tracingRoot: config.outputFileTracingRoot,
    pageExtensions: config.pageExtensions,
    agentRules: config.agentRules,
    output: config.output,
  }))).catch(error => { console.error(error); process.exitCode = 1; });
`;

function loadActualConfig(app, directory, cwd) {
  const packagePath = path.join(root, "apps", app, "package.json");
  createRequire(packagePath).resolve("next/dist/server/config.js");
  const env = { ...process.env, NEXT_TELEMETRY_DISABLED: "1" };
  delete env.NEXT_PRIVATE_OUTPUT_TRACE_ROOT;
  delete env.__NEXT_PRIVATE_STANDALONE_CONFIG;
  // Next caches by directory, not cwd or config content; each probe gets a fresh process.
  const result = spawnSync(process.execPath, ["-e", load, packagePath, directory], {
    cwd,
    env,
    encoding: "utf8",
    windowsHide: true,
    timeout: 30_000,
  });
  assert.equal(result.status, 0, result.error?.message ?? result.stderr);
  const output = result.stdout.trim().split(/\r?\n/u).at(-1);
  return JSON.parse(output);
}

for (const app of ["user-web", "admin-web"]) {
  test(`${app} discovers canonical API routes and preserves custom pages`, () => {
    const directory = path.join(root, "apps", app);
    const config = loadActualConfig(app, directory, directory);
    const req = createRequire(path.join(directory, "package.json"));
    const { createValidFileMatcher } = req("next/dist/server/lib/find-page-file.js");
    const matcher = createValidFileMatcher(config.pageExtensions, path.join(directory, "src/app"));
    assert.equal(matcher.isPageFile("legacy.test.ts"), false);
    assert.equal(matcher.isAppRouterRoute("route.js"), true);
    assert.equal(matcher.isAppRouterPage("helper.ts"), false);
    assert.equal(matcher.isAppRouterPage("page.page.ts"), true);
    assert.equal(matcher.isAppRouterPage("page.page.tsx"), true);
    const routes =
      app === "user-web"
        ? ["api-local/[...path]", "local/[...path]", "staff-local/[...path]"]
        : ["api/admin/[...path]"];
    for (const route of routes) {
      assert(existsSync(path.join(directory, "src/app", route, "route.js")));
      assert(existsSync(path.join(directory, "src/app", route, "handler.ts")));
      assert.equal(existsSync(path.join(directory, "src/app", route, "route.ts")), false);
      assert.equal(existsSync(path.join(directory, "src/app", route, "route.page.ts")), false);
    }
  });

  test(`${app} traces from its repository root`, () => {
    const directory = path.join(root, "apps", app);
    const config = loadActualConfig(app, directory, directory);
    assert.equal(path.resolve(config.tracingRoot), root);
    assert.deepEqual(config.pageExtensions, ["page.tsx", "page.ts", "js"]);
    assert.equal(config.agentRules, false);
    assert.equal(config.output, "standalone");
  });

  for (const cwdLocation of ["workspace", "elsewhere"]) {
    test(`${app} traces only its nested workspace when cwd is ${cwdLocation}`, (t) => {
      const tempRoot = realpathSync(tmpdir());
      const fixture = mkdtempSync(path.join(tempRoot, "next-tracing-"));
      t.after(() => {
        assert(realpathSync(fixture).startsWith(tempRoot + path.sep));
        rmSync(fixture, { recursive: true });
      });
      const workspace = path.join(fixture, "restored", "source");
      const directory = path.join(workspace, "apps", app);
      const elsewhere = path.join(fixture, "elsewhere");
      mkdirSync(directory, { recursive: true });
      mkdirSync(elsewhere);
      for (const base of [fixture, workspace]) {
        writeFileSync(path.join(base, "pnpm-workspace.yaml"), "packages:\n  - apps/*\n");
        writeFileSync(path.join(base, "package.json"), '{"private":true}\n');
      }
      for (const file of ["next.config.ts", "package.json"]) {
        copyFileSync(path.join(root, "apps", app, file), path.join(directory, file));
      }
      const config = loadActualConfig(
        app,
        directory,
        cwdLocation === "workspace" ? workspace : elsewhere,
      );
      assert.equal(path.resolve(config.tracingRoot), workspace);
      assert.deepEqual(config.pageExtensions, ["page.tsx", "page.ts", "js"]);
      assert.equal(config.agentRules, false);
      assert.equal(config.output, "standalone");
    });
  }
}
