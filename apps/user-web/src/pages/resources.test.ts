import assert from "node:assert/strict";
import test from "node:test";
import {
  renderResourceLibraryPage,
  type ResourceLibrarySnapshot,
} from "../local-synthetic/resource-library.js";

const active: ResourceLibrarySnapshot = {
  status: "READY",
  profile: "teacher-east",
  actions: ["resource:read"],
  resources: [
    {
      id: "00000000-0000-4000-8000-000000000385",
      version: 2,
      title: "示例数学活动卡",
      summary: "用纸片和纸杯组织一次小组探索。",
      content: "先观察纸张的形状，再尝试折出不同结构。",
      category: "LESSON",
      grade: "三年级",
      subject: "数学",
      tags: ["小组活动", "课堂探索"],
      scope: "CAMPUS",
      sourceLabel: "校内教研组（合成示例）",
      ownerLabel: "示例东校区负责人",
      expiresOn: "2026-12-31",
      favorite: true,
    },
  ],
  favorites: [],
  recent: [],
  selected: null,
  filters: { query: "", grade: "", subject: "", tag: "" },
  message: "资料已更新。",
};

test("resource page exposes searchable filters, scoped list metadata, favorites and recent entry points", () => {
  const html = renderResourceLibraryPage(active);
  assert.match(html, /data-resource-search/u);
  assert.match(html, /name="grade"/u);
  assert.match(html, /name="subject"/u);
  assert.match(html, /name="tag"/u);
  assert.match(html, /示例数学活动卡/u);
  assert.match(html, /三年级/u);
  assert.match(html, /校内教研组（合成示例）/u);
  assert.match(html, /data-resource-action="favorite"/u);
  assert.match(html, /data-resource-collection="recent"/u);
  assert.match(html, /data-resource-action="open"/u);
});

test("resource detail shows the current version and safe content with return and use actions", () => {
  const html = renderResourceLibraryPage({
    ...active,
    selected: active.resources[0] ?? null,
  });
  assert.match(html, /data-resource-detail/u);
  assert.match(html, /第 2 版/u);
  assert.match(html, /data-resource-action="return"/u);
  assert.match(html, /data-resource-action="use"/u);
  assert.match(html, /先观察纸张/u);
});

test("resource page escapes service content and denies a disconnected projection", () => {
  const unsafe = {
    ...active.resources[0]!,
    title: '<img src=x onerror="bad()">',
    summary: "<script>bad()</script>",
  };
  const html = renderResourceLibraryPage({ ...active, resources: [unsafe] });
  assert.match(html, /&lt;img/u);
  assert.doesNotMatch(html, /<img|<script>/u);

  const disconnected = renderResourceLibraryPage({
    ...active,
    status: "DISCONNECTED",
    resources: [],
  });
  assert.doesNotMatch(disconnected, /示例数学活动卡/u);
  assert.match(disconnected, /重新连接/u);
});
