import assert from "node:assert/strict";
import test from "node:test";
import { LocalRepository } from "../src/local-synthetic/repository.js";
import { buildLocalSyntheticServer } from "../src/local-synthetic/server.js";
import { StaffTaskService } from "../src/local-synthetic/task-assignment.service.js";
import { memberForActor } from "../src/local-synthetic/sessions.js";

type App = Awaited<ReturnType<typeof buildLocalSyntheticServer>>;
type Task = Record<string, unknown> & { id: string; version: number; status: string };
type Response = { statusCode: number; body: string; json(): unknown };

async function call(app: App, actor: string, method: "GET" | "POST", url: string, body?: unknown) {
  return app.inject({
    method,
    url,
    headers: { host: "127.0.0.1:4317", ...(actor ? { authorization: `Bearer ${actor}` } : {}) },
    ...(body === undefined ? {} : { payload: body as object }),
  } as never) as unknown as Promise<Response>;
}

async function session(app: App, profile: string) {
  const response = await call(app, "", "POST", "/local/sessions", { profile });
  assert.equal(response.statusCode, 201, response.body);
  return (response.json() as { handle: string }).handle;
}

test("staff task shares one versioned assign, claim, start, completion and owner check lifecycle", async () => {
  const app = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  try {
    const owner = await session(app, "owner-east");
    const teacher = await session(app, "teacher-east");
    const peer = await session(app, "teacher-east-peer");
    const ownerWest = await session(app, "owner-west");
    const assigneesResponse = await call(app, owner, "GET", "/local/staff-task-assignees");
    assert.equal(assigneesResponse.statusCode, 200, assigneesResponse.body);
    const assignees = assigneesResponse.json() as Array<{ actorId: string; label: string }>;
    const assignee = assignees.find((row) => row.label === "示例东校区教师");
    assert.ok(assignee);

    const createdResponse = await call(app, owner, "POST", "/local/staff-tasks", {
      code: "DAILY_CHECK",
      assigneeId: assignee.actorId,
      targetType: "CLASS",
      targetId: "00000000-0000-4000-8000-000000000067",
      dueDate: "2026-10-12",
      priority: "NORMAL",
    });
    assert.equal(createdResponse.statusCode, 201, createdResponse.body);
    let task = createdResponse.json() as Task;
    assert.equal(task.status, "ASSIGNED");
    assert.equal(task.version, 1);
    assert.equal((task as { title?: string }).title, "完成班级日常检查");

    assert.equal(
      (await call(app, peer, "POST", `/local/staff-tasks/${task.id}/claim`, { version: 1 }))
        .statusCode,
      403,
    );
    assert.deepEqual((await call(app, ownerWest, "GET", "/local/staff-tasks")).json(), []);

    const claimed = await call(app, teacher, "POST", `/local/staff-tasks/${task.id}/claim`, {
      version: task.version,
    });
    assert.equal(claimed.statusCode, 200, claimed.body);
    task = claimed.json() as Task;
    assert.equal(task.status, "CLAIMED");
    assert.equal(task.version, 2);

    assert.equal(
      (await call(app, teacher, "POST", `/local/staff-tasks/${task.id}/start`, { version: 1 }))
        .statusCode,
      409,
    );
    const started = await call(app, teacher, "POST", `/local/staff-tasks/${task.id}/start`, {
      version: task.version,
    });
    assert.equal(started.statusCode, 200, started.body);
    task = started.json() as Task;
    assert.equal(task.status, "IN_PROGRESS");

    const completed = await call(app, teacher, "POST", `/local/staff-tasks/${task.id}/complete`, {
      version: task.version,
      result: "FOLLOW_UP_REQUIRED",
    });
    assert.equal(completed.statusCode, 200, completed.body);
    task = completed.json() as Task;
    assert.equal(task.status, "COMPLETED");
    assert.equal(task.result, "FOLLOW_UP_REQUIRED");

    const checked = await call(app, owner, "POST", `/local/staff-tasks/${task.id}/check`, {
      version: task.version,
      action: "CONFIRM",
    });
    assert.equal(checked.statusCode, 200, checked.body);
    task = checked.json() as Task;
    assert.equal(task.status, "CHECKED");
    assert.equal(task.version, 5);
    assert.equal(task.checkerId, "00000000-0000-4000-8000-000000000004");

    const audit = (await call(app, owner, "GET", "/local/audit")).json() as Array<{
      objectId: string | null;
      action: string;
      version: number | null;
      outcome: string;
    }>;
    assert.deepEqual(
      audit
        .filter((event) => event.objectId === task.id && event.outcome === "ACCEPTED")
        .map((event) => [event.action, event.version, event.outcome]),
      [
        ["task.assign", 1, "ACCEPTED"],
        ["task.claim", 2, "ACCEPTED"],
        ["task.start", 3, "ACCEPTED"],
        ["task.complete", 4, "ACCEPTED"],
        ["task.check", 5, "ACCEPTED"],
      ],
    );
    assert.equal(
      audit.filter((event) => event.objectId === task.id && event.outcome === "DENIED").length,
      2,
    );
  } finally {
    await app.close();
  }
});

