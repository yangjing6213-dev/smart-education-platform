/* global AbortSignal, console, document, fetch, getComputedStyle, HTMLElement, process, URL, window */

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import { chromium } from "playwright";

const packageRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const routesPath = resolve(packageRoot, "src/app/admin-routes.ts");
const catchAllPagePath = resolve(packageRoot, "src/app/admin/[[...segments]]/page.page.tsx");
const expectedRoutes = [
  ["/admin/institution", "机构概览"],
  ["/admin/home-content", "首页内容", "首页内容管理"],
  ["/admin/public-teachers", "教师介绍", "教师介绍管理"],
  ["/admin/meals", "餐食", "餐食内容管理"],
  ["/admin/fees", "费用管理"],
  ["/admin/student-transfers", "学生转班审核"],
  ["/admin/activities", "活动"],
  ["/admin/guides", "内部指南"],
  ["/admin/resources", "资源", "资源管理"],
  ["/admin/statistics", "运营统计"],
  ["/admin/learning-safety", "学习安全汇总"],
  ["/admin/staff", "员工账号"],
  ["/admin/staff-credentials", "员工资格证照"],
  ["/admin/staff-operations", "员工支持与招聘"],
  ["/admin/staff-tasks", "任务分派与检查"],
  ["/admin/staff-daily-review", "员工工作日报"],
  ["/admin/monthly-feedback-review", "班级月度总结审核"],
  ["/admin/child-monthly-review", "孩子月报审核"],
  ["/admin/files", "文件", "文件与引用管理"],
  ["/admin/publishing", "发布与下架", "发布与下架管理"],
  ["/admin/audit-logs", "审计日志"],
  ["/admin/privacy-requests", "隐私申请审核"],
  ["/admin/binding-review", "家长关系审核"],
  ["/admin/consent-review", "数据授权复核", "数据授权与期限复核"],
  ["/admin/leave-review", "请假审核"],
  ["/admin/care-record-review", "成长日报审核", "成长记录审核与发布"],
  ["/admin/notice-review", "通知审核", "通知审核与发布"],
  ["/admin/supply-request-review", "物资申请审核"],
  ["/admin/pickup-review", "接送异常处理"],
  ["/admin/health-incident-review", "健康异常审核", "健康异常审核与发布"],
  ["/admin/platform-operations", "平台运营"],
];
const browserRouteOrder = [
  expectedRoutes.find(([href]) => href === "/admin/monthly-feedback-review"),
  ...expectedRoutes.filter(([href]) => href !== "/admin/monthly-feedback-review"),
];

test("Next admin navigation preserves existing destinations and adds migrated staff workflows", async () => {
  assert.ok(existsSync(routesPath), "Next admin route registry must be present.");
  const source = await readFile(routesPath, "utf8");
  const actualRoutes = [
    ...source.matchAll(/\{\s*href:\s*"([^"]+)"\s*,\s*label:\s*"([^"]+)"\s*\}/gu),
  ].map(([, href, label]) => [href, label]);

  assert.deepEqual(
    actualRoutes,
    expectedRoutes.map(([href, label]) => [href, label]),
  );
});

async function reservePort() {
  const server = createServer();
  await new Promise((resolvePromise, rejectPromise) => {
    server.once("error", rejectPromise);
    server.listen(0, "127.0.0.1", resolvePromise);
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const port = address.port;
  await new Promise((resolvePromise, rejectPromise) => {
    server.close((error) => (error ? rejectPromise(error) : resolvePromise()));
  });
  return port;
}

async function waitForHttp(url, child, readOutput) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (child.exitCode !== null) throw new Error("Next 管理端提前退出：\n" + readOutput());
    try {
      return await fetch(url, { signal: AbortSignal.timeout(2500) });
    } catch {
      await delay(200);
    }
  }
  throw new Error("Next 管理端未能启动：\n" + readOutput());
}

async function stopChild(child) {
  if (!child || child.exitCode !== null) return;
  child.kill();
  await Promise.race([
    new Promise((resolvePromise) => child.once("exit", resolvePromise)),
    delay(4000),
  ]);
  if (child.exitCode === null) {
    child.kill("SIGKILL");
    await Promise.race([
      new Promise((resolvePromise) => child.once("exit", resolvePromise)),
      delay(2000),
    ]);
  }
}

async function launchAdminBrowser(t) {
  let nextProcess;
  let browser;
  let nextOutput = "";
  t.after(async () => {
    await browser?.close();
    await stopChild(nextProcess);
  });

  const nextCli = resolve(packageRoot, "node_modules/next/dist/bin/next");
  await access(nextCli);
  const port = await reservePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const nextMode = process.env.TASK20_ADMIN_NEXT_MODE === "production" ? "start" : "dev";
  if (nextMode === "start") {
    assert.ok(
      process.env.TASK20_ADMIN_NEXT_DIST_DIR,
      "生产模式必须显式指定 TASK20_ADMIN_NEXT_DIST_DIR。",
    );
  }
  const nextArguments = [
    nextCli,
    nextMode,
    ...(nextMode === "dev" ? ["--webpack"] : []),
    "--hostname",
    "127.0.0.1",
    "--port",
    String(port),
  ];
  nextProcess = spawn(process.execPath, nextArguments, {
    cwd: packageRoot,
    env: {
      ...process.env,
      NEXT_TELEMETRY_DISABLED: "1",
      TASK20_NEXT_ADMIN_SERVICE_PORT: "4319",
      CI: "1",
      ...(nextMode === "start"
        ? { TASK20_NEXT_DIST_DIR: process.env.TASK20_ADMIN_NEXT_DIST_DIR }
        : {}),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  nextProcess.stdout.on("data", (chunk) => (nextOutput += chunk.toString("utf8")));
  nextProcess.stderr.on("data", (chunk) => (nextOutput += chunk.toString("utf8")));
  const firstResponse = await waitForHttp(
    `${baseUrl}/admin/institution`,
    nextProcess,
    () => nextOutput,
  );
  assert.equal(firstResponse.status, 200, "管理端首页必须返回 200。\n" + nextOutput);

  browser = await chromium.launch({
    headless: true,
    ...(process.env.ADMIN_WEB_BROWSER ? { executablePath: process.env.ADMIN_WEB_BROWSER } : {}),
  });
  return { browser, baseUrl, nextMode };
}

test("invited login returns reviewers to the original page and rejects unsafe destinations", async (t) => {
  const { browser, baseUrl } = await launchAdminBrowser(t);
  const fallback = "/admin/binding-review";
  const notice = "/admin/notice-review";
  const transfer = "/admin/student-transfers";
  const homeContent = "/admin/home-content";
  for (const [requested, expected] of [
    [notice, notice],
    [transfer, transfer],
    [homeContent, homeContent],
    ["/admin/unknown", fallback],
    ["//external.invalid", fallback],
  ]) {
    await t.test(requested, async () => {
      const page = await browser.newPage();
      let logins = 0;
      const externalRequests = [];
      try {
        await page.route("**/*", (route) => {
          const url = new URL(route.request().url());
          if (url.origin !== baseUrl) {
            externalRequests.push(url.origin);
            return route.abort();
          }
          if (!url.pathname.startsWith("/api/admin/")) return route.continue();
          if (url.pathname === "/api/admin/identity/login" && route.request().method() === "POST") {
            logins += 1;
            return route.fulfill({ json: { data: {} } });
          }
          if (!logins || expected === fallback) return route.fulfill({ status: 401, json: {} });
          if (url.pathname === "/api/admin/student-transfers")
            return route.fulfill({
              json: {
                data: {
                  canRequest: false,
                  canReview: true,
                  students: [],
                  destinationClasses: [],
                  requests: [],
                },
              },
            });
          if (url.pathname === "/api/admin/me")
            return route.fulfill({
              json: {
                data: {
                  display_name: "合成审核员",
                  memberships: [{ status: "ACTIVE", capabilities: ["notice:review"] }],
                },
              },
            });
          if (url.pathname === "/api/admin/staff/notices/review")
            return route.fulfill({ json: { data: [] } });
          return route.fulfill({ status: 404, json: {} });
        });
        if (expected === fallback) {
          await page.goto(baseUrl + "/admin/login?next=" + encodeURIComponent(requested));
        } else {
          await page.goto(baseUrl + requested);
          await page
            .getByRole("link", {
              name: requested === notice || requested === homeContent ? "前往管理端登录" : "重新登录",
              exact: true,
            })
            .click();
          await page.waitForURL((url) => url.pathname === "/admin/login");
          assert.equal(new URL(page.url()).searchParams.get("next"), requested);
        }
        await page.locator("#admin-login-username").fill("reviewer-demo");
        await page.locator("#admin-login-password").fill("synthetic-input-only");
        await page.getByRole("button", { name: "登录", exact: true }).click();
        await page.waitForURL((url) => url.pathname !== "/admin/login");
        assert.equal(page.url(), baseUrl + expected);
        if (expected !== fallback) {
          if (expected === homeContent) {
            await page.getByRole("heading", { name: "首页内容管理", exact: true }).waitFor();
          } else {
            const state =
              expected === notice ? "data-notice-review-state" : "data-student-transfers-state";
            await page.locator("[" + state + '="READY"]').waitFor();
          }
        }
        assert.equal(logins, 1);
        assert.deepEqual(externalRequests, []);
      } finally {
        await page.close();
      }
    });
  }
});

test("fees recover the invited session and keep revoked records hidden after late reads", async (t) => {
  const { browser, baseUrl } = await launchAdminBrowser(t);
  const page = await browser.newPage();
  page.setDefaultTimeout(6000);
  const feesPath = "/api/admin/fees";
  const student = { id: "00000000-0000-4000-8000-000000000501", label: "合成收费学生" };
  const document = {
    id: "00000000-0000-4000-8000-000000000502",
    version: 1,
    documentType: "BILL",
    title: "合成班级费用",
    studentId: student.id,
    studentLabel: student.label,
    period: "2026-10",
    amountMinor: 12345,
    status: "AVAILABLE",
    validFrom: "2026-10-01",
    validTo: "2026-10-31",
    summary: "合成费用说明",
    synthetic: true,
  };
  const snapshot = { data: { students: [student], documents: [document], synthetic: true } };
  let readStatus = 401,
    writeStatus = 403,
    writes = 0,
    holdRead = false;
  let pendingRead;
  const external = [];
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== baseUrl) {
      external.push(url.origin);
      return route.abort();
    }
    if (url.pathname === "/api/admin/identity/login" && route.request().method() === "POST") {
      readStatus = 200;
      return route.fulfill({ json: { data: {} } });
    }
    if (url.pathname !== feesPath && url.pathname !== feesPath + "/" + document.id + "/revoke")
      return route.continue();
    if (route.request().method() === "POST") {
      writes += 1;
      return route.fulfill({ status: writeStatus, contentType: "text/plain", body: "" });
    }
    if (holdRead) {
      holdRead = false;
      pendingRead.resolve(route);
      return;
    }
    return readStatus === 200
      ? route.fulfill({ json: snapshot })
      : route.fulfill({ status: readStatus, contentType: "text/plain", body: "" });
  });
  const panel = page.locator("[data-fees-state]");
  const login = page.locator('a[href="/admin/login?next=%2Fadmin%2Ffees"]');
  const refresh = page.getByRole("button", { name: "刷新列表" });
  const ready = page.locator('[data-fees-state="READY"]');
  const expectHidden = async (status) => {
    await page
      .locator('[data-fees-state="' + (status === 401 ? "AUTH" : "DENIED") + '"]')
      .waitFor();
    assert.equal(await login.count(), status === 401 ? 1 : 0);
    assert.equal(
      await panel.locator("form, [data-fee-document], select, input, textarea").count(),
      0,
    );
    for (const text of [student.label, document.title, "123.45"])
      assert.ok(!(await panel.innerText()).includes(text));
  };
  try {
    await page.goto(baseUrl + "/admin/fees");
    await expectHidden(401);
    await login.click();
    await page.locator("#admin-login-username").fill("fees-demo");
    await page.locator("#admin-login-password").fill("synthetic-input-only");
    await page.getByRole("button", { name: "登录", exact: true }).click();
    await page.waitForURL(baseUrl + "/admin/fees");
    await ready.waitFor();
    for (const status of [403, 503]) {
      readStatus = status;
      await refresh.click();
      if (status === 403) await expectHidden(status);
      else await page.locator('[data-fees-state="ERROR"]').waitFor();
      readStatus = 200;
      await refresh.click();
      await ready.waitFor();
    }
    for (const operation of ["create", "revoke"]) {
      for (const status of [401, 403]) {
        if (operation === "create") {
          await panel.locator('select[name="student_id"]').selectOption(student.id);
          for (const [field, value] of Object.entries({
            title: "待保存费用",
            period: "2026-10",
            amount: "1.23",
            valid_from: "2026-10-01",
            valid_to: "2026-10-31",
            summary: "合成说明",
          }))
            await panel.locator('[name="' + field + '"]').fill(value);
        }
        writeStatus = status;
        pendingRead = Promise.withResolvers();
        holdRead = true;
        await refresh.click();
        const read = await pendingRead.promise;
        const previousWrites = writes;
        const button = panel.getByRole("button", {
          name: operation === "create" ? "保存并供家长查看" : "撤回",
          exact: true,
        });
        await button.evaluate((element) => {
          element.click();
          element.click();
        });
        await expectHidden(status);
        const response = page.waitForResponse(
          (r) => r.url() === baseUrl + feesPath && r.request().method() === "GET",
        );
        await read.fulfill({ json: snapshot });
        await (await response).finished();
        await page.evaluate(
          () =>
            new Promise((done) =>
              window.requestAnimationFrame(() => window.requestAnimationFrame(done)),
            ),
        );
        await expectHidden(status);
        assert.equal(writes, previousWrites + 1);
        await refresh.click();
        await ready.waitFor();
      }
    }
    assert.deepEqual(external, []);
  } finally {
    await page.close();
  }
});

