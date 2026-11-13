/* global document, process, URL */

import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { chromium } from "playwright";
import { startNextAdminLocal } from "../../../scripts/start-next-admin-local.mjs";

const evidenceRoot =
  process.env.TASK20_A159_EVIDENCE_DIR ??
  resolve(
    process.cwd(),
    "../../artifacts/task20-a1-59-next-admin-learning-safety-20261016",
  );

const allowedLearningSafetyRequests = new Set([
  "POST /local/sessions",
  "GET /local/session",
  "GET /local/learning-safety-summary",
]);

test("Next admin learning safety stays anonymous, fail-closed, and responsive", async () => {
  const runtime = await startNextAdminLocal();
  let browser;
  let denySession = false;
  let deniedSessionAttempts = 0;
  const browserErrors = [];
  const externalRequests = [];
  const failedRequests = [];
  const serviceRequests = [];

  try {
    const adminOrigin = new URL(runtime.ready.admin).origin;
    const serviceOrigin = new URL(runtime.ready.service).origin;
    const allowedOrigins = new Set([adminOrigin, serviceOrigin]);
    browser = await chromium.launch({
      headless: true,
      ...(process.env.ADMIN_WEB_BROWSER
        ? { executablePath: process.env.ADMIN_WEB_BROWSER }
        : {}),
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
      if (url.origin === serviceOrigin) {
        const method = route.request().method();
        serviceRequests.push(`${method} ${url.pathname}`);
        if (
          denySession &&
          method === "POST" &&
          url.pathname === "/local/sessions"
        ) {
          deniedSessionAttempts += 1;
          await route.fulfill({
            status: 403,
            contentType: "application/json",
            body: JSON.stringify({ error: { code: "FORBIDDEN" } }),
          });
          return;
        }
      }
      await route.continue();
    });

    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    page.on("pageerror", (error) =>
      browserErrors.push(`pageerror: ${error.message}`),
    );
    page.on("console", (message) => {
      if (message.type() === "error")
        browserErrors.push({
          text: message.text(),
          location: message.location(),
        });
    });
    page.on("requestfailed", (request) => {
      failedRequests.push({
        url: request.url(),
        error: request.failure()?.errorText ?? "unknown",
      });
    });

    await page.goto(`${adminOrigin}/admin/institution`, {
      waitUntil: "networkidle",
    });
    await page
      .locator("#admin-navigation")
      .getByRole("link", { name: "学习安全汇总", exact: true })
      .click();
    await page.waitForURL(`${adminOrigin}/admin/learning-safety`);
    await page.locator('[data-learning-safety-state="READY"]').waitFor();

    const panel = page.locator("[data-learning-safety]");
    assert.equal(
      await page
        .getByRole("heading", { name: "学习安全汇总", level: 1 })
        .count(),
      1,
    );
    assert.equal(
      await panel.locator("[data-learning-safety-metric]").count(),
      20,
    );
    assert.match(await panel.innerText(), /匿名安全汇总/u);
    assert.match(await panel.innerText(), /指标口径：V2（本机合成数据）/u);
    assert.match(await panel.innerText(), /提示后继续作答率/u);
    assert.match(await panel.innerText(), /暂无样本/u);
    assert.doesNotMatch(
      await panel.innerText(),
      /学生姓名|手机号|身份证号|studentId|sessionId|teacherId|tenantId|campusId|[0-9a-f]{8}-[0-9a-f-]{27}/iu,
    );

    const desktopLayout = await page.evaluate(() => {
      const sidebar = document
        .querySelector(".admin-sidebar")
        .getBoundingClientRect();
      const main = document
        .querySelector(".admin-main")
        .getBoundingClientRect();
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

    await page.getByRole("button", { name: "刷新汇总", exact: true }).click();
    await page.locator('[data-learning-safety-state="READY"]').waitFor();
    assert.equal(
      await panel.locator("[data-learning-safety-metric]").count(),
      20,
    );

    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth),
        width,
      );
      const toggle = page.locator(".nav-toggle");
      assert.equal(await toggle.isVisible(), true);
      if ((await toggle.getAttribute("aria-expanded")) !== "true")
        await toggle.click();
      assert.equal(await toggle.getAttribute("aria-expanded"), "true");
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth),
        width,
      );
      await page.keyboard.press("Escape");
      assert.equal(await toggle.getAttribute("aria-expanded"), "false");
      await page.waitForFunction(
        () =>
          document.querySelector(".admin-sidebar").getBoundingClientRect()
            .right <= 0,
      );
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth),
        width,
      );
      const filename = width === 390 ? "mobile-390.png" : "mobile-320.png";
      await page.screenshot({
        path: resolve(evidenceRoot, "screenshots", filename),
        fullPage: true,
      });
    }

    denySession = true;
    await page.setViewportSize({ width: 1365, height: 900 });
    await page.goto(`${adminOrigin}/admin/learning-safety`, {
      waitUntil: "networkidle",
    });
    await page.locator('[data-learning-safety-state="DENIED"]').waitFor();
    assert.equal(
      await page.locator("[data-learning-safety-metric]").count(),
      0,
    );
    assert.match(
      await page.locator("[data-learning-safety-status]").innerText(),
      /403|无权|拒绝/u,
    );

    assert.ok(serviceRequests.length > 0);
    assert.equal(
      serviceRequests.every((request) =>
        allowedLearningSafetyRequests.has(request),
      ),
      true,
    );
    const unexpectedFailures = failedRequests.filter(({ url, error }) => {
      const requestUrl = new URL(url);
      return !(
        error === "net::ERR_ABORTED" &&
        requestUrl.origin === serviceOrigin &&
        requestUrl.pathname === "/local/sessions"
      );
    });
    const expectedDenialErrors = browserErrors.filter(
      ({ text, location }) =>
        denySession &&
        text ===
          "Failed to load resource: the server responded with a status of 403 (Forbidden)" &&
        location.url === `${serviceOrigin}/local/sessions`,
    );
    const unexpectedBrowserErrors = browserErrors.filter(
      (error) => !expectedDenialErrors.includes(error),
    );
    assert.deepEqual(unexpectedFailures, []);
    assert.deepEqual(unexpectedBrowserErrors, []);
    assert.ok(deniedSessionAttempts >= 1 && deniedSessionAttempts <= 2);
    assert.equal(expectedDenialErrors.length, deniedSessionAttempts);
    assert.deepEqual(externalRequests, []);
  } finally {
    await browser?.close();
    await runtime.close();
  }
});
