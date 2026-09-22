import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// @ts-expect-error TS6142: this package intentionally keeps JSX-free .tsx page boundaries.
import { StaffGuidesPage } from "./staff-guides.js";
// @ts-expect-error TS6142: this package intentionally keeps JSX-free .tsx page boundaries.
import { TeachingResourcesPage } from "./resources.js";

test("staff guides project only bounded synthetic list and fail closed to empty results", () => {
  const view = StaffGuidesPage({ query: "", limit: 1 });

  assert.equal(view.state, "LIST");
  assert.equal(view.items.length, 1);
  assert.equal(view.items[0]?.status, "PUBLISHED");
  assert.match(view.html, /新员工指南/);
  assert.match(view.html, /打开指南/);
  assert.match(view.html, /class="internal-main"/);
  assert.match(view.html, /class="staff-content-grid"/);
  assert.deepEqual(StaffGuidesPage({ query: "不存在", limit: 20 }).items, []);
  assert.match(StaffGuidesPage({ query: "不存在", limit: 20 }).html, /暂无匹配指南/);
});

test("teaching resources project category and query filters without external activity", () => {
  const view = TeachingResourcesPage({ query: "阅读", category: "READING", limit: 20 });

  assert.equal(view.route, "/web/staff/resources");
  assert.equal(view.state, "LIST");
  assert.deepEqual(
    view.items.map((item) => item.id),
    ["resource-reading"],
  );
  assert.match(view.html, /打开详情/);
  assert.match(view.html, /class="internal-main"/);
  assert.match(view.html, /class="staff-content-grid"/);
  assert.doesNotMatch(view.html, /https?:\/\//i);
  assert.equal(
    TeachingResourcesPage({ query: "", category: "WORKSHEET", limit: 20 }).state,
    "EMPTY",
  );
});

test("staff content pages contain no provider, storage, or network implementation", async () => {
  const source = (
    await Promise.all([
      readFile("apps/user-web/src/pages/staff-guides.tsx", "utf8"),
      readFile("apps/user-web/src/pages/resources.tsx", "utf8"),
    ])
  ).join("\n");

  assert.doesNotMatch(source, /fetch|XMLHttpRequest|localStorage|https?:\/\//i);
});
