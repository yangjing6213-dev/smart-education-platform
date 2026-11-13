/* global document, process, URL */

import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";

const baseUrl = process.env.ADMIN_WEB_BASE_URL ?? "http://127.0.0.1:3038";
const baseOrigin = new URL(baseUrl).origin;
const RECORD_A = "11111111-1111-4111-8111-111111111111";
const RECORD_B = "33333333-3333-4333-8333-333333333333";
const VALUES = {
  arrival: "ARRIVED_AS_PLANNED",
  homework: "COMPLETED",
  meal: "FINISHED",
  rest: "RESTED",
  activity: "PARTICIPATED",
  wellbeing: "ROUTINE",
};
const actor = {
  display_name: "模拟东校区审核员",
  memberships: [
    { status: "ACTIVE", capabilities: ["identity:read", "care:review", "care:publish"] },
  ],
};

function record(id, student, date) {
  return {
    id,
    student_display_ref: student,
    class_ref: "模拟一年级一班",
    service_date: date,
    values: { ...VALUES },
    status: "SUBMITTED",
    version: 1,
    published: false,
    publication_version: 0,
    updated_at: "2026-10-19T01:00:00.000Z",
    actions: ["review"],
  };
}

test("Next Admin invite account can review and publish within the mocked server scope", async (t) => {
  if (!process.env.ADMIN_WEB_BASE_URL) {
    return t.skip(
      "Set ADMIN_WEB_BASE_URL to a local Next Admin server before running browser validation.",
    );
  }

  let browser;
  let signedIn = false;
  const records = [
    record(RECORD_A, "模拟学生甲", "2026-10-17"),
    record(RECORD_B, "模拟学生乙", "2026-10-18"),
  ];
  const externalRequests = [];
  const pageErrors = [];

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1365, height: 900 } });
    await context.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin !== baseOrigin) {
        externalRequests.push(url.origin + url.pathname);
        await route.abort("blockedbyclient");
        return;
      }
      if (!url.pathname.startsWith("/api/admin/")) {
        await route.continue();
        return;
      }

      const method = request.method();
      const path = url.pathname.slice("/api/admin/".length);
      if (method === "POST" && path === "identity/login") {
        const body = request.postDataJSON();
        assert.equal(body.username, "reviewer-demo");
        assert.equal(body.password, "synthetic-only-password");
        signedIn = true;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          headers: {
            "set-cookie":
              "student_care_admin_session=" +
              "a".repeat(43) +
              "; Path=/api/admin; HttpOnly; SameSite=Lax",
          },
          body: JSON.stringify({ data: { expires_at: "2026-10-19T12:00:00.000Z" } }),
        });
        return;
      }
      if (method === "POST" && path === "identity/logout") {
        signedIn = false;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: { logged_out: true } }),
        });
        return;
      }
      if (!signedIn) {
        await route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ error: { code: "UNAUTHENTICATED", message: "请先登录。" } }),
        });
        return;
      }
      if (method === "GET" && path === "me") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: actor }),
        });
        return;
      }
      if (method === "GET" && path === "staff/care-records") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: records }),
        });
        return;
      }
      const review = /^staff\/care-records\/([0-9a-f-]{36})\/review$/iu.exec(path);
      if (method === "POST" && review) {
        const row = records.find((item) => item.id === review[1]);
        const body = request.postDataJSON();
        assert.ok(row);
        assert.deepEqual(Object.keys(body).sort(), ["action", "version"]);
        assert.equal(body.version, row.version);
        row.version += 1;
        if (body.action === "confirm") {
          row.status = "CONFIRMED";
          row.actions = ["publish"];
        } else {
          row.status = "RETURNED";
          row.actions = ["edit", "resubmit"];
        }
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: row }),
        });
        return;
      }
      const publish = /^staff\/care-records\/([0-9a-f-]{36})\/publish$/iu.exec(path);
      if (method === "POST" && publish) {
        const row = records.find((item) => item.id === publish[1]);
        const body = request.postDataJSON();
        assert.ok(row);
        assert.equal(body.version, row.version);
        row.version += 1;
        row.publication_version += 1;
        row.published = true;
        row.actions = [];
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: row }),
        });
        return;
      }
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "NOT_FOUND" } }),
      });
    });

    const page = await context.newPage();
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") pageErrors.push(message.text());
    });

    await page.goto(`${baseUrl}/admin/login?next=%2Fadmin%2Fcare-record-review`, {
      waitUntil: "networkidle",
    });
    await page.locator("#admin-login-username").fill("reviewer-demo");
    await page.locator("#admin-login-password").fill("synthetic-only-password");
    await page.getByRole("button", { name: "登录", exact: true }).click();
    await page.waitForURL(`${baseUrl}/admin/care-record-review`);
    await page.getByRole("heading", { name: "成长记录审核与发布" }).waitFor();
    await page.getByText("模拟东校区审核员", { exact: false }).waitFor();
    await page.getByText("模拟学生甲", { exact: false }).waitFor();
    assert.equal(
      await page.locator("#care-record-review-profile").count(),
      0,
      "审核页不得提供固定示例负责人切换。",
    );
    assert.equal(
      await page
        .locator("body")
        .innerText()
        .then((text) => text.includes(RECORD_A)),
      false,
      "页面不得显示成长记录内部编号。",
    );

    const confirmBox = page.locator("[data-care-review-confirm]");
    const firstRow = page.locator("[data-care-review-row]").filter({ hasText: "2026-10-17" });
    assert.equal(await firstRow.getByRole("button", { name: "审核通过" }).isDisabled(), true);
    await confirmBox.check();
    await firstRow.getByRole("button", { name: "审核通过" }).click();
    await page.getByText("审核结果已保存。", { exact: true }).waitFor();
    await firstRow.getByText("已通过 · 第 2 版", { exact: true }).waitFor();
    await confirmBox.check();
    await firstRow.getByRole("button", { name: "发布给家长" }).click();
    await page.getByText("成长记录已发布给家长。", { exact: true }).waitFor();
    await firstRow.getByText("已通过 · 第 3 版 · 已发布给家长", { exact: true }).waitFor();

    const secondRow = page.locator("[data-care-review-row]").filter({ hasText: "2026-10-18" });
    await confirmBox.check();
    await secondRow.getByRole("button", { name: "退回修改" }).click();
    await page.getByText("审核结果已保存。", { exact: true }).waitFor();
    await secondRow.getByText("已退回 · 第 2 版", { exact: true }).waitFor();

    await page.setViewportSize({ width: 390, height: 844 });
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    assert.equal(width, 390, "手机宽度下页面不应横向溢出。");
    assert.deepEqual(pageErrors, []);
    assert.deepEqual(externalRequests, []);
  } finally {
    await browser?.close();
  }
});
