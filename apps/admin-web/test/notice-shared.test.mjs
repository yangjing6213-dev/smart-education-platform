import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { once } from "node:events";
import { resolve } from "node:path";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";
import { chromium } from "playwright";
import { proxyReview } from "../src/local-proxy.mjs";
import {
  NOTICE_REVIEW_ROUTE,
  NoticeReviewClient,
  createLocalNoticeReviewTransport,
  renderAdminNoticeReview,
} from "../dist/local-review/notice-shared.js";
import test from "node:test";

const owner = {
  mode: "local-synthetic",
  profile: "owner-east",
  label: "示例东校区负责人",
  actorId: "00000000-0000-4000-8000-000000000004",
  tenantId: "00000000-0000-4000-8000-000000000100",
  campusId: "00000000-0000-4000-8000-000000000101",
  classIds: ["00000000-0000-4000-8000-000000000103"],
  actions: ["notice:review", "notice:publish", "notice:revoke"],
};
const initialNotice = {
  id: "00000000-0000-4000-8000-000000000701",
  version: 2,
  status: "SUBMITTED",
  published: false,
  title: "班级活动",
  body: "本周班级活动安排合成内容，请以页面展示为准。",
  target: "CLASS",
  classId: owner.classIds[0],
  requiresAcknowledgment: true,
  receiptStatus: "UNREAD",
  synthetic: true,
  template: "CLASS_ACTIVITY",
  authorId: "00000000-0000-4000-8000-000000000003",
  authorLabel: "示例东校区教师",
  updatedAt: "2026-10-10T08:00:00.000Z",
};

function noticeFixture() {
  let row = globalThis.structuredClone(initialNotice);
  const calls = [];
  const transport = async (input, init = {}) => {
    const url = new URL(input, "http://127.0.0.1:4317");
    calls.push({ url, ...init });
    if (url.pathname === "/local/sessions") return json({ handle: "a".repeat(43) });
    if (url.pathname === "/local/session") return json(owner);
    if (url.pathname === "/local/notice-review")
      return json(row.status === "SUBMITTED" ? [row] : []);
    if (url.pathname === "/local/notice-owned") return json([row]);
    const action = url.pathname.split("/").at(-1);
    if (action === "review") {
      const body = JSON.parse(init.body);
      row = {
        ...row,
        version: body.version + 1,
        status: body.action === "CONFIRM" ? "CONFIRMED" : "RETURNED",
      };
      return json(row);
    }
    if (action === "publish") {
      row = {
        ...row,
        version: JSON.parse(init.body).version + 1,
        status: "PUBLISHED",
        published: true,
      };
      return json(row);
    }
    if (action === "revoke") {
      row = {
        ...row,
        version: JSON.parse(init.body).version + 1,
        status: "REVOKED",
        published: false,
      };
      return json(row);
    }
    return json({}, 404);
  };
  return {
    transport,
    calls,
    get row() {
      return row;
    },
  };
}

