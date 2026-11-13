import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createInterface } from "node:readline";
import process from "node:process";
import test from "node:test";
import { fileURLToPath, URL } from "node:url";
import { chromium } from "playwright";

async function startPreview(script, servicePort) {
  const child = spawn(
    process.execPath,
    [fileURLToPath(script), "--local-service-port", String(servicePort)],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  const lines = createInterface({ input: child.stdout });
  const [line] = await once(lines, "line", { signal: globalThis.AbortSignal.timeout(10000) });
  lines.close();
  const startup = JSON.parse(line);
  assert.equal(startup.event, "startup");
  return { child, baseUrl: startup.baseUrl };
}

async function stopPreview(child) {
  if (child.exitCode !== null) return;
  const exited = once(child, "exit");
  child.kill();
  await exited;
}

test("员工网页申请、负责人审核、退回重提与领取通过本机共享流程完成", async () => {
  const apiModule = new URL("../../api/dist/src/local-synthetic/server.js", import.meta.url);
  const { buildLocalSyntheticServer } = await import(apiModule.href);
  const service = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  const serviceUrl = await service.start(0);
  let userPreview;
  let adminPreview;
  let browser;
  try {
    userPreview = await startPreview(
      new URL("../preview.mjs", import.meta.url),
      new URL(serviceUrl).port,
    );
    adminPreview = await startPreview(
      new URL("../../admin-web/preview.mjs", import.meta.url),
      new URL(serviceUrl).port,
    );
    async function api(handle, path, body) {
      const result = await globalThis.fetch(serviceUrl + path, {
        method: body ? "POST" : "GET",
        headers: {
          ...(handle ? { Authorization: `Bearer ${handle}` } : {}),
          "Content-Type": "application/json",
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      assert.ok(result.ok, `${path}: ${result.status}`);
      return result.json();
    }
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const userPage = await context.newPage();
    const adminPage = await context.newPage();
    for (const page of [userPage, adminPage]) page.setDefaultTimeout(10000);
    const errors = [];
    const external = [];
    const failedResponses = [];
    const adminRequests = [];
    const staleConflictResponses = [];
    for (const [page, expectedOrigin] of [
      [userPage, new URL(userPreview.baseUrl).origin],
      [adminPage, new URL(adminPreview.baseUrl).origin],
    ]) {
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("request", (request) => {
        const url = new URL(request.url());
        if (
          url.origin !== expectedOrigin &&
          url.hostname !== "127.0.0.1" &&
          url.hostname !== "localhost"
        )
          external.push(request.url());
        if (page === adminPage) adminRequests.push(new URL(request.url()).pathname);
      });
      page.on("response", (response) => {
        if (response.status() >= 400) failedResponses.push(response.url());
      });
    }

    await userPage.goto(`${userPreview.baseUrl}/staff/workbench`);
    const createForm = userPage.locator('[data-supply-form="create"]');
    await createForm.waitFor();
    await createForm.locator('[name="catalog"]').selectOption("ART_ACTIVITY_SET");
    await createForm.locator('[name="purpose"]').selectOption("CLASS_ACTIVITY");
    await createForm.locator('[name="quantity"]').fill("2");
    await createForm.locator('button[type="submit"]').click();
    const firstRow = userPage.locator("[data-supply-row]").first();
    await firstRow.waitFor();
    const firstId = await firstRow.getAttribute("data-supply-row");
    assert.ok(firstId);
    await firstRow.locator('[data-supply-action="submit"]').click();
    await firstRow.getByText("待负责人审核").waitFor();

    await adminPage.goto(`${adminPreview.baseUrl}/admin/supply-request-review`);
    const staleAdminPage = await context.newPage();
    staleAdminPage.setDefaultTimeout(10000);
    staleAdminPage.on("pageerror", (error) => errors.push(error.message));
    staleAdminPage.on("request", (request) => {
      const url = new URL(request.url());
      if (
        url.origin !== new URL(adminPreview.baseUrl).origin &&
        url.hostname !== "127.0.0.1" &&
        url.hostname !== "localhost"
      )
        external.push(request.url());
    });
    staleAdminPage.on("response", (response) => {
      if (response.status() >= 400)
        staleConflictResponses.push({
          path: new URL(response.url()).pathname,
          status: response.status(),
        });
    });
    await staleAdminPage.goto(`${adminPreview.baseUrl}/admin/supply-request-review`);
    const reviewedRow = adminPage.locator(`[data-supply-row="${firstId}"]`);
    const staleRow = staleAdminPage.locator(`[data-supply-row="${firstId}"]`);
    await reviewedRow.locator('[data-supply-action="CONFIRM"]').waitFor();
    await staleRow.locator('[data-supply-action="CONFIRM"]').waitFor();
    await reviewedRow.locator('[data-supply-action="CONFIRM"]').click();
    await reviewedRow.locator('[data-supply-action="CLAIM"]').waitFor();
    await staleRow.locator('[data-supply-action="CONFIRM"]').click();
    await staleAdminPage.locator("#supply-feedback").filter({ hasText: "状态已变化" }).waitFor();
    await staleRow.locator('[data-supply-action="CLAIM"]').waitFor();
    assert.equal(await staleRow.locator('[data-supply-action="CONFIRM"]').count(), 0);
    assert.deepEqual(staleConflictResponses, [
      { path: `/local/supply-requests/${firstId}/review`, status: 409 },
    ]);
    await userPage.locator("[data-supply-refresh]").click();
    await firstRow.locator('[data-supply-action="claim"]').waitFor();
    await firstRow.locator('[data-supply-action="claim"]').click();
    await firstRow.getByText("已领取").waitFor();

    await createForm.locator('[name="catalog"]').selectOption("STATIONERY_SET");
    await createForm.locator('[name="purpose"]').selectOption("DAILY_OPERATION");
    await createForm.locator('[name="quantity"]').fill("1");
    await createForm.locator('button[type="submit"]').click();
    const secondRow = userPage.locator("[data-supply-row]").filter({ hasText: "日常文具包" });
    await secondRow.waitFor();
    const secondId = await secondRow.getAttribute("data-supply-row");
    assert.ok(secondId);
    await secondRow.locator('[data-supply-action="submit"]').click();
    await secondRow.getByText("待负责人审核").waitFor();
    await adminPage.locator("#supply-refresh").click();
    const returnedRow = adminPage.locator(`[data-supply-row="${secondId}"]`);
    await returnedRow.locator('[data-supply-action="RETURN"]').waitFor();
    await returnedRow.locator('[data-supply-action="RETURN"]').click();
    await userPage.locator("[data-supply-refresh]").click();
    const editableRow = userPage.locator(`[data-supply-row="${secondId}"]`);
    await editableRow.locator('[data-supply-form="edit"]').waitFor();
    await editableRow.locator('[name="quantity"]').fill("3");
    await editableRow.locator('button[type="submit"]').click();
    await editableRow.locator('[data-supply-action="submit"]').click();
    await editableRow.getByText("待负责人审核").waitFor();

    await adminPage.locator("#supply-refresh").click();
    const shortageRow = adminPage.locator(`[data-supply-row="${secondId}"]`);
    await shortageRow.locator('[data-supply-action="OUT_OF_STOCK"]').waitFor();
    await shortageRow.locator('[data-supply-action="OUT_OF_STOCK"]').click();
    await userPage.locator("[data-supply-refresh]").click();
    await editableRow.getByText("缺货，可重新申请").waitFor();

    await createForm.locator('[name="catalog"]').selectOption("CLEANING_SET");
    await createForm.locator('[name="purpose"]').selectOption("EMERGENCY_STOCK");
    await createForm.locator('[name="quantity"]').fill("1");
    await createForm.locator('button[type="submit"]').click();
    const reapplicationRow = userPage
      .locator("[data-supply-row]")
      .filter({ hasText: "清洁用品包" });
    await reapplicationRow.waitFor();
    const reapplicationId = await reapplicationRow.getAttribute("data-supply-row");
    assert.ok(reapplicationId);
    await reapplicationRow.locator('[data-supply-action="submit"]').click();
    await reapplicationRow.getByText("待负责人审核").waitFor();
    await adminPage.locator("#supply-refresh").click();
    const reapplicationReview = adminPage.locator(`[data-supply-row="${reapplicationId}"]`);
    await reapplicationReview.locator('[data-supply-action="CONFIRM"]').click();
    await userPage.locator("[data-supply-refresh]").click();
    const reapplicationReady = userPage.locator(`[data-supply-row="${reapplicationId}"]`);
    await reapplicationReady.locator('[data-supply-action="claim"]').click();
    await reapplicationReady.getByText("已领取").waitFor();

    await createForm.locator('[name="catalog"]').selectOption("STATIONERY_SET");
    await createForm.locator('[name="purpose"]').selectOption("CLASS_ACTIVITY");
    await createForm.locator('[name="quantity"]').fill("1");
    await createForm.locator('button[type="submit"]').click();
    const cancelledRow = userPage
      .locator("[data-supply-row]")
      .filter({ hasText: "班级活动" })
      .last();
    await cancelledRow.waitFor();
    const cancelledId = await cancelledRow.getAttribute("data-supply-row");
    assert.ok(cancelledId);
    await cancelledRow.locator('[data-supply-action="cancel"]').click();
    await cancelledRow.getByText("已取消").waitFor();

    const west = await api(null, "/local/sessions", { profile: "owner-west" });
    const crossCampusPage = await context.newPage();
    crossCampusPage.setDefaultTimeout(10000);
    crossCampusPage.on("pageerror", (error) => errors.push(error.message));
    crossCampusPage.on("request", (request) => {
      const url = new URL(request.url());
      if (
        url.origin !== new URL(adminPreview.baseUrl).origin &&
        url.hostname !== "127.0.0.1" &&
        url.hostname !== "localhost"
      )
        external.push(request.url());
    });
    await crossCampusPage.goto(`${adminPreview.baseUrl}/admin/supply-request-review`);
    const crossCampusResponse = await crossCampusPage.evaluate(async (handle) => {
      const response = await globalThis.fetch("/local/supply-requests-review", {
        headers: { Authorization: `Bearer ${handle}` },
      });
      return { status: response.status, body: await response.text() };
    }, west.handle);
    assert.equal(crossCampusResponse.status, 200);
    assert.deepEqual(JSON.parse(crossCampusResponse.body), []);

    const beforePlatform = adminRequests.length;
    await adminPage.locator("#supply-role").selectOption("PLATFORM_ADMIN");
    assert.equal(await adminPage.locator("[data-supply-row]").count(), 0);
    await adminPage.locator("#supply-feedback").filter({ hasText: "匿名状态统计" }).waitFor();
    assert.deepEqual(adminRequests.slice(beforePlatform), [
      "/local/sessions",
      "/local/supply-summary",
    ]);
    assert.equal(await adminPage.locator("[data-supply-row]").count(), 0);
    const platformMarkup = await adminPage.locator("main").innerText();
    assert.doesNotMatch(platformMarkup, /示例东校区教师|日常文具包|班级活动|STATIONERY_SET/u);

    await adminPage.setViewportSize({ width: 390, height: 844 });
    await userPage.setViewportSize({ width: 390, height: 844 });
    for (const page of [userPage, adminPage, staleAdminPage, crossCampusPage]) {
      assert.equal(
        await page.evaluate(
          () => globalThis.document.documentElement.scrollWidth <= globalThis.window.innerWidth,
        ),
        true,
      );
      assert.equal(
        await page.evaluate(
          () => globalThis.localStorage.length + globalThis.sessionStorage.length,
        ),
        0,
      );
    }
    await adminPage.goto(`${adminPreview.baseUrl}/admin/supply-request-review?mode=readonly`);
    await adminPage.locator("#supply-feedback").filter({ hasText: "已刷新授权范围" }).waitFor();
    assert.equal(await adminPage.locator("#supply-role").isDisabled(), true);
    assert.equal(await adminPage.locator("[data-supply-action]").count(), 0);
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
    assert.deepEqual(failedResponses, []);
  } finally {
    await browser?.close();
    if (adminPreview) await stopPreview(adminPreview.child);
    if (userPreview) await stopPreview(userPreview.child);
    await service.close();
  }
});
