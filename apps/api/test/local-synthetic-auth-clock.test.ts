import assert from "node:assert/strict";
import test from "node:test";
import { buildLocalSyntheticServer } from "../src/local-synthetic/server.js";

test("local synthetic authentication follows its injected clock for session expiry", async () => {
  let now = Date.parse("2026-10-12T01:00:00.000Z");
  const app = await buildLocalSyntheticServer({ mode: "local-synthetic", now: () => now });
  const headers = { host: "127.0.0.1:4317" };

  try {
    const created = await app.inject({
      method: "POST",
      url: "/local/sessions",
      headers,
      payload: { profile: "parent-alpha" },
    });
    assert.equal(created.statusCode, 201, created.body);
    const handle = created.json<{ handle: string }>().handle;

    const active = await app.inject({
      method: "GET",
      url: "/local/fees",
      headers: { ...headers, authorization: `Bearer ${handle}` },
    });
    assert.equal(active.statusCode, 200, active.body);

    now += 15 * 60 * 1000;
    const expired = await app.inject({
      method: "GET",
      url: "/local/fees",
      headers: { ...headers, authorization: `Bearer ${handle}` },
    });
    assert.equal(expired.statusCode, 401, expired.body);
  } finally {
    await app.close();
  }
});
