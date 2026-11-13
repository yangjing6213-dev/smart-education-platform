/* global document, fetch, localStorage, process, URL, window */

import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { chromium } from "playwright";
import { startNextAdminLocal } from "../../../scripts/start-next-admin-local.mjs";

const serviceOrigin = "http://127.0.0.1:4319";

test("Next admin manages synthetic resources with campus scope and anonymous platform summary", async (t) => {
  const runtime = await startNextAdminLocal();
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

  async function apiRequest(path, { headers = {}, ...init } = {}) {
    const response = await fetch(new URL(path, serviceOrigin), {
      ...init,
      headers: {
        Accept: "application/json",
        Origin: adminOrigin,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      redirect: "error",
    });
    return { response, body: response.status === 204 ? null : await response.json() };
  }

  async function api(path, init = {}) {
    const result = await apiRequest(path, init);
    assert.ok(
      result.response.status >= 200 && result.response.status < 300,
      `${path}: ${result.response.status}`,
    );
    return result.body;
  }

  async function session(profile) {
    const created = await api("/local/sessions", {
      method: "POST",
      body: JSON.stringify({ profile }),
    });
    return { Authorization: `Bearer ${created.handle}` };
  }

  browser = await chromium.launch({
    headless: true,
    ...(process.env.ADMIN_WEB_BROWSER ? { executablePath: process.env.ADMIN_WEB_BROWSER } : {}),
  });
  const context = await browser.newContext({ viewport: { width: 1365, height: 900 } });
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
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

  await page.goto(`${adminOrigin}/admin/resources`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "资源管理", exact: true }).waitFor();
  await page.getByText("示例数学活动卡", { exact: true }).waitFor();
  await page.getByText("两位数加法练习卡", { exact: true }).waitFor();
  assert.equal(await page.locator("[data-resource-summary]").count(), 0);

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
  assert.equal(
    await page.locator(".admin-sidebar .active").getAttribute("href"),
    "/admin/resources",
  );

  const screenshotDir = process.env.NEXT_RESOURCES_SCREENSHOT_DIR;
  if (screenshotDir) {
    await mkdir(resolve(screenshotDir), { recursive: true });
    await page.screenshot({ path: resolve(screenshotDir, "desktop.png"), fullPage: true });
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => document.documentElement.scrollWidth === window.innerWidth);
  await page.locator(".nav-toggle").click();
  assert.equal(await page.locator(".nav-toggle").getAttribute("aria-expanded"), "true");
  assert.equal(
    await page
      .locator(".admin-layout")
      .evaluate((element) => element.classList.contains("nav-open")),
    true,
  );
  if (screenshotDir)
    await page.screenshot({
      path: resolve(screenshotDir, "mobile.png"),
      fullPage: true,
      animations: "disabled",
    });
  await page.keyboard.press("Escape");
  assert.equal(await page.locator(".nav-toggle").getAttribute("aria-expanded"), "false");
  assert.equal(
    await page
      .locator(".admin-layout")
      .evaluate((element) => element.classList.contains("nav-open")),
    false,
  );
  await page.setViewportSize({ width: 1365, height: 900 });

  const expiredCard = page.getByRole("article").filter({ hasText: "已过期示例练习" });
  const expiredSave = expiredCard.getByRole("button", { name: "保存设置", exact: true });
  assert.equal(await expiredSave.isDisabled(), true);
  await expiredCard.getByLabel("到期日期").selectOption("2026-10-31");
  assert.equal(await expiredSave.isEnabled(), true);

  const resourceCard = page.getByRole("article").filter({ hasText: "示例数学活动卡" });
  await resourceCard.getByLabel("适用范围").selectOption("CLASS");
  await resourceCard.getByLabel("到期日期").selectOption("2027-03-31");
  await resourceCard.getByRole("button", { name: "保存设置", exact: true }).click();
  await resourceCard.getByText("第 2 版", { exact: false }).waitFor();
  await resourceCard.getByText("到期：2027-03-31", { exact: false }).waitFor();

  const east = await session("owner-east");
  let rows = await api("/local/resources-managed", { headers: east });
  let mathCard = rows.find((row) => row.title === "示例数学活动卡");
  assert.ok(mathCard);
  assert.equal(mathCard.version, 2);
  assert.equal(mathCard.scope, "CLASS");
  assert.equal(mathCard.expiresOn, "2027-03-31");

  const sourceCard = page.getByRole("article").filter({ hasText: "两位数加法练习卡" });
  await sourceCard.getByRole("button", { name: "通过来源复核", exact: true }).click();
  await sourceCard.getByText("已通过", { exact: true }).waitFor();
  rows = await api("/local/resources-managed", { headers: east });
  const learningCard = rows.find((row) => row.title === "两位数加法练习卡");
  assert.ok(learningCard);
  assert.equal(learningCard.learningSourceGovernance.reviewStatus, "APPROVED");

  await resourceCard.getByRole("button", { name: "撤回资源", exact: true }).click();
  await resourceCard.getByText("已撤回", { exact: true }).waitFor();
  rows = await api("/local/resources-managed", { headers: east });
  mathCard = rows.find((row) => row.title === "示例数学活动卡");
  assert.equal(mathCard?.status, "REVOKED");
  assert.equal(mathCard?.version, 3);

  await page.getByLabel("管理身份").selectOption("owner-west");
  await page.getByText("当前校区没有可查看的资源。", { exact: true }).waitFor();
  assert.equal(await page.getByText("示例数学活动卡", { exact: true }).count(), 0);

  await page.getByLabel("管理身份").selectOption("platform-admin");
  await page.locator("[data-resource-summary]").waitFor();
  const summary = await page.locator("[data-resource-summary]").innerText();
  assert.match(summary, /资源总数/u);
  assert.doesNotMatch(summary, /示例数学活动卡|两位数加法练习卡|示例东校区负责人/u);
  assert.equal(await page.locator("[data-resource-management]").count(), 0);
  assert.equal(await page.evaluate(() => localStorage.length), 0);

  assert.deepEqual(externalRequests, []);
  assert.deepEqual(browserErrors, []);
  assert.deepEqual(failedRequests, []);
  assert.ok(localRequests.length >= 8);
  assert.equal(
    localRequests.every(({ path }) => path.startsWith("/local/")),
    true,
  );
});
