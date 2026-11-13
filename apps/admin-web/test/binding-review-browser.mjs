/* global fetch, process, URL */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distRoot = path.join(appRoot, "dist");
const userDistRoot = process.env.USER_WEB_DIST_ROOT
  ? path.resolve(process.env.USER_WEB_DIST_ROOT)
  : null;
const apiServerModulePath = process.env.LOCAL_SYNTHETIC_API_SERVER_MODULE;
const adminPort = Number(process.env.ADMIN_PORT ?? 1724);
const apiPort = 4319;
const apiBase = `http://127.0.0.1:${apiPort}`;
assert.ok(apiServerModulePath, "LOCAL_SYNTHETIC_API_SERVER_MODULE is required.");
assert.ok(userDistRoot, "USER_WEB_DIST_ROOT is required for parent flow checks.");
assert.equal(Number.isInteger(adminPort) && adminPort > 0 && adminPort <= 65535, true);
assert.ok(adminPort !== 4317 && adminPort !== apiPort);
const apiModule = await import(pathToFileURL(path.resolve(apiServerModulePath)).href);
assert.equal(typeof apiModule.buildLocalSyntheticServer, "function");
const localApi = await apiModule.buildLocalSyntheticServer({
  mode: "local-synthetic",
  allowedOrigins: [`http://127.0.0.1:${adminPort}`],
});

const server = createServer(async (request, response) => {
  const pathname = new URL(request.url ?? "/", `http://127.0.0.1:${adminPort}`).pathname;
  try {
    if (pathname === "/" || (pathname.startsWith("/admin/") && !pathname.includes("/dist/"))) {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(await readFile(path.join(appRoot, "index.html")));
      return;
    }
    if (
      pathname === "/web/parent/binding" ||
      pathname === "/web/parent/learning" ||
      pathname === "/main.js" ||
      pathname.startsWith("/routes/") ||
      pathname.startsWith("/local-synthetic/") ||
      pathname.startsWith("/styles/") ||
      pathname.startsWith("/assets/") ||
      pathname.startsWith("/pages/")
    ) {
      if (pathname === "/web/parent/binding" || pathname === "/web/parent/learning") {
        response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        response.end(await readFile(path.join(userDistRoot, "index.html")));
        return;
      }
      const file = path.resolve(userDistRoot, `.${pathname}`);
      if (!file.startsWith(`${userDistRoot}${path.sep}`)) {
        response.writeHead(400);
        response.end();
        return;
      }
      await stat(file);
      const type = file.endsWith(".js")
        ? "text/javascript; charset=utf-8"
        : file.endsWith(".css")
          ? "text/css; charset=utf-8"
          : "application/octet-stream";
      response.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" });
      response.end(await readFile(file));
      return;
    }
    if (!pathname.includes("/dist/")) {
      response.writeHead(404);
      response.end();
      return;
    }
    const relative = pathname.slice(pathname.lastIndexOf("/dist/") + "/dist/".length);
    const file = path.resolve(distRoot, relative);
    if (!file.startsWith(`${distRoot}${path.sep}`)) {
      response.writeHead(400);
      response.end();
      return;
    }
    await stat(file);
    const type = file.endsWith(".js")
      ? "text/javascript; charset=utf-8"
      : "application/octet-stream";
    response.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" });
    response.end(await readFile(file));
  } catch {
    response.writeHead(404);
    response.end();
  }
});

async function apiRequest(pathname, init = {}) {
  const response = await fetch(new URL(pathname, apiBase), {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
    cache: "no-store",
    redirect: "error",
  });
  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error(`Invalid local service response for ${pathname}`);
  }
  return { response, body };
}

async function api(pathname, init = {}) {
  const { response, body } = await apiRequest(pathname, init);
  assert.equal(response.ok, true, `${pathname} returned ${response.status}`);
  return body;
}

async function createSession(profile, action) {
  const created = await api("/local/sessions", {
    method: "POST",
    body: JSON.stringify({ profile }),
  });
  assert.equal(typeof created.handle, "string");
  const session = await api("/local/session", {
    headers: { Authorization: `Bearer ${created.handle}` },
  });
  assert.equal(session.profile, profile);
  assert.ok(session.actions.includes(action));
  return created.handle;
}

async function submitParentApplication(handle, student) {
  const row = await api("/local/binding-applications", {
    method: "POST",
    headers: { Authorization: `Bearer ${handle}` },
    body: JSON.stringify({ student, relationship: "GUARDIAN" }),
  });
  return row;
}

async function parentStatus(handle, expectedId) {
  const rows = await api("/local/binding-applications", {
    headers: { Authorization: `Bearer ${handle}` },
  });
  return rows.find((row) => row.id === expectedId)?.status;
}

