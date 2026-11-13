/* global Response */
import assert from "node:assert/strict";
import test from "node:test";
import {
  StaffTasksInviteClient,
  taskFormOptions,
  parseTaskPayload,
} from "../src/app/admin/staff-tasks/staff-tasks-client.ts";
const id = "11111111-1111-4111-8111-111111111111";
const row = {
  id,
  version: 4,
  code: "DAILY_CHECK",
  title: "完成班级日常检查",
  targetType: "CLASS",
  targetLabel: "当前授权班级",
  dueDate: "2030-01-02",
  priority: "NORMAL",
  status: "COMPLETED",
  result: "BLOCKED",
  assigneeLabel: "合成教师",
  creatorLabel: "合成负责人",
  checkerLabel: null,
  updatedAt: "2026-10-23T00:00:00.000Z",
  overdue: false,
  actions: ["check", "cancel"],
};
const choice = {
  assigneeRef: id,
  assigneeLabel: "合成教师",
  classRef: "synthetic-class-a",
  targetType: "CLASS",
  targetRef: "synthetic-class-a",
  targetLabel: "当前授权班级",
};
const input = {
  code: "DAILY_CHECK",
  assigneeRef: id,
  classRef: choice.classRef,
  targetType: "CLASS",
  targetRef: choice.targetRef,
  dueDate: "2030-01-02",
  priority: "NORMAL",
};
const identity = {
  display_name: "合成负责人",
  actor_id: "private",
  memberships: [
    { status: "ACTIVE", capabilities: ["task:read", "task:assign", "task:check", "task:cancel"] },
  ],
};
const data = { tasks: [row], choices: [choice], canAssign: true };
const response = (data) => Response.json({ data });
function fixture() {
  const calls = [];
  let status = 200,
    gate,
    rows = data;
  const client = new StaffTasksInviteClient({
    fetcher: async (url, init) => {
      calls.push({ url, init });
      if (gate) await gate;
      if (status !== 200) return Response.json({ error: {} }, { status });
      if (url.endsWith("/me")) return response(identity);
      return response(init.method === "POST" ? row : rows);
    },
  });
  return {
    client,
    calls,
    fail: (n) => {
      status = n;
    },
    gate: (p) => {
      gate = p;
    },
    data: (d) => {
      rows = d;
    },
  };
}
test("invited task client uses only same-origin cookie routes, current candidate and exact version", async () => {
  const f = fixture();
  await f.client.connect();
  assert.equal(f.client.snapshot.status, "READY");
  assert.deepEqual(f.client.snapshot.review, [row]);
  assert.deepEqual(f.client.snapshot.session, { label: "合成负责人" });
  await f.client.create(input);
  assert.deepEqual(JSON.parse(f.calls.find((c) => c.init.method === "POST").init.body), input);
  await f.client.review(id, 4, "RETURN");
  assert.deepEqual(JSON.parse(f.calls.findLast((c) => c.init.method === "POST").init.body), {
    version: 4,
    action: "RETURN",
  });
  for (const c of f.calls) {
    assert.ok(c.url.startsWith("/api/admin/"));
    assert.equal(c.init.credentials, "same-origin");
    assert.equal(c.init.cache, "no-store");
    assert.equal("authorization" in c.init.headers, false);
  }
  const n = f.calls.length;
  await f.client.review(id, 3, "CONFIRM");
  await f.client.create({ ...input, classRef: "unavailable" });
  await f.client.create({ ...input, dueDate: "2030-02-30" });
  assert.equal(f.calls.length, n);
});
test("task parsing strips private fields, validates actions, retains 501 rows and explicit distinct class choices", () => {
  const tasks = Array.from({ length: 501 }, (_, i) => ({
    ...row,
    id: `11111111-1111-4111-8111-${i.toString(16).padStart(12, "0")}`,
    tenantId: "private",
  }));
  const parsed = parseTaskPayload({
    tasks,
    choices: [
      choice,
      { ...choice, classRef: "class-b", targetRef: "class-b", campusId: "private" },
    ],
    canAssign: true,
  });
  assert.equal(parsed.tasks.length, 501);
  assert.equal(parsed.choices.length, 2);
  assert.equal(JSON.stringify(parsed).includes("private"), false);
  for (const value of [
    { ...data, tasks: [row, row] },
    { ...data, tasks: [{ ...row, status: "ASSIGNED", actions: ["check"] }] },
    { ...data, tasks: [{ ...row, result: null }] },
    { ...data, choices: [choice, choice] },
    { ...data, canAssign: false },
  ])
    assert.equal(parseTaskPayload(value), undefined);
});
test("task client clears tasks, options and identity on denial, conflict and temporary fault; reconnect never replays writes", async () => {
  for (const [status, state] of [
    [401, "UNAUTHENTICATED"],
    [403, "FORBIDDEN"],
    [409, "ERROR"],
    [503, "ERROR"],
  ]) {
    const f = fixture();
    await f.client.connect();
    f.fail(status);
    await f.client.review(id, 4, "CONFIRM");
    assert.equal(f.client.snapshot.status, state);
    assert.deepEqual(f.client.snapshot.tasks, []);
    assert.deepEqual(f.client.snapshot.choices, []);
    assert.equal(f.client.snapshot.session, null);
    const writes = f.calls.filter((c) => c.init.method === "POST").length;
    f.fail(200);
    await f.client.connect();
    assert.equal(f.client.snapshot.status, "READY");
    assert.equal(f.calls.filter((c) => c.init.method === "POST").length, writes);
  }
});
test("task client deduplicates a held write and ignores its response after disconnect", async () => {
  const f = fixture();
  await f.client.connect();
  let release;
  f.gate(
    new Promise((r) => {
      release = r;
    }),
  );
  const writing = f.client.review(id, 4, "CONFIRM");
  assert.equal(f.client.snapshot.status, "BUSY");
  assert.deepEqual(f.client.snapshot.tasks, []);
  assert.deepEqual(f.client.snapshot.choices, []);
  await f.client.review(id, 4, "CONFIRM");
  assert.equal(f.calls.filter((c) => c.init.method === "POST").length, 1);
  f.client.disconnect();
  release();
  await writing;
  assert.equal(f.client.snapshot.status, "IDLE");
  assert.deepEqual(f.client.snapshot.tasks, []);
});
test("task client rejects malformed response and identity without management capability", async () => {
  const f = fixture();
  f.data({ ...data, tasks: [{ ...row, updatedAt: "bad" }] });
  await f.client.connect();
  assert.equal(f.client.snapshot.status, "ERROR");
  const client = new StaffTasksInviteClient({
    fetcher: async () =>
      response({ ...identity, memberships: [{ status: "ACTIVE", capabilities: ["task:read"] }] }),
  });
  await client.connect();
  assert.equal(client.snapshot.status, "FORBIDDEN");
});

