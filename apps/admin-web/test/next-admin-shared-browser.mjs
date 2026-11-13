/* global document, fetch, process, URL */

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, mkdir } from "node:fs/promises";
import { createServer } from "node:net";
import { resolve } from "node:path";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { startNextAdminLocal } from "../../../scripts/start-next-admin-local.mjs";

const userRoot = fileURLToPath(new URL("../../user-web/", import.meta.url));
const serviceOrigin = "http://127.0.0.1:4319";

async function stopChild(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  child.kill();
  await Promise.race([
    new Promise((resolvePromise) => child.once("exit", resolvePromise)),
    delay(4000),
  ]);
  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGKILL");
    await Promise.race([
      new Promise((resolvePromise) => child.once("exit", resolvePromise)),
      delay(2000),
    ]);
  }
  assert.ok(child.exitCode !== null || child.signalCode !== null, "家长预览进程未退出。");
}

test("Next admin and parent complete binding review through the real local service", async (t) => {
  let parentProcess;
  let runtime;
  let browser;
  let parentOrigin;
  let parentStartupError;
  let parentOutput = "";
  const browserErrors = [];
  const failedRequests = [];
  const externalRequests = [];
  const adminApiRequests = [];
  const parentApiRequests = [];

  try {
    await access(resolve(userRoot, "dist/index.html"));
    parentProcess = spawn(process.execPath, ["preview.mjs", "--local-service-port", "4319"], {
      cwd: userRoot,
      env: { ...process.env, TASK20_G44A_WEB_DIST_ROOT: "dist" },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    parentProcess.once("error", (error) => {
      parentStartupError = error;
    });
    parentProcess.stdout.on("data", (chunk) => {
      parentOutput += chunk.toString();
      const lines = parentOutput.split("\n");
      parentOutput = lines.pop() ?? "";
      for (const line of lines) {
        try {
          const event = JSON.parse(line);
          if (event.event === "startup") parentOrigin = event.baseUrl;
        } catch {
          // Only the preview's structured startup event supplies its address.
        }
      }
    });
    parentProcess.stderr.resume();
    for (let attempt = 0; attempt < 100 && !parentOrigin; attempt += 1) {
      if (parentStartupError) throw parentStartupError;
      assert.equal(parentProcess.exitCode, null, "家长预览在启动完成前退出。");
      await delay(100);
    }
    assert.ok(parentOrigin, "家长预览未返回本机地址。");
    assert.equal(new URL(parentOrigin).hostname, "127.0.0.1");
    assert.notEqual(new URL(parentOrigin).port, "4317");

    runtime = await startNextAdminLocal({ parentOrigin });
    assert.equal(runtime.ready.service, serviceOrigin);
    const adminOrigin = new URL(runtime.ready.admin).origin;
    assert.equal(new URL(adminOrigin).hostname, "127.0.0.1");
    const allowedOrigins = new Set([adminOrigin, parentOrigin, serviceOrigin]);

    async function apiRequest(pathname, init = {}) {
      const response = await fetch(new URL(pathname, serviceOrigin), {
        ...init,
        headers: {
          Accept: "application/json",
          Origin: adminOrigin,
          ...(init.body ? { "Content-Type": "application/json" } : {}),
          ...init.headers,
        },
        redirect: "error",
      });
      return { status: response.status, body: await response.json() };
    }

    async function api(pathname, init = {}) {
      const result = await apiRequest(pathname, init);
      assert.ok(result.status >= 200 && result.status < 300, `${pathname}: ${result.status}`);
      return result.body;
    }

    async function session(profile) {
      const created = await api("/local/sessions", {
        method: "POST",
        body: JSON.stringify({ profile }),
      });
      assert.equal(typeof created.handle, "string");
      return { Authorization: `Bearer ${created.handle}` };
    }

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
      page.on("pageerror", (error) =>
        browserErrors.push({ kind: "pageerror", message: error.message }),
      );
      page.on("console", (message) => {
        if (message.type() === "error")
          browserErrors.push({ kind: "console", message: message.text() });
      });
      page.on("requestfailed", (request) => {
        failedRequests.push({ url: request.url(), error: request.failure()?.errorText });
      });
    });
    const parentPage = await context.newPage();
    const adminPage = await context.newPage();
    parentPage.on("request", (request) => {
      const url = new URL(request.url());
      if (url.pathname.startsWith("/local/")) parentApiRequests.push(url.origin);
    });
    adminPage.on("request", (request) => {
      const url = new URL(request.url());
      if (url.pathname.startsWith("/local/")) adminApiRequests.push(url.origin);
    });

    await parentPage.goto(`${parentOrigin}/web/parent/binding`, { waitUntil: "networkidle" });
    await parentPage.getByRole("heading", { name: "查看与管理授权" }).waitFor();
    await parentPage.getByRole("button", { name: "提交模拟关系申请", exact: true }).click();
    await parentPage.getByRole("heading", { name: "关系申请已提交" }).waitFor();

    const alphaHeaders = await session("parent-alpha");
    const alphaRows = await api("/local/binding-applications", { headers: alphaHeaders });
    const alphaApplication = alphaRows.find((row) => row.studentAlias === "student-alpha");
    assert.ok(alphaApplication);
    assert.equal(alphaApplication.status, "PENDING");
    const betaHeaders = await session("parent-beta");
    const betaApplication = await api("/local/binding-applications", {
      method: "POST",
      headers: betaHeaders,
      body: JSON.stringify({ student: "student-beta", relationship: "GUARDIAN" }),
    });
    assert.equal(betaApplication.status, "PENDING");

    await adminPage.goto(`${adminOrigin}/admin/institution`, { waitUntil: "networkidle" });
    await adminPage
      .locator("#admin-navigation")
      .getByRole("link", { name: "家长关系审核" })
      .click();
    await adminPage.waitForURL(`${adminOrigin}/admin/binding-review`);
    await adminPage.getByRole("heading", { name: "家长关系审核" }).waitFor();
    const alphaRow = adminPage.locator(".binding-review-row").filter({ hasText: "示例学生甲" });
    const betaRow = adminPage.locator(".binding-review-row").filter({ hasText: "示例学生乙" });
    await alphaRow.getByText("示例学生甲 · 待审核", { exact: true }).waitFor();
    await betaRow.getByText("示例学生乙 · 待审核", { exact: true }).waitFor();
    assert.equal(new URL(adminPage.url()).search, "");
    assert.equal(await adminPage.locator("[data-binding-review-confirm]").isChecked(), false);
    for (const row of [alphaRow, betaRow]) {
      assert.equal(await row.getByRole("button", { name: "确认关系" }).isDisabled(), true);
      assert.equal(await row.getByRole("button", { name: "拒绝申请" }).isDisabled(), true);
    }

    const desktop = await adminPage.evaluate(() => {
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
    const screenshotDir = process.env.NEXT_SHARED_SCREENSHOT_DIR;
    if (screenshotDir) {
      await mkdir(resolve(screenshotDir), { recursive: true });
      await adminPage.screenshot({ path: resolve(screenshotDir, "desktop.png"), fullPage: true });
    }
    await adminPage.setViewportSize({ width: 390, height: 844 });
    const mobileToggle = adminPage.locator(".nav-toggle");
    assert.equal(await mobileToggle.isVisible(), true);
    await adminPage.waitForFunction(
      () => document.querySelector(".admin-sidebar").getBoundingClientRect().right <= 0,
    );
    await mobileToggle.click();
    assert.equal(await mobileToggle.getAttribute("aria-expanded"), "true");
    await adminPage.waitForFunction(
      () => Math.abs(document.querySelector(".admin-sidebar").getBoundingClientRect().left) < 0.5,
    );
    assert.equal(await adminPage.locator("#admin-navigation").isVisible(), true);
    await adminPage.keyboard.press("Escape");
    assert.equal(await mobileToggle.getAttribute("aria-expanded"), "false");
    await adminPage.waitForFunction(
      () => document.querySelector(".admin-sidebar").getBoundingClientRect().right <= 0,
    );
    const hiddenNavigation = await adminPage.locator("#admin-navigation").boundingBox();
    assert.ok(hiddenNavigation && hiddenNavigation.x + hiddenNavigation.width <= 0);
    assert.equal(await adminPage.evaluate(() => document.documentElement.scrollWidth), 390);
    if (screenshotDir)
      await adminPage.screenshot({
        path: resolve(screenshotDir, "mobile.png"),
        fullPage: true,
        animations: "disabled",
      });
    await adminPage.setViewportSize({ width: 1365, height: 900 });

    const requestsBeforeLegacyPort = adminApiRequests.length;
    await adminPage.goto(`${adminOrigin}/admin/binding-review?localServicePort=4317`, {
      waitUntil: "networkidle",
    });
    await alphaRow.getByText("示例学生甲 · 待审核", { exact: true }).waitFor();
    await betaRow.getByText("示例学生乙 · 待审核", { exact: true }).waitFor();
    assert.equal(new URL(adminPage.url()).searchParams.get("localServicePort"), "4317");
    assert.ok(adminApiRequests.length > requestsBeforeLegacyPort);
    assert.equal(
      adminApiRequests.slice(requestsBeforeLegacyPort).every((origin) => origin === serviceOrigin),
      true,
    );
    assert.deepEqual(externalRequests, []);

    await adminPage.locator("#binding-review-profile").selectOption("owner-west");
    await adminPage.getByText("当前校区没有可查看的家长关系申请。", { exact: true }).waitFor();
    assert.equal(await adminPage.locator(".binding-review-row").count(), 0);
    assert.equal(await adminPage.getByText("示例学生甲", { exact: false }).count(), 0);
    assert.equal(await adminPage.getByText("示例学生乙", { exact: false }).count(), 0);
    const westHeaders = await session("owner-west");
    assert.deepEqual(await api("/local/binding-applications", { headers: westHeaders }), []);
    const forbiddenReview = await apiRequest(
      `/local/binding-applications/${alphaApplication.id}/review`,
      {
        method: "POST",
        headers: westHeaders,
        body: JSON.stringify({ version: alphaApplication.version, action: "approve" }),
      },
    );
    assert.equal(forbiddenReview.status, 403);
    assert.equal(forbiddenReview.body.error?.code, "UNAVAILABLE");
    const forbiddenOrigin = await apiRequest("/local/sessions", {
      method: "POST",
      headers: { Origin: "http://127.0.0.1:1" },
      body: JSON.stringify({ profile: "owner-east" }),
    });
    assert.equal(forbiddenOrigin.status, 403);

    await adminPage.locator("#binding-review-profile").selectOption("owner-east");
    await alphaRow.getByText("示例学生甲 · 待审核", { exact: true }).waitFor();
    assert.equal(await adminPage.locator("[data-binding-review-confirm]").isChecked(), false);
    await adminPage.locator("[data-binding-review-confirm]").check();
    await alphaRow.getByRole("button", { name: "确认关系" }).click();
    await adminPage.getByText("关系已在本机合成记录中确认。", { exact: true }).waitFor();
    await alphaRow.getByText("示例学生甲 · 已确认", { exact: true }).waitFor();
    await parentPage.reload({ waitUntil: "networkidle" });
    await parentPage.getByRole("heading", { name: "监护关系已确认" }).waitFor();
    const approvedRows = await api("/local/binding-applications", { headers: alphaHeaders });
    assert.equal(approvedRows.find((row) => row.id === alphaApplication.id)?.status, "APPROVED");

    await adminPage.locator("[data-binding-review-confirm]").check();
    await betaRow.getByRole("button", { name: "拒绝申请" }).click();
    await adminPage.getByText("申请已在本机合成记录中拒绝。", { exact: true }).waitFor();
    await betaRow.getByText("示例学生乙 · 已拒绝", { exact: true }).waitFor();
    const rejectedRows = await api("/local/binding-applications", { headers: betaHeaders });
    assert.equal(rejectedRows.find((row) => row.id === betaApplication.id)?.status, "REJECTED");

    assert.ok(parentApiRequests.length > 0);
    assert.equal(
      parentApiRequests.every((origin) => origin === parentOrigin),
      true,
    );
    assert.ok(adminApiRequests.length > 0);
    assert.equal(
      adminApiRequests.every((origin) => origin === serviceOrigin),
      true,
    );
    const unexpectedFailures = failedRequests.filter(({ url, error }) => {
      const requestUrl = new URL(url);
      return !(
        error === "net::ERR_ABORTED" &&
        requestUrl.origin === adminOrigin &&
        requestUrl.searchParams.has("_rsc")
      );
    });
    assert.deepEqual(browserErrors, []);
    assert.deepEqual(unexpectedFailures, []);
    assert.deepEqual(externalRequests, []);
    t.diagnostic(
      JSON.stringify({
        parentSubmittedAndRefreshed: true,
        approved: true,
        rejected: true,
        confirmationRequired: true,
        westCampusIsolated: true,
        forbiddenOriginDenied: true,
        defaultServicePort: 4319,
        legacyPortQueryUsesLauncherService: true,
        desktopWidth: 1365,
        mobileWidth: 390,
        browserErrors: browserErrors.length,
        unexpectedFailedRequests: unexpectedFailures.length,
        externalRequests: externalRequests.length,
      }),
    );
  } finally {
    let runtimeCloseError;
    try {
      await runtime?.close();
    } catch (error) {
      runtimeCloseError = error;
    }
    const closed = await Promise.allSettled([browser?.close(), stopChild(parentProcess)]);
    for (const result of closed) {
      assert.equal(result.status, "fulfilled", "本次浏览器或本机服务未能关闭。");
    }
    assert.equal(runtimeCloseError, undefined, "浏览器保持打开时，Next 或 API 未能关闭。");
    if (runtime) {
      const probe = createServer();
      await new Promise((resolvePromise, rejectPromise) => {
        probe.once("error", rejectPromise);
        probe.listen(4319, "127.0.0.1", resolvePromise);
      });
      await new Promise((resolvePromise, rejectPromise) => {
        probe.close((error) => (error ? rejectPromise(error) : resolvePromise()));
      });
      t.diagnostic("本次浏览器、家长预览、Next 与 API 已关闭；4319 已释放。");
    }
  }
});
