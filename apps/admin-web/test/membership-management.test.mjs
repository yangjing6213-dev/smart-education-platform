import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { URL } from "node:url";
import {
  createLocalMembershipTransport,
  MembershipManagementClient,
  renderMembershipManagement,
} from "../dist/local-review/membership-management.js";

const entrySource = readFileSync(new URL("../src/main.ts", import.meta.url), "utf8");

test("the existing employee page includes a locally scoped membership management panel", () => {
  assert.match(entrySource, /MembershipManagementClient/u);
  assert.match(entrySource, /renderMembershipManagement/u);
  assert.match(entrySource, /loadMembershipManagement\(panel/u);
  assert.match(entrySource, /createLocalMembershipTransport/u);
  const renderSource = entrySource.slice(entrySource.indexOf("function render(): void"));
  assert.match(
    renderSource,
    /if \(\(path !== "\/admin\/staff" && path !== "\/admin\/staff-accounts"\) \|\| mode === "DENIED"\)\s*membershipManagementClient\.disconnect\(\);/u,
  );
});

const ids = {
  owner: "00000000-0000-4000-8000-000000000003",
  member: "00000000-0000-4000-8000-000000000201",
  tenant: "00000000-0000-4000-8000-000000000100",
  campus: "00000000-0000-4000-8000-000000000101",
  otherCampus: "00000000-0000-4000-8000-000000000102",
  class: "00000000-0000-4000-8000-000000000103",
};
const handle = "a".repeat(43);

function createService({ actions = ["membership:manage", "audit:read"], conflict = false } = {}) {
  const calls = [];
  const member = {
    actorId: ids.member,
    version: 7,
    profile: "teacher-east",
    label: "模拟教师甲",
    role: "教师",
    tenantId: ids.tenant,
    campusId: ids.campus,
    classIds: [ids.class],
    status: "ACTIVE",
    capabilities: ["care-records:write"],
  };
  const events = [];
  const service = async (input, init = {}) => {
    const url = new URL(input);
    const method = init.method ?? "GET";
    calls.push({ path: url.pathname, method, body: init.body });
    if (url.pathname === "/local/sessions")
      return globalThis.Response.json({ handle }, { status: 201 });
    if (url.pathname === "/local/session")
      return globalThis.Response.json({
        label: "东校区负责人",
        actorId: ids.owner,
        tenantId: ids.tenant,
        campusId: ids.campus,
        actions,
      });
    if (url.pathname === "/local/memberships")
      return globalThis.Response.json([
        conflict && member.version === 7 ? { ...member, version: 8, status: "SUSPENDED" } : member,
      ]);
    if (url.pathname === "/local/membership-events") return globalThis.Response.json(events);
    if (url.pathname === `/local/memberships/${ids.member}` && method === "PATCH") {
      const body = JSON.parse(init.body);
      if (conflict || body.version !== member.version)
        return new globalThis.Response(null, { status: 409 });
      member.version += 1;
      member.status = body.status;
      events.push({
        actorId: ids.owner,
        targetActorId: ids.member,
        fromStatus: "ACTIVE",
        toStatus: body.status,
        occurredAt: "2026-10-08T00:00:00.000Z",
      });
      return globalThis.Response.json(member);
    }
    return new globalThis.Response(null, { status: 404 });
  };
  return { calls, member, service };
}

test("membership transport allows only scoped loopback endpoints and methods", async () => {
  const calls = [];
  const transport = createLocalMembershipTransport(4317, async (input, init) => {
    calls.push({ url: new URL(input).href, redirect: init?.redirect });
    return globalThis.Response.json({ ok: true });
  });
  await transport("/local/sessions", { method: "POST" });
  await assert.rejects(transport("https://example.com/local/sessions", { method: "POST" }));
  await assert.rejects(transport("/local/staff-credentials", { method: "GET" }));
  await assert.rejects(transport("/local/memberships?campusId=other", { method: "GET" }));
  await assert.rejects(
    createLocalMembershipTransport(65536)("/local/sessions", { method: "POST" }),
  );
  assert.equal(calls.length, 1);
  assert.equal(new URL(calls[0].url).origin, "http://127.0.0.1:4317");
  assert.equal(calls[0].redirect, "error");
});

test("a manager sees only same-campus memberships and status changes send the current version", async () => {
  const mock = createService();
  const client = new MembershipManagementClient(createLocalMembershipTransport(4317, mock.service));
  await client.connect("owner-east");
  assert.equal(client.snapshot.status, "READY");
  assert.equal(client.snapshot.memberships.length, 1);
  assert.equal(client.snapshot.memberships[0].campusId, ids.campus);

  assert.equal(await client.setStatus(ids.member, "SUSPENDED"), true);
  const update = mock.calls.find((call) => call.method === "PATCH");
  assert.deepEqual(JSON.parse(update.body), { status: "SUSPENDED", version: 7 });
  assert.equal(client.snapshot.memberships[0].status, "SUSPENDED");
  assert.equal(client.snapshot.memberships[0].version, 8);
  assert.equal(client.snapshot.events.length, 1);
});

test("non-manager and cross-campus responses fail closed without exposing member rows", async () => {
  const denied = createService({ actions: ["identity:read"] });
  const deniedClient = new MembershipManagementClient(
    createLocalMembershipTransport(4317, denied.service),
  );
  await deniedClient.connect("owner-east");
  assert.equal(deniedClient.snapshot.status, "DENIED");
  assert.equal(
    denied.calls.some((call) => call.path === "/local/memberships"),
    false,
  );

  const crossCampus = createService();
  const invalidService = async (input, init) => {
    const response = await crossCampus.service(input, init);
    if (new URL(input).pathname !== "/local/memberships") return response;
    return globalThis.Response.json([{ ...crossCampus.member, campusId: ids.otherCampus }]);
  };
  const invalidClient = new MembershipManagementClient(
    createLocalMembershipTransport(4317, invalidService),
  );
  await invalidClient.connect("owner-east");
  assert.equal(invalidClient.snapshot.status, "DENIED");
  assert.deepEqual(invalidClient.snapshot.memberships, []);
});

test("stale updates refresh the current state and report the conflict", async () => {
  const mock = createService({ conflict: true });
  const client = new MembershipManagementClient(createLocalMembershipTransport(4317, mock.service));
  await client.connect("owner-east");
  assert.equal(await client.setStatus(ids.member, "SUSPENDED"), false);
  assert.equal(client.snapshot.memberships[0].version, 8);
  assert.equal(client.snapshot.memberships[0].status, "SUSPENDED");
  assert.match(client.snapshot.message, /已被更新/u);
});

test("an older concurrent refresh cannot overwrite a newer membership snapshot", async () => {
  const mock = createService();
  const pendingMembershipResponses = [];
  let delayMembershipResponses = false;
  const delayedService = async (input, init) => {
    if (delayMembershipResponses && new URL(input).pathname === "/local/memberships") {
      return new Promise((resolve) => pendingMembershipResponses.push(resolve));
    }
    return mock.service(input, init);
  };
  const client = new MembershipManagementClient(
    createLocalMembershipTransport(4317, delayedService),
  );
  await client.connect("owner-east");
  delayMembershipResponses = true;

  const olderRefresh = client.refresh();
  const waitForResponse = async (count) => {
    while (pendingMembershipResponses.length < count)
      await new Promise((resolve) => globalThis.setTimeout(resolve, 0));
  };
  await waitForResponse(1);
  const newerRefresh = client.refresh();
  await waitForResponse(2);

  pendingMembershipResponses[1](
    globalThis.Response.json([{ ...mock.member, version: 9, status: "SUSPENDED" }]),
  );
  await newerRefresh;
  pendingMembershipResponses[0](
    globalThis.Response.json([{ ...mock.member, version: 8, status: "ACTIVE" }]),
  );
  await olderRefresh;

  assert.equal(client.snapshot.memberships[0].version, 9);
  assert.equal(client.snapshot.memberships[0].status, "SUSPENDED");
});

test("membership rendering escapes labels and hides actions in read-only mode", () => {
  const html = renderMembershipManagement(
    {
      status: "READY",
      message: "仅本机示例",
      profile: "owner-east",
      label: "负责人",
      actorId: ids.owner,
      tenantId: ids.tenant,
      campusId: ids.campus,
      actions: ["membership:manage"],
      memberships: [
        {
          actorId: ids.member,
          version: 7,
          profile: "teacher-east",
          label: "<script>alert(1)</script>",
          role: "教师",
          tenantId: ids.tenant,
          campusId: ids.campus,
          classIds: [ids.class],
          status: "ACTIVE",
          capabilities: ["care-records:write"],
        },
      ],
      events: [],
    },
    false,
  );
  assert.match(html, /&lt;script&gt;/u);
  assert.doesNotMatch(html, /data-membership-action/u);
  assert.match(html, /<select[^>]+disabled/u);
});
