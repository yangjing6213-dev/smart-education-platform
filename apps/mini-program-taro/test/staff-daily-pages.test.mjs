import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { URL } from "node:url";

const read = async (path) => {
  try {
    return await readFile(new URL(path, import.meta.url), "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return "";
    throw error;
  }
};

test("Taro registers the staff daily-report page and provides a direct workbench entry", async () => {
  const [appConfig, workbench] = await Promise.all([
    read("../src/app.config.ts"),
    read("../src/pages/staff/workbench/index.tsx"),
  ]);
  assert.match(appConfig, /pages\/staff\/daily-report\/index/u);
  assert.match(workbench, /pages\/staff\/daily-report\/index/u);
  assert.match(workbench, /工作日报/u);
});

test("staff daily page offers fixed-choice drafts, submission, and returned-report resubmission", async () => {
  const [page, config] = await Promise.all([
    read("../src/pages/staff/daily-report/index.tsx"),
    read("../src/pages/staff/daily-report/index.config.ts"),
  ]);
  assert.match(config, /工作日报/u);
  assert.match(page, /Picker/u);
  assert.match(page, /保存草稿/u);
  assert.match(page, /提交审核/u);
  assert.match(page, /提交修改/u);
  assert.match(page, /hasRoleAccess\(session, "STAFF"\)/u);
  assert.match(page, /loadStaffDailyReports/u);
  assert.match(page, /editStaffDailyDraft/u);
  assert.match(page, /resubmitStaffDailyDraft/u);
  assert.doesNotMatch(page, /student_id|student_display_ref|tenant_id|campus_id/u);
});
