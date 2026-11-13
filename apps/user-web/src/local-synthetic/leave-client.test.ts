import assert from "node:assert/strict";
import test from "node:test";
import { LeaveClient, createLeaveTransport } from "./leave-client.js";

const RELATION_ID = "00000000-0000-4000-8000-000000000101";
const STUDENT_ID = "00000000-0000-4000-8000-000000000201";
const LEAVE_ID = "00000000-0000-4000-8000-000000000301";
const SECOND_LEAVE_ID = "00000000-0000-4000-8000-000000000302";
const input = {
  startDate: "2026-10-20",
  endDate: "2026-10-21",
  reason: "FAMILY_ARRANGEMENT" as const,
};

type ApiRow = {
  id: string;
  student_id: string;
  start_date: string;
  end_date: string;
  reason_category: string;
  status: "SUBMITTED" | "RETURNED" | "CONFIRMED" | "WITHDRAWN";
  version: number;
  acknowledged: boolean;
};

function createApi() {
  const calls: {
    url: string;
    method: string;
    body?: unknown;
    authorization: string | null;
    credentials?: RequestCredentials;
  }[] = [];
  const rows: ApiRow[] = [];
  let malformedParentList = false;

  const fetcher =
    (role: "parent" | "staff"): typeof fetch =>
    async (inputValue, init = {}) => {
      const url = new URL(String(inputValue), "http://127.0.0.1:3000");
      const method = init.method ?? "GET";
      let body: unknown;
      if (typeof init.body === "string") body = JSON.parse(init.body);
      calls.push({
        url: url.href,
        method,
        body,
        authorization: new Headers(init.headers).get("authorization"),
        ...(init.credentials === undefined ? {} : { credentials: init.credentials }),
      });
      const response = (data: unknown, status = 200) => Response.json({ data }, { status });
      const denied = () => Response.json({ error: { code: "FORBIDDEN_SCOPE" } }, { status: 403 });

      if (url.pathname === "/api-local/identity/login" && method === "POST") {
        const expected = role === "parent" ? "synthetic-parent" : "synthetic-staff";
        if (
          !body ||
          typeof body !== "object" ||
          (body as Record<string, unknown>).username !== expected ||
          (body as Record<string, unknown>).password !== "local-only-password"
        ) {
          return Response.json({ error: { code: "INVALID_CREDENTIALS" } }, { status: 401 });
        }
        return response({ token_type: "Bearer", expires_at: "2035-01-01T00:00:00.000Z" });
      }
      if (url.pathname === "/api-local/identity/logout" && method === "POST")
        return response({ logged_out: true });
      if (url.pathname === "/api-local/me" && method === "GET") {
        return response({
          actor_id:
            role === "parent"
              ? "00000000-0000-4000-8000-000000000401"
              : "00000000-0000-4000-8000-000000000402",
          display_name: role === "parent" ? "合成家长" : "合成员工",
          memberships: [
            {
              status: "ACTIVE",
              capabilities:
                role === "parent"
                  ? ["binding:read", "leave:apply", "leave:read"]
                  : ["leave:review"],
            },
          ],
        });
      }
      if (url.pathname === "/api-local/guardian-relationships" && method === "GET") {
        return role === "parent"
          ? response([
              {
                id: RELATION_ID,
                student_id: STUDENT_ID,
                relationship: "GUARDIAN",
                status: "ACTIVE",
                source_application_id: "00000000-0000-4000-8000-000000000501",
                version: 2,
                approved_at: "2026-10-18T00:00:00.000Z",
              },
            ])
          : denied();
      }
      const listPath =
        role === "parent" ? "/api-local/parent/leave-requests" : "/api-local/staff/leave-requests";
      if (url.pathname === listPath && method === "GET") {
        if (malformedParentList && role === "parent") return response([{ id: "malformed" }]);
        return response(
          rows.map((row) => ({
            ...row,
            student_display_ref: "模拟学生A",
            updated_at: "2026-10-18T00:00:00.000Z",
            actions: row.status === "SUBMITTED" ? ["confirm", "return"] : [],
            ...(role === "staff" ? { class_ref: "模拟班级一" } : {}),
          })),
        );
      }
      if (
        url.pathname === "/api-local/parent/leave-requests" &&
        method === "POST" &&
        role === "parent"
      ) {
        const value = body as Record<string, unknown>;
        assert.equal(value.student_id, STUDENT_ID);
        const row: ApiRow = {
          id: rows.length === 0 ? LEAVE_ID : SECOND_LEAVE_ID,
          student_id: STUDENT_ID,
          start_date: String(value.start_date),
          end_date: String(value.end_date),
          reason_category: String(value.reason_category),
          status: "SUBMITTED",
          version: 1,
          acknowledged: false,
        };
        rows.push(row);
        return response(row, 201);
      }
      const match =
        /^\/api-local\/parent\/leave-requests\/([^/]+)\/(resubmit|withdraw|acknowledge)$/u.exec(
          url.pathname,
        );
      if (match && method === "POST" && role === "parent") {
        const row = rows.find((item) => item.id === match[1]);
        if (!row) return Response.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
        const value = body as Record<string, unknown>;
        if (value.version !== row.version)
          return Response.json({ error: { code: "VERSION_MISMATCH" } }, { status: 409 });
        if (match[2] === "resubmit") {
          row.start_date = String(value.start_date);
          row.end_date = String(value.end_date);
          row.reason_category = String(value.reason_category);
          row.status = "SUBMITTED";
          row.acknowledged = false;
        } else if (match[2] === "withdraw") row.status = "WITHDRAWN";
        else row.acknowledged = true;
        row.version += 1;
        return response(row);
      }
      const review = /^\/api-local\/staff\/leave-requests\/([^/]+)\/review$/u.exec(url.pathname);
      if (review && method === "POST" && role === "staff") {
        const row = rows.find((item) => item.id === review[1]);
        if (!row) return Response.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
        const value = body as Record<string, unknown>;
        if (value.version !== row.version)
          return Response.json({ error: { code: "VERSION_MISMATCH" } }, { status: 409 });
        row.status = value.action === "confirm" ? "CONFIRMED" : "RETURNED";
        row.version += 1;
        return response(row);
      }
      return denied();
    };

  return {
    calls,
    rows,
    fetcher,
    setMalformedParentList(value: boolean) {
      malformedParentList = value;
    },
  };
}

