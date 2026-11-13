/* global document, fetch, HTMLElement, process, URL, window */

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { createConnection } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";
import { chromium } from "playwright";
import { startNextAdminLocal } from "../../../scripts/start-next-admin-local.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const apiOutput = resolve(root, "apps/api/.dist-task20-a1-132");
const EAST = "00000000-0000-4000-8000-000000000065";
const TENANT = "00000000-0000-4000-8000-000000000064";
const PARENT_ACTOR = "00000000-0000-4000-8000-000000000001";
const STAFF_ACTOR = "00000000-0000-4000-8000-000000000004";
const HEALTH_CAPABILITIES = [
  "identity:read",
  "memberships:read",
  "binding:review",
  "health:review",
  "health:supplement",
  "health:publish",
  "health:revoke",
];

async function importApi(path) {
  return import(pathToFileURL(resolve(apiOutput, path)).href);
}

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

async function invitedLogin(apiOrigin, username, password) {
  const response = await fetch(`${apiOrigin}/identity/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const payload = await response.json();
  assert.ok(response.ok, `invite login failed: ${response.status}`);
  assert.equal(typeof payload.data.access_token, "string");
  return payload.data.access_token;
}

async function requestParentHealth(apiOrigin, token) {
  const response = await fetch(`${apiOrigin}/parent/health-incidents`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const payload = await response.json();
  assert.ok(response.ok, `parent health read failed: ${response.status}`);
  return payload.data;
}

test("Admin health review uses invited identity and only publishes a fixed parent summary", async () => {
  const [{ buildLocalSyntheticServer }, { createApiApp }, { createInvitePasswordHash, InviteAuthService }] =
    await Promise.all([
      importApi("src/local-synthetic/server.js"),
      importApi("src/nest/api-app.js"),
      importApi("src/nest/invite-auth.service.js"),
    ]);
  const parentPassword = randomBytes(24).toString("base64url");
  const staffPassword = randomBytes(24).toString("base64url");
  const parentUsername = "parent-health-demo";
  const staffUsername = "health-reviewer-demo";
  const inviteAuthService = new InviteAuthService([
    {
      username: parentUsername,
      password_hash: await createInvitePasswordHash(parentPassword),
      identity: { actor_id: PARENT_ACTOR, display_name: "示例监护人甲" },
      memberships: [
        {
          tenant_id: TENANT,
          campus_ids: [EAST],
          status: "ACTIVE",
          capabilities: ["identity:read", "memberships:read", "binding:read"],
        },
      ],
    },
    {
      username: staffUsername,
      password_hash: await createInvitePasswordHash(staffPassword),
      identity: { actor_id: STAFF_ACTOR, display_name: "示例校区审核员" },
      memberships: [
        {
          tenant_id: TENANT,
          campus_ids: [EAST],
          status: "ACTIVE",
          capabilities: HEALTH_CAPABILITIES,
        },
      ],
    },
  ]);
  const local = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  let api;
  let runtime;
  let browser;
  const priorApiOrigin = process.env.ADMIN_WEB_LOCAL_NEST_API;
  const priorNextDistDir = process.env.TASK20_NEXT_DIST_DIR;
  let apiPort;
  const browserErrors = [];
  const failedRequests = [];
  const externalRequests = [];
  const localRequests = [];
  try {
    api = await createApiApp({
      inviteAuthService,
      parentGovernanceOperations: local.parentGovernanceOperations,
      staffHealthIncidentReviewOperations: local.staffHealthIncidentReviewOperations,
    });
    await api.listen(0, "127.0.0.1");
    const address = api.getHttpServer().address();
    assert.ok(address && typeof address === "object");
    apiPort = address.port;
    const apiOrigin = `http://127.0.0.1:${address.port}`;
    process.env.ADMIN_WEB_LOCAL_NEST_API = apiOrigin;
    process.env.TASK20_NEXT_DIST_DIR = ".next-task20-a1-132";
    runtime = await startNextAdminLocal();
    const adminOrigin = new URL(runtime.ready.admin).origin;
    const serviceOrigin = "http://127.0.0.1:4319";
    const allowedOrigins = new Set([adminOrigin, serviceOrigin]);

    async function localCall(path, { profile, body } = {}) {
      let authorization;
      if (profile) {
        const created = await local.inject({
          method: "POST",
          url: "/local/sessions",
          payload: { profile },
        });
        assert.equal(created.statusCode, 201);
        authorization = `Bearer ${created.json().handle}`;
        if (path === "/local/sessions" && body === undefined) return created.json();
      }
      const response = await local.inject({
        method: body === undefined ? "GET" : "POST",
        url: path,
        ...(authorization ? { headers: { authorization } } : {}),
        ...(body === undefined ? {} : { payload: body }),
      });
      assert.ok(
        response.statusCode >= 200 && response.statusCode < 300,
        `${path}: ${response.statusCode} ${response.body}`,
      );
      return response.json();
    }

    const application = await localCall("/local/binding-applications", {
      profile: "parent-alpha",
      body: { student: "student-alpha", relationship: "GUARDIAN" },
    });
    assert.equal(application.status, "PENDING");
    const owner = await localCall("/local/sessions", { profile: "owner-east" });
    const bindingReview = await local.inject({
      method: "POST",
      url: `/local/binding-applications/${application.id}/review`,
      headers: { authorization: `Bearer ${owner.handle}` },
      payload: { version: application.version, action: "approve" },
    });
    assert.equal(bindingReview.json().status, "APPROVED");
    const draft = await localCall("/local/health-incidents", {
      profile: "teacher-east",
      body: {
        student: "student-alpha",
        observationCode: "NEEDS_FOLLOW_UP",
        dispositionCode: "FOLLOW_UP_SCHEDULED",
      },
    });
    assert.equal(draft.status, "DRAFT");
    const submitted = await local.inject({
      method: "POST",
      url: `/local/health-incidents/${draft.id}/submit`,
      headers: {
        authorization: `Bearer ${(await localCall("/local/sessions", { profile: "teacher-east" })).handle}`,
      },
      payload: { version: draft.version },
    });
    assert.equal(submitted.json().status, "SUBMITTED");

    const parentToken = await invitedLogin(apiOrigin, parentUsername, parentPassword);
    assert.deepEqual(await requestParentHealth(apiOrigin, parentToken), []);

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
        localRequests.push(url.pathname);
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
          url.pathname === "/admin/health-incident-review" &&
          url.searchParams.has("_rsc") &&
          error === "net::ERR_ABORTED"
        )
          return;
        failedRequests.push(`${request.url()} (${error})`);
      });
    });

    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    await page.goto(`${adminOrigin}/admin/login?next=/admin/health-incident-review`, {
      waitUntil: "networkidle",
    });
    await page.locator("#admin-login-username").fill(staffUsername);
    await page.locator("#admin-login-password").fill(staffPassword);
    await page.getByRole("button", { name: "登录", exact: true }).click();
    await page.waitForURL(`${adminOrigin}/admin/health-incident-review`);
    await page.getByRole("heading", { name: "健康异常审核与发布" }).waitFor();

    const row = page.locator(`[data-health-incident-row="${draft.id}"]`);
    await row.waitFor();
    await row.getByText("待审核", { exact: true }).waitFor();
    assert.equal(await row.getByRole("button", { name: "审核通过" }).isDisabled(), true);

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
    assert.equal(desktop.contentLeft, 264);
    assert.equal(desktop.pageWidth, 1365);

    const confirm = page.locator(".health-incident-review .pickup-review-confirm input");
    await confirm.check();
    await row.getByRole("button", { name: "审核通过" }).click();
    await row.getByText("已审核", { exact: true }).waitFor();
    await confirm.check();
    await row.locator(`[data-health-incident-disposition="${draft.id}"]`).selectOption("GUARDIAN_SUMMARY_PREPARED");
    await row.getByRole("button", { name: "更新固定处置项" }).click();
    await row.getByText("固定处置项：已准备家长摘要", { exact: true }).waitFor();
    await confirm.check();
    await row.locator(`[data-health-incident-summary="${draft.id}"]`).selectOption("FOLLOW_UP_IN_PROGRESS");
    await row.getByRole("button", { name: "发布家长摘要" }).click();
    await row.getByText("已发布", { exact: true }).waitFor();

    assert.deepEqual(await requestParentHealth(apiOrigin, parentToken).then((rows) => rows.length), 1);
    assert.equal(await requestParentHealth(apiOrigin, parentToken).then((rows) => rows[0].status), "PUBLISHED");
    assert.equal(await requestParentHealth(apiOrigin, parentToken).then((rows) => rows[0].tenantId), undefined);

    const screenshotDir = process.env.NEXT_HEALTH_INCIDENT_SCREENSHOT_DIR;
    if (screenshotDir) {
      await mkdir(resolve(screenshotDir), { recursive: true });
      await page.evaluate(() => {
        window.scrollTo(0, 0);
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      });
      await page.screenshot({ path: resolve(screenshotDir, "desktop.png"), fullPage: true, animations: "disabled" });
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
      await page.screenshot({ path: resolve(screenshotDir, "mobile.png"), fullPage: true, animations: "disabled" });
    }

    assert.deepEqual(localRequests, [], "健康审核页面必须通过邀请会话代理，而不是旧固定角色接口。");
    assert.deepEqual(browserErrors, []);
    assert.deepEqual(failedRequests, []);
    assert.deepEqual(externalRequests, []);
  } finally {
    await browser?.close();
    await runtime?.close();
    await api?.close();
    await local.close();
    if (priorApiOrigin === undefined) delete process.env.ADMIN_WEB_LOCAL_NEST_API;
    else process.env.ADMIN_WEB_LOCAL_NEST_API = priorApiOrigin;
    if (priorNextDistDir === undefined) delete process.env.TASK20_NEXT_DIST_DIR;
    else process.env.TASK20_NEXT_DIST_DIR = priorNextDistDir;
    if (runtime) {
      await assertPortClosed(Number(new URL(runtime.ready.admin).port));
      await assertPortClosed(4319);
    }
    if (apiPort) await assertPortClosed(apiPort);
  }
});
