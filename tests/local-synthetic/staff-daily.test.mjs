import assert from "node:assert/strict";
import { request } from "node:http";
import test from "node:test";
import { buildLocalSyntheticServer } from "../../apps/api/dist/src/local-synthetic/server.js";

function http(base, actor, method, path, body) {
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
        response.on("data", (part) => {
          text += part;
        });
        response.on("error", reject);
        response.on("end", () => resolve({ status: response.statusCode, body: JSON.parse(text) }));
      },
    );
    req.on("error", reject);
    req.end(body === undefined ? undefined : JSON.stringify(body));
  });
}

test("loopback HTTP keeps staff daily report internal and versioned", async () => {
  const app = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  const base = await app.start(0);
  async function call(actor, method, path, body, expected = 200) {
    const result = await http(base, actor, method, path, body);
    assert.equal(result.status, expected, JSON.stringify(result.body));
    return result.body;
  }
  async function session(profile) {
    return (await call("", "POST", "/local/sessions", { profile }, 201)).handle;
  }
  try {
    const teacher = await session("teacher-east");
    const owner = await session("owner-east");
    const parent = await session("parent-alpha");
    const values = {
      arrival: "ARRIVED_AS_PLANNED",
      homework: "COMPLETED",
      activity: "PARTICIPATED",
      classroom: "ROUTINE",
      followUp: "NONE",
    };
    let row = await call(
      teacher,
      "POST",
      "/local/staff-daily-reports",
      {
        date: "2026-10-06",
        values,
      },
      201,
    );
    assert.equal(row.status, "DRAFT");
    assert.equal(
      (await call(parent, "GET", "/local/staff-daily-reports", undefined, 403)).error.code,
      "UNAVAILABLE",
    );
    row = await call(teacher, "POST", `/local/staff-daily-reports/${row.id}/submit`, {
      version: row.version,
    });
    row = await call(owner, "POST", `/local/staff-daily-reports/${row.id}/review`, {
      version: row.version,
      action: "RETURN",
    });
    assert.equal(row.status, "RETURNED");
    row = await call(teacher, "POST", `/local/staff-daily-reports/${row.id}/resubmit`, {
      version: row.version,
      values: { ...values, followUp: "OBSERVE_TOMORROW" },
    });
    row = await call(owner, "POST", `/local/staff-daily-reports/${row.id}/review`, {
      version: row.version,
      action: "CONFIRM",
    });
    assert.equal(row.status, "CONFIRMED");
    assert.equal(
      (
        await call(
          teacher,
          "POST",
          `/local/staff-daily-reports/${row.id}/submit`,
          { version: 1 },
          409,
        )
      ).error.code,
      "STATE_CONFLICT",
    );
    assert.equal((await call(owner, "GET", "/local/staff-daily-review")).length, 0);
    assert.equal((await call(owner, "GET", "/local/staff-daily-reports"))[0].id, row.id);
  } finally {
    await app.close();
  }
});
