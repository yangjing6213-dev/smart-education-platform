import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import process from "node:process";
import test from "node:test";
import { clearTimeout, setTimeout } from "node:timers";
import { fileURLToPath, URL } from "node:url";

const userRoot = fileURLToPath(new URL("../", import.meta.url));
const careRecordId = "6e9a6a64-61b4-4caf-a991-e68403046764";
const consentId = "11111111-1111-4111-8111-111111111111";

async function listen(server) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return server.address().port;
}

async function waitForPreview(child) {
  return new Promise((resolveStartup, reject) => {
    let buffer = "";
    const timeout = setTimeout(
      () => reject(new Error("User Web preview startup timed out.")),
      8000,
    );
    child.stdout.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      for (const line of buffer.split(/\r?\n/u)) {
        try {
          const event = JSON.parse(line);
          if (event.event === "startup" && event.baseUrl) {
            clearTimeout(timeout);
            resolveStartup(event.baseUrl);
            return;
          }
        } catch {
          // Wait for the next complete JSON line.
        }
      }
      buffer = buffer.slice(buffer.lastIndexOf("\n") + 1);
    });
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`User Web preview exited before startup (${code}).`));
    });
  });
}

async function stop(child) {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    once(child, "exit"),
    new Promise((resolveTimeout) => setTimeout(resolveTimeout, 2500)),
  ]);
  if (child.exitCode === null) child.kill();
}

test("User Web preview proxies only the exact local paths required by its screens", async (t) => {
  const received = [];
  const upstream = createServer(async (request, response) => {
    await new Promise((resolveBody) => {
      request.once("end", resolveBody);
      request.resume();
    });
    received.push({
      method: request.method,
      url: request.url,
      origin: request.headers.origin,
    });
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true }));
  });
  const servicePort = await listen(upstream);
  const child = spawn(
    process.execPath,
    [
      resolve(userRoot, "preview.mjs"),
      "--local-service-port",
      String(servicePort),
    ],
    { cwd: userRoot, stdio: ["ignore", "pipe", "pipe"] },
  );
  t.after(async () => {
    await Promise.all([
      stop(child),
      new Promise((resolveClose, reject) =>
        upstream.close((error) => (error ? reject(error) : resolveClose())),
      ),
    ]);
  });
  const baseUrl = await waitForPreview(child);

  const read = await globalThis.fetch(`${baseUrl}/local/care-records`);
  assert.equal(read.status, 200);
  const create = await globalThis.fetch(`${baseUrl}/local/care-records`, {
    method: "POST",
    headers: { origin: baseUrl, "content-type": "application/json" },
    body: JSON.stringify({ synthetic: true }),
  });
  assert.equal(create.status, 200);

  const forbidden = await globalThis.fetch(
    `${baseUrl}/local/care-records/${careRecordId}/review`,
    {
      method: "POST",
      headers: { origin: baseUrl, "content-type": "application/json" },
      body: JSON.stringify({ version: 1, action: "confirm" }),
    },
  );
  assert.equal(forbidden.status, 404);

  const consentRequests = [
    ["GET", "/local/consent-policies"],
    ["GET", "/local/consents"],
    ["POST", "/local/consents"],
    ["POST", "/local/binding-applications"],
    ["GET", "/local/privacy-requests"],
    ["POST", `/local/consents/${consentId}/revoke`],
    ["POST", `/local/consents/${consentId}/retention-review`],
  ];
  for (const [method, path] of consentRequests) {
    const response = await globalThis.fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        origin: baseUrl,
        ...(method === "POST" ? { "content-type": "application/json" } : {}),
      },
      ...(method === "POST"
        ? { body: JSON.stringify({ synthetic: true }) }
        : {}),
    });
    assert.equal(response.status, 200, `${method} ${path}`);
  }

  const learningStudentId = "22222222-2222-4222-8222-222222222222";
  const learningRequests = [
    ["GET", "/local/learning-parent-controls"],
    ["GET", "/local/learning-parent-contact-intents"],
    ["POST", `/local/learning-parent-controls/${learningStudentId}`],
    ["POST", `/local/learning-parent-contact/${learningStudentId}`],
  ];
  for (const [method, path] of learningRequests) {
    const response = await globalThis.fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        origin: baseUrl,
        ...(method === "POST" ? { "content-type": "application/json" } : {}),
      },
      ...(method === "POST" ? { body: JSON.stringify({ synthetic: true }) } : {}),
    });
    assert.equal(response.status, 200, `${method} ${path}`);
  }

  for (const [method, path] of [
    ["GET", `/local/consents/${consentId}/revoke`],
    ["POST", `/local/consents/${consentId}/delete`],
    ["POST", "/local/consents/not-a-uuid/revoke"],
    ["PATCH", "/local/binding-applications"],
    ["POST", "/local/privacy-requests"],
    ["GET", "/local/consent-policies?unexpected=value"],
    ["POST", "/local/guardian-binding/applications?unexpected=value"],
    ["POST", "/local/guardian-binding/applications"],
    ["GET", "/local/guardian-binding/applications/unexpected"],
    ["GET", `/local/learning-parent-controls/${learningStudentId}`],
    ["POST", "/local/learning-parent-controls/not-a-uuid"],
    ["POST", "/local/learning-parent-contact/not-a-uuid"],
    ["POST", "/local/learning-parent-contact-intents"],
  ]) {
    const response = await globalThis.fetch(`${baseUrl}${path}`, { method });
    assert.equal(response.ok, false, `${method} ${path}`);
    assert.ok(response.status >= 400, `${method} ${path}`);
  }

  assert.deepEqual(
    received.map(({ method, url }) => `${method} ${url}`),
    [
      "GET /local/care-records",
      "POST /local/care-records",
      ...consentRequests.map(([method, path]) => `${method} ${path}`),
      ...learningRequests.map(([method, path]) => `${method} ${path}`),
    ],
  );
  assert.equal(
    received.every(
      ({ origin }) => origin === `http://127.0.0.1:${servicePort}`,
    ),
    true,
  );
});
