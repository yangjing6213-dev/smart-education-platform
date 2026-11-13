/* global AbortSignal, AbortController, setTimeout, Headers */
import assert from "node:assert/strict";
import test from "node:test";
import { LearningInstitutionSettingAdminClient } from "../src/local-review/learning-institution-setting.ts";

const response = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});
const setting = (enabled = false, version = 0) => ({ data: { enabled, version } });

test("default browser transport keeps the global fetch receiver", async (t) => {
  let validReceiver = false;
  t.mock.method(globalThis, "fetch", async function () {
    assert.equal(this, globalThis);
    validReceiver = true;
    return response(setting());
  });
  const client = new LearningInstitutionSettingAdminClient();
  await client.connect();
  assert.equal(validReceiver, true);
  assert.equal(client.snapshot.status, "READY");
});

test("hung reads and saves time out and can be recovered by reading again", async (t) => {
  let aborted = 0;
  let hang = true;
  t.mock.method(AbortSignal, "timeout", (milliseconds) => {
    assert.equal(milliseconds, 10000);
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 1);
    return controller.signal;
  });
  const client = new LearningInstitutionSettingAdminClient(async (_, init) => {
    if (!hang) return response(setting());
    assert.ok(init.signal);
    return new Promise((_, reject) => {
      init.signal.addEventListener(
        "abort",
        () => {
          aborted++;
          reject(init.signal.reason);
        },
        { once: true },
      );
    });
  });
  await client.connect();
  assert.equal(aborted, 1);
  assert.equal(client.snapshot.status, "ERROR");
  hang = false;
  await client.connect();
  assert.equal(client.snapshot.status, "READY");
  hang = true;
  await client.setEnabled(true);
  assert.equal(aborted, 2);
  assert.equal(client.snapshot.status, "ERROR");
  assert.deepEqual(client.snapshot.setting, { enabled: false, version: 0 });
  hang = false;
  await client.connect();
  assert.equal(client.snapshot.status, "READY");
});

test("institution setting uses the signed-in same-origin session and versioned writes", async () => {
  const calls = [];
  const client = new LearningInstitutionSettingAdminClient(async (path, init) => {
    calls.push({ path, init });
    return response(init.method === "GET" ? setting() : setting(true, 1));
  });
  await client.connect();
  assert.equal(client.snapshot.status, "READY");
  await client.setEnabled(true);
  assert.deepEqual(client.snapshot.setting, { enabled: true, version: 1 });
  assert.equal(calls.length, 2);
  for (const { path, init } of calls) {
    assert.equal(path, "/api/admin/learning-institution-setting");
    assert.equal(init.credentials, "same-origin");
    assert.equal(new Headers(init.headers).has("authorization"), false);
  }
  assert.equal(calls[1].init.method, "POST");
  assert.deepEqual(JSON.parse(calls[1].init.body), { enabled: true, expectedVersion: 0 });
});

test("anonymous, forbidden and temporarily unavailable states are distinct and retryable", async () => {
  for (const [code, expected] of [
    [401, "UNAUTHENTICATED"],
    [403, "DENIED"],
    [503, "ERROR"],
  ]) {
    let status = code;
    const client = new LearningInstitutionSettingAdminClient(async () =>
      response(setting(), status),
    );
    await client.connect();
    assert.equal(client.snapshot.status, expected);
    assert.equal(client.snapshot.setting, null);
    status = 200;
    await client.connect();
    assert.equal(client.snapshot.status, "READY");
  }
});

test("a version conflict requires re-reading before another write", async () => {
  let writes = 0;
  const client = new LearningInstitutionSettingAdminClient(async (_, init) => {
    if (init.method === "GET") return response(setting());
    writes++;
    return response({ error: { code: "CONFLICT_STATE" } }, 409);
  });
  await client.connect();
  await client.setEnabled(true);
  assert.equal(client.snapshot.status, "CONFLICT");
  assert.deepEqual(client.snapshot.setting, { enabled: false, version: 0 });
  assert.match(client.snapshot.message, /重新读取/u);
  await client.setEnabled(true);
  assert.equal(writes, 1);
});

test("in-flight save cannot be duplicated or invalidated by refresh; disconnect discards its result", async () => {
  let resolveSave;
  let calls = 0;
  const client = new LearningInstitutionSettingAdminClient(async (_, init) => {
    calls++;
    if (init.method === "GET") return response(setting());
    return new Promise((resolve) => {
      resolveSave = resolve;
    });
  });
  await client.connect();
  const saving = client.setEnabled(true);
  assert.equal(client.snapshot.status, "BUSY");
  await client.setEnabled(true);
  await client.connect();
  assert.equal(calls, 2);
  client.disconnect();
  resolveSave(response(setting(true, 1)));
  await saving;
  assert.equal(client.snapshot.setting, null);
  assert.notEqual(client.snapshot.status, "READY");
});

test("late reads and malformed responses cannot replace a newer session snapshot", async () => {
  let first;
  let calls = 0;
  const client = new LearningInstitutionSettingAdminClient(async () => {
    if (++calls === 1)
      return new Promise((resolve) => {
        first = resolve;
      });
    return response(setting(true, 2));
  });
  const old = client.connect();
  await client.connect();
  first(response(setting()));
  await old;
  assert.deepEqual(client.snapshot.setting, { enabled: true, version: 2 });
  for (const data of [
    { enabled: true, version: 0 },
    { enabled: false, version: -1 },
    { enabled: false, version: 1, tenantId: "hidden" },
  ]) {
    const malformed = new LearningInstitutionSettingAdminClient(async () => response({ data }));
    await malformed.connect();
    assert.equal(malformed.snapshot.status, "ERROR");
    assert.equal(malformed.snapshot.setting, null);
  }
});

test("unconfirmed save preserves the last known setting and requires refresh", async () => {
  const client = new LearningInstitutionSettingAdminClient(async (_, init) =>
    response(init.method === "GET" ? setting() : setting(false, 2)),
  );
  await client.connect();
  await client.setEnabled(true);
  assert.equal(client.snapshot.status, "ERROR");
  assert.deepEqual(client.snapshot.setting, { enabled: false, version: 0 });
});
