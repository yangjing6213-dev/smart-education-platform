import assert from "node:assert/strict";
import test from "node:test";
import {
  StaffTaskClient,
  parseStaffTasks,
  renderStaffTaskPanel,
  type StaffTaskSession,
  type StaffTaskSnapshot,
  type StaffTaskView,
} from "./task-assignment.js";

const session: StaffTaskSession = {
  profile: "teacher-east",
  actorId: "00000000-0000-4000-8000-000000000004",
  tenantId: "00000000-0000-4000-8000-000000000100",
  campusId: "00000000-0000-4000-8000-000000000101",
  classIds: ["00000000-0000-4000-8000-000000000103"],
  actions: ["task:read", "task:claim", "task:start", "task:complete"],
};

function task(changes: Partial<StaffTaskView> = {}): StaffTaskView {
  return {
    id: "00000000-0000-4000-8000-000000000501",
    version: 1,
    kind: "staffTask",
    tenantId: session.tenantId,
    campusId: session.campusId,
    classId: session.classIds[0]!,
    code: "DAILY_CHECK",
    targetType: "CLASS",
    targetId: session.classIds[0]!,
    dueDate: "2026-10-08",
    priority: "NORMAL",
    status: "ASSIGNED",
    createdBy: "00000000-0000-4000-8000-000000000003",
    assigneeId: session.actorId,
    claimedBy: null,
    completedBy: null,
    result: null,
    checkerId: null,
    updatedBy: session.actorId,
    updatedAt: "2026-10-07T00:00:00.000Z",
    title: "完成班级日常检查",
    assigneeLabel: "示例教师",
    creatorLabel: "示例负责人",
    checkerLabel: null,
    targetLabel: "示例三年级甲班",
    overdue: false,
    synthetic: true,
    ...changes,
  };
}

const readySnapshot: StaffTaskSnapshot = {
  status: "READY",
  session,
  tasks: [task()],
  message: "已连接本机共享任务。",
  error: null,
};

test("User Web rejects tasks outside the current synthetic school scope", () => {
  assert.throws(() => parseStaffTasks([task({ campusId: "foreign-campus" })], session));
  assert.throws(() => parseStaffTasks([task({ synthetic: false as never })], session));
});

test("User Web shows only the next task action and fixed completion choices", () => {
  const html = renderStaffTaskPanel(readySnapshot);
  assert.match(html, /领取任务/u);
  assert.doesNotMatch(html, /开始任务/u);
  assert.doesNotMatch(html, /<textarea|自由填写|真实学生/u);

  const completing = renderStaffTaskPanel({
    ...readySnapshot,
    tasks: [task({ status: "IN_PROGRESS", claimedBy: session.actorId })],
  });
  assert.match(completing, /按计划完成/u);
  assert.match(completing, /需要继续跟进/u);
  assert.match(completing, /暂时受阻/u);

  const overdue = renderStaffTaskPanel({
    ...readySnapshot,
    tasks: [task({ overdue: true })],
  });
  assert.match(overdue, /已逾期/u);
});

