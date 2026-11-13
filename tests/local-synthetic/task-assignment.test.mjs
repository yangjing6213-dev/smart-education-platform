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

test("loopback assignment flow shares one task across owner and employee views", async () => {
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
    const owner = await session("owner-east");
    const teacher = await session("teacher-east");
    const parent = await session("parent-alpha");
    const assignees = await call(owner, "GET", "/local/staff-task-assignees");
    const assignee = assignees.find(
      (row) => row.actorId === "00000000-0000-4000-8000-000000000003",
    );
    assert.ok(assignee);

    let task = await call(
      owner,
      "POST",
      "/local/staff-tasks",
      {
        code: "ACTIVITY_SETUP",
        assigneeId: assignee.actorId,
        targetType: "ACTIVITY",
        targetId: "ART_WORKSHOP",
        dueDate: "2026-10-13",
        priority: "IMPORTANT",
      },
      201,
    );
    const id = task.id;
    assert.equal(task.status, "ASSIGNED");
    task = await call(teacher, "POST", `/local/staff-tasks/${id}/claim`, { version: task.version });
    task = await call(teacher, "POST", `/local/staff-tasks/${id}/start`, { version: task.version });
    task = await call(teacher, "POST", `/local/staff-tasks/${id}/complete`, {
      version: task.version,
      result: "COMPLETED_AS_PLANNED",
    });
    assert.equal(task.status, "COMPLETED");

    const ownerRow = (await call(owner, "GET", "/local/staff-task-review"))[0];
    const teacherRow = (await call(teacher, "GET", "/local/staff-tasks"))[0];
    assert.equal(ownerRow.id, id);
    assert.equal(teacherRow.id, id);
    assert.equal(ownerRow.version, teacherRow.version);
    assert.equal(
      (await call(parent, "GET", "/local/staff-tasks", undefined, 403)).error.code,
      "UNAVAILABLE",
    );

    const checked = await call(owner, "POST", `/local/staff-tasks/${id}/check`, {
      version: task.version,
      action: "CONFIRM",
    });
    assert.equal(checked.status, "CHECKED");
    assert.equal((await call(owner, "GET", "/local/staff-task-review")).length, 0);
  } finally {
    await app.close();
  }
});
