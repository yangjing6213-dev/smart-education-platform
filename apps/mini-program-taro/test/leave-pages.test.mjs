import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = async (path) => {
  try {
    return await readFile(new URL(path, import.meta.url), "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return "";
    throw error;
  }
};

test("Taro registers both parent and staff leave pages and role homes link to them", async () => {
  const [appConfig, parentHome, staffHome] = await Promise.all([
    read("../src/app.config.ts"),
    read("../src/pages/parent/home/index.tsx"),
    read("../src/pages/staff/workbench/index.tsx"),
  ]);

  assert.match(appConfig, /pages\/parent\/leave\/index/u);
  assert.match(appConfig, /pages\/staff\/leave\/index/u);
  assert.match(parentHome, /pages\/parent\/leave\/index/u);
  assert.match(parentHome, /请假申请/u);
  assert.match(staffHome, /pages\/staff\/leave\/index/u);
  assert.match(staffHome, /请假审核/u);
});

test("parent leave page reads approved children and uses native fixed-choice pickers", async () => {
  const page = await read("../src/pages/parent/leave/index.tsx");

  assert.match(page, /hasRoleAccess\(session, "PARENT"\)/u);
  assert.match(page, /loadParentLearningSummary/u);
  assert.match(page, /approvedStudents/u);
  assert.match(page, /loadParentLeaveRequests/u);
  assert.match(page, /mode="selector"/u);
  assert.match(page, /mode="date"/u);
  assert.match(page, /FAMILY_ARRANGEMENT/u);
  assert.match(page, /TEMPORARY_MATTER/u);
  assert.doesNotMatch(page, /<Input\b|<Textarea\b/u);
});

test("parent page renders only server-approved status actions and requires confirmation for withdrawal", async () => {
  const page = await read("../src/pages/parent/leave/index.tsx");

  assert.match(page, /request\.actions\.includes\("withdraw"\)/u);
  assert.match(page, /request\.actions\.includes\("resubmit"\)/u);
  assert.match(page, /request\.actions\.includes\("acknowledge"\)/u);
  assert.match(page, /Taro\.showModal/u);
  assert.match(page, /busyId|inFlight/u);
});

test("staff page rechecks staff role, shows server-returned actions, and confirms before review", async () => {
  const page = await read("../src/pages/staff/leave/index.tsx");

  assert.match(page, /hasRoleAccess\(session, "STAFF"\)/u);
  assert.match(page, /loadStaffLeaveRequests/u);
  assert.match(page, /request\.actions\.includes\("confirm"\)/u);
  assert.match(page, /request\.actions\.includes\("return"\)/u);
  assert.match(page, /Taro\.showModal/u);
  assert.match(page, /busyId|inFlight/u);
});

test("parent and staff pages show an error if invited-session restoration fails", async () => {
  const pages = await Promise.all([
    read("../src/pages/parent/leave/index.tsx"),
    read("../src/pages/staff/leave/index.tsx"),
  ]);

  for (const page of pages) {
    const initialLoad = page.match(/async function loadInitial\(\) \{([\s\S]*?)\n  \}/u)?.[1] ?? "";
    assert.match(initialLoad, /try\s*\{[\s\S]*inviteSession\.restore\(\)[\s\S]*catch\s*\(error\)/u);
    assert.match(initialLoad, /setMessage\(errorMessage\(error\)\)/u);
    assert.match(initialLoad, /setStatus\("ERROR"\)/u);
  }
});

test("staff page labels updatedAt as the most recent update", async () => {
  const page = await read("../src/pages/staff/leave/index.tsx");

  assert.match(page, /最近更新：\{new Date\(request\.updatedAt\)/u);
  assert.doesNotMatch(page, /提交时间：\{new Date\(request\.updatedAt\)/u);
});
