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

test("loopback health incident remains synthetic and scope-bound", async () => {
  const app = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  const base = await app.start(0);
  async function session(profile) {
    const result = await http(base, "", "POST", "/local/sessions", { profile });
    assert.equal(result.status, 201);
    return result.body.handle;
  }
  try {
    const parent = await session("parent-alpha");
    const teacher = await session("teacher-east");
    const owner = await session("owner-east");
    const pending = await http(base, parent, "POST", "/local/binding-applications", {
      student: "student-alpha",
      relationship: "GUARDIAN",
    });
    assert.equal(pending.status, 201);
    assert.equal(
      (
        await http(base, owner, "POST", `/local/binding-applications/${pending.body.id}/review`, {
          version: 1,
          action: "approve",
        })
      ).status,
      200,
    );
    const created = await http(base, teacher, "POST", "/local/health-incidents", {
      student: "student-alpha",
      observationCode: "URGENT_REVIEW",
      dispositionCode: "FOLLOW_UP_SCHEDULED",
    });
    assert.equal(created.status, 201);
    assert.equal(
      (
        await http(base, teacher, "POST", `/local/health-incidents/${created.body.id}/submit`, {
          version: 1,
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await http(base, owner, "POST", `/local/health-incidents/${created.body.id}/review`, {
          version: 2,
          action: "CONFIRM",
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await http(base, owner, "POST", `/local/health-incidents/${created.body.id}/publish`, {
          version: 3,
          summaryCode: "PLEASE_CHECK_PAGE_LATER",
        })
      ).status,
      200,
    );
    const visible = await http(base, parent, "GET", "/local/health-incidents");
    assert.equal(visible.status, 200);
    assert.equal(visible.body[0].id, created.body.id);
    assert.equal(visible.body[0].version, 4);
  } finally {
    await app.close();
  }
});
