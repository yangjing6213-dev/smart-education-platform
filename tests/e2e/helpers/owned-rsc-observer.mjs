import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { appendFileSync, realpathSync } from "node:fs";
import { Server } from "node:http";
import { isAbsolute, join, relative, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";
import { gunzipSync } from "node:zlib";

export const hashValue = (value) => createHash("sha256").update(value).digest("hex");

export function routeFingerprint(url, headers) {
  try {
    const value = new URL(url);
    const normalized = Object.fromEntries(
      Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value]),
    );
    if (
      value.protocol !== "http:" ||
      value.hostname !== "127.0.0.1" ||
      !value.port ||
      !["/admin/staff-tasks", "/admin/institution"].includes(value.pathname) ||
      !value.searchParams.get("_rsc") ||
      normalized.rsc !== "1" ||
      !/^[0-9a-f]{1,16}$/u.test(normalized["x-nextjs-request-id"] ?? "") ||
      typeof normalized["next-router-state-tree"] !== "string" ||
      !normalized["next-router-state-tree"]
    )
      return null;
    return hashValue(
      value.href +
        "\n" +
        normalized["x-nextjs-request-id"] +
        "\n" +
        normalized["next-router-state-tree"],
    );
  } catch {
    return null;
  }
}

export function isCompletedRouteCancellation({
  request,
  failure,
  transfer,
  witnesses,
  timings,
  page,
}) {
  if (
    request.role !== "admin" ||
    request.method !== "GET" ||
    request.resourceType !== "Fetch" ||
    request.isRsc !== true ||
    failure.role !== request.role ||
    failure.requestId !== request.requestId ||
    failure.type !== "Fetch" ||
    failure.canceled !== true ||
    failure.error !== "net::ERR_ABORTED" ||
    transfer?.status !== 200 ||
    transfer.mimeType !== "text/x-component" ||
    transfer.contentEncoding !== "gzip" ||
    !(transfer.bytes > 0)
  )
    return false;
  const fingerprint = routeFingerprint(request.url, request.routeHeaders);
  if (
    !fingerprint ||
    page.pathname !== new URL(request.url).pathname ||
    page.committed !== true ||
    !(page.expectedTimeOrigin > 0) ||
    page.timeOrigin !== page.expectedTimeOrigin ||
    page.errorCount !== 0
  )
    return false;
  const matched = witnesses.filter(
    (row) => row.event === "finish" && row.fingerprint === fingerprint,
  );
  if (matched.length !== 1) return false;
  const wire = matched[0];
  if (
    wire.status !== 200 ||
    wire.writableEnded !== true ||
    wire.writableFinished !== true ||
    wire.contentType !== "text/x-component" ||
    wire.encoding !== "gzip" ||
    wire.gzipComplete !== true ||
    wire.capped !== false ||
    !(wire.encodedBytes > 0) ||
    wire.decodedBytes !== transfer.bytes ||
    !/^[0-9a-f]{64}$/u.test(wire.decodedSha256 ?? "")
  )
    return false;
  const matchingTimings = timings.filter(
    (row) =>
      row.urlHash === hashValue(request.url) &&
      Number.isFinite(row.startAt) &&
      Math.abs(row.startAt - request.wallTime * 1000) <= 20,
  );
  if (matchingTimings.length !== 1) return false;
  const timing = matchingTimings[0];
  const failureAt = (request.wallTime + failure.timestamp - request.timestamp) * 1000;
  return (
    Number.isFinite(failureAt) &&
    Number.isFinite(timing.endAt) &&
    timing.endAt > timing.startAt &&
    failureAt >= timing.endAt - 2 &&
    timing.encodedBodySize === wire.encodedBytes &&
    timing.decodedBodySize === wire.decodedBytes
  );
}

// Observe bytes already written by the owned server. Never add a response consumer.
export function observeRscResponse(request, response, directory) {
  if (request.method !== "GET" || !/^127\.0\.0\.1:[1-9]\d{0,4}$/u.test(request.headers.host ?? ""))
    return;
  const fingerprint = routeFingerprint(
    "http://" + request.headers.host + request.url,
    request.headers,
  );
  if (!fingerprint) return;
  const chunks = [];
  let encodedBytes = 0,
    capped = false,
    finished = false;
  const capture = (values) => {
    const value = values[0];
    if (typeof value !== "string" && !Buffer.isBuffer(value) && !(value instanceof Uint8Array))
      return;
    const chunk =
      typeof value === "string"
        ? Buffer.from(value, typeof values[1] === "string" ? values[1] : "utf8")
        : Buffer.from(value);
    encodedBytes += chunk.length;
    if (encodedBytes > 256 * 1024) {
      capped = true;
      chunks.length = 0;
    } else if (!capped) chunks.push(chunk);
  };
  const write = response.write,
    end = response.end,
    writeHead = response.writeHead;
  const sentHeaders = {};
  response.writeHead = function (...values) {
    const headers = values[typeof values[1] === "string" ? 2 : 1];
    if (headers && !Array.isArray(headers))
      for (const [name, value] of Object.entries(headers))
        if (["content-type", "content-encoding"].includes(name.toLowerCase()))
          sentHeaders[name.toLowerCase()] = value;
    return Reflect.apply(writeHead, this, values);
  };
  response.write = function (...values) {
    capture(values);
    return Reflect.apply(write, this, values);
  };
  response.end = function (...values) {
    capture(values);
    return Reflect.apply(end, this, values);
  };
  const record = (event) => {
    let decoded;
    const encoding = response.getHeader("content-encoding") ?? sentHeaders["content-encoding"];
    try {
      if (!capped && encoding === "gzip") decoded = gunzipSync(Buffer.concat(chunks));
    } catch {
      /* A truncated gzip is never a complete witness. */
    }
    appendFileSync(
      join(directory, "server-" + process.pid + ".jsonl"),
      JSON.stringify({
        event,
        fingerprint,
        status: response.statusCode,
        writableEnded: response.writableEnded,
        writableFinished: response.writableFinished,
        contentType: String(
          response.getHeader("content-type") ?? sentHeaders["content-type"] ?? "",
        ).split(";")[0],
        encoding,
        gzipComplete: Boolean(decoded),
        capped,
        encodedBytes,
        decodedBytes: decoded?.length,
        decodedSha256: decoded ? hashValue(decoded) : null,
      }) + "\n",
    );
    chunks.length = 0;
  };
  response.once("finish", () => {
    finished = true;
    record("finish");
  });
  response.once("close", () => {
    if (!finished) record("close");
  });
}

// This import is installed only in test-owned Next children, never in a browser.
if (process.env.TASK20_OWNED_RSC_DIRECTORY) {
  const artifacts = realpathSync(fileURLToPath(new URL("../../../artifacts/", import.meta.url)));
  const directory = realpathSync(resolve(process.env.TASK20_OWNED_RSC_DIRECTORY));
  const path = relative(artifacts, directory);
  if (!path || path.startsWith("..") || isAbsolute(path))
    throw new Error("RSC observations must stay in owned artifacts.");
  const emit = Server.prototype.emit;
  Server.prototype.emit = function (event, ...args) {
    if (event === "request") observeRscResponse(args[0], args[1], directory);
    return Reflect.apply(emit, this, [event, ...args]);
  };
}
