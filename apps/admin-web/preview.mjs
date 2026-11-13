import { createReadStream } from "node:fs";
import { access, realpath, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, isAbsolute, relative, resolve, sep } from "node:path";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";
import { proxyReview } from "./src/local-proxy.mjs";

const HOST = "127.0.0.1";
const BROWSER_UNSAFE_PORTS = new Set([
  1, 7, 9, 11, 13, 15, 17, 19, 20, 21, 22, 23, 25, 37, 42, 43, 53, 69, 77, 79, 87, 95, 101, 102,
  103, 104, 109, 110, 111, 113, 115, 117, 119, 123, 135, 139, 143, 179, 389, 427, 465, 512, 513,
  514, 515, 526, 530, 531, 532, 540, 548, 554, 556, 563, 587, 601, 636, 989, 990, 993, 995, 1719,
  1720, 1723, 2049, 3659, 4045, 5060, 5061, 6000, 6566, 6665, 6666, 6667, 6668, 6669, 6697, 10080,
]);
const packageRoot = fileURLToPath(new URL(".", import.meta.url));
const distRoot = resolve(packageRoot, "dist");
const args = process.argv.slice(2);
let servicePort = null;
if (args.length) {
  if (
    args.length !== 2 ||
    args[0] !== "--local-service-port" ||
    !/^[1-9]\d{0,4}$/u.test(args[1]) ||
    Number(args[1]) > 65535
  )
    throw new Error("Explicit loopback service port required");
  servicePort = Number(args[1]);
}
let canonicalDistRoot;
let canonicalAdminIndex;
const MIME_TYPES = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
]);

function routeToFile(pathname) {
  if (pathname.startsWith("/admin/dist/")) pathname = pathname.slice("/admin".length);
  if (
    pathname === "/" ||
    pathname === "/index.html" ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/")
  )
    return resolve(packageRoot, "index.html");
  if (!pathname.startsWith("/dist/")) return undefined;
  const path = resolve(packageRoot, `.${pathname}`);
  const relativePath = relative(distRoot, path);
  if (
    relativePath === "" ||
    relativePath === ".." ||
    relativePath.startsWith("..\\") ||
    relativePath.startsWith("../")
  )
    return undefined;
  return path;
}

function isInsideDirectory(root, candidate) {
  const pathFromRoot = relative(root, candidate);
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

const server = createServer(async (request, response) => {
  if (request.url?.startsWith("/local/")) {
    await proxyReview(request, response, server.address().port, servicePort);
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
  if (!filePath) {
    sendText(response, 404, "Not Found");
    return;
  }

  try {
    const canonicalFile = await realpath(filePath);
    if (
      canonicalFile !== canonicalAdminIndex &&
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

await access(resolve(packageRoot, "index.html"));
await access(resolve(distRoot, "main.js"));
const canonicalPackageRoot = await realpath(packageRoot);
canonicalDistRoot = await realpath(distRoot);
canonicalAdminIndex = await realpath(resolve(packageRoot, "index.html"));
if (
  !isInsideDirectory(canonicalPackageRoot, canonicalDistRoot) ||
  !isInsideDirectory(canonicalPackageRoot, canonicalAdminIndex)
) {
  throw new Error("Admin preview paths must stay inside the application directory");
}
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

function announceStarted() {
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Admin preview did not receive a TCP address");
  }
  if (BROWSER_UNSAFE_PORTS.has(address.port)) {
    server.close((error) => {
      if (error) throw error;
      server.listen(0, HOST, announceStarted);
    });
    return;
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
}

server.listen(0, HOST, announceStarted);
