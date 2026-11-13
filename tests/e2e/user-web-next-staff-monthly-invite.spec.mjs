import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import { fileURLToPath, pathToFileURL, URL } from "node:url";
import {
  assertTaskOwnedDirectory,
  resolveReleaseBrowserPaths,
  resolveLocalTestDatabase,
} from "./helpers/release-browser-paths.mjs";
import {
  capture,
  evaluate,
  navigate,
  startNextBrowser,
  waitForExpression,
  waitForHttp,
} from "./helpers/user-web-next-browser.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const { PrismaPg } = createRequire(join(repositoryRoot, "apps/api/package.json"))(
  "@prisma/adapter-pg",
);
const {
  artifactRoot,
  apiRuntimeRoot: apiRuntime,
  userDistDirectory: distDir,
  adminDistDirectory,
} = resolveReleaseBrowserPaths(repositoryRoot);
const [
  { createApiApp },
  { createProductionApiOptions },
  { createInvitePasswordHash },
  { PrismaClient },
] = await Promise.all([
  import(pathToFileURL(join(apiRuntime, "nest/api-app.js")).href),
  import(pathToFileURL(join(apiRuntime, "nest/production-api-options.js")).href),
  import(pathToFileURL(join(apiRuntime, "nest/invite-auth.service.js")).href),
  import(pathToFileURL(join(apiRuntime, "generated/prisma/client.js")).href),
]);

async function reservePort() {
  for (let attempt = 0; attempt < 10; attempt++) {
    const server = createServer();
    await new Promise((accept, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", accept);
    });
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    await new Promise((accept, reject) =>
      server.close((error) => (error ? reject(error) : accept())),
    );
    if (address.port >= 49152) return address.port;
  }
  throw new Error("未能分配本机浏览器可用端口。");
}

async function stopOwnedChild(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform === "win32") {
    assert.ok(Number.isSafeInteger(child.pid) && child.pid > 0);
    try {
      execFileSync("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], {
        windowsHide: true,
        stdio: "ignore",
      });
    } catch {
      if (child.exitCode === null && child.signalCode === null) child.kill();
    }
  } else child.kill();
  await Promise.race([new Promise((accept) => child.once("exit", accept)), delay(5000)]);
  assert.ok(child.exitCode !== null || child.signalCode !== null, "本次管理 Next 进程必须退出。");
}

// Scrolling uses CDP DOM commands; interaction uses real browser mouse/keyboard events.
async function click(page, selector) {
  await waitForExpression(
    page,
    `document.querySelector(${JSON.stringify(selector)}) && !document.querySelector(${JSON.stringify(selector)}).disabled`,
    "操作入口未就绪：" + selector,
  );
  const { root } = await page.send("DOM.getDocument", { depth: 0 });
  const { nodeId } = await page.send("DOM.querySelector", { nodeId: root.nodeId, selector });
  assert.ok(nodeId, "操作入口必须存在。");
  await page.send("DOM.scrollIntoViewIfNeeded", { nodeId });
  const point = await evaluate(
    page,
    `(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    const rect = element.getBoundingClientRect(), x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
    const top = document.elementFromPoint(x, y);
    return {x,y,enabled:!element.disabled,visible:rect.width>0&&rect.height>0,hit:top===element||element.contains(top)};
  })()`,
  );
  assert.ok(point.enabled && point.visible && point.hit, "操作入口不能被遮挡：" + selector);
  for (const type of ["mouseMoved", "mousePressed", "mouseReleased"])
    await page.send("Input.dispatchMouseEvent", {
      type,
      x: point.x,
      y: point.y,
      ...(type === "mouseMoved" ? {} : { button: "left", clickCount: 1 }),
    });
}

