import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createServer, request } from "node:http";
import test from "node:test";
import { proxyReview } from "../src/local-proxy.mjs";

const feeSummaryPaths = ["/local/fee-summary", "/local/fee-ledger-summary"];

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

function send(port, { path, method = "GET", headers = {} }) {
  return new Promise((resolve, reject) => {
    const outgoing = request({ hostname: "127.0.0.1", port, path, method, headers }, (incoming) => {
      const chunks = [];
      incoming.on("data", (chunk) => chunks.push(chunk));
      incoming.on("end", () =>
        resolve({ status: incoming.statusCode, body: Buffer.concat(chunks).toString("utf8") }),
      );
    });
    outgoing.once("error", reject);
    outgoing.end();
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

test("fee summary GET routes reach only the local service and preserve the short session token", async (t) => {
  const { proxyPort, servicePort, upstreamRequests } = await startProxy(t);
  const authorization = `Bearer ${"a".repeat(43)}`;

  for (const path of feeSummaryPaths) {
    const response = await send(proxyPort, { path, headers: { authorization } });

    assert.equal(response.status, 200);
    assert.deepEqual(JSON.parse(response.body), { url: path });
  }

  assert.deepEqual(upstreamRequests, [
    {
      authorization,
      method: "GET",
      origin: `http://127.0.0.1:${servicePort}`,
      url: "/local/fee-summary",
    },
    {
      authorization,
      method: "GET",
      origin: `http://127.0.0.1:${servicePort}`,
      url: "/local/fee-ledger-summary",
    },
  ]);
});

test("fee summary proxy rejects writes, query variants, unrelated routes, and forged scope headers", async (t) => {
  const { proxyPort, upstreamRequests } = await startProxy(t);
  const blockedRequests = [
    ...feeSummaryPaths.flatMap((path) =>
      ["POST", "PATCH", "PUT", "DELETE"].map((method) => ({
        path,
        method,
        headers: { origin: `http://127.0.0.1:${proxyPort}`, "content-type": "application/json" },
        status: 404,
      })),
    ),
    ...feeSummaryPaths.flatMap((path) =>
      ["x-tenant-id", "x-campus-id", "x-class-id"].map((header) => ({
        path,
        headers: { [header]: "forged-scope" },
        status: 403,
      })),
    ),
    { path: "/local/fee-summary?campusId=campus-a", status: 404 },
    { path: "/local/fee-ledger-summary?from=2026-10-01", status: 404 },
    { path: "/local/fee-summary-extra", status: 404 },
    ...feeSummaryPaths.map((path) => ({
      path,
      headers: { authorization: `Bearer ${"a".repeat(42)}` },
      status: 400,
    })),
  ];

  for (const requestOptions of blockedRequests) {
    const response = await send(proxyPort, requestOptions);
    assert.equal(
      response.status,
      requestOptions.status,
      `${requestOptions.method ?? "GET"} ${requestOptions.path}`,
    );
  }

  assert.deepEqual(upstreamRequests, []);
});
