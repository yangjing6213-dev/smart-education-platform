/* global Response, URL */

import assert from "node:assert/strict";
import test from "node:test";
import { HomeContentClient } from "../src/app/admin/home-content/home-content-client.ts";

const KEY = "home-content-synthetic-east";
const ME = {
  data: {
    display_name: "模拟机构编辑员",
    memberships: [
      {
        status: "ACTIVE",
        capabilities: ["content:write", "content:publish"],
      },
    ],
  },
};

function record(overrides = {}) {
  return {
    content_key: KEY,
    title: "同芯学园校区服务介绍",
    type: "HOME_BLOCK",
    status: "DRAFT",
    version: 1,
    visibility: "PUBLIC",
    body: {
      summary: "欢迎查看同芯学园的合成演示内容。",
      blocks: [{ kind: "TEXT", text: "这是一条虚构的首页内容。" }],
    },
    synthetic_data: true,
    ...overrides,
  };
}

function json(data, status = 200) {
  return Response.json(status >= 400 ? { error: data } : { data }, { status });
}

test("home content client creates only after explicit save and reloads published state", async () => {
  let stored;
  const calls = [];
  const fetcher = async (input, init = {}) => {
    const url = new URL(String(input), "http://127.0.0.1:3000");
    const method = init.method ?? "GET";
    calls.push({ path: url.pathname, method, body: init.body ? JSON.parse(init.body) : undefined });
    if (url.pathname === "/api/admin/me") return Response.json(ME);
    const base = `/api/admin/institution/home/${KEY}`;
    if (url.pathname === `${base}/draft` && method === "GET")
      return stored
        ? json(stored)
        : json({ code: "NOT_FOUND_SCOPED", message: "Not found." }, 404);
    if (url.pathname === `${base}/draft` && method === "POST") {
      assert.equal(calls.at(-1).body.expected_version, null);
      const payload = calls.at(-1).body.payload;
      stored = record({
        title: payload.title,
        body: { summary: payload.body.summary, blocks: payload.body.blocks },
        version: 1,
      });
      return json(stored, 201);
    }
    if (url.pathname === `${base}/draft` && method === "PUT") {
      const body = calls.at(-1).body;
      if (body.expected_version !== stored.version)
        return json({ code: "VERSION_MISMATCH", message: "Stale." }, 409);
      stored = record({
        title: body.payload.title,
        body: { summary: body.payload.body.summary, blocks: body.payload.body.blocks },
        version: stored.version + 1,
      });
      return json(stored);
    }
    const action = url.pathname.slice(base.length + 1);
    if (method === "POST" && (action === "publish" || action === "unpublish")) {
      assert.equal(calls.at(-1).body.expected_version, stored.version);
      stored = record({
        ...stored,
        status: action === "publish" ? "PUBLISHED" : "UNPUBLISHED",
        version: stored.version + 1,
      });
      return json(stored);
    }
    throw new Error(`Unexpected request ${method} ${url.pathname}`);
  };

  const first = new HomeContentClient({ fetcher });
  assert.equal(await first.connect(), null);
  assert.equal(first.canWrite, true);
  assert.equal(first.canPublish, true);
  assert.equal(calls.filter((call) => call.method !== "GET").length, 0);

  const created = await first.saveDraft({
    title: "同芯学园校区服务介绍",
    summary: "欢迎查看合成演示内容。",
    text: "这是一条虚构的首页内容。",
  });
  assert.equal(created.version, 1);
  assert.equal(created.status, "DRAFT");
  const published = await first.publish();
  assert.equal(published.version, 2);
  assert.equal(published.status, "PUBLISHED");

  const reloaded = new HomeContentClient({ fetcher });
  assert.equal((await reloaded.connect())?.status, "PUBLISHED");
  assert.equal((await reloaded.unpublish()).status, "UNPUBLISHED");

  const update = await reloaded.saveDraft({
    title: "更新后的合成首页",
    summary: "更新后的合成摘要。",
    text: "更新后的虚构正文。",
  });
  assert.equal(update.version, 4);
  assert.equal(update.title, "更新后的合成首页");
  assert.deepEqual(
    calls.filter((call) => call.path === `/api/admin/institution/home/${KEY}/draft`).map((call) => call.method),
    ["GET", "POST", "GET", "PUT"],
  );
});

test("home content client requires one active writer and does not read without permission", async () => {
  const calls = [];
  const client = new HomeContentClient({
    fetcher: async (input) => {
      calls.push(String(input));
      return Response.json({
        data: {
          display_name: "模拟只读账号",
          memberships: [{ status: "ACTIVE", capabilities: ["identity:read"] }],
        },
      });
    },
  });
  await assert.rejects(client.connect(), { message: "FORBIDDEN_SCOPE" });
  assert.deepEqual(calls, ["/api/admin/me"]);
});

test("home content client rejects stale writes and unexpected internal fields", async () => {
  let calls = 0;
  const staleClient = new HomeContentClient({
    fetcher: async (input, init = {}) => {
      const url = new URL(String(input), "http://127.0.0.1");
      if (url.pathname.endsWith("/me")) return Response.json(ME);
      if ((init.method ?? "GET") === "GET") return Response.json({ data: record({ version: 2 }) });
      calls += 1;
      return Response.json({ error: { code: "VERSION_MISMATCH" } }, { status: 409 });
    },
  });
  await staleClient.connect();
  await assert.rejects(
    staleClient.saveDraft({ title: "标题", summary: "摘要", text: "正文" }),
    { message: "VERSION_MISMATCH" },
  );
  assert.equal(calls, 1);

  const unsafeClient = new HomeContentClient({
    fetcher: async (input) =>
      String(input).endsWith("/me")
        ? Response.json(ME)
        : Response.json({ data: record({ tenant_id: "must-not-reach-browser" }) }),
  });
  await assert.rejects(unsafeClient.connect(), { message: "INVALID_API_RESPONSE" });
});
