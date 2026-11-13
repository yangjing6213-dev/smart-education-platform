import { Buffer } from "node:buffer";
import { request as httpRequest } from "node:http";
import { URL } from "node:url";

function send(response, status) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(
    JSON.stringify({ code: status === 503 ? "LOCAL_SERVICE_UNAVAILABLE" : "UNAVAILABLE" }),
  );
}

function allowed(path, method) {
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
  if (
    entries.length === 0 &&
    ["/local/supply-requests", "/local/supply-requests-review", "/local/supply-summary"].includes(
      pathname,
    )
  )
    return method === "GET";
  if (entries.length === 0 && ["/local/sessions", "/local/session"].includes(pathname))
    return pathname === "/local/sessions" ? method === "POST" : method === "GET";
  if (entries.length === 0 && pathname === "/local/meals")
    return method === "GET" || method === "POST";
  const mealAction =
    /^\/local\/meals\/([A-Za-z0-9._:-]{1,128})\/(draft|publish|unpublish)$/u.exec(pathname);
  if (mealAction && entries.length === 0)
    return mealAction[2] === "draft" ? method === "PUT" : method === "POST";
  if (
    entries.length === 0 &&
    ["/local/staff-task-assignees", "/local/staff-task-review", "/local/student-options"].includes(
      pathname,
    )
  )
    return method === "GET";
  if (entries.length === 0 && pathname === "/local/staff-tasks")
    return method === "GET" || method === "POST";
  const staffTask =
    /^\/local\/staff-tasks\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/(claim|start|complete|check|cancel)$/iu.exec(
      pathname,
    );
  if (staffTask && entries.length === 0) return method === "POST";
  if (
    entries.length === 0 &&
    [
      "/local/pickup-authorizations",
      "/local/pickup-records",
      "/local/pickup-exceptions",
    ].includes(pathname)
  )
    return method === "GET";
  const pickupException =
    /^\/local\/pickup-exceptions\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/review$/iu.exec(
      pathname,
    );
  if (pickupException && entries.length === 0) return method === "POST";
  if (entries.length === 0 && ["/local/notice-review", "/local/notice-owned"].includes(pathname))
    return method === "GET";
  const notice =
    /^\/local\/notices\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/(review|publish|revoke)$/iu.exec(
      pathname,
    );
  if (notice && entries.length === 0) return method === "POST";
  if (entries.length === 0 && pathname === "/local/care-records") return method === "GET";
  const careRecord =
    /^\/local\/care-records\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/(review|publish|revoke-publication)$/iu.exec(
      pathname,
    );
  if (careRecord && entries.length === 0) return method === "POST";
  const supplyRequest =
    /^\/local\/supply-requests\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/(review|claim)$/iu.exec(
      pathname,
    );
  if (supplyRequest && entries.length === 0) return method === "POST";
  if (
    entries.length === 0 &&
    ["/local/resources-managed", "/local/resource-summary"].includes(pathname)
  )
    return method === "GET";
  if (
    entries.length === 0 &&
    ["/local/fee-summary", "/local/fee-ledger-summary"].includes(pathname)
  )
    return method === "GET";
  const resource =
    /^\/local\/resources\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})(?:\/(revoke))?$/iu.exec(
      pathname,
    );
  if (resource && entries.length === 0) return resource[2] ? method === "POST" : method === "PATCH";
  if (entries.some(([key]) => !["from", "to", "classId"].includes(key))) return false;
  if (pathname === "/local/sessions") return method === "POST" && entries.length === 0;
  if (pathname === "/local/binding-applications" && entries.length === 0)
    return method === "GET";
  const bindingReview =
    /^\/local\/binding-applications\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/review$/iu.exec(
      pathname,
    );
  if (bindingReview && entries.length === 0) return method === "POST";
  if (
    ["/local/session", "/local/statistics-summary", "/local/learning-safety-summary"].includes(
      pathname,
    )
  )
    return method === "GET" && entries.length === 0;
  if (pathname === "/local/statistics") return method === "GET";
  return false;
}

export async function proxyReview(request, response, port, servicePort) {
  const expected = `127.0.0.1:${port}`;
  const writes = ["POST", "PUT", "PATCH"].includes(request.method ?? "");
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
    return send(response, 403);
  if (!servicePort || !allowed(request.url ?? "", request.method ?? "")) return send(response, 404);
  if (
    (writes && request.headers["content-type"] !== "application/json") ||
    (!writes &&
      (request.headers["transfer-encoding"] || Number(request.headers["content-length"] ?? 0) > 0))
  )
    return send(response, 400);
  const authorization = request.headers.authorization;
  if (authorization !== undefined && !/^Bearer [\w-]{43}$/u.test(authorization))
    return send(response, 400);

  const chunks = [];
  let size = 0;
  try {
    for await (const chunk of request) {
      size += chunk.length;
      if (size > 8192) return send(response, 413);
      chunks.push(chunk);
    }
  } catch {
    if (!response.headersSent) send(response, 400);
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
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      incoming.pipe(response);
    },
  );
  upstream.on("timeout", () => upstream.destroy());
  upstream.on("error", () => {
    if (!response.headersSent) send(response, 503);
    else response.end();
  });
  upstream.end(writes ? Buffer.concat(chunks) : undefined);
}
