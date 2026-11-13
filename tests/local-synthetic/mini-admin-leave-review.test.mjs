import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import process from "node:process";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath, URL } from "node:url";
import { chromium } from "playwright";
import { AdminLeaveReviewClient } from "../../apps/admin-web/dist/local-review/leave-review-client.js";
import { buildLocalSyntheticServer } from "../../apps/api/dist/src/local-synthetic/server.js";

const require = createRequire(import.meta.url);
const { MiniSharedClient } = require("../../apps/mini-program/src/local-synthetic/client.js");

async function startAdminPreview() {
  const adminRoot = fileURLToPath(new URL("../../apps/admin-web/", import.meta.url));
  const child = spawn(process.execPath, [resolve(adminRoot, "preview.mjs")], {
    cwd: adminRoot,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  let errors = "";
  try {
    const baseUrl = await new Promise((resolveStartup, reject) => {
      const timeout = globalThis.setTimeout(
        () => reject(new Error(`Admin preview startup timed out. ${errors}`)),
        8000,
      );
      child.stdout.on("data", (chunk) => {
        output += chunk.toString("utf8");
        const lines = output.split(/\r?\n/u);
        output = lines.pop() ?? "";
        for (const line of lines) {
          try {
            const event = JSON.parse(line);
            if (event.event === "startup" && typeof event.baseUrl === "string") {
              globalThis.clearTimeout(timeout);
              resolveStartup(event.baseUrl);
              return;
            }
          } catch {
            // Wait for the next complete startup line.
          }
        }
      });
      child.stderr.on("data", (chunk) => {
        errors += chunk.toString("utf8");
      });
      child.once("error", (error) => {
        globalThis.clearTimeout(timeout);
        reject(error);
      });
      child.once("exit", (code) => {
        globalThis.clearTimeout(timeout);
        reject(new Error(`Admin preview exited (${code}). ${errors}`));
      });
    });
    return { child, baseUrl };
  } catch (error) {
    await stopChild(child);
    throw error;
  }
}

async function stopChild(child) {
  if (child.pid === undefined) return;
  if (isProcessAlive(child.pid)) child.kill("SIGTERM");
  if (await waitForProcessStop(child.pid, 2500)) return;
  child.kill();
  assert.equal(
    await waitForProcessStop(child.pid, 2500),
    true,
    "Admin preview process must exit after the browser test",
  );
}

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error?.code === "ESRCH") return false;
    throw error;
  }
}

async function waitForProcessStop(pid, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (isProcessAlive(pid) && Date.now() < deadline) {
    await new Promise((resolveWait) => globalThis.setTimeout(resolveWait, 50));
  }
  return !isProcessAlive(pid);
}

async function assertPortAvailable(port) {
  const server = createServer();
  await new Promise((resolvePort, rejectPort) => {
    server.once("error", rejectPort);
    server.listen(Number(port), "127.0.0.1", () => {
      server.close((error) => (error ? rejectPort(error) : resolvePort(undefined)));
    });
  });
}

