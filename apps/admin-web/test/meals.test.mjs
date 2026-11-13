/* global Buffer, URL */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { chromium } from "playwright";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const contentTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
]);

const syntheticMealRow = (id, meal_date, meal_type, status, version, items, notes = "仅供本机演示。") => ({
  id,
  tenant_id: "00000000-0000-4000-8000-000000000064",
  campus_id: "00000000-0000-4000-8000-000000000065",
  status,
  version,
  meal_date,
  meal_type,
  items,
  notes,
  media_ref: null,
  private_notes: "",
  published_at: status === "PUBLISHED" ? "2026-10-14T04:00:00.000Z" : null,
  synthetic_data: true,
  updated_by: "synthetic-owner",
  updated_at: "2026-10-14T04:00:00.000Z",
});

function sendJson(response, status, value) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(value));
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function createMealsApi() {
  return {
    rows: [
      syntheticMealRow("meal-2026-10-12-lunch", "2026-10-12", "LUNCH", "DRAFT", 1, ["模拟番茄面", "模拟时蔬"]),
      syntheticMealRow("meal-2026-10-13-breakfast", "2026-10-13", "BREAKFAST", "DRAFT", 1, ["模拟燕麦粥", "模拟水果"]),
      syntheticMealRow("meal-2026-10-14-lunch", "2026-10-14", "LUNCH", "PUBLISHED", 2, ["模拟米饭", "模拟蔬菜"]),
    ],
    sequence: 0,
  };
}

async function serveAdmin(request, response, mealsApi) {
  const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
  if (pathname.startsWith("/local/")) {
    if (pathname === "/local/sessions" && request.method === "POST") {
      sendJson(response, 201, { handle: "s".repeat(43) });
      return;
    }
    if (request.headers.authorization !== `Bearer ${"s".repeat(43)}`) {
      sendJson(response, 403, { code: "UNAVAILABLE" });
      return;
    }
    if (pathname === "/local/meals" && request.method === "GET") {
      sendJson(response, 200, mealsApi.rows);
      return;
    }
    if (pathname === "/local/meals" && request.method === "POST") {
      const payload = await readJson(request);
      const row = syntheticMealRow(
        `meal-local-${++mealsApi.sequence}`,
        payload.meal_date,
        payload.meal_type,
        "DRAFT",
        1,
        payload.items,
        payload.notes,
      );
      mealsApi.rows.push(row);
      sendJson(response, 201, row);
      return;
    }
    const match = /^\/local\/meals\/([A-Za-z0-9._:-]+)\/(draft|publish|unpublish)$/u.exec(pathname);
    const current = match && mealsApi.rows.find((row) => row.id === match[1]);
    if (match && current && request.method === (match[2] === "draft" ? "PUT" : "POST")) {
      const body = await readJson(request);
      if (body.expected_version !== current.version) {
        sendJson(response, 409, { code: "VERSION_MISMATCH" });
        return;
      }
      if (match[2] === "draft") {
        Object.assign(current, body.payload, {
          version: current.version + 1,
          status: "DRAFT",
          published_at: null,
        });
      } else {
        Object.assign(current, {
          version: current.version + 1,
          status: match[2] === "publish" ? "PUBLISHED" : "UNPUBLISHED",
          published_at: match[2] === "publish" ? "2026-10-14T04:00:00.000Z" : null,
        });
      }
      sendJson(response, 200, current);
      return;
    }
    sendJson(response, 404, { code: "UNAVAILABLE" });
    return;
  }
  const relativePath =
    pathname === "/" || pathname === "/admin" || /^\/admin\/(?!dist\/)/u.test(pathname)
      ? "index.html"
      : pathname.startsWith("/admin/dist/")
        ? pathname.slice("/admin/".length)
        : pathname.slice(1);
  const filePath = path.resolve(appRoot, relativePath);
  if (!filePath.startsWith(`${appRoot}${path.sep}`)) {
    response.writeHead(404).end();
    return;
  }

  void readFile(filePath)
    .then((body) => {
      response.writeHead(200, {
        "Content-Type": contentTypes.get(path.extname(filePath)) ?? "application/octet-stream",
      });
      response.end(body);
    })
    .catch(() => response.writeHead(404).end());
}

