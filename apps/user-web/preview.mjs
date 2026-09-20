import { createReadStream } from "node:fs";
import { access, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HOST = "127.0.0.1";
const REQUESTED_PORT = 0;
const packageRoot = fileURLToPath(new URL(".", import.meta.url));
const DIST_ROOT = resolve(packageRoot, "dist");
const MIME_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
]);

function routeToFile(pathname) {
  if (
    pathname === "/visitor" ||
    pathname === "/web/visitor/home" ||
    pathname.startsWith("/visitor/content/")
  ) {
    return resolve(DIST_ROOT, "index.html");
  }
  if (pathname === "/") {
    return resolve(DIST_ROOT, "index.html");
  }
  return resolve(DIST_ROOT, `.${pathname}`);
}

function isInsideDist(path) {
  const pathFromRoot = relative(DIST_ROOT, path);
  return (
    pathFromRoot !== "" &&
    pathFromRoot !== ".." &&
    !pathFromRoot.startsWith("..\\") &&
    !pathFromRoot.startsWith("../")
  );
}

function sendText(response, statusCode, body) {
  response.writeHead(statusCode, { "content-type": "text/plain; charset=utf-8" });
  response.end(body);
}

const server = createServer(async (request, response) => {
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
  if (!isInsideDist(filePath)) {
    sendText(response, 404, "Not Found");
    return;
  }

  try {
    const fileStats = await stat(filePath);
    if (!fileStats.isFile()) {
      sendText(response, 404, "Not Found");
      return;
    }
    response.writeHead(200, {
      "content-length": fileStats.size,
      "content-type": MIME_TYPES.get(extname(filePath)) ?? "application/octet-stream",
      "cache-control": "no-store",
    });
    if (request.method === "HEAD") {
      response.end();
      return;
    }
    createReadStream(filePath).pipe(response);
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