test("leave transport restricts to the same-origin invite proxy, exact roles, methods, and paths", async () => {
  const sent: string[] = [];
  const fetcher: typeof fetch = async (url, init) => {
    sent.push(String(url));
    assert.equal(init?.credentials, "same-origin");
    assert.equal(init?.cache, "no-store");
    assert.equal(init?.redirect, "error");
    assert.equal(new Headers(init?.headers).has("authorization"), false);
    return Response.json({ data: {} });
  };
  const parent = createLeaveTransport("parent", "http://127.0.0.1:3000", fetcher);
  assert.equal((await parent("/api-local/identity/login", { method: "POST" })).status, 200);
  assert.equal((await parent("/api-local/guardian-relationships")).status, 200);
  for (const path of [
    "https://example.com/api-local/parent/leave-requests",
    "/api-local/staff/leave-requests",
    "/api-local/parent/leave-requests?campus_id=other",
    "/api-local/staff/leave-requests/00000000-0000-4000-8000-000000000123/review",
    "/api-local/parent/leave-requests/00000000-0000-4000-8000-000000000123/publish",
  ])
    assert.equal((await parent(path, { method: "POST" })).status, 403);
  assert.equal(sent.length, 2);
  assert.doesNotThrow(() => createLeaveTransport("parent", "https://care.example.invalid"));
  assert.throws(() => createLeaveTransport("parent", "http://care.example.invalid"));
});