test("Mini parent and Admin reviewer process one shared leave request through acknowledgement", async () => {
  const app = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  const origin = "http://127.0.0.1:4317";
  const api = async (method, path, body, handle, expectedStatus = 200) => {
    const response = await app.inject({
      method,
      url: path,
      headers: { origin, ...(handle ? { authorization: `Bearer ${handle}` } : {}) },
      ...(body === undefined ? {} : { payload: body }),
    });
    assert.equal(response.statusCode, expectedStatus, `${method} ${path}: ${response.body}`);
    return response.statusCode === 204 ? null : response.json();
  };
  try {
    const parentHandle = (
      await api("POST", "/local/sessions", { profile: "parent-alpha" }, undefined, 201)
    ).handle;
    const ownerHandle = (
      await api("POST", "/local/sessions", { profile: "owner-east" }, undefined, 201)
    ).handle;
    const student = (await api("GET", "/local/student-options", undefined, parentHandle))[0];
    const application = await api(
      "POST",
      "/local/binding-applications",
      { student: student.alias, relationship: "GUARDIAN" },
      parentHandle,
      201,
    );
    await api(
      "POST",
      `/local/binding-applications/${application.id}/review`,
      { version: application.version, action: "approve" },
      ownerHandle,
    );

    const miniTransport = async (path, method, body, handle) => {
      const response = await app.inject({
        method,
        url: path,
        headers: { origin, ...(handle ? { authorization: `Bearer ${handle}` } : {}) },
        ...(body === undefined ? {} : { payload: body }),
      });
      return {
        status: response.statusCode,
        data: response.statusCode === 204 ? null : response.json(),
      };
    };
    const mini = new MiniSharedClient(miniTransport);
    await mini.loadProfiles();
    await mini.connect("parent-alpha");
    mini.selectStudent(student.id);
    assert.equal(mini.snapshot.status, "READY");
    assert.equal(mini.snapshot.selectedStudentId, student.id);
    await mini.command("leave-submit", undefined, {
      startDate: "2026-12-01",
      endDate: "2026-12-02",
      reason: "FAMILY_ARRANGEMENT",
    });
    const submitted = mini.snapshot.leaves.find((row) => row.status === "SUBMITTED");
    assert.ok(submitted);

    const adminCalls = [];
    const fetcher = async (url, init = {}) => {
      const target = new URL(String(url));
      const response = await app.inject({
        method: init.method ?? "GET",
        url: target.pathname,
        headers: {
          origin,
          ...Object.fromEntries(new globalThis.Headers(init.headers).entries()),
        },
        ...(init.body === undefined ? {} : { payload: JSON.parse(String(init.body)) }),
      });
      adminCalls.push({ path: target.pathname, status: response.statusCode, body: response.body });
      return new globalThis.Response(response.body, {
        status: response.statusCode,
        headers: { "content-type": "application/json" },
      });
    };
    const admin = new AdminLeaveReviewClient({ baseUrl: origin, fetcher });
    await admin.connect();
    assert.equal(
      admin.snapshot.status,
      "READY",
      JSON.stringify({ snapshot: admin.snapshot, adminCalls }),
    );
    assert.equal(
      admin.snapshot.records.find((row) => row.id === submitted.id)?.version,
      submitted.version,
    );
    await admin.review(submitted.id, submitted.version, "RETURN");
    await mini.refresh();
    let current = mini.snapshot.leaves.find((row) => row.id === submitted.id);
    assert.equal(current?.status, "RETURNED");

    await mini.command(
      "leave-resubmit",
      { id: current.id, version: current.version },
      {
        startDate: "2026-12-03",
        endDate: "2026-12-03",
        reason: "TEMPORARY_MATTER",
      },
    );
    current = mini.snapshot.leaves.find((row) => row.id === submitted.id);
    assert.equal(current?.status, "SUBMITTED");
    await admin.refresh();
    assert.equal(
      admin.snapshot.records.find((row) => row.id === submitted.id)?.version,
      current.version,
    );
    await admin.review(submitted.id, current.version, "CONFIRM");
    await mini.refresh();
    current = mini.snapshot.leaves.find((row) => row.id === submitted.id);
    assert.equal(current?.status, "CONFIRMED");
    await mini.command("leave-receipt", { id: current.id, version: current.version });
    current = mini.snapshot.leaves.find((row) => row.id === submitted.id);
    assert.equal(current?.acknowledged, true);
    await admin.refresh();
    assert.equal(admin.snapshot.records.find((row) => row.id === submitted.id)?.acknowledged, true);
  } finally {
    await app.close();
  }
});

