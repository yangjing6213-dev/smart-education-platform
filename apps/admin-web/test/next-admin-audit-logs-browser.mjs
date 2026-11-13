/* global document, process, URL */

import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { chromium } from "playwright";
import { startNextAdminLocal } from "../../../scripts/start-next-admin-local.mjs";

const evidenceRoot =
  process.env.TASK20_A161_EVIDENCE_DIR ??
  resolve(process.cwd(), "../../artifacts/task20-a1-61-next-admin-audit-log-filters-20261016");

test("Next admin audit log filters stay synthetic, private, and responsive", async () => {
  const runtime = await startNextAdminLocal();
  let browser;
  const browserErrors = [];
  const failedRequests = [];
  const externalRequests = [];
  const serviceRequests = [];
  try {
    const adminOrigin = new URL(runtime.ready.admin).origin;
    const serviceOrigin = new URL(runtime.ready.service).origin;
    const allowedOrigins = new Set([adminOrigin, serviceOrigin]);
    browser = await chromium.launch({
      headless: true,
      ...(process.env.ADMIN_WEB_BROWSER ? { executablePath: process.env.ADMIN_WEB_BROWSER } : {}),
    });
    const context = await browser.newContext({
      viewport: { width: 1365, height: 900 },
    });
    await context.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (!allowedOrigins.has(url.origin)) {
        externalRequests.push(`${url.origin}${url.pathname}`);
        await route.abort("blockedbyclient");
        return;
      }
      if (url.origin === serviceOrigin)
        serviceRequests.push(`${route.request().method()} ${url.pathname}`);
      await route.continue();
    });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    page.on("pageerror", (error) => browserErrors.push(`pageerror: ${error.message}`));
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(`console: ${message.text()}`);
    });
    page.on("requestfailed", (request) => {
      failedRequests.push(`${request.url()} (${request.failure()?.errorText ?? "unknown"})`);
    });

    await page.goto(`${adminOrigin}/admin/audit-logs`, {
      waitUntil: "networkidle",
    });
    const panel = page.locator(".audit-logs");
    assert.equal(await page.getByLabel("操作类型").count(), 1);
    assert.equal(await page.getByLabel("开始日期").count(), 1);
    assert.equal(await page.getByLabel("结束日期").count(), 1);
    assert.equal(await panel.locator("[data-audit-log-row]").count(), 6);
    assert.match(await panel.locator("[data-audit-log-summary]").innerText(), /6 条事件/u);
    assert.match(await panel.innerText(), /本机合成样例/u);
    assert.doesNotMatch(
      await panel.innerText(),
      /audit-event-synthetic|00000000-0000|correlation-synthetic|trace-synthetic|synthetic-home-announcement|synthetic-reference/iu,
    );
    assert.doesNotMatch(
      await panel.innerHTML(),
      /audit-event-synthetic|00000000-0000|correlation-synthetic|trace-synthetic|synthetic-home-announcement|synthetic-reference/iu,
    );

    await page.getByLabel("操作类型").selectOption("CONTENT_PUBLISHED");
    assert.equal(await panel.locator("[data-audit-log-row]").count(), 1);
    assert.match(await panel.innerText(), /发布内容/u);

    await page.getByLabel("结束日期").fill("2026-10-15");
    assert.equal(await panel.locator("[data-audit-log-row]").count(), 0);
    assert.match(await panel.innerText(), /没有符合条件的审计样例/u);

    await page.getByRole("button", { name: "清空筛选" }).click();
    assert.equal(await panel.locator("[data-audit-log-row]").count(), 6);
    assert.equal(await page.getByLabel("操作类型").inputValue(), "ALL");
    assert.equal(await page.getByLabel("开始日期").inputValue(), "");
    assert.equal(await page.getByLabel("结束日期").inputValue(), "");

    await page.getByLabel("开始日期").fill("2026-10-14");
    await page.getByLabel("结束日期").fill("2026-10-16");
    assert.equal(await panel.locator("[data-audit-log-row]").count(), 5);
    await page.getByRole("button", { name: "清空筛选" }).click();

    const desktopLayout = await page.evaluate(() => {
      const sidebar = document.querySelector(".admin-sidebar").getBoundingClientRect();
      const main = document.querySelector(".admin-main").getBoundingClientRect();
      return {
        sidebarRight: sidebar.right,
        mainLeft: main.left,
        width: document.documentElement.scrollWidth,
      };
    });
    assert.ok(desktopLayout.mainLeft >= desktopLayout.sidebarRight);
    assert.equal(desktopLayout.width, 1365);
    await mkdir(resolve(evidenceRoot, "screenshots"), { recursive: true });
    await page.screenshot({
      path: resolve(evidenceRoot, "screenshots/desktop.png"),
      fullPage: true,
    });

    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 700 });
      const layoutWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      assert.equal(layoutWidth, width);
      const toggle = page.getByRole("button", { name: "打开菜单" });
      await toggle.click();
      assert.equal(
        await page.getByRole("button", { name: "关闭菜单" }).getAttribute("aria-expanded"),
        "true",
      );
      await page.waitForFunction(() => {
        const sidebar = document.querySelector(".admin-sidebar");
        return sidebar !== null && Math.abs(sidebar.getBoundingClientRect().x) < 0.5;
      });
      const sidebar = await page.locator(".admin-sidebar").boundingBox();
      assert.ok(Math.abs(sidebar?.x ?? width + 1) < 0.5);
      assert.ok((sidebar?.width ?? width + 1) <= 300);
      await page.keyboard.press("Escape");
      assert.equal(
        await page.getByRole("button", { name: "打开菜单" }).getAttribute("aria-expanded"),
        "false",
      );
      await page.waitForFunction(() => {
        const sidebar = document.querySelector(".admin-sidebar");
        return sidebar !== null && document.defaultView?.getComputedStyle(sidebar).visibility === "hidden";
      });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width);
      await page.screenshot({
        path: resolve(evidenceRoot, `screenshots/mobile-${width}.png`),
        fullPage: true,
      });
    }

    assert.deepEqual(serviceRequests, []);
    assert.deepEqual(failedRequests, []);
    assert.deepEqual(externalRequests, []);
    assert.deepEqual(browserErrors, []);
  } finally {
    await browser?.close();
    await runtime.close();
  }
});
