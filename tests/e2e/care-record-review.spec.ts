import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { extname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const userWeb = resolve(root, "apps/user-web");
const adminWeb = resolve(root, "apps/admin-web");
const { chromium } = createRequire(resolve(homedir(), "Tools/task20-browser/package.json"))(
  "playwright",
);

const MIME_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
]);

async function startPreview(appRoot: string, spaPaths: readonly string[]) {
  const distRoot = resolve(appRoot, appRoot === adminWeb ? "." : "dist");
  const indexFile = resolve(distRoot, "index.html");
  const server = createServer(async (request, response) => {
    let pathname: string;
    try {
      pathname = decodeURIComponent(new URL(request.url ?? "/", "http://127.0.0.1").pathname);
    } catch {
      response.writeHead(400).end();
      return;
    }
    const relativePath =
      appRoot === adminWeb && pathname.startsWith("/admin/dist/")
        ? pathname.slice("/admin/".length)
        : pathname === "/" ||
            spaPaths.includes(pathname) ||
            (appRoot === adminWeb && pathname.startsWith("/admin/"))
          ? "index.html"
          : pathname.replace(/^\/+/, "");
    const file = resolve(distRoot, relativePath);
    const fromDist = relative(distRoot, file);
    if (
      fromDist === ".." ||
      fromDist.startsWith(`..${sep}`) ||
      (pathname.startsWith("/admin/") && !pathname.startsWith("/admin/dist/"))
    ) {
      if (appRoot === adminWeb && pathname.startsWith("/admin/")) {
        try {
          response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
          response.end(await readFile(indexFile));
        } catch {
          response.writeHead(404).end();
        }
        return;
      }
      response.writeHead(404).end();
      return;
    }
    try {
      const body = await readFile(file);
      response.writeHead(200, {
        "content-type": MIME_TYPES.get(extname(file)) ?? "application/octet-stream",
        "cache-control": "no-store",
      });
      response.end(body);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise<void>((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolvePromise);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Local preview did not start");
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolvePromise, reject) =>
        server.close((error) => (error ? reject(error) : resolvePromise())),
      ),
  };
}

async function goToSpaPath(page, path: string): Promise<void> {
  await page.evaluate((nextPath) => {
    history.pushState({}, "", nextPath);
    dispatchEvent(new PopStateEvent("popstate"));
  }, path);
}

async function assertNoHorizontalOverflow(page, label: string): Promise<void> {
  for (const width of [320, 390, 1365]) {
    await page.setViewportSize({ width, height: 844 });
    const dimensions = await page.evaluate(() => ({
      content: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
      viewport: document.documentElement.clientWidth,
    }));
    assert.ok(
      dimensions.content <= dimensions.viewport + 1,
      `${label} overflows at ${width}px: ${JSON.stringify(dimensions)}`,
    );
  }
}

test(
  "M32F employee review, separate parent acknowledgement, and scoped admin pages work locally",
  { timeout: 120_000 },
  async () => {
    const userPreview = await startPreview(userWeb, [
      "/staff/workbench",
      "/staff/report",
      "/web/parent/home",
    ]);
    const adminPreview = await startPreview(adminWeb, ["/"]);
    let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
    try {
      browser = await chromium.launch({ headless: true });
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const externalRequests: string[] = [];
      const pageErrors: string[] = [];
      await context.route("**/*", async (route) => {
        const url = new URL(route.request().url());
        if (url.protocol === "data:" || url.protocol === "blob:") return route.continue();
        if (url.hostname !== "127.0.0.1") {
          externalRequests.push(url.href);
          return route.abort();
        }
        if (url.pathname.endsWith("/favicon.ico")) return route.fulfill({ status: 204, body: "" });
        return route.continue();
      });

      const page = await context.newPage();
      page.on("pageerror", (error) => pageErrors.push(error.message));
      await page.goto(`${userPreview.url}/staff/workbench`);
      await page.getByRole("link", { name: "打开请假审核" }).click();
      await page.getByRole("heading", { name: "请假审核" }).waitFor();
      const leaveRequest = page
        .locator('#leave-review-list article[data-status="SUBMITTED"]')
        .first();
      await leaveRequest.getByRole("button", { name: "确认通过" }).click();
      await page.locator('#leave-review-list article[data-status="CONFIRMED"]').waitFor();
      await assertNoHorizontalOverflow(page, "User Web leave review");

      await goToSpaPath(page, "/staff/report");
      await page.locator('[data-care-record-action="create"]').click();
      let record = page.locator("[data-care-record-row]").first();
      await record.getByRole("button", { name: "提交人工审核" }).click();
      await record.getByRole("heading", { name: /待人工审核/u }).waitFor();
      await page.locator("[data-care-record-role]").selectOption("CAMPUS_REVIEWER");
      record = page.locator("[data-care-record-row]").first();
      await record.getByRole("button", { name: "审核确认" }).click();
      await record.getByRole("button", { name: "单独发布给家长" }).click();
      await record.getByText("已单独发布给家长").waitFor();

      await goToSpaPath(page, "/web/parent/home");
      const parentRecord = page.locator("[data-parent-care-record-row]");
      assert.equal(
        await parentRecord.count(),
        1,
        JSON.stringify({
          body: await page.evaluate(() => document.body.innerText),
          pageErrors,
        }),
      );
      await parentRecord.getByRole("button", { name: "打开成长日报" }).click();
      await parentRecord.getByText("已打开，尚未确认知悉").waitFor();
      await parentRecord.getByRole("button", { name: "确认本机已知悉" }).click();
      await parentRecord.locator('[role="status"]').getByText("已在本机确认知悉").waitFor();
      await assertNoHorizontalOverflow(page, "User Web parent page");

      await goToSpaPath(page, "/staff/report");
      await page.locator("[data-care-record-role]").selectOption("CAMPUS_REVIEWER");
      await page.locator('[data-care-record-action="revoke"]').click();
      await goToSpaPath(page, "/web/parent/home");
      await page.getByText("当前没有已发布的成长日报。", { exact: true }).waitFor();

      const adminPage = await context.newPage();
      adminPage.on("pageerror", (error) => pageErrors.push(error.message));
      await adminPage.goto(`${adminPreview.url}/admin/leave-review`);
      await adminPage.getByRole("heading", { name: "请假审核与范围统计" }).waitFor();
      const adminLeave = adminPage.locator("main section[aria-label] article").first();
      await adminLeave.getByRole("button", { name: "确认通过" }).click();
      await adminPage
        .locator("[data-admin-leave-notice]")
        .getByText("审核结果已在当前页面的本机模拟数据中更新")
        .waitFor();
      await adminPage.locator("#admin-leave-review-role").selectOption("PLATFORM_ADMIN");
      await adminPage
        .getByText("不展示学生、班级、日期、原因或逐条记录。", { exact: true })
        .waitFor();
      assert.equal(await adminPage.locator("main article[data-admin-leave-id]").count(), 0);

      await adminPage.goto(`${adminPreview.url}/admin/care-record-review`);
      await adminPage.getByRole("heading", { name: "日报审核与范围统计" }).waitFor();
      await adminPage.getByText("模拟日报待复核").waitFor();
      await adminPage.locator("#admin-care-record-role").selectOption("PLATFORM_ADMIN");
      await adminPage.getByRole("heading", { name: "匿名统计" }).waitFor();
      assert.equal(await adminPage.locator("article.field").count(), 0);
      await assertNoHorizontalOverflow(adminPage, "Admin review pages");

      const storage = await Promise.all(
        [page, adminPage].map((clientPage) =>
          clientPage.evaluate(() => ({
            local: localStorage.length,
            session: sessionStorage.length,
          })),
        ),
      );
      assert.deepEqual(storage, [
        { local: 0, session: 0 },
        { local: 0, session: 0 },
      ]);
      assert.deepEqual(externalRequests, []);
      assert.deepEqual(pageErrors, []);
    } finally {
      await browser?.close();
      await userPreview.close();
      await adminPreview.close();
    }
  },
);