test("leave pages restore the server cookie session before loading authorized records", async () => {
  const api = createApi();
  const client = new LeaveClient({
    role: "parent",
    baseUrl: "http://127.0.0.1:3000",
    fetcher: api.fetcher("parent"),
  });
  const restore = (client as unknown as { restore(): Promise<void> }).restore;
  assert.equal(typeof restore, "function", "leave pages need a cookie-session restore operation");
  await restore.call(client);
  assert.equal(client.snapshot.status, "READY");
  assert.equal(client.snapshot.role, "parent");
  assert.equal(client.snapshot.bindings.length, 1);
  assert.equal(new URL(api.calls[0]!.url).pathname, "/api-local/me");
  assert.ok(!api.calls.some((call) => call.url.endsWith("/identity/login")));
});

test("an expired restored session stays anonymous and never reads child records", async () => {
  const paths: string[] = [];
  const client = new LeaveClient({
    role: "parent",
    baseUrl: "http://127.0.0.1:3000",
    fetcher: async (url) => {
      paths.push(new URL(String(url)).pathname);
      return Response.json({ error: { code: "UNAUTHENTICATED" } }, { status: 401 });
    },
  });
  const restore = (client as unknown as { restore(): Promise<void> }).restore;
  assert.equal(typeof restore, "function");
  await restore.call(client);
  assert.equal(client.snapshot.status, "IDLE");
  assert.equal(client.snapshot.role, null);
  assert.deepEqual(client.snapshot.requests, []);
  assert.deepEqual(paths, ["/api-local/me"]);
});

test("restoring leave access cannot combine incomplete membership grants", async () => {
  const paths: string[] = [];
  const client = new LeaveClient({
    role: "parent",
    baseUrl: "http://127.0.0.1:3000",
    fetcher: async (url) => {
      paths.push(new URL(String(url)).pathname);
      return Response.json({
        data: {
          actor_id: "00000000-0000-4000-8000-000000000401",
          display_name: "合成家长",
          memberships: [
            { status: "ACTIVE", capabilities: ["binding:read"] },
            { status: "ACTIVE", capabilities: ["leave:read", "leave:apply"] },
          ],
        },
      });
    },
  });
  await client.restore();
  assert.equal(client.snapshot.status, "DENIED");
  assert.deepEqual(client.snapshot.requests, []);
  assert.deepEqual(paths, ["/api-local/me"]);
});

test("leave logout does not claim success before the cookie proxy responds and permits retry", async () => {
  const api = createApi();
  const transport = api.fetcher("parent");
  let logoutAttempts = 0;
  const client = new LeaveClient({
    role: "parent",
    baseUrl: "http://127.0.0.1:3000",
    fetcher: async (url, init) => {
      if (String(url).endsWith("/logout")) {
        logoutAttempts += 1;
        if (logoutAttempts === 1) throw new Error("test-owned network failure");
      }
      return transport(url, init);
    },
  });
  await client.restore();
  await assert.rejects(client.logout());
  assert.equal(client.snapshot.role, "parent");
  assert.equal(client.snapshot.status, "ERROR");
  assert.deepEqual(client.snapshot.requests, []);
  await client.logout();
  assert.equal(logoutAttempts, 2);
  assert.equal(client.snapshot.role, null);
});

