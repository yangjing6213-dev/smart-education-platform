/* global AbortSignal, Buffer, clearTimeout, fetch, process, setTimeout, URL, WebSocket */

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, mkdtemp, mkdir, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  capture,
  clickParentControl,
  evaluate,
  navigate,
  waitForExpression,
} from "./helpers/user-web-next-browser.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const taskArtifactRoot = resolve(
  repositoryRoot,
  process.env.USER_WEB_E2E_ARTIFACT_ROOT ??
    "artifacts/task20-a1-131-staff-workbench-invite-auth-and-scope-20261019",
);
const taskArtifactRelative = relative(resolve(repositoryRoot, "artifacts"), taskArtifactRoot);
assert.ok(
  taskArtifactRelative &&
    !taskArtifactRelative.startsWith("..") &&
    !isAbsolute(taskArtifactRelative),
  "回归工件只能写入当前工作树的 artifacts 子目录。",
);
const screenshotPath = join(taskArtifactRoot, "browser/staff-workbench-invite-flow.png");
const ids = {
  tenant: "00000000-0000-4000-8000-000000000064",
  campus: "00000000-0000-4000-8000-000000000065",
  class: "00000000-0000-4000-8000-000000000066",
  parent: "00000000-0000-4000-8000-000000000001",
  staff: "00000000-0000-4000-8000-000000000003",
  application: "00000000-0000-4000-8000-000000000101",
  relationship: "00000000-0000-4000-8000-000000000102",
  student: "00000000-0000-4000-8000-0000000000c8",
  task: "00000000-0000-4000-8000-000000000201",
};
const tokens = { parent: "p".repeat(43), staff: "s".repeat(43) };
const accounts = {
  parent: { username: "parent-demo", password: "local-only-password" },
  staff: { username: "staff-demo", password: "local-only-password" },
};
const time = "2026-10-19T04:00:00.000Z";

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : undefined;
}

function reply(response, status, body) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(body));
}

function taskRow(state) {
  return {
    id: ids.task,
    version: state.version,
    code: "DAILY_CHECK",
    targetType: "CLASS",
    dueDate: "2026-10-20",
    priority: "NORMAL",
    status: state.status,
    result: state.result,
    updatedAt: time,
    title: "完成班级日常检查",
    assigneeLabel: "示例教师甲",
    creatorLabel: "示例负责人甲",
    checkerLabel: null,
    targetLabel: "示例一班",
    overdue: false,
    actions: { ASSIGNED: ["claim"], CLAIMED: ["start"], IN_PROGRESS: ["complete"], COMPLETED: [] }[
      state.status
    ],
  };
}

