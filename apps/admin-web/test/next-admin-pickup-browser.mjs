/* global document, fetch, HTMLElement, process, URL, window */

import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createConnection } from "node:net";
import { resolve } from "node:path";
import test from "node:test";
import { chromium } from "playwright";
import { startNextAdminLocal } from "../../../scripts/start-next-admin-local.mjs";

const serviceOrigin = "http://127.0.0.1:4319";

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

test("Next admin reviews synthetic pickup exceptions and exposes only platform counts", async (t) => {
  const runtime = await startNextAdminLocal();
  let browser;
  const browserErrors = [];
  const failedRequests = [];
  const externalRequests = [];
  const localRequests = [];
  const expectedLocalConnectionCancellations = [];
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

    const teacher = await session("teacher-east");
    const owner = await session("owner-east");
    const westOwner = await session("owner-west");
    const platform = await session("platform-admin");
    const reported = await api("/local/pickup-exceptions", {
      method: "POST",
      headers: teacher,
      body: JSON.stringify({
        student: "student-alpha",
        date: "2026-10-12",
        category: "NO_AUTHORIZATION",
      }),
    });
    assert.equal(reported.status, "OPEN");
    assert.equal((await api("/local/pickup-exceptions", { headers: owner })).length, 1);
    assert.equal((await api("/local/pickup-exceptions", { headers: westOwner })).length, 0);
    const initialCounts = await api("/local/pickup-summary", { headers: platform });
    assert.equal(initialCounts.synthetic, true);
    assert.equal(initialCounts.counts.openExceptions, 1);
    assert.equal("rows" in initialCounts, false);
    assert.equal(JSON.stringify(initialCounts).includes(reported.id), false);

    browser = await chromium.launch({ headless: true });
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
    context.on("page", (page) => {
      page.on("pageerror", (error) => browserErrors.push(`pageerror: ${error.message}`));
      page.on("console", (message) => {
        if (message.type() === "error") browserErrors.push(`console: ${message.text()}`);
      });
      page.on("requestfailed", (request) => {
        const url = new URL(request.url());
        const error = request.failure()?.errorText ?? "unknown";
        if (
          url.origin === serviceOrigin &&
          url.pathname === "/local/sessions" &&
          error === "net::ERR_ABORTED"
        ) {
          expectedLocalConnectionCancellations.push(`${url.pathname} (${error})`);
          return;
        }
        if (
          url.origin === adminOrigin &&
          url.pathname === "/admin/pickup-review" &&
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
      .getByRole("link", { name: "接送异常处理", exact: true })
      .click();
    await page.waitForURL(`${adminOrigin}/admin/pickup-review`);
    await page.getByRole("heading", { name: "接送异常处理" }).waitFor();
    await page.locator(".pickup-review-row").waitFor();
    assert.equal(await page.locator(".pickup-review-row").count(), 1);
    assert.equal(await page.getByRole("button", { name: "记录跟进" }).isDisabled(), true);

    const desktop = await page.evaluate(() => {
      const sidebar = document.querySelector(".admin-sidebar").getBoundingClientRect();
      const content = document.querySelector("main").getBoundingClientRect();
      return {
        sidebarLeft: sidebar.left,
        sidebarWidth: sidebar.width,
        contentLeft: content.left,
        pageWidth: document.documentElement.scrollWidth,
      };
    });
    assert.equal(desktop.sidebarLeft, 0);
    assert.equal(desktop.sidebarWidth, 264);
    assert.ok(desktop.contentLeft >= desktop.sidebarWidth);
    assert.equal(desktop.pageWidth, 1365);

    await page.locator(".pickup-review-confirm input").check();
    await page.getByRole("button", { name: "记录跟进" }).click();
    const row = page.locator(".pickup-review-row").filter({ hasText: "示例学生甲" });
    await row.getByText("跟进中", { exact: true }).waitFor();
    assert.equal(await row.getByRole("button", { name: "记录处理结果" }).isDisabled(), true);
    await page.locator(".pickup-review-confirm input").check();
    await row.getByRole("button", { name: "记录处理结果" }).click();
    await row.getByText("已记录处理结果", { exact: true }).waitFor();
    assert.equal(await row.getByRole("button").count(), 0);
    assert.doesNotMatch(await row.innerText(), /已安全接走|现场已核验|确认离校/u);

    const screenshotDir = process.env.NEXT_PICKUP_SCREENSHOT_DIR;
    if (screenshotDir) {
      await page.evaluate(() => {
        window.scrollTo(0, 0);
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      });
      await page.mouse.move(1355, 5);
      await mkdir(resolve(screenshotDir), { recursive: true });
      await page.screenshot({ path: resolve(screenshotDir, "desktop.png"), fullPage: true });
    }

    await page.locator("#pickup-review-profile").selectOption("owner-west");
    await page.getByText("当前授权范围没有接送异常。", { exact: true }).waitFor();
    assert.equal(await page.locator(".pickup-review-row").count(), 0);
    assert.doesNotMatch(await page.locator("main").innerText(), /示例学生甲/u);

    await page.locator("#pickup-review-profile").selectOption("teacher-east");
    await page.getByText("当前授权范围没有接送异常。", { exact: true }).waitFor();
    assert.equal(await page.locator(".pickup-review-confirm").count(), 0);
    assert.equal(await page.getByRole("button", { name: "记录跟进" }).count(), 0);

    const platformStart = localRequests.length;
    await page.locator("#pickup-review-profile").selectOption("platform-admin");
    await page.getByRole("heading", { name: "平台汇总" }).waitFor();
    const platformText = await page.locator("main").innerText();
    assert.match(platformText, /跟进中异常\s+0/u);
    assert.match(platformText, /已记录处理结果\s+1/u);
    assert.doesNotMatch(platformText, /示例学生甲|2026-10-12|[0-9a-f]{8}-[0-9a-f-]{27}/iu);
    const platformRequests = localRequests.slice(platformStart);
    assert.ok(platformRequests.some((item) => item.path === "/local/pickup-summary"));
    assert.equal(
      platformRequests.some((item) =>
        /pickup-(?:authorizations|records|exceptions)$/u.test(item.path),
      ),
      false,
    );

    await page.setViewportSize({ width: 390, height: 844 });
    const mobileToggle = page.locator(".nav-toggle");
    assert.equal(await mobileToggle.isVisible(), true);
    await mobileToggle.click();
    assert.equal(await mobileToggle.getAttribute("aria-expanded"), "true");
    await page.keyboard.press("Escape");
    assert.equal(await mobileToggle.getAttribute("aria-expanded"), "false");
    const mobilePageWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    assert.equal(mobilePageWidth, 390);
    if (screenshotDir) {
      await page.evaluate(() => {
        window.scrollTo(0, 0);
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      });
      await page.mouse.move(385, 5);
      await page.screenshot({
        path: resolve(screenshotDir, "mobile.png"),
        fullPage: true,
        animations: "disabled",
      });
    }

    assert.deepEqual(browserErrors, []);
    assert.deepEqual(failedRequests, []);
    assert.deepEqual(externalRequests, []);
    assert.ok(expectedLocalConnectionCancellations.length <= 1);
    t.diagnostic(
      JSON.stringify({
        desktopSidebarLeft: desktop.sidebarLeft,
        desktopSidebarWidth: desktop.sidebarWidth,
        desktopContentLeft: desktop.contentLeft,
        desktopPageWidth: desktop.pageWidth,
        mobilePageWidth,
        browserErrors: browserErrors.length,
        failedRequests: failedRequests.length,
        expectedLocalConnectionCancellations: expectedLocalConnectionCancellations.length,
        externalRequests: externalRequests.length,
      }),
    );
  } finally {
    await browser?.close();
    await runtime.close();
    await assertPortClosed(4319);
    await assertPortClosed(Number(new URL(runtime.ready.admin).port));
  }
});