test("invite parent and staff clients share persistent leave submit, review, receipt, resubmit, and withdrawal", async () => {
  const api = createApi();
  const parent = new LeaveClient({
    role: "parent",
    baseUrl: "http://127.0.0.1:3000",
    fetcher: api.fetcher("parent"),
  });
  const staff = new LeaveClient({
    role: "staff",
    baseUrl: "http://127.0.0.1:3000",
    fetcher: api.fetcher("staff"),
  });

  await parent.login("synthetic-parent", "local-only-password");
  assert.equal(parent.snapshot.status, "READY");
  assert.equal(parent.snapshot.bindings.length, 1);
  assert.equal(parent.snapshot.requests.length, 0);
  await parent.apply({ ...input, bindingId: parent.snapshot.bindings[0]!.id });
  let row = parent.snapshot.requests[0]!;
  assert.equal(row.status, "SUBMITTED");
  assert.equal(
    api.calls.find((call) => call.url.endsWith("/parent/leave-requests") && call.method === "POST")
      ?.body &&
      (
        api.calls.find(
          (call) => call.url.endsWith("/parent/leave-requests") && call.method === "POST",
        )?.body as Record<string, unknown>
      ).student_id,
    STUDENT_ID,
  );

  await staff.login("synthetic-staff", "local-only-password");
  await staff.refresh();
  assert.equal(staff.snapshot.requests.length, 1);
  await staff.review(row.id, row.version, "return");
  await parent.refresh();
  row = parent.snapshot.requests[0]!;
  assert.equal(row.status, "RETURNED");
  await parent.acknowledge(row.id, row.version);
  assert.equal(parent.snapshot.requests[0]!.acknowledged, true);
  row = parent.snapshot.requests[0]!;
  await parent.resubmit(row.id, row.version, {
    ...input,
    startDate: "2026-10-22",
    endDate: "2026-10-23",
  });
  assert.equal(parent.snapshot.requests[0]!.status, "SUBMITTED");
  assert.equal(parent.snapshot.requests[0]!.acknowledged, false);
  row = parent.snapshot.requests[0]!;
  await staff.refresh();
  await staff.review(row.id, row.version, "confirm");
  await parent.refresh();
  row = parent.snapshot.requests[0]!;
  assert.equal(row.status, "CONFIRMED");
  await parent.acknowledge(row.id, row.version);
  assert.equal(parent.snapshot.requests[0]!.acknowledged, true);
  await parent.apply({
    ...input,
    startDate: "2026-10-25",
    endDate: "2026-10-25",
    bindingId: parent.snapshot.bindings[0]!.id,
  });
  assert.equal(parent.snapshot.status, "READY", parent.snapshot.message);
  row = parent.snapshot.requests.find((item) => item.status === "SUBMITTED")!;
  assert.ok(row, "撤回测试前应创建第二条待审核申请。");
  await parent.withdraw(row.id, row.version);
  assert.equal(parent.snapshot.requests.find((item) => item.id === row.id)!.status, "WITHDRAWN");

  assert.ok(api.calls.every((call) => call.credentials === "same-origin"));
  assert.ok(api.calls.every((call) => call.authorization === null));
  assert.ok(!JSON.stringify(parent.snapshot).includes(STUDENT_ID));
  assert.ok(!JSON.stringify(parent.snapshot).includes(RELATION_ID));
});

test("an invite lacking leave capability is denied before reading leave or guardian data", async () => {
  const calls: string[] = [];
  const fetcher: typeof fetch = async (input) => {
    const path = new URL(String(input)).pathname;
    calls.push(path);
    if (path.endsWith("/identity/login"))
      return Response.json({
        data: { token_type: "Bearer", expires_at: "2035-01-01T00:00:00.000Z" },
      });
    if (path.endsWith("/me"))
      return Response.json({
        data: {
          actor_id: "00000000-0000-4000-8000-000000000401",
          display_name: "无请假权限账号",
          memberships: [{ status: "ACTIVE", capabilities: ["care:read"] }],
        },
      });
    throw new Error("未授权账号不应读取业务资料");
  };
  const client = new LeaveClient({ role: "parent", baseUrl: "http://127.0.0.1:3000", fetcher });
  await assert.rejects(() => client.login("synthetic-no-leave", "local-only-password"));
  assert.equal(client.snapshot.status, "DENIED");
  assert.deepEqual(calls, ["/api-local/identity/login", "/api-local/me"]);
});

test("malformed leave response clears previously visible parent records", async () => {
  const api = createApi();
  const client = new LeaveClient({
    role: "parent",
    baseUrl: "http://127.0.0.1:3000",
    fetcher: api.fetcher("parent"),
  });
  await client.login("synthetic-parent", "local-only-password");
  await client.apply({ ...input, bindingId: client.snapshot.bindings[0]!.id });
  assert.equal(client.snapshot.requests.length, 1);
  api.setMalformedParentList(true);
  await client.refresh();
  assert.equal(client.snapshot.status, "ERROR");
  assert.equal(client.snapshot.bindings.length, 0);
  assert.equal(client.snapshot.requests.length, 0);
});
