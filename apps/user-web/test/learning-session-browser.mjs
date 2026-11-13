/* global document, fetch, process, window */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { setTimeout, clearTimeout } from "node:timers";
import { fileURLToPath, pathToFileURL, URL } from "node:url";
import { chromium } from "playwright";

const projectRoot = fileURLToPath(new URL("../../../", import.meta.url));
const apiServerModule = process.env.TASK20_G44A_API_SERVER_MODULE
  ? resolve(process.env.TASK20_G44A_API_SERVER_MODULE)
  : resolve(projectRoot, "apps/api/dist/src/local-synthetic/server.js");
const { buildLocalSyntheticServer } = await import(pathToFileURL(apiServerModule).href);
const service = await buildLocalSyntheticServer({ mode: "local-synthetic" });
const serviceUrl = new URL(await service.start(0));
const preview = spawn(
  process.execPath,
  [resolve(projectRoot, "apps/user-web/preview.mjs"), "--local-service-port", serviceUrl.port],
  { cwd: projectRoot, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
);
let browser;
try {
  const baseUrl = await new Promise((resolvePromise, reject) => {
    let output = "";
    const timeout = setTimeout(() => reject(new Error("网页预览启动超时。")), 10000);
    preview.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    preview.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`网页预览提前退出：${code}`));
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
  const create = async (profile) =>
    (await api("", "POST", "/local/sessions", { profile }, 201)).handle;
  const parentHandle = await create("parent-alpha");
  const studentOptions = await api(parentHandle, "GET", "/local/student-options");
  const application = await api(
    parentHandle,
    "POST",
    "/local/binding-applications",
    { student: studentOptions[0].alias, relationship: "GUARDIAN" },
    201,
  );
  const ownerHandle = await create("owner-east");
  await api(ownerHandle, "PATCH", "/local/learning-institution-setting", {
    enabled: true,
    expectedVersion: 0,
  });
  await api(ownerHandle, "POST", `/local/binding-applications/${application.id}/review`, {
    version: application.version,
    action: "approve",
  });
  await api(
    parentHandle,
    "POST",
    "/local/consents",
    {
      bindingId: application.id,
      purposeKey: "LEARNING_SUPPORT",
      noticeVersion: "LEARNING_SUPPORT_NOTICE_V1",
      confirmed: true,
    },
    201,
  );

  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.setDefaultTimeout(8000);
  const pageErrors = [];
  const failedResponses = [];
  const externalRequests = [];
  const localRequests = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`);
  });
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin === baseUrl && url.pathname.startsWith("/local/"))
      localRequests.push(url.pathname);
  });
  await page.route("**/*", async (route) => {
    if (new URL(route.request().url()).origin !== baseUrl) {
      externalRequests.push(route.request().url());
      await route.abort();
    } else await route.continue();
  });

  await page.goto(`${baseUrl}/web/parent/learning?profile=parent-alpha`);
  try {
    await page.locator("[data-learning-open-form]").waitFor();
  } catch (error) {
    throw new Error(
      `家长学习表单未显示：${(await page.locator("body").innerText()).slice(0, 1200)}；页面地址：${page.url()}；失败请求：${JSON.stringify(failedResponses)}；页面错误：${JSON.stringify(pageErrors)}`,
      { cause: error },
    );
  }
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    true,
    "家长学习页不应出现横向滚动",
  );
  await page.waitForFunction(() => {
    const select = document.querySelector("#learning-student");
    return Boolean(select && select.options[0] && select.options[0].value);
  });
  assert.match(await page.locator("main").innerText(), /示例学生甲/u);
  const parentKnowledge = page.locator("[data-learning-knowledge]");
  await parentKnowledge.getByText("两位数加法分步学习卡", { exact: true }).waitFor();
  assert.match(
    await parentKnowledge.innerText(),
    /校内教研组（合成示例） · 版本 1 · 有效期至 2027-03-31/u,
  );
  const parentControlForm = page.locator("[data-learning-control-form]");
  await parentControlForm.locator('[name="maxDurationMinutes"]').selectOption("10");
  await parentControlForm.locator('[name="maxHintLevel"]').selectOption("2");
  await parentControlForm.locator('button[type="submit"]').click();
  await page.getByText("学习设置已保存。", { exact: true }).waitFor();
  await page.locator("[data-learning-contact]").click();
  await page
    .getByText("联系意向已在本机记录；尚未发送消息，请通过常用渠道联系教师。", {
      exact: true,
    })
    .waitFor();
  await page.getByRole("button", { name: "已记录联系意向" }).waitFor();
  await page.locator('[name="consent"]').check();
  await page.locator('[data-learning-open-form] button[type="submit"]').click();
  try {
    await page.locator("[data-learning-session]").waitFor();
  } catch (error) {
    throw new Error(
      `家长学习会话未显示：${(await page.locator("body").innerText()).slice(0, 1200)}；失败请求：${JSON.stringify(failedResponses)}；本机请求：${JSON.stringify(localRequests)}；页面错误：${JSON.stringify(pageErrors)}`,
      { cause: error },
    );
  }
  assert.match(await page.locator("[data-learning-session]").innerText(), /238 \+ 165/u);
  await page.locator('[data-learning-answer="main"][data-learning-choice="C"]').click();
  await page.locator('[data-learning-hint="0"]').waitFor();
  await page.locator('[data-learning-hint="0"]').click();
  await page.getByText(/第 0 层提示/u).waitFor();
  assert.equal(await page.locator('[data-learning-hint="1"]').count(), 0);
  await page.locator('[data-learning-answer="main"][data-learning-choice="C"]').click();
  await page.locator('[data-learning-hint="1"]').waitFor();
  await page.locator('[data-learning-hint="1"]').click();
  await page.getByText(/第 1 层提示/u).waitFor();
  await page.locator('[data-learning-answer="main"][data-learning-choice="B"]').click();
  await page.locator(".learning-practice").waitFor();
  await page.locator('[data-learning-answer="practice-1"][data-learning-choice="A"]').click();
  await page.locator('[data-learning-answer="practice-2"][data-learning-choice="B"]').click();
  await page.getByText("练习已完成").waitFor();
  await page.reload();
  const completedSummary = page.locator("[data-parent-learning-summary]");
  await completedSummary.getByText(/共练习 1 次 · 已完成 1 次/u).waitFor();
  await completedSummary.getByText(/知识点：两位数加法与进位 · 1\/1 次完成/u).waitFor();

  const handoffStartResponse = page.waitForResponse(
    (response) =>
      response.url() === new URL("/local/learning-sessions", baseUrl).href &&
      response.request().method() === "POST",
  );
  await page.locator('[name="consent"]').check();
  await page.locator('[data-learning-open-form] button[type="submit"]').click();
  const startResponse = await handoffStartResponse;
  const handoffSession = await startResponse.json();
  const parentHandoffSessionId = handoffSession.id;
  assert.match(parentHandoffSessionId, /^[0-9a-f-]{36}$/u);
  await page.locator("[data-learning-session]").waitFor();

  const teacherPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const teacherErrors = [];
  const teacherFailures = [];
  const teacherExternal = [];
  const teacherLocalRequests = [];
  teacherPage.on("pageerror", (error) => teacherErrors.push(error.message));
  teacherPage.on("response", (response) => {
    if (response.status() >= 400) teacherFailures.push(`${response.status()} ${response.url()}`);
  });
  teacherPage.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin === baseUrl && url.pathname.startsWith("/local/"))
      teacherLocalRequests.push(url.pathname);
  });
  await teacherPage.route("**/*", async (route) => {
    const origin = new URL(route.request().url()).origin;
    if (origin === "http://127.0.0.1:4317") {
      // The existing workbench task panel targets this default port; keep this
      // focused test isolated from the user's running local demo service.
      await route.abort();
    } else if (origin !== baseUrl) {
      teacherExternal.push(route.request().url());
      await route.abort();
    } else await route.continue();
  });
  await teacherPage.goto(`${baseUrl}/staff/workbench?mode=shared&profile=teacher-east`);
  await teacherPage.locator('a[href="/staff/learning?profile=teacher-east"]').waitFor();
  await teacherPage.locator('a[href="/staff/learning?profile=teacher-east"]').click();
  await teacherPage.locator("[data-learning-summary]").waitFor();
  assert.equal(
    await teacherPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    true,
    "教师学习页不应出现横向滚动",
  );
  assert.match(await teacherPage.locator("main").innerText(), /本班学习摘要/u);
  assert.match(await teacherPage.locator("main").innerText(), /负责班级学生/u);
  const teacherKnowledge = teacherPage.locator("[data-learning-knowledge]");
  await teacherKnowledge.getByText("两位数加法分步学习卡", { exact: true }).waitFor();
  assert.ok(teacherLocalRequests.includes("/local/learning-knowledge"));
  const matchingHandoff = teacherPage.locator(
    `[data-learning-handoff="${parentHandoffSessionId}"]`,
  );
  await matchingHandoff.waitFor();
  assert.equal(await matchingHandoff.getAttribute("data-learning-handoff"), parentHandoffSessionId);
  await matchingHandoff.click();
  await teacherPage.locator("[data-learning-summary]").getByText("教师已接手").waitFor();
  await page.reload();
  const parentSummary = page.locator("[data-parent-learning-summary]");
  await parentSummary.getByText(/共练习 2 次 · 已完成 1 次/u).waitFor();
  await parentSummary.getByText(/知识点：两位数加法与进位 · 1\/2 次完成/u).waitFor();
  await parentSummary.getByText("教师已接手 1 条练习记录", { exact: true }).waitFor();
  const parentSummaryText = await parentSummary.innerText();
  assert.match(parentSummaryText, /示例学生甲/u);
  assert.doesNotMatch(parentSummaryText, /示例学生乙/u);
  assert.equal(await page.locator("[data-learning-delete]").count(), 2);
  for (let index = 0; index < 2; index += 1) {
    await page.locator("[data-learning-delete]").first().click();
    await page.getByText("本机学习记录已删除。", { exact: true }).waitFor();
  }
  assert.ok(
    localRequests.some((path) => /\/local\/learning-sessions\/[0-9a-f-]+\/delete/u.test(path)),
  );
  await page.reload();
  const clearedSummary = page.locator("[data-parent-learning-summary]");
  await clearedSummary.getByText(/共练习 0 次 · 已完成 0 次/u).waitFor();
  assert.equal(await clearedSummary.getByText(/知识点：/u).count(), 0);
  assert.equal(await page.locator("[data-learning-delete]").count(), 0);
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(failedResponses, []);
  assert.deepEqual(externalRequests, []);
  assert.ok(localRequests.includes("/local/learning-sessions"));
  assert.ok(localRequests.includes("/local/learning-knowledge"));
  assert.ok(localRequests.includes("/local/learning-parent-controls"));
  assert.ok(
    localRequests.some((path) => /^\/local\/learning-parent-controls\/[0-9a-f-]+$/u.test(path)),
  );
  assert.ok(
    localRequests.some((path) => /^\/local\/learning-parent-contact\/[0-9a-f-]+$/u.test(path)),
  );
  assert.ok(
    localRequests.some((path) => /\/local\/learning-sessions\/[0-9a-f-]+\/answer/u.test(path)),
  );
  assert.ok(
    localRequests.some((path) => /\/local\/learning-sessions\/[0-9a-f-]+\/hint/u.test(path)),
  );
  assert.ok(
    localRequests.some((path) => /\/local\/learning-sessions\/[0-9a-f-]+\/delete/u.test(path)),
  );
  assert.ok(
    localRequests.every(
      (path) =>
        [
          "/local/sessions",
          "/local/session",
          "/local/binding-applications",
          "/local/learning-sessions",
          "/local/learning-knowledge",
          "/local/learning-parent-controls",
        ].includes(path) ||
        /^\/local\/learning-parent-controls\/[0-9a-f-]+$/u.test(path) ||
        /^\/local\/learning-parent-contact\/[0-9a-f-]+$/u.test(path) ||
        /^\/local\/learning-sessions\/[0-9a-f-]+\/(answer|hint|close|delete)$/u.test(path),
    ),
  );
  assert.deepEqual(teacherErrors, []);
  assert.deepEqual(teacherFailures, []);
  assert.deepEqual(teacherExternal, []);
  assert.ok(teacherLocalRequests.includes("/local/student-options"));
  assert.ok(teacherLocalRequests.includes("/local/learning-teacher-summary"));
  assert.ok(teacherLocalRequests.includes("/local/learning-parent-contact-intents"));
  assert.ok(teacherLocalRequests.includes("/local/learning-sessions"));
  assert.ok(
    teacherLocalRequests.some((path) =>
      /\/local\/learning-sessions\/[0-9a-f-]+\/close/u.test(path),
    ),
  );
  await teacherPage.close();
} finally {
  await browser?.close();
  preview.kill();
  await service.close();
}