async function key(page, value) {
  const code = { Home: 36, ArrowDown: 40, Enter: 13 }[value];
  for (const type of ["keyDown", "keyUp"])
    await page.send("Input.dispatchKeyEvent", {
      type,
      key: value,
      code: value,
      windowsVirtualKeyCode: code,
    });
}
async function selectOption(page, name, index, value) {
  const selector = `select[name="${name}"]`;
  await click(page, selector);
  await key(page, "Home");
  for (let step = 0; step < index; step++) await key(page, "ArrowDown");
  await key(page, "Enter");
  assert.equal(
    await evaluate(page, `document.querySelector(${JSON.stringify(selector)}).value`),
    value,
  );
}
async function viewport(page, width) {
  await page.send("Emulation.setDeviceMetricsOverride", {
    width,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
}
async function userState(page, status, version) {
  await waitForExpression(
    page,
    `document.querySelector('[data-staff-monthly-state="READY"]') && document.querySelector('[data-staff-monthly-status="${status}"]')?.textContent.includes('第 ${version} 版')`,
    `员工总结应显示 ${status} 第 ${version} 版。`,
  );
}
async function adminState(page, status, version) {
  await waitForExpression(
    page,
    `document.querySelector('[data-monthly-feedback-state="READY"]') && document.querySelector('[data-monthly-feedback-status="${status}"]')?.textContent.includes('第 ${version} 版')`,
    `管理总结应显示 ${status} 第 ${version} 版。`,
  );
}

function monitor(origin, initialPhase) {
  const state = {
    phase: initialPhase,
    calls: [],
    failures: [],
    exceptions: [],
    loadingFailures: [],
  };
  const callsById = new Map();
  state.event = (method, params) => {
    if (method === "Network.requestWillBeSent") {
      const request = params.request ?? {};
      if (!/^https?:/u.test(request.url ?? "")) return;
      const url = new URL(request.url);
      const call = {
        path: url.pathname,
        method: request.method,
        origin: url.origin,
        query: url.search,
        phase: state.phase,
        authorization: Object.keys(request.headers ?? {}).some(
          (name) => name.toLowerCase() === "authorization",
        ),
      };
      // Never retain login request bodies, headers, passwords or token values.
      if (url.pathname.includes("monthly-feedback") && request.postData) {
        try {
          call.body = JSON.parse(request.postData);
        } catch {
          call.invalidBody = true;
        }
      }
      state.calls.push(call);
      callsById.set(params.requestId, call);
    }
    if (method === "Network.responseReceived" && params.response?.status >= 400) {
      const call = callsById.get(params.requestId);
      const responseUrl = new URL(params.response.url);
      state.failures.push({
        phase: call?.phase ?? state.phase,
        path: responseUrl.pathname,
        status: params.response.status,
        method: call?.method,
      });
    }
    if (method === "Network.loadingFailed") {
      const call = callsById.get(params.requestId);
      state.loadingFailures.push({
        path: call?.path,
        origin: call?.origin,
        query: call?.query,
        error: params.errorText,
        canceled: params.canceled === true,
      });
    }
    if (method === "Runtime.exceptionThrown") state.exceptions.push("Runtime.exceptionThrown");
    if (method === "Runtime.consoleAPICalled" && params.type === "error")
      state.exceptions.push("console.error");
  };
  state.verify = () => {
    assert.deepEqual(
      state.calls.filter((call) => call.origin !== origin),
      [],
      "不能访问外部服务。",
    );
    assert.equal(
      state.calls.some((call) => call.path.startsWith("/local/") || call.authorization),
      false,
      "禁止旧 local 请求及浏览器 Authorization。",
    );
    const unexpected = state.failures.filter(
      ({ phase, path, status, method }) =>
        !(
          (phase === "login" && status === 401 && method === "GET" && path === "/api-local/me") ||
          (phase === "source-conflict" &&
            status === 409 &&
            method === "POST" &&
            /\/api\/admin\/monthly-feedback\/[0-9a-f-]{36}\/publish$/u.test(path)) ||
          (phase === "revoked" &&
            status === 403 &&
            method === "GET" &&
            path === "/api/admin/monthly-feedback") ||
          (phase === "expired" &&
            status === 401 &&
            method === "GET" &&
            ["/api-local/me", "/api-local/staff/monthly-feedback"].includes(path))
        ),
    );
    assert.deepEqual(unexpected, [], "未分类的 HTTP 错误不能忽略。");
    assert.deepEqual(state.exceptions, [], "浏览器不能出现脚本异常或 console.error。");
    const failed = state.loadingFailures.filter(
      (entry) =>
        !(
          entry.canceled &&
          entry.error === "net::ERR_ABORTED" &&
          entry.origin === origin &&
          entry.query?.includes("_rsc=") &&
          /^(?:\/admin\/|\/web\/)/u.test(entry.path ?? "")
        ),
    );
    assert.deepEqual(failed, [], "仅允许页面导航造成且已分类的同源 RSC 取消。");
  };
  return state;
}

async function noBrowserSecrets(page) {
  const result = await evaluate(
    page,
    `(() => {
    const storage = JSON.stringify(localStorage) + JSON.stringify(sessionStorage);
    return {
      visibleSessionCookie: /student_care_(?:admin|local)_session=/.test(document.cookie),
      storedCredential: /access_token|refresh_token|Bearer\\s+[A-Za-z0-9_-]{40,}|password_hash/i.test(storage)
    };
  })()`,
  );
  assert.deepEqual(result, { visibleSessionCookie: false, storedCredential: false });
}

test(
  "A345 real invited browsers complete internal class monthly workflow and fail closed",
  { timeout: 240000 },
  async (t) => {
    const rootUrl = resolveLocalTestDatabase(process.env);
    const databaseName = `student_care_a1345_${randomUUID().replaceAll("-", "")}`;
    assert.match(databaseName, /^student_care_a1345_[a-f0-9]{32}$/u);
    const isolatedUrl = new URL(rootUrl);
    isolatedUrl.pathname = "/" + databaseName;
    assert.notEqual(isolatedUrl.pathname, rootUrl.pathname);
    const newClient = (connectionString) =>
      new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
    const adminDatabase = newClient(rootUrl.href);
    let created = false,
      prisma,
      api,
      adminProcess;
    const changedEnv = [
      "USER_WEB_LOCAL_NEST_API",
      "USER_WEB_LOCAL_PREVIEW",
      "TASK20_NEXT_DIST_DIR",
    ];
    const priorEnv = Object.fromEntries(changedEnv.map((name) => [name, process.env[name]]));
    try {
      await adminDatabase.$connect();
      await adminDatabase.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
      created = true;
      try {
        execFileSync(
          process.execPath,
          [
            "node_modules/prisma/build/index.js",
            "migrate",
            "deploy",
            "--config",
            "prisma7.config.ts",
          ],
          {
            cwd: join(repositoryRoot, "apps/api"),
            env: { ...process.env, DATABASE_URL: isolatedUrl.href },
            stdio: "pipe",
            windowsHide: true,
          },
        );
      } catch {
        throw new Error("A345 随机本机数据库迁移失败；没有输出连接凭据。");
      }
      prisma = newClient(isolatedUrl.href);
      await prisma.$connect();
      const tenantId = randomUUID(),
        campusId = randomUUID(),
        classRef = "合成月度甲班";
      const month = new Date().toISOString().slice(0, 7);
      const writer = {
        userId: randomUUID(),
        membershipId: randomUUID(),
        username: "synthetic.monthly.writer",
      };
      const reviewer = {
        userId: randomUUID(),
        membershipId: randomUUID(),
        username: "synthetic.monthly.reviewer",
      };
      const people = [writer, reviewer];
      await prisma.tenant.create({
        data: { id: tenantId, name: "合成月度机构", slug: `monthly-${tenantId}`, status: "ACTIVE" },
      });
      await prisma.campus.create({
        data: { id: campusId, tenantId, name: "合成月度校区", status: "ACTIVE" },
      });
      await prisma.user.createMany({
        data: people.map((person) => ({ id: person.userId, status: "ACTIVE" })),
      });
      await prisma.membership.createMany({
        data: people.map((person) => ({
          id: person.membershipId,
          tenantId,
          userId: person.userId,
          status: "ACTIVE",
        })),
      });
      await prisma.membershipCampus.createMany({
        data: people.map((person) => ({ tenantId, campusId, membershipId: person.membershipId })),
      });
      await prisma.membershipClass.createMany({
        data: people.map((person) => ({
          tenantId,
          campusId,
          membershipId: person.membershipId,
          classRef,
        })),
      });
      const daily = await prisma.staffDailyReport.create({
        data: {
          tenantId,
          campusId,
          id: randomUUID(),
          classRef,
          date: new Date(`${month}-01T00:00:00.000Z`),
          arrival: "ARRIVED_AS_PLANNED",
          homework: "COMPLETED",
          activity: "PARTICIPATED",
          classroom: "ROUTINE",
          followUp: "NONE",
          status: "CONFIRMED",
          createdByMembershipId: writer.membershipId,
          reviewedByMembershipId: reviewer.membershipId,
          updatedByMembershipId: reviewer.membershipId,
        },
      });
      const password = `Synthetic-${randomUUID()}!`;
      const passwordHash = await createInvitePasswordHash(password);
      const accounts = people.map((person) => ({
        username: person.username,
        password_hash: passwordHash,
        identity: {
          actor_id: person.userId,
          display_name: person === writer ? "合成填写员工" : "合成审核负责人",
        },
        memberships: [
          {
            tenant_id: tenantId,
            campus_ids: [campusId],
            status: "ACTIVE",
            capabilities: [
              "identity:read",
              "memberships:read",
              "feedback:read",
              ...(person === writer
                ? ["task:read", "feedback:create", "feedback:submit"]
                : ["feedback:review", "feedback:publish"]),
            ],
          },
        ],
      }));
      api = await createApiApp(createProductionApiOptions(prisma, accounts));
      await api.listen(await reservePort(), "127.0.0.1");
      const address = api.getHttpServer().address();
      assert.ok(address && typeof address !== "string");
      const apiBase = `http://127.0.0.1:${address.port}`;
      process.env.USER_WEB_LOCAL_NEST_API = apiBase;
      process.env.USER_WEB_LOCAL_PREVIEW = "true";
      assertTaskOwnedDirectory(
        join(repositoryRoot, "apps/user-web"),
        join(repositoryRoot, "apps/user-web", distDir),
      );
      process.env.TASK20_NEXT_DIST_DIR = distDir;

      const adminPort = await reservePort(),
        adminOrigin = `http://127.0.0.1:${adminPort}`;
      let adminOutput = "";
      const adminPackage = join(repositoryRoot, "apps/admin-web");
      assertTaskOwnedDirectory(adminPackage, join(adminPackage, adminDistDirectory));
      adminProcess = spawn(
        process.execPath,
        [
          join(adminPackage, "node_modules/next/dist/bin/next"),
          "dev",
          "--webpack",
          "--hostname",
          "127.0.0.1",
          "--port",
          String(adminPort),
        ],
        {
          cwd: adminPackage,
          windowsHide: true,
          stdio: ["ignore", "pipe", "pipe"],
          env: {
            ...process.env,
            NODE_ENV: "development",
            NEXT_TELEMETRY_DISABLED: "1",
            CI: "1",
            ADMIN_WEB_LOCAL_NEST_API: apiBase,
            ADMIN_WEB_NEST_API_BASE_URL: "",
            TASK20_NEXT_DIST_DIR: adminDistDirectory,
          },
        },
      );
      adminProcess.stdout.on("data", (chunk) => {
        adminOutput += chunk.toString();
      });
      adminProcess.stderr.on("data", (chunk) => {
        adminOutput += chunk.toString();
      });
      for (const path of ["/admin/login", "/admin/monthly-feedback-review"]) {
        const response = await waitForHttp(adminOrigin + path, adminProcess, () => adminOutput, {
          serviceName: "A345管理网页",
          timeoutMs: 90000,
        });
        assert.equal(response.status, 200);
        await response.body?.cancel();
      }

      await t.test(
        "employee and reviewer operate both pages using browser input",
        async (browserTest) => {
          const browser = await startNextBrowser(browserTest, {
            repositoryRoot,
            skipLegacyApi: true,
          });
          const userEvents = monitor(browser.baseUrl, "login"),
            adminEvents = monitor(adminOrigin, "login");
          const userPage = await browser.connectPage(userEvents.event);
          const adminPage = await browser.createIsolatedPage(adminEvents.event);
          await viewport(userPage, 1365);
          await viewport(adminPage, 1365);
          await navigate(
            userPage,
            `${browser.baseUrl}/web/login?next=%2Fweb%2Fstaff%2Fworkbench`,
            "document.querySelector('input[name=\"username\"]') && !document.querySelector('input[name=\"username\"]').disabled",
          );
          await click(userPage, 'input[name="username"]');
          await userPage.send("Input.insertText", { text: writer.username });
          await click(userPage, 'input[name="password"]');
          await userPage.send("Input.insertText", { text: password });
          await click(userPage, '[data-invite-login] button[type="submit"]');
          await waitForExpression(
            userPage,
            "location.pathname === '/web/staff/workbench' && document.querySelector('[data-staff-monthly-entry]')",
            "登录后工作台应提供月度总结入口。",
          );
          userEvents.phase = "workflow";
          await click(userPage, "[data-staff-monthly-entry]");
          await waitForExpression(
            userPage,
            "location.pathname === '/web/staff/monthly' && document.querySelector('[data-staff-monthly-state=READY]') && document.querySelector('[data-staff-monthly-form]')",
            "月度页应允许授权员工填写。",
          );
          assert.equal(
            await evaluate(userPage, "document.querySelector('input[name=month]').value"),
            month,
          );
          await selectOption(userPage, "learningParticipation", 1, "PROGRESSING");
          await click(userPage, "[data-staff-monthly-save]");
          let version = 1;
          await userState(userPage, "DRAFT", version);
          let report = await prisma.monthlyFeedbackReport.findFirstOrThrow({
            where: { tenantId, campusId, classRef, month },
          });
          assert.equal(report.learningParticipation, "PROGRESSING");
          assert.equal(report.createdByMembershipId, writer.membershipId);
          const reportId = report.id;
          await click(userPage, '[data-staff-monthly-edit="0"]');
          await selectOption(userPage, "dailyHabits", 2, "FOLLOW_UP");
          assert.equal(
            await evaluate(
              userPage,
              "document.querySelector('[data-staff-monthly-submit=\"0\"]').disabled",
            ),
            true,
            "正在编辑时必须先保存，不能提交数据库里的旧草稿。",
          );
          await click(userPage, "[data-staff-monthly-save]");
          await userState(userPage, "DRAFT", ++version);
          assert.equal(
            await evaluate(
              userPage,
              "document.querySelector('[data-staff-monthly-submit=\"0\"]').disabled",
            ),
            false,
            "保存完成后应允许提交新版本草稿。",
          );
          await click(userPage, '[data-staff-monthly-submit="0"]');
          await userState(userPage, "SUBMITTED", ++version);

          await navigate(
            adminPage,
            `${adminOrigin}/admin/login?next=/admin/monthly-feedback-review`,
            "document.querySelector('#admin-login-username') && !document.querySelector('#admin-login-username').disabled",
          );
          await click(adminPage, "#admin-login-username");
          await adminPage.send("Input.insertText", { text: reviewer.username });
          await click(adminPage, "#admin-login-password");
          await adminPage.send("Input.insertText", { text: password });
          await click(adminPage, 'button[type="submit"]');
          await waitForExpression(
            adminPage,
            "location.pathname === '/admin/monthly-feedback-review'",
            "管理登录后应返回班级总结审核页。",
          );
          await adminState(adminPage, "SUBMITTED", version);
          adminEvents.phase = "workflow";
          await click(adminPage, '[data-monthly-feedback-action="return"]');
          await adminState(adminPage, "RETURNED", ++version);
          await click(userPage, "[data-staff-monthly-refresh]");
          await userState(userPage, "RETURNED", version);
          assert.equal(
            await evaluate(
              userPage,
              "document.querySelectorAll('[data-staff-monthly-submit]').length",
            ),
            0,
          );
          await click(userPage, '[data-staff-monthly-edit="0"]');
          await selectOption(userPage, "activityParticipation", 2, "FOLLOW_UP");
          await click(userPage, "[data-staff-monthly-save]");
          await userState(userPage, "DRAFT", ++version);
          await click(userPage, '[data-staff-monthly-submit="0"]');
          await userState(userPage, "SUBMITTED", ++version);
          await click(adminPage, "[data-monthly-feedback-state] button");
          await adminState(adminPage, "SUBMITTED", version);
          await click(adminPage, '[data-monthly-feedback-action="confirm"]');
          await adminState(adminPage, "CONFIRMED", ++version);

          const staleVersion = version;
          await prisma.staffDailyReport.updateMany({
            where: { tenantId, campusId, id: daily.id },
            data: { version: { increment: 1 } },
          });
          adminEvents.phase = "source-conflict";
          await click(adminPage, '[data-monthly-feedback-action="publish"]');
          await adminState(adminPage, "REVIEW_REQUIRED", ++version);
          assert.match(
            await evaluate(
              adminPage,
              "document.querySelector('[data-monthly-feedback-state]').textContent",
            ),
            /本次操作未保存/u,
          );
          const conflictCalls = adminEvents.calls.filter(
            (call) => call.phase === "source-conflict",
          );
          assert.equal(
            conflictCalls.filter((call) => call.method === "POST").length,
            1,
            "409 后不能自动重试写入。",
          );
          assert.deepEqual(conflictCalls.find((call) => call.method === "POST").body, {
            version: staleVersion,
          });
          assert.equal(
            conflictCalls.filter(
              (call) => call.method === "GET" && call.path === "/api/admin/monthly-feedback",
            ).length,
            1,
          );
          assert.equal(
            adminEvents.failures.filter(
              (failure) => failure.phase === "source-conflict" && failure.status === 409,
            ).length,
            1,
          );
          report = await prisma.monthlyFeedbackReport.findFirstOrThrow({
            where: { tenantId, campusId, id: reportId },
          });
          assert.equal(report.status, "REVIEW_REQUIRED");
          assert.equal(report.reviewedByMembershipId, null);
          adminEvents.phase = "workflow";

          await click(userPage, "[data-staff-monthly-refresh]");
          await userState(userPage, "REVIEW_REQUIRED", version);
          assert.equal(
            await evaluate(
              userPage,
              "document.querySelectorAll('[data-staff-monthly-submit]').length",
            ),
            0,
          );
          await click(userPage, '[data-staff-monthly-edit="0"]');
          await selectOption(userPage, "familySchoolCollaboration", 1, "PROGRESSING");
          await click(userPage, "[data-staff-monthly-save]");
          await userState(userPage, "DRAFT", ++version);
          await click(userPage, '[data-staff-monthly-submit="0"]');
          await userState(userPage, "SUBMITTED", ++version);
          await click(adminPage, "[data-monthly-feedback-state] button");
          await adminState(adminPage, "SUBMITTED", version);
          await click(adminPage, '[data-monthly-feedback-action="confirm"]');
          await adminState(adminPage, "CONFIRMED", ++version);
          await click(adminPage, '[data-monthly-feedback-action="publish"]');
          await adminState(adminPage, "PUBLISHED", ++version);
          await click(userPage, "[data-staff-monthly-refresh]");
          await userState(userPage, "PUBLISHED", version);
          report = await prisma.monthlyFeedbackReport.findFirstOrThrow({
            where: { tenantId, campusId, id: reportId },
          });
          assert.equal(report.status, "PUBLISHED");
          assert.equal(report.version, version);
          assert.equal(report.reviewedByMembershipId, reviewer.membershipId);
          assert.equal(report.dailyHabits, "FOLLOW_UP");
          assert.equal(report.activityParticipation, "FOLLOW_UP");
          assert.equal(report.familySchoolCollaboration, "PROGRESSING");

          const screenshots = join(artifactRoot, "screenshots");
          assertTaskOwnedDirectory(artifactRoot, screenshots);
          await mkdir(screenshots, { recursive: true });
          for (const [name, page] of [
            ["staff", userPage],
            ["admin", adminPage],
          ]) {
            await noBrowserSecrets(page);
            const cookies = (await page.send("Network.getCookies")).cookies;
            assert.equal(
              cookies
                .filter((cookie) => cookie.name.startsWith("student_care_"))
                .every((cookie) => cookie.httpOnly),
              true,
            );
            for (const width of [320, 390, 1365]) {
              await viewport(page, width);
              await page.send("Input.dispatchMouseEvent", {
                type: "mouseWheel",
                x: width - 24,
                y: 450,
                deltaX: 0,
                deltaY: -(await evaluate(page, "window.scrollY + 900")),
              });
              await waitForExpression(page, "window.scrollY === 0", "截图前页面必须回到顶部。");
              let layout;
              let previousLayout;
              let stableSamples = 0;
              for (let attempt = 0; attempt < 30 && stableSamples < 3; attempt++) {
                await delay(100);
                layout = await evaluate(
                  page,
                  `(() => {
            const sidebarElement = document.querySelector('.admin-sidebar');
            const sidebar = sidebarElement?.getBoundingClientRect();
            const main = document.querySelector('.admin-main')?.getBoundingClientRect();
            return {width:innerWidth,scrollY:window.scrollY,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,sidebar:sidebar&&{left:sidebar.left,right:sidebar.right,width:sidebar.width,visibility:getComputedStyle(sidebarElement).visibility},mainLeft:main?.left,menuExpanded:document.querySelector('.nav-toggle')?.getAttribute('aria-expanded')};
          })()`,
                );
                const sidebarReady =
                  name !== "admin" ||
                  (width < 760
                    ? layout.sidebar?.visibility === "hidden" &&
                      layout.sidebar.right <= 0 &&
                      layout.menuExpanded === "false"
                    : layout.sidebar?.visibility === "visible" &&
                      layout.sidebar.left >= 0 &&
                      layout.sidebar.width >= 200 &&
                      layout.mainLeft >= layout.sidebar.right);
                const currentLayout = JSON.stringify(layout);
                stableSamples =
                  layout.width === width &&
                  layout.scrollY === 0 &&
                  sidebarReady &&
                  currentLayout === previousLayout
                    ? stableSamples + 1
                    : 0;
                previousLayout = currentLayout;
              }
              assert.equal(stableSamples, 3, `${name} ${width}px 截图前布局必须稳定。`);
              assert.equal(layout.scrollY, 0, "截图必须从页面顶部采集。");
              assert.ok(layout.scrollWidth <= layout.width, `${name} ${width}px 不能横向溢出。`);
              if (name === "admin" && width < 760) {
                assert.equal(layout.sidebar?.visibility, "hidden");
                assert.ok(layout.sidebar.right <= 0, "移动管理侧栏必须完全收起。");
                assert.equal(layout.menuExpanded, "false");
              }
              if (name === "admin" && width === 1365) {
                assert.ok(
                  layout.sidebar && layout.sidebar.left >= 0 && layout.sidebar.width >= 200,
                );
                assert.ok(layout.mainLeft >= layout.sidebar.right, "管理端必须左导航、右内容。");
              }
              await capture(page, join(screenshots, `${name}-monthly-${width}.png`), true);
            }
          }

          adminEvents.phase = "revoked";
          await prisma.membership.updateMany({
            where: { tenantId, id: reviewer.membershipId },
            data: { status: "SUSPENDED" },
          });
          await click(adminPage, "[data-monthly-feedback-state] button");
          await waitForExpression(
            adminPage,
            "document.querySelector('[data-monthly-feedback-state=FORBIDDEN]') && document.querySelectorAll('[data-monthly-feedback-row]').length === 0",
            "撤权后管理总结必须清空。",
          );
          assert.equal(
            adminEvents.failures.filter(
              (failure) => failure.phase === "revoked" && failure.status === 403,
            ).length,
            1,
          );
          userEvents.phase = "expired";
          const expired = await prisma.inviteAuthSession.updateMany({
            where: { userId: writer.userId },
            data: { expiresAt: new Date("2000-01-01T00:00:00.000Z") },
          });
          assert.ok(expired.count >= 1, "必须实际使本次员工邀请会话过期。");
          await click(userPage, "[data-staff-monthly-refresh]");
          await waitForExpression(
            userPage,
            "document.querySelector('[data-staff-monthly-login]') && document.querySelectorAll('[data-staff-monthly-row]').length === 0 && document.querySelectorAll('[data-staff-monthly-form]').length === 0",
            "会话过期后清空记录与编辑并显示登录。",
          );
          assert.ok(
            userEvents.failures.some(
              (failure) => failure.phase === "expired" && failure.status === 401,
            ),
          );
          const userCookies = (await userPage.send("Network.getCookies")).cookies;
          assert.equal(
            userCookies.some((cookie) => cookie.name === "student_care_local_session"),
            false,
            "过期后代理必须清除会话 Cookie。",
          );
          await noBrowserSecrets(userPage);
          await noBrowserSecrets(adminPage);
          userEvents.verify();
          adminEvents.verify();
          assert.deepEqual(
            new Set(
              userEvents.calls
                .filter((call) => call.path.startsWith("/api-local/staff/monthly-feedback"))
                .map((call) => call.method),
            ),
            new Set(["GET", "POST", "PATCH"]),
          );
          assert.ok(
            adminEvents.calls.some(
              (call) => call.path === `/api/admin/monthly-feedback/${reportId}/review`,
            ),
          );
          assert.ok(
            adminEvents.calls.some(
              (call) => call.path === `/api/admin/monthly-feedback/${reportId}/publish`,
            ),
          );
        },
      );
    } finally {
      for (const name of changedEnv) {
        if (priorEnv[name] === undefined) delete process.env[name];
        else process.env[name] = priorEnv[name];
      }
      try {
        await stopOwnedChild(adminProcess);
      } finally {
        try {
          await api?.close();
        } finally {
          try {
            await prisma?.$disconnect();
          } finally {
            try {
              if (created)
                await adminDatabase.$executeRawUnsafe(
                  `DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`,
                );
            } finally {
              await adminDatabase.$disconnect();
            }
          }
        }
      }
    }
  },
);
