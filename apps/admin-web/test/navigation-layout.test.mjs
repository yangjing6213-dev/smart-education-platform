/* global document, getComputedStyle, innerWidth, matchMedia, process, URL, window */

import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir } from "node:fs/promises";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { chromium } from "playwright";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = await readFile(path.join(appRoot, "index.html"), "utf8");
const source = await readFile(path.join(appRoot, "src", "main.ts"), "utf8");
const css = html.match(/<style>([\s\S]*?)<\/style>/)?.[1];
const routeBody = source.match(/const routes = \[([\s\S]*?)\] as const;/)?.[1];
assert.ok(css, "Admin Web inline stylesheet must remain present.");
assert.ok(routeBody, "Admin Web navigation route list must remain present.");
const routeConstantFiles = [
  ["CARE_RECORD_REVIEW_ROUTE", "src/pages/care-record-review.tsx"],
  ["NOTICE_REVIEW_ROUTE", "src/local-review/notice-shared.ts"],
  ["SUPPLY_REQUEST_REVIEW_ROUTE", "src/local-review/supply-request.ts"],
];
const routeConstants = new Map(
  await Promise.all(
    routeConstantFiles.map(async ([name, file]) => {
      const moduleSource = await readFile(path.join(appRoot, file), "utf8");
      const value = moduleSource.match(new RegExp(`export const ${name} = "([^"]+)"`, "u"))?.[1];
      assert.ok(value, `${name} must keep a literal route value.`);
      return [name, value];
    }),
  ),
);
const routes = [...routeBody.matchAll(/\[\s*(?:"([^"]+)"|([A-Z_]+)),\s*"([^"]+)"\s*\]/gu)].map(
  ([, href, routeName, label]) => ({
    href: href ?? routeConstants.get(routeName) ?? routeName,
    label,
  }),
);
assert.equal(routes.length, 22, "All current admin destinations must remain available.");

function shellFixture() {
  const links = routes
    .map(({ href, label }) => `<button class="save" data-route="${href}">${label}</button>`)
    .join("");
  return `<!doctype html><html lang="zh-CN"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body>
    <div id="app"><div class="shell">
      <header class="topbar">
        <strong class="brand">机构管理工作台</strong>
        <span>同芯学园 · 模拟东校区</span>
        <button class="nav-toggle" type="button" aria-controls="admin-navigation" aria-expanded="false">菜单</button>
        <nav id="admin-navigation" aria-label="机构管理页面">${links}</nav>
      </header>
      <main class="content"><div class="heading-row"><div><h1>家长关系审核</h1><p>仅显示本机合成数据。</p></div></div><section class="panel"><p>页面内容区域</p></section></main>
    </div></div>
    <script>
      const shell = document.querySelector(".shell");
      const toggle = document.querySelector(".nav-toggle");
      toggle.addEventListener("click", () => {
        const open = shell.classList.toggle("nav-open");
        toggle.setAttribute("aria-expanded", String(open));
      });
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          shell.classList.remove("nav-open");
          toggle.setAttribute("aria-expanded", "false");
        }
      });
    </script></body></html>`;
}

test("admin desktop has left navigation and right content without changing destinations", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
    await page.setContent(shellFixture());
    const layout = await page.evaluate(() => {
      const sidebar = document.querySelector(".topbar").getBoundingClientRect();
      const navigation = document.querySelector("#admin-navigation").getBoundingClientRect();
      const content = document.querySelector("main").getBoundingClientRect();
      const nav = document.querySelector("#admin-navigation");
      return {
        sidebarLeft: sidebar.left,
        sidebarWidth: sidebar.width,
        sidebarHeight: sidebar.height,
        navLeft: navigation.left,
        navRight: navigation.right,
        contentLeft: content.left,
        contentWidth: content.width,
        navScrollWidth: nav.scrollWidth,
        navClientWidth: nav.clientWidth,
        pageScrollWidth: document.documentElement.scrollWidth,
        menuCount: nav.querySelectorAll("button[data-route]").length,
      };
    });

    assert.equal(layout.sidebarLeft, 0);
    assert.ok(layout.sidebarWidth >= 220 && layout.sidebarWidth <= 300, JSON.stringify(layout));
    assert.ok(layout.sidebarHeight >= 800, JSON.stringify(layout));
    assert.ok(
      layout.navLeft >= 0 && layout.navRight <= layout.sidebarWidth,
      JSON.stringify(layout),
    );
    assert.ok(layout.contentLeft >= layout.sidebarWidth, JSON.stringify(layout));
    assert.ok(layout.contentWidth > 900, JSON.stringify(layout));
    assert.equal(layout.navScrollWidth, layout.navClientWidth, JSON.stringify(layout));
    assert.equal(layout.pageScrollWidth, 1365, JSON.stringify(layout));
    assert.equal(layout.menuCount, 22);
  } finally {
    await browser.close();
  }
});

