import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createServer, request } from "node:http";
import test from "node:test";
import { proxyReview } from "../src/local-proxy.mjs";

const taskId = "e4e61da1-6032-4806-97e6-43e401809dee";

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve(server.address().port);
    });
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function send(port, { path, method = "GET", headers = {}, body }) {
  return new Promise((resolve, reject) => {
    const outgoing = request({ hostname: "127.0.0.1", port, path, method, headers }, (incoming) => {
      const chunks = [];
      incoming.on("data", (chunk) => chunks.push(chunk));
      incoming.on("end", () =>
        resolve({ status: incoming.statusCode, body: Buffer.concat(chunks).toString("utf8") }),
      );
    });
    outgoing.once("error", reject);
    outgoing.end(body);
  });
}

async function startProxy(t) {
  const upstreamRequests = [];
  const upstream = createServer((incoming, response) => {
    upstreamRequests.push({
      authorization: incoming.headers.authorization,
      method: incoming.method,
      origin: incoming.headers.origin,
      url: incoming.url,
    });
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ url: incoming.url }));
  });
  const servicePort = await listen(upstream);
  t.after(() => close(upstream));

  let proxyPort;
  const proxy = createServer((incoming, response) => {
    void proxyReview(incoming, response, proxyPort, servicePort);
  });
  proxyPort = await listen(proxy);
  t.after(() => close(proxy));
  return { proxyPort, servicePort, upstreamRequests };
}

test("staff task routes reach only the configured loopback service", async (t) => {
  const { proxyPort, servicePort, upstreamRequests } = await startProxy(t);
  const authorization = `Bearer ${"t".repeat(43)}`;
  const writes = [
    { path: "/local/sessions", method: "POST" },
    { path: "/local/staff-tasks", method: "POST" },
    ...["claim", "start", "complete", "check", "cancel"].map((action) => ({
      path: `/local/staff-tasks/${taskId}/${action}`,
      method: "POST",
    })),
  ];
  const reads = [
    "/local/session",
    "/local/staff-tasks",
    "/local/staff-task-assignees",
    "/local/staff-task-review",
    "/local/student-options",
  ].map((path) => ({ path, method: "GET" }));

  for (const { path, method } of [...writes, ...reads]) {
    const isWrite = method === "POST";
    const response = await send(proxyPort, {
      path,
      method,
      headers: {
        authorization,
        ...(isWrite
          ? {
              origin: `http://127.0.0.1:${proxyPort}`,
              "content-type": "application/json",
            }
          : {}),
      },
      ...(isWrite ? { body: "{}" } : {}),
    });
    assert.equal(response.status, 200, `${method} ${path}`);
    assert.deepEqual(JSON.parse(response.body), { url: path });
  }

  assert.deepEqual(
    upstreamRequests,
    [...writes, ...reads].map(({ path, method }) => ({
      authorization,
      method,
      origin: `http://127.0.0.1:${servicePort}`,
      url: path,
    })),
  );
});

test("meal routes reach only the configured loopback service with their scoped methods", async (t) => {
  const { proxyPort, servicePort, upstreamRequests } = await startProxy(t);
  const authorization = `Bearer ${"m".repeat(43)}`;
  const requests = [
    { path: "/local/sessions", method: "POST" },
    { path: "/local/meals", method: "GET" },
    { path: "/local/meals", method: "POST" },
    { path: "/local/meals/meal-local-1/draft", method: "PUT" },
    { path: "/local/meals/meal-local-1/publish", method: "POST" },
    { path: "/local/meals/meal-local-1/unpublish", method: "POST" },
  ];
  for (const { path, method } of requests) {
    const isWrite = ["POST", "PUT"].includes(method);
    const response = await send(proxyPort, {
      path,
      method,
      headers: {
        authorization,
        ...(isWrite
          ? {
              origin: `http://127.0.0.1:${proxyPort}`,
              "content-type": "application/json",
            }
          : {}),
      },
      ...(isWrite ? { body: "{}" } : {}),
    });
    assert.equal(response.status, 200, `${method} ${path}`);
  }
  assert.deepEqual(
    upstreamRequests.map(({ method, url }) => [method, url]),
    requests.map(({ method, path }) => [method, path]),
  );
  assert.ok(upstreamRequests.every((request) => request.authorization === authorization));
  assert.ok(
    upstreamRequests.every((request) => request.origin === `http://127.0.0.1:${servicePort}`),
  );
});

test("staff task proxy rejects unrelated paths, methods, queries, and forged scope", async (t) => {
  const { proxyPort, upstreamRequests } = await startProxy(t);
  const blockedRequests = [
    {
      path: "/local/staff-tasks",
      method: "DELETE",
      headers: { origin: `http://127.0.0.1:${proxyPort}`, "content-type": "application/json" },
    },
    {
      path: `/local/staff-tasks/${taskId}/publish`,
      method: "POST",
      headers: { origin: `http://127.0.0.1:${proxyPort}`, "content-type": "application/json" },
      body: "{}",
    },
    { path: "/local/staff-tasks?campusId=other", status: 404 },
    { path: "/local/staff-task-assignees?classId=other", status: 404 },
    {
      path: "/local/staff-tasks/not-a-uuid/claim",
      method: "POST",
      headers: { origin: `http://127.0.0.1:${proxyPort}`, "content-type": "application/json" },
      body: "{}",
    },
    { path: "/local/staff-tasks", headers: { "x-campus-id": "forged-campus" }, status: 403 },
    {
      path: "/local/staff-task-review",
      headers: { authorization: `Bearer ${"t".repeat(42)}` },
      status: 400,
    },
    { path: "/local/health-incidents", status: 404 },
  ];

  for (const requestOptions of blockedRequests) {
    const response = await send(proxyPort, requestOptions);
    assert.equal(
      response.status,
      requestOptions.status ?? 404,
      `${requestOptions.method ?? "GET"} ${requestOptions.path}`,
    );
  }
  assert.deepEqual(upstreamRequests, []);
});
