import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("admin-web exposes a runnable static Task 06 entrypoint", () => {
  const packageJson = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
  assert.equal(packageJson.name, "@student-care/admin-web");
  assert.equal(existsSync(path.join(root, "index.html")), true);
  assert.equal(existsSync(path.join(root, "dist/main.js")), true);

  const html = readFileSync(path.join(root, "index.html"), "utf8");
  const entry = readFileSync(path.join(root, "dist/main.js"), "utf8");
  const page = readFileSync(path.join(root, "dist/pages/home-content.js"), "utf8");
  assert.match(html, /dist\/main\.js/);
  assert.match(entry, /HomeContentPage/);
  assert.match(entry, /\/admin\/staff-guides/);
  assert.match(entry, /新成员指南/);
  assert.match(entry, /模拟数据/);
  assert.match(page, /保存草稿/);
  assert.match(page, /发布/);
});

test("admin-web source entry renders the administrator audit route", () => {
  const entry = readFileSync(path.join(root, "src/main.ts"), "utf8");

  assert.match(entry, /import\s+\{\s*AuditLogsPage/);
  assert.match(entry, /from "\.\/pages\/audit-logs\.js"/);
  assert.match(entry, /window\.location\.pathname === "\/admin\/audit-logs"/);
  assert.match(entry, /renderAuditLogs\(\)/);
  assert.match(entry, /syntheticAuditEvents/);
});
