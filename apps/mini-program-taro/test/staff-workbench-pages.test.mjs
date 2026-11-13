import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { URL } from "node:url";

const read = async (path) => readFile(new URL(path, import.meta.url), "utf8");

test("staff workbench reloads its scoped review queue when shown again", async () => {
  const page = await read("../src/pages/staff/workbench/index.tsx");

  assert.match(page, /useDidShow/u);
  assert.match(page, /hasShown\.current && initialLoadDone\.current/u);
  assert.match(page, /void refreshQueue\(\)/u);
  assert.match(page, /loadStaffBindingQueue/u);
  assert.match(page, /hasRoleAccess\(inviteSession\.snapshot, "STAFF"\)/u);
  assert.match(page, /staff-refresh-button/u);
  assert.match(page, /queueRefreshInFlight\.current/u);
  assert.match(page, /pages\/staff\/daily-report\/index/u);
  assert.match(page, /工作日报/u);
  assert.match(page, /pages\/staff\/monthly\/index/u);
  assert.match(page, /班级月度总结/u);
  assert.match(page, /canReadMonthlyFeedback/u);
});
