import assert from "node:assert/strict";
import { request } from "node:http";
import test from "node:test";
import { buildLocalSyntheticServer } from "../../apps/api/dist/src/local-synthetic/server.js";

async function http(base, actor, method, path, data) {
  return new Promise((resolve, reject) => {
    const req = request(
      base + path,
      {
        method,
        headers: {
          ...(actor ? { Authorization: `Bearer ${actor}` } : {}),
          ...(data ? { "Content-Type": "application/json" } : {}),
        },
      },
      (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (part) => (body += part));
        response.on("error", reject);
        response.on("end", () => resolve({ status: response.statusCode, body: JSON.parse(body) }));
      },
    );
    req.on("error", reject);
    req.end(data ? JSON.stringify(data) : undefined);
  });
}

test("loopback HTTP closes parent authorization, teacher verification and safe parent result", async () => {
  const app = await buildLocalSyntheticServer({
    mode: "local-synthetic",
    now: () => Date.parse("2026-10-12T01:00:00.000Z"),
  });
  const base = await app.start(0);
  async function ok(actor, method, path, body, status = 200) {
    const result = await http(base, actor, method, path, body);
    assert.equal(result.status, status, `${method} ${path}: ${JSON.stringify(result.body)}`);
    return result.body;
  }
  async function session(profile) {
    return (await ok("", "POST", "/local/sessions", { profile }, 201)).handle;
  }
  try {
    const parent = await session("parent-alpha");
    const teacher = await session("teacher-east");
    const owner = await session("owner-east");
    const binding = await ok(
      parent,
      "POST",
      "/local/binding-applications",
      {
        student: "student-alpha",
        relationship: "GUARDIAN",
      },
      201,
    );
    const approved = await ok(owner, "POST", `/local/binding-applications/${binding.id}/review`, {
      version: binding.version,
      action: "approve",
    });
    let attendance = await ok(
      teacher,
      "POST",
      "/local/attendance-records",
      {
        student: "student-alpha",
        date: "2026-10-12",
        status: "NOT_ARRIVED",
        time: null,
      },
      201,
    );
    attendance = await ok(teacher, "POST", `/local/attendance-records/${attendance.id}/arrive`, {
      version: attendance.version,
      time: "08:00",
    });
    let authorization = await ok(
      parent,
      "POST",
      "/local/pickup-authorizations",
      {
        bindingId: approved.id,
        recipient: "pickup-alpha",
        type: "TEMPORARY",
        startDate: "2026-10-12",
        endDate: "2026-10-12",
        startTime: "08:00",
        endTime: "18:00",
      },
      201,
    );
    authorization = await ok(
      parent,
      "POST",
      `/local/pickup-authorizations/${authorization.id}/activate`,
      {
        version: authorization.version,
      },
    );
    const credential = await ok(
      parent,
      "POST",
      `/local/pickup-authorizations/${authorization.id}/credential`,
      {
        version: authorization.version,
      },
    );
    const step = await ok(
      teacher,
      "POST",
      "/local/pickup-verifications",
      {
        student: "student-alpha",
        credential: credential.credential,
      },
      201,
    );
    const record = await ok(teacher, "POST", `/local/pickup-verifications/${step.id}/confirm`, {
      version: step.version,
      checks: { student: true, recipient: true, authorization: true },
    });
    assert.equal(record.recipient, "示例接送人甲");
    assert.equal(Object.hasOwn(record, "teacherId"), false);
    assert.equal((await ok(parent, "GET", "/local/pickup-records")).length, 1);
    assert.equal((await ok(owner, "GET", "/local/pickup-records")).length, 1);
    assert.equal(
      (await ok(teacher, "GET", `/local/attendance-records/${attendance.id}`)).status,
      "DEPARTED",
    );
    assert.equal((await http(base, "", "GET", "/local/pickup-records")).status, 401);
  } finally {
    await app.close();
  }
});
