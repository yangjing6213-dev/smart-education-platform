/* global fetch, process, URL */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdir } from "node:fs/promises";
import { resolve, relative, isAbsolute } from "node:path";
import { browserApiModuleUrl } from "./helpers/release-browser-paths.mjs";
import { fileURLToPath } from "node:url";
import {
  capture,
  clickParentControl,
  evaluate,
  navigate,
  startNextBrowser,
  waitForExpression,
} from "./helpers/user-web-next-browser.mjs";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));
const { createApiApp } = await import(browserApiModuleUrl(repositoryRoot, "nest/api-app.js"));
const { InviteAuthService, createInvitePasswordHash } = await import(
  browserApiModuleUrl(repositoryRoot, "nest/invite-auth.service.js")
);
const artifacts = resolve(
  repositoryRoot,
  process.env.USER_WEB_E2E_ARTIFACT_ROOT ??
    "artifacts/task20-a1-274-persistent-staff-tasks-20261023/browser",
);
const within = relative(resolve(repositoryRoot, "artifacts"), artifacts);
assert.ok(within && !within.startsWith("..") && !isAbsolute(within));
test(
  "current invited employee task page follows safe server actions through return and independent check",
  { timeout: 180000 },
  async (t) => {
    await mkdir(artifacts, { recursive: true });
    const password = "Synthetic-Only-Tasks-2026!";
    let apiBase,
      failRead = false,
      releaseClaim;
    let claimSeen;
    const claimArrived = new Promise((resolve) => {
      claimSeen = resolve;
    });
    t.after(() => releaseClaim?.());
    const browser = await startNextBrowser(t, {
      repositoryRoot,
      startInviteApi: async (local) => {
        const hash = await createInvitePasswordHash(password);
        const accounts = [
          {
            username: "task.teacher",
            id: "003",
            capabilities: [
              "identity:read",
              "memberships:read",
              "task:read",
              "task:claim",
              "task:start",
              "task:complete",
            ],
          },
          {
            username: "task.owner",
            id: "004",
            capabilities: [
              "identity:read",
              "memberships:read",
              "task:read",
              "task:assign",
              "task:check",
              "task:cancel",
            ],
          },
        ];
        const inviteAuthService = new InviteAuthService(
          accounts.map((account) => ({
            username: account.username,
            password_hash: hash,
            identity: {
              actor_id: "00000000-0000-4000-8000-000000000" + account.id,
              display_name: "合成" + account.username,
            },
            memberships: [
              {
                tenant_id: "00000000-0000-4000-8000-000000000064",
                campus_ids: ["00000000-0000-4000-8000-000000000065"],
                status: "ACTIVE",
                capabilities: account.capabilities,
              },
            ],
          })),
        );
        const api = await createApiApp({
          inviteAuthService,
          staffTaskWorkbenchOperations: local.staffTaskWorkbenchOperations,
        });
        api.use((request, response, next) => {
          if (failRead && request.method === "GET" && request.url === "/staff/tasks") {
            failRead = false;
            response.status(503).json({ error: { code: "SYNTHETIC_FAULT" } });
            return;
          }
          if (request.method === "POST" && request.url.endsWith("/claim") && !releaseClaim) {
            void new Promise((resolve) => {
              releaseClaim = resolve;
              claimSeen();
            }).then(() => next());
            return;
          }
          next();
        });
        t.after(() => api.close());
        await api.listen(0, "127.0.0.1");
        apiBase = await api.getUrl();
        return apiBase;
      },
    });
    const login = await fetch(apiBase + "/identity/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "task.owner", password }),
    });
    assert.equal(login.status, 200);
    const owner = (await login.json()).data.access_token;
    const ownerRequest = async (path, body) => {
      const response = await fetch(apiBase + path, {
        method: body ? "POST" : "GET",
        headers: {
          authorization: "Bearer " + owner,
          ...(body ? { "content-type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      assert.ok(response.ok, "管理夹具请求必须成功");
      return (await response.json()).data;
    };
    const choice = (await ownerRequest("/admin/tasks")).choices.find(
      (item) =>
        item.assigneeRef === "00000000-0000-4000-8000-000000000003" && item.targetType === "CLASS",
    );
    assert.ok(choice);
    const task = await ownerRequest("/admin/tasks", {
      code: "DAILY_CHECK",
      assigneeRef: choice.assigneeRef,
      classRef: choice.classRef,
      targetType: choice.targetType,
      targetRef: choice.targetRef,
      dueDate: "2030-01-02",
      priority: "URGENT",
    });
    const requests = [],
      failures = [],
      errors = [];
    const page = await browser.connectPage((method, params) => {
      if (method === "Network.requestWillBeSent") {
        const request = params.request;
        const url = new URL(request.url);
        if (url.protocol !== "data:")
          requests.push({
            path: url.pathname,
            origin: url.origin,
            method: request.method,
            hasAuthorization: Object.keys(request.headers ?? {}).some(
              (key) => key.toLowerCase() === "authorization",
            ),
          });
      }
      if (method === "Network.responseReceived" && params.response.status >= 400)
        failures.push({
          path: new URL(params.response.url).pathname,
          status: params.response.status,
        });
      if (method === "Runtime.exceptionThrown") errors.push(params.exceptionDetails?.text);
    });
    await navigate(
      page,
      browser.baseUrl + "/web/login?next=%2Fweb%2Fstaff%2Fworkbench",
      "document.querySelector('input[name=username]') && !document.querySelector('input[name=username]').disabled",
    );
    await clickParentControl(page, 'input[name="username"]');
    await page.send("Input.insertText", { text: "task.teacher" });
    await clickParentControl(page, 'input[name="password"]');
    await page.send("Input.insertText", { text: password });
    await clickParentControl(page, 'button[type="submit"]');
    await waitForExpression(
      page,
      "location.pathname==='/web/staff/workbench' && document.querySelector('[data-staff-workbench-state=READY]')",
      "真实员工登录后任务就绪",
    );
    const state = async (status) =>
      waitForExpression(
        page,
        `document.querySelector('[data-staff-workbench-state=READY]') && document.querySelector('[data-staff-task-status=${status}]')`,
        "任务状态必须是" + status,
      );
    const action = async (name) =>
      clickParentControl(page, `[data-staff-workbench-action="${name}"]`);
    await state("ASSIGNED");
    const point = await action("claim");
    await claimArrived;
    for (const type of ["mousePressed", "mouseReleased"])
      await page.send("Input.dispatchMouseEvent", {
        type,
        button: "left",
        clickCount: 2,
        ...point,
      });
    releaseClaim();
    await state("CLAIMED");
    assert.equal(
      requests.filter((row) => row.method === "POST" && row.path.endsWith("/claim")).length,
      1,
      "真实快速双击只发出一次领取",
    );
    for (const [result, index] of [
      ["FOLLOW_UP_REQUIRED", 1],
      ["BLOCKED", 2],
    ]) {
      await action("start");
      await state("IN_PROGRESS");
      await clickParentControl(page, "[data-staff-workbench-result]");
      for (const [key, keyCode] of [
        ["Home", 36],
        ...Array.from({ length: index }, () => ["ArrowDown", 40]),
        ["Enter", 13],
      ])
        for (const type of ["keyDown", "keyUp"])
          await page.send("Input.dispatchKeyEvent", {
            type,
            key,
            code: key,
            windowsVirtualKeyCode: keyCode,
            nativeVirtualKeyCode: keyCode,
          });
      assert.equal(
        await evaluate(page, "document.querySelector('[data-staff-workbench-result]').value"),
        result,
      );
      await action("complete");
      await state("COMPLETED");
      const current = (await ownerRequest("/admin/tasks")).tasks.find((row) => row.id === task.id);
      await ownerRequest(`/admin/tasks/${task.id}/check`, {
        version: current.version,
        action: result === "BLOCKED" ? "CONFIRM" : "RETURN",
      });
      await clickParentControl(page, "[data-staff-workbench-refresh]");
      await state(result === "BLOCKED" ? "CHECKED" : "RETURNED");
      if (result !== "BLOCKED") {
        await action("claim");
        await state("CLAIMED");
      }
    }
    assert.equal(
      await evaluate(page, "document.querySelectorAll('[data-staff-workbench-action]').length"),
      0,
    );
    const html = await evaluate(
      page,
      "document.querySelector('[data-staff-workbench-task]').outerHTML",
    );
    assert.doesNotMatch(html, /tenantId|campusId|classId|assigneeId|createdBy|synthetic/);
    assert.equal(html.includes(task.id), false);
    assert.match(html, /暂时受阻/u);
    failRead = true;
    await clickParentControl(page, "[data-staff-workbench-refresh]");
    await waitForExpression(
      page,
      "document.querySelector('[data-staff-workbench-state=ERROR]')",
      "服务故障必须清空旧记录",
    );
    assert.equal(
      await evaluate(page, "document.querySelectorAll('[data-staff-workbench-task]').length"),
      0,
    );
    const writes = requests.filter(
      (row) => row.method === "POST" && row.path.startsWith("/api-local/staff/tasks/"),
    ).length;
    await clickParentControl(page, "[data-staff-workbench-refresh]");
    await state("CHECKED");
    assert.equal(
      requests.filter(
        (row) => row.method === "POST" && row.path.startsWith("/api-local/staff/tasks/"),
      ).length,
      writes,
      "重连不得重放写入",
    );
    for (const width of [1365, 390, 320]) {
      await page.send("Emulation.setDeviceMetricsOverride", {
        width,
        height: 950,
        deviceScaleFactor: 1,
        mobile: width < 600,
      });
      const layout = await evaluate(
        page,
        "({width:innerWidth,doc:document.documentElement.scrollWidth,body:document.body.scrollWidth})",
      );
      assert.equal(layout.width, width);
      assert.ok(layout.doc <= width && layout.body <= width);
      await evaluate(
        page,
        "window.getSelection()?.removeAllRanges(); document.activeElement?.blur(); window.scrollTo(0,0)",
      );
      if (width !== 320) await capture(page, resolve(artifacts, `staff-tasks-${width}.png`), true);
    }
    assert.deepEqual(
      await evaluate(
        page,
        "({local:Object.keys(localStorage),session:Object.keys(sessionStorage)})",
      ),
      { local: [], session: [] },
    );
    assert.deepEqual(failures, [
      { path: "/api-local/me", status: 401 },
      { path: "/api-local/staff/tasks", status: 503 },
    ]);
    assert.deepEqual(
      requests.filter(
        (row) =>
          row.origin !== browser.baseUrl ||
          row.hasAuthorization ||
          row.path.startsWith("/staff-local/") ||
          row.path.startsWith("/local/"),
      ),
      [],
    );
    assert.deepEqual(errors, []);
  },
);
