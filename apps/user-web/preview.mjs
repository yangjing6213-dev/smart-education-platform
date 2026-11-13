import { createReadStream } from "node:fs";
import { access, realpath, stat } from "node:fs/promises";
import { Buffer } from "node:buffer";
import { createServer, request as httpRequest } from "node:http";
import { extname, isAbsolute, relative, resolve, sep } from "node:path";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";

const HOST = "127.0.0.1";
const REQUESTED_PORT = 0;
const previewArgs = process.argv.slice(2);
let servicePort = null;
if (previewArgs.length) {
  if (
    previewArgs.length !== 2 ||
    previewArgs[0] !== "--local-service-port" ||
    !/^[1-9]\d{0,4}$/u.test(previewArgs[1]) ||
    Number(previewArgs[1]) > 65535
  )
    throw new Error("Explicit loopback service port required");
  servicePort = Number(previewArgs[1]);
}
const packageRoot = fileURLToPath(new URL(".", import.meta.url));
const DIST_ROOT = resolve(packageRoot, process.env.TASK20_G44A_WEB_DIST_ROOT ?? "dist");
const canonicalPackageRoot = await realpath(packageRoot);
const canonicalDistRoot = await realpath(DIST_ROOT);
const MIME_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".avif", "image/avif"],
  [".js", "text/javascript; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
]);

function routeToFile(pathname) {
  if (
    pathname === "/visitor" ||
    pathname === "/web/visitor/home" ||
    pathname === "/web/visitor/institution" ||
    pathname === "/web/visitor/day-flow" ||
    pathname === "/web/parent/binding" ||
    pathname === "/web/parent/home" ||
    pathname === "/web/parent/learning" ||
    pathname.startsWith("/visitor/content/") ||
    pathname === "/staff/workbench" ||
    pathname === "/staff/report" ||
    pathname === "/staff/guides" ||
    pathname === "/staff/learning" ||
    pathname === "/web/staff/resources"
  ) {
    return resolve(DIST_ROOT, "index.html");
  }
  if (pathname === "/") {
    return resolve(DIST_ROOT, "index.html");
  }
  return resolve(DIST_ROOT, `.${pathname}`);
}

function isInsideDirectory(root, path) {
  const pathFromRoot = relative(root, path);
  return (
    pathFromRoot !== "" &&
    pathFromRoot !== ".." &&
    !pathFromRoot.startsWith(`..${sep}`) &&
    !isAbsolute(pathFromRoot)
  );
}

function sendText(response, statusCode, body) {
  response.writeHead(statusCode, { "content-type": "text/plain; charset=utf-8" });
  response.end(body);
}

function allowedResourceRequest(path, method) {
  let url;
  try {
    url = new URL(path, "http://127.0.0.1");
  } catch {
    return false;
  }
  if (url.origin !== "http://127.0.0.1") return false;
  const entries = [...url.searchParams.entries()];
  if (new Set(entries.map(([key]) => key)).size !== entries.length) return false;
  const pathname = url.pathname;
  if (pathname === "/local/resources")
    return (
      method === "GET" &&
      entries.every(
        ([key, value]) => ["query", "grade", "subject", "tag"].includes(key) && value.length <= 80,
      )
    );
  if (pathname === "/local/public-meals") {
    const date = entries[0]?.[1] ?? "";
    const parsed = new Date(`${date}T00:00:00.000Z`);
    return (
      method === "GET" &&
      entries.length === 1 &&
      entries[0]?.[0] === "date" &&
      /^\d{4}-\d{2}-\d{2}$/u.test(date) &&
      !Number.isNaN(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === date
    );
  }
  if (entries.length) return false;
  if (pathname === "/local/sessions") return method === "POST";
  if (pathname === "/local/session" || pathname === "/local/notices") return method === "GET";
  if (pathname === "/local/binding-applications") return method === "GET" || method === "POST";
  if (pathname === "/local/consent-policies") return method === "GET";
  if (pathname === "/local/consents") return method === "GET" || method === "POST";
  if (pathname === "/local/privacy-requests") return method === "GET";
  const consentAction =
    /^\/local\/consents\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/(revoke|retention-review)$/iu.exec(
      pathname,
    );
  if (consentAction) return method === "POST";
  const parentNoticeReceipt =
    /^\/local\/notices\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/(read|ack)$/iu.test(
      pathname,
    );
  if (parentNoticeReceipt) return method === "POST";
  if (pathname === "/local/care-records") return method === "GET" || method === "POST";
  const careRecord =
    /^\/local\/care-records\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}(?:\/(submit|withdraw|resubmit|receipt))?$/iu.test(
      pathname,
    );
  if (careRecord) return method === "GET" || method === "POST";
  if (pathname === "/local/pickup-authorizations") return method === "GET" || method === "POST";
  if (pathname === "/local/pickup-records") return method === "GET";
  const pickupAuthorization =
    /^\/local\/pickup-authorizations\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/(activate|revoke|credential)$/iu.exec(
      pathname,
    );
  if (pickupAuthorization) return method === "POST";
  if (pathname === "/local/supply-requests") return method === "GET" || method === "POST";
  const supplyRequest =
    /^\/local\/supply-requests\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})(?:\/(submit|cancel|claim))?$/iu.exec(
      pathname,
    );
  if (supplyRequest) return supplyRequest[2] ? method === "POST" : method === "PATCH";
  if (pathname === "/local/learning-sessions") return method === "GET" || method === "POST";
  if (pathname === "/local/learning-knowledge") return method === "GET";
  const learningParentControls =
    /^\/local\/learning-parent-controls\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
      pathname,
    );
  if (learningParentControls) return method === "POST";
  const learningParentContact =
    /^\/local\/learning-parent-contact\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
      pathname,
    );
  if (learningParentContact) return method === "POST";
  if (
    [
      "/local/session",
      "/local/student-options",
      "/local/learning-teacher-summary",
      "/local/learning-parent-controls",
      "/local/learning-parent-contact-intents",
      "/local/resources-favorites",
      "/local/resources-recent",
    ].includes(pathname)
  )
    return method === "GET";
  const learningSession =
    /^\/local\/learning-sessions\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})(?:\/(answer|hint|close|delete))?$/iu.exec(
      pathname,
    );
  if (learningSession) return learningSession[2] ? method === "POST" : method === "GET";
  const resource =
    /^\/local\/resources\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})(?:\/(favorite|use))?$/iu.exec(
      pathname,
    );
  if (!resource) return false;
  if (!resource[2]) return method === "GET";
  return method === "POST";
}