test("Admin browser reviews the Mini-shared request and parent acknowledges it", async (t) => {
  const preview = await startAdminPreview();
  let browser;
  let app;
  t.after(async () => {
    try {
      await browser?.close();
    } finally {
      try {
        await app?.close();
      } finally {
        await stopChild(preview.child);
      }
    }
    await assertPortAvailable(apiPort);
    await assertPortAvailable(new URL(preview.baseUrl).port);
  });
  browser = await chromium.launch({ headless: true });
  app = await buildLocalSyntheticServer({
    mode: "local-synthetic",
    allowedOrigins: [preview.baseUrl],
  });
  const apiBase = await app.start(0);
  const apiPort = new URL(apiBase).port;

  const api = async (method, path, body, handle, expectedStatus = 200) => {
    const response = await app.inject({
      method,
      url: path,
      headers: {
        origin: preview.baseUrl,
        ...(handle ? { authorization: `Bearer ${handle}` } : {}),
      },
      ...(body === undefined ? {} : { payload: body }),
    });
    assert.equal(response.statusCode, expectedStatus, `${method} ${path}: ${response.body}`);
    return response.statusCode === 204 ? null : response.json();
  };

  const parentHandle = (
    await api("POST", "/local/sessions", { profile: "parent-alpha" }, undefined, 201)
  ).handle;
  const ownerHandle = (
    await api("POST", "/local/sessions", { profile: "owner-east" }, undefined, 201)
  ).handle;
  const student = (await api("GET", "/local/student-options", undefined, parentHandle))[0];
  const binding = await api(
    "POST",
    "/local/binding-applications",
    { student: student.alias, relationship: "GUARDIAN" },
    parentHandle,
    201,
  );
  await api(
    "POST",
    `/local/binding-applications/${binding.id}/review`,
    { version: binding.version, action: "approve" },
    ownerHandle,
  );

  const miniTransport = async (path, method, body, handle) => {
    const response = await app.inject({
      method,
      url: path,
      headers: {
        origin: preview.baseUrl,
        ...(handle ? { authorization: `Bearer ${handle}` } : {}),
      },
      ...(body === undefined ? {} : { payload: body }),
    });
    return {
      status: response.statusCode,
      data: response.statusCode === 204 ? null : response.json(),
    };
  };
  const mini = new MiniSharedClient(miniTransport);
  await mini.loadProfiles();
  await mini.connect("parent-alpha");
  mini.selectStudent(student.id);
  await mini.command("leave-submit", undefined, {
    startDate: "2026-12-05",
    endDate: "2026-12-05",
    reason: "FAMILY_ARRANGEMENT",
  });
  let leave = mini.snapshot.leaves.find((row) => row.status === "SUBMITTED");
  assert.ok(leave);

  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const browserErrors = [];
  const failedRequests = [];
  const externalRequests = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("requestfailed", (request) =>
    failedRequests.push(`${request.method()} ${request.url()}`),
  );
  page.on("request", (request) => {
    const requestOrigin = new URL(request.url()).origin;
    if (requestOrigin !== preview.baseUrl && requestOrigin !== apiBase)
      externalRequests.push(request.url());
  });

  await page.goto(
    `${preview.baseUrl}/admin/leave-review?profile=owner-east&localServicePort=${apiPort}`,
    { waitUntil: "networkidle" },
  );
  await page.getByRole("heading", { name: "请假审核" }).waitFor();
  await page.getByText(`${student.label} · 待审核`, { exact: true }).waitFor();
  if (process.env.TASK20_ADMIN_VISUAL_SCREENSHOT_PATH) {
    await page.screenshot({
      path: process.env.TASK20_ADMIN_VISUAL_SCREENSHOT_PATH,
    });
  }
  assert.equal(await page.locator(`[data-admin-leave-id="${leave.id}"]`).count(), 2);
  await page.getByRole("button", { name: "退回修改" }).click();
  await page.locator('[data-admin-leave-status="RETURNED"]').waitFor();

  await mini.refresh();
  leave = mini.snapshot.leaves.find((row) => row.id === leave?.id);
  assert.equal(leave?.status, "RETURNED");
  await mini.command(
    "leave-resubmit",
    { id: leave.id, version: leave.version },
    {
      startDate: "2026-12-06",
      endDate: "2026-12-06",
      reason: "TEMPORARY_MATTER",
    },
  );
  leave = mini.snapshot.leaves.find((row) => row.status === "SUBMITTED");
  assert.ok(leave);
  await page.getByRole("button", { name: "刷新申请" }).click();
  await page.getByText(`${student.label} · 待审核`, { exact: true }).waitFor();
  await page.getByRole("button", { name: "审核通过" }).click();
  await page.locator('[data-admin-leave-status="CONFIRMED"]').waitFor();

  await mini.refresh();
  leave = mini.snapshot.leaves.find((row) => row.id === leave?.id);
  assert.equal(leave?.status, "CONFIRMED");
  await mini.command("leave-receipt", { id: leave.id, version: leave.version });
  leave = mini.snapshot.leaves.find((row) => row.id === leave?.id);
  assert.equal(leave?.acknowledged, true);
  await page.getByRole("button", { name: "刷新申请" }).click();
  await page.getByText("家长已确认知悉", { exact: true }).waitFor();

  assert.equal(
    await page.evaluate(
      () =>
        globalThis.document.documentElement.scrollWidth <=
        globalThis.document.documentElement.clientWidth,
    ),
    true,
  );
  assert.deepEqual(browserErrors, []);
  assert.deepEqual(failedRequests, []);
  assert.deepEqual(externalRequests, []);
  await page.close();
});

