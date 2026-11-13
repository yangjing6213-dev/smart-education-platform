/* global URL */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const homeContent = await import(new URL("../dist/pages/home-content.js", import.meta.url).href);
const publicTeachers = await import(
  new URL("../dist/pages/public-teachers.js", import.meta.url).href
);
const meals = await import(new URL("../dist/pages/meals.js", import.meta.url).href);
const auditLogs = await import(new URL("../dist/pages/audit-logs.js", import.meta.url).href);

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

test("admin projections expose draft, published, unpublished, permission, and conflict states", () => {
  const homeState = {
    contentKey: "home-announcement",
    title: "模拟首页公告",
    summary: "仅用于测试的合成内容。",
    blocks: [],
    version: 1,
    status: "DRAFT",
    canPublish: false,
  };
  assert.equal(homeContent.HomeContentPage(homeState).publishAction, "需要发布权限");
  assert.equal(
    homeContent.HomeContentPage({ ...homeState, status: "PUBLISHED", canPublish: true })
      .unpublishAction,
    "下架",
  );
  assert.equal(
    homeContent.HomeContentPage({ ...homeState, status: "UNPUBLISHED" }).state.status,
    "UNPUBLISHED",
  );
  assert.equal(
    homeContent.HomeContentPage({ ...homeState, status: "CONFLICT" }).publishAction,
    "版本冲突待处理",
  );

  const teacherState = {
    profileId: "teacher-synthetic",
    displayName: "模拟教师",
    headline: "模拟介绍",
    subjects: ["数学"],
    bio: "仅用于测试。",
    version: 1,
    status: "CONFLICT",
    canPublish: true,
  };
  assert.equal(
    publicTeachers.PublicTeacherIntroductionsPage(teacherState).publishAction,
    "版本冲突待处理",
  );
  assert.equal(
    publicTeachers.PublicTeacherIntroductionsPage({ ...teacherState, status: "PUBLISHED" })
      .unpublishAction,
    "下架",
  );

  const mealState = {
    mealId: "meal-synthetic",
    mealDate: "2026-09-27",
    mealType: "LUNCH",
    items: ["模拟餐食"],
    notes: "仅用于测试。",
    version: 1,
    status: "DRAFT",
    canPublish: false,
  };
  const mealPage = (state) =>
    meals.MealsPage({
      meals: [state],
      selectedMealId: state.mealId,
      sortDirection: "ASC",
      auditEntries: [],
      canEdit: true,
      canPublish: state.canPublish,
      hasConflict: state.status === "CONFLICT",
    });
  assert.equal(mealPage(mealState).publishAction, "需要发布权限");
  assert.equal(
    mealPage({ ...mealState, status: "PUBLISHED", canPublish: true }).unpublishAction,
    "下架",
  );
});

test("audit projection exposes scoped summary and conflict or denied messages", () => {
  const scope = { tenantId: "tenant-synthetic-a", campusId: "campus-synthetic-east" };
  const scopedEvent = {
    event_id: "audit-synthetic",
    actor_id: "actor-synthetic",
    tenant_id: scope.tenantId,
    campus_id: scope.campusId,
    action: "CONTENT_PUBLISHED",
    target_type: "HOME_CONTENT",
    target_id: "home-synthetic",
    occurred_at: "2026-09-27T00:00:00.000Z",
    correlation_id: "correlation-synthetic",
    trace_id: "trace-synthetic",
    metadata: { synthetic: true },
    synthetic_data: true,
  };
  const ready = auditLogs.AuditLogsPage({
    status: "READY",
    scope,
    events: [
      scopedEvent,
      {
        ...scopedEvent,
        event_id: "audit-foreign",
        tenant_id: "tenant-other",
        campus_id: "campus-other",
      },
    ],
  });
  assert.equal(ready.summary.total, 1);
  assert.match(ready.summary.scopeLabel, /campus-synthetic-east/);
  assert.equal(
    auditLogs.AuditLogsPage({ status: "DENIED", scope, events: [] }).message,
    "ACCESS_DENIED",
  );
  assert.equal(
    auditLogs.AuditLogsPage({ status: "CONFLICT", scope, events: [] }).message,
    "AUDIT_LOG_CONFLICT",
  );
});

test("admin entry keeps management scope and local-only state routes", () => {
  const entry = readFileSync(path.join(root, "src/main.ts"), "utf8");
  assert.match(entry, /模拟机构/);
  assert.match(entry, /模拟东校区/);
  assert.match(entry, /\/admin\/institution/);
  assert.match(entry, /\/admin\/home-content/);
  assert.match(entry, /\/admin\/activities/);
  assert.match(entry, /\/admin\/guides/);
  assert.match(entry, /\/admin\/resources/);
  assert.match(entry, /\/admin\/partner-cloud/);
  assert.match(entry, /\/admin\/staff/);
  assert.match(entry, /\/admin\/files/);
  assert.match(entry, /\/admin\/publishing/);
  assert.match(entry, /\/admin\/staff-resources/);
  assert.match(entry, /\/admin\/staff-accounts/);
  assert.match(entry, /模拟活动/);
  assert.match(entry, /READ_ONLY/);
  assert.match(entry, /CONFLICT/);
  assert.match(entry, /globalThis\.fetch/u);
  assert.doesNotMatch(entry, /wx\.request|https?:\/\/(?!127\.0\.0\.1|localhost)/iu);
  const localProxy = readFileSync(path.join(root, "src/local-proxy.mjs"), "utf8");
  assert.match(localProxy, /url\.origin !== "http:\/\/127\.0\.0\.1"/u);
});
