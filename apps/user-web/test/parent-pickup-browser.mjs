/* global AbortSignal, PageTransitionEvent, PopStateEvent, URL, document, fetch, localStorage, sessionStorage, window */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createInterface } from "node:readline";
import { fileURLToPath, pathToFileURL } from "node:url";
import process from "node:process";
import test from "node:test";
import { chromium } from "playwright";

const serverModulePath = process.env.TASK20_LOCAL_SYNTHETIC_SERVER_MODULE;
assert.ok(
  serverModulePath,
  "TASK20_LOCAL_SYNTHETIC_SERVER_MODULE must point to the local synthetic API build",
);
const { buildLocalSyntheticServer } = await import(pathToFileURL(serverModulePath).href);

async function startPreview(script, servicePort) {
  const child = spawn(process.execPath, [script, "--local-service-port", String(servicePort)], {
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  const lines = createInterface({ input: child.stdout });
  const [line] = await once(lines, "line", { signal: AbortSignal.timeout(10000) });
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

function shanghaiDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${value.year}-${value.month}-${value.day}`;
}

test("家长可在已有首页管理接送授权、短时凭证与日期历史", async () => {
  const service = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  const serviceUrl = await service.start(0);
  let preview;
  let browser;
  try {
    preview = await startPreview(
      fileURLToPath(new URL("../preview.mjs", import.meta.url)),
      Number(new URL(serviceUrl).port),
    );
    const api = async (handle, method, path, body) => {
      const response = await fetch(new URL(path, serviceUrl), {
        method,
        headers: {
          ...(handle ? { Authorization: `Bearer ${handle}` } : {}),
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      assert.ok(response.ok, `${method} ${path}: ${response.status}`);
      return response.json();
    };
    const session = async (profile) =>
      (await api("", "POST", "/local/sessions", { profile })).handle;
    const parentHandle = await session("parent-alpha");
    const ownerHandle = await session("owner-east");
    let bindings = await api(parentHandle, "GET", "/local/binding-applications");
    let approved = bindings.find((row) => row.status === "APPROVED");
    if (!approved) {
      const pending =
        bindings.find((row) => row.status === "PENDING") ??
        (await api(parentHandle, "POST", "/local/binding-applications", {
          student: "student-alpha",
          relationship: "GUARDIAN",
        }));
      if (pending.status !== "APPROVED") {
        await api(ownerHandle, "POST", `/local/binding-applications/${pending.id}/review`, {
          version: pending.version,
          action: "approve",
        });
      }
      bindings = await api(parentHandle, "GET", "/local/binding-applications");
      approved = bindings.find((row) => row.status === "APPROVED");
    }
    assert.ok(approved, "an approved synthetic relationship is required for this workflow");
    const unusedDetailsRoute = await fetch(
      new URL(`/local/pickup-authorizations/${approved.id}`, preview.baseUrl),
    );
    assert.equal(
      unusedDetailsRoute.status,
      404,
      "the proxy does not expose unused authorization detail reads",
    );

    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.setDefaultTimeout(10000);
    const origin = new URL(preview.baseUrl).origin;
    const pageErrors = [];
    const externalRequests = [];
    const ownServiceErrors = [];
    let credentialExpiryOffset = 1200;
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.route("**/*", async (route) => {
      const requestUrl = new URL(route.request().url());
      if (requestUrl.origin === origin) {
        if (requestUrl.pathname.endsWith("/credential")) {
          const response = await route.fetch();
          const payload = await response.json();
          return route.fulfill({
            response,
            json: {
              ...payload,
              expiresAt: new Date(Date.now() + credentialExpiryOffset).toISOString(),
            },
          });
        }
        return route.continue();
      }
      if (requestUrl.origin === "http://127.0.0.1:4317")
        return route.fulfill({ status: 503, contentType: "application/json", body: "{}" });
      externalRequests.push(requestUrl.href);
      return route.abort();
    });
    page.on("response", (response) => {
      if (new URL(response.url()).origin === origin && response.status() >= 400)
        ownServiceErrors.push(`${response.status()} ${response.url()}`);
    });

    await page.goto(`${preview.baseUrl}/web/parent/home`);
    const panel = page.locator("[data-parent-pickup-panel]");
    await panel.waitFor();
    await page
      .locator('[data-parent-pickup-form] select[name="bindingId"]')
      .selectOption(approved.id);
    const form = page.locator("[data-parent-pickup-form]");
    const today = shanghaiDate();
    await form.locator('[name="type"]').selectOption("TEMPORARY");
    await form.locator('[name="startDate"]').fill(today);
    await form.locator('[name="endDate"]').fill(today);
    await form.locator('[name="startTime"]').fill("00:00");
    await form.locator('[name="endTime"]').fill("23:59");
    await form.locator('button[type="submit"]').click();

    const card = page.locator("[data-parent-pickup-id]").filter({ hasText: "待确认" }).first();
    await card.waitFor();
    assert.equal(
      await panel
        .locator(".pickup-parent-message")
        .evaluate((message) => message === document.activeElement),
      true,
      "saving a pickup request moves keyboard focus to its status message",
    );
    await card.locator('[data-parent-pickup-action="activate"]').click();
    const activeCard = page
      .locator("[data-parent-pickup-id]")
      .filter({ hasText: "已生效" })
      .first();
    await activeCard.waitFor();
    await activeCard.locator('[data-parent-pickup-action="credential"]').click();
    const credential = page.locator(".pickup-parent-credential code");
    await credential.waitFor();
    assert.match(await credential.textContent(), /^[A-Za-z0-9_-]{43}$/u);
    await page.locator(".pickup-parent-credential").waitFor({ state: "detached" });
    assert.match(await panel.locator(".pickup-parent-message").textContent(), /已过期/u);

    credentialExpiryOffset = 60000;
    await activeCard.locator('[data-parent-pickup-action="credential"]').click();
    await credential.waitFor();
    await page.evaluate(() => {
      window.history.pushState({}, "", "/web/parent/learning?profile=parent-alpha");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await page.waitForFunction(() => window.location.pathname === "/web/parent/learning");
    assert.equal(await page.locator(".pickup-parent-credential code").count(), 0);
    await page.goBack();
    await panel.waitFor();
    await page.getByText("仅显示当前已审核关系内的本机合成接送资料。").waitFor();
    assert.equal(
      await page.locator(".pickup-parent-credential code").count(),
      0,
      "leaving and returning to the parent page never restores a previous credential",
    );

    await activeCard.locator('[data-parent-pickup-action="credential"]').click();
    await credential.waitFor();
    await page.evaluate(() =>
      window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true })),
    );
    await page.locator(".pickup-parent-credential").waitFor({ state: "detached" });
    await page.evaluate(() =>
      window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })),
    );
    await panel.waitFor();
    await page.getByText("仅显示当前已审核关系内的本机合成接送资料。").waitFor();
    assert.equal(
      await page.locator(".pickup-parent-credential code").count(),
      0,
      "page restoration reconnects without restoring the previous credential",
    );

    let revokePromptSeen = false;
    page.once("dialog", async (dialog) => {
      revokePromptSeen = /确认撤销/u.test(dialog.message());
      await dialog.accept();
    });
    await activeCard.locator('[data-parent-pickup-action="revoke"]').click();
    assert.equal(revokePromptSeen, true, "revocation requires a visible confirmation");
    await page.locator("[data-parent-pickup-id]").filter({ hasText: "已撤销" }).first().waitFor();
    assert.equal(await page.locator(".pickup-parent-credential code").count(), 0);

    const tomorrowDate = new Date(`${today}T00:00:00.000Z`);
    tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1);
    const tomorrow = tomorrowDate.toISOString().slice(0, 10);
    await page.locator('[name="historyFrom"]').fill(tomorrow);
    await page.locator('[name="historyTo"]').fill(tomorrow);
    await page.getByText("暂无符合日期的接送记录。").waitFor();
    assert.equal(
      await page
        .locator('[name="historyTo"]')
        .evaluate((input) => input === document.activeElement),
      true,
      "history filtering keeps keyboard focus on the edited date field",
    );
    await page.locator('[name="historyTo"]').evaluate((input) => input.blur());

    await page.setViewportSize({ width: 1280, height: 900 });
    const desktopOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    if (process.env.TASK20_PARENT_PICKUP_DESKTOP_SCREENSHOT)
      await panel.screenshot({ path: process.env.TASK20_PARENT_PICKUP_DESKTOP_SCREENSHOT });
    await page.setViewportSize({ width: 390, height: 844 });
    const mobileOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    if (process.env.TASK20_PARENT_PICKUP_MOBILE_SCREENSHOT)
      await panel.screenshot({ path: process.env.TASK20_PARENT_PICKUP_MOBILE_SCREENSHOT });
    const storage = await page.evaluate(() => ({
      local: localStorage.length,
      session: sessionStorage.length,
    }));

    assert.equal(desktopOverflow, false);
    assert.equal(mobileOverflow, false);
    assert.deepEqual(storage, { local: 0, session: 0 });
    assert.deepEqual(pageErrors, []);
    assert.deepEqual(externalRequests, []);
    assert.deepEqual(ownServiceErrors, []);
  } finally {
    await browser?.close();
    if (preview) await stopPreview(preview.child);
    await service.close();
  }
});
