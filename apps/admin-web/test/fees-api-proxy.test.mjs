/* global AbortSignal, Buffer, fetch, process, URL */

import assert from "node:assert/strict";
import { createServer as createHttpServer } from "node:http";
import { spawn } from "node:child_process";
import { createServer as createPortServer } from "node:net";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";

const packageRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const feeId = "00000000-0000-4000-8000-000000000602";
const studentId = "00000000-0000-4000-8000-000000000601";
const session = "a".repeat(43);
const transferRecord = {
  id: feeId,
  studentId,
  studentLabel: "示例学生甲",
  sourceClassRef: "合成甲班",
  destinationClassRef: "合成乙班",
  status: "PENDING",
  version: 1,
  requestedAt: "2026-10-30T08:00:00.000Z",
  reviewedAt: null,
  isOwnRequest: true,
  canReview: false,
  canApprove: false,
  events: [
    { action: "CREATED", actorId: studentId, version: 1, occurredAt: "2026-10-30T08:00:00.000Z" },
  ],
};

async function reservePort() {
  const server = createPortServer();
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

test(
  "same-origin fee proxy validates requests and forwards only to the configured local API",
  { timeout: 120_000 },
  async (t) => {
    const upstreamRequests = [];
    let nextProcess;
    const upstream = createHttpServer(async (request, response) => {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      const rawBody = Buffer.concat(chunks).toString("utf8");
      const body = rawBody ? JSON.parse(rawBody) : undefined;
      upstreamRequests.push({
        method: request.method,
        url: request.url,
        authorization: request.headers.authorization,
        body,
      });
      response.setHeader("content-type", "application/json");
      if (request.method === "GET" && request.url === "/admin/student-transfers") {
        response.end(
          JSON.stringify({
            data: {
              students: [],
              destinationClasses: [],
              requests: [],
              canRequest: true,
              canReview: false,
            },
          }),
        );
        return;
      }
      if (request.method === "POST" && request.url === "/admin/student-transfers") {
        response.statusCode = 201;
        response.end(JSON.stringify({ data: transferRecord }));
        return;
      }
      if (request.method === "POST" && request.url === `/admin/student-transfers/${feeId}/review`) {
        response.end(
          JSON.stringify({
            data: {
              ...transferRecord,
              isOwnRequest: false,
              status: "APPROVED",
              version: 2,
              reviewedAt: "2026-10-30T08:01:00.000Z",
              events: [
                ...transferRecord.events,
                {
                  action: "APPROVED",
                  actorId: feeId,
                  version: 2,
                  occurredAt: "2026-10-30T08:01:00.000Z",
                },
              ],
            },
          }),
        );
        return;
      }
      if (request.method === "GET" && request.url === "/admin/fees") {
        response.end(
          JSON.stringify({
            data: {
              synthetic: true,
              students: [{ id: studentId, label: "示例学生甲" }],
              documents: [],
            },
          }),
        );
        return;
      }
      if (request.method === "POST" && request.url === "/admin/fees") {
        response.statusCode = 201;
        response.end(
          JSON.stringify({
            data: {
              id: feeId,
              version: 1,
              documentType: body.document_type,
              title: body.title,
              studentId: body.student_id,
              studentLabel: "示例学生甲",
              period: body.period,
              amountMinor: body.amount_minor,
              status: "AVAILABLE",
              validFrom: body.valid_from,
              validTo: body.valid_to,
              summary: body.summary,
              synthetic: true,
            },
          }),
        );
        return;
      }
      if (request.method === "POST" && request.url === `/admin/fees/${feeId}/revoke`) {
        response.end(
          JSON.stringify({
            data: { id: feeId, version: 2, status: "REVOKED", synthetic: true },
          }),
        );
        return;
      }
      response.statusCode = 404;
      response.end(JSON.stringify({ error: { code: "NOT_FOUND" } }));
    });
    await new Promise((resolvePromise, rejectPromise) => {
      upstream.once("error", rejectPromise);
      upstream.listen(0, "127.0.0.1", resolvePromise);
    });
    t.after(async () => {
      await stopChild(nextProcess);
      await new Promise((resolvePromise) => upstream.close(resolvePromise));
    });

    const upstreamAddress = upstream.address();
    assert.ok(upstreamAddress && typeof upstreamAddress !== "string");
    const upstreamBase = `http://127.0.0.1:${upstreamAddress.port}`;
    const nextCli = resolve(packageRoot, "node_modules/next/dist/bin/next");
    const port = await reservePort();
    const baseUrl = `http://127.0.0.1:${port}`;
    nextProcess = spawn(
      process.execPath,
      [nextCli, "dev", "--webpack", "--hostname", "127.0.0.1", "--port", String(port)],
      {
        cwd: packageRoot,
        env: {
          ...process.env,
          NEXT_TELEMETRY_DISABLED: "1",
          TASK20_NEXT_DIST_DIR:
            process.env.TASK20_ADMIN_NEXT_DIST_DIR ?? ".next-task20-a1-313-fees",
          ADMIN_WEB_LOCAL_NEST_API: upstreamBase,
          CI: "1",
        },
        stdio: "ignore",
      },
    );

    let ready = false;
    for (let attempt = 0; attempt < 120; attempt += 1) {
      if (nextProcess.exitCode !== null) break;
      try {
        const response = await fetch(`${baseUrl}/api/admin/fees`, {
          headers: { cookie: `student_care_admin_session=${session}` },
          signal: AbortSignal.timeout(1500),
        });
        if (response.status === 200) {
          ready = true;
          break;
        }
      } catch {
        await delay(200);
      }
    }
    assert.equal(ready, true, "Next 管理端的费用代理接口应在本地启动并返回成功。");
    const businessRequestStart = upstreamRequests.length;

    const headers = {
      cookie: `student_care_admin_session=${session}`,
      origin: baseUrl,
    };
    const listed = await fetch(`${baseUrl}/api/admin/fees`, { headers });
    assert.equal(listed.status, 200);
    assert.deepEqual((await listed.json()).data, {
      synthetic: true,
      students: [{ id: studentId, label: "示例学生甲" }],
      documents: [],
    });
    assert.deepEqual(upstreamRequests[businessRequestStart], {
      method: "GET",
      url: "/admin/fees",
      authorization: `Bearer ${session}`,
      body: undefined,
    });

    const createBody = {
      student_id: studentId,
      document_type: "BILL",
      title: "十月合成账单",
      period: "2026-10",
      amount_minor: 68000,
      valid_from: "2026-10-01",
      valid_to: "2026-10-31",
      summary: "仅供本机代理验证。",
    };
    const created = await fetch(`${baseUrl}/api/admin/fees`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify(createBody),
    });
    assert.equal(created.status, 201);
    assert.equal((await created.json()).data.id, feeId);
    assert.deepEqual(upstreamRequests[businessRequestStart + 1], {
      method: "POST",
      url: "/admin/fees",
      authorization: `Bearer ${session}`,
      body: createBody,
    });

    const revoked = await fetch(`${baseUrl}/api/admin/fees/${feeId}/revoke`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ expected_version: 1 }),
    });
    assert.equal(revoked.status, 200);
    assert.deepEqual((await revoked.json()).data, {
      id: feeId,
      version: 2,
      status: "REVOKED",
      synthetic: true,
    });
    assert.equal(upstreamRequests[businessRequestStart + 2]?.url, `/admin/fees/${feeId}/revoke`);

    const withScope = await fetch(`${baseUrl}/api/admin/fees`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ ...createBody, campus_id: "00000000-0000-4000-8000-000000000699" }),
    });
    assert.equal(withScope.status, 400);
    const foreignOrigin = await fetch(`${baseUrl}/api/admin/fees`, {
      method: "POST",
      headers: { ...headers, origin: "http://example.invalid", "content-type": "application/json" },
      body: JSON.stringify(createBody),
    });
    assert.equal(foreignOrigin.status, 403);
    const unauthenticated = await fetch(`${baseUrl}/api/admin/fees`);
    assert.equal(unauthenticated.status, 401);
    assert.equal(upstreamRequests.length, businessRequestStart + 3);
    const transfers = await fetch(`${baseUrl}/api/admin/student-transfers`, { headers });
    assert.equal(transfers.status, 200);
    assert.deepEqual((await transfers.json()).data.requests, []);
    assert.deepEqual(upstreamRequests.at(-1), {
      method: "GET",
      url: "/admin/student-transfers",
      authorization: `Bearer ${session}`,
      body: undefined,
    });
    assert.equal((await fetch(`${baseUrl}/api/admin/student-transfers`)).status, 401);
    assert.equal(
      (await fetch(`${baseUrl}/api/admin/student-transfers?campus_id=forged`, { headers })).status,
      400,
    );
    const transferInput = { student_id: studentId, destination_class_ref: "合成乙班" };
    const transferCreate = await fetch(`${baseUrl}/api/admin/student-transfers`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify(transferInput),
    });
    assert.equal(transferCreate.status, 201);
    assert.deepEqual((await transferCreate.json()).data, transferRecord);
    assert.deepEqual(upstreamRequests.at(-1)?.body, transferInput);
    const transferReview = await fetch(`${baseUrl}/api/admin/student-transfers/${feeId}/review`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ expected_version: 1, decision: "APPROVE" }),
    });
    assert.equal(transferReview.status, 200);
    assert.equal((await transferReview.json()).data.status, "APPROVED");
    const transferRequestCount = upstreamRequests.length;
    const transferForged = await fetch(`${baseUrl}/api/admin/student-transfers`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ ...transferInput, campus_id: studentId }),
    });
    assert.equal(transferForged.status, 400);
    const transferForeign = await fetch(`${baseUrl}/api/admin/student-transfers`, {
      method: "POST",
      headers: { ...headers, origin: "http://example.invalid", "content-type": "application/json" },
      body: JSON.stringify(transferInput),
    });
    assert.equal(transferForeign.status, 403);
    assert.equal(upstreamRequests.length, transferRequestCount);
  },
);
