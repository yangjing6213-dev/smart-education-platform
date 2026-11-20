import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { URL } from "node:url";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("account route is registered and accessible from both authenticated role homes", async () => {
  const [config, account, parent, staff] = await Promise.all([
    read("../src/app.config.ts"),
    read("../src/pages/account/index.tsx"),
    read("../src/pages/parent/home/index.tsx"),
    read("../src/pages/staff/workbench/index.tsx"),
  ]);
  assert.match(config, /"pages\/account\/index"/u);
  assert.match(parent, /pages\/account\/index/u);
  assert.match(staff, /pages\/account\/index/u);
  assert.match(account, /inviteSession\.getAuthenticated\("\/identity\/account"\)/u);
  assert.match(account, /inviteSession\.patchAuthenticated\("\/identity\/account\/profile"/u);
  assert.match(account, /inviteSession\.postAuthenticated\("\/identity\/account\/profile-change-requests"/u);
  assert.match(account, /inviteSession\.patchAuthenticated\("\/identity\/account\/username"/u);
  assert.match(account, /inviteSession\.postAuthenticated\("\/identity\/account\/password"/u);
  assert.match(account, /inviteSession\.postAuthenticated\("\/identity\/account\/logout-all"/u);
  assert.match(account, /退出当前设备/u);
  assert.match(account, /退出所有设备/u);
  assert.doesNotMatch(account, /actor_id\s*:\s*account\.actor_id|tenant_id\s*:\s*.*input/u);
});
