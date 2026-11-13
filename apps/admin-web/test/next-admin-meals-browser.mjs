/* global document, fetch, process, URL */
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
const apiOutput = resolve(root, "apps/api/.task20-a1-251-validation");
const TENANT = "10000000-0000-4000-8000-000000000001";
const EAST = "10000000-0000-4000-8000-000000000002";
const WEST = "10000000-0000-4000-8000-000000000003";
const ACTORS = [
  "10000000-0000-4000-8000-000000000004",
  "10000000-0000-4000-8000-000000000005",
  "10000000-0000-4000-8000-000000000006",
];
const importApi = (path) => import(pathToFileURL(resolve(apiOutput, path)).href);

async function assertPortClosed(port) {
  await new Promise((done, reject) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    socket.once("connect", () => {
      socket.destroy();
      reject(new Error("Owned local port still accepts connections: " + port));
    });
    socket.once("error", (error) => (error.code === "ECONNREFUSED" ? done() : reject(error)));
  });
}

test("Next meals uses invited campus identity and versioned same-origin controls", async () => {
  const [{ createApiApp }, { MealService }, { InviteAuthService, createInvitePasswordHash }] =
    await Promise.all([
      importApi("src/nest/api-app.js"),
      importApi("src/modules/meals/meal.service.js"),
      importApi("src/nest/invite-auth.service.js"),
    ]);
  const names = ["meal-owner-east", "meal-owner-west", "meal-writer-east"];
  const passwords = names.map(() => randomBytes(24).toString("base64url"));
  const accounts = await Promise.all(
    names.map(async (username, index) => ({
      username,
      password_hash: await createInvitePasswordHash(passwords[index]),
      identity: { actor_id: ACTORS[index], display_name: "示例餐食管理员" },
      memberships: [
        {
          tenant_id: TENANT,
          campus_ids: [index === 1 ? WEST : EAST],
          status: "ACTIVE",
          capabilities: [
            "identity:read",
            "memberships:read",
            "content:write",
            ...(index === 2 ? [] : ["content:publish"]),
          ],
        },
      ],
    })),
  );
  let api;
  let runtime;
  let browser;
  let apiPort;
  const previousApi = process.env.ADMIN_WEB_LOCAL_NEST_API;
  const previousDist = process.env.TASK20_NEXT_DIST_DIR;
  const browserErrors = [];
  const failedRequests = [];
  const externalRequests = [];
  const legacyRequests = [];
  const mealRequests = [];
  const conflicts = [];

  try {
    api = await createApiApp({
      inviteAuthService: new InviteAuthService(accounts),
      mealService: new MealService(),
    });
    await api.listen(0, "127.0.0.1");
    apiPort = api.getHttpServer().address().port;
    const apiOrigin = "http://127.0.0.1:" + apiPort;
    async function apiRequest(path, { token, method = "GET", body } = {}) {
      const response = await fetch(apiOrigin + path, {
        method,
        redirect: "error",
        headers: {
          accept: "application/json",
          ...(token ? { authorization: "Bearer " + token } : {}),
          ...(body ? { "content-type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return { status: response.status, body: await response.json() };
    }
    async function apiData(path, options) {
      const result = await apiRequest(path, options);
      assert.ok(result.status >= 200 && result.status < 300, path + ": " + result.status);
      return result.body.data;
    }
    const eastToken = (
      await apiData("/identity/login", {
        method: "POST",
        body: { username: names[0], password: passwords[0] },
      })
    ).access_token;
    const westToken = (
      await apiData("/identity/login", {
        method: "POST",
        body: { username: names[1], password: passwords[1] },
      })
    ).access_token;
    process.env.ADMIN_WEB_LOCAL_NEST_API = apiOrigin;
    process.env.TASK20_NEXT_DIST_DIR = ".task20-a1-252-next";
    runtime = await startNextAdminLocal();
    const adminOrigin = new URL(runtime.ready.admin).origin;
    browser = await chromium.launch({
      headless: true,
      ...(process.env.ADMIN_WEB_BROWSER ? { executablePath: process.env.ADMIN_WEB_BROWSER } : {}),
    });

    async function openAccount(index) {
      const context = await browser.newContext({ viewport: { width: 1365, height: 900 } });
      await context.route("**/*", async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        if (url.origin !== adminOrigin) {
          externalRequests.push(url.origin + url.pathname);
          await route.abort("blockedbyclient");
          return;
        }
        if (url.pathname.startsWith("/local/")) legacyRequests.push(url.pathname);
        if (url.pathname.startsWith("/api/admin/meals")) {
          mealRequests.push({ path: url.pathname, method: request.method() });
          assert.equal(request.headers().authorization, undefined);
          assert.equal(request.headers()["x-campus-id"], undefined);
        }
        await route.continue();
      });
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      page.on("pageerror", (error) => browserErrors.push(error.message));
      page.on("console", (message) => {
        if (message.type() !== "error") return;
        if (message.text().includes("status of 409 (Conflict)")) conflicts.push(message.text());
        else browserErrors.push(message.text());
      });
      page.on("requestfailed", (request) => {
        const url = new URL(request.url());
        const error = request.failure()?.errorText;
        if (
          url.pathname === "/admin/meals" &&
          url.searchParams.has("_rsc") &&
          error === "net::ERR_ABORTED"
        )
          return;
        failedRequests.push(url.pathname + " " + error);
      });
      await page.goto(adminOrigin + "/admin/login?next=%2Fadmin%2Fmeals", {
        waitUntil: "networkidle",
      });
      await page.locator("#admin-login-username").fill(names[index]);
      await page.locator("#admin-login-password").fill(passwords[index]);
      await page.getByRole("button", { name: "登录", exact: true }).click();
      await page.waitForURL(adminOrigin + "/admin/meals");
      await page
        .getByRole("status")
        .getByText("已连接当前校区的餐食管理服务。", { exact: true })
        .waitFor();
      return { context, page };
    }

    const { context, page } = await openAccount(0);
    const desktop = await page.evaluate(() => {
      const sidebar = document.querySelector(".admin-sidebar").getBoundingClientRect();
      const content = document.querySelector("main").getBoundingClientRect();
      return {
        left: sidebar.left,
        width: sidebar.width,
        contentLeft: content.left,
        pageWidth: document.documentElement.scrollWidth,
      };
    });
    assert.equal(desktop.left, 0);
    assert.ok(desktop.width > 0 && desktop.contentLeft >= desktop.width);
    assert.equal(desktop.pageWidth, 1365);
    assert.equal(
      await page.getByRole("button", { name: "保存草稿", exact: true }).isDisabled(),
      true,
    );
    await page.getByRole("button", { name: "新建餐食", exact: true }).click();
    await page.getByLabel("日期", { exact: true }).fill("2026-11-02");
    await page.getByLabel("餐次", { exact: true }).selectOption("LUNCH");
    await page.getByLabel("菜品（每行一道）").fill("菜".repeat(121));
    assert.equal(
      await page.getByRole("button", { name: "保存草稿", exact: true }).isDisabled(),
      true,
    );
    assert.equal(await page.getByLabel("菜品（每行一道）").isEnabled(), true);
    await page.getByLabel("菜品（每行一道）").fill("合成米饭\n合成时蔬");
    await page.getByLabel("菜单说明").fill("仅用于本地合成验证。");
    await page.getByRole("button", { name: "保存草稿", exact: true }).click();
    await page.getByRole("status").getByText("草稿已保存。", { exact: true }).waitFor();
    const created = (await apiData("/admin/meals", { token: eastToken }))[0];
    assert.ok(created);
    assert.equal(created.version, 1);
    assert.deepEqual(await apiData("/admin/meals", { token: westToken }), []);
    assert.equal(
      (
        await apiRequest("/admin/meals/" + created.id + "/publish", {
          token: westToken,
          method: "POST",
          body: { expected_version: 1 },
        })
      ).status,
      404,
    );

    await apiData("/admin/meals/" + created.id + "/draft", {
      token: eastToken,
      method: "PUT",
      body: {
        expected_version: 1,
        payload: {
          meal_date: created.meal_date,
          meal_type: created.meal_type,
          items: created.items,
          notes: "其他管理员更新了菜单。",
        },
      },
    });
    const conflictResponse = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname.endsWith("/publish") && response.status() === 409,
    );
    await page.getByRole("button", { name: "发布", exact: true }).click();
    await conflictResponse;
    const conflictNotice = page.locator('section[aria-labelledby="meals-title"] [role="alert"]');
    await conflictNotice.waitFor();
    assert.match(await conflictNotice.innerText(), /这份餐食已被更新，请刷新后再继续。/u);
    assert.equal(
      await page.getByRole("button", { name: "保存草稿", exact: true }).isDisabled(),
      true,
    );
    await page.getByRole("button", { name: "刷新餐食", exact: true }).click();
    await page.waitForFunction(
      () =>
        document.querySelector('textarea[aria-label="菜单说明"]')?.value ===
        "其他管理员更新了菜单。",
    );
    await page.getByLabel("菜单说明").fill("更新后的合成菜单。");
    assert.equal(
      await page.getByRole("button", { name: "发布", exact: true }).isDisabled(),
      true,
      "修改菜单后必须先保存，不能发布旧内容。",
    );
    await page.getByRole("button", { name: "保存草稿", exact: true }).click();
    await page.getByRole("status").getByText("草稿已保存。", { exact: true }).waitFor();
    await page.getByRole("button", { name: "发布", exact: true }).click();
    await page.getByRole("status").getByText("餐食已发布。", { exact: true }).waitFor();
    assert.equal(
      await page.getByRole("button", { name: "保存草稿", exact: true }).isDisabled(),
      true,
    );

    await page.reload({ waitUntil: "networkidle" });
    await page
      .getByRole("list", { name: "餐食列表" })
      .getByRole("button", { name: "查看", exact: true })
      .click();
    assert.equal(
      await page.getByRole("button", { name: "保存草稿", exact: true }).isDisabled(),
      true,
    );
    assert.equal(await page.getByLabel("菜单说明").isDisabled(), true);
    assert.equal(await page.getByRole("button", { name: "下架", exact: true }).isEnabled(), true);
    const screenshotDir = process.env.NEXT_MEALS_SCREENSHOT_DIR;
    if (screenshotDir) {
      await mkdir(resolve(screenshotDir), { recursive: true });
      await page.screenshot({
        path: resolve(screenshotDir, "desktop.png"),
        fullPage: true,
        animations: "disabled",
      });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390);
    const toggle = page.locator(".nav-toggle");
    await toggle.click();
    assert.equal(await toggle.getAttribute("aria-expanded"), "true");
    await page.keyboard.press("Escape");
    assert.equal(await toggle.getAttribute("aria-expanded"), "false");
    if (screenshotDir)
      await page.screenshot({
        path: resolve(screenshotDir, "mobile.png"),
        fullPage: true,
        animations: "disabled",
      });
    await page.setViewportSize({ width: 1365, height: 900 });
    await page.getByRole("button", { name: "下架", exact: true }).click();
    await page.getByRole("status").getByText("餐食已下架，可继续修改。", { exact: true }).waitFor();
    assert.equal(await page.getByLabel("菜单说明").isEnabled(), true);
    await page.getByLabel("菜单说明").fill("下架后修改的合成菜单。");
    await page.getByRole("button", { name: "保存草稿", exact: true }).click();
    await page.getByRole("status").getByText("草稿已保存。", { exact: true }).waitFor();
    const finalRow = (await apiData("/admin/meals", { token: eastToken }))[0];
    assert.equal(finalRow.status, "DRAFT");
    assert.equal(finalRow.version, 6);
    assert.equal(finalRow.notes, "下架后修改的合成菜单。");
    await page.getByRole("button", { name: "新建餐食", exact: true }).click();
    await page.getByLabel("日期", { exact: true }).fill("2026-11-03");
    await page.getByLabel("菜品（每行一道）").fill("东校区未保存的菜单");
    const otherTab = await context.newPage();
    await otherTab.goto(adminOrigin + "/admin/login?next=%2Fadmin%2Fmeals", {
      waitUntil: "networkidle",
    });
    await otherTab.locator("#admin-login-username").fill(names[1]);
    await otherTab.locator("#admin-login-password").fill(passwords[1]);
    await otherTab.getByRole("button", { name: "登录", exact: true }).click();
    await otherTab.waitForURL(adminOrigin + "/admin/meals");
    await otherTab
      .getByRole("status")
      .getByText("已连接当前校区的餐食管理服务。", { exact: true })
      .waitFor();
    await page.getByRole("button", { name: "刷新餐食", exact: true }).click();
    await page.getByRole("status").getByText("已刷新，共 0 份餐食。", { exact: true }).waitFor();
    assert.equal(await page.getByLabel("菜品（每行一道）").inputValue(), "");
    assert.equal(
      await page.getByRole("button", { name: "保存草稿", exact: true }).isDisabled(),
      true,
    );
    await otherTab.close();
    await context.close();

    const writer = await openAccount(2);
    await writer.page
      .getByRole("list", { name: "餐食列表" })
      .getByRole("button", { name: "编辑", exact: true })
      .click();
    assert.equal(
      await writer.page.getByRole("button", { name: "保存草稿", exact: true }).isEnabled(),
      true,
    );
    assert.equal(
      await writer.page.getByRole("button", { name: "发布", exact: true }).isDisabled(),
      true,
    );
    assert.equal(
      await writer.page.getByRole("button", { name: "下架", exact: true }).isDisabled(),
      true,
    );
    await writer.context.close();
    assert.deepEqual(externalRequests, []);
    assert.deepEqual(legacyRequests, []);
    assert.deepEqual(browserErrors, []);
    assert.deepEqual(failedRequests, []);
    assert.equal(conflicts.length, 1);
    assert.ok(mealRequests.some((request) => request.method === "PUT"));
    assert.ok(mealRequests.some((request) => request.path.endsWith("/unpublish")));
  } finally {
    await browser?.close();
    await runtime?.close();
    await api?.close();
    if (runtime) await runtime.closed;
    if (previousApi === undefined) delete process.env.ADMIN_WEB_LOCAL_NEST_API;
    else process.env.ADMIN_WEB_LOCAL_NEST_API = previousApi;
    if (previousDist === undefined) delete process.env.TASK20_NEXT_DIST_DIR;
    else process.env.TASK20_NEXT_DIST_DIR = previousDist;
    if (runtime) await assertPortClosed(Number(new URL(runtime.ready.admin).port));
    if (apiPort) await assertPortClosed(apiPort);
  }
});
