/* global process, document */
import assert from "node:assert/strict";
import { URL } from "node:url";
import { chromium } from "playwright";

const apiBase = new URL(process.env.TASK20_API_URL ?? "http://127.0.0.1:4317");
const userBase = new URL(process.env.TASK20_USER_WEB_URL ?? "");
const adminBase = new URL(process.env.TASK20_ADMIN_WEB_URL ?? "");
const loopback = (url) =>
  url.protocol === "http:" &&
  ["127.0.0.1", "localhost"].includes(url.hostname) &&
  Boolean(url.port);
assert.ok(loopback(apiBase) && loopback(userBase) && loopback(adminBase), "仅允许本机服务地址");

async function api(handle, method, path, body) {
  const response = await globalThis.fetch(new URL(path, apiBase), {
    method,
    headers: {
      ...(handle ? { Authorization: `Bearer ${handle}` } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok)
    throw new Error(`${method} ${path}: ${response.status} ${await response.text()}`);
  return response.json();
}

const session = async (profile) => (await api("", "POST", "/local/sessions", { profile })).handle;
const parentHandle = await session("parent-alpha");
const ownerHandle = await session("owner-east");
const teacherHandle = await session("teacher-east");
const application = await api(parentHandle, "POST", "/local/binding-applications", {
  student: "student-alpha",
  relationship: "GUARDIAN",
});
await api(ownerHandle, "POST", `/local/binding-applications/${application.id}/review`, {
  version: application.version,
  action: "approve",
});

const publishCare = async (date) => {
  let record = await api(teacherHandle, "POST", "/local/care-records", {
    student: "student-alpha",
    date,
    values: {
      arrival: "ARRIVED_AS_PLANNED",
      homework: "COMPLETED",
      meal: "FINISHED",
      rest: "RESTED",
      activity: "PARTICIPATED",
      wellbeing: "ROUTINE",
    },
  });
  for (const [actor, action, extra] of [
    [teacherHandle, "submit", {}],
    [ownerHandle, "review", { action: "confirm" }],
    [ownerHandle, "publish", {}],
  ]) {
    record = await api(actor, "POST", `/local/care-records/${record.id}/${action}`, {
      version: record.version,
      ...extra,
    });
  }
};
await publishCare("2026-10-13");

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const teacher = await context.newPage();
  const reviewer = await context.newPage();
  const parent = await context.newPage();
  const pages = [teacher, reviewer, parent];
  const errors = { page: [], console: [], network: [], external: [] };
  const allowedOrigins = new Set([apiBase.origin, userBase.origin, adminBase.origin]);
  for (const page of pages) {
    page.setDefaultTimeout(10000);
    page.on("pageerror", (error) => errors.page.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") {
        const location = message.location();
        errors.console.push(`${message.text()} (${location.url}:${location.lineNumber})`);
      }
    });
    page.on("requestfailed", (request) => errors.network.push(request.url()));
    page.on("response", (response) => {
      if (response.status() >= 400) errors.network.push(`${response.status()} ${response.url()}`);
    });
    await page.route("**/*", async (route) => {
      const origin = new URL(route.request().url()).origin;
      if (!allowedOrigins.has(origin)) {
        errors.external.push(route.request().url());
        await route.abort();
      } else await route.continue();
    });
  }

  const userPanel = (page) => page.locator("[data-monthly-feedback-panel]");
  const userReady = async (page, expected = "已刷新") => {
    try {
      await page.waitForFunction(
        ({ expected }) => {
          const panel = document.querySelector("[data-monthly-feedback-panel]");
          const refresh = panel?.querySelector("[data-monthly-feedback-refresh]");
          return Boolean(
            panel && refresh && !refresh.disabled && panel.textContent?.includes(expected),
          );
        },
        { expected },
      );
    } catch (error) {
      const body = await page
        .locator("body")
        .innerText()
        .catch(() => "");
      throw new Error(
        `员工/家长月度反馈未就绪：${page.url()}；期望=${expected}；` +
          `页面错误=${JSON.stringify(errors.page)}；控制台=${JSON.stringify(errors.console)}；` +
          `网络=${JSON.stringify(errors.network)}；页面内容=${body.slice(-1800)}`,
        { cause: error },
      );
    }
  };
  const reviewerReady = async (expected) => {
    await reviewer.locator("[data-monthly-feedback-review]").waitFor();
    await reviewer.waitForFunction(
      ({ expected }) =>
        document.querySelector("#monthly-feedback-feedback")?.textContent?.includes(expected) ??
        false,
      { expected },
    );
  };
  const refreshReviewer = async () => {
    await reviewer.locator("[data-monthly-feedback-refresh]").click();
    await reviewerReady("已刷新本机共享月度反馈队列");
  };
  const openUser = async (page, base, path, profile) => {
    const target = new URL(path, base);
    target.searchParams.set("mode", "shared");
    target.searchParams.set("profile", profile);
    await page.goto(target.href);
    await userReady(page, "已连接本机共享资料");
  };
  const refreshUser = async (page) => {
    await userPanel(page).locator("[data-monthly-feedback-refresh]").click();
    await userReady(page, "已刷新");
  };
  const userAction = async (page, id, action, expected) => {
    await userPanel(page)
      .locator(`[data-monthly-feedback-action="${action}"][data-monthly-feedback-id="${id}"]`)
      .click();
    await userReady(page, expected);
  };
  const reviewerAction = async (id, action, expectedStatus) => {
    await reviewer
      .locator(`[data-monthly-feedback-action="${action}"][data-monthly-feedback-id="${id}"]`)
      .click();
    await reviewerReady("已刷新本机共享月度反馈队列");
    if (expectedStatus) {
      await reviewer.waitForFunction(
        ({ id, expectedStatus }) =>
          document
            .querySelector(`[data-monthly-feedback-row="${id}"]`)
            ?.textContent?.includes(expectedStatus) ?? false,
        { id, expectedStatus },
      );
    }
  };

  await openUser(teacher, userBase, "/staff/report", "teacher-east");
  assert.equal(
    await teacher.locator('main [data-monthly-feedback-root="staff"]').count(),
    1,
    "员工月度反馈必须位于页面主体内",
  );
  const form = userPanel(teacher).locator('[data-monthly-feedback-form=""]');
  await form.locator('[name="month"]').fill("2026-10");
  await form.locator('[name="learningParticipation"]').selectOption("PROGRESSING");
  await form.locator('[name="dailyHabits"]').selectOption("KEEP_WATCHING");
  await form.locator('[name="activityParticipation"]').selectOption("PROGRESSING");
  await form.locator('[name="familySchoolCollaboration"]').selectOption("FOLLOW_UP");
  await form.locator('button[type="submit"]').click();
  await userReady(teacher, "反馈草稿已保存");
  const feedbackId = await userPanel(teacher)
    .locator('[data-monthly-feedback-action="submit"]')
    .first()
    .getAttribute("data-monthly-feedback-id");
  assert.ok(feedbackId);
  await userAction(teacher, feedbackId, "submit", "反馈已更新");

  const reviewerUrl = new URL("/admin/staff", adminBase);
  reviewerUrl.searchParams.set("localServicePort", apiBase.port);
  await reviewer.goto(reviewerUrl.href);
  await reviewerReady("已刷新本机共享月度反馈队列");
  assert.equal(await reviewer.locator("#monthly-feedback-review-panel").count(), 1);
  const reviewerAliasUrl = new URL("/admin/staff-accounts", adminBase);
  reviewerAliasUrl.searchParams.set("localServicePort", apiBase.port);
  await reviewer.goto(reviewerAliasUrl.href);
  assert.equal(
    await reviewer.locator("#monthly-feedback-review-panel").count(),
    0,
    "审核面板仅属于合同指定的员工管理入口",
  );
  await reviewer.waitForLoadState("networkidle");
  await reviewer.goto(reviewerUrl.href);
  await reviewerReady("已刷新本机共享月度反馈队列");
  await reviewerAction(feedbackId, "RETURN");
  await refreshUser(teacher);
  const resubmit = userPanel(teacher).locator(
    `[data-monthly-feedback-form="resubmit"][data-monthly-feedback-id="${feedbackId}"]`,
  );
  await resubmit.locator('[name="dailyHabits"]').selectOption("FOLLOW_UP");
  await resubmit.locator('button[type="submit"]').click();
  await userReady(teacher, "反馈已更新");

  await refreshReviewer();
  await reviewerAction(feedbackId, "CONFIRM", "已确认");
  await reviewerAction(feedbackId, "PUBLISH", "已发布");
  await openUser(parent, userBase, "/web/parent/home", "parent-alpha");
  const parentPanel = userPanel(parent);
  await parentPanel.locator('[data-monthly-feedback-action="ack"]').waitFor();
  await userAction(parent, feedbackId, "ack", "已确认知悉");
  const parentText = await parentPanel.textContent();
  assert.match(parentText ?? "", /月度成长反馈/u);
  assert.match(parentText ?? "", /需要跟进/u);
  assert.doesNotMatch(parentText ?? "", /sourceId|teacherId|reviewedBy|tenantId|campusId|classId/u);

  const published = await api(ownerHandle, "GET", `/local/monthly-feedback/${feedbackId}`);
  assert.equal(published.status, "PUBLISHED");
  assert.equal(published.sourceSummary[0].count, 1);
  await refreshReviewer();
  await publishCare("2026-10-14");
  await reviewerAction(feedbackId, "SOURCE_REFRESH");
  await refreshUser(parent);
  const invalidParent = (await api(parentHandle, "GET", "/local/monthly-feedback-parent"))[0];
  assert.equal(invalidParent.status, "REVIEW_REQUIRED");
  assert.deepEqual(invalidParent.items, []);
  assert.equal(invalidParent.acknowledged, false);
  const hiddenText = await parentPanel.textContent();
  assert.doesNotMatch(hiddenText ?? "", /已确认知悉|已有进步|需要跟进/u);
  assert.doesNotMatch(hiddenText ?? "", /sourceId|teacherId|reviewedBy|tenantId|campusId|classId/u);

  await refreshUser(teacher);
  const rebuild = userPanel(teacher).locator(
    `[data-monthly-feedback-form="rebuild"][data-monthly-feedback-id="${feedbackId}"]`,
  );
  await rebuild.locator('[name="learningParticipation"]').selectOption("KEEP_WATCHING");
  await rebuild.locator('button[type="submit"]').click();
  await userReady(teacher, "反馈已更新");
  await userAction(teacher, feedbackId, "submit", "反馈已更新");
  await refreshReviewer();
  await reviewerAction(feedbackId, "CONFIRM", "已确认");
  await reviewerAction(feedbackId, "PUBLISH", "已发布");
  await refreshUser(parent);
  const republished = (await api(parentHandle, "GET", "/local/monthly-feedback-parent"))[0];
  assert.equal(republished.status, "PUBLISHED");
  assert.equal(republished.acknowledged, false);
  assert.equal(republished.items[0].value, "KEEP_WATCHING");
  assert.equal("sources" in republished, false);
  assert.equal("reviewedBy" in republished, false);
  await userAction(parent, feedbackId, "ack", "已确认知悉");

  for (const page of pages) {
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
        ),
        true,
        `横向溢出: ${page.url()} @ ${width}px`,
      );
    }
  }
  assert.deepEqual(errors.page, []);
  assert.deepEqual(
    errors.console,
    [],
    JSON.stringify({ console: errors.console, network: errors.network }),
  );
  assert.deepEqual(errors.network, []);
  assert.deepEqual(errors.external, []);
  process.stdout.write(
    `${JSON.stringify({
      status: "PASS",
      flow: "teacher-draft-submit-return-resubmit-review-publish-parent-ack-source-invalidation-rebuild-rereview-republish",
      sameFeedbackId: true,
      oldParentSummaryHidden: true,
      acknowledgementsReset: true,
      externalRequests: 0,
      responsiveWidths: [390, 1440],
    })}\n`,
  );
} finally {
  await browser.close();
}
