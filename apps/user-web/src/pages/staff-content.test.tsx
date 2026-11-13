import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// @ts-expect-error TS6142: this package intentionally keeps JSX-free .tsx page boundaries.
import { StaffGuidesPage } from "./staff-guides.js";
// @ts-expect-error TS6142: this package intentionally keeps JSX-free .tsx page boundaries.
import { TeachingResourcesPage } from "./resources.js";
// @ts-expect-error TS6142: this package intentionally keeps JSX-free .tsx page boundaries.
import { PartnerLinkPage } from "./partner-link.js";

test("staff guides project only bounded synthetic list and fail closed to empty results", () => {
  const view = StaffGuidesPage({ query: "", limit: 1 });

  assert.equal(view.state, "LIST");
  assert.equal(view.items.length, 1);
  assert.equal(view.items[0]?.status, "PUBLISHED");
  assert.match(view.html, /新员工指南/);
  assert.match(view.html, /打开指南/);
  assert.match(view.html, /class="internal-main"/);
  assert.match(view.html, /class="staff-content-grid"/);
  assert.match(view.html, /data-action="open-guide"/);
  assert.match(view.html, /data-staff-action-status/);
  assert.match(view.html, /role="status"/);
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
  assert.match(view.html, /data-action="open-resource"/);
  assert.match(view.html, /data-staff-action-status/);
  assert.match(view.html, /role="status"/);
  assert.doesNotMatch(view.html, /https?:\/\//i);
  assert.equal(
    TeachingResourcesPage({ query: "", category: "WORKSHEET", limit: 20 }).state,
    "EMPTY",
  );
});

test("staff content pages contain no provider, storage, or network implementation", async () => {
  const source = (
    await Promise.all([
      readFile(new URL("../../src/pages/staff-guides.tsx", import.meta.url), "utf8"),
      readFile(new URL("../../src/pages/resources.tsx", import.meta.url), "utf8"),
      readFile(new URL("../../src/pages/partner-link.tsx", import.meta.url), "utf8"),
    ])
  ).join("\n");

  assert.doesNotMatch(source, /fetch|XMLHttpRequest|localStorage|https?:\/\//i);
});

test("partner page is unavailable without an external destination", () => {
  const view = PartnerLinkPage({ state: "UNAVAILABLE" });

  assert.equal(view.state, "UNAVAILABLE");
  assert.match(view.html, /伙伴云入口/);
  assert.match(view.html, /暂未开放|入口不可用/);
  assert.doesNotMatch(view.html, /<a\b|href=|https?:\/\//iu);
  assert.doesNotMatch(view.html, /window\.open|fetch|localStorage|sessionStorage/iu);
  assert.deepEqual(view.externalRequests, []);
  assert.deepEqual(view.externalResources, []);
});
