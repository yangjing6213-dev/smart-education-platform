/* global fetch, process */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { setTimeout, clearTimeout } from "node:timers";
import { fileURLToPath, pathToFileURL, URL } from "node:url";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const apiWorktree = [
  process.env.LOCAL_SYNTHETIC_API_WORKTREE,
  resolve(root, "../task20-local-shared-core"),
  resolve(root, "../../.codex/worktrees/task20-local-shared-core"),
].find(
  (path) =>
    path !== undefined && existsSync(resolve(path, "apps/api/dist/src/local-synthetic/server.js")),
);
if (!apiWorktree) throw new Error("Local synthetic API worktree is unavailable");
const apiModule = pathToFileURL(
  resolve(apiWorktree, "apps/api/dist/src/local-synthetic/server.js"),
).href;
const { buildLocalSyntheticServer } = await import(apiModule);
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

  const api = async (handle, method, path, data) => {
    const response = await fetch(new URL(path, serviceUrl), {
      method,
      headers: {
        origin: serviceUrl.origin,
        ...(handle ? { authorization: `Bearer ${handle}` } : {}),
        ...(data === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    });
    assert.equal(response.ok, true, `${method} ${path} returned ${response.status}`);
    return response.json();
  };
  const session = async (profile) => (await api("", "POST", "/local/sessions", { profile })).handle;
  const teacher = await session("teacher-east");
  const resourceId = "00000000-0000-4000-8000-00000000038b";
  const before = await api(teacher, "GET", "/local/learning-knowledge");
  assert.equal(
    before.some((resource) => resource.id === resourceId),
    false,
  );

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
  const card = page.locator(`[data-resource-id="${resourceId}"]`).first();
  await card.getByText("两位数加法练习卡").waitFor();
  await card.locator('[data-learning-source-action="APPROVE"]').click();
  await card
    .locator("[data-learning-source-status]")
    .getByText("已通过", { exact: false })
    .waitFor();
  assert.equal(await card.locator("[data-learning-source-review]").count(), 0);

  const after = await api(teacher, "GET", "/local/learning-knowledge");
  assert.equal(
    after.some((resource) => resource.id === resourceId),
    true,
  );
  const learningItem = after.find((resource) => resource.id === resourceId);
  assert.equal("learningSourceGovernance" in learningItem, false);
  assert.equal("reviewedBy" in learningItem, false);
  assert.equal(
    await page.evaluate(
      () => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth,
    ),
    true,
  );
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(failedResponses, []);
  assert.deepEqual(externalRequests, []);
} finally {
  await browser?.close();
  preview.kill();
  await service.close();
}
