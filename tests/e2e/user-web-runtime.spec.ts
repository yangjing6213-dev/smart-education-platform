import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { request } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import test from "node:test";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const packageRoot = resolve(repositoryRoot, "apps/user-web");

function getText(url: string): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolvePromise, reject) => {
    const requestInstance = request(url, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer) => chunks.push(chunk));
      response.on("end", () => {
        resolvePromise({
          statusCode: response.statusCode ?? 0,
          body: Buffer.concat(chunks).toString("utf8"),
        });
      });
    });
    requestInstance.on("error", reject);
    requestInstance.end();
  });
}

function waitForStartup(processInstance: ReturnType<typeof spawn>): Promise<{
  pid: number;
  host: string;
  port: number;
  baseUrl: string;
}> {
  return new Promise((resolvePromise, reject) => {
    let output = "";
    const onData = (chunk: Buffer) => {
      output += chunk.toString("utf8");
      const line = output.split(/\r?\n/u).find((candidate) => candidate.trim().startsWith("{"));
      if (line === undefined) {
        return;
      }

      try {
        const startup = JSON.parse(line) as {
          pid: number;
          host: string;
          port: number;
          baseUrl: string;
        };
        resolvePromise(startup);
      } catch {
        // Wait for a complete JSON line.
      }
    };
    processInstance.stdout?.on("data", onData);
    processInstance.once("error", reject);
    processInstance.once("exit", (code) => {
      reject(new Error(`preview exited before startup: ${code}\n${output}`));
    });
  });
}

test("user-web preview serves the real visitor runtime on loopback", async () => {
  const indexHtml = await readFile(resolve(packageRoot, "index.html"), "utf8");
  const stylesheet = await readFile(resolve(packageRoot, "src/styles/user-web.css"), "utf8");
  assert.match(indexHtml, /href="\/styles\/user-web\.css"/u);
  assert.match(indexHtml, /src="\/main\.js"/u);
  assert.match(indexHtml, /href="\/assets\/tongxin-logo\.png"/u);
  assert.match(stylesheet, /font-family:\s*"Microsoft YaHei"/u);
  assert.doesNotMatch(indexHtml, /https?:\/\//u);

  const preview = spawn(process.execPath, ["preview.mjs"], {
    cwd: packageRoot,
    stdio: ["ignore", "pipe", "pipe"],
  });

  let startup: Awaited<ReturnType<typeof waitForStartup>>;
  try {
    startup = await waitForStartup(preview);
    assert.equal(startup.pid, preview.pid);
    assert.equal(startup.host, "127.0.0.1");
    assert.ok(startup.port > 0);
    assert.equal(startup.baseUrl, `http://127.0.0.1:${startup.port}`);

    const visitor = await getText(`${startup.baseUrl}/visitor`);
    const compatibility = await getText(`${startup.baseUrl}/web/visitor/home`);
    assert.equal(visitor.statusCode, 200);
    assert.equal(compatibility.statusCode, 200);
    assert.equal(visitor.body, compatibility.body);
    assert.match(visitor.body, /data-app-root/u);

    for (const path of [
      "/staff/workbench",
      "/staff/report",
      "/staff/guides",
      "/web/staff/resources",
    ] as const) {
      const page = await getText(`${startup.baseUrl}${path}`);
      assert.equal(page.statusCode, 200, path);
      assert.match(page.body, /data-app-root/u, path);
      assert.match(page.body, /src="\/main\.js"/u, path);
      assert.equal(page.body, visitor.body, path);
    }

    const traversal = await getText(`${startup.baseUrl}/%2e%2e/%2e%2e/package.json`);
    assert.equal(traversal.statusCode, 404);
  } finally {
    preview.kill("SIGTERM");
    await new Promise<void>((resolvePromise) => preview.once("exit", () => resolvePromise()));
  }
});
