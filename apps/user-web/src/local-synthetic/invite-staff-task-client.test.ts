import assert from "node:assert/strict";
import test from "node:test";
import { InviteStaffTaskClient } from "./invite-staff-task-client.js";

const actorId = "00000000-0000-4000-8000-000000000003";
const taskId = "00000000-0000-4000-8000-000000000201";
const task = {
  id: taskId,
  version: 1,
  kind: "staffTask",
  tenantId: "00000000-0000-4000-8000-000000000064",
  campusId: "00000000-0000-4000-8000-000000000065",
  classId: "00000000-0000-4000-8000-000000000067",
  code: "DAILY_CHECK",
  targetType: "CLASS",
  targetId: "00000000-0000-4000-8000-000000000067",
  dueDate: "2026-10-20",
  priority: "NORMAL",
  status: "ASSIGNED",
  createdBy: "00000000-0000-4000-8000-000000000004",
  assigneeId: actorId,
  claimedBy: null,
  completedBy: null,
  result: null,
  checkerId: null,
  updatedBy: "00000000-0000-4000-8000-000000000004",
  updatedAt: "2026-10-19T04:00:00.000Z",
  title: "完成班级日常检查",
  assigneeLabel: "示例东校区教师",
  creatorLabel: "示例东校区负责人",
  checkerLabel: null,
  targetLabel: "示例三年级甲班",
  overdue: false,
  synthetic: true,
  actions: ["claim"],
};

test("invited staff task client uses same-origin cookie requests and versioned lifecycle actions", async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetcher: typeof fetch = async (input, init = {}) => {
    calls.push({ url: String(input), init });
    const path = new URL(String(input)).pathname;
    const data = path.endsWith("/staff/tasks")
      ? {
          actor_id: actorId,
          capabilities: ["task:read", "task:claim", "task:start", "task:complete"],
          tasks: [task],
        }
      : {
          ...task,
          status: path.endsWith("/claim") ? "CLAIMED" : task.status,
          version: 2,
          actions: ["start"],
        };
    return Response.json({ data });
  };
  const client = new InviteStaffTaskClient({ baseUrl: "https://app.example.test", fetcher });
  await client.restore();
  assert.equal(client.snapshot.status, "READY");
  assert.equal("actorId" in client.snapshot, false);
  assert.doesNotMatch(
    JSON.stringify(client.snapshot),
    /tenantId|campusId|classId|assigneeId|createdBy|synthetic/,
  );
  assert.equal(client.snapshot.tasks[0]?.id, taskId);

  await client.command("claim", taskId, 1);
  assert.equal(calls[0]?.url, "https://app.example.test/api-local/staff/tasks");
  assert.equal(calls[1]?.url, `https://app.example.test/api-local/staff/tasks/${taskId}/claim`);
  assert.equal(calls[0]?.init.credentials, "same-origin");
  assert.equal(calls[0]?.init.cache, "no-store");
  assert.equal(new Headers(calls[0]?.init.headers).has("authorization"), false);
  assert.equal("body" in calls[0]!.init, false);
  assert.deepEqual(JSON.parse(String(calls[1]?.init.body)), { version: 1 });
  assert.match(
    String(calls[1]?.init.headers && new Headers(calls[1]?.init.headers).get("content-type")),
    /application\/json/u,
  );
});

test("invited staff task client clears data on authorization loss and rejects unsafe destinations", async () => {
  const client = new InviteStaffTaskClient({
    baseUrl: "http://127.0.0.1:3000",
    fetcher: async () => Response.json({ error: { code: "UNAUTHENTICATED" } }, { status: 401 }),
  });
  await client.restore();
  assert.equal(client.snapshot.status, "IDLE");
  assert.deepEqual(client.snapshot.tasks, []);
  assert.throws(() => new InviteStaffTaskClient({ baseUrl: "http://example.com:3000" }));
});

test("invited tasks use safe actions, retain future dates and reject inconsistent records", async () => {
  for (const changed of [
    { ...task, dueDate: "2030-01-02", classId: "class-alpha" },
    {
      ...task,
      status: "CHECKED",
      result: "COMPLETED_AS_PLANNED",
      checkerLabel: "合成负责人",
      actions: [],
    },
  ]) {
    const client = new InviteStaffTaskClient({
      baseUrl: "https://app.example.test",
      fetcher: async () => Response.json({ data: { tasks: [changed] } }),
    });
    await client.restore();
    assert.equal(client.snapshot.status, "READY");
    assert.doesNotMatch(JSON.stringify(client.snapshot), /classId|synthetic|assigneeId/);
  }
  for (const tasks of [
    [{ ...task, actions: ["complete"] }],
    [{ ...task, dueDate: "2030-02-30" }],
    [{ ...task, status: "CHECKED", result: null, actions: [] }],
    [task, task],
  ]) {
    const client = new InviteStaffTaskClient({
      baseUrl: "https://app.example.test",
      fetcher: async () => Response.json({ data: { tasks } }),
    });
    await client.restore();
    assert.equal(client.snapshot.status, "ERROR");
    assert.deepEqual(client.snapshot.tasks, []);
  }
});

test("invited task operations deduplicate, reject stale local versions and recover without replay", async () => {
  let row = { ...task };
  let failing = 0;
  let writes = 0;
  let release: (() => void) | undefined;
  const client = new InviteStaffTaskClient({
    baseUrl: "https://app.example.test",
    fetcher: async (_input, init) => {
      if (failing)
        return Response.json({ error: { code: "SYNTHETIC_ERROR" } }, { status: failing });
      if (init?.method === "POST") {
        writes++;
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        row = { ...row, status: "CLAIMED", version: 2, actions: ["start"] };
        return Response.json({ data: row });
      }
      return Response.json({ data: { tasks: [row] } });
    },
  });
  await client.restore();
  await client.command("claim", taskId, 2);
  assert.equal(writes, 0);
  const pending = client.command("claim", taskId, 1);
  await client.command("claim", taskId, 1);
  assert.equal(writes, 1);
  release!();
  await pending;
  assert.equal(client.snapshot.tasks[0]?.status, "CLAIMED");
  for (const [status, state] of [
    [403, "DENIED"],
    [409, "ERROR"],
    [503, "ERROR"],
  ] as const) {
    failing = status;
    await client.refresh();
    assert.equal(client.snapshot.status, state);
    assert.deepEqual(client.snapshot.tasks, []);
    failing = 0;
    await client.restore();
    assert.equal(client.snapshot.status, "READY");
    assert.equal(writes, 1);
  }
});

test("invited task connection ignores a response after the page disconnects", async () => {
  let release: ((response: Response) => void) | undefined;
  const client = new InviteStaffTaskClient({
    baseUrl: "https://app.example.test",
    fetcher: () =>
      new Promise<Response>((resolve) => {
        release = resolve;
      }),
  });
  const pending = client.restore();
  client.disconnect();
  release!(Response.json({ data: { tasks: [task] } }));
  await pending;
  assert.equal(client.snapshot.status, "IDLE");
  assert.deepEqual(client.snapshot.tasks, []);
});
