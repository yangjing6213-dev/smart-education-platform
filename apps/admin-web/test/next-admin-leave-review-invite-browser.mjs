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
const TENANT = "00000000-0000-4000-8000-000000000064";
const EAST = "00000000-0000-4000-8000-000000000065";
const WEST = "00000000-0000-4000-8000-000000000066";
const STUDENT = "00000000-0000-4000-8000-0000000000c8";
const PARENT_ACTOR = "00000000-0000-4000-8000-000000000001";
const EAST_STAFF_ACTOR = "00000000-0000-4000-8000-000000000004";
const WEST_STAFF_ACTOR = "00000000-0000-4000-8000-000000000005";

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

async function jsonRequest(origin, path, { token, body } = {}) {
  const response = await fetch(new URL(path, origin), {
    method: body === undefined ? "GET" : "POST",
    headers: {
      accept: "application/json",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    redirect: "error",
  });
  const payload = await response.json();
  assert.ok(response.ok, `${path}: ${response.status} ${JSON.stringify(payload.error ?? {})}`);
  return payload.data;
}

async function invitedLogin(origin, username, password) {
  return jsonRequest(origin, "/identity/login", { body: { username, password } }).then(
    (result) => result.access_token,
  );
}

test("Admin leave review uses invited campus identity and parents read the same result", async () => {
  const [
    { buildLocalSyntheticServer },
    { createApiApp },
    { createInvitePasswordHash, InviteAuthService },
  ] = await Promise.all([
    importApi("src/local-synthetic/server.js"),
    importApi("src/nest/api-app.js"),
    importApi("src/nest/invite-auth.service.js"),
  ]);

  const parentPassword = randomBytes(24).toString("base64url");
  const eastPassword = randomBytes(24).toString("base64url");
  const westPassword = randomBytes(24).toString("base64url");
  const parentUsername = "parent-leave-demo";
  const eastUsername = "east-leave-reviewer";
  const westUsername = "west-leave-reviewer";
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
          capabilities: ["identity:read", "memberships:read", "binding:read", "leave:apply", "leave:read"],
        },
      ],
    },
    {
      username: eastUsername,
      password_hash: await createInvitePasswordHash(eastPassword),
      identity: { actor_id: EAST_STAFF_ACTOR, display_name: "示例东校区审核员" },
      memberships: [
        {
          tenant_id: TENANT,
          campus_ids: [EAST],
          status: "ACTIVE",
          capabilities: ["identity:read", "memberships:read", "leave:review"],
        },
      ],
    },
    {
      username: westUsername,
      password_hash: await createInvitePasswordHash(westPassword),
      identity: { actor_id: WEST_STAFF_ACTOR, display_name: "示例西校区审核员" },
      memberships: [
        {
          tenant_id: TENANT,
          campus_ids: [WEST],
          status: "ACTIVE",
          capabilities: ["identity:read", "memberships:read", "leave:review"],
        },
      ],
    },
  ]);

  const local = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  let api;
  let runtime;
  let browser;
  let apiPort;
  const priorApiOrigin = process.env.ADMIN_WEB_LOCAL_NEST_API;
  const priorNextDistDir = process.env.TASK20_NEXT_DIST_DIR;
  const browserErrors = [];
  const failedRequests = [];
  const externalRequests = [];
  const legacyRequests = [];

  try {
    const parentSession = await local.inject({
      method: "POST",
      url: "/local/sessions",
      payload: { profile: "parent-alpha" },
    });
    assert.equal(parentSession.statusCode, 201);
    const eastSession = await local.inject({
      method: "POST",
      url: "/local/sessions",
      payload: { profile: "owner-east" },
    });
    assert.equal(eastSession.statusCode, 201);
    const application = await local.inject({
      method: "POST",
      url: "/local/binding-applications",
      headers: { authorization: `Bearer ${parentSession.json().handle}` },
      payload: { student: "student-alpha", relationship: "GUARDIAN" },
    });
    assert.equal(application.statusCode, 201);
    const binding = await local.inject({
      method: "POST",
      url: `/local/binding-applications/${application.json().id}/review`,
      headers: { authorization: `Bearer ${eastSession.json().handle}` },
      payload: { version: application.json().version, action: "approve" },
    });
    assert.equal(binding.statusCode, 200);
    assert.equal(binding.json().status, "APPROVED");

    api = await createApiApp({ inviteAuthService, leaveOperations: local.leaveOperations });
    await api.listen(0, "127.0.0.1");
    const address = api.getHttpServer().address();
    assert.ok(address && typeof address === "object");
    apiPort = address.port;
    const apiOrigin = `http://127.0.0.1:${address.port}`;
    process.env.ADMIN_WEB_LOCAL_NEST_API = apiOrigin;
    process.env.TASK20_NEXT_DIST_DIR = ".next-task20-a1-133";

    const parentToken = await invitedLogin(apiOrigin, parentUsername, parentPassword);
    const created = await jsonRequest(apiOrigin, "/parent/leave-requests", {
      token: parentToken,
      body: {
        student_id: STUDENT,
        start_date: "2026-11-05",
        end_date: "2026-11-05",
        reason_category: "FAMILY_ARRANGEMENT",
      },
    });
    assert.equal(created.status, "SUBMITTED");

    const westToken = await invitedLogin(apiOrigin, westUsername, westPassword);
    const westQueue = await jsonRequest(apiOrigin, "/staff/leave-requests", { token: westToken });
    assert.deepEqual(westQueue, [], "a different campus must not see this request");

    runtime = await startNextAdminLocal();
    const adminOrigin = new URL(runtime.ready.admin).origin;
    const allowedOrigins = new Set([adminOrigin]);

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
      if (url.pathname.startsWith("/local/")) legacyRequests.push(url.pathname);
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
    await page.goto(`${adminOrigin}/admin/login?next=%2Fadmin%2Fleave-review`, {
      waitUntil: "networkidle",
    });
    await page.locator("#admin-login-username").fill(eastUsername);
    await page.locator("#admin-login-password").fill(eastPassword);
    await page.getByRole("button", { name: "登录", exact: true }).click();
    await page.waitForURL(`${adminOrigin}/admin/leave-review`);
    await page.getByRole("heading", { name: "请假审核" }).waitFor();

    const row = page.locator(`[data-leave-review-row="${created.id}"]`);
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
    assert.deepEqual(desktop, {
      sidebarLeft: 0,
      sidebarWidth: 264,
      contentLeft: 264,
      pageWidth: 1365,
    });

    await row.getByRole("checkbox", { name: "确认审核 2026-11-05 至 2026-11-05 的请假申请" }).check();
    await row.getByRole("button", { name: "审核通过" }).click();
    await row.waitFor({ state: "detached" });
    await page.getByText("审核结果已提交，待审核列表已更新。", { exact: true }).waitFor();

    const parentRows = await jsonRequest(apiOrigin, "/parent/leave-requests", { token: parentToken });
    const parentView = parentRows.find((item) => item.id === created.id);
    assert.ok(parentView);
    assert.equal(parentView.status, "CONFIRMED");

    const screenshotDir = process.env.TASK20_A1_133_SCREENSHOT_DIR;
    if (screenshotDir) {
      await mkdir(resolve(screenshotDir), { recursive: true });
      await page.evaluate(() => {
        window.scrollTo(0, 0);
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      });
      await page.screenshot({
        path: resolve(screenshotDir, "leave-review-desktop.png"),
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
        path: resolve(screenshotDir, "leave-review-mobile.png"),
        fullPage: true,
        animations: "disabled",
      });
    }

    assert.deepEqual(legacyRequests, [], "邀请审核页不得调用旧固定角色接口。");
    assert.deepEqual(browserErrors, []);
    assert.deepEqual(failedRequests, []);
    assert.deepEqual(externalRequests, []);
    await context.close();
  } finally {
    await browser?.close();
    await runtime?.close();
    await api?.close();
    await local.close();
    if (priorApiOrigin === undefined) delete process.env.ADMIN_WEB_LOCAL_NEST_API;
    else process.env.ADMIN_WEB_LOCAL_NEST_API = priorApiOrigin;
    if (priorNextDistDir === undefined) delete process.env.TASK20_NEXT_DIST_DIR;
    else process.env.TASK20_NEXT_DIST_DIR = priorNextDistDir;
    if (runtime) await assertPortClosed(Number(new URL(runtime.ready.admin).port));
    if (apiPort) await assertPortClosed(apiPort);
  }
});
