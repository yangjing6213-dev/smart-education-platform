/* global Headers, Response, URL */
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function loadClient() {
  const source = await readFile(
    new URL("../src/app/admin/meals/meals-invite-client.ts", import.meta.url),
    "utf8",
  );
  const output = ts.transpile(source, {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  });
  return import("data:text/javascript;base64," + Buffer.from(output).toString("base64"));
}

const ID = "a1111111-1111-4111-8111-111111111111";
const payload = {
  meal_date: "2026-10-22",
  meal_type: "LUNCH",
  items: ["合成蔬菜"],
  notes: "本地合成菜单",
};
const row = {
  ...payload,
  id: ID,
  status: "DRAFT",
  version: 1,
  published_at: null,
  updated_at: "2026-10-22T02:00:00.000Z",
  actions: ["edit", "publish"],
};
const identity = {
  display_name: "示例餐食管理员",
  memberships: [{ status: "ACTIVE", capabilities: ["content:write", "content:publish"] }],
};

test("meal invitation client loads only safe same-origin menus with cookies", async () => {
  const { MealsInviteClient } = await loadClient();
  const calls = [];
  const client = new MealsInviteClient({
    fetcher: async (input, init) => {
      calls.push({ input, init });
      return Response.json({ data: input === "/api/admin/me" ? identity : [row] });
    },
  });
  assert.deepEqual(await client.connect(), [row]);
  assert.equal(client.canWrite, true);
  assert.equal(client.canPublish, true);
  assert.deepEqual(
    calls.map((call) => call.input),
    ["/api/admin/me", "/api/admin/meals"],
  );
  for (const { init } of calls) {
    assert.equal(init.credentials, "same-origin");
    assert.equal(init.cache, "no-store");
    assert.equal(new Headers(init.headers).has("authorization"), false);
  }
});

test("meal invitation writes preserve exact payloads and current versions", async () => {
  const { MealsInviteClient } = await loadClient();
  const writes = [];
  const client = new MealsInviteClient({
    fetcher: async (input, init) => {
      if (input === "/api/admin/me") return Response.json({ data: identity });
      if (init.method === "GET") return Response.json({ data: [row] });
      const body = JSON.parse(init.body);
      writes.push({ input, method: init.method, body });
      const id = input.split("/")[4];
      const status = input.endsWith("/publish")
        ? "PUBLISHED"
        : input.endsWith("/unpublish")
          ? "UNPUBLISHED"
          : "DRAFT";
      return Response.json({
        data: {
          ...row,
          id,
          status,
          version: (body.expected_version ?? 0) + 1,
          published_at: status === "PUBLISHED" ? row.updated_at : null,
          actions: status === "PUBLISHED" ? ["unpublish"] : ["edit", "publish"],
        },
      });
    },
  });
  await client.connect();
  const created = await client.createDraft(payload);
  assert.match(created.id, /^[0-9a-f-]{36}$/u);
  await client.updateDraft(ID, 1, payload);
  await client.publish(ID, 2);
  await client.unpublish(ID, 3);
  assert.equal(writes[0].method, "POST");
  assert.deepEqual(writes[0].body, { payload, expected_version: null });
  assert.deepEqual(writes[1], {
    input: "/api/admin/meals/" + ID + "/draft",
    method: "PUT",
    body: { payload, expected_version: 1 },
  });
  assert.deepEqual(writes[2].body, { expected_version: 2 });
  assert.deepEqual(writes[3].body, { expected_version: 3 });
});

test("writer-only meal accounts cannot publish and denied sessions clear capabilities", async () => {
  const { MealsInviteClient } = await loadClient();
  let denied = false;
  let calls = 0;
  const client = new MealsInviteClient({
    fetcher: async (input) => {
      calls++;
      if (denied) return Response.json({ error: { code: "UNAUTHENTICATED" } }, { status: 401 });
      return Response.json({
        data:
          input === "/api/admin/me"
            ? { ...identity, memberships: [{ status: "ACTIVE", capabilities: ["content:write"] }] }
            : [{ ...row, actions: ["edit"] }],
      });
    },
  });
  await client.connect();
  assert.equal(client.canPublish, false);
  await assert.rejects(client.publish(ID, 1), /FORBIDDEN_SCOPE/u);
  assert.equal(calls, 2);
  denied = true;
  await assert.rejects(client.list(), /UNAUTHENTICATED/u);
  assert.equal(client.canWrite, false);
  assert.equal(client.canPublish, false);
});

test("meal client rejects unsafe responses, invalid drafts and mismatched mutation results", async () => {
  const { MealsInviteClient } = await loadClient();
  let rows = [row];
  const client = new MealsInviteClient({
    fetcher: async (input, init) => {
      if (input === "/api/admin/me") return Response.json({ data: identity });
      return Response.json({ data: init.method === "GET" ? rows : { ...row, version: 99 } });
    },
  });
  await client.connect();
  await assert.rejects(
    client.createDraft({ ...payload, private_notes: "不得发送" }),
    /VALIDATION_FAILED/u,
  );
  await assert.rejects(
    client.createDraft({ ...payload, meal_date: "2026-02-30" }),
    /VALIDATION_FAILED/u,
  );
  await assert.rejects(
    client.createDraft({ ...payload, meal_type: { toString: "LUNCH" } }),
    /VALIDATION_FAILED/u,
  );
  await assert.rejects(client.updateDraft(ID, 1, payload), /INVALID_API_RESPONSE/u);
  rows = [{ ...row, tenant_id: "internal" }];
  await assert.rejects(client.list(), /INVALID_API_RESPONSE/u);
  rows = [row, row];
  await assert.rejects(client.list(), /INVALID_API_RESPONSE/u);
});

test("HTTP authorization denial overrides missing or unrelated upstream error codes", async () => {
  const { MealsInviteClient } = await loadClient();
  let status = 200;
  const client = new MealsInviteClient({
    fetcher: async (input) =>
      status === 200
        ? Response.json({ data: input === "/api/admin/me" ? identity : [row] })
        : Response.json({ error: { code: "REQUEST_FAILED" } }, { status }),
  });
  for (const [denial, code] of [
    [401, "UNAUTHENTICATED"],
    [403, "FORBIDDEN_SCOPE"],
  ]) {
    status = 200;
    await client.connect();
    status = denial;
    await assert.rejects(client.list(), new RegExp(code, "u"));
    assert.equal(client.canWrite, false);
    assert.equal(client.canPublish, false);
  }
});
