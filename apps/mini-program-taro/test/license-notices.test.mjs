import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const copyModule = await import("../scripts/copy-license-notices.mjs").catch(() => null);

test("the Mini build restores the two page license notices after Taro finishes", async () => {
  const packageJson = JSON.parse(await readFile(resolve(appRoot, "package.json"), "utf8"));
  assert.equal(
    packageJson.scripts["build:weapp"],
    "taro build --type weapp && node ./scripts/copy-license-notices.mjs",
  );
  assert.ok(
    copyModule?.getLicenseNoticeMappings,
    "post-build notice copier must expose its fixed mappings",
  );
  assert.deepEqual(copyModule.getLicenseNoticeMappings(), [
    {
      source: "licenses/pages/auth/login/index.js.LICENSE.txt",
      target: "pages/auth/login/index.js.LICENSE.txt",
    },
    {
      source: "licenses/pages/visitor/home/index.js.LICENSE.txt",
      target: "pages/visitor/home/index.js.LICENSE.txt",
    },
  ]);
});

test("the tracked page license inputs contain the original third-party notice", async () => {
  for (const path of [
    "licenses/pages/auth/login/index.js.LICENSE.txt",
    "licenses/pages/visitor/home/index.js.LICENSE.txt",
  ]) {
    const notice = await readFile(resolve(appRoot, path), "utf8");
    assert.match(notice, /regenerator-runtime/u);
    assert.match(notice, /license \(MIT\)/u);
  }
});
