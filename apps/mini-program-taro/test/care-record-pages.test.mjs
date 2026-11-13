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

test("Taro registers parent and staff growth-record pages", async () => {
  const appConfig = await read("../src/app.config.ts");
  assert.match(appConfig, /pages\/parent\/care-record\/index/u);
  assert.match(appConfig, /pages\/staff\/care-record\/index/u);
});

test("parent home and staff workbench link directly to growth records", async () => {
  const [parentHome, staffWorkbench] = await Promise.all([
    read("../src/pages/parent/home/index.tsx"),
    read("../src/pages/staff/workbench/index.tsx"),
  ]);
  assert.match(parentHome, /pages\/parent\/care-record\/index/u);
  assert.match(parentHome, /成长记录/u);
  assert.match(staffWorkbench, /pages\/staff\/care-record\/index/u);
  assert.match(staffWorkbench, /成长记录/u);
  const staffPage = await read("../src/pages/staff/care-record/index.tsx");
  assert.match(staffPage, /record\.actions\.includes\("withdraw"\)/u);
  assert.match(staffPage, /record\.actions\.includes\("revoke-publication"\)/u);
  assert.match(staffPage, /Taro\.showModal/u);
});

test("growth-record pages expose the gated employee flow and parent receipt flow", async () => {
  const [staffPage, parentPage] = await Promise.all([
    read("../src/pages/staff/care-record/index.tsx"),
    read("../src/pages/parent/care-record/index.tsx"),
  ]);
  assert.match(staffPage, /提交审核/u);
  assert.match(staffPage, /审核通过/u);
  assert.match(staffPage, /单独发布/u);
  assert.match(parentPage, /确认知悉/u);
  assert.match(parentPage, /先打开/u);
});