function json(value, status = 200) {
  return new globalThis.Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("Admin preview proxies only the notice review and publication commands", async (t) => {
  const received = [];
  const upstream = createServer((request, response) => {
    received.push(`${request.method} ${request.url}`);
    response.writeHead(200, { "content-type": "application/json" });
    response.end("[]");
  });
  upstream.listen(0, "127.0.0.1");
  await once(upstream, "listening");
  const servicePort = upstream.address().port;
  let preview;
  preview = createServer((request, response) =>
    proxyReview(request, response, preview.address().port, servicePort),
  );
  preview.listen(0, "127.0.0.1");
  await once(preview, "listening");
  const baseUrl = `http://127.0.0.1:${preview.address().port}`;
  t.after(async () => {
    await Promise.all(
      [preview, upstream].map(
        (server) =>
          new Promise((resolve, reject) =>
            server.close((error) => (error ? reject(error) : resolve())),
          ),
      ),
    );
  });

  const queue = await globalThis.fetch(`${baseUrl}/local/notice-review`);
  assert.equal(queue.status, 200);
  const owned = await globalThis.fetch(`${baseUrl}/local/notice-owned`);
  assert.equal(owned.status, 200);
  const forbidden = await globalThis.fetch(
    `${baseUrl}/local/notices/00000000-0000-4000-8000-000000000123/submit`,
    {
      method: "POST",
      headers: { origin: baseUrl, "content-type": "application/json" },
      body: JSON.stringify({ version: 1 }),
    },
  );
  assert.equal(forbidden.status, 404);
  assert.deepEqual(received, ["GET /local/notice-review", "GET /local/notice-owned"]);
});

test("负责人可按版本审核、发布和撤回同一条通知，过期版本不会写入", async () => {
  const fixture = noticeFixture();
  const client = new NoticeReviewClient(fixture.transport);
  await client.connect();
  assert.equal(NOTICE_REVIEW_ROUTE, "/admin/notice-review");
  assert.equal(client.snapshot.queue[0]?.id, initialNotice.id);
  assert.match(renderAdminNoticeReview(client.snapshot), /待审核通知/u);
  assert.match(renderAdminNoticeReview(client.snapshot), /确认通过/u);
  assert.doesNotMatch(renderAdminNoticeReview(client.snapshot, false), /data-notice-action/u);

  await client.command(initialNotice.id, 2, "CONFIRM");
  assert.equal(client.snapshot.history[0]?.status, "CONFIRMED");
  assert.equal(client.snapshot.history[0]?.version, 3);
  assert.match(renderAdminNoticeReview(client.snapshot), /发布给家长/u);
  const writes = fixture.calls.filter((call) => call.method === "POST").length;
  await client.command(initialNotice.id, 2, "PUBLISH");
  assert.equal(fixture.calls.filter((call) => call.method === "POST").length, writes);

  await client.command(initialNotice.id, 3, "PUBLISH");
  assert.equal(client.snapshot.history[0]?.status, "PUBLISHED");
  assert.equal(client.snapshot.history[0]?.version, 4);
  await client.command(initialNotice.id, 4, "REVOKE");
  assert.equal(client.snapshot.history[0]?.status, "REVOKED");
  assert.equal(client.snapshot.history[0]?.version, 5);
  assert.deepEqual(
    fixture.calls
      .filter((call) => call.method === "POST" && call.url.pathname.includes("/notices/"))
      .map((call) => [call.url.pathname.split("/").at(-1), JSON.parse(call.body)]),
    [
      ["review", { version: 2, action: "CONFIRM" }],
      ["publish", { version: 3 }],
      ["revoke", { version: 4 }],
    ],
  );
  assert.ok(
    fixture.calls.every(
      (call) =>
        call.credentials === "omit" && call.redirect === "error" && call.cache === "no-store",
    ),
  );
});

test("负责人可以按当前版本退回待审核通知", async () => {
  const fixture = noticeFixture();
  const client = new NoticeReviewClient(fixture.transport);
  await client.connect();
  await client.command(initialNotice.id, initialNotice.version, "RETURN");
  assert.equal(client.snapshot.history[0]?.status, "RETURNED");
  assert.equal(client.snapshot.history[0]?.version, initialNotice.version + 1);
  assert.deepEqual(
    JSON.parse(fixture.calls.find((call) => call.url.pathname.endsWith("/review")).body),
    { version: initialNotice.version, action: "RETURN" },
  );
});

test("越出负责人班级范围的服务端通知会清空页面且不提供操作", async () => {
  const outside = {
    ...initialNotice,
    status: "CONFIRMED",
    version: 3,
    classId: "00000000-0000-4000-8000-000000000199",
  };
  const transport = async (input) => {
    const url = new URL(input, "http://127.0.0.1:4317");
    if (url.pathname === "/local/sessions") return json({ handle: "c".repeat(43) });
    if (url.pathname === "/local/session") return json(owner);
    if (url.pathname === "/local/notice-review") return json([]);
    if (url.pathname === "/local/notice-owned") return json([outside]);
    return json({}, 404);
  };
  const client = new NoticeReviewClient(transport);
  await client.connect();
  assert.equal(client.snapshot.status, "ERROR");
  assert.deepEqual(client.snapshot.queue, []);
  assert.deepEqual(client.snapshot.history, []);
  assert.doesNotMatch(renderAdminNoticeReview(client.snapshot), /data-notice-action/u);
});

test("通知审核传输拒绝外部地址、查询参数和员工提交路径", async () => {
  const targets = [];
  const transport = createLocalNoticeReviewTransport("http://127.0.0.1:4317", async (input) => {
    targets.push(input);
    return json({});
  });
  assert.equal((await transport("https://example.com/local/notice-review")).status, 403);
  assert.equal((await transport("/local/notice-review?profile=owner-east")).status, 403);
  assert.equal(
    (
      await transport("/local/notices/00000000-0000-4000-8000-000000000701/submit", {
        method: "POST",
      })
    ).status,
    403,
  );
  assert.deepEqual(targets, []);
  assert.throws(() => createLocalNoticeReviewTransport("https://example.com"), /本机服务/u);
});

test("通知审核页可在 Admin 浏览器中完成通过、发布、撤回点击", async (t) => {
  let row = globalThis.structuredClone(initialNotice);
  const upstream = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = chunks.length ? JSON.parse(globalThis.Buffer.concat(chunks).toString("utf8")) : {};
    let result;
    if (request.url === "/local/sessions") result = { handle: "b".repeat(43) };
    else if (request.url === "/local/session") result = owner;
    else if (request.url === "/local/notice-review")
      result = row.status === "SUBMITTED" ? [row] : [];
    else if (request.url === "/local/notice-owned") result = [row];
    else if (request.url?.endsWith("/review")) {
      row = {
        ...row,
        version: body.version + 1,
        status: body.action === "CONFIRM" ? "CONFIRMED" : "RETURNED",
      };
      result = row;
    } else if (request.url?.endsWith("/publish")) {
      row = {
        ...row,
        version: body.version + 1,
        status: "PUBLISHED",
        published: true,
      };
      result = row;
    } else if (request.url?.endsWith("/revoke")) {
      row = {
        ...row,
        version: body.version + 1,
        status: "REVOKED",
        published: false,
      };
      result = row;
    } else {
      response.writeHead(404);
      response.end("{}");
      return;
    }
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(result));
  });
  upstream.listen(0, "127.0.0.1");
  await once(upstream, "listening");
  const preview = spawn(
    process.execPath,
    [
      resolve(fileURLToPath(new URL("../", import.meta.url)), "preview.mjs"),
      "--local-service-port",
      String(upstream.address().port),
    ],
    {
      cwd: fileURLToPath(new URL("../", import.meta.url)),
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let output = "";
  let errors = "";
  const baseUrl = await new Promise((resolveStartup, reject) => {
    const timeout = globalThis.setTimeout(
      () => reject(new Error(`Admin preview startup timed out. ${errors}`)),
      8000,
    );
    preview.stdout.on("data", (chunk) => {
      output += chunk.toString("utf8");
      for (const line of output.split(/\r?\n/u)) {
        try {
          const event = JSON.parse(line);
          if (event.event === "startup" && event.baseUrl) {
            globalThis.clearTimeout(timeout);
            resolveStartup(event.baseUrl);
          }
        } catch {
          // Wait for a complete startup line.
        }
      }
      output = output.slice(output.lastIndexOf("\n") + 1);
    });
    preview.stderr.on("data", (chunk) => {
      errors += chunk.toString("utf8");
    });
    preview.once("error", (error) => {
      globalThis.clearTimeout(timeout);
      reject(error);
    });
    preview.once("exit", (code) => {
      globalThis.clearTimeout(timeout);
      reject(new Error(`Admin preview exited (${code}). ${errors}`));
    });
  });
  const browser = await chromium.launch({ headless: true });
  t.after(async () => {
    await browser.close();
    if (preview.exitCode === null) {
      preview.kill("SIGTERM");
      await Promise.race([
        once(preview, "exit"),
        new Promise((resolveExit) => globalThis.setTimeout(resolveExit, 2500)),
      ]);
      if (preview.exitCode === null) preview.kill();
    }
    await new Promise((resolveClose, reject) =>
      upstream.close((error) => (error ? reject(error) : resolveClose())),
    );
  });
  const page = await browser.newPage({
    viewport: { width: 1365, height: 900 },
  });
  const pageErrors = [];
  const failedRequests = [];
  const externalRequests = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (request) =>
    failedRequests.push(`${request.method()} ${request.url()}`),
  );
  page.on("request", (request) => {
    if (new URL(request.url()).origin !== baseUrl) externalRequests.push(request.url());
  });
  await page.goto(`${baseUrl}/admin/institution`);
  await page.getByRole("button", { name: "通知审核" }).click();
  await page.getByRole("heading", { name: "通知审核与发布" }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "确认通过" }).click();
  await page.getByRole("button", { name: "发布给家长" }).waitFor();
  await page.getByRole("button", { name: "发布给家长" }).click();
  await page.getByRole("button", { name: "撤回发布" }).waitFor();
  await page.getByRole("button", { name: "撤回发布" }).click();
  await page.getByText(/班级活动 · 已撤回/u).waitFor();
  assert.equal(row.status, "REVOKED");
  assert.equal(row.version, 5);
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(failedRequests, []);
  assert.deepEqual(externalRequests, []);
  assert.equal(
    await page.evaluate(
      () =>
        globalThis.document.documentElement.scrollWidth <=
        globalThis.document.documentElement.clientWidth,
    ),
    true,
  );
  await page.setViewportSize({ width: 1365, height: 900 });
  assert.equal(
    await page.evaluate(
      () =>
        globalThis.document.documentElement.scrollWidth <=
        globalThis.document.documentElement.clientWidth,
    ),
    true,
  );
});
