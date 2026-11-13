import assert from "node:assert/strict";
import { request } from "node:http";
import test from "node:test";
import { buildLocalSyntheticServer } from "../../apps/api/dist/src/local-synthetic/server.js";

async function http(base, actor, method, path, body) {
  return new Promise((resolve, reject) => {
    const req = request(
      base + path,
      {
        method,
        headers: {
          ...(actor ? { Authorization: `Bearer ${actor}` } : {}),
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
      },
      (response) => {
        let text = "";
        response.setEncoding("utf8");
        response.on("data", (part) => (text += part));
        response.on("error", reject);
        response.on("end", () => resolve({ status: response.statusCode, body: JSON.parse(text) }));
      },
    );
    req.on("error", reject);
    req.end(body === undefined ? undefined : JSON.stringify(body));
  });
}

test("loopback fees are read-only, scope-bound and synthetic", async () => {
  const app = await buildLocalSyntheticServer({
    mode: "local-synthetic",
    now: () => Date.parse("2026-10-12T01:00:00.000Z"),
  });
  const base = await app.start(0);
  async function session(profile) {
    const response = await http(base, "", "POST", "/local/sessions", { profile });
    assert.equal(response.status, 201);
    return response.body.handle;
  }
  try {
    const parent = await session("parent-alpha");
    const owner = await session("owner-east");
    const pending = await http(base, parent, "POST", "/local/binding-applications", {
      student: "student-alpha",
      relationship: "GUARDIAN",
    });
    assert.equal(pending.status, 201);
    const approved = await http(
      base,
      owner,
      "POST",
      `/local/binding-applications/${pending.body.id}/review`,
      { version: pending.body.version, action: "approve" },
    );
    assert.equal(approved.status, 200);

    const list = await http(base, parent, "GET", "/local/fees");
    assert.equal(list.status, 200);
    assert.ok(list.body.some((row) => row.available && row.documentType === "AGREEMENT"));
    assert.ok(list.body.some((row) => !row.available && row.unavailableReason));
    assert.ok(list.body.every((row) => row.synthetic === true));
    assert.ok(list.body.every((row) => !Object.hasOwn(row, "tenantId")));
    const active = list.body.find((row) => row.available);
    const downloaded = await http(base, parent, "GET", `/local/fees/${active.id}/download`);
    assert.equal(downloaded.status, 200);
    assert.match(downloaded.body.text, /合成数据/);
    assert.equal((await http(base, parent, "POST", "/local/fees", {})).status, 404);

    const summary = await http(base, owner, "GET", "/local/fee-summary");
    assert.equal(summary.status, 200);
    assert.equal(summary.body.synthetic, true);
    assert.equal(Object.hasOwn(summary.body, "studentId"), false);
    assert.equal(Object.hasOwn(summary.body, "paymentUrl"), false);
  } finally {
    await app.close();
  }
});
