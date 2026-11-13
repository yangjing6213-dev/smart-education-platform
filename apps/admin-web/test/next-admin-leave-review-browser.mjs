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

test("Next admin reviews synthetic leave requests and parents see the same result", async () => {
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

    const parent = await session("parent-alpha");
    const owner = await session("owner-east");
    const westOwner = await session("owner-west");
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
    const approvedRequest = await api("/local/leave-requests", {
      method: "POST",
      headers: parent,
      body: JSON.stringify({
        bindingId: binding.id,
        startDate: "2026-11-01",
        endDate: "2026-11-01",
        reason: "FAMILY_ARRANGEMENT",
      }),
    });
    const returnedRequest = await api("/local/leave-requests", {
      method: "POST",
      headers: parent,
      body: JSON.stringify({
        bindingId: binding.id,
        startDate: "2026-11-03",
        endDate: "2026-11-03",
        reason: "TEMPORARY_MATTER",
      }),
    });
    assert.equal(approvedRequest.status, "SUBMITTED");
    assert.equal(returnedRequest.status, "SUBMITTED");
    assert.deepEqual(await api("/local/leave-requests", { headers: westOwner }), []);

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
          url.pathname === "/admin/leave-review" &&
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
      .getByRole("link", { name: "请假审核", exact: true })
      .click();
    await page.waitForURL(`${adminOrigin}/admin/leave-review`);
    await page.getByRole("heading", { name: "请假审核" }).waitFor();

    const approvedRow = page.locator(".leave-review-row").filter({ hasText: "2026-11-01" });
    const returnedRow = page.locator(".leave-review-row").filter({ hasText: "2026-11-03" });
    await approvedRow.getByText("待审核", { exact: true }).waitFor();
    await returnedRow.getByText("待审核", { exact: true }).waitFor();
    const approve = approvedRow.getByRole("button", { name: "审核通过" });
    const returnForEdit = returnedRow.getByRole("button", { name: "退回修改" });
    assert.equal(await approve.isDisabled(), true);
    assert.equal(await returnForEdit.isDisabled(), true);

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
    assert.deepEqual(desktop, {
      sidebarLeft: 0,
      sidebarWidth: 264,
      contentLeft: 264,
      pageWidth: 1365,
    });

    await approvedRow
      .getByRole("checkbox", { name: "确认审核 2026-11-01 至 2026-11-01 的请假申请" })
      .check();
    await approve.click();
    await approvedRow.getByText("已通过", { exact: true }).waitFor();
    await returnedRow
      .getByRole("checkbox", { name: "确认审核 2026-11-03 至 2026-11-03 的请假申请" })
      .check();
    await returnForEdit.click();
    await returnedRow.getByText("已退回", { exact: true }).waitFor();

    const parentApproved = await api(`/local/leave-requests/${approvedRequest.id}`, {
      headers: parent,
    });
    const parentReturned = await api(`/local/leave-requests/${returnedRequest.id}`, {
      headers: parent,
    });
    assert.equal(parentApproved.status, "CONFIRMED");
    assert.equal(parentReturned.status, "RETURNED");
    assert.equal(parentApproved.id, approvedRequest.id);
    assert.equal(parentReturned.id, returnedRequest.id);

    const screenshotDir = process.env.NEXT_LEAVE_REVIEW_SCREENSHOT_DIR;
    if (screenshotDir) {
      await mkdir(resolve(screenshotDir), { recursive: true });
      await page.evaluate(() => {
        window.scrollTo(0, 0);
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      });
      await page.screenshot({
        path: resolve(screenshotDir, "desktop.png"),
        fullPage: true,
        animations: "disabled",
      });
    }

    await page.setViewportSize({ width: 390, height: 844 });
    const toggle = page.locator(".nav-toggle");
    assert.equal(await toggle.isVisible(), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390);
    await toggle.click();
    assert.equal(await toggle.getAttribute("aria-expanded"), "true");
    await page.keyboard.press("Escape");
    assert.equal(await toggle.getAttribute("aria-expanded"), "false");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390);
    if (screenshotDir) {
      await page.evaluate(() => {
        window.scrollTo(0, 0);
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      });
      await page.screenshot({
        path: resolve(screenshotDir, "mobile.png"),
        fullPage: true,
        animations: "disabled",
      });
    }

    assert.ok(localRequests.some(({ path }) => path === "/local/leave-requests"));
    assert.ok(localRequests.some(({ path }) => path.endsWith("/review")));
    assert.deepEqual(browserErrors, []);
    assert.deepEqual(failedRequests, []);
    assert.deepEqual(externalRequests, []);
    assert.ok(expectedLocalConnectionCancellations.length <= 1);
    await context.close();
  } finally {
    await browser?.close();
    await runtime.close();
    await assertPortClosed(4319);
    await assertPortClosed(Number(new URL(runtime.ready.admin).port));
  }
});
