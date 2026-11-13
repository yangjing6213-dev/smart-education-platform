/* global Buffer, Headers, Response, URL */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function loadClient() {
  const path = new URL("../src/app/admin/notice-review/notice-invite-client.ts", import.meta.url);
  const source = await readFile(path, "utf8");
  const output = ts.transpile(source, {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  });
  return import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
}

const noticeId = "11111111-1111-4111-8111-111111111111";
const reviewer = {
  display_name: "模拟校区审核员",
  memberships: [
    {
      status: "ACTIVE",
      capabilities: ["identity:read", "notice:review", "notice:publish", "notice:revoke"],
    },
  ],
};
const baseNotice = {
  id: noticeId,
  templateCode: "CLASS_ACTIVITY",
  target: "CLASS",
  status: "SUBMITTED",
  version: 2,
  published: false,
  createdAt: "2026-10-19T08:00:00.000Z",
  updatedAt: "2026-10-19T08:05:00.000Z",
  title: "班级活动",
  body: "班级近期有活动安排，请家长查看并留意相关时间。",
  synthetic: true,
};

test("invite notice client loads the scoped queue through same-origin cookies", async () => {
  const { NoticeInviteClient } = await loadClient();
  const calls = [];
  const client = new NoticeInviteClient({
    fetcher: async (input, init = {}) => {
      const url = String(input);
      calls.push({ url, init });
      if (url === "/api/admin/me") return Response.json({ data: reviewer });
      if (url === "/api/admin/staff/notices/review") return Response.json({ data: [baseNotice] });
      throw new Error(`unexpected request: ${url}`);
    },
  });

  await client.connect();

  assert.equal(client.snapshot.status, "READY");
  assert.equal(client.snapshot.displayName, "模拟校区审核员");
  assert.deepEqual(client.snapshot.notices, [baseNotice]);
  assert.deepEqual(calls.map(({ url }) => url), ["/api/admin/me", "/api/admin/staff/notices/review"]);
  assert.ok(calls.every(({ init }) => init.credentials === "same-origin"));
  assert.ok(calls.every(({ init }) => !new Headers(init.headers).has("authorization")));
});

test("review and publish use current versions and refresh the pending queue", async () => {
  const { NoticeInviteClient } = await loadClient();
  const calls = [];
  let row = { ...baseNotice };
  const client = new NoticeInviteClient({
    fetcher: async (input, init = {}) => {
      const url = String(input);
      const method = init.method ?? "GET";
      calls.push({ url, method, body: init.body });
      if (url === "/api/admin/me") return Response.json({ data: reviewer });
      if (url === "/api/admin/staff/notices/review" && method === "GET")
        return Response.json({ data: row ? [row] : [] });
      if (url.endsWith("/review")) {
        assert.deepEqual(JSON.parse(String(init.body)), { version: 2, action: "APPROVE" });
        row = { ...row, status: "APPROVED", version: 3 };
        return Response.json({ data: row });
      }
      if (url.endsWith("/publish")) {
        assert.deepEqual(JSON.parse(String(init.body)), { version: 3 });
        row = null;
        return Response.json({ data: { ...baseNotice, status: "PUBLISHED", version: 4, published: true } });
      }
      throw new Error(`unexpected request: ${url}`);
    },
  });

  await client.connect();
  await client.review(noticeId, 2, "APPROVE");
  assert.equal(client.snapshot.notices[0]?.status, "APPROVED");
  await client.publish(noticeId, 3);
  assert.deepEqual(client.snapshot.notices, []);
  assert.equal(calls.filter(({ url, method }) => url.endsWith("/staff/notices/review") && method === "GET").length, 3);
});

test("reviewer without publish capability never sees or publishes approved notices", async () => {
  const { NoticeInviteClient } = await loadClient();
  const calls = [];
  const client = new NoticeInviteClient({
    fetcher: async (input) => {
      const url = String(input);
      calls.push(url);
      if (url === "/api/admin/me")
        return Response.json({ data: { ...reviewer, memberships: [{ status: "ACTIVE", capabilities: ["notice:review"] }] } });
      return Response.json({ data: [{ ...baseNotice, status: "APPROVED" }] });
    },
  });

  await client.connect();
  assert.equal(client.snapshot.status, "READY");
  assert.deepEqual(client.snapshot.notices, []);
  await client.publish(noticeId, 2);
  assert.equal(calls.length, 2);
});

test("malformed notices and denied requests clear old rows", async () => {
  const { NoticeInviteClient } = await loadClient();
  let payload = [baseNotice];
  const client = new NoticeInviteClient({
    fetcher: async (input) => {
      if (String(input) === "/api/admin/me") return Response.json({ data: reviewer });
      if (payload === null) return Response.json({ error: { code: "FORBIDDEN" } }, { status: 403 });
      return Response.json({ data: payload });
    },
  });

  await client.connect();
  assert.equal(client.snapshot.notices.length, 1);
  payload = [{ ...baseNotice, classRef: "internal-class" }];
  await client.refresh();
  assert.equal(client.snapshot.status, "ERROR");
  assert.deepEqual(client.snapshot.notices, []);
  payload = [baseNotice];
  await client.refresh();
  assert.equal(client.snapshot.status, "READY");
  payload = null;
  await client.refresh();
  assert.equal(client.snapshot.status, "FORBIDDEN");
  assert.deepEqual(client.snapshot.notices, []);
});

test("revoke requires its capability and removes the published notice after saving", async () => {
  const { NoticeInviteClient } = await loadClient();
  const calls = [];
  let row = { ...baseNotice, status: "PUBLISHED", version: 5, published: true };
  const client = new NoticeInviteClient({
    fetcher: async (input, init = {}) => {
      const url = String(input);
      const method = init.method ?? "GET";
      calls.push({ url, method, body: init.body });
      if (url === "/api/admin/me") return Response.json({ data: reviewer });
      if (url === "/api/admin/staff/notices/review" && method === "GET")
        return Response.json({ data: row ? [row] : [] });
      if (url.endsWith("/revoke")) {
        assert.deepEqual(JSON.parse(String(init.body)), { version: 5 });
        row = { ...row, status: "REVOKED", version: 6, published: false };
        return Response.json({ data: row });
      }
      throw new Error(`unexpected request: ${url}`);
    },
  });

  await client.connect();
  assert.equal(client.snapshot.notices[0]?.status, "PUBLISHED");
  await client.revoke(noticeId, 5);
  assert.deepEqual(client.snapshot.notices, []);
  assert.equal(client.snapshot.message, "通知已撤回。");
  assert.ok(calls.some(({ url, method }) => url.endsWith("/revoke") && method === "POST"));
});