test("admin mobile keeps the page in bounds and opens a left menu drawer", async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.setContent(shellFixture());
    const before = await page.evaluate(() => {
      const nav = document.querySelector("#admin-navigation");
      const toggle = document.querySelector(".nav-toggle");
      const rect = nav.getBoundingClientRect();
      return {
        overflow: document.documentElement.scrollWidth > innerWidth,
        toggleVisible: toggle.getBoundingClientRect().width > 0,
        expanded: toggle.getAttribute("aria-expanded"),
        navLeft: rect.left,
        navRight: rect.right,
        navWidth: rect.width,
      };
    });
    assert.equal(before.overflow, false);
    assert.equal(before.toggleVisible, true);
    assert.equal(before.expanded, "false");
    assert.ok(before.navRight <= 0, JSON.stringify(before));

    await page.locator(".nav-toggle").click();
    await page.waitForTimeout(220);
    const opened = await page.evaluate(() => {
      const nav = document.querySelector("#admin-navigation");
      const toggle = document.querySelector(".nav-toggle");
      const rect = nav.getBoundingClientRect();
      return {
        expanded: toggle.getAttribute("aria-expanded"),
        left: rect.left,
        width: rect.width,
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    assert.equal(opened.expanded, "true");
    assert.equal(opened.left, 0, JSON.stringify(opened));
    assert.ok(opened.width <= 300, JSON.stringify(opened));
    assert.equal(opened.overflow, false);

    await page.keyboard.press("Escape");
    assert.equal(await page.locator(".nav-toggle").getAttribute("aria-expanded"), "false");

    await page.setViewportSize({ width: 320, height: 568 });
    const narrow = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > innerWidth,
      toggleRight: document.querySelector(".nav-toggle").getBoundingClientRect().right,
    }));
    assert.equal(narrow.overflow, false, JSON.stringify(narrow));
    assert.ok(narrow.toggleRight <= 320, JSON.stringify(narrow));
    await page.locator(".nav-toggle").click();
    await page.waitForTimeout(220);
    const narrowDrawer = await page.locator("#admin-navigation").boundingBox();
    assert.equal(narrowDrawer?.x, 0);
    assert.ok((narrowDrawer?.width ?? 321) <= 280);
    await page.keyboard.press("Escape");
  } finally {
    await browser.close();
  }
});

