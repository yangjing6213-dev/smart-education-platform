import assert from "node:assert/strict";
import test from "node:test";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL, URL } from "node:url";
import {
  StaffTaskAssignmentClient,
  createLocalStaffTaskTransport,
  parseStaffTaskSnapshot,
  renderStaffTaskAssignment,
} from "../dist/local-review/task-assignment.js";

const session = {
  profile: "owner-east",
  label: "示例东校区负责人",
  actorId: "00000000-0000-4000-8000-000000000004",
  tenantId: "00000000-0000-4000-8000-000000000100",
  campusId: "00000000-0000-4000-8000-000000000101",
  classIds: ["00000000-0000-4000-8000-000000000103"],
  actions: ["task:read", "task:assign", "task:check", "task:cancel"],
};
const base = {
  status: "READY",
  session: { mode: "local-synthetic", ...session },
  tasks: [],
  review: [],
  assignees: [
    {
      actorId: "00000000-0000-4000-8000-000000000003",
      label: "示例东校区教师",
      campusId: session.campusId,
      classIds: session.classIds,
    },
  ],
  students: [
    {
      id: "00000000-0000-4000-8000-000000000200",
      label: "示例学生甲",
      campusId: session.campusId,
      classId: session.classIds[0],
    },
  ],
  message: "已连接",
  error: null,
};

