import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { URL } from "node:url";
import { resolveApiListenConfig } from "../src/nest/api-listen-config.ts";

test("Nest API main passes validated environment host and port to listen", async () => {
  const source = await readFile(new URL("../src/nest/api-main.ts", import.meta.url), "utf8");

  assert.match(source, /const listenConfig = resolveApiListenConfig\(process\.env\)/u);
  assert.match(source, /await app\.listen\(listenConfig\.port,\s*listenConfig\.host\)/u);
  assert.ok(
    source.indexOf("const listenConfig = resolveApiListenConfig(process.env)") <
      source.indexOf("const databaseUrl = process.env.DATABASE_URL"),
    "listener configuration must fail before any database connection is attempted",
  );
});

test("local API listener defaults to the loopback address and port", () => {
  assert.deepEqual(resolveApiListenConfig({ NODE_ENV: "development" }), {
    host: "127.0.0.1",
    port: 4321,
  });
  assert.deepEqual(resolveApiListenConfig({ NODE_ENV: "test" }), {
    host: "127.0.0.1",
    port: 4321,
  });
});

test("API listener accepts a configured valid port", () => {
  assert.deepEqual(resolveApiListenConfig({ NODE_ENV: "development", PORT: "8080" }), {
    host: "127.0.0.1",
    port: 8080,
  });
});

test("production listener requires an explicit supported host", () => {
  assert.throws(
    () => resolveApiListenConfig({ NODE_ENV: "production" }),
    /STUDENT_CARE_API_HOST is required/u,
  );
  assert.deepEqual(
    resolveApiListenConfig({ NODE_ENV: "production", STUDENT_CARE_API_HOST: "0.0.0.0" }),
    { host: "0.0.0.0", port: 4321 },
  );
  assert.deepEqual(
    resolveApiListenConfig({ NODE_ENV: "production", STUDENT_CARE_API_HOST: "127.0.0.1" }),
    { host: "127.0.0.1", port: 4321 },
  );
  assert.deepEqual(
    resolveApiListenConfig({ NODE_ENV: "production", STUDENT_CARE_API_HOST: "::" }),
    { host: "::", port: 4321 },
  );
  assert.deepEqual(
    resolveApiListenConfig({ NODE_ENV: "production", STUDENT_CARE_API_HOST: "::1" }),
    { host: "::1", port: 4321 },
  );
});

test("non-production listener rejects interfaces and unsupported production hosts", () => {
  assert.throws(
    () =>
      resolveApiListenConfig({
        NODE_ENV: "development",
        STUDENT_CARE_API_HOST: "0.0.0.0",
      }),
    /must stay on a loopback address/u,
  );
  assert.throws(
    () =>
      resolveApiListenConfig({
        NODE_ENV: "production",
        STUDENT_CARE_API_HOST: "api.example.invalid",
      }),
    /supported loopback or interface address/u,
  );
});

test("API listener rejects invalid ports", () => {
  for (const PORT of ["", "0", "65536", "4321tail", "1.5"]) {
    assert.throws(
      () => resolveApiListenConfig({ NODE_ENV: "development", PORT }),
      /PORT must be an integer from 1 to 65535/u,
    );
  }
});