test("task candidates and create retain legitimate non-ASCII and dotted class references", async () => {
  for (const ref of ["三年级一班", "class.a"]) {
    const f = fixture();
    f.data({ ...data, choices: [{ ...choice, classRef: ref, targetRef: ref }] });
    await f.client.connect();
    assert.equal(f.client.snapshot.status, "READY");
    await f.client.create({ ...input, classRef: ref, targetRef: ref });
    const writes = f.calls.filter((call) => call.init.method === "POST");
    assert.equal(writes.length, 1);
    assert.equal(JSON.parse(writes[0].init.body).classRef, ref);
  }
});

test("same-name staff and students have distinct safe labels while keeping correct class and target selection", () => {
  const second = "22222222-2222-4222-8222-222222222222";
  const choices = [
    { ...choice, targetType: "STUDENT", targetRef: "student.a", targetLabel: "合成同名学生" },
    { ...choice, targetType: "STUDENT", targetRef: "student.b", targetLabel: "合成同名学生" },
    { ...choice, assigneeRef: second },
  ];
  const first = taskFormOptions(choices, 0),
    other = taskFormOptions(choices, 1);
  assert.equal(new Set(first.assignees.map((row) => row.label)).size, 2);
  assert.equal(new Set(first.targets.map((row) => row.label)).size, 2);
  assert.ok(first.targets.every((row) => row.assigneeRef === id));
  assert.ok(other.targets.every((row) => row.assigneeRef === second));
  for (const row of [...first.assignees, ...first.targets])
    for (const ref of [id, second, "student.a", "student.b", choice.classRef])
      assert.equal(row.label.includes(ref), false);
});