test("meal page creates, sorts, edits, publishes, and records synthetic actions", async () => {
  const mealsApi = createMealsApi();
  const server = createServer((request, response) => {
    void serveAdmin(request, response, mealsApi);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${address.port}/admin/meals`);
    await page.getByRole("heading", { name: "餐食内容管理" }).waitFor();

    const mealList = page.getByRole("list", { name: "餐食列表" });
    assert.equal(await mealList.count(), 1);
    await mealList.getByRole("button").nth(2).waitFor();
    assert.ok((await mealList.getByRole("button").count()) >= 2);
    assert.equal(await page.locator("[data-health-field]").count(), 0);

    await page.getByLabel("列表日期排序").selectOption("DESC");
    await page.getByRole("button", { name: "应用排序" }).click();
    assert.match(await mealList.getByRole("button").first().innerText(), /2026-10-14/u);
    await page.getByRole("list", { name: "餐食操作记录" }).getByText(/调整列表顺序/u).waitFor();

    await page.getByRole("button", { name: "新建餐食" }).click();
    await page.getByRole("button", { name: "保存草稿" }).click();
    assert.match(await page.getByRole("status").innerText(), /1 至 12 道菜品/u);
    assert.equal(
      await page.getByRole("list", { name: "餐食操作记录" }).getByText(/meal-local-1/u).count(),
      0,
    );
    await page.getByLabel("日期", { exact: true }).fill("2026-10-15");
    await page.getByLabel("餐次", { exact: true }).selectOption("LUNCH");
    await page.getByLabel("菜品（每行一道）").fill("模拟米饭\n模拟青菜");
    await page.getByLabel("菜单说明").fill("仅供本机演示");
    const preview = page.getByLabel("餐食预览");
    await preview.getByText("模拟米饭", { exact: true }).waitFor();
    await preview.getByText("2026-10-15 · 午餐", { exact: true }).waitFor();
    await page.getByRole("button", { name: "保存草稿" }).click();

    await page.getByText("模拟米饭", { exact: true }).waitFor();
    await page.getByRole("button", { name: "发布", exact: true }).click();
    await page.getByText("已发布", { exact: true }).waitFor();
    assert.equal(await page.getByLabel("餐食状态").innerText(), "已发布");
    const audit = page.getByRole("list", { name: "餐食操作记录" });
    await audit.getByText(/保存草稿/u).waitFor();
    await audit.getByText(/· 发布 ·/u).waitFor();

    await page.getByRole("button", { name: "下架", exact: true }).click();
    await page.getByText("已下架", { exact: true }).waitFor();
    assert.equal(await page.getByLabel("餐食状态").innerText(), "已下架");
    await audit.getByText(/· 下架 ·/u).waitFor();

    await mealList.getByRole("button", { name: /2026-10-13 · 早餐/u }).click();
    await page.getByLabel("菜品（每行一道）").fill("模拟早餐已更新");
    await page.getByRole("button", { name: "保存草稿" }).click();
    await page.getByText("模拟早餐已更新", { exact: true }).waitFor();

    const reloaded = await browser.newPage();
    await reloaded.goto(`http://127.0.0.1:${address.port}/admin/meals`);
    const reloadedBreakfast = reloaded
      .getByRole("list", { name: "餐食列表" })
      .getByRole("button", { name: /2026-10-13 · 早餐/u });
    await reloadedBreakfast.waitFor();
    await reloadedBreakfast.click();
    assert.equal(await reloaded.getByLabel("菜品（每行一道）").inputValue(), "模拟早餐已更新");

    const readOnly = await browser.newPage();
    await readOnly.goto(`http://127.0.0.1:${address.port}/admin/meals?mode=readonly`);
    await readOnly.getByRole("heading", { name: "餐食内容管理" }).waitFor();
    assert.equal(await readOnly.getByRole("button", { name: "新建餐食" }).isDisabled(), true);
    assert.equal(await readOnly.getByRole("button", { name: "保存草稿" }).isDisabled(), true);

    const conflict = await browser.newPage();
    await conflict.goto(`http://127.0.0.1:${address.port}/admin/meals?mode=conflict`);
    await conflict.getByRole("heading", { name: "餐食内容管理" }).waitFor();
    assert.equal(await conflict.getByLabel("餐食状态").innerText(), "版本冲突待处理");
    const blockedActions = conflict.getByRole("button", {
      name: "版本冲突待处理",
      exact: true,
    });
    assert.equal(await blockedActions.count(), 2);
    assert.equal(await blockedActions.first().isDisabled(), true);
    assert.equal(await blockedActions.nth(1).isDisabled(), true);
  } finally {
    await browser.close();
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

test("institution overview remains navigable before meals have been loaded", async () => {
  const server = createServer((request, response) => {
    void serveAdmin(request, response, createMealsApi());
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage();
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.goto(`http://127.0.0.1:${address.port}/admin/institution`);
    await page.getByRole("heading", { name: "机构与校区概览" }).waitFor();
    await page.getByRole("button", { name: "通知审核" }).waitFor();
    assert.deepEqual(pageErrors, []);
  } finally {
    await browser.close();
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
