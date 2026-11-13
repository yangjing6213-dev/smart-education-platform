/* global document, fetch, localStorage, process, sessionStorage, URL, window */

import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { chromium } from "playwright";
import { startNextAdminLocal } from "../../../scripts/start-next-admin-local.mjs";

const serviceOrigin = "http://127.0.0.1:4319";

test("Next admin statistics preserve campus scope and platform anonymity", async (t) => {
  const runtime = await startNextAdminLocal({
    now: () => Date.parse("2026-10-14T12:00:00+08:00"),
  });
  let browser;
  const browserErrors = [];
  const failedRequests = [];
  const externalRequests = [];
  const localRequests = [];

  t.after(async () => {
    await browser?.close();
    await runtime.close();
    await runtime.closed;
  });

  const adminOrigin = new URL(runtime.ready.admin).origin;
  const allowedOrigins = new Set([adminOrigin, serviceOrigin]);

  async function api(path, { headers = {}, ...init } = {}) {
    const response = await fetch(new URL(path, serviceOrigin), {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      redirect: "error",
    });
    const body = response.status === 204 ? null : await response.json();
    assert.ok(response.status >= 200 && response.status < 300, `${path}: ${response.status}`);
    return body;
  }

  async function session(profile) {
    const created = await api("/local/sessions", {
      method: "POST",
      body: JSON.stringify({ profile }),
    });
    return { Authorization: `Bearer ${created.handle}` };
  }

  const owner = await session("owner-east");
  const teacher = await session("teacher-east");
  const ownerSession = await api("/local/session", { headers: owner });
  const assignees = await api("/local/staff-task-assignees", { headers: owner });
  await api("/local/staff-tasks", {
    method: "POST",
    headers: owner,
    body: JSON.stringify({
      code: "DAILY_CHECK",
      assigneeId: assignees[0].actorId,
      targetType: "CLASS",
      targetId: ownerSession.classIds[0],
      dueDate: "2026-10-07",
      priority: "NORMAL",
    }),
  });
  await api("/local/attendance-records", {
    method: "POST",
    headers: teacher,
    body: JSON.stringify({
      student: "student-alpha",
      date: "2026-10-07",
      status: "ARRIVED",
      time: "09:00",
    }),
  });
  await api("/local/pickup-exceptions", {
    method: "POST",
    headers: teacher,
    body: JSON.stringify({ student: "student-alpha", date: "2026-10-07", category: "OVERDUE" }),
  });

  browser = await chromium.launch({
    headless: true,
    ...(process.env.ADMIN_WEB_BROWSER ? { executablePath: process.env.ADMIN_WEB_BROWSER } : {}),
  });
  const context = await browser.newContext({ viewport: { width: 1365, height: 900 } });
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/favicon.ico") {
      await route.fulfill({ status: 204, body: "" });
      return;
    }
    if (!allowedOrigins.has(url.origin)) {
      externalRequests.push(`${url.origin}${url.pathname}`);
      await route.abort("blockedbyclient");
      return;
    }
    if (url.origin === serviceOrigin && url.pathname.startsWith("/local/"))
      localRequests.push({ method: route.request().method(), path: url.pathname });
    await route.continue();
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => browserErrors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(`console: ${message.text()}`);
  });
  page.on("requestfailed", (request) =>
    failedRequests.push(`${request.url()} (${request.failure()?.errorText ?? "unknown"})`),
  );
  page.setDefaultTimeout(10000);

  await page.goto(`${adminOrigin}/admin/statistics`, { waitUntil: "networkidle" });
  assert.equal(await page.locator(".migration-notice").count(), 0);
  await page.getByRole("heading", { name: "运营统计", exact: true }).waitFor();
  await page.locator(".statistics-panel").waitFor();
  await page
    .locator("[data-statistics-status]")
    .filter({ hasText: "统计范围来自当前登录身份" })
    .waitFor();
  assert.equal(
    await page.locator(".admin-sidebar .active").getAttribute("href"),
    "/admin/statistics",
  );

  const desktop = await page.evaluate(() => {
    const sidebar = document.querySelector(".admin-sidebar").getBoundingClientRect();
    const content = document.querySelector(".admin-main").getBoundingClientRect();
    return {
      sidebarLeft: sidebar.left,
      sidebarWidth: sidebar.width,
      contentLeft: content.left,
      pageWidth: document.documentElement.scrollWidth,
    };
  });
  assert.equal(desktop.sidebarLeft, 0);
  assert.ok(desktop.sidebarWidth > 0 && desktop.contentLeft >= desktop.sidebarWidth);
  assert.equal(desktop.pageWidth, 1365);

  await page.getByLabel("开始日期", { exact: true }).fill("2026-10-07");
  await page.getByLabel("结束日期", { exact: true }).fill("2026-10-07");
  await page.getByRole("button", { name: "应用筛选", exact: true }).click();
  await page.locator("[data-statistics-group]").first().waitFor();
  assert.equal(await page.locator("[data-statistics-group]").count(), 3);
  assert.equal(await page.locator("[data-statistics-source]").count(), 3);
  assert.doesNotMatch(
    await page.locator(".statistics-panel").innerText(),
    /student-alpha|studentId/u,
  );

  const statisticsReadsBeforeInvalidFilter = localRequests.filter(
    ({ method, path }) => method === "GET" && path === "/local/statistics",
  ).length;
  await page.getByLabel("开始日期", { exact: true }).fill("2026-09-01");
  await page.getByLabel("结束日期", { exact: true }).fill("2026-10-07");
  await page.getByRole("button", { name: "应用筛选", exact: true }).click();
  await page.getByRole("status").getByText("筛选无效", { exact: false }).waitFor();
  assert.equal(
    localRequests.filter(({ method, path }) => method === "GET" && path === "/local/statistics")
      .length,
    statisticsReadsBeforeInvalidFilter,
  );

  const screenshotDir = process.env.TASK20_A1_30_EVIDENCE_DIR;
  if (screenshotDir) {
    await mkdir(resolve(screenshotDir), { recursive: true });
    await page.screenshot({ path: resolve(screenshotDir, "desktop-campus.png"), fullPage: true });
  }

  await page.getByLabel("管理身份", { exact: true }).selectOption("owner-west");
  await page
    .locator("[data-statistics-status]")
    .filter({ hasText: "统计范围来自当前登录身份" })
    .waitFor();
  assert.equal(await page.locator("[data-statistics-group]").count(), 0);

  await page.getByLabel("管理身份", { exact: true }).selectOption("platform-admin");
  const anonymous = page.locator("[data-statistics-anonymous]");
  await anonymous.waitFor();
  assert.equal(await page.locator("[data-statistics-filter]").count(), 0);
  assert.equal(await page.locator("[data-statistics-source]").count(), 0);
  assert.doesNotMatch(await anonymous.innerText(), /示例东校区|授权班级|来源编号|2026-10-07/u);
  if (screenshotDir)
    await page.screenshot({
      path: resolve(screenshotDir, "platform-anonymous.png"),
      fullPage: true,
    });

  await page.getByLabel("管理身份", { exact: true }).selectOption("teacher-east");
  await page.getByRole("status").getByText("当前身份无权查看运营统计。", { exact: true }).waitFor();
  assert.equal(await page.locator("[data-statistics-group]").count(), 0);
  assert.equal(await page.locator("[data-statistics-anonymous]").count(), 0);

  await page.getByLabel("管理身份", { exact: true }).selectOption("owner-east");
  await page
    .locator("[data-statistics-status]")
    .filter({ hasText: "统计范围来自当前登录身份" })
    .waitFor();
  await page.getByLabel("开始日期", { exact: true }).fill("2026-10-07");
  await page.getByLabel("结束日期", { exact: true }).fill("2026-10-07");
  await page.getByRole("button", { name: "应用筛选", exact: true }).click();
  await page.locator("[data-statistics-group]").first().waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => document.documentElement.scrollWidth === window.innerWidth);
  if (screenshotDir)
    await page.screenshot({
      path: resolve(screenshotDir, "mobile-campus.png"),
      fullPage: true,
      animations: "disabled",
    });
  await page.locator(".nav-toggle").click();
  assert.equal(await page.locator(".nav-toggle").getAttribute("aria-expanded"), "true");
  await page.keyboard.press("Escape");
  assert.equal(await page.locator(".nav-toggle").getAttribute("aria-expanded"), "false");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390);

  assert.deepEqual(externalRequests, []);
  assert.deepEqual(browserErrors, []);
  assert.deepEqual(failedRequests, []);
  assert.ok(
    localRequests.some(({ method, path }) => method === "GET" && path === "/local/statistics"),
  );
  assert.ok(
    localRequests.some(
      ({ method, path }) => method === "GET" && path === "/local/statistics-summary",
    ),
  );
  assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
});