test("staff task rejects forged, out-of-scope, duplicate and non-task actors", async () => {
  const app = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  try {
    const owner = await session(app, "owner-east");
    const ownerWest = await session(app, "owner-west");
    const parent = await session(app, "parent-alpha");
    const assignees = (
      await call(app, owner, "GET", "/local/staff-task-assignees")
    ).json() as Array<{
      actorId: string;
      label: string;
    }>;
    const teacher = assignees.find((row) => row.label === "示例东校区教师");
    assert.ok(teacher);

    assert.equal(
      (
        await call(app, owner, "POST", "/local/staff-tasks", {
          code: "toString",
          assigneeId: teacher.actorId,
          targetType: "CLASS",
          targetId: "00000000-0000-4000-8000-000000000067",
          dueDate: "2026-10-12",
          priority: "NORMAL",
        })
      ).statusCode,
      400,
    );
    assert.equal(
      (
        await call(app, owner, "POST", "/local/staff-tasks", {
          code: "DAILY_CHECK",
          assigneeId: teacher.actorId,
          targetType: "CLASS",
          targetId: "00000000-0000-4000-8000-000000000068",
          dueDate: "2026-10-12",
          priority: "NORMAL",
          tenantId: "forged",
        })
      ).statusCode,
      400,
    );
    assert.equal(
      (
        await call(app, ownerWest, "POST", "/local/staff-tasks", {
          code: "DAILY_CHECK",
          assigneeId: teacher.actorId,
          targetType: "CLASS",
          targetId: "00000000-0000-4000-8000-000000000067",
          dueDate: "2026-10-12",
          priority: "NORMAL",
        })
      ).statusCode,
      403,
    );
    assert.equal((await call(app, parent, "GET", "/local/staff-tasks")).statusCode, 403);
  } finally {
    await app.close();
  }
});

test("staff task completion cannot be checked by its assignee", () => {
  const owner = memberForActor("00000000-0000-4000-8000-000000000004");
  assert.ok(owner);
  const repository = new LocalRepository();
  const service = new StaffTaskService(repository, () => Date.parse("2026-10-12T00:00:00.000Z"));
  repository.insert({
    id: "00000000-0000-4000-8000-000000000999",
    version: 4,
    kind: "staffTask",
    tenantId: owner.tenantId,
    campusId: owner.campusId,
    classId: owner.classIds[0]!,
    code: "DAILY_CHECK",
    targetType: "CLASS",
    targetId: owner.classIds[0]!,
    dueDate: "2026-10-12",
    priority: "NORMAL",
    status: "COMPLETED",
    createdBy: "00000000-0000-4000-8000-000000000003",
    assigneeId: owner.actorId,
    claimedBy: owner.actorId,
    completedBy: owner.actorId,
    result: "COMPLETED_AS_PLANNED",
    checkerId: null,
    updatedBy: owner.actorId,
    updatedAt: "2026-10-12T00:00:00.000Z",
  });
  assert.throws(
    () =>
      service.check(owner, "00000000-0000-4000-8000-000000000999", {
        version: 4,
        action: "CONFIRM",
      }),
    (error: unknown) =>
      typeof error === "object" &&
      error !== null &&
      "statusCode" in error &&
      error.statusCode === 403,
  );
});

test("task overdue uses the Shanghai calendar day and ignores terminal tasks", () => {
  const teacher = memberForActor("00000000-0000-4000-8000-000000000003");
  assert.ok(teacher);
  const repository = new LocalRepository();
  const service = new StaffTaskService(
    repository,
    () => Date.parse("2026-10-12T17:00:00.000Z"), // 2026-10-13 01:00 in Shanghai.
  );
  const base = {
    version: 1,
    kind: "staffTask" as const,
    tenantId: teacher.tenantId,
    campusId: teacher.campusId,
    classId: teacher.classIds[0]!,
    code: "DAILY_CHECK" as const,
    targetType: "CLASS" as const,
    targetId: teacher.classIds[0]!,
    priority: "NORMAL" as const,
    createdBy: teacher.actorId,
    assigneeId: teacher.actorId,
    claimedBy: null,
    completedBy: null,
    result: null,
    checkerId: null,
    updatedBy: teacher.actorId,
    updatedAt: "2026-10-12T17:00:00.000Z",
  };
  for (const [id, dueDate, status] of [
    ["task-past", "2026-10-12", "ASSIGNED"],
    ["task-today", "2026-10-13", "ASSIGNED"],
    ["task-future", "2026-10-14", "ASSIGNED"],
    ["task-checked", "2026-10-12", "CHECKED"],
    ["task-cancelled", "2026-10-12", "CANCELLED"],
  ] as const) {
    repository.insert({
      ...base,
      id,
      dueDate,
      status,
      ...(status === "CHECKED"
        ? { completedBy: teacher.actorId, result: "COMPLETED_AS_PLANNED" as const }
        : {}),
    });
  }

  const tasks = new Map(service.list(teacher).map((task) => [task.id, task]));
  assert.equal(tasks.get("task-past")?.overdue, true);
  assert.equal(tasks.get("task-today")?.overdue, false);
  assert.equal(tasks.get("task-future")?.overdue, false);
  assert.equal(tasks.get("task-checked")?.overdue, false);
  assert.equal(tasks.get("task-cancelled")?.overdue, false);
});