test("application navigation exposes an accessible drawer control on small screens", () => {
  assert.equal(
    [...source.matchAll(/appRoot\.innerHTML\s*=/gu)].length,
    1,
    "Only the shared renderer may replace admin page markup.",
  );
  assert.ok(
    /function renderAdminMarkup\(markup: string\): void\s*\{\s*appRoot\.innerHTML = markup;\s*ensureAdminNavigation\(\);/u.test(
      source,
    ),
  );
  assert.ok(/function ensureAdminNavigation\(\): void/u.test(source));
  assert.ok(/renderAdminMarkup\(renderLearningSafety\(/u.test(source));
  assert.ok(
    /ensureAdminNavigation\(\);\s*appRoot\s*\.querySelector<HTMLSelectElement>\("#admin-care-record-profile"\)/u.test(
      source,
    ),
  );
  assert.ok(/navToggle\.setAttribute\("aria-controls",\s*"admin-navigation"\)/u.test(source));
  assert.ok(/navToggle\.setAttribute\("aria-expanded",\s*"false"\)/u.test(source));
  assert.ok(/navToggle\.addEventListener\("click"/u.test(source));
  assert.ok(/classList\.toggle\("nav-open"\)/u.test(source));
  assert.ok(/addEventListener\("keydown"/u.test(source));
});

test("built admin routes keep the shared sidebar and right content across all destinations", async (context) => {
  const distRoot = path.join(appRoot, "dist");
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (url.pathname === "/favicon.ico") {
      response.writeHead(204);
      response.end();
      return;
    }
    if (url.pathname.startsWith("/local/") || url.pathname.startsWith("/admin/local/")) {
      response.writeHead(503, { "Content-Type": "application/json; charset=utf-8" });
      response.end('{"message":"本机服务未启动"}');
      return;
    }
    if (
      url.pathname === "/" ||
      (url.pathname.startsWith("/admin/") && !url.pathname.includes("/dist/"))
    ) {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(html);
      return;
    }
    const pathname = url.pathname.replace(/^\/admin(?=\/dist\/)/u, "");
    if (!pathname.startsWith("/dist/")) {
      response.writeHead(404);
      response.end();
      return;
    }
    const file = path.resolve(distRoot, pathname.slice("/dist/".length));
    if (!file.startsWith(`${distRoot}${path.sep}`)) {
      response.writeHead(400);
      response.end();
      return;
    }
    try {
      const content = await readFile(file);
      response.writeHead(200, {
        "Content-Type": file.endsWith(".js")
          ? "text/javascript; charset=utf-8"
          : "application/octet-stream",
      });
      response.end(content);
    } catch {
      response.writeHead(404);
      response.end();
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  context.after(
    () =>
      new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  );
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;
  const browser = await chromium.launch({ headless: true });
  context.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
  const pageErrors = [];
  const failedRequests = [];
  const externalRequests = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (request) =>
    failedRequests.push(`${request.url()}: ${request.failure()?.errorText}`),
  );
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().includes("status of 503"))
      pageErrors.push(message.text());
  });
  await page.route("**/*", async (route) => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.port === "4317" && requestUrl.hostname === "127.0.0.1") {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: '{"message":"本机服务未启动"}',
      });
      return;
    }
    if (requestUrl.origin !== origin) {
      externalRequests.push(requestUrl.href);
      await route.abort();
      return;
    }
    await route.continue();
  });
  await page.goto(`${origin}/admin/home-content`);
  await page.waitForTimeout(500);
  assert.equal(
    await page.locator("#admin-navigation").count(),
    1,
    JSON.stringify({ url: page.url(), pageErrors, failedRequests }),
  );
  if (process.env.ADMIN_NAV_EVIDENCE_DIR) {
    const evidenceDir = path.resolve(process.env.ADMIN_NAV_EVIDENCE_DIR);
    await mkdir(evidenceDir, { recursive: true });
    await page.screenshot({
      path: path.join(evidenceDir, "admin-sidebar-and-content.png"),
      fullPage: true,
    });
  }

  for (const { href } of routes) {
    await page.locator(`#admin-navigation button[data-route="${href}"]`).click();
    await page.waitForFunction((expectedPath) => window.location.pathname === expectedPath, href);
    const layout = await page.evaluate(() => {
      const sidebar = document.querySelector(".topbar").getBoundingClientRect();
      const content = document.querySelector(".shell > :not(.topbar)").getBoundingClientRect();
      const nav = document.querySelector("#admin-navigation");
      return {
        sidebarWidth: sidebar.width,
        sidebarHeight: sidebar.height,
        contentLeft: content.left,
        contentWidth: content.width,
        navCount: nav.querySelectorAll("button[data-route]").length,
        activePath: nav.querySelector('[aria-current="page"]')?.getAttribute("data-route"),
        overflow: document.documentElement.scrollWidth > innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        viewportWidth: innerWidth,
        overflowElements: Array.from(document.querySelectorAll("body *"))
          .map((element) => ({ element, rect: element.getBoundingClientRect() }))
          .filter(({ rect }) => rect.right > innerWidth + 1)
          .slice(0, 5)
          .map(({ element, rect }) => ({
            tag: element.tagName,
            className: element.className,
            right: rect.right,
            width: rect.width,
          })),
      };
    });
    assert.ok(
      layout.sidebarWidth >= 220 && layout.sidebarWidth <= 300,
      `${href}: ${JSON.stringify(layout)}`,
    );
    assert.ok(layout.sidebarHeight >= 800, `${href}: ${JSON.stringify(layout)}`);
    assert.ok(layout.contentLeft >= layout.sidebarWidth, `${href}: ${JSON.stringify(layout)}`);
    assert.ok(layout.contentWidth > 900, `${href}: ${JSON.stringify(layout)}`);
    assert.equal(layout.navCount, 22, href);
    assert.equal(layout.activePath, href, href);
    assert.equal(layout.overflow, false, `${href}: ${JSON.stringify(layout)}`);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(220);
  const mobile = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > innerWidth,
    expanded: document.querySelector(".nav-toggle").getAttribute("aria-expanded"),
    navRight: document.querySelector("#admin-navigation").getBoundingClientRect().right,
    navStyle: {
      position: getComputedStyle(document.querySelector("#admin-navigation")).position,
      transform: getComputedStyle(document.querySelector("#admin-navigation")).transform,
      width: getComputedStyle(document.querySelector("#admin-navigation")).width,
      media: matchMedia("(max-width: 760px)").matches,
    },
  }));
  assert.equal(mobile.overflow, false);
  assert.equal(mobile.expanded, "false");
  assert.ok(mobile.navRight <= 0, JSON.stringify(mobile));
  const hiddenMenuItemCanReceiveFocus = await page
    .locator('#admin-navigation button[data-route="/admin/institution"]')
    .evaluate((button) => {
      button.focus();
      return document.activeElement === button;
    });
  assert.equal(hiddenMenuItemCanReceiveFocus, false);
  await page.locator(".nav-toggle").click();
  await page.waitForTimeout(200);
  const opened = await page.locator("#admin-navigation").boundingBox();
  assert.equal(opened?.x, 0);
  assert.ok((opened?.width ?? 301) <= 300);
  await page.keyboard.press("Escape");
  await page.waitForFunction(
    () => document.querySelector(".nav-toggle").getAttribute("aria-expanded") === "false",
  );
  await page.setViewportSize({ width: 320, height: 568 });
  await page.waitForTimeout(220);
  const narrow = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > innerWidth,
    navRight: document.querySelector("#admin-navigation").getBoundingClientRect().right,
  }));
  assert.equal(narrow.overflow, false, JSON.stringify(narrow));
  assert.ok(narrow.navRight <= 0, JSON.stringify(narrow));
  await page.locator(".nav-toggle").click();
  await page.waitForTimeout(200);
  const narrowDrawer = await page.locator("#admin-navigation").boundingBox();
  assert.equal(narrowDrawer?.x, 0);
  assert.ok((narrowDrawer?.width ?? 281) <= 280);
  await page.keyboard.press("Escape");
  const expectedSessionCancellations = failedRequests.filter((failure) => {
    const [requestUrl, reason] = failure.split(": net::");
    if (!requestUrl || reason !== "ERR_ABORTED") return false;
    const url = new URL(requestUrl);
    return url.origin === origin && url.pathname === "/local/sessions";
  });
  const unexpectedFailedRequests = failedRequests.filter(
    (failure) => !expectedSessionCancellations.includes(failure),
  );
  assert.ok(expectedSessionCancellations.length <= 1, JSON.stringify(failedRequests));
  assert.deepEqual(externalRequests, []);
  assert.deepEqual(unexpectedFailedRequests, []);
  assert.deepEqual(pageErrors, []);
});
