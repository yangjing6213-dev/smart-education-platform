/* global Buffer, document, HTMLElement, process, URL, window */

import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { once } from "node:events";
import { createServer } from "node:http";
import { createConnection } from "node:net";
import { resolve } from "node:path";
import test from "node:test";
import { chromium } from "playwright";
import { startNextAdminLocal } from "../../../scripts/start-next-admin-local.mjs";

const SYNTHETIC_TOKEN = "synthetic_invite_token_a1_151_20261019_000000000000";
const NOTICE_TEMPLATES = {
  "11111111-1111-4111-8111-111111111111": {
    id: "11111111-1111-4111-8111-111111111111",
    templateCode: "CLASS_ACTIVITY",
    target: "CLASS",
    status: "SUBMITTED",
    version: 2,
    published: false,
    createdAt: "2026-10-19T08:00:00.000Z",
    updatedAt: "2026-10-19T08:05:00.000Z",
    title: "班级活动",
    body: "班级近期有活动安排，请家长查看并留意相关时间。",
    synthetic: true,
  },
  "22222222-2222-4222-8222-222222222222": {
    id: "22222222-2222-4222-8222-222222222222",
    templateCode: "INSTITUTION_ANNOUNCEMENT",
    target: "INSTITUTION",
    status: "SUBMITTED",
    version: 2,
    published: false,
    createdAt: "2026-10-19T08:10:00.000Z",
    updatedAt: "2026-10-19T08:15:00.000Z",
    title: "机构公告",
    body: "校区发布了新的服务安排，请家长查看页面内更新。",
    synthetic: true,
  },
};

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

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const bytes = Buffer.concat(chunks);
  return bytes.length ? JSON.parse(bytes.toString("utf8")) : {};
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
}

