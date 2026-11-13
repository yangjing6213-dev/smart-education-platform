import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createInterface } from "node:readline";
import { resolve } from "node:path";
import process from "node:process";
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL, URL } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const { buildLocalSyntheticServer } = await import(
  pathToFileURL(resolve(root, "apps/api/dist/src/local-synthetic/server.js"))
    .href
);

const service = await buildLocalSyntheticServer({ mode: "local-synthetic" });
const serviceUrl = await service.start(0);
const preview = spawn(
  process.execPath,
  [
    resolve(root, "apps/admin-web/preview.mjs"),
    "--local-service-port",
    new URL(serviceUrl).port,
  ],
  { stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
);
let browser;
try {
  const lines = createInterface({ input: preview.stdout });
  const [line] = await once(lines, "line", {
    signal: globalThis.AbortSignal.timeout(10000),
  });
  lines.close();
  const { baseUrl } = JSON.parse(line);
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
  }).format(new Date());
  const teacherSessionResponse = await globalThis.fetch(
    `${serviceUrl}/local/sessions`,
    {
      method: "POST",
      headers: { Origin: serviceUrl, "Content-Type": "application/json" },
      body: JSON.stringify({ profile: "teacher-east" }),
    },
  );
  assert.equal(teacherSessionResponse.status, 201);
  const teacherSession = await teacherSessionResponse.json();
  const createException = async (student) => {
    const response = await globalThis.fetch(
      `${serviceUrl}/local/pickup-exceptions`,
      {
        method: "POST",
        headers: {
          Origin: serviceUrl,
          "Content-Type": "application/json",
          Authorization: `Bearer ${teacherSession.handle}`,
        },
        body: JSON.stringify({
          student,
          date: today,
          category: "NO_AUTHORIZATION",
        }),
      },
    );
    assert.equal(response.status, 201);
    return response.json();
  };
  const firstException = await createException("student-alpha");
  const secondException = await createException("student-beta");

  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });
  page.setDefaultTimeout(8000);
  const externalRequests = [];
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.route("**/*", async (route) => {
    const request = route.request();
    if (new URL(request.url()).origin !== baseUrl) {
      externalRequests.push(request.url());
      await route.abort();
    } else await route.continue();
  });

  await page.goto(`${baseUrl}/admin/pickup-review?profile=owner-east`);
  const firstRow = page.locator(
    `[data-pickup-exception="${firstException.id}"]`,
  );
  await firstRow.waitFor();
  await firstRow.locator('[data-pickup-action="follow"]').click();
  await firstRow.locator('[data-pickup-action="resolve"]').waitFor();
  await firstRow.locator('[data-pickup-action="resolve"]').click();
  await firstRow.getByText(/已解决.*已记录后续安排/).waitFor();
  assert.equal(await firstRow.locator("[data-pickup-action]").count(), 0);

  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    assert.equal(
      await page.evaluate(
        () =>
          globalThis.document.documentElement.scrollWidth <=
          globalThis.window.innerWidth,
      ),
      true,
      `pickup page should not overflow at ${width}px`,
    );
  }

  await page.goto(`${baseUrl}/admin/pickup-review?profile=teacher-east`);
  await page.locator("[data-pickup-profile]").waitFor();
  assert.equal(await page.locator("[data-pickup-exception]").count(), 0);
  assert.equal(await page.locator("[data-pickup-action]").count(), 0);
  assert.ok(secondException.id);

  await page.goto(`${baseUrl}/admin/pickup-review?profile=platform-admin`);
  await page
    .locator("[data-pickup-message]")
    .filter({ hasText: "平台管理员不查看学生级接送明细。" })
    .waitFor();
  assert.doesNotMatch(
    await page.locator("body").innerText(),
    /示例学生甲|示例学生乙/,
  );

  const forbiddenRoute = await page.evaluate(async () => {
    const response = await globalThis.fetch("/local/pickup-queue", {
      cache: "no-store",
    });
    return response.status;
  });
  assert.equal(forbiddenRoute, 404);
  assert.deepEqual(externalRequests, []);
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(
    await page.evaluate(() => [
      globalThis.localStorage.length,
      globalThis.sessionStorage.length,
    ]),
    [0, 0],
  );
  process.stdout.write(
    JSON.stringify({
      step: "admin-pickup-review-follow-resolve-scope",
      status: "PASS",
    }) + "\n",
  );
} finally {
  await browser?.close();
  preview.kill();
  await service.close();
}
