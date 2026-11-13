/* global AbortSignal, fetch, document, innerWidth */
import assert from "node:assert/strict";
import process from "node:process";
import test from "node:test";
import { randomBytes, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL, URL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const root = fileURLToPath(new URL("../..", import.meta.url));
const requireAdmin = createRequire(new URL("../../apps/admin-web/package.json", import.meta.url));
const requireApi = createRequire(new URL("../../apps/api/package.json", import.meta.url));
const { chromium } = requireAdmin("playwright");
const { PrismaPg } = requireApi("@prisma/adapter-pg");

test(
  "invited administrator saves learning settings through real Prisma API, reloads and handles conflict and denied role",
  { timeout: 180000 },
  async () => {
    const database = new URL(process.env.DATABASE_URL ?? "");
    assert.equal(database.hostname, "127.0.0.1");
    assert.equal(database.port, "55432");
    assert.equal(database.pathname, "/student_care_a1310");
    const build = process.env.API_TEST_BUILD_ROOT;
    const evidence = process.env.ADMIN_LEARNING_EVIDENCE_DIR;
    assert.ok(build && evidence && process.env.TASK20_NEXT_DIST_DIR);
    const fromBuild = (path) => import(pathToFileURL(resolve(root, build, path)).href);
    const [
      { PrismaClient },
      { createApiApp },
      { createProductionApiOptions },
      { createInvitePasswordHash },
    ] = await Promise.all([
      fromBuild("src/generated/prisma/client.js"),
      fromBuild("src/nest/api-app.js"),
      fromBuild("src/nest/production-api-options.js"),
      fromBuild("src/nest/invite-auth.service.js"),
    ]);
    const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: database.href }) });
    const tenantId = randomUUID(),
      campusId = randomUUID(),
      ownerId = randomUUID(),
      deniedId = randomUUID(),
      ownerMember = randomUUID(),
      deniedMember = randomUUID();
    const password = randomBytes(24).toString("base64url");
    let app, server, browser, activePage;
    let nextOutput = "";
    const pageErrors = [],
      externalRequests = [];
    await mkdir(evidence, { recursive: true });
    try {
      await prisma.tenant.create({
        data: {
          id: tenantId,
          name: "合成设置浏览器机构",
          slug: "browser-" + tenantId,
          status: "ACTIVE",
        },
      });
      await prisma.campus.create({
        data: { id: campusId, tenantId, name: "合成设置校区", status: "ACTIVE" },
      });
      await prisma.user.createMany({
        data: [ownerId, deniedId].map((id) => ({ id, status: "ACTIVE" })),
      });
      await prisma.membership.createMany({
        data: [
          { id: ownerMember, userId: ownerId, tenantId, status: "ACTIVE" },
          { id: deniedMember, userId: deniedId, tenantId, status: "ACTIVE" },
        ],
      });
      await prisma.membershipCampus.createMany({
        data: [ownerMember, deniedMember].map((membershipId) => ({
          tenantId,
          campusId,
          membershipId,
        })),
      });
      const hash = await createInvitePasswordHash(password);
      const accounts = [
        {
          username: "a310-owner",
          password_hash: hash,
          identity: { actor_id: ownerId, display_name: "合成机构负责人" },
          memberships: [
            {
              tenant_id: tenantId,
              campus_ids: [campusId],
              status: "ACTIVE",
              capabilities: ["identity:read", "learning:institution-setting"],
            },
          ],
        },
        {
          username: "a310-denied",
          password_hash: hash,
          identity: { actor_id: deniedId, display_name: "合成只读员工" },
          memberships: [
            {
              tenant_id: tenantId,
              campus_ids: [campusId],
              status: "ACTIVE",
              capabilities: ["identity:read"],
            },
          ],
        },
      ];
      app = await createApiApp(createProductionApiOptions(prisma, accounts));
      await app.listen(0, "127.0.0.1");
      const apiPort = app.getHttpServer().address().port;
      const reserve = createServer();
      await new Promise((resolvePromise) => reserve.listen(0, "127.0.0.1", resolvePromise));
      const webPort = reserve.address().port;
      await new Promise((resolvePromise) => reserve.close(resolvePromise));
      const baseUrl = "http://127.0.0.1:" + webPort;
      server = spawn(
        process.execPath,
        [
          requireAdmin.resolve("next/dist/bin/next"),
          "dev",
          "--webpack",
          "--hostname",
          "127.0.0.1",
          "--port",
          String(webPort),
        ],
        {
          cwd: resolve(root, "apps/admin-web"),
          windowsHide: true,
          stdio: ["ignore", "pipe", "pipe"],
          env: {
            ...process.env,
            NODE_ENV: "development",
            ADMIN_WEB_LOCAL_NEST_API: "http://127.0.0.1:" + apiPort,
            NEXT_TELEMETRY_DISABLED: "1",
          },
        },
      );
      server.stdout.on("data", (chunk) => {
        nextOutput += String(chunk);
      });
      server.stderr.on("data", (chunk) => {
        nextOutput += String(chunk);
      });
      let ready = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        if (server.exitCode !== null)
          throw new Error("Isolated Next service exited; inspect local sanitized log.");
        try {
          const response = await fetch(baseUrl + "/admin/institution", {
            signal: AbortSignal.timeout(1500),
          });
          if (response.ok) {
            ready = true;
            break;
          }
        } catch {
          // A new isolated Next service may still be compiling its first request.
        }
        await delay(200);
      }
      assert.ok(ready, "Isolated Next service ready");
      browser = await chromium.launch({ headless: true });
      const unhydrated = await browser.newContext({ javaScriptEnabled: false });
      const unhydratedPage = await unhydrated.newPage();
      await unhydratedPage.goto(baseUrl + "/admin/login?next=%2Fadmin%2Finstitution");
      assert.equal(await unhydratedPage.locator("#admin-login-username").isDisabled(), true);
      assert.equal(await unhydratedPage.locator("#admin-login-password").isDisabled(), true);
      assert.equal(
        await unhydratedPage.getByRole("button", { name: "登录", exact: true }).isDisabled(),
        true,
      );
      await unhydrated.close();
      const context = await browser.newContext({ viewport: { width: 1365, height: 900 } });
      await context.route("**/*", (route) => {
        const url = new URL(route.request().url());
        if (url.origin !== baseUrl) {
          externalRequests.push(url.origin);
          return route.abort();
        }
        return route.continue();
      });
      context.on("page", (page) => page.on("pageerror", (error) => pageErrors.push(error.message)));
      const page = await context.newPage();
      activePage = page;
      const panel = page.locator("[data-learning-institution-setting]");
      await page.goto(baseUrl + "/admin/institution");
      await panel.locator('a[href*="/admin/login"]').click();
      await page.locator("#admin-login-username").fill("a310-owner");
      await page.locator("#admin-login-password").fill(password);
      await page.getByRole("button", { name: "登录", exact: true }).click();
      await page.waitForURL("**/admin/institution");
      await page.locator('[data-learning-institution-setting-state="READY"]').waitFor();
      const stale = await context.newPage();
      await stale.goto(baseUrl + "/admin/institution");
      await stale.locator('[data-learning-institution-setting-state="READY"]').waitFor();
      await panel.getByRole("button", { name: "开启学习辅助", exact: true }).dblclick();
      await panel.getByText("本校区已保存开启设置。", { exact: true }).waitFor();
      let stored = await prisma.aIInstitutionSetting.findUniqueOrThrow({
        where: { tenantId_campusId: { tenantId, campusId } },
      });
      assert.equal(stored.enabled, true);
      assert.equal(stored.version, 1, "double click saves once");
      await stale.getByRole("button", { name: "开启学习辅助", exact: true }).click();
      await stale.locator('[data-learning-institution-setting-state="CONFLICT"]').waitFor();
      assert.equal(await stale.locator("[data-learning-institution-setting-toggle]").count(), 0);
      await stale.getByRole("button", { name: "重新读取设置" }).click();
      await stale.locator('[data-learning-institution-setting-state="READY"]').waitFor();
      await stale.close();
      await page.reload();
      await panel.getByRole("button", { name: "关闭学习辅助", exact: true }).waitFor();
      await page.goto(baseUrl + "/admin/login");
      await page.goto(baseUrl + "/admin/institution");
      await panel.getByRole("button", { name: "关闭学习辅助", exact: true }).waitFor();
      for (const width of [1365, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        if (width < 760) {
          await page.waitForFunction(
            () => document.querySelector(".admin-sidebar").getBoundingClientRect().right <= 0,
          );
        }
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
          false,
        );
        await page.screenshot({
          path: resolve(evidence, "institution-" + width + ".png"),
          fullPage: true,
        });
      }
      await panel.getByRole("button", { name: "关闭学习辅助", exact: true }).click();
      await panel.getByText("本校区已保存关闭设置。", { exact: true }).waitFor();
      stored = await prisma.aIInstitutionSetting.findUniqueOrThrow({
        where: { tenantId_campusId: { tenantId, campusId } },
      });
      assert.equal(stored.enabled, false);
      assert.equal(stored.version, 2);
      await context.clearCookies();
      await page.goto(baseUrl + "/admin/login?next=%2Fadmin%2Finstitution");
      await page.locator("#admin-login-username").fill("a310-denied");
      await page.locator("#admin-login-password").fill(password);
      await page.getByRole("button", { name: "登录", exact: true }).click();
      await page.waitForURL("**/admin/institution");
      await page.locator('[data-learning-institution-setting-state="DENIED"]').waitFor();
      assert.equal(await panel.locator("[data-learning-institution-setting-toggle]").count(), 0);
      assert.equal(
        (
          await prisma.aIInstitutionSetting.findUniqueOrThrow({
            where: { tenantId_campusId: { tenantId, campusId } },
          })
        ).version,
        2,
      );
      assert.deepEqual(pageErrors, []);
      assert.deepEqual(externalRequests, []);
      await writeFile(
        resolve(evidence, "browser-result.json"),
        JSON.stringify(
          {
            status: "PASS",
            invitedLoginReturn: true,
            saved: true,
            duplicateClickSingleWrite: true,
            conflictRecovery: true,
            reloadAndReentry: true,
            deniedRole: true,
            viewportWidths: [1365, 390, 320],
            pageErrors,
            externalRequests,
          },
          null,
          2,
        ),
      );
    } catch (failure) {
      if (activePage) {
        await activePage.screenshot({
          path: resolve(evidence, "failure.png"),
          fullPage: true,
          mask: [activePage.locator('input[type="password"]')],
        });
        await writeFile(
          resolve(evidence, "failure.json"),
          JSON.stringify(
            {
              url: activePage.url(),
              pageErrors,
              externalRequests,
              text: await activePage.locator("body").innerText(),
            },
            null,
            2,
          ),
        );
      }
      throw failure;
    } finally {
      if (browser) await browser.close();
      if (server && server.exitCode === null) {
        if (process.platform === "win32")
          await new Promise((resolvePromise) => {
            const killer = spawn("taskkill", ["/pid", String(server.pid), "/t", "/f"], {
              windowsHide: true,
              stdio: "ignore",
            });
            killer.once("exit", resolvePromise);
          });
        else server.kill();
      }
      await writeFile(resolve(evidence, "next-runtime.log"), nextOutput);
      if (app) await app.close();
      await prisma.inviteAuthSession.deleteMany({ where: { userId: { in: [ownerId, deniedId] } } });
      await prisma.aIInstitutionSetting.deleteMany({ where: { tenantId } });
      await prisma.membershipCampus.deleteMany({ where: { tenantId } });
      await prisma.membership.deleteMany({ where: { tenantId } });
      await prisma.user.deleteMany({ where: { id: { in: [ownerId, deniedId] } } });
      await prisma.campus.deleteMany({ where: { tenantId } });
      await prisma.tenant.deleteMany({ where: { id: tenantId } });
      await prisma.$disconnect();
    }
  },
);
