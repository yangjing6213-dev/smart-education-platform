import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createServer, request } from "node:http";
import test from "node:test";
import { proxyReview } from "../src/local-proxy.mjs";

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
        resolve({
          status: incoming.statusCode,
          body: Buffer.concat(chunks).toString("utf8"),
        }),
      );
    });
    outgoing.once("error", reject);
    outgoing.end(body);
  });
}

async function startProxy(t) {
  const upstreamRequests = [];
  const upstream = createServer((incoming, response) => {
    const chunks = [];
    incoming.on("data", (chunk) => chunks.push(chunk));
    incoming.on("end", () => {
      upstreamRequests.push({
        authorization: incoming.headers.authorization,
        body: Buffer.concat(chunks).toString("utf8"),
        method: incoming.method,
        origin: incoming.headers.origin,
        url: incoming.url,
      });
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ method: incoming.method, url: incoming.url }));
    });
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

const relationId = "00000000-0000-4000-8000-000000000701";
const authorization = "Bearer " + "a".repeat(43);

test("binding review queue and versioned review command reach only the local service", async (t) => {
  const { proxyPort, servicePort, upstreamRequests } = await startProxy(t);
  const queue = await send(proxyPort, {
    path: "/local/binding-applications",
    headers: { authorization },
  });
  const reviewBody = JSON.stringify({ version: 1, action: "approve" });
  const review = await send(proxyPort, {
    path: "/local/binding-applications/" + relationId + "/review",
    method: "POST",
    headers: {
      authorization,
      origin: "http://127.0.0.1:" + proxyPort,
      "content-type": "application/json",
    },
    body: reviewBody,
  });

  assert.equal(queue.status, 200);
  assert.equal(review.status, 200);
  assert.deepEqual(upstreamRequests, [
    {
      authorization,
      body: "",
      method: "GET",
      origin: "http://127.0.0.1:" + servicePort,
      url: "/local/binding-applications",
    },
    {
      authorization,
      body: reviewBody,
      method: "POST",
      origin: "http://127.0.0.1:" + servicePort,
      url: "/local/binding-applications/" + relationId + "/review",
    },
  ]);
});

test("binding review proxy rejects writes and query or path variants outside its narrow allowlist", async (t) => {
  const { proxyPort, upstreamRequests } = await startProxy(t);
  const requests = [
    {
      path: "/local/binding-applications?campusId=east",
      method: "GET",
      status: 404,
    },
    { path: "/local/binding-applications", method: "POST", status: 404 },
    {
      path: "/local/binding-applications/" + relationId + "/review",
      method: "GET",
      status: 404,
    },
    {
      path: "/local/binding-applications/" + relationId + "/withdraw",
      method: "POST",
      status: 404,
    },
    {
      path: "/local/binding-applications/not-a-uuid/review",
      method: "POST",
      status: 404,
    },
    {
      path: "/local/binding-applications/" + relationId + "/review?extra=yes",
      method: "POST",
      status: 404,
    },
  ];

  for (const item of requests) {
    const headers =
      item.method === "POST"
        ? {
            origin: "http://127.0.0.1:" + proxyPort,
            "content-type": "application/json",
          }
        : {};
    const response = await send(proxyPort, {
      path: item.path,
      method: item.method,
      headers,
      body: item.method === "POST" ? "{}" : undefined,
    });
    assert.equal(response.status, item.status, item.method + " " + item.path);
  }

  assert.deepEqual(upstreamRequests, []);
});