test("Next admin serves the left navigation, right content, and mobile drawer", async (t) => {
  assert.ok(existsSync(catchAllPagePath), "Next admin route page must be present.");
  const browserErrors = [];
  const notFoundResponses = [];
  let expectedAdminUnauthorizedResponses = 0;
  let expectedHomeDraftNotFoundResponses = 0;
  const failedRequests = [];
  const adminMeResponseEvents = [];
  const adminMeFinishedEvents = [];
  const adminMeRequestStarts = new WeakMap();
  const adminMeResponseStatuses = new WeakMap();
  const adminMeHeaderReads = [];
  const mainFrameNavigations = [];
  let diagnosticSequence = 0;
  const externalRequests = [];
  let expectedMembership503ConsoleError = false;
  let expectedMembership503Responses = 0;
  let expectedMonthlyFeedback503ConsoleError = false;
  let expectedMonthlyFeedback503Responses = 0;
  let expectedMonthlyFeedback409ConsoleError = false;
  let expectedStaffCredentials503ConsoleError = false;
  let expectedStaffCredentials503Responses = 0;
  const localApiOrigin = "http://127.0.0.1:4319";
  const reviewerId = "33333333-3333-4333-8333-333333333333";
  const handles = new Map();
  let learningInstitutionSetting = { enabled: false, version: 0 };
  const feeStudent = { id: "00000000-0000-4000-8000-000000000501", label: "示例学生甲" };
  const feeDocuments = [];
  const feeRequests = [];
  const transferStudent = { ...feeStudent, classRef: "合成甲班" };
  const transferRows = [];
  const transferRequests = [];
  let transferReviewer = false;
  const transferProjection = (row) => ({
    ...row,
    isOwnRequest: !transferReviewer,
    canReview: transferReviewer && row.status === "PENDING",
    canApprove: transferReviewer && row.status === "PENDING",
  });
  const privacyRows = new Map([
    [
      "owner-east",
      [
        {
          id: "77777777-7777-4777-8777-777777777777",
          version: 1,
          type: "ACCESS",
          status: "SUBMITTED",
          createdAt: "2026-10-14T08:00:00.000Z",
          updatedAt: "2026-10-14T08:00:00.000Z",
          dataChanged: false,
        },
      ],
    ],
    ["owner-west", []],
  ]);
  const eastRows = [
    {
      id: "11111111-1111-4111-8111-111111111111",
      version: 1,
      status: "PENDING",
      relationship: "GUARDIAN",
      studentId: "22222222-2222-4222-8222-222222222222",
      studentAlias: "student-alpha",
      studentLabel: "示例学生甲",
      campusLabel: "示例东校区",
      classLabel: "示例三年级甲班",
      guardianLabel: "模拟家长甲",
    },
    {
      id: "44444444-4444-4444-8444-444444444444",
      version: 1,
      status: "PENDING",
      relationship: "GUARDIAN",
      studentId: "55555555-5555-4555-8555-555555555555",
      studentAlias: "student-beta",
      studentLabel: "示例学生乙",
      campusLabel: "示例东校区",
      classLabel: "示例三年级乙班",
      guardianLabel: "模拟家长乙",
    },
  ];
  const membershipRows = {
    "owner-east": [
      {
        actorId: "66666666-6666-4666-8666-666666666666",
        version: 1,
        profile: "teacher-east",
        label: "模拟教师甲",
        role: "教师",
        tenantId: "00000000-0000-4000-8000-000000000100",
        campusId: "00000000-0000-4000-8000-000000000101",
        classIds: ["00000000-0000-4000-8000-000000000103"],
        status: "ACTIVE",
        capabilities: ["care-records:write"],
      },
    ],
    "owner-west": [
      {
        actorId: "77777777-7777-4777-8777-777777777778",
        version: 1,
        profile: "teacher-west",
        label: "模拟教师乙",
        role: "教师",
        tenantId: "00000000-0000-4000-8000-000000000100",
        campusId: "00000000-0000-4000-8000-000000000102",
        classIds: ["00000000-0000-4000-8000-000000000104"],
        status: "ACTIVE",
        capabilities: ["care-records:write"],
      },
    ],
    "owner-other-tenant": [],
  };
  const membershipEvents = [];
  let failNextMembershipRead = false;
  const staffCredentialRows = {
    "owner-east": [
      {
        id: "88888888-8888-4888-8888-888888888882",
        version: 1,
        staffId: "66666666-6666-4666-8666-666666666666",
        staffLabel: "模拟教师甲",
        staffRole: "教师",
        category: "TEACHING_QUALIFICATION",
        issueDate: "2025-01-01",
        expiryDate: "2026-10-30",
        expiryStatus: "EXPIRING_SOON",
        responsibleRole: "CAMPUS_OWNER",
        updatedAt: "2026-10-16T08:00:00.000Z",
        history: [],
      },
    ],
    "owner-west": [],
    "owner-other-tenant": [],
  };
  let nextCredentialId = 1;
  let failNextStaffCredentialRead = false;
  const makeMonthlyFeedbackRow = (id, month) => ({
    id,
    version: 1,
    sourceVersion: 1,
    status: "SUBMITTED",
    month,
    classRef: "合成班级甲",
    audience: "STAFF_INTERNAL",
    sourceCounts: { GROWTH_RECORD: 1, ATTENDANCE_OVERVIEW: 0, STAFF_DAILY: 1 },
    supplements: {
      learningParticipation: "PROGRESSING",
      dailyHabits: "KEEP_WATCHING",
      activityParticipation: "PROGRESSING",
      familySchoolCollaboration: "FOLLOW_UP",
    },
    actions: ["confirm", "return"],
  });
  const monthlyFeedbackRows = [
    makeMonthlyFeedbackRow("88888888-8888-4888-8888-888888888881", "2026-10"),
    makeMonthlyFeedbackRow("99999999-9999-4999-8999-999999999991", "2026-09"),
  ];
  let failNextMonthlyFeedbackRead = false;
  let invalidateNextMonthlyFeedbackRead = false;
  let conflictNextMonthlyFeedbackWrite = false;
  let monthlySignedIn = false;
  const monthlySessionToken = "m".repeat(43);
  const monthlyApiRequests = [];
  const monthlyLegacyRequests = [];
  const localApiCalls = [];
  const mediaAssets = [
    {
      id: "00000000-0000-4000-8000-000000000701",
      alias: "teacher-profile-placeholder",
      title: "教师介绍占位图",
      version: 1,
      type: "IMAGE",
      status: "REFERENCED",
      expiresOn: "2026-12-31",
      references: [
        {
          id: "00000000-0000-4000-8000-000000000801",
          label: "教师介绍",
          kind: "TEACHER_INTRO",
        },
      ],
    },
    {
      id: "00000000-0000-4000-8000-000000000703",
      alias: "activity-cover-placeholder",
      title: "活动封面占位图",
      version: 1,
      type: "IMAGE",
      status: "AVAILABLE",
      expiresOn: "2026-12-31",
      references: [],
    },
  ];
  const fulfillJson = (route, body, status = 200) =>
    route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  const { browser, baseUrl, nextMode } = await launchAdminBrowser(t);
  const page = await browser.newPage({
    viewport: { width: 1365, height: 900 },
  });
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.origin === baseUrl && response.status() === 404)
      notFoundResponses.push({ method: response.request().method(), path: url.pathname });
    if (url.origin === baseUrl && url.pathname === "/api/admin/me") {
      adminMeResponseStatuses.set(response.request(), response.status());
      adminMeResponseEvents.push({
        sequence: ++diagnosticSequence,
        at: Date.now(),
        status: response.status(),
        pageUrl: page.url(),
        requestStart: adminMeRequestStarts.get(response.request()) ?? null,
      });
    }
    if (
      url.origin === baseUrl &&
      url.pathname.startsWith("/api/admin/") &&
      response.status() === 401
    )
      expectedAdminUnauthorizedResponses += 1;
  });
  page.on("requestfinished", (request) => {
    const url = new URL(request.url());
    if (url.origin !== baseUrl || url.pathname !== "/api/admin/me") return;
    adminMeFinishedEvents.push({
      sequence: ++diagnosticSequence,
      finishedAt: Date.now(),
      status: adminMeResponseStatuses.get(request) ?? null,
      pageUrl: page.url(),
      requestStart: adminMeRequestStarts.get(request) ?? null,
    });
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (expectedMembership503ConsoleError && text.includes("503 (Service Unavailable)")) {
      expectedMembership503ConsoleError = false;
      return;
    }
    if (expectedMonthlyFeedback503ConsoleError && text.includes("503 (Service Unavailable)")) {
      expectedMonthlyFeedback503ConsoleError = false;
      return;
    }
    if (expectedMonthlyFeedback409ConsoleError && text.includes("409 (Conflict)")) {
      expectedMonthlyFeedback409ConsoleError = false;
      return;
    }
    if (expectedStaffCredentials503ConsoleError && text.includes("503 (Service Unavailable)")) {
      expectedStaffCredentials503ConsoleError = false;
      return;
    }
    browserErrors.push(text);
  });
  page.on("request", (request) => {
    const requestUrl = new URL(request.url());
    if (
      requestUrl.pathname.startsWith("/local/") &&
      (requestUrl.pathname.includes("monthly-feedback") ||
        new URL(page.url()).pathname === "/admin/monthly-feedback-review")
    )
      monthlyLegacyRequests.push({ method: request.method(), path: requestUrl.pathname });
    if (new URL(request.url()).pathname !== "/api/admin/me") return;
    let frameUrl = "unavailable";
    try {
      frameUrl = request.frame().url();
    } catch {
      // Keep the diagnostic record if the request frame is already detached.
    }
    const requestStart = {
      sequence: ++diagnosticSequence,
      startedAt: Date.now(),
      method: request.method(),
      pageUrl: page.url(),
      frameUrl,
      hasSessionCookie: null,
    };
    adminMeRequestStarts.set(request, requestStart);
    adminMeHeaderReads.push(
      request
        .allHeaders()
        .then((headers) => {
          requestStart.hasSessionCookie = (headers.cookie ?? "")
            .split(";")
            .some((part) => part.trim().startsWith("student_care_admin_session="));
        })
        .catch(() => undefined),
    );
  });
  page.on("framenavigated", (frame) => {
    if (frame !== page.mainFrame()) return;
    mainFrameNavigations.push({
      sequence: ++diagnosticSequence,
      at: Date.now(),
      url: frame.url(),
    });
  });
  page.on("requestfailed", (request) => {
    failedRequests.push({
      url: request.url(),
      error: request.failure()?.errorText ?? "unknown",
      resourceType: request.resourceType(),
      isNavigationRequest: request.isNavigationRequest(),
      pageUrl: page.url(),
      requestStart: adminMeRequestStarts.get(request) ?? null,
      failureSequence: ++diagnosticSequence,
      failedAt: Date.now(),
    });
  });
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/favicon.ico") return route.fulfill({ status: 204, body: "" });
    if (url.origin === baseUrl && url.pathname === "/api/admin/student-transfers") {
      if (route.request().method() === "GET")
        return fulfillJson(route, {
          data: {
            canRequest: !transferReviewer,
            canReview: transferReviewer,
            students: transferReviewer ? [] : [transferStudent],
            destinationClasses: transferReviewer ? [] : ["合成甲班", "合成乙班"],
            requests: transferRows.map(transferProjection),
          },
        });
      const body = route.request().postDataJSON();
      transferRequests.push(body);
      const row = {
        id: "00000000-0000-4000-8000-000000000603",
        studentId: transferStudent.id,
        studentLabel: transferStudent.label,
        sourceClassRef: "合成甲班",
        destinationClassRef: body.destination_class_ref,
        status: "PENDING",
        version: 1,
        requestedAt: "2026-10-30T08:00:00.000Z",
        reviewedAt: null,
        events: [
          {
            action: "CREATED",
            actorId: "11111111-1111-4111-8111-111111111111",
            version: 1,
            occurredAt: "2026-10-30T08:00:00.000Z",
          },
        ],
      };
      transferRows.push(row);
      return fulfillJson(route, { data: transferProjection(row) });
    }
    if (
      url.origin === baseUrl &&
      /^\/api\/admin\/student-transfers\/[^/]+\/review$/u.test(url.pathname)
    ) {
      const body = route.request().postDataJSON();
      transferRequests.push(body);
      const row = transferRows.find((entry) => entry.id === url.pathname.split("/")[4]);
      assert.ok(row);
      assert.equal(transferReviewer, true);
      assert.equal(body.expected_version, row.version);
      row.status = body.decision === "APPROVE" ? "APPROVED" : "REJECTED";
      row.version = 2;
      row.reviewedAt = "2026-10-30T08:01:00.000Z";
      row.events.push({
        action: row.status,
        actorId: reviewerId,
        version: 2,
        occurredAt: row.reviewedAt,
      });
      return fulfillJson(route, { data: transferProjection(row) });
    }
    if (url.origin === baseUrl && url.pathname === "/api/admin/fees") {
      if (route.request().method() === "GET")
        return fulfillJson(route, {
          data: { synthetic: true, students: [feeStudent], documents: feeDocuments },
        });
      const body = route.request().postDataJSON();
      feeRequests.push({ method: "POST", path: url.pathname, body });
      assert.deepEqual(Object.keys(body).sort(), [
        "amount_minor",
        "document_type",
        "period",
        "student_id",
        "summary",
        "title",
        "valid_from",
        "valid_to",
      ]);
      const document = {
        id: "00000000-0000-4000-8000-000000000502",
        version: 1,
        documentType: body.document_type,
        title: body.title,
        studentId: body.student_id,
        studentLabel: feeStudent.label,
        period: body.period,
        amountMinor: body.amount_minor,
        status: "AVAILABLE",
        validFrom: body.valid_from,
        validTo: body.valid_to,
        summary: body.summary,
        synthetic: true,
      };
      feeDocuments.unshift(document);
      return fulfillJson(route, { data: document }, 201);
    }
    if (url.origin === baseUrl && /^\/api\/admin\/fees\/[0-9a-f-]+\/revoke$/iu.test(url.pathname)) {
      const body = route.request().postDataJSON();
      feeRequests.push({ method: "POST", path: url.pathname, body });
      const document = feeDocuments.find((row) => row.id === url.pathname.split("/")[4]);
      assert.ok(document);
      assert.equal(body.expected_version, document.version);
      document.version += 1;
      document.status = "REVOKED";
      return fulfillJson(route, {
        data: {
          id: document.id,
          version: document.version,
          status: document.status,
          synthetic: true,
        },
      });
    }
    if (url.origin === baseUrl && url.pathname === "/api/admin/learning-institution-setting") {
      const request = route.request();
      if (request.method() === "GET")
        return fulfillJson(route, { data: learningInstitutionSetting });
      if (request.method() === "POST") {
        const body = JSON.parse(request.postData() ?? "{}");
        assert.deepEqual(Object.keys(body).sort(), ["enabled", "expectedVersion"]);
        if (body.expectedVersion !== learningInstitutionSetting.version)
          return fulfillJson(route, { error: { code: "CONFLICT_STATE" } }, 409);
        learningInstitutionSetting = {
          enabled: body.enabled,
          version: learningInstitutionSetting.version + 1,
        };
        return fulfillJson(route, { data: learningInstitutionSetting });
      }
      return fulfillJson(route, { error: { code: "NOT_FOUND" } }, 404);
    }
    if (url.origin === localApiOrigin && url.pathname.startsWith("/local/")) {
      const request = route.request();
      const method = request.method();
      localApiCalls.push({ method, path: url.pathname });
      if (url.pathname === "/local/sessions" && method === "POST") {
        const profile = JSON.parse(request.postData() ?? "{}").profile;
        if (
          !Object.hasOwn(membershipRows, profile) &&
          profile !== "owner-east" &&
          profile !== "owner-west" &&
          profile !== "platform-admin"
        )
          return fulfillJson(route, { error: { code: "UNAVAILABLE" } }, 403);
        const handle =
          profile === "owner-east"
            ? "e".repeat(43)
            : profile === "owner-west"
              ? "w".repeat(43)
              : profile === "platform-admin"
                ? "p".repeat(43)
                : "o".repeat(43);
        handles.set(handle, profile);
        return fulfillJson(route, { handle }, 201);
      }
      const authorization = request.headers().authorization ?? "";
      const profile = handles.get(authorization.replace(/^Bearer /u, ""));
      if (!profile) return fulfillJson(route, { error: { code: "UNAUTHORIZED" } }, 401);
      if (url.pathname === "/local/session" && method === "GET")
        return fulfillJson(route, {
          mode: "local-synthetic",
          profile,
          actorId: reviewerId,
          label:
            profile === "owner-east"
              ? "示例东校区负责人"
              : profile === "owner-west"
                ? "示例西校区负责人"
                : "示例另一机构负责人",
          tenantId:
            profile === "platform-admin"
              ? null
              : request.headers().referer?.includes("/admin/leave-review")
                ? "00000000-0000-4000-8000-000000000064"
                : profile === "owner-other-tenant"
                  ? "00000000-0000-4000-8000-000000000200"
                  : "00000000-0000-4000-8000-000000000100",
          campusId:
            profile === "platform-admin"
              ? null
              : request.headers().referer?.includes("/admin/leave-review")
                ? "00000000-0000-4000-8000-000000000065"
                : profile === "owner-east"
                  ? "00000000-0000-4000-8000-000000000101"
                  : profile === "owner-west"
                    ? "00000000-0000-4000-8000-000000000102"
                    : "00000000-0000-4000-8000-000000000201",
          classIds: profile === "platform-admin" ? [] : ["00000000-0000-4000-8000-000000000103"],
          actions: [
            "binding:review",
            "audit:read",
            "learning:safety-summary",
            "supply:review",
            "supply:claim",
            "health:review",
            "health:supplement",
            "health:publish",
            "health:revoke",
            "leave:review",
            "privacy:review",
            "task:read",
            "task:assign",
            "task:check",
            "task:cancel",
            "membership:manage",
            "feedback:read",
            "feedback:review",
            "feedback:publish",
            ...(profile === "platform-admin" ? ["media:summary"] : []),
            ...(profile === "owner-east" || profile === "owner-west"
              ? ["media:read", "media:manage", "learning:institution-setting"]
              : []),
          ],
        });
      if (url.pathname === "/local/media-assets" && method === "GET")
        return fulfillJson(route, {
          assets: profile === "owner-east" ? mediaAssets : [],
        });
      if (url.pathname === "/local/media-asset-events" && method === "GET")
        return fulfillJson(route, []);
      if (url.pathname === "/local/media-asset-summary" && method === "GET")
        return fulfillJson(route, {
          total: 10,
          available: 5,
          referenced: 2,
          expired: 1,
          archived: 1,
          revoked: 1,
          deleted: 0,
        });
      if (url.pathname === "/local/memberships" && method === "GET" && failNextMembershipRead) {
        failNextMembershipRead = false;
        expectedMembership503ConsoleError = true;
        expectedMembership503Responses += 1;
        return fulfillJson(route, { error: { code: "UNAVAILABLE" } }, 503);
      }
      if (url.pathname === "/local/memberships" && method === "GET")
        return fulfillJson(route, membershipRows[profile] ?? []);
      if (url.pathname === "/local/membership-events" && method === "GET")
        return fulfillJson(route, profile === "owner-east" ? membershipEvents : []);
      if (url.pathname === "/local/fee-summary" && method === "GET")
        return fulfillJson(route, {
          scope: "platform",
          synthetic: true,
          totalDocuments: 9,
          activeDocuments: 5,
          paidDocuments: 2,
          unavailableDocuments: 4,
          documentTypes: ["AGREEMENT", "BILL", "FEE_ITEM", "RECEIPT"],
        });
      if (url.pathname === "/local/fee-ledger-summary" && method === "GET")
        return fulfillJson(route, {
          scope: "platform",
          synthetic: true,
          entryCount: 4,
          countsByType: { CHARGE: 2, PAYMENT: 1, REFUND: 1 },
        });
      if (url.pathname === "/local/learning-safety-summary" && method === "GET")
        return fulfillJson(route, {
          metricVersion: "LEARNING_SAFETY_V2",
          totalSessions: 8,
          activeSessions: 1,
          completedSessions: 4,
          closedSessions: 2,
          expiredSessions: 1,
          hintRequests: 12,
          teacherFollowUps: 2,
          refusedActions: 1,
          teacherHandoffs: 1,
          fixedGuidanceSessions: 8,
          firstAttemptSuccesses: 2,
          hintAssistedSuccesses: 4,
          mainAnswerAttempts: 12,
          consolidationAnswered: 8,
          consolidationCorrect: 6,
          postHintAnswerRate: { numerator: 4, denominator: 6, percent: 66.7 },
          consolidationCompletionRate: {
            numerator: 6,
            denominator: 8,
            percent: 75,
          },
          teacherInterventionRate: {
            numerator: 2,
            denominator: 8,
            percent: 25,
          },
          answerErrorRate: { numerator: 2, denominator: 12, percent: 16.7 },
          severeSafetyEvents: 0,
        });
      const membershipMatch = url.pathname.match(/^\/local\/memberships\/([^/]+)$/u);
      if (membershipMatch && method === "PATCH") {
        const row = membershipRows[profile]?.find(({ actorId }) => actorId === membershipMatch[1]);
        const submitted = JSON.parse(request.postData() ?? "{}");
        if (!row || submitted.version !== row.version || profile === "owner-other-tenant")
          return fulfillJson(route, { error: { code: "STATE_CONFLICT" } }, 409);
        if (!["ACTIVE", "SUSPENDED", "REVOKED"].includes(submitted.status))
          return fulfillJson(route, { error: { code: "INVALID_INPUT" } }, 400);
        const fromStatus = row.status;
        row.status = submitted.status;
        row.version += 1;
        membershipEvents.push({
          actorId: reviewerId,
          targetActorId: row.actorId,
          fromStatus,
          toStatus: row.status,
          occurredAt: "2026-10-16T08:00:00.000Z",
        });
        return fulfillJson(route, row);
      }
      if (url.pathname === "/local/staff-credentials" && method === "GET") {
        if (failNextStaffCredentialRead) {
          failNextStaffCredentialRead = false;
          expectedStaffCredentials503ConsoleError = true;
          expectedStaffCredentials503Responses += 1;
          return fulfillJson(route, { error: { code: "UNAVAILABLE" } }, 503);
        }
        return fulfillJson(route, staffCredentialRows[profile] ?? []);
      }
      if (url.pathname === "/local/staff-credentials" && method === "POST") {
        const submitted = JSON.parse(request.postData() ?? "{}");
        const staff = membershipRows[profile]?.find(
          ({ actorId, status }) => actorId === submitted.staffId && status === "ACTIVE",
        );
        if (!staff || profile !== "owner-east")
          return fulfillJson(route, { error: { code: "FORBIDDEN" } }, 403);
        const row = {
          id: `aaaaaaaa-aaaa-4aaa-8aaa-${String(nextCredentialId++).padStart(12, "0")}`,
          version: 1,
          staffId: staff.actorId,
          staffLabel: staff.label,
          staffRole: staff.role,
          category: submitted.category,
          issueDate: submitted.issueDate,
          expiryDate: submitted.expiryDate,
          expiryStatus:
            submitted.expiryDate < "2026-10-16"
              ? "EXPIRED"
              : submitted.expiryDate <= "2026-11-15"
                ? "EXPIRING_SOON"
                : "VALID",
          responsibleRole: submitted.responsibleRole,
          updatedAt: "2026-10-16T08:20:00.000Z",
          history: [],
        };
        staffCredentialRows[profile].push(row);
        return fulfillJson(route, row, 201);
      }
      const credentialMatch = url.pathname.match(/^\/local\/staff-credentials\/([^/]+)$/u);
      if (credentialMatch && method === "PATCH") {
        const row = staffCredentialRows[profile]?.find(({ id }) => id === credentialMatch[1]);
        const submitted = JSON.parse(request.postData() ?? "{}");
        if (!row || row.version !== submitted.version)
          return fulfillJson(route, { error: { code: "STATE_CONFLICT" } }, 409);
        row.history.push({
          version: row.version,
          issueDate: row.issueDate,
          expiryDate: row.expiryDate,
          responsibleRole: row.responsibleRole,
          updatedAt: row.updatedAt,
        });
        Object.assign(row, submitted, {
          version: row.version + 1,
          expiryStatus:
            submitted.expiryDate < "2026-10-16"
              ? "EXPIRED"
              : submitted.expiryDate <= "2026-11-15"
                ? "EXPIRING_SOON"
                : "VALID",
          updatedAt: "2026-10-16T08:30:00.000Z",
        });
        return fulfillJson(route, row);
      }
      if (url.pathname === "/local/meals" && method === "GET") return fulfillJson(route, []);
      if (
        method === "GET" &&
        [
          "/local/staff-tasks",
          "/local/staff-task-review",
          "/local/staff-task-assignees",
          "/local/student-options",
        ].includes(url.pathname)
      )
        return fulfillJson(route, []);
      if (url.pathname === "/local/binding-applications" && method === "GET")
        return fulfillJson(route, profile === "owner-east" ? eastRows : []);
      if (url.pathname === "/local/supply-requests-review" && method === "GET")
        return fulfillJson(route, []);
      if (url.pathname === "/local/supply-requests" && method === "GET")
        return fulfillJson(route, []);
      if (url.pathname === "/local/supply-summary" && method === "GET")
        return fulfillJson(route, {
          synthetic: true,
          counts: {
            DRAFT: 0,
            SUBMITTED: 0,
            CONFIRMED: 0,
            RETURNED: 0,
            READY: 0,
            OUT_OF_STOCK: 0,
            CANCELLED: 0,
            CLAIMED: 0,
          },
        });
      if (url.pathname === "/local/health-incident-review" && method === "GET")
        return fulfillJson(route, []);
      if (url.pathname === "/local/leave-requests" && method === "GET")
        return fulfillJson(route, []);
      if (url.pathname === "/local/privacy-requests" && method === "GET")
        return fulfillJson(route, privacyRows.get(profile) ?? []);
      if (url.pathname === "/local/audit" && method === "GET") return fulfillJson(route, []);
      const reviewMatch = url.pathname.match(/^\/local\/binding-applications\/([^/]+)\/review$/u);
      if (reviewMatch && method === "POST") {
        if (profile !== "owner-east")
          return fulfillJson(route, { error: { code: "FORBIDDEN" } }, 403);
        const row = eastRows.find((candidate) => candidate.id === reviewMatch[1]);
        const submitted = JSON.parse(request.postData() ?? "{}");
        if (!row || row.status !== "PENDING" || submitted.version !== row.version)
          return fulfillJson(route, { error: { code: "STATE_CONFLICT" } }, 409);
        row.status = submitted.action === "approve" ? "APPROVED" : "REJECTED";
        row.version += 1;
        return fulfillJson(route, row);
      }
      const privacyReviewMatch = url.pathname.match(
        /^\/local\/privacy-requests\/([^/]+)\/review$/u,
      );
      if (privacyReviewMatch && method === "POST") {
        if (profile !== "owner-east")
          return fulfillJson(route, { error: { code: "UNAVAILABLE" } }, 403);
        const row = privacyRows.get(profile)?.find(({ id }) => id === privacyReviewMatch[1]);
        const submitted = JSON.parse(request.postData() ?? "{}");
        const expectedStatus = submitted.action === "START" ? "SUBMITTED" : "IN_REVIEW";
        if (!row || row.status !== expectedStatus || submitted.version !== row.version)
          return fulfillJson(route, { error: { code: "STATE_CONFLICT" } }, 409);
        row.status = submitted.action === "START" ? "IN_REVIEW" : "SIMULATED_COMPLETE";
        row.version += 1;
        row.updatedAt = "2026-10-14T08:10:00.000Z";
        return fulfillJson(route, row);
      }
      return fulfillJson(route, { error: { code: "UNAVAILABLE" } }, 403);
    }
    if (
      url.origin === baseUrl &&
      url.pathname === "/api/admin/me" &&
      route.request().method() === "GET"
    )
      return fulfillJson(route, { error: { code: "UNAUTHENTICATED" } }, 401);
    if (url.origin !== baseUrl) {
      externalRequests.push(url.origin);
      return route.abort();
    }
    return route.continue();
  });

  const monthlyApiFixture = async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (
      url.origin !== baseUrl ||
      !(
        ["/api/admin/identity/login", "/api/admin/me", "/api/admin/monthly-feedback"].includes(
          url.pathname,
        ) || url.pathname.startsWith("/api/admin/monthly-feedback/")
      )
    )
      return route.fallback();
    const method = request.method();
    const headers = await request.allHeaders();
    const authenticated =
      monthlySignedIn &&
      (headers.cookie ?? "")
        .split(";")
        .some((part) => part.trim() === "student_care_admin_session=" + monthlySessionToken);
    const submitted = request.postData() ? request.postDataJSON() : undefined;
    monthlyApiRequests.push({
      method,
      path: url.pathname,
      authenticated,
      ...(url.pathname.startsWith("/api/admin/monthly-feedback") ? { body: submitted } : {}),
    });
    assert.equal(url.search, "", "Monthly requests must not supply client scope or query fields.");
    if (url.pathname === "/api/admin/identity/login" && method === "POST") {
      assert.deepEqual(submitted, {
        username: "monthly-reviewer-demo",
        password: "synthetic-only-password",
      });
      monthlySignedIn = true;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: {
          "set-cookie":
            "student_care_admin_session=" +
            monthlySessionToken +
            "; Path=/api/admin; HttpOnly; SameSite=Lax",
        },
        body: JSON.stringify({ data: { expires_at: "2099-01-01T00:00:00.000Z" } }),
      });
    }
    if (!authenticated) return fulfillJson(route, { error: { code: "UNAUTHENTICATED" } }, 401);
    if (url.pathname === "/api/admin/me" && method === "GET")
      return fulfillJson(route, {
        data: {
          display_name: "合成月度审核员",
          memberships: [
            {
              status: "ACTIVE",
              capabilities: [
                "identity:read",
                "feedback:read",
                "feedback:review",
                "feedback:publish",
              ],
            },
          ],
        },
      });
    const envelope = (data) => ({
      data,
      request_id: "00000000-0000-4000-8000-000000000345",
    });
    if (url.pathname === "/api/admin/monthly-feedback" && method === "GET") {
      if (failNextMonthlyFeedbackRead) {
        failNextMonthlyFeedbackRead = false;
        expectedMonthlyFeedback503ConsoleError = true;
        expectedMonthlyFeedback503Responses += 1;
        return fulfillJson(route, { error: { code: "UNAVAILABLE" } }, 503);
      }
      if (invalidateNextMonthlyFeedbackRead) {
        invalidateNextMonthlyFeedbackRead = false;
        const row = monthlyFeedbackRows[0];
        row.status = "REVIEW_REQUIRED";
        row.version += 1;
        row.sourceVersion += 1;
        row.sourceCounts.GROWTH_RECORD += 1;
        row.actions = [];
      }
      return fulfillJson(route, envelope({ records: monthlyFeedbackRows, canCreate: false }));
    }
    const match = url.pathname.match(
      /^\/api\/admin\/monthly-feedback\/([0-9a-f-]{36})\/(review|publish)$/iu,
    );
    if (!match || method !== "POST")
      return fulfillJson(route, { error: { code: "NOT_FOUND_SCOPED" } }, 404);
    assert.deepEqual(
      Object.keys(submitted).sort(),
      match[2] === "review" ? ["action", "version"] : ["version"],
    );
    assert.equal(Number.isSafeInteger(submitted.version) && submitted.version > 0, true);
    const row = monthlyFeedbackRows.find(({ id }) => id === match[1]);
    assert.ok(row, "The page must act on an actual row returned by its list.");
    assert.equal(submitted.version, row.version, "The page must send the last confirmed version.");
    if (conflictNextMonthlyFeedbackWrite) {
      conflictNextMonthlyFeedbackWrite = false;
      row.version += 1;
      row.sourceVersion += 1;
      row.status = "REVIEW_REQUIRED";
      row.actions = [];
      expectedMonthlyFeedback409ConsoleError = true;
      return fulfillJson(route, { error: { code: "CONFLICT_STATE" } }, 409);
    }
    if (match[2] === "review") {
      assert.ok(["CONFIRM", "RETURN"].includes(submitted.action));
      assert.ok(row.actions.includes(submitted.action === "CONFIRM" ? "confirm" : "return"));
      row.status = submitted.action === "CONFIRM" ? "CONFIRMED" : "RETURNED";
      row.actions = row.status === "CONFIRMED" ? ["return", "publish"] : [];
    } else {
      assert.equal(row.status, "CONFIRMED");
      assert.ok(row.actions.includes("publish"));
      row.status = "PUBLISHED";
      row.actions = [];
    }
    row.version += 1;
    return fulfillJson(route, envelope(row));
  };
  await page.goto(`${baseUrl}/admin/institution`, { waitUntil: "networkidle" });
  assert.equal(await page.locator("h1").innerText(), "机构概览");
  assert.equal(await page.locator("#admin-navigation a").count(), 31);
  const institutionSettingPanel = page.locator("[data-learning-institution-setting]");
  await institutionSettingPanel.waitFor();
  await page.getByText("已关闭", { exact: true }).waitFor();
  await institutionSettingPanel.getByRole("button", { name: "开启学习辅助" }).click();
  await page.getByText("本校区已保存开启设置。", { exact: true }).waitFor();
  await institutionSettingPanel.getByRole("button", { name: "关闭学习辅助" }).click();
  await page.getByText("本校区已保存关闭设置。", { exact: true }).waitFor();
  for (const [href, label, pageTitle = label] of browserRouteOrder) {
    const link = page.locator(`#admin-navigation a[href="${href}"]`);
    assert.equal(await link.innerText(), label);
    if (href === "/admin/staff-credentials") {
      // Reset this shared fixture before page load so the client reads the active membership.
      membershipRows["owner-east"][0].status = "ACTIVE";
    }
    const anonymousDailyResponse =
      href === "/admin/staff-daily-review"
        ? page.waitForResponse(
            (response) =>
              response.url() === `${baseUrl}/api/admin/me` &&
              response.request().method() === "GET" &&
              response.status() === 401,
          )
        : null;
    await link.click();
    await page.waitForURL(`**${href}`);
    await page.waitForLoadState("networkidle");
    assert.equal(await page.locator("h1").innerText(), pageTitle);
    await page.waitForFunction(
      (expectedTitle) => document.title === expectedTitle,
      `${pageTitle} | 同芯学园管理端`,
    );
    assert.equal(await page.title(), `${pageTitle} | 同芯学园管理端`);
    if (href === "/admin/institution") {
      assert.equal(await page.locator(".migration-notice").count(), 0);
      const overview = page.locator(".institution-overview-panel");
      assert.equal(await overview.count(), 1);
      assert.match(await overview.innerText(), /模拟机构/u);
      assert.match(await overview.innerText(), /模拟东校区/u);
      for (const destination of [
        "/admin/binding-review",
        "/admin/care-record-review",
        "/admin/home-content",
        "/admin/public-teachers",
      ]) {
        await overview.locator(`a[href="${destination}"]`).waitFor();
      }
      if (process.env.ADMIN_INSTITUTION_OVERVIEW_EVIDENCE_DIR) {
        const evidenceDir = resolve(process.env.ADMIN_INSTITUTION_OVERVIEW_EVIDENCE_DIR);
        await mkdir(evidenceDir, { recursive: true });
        await page.screenshot({
          path: resolve(evidenceDir, "desktop.png"),
          fullPage: true,
        });
      }
    } else if (href === "/admin/staff") {
      assert.equal(await page.locator(".migration-notice").count(), 0);
      const panel = page.locator("[data-staff-members-panel]");
      await page.locator("[data-staff-members-state='READY']").waitFor();
      assert.equal(await panel.count(), 1);
      assert.equal(await page.locator("[data-staff-member-row]").count(), 1);
      assert.equal(await panel.getByText("模拟教师甲", { exact: true }).count(), 1);
      assert.equal(
        await page
          .locator("body")
          .evaluate((body) => /66666666|00000000-0000-4000/u.test(body.innerText)),
        false,
      );
      const desktopLayout = await page.evaluate(() => {
        const sidebar = document.querySelector(".admin-sidebar").getBoundingClientRect();
        const content = document.querySelector(".admin-main").getBoundingClientRect();
        return {
          sidebarLeft: sidebar.left,
          sidebarWidth: sidebar.width,
          contentLeft: content.left,
        };
      });
      assert.equal(desktopLayout.sidebarLeft, 0);
      assert.ok(
        desktopLayout.contentLeft >= desktopLayout.sidebarWidth,
        JSON.stringify(desktopLayout),
      );
      if (process.env.ADMIN_STAFF_MEMBERS_EVIDENCE_DIR) {
        const evidenceDir = resolve(process.env.ADMIN_STAFF_MEMBERS_EVIDENCE_DIR);
        await mkdir(evidenceDir, { recursive: true });
        await page.screenshot({
          path: resolve(evidenceDir, "desktop.png"),
          fullPage: true,
        });
        await page.setViewportSize({ width: 390, height: 844 });
        await page.waitForFunction(
          () => getComputedStyle(document.querySelector(".admin-sidebar")).visibility === "hidden",
        );
        assert.equal(await page.locator(".nav-toggle").getAttribute("aria-expanded"), "false");
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390);
        const refreshButtonBox = await page.getByRole("button", { name: "刷新名单" }).boundingBox();
        assert.ok(
          refreshButtonBox && refreshButtonBox.height <= 52,
          JSON.stringify(refreshButtonBox),
        );
        await page.screenshot({
          path: resolve(evidenceDir, "mobile.png"),
          fullPage: true,
        });
        await page.setViewportSize({ width: 320, height: 568 });
        await page.waitForFunction(
          () => getComputedStyle(document.querySelector(".admin-sidebar")).visibility === "hidden",
        );
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 320);
        await page.setViewportSize({ width: 1365, height: 900 });
      }
      failNextMembershipRead = true;
      await page.getByRole("button", { name: "刷新名单" }).click();
      await page.locator("[data-staff-members-state='DENIED']").waitFor();
      await page.waitForTimeout(100);
      assert.equal(expectedMembership503Responses, 1);
      assert.equal(expectedMembership503ConsoleError, false);
      assert.equal(await page.locator("[data-staff-member-row]").count(), 0);
      assert.equal(await page.getByRole("button", { name: "重新连接" }).count(), 1);
      await page.getByRole("button", { name: "重新连接" }).click();
      await page.locator("[data-staff-members-state='READY']").waitFor();
      assert.equal(await page.locator("[data-staff-member-row]").count(), 1);
      const member = page.locator("[data-staff-member-row='0']");
      await member.getByRole("button", { name: "停用" }).click();
      await member.locator('[data-staff-member-status="SUSPENDED"]').waitFor();
      await member.getByRole("button", { name: "恢复" }).click();
      await member.locator('[data-staff-member-status="ACTIVE"]').waitFor();
      page.once("dialog", (dialog) => dialog.accept());
      await member.getByRole("button", { name: "撤销账号" }).click();
      await member.locator('[data-staff-member-status="REVOKED"]').waitFor();
      assert.equal(await member.getByRole("button").count(), 0);
      await page.locator("#staff-members-profile").selectOption("owner-west");
      await page.getByText("模拟教师乙", { exact: true }).waitFor();
      assert.equal(await page.getByText("模拟教师甲", { exact: true }).count(), 0);
      await page.locator("#staff-members-profile").selectOption("owner-other-tenant");
      await page.getByText("当前授权校区暂无可管理员工。", { exact: true }).waitFor();
      await page.locator("#staff-members-profile").selectOption("owner-east");
      await page.locator('[data-staff-member-status="REVOKED"]').waitFor();
      assert.equal(
        localApiCalls.filter(
          ({ path, method }) => method === "PATCH" && path.startsWith("/local/memberships/"),
        ).length,
        3,
      );
      assert.equal(
        localApiCalls.filter(
          ({ path }) => path === "/local/memberships" || path === "/local/membership-events",
        ).length > 0,
        true,
      );
    } else if (href === "/admin/staff-tasks") {
      assert.equal(await page.locator(".migration-notice").count(), 0);
      await page.locator("[data-admin-task-state='UNAUTHENTICATED']").waitFor();
      assert.equal(await page.locator("[data-admin-task-form]").count(), 0);
      assert.equal(await page.locator("[data-admin-task-card]").count(), 0);
      const taskLogin = page.getByRole("link", { name: "登录管理工作台", exact: true });
      assert.equal(
        await taskLogin.getAttribute("href"),
        "/admin/login?next=%2Fadmin%2Fstaff-tasks",
      );
      const taskSessionToken = "t".repeat(43);
      let taskSignedIn = false;
      const taskApiRequests = [];
      const taskApiFixture = async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        if (
          url.origin !== baseUrl ||
          !["/api/admin/identity/login", "/api/admin/me", "/api/admin/tasks"].includes(url.pathname)
        )
          return route.fallback();
        const method = request.method();
        const headers = await request.allHeaders();
        const authenticated =
          taskSignedIn &&
          (headers.cookie ?? "")
            .split(";")
            .some((part) => part.trim() === "student_care_admin_session=" + taskSessionToken);
        taskApiRequests.push({ method, path: url.pathname, authenticated });
        if (url.pathname === "/api/admin/identity/login" && method === "POST") {
          assert.deepEqual(JSON.parse(request.postData() ?? "{}"), {
            username: "task-reviewer-demo",
            password: "synthetic-only-password",
          });
          taskSignedIn = true;
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            headers: {
              "set-cookie":
                "student_care_admin_session=" +
                taskSessionToken +
                "; Path=/api/admin; HttpOnly; SameSite=Lax",
            },
            body: JSON.stringify({ data: { expires_at: "2099-01-01T00:00:00.000Z" } }),
          });
        }
        if (!authenticated) return fulfillJson(route, { error: { code: "UNAUTHENTICATED" } }, 401);
        if (url.pathname === "/api/admin/me" && method === "GET")
          return fulfillJson(route, {
            data: {
              display_name: "模拟任务审核员",
              memberships: [
                { status: "ACTIVE", capabilities: ["identity:read", "task:read", "task:check"] },
              ],
            },
          });
        if (url.pathname === "/api/admin/tasks" && method === "GET")
          return fulfillJson(route, { data: { tasks: [], choices: [], canAssign: false } });
        return fulfillJson(route, { error: { code: "NOT_FOUND" } }, 404);
      };
      await page.route("**/api/admin/**", taskApiFixture);
      try {
        await taskLogin.click();
        await page.waitForURL("**/admin/login?next=%2Fadmin%2Fstaff-tasks");
        await page.locator("#admin-login-username").fill("task-reviewer-demo");
        await page.locator("#admin-login-password").fill("synthetic-only-password");
        await page.getByRole("button", { name: "登录", exact: true }).click();
        await page.waitForURL("**/admin/staff-tasks");
        const tasks = page.locator("[data-admin-task-state='READY']");
        await tasks.waitFor();
        assert.equal(await page.locator("[data-admin-task-card]").count(), 0);
        assert.match(await tasks.innerText(), /当前校区还没有任务/u);
        assert.equal(
          taskApiRequests.filter(
            ({ method, path }) => method === "POST" && path === "/api/admin/identity/login",
          ).length,
          1,
        );
        for (const path of ["/api/admin/me", "/api/admin/tasks"]) {
          const reads = taskApiRequests.filter((request) => request.path === path);
          assert.ok(reads.length > 0);
          assert.ok(reads.every((request) => request.method === "GET" && request.authenticated));
        }
      } finally {
        await page.unroute("**/api/admin/**", taskApiFixture);
        await page.context().clearCookies({ name: "student_care_admin_session" });
      }
    } else if (href === "/admin/staff-daily-review") {
      assert.equal(await page.locator(".migration-notice").count(), 0);
      assert.equal(await page.locator("[data-staff-daily-review-panel]").count(), 1);
      await page.getByRole("heading", { name: "待审核日报" }).waitFor();
      await page.locator("[data-staff-daily-review-state='UNAUTHENTICATED']").waitFor();
      assert.equal(await (await anonymousDailyResponse).finished(), null);
      const reportId = "11111111-1111-4111-8111-111111111111";
      const auditToken = "a".repeat(43);
      const dailyRow = {
        id: reportId,
        version: 2,
        date: "2026-10-29",
        authorLabel: "合成教师甲",
        status: "SUBMITTED",
        values: {
          arrival: "ARRIVED_AS_PLANNED",
          homework: "COMPLETED",
          activity: "PARTICIPATED",
          classroom: "ROUTINE",
          followUp: "NONE",
        },
        sourceCounts: { TASK: 0, ATTENDANCE: 0, CARE_RECORD: 0, PICKUP: 0, PICKUP_EXCEPTION: 0 },
        learningSummary: null,
        actions: ["confirm", "return"],
      };
      const auditEvents = [
        {
          action: "CREATED",
          reportVersion: 1,
          actorLabel: "合成教师甲",
          initiatedByLabel: "合成教师甲",
          occurredAt: "2026-10-29T08:00:00.000Z",
        },
        {
          action: "SUBMITTED",
          reportVersion: 2,
          actorLabel: "合成教师甲",
          initiatedByLabel: "合成教师甲",
          occurredAt: "2026-10-29T08:10:00.000Z",
        },
      ];
      const auditRequests = [];
      const dailyAuditFixture = async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        auditRequests.push({ path: url.pathname, method: request.method() });
        if (url.pathname === "/api/admin/me")
          return route.fulfill({
            json: {
              data: {
                display_name: "合成审核人",
                memberships: [{ status: "ACTIVE", capabilities: ["daily:review"] }],
              },
            },
          });
        if (url.pathname === "/api/admin/daily-reports" && request.method() === "GET")
          return route.fulfill({ json: { data: { records: [dailyRow] } } });
        if (
          url.pathname === `/api/admin/daily-reports/${reportId}/audit-events` &&
          request.method() === "GET"
        )
          return route.fulfill({ json: { data: { events: auditEvents } } });
        return route.fulfill({ status: 404, json: { error: { message: "not found" } } });
      };
      await page.route("**/api/admin/**", dailyAuditFixture);
      try {
        await page.context().addCookies([
          {
            name: "student_care_admin_session",
            value: auditToken,
            url: baseUrl,
            httpOnly: true,
            sameSite: "Lax",
          },
        ]);
        await page.reload();
        await page.locator("[data-staff-daily-review-state='READY']").waitFor();
        const toggle = page.locator(`[data-staff-daily-audit-toggle="${reportId}"]`);
        await toggle.click();
        const timeline = page.locator(`[data-staff-daily-audit-events="${reportId}"]`);
        await timeline.getByText("提交审核 · 第 2 版", { exact: true }).waitFor();
        assert.equal(await timeline.locator("ol li").count(), 2);
        assert.match(await timeline.innerText(), /合成教师甲/u);
        assert.doesNotMatch(await timeline.innerText(), /11111111-1111/u);
        assert.ok(
          auditRequests.some(
            ({ path, method }) =>
              path === `/api/admin/daily-reports/${reportId}/audit-events` && method === "GET",
          ),
        );
      } finally {
        await page.unroute("**/api/admin/**", dailyAuditFixture);
        await page.context().clearCookies({ name: "student_care_admin_session" });
      }
    } else if (href === "/admin/staff-credentials") {
      const panel = page.locator("[data-staff-credentials-state]");
      await panel.waitFor();
      await page.locator("[data-staff-credentials-state='READY']").waitFor();
      assert.equal(await page.locator("[data-staff-credential-row]").count(), 1);
      assert.equal(await page.getByText("模拟教师甲", { exact: true }).count(), 1);
      const bodyText = await page.locator("body").innerText();
      assert.doesNotMatch(bodyText, /00000000-0000-4000|66666666|88888888/u);
      const bodyHtml = await page.locator("body").evaluate((body) => body.innerHTML);
      assert.doesNotMatch(bodyHtml, /00000000-0000-4000|66666666|88888888/u);

      const desktopLayout = await page.evaluate(() => {
        const sidebar = document.querySelector(".admin-sidebar").getBoundingClientRect();
        const content = document.querySelector(".admin-main").getBoundingClientRect();
        return {
          sidebarLeft: sidebar.left,
          sidebarWidth: sidebar.width,
          contentLeft: content.left,
        };
      });
      assert.equal(desktopLayout.sidebarLeft, 0);
      assert.ok(desktopLayout.contentLeft >= desktopLayout.sidebarWidth);
      if (process.env.ADMIN_STAFF_CREDENTIALS_EVIDENCE_DIR) {
        const evidenceDir = resolve(process.env.ADMIN_STAFF_CREDENTIALS_EVIDENCE_DIR);
        await mkdir(evidenceDir, { recursive: true });
        await page.screenshot({
          path: resolve(evidenceDir, "desktop.png"),
          fullPage: true,
        });
        for (const width of [390, 320]) {
          await page.setViewportSize({
            width,
            height: width === 390 ? 844 : 568,
          });
          await page.waitForFunction(
            () =>
              getComputedStyle(document.querySelector(".admin-sidebar")).visibility === "hidden",
          );
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width);
          await page.screenshot({
            path: resolve(evidenceDir, width === 390 ? "mobile-390.png" : "mobile-320.png"),
            fullPage: true,
          });
        }
        await page.setViewportSize({ width: 1365, height: 900 });
      }

      const createForm = page.locator("[data-credential-create]");
      await createForm.locator("[data-credential-issue-date]").fill("2026-01-01");
      await createForm.locator("[data-credential-expiry-date]").fill("2027-01-01");
      await createForm.getByRole("button", { name: "新增资格材料" }).click();
      await page.waitForFunction(
        () => document.querySelectorAll("[data-staff-credential-row]").length === 2,
      );
      const firstCredential = page.locator("[data-staff-credential-row='0']");
      const editDetails = firstCredential.locator("[data-credential-edit]");
      await editDetails.locator("summary").click();
      await editDetails.locator('input[name="expiryDate"]').fill("2026-10-15");
      await editDetails.getByRole("button", { name: "保存变更" }).click();
      await firstCredential.locator('[data-credential-status="EXPIRED"]').waitFor();
      assert.equal(await firstCredential.locator("[data-credential-history] li").count(), 1);

      await page.locator("#staff-credentials-profile").selectOption("owner-west");
      await page.locator("[data-staff-credentials-profile='owner-west']").waitFor();
      await page.getByText("当前校区暂无资格材料。", { exact: true }).waitFor();
      assert.equal(await page.locator("[data-staff-credential-row]").count(), 0);
      await page.locator("#staff-credentials-profile").selectOption("owner-other-tenant");
      await page.locator("[data-staff-credentials-profile='owner-other-tenant']").waitFor();
      await page.getByText("当前授权校区暂无可管理的员工资料。", { exact: true }).waitFor();
      await page.locator("#staff-credentials-profile").selectOption("owner-east");
      await page.locator("[data-staff-credentials-profile='owner-east']").waitFor();
      assert.equal(await page.locator("[data-staff-credential-row]").count(), 2);

      failNextStaffCredentialRead = true;
      await page.getByRole("button", { name: "刷新资料" }).click();
      await page.locator("[data-staff-credentials-state='DENIED']").waitFor();
      assert.equal(await page.locator("[data-staff-credential-row]").count(), 0);
      await page.getByRole("button", { name: "重新连接" }).click();
      await page.locator("[data-staff-credentials-state='READY']").waitFor();
      assert.equal(await page.locator("[data-staff-credential-row]").count(), 2);
      assert.equal(expectedStaffCredentials503Responses, 1);
      assert.equal(expectedStaffCredentials503ConsoleError, false);
      assert.equal(
        localApiCalls.filter(
          ({ method, path }) => method === "POST" && path === "/local/staff-credentials",
        ).length,
        1,
      );
      assert.equal(
        localApiCalls.filter(
          ({ method, path }) =>
            method === "PATCH" && /^\/local\/staff-credentials\/[0-9a-f-]{36}$/iu.test(path),
        ).length,
        1,
      );
    } else if (href === "/admin/staff-operations") {
      const panel = page.locator("[data-staff-operations]");
      assert.equal(await panel.count(), 1);
      assert.match(
        await page.locator("#main-content").innerText(),
        /当前页面内存中，离开或刷新后重置/u,
      );
      assert.equal(await page.locator("[data-work-material-row]").count(), 1);
      assert.equal(await page.locator("[data-performance-review-row]").count(), 1);
      assert.equal(await page.locator("[data-recruitment-row]").count(), 1);

      const layout = await page.evaluate(() => {
        const sidebar = document.querySelector(".admin-sidebar").getBoundingClientRect();
        const content = document.querySelector(".admin-main").getBoundingClientRect();
        return {
          sidebarLeft: sidebar.left,
          sidebarWidth: sidebar.width,
          contentLeft: content.left,
        };
      });
      assert.equal(layout.sidebarLeft, 0);
      assert.ok(layout.contentLeft >= layout.sidebarWidth);
      if (process.env.ADMIN_STAFF_OPERATIONS_EVIDENCE_DIR) {
        const evidenceDir = resolve(process.env.ADMIN_STAFF_OPERATIONS_EVIDENCE_DIR);
        await mkdir(evidenceDir, { recursive: true });
        await page.screenshot({
          path: resolve(evidenceDir, "desktop.png"),
          fullPage: true,
        });
        for (const width of [390, 320]) {
          await page.setViewportSize({
            width,
            height: width === 390 ? 844 : 568,
          });
          await page.waitForFunction(
            () =>
              getComputedStyle(document.querySelector(".admin-sidebar")).visibility === "hidden",
          );
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width);
          await page.screenshot({
            path: resolve(evidenceDir, width === 390 ? "mobile-390.png" : "mobile-320.png"),
            fullPage: true,
          });
        }
        await page.setViewportSize({ width: 1365, height: 900 });
      }

      const beforeCalls = localApiCalls.length;
      const firstMaterial = page.locator("[data-work-material-row='0']");
      await firstMaterial.getByRole("button", { name: "标记需跟进" }).click();
      await firstMaterial.locator("[data-material-status='NEEDS_FOLLOW_UP']").waitFor();

      const materialForm = page.locator("[data-work-material-form]");
      await materialForm.locator("select[name='staffId']").selectOption("synthetic-staff-east-002");
      await materialForm.locator("input[name='period']").fill("2026-10");
      await materialForm.getByRole("button", { name: "新增工作材料" }).click();
      await page.waitForFunction(
        () => document.querySelectorAll("[data-work-material-row]").length === 2,
      );
      const secondMaterial = page.locator("[data-work-material-row='1']");
      await secondMaterial.getByRole("button", { name: "确认已核对" }).click();
      await secondMaterial.locator("[data-material-status='REVIEWED']").waitFor();

      const firstReview = page.locator("[data-performance-review-row='0']");
      await firstReview.getByRole("button", { name: "确认记录" }).click();
      await firstReview.locator("[data-performance-status='CONFIRMED']").waitFor();
      const reviewForm = page.locator("[data-performance-review-form]");
      await reviewForm.locator("select[name='area']").selectOption("FAMILY_COMMUNICATION");
      await reviewForm.getByRole("button", { name: "新增工作回顾" }).click();
      await page.waitForFunction(
        () => document.querySelectorAll("[data-performance-review-row]").length === 2,
      );
      const secondReview = page.locator("[data-performance-review-row='1']");
      await secondReview.getByRole("button", { name: "标记需持续跟进" }).click();
      await secondReview.locator("[data-performance-status='FOLLOW_UP']").waitFor();

      const recruitment = page.locator("[data-recruitment-row='0']");
      await recruitment.locator("select[name='stage']").selectOption("INTERVIEW_SCHEDULED");
      await recruitment.locator("input[name='nextFollowUpDate']").fill("2026-10-25");
      await recruitment.getByRole("button", { name: "保存跟进" }).click();
      const recruitmentSummary = recruitment.locator(
        "span[data-recruitment-stage='INTERVIEW_SCHEDULED']",
      );
      await recruitmentSummary.waitFor();
      assert.match(await recruitmentSummary.innerText(), /2026-10-25/u);
      const recruitmentForm = page.locator("[data-recruitment-form]");
      await recruitmentForm.getByRole("button", { name: "新增跟进对象" }).click();
      await page.waitForFunction(
        () => document.querySelectorAll("[data-recruitment-row]").length === 2,
      );
      assert.equal(await page.getByText("模拟候选人02", { exact: true }).count(), 1);

      const renderedText = await page.locator("body").innerText();
      const renderedHtml = await page.locator("body").evaluate((body) => body.innerHTML);
      assert.doesNotMatch(renderedText, /00000000-0000-4000|66666666|88888888/u);
      assert.doesNotMatch(
        renderedHtml,
        /work-material-synthetic|performance-review-synthetic|recruitment-lead-synthetic|00000000-0000-4000/u,
      );
      assert.equal(localApiCalls.length, beforeCalls);
    } else if (href === "/admin/child-monthly-review") {
      assert.equal(await page.locator(".migration-notice").count(), 0);
      await page.locator("[data-child-monthly-review-state='UNAUTHENTICATED']").waitFor();
      await page.waitForLoadState("networkidle");
      let expired = false;
      const childApiFixture = async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        if (url.origin !== baseUrl || url.pathname !== "/api/admin/child-monthly-reports")
          return monthlyApiFixture(route);
        assert.equal(request.method(), "GET");
        assert.equal(url.search, "");
        const headers = await request.allHeaders();
        assert.ok(monthlySignedIn);
        assert.ok(
          (headers.cookie ?? "").includes("student_care_admin_session=" + monthlySessionToken),
        );
        if (expired)
          return route.fulfill({
            status: 401,
            contentType: "application/json",
            headers: {
              "set-cookie":
                "student_care_admin_session=; Path=/api/admin; Max-Age=0; HttpOnly; SameSite=Lax",
            },
            body: JSON.stringify({ error: { code: "UNAUTHENTICATED" } }),
          });
        return fulfillJson(route, { data: { records: [], students: [] } });
      };
      await page.route("**/api/admin/**", childApiFixture);
      try {
        const login = page.getByRole("link", { name: "登录审核账号", exact: true });
        assert.equal(
          new URL(await login.getAttribute("href"), baseUrl).searchParams.get("next"),
          href,
        );
        await login.click();
        await page.waitForURL((url) => url.pathname === "/admin/login");
        await page.locator("#admin-login-username").fill("monthly-reviewer-demo");
        await page.locator("#admin-login-password").fill("synthetic-only-password");
        await page.getByRole("button", { name: "登录", exact: true }).click();
        await page.waitForURL("**/admin/child-monthly-review");
        await page.locator("[data-child-monthly-review-state='READY']").waitFor();
        assert.equal(await page.locator("[data-child-monthly-review-row]").count(), 0);
        await page.getByText("当前授权范围暂无孩子个人月报。", { exact: true }).waitFor();
        expired = true;
        await page.locator("[data-child-monthly-review-refresh]").click();
        await page.locator("[data-child-monthly-review-state='UNAUTHENTICATED']").waitFor();
        assert.equal(await page.locator("[data-child-monthly-review-row]").count(), 0);
        assert.equal(await page.getByText("当前审核人：", { exact: false }).count(), 0);
        await page.getByRole("link", { name: "登录审核账号", exact: true }).waitFor();
        await page.waitForLoadState("networkidle");
      } finally {
        monthlySignedIn = false;
        await page.unroute("**/api/admin/**", childApiFixture);
        await page.context().clearCookies({ name: "student_care_admin_session" });
      }
    } else if (href === "/admin/monthly-feedback-review") {
      assert.equal(await page.locator(".migration-notice").count(), 0);
      await page.locator("[data-monthly-feedback-state='UNAUTHENTICATED']").waitFor();
      await page.route("**/api/admin/**", monthlyApiFixture);
      try {
        assert.equal(await page.locator("[data-monthly-feedback-row]").count(), 0);
        const login = page.getByRole("link", { name: "登录审核账号", exact: true });
        const loginUrl = new URL(await login.getAttribute("href"), baseUrl);
        assert.equal(loginUrl.pathname, "/admin/login");
        assert.equal(loginUrl.searchParams.get("next"), "/admin/monthly-feedback-review");
        await login.click();
        await page.waitForURL((url) => url.pathname === "/admin/login");
        await page.locator("#admin-login-username").fill("monthly-reviewer-demo");
        await page.locator("#admin-login-password").fill("synthetic-only-password");
        await page.getByRole("button", { name: "登录", exact: true }).click();
        await page.waitForURL("**/admin/monthly-feedback-review");
        await page.locator("[data-monthly-feedback-state='READY']").waitFor();
        const panel = page.locator("[data-monthly-feedback-state]");
        assert.equal(await page.locator("[data-monthly-feedback-row]").count(), 2);
        assert.match(await panel.innerText(), /合成班级甲/u);
        assert.match(await panel.innerText(), /2026-10/u);
        assert.match(await panel.innerText(), /2026-09/u);
        assert.match(await panel.innerText(), /成长记录/u);
        assert.doesNotMatch(
          await page.locator("body").innerText(),
          /88888888|99999999|00000000-0000-4000|模拟教师|发布家长摘要/u,
        );
        assert.equal(await panel.getByRole("combobox").count(), 0);
        assert.equal(await panel.getByRole("button", { name: "检查来源变化" }).count(), 0);
        const desktopLayout = await page.evaluate(() => {
          const sidebar = document.querySelector(".admin-sidebar").getBoundingClientRect();
          const content = document.querySelector(".admin-main").getBoundingClientRect();
          return {
            sidebarLeft: sidebar.left,
            sidebarWidth: sidebar.width,
            contentLeft: content.left,
          };
        });
        assert.equal(desktopLayout.sidebarLeft, 0);
        assert.ok(desktopLayout.contentLeft >= desktopLayout.sidebarWidth);
        if (process.env.ADMIN_MONTHLY_FEEDBACK_EVIDENCE_DIR) {
          const evidenceDir = resolve(process.env.ADMIN_MONTHLY_FEEDBACK_EVIDENCE_DIR);
          await mkdir(evidenceDir, { recursive: true });
          await page.screenshot({ path: resolve(evidenceDir, "desktop.png"), fullPage: true });
        }

        const first = page.locator("[data-monthly-feedback-row]").nth(0);
        const second = page.locator("[data-monthly-feedback-row]").nth(1);
        const growthSource = first.getByRole("listitem").filter({ hasText: "已发布成长记录" });
        assert.match(await growthSource.innerText(), /1 条/u);
        await first.getByRole("button", { name: "确认总结", exact: true }).click();
        await first.and(page.locator("[data-monthly-feedback-status='CONFIRMED']")).waitFor();
        await first.getByRole("button", { name: "内部发布", exact: true }).click();
        await first.and(page.locator("[data-monthly-feedback-status='PUBLISHED']")).waitFor();
        assert.match(await first.innerText(), /内部/u);
        assert.equal(await first.getByRole("button").count(), 0);

        invalidateNextMonthlyFeedbackRead = true;
        await page.getByRole("button", { name: "刷新队列", exact: true }).click();
        await first.and(page.locator("[data-monthly-feedback-status='REVIEW_REQUIRED']")).waitFor();
        assert.match(await growthSource.innerText(), /2 条/u);
        assert.equal(await first.getByRole("button").count(), 0);

        await second.getByRole("button", { name: "退回修改", exact: true }).click();
        await second.and(page.locator("[data-monthly-feedback-status='RETURNED']")).waitFor();
        assert.equal(await second.getByRole("button").count(), 0);
        failNextMonthlyFeedbackRead = true;
        await page.getByRole("button", { name: "刷新队列", exact: true }).click();
        await page.locator("[data-monthly-feedback-state='ERROR']").waitFor();
        assert.equal(await page.locator("[data-monthly-feedback-row]").count(), 0);
        await page.getByRole("button", { name: "重新连接", exact: true }).click();
        await page.locator("[data-monthly-feedback-state='READY']").waitFor();
        assert.equal(await page.locator("[data-monthly-feedback-row]").count(), 2);
        assert.equal(expectedMonthlyFeedback503Responses, 1);

        // A separate staff session edited and resubmitted the returned report.
        monthlyFeedbackRows[1].status = "SUBMITTED";
        monthlyFeedbackRows[1].version = 4;
        monthlyFeedbackRows[1].actions = ["confirm", "return"];
        await page.getByRole("button", { name: "刷新队列", exact: true }).click();
        await second.and(page.locator("[data-monthly-feedback-status='SUBMITTED']")).waitFor();
        const requestsBeforeConflict = monthlyApiRequests.length;
        conflictNextMonthlyFeedbackWrite = true;
        await second.getByRole("button", { name: "确认总结", exact: true }).click();
        await page.locator("[data-monthly-feedback-state='READY']").waitFor();
        await second
          .and(page.locator("[data-monthly-feedback-status='REVIEW_REQUIRED']"))
          .waitFor();
        assert.match(await panel.innerText(), /本次操作未保存/u);
        assert.equal(await second.getByRole("button").count(), 0);
        const conflictRequests = monthlyApiRequests.slice(requestsBeforeConflict);
        assert.equal(conflictRequests.filter(({ method }) => method === "POST").length, 1);
        assert.ok(
          conflictRequests.some(
            ({ method, path }) => method === "GET" && path === "/api/admin/monthly-feedback",
          ),
          "A 409 must refresh the list without replaying the write.",
        );
        const writes = monthlyApiRequests.filter(
          ({ method, path }) =>
            method === "POST" && path.startsWith("/api/admin/monthly-feedback/"),
        );
        assert.deepEqual(
          writes.map(({ path, body }) => ({ path, body })),
          [
            {
              path: "/api/admin/monthly-feedback/88888888-8888-4888-8888-888888888881/review",
              body: { version: 1, action: "CONFIRM" },
            },
            {
              path: "/api/admin/monthly-feedback/88888888-8888-4888-8888-888888888881/publish",
              body: { version: 2 },
            },
            {
              path: "/api/admin/monthly-feedback/99999999-9999-4999-8999-999999999991/review",
              body: { version: 1, action: "RETURN" },
            },
            {
              path: "/api/admin/monthly-feedback/99999999-9999-4999-8999-999999999991/review",
              body: { version: 4, action: "CONFIRM" },
            },
          ],
        );
        assert.ok(writes.every(({ authenticated }) => authenticated));
        for (const path of ["/api/admin/me", "/api/admin/monthly-feedback"]) {
          const reads = monthlyApiRequests.filter((request) => request.path === path);
          assert.ok(reads.length > 0);
          assert.ok(reads.every(({ method, authenticated }) => method === "GET" && authenticated));
        }
        assert.equal(
          monthlyApiRequests.filter(({ path }) => path === "/api/admin/identity/login").length,
          1,
        );
        assert.deepEqual(monthlyLegacyRequests, []);
      } finally {
        monthlySignedIn = false;
        await page.unroute("**/api/admin/**", monthlyApiFixture);
        await page.context().clearCookies({ name: "student_care_admin_session" });
      }
    } else if (href === "/admin/binding-review") {
      assert.equal(await page.locator(".migration-notice").count(), 0);
      assert.equal(await page.locator(".binding-review-panel").count(), 1);
    } else if (href === "/admin/care-record-review") {
      assert.equal(await page.locator(".migration-notice").count(), 0);
      assert.equal(await page.locator(".care-record-review").count(), 1);
    } else if (href === "/admin/supply-request-review") {
      assert.equal(await page.locator(".migration-notice").count(), 0);
      assert.equal(await page.locator(".supply-review").count(), 1);
    } else if (href === "/admin/pickup-review") {
      assert.equal(await page.locator(".migration-notice").count(), 0);
      assert.equal(await page.locator(".pickup-review").count(), 1);
    } else if (href === "/admin/notice-review") {
      assert.equal(await page.locator(".migration-notice").count(), 0);
      assert.equal(await page.locator(".notice-review").count(), 1);
    } else if (href === "/admin/health-incident-review") {
      assert.equal(await page.locator(".migration-notice").count(), 0);
      assert.equal(await page.locator(".health-incident-review").count(), 1);
      await page.getByRole("link", { name: "前往账号登录" }).waitFor();
    } else if (href === "/admin/leave-review") {
      assert.equal(await page.locator(".migration-notice").count(), 0);
      assert.equal(await page.locator(".leave-review").count(), 1);
      await page.getByRole("link", { name: "前往账号登录" }).waitFor();
    } else if (href === "/admin/consent-review") {
      assert.equal(await page.locator(".migration-notice").count(), 0);
      assert.equal(await page.locator(".consent-review").count(), 1);
      await page.getByRole("button", { name: "连接并刷新" }).waitFor();
    } else if (href === "/admin/privacy-requests") {
      assert.equal(await page.locator(".migration-notice").count(), 0);
      assert.equal(await page.locator(".privacy-review").count(), 1);
      await page.getByRole("button", { name: "连接并刷新" }).waitFor();
    } else if (href === "/admin/audit-logs") {
      assert.equal(await page.locator(".migration-notice").count(), 0);
      assert.equal(await page.locator(".audit-logs").count(), 1);
      await page.getByRole("heading", { name: "审计日志" }).waitFor();
      assert.equal(await page.locator(".audit-log-row").count(), 6);
    } else if (href === "/admin/public-teachers") {
      assert.equal(await page.locator(".migration-notice").count(), 0);
      assert.equal(await page.locator(".public-teachers-panel").count(), 1);
    } else if (href === "/admin/activities") {
      assert.equal(await page.locator(".migration-notice").count(), 0);
      const activities = page.locator(".activities-panel");
      assert.equal(await activities.count(), 1);
      assert.match(await activities.innerText(), /科学小实验/u);
      assert.match(await activities.innerText(), /阅读分享/u);
      assert.match(await activities.innerText(), /v2.*已发布/u);
      assert.match(await activities.innerText(), /v1.*草稿/u);
      assert.match(await activities.innerText(), /不连接报名或外部服务/u);
    } else if (href === "/admin/home-content" || href === "/admin/publishing") {
      assert.equal(await page.locator(".migration-notice").count(), 0);
      assert.equal(await page.locator(".home-content-panel").count(), 1);
    } else if (href === "/admin/meals") {
      assert.equal(await page.locator(".migration-notice").count(), 0);
      assert.equal(await page.locator("#meals-title").count(), 1);
      await page
        .getByText("请先使用机构邀请账号登录，再管理当前校区的餐食。", { exact: false })
        .waitFor();
      await page.locator('a[href="/admin/login?next=%2Fadmin%2Fmeals"]').waitFor();
      assert.equal(
        await page.getByRole("button", { name: "新建餐食", exact: true }).isDisabled(),
        true,
      );
      assert.equal(await page.getByRole("textbox", { name: "菜品" }).isDisabled(), true);
    } else if (href === "/admin/fees") {
      const panel = page.locator("[data-fees-state='READY']");
      await panel.waitFor();
      await panel.getByLabel("学生").selectOption(feeStudent.id);
      await panel.getByLabel("资料类型").selectOption("BILL");
      await panel.getByLabel("标题").fill("十月托管服务费");
      await panel.getByLabel("所属月份").fill("2026-10");
      await panel.getByLabel("金额（元）").fill("680");
      await panel.getByLabel("开始日期").fill("2026-10-01");
      await panel.getByLabel("结束日期").fill("2026-10-31");
      await panel.getByLabel("给家长看的说明").fill("仅供本机浏览器验证的合成账单。");
      await panel.getByRole("button", { name: "保存并供家长查看" }).click();
      await page.getByRole("heading", { name: "十月托管服务费" }).waitFor();
      assert.equal(feeRequests[0]?.body.amount_minor, 68000);
      assert.equal(Object.hasOwn(feeRequests[0]?.body ?? {}, "campus_id"), false);
      await page.locator("[data-fee-document]").getByRole("button", { name: "撤回" }).click();
      await panel.locator("[data-fee-document]").getByText("已撤回", { exact: false }).waitFor();
      assert.deepEqual(feeRequests[1]?.body, { expected_version: 1 });
    } else if (href === "/admin/student-transfers") {
      assert.equal(await page.locator(".migration-notice").count(), 0);
      const panel = page.locator('[data-student-transfers-state="READY"]');
      await panel.waitFor();
      await panel
        .getByRole("combobox", { name: "学生", exact: true })
        .selectOption(transferStudent.id);
      await panel.getByRole("combobox", { name: "目标班级", exact: true }).selectOption("合成乙班");
      await panel.getByRole("button", { name: "提交转班申请", exact: true }).click();
      await panel.getByText("转班申请已提交，等待另一名审核人员处理。", { exact: true }).waitFor();
      assert.deepEqual(transferRequests[0], {
        student_id: transferStudent.id,
        destination_class_ref: "合成乙班",
      });
      assert.equal(await panel.getByRole("button", { name: "批准转班" }).count(), 0);
      transferReviewer = true;
      await panel.getByRole("button", { name: "刷新列表" }).click();
      await page.getByRole("button", { name: "批准转班", exact: true }).waitFor();
      await page.getByRole("button", { name: "批准转班", exact: true }).click();
      await panel.getByText("审核已通过，学生已转入新班级。", { exact: true }).waitFor();
      assert.deepEqual(transferRequests[1], { decision: "APPROVE", expected_version: 1 });
      const history = panel.getByRole("region", { name: "转班历史" });
      await history.getByText("已批准", { exact: true }).waitFor();
      await history.locator("summary").click();
      assert.match(await history.innerText(), /批准并完成转班/u);
      assert.equal(await panel.getByRole("button", { name: "批准转班" }).count(), 0);
    } else if (href === "/admin/resources") {
      assert.equal(await page.locator(".migration-notice").count(), 0);
      assert.equal(await page.locator("[data-resource-management]").count(), 1);
    } else if (href === "/admin/statistics") {
      assert.equal(await page.locator(".migration-notice").count(), 0);
      assert.equal(await page.locator(".statistics-panel").count(), 1);
    } else if (href === "/admin/learning-safety") {
      assert.equal(await page.locator(".migration-notice").count(), 0);
      const panel = page.locator("[data-learning-safety]");
      await page.locator('[data-learning-safety-state="READY"]').waitFor();
      assert.equal(await panel.locator("[data-learning-safety-metric]").count(), 20);
      assert.match(await panel.innerText(), /指标口径：V2（本机合成数据）/u);
      assert.match(await panel.innerText(), /明确记录的严重安全事件/u);
    } else if (href === "/admin/guides") {
      assert.equal(await page.locator(".migration-notice").count(), 0);
      const guides = page.locator(".guides-panel");
      assert.equal(await guides.count(), 1);
      const search = page.getByRole("searchbox", { name: "搜索指南" });
      assert.equal(await guides.locator("[data-guide-id]").count(), 2);
      await guides.locator('[data-guide-id="guide-routine"]').click();
      assert.match(await guides.locator(".guide-detail").innerText(), /值班流程/u);
      await search.fill("报到");
      assert.equal(await guides.locator("[data-guide-id]").count(), 1);
      assert.match(await guides.locator(".guide-detail").innerText(), /新成员指南/u);
      await search.fill("没有这条指南");
      await guides
        .getByRole("region", { name: "指南列表" })
        .getByText("没有匹配的指南。", { exact: true })
        .waitFor();
      assert.equal(await guides.locator("[data-guide-id]").count(), 0);
      await search.fill("");
      assert.equal(await guides.locator("[data-guide-id]").count(), 2);
      assert.match(await guides.innerText(), /仅显示当前校区的虚构内部指南/u);
      assert.match(await guides.innerText(), /不提供真实文件下载/u);
      if (process.env.ADMIN_GUIDES_EVIDENCE_DIR) {
        const evidenceDir = resolve(process.env.ADMIN_GUIDES_EVIDENCE_DIR);
        await mkdir(evidenceDir, { recursive: true });
        await page.setViewportSize({ width: 1365, height: 900 });
        await page.evaluate(() =>
          document.activeElement instanceof HTMLElement ? document.activeElement.blur() : undefined,
        );
        await page.screenshot({
          path: resolve(evidenceDir, "desktop.png"),
          fullPage: true,
        });
        await page.setViewportSize({ width: 390, height: 844 });
        const menuToggle = page.locator(".nav-toggle");
        if ((await menuToggle.getAttribute("aria-expanded")) === "true") await menuToggle.click();
        await page.waitForFunction(
          () => getComputedStyle(document.querySelector(".admin-sidebar")).visibility === "hidden",
        );
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390);
        await page.evaluate(() =>
          document.activeElement instanceof HTMLElement ? document.activeElement.blur() : undefined,
        );
        await page.screenshot({
          path: resolve(evidenceDir, "mobile.png"),
          fullPage: true,
        });
        await page.setViewportSize({ width: 1365, height: 900 });
      }
    } else if (href === "/admin/files") {
      assert.equal(await page.locator(".migration-notice").count(), 0);
      await page.locator('[data-media-assets-state="READY"]').waitFor();
      assert.equal(await page.locator("[data-media-asset-title]").count(), 2);
      assert.match(await page.locator("[data-media-assets]").innerText(), /教师介绍占位图/u);
      assert.doesNotMatch(
        await page.locator("[data-media-assets]").innerHTML(),
        /00000000-0000-4000/u,
      );
    } else if (href === "/admin/platform-operations") {
      assert.equal(await page.locator(".migration-notice").count(), 0);
      assert.equal(await page.locator("[data-platform-operations]").count(), 1);
      await page.locator('[data-platform-fee-status="READY"]').waitFor();
      assert.match(await page.locator("body").innerText(), /费用资料：9 项/u);
      assert.match(await page.locator("body").innerText(), /费用流水：4 笔/u);
    } else {
      assert.equal(await page.locator(".migration-notice").count(), 1);
    }
  }

  await page.goto(`${baseUrl}/admin/activities`, { waitUntil: "networkidle" });
  const activitiesPanel = page.locator(".activities-panel");
  assert.equal(await activitiesPanel.count(), 1);
  assert.match(await activitiesPanel.innerText(), /仅展示固定合成活动/u);
  if (process.env.ADMIN_ACTIVITIES_EVIDENCE_DIR) {
    const evidenceDir = resolve(process.env.ADMIN_ACTIVITIES_EVIDENCE_DIR);
    await mkdir(evidenceDir, { recursive: true });
    await page.screenshot({
      path: resolve(evidenceDir, "desktop.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    const mobileToggle = page.locator(".nav-toggle");
    if ((await mobileToggle.getAttribute("aria-expanded")) === "true") {
      await mobileToggle.click();
    }
    await page.waitForFunction(
      () => getComputedStyle(document.querySelector(".admin-sidebar")).visibility === "hidden",
    );
    assert.equal(await mobileToggle.getAttribute("aria-expanded"), "false");
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      true,
      "Activity page must fit a 390px mobile viewport.",
    );
    await page.screenshot({
      path: resolve(evidenceDir, "mobile-390.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 1365, height: 900 });
  }

  await page.goto(`${baseUrl}/admin/public-teachers`, {
    waitUntil: "networkidle",
  });
  const publicTeachersPanel = page.locator(".public-teachers-panel");
  await page.getByRole("heading", { name: "教师介绍管理" }).waitFor();
  assert.match(await publicTeachersPanel.innerText(), /仅展示虚构教师介绍/u);
  assert.equal(await page.getByLabel("教师姓名").inputValue(), "模拟教师甲");
  if (process.env.ADMIN_PUBLIC_TEACHERS_EVIDENCE_DIR) {
    const evidenceDir = resolve(process.env.ADMIN_PUBLIC_TEACHERS_EVIDENCE_DIR);
    await mkdir(evidenceDir, { recursive: true });
    await page.screenshot({
      path: resolve(evidenceDir, "desktop.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(
      () => getComputedStyle(document.querySelector(".admin-sidebar")).visibility === "hidden",
    );
    assert.equal(await page.locator(".nav-toggle").getAttribute("aria-expanded"), "false");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390);
    await page.screenshot({
      path: resolve(evidenceDir, "mobile.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 1365, height: 900 });
  }
  await page.getByLabel("教师简介").fill("仅用于本机验证的虚构教师介绍。");
  await publicTeachersPanel.getByRole("button", { name: "保存草稿" }).click();
  await page.getByRole("status").getByText("草稿已保存（本机演示状态）", { exact: true }).waitFor();
  await publicTeachersPanel
    .locator("[data-public-teacher-version]")
    .getByText("v2", { exact: true })
    .waitFor();
  await publicTeachersPanel.getByRole("button", { name: "发布" }).click();
  await page.getByRole("status").getByText("介绍已发布（本机演示状态）", { exact: true }).waitFor();
  await publicTeachersPanel
    .locator(".public-teacher-status")
    .getByText("已发布", { exact: true })
    .waitFor();
  await publicTeachersPanel
    .locator("[data-public-teacher-version]")
    .getByText("v3", { exact: true })
    .waitFor();
  await publicTeachersPanel.getByRole("button", { name: "下架" }).click();
  await page.getByRole("status").getByText("介绍已下架（本机演示状态）", { exact: true }).waitFor();
  await publicTeachersPanel
    .locator(".public-teacher-status")
    .getByText("已下架", { exact: true })
    .waitFor();
  await publicTeachersPanel
    .locator("[data-public-teacher-version]")
    .getByText("v4", { exact: true })
    .waitFor();
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(await page.getByLabel("教师姓名").inputValue(), "模拟教师甲");
  await page.locator(".public-teacher-status").getByText("草稿", { exact: true }).waitFor();
  await publicTeachersPanel
    .locator("[data-public-teacher-version]")
    .getByText("v1", { exact: true })
    .waitFor();

  const homeContentKey = "home-content-synthetic-east";
  const homeDraftPath = `/api/admin/institution/home/${homeContentKey}/draft`;
  const homeContentCalls = [];
  let persistedHomeContent = null;
  await page.route("**/api/admin/**", async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    if (url.pathname === "/api/admin/me" && method === "GET")
      return fulfillJson(route, {
        data: {
          display_name: "合成首页编辑员",
          memberships: [{ status: "ACTIVE", capabilities: ["content:write", "content:publish"] }],
        },
      });
    if (url.pathname !== homeDraftPath &&
      !url.pathname.startsWith(`/api/admin/institution/home/${homeContentKey}/`))
      return route.fallback();

    homeContentCalls.push({ method, path: url.pathname });
    if (url.pathname === homeDraftPath && method === "GET") {
      if (persistedHomeContent) return fulfillJson(route, { data: persistedHomeContent });
      expectedHomeDraftNotFoundResponses += 1;
      return fulfillJson(route, { error: { code: "NOT_FOUND_SCOPED" } }, 404);
    }
    if (url.pathname === homeDraftPath && (method === "POST" || method === "PUT")) {
      const body = route.request().postDataJSON();
      const expectedVersion = persistedHomeContent?.version ?? null;
      assert.equal(body.expected_version, expectedVersion);
      persistedHomeContent = {
        content_key: homeContentKey,
        title: body.payload.title,
        type: "HOME_BLOCK",
        status: "DRAFT",
        version: (expectedVersion ?? 0) + 1,
        visibility: "PUBLIC",
        body: body.payload.body,
        synthetic_data: true,
      };
      return fulfillJson(route, { data: persistedHomeContent }, method === "POST" ? 201 : 200);
    }
    if (method === "POST" && /\/(publish|unpublish)$/u.test(url.pathname)) {
      const body = route.request().postDataJSON();
      assert.ok(persistedHomeContent);
      assert.equal(body.expected_version, persistedHomeContent.version);
      persistedHomeContent = {
        ...persistedHomeContent,
        status: url.pathname.endsWith("/publish") ? "PUBLISHED" : "UNPUBLISHED",
        version: persistedHomeContent.version + 1,
      };
      return fulfillJson(route, { data: persistedHomeContent });
    }
    return fulfillJson(route, { error: { code: "NOT_FOUND" } }, 404);
  });

  await page.goto(`${baseUrl}/admin/home-content`, {
    waitUntil: "networkidle",
  });
  const homeContentPanel = page.locator(".home-content-panel");
  await page.getByRole("heading", { name: "首页内容管理" }).waitFor();
  assert.match(await homeContentPanel.innerText(), /仅使用合成示例资料/u);
  assert.match(await homeContentPanel.innerText(), /未保存/u);
  assert.equal(homeContentCalls.filter((call) => call.method !== "GET").length, 0);
  if (process.env.ADMIN_HOME_CONTENT_EVIDENCE_DIR) {
    const evidenceDir = resolve(process.env.ADMIN_HOME_CONTENT_EVIDENCE_DIR);
    await mkdir(evidenceDir, { recursive: true });
    await page.screenshot({
      path: resolve(evidenceDir, "desktop.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(
      () => getComputedStyle(document.querySelector(".admin-sidebar")).visibility === "hidden",
    );
    assert.equal(await page.locator(".nav-toggle").getAttribute("aria-expanded"), "false");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390);
    await page.screenshot({
      path: resolve(evidenceDir, "mobile.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 1365, height: 900 });
  }
  await page.getByLabel("首页标题").fill("同芯学园校区服务介绍");
  await page.getByLabel("首页摘要").fill("欢迎查看本批合成校区服务内容。");
  await page.getByLabel("首页正文").fill("这是一条虚构的首页内容，保存后才会创建。");
  await homeContentPanel.getByRole("button", { name: "保存草稿" }).click();
  await homeContentPanel.getByRole("status").getByText("草稿已保存。内容尚未公开。", { exact: true }).waitFor();
  await homeContentPanel.getByText("v1", { exact: true }).waitFor();
  assert.deepEqual(
    homeContentCalls.filter(({ method }) => method !== "GET").map(({ method }) => method),
    ["POST"],
  );
  await homeContentPanel.getByRole("button", { name: "发布" }).click();
  await homeContentPanel.getByRole("status").getByText("首页内容已发布，可由访客查看。", { exact: true }).waitFor();
  await homeContentPanel.getByText("已发布", { exact: true }).waitFor();
  await homeContentPanel.getByText("v2", { exact: true }).waitFor();
  await page.reload({ waitUntil: "networkidle" });
  await page.getByLabel("首页标题").waitFor();
  assert.equal(await page.getByLabel("首页标题").inputValue(), "同芯学园校区服务介绍");
  await page.locator(".home-content-controls").getByText("已发布", { exact: true }).waitFor();
  await page.locator(".home-content-controls").getByText("v2", { exact: true }).waitFor();
  const reloadedHomeContentPanel = page.locator(".home-content-panel");
  await reloadedHomeContentPanel.getByRole("button", { name: "下架" }).click();
  await reloadedHomeContentPanel.getByRole("status").getByText("首页内容已下架，访客页不再展示。", { exact: true }).waitFor();
  await reloadedHomeContentPanel.locator(".home-content-controls").getByText("已下架", { exact: true }).waitFor();
  await reloadedHomeContentPanel.locator(".home-content-controls").getByText("v3", { exact: true }).waitFor();
  assert.doesNotMatch(await page.locator("body").innerText(), /home-content-synthetic-east/u);

  await page.goto(`${baseUrl}/admin/audit-logs`, { waitUntil: "networkidle" });
  const auditRows = page.locator(".audit-log-row");
  await auditRows.first().waitFor();
  assert.equal(await auditRows.count(), 6);
  const firstAuditRow = auditRows.first();
  assert.match(await firstAuditRow.innerText(), /发布内容/u);
  assert.match(await firstAuditRow.innerText(), /首页内容/u);
  assert.match(await firstAuditRow.innerText(), /已完成/u);
  assert.doesNotMatch(
    await page.locator("body").innerText(),
    /CONTENT_PUBLISHED|HOME_CONTENT|00000000-0000-4000-8000-000000000003|synthetic-home-announcement|correlation-synthetic-audit-001|trace-synthetic-audit-001|synthetic-reference/u,
  );
  assert.match(await page.locator("body").innerText(), /本机合成/u);
  if (process.env.ADMIN_AUDIT_EVIDENCE_DIR) {
    const evidenceDir = resolve(process.env.ADMIN_AUDIT_EVIDENCE_DIR);
    await mkdir(evidenceDir, { recursive: true });
    await page.screenshot({
      path: resolve(evidenceDir, "desktop.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(
      () => getComputedStyle(document.querySelector(".admin-sidebar")).visibility === "hidden",
    );
    assert.equal(await page.locator(".nav-toggle").getAttribute("aria-expanded"), "false");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390);
    await page.screenshot({
      path: resolve(evidenceDir, "mobile.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 1365, height: 900 });
  }
  if (nextMode !== "start") {
    await page.goto(`${baseUrl}/admin/privacy-requests`, {
      waitUntil: "networkidle",
    });
    await page.getByRole("button", { name: "连接并刷新" }).click();
    const privacyRow = page.locator(".privacy-review-row");
    await privacyRow.waitFor();
    assert.equal(await privacyRow.count(), 1);
    await privacyRow.getByRole("button", { name: "开始处理" }).click();
    await privacyRow.getByText("处理中", { exact: true }).waitFor();
    await privacyRow.getByRole("button", { name: "完成本机处理演示" }).click();
    await privacyRow.getByText("本机处理演示完成", { exact: true }).waitFor();
    assert.equal(privacyRows.get("owner-east")?.[0]?.dataChanged, false);
    assert.doesNotMatch(await page.locator("body").innerText(), /77777777-7777-4777-8777/u);
    assert.match(await page.locator("body").innerText(), /dataChanged=false/u);
    if (process.env.ADMIN_PRIVACY_EVIDENCE_DIR) {
      const evidenceDir = resolve(process.env.ADMIN_PRIVACY_EVIDENCE_DIR);
      await mkdir(evidenceDir, { recursive: true });
      await page.screenshot({
        path: resolve(evidenceDir, "desktop.png"),
        fullPage: true,
      });
      await page.setViewportSize({ width: 390, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390);
      await page.screenshot({
        path: resolve(evidenceDir, "mobile.png"),
        fullPage: true,
      });
      await page.setViewportSize({ width: 1365, height: 900 });
    }
    await page.locator("#privacy-review-profile").selectOption("owner-west");
    await page.getByRole("button", { name: "连接并刷新" }).click();
    await page.locator(".privacy-review-empty").waitFor();
    assert.equal(await page.locator(".privacy-review-row").count(), 0);
  }

  let bindingIdentity = null;
  let parentQueueAttempts = 0;
  const bindingToken = "s".repeat(43);
  const bindingRows = [
    {
      id: "00000000-0000-4000-8000-000000000111",
      student_candidate_ref: "00000000-0000-4000-8000-000000000211",
      applicant_label: "模拟家长甲",
      student_label: "示例学生甲",
      relationship: "GUARDIAN",
      status: "PENDING",
      version: 1,
      submitted_at: "2026-10-18T08:00:00.000Z",
      reviewed_at: null,
    },
    {
      id: "00000000-0000-4000-8000-000000000112",
      student_candidate_ref: "00000000-0000-4000-8000-000000000212",
      applicant_label: "模拟家长乙",
      student_label: "示例学生乙",
      relationship: "GUARDIAN",
      status: "PENDING",
      version: 1,
      submitted_at: "2026-10-18T08:05:00.000Z",
      reviewed_at: null,
    },
  ];
  const bindingApiRequests = [];
  await page.route("**/api/admin/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace("/api/admin", "");
    if (
      url.origin !== baseUrl ||
      (!["/identity/login", "/identity/logout", "/me"].includes(path) &&
        !path.startsWith("/staff/guardian-binding/"))
    )
      return route.fallback();
    const method = request.method();
    bindingApiRequests.push({ method, path });
    if (path === "/identity/login" && method === "POST") {
      const credentials = JSON.parse(request.postData() ?? "{}");
      const accepted =
        (credentials.username === "reviewer-demo" || credentials.username === "parent-demo") &&
        credentials.password === "synthetic-only-password";
      if (!accepted)
        return route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ error: { code: "UNAUTHENTICATED", message: "登录失败。" } }),
        });
      bindingIdentity = credentials.username === "reviewer-demo" ? "reviewer" : "parent";
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: {
          "set-cookie":
            "student_care_admin_session=" +
            bindingToken +
            "; Path=/api/admin; HttpOnly; SameSite=Lax",
        },
        body: JSON.stringify({ data: { expires_at: "2099-01-01T00:00:00.000Z" } }),
      });
    }
    if (path === "/me" && method === "GET") {
      if (!bindingIdentity)
        return route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ error: { code: "UNAUTHENTICATED", message: "未登录。" } }),
        });
      const reviewer = bindingIdentity === "reviewer";
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            actor_id: reviewer ? "synthetic-reviewer" : "synthetic-parent",
            display_name: reviewer ? "模拟审核员" : "模拟家长",
            memberships: [
              {
                tenant_id: "synthetic-tenant",
                campus_ids: ["synthetic-campus"],
                status: "ACTIVE",
                capabilities: reviewer
                  ? ["identity:read", "binding:review"]
                  : ["identity:read", "binding:apply"],
              },
            ],
          },
        }),
      });
    }
    if (path === "/staff/guardian-binding/applications" && method === "GET") {
      if (bindingIdentity !== "reviewer") {
        if (bindingIdentity === "parent") parentQueueAttempts += 1;
        return route.fulfill({
          status: 403,
          contentType: "application/json",
          body: JSON.stringify({ error: { code: "FORBIDDEN_SCOPE", message: "无审核权限。" } }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: bindingRows.filter((row) => row.status === "PENDING") }),
      });
    }
    const reviewMatch = path.match(
      /^\/staff\/guardian-binding\/applications\/([0-9a-f-]{36})\/review$/iu,
    );
    if (reviewMatch && method === "POST" && bindingIdentity === "reviewer") {
      const submitted = JSON.parse(request.postData() ?? "{}");
      const row = bindingRows.find((candidate) => candidate.id === reviewMatch[1]);
      if (
        !row ||
        row.status !== "PENDING" ||
        submitted.version !== row.version ||
        !["approve", "reject"].includes(submitted.action)
      )
        return route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({
            error: { code: "VERSION_MISMATCH", message: "申请状态已变化。" },
          }),
        });
      row.status = submitted.action === "approve" ? "APPROVED" : "REJECTED";
      row.version += 1;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: row }),
      });
    }
    if (path === "/identity/logout" && method === "POST") {
      bindingIdentity = null;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: {
          "set-cookie":
            "student_care_admin_session=; Path=/api/admin; HttpOnly; SameSite=Lax; Max-Age=0",
        },
        body: JSON.stringify({ data: { logged_out: true } }),
      });
    }
    return route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "NOT_FOUND", message: "未找到。" } }),
    });
  });

  await page.goto(baseUrl + "/admin/binding-review", { waitUntil: "networkidle" });
  await page.locator("[data-binding-review-state='UNAUTHENTICATED']").waitFor();
  await page.getByRole("link", { name: "前往账号登录" }).click();
  await page.waitForURL("**/admin/login");
  await page.locator("#admin-login-username").fill("missing-demo");
  await page.locator("#admin-login-password").fill("synthetic-only-password");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await page.getByText("账号或密码不正确，请重试。", { exact: true }).waitFor();
  await page.locator("#admin-login-username").fill("reviewer-demo");
  await page.locator("#admin-login-password").fill("synthetic-only-password");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await page.waitForURL("**/admin/binding-review");
  await page.locator("[data-binding-review-state='READY']").waitFor();
  assert.equal(await page.locator(".binding-review-row").count(), 2);
  await page.getByText("模拟家长甲 · 家长关系申请", { exact: true }).waitFor();
  await page.getByText("学生：示例学生甲", { exact: true }).waitFor();
  assert.equal(await page.locator("#binding-review-profile").count(), 0);
  assert.equal(
    await page.locator("#admin-navigation a[aria-current='page']").getAttribute("href"),
    "/admin/binding-review",
  );
  assert.doesNotMatch(
    await page.locator("body").innerText(),
    /00000000-0000-4000|student_candidate_ref/u,
  );

  if (process.env.ADMIN_BINDING_EVIDENCE_DIR) {
    const evidenceDir = resolve(process.env.ADMIN_BINDING_EVIDENCE_DIR);
    await mkdir(evidenceDir, { recursive: true });
    await page.screenshot({ path: resolve(evidenceDir, "desktop.png"), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(
      () => getComputedStyle(document.querySelector(".admin-sidebar")).visibility === "hidden",
    );
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390);
    await page.screenshot({ path: resolve(evidenceDir, "mobile.png"), fullPage: true });
    await page.setViewportSize({ width: 1365, height: 900 });
  }

  const firstApplication = page.locator(".binding-review-row").nth(0);
  await page.locator("[data-binding-review-confirm]").check();
  await firstApplication.getByRole("button", { name: "确认关系" }).click();
  await page.getByText("关系申请已确认。", { exact: true }).waitFor();
  assert.equal(await page.locator(".binding-review-row").count(), 1);
  await page.locator("[data-binding-review-confirm]").check();
  await page
    .locator(".binding-review-row")
    .first()
    .getByRole("button", { name: "拒绝申请" })
    .click();
  await page.getByText("关系申请已拒绝。", { exact: true }).waitFor();
  assert.equal(await page.locator(".binding-review-row").count(), 0);
  await page.getByRole("button", { name: "退出登录" }).click();
  await page.waitForURL("**/admin/login");

  await page.locator("#admin-login-username").fill("parent-demo");
  await page.locator("#admin-login-password").fill("synthetic-only-password");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await page.waitForURL("**/admin/binding-review");
  await page.locator("[data-binding-review-state='FORBIDDEN']").waitFor();
  assert.equal(await page.locator(".binding-review-row").count(), 0);
  assert.equal(parentQueueAttempts, 0);
  assert.ok(
    bindingApiRequests.some(({ method, path }) => method === "POST" && path === "/identity/login"),
  );
  assert.ok(localApiCalls.length > 0);
  assert.equal(
    localApiCalls.every(({ path }) => path.startsWith("/local/")),
    true,
  );
  assert.equal(
    localApiCalls.filter(
      ({ method, path }) =>
        !["GET", "POST"].includes(method) &&
        !(
          method === "PATCH" &&
          (/^\/local\/memberships\/[0-9a-f-]{36}$/iu.test(path) ||
            /^\/local\/staff-credentials\/[0-9a-f-]{36}$/iu.test(path))
        ),
    ).length,
    0,
  );
  assert.deepEqual(
    localApiCalls.filter(({ path }) => path.startsWith("/local/monthly-feedback")),
    [],
    "The invited monthly page must not call the old local monthly endpoints.",
  );
  const credentialCalls = localApiCalls.filter(({ path }) =>
    path.startsWith("/local/staff-credentials"),
  );
  assert.equal(
    credentialCalls.every(
      ({ method, path }) =>
        (method === "GET" && path === "/local/staff-credentials") ||
        (method === "POST" && path === "/local/staff-credentials") ||
        (method === "PATCH" && /^\/local\/staff-credentials\/[0-9a-f-]{36}$/iu.test(path)),
    ),
    true,
  );
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 1365);

  const desktop = await page.evaluate(() => {
    const sidebar = document.querySelector(".admin-sidebar").getBoundingClientRect();
    const content = document.querySelector("main").getBoundingClientRect();
    return {
      sidebarLeft: sidebar.left,
      sidebarWidth: sidebar.width,
      contentLeft: content.left,
      pageWidth: document.documentElement.scrollWidth,
    };
  });
  assert.equal(desktop.sidebarLeft, 0);
  assert.ok(desktop.contentLeft >= desktop.sidebarWidth, JSON.stringify(desktop));
  assert.equal(desktop.pageWidth, 1365, JSON.stringify(desktop));

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}/admin/institution`, { waitUntil: "networkidle" });
  if (process.env.ADMIN_INSTITUTION_OVERVIEW_EVIDENCE_DIR) {
    const evidenceDir = resolve(process.env.ADMIN_INSTITUTION_OVERVIEW_EVIDENCE_DIR);
    await mkdir(evidenceDir, { recursive: true });
    await page.screenshot({
      path: resolve(evidenceDir, "mobile-390.png"),
      fullPage: true,
    });
  }
  const toggle = page.locator(".nav-toggle");
  assert.equal(await toggle.isVisible(), true);
  assert.equal(await page.locator("#admin-navigation").isVisible(), false);
  await toggle.focus();
  await page.keyboard.press("Enter");
  assert.equal(await toggle.getAttribute("aria-expanded"), "true");
  await page.waitForFunction(
    () => document.querySelector(".admin-sidebar").getBoundingClientRect().x === 0,
  );
  const drawer = await page.locator(".admin-sidebar").boundingBox();
  assert.equal(drawer?.x, 0);
  assert.ok((drawer?.width ?? 391) <= 300);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390);
  await page.keyboard.press("Escape");
  assert.equal(await toggle.getAttribute("aria-expanded"), "false");
  assert.equal(await toggle.evaluate((button) => document.activeElement === button), true);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390);

  await page.setViewportSize({ width: 320, height: 568 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 320);
  await toggle.focus();
  await page.keyboard.press("Space");
  assert.equal(await toggle.getAttribute("aria-expanded"), "true");
  await page.waitForFunction(
    () => Math.abs(document.querySelector(".admin-sidebar").getBoundingClientRect().x) < 0.5,
  );
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 320);
  await page.keyboard.press("Escape");
  assert.equal(await toggle.getAttribute("aria-expanded"), "false");
  assert.equal(await toggle.evaluate((button) => document.activeElement === button), true);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 320);
  await page.waitForFunction(
    () => document.querySelector(".admin-sidebar").getBoundingClientRect().right <= 0,
  );
  if (process.env.ADMIN_INSTITUTION_OVERVIEW_EVIDENCE_DIR) {
    const evidenceDir = resolve(process.env.ADMIN_INSTITUTION_OVERVIEW_EVIDENCE_DIR);
    await page.screenshot({
      path: resolve(evidenceDir, "mobile-320.png"),
      fullPage: true,
    });
  }

  if (process.env.ADMIN_NEXT_EVIDENCE_DIR) {
    const evidenceDir = resolve(process.env.ADMIN_NEXT_EVIDENCE_DIR);
    await mkdir(evidenceDir, { recursive: true });
    await page.setViewportSize({ width: 1365, height: 900 });
    await page.goto(`${baseUrl}/admin/institution`, {
      waitUntil: "networkidle",
    });
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      window.scrollTo(0, 0);
    });
    await page.waitForFunction(() => window.scrollY === 0);
    await page.screenshot({
      path: resolve(evidenceDir, "desktop.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${baseUrl}/admin/institution`, {
      waitUntil: "networkidle",
    });
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      window.scrollTo(0, 0);
    });
    await page.waitForFunction(() => window.scrollY === 0);
    const mobileTopGeometry = await page.evaluate(() => {
      const menu = document.querySelector(".nav-toggle");
      const bar = document.querySelector(".mobile-navigation-bar");
      const heading = document.querySelector("#main-content h1");
      const skipLink = document.querySelector(".skip-link");
      if (!menu || !bar || !heading || !skipLink) throw new Error("移动端导航检查所需元素缺失。");
      const menuRect = menu.getBoundingClientRect();
      const barRect = bar.getBoundingClientRect();
      const headingRect = heading.getBoundingClientRect();
      const skipRect = skipLink.getBoundingClientRect();
      const barStyle = getComputedStyle(bar);
      return {
        viewportWidth: window.innerWidth,
        pageWidth: document.documentElement.scrollWidth,
        scrollY: window.scrollY,
        menu: { top: menuRect.top, bottom: menuRect.bottom, left: menuRect.left },
        bar: {
          top: barRect.top,
          bottom: barRect.bottom,
          left: barRect.left,
          right: barRect.right,
          backgroundColor: barStyle.backgroundColor,
          zIndex: barStyle.zIndex,
        },
        heading: { top: headingRect.top, bottom: headingRect.bottom },
        skipLink: { top: skipRect.top, bottom: skipRect.bottom },
      };
    });
    assert.equal(mobileTopGeometry.viewportWidth, 390, JSON.stringify(mobileTopGeometry));
    assert.equal(mobileTopGeometry.pageWidth, 390, JSON.stringify(mobileTopGeometry));
    assert.equal(mobileTopGeometry.scrollY, 0, JSON.stringify(mobileTopGeometry));
    assert.ok(Math.abs(mobileTopGeometry.menu.top - 12) < 0.5, JSON.stringify(mobileTopGeometry));
    assert.ok(
      mobileTopGeometry.menu.bottom < mobileTopGeometry.heading.top,
      JSON.stringify(mobileTopGeometry),
    );
    assert.equal(mobileTopGeometry.bar.top, 0, JSON.stringify(mobileTopGeometry));
    assert.equal(mobileTopGeometry.bar.bottom, 54, JSON.stringify(mobileTopGeometry));
    assert.equal(mobileTopGeometry.bar.left, 0, JSON.stringify(mobileTopGeometry));
    assert.equal(mobileTopGeometry.bar.right, 390, JSON.stringify(mobileTopGeometry));
    assert.equal(mobileTopGeometry.bar.backgroundColor, "rgb(244, 247, 237)");
    assert.equal(mobileTopGeometry.bar.zIndex, "40");
    assert.ok(mobileTopGeometry.skipLink.bottom <= 0, JSON.stringify(mobileTopGeometry));
    await page.screenshot({
      path: resolve(evidenceDir, "mobile.png"),
    });
    await page.evaluate(() => window.scrollTo(0, 64));
    await page.waitForFunction(() => window.scrollY >= 64);
    const mobileScrolledGeometry = await page.evaluate(() => {
      const menu = document.querySelector(".nav-toggle");
      const bar = document.querySelector(".mobile-navigation-bar");
      const heading = document.querySelector(
        "#main-content [data-learning-institution-setting] h2",
      );
      if (!menu || !bar || !heading) throw new Error("移动端菜单栏、按钮或卡片标题缺失。");
      const rect = menu.getBoundingClientRect();
      const barRect = bar.getBoundingClientRect();
      const headingRect = heading.getBoundingClientRect();
      return {
        viewportWidth: window.innerWidth,
        pageWidth: document.documentElement.scrollWidth,
        scrollY: window.scrollY,
        menuTop: rect.top,
        menuBottom: rect.bottom,
        contentHeadingTop: headingRect.top,
        barTop: barRect.top,
        barBottom: barRect.bottom,
        barLeft: barRect.left,
        barRight: barRect.right,
        barBackground: getComputedStyle(bar).backgroundColor,
      };
    });
    assert.equal(mobileScrolledGeometry.viewportWidth, 390, JSON.stringify(mobileScrolledGeometry));
    assert.equal(mobileScrolledGeometry.pageWidth, 390, JSON.stringify(mobileScrolledGeometry));
    assert.ok(mobileScrolledGeometry.scrollY >= 64, JSON.stringify(mobileScrolledGeometry));
    assert.ok(
      Math.abs(mobileScrolledGeometry.menuTop - 12) < 0.5,
      JSON.stringify(mobileScrolledGeometry),
    );
    assert.equal(mobileScrolledGeometry.barTop, 0, JSON.stringify(mobileScrolledGeometry));
    assert.equal(mobileScrolledGeometry.barBottom, 54, JSON.stringify(mobileScrolledGeometry));
    assert.equal(mobileScrolledGeometry.barLeft, 0, JSON.stringify(mobileScrolledGeometry));
    assert.equal(mobileScrolledGeometry.barRight, 390, JSON.stringify(mobileScrolledGeometry));
    assert.equal(mobileScrolledGeometry.barBackground, "rgb(244, 247, 237)");
    assert.ok(
      mobileScrolledGeometry.barBottom < mobileScrolledGeometry.contentHeadingTop,
      JSON.stringify(mobileScrolledGeometry),
    );
    await page.screenshot({ path: resolve(evidenceDir, "mobile-scrolled.png") });
    await page.screenshot({
      path: resolve(evidenceDir, "mobile-full-page-diagnostic.png"),
      fullPage: true,
    });
    console.info(
      `[mobile-nav-viewport] top=${JSON.stringify(mobileTopGeometry)} scrolled=${JSON.stringify(mobileScrolledGeometry)}`,
    );
  }

  if (process.env.ADMIN_MONTHLY_FEEDBACK_EVIDENCE_DIR) {
    const evidenceDir = resolve(process.env.ADMIN_MONTHLY_FEEDBACK_EVIDENCE_DIR);
    await page.route("**/api/admin/**", monthlyApiFixture);
    await page.context().clearCookies({ name: "student_care_admin_session" });
    try {
      monthlyFeedbackRows.forEach((row) => {
        row.status = "SUBMITTED";
        row.version += 1;
        row.actions = ["confirm", "return"];
      });
      await page.goto(`${baseUrl}/admin/login?next=%2Fadmin%2Fmonthly-feedback-review`, {
        waitUntil: "networkidle",
      });
      await page.locator("#admin-login-username").fill("monthly-reviewer-demo");
      await page.locator("#admin-login-password").fill("synthetic-only-password");
      await page.getByRole("button", { name: "登录", exact: true }).click();
      await page.waitForURL("**/admin/monthly-feedback-review");
      for (const [width, height, filename] of [
        [390, 844, "mobile-390.png"],
        [320, 700, "mobile-320.png"],
      ]) {
        await page.setViewportSize({ width, height });
        await page.locator("[data-monthly-feedback-state='READY']").waitFor();
        assert.equal(await page.locator("[data-monthly-feedback-row]").count(), 2);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width);
        await page.screenshot({
          path: resolve(evidenceDir, filename),
          fullPage: true,
        });
      }
    } finally {
      monthlySignedIn = false;
      await page.unroute("**/api/admin/**", monthlyApiFixture);
      await page.context().clearCookies({ name: "student_care_admin_session" });
      await page.setViewportSize({ width: 1365, height: 900 });
    }
  }

  assert.deepEqual(monthlyLegacyRequests, []);
  await Promise.all(adminMeHeaderReads);
  const cancelledNavigationRequests = failedRequests.filter(({ url, error }) => {
    const requestUrl = new URL(url);
    return (
      error === "net::ERR_ABORTED" &&
      requestUrl.origin === baseUrl &&
      requestUrl.searchParams.has("_rsc")
    );
  });
  const expectedLocalConnectionCancellations = failedRequests.filter(({ url, error }) => {
    const requestUrl = new URL(url);
    return (
      error === "net::ERR_ABORTED" &&
      requestUrl.origin === localApiOrigin &&
      requestUrl.pathname === "/local/sessions"
    );
  });
  const expectedAdminMeNavigationCancellations = failedRequests.filter((request) => {
    const requestUrl = new URL(request.url);
    const failurePage = new URL(request.pageUrl);
    const requestStart = request.requestStart;
    if (
      request.error !== "net::ERR_ABORTED" ||
      request.isNavigationRequest ||
      request.resourceType !== "fetch" ||
      requestUrl.origin !== baseUrl ||
      requestUrl.pathname !== "/api/admin/me" ||
      !requestStart ||
      requestStart.method !== "GET" ||
      requestStart.hasSessionCookie !== false ||
      failurePage.origin !== baseUrl ||
      !expectedRoutes.some(([href]) => href === failurePage.pathname)
    )
      return false;

    const navigatedBeforeFailure = mainFrameNavigations.some((navigation) => {
      const destination = new URL(navigation.url);
      return (
        navigation.sequence > requestStart.sequence &&
        navigation.sequence < request.failureSequence &&
        destination.origin === failurePage.origin &&
        destination.pathname === failurePage.pathname
      );
    });
    if (!navigatedBeforeFailure) return false;

    const sourcePage = new URL(requestStart.pageUrl);
    if (
      sourcePage.origin !== baseUrl ||
      requestStart.frameUrl !== requestStart.pageUrl ||
      ![
        "/admin/leave-review",
        "/admin/health-incident-review",
        "/admin/staff-tasks",
        "/admin/staff-daily-review",
        "/admin/monthly-feedback-review",
      ].includes(sourcePage.pathname)
    )
      return false;

    const response = adminMeResponseEvents.find(
      (event) => event.requestStart?.sequence === requestStart.sequence,
    );
    const finished = adminMeFinishedEvents.some(
      (event) => event.requestStart?.sequence === requestStart.sequence,
    );
    return (
      response?.status === 401 &&
      response.sequence > requestStart.sequence &&
      response.sequence < request.failureSequence &&
      !finished
    );
  });
  const unexpectedFailedRequests = failedRequests.filter(
    (request) =>
      !cancelledNavigationRequests.includes(request) &&
      !expectedLocalConnectionCancellations.includes(request) &&
      !expectedAdminMeNavigationCancellations.includes(request),
  );

  const adminMeFailedRequests = failedRequests
    .filter(({ url }) => new URL(url).pathname === "/api/admin/me")
    .map(({ url, error, requestStart, failureSequence, failedAt, pageUrl }) => ({
      url: new URL(url).origin + new URL(url).pathname,
      error,
      requestStart,
      failureSequence,
      failedAt,
      pageUrl,
    }));
  if (process.env.ADMIN_ME_REQUEST_CONTEXT_FILE) {
    await writeFile(
      resolve(process.env.ADMIN_ME_REQUEST_CONTEXT_FILE),
      JSON.stringify(
        {
          requests: adminMeFailedRequests.map(({ requestStart, ...failure }) => ({
            ...failure,
            requestStart,
          })),
          responses: adminMeResponseEvents,
          finished: adminMeFinishedEvents,
        },
        null,
        2,
      ) + "\n",
      "utf8",
    );
  }

  const expectedAuthenticationErrors = browserErrors.filter((message) =>
    message.includes("401 (Unauthorized)"),
  );
  const expectedHomeDraftNotFoundConsoleErrors = browserErrors.filter((message) =>
    message.includes("404 (Not Found)"),
  );
  const homeDraftNotFoundPath = `/api/admin/institution/home/${homeContentKey}/draft`;
  const actualHomeDraftNotFoundResponses = notFoundResponses.filter(
    ({ method, path }) => method === "GET" && path === homeDraftNotFoundPath,
  );
  assert.equal(actualHomeDraftNotFoundResponses.length, expectedHomeDraftNotFoundResponses);
  assert.deepEqual(notFoundResponses, actualHomeDraftNotFoundResponses);
  assert.equal(
    expectedHomeDraftNotFoundConsoleErrors.length,
    expectedHomeDraftNotFoundResponses,
    "Only the explicitly missing synthetic home draft may produce a 404 console entry.",
  );
  const unexpectedBrowserErrors = browserErrors.filter(
    (message) =>
      !message.includes("401 (Unauthorized)") && !message.includes("404 (Not Found)"),
  );
  assert.deepEqual(unexpectedBrowserErrors, []);
  assert.equal(expectedAuthenticationErrors.length, expectedAdminUnauthorizedResponses);
  if (unexpectedFailedRequests.length > 0) {
    console.error(
      `[failed-request-lifecycle] ${JSON.stringify({ unexpectedFailedRequests, mainFrameNavigations, adminMeResponseEvents, adminMeFinishedEvents, expectedAdminMeNavigationCancellations })}`,
    );
  }
  assert.deepEqual(unexpectedFailedRequests, []);
  assert.deepEqual(externalRequests, []);
  const cancelledAdminSources = expectedAdminMeNavigationCancellations.map(
    (request) => new URL(request.requestStart.pageUrl).pathname,
  );
  // App Router development Strict Mode can replay each effect once; keep a strict two-request cap per source.
  const cancellationsBySource = new Map();
  for (const source of cancelledAdminSources) {
    cancellationsBySource.set(source, (cancellationsBySource.get(source) ?? 0) + 1);
  }
  assert.equal(
    [...cancellationsBySource.values()].every((count) => count <= 2),
    true,
    `每个匿名页面最多允许两次开发模式重复请求取消：${JSON.stringify(expectedAdminMeNavigationCancellations)}`,
  );
  assert.ok(
    cancelledAdminSources.filter((path) =>
      ["/admin/leave-review", "/admin/health-incident-review"].includes(path),
    ).length <= 4,
    `管理端审核页切换取消次数超出已观察上限：${JSON.stringify(expectedAdminMeNavigationCancellations)}`,
  );
  assert.ok(
    cancelledAdminSources.filter((path) =>
      ["/admin/staff-tasks", "/admin/staff-daily-review"].includes(path),
    ).length <= 4,
    `员工页匿名响应取消次数超出已观察上限：${JSON.stringify(expectedAdminMeNavigationCancellations)}`,
  );
  assert.ok(
    cancelledAdminSources.filter((path) => path === "/admin/monthly-feedback-review").length <= 2,
    `月度页匿名响应取消次数超出上限：${JSON.stringify(expectedAdminMeNavigationCancellations)}`,
  );
  assert.ok(
    expectedLocalConnectionCancellations.length <= 2,
    `本机初始化会话取消次数超出新增平台页后的上限：${JSON.stringify(expectedLocalConnectionCancellations)}`,
  );
  console.info(
    `已逐项复核 ${expectedRoutes.length} 个管理端导航目标与页面标题；Next 导航中止 ${cancelledNavigationRequests.length} 条，审核页当前用户请求中止 ${expectedAdminMeNavigationCancellations.length} 条，本机初始化会话取消 ${expectedLocalConnectionCancellations.length} 条（均已单独识别）。`,
  );
});
