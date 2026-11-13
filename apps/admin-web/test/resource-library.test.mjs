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
  [resolve(root, "apps/admin-web/preview.mjs"), "--local-service-port", serviceUrl.port],
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
      const line = output.split("\n").find((candidate) => candidate.includes('"baseUrl"'));
      if (line) {
        clearTimeout(timeout);
        resolvePromise(JSON.parse(line).baseUrl);
      }
    });
  });

  const serviceApi = async (handle, method, path, data, expected = true) => {
    const response = await fetch(new URL(path, serviceUrl), {
      method,
      headers: {
        origin: serviceUrl.origin,
        ...(handle ? { authorization: `Bearer ${handle}` } : {}),
        ...(data === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    });
    assert.equal(expected === true ? response.ok : response.status, expected, `${method} ${path}`);
    return response.status === 204 ? null : response.json();
  };
  const session = async (profile) =>
    (await serviceApi("", "POST", "/local/sessions", { profile })).handle;
  const resourceId = "00000000-0000-4000-8000-000000000385";
  const teacher = await session("teacher-east");

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

  await page.goto(`${baseUrl}/admin/resources?shared=1&profile=owner-east`);
  await page.locator("[data-resource-management]").waitFor();
  const card = page.locator(`[data-resource-id="${resourceId}"]`).first();
  await card.getByText("示例数学活动卡").waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
    false,
    "Admin resource page should fit a phone viewport",
  );
  await page.setViewportSize({ width: 1280, height: 900 });
  await card.locator('[data-resource-update] select[name="scope"]').selectOption("CLASS");
  await card.locator('[data-resource-update] select[name="expiresOn"]').selectOption("2027-03-31");
  await card.locator('[data-resource-update] button[type="submit"]').click();
  await page
    .locator(`[data-resource-id="${resourceId}"]`)
    .getByText("第 2 版", { exact: false })
    .waitFor();
  await page
    .locator(`[data-resource-id="${resourceId}"] p`)
    .filter({ hasText: "到期：2027-03-31" })
    .waitFor();

  const visibleToTeacher = await serviceApi(teacher, "GET", "/local/resources");
  const updated = visibleToTeacher.find((item) => item.id === resourceId);
  assert.equal(updated?.version, 2);
  assert.equal(updated?.scope, "CLASS");
  assert.equal(updated?.expiresOn, "2027-03-31");
  await serviceApi(teacher, "POST", `/local/resources/${resourceId}/favorite`, {
    version: updated.version,
    favorite: true,
  });
  await serviceApi(teacher, "POST", `/local/resources/${resourceId}/use`, {
    version: updated.version,
  });
  assert.equal(
    (await serviceApi(teacher, "GET", "/local/resources-favorites")).some(
      (item) => item.id === resourceId,
    ),
    true,
  );
  assert.equal(
    (await serviceApi(teacher, "GET", "/local/resources-recent")).some(
      (item) => item.id === resourceId,
    ),
    true,
  );

  const revoke = page.locator(`[data-resource-id="${resourceId}"] [data-resource-revoke]`);
  await revoke.click();
  await page
    .locator(`[data-resource-id="${resourceId}"] p`)
    .filter({ hasText: "第 3 版 · 已撤回" })
    .waitFor();
  assert.equal(
    (await serviceApi(teacher, "GET", "/local/resources")).some((item) => item.id === resourceId),
    false,
  );
  assert.equal(
    (await serviceApi(teacher, "GET", "/local/resources-favorites")).some(
      (item) => item.id === resourceId,
    ),
    false,
  );
  assert.equal(
    (await serviceApi(teacher, "GET", "/local/resources-recent")).some(
      (item) => item.id === resourceId,
    ),
    false,
  );
  await serviceApi(teacher, "GET", `/local/resources/${resourceId}`, undefined, 404);

  const platformPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await platformPage.route("**/*", async (route) => {
    if (new URL(route.request().url()).origin !== baseUrl) {
      externalRequests.push(route.request().url());
      await route.abort();
    } else await route.continue();
  });
  platformPage.on("pageerror", (error) => pageErrors.push(error.message));
  await platformPage.goto(`${baseUrl}/admin/resources?shared=1&profile=platform-admin`);
  await platformPage.locator("[data-resource-summary]").waitFor();
  const summaryText = await platformPage.locator("[data-resource-summary]").innerText();
  assert.match(summaryText, /资源总数/u);
  assert.doesNotMatch(summaryText, /示例数学活动卡|示例东校区负责人|当前班级/u);
  const platform = await session("platform-admin");
  await serviceApi(platform, "GET", "/local/resources-managed", undefined, 403);

  const deniedPath = await fetch(new URL("/local/resources-managed?campusId=forged", baseUrl), {
    headers: { origin: baseUrl },
  });
  assert.equal(deniedPath.status, 404);
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
