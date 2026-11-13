/* global document, fetch, getComputedStyle, process, URL */

import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createConnection } from "node:net";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { chromium } from "playwright";
import { startNextAdminLocal } from "../../../scripts/start-next-admin-local.mjs";

const serviceOrigin = "http://127.0.0.1:4319";
const screenshotDirectory = resolve(
  fileURLToPath(new URL("../../../", import.meta.url)),
  "artifacts/task20-a1-21-next-admin-consent-review-20261014/screenshots",
);

async function assertPortClosed(port) {
  await new Promise((resolvePromise, reject) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    socket.once("connect", () => {
      socket.destroy();
      reject(new Error(`本批服务端口 ${port} 在关闭后仍接受连接。`));
    });
    socket.once("error", (error) => {
      if (error.code === "ECONNREFUSED") resolvePromise();
      else reject(error);
    });
  });
}

test("Next admin reviews only scoped synthetic consent retention records", async () => {
  let syntheticNow = Date.now();
  const runtime = await startNextAdminLocal({ now: () => syntheticNow });
  let browser;
  const browserErrors = [];
  const failedRequests = [];
  const externalRequests = [];
  try {
    const adminOrigin = new URL(runtime.ready.admin).origin;
    const allowedOrigins = new Set([adminOrigin, serviceOrigin]);
    async function api(path, { headers = {}, ...init } = {}) {
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
      const body = await response.json();
      assert.ok(response.status >= 200 && response.status < 300, `${path}: ${response.status}`);
      return body;
    }
    async function session(profile) {
      const result = await api("/local/sessions", {
        method: "POST",
        body: JSON.stringify({ profile }),
      });
      return { Authorization: `Bearer ${result.handle}` };
    }

    const parent = await session("parent-alpha");
    const owner = await session("owner-east");
    const application = await api("/local/binding-applications", {
      method: "POST",
      headers: parent,
      body: JSON.stringify({ student: "student-alpha", relationship: "GUARDIAN" }),
    });
    const binding = await api(`/local/binding-applications/${application.id}/review`, {
      method: "POST",
      headers: owner,
      body: JSON.stringify({ version: application.version, action: "approve" }),
    });
    const [purpose] = await api("/local/consent-policies", { headers: parent });
    const consent = await api("/local/consents", {
      method: "POST",
      headers: parent,
      body: JSON.stringify({
        bindingId: binding.id,
        purposeKey: purpose.key,
        noticeVersion: purpose.noticeVersion,
        confirmed: true,
      }),
    });
    syntheticNow = Date.parse(consent.retainUntil) + 60_000;
    const currentParent = await session("parent-alpha");
    const dueForParent = await api("/local/consents", { headers: currentParent });
    assert.equal(dueForParent[0]?.retentionStatus, "REVIEW_DUE");

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
      await route.continue();
    });
    context.on("page", (page) => {
      page.on("pageerror", (error) => browserErrors.push(`pageerror: ${error.message}`));
      page.on("console", (message) => {
        if (message.type() === "error") browserErrors.push(`console: ${message.text()}`);
      });
      page.on("requestfailed", (request) => {
        const url = new URL(request.url());
        const error = request.failure()?.errorText ?? "unknown";
        if (
          url.origin === adminOrigin &&
          url.pathname === "/admin/consent-review" &&
          url.searchParams.has("_rsc") &&
          error === "net::ERR_ABORTED"
        )
          return;
        failedRequests.push(`${request.url()} (${error})`);
      });
    });

    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    await page.goto(`${adminOrigin}/admin/institution`, { waitUntil: "networkidle" });
    await page
      .locator("#admin-navigation")
      .getByRole("link", { name: "数据授权复核", exact: true })
      .click();
    await page.waitForURL(`${adminOrigin}/admin/consent-review`);
    await page.getByRole("heading", { name: "数据授权与期限复核" }).waitFor();
    await page.getByRole("button", { name: "连接并刷新", exact: true }).click();

    const row = page.locator("[data-consent-review-row]").filter({ hasText: purpose.title });
    await row.getByText("等待负责人复核", { exact: true }).waitFor();
    const hold = row.getByRole("button", { name: "标记必要保留", exact: true });
    const expiry = row.getByRole("button", { name: "期限到期演练", exact: true });
    assert.equal(await hold.isDisabled(), true);
    assert.equal(await expiry.isDisabled(), true);
    await mkdir(screenshotDirectory, { recursive: true });
    await page.screenshot({ path: resolve(screenshotDirectory, "desktop.png"), fullPage: true });
    await row.getByRole("checkbox", { name: "确认已核对该模拟授权记录" }).check();
    assert.equal(await hold.isDisabled(), false);
    assert.equal(await expiry.isDisabled(), false);
    await hold.click();
    await row.getByText("已标记为演示保留", { exact: true }).waitFor();
    await row.getByText("dataChanged=false", { exact: false }).waitFor();
    await page.getByRole("button", { name: "刷新记录", exact: true }).click();
    await row.getByText("已标记为演示保留", { exact: true }).waitFor();

    const parentAfterReview = await api("/local/consents", { headers: currentParent });
    assert.equal(parentAfterReview[0]?.retentionStatus, "REQUIRED_HOLD");
    assert.equal(parentAfterReview[0]?.status, "ACTIVE");
    assert.equal(parentAfterReview[0]?.dataChanged, false);

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
    assert.deepEqual(desktop, {
      sidebarLeft: 0,
      sidebarWidth: 264,
      contentLeft: 264,
      pageWidth: 1365,
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => {
      const sidebar = document.querySelector(".admin-sidebar");
      return (
        getComputedStyle(sidebar).visibility === "hidden" &&
        sidebar.getBoundingClientRect().right <= 0
      );
    });
    await page.screenshot({ path: resolve(screenshotDirectory, "mobile.png"), fullPage: true });
    await page.getByRole("button", { name: "打开菜单", exact: true }).click();
    await page
      .locator("#admin-navigation")
      .getByRole("link", { name: "数据授权复核", exact: true })
      .waitFor();
    const mobile = await page.evaluate(() => ({
      pageWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      mainLeft: document.querySelector(".admin-main").getBoundingClientRect().left,
    }));
    assert.equal(mobile.pageWidth, mobile.viewportWidth);
    assert.equal(mobile.mainLeft, 0);
    await page.getByRole("button", { name: "关闭菜单", exact: true }).click();
    await page.getByRole("button", { name: "打开菜单", exact: true }).waitFor();

    await page.locator("#consent-review-profile").selectOption("owner-west");
    await page.getByRole("button", { name: "连接并刷新", exact: true }).click();
    await page.getByText("当前负责范围内没有同意记录。", { exact: true }).waitFor();
    assert.equal(await page.locator("[data-consent-review-row]").count(), 0);

    assert.deepEqual(browserErrors, []);
    assert.deepEqual(failedRequests, []);
    assert.deepEqual(externalRequests, []);
  } finally {
    await browser?.close();
    await runtime.close();
    await assertPortClosed(4319);
  }
});
