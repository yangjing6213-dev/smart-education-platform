/* global fetch, URL */
import assert from "node:assert/strict";
import test from "node:test";
import { buildLocalSyntheticServer } from "../../apps/api/dist/src/local-synthetic/server.js";

test("local statistics HTTP endpoints enforce scoped filters and keep platform output anonymous", async () => {
  const server = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  const origin = new URL(await server.start(0));
  const call = async (handle, method, path, body, expected = 200) => {
    const response = await fetch(new URL(path, origin), {
      method,
      headers: {
        origin: origin.origin,
        ...(handle ? { authorization: `Bearer ${handle}` } : {}),
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    assert.equal(response.status, expected, `${method} ${path}`);
    return response.status === 204 ? null : response.json();
  };
  try {
    const owner = (await call("", "POST", "/local/sessions", { profile: "owner-east" }, 201))
      .handle;
    const teacher = (await call("", "POST", "/local/sessions", { profile: "teacher-east" }, 201))
      .handle;
    const platform = (await call("", "POST", "/local/sessions", { profile: "platform-admin" }, 201))
      .handle;
    const session = await call(owner, "GET", "/local/session");
    const assignees = await call(owner, "GET", "/local/staff-task-assignees");

    await call(
      owner,
      "POST",
      "/local/staff-tasks",
      {
        code: "DAILY_CHECK",
        assigneeId: assignees[0].actorId,
        targetType: "CLASS",
        targetId: session.classIds[0],
        dueDate: "2026-10-07",
        priority: "NORMAL",
      },
      201,
    );
    await call(
      teacher,
      "POST",
      "/local/attendance-records",
      {
        student: "student-alpha",
        date: "2026-10-07",
        status: "ARRIVED",
        time: "09:00",
      },
      201,
    );
    await call(
      teacher,
      "POST",
      "/local/pickup-exceptions",
      {
        student: "student-alpha",
        date: "2026-10-07",
        category: "OVERDUE",
      },
      201,
    );

    const result = await call(
      owner,
      "GET",
      `/local/statistics?from=2026-10-07&to=2026-10-07&classId=${session.classIds[0]}`,
    );
    assert.equal(result.totals.tasks, 1);
    assert.equal(result.totals.attendance, 1);
    assert.equal(result.totals.pickupExceptions, 1);
    assert.equal(result.totals.total, 3);
    assert.equal(result.groups.length, 3);
    assert.ok(
      result.groups.every((group) => group.sources.every((source) => source.version === 1)),
    );
    assert.doesNotMatch(JSON.stringify(result), /student-alpha|示例学生|studentId/u);

    await call(
      owner,
      "GET",
      "/local/statistics?from=2026-10-07&to=2026-10-07&campusId=forged",
      undefined,
      403,
    );
    await call(
      owner,
      "GET",
      "/local/statistics?from=2026-10-07&to=2026-10-07&unexpected=x",
      undefined,
      400,
    );
    await call(teacher, "GET", "/local/statistics?from=2026-10-07&to=2026-10-07", undefined, 403);

    const anonymous = await call(platform, "GET", "/local/statistics-summary");
    assert.equal(anonymous.mode, "ANONYMOUS");
    assert.equal(anonymous.totals.total, 3);
    assert.deepEqual(Object.keys(anonymous).sort(), ["mode", "totals"]);
    assert.deepEqual(Object.keys(anonymous.totals).sort(), [
      "attendance",
      "healthIncidents",
      "pickupExceptions",
      "tasks",
      "total",
    ]);
    assert.doesNotMatch(
      JSON.stringify(anonymous),
      /student-alpha|studentId|sources|campusId|classId|00000000-/u,
    );
    await call(platform, "GET", "/local/statistics", undefined, 403);
    await call(owner, "GET", "/local/statistics-summary", undefined, 403);
  } finally {
    await server.close();
  }
});
