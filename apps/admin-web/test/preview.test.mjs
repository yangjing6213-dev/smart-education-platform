import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import process from "node:process";
import { test } from "node:test";
import { clearTimeout, setTimeout } from "node:timers";
import { fileURLToPath, URL } from "node:url";

const adminRoot = fileURLToPath(new URL("../", import.meta.url));

test("admin preview serves nested module files instead of the page fallback", async (t) => {
  const child = spawn(process.execPath, [resolve(adminRoot, "preview.mjs")], {
    cwd: adminRoot,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  let errorOutput = "";
  let startupResolved = false;
  const startup = new Promise((resolveStartup, rejectStartup) => {
    const timeout = setTimeout(() => {
      rejectStartup(new Error(`Preview startup timed out. ${errorOutput}`));
    }, 8000);
    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
      for (const line of output.split(/\r?\n/u)) {
        if (!line) continue;
        try {
          const event = JSON.parse(line);
          if (event.event === "startup") {
            startupResolved = true;
            clearTimeout(timeout);
            resolveStartup(event);
          }
        } catch {
          // Wait for a complete JSON line.
        }
      }
      output = output.slice(output.lastIndexOf("\n") + 1);
    });
    child.stderr.on("data", (chunk) => {
      errorOutput += chunk.toString();
    });
    child.once("error", rejectStartup);
    child.once("exit", (code) => {
      if (!startupResolved) {
        clearTimeout(timeout);
        rejectStartup(new Error(`Preview exited before startup (${code}). ${errorOutput}`));
      }
    });
  });

  t.after(async () => {
    if (child.exitCode !== null) return;
    child.kill("SIGINT");
    await Promise.race([
      new Promise((resolveExit) => child.once("exit", resolveExit)),
      new Promise((resolveTimeout) => setTimeout(resolveTimeout, 2500)),
    ]);
    if (child.exitCode === null) child.kill();
  });

  const { baseUrl } = await startup;
  const page = await globalThis.fetch(`${baseUrl}/admin/fees`);
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /src=["']\.\/dist\/main\.js["']/u);

  const entryModule = await globalThis.fetch(`${baseUrl}/admin/dist/main.js`);
  assert.equal(entryModule.status, 200);
  assert.match(entryModule.headers.get("content-type") ?? "", /^text\/javascript/u);
  const entryBody = await entryModule.text();
  assert.doesNotMatch(entryBody.trimStart(), /^<!doctype html/iu);

  const importedModule = await globalThis.fetch(`${baseUrl}/admin/dist/pages/home-content.js`);
  assert.equal(importedModule.status, 200);
  assert.match(importedModule.headers.get("content-type") ?? "", /^text\/javascript/u);
  assert.match(await importedModule.text(), /HomeContentPage/u);

  assert.equal((await globalThis.fetch(`${baseUrl}/unrecognized-route`)).status, 404);
  assert.equal(
    (await globalThis.fetch(`${baseUrl}/admin/dist/main.js`, { method: "POST" })).status,
    405,
  );
});

test("Admin preview allows only the care-record review paths required by its screen", async (t) => {
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
  upstream.listen(0, "127.0.0.1");
  await once(upstream, "listening");
  const servicePort = upstream.address().port;
  const child = spawn(
    process.execPath,
    [resolve(adminRoot, "preview.mjs"), "--local-service-port", String(servicePort)],
    { cwd: adminRoot, stdio: ["ignore", "pipe", "pipe"] },
  );
  t.after(async () => {
    await Promise.all([
      (async () => {
        if (child.exitCode !== null) return;
        child.kill("SIGTERM");
        await Promise.race([
          once(child, "exit"),
          new Promise((resolveTimeout) => setTimeout(resolveTimeout, 2500)),
        ]);
        if (child.exitCode === null) child.kill();
      })(),
      new Promise((resolveClose, reject) =>
        upstream.close((error) => (error ? reject(error) : resolveClose())),
      ),
    ]);
  });
  let output = "";
  const baseUrl = await new Promise((resolveStartup, reject) => {
    const timeout = setTimeout(() => reject(new Error("Admin preview startup timed out.")), 8000);
    child.stdout.on("data", (chunk) => {
      output += chunk.toString("utf8");
      for (const line of output.split(/\r?\n/u)) {
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
      output = output.slice(output.lastIndexOf("\n") + 1);
    });
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Admin preview exited before startup (${code}).`));
    });
  });

  const id = "6e9a6a64-61b4-4caf-a991-e68403046764";
  const allowed = await globalThis.fetch(`${baseUrl}/local/care-records/${id}/review`, {
    method: "POST",
    headers: { origin: baseUrl, "content-type": "application/json" },
    body: JSON.stringify({ version: 1, action: "confirm" }),
  });
  assert.equal(allowed.status, 200);
  const forbidden = await globalThis.fetch(`${baseUrl}/local/care-records/${id}/submit`, {
    method: "POST",
    headers: { origin: baseUrl, "content-type": "application/json" },
    body: JSON.stringify({ version: 1 }),
  });
  assert.equal(forbidden.status, 404);
  assert.deepEqual(
    received.map(({ method, url }) => `${method} ${url}`),
    [`POST /local/care-records/${id}/review`],
  );
  assert.equal(received[0]?.origin, `http://127.0.0.1:${servicePort}`);
});
