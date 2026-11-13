/* global fetch, process, window */
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

  const api = async (handle, method, path, body, expected = 200) => {
    const response = await fetch(new URL(path, serviceUrl), {
      method,
      headers: {
        origin: serviceUrl.origin,
        ...(handle ? { authorization: `Bearer ${handle}` } : {}),
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    assert.equal(response.status, expected, `${method} ${path}`);
    return response.status === 204 ? null : response.json();
  };
  const createSession = async (profile) =>
    (await api("", "POST", "/local/sessions", { profile }, 201)).handle;
  const owner = await createSession("owner-east");
  const teacher = await createSession("teacher-east");
  const ownerSession = await api(owner, "GET", "/local/session");
  const assignees = await api(owner, "GET", "/local/staff-task-assignees");
  await api(
    owner,
    "POST",
    "/local/staff-tasks",
    {
      code: "DAILY_CHECK",
      assigneeId: assignees[0].actorId,
      targetType: "CLASS",
      targetId: ownerSession.classIds[0],
      dueDate: "2026-10-07",
      priority: "NORMAL",
    },
    201,
  );
  await api(
    teacher,
    "POST",
    "/local/attendance-records",
    {
      student: "student-alpha",
      date: "2026-10-07",
      status: "ARRIVED",
      time: "09:00",
    },
    201,
  );
  await api(
    teacher,
    "POST",
    "/local/pickup-exceptions",
    {
      student: "student-alpha",
      date: "2026-10-07",
      category: "OVERDUE",
    },
    201,
  );
  const sourceResult = await api(
    owner,
    "GET",
    `/local/statistics?from=2026-10-07&to=2026-10-07&classId=${ownerSession.classIds[0]}`,
  );
  const sourceIds = sourceResult.groups.flatMap((group) =>
    group.sources.map((source) => source.id),
  );

  const statisticsPreflight = await fetch(
    new URL("/local/statistics?from=2026-10-07&to=2026-10-07", serviceUrl),
    {
      method: "OPTIONS",
      headers: {
        origin: "http://127.0.0.1:4317",
        "access-control-request-method": "GET",
        "access-control-request-headers": "authorization",
      },
    },
  );
  assert.equal(statisticsPreflight.status, 204);
  assert.equal(
    statisticsPreflight.headers.get("access-control-allow-origin"),
    "http://127.0.0.1:4317",
  );
  const forgedStatisticsPreflight = await fetch(
    new URL("/local/statistics?from=2026-10-07&tenantId=tenant-synthetic-b", serviceUrl),
    {
      method: "OPTIONS",
      headers: {
        origin: "http://127.0.0.1:4317",
        "access-control-request-method": "GET",
        "access-control-request-headers": "authorization",
      },
    },
  );
  assert.equal(forgedStatisticsPreflight.status, 400);

  browser = await chromium.launch({ headless: true });
  const pageErrors = [];
  const failedResponses = [];
  const externalRequests = [];
  const ownerLocalRequests = [];
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.setDefaultTimeout(8000);
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`);
  });
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin === baseUrl && url.pathname.startsWith("/local/"))
      ownerLocalRequests.push(url.pathname);
  });
  await page.route("**/*", async (route) => {
    if (new URL(route.request().url()).origin !== baseUrl) {
      externalRequests.push(route.request().url());
      await route.abort();
    } else await route.continue();
  });

  await page.goto(`${baseUrl}/admin/institution?shared=1&profile=owner-east`);
  await page.locator('button[data-route="/admin/statistics"]').click();
  await page.locator("[data-operational-statistics]").waitFor();
  await page
    .locator("[data-statistics-status]")
    .filter({ hasText: "统计范围来自当前登录身份" })
    .waitFor();
  await page.locator('[data-statistics-filter] input[name="from"]').fill("2026-10-07");
  await page.locator('[data-statistics-filter] input[name="to"]').fill("2026-10-07");
  await page.locator('[data-statistics-filter] button[type="submit"]').click();
  await page.locator("[data-statistics-group]").first().waitFor();
  assert.equal(await page.locator("[data-statistics-group]").count(), 3);
  assert.equal(
    await page
      .locator("[data-statistics-page]")
      .evaluate((node) => window.getComputedStyle(node).display),
    "grid",
  );
  for (const sourceId of sourceIds)
    await page.locator(`[data-statistics-source="${sourceId}"]`).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(() => window.document.documentElement.scrollWidth <= window.innerWidth),
    true,
  );
  await page.locator('[data-statistics-filter] input[name="from"]').fill("2026-10-06");
  await page.locator('[data-statistics-filter] input[name="to"]').fill("2026-10-06");
  await page.locator('[data-statistics-filter] button[type="submit"]').click();
  await page.locator('[data-statistics-empty="true"]').waitFor();
  assert.ok(
    ownerLocalRequests.every((path) =>
      ["/local/sessions", "/local/session", "/local/statistics"].includes(path),
    ),
  );
  const forgedScopeResponse = await fetch(
    `${baseUrl}/local/statistics?from=2026-10-07&to=2026-10-07&tenantId=tenant-synthetic-b`,
  );
  assert.equal(forgedScopeResponse.status, 404);
  const forgedHeaderResponse = await fetch(`${baseUrl}/local/sessions`, {
    method: "POST",
    headers: {
      Origin: baseUrl,
      "Content-Type": "application/json",
      "X-Tenant-Id": "tenant-synthetic-b",
    },
    body: JSON.stringify({ profile: "owner-east" }),
  });
  assert.equal(forgedHeaderResponse.status, 403);

  const west = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  west.on("pageerror", (error) => pageErrors.push(error.message));
  await west.route("**/*", async (route) => {
    if (new URL(route.request().url()).origin !== baseUrl) {
      externalRequests.push(route.request().url());
      await route.abort();
    } else await route.continue();
  });
  await west.goto(`${baseUrl}/admin/statistics?shared=1&profile=owner-west`);
  await west.locator('[data-statistics-empty="true"]').waitFor();

  const platform = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const platformLocalRequests = [];
  platform.on("pageerror", (error) => pageErrors.push(error.message));
  platform.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin === baseUrl && url.pathname.startsWith("/local/"))
      platformLocalRequests.push(url.pathname);
  });
  await platform.route("**/*", async (route) => {
    if (new URL(route.request().url()).origin !== baseUrl) {
      externalRequests.push(route.request().url());
      await route.abort();
    } else await route.continue();
  });
  await platform.goto(`${baseUrl}/admin/statistics?shared=1&profile=platform-admin`);
  await platform.locator('[data-statistics-anonymous="true"]').waitFor();
  assert.equal(await platform.locator("[data-statistics-filter]").count(), 0);
  for (const sourceId of sourceIds)
    assert.equal(await platform.locator(`[data-statistics-source="${sourceId}"]`).count(), 0);
  assert.match(await platform.locator("[data-statistics-anonymous=true]").innerText(), /统计总数/u);
  assert.deepEqual(platformLocalRequests.sort(), [
    "/local/session",
    "/local/sessions",
    "/local/statistics-summary",
  ]);

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
