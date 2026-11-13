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

test("Next admin reviews and claims synthetic supply requests in the left-nav shell", async (t) => {
  const runtime = await startNextAdminLocal();
  let browser;
  const browserErrors = [];
  const failedRequests = [];
  const expectedNavigationCancellations = [];
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
      assert.equal(typeof result.handle, "string");
      return { Authorization: `Bearer ${result.handle}` };
    }
    async function submitRequest(teacher, catalog, purpose, quantity) {
      const draft = await api("/local/supply-requests", {
        method: "POST",
        headers: teacher,
        body: JSON.stringify({ catalog, purpose, quantity }),
      });
      const submitted = await api(`/local/supply-requests/${draft.id}/submit`, {
        method: "POST",
        headers: teacher,
        body: JSON.stringify({ version: draft.version }),
      });
      assert.equal(submitted.status, "SUBMITTED");
      return submitted;
    }

    const teacher = await session("teacher-east");
    const owner = await session("owner-east");
    const westOwner = await session("owner-west");
    const platform = await session("platform-admin");
    const readyRequest = await submitRequest(teacher, "STATIONERY_SET", "CLASS_ACTIVITY", 3);
    const returnRequest = await submitRequest(teacher, "ART_ACTIVITY_SET", "DAILY_OPERATION", 2);
    const shortageRequest = await submitRequest(teacher, "FIRST_AID_SET", "EMERGENCY_STOCK", 1);
    assert.equal((await api("/local/supply-requests-review", { headers: owner })).length, 3);
    assert.equal((await api("/local/supply-requests-review", { headers: westOwner })).length, 0);
    const counts = await api("/local/supply-summary", { headers: platform });
    assert.equal(counts.synthetic, true);
    assert.equal("id" in counts, false);
    assert.equal("rows" in counts, false);

    browser = await chromium.launch({ headless: true });
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
          url.pathname === "/admin/supply-request-review" &&
          url.searchParams.has("_rsc") &&
          error === "net::ERR_ABORTED"
        ) {
          expectedNavigationCancellations.push(`${url.pathname}?_rsc (${error})`);
        } else {
          failedRequests.push(`${request.url()} (${error})`);
        }
      });
    });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    await page.goto(`${adminOrigin}/admin/institution`, { waitUntil: "networkidle" });
    await page
      .locator("#admin-navigation")
      .getByRole("link", { name: "物资申请审核", exact: true })
      .click();
    await page.waitForURL(`${adminOrigin}/admin/supply-request-review`);
    await page.getByRole("heading", { name: "物资申请审核" }).waitFor();
    await page.getByText("已刷新授权范围内的物资申请。", { exact: true }).waitFor();
    assert.equal(
      await page.locator("#admin-navigation .active").getAttribute("href"),
      "/admin/supply-request-review",
    );

    const queue = page.locator('[aria-labelledby="supply-review-queue-title"] .supply-review-row');
    const readyRow = queue.filter({ hasText: "日常文具包" });
    const returnRow = queue.filter({ hasText: "美术活动包" });
    const shortageRow = queue.filter({ hasText: "基础急救包" });
    assert.equal(await queue.count(), 3);
    assert.equal(await readyRow.getByRole("button", { name: "确认可领取" }).isDisabled(), true);
    assert.equal(await readyRow.getByRole("button", { name: "退回修改" }).isDisabled(), true);
    const initialText = await page.locator("body").innerText();
    for (const row of [readyRequest, returnRequest, shortageRequest])
      assert.equal(initialText.includes(row.id), false);
    assert.equal(/\b[0-9a-f]{8}-[0-9a-f-]{27}\b/iu.test(initialText), false);

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
    assert.ok(desktop.sidebarWidth > 0 && desktop.contentLeft >= desktop.sidebarWidth);
    assert.equal(desktop.pageWidth, 1365);
    const screenshotDir = process.env.NEXT_SUPPLY_SCREENSHOT_DIR;
    if (screenshotDir) {
      await page.evaluate(() => {
        window.scrollTo(0, 0);
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      });
      await page.mouse.move(1355, 5);
      await mkdir(resolve(screenshotDir), { recursive: true });
      await page.screenshot({ path: resolve(screenshotDir, "desktop.png"), fullPage: true });
    }

    await page.locator(".supply-review-confirm input").check();
    await readyRow.getByRole("button", { name: "确认可领取" }).click();
    await readyRow.getByRole("button", { name: "确认领取" }).waitFor();
    await page.locator(".supply-review-confirm input").check();
    await readyRow.getByRole("button", { name: "确认领取" }).click();
    await page.getByText("已登记领取，该申请不能重复领取。", { exact: true }).waitFor();
    await assert.rejects(
      api(`/local/supply-requests/${readyRequest.id}/claim`, {
        method: "POST",
        headers: teacher,
        body: JSON.stringify({ version: readyRequest.version + 2 }),
      }),
    );
    await page.locator(".supply-review-confirm input").check();
    await returnRow.getByRole("button", { name: "退回修改" }).click();
    await page.getByText("已退回，教师可修改后重新提交或取消。", { exact: true }).waitFor();
    await page.locator(".supply-review-confirm input").check();
    await shortageRow.getByRole("button", { name: "标记缺货" }).click();
    await page.getByText("已标记缺货。", { exact: true }).waitFor();
    assert.equal(await queue.count(), 1);
    assert.match(await queue.innerText(), /基础急救包[\s\S]*缺货[\s\S]*申请版本 3/u);
    assert.equal((await api("/local/supply-requests-review", { headers: owner })).length, 1);
    assert.equal((await api("/local/supply-requests-review", { headers: westOwner })).length, 0);
    const bodyAfterActions = await page.locator("body").innerText();
    assert.equal(bodyAfterActions.includes(readyRequest.id), false);
    assert.equal(bodyAfterActions.includes(returnRequest.id), false);
    assert.equal(bodyAfterActions.includes(shortageRequest.id), false);

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

    await page.getByLabel("当前审核角色").selectOption("PLATFORM_ADMIN");
    await page.getByText("已刷新匿名状态统计。", { exact: true }).waitFor();
    assert.equal(await page.locator(".supply-review-row").count(), 0);
    const platformText = await page.locator("body").innerText();
    assert.match(platformText, /匿名状态统计/u);
    assert.doesNotMatch(
      platformText,
      /日常文具包|美术活动包|基础急救包|示例东校区教师|[0-9a-f]{8}-[0-9a-f-]{27}/iu,
    );

    assert.deepEqual(browserErrors, []);
    assert.deepEqual(failedRequests, []);
    assert.deepEqual(externalRequests, []);
    assert.ok(expectedNavigationCancellations.length <= 1);
    t.diagnostic(
      JSON.stringify({
        desktopSidebarLeft: desktop.sidebarLeft,
        desktopSidebarWidth: desktop.sidebarWidth,
        desktopContentLeft: desktop.contentLeft,
        desktopPageWidth: desktop.pageWidth,
        mobilePageWidth,
        browserErrors: browserErrors.length,
        unexpectedFailedRequests: failedRequests.length,
        externalRequests: externalRequests.length,
        expectedLocalNavigationCancellations: expectedNavigationCancellations.length,
      }),
    );
  } finally {
    await browser?.close();
    await runtime.close();
    await assertPortClosed(4319);
    await assertPortClosed(Number(new URL(runtime.ready.admin).port));
  }
});