test("Admin task transport forwards only the local G3.1 route allowlist", async () => {
  const forwarded = [];
  const transport = createLocalStaffTaskTransport("http://127.0.0.1:4317", async (input, init) => {
    forwarded.push({ url: String(input), method: init?.method ?? "GET" });
    return new globalThis.Response("{}", {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
  await transport("/local/staff-task-assignees", { method: "GET" });
  const denied = await transport("/local/staff-task-other", { method: "GET" });
  assert.equal(denied.status, 403);
  assert.equal(forwarded.length, 1);
  assert.equal(forwarded[0].url, "http://127.0.0.1:4317/local/staff-task-assignees");
  assert.throws(() => createLocalStaffTaskTransport("https://example.com"));
});

test("Admin task form uses fixed categories, authorized targets, and no free text", () => {
  const snapshot = parseStaffTaskSnapshot(base);
  const html = renderStaffTaskAssignment(snapshot, true);
  assert.match(html, /任务类别/u);
  assert.match(html, /示例东校区教师/u);
  assert.match(html, /示例学生甲/u);
  assert.match(html, /2026-10/u);
  assert.match(html, /独立检查/u);
  assert.doesNotMatch(html, /<textarea|姓名输入|真实学生/u);
});

test("Admin default task deadline uses the next Shanghai calendar day", () => {
  const snapshot = parseStaffTaskSnapshot(base);
  const html = renderStaffTaskAssignment(snapshot, true, Date.parse("2026-10-12T17:00:00.000Z"));
  assert.match(html, /name="dueDate"[^>]*value="2026-10-14"/u);
});

test("Admin task parser rejects an assignee or task from another campus", () => {
  assert.throws(() =>
    parseStaffTaskSnapshot({
      ...base,
      assignees: [{ ...base.assignees[0], campusId: "foreign-campus" }],
    }),
  );
  assert.throws(() =>
    parseStaffTaskSnapshot({
      ...base,
      tasks: [
        {
          id: "00000000-0000-4000-8000-000000000501",
          version: 1,
          kind: "staffTask",
          tenantId: session.tenantId,
          campusId: "foreign-campus",
          classId: session.classIds[0],
          code: "DAILY_CHECK",
          targetType: "CLASS",
          targetId: session.classIds[0],
          dueDate: "2026-10-08",
          priority: "NORMAL",
          status: "ASSIGNED",
          createdBy: session.actorId,
          assigneeId: base.assignees[0].actorId,
          claimedBy: null,
          completedBy: null,
          result: null,
          checkerId: null,
          updatedBy: session.actorId,
          updatedAt: "2026-10-07T00:00:00.000Z",
          title: "完成班级日常检查",
          assigneeLabel: "示例东校区教师",
          creatorLabel: "示例东校区负责人",
          checkerLabel: null,
          targetLabel: "示例三年级甲班",
          overdue: false,
          synthetic: true,
        },
      ],
    }),
  );
});

test("Admin assigns and independently checks the same shared task version", async () => {
  const assigneeId = base.assignees[0].actorId;
  const calls = [];
  let row = null;
  const transport = async (input, init = {}) => {
    const path = String(input);
    const method = init.method ?? "GET";
    calls.push({ path, method, body: init.body ? JSON.parse(init.body) : undefined });
    let value = [];
    if (path === "/local/sessions") value = { handle: "a".repeat(43) };
    else if (path === "/local/session") value = { mode: "local-synthetic", ...session };
    else if (path === "/local/staff-task-assignees") value = base.assignees;
    else if (path === "/local/student-options") value = base.students;
    else if (path === "/local/staff-tasks") {
      if (method === "POST") {
        row = {
          id: "00000000-0000-4000-8000-000000000501",
          version: 1,
          kind: "staffTask",
          tenantId: session.tenantId,
          campusId: session.campusId,
          classId: session.classIds[0],
          code: "DAILY_CHECK",
          targetType: "CLASS",
          targetId: session.classIds[0],
          dueDate: "2026-10-08",
          priority: "NORMAL",
          status: "ASSIGNED",
          createdBy: session.actorId,
          assigneeId,
          claimedBy: null,
          completedBy: null,
          result: null,
          checkerId: null,
          updatedBy: session.actorId,
          updatedAt: "2026-10-07T00:00:00.000Z",
          title: "完成班级日常检查",
          assigneeLabel: "示例东校区教师",
          creatorLabel: "示例东校区负责人",
          checkerLabel: null,
          targetLabel: "示例三年级甲班",
          overdue: false,
          synthetic: true,
        };
      }
      value = row ? [row] : [];
    } else if (path === "/local/staff-task-review") {
      value = row?.status === "COMPLETED" ? [row] : [];
    } else if (path.endsWith("/check") && method === "POST") {
      assert.deepEqual(JSON.parse(init.body), { version: 2, action: "CONFIRM" });
      row = { ...row, status: "CHECKED", checkerId: session.actorId, version: 3 };
      value = row;
    } else if (path.endsWith("/cancel") && method === "POST") {
      value = row;
    }
    return new globalThis.Response(JSON.stringify(value), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  const client = new StaffTaskAssignmentClient(transport);
  await client.connect();
  assert.equal(client.snapshot.status, "READY");
  await client.create({
    code: "DAILY_CHECK",
    assigneeId,
    targetType: "CLASS",
    targetId: session.classIds[0],
    dueDate: "2026-10-08",
    priority: "NORMAL",
  });
  assert.equal(client.snapshot.tasks[0].id, row.id);
  assert.equal(client.snapshot.tasks[0].version, 1);
  row = { ...row, status: "COMPLETED", completedBy: assigneeId, result: "BLOCKED", version: 2 };
  await client.refresh();
  await client.review(row.id, 2, "CONFIRM");
  assert.equal(client.snapshot.tasks[0].id, row.id);
  assert.equal(client.snapshot.tasks[0].status, "CHECKED");
  assert.equal(client.snapshot.tasks[0].version, 3);
  assert.ok(calls.every(({ path }) => path.startsWith("/local/")));
  assert.ok(calls.every(({ method }) => ["GET", "POST"].includes(method)));
});

async function serviceFixture(t) {
  const root = fileURLToPath(new URL("../../..", import.meta.url));
  const { buildLocalSyntheticServer } = await import(
    pathToFileURL(resolve(root, "apps/api/dist/src/local-synthetic/server.js")).href
  );
  const server = await buildLocalSyntheticServer({ mode: "local-synthetic" });
  t.after(() => server.close());
  const baseUrl = await server.start(0);
  const bootstrap = await globalThis.fetch(`${baseUrl}/local/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profile: "owner-east" }),
  });
  assert.equal(bootstrap.status, 201);
  const { handle } = await bootstrap.json();
  const api = async (path, method = "GET", body) => {
    const response = await globalThis.fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${handle}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    assert.equal(response.ok, true, `${method} ${path}: ${response.status}`);
    return response.json();
  };
  const assignees = await api("/local/staff-task-assignees");
  const input = {
    code: "DAILY_CHECK",
    assigneeId: assignees[0].actorId,
    targetType: "CLASS",
    targetId: assignees[0].classIds[0],
    dueDate: "2026-10-20",
    priority: "NORMAL",
  };
  const row = await api("/local/staff-tasks", "POST", input);
  return { baseUrl, api, input, row };
}

test("Admin task transport rejects employee actions and unsafe request URLs", async () => {
  const calls = [];
  const transport = createLocalStaffTaskTransport("http://127.0.0.1:4317", async (input, init) => {
    calls.push({ input: String(input), init });
    return globalThis.Response.json([]);
  });
  for (const path of [
    "/local/staff-tasks?campusId=other",
    "/local/staff-tasks#ignored",
    "http://user:password@127.0.0.1:4317/local/staff-tasks",
    "https://example.com/local/staff-tasks",
  ])
    assert.equal((await transport(path)).status, 403, path);
  for (const action of ["claim", "start", "complete"])
    assert.equal(
      (await transport(`/local/staff-tasks/${session.actorId}/${action}`, { method: "POST" }))
        .status,
      403,
    );
  assert.equal(
    (
      await transport("/local/sessions", {
        method: "POST",
        body: JSON.stringify({ profile: "teacher-east" }),
      })
    ).status,
    403,
  );
  assert.equal(calls.length, 0);
  for (const suffix of ["/extra", "?port=4319", "#section"])
    assert.throws(() => createLocalStaffTaskTransport(`http://127.0.0.1:4317${suffix}`));
  await transport("/local/staff-tasks");
  assert.equal(calls[0].init.credentials, "omit");
  assert.equal(calls[0].init.cache, "no-store");
  assert.equal(calls[0].init.redirect, "error");
  assert.equal(calls[0].init.signal instanceof globalThis.AbortSignal, true);
});

test("Admin task parser rejects enum arrays, duplicate identities and mismatched targets", async (t) => {
  const { baseUrl } = await serviceFixture(t);
  const client = new StaffTaskAssignmentClient(createLocalStaffTaskTransport(baseUrl));
  await client.connect();
  assert.equal(client.snapshot.status, "READY");
  const original = client.snapshot;
  const row = original.tasks[0];
  const invalid = [
    { ...original, status: ["READY"] },
    { ...original, tasks: [{ ...row, targetType: ["CLASS"] }] },
    { ...original, tasks: [{ ...row, priority: ["NORMAL"] }] },
    { ...original, tasks: [{ ...row, targetId: original.session.tenantId }] },
    { ...original, tasks: [row, row] },
    { ...original, assignees: [original.assignees[0], original.assignees[0]] },
    { ...original, students: [original.students[0], original.students[0]] },
  ];
  for (const snapshot of invalid) assert.throws(() => parseStaffTaskSnapshot(snapshot));
});

test("Admin task writes and refresh serialize while old data is cleared", async (t) => {
  for (const operation of ["create", "refresh", "cancel"]) {
    const { baseUrl, input, row } = await serviceFixture(t);
    const gate = Promise.withResolvers();
    const entered = Promise.withResolvers();
    const calls = [];
    let hold = false;
    const method = operation === "refresh" ? "GET" : "POST";
    const path =
      operation === "cancel" ? `/local/staff-tasks/${row.id}/cancel` : "/local/staff-tasks";
    const client = new StaffTaskAssignmentClient(
      createLocalStaffTaskTransport(baseUrl, async (url, init) => {
        const currentPath = new URL(url).pathname;
        calls.push([currentPath, init.method]);
        if (hold && currentPath === path && init.method === method) {
          hold = false;
          entered.resolve();
          await gate.promise;
        }
        return globalThis.fetch(url, init);
      }),
    );
    await client.connect();
    const invoke = () =>
      operation === "create"
        ? client.create(input)
        : operation === "refresh"
          ? client.refresh()
          : client.review(row.id, row.version, "CANCEL");
    hold = true;
    const pending = invoke();
    await entered.promise;
    const busy = client.snapshot;
    const before = calls.length;
    try {
      await invoke();
      await client.refresh();
      assert.equal(calls.length, before, operation + ": duplicate operation escaped the lock");
      assert.equal(busy.status, "BUSY");
      for (const key of ["tasks", "review", "assignees", "students"])
        assert.deepEqual(busy[key], []);
    } finally {
      gate.resolve();
      await pending;
    }
    assert.equal(client.snapshot.status, "READY");
  }
});

test("Admin task late bootstrap and writes cannot read after disconnect or reconnection", async (t) => {
  const { baseUrl, input } = await serviceFixture(t);
  for (const stage of ["bootstrap", "write"]) {
    for (const reconnect of [false, true]) {
      const gate = Promise.withResolvers();
      const entered = Promise.withResolvers();
      let hold = stage === "bootstrap";
      const calls = [];
      const client = new StaffTaskAssignmentClient(
        createLocalStaffTaskTransport(baseUrl, async (url, init) => {
          const path = new URL(url).pathname;
          calls.push(path);
          const response = await globalThis.fetch(url, init);
          if (
            hold &&
            init.method === "POST" &&
            path === (stage === "bootstrap" ? "/local/sessions" : "/local/staff-tasks")
          ) {
            hold = false;
            entered.resolve();
            await gate.promise;
          }
          return response;
        }),
      );
      if (stage === "write") await client.connect();
      hold = true;
      const pending = stage === "bootstrap" ? client.connect() : client.create(input);
      await entered.promise;
      try {
        assert.equal(typeof client.disconnect, "function");
        client.disconnect();
        if (reconnect) await client.connect();
        const snapshot = client.snapshot;
        const count = calls.length;
        gate.resolve();
        await pending;
        assert.equal(calls.length, count, "late response must not start another private read");
        assert.deepEqual(client.snapshot, snapshot);
      } finally {
        gate.resolve();
        await pending;
      }
    }
  }
});

test("Admin task failures consume bodies, clear credentials and reconnect without replay", async (t) => {
  const { baseUrl, input } = await serviceFixture(t);
  const failures = [];
  const calls = [];
  let failedMethod = null;
  const client = new StaffTaskAssignmentClient(
    createLocalStaffTaskTransport(baseUrl, async (url, init) => {
      const path = new URL(url).pathname;
      calls.push([path, init.method]);
      if (path === "/local/staff-tasks" && init.method === failedMethod) {
        failedMethod = null;
        const response = globalThis.Response.json(
          { secret: "must-not-be-displayed" },
          { status: 503 },
        );
        failures.push(response);
        return response;
      }
      return globalThis.fetch(url, init);
    }),
  );
  await client.connect();
  for (const method of ["GET", "POST"]) {
    failedMethod = method;
    if (method === "GET") await client.refresh();
    else await client.create(input);
    assert.equal(failures.at(-1).bodyUsed, true);
    assert.equal(client.snapshot.status, "ERROR");
    assert.equal(client.snapshot.session, null);
    for (const key of ["tasks", "review", "assignees", "students"])
      assert.deepEqual(client.snapshot[key], []);
    assert.doesNotMatch(JSON.stringify(client.snapshot), /must-not-be-displayed/u);
    const before = calls.length;
    await client.refresh();
    assert.equal(client.snapshot.status, "READY");
    assert.equal(calls[before][0], "/local/sessions");
    assert.equal(
      calls.slice(before).some(([path, verb]) => path === "/local/staff-tasks" && verb === "POST"),
      false,
    );
  }
});

test("Admin task actions use their own capabilities and cancel does not apply self-check rules", async (t) => {
  const { baseUrl } = await serviceFixture(t);
  const original = new StaffTaskAssignmentClient(createLocalStaffTaskTransport(baseUrl));
  await original.connect();
  const fixture = original.snapshot;
  for (const capability of ["task:assign", "task:check", "task:cancel"]) {
    const actions = ["task:read", capability];
    const ownTask = {
      ...fixture.tasks[0],
      assigneeId: fixture.session.actorId,
      status: "COMPLETED",
    };
    const calls = [];
    const transport = async (input, init = {}) => {
      const path = String(input);
      calls.push([path, init.method ?? "GET", init.body ? JSON.parse(init.body) : undefined]);
      let value;
      if (path === "/local/sessions") value = { handle: "s".repeat(43) };
      else if (path === "/local/session")
        value = { mode: "local-synthetic", ...fixture.session, actions };
      else if (path === "/local/staff-tasks") value = [ownTask];
      else if (path === "/local/staff-task-review") {
        assert.equal(capability, "task:check");
        value = [ownTask];
      } else if (path === "/local/staff-task-assignees" || path === "/local/student-options") {
        assert.equal(capability, "task:assign");
        value = path.endsWith("assignees") ? fixture.assignees : fixture.students;
      } else value = ownTask;
      return globalThis.Response.json(value);
    };
    const client = new StaffTaskAssignmentClient(transport);
    await client.connect();
    assert.equal(client.snapshot.status, "READY", capability);
    const before = calls.length;
    await client.review(ownTask.id, ownTask.version, "CONFIRM");
    await client.review(ownTask.id, ownTask.version, "RETURN");
    assert.equal(calls.length, before, "own task cannot be checked");
    await client.review(ownTask.id, ownTask.version, "CANCEL");
    const cancellations = calls.filter(([path]) => path.endsWith("/cancel"));
    assert.equal(cancellations.length, capability === "task:cancel" ? 1 : 0);
    if (cancellations.length) assert.deepEqual(cancellations[0][2], { version: ownTask.version });
  }
});