async function startSyntheticInviteApi() {
  const notices = new Map(Object.values(NOTICE_TEMPLATES).map((notice) => [notice.id, { ...notice }]));
  const calls = [];
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const method = request.method ?? "GET";
    calls.push({ method, path: url.pathname });
    try {
      if (method === "POST" && url.pathname === "/identity/login") {
        const body = await readJson(request);
        if (body.username !== "demo-reviewer" || body.password !== "synthetic-password") {
          sendJson(response, 401, { error: { code: "UNAUTHENTICATED" } });
          return;
        }
        sendJson(response, 200, {
          data: {
            access_token: SYNTHETIC_TOKEN,
            token_type: "Bearer",
            expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          },
          request_id: "synthetic-login-request",
        });
        return;
      }

      if (request.headers.authorization !== `Bearer ${SYNTHETIC_TOKEN}`) {
        sendJson(response, 401, { error: { code: "UNAUTHENTICATED" } });
        return;
      }
      if (method === "GET" && url.pathname === "/me") {
        sendJson(response, 200, {
          data: {
            display_name: "合成校区审核员",
            memberships: [
              {
                status: "ACTIVE",
                capabilities: ["identity:read", "notice:review", "notice:publish", "notice:revoke"],
              },
            ],
          },
          request_id: "synthetic-me-request",
        });
        return;
      }
      if (method === "GET" && url.pathname === "/staff/guardian-binding/applications") {
        sendJson(response, 200, { data: [], request_id: "synthetic-binding-request" });
        return;
      }
      if (method === "GET" && url.pathname === "/staff/notices/review") {
        sendJson(response, 200, {
          data: [...notices.values()].filter((notice) =>
            ["SUBMITTED", "APPROVED", "PUBLISHED"].includes(notice.status),
          ),
          request_id: "synthetic-notice-list-request",
        });
        return;
      }

      const match = /^\/staff\/notices\/([0-9a-f-]{36})\/(review|publish|revoke)$/iu.exec(
        url.pathname,
      );
      if (method === "POST" && match) {
        const id = match[1];
        const action = match[2];
        const notice = id ? notices.get(id) : undefined;
        const body = await readJson(request);
        if (!notice || body.version !== notice.version) {
          sendJson(response, 409, { error: { code: "CONFLICT_STATE" } });
          return;
        }
        if (action === "review" && (body.action === "APPROVE" || body.action === "RETURN"))
          notice.status = body.action === "APPROVE" ? "APPROVED" : "RETURNED";
        else if (action === "publish" && notice.status === "APPROVED") {
          notice.status = "PUBLISHED";
          notice.published = true;
        } else if (action === "revoke" && notice.status === "PUBLISHED") {
          notice.status = "REVOKED";
          notice.published = false;
        } else {
          sendJson(response, 400, { error: { code: "VALIDATION_FAILED" } });
          return;
        }
        notice.version += 1;
        notice.updatedAt = new Date().toISOString();
        sendJson(response, 200, {
          data: notice,
          request_id: "synthetic-notice-action-request",
        });
        return;
      }

      sendJson(response, 404, { error: { code: "NOT_FOUND" } });
    } catch {
      sendJson(response, 400, { error: { code: "INVALID_SYNTHETIC_REQUEST" } });
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return {
    origin: `http://127.0.0.1:${address.port}`,
    notices,
    calls,
    close: () => new Promise((resolvePromise, reject) => server.close((error) => error ? reject(error) : resolvePromise())),
  };
}

test("Next admin uses invite login and the same-origin proxy for notice review, publish, return and revoke", async (t) => {
  const upstream = await startSyntheticInviteApi();
  const previousApiOrigin = process.env.ADMIN_WEB_LOCAL_NEST_API;
  process.env.ADMIN_WEB_LOCAL_NEST_API = upstream.origin;
  let runtime;
  let browser;
  const browserErrors = [];
  const failedRequests = [];
  const expectedNavigationCancellations = [];
  const expectedLocalConnectionCancellations = [];
  const expectedUnauthenticatedChecks = [];
  const loginResponseStatuses = [];
  const externalRequests = [];
  let authenticated = false;
  try {
    runtime = await startNextAdminLocal();
    const adminOrigin = new URL(runtime.ready.admin).origin;
    const serviceOrigin = new URL(runtime.ready.service).origin;
    const allowedOrigins = new Set([adminOrigin, serviceOrigin]);
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1365, height: 900 } });
    context.on("page", (page) => {
      page.on("pageerror", (error) => browserErrors.push(`pageerror: ${error.message}`));
      page.on("console", (message) => {
        const location = new URL(message.location().url || "http://127.0.0.1/");
        if (
          !authenticated &&
          location.origin === adminOrigin &&
          location.pathname === "/api/admin/me" &&
          message.text().includes("401 (Unauthorized)")
        )
          return;
        if (message.type() === "error")
          browserErrors.push({ text: message.text(), location: message.location().url });
      });
      page.on("response", (response) => {
        if (new URL(response.url()).pathname === "/api/admin/identity/login")
          loginResponseStatuses.push(response.status());
        if (response.status() !== 401) return;
        const url = new URL(response.url());
        if (!authenticated && url.origin === adminOrigin && url.pathname === "/api/admin/me")
          expectedUnauthenticatedChecks.push(url.pathname);
        else browserErrors.push(`unexpected unauthorized response: ${url.pathname}`);
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
          url.searchParams.has("_rsc") &&
          error === "net::ERR_ABORTED"
        ) {
          expectedNavigationCancellations.push(`${url.pathname}?_rsc (${error})`);
        } else {
          failedRequests.push(`${request.method()} ${request.url()} (${error})`);
        }
      });
    });
    await context.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (!allowedOrigins.has(url.origin)) {
        externalRequests.push(`${url.origin}${url.pathname}`);
        await route.abort("blockedbyclient");
        return;
      }
      await route.continue();
    });

    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    await page.goto(`${adminOrigin}/admin/notice-review`, { waitUntil: "networkidle" });
    await page.getByRole("link", { name: "前往管理端登录" }).click();
    await page.getByRole("heading", { name: "管理端登录" }).waitFor();
    await page.getByLabel("账号").fill("demo-reviewer");
    await page.getByLabel("密码").fill("synthetic-password");
    await page.getByRole("button", { name: "登录" }).click();
    await page.waitForURL(`${adminOrigin}/admin/notice-review`);
    assert.deepEqual(loginResponseStatuses, [200]);

    const cookies = await context.cookies(`${adminOrigin}/api/admin/me`);
    const sessionCookie = cookies.find((cookie) => cookie.name === "student_care_admin_session");
    assert.ok(sessionCookie?.httpOnly);
    assert.equal(sessionCookie?.value, SYNTHETIC_TOKEN);
    assert.equal(
      await page.evaluate(() => document.cookie.includes("student_care_admin_session")),
      false,
    );
    authenticated = true;
    await page.getByRole("heading", { name: "通知审核与发布" }).waitFor();
    await page.getByText("通知列表已更新。", { exact: true }).waitFor();
    assert.equal(
      await page.locator("#admin-navigation .active").getAttribute("href"),
      "/admin/notice-review",
    );

    const queue = page.locator(".notice-review-row");
    const publishRow = queue.filter({ hasText: "班级活动" });
    const returnRow = queue.filter({ hasText: "机构公告" });
    assert.equal(await queue.count(), 2);
    await publishRow.getByRole("heading", { name: "班级活动 · 待审核" }).waitFor();
    await returnRow.getByRole("heading", { name: "机构公告 · 待审核" }).waitFor();
    const initialText = await page.locator("body").innerText();
    assert.equal(initialText.includes(SYNTHETIC_TOKEN), false);
    assert.equal(initialText.includes(NOTICE_TEMPLATES["11111111-1111-4111-8111-111111111111"].id), false);
    assert.equal(initialText.includes(NOTICE_TEMPLATES["22222222-2222-4222-8222-222222222222"].id), false);
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
    const screenshotDir = process.env.NEXT_NOTICE_SCREENSHOT_DIR;
    if (screenshotDir) {
      await page.evaluate(() => {
        window.scrollTo(0, 0);
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      });
      await page.mouse.move(1355, 5);
      await mkdir(resolve(screenshotDir), { recursive: true });
      await page.screenshot({ path: resolve(screenshotDir, "desktop.png"), fullPage: true });
    }

    await page.locator(".notice-review-confirm input").check();
    await publishRow.getByRole("button", { name: "审核通过" }).click();
    await publishRow.getByRole("heading", { name: "班级活动 · 已审核，待发布" }).waitFor();
    await publishRow.getByRole("button", { name: "发布给家长" }).waitFor();
    await page.locator(".notice-review-confirm input").check();
    await publishRow.getByRole("button", { name: "发布给家长" }).click();
    await publishRow.getByRole("heading", { name: "班级活动 · 已发布" }).waitFor();
    await publishRow.getByRole("button", { name: "撤回发布" }).waitFor();
    await page.locator(".notice-review-confirm input").check();
    await publishRow.getByRole("button", { name: "撤回发布" }).click();
    await page.getByText("通知已撤回。", { exact: true }).waitFor();
    assert.equal(await queue.count(), 1);

    await page.locator(".notice-review-confirm input").check();
    await returnRow.getByRole("button", { name: "退回修改" }).click();
    await page.getByText("通知已退回，提交人可修改后重新提交。", { exact: true }).waitFor();
    assert.equal(await queue.count(), 0);
    assert.equal(upstream.notices.get("11111111-1111-4111-8111-111111111111")?.status, "REVOKED");
    assert.equal(upstream.notices.get("22222222-2222-4222-8222-222222222222")?.status, "RETURNED");
    assert.deepEqual(
      upstream.calls.filter(({ path }) => path.startsWith("/staff/notices/")).map(({ method, path }) => [method, path]),
      [
        ["GET", "/staff/notices/review"],
        ["POST", "/staff/notices/11111111-1111-4111-8111-111111111111/review"],
        ["GET", "/staff/notices/review"],
        ["POST", "/staff/notices/11111111-1111-4111-8111-111111111111/publish"],
        ["GET", "/staff/notices/review"],
        ["POST", "/staff/notices/11111111-1111-4111-8111-111111111111/revoke"],
        ["GET", "/staff/notices/review"],
        ["POST", "/staff/notices/22222222-2222-4222-8222-222222222222/review"],
        ["GET", "/staff/notices/review"],
      ],
    );

    await page.setViewportSize({ width: 390, height: 844 });
    const mobileToggle = page.locator(".nav-toggle");
    await page.waitForFunction(
      () => document.querySelector(".admin-sidebar").getBoundingClientRect().right <= 0,
    );
    assert.equal(await mobileToggle.isVisible(), true);
    await mobileToggle.click();
    assert.equal(await mobileToggle.getAttribute("aria-expanded"), "true");
    await page.waitForFunction(
      () => Math.abs(document.querySelector(".admin-sidebar").getBoundingClientRect().left) < 0.5,
    );
    assert.equal(await page.locator("#admin-navigation").isVisible(), true);
    await page.keyboard.press("Escape");
    assert.equal(await mobileToggle.getAttribute("aria-expanded"), "false");
    await page.waitForFunction(
      () => document.querySelector(".admin-sidebar").getBoundingClientRect().right <= 0,
    );
    const hiddenNavigation = await page.locator("#admin-navigation").boundingBox();
    assert.ok(hiddenNavigation && hiddenNavigation.x + hiddenNavigation.width <= 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390);

    t.diagnostic(
      JSON.stringify({
        browserErrors,
        failedRequests,
        externalRequests,
        expectedUnauthenticatedChecks: expectedUnauthenticatedChecks.length,
        expectedNavigationCancellations: expectedNavigationCancellations.length,
        expectedLocalConnectionCancellations: expectedLocalConnectionCancellations.length,
      }),
    );
    assert.deepEqual(browserErrors, []);
    assert.deepEqual(failedRequests, []);
    assert.deepEqual(externalRequests, []);
    assert.ok(expectedUnauthenticatedChecks.length >= 1);
    assert.ok(expectedNavigationCancellations.length <= 2);
    t.diagnostic(
      JSON.stringify({
        desktopSidebarLeft: desktop.sidebarLeft,
        desktopSidebarWidth: desktop.sidebarWidth,
        desktopContentLeft: desktop.contentLeft,
        desktopPageWidth: desktop.pageWidth,
        browserErrors: browserErrors.length,
        unexpectedFailedRequests: failedRequests.length,
        externalRequests: externalRequests.length,
        expectedLocalNavigationCancellations: expectedNavigationCancellations.length,
      }),
    );
  } finally {
    await browser?.close();
    await runtime?.close();
    await upstream.close();
    if (previousApiOrigin === undefined) delete process.env.ADMIN_WEB_LOCAL_NEST_API;
    else process.env.ADMIN_WEB_LOCAL_NEST_API = previousApiOrigin;
    await assertPortClosed(4319);
    if (runtime) await assertPortClosed(Number(new URL(runtime.ready.admin).port));
  }
});
