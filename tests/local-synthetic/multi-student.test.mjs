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
        response.on("data", (part) => {
          body += part;
        });
        response.on("error", reject);
        response.on("end", () => resolve({ status: response.statusCode, body: JSON.parse(body) }));
      },
    );
    req.on("error", reject);
    req.end(data ? JSON.stringify(data) : undefined);
  });
}

test("independent HTTP sessions preserve child attribution, publication privacy and release isolation", async () => {
  const app = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  const base = await app.start(0);
  async function ok(actor, method, path, body, expected = 200) {
    const result = await http(base, actor, method, path, body);
    assert.equal(result.status, expected, JSON.stringify(result.body));
    return result.body;
  }
  async function session(profile) {
    return (await ok("", "POST", "/local/sessions", { profile }, 201)).handle;
  }
  try {
    const parent = await session("parent-alpha"),
      parentAgain = await session("parent-alpha"),
      other = await session("parent-beta"),
      teacher = await session("teacher-east"),
      owner = await session("owner-east");
    const options = await ok(parent, "GET", "/local/student-options");
    assert.deepEqual(
      options.map((s) => s.alias),
      ["student-alpha", "student-beta"],
    );
    const bindings = [],
      records = [],
      leaves = [];
    for (const option of options) {
      let binding = await ok(
        parent,
        "POST",
        "/local/binding-applications",
        { student: option.alias, relationship: "GUARDIAN" },
        201,
      );
      const reviewerList = await ok(owner, "GET", "/local/binding-applications");
      assert.equal(reviewerList.find((r) => r.id === binding.id).studentId, option.id);
      binding = await ok(owner, "POST", `/local/binding-applications/${binding.id}/review`, {
        version: binding.version,
        action: "approve",
      });
      bindings.push(binding);
      const leave = await ok(
        parent,
        "POST",
        "/local/leave-requests",
        {
          bindingId: binding.id,
          startDate: "2026-10-19",
          endDate: "2026-10-19",
          reason: "FAMILY_ARRANGEMENT",
        },
        201,
      );
      assert.equal(leave.studentId, option.id);
      leaves.push(leave);
      let record = await ok(
        teacher,
        "POST",
        "/local/care-records",
        {
          student: option.alias,
          date: "2026-10-19",
          values: {
            arrival: "ARRIVED_AS_PLANNED",
            homework: "COMPLETED",
            meal: "FINISHED",
            rest: "RESTED",
            activity: "PARTICIPATED",
            wellbeing: "ROUTINE",
          },
        },
        201,
      );
      assert.equal(record.studentLabel, option.label);
      record = await ok(teacher, "POST", `/local/care-records/${record.id}/submit`, {
        version: record.version,
      });
      record = await ok(owner, "POST", `/local/care-records/${record.id}/review`, {
        version: record.version,
        action: "confirm",
      });
      assert.equal(
        (await http(base, parent, "GET", `/local/care-records/${record.id}`)).status,
        403,
      );
      record = await ok(owner, "POST", `/local/care-records/${record.id}/publish`, {
        version: record.version,
      });
      const safe = await ok(parentAgain, "GET", `/local/care-records/${record.id}`);
      assert.equal(safe.studentId, option.id);
      assert.equal(safe.studentLabel, option.label);
      assert.equal(safe.bindingId, binding.id);
      assert.equal(safe.receipt, "UNREAD");
      assert.equal(Object.hasOwn(safe, "history"), false);
      records.push(record);
      for (const action of ["read", "acknowledge"])
        await ok(parent, "POST", `/local/care-records/${record.id}/receipt`, {
          version: record.version,
          publicationVersion: record.publicationVersion,
          bindingId: binding.id,
          action,
        });
    }
    assert.equal((await ok(parentAgain, "GET", "/local/care-records")).length, 2);
    assert.deepEqual(await ok(other, "GET", "/local/care-records"), []);
    const a = bindings[0],
      b = bindings[1];
    await ok(parent, "POST", `/local/binding-applications/${a.id}/release`, { version: a.version });
    const retained = await ok(parentAgain, "GET", "/local/care-records");
    assert.equal(retained.length, 1);
    assert.equal(retained[0].studentId, b.studentId);
    assert.equal(retained[0].receipt, "ACKNOWLEDGED");
    assert.equal(
      (await http(base, parentAgain, "GET", `/local/leave-requests/${leaves[0].id}`)).status,
      403,
    );
    assert.equal((await ok(teacher, "GET", "/local/leave-requests")).length, 1);
    assert.equal(
      (
        await http(base, parentAgain, "POST", `/local/care-records/${records[0].id}/receipt`, {
          version: records[0].version,
          publicationVersion: records[0].publicationVersion,
          bindingId: a.id,
          action: "read",
        })
      ).status,
      403,
    );
    assert.equal(
      (await ok(parentAgain, "GET", `/local/leave-requests/${leaves[1].id}`)).studentId,
      b.studentId,
    );
    const outsider = await session("teacher-other-class");
    assert.deepEqual(await ok(outsider, "GET", "/local/student-options"), []);
    assert.equal(
      (await http(base, outsider, "GET", `/local/care-records/${records[1].id}`)).status,
      403,
    );
    await ok(parent, "POST", "/local/session/end", {});
    assert.equal((await http(base, parent, "GET", "/local/student-options")).status, 401);
    assert.equal((await ok(parentAgain, "GET", "/local/student-options")).length, 2);
  } finally {
    await app.close();
  }
});
