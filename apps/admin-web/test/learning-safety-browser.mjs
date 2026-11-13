/* global document, process, window */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { setTimeout, clearTimeout } from "node:timers";
import { fileURLToPath, pathToFileURL, URL } from "node:url";
import { chromium } from "playwright";

const projectRoot = fileURLToPath(new URL("../../../", import.meta.url));
const { buildLocalSyntheticServer } = await import(
  pathToFileURL(resolve(projectRoot, "apps/api/dist/src/local-synthetic/server.js")).href
);
const service = await buildLocalSyntheticServer({ mode: "local-synthetic" });
const serviceUrl = new URL(await service.start(0));
const preview = spawn(
  process.execPath,
  [resolve(projectRoot, "apps/admin-web/preview.mjs"), "--local-service-port", serviceUrl.port],
  { cwd: projectRoot, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
);
let browser;
try {
  const baseUrl = await new Promise((resolvePromise, reject) => {
    let output = "";
    const timeout = setTimeout(() => reject(new Error("管理端预览启动超时。")), 10000);
    preview.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    preview.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`管理端预览提前退出：${code}`));
    });
    preview.stdout.on("data", (chunk) => {
      output += String(chunk);
      const line = output.split("\n").find((candidate) => candidate.includes('"baseUrl"'));
      if (line) {
        clearTimeout(timeout);
        resolvePromise(JSON.parse(line).baseUrl);
      }
    });
  });

  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.setDefaultTimeout(8000);
  const pageErrors = [];
  const failedResponses = [];
  const externalRequests = [];
  const localRequests = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`);
  });
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin === baseUrl && url.pathname.startsWith("/local/"))
      localRequests.push(`${request.method()} ${url.pathname}`);
  });
  await page.route("**/*", async (route) => {
    if (new URL(route.request().url()).origin !== baseUrl) {
      externalRequests.push(route.request().url());
      await route.abort();
    } else await route.continue();
  });

  await page.goto(`${baseUrl}/admin/learning-safety?profile=platform-admin`);
  await page.locator("[data-learning-safety]").waitFor();
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    true,
    "学习安全汇总页不应出现横向滚动",
  );
  await page.getByText("匿名安全汇总", { exact: true }).first().waitFor();
  await page.getByText("指标口径：V2（本机合成数据）", { exact: true }).waitFor();
  await page.getByText("学习会话总数", { exact: true }).waitFor();
  const metricGrid = page.locator(".learning-safety-grid");
  assert.equal(
    await metricGrid.evaluate((element) => window.getComputedStyle(element).display),
    "grid",
    "学习指标应使用卡片网格排列",
  );
  assert.equal(await metricGrid.locator(".learning-safety-metric").count(), 20);
  const gridColumnCount = async () =>
    metricGrid.evaluate(
      (element) => window.getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/u).length,
    );
  assert.ok((await gridColumnCount()) >= 3, "桌面视口应同时展示多张指标卡片");
  const desktopCards = await metricGrid.locator(".learning-safety-metric").evaluateAll((cards) =>
    cards.map((card) => {
      const rect = card.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
    }),
  );
  for (let first = 0; first < desktopCards.length; first += 1) {
    for (let second = first + 1; second < desktopCards.length; second += 1) {
      const a = desktopCards[first];
      const b = desktopCards[second];
      const overlapX = Math.min(a.right, b.right) > Math.max(a.left, b.left);
      const overlapY = Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top);
      assert.equal(overlapX && overlapY, false, "指标卡片不应互相覆盖");
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(50);
  assert.equal(await gridColumnCount(), 1, "手机视口应改为单列卡片");
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    true,
    "手机学习安全页不应出现横向滚动",
  );
  assert.match(await page.locator("[data-learning-safety]").innerText(), /0/u);
  assert.doesNotMatch(
    await page.locator("[data-learning-safety]").innerText(),
    /学生姓名|studentId|班级明细/u,
  );
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(failedResponses, []);
  assert.deepEqual(externalRequests, []);
  assert.deepEqual(localRequests.sort(), [
    "GET /local/learning-safety-summary",
    "GET /local/session",
    "POST /local/sessions",
  ]);
} finally {
  await browser?.close();
  preview.kill();
  await service.close();
}
