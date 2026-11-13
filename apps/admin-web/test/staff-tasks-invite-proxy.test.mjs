/* global Request, Response, Headers, process, URL */
import assert from "node:assert/strict";
import test from "node:test";
const proxy = await import(
  new URL("../src/app/api/admin/[...path]/handler.ts", import.meta.url).href
);
export const id = "11111111-1111-4111-8111-111111111111";
const token = "s".repeat(43);
const task = {
  id,
  version: 1,
  code: "DAILY_CHECK",
  title: "完成班级日常检查",
  targetType: "CLASS",
  targetLabel: "当前授权班级",
  dueDate: "2030-01-02",
  priority: "NORMAL",
  status: "ASSIGNED",
  result: null,
  assigneeLabel: "合成教师",
  creatorLabel: "合成负责人",
  checkerLabel: null,
  updatedAt: "2026-10-23T00:00:00.000Z",
  overdue: false,
  actions: ["cancel"],
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
function req(path, method = "GET", body, headers = {}, query = "") {
  return new Request("http://127.0.0.1:3000/api/admin/" + path.join("/") + query, {
    method,
    headers: {
      host: "127.0.0.1:3000",
      origin: "http://127.0.0.1:3000",
      cookie: "student_care_admin_session=" + token,
      ...(body ? { "content-type": "application/json" } : {}),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
const ctx = (path) => ({ params: Promise.resolve({ path }) });
async function env(run) {
  const keys = ["NODE_ENV", "ADMIN_WEB_LOCAL_NEST_API", "ADMIN_WEB_NEST_API_BASE_URL"];
  const before = keys.map((k) => process.env[k]),
    fetcher = globalThis.fetch;
  process.env.NODE_ENV = "development";
  process.env.ADMIN_WEB_LOCAL_NEST_API = "http://127.0.0.1:4321";
  try {
    await run();
  } finally {
    globalThis.fetch = fetcher;
    keys.forEach((k, i) => {
      if (before[i] === undefined) delete process.env[k];
      else process.env[k] = before[i];
    });
  }
}
test("task proxy uses invited server cookie and projects canonical task and choice fields", async () =>
  env(async () => {
    let requested;
    globalThis.fetch = async (url, init) => {
      requested = { url: String(url), init };
      return Response.json({
        data: {
          tasks: [{ ...task, tenantId: "private", assigneeId: "private" }],
          choices: [{ ...choice, campusId: "private" }],
          canAssign: true,
          actorId: "private",
        },
      });
    };
    const path = ["tasks"],
      response = await proxy.GET(
        req(path, "GET", undefined, { authorization: "Bearer forged", "x-tenant-id": "forged" }),
        ctx(path),
      );
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      data: { tasks: [task], choices: [choice], canAssign: true },
    });
    assert.equal(requested.url, "http://127.0.0.1:4321/admin/tasks");
    assert.equal(new Headers(requested.init.headers).get("authorization"), "Bearer " + token);
    assert.equal(new Headers(requested.init.headers).has("x-tenant-id"), false);
    assert.equal(response.headers.get("cache-control"), "no-store");
  }));
test("task proxy admits only exact create/check/cancel inputs with valid references and versions", async () =>
  env(async () => {
    const calls = [];
    globalThis.fetch = async (url, init) => {
      calls.push({ url: String(url), body: JSON.parse(init.body) });
      return Response.json({ data: task });
    };
    for (const [path, body] of [
      [["tasks"], input],
      [["tasks", id, "check"], { version: 1, action: "RETURN" }],
      [["tasks", id, "cancel"], { version: 1 }],
    ]) {
      const r = await proxy.POST(req(path, "POST", body), ctx(path));
      assert.equal(r.status, 200);
      assert.deepEqual(await r.json(), { data: task });
      assert.deepEqual(calls.at(-1).body, body);
    }
    const n = calls.length;
    for (const [path, body] of [
      [["tasks"], { ...input, tenantId: "forged" }],
      [["tasks"], { ...input, dueDate: "2030-02-30" }],
      [["tasks"], { ...input, assigneeRef: "bad/ref" }],
      [["tasks", id, "check"], { version: 1, action: "CANCEL" }],
      [["tasks", id, "check"], { version: 0, action: "CONFIRM" }],
      [["tasks", id, "cancel"], { version: 1, action: "CANCEL" }],
    ])
      assert.equal((await proxy.POST(req(path, "POST", body), ctx(path))).status, 400);
    assert.equal(calls.length, n);
  }));
test("task proxy rejects anonymous, foreign origin, query and invalid path before upstream", async () =>
  env(async () => {
    let count = 0;
    globalThis.fetch = async () => {
      count++;
      return Response.json({ data: task });
    };
    assert.equal(
      (await proxy.GET(req(["tasks"], "GET", undefined, { cookie: "" }), ctx(["tasks"]))).status,
      401,
    );
    assert.equal(
      (
        await proxy.POST(
          req(["tasks"], "POST", input, { origin: "https://foreign.test" }),
          ctx(["tasks"]),
        )
      ).status,
      403,
    );
    assert.equal(
      (await proxy.GET(req(["tasks"], "GET", undefined, {}, "?campusId=forged"), ctx(["tasks"])))
        .status,
      400,
    );
    assert.equal(
      (
        await proxy.POST(
          req(["tasks", "bad", "check"], "POST", { version: 1, action: "CONFIRM" }),
          ctx(["tasks", "bad", "check"]),
        )
      ).status,
      404,
    );
    assert.equal(count, 0);
  }));
test("task proxy rejects corrupt status, duplicate rows/choices and preserves large valid lists", async () =>
  env(async () => {
    const path = ["tasks"];
    for (const data of [
      { tasks: [{ ...task, status: "CHECKED", result: null }], choices: [], canAssign: false },
      { tasks: [task, task], choices: [], canAssign: false },
      { tasks: [], choices: [choice, choice], canAssign: true },
      { tasks: [], choices: [{ ...choice, targetRef: " ".repeat(1) }], canAssign: true },
      { tasks: [], choices: [choice], canAssign: false },
    ]) {
      globalThis.fetch = async () => Response.json({ data });
      assert.equal((await proxy.GET(req(path), ctx(path))).status, 502);
    }
    const tasks = Array.from({ length: 501 }, (_, i) => ({
      ...task,
      id: `11111111-1111-4111-8111-${i.toString(16).padStart(12, "0")}`,
    }));
    globalThis.fetch = async () =>
      Response.json({ data: { tasks, choices: [choice], canAssign: true } });
    const r = await proxy.GET(req(path), ctx(path));
    assert.equal(r.status, 200);
    assert.equal((await r.json()).data.tasks.length, 501);
  }));
