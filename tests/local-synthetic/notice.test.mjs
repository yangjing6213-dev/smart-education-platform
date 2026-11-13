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

test("loopback notice flow shares one id/version and fails closed by scope", async () => {
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
    const teacher = await session("teacher-east");
    const owner = await session("owner-east");
    const otherCampus = await session("owner-west");
    const pending = await http(base, parent, "POST", "/local/binding-applications", {
      student: "student-alpha",
      relationship: "GUARDIAN",
    });
    assert.equal(pending.status, 201);
    const binding = await http(
      base,
      owner,
      "POST",
      `/local/binding-applications/${pending.body.id}/review`,
      { version: pending.body.version, action: "approve" },
    );
    assert.equal(binding.status, 200);

    const created = await http(base, teacher, "POST", "/local/notices", {
      template: "CLASS_ACTIVITY",
    });
    assert.equal(created.status, 201);
    assert.equal((await http(base, teacher, "GET", "/local/notice-owned")).body.length, 1);
    assert.equal(
      (
        await http(base, teacher, "POST", `/local/notices/${created.body.id}/submit`, {
          version: 1,
        })
      ).status,
      200,
    );
    assert.equal((await http(base, otherCampus, "GET", "/local/notice-review")).body.length, 0);
    assert.equal(
      (
        await http(base, owner, "POST", `/local/notices/${created.body.id}/review`, {
          version: 2,
          action: "CONFIRM",
        })
      ).status,
      200,
    );
    assert.equal(
      (await http(base, owner, "POST", `/local/notices/${created.body.id}/publish`, { version: 3 }))
        .status,
      200,
    );

    const list = await http(base, parent, "GET", "/local/notices");
    assert.equal(list.status, 200);
    assert.equal(list.body.length, 1);
    assert.equal(list.body[0].id, created.body.id);
    assert.equal(list.body[0].version, 4);
    assert.equal(list.body[0].receiptStatus, "UNREAD");
    assert.equal(
      (await http(base, parent, "POST", `/local/notices/${created.body.id}/read`, { version: 4 }))
        .body.receiptStatus,
      "READ",
    );
    assert.equal(
      (await http(base, parent, "POST", `/local/notices/${created.body.id}/ack`, { version: 4 }))
        .body.receiptStatus,
      "ACKNOWLEDGED",
    );
    const next = await http(base, owner, "POST", `/local/notices/${created.body.id}/publish`, {
      version: 4,
    });
    assert.equal(next.status, 200);
    assert.equal((await http(base, owner, "GET", "/local/notice-owned")).body[0].version, 5);
    assert.equal((await http(base, teacher, "GET", "/local/notice-owned")).body[0].version, 5);
    const refreshed = await http(base, parent, "GET", "/local/notices");
    assert.equal(refreshed.body[0].version, 5);
    assert.equal(refreshed.body[0].receiptStatus, "UNREAD");
    assert.equal(
      (await http(base, owner, "POST", `/local/notices/${created.body.id}/revoke`, { version: 5 }))
        .status,
      200,
    );
    assert.deepEqual((await http(base, parent, "GET", "/local/notices")).body, []);
  } finally {
    await app.close();
  }
});