async function createSyntheticApi() {
  const requests = [];
  const task = { version: 1, status: "ASSIGNED", claimedBy: null, completedBy: null, result: null };
  let application;
  const server = createServer(async (request, response) => {
    try {
      const body = await readJson(request);
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      const bearer = /^Bearer ([A-Za-z0-9_-]{40,160})$/u.exec(
        String(request.headers.authorization ?? ""),
      )?.[1];
      const role =
        bearer === tokens.parent ? "parent" : bearer === tokens.staff ? "staff" : undefined;
      requests.push({
        method: request.method,
        path: url.pathname,
        role,
        hasAuthorization: typeof request.headers.authorization === "string",
        body,
      });

      if (url.pathname === "/identity/login" && request.method === "POST") {
        const roleForCredentials = Object.entries(accounts).find(
          ([, account]) =>
            account.username === body?.username && account.password === body?.password,
        )?.[0];
        if (!roleForCredentials)
          return reply(response, 401, { error: { code: "INVALID_CREDENTIALS" } });
        return reply(response, 200, {
          data: {
            access_token: tokens[roleForCredentials],
            token_type: "Bearer",
            expires_at: "2099-01-01T00:00:00.000Z",
          },
        });
      }
      if (url.pathname === "/identity/logout" && request.method === "POST")
        return reply(response, 200, { data: { logged_out: true } });
      if (!role) return reply(response, 401, { error: { code: "UNAUTHENTICATED" } });

      if (url.pathname === "/me" && request.method === "GET") {
        const isParent = role === "parent";
        return reply(response, 200, {
          data: {
            actor_id: isParent ? ids.parent : ids.staff,
            display_name: isParent ? "示例监护人甲" : "示例教师甲",
            memberships: [
              {
                status: "ACTIVE",
                capabilities: isParent
                  ? ["binding:apply", "binding:read"]
                  : ["task:read", "task:claim", "task:start", "task:complete", "binding:review"],
              },
            ],
          },
        });
      }

      if (url.pathname === "/guardian-binding/applications" && request.method === "GET") {
        if (role !== "parent") return reply(response, 403, { error: { code: "FORBIDDEN" } });
        return reply(response, 200, {
          data: application
            ? [
                {
                  id: application.id,
                  student_candidate_ref: application.student_candidate_ref,
                  relationship: "GUARDIAN",
                  status: application.status,
                  version: application.version,
                  submitted_at: application.submitted_at,
                  reviewed_at: application.reviewed_at,
                },
              ]
            : [],
        });
      }
      if (url.pathname === "/guardian-binding/applications" && request.method === "POST") {
        if (
          role !== "parent" ||
          body?.student_candidate_ref !== ids.student ||
          body?.relationship !== "GUARDIAN" ||
          body?.consent !== true
        )
          return reply(response, 403, { error: { code: "FORBIDDEN" } });
        application = {
          id: ids.application,
          student_candidate_ref: ids.student,
          status: "PENDING",
          version: 1,
          submitted_at: time,
          reviewed_at: null,
        };
        return reply(response, 201, {
          data: { ...application, relationship: "GUARDIAN" },
          request_id: "00000000-0000-4000-8000-000000000104",
        });
      }
      if (url.pathname === "/guardian-relationships" && request.method === "GET") {
        if (role !== "parent") return reply(response, 403, { error: { code: "FORBIDDEN" } });
        const relationships =
          application?.status === "APPROVED" && application.reviewed_at
            ? [
                {
                  id: ids.relationship,
                  student_id: ids.student,
                  relationship: "GUARDIAN",
                  status: "ACTIVE",
                  source_application_id: application.id,
                  version: 1,
                  approved_at: application.reviewed_at,
                },
              ]
            : [];
        return reply(response, 200, { data: relationships });
      }
      if (url.pathname === "/parent/student-options" && request.method === "GET") {
        if (role !== "parent") return reply(response, 403, { error: { code: "FORBIDDEN" } });
        return reply(response, 200, {
          data: [{ id: ids.student, alias: "student-alpha", label: "示例学生甲" }],
        });
      }
      if (url.pathname === "/consent-policies" && request.method === "GET") {
        if (role !== "parent") return reply(response, 403, { error: { code: "FORBIDDEN" } });
        return reply(response, 200, {
          data: ["CARE_RECORD", "HEALTH_SUPPORT", "LEARNING_SUPPORT"].map((key) => ({
            key,
            title: key,
            noticeVersion: `${key}_NOTICE_V1`,
            necessity: "合成用途说明",
            dataClasses: ["合成成长记录"],
            retentionDays: 90,
            retentionNotice: "仅用于本地浏览器验证",
            impactReviewStatus: "DEMO_ONLY_PENDING_HUMAN_REVIEW",
          })),
        });
      }
      if (url.pathname === "/consents" && request.method === "GET") {
        if (role !== "parent") return reply(response, 403, { error: { code: "FORBIDDEN" } });
        return reply(response, 200, { data: [] });
      }
      if (url.pathname === "/privacy-requests" && request.method === "GET") {
        if (role !== "parent" || application?.status !== "APPROVED")
          return reply(response, 403, { error: { code: "FORBIDDEN" } });
        return reply(response, 200, { data: [] });
      }

      if (url.pathname === "/staff/tasks" && request.method === "GET") {
        if (role !== "staff") return reply(response, 403, { error: { code: "FORBIDDEN" } });
        return reply(response, 200, {
          data: {
            tasks: [taskRow(task)],
          },
        });
      }
      const taskAction = /^\/staff\/tasks\/([0-9a-f-]{36})\/(claim|start|complete)$/iu.exec(
        url.pathname,
      );
      if (taskAction && request.method === "POST") {
        if (role !== "staff" || taskAction[1] !== ids.task)
          return reply(response, 403, { error: { code: "FORBIDDEN" } });
        if (body?.version !== task.version)
          return reply(response, 409, { error: { code: "VERSION_CONFLICT" } });
        if (taskAction[2] === "claim" && task.status === "ASSIGNED") {
          task.status = "CLAIMED";
          task.claimedBy = ids.staff;
        } else if (taskAction[2] === "start" && task.status === "CLAIMED") {
          task.status = "IN_PROGRESS";
        } else if (
          taskAction[2] === "complete" &&
          task.status === "IN_PROGRESS" &&
          body?.result === "COMPLETED_AS_PLANNED"
        ) {
          task.status = "COMPLETED";
          task.completedBy = ids.staff;
          task.result = body.result;
        } else {
          return reply(response, 403, { error: { code: "FORBIDDEN" } });
        }
        task.version += 1;
        return reply(response, 200, { data: taskRow(task) });
      }

      if (url.pathname === "/staff/guardian-binding/applications" && request.method === "GET") {
        if (role !== "staff") return reply(response, 403, { error: { code: "FORBIDDEN" } });
        return reply(response, 200, {
          data:
            application?.status === "PENDING"
              ? [
                  {
                    id: application.id,
                    relationship: "GUARDIAN",
                    status: application.status,
                    version: application.version,
                    submitted_at: application.submitted_at,
                    reviewed_at: application.reviewed_at,
                    applicant_label: "示例监护人甲",
                    student_label: "示例学生甲",
                  },
                ]
              : [],
        });
      }
      const review = /^\/staff\/guardian-binding\/applications\/([0-9a-f-]{36})\/review$/iu.exec(
        url.pathname,
      );
      if (review && request.method === "POST") {
        if (
          role !== "staff" ||
          !application ||
          review[1] !== application.id ||
          application.status !== "PENDING" ||
          body?.version !== application.version ||
          !["approve", "reject"].includes(body?.action)
        )
          return reply(response, 403, { error: { code: "FORBIDDEN" } });
        application.status = body.action === "approve" ? "APPROVED" : "REJECTED";
        application.version += 1;
        application.reviewed_at = "2026-10-19T04:05:00.000Z";
        return reply(response, 200, { data: { ...application, relationship: "GUARDIAN" } });
      }

      return reply(response, 404, { error: { code: "NOT_FOUND" } });
    } catch {
      return reply(response, 500, { error: { code: "TEST_SERVER_ERROR" } });
    }
  });
  await new Promise((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolvePromise);
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return {
    url: `http://127.0.0.1:${address.port}`,
    requests,
    close: () =>
      new Promise((resolvePromise, reject) =>
        server.close((error) => (error ? reject(error) : resolvePromise())),
      ),
  };
}

async function freePort() {
  const server = createNetServer();
  await new Promise((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolvePromise);
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const port = address.port;
  await new Promise((resolvePromise, reject) =>
    server.close((error) => (error ? reject(error) : resolvePromise())),
  );
  return port;
}

async function waitForHttp(url, child, readOutput) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (child.exitCode !== null) throw new Error("本地网页启动失败：\n" + readOutput());
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1500) });
      if (response.ok) return response;
    } catch {
      await delay(150);
    }
  }
  throw new Error("本地网页没有启动：\n" + readOutput());
}