test("User Web carries one task id and current version through local service actions", async () => {
  let current = task();
  const requests: Array<{ url: URL; init: RequestInit }> = [];
  const fetcher: typeof fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    requests.push({ url, init });
    let value: unknown = [];
    if (url.pathname === "/local/sessions") value = { handle: "a".repeat(43) };
    else if (url.pathname === "/local/session") value = { mode: "local-synthetic", ...session };
    else if (url.pathname === "/local/staff-tasks" && init.method === "GET") value = [current];
    else if (url.pathname.startsWith("/local/staff-tasks/") && init.method === "POST") {
      const body = JSON.parse(String(init.body ?? "{}")) as Record<string, unknown>;
      if (url.pathname.endsWith("/claim"))
        current = { ...current, status: "CLAIMED", claimedBy: session.actorId, version: 2 };
      if (url.pathname.endsWith("/start"))
        current = { ...current, status: "IN_PROGRESS", version: 3 };
      if (url.pathname.endsWith("/complete"))
        current = {
          ...current,
          status: "COMPLETED",
          result: body.result as StaffTaskView["result"],
          completedBy: session.actorId,
          version: 4,
        };
      value = current;
    }
    return new Response(JSON.stringify(value), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  const client = new StaffTaskClient({ baseUrl: "http://127.0.0.1:4317", fetcher });
  await client.connect();
  const id = current.id;
  await client.command("claim", id, 0);
  assert.equal(requests.filter(({ init }) => init.method === "POST").length, 1);
  await client.command("claim", id, 1);
  await client.command("start", id, 2);
  await client.command("complete", id, 3, "BLOCKED");

  assert.deepEqual(
    requests.filter(({ init }) => init.method === "POST").map(({ url }) => url.pathname),
    [
      "/local/sessions",
      `/local/staff-tasks/${id}/claim`,
      `/local/staff-tasks/${id}/start`,
      `/local/staff-tasks/${id}/complete`,
    ],
  );
  assert.equal(client.snapshot.tasks[0]?.status, "COMPLETED");
  assert.equal(client.snapshot.tasks[0]?.version, 4);
  assert.ok(requests.every(({ url }) => url.origin === "http://127.0.0.1:4317"));
  assert.ok(requests.every(({ init }) => init.credentials === "omit"));
});

test("User Web refuses non-loopback task service origins", () => {
  assert.throws(() => new StaffTaskClient({ baseUrl: "https://example.com" }));
});

test("User Web rejects arrays masquerading as task descriptor enums", () => {
  assert.throws(() => parseStaffTasks([task({ targetType: ["CLASS"] as never })], session));
  assert.throws(() => parseStaffTasks([task({ priority: ["NORMAL"] as never })], session));
  assert.throws(() =>
    parseStaffTasks(
      [task({ targetType: "ACTIVITY", targetId: ["ART_WORKSHOP"] as never })],
      session,
    ),
  );
});

test("User Web ignores a late task bootstrap after disconnect before sending private reads", async () => {
  let finishBootstrap!: (response: Response) => void;
  const paths: string[] = [];
  const fetcher: typeof fetch = async (input) => {
    const path = new URL(String(input)).pathname;
    paths.push(path);
    if (path === "/local/sessions")
      return new Promise<Response>((resolve) => {
        finishBootstrap = resolve;
      });
    return new Response(JSON.stringify({ mode: "local-synthetic", ...session }), {
      headers: { "content-type": "application/json" },
    });
  };
  const client = new StaffTaskClient({ baseUrl: "http://127.0.0.1:4317", fetcher });
  const connecting = client.connect();
  client.disconnect();
  finishBootstrap(new Response(JSON.stringify({ handle: "a".repeat(43) })));
  await connecting;
  assert.deepEqual(paths, ["/local/sessions"]);
  assert.equal(client.snapshot.status, "IDLE");
  assert.equal(client.snapshot.session, null);
  assert.deepEqual(client.snapshot.tasks, []);
});

test("User Web ignores late task mutation reads after disconnect or a newer connection", async () => {
  for (const reconnect of [false, true]) {
    let finishMutation!: (response: Response) => void;
    const paths: string[] = [];
    const row = task();
    const fetcher: typeof fetch = async (input, init = {}) => {
      const path = new URL(String(input)).pathname;
      paths.push((init.method ?? "GET") + " " + path);
      if (path.endsWith("/claim"))
        return new Promise<Response>((resolve) => {
          finishMutation = resolve;
        });
      const value =
        path === "/local/sessions"
          ? { handle: "a".repeat(43) }
          : path === "/local/session"
            ? { mode: "local-synthetic", ...session }
            : [row];
      return new Response(JSON.stringify(value), {
        headers: { "content-type": "application/json" },
      });
    };
    const client = new StaffTaskClient({ baseUrl: "http://127.0.0.1:4317", fetcher });
    await client.connect();
    const pending = client.command("claim", row.id, row.version);
    client.disconnect();
    if (reconnect) await client.connect();
    const before = [...paths];
    const snapshot = client.snapshot;
    finishMutation(
      new Response(
        JSON.stringify({ ...row, status: "CLAIMED", version: 2, claimedBy: session.actorId }),
      ),
    );
    await pending;
    assert.deepEqual(paths, before, "旧写响应不得在断开或新连接后发起列表读取。");
    assert.deepEqual(client.snapshot, snapshot);
  }
});
