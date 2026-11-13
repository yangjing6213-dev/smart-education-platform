import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { URL } from "node:url";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

test("the standard user-web development command selects Webpack", () => {
  assert.match(packageJson.scripts["next:dev"], /(?:^|\s)--webpack(?:\s|$)/);
});

test("the standard user-web production build selects Webpack", () => {
  assert.match(packageJson.scripts["next:build"], /(?:^|\s)--webpack(?:\s|$)/);
});
