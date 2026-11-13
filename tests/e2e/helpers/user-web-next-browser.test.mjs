import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import process from "node:process";
import test from "node:test";
import { waitForHttp } from "./user-web-next-browser.mjs";

async function server(t, handler) {
  const instance = createServer(handler);
  instance.listen(0, "127.0.0.1");
  await once(instance, "listening");
  t.after(() => new Promise((done) => instance.close(done)));
  return "http://127.0.0.1:" + instance.address().port;
}

function child(t, code = "setInterval(() => {}, 1000)") {
  const instance = spawn(process.execPath, ["-e", code], {
    windowsHide: true,
    stdio: "ignore",
  });
  t.after(async () => {
    if (instance.exitCode !== null || instance.signalCode !== null) return;
    const exited = once(instance, "exit");
    instance.kill();
    await exited;
  });
  return instance;
}

test("startup failure names the actual service and exit code without leaking output", async (t) => {
  const worker = child(t, "process.exit(7)");
  await once(worker, "exit");
  await assert.rejects(
    waitForHttp("http://127.0.0.1:1", worker, () => "password=synthetic-secret", {
      serviceName: "本机合成 API",
      timeoutMs: 1000,
    }),
    (error) => {
      assert.match(error.message, /本机合成 API/);
      assert.match(error.message, /exit=7/);
      assert.doesNotMatch(error.message, /synthetic-secret|password/);
      return true;
    },
  );
});

test("HTTP 503 is not ready; wait for the following successful response", async (t) => {
  let attempts = 0;
  const url = await server(t, (_request, response) => {
    response.writeHead(++attempts === 1 ? 503 : 200);
    response.end("synthetic");
  });
  const response = await waitForHttp(url, child(t), () => "", { timeoutMs: 2000 });
  assert.equal(response.status, 200);
  await response.text();
  assert.equal(attempts, 2);
});

test("permanent HTTP failure reports status and respects the deadline", async (t) => {
  const url = await server(t, (_request, response) => {
    response.writeHead(503);
    response.end("not ready");
  });
  await assert.rejects(
    waitForHttp(url, child(t), () => "token=synthetic-secret", {
      serviceName: "用户网页",
      timeoutMs: 150,
    }),
    (error) => {
      assert.match(error.message, /用户网页.*超时/);
      assert.match(error.message, /HTTP 503/);
      assert.doesNotMatch(error.message, /synthetic-secret/);
      return true;
    },
  );
});

test("process launch errors are captured instead of escaping as unhandled errors", async () => {
  const worker = spawn("missing-a1269-synthetic-executable", [], {
    windowsHide: true,
    stdio: "ignore",
  });
  await assert.rejects(
    waitForHttp("http://127.0.0.1:1", worker, () => "", {
      serviceName: "用户网页",
      timeoutMs: 1000,
    }),
    /用户网页.*ENOENT/,
  );
});

test("signal termination is reported without waiting for HTTP timeout", async (t) => {
  const worker = child(t);
  await once(worker, "spawn");
  const exited = once(worker, "exit");
  worker.kill();
  await exited;
  await assert.rejects(
    waitForHttp("http://127.0.0.1:1", worker, () => "", { timeoutMs: 1000 }),
    /提前退出.*(?:signal=|exit=)/,
  );
});

test("an unavailable HTTP endpoint produces a bounded connection diagnostic", async (t) => {
  const listener = createServer();
  listener.listen(0, "127.0.0.1");
  await once(listener, "listening");
  const url = "http://127.0.0.1:" + listener.address().port;
  await new Promise((done) => listener.close(done));
  const started = Date.now();
  await assert.rejects(
    waitForHttp(url, child(t), () => "", {
      serviceName: "用户网页",
      timeoutMs: 100,
    }),
    /用户网页.*超时.*最后请求=ECONNREFUSED/,
  );
  assert.ok(Date.now() - started < 2000);
});
