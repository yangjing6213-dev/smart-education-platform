import assert from "node:assert/strict";
import test from "node:test";
import { buildLocalSyntheticServer } from "../../apps/api/dist/src/local-synthetic/server.js";

test("resource library loopback shares filtered items, version updates, revocation and anonymous summary", async () => {
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
    const peer = await session("teacher-other-class");
    const owner = await session("owner-east");
    const platform = await session("platform-admin");
    const unfiltered = await request(teacher, "GET", "/local/resources");
    assert.equal(unfiltered.status, 200, JSON.stringify(unfiltered.body));
    const filtered = await request(
      teacher,
      "GET",
      "/local/resources?grade=%E4%B8%89%E5%B9%B4%E7%BA%A7&subject=%E6%95%B0%E5%AD%A6&tag=%E5%B0%8F%E7%BB%84%E6%B4%BB%E5%8A%A8",
    );
    assert.equal(filtered.status, 200, JSON.stringify(filtered.body));
    assert.equal(filtered.body.length, 1);
    let row = filtered.body[0];
    const favorite = await request(teacher, "POST", `/local/resources/${row.id}/favorite`, {
      version: row.version,
      favorite: true,
    });
    assert.equal(favorite.status, 200);
    await request(teacher, "POST", `/local/resources/${row.id}/use`, { version: row.version });
    assert.equal((await request(teacher, "GET", "/local/resources-favorites")).body.length, 1);
    assert.equal((await request(peer, "GET", "/local/resources-favorites")).body.length, 0);
    const managed = await request(owner, "GET", "/local/resources-managed");
    row = managed.body.find((item) => item.id === row.id);
    const changed = await request(owner, "PATCH", `/local/resources/${row.id}`, {
      version: row.version,
      scope: "CLASS",
      classId: "00000000-0000-4000-8000-000000000067",
      expiresOn: "2026-12-31",
    });
    assert.equal(changed.status, 200);
    assert.equal(changed.body.version, row.version + 1);
    assert.equal((await request(peer, "GET", `/local/resources/${row.id}`)).status, 404);
    const revoked = await request(owner, "POST", `/local/resources/${row.id}/revoke`, {
      version: changed.body.version,
    });
    assert.equal(revoked.status, 200);
    assert.equal((await request(teacher, "GET", `/local/resources/${row.id}`)).status, 404);
    const summary = await request(platform, "GET", "/local/resource-summary");
    assert.deepEqual(Object.keys(summary.body).sort(), [
      "expired",
      "published",
      "revoked",
      "total",
    ]);
    assert.equal("items" in summary.body, false);
    assert.equal((await request(owner, "GET", "/local/resource-summary")).status, 403);
  } finally {
    await app.close();
  }
});