async function waitForJson(url) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return await response.json();
    } catch {
      await delay(100);
    }
  }
  throw new Error("本机浏览器调试接口没有启动。");
}

function connectCdp(url, onEvent = () => {}) {
  const socket = new WebSocket(url);
  const pending = new Map();
  let nextId = 0;
  const ready = new Promise((resolvePromise, reject) => {
    socket.addEventListener("open", resolvePromise, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if (message.method) onEvent(message.method, message.params ?? {});
    if (message.id !== undefined && pending.has(message.id)) {
      const wait = pending.get(message.id);
      pending.delete(message.id);
      clearTimeout(wait.timer);
      if (message.error) wait.reject(new Error(message.error.message));
      else wait.resolve(message.result ?? {});
    }
  });
  socket.addEventListener("close", () => {
    for (const wait of pending.values()) wait.reject(new Error("浏览器调试连接已关闭。"));
    pending.clear();
  });
  return {
    ready,
    send(method, params = {}) {
      const id = ++nextId;
      return new Promise((resolvePromise, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error("浏览器操作超时：" + method));
        }, 12000);
        pending.set(id, { resolve: resolvePromise, reject, timer });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
    close() {
      socket.close();
    },
  };
}

async function startBrowser(t, apiUrl, onPageEvent = () => {}) {
  const packageRoot = resolve(repositoryRoot, "apps/user-web");
  const browserCandidates = [
    process.env.USER_WEB_BROWSER,
    process.env["PROGRAMFILES(X86)"] &&
      join(process.env["PROGRAMFILES(X86)"], "Microsoft/Edge/Application/msedge.exe"),
    process.env.PROGRAMFILES &&
      join(process.env.PROGRAMFILES, "Google/Chrome/Application/chrome.exe"),
  ].filter(Boolean);
  let browserPath;
  for (const candidate of browserCandidates) {
    try {
      await access(candidate);
      browserPath = candidate;
      break;
    } catch {
      /* try the next installed browser */
    }
  }
  assert.ok(browserPath, "需要本机已安装 Edge 或 Chrome 才能执行浏览器复核。");
  const nextCli = resolve(packageRoot, "node_modules/next/dist/bin/next");
  await access(nextCli);
  const nextPort = await freePort();
  const baseUrl = `http://127.0.0.1:${nextPort}`;
  const nextProcess = spawn(
    process.execPath,
    [nextCli, "start", "--hostname", "127.0.0.1", "--port", String(nextPort)],
    {
      cwd: packageRoot,
      windowsHide: true,
      env: {
        ...process.env,
        CI: "1",
        NEXT_TELEMETRY_DISABLED: "1",
        TASK20_NEXT_DIST_DIR: process.env.TASK20_NEXT_DIST_DIR ?? ".next-task20-a1-131",
        USER_WEB_LOCAL_NEST_API: apiUrl,
        USER_WEB_LOCAL_PREVIEW: "true",
        USER_WEB_NEST_API_BASE_URL: "",
        USER_WEB_LOCAL_SYNTHETIC_API: "",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let nextOutput = "";
  nextProcess.stdout.on("data", (chunk) => {
    nextOutput += chunk.toString("utf8");
  });
  nextProcess.stderr.on("data", (chunk) => {
    nextOutput += chunk.toString("utf8");
  });
  let browserProcess;
  let browserCdp;
  let pageCdp;
  let profilePath;
  const tempRoot = resolve(tmpdir());
  const profilePrefix = "task20-a1-131-browser-";
  try {
    await waitForHttp(baseUrl + "/web/visitor/home", nextProcess, () => nextOutput);
    const browserPort = await freePort();
    profilePath = await mkdtemp(join(tempRoot, profilePrefix));
    browserProcess = spawn(
      browserPath,
      [
        "--headless=new",
        "--disable-gpu",
        "--no-first-run",
        "--no-default-browser-check",
        "--remote-debugging-address=127.0.0.1",
        "--remote-allow-origins=*",
        "--remote-debugging-port=" + browserPort,
        "--user-data-dir=" + profilePath,
        "about:blank",
      ],
      { stdio: "ignore", windowsHide: true },
    );
    const browserVersion = await waitForJson(`http://127.0.0.1:${browserPort}/json/version`);
    browserCdp = connectCdp(browserVersion.webSocketDebuggerUrl);
    await browserCdp.ready;
    let target;
    for (let attempt = 0; attempt < 80; attempt += 1) {
      const targets = await waitForJson(`http://127.0.0.1:${browserPort}/json/list`);
      target = targets.find((item) => item.type === "page");
      if (target?.webSocketDebuggerUrl) break;
      await delay(100);
    }
    assert.ok(target?.webSocketDebuggerUrl, "浏览器没有创建页面。");
    pageCdp = connectCdp(target.webSocketDebuggerUrl, (method, params) =>
      onPageEvent(method, params, pageCdp),
    );
    await pageCdp.ready;
    await pageCdp.send("Page.enable");
    await pageCdp.send("Runtime.enable");
    await pageCdp.send("Network.enable");
  } catch (error) {
    pageCdp?.close();
    browserCdp?.close();
    browserProcess?.kill();
    nextProcess.kill();
    throw error;
  }
  t.after(async () => {
    pageCdp?.close();
    if (browserCdp) {
      try {
        await browserCdp.send("Browser.close");
      } catch {
        browserCdp.close();
      }
    }
    for (const child of [browserProcess, nextProcess]) {
      if (child.exitCode === null) {
        child.kill();
        await Promise.race([
          new Promise((resolvePromise) => child.once("exit", resolvePromise)),
          delay(4000),
        ]);
        if (child.exitCode === null) child.kill("SIGKILL");
      }
    }
    if (profilePath) {
      const resolved = resolve(profilePath);
      assert.equal(dirname(resolved), tempRoot);
      assert.ok(basename(resolved).startsWith(profilePrefix));
      await rm(resolved, { recursive: true, force: true });
    }
  });
  return { baseUrl, page: pageCdp };
}

async function enterCredentials(page, account) {
  await waitForExpression(
    page,
    "document.querySelector('[data-invite-state]')?.dataset.inviteState==='IDLE'",
    "邀请账号登录表单应可用。",
  );
  await evaluate(
    page,
    `(() => { const set=(selector,value)=>{const el=document.querySelector(selector);const setter=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el),'value').set;setter.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));};set('[name=username]',${JSON.stringify(account.username)});set('[name=password]',${JSON.stringify(account.password)});})()`,
  );
  await clickParentControl(page, "[data-invite-submit]");
}

async function logout(page, baseUrl) {
  await navigate(page, baseUrl + "/web/login", "document.querySelector('[data-invite-state]')");
  await waitForExpression(
    page,
    "document.querySelector('[data-invite-state]')?.dataset.inviteState==='READY'",
    "当前受邀账号应恢复登录状态。",
  );
  await clickParentControl(page, "[data-invite-logout]");
  await waitForExpression(
    page,
    "document.querySelector('[data-invite-state]')?.dataset.inviteState==='IDLE'",
    "退出后应清除当前邀请登录状态。",
  );
}

test("invited parent and staff complete relationship review and task lifecycle in the browser", async (t) => {
  const api = await createSyntheticApi();
  await mkdir(dirname(screenshotPath), { recursive: true });
  t.after(async () => api.close());
  const browserRequests = [];
  const pageErrors = [];
  const { baseUrl, page: instrumented } = await startBrowser(t, api.url, (method, params) => {
    if (method === "Runtime.exceptionThrown")
      pageErrors.push(params.exceptionDetails?.text ?? "网页脚本异常");
    if (method === "Network.requestWillBeSent") {
      browserRequests.push(params.request);
    }
  });
  await navigate(
    instrumented,
    baseUrl + "/web/login?next=%2Fweb%2Fparent%2Fbinding",
    "document.querySelector('[data-invite-state]')",
  );
  await enterCredentials(instrumented, accounts.parent);
  await waitForExpression(
    instrumented,
    "location.pathname==='/web/parent/binding'&&document.querySelector('[data-parent-binding-state=READY]')",
    "家长登录后应进入关系申请页面。",
  );
  await clickParentControl(instrumented, "[data-parent-binding-submit]");
  await waitForExpression(
    instrumented,
    "document.querySelector('[data-binding-status=PENDING]')",
    "家长申请应出现在待审核状态。",
  );

  const denied = await evaluate(
    instrumented,
    `(async()=>{const task=await fetch('/api-local/staff/tasks',{credentials:'same-origin'});const binding=await fetch('/api-local/staff/guardian-binding/applications',{credentials:'same-origin'});return{task:task.status,binding:binding.status}})()`,
  );
  assert.deepEqual(denied, { task: 403, binding: 403 }, "家长账号不得读取员工任务或审核队列。");

  await logout(instrumented, baseUrl);
  await navigate(
    instrumented,
    baseUrl + "/web/login?next=%2Fweb%2Fstaff%2Fworkbench",
    "document.querySelector('[data-invite-state]')",
  );
  await enterCredentials(instrumented, accounts.staff);
  await waitForExpression(
    instrumented,
    "location.pathname==='/web/staff/workbench'&&document.querySelector('[data-staff-workbench-state=READY]')",
    "员工登录后应进入工作台并看到分配任务。",
  );
  assert.ok(
    await evaluate(
      instrumented,
      "Boolean(document.querySelector('[data-staff-workbench-state=READY] a[href=\"/web/staff/binding\"]'))",
    ),
    "有审核权限的员工应看到关系审核入口。",
  );

  await clickParentControl(instrumented, "[data-staff-workbench-action=claim]");
  await waitForExpression(
    instrumented,
    "document.querySelector('[data-staff-task-status=CLAIMED]')",
    "员工应能领取自己的任务。",
  );
  await clickParentControl(instrumented, "[data-staff-workbench-action=start]");
  await waitForExpression(
    instrumented,
    "document.querySelector('[data-staff-task-status=IN_PROGRESS]')",
    "员工应能开始已领取的任务。",
  );
  await clickParentControl(instrumented, "[data-staff-workbench-action=complete]");
  await waitForExpression(
    instrumented,
    "document.querySelector('[data-staff-task-status=COMPLETED]')",
    "员工应能提交固定选项完成结果。",
  );

  await clickParentControl(
    instrumented,
    '[data-staff-workbench-state=READY] a[href="/web/staff/binding"]',
  );
  await waitForExpression(
    instrumented,
    "location.pathname==='/web/staff/binding'&&document.querySelector('[data-staff-binding-state=READY]')",
    "员工应能打开关系审核页面。",
  );
  assert.equal(
    await evaluate(
      instrumented,
      "document.querySelectorAll('[data-staff-binding-application]').length",
    ),
    1,
  );
  await evaluate(
    instrumented,
    "document.activeElement instanceof HTMLElement && document.activeElement.blur(); window.scrollTo(0,0)",
  );
  await capture(instrumented, screenshotPath, true);
  await clickParentControl(instrumented, "[data-staff-binding-action=approve]");
  await waitForExpression(
    instrumented,
    "document.querySelector('[data-staff-binding-state=READY]')&&document.querySelectorAll('[data-staff-binding-application]').length===0",
    "批准后待审核队列应更新。",
  );

  await logout(instrumented, baseUrl);
  await navigate(
    instrumented,
    baseUrl + "/web/login?next=%2Fweb%2Fparent%2Fbinding",
    "document.querySelector('[data-invite-state]')",
  );
  await enterCredentials(instrumented, accounts.parent);
  await waitForExpression(
    instrumented,
    "location.pathname==='/web/parent/binding'&&document.querySelector('[data-binding-status=APPROVED]')",
    "家长重新登录后应看到审核通过的关系。",
  );
  assert.ok(
    await evaluate(
      instrumented,
      "document.querySelector('[data-parent-binding-state]').innerText.includes('监护关系已确认')",
    ),
  );
  const safeLogin = await evaluate(
    instrumented,
    `(async()=>{const response=await fetch('/api-local/identity/login',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(${JSON.stringify(accounts.staff)})});return{status:response.status,body:await response.json()}})()`,
  );
  assert.equal(safeLogin.status, 200, "同源登录代理应接受合成邀请账号。");
  assert.equal("access_token" in safeLogin.body.data, false, "页面登录响应不得暴露访问令牌。");

  assert.deepEqual(pageErrors, [], "页面运行期间不能出现未处理的脚本错误。");
  for (const request of browserRequests) {
    assert.equal(new URL(request.url).origin, baseUrl, "浏览器请求必须留在本机网页同源地址。");
    assert.equal(
      Object.keys(request.headers ?? {}).some((key) => key.toLowerCase() === "authorization"),
      false,
      "浏览器请求不能携带 Bearer 身份头。",
    );
    if (new URL(request.url).pathname.startsWith("/api-local/")) {
      const body = request.postData ?? "";
      assert.doesNotMatch(
        body,
        /(?:actor|tenant|campus|class)_?id|profile|access_token/iu,
        "浏览器不得提交身份、校区范围或令牌字段。",
      );
    }
  }
  assert.ok(
    api.requests.some((request) => request.path === "/staff/tasks" && request.role === "parent"),
    "应实际验证家长读取员工任务被拒绝。",
  );
  assert.ok(
    api.requests.some(
      (request) =>
        request.path === "/staff/guardian-binding/applications" && request.role === "parent",
    ),
    "应实际验证家长读取员工审核队列被拒绝。",
  );
  assert.ok(
    api.requests.some((request) => request.path === "/staff/tasks" && request.role === "staff"),
    "员工工作台应从受邀账号读取任务。",
  );
  assert.ok(
    api.requests.some((request) => request.path.endsWith("/review") && request.role === "staff"),
    "员工应提交有版本号的关系审核。",
  );
  assert.ok(
    api.requests.filter((request) => request.role).every((request) => request.hasAuthorization),
    "只有网页服务端代理能把 HttpOnly 邀请会话转换为上游身份。",
  );
});