function sendProxyError(response, status) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  response.end(
    JSON.stringify({ code: status === 503 ? "LOCAL_SERVICE_UNAVAILABLE" : "UNAVAILABLE" }),
  );
}

async function proxyResourceRequest(request, response, serverPort) {
  const expected = `127.0.0.1:${serverPort}`;
  const writes = request.method === "POST" || request.method === "PATCH";
  const forged = Object.keys(request.headers).some((key) =>
    /^(?:x-)?(?:forwarded.*|real-?ip|role|roles|actor-?id|identity-?id|tenant(?:-?id)?|campus(?:-?id)?|class(?:-?id)?|capabilit.*|permission.*)$/iu.test(
      key.replaceAll("_", "-"),
    ),
  );
  if (
    request.headers.host !== expected ||
    (request.headers.origin !== undefined && request.headers.origin !== `http://${expected}`) ||
    (writes && request.headers.origin !== `http://${expected}`) ||
    request.headers["sec-fetch-site"] === "cross-site" ||
    forged
  )
    return sendProxyError(response, 403);
  if (!servicePort || !allowedResourceRequest(request.url ?? "", request.method ?? ""))
    return sendProxyError(response, 404);
  if (
    (writes && request.headers["content-type"] !== "application/json") ||
    (!writes &&
      (request.headers["transfer-encoding"] || Number(request.headers["content-length"] ?? 0) > 0))
  )
    return sendProxyError(response, 400);
  const authorization = request.headers.authorization;
  if (authorization !== undefined && !/^Bearer [\w-]{43}$/u.test(authorization))
    return sendProxyError(response, 400);

  const chunks = [];
  let size = 0;
  try {
    for await (const chunk of request) {
      size += chunk.length;
      if (size > 8192) return sendProxyError(response, 413);
      chunks.push(chunk);
    }
  } catch {
    if (!response.headersSent) sendProxyError(response, 400);
    return;
  }

  const upstream = httpRequest(
    {
      hostname: "127.0.0.1",
      port: servicePort,
      path: request.url,
      method: request.method,
      timeout: 3000,
      headers: {
        Origin: `http://127.0.0.1:${servicePort}`,
        ...(authorization ? { Authorization: authorization } : {}),
        ...(writes ? { "Content-Type": "application/json" } : {}),
      },
    },
    (incoming) => {
      response.writeHead(incoming.statusCode ?? 502, {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      });
      incoming.pipe(response);
    },
  );
  upstream.on("timeout", () => upstream.destroy());
  upstream.on("error", () => {
    if (!response.headersSent) sendProxyError(response, 503);
    else response.end();
  });
  upstream.end(writes ? Buffer.concat(chunks) : undefined);
}

const server = createServer(async (request, response) => {
  if (request.url?.startsWith("/local/")) {
    const address = server.address();
    if (address === null || typeof address === "string") return sendProxyError(response, 503);
    await proxyResourceRequest(request, response, address.port);
    return;
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    sendText(response, 405, "Method Not Allowed");
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url ?? "/", `http://${HOST}`).pathname);
  } catch {
    sendText(response, 400, "Bad Request");
    return;
  }

  const filePath = routeToFile(pathname);
  if (!isInsideDirectory(DIST_ROOT, filePath)) {
    sendText(response, 404, "Not Found");
    return;
  }

  try {
    const canonicalFile = await realpath(filePath);
    if (
      !isInsideDirectory(canonicalPackageRoot, canonicalDistRoot) ||
      !isInsideDirectory(canonicalDistRoot, canonicalFile)
    ) {
      sendText(response, 404, "Not Found");
      return;
    }
    const fileStats = await stat(canonicalFile);
    if (!fileStats.isFile()) {
      sendText(response, 404, "Not Found");
      return;
    }
    response.writeHead(200, {
      "content-length": fileStats.size,
      "content-type": MIME_TYPES.get(extname(canonicalFile)) ?? "application/octet-stream",
      "cache-control": "no-store",
    });
    if (request.method === "HEAD") {
      response.end();
      return;
    }
    createReadStream(canonicalFile).pipe(response);
  } catch {
    sendText(response, 404, "Not Found");
  }
});

await access(DIST_ROOT);
server.on("error", (error) => {
  process.stderr.write(`${JSON.stringify({ event: "error", message: error.message })}\n`);
  process.exitCode = 1;
});

function shutdown(signal) {
  server.close(() => {
    process.stdout.write(`${JSON.stringify({ event: "shutdown", signal, pid: process.pid })}\n`);
    process.exit(0);
  });
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));

server.listen(REQUESTED_PORT, HOST, () => {
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Preview server did not receive a TCP address");
  }
  process.stdout.write(
    `${JSON.stringify({
      event: "startup",
      pid: process.pid,
      host: HOST,
      port: address.port,
      baseUrl: `http://${HOST}:${address.port}`,
      startedAt: new Date().toISOString(),
    })}\n`,
  );
});