test("Mini staff notice is approved and published in Admin, then acknowledged by its bound parent", async (t) => {
  const preview = await startAdminPreview();
  let browser;
  let app;
  t.after(async () => {
    try {
      await browser?.close();
    } finally {
      try {
        await app?.close();
      } finally {
        await stopChild(preview.child);
      }
    }
  });
  browser = await chromium.launch({ headless: true });
  app = await buildLocalSyntheticServer({
    mode: "local-synthetic",
    allowedOrigins: [preview.baseUrl],
  });
  const api = async (method, path, body, handle, expectedStatus = 200) => {
    const response = await app.inject({
      method,
      url: path,
      headers: {
        origin: preview.baseUrl,
        ...(handle ? { authorization: `Bearer ${handle}` } : {}),
      },
      ...(body === undefined ? {} : { payload: body }),
    });
    assert.equal(
      response.statusCode,
      expectedStatus,
      `${method} ${path}: ${response.body}`,
    );
    return response.statusCode === 204 ? null : response.json();
  };

  const parentHandle = (
    await api(
      "POST",
      "/local/sessions",
      { profile: "parent-alpha" },
      undefined,
      201,
    )
  ).handle;
  const ownerHandle = (
    await api(
      "POST",
      "/local/sessions",
      { profile: "owner-east" },
      undefined,
      201,
    )
  ).handle;
  const student = (
    await api("GET", "/local/student-options", undefined, parentHandle)
  )[0];
  const binding = await api(
    "POST",
    "/local/binding-applications",
    { student: student.alias, relationship: "GUARDIAN" },
    parentHandle,
    201,
  );
  await api(
    "POST",
    `/local/binding-applications/${binding.id}/review`,
    { version: binding.version, action: "approve" },
    ownerHandle,
  );

  const miniTransport = async (path, method, body, handle) => {
    const response = await app.inject({
      method,
      url: path,
      headers: {
        origin: preview.baseUrl,
        ...(handle ? { authorization: `Bearer ${handle}` } : {}),
      },
      ...(body === undefined ? {} : { payload: body }),
    });
    return {
      status: response.statusCode,
      data: response.statusCode === 204 ? null : response.json(),
    };
  };
  const staff = new MiniSharedClient(miniTransport);
  await staff.loadProfiles();
  await staff.connect("teacher-east");
  await staff.command("notice-create", undefined, {
    template: "CLASS_ACTIVITY",
  });
  let notice = staff.snapshot.noticeOwned.find((row) => row.status === "DRAFT");
  assert.ok(notice);
  await staff.command("notice-submit", {
    id: notice.id,
    version: notice.version,
  });
  notice = staff.snapshot.noticeOwned.find((row) => row.id === notice?.id);
  assert.equal(notice?.status, "SUBMITTED");

  const parent = new MiniSharedClient(miniTransport);
  await parent.loadProfiles();
  await parent.connect("parent-alpha");
  parent.selectStudent(student.id);
  await parent.refresh();
  assert.deepEqual(parent.snapshot.noticeDocuments, []);

  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const browserErrors = [];
  const failedRequests = [];
  const externalRequests = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("requestfailed", (request) =>
    failedRequests.push(`${request.method()} ${request.url()}`),
  );
  page.on("request", (request) => {
    const requestOrigin = new URL(request.url()).origin;
    if (requestOrigin !== preview.baseUrl) externalRequests.push(request.url());
  });
  await page.route("**/local/**", async (route) => {
    const request = route.request();
    const target = new URL(request.url());
    const postData = request.postData();
    const response = await app.inject({
      method: request.method(),
      url: target.pathname,
      headers: {
        origin: preview.baseUrl,
        ...(postData === null ? {} : { "content-type": "application/json" }),
        ...(request.headers().authorization
          ? { authorization: request.headers().authorization }
          : {}),
      },
      ...(postData === null ? {} : { payload: JSON.parse(postData) }),
    });
    await route.fulfill({
      status: response.statusCode,
      contentType: "application/json; charset=utf-8",
      body: response.body,
    });
  });

  await page.goto(`${preview.baseUrl}/admin/notice-review?profile=owner-east`, {
    waitUntil: "domcontentloaded",
  });
  await page.getByRole("heading", { name: "通知审核与发布" }).waitFor();
  await page.locator(`[data-notice-row="${notice.id}"]`).waitFor();
  await page
    .locator(`[data-notice-row="${notice.id}"] [data-notice-action="CONFIRM"]`)
    .click();
  await page
    .locator(`[data-notice-row="${notice.id}"] [data-notice-action="PUBLISH"]`)
    .waitFor();

  await staff.refresh();
  notice = staff.snapshot.noticeOwned.find((row) => row.id === notice?.id);
  assert.equal(notice?.status, "CONFIRMED");
  await parent.refresh();
  assert.deepEqual(
    parent.snapshot.noticeDocuments,
    [],
    "审核通过尚未发布时家长不可见",
  );
  await page
    .locator(`[data-notice-row="${notice.id}"] [data-notice-action="PUBLISH"]`)
    .click();
  await page
    .locator(`[data-notice-row="${notice.id}"]`)
    .getByText("已发布")
    .waitFor();
  await staff.refresh();
  notice = staff.snapshot.noticeOwned.find((row) => row.id === notice?.id);
  assert.equal(notice?.status, "PUBLISHED");

  await parent.refresh();
  let received = parent.snapshot.noticeDocuments.find(
    (row) => row.id === notice?.id,
  );
  assert.equal(received?.version, notice.version);
  assert.equal(received?.receiptStatus, "UNREAD");
  await parent.command("notice-read", {
    id: received.id,
    version: received.version,
  });
  received = parent.snapshot.noticeDocuments.find(
    (row) => row.id === notice?.id,
  );
  assert.equal(received?.receiptStatus, "READ");
  assert.match(received?.body ?? "", /合成内容/u);
  await parent.command("notice-ack", {
    id: received.id,
    version: received.version,
  });
  received = parent.snapshot.noticeDocuments.find(
    (row) => row.id === notice?.id,
  );
  assert.equal(received?.receiptStatus, "ACKNOWLEDGED");

  const ownerRecord = (
    await api("GET", "/local/notice-owned", undefined, ownerHandle)
  ).find((row) => row.id === notice.id);
  assert.equal(ownerRecord?.version, received.version);
  assert.equal(ownerRecord?.status, "PUBLISHED");
  const parentReceipt = (
    await api("GET", "/local/notices", undefined, parentHandle)
  ).find((row) => row.id === notice.id);
  assert.equal(parentReceipt?.version, received.version);
  assert.equal(parentReceipt?.receiptStatus, "ACKNOWLEDGED");
  assert.equal(
    await page.evaluate(
      () =>
        globalThis.document.documentElement.scrollWidth <=
        globalThis.document.documentElement.clientWidth,
    ),
    true,
  );
  assert.deepEqual(browserErrors, []);
  assert.deepEqual(failedRequests, []);
  assert.deepEqual(externalRequests, []);
  await page.close();
});
