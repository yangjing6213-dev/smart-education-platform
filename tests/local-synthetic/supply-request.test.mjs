import assert from "node:assert/strict";
import test from "node:test";
import { buildLocalSyntheticServer } from "../../apps/api/dist/src/local-synthetic/server.js";

test("supply request loopback contract exposes fixed catalog and claim state", async () => {
  const app = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  const base = await app.start(0);
  async function request(actor, method, path, body) {
    const response = await globalThis.fetch(base + path, {
      method,
      headers: {
        ...(actor ? { authorization: `Bearer ${actor}` } : {}),
        "content-type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  }
  async function session(profile) {
    return (await request("", "POST", "/local/sessions", { profile })).body.handle;
  }
  try {
    const teacher = await session("teacher-east");
    const owner = await session("owner-east");
    const created = await request(teacher, "POST", "/local/supply-requests", {
      catalog: "ART_ACTIVITY_SET",
      quantity: 2,
      purpose: "CLASS_ACTIVITY",
    });
    assert.equal(created.status, 201);
    let row = created.body;
    for (const [actor, action, body] of [
      [teacher, "submit", { version: row.version }],
      [owner, "review", { version: row.version + 1, action: "CONFIRM" }],
      [teacher, "claim", { version: row.version + 2 }],
    ]) {
      const next = await request(actor, "POST", `/local/supply-requests/${row.id}/${action}`, body);
      assert.equal(next.status, 200);
      row = next.body;
    }
    assert.equal(row.status, "CLAIMED");
    assert.equal(row.synthetic, true);
  } finally {
    await app.close();
  }
});
