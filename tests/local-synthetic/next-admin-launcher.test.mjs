import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";
import { once } from "node:events";
import { parseArgs, startNextAdminLocal } from "../../scripts/start-next-admin-local.mjs";

test("Next local launcher requires explicit synthetic mode and an exact loopback parent origin", () => {
  assert.deepEqual(parseArgs(["--local-synthetic"]), {});
  assert.deepEqual(parseArgs(["--local-synthetic", "--parent-origin", "http://127.0.0.1:31000"]), {
    parentOrigin: "http://127.0.0.1:31000",
  });
  for (const args of [
    [],
    ["--production"],
    ["--local-synthetic", "--port", "4317"],
    ["--local-synthetic", "--parent-origin", "https://example.com"],
    ["--local-synthetic", "--parent-origin", "http://user:pass@127.0.0.1:31000"],
    ["--local-synthetic", "--parent-origin", "http://127.0.0.1:31000/path"],
    ["--local-synthetic", "--parent-origin", "http://127.0.0.1:31000/"],
    ["--local-synthetic", "--parent-origin", "*"],
  ]) {
    assert.throws(() => parseArgs(args));
  }
});

test("programmatic launch rejects external origins before starting any service", async () => {
  await assert.rejects(startNextAdminLocal({ parentOrigin: "http://example.com:3000" }));
});

test("occupied 4319 is reported without stopping the existing server", async () => {
  const existing = createServer((_request, response) => response.end("still running"));
  existing.listen(4319, "127.0.0.1");
  await once(existing, "listening");
  try {
    await assert.rejects(startNextAdminLocal(), /4319 已被占用/u);
    assert.equal(existing.listening, true);
  } finally {
    existing.closeAllConnections();
    await new Promise((done, reject) =>
      existing.close((error) => (error ? reject(error) : done())),
    );
  }
});
