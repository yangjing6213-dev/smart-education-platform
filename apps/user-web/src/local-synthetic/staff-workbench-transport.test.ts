import assert from "node:assert/strict";
import test from "node:test";
import { createStaffWorkbenchTransport } from "./staff-workbench-transport.js";

const origin = "http://127.0.0.1:4317";
const id = "00000000-0000-4000-8000-000000000501";

test("Workbench transport maps only fixed teacher task requests to the staff proxy", async () => {
  const calls: Array<{ url: URL; init: RequestInit }> = [];
  const transport = createStaffWorkbenchTransport(
    origin,
    async (input: RequestInfo | URL, init: RequestInit = {}) => {
      calls.push({ url: new URL(String(input)), init });
      return new Response("[]", { headers: { "content-type": "application/json" } });
    },
  );
  await transport(new URL(origin + "/local/sessions"), {
    method: "POST",
    body: JSON.stringify({ profile: "teacher-east" }),
    credentials: "include",
    cache: "force-cache",
    redirect: "follow",
  });
  await transport(new URL(origin + "/local/session"), { method: "GET" });
  await transport(new URL(origin + "/local/staff-tasks"), { method: "GET" });
  for (const action of ["claim", "start", "complete"])
    await transport(new URL(origin + "/local/staff-tasks/" + id + "/" + action), {
      method: "POST",
      body: JSON.stringify({ version: 1 }),
    });
  assert.deepEqual(
    calls.map(({ url }) => url.pathname),
    [
      "/staff-local/sessions",
      "/staff-local/session",
      "/staff-local/staff-tasks",
      ...["claim", "start", "complete"].map(
        (action) => "/staff-local/staff-tasks/" + id + "/" + action,
      ),
    ],
  );
  assert.ok(calls.every(({ url }) => url.origin === origin));
  assert.ok(calls.every(({ init }) => init.credentials === "omit"));
  assert.ok(calls.every(({ init }) => init.cache === "no-store"));
  assert.ok(calls.every(({ init }) => init.redirect === "error"));
  assert.ok(calls.every(({ init }) => init.signal instanceof AbortSignal));
});

test("Workbench transport blocks external, role, management, query and method escape paths", async () => {
  let requests = 0;
  const transport = createStaffWorkbenchTransport(origin, async () => {
    requests += 1;
    return new Response("{}");
  });
  for (const [url, method] of [
    ["https://example.com/local/staff-tasks", "GET"],
    ["http://user@127.0.0.1:4317/local/staff-tasks", "GET"],
    [origin + "/local/staff-tasks?campus=other", "GET"],
    [origin + "/local/staff-tasks#other", "GET"],
    [origin + "/local/staff-tasks", "POST"],
    [origin + "/local/staff-task-assignees", "GET"],
    [origin + "/local/staff-task-review", "GET"],
    [origin + "/local/staff-tasks/" + id, "GET"],
    [origin + "/local/staff-tasks/" + id, "PATCH"],
    [origin + "/local/staff-tasks/" + id + "/check", "POST"],
    [origin + "/local/staff-tasks/" + id + "/cancel", "POST"],
    [origin + "/local/staff-tasks/not-a-uuid/claim", "POST"],
    [origin + "/local/leave-requests", "GET"],
  ] as const)
    assert.equal((await transport(url, { method })).status, 403, url);
  for (const body of [
    JSON.stringify({ profile: "owner-east" }),
    JSON.stringify({ profile: "parent-alpha" }),
    JSON.stringify({ profile: "teacher-east", extra: true }),
    "null",
    "[]",
    "bad-json",
  ])
    assert.equal(
      (await transport(origin + "/local/sessions", { method: "POST", body })).status,
      403,
    );
  assert.equal(requests, 0);
});

test("Workbench transport consumes a real failed response without replaying a write", async () => {
  const failed = new Response('{"error":{"code":"VERSION_CONFLICT"}}', { status: 409 });
  let requests = 0;
  const transport = createStaffWorkbenchTransport(origin, async () => {
    requests += 1;
    return failed;
  });
  const result = await transport(origin + "/local/staff-tasks/" + id + "/claim", {
    method: "POST",
    body: JSON.stringify({ version: 1 }),
  });
  assert.equal(result.status, 409);
  assert.equal(failed.bodyUsed, true);
  assert.equal(requests, 1);
});

test("Workbench transport rejects an unsafe service base before fetching", () => {
  for (const base of [
    "https://example.com",
    "http://127.0.0.1",
    origin + "/other",
    origin + "?x=1",
    origin + "#x",
    "http://user@127.0.0.1:4317",
  ])
    assert.throws(() => createStaffWorkbenchTransport(base));
});
