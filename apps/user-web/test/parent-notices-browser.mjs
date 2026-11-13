/* global AbortSignal, URL, fetch, localStorage, sessionStorage */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createInterface } from "node:readline";
import { fileURLToPath, pathToFileURL } from "node:url";
import process from "node:process";
import test from "node:test";
import { chromium } from "playwright";

const serverModulePath = process.env.TASK20_LOCAL_SYNTHETIC_SERVER_MODULE;
assert.ok(
  serverModulePath,
  "TASK20_LOCAL_SYNTHETIC_SERVER_MODULE must point to the local API build",
);
const { buildLocalSyntheticServer } = await import(pathToFileURL(serverModulePath).href);

async function startPreview(script, servicePort) {
  const child = spawn(process.execPath, [script, "--local-service-port", String(servicePort)], {
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  const lines = createInterface({ input: child.stdout });
  const [line] = await once(lines, "line", {
    signal: AbortSignal.timeout(10000),
  });
  lines.close();
  const startup = JSON.parse(line);
  assert.equal(startup.event, "startup");
  return { child, baseUrl: startup.baseUrl };
}

async function stopPreview(child) {
  if (child.exitCode !== null) return;
  const exited = once(child, "exit");
  child.kill();
  await exited;
}

test("家长可在网页首页阅读并确认已发布通知", async (t) => {
  const service = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  const serviceUrl = await service.start(0);
  let preview;
  let browser;
  try {
    preview = await startPreview(
      fileURLToPath(new URL("../preview.mjs", import.meta.url)),
      Number(new URL(serviceUrl).port),
    );
    const api = async (handle, method, path, body) => {
      const response = await fetch(new URL(path, serviceUrl), {
        method,
        headers: {
          ...(handle ? { Authorization: `Bearer ${handle}` } : {}),
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const payload = await response.json();
      assert.ok(response.ok, `${method} ${path}: ${response.status} ${JSON.stringify(payload)}`);
      return payload;
    };
    const session = async (profile) =>
      (await api("", "POST", "/local/sessions", { profile })).handle;
    const parentHandle = await session("parent-alpha");
    const teacherHandle = await session("teacher-east");
    const ownerHandle = await session("owner-east");
    const application = await api(parentHandle, "POST", "/local/binding-applications", {
      student: "student-alpha",
      relationship: "GUARDIAN",
    });
    const binding = await api(
      ownerHandle,
      "POST",
      `/local/binding-applications/${application.id}/review`,
      { version: application.version, action: "approve" },
    );
    assert.equal(binding.status, "APPROVED");

    const notice = await api(teacherHandle, "POST", "/local/notices", {
      template: "CLASS_ACTIVITY",
    });
    const submitted = await api(teacherHandle, "POST", `/local/notices/${notice.id}/submit`, {
      version: notice.version,
    });
    const confirmed = await api(ownerHandle, "POST", `/local/notices/${notice.id}/review`, {
      version: submitted.version,
      action: "CONFIRM",
    });
    const published = await api(ownerHandle, "POST", `/local/notices/${notice.id}/publish`, {
      version: confirmed.version,
    });

    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
    });
    page.setDefaultTimeout(10000);
    const origin = new URL(preview.baseUrl).origin;
    const pageErrors = [];
    const consoleErrors = [];
    const failedRequests = [];
    const externalRequests = [];
    const serviceErrors = [];
    const unexpectedLoopbackRequests = [];
    const forwardedRequests = new Set([
      "POST /local/sessions",
      "GET /local/session",
      "GET /local/binding-applications",
      "GET /local/health-incidents",
      "GET /local/monthly-feedback-parent",
      "GET /local/fees",
      "GET /local/fee-ledger",
    ]);
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("requestfailed", (request) =>
      failedRequests.push(`${request.url()} ${request.failure()?.errorText}`),
    );
    await page.route("**/*", async (route) => {
      const requestUrl = new URL(route.request().url());
      if (requestUrl.origin === origin) return route.continue();
      if (requestUrl.origin === "http://127.0.0.1:4317") {
        const request = route.request();
        const requestKey = `${request.method()} ${requestUrl.pathname}`;
        if (requestUrl.search || !forwardedRequests.has(requestKey)) {
          unexpectedLoopbackRequests.push(`${requestKey}${requestUrl.search}`);
          return route.abort();
        }
        const corsHeaders = {
          "access-control-allow-origin": origin,
          "access-control-allow-headers": "authorization,content-type,accept",
          "access-control-allow-methods": "GET,POST,PATCH,OPTIONS",
        };
        if (request.method() === "OPTIONS")
          return route.fulfill({ status: 204, headers: corsHeaders });
        const headers = request.headers();
        const upstream = await fetch(
          new URL(`${requestUrl.pathname}${requestUrl.search}`, serviceUrl),
          {
            method: request.method(),
            headers: {
              ...(headers.authorization ? { authorization: headers.authorization } : {}),
              ...(headers.accept ? { accept: headers.accept } : {}),
              ...(headers["content-type"] ? { "content-type": headers["content-type"] } : {}),
            },
            ...(request.method() === "GET" || request.method() === "HEAD"
              ? {}
              : { body: request.postDataBuffer() ?? undefined }),
          },
        );
        if (upstream.status >= 400)
          serviceErrors.push(`${upstream.status} ${request.method()} ${requestUrl.pathname}`);
        return route.fulfill({
          status: upstream.status,
          headers: {
            ...corsHeaders,
            "content-type": upstream.headers.get("content-type") ?? "application/json",
          },
          body: await upstream.text(),
        });
      }
      externalRequests.push(requestUrl.href);
      return route.abort();
    });
    page.on("response", (response) => {
      if (new URL(response.url()).origin === origin && response.status() >= 400)
        serviceErrors.push(`${response.status()} ${response.url()}`);
    });

    await page.goto(`${preview.baseUrl}/web/parent/home`);
    const panel = page.locator("[data-parent-notices-panel]");
    try {
      await panel.waitFor();
    } catch (error) {
      throw new Error(
        `${error.message}\npageErrors=${JSON.stringify(pageErrors)}\nconsoleErrors=${JSON.stringify(consoleErrors)}\nfailedRequests=${JSON.stringify(failedRequests)}\nbody=${(await page.locator("body").innerText()).slice(0, 1000)}`,
      );
    }
    const card = panel.locator(`article.parent-notice-card[data-parent-notice-id="${notice.id}"]`);
    await card.waitFor();
    assert.equal(await card.locator(".parent-notice-receipt").textContent(), "未阅读");
    assert.equal(await card.locator('[data-parent-notice-action="ack"]').count(), 0);
    await card.locator('[data-parent-notice-action="read"]').click();
    await card.locator('[data-parent-notice-action="ack"]').waitFor();
    assert.equal(
      await card.locator(".parent-notice-receipt").textContent(),
      "已阅读，等待确认知悉",
    );
    await card.locator('[data-parent-notice-action="ack"]').click();
    await card.getByText("已确认知悉").waitFor();
    assert.equal(
      await panel
        .locator("[data-parent-notices-status]")
        .evaluate((status) => status === document.activeElement),
      true,
      "receipt actions return keyboard focus to the live status message",
    );

    await page.reload();
    const persistedCard = page.locator(
      `article.parent-notice-card[data-parent-notice-id="${notice.id}"]`,
    );
    await persistedCard.getByText("已确认知悉").waitFor();
    const republished = await api(ownerHandle, "POST", `/local/notices/${notice.id}/publish`, {
      version: published.version,
    });
    await page.locator("[data-parent-notices-refresh]").click();
    const refreshedCard = page.locator(
      `article.parent-notice-card[data-parent-notice-id="${notice.id}"]`,
    );
    await refreshedCard.locator('[data-parent-notice-action="read"]').waitFor();
    assert.equal(await refreshedCard.locator(".parent-notice-receipt").textContent(), "未阅读");
    assert.ok(Number(republished.version) > Number(published.version));

    await page.setViewportSize({ width: 1280, height: 900 });
    const desktopOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    if (process.env.TASK20_PARENT_NOTICES_DESKTOP_SCREENSHOT)
      await panel.screenshot({
        path: process.env.TASK20_PARENT_NOTICES_DESKTOP_SCREENSHOT,
      });
    await page.setViewportSize({ width: 390, height: 844 });
    const mobileOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    if (process.env.TASK20_PARENT_NOTICES_MOBILE_SCREENSHOT)
      await panel.screenshot({
        path: process.env.TASK20_PARENT_NOTICES_MOBILE_SCREENSHOT,
      });
    const storage = await page.evaluate(() => ({
      local: localStorage.length,
      session: sessionStorage.length,
    }));

    assert.equal(desktopOverflow, false);
    assert.equal(mobileOverflow, false);
    assert.deepEqual(storage, { local: 0, session: 0 });
    assert.deepEqual(pageErrors, []);
    assert.deepEqual(consoleErrors, []);
    assert.deepEqual(failedRequests, []);
    assert.deepEqual(externalRequests, []);
    assert.deepEqual(unexpectedLoopbackRequests, []);
    assert.deepEqual(serviceErrors, []);
  } finally {
    await browser?.close();
    if (preview) await stopPreview(preview.child);
    await service.close();
  }
});
