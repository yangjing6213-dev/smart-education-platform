/* global document, fetch, process, window */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { setTimeout, clearTimeout } from "node:timers";
import { fileURLToPath, pathToFileURL, URL } from "node:url";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const { buildLocalSyntheticServer } = await import(
  pathToFileURL(resolve(root, "apps/api/dist/src/local-synthetic/server.js")).href
);
const service = await buildLocalSyntheticServer({ mode: "local-synthetic" });
const serviceUrl = new URL(await service.start(0));
const preview = spawn(
  process.execPath,
  [resolve(root, "apps/user-web/preview.mjs"), "--local-service-port", serviceUrl.port],
  { cwd: root, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
);
let browser;
try {
  const baseUrl = await new Promise((resolvePromise, reject) => {
    let output = "";
    const timeout = setTimeout(() => reject(new Error("Preview startup timed out")), 10000);
    preview.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    preview.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Preview exited: ${code}`));
    });
    preview.stdout.on("data", (chunk) => {
      output += String(chunk);
      const line = output.split("\n").find((candidate) => candidate.includes('"event":"startup"'));
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
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`);
  });
  await page.route("**/*", async (route) => {
    if (new URL(route.request().url()).origin !== baseUrl) {
      externalRequests.push(route.request().url());
      await route.abort();
    } else await route.continue();
  });

  await page.goto(`${baseUrl}/web/staff/resources?mode=shared&profile=teacher-east`);
  await page.locator("[data-resource-library]").waitFor();
  await page
    .locator('[data-resource-collection="search"] [data-resource-action="open"]')
    .first()
    .waitFor();
  const catalogue = page.locator('[data-resource-collection="search"]');
  await catalogue.getByText("示例数学活动卡").waitFor();
  await catalogue.getByText("示例阅读引导单").waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
    false,
    "User Web resource page should fit a phone viewport",
  );
  await page.setViewportSize({ width: 1280, height: 900 });
  assert.equal(await page.getByText("其他机构示例练习", { exact: false }).count(), 0);
  assert.equal(await page.getByText("已过期示例练习", { exact: false }).count(), 0);

  await page.locator('[data-resource-search] input[name="query"]').fill("阅读");
  await page.locator('[data-resource-search] select[name="grade"]').selectOption("三年级");
  await page.locator('[data-resource-search] select[name="subject"]').selectOption("语文");
  await page.locator('[data-resource-search] select[name="tag"]').selectOption("课堂分享");
  await page.locator('[data-resource-search] button[type="submit"]').click();
  await catalogue
    .locator('article[data-resource-id="00000000-0000-4000-8000-000000000385"]')
    .waitFor({ state: "detached" });
  assert.equal(await catalogue.getByText("示例数学活动卡", { exact: false }).count(), 0);

  const readingId = "00000000-0000-4000-8000-000000000386";
  const readingCard = page.locator(`[data-resource-id="${readingId}"]`).first();
  await readingCard.getByRole("button", { name: "查看详情" }).click();
  await page.locator("[data-resource-detail]").getByText("先提出一个开放问题").waitFor();
  await page.locator('[data-resource-detail] [data-resource-action="use"]').click();
  await page.locator('[data-resource-collection="recent"]').getByText("示例阅读引导单").waitFor();

  await page.locator('[data-resource-search] button[data-resource-action="clear"]').click();
  const resetCatalogue = page.locator('[data-resource-collection="search"]');
  const mathCard = resetCatalogue.locator(
    `[data-resource-id="00000000-0000-4000-8000-000000000385"]`,
  );
  await mathCard.getByRole("button", { name: "收藏" }).click();
  await page
    .locator('[data-resource-collection="favorites"]')
    .getByText("示例数学活动卡")
    .waitFor();
  await page
    .locator('[data-resource-collection="favorites"] [data-resource-action="favorite"]')
    .first()
    .click();
  await page.locator('[data-resource-collection="favorites"]').getByText("暂无资源").waitFor();

  const deniedQuery = await fetch(new URL("/local/resources?unexpected=1", baseUrl), {
    headers: { origin: baseUrl },
  });
  assert.equal(deniedQuery.status, 404);
  const duplicateQuery = await fetch(
    new URL("/local/resources?grade=三年级&grade=四年级", baseUrl),
    {
      headers: { origin: baseUrl },
    },
  );
  assert.equal(duplicateQuery.status, 404);

  assert.deepEqual(pageErrors, []);
  assert.deepEqual(failedResponses, []);
  assert.deepEqual(externalRequests, []);
  process.stdout.write(
    JSON.stringify({ status: "PASS", pageErrors, failedResponses, externalRequests }) + "\n",
  );
} finally {
  await browser?.close();
  preview.kill();
  await service.close();
}
