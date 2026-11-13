/* global document, innerWidth, process, URL */

import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createConnection } from "node:net";
import { resolve } from "node:path";
import test from "node:test";
import { chromium } from "playwright";
import { startNextAdminLocal } from "../../../scripts/start-next-admin-local.mjs";

const serviceOrigin = "http://127.0.0.1:4319";
const evidenceRoot =
  process.env.TASK20_A158_EVIDENCE_DIR ??
  resolve(process.cwd(), "../../artifacts/task20-a1-58-next-admin-platform-operations-20261016");

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

test("Next admin platform operations remain synthetic, anonymous, and responsive", async () => {
  const runtime = await startNextAdminLocal();
  let browser;
  const browserErrors = [];
  const failedRequests = [];
  const externalRequests = [];
  const localRequests = [];
  try {
    const adminOrigin = new URL(runtime.ready.admin).origin;
    const allowedOrigins = new Set([adminOrigin, serviceOrigin]);
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
    page.setDefaultTimeout(12000);
    page.on("pageerror", (error) => browserErrors.push(`pageerror: ${error.message}`));
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(`console: ${message.text()}`);
    });
    page.on("requestfailed", (request) => {
      const url = new URL(request.url());
      const error = request.failure()?.errorText ?? "unknown";
      if (
        error === "net::ERR_ABORTED" &&
        ((url.origin === serviceOrigin && url.pathname === "/local/sessions") ||
          (url.origin === adminOrigin && url.searchParams.has("_rsc")))
      )
        return;
      failedRequests.push(`${request.url()} (${error})`);
    });

    await page.goto(`${adminOrigin}/admin/institution`, { waitUntil: "networkidle" });
    await page
      .locator("#admin-navigation")
      .getByRole("link", { name: "平台运营", exact: true })
      .click();
    await page.waitForURL(`${adminOrigin}/admin/platform-operations`);
    assert.equal(
      await page.locator('#admin-navigation [aria-current="page"]').innerText(),
      "平台运营",
      "当前路由应在左侧导航中明确标识。",
    );
    const initialText = await page.locator("body").innerText();
    assert.ok(
      initialText.includes("匿名运营汇总"),
      `专页未显示；页面内容：${initialText.slice(0, 1000)}；浏览器错误：${JSON.stringify(browserErrors)}`,
    );
    assert.equal(await page.getByRole("heading", { name: "平台运营", level: 1 }).count(), 1);
    await page.locator('[data-platform-fee-status="READY"]').waitFor();
    assert.match(await page.locator("body").innerText(), /成本估算/u);
    assert.match(await page.locator("body").innerText(), /安全汇总/u);
    assert.match(await page.locator("body").innerText(), /费用资料：\d+ 项/u);
    assert.match(await page.locator("body").innerText(), /费用流水：\d+ 笔/u);
    assert.match(await page.locator("body").innerText(), /工作材料：\d+ 项/u);
    assert.match(await page.locator("body").innerText(), /资格：\d+ 项/u);
    assert.match(await page.locator("body").innerText(), /招聘跟进：\d+ 项/u);
    assert.match(await page.locator("body").innerText(), /模拟机构一号/u);
    assert.match(await page.locator("body").innerText(), /支持事项 1/u);
    assert.doesNotMatch(
      await page.locator("body").innerText(),
      /tenant-synthetic|support-synthetic|synthetic-staff|PRIVATE_|学生姓名|手机号|身份证号/u,
    );

    const desktopLayout = await page.evaluate(() => {
      const sidebar = document.querySelector(".admin-sidebar").getBoundingClientRect();
      const main = document.querySelector(".admin-main").getBoundingClientRect();
      return { sidebarRight: sidebar.right, mainLeft: main.left, width: innerWidth };
    });
    assert.ok(desktopLayout.mainLeft >= desktopLayout.sidebarRight);
    await mkdir(resolve(evidenceRoot, "screenshots"), { recursive: true });
    await page.screenshot({
      path: resolve(evidenceRoot, "screenshots/desktop.png"),
      fullPage: true,
    });

    const tenant = page.locator('[data-tenant-index="0"]');
    await tenant.locator('select[name="status"]').selectOption("SUSPENDED");
    await tenant.locator('select[name="plan"]').selectOption("EXPANDED");
    await tenant.getByRole("button", { name: "保存租户设置" }).click();
    assert.match(await tenant.innerText(), /已停用/u);
    assert.match(await tenant.innerText(), /扩展版/u);
    assert.match(await tenant.innerText(), /60 个员工席位 · 300 GB 文件空间/u);

    const supportCase = page.locator('[data-support-index="0"]');
    await supportCase.locator('select[name="status"]').selectOption("IN_PROGRESS");
    await supportCase.getByRole("button", { name: "更新处理阶段" }).click();
    assert.match(await supportCase.innerText(), /处理中/u);

    await page.reload({ waitUntil: "networkidle" });
    const resetTenant = page.locator('[data-tenant-index="0"]');
    assert.match(await resetTenant.innerText(), /已启用/u);
    assert.match(await resetTenant.innerText(), /标准版/u);
    assert.match(await page.locator('[data-support-index="0"]').innerText(), /待处理/u);

    await page.goto(`${adminOrigin}/admin/platform-operations?mode=readonly`, {
      waitUntil: "networkidle",
    });
    const readOnlyControls = page.locator(
      '[data-platform-operations] select, [data-platform-operations] button[type="submit"]',
    );
    assert.ok((await readOnlyControls.count()) > 0);
    for (const control of await readOnlyControls.all())
      assert.equal(await control.isDisabled(), true);

    await page.goto(`${adminOrigin}/admin/platform-operations?mode=denied`, {
      waitUntil: "networkidle",
    });
    const deniedText = await page.locator("body").innerText();
    assert.match(deniedText, /没有查看权限/u);
    assert.doesNotMatch(deniedText, /模拟机构一号|成本估算|支持事项 1/u);

    await page.goto(`${adminOrigin}/admin/platform-operations`, { waitUntil: "networkidle" });
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      const toggle = page.locator(".nav-toggle");
      if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
      assert.equal(
        await page.getByRole("button", { name: "关闭菜单" }).getAttribute("aria-expanded"),
        "true",
      );
      const dimensions = await page.evaluate(() => ({
        viewport: innerWidth,
        document: document.documentElement.scrollWidth,
      }));
      assert.ok(
        dimensions.document <= dimensions.viewport,
        `横向溢出：${JSON.stringify(dimensions)}`,
      );
      await page.screenshot({
        path: resolve(evidenceRoot, `screenshots/mobile-${width}.png`),
        fullPage: true,
      });
    }

    assert.deepEqual(browserErrors, []);
    assert.deepEqual(failedRequests, []);
    assert.deepEqual(externalRequests, []);
    assert.ok(localRequests.length > 0);
    assert.ok(
      localRequests.every(
        ({ method, path }) =>
          (method === "GET" &&
            ["/local/fee-summary", "/local/fee-ledger-summary"].includes(path)) ||
          (method === "POST" && path === "/local/sessions") ||
          (method === "GET" && path === "/local/session"),
      ),
      `存在未授权的本机请求：${JSON.stringify(localRequests)}`,
    );
  } finally {
    await browser?.close();
    await runtime.close();
    await assertPortClosed(4319);
  }
});
