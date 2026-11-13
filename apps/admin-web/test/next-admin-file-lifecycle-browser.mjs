/* global document, process, URL */

import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { chromium } from "playwright";
import { startNextAdminLocal } from "../../../scripts/start-next-admin-local.mjs";

const evidenceRoot =
  process.env.TASK20_A160_EVIDENCE_DIR ??
  resolve(
    process.cwd(),
    "../../artifacts/task20-a1-60-next-admin-file-lifecycle-20261016",
  );
const allowedReads = new Set([
  "POST /local/sessions",
  "GET /local/session",
  "GET /local/media-assets",
  "GET /local/media-asset-events",
  "GET /local/media-asset-summary",
]);
const uuidRoute =
  /^POST \/local\/media-assets\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/(?:access-check|replace-reference|archive|revoke|delete)$/iu;

test("Next admin files keep scoped lifecycle actions local and responsive", async () => {
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
      if (url.origin === serviceOrigin)
        serviceRequests.push(`${route.request().method()} ${url.pathname}`);
      await route.continue();
    });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    page.on("pageerror", (error) =>
      browserErrors.push(`pageerror: ${error.message}`),
    );
    page.on("console", (message) => {
      if (message.type() === "error")
        browserErrors.push(`console: ${message.text()}`);
    });
    page.on("requestfailed", (request) => {
      failedRequests.push(
        `${request.url()} (${request.failure()?.errorText ?? "unknown"})`,
      );
    });

    await page.goto(`${adminOrigin}/admin/institution`, {
      waitUntil: "networkidle",
    });
    await page
      .locator("#admin-navigation")
      .getByRole("link", { name: "文件", exact: true })
      .click();
    await page.waitForURL(`${adminOrigin}/admin/files`);
    const panel = page.locator("[data-media-assets]");
    try {
      await page.locator('[data-media-assets-state="READY"]').waitFor();
    } catch {
      throw new Error(
        `File panel state: ${await panel.getAttribute("data-media-assets-state")}; ${await panel.innerText()}; failed: ${JSON.stringify(failedRequests)}; browser: ${JSON.stringify(browserErrors)}`,
      );
    }
    assert.equal(
      await page
        .getByRole("heading", { name: "文件与引用管理", level: 1 })
        .count(),
      1,
    );
    assert.equal(await page.locator("[data-media-asset-title]").count(), 8);
    assert.match(await panel.innerText(), /教师介绍占位图/u);
    assert.match(await panel.innerText(), /负责人只看到当前校区/u);
    assert.doesNotMatch(
      await panel.innerText(),
      /西校区活动占位图|其他机构活动占位图|objectKey|downloadUrl|signedUrl|filePath|bytes|[0-9a-f]{8}-[0-9a-f-]{27}/iu,
    );
    assert.doesNotMatch(await panel.innerHTML(), /[0-9a-f]{8}-[0-9a-f-]{27}/iu);

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

    const teacherImage = page.locator(
      '[data-media-asset-title="教师介绍占位图"]',
    );
    await teacherImage
      .getByLabel("替换教师介绍引用")
      .selectOption("activity-cover-placeholder");
    await teacherImage.getByRole("button", { name: "替换这处引用" }).click();
    await page
      .getByText("引用已更换，旧素材保留；没有写入真实文件。", { exact: true })
      .waitFor();
    assert.match(await teacherImage.innerText(), /暂无引用/u);

    await page
      .locator('[data-media-asset-title="活动封面占位图"]')
      .getByRole("button", { name: "校验查看权限" })
      .click();
    await page
      .getByText("本机合成权限校验通过；没有读取或下载真实文件。", {
        exact: true,
      })
      .waitFor();
    await teacherImage.getByRole("button", { name: "归档" }).click();
    await page
      .getByText("素材已在本机归档。没有删除真实文件。", { exact: true })
      .waitFor();
    assert.match(await teacherImage.innerText(), /已归档/u);
    await teacherImage.getByRole("button", { name: "标记为软删除" }).click();
    await page
      .getByText("素材已标记为本机软删除；没有删除实际文件。", { exact: true })
      .waitFor();
    assert.match(await teacherImage.innerText(), /本机软删除/u);

    const familyGuide = page.locator(
      '[data-media-asset-title="家长指南占位文档"]',
    );
    await familyGuide.getByLabel("确认撤回会影响仍引用此素材的页面").check();
    await familyGuide.getByRole("button", { name: "撤回素材" }).click();
    await page
      .getByText("素材已撤回；已保留引用记录并记录本机审计。", { exact: true })
      .waitFor();
    assert.match(await familyGuide.innerText(), /已撤回/u);

    await page.getByLabel("本机演示身份").selectOption("platform-admin");
    await page.locator('[data-media-assets-state="READY"]').waitFor();
    assert.equal(await page.locator("[data-media-asset-title]").count(), 0);
    assert.equal(
      await page.getByRole("heading", { name: "匿名汇总", level: 2 }).count(),
      1,
    );
    assert.match(
      await page.locator("[data-media-anonymous-summary]").innerText(),
      /合成素材总数/u,
    );
    assert.doesNotMatch(
      await panel.innerText(),
      /教师介绍占位图|家长指南占位文档|活动封面占位图/u,
    );

    await page.getByLabel("本机演示身份").selectOption("teacher-east");
    await page.locator('[data-media-assets-state="DENIED"]').waitFor();
    assert.equal(await page.locator("[data-media-asset-title]").count(), 0);

    await page.getByLabel("本机演示身份").selectOption("owner-east");
    await page.locator('[data-media-assets-state="READY"]').waitFor();
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth),
        width,
      );
      const toggle = page.locator(".nav-toggle");
      if ((await toggle.getAttribute("aria-expanded")) !== "true")
        await toggle.click();
      assert.equal(await toggle.getAttribute("aria-expanded"), "true");
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
      await page.screenshot({
        path: resolve(
          evidenceRoot,
          "screenshots",
          width === 390 ? "mobile-390.png" : "mobile-320.png",
        ),
        fullPage: true,
      });
    }

    await page.goto(`${adminOrigin}/admin/files?mode=readonly`, {
      waitUntil: "networkidle",
    });
    await page.locator('[data-media-assets-state="READY"]').waitFor();
    for (const control of await page
      .locator("[data-media-assets] button[data-media-action]")
      .all())
      assert.equal(await control.isDisabled(), true);

    assert.ok(serviceRequests.length > 0);
    assert.equal(
      serviceRequests.every(
        (request) => allowedReads.has(request) || uuidRoute.test(request),
      ),
      true,
      JSON.stringify(serviceRequests),
    );
    assert.deepEqual(failedRequests, []);
    assert.deepEqual(browserErrors, []);
    assert.deepEqual(externalRequests, []);
  } finally {
    await browser?.close();
    await runtime.close();
  }
});