const browserErrors = [];
const externalRequests = [];
let browser;
let eastApplication;
let secondApplication;
let parentAlphaHandle;
let parentBetaHandle;
let ownerWestHandle;
let rewritesToDisposableService = 0;
let apiStarted = false;

try {
  await new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(apiPort, "127.0.0.1", () => probe.close(resolve));
  });
  await localApi.start(apiPort);
  apiStarted = true;
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(adminPort, "127.0.0.1", resolve);
  });
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
  await page.route(/^http:\/\/127\.0\.0\.1:\d+\/local\//u, async (route) => {
    const requestUrl = new URL(route.request().url());
    if (page.url().includes("/web/parent/") && requestUrl.port === String(adminPort)) {
      rewritesToDisposableService += 1;
      await route.continue({
        url: requestUrl.href.replace(":" + adminPort, ":" + apiPort),
      });
      return;
    }
    await route.continue();
  });
  await page.route(/^http:\/\/(?:127\.0\.0\.1|localhost):4317\//u, async (route) => {
    rewritesToDisposableService += 1;
    await route.continue({ url: route.request().url().replace(":4317", `:${apiPort}`) });
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("request", (request) => {
    const origin = new URL(request.url()).origin;
    if (
      origin !== `http://127.0.0.1:${adminPort}` &&
      origin !== apiBase &&
      origin !== "http://127.0.0.1:4317" &&
      origin !== "http://localhost:4317"
    )
      externalRequests.push(request.url());
  });

  const parentRoute = `http://127.0.0.1:${adminPort}/web/parent/binding`;
  await page.goto(parentRoute, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "查看与管理授权" }).waitFor();
  await page.getByRole("button", { name: "提交模拟关系申请" }).click();
  await page.getByRole("heading", { name: "关系申请已提交" }).waitFor();
  parentAlphaHandle = await createSession("parent-alpha", "binding:apply");
  const alphaRows = await api("/local/binding-applications", {
    headers: { Authorization: `Bearer ${parentAlphaHandle}` },
  });
  eastApplication = alphaRows.find((row) => row.studentAlias === "student-alpha");
  assert.ok(eastApplication);
  assert.equal(eastApplication.status, "PENDING");

  parentBetaHandle = await createSession("parent-beta", "binding:apply");
  secondApplication = await submitParentApplication(parentBetaHandle, "student-beta");
  ownerWestHandle = await createSession("owner-west", "binding:review");
  const westRows = await api("/local/binding-applications", {
    headers: { Authorization: `Bearer ${ownerWestHandle}` },
  });
  assert.deepEqual(westRows, []);
  const route = `http://127.0.0.1:${adminPort}/admin/binding-review?profile=owner-east&localServicePort=${apiPort}`;
  await page.goto(route.replace("owner-east", "owner-west"), { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "家长关系审核" }).waitFor();
  await page.getByText("当前校区没有可查看的家长关系申请。", { exact: true }).waitFor();
  assert.equal(await page.locator(".binding-review-row").count(), 0);
  if (process.env.G6_BINDING_SCREENSHOT_DIR) {
    await page.screenshot({
      path: path.join(
        process.env.G6_BINDING_SCREENSHOT_DIR,
        "admin-binding-west-pending-empty.png",
      ),
      fullPage: true,
    });
  }
  const crossCampusReview = await apiRequest(
    `/local/binding-applications/${eastApplication.id}/review`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${ownerWestHandle}` },
      body: JSON.stringify({ version: eastApplication.version, action: "approve" }),
    },
  );
  assert.equal(crossCampusReview.response.status, 403);
  assert.equal(crossCampusReview.body.error?.code, "UNAVAILABLE");

  await page.goto(route, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "家长关系审核" }).waitFor();
  await page.getByText("示例学生甲 · 待审核").waitFor();
  await page.locator("[data-binding-review-confirm]").check();
  const first = page.locator(".binding-review-row").filter({ hasText: "示例学生甲" });
  await first.getByRole("button", { name: "确认关系" }).click();
  await page.getByText("关系已在本机合成记录中确认。", { exact: true }).waitFor();
  const reviewDetails = await first.innerText();
  assert.match(reviewDetails, /本机模拟审核角色/u);
  assert.match(reviewDetails, /关系已确认/u);
  assert.match(reviewDetails, /2026\/10\/\d{2}/u);
  assert.doesNotMatch(reviewDetails, /11111111|22222222|33333333/u);
  assert.equal(await parentStatus(parentAlphaHandle, eastApplication.id), "APPROVED");
  await api("/local/consents", {
    method: "POST",
    headers: { Authorization: `Bearer ${parentAlphaHandle}` },
    body: JSON.stringify({
      bindingId: eastApplication.id,
      purposeKey: "LEARNING_SUPPORT",
      noticeVersion: "LEARNING_SUPPORT_NOTICE_V1",
      confirmed: true,
    }),
  });

  const ownerEastHandle = await createSession("owner-east", "learning:institution-setting");
  await api("/local/learning-institution-setting", {
    method: "PATCH",
    headers: { Authorization: `Bearer ${ownerEastHandle}` },
    body: JSON.stringify({ enabled: true, expectedVersion: 0 }),
  });

  const second = page.locator(".binding-review-row").filter({ hasText: "示例学生乙" });
  await second.getByRole("button", { name: "拒绝申请" }).waitFor();
  await page.locator("[data-binding-review-confirm]").check();
  await second.getByRole("button", { name: "拒绝申请" }).click();
  await page.getByText("申请已在本机合成记录中拒绝。", { exact: true }).waitFor();
  assert.equal(await parentStatus(parentBetaHandle, secondApplication.id), "REJECTED");

  await page.goto(parentRoute, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "监护关系已确认" }).waitFor();
  const learningRoute = parentRoute.replace(
    "/web/parent/binding",
    "/web/parent/learning?profile=parent-alpha",
  );
  await page.goto(learningRoute, { waitUntil: "networkidle" });
  try {
    await page.locator("[data-parent-learning-summary]").waitFor({ timeout: 8000 });
  } catch (error) {
    process.stderr.write(
      JSON.stringify({
        learningRoute: page.url(),
        learningStatus: await page
          .locator("[data-learning-status]")
          .textContent()
          .catch(() => null),
        mainText: await page
          .locator("main")
          .innerText()
          .catch(() => null),
        browserErrors,
        error: String(error),
      }) + "\n",
    );
    throw error;
  }
  const controls = page.locator("form[data-learning-control-form]").first();
  const enabled = controls.locator('input[name="enabled"]');
  if (!(await enabled.isChecked())) await enabled.check();
  await controls.locator('select[name="maxDurationMinutes"]').selectOption("5");
  await controls.locator('select[name="maxHintLevel"]').selectOption("2");
  await controls.locator('button[type="submit"]').click();
  await page.getByText("学习设置已保存。", { exact: true }).waitFor();
  await page.locator("[data-learning-contact]").click();
  await page
    .getByText("联系意向已在本机记录；尚未发送消息，请通过常用渠道联系教师。", { exact: true })
    .waitFor();
  const learningForm = page.locator("[data-learning-open-form]");
  await learningForm.locator('select[name="studentId"]').selectOption({ index: 0 });
  await learningForm.locator('select[name="durationMinutes"]').selectOption("5");
  await learningForm.locator('input[name="consent"]').check();
  await learningForm.locator('button[type="submit"]').click();
  await page.locator("[data-learning-session]").waitFor();
  await page.locator("[data-learning-close]").click();
  await page.locator("[data-learning-open-form]").waitFor();
  await page.reload({ waitUntil: "networkidle" });
  const summaryRow = page.locator("[data-parent-learning-summary] .learning-history-item");
  try {
    await summaryRow.waitFor({ timeout: 8000 });
  } catch (error) {
    const controls = await api("/local/learning-parent-controls", {
      headers: { Authorization: `Bearer ${parentAlphaHandle}` },
    });
    const sessions = await api("/local/learning-sessions", {
      headers: { Authorization: `Bearer ${parentAlphaHandle}` },
    });
    process.stderr.write(
      JSON.stringify({
        controls,
        sessions,
        learningStatus: await page
          .locator("[data-learning-status]")
          .textContent()
          .catch(() => null),
        summaryText: await page
          .locator("[data-parent-learning-summary]")
          .innerText()
          .catch(() => null),
        error: String(error),
      }) + "\n",
    );
    throw error;
  }
  await page.getByText("共练习 1 次", { exact: false }).waitFor();
  assert.ok(rewritesToDisposableService > 0);

  assert.deepEqual(browserErrors, []);
  assert.deepEqual(externalRequests, []);
  process.stdout.write(
    `${JSON.stringify({ status: "PASS", parentSubmittedAndRefreshed: true, approved: true, rejected: true, westCampusPendingQueueEmpty: true, westCampusCrossScopeReviewDenied: true, rewrittenParentApiRequests: rewritesToDisposableService, browserErrors, externalRequests })}\n`,
  );
} finally {
  if (browser) await browser.close();
  if (server.listening) await new Promise((resolve) => server.close(resolve));
  if (apiStarted) await localApi.close();
}
