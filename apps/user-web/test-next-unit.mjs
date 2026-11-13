/* global process, URL */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { build } from "../../node_modules/.pnpm/esbuild@0.28.2/node_modules/esbuild/lib/main.js";

const root = fileURLToPath(new URL("./", import.meta.url));
function run(args) {
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
run([
  resolve(root, "../../node_modules/typescript/bin/tsc"),
  "-p",
  "next-test.tsconfig.json",
  "--noEmit",
]);
const output = resolve(root, ".test-next-unit/public-institution.test.cjs");
await build({
  absWorkingDir: root,
  entryPoints: ["src/pages/visitor-public-institution.test.ts"],
  outfile: output,
  bundle: true,
  platform: "node",
  format: "cjs",
  packages: "external",
  jsx: "automatic",
  sourcemap: "inline",
});
run(["--test", output]);
